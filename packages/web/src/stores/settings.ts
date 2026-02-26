import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../lib/types.ts";

const defaults: Settings = {
  gatewayUrl: "ws://localhost:3002",
  authToken: "",
  workerCount: 6,
  workspaceBase: "~/swarm-workspaces",
  dailyBudget: 50,
  weeklyBudget: 200,
  monthlyBudget: 500,
  defaultModel: "claude-sonnet-4-6",
  defaultAgent: "claude",
  autoSandbox: true,
  enableOrchestrator: false,
  autoPR: true,
};

interface SettingsStore {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaults,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      resetSettings: () => set({ settings: defaults }),
    }),
    {
      name: "pawral-settings",
    }
  )
);
