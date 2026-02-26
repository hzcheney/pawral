import { create } from "zustand";
import type { Task, NewTask, TaskStatus, TaskPriority } from "../lib/types.ts";

let taskCounter = 9;

function generateId(): string {
  return `task-${String(taskCounter++).padStart(3, "0")}`;
}

const demoTasks: Task[] = [
  {
    id: "task-001",
    title: "Implement OAuth provider",
    prompt: "Implement Google OAuth provider for login system",
    repo: "my-app",
    branch: "swarm/task-001-oauth",
    priority: "high",
    model: "claude-sonnet-4-6",
    agent: "claude",
    budgetLimit: 5,
    dependsOn: [],
    status: "running",
    assignedWorker: "worker-1",
    sessionKey: "agent:worker-1:swarm:task-001",
    autoPR: true,
    createdAt: Date.now() - 720000,
    startedAt: Date.now() - 720000,
    completedAt: null,
    cost: 1.2,
    tokensIn: 42000,
    tokensOut: 8000,
    prUrl: null,
    errorMessage: null,
  },
  {
    id: "task-002",
    title: "Add SAML authentication",
    prompt: "Add SAML authentication support to auth module",
    repo: "my-app",
    branch: "swarm/task-002-saml",
    priority: "high",
    model: "claude-sonnet-4-6",
    agent: "claude",
    budgetLimit: 5,
    dependsOn: [],
    status: "running",
    assignedWorker: "worker-2",
    sessionKey: "agent:worker-2:swarm:task-002",
    autoPR: true,
    createdAt: Date.now() - 480000,
    startedAt: Date.now() - 480000,
    completedAt: null,
    cost: 0.8,
    tokensIn: 28000,
    tokensOut: 5000,
    prUrl: null,
    errorMessage: null,
  },
  {
    id: "task-003",
    title: "Write integration tests for auth",
    prompt: "Write comprehensive integration tests for the auth module",
    repo: "my-app",
    branch: "swarm/task-003-tests",
    priority: "medium",
    model: "auto",
    agent: "claude",
    budgetLimit: 3,
    dependsOn: ["task-001", "task-002"],
    status: "queued",
    assignedWorker: null,
    sessionKey: null,
    autoPR: true,
    createdAt: Date.now() - 300000,
    startedAt: null,
    completedAt: null,
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
    prUrl: null,
    errorMessage: null,
  },
  {
    id: "task-004",
    title: "Refactor DB connection pool",
    prompt: "Refactor the database connection pool for better performance",
    repo: "backend-api",
    branch: "swarm/task-004-db",
    priority: "medium",
    model: "auto",
    agent: "claude",
    budgetLimit: 4,
    dependsOn: [],
    status: "queued",
    assignedWorker: null,
    sessionKey: null,
    autoPR: true,
    createdAt: Date.now() - 250000,
    startedAt: null,
    completedAt: null,
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
    prUrl: null,
    errorMessage: null,
  },
  {
    id: "task-005",
    title: "Fix README typo",
    prompt: "Fix typos in the README documentation",
    repo: "docs",
    branch: "swarm/task-005-readme",
    priority: "low",
    model: "claude-sonnet-4-6",
    agent: "claude",
    budgetLimit: 1,
    dependsOn: [],
    status: "done",
    assignedWorker: "worker-4",
    sessionKey: null,
    autoPR: true,
    createdAt: Date.now() - 200000,
    startedAt: Date.now() - 120000,
    completedAt: Date.now() - 30000,
    cost: 0.15,
    tokensIn: 5000,
    tokensOut: 1000,
    prUrl: "https://github.com/org/docs/pull/142",
    errorMessage: null,
  },
  {
    id: "task-006",
    title: "API rate limiting middleware",
    prompt: "Implement API rate limiting middleware using Redis",
    repo: "backend-api",
    branch: "swarm/task-006-ratelimit",
    priority: "high",
    model: "claude-opus-4-6",
    agent: "claude",
    budgetLimit: 8,
    dependsOn: [],
    status: "pr",
    assignedWorker: "worker-3",
    sessionKey: null,
    autoPR: true,
    createdAt: Date.now() - 1500000,
    startedAt: Date.now() - 1500000,
    completedAt: Date.now() - 60000,
    cost: 3.4,
    tokensIn: 120000,
    tokensOut: 25000,
    prUrl: "https://github.com/org/backend-api/pull/143",
    errorMessage: null,
  },
  {
    id: "task-007",
    title: "Update CI pipeline",
    prompt: "Update CI pipeline configuration for faster builds",
    repo: "infra",
    branch: "swarm/task-007-ci",
    priority: "medium",
    model: "claude-sonnet-4-6",
    agent: "claude",
    budgetLimit: 3,
    dependsOn: [],
    status: "failed",
    assignedWorker: "worker-5",
    sessionKey: null,
    autoPR: false,
    createdAt: Date.now() - 900000,
    startedAt: Date.now() - 900000,
    completedAt: null,
    cost: 1.8,
    tokensIn: 62000,
    tokensOut: 12000,
    prUrl: null,
    errorMessage: "Tests failed after 3 attempts",
  },
  {
    id: "task-008",
    title: "Add dark mode toggle",
    prompt: "Add dark mode toggle to the frontend settings page",
    repo: "frontend",
    branch: "swarm/task-008-darkmode",
    priority: "low",
    model: "auto",
    agent: "claude",
    budgetLimit: 2,
    dependsOn: [],
    status: "queued",
    assignedWorker: null,
    sessionKey: null,
    autoPR: true,
    createdAt: Date.now() - 100000,
    startedAt: null,
    completedAt: null,
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
    prUrl: null,
    errorMessage: null,
  },
];

interface TaskFilter {
  status?: TaskStatus | "all";
  repo?: string;
  priority?: TaskPriority | "all";
  search?: string;
}

interface TasksStore {
  tasks: Task[];
  filter: TaskFilter;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: NewTask) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setFilter: (filter: Partial<TaskFilter>) => void;
  getFilteredTasks: () => Task[];
  getTask: (id: string) => Task | undefined;
  getTasksByStatus: (status: TaskStatus) => Task[];
}

export const useTasksStore = create<TasksStore>((set, get) => ({
  tasks: demoTasks,
  filter: { status: "all", repo: "all", priority: "all", search: "" },

  setTasks: (tasks) => set({ tasks }),

  addTask: (newTask) => {
    const task: Task = {
      ...newTask,
      id: generateId(),
      status: "queued",
      assignedWorker: newTask.assignedWorker ?? null,
      sessionKey: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      cost: 0,
      tokensIn: 0,
      tokensOut: 0,
      prUrl: null,
      errorMessage: null,
    };
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  setFilter: (filter) =>
    set((state) => ({ filter: { ...state.filter, ...filter } })),

  getFilteredTasks: () => {
    const { tasks, filter } = get();
    return tasks.filter((t) => {
      if (filter.status && filter.status !== "all" && t.status !== filter.status)
        return false;
      if (filter.repo && filter.repo !== "all" && t.repo !== filter.repo)
        return false;
      if (
        filter.priority &&
        filter.priority !== "all" &&
        t.priority !== filter.priority
      )
        return false;
      if (
        filter.search &&
        !t.title.toLowerCase().includes(filter.search.toLowerCase()) &&
        !t.id.includes(filter.search)
      )
        return false;
      return true;
    });
  },

  getTask: (id) => get().tasks.find((t) => t.id === id),

  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),
}));
