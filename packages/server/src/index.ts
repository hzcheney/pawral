#!/usr/bin/env node

// Pawral Server — Entry point & CLI
export { TerminalManager } from "./terminal-manager.js";
export { TaskScheduler } from "./task-scheduler.js";
export { GitOps } from "./git-ops.js";
export { BudgetTracker } from "./budget-tracker.js";
export { StatusDetector } from "./status-detector.js";
export { PawralDatabase } from "./database.js";
export { createServer } from "./server.js";
export type { ServerConfig, ServerContext } from "./server.js";

import { Command } from "commander";
import chalk from "chalk";
import { createServer } from "./server.js";

const program = new Command();

program
  .name("pawral")
  .description("Pawral — AI Coding Agent Orchestration Server")
  .version("0.1.0");

program
  .command("serve")
  .description("Start the Pawral server")
  .option("-p, --port <number>", "Server port", "3001")
  .option("-w, --workers <number>", "Number of worker terminals", "6")
  .option("--workspace <path>", "Base workspace directory", "~/swarm-workspaces")
  .option("--db <path>", "SQLite database path", "pawral.db")
  .option("--tick <ms>", "Scheduler tick interval in ms", "5000")
  .action((opts) => {
    const port = parseInt(opts.port, 10);
    const workerCount = parseInt(opts.workers, 10);
    const tickInterval = parseInt(opts.tick, 10);

    console.log(chalk.bold("\n  Pawral Server\n"));
    console.log(`  Port:       ${chalk.cyan(String(port))}`);
    console.log(`  Workers:    ${chalk.cyan(String(workerCount))}`);
    console.log(`  Workspace:  ${chalk.cyan(opts.workspace)}`);
    console.log(`  Database:   ${chalk.cyan(opts.db)}`);
    console.log(`  Tick:       ${chalk.cyan(opts.tick + "ms")}\n`);

    const ctx = createServer({
      port,
      workerCount,
      workspaceBase: opts.workspace,
      dbPath: opts.db,
    });

    const server = ctx.listen();
    const tickId = ctx.startTick(tickInterval);

    console.log(chalk.green(`  Server listening on http://localhost:${port}`));
    console.log(chalk.gray("  Press Ctrl+C to stop\n"));

    process.on("SIGINT", () => {
      console.log(chalk.yellow("\n  Shutting down..."));
      ctx.stopTick(tickId);
      server.close();
      ctx.dispose();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      ctx.stopTick(tickId);
      server.close();
      ctx.dispose();
      process.exit(0);
    });
  });

// Only parse CLI when run directly (not when imported)
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("/index.ts") ||
    process.argv[1].endsWith("/index.js") ||
    process.argv[1].includes("pawral"));

if (isDirectRun) {
  program.parse();
}
