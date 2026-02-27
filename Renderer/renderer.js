// ============================================
// renderer.js
// VAD DEN GÖR: All UI-logik för Atlas — chatt, inkorg, ärendehantering, mallar, arkiv, profil och inloggning.
// ANVÄNDS AV: index.html (Electron renderer process)
// SENAST STÄDAD: 2026-02-27
// ============================================
const ATLAS_VERSION = '3.14'; // Centralt versionsnummer — uppdatera ENDAST här
// AVATAR_ICONS, UI_ICONS, ADMIN_UI_ICONS → flyttade till modules/ui-constants.js

// =============================================================================
// 🟢 ATLAS CORE REPAIR (Global Scope - Rad 50)
// =============================================================================
window.updateInboxVisibility = function() {
// currentUser är redan definierad som global let på rad 120 i din fil
if (!currentUser) return; 

const inboxTab = document.querySelector('li[data-view="inbox"]');
const adminTab = document.getElementById('menu-admin');

const isSupport = currentUser.role === 'support' || currentUser.role === 'admin';

// Måste använda setProperty med 'important' — CSS .menu-item{display:flex!important} vinner annars
if (inboxTab) inboxTab.style.setProperty('display', isSupport ? 'flex' : 'none', 'important');
if (adminTab) adminTab.style.setProperty('display', 'flex', 'important');

console.log("📍 [UI] updateInboxVisibility kördes för:", currentUser.role);
};

// claimTicket, claimTicketFromReader, assignTicketFromReader,
// saveTemplates, deleteTemplate, getAppInfo, saveQA, deleteQA, esc
// → flyttade till modules/ipc-bridges.js

// =============================================================================
// === 2. DOM ELEMENT CACHE (För prestanda & Säkerhet) ===
// Vi initierar objektet tomt här, och fyller det i DOMContentLoaded
let DOM = {
views: {},
inputs: {},
menuItems: null
};

// Tvinga rätt färg direkt vid uppstart för att undvika "blå-buggen"
(function initGlobalTheme() {
const savedUser = JSON.parse(localStorage.getItem('atlas_user'));
if (savedUser && savedUser.agent_color) {
document.documentElement.style.setProperty('--accent-primary', savedUser.agent_color);
}
})();

// =============================================================================
//=========ÄNRA AVATAR BUBBLANS FÄRGER OCH BILD=================================
// =============================================================================
function getAvatarBubbleHTML(user, size = "32px") {
if (!user) return `<div class="user-avatar" style="width:${size}; height:${size}; background:#333; border-radius:50%;"></div>`;

const color = user.agent_color || '#0071e3';
const avatarId = user.avatar_id;

// Hämta innehåll: Ikon om ID finns, annars initial
let content = '';
if (avatarId !== undefined && avatarId !== null && AVATAR_ICONS[avatarId]) {
content = AVATAR_ICONS[avatarId];
} else {
const displayName = user.display_name || (typeof formatName === 'function' ? formatName(user.username) : user.username);
content = displayName.charAt(0).toUpperCase();
}

// Returnera HTML - Notera klassen "avatar-inner-icon" för live-uppdatering
return `
<div class="user-avatar" style="width: ${size}; height: ${size}; border: 2px solid ${color}; position: relative; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); overflow: hidden;">
<div class="avatar-inner-icon" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: ${color}; fill: currentColor;">
${content}
</div>
${user.is_online !== undefined ? `<span class="status-indicator ${user.is_online ? 'online' : ''}" style="position: absolute; bottom: 0; right: 0; width: 25%; height: 25%; border-radius: 50%; background: ${user.is_online ? '#2ecc71' : '#95a5a6'}; border: 2px solid #1e1e1e;"></span>` : ''}
</div>
`;
}

// Ladda användaren DIREKT så den finns tillgänglig för allt
let authToken = localStorage.getItem('atlas_token');
let currentUser = JSON.parse(localStorage.getItem('atlas_user') || 'null');

// --- DYNAMISK KONTORSHANTERING (Ersätter 200+ rader hårdkodning) ---
let officeData = []; // Lagrar alla kontor från SQL i minnet
let usersCache = []; // Lagrar alla användare för agentfärger

// Bulk-mode state för Inkorg
let isBulkMode = false;
let selectedBulkTickets = new Set();

// Hämtar alla kontor från servern och lagrar dem i officeData för snabb uppslag
async function preloadOffices() {
try {
const res = await fetch(`${SERVER_URL}/api/public/offices`);
officeData = await res.json();
console.log(`✅ Laddat ${officeData.length} kontor från SQL.`);
} catch (err) { console.error("Kunde inte förladda kontor:", err); }
}

console.log('📋 officeData:', JSON.stringify(officeData.map(o => ({ tag: o.routing_tag, area: o.area, city: o.city }))));


// Hämtar alla användare från servern och lagrar dem i usersCache för agentfärger och namnuppslag
async function preloadUsers() {
try {
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
if (res.ok) usersCache = await res.json();
} catch (_) {}
}

// resolveLabel, formatName, getCityFromOwner → flyttade till modules/styling-utils.js

// Säkra att window.currentUser finns (för legacy-stöd)
if (currentUser) window.currentUser = currentUser;

// Returnerar true om inloggad användare har rollen 'admin' eller 'support'
function isSupportAgent() {
// Atlas: Vi litar på rollen som hämtats från databasen vid inloggning.
// Vi kollar efter både 'admin' och 'support' för att vara framtidssäkrade.
return currentUser && (currentUser.role === 'admin' || currentUser.role === 'support');
}

// 🛑 DEBUG (Uppdaterad för att visa både namn och roll)
if (currentUser) {
console.log("LOGGAD IN SOM:", currentUser.username);
console.log("ROLL:", currentUser.role);
console.log("HAR SUPPORT-BEHÖRIGHET?", isSupportAgent()); 
}

// =============================================================================
// 🔒 SECURITY INTERCEPTOR (Måste ligga först i filen)
// =============================================================================
const originalFetch = window.fetch;

// Skriv över standard-fetch för att fånga 401 (Utloggad) globalt
window.fetch = async (...args) => {
try {
const response = await originalFetch(...args);

// Om servern säger "Unauthorized" (401), logga ut direkt
if (response.status === 401) {
console.warn("⛔ 401 Unauthorized detekterat - Tvingar utloggning...");
handleLogout(); 
return response;
}

return response;
} catch (err) {
throw err;
}
};

const isElectron = (typeof window.electronAPI !== 'undefined');
// Ljudfil för notifieringar
const NOTIFICATION_SOUND = "assets/js/pling.mp3";

// ==========================================================
// === 1. NÄTVERK & MILJÖKONFIGURATION ===
// ==========================================================

// DIN NGROK-ADRESS (Uppdaterad för webb-åtkomst)
const NGROK_HOST = window.location.origin; // Dynamisk — härleds från aktuell URL

// Välj URL: Localhost för Electron, Ngrok för Webb/Mobil
let SERVER_URL = (isElectron || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
? 'http://localhost:3001' 
: NGROK_HOST;

console.log(`🌍 Miljö: ${isElectron ? 'ELECTRON' : 'WEBB'}`);
console.log(`🔗 Server URL: ${SERVER_URL}`);

// === 2. AUTHENTICATION & LOGIN UI ===
const loginModalHTML = `
<div id="login-modal" class="custom-modal-overlay" style="display:none;">
<div class="glass-modal-box glass-effect">
<div class="glass-modal-header" style="justify-content:center; position:relative;">
<h2 style="margin:0; color:var(--text-primary); font-size:1.5rem;">Atlas Login</h2>
<button class="modal-close" aria-label="Stäng login">×</button>
</div>

<div class="glass-modal-body" style="margin-top:20px;">
<form id="login-form" style="display:flex; flex-direction:column; gap:15px;">
<input type="text" id="login-user" placeholder="Användarnamn" required>
<input type="password" id="login-pass" placeholder="Lösenord" required>

<button id="login-btn" type="submit" class="btn-modal-confirm" style="width:100%;">Logga in</button>
</form>
<p id="login-error" style="color:#ff6b6b; margin-top:15px; font-size:13px; min-height:18px;"></p>
</div>
</div>
</div>
`;

// Smart definition av fetchHeaders - Hämtar alltid senaste token från 'atlas_token'
Object.defineProperty(window, 'fetchHeaders', {
get() {
const token = localStorage.getItem('atlas_token'); // Här är nyckeln vi såg i din logg

// Valfritt: Varning i konsolen om token saknas när man försöker hämta data
if (!token) console.warn("⚠️ FetchHeaders anropades utan att 'atlas_token' finns i minnet.");

return {
'Content-Type': 'application/json',
'Authorization': token ? `Bearer ${token}` : '',
'ngrok-skip-browser-warning': 'true' // Bra att ha kvar om du kör via ngrok ibland
};
},
configurable: true
});

// Hjälpfunktion: Avkoda JWT för att se utgångsdatum
function parseJwt(token) {
try {
const base64Url = token.split('.')[1];
const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
}).join(''));
return JSON.parse(jsonPayload);
} catch (e) { return null; }
}

// atlasConfirm, changeTheme → flyttade till modules/modals.js

// updateInboxBadge, drawTaskbarBadge → flyttade till modules/inbox-view.js

// =========================================================
// PROFILEN NERE TILL VÄNSTER - LOGIN-DELEN
// =========================================================
function updateProfileUI() {
console.log("🔧 updateProfileUI() körs");
const container = document.getElementById('user-profile-container');
const loginBtn = document.getElementById('login-btn-sidebar');
const nameEl = document.getElementById('current-user-name');
const initialContainer = document.querySelector('.user-initial');
const avatarRing = document.querySelector('.user-avatar');

if (authToken && currentUser) {
if (container) {
container.style.display = 'flex';
container.style.cursor = 'pointer';
container.onclick = () => { showProfileSettings(); };
}
if (loginBtn) loginBtn.style.display = 'none';

const color = currentUser.agent_color || '#0071e3';
const displayName = currentUser.display_name || currentUser.username || 'Agent';

// 1. Sätt global färg (Säkrar mot Ctrl+R buggen)
document.documentElement.style.setProperty('--accent-primary', color);

// 2. Namn och Status (innerHTML rensar gamla spänner automatiskt = ingen dubbeltext)
if (nameEl) {
nameEl.innerHTML = `
<span style="display:block; font-weight:600; color:white;">${displayName.charAt(0).toUpperCase() + displayName.slice(1)}</span>
${currentUser.status_text ? `<span class="user-status-text" style="display:block; font-size:10px; color:${color}; opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;" title="${currentUser.status_text}">💬 ${currentUser.status_text}</span>` : ''}
`;
}

// 3. Avatar & Färg
if (initialContainer) {
initialContainer.style.backgroundColor = color;
initialContainer.innerHTML = AVATAR_ICONS[currentUser.avatar_id || 0];
const svg = initialContainer.querySelector('svg');
if (svg) { svg.style.width = '20px'; svg.style.height = '20px'; }
}
if (avatarRing) avatarRing.style.borderColor = color;

} else {
if (container) container.style.display = 'none';
if (loginBtn) loginBtn.style.display = 'flex';
}

updateInboxVisibility();
}

//=======check auth =========//////
function checkAuth() {
console.log("🔐 checkAuth() körs");
// 1. Finns ingen token? Visa modal.
if (!authToken) {
console.log("  ⚠️ Ingen token - Visar login-modal");
const modal = document.getElementById('login-modal');
if(modal) modal.style.display = 'flex';
updateProfileUI(); // Döljer profilen
return false;
}

// 2. Har token gått ut?
const decoded = parseJwt(authToken);
if (decoded && decoded.exp) {
const now = Math.floor(Date.now() / 1000);
if (decoded.exp < now) {
console.warn("⚠️ Token har gått ut. Loggar ut...");
handleLogout();
return false;
}

// Sätt timer för auto-logout
const timeUntilExpiry = (decoded.exp * 1000) - Date.now();
if (timeUntilExpiry > 0) {
setTimeout(() => {
alert("Sessionen har gått ut.");
handleLogout();
}, timeUntilExpiry);
}
}

// 3. Allt ok - Uppdatera UI
console.log("  ✅ Token OK, uppdaterar profil-UI");
updateProfileUI();
return true;
}

