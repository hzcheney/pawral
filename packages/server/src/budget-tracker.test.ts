import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BudgetTracker } from "./budget-tracker.js";
import { PawralDatabase } from "./database.js";

describe("BudgetTracker", () => {
  let db: PawralDatabase;
  let tracker: BudgetTracker;

  beforeEach(() => {
    db = new PawralDatabase(":memory:");
    tracker = new BudgetTracker(db, { daily: 50, weekly: 200, perTask: 3 });
  });

  afterEach(() => {
    db.close();
  });

  describe("record", () => {
    it("records a budget entry", () => {
      const entry = tracker.record({
        workerId: "worker-1",
        taskId: "task-001",
        cost: 1.5,
        tokensIn: 1000,
        tokensOut: 500,
        model: "claude-sonnet-4-6",
        recordedAt: Date.now(),
      });
      expect(entry.id).toBeGreaterThan(0);
      expect(tracker.getTodayTotal()).toBeCloseTo(1.5, 5);
    });

    it("emits budget.warning at 80% of daily limit", () => {
      const warnSpy = vi.fn();
      tracker.on("budget.warning", warnSpy);

      // Record 80% of $50 = $40
      tracker.record({
        workerId: "worker-1",
        taskId: null,
        cost: 40,
        tokensIn: null,
        tokensOut: null,
        model: null,
        recordedAt: Date.now(),
      });

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toMatchObject({ level: "daily" });
    });

    it("emits budget.exceeded at 100% of daily limit", () => {
      const exceedSpy = vi.fn();
      tracker.on("budget.exceeded", exceedSpy);

      tracker.record({
        workerId: "worker-1",
        taskId: null,
        cost: 51,
        tokensIn: null,
        tokensOut: null,
        model: null,
        recordedAt: Date.now(),
      });

      expect(exceedSpy).toHaveBeenCalledOnce();
    });
  });

  describe("getTodayTotal", () => {
    it("returns 0 with no entries", () => {
      expect(tracker.getTodayTotal()).toBe(0);
    });

    it("sums entries for today only", () => {
      const now = Date.now();
      db.recordBudget({ workerId: "w1", taskId: null, cost: 5.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "w1", taskId: null, cost: 3.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now - 86400001 }); // yesterday
      expect(tracker.getTodayTotal()).toBeCloseTo(5.0, 5);
    });
  });

  describe("getWorkerTotal", () => {
    it("returns total for a specific worker", () => {
      const now = Date.now();
      db.recordBudget({ workerId: "worker-1", taskId: null, cost: 2.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "worker-1", taskId: null, cost: 1.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "worker-2", taskId: null, cost: 10.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      expect(tracker.getWorkerTotal("worker-1")).toBeCloseTo(3.0, 5);
    });

    it("supports sinceMs filter", () => {
      const now = Date.now();
      const cutoff = now - 3600000; // 1 hour ago
      db.recordBudget({ workerId: "w1", taskId: null, cost: 5.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "w1", taskId: null, cost: 3.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now - 7200000 }); // 2h ago
      expect(tracker.getWorkerTotal("w1", cutoff)).toBeCloseTo(5.0, 5);
    });
  });

  describe("isOverBudget", () => {
    it("returns not over budget when under limits", () => {
      const result = tracker.isOverBudget();
      expect(result.over).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it("detects daily budget exceeded", () => {
      db.recordBudget({ workerId: "w1", taskId: null, cost: 55, tokensIn: null, tokensOut: null, model: null, recordedAt: Date.now() });
      const result = tracker.isOverBudget();
      expect(result.over).toBe(true);
      expect(result.reasons.some((r) => r.includes("Daily"))).toBe(true);
    });
  });

  describe("getLimits / setLimits", () => {
    it("returns current limits", () => {
      const limits = tracker.getLimits();
      expect(limits.daily).toBe(50);
      expect(limits.weekly).toBe(200);
      expect(limits.perTask).toBe(3);
    });

    it("updates limits", () => {
      tracker.setLimits({ daily: 100, perTask: 5 });
      const limits = tracker.getLimits();
      expect(limits.daily).toBe(100);
      expect(limits.perTask).toBe(5);
      expect(limits.weekly).toBe(200); // unchanged
    });

    it("persists limits to database", () => {
      tracker.setLimits({ daily: 75 });
      const settings = db.getSettings();
      expect(settings.dailyBudget).toBe(75);
    });
  });

  describe("getSummary", () => {
    it("returns a full budget summary", () => {
      const now = Date.now();
      db.recordBudget({ workerId: "worker-1", taskId: null, cost: 5.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });
      db.recordBudget({ workerId: "worker-2", taskId: null, cost: 3.0, tokensIn: null, tokensOut: null, model: null, recordedAt: now });

      const summary = tracker.getSummary(["worker-1", "worker-2", "worker-3"]);
      expect(summary.todayTotal).toBeCloseTo(8.0, 5);
      expect(summary.workerTotals["worker-1"]).toBeCloseTo(5.0, 5);
      expect(summary.workerTotals["worker-2"]).toBeCloseTo(3.0, 5);
      expect(summary.workerTotals["worker-3"]).toBe(0);
      expect(summary.limits.daily).toBe(50);
    });
  });
});
