import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PawralDatabase } from "./database.js";
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

describe("PawralDatabase", () => {
  let db: PawralDatabase;

  beforeEach(() => {
    db = new PawralDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("tasks", () => {
    it("creates and retrieves a task", () => {
      const task = makeTask();
      db.createTask(task);
      const retrieved = db.getTask("task-001");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe("Test Task");
      expect(retrieved?.dependsOn).toEqual([]);
    });

    it("returns null for non-existent task", () => {
      expect(db.getTask("nonexistent")).toBeNull();
    });

    it("lists all tasks", () => {
      db.createTask(makeTask({ id: "task-001" }));
      db.createTask(makeTask({ id: "task-002", title: "Another Task" }));
      const tasks = db.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it("lists tasks filtered by status", () => {
      db.createTask(makeTask({ id: "task-001", status: "queued" }));
      db.createTask(makeTask({ id: "task-002", status: "running" }));
      const queued = db.listTasks("queued");
      expect(queued).toHaveLength(1);
      expect(queued[0]!.id).toBe("task-001");
    });

    it("updates a task", () => {
      db.createTask(makeTask());
      const updated = db.updateTask("task-001", { status: "running", assignedWorker: "worker-1" });
      expect(updated?.status).toBe("running");
      expect(updated?.assignedWorker).toBe("worker-1");

      const retrieved = db.getTask("task-001");
      expect(retrieved?.status).toBe("running");
    });

    it("returns null when updating non-existent task", () => {
      expect(db.updateTask("nonexistent", { status: "running" })).toBeNull();
    });

    it("deletes a task", () => {
      db.createTask(makeTask());
      expect(db.deleteTask("task-001")).toBe(true);
      expect(db.getTask("task-001")).toBeNull();
    });

    it("returns false when deleting non-existent task", () => {
      expect(db.deleteTask("nonexistent")).toBe(false);
    });

    it("persists JSON array for dependsOn", () => {
      db.createTask(makeTask({ dependsOn: ["dep-1", "dep-2"] }));
      const task = db.getTask("task-001");
      expect(task?.dependsOn).toEqual(["dep-1", "dep-2"]);
    });

    describe("getNextQueuedTask", () => {
      it("returns null when queue is empty", () => {
        expect(db.getNextQueuedTask()).toBeNull();
      });

      it("returns the highest priority queued task", () => {
        db.createTask(makeTask({ id: "t1", priority: "low", createdAt: 1000 }));
        db.createTask(makeTask({ id: "t2", priority: "high", createdAt: 2000 }));
        db.createTask(makeTask({ id: "t3", priority: "medium", createdAt: 1500 }));
        const next = db.getNextQueuedTask();
        expect(next?.id).toBe("t2");
      });

      it("respects dependencies — skips task with unfinished deps", () => {
        db.createTask(makeTask({ id: "dep-1", status: "running" }));
        db.createTask(makeTask({ id: "task-2", dependsOn: ["dep-1"] }));
        expect(db.getNextQueuedTask()).toBeNull();
      });

      it("allows task when all deps are done", () => {
        db.createTask(makeTask({ id: "dep-1", status: "done" }));
        db.createTask(makeTask({ id: "task-2", dependsOn: ["dep-1"] }));
        const next = db.getNextQueuedTask();
        expect(next?.id).toBe("task-2");
      });

      it("prefers FIFO for same priority", () => {
        const now = Date.now();
        db.createTask(makeTask({ id: "t1", createdAt: now + 100 }));
        db.createTask(makeTask({ id: "t2", createdAt: now }));
        const next = db.getNextQueuedTask();
        expect(next?.id).toBe("t2");
      });
    });
  });

  describe("budget_log", () => {
    it("records and retrieves budget entries", () => {
      const entry = db.recordBudget({
        workerId: "worker-1",
        taskId: "task-001",
        cost: 1.5,
        tokensIn: 1000,
        tokensOut: 500,
        model: "claude-sonnet-4-6",
        recordedAt: Date.now(),
      });
      expect(entry.id).toBeGreaterThan(0);
      expect(entry.cost).toBe(1.5);
    });

    it("calculates today total", () => {
      const now = Date.now();
      db.recordBudget({ workerId: "w1", taskId: null, cost: 1.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "w2", taskId: null, cost: 2.5, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      // Old entry from yesterday
      db.recordBudget({ workerId: "w1", taskId: null, cost: 10.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now - 86400001 });
      expect(db.getTodayBudgetTotal()).toBeCloseTo(3.5, 5);
    });

    it("calculates worker total", () => {
      const now = Date.now();
      db.recordBudget({ workerId: "worker-1", taskId: null, cost: 2.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "worker-1", taskId: null, cost: 1.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "worker-2", taskId: null, cost: 5.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      expect(db.getWorkerBudgetTotal("worker-1")).toBeCloseTo(3.0, 5);
    });

    it("returns 0 for worker with no entries", () => {
      expect(db.getWorkerBudgetTotal("nonexistent")).toBe(0);
    });

    it("lists budget log", () => {
      const now = Date.now();
      db.recordBudget({ workerId: "w1", taskId: null, cost: 1.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "w2", taskId: null, cost: 2.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      expect(db.listBudgetLog()).toHaveLength(2);
    });
  });

  describe("settings", () => {
    it("has default settings", () => {
      expect(db.getSetting("worker_count")).toBe("6");
      expect(db.getSetting("daily_budget")).toBe("50");
    });

    it("sets and gets a setting", () => {
      db.setSetting("worker_count", "4");
      expect(db.getSetting("worker_count")).toBe("4");
    });

    it("returns null for missing setting", () => {
      expect(db.getSetting("nonexistent_key")).toBeNull();
    });

    it("gets all settings as Settings object", () => {
      const settings = db.getSettings();
      expect(settings.workerCount).toBe(6);
      expect(settings.dailyBudget).toBe(50);
      expect(settings.autoPr).toBe(true);
    });

    it("updates settings", () => {
      db.updateSettings({ workerCount: 4, dailyBudget: 100 });
      const settings = db.getSettings();
      expect(settings.workerCount).toBe(4);
      expect(settings.dailyBudget).toBe(100);
    });
  });
});