// Rensar token och användarsession och laddar om sidan för att nollställa allt state
function handleLogout() {
console.log("🚪 Loggar ut...");
localStorage.removeItem('atlas_token');
localStorage.removeItem('atlas_user');
// Vi laddar om sidan för att nollställa allt (socket, state, minne)
location.reload(); 
}

// === MAIL - SPARA FRÅGA + SVAR
let lastEmailContext = "";

// let socket, window.socketAPI (stub+full), initializeSocket, updateServerStatusUI, loadSocketIoScriptWithRetry → flyttade till modules/socket-client.js

// ==========================================================
// === UI INITIALIZATION (Hero Placeholders)
// ==========================================================
function initHeroPlaceholders() {
const placeholders = {
'inbox-placeholder': {
title: 'Inkorgen',
subtitle: 'Välj ett inkommande ärende för att påbörja hanteringen.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"/><path d="M7 12h10"/><path d="m12 7 5 5-5 5"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>'
},
'my-detail-placeholder': {
title: 'Mina Ärenden',
subtitle: 'Fortsätt konversationen genom att välja en av dina aktiva chattar.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 7h8"/><path d="M8 11h5"/></svg>'
},
'archive-placeholder': {
title: 'Garaget',
subtitle: 'Sök och filtrera bland alla dina avslutade och arkiverade ärenden.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/></svg>'
},
'editor-placeholder': {
title: 'Mailmallar',
subtitle: 'Välj en mall i listan för att redigera eller skapa en ny.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
},
'admin-placeholder': { // <--- NU TILLAGD FÖR ATT MATCHA DIN INDEX.HTML RAD 395
title: 'Admin Dashboard',
subtitle: 'Välj en agent eller ett kontor för att hantera inställningar.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>'
}
};

Object.keys(placeholders).forEach(id => {
const el = document.getElementById(id);
if (el) {
const data = placeholders[id];
el.innerHTML = `
<div class="hero-placeholder">
<div class="hero-bg-icon">${data.bgIcon}</div>
<div class="hero-content">
<div class="hero-fg-icon">${data.fgIcon}</div>
<div class="hero-title">${data.title}</div>
<div class="hero-subtitle">${data.subtitle}</div>
</div>
</div>`;
}
});
}

// setupSocketListeners + alla window.socketAPI.on(...) → flyttade till modules/socket-client.js

// ==========================================================
// === 1. GLOBALA INSTÄLLNINGAR & STATE ===
// ==========================================================
let API_KEY = null;
const API_URL = `${SERVER_URL}/search_all`;

const State = {
currentSession: null,
inboxMode: 'team', 
templates: [],
localQA: [],
teamTickets: [],
archiveItems: [],
inboxExpanded: {
"Live-Chattar": false,
"Inkomna MAIL": false,
"Plockade Ärenden": false
},
// Sparar tiden när man lämnade respektive vy
lastSeen: {
inbox: Date.now(),
'my-tickets': Date.now(),
archive: Date.now(),
templates: Date.now()
}
};

// Quill Editor Instance
let quill = null;
let isLoadingTemplate = false;

// ChatSession, initChat, handleUserMessage, addBubble,
// resolveTicketTitle, saveLocalQA
// → flyttade till modules/chat-engine.js

// checkAndResetDetail → flyttad till modules/detail-ui.js

// renderInbox, renderInboxFromTickets, openInboxDetail → flyttade till modules/inbox-view.js

// renderMyTickets, openMyTicketDetail, attachMyTicketListeners → flyttade till modules/tickets-view.js

// atlasPrompt → flyttad till modules/modals.js

// archiveTicketFromMyTickets → flyttade till modules/tickets-view.js
// renderArchive, populateArchiveDropdowns → flyttade till modules/archive-view.js
// loadTemplates, renderTemplates, openTemplateEditor
// → flyttade till modules/templates-view.js

// ==========================================================
// VY-HANTERARE (SwitchView)
// ==========================================================
function switchView(viewId) {
const now = Date.now();

// A. Hitta vyn vi lämnar
const previousView = DOM.views ? Object.keys(DOM.views).find(key => DOM.views[key] && DOM.views[key].style.display === 'flex') : null;

if (previousView) {
State.lastSeen[previousView] = now;
resetToPlaceholder(previousView);
}

// 1. Dölj alla vyer
if (DOM.views) {
Object.values(DOM.views).forEach(v => {
if (v) v.style.display = 'none';
});
}

// 2. Visa den valda vyn
if (DOM.views && DOM.views[viewId]) {
DOM.views[viewId].style.display = 'flex';
}

// 🔥 KRITISK FIX: Låser höjden för mall-containern så CSS-centrering fungerar
if (viewId === 'templates') {
const tc = document.querySelector('#view-templates .templates-container');
if (tc) {
tc.style.height = 'calc(100vh - 71px)';
}
}

// 3. Uppdatera menyn
if (DOM.menuItems) {
DOM.menuItems.forEach(item => {
item.classList.toggle('active', item.dataset.view === viewId);
});
}

// 4. Ladda data (Special-logik)
if (viewId === 'inbox') {
State.inboxExpanded = { "Live-Chattar": false, "Inkomna MAIL": false, "Plockade Ärenden": false };
const searchEl = document.getElementById('inbox-search');
if (searchEl) searchEl.value = '';
renderInbox();
} 
else if (viewId === 'my-tickets') {
renderMyTickets();
}
else if (viewId === 'archive') {
renderArchive();
}
else if (viewId === 'admin') {
switchAdminTab('users');
}
else if (viewId === 'about') {
renderAboutGrid();
}
}

// renderAboutGrid → flyttade till modules/admin/admin-audit.js

window._handleSoundToggle = function(checked) {
State.soundEnabled = checked;
localStorage.setItem('atlas-sound-enabled', checked);
if (checked && typeof playNotificationSound === 'function') playNotificationSound();
};

// Stänger detaljvyn och visar tillbaka hero-platshållaren för angiven vy
function resetToPlaceholder(viewId) {
const mapping = {
'inbox':      { ph: 'inbox-placeholder',    det: 'inbox-detail' },
'my-tickets': { ph: 'my-detail-placeholder',  det: 'my-ticket-detail' },
'archive':    { ph: 'archive-placeholder',    det: 'archive-detail' },
'templates':  { ph: 'editor-placeholder',      det: 'template-editor-form' }
};

const target = mapping[viewId];
if (target) {
const phEl = document.getElementById(target.ph);
const detEl = document.getElementById(target.det);

if (phEl) phEl.style.display = 'flex';

if (detEl) {
// 🔥 SPECIALHANTERING: Rensa innehåll på ALLT utom mallarna
// Vi vill inte döda Quill-editorn genom att tömma dess HTML!
if (viewId !== 'templates') {
detEl.innerHTML = ''; 
} else {
// För mallar: Nollställ bara formuläret istället för att radera det
if (typeof detEl.reset === 'function') detEl.reset();
if (window.quill) quill.setContents([]); 
}

detEl.style.display = 'none';
detEl.removeAttribute('data-current-id');
}
}
}

//---------------------------------------
//-------GET AGENT STYLES-------------//
//---------------------------------------
// getAgentStyles → flyttad till modules/styling-utils.js

// =============================================================================
// HJÄLPFUNKTIONER (FORMATERING & LJUD)
// =============================================================================
// Spela upp notisljud
function playNotificationSound() {
// Kontrollera att NOTIFICATION_SOUND är definierad högst upp i filen
if (typeof NOTIFICATION_SOUND === 'undefined') return;

try {
const audio = new Audio(NOTIFICATION_SOUND);
audio.volume = 0.5; // Justera volym (0.0 - 1.0)
audio.play().catch(e => console.warn("Kunde inte spela ljud (Autoplay policy?):", e));
} catch (err) {
console.error("Ljudfel:", err);
}
}

// showToast → flyttad till modules/styling-utils.js

//------------------------------------------------------------
//------- MAIL-LÖSNING (KOMPLETT MED TIDSTÄMPEL) -------------
//------------------------------------------------------------
async function handleEmailReply(ticket) {
console.log("📩 Direkt-hantering av e-post för:", ticket.contact_name);

// 1. Extrahera data
const customerEmail = ticket.contact_email || ticket.email || "";
const mailSubject = ticket.subject || "Ärende från Atlas";
const originalMsg = ticket.last_message || "Ingen meddelandetext hittades";

// 🔥 SPARA FRÅGAN FÖR ATT BIFOGA TILL AI-SVARET SENARE
lastEmailContext = originalMsg; 

// 2. Skapa AI-instruktion för servern (Brusfilter)
const aiInstruction = `[SYSTEM-NOTERING: Detta är ett inkommande e-postmeddelande. Det kan innehålla mycket ovidkommande information. Din uppgift är att ignorera allt brus och endast fokusera på de faktiska frågorna som rör trafikskolan.]\n\nKUNDENS MAIL:\n${originalMsg}`;

try {
// 3. Kopiera kundens fråga till urklipp (Pling 1)
await navigator.clipboard.writeText(originalMsg);

// 4. Meddela servern att starta AI-generering
if (window.socketAPI) {
window.socketAPI.emit('team:email_action', { 
conversationId: ticket.conversation_id, 
action: 'auto_mailto_triggered',
content: aiInstruction 
});
}

// 5. Bekräfta start med ljud
playNotificationSound();

// 6. Öppna Outlook
const mailtoLink = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}`;
window.location.href = mailtoLink;

console.log("✅ Server notifierad. Outlook öppnad.");

} catch (err) {
console.error("❌ Fel vid e-post-hantering:", err);
window.location.href = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}`;
}
}

// ==========================================================
// 📂 MAIL - AUTOSVAR MED MALL ELLER SERVER
// ==========================================================
async function handleEmailTemplateReply(ticket) {
const templateSelect = document.getElementById('quick-template-select');
const selectedId = templateSelect.value;

if (!selectedId) {
alert("Välj en mall i listan till vänster först!");
templateSelect.focus();
return;
}

const template = State.templates.find(t => t.id == selectedId);
if (!template) return;

// 1. Hämta HTML-innehållet (för formatering/bilder) och Text (för fallback)
const templateHtml = template.content;
const tempDiv = document.createElement("div");
tempDiv.innerHTML = templateHtml;
const templatePlainText = tempDiv.textContent || tempDiv.innerText || "";

// 2. Förbered originalfrågan (radbrytningar för både HTML och Text)
const originalMsg = ticket.last_message || (ticket.messages && ticket.messages[0]?.content) || "";
const originalMsgHtml = originalMsg.replace(/\n/g, '<br>');

// 3. Sätt ihop Rich Text-versionen (HTML)
// Inkluderar <style> för att nollställa marginaler i Outlook/Word
const finalHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.2;">
<style>
p { margin: 0 !important; margin-bottom: 0 !important; padding: 0 !important; }
</style>
<div class="template-content">
${templateHtml}
</div>
<br><br>
<div style="border-top: 1px solid #ccc; padding-top: 10px; color: #666;">
<strong>URSPRUNGLIG FRÅGA:</strong><br>
${originalMsgHtml}
</div>
<br>
Med vänlig hälsning,<br>
<strong>Supporten My Driving Academy</strong>
</div>
`;

// 4. Sätt ihop Plain Text-versionen (Fallback)
const finalPlainText = `${templatePlainText}\n\n------------------\nURSPRUNGLIG FRÅGA:\n${originalMsg}`;

// 5. Hantera kopiering baserat på miljö
if (window.electronAPI && typeof window.electronAPI.send === 'function') {
// ELECTRON-LÄGE
window.electronAPI.send('force-copy-html-to-clipboard', {
html: finalHtml,
text: finalPlainText
});
console.log("✅ Kopierat via Electron IPC");
} else {
// WEBB-LÄGE (Ngrok/Browser)
try {
const typeHtml = "text/html";
const typeText = "text/plain";
const blobHtml = new Blob([finalHtml], { type: typeHtml });
const blobText = new Blob([finalPlainText], { type: typeText });

const data = [new ClipboardItem({
[typeHtml]: blobHtml,
[typeText]: blobText
})];

await navigator.clipboard.write(data);
console.log("✅ Kopierat Rich Text via Web Clipboard API");
} catch (err) {
console.error("❌ Webb-kopiering misslyckades:", err);
// Sista utvägen: Kopiera bara vanlig text om Rich Text nekas
await navigator.clipboard.writeText(finalPlainText);
}
}

// 6. Feedback & Öppna Outlook
playNotificationSound();
const originalText = templateSelect.options[templateSelect.selectedIndex].text;
templateSelect.options[templateSelect.selectedIndex].text = "✅ Rich Text kopierad!";

const customerEmail = ticket.contact_email || ticket.email || (ticket.locked_context ? ticket.locked_context.email : "") || "";
const mailSubject = ticket.subject || "Ärende från Atlas";
const mailtoLink = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}`;

window.location.href = mailtoLink;

setTimeout(() => {
templateSelect.options[templateSelect.selectedIndex].text = originalText;
templateSelect.value = "";
}, 2000);
}



