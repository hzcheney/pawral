import clsx from "clsx";
import {
  Sparkles,
  Bug,
  RefreshCw,
  FileText,
  Wrench,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  GitMerge,
  Square,
} from "lucide-react";
import type { PullRequest, PRStatus } from "../../lib/types.ts";

// --- helpers -----------------------------------------------------------------

type PRType = "feat" | "fix" | "refactor" | "docs" | "chore";

function inferPRType(title: string): PRType {
  const lower = title.toLowerCase();
  if (lower.startsWith("feat") || lower.includes("implement") || lower.includes("add")) {
    return "feat";
  }
  if (lower.startsWith("fix") || lower.includes("bug") || lower.includes("resolve")) {
    return "fix";
  }
  if (lower.startsWith("refactor") || lower.includes("refactor")) {
    return "refactor";
  }
  if (lower.startsWith("docs") || lower.includes("readme") || lower.includes("documentation")) {
    return "docs";
  }
  return "chore";
}

const TYPE_CONFIG: Record<PRType, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string }> = {
  feat: { icon: Sparkles, color: "text-accent-green", label: "feat" },
  fix: { icon: Bug, color: "text-accent-blue", label: "fix" },
  refactor: { icon: RefreshCw, color: "text-accent-purple", label: "refactor" },
  docs: { icon: FileText, color: "text-text-secondary", label: "docs" },
  chore: { icon: Wrench, color: "text-text-secondary", label: "chore" },
};

interface TestBadgeConfig {
  label: string;
  className: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

function getTestBadge(testsPassing: boolean | null, status: PRStatus): TestBadgeConfig {
  if (status === "merged") {
    return {
      label: "Merged",
      className: "bg-text-muted/20 text-text-secondary",
      icon: GitMerge,
    };
  }
  if (testsPassing === true) {
    return {
      label: "Passed",
      className: "bg-accent-green/15 text-accent-green",
      icon: CheckCircle2,
    };
  }
  if (testsPassing === false) {
    return {
      label: "Failed",
      className: "bg-accent-red/15 text-accent-red",
      icon: XCircle,
    };
  }
  return {
    label: "Running",
    className: "bg-accent-yellow/15 text-accent-yellow",
    icon: Loader2,
  };
}

function getActionButton(status: PRStatus): { label: string; className: string } {
  switch (status) {
    case "open":
      return {
        label: "Review",
        className: "border-accent-blue text-accent-blue hover:bg-accent-blue/10",
      };
    case "conflict":
      return {
        label: "Resolve",
        className: "border-accent-red text-accent-red hover:bg-accent-red/10",
      };
    case "failed":
      return {
        label: "Resolve",
        className: "border-accent-red text-accent-red hover:bg-accent-red/10",
      };
    case "merged":
      return {
        label: "View",
        className: "border-border-default text-text-secondary hover:bg-bg-tertiary",
      };
  }
}

// --- props -------------------------------------------------------------------

interface PRCardProps {
  pr: PullRequest;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

// --- component ---------------------------------------------------------------

export function PRCard({ pr, selected, onToggleSelect }: PRCardProps) {
  const prType = inferPRType(pr.title);
  const typeConfig = TYPE_CONFIG[prType];
  const TypeIcon = typeConfig.icon;
  const testBadge = getTestBadge(pr.testsPassing, pr.status);
  const TestIcon = testBadge.icon;
  const action = getActionButton(pr.status);

  return (
    <div
      className={clsx(
        "flex items-center gap-3 border-b border-border-muted px-4 py-3 transition-colors hover:bg-bg-tertiary",
        selected && "bg-bg-tertiary",
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggleSelect?.(pr.id)}
        className="shrink-0 text-text-muted transition-colors hover:text-text-secondary"
      >
        <Square
          size={16}
          className={clsx(selected && "fill-accent-blue text-accent-blue")}
        />
      </button>

      {/* Type icon */}
      <div className={clsx("shrink-0", typeConfig.color)}>
        <TypeIcon size={18} />
      </div>

      {/* Middle: title + repo info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{pr.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
          <span>{pr.repo}</span>
          <span className="text-text-muted">/</span>
          <span className="font-mono text-text-muted">{pr.branch}</span>
          <span className="text-text-muted">-&gt;</span>
          <span className="font-mono text-text-muted">{pr.baseBranch}</span>
          {pr.labels.length > 0 && (
            <div className="flex items-center gap-1">
              {pr.labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-accent-purple/15 px-1.5 py-0.5 text-[10px] text-accent-purple"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Test status badge */}
      <span
        className={clsx(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
          testBadge.className,
        )}
      >
        <TestIcon size={12} />
        {testBadge.label}
      </span>

      {/* Additions / deletions */}
      <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs">
        <span className="text-accent-green">+{pr.additions}</span>
        <span className="text-accent-red">-{pr.deletions}</span>
      </div>

      {/* Files changed */}
      <span className="shrink-0 text-xs text-text-muted">
        {pr.filesChanged} files
      </span>

      {/* Action button */}
      <a
        href={pr.url}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          action.className,
        )}
      >
        {action.label}
        <ExternalLink size={12} />
      </a>
    </div>
  );
}
