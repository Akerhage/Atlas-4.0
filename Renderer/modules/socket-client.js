// ============================================
// modules/socket-client.js
// VAD DEN GÖR: Socket.IO-anslutning, retry-logik
//              och alla server-event-handlers
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, authToken              — renderer.js globals
//   handleLogout                       — renderer.js
//   updateInboxBadge                   — inbox-view.js
//   renderInbox, renderMyTickets       — inbox-view.js / tickets-view.js
//   renderArchive                      — archive-view.js
//   addBubble                          — chat-engine.js
//   checkAndResetDetail                — detail-ui.js
//   showToast                          — styling-utils.js
//   officeData[], usersCache[]         — renderer.js globals
// ============================================

// === SOCKET.IO SETUP (NGROK) ===
let socket = null;
window.socketAPI = {
isConnected: () => false,
emit: () => console.warn("Socket not ready yet"),
on: () => {}
};

// Initierar Socket.IO-anslutningen mot servern och sätter upp det globala socketAPI-objektet
function initializeSocket() {
if (typeof io === 'undefined' || !authToken) return;
console.log("🔌 Initializing Socket.io connection...");

// ExtraHeaders låser upp Ngrok för webbsockets
socket = io(SERVER_URL, {
auth: { token: authToken },
extraHeaders: {
"ngrok-skip-browser-warning": "true"
},
reconnection: true,
reconnectionAttempts: 10
});

// Koppla upp det globala API:et
window.socketAPI = {
isConnected: () => socket && socket.connected,
emit: (event, data) => socket && socket.emit(event, data),
on: (event, cb) => socket && socket.on(event, cb),
once: (event, cb) => socket && socket.once(event, cb),
off: (event, cb) => socket && socket.off(event, cb)
};

socket.on('connect', () => {
console.log("🟢 Socket connected!");
updateServerStatusUI(true);
});

socket.on('disconnect', () => {
console.warn("🔴 Socket disconnected");
updateServerStatusUI(false);
});

socket.on('connect_error', (err) => {
console.error("❌ Socket Connect Error:", err.message);
if (err.message.includes("Authentication error")) {
handleLogout(); 
}
});

// Aktivera lyssnare för chatt och events
setupSocketListeners();
}

// Uppdaterar server-statusindikatorn i UI med grön/röd status
function updateServerStatusUI(connected) {
const statusEl = document.getElementById('server-status');
if (statusEl) {
statusEl.textContent = connected ? "🟢 LIVE" : "🔴 Frånkopplad";
statusEl.style.color = connected ? "#4cd137" : "#ff6b6b";
}
}

// === DYNAMISK SOCKET-LADDNING (RETRY LOGIK) ===
async function loadSocketIoScriptWithRetry(retries = 30) {
const scriptUrl = `${SERVER_URL}/socket.io/socket.io.js`;

for (let i = 0; i < retries; i++) {
try {
// Försök nå servern med HEAD-anrop (inkluderar headers för Ngrok)
const res = await fetch(scriptUrl, { 
method: 'HEAD',
headers: { 'ngrok-skip-browser-warning': 'true' }
});

if (res.ok) {
console.log("✅ Servern svarar! Laddar socket-script...");
const script = document.createElement('script');
script.src = scriptUrl;
script.onload = () => initializeSocket();
script.onerror = () => {
// Fallback till CDN om lokala scriptet failar
console.warn("⚠️ Lokalt script failade, testar CDN...");
const cdn = document.createElement('script');
cdn.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
cdn.onload = () => initializeSocket();
document.head.appendChild(cdn);
};
document.head.appendChild(script);
return;
}
} catch (err) {
const statusEl = document.getElementById('server-status');
if (statusEl) {
statusEl.textContent = `⏳ Startar servern... (${Math.round((i/retries)*100)}%)`;
statusEl.style.color = "orange";
}
}
await new Promise(r => setTimeout(r, 1000));
}

console.error("❌ Server Timeout.");
addBubble("⚠️ Kunde inte ansluta till servern. Kontrollera att den är igång.", 'atlas');
}

