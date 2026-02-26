/**
 * Directed Acyclic Graph for managing task dependencies.
 *
 * Terminology:
 *   addDependency(task, dep) — `task` depends on `dep` (dep must finish first)
 *   edges: taskId → Set<depId>
 */

interface TaskNode {
  id: string;
  estimatedMinutes: number;
}

interface SerializedGraph {
  tasks: TaskNode[];
  /** [taskId, depId][] */
  edges: [string, string][];
}

export class DependencyGraph {
  private tasks: Map<string, TaskNode> = new Map();
  /** taskId → set of dependency ids */
  private deps: Map<string, Set<string>> = new Map();

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  addTask(id: string, estimatedMinutes: number): void {
    if (this.tasks.has(id)) {
      throw new Error(`Task '${id}' already exists`);
    }
    this.tasks.set(id, { id, estimatedMinutes });
    this.deps.set(id, new Set());
  }

  /**
   * Record that `taskId` depends on `depId` (depId must complete first).
   */
  addDependency(taskId: string, depId: string): void {
    if (!this.tasks.has(taskId)) {
      throw new Error(`Task '${taskId}' not found`);
    }
    if (!this.tasks.has(depId)) {
      throw new Error(`Task '${depId}' not found`);
    }
    this.deps.get(taskId)!.add(depId);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getTask(id: string): TaskNode | undefined {
    return this.tasks.get(id);
  }

  getDependencies(taskId: string): string[] {
    return Array.from(this.deps.get(taskId) ?? []);
  }

  /**
   * Detect cycles using DFS with three-colour marking.
   * Returns true if at least one cycle exists.
   */
  detectCycles(): boolean {
    const WHITE = 0; // unvisited
    const GRAY = 1; // in current DFS path
    const BLACK = 2; // fully processed

    const colour: Map<string, number> = new Map();
    for (const id of this.tasks.keys()) {
      colour.set(id, WHITE);
    }

    const dfs = (id: string): boolean => {
      colour.set(id, GRAY);
      for (const dep of this.deps.get(id) ?? []) {
        if (colour.get(dep) === GRAY) return true; // back edge → cycle
        if (colour.get(dep) === WHITE && dfs(dep)) return true;
      }
      colour.set(id, BLACK);
      return false;
    };

    for (const id of this.tasks.keys()) {
      if (colour.get(id) === WHITE) {
        if (dfs(id)) return true;
      }
    }
    return false;
  }

  /**
   * Return task IDs in topological order (dependencies before dependents).
   * Throws if the graph has a cycle.
   */
  topologicalSort(): string[] {
    if (this.detectCycles()) {
      throw new Error("Cannot sort: graph contains a cycle");
    }

    const result: string[] = [];
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const dep of this.deps.get(id) ?? []) {
        visit(dep);
      }
      result.push(id);
    };

    for (const id of this.tasks.keys()) {
      visit(id);
    }

    return result;
  }

  /**
   * Return task IDs that are ready to start: all their dependencies are in
   * `completed` and they are not yet completed themselves.
   */
  getReady(completed: Set<string>): string[] {
    const ready: string[] = [];
    for (const [id, depSet] of this.deps.entries()) {
      if (completed.has(id)) continue;
      const allDepsCompleted = Array.from(depSet).every((dep) =>
        completed.has(dep),
      );
      if (allDepsCompleted) {
        ready.push(id);
      }
    }
    return ready;
  }

  /**
   * Group tasks into waves that can run in parallel.
   * Wave 0 has no deps, wave 1 depends only on wave 0, etc.
   * This uses a level-based BFS (Kahn's algorithm extended to groups).
   */
  getParallelGroups(): string[][] {
    if (this.tasks.size === 0) return [];

    // Build in-degree map
    const inDegree: Map<string, number> = new Map();
    for (const id of this.tasks.keys()) {
      inDegree.set(id, 0);
    }
    for (const [taskId, depSet] of this.deps.entries()) {
      // each dep reduces the in-degree of taskId? No — deps are prerequisites.
      // in-degree = number of tasks that must complete before this one
      inDegree.set(taskId, depSet.size);
    }

    const groups: string[][] = [];
    let current = Array.from(inDegree.entries())
      .filter(([, d]) => d === 0)
      .map(([id]) => id);

    const processed = new Set<string>();

    while (current.length > 0) {
      groups.push([...current]);
      for (const id of current) {
        processed.add(id);
      }
      // For each remaining task, check if all its deps are now processed
      const next: string[] = [];
      for (const [id, depSet] of this.deps.entries()) {
        if (processed.has(id)) continue;
        if (Array.from(depSet).every((dep) => processed.has(dep))) {
          next.push(id);
        }
      }
      current = next;
    }

    return groups;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  serialize(): string {
    const data: SerializedGraph = {
      tasks: Array.from(this.tasks.values()),
      edges: [],
    };
    for (const [taskId, depSet] of this.deps.entries()) {
      for (const depId of depSet) {
        data.edges.push([taskId, depId]);
      }
    }
    return JSON.stringify(data);
  }

  static deserialize(json: string): DependencyGraph {
    const data: SerializedGraph = JSON.parse(json) as SerializedGraph;
    const g = new DependencyGraph();
    for (const task of data.tasks) {
      g.addTask(task.id, task.estimatedMinutes);
    }
    for (const [taskId, depId] of data.edges) {
      g.addDependency(taskId, depId);
    }
    return g;
  }
}
