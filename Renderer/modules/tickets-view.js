// ============================================
// modules/tickets-view.js
// VAD DEN GÖR: Mina ärenden — rendering och
//              detaljvy för agentens egna ärenden
// ANVÄNDS AV: renderer.js
// ============================================
//
// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║    KRITISK VARNING — FÄRG- OCH ROUTING-LOGIK                ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  FÄRGSYSTEMET I ATLAS ÄR GENOMTÄNKT OCH TESTAT.             ║
// ⚠️  ║  ÄNDRA INGENTING NEDAN UTAN ATT LÄSA HELA DETTA BLOCK.      ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  REGEL 1 — isInternal-CHECK (ÄNDRA INTE):                  ║
// ⚠️  ║                                                              ║
// ⚠️  ║   session_type === 'internal'  → agent skickade internt     ║
// ⚠️  ║   routing_tag  === 'INTERNAL'  → legacy-flagga (backup)     ║
// ⚠️  ║   _isLocal     === true        → lokal IPC-post (Electron)  ║
// ⚠️  ║                                                              ║
// ⚠️  ║  Alla tre fall → gul färg (#f1c40f). Det är DESIGN.        ║
// ⚠️  ║  Gult signalerar internt/privat för agenten. Ändra inte.    ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  REGEL 2 — FÄRGPRIORITET FÖR ICKE-INTERNA ÄRENDEN:         ║
// ⚠️  ║                                                              ║
// ⚠️  ║   getAgentStyles(t.routing_tag || t.owner || myName)        ║
// ⚠️  ║                                                              ║
// ⚠️  ║   routing_tag → kontorets färg  (starkaste källan)          ║
// ⚠️  ║   owner       → agentens personliga färg (fallback)         ║
// ⚠️  ║   myName      → inloggad agents färg (sista fallback)       ║
// ⚠️  ║                                                              ║
// ⚠️  ║   ❌ Lägg INTE till owner-logik i kontorets ställe.         ║
// ⚠️  ║   ❌ Byt INTE ordning — routing_tag MÅSTE vara först.       ║
// ⚠️  ║   ❌ Ta INTE bort || myName — det förhindrar att ärenden    ║
// ⚠️  ║      utan kontor/ägare hamnar i "unclaimed"-röd.            ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  REGEL 3 — BUBBLEFÄRGER I DETALJVYN:                       ║
// ⚠️  ║                                                              ║
// ⚠️  ║   Interna ärenden:                                          ║
// ⚠️  ║     VÄNSTER (avsändare): internalSenderStyles               ║
// ⚠️  ║       = getAgentStyles(ticket.sender || '')                 ║
// ⚠️  ║     HÖGER  (ägare/mottagare): internalOwnerStyles           ║
// ⚠️  ║       = getAgentStyles(ticket.owner || currentUser.username) ║
// ⚠️  ║                                                              ║
// ⚠️  ║   Vanliga ärenden (chatt + mail):                           ║
// ⚠️  ║     ALLA bubblor → styles (ärendets temafärg)               ║
// ⚠️  ║   ❌ Använd INTE getAgentStyles(m.sender) för vanliga        ║
// ⚠️  ║      ärenden — m.sender är ofta undefined och ger fel.      ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  REGEL 4 — MAILÄRENDEN (isMail = session_type 'message'):   ║
// ⚠️  ║                                                              ║
// ⚠️  ║   Mail-blocket (if isMail) är SEPARAT från chat-blocket.    ║
// ⚠️  ║   Mail-bubblorna använder alltid styles.main/.bubbleBg/.    ║
// ⚠️  ║   border — aldrig internalSenderStyles/internalOwnerStyles. ║
// ⚠️  ║                                                              ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝
// Beroenden (löses vid anropstid):
//   State, DOM, currentUser, isBulkMode,           — renderer.js globals
//   selectedTicketIds, SERVER_URL, fetchHeaders     — renderer.js globals
//   getAgentStyles, resolveLabel, formatName,       — styling-utils.js
//   showToast, stripHtml
//   resolveTicketTitle                              — chat-engine.js
//   UI_ICONS                                        — ui-constants.js
//   getVehicleIcon, formatAtlasMessage,             — renderer.js
//   renderDetailHeader, refreshNotesGlow,           — renderer.js
//   atlasConfirm, atlasPrompt, checkAndResetDetail, — renderer.js
//   handleEmailTemplateReply                        — renderer.js
//   toggleBulkCard, showBulkToolbar                 — bulk-ops.js
//   openNotesModal                                  — notes-system.js
//   updateInboxBadge                                — inbox-view.js
//   window.electronAPI.deleteQA                     — ipc-bridges.js
//   window.socketAPI                                — renderer.js
// ============================================

