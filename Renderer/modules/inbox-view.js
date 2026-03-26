// ============================================
// modules/inbox-view.js
// VAD DEN GÖR: Inkorgen — rendering, filtrering
//              och detaljvy för inkommande ärenden
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   State, DOM, currentUser, authToken,            — renderer.js globals
//   isBulkMode, selectedTicketIds,                 — renderer.js globals
//   SERVER_URL, fetchHeaders, isElectron            — renderer.js globals
//   getAgentStyles, resolveLabel, showToast,        — styling-utils.js
//   stripHtml
//   resolveTicketTitle                              — chat-engine.js
//   UI_ICONS                                        — ui-constants.js
//   getVehicleIcon, formatAtlasMessage,             — renderer.js
//   renderDetailHeader, refreshNotesGlow,           — renderer.js
//   atlasConfirm, esc, isSupportAgent,              — renderer.js
//   renderMyTickets, showAssignModal                — renderer.js
//   toggleBulkCard, showBulkToolbar, updateBulkCount— bulk-ops.js
//   openNotesModal                                  — notes-system.js
//   window.electronAPI.deleteQA                     — ipc-bridges.js
// ============================================

// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║     KRITISK VARNING — INKORG FÄRG- OCH ROUTING-LOGIK        ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 1 — isInternal-kontrollen (ÄNDRA INTE):              ║
// ⚠️  ║   Interna ärenden identifieras ALLTID med båda villkoren:   ║
// ⚠️  ║     session_type === 'internal' || routing_tag === 'INTERNAL'║
// ⚠️  ║   Båda behövs — gamla poster kan ha routing_tag='INTERNAL'  ║
// ⚠️  ║   utan session_type, och nya kan ha tvärtom.                ║
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 2 — Intern färg är ALLTID hårdkodat gul (ÄNDRA INTE):║
// ⚠️  ║   isInternal → { main: '#f1c40f', bg: transparent, ... }   ║
// ⚠️  ║   Gult är avsiktlig visuell signal — interna ärenden ska   ║
// ⚠️  ║   ALDRIG ta kontorsfärgen, oavsett routing_tag-värde.       ║
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 3 — Prioritetsordning för icke-interna (ÄNDRA INTE): ║
// ⚠️  ║   styles = getAgentStyles(t.routing_tag || t.owner)         ║
// ⚠️  ║   routing_tag = kontorets färg (STARKAST)                   ║
// ⚠️  ║   owner = agentens färg (om inget kontor ännu)              ║
// ⚠️  ║   LÄGG INTE TILL fler fallbacks här — styling-utils.js      ║
// ⚠️  ║   hanterar den interna fallback-kedjan själv.               ║
// ⚠️  ║                                                              ║
// ⚠️  ║  REGEL 4 — Två render-kontexter i denna fil (ÄNDRA INTE):   ║
// ⚠️  ║   a) renderInboxGroup() — grupperade köer (live/mail/claim) ║
// ⚠️  ║      isInternal-check FINNS här (inkorgen kan ha interna)   ║
// ⚠️  ║   b) Claimed-tickets sektion — ej intern, styles direkt     ║
// ⚠️  ║      (claimed ärenden är alltid kundärenden, ej interna)    ║
// ⚠️  ║   c) openInboxDetail() — detaljvy, samma prioritet          ║
// ⚠️  ║      styles = getAgentStyles(ticket.routing_tag||ticket.owner)║
// ⚠️  ║                                                              ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝

// ============================================================================
// INKORG FLIK-STATE
// ============================================================================
// Aktiv flik (chats | mail | claimed) — återställs till 'chats' vid navigering
let currentInboxTab = 'chats';

// Synkar aktiva flik-knappar och panel-titel i headern
function _updateInboxTabBtns() {
['chats', 'mail', 'claimed'].forEach(t => {
const btn = document.getElementById('inbox-tab-btn-' + t);
if (btn) btn.classList.toggle('active', t === currentInboxTab);
});
const titleEl = document.getElementById('inbox-list-header-title');
if (titleEl) {
const titles = { chats: 'Live-Chattar', mail: 'E-post', claimed: 'Plockade ärenden' };
titleEl.textContent = titles[currentInboxTab] || '';
}
}

// Byter aktiv flik — anropas från index.html onclick
window.switchInboxTab = function(tab) {
currentInboxTab = tab;
_updateInboxTabBtns();
// Rensa bulk-läge vid flikbyte
if (typeof isBulkMode !== 'undefined' && isBulkMode && typeof exitBulkMode === 'function') {
exitBulkMode();
}
renderInbox();
};

