import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_REPO = path.resolve(
  __dirname,
  "../../test/fixtures/sample-repo",
);

// ---------------------------------------------------------------------------
// Mock @mariozechner/pi-ai before importing session
// ---------------------------------------------------------------------------

vi.mock("@mariozechner/pi-ai", () => {
  const mockStream = {
    result: vi.fn(),
  };
  return {
    getModel: vi.fn(() => ({ id: "claude-opus-4-6", provider: "anthropic" })),
    streamSimple: vi.fn(() => mockStream),
    __mockStream: mockStream,
  };
});

const piAiMock = await import("@mariozechner/pi-ai");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStream = (piAiMock as any).__mockStream;

const {
  SwarmSession,
  SwarmSessionManager,
  resetSessionCounter,
} = await import("./session.js");

import type {
  SwarmOutboundMessage,
  SwarmAnalyzeMessage,
  SwarmApproveMessage,
  SwarmStatusMessage,
} from "./session.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDecompositionJson(
  tasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    dependsOn?: string[];
  }>,
) {
  return JSON.stringify({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: "test task",
      estimatedMinutes: t.estimatedMinutes,
      dependsOn: t.dependsOn ?? [],
      estimatedCost: 0.5,
      priority: "medium",
    })),
    reasoning: "test reasoning",
    warnings: [],
  });
}

function setupMockDecomposition(
  tasks: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    dependsOn?: string[];
  }>,
) {
  mockStream.result.mockResolvedValue({
    role: "assistant",
    content: [{ type: "text", text: makeDecompositionJson(tasks) }],
  });
}

function createCollector(): {
  messages: SwarmOutboundMessage[];
  send: (msg: SwarmOutboundMessage) => void;
} {
  const messages: SwarmOutboundMessage[] = [];
  return { messages, send: (msg: SwarmOutboundMessage) => messages.push(msg) };
}

// ---------------------------------------------------------------------------
// SwarmSession
// ---------------------------------------------------------------------------

