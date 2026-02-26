import { useMemo } from "react";
import type { SwarmPlan, SwarmTask } from "../../lib/types.ts";

interface DependencyGraphProps {
  plan: SwarmPlan;
}

interface NodeLayout {
  task: SwarmTask;
  x: number;
  y: number;
  layer: number;
  index: number;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 52;
const LAYER_GAP_X = 200;
const NODE_GAP_Y = 72;
const PADDING_X = 40;
const PADDING_Y = 40;

const COMPLEXITY_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  simple: { fill: "#3fb95015", stroke: "#3fb950", text: "#3fb950" },
  medium: { fill: "#d2992215", stroke: "#d29922", text: "#d29922" },
  complex: { fill: "#f8514915", stroke: "#f85149", text: "#f85149" },
};

function computeLayers(tasks: SwarmTask[]): Map<string, number> {
  const layers = new Map<string, number>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  function getLayer(taskId: string): number {
    if (layers.has(taskId)) {
      return layers.get(taskId)!;
    }

    const task = taskMap.get(taskId);
    if (!task || task.dependsOn.length === 0) {
      layers.set(taskId, 0);
      return 0;
    }

    const maxParentLayer = Math.max(
      ...task.dependsOn.map((depId) => getLayer(depId))
    );
    const layer = maxParentLayer + 1;
    layers.set(taskId, layer);
    return layer;
  }

  for (const task of tasks) {
    getLayer(task.id);
  }

  return layers;
}

function layoutNodes(tasks: SwarmTask[]): NodeLayout[] {
  const layerMap = computeLayers(tasks);
  const maxLayer = Math.max(...layerMap.values(), 0);

  // Group tasks by layer
  const layerGroups: SwarmTask[][] = Array.from(
    { length: maxLayer + 1 },
    () => []
  );
  for (const task of tasks) {
    const layer = layerMap.get(task.id) ?? 0;
    layerGroups[layer].push(task);
  }

  const nodes: NodeLayout[] = [];
  for (let layer = 0; layer <= maxLayer; layer++) {
    const group = layerGroups[layer];
    const groupHeight = group.length * NODE_HEIGHT + (group.length - 1) * (NODE_GAP_Y - NODE_HEIGHT);
    const startY = PADDING_Y + (maxNodesInLayer(layerGroups) * NODE_GAP_Y - groupHeight) / 2;

    for (let i = 0; i < group.length; i++) {
      nodes.push({
        task: group[i],
        x: PADDING_X + layer * LAYER_GAP_X,
        y: startY + i * NODE_GAP_Y,
        layer,
        index: i,
      });
    }
  }

  return nodes;
}

function maxNodesInLayer(layerGroups: SwarmTask[][]): number {
  return Math.max(...layerGroups.map((g) => g.length), 1);
}

export function DependencyGraph({ plan }: DependencyGraphProps) {
  const nodes = useMemo(() => layoutNodes(plan.tasks), [plan.tasks]);
  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.task.id, n])),
    [nodes]
  );

  const layerMap = useMemo(() => computeLayers(plan.tasks), [plan.tasks]);
  const maxLayer = Math.max(...layerMap.values(), 0);
  const layerGroups = useMemo(() => {
    const groups: SwarmTask[][] = Array.from(
      { length: maxLayer + 1 },
      () => []
    );
    for (const task of plan.tasks) {
      const layer = layerMap.get(task.id) ?? 0;
      groups[layer].push(task);
    }
    return groups;
  }, [plan.tasks, layerMap, maxLayer]);

  const maxNodes = maxNodesInLayer(layerGroups);
  const svgWidth = PADDING_X * 2 + (maxLayer + 1) * LAYER_GAP_X;
  const svgHeight = PADDING_Y * 2 + maxNodes * NODE_GAP_Y;

  // Compute edges
  const edges = useMemo(() => {
    const result: Array<{
      from: NodeLayout;
      to: NodeLayout;
    }> = [];
    for (const node of nodes) {
      for (const depId of node.task.dependsOn) {
        const fromNode = nodeMap.get(depId);
        if (fromNode) {
          result.push({ from: fromNode, to: node });
        }
      }
    }
    return result;
  }, [nodes, nodeMap]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Dependency Graph
        </span>
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-green" />
            Simple
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-yellow" />
            Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent-red" />
            Complex
          </span>
        </div>
      </div>

      {/* SVG */}
      <div className="flex-1 overflow-auto p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-full w-full"
          style={{ minWidth: svgWidth, minHeight: svgHeight }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#484f58" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const x1 = edge.from.x + NODE_WIDTH;
            const y1 = edge.from.y + NODE_HEIGHT / 2;
            const x2 = edge.to.x;
            const y2 = edge.to.y + NODE_HEIGHT / 2;
            const cx1 = x1 + (x2 - x1) * 0.4;
            const cx2 = x2 - (x2 - x1) * 0.4;

            return (
              <path
                key={`edge-${i}`}
                d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="#30363d"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const colors = COMPLEXITY_COLORS[node.task.complexity];
            const taskIndex = plan.tasks.indexOf(node.task) + 1;

            return (
              <g key={node.task.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={1.5}
                />
                {/* Task number */}
                <text
                  x={node.x + 12}
                  y={node.y + 20}
                  fill="#484f58"
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                >
                  #{taskIndex}
                </text>
                {/* Task title (truncated) */}
                <text
                  x={node.x + 12}
                  y={node.y + 36}
                  fill="#e6edf3"
                  fontSize={11}
                  fontFamily="Inter, sans-serif"
                >
                  {node.task.title.length > 18
                    ? node.task.title.slice(0, 18) + "..."
                    : node.task.title}
                </text>
                {/* Complexity indicator dot */}
                <circle
                  cx={node.x + NODE_WIDTH - 14}
                  cy={node.y + 14}
                  r={4}
                  fill={colors.stroke}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
