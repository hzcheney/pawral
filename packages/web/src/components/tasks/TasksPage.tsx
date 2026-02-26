import { useState } from "react";
import clsx from "clsx";
import { List, LayoutGrid, GitFork, Plus } from "lucide-react";
import { useTasksStore } from "../../stores/tasks.ts";
import { TaskListView } from "./TaskListView.tsx";
import { TaskKanbanView } from "./TaskKanbanView.tsx";
import { NewTaskModal } from "./NewTaskModal.tsx";

// --- types ------------------------------------------------------------------

type ViewMode = "list" | "board" | "graph";

interface ViewOption {
  mode: ViewMode;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const VIEW_OPTIONS: ViewOption[] = [
  { mode: "list", label: "List", icon: List },
  { mode: "board", label: "Board", icon: LayoutGrid },
  { mode: "graph", label: "Graph", icon: GitFork },
];

// --- component --------------------------------------------------------------

export function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  const taskCount = useTasksStore((s) => s.tasks.length);

  return (
    <div className="flex h-full flex-col">
      {/* --- Top bar -------------------------------------------------------- */}
      <div className="flex items-center justify-between border-b border-border-muted bg-bg-secondary px-5 py-3">
        {/* Left: title + count */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-text-primary">Task Queue</h1>
          <span className="flex h-5 items-center rounded-full bg-bg-tertiary px-2 text-[11px] font-medium text-text-muted">
            {taskCount}
          </span>
        </div>

        {/* Right: view toggle + new task */}
        <div className="flex items-center gap-3">
          {/* View toggle group */}
          <div className="flex rounded-lg border border-border-default bg-bg-primary p-0.5">
            {VIEW_OPTIONS.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                disabled={mode === "graph"}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  mode === viewMode
                    ? "bg-bg-tertiary text-text-primary"
                    : "text-text-muted hover:text-text-secondary",
                  mode === "graph" && "cursor-not-allowed opacity-40",
                )}
                title={mode === "graph" ? "Coming soon" : label}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* New task button (shown in board view since list view has its own) */}
          {viewMode !== "list" && (
            <button
              onClick={() => setShowNewTaskModal(true)}
              className="flex items-center gap-1.5 rounded-md bg-accent-green px-3 py-1.5 text-xs font-medium text-bg-primary transition-colors hover:bg-accent-green/90"
            >
              <Plus size={14} />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* --- Body ----------------------------------------------------------- */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "list" && (
          <TaskListView
            onNewTask={() => setShowNewTaskModal(true)}
            onSelectTask={undefined}
          />
        )}
        {viewMode === "board" && (
          <TaskKanbanView
            onNewTask={() => setShowNewTaskModal(true)}
            onSelectTask={undefined}
          />
        )}
        {viewMode === "graph" && (
          <div className="flex h-full flex-col items-center justify-center text-text-muted">
            <GitFork size={48} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Dependency Graph</p>
            <p className="mt-1 text-xs">Coming in Phase 2</p>
          </div>
        )}
      </div>

      {/* --- New task modal ------------------------------------------------- */}
      <NewTaskModal
        open={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
      />
    </div>
  );
}
