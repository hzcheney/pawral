import express from "express";
import type { Application } from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { PawralDatabase } from "./database.js";
import { TerminalManager } from "./terminal-manager.js";
import { GitOps } from "./git-ops.js";
import { BudgetTracker } from "./budget-tracker.js";
import { TaskScheduler } from "./task-scheduler.js";
import { ClientMessageSchema } from "./types.js";
import type { ServerMessage } from "./types.js";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ServerConfig {
  port: number;
  workerCount: number;
  workspaceBase: string;
  dbPath?: string;
}

// ─── Server context ──────────────────────────────────────────────────────────

export interface ServerContext {
  db: PawralDatabase;
  terminalManager: TerminalManager;
  gitOps: GitOps;
  budgetTracker: BudgetTracker;
  scheduler: TaskScheduler;
  app: Application;
  listen: () => http.Server;
  dispose: () => void;
  startTick: (intervalMs: number) => ReturnType<typeof setInterval>;
  stopTick: (intervalId: ReturnType<typeof setInterval>) => void;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createServer(config: ServerConfig): ServerContext {
  // Initialize modules
  const db = new PawralDatabase(config.dbPath ?? ":memory:");
  const terminalManager = new TerminalManager();
  terminalManager.init(config.workerCount, config.workspaceBase);

  const gitOps = new GitOps();
  const budgetTracker = new BudgetTracker(db);
  const scheduler = new TaskScheduler(db, terminalManager, gitOps, budgetTracker);

  // Express app
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", workers: terminalManager.getWorkers().length });
  });

  // REST API: list tasks
  app.get("/api/tasks", (_req, res) => {
    const tasks = db.listTasks();
    res.json(tasks);
  });

  // REST API: get budget summary
  app.get("/api/budget", (_req, res) => {
    const workerIds = terminalManager.getWorkers().map((w) => w.id);
    const summary = budgetTracker.getSummary(workerIds);
    res.json(summary);
  });

  // REST API: get settings
  app.get("/api/settings", (_req, res) => {
    const settings = db.getSettings();
    res.json(settings);
  });

  // Listen function creates HTTP server + WebSocket
  function listen(): http.Server {
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    // Broadcast helper
    function broadcast(msg: ServerMessage): void {
      const data = JSON.stringify(msg);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    }

    // Forward terminal output to WebSocket clients
    terminalManager.on("terminal.data", (event: { workerId: string; data: string }) => {
      broadcast({ type: "terminal.data", workerId: event.workerId, data: event.data });
    });

    // Forward worker status changes
    terminalManager.on("worker.phase", (event: { workerId: string; phase: string }) => {
      const worker = terminalManager.getWorker(event.workerId);
      if (worker) {
        broadcast({
          type: "worker.status",
          workerId: event.workerId,
          status: worker.status,
          phase: worker.phase,
        });
      }
    });

    // Handle worker completion
    terminalManager.on(
      "worker.completed",
      (event: {
        workerId: string;
        task: { id: string } | null;
        costInfo: { cost: number; tokensIn: number; tokensOut: number } | null;
        prUrl?: string;
      }) => {
        if (event.task) {
          scheduler.complete(event.task.id, {
            cost: event.costInfo?.cost,
            tokensIn: event.costInfo?.tokensIn,
            tokensOut: event.costInfo?.tokensOut,
            prUrl: event.prUrl,
          });
          const updatedTask = db.getTask(event.task.id);
          if (updatedTask) {
            broadcast({ type: "task.updated", task: updatedTask });
          }
        }
      },
    );

    // Handle worker errors
    terminalManager.on(
      "worker.error",
      (event: { workerId: string; task: { id: string } | null; output: string }) => {
        if (event.task) {
          scheduler.fail(event.task.id, `Worker ${event.workerId} error: ${event.output.slice(-200)}`);
          const updatedTask = db.getTask(event.task.id);
          if (updatedTask) {
            broadcast({ type: "task.updated", task: updatedTask });
          }
        }
      },
    );

    // Budget events
    budgetTracker.on("budget.warning", (event: { level: string; total: number; limit: number }) => {
      broadcast({
        type: "alert",
        alert: {
          id: `budget-warning-${Date.now()}`,
          message: `Budget warning: ${event.level} at $${event.total.toFixed(2)}/$${event.limit}`,
          severity: "warning",
          timestamp: Date.now(),
        },
      });
    });

    budgetTracker.on("budget.exceeded", (event: { level: string; total: number; limit: number }) => {
      broadcast({
        type: "alert",
        alert: {
          id: `budget-exceeded-${Date.now()}`,
          message: `Budget exceeded: ${event.level} at $${event.total.toFixed(2)}/$${event.limit}`,
          severity: "error",
          timestamp: Date.now(),
        },
      });
    });

    // Handle WebSocket connections
    wss.on("connection", (ws) => {
      // Send initial state
      const workers = terminalManager.getWorkers().map((w) => ({
        id: w.id,
        workspace: w.workspace,
        status: w.status,
        currentTaskId: w.currentTask?.id ?? null,
        startedAt: w.startedAt,
      }));
      const tasks = db.listTasks();
      ws.send(JSON.stringify({ type: "init", workers, tasks } satisfies ServerMessage));

      // Handle client messages
      ws.on("message", (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          const msg = ClientMessageSchema.parse(parsed);

          switch (msg.type) {
            case "terminal.input":
              terminalManager.write(msg.workerId, msg.data);
              break;
            case "terminal.resize":
              terminalManager.resize(msg.workerId, msg.cols, msg.rows);
              break;
            case "task.create": {
              const task = scheduler.enqueue(msg.task);
              broadcast({ type: "task.updated", task });
              break;
            }
            case "task.assign":
              // Manual assignment
              {
                const task = db.getTask(msg.taskId);
                if (task) {
                  scheduler.assign(task, msg.workerId);
                  const updated = db.getTask(msg.taskId);
                  if (updated) broadcast({ type: "task.updated", task: updated });
                }
              }
              break;
            case "task.cancel": {
              scheduler.fail(msg.taskId, "Cancelled by user");
              const updated = db.getTask(msg.taskId);
              if (updated) broadcast({ type: "task.updated", task: updated });
              break;
            }
            case "worker.kill":
              terminalManager.kill(msg.workerId);
              break;
            case "settings.update":
              db.updateSettings(msg.settings);
              if (msg.settings.dailyBudget || msg.settings.weeklyBudget) {
                budgetTracker.setLimits({
                  daily: msg.settings.dailyBudget,
                  weekly: msg.settings.weeklyBudget,
                });
              }
              break;
            case "subscribe":
              // No-op: server broadcasts to all clients anyway
              break;
          }
        } catch (err) {
          ws.send(
            JSON.stringify({
              type: "alert",
              alert: {
                id: `error-${Date.now()}`,
                message: `Invalid message: ${err instanceof Error ? err.message : "unknown error"}`,
                severity: "error",
                timestamp: Date.now(),
              },
            } satisfies ServerMessage),
          );
        }
      });
    });

    server.listen(config.port);
    return server;
  }

  function dispose(): void {
    terminalManager.dispose();
    db.close();
  }

  function startTick(intervalMs: number): ReturnType<typeof setInterval> {
    return setInterval(() => {
      scheduler.tick().catch(() => {
        // ignore tick errors
      });
    }, intervalMs);
  }

  function stopTick(intervalId: ReturnType<typeof setInterval>): void {
    clearInterval(intervalId);
  }

  return {
    db,
    terminalManager,
    gitOps,
    budgetTracker,
    scheduler,
    app,
    listen,
    dispose,
    startTick,
    stopTick,
  };
}