// ==========================================================
// 📖 HJÄLPSYSTEM (KONTEXTUELL MANUAL)
// ==========================================================
function toggleHelp() {
const overlay = document.getElementById('atlas-help-overlay');
const content = document.getElementById('help-content-area');
const currentView = document.querySelector('.menu-item.active')?.dataset.view || 'chat';

if (overlay.style.display === 'flex') {
overlay.style.display = 'none';
return;
}

const helpTexts = {
'chat': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>Hemvyn (Privat AI)</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
<span><b>Sekretess</b>: Ingenting du skriver här loggas centralt. Dina konversationer sparas enbart lokalt på din enhet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4"/></svg></span>
<span><b>Genvägar</b>: Kortkommandona fungerar globalt i Windows även när appen körs minimerad i bakgrunden.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></span>
<span><b>Ctrl+P</b>: Startar en helt ny, ren session och rensar AI-minnet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
<span><b>Ctrl+Alt+P</b>: Fortsätter dialogen i den aktuella sessionen utan att rensa minnet.</span>
</li>
</ul>`,
'inbox': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>Om Inkorgen</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></span>
<span><b>Plocka</b>: Ta ägarskap. Detta visar teamet att kunden hanteras.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg></span>
<span><b>Tilldela ärende</b>: Använd tilldela-ikonen för att skicka ett inkommet ärende direkt till en specifik agent utan att plocka det själv.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
<span><b>Ta över</b>: Ta över ett ärende från en supportkollega vid behov.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#f39c12;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/></svg></span>
<span><b>Arkivera</b>: Flyttar ärendet till Garaget och stänger det permanent.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#ff6b6b;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>
<span><b>Radera</b>: Rensar bort ärendet helt från systemet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
<span><b>Sökfältet</b>: Filtrerar direkt bland alla aktiva ärenden i inkorgen. Sökningen inkluderar inte arkiverade ärenden, privata sessioner eller interna meddelanden.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m14 17 2 2 4-4"/></svg></span>
<span><b>Flerval (Bulk)</b>: Håll in musknappen på ett ärende (lång-klick) för att aktivera flervalsläget. Markera sedan flera ärenden och plocka eller arkivera dem alla på en gång via verktygsfältet som dyker upp.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg></span>
<span><b>Snabbsvar</b>: För live-chattar visas en snabbsvarsruta direkt i Inkorgen. Skriv ditt svar och tryck <b>Ctrl+Enter</b> för att svara och plocka ärendet i samma steg.</span>
</li>
</ul>`,
'my-tickets': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>Mina Ärenden</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>
<span><b>Aktiva ärenden</b>: Det går utmärkt att ha flera chattar och mail igång parallellt. Välj ett ärende i listan för att öppna detaljvyn och svara kunden.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
<span><b>Starta nytt ärende</b>: Via knappen högst upp i vyn kan du skapa ett nytt externt mail till en kund eller skicka ett privat internt meddelande direkt till en kollega.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#f39c12;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/></svg></span>
<span><b>Arkivera</b>: Flyttar ärendet till Garaget och stänger det permanent.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#ff6b6b;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>
<span><b>Radera</b>: Rensar bort ärendet helt från systemet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#f39c12;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/></svg></span>
<span><b>Arkivering av mail</b>: Chattar som arkiveras stängs permanent. Mail-ärenden stängs dock aldrig helt — svarar kunden på mailet återaktiveras ärendet automatiskt i Inkorgen.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></span>
<span><b>AI-förslag</b>: Klicka på AI-ikonen i svarsrutan för mail-ärenden för att låta Atlas analysera historiken och skapa ett utkast till svar åt dig.</span>
</li>
</ul>`,
'archive': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>Garaget (Smart Arkiv)</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
<span><b>Fritextsökning</b>: Sök bland alla avslutade ärenden via kundens mailadress, telefonnummer eller nyckelord från konversationen.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></span>
<span><b>Filtrera på kontor</b>: Hitta snabbt ärenden kopplade till en specifik stad eller plats via ortsfiltret.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></span>
<span><b>Fordonstyp</b>: Filtrera på körkortstyp eller fordonskategori för att snabbt hitta relevanta konversationer.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
<span><b>Agenthistorik</b>: Filtrera på kollega för att se hur ärenden hanterats tidigare — perfekt för onboarding och kvalitetssäkring.</span>
</li>
</ul>`,
'templates': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></span>Gemensamma Mallar</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg></span>
<span><b>Global lagring</b>: Alla mallar sparas på servern och är omedelbart tillgängliga för hela teamet — ingen synkronisering behövs.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg></span>
<span><b>Rich Text</b>: Stöd för bilder och avancerad formatering för proffsiga kundsvar i Outlook och andra mailklienter.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></span>
<span><b>Integrerat i svarsrutan</b>: I Mina Ärenden finns en rullgardinsmeny ovanför chattinputen. Välj en mall och texten klistras in direkt — blixtsnabbt och utan klipp-klistra.</span>
</li>
</ul>`,
'about': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Inställningar</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></span>
<span><b>Teman</b>: Anpassa Atlas utseende med ett av de professionella temana — från ljust minimalistiskt till mörkt och djärvt.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
<span><b>Ljud</b>: Slå av eller på notisljud för inkommande meddelanden och händelser.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
<span><b>Lokalt</b>: Dina inställningar sparas enbart för din inloggning och påverkar inte andra användare.</span>
</li>
</ul>`
};

content.innerHTML = helpTexts[currentView] || "<h4>Atlas AI</h4><p>Välj en sektion i menyn för hjälp.</p>";

overlay.style.display = 'flex';

// Lägg till click-outside handler för att stänga
overlay.onclick = (e) => {
if (e.target === overlay) {
overlay.style.display = 'none';
}
};
}

// ===== GLOBAL ESC KEY HANDLER FÖR ALLA MODALER =====
document.addEventListener('keydown', (event) => {
if (event.key === 'Escape') {
// Login modal
const loginModalEsc = document.getElementById('login-modal');
if (loginModalEsc && (loginModalEsc.style.display === 'flex' || window.getComputedStyle(loginModalEsc).display !== 'none')) {
loginModalEsc.style.display = 'none';
event.preventDefault();
return;
}
// Help overlay
const helpOverlay = document.getElementById('atlas-help-overlay');
if (helpOverlay && helpOverlay.style.display === 'flex') {
helpOverlay.style.display = 'none';
event.preventDefault();
return;
}

// Mail composer
const mailComposer = document.getElementById('atlas-mail-composer');
if (mailComposer && mailComposer.style.display === 'flex') {
mailComposer.style.display = 'none';
event.preventDefault();
return;
}

// Prompt modal
const promptModal = document.getElementById('atlas-prompt-modal');
if (promptModal && promptModal.style.display === 'flex') {
promptModal.style.display = 'none';
event.preventDefault();
return;
}

// Confirm modal
const confirmModal = document.getElementById('atlas-confirm-modal');
if (confirmModal && confirmModal.style.display === 'flex') {
confirmModal.style.display = 'none';
event.preventDefault();
return;
}

// Notes modal
const notesModal = document.getElementById('atlas-notes-modal');
if (notesModal && notesModal.style.display === 'flex') {
notesModal.style.display = 'none';
notesModal.innerHTML = '';
event.preventDefault();
return;
}

// Profile modal
const profileModal = document.getElementById('atlas-profile-modal');
if (profileModal && profileModal.style.display === 'flex') {
profileModal.style.display = 'none';
event.preventDefault();
return;
}

// Reader modal
const readerModal = document.getElementById('atlas-reader-modal');
if (readerModal && readerModal.style.display === 'flex') {
readerModal.style.display = 'none';
event.preventDefault();
return;
}
}
});


// ==========================================================
// 📖 FORMATTERING AV TEXT (OPTIMERAD + FILSTÖD)
// ==========================================================
function formatAtlasMessage(text) {
if (!text) return "<i>(Ingen text hittades)</i>";
let processedText = text.toString();

// 1. HTML-Detektering (Behåll din logik)
const hasHtml = /<[a-z][\s\S]*>/i.test(processedText) || processedText.includes("<div");
if (hasHtml) {
return processedText.replace(/^(<br\s*\/?>|\s)+/i, '').replace(/((<br\s*\/?>|\s)+)$/i, '');
}

// 2. Sanera och förbered text (Behåll din logik)
const sanitized = processedText
.replace(/\r\n/g, '\n')
.replace(/\r/g, '\n')
.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 3. Bild- och filstöd (Dina smarta regex)
let content = sanitized.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
const fullUrl = url.startsWith('/uploads') ? `${SERVER_URL}${url}` : url;
return `<div class="chat-image-container" style="margin: 10px 0;"><img src="${fullUrl}" alt="${alt}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open('${fullUrl}')"></div>`;
});

content = content.replace(/📎\s?\[Fil:\s?(.*?)\]\((.*?)\)/g, (match, name, url) => {
const fullUrl = url.startsWith('/uploads') ? `${SERVER_URL}${url}` : url;
return `<a href="${fullUrl}" target="_blank" class="file-attachment-link">📄 <b>${name}</b></a>`;
});

// 4. Bold & Länkar
content = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (match, label, url) => {
const fullUrl = url.startsWith('/uploads') ? `${SERVER_URL}${url}` : url;
return `<a href="${fullUrl}" target="_blank" class="atlas-link">${label}</a>`;
});

// 5. Splitta i rader, rensa tomma, slå ihop med <br> (undviker block-element som tvingar 100% bredd)
return content.split('\n')
.map(line => line.trim())
.filter(line => line !== '')
.join('<br>');
}

// Hjälpfunktion för att visa ren text i ärendekortet (tar bort HTML-taggar)
// stripHtml → flyttad till modules/styling-utils.js

// renderDetailHeader → flyttad till modules/detail-ui.js

// getVehicleIcon → flyttad till modules/detail-ui.js

// showAssignModal, performAssign → flyttade till modules/modals.js

// showProfileSettings → flyttad till modules/modals.js


