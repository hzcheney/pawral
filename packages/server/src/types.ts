import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TaskPrioritySchema = z.enum(["high", "medium", "low"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum([
  "queued",
  "assigned",
  "running",
  "pr",
  "done",
  "failed",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const AgentTypeSchema = z.enum(["claude", "codex"]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const WorkerStatusSchema = z.enum(["idle", "running", "error"]);
export type WorkerStatus = z.infer<typeof WorkerStatusSchema>;

export const WorkerPhaseSchema = z.enum([
  "idle",
  "planning",
  "coding",
  "testing",
  "pr",
  "running",
  "error",
]);
export type WorkerPhase = z.infer<typeof WorkerPhaseSchema>;

// ─── Task ─────────────────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  prompt: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().min(1),
  priority: TaskPrioritySchema.default("medium"),
  model: z.string().default("claude-sonnet-4-6"),
  agent: AgentTypeSchema.default("claude"),
  budgetLimit: z.number().positive().default(3.0),
  dependsOn: z.array(z.string()).default([]),
  status: TaskStatusSchema.default("queued"),
  assignedWorker: z.string().nullable().default(null),
  prUrl: z.string().nullable().default(null),
  cost: z.number().default(0),
  tokensIn: z.number().int().default(0),
  tokensOut: z.number().int().default(0),
  createdAt: z.number().int(),
  startedAt: z.number().int().nullable().default(null),
  completedAt: z.number().int().nullable().default(null),
  errorMessage: z.string().nullable().default(null),
});

export type Task = z.infer<typeof TaskSchema>;

export const NewTaskSchema = TaskSchema.omit({
  id: true,
  status: true,
  assignedWorker: true,
  prUrl: true,
  cost: true,
  tokensIn: true,
  tokensOut: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  errorMessage: true,
});

export type NewTask = z.infer<typeof NewTaskSchema>;

// ─── Worker ───────────────────────────────────────────────────────────────────

export const WorkerInfoSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  status: WorkerStatusSchema,
  currentTaskId: z.string().nullable(),
  startedAt: z.number().int().nullable(),
});

export type WorkerInfo = z.infer<typeof WorkerInfoSchema>;

// ─── Budget ───────────────────────────────────────────────────────────────────

export const BudgetEntrySchema = z.object({
  id: z.number().int().optional(),
  workerId: z.string(),
  taskId: z.string().nullable().default(null),
  cost: z.number(),
  tokensIn: z.number().int().nullable().default(null),
  tokensOut: z.number().int().nullable().default(null),
  model: z.string().nullable().default(null),
  recordedAt: z.number().int(),
});

export type BudgetEntry = z.infer<typeof BudgetEntrySchema>;

export const BudgetLimitsSchema = z.object({
  daily: z.number().positive(),
  weekly: z.number().positive(),
  perTask: z.number().positive(),
});

export type BudgetLimits = z.infer<typeof BudgetLimitsSchema>;

export const BudgetSummarySchema = z.object({
  todayTotal: z.number(),
  weeklyTotal: z.number(),
  workerTotals: z.record(z.string(), z.number()),
  limits: BudgetLimitsSchema,
});

export type BudgetSummary = z.infer<typeof BudgetSummarySchema>;

// ─── Settings ─────────────────────────────────────────────────────────────────

export const SettingsSchema = z.object({
  workerCount: z.number().int().positive().default(6),
  workspaceBase: z.string().default("~/swarm-workspaces"),
  dailyBudget: z.number().positive().default(50),
  weeklyBudget: z.number().positive().default(200),
  defaultModel: z.string().default("claude-sonnet-4-6"),
  defaultAgent: AgentTypeSchema.default("claude"),
  autoPr: z.boolean().default(true),
});

export type Settings = z.infer<typeof SettingsSchema>;

// ─── WebSocket Messages ───────────────────────────────────────────────────────

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("terminal.data"),
    workerId: z.string(),
    data: z.string(),
  }),
  z.object({
    type: z.literal("worker.status"),
    workerId: z.string(),
    status: WorkerStatusSchema,
    phase: WorkerPhaseSchema,
  }),
  z.object({
    type: z.literal("task.updated"),
    task: TaskSchema,
  }),
  z.object({
    type: z.literal("budget.updated"),
    budget: BudgetSummarySchema,
  }),
  z.object({
    type: z.literal("activity"),
    event: z.object({
      timestamp: z.number().int(),
      workerId: z.string().optional(),
      message: z.string(),
      level: z.enum(["info", "warn", "error"]),
    }),
  }),
  z.object({
    type: z.literal("alert"),
    alert: z.object({
      id: z.string(),
      workerId: z.string().optional(),
      message: z.string(),
      severity: z.enum(["warning", "error"]),
      timestamp: z.number().int(),
    }),
  }),
  z.object({
    type: z.literal("init"),
    workers: z.array(WorkerInfoSchema),
    tasks: z.array(TaskSchema),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("terminal.input"),
    workerId: z.string(),
    data: z.string(),
  }),
  z.object({
    type: z.literal("terminal.resize"),
    workerId: z.string(),
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("task.create"),
    task: NewTaskSchema,
  }),
  z.object({
    type: z.literal("task.assign"),
    taskId: z.string(),
    workerId: z.string(),
  }),
  z.object({
    type: z.literal("task.cancel"),
    taskId: z.string(),
  }),
  z.object({
    type: z.literal("worker.kill"),
    workerId: z.string(),
  }),
  z.object({
    type: z.literal("settings.update"),
    settings: SettingsSchema.partial(),
  }),
  z.object({
    type: z.literal("subscribe"),
    channels: z.array(z.string()),
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ─── Cost estimation ──────────────────────────────────────────────────────────

export const MODEL_COSTS: Record<string, { inputPerM: number; outputPerM: number }> = {
  "claude-sonnet-4-6": { inputPerM: 3.0, outputPerM: 15.0 },
  "claude-opus-4-6": { inputPerM: 15.0, outputPerM: 75.0 },
  "claude-haiku-4-5": { inputPerM: 0.8, outputPerM: 4.0 },
  default: { inputPerM: 3.0, outputPerM: 15.0 },
};

export function estimateCost(tokensIn: number, tokensOut: number, model = "default"): number {
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS["default"]!;
  return (tokensIn / 1_000_000) * costs.inputPerM + (tokensOut / 1_000_000) * costs.outputPerM;
}
