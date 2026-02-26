import { EventEmitter } from "node:events";
import { mkdirSync, existsSync } from "node:fs";
import { spawn } from "@lydell/node-pty";
import type { IPty } from "@lydell/node-pty";
import type { Task, WorkerStatus, WorkerPhase } from "./types.js";
import { StatusDetector } from "./status-detector.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerTerminal {
  id: string;
  pty: IPty;
  workspace: string;
  status: WorkerStatus;
  phase: WorkerPhase;
  currentTask: Task | null;
  outputBuffer: string; // rolling output window
  startedAt: number | null;
}

// ─── TerminalManager ──────────────────────────────────────────────────────────

export class TerminalManager extends EventEmitter {
  private workers: Map<string, WorkerTerminal> = new Map();
  private readonly detector = new StatusDetector();
  private readonly OUTPUT_BUFFER_SIZE = 4096;

  /**
   * Initialize N persistent bash shells.
   */
  init(workerCount: number, basePath: string): void {
    for (let i = 1; i <= workerCount; i++) {
      const id = `worker-${i}`;
      const workspace = `${basePath}/${id}`;

      // Ensure workspace directory exists
      if (!existsSync(workspace)) {
        mkdirSync(workspace, { recursive: true });
      }

      let pty: IPty;
      try {
        pty = spawn("bash", [], {
          name: "xterm-256color",
          cols: 120,
          rows: 40,
          cwd: workspace,
          env: process.env as Record<string, string>,
        });
      } catch (err) {
        console.warn(`[${id}] Failed to spawn PTY (${err instanceof Error ? err.message : err}), creating stub worker`);
        // Create a stub worker without a real PTY — useful for environments where PTY is unavailable
        const stubWorker: WorkerTerminal = {
          id,
          pty: null as unknown as IPty,
          workspace,
          status: "idle",
          phase: "idle",
          currentTask: null,
          outputBuffer: "",
          startedAt: null,
        };
        this.workers.set(id, stubWorker);
        continue;
      }

      const worker: WorkerTerminal = {
        id,
        pty,
        workspace,
        status: "idle",
        phase: "idle",
        currentTask: null,
        outputBuffer: "",
        startedAt: null,
      };

      pty.onData((data: string) => {
        this.handleOutput(id, data);
      });

      pty.onExit(({ exitCode }: { exitCode: number }) => {
        this.emit("worker.exit", { workerId: id, exitCode });
      });

      this.workers.set(id, worker);
    }
  }

  /**
   * Handle terminal output — forward to clients and update phase.
   */
  private handleOutput(workerId: string, data: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Append to rolling buffer
    worker.outputBuffer = (worker.outputBuffer + data).slice(-this.OUTPUT_BUFFER_SIZE);

    // Forward raw data to WebSocket clients
    this.emit("terminal.data", { workerId, data });

    // Update phase from output
    const phase = this.detector.detectPhase(worker.outputBuffer);
    if (phase !== worker.phase) {
      worker.phase = phase;
      this.emit("worker.phase", { workerId, phase });
    }

    // If phase becomes idle and worker was running, it likely completed
    if (phase === "idle" && worker.status === "running") {
      const completion = this.detector.detectCompletion(worker.outputBuffer);
      if (completion.completed) {
        const costInfo = this.detector.parseCost(worker.outputBuffer, worker.currentTask?.model);
        worker.status = "idle";
        this.emit("worker.completed", {
          workerId,
          task: worker.currentTask,
          costInfo,
          prUrl: completion.prUrl,
        });
        worker.currentTask = null;
        worker.startedAt = null;
        worker.outputBuffer = "";
      }
    }

    // Detect errors
    if (phase === "error" && worker.status === "running") {
      worker.status = "error";
      this.emit("worker.error", { workerId, task: worker.currentTask, output: worker.outputBuffer });
    }
  }

  /**
   * Execute a command in a worker's shell.
   */
  exec(workerId: string, command: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);
    if (!worker.pty) throw new Error(`Worker ${workerId} has no PTY (stub worker)`);
    worker.pty.write(command + "\r");
  }

  /**
   * Resize a worker's terminal.
   */
  resize(workerId: string, cols: number, rows: number): void {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);
    if (!worker.pty) return; // stub worker, ignore
    worker.pty.resize(cols, rows);
  }

  /**
   * Write raw data to a worker's PTY (for manual input).
   */
  write(workerId: string, data: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);
    if (!worker.pty) throw new Error(`Worker ${workerId} has no PTY (stub worker)`);
    worker.pty.write(data);
  }

  /**
   * Get all workers.
   */
  getWorkers(): WorkerTerminal[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get idle workers.
   */
  getIdleWorkers(): WorkerTerminal[] {
    return this.getWorkers().filter((w) => w.status === "idle");
  }

  /**
   * Get a specific worker.
   */
  getWorker(workerId: string): WorkerTerminal | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Mark a worker as running a specific task.
   */
  setWorkerTask(workerId: string, task: Task): void {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);
    worker.status = "running";
    worker.currentTask = task;
    worker.startedAt = Date.now();
    worker.outputBuffer = "";
    worker.phase = "running";
  }

  /**
   * Kill/restart a worker's PTY process.
   */
  kill(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);
    if (worker.pty) worker.pty.kill();
    worker.status = "idle";
    worker.currentTask = null;
    worker.startedAt = null;
    worker.outputBuffer = "";
    worker.phase = "idle";
  }

  /**
   * Dispose all workers.
   */
  dispose(): void {
    for (const worker of this.workers.values()) {
      try {
        if (worker.pty) worker.pty.kill();
      } catch {
        // ignore cleanup errors
      }
    }
    this.workers.clear();
  }
}
