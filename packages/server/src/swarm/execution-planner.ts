import { DependencyGraph } from "./dependency-graph.js";
import type { ExecutionTimeline, TaskPlan, TimelineEntry } from "./types.js";

/**
 * Estimate an execution timeline for a TaskPlan given a number of available
 * workers.
 *
 * Algorithm:
 *  1. Build a DependencyGraph from the plan.
 *  2. Simulate scheduling: maintain per-worker availability times.
 *  3. In each round, pick tasks that are "ready" (all deps finished) and
 *     assign them to the earliest-free workers.
 *  4. Repeat until all tasks are scheduled.
 */
export function estimateTimeline(
  plan: TaskPlan,
  workerCount: number,
): ExecutionTimeline {
  if (plan.tasks.length === 0) {
    return { entries: [], makespanMinutes: 0, workersUsed: 0 };
  }

  // Build dependency graph
  const graph = new DependencyGraph();
  for (const task of plan.tasks) {
    graph.addTask(task.id, task.estimatedMinutes);
  }
  for (const task of plan.tasks) {
    for (const dep of task.dependsOn) {
      graph.addDependency(task.id, dep);
    }
  }

  // Map task id → estimated minutes
  const durationOf: Map<string, number> = new Map(
    plan.tasks.map((t) => [t.id, t.estimatedMinutes]),
  );

  // Per-worker: when is this worker next free (in minutes from start)?
  const workerFreeAt: number[] = Array.from({ length: workerCount }, () => 0);
  const workerNames: string[] = Array.from(
    { length: workerCount },
    (_, i) => `worker-${i + 1}`,
  );

  const entries: TimelineEntry[] = [];
  const completed = new Set<string>();
  // When does each task finish? (to satisfy dep constraints)
  const finishTime: Map<string, number> = new Map();

  // We iterate until all tasks are scheduled
  const allTaskIds = new Set(plan.tasks.map((t) => t.id));

  while (completed.size < allTaskIds.size) {
    // Find tasks whose deps are all done (but not yet scheduled)
    const ready = graph.getReady(completed);

    if (ready.length === 0) {
      // Safety: shouldn't happen in a valid DAG, but guard against infinite loop
      break;
    }

    // Sort ready tasks: prefer tasks on the critical path (longer duration first)
    const sorted = [...ready].sort(
      (a, b) => (durationOf.get(b) ?? 0) - (durationOf.get(a) ?? 0),
    );

    // Assign ready tasks to available workers
    for (const taskId of sorted) {
      const duration = durationOf.get(taskId) ?? 0;

      // Earliest a task can start: max(dep finish times)
      const deps = graph.getDependencies(taskId);
      const depReadyAt = deps.reduce(
        (max, dep) => Math.max(max, finishTime.get(dep) ?? 0),
        0,
      );

      // Find the worker that becomes free earliest
      let bestWorker = 0;
      let bestStartTime = Infinity;
      for (let w = 0; w < workerCount; w++) {
        const startTime = Math.max(workerFreeAt[w]!, depReadyAt);
        if (startTime < bestStartTime) {
          bestStartTime = startTime;
          bestWorker = w;
        }
      }

      const startMin = bestStartTime;
      const endMin = startMin + duration;

      entries.push({
        workerId: workerNames[bestWorker]!,
        taskId,
        startMin,
        endMin,
      });

      workerFreeAt[bestWorker] = endMin;
      finishTime.set(taskId, endMin);
      completed.add(taskId);
    }
  }

  const makespanMinutes = entries.reduce((max, e) => Math.max(max, e.endMin), 0);

  // Count distinct workers actually used
  const usedWorkers = new Set(entries.map((e) => e.workerId));

  return {
    entries,
    makespanMinutes,
    workersUsed: usedWorkers.size,
  };
}
