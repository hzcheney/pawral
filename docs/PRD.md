# PRD: Pawral — AI Coding Agent 并行指挥中心

> Version: 0.2 (OpenClaw-Native)
> Author: 大壮 + Cheney
> Date: 2025-07-11

---

## 1. 产品概述

### 1.1 一句话定义
**Pawral** 是一个基于 OpenClaw Gateway 的浏览器端多Agent可视化指挥中心，利用 OpenClaw 原生的多Agent配置、Session隔离和Subagent编排能力，同时运行多个AI Coding Agent并行处理编码任务。

### 1.2 核心价值
- 一个人 = 一个6人编程团队
- **基于 OpenClaw 生态**，不重复造轮子，直接复用Gateway的Agent管理、Session管理、Tool Policy、Sandbox等能力
- 可视化管控所有agent的工作状态
- 从"手动操作terminal"升级为"指挥swarm完成目标"

### 1.3 目标用户
- 独立开发者 / 小团队 lead
- 已经在用 OpenClaw + Claude Code / Codex 的开发者
- 需要同时推进多个feature/bugfix

---

## 2. 核心设计：基于 OpenClaw 的编排方案

### 2.1 为什么选择 OpenClaw

OpenClaw 已经原生支持我们需要的所有编排能力：

| 需求 | OpenClaw 原生能力 |
|------|-------------------|
| 多Agent隔离运行 | `agents.list[]` — 每个agent独立workspace、session、memory |
| 任务分配和通信 | `sessions_spawn` + `sessions_send` — 异步任务委派+跨session通信 |
| 工具权限控制 | Tool Policy Chain — 全局/Agent/Subagent分层权限 |
| 安全沙箱 | Sandbox System — Docker容器隔离执行 |
| 实时状态 | Gateway WebSocket RPC — `sessions.list`、`gateway.status` |
| 配置热更新 | Hot-reload — 动态增减agent无需重启 |
| Agent管理API | `agents.create/update/delete` — 程序化管理agent |

### 2.2 架构总览

```
┌─────────────────────────────────────────────────────┐
│              Browser Frontend (React)                │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │         Control Bar (顶部)                      │  │
│  │  [+ New Task] [Swarm Mode] [Budget: $12/$50]   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ worker-1 │ │ worker-2 │ │ worker-3 │            │
│  │ 🟢 Coding│ │ 🟡 Plan  │ │ ⚪ Idle  │            │
│  │ [xterm]  │ │ [xterm]  │ │          │            │
│  ├──────────┤ ├──────────┤ ├──────────┤            │
│  │ worker-4 │ │ worker-5 │ │ worker-6 │            │
│  │ 🔵 PR'd  │ │ 🔴 Stuck │ │ ⚪ Idle  │            │
│  │ [xterm]  │ │ [xterm]  │ │          │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │       Task Queue / Dependency Graph             │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────┬───────────┘
                                           │
                              WebSocket RPC (ws://localhost:18789)
                                           │
┌──────────────────────────────────────────▼───────────┐
│              OpenClaw Gateway (Port 18789)             │
│                                                       │
│  agents.list:                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │worker-1 │ │worker-2 │ │worker-3 │  ...×6         │
│  │workspace│ │workspace│ │workspace│                 │
│  │sessions │ │sessions │ │sessions │                 │
│  │memory   │ │memory   │ │memory   │                 │
│  └─────────┘ └─────────┘ └─────────┘                │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Orchestrator │  │ Tool Policy  │  │ Sandbox    │  │
│  │ Agent (main) │  │ Resolution   │  │ Containers │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
└───────────────────────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────┐
│              Local Filesystem                          │
│                                                       │
│  ~/swarm-workspaces/                                  │
│    ├── worker-1/  (独立 git clone)                    │
│    │   ├── IDENTITY.md ("I am Worker 1")              │
│    │   ├── AGENTS.md (coding instructions)            │
│    │   └── .git/                                      │
│    ├── worker-2/  (独立 git clone)                    │
│    ├── worker-3/                                      │
│    ├── worker-4/                                      │
│    ├── worker-5/                                      │
│    └── worker-6/                                      │
└───────────────────────────────────────────────────────┘
```

### 2.3 OpenClaw 配置设计

**openclaw.json (核心配置)**

