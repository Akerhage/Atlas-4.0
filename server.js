// ============================================
// server.js
// VAD DEN GÖR: Express HTTP-server + Socket.io. Hanterar auth, ärenden, templates, mail och RAG-pipeline.
// ANVÄNDS AV: main.js (Electron entry point)
// SENAST STÄDAD: 2026-02-27
// ============================================
const path = require('path');
const isPackaged = process.env.IS_PACKAGED === 'true';

// Laddar .env baserat på miljö (Utveckling vs Packad App/EXE)
require('dotenv').config({ 
path: isPackaged ? path.join(process.cwd(), '.env') : path.join(__dirname, '.env') 
});

function getWritablePath(relativePath) {
const base = isPackaged ? process.env.ATLAS_ROOT_PATH : __dirname;
return path.join(base, relativePath);
}

console.log("🚀 server.js bootar");
// Säkra env-debuggar (visar närvaro, inte hemliga värden)
console.log('[ENV] Verifierar viktiga variabler: ', {
EMAIL_USER: !!process.env.EMAIL_USER,
EMAIL_PASS: process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.length} chars` : false,
NGROK_TOKEN: !!process.env.NGROK_TOKEN,
JWT_SECRET: !!process.env.JWT_SECRET,
OPENAI_API_KEY: !!process.env.OPENAI_API_KEY
});

const SERVER_VERSION = "3.8"; 
const express = require('express');
const crypto = require('crypto');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const multer = require('multer');
const imapSimple = require('imap-simple');
const { simpleParser } = require('mailparser');
const { 
db, getUserByUsername, 
createUser, 
getAllTemplates, 
getContextRow, 
upsertContextRow, 
getV2State, 
setHumanMode, 
claimTicket, 
getTeamInbox, 
getAgentTickets, 
updateTicketFlags, 
getAllOffices,
deleteConversation, 
updateUserPassword, 
addTicketNote, 
getTicketNotes, 
updateTicketNote, 
deleteTicketNote,
getTicketNoteById
} = require('./db');
const authenticateToken = require('./middleware/auth');

// =============================================================================
// HELPER: Säker parsning av context_data (sträng eller objekt → normaliserat objekt)
// =============================================================================
function parseContextData(raw) {
try {
// 1. Om data saknas helt, returnera din standardstruktur direkt
if (!raw) {
return {
messages: [],
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};
}

// 2. Försök parsa om det är en sträng, annars använd objektet
let data = (typeof raw === 'string') ? JSON.parse(raw) : raw;

// Säkerställ att vi faktiskt har ett objekt efter parsing
if (!data || typeof data !== 'object') data = {};

// 3. Sanitering: Tvinga fram korrekt struktur på underobjekten
if (!Array.isArray(data.messages)) {
data.messages = [];
}

if (!data.locked_context) {
data.locked_context = { city: null, area: null, vehicle: null };
}

if (!data.linksSentByVehicle) {
data.linksSentByVehicle = { 
AM: false, 
MC: false, 
CAR: false, 
INTRO: false, 
RISK1: false, 
RISK2: false 
};
}

return data;
} catch (e) {
// 4. Logga felet för felsökning men låt servern leva vidare
console.error("[Atlas Server] JSON Parse Error i kontext:", e.message);
return {
messages: [],
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};
}
}

// =============================================================================
// HELPERS: Drift-inställningar (settings-tabellen)
// =============================================================================
let imapEnabled    = true;
let backupInterval = 24;   // timmar
let backupPath = getWritablePath('backups');
let jwtExpiresIn   = '24h';
let autoHumanExit  = false;
let backupTimerId  = null;          // Referens för att kunna reschedulera backup-intervallet
let aiEnabled      = !!process.env.OPENAI_API_KEY; // Globalt AI-lås — stängs av om nyckeln saknas

// 🔒 F2.3: In-memory brute-force-skydd för login (max 5 fel / 15 min per IP)
const loginAttempts = new Map(); // ip → { count, firstAttempt }
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 minuter

// 🔒 F3.2: Race-guard för Human Mode — förhindrar dubbla triggrar vid simultana HTTP+Socket-anrop
const humanModeLocks = new Set(); // conversationId → låst under ~3 sek

function getSetting(key, defaultVal) {
return new Promise((resolve) => {
db.get("SELECT value FROM settings WHERE key = ?", [key], (err, row) => {
resolve(row ? row.value : defaultVal);
});
});
}
function setSetting(key, value) {
db.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
[key, String(value)]);
}

async function loadOperationSettings() {
imapEnabled    = (await getSetting('imap_enabled',   'true')) === 'true';
backupInterval = parseInt(await getSetting('backup_interval_hours', '24'), 10) || 24;
backupPath     = await getSetting('backup_path', path.join(__dirname, 'backups'));
jwtExpiresIn   = await getSetting('jwt_expires_in', '24h');
autoHumanExit  = (await getSetting('auto_human_exit', 'false')) === 'true';
console.log(`✅ [Settings] IMAP:${imapEnabled} Backup:${backupInterval}h JWT:${jwtExpiresIn} AutoExit:${autoHumanExit}`);
}

// === MAIL CONFIGURATION (NODEMAILER) ===
// `let` istället för `const` så att transporter kan återskapas vid hot-reload av e-postuppgifter
let mailTransporter = nodemailer.createTransport({
service: 'gmail',
auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}
});

// Hot-reload: Återskapar transporter med aktuella process.env-värden (anropas när EMAIL_USER/PASS ändras)
function recreateMailTransporter() {
try {
mailTransporter = nodemailer.createTransport({
service: 'gmail',
auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}
});
console.log(`✅ [HotReload] mailTransporter återskapad för ${process.env.EMAIL_USER}`);
} catch (err) {
console.error('❌ [HotReload] Kunde inte återskapa mailTransporter:', err.message);
}
}

// === AUTH DEPENDENCIES ===
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
console.error("❌ KRITISKT FEL: JWT_SECRET saknas i .env! Servern stängs av för din säkerhet.");
process.exit(1); 
}

// HUMAN MODE TRIGGERS & RESPONSES
const HUMAN_TRIGGERS = [
"prata med människa",
"kundtjänst",
"jag vill ha personal",
"människa"
];
const HUMAN_RESPONSE_TEXT = "Jag kopplar dig till en mänsklig kollega.";
const { runLegacyFlow, loadKnowledgeBase } = require('./legacy_engine');
const OpenAI = require('openai');

// ==================================================
// 🔁 GEMENSAM CHAT HANDLER (SOCKET + CUSTOMER CHAT)
// ==================================================
async function handleChatMessage({
query,
sessionId,
isFirstMessage,
session_type,
providedContext
}) {
console.log(`[CHAT] Message received:`, query);

if (!query || !sessionId) {
return { answer: "", sessionId };
}

// --- ZOMBIE KILLER ---
const v2State = await getV2State(sessionId);
if (v2State && v2State.is_archived === 1) {
console.log(`💀 [ZOMBIE] Session ${sessionId} är arkiverad. Nekar meddelande.`);
return {
answer: "Denna chatt är avslutad. Vänligen ladda om sidan eller starta en ny konversation för att få hjälp.",
sessionId
};
}

// ==================================================================
// 🛠️ 1. HÄMTA KONTEXT & SPARA NAMN (DIREKT)
// ==================================================================

// Hämta befintlig data
let storedContext = await getContextRow(sessionId);

let contextData = {
messages: [],
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

if (storedContext?.context_data) {
// 🔥 FIX: Parsa textsträng till objekt (LÖSER KRASCHEN)
const raw = storedContext.context_data;
contextData = parseContextData(raw);

// Säkra upp strukturen (Bevarar dina manuella checkar här)
if (!Array.isArray(contextData.messages)) contextData.messages = []; 
if (!contextData.locked_context) contextData.locked_context = { city: null, area: null, vehicle: null };
if (!contextData.linksSentByVehicle) contextData.linksSentByVehicle = { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false };
}

// 🔥 FIXEN: Spara namnet från frontend INNAN vi kollar triggers
if (providedContext?.locked_context) {
contextData.locked_context = {
...contextData.locked_context,
...providedContext.locked_context
};
console.log('🎯 [CONTEXT PRE-SAVE] Sparar namn innan trigger-check:', providedContext.locked_context);

// Spara direkt till DB
await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0),
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});
}

// ==================================================================
// 🔥 2. TRIGGER CHECK (HUMAN MODE)
// ==================================================================
const lowerQuery = query.toLowerCase();
const triggers = (typeof HUMAN_TRIGGERS !== 'undefined') ? HUMAN_TRIGGERS : ["människa", "support", "prata med"];
const isHumanTrigger = triggers.some(phrase => lowerQuery.includes(phrase));

if (isHumanTrigger) {
console.log(`🚨 [HUMAN-MODE] TVINGANDE TRIGGER HITTAD (HTTP): "${query}" för session ${sessionId}`);

// 🔒 F3.2: Race-guard — förhindrar dubbel-trigger om Socket-vägen redan hanterat detta
if (humanModeLocks.has(sessionId)) {
console.log(`[HUMAN-MODE] Lås aktivt för ${sessionId} — hoppar över dubbel-trigger (HTTP)`);
return { answer: "", sessionId };
}
humanModeLocks.add(sessionId);
setTimeout(() => humanModeLocks.delete(sessionId), 3000);

// 🔥 FIX: Routing-logik för att hålla ärenden i Inkorgen (Oplockade)
let routingTag = providedContext?.locked_context?.agent_id || null;

// Om inget ID skickades (t.ex. vid val av Centralsupport), försök räkna ut det eller kör fallback
if (!routingTag && providedContext?.locked_context?.city) {
const searchCity = providedContext.locked_context.city;
const searchArea = providedContext.locked_context.area || "";
const allOffices = await getAllOffices();
const matchedOffice = allOffices.find(o => 
o.city.toLowerCase() === searchCity.toLowerCase() && 
(o.area || "").toLowerCase() === searchArea.toLowerCase()
);
routingTag = matchedOffice ? matchedOffice.routing_tag : 'admin';
} else if (!routingTag) {
routingTag = 'admin'; // Total fallback till centralsupport-taggen
}

// VIKTIGT: Vi sätter owner till NULL här för att det ska landa i Inkorgen som "Oplockat"
await new Promise((resolve) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, owner, office, updated_at)
VALUES (?, 'customer', 1, NULL, ?, ?)
ON CONFLICT(conversation_id) DO UPDATE SET 
human_mode = 1, 
office = excluded.office,
updated_at = excluded.updated_at`,
[sessionId, routingTag, Math.floor(Date.now() / 1000)],
() => resolve()
);
});

