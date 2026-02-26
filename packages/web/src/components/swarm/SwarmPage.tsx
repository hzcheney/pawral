import { useState, useCallback } from "react";
import { Save, Download } from "lucide-react";
import type { SwarmPlan } from "../../lib/types.ts";
import { SwarmGoalInput } from "./SwarmGoalInput.tsx";
import { DecompositionPlan } from "./DecompositionPlan.tsx";
import { DependencyGraph } from "./DependencyGraph.tsx";
import { ExecutionTimeline } from "./ExecutionTimeline.tsx";

export function SwarmPage() {
  const [goal, setGoal] = useState("");
  const [project, setProject] = useState("");
  const [leadModel, setLeadModel] = useState("claude-opus-4-6");
  const [plan, setPlan] = useState<SwarmPlan | null>(null);

  const handleRegenerate = useCallback(() => {
    // In a real implementation, this would call the planner API
    // For now, no-op without demo data
    console.log("Regenerate plan for:", goal);
  }, [goal]);

  const handleApprove = useCallback(() => {
    // In a real implementation, this would launch the swarm via WebSocket
    if (plan) {
      console.log("Swarm approved:", plan);
    }
  }, [plan]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-default bg-bg-secondary px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-text-primary">
            Swarm Mode
          </h1>
          <span className="rounded bg-accent-purple/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-purple">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-default hover:text-text-primary">
            <Save size={12} />
            Save Draft
          </button>
          <button className="flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-default hover:text-text-primary">
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[1400px] space-y-4">
          {/* Goal Input */}
          <SwarmGoalInput
            goal={goal}
            onGoalChange={setGoal}
            project={project}
            onProjectChange={setProject}
            leadModel={leadModel}
            onLeadModelChange={setLeadModel}
            onRegenerate={handleRegenerate}
          />

          {plan ? (
            <>
              {/* Main area: Decomposition (left) + Dependency Graph (right) */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <DecompositionPlan
                    plan={plan}
                    onRegenerate={handleRegenerate}
                    onApprove={handleApprove}
                  />
                </div>
                <div className="lg:col-span-2">
                  <DependencyGraph plan={plan} />
                </div>
              </div>

              {/* Execution Timeline */}
              <ExecutionTimeline plan={plan} />
            </>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-border-default bg-bg-secondary py-16 text-sm text-text-muted">
              Enter a goal above and click Decompose to generate a plan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
