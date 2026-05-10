# DevTracker — Build Plan

A lightweight desktop tool for engineers to auto-track coding sessions and generate daily work summaries.

---

## What It Does

- Watches IDE activity and Git repos for coding events
- Detects when a work session starts/ends
- Pulls commit history to enrich summaries
- Generates a structured daily report (timeline + task list)
- Lets the user review, edit, and copy the report

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Electron** (or Tauri for lighter weight) | Cross-platform, tray icon support |
| Backend logic | **Node.js** | File watching, Git CLI, easy IPC |
| UI | **React + Tailwind** | Fast to build, easy to iterate |
| Storage | **SQLite (via better-sqlite3)** | Local, zero-config, queryable |
| Git data | **simple-git** npm package | Wraps `git log` nicely |

---

## Architecture (Simple)

```
┌─────────────────────────────────────┐
│           Electron Main Process      │
│  ┌──────────┐  ┌──────────────────┐ │
│  │  Watcher │  │   Git Collector  │ │
│  │(chokidar)│  │  (simple-git)    │ │
│  └────┬─────┘  └────────┬─────────┘ │
│       └────────┬─────────┘           │
│          ┌─────▼──────┐              │
│          │  SQLite DB  │              │
│          └─────┬──────┘              │
└────────────────┼────────────────────┘
                 │ IPC
┌────────────────▼────────────────────┐
│         React UI (Renderer)          │
│   Dashboard  │  Timeline  │  Report  │
└─────────────────────────────────────┘
```

---

## Core Modules

### 1. Activity Watcher
- Use **chokidar** to watch file changes in configured project directories
- Record: `{ file, project, timestamp, ide }` on each save event
- Debounce rapid saves (1 save per 10s per file to avoid noise)
- Detect IDE via process name polling (VS Code = `code`, JetBrains = `idea`, etc.)

### 2. Session Detector
- A session = continuous activity with gaps < 15 minutes
- On each activity event: check last event timestamp
- If gap > 15 min → close current session, start new one
- Store: `{ session_id, project, start, end, file_count }`

### 3. Git Collector
- On app start + every 30 min: run `git log --since=midnight` on watched repos
- Pull: commit hash, message, author, timestamp, files changed
- Store commits in SQLite linked to sessions by timestamp overlap

### 4. Summary Generator
- At end of day (or on demand), query DB for the day's sessions + commits
- Group by project → build a timeline
- Use a simple template (or call Claude API) to generate natural-language bullet points
- Output format:

```
## Daily Summary — May 10, 2026

### auth-service  (2h 15m)
- 09:12  Started session — worked on login flow refactor
- 10:45  Committed: "fix JWT expiry edge case" (3 files)
- 11:20  Session ended

### frontend-app  (1h 40m)
- 13:05  Started session — UI work
- 14:12  Committed: "add loading skeleton to dashboard"
- 14:45  Session ended
```

### 5. Report UI
- Simple 3-tab layout: **Today** / **History** / **Settings**
- Today tab: editable summary + one-click copy to clipboard
- History tab: calendar picker → past reports
- Settings tab: add/remove watched directories, session gap threshold

---

## Database Schema

```sql
-- Raw activity events
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER,
  file TEXT,
  project TEXT,
  ide TEXT
);

-- Detected sessions
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  project TEXT,
  start_time INTEGER,
  end_time INTEGER,
  event_count INTEGER
);

-- Git commits
CREATE TABLE commits (
  id INTEGER PRIMARY KEY,
  repo TEXT,
  hash TEXT,
  message TEXT,
  author TEXT,
  timestamp INTEGER,
  files_changed INTEGER
);

-- Generated reports
CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  date TEXT,
  content TEXT,  -- editable markdown
  generated_at INTEGER
);
```

---

## Build Phases

### Phase 1 — Core Tracking (Week 1–2)
- [ ] Electron app scaffold with tray icon
- [ ] chokidar file watcher + SQLite logging
- [ ] Session detection logic
- [ ] Git collector for local repos

### Phase 2 — Report Generation (Week 3)
- [ ] Daily summary query + timeline builder
- [ ] Template-based report generation
- [ ] Basic React UI (Today view + copy button)

### Phase 3 — Polish (Week 4)
- [ ] History view with calendar
- [ ] Settings UI (add repos, tweak session gap)
- [ ] Optional: Claude API integration for smarter summaries
- [ ] Auto-launch on login, system notifications

---

## Key Decisions

**Why not a browser extension?**
Git access and file system watching require native desktop capabilities.

**Why SQLite over a flat file?**
Queryable by date/project without loading everything into memory.

**Why template-first for summaries?**
Deterministic output, no API cost, works offline. Add AI layer optionally later.

**Privacy**
All data stays local. No telemetry. SQLite file lives in the user's home directory.

---

## MVP Definition

> A tray app that watches 1+ directories, detects sessions, reads Git commits, and shows a copyable daily summary — all working locally.

Everything else is enhancement.
