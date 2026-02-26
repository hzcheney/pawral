import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import simpleGit from "simple-git";

// ─── GitOps ──────────────────────────────────────────────────────────────────

export class GitOps {
  /**
   * Initialize workspace — clone if needed.
   */
  async setup(workspace: string, repoUrl: string): Promise<void> {
    if (!existsSync(path.join(workspace, ".git"))) {
      const git = simpleGit();
      await git.clone(repoUrl, workspace);
    }
  }

  /**
   * Prepare workspace for a new task — fetch, checkout main, pull, create branch.
   */
  async prepare(workspace: string, _repoUrl: string, branchName: string): Promise<void> {
    const git = simpleGit(workspace);
    await git.fetch("origin");
    await git.checkout("main");
    await git.pull("origin", "main");
    await git.checkoutLocalBranch(branchName);
  }

  /**
   * Finalize task — add, commit, push, create PR.
   * Returns the PR URL.
   */
  async finalize(
    workspace: string,
    commitMsg: string,
    branchName: string,
  ): Promise<string> {
    const git = simpleGit(workspace);
    await git.add(".");
    await git.commit(commitMsg);
    await git.push("origin", branchName);

    // Create PR using gh CLI
    const prUrl = execSync(
      `gh pr create --title "${commitMsg.replace(/"/g, '\\"')}" --body "Created by Pawral" --label pawral`,
      { cwd: workspace, encoding: "utf-8" },
    );
    return prUrl.trim();
  }

  /**
   * Check if merging origin/main would cause conflicts.
   */
  async checkConflict(workspace: string): Promise<boolean> {
    const git = simpleGit(workspace);
    try {
      await git.raw(["merge", "--no-commit", "--no-ff", "origin/main"]);
      await git.raw(["merge", "--abort"]);
      return false;
    } catch {
      try {
        await git.raw(["merge", "--abort"]);
      } catch {
        // ignore abort failure
      }
      return true;
    }
  }

  /**
   * Get git status for a workspace.
   */
  async getStatus(
    workspace: string,
  ): Promise<{ files: Array<{ path: string }>; modified: string[]; not_added: string[] }> {
    const git = simpleGit(workspace);
    const status = await git.status();
    return {
      files: status.files as Array<{ path: string }>,
      modified: status.modified,
      not_added: status.not_added,
    };
  }
}