```json
{
  agents: {
    defaults: {
      model: { primary: "anthropic/claude-sonnet-4-6" },
      tools: {
        profile: "coding",
        allow: ["group:fs", "group:runtime", "group:sessions"],
        deny: ["browser", "canvas", "cron", "message"]
      },
      sandbox: {
        mode: "all",        // 所有worker都在沙箱里跑
        scope: "agent",     // 每个worker一个容器
        workspaceAccess: "rw"
      },
      memorySearch: { enabled: true, provider: "openai" }
    },
    list: [
      // Orchestrator — 总调度Agent，不直接编码
      {
        id: "orchestrator",
        default: true,
        workspace: "~/.openclaw/workspace-swarm/orchestrator",
        model: { primary: "anthropic/claude-opus-4-6" },
        tools: {
          profile: "full",
          allow: ["sessions_spawn", "sessions_send", "sessions_list", "sessions_history"]
        },
        sandbox: { mode: "off" }  // orchestrator不需要沙箱
      },
      // Worker Agents — 实际编码
      { id: "worker-1", workspace: "~/swarm-workspaces/worker-1" },
      { id: "worker-2", workspace: "~/swarm-workspaces/worker-2" },
      { id: "worker-3", workspace: "~/swarm-workspaces/worker-3" },
      { id: "worker-4", workspace: "~/swarm-workspaces/worker-4" },
      { id: "worker-5", workspace: "~/swarm-workspaces/worker-5" },
      { id: "worker-6", workspace: "~/swarm-workspaces/worker-6" }
    ]
  },

  // Bindings: 前端通过accountId路由到对应worker
  bindings: [
    { agentId: "worker-1", match: { accountId: "worker-1" } },
    { agentId: "worker-2", match: { accountId: "worker-2" } },
    { agentId: "worker-3", match: { accountId: "worker-3" } },
    { agentId: "worker-4", match: { accountId: "worker-4" } },
    { agentId: "worker-5", match: { accountId: "worker-5" } },
    { agentId: "worker-6", match: { accountId: "worker-6" } },
    { agentId: "orchestrator" }  // catch-all
  ]
}
```

### 2.4 编排流程（使用 OpenClaw 原生能力）

**方案A：Orchestrator Agent 主动分发**

```
用户创建Task → Frontend通过Gateway RPC发送给Orchestrator
                         │
            Orchestrator (claude-opus) 收到任务
                         │
            ┌────────────┼───────────────┐
            ▼            ▼               ▼
   sessions_spawn   sessions_spawn   sessions_spawn
   → worker-1       → worker-2       → worker-3
   task: "实现OAuth" task: "加SAML"   task: "写测试"
            │            │               │
            ▼            ▼               ▼
   worker在自己的     worker在自己的    worker在自己的
   workspace编码      workspace编码     workspace编码
            │            │               │
            ▼            ▼               ▼
   sessions_send     sessions_send    sessions_send
   → orchestrator    → orchestrator   → orchestrator
   "完成，PR #142"    "完成，PR #143"   "完成，PR #144"
            │            │               │
            └────────────┼───────────────┘
                         ▼
            Orchestrator汇总结果 → 通知Frontend
```

**方案B：Frontend直接分发（简单模式）**

```
用户创建Task → Frontend直接通过Gateway RPC
               调用 agent.send 到对应worker
               │
               ├─→ agent.send(worker-1, "实现OAuth, repo: my-app")
               ├─→ agent.send(worker-2, "加SAML, repo: my-app")  
               └─→ agent.send(worker-3, "写测试, repo: my-app")
               
Frontend轮询 sessions.list 获取worker状态
```

**推荐：MVP用方案B（简单直接），Phase 2升级为方案A（Orchestrator智能调度）**

### 2.5 Agent间通信

利用 OpenClaw 的 `sessions_*` 工具族实现：

| 场景 | OpenClaw工具 | 说明 |
|------|-------------|------|
| 分配任务给worker | `sessions_spawn` 或 `agent.send` (RPC) | Orchestrator或Frontend发起 |
| Worker报告完成 | `sessions_send` → orchestrator session | Worker主动汇报 |
| Worker间共享信息 | `sessions_send` → 另一个worker的session | 如"我改了auth接口" |
| 查看Worker进度 | `sessions_history(workerSessionKey)` | Frontend或Orchestrator拉取 |
| 列出所有活跃session | `sessions.list` (Gateway RPC) | Frontend定期轮询 |

### 2.6 Worker的AGENTS.md模板

每个Worker workspace里放统一的 `AGENTS.md`：