// ============================================================================
// BADGE-HANTERING + WINDOWS TASKBAR ICON
// ============================================================================
async function updateInboxBadge() {
if (typeof authToken === 'undefined' || !authToken) return;
const inboxBadge = document.getElementById('badge-inbox');
const myBadge = document.getElementById('badge-my-tickets');
try {
// Hämta både inkorg och mina ärenden parallellt
const [inboxRes, myRes] = await Promise.all([
fetch(`${SERVER_URL}/team/inbox`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/team/my-tickets?t=${Date.now()}`, { headers: fetchHeaders })
]);

const inboxData = await inboxRes.json();
const myData = await myRes.json();
const myTickets = myData.tickets || [];

// Inkorg: räkna direkt från de strukturerade listorna (live_chats + mail + claimed)
// live_chats och mail = alltid owner=null (oplockade)
// claimed = plockade av annan agent eller routade till kontor
const liveChatCount = (inboxData.live_chats || []).length;
const mailCount     = (inboxData.mail || []).length;
const claimedCount  = (inboxData.claimed || []).length;

// Mina ärenden: applicera SAMMA klientfilter som renderMyTickets
// (utesluter kontorsärenden som är plockade av en annan agent)
const myCount = (() => {
  if (!window.currentUser?.username) return myTickets.length;
  const myName = window.currentUser.username.toLowerCase();
  const myOfficeTags = (window.currentUser.routing_tag || '')
    .split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  return myTickets.filter(t => {
    if (t.owner && t.owner.toLowerCase() === myName) return true;
    if (t.sender && t.sender.toLowerCase() === myName) return true;
    if (t.routing_tag && myOfficeTags.includes(t.routing_tag.toLowerCase()) && !t.owner) return true;
    return false;
  }).length;
})();

const unpickedCount = liveChatCount + mailCount;
const totalInbox = unpickedCount + claimedCount;
const totalCount = unpickedCount; // Röd badge/taskbar visar endast nya oplockade

// Uppdatera badges
if (inboxBadge) {
inboxBadge.textContent = unpickedCount;
inboxBadge.style.setProperty('display', unpickedCount > 0 ? 'flex' : 'none', 'important');
if (unpickedCount > 0) {
inboxBadge.title = `Nya oplockade: ${unpickedCount} (Inkorg totalt: ${totalInbox}, Plockade/routade: ${claimedCount})`;
} else {
inboxBadge.removeAttribute('title');
}
}
if (myBadge) {
myBadge.textContent = myCount;
myBadge.style.setProperty('display', myCount > 0 ? 'flex' : 'none', 'important');
if (myCount > 0) {
myBadge.title = `Mina aktiva ärenden: ${myCount}`;
} else {
myBadge.removeAttribute('title');
}
}

// Windows aktivitetsfält
if (typeof isElectron !== 'undefined' && isElectron && window.electronAPI?.setTaskbarIcon) {
if (totalCount > 0) {
const badgeDataUrl = drawTaskbarBadge(totalCount);
window.electronAPI.setTaskbarIcon(badgeDataUrl, `${totalCount} ärenden`);
} else {
window.electronAPI.setTaskbarIcon(null, '');
}
}
} catch (err) {
console.warn("Badge-systemet väntar...");
}
}
// Hjälpfunktion: Ritar röd cirkel
function drawTaskbarBadge(number) {
const size = 32; 
const canvas = document.createElement('canvas');
canvas.width = size;
canvas.height = size;
const ctx = canvas.getContext('2d');
ctx.beginPath();
ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
ctx.fillStyle = '#ff4444'; 
ctx.fill();
ctx.fillStyle = 'white';
ctx.font = 'bold 20px "Segoe UI", sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
const text = number > 99 ? '99+' : number.toString();
ctx.fillText(text, size / 2, (size / 2) + 2); 
return canvas.toDataURL();
}

// Gör den globalt tillgänglig för init-scriptet
window.updateInboxBadge = updateInboxBadge;

// ===================================================
// UNIFIED INBOX (RENDER)
// ===================================================
async function renderInbox() {
// 🛡️ SÄKERHETSSPÄRR
if (!DOM.inboxList) return; 

// Vi använder cachen istället för getElementById
const container = DOM.inboxList;

try {
const res = await fetch(`${SERVER_URL}/team/inbox?t=${Date.now()}`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte ladda kön");

const data = await res.json();

// 1. HÄMTA KATEGORIER (Läser de tre listorna direkt från servern)
let unassignedChats = data.live_chats || [];
let unassignedMails = data.mail || [];
let claimedByOthers = data.claimed || [];

// Fallback för agenter (om servern bara skickar 'tickets'-arrayen)
if (!data.live_chats && data.tickets) {
const fallback = data.tickets.filter(t => {
if (t.session_type === 'internal') return false;
if (!t.owner) return true;
if (currentUser && t.owner.toLowerCase() !== currentUser.username.toLowerCase()) return true;
return false;
});
unassignedChats = fallback.filter(t => t.session_type === 'customer' && !t.owner);
unassignedMails = fallback.filter(t => t.session_type === 'message' && !t.owner);
claimedByOthers = fallback.filter(t => t.owner);
}

// Skapa visibleTickets för städpatrullen att checka emot
const visibleTickets = [...unassignedChats, ...unassignedMails, ...claimedByOthers];

// 🧹 STÄDPATRULL - Rensar detaljvyn om ärendet blivit plockat/arkiverat
const detail = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');
const currentId = detail?.getAttribute('data-current-id');

if (detail && placeholder) {
if (!currentId) {
detail.innerHTML = ''; 
detail.style.display = 'none';
placeholder.style.display = 'flex';
} else {
const stillVisible = visibleTickets.find(t => t.conversation_id === currentId);
if (!stillVisible) {
console.log("🧹 Ärendet borta - totalrensar vyn.");
detail.innerHTML = ''; 
detail.style.display = 'none';
detail.removeAttribute('data-current-id');
placeholder.style.display = 'flex';
}
}
}

// 2. SORTERING (Nyast överst i varje korg)
const sortFn = (a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0);
unassignedChats.sort(sortFn);
unassignedMails.sort(sortFn);
claimedByOthers.sort(sortFn);

// Uppdatera badge-räknare i header-flikarna
const _chatBadge = document.getElementById('inbox-tab-badge-chats');
const _mailBadge = document.getElementById('inbox-tab-badge-mail');
const _claimedBadge = document.getElementById('inbox-tab-badge-claimed');
if (_chatBadge) { _chatBadge.textContent = unassignedChats.length; _chatBadge.style.display = unassignedChats.length > 0 ? 'inline-flex' : 'none'; }
if (_mailBadge) { _mailBadge.textContent = unassignedMails.length; _mailBadge.style.display = unassignedMails.length > 0 ? 'inline-flex' : 'none'; }
if (_claimedBadge) { _claimedBadge.textContent = claimedByOthers.length; _claimedBadge.style.display = claimedByOthers.length > 0 ? 'inline-flex' : 'none'; }

// Synka aktiv flik-knapp
_updateInboxTabBtns();

// Välj rätt lista baserat på aktiv flik
let _activeTickets;
let _emptyMsg;
if (currentInboxTab === 'chats') {
_activeTickets = unassignedChats;
_emptyMsg = 'Inga aktiva live-chattar just nu.';
} else if (currentInboxTab === 'mail') {
_activeTickets = unassignedMails;
_emptyMsg = 'Inga inkomna mail-ärenden just nu.';
} else {
_activeTickets = claimedByOthers;
_emptyMsg = 'Inga plockade eller routade ärenden just nu.';
}

container.innerHTML = '';

if (_activeTickets.length === 0) {
container.innerHTML = `<div style="padding:30px; text-align:center; opacity:0.5; font-style:italic; font-size:13px;">${_emptyMsg}</div>`;
} else {
_activeTickets.forEach(t => {
const card = document.createElement('div');
// ⚠️ LOCK — isInternal: Båda villkoren krävs. ÄNDRA INTE ordningen eller logiken. Se regel 1 ovan.
const isInternal = (t.session_type === 'internal' || t.routing_tag === 'INTERNAL');
// ⚠️ LOCK — styles: Gult för interna, getAgentStyles(routing_tag||owner) för övriga. Se reglerna 2-3 ovan.
const styles = isInternal ? { main: '#f1c40f', bg: 'transparent', border: 'rgba(241,196,15,0.3)', bubbleBg: 'rgba(241,196,15,0.15)' } : getAgentStyles(t.routing_tag || t.owner);

const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const dateStr = new Date(t.updated_at * 1000).toLocaleDateString('sv-SE');
let tagText = t.routing_tag ? resolveLabel(t.routing_tag) : (t.owner ? resolveLabel(t.owner) : (t.session_type === 'message' ? 'MAIL' : 'CHATT'));

const isMail = t.session_type === 'message';
const typeIcon = isMail ? `${UI_ICONS.MAIL}` : `${UI_ICONS.CHAT}`;

card.className = `team-ticket-card${isInternal ? ' internal-ticket' : ''}`;
card.setAttribute('data-id', t.conversation_id);
card.setAttribute('data-owner', (t.owner || '').toUpperCase());

card.style.borderLeft = `4px solid ${styles.main}`;
card.style.setProperty('--agent-color', styles.main);
card.style.setProperty('--atp-color', styles.main);

const displayTitle = esc(resolveTicketTitle(t));

// Hämtar text från context_data för att slippa "Ingen text"
let rawPreview = t.last_message || t.question || t.subject;
if (!rawPreview && t.context_data) {
try {
const ctx = typeof t.context_data === 'string' ? JSON.parse(t.context_data) : t.context_data;
if (ctx.messages && ctx.messages.length > 0) {
rawPreview = ctx.messages[0].content || ctx.messages[0].text;
}
} catch(e) {}
}
const isPrivateInbox = t.session_type === 'internal';
const _cleanPreview = (rawPreview || 'Ingen text...').replace(/!\[([^\]]*)\]\([^)]*\)/g, ($0, alt) => alt || '[Bild]');
const previewText = isPrivateInbox
? `<span style="color:#f1c40f; display:flex; align-items:center; gap:4px;">${UI_ICONS.LOCK} Privat ärende</span>`
: stripHtml(_cleanPreview);
const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color: ${styles.main}; display: flex; align-items: center; opacity: 0.9;" title="${t.vehicle}">${vIcon}</span>` : '';

const searchIndex = [
displayTitle, tagText, dateStr,
t.sender || '', t.contact_email || '',
t.routing_tag || '', t.owner || ''
].join(' ').toLowerCase();
card.setAttribute('data-search', searchIndex);

card.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title">
<span style="opacity:0.7; margin-right:6px; display:flex; align-items:center;">${typeIcon}</span>
<span style="color:${styles.main}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right">
${vehicleHtml}
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar – visas aldrig för kunden" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
<div class="ticket-preview">${previewText}</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${dateStr} • ${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="claim-mini-btn claim-action" title="Ta ärendet – det hamnar i Mina Ärenden" style="color:${styles.main}" onclick="event.stopPropagation(); claimTicket('${t.conversation_id}')">
${UI_ICONS.CLAIM}
</button>`;

// Claim-knapp handler
const btn = card.querySelector('.claim-action');
btn.onclick = async (e) => {
e.stopPropagation();
const res = await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id, agentName: currentUser.username })
});
const result = res.ok ? await res.json() : null;
if (!result?.previousOwner) showToast('✅ Ärendet är nu ditt!');
renderInbox();
};

// Long-press (800ms) aktiverar bulk mode — kort klick öppnar detaljvy
let _lpTimer = null;
let _lpFired = false;
card.addEventListener('mousedown', () => {
_lpFired = false;
_lpTimer = setTimeout(() => {
_lpFired = true;
_lpTimer = null;
if (!isBulkMode) {
isBulkMode = true;
container.classList.add('bulk-mode-active');
showBulkToolbar();
}
toggleBulkCard(card, t.conversation_id);
}, 800);
});
card.addEventListener('mouseup', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
if (_lpFired) { _lpFired = false; return; }
if (isBulkMode) {
toggleBulkCard(card, t.conversation_id);
} else {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
card.classList.add('active-ticket');
openInboxDetail(t);
}
});
card.addEventListener('mouseleave', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
});

container.appendChild(card);

// 🔥 Sätt notes-glow på kortet om anteckningar finns
if (typeof refreshNotesGlow === 'function') {
refreshNotesGlow(t.conversation_id);
}
});
}

// Uppdatera även den lilla röda pricken i menyn om det behövs
updateInboxBadge();

} catch (err) {
console.error("Inbox fel:", err);
container.innerHTML = `<div class="template-item-empty" style="color:#ff6b6b">Kunde inte ladda inkorgen.</div>`;

// Felhantering för vyer
const detail = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');
if (detail && placeholder) {
detail.innerHTML = '';
detail.style.display = 'none';
placeholder.style.display = 'flex';
detail.removeAttribute('data-current-id');
}
}
} // Slut på async function renderInbox()

// ============================================================================
// renderInboxFromTickets — Ritar om inkorgslistan med sökresultat (MED BULK + SELECT ALL)
// ============================================================================
function renderInboxFromTickets(tickets, searchTerm) {
const container = DOM.inboxList;
if (!container) return;

container.innerHTML = '';
// TVINGA SORTERING: Nyast (högst timestamp) först i listan
tickets.sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));

if (tickets.length === 0) {
container.innerHTML = `<div class="template-item-empty" style="padding:24px; text-align:center; opacity:0.6;">
Inga ärenden matchade <strong>"${esc(searchTerm)}"</strong>
</div>`;
return;
}

// 1. SKAPA HEADER (Med "Markera alla"-knappen)
const header = document.createElement('div');
header.className = 'template-group-header';
header.style.display = 'flex';
header.style.justifyContent = 'space-between';
header.style.alignItems = 'center';

header.innerHTML = `
<div class="group-header-content">
<span class="group-name" style="opacity:0.7;">Sökresultat för "${esc(searchTerm)}"</span>
<span class="group-badge live-badge" style="margin-left:8px;">${tickets.length}</span>
</div>
<button id="btn-select-all-search" class="claim-mini-btn" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; font-size:10px; padding:4px 8px; border-radius:4px; cursor:pointer;">
Markera alla
</button>`;

container.appendChild(header);

const content = document.createElement('div');
content.className = 'template-group-content expanded';

// Aktivera bulk-läge visuellt om det redan är igång
if (typeof isBulkMode !== 'undefined' && isBulkMode) {
container.classList.add('bulk-mode-active');
}

tickets.forEach(t => {
const card = document.createElement('div');

// ⚠️ LOCK — styles (claimed-kö): Claimed ärenden är alltid kundärenden, ingen isInternal-check behövs här.
// Prioritet: routing_tag (kontorsfärg, starkast) → owner (agentfärg). ÄNDRA INTE fallback-kedjan.
const styles = getAgentStyles(t.routing_tag || t.owner);
const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const dateStr = new Date(t.updated_at * 1000).toLocaleDateString('sv-SE');
const isMail = t.session_type === 'message';
const typeIcon = isMail ? UI_ICONS.MAIL : UI_ICONS.CHAT;
const displayTitle = esc(resolveTicketTitle(t));
const _rawMsg = t.last_message || 'Ingen text...';
const previewText = stripHtml(_rawMsg.replace(/!\[([^\]]*)\]\([^)]*\)/g, ($0, alt) => alt || '[Bild]'));
const tagText = t.routing_tag ? resolveLabel(t.routing_tag) : (t.owner ? resolveLabel(t.owner) : (isMail ? 'MAIL' : 'CHATT'));
const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color:${styles.main}; display:flex; align-items:center; opacity:0.9;" title="${t.vehicle}">${vIcon}</span>` : '';

card.className = 'team-ticket-card';
card.setAttribute('data-id', t.conversation_id);
card.style.borderLeft = `4px solid ${styles.main}`;
card.style.setProperty('--agent-color', styles.main);
card.style.setProperty('--atp-color', styles.main);

// Om kortet redan är valt i en pågående bulk-session
if (typeof selectedTicketIds !== 'undefined' && selectedTicketIds.has(t.conversation_id)) {
card.classList.add('bulk-selected');
}

card.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title">
<span style="opacity:0.7; margin-right:6px; display:flex; align-items:center;">${typeIcon}</span>
<span style="color:${styles.main}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right">
${vehicleHtml}
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar – visas aldrig för kunden" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
<div class="ticket-preview">${previewText}</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${dateStr} • ${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="claim-mini-btn claim-action" title="Ta ärendet – det hamnar i Mina Ärenden" style="color:${styles.main}">
${UI_ICONS.CLAIM}
</button>`;

// --- MULTISELECT / LONG-PRESS LOGIK ---
let _lpTimer = null;
let _lpFired = false;

card.addEventListener('mousedown', () => {
_lpFired = false;
_lpTimer = setTimeout(() => {
_lpFired = true;
_lpTimer = null;
if (!isBulkMode) {
isBulkMode = true;
container.classList.add('bulk-mode-active');
if (typeof showBulkToolbar === 'function') showBulkToolbar();
}
if (typeof toggleBulkCard === 'function') toggleBulkCard(card, t.conversation_id);
}, 800);
});

card.addEventListener('mouseup', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
if (_lpFired) { _lpFired = false; return; }

if (isBulkMode) {
if (typeof toggleBulkCard === 'function') toggleBulkCard(card, t.conversation_id);
} else {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
card.classList.add('active-ticket');
openInboxDetail(t);
}
});

card.addEventListener('mouseleave', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
});

const btn = card.querySelector('.claim-action');
btn.onclick = async (ev) => {
ev.stopPropagation();
const res = await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id, agentName: currentUser.username })
});
const result = res.ok ? await res.json() : null;
if (!result?.previousOwner) showToast('✅ Ärendet är nu ditt!');
renderInbox();
const searchEl = document.getElementById('inbox-search');
if (searchEl) searchEl.value = '';
};

content.appendChild(card);
});

container.appendChild(content);

// 3. LOGIK FÖR "MARKERA ALLA" (Ligger sist i funktionen)
const selectAllBtn = document.getElementById('btn-select-all-search');
if (selectAllBtn) {
selectAllBtn.onclick = (e) => {
e.stopPropagation();
if (!isBulkMode) {
isBulkMode = true;
container.classList.add('bulk-mode-active');
showBulkToolbar();
}

const currentlySelectedInSearch = tickets.filter(t => selectedTicketIds.has(t.conversation_id));
const shouldSelectAll = currentlySelectedInSearch.length < tickets.length;

tickets.forEach(t => {
const cardEl = content.querySelector(`.team-ticket-card[data-id="${t.conversation_id}"]`);
if (shouldSelectAll) {
if (!selectedTicketIds.has(t.conversation_id)) {
selectedTicketIds.add(t.conversation_id);
if (cardEl) cardEl.classList.add('bulk-selected');
}
} else {
selectedTicketIds.delete(t.conversation_id);
if (cardEl) cardEl.classList.remove('bulk-selected');
}
});

if (typeof updateBulkCount === 'function') updateBulkCount();
if (selectedTicketIds.size === 0) {
isBulkMode = false;
container.classList.remove('bulk-mode-active');
hideBulkToolbar();
}
};
}
}

// ============================================================================
// DETALJVY FÖR INKORG
// ============================================================================
function openInboxDetail(ticket) {
const detailView = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');

if (!detailView || !placeholder) return;

placeholder.style.display = 'none';
detailView.style.display = 'flex';
detailView.setAttribute('data-current-id', ticket.conversation_id);

// ⚠️ LOCK — styles (detaljvy): Samma prioritet som kortet. routing_tag → owner. ÄNDRA INTE.
// Inkorgens detaljvy visar ej interna ärenden (de öppnas via Mina Ärenden) → ingen isInternal-check.
const styles = getAgentStyles(ticket.routing_tag || ticket.owner);
detailView.className = 'template-editor-container';
detailView.setAttribute('data-owner', ticket.owner || 'unclaimed');
detailView.style.setProperty('border-top', 'none', 'important');
detailView.style.setProperty('background', `linear-gradient(to bottom, ${styles.bg}, transparent)`, 'important');
detailView.innerHTML = '';

const isMine = currentUser && ticket.owner === currentUser.username;
const mainTitle = esc(resolveTicketTitle(ticket));

let topActionBtn = '';
if (isSupportAgent()) {
topActionBtn += `<button class="action-icon-btn" id="detail-assign-btn" title="Vidarebefordra ärendet till en kollega">${UI_ICONS.ASSIGN}</button>`;
}
if (!ticket.owner) {
topActionBtn += `<button class="action-icon-btn" id="detail-claim-btn" title="Ta ärendet – du blir ansvarig agent">${UI_ICONS.CLAIM}</button>`;
} else if (ticket.owner && !isMine) {
topActionBtn += `<button class="action-icon-btn danger" id="detail-takeover-btn" title="Ta över från ${ticket.owner}">${UI_ICONS.TAKE_OVER}</button>`;
}

if (topActionBtn) topActionBtn = `<div style="display:flex; gap:8px; align-items:center; justify-content:flex-end;">${topActionBtn}</div>`;

let bodyContent = '';


if (ticket.session_type === 'message') {
const messages = ticket.messages || [];
let mailHistoryHtml = '';

if (messages.length === 0) {
mailHistoryHtml = '<div style="padding:40px; opacity:0.5; text-align:center;">Ingen historik ännu.</div>';
} else {
messages.forEach(m => {
const isUser = m.role === 'user';
const clean = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
const timeStr = smartTime(m.timestamp);

if (isUser) {
const avatarInitial = mainTitle ? mainTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${styles.main}; color:white; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; margin-right:12px; flex-shrink:0;">${avatarInitial}</div>`;
mailHistoryHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
${userAvatar}
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-left:2px;"><b>${mainTitle || 'Kund'}</b>${timeStr ? ' • ' + timeStr : ''}</div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important; padding:15px; border-radius:12px;">
${typeof formatAtlasMessage === 'function' ? formatAtlasMessage(clean) : (clean || '')}
</div>
</div>
</div>`;
} else {
const _mAgentLabel = m.sender && m.sender !== 'user' ? (typeof formatName === 'function' ? formatName(m.sender) : m.sender) : 'Atlas';
const _mAgentSt = m.sender && m.sender !== 'user' ? getAgentStyles(m.sender) : null;
const _mAvatarStyle = _mAgentSt ? `background:${_mAgentSt.main}; color:white; font-weight:800;` : 'background:#3a3a3c;';
const _mAvatarContent = _mAgentSt ? _mAgentLabel.charAt(0).toUpperCase() : '🤖';
mailHistoryHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-right:2px;">${_mAgentLabel} • ${timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:15px; border-radius:12px;">
${typeof formatAtlasMessage === 'function' ? formatAtlasMessage(clean) : (clean || '')}
</div>
</div>
<div class="msg-avatar" style="${_mAvatarStyle} margin-left:12px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0; font-size:18px;">${_mAvatarContent}</div>
</div>`;
}
});
}

bodyContent = `<div class="inbox-chat-history" style="padding:10px 5px;">${mailHistoryHtml}</div>`;
} else {
const messages = ticket.messages || [];
let chatHistoryHtml = '';

if (messages.length > 0) {
messages.forEach(m => {
const isUser = m.role === 'user';
const _cIsAgent = !isUser && m.sender && m.sender !== 'user';
const _cAgentLabel = _cIsAgent ? (typeof formatName === 'function' ? formatName(m.sender) : m.sender) : 'Atlas';
const _cAgentSt = _cIsAgent ? getAgentStyles(m.sender) : null;
const _cAvatarStyle = _cAgentSt ? `background:${_cAgentSt.main}; color:white; font-weight:800;` : 'background:#3a3a3c;';
const _cAvatarContent = _cAgentSt ? _cAgentLabel.charAt(0).toUpperCase() : '🤖';
const atlasAvatar = `<div class="msg-avatar" style="${_cAvatarStyle} margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${_cAvatarContent}</div>`;
const userInitial = mainTitle ? mainTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${styles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${userInitial}</div>`;
const timeStr = smartTime(m.timestamp);

if (isUser) {
chatHistoryHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
${userAvatar}
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-left:2px;"><b>${mainTitle || 'Kund'}</b>${timeStr ? ' • ' + timeStr : ''}</div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important; padding:10px 14px; border-radius:12px;">
${(typeof formatAtlasMessage === 'function' ? formatAtlasMessage(m.content || m.text) : ((m.content || m.text) || '')).trim()}
</div>
</div>
</div>`;
} else {
chatHistoryHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-right:2px;">${_cAgentLabel} • ${timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:10px 14px; border-radius:12px;">
${(typeof formatAtlasMessage === 'function' ? formatAtlasMessage(m.content || m.text) : ((m.content || m.text) || '')).trim()}
</div>
</div>
${atlasAvatar}
</div>`;
}
});
}

bodyContent = `<div class="inbox-chat-history" style="padding:10px 5px;">${chatHistoryHtml}</div>
<div id="typing-indicator-${ticket.conversation_id}" style="display:none; padding:4px 14px 8px; font-size:12px; font-style:italic; color:${styles.main}; opacity:0.75;">✍️ Kunden skriver...</div>`;
}

// Villkor för Snabbsvar: chatt (customer) eller mailärende (message) med e-post
const isMailTicket = ticket.session_type === 'message' && !!ticket.contact_email;
const canQuickReply = ['admin', 'agent'].includes(currentUser?.role)
&& (ticket.session_type === 'customer' || isMailTicket);

const msgs = ticket.messages || [];
const totalChars = msgs.reduce((acc, m) => acc + (m.content || m.text || '').length, 0);
const isLongEnough = msgs.length >= 5 || totalChars >= 400;

const content = document.createElement('div');
content.className = 'detail-container';
content.innerHTML = `
${renderDetailHeader(ticket, styles, topActionBtn)}
${isLongEnough ? `
<div id="ticket-summary-panel" style="display:none; margin:0 16px 10px; padding:10px 14px;
border-radius:8px; background:${styles.main}11; border:1px solid ${styles.border};
font-size:13px; line-height:1.6; color:var(--text-secondary);">
<span style="font-size:11px; font-weight:600; color:${styles.main}; text-transform:uppercase;
letter-spacing:0.5px; display:block; margin-bottom:6px;">AI Sammanfattning</span>
<span id="ticket-summary-text"></span>
</div>` : ''}
<div class="detail-body scroll-list" id="inbox-detail-body">
${bodyContent}
</div>
${canQuickReply ? `
<div id="quick-reply-area" style="padding:8px 16px; border-top:1px solid ${styles.border}; background:${styles.bg}; display:flex; flex-direction:column; gap:10px;">
${isMailTicket ? `<div style="font-size:11px; color:var(--text-secondary); opacity:0.55; padding:0 2px;">Till: ${ticket.contact_email}</div>` : ''}
<div style="display:flex; align-items:flex-end; gap:8px;">
<textarea id="quick-reply-input" placeholder="${isMailTicket ? 'Skriv mailsvar... (Ctrl+Enter)' : 'Snabbsvar... (Ctrl+Enter)'}"
style="flex:1; min-height:44px; max-height:300px; resize:vertical; padding:8px 10px; border-radius:8px;
background:rgba(255,255,255,0.07); border:1px solid ${styles.border};
color:var(--text-primary); font-size:13px; font-family:inherit; box-sizing:border-box;
overflow-y:auto; transition:height 0.15s ease;"></textarea>
<button id="btn-quick-reply-send" title="Skicka svar" style="flex-shrink:0; width:36px; height:36px; border-radius:8px;
background:${styles.main}; color:white; border:none; cursor:pointer;
display:flex; align-items:center; justify-content:center;">
${UI_ICONS.SEND}
</button>
</div>
${State.templates?.length ? `<div style="flex:1;"><select id="inbox-template-select" class="filter-select"><option value="">📋 Välj mall att kopiera...</option>${(State.templates || []).map(t => `<option value="${t.id}">${t.title}</option>`).join('')}</select></div>` : ''}
</div>` : ''}
<div class="detail-footer-area">
<div class="detail-footer-toolbar" style="padding: 12px 20px; border-top:1px solid var(--border-color); background:rgba(0,0,0,0.25); display:flex; justify-content:flex-end; gap:12px;">
${canQuickReply ? `<label id="btn-agent-upload" title="Bifoga fil eller bild" style="cursor:pointer; padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); font-size:16px; display:inline-flex; align-items:center;" for="agent-file-input">📎</label><input type="file" id="agent-file-input" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display:none;">` : ''}
${canQuickReply ? `<button class="footer-icon-btn" id="btn-quick-reply-ai" title="AI-svar – fungerar endast på företagsspecifika frågor eller körkortsfrågor">${UI_ICONS.AI}</button>` : ''}
${isLongEnough ? `<button class="footer-icon-btn" id="btn-summarize" title="Sammanfatta konversationen med AI">${UI_ICONS.SPARKLES}</button>` : ''}
<button class="footer-icon-btn btn-archive-red" id="btn-archive" title="${isMailTicket ? 'Arkivera ärendet – flyttas till Garaget' : 'Stäng ärendet och flytta det till Garaget'}">${UI_ICONS.ARCHIVE}</button>
<button class="footer-icon-btn danger" id="btn-delete" title="Radera ärendet permanent – kan inte ångras">${UI_ICONS.TRASH}</button>
</div>
</div>
`;

detailView.style.padding = '0';
detailView.style.background = 'transparent';
detailView.innerHTML = '';
detailView.appendChild(content);
refreshNotesGlow(ticket.conversation_id);

// Koppla Quick Reply-logik efter HTML är i DOM
if (canQuickReply) {
// Håller mallens HTML tills användaren manuellt ändrar texten
let inboxActiveTemplateHtml = null;

const quickReply = async () => {
const input = document.getElementById('quick-reply-input');
const pendingMarkdown = window._pendingAttachments?.get(input?.id) || '';
if (pendingMarkdown) {
  input.value = (input.value.trim() + '\n\n' + pendingMarkdown.trim()).trim();
  window._pendingAttachments.delete(input.id);
  input.placeholder = 'Snabbsvar... (Ctrl+Enter för att skicka)';
}
const msg = (input?.value || '').trim();
if (!msg) return;
// Återställ svarsrutan till standardhöjd direkt
if (input) { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 300) + 'px'; }
const qrBtn = document.getElementById('btn-quick-reply-send');
if (qrBtn) { qrBtn.disabled = true; qrBtn.style.opacity = '0.5'; }
try {
// AUTO-CLAIM sker via team:agent_reply / team:send_email_reply i server.js
// Ingen HTTP pre-claim behövs — den skapar race-conditions med socket-handlens previousOwner-läsning
if (isMailTicket) {
window.socketAPI.emit('team:send_email_reply', {
conversationId: ticket.conversation_id,
message: msg,
html: inboxActiveTemplateHtml || msg.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'),
customerEmail: ticket.contact_email,
subject: 'Re: ' + (ticket.subject || ticket.question || 'Ditt ärende')
});
inboxActiveTemplateHtml = null;
} else {
window.socketAPI.emit('team:agent_reply', {
conversationId: ticket.conversation_id,
message: msg
});
}
// Stäng detail + ladda om inkorg (ärendet försvinner dit — det är nu i Mina Ärenden)
clearDetailView();
renderInbox();
renderMyTickets?.();
showToast('✅ Svar skickat! Ärendet ligger i Mina Ärenden.');
} catch(err) {
logError('[inbox]', err, 'Fel vid skicka — försök igen.');
if (qrBtn) { qrBtn.disabled = false; qrBtn.style.opacity = '1'; }
}
};
const qrBtn = document.getElementById('btn-quick-reply-send');
if (qrBtn) qrBtn.onclick = quickReply;

// Agent fil-upload
const agentFileInput = document.getElementById('agent-file-input');
if (agentFileInput) {
  agentFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const label = document.getElementById('btn-agent-upload');
    if (label) label.textContent = '⏳';
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_id', ticket.conversation_id || '');
      if (ticket.session_type === 'internal' ||
          (ticket.conversation_id || '').startsWith('INTERNAL_')) {
        formData.append('is_internal', 'true');
      }
      const res = await fetch(`${SERVER_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': fetchHeaders['Authorization'] },
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        alert('Uppladdning misslyckades: ' + (err.error || res.status));
        return;
      }
      const data = await res.json();
      const textarea = document.getElementById('quick-reply-input');
      if (!textarea) return;
      const isImage = file.type.startsWith('image/');
      const markdown = isImage
        ? `\n![Bild](${data.url})\n`
        : `\n📎 [Fil: ${data.originalName || file.name}](${data.url})\n`;
      if (!window._pendingAttachments) window._pendingAttachments = new Map();
      const existingMarkdown = window._pendingAttachments.get(textarea.id) || '';
      window._pendingAttachments.set(textarea.id, existingMarkdown + '\n' + markdown);
      const statusText = isImage ? '📷 Bild inklistrad — skickas med meddelandet' : `📎 Fil bifogad: ${file.name} — skickas med meddelandet`;
      textarea.placeholder = statusText;
      if (!textarea.value.trim()) textarea.value = '';
      textarea.focus();
    } catch (err) {
      alert('Uppladdningsfel: ' + err.message);
    } finally {
      if (label) label.textContent = '📎';
      agentFileInput.value = '';
    }
  });
}

const qrInput = document.getElementById('quick-reply-input');
if (qrInput) {
qrInput.addEventListener('keydown', (e) => {
if (e.ctrlKey && e.key === 'Enter') quickReply();
});
qrInput.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) break;
      const label = document.getElementById('btn-agent-upload');
      if (label) label.textContent = '⏳';
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_id', ticket.conversation_id || '');
        if (ticket.session_type === 'internal' ||
            (ticket.conversation_id || '').startsWith('INTERNAL_')) {
          formData.append('is_internal', 'true');
        }
        const res = await fetch(`${SERVER_URL}/api/upload`, {
          method: 'POST',
          headers: { 'Authorization': fetchHeaders['Authorization'] },
          body: formData
        });
        if (!res.ok) { alert('Uppladdning misslyckades'); break; }
        const data = await res.json();
        const markdown = `\n![Bild](${data.url})\n`;
        if (!window._pendingAttachments) window._pendingAttachments = new Map();
        const existingMarkdown = window._pendingAttachments.get(qrInput.id) || '';
        window._pendingAttachments.set(qrInput.id, existingMarkdown + '\n' + markdown);
        qrInput.placeholder = '📷 Bild inklistrad — skickas med meddelandet';
        if (!qrInput.value.trim()) qrInput.value = '';
        qrInput.focus();
      } catch (err) {
        alert('Uppladdningsfel: ' + err.message);
      } finally {
        if (label) label.textContent = '📎';
      }
      break;
    }
  }
});
// Meddela kunden att agenten skriver (bara för chattärenden)
if (!isMailTicket) {
let _inboxTypingTimer;
qrInput.addEventListener('input', () => {
if (window.socketAPI) {
window.socketAPI.emit('team:agent_typing', { sessionId: ticket.conversation_id, is_typing: true });
clearTimeout(_inboxTypingTimer);
_inboxTypingTimer = setTimeout(() => {
window.socketAPI.emit('team:agent_typing', { sessionId: ticket.conversation_id, is_typing: false });
}, 2500);
}
});
}
}
// Mall-picker för inkorg
const inboxTSelect = document.getElementById('inbox-template-select');
if (inboxTSelect) {
inboxTSelect.onchange = () => {
const tId = inboxTSelect.value;
if (!tId) return;
const t = (State.templates || []).find(x => x.id == tId);
if (t && qrInput) {
inboxActiveTemplateHtml = t.content;
// Konvertera Quill HTML → text med bevarade radbrytningar
qrInput.value = (t.content || '')
.replace(/<br\s*\/?>/gi, '\n')
.replace(/<\/p>/gi, '\n').replace(/<p[^>]*>/gi, '')
.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '')
.replace(/<[^>]+>/g, '')
.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
.replace(/\n{3,}/g, '\n\n')
.trim();
// Auto-expand svarsrutan efter mallens innehåll
qrInput.style.height = 'auto';
qrInput.style.height = Math.min(qrInput.scrollHeight, 300) + 'px';
qrInput.focus();
inboxTSelect.value = '';
}
};
}
// Nollställ HTML-mallen om användaren redigerar manuellt (isTrusted=false för programmatiska events)
if (qrInput) {
qrInput.addEventListener('input', (e) => {
if (e.isTrusted) inboxActiveTemplateHtml = null;
// Alltid räkna om höjden — tom ruta: scrollHeight < min-height → min-height tar över
qrInput.style.height = 'auto';
qrInput.style.height = Math.min(qrInput.scrollHeight, 300) + 'px';
});
}