// Spara meddelandet
contextData.messages.push({ role: 'user', content: query, timestamp: Date.now() });
await upsertContextRow({
conversation_id: sessionId,
last_message_id: contextData.messages.length,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// Aktivera human mode
await setHumanMode(sessionId, 'customer');

// ✅ GLOBAL UPDATE: Meddela alla agenter direkt när human mode triggas
if (typeof io !== 'undefined') {
io.emit('team:update', { 
type: 'human_mode_triggered', 
sessionId,
office: routingTag  || 'admin' 
});
}

// Sätt flaggor (stad/fordon)
if (isFirstMessage) {
const flags = {
vehicle: contextData.locked_context?.vehicle || null
};
if (flags.vehicle) {
await updateTicketFlags(sessionId, flags);
}
}

// Returnera standardsvar och AVBRYT här
return {
answer: typeof HUMAN_RESPONSE_TEXT !== 'undefined' ? HUMAN_RESPONSE_TEXT : "Jag kopplar in en mänsklig kollega direkt.",
sessionId
};
}

// ==================================================================
// 🤖 3. AI-LOGIK (Körs bara om ingen trigger hittades)
// ==================================================================
// Säkra session om den saknas
if (!v2State) {
const initialOwner = providedContext?.locked_context?.agent_id || null;
await new Promise((resolve) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, owner, office, updated_at)
VALUES (?, 'customer', 0, ?, ?, ?)
ON CONFLICT(conversation_id) DO NOTHING`,
[sessionId, initialOwner, initialOwner, Math.floor(Date.now() / 1000)], // initialOwner skickas två gånger
() => resolve()
);
});
}

// 🔥 FIX: Säkerställ att contextData.messages existerar innan push
if (!contextData.messages || !Array.isArray(contextData.messages)) {
contextData.messages = [];
}

// Lägg till användarens fråga i historiken
contextData.messages.push({ role: 'user', content: query, timestamp: Date.now() });

// Förbered data för motorn
const ragContext = {
locked_context: contextData.locked_context,
linksSentByVehicle: contextData.linksSentByVehicle
};

const templates = await getAllTemplates(); 

// Kör Legacy Engine
const result = await runLegacyFlow(
{ query, sessionId, isFirstMessage, sessionContext: contextData.messages },
ragContext,
templates
);

// Hantera svaret från motorn
if (result?.new_context) {
// Uppdatera variabler
if (result.new_context.locked_context) contextData.locked_context = result.new_context.locked_context;
if (result.new_context.linksSentByVehicle) contextData.linksSentByVehicle = result.new_context.linksSentByVehicle;

// Spara botens svar
let responseText = typeof result.response_payload === 'string'
? result.response_payload
: result.response_payload?.answer || "";

// Transportstyrelsen-fallback: kör om RAG inte hittade svar på regelrelaterad fråga
if (aiEnabled && responseText.includes("hittar ingen information")) {
const sessionTypeForLog = v2State?.session_type || 'unknown';
let tsSucceeded = 0;
let tsUrlUsed = null;
try {
const { tryTransportstyrelseFallback, classifyRegulatoryTopic } = require('./utils/transportstyrelsen-fallback');
tsUrlUsed = classifyRegulatoryTopic(query);
const tsAnswer = await tryTransportstyrelseFallback(query);
if (tsAnswer) {
tsSucceeded = 1;
responseText = tsAnswer;
if (typeof result.response_payload === 'string') {
result.response_payload = tsAnswer;
} else if (result.response_payload) {
result.response_payload.answer = tsAnswer;
}
}
} catch (tsErr) {
console.warn('[TS-Fallback] Fel:', tsErr.message);
}
// Logga RAG-miss till databasen (fire-and-forget)
db.run(
`INSERT INTO rag_failures (query, session_type, ts_fallback_used, ts_fallback_success, ts_url) VALUES (?, ?, ?, ?, ?)`,
[query, sessionTypeForLog, tsUrlUsed ? 1 : 0, tsSucceeded, tsUrlUsed],
(err) => { if (err) console.warn('[RAG-Log] DB-fel:', err.message); }
);
}

contextData.messages.push({ role: 'atlas', content: responseText, timestamp: Date.now() });

// Spara allt till DB
await upsertContextRow({
conversation_id: sessionId,
last_message_id: contextData.messages.length,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});
}

// Returnera AI-svaret
return result?.response_payload || { answer: "", sessionId };
}

// STATE MANAGEMENT HELPERS
function mergeContext(prev, next) {
if (!next || typeof next !== 'object') return prev;

return {
messages: Array.isArray(next.messages) ? next.messages : prev.messages,
locked_context: next.locked_context ?? prev.locked_context,
linksSentByVehicle: next.linksSentByVehicle ?? prev.linksSentByVehicle
};
}

function assertValidContext(ctx, source = 'unknown') {
if (!ctx) {
// 🔧 F3.4: Kastar nu ett fel istället för att tyst fortsätta med null context
throw new Error(`[STATE] Ogiltigt context-objekt (null/undefined) från "${source}"`);
}

if (!Array.isArray(ctx.messages)) {
console.warn(`⚠️ [STATE] messages saknas eller är fel typ (${source})`);
}

if (!ctx.locked_context) {
console.warn(`⚠️ [STATE] locked_context saknas (${source})`);
}

if (!ctx.linksSentByVehicle) {
console.warn(`⚠️ [STATE] linksSentByVehicle saknas (${source})`);
}
}

// EXPRESS & MIDDLEWARE SETUP
const app = express();

// Raw Body Parser (för HMAC-validering)
app.use(express.json({
verify: (req, res, buf) => {
req.rawBody = buf;
}
}));

// CORS Configuration (Web/Ngrok Support)
app.use(cors({
origin: '*',
methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));

// Request Logger Middleware
app.use((req, res, next) => {
res.setHeader('ngrok-skip-browser-warning', 'true');

// Ignorera loggar för Inbox OCH History-polling
const isPolling = req.url === '/team/inbox' || req.url.includes('/api/customer/history');

if (!isPolling) {
console.log("🔥 INCOMING:", req.method, req.url);
}
next();
});

// SOCKET.IO SERVER SETUP
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
cors: { 
origin: "*", 
methods: ["GET", "POST"],
allowedHeaders: ["ngrok-skip-browser-warning"],
credentials: true 
}
});

// =============================================================================
// STATIC FILES, KUNDCHATT & ROUTING
// =============================================================================

// 🔥 NYTT 1: Gör mappen 'uploads' publik så att bilder/filer kan nås via URL
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 1. Servera kundchatten från Atlas-roten (ngrok-adress/kundchatt)
app.use('/kundchatt', express.static(path.join(__dirname, 'kundchatt')));

// 2. Servera Admin-gränssnittet (Renderer)
app.use(express.static(path.join(__dirname, 'Renderer')));

// 3. Socket.io biblioteket
app.use('/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));

// =============================================================================
// 📂 FILUPPLADDNING KONFIGURATION (MULTER)
// =============================================================================
// 🔥 FIX: Säkerställ att mappen 'uploads' faktiskt existerar
const uploadDir = getWritablePath('uploads');
if (!fs.existsSync(uploadDir)) {
fs.mkdirSync(uploadDir, { recursive: true });
console.log("📁 Skapade saknad mapp: /uploads");
}

const storage = multer.diskStorage({
destination: function (req, file, cb) {
cb(null, uploadDir) 
},
filename: function (req, file, cb) {
const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
const ext = path.extname(file.originalname);
cb(null, uniqueSuffix + ext)
}
});

const upload = multer({ 
storage: storage,
limits: { fileSize: 10 * 1024 * 1024 } // Max 10 MB per fil
});

// ✅ ENDPOINT: Uppladdning (Används av både kundchatt och admin)
app.post('/api/upload', upload.single('file'), (req, res) => {
try {
if (!req.file) {
return res.status(400).json({ error: 'Ingen fil laddades upp' });
}

// Skapa URL (t.ex. /uploads/176900_123.jpg)
const fileUrl = `/uploads/${req.file.filename}`;

console.log(`📎 Fil uppladdad: ${req.file.originalname} -> ${fileUrl}`);

res.json({ 
success: true, 
url: fileUrl, 
filename: req.file.originalname,
type: req.file.mimetype,
originalName: req.file.originalname
});

} catch (err) {
console.error("❌ Uppladdningsfel:", err);
res.status(500).json({ error: 'Kunde inte spara filen' });
}
});

// 4. FIX FÖR REACT 404: Tvinga alla undersidor i kundchatt till dess index.html
app.get('/kundchatt/*', (req, res) => {
res.sendFile(path.join(__dirname, 'kundchatt', 'index.html'));
});

// 5. Standard-route för Admin
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'Renderer', 'index.html'));
});

// Auth-routes och publika endpoints (login, lösenord, profil, seed, version)
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// ✅ NY PUBLIC ENDPOINT: Hämtar alla kontor till kundchatten (Atlas 4.0)
app.get('/api/public/offices', async (req, res) => {
try {
const offices = await getAllOffices();

// Vi skickar bara det som kundchatten behöver veta
const publicData = offices.map(o => ({
id: o.id,
name: o.name,
city: o.city,
area: o.area,
routing_tag: o.routing_tag,
office_color: o.office_color
}));

res.json(publicData);
} catch (err) {
console.error("❌ Fel vid hämtning av publika kontor:", err);
res.status(500).json({ error: "Kunde inte hämta kontor" });
}
});

// Admin-routes (GET+POST /api/admin/*, GET /api/auth/users)
const adminRoutes = require('./routes/admin');
app.use('/', adminRoutes);
// adminRoutes.init() kallas nedan, efter att alla beroenden är definierade


// Team-routes (POST /api/team/*, GET /team/*)
const teamRoutes = require('./routes/team');
app.use('/', teamRoutes);
teamRoutes.init({ io });

// Knowledge-routes (GET/PUT /api/knowledge/:routingTag)
const knowledgeRoutes = require('./routes/knowledge');
app.use('/api', knowledgeRoutes);



// =============================================================================
// 5. SOCKET.IO HANTERARE (REAL-TIME CHAT)
// =============================================================================
// Middleware: Autentisering & Identifiering
io.use((socket, next) => {
const token = socket.handshake.auth?.token;

// 1. Om token finns: Försök verifiera som AGENT/TEAM
if (token) {
jwt.verify(token, JWT_SECRET, (err, decoded) => {
if (err) return next(new Error("Authentication error: Invalid token"));
socket.user = decoded; // Det är en Agent
return next();
});
return;
}

// 2. Om ingen token: Kolla om det är en KUND (måste ha sessionId)
const sessionId = socket.handshake.auth?.sessionId || socket.handshake.query?.sessionId;

if (sessionId) {
socket.isCustomer = true;
socket.sessionId = sessionId; // Det är en Kund
return next();
}

// 3. Varken token eller sessionId? Blockera.
return next(new Error("Authentication error: No token or sessionId provided"));
});

// --- AGENT PRESENCE STORAGE ---
const activeAgents = new Map(); // userId -> socketId

io.on('connection', async (socket) => {
// 1. HANTERA AGENT-NÄRVARO (ENKEL VERSION UTAN RUM)
if (socket.user) {
// En agent anslöt (Verifierad via JWT)
activeAgents.set(socket.user.id, socket.id);
db.run("UPDATE users SET is_online = 1, last_seen = ? WHERE id = ?",
[Math.floor(Date.now() / 1000), socket.user.id]);
// Gå med i rum för alla kontor agenten bevakar (t.ex. "hogsbo, frolunda")
if (socket.user.routing_tag) {
const tags = socket.user.routing_tag.split(',').map(t => t.trim());
tags.forEach(tag => {
socket.join(tag);
console.log(`📡 Agent @${socket.user.username} bevakar nu kontor: ${tag}`);
});
}
// Meddela alla agenter att någon kommit online för den gröna pricken
io.emit('presence:update', {
userId: socket.user.id,
status: 'online'
});
console.log(`🔌 Agent Online: ${socket.user.username} (ID: ${socket.user.id})`);
} else {
// En kund anslöt
console.log(`🔌 Client connected: ${socket.id} (Kund: ${socket.sessionId})`);
}

// Skicka serverinfo vid anslutning
socket.emit('server:info', { version: SERVER_VERSION });

// 2. HANTERA NEDKOPPLING (Viktigt för att ta bort pricken)
socket.on('disconnect', () => {
if (socket.user) {
activeAgents.delete(socket.user.id);
db.run("UPDATE users SET is_online = 0, last_seen = ? WHERE id = ?",
[Math.floor(Date.now() / 1000), socket.user.id]);
// Meddela alla att agenten gick offline
io.emit('presence:update', {userId: socket.user.id,status: 'offline',lastSeen: Date.now()});}
});

// Event: test:echo (För debugging)
socket.on('test:echo', (data) => {
socket.emit('test:echo_response', { received: data, serverTime: Date.now() });
});

// ⌨️ KUNDEN SKRIVER (TYPING INDICATOR - GLOBAL UPDATE)
socket.on('client:typing', (payload) => {
const { sessionId } = payload;
// ✅ FAKTA: Vi skickar indikatorn globalt till alla agenter utan onödigt DB-anrop
// Din renderer.js sköter filtreringen så att rätt agent ser rätt kund.
io.emit('team:client_typing', { sessionId });
});

// 👇 AGENT SKRIVER (SKICKA TILL KUND + GLOBAL BROADCAST FÖR INTERNA CHATTAR)
socket.on('team:agent_typing', (payload) => {
    const sessionId = payload?.sessionId;
    if (!sessionId) return;
    socket.to(sessionId).emit('client:agent_typing', { sessionId });
});

// Vidarebefordra agentens skriv-status till kundens fönster
socket.on('client:agent_typing', (payload) => {
const { sessionId, isTyping } = payload;
if (sessionId) {
// Skicka till rummet (rum-namnet är sessionId)
socket.to(sessionId).emit('client:agent_typing', { sessionId, isTyping });
}
});

// ==================================================================
// 💬 CLIENT:MESSAGE - HUVUDHANTERARE FÖR CHATT
// ==================================================================
socket.on('client:message', async (payload) => {
console.log(`[SOCKET] Message from ${socket.id}:`, payload.query);

try {
// 🔥 STEG 1: PLOCKA UT DATA (INKLUSIVE CONTEXT/NAMN)
// Vi hämtar 'context' här för att fånga namnet om frontend skickar det
const { query, sessionId, isFirstMessage, session_type, context } = payload;

if (!query || !sessionId) return;

// ==================================================================
// 🛠️ STEG 2: SPARA NAMN/CONTEXT DIREKT (INNAN TRIGGERS)
// Detta garanterar att "Anna Andersson" sparas även om hon triggar "Människa" direkt
// ==================================================================
if (context?.locked_context) {
console.log('🎯 [SOCKET PRE-SAVE] Sparar namn/context från socket:', context.locked_context);

let tempStored = await getContextRow(sessionId);

// 🔥 FIX: Använd den säkra funktionen för att packa upp data 24/2-gemini
const raw = tempStored?.context_data;
let tempCtx = parseContextData(raw);

// Slå ihop nytt context med gammalt
tempCtx.locked_context = {
...tempCtx.locked_context,
...context.locked_context
};

// Spara omedelbart till DB
await upsertContextRow({
conversation_id: sessionId,
last_message_id: (tempStored?.last_message_id || 0),
context_data: tempCtx,
updated_at: Math.floor(Date.now() / 1000)
});
}

// ==================================================================
// 🛑 STEG 3: SÄKERHETSSPÄRRAR & TRIGGERS
// ==================================================================

// Human Mode Interceptor
const lowerQuery = query.toLowerCase();

// Skydda Hem-vyn (Privata sessioner får aldrig trigga Human Mode)
const isPrivate = session_type === 'private';

// Vi kollar triggers ENDAST om det INTE är en privat session.
const isTrigger = !isPrivate && HUMAN_TRIGGERS.some(phrase => lowerQuery.includes(phrase));

// --- 🚨 TRIGGER HITTAD (KUND VILL PRATA MED MÄNNISKA) ---
if (isTrigger) {
console.log(`[HUMAN-MODE] Trigger detected for ${sessionId}`);

// 🔒 F3.2: Race-guard — förhindrar dubbel-trigger om HTTP-vägen redan hanterat detta
if (humanModeLocks.has(sessionId)) {
console.log(`[HUMAN-MODE] Lås aktivt för ${sessionId} — hoppar över dubbel-trigger (Socket)`);
return;
}
humanModeLocks.add(sessionId);
setTimeout(() => humanModeLocks.delete(sessionId), 3000);

// Hämta context igen (nu inkl. namnet vi nyss sparade!)
let storedContext = await getContextRow(sessionId);

const contextData = parseContextData(storedContext?.context_data);

// Lägg till meddelandet i historiken
contextData.messages.push({ role: 'user', content: query, timestamp: Date.now() });

await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// Aktivera läget och meddela teamet
// 2. Aktivera human mode
await setHumanMode(sessionId, 'customer');
// Skicka till ALLA agenter (enkel broadcast)
io.emit('team:update', { type: 'human_mode_triggered', sessionId });
return; // Avbryt här, skicka inte till AI
}

// ==================================================================
// 🛡️ STEG 4: SESSION TYPE MANAGEMENT
// ==================================================================
const v2State = await getV2State(sessionId);

// Om detta är första meddelandet OCH session_type saknas...
if (isFirstMessage && (!v2State.session_type || v2State.session_type === 'customer')) {
const incomingType = payload.session_type || 'private';
const routingTag = payload.context?.locked_context?.agent_id || 'admin';

// Vi sätter owner till NULL (för att det ska vara i Inkorgen)
// Vi sätter office till routingTag (för att det ska få rätt färg/kategori)
await new Promise((resolve, reject) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, owner, office, updated_at)
VALUES (?, ?, 0, NULL, ?, ?)
ON CONFLICT(conversation_id) DO UPDATE SET session_type = excluded.session_type`,
[sessionId, incomingType, routingTag, Math.floor(Date.now() / 1000)],
(err) => (err ? reject(err) : resolve())
);
});