```markdown
# Worker Agent Instructions

你是Pawral的一个编码Worker。你的职责：

1. 收到编码任务后，在当前workspace执行
2. 遵循以下流程：
   - 分析任务需求
   - git fetch && git checkout -b swarm/{task-id}-{short-title}
   - 编码实现
   - 运行测试（如有）
   - git add . && git commit -m "{描述}" && git push origin HEAD
   - 创建PR（使用GitHub CLI: gh pr create）
3. 完成后通过sessions_send通知orchestrator
4. 如果遇到问题/卡住，也通过sessions_send汇报

## 约束
- 只修改当前workspace的文件
- 不要修改其他worker的文件
- Budget意识：如果任务过大，建议拆分
```

---

## 3. 功能模块

### 3.1 Terminal Grid（核心视图）

**布局**
- 默认 3×2 网格，每个格子 = 一个Worker Agent的Terminal
- 支持 2×2、3×2、4×2、自定义布局
- 操作：
  - **单击**：聚焦（输入命令）
  - **双击**：全屏放大，ESC返回网格
  - **拖拽边框**：调整大小
  - **右键菜单**：重启worker、查看session历史、终止任务

**Terminal头部信息栏**
```
┌─────────────────────────────────────────┐
│ 🟢 worker-1 │ auth-refactor │ my-app   │
│ ██████░░░░ 60% │ $1.20 │ 12min        │
├─────────────────────────────────────────┤
│ (xterm.js terminal output)              │
│                                         │
└─────────────────────────────────────────┘
```

头部信息：
- **状态灯**：🟢 Coding / 🟡 Planning / 🔵 PR Created / 🔴 Error / ⚪ Idle
- **Worker ID**：对应 `agents.list` 中的 id
- **任务名称**：当前task简短描述
- **Repo名**：当前checkout的repo
- **进度条**：基于阶段估算（plan→code→test→PR）
- **花费**：通过 `session_status` 获取token费用
- **耗时**：从任务开始计时

**状态获取方式**（全部通过OpenClaw Gateway RPC）：
- `sessions.list` → 获取所有worker session的活跃状态
- `sessions.history(sessionKey)` → 获取worker的对话历史，解析最新状态
- `gateway.status` → 获取Gateway整体健康状态

### 3.2 Task Queue（任务队列）

**任务创建**
- 手动输入：填 prompt + 选 repo + 选优先级 + 选model
- 从 GitHub Issues 导入：粘贴 issue URL
- 从 Linear 导入：选 issue
- 批量导入：粘贴多行任务描述

**任务数据模型**
```javascript
interface Task {
  id: string;
  title: string;
  prompt: string;
  repo: string;              // GitHub repo URL
  branch_prefix: string;     // 默认 "swarm/"
  priority: "high" | "medium" | "low";
  model: "auto" | string;   // 可指定模型，auto由系统选择
  budget_limit: number;      // 单task上限 $
  depends_on: string[];      // 依赖的task id
  status: "queued" | "assigned" | "running" | "pr" | "done" | "failed";
  assigned_worker: string | null;  // worker agent id
  session_key: string | null;      // OpenClaw session key
  auto_pr: boolean;
  created_at: string;
  completed_at: string | null;
  cost: number;              // 实际花费
}
```

**队列视图（三种模式）**
1. **列表模式**：拖拽排序优先级
2. **看板模式**：Queued → Running → PR → Done
3. **依赖图模式**：节点=task，边=依赖，颜色=状态

**调度逻辑（Frontend实现，MVP）**

```
1. 检查空闲worker（通过 sessions.list 找到 idle 的agent）
2. 从队列取最高优先级 + 无未完成依赖的task
3. 执行分配：
   a. 通过 Gateway RPC agent.send 将task发送给worker
   b. 消息内容包含：
      - Task prompt
      - Repo URL + branch命名规则
      - 完成后的汇报指令
   c. 更新task状态为 assigned
4. Worker开始工作后，Frontend通过 sessions.list 监控状态
5. Worker完成后（解析session history），更新task为 done
```

### 3.3 状态感知面板

**全局状态栏（顶部常驻）**
```
[Swarm]  Active: 4/6  │  Queue: 7  │  Today: 12 done  │  Budget: $18.50/$50.00  │  Gateway: 🟢
```

数据来源：
- Active/Idle: `sessions.list` → 按agent过滤活跃session
- Queue: Frontend本地任务队列
- Budget: 聚合各worker的 `session_status`
- Gateway: `gateway.health` RPC

