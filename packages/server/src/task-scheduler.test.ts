import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  write(_data: string): void {
    // no-op in mock
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
}

vi.mock("@lydell/node-pty", () => ({
  spawn: vi.fn(() => new MockPty()),
}));

// ─── Mock simple-git ──────────────────────────────────────────────────────────

vi.mock("simple-git", () => ({
  default: vi.fn(() => ({
    fetch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ files: [] }),
    raw: vi.fn().mockResolvedValue(""),
  })),
}));

// ─── Imports AFTER mocks ──────────────────────────────────────────────────────

import { TaskScheduler } from "./task-scheduler.js";
import { PawralDatabase } from "./database.js";
import { TerminalManager } from "./terminal-manager.js";
import { GitOps } from "./git-ops.js";
import { BudgetTracker } from "./budget-tracker.js";
import type { Task } from "./types.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-001",
    title: "Test Task",
    prompt: "Do something",
    repo: "https://github.com/org/repo",
    branch: "swarm/test",
    priority: "medium",
    model: "claude-sonnet-4-6",
    agent: "claude",
    budgetLimit: 3.0,
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
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TaskScheduler", () => {
  let db: PawralDatabase;
  let termMgr: TerminalManager;
  let gitOps: GitOps;
  let budgetTracker: BudgetTracker;
  let scheduler: TaskScheduler;

  beforeEach(() => {
    db = new PawralDatabase(":memory:");
    termMgr = new TerminalManager();
    termMgr.init(3, "/tmp/test-workspaces");
    gitOps = new GitOps();
    budgetTracker = new BudgetTracker(db, { daily: 50, weekly: 200, perTask: 3 });
    scheduler = new TaskScheduler(db, termMgr, gitOps, budgetTracker);
  });

  afterEach(() => {
    termMgr.dispose();
    db.close();
  });

  describe("enqueue", () => {
    it("adds a task to the database with queued status", () => {
      const task = scheduler.enqueue({
        title: "Implement OAuth",
        prompt: "Add OAuth support",
        repo: "https://github.com/org/repo",
        branch: "swarm/oauth",
      });
      expect(task.id).toBeTruthy();
      expect(task.status).toBe("queued");
      expect(task.title).toBe("Implement OAuth");

      const retrieved = db.getTask(task.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe("Implement OAuth");
    });

    it("generates a unique id for each task", () => {
      const t1 = scheduler.enqueue({
        title: "Task 1",
        prompt: "Do A",
        repo: "https://github.com/org/repo",
        branch: "swarm/a",
      });
      const t2 = scheduler.enqueue({
        title: "Task 2",
        prompt: "Do B",
        repo: "https://github.com/org/repo",
        branch: "swarm/b",
      });
      expect(t1.id).not.toBe(t2.id);
    });

    it("uses default model and agent from settings", () => {
      const task = scheduler.enqueue({
        title: "Test",
        prompt: "Do it",
        repo: "https://github.com/org/repo",
        branch: "swarm/test",
      });
      expect(task.model).toBe("claude-sonnet-4-6");
      expect(task.agent).toBe("claude");
    });

    it("allows overriding priority", () => {
      const task = scheduler.enqueue({
        title: "Urgent",
        prompt: "Fix now",
        repo: "https://github.com/org/repo",
        branch: "swarm/fix",
        priority: "high",
      });
      expect(task.priority).toBe("high");
    });
  });

  describe("tick", () => {
    it("does nothing when no queued tasks", async () => {
      await scheduler.tick();
      // no error
    });

    it("does nothing when no idle workers", async () => {
      db.createTask(makeTask({ id: "t1" }));
      // Mark all workers as running
      for (const w of termMgr.getWorkers()) {
        termMgr.setWorkerTask(w.id, makeTask({ id: `running-${w.id}` }));
      }
      await scheduler.tick();
      const task = db.getTask("t1");
      expect(task?.status).toBe("queued");
    });

    it("assigns a queued task to an idle worker", async () => {
      db.createTask(makeTask({ id: "t1" }));
      await scheduler.tick();
      const task = db.getTask("t1");
      expect(task?.status).toBe("running");
      expect(task?.assignedWorker).toBe("worker-1");
    });

    it("respects task priority order", async () => {
      const now = Date.now();
      db.createTask(makeTask({ id: "low-1", priority: "low", createdAt: now }));
      db.createTask(makeTask({ id: "high-1", priority: "high", createdAt: now + 100 }));
      await scheduler.tick();
      const highTask = db.getTask("high-1");
      const lowTask = db.getTask("low-1");
      expect(highTask?.status).toBe("running");
      expect(lowTask?.status).toBe("queued");
    });

    it("skips tasks with unfinished dependencies", async () => {
      db.createTask(makeTask({ id: "dep-1", status: "running" }));
      db.createTask(makeTask({ id: "t2", dependsOn: ["dep-1"] }));
      await scheduler.tick();
      const task = db.getTask("t2");
      expect(task?.status).toBe("queued");
    });

    it("does not assign when budget is exceeded", async () => {
      // Record enough cost to exceed daily budget
      db.recordBudget({
        workerId: "worker-1",
        taskId: null,
        cost: 55,
        tokensIn: null,
        tokensOut: null,
        model: null,
        recordedAt: Date.now(),
      });
      db.createTask(makeTask({ id: "t1" }));
      await scheduler.tick();
      const task = db.getTask("t1");
      expect(task?.status).toBe("queued");
    });
  });

  describe("complete", () => {
    it("marks task as done and records cost", () => {
      db.createTask(makeTask({ id: "t1", status: "running", assignedWorker: "worker-1" }));
      termMgr.setWorkerTask("worker-1", makeTask({ id: "t1" }));

      scheduler.complete("t1", {
        cost: 1.5,
        tokensIn: 5000,
        tokensOut: 1000,
        prUrl: "https://github.com/org/repo/pull/42",
      });

      const task = db.getTask("t1");
      expect(task?.status).toBe("done");
      expect(task?.cost).toBe(1.5);
      expect(task?.prUrl).toBe("https://github.com/org/repo/pull/42");
      expect(task?.completedAt).not.toBeNull();
    });
  });

  describe("fail", () => {
    it("marks task as failed with error message", () => {
      db.createTask(makeTask({ id: "t1", status: "running", assignedWorker: "worker-1" }));
      scheduler.fail("t1", "TypeScript compilation failed");

      const task = db.getTask("t1");
      expect(task?.status).toBe("failed");
      expect(task?.errorMessage).toBe("TypeScript compilation failed");
      expect(task?.completedAt).not.toBeNull();
    });
  });

  describe("buildCommand", () => {
    it("builds claude command", () => {
      const task = makeTask({ agent: "claude", model: "claude-sonnet-4-6", prompt: "Add OAuth" });
      const cmd = scheduler.buildCommand(task);
      expect(cmd).toContain("claude");
      expect(cmd).toContain("Add OAuth");
      expect(cmd).toContain("claude-sonnet-4-6");
    });

    it("builds codex command", () => {
      const task = makeTask({ agent: "codex", prompt: "Add OAuth" });
      const cmd = scheduler.buildCommand(task);
      expect(cmd).toContain("codex");
      expect(cmd).toContain("Add OAuth");
    });

    it("throws for unknown agent", () => {
      const task = makeTask();
      (task as Record<string, unknown>).agent = "unknown";
      expect(() => scheduler.buildCommand(task)).toThrow("Unknown agent");
    });
  });
});