// AI-knapp för snabbsvar i inkorg
const btnQrAI = document.getElementById('btn-quick-reply-ai');
if (btnQrAI) {
btnQrAI.onclick = () => {
const inp = document.getElementById('quick-reply-input');
if (!inp) return;
const lastUser = [...(ticket.messages || [])].reverse().find(m => m.role === 'user');
const originalMsg = lastUser?.content || ticket.last_message || '';
if (!originalMsg) { showToast('Ingen kundtext att basera förslag på.'); return; }
inp.value = '🤖 Tänker... (Hämtar AI-förslag)';
inp.disabled = true;
window.socketAPI.emit('team:email_action', {
conversationId: ticket.conversation_id,
action: 'draft',
content: originalMsg
});
};
}
}

// AI Sammanfattning — inkorg
const btnSumInbox = document.getElementById('btn-summarize');
if (btnSumInbox) {
  btnSumInbox.onclick = () => {
    btnSumInbox.disabled = true;
    const panel = document.getElementById('ticket-summary-panel');
    const txt = document.getElementById('ticket-summary-text');
    if (panel && txt) { panel.style.display = 'block'; txt.textContent = '🤖 Sammanfattar...'; }
    window.socketAPI.emit('team:summarize_ticket', {
      conversationId: ticket.conversation_id,
      messages: ticket.messages || []
    });
  };
}

