import { create } from "zustand";
import type { WorkerState, WorkerStatus, Task } from "../lib/types.ts";

const WORKER_IDS = [
  "worker-1",
  "worker-2",
  "worker-3",
  "worker-4",
  "worker-5",
  "worker-6",
];

function makeDefaultWorker(id: string): WorkerState {
  return {
    id,
    status: "idle",
    currentTask: null,
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
    startedAt: null,
    workspace: `~/swarm-workspaces/${id}`,
    model: "claude-sonnet-4-6",
    sessionKey: null,
  };
}

// Demo data for development
const demoWorkers: WorkerState[] = [
  {
    id: "worker-1",
    status: "coding",
    currentTask: {
      id: "task-001",
      title: "Implement OAuth provider",
      prompt: "Implement Google OAuth provider for login",
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
    cost: 1.2,
    tokensIn: 42000,
    tokensOut: 8000,
    startedAt: Date.now() - 720000,
    workspace: "~/swarm-workspaces/worker-1",
    model: "claude-sonnet-4-6",
    sessionKey: "agent:worker-1:swarm:task-001",
  },
  {
    id: "worker-2",
    status: "planning",
    currentTask: {
      id: "task-002",
      title: "Add SAML authentication",
      prompt: "Add SAML authentication support",
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
    cost: 0.8,
    tokensIn: 28000,
    tokensOut: 5000,
    startedAt: Date.now() - 480000,
    workspace: "~/swarm-workspaces/worker-2",
    model: "claude-sonnet-4-6",
    sessionKey: "agent:worker-2:swarm:task-002",
  },
  {
    id: "worker-3",
    status: "idle",
    currentTask: null,
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
    startedAt: null,
    workspace: "~/swarm-workspaces/worker-3",
    model: "claude-sonnet-4-6",
    sessionKey: null,
  },
  {
    id: "worker-4",
    status: "pr",
    currentTask: {
      id: "task-005",
      title: "Fix README typo",
      prompt: "Fix typo in README",
      repo: "docs",
      branch: "swarm/task-005-readme",
      priority: "low",
      model: "claude-sonnet-4-6",
      agent: "claude",
      budgetLimit: 1,
      dependsOn: [],
      status: "pr",
      assignedWorker: "worker-4",
      sessionKey: "agent:worker-4:swarm:task-005",
      autoPR: true,
      createdAt: Date.now() - 120000,
      startedAt: Date.now() - 120000,
      completedAt: Date.now() - 30000,
      cost: 0.15,
      tokensIn: 5000,
      tokensOut: 1000,
      prUrl: "https://github.com/org/docs/pull/142",
      errorMessage: null,
    },
    cost: 0.15,
    tokensIn: 5000,
    tokensOut: 1000,
    startedAt: Date.now() - 120000,
    workspace: "~/swarm-workspaces/worker-4",
    model: "claude-sonnet-4-6",
    sessionKey: "agent:worker-4:swarm:task-005",
  },
  {
    id: "worker-5",
    status: "error",
    currentTask: {
      id: "task-007",
      title: "Update CI pipeline",
      prompt: "Update CI pipeline configuration",
      repo: "infra",
      branch: "swarm/task-007-ci",
      priority: "medium",
      model: "claude-sonnet-4-6",
      agent: "claude",
      budgetLimit: 3,
      dependsOn: [],
      status: "failed",
      assignedWorker: "worker-5",
      sessionKey: "agent:worker-5:swarm:task-007",
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
    cost: 1.8,
    tokensIn: 62000,
    tokensOut: 12000,
    startedAt: Date.now() - 900000,
    workspace: "~/swarm-workspaces/worker-5",
    model: "claude-sonnet-4-6",
    sessionKey: "agent:worker-5:swarm:task-007",
  },
  {
    id: "worker-6",
    status: "idle",
    currentTask: null,
    cost: 0,
    tokensIn: 0,
    tokensOut: 0,
    startedAt: null,
    workspace: "~/swarm-workspaces/worker-6",
    model: "claude-sonnet-4-6",
    sessionKey: null,
  },
];

interface WorkersStore {
  workers: WorkerState[];
  setWorkers: (workers: WorkerState[]) => void;
  updateWorker: (id: string, updates: Partial<WorkerState>) => void;
  updateWorkerStatus: (
    id: string,
    status: WorkerStatus,
    task: Task | null,
    cost: number,
    tokensIn: number,
    tokensOut: number
  ) => void;
  getWorker: (id: string) => WorkerState | undefined;
  getIdleWorkers: () => WorkerState[];
  initDefaults: (count: number) => void;
}

export const useWorkersStore = create<WorkersStore>((set, get) => ({
  workers: demoWorkers,

  setWorkers: (workers) => set({ workers }),

  updateWorker: (id, updates) =>
    set((state) => ({
      workers: state.workers.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    })),

  updateWorkerStatus: (id, status, task, cost, tokensIn, tokensOut) =>
    set((state) => ({
      workers: state.workers.map((w) =>
        w.id === id
          ? { ...w, status, currentTask: task, cost, tokensIn, tokensOut }
          : w
      ),
    })),

  getWorker: (id) => get().workers.find((w) => w.id === id),

  getIdleWorkers: () => get().workers.filter((w) => w.status === "idle"),

  initDefaults: (count) => {
    const workers = WORKER_IDS.slice(0, count).map(makeDefaultWorker);
    set({ workers });
  },
}));