// ============================================================================
// MINA ÄRENDEN: LISTA
// ============================================================================
async function renderMyTickets() {
// 🛡️ SÄKERHETSSPÄRR
if (!DOM.myTicketsList) return;

// Vi använder cachen istället för getElementById
const container = DOM.myTicketsList;

try {
const res = await fetch(`${SERVER_URL}/team/my-tickets?t=${Date.now()}`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte hämta ärenden");
const data = await res.json();
let tickets = data.tickets || [];
tickets.sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));

// Filtrera till agentens egna ärenden + kontorsärenden
if (window.currentUser && window.currentUser.username) {
const myName = window.currentUser.username.toLowerCase();

// Agentens bevakade kontor-taggar (från token/localStorage)
const myOfficeTags = (window.currentUser.routing_tag || '')
.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

// TILLÅT OM: Jag är personlig ägare ELLER kontoret tillhör mig ELLER avsändare (interna)
tickets = tickets.filter(t => {
if (t.owner && t.owner.toLowerCase() === myName) return true;
if (t.sender && t.sender.toLowerCase() === myName) return true;
if (t.routing_tag && myOfficeTags.includes(t.routing_tag.toLowerCase()) && !t.owner) return true;
return false;
});
}

if (tickets.length > 0) {
const existingPlaceholder = container.querySelector('.template-item-empty');
if (existingPlaceholder) existingPlaceholder.remove();
}

// Städpatrull: Ta bort kort som inte längre ska finnas i listan (arkiverade etc)
const ticketIds = tickets.map(t => t.conversation_id);
Array.from(container.children).forEach(card => {
const id = card.getAttribute('data-id');
if (id && !ticketIds.includes(id)) card.remove();
});

// 🧹 STÄDPATRULL (Totalrensar om ärendet inte längre är ditt)
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');
const currentId = detail?.getAttribute('data-current-id');

if (detail && placeholder) {
if (!currentId) {
detail.innerHTML = ''; 
detail.style.display = 'none';
placeholder.style.display = 'flex';
} else {
const stillMine = tickets.find(t => t.conversation_id === currentId);
if (!stillMine) {
console.log("🧹 Ärendet borta - totalrensar Mina Ärenden-vyn.");
detail.innerHTML = '';
detail.style.display = 'none';
detail.removeAttribute('data-current-id');
placeholder.style.display = 'flex';
}
}
}


if (tickets.length === 0) {
container.innerHTML = `
<div class="template-item-empty" style="padding:40px; text-align:center; opacity:0.6;">
<div style="margin-bottom:15px; opacity: 0.3;">
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
</div>
<div>Du har inga pågående ärenden.</div>
</div>`;
return;
}

tickets.forEach((t, index) => {
const myName = currentUser.username;

// ⚠️ LOCK — isInternal: Avgör om ärendet är privat/internt (se filhuvudet för regler)
// ❌ ÄNDRA INTE ordningen eller villkoren — alla tre fall måste täckas.
const isInternal = (t.session_type === 'internal' || t.routing_tag === 'INTERNAL');

// ⚠️ LOCK — styles: getAgentStyles(routing_tag || owner || myName)
// routing_tag = kontorsfärg (starkast) → owner = agentfärg → myName = sista fallback
// Interna ärenden: alltid hårdkodat gul (#f1c40f) — ÄNDRA INTE hex-värdet.
// ❌ Byt INTE ordning på routing_tag/owner/myName — routing_tag MÅSTE prövas först.
const styles = isInternal ? { main: '#f1c40f', bg: 'transparent', border: 'rgba(241,196,15,0.3)', bubbleBg: 'rgba(241,196,15,0.15)' } : getAgentStyles(t.routing_tag || t.owner || myName);

// ⚠️ LOCK — tagText: Visa kontorets korta namn (routing_tag) på kortet.
// Interna ärenden: visa avsändarens visningsnamn istf kontoret.
// resolveLabel() slår upp routing_tag → area/city → förkortat displaynamn.
// ❌ Använd INTE t.owner direkt som tag — det är agentnamnet, inte kontorets namn.
const tagText = (t.session_type === 'internal')
? (() => { const u = usersCache.find(u => u.username === (t.sender || t.owner)); return (u?.display_name || t.sender || t.owner || 'INTERN').toUpperCase(); })()
: resolveLabel(t.routing_tag || t.owner || myName);

const isMail = t.session_type === 'message';
const typeIcon = isMail ? `${UI_ICONS.MAIL}` : `${UI_ICONS.CHAT}`;
let displayTitle = resolveTicketTitle(t);

if (t.session_type === 'internal' && t.sender) {
displayTitle = (typeof formatName === 'function') ? formatName(t.sender) : t.sender;
}

// Hämtar text från context_data
let myRawPreview = t.last_message || t.question || t.subject;
if (!myRawPreview && t.context_data) {
try {
const ctx = typeof t.context_data === 'string' ? JSON.parse(t.context_data) : t.context_data;
if (ctx.messages && ctx.messages.length > 0) {
myRawPreview = ctx.messages[0].content || ctx.messages[0].text;
}
} catch(e) {}
}
const isPrivateTicket = t.session_type === 'internal';
const myPreviewText = isPrivateTicket
? `<span style="color:#f1c40f; display:flex; align-items:center; gap:4px;">${UI_ICONS.LOCK} Privat ärende</span>`
: stripHtml(myRawPreview || "...");

const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color: ${styles.main}; display: flex; align-items: center; opacity: 0.9;" title="${t.vehicle}">${vIcon}</span>` : '';
const timeStr = new Date(t.updated_at * 1000).toLocaleString('sv-SE', { 
year: 'numeric', month: 'numeric', day: 'numeric', 
hour: '2-digit', minute: '2-digit' 
});

// Kolla om kortet redan finns, annars skapa det
let card = container.querySelector(`.team-ticket-card[data-id="${t.conversation_id}"]`);
const isNew = !card;

if (isNew) {
card = document.createElement('div');
card.className = `team-ticket-card mine${isInternal ? ' internal-ticket' : ''}`;
card.setAttribute('data-id', t.conversation_id);
card.setAttribute('data-owner', (t.owner || '').toUpperCase());
}

// Tvinga uppdatering av färg och kant vid varje rendering (Dubbel-säkrad för alla vyer)
card.style.borderLeft = `4px solid ${styles.main}`;
card.style.setProperty('--agent-color', styles.main);
card.style.setProperty('--atp-color', styles.main);

if (currentId === t.conversation_id) {
card.classList.add('active-ticket');
}

card.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title">
<span style="opacity:0.7; margin-right:4px; display:flex; align-items:center;">${typeIcon}</span>
<span style="color:${styles.main}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right">
${vehicleHtml}
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
${!isInternal ? `<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Vidarebefordra till kollega" style="color:${styles.main}" onclick="event.stopPropagation(); showAssignModal({conversation_id: '${t.conversation_id}'})"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>` : ''}
</div>
</div>
<div class="ticket-preview">${myPreviewText}</div>

<div class="ticket-footer-bar">
<div class="ticket-time">${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="mini-action-btn archive-action" title="Arkivera till Garaget" style="color:${styles.main}" onclick="event.stopPropagation(); archiveTicket('${t.conversation_id}')">
${UI_ICONS.ARCHIVE}
</button>`;

card.onclick = () => {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
card.classList.add('active-ticket');
openMyTicketDetail(t);
};

const btn = card.querySelector('.archive-action');
if(btn) {
btn.onclick = async (e) => {
e.stopPropagation();
try {
const archRes = await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id })
});
if (!archRes.ok) throw new Error('Arkivering nekad');
const customerName = resolveTicketTitle(t);
const ticketRef = `#${String(t.conversation_id).slice(-6)}`;
showToast(`✅ Ärendet från ${customerName} ${ticketRef} arkiverat!`);
if (window.NotifSystem) window.NotifSystem.addNotif(`Ärendet från ${customerName} ${ticketRef} arkiverat`);
checkAndResetDetail('my-ticket-detail', t.conversation_id);
renderMyTickets();
} catch(err) {
console.error("Arkiveringsfel:", err);
}
};
}

// Placera kortet på rätt plats enligt sortering
if (container.children[index] !== card) {
container.insertBefore(card, container.children[index]);
} else if (!card.parentNode) {
container.appendChild(card);
}

// 🔥 Sätt notes-glow på kortet om anteckningar finns
if (typeof refreshNotesGlow === 'function') {
refreshNotesGlow(t.conversation_id);
}
});

} catch (err) {
console.error("Mina ärenden fel:", err);
container.innerHTML = '<div class="template-item-empty" style="color:#ff6b6b">Kunde inte ladda listan.</div>';

// Återställ och RENSA vyer vid fel
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');
if (detail && placeholder) {
detail.innerHTML = ''; // Rensa!
detail.style.display = 'none';
placeholder.style.display = 'flex';
detail.removeAttribute('data-current-id');
}
}
}

