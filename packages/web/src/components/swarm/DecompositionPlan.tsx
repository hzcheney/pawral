import { RefreshCw, Info, CheckCircle2, Circle, Rocket } from "lucide-react";
import clsx from "clsx";
import type { SwarmPlan } from "../../lib/types.ts";

interface DecompositionPlanProps {
  plan: SwarmPlan;
  onRegenerate?: () => void;
  onApprove?: () => void;
}

const COMPLEXITY_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  simple: {
    bg: "bg-accent-green/15",
    text: "text-accent-green",
    label: "SIMPLE",
  },
  medium: {
    bg: "bg-accent-yellow/15",
    text: "text-accent-yellow",
    label: "MEDIUM",
  },
  complex: {
    bg: "bg-accent-red/15",
    text: "text-accent-red",
    label: "COMPLEX",
  },
};

export function DecompositionPlan({
  plan,
  onRegenerate,
  onApprove,
}: DecompositionPlanProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Decomposition Plan
        </span>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <RefreshCw size={12} />
            Re-generate
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          {plan.tasks.map((task, index) => {
            const complexity = COMPLEXITY_STYLES[task.complexity];
            const hasDeps = task.dependsOn.length > 0;

            return (
              <div
                key={task.id}
                className="group rounded-md border border-border-muted bg-bg-primary p-3 transition-colors hover:border-border-default"
              >
                {/* Top row: number + title + badge */}
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-2">
                    <Circle
                      size={16}
                      className="shrink-0 text-text-muted"
                    />
                    <span className="font-mono text-xs text-text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="flex-1 text-sm font-medium text-text-primary">
                    {task.title}
                  </span>
                  <span
                    className={clsx(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      complexity.bg,
                      complexity.text
                    )}
                  >
                    {complexity.label}
                  </span>
                </div>

                {/* Bottom row: details */}
                <div className="mt-1.5 flex items-center gap-3 pl-8 text-[11px] text-text-muted">
                  {hasDeps && (
                    <span className="flex items-center gap-1">
                      <Info size={10} />
                      Depends on{" "}
                      {task.dependsOn
                        .map((dep) => {
                          const depTask = plan.tasks.find(
                            (t) => t.id === dep
                          );
                          return depTask
                            ? `#${plan.tasks.indexOf(depTask) + 1}`
                            : dep;
                        })
                        .join(", ")}
                    </span>
                  )}
                  <span className="font-mono">
                    {task.estimatedMinutes} min
                  </span>
                  <span className="font-mono">
                    ${task.estimatedCost.toFixed(2)}
                  </span>
                  <span className="font-mono text-text-muted/70">
                    {task.model}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div className="border-t border-border-default px-4 py-3">
        <div className="mb-3 flex items-center justify-between text-xs text-text-secondary">
          <span className="font-mono">
            {plan.tasks.length} Tasks | ${plan.estimatedTotalCost.toFixed(2)} |
            ~{plan.estimatedTotalMinutes} min
          </span>
          <span className="text-text-muted">
            {plan.suggestedWorkers} workers recommended
          </span>
        </div>

        {/* Approve button */}
        {onApprove && (
          <button
            onClick={onApprove}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-bg-primary transition-colors hover:bg-accent-green/90"
          >
            <Rocket size={16} />
            Approve & Launch Swarm
          </button>
        )}
      </div>
    </div>
  );
}
