import { useEffect, useRef, useState } from "react";
import { getGateway, resetGateway } from "../lib/gateway-rpc.ts";
import { useWorkersStore } from "./workers.ts";
import { useTasksStore } from "./tasks.ts";
import { useSettingsStore } from "./settings.ts";
import type { ActivityEvent, Alert, BudgetSummary } from "../lib/types.ts";
import { create } from "zustand";

const MAX_TERMINAL_LINES = 500;

interface ConnectionStore {
  connected: boolean;
  activities: ActivityEvent[];
  alerts: Alert[];
  budget: BudgetSummary | null;
  terminalOutput: Record<string, string[]>;
  setConnected: (v: boolean) => void;
  addActivity: (e: ActivityEvent) => void;
  addAlert: (a: Alert) => void;
  dismissAlert: (id: string) => void;
  setBudget: (budget: BudgetSummary) => void;
  appendTerminalData: (workerId: string, data: string) => void;
  clearTerminal: (workerId: string) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connected: false,
  activities: [],
  alerts: [],
  budget: null,
  terminalOutput: {},
  setConnected: (connected) => set({ connected }),
  addActivity: (e) =>
    set((state) => ({
      activities: [e, ...state.activities].slice(0, 100),
    })),
  addAlert: (a) =>
    set((state) => ({
      alerts: [a, ...state.alerts].slice(0, 20),
    })),
  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),
  setBudget: (budget) => set({ budget }),
  appendTerminalData: (workerId, data) =>
    set((state) => {
      const existing = state.terminalOutput[workerId] ?? [];
      // Split incoming data by newlines and append
      const newLines = data.split("\n");
      const combined = [...existing, ...newLines].slice(-MAX_TERMINAL_LINES);
      return {
        terminalOutput: { ...state.terminalOutput, [workerId]: combined },
      };
    }),
  clearTerminal: (workerId) =>
    set((state) => ({
      terminalOutput: { ...state.terminalOutput, [workerId]: [] },
    })),
}));

export function useWebSocket() {
  const { settings } = useSettingsStore();
  const { updateWorkerStatus, setWorkers } = useWorkersStore();
  const { updateTask, setTasks } = useTasksStore();
  const { setConnected, addActivity, addAlert, setBudget, appendTerminalData } =
    useConnectionStore();
  const gatewayRef = useRef(getGateway(settings.gatewayUrl));
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const gateway = gatewayRef.current;

    const unsubMessage = gateway.onMessage((msg) => {
      switch (msg.type) {
        case "connected":
          break;

        case "workers.init":
        case "workers.list":
          setWorkers(msg.workers);
          break;

        case "worker.status":
          updateWorkerStatus(
            msg.workerId,
            msg.status,
            msg.task,
            msg.cost,
            msg.tokensIn,
            msg.tokensOut
          );
          break;

        case "tasks.list":
          setTasks(msg.tasks);
          break;

        case "task.updated":
          updateTask(msg.task.id, msg.task);
          break;

        case "budget.updated":
          setBudget(msg.budget);
          break;

        case "terminal.data":
          appendTerminalData(msg.workerId, msg.data);
          break;

        case "activity":
          addActivity(msg.event);
          break;

        case "alert":
          addAlert(msg.alert);
          break;

        default:
          break;
      }
    });

    const unsubConnection = gateway.onConnection((connected) => {
      setIsConnected(connected);
      setConnected(connected);
    });

    gateway.connect();

    return () => {
      unsubMessage();
      unsubConnection();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect when URL changes
  useEffect(() => {
    const gateway = resetGateway(settings.gatewayUrl);
    gatewayRef.current = gateway;
    gateway.connect();
  }, [settings.gatewayUrl]);

  return { isConnected, gateway: gatewayRef.current };
}