/* ==========================================================
FAS 3: ADMIN MASTER MODE - KONSOLIDERAD v4.0
========================================================== */
// --- GLOBALA VARIABLER FÖR ADMIN-LÄSARE ---
let currentTicketList = [];
let currentTicketIdx = -1;
window._adminFormDirty = false;

// switchAdminTab → flyttad till modules/admin/admin-core.js

// renderAdminAbout → flyttade till modules/admin/admin-audit.js

// renderAdminUserList, openAdminUserDetail → flyttade till modules/admin/admin-users.js

// renderAdminOfficeList, openAdminOfficeDetail → flyttade till modules/admin/admin-offices.js

// =============================================================================
// NY FUNKTION: Lås upp specifik sektion i Kontorsvyn
// =============================================================================
window.unlockOfficeSection = function(sectionId, tag, btnElement) {
const box = document.getElementById(sectionId);
if (!box) return;

// Lås upp alla fält i denna sektion (utom färgväljaren som redan är klickbar)
box.querySelectorAll('input, textarea').forEach(el => {
if (el.id === 'inp-office-color') return;
el.disabled = false;
el.style.borderColor = 'var(--accent-primary)';
el.style.background = 'rgba(255,255,255,0.08)';
});

// Om det är pris-sektionen, visa lägg-till-knappen och papperskorgarna
if (sectionId === 'box-prices') {
const addBtn = document.getElementById('add-service-btn');
if (addBtn) addBtn.style.display = 'block';
box.querySelectorAll('.price-delete-btn').forEach(btn => btn.style.display = 'flex');
}

// Ändra knappen till "Spara" och gör den aktiv
btnElement.innerHTML = '💾 Spara';
btnElement.classList.add('unlocked');

// Byt onclick till att anropa spar-funktionen
btnElement.onclick = () => {
window.saveOfficeSection(tag);
btnElement.innerHTML = '⏳ Sparar...'; // Visuell laddnings-feedback
};
};

// =============================================================================
// ADMIN — TILLÄGG B: LÄGG TILL TJÄNST PÅ KONTOR (Uppdaterad)
// =============================================================================
async function openAddServicePanel() {
const panel = document.getElementById('add-service-panel');
const select = document.getElementById('new-service-select');
const priceInput = document.getElementById('new-service-price');
if (!panel || !select) return;

panel.style.display = 'block';
select.innerHTML = '<option value="">Hämtar tjänster...</option>';
if (priceInput) priceInput.value = ''; // Nollställ prisfältet!

try {
const res = await fetch(`${SERVER_URL}/api/admin/available-services`, { headers: fetchHeaders });
const services = await res.json();

// Spara globalt så confirmAddService kan läsa keywords senare
window._availableServiceTemplates = services; 

// Filtrera bort tjänster som redan finns på kontoret
const existing = new Set(
Array.from(document.querySelectorAll('#price-list-grid [data-service-name]'))
.map(el => el.getAttribute('data-service-name'))
);

const available = services.filter(s => !existing.has(s.service_name));
if (!available.length) {
select.innerHTML = '<option value="">Inga nya tillgängliga tjänster</option>';
} else {
select.innerHTML = '<option value="">— Välj tjänst —</option>' +
available.map(s => `<option value="${adminEscapeHtml(s.service_name)}">${adminEscapeHtml(s.service_name)}</option>`).join('');
}

// Tvinga prisrutan att bli tom om man byter tjänst
select.onchange = () => {
if (priceInput) priceInput.value = '';
};

} catch (e) {
select.innerHTML = '<option value="">Kunde inte hämta tjänster</option>';
}
}

function confirmAddService() {
const select = document.getElementById('new-service-select');
const priceInput = document.getElementById('new-service-price');
if (!select || !priceInput) return;

const serviceName = select.value;
const price = parseInt(priceInput.value) || 0;

if (!serviceName) { showToast('Välj en tjänst i listan.'); return; }

// Hitta tjänsten i vår globala template-lista för att få ut dess keywords
const template = (window._availableServiceTemplates || []).find(s => s.service_name === serviceName);
const keywords = template ? template.keywords : [];

const grid = document.getElementById('price-list-grid');
if (!grid) return;

const row = document.createElement('div');
row.className = 'price-row';
row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,100,0,0.15); border-radius:8px; border:1px solid rgba(0,200,100,0.2); margin-bottom:4px;';

// BAKAR IN KEYWORDS i DOM:en så vi kan plocka dem när vi sparar
row.setAttribute('data-keywords', JSON.stringify(keywords));

row.innerHTML = `
<span style="font-size:13px;" data-service-name="${adminEscapeHtml(serviceName)}">${adminEscapeHtml(serviceName)} <span style="font-size:10px; opacity:0.5;">(ny)</span></span>
<div style="display:flex; align-items:center; gap:8px;">
<input type="number" class="price-inp" data-new-service="${adminEscapeHtml(serviceName)}" value="${price}" style="width:80px; text-align:right; border-color:rgba(0,200,100,0.4); background:rgba(0,200,100,0.05); color:white; padding:4px; border-radius:4px;">
<span style="font-size:11px; opacity:0.6;">SEK</span>
<button class="price-delete-btn" onclick="this.closest('.price-row').remove(); window._adminFormDirty=true;" style="width:22px; height:22px; border-radius:50%; background:rgba(255,69,58,0.15); border:1px solid rgba(255,69,58,0.3); color:#ff453a; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; padding:0; line-height:1;">×</button>
</div>
`;
grid.appendChild(row);
window._adminFormDirty = true;

// Stäng panelen
document.getElementById('add-service-panel').style.display = 'none';
select.value = '';
priceInput.value = '';
showToast(`✅ ${serviceName} tillagd — spara för att bekräfta`);
}

// renderSystemConfigNav, openSystemConfigSection, renderConfigSection → flyttade till modules/admin/admin-config.js

function unlockDriftField(id, field) {
const inp = document.getElementById(`drift-${id}`);
const lockBtn = document.getElementById(`drift-lock-${id}`);
const saveBtn = document.getElementById(`drift-save-${id}`);
if (!inp || !lockBtn) return;
inp.disabled = false;
if (inp.type !== 'checkbox') inp.focus();
lockBtn.textContent = '🔓 Låst upp';
lockBtn.classList.add('unlocked');
if (saveBtn) saveBtn.style.display = 'inline-block';
lockBtn.onclick = () => {
inp.disabled = true;
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockDriftField(id, field);
if (saveBtn) saveBtn.style.display = 'none';
};
}

async function saveDriftFieldAndLock(id, field) {
const inp = document.getElementById(`drift-${id}`);
const lockBtn = document.getElementById(`drift-lock-${id}`);
const saveBtn = document.getElementById(`drift-save-${id}`);
if (!inp) return;
const value = inp.type === 'checkbox' ? inp.checked.toString() : inp.value.trim();
const labelEl = document.getElementById(`drift-${id}-label`);
if (labelEl) labelEl.textContent = inp.checked ? 'Aktiverad' : 'Avaktiverad';
await saveDriftSetting(field, value);
inp.disabled = true;
if (lockBtn) {
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockDriftField(id, field);
}
if (saveBtn) saveBtn.style.display = 'none';
}

async function saveDriftSetting(field, value) {
try {
const res = await fetch(`${SERVER_URL}/api/admin/operation-settings`, {
method: 'POST',
headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ field, value })
});
if (!res.ok) throw new Error('Save failed');
console.log(`[Drift] ${field} = ${value}`);
} catch (e) {
alert('Kunde inte spara inställning: ' + e.message);
}
}

