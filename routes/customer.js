// ============================================
// routes/customer.js — Publika kundendpoints
// VAD DEN GÖR: Tar emot chattmeddelanden och
//              formulärärenden från kundwidgeten.
//              Ingen auth krävs (publika endpoints).
// ANVÄNDS AV: server.js via app.use('/api', customerRoutes)
//             + customerRoutes.init({ io, handleChatMessage })
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, getContextRow, upsertContextRow, getV2State } = require('../db');

// Server.js-lokala beroenden injiceras via init()
let io;
let handleChatMessage;

router.init = function({ io: _io, handleChatMessage: _hcm }) {
io = _io;
handleChatMessage = _hcm;
};

// =====================================================================
// 🌍 PUBLIC CUSTOMER CHAT ENDPOINT (NO AUTH, NO SOCKET, SAFE)
// =====================================================================
router.post("/customer/message", async (req, res) => {
try {
const { sessionId, message } = req.body;

if (!sessionId || !message) {
return res.status(400).json({ error: "sessionId and message are required" });
}

const now = Math.floor(Date.now() / 1000);

// 1. KONTROLLERA HUMAN MODE STATUS
const v2State = await getV2State(sessionId);

// --- 🛑 GATEKEEPER: OM HUMAN MODE ÄR PÅ ---
if (v2State && v2State.human_mode === 1) {
console.log(`🛑 [HUMAN-MODE ACTIVE] Hoppar över AI för ${sessionId}. Notifierar agent.`);

// A. Spara kundens meddelande i historiken
let storedContext = await getContextRow(sessionId);
let contextData = (storedContext && storedContext.context_data)
? storedContext.context_data
: { messages: [], locked_context: { city: null, area: null, vehicle: null } };

if (!contextData.messages) contextData.messages = [];
contextData.messages.push({ role: 'user', content: message, timestamp: Date.now() });

await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: now
});

// B. Meddela agenten via Socket (Global synk utan rum)
if (typeof io !== 'undefined') {
io.emit('team:customer_message', { conversationId: sessionId, message: message, sender: 'user', timestamp: now });
io.emit('team:customer_reply', { conversationId: sessionId, message: message, sender: 'user', timestamp: now });
io.emit('team:update', { type: 'new_message', sessionId: sessionId });
}

return res.json({ success: true, status: 'forwarded_to_agent', human_mode: true });
}

// --- 🤖 OM INTE HUMAN MODE: KÖR AI SOM VANLIGT ---
const stored = await getContextRow(sessionId);
const hasHistory = stored && stored.context_data && stored.context_data.messages && stored.context_data.messages.length > 0;

const response = await handleChatMessage({
query: message,
sessionId,
isFirstMessage: !hasHistory,
session_type: "customer",
providedContext: req.body.context
});

res.json(response);

} catch (err) {
console.error("❌ Customer chat endpoint error:", err);
res.status(500).json({ error: "Internal server error" });
}
});

// =====================================================================
// 📥 GET HISTORY (För Loveable Pollning)
// =====================================================================
router.get("/customer/history/:sessionId", async (req, res) => {
try {
const { sessionId } = req.params;
const stored = await getContextRow(sessionId);
const state = await getV2State(sessionId);

const messages = stored?.context_data?.messages || [];

res.json({
success: true,
history: messages,
messages: messages,
human_mode: state?.human_mode === 1,
is_archived: state?.is_archived === 1   // ← NY RAD
});
} catch (err) {
console.error("❌ History API Error:", err);
res.status(500).json({ error: "Internt serverfel" });
}
});

// =====================================================================
// 📨 CUSTOMER MESSAGE FORM (NO CHAT, NO SOCKET, INBOX ONLY)
// =====================================================================
router.post("/customer/message-form", async (req, res) => {
try {
const { name, email, phone, subject, message, city, area, vehicle } = req.body;

if (!name || !email || !message) {
return res.status(400).json({
error: "name, email and message are required"
});
}

// Skapa ett unikt ärende-id
const conversationId = crypto.randomUUID();
const now = Math.floor(Date.now() / 1000);

// 1. Spara till chat_v2_state (Nu med dedikerade kolumner för sökbarhet och snyggare Inkorg)
const { agent_id } = req.body;
await new Promise((resolve, reject) => {
db.run(
`
INSERT INTO chat_v2_state (
conversation_id,
session_type,
human_mode,
owner,
office,
updated_at,
name,
email,
phone,
source,
is_archived
) VALUES (?, 'message', 1, NULL, ?, ?, ?, ?, ?, 'form', 0)
`,
[
conversationId,
agent_id || null,
now,
name,
email,
phone
],
err => (err ? reject(err) : resolve())
);
});

// 2. Spara till context_store (För historik och detaljvy)
await upsertContextRow({
conversation_id: conversationId,
last_message_id: 1,
context_data: {
messages: [
{
role: "user",
content: message,
timestamp: Date.now()
}
],
locked_context: {
name,
email,
phone,
subject,
city: city || null,
area: area || null,
vehicle: vehicle || null
}
},
updated_at: now
});

// ✅ GLOBAL UPDATE: Nytt ärende från formulär synkas direkt för alla agenter
if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'new_message', sessionId: conversationId });
}

res.json({
success: true,
sessionId: conversationId
});

} catch (err) {
console.error("❌ Message form error:", err);
res.status(500).json({
error: "Internal server error"
});
}
});

module.exports = router;
