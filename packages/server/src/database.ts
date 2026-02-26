import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { type Task, type BudgetEntry, type Settings } from "./types.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  agent TEXT NOT NULL DEFAULT 'claude',
  budget_limit REAL DEFAULT 3.0,
  depends_on TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued',
  assigned_worker TEXT,
  pr_url TEXT,
  cost REAL DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS budget_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id TEXT NOT NULL,
  task_id TEXT,
  cost REAL NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const DEFAULT_SETTINGS: Array<[string, string]> = [
  ["worker_count", "6"],
  ["workspace_base", "~/swarm-workspaces"],
  ["daily_budget", "50"],
  ["weekly_budget", "200"],
  ["default_model", "claude-sonnet-4-6"],
  ["default_agent", "claude"],
  ["auto_pr", "true"],
];

// ─── Row types ────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  prompt: string;
  repo: string;
  branch: string;
  priority: string;
  model: string;
  agent: string;
  budget_limit: number;
  depends_on: string;
  status: string;
  assigned_worker: string | null;
  pr_url: string | null;
  cost: number;
  tokens_in: number;
  tokens_out: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
}

interface BudgetRow {
  id: number;
  worker_id: string;
  task_id: string | null;
  cost: number;
  tokens_in: number | null;
  tokens_out: number | null;
  model: string | null;
  recorded_at: number;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    repo: row.repo,
    branch: row.branch,
    priority: row.priority as Task["priority"],
    model: row.model,
    agent: row.agent as Task["agent"],
    budgetLimit: row.budget_limit,
    dependsOn: JSON.parse(row.depends_on) as string[],
    status: row.status as Task["status"],
    assignedWorker: row.assigned_worker,
    prUrl: row.pr_url,
    cost: row.cost,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  };
}

function rowToBudgetEntry(row: BudgetRow): BudgetEntry {
  return {
    id: row.id,
    workerId: row.worker_id,
    taskId: row.task_id,
    cost: row.cost,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    model: row.model,
    recordedAt: row.recorded_at,
  };
}

// ─── PawralDatabase ───────────────────────────────────────────────────────────

export class PawralDatabase {
  readonly db: DB;

