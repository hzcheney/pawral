# Pawral — Stitch Design Prompts

每个 prompt 可直接粘贴到 Stitch Design 生成 UI。

---

## Page 1: Main Dashboard (Terminal Grid + Status Bar)

```
Design a dark-themed developer dashboard for an AI coding agent management tool called "Pawral".

Layout:
- Top bar: Left side shows logo "Pawral" with a bee/swarm icon. Right side shows global stats in pill badges: "Active: 4/6", "Queue: 7 tasks", "Today: 12 done", "Budget: $18.50 / $50.00" with a progress bar, and a green dot "Gateway: Connected". Far right has a Settings gear icon and a user avatar.

- Main area: A 3×2 grid of terminal panels (6 total), evenly spaced with 12px gap. Each panel has:
  - A header bar (32px height, slightly lighter background) showing:
    - Left: A colored status dot (green/yellow/blue/red/gray) + worker name like "worker-1"
    - Center: Current task name like "auth-refactor" and repo name "my-app" in muted text
    - Right: A mini progress bar, cost "$1.20", and elapsed time "12min"
  - Body: A black terminal area with monospace green/white text showing typical CLI output (git commands, code compilation, test results). Use realistic-looking terminal output.

- The 6 terminals should show different states:
  - worker-1: 🟢 green dot, actively showing code output, progress 60%
  - worker-2: 🟡 yellow dot, showing "Planning..." phase, progress 20%
  - worker-3: ⚪ gray dot, empty terminal with blinking cursor, status "Idle"
  - worker-4: 🔵 blue dot, showing "✅ PR #142 created", progress 100%
  - worker-5: 🔴 red dot, showing error output in red text, status "Error"
  - worker-6: ⚪ gray dot, idle

- Bottom section (collapsible, 200px height): Activity feed showing timestamped events like:
  "14:50 worker-1 ✅ PR created: #142 Add OAuth"
  "14:48 worker-5 🔴 Error: test failed (3 attempts)"
  "14:45 worker-2 🟢 Started: task-015 Fix pagination"

Color scheme: Dark background (#0d1117), terminal black (#010409), accent blue (#58a6ff), green (#3fb950), yellow (#d29922), red (#f85149), muted gray (#8b949e). Similar to GitHub dark theme.

Typography: Inter for UI, JetBrains Mono for terminal text.
Dimensions: 1440×900 desktop viewport.
```

---

## Page 2: Terminal Fullscreen / Focused View

```
Design a fullscreen terminal view for a single AI coding agent worker, dark theme.

Layout:
- Top bar (48px): 
  - Left: Back arrow icon + "← Back to Grid", worker name "worker-1" with green status dot
  - Center: Task info "auth-refactor • my-app • branch: swarm/task-012-auth"
  - Right: Action buttons row — [Pause] [Kill] [Reassign] as small outlined buttons, cost "$1.20", timer "18:32"

- Main area: Full-width terminal (JetBrains Mono font, black background) showing a realistic Claude Code session output:
  ```
  $ claude -p "Implement OAuth provider for Google login..."
  
  ⠋ Planning...
  
  I'll implement Google OAuth by:
  1. Creating src/auth/providers/google.ts
  2. Adding OAuth callback route
  3. Updating the auth middleware
  
  Creating src/auth/providers/google.ts...
  Writing src/routes/auth/callback.ts...
  Running tests...
  
  ✓ 12 tests passed
  ✗ 1 test failed: auth.callback.test.ts
  
  Fixing test...
  ✓ All 13 tests passed
  
  Committing changes...
  [swarm/task-012-auth abc1234] feat: add Google OAuth provider
  ```

- Right sidebar (320px, collapsible):
  - Section "Task Details":
    - Status: 🟢 Coding
    - Model: claude-sonnet-4-6
    - Tokens: 42k in / 8k out
    - Cost: $1.20
    - Phase progress: [Plan ✓] [Code ●] [Test ○] [PR ○]
  - Section "Session History" — scrollable list of key events:
    - "14:32 Task assigned"
    - "14:33 Planning complete"
    - "14:35 Writing 3 files"
    - "14:40 Tests running"
  - Section "Quick Actions":
    - Button: "View Diff" (outlined)
    - Button: "Send Message" (outlined) with text input
    - Button: "View PR" (primary blue)

Color scheme: Same dark GitHub theme. Terminal uses green (#3fb950) for success, red (#f85149) for errors, white for normal text, gray (#8b949e) for muted.
Dimensions: 1440×900.
```

