# Atlas 4.0 — Refactoring Documentation

Branch: `daniel/refactoring`
Started: 2026-03-29

---

## Overview

Complete modernization of Atlas from a vanilla JS + Express monolith to a React + NestJS + Prisma stack with TypeScript throughout.

**Before:** 1 monolithic `server.js` (2,739 lines), 1 monolithic `Renderer/` (28 JS modules, ~16K lines), raw SQLite via `db.js`, no tests.

**After:** `client/` (React 19 + Vite), `server/` (NestJS 11 + Prisma 7), 226 tests, CI/CD pipeline.

---

## Phase 1: Frontend — React Migration (DONE)

Replaced `Renderer/` (vanilla JS) with `client/` (React 19 + TypeScript + Vite).

| Component | Files | What |
|-----------|-------|------|
| Views | 7 + 12 admin | Home, Inbox, MyTickets, Archive, Customers, Templates, Admin (12 sub-views) |
| Components | 10 | Sidebar, Layout, TicketDetail, ConfirmModal, AssignModal, NotesModal, NotifBell, BroadcastModal, ProfileModal, MailComposer, ToastContainer |
| Context | 3 | AuthContext, SocketContext, ThemeContext |
| Services | 2 | api.ts (unified HTTP), socket.ts (Socket.IO) |
| Utils | 2 | styling.ts (color system), constants.ts (icons) |
| Hooks | 1 | useDataStore (offices, users, badges) |

### CSS Organization
Global CSS split into 9 component files (same class names, zero visual change):
- `global.css` (1,822 lines) — variables, reset, layout
- `Sidebar.css`, `ChatMessages.css`, `Modal.css`, `TicketCard.css`, `Common.css`, `Home.css`, `Templates.css`, `Admin.css`
- `mobile.css` — all rules wrapped in `@media (max-width: 768px)`

### Key Decisions
- Dropped Electron IPC — app uses HTTP + Socket.IO only
- React Router replaces manual `display:none` view switching
- Quill rich text editor (lazy-loaded, code-split)
- Mobile hamburger menu with responsive layout

---

## Phase 2: Backend — NestJS Migration (DONE)

Replaced `server.js` + `db.js` + `routes/` + `middleware/` + `utils/` + `patch/` with NestJS in `server/`.

### Modules (12)

| Module | What | Status |
|--------|------|--------|
| `database` | Prisma + better-sqlite3 adapter | Done |
| `auth` | JWT login, Passport, guards, profile | Done |
| `tickets` | Inbox CRUD + Socket.IO gateway | Done |
| `admin` | 30+ endpoints (users, offices, config, blocklist) | Done |
| `rag` | Intent engine, force-add engine, OpenAI, Transportstyrelsen fallback | Done |
| `mail` | IMAP listener + Nodemailer SMTP | Done |
| `customers` | List + search + history | Done |
| `templates` | CRUD | Done |
| `notes` | CRUD | Done |
| `knowledge` | Office JSON + basfakta file I/O | Done |
| `upload` | Multer + TTL cleanup | Done |
| `webhook` | LiveHelperChat with HMAC verification | Done |

### RAG Pipeline (6 files)
- `rag.service.ts` — Main orchestrator (knowledge loading, MiniSearch, OpenAI, session management)
- `engines/intent-engine.ts` — NLU with 11 intent patterns, city/area/vehicle slot extraction
- `engines/force-add-engine.ts` — Critical chunk injection (20+ rules, tiered scoring)
- `utils/context-lock.ts` — Slot conflict resolution (prevents "Ullevi i Eslöv")
- `utils/price-resolver.ts` — 3-step price lookup (exact → city median → global)
- `utils/transportstyrelsen-fallback.ts` — Regulatory page fetch + secondary AI call

---

## Phase 3: Database — Prisma ORM (DONE)

Replaced raw SQLite (`db.js` with `CREATE TABLE IF NOT EXISTS`) with Prisma 7.

### Schema: 13 Models

| Model | Relations | What |
|-------|-----------|------|
| `User` | → offices (M2M), → tickets, → notes | Agents with roles, colors, avatars |
| `Office` | → agents (M2M), → tickets | 47 driving school locations |
| `UserOffice` | User ↔ Office | Many-to-many junction |
| `Ticket` | → owner (User), → office, → messages, → notes, → files | Main conversation entity |
| `Message` | → ticket | Individual messages (replaces JSON blob) |
| `TicketNote` | → ticket, → agent | Agent notes on tickets |
| `CustomerNote` | → agent | Per-customer context notes |
| `Template` | — | Email/message templates |
| `Setting` | — | Runtime key-value config |
| `RagFailure` | — | Knowledge gap tracking |
| `UploadedFile` | → ticket | File attachments with TTL |
| `EmailBlocklist` | — | Spam filter patterns |
| `LocalQaHistory` | — | QA training history |

### Key Improvements Over Old DB
- Proper `Message` table (was JSON blob in `context_store`)
- Many-to-many `User ↔ Office` (was comma-separated string)
- Versioned migrations via `prisma migrate`
- Type-safe queries via Prisma Client
- Visual DB browser via `prisma studio`

### Seed Data
`npm run db:seed` creates: 4 users, 47 offices, 20 agent-office assignments, 19 tickets, 50 messages, 8 ticket notes, 5 customer notes, 6 templates, 8 RAG failures, 3 blocklist entries, 5 QA history, 6 settings.