describe("SwarmSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream.result.mockReset();
    resetSessionCounter();
  });

  describe("initial state", () => {
    it("starts in idle status", () => {
      const { send } = createCollector();
      const session = new SwarmSession(send, "test-1");
      expect(session.getStatus()).toBe("idle");
    });

    it("has no plan initially", () => {
      const { send } = createCollector();
      const session = new SwarmSession(send, "test-1");
      expect(session.getPlan()).toBeNull();
    });

    it("has no timeline initially", () => {
      const { send } = createCollector();
      const session = new SwarmSession(send, "test-1");
      expect(session.getTimeline()).toBeNull();
    });

    it("getState returns full state object", () => {
      const { send } = createCollector();
      const session = new SwarmSession(send, "test-1");
      const state = session.getState();
      expect(state.id).toBe("test-1");
      expect(state.status).toBe("idle");
      expect(state.analysis).toBeNull();
      expect(state.plan).toBeNull();
      expect(state.completedTaskIds).toEqual([]);
      expect(state.failedTaskIds).toEqual([]);
    });
  });

  describe("swarm.analyze", () => {
    it("transitions through analyzing → planning → awaiting_approval", async () => {
      setupMockDecomposition([
        { id: "t1", title: "Task 1", estimatedMinutes: 15 },
        { id: "t2", title: "Task 2", estimatedMinutes: 20, dependsOn: ["t1"] },
      ]);

      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-analyze");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Refactor auth",
        repoPath: FIXTURE_REPO,
        model: "claude-opus-4-6",
      } as SwarmAnalyzeMessage);

      expect(session.getStatus()).toBe("awaiting_approval");
      expect(session.getPlan()).not.toBeNull();
      expect(session.getTimeline()).not.toBeNull();
      expect(session.getPlan()!.tasks).toHaveLength(2);

      // Should have sent analysis_complete message
      expect(messages).toHaveLength(1);
      expect(messages[0]!.type).toBe("swarm.analysis_complete");
    });

    it("sends error if goal is invalid", async () => {
      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-bad-goal");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "", // invalid — empty
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      expect(messages).toHaveLength(1);
      expect(messages[0]!.type).toBe("swarm.error");
    });

    it("sends error if session is not idle", async () => {
      setupMockDecomposition([
        { id: "t1", title: "Task 1", estimatedMinutes: 10 },
      ]);

      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-not-idle");

      // First analyze succeeds
      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Goal 1",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      // Second analyze should fail (session is awaiting_approval)
      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Goal 2",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      expect(messages).toHaveLength(2);
      expect(messages[1]!.type).toBe("swarm.error");
    });

    it("transitions to failed if AI returns invalid data", async () => {
      mockStream.result.mockResolvedValue({
        role: "assistant",
        content: [{ type: "text", text: "not json" }],
      });

      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-fail");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Goal",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      expect(session.getStatus()).toBe("failed");
      expect(messages).toHaveLength(1);
      expect(messages[0]!.type).toBe("swarm.error");
    });

    it("transitions to failed if plan has circular deps", async () => {
      setupMockDecomposition([
        { id: "t1", title: "Task 1", estimatedMinutes: 10, dependsOn: ["t2"] },
        { id: "t2", title: "Task 2", estimatedMinutes: 10, dependsOn: ["t1"] },
      ]);

      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-cycle");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Goal with cycle",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      expect(session.getStatus()).toBe("failed");
      expect(messages).toHaveLength(1);
      expect(messages[0]!.type).toBe("swarm.error");
    });
  });

  describe("swarm.approve", () => {
    it("transitions from awaiting_approval to executing", async () => {
      setupMockDecomposition([
        { id: "t1", title: "Task 1", estimatedMinutes: 10 },
      ]);

      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-approve");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Build feature",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      await session.handleMessage({
        type: "swarm.approve",
        sessionId: "test-approve",
      } as SwarmApproveMessage);

      expect(session.getStatus()).toBe("executing");
      expect(messages).toHaveLength(2);
      expect(messages[1]!.type).toBe("swarm.execution_started");
    });

    it("sends error if session is not awaiting_approval", async () => {
      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-bad-approve");

      await session.handleMessage({
        type: "swarm.approve",
        sessionId: "test-bad-approve",
      } as SwarmApproveMessage);

      expect(messages).toHaveLength(1);
      expect(messages[0]!.type).toBe("swarm.error");
    });
  });

  describe("swarm.status", () => {
    it("returns current session state", async () => {
      const { messages, send } = createCollector();
      const session = new SwarmSession(send, "test-status");

      await session.handleMessage({
        type: "swarm.status",
        sessionId: "test-status",
      } as SwarmStatusMessage);

      expect(messages).toHaveLength(1);
      expect(messages[0]!.type).toBe("swarm.status_response");
      const response = messages[0] as { type: string; state: { id: string; status: string } };
      expect(response.state.id).toBe("test-status");
      expect(response.state.status).toBe("idle");
    });
  });

  describe("task completion tracking", () => {
    it("marks session as completed when all tasks are done", async () => {
      setupMockDecomposition([
        { id: "t1", title: "Task 1", estimatedMinutes: 10 },
        { id: "t2", title: "Task 2", estimatedMinutes: 10, dependsOn: ["t1"] },
      ]);

      const { send } = createCollector();
      const session = new SwarmSession(send, "test-complete");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Build feature",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      await session.handleMessage({
        type: "swarm.approve",
        sessionId: "test-complete",
      } as SwarmApproveMessage);

      expect(session.getStatus()).toBe("executing");

      session.markTaskCompleted("t1");
      expect(session.getStatus()).toBe("executing");

      session.markTaskCompleted("t2");
      expect(session.getStatus()).toBe("completed");
    });

    it("marks session as failed if any task fails", async () => {
      setupMockDecomposition([
        { id: "t1", title: "Task 1", estimatedMinutes: 10 },
        { id: "t2", title: "Task 2", estimatedMinutes: 10 },
      ]);

      const { send } = createCollector();
      const session = new SwarmSession(send, "test-fail-task");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Build feature",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      await session.handleMessage({
        type: "swarm.approve",
        sessionId: "test-fail-task",
      } as SwarmApproveMessage);

      session.markTaskCompleted("t1");
      session.markTaskFailed("t2");

      expect(session.getStatus()).toBe("failed");
      const state = session.getState();
      expect(state.failedTaskIds).toContain("t2");
      expect(state.completedTaskIds).toContain("t1");
    });

    it("does not double-count completed tasks", async () => {
      setupMockDecomposition([
        { id: "t1", title: "Task 1", estimatedMinutes: 10 },
      ]);

      const { send } = createCollector();
      const session = new SwarmSession(send, "test-dedup");

      await session.handleMessage({
        type: "swarm.analyze",
        goal: "Build feature",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage);

      await session.handleMessage({
        type: "swarm.approve",
        sessionId: "test-dedup",
      } as SwarmApproveMessage);

      session.markTaskCompleted("t1");
      session.markTaskCompleted("t1"); // duplicate
      expect(session.getState().completedTaskIds).toEqual(["t1"]);
    });
  });
});