  constructor(dbPath = ":memory:") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(SCHEMA);
    // Seed default settings
    const insertSetting = this.db.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
    );
    for (const [key, value] of DEFAULT_SETTINGS) {
      insertSetting.run(key, value);
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  createTask(task: Task): Task {
    this.db
      .prepare(
        `INSERT INTO tasks (
          id, title, prompt, repo, branch, priority, model, agent,
          budget_limit, depends_on, status, assigned_worker, pr_url,
          cost, tokens_in, tokens_out, created_at, started_at,
          completed_at, error_message
        ) VALUES (
          @id, @title, @prompt, @repo, @branch, @priority, @model, @agent,
          @budget_limit, @depends_on, @status, @assigned_worker, @pr_url,
          @cost, @tokens_in, @tokens_out, @created_at, @started_at,
          @completed_at, @error_message
        )`
      )
      .run({
        id: task.id,
        title: task.title,
        prompt: task.prompt,
        repo: task.repo,
        branch: task.branch,
        priority: task.priority,
        model: task.model,
        agent: task.agent,
        budget_limit: task.budgetLimit,
        depends_on: JSON.stringify(task.dependsOn),
        status: task.status,
        assigned_worker: task.assignedWorker,
        pr_url: task.prUrl,
        cost: task.cost,
        tokens_in: task.tokensIn,
        tokens_out: task.tokensOut,
        created_at: task.createdAt,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        error_message: task.errorMessage,
      });
    return task;
  }

  getTask(id: string): Task | null {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(id) as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  }

  listTasks(status?: Task["status"]): Task[] {
    let rows: TaskRow[];
    if (status) {
      rows = this.db
        .prepare("SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC")
        .all(status) as TaskRow[];
    } else {
      rows = this.db
        .prepare("SELECT * FROM tasks ORDER BY created_at ASC")
        .all() as TaskRow[];
    }
    return rows.map(rowToTask);
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const existing = this.getTask(id);
    if (!existing) return null;

    const merged = { ...existing, ...updates };
    this.db
      .prepare(
        `UPDATE tasks SET
          title = @title, prompt = @prompt, repo = @repo, branch = @branch,
          priority = @priority, model = @model, agent = @agent,
          budget_limit = @budget_limit, depends_on = @depends_on,
          status = @status, assigned_worker = @assigned_worker,
          pr_url = @pr_url, cost = @cost, tokens_in = @tokens_in,
          tokens_out = @tokens_out, started_at = @started_at,
          completed_at = @completed_at, error_message = @error_message
        WHERE id = @id`
      )
      .run({
        id: merged.id,
        title: merged.title,
        prompt: merged.prompt,
        repo: merged.repo,
        branch: merged.branch,
        priority: merged.priority,
        model: merged.model,
        agent: merged.agent,
        budget_limit: merged.budgetLimit,
        depends_on: JSON.stringify(merged.dependsOn),
        status: merged.status,
        assigned_worker: merged.assignedWorker,
        pr_url: merged.prUrl,
        cost: merged.cost,
        tokens_in: merged.tokensIn,
        tokens_out: merged.tokensOut,
        started_at: merged.startedAt,
        completed_at: merged.completedAt,
        error_message: merged.errorMessage,
      });
    return merged;
  }

  deleteTask(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM tasks WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  getNextQueuedTask(): Task | null {
    const row = this.db
      .prepare(
        `SELECT * FROM tasks
        WHERE status = 'queued'
        AND NOT EXISTS (
          SELECT 1 FROM tasks AS dep
          WHERE dep.id IN (SELECT value FROM json_each(tasks.depends_on))
          AND dep.status != 'done'
        )
        ORDER BY
          CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
          created_at ASC
        LIMIT 1`
      )
      .get() as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  }

  // ── Budget Log ─────────────────────────────────────────────────────────────

  recordBudget(entry: Omit<BudgetEntry, "id">): BudgetEntry {
    const result = this.db
      .prepare(
        `INSERT INTO budget_log (worker_id, task_id, cost, tokens_in, tokens_out, model, recorded_at)
        VALUES (@worker_id, @task_id, @cost, @tokens_in, @tokens_out, @model, @recorded_at)`
      )
      .run({
        worker_id: entry.workerId,
        task_id: entry.taskId,
        cost: entry.cost,
        tokens_in: entry.tokensIn,
        tokens_out: entry.tokensOut,
        model: entry.model,
        recorded_at: entry.recordedAt,
      });
    return { ...entry, id: Number(result.lastInsertRowid) };
  }

  getTodayBudgetTotal(): number {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const result = this.db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM budget_log WHERE recorded_at >= ?"
      )
      .get(startOfDay.getTime()) as { total: number };
    return result.total;
  }

  getWeeklyBudgetTotal(): number {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const result = this.db
      .prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM budget_log WHERE recorded_at >= ?"
      )
      .get(startOfWeek.getTime()) as { total: number };
    return result.total;
  }

  getWorkerBudgetTotal(workerId: string, sinceMs?: number): number {
    let result: { total: number };
    if (sinceMs !== undefined) {
      result = this.db
        .prepare(
          "SELECT COALESCE(SUM(cost), 0) as total FROM budget_log WHERE worker_id = ? AND recorded_at >= ?"
        )
        .get(workerId, sinceMs) as { total: number };
    } else {
      result = this.db
        .prepare(
          "SELECT COALESCE(SUM(cost), 0) as total FROM budget_log WHERE worker_id = ?"
        )
        .get(workerId) as { total: number };
    }
    return result.total;
  }

  listBudgetLog(limit = 100): BudgetEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM budget_log ORDER BY recorded_at DESC LIMIT ?")
      .all(limit) as BudgetRow[];
    return rows.map(rowToBudgetEntry);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  getSetting(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run(key, value);
  }

  getAllSettings(): Record<string, string> {
    const rows = this.db
      .prepare("SELECT key, value FROM settings")
      .all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  getSettings(): Settings {
    const raw = this.getAllSettings();
    return {
      workerCount: parseInt(raw["worker_count"] ?? "6", 10),
      workspaceBase: raw["workspace_base"] ?? "~/swarm-workspaces",
      dailyBudget: parseFloat(raw["daily_budget"] ?? "50"),
      weeklyBudget: parseFloat(raw["weekly_budget"] ?? "200"),
      defaultModel: raw["default_model"] ?? "claude-sonnet-4-6",
      defaultAgent: (raw["default_agent"] ?? "claude") as Settings["defaultAgent"],
      autoPr: raw["auto_pr"] === "true",
    };
  }

  updateSettings(settings: Partial<Settings>): void {
    const keyMap: Record<keyof Settings, string> = {
      workerCount: "worker_count",
      workspaceBase: "workspace_base",
      dailyBudget: "daily_budget",
      weeklyBudget: "weekly_budget",
      defaultModel: "default_model",
      defaultAgent: "default_agent",
      autoPr: "auto_pr",
    };
    for (const [k, v] of Object.entries(settings)) {
      const dbKey = keyMap[k as keyof Settings];
      if (dbKey && v !== undefined) {
        this.setSetting(dbKey, String(v));
      }
    }
  }

  close(): void {
    this.db.close();
  }
}
