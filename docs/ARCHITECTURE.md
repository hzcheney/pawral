# Pawral — 架构设计（自建方案）

> Version: 1.0
> Date: 2025-07-11

---

## 1. OpenClaw 的框架架构解析

OpenClaw 的 AI 调用链是这样的：

```
OpenClaw Gateway
    │
    ▼
runEmbeddedPiAgent()          ← OpenClaw 的 Agent 执行入口
    │
    ├── @mariozechner/pi-coding-agent   ← "Pi" 编码Agent框架
    │       │                              (类似 Claude Code CLI)
    │       │                              提供: session管理、工具注册、
    │       │                              compaction、extensions
    │       │
    │       ├── @mariozechner/pi-agent-core  ← Agent 核心抽象层
    │       │       │                          提供: 消息协议、状态管理、
    │       │       │                          transport抽象
    │       │       │
    │       │       └── @mariozechner/pi-ai   ← 统一 LLM API（关键！）
    │       │               │                    提供: 多provider调用、
    │       │               │                    streaming、tool calling、
    │       │               │                    context管理、token追踪
    │       │               │
    │       │               ├── @anthropic-ai/sdk    ← Anthropic 官方SDK
    │       │               ├── openai (v6)          ← OpenAI 官方SDK
    │       │               ├── @google/genai        ← Google Gemini SDK
    │       │               ├── @mistralai/mistralai ← Mistral SDK
    │       │               └── @aws-sdk/client-bedrock-runtime ← AWS Bedrock
    │       │
    │       └── @mariozechner/pi-tui   ← Terminal UI (交互界面)
    │
    └── OpenClaw 自己的层:
        ├── system-prompt.ts    ← 从 workspace 文件构建 system prompt
        ├── pi-tools.ts         ← 注册 OpenClaw 特有工具 (message, browser, etc.)
        ├── sandbox/            ← Docker 沙箱执行
        ├── session store       ← JSONL 会话持久化
        └── memory/             ← 向量搜索
```

### 关键发现

**OpenClaw 不直接调 OpenAI/Anthropic SDK。** 它用的是 **Pi 框架**（`@mariozechner/pi-*` 系列），这是一个三层架构：

| 层 | 包 | 作用 |
|----|---|------|
| LLM API | `@mariozechner/pi-ai` | 统一的多provider LLM调用，支持20+个provider，自动model发现，streaming+tool calling |
| Agent Core | `@mariozechner/pi-agent-core` | Agent抽象层，消息协议，状态管理 |
| Coding Agent | `@mariozechner/pi-coding-agent` | 编码Agent实现，内置read/write/bash工具，session管理，compaction |

其中 **`pi-ai`** 最有价值——它是一个统一的LLM SDK，把Anthropic、OpenAI、Google、Mistral等20+个provider统一成一个API。OpenClaw通过它调用所有AI模型。

---

## 2. 我们需要用这些框架吗？

### 分析

**我们的核心场景：在terminal里运行 Claude Code / Codex CLI。**

```bash
# 这就是我们的"AI调用"
claude -p "implement OAuth" --model claude-sonnet-4-6
# 或者
codex "implement OAuth"
```

我们**不需要**在代码层面调用 AI SDK，因为：
- Claude Code CLI 自己处理所有AI交互
- Codex CLI 自己处理所有AI交互
- 我们只需要**启动和管理CLI进程**

### 但是——如果将来要做 Orchestrator/Swarm Mode

Swarm Mode需要一个"Planner Agent"来分析代码库、拆解任务。这时候我们需要直接调AI：

```typescript
// Swarm Mode的Planner需要这样调AI
const plan = await callAI({
  model: "claude-opus-4-6",
  prompt: "分析这个codebase，拆解为并行子任务...",
  context: codebaseAnalysis
});
```

这时候 `pi-ai` 就很有价值——统一API、多provider支持、自动failover。

### 决定

| 阶段 | AI调用方式 | 是否需要SDK |
|------|-----------|------------|
| **MVP** | 通过 CLI 子进程 (`claude -p` / `codex`) | ❌ 不需要任何AI SDK |
| **Phase 2** (Swarm Mode) | Planner 需要直接调AI | ✅ 用 `pi-ai` 或 Vercel AI SDK |

**MVP阶段：零AI SDK依赖。我们只管理进程。**

---

## 3. 新架构方案（自建）

### 3.1 架构总览

