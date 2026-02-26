import { useState, useMemo, useCallback } from "react";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Plus,
} from "lucide-react";
import { useTasksStore } from "../../stores/tasks.ts";
import type { Task, TaskStatus, TaskPriority } from "../../lib/types.ts";
import { TaskCard } from "./TaskCard.tsx";

// --- types ------------------------------------------------------------------

type SortField = "id" | "title" | "repo" | "status" | "assignedWorker" | "model" | "cost" | "createdAt";
type SortDir = "asc" | "desc";

interface TaskListViewProps {
  onNewTask: () => void;
  onSelectTask?: (task: Task) => void;
}

// --- constants --------------------------------------------------------------

const PAGE_SIZE = 8;

const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "queued", label: "Queued" },
  { value: "assigned", label: "Assigned" },
  { value: "running", label: "Running" },
  { value: "pr", label: "PR" },
  { value: "done", label: "Done" },
  { value: "failed", label: "Failed" },
];

const PRIORITY_OPTIONS: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All Priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const COLUMNS: { key: SortField; label: string; sortable: boolean; className?: string }[] = [
  { key: "id", label: "", sortable: false, className: "w-8" }, // priority dot column
  { key: "id", label: "#", sortable: true, className: "w-24" },
  { key: "title", label: "TASK TITLE", sortable: true },
  { key: "repo", label: "REPO", sortable: true, className: "w-28" },
  { key: "status", label: "STATUS", sortable: true, className: "w-24" },
  { key: "assignedWorker", label: "ASSIGNEE", sortable: true, className: "w-28" },
  { key: "model", label: "MODEL", sortable: true, className: "w-32" },
  { key: "cost", label: "COST", sortable: true, className: "w-20 text-right" },
  { key: "createdAt", label: "TIME", sortable: true, className: "w-20 text-right" },
];

// --- helpers ----------------------------------------------------------------

function compareTasks(a: Task, b: Task, field: SortField, dir: SortDir): number {
  let cmp = 0;
  switch (field) {
    case "id":
      cmp = a.id.localeCompare(b.id);
      break;
    case "title":
      cmp = a.title.localeCompare(b.title);
      break;
    case "repo":
      cmp = a.repo.localeCompare(b.repo);
      break;
    case "status":
      cmp = a.status.localeCompare(b.status);
      break;
    case "assignedWorker":
      cmp = (a.assignedWorker ?? "").localeCompare(b.assignedWorker ?? "");
      break;
    case "model":
      cmp = a.model.localeCompare(b.model);
      break;
    case "cost":
      cmp = a.cost - b.cost;
      break;
    case "createdAt":
      cmp = a.createdAt - b.createdAt;
      break;
  }
  return dir === "asc" ? cmp : -cmp;
}

// --- component --------------------------------------------------------------

export function TaskListView({ onNewTask, onSelectTask }: TaskListViewProps) {
  const { filter, setFilter, getFilteredTasks } = useTasksStore();

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Derive unique repos for dropdown
  const allTasks = useTasksStore((s) => s.tasks);
  const repos = useMemo(() => {
    const set = new Set(allTasks.map((t) => t.repo));
    return Array.from(set).sort();
  }, [allTasks]);

  const filteredTasks = getFilteredTasks();

  // Sort
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => compareTasks(a, b, sortField, sortDir));
  }, [filteredTasks, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedTasks = sortedTasks.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
      setPage(1);
    },
    [sortField],
  );

  const startIdx = (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, sortedTasks.length);

  return (
    <div className="flex h-full flex-col">
      {/* --- Filter bar ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border-muted bg-bg-secondary px-4 py-3">
        {/* Status */}
        <div className="relative">
          <select
            value={filter.status ?? "all"}
            onChange={(e) => {
              setFilter({ status: e.target.value as TaskStatus | "all" });
              setPage(1);
            }}
            className="appearance-none rounded-md border border-border-default bg-bg-primary py-1.5 pl-3 pr-8 text-xs text-text-primary outline-none focus:border-accent-blue"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Repo */}
        <div className="relative">
          <select
            value={filter.repo ?? "all"}
            onChange={(e) => {
              setFilter({ repo: e.target.value });
              setPage(1);
            }}
            className="appearance-none rounded-md border border-border-default bg-bg-primary py-1.5 pl-3 pr-8 text-xs text-text-primary outline-none focus:border-accent-blue"
          >
            <option value="all">All Repos</option>
            {repos.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Priority */}
        <div className="relative">
          <select
            value={filter.priority ?? "all"}
            onChange={(e) => {
              setFilter({ priority: e.target.value as TaskPriority | "all" });
              setPage(1);
            }}
            className="appearance-none rounded-md border border-border-default bg-bg-primary py-1.5 pl-3 pr-8 text-xs text-text-primary outline-none focus:border-accent-blue"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filter.search ?? ""}
            onChange={(e) => {
              setFilter({ search: e.target.value });
              setPage(1);
            }}
            className="w-48 rounded-md border border-border-default bg-bg-primary py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
          />
        </div>

        {/* New Task */}
        <button
          onClick={onNewTask}
          className="flex items-center gap-1.5 rounded-md bg-accent-green px-3 py-1.5 text-xs font-medium text-bg-primary transition-colors hover:bg-accent-green/90"
        >
          <Plus size={14} />
          New Task
        </button>
      </div>

      {/* --- Table ------------------------------------------------------------ */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="sticky top-0 z-10 bg-bg-secondary">
            <tr className="border-b border-border-default">
              {COLUMNS.map((col, idx) => (
                <th
                  key={`${col.key}-${idx}`}
                  className={clsx(
                    "px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted",
                    col.className,
                    col.sortable && "cursor-pointer select-none hover:text-text-secondary",
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && col.key === sortField && (
                      sortDir === "asc"
                        ? <ChevronUp size={12} />
                        : <ChevronDown size={12} />
                    )}
                    {col.sortable && col.key !== sortField && col.label && (
                      <ChevronsUpDown size={12} className="opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="py-16 text-center">
                  <Filter size={32} className="mx-auto mb-3 text-text-muted" />
                  <p className="text-sm text-text-secondary">No tasks match your filters</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Try changing your filter criteria or create a new task
                  </p>
                </td>
              </tr>
            ) : (
              paginatedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  variant="list"
                  onSelect={onSelectTask}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- Pagination ------------------------------------------------------- */}
      {sortedTasks.length > 0 && (
        <div className="flex items-center justify-between border-t border-border-muted bg-bg-secondary px-4 py-2.5">
          <span className="text-xs text-text-muted">
            Showing {startIdx}&ndash;{endIdx} of {sortedTasks.length} tasks
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-md border border-border-default text-text-secondary transition-colors",
                safePage <= 1
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-bg-tertiary hover:text-text-primary",
              )}
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={clsx(
                  "flex h-7 min-w-[28px] items-center justify-center rounded-md px-1.5 text-xs transition-colors",
                  p === safePage
                    ? "border border-accent-blue bg-accent-blue/15 text-accent-blue"
                    : "border border-border-default text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
                )}
              >
                {p}
              </button>
            ))}

            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-md border border-border-default text-text-secondary transition-colors",
                safePage >= totalPages
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-bg-tertiary hover:text-text-primary",
              )}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
