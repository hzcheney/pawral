import { create } from "zustand";
import type { Task, NewTask, TaskStatus, TaskPriority } from "../lib/types.ts";

let taskCounter = 1;

function generateId(): string {
  return `task-${String(taskCounter++).padStart(3, "0")}`;
}

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
  tasks: [],
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
