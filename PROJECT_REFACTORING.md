# Atlas 4.0 — Refactoring Documentation

Branch: `daniel/refactoring`
Started: 2026-03-29

This document tracks all structural changes made during the refactoring of Atlas 4.0.

---

## Overview

The goal of this branch is to modernize the Atlas frontend from vanilla JavaScript to a React + TypeScript application, while preserving all existing functionality and visual design.

---

## Phase 1: Frontend Migration (Renderer → React)

### What was done

The entire `Renderer/` directory (vanilla JS frontend) is being replaced by a new `client/` directory containing a React + Vite + TypeScript application.

### Architecture Changes

| Before | After | Why |
|--------|-------|-----|
| Vanilla JS with `<script defer>` tags | React 19 + TypeScript + Vite | Modern component architecture, type safety, better DX |
| Global namespace (`window.*` functions) | ES modules with imports | Proper encapsulation, no name collisions |
| Manual view switching (`display: none/flex`) | React Router | Standard SPA routing with URL support |
| Global `State` object + `localStorage` | React Context (Auth, Socket, Theme) | Predictable state management, reactive updates |
| Dual IPC/HTTP code paths (`ipc-bridges.js`) | Single HTTP API layer (`services/api.ts`) | Eliminated redundant Electron IPC middleman |
| Socket.IO loaded dynamically with retry | Socket.IO client via npm + context | Proper dependency management |
| CSS in `Renderer/assets/css/` | CSS copied to `client/src/styles/` | Same CSS, new location |
| Static assets in `Renderer/assets/` | Static assets in `client/public/assets/` | Vite serves from `public/` |

### New Directory: `client/`

```
client/
├── public/
│   └── assets/              ← copied from Renderer/assets/
│       ├── audio/           ← notification sounds (pling-1..5.mp3)
│       ├── icons/           ← SVG menu icons + app icon
│       ├── images/          ← logo.png
│       └── themes/          ← 5 theme folders with CSS + backgrounds
├── src/
│   ├── main.tsx             ← App entry point
│   ├── App.tsx              ← Root component with React Router
│   ├── types.ts             ← Shared TypeScript interfaces
│   ├── components/
│   │   ├── Layout.tsx       ← App shell (sidebar + content)
│   │   ├── Sidebar.tsx      ← Navigation sidebar
│   │   └── ToastContainer.tsx ← Toast notification system
│   ├── context/
│   │   ├── AuthContext.tsx   ← Auth state (token, user, login/logout)
│   │   ├── SocketContext.tsx ← Socket.IO connection lifecycle
│   │   └── ThemeContext.tsx  ← Theme + accent color management
│   ├── hooks/
│   │   └── useDataStore.ts  ← Shared data (offices, users, badges)
│   ├── services/
│   │   ├── api.ts           ← Unified HTTP API layer
│   │   └── socket.ts        ← Socket.IO connection manager
│   ├── utils/
│   │   ├── constants.ts     ← SVG icons, version (from ui-constants.js)
│   │   └── styling.ts       ← Color system, labels (from styling-utils.js)
│   ├── styles/
│   │   ├── global.css       ← copied from Renderer/assets/css/style.css
│   │   └── mobile.css       ← copied from Renderer/assets/css/mobile.css
│   └── views/
│       ├── LoginPage.tsx    ← Login form (from renderer.js login modal)
│       ├── Home.tsx         ← Private AI chat (from view-chat)
│       ├── Inbox.tsx        ← Team inbox (from inbox-view.js)
│       ├── MyTickets.tsx    ← Agent tickets (from tickets-view.js)
│       ├── Archive.tsx      ← Closed tickets (from archive-view.js)
│       ├── Customers.tsx    ← Customer directory (from customers-view.js)
│       ├── Templates.tsx    ← Email templates (from templates-view.js)
│       └── Admin.tsx        ← Admin dashboard (from admin-*.js modules)
├── index.html
├── vite.config.ts           ← Dev proxy to localhost:3001
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── package.json
```

### File Mapping: Old → New

