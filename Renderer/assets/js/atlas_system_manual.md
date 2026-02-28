
# Atlas – Systemmanual (autogenererad)

> Denna manual beskriver **hur Atlas fungerar som system** > – inte implementation på radnivå.

---

## Systemöversikt

Atlas är ett Electron-baserat supportsystem med:

- Node.js backend
- Express API
- Electron Renderer frontend
- SQLite för persistent state
- Knowledge-baserad logikmotor

---

## Centrala filer
- server.js
- main.js
- db.js
- legacy_engine.js
- config.json
- Renderer/renderer.js
- Renderer/index.html
- patch/forceAddEngine.js
- patch/intentEngine.js
- utils/contextLock.js
- utils/priceResolver.js

---

## Nätverk & portar
- Ingen explicit port identifierad

---

## API-endpoints
- post
- get

---

## IPC-kanaler
- Main

---

## Centrala identiteter & state
- conversationId
- userId
- session.id

---

## Knowledge-system (översikt)

Atlas använder JSON-baserade knowledge-filer i två huvudtyper:

### Basfakta-filer
- Global fakta (körkort, utbildning, policy)
- Delas mellan alla kontor

### Kontorsfiler
- Plats- och kontorsspecifik information
- En fil per kontor/stad

> Knowledge är data – inte systemlogik – och hålls separat från denna manual.

---

## Viktiga invariants

- Frontend får **aldrig** skapa session.id
- Backend är ensam ägare av state
- session.id måste alltid följa med i backend-flöden
- Knowledge-filer ska kunna ändras utan systemregression

---

## Filträd (översikt)

(Filträd saknas – kör print_tree.js först)