// =========================================================
// MINA ÄRENDEN — DETALJVY
// =========================================================
function openMyTicketDetail(ticket) {
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');

if (!detail || !placeholder) return;

placeholder.style.display = 'none';
detail.style.display = 'flex';
detail.setAttribute('data-current-id', ticket.conversation_id);

// ⚠️ LOCK — DETALJVYNS FÄRGLOGIK (ÄNDRA INTE UTAN ATT LÄSA FILHUVUDET)
//
// isInternal: inkluderar _isLocal för att lokala IPC-poster (Electron) också blir gula.
// I detaljvyn är det EXTRA viktigt: _isLocal finns inte i server-data men kan sättas
// av archive-view.js på lokala poster — ändra aldrig utan att kontrollera båda ställen.
// ❌ Ta INTE bort || ticket._isLocal — det bryter färgvisning för lokala Electron-poster.
const isInternal = (ticket.session_type === 'internal' || ticket.routing_tag === 'INTERNAL' || ticket._isLocal);

const internalYellow = {
main: '#f1c40f',
bg: 'transparent',
border: 'rgba(241, 196, 15, 0.3)',
bubbleBg: 'rgba(241, 196, 15, 0.15)'
};

// ⚠️ LOCK — styles för detaljvyn: routing_tag || owner (ingen myName-fallback här)
// Skillnad mot kortvyn: här används INTE || myName som sista fallback.
// Det är avsiktligt — detaljvyn skall inte visa inloggad agents färg på andras ärenden.
// ❌ Lägg INTE till || currentUser.username eller liknande som extra fallback.
let styles = isInternal ? internalYellow : getAgentStyles(ticket.routing_tag || ticket.owner);

detail.classList.add('template-editor-container');
detail.setAttribute('data-owner', ticket.owner || 'unclaimed');

// HÄR DÖDAR VI LINJERNA HELT
detail.style.setProperty('border-top', 'none', 'important');
detail.style.setProperty('border-bottom', 'none', 'important');
detail.style.setProperty('background', 'none', 'important');
detail.style.setProperty('box-shadow', 'none', 'important');

detail.innerHTML = '';

// 2. Förbered data
const displayTitle = resolveTicketTitle(ticket);
const isMail = ticket.session_type === 'mail' || ticket.session_type === 'message' || ticket.routing_tag === 'MAIL';

// --- CHATT / MAIL ---
let bodyContent = '';

if (isMail) {
const messages = ticket.messages || [];

if (messages.length === 0) {
const raw = ticket.last_message || ticket.content || "Inget innehåll...";
const clean = raw.replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
bodyContent = `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;">
<div class="msg-avatar" style="background:${styles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">K</div>
<div style="display:flex; flex-direction:column; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px;"><b>Inkommet Mail</b></div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
</div>`;
} else {
messages.forEach(m => {
const isUser = m.role === 'user';
const clean = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');

bodyContent += `
<div class="msg-row ${isUser ? 'user' : 'atlas'}" style="display:flex; width:100%; margin-bottom:12px; justify-content:${isUser ? 'flex-start' : 'flex-end'};">
${isUser ? `<div class="msg-avatar" style="background:${styles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">K</div>` : ''}
<div class="bubble" style="background: ${isUser ? styles.bubbleBg : 'rgba(255,255,255,0.05)'} !important; border: 1px solid ${isUser ? styles.border : 'rgba(255,255,255,0.1)'} !important; color: var(--text-primary) !important; max-width:75%;">${formatAtlasMessage(clean)}</div>
${!isUser ? '<div class="msg-avatar" style="background:#3a3a3c; margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%;">🤖</div>' : ''}
</div>`;
});
}
} else {
// --- CHATT (MINA ÄRENDEN) ---
const messages = ticket.messages || [];

// ⚠️ LOCK — BUBBLEFÄRGER FÖR INTERNA ÄRENDEN
// Interna ärenden: varje agent får sin personliga färg på sina bubblor.
//   internalSenderStyles = avsändarens agentfärg (vänster bubbla)
//   internalOwnerStyles  = ägarens/mottagarens agentfärg (höger bubbla)
// För icke-interna ärenden: båda är null → senderStyles = styles (ärendets temafärg).
// ❌ Använd INTE getAgentStyles(m.sender) för icke-interna ärenden —
//    m.sender är undefined på kundmeddelanden och ger fel "unclaimed"-röd färg.
const internalSenderStyles = isInternal ? getAgentStyles(ticket.sender || '') : null;
const internalOwnerStyles  = isInternal ? getAgentStyles(ticket.owner  || currentUser.username) : null;

messages.forEach(m => {
const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
const dateStrMsg = m.timestamp ? new Date(m.timestamp).toLocaleDateString('sv-SE') : '';

let isUser = (m.role === 'user');
let rowDisplayTitle = displayTitle;

if (isInternal) {
if (m.sender && m.sender.toLowerCase() !== currentUser.username.toLowerCase()) {
isUser = true;
rowDisplayTitle = (typeof formatName === 'function') ? formatName(m.sender) : m.sender;
} else {
isUser = false;
}
}

// ⚠️ LOCK — senderStyles: ALLTID styles för icke-interna ärenden.
// ❌ Använd INTE getAgentStyles(m.sender) här — bryter färg för kundchattar.
// ❌ Skilj INTE på isUser=true/false för icke-interna — båda skall ha styles.
const senderStyles = isInternal ? internalSenderStyles : styles;
const leftInitial = rowDisplayTitle ? rowDisplayTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${senderStyles.main}; color:black; font-weight:800; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${leftInitial}</div>`;

let rightAvatarContent = '🤖';
let rightAvatarStyle = 'background:#3a3a3c;';

if (isInternal && !isUser) {
rightAvatarContent = (typeof formatName === 'function' ? formatName(ticket.owner || currentUser.username) : (ticket.owner || currentUser.username)).charAt(0).toUpperCase();
rightAvatarStyle = `background:${internalOwnerStyles.main}; color:black; font-weight:800;`;
}

const atlasAvatar = `<div class="msg-avatar" style="${rightAvatarStyle} margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${rightAvatarContent}</div>`;
const content = formatAtlasMessage(m.text || m.content || "").trim();

if (isUser) {
bodyContent += `<div class="msg-row user" style="display:flex; width:100% !important; margin-bottom:12px; justify-content:flex-start;">${userAvatar}<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:75%;"><div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-left:4px;"><b>${rowDisplayTitle || 'Kund'}</b> • ${dateStrMsg} ${time}</div><div class="bubble" style="background:${senderStyles.bubbleBg} !important; border:1px solid ${senderStyles.border} !important; color:var(--text-primary) !important;">${content}</div></div></div>`;
} else {
const senderLabel = isInternal ? (typeof formatName === 'function' ? formatName(ticket.owner || currentUser.username) : (ticket.owner || currentUser.username)) : 'Atlas';
const rightBubbleStyles = (isInternal && internalOwnerStyles) ? internalOwnerStyles : styles;
bodyContent += `<div class="msg-row atlas" style="display:flex; width:100% !important; margin-bottom:12px; justify-content:flex-end;"><div style="display:flex; flex-direction:column; align-items:flex-end; max-width:75%;"><div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-right:4px;">${senderLabel} • ${time}</div><div class="bubble" style="background:${rightBubbleStyles.bubbleBg} !important; border:1px solid ${rightBubbleStyles.border} !important; color:var(--text-primary) !important;">${content}</div></div>${atlasAvatar}</div>`;
}
});
}

const typingText = isInternal ? '✍️ Kollegan skriver...' : '✍️ Kunden skriver...';
bodyContent += `<div id="typing-indicator-${ticket.conversation_id}" style="display:none; padding:5px 15px; font-size:12px; color:${styles.main}; font-style:italic; margin-top:5px; text-align:left;">${typingText}</div>`;

let templateOptions = `<option value="">📋 Välj mall att kopiera...</option>`;
if (State.templates) {
State.templates.forEach(t => { templateOptions += `<option value="${t.id}">${t.title}</option>`; });
}

const msgs = ticket.messages || [];
const totalChars = msgs.reduce((acc, m) => acc + (m.content || m.text || '').length, 0);
const isLongEnough = msgs.length >= 5 || totalChars >= 400;

// 📝 Hämta displayName för ägarens placeholder-text
const ownerDisplayName = (ticket.owner && ticket.owner !== currentUser.username)
? (typeof usersCache !== 'undefined' && usersCache.find(u => u.username === ticket.owner)?.display_name) || ticket.owner
: null;

const contentBox = document.createElement('div');
contentBox.className = 'detail-container';
contentBox.innerHTML = `
${renderDetailHeader(ticket, styles)}
${isLongEnough ? `
<div id="ticket-summary-panel" style="display:none; margin:0 20px 12px; padding:12px 16px;
border-radius:8px; background:${styles.main}11; border:1px solid ${styles.border};
font-size:13px; line-height:1.6; color:var(--text-secondary);">
<span style="font-size:11px; font-weight:600; color:${styles.main}; text-transform:uppercase;
letter-spacing:0.5px; display:block; margin-bottom:6px;">AI Sammanfattning</span>
<span id="ticket-summary-text"></span>
</div>` : ''}
<div class="detail-body scroll-list" id="my-chat-scroll-area">
${bodyContent}
</div>
<div class="detail-footer-area">
<form id="my-ticket-chat-form">
<textarea id="my-ticket-chat-input" placeholder="${ticket.is_archived ? 'Ärendet är arkiverat' : ownerDisplayName ? `Svar tar över från ${ownerDisplayName}... (Ctrl+Enter)` : 'Skriv ett meddelande...'}" ${ticket.is_archived ? 'disabled' : ''}></textarea>
<button type="submit" id="${isMail ? 'btn-send-mail-action' : 'btn-reply-action'}" class="send-button-ticket">
${UI_ICONS.SEND}
</button>
</form>
${!ticket.is_archived ? '<p style="font-size:10px; opacity:0.3; text-align:right; padding:2px 20px 6px; margin:0; color:var(--text-secondary);">Enter skickar · Shift+Enter ny rad</p>' : ''}
<div style="display:flex; justify-content: space-between; align-items:center; padding: 0 20px 15px 20px;">
<div style="flex:1; max-width:60%;"><select id="quick-template-select" class="filter-select">${templateOptions}</select></div>
<div style="display:flex; gap:10px;">
${!ticket.is_archived ? `<button type="button" class="footer-icon-btn" id="btn-ai-draft" title="AI Förslag">${UI_ICONS.AI}</button>` : ''}
${isLongEnough ? `<button type="button" class="footer-icon-btn" id="btn-summarize" title="AI Sammanfattning">${UI_ICONS.SPARKLES}</button>` : ''}
<button type="button" class="footer-icon-btn btn-archive-red" id="btn-archive-my" title="Arkivera">${UI_ICONS.ARCHIVE}</button>
<button type="button" class="footer-icon-btn danger" id="btn-delete-my" title="Radera">${UI_ICONS.TRASH}</button>
</div>
</div>
</div>
`;

detail.style.padding = '0';
detail.style.background = 'transparent';
detail.innerHTML = '';
detail.appendChild(contentBox);

refreshNotesGlow(ticket.conversation_id);

const scrollArea = document.getElementById('my-chat-scroll-area');
if (scrollArea) {
scrollArea.style.scrollBehavior = 'auto';
scrollArea.scrollTop = scrollArea.scrollHeight; // Scrolla till botten direkt
scrollArea.setAttribute('data-auto-scroll', 'true');
}

if (!isMail) {
const chatInput = document.getElementById('my-ticket-chat-input');
let typingTimer;
if (chatInput) {
chatInput.addEventListener('input', () => {
window.socketAPI.emit('team:agent_typing', { sessionId: ticket.conversation_id, is_typing: true });
clearTimeout(typingTimer);
typingTimer = setTimeout(() => {
window.socketAPI.emit('team:agent_typing', { sessionId: ticket.conversation_id, is_typing: false });
}, 2500);
});
setTimeout(() => chatInput.focus(), 50);
}
}

attachMyTicketListeners(ticket, isMail);
}