| Old File (Renderer/) | New File (client/src/) | Notes |
|----------------------|----------------------|-------|
| `renderer.js` (2211 lines) | Split into multiple files | Auth → AuthContext, views → separate components, state → contexts |
| `modules/ui-constants.js` | `utils/constants.ts` | Direct port with TypeScript types |
| `modules/styling-utils.js` | `utils/styling.ts` | Direct port, functions now take data as params instead of reading globals |
| `modules/socket-client.js` | `services/socket.ts` + `context/SocketContext.tsx` | Socket lifecycle managed by React |
| `modules/ipc-bridges.js` | **REMOVED** — replaced by `services/api.ts` | Dual IPC/HTTP paths eliminated |
| `modules/inbox-view.js` | `views/Inbox.tsx` | React component with hooks |
| `modules/tickets-view.js` | `views/MyTickets.tsx` | React component with hooks |
| `modules/archive-view.js` | `views/Archive.tsx` | React component with hooks |
| `modules/customers-view.js` | `views/Customers.tsx` | React component with hooks |
| `modules/templates-view.js` | `views/Templates.tsx` | React component with hooks |
| `modules/chat-engine.js` | Inlined in `views/Home.tsx` | ChatSession state managed by useState |
| `modules/modals.js` (confirm/prompt) | `components/ConfirmModal.tsx` | Promise-based confirm/prompt via React Context |
| `modules/modals.js` (assign) | `components/AssignModal.tsx` | Agent assignment modal |
| `modules/modals.js` (profile) | `components/ProfileModal.tsx` | Avatar, color, status, password change |
| `modules/modals.js` (mail composer) | `components/MailComposer.tsx` | External email + internal agent messaging |
| `modules/notif-system.js` | `components/NotifBell.tsx` | Notification bell + history panel with localStorage |
| `modules/notes-system.js` | `components/NotesModal.tsx` | Full CRUD notes modal |
| `modules/detail-ui.js` + reply logic | `components/TicketDetail.tsx` | Full detail panel: header, messages, reply, actions |
| `modules/bulk-ops.js` | **TODO** — integrated into Inbox | Pending migration |
| `modules/admin/admin-core.js` | `views/Admin/index.tsx` | Tab switching, dirty form guard, layout |
| `modules/admin/admin-users.js` | `views/Admin/AdminUserList.tsx` | User list with avatars, online status |
| `modules/admin/admin-users.js` (detail) | `views/Admin/AdminUserDetail.tsx` | User detail: stats, tickets, color picker, actions |
| `modules/admin/admin-forms.js` | `views/Admin/AdminUserForm.tsx` | Create/edit agent form with avatar picker, office/view permissions |
| `modules/admin/admin-offices.js` (list) | `views/Admin/AdminOfficeList.tsx` | Office list grouped by city |
| `modules/admin/admin-offices.js` (detail) | `views/Admin/AdminOfficeDetail.tsx` | Office detail: tickets, agents, contact info, color picker |
| `modules/admin/admin-forms.js` (office) | `views/Admin/AdminOfficeForm.tsx` | Create office form |
| `modules/admin/admin-config.js` (nav) | `views/Admin/AdminConfigNav.tsx` | Config section navigation (10 sections) |
| `modules/admin/admin-config.js` (detail) | `views/Admin/AdminConfigDetail.tsx` | Generic config renderer + delegates to specialized components |
| `modules/admin/admin-audit.js` | `views/Admin/AdminAbout.tsx` | Version info, stats, theme/sound settings, shortcuts |
| `modules/admin/admin-drift.js` | `views/Admin/AdminDrift.tsx` | Drift settings with lock/unlock, email blocklist |
| `modules/admin/admin-knowledge.js` | `views/Admin/AdminKnowledge.tsx` | KB file browser and section editor |
| `modules/admin/admin-gaps.js` | `views/Admin/AdminGaps.tsx` | Knowledge gaps with AI analysis per gap + bulk |
| `modules/admin/admin-agents.js` | Inlined in `AdminUserDetail.tsx` | Color update flow (self vs other agent) |
| `modules/admin/admin-broadcast.js` | `components/BroadcastModal.tsx` | Agent + office broadcast via socket |
| `modules/admin/admin-reader.js` | Merged into `components/TicketDetail.tsx` | Same detail panel used everywhere |
| `modules/admin/admin-tools.js` | Inlined in detail components | Delete user/office/section, reset password |
| `assets/css/style.css` | `styles/global.css` | Copied as-is, no modifications |
| `assets/css/mobile.css` | `styles/mobile.css` | Copied as-is, no modifications |
| `loader.html` / `loader.js` | **REMOVED** | Electron-specific loader, replaced by LoginPage |
| `index.html` | `index.html` (new, minimal) | Vite entry point, React mounts to `#root` |

### Key Design Decisions

1. **Dropped Electron IPC layer** — The app now uses HTTP fetch exclusively. Electron becomes a thin wrapper that loads the web app URL. This eliminates `ipc-bridges.js`, `preload.js`, `preload-loader.js` and the dual code paths.

2. **Preserved CSS as-is** — `style.css` (148K) is imported globally without modification to ensure visual fidelity. Same class names are used in React components.

3. **Critical color system preserved exactly** — `getAgentStyles()` with its priority order (office → agent → currentUser → fallback) is ported verbatim. Output keys `{main, bg, tagBg, bubbleBg, border}` are unchanged.

4. **Vite dev proxy** — During development, Vite proxies `/api`, `/team`, `/search_all`, and `/socket.io` to `localhost:3001` so the React dev server works alongside the existing backend.

5. **React Context over Redux** — Auth, Socket, and Theme state managed via React Context. Lightweight, sufficient for this app's state complexity.

