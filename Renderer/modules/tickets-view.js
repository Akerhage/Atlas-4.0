// ============================================
// modules/tickets-view.js
// VAD DEN GÖR: Mina ärenden — rendering och
//              detaljvy för agentens egna ärenden
// ANVÄNDS AV: renderer.js
// ============================================
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
// MINA ÄRENDEN: LISTA (FIXAD: Rätt namn & Agent-etikett)
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
if (t.routing_tag && myOfficeTags.includes(t.routing_tag.toLowerCase())) return true;
return false;
});
}

// 🔥 KIRURGISK FIX: Ta bort "Inga ärenden"-vyn om vi faktiskt har ärenden nu
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
detail.innerHTML = ''; // <--- VIKTIGT: Rensar bort "skiten" som annars fastnar
detail.style.display = 'none';
detail.removeAttribute('data-current-id');
placeholder.style.display = 'flex';
}
}
}

// 🔥 RENSA LISTAN INNAN RENDER
//container.innerHTML = '';

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
const isInternal = (t.session_type === 'internal' || t.routing_tag === 'INTERNAL');
const styles = isInternal ? { main: '#f1c40f', bg: 'transparent', border: 'rgba(241,196,15,0.3)', bubbleBg: 'rgba(241,196,15,0.15)' } : getAgentStyles(t.routing_tag || t.owner || myName);

// Visa kontoret (routing_tag) på kortet. Interna ärenden visar avsändarens visningsnamn.
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
card.style.background = "rgba(255,255,255,0.1)";
}

// Rensat dubbel-taggar och trasiga knappar
// ERSÄTT card.innerHTML i renderMyTickets med detta:
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
container.querySelectorAll('.team-ticket-card').forEach(c => {
c.classList.remove('active-ticket');
c.style.background = ''; 
});
card.classList.add('active-ticket');
card.style.background = "rgba(255,255,255,0.1)";
openMyTicketDetail(t);
};

const btn = card.querySelector('.archive-action');
if(btn) {
btn.onclick = async (e) => {
e.stopPropagation();
try {
await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id })
});
showToast('✅ Ärendet arkiverat!');
// STÄNG VYN: Om det arkiverade ärendet råkar vara det som är öppet
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
// 🧹 MINA ÄRENDEN - FUNKTIONEN (KOMPLETT VERSION)
// =========================================================
function openMyTicketDetail(ticket) {
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');

if (!detail || !placeholder) return;

placeholder.style.display = 'none';
detail.style.display = 'flex';
detail.setAttribute('data-current-id', ticket.conversation_id);

// 1. STILAR & FÄRG (FIX FÖR GULT & INGEN LINJE)
// Vi inkluderar _isLocal här så att dina egna Ida-chattar blir gula
const isInternal = (ticket.session_type === 'internal' || ticket.routing_tag === 'INTERNAL' || ticket._isLocal);

const internalYellow = {
main: '#f1c40f',
bg: 'transparent', // Ingen bakgrundsfärg som kan läcka
border: 'rgba(241, 196, 15, 0.3)',
bubbleBg: 'rgba(241, 196, 15, 0.15)'
};

let styles = isInternal ? internalYellow : getAgentStyles(ticket.routing_tag || ticket.owner);

detail.classList.add('template-editor-container');
detail.setAttribute('data-owner', ticket.owner || 'unclaimed');

// HÄR DÖDAR VI LINJERNA HELT
detail.style.setProperty('border-top', 'none', 'important');
detail.style.setProperty('border-bottom', 'none', 'important');
detail.style.setProperty('background', 'none', 'important');
detail.style.setProperty('box-shadow', 'none', 'important');

detail.innerHTML = '';

// 2. DATA-PREPP (KIRURGISK FIX FÖR MAIL-TYP)
const displayTitle = resolveTicketTitle(ticket);
const isMail = ticket.session_type === 'mail' || ticket.session_type === 'message' || ticket.routing_tag === 'MAIL';

// --- CHATT / MAIL ---
let bodyContent = '';

if (isMail) {
const messages = ticket.messages || [];

// Oscar Berg-fix: Om historik saknas, använd ticket.last_message
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

const senderStyles = isInternal ? internalYellow : (isUser ? getAgentStyles(m.sender) : styles);
const leftInitial = rowDisplayTitle ? rowDisplayTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${senderStyles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${leftInitial}</div>`;

let rightAvatarContent = '🤖';
let rightAvatarStyle = 'background:#3a3a3c;';

if (isInternal && !isUser) {
rightAvatarContent = currentUser.username.charAt(0).toUpperCase();
rightAvatarStyle = `background:${styles.main}; color:white; font-weight:bold;`;
}

const atlasAvatar = `<div class="msg-avatar" style="${rightAvatarStyle} margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${rightAvatarContent}</div>`;
const content = formatAtlasMessage(m.text || m.content || "").trim();

if (isUser) {
bodyContent += `<div class="msg-row user" style="display:flex; width:100% !important; margin-bottom:12px; justify-content:flex-start;">${userAvatar}<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:75%;"><div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-left:4px;"><b>${rowDisplayTitle || 'Kund'}</b> • ${dateStrMsg} ${time}</div><div class="bubble" style="background:${senderStyles.bubbleBg} !important; border:1px solid ${senderStyles.border} !important; color:var(--text-primary) !important;">${content}</div></div></div>`;
} else {
const senderLabel = isInternal ? 'Du' : 'Atlas';
bodyContent += `<div class="msg-row atlas" style="display:flex; width:100% !important; margin-bottom:12px; justify-content:flex-end;"><div style="display:flex; flex-direction:column; align-items:flex-end; max-width:75%;"><div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-right:4px;">${senderLabel} • ${time}</div><div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important;">${content}</div></div>${atlasAvatar}</div>`;
}
});
}

