import { randomUUID } from "node:crypto";
import type { PawralDatabase } from "./database.js";
import type { TerminalManager } from "./terminal-manager.js";
import type { GitOps } from "./git-ops.js";
import type { BudgetTracker } from "./budget-tracker.js";
import type { Task, NewTask } from "./types.js";

// ─── TaskScheduler ───────────────────────────────────────────────────────────

export class TaskScheduler {
  constructor(
    private readonly db: PawralDatabase,
    private readonly terminalManager: TerminalManager,
    private readonly gitOps: GitOps,
    private readonly budgetTracker: BudgetTracker,
  ) {}

  /**
   * Add a new task to the queue.
   */
  enqueue(input: Partial<NewTask> & Pick<NewTask, "title" | "prompt" | "repo" | "branch">): Task {
    const settings = this.db.getSettings();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      prompt: input.prompt,
      repo: input.repo,
      branch: input.branch,
      priority: input.priority ?? "medium",
      model: input.model ?? settings.defaultModel,
      agent: input.agent ?? settings.defaultAgent,
      budgetLimit: input.budgetLimit ?? settings.dailyBudget / 10,
      dependsOn: input.dependsOn ?? [],
      status: "queued",
      assignedWorker: null,
      prUrl: null,
      cost: 0,
      tokensIn: 0,
      tokensOut: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      errorMessage: null,
    };
    this.db.createTask(task);
    return task;
  }

  /**
   * Core scheduling loop — find idle workers and assign queued tasks.
   */
  async tick(): Promise<void> {
    // Check global budget
    const budgetCheck = this.budgetTracker.isOverBudget();
    if (budgetCheck.over) return;

    // Find idle workers
    const idleWorkers = this.terminalManager.getIdleWorkers();
    if (idleWorkers.length === 0) return;

    // Find next executable task
    const nextTask = this.db.getNextQueuedTask();
    if (!nextTask) return;

    // Assign to first idle worker
    const worker = idleWorkers[0]!;
    await this.assign(nextTask, worker.id);
  }

  /**
   * Assign a task to a specific worker.
   */
  async assign(task: Task, workerId: string): Promise<void> {
    const worker = this.terminalManager.getWorker(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);

    // Update task in DB
    this.db.updateTask(task.id, {
      status: "running",
      assignedWorker: workerId,
      startedAt: Date.now(),
    });

    // Mark worker as running
    this.terminalManager.setWorkerTask(workerId, {
      ...task,
      status: "running",
      assignedWorker: workerId,
    });

    // Prepare git workspace
    try {
      await this.gitOps.prepare(worker.workspace, task.repo, task.branch);
    } catch {
      // Git prepare may fail in tests or if workspace isn't a git repo yet
    }

    // Build and execute command
    const cmd = this.buildCommand(task);
    this.terminalManager.exec(workerId, cmd);
  }

  /**
   * Mark a task as completed.
   */
  complete(
    taskId: string,
    result: { cost?: number; tokensIn?: number; tokensOut?: number; prUrl?: string },
  ): void {
    this.db.updateTask(taskId, {
      status: "done",
      cost: result.cost ?? 0,
      tokensIn: result.tokensIn ?? 0,
      tokensOut: result.tokensOut ?? 0,
      prUrl: result.prUrl ?? null,
      completedAt: Date.now(),
    });

    // Record budget
    if (result.cost && result.cost > 0) {
      const task = this.db.getTask(taskId);
      this.budgetTracker.record({
        workerId: task?.assignedWorker ?? "unknown",
        taskId,
        cost: result.cost,
        tokensIn: result.tokensIn ?? null,
        tokensOut: result.tokensOut ?? null,
        model: task?.model ?? null,
        recordedAt: Date.now(),
      });
    }
  }

  /**
   * Mark a task as failed.
   */
  fail(taskId: string, errorMessage: string): void {
    this.db.updateTask(taskId, {
      status: "failed",
      errorMessage,
      completedAt: Date.now(),
    });
  }

  /**
   * Build the CLI command for a task.
   */
  buildCommand(task: Task): string {
    const escapedPrompt = task.prompt.replace(/"/g, '\\"');
    if (task.agent === "claude") {
      return `claude -p "${escapedPrompt}" --model ${task.model} --dangerously-skip-permissions`;
    }
    if (task.agent === "codex") {
      return `codex "${escapedPrompt}"`;
    }
    throw new Error(`Unknown agent: ${task.agent}`);
  }
}
