// ============================================
// routes/archive.js — Arkiv, inkorg & sökning
// VAD DEN GÖR: Raderar/arkiverar ärenden,
//              hämtar arkivvy och kör RAG-sökning
//              (search_all) från Renderer-klienten.
// ANVÄNDS AV: server.js via app.use('/', archiveRoutes)
//             + archiveRoutes.init({ io, parseContextData,
//               assertValidContext, mergeContext })
// ============================================
const express = require('express');
const router = express.Router();
const { db, deleteConversation, getContextRow, upsertContextRow } = require('../db');
const { runLegacyFlow } = require('../legacy_engine');
const { getTemplatesCached } = require('./templates');
const authenticateToken = require('../middleware/auth');
const fs = require('fs');

// Server.js-lokala beroenden injiceras via init()
let io, parseContextData, assertValidContext, mergeContext;

router.init = function({ io: _io, parseContextData: _pcd, assertValidContext: _avc, mergeContext: _mc }) {
io = _io;
parseContextData = _pcd;
assertValidContext = _avc;
mergeContext = _mc;
};

// =============================================================================
// CLIENT API ENDPOINTS
// =============================================================================

// -------------------------------------------------------------------------
// ENDPOINT: // POST /search_all - Renderer Client Search (Requires API Key)
// -------------------------------------------------------------------------
router.post('/search_all', async (req, res) => {
const clientKey = req.headers['x-api-key'];
if (clientKey !== process.env.CLIENT_API_KEY) {
return res.status(401).json({ error: 'Ogiltig API-nyckel' });
}
try {
const { query, sessionId, isFirstMessage } = req.body;
if (!query || !query.trim()) return res.status(400).json({ error: 'Tom fråga' });
if (!sessionId) return res.status(400).json({ error: 'sessionId saknas' });

const now = Math.floor(Date.now() / 1000);
const TTL_SECONDS = 60 * 60 * 24 * 30;

let storedContext = await getContextRow(sessionId);

let contextData = {
messages: [],
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

let lastMessageId = 0;

if (!storedContext || storedContext.updated_at < now - TTL_SECONDS) {
// Ny session eller utgången TTL — börja med tomt context
} else {
if (storedContext.context_data) {
contextData = parseContextData(storedContext.context_data);
}
lastMessageId = storedContext.last_message_id || 0;
}

// 1. Lägg till USER query i historiken
contextData.messages.push({ role: 'user', content: query, timestamp: Date.now() });

const templates = await getTemplatesCached();

// 2. Kör legacy flow 26/12
const result = await runLegacyFlow(
{ query, sessionId, isFirstMessage, sessionContext: contextData.messages },
contextData,  // Hela objektet skickas vidare
templates
);

// 3. Extrahera svaret till text
let responseText = "";
if (typeof result.response_payload === 'string') {
responseText = result.response_payload;
} else if (result.response_payload && result.response_payload.answer) {
responseText = result.response_payload.answer;
} else {
responseText = JSON.stringify(result.response_payload);
}

// 4. Lägg till ATLAS svar i historiken
contextData.messages.push({ role: 'atlas', content: responseText, timestamp: Date.now() });

assertValidContext(result.new_context, 'ragSync');
contextData = mergeContext(contextData, result.new_context);


// 5. Spara state
await upsertContextRow({
conversation_id: sessionId,
last_message_id: lastMessageId + 1,
context_data: contextData,
updated_at: now
});

// 6. Skicka rent svar till frontend
res.json({
answer: responseText,
sessionId: sessionId,
locked_context: contextData.locked_context,  // ✅ RÄTT!
context: result.response_payload?.context || []
});

} catch (err) {
console.error("❌ /search_all ERROR", err);
res.status(500).json({ error: "Internal Server Error" });
}
});

// =============================================================================
// INBOX MANAGEMENT ENDPOINTS
// ENDPOINT: /api/inbox/delete (RADERA FRÅGA TOTALT)
// -------------------------------------------------------------------------
router.post('/api/inbox/delete', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
const { conversationId } = req.body;

if (!conversationId) {
return res.status(400).json({ error: "Missing conversationId" });
}

console.log(`🗑️ Mottog begäran att radera: ${conversationId}`);

try {
// Intern sekretess: interna ärenden får bara raderas av owner eller sender.
// Förhindrar att en admin råkar (eller medvetet) radera andras interna konversationer.
const internalCheck = await new Promise((resolve, reject) => {
db.get(
'SELECT session_type, owner, sender FROM chat_v2_state WHERE conversation_id = ?',
[conversationId],
(err, row) => err ? reject(err) : resolve(row)
);
});
if (
internalCheck &&
internalCheck.session_type === 'internal' &&
internalCheck.owner !== req.user.username &&
internalCheck.sender !== req.user.username
) {
console.warn(`🚫 [DELETE] ${req.user.username} nekad — internt ärende tillhör ${internalCheck.owner}/${internalCheck.sender}`);
return res.status(403).json({ error: 'Du kan inte radera andras interna ärenden.' });
}

// Radera uppladdade filer från disk innan ärendet raderas
await new Promise((resolve) => {
db.all(
'SELECT filepath FROM uploaded_files WHERE conversation_id = ? AND deleted = 0',
[conversationId],
(err, rows) => {
if (!err && rows) {
for (const row of rows) {
try {
if (fs.existsSync(row.filepath)) {
fs.unlinkSync(row.filepath);
}
} catch (e) {
console.warn('[Delete] Kunde inte radera fil:', e.message);
}
}
}
resolve();
}
);
});
// 1. Vi kör städningen i databasen
await deleteConversation(conversationId);
console.log(`✅ Ärende ${conversationId} raderat permanent från DB.`);

// Global update: radera ärendet från alla agenters listor direkt
if (typeof io !== 'undefined') {
// Vi skickar till alla så att vyn uppdateras för samtliga kollegor
io.emit('team:update', {
type: 'inbox_cleared',
sessionId: conversationId
});

io.emit('team:session_status', {
conversationId,
status: 'deleted'
});
}

res.json({ status: 'success' });
} catch (err) {
console.error("❌ Delete inbox error:", err);
return res.status(500).json({ error: "Kunde inte radera ärendet" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/inbox/archive (ARKIVERA UTAN ATT RADERA)
// -------------------------------------------------------------------------
router.post('/api/inbox/archive', authenticateToken, async (req, res) => {
// Agenter får arkivera sina egna ärenden. Admin/support får arkivera alla (utom andras interna).
const { conversationId } = req.body;

if (!conversationId) {
return res.status(400).json({ error: "Missing conversationId" });
}

// Alla inloggade agenter och admins får arkivera kundärenden.

// Intern sekretess: interna ärenden får bara arkiveras av owner eller sender.
try {
const internalCheck = await new Promise((resolve, reject) => {
db.get(
'SELECT session_type, owner, sender FROM chat_v2_state WHERE conversation_id = ?',
[conversationId],
(err, row) => err ? reject(err) : resolve(row)
);
});
if (
internalCheck &&
internalCheck.session_type === 'internal' &&
internalCheck.owner !== req.user.username &&
internalCheck.sender !== req.user.username
) {
console.warn(`🚫 [ARCHIVE] ${req.user.username} nekad — internt ärende tillhör ${internalCheck.owner}/${internalCheck.sender}`);
return res.status(403).json({ error: 'Du kan inte arkivera andras interna ärenden.' });
}
} catch (checkErr) {
console.error('Archive ownership check error:', checkErr);
return res.status(500).json({ error: 'Kunde inte verifiera ärendeägarskap' });
}

const now = Math.floor(Date.now() / 1000);

const closeReason = `agent:${req.user.username}`;
db.serialize(() => {
// 1. Uppdatera chat_v2_state (om ärendet finns där)
db.run(`
UPDATE chat_v2_state
SET is_archived = 1,
close_reason = ?,
updated_at = ?
WHERE conversation_id = ?
`, [closeReason, now, conversationId], function(err) {
if (err) {
console.error("Archive Error (chat_v2_state):", err);
return res.status(500).json({ error: "Kunde inte arkivera ärendet" });
}

const stateChanges = this.changes;

// 2. Uppdatera local_qa_history (om ärendet finns där)
db.run(`
UPDATE local_qa_history
SET is_archived = 1
WHERE id = ?
`, [conversationId], function(err) {
if (err) {
console.error("Archive Error (local_qa_history):", err);
// Fortsätt ändå - det kanske bara fanns i en tabell
}

const historyChanges = this.changes;

// 3. Verifiera att minst EN rad påverkades
if (stateChanges === 0 && historyChanges === 0) {
console.warn(`⚠️ Archive: Ingen rad påverkades för ${conversationId}`);
return res.status(404).json({
error: "Ärendet hittades inte i databasen",
conversationId
});
}

// Global update: arkivera ärendet för alla
if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'ticket_archived', sessionId: conversationId });
io.emit('team:session_status', { conversationId, status: 'archived', message: 'Handläggaren har avslutat denna konversation.' });
}
res.json({
status: 'success',
changes: stateChanges + historyChanges
});
});
});
});
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/archive (UPPDATERAD MED KONTAKT-DATA & SÖKBARHET)
// -------------------------------------------------------------------------
router.get('/api/archive', authenticateToken, (req, res) => {
const sql = `
SELECT
s.conversation_id,
s.updated_at,
s.owner,
s.session_type,
s.sender,
s.human_mode,
s.office,
s.name,
s.email,
s.phone,
s.close_reason,
o.office_color,
c.context_data
FROM chat_v2_state s
LEFT JOIN context_store c ON s.conversation_id = c.conversation_id
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.is_archived = 1
AND (
s.session_type != 'internal'
OR (s.session_type = 'internal' AND (s.owner = ? OR s.sender = ?))
)
AND (
s.session_type != 'private'
OR s.owner = ?
)
ORDER BY s.updated_at DESC
LIMIT 500
`;
db.all(sql, [req.user.username, req.user.username, req.user.username], (err, rows) => {
if (err) {
console.error("Archive DB Error:", err);
return res.status(500).json({ error: "Kunde inte ladda arkivet" });
}

const cleanRows = rows.map(row => {
let ctx = {};
try {
ctx = (typeof row.context_data === 'string') ? JSON.parse(row.context_data) : (row.context_data || {});
} catch(e) {
ctx = {};
console.error('[server] Korrupt context_data:', row.conversation_id, e.message);
}

const locked = ctx.locked_context || {};
const msgs = ctx.messages || [];

let question = "Inget meddelande";
if (msgs.length > 0) {
const firstUser = msgs.find(m => m.role === 'user');
if (firstUser) question = firstUser.content;
} else if (locked.subject) {
question = locked.subject;
}

return {
conversation_id: row.conversation_id,
timestamp: row.updated_at * 1000,
owner: row.owner,
human_mode: row.human_mode,
office_color: row.office_color,
session_type: row.session_type,
question: question,
answer: msgs || [],
routing_tag: row.office,
contact_name: locked.name || locked.contact_name || locked.Name || locked.full_name || row.name || null,
contact_email: locked.email || row.email || null,
contact_phone: locked.phone || row.phone || null,
city: locked.city || null,
vehicle: locked.vehicle || null,
subject: locked.subject || null,
close_reason: row.close_reason || null
};
});

res.json({ archive: cleanRows });
});
});

// -------------------------------------------------------------------------
// ENDPOINT: GET /api/archive/ai — Hämtar rena AI-chattar från context_store
// Anropas BARA när agenten explicit kryssar i AI-SVAR-checkboxen i Garaget.
// Returnerar aldrig chattar som eskalerats till chat_v2_state.
// -------------------------------------------------------------------------
router.get('/api/archive/ai', authenticateToken, (req, res) => {
const now = Math.floor(Date.now() / 1000);
const cutoff = now - (60 * 60 * 24 * 90); // 90 dagar bakåt
const offset = parseInt(req.query.offset, 10) || 0;

// Hämta bara rena AI-chattar: finns i context_store men INTE i chat_v2_state
const sql = `
SELECT c.conversation_id, c.context_data, c.updated_at
FROM context_store c
WHERE c.updated_at > ?
AND c.conversation_id NOT IN (
SELECT conversation_id FROM chat_v2_state
)
ORDER BY c.updated_at DESC
LIMIT 100 OFFSET ?
`;

db.all(sql, [cutoff, offset], (err, rows) => {
if (err) {
console.error('❌ /api/archive/ai DB-fel:', err);
return res.status(500).json({ error: 'Kunde inte hämta AI-chattar' });
}

const ai_chats = rows.map(row => {
let ctx = {};
try {
ctx = typeof row.context_data === 'string'
? JSON.parse(row.context_data)
: (row.context_data || {});
} catch (e) { ctx = {}; }

const msgs = ctx.messages || [];
const locked = ctx.locked_context || {};
const firstUser = msgs.find(m => m.role === 'user');
const question = firstUser ? firstUser.content : 'AI-chatt utan meddelande';

return {
conversation_id: row.conversation_id,
timestamp: row.updated_at * 1000,
human_mode: 0,
session_type: 'customer',
owner: null,
routing_tag: null,
office_color: null,
question,
answer: msgs,
contact_name: locked.name || locked.contact_name || locked.Name || locked.full_name || null,
contact_email: locked.email || null,
contact_phone: locked.phone || null,
city: locked.city || null,
vehicle: locked.vehicle || null,
subject: locked.subject || null,
close_reason: null
};
});

res.json({ ai_chats, offset, hasMore: rows.length === 100 });
});
});

// -------------------------------------------------------------------------
// STÄDJOBB: Rensar gamla AI-chattar från context_store en gång per dygn.
// Raderar BARA rader äldre än 90 dagar som INTE finns i chat_v2_state
// (dvs aldrig eskalerade ärenden — rena AI-chattar).
// -------------------------------------------------------------------------
function runAIChatCleanup() {
const now = Math.floor(Date.now() / 1000);
const cutoff = now - (60 * 60 * 24 * 90);

db.run(
`DELETE FROM context_store
WHERE updated_at < ?
AND conversation_id NOT IN (SELECT conversation_id FROM chat_v2_state)`,
[cutoff],
function (err) {
if (err) {
console.error('❌ [AI-cleanup] Städning misslyckades:', err.message);
} else if (this.changes > 0) {
console.log(`🧹 [AI-cleanup] Raderade ${this.changes} gamla AI-chattar från context_store.`);
}
}
);
}

// Kör 10 sekunder efter serverstart, sedan var 24:e timme
setTimeout(runAIChatCleanup, 10 * 1000);
setInterval(runAIChatCleanup, 24 * 60 * 60 * 1000);

module.exports = router;