// =========================================================
// KNAPPAR & LYSSNARE
// =========================================================
function attachMyTicketListeners(ticket, isMail) {

// Variabel för att spara mallens "snygga" HTML (med bilder/fetstil) i bakgrunden
let activeTemplateHtml = null;

// Hjälpfunktion: Quill HTML → ren text med bevarade radbrytningar
// Använder regex istf innerText (detached divs tappar block-element \n i Electron)
function templateHtmlToText(html) {
return (html || '')
.replace(/<br\s*\/?>/gi, '\n')
.replace(/<\/p>/gi, '\n').replace(/<p[^>]*>/gi, '')
.replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '')
.replace(/<[^>]+>/g, '')
.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
.replace(/\n{3,}/g, '\n\n')
.trim();
}

// 1. VÄLJ MALL -> SPARA HTML & VISA TEXT
const tSelect = document.getElementById('quick-template-select');
if (tSelect) {
tSelect.onchange = () => {
const tId = tSelect.value;
if (!tId) return;
const t = State.templates.find(x => x.id == tId);

if (t) {
const inp = document.getElementById('my-ticket-chat-input');
if (inp) {
// Spara original-HTML (med bilder etc) i minnet
activeTemplateHtml = t.content;

// Visa ren text med bevarade radbrytningar i rutan
inp.value = templateHtmlToText(t.content);
inp.focus();

// Trigga resize utan att trigga isTrusted-lyssnaren (programmatiska events har isTrusted=false)
inp.dispatchEvent(new Event('input'));

tSelect.value = "";
}
}
};
}

