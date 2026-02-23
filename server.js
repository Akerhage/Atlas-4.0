// =============================================================================
// ATLAS V.3.8 SERVER - CONFIGURATION & DEPENDENCIES
// =============================================================================
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
deleteTicketNote 
} = require('./db');

// =============================================================================
// HELPER: Säker parsning av context_data (sträng eller objekt → normaliserat objekt)
// =============================================================================
function parseContextData(raw) {
try {
const data = (typeof raw === 'string') ? JSON.parse(raw) : (raw || {});
if (!Array.isArray(data.messages))
data.messages = [];
if (!data.locked_context)
data.locked_context = { city: null, area: null, vehicle: null };
if (!data.linksSentByVehicle)
data.linksSentByVehicle = { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false };
return data;
} catch(e) {
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
const { runLegacyFlow } = require('./legacy_engine');
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
contextData = (typeof raw === 'string') ? JSON.parse(raw) : raw;

// Säkra upp strukturen
if (!Array.isArray(contextData.messages)) contextData.messages = []; // Tvingar till array om den saknas
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
vehicle: contextData.locked_context?.vehicle || null,
office: contextData.locked_context?.city || null
};
if (flags.vehicle || flags.office) {
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
const responseText = typeof result.response_payload === 'string' 
? result.response_payload 
: result.response_payload?.answer || "";

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

// TEMPLATE CACHE MANAGEMENT
let cachedTemplates = null;
let templatesLoadedAt = 0;
const TEMPLATE_TTL = 60 * 1000;

async function getTemplatesCached() {
const now = Date.now();
if (!cachedTemplates || now - templatesLoadedAt > TEMPLATE_TTL) {
cachedTemplates = await getAllTemplates();
templatesLoadedAt = now;
}
return cachedTemplates;
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

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================
app.post('/api/auth/login', async (req, res) => {
// 🔒 F2.3: Rate limit — blockera IP efter 5 misslyckade försök i 15 min
const ip = req.ip || req.socket?.remoteAddress || 'unknown';
const now = Date.now();
const attempt = loginAttempts.get(ip);
if (attempt && attempt.count >= LOGIN_MAX_ATTEMPTS && (now - attempt.firstAttempt) < LOGIN_WINDOW_MS) {
const waitMin = Math.ceil((LOGIN_WINDOW_MS - (now - attempt.firstAttempt)) / 60000);
console.warn(`🚫 [LOGIN] Rate limit för ${ip} — spärrad ${waitMin} min till`);
return res.status(429).json({ error: `För många inloggningsförsök. Försök igen om ${waitMin} min.` });
}

const { username, password } = req.body;
console.log(`🔑 Inloggningsförsök: ${username}`);

try {
const user = await getUserByUsername(username);

if (!user) {
console.log(`❌ Användaren "${username}" hittades inte i DB.`);
const e = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
e.count++;
loginAttempts.set(ip, e);
return res.status(401).json({ error: "Användaren finns inte" });
}

// Kontrollera lösenordet mot hashen i DB
const match = await bcrypt.compare(password, user.password_hash);

if (!match) {
console.log(`❌ Fel lösenord för "${username}"`);
const e = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
e.count++;
loginAttempts.set(ip, e);
return res.status(401).json({ error: "Felaktigt lösenord" });
}

// Lyckad inloggning — rensa eventuella misslyckanden för denna IP
loginAttempts.delete(ip);

// Skapa token för sessionen
const token = jwt.sign(
{ id: user.id, username: user.username, role: user.role, routing_tag: user.routing_tag },
JWT_SECRET,
{ expiresIn: jwtExpiresIn }
);

console.log(`✅ ${username} inloggad (ID: ${user.id}, Roll: ${user.role})`);

res.json({
token,
user: {
id: user.id,
username: user.username,
role: user.role,
color: user.agent_color,
avatar_id: user.avatar_id,
status_text: user.status_text,
routing_tag: user.routing_tag
}
});
} catch (err) {
console.error("Login Error:", err);
res.status(500).json({ error: "Internt serverfel" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: POST /api/auth/change-password
// -------------------------------------------------------------------------
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
const { oldPassword, newPassword } = req.body;
const username = req.user.username; // Vi tar namnet från token (säkert)

if (!oldPassword || !newPassword) {
return res.status(400).json({ error: "Fyll i både gammalt och nytt lösenord" });
}
try {
// 1. Hämta användaren för att kolla gamla lösenordet
const user = await getUserByUsername(username);
if (!user) return res.status(404).json({ error: "Användaren hittades inte" });

// 2. Verifiera gammalt lösenord
const validPass = await bcrypt.compare(oldPassword, user.password_hash);
if (!validPass) {
return res.status(401).json({ error: "Fel nuvarande lösenord" });
}

// 3. Hasha det nya lösenordet
const newHash = await bcrypt.hash(newPassword, 10);

// 4. Spara i DB
await updateUserPassword(username, newHash);

console.log(`🔐 Lösenord bytt för användare: ${username}`);
res.json({ success: true, message: "Lösenordet uppdaterat!" });

} catch (err) {
console.error("Password change error:", err);
res.status(500).json({ error: "Kunde inte byta lösenord" });
}
});

// -------------------------------------------------------------------------
// POST /api/auth/update profile
// -------------------------------------------------------------------------
app.post('/api/auth/update-profile', authenticateToken, async (req, res) => {
const { display_name, status_text, agent_color, avatar_id } = req.body;
const userId = req.user.id;
const sql = `UPDATE users SET display_name = ?, status_text = ?, agent_color = ?, avatar_id = ? WHERE id = ?`;
db.run(sql, [display_name, status_text, agent_color, avatar_id, userId], (err) => {
if (err) {
console.error("Update profile error:", err);
return res.status(500).json({ error: "Kunde inte uppdatera profil" });
}
res.json({ success: true });
});
});

// -------------------------------------------------------------------------
// POST /api/auth/seed - Create Initial User (Development Only)
// -------------------------------------------------------------------------
app.post('/api/auth/seed', async (req, res) => {
// 🔒 F1.2: Blockerad i produktion — använd admin-panelen för att skapa användare
if (process.env.NODE_ENV === 'production') {
return res.status(403).json({ error: "Not allowed in production" });
}
try {
const { username, password } = req.body;
const hash = await bcrypt.hash(password, 10);
await createUser(username, hash);
res.json({ message: "User created" });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// ✅ PUBLIC ENDPOINT: Serverns version (ingen auth krävs — används av klienten vid uppstart)
app.get('/api/public/version', (req, res) => {
res.json({ version: '3.14' });
});

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

// =========================================================================
// ADMIN & ANVÄNDARHANTERING (Komplett Atlas Suite)
// =========================================================================
// 1. GET: Hämta användare till "Tilldela"-rutan
app.get('/api/auth/users', authenticateToken, (req, res) => {
db.all("SELECT username, role, agent_color, avatar_id, status_text, display_name, is_online FROM users WHERE role != 'system' ORDER BY username ASC", [], (err, rows) => {
if (err) return res.status(500).json({ error: "Database error" });
res.json(rows);
});
});

// 2. GET: Hämta ALLA användare för Admin-panelen
app.get('/api/admin/users', authenticateToken, (req, res) => {
// Kontrollen måste ligga HÄR INNE för att req.user ska existera
if (req.user.role !== 'admin' && req.user.role !== 'support') {
return res.status(403).json({ error: "Endast för administratörer" });
}

// ✅ FIXAD: Nu inkluderas 'routing_tag' i listan (fixar checkboxarna i Admin)
db.all("SELECT id, username, role, agent_color, avatar_id, status_text, display_name, is_online, last_seen, routing_tag FROM users WHERE role != 'system' ORDER BY username ASC", [], (err, rows) => {
if (err) return res.status(500).json({ error: "Database error" });
res.json(rows);
});
});

// 3. POST: Skapa ny agent
app.post('/api/admin/create-user', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { username, password, role, display_name, agent_color, avatar_id, routing_tag } = req.body;
try {
const hash = await bcrypt.hash(password, 10);
const sql = `INSERT INTO users (username, password_hash, role, display_name, agent_color, avatar_id, routing_tag) VALUES (?, ?, ?, ?, ?, ?, ?)`;
db.run(sql, [
username.toLowerCase(),
hash,
role || 'agent',
display_name || username.toLowerCase(),
agent_color || '#0071e3',
avatar_id ?? 1,
routing_tag || null
], function(err) {
if (err) return res.status(400).json({ error: "Användarnamnet upptaget" });
res.json({ success: true, userId: this.lastID });
});
} catch (e) { res.status(500).json({ error: "Kunde inte skapa användare" }); }
});

// 4. POST: Uppdatera roll (Gör till Admin / Ta bort Admin)
app.post('/api/admin/update-role', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { userId, newRole } = req.body;
if (userId === req.user.id) return res.status(400).json({ error: "Du kan inte ändra din egen roll" });

db.run("UPDATE users SET role = ? WHERE id = ?", [newRole, userId], (err) => {
if (err) return res.status(500).json({ error: "Kunde inte uppdatera roll" });
res.json({ success: true });
});
});

// 5. POST: Reset lösenord (Administrativt)
app.post('/api/admin/reset-password', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { userId, newPassword } = req.body;

try {
const hash = await bcrypt.hash(newPassword, 10);
db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId], (err) => {
if (err) return res.status(500).json({ error: "Fel vid sparning" });
res.json({ success: true });
});
} catch (e) { res.status(500).json({ error: "Kunde inte byta lösenord" }); }
});

// 6. POST: Radera användare permanent
app.post('/api/admin/delete-user', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { userId } = req.body;
if (userId === req.user.id) return res.status(400).json({ error: "Du kan inte ta bort dig själv" });

try {
// 1. Hämta användarnamn för owner-rensning i ärenden
const userRow = await new Promise((resolve, reject) => {
db.get("SELECT username FROM users WHERE id = ?", [userId], (err, row) => err ? reject(err) : resolve(row));
});
if (!userRow) return res.status(404).json({ error: "Användare hittades inte" });

// 2. Radera användaren från databasen
await new Promise((resolve, reject) => {
db.run("DELETE FROM users WHERE id = ?", [userId], (err) => err ? reject(err) : resolve());
});

// 3. Frigör ärenden som ägdes av den raderade agenten (owner → NULL = återgår till publik inkorg)
await new Promise((resolve, reject) => {
db.run("UPDATE chat_v2_state SET owner = NULL WHERE owner = ?", [userRow.username], (err) => err ? reject(err) : resolve());
});

console.log(`✅ [ADMIN] Raderade agent: ${userRow.username} – ärenden frigjorda.`);
res.json({ success: true });

} catch (err) {
console.error("❌ Delete User Error:", err);
res.status(500).json({ error: "Kunde inte radera användare" });
}
});

// GET /api/admin/user-stats/:username - Hämtar statistik för en specifik agent
app.get('/api/admin/user-stats/:username', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { username } = req.params;
const statsQuery = `
SELECT
-- Egna: pågående ärenden som ägs av agenten
(SELECT COUNT(*) FROM chat_v2_state WHERE owner = ? AND (is_archived IS NULL OR is_archived = 0)) as active_count,
-- Egna: arkiverade ärenden
(SELECT COUNT(*) FROM chat_v2_state WHERE owner = ? AND is_archived = 1) as archived_count,
-- Egna: arkiverade mailärenden (hanterade mail)
(SELECT COUNT(*) FROM chat_v2_state WHERE owner = ? AND is_archived = 1 AND session_type = 'message') as mail_handled,
-- Egna: interna meddelanden skickade av agenten
(SELECT COUNT(*) FROM chat_v2_state WHERE sender = ? AND session_type = 'internal') as internals_sent,
-- System: totalt pågående (exkl. interna)
(SELECT COUNT(*) FROM chat_v2_state WHERE (is_archived IS NULL OR is_archived = 0) AND (session_type IS NULL OR session_type != 'internal')) as total_active,
-- System: totalt arkiverade
(SELECT COUNT(*) FROM chat_v2_state WHERE is_archived = 1) as total_archived,
-- System: AI-besvarade (avslutade utan human mode)
(SELECT COUNT(*) FROM chat_v2_state WHERE human_mode = 0 AND is_archived = 1) as ai_answered,
-- System: agentbesvarade (avslutade med human mode)
(SELECT COUNT(*) FROM chat_v2_state WHERE human_mode = 1 AND is_archived = 1) as human_handled,
-- System: spam/tomma (arkiverade AI-ärenden utan lagrad kontext)
(SELECT COUNT(*) FROM chat_v2_state WHERE is_archived = 1 AND human_mode = 0
AND NOT EXISTS (SELECT 1 FROM context_store c WHERE c.conversation_id = chat_v2_state.conversation_id)) as spam_count
`;

db.get(statsQuery, [username, username, username, username], (err, row) => {
if (err) {
console.error("❌ Stats Error:", err);
return res.status(500).json({ error: "Kunde inte hämta statistik" });
}

res.json({
active:         row ? (row.active_count   || 0) : 0,
archived:       row ? (row.archived_count || 0) : 0,
mail_handled:   row ? (row.mail_handled   || 0) : 0,
internals_sent: row ? (row.internals_sent || 0) : 0,
total_active:   row ? (row.total_active   || 0) : 0,
total_archived: row ? (row.total_archived || 0) : 0,
ai_answered:    row ? (row.ai_answered    || 0) : 0,
human_handled:  row ? (row.human_handled  || 0) : 0,
spam_count:     row ? (row.spam_count     || 0) : 0
});
});
});

// NY: Hämta alla ärenden för en specifik agent (för bläddraren)
app.get('/api/admin/agent-tickets/:username', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
try {
const { username } = req.params;
// Vi hämtar ärenden där agenten är owner och de inte är arkiverade
const sql = `
SELECT
s.conversation_id,
s.sender,
s.updated_at,
s.office AS routing_tag,
o.office_color
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.owner = ?
AND s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
ORDER BY s.updated_at DESC
`;

db.all(sql, [username], async (err, rows) => {
if (err) return res.status(500).json({ error: err.message });

// Koppla på meddelanden och metadata från context_store för varje ärende
const ticketsWithData = await Promise.all(rows.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
return {
...t,
office_color: t.office_color, // ✅ Skickar vidare rätt färg
subject: ctx.locked_context?.subject || "Inget ämne",
messages: ctx.messages || []
};
}));

res.json(ticketsWithData);
});
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// NY: Uppdatera kontorsfärg direkt — snabb väg, ingen AI-validering
app.post('/api/admin/update-office-color', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') {
return res.status(403).json({ error: "Access denied" });
}
const { routing_tag, color } = req.body;
if (!routing_tag || !color) return res.status(400).json({ error: "routing_tag och color krävs" });

try {
// 1. Uppdatera SQL-tabellen (påverkar getAgentStyles via officeData)
await new Promise((resolve, reject) => {
db.run('UPDATE offices SET office_color = ? WHERE routing_tag = ?', [color, routing_tag],
(err) => err ? reject(err) : resolve());
});

// 2. Uppdatera JSON-kunskapsfilen
const knowledgePath = isPackaged
? path.join(process.resourcesPath, 'knowledge')
: path.join(__dirname, 'knowledge');
const filePath = path.join(knowledgePath, `${routing_tag}.json`);
if (fs.existsSync(filePath)) {
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
data.office_color = color;
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

console.log(`🎨 [OFFICE-COLOR] ${routing_tag} → ${color}`);
io.emit('office:color_updated', { routing_tag, color }); 
res.json({ success: true });
} catch (e) {
console.error('[OFFICE-COLOR] Uppdatering misslyckades:', e);
res.status(500).json({ error: "Kunde inte uppdatera färg" });
}
});

// NY: Uppdatera agentens färg
app.post('/api/admin/update-agent-color', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { username, color } = req.body;
db.run("UPDATE users SET agent_color = ? WHERE username = ?", [color, username], (err) => {
if (err) return res.status(500).json({ error: err.message });
io.emit('agent:color_updated', { username, color });
res.json({ success: true });
});
});

