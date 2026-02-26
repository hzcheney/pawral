import fs from "node:fs/promises";
import path from "node:path";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import { DependencyGraph } from "./dependency-graph.js";
import { estimateTimeline } from "./execution-planner.js";
import {
  DecompositionResultSchema,
  type CodebaseAnalysis,
  type DecompositionResult,
  type TaskPlan,
} from "./types.js";

// ---------------------------------------------------------------------------
// Codebase analysis
// ---------------------------------------------------------------------------

const MAX_FILES = 200;

/**
 * Scan a repository directory and produce a CodebaseAnalysis summary.
 * This is used as context for the AI decomposition prompt.
 */
export async function analyzeCodebase(repoPath: string): Promise<CodebaseAnalysis> {
  // Verify the path exists
  const stat = await fs.stat(repoPath);
  if (!stat.isDirectory()) {
    throw new Error(`repoPath '${repoPath}' is not a directory`);
  }

  // Read top-level entries
  const entries = await fs.readdir(repoPath, { withFileTypes: true, encoding: "utf8" });
  const topLevelDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => e.name);

  // Load package.json if it exists
  let packageJson: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(path.join(repoPath, "package.json"), "utf8");
    packageJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // no package.json
  }

  // Detect language
  const language = detectLanguage(packageJson, topLevelDirs);

  // Collect source files (skip node_modules, .git, dist, etc.)
  const files = await collectFiles(repoPath, 0, []);

  // Key files: pick the most important ones (largest, most central)
  const keyFiles = files
    .slice(0, 50)
    .map((f) => ({ path: f, size: 0 }));

  // Fill in sizes for key files
  await Promise.all(
    keyFiles.map(async (kf) => {
      try {
        const s = await fs.stat(path.join(repoPath, kf.path));
        kf.size = s.size;
      } catch {
        // ignore
      }
    }),
  );

  // Sort key files by size descending
  keyFiles.sort((a, b) => b.size - a.size);

  return {
    language,
    topLevelDirs,
    files: files.slice(0, MAX_FILES),
    packageJson,
    keyFiles: keyFiles.slice(0, 20),
  };
}

async function collectFiles(
  baseDir: string,
  depth: number,
  acc: string[],
): Promise<string[]> {
  if (acc.length >= MAX_FILES || depth > 5) return acc;

  const SKIP_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    ".turbo",
    "__pycache__",
    ".cache",
  ]);

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true, encoding: "utf8" }) as import("node:fs").Dirent[];
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (acc.length >= MAX_FILES) break;
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await collectFiles(path.join(baseDir, entry.name), depth + 1, acc);
    } else if (entry.isFile()) {
      acc.push(entry.name);
    }
  }
  return acc;
}

function detectLanguage(
  pkg: Record<string, unknown> | null,
  dirs: string[],
): string {
  if (pkg) {
    const deps = {
      ...(pkg.dependencies as Record<string, unknown> | undefined),
      ...(pkg.devDependencies as Record<string, unknown> | undefined),
    };
    if ("react" in deps) return "TypeScript/React";
    if ("next" in deps) return "TypeScript/Next.js";
    if ("express" in deps || "fastify" in deps || "hono" in deps)
      return "TypeScript/Node.js";
    if ("vite" in deps) return "TypeScript/Vite";
    return "TypeScript/Node.js";
  }
  if (dirs.includes("src") || dirs.includes("lib")) return "TypeScript";
  return "Unknown";
}

// ---------------------------------------------------------------------------
// AI decomposition
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a software engineering task decomposition expert.
Given a goal and codebase context, break it into a set of parallel sub-tasks that can be executed by AI coding agents.

