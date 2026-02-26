import { useState } from "react";
import { ChevronDown, RefreshCw, ExternalLink } from "lucide-react";
import clsx from "clsx";

const DEMO_GOAL =
  "Refactor the entire authentication module to support multi-tenant providers, implement refresh token rotation, and migrate from local storage to secure cookies for the session persistence layer.";

const PROJECTS = ["my-app", "api-server", "web-client", "infra", "docs"];
const MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku",
  "gpt-4o",
  "gemini-2.0-flash",
];

interface SwarmGoalInputProps {
  goal: string;
  onGoalChange: (goal: string) => void;
  project: string;
  onProjectChange: (project: string) => void;
  leadModel: string;
  onLeadModelChange: (model: string) => void;
  onRegenerate: () => void;
}

export function SwarmGoalInput({
  goal,
  onGoalChange,
  project,
  onProjectChange,
  leadModel,
  onLeadModelChange,
  onRegenerate,
}: SwarmGoalInputProps) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Swarm Goal
          </span>
        </div>
        <button className="flex items-center gap-1 text-xs text-accent-blue transition-colors hover:text-accent-blue/80">
          <ExternalLink size={12} />
          Detail
        </button>
      </div>

      {/* Textarea */}
      <textarea
        value={goal}
        onChange={(e) => onGoalChange(e.target.value)}
        placeholder="Describe the high-level goal for the swarm..."
        rows={3}
        className="mb-3 w-full resize-none rounded-md border border-border-default bg-bg-primary px-3 py-2 font-sans text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
      />

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Project dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setProjectOpen(!projectOpen);
              setModelOpen(false);
            }}
            className="flex items-center gap-2 rounded-md border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-default hover:text-text-primary"
          >
            <span className="text-text-muted">Project:</span>
            <span className="text-text-primary">{project}</span>
            <ChevronDown size={12} />
          </button>
          {projectOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border-default bg-bg-secondary py-1 shadow-lg">
              {PROJECTS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onProjectChange(p);
                    setProjectOpen(false);
                  }}
                  className={clsx(
                    "block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-bg-tertiary",
                    p === project
                      ? "text-accent-blue"
                      : "text-text-secondary"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setModelOpen(!modelOpen);
              setProjectOpen(false);
            }}
            className="flex items-center gap-2 rounded-md border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-default hover:text-text-primary"
          >
            <span className="text-text-muted">Lead Model:</span>
            <span className="text-text-primary">{leadModel}</span>
            <ChevronDown size={12} />
          </button>
          {modelOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-md border border-border-default bg-bg-secondary py-1 shadow-lg">
              {MODELS.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    onLeadModelChange(m);
                    setModelOpen(false);
                  }}
                  className={clsx(
                    "block w-full px-3 py-1.5 text-left font-mono text-xs transition-colors hover:bg-bg-tertiary",
                    m === leadModel
                      ? "text-accent-blue"
                      : "text-text-secondary"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Re-generate button */}
        <button
          onClick={onRegenerate}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border-default bg-bg-primary px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent-blue hover:text-accent-blue"
        >
          <RefreshCw size={12} />
          Re-generate
        </button>
      </div>
    </div>
  );
}

SwarmGoalInput.DEMO_GOAL = DEMO_GOAL;