// Lyssna om du ändrar texten MANUELLT (isTrusted=false för programmatiska events — skyddar mallens HTML)
const inpField = document.getElementById('my-ticket-chat-input');
if (inpField) {
inpField.addEventListener('input', (e) => {
if (e.isTrusted) {
activeTemplateHtml = null;
}
});
}

// Enter skickar, Shift+Enter ny rad
const chatInpKb = document.getElementById('my-ticket-chat-input');
if (chatInpKb && !ticket.is_archived) {
chatInpKb.addEventListener('keydown', (e) => {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
chatInpKb.closest('form')?.requestSubmit();
}
});
}

// 2. SKICKA-KNAPPEN
const form = document.getElementById('my-ticket-chat-form');
if(form) {
form.onsubmit = (e) => {
e.preventDefault();
const inp = document.getElementById('my-ticket-chat-input');
const msg = inp.value.trim();
if(!msg) return;

if (isMail) {

// SKICKA MAIL (mall-HTML om vald, annars konvertera radbrytningar till <br>)
window.socketAPI.emit('team:send_email_reply', {
conversationId: ticket.conversation_id,
message: msg,
html: activeTemplateHtml || msg.replace(/\n/g, '<br>'),
customerEmail: ticket.contact_email || '',
subject: ticket.subject || 'Svar'
});

// Tillfälligt inaktivera knappen
const btn = form.querySelector('button[type="submit"]');
btn.disabled = true;
setTimeout(() => { btn.disabled = false; }, 2000);

} else {

// SKICKA CHATT
window.socketAPI.emit('team:agent_reply', { 
conversationId: ticket.conversation_id, 
message: msg 
});
}
inp.value = '';
activeTemplateHtml = null; // Nollställ
};
}

