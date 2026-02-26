import { describe, it, expect, beforeEach } from "vitest";
import { DependencyGraph } from "./dependency-graph.js";

describe("DependencyGraph", () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  // -------------------------------------------------------------------------
  // addTask / basic state
  // -------------------------------------------------------------------------

  describe("addTask", () => {
    it("adds a task and returns it via getTask", () => {
      graph.addTask("t1", 10);
      expect(graph.getTask("t1")).toEqual({ id: "t1", estimatedMinutes: 10 });
    });

    it("throws if a task is added twice", () => {
      graph.addTask("t1", 10);
      expect(() => graph.addTask("t1", 5)).toThrow(/already exists/);
    });

    it("getTask returns undefined for unknown task", () => {
      expect(graph.getTask("nope")).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // addDependency
  // -------------------------------------------------------------------------

  describe("addDependency", () => {
    it("records a dependency between two tasks", () => {
      graph.addTask("t1", 5);
      graph.addTask("t2", 5);
      graph.addDependency("t2", "t1"); // t2 depends on t1
      expect(graph.getDependencies("t2")).toContain("t1");
    });

    it("throws if dependent task does not exist", () => {
      graph.addTask("t1", 5);
      expect(() => graph.addDependency("missing", "t1")).toThrow(/not found/);
    });

    it("throws if dependency task does not exist", () => {
      graph.addTask("t1", 5);
      expect(() => graph.addDependency("t1", "missing")).toThrow(/not found/);
    });
  });

  // -------------------------------------------------------------------------
  // detectCycles
  // -------------------------------------------------------------------------

  describe("detectCycles", () => {
    it("returns false for an empty graph", () => {
      expect(graph.detectCycles()).toBe(false);
    });

    it("returns false for a linear chain", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "b");
      expect(graph.detectCycles()).toBe(false);
    });

    it("returns false for a diamond DAG", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addTask("d", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "a");
      graph.addDependency("d", "b");
      graph.addDependency("d", "c");
      expect(graph.detectCycles()).toBe(false);
    });

    it("returns true for a direct cycle (a → b → a)", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addDependency("b", "a");
      graph.addDependency("a", "b"); // cycle!
      expect(graph.detectCycles()).toBe(true);
    });

    it("returns true for an indirect cycle (a → b → c → a)", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "b");
      graph.addDependency("a", "c"); // cycle!
      expect(graph.detectCycles()).toBe(true);
    });

    it("returns true for a self-loop", () => {
      graph.addTask("a", 5);
      graph.addDependency("a", "a"); // self-loop
      expect(graph.detectCycles()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // topologicalSort
  // -------------------------------------------------------------------------

  describe("topologicalSort", () => {
    it("returns empty array for empty graph", () => {
      expect(graph.topologicalSort()).toEqual([]);
    });

    it("sorts a linear chain correctly", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "b");
      const order = graph.topologicalSort();
      expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
      expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
    });

    it("sorts a diamond DAG correctly", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addTask("d", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "a");
      graph.addDependency("d", "b");
      graph.addDependency("d", "c");
      const order = graph.topologicalSort();
      expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
      expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"));
      expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
      expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
    });

    it("includes all tasks", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addDependency("b", "a");
      const order = graph.topologicalSort();
      expect(order).toHaveLength(3);
      expect(order).toContain("a");
      expect(order).toContain("b");
      expect(order).toContain("c");
    });

    it("throws if graph has a cycle", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addDependency("a", "b");
      graph.addDependency("b", "a");
      expect(() => graph.topologicalSort()).toThrow(/cycle/i);
    });
  });

  // -------------------------------------------------------------------------
  // getReady
  // -------------------------------------------------------------------------

  describe("getReady", () => {
    it("returns all tasks with no deps when nothing is completed", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addDependency("c", "a");
      graph.addDependency("c", "b");
      const ready = graph.getReady(new Set());
      expect(ready).toContain("a");
      expect(ready).toContain("b");
      expect(ready).not.toContain("c");
    });

    it("returns dependent task once deps are completed", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "b");
      const ready = graph.getReady(new Set(["a", "b"]));
      expect(ready).toContain("c");
      expect(ready).not.toContain("a");
      expect(ready).not.toContain("b");
    });

    it("excludes already-completed tasks", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addDependency("b", "a");
      const ready = graph.getReady(new Set(["a"]));
      expect(ready).not.toContain("a");
      expect(ready).toContain("b");
    });

    it("returns empty when all tasks are completed", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      const ready = graph.getReady(new Set(["a", "b"]));
      expect(ready).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getParallelGroups
  // -------------------------------------------------------------------------

  describe("getParallelGroups", () => {
    it("returns one group with all tasks when there are no dependencies", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      const groups = graph.getParallelGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0]).toContain("a");
      expect(groups[0]).toContain("b");
      expect(groups[0]).toContain("c");
    });

    it("returns sequential groups for a linear chain", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "b");
      const groups = graph.getParallelGroups();
      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual(["a"]);
      expect(groups[1]).toEqual(["b"]);
      expect(groups[2]).toEqual(["c"]);
    });

    it("groups independent tasks at the same level together", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 5);
      graph.addTask("c", 5);
      graph.addTask("d", 5);
      graph.addDependency("b", "a");
      graph.addDependency("c", "a");
      graph.addDependency("d", "b");
      graph.addDependency("d", "c");
      const groups = graph.getParallelGroups();
      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual(["a"]);
      expect(groups[1]).toHaveLength(2);
      expect(groups[1]).toContain("b");
      expect(groups[1]).toContain("c");
      expect(groups[2]).toEqual(["d"]);
    });

    it("returns empty array for empty graph", () => {
      expect(graph.getParallelGroups()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // serialize / deserialize
  // -------------------------------------------------------------------------

  describe("serialize / deserialize", () => {
    it("round-trips an empty graph", () => {
      const json = graph.serialize();
      const g2 = DependencyGraph.deserialize(json);
      expect(g2.topologicalSort()).toEqual([]);
    });

    it("round-trips tasks and dependencies", () => {
      graph.addTask("a", 5);
      graph.addTask("b", 10);
      graph.addTask("c", 15);
      graph.addDependency("b", "a");
      graph.addDependency("c", "b");

      const g2 = DependencyGraph.deserialize(graph.serialize());
      expect(g2.getTask("a")).toEqual({ id: "a", estimatedMinutes: 5 });
      expect(g2.getTask("b")).toEqual({ id: "b", estimatedMinutes: 10 });
      expect(g2.getDependencies("c")).toContain("b");
      const order = g2.topologicalSort();
      expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
      expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
    });

    it("produces valid JSON string", () => {
      graph.addTask("t1", 5);
      const json = graph.serialize();
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});