console.log(`✅ [SESSION-TYPE] Satte ${sessionId} till '${incomingType}' i Inkorgen`);
v2State.session_type = incomingType;
}

// HUMAN MODE CHECK (nu med korrekt session_type)
if (v2State?.human_mode === 1 && v2State.session_type === 'customer') {
console.log(`[HUMAN-MODE] Bot tyst (kundärende) för ${sessionId}`);
// FIX: Skicka rätt event-namn så att renderer:s typing-indikator faktiskt triggas
if (typeof io !== 'undefined') {
io.emit('team:client_typing', { sessionId }); // ← VAR: team:update { type: 'client_typing' }
}
return;
}

/* --- FIX: Hämta fullständig kontext (inkl. variabler för RAG) --- */
const now = Math.floor(Date.now() / 1000);
let storedContext = await getContextRow(sessionId);

// ✅ Tre toppnivå-nycklar istället för variables-wrapper
let contextData = { 
messages: [], 
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false }
};

if (storedContext && storedContext.context_data) {
contextData = parseContextData(storedContext.context_data);
}

// Skicka endast RAG-variabler (inte messages)
const ragContext = {
locked_context: contextData.locked_context,
linksSentByVehicle: contextData.linksSentByVehicle
};

console.log("------------------------------------------");
console.log("RAG INPUT (Ska innehålla locked_context + linksSentByVehicle):", JSON.stringify(ragContext));
console.log("------------------------------------------");