const typingText = isInternal ? '✍️ Kollegan skriver...' : '✍️ Kunden skriver...';
bodyContent += `<div id="typing-indicator-${ticket.conversation_id}" style="display:none; padding:5px 15px; font-size:12px; color:${styles.main}; font-style:italic; margin-top:5px; text-align:left;">${typingText}</div>`;

let templateOptions = `<option value="">📋 Välj mall att kopiera...</option>`;
if (State.templates) {
State.templates.forEach(t => { templateOptions += `<option value="${t.id}">${t.title}</option>`; });
}

const contentBox = document.createElement('div');
contentBox.className = 'detail-container';
contentBox.innerHTML = `
${renderDetailHeader(ticket, styles)}
<div class="detail-body scroll-list" id="my-chat-scroll-area">
${bodyContent}
</div>
<div class="detail-footer-area">
<form id="my-ticket-chat-form">
<textarea id="my-ticket-chat-input" placeholder="${ticket.is_archived ? 'Ärendet är arkiverat' : 'Skriv ett meddelande...'}" ${ticket.is_archived ? 'disabled' : ''}></textarea>
<button type="submit" id="${isMail ? 'btn-send-mail-action' : 'btn-reply-action'}" class="send-button-ticket">
${UI_ICONS.SEND}
</button>
</form>
${!ticket.is_archived ? '<p style="font-size:10px; opacity:0.3; text-align:right; padding:2px 20px 0; margin:0; color:var(--text-secondary);">Enter skickar · Shift+Enter ny rad</p>' : ''}
<div style="display:flex; justify-content: space-between; align-items:center; padding: 0 20px 15px 20px;">
<div style="flex:1; max-width:60%;"><select id="quick-template-select" class="filter-select">${templateOptions}</select></div>
<div style="display:flex; gap:10px;">
${isMail ? `<button type="button" class="footer-icon-btn" id="btn-ai-draft" title="AI Förslag">${UI_ICONS.AI}</button>` : ''}
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
// 🔌 KNAPPAR & LYSSNARE (SMART HTML-HANTERING)
// =========================================================
function attachMyTicketListeners(ticket, isMail) {

// Variabel för att spara mallens "snygga" HTML (med bilder/fetstil) i bakgrunden
let activeTemplateHtml = null; 

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

// Visa ren text i rutan så du ser vad du skickar
const tempDiv = document.createElement('div');
tempDiv.innerHTML = t.content;
const cleanText = (tempDiv.innerText || tempDiv.textContent || '').trim();

inp.value = cleanText; 
inp.focus(); 

// Trigga input-eventet så att rutan kan auto-expandera om det behövs
inp.dispatchEvent(new Event('input'));

tSelect.value = ""; 
}
}
};
}

// Lyssna om du ändrar texten manuellt
const inpField = document.getElementById('my-ticket-chat-input');
if (inpField) {
inpField.addEventListener('input', () => {
// Om du ändrar texten manuellt, måste vi släppa mallens HTML
activeTemplateHtml = null;
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

// Visuell feedback på knappen
const btn = form.querySelector('button[type="submit"]');
const originalText = btn.innerHTML;
btn.innerHTML = "⏳ Skickar...";
btn.disabled = true;

setTimeout(() => {
btn.innerHTML = originalText;
btn.disabled = false;
}, 2000);

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

// 3. AI TROLLSTAV
const btnAI = document.getElementById('btn-ai-draft');
if (btnAI && isMail) {
btnAI.onclick = () => {
const inp = document.getElementById('my-ticket-chat-input');
const originalMsg = ticket.messages && ticket.messages.length > 0 ? ticket.messages[0].content : ticket.last_message;
inp.value = "🤖 Tänker så det knakar... (Hämtar AI-svar)";
inp.disabled = true;

window.socketAPI.emit('team:email_action', { 
conversationId: ticket.conversation_id, 
action: 'draft',
content: originalMsg 
});
};
}

// 4. Arkivera (Direkt utan bekräftelsepopup — toast visas istället)
const btnArch = document.getElementById('btn-archive-my');
if(btnArch) btnArch.onclick = async () => {
archiveTicketFromMyTickets(ticket.conversation_id);
showToast('✅ Ärendet arkiverat!');
checkAndResetDetail('inbox-detail');
checkAndResetDetail('my-ticket-detail');
checkAndResetDetail('archive-detail');
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

// 3. Visa toast-notifiering
showToast("✅ Ärendet raderat");

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
} // End of attachMyTicketListeners function -- stänger if(btnDel) + funktionen
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

// Återställ UI - TOTALRENSNING
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
