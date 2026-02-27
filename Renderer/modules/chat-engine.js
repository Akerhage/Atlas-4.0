// ============================================
// modules/chat-engine.js
// VAD DEN GÖR: Kundchatt-motor i agent-vyn —
//              session, meddelanden, bubblor
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid, ej vid laddning):
//   State, DOM, currentUser       — renderer.js globals
//   window.socketAPI              — renderer.js socket-sektion
//   checkAndResetDetail()         — renderer.js rad ~1235
//   formatName()                  — modules/styling-utils.js
//   window.electronAPI.saveQA     — modules/ipc-bridges.js
// ============================================

// ==========================================================
// 3. CHATT MOTOR (Session & Logic)
// ==========================================================
class ChatSession {
constructor() {
// Lägg till unik random-del för att undvika kollisioner
this.id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
this.messages = [];
this.startTime = new Date();

// 👈 KRITISK FIX: HEM-vyn är ALLTID privat
this.session_type = 'private';

this.context = {
locked_context: {
city: null,
area: null,
vehicle: null
},
linksSentByVehicle: {
AM: false,
MC: false,
CAR: false,
INTRO: false,
RISK1: false,
RISK2: false
}
};

this.isFirstMsg = true;
}

add(role, text) {
this.messages.push({ role, text, timestamp: new Date() });
}

getContextHistory() {
return this.messages.map(m => ({
role: m.role,
content: m.text
})).slice(-10); // Skicka bara sista 10 för context window
}

getFullText() {
return this.messages.map(m =>
`${m.role === 'user' ? 'Användare' : 'Atlas'}: ${m.text}`
).join('\n\n');
}
}

// ==========================================================
// ⚠️ VIKTIGT – INTRO-BUBBLA ÄGS AV index.html
// Renderer.js får ALDRIG skapa första Atlas-meddelandet.
// isFirstMsg sätts därför till false här medvetet.
// Ändra INTE detta utan att även uppdatera index.html + server-flödet.
// ==========================================================
function initChat(skipSave = false) {
console.log("🏠 initChat() körs (skipSave=" + skipSave + ")");
// Spara bara om vi inte bett om att hoppa över
if (!skipSave && State.currentSession && State.currentSession.messages.length > 0) {
saveLocalQA(State.currentSession);
}

State.currentSession = new ChatSession();

// 🛑 ULTRA-KOMPAKT FIX:
// padding: 15px (Mindre ram runt texten)
// max-width: 380px (Smalare box totalt)

console.log("  Rendering intro message...");

if (DOM.chatMessages) {
DOM.chatMessages.innerHTML = `
<div style="width: 100%; display: flex; justify-content: flex-start; padding: 20px; box-sizing: border-box;">
<div style="
background: rgba(15, 15, 25, 0.7); /* Mörkare bas för läsbarhet i ljusa teman */
backdrop-filter: blur(12px);
padding: 18px;
border-radius: 12px;
border: 1px solid var(--accent-primary);
max-width: 380px;
box-shadow: 0 10px 30px rgba(0,0,0,0.5);
">
<h3 style="margin: 0 0 10px 0; color: var(--accent-primary); font-size: 14px; display:flex; align-items:center; gap:10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
Privat för dig endast
</h3>
<p style="margin: 0 0 12px 0; line-height: 1.5; font-size: 13px; color: #ffffff;">
Här kan du testa frågor mot Atlas AI utan att det loggas som kundärenden.
</p>
<div style="font-size: 11px; color: rgba(255,255,255,0.5); font-style: italic; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
Dessa sessioner sparas lokalt i ditt Garage, men syns inte för teamet.
</div>
</div>
</div>
`;

State.currentSession.isFirstMsg = false;
console.log('[CHAT] Ny session startad (Privat):', State.currentSession.id);
}
}

