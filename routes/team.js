// ============================================
// routes/team.js — Team & Inkorg-endpoints
// VAD DEN GÖR: Svar, interna meddelanden,
//              inkorg, sökning, claim, assign
//              och mina ärenden för agenter.
// ANVÄNDS AV: server.js via app.use('/', teamRoutes)
//             + teamRoutes.init({ io })
// ============================================

// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║         KRITISK VARNING — LÄS INNAN DU ÄNDRAR NÅGOT         ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  ROUTING, FÄRGER OCH INKORG-LOGIKEN I DENNA FIL HAR TAGIT   ║
// ⚠️  ║  EXTREMT LÅNG TID ATT FELSÖKA OCH FUNGERAR NU KORREKT.      ║
// ⚠️  ║  GÖR INGA ÄNDRINGAR UTAN ATT FÖRSTÅ HELA SYSTEMET.          ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  SÅ HÄR FUNGERAR INKORG-LOGIKEN (FÖRÄNDRA INTE):            ║
// ⚠️  ║                                                              ║
// ⚠️  ║  1. LIVE-CHATTAR & INKOMNA MAIL (centralsupporten):         ║
// ⚠️  ║     → office IS NULL eller office = 'admin'                 ║
// ⚠️  ║     → owner IS NULL (ingen agent har tagit ärendet)         ║
// ⚠️  ║     → Kunden valde "Centralsupporten" i chatten             ║
// ⚠️  ║     → SKALL vara NULL — det är DESIGN, inte ett fel.        ║
// ⚠️  ║                                                              ║
// ⚠️  ║  2. PLOCKADE ÄRENDEN:                                       ║
// ⚠️  ║     → office IS NOT NULL (kunden valde ett kontor) ELLER    ║
// ⚠️  ║     → owner IS NOT NULL (en agent har tagit ärendet)        ║
// ⚠️  ║     → Båda villkoren i OR är nödvändiga — ta inte bort      ║
// ⚠️  ║       något av dem.                                          ║
// ⚠️  ║                                                              ║
// ⚠️  ║  3. AGENT-FLÖDET (ej admin/support):                        ║
// ⚠️  ║     → Använder getAgentTickets(username) från db.js         ║
// ⚠️  ║     → Matchar på agentens routing_tag — rör inte den        ║
// ⚠️  ║       mappningen utan att förstå db.js fullt ut.            ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  ROUTING_TAG & OFFICE_COLOR — FÖRÄNDRA INTE:                ║
// ⚠️  ║                                                              ║
// ⚠️  ║  • office_color hämtas via LEFT JOIN offices ON             ║
// ⚠️  ║    s.office = o.routing_tag                                 ║
// ⚠️  ║  • routing_tag är PRIMÄRNYCKELN för matchning mot kontor.   ║
// ⚠️  ║  • Om du ändrar kolumnnamn, alias eller JOIN-villkor         ║
// ⚠️  ║    slutar färgkodning och kontorsmatchning att fungera       ║
// ⚠️  ║    i HELA systemet — inte bara här.                         ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  INNAN DU ÄNDRAR NÅGOT HÄR — KONTROLLERA:                  ║
// ⚠️  ║                                                              ║
// ⚠️  ║  □ Har du läst db_oracle_master.md?                         ║
// ⚠️  ║    → Finns i projektmappen. Visar hela DB-schemat,          ║
// ⚠️  ║      routing-taggar, agentmatris och känd data.             ║
// ⚠️  ║                                                              ║
// ⚠️  ║  □ Förstår du skillnaden mellan office (routing_tag) och    ║
// ⚠️  ║    owner (agentnamn)?                                        ║
// ⚠️  ║    → office = vilket kontor ärendet tillhör                 ║
// ⚠️  ║    → owner  = vilken agent som tagit ärendet                ║
// ⚠️  ║    → De är oberoende av varandra.                           ║
// ⚠️  ║                                                              ║
// ⚠️  ║  □ Har du testat med atlas-master-test.js efteråt?          ║
// ⚠️  ║    → Kör: ATLAS_PASSWORD=<lösen> node atlas-master-test.js  ║
// ⚠️  ║    → Alla 7 steg skall visa ✅ PASS.                        ║
// ⚠️  ║                                                              ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, getUserByUsername, getContextRow, upsertContextRow, getV2State, claimTicket, getAgentTickets } = require('../db');
const authenticateToken = require('../middleware/auth');

