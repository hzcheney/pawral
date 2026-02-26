import { create } from "zustand";
import type { WorkerState, WorkerStatus, Task } from "../lib/types.ts";

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
}

export const useWorkersStore = create<WorkersStore>((set, get) => ({
  workers: [],

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
}));