//----------------------------------------------
//---------HANDLE USER MESSAGE----------------//
//----------------------------------------------
async function handleUserMessage(text) {
if (!text.trim()) return;

// 1. UI Update (Visa användarens meddelande direkt)
if (State.currentSession) State.currentSession.add('user', text);
addBubble(text, 'user');

// Töm endast om fältet existerar
if (DOM.messageInput) {
DOM.messageInput.value = '';
}

// 2. Skicka via Socket.IO
if (window.socketAPI && window.socketAPI.isConnected()) {
try {
const payload = {
query: text,
sessionId: State.currentSession?.id,
isFirstMessage: State.currentSession?.isFirstMsg,
session_type: State.currentSession?.session_type,
context: State.currentSession?.context
};

if (State.currentSession?.isFirstMsg && currentUser) {
window.socketAPI.emit('team:assign_self', {
sessionId: State.currentSession.id,
agentName: currentUser.username
});

checkAndResetDetail('inbox-detail');
checkAndResetDetail('my-ticket-detail');
checkAndResetDetail('archive-detail');
}

window.socketAPI.emit('client:message', payload);

} catch (err) {
console.error(err);
addBubble(`⚠️ Kunde inte skicka via socket: ${err.message}`, 'atlas');
}
} else {
addBubble("⚠️ Ingen anslutning till servern.", 'atlas');
console.error("Socket not connected.");
}
}

//----------------------------------------------
//---------ADD BUBBLE----------------//
//----------------------------------------------
function addBubble(text, role) {
// Avbryt direkt om chatt-containern saknas
if (!DOM.chatMessages) {
console.warn("⚠️ DOM.chatMessages saknas. Kan inte rita bubbla:", text);
return;
}

const wrapper = document.createElement('div');
wrapper.className = `message ${role}`;

const bubble = document.createElement('div');
bubble.className = 'bubble';

// Markdown-lite parsing - BEVARAD EXAKT
let html = text
.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
.replace(/\n/g, '<br>')
.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="atlas-link">$1</a>');

bubble.innerHTML = html;
wrapper.appendChild(bubble);

// Append och scroll
DOM.chatMessages.appendChild(wrapper);
DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// ============================================================================
// HJÄLPFUNKTION: Fixar namnet (Anna Andersson) oavsett var det ligger
// ============================================================================
function resolveTicketTitle(t) {
// 1. Prioritera namn i roten
if (t.contact_name) return t.contact_name;

// 2. Kolla inuti context_data (Viktigt för Demo-ärenden)
if (t.context_data) {
try {
const ctx = typeof t.context_data === 'string' ? JSON.parse(t.context_data) : t.context_data;
if (ctx.locked_context && ctx.locked_context.name) return ctx.locked_context.name;
if (ctx.name) return ctx.name;
} catch(e) {}
}

// 3. Kolla locked_context direkt
if (t.locked_context) {
if (t.locked_context.name) return t.locked_context.name;
if (t.locked_context.contact_name) return t.locked_context.contact_name;
}

// 4. Fallback: Använd användarens namn från session
if (t.sender && t.session_type === 'internal') {
return (typeof formatName === 'function') ? formatName(t.sender) : t.sender;
}

// 5. Fallbacks
if (t.contact_email) return t.contact_email;
if (t.subject && !t.subject.startsWith('DEMO_')) return t.subject;
const shortId = t.conversation_id.replace('session_', '').substring(0, 6);
return `Ärende #${shortId}`;
}

// Add missing function declaration for saveLocalQA
function saveLocalQA(session, forceArchive = false) {
// Implementation for saving local QA session
if (window.electronAPI && window.electronAPI.saveQA) {
const qaData = {
id: session.id,
question: session.messages.find(m => m.role === 'user')?.text || '',
answer: JSON.stringify(session.messages),
timestamp: Date.now(),
is_archived: forceArchive ? 1 : 0,
session_type: session.session_type || 'private'
};
window.electronAPI.saveQA(qaData);
}
}