contextData.messages.push({ role: 'user', content: query, timestamp: Date.now() });
const templates = await getTemplatesCached();

// 3. Kör motorn
const result = await runLegacyFlow(
{ query, sessionId, isFirstMessage, sessionContext: contextData.messages },
ragContext,
templates
);

// ✅ DEBUG: Logga RAW result
console.log("🔍 [DEBUG] runLegacyFlow result:", JSON.stringify({
has_response_payload: !!result.response_payload,
has_new_context: !!result.new_context,
response_type: typeof result.response_payload,
first_100_chars: typeof result.response_payload === 'string' 
? result.response_payload.substring(0, 100)
: JSON.stringify(result.response_payload).substring(0, 100)
}));

/* --- SÄKERHETSKONTROLL --- */
if (result.new_context?.locked_context) {
console.log("✅ MOTORN RETURNERADE STATE:", JSON.stringify(result.new_context.locked_context));
} else {
console.log("⚠️ VARNING: Motorn returnerade inget locked_context!");
}

/* --- UPPDATERA VARIABLER 1/2: SÄKRAD RAG-ÅTERFÖRING --- */
// ✅ 26/12 Synka ALLA fält från motorn OBS SKALL FINNAS ÄVEN LÄNGRE NER, TA INTE BORT!
assertValidContext(result.new_context, 'ragSync');
contextData = mergeContext(contextData, result.new_context);

// ------------------------------------------------------------------
// 🎯 METADATA-FLAGGOR – sätts ENDAST vid första kundmeddelandet 27/12
// ------------------------------------------------------------------
if (
isFirstMessage === true &&
v2State.session_type === 'customer'
) {
const flags = {
vehicle: contextData.locked_context?.vehicle || null,
office: contextData.locked_context?.city || null
// topic används inte nu – medvetet tom
};

// Sätt endast flaggor som faktiskt finns
const hasAnyFlag = Object.values(flags).some(v => v !== null);

if (hasAnyFlag) {
console.log('🏷️ [TICKET FLAGS] Sätter initial metadata:', flags);
await updateTicketFlags(sessionId, flags);
}
}

console.log("------------------------------------------");
console.log("📥 EFTER SYNK:", JSON.stringify({
locked_context: contextData.locked_context,
messages_count: contextData.messages.length
}));
console.log("------------------------------------------");

// Extrahera svaret säkert
let responseText = (typeof result.response_payload === 'string')
? result.response_payload
: (result.response_payload?.answer || "Inget svar tillgängligt");

// Transportstyrelsen-fallback: kör om RAG inte hittade svar på regelrelaterad fråga
if (aiEnabled && responseText.includes("hittar ingen information")) {
const sessionTypeForLog = v2State?.session_type || 'unknown';
let tsSucceeded = 0;
let tsUrlUsed = null;
try {
const { tryTransportstyrelseFallback, classifyRegulatoryTopic } = require('./utils/transportstyrelsen-fallback');
tsUrlUsed = classifyRegulatoryTopic(query);
const tsAnswer = await tryTransportstyrelseFallback(query);
if (tsAnswer) {
tsSucceeded = 1;
responseText = tsAnswer;
if (typeof result.response_payload === 'string') {
result.response_payload = tsAnswer;
} else if (result.response_payload) {
result.response_payload.answer = tsAnswer;
}
}
} catch (tsErr) {
console.warn('[TS-Fallback] Fel:', tsErr.message);
}
// Logga RAG-miss till databasen (fire-and-forget)
db.run(
`INSERT INTO rag_failures (query, session_type, ts_fallback_used, ts_fallback_success, ts_url) VALUES (?, ?, ?, ?, ?)`,
[query, sessionTypeForLog, tsUrlUsed ? 1 : 0, tsSucceeded, tsUrlUsed],
(err) => { if (err) console.warn('[RAG-Log] DB-fel:', err.message); }
);
}