---

## Page 3: Task Queue — List View

```
Design a task queue management page for an AI coding agent dashboard, dark theme.

Layout:
- Top section:
  - Page title "Task Queue" on left
  - Right side: View toggle buttons [List | Board | Graph] with List active, and a primary button [+ New Task]
  - Filter row below: Dropdown "All Status", Dropdown "All Repos", Dropdown "All Priority", Search input

- Main area: A data table with the following columns:
  - Priority (colored dot: red=high, yellow=medium, gray=low)
  - Task ID (#001, #002...)
  - Title (truncated if long)
  - Repo (with repo icon)
  - Status (colored badge: "Queued" gray, "Running" green, "PR" blue, "Done" teal, "Failed" red)
  - Assigned Worker (e.g. "worker-1" or "—" if unassigned)
  - Model (e.g. "sonnet" or "opus" or "auto")
  - Cost (e.g. "$1.20" or "—")
  - Time (e.g. "12min" or "—")
  - Actions (three-dot menu icon)

- Show 8-10 rows with realistic data:
  Row 1: High, #001, "Implement OAuth provider", my-app, 🟢 Running, worker-1, sonnet, $1.20, 12min
  Row 2: High, #002, "Add SAML authentication", my-app, 🟢 Running, worker-2, sonnet, $0.80, 8min
  Row 3: Medium, #003, "Write integration tests for auth", my-app, 🟡 Queued, —, auto, —, —
  Row 4: Medium, #004, "Refactor DB connection pool", backend-api, 🟡 Queued, —, auto, —, —
  Row 5: Low, #005, "Fix typo in README", docs, ✅ Done, worker-4, sonnet, $0.15, 2min
  Row 6: High, #006, "API rate limiting middleware", backend-api, 🔵 PR, worker-3, opus, $3.40, 25min
  Row 7: Medium, #007, "Update CI pipeline", infra, 🔴 Failed, worker-5, sonnet, $1.80, 15min
  Row 8: Low, #008, "Add dark mode toggle", frontend, 🟡 Queued, —, auto, —, —

- Rows should be draggable (show a drag handle on hover on the left edge) for priority reordering.
- Selected/hover row has a subtle highlight.

- Bottom: Pagination "Showing 1-8 of 23 tasks" with page controls.

Color scheme: Dark theme (#0d1117 background, #161b22 card/table background, #21262d borders).
Dimensions: 1440×900.
```

---

## Page 4: Task Queue — Kanban Board View

```
Design a kanban board view for task management in an AI coding agent dashboard, dark theme.

Layout:
- Same top section as list view with [List | Board | Graph] toggle, Board active.

- Main area: 5 columns, horizontally scrollable:
  Column 1 "Queued" (gray header, count badge "4"):
    - Card: "Write integration tests" • my-app • Medium priority dot • "auto"
    - Card: "Refactor DB pool" • backend-api • Medium • "auto"
    - Card: "Add dark mode" • frontend • Low • "auto"
    - Card: "Update docs" • docs • Low • "auto"
    - [+ Add Task] button at bottom

  Column 2 "Running" (green header, count "3"):
    - Card: "Implement OAuth" • my-app • High • worker-1 avatar • 🟢 • "$1.20" • "12min"
    - Card: "Add SAML auth" • my-app • High • worker-2 avatar • 🟢 • "$0.80" • "8min"
    - Card: "Fix pagination" • frontend • Medium • worker-4 avatar • 🟡 • "$0.30" • "3min"

  Column 3 "PR Created" (blue header, count "2"):
    - Card: "Rate limiting" • backend-api • High • worker-3 • "PR #142" link • "$3.40"
    - Card: "Add caching layer" • backend-api • Medium • worker-6 • "PR #139" link • "$2.10"

  Column 4 "Done" (teal header, count "5"):
    - Card: "Fix README typo" • docs • Low • worker-4 • "$0.15" • "2min"
    - Card: "Update deps" • frontend • Low • worker-1 • "$0.20" • "1min"
    - (3 more collapsed, "+3 more" link)

  Column 5 "Failed" (red header, count "1"):
    - Card: "Update CI pipeline" • infra • Medium • worker-5 • 🔴 • "$1.80" • "Retry" button

- Each card is a rounded rectangle (~280px wide, variable height), showing:
  - Task title (bold)
  - Repo name (muted) + Priority colored dot
  - Bottom row: Assigned worker (small avatar), cost, time
  - Cards are draggable between columns

Color scheme: Dark theme. Column backgrounds slightly different shade. Cards #161b22 with #30363d border.
Dimensions: 1440×900.
```