**Agent详情悬浮卡（hover）**
```
worker-3 — 🟢 Coding
━━━━━━━━━━━━━━━━━━━━
Task:     auth-refactor (#task-012)
Repo:     my-app → swarm/task-012-auth
Model:    claude-sonnet-4-6
Session:  agent:worker-3:swarm:task-012
Started:  14:32 (18min ago)
Cost:     $1.20
Phase:    Coding (3/5 files)
━━━━━━━━━━━━━━━━━━━━
[View Session] [Pause] [Kill] [Reassign]
```

**实时活动流（侧边栏）**
```
14:50  worker-1  ✅ PR #142 created
14:48  worker-5  🔴 Tests failed, retrying
14:45  worker-2  🟢 Started: task-015
14:40  worker-4  🟡 Planning: task-018
```

数据来源：轮询 `sessions.history` 解析各worker最新消息

**告警系统**
- Worker卡住 > 5min无新消息 → 黄色警告
- Worker卡住 > 15min → 红色警告 + 浏览器通知
- Task失败 → 自动重试1次（发新消息给worker），仍失败标红
- Budget 80% → 警告，100% → 暂停分配新任务

### 3.4 Budget控制

**三级预算**

| 级别 | 实现方式 | 说明 |
|------|---------|------|
| Per-Task | Frontend在task分配时传入limit | Worker的AGENTS.md指示尊重budget |
| Per-Worker | 通过 `session_status` 监控 | 达到上限暂停该worker |
| Global | Frontend聚合所有worker花费 | 总池耗尽暂停所有分配 |

**Model智能路由**
- Task标记 `model: auto` 时：
  - 简单task（typo、小改动）→ 用便宜模型如 `claude-sonnet`
  - 复杂task（架构重构）→ 用强模型如 `claude-opus`
- 通过 OpenClaw 的 per-agent model override实现：动态 `config.patch` 修改worker的model

**Budget面板**
```
┌─ Budget Dashboard ──────────────────────┐
│ Today:     $18.50 / $50.00  [████░░] 37%│
│ This Week: $42.00 / $200.00 [██░░░░] 21%│
│                                          │
│ worker-1: $3.20   worker-4: $2.10       │
│ worker-2: $1.80   worker-5: $4.50       │
│ worker-3: $2.90   worker-6: $0.00       │
│                                          │
│ [Edit Limits] [Pause All] [Reset]        │
└──────────────────────────────────────────┘
```

### 3.5 Git & PR管理

**Checkout策略**
```
~/swarm-workspaces/
  ├── worker-1/        # worker-1 的独立 git clone
  │   ├── .git/
  │   ├── IDENTITY.md  # "I am Worker 1"
  │   └── AGENTS.md    # 编码指令模板
  ├── worker-2/        # worker-2 的独立 git clone（同repo）
  ├── worker-3/
  ├── worker-4/        # 可能是不同repo
  ├── worker-5/
  └── worker-6/
```

- 每个worker = 独立完整clone，互不干扰
- 命名规则：`worker-{N}`（固定编号）
- 任务开始：`git fetch origin && git checkout -b swarm/{task-id}-{title} origin/main`
- 任务结束：`git push origin HEAD` → `gh pr create`

**PR Dashboard（内嵌视图）**
- 列出所有swarm创建的PR（通过 `gh pr list --label swarm` 或类似）
- 状态：Open / Merged / Conflict
- 冲突预检：PR前 `git merge --no-commit origin/main` 检查
- 一键批量merge（无冲突的）
- 交叉Review（P2功能）：worker-A完成 → worker-B review其PR

### 3.6 Swarm Mode（Phase 2 - Orchestrator驱动）

用户给出一个大目标，Orchestrator Agent自动拆解和分发：

```
用户: "重构整个认证模块，支持OAuth + SAML + API Key"
         │
         ▼
   Orchestrator (claude-opus) 分析codebase
         │
         ▼ 生成拆解方案
   ┌─────────────────────────────────────────────┐
   │ Task 1: 定义AuthProvider接口 (无依赖)        │
   │ Task 2: 实现OAuthProvider (依赖1)            │
   │ Task 3: 实现SAMLProvider (依赖1)             │
   │ Task 4: 实现APIKeyProvider (依赖1)           │
   │ Task 5: 重构登录流程 (依赖2,3,4)             │
   │ Task 6: 集成测试 (依赖5)                     │
   │                                              │
   │ 预估: 4 workers 并行, ~45min, ~$8            │
   │ [Approve & Start] [Edit] [Cancel]            │
   └─────────────────────────────────────────────┘
         │ 用户确认
         ▼
   Orchestrator通过 sessions_spawn 分发给workers
   Task 1→worker-1, Task 2,3,4 等待Task 1完成后分发
         │
         ▼
   所有完成后 → Orchestrator做最终检查
   → 汇总报告 → 通知用户
```