const clearDetailView = () => {
if (detailView) {
detailView.innerHTML = '';
detailView.style.display = 'none';
detailView.removeAttribute('data-current-id');
}
if (placeholder) { placeholder.style.display = 'flex'; }
};

const handleClaim = async (action) => {
clearDetailView();
try {
  // Gemensam path för både Electron och webb — window.claimTicket hanterar båda
  const result = await window.claimTicket(ticket.conversation_id);
  // Vid övertagande (previousOwner finns): socket team:ticket_claimed_self visar toast — ingen dubbel toast
  // Vid ren claim (inget previousOwner): inget socket-toast — visa lokal toast
  if (action !== 'takeover' || !result?.previousOwner) {
    const toastMsg = action === 'takeover' ? '✅ Du har tagit över ärendet!' : '✅ Ärendet är nu ditt!';
    showToast(toastMsg);
  }
  if (window.NotifSystem && action === 'claim') {
    const customerName = esc(resolveTicketTitle(ticket));
    window.NotifSystem.addNotif(`Du tog ärendet från ${customerName}`);
  }
  updateInboxBadge();
} catch (err) {
logError('[inbox]', err, 'Kunde inte ta ärendet. Försök igen.');
}
};

const assignBtn = document.getElementById('detail-assign-btn');
if (assignBtn) assignBtn.onclick = async () => { await showAssignModal(ticket); };