### Future: PostgreSQL
Currently using SQLite via `@prisma/adapter-better-sqlite3`. To switch to PostgreSQL:
1. Change `provider` in `schema.prisma` from `sqlite` to `postgresql`
2. Set `DATABASE_URL` to PostgreSQL connection string
3. Run `prisma migrate deploy`

---

## Legacy Files Removed

| Removed | Lines | Replaced by |
|---------|-------|-------------|
| `server.js` | 2,739 | `server/src/` (12 NestJS modules) |
| `db.js` | 1,025 | `server/src/database/prisma.service.ts` |
| `legacy_engine.js` | 2,762 | `server/src/rag/` (6 files) |
| `routes/` (10 files) | 4,509 | NestJS controllers |
| `Renderer/` (28 modules) | ~16,000 | `client/src/` (42 React components) |
| `middleware/auth.js` | 35 | `server/src/auth/jwt-auth.guard.ts` |
| `utils/` (5 files) | 499 | `server/src/rag/utils/` |
| `patch/` (2 files) | 1,125 | `server/src/rag/engines/` |
| `preload.js`, `preload-loader.js`, `main-client.js` | — | Removed (no IPC needed) |
| `e2e/` (old specs) | — | `client/e2e/` (135 tests) |
| `ngrok.exe`, `sqlite3.exe` | 35MB | Removed |
| `package.json` (root) | — | Removed (use `client/` and `server/` separately) |

---

## Testing

### Unit Tests (91 — Jest + @nestjs/testing)

| Spec | Tests | Coverage |
|------|-------|----------|
| `auth.service.spec.ts` | 5 | Login, password, version |
| `tickets.service.spec.ts` | 9 | Inbox, claim, assign, archive, messages |
| `admin.service.spec.ts` | 11 | Users, offices, config, blocklist |
| `context-lock.spec.ts` | 11 | City/area/vehicle resolution |
| `price-resolver.spec.ts` | 8 | Exact, median, fallback, safety |
| `intent-engine.spec.ts` | 13 | 7 intents, slots, vehicles |
| `force-add-engine.spec.ts` | 11 | Rule injection, deduplication |
| `notes.service.spec.ts` | 4 | CRUD |
| `templates.service.spec.ts` | 4 | CRUD |
| `webhook.service.spec.ts` | 4 | Signature, escalation, RAG |

### E2E Tests (135 — Playwright)

| Spec | Tests | Coverage |
|------|-------|----------|
| `auth.spec.ts` | 4 | Login/logout |
| `navigation.spec.ts` | 9 | All 7 views |
| `views.spec.ts` | 9 | Chat, tabs, search |
| `chat.spec.ts` | 10 | Send/receive, AI response |
| `tickets.spec.ts` | 13 | Detail panel, messages, actions |
| `bulk-ops.spec.ts` | 7 | Multi-select, toolbar |
| `modals.spec.ts` | 15 | Profile, notes, assign |
| `admin.spec.ts` | 19 | Agents, offices, config |
| `search.spec.ts` | 7 | Archive + customer search |
| `templates.spec.ts` | 8 | Quill editor, CRUD |
| `theme-and-ui.spec.ts` | 16 | Colors, status, placeholders |
| `mobile.spec.ts` | 8 | Hamburger, responsive |
| `deployed.spec.ts` | 10 | Live smoke tests |

---

## CI/CD Pipeline

GitHub Actions workflow (`workflow_dispatch`):

```
Lint → Build → Unit Tests (91) → E2E Tests (135) → Deploy to Hetzner (disabled)
```

Deploy stage (when activated):
- rsync `server/dist/` + `client/dist/` to VPS
- Automatic backup before deploy
- Health check with automatic rollback on failure
- Requires `HETZNER_SSH_KEY` secret

---

## Project Structure

```
Atlas-4.0/
├── client/                    React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── components/        10 shared components
│   │   ├── views/             7 views + 12 admin sub-views
│   │   ├── context/           Auth, Socket, Theme
│   │   ├── services/          API + Socket.IO
│   │   ├── hooks/             useDataStore
│   │   ├── utils/             styling + constants
│   │   └── styles/            global.css + 8 component CSS files
│   ├── e2e/                   135 Playwright tests
│   └── package.json
├── server/                    NestJS 11 + Prisma 7
│   ├── src/
│   │   ├── auth/              JWT, Passport, guards
│   │   ├── tickets/           CRUD + Socket.IO gateway
│   │   ├── admin/             30+ admin endpoints
│   │   ├── rag/               AI pipeline (6 files)
│   │   ├── mail/              IMAP + Nodemailer
│   │   ├── database/          Prisma + better-sqlite3
│   │   ├── customers/         List + history
│   │   ├── templates/         CRUD
│   │   ├── notes/             CRUD
│   │   ├── knowledge/         KB file I/O
│   │   ├── upload/            Multer + TTL
│   │   └── webhook/           LiveHelperChat
│   ├── prisma/
│   │   ├── schema.prisma      13 models
│   │   ├── migrations/        Versioned SQL
│   │   └── seed.js            Complete test data
│   ├── test/                  91 Jest unit tests
│   └── package.json
├── knowledge/                 65 KB JSON files
├── kundchatt/                 Customer chat widget
├── main.js                    Electron shell
├── .github/workflows/         CI/CD pipelines
├── GETTING_STARTED.md         Setup instructions
├── README.md                  Project overview
└── PROJECT_REFACTORING.md     This file
```
