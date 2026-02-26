# Pawral — 技术选型

> 参照 OpenClaw 的工程实践，保持一致的开发体验。

---

## 1. 总览

| 领域 | 选型 | 对齐 OpenClaw |
|------|------|--------------|
| 运行时 | Node.js >= 22.12.0 | ✅ 一致 |
| 模块系统 | ESM (`"type": "module"`) | ✅ 一致 |
| 语言 | TypeScript (strict mode) | ✅ 一致 |
| 包管理 | pnpm 10.x | ✅ 一致 |
| Monorepo | pnpm workspace | ✅ 一致 |
| 构建 | tsdown (backend) + Vite (frontend) | ✅ OpenClaw用tsdown+Vite(UI) |
| Lint | oxlint (type-aware) | ✅ 一致 |
| Format | oxfmt | ✅ 一致 |
| 测试 | Vitest | ✅ 一致 |
| CI | GitHub Actions | ✅ 一致 |

---

## 2. 项目结构

```
pawral/
├── packages/
│   ├── server/              # Terminal Server (node-pty + WebSocket)
│   │   ├── src/
│   │   │   ├── index.ts           # 入口
│   │   │   ├── terminal-manager.ts # pty 管理
│   │   │   ├── ws-server.ts       # WebSocket server
│   │   │   ├── task-queue.ts      # 任务队列逻辑
│   │   │   ├── git-ops.ts         # Git 操作 (clone/checkout/push/PR)
│   │   │   ├── gateway-client.ts  # OpenClaw Gateway RPC 客户端
│   │   │   ├── budget-tracker.ts  # 预算追踪
│   │   │   └── types.ts
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                 # Frontend (React + xterm.js)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── TerminalGrid.tsx
│       │   │   ├── TerminalPanel.tsx
│       │   │   ├── StatusBar.tsx
│       │   │   ├── TaskQueue.tsx
│       │   │   ├── TaskCard.tsx
│       │   │   ├── NewTaskModal.tsx
│       │   │   ├── BudgetPanel.tsx
│       │   │   ├── PRDashboard.tsx
│       │   │   ├── ActivityFeed.tsx
│       │   │   ├── WorkerHoverCard.tsx
│       │   │   └── Settings.tsx
│       │   ├── hooks/
│       │   │   ├── useGateway.ts    # OpenClaw Gateway RPC hook
│       │   │   ├── useTerminal.ts   # xterm.js + WebSocket hook
│       │   │   ├── useTaskQueue.ts
│       │   │   └── useBudget.ts
│       │   ├── stores/              # Zustand state management
│       │   │   ├── workers.ts
│       │   │   ├── tasks.ts
│       │   │   └── settings.ts
│       │   └── lib/
│       │       ├── gateway-rpc.ts   # OpenClaw Gateway WebSocket RPC
│       │       └── types.ts
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── docs/                    # 文档
│   ├── PRD.md
│   ├── DESIGN-PROMPTS.md
│   ├── TECH-STACK.md
│   └── design-references/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── .oxlintrc.json
├── tsconfig.json            # root tsconfig (references)
├── vitest.config.ts
├── pnpm-workspace.yaml
├── package.json
├── README.md
└── .gitignore
```

---

## 3. 依赖详情

### 3.1 Server (`packages/server`)

```json
{
  "dependencies": {
    "@lydell/node-pty": "latest",    // PTY 管理（OpenClaw 同款）
    "ws": "^8.x",                    // WebSocket server
    "simple-git": "^3.x",           // Git 操作
    "better-sqlite3": "^11.x",      // 任务队列持久化
    "json5": "^2.x",                // 配置解析（OpenClaw 同款）
    "chalk": "^5.x",                // CLI 彩色输出（OpenClaw 同款）
    "commander": "^13.x",           // CLI 参数解析（OpenClaw 同款）
    "dotenv": "^16.x",              // 环境变量（OpenClaw 同款）
    "zod": "^3.x",                  // Schema 验证（OpenClaw 同款）
    "express": "^5.x"               // HTTP server (for health check + static serve)
  },
  "devDependencies": {
    "@types/ws": "^8.x",
    "@types/better-sqlite3": "^7.x",
    "@types/node": "^22.x",
    "typescript": "^5.x",
    "tsdown": "latest",             // Build（OpenClaw 同款）
    "tsx": "latest"                 // Dev runner（OpenClaw 同款）
  }
}
```

