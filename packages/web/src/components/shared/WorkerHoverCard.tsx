import { useState, useRef, useCallback } from "react";
import {
  Eye,
  Pause,
  XCircle,
  ArrowRightLeft,
  Clock,
  DollarSign,
  Cpu,
  Key,
  FolderGit2,
} from "lucide-react";
import clsx from "clsx";
import type { WorkerState, WorkerStatus } from "../../lib/types.ts";

interface WorkerHoverCardProps {
  worker: WorkerState;
  children: React.ReactNode;
}

const STATUS_CONFIG: Record<
  WorkerStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  idle: {
    label: "Idle",
    dotClass: "bg-status-idle",
    textClass: "text-text-muted",
  },
  planning: {
    label: "Planning",
    dotClass: "bg-status-planning",
    textClass: "text-accent-yellow",
  },
  coding: {
    label: "Coding",
    dotClass: "bg-status-coding",
    textClass: "text-accent-green",
  },
  testing: {
    label: "Testing",
    dotClass: "bg-status-testing",
    textClass: "text-accent-blue",
  },
  pr: {
    label: "PR Created",
    dotClass: "bg-status-pr",
    textClass: "text-accent-blue",
  },
  error: {
    label: "Error",
    dotClass: "bg-status-error",
    textClass: "text-accent-red",
  },
};

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) {
    return "--";
  }
  const elapsed = Date.now() - startedAt;
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) {
    return "<1 min ago";
  }
  return `${minutes} min ago`;
}

export function WorkerHoverCard({ worker, children }: WorkerHoverCardProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<"below" | "above">("below");
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCard = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      // Determine position based on trigger element
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setPosition(spaceBelow < 320 ? "above" : "below");
      }
      setVisible(true);
    }, 200);
  }, []);

  const hideCard = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, 150);
  }, []);

  const statusConfig = STATUS_CONFIG[worker.status];

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={showCard}
      onMouseLeave={hideCard}
    >
      {children}

      {visible && (
        <div
          className={clsx(
            "absolute left-0 z-50 w-72 rounded-lg border border-border-default bg-bg-secondary shadow-xl",
            position === "below" ? "top-full mt-2" : "bottom-full mb-2"
          )}
          onMouseEnter={showCard}
          onMouseLeave={hideCard}
        >
          {/* Header */}
          <div className="border-b border-border-default px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-text-primary">
                {worker.id}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={clsx(
                    "inline-block h-2 w-2 rounded-full",
                    statusConfig.dotClass
                  )}
                />
                <span
                  className={clsx("text-xs font-medium", statusConfig.textClass)}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2 px-4 py-3 text-xs">
            {/* Current task */}
            {worker.currentTask && (
              <div className="flex items-start gap-2">
                <span className="w-16 shrink-0 text-text-muted">Task</span>
                <span className="text-text-primary">
                  {worker.currentTask.title}
                </span>
              </div>
            )}

            {/* Workspace */}
            <div className="flex items-start gap-2">
              <FolderGit2 size={12} className="mt-0.5 shrink-0 text-text-muted" />
              <span className="w-14 shrink-0 text-text-muted">Repo</span>
              <span className="font-mono text-text-secondary">
                {worker.currentTask?.repo ?? "--"}
              </span>
            </div>

            {/* Model */}
            <div className="flex items-start gap-2">
              <Cpu size={12} className="mt-0.5 shrink-0 text-text-muted" />
              <span className="w-14 shrink-0 text-text-muted">Model</span>
              <span className="font-mono text-text-secondary">
                {worker.model}
              </span>
            </div>

            {/* Session key */}
            <div className="flex items-start gap-2">
              <Key size={12} className="mt-0.5 shrink-0 text-text-muted" />
              <span className="w-14 shrink-0 text-text-muted">Session</span>
              <span className="truncate font-mono text-text-muted">
                {worker.sessionKey ?? "--"}
              </span>
            </div>

            {/* Started */}
            <div className="flex items-start gap-2">
              <Clock size={12} className="mt-0.5 shrink-0 text-text-muted" />
              <span className="w-14 shrink-0 text-text-muted">Started</span>
              <span className="text-text-secondary">
                {formatElapsed(worker.startedAt)}
              </span>
            </div>

            {/* Cost */}
            <div className="flex items-start gap-2">
              <DollarSign
                size={12}
                className="mt-0.5 shrink-0 text-text-muted"
              />
              <span className="w-14 shrink-0 text-text-muted">Cost</span>
              <span className="font-mono text-text-secondary">
                ${worker.cost.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 border-t border-border-default px-3 py-2">
            <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-accent-blue">
              <Eye size={12} />
              View Session
            </button>
            <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-accent-yellow">
              <Pause size={12} />
              Pause
            </button>
            <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-accent-red">
              <XCircle size={12} />
              Kill
            </button>
            <button className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-accent-orange">
              <ArrowRightLeft size={12} />
              Reassign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