// ==========================================================
// SOCKET-LYSSNARE / EVENTS
// ==========================================================
function setupSocketListeners() {
if (!window.socketAPI) return;

// 🛡️ VAKT: Förhindrar dubbla lyssnare vid reconnect (Säkring mot "Ghost UI")
if (window.socketListenersAttached) return; 
window.socketListenersAttached = true;

console.log("📡 Registrerar Socket-lyssnare...");

// 1. Svar från Atlas (Bot)
window.socketAPI.on('server:answer', (data) => {
console.log("📥 Mottog svar:", data);
addBubble(data.answer, 'atlas');

if (State.currentSession) {
State.currentSession.add('atlas', data.answer);
State.currentSession.isFirstMsg = false;
if (data.locked_context && State.currentSession.context) {
State.currentSession.context.locked_context = data.locked_context;
}
saveLocalQA(State.currentSession);
}
});

// 2. Versionsinfo
window.socketAPI.on('server:info', (data) => {
const verEl = document.getElementById('server-version-display');
if (verEl) verEl.textContent = data.version;
});

// 3. Felmeddelanden
window.socketAPI.on('server:error', (err) => {
addBubble(`⚠️ Serverfel: ${err.message}`, 'atlas');
});

// 4. TEAM UPDATE (INKORG / MINA ÄRENDEN / ARKIV)
// Debounce-timer: förhindrar scrollbar-flimmer vid snabba socket-events
let _teamUpdateDebounce = null;
window.socketAPI.on('team:update', (evt) => {
updateInboxBadge();
if (evt.type === 'client_typing') return;

if (
(evt.type === 'new_message' || evt.type === 'human_mode_triggered')
&& State.soundEnabled
) {
playNotificationSound();
}

// Toast + notis (riktat till mig) när kund triggar live-chatt
if (evt.type === 'human_mode_triggered') {
showToast('👤 En kund vill chatta live!', 5000, 'warning');
if (window.NotifSystem) window.NotifSystem.addNotif('👤 En kund vill chatta live!');
}

clearTimeout(_teamUpdateDebounce);
_teamUpdateDebounce = setTimeout(() => {
renderInbox();
renderMyTickets();
if (DOM.views && DOM.views.archive && DOM.views.archive.style.display === 'flex') {
renderArchive();
}

// 🔥 LIVE: Ladda om kontorsdetaljvyn tyst om admin har ett kontor öppet
// data-current-id på admin-detail-content innehåller routing_tag för öppet kontor
const adminDetail = document.getElementById('admin-detail-content');
const openOfficeTag = adminDetail?.getAttribute('data-current-id');
if (openOfficeTag && typeof openAdminOfficeDetail === 'function') {
openAdminOfficeDetail(openOfficeTag, null);
}
}, 350);
});

// 4b. Lyssna på specifika kundmeddelanden (Loveable API)
window.socketAPI.on('team:customer_message', (data) => {
console.log("📩 Nytt kundmeddelande via API:", data);
updateInboxBadge();
if (State.soundEnabled) playNotificationSound();
showToast('💬 Nytt kundmeddelande', 4000, 'info');
if (window.NotifSystem) window.NotifSystem.addNotif('💬 Nytt kundmeddelande via kundchatten');

if (DOM.views.inbox.style.display === 'flex') renderInbox();
});

// 4c. Lyssna på helt nya ärenden (t.ex. interna meddelanden)
window.socketAPI.on('team:new_ticket', (data) => {
console.log("🆕 Nytt ärende i kön:", data);
updateInboxBadge();
if (State.soundEnabled) playNotificationSound();
// Om ärendet är riktat till mig → Notiser, annars Historik
const _newTicketIsForMe = data.owner && typeof currentUser !== 'undefined' && data.owner === currentUser?.username;
showToast('📩 Nytt ärende inkommit', 4000, 'info');
if (window.NotifSystem) {
if (_newTicketIsForMe) window.NotifSystem.addNotif('📩 Nytt ärende tilldelat till dig');
else                   window.NotifSystem.addHistory('📩', 'Nytt ärende inkommit');
}

if (DOM.views.inbox.style.display === 'flex') renderInbox();
});

// ================================================
// team:customer_reply
// ================================================
window.socketAPI.on('team:customer_reply', (data) => {
const { conversationId, message, sender, isEmail } = data;

// Badge + ljud (övertar från team:update för inkommande kundmeddelanden)
updateInboxBadge();
if (sender === 'user' && State.soundEnabled) playNotificationSound();

// Kolla BÅDA detaljvyerna oberoende — båda existerar alltid i DOM (display togglas, ej remove)
const myDetail    = document.getElementById('my-ticket-detail');
const inboxDetail = document.getElementById('inbox-detail');
const isMyTicketOpen = myDetail?.getAttribute('data-current-id') === conversationId;
const isInboxOpen    = inboxDetail?.getAttribute('data-current-id') === conversationId;
if (!isMyTicketOpen && !isInboxOpen) {
if (sender === 'user' || (data.isEmail && sender === 'user')) {
const isMyTicket = !!document.querySelector(`#my-tickets-list .team-ticket-card[data-id="${conversationId}"]`);
if (isMyTicket) {
// Mitt ärende: riktat till mig → Notiser med namn + meddelandeförhandsvisning
const _label   = window.NotifSystem ? window.NotifSystem.getTicketLabel(conversationId) : `#${String(conversationId).slice(-6)}`;
const _snippet = (message || '').replace(/📧\s*(\((?:Mail|Svar)\):)?\s*/i, '').trim().substring(0, 45);
showToast(`💬 Nytt svar — ${_label}`, 4500, 'info');
if (window.NotifSystem) window.NotifSystem.addNotif(`💬 ${_label}: "${_snippet}${_snippet.length >= 45 ? '…' : ''}"`);
} else {
// Inte mitt ärende → Historik
if (window.NotifSystem) {
const _label2 = window.NotifSystem.getTicketLabel(conversationId);
window.NotifSystem.addHistory('💬', `Kundsvar i ärende ${_label2}`);
}
}
} else if (sender && sender.toLowerCase() !== 'system') {
// Agenthändelse (kollega svarade) → Historik
if (window.NotifSystem) {
const _label3 = window.NotifSystem.getTicketLabel(conversationId);
window.NotifSystem.addHistory('💬', `${sender} svarade i ärende ${_label3}`);
}
}
return;
} // Ingen av vyerna visar detta ärende

// Välj rätt chattcontainer baserat på vilken vy som är aktiv
let chatContainer = null;
if (isMyTicketOpen) chatContainer = document.getElementById('my-chat-scroll-area');
else if (isInboxOpen) chatContainer = document.querySelector('#inbox-detail .inbox-chat-history');
if (!chatContainer) return;

const wrapper = document.createElement('div');

// Avgör bubbelsida: eget meddelande → höger, kund/kollega → vänster
const isOwnMessage = sender && sender.toLowerCase() === (currentUser?.username || '').toLowerCase();
const isCustomer   = !sender || sender.toLowerCase() === 'user';

const activeDetail = document.querySelector('.template-editor-container[style*="display: flex"]');
const theme = getAgentStyles(activeDetail?.getAttribute('data-owner') || 'unclaimed');
const clean = (message || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');

// Tidsstämpel för live-bubblan
const _now = new Date();
const _timeStr = _now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const _dateStr = _now.toLocaleDateString('sv-SE');

if (isOwnMessage) {
// Eget agent-svar: höger sida — matchar statisk 'atlas'-rad i openMyTicketDetail
const agentStyles = getAgentStyles(sender);
const ownInitial = (currentUser?.username || '?')[0].toUpperCase();
wrapper.className = 'msg-row atlas';
wrapper.style.cssText = 'display:flex; width:100%; margin-bottom:12px; justify-content:flex-end;';
wrapper.innerHTML = `
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-right:4px;">Du • ${_timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
<div class="msg-avatar" style="background:${agentStyles.main}; color:white; font-weight:bold; margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${ownInitial}</div>
`;
} else if (isCustomer) {
// Kundmeddelande: vänster sida — matchar statisk 'user'-rad i openMyTicketDetail
wrapper.className = 'msg-row user';
wrapper.style.cssText = 'display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;';
wrapper.innerHTML = `
<div class="msg-avatar" style="background:rgba(255,255,255,0.15); color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">K</div>
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-left:4px;"><b>Kund</b> • ${_dateStr} ${_timeStr}</div>
<div class="bubble" style="background:${theme.bubbleBg} !important; border:1px solid ${theme.border} !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
`;
} else {
// Kollegas inkommande meddelande (intern chatt): vänster sida med agentens EGNA färg (ej ärendets tema)
const agentStyles = getAgentStyles(sender);
const colInitial = (sender || '?')[0].toUpperCase();
const senderName = (typeof formatName === 'function') ? formatName(sender) : sender;
wrapper.className = 'msg-row user';
wrapper.style.cssText = 'display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;';
wrapper.innerHTML = `
<div class="msg-avatar" style="background:${agentStyles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${colInitial}</div>
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-left:4px;"><b>${senderName}</b> • ${_dateStr} ${_timeStr}</div>
<div class="bubble" style="background:${agentStyles.bubbleBg} !important; border:1px solid ${agentStyles.border} !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
`;
}

chatContainer.appendChild(wrapper);

// Auto-scroll bara om agenten inte scrollat upp manuellt (läser data-auto-scroll)
const shouldAutoScroll = chatContainer.getAttribute('data-auto-scroll') === 'true';
const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;

if (shouldAutoScroll || isNearBottom) {
setTimeout(() => {
chatContainer.scrollTo({
top: chatContainer.scrollHeight,
behavior: 'smooth'
});
}, 50);
}
});

// ===============================
// KUNDEN SKRIVER
// ===============================
let typingTimer = null;

// Lyssna på kund-typing: visa typing-indikatorn i öppen detaljvy
window.socketAPI.on('team:client_typing', (data) => {
const { sessionId } = data;
const indicator = document.getElementById(`typing-indicator-${sessionId}`);
if (!indicator) return;
indicator.style.display = 'block';
clearTimeout(typingTimer);
typingTimer = setTimeout(() => {
indicator.style.display = 'none';
}, 3000);
});

// Lyssna på presence-uppdateringar (agent online/offline)
// Uppdaterar cachen — korten uppdateras automatiskt nästa gång de renderas
window.socketAPI.on('presence:update', (data) => {
const { userId, status } = data;
const user = usersCache.find(u => u.id === userId);
if (user) {
user.is_online = (status === 'online') ? 1 : 0;
if (data.lastSeen) user.last_seen = data.lastSeen;
}
});

// Lyssna på ärende-status: stäng detaljvyn om det öppna ärendet raderades av en kollega
window.socketAPI.on('team:session_status', (data) => {
const { conversationId, status } = data;
if (status !== 'deleted') return; // Arkivering hanteras av team:update — ingen action här

// Kolla om just detta ärende är öppet INNAN vi nollställer (data-current-id tas bort av checkAndResetDetail)
const wasOpen = ['inbox-detail', 'my-ticket-detail'].some(id => {
const el = document.getElementById(id);
return el && el.getAttribute('data-current-id') === conversationId;
});

checkAndResetDetail('inbox-detail', conversationId);
checkAndResetDetail('my-ticket-detail', conversationId);

// Visa toast endast om agenten faktiskt hade ärendet öppet
if (wasOpen) {
showToast('🗑️ Ärendet togs bort av en kollega', 4000, 'warning');
}
if (window.NotifSystem) window.NotifSystem.addHistory('🗑️', 'Ärende avslutades/raderades');
});

window.socketAPI.on('team:ticket_taken', (data) => {
const { conversationId, takenBy, previousOwner } = data;
const wasOpen = ['inbox-detail', 'my-ticket-detail'].some(id => {
const el = document.getElementById(id);
return el && el.getAttribute('data-current-id') === conversationId;
});
checkAndResetDetail('my-ticket-detail', conversationId);
renderMyTickets?.();

const ticketLabel = window.NotifSystem ? window.NotifSystem.getTicketLabel(conversationId) : `#${String(conversationId).slice(-6)}`;

// Visa toast för gamla ägaren (om ärendet var tilldelat någon)
if (previousOwner && previousOwner === (typeof currentUser !== 'undefined' ? currentUser.username : null)) {
const takenByDisplay = typeof usersCache !== 'undefined'
? (usersCache.find(u => u.username === takenBy)?.display_name || takenBy)
: takenBy;
showToast(`⚠️ ${takenByDisplay} tog över ärendet (${ticketLabel}) via snabbsvar`, 4000, 'warning');
if (window.NotifSystem) window.NotifSystem.addHistory('⚠️', `${takenByDisplay} tog över ärendet ${ticketLabel}`);
} else if (wasOpen) {
showToast(`⚠️ ${takenBy} tog över ärendet ${ticketLabel}`, 4000, 'warning');
if (window.NotifSystem) window.NotifSystem.addHistory('⚠️', `${takenBy} tog över ärendet ${ticketLabel}`);
}
});

// ==========================================================
// LYSSNA PÅ EGET ÄRENDETAGANDE (SVARAREN GETS TOAST)
// ==========================================================
window.socketAPI.on('team:ticket_claimed_self', (data) => {
const { conversationId, claimedBy, previousOwner } = data;
if (claimedBy === (typeof currentUser !== 'undefined' ? currentUser.username : null)) {
const previousOwnerDisplay = typeof usersCache !== 'undefined' && previousOwner
? (usersCache.find(u => u.username === previousOwner)?.display_name || previousOwner)
: (previousOwner ? previousOwner : null);
const ticketLabel = window.NotifSystem ? window.NotifSystem.getTicketLabel(conversationId) : `#${String(conversationId).slice(-6)}`;
const toastMsg = previousOwnerDisplay
? `✅ Du tog över ärendet ${ticketLabel} från ${previousOwnerDisplay}`
: `✅ Du tog ärendet ${ticketLabel}`;
showToast(toastMsg, 3500, 'success');
if (window.NotifSystem) window.NotifSystem.addHistory('✅', toastMsg.replace('✅ ', ''));
}
});

// ==========================================================
// LYSSNA PÅ AI-SVAR
// ==========================================================
window.socketAPI.on('ai:prediction', async (data) => {
console.log("📡 Meddelande mottaget från servern:", data);

// Hämta till rutan om vi är i "Mina Ärenden"
const myTicketInput = document.getElementById('my-ticket-chat-input');
const detailView = document.getElementById('my-ticket-detail');

// Om detaljvyn syns OCH rutan finns -> Lägg in texten där
if (detailView && detailView.style.display === 'flex' && myTicketInput) {
myTicketInput.value = data.answer; // Klistra in svaret
myTicketInput.disabled = false;    // Lås upp om den var låst
myTicketInput.focus();             // Sätt markören där

if (typeof playNotificationSound === 'function') playNotificationSound();
return; // AVSLUTA HÄR - Ingen kopiering till urklipp behövs då
}

// Inkorg snabbsvar
const quickInput = document.getElementById('quick-reply-input');
if (quickInput) {
quickInput.value = data.answer;
quickInput.disabled = false;
quickInput.focus();
if (typeof playNotificationSound === 'function') playNotificationSound();
return;
}

// Admin Reader-modal
const readerInput = document.getElementById('reader-quick-reply');
if (readerInput) {
readerInput.value = data.answer;
readerInput.disabled = false;
readerInput.focus();
if (typeof playNotificationSound === 'function') playNotificationSound();
return;
}

// --- FALLBACK: KOPIERA TILL URKLIPP ---
if (data.is_email_draft) {
console.log("🤖 AI har genererat ett mail-svar! Tvingar kopiering...");

const now = new Date();
const timeStamp = now.toLocaleString('sv-SE', { 
year: 'numeric', month: '2-digit', day: '2-digit', 
hour: '2-digit', minute: '2-digit' 
});

// 1. Skapa Plain Text-version
const finalContentPlain = `${data.answer}\n\n` + 
`--------------------------------------------------\n` +
`URSPRUNGLIGT MEDDELANDE (Mottaget: ${timeStamp}):\n` +
`${lastEmailContext}\n\n` + 
`Med vänlig hälsning\n` +
`Supporten My Driving Academy`;

// 2. Skapa Rich Text-version (HTML)
const answerHtml = formatAtlasMessage(data.answer);
const contextHtml = lastEmailContext.replace(/\n/g, '<br>');

const finalContentHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.4;">
<div>${answerHtml}</div>
<br>
<div style="border-top: 1px solid #ccc; padding-top: 10px; color: #666;">
<strong>URSPRUNGLIGT MEDDELANDE (Mottaget: ${timeStamp}):</strong><br>
${contextHtml}
</div>
<br>
Med vänlig hälsning,<br>
<strong>Supporten My Driving Academy</strong>
</div>
`;

// 3. Hantera kopiering (Electron vs Webb)
if (window.electronAPI && typeof window.electronAPI.send === 'function') {

// ELECTRON-LÄGE
window.electronAPI.send('force-copy-html-to-clipboard', {
html: finalContentHtml,
text: finalContentPlain
});
if (typeof playNotificationSound === 'function') playNotificationSound();
console.log("✅ Kopierat AI-svar via Electron (Rich Text)");
} else {

// WEBB-LÄGE
try {
const typeHtml = "text/html";
const typeText = "text/plain";
const blobHtml = new Blob([finalContentHtml], { type: typeHtml });
const blobText = new Blob([finalContentPlain], { type: typeText });

const clipboardData = [new ClipboardItem({
[typeHtml]: blobHtml,
[typeText]: blobText
})];

await navigator.clipboard.write(clipboardData);
if (typeof playNotificationSound === 'function') playNotificationSound();
console.log("✅ Kopierat AI-svar via Web Clipboard API");
} catch (err) {
console.error("❌ Webb-kopiering misslyckades:", err);
await navigator.clipboard.writeText(finalContentPlain);
if (typeof playNotificationSound === 'function') playNotificationSound();
}
}
}
});
// ==========================================================
// 📢 ADMIN BROADCAST — systemmeddelande till alla agenter
// ==========================================================
window.socketAPI.on('admin:notification', (data) => {
const modal = document.getElementById('admin-broadcast-modal');
if (!modal) return;
const time = new Date(data.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
modal.innerHTML = `
<div class="glass-modal-box glass-effect"
style="width:460px; max-width:88vw; border-top:3px solid var(--accent-primary);
text-align:center; padding:30px 28px 24px;">
<div style="font-size:30px; margin-bottom:10px;">📢</div>
<div style="font-size:16px; font-weight:700; color:white; margin-bottom:5px;">Systemmeddelande</div>
<div style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin-bottom:18px;">
Från: ${data.sentBy} • ${time}
</div>
<div style="font-size:14px; line-height:1.7; color:var(--text-primary);
background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09);
border-radius:10px; padding:14px 16px; text-align:left;
white-space:pre-wrap; word-break:break-word;">${data.message}</div>
</div>`;
modal.style.display = 'flex';
modal.style.pointerEvents = 'all';
const _closeBroadcast = () => { modal.style.display = 'none'; modal.style.pointerEvents = 'none'; };
modal.onclick = (e) => { if (e.target === modal) _closeBroadcast(); };
const _bcEsc = (e) => { if (e.key === 'Escape') { _closeBroadcast(); document.removeEventListener('keydown', _bcEsc); } };
document.addEventListener('keydown', _bcEsc);
if (typeof playNotificationSound === 'function') playNotificationSound();
// Broadcast är riktat till alla → Notiser (viktig info)
if (window.NotifSystem) window.NotifSystem.addNotif(`📢 Systemmeddelande: ${String(data.message || '').substring(0, 70)}`);
});

window.socketAPI.on('ticket:summary', (data) => {
const txt = document.getElementById('ticket-summary-text');
const panel = document.getElementById('ticket-summary-panel');
if (txt) {
txt.textContent = data.summary;
if (panel) panel.style.display = 'block';
if (typeof playNotificationSound === 'function') playNotificationSound();
}
const btn = document.getElementById('btn-summarize');
if (btn) btn.disabled = false;
});

// ==========================================================
// 🎨 LIVE FÄRG-SYNK (OFFICE & AGENT)
// ==========================================================
window.socketAPI.on('office:color_updated', ({ routing_tag, color }) => {
console.log(`🎨 [LIVE] Kontorsfärg uppdaterad: ${routing_tag} → ${color}`);
const office = officeData.find(o => o.routing_tag === routing_tag);
if (office) office.office_color = color;
renderInbox();
renderMyTickets();
if (document.getElementById('view-archive')?.style.display === 'flex') renderArchive();
});

window.socketAPI.on('agent:color_updated', ({ username, color }) => {
console.log(`🎨 [LIVE] Agentfärg uppdaterad: ${username} → ${color}`);
const user = usersCache.find(u => u.username === username);
if (user) user.agent_color = color;
if (currentUser?.username === username) {
currentUser.agent_color = color;
localStorage.setItem('atlas_user', JSON.stringify(currentUser));
// Uppdatera CSS-accentvariabeln som styr HEM-vyn, knappar och all accentfärg globalt
document.documentElement.style.setProperty('--accent-primary', color);
// Uppdatera sidebar-avataren, namn och statustext direkt
if (typeof updateProfileUI === 'function') updateProfileUI();
}
renderInbox();
renderMyTickets();
if (document.getElementById('view-archive')?.style.display === 'flex') renderArchive();
});

// LIVE KONTOR-SYNK: Uppdaterar agentens routing_tag direkt när admin ändrar
window.socketAPI.on('agent:offices_updated', ({ username, newTags }) => {
console.log(`🏢 [LIVE] Kontorsroll uppdaterad: ${username} -> ${newTags}`);

// Synka usersCache
const user = usersCache.find(u => u.username === username);
if (user) user.routing_tag = newTags;

// Om det är den inloggade agenten — uppdatera currentUser och localStorage
if (currentUser?.username === username) {
currentUser.routing_tag = newTags;
localStorage.setItem('atlas_user', JSON.stringify(currentUser));
console.log(`✅ [LIVE] Egen routing_tag uppdaterad till: ${newTags}`);
}

// Rendera om Mina Ärenden så rätt ärenden visas direkt
renderMyTickets?.();
updateInboxBadge?.();
});

// LIVE VY-SYNK: Uppdaterar allowed_views direkt när admin ändrar vy-behörigheter
window.socketAPI.on('agent:views_updated', ({ username, allowed_views }) => {
console.log(`👁️ [LIVE] Vy-behörigheter uppdaterade: ${username}`);

// Gäller bara den inloggade agenten
if (currentUser?.username !== username) return;

// Synka state och localStorage
currentUser.allowed_views = allowed_views;
localStorage.setItem('atlas_user', JSON.stringify(currentUser));
console.log(`✅ [LIVE] Egna allowed_views uppdaterade till: ${allowed_views || 'alla'}`);

// Uppdatera sidebaren direkt
if (typeof updateInboxVisibility === 'function') updateInboxVisibility();

// Om agenten befinner sig på en vy som nu är dold → skicka hem
const activeItem = document.querySelector('.menu-item.active');
const currentView = activeItem?.dataset.view;
const allowed = allowed_views ? JSON.parse(allowed_views) : null;
if (allowed && currentView && !allowed.includes(currentView) && currentView !== 'chat' && currentView !== 'admin') {
console.warn(`⚠️ [LIVE] Aktuell vy "${currentView}" är inte längre tillåten — omdirigerar till Hem`);
if (typeof switchView === 'function') switchView('chat');
}
});

} // <-- Stänger setupSocketListeners-funktionen