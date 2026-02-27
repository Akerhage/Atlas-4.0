// ============================================
// routes/team.js — Team & Inkorg-endpoints
// VAD DEN GÖR: Svar, interna meddelanden,
//              inkorg, sökning, claim, assign
//              och mina ärenden för agenter.
// ANVÄNDS AV: server.js via app.use('/', teamRoutes)
//             + teamRoutes.init({ io })
// SENAST STÄDAD: 2026-02-27
// ============================================
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
timestamp: Date.now() // <--- LÄGG TILL DENNA RAD
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
role: 'agent', // <--- LÄGG TILL DENNA! VIKTIGT FÖR RENDERER!
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
if (req.user.role === 'admin' || req.user.role === 'support') {

const sqlLiveChats = `
SELECT s.conversation_id, s.session_type, s.human_mode, s.owner, s.sender,
s.updated_at, s.is_archived, s.office AS routing_tag, o.office_color
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND (s.session_type IS NULL OR s.session_type != 'internal')
AND (s.office = 'admin' OR s.office IS NULL)
AND s.session_type = 'customer'
AND s.owner IS NULL
ORDER BY s.updated_at ASC
`;

const sqlMail = `
SELECT s.conversation_id, s.session_type, s.human_mode, s.owner, s.sender,
s.updated_at, s.is_archived, s.office AS routing_tag, o.office_color
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND (s.session_type IS NULL OR s.session_type != 'internal')
AND (s.office = 'admin' OR s.office IS NULL)
AND s.session_type = 'message'
AND s.owner IS NULL
ORDER BY s.updated_at ASC
`;

const sqlClaimed = `
SELECT s.conversation_id, s.session_type, s.human_mode, s.owner, s.sender,
s.updated_at, s.is_archived, s.office AS routing_tag, o.office_color
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND (s.session_type IS NULL OR s.session_type != 'internal')
AND s.office IS NOT NULL
AND s.office != 'admin'
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
contact_name: locked.name || locked.contact_name || locked.full_name || null,
contact_email: locked.email || locked.contact_email || null,
contact_phone: locked.phone || locked.contact_phone || null,
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
contact_name: locked.name || locked.contact_name || locked.full_name || null,
contact_email: locked.email || locked.contact_email || null,
contact_phone: locked.phone || locked.contact_phone || null,
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
o.office_color
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

const finalName = locked.name || locked.contact_name || locked.full_name || locked.Name || t.sender || "";
const email = locked.email || locked.contact_email || "";
const subject = locked.subject || "";

return {
...t,
messages,
last_message: lastMsg,
contact_name: finalName,
contact_email: email,
contact_phone: locked.phone || locked.contact_phone || null,
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
t.conversation_id
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

console.log(`[CLAIM DEBUG] Inloggad: "${finalAgentName}", Skickat namn: "${agentName}"`);

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

console.log(`[TEAM] Slutgiltig ägare för ${conversationId}: ${finalAgentName}`);

// Kontrollera sessionstyp
const preState = await getV2State(conversationId);
if (preState?.session_type === 'private') {
return res.status(403).json({
error: "Kan inte plocka privata sessioner",
session_type: 'private'
});
}

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
io.emit('team:ticket_taken', {
conversationId: conversationId,
takenBy: finalAgentName
});
}

return res.json({
status: "success",
owner: finalAgentName,
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
// 🔒 F2.2: Vanliga agenter får inte tilldela ärenden — kräver support eller admin
if (req.user.role === 'agent') {
return res.status(403).json({ error: "Endast admin/support kan tilldela ärenden." });
}
try {
const { conversationId, targetAgent } = req.body;

if (!conversationId || !targetAgent) {
return res.status(400).json({ error: "Missing ID or Target" });
}

console.log(`👤 [ASSIGN] ${req.user.username} tilldelar ${conversationId} till ${targetAgent}`);
await claimTicket(conversationId, targetAgent);

// ✅ GLOBAL UPDATE: Meddela alla att ärendet har tilldelats
if (typeof io !== 'undefined') {
io.emit('team:update', {
type: 'ticket_claimed',
sessionId: conversationId,
owner: targetAgent
});
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

// 🔥 SMART NAMN-HÄMTNING (Fixad mappning)
const finalName =
locked.name ||
locked.contact_name ||
locked.full_name ||
locked.Name ||
null;

return {
...t,
messages,
last_message: messages.length > 0 ? messages[messages.length - 1].content : "Ingen text",
office_color: t.office_color, // ✅ DEFINITIV FIX: Tvingar med färgen
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

module.exports = router;