// AI Förslag
const btnAI = document.getElementById('btn-ai-draft');
if (btnAI) {
btnAI.onclick = () => {
const inp = document.getElementById('my-ticket-chat-input');
if (!inp) return;
// Mail: första meddelandet. Chatt: sista kund-meddelandet.
let originalMsg = '';
if (isMail) {
originalMsg = ticket.messages?.[0]?.content || ticket.last_message || '';
} else {
const lastUser = [...(ticket.messages || [])].reverse().find(m => m.role === 'user');
originalMsg = lastUser?.content || ticket.last_message || '';
}
if (!originalMsg) { showToast('Ingen kundtext att basera förslag på.'); return; }
inp.value = '🤖 Tänker så det knakar... (Hämtar AI-svar)';
inp.disabled = true;
window.socketAPI.emit('team:email_action', {
conversationId: ticket.conversation_id,
action: 'draft',
content: originalMsg
});
};
}

// 3b. AI Sammanfattning
const btnSum = document.getElementById('btn-summarize');
if (btnSum) {
btnSum.onclick = () => {
btnSum.disabled = true;
const panel = document.getElementById('ticket-summary-panel');
const txt = document.getElementById('ticket-summary-text');
if (panel && txt) { panel.style.display = 'block'; txt.textContent = '🤖 Sammanfattar...'; }
window.socketAPI.emit('team:summarize_ticket', {
conversationId: ticket.conversation_id,
messages: ticket.messages || []
});
};
}