---

## Page 5: New Task Modal

```
Design a modal dialog for creating a new coding task in an AI agent dashboard, dark theme.

The modal is centered, 560px wide, with a dark overlay behind it.

Modal content:
- Header: "New Task" title, X close button on right

- Form fields (vertical stack, 16px gap):
  1. "Task Title" — text input, placeholder "e.g. Implement OAuth provider"
  2. "Description / Prompt" — tall textarea (120px height), placeholder "Describe what the agent should implement..."
  3. "Repository" — dropdown select with repo options: "my-app", "backend-api", "frontend", "docs", "+ Add new repo..."
  4. "Branch Prefix" — text input, pre-filled "swarm/", editable
  5. Row of two fields side by side:
     - "Priority" — dropdown: High (red dot), Medium (yellow dot), Low (gray dot)
     - "Model" — dropdown: Auto (recommended), claude-sonnet-4-6, claude-opus-4-6
  6. Row of two fields:
     - "Budget Limit" — number input with $ prefix, placeholder "3.00"
     - "Auto PR" — toggle switch, default on
  7. "Dependencies" — multi-select chips input, placeholder "Select tasks this depends on...", showing existing task titles as options
  8. "Assign to Worker" — dropdown: "Auto (next available)", worker-1, worker-2, ..., worker-6. Show status dot next to each (green=idle, red=busy)

- Footer: 
  - Left: Checkbox "Create another after this"
  - Right: [Cancel] ghost button, [Create Task] primary blue button

Color scheme: Modal background #161b22, overlay rgba(0,0,0,0.6), input backgrounds #0d1117, borders #30363d, primary button #238636.
Dimensions: Modal 560×auto on 1440×900 viewport.
```

---

## Page 6: Budget Dashboard

```
Design a budget monitoring dashboard page for an AI coding agent system, dark theme.

Layout:
- Page title "Budget & Usage" on top left

- Top row: 3 stat cards side by side (each ~400px wide):
  Card 1 "Today": Large text "$18.50 / $50.00", circular progress ring (37%), subtitle "7 tasks completed"
  Card 2 "This Week": "$42.00 / $200.00", progress ring (21%), "23 tasks completed"
  Card 3 "This Month": "$156.00 / $500.00", progress ring (31%), "89 tasks completed"

- Middle section: "Per-Worker Usage" — horizontal bar chart:
  - 6 horizontal bars, one per worker
  - worker-1: $3.20 (bar width proportional)
  - worker-2: $1.80
  - worker-3: $4.50
  - worker-4: $2.10
  - worker-5: $3.90
  - worker-6: $0.50
  - Each bar colored by model used (blue for sonnet, purple for opus)
  - Right side of each bar: daily limit "$5.00" with remaining shown

- Bottom section: Two panels side by side:
  Left panel "Cost by Model":
    - Pie/donut chart showing: claude-sonnet (65%, blue), claude-opus (30%, purple), other (5%, gray)
    - Legend below with actual $ amounts

  Right panel "Cost Over Time":
    - Line chart showing daily cost for the past 7 days
    - X-axis: dates, Y-axis: dollars
    - Budget limit shown as dashed red line at $50

- Bottom bar: Action buttons [Edit Limits] [Pause All Workers] [Export CSV]

Color scheme: Dark theme. Cards #161b22. Charts use accent colors (blue #58a6ff, purple #bc8cff, green #3fb950, red #f85149).
Dimensions: 1440×900.
```