```
┌─────────────────────────────────────────────────────┐
│              Browser (React + xterm.js)               │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Terminal Grid  │  Task Queue  │  Status Bar    │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────┬────────────────────────────────┘
                       │ WebSocket
                       ▼
┌──────────────────────────────────────────────────────┐
│              Pawral Server (Node.js)                  │
│                                                       │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ WebSocket  │  │ Task       │  │ Worker        │  │
│  │ API Server │  │ Scheduler  │  │ Manager       │  │
│  │ (ws)       │  │            │  │               │  │
│  └─────┬──────┘  └──────┬─────┘  └───────┬───────┘  │
│        │                │                 │          │
│  ┌─────┴──────┐  ┌──────┴─────┐  ┌───────┴───────┐  │
│  │ Terminal   │  │ Git Ops    │  │ Budget        │  │
│  │ Manager   │  │ (simple-git│  │ Tracker       │  │
│  │ (node-pty)│  │  + gh CLI) │  │               │  │
│  └────────────┘  └────────────┘  └───────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │              SQLite (better-sqlite3)            │  │
│  │   tasks │ workers │ budget_log │ pr_history    │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
         │
         │ node-pty spawn
         ▼
┌──────────────────────────────────────────────────────┐
│              Worker Processes (×6)                     │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ worker-1 │  │ worker-2 │  │ worker-3 │          │
│  │ pty/bash │  │ pty/bash │  │ pty/bash │          │
│  │ cwd:     │  │ cwd:     │  │ cwd:     │          │
│  │ ~/swarm/ │  │ ~/swarm/ │  │ ~/swarm/ │          │
│  │ worker-1/│  │ worker-2/│  │ worker-3/│          │
│  └──────────┘  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ worker-4 │  │ worker-5 │  │ worker-6 │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                       │
│  每个 worker = 一个持久 bash shell (node-pty)          │
│  任务执行 = 在 shell 里运行:                           │
│    claude -p "prompt" --model sonnet                  │
│    codex "prompt"                                     │
└──────────────────────────────────────────────────────┘
```

### 3.2 核心模块设计

#### Terminal Manager（终端管理器）

```typescript
// packages/server/src/terminal-manager.ts
import { spawn, IPty } from "@lydell/node-pty";

interface WorkerTerminal {
  id: string;                    // "worker-1" ~ "worker-6"
  pty: IPty;                     // node-pty 实例
  workspace: string;             // ~/swarm-workspaces/worker-1/
  status: "idle" | "running" | "error";
  currentTask: Task | null;
  output: string[];              // 最近的输出缓冲（用于状态解析）
  startedAt: number | null;
}

class TerminalManager {
  private workers: Map<string, WorkerTerminal> = new Map();

  // 初始化6个持久bash shell
  init(workerCount: number, basePath: string) {
    for (let i = 1; i <= workerCount; i++) {
      const id = `worker-${i}`;
      const workspace = `${basePath}/${id}`;
      const pty = spawn("bash", [], {
        name: "xterm-256color",
        cols: 120,
        rows: 40,
        cwd: workspace,
        env: process.env,
      });

      // 监听输出，转发给前端 + 解析状态
      pty.onData((data) => {
        this.handleOutput(id, data);
      });

      this.workers.set(id, { id, pty, workspace, status: "idle", currentTask: null, output: [], startedAt: null });
    }
  }

  // 在worker的shell里执行命令
  exec(workerId: string, command: string) {
    const worker = this.workers.get(workerId);
    if (!worker) throw new Error(`Worker ${workerId} not found`);
    worker.pty.write(command + "\r");
  }

  // 获取worker的pty（给xterm.js WebSocket转发用）
  getPty(workerId: string): IPty | undefined {
    return this.workers.get(workerId)?.pty;
  }

  // 调整terminal大小
  resize(workerId: string, cols: number, rows: number) {
    this.workers.get(workerId)?.pty.resize(cols, rows);
  }

  // 手动输入
  write(workerId: string, data: string) {
    this.workers.get(workerId)?.pty.write(data);
  }
}
```

#### Task Scheduler（任务调度器）