### 3.2 Web (`packages/web`)

```json
{
  "dependencies": {
    "react": "^19.x",
    "react-dom": "^19.x",
    "@xterm/xterm": "^5.x",         // Terminal 渲染
    "@xterm/addon-fit": "^0.10.x",  // Terminal 自适应
    "@xterm/addon-web-links": "^0.11.x",
    "zustand": "^5.x",              // 状态管理（轻量）
    "react-resizable-panels": "^2.x", // 可拖拽面板
    "@tanstack/react-query": "^5.x",  // 数据请求管理
    "lucide-react": "latest",        // 图标
    "tailwindcss": "^4.x",           // CSS框架
    "clsx": "^2.x"
  },
  "devDependencies": {
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "typescript": "^5.x",
    "vite": "^6.x",                  // Build（OpenClaw UI 同款）
    "@vitejs/plugin-react": "^4.x"
  }
}
```

---

## 4. 工具链配置

### 4.1 TypeScript (`tsconfig.json` root)

```json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["DOM", "DOM.Iterable", "ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "es2023"
  },
  "references": [
    { "path": "./packages/server" },
    { "path": "./packages/web" }
  ]
}
```

### 4.2 Lint (`.oxlintrc.json`)

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["unicorn", "typescript", "oxc"],
  "categories": {
    "correctness": "error",
    "perf": "error",
    "suspicious": "error"
  },
  "rules": {
    "curly": "error",
    "typescript/no-explicit-any": "error",
    "unicorn/consistent-function-scoping": "off"
  },
  "ignorePatterns": [
    "dist/",
    "node_modules/",
    "*.config.*"
  ]
}
```

### 4.3 Format

oxfmt（零配置，OpenClaw 同款）。

### 4.4 Vitest (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    pool: "forks",
    include: [
      "packages/server/src/**/*.test.ts",
      "packages/server/test/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["packages/server/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
    },
  },
});
```

### 4.5 pnpm workspace (`pnpm-workspace.yaml`)

```yaml
packages:
  - packages/*
```

---

## 5. Scripts

```json
{
  "scripts": {
    "dev": "pnpm --filter @pawral/server dev & pnpm --filter @pawral/web dev",
    "dev:server": "pnpm --filter @pawral/server dev",
    "dev:web": "pnpm --filter @pawral/web dev",
    "build": "pnpm --filter @pawral/server build && pnpm --filter @pawral/web build",
    "lint": "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix && pnpm format",
    "format": "oxfmt --write",
    "format:check": "oxfmt --check",
    "check": "pnpm format:check && tsc --noEmit && pnpm lint",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "prepare": "git config core.hooksPath git-hooks || true"
  }
}
```

---

## 6. CI (`ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  lint-format:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint

  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: tsc --noEmit

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint-format, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

---

## 7. 开发流程

```
# 初始化
pnpm install

# 开发（同时启动 server + web）
pnpm dev

# 只启动前端
pnpm dev:web

# 检查（CI同款）
pnpm check

# 测试
pnpm test

# 构建
pnpm build
```

---

## 8. 与 OpenClaw 对齐总结

| 工具 | OpenClaw | Pawral | 说明 |
|------|---------|--------|------|
| 包管理 | pnpm 10.x | pnpm 10.x | ✅ |
| Monorepo | pnpm workspace | pnpm workspace | ✅ |
| 语言 | TypeScript strict | TypeScript strict | ✅ |
| 模块 | ESM | ESM | ✅ |
| Node | >= 22.12 | >= 22.12 | ✅ |
| Lint | oxlint (type-aware) | oxlint (type-aware) | ✅ |
| Format | oxfmt | oxfmt | ✅ |
| Test | Vitest + v8 coverage | Vitest + v8 coverage | ✅ |
| Build (backend) | tsdown | tsdown | ✅ |
| Build (frontend) | Vite (Lit) | Vite (React) | React代替Lit |
| Terminal | @lydell/node-pty | @lydell/node-pty | ✅ 同一个fork |
| Schema | Zod | Zod | ✅ |
| CLI | Commander | Commander | ✅ |
| CI | GitHub Actions | GitHub Actions | ✅ |
| Git hooks | git-hooks/ dir | git-hooks/ dir | ✅ |

唯一差异：前端用 **React** 而非 Lit（OpenClaw UI用Lit），因为 React 生态对 xterm.js 和拖拽布局支持更好。