实现方式：
- Orchestrator Agent 有 `sessions_spawn` 和 `sessions_send` 权限
- 通过 `sessions_history` 监控各worker进度
- 依赖管理在Orchestrator的上下文中维护
- Frontend展示Orchestrator的拆解方案和执行进度

---

## 4. Frontend与Gateway的交互

### 4.1 WebSocket RPC 调用清单

| 前端操作 | Gateway RPC | 说明 |
|---------|------------|------|
| 启动时加载agent列表 | `agents.list` | 获取所有worker配置 |
| 发送task给worker | `agent.send` / `agent.execute` | 向指定agent发消息 |
| 获取worker状态 | `sessions.list` | 过滤活跃session |
| 获取worker对话历史 | `sessions.history` | 解析编码进度 |
| 获取worker花费 | `session_status` (per session) | Token使用量 |
| 动态修改worker模型 | `config.patch` | 热更新agent model |
| 增减worker数量 | `agents.create` / `agents.delete` | 动态扩缩 |
| 修改worker workspace | `agents.files.set` | 更新AGENTS.md等 |
| Gateway健康检查 | `gateway.health` | 状态栏显示 |

### 4.2 Terminal I/O

每个Terminal Grid格子需要连接到对应worker的实际执行环境：

**方案：xterm.js + WebSocket → node-pty**

Frontend的Terminal组件不直接连Gateway RPC，而是连一个**轻量Terminal Server**：

```
Browser (xterm.js) ←WebSocket→ Terminal Server (node.js)
                                    │
                                    ├── node-pty → worker-1 shell
                                    ├── node-pty → worker-2 shell
                                    └── node-pty → worker-N shell
```

Terminal Server是一个独立的小服务，专门做pty转发。Gateway RPC负责Agent逻辑编排，Terminal Server负责实时终端I/O。

两者配合：
- Gateway RPC：分配任务、监控状态、管理agent
- Terminal Server：显示实时terminal输出、允许手动输入

---

## 5. 页面/视图清单

| 视图 | 描述 | 数据来源 | 优先级 |
|------|------|---------|--------|
| Terminal Grid | 主界面，N个terminal网格 | Terminal Server (pty) | P0 |
| Agent Status Headers | 每个terminal顶部状态 | Gateway `sessions.list` + `sessions.history` | P0 |
| Global Status Bar | 顶部全局状态 | Gateway `gateway.health` + 聚合session数据 | P0 |
| Task Queue | 任务列表/看板 | Frontend本地 + SQLite | P0 |
| Budget Panel | 预算管理 | Gateway `session_status` 聚合 | P1 |
| PR Dashboard | PR列表和管理 | GitHub API / `gh` CLI | P1 |
| Activity Feed | 实时事件流 | Gateway `sessions.history` 轮询 | P1 |
| Settings | Agent数量、model、budget配置 | Gateway `config.get/set` | P1 |
| Swarm Mode | Orchestrator拆解+并行 | Gateway `sessions_spawn` chain | P2 |
| Dependency Graph | 可视化任务依赖 | Frontend本地 | P2 |
| Analytics | 历史统计 | SQLite本地存储 | P2 |

---

## 6. 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| Frontend | React + TypeScript | 主流、生态好 |
| Terminal | xterm.js + xterm-addon-fit | 浏览器terminal标准方案 |
| Layout | CSS Grid + react-resizable | 灵活网格 + 可拖拽 |
| Frontend→Gateway | WebSocket (OpenClaw RPC) | 原生对接Gateway |
| Frontend→Terminal | WebSocket (自建) | 实时pty I/O |
| Terminal Server | Node.js + node-pty + ws | 轻量pty WebSocket转发 |
| Task Queue | SQLite (better-sqlite3) | 本地持久化 |
| Git操作 | simple-git + gh CLI | Node.js git操作 + GitHub PR |
| 编排 | OpenClaw Gateway | 不重复造轮子 |

---

## 7. MVP范围（Phase 1）

**目标**：能用、能看、能控

**包含**：
- ✅ 3×2 Terminal Grid，支持聚焦/全屏
- ✅ 每个Terminal连接到对应worker的shell
- ✅ Agent状态头部栏（状态灯 + 任务名 + 耗时）
- ✅ 全局状态栏（Gateway连接状态 + 活跃worker数）
- ✅ 简单任务队列（手动创建，手动/自动分配）
- ✅ 通过Gateway RPC向worker发送编码任务
- ✅ Worker自动checkout到独立文件夹 + 自动PR
- ✅ 全局budget上限显示
- ✅ OpenClaw Gateway连接管理

