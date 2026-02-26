import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import clsx from "clsx";
import { useConnectionStore } from "../../stores/useWebSocket.ts";
import type { Alert } from "../../lib/types.ts";

const ALERT_CONFIG: Record<
  Alert["type"],
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    bgClass: string;
    borderClass: string;
    iconClass: string;
    textClass: string;
  }
> = {
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-accent-yellow/10",
    borderClass: "border-accent-yellow/30",
    iconClass: "text-accent-yellow",
    textClass: "text-accent-yellow",
  },
  error: {
    icon: AlertCircle,
    bgClass: "bg-accent-red/10",
    borderClass: "border-accent-red/30",
    iconClass: "text-accent-red",
    textClass: "text-accent-red",
  },
  info: {
    icon: Info,
    bgClass: "bg-accent-blue/10",
    borderClass: "border-accent-blue/30",
    iconClass: "text-accent-blue",
    textClass: "text-accent-blue",
  },
};

function AlertItem({
  alert,
  onDismiss,
}: {
  alert: Alert;
  onDismiss: (id: string) => void;
}) {
  const config = ALERT_CONFIG[alert.type];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        "flex items-center gap-3 border-b px-4 py-2",
        config.bgClass,
        config.borderClass
      )}
      role="alert"
    >
      <Icon size={16} className={clsx("shrink-0", config.iconClass)} />

      <span className={clsx("flex-1 text-xs", config.textClass)}>
        {alert.message}
      </span>

      {alert.workerId && (
        <span className="shrink-0 rounded bg-bg-primary/30 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
          {alert.workerId}
        </span>
      )}

      <button
        onClick={() => onDismiss(alert.id)}
        className={clsx(
          "shrink-0 rounded p-0.5 transition-colors hover:bg-bg-primary/20",
          config.textClass
        )}
        aria-label="Dismiss alert"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function AlertBanner() {
  const { alerts, dismissAlert } = useConnectionStore();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
      ))}
    </div>
  );
}
