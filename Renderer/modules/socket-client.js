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
on: (event, cb) => socket && socket.on(event, cb)
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
// Servern startar upp... uppdatera UI
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
// SOCKET-LYSSNARE / EVENTS (SÄKRAD
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

// 4. TEAM UPDATE (INKORG / MINA ÄRENDEN / ARKIV) - NU SAMLAD HÄR
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

// Vi triggar en render för att se det nya meddelandet i listan direkt
if (DOM.views.inbox.style.display === 'flex') renderInbox();
});

// 4c. Lyssna på helt nya ärenden (t.ex. interna meddelanden)
window.socketAPI.on('team:new_ticket', (data) => {
console.log("🆕 Nytt ärende i kön:", data);
updateInboxBadge();
if (State.soundEnabled) playNotificationSound();

// Uppdatera vyn om användaren står i inkorgen
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
if (!isMyTicketOpen && !isInboxOpen) return; // Ingen av vyerna visar detta ärende

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
// KUNDEN SKRIVER (BEHÅLL DENNA!)
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

// Stäng detaljvyn och visa placeholder om ärendet är öppet
checkAndResetDetail('inbox-detail', conversationId);
checkAndResetDetail('my-ticket-detail', conversationId);

// Visa toast endast om agenten faktiskt hade ärendet öppet
if (wasOpen) {
showToast('🗑️ Ärendet togs bort av en kollega');
}
});

window.socketAPI.on('team:ticket_taken', (data) => {
const { conversationId, takenBy } = data;
const wasOpen = ['inbox-detail', 'my-ticket-detail'].some(id => {
const el = document.getElementById(id);
return el && el.getAttribute('data-current-id') === conversationId;
});
checkAndResetDetail('my-ticket-detail', conversationId);
renderMyTickets?.();
if (wasOpen) {
showToast(`⚠️ ${takenBy} tog över detta ärende`);
}
});

// ==========================================================
// 📩 LYSSNA PÅ AI-SVAR (SKRÄDDARSYDD FÖR DIN RENDERER.JS)
// ==========================================================
window.socketAPI.on('ai:prediction', async (data) => {
console.log("📡 Meddelande mottaget från servern:", data); 

// --- NY LOGIK: HÄMTA TILL RUTAN OM VI ÄR I "MINA ÄRENDEN" ---
const myTicketInput = document.getElementById('my-ticket-chat-input');
const detailView = document.getElementById('my-ticket-detail');

// Om detaljvyn syns OCH rutan finns -> Lägg in texten där
if (detailView && detailView.style.display === 'flex' && myTicketInput) {
console.log("🤖 AI lägger svaret i textrutan direkt.");
myTicketInput.value = data.answer; // Klistra in svaret
myTicketInput.disabled = false;    // Lås upp om den var låst
myTicketInput.focus();             // Sätt markören där

if (typeof playNotificationSound === 'function') playNotificationSound();
return; // AVSLUTA HÄR - Ingen kopiering till urklipp behövs då
}

// --- DIN GAMLA LOGIK (FALLBACK FÖR URKLIPP) ---
if (data.is_email_draft) {
console.log("🤖 AI har genererat ett mail-svar! Tvingar kopiering...");

const now = new Date();
const timeStamp = now.toLocaleString('sv-SE', { 
year: 'numeric', month: '2-digit', day: '2-digit', 
hour: '2-digit', minute: '2-digit' 
});

// 1. Skapa Plain Text-version (Använder din lastEmailContext)
const finalContentPlain = `${data.answer}\n\n` + 
`--------------------------------------------------\n` +
`URSPRUNGLIGT MEDDELANDE (Mottaget: ${timeStamp}):\n` +
`${lastEmailContext}\n\n` + 
`Med vänlig hälsning\n` +
`Supporten My Driving Academy`;

// 2. Skapa Rich Text-version (HTML) med din formatAtlasMessage-funktion
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

// 3. Hantera kopiering baserat på din miljö (Electron vs Webb)
if (window.electronAPI && typeof window.electronAPI.send === 'function') {

// ELECTRON-LÄGE (Patric)
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

// 🔥 LIVE KONTOR-SYNK: Uppdaterar agentens routing_tag direkt när admin ändrar
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
});

} // <-- Stänger setupSocketListeners-funktionen