// Server.js-lokala beroenden injiceras via init()
let io;

router.init = function({ io: _io }) {
io = _io;
};

// -------------------------------------------------------------------------
// ENDPOINT: // POST /api/team/reply - Send Reply via HTTP (For Scripts/Tests)
// -------------------------------------------------------------------------
router.post('/api/team/reply', authenticateToken, async (req, res) => {
try {
const { conversationId, message, role } = req.body;
const agentName = req.user.username;

if (!conversationId || !message) {
return res.status(400).json({ error: "Missing conversationId or message" });
}

console.log(`💬 [API REPLY] ${agentName} svarar på ${conversationId}`);

// 1. Hämta befintlig kontext
const stored = await getContextRow(conversationId);

let contextData = stored?.context_data ?? {
messages: [],
locked_context: {},
linksSentByVehicle: {}
};

// 2. Lägg till svaret
contextData.messages.push({
role: role || 'agent',
content: message,
sender: agentName,
timestamp: Date.now()
});

// 3. Spara till DB
await upsertContextRow({
conversation_id: conversationId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// ✅ GLOBAL UPDATE: Synka API-svar till alla fönster direkt
if (typeof io !== 'undefined') {
io.emit('team:customer_reply', {
conversationId,
message,
sender: agentName,
timestamp: Date.now()
});
}
res.json({ status: 'success', saved_message: message });

} catch (err) {
console.error("❌ API Reply Error:", err);
res.status(500).json({ error: "Database error" });
}
});

// =============================================================================
// ENDPOINT: SKAPA INTERNT MEDDELANDE (Agent till Agent)
// =============================================================================
router.post('/api/team/create-internal', authenticateToken, async (req, res) => {
const { recipient, subject, message } = req.body;
const sender = req.user.username;

if (!recipient || !message) return res.status(400).json({ error: 'Mottagare och meddelande krävs.' });

const conversationId = 'INTERNAL_' + crypto.randomUUID().substring(0, 8);
const timestamp = Math.floor(Date.now() / 1000);

try {
// 1. Skapa ärendet i DB (session_type='internal')
await new Promise((resolve, reject) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, owner, sender, updated_at)
VALUES (?, 'internal', 1, ?, ?, ?)`,
[conversationId, recipient, sender, timestamp],
(err) => err ? reject(err) : resolve()
);
});

// 2. Spara meddelandet i context_store
const initialContext = {
messages: [{
id: crypto.randomUUID(),
sender: sender,
role: 'agent',
text: message,
timestamp: Date.now()
}],
locked_context: {
subject: subject || 'Internt meddelande',
name: sender,
email: 'Internt'
}
};

await upsertContextRow({
conversation_id: conversationId,
last_message_id: 1,
context_data: initialContext,
updated_at: timestamp
});

// ✅ GLOBAL UPDATE: Meddela alla agenter om det nya ärendet direkt
if (typeof io !== 'undefined') {
io.emit('team:new_ticket', { conversationId, owner: recipient });
io.emit('team:update', { type: 'new_message', sessionId: conversationId });
}

res.json({ success: true, conversationId });

} catch (error) {
console.error('Create Internal Error:', error);
res.status(500).json({ error: 'Kunde inte skapa internt meddelande' });
}
});

// =============================================================================
// TEAM ENDPOINTS
// ENDPOINT: // GET /team/inbox - Fetch Unclaimed Tickets (Human Mode)
// -------------------------------------------------------------------------
router.get('/team/inbox', authenticateToken, async (req, res) => {
try {
if (req.user.role === 'admin') {

// ⚠️ LOCK [1/3] — LIVE-CHATTAR (Centralsupporten, oplockade)
// Visar customer-chattar där kunden INTE valt ett specifikt kontor.
// office IS NULL  → kunden valde "Centralsupporten". KORREKT DESIGN.
// office='admin'  → legacy-värde, samma sak.
// owner IS NULL   → ingen agent har tagit ärendet ännu.
// ❌ ÄNDRA INTE: office-filtret. NULL är INTE ett fel — det är Centralsupporten.
// ❌ ÄNDRA INTE: LEFT JOIN offices ON s.office = o.routing_tag (styr office_color).
const sqlLiveChats = `
SELECT s.conversation_id, s.session_type, s.human_mode, s.owner, s.sender,
s.updated_at, s.is_archived, s.office AS routing_tag, o.office_color,
s.name, s.email, s.phone
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND s.session_type = 'customer'
AND s.owner IS NULL
AND (s.office IS NULL OR s.office = 'admin')
ORDER BY s.updated_at ASC
`;

// ⚠️ LOCK [2/3] — INKOMNA MAIL (Centralsupporten, oplockade)
// Samma logik som Live-chattar ovan men för session_type = 'message'.
// Formulärärenden och IMAP-mail utan kontorstillhörighet hamnar här.
// ❌ ÄNDRA INTE: office-filtret eller session_type-villkoret.
// ❌ ÄNDRA INTE: LEFT JOIN — krävs för office_color även om office är NULL.
const sqlMail = `
SELECT s.conversation_id, s.session_type, s.human_mode, s.owner, s.sender,
s.updated_at, s.is_archived, s.office AS routing_tag, o.office_color,
s.name, s.email, s.phone
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND s.session_type = 'message'
AND s.owner IS NULL
AND (s.office IS NULL OR s.office = 'admin')
ORDER BY s.updated_at ASC
`;

// ⚠️ LOCK [3/3] — PLOCKADE ÄRENDEN
// Visar ärenden som har ett kontor ELLER en ägare — dvs hanteras aktivt.
// (s.owner IS NOT NULL OR s.office IS NOT NULL) — BÅDA villkoren krävs i OR:
//   owner IS NOT NULL  → en agent har tagit ärendet (oavsett kontor)
//   office IS NOT NULL → kunden valde ett kontor (kanske ej tagit av agent ännu)
// ❌ ÄNDRA INTE: Ta inte bort något av OR-villkoren — båda fallen ska täckas.
// ❌ ÄNDRA INTE: owner != ? exkluderar admin:s egna ärenden från "Plockade"-listan.
const sqlClaimed = `
SELECT s.conversation_id, s.session_type, s.human_mode, s.owner, s.sender,
s.updated_at, s.is_archived, s.office AS routing_tag, o.office_color,
s.name, s.email, s.phone
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND s.session_type != 'internal'
AND (s.owner IS NOT NULL OR s.office IS NOT NULL)
AND (s.owner IS NULL OR s.owner != ?)
ORDER BY s.updated_at ASC
`;

const runQuery = (sql, params = []) => new Promise((resolve, reject) => {
db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

const [liveChats, mail, claimed] = await Promise.all([
runQuery(sqlLiveChats),
runQuery(sqlMail),
runQuery(sqlClaimed, [req.user.username])
]);

const enrichTickets = async (tickets) => Promise.all(tickets.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
const locked = ctx.locked_context || {};
const messages = ctx.messages || [];
let lastMsg = "Ingen text";
if (messages.length > 0) {
const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
if (lastUserMsg) lastMsg = lastUserMsg.content;
else lastMsg = messages[messages.length - 1].content;
}
return {
...t,
messages,
last_message: lastMsg,
office_color: t.office_color,
contact_name: locked.name || locked.contact_name || locked.full_name || t.name || null,
contact_email: locked.email || locked.contact_email || t.email || null,
contact_phone: locked.phone || locked.contact_phone || t.phone || null,
subject: locked.subject || null,
city: locked.city || null,
vehicle: locked.vehicle || null
};
}));

const [enrichedLive, enrichedMail, enrichedClaimed] = await Promise.all([
enrichTickets(liveChats),
enrichTickets(mail),
enrichTickets(claimed)
]);

res.json({
tickets: [...enrichedLive, ...enrichedMail, ...enrichedClaimed], // Bakåtkompatibilitet
live_chats: enrichedLive,
mail: enrichedMail,
claimed: enrichedClaimed
});

} else {
// Agent-flöde oförändrat
const tickets = await getAgentTickets(req.user.username);
const ticketsWithData = await Promise.all(tickets.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
const locked = ctx.locked_context || {};
const messages = ctx.messages || [];
let lastMsg = "Ingen text";
if (messages.length > 0) {
const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
if (lastUserMsg) lastMsg = lastUserMsg.content;
else lastMsg = messages[messages.length - 1].content;
}
return {
...t,
messages,
last_message: lastMsg,
office_color: t.office_color,
contact_name: locked.name || locked.contact_name || locked.full_name || t.name || null,
contact_email: locked.email || locked.contact_email || t.email || null,
contact_phone: locked.phone || locked.contact_phone || t.phone || null,
subject: locked.subject || null,
city: locked.city || null,
vehicle: locked.vehicle || null
};
}));
res.json({ tickets: ticketsWithData });
}
} catch (err) {
console.error("[TEAM] Inbox error:", err);
res.status(500).json({ error: "Database error" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: GET /team/inbox/search?q=... - Sök i aktiva ärenden
// -------------------------------------------------------------------------
router.get('/team/inbox/search', authenticateToken, async (req, res) => {
const q = (req.query.q || '').trim().toLowerCase();
if (!q) return res.json({ tickets: [] });

try {
const tickets = await new Promise((resolve, reject) => {
const sql = `
SELECT
s.conversation_id,
s.session_type,
s.human_mode,
s.owner,
s.sender,
s.updated_at,
s.is_archived,
s.office AS routing_tag,
o.office_color,
o.city   AS office_city,
o.area   AS office_area,
o.name   AS office_name,
s.name,
s.email,
s.phone
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND (s.session_type IS NULL OR s.session_type != 'internal')
ORDER BY s.updated_at ASC
`;
db.all(sql, (err, rows) => {
if (err) reject(err);
else resolve(rows || []);
});
});

const enriched = await Promise.all(
tickets.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
const locked = ctx.locked_context || {};
const messages = ctx.messages || [];

let lastMsg = "";
if (messages.length > 0) {
const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
if (lastUserMsg) lastMsg = lastUserMsg.content;
else lastMsg = messages[messages.length - 1].content || "";
}

const finalName = locked.name || locked.contact_name || locked.full_name || locked.Name || t.name || t.sender || "";
const email = locked.email || locked.contact_email || t.email || "";
const subject = locked.subject || "";

return {
...t,
messages,
last_message: lastMsg,
contact_name: finalName,
contact_email: email,
contact_phone: locked.phone || locked.contact_phone || t.phone || null,
subject,
city: locked.city || null,
vehicle: locked.vehicle || null
};
})
);

const results = enriched.filter(t => {
return [
t.contact_name,
t.contact_email,
t.subject,
t.last_message,
t.sender,
t.owner,
t.routing_tag,
t.conversation_id,
t.office_city,
t.office_area,
t.office_name
].some(field => field && String(field).toLowerCase().includes(q));
});

res.json({ tickets: results });
} catch (err) {
console.error("[TEAM] Inbox search error:", err);
res.status(500).json({ error: "Sökfel" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: POST /team/claim - Claim Ticket (Atomic Operation)
// -------------------------------------------------------------------------
router.post('/team/claim', authenticateToken, async (req, res) => {
try {
const { conversationId, agentName } = req.body;

if (!conversationId) {
return res.status(400).json({ error: "Missing conversationId" });
}

// 1. Grundregel: Använd inloggad användare
let finalAgentName = req.user ? req.user.username : 'Agent';

// 2. UNDANTAG: Om anropet kommer från "System" (Electron) ELLER "admin"
// så litar vi på namnet som frontend skickar — men vi verifierar att agenten existerar.
if ((finalAgentName === 'System' || finalAgentName === 'admin') && agentName) {
// 🔒 F2.5: Förhindra impersonation — agenten måste finnas i DB
const agentExists = await getUserByUsername(agentName).catch(() => null);
if (!agentExists) {
console.warn(`🚫 [CLAIM] Nekad — agenten "${agentName}" finns inte i systemet.`);
return res.status(400).json({ error: `Agenten "${agentName}" finns inte i systemet.` });
}
finalAgentName = agentName;
}

// 3. SÄKERHET: Om namnet fortfarande är "System" (frontend glömde skicka namn),
// försök sätta det till "Agent" så det inte ser trasigt ut.
if (finalAgentName === 'System') finalAgentName = 'Agent';

// Kontrollera sessionstyp och hämta tidigare ägare INNAN claim
const preState = await getV2State(conversationId);
if (preState?.session_type === 'private') {
return res.status(403).json({
error: "Kan inte plocka privata sessioner",
session_type: 'private'
});
}
const previousOwner = preState?.owner || null;

// Kör claimTicket
await claimTicket(conversationId, finalAgentName);

// Bekräfta
const postState = await getV2State(conversationId);

if (postState?.owner === finalAgentName) {
// ✅ GLOBAL UPDATE: Meddela alla att ärendet har plockats
if (typeof io !== 'undefined') {
io.emit('team:update', {
type: 'ticket_claimed',
sessionId: conversationId,
owner: finalAgentName
});
// 🛡️ Skicka bara ticket_taken/claimed_self vid faktiskt ägarbyte
if (previousOwner !== finalAgentName) {
io.emit('team:ticket_taken', {
conversationId: conversationId,
takenBy: finalAgentName,
previousOwner: previousOwner
});
io.emit('team:ticket_claimed_self', {
conversationId: conversationId,
claimedBy: finalAgentName,
previousOwner: previousOwner
});
}
}

return res.json({
status: "success",
owner: finalAgentName,
previousOwner: previousOwner || null,
session_type: postState.session_type
});
} else {
throw new Error("Ägarskapet uppdaterades inte korrekt.");
}

} catch (err) {
console.error("❌ Claim error:", err);
res.status(500).json({ error: "Failed to claim ticket" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: /team/assign - Tilldela ärende till specifik agent
// -------------------------------------------------------------------------
router.post('/team/assign', authenticateToken, async (req, res) => {
try {
const { conversationId, targetAgent } = req.body;

if (!conversationId || !targetAgent) {
return res.status(400).json({ error: "Missing ID or Target" });
}

// 🔒 F2.2: Admin/support tilldelar fritt.
// Agenter får bara vidarebefordra ärenden de själva äger.
if (req.user.role === 'agent') {
const ticketState = await getV2State(conversationId);
if (!ticketState || ticketState.owner !== req.user.username) {
return res.status(403).json({ error: "Du kan bara vidarebefordra dina egna ärenden." });
}
}

console.log(`👤 [ASSIGN] ${req.user.username} tilldelar ${conversationId} till ${targetAgent}`);

// 🔔 NOTIFIERING: Om ärendet redan har en ägare som inte är targetAgent,
// meddela den nuvarande ägaren att ärendet tagits ifrån dem.
const preAssignState = await getV2State(conversationId);
const previousOwner = preAssignState?.owner || null;
const ownerIsChanging = previousOwner && previousOwner !== targetAgent;

await claimTicket(conversationId, targetAgent);

// ✅ GLOBAL UPDATE: Meddela alla att ärendet har tilldelats
if (typeof io !== 'undefined') {
io.emit('team:update', {
type: 'ticket_claimed',
sessionId: conversationId,
owner: targetAgent
});

// Skicka team:ticket_taken så den tidigare ägarens UI uppdateras med toast
if (ownerIsChanging) {
io.emit('team:ticket_taken', {
conversationId,
takenBy: req.user.username,  // Den som tilldelade (admin/agent)
previousOwner: previousOwner  // Den som förlorade ärendet
});
// Notifiera den nya ägaren (targetAgent) att de fått ett ärende tilldelat
io.emit('team:ticket_claimed_self', {
conversationId,
claimedBy: targetAgent,
previousOwner: previousOwner
});
console.log(`🔔 [ASSIGN] Notifierar ${previousOwner} — ärendet tilldelades ${targetAgent}`);
}
}

res.json({ status: "success", assignedTo: targetAgent });

} catch (err) {
console.error("❌ Assign error:", err);
res.status(500).json({ error: "Failed to assign ticket" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: /team/my-tickets - Fetch Agent's Assigned Tickets
// -------------------------------------------------------------------------
router.get('/team/my-tickets', authenticateToken, async (req, res) => {
try {
// Säkra agent-namn
const agentName = req.teamUser || (req.user ? req.user.username : null);

if (!agentName) {
return res.status(400).json({ error: "Agent identity missing" });
}

// 1. Hämta agentens ärenden
const tickets = await getAgentTickets(agentName);

// 2. Koppla på meddelandehistorik OCH NAMN
const ticketsWithMessages = await Promise.all(
tickets.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
const messages = ctx.messages || [];
const locked = ctx.locked_context || {};

const finalName =
locked.name ||
locked.contact_name ||
locked.full_name ||
locked.Name ||
null;

return {
...t,
messages,
last_message: messages.length > 0 ? (messages[messages.length - 1].content || messages[messages.length - 1].text || '') : "Ingen text",
office_color: t.office_color,
// Skicka med kontaktinfo så frontend kan visa "Anna Andersson" korrekt
contact_name: finalName,
contact_email: locked.email || locked.contact_email || null,
contact_phone: locked.phone || locked.contact_phone || null,
subject: locked.subject || null,
city: locked.city || null,
vehicle: locked.vehicle || null,
is_archived: t.is_archived === 1
};
})
);

res.json({ tickets: ticketsWithMessages });

} catch (err) {
console.error("[TEAM] My Tickets error:", err);
res.status(500).json({ error: "Database error" });
}
});

// ============================================
// HÄMTA ENSKILT ÄRENDE VIA CONVERSATION_ID
// ============================================
router.get('/team/ticket/:conversationId', authenticateToken, async (req, res) => {
  const { conversationId } = req.params;
  try {
    const state = await getV2State(conversationId);
    if (!state) return res.status(404).json({ error: 'Ärende hittades inte' });

    const stored = await getContextRow(conversationId);
    const contextData = stored?.context_data || { messages: [], locked_context: {} };
    const locked = contextData.locked_context || {};

    const finalName = locked.contact_name || locked.name ||
                      locked.Name || locked.full_name ||
                      locked.email || state.owner || null;

    res.json({
      conversation_id: conversationId,
      session_type: state.session_type,
      routing_tag: state.routing_tag,
      owner: state.owner,
      sender: state.sender,
      is_archived: state.is_archived === 1,
      updated_at: state.updated_at,
      subject: locked.subject || null,
      contact_name: finalName,
      contact_email: locked.email || locked.contact_email || null,
      contact_phone: locked.phone || locked.contact_phone || null,
      vehicle: locked.vehicle || null,
      messages: contextData.messages || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// KÄNDA E-POSTADRESSER — För autocomplete i mailkompositor
// ============================================
router.get('/api/team/known-emails', authenticateToken, (req, res) => {
db.all(
`SELECT DISTINCT email FROM chat_v2_state
WHERE email IS NOT NULL AND email != '' AND session_type != 'internal'
ORDER BY email ASC LIMIT 200`,
[],
(err, rows) => {
if (err) return res.status(500).json({ error: 'DB-fel' });
res.json({ emails: rows.map(r => r.email) });
}
);
});

module.exports = router;