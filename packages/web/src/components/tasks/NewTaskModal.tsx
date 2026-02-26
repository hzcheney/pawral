import { useState, useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import { X, Diamond, Plus, ChevronDown } from "lucide-react";
import { useTasksStore } from "../../stores/tasks.ts";
import { useWorkersStore } from "../../stores/workers.ts";
import type { NewTask, TaskPriority, AgentType } from "../../lib/types.ts";

// --- types ------------------------------------------------------------------

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  title: string;
  prompt: string;
  repo: string;
  branch: string;
  priority: TaskPriority;
  model: string;
  agent: AgentType;
  budgetLimit: number;
  autoPR: boolean;
  dependsOn: string[];
  assignedWorker: string;
  createAnother: boolean;
}

const INITIAL_FORM: FormState = {
  title: "",
  prompt: "",
  repo: "",
  branch: "swarm/",
  priority: "medium",
  model: "claude-sonnet-4-6",
  agent: "claude",
  budgetLimit: 5,
  autoPR: true,
  dependsOn: [],
  assignedWorker: "",
  createAnother: false,
};

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "auto", label: "Auto (smart routing)" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// --- component --------------------------------------------------------------

export function NewTaskModal({ open, onClose }: NewTaskModalProps) {
  const addTask = useTasksStore((s) => s.addTask);
  const allTasks = useTasksStore((s) => s.tasks);
  const getIdleWorkers = useWorkersStore((s) => s.getIdleWorkers);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [depInput, setDepInput] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);

  // Focus title on open
  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addDep = useCallback(
    (id: string) => {
      const trimmed = id.trim();
      if (trimmed && !form.dependsOn.includes(trimmed)) {
        setForm((prev) => ({
          ...prev,
          dependsOn: [...prev.dependsOn, trimmed],
        }));
      }
      setDepInput("");
    },
    [form.dependsOn],
  );

  const removeDep = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      dependsOn: prev.dependsOn.filter((d) => d !== id),
    }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!form.title.trim() || !form.prompt.trim()) {
        return;
      }

      const newTask: NewTask = {
        title: form.title.trim(),
        prompt: form.prompt.trim(),
        repo: form.repo.trim() || "default",
        branch: form.branch.trim() || "swarm/",
        priority: form.priority,
        model: form.model,
        agent: form.agent,
        budgetLimit: form.budgetLimit,
        dependsOn: form.dependsOn,
        autoPR: form.autoPR,
        assignedWorker: form.assignedWorker || undefined,
      };

      addTask(newTask);

      if (form.createAnother) {
        setForm({
          ...INITIAL_FORM,
          repo: form.repo,
          branch: form.branch,
          createAnother: true,
        });
        titleRef.current?.focus();
      } else {
        setForm(INITIAL_FORM);
        onClose();
      }
    },
    [form, addTask, onClose],
  );

  if (!open) {
    return null;
  }

  const idleWorkers = getIdleWorkers();
  const availableTaskIds = allTasks.map((t) => t.id);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal */}
      <div className="w-full max-w-lg rounded-xl border border-border-default bg-bg-secondary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Diamond size={18} className="text-accent-blue" />
            <h2 className="text-base font-semibold text-text-primary">New Task</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-secondary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Task Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Implement OAuth provider"
              required
              className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
            />
          </div>

          {/* Description / Prompt */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Description / Prompt
            </label>
            <textarea
              value={form.prompt}
              onChange={(e) => update("prompt", e.target.value)}
              placeholder="Describe the task for the AI agent..."
              rows={4}
              required
              className="w-full resize-none rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
            />
          </div>

          {/* Repo + Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Repository
              </label>
              <input
                type="text"
                value={form.repo}
                onChange={(e) => update("repo", e.target.value)}
                placeholder="my-app"
                className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Branch Prefix
              </label>
              <input
                type="text"
                value={form.branch}
                onChange={(e) => update("branch", e.target.value)}
                placeholder="swarm/"
                className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent-blue"
              />
            </div>
          </div>

          {/* Priority + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Priority
              </label>
              <div className="relative">
                <select
                  value={form.priority}
                  onChange={(e) => update("priority", e.target.value as TaskPriority)}
                  className="w-full appearance-none rounded-md border border-border-default bg-bg-primary py-2 pl-3 pr-8 text-sm text-text-primary outline-none focus:border-accent-blue"
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Model
              </label>
              <div className="relative">
                <select
                  value={form.model}
                  onChange={(e) => update("model", e.target.value)}
                  className="w-full appearance-none rounded-md border border-border-default bg-bg-primary py-2 pl-3 pr-8 text-sm text-text-primary outline-none focus:border-accent-blue"
                >
                  {MODEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
            </div>
          </div>

          {/* Budget + Auto PR */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Budget Limit
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.budgetLimit}
                  onChange={(e) => update("budgetLimit", Number(e.target.value))}
                  className="w-full rounded-md border border-border-default bg-bg-primary py-2 pl-7 pr-3 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text-secondary">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.autoPR}
                  onClick={() => update("autoPR", !form.autoPR)}
                  className={clsx(
                    "relative h-5 w-9 rounded-full transition-colors",
                    form.autoPR ? "bg-accent-green" : "bg-border-default",
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                      form.autoPR ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
                Auto PR
              </label>
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Dependencies
            </label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border-default bg-bg-primary px-2 py-1.5 focus-within:border-accent-blue">
              {form.dependsOn.map((dep) => (
                <span
                  key={dep}
                  className="inline-flex items-center gap-1 rounded bg-accent-blue/15 px-2 py-0.5 text-xs text-accent-blue"
                >
                  {dep}
                  <button
                    type="button"
                    onClick={() => removeDep(dep)}
                    className="ml-0.5 text-accent-blue/60 hover:text-accent-blue"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={depInput}
                onChange={(e) => setDepInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDep(depInput);
                  }
                  if (e.key === "Backspace" && !depInput && form.dependsOn.length > 0) {
                    removeDep(form.dependsOn[form.dependsOn.length - 1]);
                  }
                }}
                placeholder={form.dependsOn.length === 0 ? "Type task ID and press Enter" : ""}
                list="dep-suggestions"
                className="min-w-[120px] flex-1 bg-transparent py-0.5 text-xs text-text-primary placeholder-text-muted outline-none"
              />
              <datalist id="dep-suggestions">
                {availableTaskIds
                  .filter((id) => !form.dependsOn.includes(id))
                  .map((id) => (
                    <option key={id} value={id} />
                  ))}
              </datalist>
            </div>
          </div>

          {/* Assign to Worker */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Assign to Worker
            </label>
            <div className="relative">
              <select
                value={form.assignedWorker}
                onChange={(e) => update("assignedWorker", e.target.value)}
                className="w-full appearance-none rounded-md border border-border-default bg-bg-primary py-2 pl-3 pr-8 text-sm text-text-primary outline-none focus:border-accent-blue"
              >
                <option value="">Auto-assign (next idle worker)</option>
                {idleWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id} (idle)
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-muted px-5 py-3.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={form.createAnother}
              onChange={(e) => update("createAnother", e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border-default bg-bg-primary accent-accent-blue"
            />
            Create another after this
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border-default bg-bg-primary px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!form.title.trim() || !form.prompt.trim()}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium transition-colors",
                form.title.trim() && form.prompt.trim()
                  ? "bg-accent-green text-bg-primary hover:bg-accent-green/90"
                  : "cursor-not-allowed bg-accent-green/40 text-bg-primary/60",
              )}
            >
              <Plus size={14} />
              Create Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