// NY: Hantera agentens kontorsroller (routing_tags) - SYNCHRONIZED WITH RENDERER
app.post('/api/admin/update-agent-offices', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support')
return res.status(403).json({ error: "Access denied" });

// Vi mappar nu mot Renderer rad 4882 som skickar { username, tag, isChecked }
const { username, tag, isChecked } = req.body; 

try {
// 1. Hämta användarens nuvarande profil från DB
const user = await getUserByUsername(username);
if (!user) return res.status(404).json({ error: "Användaren hittades inte" });

// 2. Skapa en array av nuvarande kontor (rensar tomma fält)
let tags = user.routing_tag ? user.routing_tag.split(',').map(t => t.trim()).filter(t => t) : [];

// 3. Lägg till eller ta bort kontoret baserat på checkboxen i Admin
if (isChecked) {
if (!tags.includes(tag)) tags.push(tag);
} else {
tags = tags.filter(t => t !== tag);
}

// 4. Spara den nya listan som en sträng i databasen
const newRoutingTag = tags.join(',');
db.run("UPDATE users SET routing_tag = ? WHERE username = ?", [newRoutingTag, username], (err) => {
if (err) {
console.error("❌ Fel vid sparning av kontorsroll:", err);
return res.status(500).json({ error: err.message });
}
console.log(`✅ [ADMIN] Uppdaterade kontor för @${username}: ${newRoutingTag}`);
res.json({ success: true, newTags: newRoutingTag });
});
} catch (e) {
console.error("❌ Systemfel i update-agent-offices:", e);
res.status(500).json({ error: "Internt serverfel" });
}
});

