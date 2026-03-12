# Implementeringsplan — Modulära Vy-behörigheter (RBAC)

---

## Filer som påverkas

| Fil | Vad som ändras |
|---|---|
| `db.js` | Ny kolumn `allowed_views` + migration-guard |
| `routes/admin.js` | Ny endpoint `PUT /api/admin/user-views/:username` |
| `Renderer/modules/admin/admin-users.js` | Ny sektion "Vy-behörigheter" i `openAdminUserDetail()` |
| `Renderer/modules/admin/admin-agents.js` | Ny funktion `saveUserViews()` |
| `Renderer/renderer.js` | `updateInboxVisibility()` utökas |
| `Renderer/modules/socket-client.js` | Ny lyssnare `agent:views_updated` |
| `server.js` | Socket-emit vid vy-ändring |

`index.html` behöver **inte** röras.

---

## Steg 1 — db.js: Migration

Lägg till en ALTER TABLE-guard direkt efter CREATE TABLE users-blocket:

```js
db.run(`ALTER TABLE users ADD COLUMN allowed_views TEXT DEFAULT NULL`, err => {
  // Ignorera "duplicate column"-felet — förväntat vid omstart
});
```

`DEFAULT NULL` = ingen begränsning. Befintliga agenter påverkas inte.

Komplettera även `getUserByUsername()` (L699) som listar kolumner explicit — lägg till `allowed_views` i SELECT-listan så det följer med vid login.

---

## Steg 2 — routes/admin.js: Ny endpoint

```
PUT /api/admin/user-views/:username
Body: { allowed_views: ["inbox","my-tickets","archive"] }
```

1. Validera att anroparen har `role === 'admin'`
2. Spara `allowed_views` (JSON-sträng) i `users`-tabellen
3. Hitta användarens aktiva socket via `connectedUsers`-mappen i server.js
4. Emittar `agent:views_updated` med `{ username, allowed_views }`

---

## Steg 3 — renderer.js: Utöka updateInboxVisibility()

Befintlig funktion (L11–25) döljer/visar inbox och admin-tab baserat på `role`. Utökas med:

```js
const allowed = currentUser.allowed_views
  ? JSON.parse(currentUser.allowed_views)
  : null; // null = visa allt (default)

menuItems.forEach(item => {
  const view = item.dataset.view;
  if (view === 'chat') return; // Hem kan aldrig döljas
  if (view === 'admin' && !isSupport) {
    item.style.setProperty('display', 'none', 'important'); return;
  }
  if (allowed && !allowed.includes(view)) {
    item.style.setProperty('display', 'none', 'important');
  } else {
    item.style.setProperty('display', 'flex', 'important');
  }
});
```

---

## Steg 4 — socket-client.js: Ny lyssnare

Läggs till direkt efter `agent:offices_updated`-lyssnaren (L572):

```js
window.socketAPI.on('agent:views_updated', ({ username, allowed_views }) => {
  if (currentUser?.username !== username) return;

  // Synka state och localStorage
  currentUser.allowed_views = allowed_views;
  localStorage.setItem('atlas_user', JSON.stringify(currentUser));

  // Uppdatera sidebaren direkt
  updateInboxVisibility();

  // Om agenten är på en vy som nu är dold → skicka hem
  const currentView = document.querySelector('.menu-item.active')?.dataset.view;
  const allowed = allowed_views ? JSON.parse(allowed_views) : null;
  if (allowed && currentView && !allowed.includes(currentView) && currentView !== 'chat') {
    switchView('chat');
  }
});
```

---

## Steg 5 — admin-users.js: Ny orange sektion

Läggs till under det befintliga 2-kolumns griden i `openAdminUserDetail()`.

**Vybara alternativ** (mappar mot `data-view` i index.html):

| Visningsnamn | `data-view` |
|---|---|
| Hem | `chat` (låst, alltid på) |
| Mina ärenden | `my-tickets` |
| Inkorgen | `inbox` |
| Garaget | `archive` |
| Kunder | `customers` |
| Mailmallar | `templates` |
| Om | `about` |

`admin` hanteras av `role`-logiken och finns **inte** i allowed_views.

**CSS-mönster** — återanvänder exakt samma `label`+`checkbox`-struktur som de lila kontorsknapparna men med orange accent:

```
background: isAllowed ? 'rgba(200,120,30,0.25)' : 'rgba(255,255,255,0.04)'
border:     isAllowed ? 'rgba(255,160,50,0.5)'  : 'rgba(255,255,255,0.06)'
color:      isAllowed ? '#ffaa44'               : 'inherit'
```

---

## Steg 6 — admin-agents.js: saveUserViews()

Ny funktion som anropar den nya PUT-endpointen och visar toast-bekräftelse. Kopplas till en "Spara vy-behörigheter"-knapp i sektionen ovan.

---

## Default-läget — Ingen tappar sina vyer

`allowed_views = NULL` i databasen → koden tolkar det som "inga begränsningar" → alla agenter ser exakt samma saker som idag. Behörighetsbegränsning aktiveras **enbart** när ett explicit värde sparas av admin. Migrationen är 100% non-destructive.

---

## force_logout via socket (inbyggt för framtida bruk)

Byggs in men aktiveras **inte** automatiskt vid vy-ändring (för irriterande). Finns som admin-knapp vid behov:

```js
// server.js — emit från admin-endpoint
socket.emit('admin:force_logout', { reason: 'Behörigheter ändrade' });

// socket-client.js — lyssnare
window.socketAPI.on('admin:force_logout', ({ reason }) => {
  alert(`Sessionen avslutades av admin: ${reason}`);
  handleLogout(); // Rensar token + location.reload()
});
```

---

## Implementeringsordning

1. `db.js` — ALTER TABLE + getUserByUsername fix
2. `routes/admin.js` + `server.js` — endpoint + socket-emit
3. `renderer.js` — updateInboxVisibility() utökas
4. `socket-client.js` — ny lyssnare
5. `admin-users.js` — orange vy-sektion i UI
6. `admin-agents.js` — saveUserViews()
