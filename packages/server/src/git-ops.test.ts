import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock simple-git ──────────────────────────────────────────────────────────

const mockGitInstance = {
  clone: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn().mockResolvedValue(undefined),
  pull: vi.fn().mockResolvedValue(undefined),
  checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  status: vi.fn().mockResolvedValue({ files: [], modified: [], not_added: [] }),
  raw: vi.fn().mockResolvedValue(""),
};

vi.mock("simple-git", () => ({
  default: vi.fn(() => mockGitInstance),
}));

// ─── Mock node:child_process ──────────────────────────────────────────────────

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => "https://github.com/org/repo/pull/42\n"),
}));

// ─── Mock node:fs ─────────────────────────────────────────────────────────────

let fsExistsSyncReturn = false;

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => fsExistsSyncReturn),
  };
});

// ─── Imports AFTER mocks ──────────────────────────────────────────────────────

import { GitOps } from "./git-ops.js";
import simpleGit from "simple-git";

describe("GitOps", () => {
  let git: GitOps;

  beforeEach(() => {
    vi.clearAllMocks();
    fsExistsSyncReturn = false;
    git = new GitOps();
  });

  describe("setup", () => {
    it("clones repo if .git does not exist", async () => {
      fsExistsSyncReturn = false;
      await git.setup("/tmp/workspace", "https://github.com/org/repo.git");
      const gitFn = simpleGit as unknown as ReturnType<typeof vi.fn>;
      // simpleGit() is called with no args for clone, then does .clone()
      expect(mockGitInstance.clone).toHaveBeenCalledWith(
        "https://github.com/org/repo.git",
        "/tmp/workspace"
      );
    });

    it("skips clone if .git already exists", async () => {
      fsExistsSyncReturn = true;
      await git.setup("/tmp/workspace", "https://github.com/org/repo.git");
      expect(mockGitInstance.clone).not.toHaveBeenCalled();
    });
  });

  describe("prepare", () => {
    it("fetches, checks out main, pulls, and creates new branch", async () => {
      await git.prepare("/tmp/workspace", "https://github.com/org/repo", "swarm/task-001");
      expect(mockGitInstance.fetch).toHaveBeenCalledWith("origin");
      expect(mockGitInstance.checkout).toHaveBeenCalledWith("main");
      expect(mockGitInstance.pull).toHaveBeenCalledWith("origin", "main");
      expect(mockGitInstance.checkoutLocalBranch).toHaveBeenCalledWith("swarm/task-001");
    });
  });

  describe("finalize", () => {
    it("adds, commits, pushes, and creates PR", async () => {
      const prUrl = await git.finalize(
        "/tmp/workspace",
        "feat: add OAuth support",
        "swarm/task-001"
      );
      expect(mockGitInstance.add).toHaveBeenCalledWith(".");
      expect(mockGitInstance.commit).toHaveBeenCalledWith("feat: add OAuth support");
      expect(mockGitInstance.push).toHaveBeenCalledWith("origin", "swarm/task-001");
      expect(prUrl).toContain("github.com");
    });
  });

  describe("checkConflict", () => {
    it("returns false when no conflicts", async () => {
      mockGitInstance.raw.mockResolvedValueOnce("");
      const hasConflict = await git.checkConflict("/tmp/workspace");
      expect(hasConflict).toBe(false);
    });

    it("returns true when merge conflicts exist", async () => {
      mockGitInstance.raw
        .mockRejectedValueOnce(new Error("merge conflict"))
        .mockResolvedValueOnce(""); // merge --abort
      const hasConflict = await git.checkConflict("/tmp/workspace");
      expect(hasConflict).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("returns git status", async () => {
      mockGitInstance.status.mockResolvedValueOnce({
        files: [{ path: "src/auth.ts" }],
        modified: ["src/auth.ts"],
        not_added: [],
      });
      const status = await git.getStatus("/tmp/workspace");
      expect(status.files).toHaveLength(1);
    });
  });
});
