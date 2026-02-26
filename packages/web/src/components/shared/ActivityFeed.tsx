import {
  Play,
  CheckCircle2,
  GitPullRequest,
  AlertCircle,
  Info,
} from "lucide-react";
import clsx from "clsx";
import { useConnectionStore } from "../../stores/useWebSocket.ts";
import type { ActivityEvent } from "../../lib/types.ts";

interface ActivityFeedProps {
  maxItems?: number;
  compact?: boolean;
}

const EVENT_CONFIG: Record<
  ActivityEvent["type"],
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    iconClass: string;
  }
> = {
  task_started: { icon: Play, iconClass: "text-accent-green" },
  task_completed: { icon: CheckCircle2, iconClass: "text-accent-green" },
  pr_created: { icon: GitPullRequest, iconClass: "text-accent-blue" },
  error: { icon: AlertCircle, iconClass: "text-accent-red" },
  info: { icon: Info, iconClass: "text-text-muted" },
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function WorkerBadge({ workerId }: { workerId: string }) {
  const num = workerId.replace("worker-", "");
  return (
    <span className="inline-flex items-center rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
      W-{num}
    </span>
  );
}

export function ActivityFeed({
  maxItems = 50,
  compact = false,
}: ActivityFeedProps) {
  const { activities } = useConnectionStore();
  const visibleActivities = activities.slice(0, maxItems);

  if (visibleActivities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-muted">
        <Info size={20} className="mb-2 opacity-50" />
        <span className="text-xs">No activity yet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Activity
          </span>
          <span className="text-[10px] text-text-muted">
            {visibleActivities.length} events
          </span>
        </div>
      )}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {visibleActivities.map((event) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;

          return (
            <div
              key={event.id}
              className={clsx(
                "flex items-start gap-2 border-b border-border-muted/30 transition-colors hover:bg-bg-tertiary/50",
                compact ? "px-2 py-1.5" : "px-3 py-2"
              )}
            >
              {/* Timestamp */}
              <span
                className={clsx(
                  "shrink-0 font-mono text-text-muted",
                  compact ? "text-[10px]" : "text-[11px]"
                )}
              >
                {formatTime(event.timestamp)}
              </span>

              {/* Worker badge */}
              <WorkerBadge workerId={event.workerId} />

              {/* Icon */}
              <Icon
                size={compact ? 12 : 14}
                className={clsx("mt-0.5 shrink-0", config.iconClass)}
              />

              {/* Message */}
              <span
                className={clsx(
                  "flex-1 leading-tight text-text-secondary",
                  compact ? "text-[11px]" : "text-xs"
                )}
              >
                {event.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
