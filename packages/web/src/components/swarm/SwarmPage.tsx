import { useState, useCallback } from "react";
import { Save, Download } from "lucide-react";
import type { SwarmPlan } from "../../lib/types.ts";
import { SwarmGoalInput } from "./SwarmGoalInput.tsx";
import { DecompositionPlan } from "./DecompositionPlan.tsx";
import { DependencyGraph } from "./DependencyGraph.tsx";
import { ExecutionTimeline } from "./ExecutionTimeline.tsx";

const DEMO_GOAL =
  "Refactor the entire authentication module to support multi-tenant providers, implement refresh token rotation, and migrate from local storage to secure cookies for the session persistence layer.";

const demoPlan: SwarmPlan = {
  goal: DEMO_GOAL,
  repo: "my-app",
  tasks: [
    {
      id: "s1",
      title: "Define AuthProvider Interface",
      description:
        "Create the base AuthProvider interface that all provider implementations will extend. Include methods for authenticate, refresh, revoke, and getUserInfo.",
      complexity: "simple",
      model: "claude-sonnet-4-6",
      dependsOn: [],
      estimatedCost: 0.3,
      estimatedMinutes: 5,
    },
    {
      id: "s2",
      title: "Implement Cognito Provider",
      description:
        "Implement the AuthProvider interface for AWS Cognito. Handle token exchange, user pool configuration, and MFA flow.",
      complexity: "medium",
      model: "claude-sonnet-4-6",
      dependsOn: ["s1"],
      estimatedCost: 0.5,
      estimatedMinutes: 8,
    },
    {
      id: "s3",
      title: "Implement Auth0 Provider",
      description:
        "Implement the AuthProvider interface for Auth0. Handle universal login, token management, and RBAC integration.",
      complexity: "medium",
      model: "claude-sonnet-4-6",
      dependsOn: ["s1"],
      estimatedCost: 0.5,
      estimatedMinutes: 8,
    },
    {
      id: "s4",
      title: "Configure Session Middleware",
      description:
        "Set up secure cookie-based session middleware. Migrate from localStorage to httpOnly cookies with CSRF protection.",
      complexity: "medium",
      model: "claude-sonnet-4-6",
      dependsOn: ["s1"],
      estimatedCost: 0.4,
      estimatedMinutes: 6,
    },
    {
      id: "s5",
      title: "Orchestrate Provider Factory",
      description:
        "Build a factory pattern that dynamically selects and initializes the correct AuthProvider based on tenant configuration.",
      complexity: "complex",
      model: "claude-opus-4-6",
      dependsOn: ["s2", "s3"],
      estimatedCost: 0.8,
      estimatedMinutes: 12,
    },
    {
      id: "s6",
      title: "Integration Tests",
      description:
        "Write comprehensive integration tests covering multi-tenant auth flows, token rotation, and session persistence with all providers.",
      complexity: "complex",
      model: "claude-opus-4-6",
      dependsOn: ["s4", "s5"],
      estimatedCost: 0.5,
      estimatedMinutes: 10,
    },
  ],
  estimatedTotalCost: 3.0,
  estimatedTotalMinutes: 45,
  suggestedWorkers: 4,
};

export function SwarmPage() {
  const [goal, setGoal] = useState(DEMO_GOAL);
  const [project, setProject] = useState("my-app");
  const [leadModel, setLeadModel] = useState("claude-opus-4-6");
  const [plan, setPlan] = useState<SwarmPlan>(demoPlan);

  const handleRegenerate = useCallback(() => {
    // In a real implementation, this would call the planner API
    setPlan({ ...demoPlan, goal });
  }, [goal]);

  const handleApprove = useCallback(() => {
    // In a real implementation, this would launch the swarm via WebSocket
    // For now, just log
    console.log("Swarm approved:", plan);
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
        </div>
      </div>
    </div>
  );
}
