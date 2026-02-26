import { useState } from "react";
import clsx from "clsx";
import {
  DollarSign,
  TrendingUp,
  CalendarDays,
  Pause,
  RotateCcw,
  Pencil,
  Cpu,
} from "lucide-react";
import { useConnectionStore } from "../../stores/useWebSocket.ts";

// --- helpers -----------------------------------------------------------------

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function getProgressColor(ratio: number): string {
  if (ratio >= 0.8) {
    return "bg-accent-red";
  }
  if (ratio >= 0.6) {
    return "bg-accent-yellow";
  }
  return "bg-accent-green";
}

function getProgressTextColor(ratio: number): string {
  if (ratio >= 0.8) {
    return "text-accent-red";
  }
  if (ratio >= 0.6) {
    return "text-accent-yellow";
  }
  return "text-accent-green";
}

// --- sub-components ----------------------------------------------------------

interface StatCardProps {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  spent: number;
  limit: number;
}

function StatCard({ label, icon: Icon, spent, limit }: StatCardProps) {
  const ratio = limit > 0 ? spent / limit : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Icon size={16} />
          <span>{label}</span>
        </div>
        <span
          className={clsx(
            "text-xs font-medium",
            getProgressTextColor(ratio),
          )}
        >
          {percent}%
        </span>
      </div>

      <p className="mt-2 text-xl font-semibold text-text-primary">
        {formatCurrency(spent)}{" "}
        <span className="text-sm font-normal text-text-muted">
          / {formatCurrency(limit)}
        </span>
      </p>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-primary">
        <div
          className={clsx("h-full rounded-full transition-all", getProgressColor(ratio))}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function WorkerCostChart({ workers }: { workers: { id: string; cost: number }[] }) {
  const maxCost = Math.max(...workers.map((w) => w.cost), 1);

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Cpu size={16} className="text-text-secondary" />
        Cost by Worker
      </h3>

      {workers.length === 0 ? (
        <p className="text-sm text-text-muted">No worker cost data available</p>
      ) : (
        <div className="space-y-3">
          {workers.map((worker) => {
            const widthPercent = maxCost > 0 ? (worker.cost / maxCost) * 100 : 0;

            return (
              <div key={worker.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-mono text-text-secondary">
                  {worker.id}
                </span>

                <div className="flex-1">
                  <div className="h-5 w-full overflow-hidden rounded bg-bg-primary">
                    <div
                      className="h-full rounded bg-accent-blue transition-all"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>

                <span className="w-14 shrink-0 text-right font-mono text-xs text-text-secondary">
                  {formatCurrency(worker.cost)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- main component ----------------------------------------------------------

export function BudgetDashboard() {
  const [_editLimitsOpen, setEditLimitsOpen] = useState(false);
  const budget = useConnectionStore((state) => state.budget);
  const connected = useConnectionStore((state) => state.connected);

  // Derive per-worker costs from budget data
  const workerCosts = budget?.perWorker
    ? Object.entries(budget.perWorker).map(([id, cost]) => ({ id, cost }))
    : [];

  if (!connected) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">Connecting to server...</p>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">No budget data available yet</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Budget Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track spending across all workers and tasks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditLimitsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent-blue hover:text-accent-blue"
          >
            <Pencil size={14} />
            Edit Limits
          </button>

          <button className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-secondary px-3 py-1.5 text-xs font-medium text-accent-yellow transition-colors hover:border-accent-yellow hover:bg-accent-yellow/10">
            <Pause size={14} />
            Pause All
          </button>

          <button className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-secondary px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent-red hover:text-accent-red">
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Today"
          icon={DollarSign}
          spent={budget.todaySpent}
          limit={budget.todayLimit}
        />
        <StatCard
          label="This Week"
          icon={TrendingUp}
          spent={budget.weekSpent}
          limit={budget.weekLimit}
        />
        <StatCard
          label="This Month"
          icon={CalendarDays}
          spent={budget.monthSpent}
          limit={budget.monthLimit}
        />
      </div>

      {/* Cost by worker */}
      <div className="mb-6">
        <WorkerCostChart workers={workerCosts} />
      </div>
    </div>
  );
}