Rules:
- Each task must be concrete and actionable.
- Identify dependencies between tasks: if task B requires output from task A, set B.dependsOn = ["A"].
- Minimize dependencies to maximize parallelism.
- Each task should take 15-120 minutes.
- Output ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "tasks": [{
    "id": "t1",
    "title": "Short title",
    "description": "What the agent should do",
    "estimatedMinutes": 30,
    "dependsOn": [],
    "estimatedCost": 0.5,
    "priority": "medium"
  }],
  "reasoning": "Why you decomposed it this way",
  "warnings": ["any concerns"]
}`;

/**
 * Use the AI (via pi-ai) to decompose a high-level goal into sub-tasks.
 */
export async function decompose(
  goal: string,
  repoPath: string,
  modelId: string,
): Promise<DecompositionResult> {
  const analysis = await analyzeCodebase(repoPath);
  const codebaseContext = formatCodebaseContext(analysis);

  // Build pi-ai context
  const context = {
    systemPrompt: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: `Goal: ${goal}\n\nCodebase:\n${codebaseContext}\n\nDecompose this goal into parallel sub-tasks.`,
        timestamp: Date.now(),
      },
    ],
  };

  // Resolve model — try to use the requested modelId; fall back gracefully
  let model;
  try {
    // getModel is strongly typed, so use a cast for the dynamic string
    model = getModel(
      "anthropic",
      modelId as Parameters<typeof getModel>[1],
    );
  } catch {
    model = getModel("anthropic", "claude-opus-4-6" as Parameters<typeof getModel>[1]);
  }

  const eventStream = streamSimple(model, context);
  const message = await eventStream.result();

  // Extract text from response
  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("AI response contained no text content");
  }

  const raw = extractJson(textContent.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AI returned invalid JSON: ${textContent.text.slice(0, 200)}`);
  }

  const result = DecompositionResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `AI response did not match DecompositionResult schema: ${result.error.message}`,
    );
  }

  return result.data;
}

/** Extract JSON from a possibly-markdown-wrapped string. */
function extractJson(text: string): string {
  // Strip ```json ... ``` blocks
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1]!.trim();
  // Find first { ... }
  const start = text.indexOf("{");
  if (start !== -1) {
    return text.slice(start);
  }
  return text.trim();
}

function formatCodebaseContext(analysis: CodebaseAnalysis): string {
  const lines: string[] = [
    `Language: ${analysis.language}`,
    `Top-level directories: ${analysis.topLevelDirs.join(", ")}`,
    `Total files: ${analysis.files.length}`,
  ];
  if (analysis.packageJson) {
    const pkg = analysis.packageJson;
    if (pkg.name) lines.push(`Package name: ${pkg.name}`);
    if (pkg.description) lines.push(`Description: ${pkg.description}`);
    const deps = Object.keys({
      ...(pkg.dependencies as object | undefined),
    });
    if (deps.length > 0) {
      lines.push(`Key dependencies: ${deps.slice(0, 10).join(", ")}`);
    }
  }
  if (analysis.keyFiles.length > 0) {
    lines.push(
      `Key files: ${analysis.keyFiles.map((f) => f.path).join(", ")}`,
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Plan validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const COST_WARNING_THRESHOLD = 50; // USD per task

/**
 * Validate a TaskPlan for correctness:
 * - No circular dependencies
 * - All referenced dep IDs exist
 * - No unreasonably high costs
 */
export function validatePlan(plan: TaskPlan): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const taskIds = new Set(plan.tasks.map((t) => t.id));

  // Check that all dependsOn IDs exist
  for (const task of plan.tasks) {
    for (const depId of task.dependsOn) {
      if (!taskIds.has(depId)) {
        errors.push(
          `Task '${task.id}' references unknown dependency '${depId}'`,
        );
      }
    }
  }

  // Build graph and check for cycles (only if all dep IDs exist)
  if (errors.length === 0) {
    const graph = new DependencyGraph();
    for (const task of plan.tasks) {
      graph.addTask(task.id, task.estimatedMinutes);
    }
    for (const task of plan.tasks) {
      for (const depId of task.dependsOn) {
        graph.addDependency(task.id, depId);
      }
    }
    if (graph.detectCycles()) {
      errors.push("Plan contains circular dependencies (cycle detected)");
    }
  }

  // Cost warnings
  for (const task of plan.tasks) {
    if (task.estimatedCost > COST_WARNING_THRESHOLD) {
      warnings.push(
        `Task '${task.id}' has a high estimated cost of $${task.estimatedCost}`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Assignment optimization
// ---------------------------------------------------------------------------

/**
 * Optimize task assignment to maximize parallelism given a worker count.
 * Returns a new TaskPlan with updated totals.
 * Currently a straightforward pass-through with updated aggregate fields
 * (the real parallelism optimization is in execution-planner.ts).
 */
export function optimizeAssignment(plan: TaskPlan, workerCount: number): TaskPlan {
  // Compute aggregate totals
  const totalEstimatedCost = plan.tasks.reduce(
    (sum, t) => sum + t.estimatedCost,
    0,
  );

  // Estimate timeline to compute makespan (critical path)
  const timeline = estimateTimeline(plan, workerCount);

  return {
    ...plan,
    totalEstimatedCost,
    totalEstimatedMinutes: timeline.makespanMinutes,
  };
}