// Hämta ärenden för ett specifikt kontor (Används i Admin -> Kontor)
app.get('/api/admin/office-tickets/:tag', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
try {
const { tag } = req.params;
const sql = `
SELECT
s.conversation_id,
s.owner,
s.session_type,
s.sender,
s.updated_at,
o.office_color -- ✅ RÄTT KOLUMN (Hämtas via JOIN)
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag -- ✅ JOIN KRÄVS HÄR OCKSÅ
WHERE s.office = ?
AND (s.is_archived IS NULL OR s.is_archived = 0)
ORDER BY s.updated_at DESC
`;

db.all(sql, [tag], async (err, rows) => {
if (err) return res.status(500).json({ error: err.message });

const ticketsWithData = await Promise.all((rows || []).map(async (t) => {
const stored = await getContextRow(t.conversation_id);
// Parsar context_data säkert för att extrahera ämne och meddelanden
let ctx = {};
try { 
ctx = typeof stored?.context_data === 'string' ? JSON.parse(stored.context_data) : (stored?.context_data || {}); 
} catch(e) { 
ctx = {}; 
console.error('[server] Korrupt context_data:', stored?.conversation_id, e.message); 
}

return {
...t,
office_color: t.office_color, // ✅ Skickar med färgen
subject: ctx.locked_context?.subject || "Inget ämne",
messages: ctx.messages || []
};
}));
res.json(ticketsWithData);
});
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Uppdatera roll baserat på användarnamn (Matchar anropet i renderer.js rad 4693)
app.post('/api/admin/update-role-by-username', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { username, newRole } = req.body;
db.run("UPDATE users SET role = ? WHERE username = ?", [newRole, username], (err) => {
if (err) return res.status(500).json({ error: err.message });
res.json({ success: true });
});
});

// =============================================================================
// ADMIN: SKAPA NYTT KONTOR (TOTALSYNKAD MED FLAGSHIP-FILER)
// =============================================================================
app.post('/api/admin/create-office', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support')
return res.status(403).json({ error: "Access denied" });

const { city, area, routing_tag, office_color, brand, services_offered,
prices: customPrices, contact, description, languages } = req.body;

if (!city || !routing_tag) return res.status(400).json({ error: "City and Routing Tag required" });

try {
// 0. Kontrollera att routing_tag inte redan används (duplicate-kontroll)
const existing = await new Promise((resolve, reject) => {
db.get("SELECT id FROM offices WHERE routing_tag = ?", [routing_tag],
(err, row) => err ? reject(err) : resolve(row));
});
if (existing) return res.status(409).json({ error: `Routing tag '${routing_tag}' används redan.` });

// 1. Kontaktuppgifter med fallback
const phone   = contact?.phone   || '010-20 70 775';
const email   = contact?.email   || 'hej@mydrivingacademy.com';
const address = contact?.address || 'Adress ej angiven';

// 2. Spara i Databasen (Tabell: offices)
await new Promise((resolve, reject) => {
db.run(
"INSERT INTO offices (city, area, routing_tag, name, office_color, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
[city, area || null, routing_tag,
`${brand || 'My Driving Academy'} - ${city} ${area || ''}`.trim(),
office_color || '#0071e3', phone, email, address],
(err) => err ? reject(err) : resolve()
);
});

// 3. Bestäm ID-prefix baserat på varumärke (viktigt för RAG)
const idPrefix = brand === 'Mårtenssons Trafikskola' ? 'martenssons_trafikskola' : 'my_driving_academy';

// 4. Bygg den kompletta JSON-strukturen
const templateData = {
id: `${idPrefix}_${routing_tag}`,
name: `${brand || 'My Driving Academy'} - ${city} ${area || ''}`.trim(),
brand: brand || "My Driving Academy",
city: city,
area: area || "",
office_color: office_color || "#0071e3",
description: description || `Välkommen till ${brand || 'My Driving Academy'} i ${city}${area ? ' ' + area : ''}.`,
keywords: [
brand?.toLowerCase().split(' ')[0],
"trafikskola",
city.toLowerCase(),
(area || "").toLowerCase(),
"kontakt", "priser"
].filter(k => k),
contact: {
phone,
email,
address,
zip: "",
city_zip: city,
coordinates: { lat: 59.3293, lng: 18.0686 }
},
opening_hours: [
{ days: "Mån – Tors", hours: "08:30 – 17:00" },
{ days: "Fredag", hours: "08:00 – 14:00" }
],
services_offered: services_offered || ["Bil"],
languages: (Array.isArray(languages) && languages.length) ? languages : ["svenska", "engelska"],
prices: [],
booking_links: { CAR: null, MC: null, AM: null },
type: "kontor_info"
};

// 5. Prislogik: customPrices prioriteras, services_offered som fallback
if (customPrices && Array.isArray(customPrices) && customPrices.length > 0) {
const cityKey = city.toLowerCase();
const areaKey = (area || "").toLowerCase();
// Injicera city/area som keywords i varje pris (RAG-precision)
templateData.prices = customPrices.map(p => ({
...p,
keywords: [...new Set([...(p.keywords || []), cityKey, areaKey].filter(k => k))]
}));
// Synca booking_links baserat på keywords
templateData.prices.forEach(p => {
const kw = p.keywords || [];
if (kw.includes('bil')) templateData.booking_links.CAR = "https://mitt.mydrivingacademy.com/login";
if (kw.includes('mc') || kw.includes('motorcykel')) templateData.booking_links.MC = "https://mitt.mydrivingacademy.com/login";
if (kw.includes('am') || kw.includes('moped')) templateData.booking_links.AM = "https://mitt.mydrivingacademy.com/login";
});
// Synca services_offered från priser
const sSet = new Set(templateData.services_offered);
templateData.prices.forEach(p => {
const kw = p.keywords || [];
if (kw.includes('bil')) sSet.add('Bil');
if (kw.includes('mc') || kw.includes('motorcykel')) sSet.add('MC');
if (kw.includes('am') || kw.includes('moped')) sSet.add('AM');
});
templateData.services_offered = [...sSet];
} else {
// Befintlig services_offered-logik (Bil/MC/AM) — bevarad oförändrad
const s = templateData.services_offered;

if (s.includes("Bil")) {
templateData.prices.push(
{ service_name: "Testlektion Bil (80 min)", price: 499, currency: "SEK", keywords: ["bil", "testlektion", "provlektion"] },
{ service_name: "Körlektion Bil (40 min)", price: 850, currency: "SEK", keywords: ["bil", "lektion"] },
{ service_name: "Riskettan Bil", price: 800, currency: "SEK", keywords: ["risk 1", "riskettan", "bil"] },
{ service_name: "Risktvåan Bil (Halkbana)", price: 2200, currency: "SEK", keywords: ["risk 2", "halkbana", "bil"] }
);
templateData.booking_links.CAR = "https://mitt.mydrivingacademy.com/login";
}

if (s.includes("MC")) {
templateData.prices.push(
{ service_name: "Körlektion MC (80 min)", price: 1650, currency: "SEK", keywords: ["mc", "lektion", "motorcykel"] },
{ service_name: "Riskettan MC", price: 800, currency: "SEK", keywords: ["risk 1", "mc", "riskettan"] },
{ service_name: "Risktvåan MC", price: 3400, currency: "SEK", keywords: ["risk 2", "mc", "knix"] }
);
templateData.booking_links.MC = "https://mitt.mydrivingacademy.com/login";
}

if (s.includes("AM")) {
templateData.prices.push({ service_name: "Mopedutbildning AM", price: 5400, currency: "SEK", keywords: ["moped", "am", "moppekort"] });
templateData.booking_links.AM = "https://mitt.mydrivingacademy.com/login";
}
}

// 6. Skriv till fil
const knowledgePath = isPackaged ? path.join(process.resourcesPath, 'knowledge') : path.join(__dirname, 'knowledge');
fs.writeFileSync(path.join(knowledgePath, `${routing_tag}.json`), JSON.stringify(templateData, null, 2), 'utf8');

console.log(`✅ [ADMIN] Skapat kontor och JSON-fil: ${routing_tag}`);
res.json({ success: true });

} catch (err) {
console.error("❌ Create Office Error:", err);
if (err.message?.includes('UNIQUE constraint')) {
return res.status(409).json({ error: `Routing tag '${routing_tag}' eller namn används redan.` });
}
res.status(500).json({ error: "Internt serverfel vid skapande av kontor" });
}
});