---

## Page 7: PR Dashboard

```
Design a pull request management dashboard for an AI coding agent system, dark theme.

Layout:
- Page title "PR Dashboard" with subtitle "Pull requests created by Pawral"
- Right side: Filter buttons [All | Open | Merged | Conflict], and [Batch Merge] primary button (disabled unless PRs selected)

- Main area: Card list of PRs, each card full-width (~1200px):

  PR Card layout (each ~80px height):
  - Left: Checkbox for batch selection
  - PR icon (green for open, purple for merged, red for conflict)
  - Title: "feat: add Google OAuth provider" as link
  - Labels: "swarm" badge, "worker-1" badge
  - Repo: "my-app" muted text
  - Branch: "swarm/task-012-auth → main" with arrow
  - Right side: 
    - Status badges: "✅ Tests passing" or "❌ Tests failing" or "⚠️ Conflict"
    - "+3 files", "+142 −23" (additions/deletions in green/red)
    - Created "2 hours ago"
    - [Review] button, [Merge] button (or [Resolve] if conflict)

  Show 6 PR cards:
  1. Open, "feat: add Google OAuth provider", my-app, worker-1, ✅ Tests passing, +142 −23
  2. Open, "feat: SAML authentication", my-app, worker-2, ✅ Tests passing, +89 −12
  3. Open, "feat: API rate limiting", backend-api, worker-3, ⚠️ Conflict, +201 −45
  4. Merged, "fix: README typo", docs, worker-4, merged 1h ago
  5. Merged, "chore: update dependencies", frontend, worker-1, merged 3h ago
  6. Open, "refactor: DB connection pool", backend-api, worker-5, ❌ Tests failing, +312 −156

- Conflict card should have a yellow/orange left border to stand out.
- Merged cards should be slightly faded/muted.

Color scheme: Dark theme. PR green #3fb950, merged purple #a371f7, conflict orange #d29922, failed red #f85149.
Dimensions: 1440×900.
```

---

## Page 8: Swarm Mode — Task Decomposition View

```
Design a "Swarm Mode" task decomposition view for an AI coding agent dashboard, dark theme.

This is a split-panel layout:

Left panel (50% width) "Goal & Plan":
- Top: Large input area with label "Swarm Goal"
  - Textarea showing: "Refactor the entire authentication module to support OAuth, SAML, and API Key authentication methods"
  - Below: Repo selector "my-app", Model "claude-opus-4-6" for planning
  - [Analyze & Decompose] button (or showing "Analyzing..." spinner state)

- Below (after analysis): "Decomposition Plan" section
  - Card list of 6 sub-tasks, each showing:
    - Drag handle, checkbox (all checked by default)
    - Task number and title: "1. Define unified AuthProvider interface"
    - Estimated complexity badge: "Simple" / "Medium" / "Complex"
    - Suggested model: "sonnet" / "opus"
    - Dependencies: "Depends on: —" or "Depends on: Task 1"
    - Estimated cost: "$0.50"
    - [Edit] pencil icon

  Tasks:
  1. Define AuthProvider interface — Simple — sonnet — No deps — $0.50
  2. Implement OAuthProvider — Medium — sonnet — Depends on 1 — $1.50
  3. Implement SAMLProvider — Medium — sonnet — Depends on 1 — $1.50
  4. Implement APIKeyProvider — Simple — sonnet — Depends on 1 — $0.80
  5. Refactor login flow — Complex — opus — Depends on 2,3,4 — $3.00
  6. Integration tests — Medium — sonnet — Depends on 5 — $1.20

- Bottom summary: "6 tasks • Est. $8.50 • ~45 min with 4 workers"
- Action buttons: [Cancel] [Edit Plan] [🚀 Approve & Launch]

Right panel (50% width) "Dependency Graph":
- A visual directed acyclic graph (DAG):
  - Node 1 (top center) → connects to Nodes 2, 3, 4 (middle row, parallel)
  - Nodes 2, 3, 4 all → connect to Node 5
  - Node 5 → connects to Node 6 (bottom)
  - Each node is a rounded rectangle showing task number, short title, and status color
  - Nodes colored: gray (pending), can show which workers will be assigned
  - Edges are arrows showing dependency direction

- Below the graph: Execution timeline preview
  - Gantt-like bar chart showing:
    - worker-1: Task 1 (0-5min), then Task 5 (20-35min)
    - worker-2: waiting..., Task 2 (5-15min)
    - worker-3: waiting..., Task 3 (5-15min)
    - worker-4: waiting..., Task 4 (5-12min), then Task 6 (35-45min)
  - Total estimated time: 45 min

Color scheme: Dark theme. Graph nodes use colored borders matching priority. Edges in muted gray. Active/current node highlighted in blue.
Dimensions: 1440×900.
```