const claimBtn = document.getElementById('detail-claim-btn');
if (claimBtn) claimBtn.onclick = () => handleClaim('claim');

const takeoverBtn = document.getElementById('detail-takeover-btn');
if (takeoverBtn) takeoverBtn.onclick = () => handleClaim('takeover');

const inboxArchive = document.getElementById('btn-archive');
if (inboxArchive) {
inboxArchive.onclick = async () => {
clearDetailView();
try {
await fetch(`${SERVER_URL}/api/inbox/archive`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: ticket.conversation_id }) });
const customerName = esc(resolveTicketTitle(ticket));
const ticketRef = `#${String(ticket.conversation_id).slice(-6)}`;
showToast(`✅ Ärendet från ${customerName} ${ticketRef} arkiverat!`);
if (window.NotifSystem) window.NotifSystem.addNotif(`Ärendet från ${customerName} ${ticketRef} arkiverat`);
renderInbox();
} catch (err) {
logError('[inbox]', err, 'Kunde inte arkivera ärendet. Försök igen.');
}
};
}

const inboxDelete = document.getElementById('btn-delete');
if (inboxDelete) {
inboxDelete.onclick = async () => {
if (await atlasConfirm('Ta bort', 'Är du säker? Detta raderar ärendet permanent.')) {
clearDetailView();

try {
await fetch(`${SERVER_URL}/api/inbox/delete`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: ticket.conversation_id }) });

if (window.electronAPI && ticket.id) {
await window.electronAPI.deleteQA(ticket.id).catch(e => console.log("Lokal städning ej nödvändig"));
}

const customerName = esc(resolveTicketTitle(ticket));
const ticketRef = `#${String(ticket.conversation_id).slice(-6)}`;
showToast(`✅ Ärendet från ${customerName} ${ticketRef} raderat`);
if (window.NotifSystem) window.NotifSystem.addHistory('🗑️', `Ärendet från ${customerName} ${ticketRef} raderades`);

const listContainer = document.getElementById('inbox-list');
if (listContainer) {
const cards = listContainer.querySelectorAll('.team-ticket-card');
cards.forEach(card => {
if (card.getAttribute('data-id') === ticket.conversation_id) {
card.remove();
}
});
if (listContainer.children.length === 0) {
listContainer.innerHTML = `
<div class="template-item-empty" style="padding:40px; text-align:center; opacity:0.6;">
<div style="margin-bottom:15px; opacity: 0.3;">
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
</div>
<div>Inga olösta ärenden.</div>
</div>`;
}
}
} catch (err) {
logError('[inbox]', err, 'Kunde inte radera ärendet.');
}
}
};
}
}