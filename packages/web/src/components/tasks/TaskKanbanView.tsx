import clsx from "clsx";
import { Circle, Plus } from "lucide-react";
import { useTasksStore } from "../../stores/tasks.ts";
import type { Task, TaskStatus } from "../../lib/types.ts";
import { TaskCard } from "./TaskCard.tsx";

// --- types ------------------------------------------------------------------

interface KanbanColumn {
  status: TaskStatus;
  label: string;
  dotColor: string;
}

interface TaskKanbanViewProps {
  onNewTask: () => void;
  onSelectTask?: (task: Task) => void;
}

// --- constants --------------------------------------------------------------

const COLUMNS: KanbanColumn[] = [
  { status: "queued", label: "TO DO", dotColor: "text-text-muted" },
  { status: "assigned", label: "IN PROGRESS", dotColor: "text-accent-yellow" },
  { status: "running", label: "RUNNING", dotColor: "text-accent-green" },
  { status: "failed", label: "FAILED", dotColor: "text-accent-red" },
  { status: "done", label: "DONE", dotColor: "text-accent-green/70" },
];

// --- component --------------------------------------------------------------

export function TaskKanbanView({ onNewTask, onSelectTask }: TaskKanbanViewProps) {
  const tasks = useTasksStore((s) => s.tasks);

  // Group tasks by status (include "pr" tasks in the "done" column for kanban)
  function getColumnTasks(status: TaskStatus): Task[] {
    if (status === "done") {
      return tasks.filter((t) => t.status === "done" || t.status === "pr");
    }
    return tasks.filter((t) => t.status === status);
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {COLUMNS.map((col) => {
        const columnTasks = getColumnTasks(col.status);

        return (
          <div
            key={col.status}
            className="flex w-72 shrink-0 flex-col rounded-lg bg-bg-primary"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2">
                <Circle
                  size={10}
                  className={clsx(col.dotColor, "fill-current")}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {col.label}
                </span>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bg-tertiary px-1.5 text-[10px] font-medium text-text-muted">
                  {columnTasks.length}
                </span>
              </div>

              {col.status === "queued" && (
                <button
                  onClick={onNewTask}
                  className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-secondary"
                  title="Add task"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
              {columnTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-xs text-text-muted">No tasks</p>
                </div>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    variant="kanban"
                    onSelect={onSelectTask}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
