// ============================================
// routes/webhook.js — LiveHelperChat Webhook
// VAD DEN GÖR: Tar emot chattmeddelanden och
//              mail från Loveable/LHC, kör RAG
//              och hanterar human-mode trigger.
// ANVÄNDS AV: server.js via app.use('/', webhookRoutes)
//             + webhookRoutes.init({ io, sendToLHC,
//               parseContextData, HUMAN_TRIGGERS,
//               HUMAN_RESPONSE_TEXT })
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, getContextRow, upsertContextRow, getV2State, setHumanMode } = require('../db');
const { runLegacyFlow } = require('../legacy_engine');
const { getTemplatesCached } = require('./templates');

// Server.js-lokala beroenden injiceras via init()
let io, sendToLHC, parseContextData, HUMAN_TRIGGERS, HUMAN_RESPONSE_TEXT;

router.init = function({ io: _io, sendToLHC: _stl, parseContextData: _pcd,
  HUMAN_TRIGGERS: _ht, HUMAN_RESPONSE_TEXT: _hrt }) {
io = _io;
sendToLHC = _stl;
parseContextData = _pcd;
HUMAN_TRIGGERS = _ht;
HUMAN_RESPONSE_TEXT = _hrt;
};

// -------------------------------------------------------------------------
// // HMAC Signature Verification (Webhook Security)
// -------------------------------------------------------------------------
const SIGNATURE_HEADER = 'x-signature';

function verifyHmac(req) {
const signature = req.headers[SIGNATURE_HEADER];
if (!signature) return false;

const secret = process.env.LHC_WEBHOOK_SECRET;
if (!secret) return false;

const computed = crypto
.createHmac('sha256', secret)
.update(req.rawBody)
.digest('hex');

try {
return crypto.timingSafeEqual(
Buffer.from(signature, 'hex'),
Buffer.from(computed, 'hex')
);
} catch {
return false;
}
}

// =========================================================================
// WEBHOOK: Tar emot data från Loveable (Chatt & Kontaktuppgifter)
// =========================================================================
router.post('/webhook/lhc-chat', async (req, res) => {
try {
// 1. HMAC
if (!verifyHmac(req)) {
console.warn("⛔ HMAC verification failed");
return res.status(403).send("Forbidden");
}

const { chat_id, id: incomingId, msg, type: ingestType } = req.body;

// 🔧 F2.4: Type-guard flyttad hit (utanför mail-blocket) — täcker nu även chat och okända typer
if (!ingestType || (ingestType !== 'chat' && ingestType !== 'mail')) {
console.error(`[WEBHOOK] Okänd ingest-typ: "${ingestType}". Avbryter.`);
return res.status(400).json({
error: 'Invalid or missing ingest type',
received: ingestType
});
}

// =====================================================================
// 🧟 ZOMBIE-REVIVAL: ÅTERAKTIVERA ARKIVERADE MAIL-ÄRENDEN
// =====================================================================
// Om ett nytt mail kommer in på ett arkiverat ärende -> Öppna det igen!
// OBS: Gäller ENDAST mail (ingestType === 'mail'), chattar förblir stängda.
if (ingestType === 'mail') {
const stateCheck = await getV2State(chat_id);

if (stateCheck && stateCheck.is_archived === 1) {
console.log(`🧟 [REVIVAL] Nytt mail på arkiverat ärende ${chat_id}. Återaktiverar!`);
await new Promise((resolve) => {
db.run(
`UPDATE chat_v2_state SET is_archived = 0, updated_at = ? WHERE conversation_id = ?`,
[Math.floor(Date.now() / 1000), chat_id],
(err) => resolve()
);
});
await new Promise((resolve) => {
db.run(`UPDATE local_qa_history SET is_archived = 0 WHERE id = ?`, [chat_id], () => resolve());
});
if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'new_message', sessionId: chat_id });
}
}
}

// Validering
if (!chat_id || !incomingId || !msg) {
return res.json({});
}

