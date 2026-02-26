import { z } from "zod";

// ---------------------------------------------------------------------------
// Sub-task within a plan
// ---------------------------------------------------------------------------

export const SubTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  /** Estimated duration in minutes */
  estimatedMinutes: z.number().positive(),
  /** IDs of tasks that must complete before this one starts */
  dependsOn: z.array(z.string()).default([]),
  /** Which agent/model to use — defaults to planner's model */
  model: z.string().optional(),
  /** Rough cost estimate in USD */
  estimatedCost: z.number().nonnegative().default(0),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});

export type SubTask = z.infer<typeof SubTaskSchema>;

// ---------------------------------------------------------------------------
// A full decomposed plan containing multiple sub-tasks
// ---------------------------------------------------------------------------

export const TaskPlanSchema = z.object({
  id: z.string().min(1),
  goal: z.string().min(1),
  repoPath: z.string(),
  tasks: z.array(SubTaskSchema).min(1),
  /** Total estimated cost in USD */
  totalEstimatedCost: z.number().nonnegative(),
  /** Total estimated minutes (critical path, not sum) */
  totalEstimatedMinutes: z.number().positive(),
  createdAt: z.number(),
});

export type TaskPlan = z.infer<typeof TaskPlanSchema>;

// ---------------------------------------------------------------------------
// Swarm goal (user input)
// ---------------------------------------------------------------------------

export const SwarmGoalSchema = z.object({
  goal: z.string().min(1),
  repoPath: z.string().min(1),
  model: z.string().default("claude-opus-4-6"),
  maxWorkers: z.number().int().positive().default(6),
  budgetLimit: z.number().positive().default(20),
});

export type SwarmGoal = z.infer<typeof SwarmGoalSchema>;

// ---------------------------------------------------------------------------
// Decomposition result from the AI planner
// ---------------------------------------------------------------------------

export const DecompositionResultSchema = z.object({
  tasks: z.array(SubTaskSchema),
  reasoning: z.string().optional(),
  warnings: z.array(z.string()).default([]),
});

export type DecompositionResult = z.infer<typeof DecompositionResultSchema>;

// ---------------------------------------------------------------------------
// Execution timeline (schedule of tasks across workers)
// ---------------------------------------------------------------------------

export const TimelineEntrySchema = z.object({
  workerId: z.string(),
  taskId: z.string(),
  /** Minutes from swarm start */
  startMin: z.number().nonnegative(),
  /** Minutes from swarm start */
  endMin: z.number().positive(),
});

export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const ExecutionTimelineSchema = z.object({
  entries: z.array(TimelineEntrySchema),
  /** Total makespan in minutes (when last task finishes) */
  makespanMinutes: z.number().nonnegative(),
  /** Number of workers actually used */
  workersUsed: z.number().int().nonnegative(),
});

export type ExecutionTimeline = z.infer<typeof ExecutionTimelineSchema>;

// ---------------------------------------------------------------------------
// Codebase analysis summary (used as context for the planner)
// ---------------------------------------------------------------------------

export interface CodebaseAnalysis {
  /** Detected primary language/framework */
  language: string;
  /** Top-level directory names */
  topLevelDirs: string[];
  /** All file paths relative to repoPath (sampled) */
  files: string[];
  /** Contents of package.json if found */
  packageJson: Record<string, unknown> | null;
  /** Brief description of key source files */
  keyFiles: Array<{ path: string; size: number }>;
}

// ---------------------------------------------------------------------------
// Swarm session status
// ---------------------------------------------------------------------------

export type SwarmStatus =
  | "idle"
  | "analyzing"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "failed";

export interface SwarmSessionState {
  id: string;
  goal: SwarmGoal;
  status: SwarmStatus;
  analysis: CodebaseAnalysis | null;
  plan: TaskPlan | null;
  timeline: ExecutionTimeline | null;
  completedTaskIds: string[];
  failedTaskIds: string[];
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}
