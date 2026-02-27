// ============================================
// routes/archive.js — Arkiv, inkorg & sökning
// VAD DEN GÖR: Raderar/arkiverar ärenden,
//              hämtar arkivvy och kör RAG-sökning
//              (search_all) från Renderer-klienten.
// ANVÄNDS AV: server.js via app.use('/', archiveRoutes)
//             + archiveRoutes.init({ io, parseContextData,
//               assertValidContext, mergeContext })
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const { db, deleteConversation, getContextRow, upsertContextRow } = require('../db');
const { runLegacyFlow } = require('../legacy_engine');
const { getTemplatesCached } = require('./templates');
const authenticateToken = require('../middleware/auth');

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
console.log("🧪 /search_all HIT", req.body);
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
console.log(`[SESSION] Ny/Reset: ${sessionId}`);
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
contextData,  // ✅ HELA OBJEKTET
templates
);

// 3. EXTRAHERA SVARET TILL TEXT (Kritisk fix för "text.replace error")
let responseText = "";
if (typeof result.response_payload === 'string') {
responseText = result.response_payload;
} else if (result.response_payload && result.response_payload.answer) {
responseText = result.response_payload.answer;
} else {
responseText = JSON.stringify(result.response_payload);
}

// 4. Lägg till ATLAS svar i historiken
contextData.messages.push({ role: 'atlas', content: responseText, timestamp: Date.now() });;

/* --- UPPDATERA VARIABLER: 2/2 SÄKRAD RAG-ÅTERFÖRING --- */
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
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { conversationId } = req.body;

if (!conversationId) {
return res.status(400).json({ error: "Missing conversationId" });
}

console.log(`🗑️ Mottog begäran att radera: ${conversationId}`);

try {
// 1. Vi kör städningen i databasen
await deleteConversation(conversationId);
console.log(`✅ Ärende ${conversationId} raderat permanent från DB.`);

// 2. ✅ GLOBAL UPDATE: Radera ärendet från alla agenters listor direkt (utan rum)
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
router.post('/api/inbox/archive', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { conversationId } = req.body;

if (!conversationId) {
return res.status(400).json({ error: "Missing conversationId" });
}
const now = Math.floor(Date.now() / 1000);

// 🔥 FIX: Sätter is_archived = 1 i BÅDE chat_v2_state OCH local_qa_history
db.serialize(() => {
// 1. Uppdatera chat_v2_state (om ärendet finns där)
db.run(`
UPDATE chat_v2_state
SET is_archived = 1,
updated_at = ?
WHERE conversation_id = ?
`, [now, conversationId], function(err) {
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

// ✅ GLOBAL UPDATE: Arkivera ärendet för alla
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
contact_name: locked.name || locked.contact_name || locked.Name || locked.full_name || null,
contact_email: locked.email || null,
contact_phone: locked.phone || null,
city: locked.city || null,
vehicle: locked.vehicle || null,
subject: locked.subject || null
};
});

res.json({ archive: cleanRows });
});
});

module.exports = router;