// DEBUG: Verifiera att vi har ett svar
console.log("🔍 [DEBUG] responseText extracted:", responseText.substring(0, 100));

contextData.messages.push({ role: 'atlas', content: responseText, timestamp: Date.now() });

// 4. SPARA TILL DATABAS (V2-struktur)
await upsertContextRow({
conversation_id: sessionId,
last_message_id: (storedContext?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

console.log("📤 [SOCKET] Skickar svar till klient:", {
answer_length: responseText.length,
sessionId: sessionId,
has_locked_context: !!contextData.locked_context
});

socket.emit('server:answer', {
answer: responseText,
sessionId: sessionId,
locked_context: contextData.locked_context
});

console.log("✅ [SOCKET] Svar skickat!");

// 🔒 KRITISK GUARD: Endast kundärenden får trigga Team Inbox
if (v2State.session_type === 'customer') {

// ✅ GLOBAL UPDATE: Skickar till alla anslutna Atlas-klienter (förhindrar Room-fel)
if (typeof io !== 'undefined') {
io.emit('team:customer_reply', { conversationId: sessionId, message: query, sender: 'user', timestamp: Date.now() });
}
}

} catch (err) {
console.error("❌ Socket Error:", err);
}
}); // 👈 SLUT på socket.on('client:message')