---

## Page 9: Settings Page

```
Design a settings page for an AI coding agent dashboard called "Pawral", dark theme.

Layout: Left sidebar navigation + right content area.

Left sidebar (240px):
- Settings sections:
  - 🔗 Gateway Connection (active/highlighted)
  - 🤖 Workers
  - 💰 Budget
  - 🔧 Git & PR
  - 🎨 Appearance
  - ⌨️ Shortcuts

Right content area for "Gateway Connection" section:

- Section "OpenClaw Gateway":
  - Status indicator: Green dot + "Connected" or Red dot + "Disconnected"
  - Field: "Gateway URL" — text input, value "ws://localhost:18789"
  - Field: "Auth Token" — password input with show/hide toggle
  - [Test Connection] button, [Reconnect] button
  - Info text: "Connected to OpenClaw Gateway v2.4.1 • Uptime: 3d 14h"

- Section "Worker Configuration":
  - "Number of Workers" — number input (1-12), currently "6"
  - "Default Model" — dropdown: claude-sonnet-4-6, claude-opus-4-6
  - "Workspace Base Path" — text input: "~/swarm-workspaces/"
  - Toggle: "Auto-sandbox workers" (on)
  - Toggle: "Enable Orchestrator Agent" (off, labeled "Phase 2")

- Section "Worker Details" — expandable accordion list:
  - worker-1: workspace path, model override (optional), status
  - worker-2: same
  - ... (collapsed)

- Bottom: [Save Changes] primary button, [Reset to Defaults] ghost button

Color scheme: Dark theme, sidebar #0d1117, content area #161b22, active sidebar item has blue left border.
Dimensions: 1440×900.
```

---

## Page 10: Agent Detail / Worker Status Hover Card

```
Design a hover/popup card that appears when hovering over a terminal panel in the grid view, dark theme.

The card is a floating panel, 360px wide, with rounded corners and subtle shadow/glow, positioned above or to the side of the terminal panel.

Card content:
- Header: "worker-3" with large green status dot, status text "Coding"
- Thin colored bar across top (green = coding, yellow = planning, etc.)

- Section "Current Task":
  - Task: "auth-refactor (#task-012)"
  - Repo: "my-app"
  - Branch: "swarm/task-012-auth-refactor"
  - Model: "claude-sonnet-4-6"

- Section "Progress":
  - Visual phase stepper (horizontal):
    [✓ Plan] → [● Code] → [○ Test] → [○ PR]
  - Current phase highlighted/animated

- Section "Metrics":
  - Two-column layout:
    - Started: "14:32 (18min ago)"
    - Tokens: "42k in / 8k out"
    - Cost: "$1.20"
    - Files changed: "3 files"

- Section "Session":
  - Session key: "agent:worker-3:swarm:task-012" (monospace, truncated)
  - [View Full Session] text link

- Footer action buttons (small):
  [📋 View Diff] [⏸ Pause] [🔄 Reassign] [☠️ Kill]

Card background: #1c2128, border: #30363d, subtle box-shadow. Arrow/pointer pointing to the terminal panel.
Dimensions: 360×auto floating card.
```