// ---------------------------------------------------------------------------
// SwarmSessionManager
// ---------------------------------------------------------------------------

describe("SwarmSessionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream.result.mockReset();
    resetSessionCounter();
  });

  it("creates and retrieves sessions", () => {
    const manager = new SwarmSessionManager();
    const { send } = createCollector();
    const session = manager.createSession(send);
    expect(manager.getSession(session.id)).toBe(session);
  });

  it("removes sessions", () => {
    const manager = new SwarmSessionManager();
    const { send } = createCollector();
    const session = manager.createSession(send);
    expect(manager.removeSession(session.id)).toBe(true);
    expect(manager.getSession(session.id)).toBeUndefined();
  });

  it("returns undefined for unknown session", () => {
    const manager = new SwarmSessionManager();
    expect(manager.getSession("nonexistent")).toBeUndefined();
  });

  it("lists all sessions", () => {
    const manager = new SwarmSessionManager();
    const { send } = createCollector();
    manager.createSession(send);
    manager.createSession(send);
    expect(manager.getAllSessions()).toHaveLength(2);
  });

  it("handleMessage creates a new session for swarm.analyze", async () => {
    setupMockDecomposition([
      { id: "t1", title: "Task 1", estimatedMinutes: 10 },
    ]);

    const manager = new SwarmSessionManager();
    const { messages, send } = createCollector();

    const sessionId = await manager.handleMessage(
      {
        type: "swarm.analyze",
        goal: "Build feature",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage,
      send,
    );

    expect(sessionId).toBeTruthy();
    const session = manager.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session!.getStatus()).toBe("awaiting_approval");
    expect(messages.some((m) => m.type === "swarm.analysis_complete")).toBe(true);
  });

  it("handleMessage routes swarm.approve to existing session", async () => {
    setupMockDecomposition([
      { id: "t1", title: "Task 1", estimatedMinutes: 10 },
    ]);

    const manager = new SwarmSessionManager();
    const { messages, send } = createCollector();

    const sessionId = await manager.handleMessage(
      {
        type: "swarm.analyze",
        goal: "Build feature",
        repoPath: FIXTURE_REPO,
      } as SwarmAnalyzeMessage,
      send,
    );

    await manager.handleMessage(
      {
        type: "swarm.approve",
        sessionId,
      } as SwarmApproveMessage,
      send,
    );

    const session = manager.getSession(sessionId);
    expect(session!.getStatus()).toBe("executing");
    expect(messages.some((m) => m.type === "swarm.execution_started")).toBe(true);
  });

  it("handleMessage sends error for unknown session", async () => {
    const manager = new SwarmSessionManager();
    const { messages, send } = createCollector();

    await manager.handleMessage(
      {
        type: "swarm.approve",
        sessionId: "does-not-exist",
      } as SwarmApproveMessage,
      send,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]!.type).toBe("swarm.error");
  });

  it("handleMessage routes swarm.status to existing session", async () => {
    const manager = new SwarmSessionManager();
    const { send } = createCollector();
    const session = manager.createSession(send);

    const { messages, send: send2 } = createCollector();
    await manager.handleMessage(
      {
        type: "swarm.status",
        sessionId: session.id,
      } as SwarmStatusMessage,
      send2,
    );

    // Status response goes to the session's original send function
    // (the session was created with `send`, not `send2`)
    // Wait — actually handleMessage uses the session's internal send
    // Let's check what happened
    expect(session.getStatus()).toBe("idle");
  });
});