// ==================================================
// 🧑‍💼 AGENT → CUSTOMER (MINI-CHAT LIVE)
// ==================================================
socket.on('team:agent_reply', async (payload) => {
if (!socket.user) return; // 🔒 F2.1: Blockera oautentiserade kunder
try {
const { conversationId, message } = payload;
if (!conversationId || !message) return;

console.log(`💬 [AGENT REPLY] ${conversationId}: ${message}`);

// 🔥 FIX 1: Vi hämtar namnet FÖRST så vi kan spara det i databasen
const agentName = socket.user?.username || 'Support';

const stored = await getContextRow(conversationId);
let contextData = stored?.context_data ?? { messages: [], locked_context: {} };

// 🔥 FIX 2: Här lägger vi till 'sender: agentName' så det sparas i DB!
contextData.messages.push({ 
role: 'agent', 
content: message, 
sender: agentName, // <--- DEN HÄR RADEN VAR DET VI SAKNADE!
timestamp: Date.now() 
});

// Spara till DB
await upsertContextRow({
conversation_id: conversationId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// Synka updated_at i chat_v2_state — kortlistan sorteras på detta fält
await new Promise((resolve, reject) => {
db.run(
'UPDATE chat_v2_state SET updated_at = ? WHERE conversation_id = ?',
[Math.floor(Date.now() / 1000), conversationId],
(err) => err ? reject(err) : resolve()
);
});

// ✅ GLOBAL SYNC: Ser till att svaret syns i alla agenter/fönster direkt
if (typeof io !== 'undefined') {
io.emit('team:customer_reply', { conversationId, message, sender: agentName, timestamp: Date.now() });
io.emit('team:update', { type: 'new_message', sessionId: conversationId });
}

// 🛡️ LHC-sync (Bevarad originalfunktion)
try {
await sendToLHC(conversationId, message);
} catch (lhcErr) {
console.warn("⚠️ LHC Sync misslyckades, men meddelandet är skickat till frontend.");
}

} catch (err) {
console.error('❌ [AGENT REPLY ERROR]', err);
}
});

socket.on('team:send_email_reply', async (data) => {
if (!socket.user) return; // 🔒 F2.1: Blockera oautentiserade kunder
const { conversationId, message, customerEmail, subject, html } = data;
const agentName = socket.user?.username || 'Support';

// GUARD: Stoppa EENVELOPE innan det når Nodemailer
if (!customerEmail || !customerEmail.includes('@')) {
return socket.emit('server:error', { message: "Kan inte skicka: Ogiltig eller saknad mottagaradress." });
}

try {
const now = Math.floor(Date.now() / 1000);

// -- A. Förbered Innehåll --
const finalHtml = html || message.replace(/\n/g, '<br>');
let cleanSubject = subject || "Angående ditt ärende";
const idTag = `[Ärende: ${conversationId}]`;

cleanSubject = cleanSubject.replace(/\[Ärende:\s*[^\]]+\]/gi, '').trim();
if (!cleanSubject.toLowerCase().startsWith("re:") && !cleanSubject.toLowerCase().startsWith("svar:")) {
cleanSubject = "Re: " + cleanSubject;
}
cleanSubject += ` ${idTag}`;

// -- B. Hämta Historik för trådning --
const stored = await getContextRow(conversationId);

// db.js har redan parsat context_data åt oss
let contextData = stored?.context_data || { 
messages: [], 
locked_context: { email: customerEmail, subject: subject } 
};

if (contextData.locked_context) {
contextData.locked_context.email = customerEmail;
}

// -- C. Konfigurera Mail --
const mailOptions = {
from: `"My Driving Academy Support" <${process.env.EMAIL_USER}>`,
to: customerEmail,
subject: cleanSubject,
text: message,
html: finalHtml,
headers: { 'X-Atlas-Ticket-ID': conversationId }
};

// -- D. SKICKA FÖRST --
const sentInfo = await mailTransporter.sendMail(mailOptions);

// -- E. SPARA I DB ENDAST OM SÄNDNING LYCKADES --
await new Promise((resolve, reject) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, owner, updated_at)
VALUES (?, 'message', 1, ?, ?)
ON CONFLICT(conversation_id) DO UPDATE SET updated_at = excluded.updated_at, owner = excluded.owner`,
[conversationId, agentName, now],
(err) => err ? reject(err) : resolve()
);
});

contextData.messages.push({ 
role: 'agent', 
content: html || message, 
sender: agentName,
timestamp: Date.now(),
messageId: sentInfo.messageId, 
isEmail: true 
});

await upsertContextRow({
conversation_id: conversationId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: now
});

// -- F. Notifiera UI (Global Sync) --
if (typeof io !== 'undefined') {
io.emit('team:customer_reply', { conversationId, message: `📧 ${html || message}`, sender: agentName, timestamp: Date.now(), isEmail: true });
io.emit('team:update', { type: 'new_message', sessionId: conversationId });
}

} catch (err) {
console.error("❌ Mailfel:", err);
socket.emit('server:error', { message: "Kunde inte skicka mail. Kontrollera mottagarens adress." });
}
});

// =============================================================================
// 📍 2. KONTEXT-UPPDATERARE (STAD & FORDON) - LÄGG TILL DENNA HÄR
// =============================================================================
socket.on('team:update_ticket_context', async (data) => {
const { conversationId, city, vehicle } = data;
try {
const stored = await getContextRow(conversationId);
let contextData = { messages: [], locked_context: {} };

if (stored && stored.context_data) {
// ✅ RÄTT: Vi använder parseContextData för att garantera strukturen
contextData = parseContextData(stored.context_data);
}

if (!contextData.locked_context) contextData.locked_context = {};
if (city) contextData.locked_context.city = city;
if (vehicle) contextData.locked_context.vehicle = vehicle;

// Spara som STRING
await upsertContextRow({
conversation_id: conversationId,
last_message_id: stored?.last_message_id || 0,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'ticket_updated', conversationId });
}
} catch (err) { console.error("❌ Kontext-error:", err); }
});

// =============================================================================
// 📩 NYTT: HANTERA MAIL-KNAPP FRÅN ATLAS (AI-FÖRBEREDELSE)
// =============================================================================
socket.on('team:email_action', async (data) => {
const { conversationId, content, action } = data;
console.log(`📩 [MAIL-ACTION] Mottagen för ${conversationId}`);

try {
// Vi hämtar templates som din server redan har i minnet
const templates = await getTemplatesCached();

// Vi anropar runLegacyFlow, vilket är den funktion som sköter din RAG-logik
const result = await runLegacyFlow(
{ 
query: content, 
sessionId: conversationId, 
isFirstMessage: false, 
sessionContext: [] 
},
{ locked_context: {}, linksSentByVehicle: {} }, // Tom startkontext
templates
);

// Extrahera svaret från motorn (v2-struktur)
let responseText = (typeof result.response_payload === 'string')
? result.response_payload
: (result.response_payload?.answer || "Inget svar tillgängligt");

// ✅ FIXAD RAD: Vi skickar nu svaret DIREKT till den som bad om det (socket.emit)
// Detta struntar i rum och skickar meddelandet direkt i dörren du precis öppnade.
socket.emit('ai:prediction', { 
conversationId, 
answer: responseText, 
is_email_draft: true 
});

console.log(`✅ [MAIL-ACTION] AI-förslag skickat direkt till klienten för ${conversationId}`);

} catch (error) {
console.error("❌ Fel vid generering av mail-svar:", error);
}
});

// ==================================================
// 🚪 KUNDEN AVSLUTAR CHATTEN
// ==================================================
socket.on('client:end_chat', async (payload) => {
// Säkra upp så vi hittar ID oavsett vad frontend kallar det
const sessionId = payload.sessionId || payload.conversationId;

if (!sessionId) return; // Avbryt om ID saknas helt
console.log(`[CHAT] Customer ended session ${sessionId}`);

// 1. Lägg till systemmeddelande i DB
const stored = await getContextRow(sessionId);
let contextData = stored?.context_data || { messages: [] };

contextData.messages.push({
role: 'system', // Ny roll för systemhändelser
content: '⚠️ Kunden har avslutat chatten.',
timestamp: Date.now()
});

await upsertContextRow({
conversation_id: sessionId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: Math.floor(Date.now() / 1000)
});

// ✅ GLOBAL UPDATE: Meddela alla agenter direkt när chatten avslutas
if (typeof io !== 'undefined') {
io.emit('team:customer_reply', { conversationId: sessionId, message: '⚠️ Kunden har avslutat chatten.', sender: 'System', type: 'system_info' });
}
});
socket.on('disconnect', () => {
console.log('🔌 Disconnected:', socket.id);
});
}); // 👈 Detta är slutet på io.on('connection')

// ==============================================
//sendToLHC - Skickar kopia till LiveHelperChat (om konfigurerad)
//===================================================
async function sendToLHC(chatId, message, retries = 3) {
if (!message) return;

// Om du har kvar "temp_secret" i .env så avbryter vi här direkt
if (process.env.LHC_WEBHOOK_SECRET === 'temp_secret_12345' || !process.env.LHC_API_URL) {
return; 
}

const messageText = typeof message === 'string' ? message : (message?.answer || 'Inget svar');
const url = `${process.env.LHC_API_URL}/restapi/v2/chat/sendmessage/${chatId}`;
const auth = Buffer.from(`${process.env.LHC_API_USER}:${process.env.LHC_API_KEY}`).toString('base64');

for (let attempt = 1; attempt <= retries; attempt++) {
try {
const response = await fetch(url, {
method: 'POST',
headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
body: JSON.stringify({ msg: messageText })
});
if (response.ok) return;
} catch (err) {
if (attempt === retries) console.log(`[LHC] Kunde inte nå externa LHC för ${chatId}`);
else await new Promise(r => setTimeout(r, 1000 * attempt));
}
}
}


// Archive-routes (POST /search_all, POST+GET /api/inbox/*, GET /api/archive)
const archiveRoutes = require('./routes/archive');
app.use('/', archiveRoutes);
archiveRoutes.init({ io, parseContextData, assertValidContext, mergeContext });


// =============================================================================
// API TEMPLATE MANAGEMENT ENDPOINTS
// =============================================================================

// Template-routes (GET/POST/DELETE /api/templates/*) + cache
const templatesRoutes = require('./routes/templates');
app.use('/api', templatesRoutes);
const { getTemplatesCached } = templatesRoutes; // Används av övriga delar av server.js

// Customer-routes (POST/GET /api/customer/*)
const customerRoutes = require('./routes/customer');
app.use('/api', customerRoutes);
customerRoutes.init({ io, handleChatMessage });

// Kundprofil-routes (GET /api/customers, GET /api/customers/tickets)
const customerProfileRoutes = require('./routes/customers');
app.use('/api', customerProfileRoutes);
customerProfileRoutes.init({});

// Antecknings-routes (GET/POST/PUT/DELETE /api/notes/*)
const notesRoutes = require('./routes/notes');
app.use('/api', notesRoutes);

// Webhook-routes (POST /webhook/lhc-chat)
const webhookRoutes = require('./routes/webhook');
app.use('/', webhookRoutes);
webhookRoutes.init({ io, sendToLHC, parseContextData, HUMAN_TRIGGERS, HUMAN_RESPONSE_TEXT });

// =============================================================================
// 📬 IMAP LISTENER - FIXAD VERSION (MED ECHO-SKYDD & KORREKT PARSING)
// =============================================================================
let isScanning = false;

async function checkEmailReplies() {
if (!imapEnabled) return;
// 1. Lås för att förhindra dubbla körningar
if (isScanning) return;
isScanning = true;

// ✅ KORREKT STRUKTUR FÖR IMAP-SIMPLE (MED ALLA MÅSVINGAR)
const imapConfig = {
imap: {
user: process.env.EMAIL_USER,
password: process.env.EMAIL_PASS,
host: 'imap.gmail.com',
port: 993,
tls: true,
authTimeout: 30000,
connTimeout: 30000,
tlsOptions: { rejectUnauthorized: false }
}
};

let connection = null;

try {
connection = await imapSimple.connect(imapConfig);
connection.on('error', (err) => console.error('⚠️ IMAP-anslutningen dog, men Atlas lever vidare:', err));
await connection.openBox('INBOX');

const searchCriteria = ['UNSEEN'];
const fetchOptions = { 
// Vi hämtar HEADER för info, och '' för HELA råa källkoden (inkl bilder/base64)
bodies: ['HEADER', ''], 
markSeen: false, 
struct: true 
};

const messages = await connection.search(searchCriteria, fetchOptions);

// FIX: Logga bara om det faktiskt finns nya mail
if (messages.length > 0) {
console.log(`📬 Hittade ${messages.length} olästa mail`);
}

for (const item of messages) {
try {
// SÄKERHET: Kontrollera att header finns
const headerPart = item.parts.find(p => p.which === 'HEADER');
if (!headerPart || !headerPart.body) {
await connection.addFlags(item.attributes.uid, '\\Seen');
continue;
}

const subject = headerPart.body.subject ? headerPart.body.subject[0] : "(Inget ämne)";
const fromRaw = headerPart.body.from ? headerPart.body.from[0] : "";
const messageId = headerPart.body['message-id'] ? headerPart.body['message-id'][0] : null;

console.log(`📧 Läser mail: "${subject}" från ${fromRaw}`);

// 🔥 SPÄRR 1: EKO-SKYDD (Ignorera mail från oss själva)
const myEmail = process.env.EMAIL_USER.toLowerCase();
if (fromRaw.toLowerCase().includes(myEmail)) {
console.log(`🛡️ Ignorerar eget utgående mail (Eko)`);
await connection.addFlags(item.attributes.uid, '\\Seen');
continue; 
}

// 🔥 FIX 6: FÖRBÄTTRAD ÄRENDE-ID MATCHNING
// Leta efter [Ärende: X] ELLER X-Atlas-Ticket-ID header
let conversationId = null;

// Metod 1: Subject-matchning
const idMatch = subject.match(/\[Ärende:\s*([a-zA-Z0-9_-]+)\]/i);
if (idMatch) {
conversationId = idMatch[1];
console.log(`🎯 Hittade ärende-ID i subject: ${conversationId}`);
}

// Metod 2: Custom header (fallback) – CASE-INSENSITIVE
if (!conversationId) {
for (const key in headerPart.body) {
if (key.toLowerCase() === 'x-atlas-ticket-id') {
conversationId = headerPart.body[key][0];
console.log(`🎯 Hittade ärende-ID i header: ${conversationId}`);
break;
}
}
}

if (!conversationId) {
console.log(`⚠️ Kunde inte hitta ärende-ID i mail. Ignorerar.`);
await connection.addFlags(item.attributes.uid, '\\Seen');
continue;
}

// 🔥 FIX 7: FÖRBÄTTRAD TEXT-EXTRAKTION ("SLÄGGAN")
// Vi hämtar hela mailet ('') och låter simpleParser avkoda BASE64/Outlook-krångel automatiskt
let mailContent = '';

try {
// Hitta delen som heter '' (vilket är hela råa mailet som vi bad om i fetchOptions)
const fullBodyPart = item.parts.find(p => p.which === '');

if (fullBodyPart) {
// simpleParser tar hela rådatat och löser avkodningen magiskt
const parsed = await simpleParser(fullBodyPart.body);

// Hämta text i första hand, html i andra hand
mailContent = parsed.text || parsed.html || "";

// Om vi bara fick HTML (typiskt Outlook), rensa taggar grovt för preview
if (!parsed.text && parsed.html) {
mailContent = parsed.html.replace(/<[^>]*>?/gm, '');
}
}
} catch (parseErr) {
console.error(`⚠️ Parser-fel: ${parseErr.message}`);
}

// Rensa bort gamla citat (Allt under "Den ... skrev:" eller "On ... wrote:")
let cleanMessage = mailContent
.split(/On .* wrote:/i)[0]
.split(/Den .* skrev:/i)[0]
.split(/-----Original Message-----/i)[0]
.split(/Från: /i)[0]
.trim();

// FIX: Om städningen raderade allt (Outlook-bugg), använd originaltexten
if (cleanMessage.length < 2 && mailContent.length > 5) {
console.warn("⚠️ Städningen raderade allt. Använder o-städad text istället.");
cleanMessage = mailContent.trim();
}

// 🔥 SPÄRR 2: TOM-SKYDD
if (!cleanMessage || cleanMessage.length < 2) {
console.warn(`⚠️ Tomt innehåll för ${conversationId}. Sparar EJ.`);
await connection.addFlags(item.attributes.uid, '\\Seen');
continue;
}

console.log(`🎯 MATCH! Kundsvar till ärende: ${conversationId}`);
console.log(`📝 Innehåll: ${cleanMessage.substring(0, 100)}...`);

// --- 🔥 FIX 8: ÅTERUPPLIVA ÄRENDET OM DET ÄR ARKIVERAT ---
const now = Math.floor(Date.now() / 1000);
const stateCheck = await getV2State(conversationId);

if (stateCheck && stateCheck.is_archived === 1) {
console.log(`🧟 [REVIVAL] Nytt mail på arkiverat ärende ${conversationId}. Återaktiverar!`);
await new Promise((resolve) => {
db.run(
`UPDATE chat_v2_state 
SET is_archived = 0, 
owner = NULL,
human_mode = 1,
updated_at = ? 
WHERE conversation_id = ?`,
[now, conversationId],
() => resolve()
);
});
} else if (!stateCheck) {
// Skapa ny post om ärendet inte finns helt
await new Promise((resolve) => {
// Här försöker vi extrahera kontoret från ämnesraden om möjligt, annars sätts NULL
const initialOffice = conversationId.includes('_') ? conversationId.split('_')[0] : null; 
db.run(
`INSERT INTO chat_v2_state (conversation_id, session_type, human_mode, owner, office, updated_at)
VALUES (?, 'message', 1, ?, ?, ?)`,
[conversationId, initialOffice, initialOffice, now],
() => resolve()
);
});
}

// ✅ FIXEN: Denna del ligger nu UTANFÖR if/else och körs för ALLA inkommande mail
const stored = await getContextRow(conversationId);
let contextData = stored?.context_data || { messages: [], locked_context: {} };

contextData.messages.push({
role: 'user',
content: cleanMessage, 
timestamp: Date.now(),
messageId: messageId, 
isEmail: true
});

await upsertContextRow({
conversation_id: conversationId,
last_message_id: (stored?.last_message_id || 0) + 1,
context_data: contextData,
updated_at: now
});
// ✅ GLOBAL INBOUND: Garanterar att inkommande mail-svar visas direkt i UI för alla agenter
if (typeof io !== 'undefined') {
io.emit('team:customer_reply', { conversationId, message: `📧 (Svar): ${cleanMessage}`, sender: 'user', timestamp: Date.now(), isEmail: true });
io.emit('team:update', { type: 'new_message', sessionId: conversationId });
}

await connection.addFlags(item.attributes.uid, '\\Seen');
console.log(`✅ Mail för ${conversationId} hanterat och sparat.`);
} catch (innerErr) {
console.error(`⚠️ Fel vid hantering av enskilt mail: ${innerErr.message}`);
try { 
await connection.addFlags(item.attributes.uid, '\\Seen'); 
} catch(e) {
console.error(`Kunde inte markera mail som läst: ${e.message}`);
}
}
} 

} catch (err) {
if (err.code !== 'ETIMEDOUT') {
console.error("❌ IMAP Huvudfel:", err.message);
}
} finally {
if (connection) {
try { await connection.end(); } catch (e) {}
}
isScanning = false;
}
}

// =============================================================================
// AUTOMATISK ARKIVERING VID INAKTIVITET (10 MINUTER)
// =============================================================================
async function checkChatInactivity() {
const INACTIVITY_LIMIT = 600; // 10 minuter
const now = Math.floor(Date.now() / 1000);
const threshold = now - INACTIVITY_LIMIT;

try {
// 1. Hitta endast AI-chattar (human_mode = 0) som inte uppdaterats på 10 min
const inactiveRows = await new Promise((resolve, reject) => {
db.all(
"SELECT conversation_id FROM chat_v2_state WHERE is_archived = 0 AND human_mode = 0 AND updated_at < ?",
[threshold],
(err, rows) => {
if (err) reject(err); else resolve(rows || []);
}
);
});

if (inactiveRows.length > 0) {
console.log(`🕒 [INACTIVITY] Arkiverar ${inactiveRows.length} inaktiva AI-chattar.`);

for (const row of inactiveRows) {
const id = row.conversation_id;

// 2. 🔒 F3.5: Atomisk arkivering — båda UPDATE lyckas eller ingen (BEGIN/COMMIT/ROLLBACK)
await new Promise((resolve, reject) => {
db.run('BEGIN TRANSACTION', (beginErr) => {
if (beginErr) return reject(beginErr);
db.run("UPDATE chat_v2_state SET is_archived = 1, updated_at = ? WHERE conversation_id = ?", [now, id], (e1) => {
if (e1) { db.run('ROLLBACK'); return reject(e1); }
db.run("UPDATE local_qa_history SET is_archived = 1 WHERE id = ?", [id], (e2) => {
if (e2) { db.run('ROLLBACK'); return reject(e2); }
db.run('COMMIT', (commitErr) => {
if (commitErr) { db.run('ROLLBACK'); return reject(commitErr); }
resolve();
}); // COMMIT
}); // local_qa_history
}); // chat_v2_state
}); // BEGIN TRANSACTION
}); // new Promise

if (typeof io !== 'undefined') {
io.emit('team:update', { type: 'ticket_archived', sessionId: id });
}
}
}
} catch (err) {
console.error("❌ Fel vid inaktivitetskontroll:", err);
}

// Auto-Human-Exit: Om aktiverat, kontrollera agenter vars alla ärenden är avslutade
if (autoHumanExit) {
db.all(
`SELECT DISTINCT owner FROM chat_v2_state
WHERE is_archived=0 AND human_mode=1 AND owner IS NOT NULL`,
[], (err, agentRows) => {
if (err || !agentRows) return;
agentRows.forEach(({ owner }) => {
db.get(
`SELECT COUNT(*) as cnt FROM chat_v2_state
WHERE owner=? AND is_archived=0`,
[owner], (err2, row) => {
if (!err2 && row && row.cnt === 0) {
db.run(`UPDATE chat_v2_state SET human_mode=0 WHERE owner=? AND is_archived=0`, [owner]);
io.emit('team:update', { type: 'human_mode_triggered', sessionId: null });
}
}
);
});
}
);
}
}

// Starta timern (Körs varje minut)
setInterval(checkChatInactivity, 60000);

// Kör var 15:e sekund (snabbare för bättre responstid)
setInterval(checkEmailReplies, 15000);
// Starta efter 5 sek
setTimeout(checkEmailReplies, 5000);

// =============================================================================
// 💾 DATABASBACKUP
// =============================================================================
function runDatabaseBackup() {
try {
const dir = backupPath;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const src = getWritablePath('atlas.db');
const dst = path.join(dir, `atlas_${ts}.db`);
fs.copyFileSync(src, dst);
console.log(`✅ [Backup] atlas.db → ${dst}`);
} catch (e) {
console.error('❌ [Backup] Fel:', e.message);
}
}

// =============================================================================
// 📅 AUTOMATISK MÅNADSEXPORT (CSV)
// =============================================================================
function runMonthlyExport() {
const today = new Date();
// Kör bara om det är den 1:a i månaden
if (today.getDate() !== 1) return; 

const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);
const yyyy = lastMonth.getFullYear();
const mm = String(lastMonth.getMonth() + 1).padStart(2, '0');

const filename = `atlas_archive_${yyyy}_${mm}.csv`;
// Skapar exports-mappen i samma mapp som server.js
const exportDir = getWritablePath('exports');
const exportPath = path.join(exportDir, filename);

// Skapa mapp om den inte finns
if (!fs.existsSync(exportDir)) {
fs.mkdirSync(exportDir);
}

// Kolla om filen redan finns (så vi inte skriver över/dubblerar)
if (fs.existsSync(exportPath)) return;

console.log(`[EXPORT] Påbörjar månadsexport för ${yyyy}-${mm}...`);



// Hämta förra månadens arkiverade ärenden från chat_v2_state
db.all(`
SELECT 
s.conversation_id, 
s.owner, 
s.updated_at,
c.context_data
FROM chat_v2_state s
LEFT JOIN context_store c ON s.conversation_id = c.conversation_id
WHERE s.is_archived = 1 
`, [], (err, rows) => {
if (err) return console.error("Export Error:", err);
if (!rows || rows.length === 0) return;

// Skapa CSV-header (Excel-kompatibel semikolon-separator för svensk Excel)
let csvContent = "ID;Datum;Agent;Stad;Fordon;Ämne;Antal_Meddelanden\n";

rows.forEach(row => {
const date = new Date(row.updated_at * 1000).toISOString().split('T')[0];
let ctx = {};
try { ctx = JSON.parse(row.context_data); } catch(e) {}

const locked = ctx.locked_context || {};
const msgs = ctx.messages || [];

// Plocka ut data säkert
const city = locked.city || "Okänd";
const vehicle = locked.vehicle || "Okänd";
const subject = locked.subject || "Inget ämne";
const agent = row.owner || "Ingen";

// Bygg raden
csvContent += `${row.conversation_id};${date};${agent};${city};${vehicle};${subject};${msgs.length}\n`;
});

// Skriv filen
fs.writeFileSync(exportPath, csvContent, 'utf8');
console.log(`[EXPORT] ✅ Sparad till ${exportPath}`);
});
}

// Kör kollen 5 sekunder efter serverstart
setTimeout(runMonthlyExport, 5000);

// Kör kollen en gång per dygn (86400000 ms) för att fånga datumskiften om servern står på
setInterval(runMonthlyExport, 86400000);

// =====================================================================
// 🔧 ADMIN — SYSTEMKONFIGURATION (Del 2)
// =====================================================================

// OPENAI_API_KEY borttagen ur blocklistan — admin kan nu uppdatera via systemkonfig UI
const BLOCKED_CONFIG_KEYS = ['JWT_SECRET', 'CLIENT_API_KEY', 'NGROK_TOKEN', 'LHC_WEBHOOK_SECRET', 'GITHUB_TOKEN'];

function getEnvPath() {
return isPackaged ? path.join(process.cwd(), '.env') : path.join(__dirname, '.env');
}

function getFilePaths() {
const base = isPackaged ? process.resourcesPath : __dirname;
return {
mainJs: path.join(base, 'main.js'),
legacyJs: path.join(base, 'legacy_engine.js'),
rendererJs: path.join(base, 'Renderer', 'renderer.js'),
intentJs: path.join(base, 'patch', 'intentEngine.js'),
knowledgePath: path.join(base, 'knowledge')
};
}

// Alla beroenden nu definierade — injicera i admin-routern
adminRoutes.init({ io, getEnvPath, getFilePaths, BLOCKED_CONFIG_KEYS, recreateMailTransporter, setSetting, runDatabaseBackup, authRoutes });

// =====================================================================
// 🛡️ ADMIN — DRIFT & SÄKERHET (operation-settings)
// =====================================================================
app.get('/api/admin/operation-settings', authenticateToken, async (req, res) => {
res.json({
imap_enabled:          imapEnabled,
backup_interval_hours: backupInterval,
backup_path:           backupPath,
jwt_expires_in:        jwtExpiresIn,
auto_human_exit:       autoHumanExit
});
});

app.post('/api/admin/operation-settings', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
const { field, value } = req.body;
const allowed = [
'imap_enabled', 'backup_interval_hours', 'backup_path',
'jwt_expires_in', 'auto_human_exit',
'OPENAI_API_KEY' // Tillåten att uppdatera via operation-settings (exponeras ej i GET)
];
if (!allowed.includes(field)) return res.status(400).json({ error: 'Okänt fält.' });
setSetting(field, value);

// --- Runtime hot-reload per fält ---

if (field === 'imap_enabled') {
imapEnabled = (value === 'true' || value === true);
// IMAP-intervallet körs alltid men checkar imapEnabled-flaggan i sin loop — ingen restart behövs
console.log(`✅ [HotReload] IMAP ${imapEnabled ? 'aktiverat' : 'inaktiverat'}`);
}

if (field === 'backup_interval_hours') {
backupInterval = parseInt(value, 10) || 24;
// Avbryt det gamla intervallet och starta ett nytt med den nya tiden
if (backupTimerId) clearInterval(backupTimerId);
backupTimerId = setInterval(runDatabaseBackup, backupInterval * 3600 * 1000);
console.log(`✅ [HotReload] Backup-intervall ändrat till ${backupInterval}h`);
}

if (field === 'backup_path') {
backupPath = value;
console.log(`✅ [HotReload] Backup-sökväg: ${backupPath}`);
}

if (field === 'jwt_expires_in') {
jwtExpiresIn = value;
authRoutes.setJwtExpiresIn(value); // Synka JWT-livslängd till auth-routern
// JWT-ändringen påverkar nya tokens; befintliga tokens fortsätter att gälla tills de löper ut
console.log(`✅ [HotReload] JWT-livslängd: ${jwtExpiresIn}`);
}

if (field === 'auto_human_exit') {
autoHumanExit = (value === 'true' || value === true);
console.log(`✅ [HotReload] AutoHumanExit: ${autoHumanExit}`);
}

if (field === 'OPENAI_API_KEY') {
try {
const trimmedKey = String(value).trim();
if (trimmedKey) {
process.env.OPENAI_API_KEY = trimmedKey;
aiEnabled = true;
console.log(`✅ [HotReload] OpenAI API-nyckel uppdaterad. AI aktiverat.`);
} else {
// Tom nyckel — inaktivera AI-anrop defensivt istället för att krascha
process.env.OPENAI_API_KEY = '';
aiEnabled = false;
console.warn(`⚠️ [HotReload] OpenAI API-nyckel rensad. AI-anrop inaktiverade (aiEnabled = false).`);
}
} catch (err) {
console.error('❌ [HotReload] Fel vid uppdatering av OpenAI-nyckel:', err.message);
return res.status(500).json({ error: 'Kunde inte uppdatera OpenAI-nyckel.' });
}
}

console.log(`[OpSettings] ${field} = ${field === 'OPENAI_API_KEY' ? '***' : value}`);
res.json({ success: true, field, value: field === 'OPENAI_API_KEY' ? '***' : value });
});


// =====================================================================
// 🚀 SYSTEM START (SERVER v.3.8 DEFINITIVE - NON-BLOCKING)
// =====================================================================
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
// Nollställ alla online-statusar vid serverstart (förhindrar "ghost agents" efter krasch)
db.run("UPDATE users SET is_online = 0", () => {
console.log('✅ [Startup] is_online reset för alla användare');
});

// 1. Logga omedelbart att servern är uppe lokalt
console.log(`\n\x1b[32m%s\x1b[0m`, `✅ Atlas v.3.8 är ONLINE på http://localhost:${PORT}`);
console.log(`--------------------------------------------------`);

// 2. NGROK hanteras av main.js processen - server fokuserar bara på http
console.log("💡 Ngrok-starten hanteras av main process (om konfigurerad)");

// 3. Ladda drift-inställningar från settings-tabellen
loadOperationSettings().then(() => {
authRoutes.setJwtExpiresIn(jwtExpiresIn); // Synka JWT-livslängd till auth-routern
const backupMs = (backupInterval || 24) * 3600 * 1000;
backupTimerId = setInterval(runDatabaseBackup, backupMs); // Spara referens för hot-reload
console.log(`✅ [Backup] Schemalagt var ${backupInterval}h`);
});
});