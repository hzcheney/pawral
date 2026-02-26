// Shared types matching server protocol

export type WorkerStatus = "idle" | "planning" | "coding" | "testing" | "pr" | "error";

export type WorkerPhase = "idle" | "planning" | "coding" | "testing" | "pr" | "error" | "running";

export interface WorkerState {
  id: string; // "worker-1" ~ "worker-6"
  status: WorkerStatus;
  currentTask: Task | null;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  startedAt: number | null;
  workspace: string;
  model: string;
  sessionKey: string | null;
}

export type TaskStatus = "queued" | "assigned" | "running" | "pr" | "done" | "failed";
export type TaskPriority = "high" | "medium" | "low";
export type AgentType = "claude" | "codex";

export interface Task {
  id: string;
  title: string;
  prompt: string;
  repo: string;
  branch: string;
  priority: TaskPriority;
  model: string;
  agent: AgentType;
  budgetLimit: number;
  dependsOn: string[];
  status: TaskStatus;
  assignedWorker: string | null;
  sessionKey: string | null;
  autoPR: boolean;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  prUrl: string | null;
  errorMessage: string | null;
}

export interface NewTask {
  title: string;
  prompt: string;
  repo: string;
  branch: string;
  priority: TaskPriority;
  model: string;
  agent: AgentType;
  budgetLimit: number;
  dependsOn: string[];
  autoPR: boolean;
  assignedWorker?: string;
}

export interface BudgetSummary {
  todaySpent: number;
  todayLimit: number;
  weekSpent: number;
  weekLimit: number;
  monthSpent: number;
  monthLimit: number;
  perWorker: Record<string, number>;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  workerId: string;
  type: "task_started" | "task_completed" | "pr_created" | "error" | "info";
  message: string;
}

export interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  workerId?: string;
  taskId?: string;
  timestamp: number;
}

export interface Settings {
  gatewayUrl: string;
  authToken: string;
  workerCount: number;
  workspaceBase: string;
  dailyBudget: number;
  weeklyBudget: number;
  monthlyBudget: number;
  defaultModel: string;
  defaultAgent: AgentType;
  autoSandbox: boolean;
  enableOrchestrator: boolean;
  autoPR: boolean;
}

// Server init worker info (lighter than full WorkerState)
export interface WorkerInfo {
  id: string;
  workspace: string;
  status: string;
  currentTaskId: string | null;
  startedAt: number | null;
}

// WebSocket protocol messages
export type ServerMessage =
  | { type: "terminal.data"; workerId: string; data: string }
  | { type: "worker.status"; workerId: string; status: string; phase: string }
  | { type: "task.updated"; task: Task }
  | { type: "budget.updated"; budget: BudgetSummary }
  | { type: "activity"; event: ActivityEvent }
  | { type: "alert"; alert: Alert }
  | { type: "init"; workers: WorkerInfo[]; tasks: Task[] }
  | { type: "workers.init"; workers: WorkerState[] }
  | { type: "workers.list"; workers: WorkerState[] }
  | { type: "tasks.list"; tasks: Task[] }
  | { type: "connected"; sessionId: string };

export type ClientMessage =
  | { type: "terminal.input"; workerId: string; data: string }
  | { type: "terminal.resize"; workerId: string; cols: number; rows: number }
  | { type: "task.create"; task: NewTask }
  | { type: "task.assign"; taskId: string; workerId: string }
  | { type: "task.cancel"; taskId: string }
  | { type: "task.retry"; taskId: string }
  | { type: "worker.kill"; workerId: string }
  | { type: "settings.update"; settings: Partial<Settings> }
  | { type: "subscribe"; channels: string[] };

// Swarm mode types
export interface SwarmTask {
  id: string;
  title: string;
  description: string;
  complexity: "simple" | "medium" | "complex";
  model: string;
  dependsOn: string[];
  estimatedCost: number;
  estimatedMinutes: number;
}

export interface SwarmPlan {
  goal: string;
  repo: string;
  tasks: SwarmTask[];
  estimatedTotalCost: number;
  estimatedTotalMinutes: number;
  suggestedWorkers: number;
}

// PR types
export type PRStatus = "open" | "merged" | "conflict" | "failed";

export interface PullRequest {
  id: string;
  title: string;
  url: string;
  repo: string;
  branch: string;
  baseBranch: string;
  status: PRStatus;
  workerId: string;
  taskId: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  testsPassing: boolean | null;
  createdAt: number;
  mergedAt: number | null;
  labels: string[];
}

export type NavPage =
  | "dashboard"
  | "tasks"
  | "budget"
  | "prs"
  | "swarm"
  | "settings";
