import { useState, useMemo } from "react";
import clsx from "clsx";
import {
  GitMerge,
  ChevronLeft,
  ChevronRight,
  ArrowDownWideNarrow,
} from "lucide-react";
import type { PullRequest, PRStatus } from "../../lib/types.ts";
import { PRCard } from "./PRCard.tsx";

// --- demo data ---------------------------------------------------------------

const DEMO_PRS: PullRequest[] = [
  {
    id: "pr-1",
    title: "feat: Implement Google OAuth provider",
    url: "https://github.com/org/my-app/pull/142",
    repo: "my-app",
    branch: "swarm/task-001-oauth",
    baseBranch: "main",
    status: "open",
    workerId: "worker-1",
    taskId: "task-001",
    additions: 142,
    deletions: 23,
    filesChanged: 8,
    testsPassing: true,
    createdAt: Date.now() - 3600000,
    mergedAt: null,
    labels: ["pawral", "auth"],
  },
  {
    id: "pr-2",
    title: "feat: Add SAML authentication support",
    url: "https://github.com/org/my-app/pull/143",
    repo: "my-app",
    branch: "swarm/task-002-saml",
    baseBranch: "main",
    status: "open",
    workerId: "worker-2",
    taskId: "task-002",
    additions: 310,
    deletions: 45,
    filesChanged: 12,
    testsPassing: null,
    createdAt: Date.now() - 2400000,
    mergedAt: null,
    labels: ["pawral", "auth"],
  },
  {
    id: "pr-3",
    title: "fix: Resolve connection pool exhaustion under load",
    url: "https://github.com/org/backend-api/pull/87",
    repo: "backend-api",
    branch: "swarm/task-004-db",
    baseBranch: "main",
    status: "merged",
    workerId: "worker-3",
    taskId: "task-004",
    additions: 56,
    deletions: 12,
    filesChanged: 3,
    testsPassing: true,
    createdAt: Date.now() - 86400000,
    mergedAt: Date.now() - 43200000,
    labels: ["pawral"],
  },
  {
    id: "pr-4",
    title: "refactor: Extract rate limiting into middleware",
    url: "https://github.com/org/backend-api/pull/88",
    repo: "backend-api",
    branch: "swarm/task-006-ratelimit",
    baseBranch: "main",
    status: "conflict",
    workerId: "worker-3",
    taskId: "task-006",
    additions: 198,
    deletions: 67,
    filesChanged: 9,
    testsPassing: true,
    createdAt: Date.now() - 7200000,
    mergedAt: null,
    labels: ["pawral"],
  },
  {
    id: "pr-5",
    title: "docs: Fix typos in README documentation",
    url: "https://github.com/org/docs/pull/42",
    repo: "docs",
    branch: "swarm/task-005-readme",
    baseBranch: "main",
    status: "merged",
    workerId: "worker-4",
    taskId: "task-005",
    additions: 5,
    deletions: 5,
    filesChanged: 1,
    testsPassing: true,
    createdAt: Date.now() - 172800000,
    mergedAt: Date.now() - 86400000,
    labels: ["pawral"],
  },
  {
    id: "pr-6",
    title: "chore: Update CI pipeline for faster builds",
    url: "https://github.com/org/infra/pull/31",
    repo: "infra",
    branch: "swarm/task-007-ci",
    baseBranch: "main",
    status: "failed",
    workerId: "worker-5",
    taskId: "task-007",
    additions: 42,
    deletions: 18,
    filesChanged: 4,
    testsPassing: false,
    createdAt: Date.now() - 5400000,
    mergedAt: null,
    labels: ["pawral"],
  },
];

// --- types -------------------------------------------------------------------

type FilterTab = "all" | PRStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "merged", label: "Merged" },
  { key: "conflict", label: "Conflict" },
];

const ITEMS_PER_PAGE = 10;

// --- component ---------------------------------------------------------------

export function PRList() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Filter PRs
  const filteredPRs = useMemo(() => {
    if (activeTab === "all") {
      return DEMO_PRS;
    }
    return DEMO_PRS.filter((pr) => pr.status === activeTab);
  }, [activeTab]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPRs.length / ITEMS_PER_PAGE));
  const paginatedPRs = filteredPRs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Count per status
  const counts = useMemo(() => {
    const result: Record<FilterTab, number> = { all: DEMO_PRS.length, open: 0, merged: 0, conflict: 0, failed: 0 };
    for (const pr of DEMO_PRS) {
      result[pr.status] = (result[pr.status] ?? 0) + 1;
    }
    return result;
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const mergeablePRs = filteredPRs.filter(
    (pr) => pr.status === "open" && pr.testsPassing === true,
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">PR Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Pull requests created by Pawral AI coding agents
          </p>
        </div>

        <button
          disabled={mergeablePRs.length === 0}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            mergeablePRs.length > 0
              ? "bg-accent-green text-white hover:bg-accent-green/90"
              : "cursor-not-allowed bg-bg-tertiary text-text-muted",
          )}
        >
          <GitMerge size={16} />
          Batch Merge ({mergeablePRs.length})
        </button>
      </div>

      {/* Filter tabs + sort */}
      <div className="mb-4 flex items-center justify-between border-b border-border-default">
        <div className="flex">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setCurrentPage(1);
              }}
              className={clsx(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === key
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {label}
              <span className="ml-1.5 text-xs text-text-muted">
                {counts[key] ?? 0}
              </span>
              {activeTab === key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-accent-blue" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 pb-2 text-xs text-text-muted">
          <ArrowDownWideNarrow size={14} />
          <span>SORTED BY: NEWEST FIRST</span>
        </div>
      </div>

      {/* PR list */}
      <div className="overflow-hidden rounded-lg border border-border-default bg-bg-secondary">
        {paginatedPRs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-text-muted">
            No pull requests found
          </div>
        ) : (
          paginatedPRs.map((pr) => (
            <PRCard
              key={pr.id}
              pr={pr}
              selected={selectedIds.has(pr.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredPRs.length)} of{" "}
            {filteredPRs.length}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={clsx(
                "rounded-md p-1.5 transition-colors",
                currentPage === 1
                  ? "cursor-not-allowed text-text-muted"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
              )}
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  currentPage === page
                    ? "bg-accent-blue/15 text-accent-blue"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
                )}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={clsx(
                "rounded-md p-1.5 transition-colors",
                currentPage === totalPages
                  ? "cursor-not-allowed text-text-muted"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