function renderDriftSecuritySection(detailBox, s) {
function buildDriftLockRow(id, field, label, value, inputType) {
if (inputType === 'checkbox') {
const checked = value === true || value === 'true';
return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">${label}</label>
<div style="display:flex; align-items:center; gap:12px;">
<input type="checkbox" id="drift-${id}" ${checked ? 'checked' : ''} disabled>
<span style="font-size:13px;" id="drift-${id}-label">${checked ? 'Aktiverad' : 'Avaktiverad'}</span>
<button class="admin-lock-btn" id="drift-lock-${id}" onclick="unlockDriftField('${id}','${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="drift-save-${id}" onclick="saveDriftFieldAndLock('${id}','${field}')">Spara</button>
</div>
</div>`;
}
const extraStyle = inputType === 'number' ? 'width:80px;' : inputType === 'jwt' ? 'width:120px;' : 'flex:1;';
const actualType = inputType === 'jwt' ? 'text' : inputType;
const extras = inputType === 'number' ? 'min="1" max="168"' : '';
return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">${label}</label>
<div style="display:flex; align-items:center; gap:8px;">
<input type="${actualType}" id="drift-${id}" class="admin-config-field" value="${value}" ${extras} style="${extraStyle}" disabled>
<button class="admin-lock-btn" id="drift-lock-${id}" onclick="unlockDriftField('${id}','${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="drift-save-${id}" onclick="saveDriftFieldAndLock('${id}','${field}')">Spara</button>
</div>
</div>`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
<h3 style="margin:0 0 20px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🛡️ Drift & Säkerhet</h3>
${buildDriftLockRow('imap', 'imap_enabled', 'IMAP-polling (e-post)', s.imap_enabled, 'checkbox')}
${buildDriftLockRow('backup-interval', 'backup_interval_hours', 'Backup-intervall (timmar)', s.backup_interval_hours, 'number')}
${buildDriftLockRow('backup-path', 'backup_path', 'Backup-sökväg', s.backup_path, 'text')}
${buildDriftLockRow('jwt', 'jwt_expires_in', 'JWT-livslängd (t.ex. 24h, 7d)', s.jwt_expires_in, 'jwt')}
${buildDriftLockRow('auto-exit', 'auto_human_exit', 'Auto-Human-Exit (återgå till AI när alla ärenden stängs)', s.auto_human_exit, 'checkbox')}
</div>
</div>
`;
}

// buildConfigRow, unlockConfigField, saveSystemConfigField → flyttade till modules/admin/admin-config.js

// =============================================================================
// ADMIN TAB 3 — KUNSKAPSBANK (BASFAKTA)
// =============================================================================
// adminEscapeHtml → flyttad till modules/admin/admin-core.js

function renderBasfaktaSubList(files) {
const detailBox = document.getElementById('admin-detail-content');
const listContainer = document.getElementById('admin-main-list');
if (!detailBox) return;

if (listContainer) {
const existing = listContainer.querySelector('#kb-sublist');
if (existing) existing.remove();

const subList = document.createElement('div');
subList.id = 'kb-sublist';
subList.style.cssText = 'padding-left:14px; border-left:2px solid rgba(0,113,227,0.3); margin-left:8px; margin-top:4px;';
subList.innerHTML = files.map(f => `
<div class="admin-sysconfig-nav-item" style="font-size:11px; padding:7px 10px;" onclick="openBasfaktaEditor('${adminEscapeHtml(f.filename)}', this)">
📄 ${adminEscapeHtml((f.section_title || f.filename).replace(/^BASFAKTA\s*-\s*/i, ''))}
</div>
`).join('');

const kbItem = listContainer.querySelector('[onclick*="knowledge"]');
if (kbItem) kbItem.after(subList);
else listContainer.appendChild(subList);
}

detailBox.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-secondary); font-size:13px; opacity:0.6;">Välj en fil i listan till vänster</div>';
}

async function openBasfaktaEditor(filename, element) {
document.querySelectorAll('#kb-sublist .admin-sysconfig-nav-item').forEach(el => el.classList.remove('active'));
if (element) element.classList.add('active');

const detailBox = document.getElementById('admin-detail-content');
if (!detailBox) return;
detailBox.innerHTML = '<div class="spinner-small"></div>';

try {
const res = await fetch(`${SERVER_URL}/api/admin/basfakta/${encodeURIComponent(filename)}`, { headers: fetchHeaders });
if (!res.ok) throw new Error('Fetch failed');
const data = await res.json();
detailBox.setAttribute('data-kb-file', filename);

const sectionsHtml = data.sections.map((s, idx) => `
<div class="admin-kb-section-card" id="kb-section-${idx}">
<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
<input type="text" class="admin-kb-title-field" id="kb-title-${idx}" value="${adminEscapeHtml(s.title)}" readonly>
<button class="admin-lock-btn" onclick="unlockBasfaktaSection(${idx})" id="kb-lock-${idx}" style="flex-shrink:0;">🔒 Lås upp</button><button id="kb-delete-${idx}" onclick="deleteBasfaktaSection(${idx})" style="flex-shrink:0; background:transparent; border:1px solid rgba(255,69,58,0.3); color:rgba(255,69,58,0.6); border-radius:6px; padding:4px 8px; font-size:11px; cursor:pointer;" title="Ta bort sektion">🗑</button>
</div>
<textarea class="admin-kb-answer-field" id="kb-answer-${idx}" rows="3" readonly>${adminEscapeHtml(s.answer)}</textarea>
<div class="admin-kb-keywords">
${(s.keywords || []).map(k => `<span class="kw-pill">${adminEscapeHtml(k)}</span>`).join('')}
</div>
</div>
`).join('');

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:20px;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
<div>
<h3 style="margin:0; font-size:14px; color:var(--accent-primary);">${adminEscapeHtml(data.section_title || filename)}</h3>
<div style="font-size:11px; opacity:0.5; margin-top:4px;">${data.sections.length} sektioner • ${adminEscapeHtml(filename)}</div>
</div>
<button class="header-button icon-only-btn" title="Spara fil" onclick="saveBasfaktaFile('${adminEscapeHtml(filename)}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
</div>
<div id="kb-sections-container">${sectionsHtml}</div>
<div style="margin-top:16px; text-align:center;">
<button onclick="addNewBasfaktaSection()" style="background:transparent; border:1px dashed rgba(0,113,227,0.4); color:rgba(0,113,227,0.7); border-radius:8px; padding:8px 20px; font-size:12px; cursor:pointer; width:100%;" title="Lägg till ny sektion">＋ Lägg till sektion</button>
</div>
</div>
</div>
`;
} catch (e) {
detailBox.innerHTML = `<div style="padding:20px; color:#ff6b6b;">Kunde inte ladda: ${adminEscapeHtml(filename)}</div>`;
}
}

// =============================================================================
// unlockBasfaktaSection (lägger till inline Spara-knapp)
// =============================================================================
function unlockBasfaktaSection(idx) {
const card = document.getElementById(`kb-section-${idx}`);
const titleField = document.getElementById(`kb-title-${idx}`);
const answerField = document.getElementById(`kb-answer-${idx}`);
const lockBtn = document.getElementById(`kb-lock-${idx}`);
if (!card || !titleField || !answerField || !lockBtn) return;

card.classList.add('unlocked');
titleField.removeAttribute('readonly');
answerField.removeAttribute('readonly');
answerField.style.height = 'auto';
answerField.style.height = answerField.scrollHeight + 'px';
lockBtn.textContent = '💾 Spara';
lockBtn.classList.add('unlocked');

lockBtn.onclick = () => {
const detailBox = document.getElementById('admin-detail-content');
const filenameAttr = detailBox ? detailBox.getAttribute('data-kb-file') : null;
if (filenameAttr) saveBasfaktaFile(filenameAttr);
};
}

// deleteBasfaktaSection → flyttade till modules/admin/admin-tools.js

// =============================================================================
// NY FUNKTION: addNewBasfaktaSection — lägger till ny sektionskort längst ner
// =============================================================================
function addNewBasfaktaSection() {
const container = document.getElementById('kb-sections-container');
if (!container) return;

const existing = container.querySelectorAll('.admin-kb-section-card');
const newIdx = existing.length;

const newCard = document.createElement('div');
newCard.className = 'admin-kb-section-card unlocked';
newCard.id = `kb-section-${newIdx}`;
newCard.style.cssText = 'border: 1px solid rgba(0,113,227,0.4); background: rgba(0,113,227,0.06);';
newCard.innerHTML = `
<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
<input type="text" class="admin-kb-title-field" id="kb-title-${newIdx}" placeholder="Rubrik / Fråga..." style="flex:1;">
<button class="admin-lock-btn unlocked" id="kb-lock-${newIdx}" style="flex-shrink:0;" onclick="
(function(){
const detailBox = document.getElementById('admin-detail-content');
const fn = detailBox ? detailBox.getAttribute('data-kb-file') : null;
if(fn) saveBasfaktaFile(fn);
})()
">💾 Spara</button>
</div>
<textarea class="admin-kb-answer-field" id="kb-answer-${newIdx}" rows="3" placeholder="Skriv svaret här..."></textarea>
<div class="admin-kb-keywords" style="opacity:0.4; font-size:11px; margin-top:6px;">Keywords genereras automatiskt av AI vid sparning</div>
`;

container.appendChild(newCard);
newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
document.getElementById(`kb-title-${newIdx}`)?.focus();
}


async function saveBasfaktaFile(filename) {
const detailBox = document.getElementById('admin-detail-content');
if (!detailBox) return;

const sections = [];
let idx = 0;
while (document.getElementById(`kb-section-${idx}`)) {
const title = document.getElementById(`kb-title-${idx}`)?.value || '';
const answer = document.getElementById(`kb-answer-${idx}`)?.value || '';
sections.push({ title, answer });
idx++;
}

const saveBtn = detailBox.querySelector('button[onclick*="saveBasfaktaFile"]');
if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '⏳ Validerar...'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/basfakta/${encodeURIComponent(filename)}`, {
method: 'PUT',
headers: fetchHeaders,
body: JSON.stringify({ sections })
});
const data = await res.json();

if (!res.ok) {
showToast(`❌ ${data.error || 'Valideringsfel'}`);
if (data.aiMessage) {
const container = detailBox.querySelector('.detail-container');
if (container) {
const errDiv = document.createElement('div');
errDiv.style.cssText = 'margin-top:12px; padding:12px; background:rgba(255,0,0,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:8px; font-size:12px; color:#ff6b6b;';
errDiv.textContent = `AI-validering: ${data.aiMessage}`;
container.appendChild(errDiv);
}
}
} else {
showToast('✅ Filen sparad och validerad!');
openBasfaktaEditor(filename, null);
}
} catch (e) {
showToast('❌ Nätverksfel vid sparning.');
} finally {
if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`; }
}
}

//=============================================
//====== OPEN TICKET READER CONTENT admin
//=============================================
function openTicketReader(idx, overrideTag = null) {
// 1. Spara index och den valda färg-taggen globalt
currentTicketIdx = idx;
window._currentAdminOverrideTag = overrideTag; 

let modal = document.getElementById('atlas-reader-modal');

// 2. Skapa modalen om den inte finns
if (!modal) { 
modal = document.createElement('div');
modal.id = 'atlas-reader-modal';
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '10000';
document.body.appendChild(modal);
}

// 3. Rendera innehållet (nu med kännedom om overrideTag)
renderReaderContent();

// 4. Visa modalen och aktivera stängning vid klick utanför
modal.style.display = 'flex';
modal.style.pointerEvents = 'all';
modal.onclick = (e) => { 
if (e.target === modal) modal.style.display = 'none'; 
};
}

// =============================================
// ====== RENDER READER CONTENT admin
// =============================================
function renderReaderContent() {
// 1. Säkra att vi har ett ärende och en modal att skriva till
const list = (typeof currentTicketList !== 'undefined') ? currentTicketList : (window._currentAdminTickets || []);
const t = list[currentTicketIdx];
if (!t) return;

const modal = document.getElementById('atlas-reader-modal');
if (!modal) return;

// 2. BRANDING: Använd sparad overrideTag (t.ex. Patric/Gävle) om den finns
const brandingTag = window._currentAdminOverrideTag || t.routing_tag || t.owner;
const rStyles = getAgentStyles(brandingTag);

const readerTitle = resolveTicketTitle(t);
const readerSubtitle = resolveLabel(t.routing_tag || t.owner);

// 3. OSCAR BERG-FIX: Förbered meddelandehistoriken
let messageHistoryHtml = '';
const messages = t.messages || [];

if (messages.length === 0) {
// Om historiken är tom, använd last_message
const raw = t.last_message || t.content || "Ingen historik ännu.";
const clean = raw.replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
messageHistoryHtml = `
<div style="display:flex; flex-direction:column; align-items:flex-start;">
<div style="font-size:9px; font-weight:700; letter-spacing:0.8px; opacity:0.4; margin-bottom:3px; color:${rStyles.main};">INKOMMET MEDDELANDE</div>
<div style="max-width:78%; padding:9px 13px; border-radius:3px 12px 12px 12px; background:${rStyles.bubbleBg}; border:1px solid ${rStyles.border}; font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">
${clean}
</div>
</div>`;
} else {
// Om historik finns, loopa igenom meddelandena
messageHistoryHtml = messages.map(m => {
const isUser = m.role === 'user'; 
const cleanText = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
return `
<div style="display:flex; flex-direction:column; align-items:${isUser ? 'flex-start' : 'flex-end'};">
<div style="font-size:9px; font-weight:700; letter-spacing:0.8px; opacity:0.4; margin-bottom:3px; color:${isUser ? rStyles.main : 'rgba(255,255,255,0.7)'};">
${isUser ? 'KUND' : 'AGENT'}
</div>
<div style="max-width:78%; padding:9px 13px; border-radius:${isUser ? '3px 12px 12px 12px' : '12px 3px 12px 12px'}; background:${isUser ? rStyles.bubbleBg : 'rgba(255,255,255,0.05)'}; border:1px solid ${isUser ? rStyles.border : 'rgba(255,255,255,0.07)'}; font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">
${cleanText}
</div>
</div>`;
}).join('');
}

// 4. BYGG MODALENS HTML
modal.innerHTML = `
<div class="glass-modal-box glass-effect" style="width:680px; max-width:92vw; border-top:3px solid ${rStyles.main}; position:relative; display:flex; flex-direction:column; max-height:82vh; overflow:hidden;">

<button id="reader-close-btn"
style="position:absolute; top:10px; right:10px; z-index:10; width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;"
onmouseover="this.style.background='rgba(255,69,58,0.45)';this.style.color='white'"
onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.4)'">
${ADMIN_UI_ICONS.CANCEL}
</button>

<div style="padding:14px 48px 14px 16px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; justify-content:space-between; align-items:center; flex-shrink:0; background:linear-gradient(90deg, ${rStyles.main}14, transparent);">
<div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
<div style="width:40px; height:40px; border-radius:10px; background:${rStyles.main}; color:black; font-weight:800; font-size:17px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 12px ${rStyles.main}55;">
${(readerTitle || 'U').substring(0,1).toUpperCase()}
</div>
<div style="min-width:0;">
<div style="font-size:15px; font-weight:700; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">${readerTitle || 'Okänd'}</div>
<div style="font-size:10px; opacity:0.4; color:white; letter-spacing:0.3px;">${readerSubtitle || ''} • ${t.conversation_id.replace('session_','').substring(0,10)}</div>
</div>
</div>

<div style="display:flex; align-items:center; gap:5px; flex-shrink:0; margin-left:10px;">
<button class="btn-glass-icon notes-trigger-btn"
onclick="openNotesModal('${t.conversation_id}')"
title="Interna anteckningar"
style="color:${rStyles.main}; border-color:${rStyles.border};">
${UI_ICONS.NOTES}
</button>
<div style="width:1px; height:16px; background:rgba(255,255,255,0.1); margin:0 3px;"></div>
<button class="btn-glass-icon" id="reader-prev"
${currentTicketIdx === 0 ? 'disabled' : ''}
style="${currentTicketIdx === 0 ? 'opacity:0.22; pointer-events:none;' : ''}"
title="Föregående ärende">
${ADMIN_UI_ICONS.ARROW_LEFT}
</button>
<span style="font-size:11px; font-weight:700; opacity:0.55; font-family:monospace; color:white; min-width:32px; text-align:center;">${currentTicketIdx + 1}/${currentTicketList.length}</span>
<button class="btn-glass-icon" id="reader-next"
${currentTicketIdx === currentTicketList.length - 1 ? 'disabled' : ''}
style="${currentTicketIdx === currentTicketList.length - 1 ? 'opacity:0.22; pointer-events:none;' : ''}"
title="Nästa ärende">
${ADMIN_UI_ICONS.ARROW_RIGHT}
</button>
</div>
</div>

<div style="flex:1; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:10px; min-height:0;">
${messageHistoryHtml}
</div>

<div style="padding:9px 14px; border-top:1px solid rgba(255,255,255,0.07); background:rgba(0,0,0,0.3); display:flex; justify-content:flex-end; align-items:center; gap:8px; flex-shrink:0;">
<button class="btn-glass-icon" onclick="assignTicketFromReader('${t.conversation_id}')"
title="Tilldela ärende till agent"
style="color:var(--text-secondary);">
${UI_ICONS.ASSIGN}
</button>
<button class="btn-glass-icon" onclick="claimTicketFromReader('${t.conversation_id}')"
title="Plocka upp ärendet"
style="color:${rStyles.main}; border-color:${rStyles.border}; background:${rStyles.main}1a;">
${UI_ICONS.CLAIM}
</button>
</div>

</div>`; // Slut på modal.innerHTML

// --- 5. LOGIK FÖR KNAPPAR (Kopplas efter att HTML injicerats) ---
modal.style.pointerEvents = 'all';

const closeBtn = modal.querySelector('#reader-close-btn');
if (closeBtn) {
closeBtn.style.pointerEvents = 'all';
closeBtn.onclick = () => { modal.style.display = 'none'; };
}

const prevBtn = modal.querySelector('#reader-prev');
const nextBtn = modal.querySelector('#reader-next');

if (prevBtn && currentTicketIdx > 0) {
prevBtn.style.pointerEvents = 'all';
prevBtn.onclick = () => navigateReader(-1);
}

if (nextBtn && currentTicketIdx < currentTicketList.length - 1) {
nextBtn.style.pointerEvents = 'all';
nextBtn.onclick = () => navigateReader(1);
}
} // <--- Denna stänger hela funktionen renderReaderContent

