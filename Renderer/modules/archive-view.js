// ============================================
// modules/archive-view.js
// VAD DEN GÖR: Garaget/Arkiv-vyn — filtrering,
//              sökning och visning av stängda ärenden
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   State, DOM, currentUser, SERVER_URL, fetchHeaders  — renderer.js globals
//   getAgentStyles, getCityFromOwner, resolveLabel,
//   formatName, stripHtml, showToast                   — styling-utils.js
//   UI_ICONS                                            — ui-constants.js
//   resolveTicketTitle                                  — chat-engine.js
//   openNotesModal                                      — notes-system.js
//   renderDetailHeader, formatAtlasMessage, getVehicleIcon,
//   refreshNotesGlow, atlasConfirm, switchView          — renderer.js
// ============================================

// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║     KRITISK VARNING — GARAGET FÄRG- OCH ROUTING-LOGIK       ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 1 — isInternal/isInternalItem (ÄNDRA INTE):          ║
// ⚠️  ║   Garaget har ETT EXTRA villkor jämfört med Inkorg/Mina:    ║
// ⚠️  ║     routing_tag === 'INTERNAL'                               ║
// ⚠️  ║     || session_type === 'internal'                           ║
// ⚠️  ║     || item._isLocal   ← lokala Electron IPC-poster         ║
// ⚠️  ║   _isLocal = true sätts på poster från loadQAHistory() som  ║
// ⚠️  ║   laddas via Electron-IPC. Dessa är alltid "privata" och    ║
// ⚠️  ║   ska visas med gult precis som interna ärenden.            ║
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 2 — Intern färg är ALLTID hårdkodat gul (ÄNDRA INTE):║
// ⚠️  ║   isInternal → { main: '#f1c40f', ... } (kort)             ║
// ⚠️  ║   isInternalItem → internalYellow { main: '#f1c40f', ... }  ║
// ⚠️  ║   Gult är avsiktlig visuell signal — ALDRIG kontorsfärgen.  ║
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 3 — Prioritet för icke-interna kort (ÄNDRA INTE):    ║
// ⚠️  ║   getAgentStyles(item.routing_tag || item.owner             ║
// ⚠️  ║               || (item._isLocal ? currentUser.username      ║
// ⚠️  ║                               : 'unclaimed'))               ║
// ⚠️  ║   routing_tag → owner → currentUser (lokal) → 'unclaimed'  ║
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 4 — Detaljvyn (onclick-handler) (ÄNDRA INTE):        ║
// ⚠️  ║   themeStyles = isInternalItem ? internalYellow             ║
// ⚠️  ║               : getAgentStyles(item.routing_tag || item.owner║
// ⚠️  ║                             || 'unclaimed')                 ║
// ⚠️  ║   themeStyles = det tema som styr HELA detaljvyn (header,   ║
// ⚠️  ║   bakgrund, kund-avatar-färg).                              ║
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 5 — Interna detaljvy-avatarer (ÄNDRA INTE):          ║
// ⚠️  ║   senderStyles = getAgentStyles(senderName) (avsändaren)    ║
// ⚠️  ║   ownerStyles  = getAgentStyles(ownerName)  (mottagaren)    ║
// ⚠️  ║   Dessa är AVSIKTLIGT individuella per person — interna     ║
// ⚠️  ║   chattar ska visa avsändarens och mottagarens egna färger, ║
// ⚠️  ║   INTE det gula tema-objektet. Kontrasten används.          ║
// ⚠️  ║                                                              ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝

/* ===============================================================
RENDER ARCHIVE (GARAGET) — Sökfunktion och filtrering
=============================================================== */
async function renderArchive(applyFilters = false) {
// 🛡️ SÄKERHETSSPÄRR
if (!DOM.archiveList) return;

// Vi använder cachen istället för getElementById
const container = DOM.archiveList;

// 1. Hämta data (om vi inte bara filtrerar befintlig data)
if (!applyFilters) {
State.archiveItems = [];

try {
const res = await fetch(`${SERVER_URL}/api/archive`, { headers: fetchHeaders });
if (res.ok) {
const data = await res.json();
if (data.archive) State.archiveItems.push(...data.archive);
}
} catch (err) { console.error("Server-arkiv fel:", err); }

if (window.electronAPI) {
try {
const localAll = await window.electronAPI.loadQAHistory();
const localArchived = localAll.filter(item => item.is_archived === 1);

localArchived.forEach(x => {
// Kolla om ärendet redan laddats från servern (via conversation_id)
const exists = State.archiveItems.some(serverItem =>
serverItem.conversation_id === x.conversation_id
);

// Lägg bara till om det INTE finns
if (!exists) {
x._isLocal = true;
State.archiveItems.push(x);
}
});

} catch (err) { console.error("Lokalt arkiv fel:", err); }
}
populateArchiveDropdowns();
}

// 2. Hämta filtervärden
const typeVal = document.getElementById('filter-type')?.value || 'all';
const agentVal = document.getElementById('filter-agent')?.value || 'all';
const vehicleVal = document.getElementById('filter-vehicle')?.value || 'all';
const cityVal = document.getElementById('filter-city')?.value || 'all';
const officeVal = document.getElementById('filter-office')?.value || 'all';
const dateStart = document.getElementById('filter-date-start')?.value;
const dateEnd = document.getElementById('filter-date-end')?.value;
const searchText = document.getElementById('filter-search')?.value.toLowerCase().trim() || '';

const showAI = document.getElementById('archive-show-ai')?.checked || false;

let filtered = State.archiveItems.filter(item => {

// --- 🔒 INTERN SEKRETESS: Sista försvarslinje på klienten.
// Interna ärenden (session_type='internal') ska aldrig visas för någon
// som inte är owner eller sender — även om servern av misstag skickar dem.
if (item.session_type === 'internal') {
const myName = currentUser?.username?.toLowerCase();
const isOwner = item.owner && item.owner.toLowerCase() === myName;
const isSender = item.sender && item.sender.toLowerCase() === myName;
if (!isOwner && !isSender) return false;
}

// H. AI-FILTER — döljer rena AI-svar om checkboxen är avbockad
// Om ärendet är ett rent AI-svar (human_mode === 0) och checkboxen INTE är ikryssad -> Dölj det.
if (item.human_mode === 0 && !showAI) return false;

// A. TYP (Mail/Chatt)
const itemType = item.session_type === 'message' ? 'mail' : 'chat';
if (typeVal !== 'all' && itemType !== typeVal) return false;

// B. AGENT (Ägare)
if (agentVal !== 'all' && item.owner !== agentVal) return false;

// C. FORDON
const itemVehicle = item.vehicle || "Okänd";
if (vehicleVal !== 'all' && itemVehicle !== vehicleVal) return false;

// D. STAD (Kolla både item.city och ägarens stad)
if (cityVal !== 'all') {
const itemCity = item.city || (typeof getCityFromOwner === 'function' ? getCityFromOwner(item.owner) : '');
if (itemCity !== cityVal) return false;
}

// E. KONTOR (Ny hierarki)
if (officeVal !== 'all') {
const itemOffice = item.office || item.routing_tag || '';
if (itemOffice !== officeVal) return false;
}

// F. DATUM
if (dateStart || dateEnd) {
const itemDate = new Date(item.timestamp).setHours(0, 0, 0, 0);
if (dateStart && itemDate < new Date(dateStart).setHours(0, 0, 0, 0)) return false;
if (dateEnd && itemDate > new Date(dateEnd).setHours(0, 0, 0, 0)) return false;
}

// G. SUPER-SEARCH (Inkluderar Notes, Kontaktinfo och ID:n)
if (searchText) {
const searchableString = [
item.contact_name,
item.contact_email,
item.contact_phone,
item.subject,
item.question,
item.conversation_id,
item.id,
item.city,
item.office,
item.vehicle,
item.notes, // 🔥 Nu kan du söka i interna anteckningar!
item.owner
].filter(Boolean).join(' ').toLowerCase();

if (!searchableString.includes(searchText)) return false;
}
return true;
});

// Sortera efter senaste händelse
filtered.sort((a, b) => b.timestamp - a.timestamp);

// 🧹 STÄDPATRULL (Rensar detaljvyn om inga träffar finns)
const detail = document.getElementById('archive-detail');
const placeholder = document.getElementById('archive-placeholder');
if (filtered.length === 0 && detail && placeholder) {
detail.style.display = 'none';
placeholder.style.display = 'flex';
}

container.innerHTML = '';
if (filtered.length === 0) {
container.innerHTML = '<div class="template-item-empty">Inga ärenden matchade sökningen.</div>';
return;
}

// 3. RENDERA LISTAN
filtered.forEach(item => {
const el = document.createElement('div');

// ⚠️ LOCK — isInternal: Tre villkor — routing_tag=INTERNAL, session_type=internal, OCH _isLocal.
// _isLocal=true sätts på Electron IPC-poster. Alla tre visas som gula privata ärenden. Se regel 1 ovan.
const isInternal = (item.routing_tag === 'INTERNAL' || item.session_type === 'internal' || item._isLocal);
const internalClass = isInternal ? 'internal-ticket' : '';

// ⚠️ LOCK — styles (kort): Gult { main:'#f1c40f' } för interna. För övriga: routing_tag → owner → fallback.
// ❌ Flytta INTE _isLocal-logiken till getAgentStyles() — den hör hemma HÄR, i den lokala kontexten.
const styles = isInternal ? { main: '#f1c40f' } : getAgentStyles(item.routing_tag || item.owner || (item._isLocal ? currentUser.username : 'unclaimed'));

const isMail = item.session_type === 'message';
const typeIcon = isMail ? `${UI_ICONS.MAIL}` : `${UI_ICONS.CHAT}`;

let displayTitle = resolveTicketTitle(item) || "Ärende utan titel";
if (isInternal && item.sender) {
displayTitle = (typeof formatName === 'function') ? formatName(item.sender) : item.sender;
}

// Hämta preview
let rawPreview = item.question || item.last_message || item.subject;
if (!rawPreview && item.context_data) {
try {
const ctx = typeof item.context_data === 'string' ? JSON.parse(item.context_data) : item.context_data;
if (ctx.messages && ctx.messages.length > 0) {
rawPreview = ctx.messages[0].content || ctx.messages[0].text;
}
} catch(e) {}
}

const vIcon = getVehicleIcon(item.vehicle);
const fullDateStr = new Date(item.timestamp).toLocaleString('sv-SE', {
year: 'numeric', month: 'numeric', day: 'numeric',
hour: '2-digit', minute: '2-digit'
});

let previewDisplay = (item._isLocal || isInternal)
? `<span style="opacity: 0.6; font-style: italic;">🔒 Privat internt meddelande</span>`
: stripHtml(rawPreview || '...');

const isAI = item.human_mode === 0; // 0 = AI-besvarat

// Sätt klasser för layout
el.className = `team-ticket-card ${internalClass} archive-card ${isAI ? 'is-ai-chat' : 'is-human-chat'}`;
el.style.setProperty('border-left', `4px solid ${styles.main}`, 'important');
el.style.setProperty('--agent-color', styles.main); // För hover/glöd

el.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title" style="color: ${isInternal ? styles.main : 'var(--text-primary)'} !important;">
<span style="opacity:0.7; margin-right:6px; display:flex; align-items:center;">${typeIcon}</span>
<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right" style="color: ${styles.main} !important;">
${vIcon ? `<span style="display:flex; align-items:center; opacity:0.9;" title="${item.vehicle}">${vIcon}</span>` : ''}
<button class="notes-trigger-btn" data-id="${item.conversation_id || item.id}" title="Interna anteckningar" style="color:inherit;" onclick="event.stopPropagation(); openNotesModal('${item.conversation_id || item.id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>

<div class="ticket-preview">${previewDisplay}</div>

<div class="ticket-footer-bar">
<div class="ticket-time">${fullDateStr}</div>
<div class="ticket-tag" style="background: ${isInternal ? styles.main + '22' : 'rgba(255,255,255,0.05)'}; color: ${styles.main}; border: 1px solid ${styles.main}44;">
${(item.routing_tag || item.office) ? resolveLabel(item.routing_tag || item.office) : (item.city ? item.city.toUpperCase() : (item.session_type === 'customer' ? 'CHATT' : (item.owner ? item.owner.toUpperCase() : '—')))}
</div>
</div>
`;

// 6. Klick-händelse (Öppnar detaljvy)
el.onclick = () => {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
el.classList.add('active-ticket');

const placeholder = document.getElementById('archive-placeholder');
const detail = document.getElementById('archive-detail');

if (placeholder) placeholder.style.display = 'none';
if (detail) {
detail.style.display = 'flex';
detail.innerHTML = '';

// ⚠️ LOCK — isInternalItem (detaljvy): Samma tre villkor som i kortrendering ovan. ÄNDRA INTE.
const isInternalItem = (item.routing_tag === 'INTERNAL' || item.session_type === 'internal' || item._isLocal);
// ⚠️ LOCK — internalYellow: Hårdkodat gult tema för interna/lokala ärenden. ÄNDRA INTE hex-värden.
const internalYellow = {
main: '#f1c40f',
bg: 'transparent',
border: 'rgba(241, 196, 15, 0.3)',
bubbleBg: 'rgba(241, 196, 15, 0.15)'
};

// ⚠️ LOCK — themeStyles: Gult för interna, getAgentStyles(routing_tag||owner||'unclaimed') för övriga.
// themeStyles styr header, bakgrund och kund-avatarfärg i hela detaljvyn. Se regel 4 ovan.
const themeStyles = isInternalItem ? internalYellow : getAgentStyles(item.routing_tag || item.owner || 'unclaimed');

detail.className = 'detail-container';
detail.style.borderTop = 'none';
detail.style.borderBottom = 'none';
detail.style.background = 'none';
detail.style.boxShadow = 'none';

let historyHtml = '<div class="inbox-chat-history" style="padding:20px;">';
let messages = [];
try {
if (Array.isArray(item.answer)) messages = item.answer;
else if (typeof item.answer === 'string' && (item.answer.startsWith('[') || item.answer.startsWith('{'))) {
messages = JSON.parse(item.answer);
} else { messages = [{ role: 'user', content: item.answer || "..." }]; }
} catch(e) { messages = []; }

// ⚠️ LOCK — senderStyles/ownerStyles (interna detaljvy-avatarer):
// Dessa är AVSIKTLIGT individuella per person — avsändarens och mottagarens egna agentfärger.
// ❌ BLANDA INTE ihop med themeStyles (det gula temat). Dessa används BARA för bubbelkanter/avatarer.
// ❌ ÄNDRA INTE till themeStyles här — kontrasten mellan personerna är avsiktlig. Se regel 5 ovan.
let senderStyles, ownerStyles, senderInitial, ownerInitial;
if (isInternalItem) {
const senderName = item.sender || '';
const ownerName  = item.owner  || '';
senderStyles  = getAgentStyles(senderName);
ownerStyles   = getAgentStyles(ownerName);
const sDisp   = (typeof formatName === 'function' ? formatName(senderName) : senderName) || '?';
const oDisp   = (typeof formatName === 'function' ? formatName(ownerName)  : ownerName)  || '?';
senderInitial = sDisp.charAt(0).toUpperCase();
ownerInitial  = oDisp.charAt(0).toUpperCase();
}

messages.forEach(m => {
const isUser = m.role === 'user';
const clean = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');

if (isInternalItem) {
// Interna ärenden: user-roll = avsändaren (vänster), övriga = mottagaren (höger)
if (isUser) {
historyHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
<div class="msg-avatar" style="background:${senderStyles.main}; color:black; font-weight:800; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; margin-right:12px; flex-shrink:0;">${senderInitial}</div>
<div class="bubble" style="background:${senderStyles.bubbleBg} !important; border:1px solid ${senderStyles.border} !important; color:var(--text-primary) !important; padding:15px; border-radius:12px; line-height:1.5;">
${formatAtlasMessage(clean)}
</div>
</div>`;
} else {
historyHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div class="bubble" style="background:${ownerStyles.bubbleBg} !important; border:1px solid ${ownerStyles.border} !important; color:var(--text-primary) !important; padding:15px; border-radius:12px; line-height:1.5;">
${formatAtlasMessage(clean)}
</div>
<div class="msg-avatar" style="background:${ownerStyles.main}; color:black; font-weight:800; margin-left:12px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${ownerInitial}</div>
</div>`;
}
} else {
// Vanliga ärenden: original-logik
const avatarInitial = isUser ? (item.contact_name ? item.contact_name.charAt(0).toUpperCase() : 'K') : '🤖';
if (isUser) {
historyHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
<div class="msg-avatar" style="background:${themeStyles.main}; color:white; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; margin-right:12px; flex-shrink:0;">${avatarInitial}</div>
<div class="bubble" style="background:${themeStyles.bubbleBg} !important; border:1px solid ${themeStyles.border} !important; color:var(--text-primary) !important; padding:15px; border-radius:12px; line-height:1.5;">
${formatAtlasMessage(clean)}
</div>
</div>`;
} else {
historyHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:15px; border-radius:12px; line-height:1.5;">
${formatAtlasMessage(clean)}
</div>
<div class="msg-avatar" style="background:#3a3a3c; margin-left:12px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0; font-size:18px;">🤖</div>
</div>`;
}
}
});

historyHtml += '</div>';

const restoreBtn = isMail ? `<button class="footer-icon-btn" id="archive-restore-btn" title="Återaktivera">${UI_ICONS.RESTORE}</button>` : '';
const fullView = document.createElement('div');
fullView.className = 'detail-container';

fullView.innerHTML = `
${renderDetailHeader(item, themeStyles)}
<div class="detail-body" style="flex:1; overflow-y:auto;">
${historyHtml}
</div>
<div class="detail-footer-toolbar" style="padding: 15px 20px; background: rgba(0, 0, 0, 0.4); display: flex; justify-content: flex-end; gap: 10px;">
${restoreBtn}
${currentUser?.role === 'admin' ? `<button class="footer-icon-btn danger" id="archive-delete-btn" title="Radera permanent">${UI_ICONS.TRASH}</button>` : ''}
</div>
`;

fullView.style.setProperty('border-top', 'none', 'important');
fullView.style.setProperty('border-bottom', 'none', 'important');
fullView.style.setProperty('box-shadow', 'none', 'important');
fullView.style.setProperty('background', 'none', 'important');

detail.appendChild(fullView);

if (typeof refreshNotesGlow === 'function') refreshNotesGlow(item.conversation_id);

const delBtn = fullView.querySelector('#archive-delete-btn');
if (delBtn) delBtn.onclick = async () => {
if (await atlasConfirm("Radera permanent", "Är du säker?")) {
await fetch(`${SERVER_URL}/api/inbox/delete`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: item.conversation_id }) });
renderArchive(false);
detail.innerHTML = '';
detail.style.display = 'none';
placeholder.style.display = 'flex';
}
};

const resBtn = fullView.querySelector('#archive-restore-btn');
if (resBtn) resBtn.onclick = async () => {
await fetch(`${SERVER_URL}/team/claim`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: item.conversation_id, agentName: currentUser.username }) });
showToast('✅ Ärendet återaktiverat!');
if (typeof switchView === 'function') switchView('my-tickets');
};
}
};

container.appendChild(el);
});
}

// ============================================================================
// POPULERA DROPDOWNS I GARAGET (Använder formatName)
// ============================================================================
function populateArchiveDropdowns() {
const agents = new Set();
const cities = new Set();
const offices = new Set();
const vehicles = new Set();

State.archiveItems.forEach(item => {
if (item.owner) agents.add(item.owner);
if (item.city) cities.add(item.city);
if (item.office || item.routing_tag) offices.add(item.office || item.routing_tag);
if (item.vehicle) vehicles.add(item.vehicle);
});

const fill = (id, data, label) => {
const el = document.getElementById(id);
if (!el) return;
const current = el.value;
el.innerHTML = `<option value="all">Alla ${label}</option>`;
Array.from(data).sort().forEach(val => {
let display = val;
if (id === 'filter-agent') display = formatName(val);
else if (id === 'filter-office') display = resolveLabel(val);
el.innerHTML += `<option value="${val}">${display.toUpperCase()}</option>`;
});
el.value = data.has(current) ? current : 'all';
};

fill('filter-agent', agents, 'agent');
fill('filter-city', cities, 'stad');
fill('filter-office', offices, 'kontor');
fill('filter-vehicle', vehicles, 'fordon');
}