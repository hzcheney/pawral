# 🐾 Pawral

**AI Coding Agent 并行指挥中心** — Parallel AI Workers, One Dashboard.

Pawral is a browser-based visual command center for orchestrating multiple AI coding agents (Claude Code / Codex) in parallel, powered by [OpenClaw](https://github.com/openclaw/openclaw).

## What is Pawral?

Imagine 6 AI coding agents working simultaneously on your project — each in its own terminal, its own git branch, auto-creating PRs when done. You just watch the dashboard and approve.

**One person = One 6-person dev team.**

## Features (Planned)

- 🖥️ **Terminal Grid** — 3×2 grid of live terminals, each running an AI coding agent
- 📋 **Task Queue** — Create, prioritize, and auto-assign coding tasks
- 🔀 **Parallel Execution** — 6 agents working simultaneously on different tasks
- 🔗 **OpenClaw Native** — Built on OpenClaw's multi-agent orchestration
- 💰 **Budget Control** — Per-task, per-worker, and global spending limits
- 📊 **Live Status** — Real-time progress, cost tracking, and activity feed
- 🔀 **Auto PR** — Agents automatically commit, push, and create pull requests
- 🧠 **Swarm Mode** — Give a big goal, AI decomposes into parallel sub-tasks

## Architecture

```
Browser (React + xterm.js)
    │
    ├── WebSocket RPC ──→ OpenClaw Gateway (agent orchestration)
    │                         ├── worker-1 (isolated agent)
    │                         ├── worker-2
    │                         ├── ...
    │                         └── worker-6
    │
    └── WebSocket ──→ Terminal Server (node-pty, live terminal I/O)
```

## Docs

- [PRD (Product Requirements Document)](docs/PRD.md)
- [Design Prompts for UI](docs/DESIGN-PROMPTS.md)

## Status

🚧 **Pre-development** — Product design phase.

## License

TBD