// ===================================================
// ADMIN - NAVIGERA READER
// ===================================================
function navigateReader(dir) {
const newIdx = currentTicketIdx + dir;
if (newIdx >= 0 && newIdx < currentTicketList.length) {
currentTicketIdx = newIdx;
renderReaderContent();
}
}

// openNewAgentForm, saveNewAgent, openNewOfficeForm, saveNewOffice → flyttade till modules/admin/admin-forms.js


window.createNewUser = async () => {
const username = await atlasPrompt("Ny Agent", "Ange inloggningsnamn:");
if (!username) return;
const password = await atlasPrompt("Lösenord", `Ange lösenord för ${username}:`, "Välkommen123!");
if (!password) return;
const res = await fetch(`${SERVER_URL}/api/admin/create-user`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ username, password, role: 'agent' }) });
if (res.ok) renderAdminUserList();
else alert("Kunde inte skapa agent.");
};

window.toggleAdminStatus = async (username, isAdmin) => {
const newRole = isAdmin ? 'support' : 'agent';
const res = await fetch(`${SERVER_URL}/api/admin/update-role-by-username`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ username, newRole }) });
if (res.ok) showToast(`Rättigheter uppdaterade för @${username}`);
};

// =============================================================================
// UI: UPPDATERA FÄRGER PÅ AGENTER
// =============================================================================
window.updateAgentColor = async (username, color) => {
const res = await fetch(`${SERVER_URL}/api/admin/update-agent-color`, { 
method: 'POST', 
headers: fetchHeaders, 
body: JSON.stringify({ username, color }) 
});

if (res.ok) {
showToast("Färg sparad");

// --- START PÅ LIVE-UPPDATERING I UI ---
const detailBox = document.getElementById('admin-detail-content');
if (detailBox) {
// 1. Uppdatera Headern
const headerTop = detailBox.querySelector('.detail-header-top');
if (headerTop) {
headerTop.style.borderBottomColor = color;
headerTop.style.background = `linear-gradient(90deg, ${color}22, transparent)`;
}

// 2. Uppdatera Avatar-ringen OCH ikonen inuti (Det du störde dig på!)
const avatar = detailBox.querySelector('.msg-avatar');
if (avatar) {
avatar.style.borderColor = color;
// Här letar vi upp div:en inuti bubblan. 
// Eftersom din getAvatarBubbleHTML har "color: ${color}" på inner-diven, uppdaterar vi den här:
const innerIconContainer = avatar.querySelector('.avatar-inner-icon') || avatar.querySelector('.user-avatar div');
if (innerIconContainer) {
innerIconContainer.style.color = color;
}
}

// 3. Uppdatera de nya SVG-ikonerna (Notes och Pennan)
const notesBtn = document.getElementById('agent-detail-notes-btn');
const editBtn = document.getElementById('agent-detail-edit-btn');
if (notesBtn) notesBtn.style.color = color;
if (editBtn) editBtn.style.color = color;

// 4. Uppdatera Piller & Ärendekort
const rolePill = detailBox.querySelector('.header-pills-row .pill');
if (rolePill) { 
rolePill.style.borderColor = color; 
rolePill.style.color = color; 
}

detailBox.querySelectorAll('.admin-ticket-preview').forEach(card => {
card.style.setProperty('--atp-color', color);
});
}

// KIRURGISK FIX: Synka med sidofältet om det är JAG (currentUser) som ändras
if (currentUser && username === currentUser.username) {
currentUser.agent_color = color;
localStorage.setItem('atlas_user', JSON.stringify(currentUser));

const sideAvatarRing = document.querySelector('.sidebar-footer .user-avatar');
const sideIconContainer = document.querySelector('.sidebar-footer .user-initial');
if (sideAvatarRing) sideAvatarRing.style.setProperty('border-color', color, 'important');
if (sideIconContainer) sideIconContainer.style.setProperty('background-color', color, 'important');
}

// --- DIN ORIGINAL-LOGIK (RÖR EJ) ---
const cached = usersCache.find(u => u.username === username);
if (cached) cached.agent_color = color;

renderAdminUserList();
renderMyTickets?.();
renderInbox?.();
}
};

// =============================================================================
// UI: UPPDATERA ROLLER PÅ AGENTER
// =============================================================================
window.updateAgentOfficeRole = async (username, tag, isChecked, checkboxEl) => {
const res = await fetch(`${SERVER_URL}/api/admin/update-agent-offices`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ username, tag, isChecked })
});
if (res.ok) {
showToast("Kontor uppdaterat");
// Visuell uppdatering direkt utan reload
if (checkboxEl) {
const label = checkboxEl.closest('label');
if (label) {
label.style.background = isChecked ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
label.style.borderColor = isChecked ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
label.style.color = isChecked ? '#b09fff' : '';
}
}
}
};

// =============================================================================
// UI: SPARA KONTORS FAKTA
// =============================================================================
async function saveOfficeKnowledge(tag) {
try {
const resGet = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders });
const data = await resGet.json();

// Uppdatera priser
document.querySelectorAll('.price-inp').forEach(input => {
const idx = input.getAttribute('data-idx');
if (data.prices && data.prices[idx]) data.prices[idx].price = parseInt(input.value) || 0;
});

// KORREKTA ID:N (Matchar openAdminOfficeDetail)
if(document.getElementById('inp-phone')) data.contact.phone = document.getElementById('inp-phone').value;
if(document.getElementById('inp-email')) data.contact.email = document.getElementById('inp-email').value;
if(document.getElementById('inp-address')) data.contact.address = document.getElementById('inp-address').value;
if(document.getElementById('inp-desc')) data.description = document.getElementById('inp-desc').value;

const resPut = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { method: 'PUT', headers: fetchHeaders, body: JSON.stringify(data) });
if (resPut.ok) showToast("✅ Kontorsdata sparad!");
} catch (err) { alert("Kunde inte spara: " + err.message); }
}

// resetUserPassword, deleteUser, deleteOffice → flyttade till modules/admin/admin-tools.js

// =============================================================================
// UI: UPPDATERA GLÖD-EFFEKT PÅ KNAPPAR
// =============================================================================
async function refreshNotesGlow(conversationId) {
try {
const res = await fetch(`${SERVER_URL}/api/notes/${conversationId}`, { headers: fetchHeaders });
const notes = await res.json();

// Hitta alla knappar i hela appen som hör till detta ID (Inbox, Mina Ärenden, Garage)
const buttons = document.querySelectorAll(`.notes-trigger-btn[data-id="${conversationId}"]`);

buttons.forEach(btn => {
if (notes && notes.length > 0) {
btn.classList.add('has-notes-active'); // Denna klass triggar animationen i din CSS
} else {
btn.classList.remove('has-notes-active');
}
});
} catch (err) {
// Tyst felhantering för att inte störa användaren vid t.ex. nätverksblink
}
}

// =============================================================================
// MODAL: ÖPPNA INTERNA ANTECKNINGAR
// =============================================================================
// openNotesModal, loadNotes, editNote, saveNoteEdit, deleteNote
// → flyttade till modules/notes-system.js

// ---------------------------------------------------------------------------
// SLUT PÅ INITIALISERING (DOMContentLoaded)
// ---------------------------------------------------------------------------
// toggleBulkCard, showBulkToolbar, updateBulkToolbar,
// exitBulkMode, bulkClaim, bulkArchive
// → flyttade till modules/bulk-ops.js

// auditDOM, masterSystemAudit → flyttade till modules/admin/admin-audit.js


