import { EventEmitter } from "node:events";
import type { PawralDatabase } from "./database.js";
import type { BudgetEntry, BudgetLimits, BudgetSummary } from "./types.js";

// ─── BudgetTracker ────────────────────────────────────────────────────────────

export class BudgetTracker extends EventEmitter {
  private limits: BudgetLimits;

  constructor(
    private readonly db: PawralDatabase,
    limits?: Partial<BudgetLimits>
  ) {
    super();
    const settings = db.getSettings();
    this.limits = {
      daily: limits?.daily ?? settings.dailyBudget,
      weekly: limits?.weekly ?? settings.weeklyBudget,
      perTask: limits?.perTask ?? 3.0,
    };
  }

  /**
   * Record a cost event for a worker.
   */
  record(entry: Omit<BudgetEntry, "id">): BudgetEntry {
    const saved = this.db.recordBudget(entry);

    // Check budget thresholds and emit events
    const todayTotal = this.getTodayTotal();
    const pctDaily = todayTotal / this.limits.daily;

    if (pctDaily >= 1.0) {
      this.emit("budget.exceeded", { level: "daily", total: todayTotal, limit: this.limits.daily });
    } else if (pctDaily >= 0.8) {
      this.emit("budget.warning", { level: "daily", total: todayTotal, limit: this.limits.daily, pct: pctDaily });
    }

    return saved;
  }

  /**
   * Get total cost recorded today (since midnight).
   */
  getTodayTotal(): number {
    return this.db.getTodayBudgetTotal();
  }

  /**
   * Get total cost recorded this week.
   */
  getWeeklyTotal(): number {
    return this.db.getWeeklyBudgetTotal();
  }

  /**
   * Get total cost for a specific worker.
   */
  getWorkerTotal(workerId: string, sinceMs?: number): number {
    return this.db.getWorkerBudgetTotal(workerId, sinceMs);
  }

  /**
   * Check if any budget limit is exceeded.
   * Returns an object describing which limits (if any) are over.
   */
  isOverBudget(): { over: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const todayTotal = this.getTodayTotal();
    const weeklyTotal = this.getWeeklyTotal();

    if (todayTotal >= this.limits.daily) {
      reasons.push(`Daily budget exceeded: $${todayTotal.toFixed(2)} / $${this.limits.daily}`);
    }
    if (weeklyTotal >= this.limits.weekly) {
      reasons.push(`Weekly budget exceeded: $${weeklyTotal.toFixed(2)} / $${this.limits.weekly}`);
    }

    return { over: reasons.length > 0, reasons };
  }

  /**
   * Check if a specific worker has exceeded the per-task limit.
   */
  isWorkerOverBudget(workerId: string, taskBudgetLimit: number): boolean {
    // Get worker total for today as a proxy
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const workerToday = this.getWorkerTotal(workerId, startOfDay.getTime());
    return workerToday >= taskBudgetLimit;
  }

  /**
   * Get current budget limits.
   */
  getLimits(): BudgetLimits {
    return { ...this.limits };
  }

  /**
   * Update budget limits and persist to DB.
   */
  setLimits(limits: Partial<BudgetLimits>): void {
    if (limits.daily !== undefined) this.limits.daily = limits.daily;
    if (limits.weekly !== undefined) this.limits.weekly = limits.weekly;
    if (limits.perTask !== undefined) this.limits.perTask = limits.perTask;

    this.db.updateSettings({
      dailyBudget: this.limits.daily,
      weeklyBudget: this.limits.weekly,
    });
  }

  /**
   * Get a full budget summary for the dashboard.
   */
  getSummary(workerIds: string[]): BudgetSummary {
    const workerTotals: Record<string, number> = {};
    for (const id of workerIds) {
      workerTotals[id] = this.getWorkerTotal(id);
    }

    return {
      todayTotal: this.getTodayTotal(),
      weeklyTotal: this.getWeeklyTotal(),
      workerTotals,
      limits: this.getLimits(),
    };
  }
}
