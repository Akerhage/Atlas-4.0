// ============================================
// modules/admin/admin-audit.js
// VAD DEN GÖR: Admin — systemaudit och
//              Om-sidan
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders, State,               — renderer.js globals
//   ATLAS_VERSION, currentUser,                    — renderer.js globals
//   window.electronAPI                             — renderer.js/Electron
//   ADMIN_UI_ICONS                                 — ui-constants.js
//   showToast                                      — styling-utils.js
//   DOM                                            — renderer.js DOM-cache
// ============================================

// Renderar Om-vyn med systeminformation, temainställningar och ljudkontroll
async function renderAboutGrid() {
const grid = document.getElementById('about-grid');
if (!grid) return;

const savedTheme = localStorage.getItem('atlas-theme') || 'standard-theme';
const soundOn = State.soundEnabled !== false;
const themeOptions = [
['standard-theme', 'Standard Vision ⚡'],
['onyx-ultradark', 'Atlas Onyx ⚫'],
['carbon-theme', 'Atlas Carbon ⬛'],
['apple-dark', 'Apple Dark 🍏'],
['apple-road', 'Apple Road 🛣️'],
['atlas-nebula', 'Atlas Nebula 🌌'],
['sunset-horizon', 'Sunset Horizon 🌅'],
['atlas-navigator', 'Atlas Navigator 🧭'],
].map(([v, l]) => `<option value="${v}"${savedTheme === v ? ' selected' : ''}>${l}</option>`).join('');

grid.innerHTML = `
<!-- CELL 1: Tangentbordsgenvägar (övre vänster) -->
<div class="about-cell glass-effect">
<h3 class="about-cell-title">
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
Tangentbordsgenvägar
</h3>
<div class="about-shortcut-list">
<div class="about-shortcut-row">
<div class="about-kbd-group"><kbd>Ctrl</kbd><span class="about-kbd-sep">+</span><kbd>P</kbd></div>
<span class="about-shortcut-label">Starta ny fråga</span>
</div>
<div class="about-shortcut-row">
<div class="about-kbd-group"><kbd>Ctrl</kbd><span class="about-kbd-sep">+</span><kbd>Alt</kbd><span class="about-kbd-sep">+</span><kbd>P</kbd></div>
<span class="about-shortcut-label">Ställ följdfråga</span>
</div>
<div class="about-shortcut-row">
<div class="about-kbd-group"><kbd>Ctrl</kbd><span class="about-kbd-sep">+</span><kbd>C</kbd></div>
<span class="about-shortcut-label">Kopiera markerad text</span>
</div>
<div class="about-shortcut-row">
<div class="about-kbd-group"><kbd>Ctrl</kbd><span class="about-kbd-sep">+</span><kbd>S</kbd></div>
<span class="about-shortcut-label">Spara mall</span>
</div>
<div class="about-shortcut-row">
<div class="about-kbd-group"><kbd>Ctrl</kbd><span class="about-kbd-sep">+</span><kbd>Alt</kbd><span class="about-kbd-sep">+</span><kbd>T</kbd></div>
<span class="about-shortcut-label">Byt tema</span>
</div>
</div>
</div>

<!-- CELL 2: Snabbguide / Arbetsflöde (övre höger) -->
<div class="about-cell glass-effect">
<h3 class="about-cell-title">
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
Snabbguide — Arbetsflöde
</h3>
<div class="guide-section">
<div class="guide-step"><span class="step-number">1</span><div class="step-content"><strong>Markera text</strong> i vilket program som helst</div></div>
<div class="guide-step"><span class="step-number">2</span><div class="step-content"><strong>Tryck Ctrl+C</strong> för att kopiera</div></div>
<div class="guide-step"><span class="step-number">3</span><div class="step-content"><strong>Tryck Ctrl+P</strong> för att starta <strong>NY</strong> chatt</div></div>
<div class="guide-step"><span class="step-number">4</span><div class="step-content"><strong>Ctrl+Alt+P</strong> för att ställa en <strong>följdfråga</strong></div></div>
</div>
</div>

<!-- CELL 3: Min Statistik (nedre vänster) -->
<div class="about-cell glass-effect">
<h3 class="about-cell-title">
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
Min Statistik
</h3>
<div id="about-stats-content" style="flex:1; min-height:0; overflow:hidden; display:flex; align-items:center; justify-content:center;"><div class="spinner-small"></div></div>
</div>

<!-- CELL 4: Utseende & System (nedre höger) -->
<div class="about-cell glass-effect">
<h3 class="about-cell-title">
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9z"/></svg>
Utseende &amp; System
</h3>
<div class="setting-item">
<label>🎨 Välj tema</label>
<select id="theme-select" class="filter-select" onchange="changeTheme(this.value)">${themeOptions}</select>
</div>
<div class="setting-item" style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--border-color);">
<label style="cursor:pointer; display:flex; align-items:center; gap:8px;">🔔 Pling-ljud vid nytt ärende</label>
<input type="checkbox" id="sound-toggle" ${soundOn ? 'checked' : ''} style="transform:scale(1.3); cursor:pointer; appearance:auto; -webkit-appearance:checkbox; width:16px; height:16px; flex-shrink:0;" onchange="window._handleSoundToggle(this.checked)">
</div>
<div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:6px; padding-top:5px; display:flex; flex-direction:column; gap:1px;">
<div class="info-item"><span class="info-label">Atlas Version:</span><span id="app-version-display">${ATLAS_VERSION}</span></div>
<div class="info-item"><span class="info-label">Server Version:</span><span id="server-version-display">Hämtar...</span></div>
<div class="info-item"><span class="info-label">Serverstatus:</span><span id="server-status" style="color:#f1c40f; font-weight:700;">● Ansluter...</span></div>
<div class="info-item" id="about-user-info"></div>
<div class="info-item"><span class="info-label">Skapad av:</span><span>Patrik Åkerhage</span></div>
</div>
</div>
`;

// Populera serverstatus direkt med aktuellt socket-läge
const statusEl = document.getElementById('server-status');
const verEl = document.getElementById('server-version-display');
if (statusEl && window.socketAPI) {
const connected = window.socketAPI.isConnected();
statusEl.textContent = connected ? "🟢 LIVE" : "🔴 Frånkopplad";
statusEl.style.color = connected ? "#4cd137" : "#ff6b6b";
}
// Försök hämta version via REST om socket-versionen inte är känd
if (verEl && verEl.textContent === 'Hämtar...') {
try {
const vRes = await fetch(`${SERVER_URL}/api/public/version`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
if (vRes.ok) { const vData = await vRes.json(); verEl.textContent = vData.version || SERVER_VERSION || '—'; }
} catch (_) { verEl.textContent = '—'; }
}

// Ladda statistik
try {
const res = await fetch(`${SERVER_URL}/api/admin/user-stats/${currentUser.username}`, { headers: fetchHeaders });
const stats = res.ok ? await res.json() : {};
const s = (k) => stats[k] ?? 0;

const statsEl = document.getElementById('about-stats-content');
const userEl  = document.getElementById('about-user-info');

// Inloggad som: namn + roll-badge (undviker dubbletten "Admin ADMIN")
if (userEl) userEl.innerHTML = `
<span class="info-label">Inloggad som:</span>
<span><strong>${currentUser.display_name || currentUser.username}</strong><span class="about-role-badge">${(currentUser.role||'').toUpperCase()}</span></span>`;

// Mini-ikoner för statistikrader
const ICO = {
bolt:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
archive: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
mail:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
chat:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
pulse:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
check:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
robot:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
person:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
filter:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`
};

// Hjälpfunktion: stat-kort med siffra till vänster och etikett till höger
const statCard = (label, val, color = 'var(--text-primary)') =>
`<div style="display:flex; align-items:center; gap:7px; padding:5px 8px; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid rgba(255,255,255,0.07);">
<strong style="font-size:18px; font-weight:800; color:${color}; min-width:26px; text-align:center; line-height:1;">${val}</strong>
<span style="font-size:11px; opacity:0.9; line-height:1.3;">${label}</span>
</div>`;

// Hjälpfunktion: systemrad (etikett vänster / värde höger)
const sysRow = (label, val, color = 'var(--text-secondary)') =>
`<div style="display:flex; align-items:center; justify-content:space-between; gap:4px; padding:2px 5px; border-radius:5px; background:rgba(255,255,255,0.025);">
<span style="font-size:10px; color:var(--text-secondary); opacity:0.8;">${label}</span>
<strong style="font-size:12px; font-weight:700; color:${color}; white-space:nowrap;">${val}</strong>
</div>`;

if (statsEl) statsEl.innerHTML = `
<div style="display:grid; grid-template-columns:1fr 1fr; gap:7px; height:100%; overflow:hidden;">

<!-- Vänster: Egna ärenden -->
<div style="display:flex; flex-direction:column; gap:3px; min-height:0; overflow:hidden;">
<div style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--accent-primary); padding-bottom:3px; border-bottom:1px solid rgba(255,255,255,0.08);">Egna ärenden</div>
${statCard('⚡ Aktiva',     s('active'),         'var(--accent-primary)')}
${statCard('📦 Arkiverade', s('archived'),       '#4cd964')}
${statCard('✉️ Mail',       s('mail_handled'),   '#7eb8f7')}
${statCard('🔒 Interna',    s('internals_sent'), '#f1c40f')}
</div>

<!-- Höger: Systemtotal -->
<div style="display:flex; flex-direction:column; gap:2px; border-left:1px solid rgba(255,255,255,0.08); padding-left:8px; min-height:0; overflow:hidden;">
<div style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--text-secondary); opacity:0.7; padding-bottom:3px; border-bottom:1px solid rgba(255,255,255,0.08);">Systemtotal</div>
${sysRow('Pågående',      s('total_active'),   'var(--text-primary)')}
${sysRow('Avslutade',     s('total_archived'), '#4cd964')}
${sysRow('AI-besvarade',  s('ai_answered'),    'var(--accent-primary)')}
${sysRow('Agenthandlade', s('human_handled'),  '#4cd964')}
${sysRow('Spam/Tomma',    s('spam_count'),     '#ff453a')}
</div>

</div>`;
} catch (_) {
const statsEl = document.getElementById('about-stats-content');
if (statsEl) statsEl.innerHTML = '<div style="opacity:0.4; font-size:12px; padding:8px;">Statistik ej tillgänglig.</div>';
}
}

// =============================================================================
// FIX 6 — Om Atlas
// =============================================================================
async function renderAdminAbout() {
const listContainer = document.getElementById('admin-main-list');
const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!listContainer) return;

// Show full-width in the list pane, hide detail pane
if (placeholder) placeholder.style.display = 'none';
if (detailBox) { detailBox.style.display = 'none'; }

// Check backend status
let backendOk = false;
let dbOk = false;
try {
const r = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
backendOk = r.ok;
dbOk = r.ok;
} catch (_) {}

const dot = (ok) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ok ? '#4cd964' : '#555'};box-shadow:${ok ? '0 0 5px #4cd964' : 'none'};margin-right:6px;"></span>`;

listContainer.innerHTML = `
<div style="padding:20px; display:flex; flex-direction:column; gap:16px;">

<div style="padding:16px 18px; border-radius:12px; background:rgba(255,69,58,0.1); border:1px solid rgba(255,69,58,0.35); color:#ff6b6b; font-size:12px; line-height:1.6;">
<strong style="font-size:13px; display:block; margin-bottom:6px;">⚠ Varning — Systemkonfiguration</strong>
Ändringar i systemkonfigurationen kan påverka prestanda och stabilitet. Endast behörig personal bör ändra dessa värden. Kontakta systemansvarig vid tveksamhet.
</div>

<div class="glass-panel" style="padding:18px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
<h4 style="margin:0 0 12px 0; color:var(--accent-primary); font-size:11px; text-transform:uppercase; letter-spacing:1px;">Versionsinformation</h4>
<div style="display:grid; gap:8px; font-size:13px;">
<div style="display:flex; justify-content:space-between;">
<span style="opacity:0.5;">Version</span><strong>Atlas v3.12</strong>
</div>
<div style="display:flex; justify-content:space-between;">
<span style="opacity:0.5;">Build-datum</span><strong>2026-02-20</strong>
</div>
<div style="display:flex; justify-content:space-between;">
<span style="opacity:0.5;">Plattform</span><strong>Electron / Node.js / SQLite</strong>
</div>
</div>
</div>

<div class="glass-panel" style="padding:18px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
<h4 style="margin:0 0 12px 0; color:var(--accent-primary); font-size:11px; text-transform:uppercase; letter-spacing:1px;">Komponentstatus</h4>
<div style="display:grid; gap:8px; font-size:13px;">
<div>${dot(backendOk)}Backend / API-server</div>
<div>${dot(dbOk)}Databas (SQLite)</div>
<div>${dot(false)}AI-motor (kontrolleras separat)</div>
</div>
</div>

<div class="glass-panel" style="padding:18px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
<h4 style="margin:0 0 12px 0; color:var(--accent-primary); font-size:11px; text-transform:uppercase; letter-spacing:1px;">Support</h4>
<div style="font-size:12px; opacity:0.6; line-height:1.8;">
Vid tekniska problem, kontakta systemansvarig.<br>
Intern support: <strong style="color:var(--text-primary); opacity:1;">it@atlas.se</strong>
</div>
</div>

</div>`;
}

// ==========================================================
// FRISTÅENDE HJÄLPFUNKTIONER (GLOBAL SCOPE)
// ==========================================================
function auditDOM() {
console.log(`🔍 Startar DOM-Audit för Atlas ${ATLAS_VERSION}...`);
let errors = 0;

const check = (name, el) => {
if (!el) {
console.error(`❌ KABELBROTT: Elementet "${name}" saknas i index.html!`);
errors++;
}
};

if (typeof DOM === 'undefined') return console.error("❌ DOM-objektet saknas helt!");

// Kontrollera huvudvyer
Object.entries(DOM.views).forEach(([key, el]) => check(`Vy: ${key}`, el));

// Kontrollera kritiska fält
check("ChatMessages", DOM.chatMessages);
check("InboxList", DOM.inboxList);
check("ArchiveList", DOM.archiveList);
check("MyTicketsList", DOM.myTicketsList);


if (errors === 0) console.log("✅ ALLA DOM-KOPPLINGAR OK!");
else console.warn(`⚠️ HITTADE ${errors} FEL I KOPPLINGARNA.`);
}

/**
* ATLAS MASTER VALIDATOR
* Körs automatiskt för att hitta missmatchningar mellan JS, HTML och CSS.
*/
function masterSystemAudit() {
console.group("🚀 ATLAS SYSTEM INTEGRITY CHECK");

const missingInHtml = [];
const missingStyles = [];

// 1. Kontrollera alla objekt i DOM-cachen mot HTML
for (const [key, value] of Object.entries(DOM)) {
if (key === 'views' || key === 'inputs') {
for (const [subKey, subValue] of Object.entries(value)) {
if (!subValue) missingInHtml.push(`DOM.${key}.${subKey}`);
}
} else if (!value) {
missingInHtml.push(`DOM.${key}`);
}
}

// 2. Kontrollera om de ID:n vi använder faktiskt har CSS-regler
const criticalIDs = ['#chat-form', '#my-chat-input', '#my-ticket-chat-form', '#my-ticket-chat-input', '#my-chat-scroll-area'];

criticalIDs.forEach(id => {
const el = document.querySelector(id);

// Kontrollera endast styling om elementet faktiskt är synligt (inte dolt i en annan vy)
// offsetParent är null om elementet eller dess förälder har display: none
if (el && el.offsetParent !== null) { 
const styles = window.getComputedStyle(el);

// Om elementet inte har någon specifik bakgrund eller padding som vi förväntar oss från style.css
if (styles.padding === '0px' && styles.display === 'block') {
missingStyles.push(id);
}
}
});

// RAPPORTERING
if (missingInHtml.length > 0) {
console.warn("⚠️ HTML-SYNCH: Följande DOM-refs är null (borttagna vyer eller utgångna ID:n):", missingInHtml);
} else {
console.log("✅ HTML-SYNCH: Alla JS-referenser hittades i HTML.");
}

if (missingStyles.length > 0) {
console.warn("⚠️ CSS-VARNING: Följande ID:n saknar troligen styling i style.css:", missingStyles);
console.info("👉 Tips: Kolla om du glömt byta namn i style.css!");
} else {
console.log("✅ CSS-SYNCH: Alla kritiska element verkar ha stilregler.");
}

console.groupEnd();
}
