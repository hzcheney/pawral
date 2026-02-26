import { useState, useCallback } from "react";
import clsx from "clsx";
import { useWorkersStore } from "../../stores/workers.ts";
import { TerminalPanel } from "./TerminalPanel.tsx";

export type GridLayout = "2x2" | "3x2";

interface TerminalGridProps {
  layout?: GridLayout;
}

const GRID_CLASSES: Record<GridLayout, string> = {
  "2x2": "grid-cols-2 grid-rows-2",
  "3x2": "grid-cols-3 grid-rows-2",
};

export function TerminalGrid({ layout = "3x2" }: TerminalGridProps) {
  const workers = useWorkersStore((state) => state.workers);
  const [fullscreenWorkerId, setFullscreenWorkerId] = useState<string | null>(null);

  const handleMaximize = useCallback((workerId: string) => {
    setFullscreenWorkerId((prev) => (prev === workerId ? null : workerId));
  }, []);

  // How many cells to show based on layout
  const maxCells = layout === "2x2" ? 4 : 6;
  const visibleWorkers = workers.slice(0, maxCells);

  const fullscreenWorker = fullscreenWorkerId
    ? workers.find((w) => w.id === fullscreenWorkerId) ?? null
    : null;

  return (
    <div className="relative flex-1 min-h-0">
      {/* Grid layout */}
      <div
        className={clsx(
          "grid gap-2 h-full",
          GRID_CLASSES[layout],
        )}
      >
        {visibleWorkers.map((worker) => (
          <TerminalPanel
            key={worker.id}
            worker={worker}
            onMaximize={() => handleMaximize(worker.id)}
          />
        ))}

        {/* Empty cells if fewer workers than grid slots */}
        {visibleWorkers.length < maxCells &&
          Array.from({ length: maxCells - visibleWorkers.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center justify-center rounded-md border border-border-muted border-dashed bg-bg-secondary/50"
            >
              <span className="text-xs text-text-muted font-mono">No worker assigned</span>
            </div>
          ))}
      </div>

      {/* Fullscreen overlay */}
      {fullscreenWorker && (
        <div className="absolute inset-0 z-50">
          <TerminalPanel
            worker={fullscreenWorker}
            onMaximize={() => setFullscreenWorkerId(null)}
            isFullscreen
          />
        </div>
      )}
    </div>
  );
}
