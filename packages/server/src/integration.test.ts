/**
 * Integration tests — real HTTP server + WebSocket, no mocks.
 * Tests the full server ↔ client protocol end-to-end.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { WebSocket } from "ws";
import http from "node:http";
import { createServer } from "./server.js";
import type { ServerContext } from "./server.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Connect and buffer all messages so none are missed. */
function connectWS(port: number): Promise<WebSocket & { messages: unknown[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`) as WebSocket & { messages: unknown[] };
    ws.messages = [];
    ws.on("message", (data) => {
      ws.messages.push(JSON.parse(data.toString()));
    });
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
    setTimeout(() => reject(new Error("WS connect timeout")), 5000);
  });
}

/** Wait until the message buffer has at least `count` messages. */
function waitForMessage<T = unknown>(
  ws: WebSocket & { messages: unknown[] },
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Message timeout (have ${ws.messages.length} messages)`)), timeout);
    const check = () => {
      if (ws.messages.length > 0) {
        clearTimeout(timer);
        resolve(ws.messages.shift() as T);
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

function sendJSON(ws: WebSocket, msg: unknown): void {
  ws.send(JSON.stringify(msg));
}

function getJSON(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(JSON.parse(body)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Integration: Server + WebSocket", () => {
  let ctx: ServerContext;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    ctx = createServer({
      port: 0, // random port
      workerCount: 3,
      workspaceBase: "/tmp/pawral-integration-test",
      dbPath: ":memory:",
    });
    server = ctx.listen();

    // Get actual port
    await new Promise<void>((resolve) => {
      server.on("listening", () => {
        const addr = server.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
      // If already listening
      const addr = server.address();
      if (addr) {
        port = typeof addr === "object" ? addr.port : 0;
        resolve();
      }
    });
  });

  afterAll(async () => {
    ctx.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // ── REST API ──────────────────────────────────────────────────────────────

  describe("REST API", () => {
    it("GET /health returns ok + worker count", async () => {
      const data = (await getJSON(`http://localhost:${port}/health`)) as {
        status: string;
        workers: number;
      };
      expect(data.status).toBe("ok");
      expect(data.workers).toBe(3);
    });

    it("GET /api/tasks returns empty array initially", async () => {
      const data = await getJSON(`http://localhost:${port}/api/tasks`);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it("GET /api/budget returns summary", async () => {
      const data = (await getJSON(`http://localhost:${port}/api/budget`)) as Record<string, unknown>;
      expect(data).toHaveProperty("todayTotal");
      expect(data.todayTotal).toBe(0);
    });

    it("GET /api/settings returns default settings", async () => {
      const data = (await getJSON(`http://localhost:${port}/api/settings`)) as {
        dailyBudget: number;
      };
      expect(data).toHaveProperty("dailyBudget");
    });
  });

  // ── WebSocket: init message ───────────────────────────────────────────────

  describe("WebSocket: connection + init", () => {
    it("sends init message on connect with workers and tasks", async () => {
      const ws = await connectWS(port);
      try {
        const msg = await waitForMessage<{
          type: string;
          workers: Array<{ id: string; workspace: string; status: string }>;
          tasks: unknown[];
        }>(ws);

        expect(msg.type).toBe("init");
        expect(msg.workers).toHaveLength(3);
        expect(msg.workers[0]).toMatchObject({
          id: "worker-1",
          status: "idle",
        });
        expect(msg.workers[1].id).toBe("worker-2");
        expect(msg.workers[2].id).toBe("worker-3");
        expect(Array.isArray(msg.tasks)).toBe(true);
      } finally {
        ws.close();
      }
    });

    it("worker init data includes workspace path", async () => {
      const ws = await connectWS(port);
      try {
        const msg = await waitForMessage<{
          type: string;
          workers: Array<{ workspace: string }>;
        }>(ws);

        expect(msg.workers[0].workspace).toContain("worker-1");
        expect(msg.workers[1].workspace).toContain("worker-2");
      } finally {
        ws.close();
      }
    });
  });

  // ── WebSocket: subscribe ──────────────────────────────────────────────────

  describe("WebSocket: subscribe (no-op, should not error)", () => {
    it("accepts subscribe message without crashing", async () => {
      const ws = await connectWS(port);
      try {
        // Drain init message
        await waitForMessage(ws);

        // Send subscribe
        sendJSON(ws, {
          type: "subscribe",
          channels: ["workers", "tasks", "budget"],
        });

        // Give server a moment to process — if it errors, it sends an alert
        await new Promise((r) => setTimeout(r, 200));

        // Server should still be alive — send a ping-like message
        // No crash = success
        expect(ws.readyState).toBe(WebSocket.OPEN);
      } finally {
        ws.close();
      }
    });
  });

  // ── WebSocket: task lifecycle ─────────────────────────────────────────────

  describe("WebSocket: task.create → broadcast", () => {
    it("creates a task and broadcasts task.updated to all clients", async () => {
      const ws1 = await connectWS(port);
      const ws2 = await connectWS(port);
      try {
        // Drain init messages
        await waitForMessage(ws1);
        await waitForMessage(ws2);

        // Create task from ws1
        sendJSON(ws1, {
          type: "task.create",
          task: {
            title: "Fix login bug",
            prompt: "Fix the authentication flow in src/auth.ts",
            repo: "https://github.com/test/repo",
            branch: "fix/login",
            model: "claude-sonnet-4-6",
          },
        });

        // Both clients should receive task.updated
        const msg1 = await waitForMessage<{
          type: string;
          task: { title: string; status: string; id: string };
        }>(ws1);
        const msg2 = await waitForMessage<{
          type: string;
          task: { title: string; status: string };
        }>(ws2);

        expect(msg1.type).toBe("task.updated");
        expect(msg1.task.title).toBe("Fix login bug");
        expect(msg1.task.status).toBe("queued");
        expect(msg1.task.id).toBeTruthy();

        expect(msg2.type).toBe("task.updated");
        expect(msg2.task.title).toBe("Fix login bug");
      } finally {
        ws1.close();
        ws2.close();
      }
    });

    it("created task appears in REST API", async () => {
      const ws = await connectWS(port);
      try {
        await waitForMessage(ws);

        sendJSON(ws, {
          type: "task.create",
          task: {
            title: "Add dark mode",
            prompt: "Implement dark mode toggle",
            repo: "https://github.com/test/repo",
            branch: "feat/dark-mode",
            model: "claude-sonnet-4-6",
          },
        });

        await waitForMessage(ws); // wait for broadcast

        const tasks = (await getJSON(`http://localhost:${port}/api/tasks`)) as Array<{
          title: string;
        }>;
        const found = tasks.find((t) => t.title === "Add dark mode");
        expect(found).toBeTruthy();
      } finally {
        ws.close();
      }
    });
  });

  // ── WebSocket: task.cancel ────────────────────────────────────────────────

  describe("WebSocket: task.cancel", () => {
    it("cancels a queued task and broadcasts update", async () => {
      const ws = await connectWS(port);
      try {
        await waitForMessage(ws);

        // Create a task
        sendJSON(ws, {
          type: "task.create",
          task: {
            title: "To be cancelled",
            prompt: "This task will be cancelled",
            repo: "https://github.com/test/repo",
            branch: "test/cancel",
            model: "claude-sonnet-4-6",
          },
        });

        const createMsg = await waitForMessage<{
          type: string;
          task: { id: string; status: string };
        }>(ws);
        const taskId = createMsg.task.id;

        // Cancel it
        sendJSON(ws, { type: "task.cancel", taskId });

        const cancelMsg = await waitForMessage<{
          type: string;
          task: { id: string; status: string };
        }>(ws);

        expect(cancelMsg.type).toBe("task.updated");
        expect(cancelMsg.task.id).toBe(taskId);
        expect(cancelMsg.task.status).toBe("failed");
      } finally {
        ws.close();
      }
    });
  });

  // ── WebSocket: settings.update ────────────────────────────────────────────

  describe("WebSocket: settings.update", () => {
    it("updates settings via WebSocket", async () => {
      const ws = await connectWS(port);
      try {
        await waitForMessage(ws);

        sendJSON(ws, {
          type: "settings.update",
          settings: { dailyBudget: 100 },
        });

        // Verify via REST
        await new Promise((r) => setTimeout(r, 200));
        const settings = (await getJSON(`http://localhost:${port}/api/settings`)) as {
          dailyBudget: number;
        };
        expect(settings.dailyBudget).toBe(100);
      } finally {
        ws.close();
      }
    });
  });

  // ── WebSocket: invalid message ────────────────────────────────────────────

  describe("WebSocket: error handling", () => {
    it("sends alert on invalid message", async () => {
      const ws = await connectWS(port);
      try {
        await waitForMessage(ws);

        sendJSON(ws, { type: "nonexistent.action", foo: "bar" });

        const msg = await waitForMessage<{
          type: string;
          alert: { severity: string; message: string };
        }>(ws);

        expect(msg.type).toBe("alert");
        expect(msg.alert.severity).toBe("error");
        expect(msg.alert.message).toContain("Invalid message");
      } finally {
        ws.close();
      }
    });

    it("handles malformed JSON gracefully", async () => {
      const ws = await connectWS(port);
      try {
        await waitForMessage(ws);

        ws.send("not json at all {{{");

        const msg = await waitForMessage<{
          type: string;
          alert: { severity: string };
        }>(ws);

        expect(msg.type).toBe("alert");
        expect(msg.alert.severity).toBe("error");
      } finally {
        ws.close();
      }
    });
  });

  // ── Multi-client broadcast ────────────────────────────────────────────────

  describe("Multi-client broadcast", () => {
    it("broadcasts to all connected clients", async () => {
      const clients: WebSocket[] = [];
      try {
        // Connect 4 clients
        for (let i = 0; i < 4; i++) {
          const ws = await connectWS(port);
          await waitForMessage(ws); // drain init
          clients.push(ws);
        }

        // Create task from first client
        sendJSON(clients[0], {
          type: "task.create",
          task: {
            title: "Broadcast test",
            prompt: "Testing multi-client broadcast",
            repo: "https://github.com/test/repo",
            branch: "test/broadcast",
            model: "claude-sonnet-4-6",
          },
        });

        // All 4 clients should receive it
        const messages = await Promise.all(
          clients.map((ws) =>
            waitForMessage<{ type: string; task: { title: string } }>(ws),
          ),
        );

        for (const msg of messages) {
          expect(msg.type).toBe("task.updated");
          expect(msg.task.title).toBe("Broadcast test");
        }
      } finally {
        for (const ws of clients) ws.close();
      }
    });
  });
});
