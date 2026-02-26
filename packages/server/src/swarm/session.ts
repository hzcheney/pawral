import { z } from "zod";
import { analyzeCodebase, decompose, validatePlan, optimizeAssignment } from "./planner.js";
import { estimateTimeline } from "./execution-planner.js";
import type {
  CodebaseAnalysis,
  DecompositionResult,
  ExecutionTimeline,
  SwarmGoal,
  SwarmSessionState,
  SwarmStatus,
  TaskPlan,
} from "./types.js";
import { SwarmGoalSchema } from "./types.js";

// ---------------------------------------------------------------------------
// WebSocket message schemas
// ---------------------------------------------------------------------------

export const SwarmAnalyzeMessageSchema = z.object({
  type: z.literal("swarm.analyze"),
  goal: z.string().min(1),
  repoPath: z.string().min(1),
  model: z.string().optional(),
  maxWorkers: z.number().int().positive().optional(),
  budgetLimit: z.number().positive().optional(),
});

export type SwarmAnalyzeMessage = z.infer<typeof SwarmAnalyzeMessageSchema>;

export const SwarmApproveMessageSchema = z.object({
  type: z.literal("swarm.approve"),
  sessionId: z.string().min(1),
});

export type SwarmApproveMessage = z.infer<typeof SwarmApproveMessageSchema>;

export const SwarmStatusMessageSchema = z.object({
  type: z.literal("swarm.status"),
  sessionId: z.string().min(1),
});

export type SwarmStatusMessage = z.infer<typeof SwarmStatusMessageSchema>;

export type SwarmInboundMessage =
  | SwarmAnalyzeMessage
  | SwarmApproveMessage
  | SwarmStatusMessage;

// ---------------------------------------------------------------------------
// Outbound messages (server → client)
// ---------------------------------------------------------------------------

export interface SwarmAnalysisComplete {
  type: "swarm.analysis_complete";
  sessionId: string;
  analysis: CodebaseAnalysis;
  plan: TaskPlan;
  timeline: ExecutionTimeline;
}

export interface SwarmExecutionStarted {
  type: "swarm.execution_started";
  sessionId: string;
  plan: TaskPlan;
  timeline: ExecutionTimeline;
}

export interface SwarmStatusResponse {
  type: "swarm.status_response";
  sessionId: string;
  state: SwarmSessionState;
}

export interface SwarmError {
  type: "swarm.error";
  sessionId: string | null;
  error: string;
}

export type SwarmOutboundMessage =
  | SwarmAnalysisComplete
  | SwarmExecutionStarted
  | SwarmStatusResponse
  | SwarmError;

// ---------------------------------------------------------------------------
// SwarmSession
// ---------------------------------------------------------------------------

let sessionCounter = 0;

function generateSessionId(): string {
  sessionCounter++;
  return `swarm-${Date.now()}-${sessionCounter}`;
}

/** Reset the internal session counter (for testing). */
export function resetSessionCounter(): void {
  sessionCounter = 0;
}

export type SendFn = (message: SwarmOutboundMessage) => void;

export class SwarmSession {
  readonly id: string;
  private status: SwarmStatus = "idle";
  private goal: SwarmGoal | null = null;
  private analysis: CodebaseAnalysis | null = null;
  private plan: TaskPlan | null = null;
  private timeline: ExecutionTimeline | null = null;
  private decompositionResult: DecompositionResult | null = null;
  private completedTaskIds: string[] = [];
  private failedTaskIds: string[] = [];
  private startedAt: number;
  private completedAt: number | null = null;
  private error: string | null = null;
  private send: SendFn;