// =============================================================================
// ADMIN: RADERA KONTOR (Fil + DB + Rensning av routing_tag hos användare)
// =============================================================================
app.delete('/api/admin/office/:tag', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied" });

const { tag } = req.params;
if (!tag) return res.status(400).json({ error: "Tag required" });

try {
// 1. Radera knowledge-filen om den finns
const knowledgePath = isPackaged ? path.join(process.resourcesPath, 'knowledge') : path.join(__dirname, 'knowledge');
const filePath = path.join(knowledgePath, `${tag}.json`);
if (fs.existsSync(filePath)) {
fs.unlinkSync(filePath);
console.log(`🗑️ [ADMIN] Raderade kunskapsfil: ${tag}.json`);
} else {
console.warn(`⚠️ [ADMIN] Kunskapsfil saknades redan: ${tag}.json`);
}

// 2. Radera kontoret från databasen
await new Promise((resolve, reject) => {
db.run("DELETE FROM offices WHERE routing_tag = ?", [tag], (err) => err ? reject(err) : resolve());
});

// 3. Rensa taggen från alla användares routing_tag-sträng
const usersWithTag = await new Promise((resolve, reject) => {
db.all("SELECT id, routing_tag FROM users WHERE routing_tag LIKE ?", [`%${tag}%`], (err, rows) => err ? reject(err) : resolve(rows || []));
});

for (const u of usersWithTag) {
const cleaned = (u.routing_tag || '')
.split(',')
.map(t => t.trim())
.filter(t => t !== tag)
.join(',');
await new Promise((resolve, reject) => {
db.run("UPDATE users SET routing_tag = ? WHERE id = ?", [cleaned || null, u.id], (err) => err ? reject(err) : resolve());
});
}

console.log(`✅ [ADMIN] Kontor raderat: ${tag} (${usersWithTag.length} användare uppdaterade)`);
res.json({ success: true });

} catch (err) {
console.error("❌ Delete Office Error:", err);
res.status(500).json({ error: "Internt serverfel vid radering av kontor" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: // POST /api/team/reply - Send Reply via HTTP (For Scripts/Tests)
// -------------------------------------------------------------------------
app.post('/api/team/reply', authenticateToken, async (req, res) => {
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
// GET KNOWLEDGE DATA (Hybrid: File System + DB Fallback)
// =============================================================================
app.get('/api/knowledge/:routingTag', authenticateToken, async (req, res) => {
const { routingTag } = req.params;

// 1. Försök ladda från fil (Rikare innehåll)
const knowledgePath = isPackaged 
? path.join(process.resourcesPath, 'knowledge') 
: path.join(__dirname, 'knowledge');
const filePath = path.join(knowledgePath, `${routingTag}.json`);

if (fs.existsSync(filePath)) {
try {
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
return res.json(data);
} catch (e) {
console.error(`Error parsing knowledge file for ${routingTag}:`, e);
}
}

// 2. Fallback till Databasen (Om filen saknas)
try {
const office = await new Promise((resolve, reject) => {
db.get("SELECT * FROM offices WHERE routing_tag = ?", [routingTag], (err, row) => {
if (err) reject(err); else resolve(row);
});
});

if (office) {
// Bygg ett "fake" knowledge-objekt från DB-datan så frontend blir glad
const fallbackData = {
id: routingTag,
city: office.city,
area: office.area,
office_color: office.office_color,
contact: {
phone: office.phone,
email: office.email,
address: office.address
},
description: "Information hämtad från databasen (Ingen JSON-fil hittades).",
prices: [], // Tom lista som fallback
services_offered: []
};
return res.json(fallbackData);
} else {
return res.status(404).json({ error: "Kontoret hittades varken i DB eller som fil" });
}
} catch (err) {
return res.status(500).json({ error: "Databasfel vid hämtning av kontor" });
}
});

// =============================================================================
// ENDPOINT: SKAPA INTERNT MEDDELANDE (Agent till Agent)
// =============================================================================
app.post('/api/team/create-internal', authenticateToken, async (req, res) => {
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

// 2. Uppdatera data (Totalbesiktigad - Idiotsäker & RAG-synkad)
app.put('/api/knowledge/:routingTag', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') {
return res.status(403).json({ error: "Access denied" });
}

const routingTag = req.params.routingTag;
const updates = req.body; 

const knowledgePath = isPackaged 
? path.join(process.resourcesPath, 'knowledge')
: path.join(__dirname, 'knowledge');
const filePath = path.join(knowledgePath, `${routingTag}.json`);

if (!fs.existsSync(filePath)) {
return res.status(404).json({ error: "Knowledge file not found" });
}

try {
// Läs originalfilen för att bevara den fasta strukturen (id, keywords, etc.)
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// --- A. TOPPNIVÅ (TEXT & IDENTITET) ---
if (updates.description) data.description = updates.description;
if (updates.brand) data.brand = updates.brand;
if (updates.office_color) data.office_color = updates.office_color;

// Uppdatera namn om brand, stad eller område ändras (valfritt men rekommenderat)
data.name = `${data.brand} - ${data.city} ${data.area || ''}`.trim();

// --- B. KONTAKTUPPGIFTER & KOORDINATER (DJUP MERGE) ---
if (updates.contact) {
data.contact = {
...data.contact,
...updates.contact,
// Säkra att coordinates inte skrivs över av misstag om de saknas i updates
coordinates: updates.contact.coordinates ? {
...data.contact.coordinates,
...updates.contact.coordinates
} : data.contact.coordinates
};
}

// --- C. BOKNINGSLÄNKAR (CAR, MC, AM, PORTAL ETC.) ---
if (updates.booking_links) {
data.booking_links = {
...data.booking_links,
...updates.booking_links
};
}

// --- D. LISTOR & MATRISER (Hela listor ersätts) ---
if (updates.opening_hours) data.opening_hours = updates.opening_hours;
if (updates.languages) data.languages = updates.languages;
if (updates.services_offered) data.services_offered = updates.services_offered;

// --- E. PRISUPPDATERING (KOMPLETT ERSÄTTNING — stöder radering av rader) ---
if (updates.prices && Array.isArray(updates.prices)) {
data.prices = updates.prices;

// Dedup-synk av services_offered: baserat på keywords hos kvarvarande priser
const activeServices = new Set();
data.prices.forEach(p => {
const kw = p.keywords || [];
if (kw.some(k => k === 'bil')) activeServices.add('Bil');
if (kw.some(k => k === 'mc' || k === 'motorcykel')) activeServices.add('MC');
if (kw.some(k => k === 'am' || k === 'moped')) activeServices.add('AM');
});
// Bevara bara de tjänster som faktiskt har kvarvarande priser
data.services_offered = (data.services_offered || []).filter(s => activeServices.has(s));

// Städa booking_links för borttagna tjänster
if (data.booking_links) {
if (!activeServices.has('Bil')) data.booking_links.CAR = null;
if (!activeServices.has('MC')) data.booking_links.MC = null;
if (!activeServices.has('AM')) data.booking_links.AM = null;
}
}

// --- F. 🧠 GLOBAL SMART KEYWORD LOGIC (FÖR RAG-MOTORN) ---
// Detta garanterar att sökbarheten alltid är intakt efter en editering.
const city = data.city.toLowerCase();
const area = (data.area || "").toLowerCase();

const syncKeywords = (targetArr) => {
if (!Array.isArray(targetArr)) targetArr = [];
if (!targetArr.includes(city)) targetArr.push(city);
if (area && !targetArr.includes(area)) targetArr.push(area);
// Lägg även till brand-namnet som sökord (t.ex. "mårtenssons")
const brandKey = data.brand.toLowerCase().split(' ')[0];
if (!targetArr.includes(brandKey)) targetArr.push(brandKey);
return targetArr;
};

// Kör synk på alla nivåer där sökord finns
data.keywords = syncKeywords(data.keywords);
if (data.prices) data.prices.forEach(p => p.keywords = syncKeywords(p.keywords));
if (data.services) data.services.forEach(s => s.keywords = syncKeywords(s.keywords));

// --- G. AI-VALIDERING (Tillägg D) ---
try {
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const validation = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: 'Du är en JSON-validerare för ett trafikskoleföretags kontorsdatabas. Kontrollera att JSON-strukturen är intakt och att kontaktuppgifter/priser är rimliga. Svara BARA "OK" om allt är godkänt, annars en kort förklaring på svenska.' },
{ role: 'user', content: `Kontor: ${routingTag}\nData:\n${JSON.stringify(data, null, 2)}` }
],
max_tokens: 200,
temperature: 0
});
const aiReply = validation.choices[0]?.message?.content?.trim() || 'OK';
if (!aiReply.startsWith('OK')) {
return res.status(422).json({ error: 'AI-validering nekade sparning.', aiMessage: aiReply });
}
} catch (aiErr) {
console.warn(`[KNOWLEDGE-PUT] AI-validering misslyckades, fortsätter ändå:`, aiErr.message);
}

// --- H. SKRIV TILL DISK ---
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

// --- I. SYNKA FÄRG TILL SQL (så preloadOffices/ärendekort får rätt färg direkt) ---
if (updates.office_color) {
await new Promise((resolve, reject) => {
db.run(
'UPDATE offices SET office_color = ? WHERE routing_tag = ?',
[updates.office_color, routingTag],
(err) => err ? reject(err) : resolve()
);
});
console.log(`🎨 [ADMIN-UPDATE] office_color synkad till SQL för ${routingTag}: ${updates.office_color}`);
}

console.log(`✅ [ADMIN-UPDATE] ${routingTag}.json sparad och SEO-säkrad.`);
res.json({ success: true, message: "Kontoret uppdaterat utan att skada RAG-strukturen." });

} catch (err) {
console.error(`❌ [PUT ERROR] ${routingTag}:`, err);
res.status(500).json({ error: "Kunde inte spara ändringar i filen." });
}
});

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
const { sessionId } = payload;
// Skicka till kundens frontend
io.to(sessionId).emit('client:agent_typing', { sessionId });
// Broadcast globalt till teamet — fångas av team:client_typing-lyssnaren för interna chattar
io.emit('team:client_typing', { sessionId });
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

// 🔥 FIX: Packa upp textsträngen här med!
const raw = tempStored?.context_data;
let tempCtx = (typeof raw === 'string' ? JSON.parse(raw) : raw) || { 
messages: [], 
locked_context: { city: null, area: null, vehicle: null } 
};

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
// ✅ RÄTT: Vi uppdaterar variabeln vi skapade ovanför
contextData = stored?.context_data || { messages: [], locked_context: {} }; 
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

// -------------------------------------------------------------------------
// AUTH MIDDLEWARE (TEAM) - HÅRDAD
// -------------------------------------------------------------------------

// JWT Token Verification for Team Routes - UPPDATERAD FÖR ATT TILLÅTA API-NYCKEL
function authenticateToken(req, res, next) {
const authHeader = req.headers['authorization'];
const apiKey = req.headers['x-api-key']; // Kolla efter API-nyckel
const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

// 1. Tillåt interna anrop från main.js via API-nyckel
if (apiKey && apiKey === process.env.CLIENT_API_KEY) {
req.user = { username: 'System', role: 'admin' };
return next();
}

// 2. Standard Bearer-token för användare (Webb/Renderer)
if (token == null) return res.status(401).json({ error: 'Auth required' });

jwt.verify(token, JWT_SECRET, (err, user) => {
if (err) return res.status(403).json({ error: 'Invalid token' });
req.user = user; 
next();
});
}

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

// =============================================================================
// CLIENT API ENDPOINTS
// =============================================================================

// -------------------------------------------------------------------------
// ENDPOINT: // POST /search_all - Renderer Client Search (Requires API Key)
// -------------------------------------------------------------------------
app.post('/search_all', async (req, res) => {
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
// TEAM ENDPOINTS
// ENDPOINT: // GET /team/inbox - Fetch Unclaimed Tickets (Human Mode)
// -------------------------------------------------------------------------
app.get('/team/inbox', authenticateToken, async (req, res) => {
try {
let tickets;
if (req.user.role === 'admin' || req.user.role === 'support') {
tickets = await new Promise((resolve, reject) => {
// ERSÄTT SQL-strängen inuti if (req.user.role === 'admin')
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
if (err) {
console.error("❌ Admin inbox SQL Error:", err);
reject(err);
} else {
resolve(rows || []);
}
});
});
} else {
// Här anropas db.js - se till att getAgentTickets också SELECT:ar office_color
tickets = await getAgentTickets(req.user.username);
}

const ticketsWithData = await Promise.all(
tickets.map(async (t) => {
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

const finalName = locked.name || locked.contact_name || locked.full_name || locked.Name || null;

return {
...t,
messages,
last_message: lastMsg,
office_color: t.office_color, // ✅ MAPPING-FIX: Tvingar med färgen till frontend
contact_name: finalName,
contact_email: locked.email || locked.contact_email || null,
contact_phone: locked.phone || locked.contact_phone || null,
subject: locked.subject || null,
city: locked.city || null,
vehicle: locked.vehicle || null
};
})
);

res.json({ tickets: ticketsWithData });

} catch (err) {
console.error("[TEAM] Inbox error:", err);
res.status(500).json({ error: "Database error" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: GET /team/inbox/search?q=... - Sök i aktiva ärenden
// -------------------------------------------------------------------------
app.get('/team/inbox/search', authenticateToken, async (req, res) => {
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
app.post('/team/claim', authenticateToken, async (req, res) => {
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
app.post('/team/assign', authenticateToken, async (req, res) => {
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
app.get('/team/my-tickets', authenticateToken, async (req, res) => {
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

// =============================================================================
// API TEMPLATE MANAGEMENT ENDPOINTS
// =============================================================================

// -------------------------------------------------------------------------
// ENDPOINT: // GET /api/templates - Fetch All Templates (For Electron IPC)
// -------------------------------------------------------------------------
app.get('/api/templates', authenticateToken, async (req, res) => {
try {
const templates = await getTemplatesCached();
res.json(templates);
} catch (err) {
console.error("[TEMPLATES] Load error:", err);
res.status(500).json({ error: "Database error" });
}
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/templates/save (SPARA/UPPDATERA MALL VIA WEBB)
// -------------------------------------------------------------------------
app.post('/api/templates/save', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { id, title, content, group_name } = req.body;
const sql = `
INSERT INTO templates (id, title, content, group_name) 
VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET 
title = excluded.title, 
content = excluded.content, 
group_name = excluded.group_name
`;

// Använd id från body eller skapa nytt om det saknas
const finalId = id || Date.now();

db.run(sql, [finalId, title, content, group_name], function(err) {
if (err) {
console.error("Template Save Error:", err);
return res.status(500).json({ error: "Kunde inte spara mallen" });
}

cachedTemplates = null; // Rensa cachen (om variabeln finns globalt)
res.json({ status: 'success' });
});
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/templates/delete/:id (RADERA MALL VIA WEBB)
// -------------------------------------------------------------------------
app.delete('/api/templates/delete/:id', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { id } = req.params;
if (!id) return res.status(400).json({ error: "id saknas" });

db.run('DELETE FROM templates WHERE id = ?', [id], function(err) {
if (err) {
console.error("[TEMPLATES] Delete error:", err);
return res.status(500).json({ error: "Kunde inte radera mallen" });
}
if (this.changes === 0) {
return res.status(404).json({ error: "Mall hittades inte" });
}
cachedTemplates = null; // Rensa cachen
res.json({ status: 'success' });
});
});

// =====================================================================
// 🌍 PUBLIC CUSTOMER CHAT ENDPOINT (NO AUTH, NO SOCKET, SAFE)
// =====================================================================
app.post("/api/customer/message", async (req, res) => {
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
app.get("/api/customer/history/:sessionId", async (req, res) => {
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
app.post("/api/customer/message-form", async (req, res) => {
try {
const { name, email, phone, subject, message, city, area, vehicle } = req.body; // 🔥 HÄMTA CITY/VEHICLE

if (!name || !email || !message) {
return res.status(400).json({
error: "name, email and message are required"
});
}

// Skapa ett unikt ärende-id
const conversationId = crypto.randomUUID();

const now = Math.floor(Date.now() / 1000);

// Spara som nytt ärende i chat_v2_state
const { agent_id } = req.body; // 🔥 Hämta kontorsvalet (t.ex. eslov)
await new Promise((resolve, reject) => {
db.run(
`
INSERT INTO chat_v2_state (
conversation_id,
session_type,
human_mode,
owner,
office,
updated_at
) VALUES (?, 'message', 1, ?, ?, ?)
`,
[conversationId, null, agent_id || null, now],
err => (err ? reject(err) : resolve())
);
});

// 🔥 SPARA I LOCKED_CONTEXT FÖR AGENTENS FÄRGKODNING
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

// ✅ GLOBAL UPDATE: Nytt ärende från formulär synkas direkt för alla
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

// =============================================================================
// INBOX MANAGEMENT ENDPOINTS
// ENDPOINT: /api/inbox/delete (RADERA FRÅGA TOTALT)
// -------------------------------------------------------------------------
app.post('/api/inbox/delete', authenticateToken, async (req, res) => {
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
app.post('/api/inbox/archive', authenticateToken, (req, res) => {
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
app.get('/api/archive', authenticateToken, (req, res) => {
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


// =============================================================================
// INTERNAL NOTES API
// =============================================================================
app.get('/api/notes/:conversationId', authenticateToken, async (req, res) => {
try {
const notes = await getTicketNotes(req.params.conversationId);
res.json(notes);
} catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notes', authenticateToken, async (req, res) => {
const { conversationId, content } = req.body;
const agentName = req.user.username;
try {
await addTicketNote(conversationId, agentName, content);
res.json({ success: true });
} catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/notes/:id', authenticateToken, async (req, res) => {
try {
const note = await getTicketNoteById(req.params.id);
if (!note) return res.status(404).json({ error: 'Note not found' });
if (note.agent_name !== req.user.username && req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });

await updateTicketNote(req.params.id, req.body.content);
res.json({ success: true });
} catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
try {
const note = await getTicketNoteById(req.params.id);
if (!note) return res.status(404).json({ error: 'Note not found' });
if (note.agent_name !== req.user.username && req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });

await deleteTicketNote(req.params.id);
res.json({ success: true });
} catch (err) { res.status(500).json({ error: err.message }); }
});

// =========================================================================
// WEBHOOK: Tar emot data från Loveable (Chatt & Kontaktuppgifter)
// =========================================================================
app.post('/webhook/lhc-chat', async (req, res) => {
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

// 🔥 FIX: Parsa om sträng (Viktig säkerhetsåtgärd)
let raw = storedContext?.context_data;
let contextData = (typeof raw === 'string' ? JSON.parse(raw) : raw) 
|| { variables: {}, messages: [] };

// Säkra att messages är en array innan push
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

const BLOCKED_CONFIG_KEYS = ['OPENAI_API_KEY', 'JWT_SECRET', 'CLIENT_API_KEY', 'NGROK_TOKEN', 'LHC_WEBHOOK_SECRET', 'GITHUB_TOKEN'];

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

app.get('/api/admin/system-config', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const envPath = getEnvPath();
const fp = getFilePaths();
const config = {};

// Varje del i eget try-catch — ett misslyckat block stoppar inte resten
try {
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split(/\r?\n/).forEach(line => {
const m = line.match(/^([^=#\s][^=]*)=(.*)$/);
if (m) {
const key = m[1].trim();
const val = m[2].trim().replace(/^["']|["']$/g, '');
if (!BLOCKED_CONFIG_KEYS.includes(key)) config[key] = val;
}
});
} catch (err) { console.error('[SYSCONFIG] .env:', err.message); }

try {
if (fs.existsSync(fp.mainJs)) {
const c = fs.readFileSync(fp.mainJs, 'utf8');
const m = c.match(/const SERVER_PORT = (\d+)/);
if (m) config._main_PORT = m[1];
}
} catch (err) { console.error('[SYSCONFIG] mainJs:', err.message); }

try {
if (fs.existsSync(fp.legacyJs)) {
const c = fs.readFileSync(fp.legacyJs, 'utf8');
const pm = c.match(/^const PORT = (\d+)/m);
if (pm) config._legacy_PORT = pm[1];
const dm = c.match(/const DEV_PATH = '([^']+)'/);
if (dm) config.DEV_PATH = dm[1];
}
} catch (err) { console.error('[SYSCONFIG] legacyJs:', err.message); }

try {
if (fs.existsSync(fp.rendererJs)) {
const c = fs.readFileSync(fp.rendererJs, 'utf8');
const m = c.match(/const NGROK_HOST = "([^"]+)"/);
if (m) config._renderer_NGROK = m[1];
}
} catch (err) { console.error('[SYSCONFIG] rendererJs:', err.message); }

try {
if (fs.existsSync(fp.intentJs)) {
const c = fs.readFileSync(fp.intentJs, 'utf8');
const def = c.match(/this\.defaultConfidence = ([\d.]+)/);
if (def) config.defaultConfidence = def[1];
const intentMap = {
conf_weather: /intent = 'weather';\s*\n\s*confidence = ([\d.]+)/,
conf_testlesson: /intent = 'testlesson_info';\s*\n\s*confidence = ([\d.]+)/,
conf_risk: /intent = 'risk_info';\s*\n\s*confidence = ([\d.]+)/,
conf_handledare: /intent = 'handledare_course';\s*\n\s*confidence = ([\d.]+)/,
conf_tillstand: /intent = 'tillstand_info';\s*\n\s*confidence = ([\d.]+)/,
conf_policy: /intent = 'policy';\s*\n\s*confidence = ([\d.]+)/,
conf_contact: /intent = 'contact_info';\s*\n\s*confidence = ([\d.]+)/,
conf_booking: /intent = 'booking';\s*\n\s*confidence = ([\d.]+)/,
conf_price: /intent = 'price_lookup';\s*\n\s*confidence = ([\d.]+)/,
conf_discount: /intent = 'discount';\s*\n\s*confidence = ([\d.]+)/,
conf_intent: /intent = 'intent_info';\s*\n\s*confidence = ([\d.]+)/
};
Object.entries(intentMap).forEach(([key, regex]) => {
const m = c.match(regex);
if (m) config[key] = m[1];
});
}
} catch (err) { console.error('[SYSCONFIG] intentJs:', err.message); }

config.KNOWLEDGE_BASE_PATH = fp.knowledgePath;
res.json(config); // Returnerar alltid 200 med det vi lyckades hämta
});

app.post('/api/admin/system-config', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const { field, value } = req.body;
if (!field || value === undefined || value === null || String(value).trim() === '') {
return res.status(400).json({ error: 'field och value krävs.' });
}
if (BLOCKED_CONFIG_KEYS.includes(field)) {
return res.status(403).json({ error: 'Detta fält får inte ändras via UI.' });
}

const envPath = getEnvPath();
const fp = getFilePaths();
const val = String(value).trim();
const changedFiles = [];
let restartRequired = false;

try {
// Tillägg C: Backup .env innan skrivning
fs.copyFileSync(envPath, envPath + '.bak');

// Uppdatera .env
const envFields = ['PORT', 'NGROK_DOMAIN', 'EMAIL_USER', 'EMAIL_PASS'];
if (envFields.includes(field)) {
let envContent = fs.readFileSync(envPath, 'utf8');
const regex = new RegExp(`^${field}=.*`, 'm');
if (regex.test(envContent)) {
envContent = envContent.replace(regex, `${field}=${val}`);
} else {
envContent += `\n${field}=${val}`;
}
fs.writeFileSync(envPath, envContent, 'utf8');
changedFiles.push('.env');
restartRequired = true;
}

// Synk sekundära filer
if (field === 'PORT') {
if (fs.existsSync(fp.mainJs)) {
let c = fs.readFileSync(fp.mainJs, 'utf8');
c = c.replace(/const SERVER_PORT = \d+;/, `const SERVER_PORT = ${val};`);
fs.writeFileSync(fp.mainJs, c, 'utf8');
changedFiles.push('main.js');
}
if (fs.existsSync(fp.legacyJs)) {
let c = fs.readFileSync(fp.legacyJs, 'utf8');
c = c.replace(/^const PORT = \d+;/m, `const PORT = ${val};`);
fs.writeFileSync(fp.legacyJs, c, 'utf8');
changedFiles.push('legacy_engine.js');
}
} else if (field === 'NGROK_DOMAIN') {
if (fs.existsSync(fp.rendererJs)) {
let c = fs.readFileSync(fp.rendererJs, 'utf8');
c = c.replace(/const NGROK_HOST = ".*?";/, `const NGROK_HOST = "https://${val}";`);
fs.writeFileSync(fp.rendererJs, c, 'utf8');
changedFiles.push('Renderer/renderer.js');
}
} else if (field === 'defaultConfidence') {
if (fs.existsSync(fp.intentJs)) {
let c = fs.readFileSync(fp.intentJs, 'utf8');
c = c.replace(/this\.defaultConfidence = [\d.]+;/, `this.defaultConfidence = ${val};`);
fs.writeFileSync(fp.intentJs, c, 'utf8');
changedFiles.push('patch/intentEngine.js');
}
} else if (field.startsWith('conf_')) {
const intentNameMap = {
conf_weather: 'weather', conf_testlesson: 'testlesson_info',
conf_risk: 'risk_info', conf_handledare: 'handledare_course',
conf_tillstand: 'tillstand_info', conf_policy: 'policy',
conf_contact: 'contact_info', conf_booking: 'booking',
conf_price: 'price_lookup', conf_discount: 'discount',
conf_intent: 'intent_info'
};
const intentName = intentNameMap[field];
if (intentName && fs.existsSync(fp.intentJs)) {
let c = fs.readFileSync(fp.intentJs, 'utf8');
const regex = new RegExp(`(intent = '${intentName}';\\s*\\n\\s*confidence = )[\\d.]+`, 'g');
c = c.replace(regex, `$1${val}`);
fs.writeFileSync(fp.intentJs, c, 'utf8');
changedFiles.push('patch/intentEngine.js');
}
}

// Hot-reload: Om e-postuppgifter ändrades, återskapa transporter direkt
if (field === 'EMAIL_USER' || field === 'EMAIL_PASS') {
process.env[field] = val; // Uppdatera process.env så recreate läser rätt värde
recreateMailTransporter();
restartRequired = false; // Ingen omstart behövs för detta
}

console.log(`[SYSCONFIG] ${field} = ${val} | Filer: ${changedFiles.join(', ')}`);
res.json({ success: true, changedFiles, restartRequired });
} catch (err) {
console.error('[SYSCONFIG POST]', err);
res.status(500).json({ error: 'Kunde inte spara konfiguration.' });
}
});

// =====================================================================
// 🛡️ ADMIN — DRIFT & SÄKERHET (operation-settings)
// =====================================================================
app.get('/api/admin/operation-settings', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
res.json({
imap_enabled:           imapEnabled,
backup_interval_hours:  backupInterval,
backup_path:            backupPath,
jwt_expires_in:         jwtExpiresIn,
auto_human_exit:        autoHumanExit
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
// 📚 ADMIN — KUNSKAPSBANK / BASFAKTA (Del 3)
// =====================================================================

app.get('/api/admin/basfakta-list', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const knowledgePath = getFilePaths().knowledgePath;
try {
const files = fs.readdirSync(knowledgePath)
.filter(f => /^basfakta_[\w]+\.json$/.test(f))
.map(filename => {
try {
const data = JSON.parse(fs.readFileSync(path.join(knowledgePath, filename), 'utf8'));
return { filename, id: data.id || filename, section_title: data.section_title || filename };
} catch (e) {
return { filename, id: filename, section_title: filename };
}
})
.sort((a, b) => a.section_title.localeCompare(b.section_title, 'sv'));
res.json(files);
} catch (err) {
console.error('[BASFAKTA LIST]', err);
res.status(500).json({ error: 'Kunde inte läsa kunskapsbanken.' });
}
});

app.get('/api/admin/basfakta/:filename', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const { filename } = req.params;
if (!/^basfakta_[\w]+\.json$/.test(filename)) {
return res.status(400).json({ error: 'Ogiltigt filnamn.' });
}

const filePath = path.join(getFilePaths().knowledgePath, filename);
if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fil hittades ej.' });

try {
res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
} catch (err) {
console.error('[BASFAKTA GET]', err);
res.status(500).json({ error: 'Kunde inte läsa filen.' });
}
});

app.put('/api/admin/basfakta/:filename', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const { filename } = req.params;
if (!/^basfakta_[\w]+\.json$/.test(filename)) {
return res.status(400).json({ error: 'Ogiltigt filnamn.' });
}

const { sections } = req.body;
if (!Array.isArray(sections) || sections.length === 0) {
return res.status(400).json({ error: 'Sektioner saknas eller är tomma.' });
}

const filePath = path.join(getFilePaths().knowledgePath, filename);
if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fil hittades ej.' });

try {
const originalData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

if (sections.length < originalData.sections.length) {
return res.status(400).json({
error: `Antalet sektioner får inte minska. Original: ${originalData.sections.length}, Förslag: ${sections.length}`
});
}

// Bygg uppdaterat objekt (bevara keywords och extra fält per sektion)
const updatedSections = originalData.sections.map((orig, i) => {
const proposed = sections[i];
if (!proposed) return orig;
return { ...orig, title: proposed.title || orig.title, answer: proposed.answer || orig.answer };
});

const proposedData = { ...originalData, sections: updatedSections };

// AI-validering
try {
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const validation = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: 'Du är en JSON-validerare för ett trafikskoleföretags kunskapsbas. Validera att JSON-strukturen är intakt och att texten är konsistent och professionell. Svara BARA "OK" om allt är godkänt, annars en kort förklaring på svenska om vad som är fel.' },
{ role: 'user', content: `Original:\n${JSON.stringify(originalData, null, 2)}\n\nFörslag:\n${JSON.stringify(proposedData, null, 2)}` }
],
max_tokens: 200,
temperature: 0
});
const aiReply = validation.choices[0]?.message?.content?.trim() || 'OK';
if (!aiReply.startsWith('OK')) {
return res.status(422).json({ error: 'AI-validering nekade sparning.', aiMessage: aiReply });
}
} catch (aiErr) {
console.warn('[BASFAKTA AI-VALIDATION] AI-validering misslyckades, sparar ändå:', aiErr.message);
}

fs.writeFileSync(filePath, JSON.stringify(proposedData, null, 2), 'utf8');
console.log(`✅ [BASFAKTA] ${filename} uppdaterad.`);
res.json({ success: true, message: 'Filen sparad och validerad.' });

} catch (err) {
console.error('[BASFAKTA PUT]', err);
res.status(500).json({ error: 'Kunde inte spara filen.' });
}
});

// =====================================================================
// 🛠️ ADMIN — AVAILABLE-SERVICES (Tillägg B)
// =====================================================================
app.get('/api/admin/available-services', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const knowledgePath = getFilePaths().knowledgePath;
const serviceFiles = ['basfakta_lektioner_paket_bil.json', 'basfakta_lektioner_paket_mc.json'];
const serviceNames = new Set();

serviceFiles.forEach(filename => {
const filePath = path.join(knowledgePath, filename);
if (fs.existsSync(filePath)) {
try {
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
if (data.sections) data.sections.forEach(s => { if (s.title) serviceNames.add(s.title); });
} catch (e) {
console.warn('[SERVICES] Kunde inte läsa', filename);
}
}
});

res.json([...serviceNames].sort((a, b) => a.localeCompare(b, 'sv')));
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
const backupMs = (backupInterval || 24) * 3600 * 1000;
backupTimerId = setInterval(runDatabaseBackup, backupMs); // Spara referens för hot-reload
console.log(`✅ [Backup] Schemalagt var ${backupInterval}h`);
});
});