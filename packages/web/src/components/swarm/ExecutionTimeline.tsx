import { useMemo } from "react";
import clsx from "clsx";
import type { SwarmPlan, SwarmTask } from "../../lib/types.ts";

interface ExecutionTimelineProps {
  plan: SwarmPlan;
}

interface ScheduledTask {
  task: SwarmTask;
  worker: number;
  startMin: number;
  endMin: number;
}

const BAR_COLORS = [
  "bg-accent-blue",
  "bg-accent-green",
  "bg-accent-purple",
  "bg-accent-yellow",
  "bg-accent-orange",
  "bg-accent-red",
];

const BAR_OPACITY_COLORS = [
  "bg-accent-blue/80",
  "bg-accent-green/80",
  "bg-accent-purple/80",
  "bg-accent-yellow/80",
  "bg-accent-orange/80",
  "bg-accent-red/80",
];

function scheduleTasks(plan: SwarmPlan): ScheduledTask[] {
  const { tasks, suggestedWorkers } = plan;
  const workerCount = suggestedWorkers;

  // Track when each task ends
  const taskEndTimes = new Map<string, number>();
  // Track when each worker becomes free
  const workerFreeTimes: number[] = Array(workerCount).fill(0);

  const scheduled: ScheduledTask[] = [];

  // Topological sort based on dependencies
  const sorted = topologicalSort(tasks);

  for (const task of sorted) {
    // Calculate earliest start based on dependencies
    let earliestStart = 0;
    for (const depId of task.dependsOn) {
      const depEnd = taskEndTimes.get(depId) ?? 0;
      earliestStart = Math.max(earliestStart, depEnd);
    }

    // Find the worker that's free earliest after earliestStart
    let bestWorker = 0;
    let bestStart = Math.max(earliestStart, workerFreeTimes[0]);

    for (let w = 1; w < workerCount; w++) {
      const start = Math.max(earliestStart, workerFreeTimes[w]);
      if (start < bestStart) {
        bestStart = start;
        bestWorker = w;
      }
    }

    const endMin = bestStart + task.estimatedMinutes;
    taskEndTimes.set(task.id, endMin);
    workerFreeTimes[bestWorker] = endMin;

    scheduled.push({
      task,
      worker: bestWorker,
      startMin: bestStart,
      endMin,
    });
  }

  return scheduled;
}

function topologicalSort(tasks: SwarmTask[]): SwarmTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: SwarmTask[] = [];

  function visit(taskId: string) {
    if (visited.has(taskId)) {
      return;
    }
    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) {
      return;
    }
    for (const depId of task.dependsOn) {
      visit(depId);
    }
    result.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return result;
}

export function ExecutionTimeline({ plan }: ExecutionTimelineProps) {
  const scheduled = useMemo(() => scheduleTasks(plan), [plan]);
  const totalMinutes = useMemo(
    () => Math.max(...scheduled.map((s) => s.endMin), 1),
    [scheduled]
  );

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const step = totalMinutes <= 20 ? 5 : totalMinutes <= 60 ? 10 : 15;
    const markers: number[] = [];
    for (let t = 0; t <= totalMinutes; t += step) {
      markers.push(t);
    }
    if (markers[markers.length - 1] !== totalMinutes) {
      markers.push(totalMinutes);
    }
    return markers;
  }, [totalMinutes]);

  const workerCount = plan.suggestedWorkers;

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Parallel Execution Preview
        </span>
        <span className="font-mono text-[11px] text-text-muted">
          ~{totalMinutes} min total
        </span>
      </div>

      {/* Timeline grid */}
      <div className="overflow-x-auto px-4 py-3">
        <div className="min-w-[500px]">
          {/* Worker rows */}
          {Array.from({ length: workerCount }, (_, workerIndex) => {
            const workerTasks = scheduled.filter(
              (s) => s.worker === workerIndex
            );

            return (
              <div
                key={workerIndex}
                className="flex items-center gap-3 border-b border-border-muted/50 py-1.5 last:border-b-0"
              >
                {/* Worker label */}
                <span className="w-20 shrink-0 font-mono text-[11px] text-text-muted">
                  Worker-{workerIndex + 1}
                </span>

                {/* Timeline bar area */}
                <div className="relative h-7 flex-1 rounded bg-bg-primary">
                  {workerTasks.map((s) => {
                    const leftPct = (s.startMin / totalMinutes) * 100;
                    const widthPct =
                      ((s.endMin - s.startMin) / totalMinutes) * 100;
                    const colorIndex =
                      plan.tasks.indexOf(s.task) % BAR_COLORS.length;

                    return (
                      <div
                        key={s.task.id}
                        className={clsx(
                          "absolute top-0.5 bottom-0.5 flex items-center justify-center rounded px-1 text-[10px] font-medium text-bg-primary",
                          BAR_COLORS[colorIndex]
                        )}
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 2)}%`,
                        }}
                        title={`${s.task.title} (${s.startMin}-${s.endMin} min)`}
                      >
                        <span className="truncate">
                          {s.task.title.length > 20
                            ? s.task.title.slice(0, 20) + "..."
                            : s.task.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Time axis */}
          <div className="mt-2 flex items-center gap-3">
            <span className="w-20 shrink-0" />
            <div className="relative h-4 flex-1">
              {timeMarkers.map((t) => {
                const leftPct = (t / totalMinutes) * 100;
                return (
                  <span
                    key={t}
                    className="absolute font-mono text-[10px] text-text-muted"
                    style={{
                      left: `${leftPct}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {t}m
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