// =============================================================================
// 🚀 ATLAS MASTER INIT - STARTMOTORN
// =============================================================================
async function initAtlasRenderer() {
console.log("📍 === ATLAS STARTAR (Global Context) ===");

// 1. Injicera login-modal i DOM
document.body.insertAdjacentHTML('beforeend', loginModalHTML);

// 1b. Koppla stäng-logik för login-modal (close-knapp + click-outside)
const _loginModal = document.getElementById('login-modal');
if (_loginModal) {
// Click-outside
_loginModal.addEventListener('click', (e) => {
if (e.target === _loginModal) _loginModal.style.display = 'none';
});

// Close-button
const closeBtn = _loginModal.querySelector('.modal-close');
if (closeBtn) closeBtn.addEventListener('click', () => { _loginModal.style.display = 'none'; });
}

// 2. Koppla kablarna (Fyll DOM-objektet)
// Detta MÅSTE ske här inne för att document.getElementById ska fungera
DOM = {
views: {
chat: document.getElementById('view-chat'),
templates: document.getElementById('view-templates'),
inbox: document.getElementById('view-inbox'),
'my-tickets': document.getElementById('view-my-tickets'),
archive: document.getElementById('view-archive'),
about: document.getElementById('view-about'),
admin: document.getElementById('view-admin')
},
menuItems: document.querySelectorAll('.menu-item'),
chatMessages: document.getElementById('chat-messages'),
messageInput: document.getElementById('my-chat-input'),
chatForm: document.getElementById('chat-form'),
appName: document.getElementById('app-name-display'),
myTicketsList: document.getElementById('my-tickets-list'),
myTicketDetail: document.getElementById('my-ticket-detail'),
myTicketPlaceholder: document.getElementById('my-detail-placeholder'),
myTicketChatForm: document.getElementById('my-ticket-chat-form'),
myTicketChatInput: document.getElementById('my-ticket-chat-input'),      
myTicketChatMessages: document.getElementById('my-chat-scroll-area'), 
templateList: document.getElementById('template-list'),
editorForm: document.getElementById('template-editor-form'),
editorPlaceholder: document.getElementById('editor-placeholder'),
inputs: {
id: document.getElementById('template-id-input'),
title: document.getElementById('template-title-input'),
group: document.getElementById('template-group-input'),
content: document.getElementById('template-content-input')
},
inboxList: document.getElementById('inbox-list'),
inboxDetail: document.getElementById('inbox-detail'),
inboxPlaceholder: document.getElementById('inbox-placeholder'),
archiveList: document.getElementById('archive-list'),
archiveDetail: document.getElementById('archive-detail'),
archivePlaceholder: document.getElementById('archive-placeholder'),
themeStylesheet: document.getElementById('theme-stylesheet')
};

// 3. Rensa och koppla sidomenyn (Väcker knapparna)
if (DOM.menuItems) {
DOM.menuItems.forEach(item => {
const newItem = item.cloneNode(true);
if (item.parentNode) item.parentNode.replaceChild(newItem, item);
newItem.addEventListener('click', () => switchView(newItem.dataset.view));
});
DOM.menuItems = document.querySelectorAll('.menu-item'); 
}

// 4. Autentisering och system-start
checkAuth();
await preloadOffices();
await preloadUsers();
initHeroPlaceholders();

// Socket-start
if (typeof io === 'undefined') {
loadSocketIoScriptWithRetry();
} else {
initializeSocket();
}

// =====================================
// 2. App Info & API Key (SÄKRAD)
// =====================================
if (window.electronAPI) {
const info = await window.electronAPI.getAppInfo();
API_KEY = info.CLIENT_API_KEY;
if (info.SERVER_URL) SERVER_URL = info.SERVER_URL; 

if (DOM.appName) DOM.appName.textContent = info.APP_NAME;
if (DOM.appVersion) DOM.appVersion.textContent = info.ATLAS_VERSION;

const sVer = info.SERVER_VERSION && info.SERVER_VERSION !== 'Väntar...'
? info.SERVER_VERSION
: 'Väntar...';

if (DOM.serverVersion) DOM.serverVersion.textContent = sVer;
}

// =====================================
// 3. Badges
// =====================================
updateInboxBadge();

setInterval(() => {
if (!authToken) return;
updateInboxBadge();
}, 10000);

// =====================================
// 3. Init Quill & Globala lyssnare (SÄKRAD)
// =====================================
if (typeof Quill !== 'undefined' && document.getElementById('quill-editor')) {
quill = new Quill('#quill-editor', {
theme: 'snow',
placeholder: 'Skriv mallens innehåll här...'
});

quill.on('text-change', (delta, oldDelta, source) => {
if (isLoadingTemplate) return;
if (source === 'user') {
const saveBtn = DOM.editorForm?.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = false;
}
});
}

// Säkra upp start-loopen med filter(Boolean)
[DOM.inputs.title, DOM.inputs.group].filter(Boolean).forEach(input => {
input.addEventListener('input', () => {
if (isLoadingTemplate) return;
const saveBtn = DOM.editorForm?.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = false;
});
});

// =====================================
// 4. Init State
// =====================================
initChat();
await loadTemplates();

// =====================================
// 5. Tema (SÄKRAD)
// =====================================
// Applicera alltid sparad tema — DOM.themeSelect existerar EJ än (Om-vyn ej rendererad)
// changeTheme() använder DOM.themeStylesheet (<link id="theme-stylesheet">) som alltid finns i HTML
const savedThemeOnLoad = localStorage.getItem('atlas-theme') || 'standard-theme';
changeTheme(savedThemeOnLoad);
// Synkronisera dropdownen om den redan är i DOM (annars sker det i renderAboutGrid)
if (DOM.themeSelect) DOM.themeSelect.value = savedThemeOnLoad;

// =====================================
// 6. EVENT LISTENERS (RENSAD)
// =====================================

// (Dubbletten för Meny borttagen här då den ligger i toppen nu)

// Skicka meddelande (SÄKRAD)
if (DOM.chatForm) {
DOM.chatForm.addEventListener('submit', (e) => {
e.preventDefault();
handleUserMessage(DOM.messageInput?.value || '');
});
}

// ==================================================
// 🖱️ SMART BAKGRUNDSKLICK (SÄKRAD)
// ==================================================
document.querySelectorAll('.template-list-container').forEach(container => {
container.addEventListener('click', (e) => {
const isCard = e.target.closest('.team-ticket-card') ||
e.target.closest('.template-item') ||
e.target.closest('.msg-row');

if (!isCard) {
const activeViewId = Object.keys(DOM.views).find(key =>
DOM.views[key] && DOM.views[key].style.display === 'flex'
);

if (activeViewId) {
resetToPlaceholder(activeViewId);
}
}
});
});

// Admin-sidebar: klick exakt på bakgrunden (ej på något kort/element) → återställ till placeholder
const adminMainList = document.getElementById('admin-main-list');
if (adminMainList) {
adminMainList.addEventListener('click', (e) => {
// Trigga bara om klicket landade direkt på container-elementet — aldrig på barn
if (e.target === adminMainList) {
const placeholder = document.getElementById('admin-placeholder');
const detailContent = document.getElementById('admin-detail-content');
if (placeholder) placeholder.style.display = 'flex';
if (detailContent) detailContent.style.display = 'none';
}
});
}

// ==================================================
// MINI-CHAT (SÄKRAD)
// ==================================================
if (DOM.myTicketChatForm) {
DOM.myTicketChatForm.addEventListener('submit', (e) => {
e.preventDefault();

const message = DOM.myTicketChatInput?.value.trim();
if (!message) return;

const detail = document.getElementById('my-ticket-detail');
const conversationId = detail?.getAttribute('data-current-id');

if (!conversationId) {
console.warn('⚠️ Ingen aktiv conversationId i mini-chat');
return;
}

if (window.socketAPI) {
window.socketAPI.emit('team:agent_reply', {
conversationId,
message
});
}

if (DOM.myTicketChatInput) DOM.myTicketChatInput.value = '';
});
}

// ==================================================
// LADDNING AV FUNKTIONER (DOM CONTENT LOADED)
// ==================================================
// 1. Sök mallar (SÄKRAD)
const tSearch = document.getElementById('template-search-input'); 
if (tSearch) {
tSearch.addEventListener('input', (e) => {
const term = e.target.value.toLowerCase();
if (!State.templates) return;
const filtered = State.templates.filter(t =>
t.title.toLowerCase().includes(term) ||
(t.group_name && t.group_name.toLowerCase().includes(term))
);
renderTemplates(filtered);
if (term.length > 0) {
document.querySelectorAll('.template-group-content').forEach(el => el.classList.add('expanded'));
}
});
}

// 2. Byt tema (SÄKRAD)
const themeDropdown = document.getElementById('theme-select');
const targetEl = themeDropdown || DOM.themeSelect; 
if (targetEl) {
const savedTheme = localStorage.getItem('atlas-theme');
if (savedTheme) targetEl.value = savedTheme;
const newDropdown = targetEl.cloneNode(true);
targetEl.parentNode.replaceChild(newDropdown, targetEl);
newDropdown.addEventListener('change', (e) => {
console.log("🎨 Manuellt byte av tema:", e.target.value);
changeTheme(e.target.value);
});
DOM.themeSelect = newDropdown;
}

// 3. Ny chatt (Header-knappen)
const headerNewChat = document.getElementById('new-chat-btn-header');
if (headerNewChat) {
const newBtn = headerNewChat.cloneNode(true);
headerNewChat.parentNode.replaceChild(newBtn, headerNewChat);
newBtn.addEventListener('click', async () => {
if (newBtn.disabled) return;
newBtn.disabled = true;
if (State.currentSession && State.currentSession.messages.length > 0) {
await saveLocalQA(State.currentSession, true);
}
initChat(true);
showToast('✅ Ny chatt påbörjad!');
if (DOM.views.archive && DOM.views.archive.style.display === 'flex') {
renderArchive();
}
setTimeout(() => { newBtn.disabled = false; }, 500);
});
}

// 4. "Skapa ny mall" knappen (HELT SÄKRAD)
const newTemplateBtn = document.getElementById('new-template-btn');
if (newTemplateBtn) {
newTemplateBtn.addEventListener('click', () => {
if (DOM.editorPlaceholder) DOM.editorPlaceholder.style.display = 'none';
if (DOM.editorForm) DOM.editorForm.style.display = 'flex';

if (DOM.inputs.id) DOM.inputs.id.value = '';
if (DOM.inputs.title) DOM.inputs.title.value = '';
if (DOM.inputs.group) DOM.inputs.group.value = '';

if (quill && quill.root) quill.root.innerHTML = '';

const delBtn = document.getElementById('delete-template-btn');
if (delBtn) delBtn.style.display = 'none';

if (DOM.editorForm) {
const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = true;
}
});
}

// 5. Spara mall (HELT SÄKRAD)
if (DOM.editorForm) {
DOM.editorForm.addEventListener('submit', async (e) => {
e.preventDefault();
const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = true;

const newTemplate = {
id: DOM.inputs.id?.value ? parseInt(DOM.inputs.id.value) : Date.now(),
title: DOM.inputs.title?.value || 'Namnlös mall',
group_name: DOM.inputs.group?.value || 'Övrigt',
content: quill ? quill.root.innerHTML : ''
};

const existingIdx = State.templates.findIndex(t => t.id === newTemplate.id);
if (existingIdx > -1) State.templates[existingIdx] = newTemplate;
else State.templates.push(newTemplate);

try {
if (isElectron) {
const result = await window.electronAPI.saveTemplates([newTemplate]);
if (result?.success === false) throw new Error(result.error || "Databasfel");
} else {
const res = await fetch(`${SERVER_URL}/api/templates/save`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify(newTemplate)
});
if (!res.ok) throw new Error("Serverfel");
}
await loadTemplates();
if (saveBtn) setTimeout(() => { saveBtn.disabled = false; }, 1500);
if (quill) quill.focus();
} catch (err) {
console.error("Fel vid sparning:", err);
alert("Kunde inte spara mallen: " + err.message);
if (saveBtn) saveBtn.disabled = false;
}
});
}


// 🗑️ RADERA MALL (SÄKRAD VERSION)
const delBtn = document.getElementById('delete-template-btn');
if (delBtn) {
delBtn.addEventListener('click', async () => {
const idInput = document.getElementById('template-id-input'); 
// Använd optional chaining för säkerhet
const id = idInput ? idInput.value : (DOM.inputs?.id ? DOM.inputs.id.value : null);

if (!id) return;

if (await atlasConfirm('Radera mall', 'Vill du ta bort denna mall permanent?')) {
try {
if (window.electronAPI) {
await window.electronAPI.deleteTemplate(id);
} else {
const res = await fetch(`${SERVER_URL}/api/templates/delete/${id}`, {
method: 'DELETE',
headers: fetchHeaders
});
if (!res.ok) throw new Error("Kunde inte radera mallen via webben");
}

// Kontrollera att elementen finns innan vi rör dem
const editorForm = document.getElementById('template-editor-form');
if (editorForm) {
editorForm.reset();
editorForm.style.display = 'none';
}

if (typeof quill !== 'undefined' && quill.setContents) quill.setContents([]); 
if (idInput) idInput.value = '';

const placeholder = document.getElementById('editor-placeholder');
if (placeholder) placeholder.style.display = 'flex';

if (typeof loadTemplates === 'function') {
await loadTemplates(); 
}
console.log("✅ Mall raderad och lista uppdaterad.");

} catch (err) {
console.error("Fel vid radering:", err);
alert("Tekniskt fel: " + err.message);
}
}
});
}

