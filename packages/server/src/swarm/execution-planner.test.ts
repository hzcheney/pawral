import { describe, it, expect } from "vitest";
import { estimateTimeline } from "./execution-planner.js";
import type { TaskPlan } from "./types.js";

function makePlan(
  tasks: Array<{
    id: string;
    estimatedMinutes: number;
    dependsOn?: string[];
  }>,
): TaskPlan {
  return {
    id: "plan-1",
    goal: "test goal",
    repoPath: "/tmp/repo",
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.id,
      description: "",
      estimatedMinutes: t.estimatedMinutes,
      dependsOn: t.dependsOn ?? [],
      estimatedCost: 0,
      priority: "medium" as const,
    })),
    totalEstimatedCost: 0,
    totalEstimatedMinutes: 0,
    createdAt: Date.now(),
  };
}

describe("estimateTimeline", () => {
  it("assigns a single task to worker-1 starting at 0", () => {
    const plan = makePlan([{ id: "t1", estimatedMinutes: 30 }]);
    const timeline = estimateTimeline(plan, 4);
    expect(timeline.entries).toHaveLength(1);
    const entry = timeline.entries[0]!;
    expect(entry.taskId).toBe("t1");
    expect(entry.startMin).toBe(0);
    expect(entry.endMin).toBe(30);
    expect(timeline.makespanMinutes).toBe(30);
    expect(timeline.workersUsed).toBe(1);
  });

  it("distributes independent tasks across workers in parallel", () => {
    const plan = makePlan([
      { id: "t1", estimatedMinutes: 10 },
      { id: "t2", estimatedMinutes: 10 },
      { id: "t3", estimatedMinutes: 10 },
    ]);
    const timeline = estimateTimeline(plan, 3);
    // All three should start at 0 since they have no deps and 3 workers
    const starts = timeline.entries.map((e) => e.startMin);
    expect(starts.every((s) => s === 0)).toBe(true);
    expect(timeline.makespanMinutes).toBe(10);
    expect(timeline.workersUsed).toBe(3);
  });

  it("serializes dependent tasks on the same worker path", () => {
    // t1 → t2 (t2 depends on t1)
    const plan = makePlan([
      { id: "t1", estimatedMinutes: 10 },
      { id: "t2", estimatedMinutes: 20, dependsOn: ["t1"] },
    ]);
    const timeline = estimateTimeline(plan, 4);
    const t1 = timeline.entries.find((e) => e.taskId === "t1")!;
    const t2 = timeline.entries.find((e) => e.taskId === "t2")!;
    // t2 cannot start before t1 finishes
    expect(t2.startMin).toBeGreaterThanOrEqual(t1.endMin);
    expect(t2.endMin).toBe(t2.startMin + 20);
    expect(timeline.makespanMinutes).toBe(30);
  });

  it("correctly handles a diamond dependency (a → b,c → d)", () => {
    const plan = makePlan([
      { id: "a", estimatedMinutes: 5 },
      { id: "b", estimatedMinutes: 10, dependsOn: ["a"] },
      { id: "c", estimatedMinutes: 15, dependsOn: ["a"] },
      { id: "d", estimatedMinutes: 5, dependsOn: ["b", "c"] },
    ]);
    const timeline = estimateTimeline(plan, 4);
    const a = timeline.entries.find((e) => e.taskId === "a")!;
    const b = timeline.entries.find((e) => e.taskId === "b")!;
    const c = timeline.entries.find((e) => e.taskId === "c")!;
    const d = timeline.entries.find((e) => e.taskId === "d")!;

    expect(a.startMin).toBe(0);
    expect(b.startMin).toBeGreaterThanOrEqual(a.endMin);
    expect(c.startMin).toBeGreaterThanOrEqual(a.endMin);
    // d must wait for both b and c
    expect(d.startMin).toBeGreaterThanOrEqual(b.endMin);
    expect(d.startMin).toBeGreaterThanOrEqual(c.endMin);
    // critical path: a(5) + c(15) + d(5) = 25
    expect(timeline.makespanMinutes).toBe(25);
  });

  it("respects workerCount — does not assign more tasks in parallel than workers", () => {
    const plan = makePlan([
      { id: "t1", estimatedMinutes: 10 },
      { id: "t2", estimatedMinutes: 10 },
      { id: "t3", estimatedMinutes: 10 },
      { id: "t4", estimatedMinutes: 10 },
    ]);
    // Only 2 workers — tasks should be batched
    const timeline = estimateTimeline(plan, 2);
    expect(timeline.workersUsed).toBeLessThanOrEqual(2);
    // With 4 tasks and 2 workers: at least 2 rounds → makespan >= 20
    expect(timeline.makespanMinutes).toBeGreaterThanOrEqual(20);
    // All tasks accounted for
    expect(timeline.entries).toHaveLength(4);
  });

  it("uses minimum workers needed when workerCount exceeds task count", () => {
    const plan = makePlan([
      { id: "t1", estimatedMinutes: 10 },
      { id: "t2", estimatedMinutes: 20 },
    ]);
    const timeline = estimateTimeline(plan, 10);
    expect(timeline.workersUsed).toBeLessThanOrEqual(2);
  });

  it("all tasks appear exactly once in the timeline", () => {
    const plan = makePlan([
      { id: "a", estimatedMinutes: 5 },
      { id: "b", estimatedMinutes: 10, dependsOn: ["a"] },
      { id: "c", estimatedMinutes: 7, dependsOn: ["a"] },
      { id: "d", estimatedMinutes: 3, dependsOn: ["b", "c"] },
    ]);
    const timeline = estimateTimeline(plan, 3);
    const ids = timeline.entries.map((e) => e.taskId);
    expect(ids.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("assigns valid worker IDs to all entries", () => {
    const plan = makePlan([
      { id: "t1", estimatedMinutes: 5 },
      { id: "t2", estimatedMinutes: 5 },
    ]);
    const timeline = estimateTimeline(plan, 2);
    for (const entry of timeline.entries) {
      expect(entry.workerId).toMatch(/^worker-\d+$/);
    }
  });

  it("returns makespanMinutes of 0 for an empty plan", () => {
    const plan = makePlan([]);
    const timeline = estimateTimeline(plan, 4);
    expect(timeline.makespanMinutes).toBe(0);
    expect(timeline.entries).toHaveLength(0);
    expect(timeline.workersUsed).toBe(0);
  });
});