```typescript
// packages/server/src/task-scheduler.ts

interface Task {
  id: string;
  title: string;
  prompt: string;
  repo: string;
  branch: string;
  priority: "high" | "medium" | "low";
  model: string;                 // "claude-sonnet-4-6" | "codex" | etc.
  agent: "claude" | "codex";     // 使用哪个CLI
  budgetLimit: number;
  dependsOn: string[];
  status: "queued" | "assigned" | "running" | "pr" | "done" | "failed";
  assignedWorker: string | null;
  createdAt: number;
  completedAt: number | null;
  cost: number;
}

class TaskScheduler {
  constructor(
    private db: Database,              // SQLite
    private terminalManager: TerminalManager,
    private gitOps: GitOps,
  ) {}

  // 添加任务到队列
  enqueue(task: Omit<Task, "id" | "status" | "assignedWorker" | "createdAt" | "completedAt" | "cost">) {
    // 写入 SQLite
  }

  // 核心调度循环
  async tick() {
    // 1. 找到空闲的worker
    const idleWorkers = this.terminalManager.getIdleWorkers();
    if (idleWorkers.length === 0) return;

    // 2. 找到可执行的任务（优先级最高 + 依赖已完成）
    const nextTask = this.db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'queued'
      AND NOT EXISTS (
        SELECT 1 FROM tasks AS dep
        WHERE dep.id IN (SELECT value FROM json_each(tasks.depends_on))
        AND dep.status != 'done'
      )
      ORDER BY
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        created_at ASC
      LIMIT 1
    `).get();

    if (!nextTask) return;

    // 3. 分配
    const worker = idleWorkers[0];
    await this.assign(nextTask, worker);
  }

  // 分配任务给worker
  async assign(task: Task, worker: WorkerTerminal) {
    // 更新状态
    task.status = "assigned";
    task.assignedWorker = worker.id;
    this.db.update(task);

    // Git准备
    await this.gitOps.prepare(worker.workspace, task.repo, task.branch);

    // 构建CLI命令
    const cmd = this.buildCommand(task);

    // 在worker的terminal里执行
    worker.status = "running";
    worker.currentTask = task;
    worker.startedAt = Date.now();
    this.terminalManager.exec(worker.id, cmd);
  }

  // 构建AI CLI命令
  private buildCommand(task: Task): string {
    if (task.agent === "claude") {
      return `claude -p "${this.escapePrompt(task.prompt)}" --model ${task.model} --dangerously-skip-permissions`;
    }
    if (task.agent === "codex") {
      return `codex "${this.escapePrompt(task.prompt)}"`;
    }
    throw new Error(`Unknown agent: ${task.agent}`);
  }
}
```

#### Git Operations

```typescript
// packages/server/src/git-ops.ts
import simpleGit from "simple-git";

class GitOps {
  // 初始化workspace（首次clone）
  async setup(workspace: string, repoUrl: string) {
    if (!fs.existsSync(path.join(workspace, ".git"))) {
      await simpleGit().clone(repoUrl, workspace);
    }
  }

  // 任务开始前：fetch + checkout新branch
  async prepare(workspace: string, repoUrl: string, branchName: string) {
    const git = simpleGit(workspace);
    await git.fetch("origin");
    await git.checkout("main");
    await git.pull("origin", "main");
    await git.checkoutLocalBranch(branchName);
  }

  // 任务完成后：commit + push + 创建PR
  async finalize(workspace: string, commitMsg: string, branchName: string) {
    const git = simpleGit(workspace);
    await git.add(".");
    await git.commit(commitMsg);
    await git.push("origin", branchName);
    // 使用gh CLI创建PR
    const { stdout } = await exec(`gh pr create --title "${commitMsg}" --body "Created by Pawral" --label pawral`, { cwd: workspace });
    return stdout.trim(); // PR URL
  }

  // 冲突检查
  async checkConflict(workspace: string): Promise<boolean> {
    const git = simpleGit(workspace);
    try {
      await git.raw(["merge", "--no-commit", "--no-ff", "origin/main"]);
      await git.raw(["merge", "--abort"]);
      return false; // 无冲突
    } catch {
      await git.raw(["merge", "--abort"]).catch(() => {});
      return true; // 有冲突
    }
  }
}
```

#### WebSocket API（前端通信）

```typescript
// packages/server/src/ws-server.ts

// 前端 ↔ Server 的 WebSocket 协议
type ServerMessage =
  | { type: "terminal.data"; workerId: string; data: string }
  | { type: "worker.status"; workerId: string; status: WorkerStatus }
  | { type: "task.updated"; task: Task }
  | { type: "budget.updated"; budget: BudgetSummary }
  | { type: "activity"; event: ActivityEvent }
  | { type: "alert"; alert: Alert };

type ClientMessage =
  | { type: "terminal.input"; workerId: string; data: string }
  | { type: "terminal.resize"; workerId: string; cols: number; rows: number }
  | { type: "task.create"; task: NewTask }
  | { type: "task.assign"; taskId: string; workerId: string }
  | { type: "task.cancel"; taskId: string }
  | { type: "worker.kill"; workerId: string }
  | { type: "settings.update"; settings: Partial<Settings> };
```

#### Status Detector（状态检测）

```typescript
// packages/server/src/status-detector.ts

// 通过解析terminal输出检测worker状态
class StatusDetector {
  detect(workerId: string, output: string): WorkerPhase {
    // Claude Code 的输出模式
    if (output.includes("Planning...") || output.includes("⠋")) return "planning";
    if (output.includes("Writing") || output.includes("Creating")) return "coding";
    if (output.includes("Running tests") || output.includes("✓") || output.includes("✗")) return "testing";
    if (output.includes("PR created") || output.includes("gh pr create")) return "pr";
    if (output.includes("Error") || output.includes("FAILED")) return "error";

    // 检测进程是否结束（回到bash prompt）
    if (output.match(/\$\s*$/)) return "idle";

    return "running";
  }

