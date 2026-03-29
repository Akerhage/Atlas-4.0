# Getting Started — Atlas 4.0

Steg-för-steg guide för att installera, seeda och starta Atlas lokalt.

## Förutsättningar

- **Node.js** 20+
- **npm** 9+

## 1. Installera dependencies

```bash
# Backend (NestJS)
cd server
npm install --legacy-peer-deps

# Frontend (React + Vite)
cd ../client
npm install
```

## 2. Skapa .env-fil

Kopiera exempelfilen i projektets rot:

```bash
cp .env.example .env
```

Fyll i minst dessa:

```env
JWT_SECRET=valfri-hemlig-nyckel
OPENAI_API_KEY=sk-...    # Krävs för AI-chatten
```

Se `.env.example` för alla tillgängliga variabler.

## 3. Skapa databasen och seeda testdata

```bash
cd server

# Skapa databas-schema (SQLite)
npx prisma db push

# Seeda med testdata (47 kontor, 4 användare, 19 ärenden, m.m.)
npm run db:seed
```

### Andra databas-kommandon

| Kommando | Beskrivning |
|----------|-------------|
| `npm run db:seed` | Seeda utan att radera befintlig data |
| `npm run db:reset` | Radera allt, skapa schema, seeda om |
| `npm run db:migrate` | Kör Prisma-migrering (schema-ändringar) |
| `npm run db:studio` | Öppna Prisma Studio (visuell DB-browser) |

## 4. Bygga backend

```bash
cd server
npm run build
```

## 5. Starta

### Alternativ A: Två terminaler (rekommenderat för utveckling)

**Terminal 1 — Backend (port 3001):**
```bash
cd server
npm run start:fresh
```

**Terminal 2 — Frontend med hot-reload (port 5173):**
```bash
cd client
npm run dev
```

Öppna **http://localhost:5173**

### Alternativ B: Bara backend (serverar React-build)

```bash
# Bygga frontend
cd client
npm run build

# Starta backend (serverar både API och frontend)
cd ../server
npm run start:fresh
```

Öppna **http://localhost:3001**

## 6. Logga in

| Användare | Lösenord | Roll | Kontor |
|-----------|----------|------|--------|
| `admin` | `admin123` | Admin | Göteborg Ullevi, Högsbo, Stora Holm |
| `sara` | `agent123` | Agent | Göteborg (6 kontor) |
| `johan` | `agent123` | Agent | Stockholm (5 kontor) |
| `maria` | `agent123` | Agent | Malmö + Skåne (6 kontor) |

## Vanliga kommandon

### Backend (från `server/`)

| Kommando | Beskrivning |
|----------|-------------|
| `npm run build` | Bygg NestJS till `dist/` |
| `npm run start:fresh` | Döda port 3001 + starta server |
| `npm run start:prod` | Starta från `dist/main.js` |
| `npm run lint` | TypeScript type-check |
| `npm run format:check` | Kolla Prettier-formatering |
| `npm run format` | Formatera all kod med Prettier |
| `npm test` | Kör Jest unit-tester (91 tester) |

### Frontend (från `client/`)

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Starta Vite dev-server (port 5173) |
| `npm run build` | Bygg React till `dist/` |
| `npm run lint` | ESLint + TypeScript check |
| `npm run format:check` | Kolla Prettier-formatering |
| `npm run test:e2e` | Kör Playwright e2e-tester (135 tester) |
| `npm run test:e2e:headed` | E2e med synlig browser |
| `npm run test:e2e:ui` | E2e med Playwright UI |

## Felsökning

### Port 3001 är upptagen
```bash
cd server && npm run start:fresh
```
Eller manuellt:
```bash
kill $(lsof -t -i:3001)
```

### Databasen saknar tabeller
```bash
cd server && npm run db:reset
```

### Frontend visar blank sida
Kontrollera att backend körs på port 3001:
```bash
curl http://localhost:3001/api/public/version
```
Förväntat svar: `{"version":"4.0"}`
