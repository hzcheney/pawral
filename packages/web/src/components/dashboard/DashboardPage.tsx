import { useState } from "react";
import { Grid2x2, Grid3x3, Plus, Activity } from "lucide-react";
import clsx from "clsx";
import { TerminalGrid, type GridLayout } from "./TerminalGrid.tsx";
import { useWorkersStore } from "../../stores/workers.ts";

// ---------- Demo activity events ----------

interface RecentEvent {
  id: string;
  timestamp: string;
  workerId: string;
  icon: "success" | "error" | "start" | "info";
  message: string;
}

const ICON_CLASSES: Record<RecentEvent["icon"], string> = {
  success: "text-accent-green",
  error: "text-accent-red",
  start: "text-accent-blue",
  info: "text-accent-yellow",
};

const ICON_SYMBOLS: Record<RecentEvent["icon"], string> = {
  success: "\u2713",
  error: "\u2717",
  start: "\u25B6",
  info: "\u25CF",
};

function makeDemoEvents(): RecentEvent[] {
  const now = new Date();
  const fmt = (offset: number) => {
    const d = new Date(now.getTime() - offset * 60_000);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  };
  return [
    { id: "e1", timestamp: fmt(2), workerId: "worker-4", icon: "success", message: "PR #142 created" },
    { id: "e2", timestamp: fmt(5), workerId: "worker-5", icon: "error", message: "Tests failed, retrying" },
    { id: "e3", timestamp: fmt(8), workerId: "worker-1", icon: "start", message: "Started: Implement OAuth provider" },
  ];
}

// ---------- Main component ----------

export function DashboardPage() {
  const [layout, setLayout] = useState<GridLayout>("3x2");
  const workers = useWorkersStore((state) => state.workers);
  const events = makeDemoEvents();

  const activeCount = workers.filter((w) => w.status !== "idle").length;
  const totalCount = workers.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Control bar */}
      <div className="flex items-center justify-between h-11 px-4 bg-bg-secondary border-b border-border-default shrink-0">
        {/* Left */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text-primary">Control Center</h1>
          <span className="text-xs text-text-secondary font-mono">
            {activeCount}/{totalCount} active
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="flex items-center bg-bg-primary rounded border border-border-muted">
            <button
              className={clsx(
                "flex items-center justify-center w-7 h-7 rounded-l transition-colors",
                layout === "2x2"
                  ? "bg-bg-tertiary text-text-primary"
                  : "text-text-muted hover:text-text-secondary",
              )}
              onClick={() => setLayout("2x2")}
              title="2x2 layout"
            >
              <Grid2x2 size={14} />
            </button>
            <button
              className={clsx(
                "flex items-center justify-center w-7 h-7 rounded-r transition-colors",
                layout === "3x2"
                  ? "bg-bg-tertiary text-text-primary"
                  : "text-text-muted hover:text-text-secondary",
              )}
              onClick={() => setLayout("3x2")}
              title="3x2 layout"
            >
              <Grid3x3 size={14} />
            </button>
          </div>

          {/* New Task button */}
          <button className="flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/25 hover:bg-accent-green/25 transition-colors">
            <Plus size={13} />
            New Task
          </button>
        </div>
      </div>

      {/* Terminal grid */}
      <div className="flex-1 p-2 min-h-0">
        <TerminalGrid layout={layout} />
      </div>

      {/* Activity feed strip */}
      <div className="flex items-center gap-1 h-8 px-4 bg-bg-secondary border-t border-border-default shrink-0 overflow-hidden">
        <Activity size={12} className="text-text-muted shrink-0" />
        <div className="flex items-center gap-4 min-w-0 overflow-hidden">
          {events.map((event) => (
            <div key={event.id} className="flex items-center gap-1.5 text-[11px] shrink-0">
              <span className="text-text-muted font-mono">{event.timestamp}</span>
              <span className="text-text-secondary font-mono">{event.workerId}</span>
              <span className={ICON_CLASSES[event.icon]}>{ICON_SYMBOLS[event.icon]}</span>
              <span className="text-text-secondary truncate max-w-[200px]">{event.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
