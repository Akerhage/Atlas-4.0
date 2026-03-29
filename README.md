# Atlas 4.0

AI-driven customer service platform for Swedish driving schools. Built with React + NestJS + TypeScript.

## Architecture

```
client/     → React 19 + Vite frontend
server/     → NestJS backend (API + Socket.IO + RAG)
knowledge/  → Knowledge base JSON files
kundchatt/  → Customer-facing chat widget
main.js     → Electron desktop shell (optional)
```

## Prerequisites

- **Node.js** 20+
- **npm** 9+
- **.env** file in project root (see below)

## Quick Start

### 1. Install dependencies

```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 2. Create `.env` file

Create a `.env` file in the project root:

```env
# Required
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-here

# Email (SMTP sending via Brevo)
EMAIL_USER=your@email.com
EMAIL_PASS=smtp-password
EMAIL_FROM=noreply@atlas-support.se

# Email (IMAP receiving — Gmail)
IMAP_USER=your@gmail.com
IMAP_PASS=app-password

# LiveHelperChat (optional)
LHC_WEBHOOK_SECRET=your-webhook-secret
LHC_API_URL=https://your-lhc-instance.com
LHC_API_USER=api-user
LHC_API_KEY=api-key

# Database (optional, defaults to atlas.db in project root)
DB_PATH=/path/to/atlas.db
```

### 3. Build and run

```bash
# Build the NestJS backend
cd server && npm run build

# Build the React frontend
cd ../client && npm run build

# Start the server (serves both API and frontend)
cd ../server && npm run start:prod
```

Open **http://localhost:3001** in your browser.

## Development

Run backend and frontend separately with hot-reload:

```bash
# Terminal 1 — NestJS backend (port 3001)
cd server && npm run start:dev

# Terminal 2 — Vite frontend (port 5173, proxies API to 3001)
cd client && npm run dev
```

Open **http://localhost:5173** for the frontend with hot-reload.

## Production (VPS)

Atlas runs on Hetzner VPS via PM2:

```bash
# Build both
cd server && npm run build
cd ../client && npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Or manually
node server/dist/main.js
```

PM2 config (`ecosystem.config.js`) runs `server/dist/main.js` with:
- Daily restart at 3 AM
- 500MB memory limit
- Auto-restart on crash

## Electron (Desktop App)

```bash
# Build both client and server first, then:
npx electron main.js
```

The Electron shell loads `http://localhost:3001` — no IPC, just a browser window.

## Testing

### E2E Tests (Playwright)

```bash
cd client

# Run all tests (auto-starts Vite dev server)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run with Playwright UI
npm run test:e2e:ui

# Test against deployed environment
ATLAS_E2E_BASE_URL=https://www.atlas-support.se \
ATLAS_E2E_USER=test_user \
ATLAS_E2E_PASS=test_pass \
npm run test:e2e
```

135 tests across 13 spec files covering auth, navigation, views, tickets, bulk operations, modals, admin, search, templates, theme, and mobile layout.

## Project Structure

```
client/src/
├── components/     9 shared components (Sidebar, TicketDetail, Modals, etc.)
├── views/          7 page views + 12 Admin sub-views
├── context/        3 React contexts (Auth, Socket, Theme)
├── services/       API client + Socket.IO connection
├── hooks/          Shared data store
├── utils/          Styling utilities + icon constants
└── styles/         Global CSS + 8 component CSS files

server/src/
├── auth/           JWT login, Passport strategy, guards
├── tickets/        Inbox CRUD + Socket.IO gateway
├── admin/          30+ admin endpoints
├── rag/            AI pipeline (intent, force-add, search, OpenAI)
├── mail/           IMAP listener + Nodemailer
├── database/       SQLite service (better-sqlite3)
├── customers/      Customer list + history
├── templates/      Email template CRUD
├── notes/          Ticket notes CRUD
├── knowledge/      KB file I/O
├── upload/         File upload + TTL cleanup
└── webhook/        LiveHelperChat integration
```

## Database

SQLite file (`atlas.db`) created automatically on first server start. No manual setup needed.

- 11 tables auto-created via `CREATE TABLE IF NOT EXISTS`
- WAL mode for concurrent access
- Automatic backup every 24h via `VACUUM INTO`
- See `PROJECT_REFACTORING.md` for future Prisma + PostgreSQL migration plan
