import { useState, useCallback } from "react";
import { Maximize, Minimize } from "lucide-react";
import clsx from "clsx";
import { useWorkersStore } from "../../stores/workers.ts";
import { useTasksStore } from "../../stores/tasks.ts";
import { useConnectionStore } from "../../stores/useWebSocket.ts";

export function StatusBar() {
  const { workers } = useWorkersStore();
  const { tasks } = useTasksStore();
  const { connected } = useConnectionStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeWorkers = workers.filter((w) => w.status !== "idle").length;
  const totalWorkers = workers.length;
  const runningTasks = tasks.filter(
    (t) => t.status === "running" || t.status === "assigned"
  ).length;
  const queuedTasks = tasks.filter((t) => t.status === "queued").length;

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen not available
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {
        // Exit fullscreen failed
      });
      setIsFullscreen(false);
    }
  }, []);

  return (
    <footer className="flex h-8 shrink-0 items-center border-t border-border-default bg-bg-secondary px-3 font-mono text-xs text-text-secondary">
      {/* Left: connection status */}
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "inline-block h-2 w-2 rounded-full",
            connected ? "bg-accent-green" : "bg-accent-red"
          )}
        />
        <span>
          Agent Status:{" "}
          <span
            className={clsx(
              connected ? "text-accent-green" : "text-accent-red"
            )}
          >
            {connected ? "Online" : "Offline"}
          </span>
        </span>
      </div>

      {/* Center: stats */}
      <div className="flex-1 text-center text-text-muted">
        Workers: {activeWorkers}/{totalWorkers} | Tasks: {runningTasks} running,{" "}
        {queuedTasks} queued | CPU: --% | RAM: --
      </div>

      {/* Right: version + fullscreen */}
      <div className="flex items-center gap-3">
        <span className="text-text-muted">v0.1.0</span>
        <button
          onClick={toggleFullscreen}
          className="text-text-muted transition-colors hover:text-text-primary"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      </div>
    </footer>
  );
}