// 4. Arkivera (Direkt utan bekräftelsepopup — toast visas istället)
const btnArch = document.getElementById('btn-archive-my');
if(btnArch) btnArch.onclick = async () => {
await archiveTicketFromMyTickets(ticket.conversation_id);
};

const btnDel = document.getElementById('btn-delete-my');
if(btnDel) {
btnDel.onclick = async () => {
if (await atlasConfirm('Ta bort', 'Är du säker? Detta raderar ärendet permanent från databasen.')) {

// UI-Reset
checkAndResetDetail('my-ticket-detail');

try {
// 1. Radera på Servern (MASTER DELETE)
await fetch(`${SERVER_URL}/api/inbox/delete`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: ticket.conversation_id })
});

// 2. Radera lokalt om Electron
if (window.electronAPI) {
// Vi använder ticket.id eller conversation_id
const idToDelete = ticket.id || ticket.conversation_id;
if(idToDelete) await window.electronAPI.deleteQA(idToDelete).catch(e => console.log("Lokal städning ej nödvändig"));
}

const customerName = resolveTicketTitle(ticket);
const ticketRef = `#${String(ticket.conversation_id).slice(-6)}`;
showToast(`✅ Ärendet från ${customerName} ${ticketRef} raderat`);
if (window.NotifSystem) window.NotifSystem.addHistory('🗑️', `Ärendet från ${customerName} ${ticketRef} raderades`);

// 4. Ta bort från UI utan att göra full refresh
const listContainer = document.getElementById('my-tickets-list');
if (listContainer) {
const cards = listContainer.querySelectorAll('.team-ticket-card');
cards.forEach(card => {
if (card.getAttribute('data-id') === ticket.conversation_id) {
card.remove();
}
});
}

// 5. Om listan blir tom, visa placeholder
if (listContainer && listContainer.children.length === 0) {
listContainer.innerHTML = `
<div class="template-item-empty" style="padding:40px; text-align:center; opacity:0.6;">
<div style="margin-bottom:15px; opacity: 0.3;">
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
</div>
<div>Du har inga pågående ärenden.</div>
</div>`;
}
} catch (err) {
console.error("Kunde inte radera på servern:", err);
showToast("❌ Kunde inte radera ärendet");
}
};
}
}
} // stänger attachMyTicketListeners