**不包含（Phase 2+）**：
- ❌ Swarm Mode（Orchestrator自动拆解）
- ❌ 依赖图可视化
- ❌ 交叉Review
- ❌ 从Linear/GitHub Issues导入
- ❌ Model智能路由
- ❌ Analytics报表
- ❌ 动态增减worker数量

---

## 8. 用户流程

### 流程A：手动分配（MVP）
```
1. 打开浏览器 → 连接到OpenClaw Gateway
2. 看到6个Terminal Grid + 全局状态栏
3. 点 [+ New Task] → 填写prompt、选repo、选优先级
4. Task进入队列 → 选择一个idle的worker → 点 [Assign]
5. Frontend通过Gateway RPC发送任务给worker
6. Worker Terminal开始显示Claude Code的输出
7. 状态头变为 🟢 Coding → 🟡 Testing → 🔵 PR Created
8. 去GitHub review → merge
```

### 流程B：Swarm Mode（Phase 2）
```
1. 点 [Swarm Mode] → 输入大目标 + 选repo
2. Orchestrator Agent分析codebase → 生成子任务
3. Frontend展示拆解方案（任务列表+依赖图）
4. 用户确认 → [Approve & Start]
5. Orchestrator通过sessions_spawn分发到workers
6. 所有terminal同时开始工作
7. 依赖任务自动等待前置完成
8. 全部完成 → Orchestrator汇总 → 报告展示
```

---

## 9. 竞品对比

| 产品 | 多Agent | 可视化Grid | 任务编排 | 自动PR | 本地运行 |
|------|---------|-----------|---------|--------|---------|
| **Pawral** | ✅ 6+ | ✅ | ✅ OpenClaw | ✅ | ✅ |
| tmux/screen | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cursor/Windsurf | ❌ (单agent) | ❌ | ❌ | ❌ | ✅ |
| GitHub Copilot WS | ❌ (单agent) | ❌ | ❌ | ✅ | ❌ (云端) |
| Devin | ❌ (单agent) | ❌ | 部分 | ✅ | ❌ (云端) |
| CrewAI | ✅ | ❌ | ✅ (代码) | ❌ | ✅ |

**差异化**：唯一同时具备 **多Agent并行 + 可视化Terminal Grid + OpenClaw生态 + 本地运行** 的产品。

---

## 10. 风险和对策

| 风险 | 概率 | 对策 |
|------|------|------|
| Agent输出质量不一致 | 高 | Worker AGENTS.md规范 + 自动测试gate |
| PR冲突 | 中 | 冲突预检 + task设计避免改同文件 |
| Token费用失控 | 中 | 三级budget + session_status监控 |
| Gateway RPC延迟 | 低 | WebSocket长连接，本地部署延迟极低 |
| 6个terminal性能 | 低 | xterm.js性能好，非聚焦降低刷新率 |
| Worker workspace冲突 | 低 | 每个worker独立clone，物理隔离 |

---

## 11. 成功指标

- **效率**：同样任务量比单agent快 3-5x
- **完成率**：自动PR的merge rate > 70%
- **成本**：平均每个merged PR花费 < $5
- **延迟**：task分配到worker开始编码 < 10s
- **稳定性**：Gateway连接uptime > 99%

---

## 12. 开放问题

1. **产品名称**：Pawral? AgentGrid? CodeHive? SwarmDev?
2. **商业模式**：开源 + 付费Pro？纯开源？OpenClaw生态plugin？
3. **是否作为 OpenClaw Extension**：可以做成 `@openclaw/pawral` 插件，直接集成到Gateway的Control UI中
4. **远程Worker**：是否支持Worker运行在远程机器（通过OpenClaw Node）？
5. **VS Code集成**：是否做VS Code extension版本？
6. **多repo支持**：一个worker同时处理不同repo的task？还是固定绑定？

---

## 13. 下一步行动

- [ ] 确认产品名称
- [ ] 确认MVP技术栈细节
- [ ] 搭建项目repo
- [ ] 实现Terminal Server（node-pty + WebSocket）
- [ ] 实现Frontend Terminal Grid
- [ ] 对接OpenClaw Gateway RPC
- [ ] 实现Task Queue（本地SQLite）
- [ ] 集成Git操作（checkout + PR）
- [ ] 端到端测试：创建task → 分配worker → 编码 → PR