// 3. Idempotens
const stored = await getContextRow(chat_id);
const lastMessageId = stored?.last_message_id ?? 0;
if (incomingId <= lastMessageId) {
return res.json({});
}

// 4. Human-Mode Interceptor
const v2State = await getV2State(chat_id);

// A) Redan i Human Mode?
if (v2State && v2State.human_mode === 1) {
console.log(`[HUMAN-MODE] ${chat_id} aktiv. Tyst passivitet från bot.`);
return res.json({});
}

// B) Triggas Human Mode nu?
const lowerMsg = msg.toLowerCase();
const isTrigger = HUMAN_TRIGGERS.some(phrase => lowerMsg.includes(phrase));

if (isTrigger) {
console.log(`[HUMAN-MODE] Aktiveras för ${chat_id}`);

// 1. Spara meddelandet i historiken
let storedContext = await getContextRow(chat_id);

// 🔥 FIX: Parsa om sträng (Viktig säkerhetsåtgärd - här togs syntaxfelet bort)
let raw = storedContext?.context_data;
let contextData = parseContextData(raw);

// Säkra att messages är en array innan push (Bevarar din hängsle-och-livrem check)
if (!Array.isArray(contextData.messages)) contextData.messages = [];

contextData.messages.push({ role: 'user', content: msg, timestamp: Date.now() });

await upsertContextRow({
conversation_id: chat_id,
last_message_id: incomingId,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// 2. Aktivera mänskligt läge
await setHumanMode(chat_id, 'customer');

// 3. Skicka bekräftelse till kunden i LHC
await sendToLHC(chat_id, HUMAN_RESPONSE_TEXT);

// ✅ GLOBAL UPDATE: Aktivera human mode-notis för alla
if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'human_mode_triggered', sessionId: chat_id });
}

return res.json({});
}

// 5. RAG Engine
const now = Math.floor(Date.now() / 1000);
const TTL_SECONDS = 60 * 60 * 24 * 30;

let ragVariables = {};

if (stored && stored.context_data && (now - stored.updated_at) <= TTL_SECONDS) {
ragVariables = stored.context_data;
}

const templates = await getTemplatesCached();

const result = await runLegacyFlow(
{ query: msg, sessionId: chat_id, isFirstMessage: false },
ragVariables,
templates
);

// 6. Hantera Svar
if (result.response_payload === "ESKALERA") {
return res.json({});
}

const updatedContextData = {
messages: (stored && stored.context_data && stored.context_data.messages) ? stored.context_data.messages : [],
locked_context: result.new_context?.locked_context || ragVariables?.locked_context || { city: null, area: null, vehicle: null },
linksSentByVehicle: result.new_context?.linksSentByVehicle || ragVariables?.linksSentByVehicle || { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

updatedContextData.messages.push({ role: 'user', content: msg, timestamp: Date.now() });
updatedContextData.messages.push({ role: 'atlas', content: result.response_payload, timestamp: Date.now() });

await upsertContextRow({
conversation_id: chat_id,
last_message_id: incomingId,
context_data: updatedContextData, // 🔧 F1.4: var contextData (gammal variabel) — nu rätt
updated_at: now
});

// Sätt session_type till 'bot' om human_mode inte är aktivt
if (!v2State || v2State.human_mode !== 1) {

await new Promise((resolve) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, owner, updated_at)
VALUES (?, 'bot', 0, NULL, ?)
ON CONFLICT(conversation_id) DO UPDATE SET session_type = 'bot'`,
[chat_id, now],
() => resolve()
);
});
}
await sendToLHC(chat_id, result.response_payload);
// ✅ GLOBAL UPDATE: Slutgiltig synkning för webhook-meddelandet
if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'new_message', sessionId: chat_id });
}
res.json({});

} catch (err) {
console.error("Webhook error:", err);
res.status(500).send("Server Error");
}
});

module.exports = router;
