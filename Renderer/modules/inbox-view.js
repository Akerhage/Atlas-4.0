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

// ============================================================================
// FIX 1: BADGE-HANTERING + WINDOWS TASKBAR ICON (SÄKRAD)
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

const inboxTickets = inboxData.tickets || [];
const myTickets = myData.tickets || [];

// Inkorg: alla oplockat (live-chattar + mail + plockade ärenden)
const inboxCount = inboxTickets.filter(t => !t.owner).length;

// Plockade ärenden i inkorgen (routade till kontor)
const claimedCount = (inboxData.claimed || []).length;

// Mina ärenden: alla som API:et returnerar för denna agent
const myCount = myTickets.length;

const totalInbox = inboxCount + claimedCount;
const totalCount = totalInbox + myCount;

// Uppdatera badges
if (inboxBadge) {
inboxBadge.textContent = totalInbox;
inboxBadge.style.setProperty('display', totalInbox > 0 ? 'flex' : 'none', 'important');
}
if (myBadge) {
myBadge.textContent = myCount;
myBadge.style.setProperty('display', myCount > 0 ? 'flex' : 'none', 'important');
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
// Hjälpfunktion: Ritar röd cirkel - BEVARAD EXAKT
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
// 4. UNIFIED INBOX (RENDER) - MED NYA RÖDA BADGES
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

// 🔥 RENSA FÖRST NU - Efter att vi fixat vyer
container.innerHTML = ''; 

// NY RENDER GROUP med minne och Custom Badges
const renderGroup = (title, tickets, icon, groupKey, badgeClass) => {
const defaultExpanded = State.inboxExpanded[groupKey];
const header = document.createElement('div');
header.className = 'template-group-header'; 

// 🔥 HÄR ANVÄNDER VI DIN NYA CSS-KLASS FÖR BADGEN!
const countHtml = tickets.length > 0 
? `<span class="group-badge ${badgeClass}">${tickets.length}</span>` 
: `<span class="group-count empty">0</span>`;

header.innerHTML = `
<div class="group-header-content">
<span class="group-arrow ${defaultExpanded ? 'expanded' : ''}">▶</span>
<span class="group-name">${icon} ${title}</span>
</div>
${countHtml}`;

const content = document.createElement('div');
content.className = `template-group-content ${defaultExpanded ? 'expanded' : ''}`;

if (tickets.length === 0) {
content.innerHTML = `<div style="padding:15px; text-align:center; opacity:0.5; font-style:italic; font-size:13px;">Inga ärenden i denna kö.</div>`;
} else {
tickets.forEach(t => {
const card = document.createElement('div');
const isInternal = (t.session_type === 'internal' || t.routing_tag === 'INTERNAL');
const styles = isInternal ? { main: '#f1c40f', bg: 'transparent', border: 'rgba(241,196,15,0.3)', bubbleBg: 'rgba(241,196,15,0.15)' } : getAgentStyles(t.routing_tag || t.owner);

// Deklarera variablerna innan de används i HTML
const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const dateStr = new Date(t.updated_at * 1000).toLocaleDateString('sv-SE');
const actionIcon = UI_ICONS.CLAIM;
let tagText = t.routing_tag ? resolveLabel(t.routing_tag) : (t.owner ? resolveLabel(t.owner) : (t.session_type === 'message' ? 'MAIL' : 'CHATT'));

const isMail = t.session_type === 'message';
const typeIcon = isMail ? `${UI_ICONS.MAIL}` : `${UI_ICONS.CHAT}`;

card.className = `team-ticket-card${isInternal ? ' internal-ticket' : ''}`;
card.setAttribute('data-id', t.conversation_id);
card.setAttribute('data-owner', (t.owner || '').toUpperCase());

// KIRURGISK FIX: Uppdatera båda variablerna och tvinga kanten direkt
card.style.borderLeft = `4px solid ${styles.main}`;
card.style.setProperty('--agent-color', styles.main);
card.style.setProperty('--atp-color', styles.main);

// Variabler deklareras INNAN de används i sökindex och HTML
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
const previewText = isPrivateInbox
? `<span style="color:#f1c40f; display:flex; align-items:center; gap:4px;">${UI_ICONS.LOCK} Privat ärende</span>`
: stripHtml(rawPreview || "Ingen text...");
const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color: ${styles.main}; display: flex; align-items: center; opacity: 0.9;" title="${t.vehicle}">${vIcon}</span>` : '';

// Sökindex: bara synliga fält — undviker falska träffar från meddelandetext
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
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
<div class="ticket-preview">${previewText}</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${dateStr} • ${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="claim-mini-btn claim-action" title="Plocka ärende" style="color:${styles.main}" onclick="event.stopPropagation(); claimTicket('${t.conversation_id}')">
${UI_ICONS.CLAIM}
</button>`;

// Claim-knapp (inline onclick ersätts med querySelector-handler)
const btn = card.querySelector('.claim-action');
btn.onclick = async (e) => {
e.stopPropagation();
const myName = currentUser.username;
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id, agentName: myName })
});
showToast('✅ Ärendet är nu ditt!');
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
if (_lpFired) { _lpFired = false; return; } // long press hanterade redan
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

content.appendChild(card);
});
}

header.onclick = () => {
const isExpanded = content.classList.toggle('expanded');
header.querySelector('.group-arrow').classList.toggle('expanded');
State.inboxExpanded[groupKey] = isExpanded; 
};
container.appendChild(header);
container.appendChild(content);
};

// 🔥 RENDER GROUP MED NYA CSS-KLASSERNA FÖR BADGES (Emoji-fria)
renderGroup("Live-Chattar", unassignedChats, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>`, "Live-Chattar", "live-badge"); 

renderGroup("Inkomna MAIL", unassignedMails, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>`, "Inkomna MAIL", "mail-badge");

renderGroup("Plockade Ärenden", claimedByOthers, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`, "Plockade Ärenden", "picked-badge");

// Uppdatera även den lilla röda pricken i menyn om det behövs
updateInboxBadge();

} catch (err) {
console.error("Inbox fel:", err);
container.innerHTML = `<div class="template-item-empty" style="color:#ff6b6b">Kunde inte ladda inkorgen.</div>`;

// Felhantering för vyer
const detail = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');
if (detail && placeholder) {
detail.innerHTML = ''; // LÄGG TILL DENNA
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

// Samma ordning som i din kod
container.appendChild(header);

const content = document.createElement('div');
content.className = 'template-group-content expanded';

// Aktivera bulk-läge visuellt om det redan är igång
if (typeof isBulkMode !== 'undefined' && isBulkMode) {
container.classList.add('bulk-mode-active');
}

tickets.forEach(t => {
const card = document.createElement('div');

// 🔥 DIN ORIGINAL-MAPPING - EXAKT SOM DU SKREV DEN
const styles = getAgentStyles(t.routing_tag || t.owner);
const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const dateStr = new Date(t.updated_at * 1000).toLocaleDateString('sv-SE');
const isMail = t.session_type === 'message';
const typeIcon = isMail ? UI_ICONS.MAIL : UI_ICONS.CHAT;
const displayTitle = esc(resolveTicketTitle(t));
const previewText = stripHtml(t.last_message || "Ingen text...");
const tagText = t.routing_tag ? resolveLabel(t.routing_tag) : (t.owner ? resolveLabel(t.owner) : (isMail ? 'MAIL' : 'CHATT'));
const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color:${styles.main}; display:flex; align-items:center; opacity:0.9;" title="${t.vehicle}">${vIcon}</span>` : '';

card.className = 'team-ticket-card';
card.setAttribute('data-id', t.conversation_id);
// KIRURGISK FIX: Uppdatera båda variablerna och tvinga kanten direkt
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
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
<div class="ticket-preview">${previewText}</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${dateStr} • ${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="claim-mini-btn claim-action" title="Plocka ärende" style="color:${styles.main}">
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
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id, agentName: currentUser.username })
});
showToast('✅ Ärendet är nu ditt!');
renderInbox();
const searchEl = document.getElementById('inbox-search');
if (searchEl) searchEl.value = '';
};

content.appendChild(card);
});

// 2. APPEND CONTENT (Samma plats som i din kod)
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
// 2. DETALJVY FÖR INKORG (FIXAD: OPTIMISTISK STÄNGNING)
// ============================================================================
function openInboxDetail(ticket) {
const detailView = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');

if (!detailView || !placeholder) return;

placeholder.style.display = 'none';
detailView.style.display = 'flex';
detailView.setAttribute('data-current-id', ticket.conversation_id);

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
topActionBtn += `<button class="action-icon-btn" id="detail-assign-btn" title="Tilldela ärende">${UI_ICONS.ASSIGN}</button>`;
}
if (!ticket.owner) {
topActionBtn += `<button class="action-icon-btn" id="detail-claim-btn" title="Plocka ärende">${UI_ICONS.CLAIM}</button>`;
} else if (ticket.owner && !isMine) {
topActionBtn += `<button class="action-icon-btn danger" id="detail-takeover-btn" title="Ta över från ${ticket.owner}">${UI_ICONS.TAKE_OVER}</button>`;
}

if (topActionBtn) topActionBtn = `<div style="display:flex; gap:8px; align-items:center; justify-content:flex-end;">${topActionBtn}</div>`;

let bodyContent = '';
const formatTime = (ts) => (!ts) ? '' : new Date(ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

if (ticket.session_type === 'message') {
const messages = ticket.messages || [];
let mailHistoryHtml = '';

if (messages.length === 0) {
mailHistoryHtml = '<div style="padding:40px; opacity:0.5; text-align:center;">Ingen historik ännu.</div>';
} else {
messages.forEach(m => {
const isUser = m.role === 'user';
const clean = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
const timeStr = m.timestamp ? formatTime(m.timestamp) : '';
const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleDateString('sv-SE') : '';

if (isUser) {
const avatarInitial = mainTitle ? mainTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${styles.main}; color:white; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; margin-right:12px; flex-shrink:0;">${avatarInitial}</div>`;
mailHistoryHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
${userAvatar}
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-left:2px;"><b>${mainTitle || 'Kund'}</b> • ${dateStr} ${timeStr}</div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important; padding:15px; border-radius:12px;">
${formatAtlasMessage(clean)}
</div>
</div>
</div>`;
} else {
mailHistoryHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-right:2px;">Atlas • ${timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:15px; border-radius:12px;">
${formatAtlasMessage(clean)}
</div>
</div>
<div class="msg-avatar" style="background:#3a3a3c; margin-left:12px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0; font-size:18px;">🤖</div>
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
const atlasAvatar = `<div class="msg-avatar" style="background:#3a3a3c; margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">🤖</div>`;
const userInitial = mainTitle ? mainTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${styles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${userInitial}</div>`;
const timeStr = m.timestamp ? formatTime(m.timestamp) : '';
const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleDateString('sv-SE') : '';

if (isUser) {
chatHistoryHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
${userAvatar}
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-left:2px;"><b>${mainTitle || 'Kund'}</b> • ${dateStr} ${timeStr}</div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important; padding:10px 14px; border-radius:12px;">
${formatAtlasMessage(m.content || m.text).trim()}
</div>
</div>
</div>`;
} else {
chatHistoryHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-right:2px;">Atlas • ${timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:10px 14px; border-radius:12px;">
${formatAtlasMessage(m.content || m.text).trim()}
</div>
</div>
${atlasAvatar}
</div>`;
}
});
}

bodyContent = `<div class="inbox-chat-history" style="padding:10px 5px;">${chatHistoryHtml}</div>`;
}

// Villkor för Snabbsvar: admin/agent + chattärende (customer) + ej plockat
const canQuickReply = ['admin', 'agent'].includes(currentUser?.role)
&& ticket.session_type === 'customer';

const content = document.createElement('div');
content.className = 'detail-container';
content.innerHTML = `
${renderDetailHeader(ticket, styles, topActionBtn)}
<div class="detail-body scroll-list" id="inbox-detail-body">
${bodyContent}
</div>
${canQuickReply ? `
<div id="quick-reply-area" style="padding:8px 16px; border-top:1px solid ${styles.border}; background:${styles.bg}; display:flex; align-items:flex-end; gap:8px;">
<textarea id="quick-reply-input" placeholder="Snabbsvar... (Ctrl+Enter)"
style="flex:1; min-height:44px; max-height:120px; resize:vertical; padding:8px 10px; border-radius:8px;
background:rgba(255,255,255,0.07); border:1px solid ${styles.border};
color:var(--text-primary); font-size:13px; font-family:inherit; box-sizing:border-box;"></textarea>
<button id="btn-quick-reply-send" title="Skicka svar" style="flex-shrink:0; width:36px; height:36px; border-radius:8px;
background:${styles.main}; color:white; border:none; cursor:pointer;
display:flex; align-items:center; justify-content:center;">
${UI_ICONS.SEND}
</button>
</div>` : ''}
<div class="detail-footer-area">
<div class="detail-footer-toolbar" style="padding: 12px 20px; border-top:1px solid var(--border-color); background:rgba(0,0,0,0.25); display:flex; justify-content:flex-end; gap:12px;">
<button class="footer-icon-btn btn-archive-red" id="btn-archive" title="Arkivera">${UI_ICONS.ARCHIVE}</button>
<button class="footer-icon-btn danger" id="btn-delete" title="Ta bort permanent">${UI_ICONS.TRASH}</button>
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
const quickReply = async () => {
const input = document.getElementById('quick-reply-input');
const msg = (input?.value || '').trim();
if (!msg) return;
const qrBtn = document.getElementById('btn-quick-reply-send');
if (qrBtn) { qrBtn.disabled = true; qrBtn.style.opacity = '0.5'; }
try {
// 1. Claima ärendet (flyttar det till Mina Ärenden)
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST', headers: fetchHeaders,
body: JSON.stringify({ conversationId: ticket.conversation_id, agentName: currentUser.username })
});
// 2. Skicka svaret via socket
window.socketAPI.emit('team:agent_reply', {
conversationId: ticket.conversation_id,
message: msg
});
// Stäng detail + ladda om inkorg (ärendet försvinner dit — det är nu i Mina Ärenden)
clearDetailView();
renderInbox();
renderMyTickets?.();
showToast('✅ Svar skickat! Ärendet ligger i Mina Ärenden.');
} catch(err) {
console.error('[QuickReply] Fel:', err);
showToast('❌ Fel vid skicka — försök igen.');
if (qrBtn) { qrBtn.disabled = false; qrBtn.style.opacity = '1'; }
}
};
const qrBtn = document.getElementById('btn-quick-reply-send');
if (qrBtn) qrBtn.onclick = quickReply;
const qrInput = document.getElementById('quick-reply-input');
if (qrInput) qrInput.addEventListener('keydown', (e) => {
if (e.ctrlKey && e.key === 'Enter') quickReply();
});
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
if (window.electronAPI) {
await window.atlasTeam.claimTicket(ticket.conversation_id, currentUser.username);
} else {
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: ticket.conversation_id })
});
}
const toastMsg = action === 'takeover' ? '✅ Du har tagit över ärendet!' : '✅ Ärendet är nu ditt!';
showToast(toastMsg);
renderInbox();
updateInboxBadge();
} catch (err) {
console.error("Fel vid claim:", err);
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
showToast('✅ Ärendet arkiverat!');
renderInbox();
} catch (err) {
console.error("Fel vid arkivering:", err);
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

showToast("✅ Ärendet raderat");

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
console.error("Fel vid radering:", err);
showToast("❌ Kunde inte radera ärendet");
}
}
};
}
}