  // 从claude输出解析token用量
  parseCost(output: string): { tokensIn: number; tokensOut: number; cost: number } | null {
    // Claude Code 在结束时会输出 token 统计
    const match = output.match(/Tokens: (\d+)k in \/ (\d+)k out/);
    if (match) {
      return {
        tokensIn: parseInt(match[1]) * 1000,
        tokensOut: parseInt(match[2]) * 1000,
        cost: this.estimateCost(parseInt(match[1]) * 1000, parseInt(match[2]) * 1000),
      };
    }
    return null;
  }
}
```

### 3.3 数据模型 (SQLite)

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',  -- high/medium/low
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  agent TEXT NOT NULL DEFAULT 'claude',     -- claude/codex
  budget_limit REAL DEFAULT 3.0,
  depends_on TEXT DEFAULT '[]',             -- JSON array of task ids
  status TEXT NOT NULL DEFAULT 'queued',
  assigned_worker TEXT,
  pr_url TEXT,
  cost REAL DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error_message TEXT
);

CREATE TABLE budget_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id TEXT NOT NULL,
  task_id TEXT,
  cost REAL NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 默认设置
INSERT INTO settings VALUES ('worker_count', '6');
INSERT INTO settings VALUES ('workspace_base', '~/swarm-workspaces');
INSERT INTO settings VALUES ('daily_budget', '50');
INSERT INTO settings VALUES ('weekly_budget', '200');
INSERT INTO settings VALUES ('default_model', 'claude-sonnet-4-6');
INSERT INTO settings VALUES ('default_agent', 'claude');
INSERT INTO settings VALUES ('auto_pr', 'true');
```

### 3.4 Phase 2: Swarm Mode（AI直接调用）

当需要 Planner Agent 时，引入 `pi-ai`：

```typescript
// packages/server/src/swarm/planner.ts (Phase 2)
import { getModel, streamSimple, Context, Tool, Type } from "@mariozechner/pi-ai";

class SwarmPlanner {
  async decompose(goal: string, repoPath: string): Promise<TaskPlan[]> {
    const model = getModel("anthropic", "claude-opus-4-6");

    // 分析codebase结构
    const codebaseInfo = await this.analyzeCodebase(repoPath);

    const context = new Context();
    context.addSystemMessage(`You are a task decomposition expert...`);
    context.addUserMessage(`
      Goal: ${goal}
      Codebase: ${codebaseInfo}
      
      Decompose into parallel sub-tasks. Output JSON.
    `);

    const result = await streamSimple({ model, context });
    return JSON.parse(result.text);
  }
}
```

**为什么选 `pi-ai` 而不是直接用 Anthropic SDK？**
- 统一API：如果用户要用OpenAI/Gemini的模型做Planner，不用改代码
- 自动model发现：`getModel("anthropic", "claude-opus-4-6")` 自动处理认证
- Tool calling：统一的工具定义格式
- OpenClaw同款，生态一致

---

## 4. 依赖对比

### MVP（零AI SDK）

```
pawral/packages/server:
  @lydell/node-pty        ← Terminal管理
  ws                      ← WebSocket
  simple-git              ← Git操作
  better-sqlite3          ← 数据持久化
  express                 ← HTTP (health check + static serve)
  zod                     ← Schema验证
  commander               ← CLI
  chalk                   ← 彩色输出
  dotenv                  ← 环境变量

pawral/packages/web:
  react + react-dom       ← UI框架
  @xterm/xterm            ← Terminal渲染
  zustand                 ← 状态管理
  tailwindcss             ← 样式
  vite                    ← 构建
```

总共 ~15个依赖。极简。

### Phase 2（加入Planner）

```
+ @mariozechner/pi-ai    ← 统一LLM API（用于Swarm Planner）
```

只多一个依赖。

---

## 5. 与其他方案的对比

| 方案 | 复杂度 | AI调用方式 | 依赖数 | 适合场景 |
|------|--------|-----------|--------|---------|
| **Pawral (自建)** | 低 | CLI子进程 | ~15 | ✅ 我们的场景 |
| OpenClaw集成 | 高 | Gateway RPC + pi-ai | ~60+ | 聊天机器人 |
| CrewAI | 中 | Python SDK | Python生态 | 多角色协作 |
| LangGraph | 高 | Python SDK | Python生态 | 复杂工作流 |
| 直接用Anthropic SDK | 中 | SDK调用 | ~5 | 需要自建tool系统 |

---

## 6. 总结

```
MVP: 进程管理（node-pty） + 任务队列（SQLite） + Git（simple-git） + UI（React+xterm.js）
     零AI SDK，AI能力全部通过CLI子进程（claude/codex）获得

Phase 2: + pi-ai 用于 Swarm Planner 的直接AI调用
```

**核心原则：我们不是在做AI框架，我们是在做AI工具的管理界面。CLI就是我们的API。**
