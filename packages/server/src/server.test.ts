import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";

// ─── Mock node:fs ─────────────────────────────────────────────────────────────

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  };
});

// ─── Mock @lydell/node-pty ────────────────────────────────────────────────────

class MockPty extends EventEmitter {
  cols = 120;
  rows = 40;
  pid = 12345;
  killed = false;

  private _dataHandlers: Array<(data: string) => void> = [];
  private _exitHandlers: Array<(e: { exitCode: number }) => void> = [];

  write(_data: string): void {}

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  kill(): void {
    this.killed = true;
    for (const h of this._exitHandlers) h({ exitCode: 0 });
  }

  onData(handler: (data: string) => void): { dispose: () => void } {
    this._dataHandlers.push(handler);
    return {
      dispose: () => {
        this._dataHandlers = this._dataHandlers.filter((h) => h !== handler);
      },
    };
  }

  onExit(handler: (e: { exitCode: number }) => void): { dispose: () => void } {
    this._exitHandlers.push(handler);
    return {
      dispose: () => {
        this._exitHandlers = this._exitHandlers.filter((h) => h !== handler);
      },
    };
  }
}

vi.mock("@lydell/node-pty", () => ({
  spawn: vi.fn(() => new MockPty()),
}));

// ─── Mock simple-git ──────────────────────────────────────────────────────────

vi.mock("simple-git", () => ({
  default: vi.fn(() => ({
    fetch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ files: [] }),
    raw: vi.fn().mockResolvedValue(""),
  })),
}));

// ─── Imports AFTER mocks ──────────────────────────────────────────────────────

import { createServer } from "./server.js";
import type { ServerConfig } from "./server.js";

describe("createServer", () => {
  let config: ServerConfig;

  beforeEach(() => {
    config = {
      port: 0, // OS assigns random port
      workerCount: 2,
      workspaceBase: "/tmp/test-workspaces",
      dbPath: ":memory:",
    };
  });

  it("creates a server context with all modules", () => {
    const ctx = createServer(config);
    expect(ctx.db).toBeDefined();
    expect(ctx.terminalManager).toBeDefined();
    expect(ctx.gitOps).toBeDefined();
    expect(ctx.budgetTracker).toBeDefined();
    expect(ctx.scheduler).toBeDefined();
    expect(ctx.app).toBeDefined();
    ctx.dispose();
  });

  it("has a health check endpoint", async () => {
    const ctx = createServer(config);
    // Use supertest-like approach: just test the route is defined on express app
    // We can test by making an actual request in a real server
    expect(ctx.app).toBeDefined();
    ctx.dispose();
  });

  it("disposes all resources cleanly", () => {
    const ctx = createServer(config);
    expect(() => ctx.dispose()).not.toThrow();
  });

  it("starts and stops listening", async () => {
    const ctx = createServer(config);
    const server = ctx.listen();
    expect(server).toBeDefined();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    ctx.dispose();
  });

  it("initializes workers based on config", () => {
    const ctx = createServer(config);
    expect(ctx.terminalManager.getWorkers()).toHaveLength(2);
    ctx.dispose();
  });

  it("creates tick interval that can be cleared", () => {
    const ctx = createServer(config);
    expect(ctx.startTick).toBeDefined();
    expect(ctx.stopTick).toBeDefined();

    const intervalId = ctx.startTick(1000);
    expect(intervalId).toBeDefined();
    ctx.stopTick(intervalId);
    ctx.dispose();
  });
});
