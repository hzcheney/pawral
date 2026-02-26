import { useState, useEffect, useRef } from "react";
import {
  Maximize2,
  Minimize2,
  X,
  Square,
  RotateCcw,
} from "lucide-react";
import clsx from "clsx";
import type { WorkerState, WorkerStatus } from "../../lib/types.ts";
import { useConnectionStore } from "../../stores/useWebSocket.ts";

// ---------- Status helpers ----------

const STATUS_DOT_COLORS: Record<WorkerStatus, string> = {
  idle: "bg-status-idle",
  planning: "bg-status-planning",
  coding: "bg-status-coding",
  testing: "bg-status-testing",
  pr: "bg-status-pr",
  error: "bg-status-error",
};

const STATUS_LABELS: Record<WorkerStatus, string> = {
  idle: "Idle",
  planning: "Planning",
  coding: "Coding",
  testing: "Testing",
  pr: "PR Created",
  error: "Error",
};

const STATUS_BAR_COLORS: Record<WorkerStatus, string> = {
  idle: "bg-status-idle",
  planning: "bg-status-planning",
  coding: "bg-status-coding",
  testing: "bg-status-testing",
  pr: "bg-status-pr",
  error: "bg-status-error",
};

const PHASE_PROGRESS: Record<WorkerStatus, number> = {
  idle: 0,
  planning: 25,
  coding: 60,
  testing: 85,
  pr: 100,
  error: 0,
};

// ---------- Elapsed time helper ----------

function useElapsedTime(startedAt: number | null): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (startedAt === null) {
    return "--";
  }

  const elapsed = Math.max(0, now - startedAt);
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

// ---------- Blinking cursor ----------

function BlinkingCursor() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="leading-5 text-text-primary">
      <span className="text-accent-green">$</span>{" "}
      <span className={visible ? "opacity-100" : "opacity-0"}>_</span>
    </div>
  );
}

// ---------- Props ----------

interface TerminalPanelProps {
  worker: WorkerState;
  onMaximize: () => void;
  isFullscreen?: boolean;
}

// ---------- Main component ----------

export function TerminalPanel({ worker, onMaximize, isFullscreen = false }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsedTime(worker.startedAt);
  const lines = useConnectionStore((state) => state.terminalOutput[worker.id] ?? []);
  const progress = PHASE_PROGRESS[worker.status];

  // Auto-scroll terminal body to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const taskTitle = worker.currentTask?.title ?? null;
  const repoName = worker.currentTask?.repo ?? null;

  return (
    <div
      className={clsx(
        "flex flex-col rounded-md border border-border-default bg-bg-secondary overflow-hidden",
        isFullscreen && "absolute inset-0 z-50 rounded-none",
      )}
    >
      {/* Header bar — 36px */}
      <div className="flex items-center justify-between h-9 px-3 bg-bg-tertiary border-b border-border-muted shrink-0 select-none">
        {/* Left side */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Status dot */}
          <span
            className={clsx(
              "w-2.5 h-2.5 rounded-full shrink-0",
              STATUS_DOT_COLORS[worker.status],
            )}
            title={STATUS_LABELS[worker.status]}
          />

          {/* Worker ID */}
          <span className="text-xs font-mono font-semibold text-text-primary shrink-0">
            {worker.id}
          </span>

          {/* Task title (truncated) */}
          {taskTitle && (
            <span className="text-xs text-text-secondary truncate max-w-[140px]" title={taskTitle}>
              {taskTitle}
            </span>
          )}

          {/* Repo badge */}
          {repoName && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-primary text-text-secondary border border-border-muted shrink-0">
              {repoName}
            </span>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Cost */}
          {worker.cost > 0 && (
            <span className="text-xs font-mono text-accent-yellow">
              ${worker.cost.toFixed(2)}
            </span>
          )}

          {/* Elapsed time */}
          {worker.startedAt !== null && (
            <span className="text-xs font-mono text-text-secondary">{elapsed}</span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              className="p-0.5 rounded hover:bg-bg-primary text-text-muted hover:text-text-secondary transition-colors"
              onClick={onMaximize}
              title={isFullscreen ? "Exit fullscreen" : "Maximize"}
            >
              {isFullscreen ? (
                <Minimize2 size={13} />
              ) : (
                <Maximize2 size={13} />
              )}
            </button>
            {worker.status !== "idle" && (
              <button
                className="p-0.5 rounded hover:bg-bg-primary text-text-muted hover:text-accent-red transition-colors"
                title="Kill process"
              >
                <Square size={13} />
              </button>
            )}
            {worker.status === "error" && (
              <button
                className="p-0.5 rounded hover:bg-bg-primary text-text-muted hover:text-accent-yellow transition-colors"
                title="Retry"
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              className="p-0.5 rounded hover:bg-bg-primary text-text-muted hover:text-accent-red transition-colors"
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar — 2px thin bar below header */}
      <div className="h-0.5 w-full bg-bg-primary shrink-0">
        {progress > 0 && (
          <div
            className={clsx("h-full transition-all duration-500 ease-out", STATUS_BAR_COLORS[worker.status])}
            style={{ width: `${progress}%` }}
          />
        )}
      </div>

      {/* Terminal body */}
      <div
        ref={terminalRef}
        className={clsx(
          "flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed min-h-0",
          "bg-bg-primary",
        )}
      >
        {lines.length === 0 && worker.status === "idle" ? (
          <BlinkingCursor />
        ) : lines.length === 0 ? (
          <div className="text-text-muted">Waiting for output...</div>
        ) : (
          <div className="flex flex-col gap-0">
            {lines.map((line, i) => (
              <div key={`${worker.id}-${i}`} className="leading-5 text-text-primary whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
            {/* Show cursor after output for active states */}
            {(worker.status === "coding" || worker.status === "planning" || worker.status === "testing") && (
              <div className="mt-1">
                <BlinkingCursor />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
