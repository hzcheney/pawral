import { useEffect, useRef, useState } from "react";
import { getGateway, resetGateway } from "../lib/gateway-rpc.ts";
import { useWorkersStore } from "./workers.ts";
import { useTasksStore } from "./tasks.ts";
import { useSettingsStore } from "./settings.ts";
import type { ActivityEvent, Alert } from "../lib/types.ts";
import { create } from "zustand";

interface ConnectionStore {
  connected: boolean;
  activities: ActivityEvent[];
  alerts: Alert[];
  setConnected: (v: boolean) => void;
  addActivity: (e: ActivityEvent) => void;
  addAlert: (a: Alert) => void;
  dismissAlert: (id: string) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connected: false,
  activities: [
    {
      id: "act-1",
      timestamp: Date.now() - 60000,
      workerId: "worker-1",
      type: "pr_created",
      message: "PR #142 created: feat: add Google OAuth provider",
    },
    {
      id: "act-2",
      timestamp: Date.now() - 120000,
      workerId: "worker-5",
      type: "error",
      message: "Tests failed, retrying (attempt 3/3)",
    },
    {
      id: "act-3",
      timestamp: Date.now() - 180000,
      workerId: "worker-2",
      type: "task_started",
      message: "Started: task-002 Add SAML authentication",
    },
    {
      id: "act-4",
      timestamp: Date.now() - 240000,
      workerId: "worker-4",
      type: "task_completed",
      message: "Completed: task-005 Fix README typo",
    },
  ],
  alerts: [],
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
}));

export function useWebSocket() {
  const { settings } = useSettingsStore();
  const { updateWorkerStatus, setWorkers } = useWorkersStore();
  const { updateTask, setTasks } = useTasksStore();
  const { setConnected, addActivity, addAlert } = useConnectionStore();
  const gatewayRef = useRef(getGateway(settings.gatewayUrl));
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const gateway = gatewayRef.current;

    const unsubMessage = gateway.onMessage((msg) => {
      switch (msg.type) {
        case "connected":
          break;

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
