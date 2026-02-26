import clsx from "clsx";
import {
  Clock,
  DollarSign,
  GitBranch,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "../../lib/types.ts";

// --- helpers ----------------------------------------------------------------

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "bg-accent-red",
  medium: "bg-accent-yellow",
  low: "bg-text-secondary",
};

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  high: "border-l-accent-red",
  medium: "border-l-accent-yellow",
  low: "border-l-text-secondary",
};

const STATUS_BADGE: Record<TaskStatus, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "bg-text-muted/20 text-text-secondary",
  },
  assigned: {
    label: "Assigned",
    className: "bg-accent-yellow/15 text-accent-yellow",
  },
  running: {
    label: "Running",
    className: "bg-accent-green/15 text-accent-green",
  },
  pr: {
    label: "PR",
    className: "bg-accent-blue/15 text-accent-blue",
  },
  done: {
    label: "Done",
    className: "bg-accent-green/10 text-accent-green/70",
  },
  failed: {
    label: "Failed",
    className: "bg-accent-red/15 text-accent-red",
  },
};

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function formatElapsed(startedAt: number | null, completedAt: number | null): string {
  if (!startedAt) {
    return "\u2014";
  }
  const end = completedAt ?? Date.now();
  const totalSeconds = Math.floor((end - startedAt) / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

// --- props ------------------------------------------------------------------

interface TaskCardProps {
  task: Task;
  variant: "list" | "kanban";
  onSelect?: (task: Task) => void;
}

// --- list variant -----------------------------------------------------------

function ListRow({ task, onSelect }: { task: Task; onSelect?: (task: Task) => void }) {
  const badge = STATUS_BADGE[task.status];

  return (
    <tr
      onClick={() => onSelect?.(task)}
      className={clsx(
        "border-b border-border-muted transition-colors",
        onSelect && "cursor-pointer",
        "hover:bg-bg-tertiary",
      )}
    >
      {/* Priority */}
      <td className="px-3 py-2.5">
        <span
          className={clsx(
            "inline-block h-2.5 w-2.5 rounded-full",
            PRIORITY_COLORS[task.priority],
          )}
          title={task.priority}
        />
      </td>

      {/* ID */}
      <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
        #{task.id}
      </td>

      {/* Title */}
      <td className="max-w-[280px] truncate px-3 py-2.5 text-sm font-medium text-text-primary">
        {task.title}
      </td>

      {/* Repo */}
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary">
          <GitBranch size={12} />
          {task.repo}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <span
          className={clsx(
            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </td>

      {/* Assigned Worker */}
      <td className="px-3 py-2.5 text-xs text-text-secondary">
        {task.assignedWorker ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-0.5">
            {task.assignedWorker}
          </span>
        ) : (
          <span className="text-text-muted">&mdash;</span>
        )}
      </td>

      {/* Model */}
      <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
        {task.model}
      </td>

      {/* Cost */}
      <td className="px-3 py-2.5 text-right font-mono text-xs text-text-secondary">
        {task.cost > 0 ? formatCost(task.cost) : "\u2014"}
      </td>

      {/* Time */}
      <td className="px-3 py-2.5 text-right text-xs text-text-muted">
        {formatElapsed(task.startedAt, task.completedAt)}
      </td>
    </tr>
  );
}

// --- kanban variant ---------------------------------------------------------

function KanbanCard({ task, onSelect }: { task: Task; onSelect?: (task: Task) => void }) {
  const isRunning = task.status === "running";

  return (
    <div
      onClick={() => onSelect?.(task)}
      className={clsx(
        "rounded-lg border border-border-default bg-bg-secondary p-3 transition-colors",
        "border-l-4",
        PRIORITY_BORDER[task.priority],
        onSelect && "cursor-pointer hover:border-border-default hover:bg-bg-tertiary",
      )}
    >
      {/* Title */}
      <p className="text-sm font-semibold text-text-primary leading-snug">
        {task.title}
      </p>

      {/* Repo badge */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-bg-primary px-1.5 py-0.5 text-[11px] text-text-secondary">
          <GitBranch size={10} />
          {task.repo}
        </span>
        <span className="font-mono text-[11px] text-text-muted">#{task.id}</span>
      </div>

      {/* Running progress bar */}
      {isRunning && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-primary">
          <div className="h-full animate-pulse rounded-full bg-accent-green/60" style={{ width: "60%" }} />
        </div>
      )}

      {/* Error message */}
      {task.status === "failed" && task.errorMessage && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-accent-red/10 px-2 py-1">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-accent-red" />
          <span className="text-[11px] leading-tight text-accent-red">
            {task.errorMessage}
          </span>
        </div>
      )}

      {/* PR link */}
      {task.prUrl && (
        <a
          href={task.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent-blue hover:underline"
        >
          <ExternalLink size={10} />
          View PR
        </a>
      )}

      {/* Bottom row: cost + time */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-text-muted">
        <span className="flex items-center gap-1">
          <DollarSign size={10} />
          {task.cost > 0 ? formatCost(task.cost) : "\u2014"}
        </span>

        {task.assignedWorker && (
          <span className="rounded bg-bg-primary px-1.5 py-0.5 text-text-secondary">
            {task.assignedWorker}
          </span>
        )}

        <span className="flex items-center gap-1">
          <Clock size={10} />
          {formatElapsed(task.startedAt, task.completedAt)}
        </span>
      </div>
    </div>
  );
}

// --- main component ---------------------------------------------------------

export function TaskCard({ task, variant, onSelect }: TaskCardProps) {
  if (variant === "list") {
    return <ListRow task={task} onSelect={onSelect} />;
  }
  return <KanbanCard task={task} onSelect={onSelect} />;
}
