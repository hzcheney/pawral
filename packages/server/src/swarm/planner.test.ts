import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_REPO = path.resolve(
  __dirname,
  "../../test/fixtures/sample-repo",
);

// ---------------------------------------------------------------------------
// Mock @mariozechner/pi-ai before importing planner
// ---------------------------------------------------------------------------

vi.mock("@mariozechner/pi-ai", () => {
  const mockStream = {
    result: vi.fn(),
  };
  return {
    getModel: vi.fn(() => ({ id: "claude-opus-4-6", provider: "anthropic" })),
    streamSimple: vi.fn(() => mockStream),
    // Re-export mockStream so tests can configure it
    __mockStream: mockStream,
  };
});

// Dynamic import so the mock is in place before planner loads
const { analyzeCodebase, decompose, validatePlan, optimizeAssignment } =
  await import("./planner.js");

const piAiMock = await import("@mariozechner/pi-ai");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStream = (piAiMock as any).__mockStream;

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

// ---------------------------------------------------------------------------
// analyzeCodebase
// ---------------------------------------------------------------------------

describe("analyzeCodebase", () => {
  it("reads the fixture repo and detects package.json", async () => {
    const analysis = await analyzeCodebase(FIXTURE_REPO);
    expect(analysis.packageJson).not.toBeNull();
    expect(analysis.packageJson?.name).toBe("sample-repo");
  });

  it("lists top-level directories", async () => {
    const analysis = await analyzeCodebase(FIXTURE_REPO);
    expect(analysis.topLevelDirs).toContain("src");
  });

  it("finds key source files", async () => {
    const analysis = await analyzeCodebase(FIXTURE_REPO);
    const filePaths = analysis.keyFiles.map((f) => f.path);
    expect(filePaths.some((p) => p.includes("auth"))).toBe(true);
    expect(filePaths.some((p) => p.includes("api"))).toBe(true);
  });

  it("returns a non-empty files list", async () => {
    const analysis = await analyzeCodebase(FIXTURE_REPO);
    expect(analysis.files.length).toBeGreaterThan(0);
  });

  it("detects language/framework from package.json", async () => {
    const analysis = await analyzeCodebase(FIXTURE_REPO);
    expect(analysis.language).toBeTruthy();
  });

  it("throws for a path that does not exist", async () => {
    await expect(analyzeCodebase("/tmp/__nonexistent__")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// decompose
// ---------------------------------------------------------------------------

describe("decompose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream.result.mockReset();
  });

  it("returns a DecompositionResult with tasks parsed from AI response", async () => {
    mockStream.result.mockResolvedValue({
      role: "assistant",
      content: [
        {
          type: "text",
          text: makeDecompositionJson([
            { id: "t1", title: "Define interfaces", estimatedMinutes: 30 },
            {
              id: "t2",
              title: "Implement OAuth",
              estimatedMinutes: 60,
              dependsOn: ["t1"],
            },
          ]),
        },
      ],
    });

    const result = await decompose(
      "Refactor auth to support OAuth",
      FIXTURE_REPO,
      "claude-opus-4-6",
    );

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]!.id).toBe("t1");
    expect(result.tasks[1]!.id).toBe("t2");
    expect(result.tasks[1]!.dependsOn).toContain("t1");
  });

  it("calls streamSimple with the goal in the context", async () => {
    mockStream.result.mockResolvedValue({
      role: "assistant",
      content: [
        {
          type: "text",
          text: makeDecompositionJson([
            { id: "t1", title: "Task 1", estimatedMinutes: 10 },
          ]),
        },
      ],
    });

    await decompose("My special goal", FIXTURE_REPO, "claude-opus-4-6");

    const { streamSimple } = piAiMock;
    expect(streamSimple).toHaveBeenCalledOnce();
    // The context passed to streamSimple should contain the goal
    const [, ctx] = (
      streamSimple as ReturnType<typeof vi.fn>
    ).mock.calls[0] as unknown[];
    const context = ctx as { messages: Array<{ content: string }> };
    const userMsg = context.messages.find((m) =>
      m.content.includes("My special goal"),
    );
    expect(userMsg).toBeTruthy();
  });

  it("throws if AI returns invalid JSON", async () => {
    mockStream.result.mockResolvedValue({
      role: "assistant",
      content: [{ type: "text", text: "not valid json at all" }],
    });

    await expect(
      decompose("goal", FIXTURE_REPO, "claude-opus-4-6"),
    ).rejects.toThrow();
  });

  it("throws if AI returns JSON not matching DecompositionResult schema", async () => {
    mockStream.result.mockResolvedValue({
      role: "assistant",
      content: [{ type: "text", text: '{"wrong": "shape"}' }],
    });

    await expect(
      decompose("goal", FIXTURE_REPO, "claude-opus-4-6"),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validatePlan
// ---------------------------------------------------------------------------

describe("validatePlan", () => {
  it("returns valid=true for a simple valid plan", () => {
    const result = validatePlan({
      id: "p1",
      goal: "do stuff",
      repoPath: "/tmp/repo",
      tasks: [
        {
          id: "t1",
          title: "Task 1",
          description: "",
          estimatedMinutes: 30,
          dependsOn: [],
          estimatedCost: 0.5,
          priority: "medium",
        },
        {
          id: "t2",
          title: "Task 2",
          description: "",
          estimatedMinutes: 45,
          dependsOn: ["t1"],
          estimatedCost: 0.5,
          priority: "medium",
        },
      ],
      totalEstimatedCost: 1,
      totalEstimatedMinutes: 75,
      createdAt: Date.now(),
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid=false and an error if a circular dep is detected", () => {
    const result = validatePlan({
      id: "p1",
      goal: "do stuff",
      repoPath: "/tmp/repo",
      tasks: [
        {
          id: "t1",
          title: "A",
          description: "",
          estimatedMinutes: 10,
          dependsOn: ["t2"], // circular
          estimatedCost: 0,
          priority: "medium",
        },
        {
          id: "t2",
          title: "B",
          description: "",
          estimatedMinutes: 10,
          dependsOn: ["t1"], // circular
          estimatedCost: 0,
          priority: "medium",
        },
      ],
      totalEstimatedCost: 0,
      totalEstimatedMinutes: 20,
      createdAt: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/circular|cycle/i);
  });

  it("returns valid=false if a task references a dep that does not exist", () => {
    const result = validatePlan({
      id: "p1",
      goal: "do stuff",
      repoPath: "/tmp/repo",
      tasks: [
        {
          id: "t1",
          title: "A",
          description: "",
          estimatedMinutes: 10,
          dependsOn: ["ghost"], // ghost doesn't exist
          estimatedCost: 0,
          priority: "medium",
        },
      ],
      totalEstimatedCost: 0,
      totalEstimatedMinutes: 10,
      createdAt: Date.now(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("flags tasks with unreasonably high estimated cost", () => {
    const result = validatePlan({
      id: "p1",
      goal: "do stuff",
      repoPath: "/tmp/repo",
      tasks: [
        {
          id: "t1",
          title: "A",
          description: "",
          estimatedMinutes: 10,
          dependsOn: [],
          estimatedCost: 500, // unreasonable
          priority: "medium",
        },
      ],
      totalEstimatedCost: 500,
      totalEstimatedMinutes: 10,
      createdAt: Date.now(),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// optimizeAssignment
// ---------------------------------------------------------------------------

describe("optimizeAssignment", () => {
  it("returns a plan with the same tasks", () => {
    const plan = {
      id: "p1",
      goal: "g",
      repoPath: "/tmp",
      tasks: [
        {
          id: "t1",
          title: "A",
          description: "",
          estimatedMinutes: 10,
          dependsOn: [],
          estimatedCost: 0,
          priority: "medium" as const,
        },
        {
          id: "t2",
          title: "B",
          description: "",
          estimatedMinutes: 10,
          dependsOn: [],
          estimatedCost: 0,
          priority: "medium" as const,
        },
      ],
      totalEstimatedCost: 0,
      totalEstimatedMinutes: 10,
      createdAt: Date.now(),
    };
    const optimized = optimizeAssignment(plan, 4);
    // All original tasks preserved
    const origIds = plan.tasks.map((t) => t.id).sort();
    const optIds = optimized.tasks.map((t) => t.id).sort();
    expect(optIds).toEqual(origIds);
  });

  it("does not add dependencies that create cycles", async () => {
    const plan = {
      id: "p1",
      goal: "g",
      repoPath: "/tmp",
      tasks: [
        {
          id: "t1",
          title: "A",
          description: "",
          estimatedMinutes: 10,
          dependsOn: [],
          estimatedCost: 0,
          priority: "medium" as const,
        },
        {
          id: "t2",
          title: "B",
          description: "",
          estimatedMinutes: 10,
          dependsOn: [],
          estimatedCost: 0,
          priority: "medium" as const,
        },
      ],
      totalEstimatedCost: 0,
      totalEstimatedMinutes: 10,
      createdAt: Date.now(),
    };
    const optimized = optimizeAssignment(plan, 4);
    // Verify no cycles
    const { DependencyGraph } = await import("./dependency-graph.js");
    const g = new DependencyGraph();
    for (const t of optimized.tasks) {
      g.addTask(t.id, t.estimatedMinutes);
    }
    for (const t of optimized.tasks) {
      for (const dep of t.dependsOn) {
        g.addDependency(t.id, dep);
      }
    }
    expect(g.detectCycles()).toBe(false);
  });

  it("returns a plan with updated cost/time totals", () => {
    const plan = {
      id: "p1",
      goal: "g",
      repoPath: "/tmp",
      tasks: [
        {
          id: "t1",
          title: "A",
          description: "",
          estimatedMinutes: 10,
          dependsOn: [],
          estimatedCost: 1,
          priority: "medium" as const,
        },
        {
          id: "t2",
          title: "B",
          description: "",
          estimatedMinutes: 20,
          dependsOn: [],
          estimatedCost: 2,
          priority: "medium" as const,
        },
      ],
      totalEstimatedCost: 0,
      totalEstimatedMinutes: 0,
      createdAt: Date.now(),
    };
    const optimized = optimizeAssignment(plan, 4);
    expect(optimized.totalEstimatedCost).toBe(3);
    expect(optimized.totalEstimatedMinutes).toBeGreaterThan(0);
  });
});