6. **Playwright E2E tests** — New test suite in `client/e2e/` targeting the React app. Tests cover authentication, navigation, view rendering, tab switching, and UI state. Uses Vite dev server via `webServer` config for local runs, or `ATLAS_E2E_BASE_URL` for remote targets.

---

## Phase 2: Backend — NestJS Migration

The Express.js monolith (`server.js`, 2,739 lines) is being replaced with a NestJS application in `server/`.

### Architecture

```
server/
├── src/
│   ├── main.ts                  ← NestJS bootstrap (port 3001)
│   ├── app.module.ts            ← Root module, imports all feature modules
│   ├── shared/types.ts          ← Shared TypeScript interfaces
│   ├── database/
│   │   ├── database.module.ts   ← Global module
│   │   └── database.service.ts  ← better-sqlite3 wrapper (all queries)
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts   ← login, profile, users, version
│   │   ├── auth.service.ts      ← JWT, bcrypt, validation
│   │   ├── jwt.strategy.ts      ← Passport JWT strategy
│   │   └── jwt-auth.guard.ts    ← @UseGuards(JwtAuthGuard)
│   ├── tickets/
│   │   ├── tickets.module.ts
│   │   ├── tickets.controller.ts ← inbox, claim, assign, archive, delete
│   │   ├── tickets.service.ts    ← ticket CRUD + search
│   │   └── tickets.gateway.ts    ← Socket.IO: all real-time events
│   ├── admin/
│   │   ├── admin.module.ts
│   │   ├── admin.controller.ts  ← 30+ admin endpoints
│   │   └── admin.service.ts     ← users, offices, config, blocklist
│   ├── customers/
│   │   ├── customers.module.ts
│   │   ├── customers.controller.ts
│   │   └── customers.service.ts
│   ├── templates/               ← CRUD for email templates
│   ├── notes/                   ← CRUD for ticket notes
│   ├── knowledge/               ← KB file read/write + basfakta
│   ├── rag/                     ← AI/LLM service (TODO: port legacy_engine)
│   ├── mail/                    ← IMAP + Nodemailer (TODO: port from server.js)
│   └── webhook/                 ← LiveHelperChat webhook (TODO: port)
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### What's ported to NestJS
- [x] Database service (better-sqlite3) — all queries from db.js
- [x] Auth: login, JWT, profile update, password change, user list
- [x] Tickets: inbox, claim, assign, archive, delete, search, messages
- [x] Socket.IO gateway: all agent/customer/admin events with decorators
- [x] Admin: 30+ endpoints (users, offices, config, blocklist, RAG failures)
- [x] Customers: list + search + history
- [x] Templates: CRUD
- [x] Notes: CRUD
- [x] Knowledge: file I/O for office JSON + basfakta editor
- [x] Webhook: placeholder for LHC integration

### Still TODO (business logic ports)
- [ ] RAG pipeline (legacy_engine.js → rag.service.ts)
- [ ] IMAP listener (server.js → mail.service.ts)
- [ ] Email sending (Nodemailer → mail.service.ts)
- [ ] Webhook processing (webhook.js → webhook.service.ts)
- [ ] File upload (Multer integration)
- [ ] Rate limiting (@nestjs/throttler)

---

## What Has NOT Changed

- `server.js` — untouched
- `db.js` — untouched
- `routes/` — untouched
- `middleware/` — untouched
- `utils/` — untouched
- `patch/` — untouched
- `knowledge/` — untouched
- `kundchatt/` — untouched
- `e2e/` — untouched
- `main.js` — untouched (Electron main process)
- All backend logic — untouched

---

## Remaining Work

- [x] Migrate Admin sub-views (13 modules) — 12 React components in `views/Admin/`
- [x] Migrate shared components — ConfirmModal, AssignModal, NotesModal, NotifBell, BroadcastModal
- [x] Ticket detail panel — TicketDetail with messages, reply, claim/assign/archive/delete actions
- [x] Profile settings modal — ProfileModal with avatar/color/status/password
- [x] Mail composer modal — MailComposer with external/internal mode toggle
- [x] Playwright e2e tests — auth, navigation, views (3 spec files)
- [x] Bulk operations in Inbox — multi-select with checkboxes, floating toolbar, batch claim/archive
- [x] Update `server.js` — serves `client/dist/` with fallback to `Renderer/`, SPA catch-all route
- [x] Update `main.js` — loads `http://localhost:3001` instead of `file://`, removed preload dependency
- [x] Mobile hamburger menu — toggle sidebar, overlay backdrop, responsive layout
- [x] Quill rich text editor — lazy-loaded ReactQuill with dark theme, code-split (206KB separate chunk)
- [x] Deployed E2E tests — `deployed.spec.ts` + GitHub Actions workflow `playwright-react-e2e.yml`