  constructor(send: SendFn, id?: string) {
    this.id = id ?? generateSessionId();
    this.startedAt = Date.now();
    this.send = send;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  getState(): SwarmSessionState {
    return {
      id: this.id,
      goal: this.goal ?? { goal: "", repoPath: "", model: "claude-opus-4-6", maxWorkers: 6, budgetLimit: 20 },
      status: this.status,
      analysis: this.analysis,
      plan: this.plan,
      timeline: this.timeline,
      completedTaskIds: [...this.completedTaskIds],
      failedTaskIds: [...this.failedTaskIds],
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      error: this.error,
    };
  }

  getStatus(): SwarmStatus {
    return this.status;
  }

  getPlan(): TaskPlan | null {
    return this.plan;
  }

  getTimeline(): ExecutionTimeline | null {
    return this.timeline;
  }

  /**
   * Handle an inbound WebSocket message directed at this session.
   */
  async handleMessage(msg: SwarmInboundMessage): Promise<void> {
    switch (msg.type) {
      case "swarm.analyze":
        await this.handleAnalyze(msg);
        break;
      case "swarm.approve":
        await this.handleApprove(msg);
        break;
      case "swarm.status":
        this.handleStatus();
        break;
    }
  }

  /**
   * Mark a sub-task as completed. Returns the list of ready-to-run task IDs.
   */
  markTaskCompleted(taskId: string): void {
    if (!this.completedTaskIds.includes(taskId)) {
      this.completedTaskIds.push(taskId);
    }
    this.checkCompletion();
  }

  /**
   * Mark a sub-task as failed.
   */
  markTaskFailed(taskId: string): void {
    if (!this.failedTaskIds.includes(taskId)) {
      this.failedTaskIds.push(taskId);
    }
    this.checkCompletion();
  }

  // -------------------------------------------------------------------------
  // Message handlers
  // -------------------------------------------------------------------------

  private async handleAnalyze(msg: SwarmAnalyzeMessage): Promise<void> {
    if (this.status !== "idle") {
      this.sendError(`Session is in '${this.status}' state, cannot analyze`);
      return;
    }

    // Parse goal
    const goalParse = SwarmGoalSchema.safeParse({
      goal: msg.goal,
      repoPath: msg.repoPath,
      model: msg.model,
      maxWorkers: msg.maxWorkers,
      budgetLimit: msg.budgetLimit,
    });

    if (!goalParse.success) {
      this.sendError(`Invalid goal: ${goalParse.error.message}`);
      return;
    }

    this.goal = goalParse.data;
    this.status = "analyzing";

    try {
      // Step 1: Analyze codebase
      this.analysis = await analyzeCodebase(this.goal.repoPath);
      this.status = "planning";

      // Step 2: Decompose via AI
      this.decompositionResult = await decompose(
        this.goal.goal,
        this.goal.repoPath,
        this.goal.model,
      );

      // Step 3: Build plan
      const rawPlan: TaskPlan = {
        id: `plan-${this.id}`,
        goal: this.goal.goal,
        repoPath: this.goal.repoPath,
        tasks: this.decompositionResult.tasks,
        totalEstimatedCost: this.decompositionResult.tasks.reduce(
          (sum, t) => sum + t.estimatedCost,
          0,
        ),
        totalEstimatedMinutes: 0,
        createdAt: Date.now(),
      };

      // Step 4: Validate
      const validation = validatePlan(rawPlan);
      if (!validation.valid) {
        this.status = "failed";
        this.error = `Plan validation failed: ${validation.errors.join("; ")}`;
        this.sendError(this.error);
        return;
      }

      // Step 5: Optimize assignment
      this.plan = optimizeAssignment(rawPlan, this.goal.maxWorkers);

      // Step 6: Compute timeline
      this.timeline = estimateTimeline(this.plan, this.goal.maxWorkers);

      this.status = "awaiting_approval";

      this.send({
        type: "swarm.analysis_complete",
        sessionId: this.id,
        analysis: this.analysis,
        plan: this.plan,
        timeline: this.timeline,
      });
    } catch (err) {
      this.status = "failed";
      this.error = err instanceof Error ? err.message : String(err);
      this.sendError(this.error);
    }
  }

  private async handleApprove(_msg: SwarmApproveMessage): Promise<void> {
    if (this.status !== "awaiting_approval") {
      this.sendError(
        `Cannot approve: session is in '${this.status}' state, expected 'awaiting_approval'`,
      );
      return;
    }

    if (!this.plan || !this.timeline) {
      this.sendError("Cannot approve: no plan or timeline available");
      return;
    }

    this.status = "executing";

    this.send({
      type: "swarm.execution_started",
      sessionId: this.id,
      plan: this.plan,
      timeline: this.timeline,
    });
  }

  private handleStatus(): void {
    this.send({
      type: "swarm.status_response",
      sessionId: this.id,
      state: this.getState(),
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private checkCompletion(): void {
    if (!this.plan) return;
    const allTaskIds = this.plan.tasks.map((t) => t.id);
    const allDone = allTaskIds.every(
      (id) =>
        this.completedTaskIds.includes(id) ||
        this.failedTaskIds.includes(id),
    );
    if (allDone) {
      if (this.failedTaskIds.length > 0) {
        this.status = "failed";
        this.error = `${this.failedTaskIds.length} task(s) failed: ${this.failedTaskIds.join(", ")}`;
      } else {
        this.status = "completed";
      }
      this.completedAt = Date.now();
    }
  }

  private sendError(error: string): void {
    this.send({
      type: "swarm.error",
      sessionId: this.id,
      error,
    });
  }
}

// ---------------------------------------------------------------------------
// SwarmSessionManager — manages multiple concurrent sessions
// ---------------------------------------------------------------------------

export class SwarmSessionManager {
  private sessions: Map<string, SwarmSession> = new Map();

  createSession(send: SendFn): SwarmSession {
    const session = new SwarmSession(send);
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): SwarmSession | undefined {
    return this.sessions.get(id);
  }

  removeSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  getAllSessions(): SwarmSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Route an inbound WebSocket message to the correct session.
   * For `swarm.analyze`, creates a new session automatically.
   */
  async handleMessage(
    msg: SwarmInboundMessage,
    send: SendFn,
  ): Promise<string> {
    if (msg.type === "swarm.analyze") {
      const session = this.createSession(send);
      await session.handleMessage(msg);
      return session.id;
    }

    // For approve/status, look up the session by ID
    const sessionId = "sessionId" in msg ? msg.sessionId : undefined;
    if (!sessionId) {
      send({
        type: "swarm.error",
        sessionId: null,
        error: "Missing sessionId in message",
      });
      return "";
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      send({
        type: "swarm.error",
        sessionId,
        error: `Session '${sessionId}' not found`,
      });
      return sessionId;
    }

    await session.handleMessage(msg);
    return sessionId;
  }
}