// Hjälpfunktion för att faktiskt utföra arkiveringen mot servern
async function archiveTicketFromMyTickets(conversationId) {
try {
const res = await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId })
});

if (!res.ok) throw new Error('Kunde inte arkivera ärendet');

// ✅ Servern bekräftade — nu är det säkert att rensa UI
const ticketLabel = window.NotifSystem ? window.NotifSystem.getTicketLabel(conversationId) : `#${String(conversationId).slice(-6)}`;
showToast(`✅ Ärendet ${ticketLabel} arkiverat!`);
if (window.NotifSystem) window.NotifSystem.addNotif(`Ärendet ${ticketLabel} arkiverat`);
checkAndResetDetail('inbox-detail', conversationId);
checkAndResetDetail('my-ticket-detail', conversationId);
checkAndResetDetail('archive-detail', conversationId);

const myDetail = document.getElementById('my-ticket-detail');
if (myDetail) {
myDetail.innerHTML = '';
myDetail.style.display = 'none';
myDetail.removeAttribute('data-current-id');
}
const myPlaceholder = document.getElementById('my-detail-placeholder');
if (myPlaceholder) myPlaceholder.style.display = 'flex';

renderMyTickets();
updateInboxBadge();

} catch (err) {
console.error("Arkivfel:", err);
alert("Ett fel uppstod vid arkivering: " + err.message);
}
}