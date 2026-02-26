import { describe, it, expect } from "vitest";
import {
  TaskSchema,
  NewTaskSchema,
  BudgetEntrySchema,
  SettingsSchema,
  ServerMessageSchema,
  ClientMessageSchema,
  estimateCost,
} from "./types.js";

describe("types", () => {
  describe("TaskSchema", () => {
    it("parses a valid task", () => {
      const task = TaskSchema.parse({
        id: "task-001",
        title: "Implement OAuth",
        prompt: "Add OAuth support",
        repo: "https://github.com/org/repo",
        branch: "swarm/task-001-oauth",
        createdAt: Date.now(),
      });
      expect(task.priority).toBe("medium");
      expect(task.status).toBe("queued");
      expect(task.agent).toBe("claude");
      expect(task.cost).toBe(0);
      expect(task.dependsOn).toEqual([]);
      expect(task.assignedWorker).toBeNull();
    });

    it("rejects task without required fields", () => {
      expect(() => TaskSchema.parse({ id: "x" })).toThrow();
    });

    it("accepts custom priority and status", () => {
      const task = TaskSchema.parse({
        id: "task-002",
        title: "Fix bug",
        prompt: "Fix the login bug",
        repo: "https://github.com/org/repo",
        branch: "swarm/fix-bug",
        priority: "high",
        status: "running",
        createdAt: Date.now(),
      });
      expect(task.priority).toBe("high");
      expect(task.status).toBe("running");
    });
  });

  describe("NewTaskSchema", () => {
    it("parses a new task without runtime fields", () => {
      const newTask = NewTaskSchema.parse({
        title: "Implement OAuth",
        prompt: "Add OAuth support",
        repo: "https://github.com/org/repo",
        branch: "swarm/oauth",
      });
      expect(newTask.title).toBe("Implement OAuth");
    });
  });

  describe("BudgetEntrySchema", () => {
    it("parses a valid budget entry", () => {
      const entry = BudgetEntrySchema.parse({
        workerId: "worker-1",
        cost: 1.5,
        recordedAt: Date.now(),
      });
      expect(entry.workerId).toBe("worker-1");
      expect(entry.cost).toBe(1.5);
      expect(entry.taskId).toBeNull();
    });
  });

  describe("SettingsSchema", () => {
    it("applies defaults", () => {
      const settings = SettingsSchema.parse({});
      expect(settings.workerCount).toBe(6);
      expect(settings.dailyBudget).toBe(50);
      expect(settings.weeklyBudget).toBe(200);
      expect(settings.autoPr).toBe(true);
    });

    it("overrides defaults", () => {
      const settings = SettingsSchema.parse({ workerCount: 3, dailyBudget: 100 });
      expect(settings.workerCount).toBe(3);
      expect(settings.dailyBudget).toBe(100);
    });
  });

  describe("ServerMessageSchema", () => {
    it("parses terminal.data message", () => {
      const msg = ServerMessageSchema.parse({
        type: "terminal.data",
        workerId: "worker-1",
        data: "hello",
      });
      expect(msg.type).toBe("terminal.data");
    });

    it("parses task.updated message", () => {
      const msg = ServerMessageSchema.parse({
        type: "task.updated",
        task: {
          id: "task-001",
          title: "T",
          prompt: "P",
          repo: "R",
          branch: "B",
          createdAt: Date.now(),
        },
      });
      expect(msg.type).toBe("task.updated");
    });

    it("rejects unknown type", () => {
      expect(() =>
        ServerMessageSchema.parse({ type: "unknown", data: "x" })
      ).toThrow();
    });
  });

  describe("ClientMessageSchema", () => {
    it("parses terminal.input message", () => {
      const msg = ClientMessageSchema.parse({
        type: "terminal.input",
        workerId: "worker-1",
        data: "ls\n",
      });
      expect(msg.type).toBe("terminal.input");
    });

    it("parses task.create message", () => {
      const msg = ClientMessageSchema.parse({
        type: "task.create",
        task: {
          title: "Test",
          prompt: "Do something",
          repo: "https://github.com/org/repo",
          branch: "swarm/test",
        },
      });
      expect(msg.type).toBe("task.create");
    });
  });

  describe("estimateCost", () => {
    it("calculates cost for sonnet model", () => {
      const cost = estimateCost(100_000, 50_000, "claude-sonnet-4-6");
      // 100k input * $3/M + 50k output * $15/M
      expect(cost).toBeCloseTo(0.3 + 0.75, 4);
    });

    it("uses default costs for unknown model", () => {
      const cost = estimateCost(1_000_000, 0, "unknown-model");
      expect(cost).toBeCloseTo(3.0, 4);
    });

    it("returns 0 for 0 tokens", () => {
      expect(estimateCost(0, 0)).toBe(0);
    });
  });
});
