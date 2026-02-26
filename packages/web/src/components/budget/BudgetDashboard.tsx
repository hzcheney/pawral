import { useState } from "react";
import clsx from "clsx";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  CalendarDays,
  Pause,
  RotateCcw,
  Pencil,
  Cpu,
  Clock,
} from "lucide-react";

// --- demo data ---------------------------------------------------------------

interface Transaction {
  id: string;
  time: string;
  workerId: string;
  task: string;
  model: string;
  cost: number;
}

const DEMO_BUDGET = {
  todaySpent: 18.5,
  todayLimit: 50,
  weekSpent: 42.0,
  weekLimit: 200,
  monthSpent: 142.0,
  monthLimit: 500,
};

const DEMO_WORKER_COSTS: { id: string; cost: number }[] = [
  { id: "worker-1", cost: 3.2 },
  { id: "worker-2", cost: 1.8 },
  { id: "worker-3", cost: 2.9 },
  { id: "worker-4", cost: 2.1 },
  { id: "worker-5", cost: 4.5 },
  { id: "worker-6", cost: 0.0 },
];

const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    time: "14:52",
    workerId: "worker-1",
    task: "Implement OAuth provider",
    model: "claude-sonnet-4-6",
    cost: 1.2,
  },
  {
    id: "tx-2",
    time: "14:48",
    workerId: "worker-5",
    task: "Update CI pipeline",
    model: "claude-sonnet-4-6",
    cost: 1.8,
  },
  {
    id: "tx-3",
    time: "14:35",
    workerId: "worker-2",
    task: "Add SAML authentication",
    model: "claude-sonnet-4-6",
    cost: 0.8,
  },
  {
    id: "tx-4",
    time: "14:22",
    workerId: "worker-3",
    task: "API rate limiting middleware",
    model: "claude-opus-4-6",
    cost: 3.4,
  },
  {
    id: "tx-5",
    time: "14:10",
    workerId: "worker-4",
    task: "Fix README typo",
    model: "claude-sonnet-4-6",
    cost: 0.15,
  },
  {
    id: "tx-6",
    time: "13:55",
    workerId: "worker-1",
    task: "Refactor DB connection pool",
    model: "claude-sonnet-4-6",
    cost: 2.0,
  },
  {
    id: "tx-7",
    time: "13:40",
    workerId: "worker-2",
    task: "Add dark mode toggle",
    model: "claude-sonnet-4-6",
    cost: 1.0,
  },
  {
    id: "tx-8",
    time: "13:28",
    workerId: "worker-5",
    task: "Write integration tests",
    model: "claude-opus-4-6",
    cost: 2.7,
  },
];

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
    </div>
  );
}

function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary">
      <div className="flex items-center gap-2 border-b border-border-default px-4 py-3">
        <Clock size={16} className="text-text-secondary" />
        <h3 className="text-sm font-semibold text-text-primary">Recent Transactions</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-muted text-xs text-text-muted">
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Worker</th>
              <th className="px-4 py-2.5 font-medium">Task</th>
              <th className="px-4 py-2.5 font-medium">Model</th>
              <th className="px-4 py-2.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-border-muted transition-colors last:border-b-0 hover:bg-bg-tertiary"
              >
                <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{tx.time}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center rounded-md bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary">
                    {tx.workerId}
                  </span>
                </td>
                <td className="max-w-[260px] truncate px-4 py-2.5 text-text-primary">
                  {tx.task}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{tx.model}</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-text-secondary">
                  {formatCurrency(tx.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- main component ----------------------------------------------------------

export function BudgetDashboard() {
  const [_editLimitsOpen, setEditLimitsOpen] = useState(false);

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
          spent={DEMO_BUDGET.todaySpent}
          limit={DEMO_BUDGET.todayLimit}
        />
        <StatCard
          label="This Week"
          icon={TrendingUp}
          spent={DEMO_BUDGET.weekSpent}
          limit={DEMO_BUDGET.weekLimit}
        />
        <StatCard
          label="This Month"
          icon={CalendarDays}
          spent={DEMO_BUDGET.monthSpent}
          limit={DEMO_BUDGET.monthLimit}
        />
      </div>

      {/* Cost by worker */}
      <div className="mb-6">
        <WorkerCostChart workers={DEMO_WORKER_COSTS} />
      </div>

      {/* Transactions table */}
      <TransactionsTable transactions={DEMO_TRANSACTIONS} />
    </div>
  );
}
