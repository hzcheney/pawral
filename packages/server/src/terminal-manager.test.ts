import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// ─── Mock node:fs ─────────────────────────────────────────────────────────────

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  };
});

// ─── Mock @lydell/node-pty ────────────────────────────────────────────────────

class MockPty extends EventEmitter {
  cols = 120;
  rows = 40;
  pid = 12345;
  killed = false;

  private _dataHandlers: Array<(data: string) => void> = [];
  private _exitHandlers: Array<(e: { exitCode: number }) => void> = [];

  write(data: string): void {
    this.emit("_write", data);
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  kill(): void {
    this.killed = true;
    for (const h of this._exitHandlers) {
      h({ exitCode: 0 });
    }
  }

  onData(handler: (data: string) => void): { dispose: () => void } {
    this._dataHandlers.push(handler);
    return {
      dispose: () => {
        this._dataHandlers = this._dataHandlers.filter((h) => h !== handler);
      },
    };
  }

  onExit(handler: (e: { exitCode: number }) => void): { dispose: () => void } {
    this._exitHandlers.push(handler);
    return {
      dispose: () => {
        this._exitHandlers = this._exitHandlers.filter((h) => h !== handler);
      },
    };
  }

  simulateData(data: string): void {
    for (const h of this._dataHandlers) h(data);
  }
}

const createdPtys: MockPty[] = [];

vi.mock("@lydell/node-pty", () => ({
  spawn: vi.fn(() => {
    const pty = new MockPty();
    createdPtys.push(pty);
    return pty;
  }),
}));

// ─── Import subject AFTER mocks ───────────────────────────────────────────────

import { TerminalManager } from "./terminal-manager.js";
import type { Task } from "./types.js";

function makeTask(id = "task-001"): Task {
  return {
    id,
    title: "Test",
    prompt: "Do it",
    repo: "https://github.com/org/repo",
    branch: "swarm/test",
    priority: "medium",
    model: "claude-sonnet-4-6",
    agent: "claude",
    budgetLimit: 3,
    dependsOn: [],
    status: "queued",
    assignedWorker: null,
    prUrl: null,
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    errorMessage: null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TerminalManager", () => {
  let mgr: TerminalManager;

  beforeEach(() => {
    createdPtys.length = 0;
    mgr = new TerminalManager();
    mgr.init(3, "/tmp/test-workspaces");
  });

  afterEach(() => {
    mgr.dispose();
    vi.clearAllMocks();
  });

  it("creates the right number of workers", () => {
    expect(mgr.getWorkers()).toHaveLength(3);
    expect(mgr.getWorkers().map((w) => w.id)).toEqual(["worker-1", "worker-2", "worker-3"]);
  });

  it("all workers start idle", () => {
    expect(mgr.getWorkers().every((w) => w.status === "idle")).toBe(true);
  });

  it("getIdleWorkers returns all workers initially", () => {
    expect(mgr.getIdleWorkers()).toHaveLength(3);
  });

  it("exec writes command + carriage return to pty", () => {
    const pty = createdPtys[0]!;
    const writeSpy = vi.spyOn(pty, "write");
    mgr.exec("worker-1", "ls -la");
    expect(writeSpy).toHaveBeenCalledWith("ls -la\r");
  });

  it("throws when exec-ing unknown worker", () => {
    expect(() => mgr.exec("worker-99", "ls")).toThrow("Worker worker-99 not found");
  });

  it("resize updates pty dimensions", () => {
    const pty = createdPtys[0]!;
    mgr.resize("worker-1", 200, 50);
    expect(pty.cols).toBe(200);
    expect(pty.rows).toBe(50);
  });

  it("write passes raw data to pty", () => {
    const pty = createdPtys[0]!;
    const writeSpy = vi.spyOn(pty, "write");
    mgr.write("worker-1", "\x03");
    expect(writeSpy).toHaveBeenCalledWith("\x03");
  });

  it("setWorkerTask marks worker as running", () => {
    const task = makeTask();
    mgr.setWorkerTask("worker-1", task);
    const worker = mgr.getWorker("worker-1")!;
    expect(worker.status).toBe("running");
    expect(worker.currentTask?.id).toBe("task-001");
    expect(worker.startedAt).not.toBeNull();
  });

  it("setWorkerTask removes worker from idle list", () => {
    mgr.setWorkerTask("worker-1", makeTask());
    expect(mgr.getIdleWorkers()).toHaveLength(2);
    expect(mgr.getIdleWorkers().map((w) => w.id)).not.toContain("worker-1");
  });

  it("emits terminal.data on pty output", () => {
    const dataSpy = vi.fn();
    mgr.on("terminal.data", dataSpy);
    createdPtys[0]!.simulateData("hello world");
    expect(dataSpy).toHaveBeenCalledWith({ workerId: "worker-1", data: "hello world" });
  });

  it("emits worker.phase when phase changes", () => {
    const phaseSpy = vi.fn();
    mgr.on("worker.phase", phaseSpy);
    mgr.setWorkerTask("worker-1", makeTask());
    createdPtys[0]!.simulateData("Planning... analyzing the codebase structure");
    expect(phaseSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: "worker-1", phase: "planning" })
    );
  });

  it("emits worker.completed when shell prompt appears after running", () => {
    const completedSpy = vi.fn();
    mgr.on("worker.completed", completedSpy);
    mgr.setWorkerTask("worker-1", makeTask());
    createdPtys[0]!.simulateData("Task done!\nuser@host:~$ ");
    expect(completedSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: "worker-1" })
    );
    expect(mgr.getWorker("worker-1")!.status).toBe("idle");
  });

  it("kill terminates pty and resets worker", () => {
    mgr.setWorkerTask("worker-1", makeTask());
    mgr.kill("worker-1");
    const worker = mgr.getWorker("worker-1")!;
    expect(worker.status).toBe("idle");
    expect(worker.currentTask).toBeNull();
    expect(createdPtys[0]!.killed).toBe(true);
  });

  it("dispose kills all ptys", () => {
    mgr.dispose();
    expect(createdPtys.every((p) => p.killed)).toBe(true);
  });

  it("getWorker returns undefined for unknown id", () => {
    expect(mgr.getWorker("worker-99")).toBeUndefined();
  });
});