// =============================================================================
// 🎹 TANGENTBORDSGENVÄGAR (STEG 2)
// =============================================================================
document.addEventListener('keydown', (e) => {
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const cmdKey = isMac ? e.metaKey : e.ctrlKey;

// 1. NY CHATT: Ctrl + P (Använder det nya ikon-ID:t)
if (cmdKey && !e.altKey && e.key.toLowerCase() === 'p') {
e.preventDefault();
const newChatBtn = document.getElementById('new-chat-btn-header');
if (newChatBtn) newChatBtn.click();
}

// 2. FÖLJDFRÅGA: Ctrl + Alt + P
if (cmdKey && e.altKey && e.key.toLowerCase() === 'p') {
e.preventDefault();
const input = document.getElementById('my-chat-input');
if (input) input.focus();
}

// 3. BYT TEMA: Ctrl + Alt + T
// Använder lokal tema-lista istället för DOM-elementet (som bara finns efter Om-vyn renderats)
if (cmdKey && e.altKey && e.key.toLowerCase() === 't') {
e.preventDefault();
const THEME_CYCLE = [
'standard-theme',
'onyx-ultradark',
'carbon-theme',
'apple-dark',
'apple-road',
'atlas-nebula',
'sunset-horizon',
'atlas-navigator'
];

const currentTheme = localStorage.getItem('atlas-theme') || 'atlas-navigator';
const currentIdx   = THEME_CYCLE.indexOf(currentTheme);
const nextTheme    = THEME_CYCLE[(currentIdx + 1) % THEME_CYCLE.length];
changeTheme(nextTheme);
// Synkronisera dropdownen om Om-vyn råkar vara öppen
const select = document.getElementById('theme-select');
if (select) select.value = nextTheme;
showToast(`🎨 Tema: ${nextTheme.replace(/-/g, ' ')}`);
}

// 4. SPARA MALL: Ctrl + S (Använder det nya ikon-ID:t)
if (cmdKey && e.key.toLowerCase() === 's') {
const templateView = document.getElementById('view-templates');
if (templateView && templateView.style.display !== 'none') {
e.preventDefault();
const saveBtn = document.getElementById('save-template-btn');
if (saveBtn && !saveBtn.disabled) saveBtn.click();
}
}
});

// =============================================================================
// 📋 GLOBALA SYSTEM-GENVÄGAR (ELECTRON IPC)
// =============================================================================
if (window.electronAPI) {
window.electronAPI.onProcessClipboard((text, shouldClear) => {
console.log("📋 Klistrar in från globalt kommando...");
if (shouldClear && typeof initChat === 'function') initChat();
switchView('chat');
handleUserMessage(text);
});
}

// =============================================================================
// 🔐 AUTH INITIALIZATION & LOGIN (INUTI DOMContentLoaded)
// =============================================================================
const loginForm = document.getElementById('login-form');
if (loginForm) {
loginForm.addEventListener('submit', async (e) => {
e.preventDefault();
const user = document.getElementById('login-user').value;
const pass = document.getElementById('login-pass').value;
const errElem = document.getElementById('login-error');
const btn = loginForm.querySelector('button');

btn.disabled = true;
const originalText = btn.innerText;
btn.innerText = "Loggar in...";
errElem.textContent = "";

try {
const res = await fetch(`${SERVER_URL}/api/auth/login`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ username: user, password: pass })
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || 'Inloggning misslyckades');

// ✅ LAGRA GLOBALT FÖRE RELOAD
localStorage.setItem('atlas_token', data.token);
localStorage.setItem('atlas_user', JSON.stringify(data.user));

// 🔥 AGGRESSIV MODAL-STÄNGNING + INTERFACE RESET
const loginModal = document.getElementById('login-modal');
if (loginModal) {
loginModal.style.display = 'none !important';
loginModal.removeAttribute('style');
loginModal.setAttribute('style', 'display: none !important;');
}

// Göm formuläret för att försäkra visuell feedback
const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.style.opacity = '0.5';

// Visa loading state
const btn = document.getElementById('login-btn');
const originalText = btn?.innerText || 'Loggar in...';
if (btn) {
btn.disabled = true;
btn.innerText = '✅ Inloggad - Laddar...';
}

// Refresh efter kort fördröjning för att säkra DOM-uppdatering
setTimeout(() => {
console.log('🔐 Login framgångsrikt - Laddar om sidan...');
window.location.href = window.location.href;
}, 200);

} catch (err) {
errElem.textContent = err.message;
btn.disabled = false;
btn.innerText = originalText;
}
});
}

// =============================================================================
// 7. KOPPLA LOGOUT, LOGIN, AUTO-FILTER & LJUD (SIDOMENYN & GARAGET)
// =============================================================================
// 0. 🔥 KOPPLA LJUDREGLAGE (INSTÄLLNINGAR)
const soundToggle = document.getElementById('sound-toggle');
const savedSoundSetting = localStorage.getItem('atlas-sound-enabled');
State.soundEnabled = savedSoundSetting !== 'false'; 

if (soundToggle) {
soundToggle.checked = State.soundEnabled;
soundToggle.addEventListener('change', (e) => {
State.soundEnabled = e.target.checked;
localStorage.setItem('atlas-sound-enabled', e.target.checked);
if (State.soundEnabled) playNotificationSound();
});
}

// 1. Logga ut
const sidebarLogoutBtn = document.getElementById('logout-btn');
if (sidebarLogoutBtn) {
sidebarLogoutBtn.addEventListener('click', async (e) => {
e.preventDefault();
e.stopPropagation();

if (await atlasConfirm("Logga ut", "Vill du verkligen logga ut från Atlas?")) {
handleLogout();
}
});
}

// 2. Logga in
const sidebarLoginBtn = document.getElementById('login-btn-sidebar');
if (sidebarLoginBtn) {
sidebarLoginBtn.addEventListener('click', () => {
const modal = document.getElementById('login-modal');
if (modal) modal.style.display = 'flex';
});
}

// 3. ⚡ AUTOMATISK FILTRERING & SÖK (GARAGET)

// Lista på alla fält som ska trigga automatisk uppdatering vid ändring
const filterIds = [
'filter-type', 
'filter-agent', 
'filter-vehicle', 
'filter-city',
'filter-office', 
'filter-date-start', 
'filter-date-end'
];

filterIds.forEach(id => {
const el = document.getElementById(id);
if (el) {
el.addEventListener('change', () => {
console.log(`⚡ Filter auto-uppdatering: ${id}`);
renderArchive(true); // 'true' betyder filtrera lokalt för snabbhet
});
}
});

// Sökfältet (Uppdaterar medan du skriver)
const filterSearchInput = document.getElementById('filter-search');
if (filterSearchInput) {
filterSearchInput.addEventListener('input', () => {
renderArchive(true); 
});
}

// 4. RENSA-FUNKTION (Kopplad till den nya kryss-ikonen)
const resetFilterBtn = document.getElementById('reset-filters-btn');
if (resetFilterBtn) {
resetFilterBtn.addEventListener('click', () => {
console.log("🧹 Rensar alla filter...");

// Återställ dropdowns till "all"
['filter-type', 'filter-agent', 'filter-vehicle', 'filter-city'].forEach(id => {
const el = document.getElementById(id);
if (el) el.value = 'all';
});

// Töm datumfält
['filter-date-start', 'filter-date-end'].forEach(id => {
const el = document.getElementById(id);
if (el) el.value = '';
});

// Töm sökfältet
if (filterSearchInput) filterSearchInput.value = '';

// Uppdatera listan direkt
renderArchive(true);
});
}

// Lägg till toast-animationer om de inte finns
if (!document.getElementById('toast-styles')) {
const style = document.createElement('style');
style.id = 'toast-styles';
style.textContent = `
@keyframes slideIn {
from { transform: translateX(400px); opacity: 0; }
to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
from { transform: translateX(0); opacity: 1; }
to { transform: translateX(400px); opacity: 0; }
}
`;
document.head.appendChild(style);
}

// ==========================================================
// 📂 TOGGLE-LOGIK: ÖPPNA/STÄNG ALLA MALLGRUPPER (FIXAD)
// ==========================================================
document.addEventListener('click', (event) => {
const btn = event.target.closest('#collapse-all-btn');
if (!btn) return;

// Hitta alla grupper och pilar
const allContents = document.querySelectorAll('.template-group-content');
const allArrows = document.querySelectorAll('.group-arrow');
const iconSvg = btn.querySelector('svg');

// Kolla om vi ska öppna eller stänga (baserat på om någon är öppen)
// Logik: Om någon är öppen -> Stäng allt. Om alla är stängda -> Öppna allt.
const anyExpanded = Array.from(allContents).some(c => c.classList.contains('expanded'));

if (anyExpanded) {
// --- STÄNG ALLA ---
console.log("📂 Stänger alla grupper...");
allContents.forEach(c => {
c.classList.remove('expanded');
c.style.maxHeight = null;
});
allArrows.forEach(a => a.classList.remove('expanded'));

// Byt till PIL NER (Redo att öppna igen)
if(iconSvg) iconSvg.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';

} else {
// --- ÖPPNA ALLA ---
console.log("📂 Öppnar alla grupper...");
allContents.forEach(c => {
c.classList.add('expanded');
c.style.maxHeight = "2000px"; 
});
allArrows.forEach(a => a.classList.add('expanded'));

// Byt till PIL UPP (Redo att stänga)
if(iconSvg) iconSvg.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
}
});

// Stäng rutan automatiskt om man klickar utanför den
document.addEventListener('mousedown', (e) => {
const overlay = document.getElementById('atlas-help-overlay');
const trigger = document.querySelector('.info-icon-trigger');
if (overlay && overlay.style.display === 'block') {
if (!overlay.contains(e.target) && e.target !== trigger) {
overlay.style.display = 'none';
}
}
});

// Kör kollen 2 sekunder efter start
setTimeout(masterSystemAudit, 2000);
// Kör Audit 1 sekund efter start så att allt hunnit ritas ut
setTimeout(auditDOM, 1000);
// Försök köra synlighet direkt (ifall sessionen redan är laddad)
updateInboxVisibility();
console.log("🚀 ATLAS READY OCH SYSTEMET ÄR LIVE.");
}

document.addEventListener('DOMContentLoaded', initAtlasRenderer);

// ==================================================
// 🌐 GLOBAL MODAL-STÄNGNING (click outside + ESC)
// Stänger alla .custom-modal-overlay vid klick på bakgrund eller ESC
// ==================================================
document.addEventListener('click', (e) => {
if (e.target.classList.contains('custom-modal-overlay')) {
e.target.style.display = 'none';
}
});
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape') {
// Stäng inte modalen om fokus är inne i ett textfält
const active = document.activeElement;
if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
document.querySelectorAll('.custom-modal-overlay').forEach(m => m.style.display = 'none');
}
});

// ==================================================
// 🔍 INKORG-SÖKNING (Server-side, debounce 300ms)
// ==================================================
(function() {
let _searchTimer = null;
let _isSearchMode = false;

document.addEventListener('input', (e) => {
if (e.target.id !== 'inbox-search') return;
const term = e.target.value.trim();

clearTimeout(_searchTimer);

if (!term) {
if (_isSearchMode) {
_isSearchMode = false;
renderInbox();
}
return;
}

_searchTimer = setTimeout(async () => {
try {
const res = await fetch(`${SERVER_URL}/team/inbox/search?q=${encodeURIComponent(term)}`, {
headers: fetchHeaders
});
if (!res.ok) throw new Error('Sökfel');
const data = await res.json();
_isSearchMode = true;
renderInboxFromTickets(data.tickets || [], term);
} catch (err) {
console.error('❌ [Inbox Search]', err);
}
}, 300);
});
})();

// showAdminInfoModal, showNewMailComposer, loadAgents, selectInternalAgent → flyttade till modules/modals.js