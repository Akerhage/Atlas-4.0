// ============================================
// routes/admin.js — Admin & användarhantering
// VAD DEN GÖR: CRUD för agenter, kontor, system-
//              konfiguration och kunskapsbank.
//              OBS: /api/admin/operation-settings
//              finns kvar i server.js (mutable state).
// ANVÄNDS AV: server.js via app.use('/', adminRoutes)
//             + adminRoutes.init({ io, getEnvPath,
//               getFilePaths, BLOCKED_CONFIG_KEYS,
//               recreateMailTransporter, setSetting,
//               runDatabaseBackup, authRoutes })
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const OpenAI = require('openai');
const { db, getUserByUsername, getContextRow } = require('../db');
const { loadKnowledgeBase } = require('../legacy_engine');
const authenticateToken = require('../middleware/auth');

// __dirname pekar på routes/ — lägg till '..' för att nå Atlas-roten
const isPackaged = process.env.IS_PACKAGED === 'true';

// Server.js-lokala beroenden injiceras via init()
let io, getEnvPath, getFilePaths, BLOCKED_CONFIG_KEYS,
    recreateMailTransporter, setSetting, runDatabaseBackup, authRoutes;

router.init = function({ io: _io, getEnvPath: _gep, getFilePaths: _gfp,
  BLOCKED_CONFIG_KEYS: _bck, recreateMailTransporter: _rmt,
  setSetting: _ss, runDatabaseBackup: _rdb, authRoutes: _ar }) {
io = _io;
getEnvPath = _gep;
getFilePaths = _gfp;
BLOCKED_CONFIG_KEYS = _bck;
recreateMailTransporter = _rmt;
setSetting = _ss;
runDatabaseBackup = _rdb;
authRoutes = _ar;
};

// =========================================================================
// ADMIN & ANVÄNDARHANTERING (Komplett Atlas Suite)
// =========================================================================
// 1. GET: Hämta användare till "Tilldela"-rutan
router.get('/api/auth/users', authenticateToken, (req, res) => {
db.all("SELECT username, role, agent_color, avatar_id, status_text, display_name, is_online FROM users WHERE role != 'system' ORDER BY username ASC", [], (err, rows) => {
if (err) return res.status(500).json({ error: "Database error" });
res.json(rows);
});
});

// 2. GET: Hämta ALLA användare för Admin-panelen
router.get('/api/admin/users', authenticateToken, (req, res) => {
db.all("SELECT id, username, role, agent_color, avatar_id, status_text, display_name, is_online, last_seen, routing_tag FROM users WHERE role != 'system' ORDER BY username ASC", [], (err, rows) => {
if (err) return res.status(500).json({ error: "Database error" });
res.json(rows);
});
});

// 3. POST: Skapa ny agent
router.post('/api/admin/create-user', authenticateToken, async (req, res) => {
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
avatar_id ?? 0,
routing_tag || null
], function(err) {
if (err) return res.status(400).json({ error: "Användarnamnet upptaget" });
res.json({ success: true, userId: this.lastID });
});
} catch (e) { res.status(500).json({ error: "Kunde inte skapa användare" }); }
});

// 3B: Uppdatera befintlig användarprofil (Universal)
router.post('/api/admin/update-user-profile', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });

// ÄNDRING: Vi hämtar userId istället för id från req.body
const { userId, username, password, role, display_name, agent_color, avatar_id, routing_tag } = req.body;

try {
// SQL-frågan använder fortfarande kolumnnamnet "id", men vi mappar in variabeln "userId"
let sql = `UPDATE users SET role = ?, display_name = ?, agent_color = ?, avatar_id = ?, routing_tag = ? WHERE id = ?`;
let params = [role, display_name, agent_color, avatar_id, routing_tag, userId];

// Om lösenord skickats med, inkludera det i uppdateringen
if (password && password.trim().length >= 6) {
const hash = await bcrypt.hash(password, 10);
sql = `UPDATE users SET role = ?, display_name = ?, agent_color = ?, avatar_id = ?, routing_tag = ?, password_hash = ? WHERE id = ?`;
params = [role, display_name, agent_color, avatar_id, routing_tag, hash, userId];
}

db.run(sql, params, function(err) {
if (err) {
console.error("Update profile error:", err);
return res.status(500).json({ error: "Kunde inte uppdatera profil" });
}
// Loggar med userId så det matchar dina andra admin-loggar
console.log(`👤 [ADMIN] Uppdaterade profil för @${username} (ID: ${userId})`);
res.json({ success: true });
});
} catch (e) {
console.error("System error during update:", e);
res.status(500).json({ error: "Systemfel vid uppdatering" });
}
});


// 4. POST: Uppdatera roll (Gör till Admin / Ta bort Admin)
router.post('/api/admin/update-role', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { userId, newRole } = req.body;
if (userId === req.user.id) return res.status(400).json({ error: "Du kan inte ändra din egen roll" });

db.run("UPDATE users SET role = ? WHERE id = ?", [newRole, userId], (err) => {
if (err) return res.status(500).json({ error: "Kunde inte uppdatera roll" });
res.json({ success: true });
});
});

// 5. POST: Reset lösenord (Administrativt)
router.post('/api/admin/reset-password', authenticateToken, async (req, res) => {
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
router.post('/api/admin/delete-user', authenticateToken, async (req, res) => {
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

// GET /api/admin/user-stats - Hämtar global statistik för dashboarden
router.get('/api/admin/user-stats', authenticateToken, (req, res) => {
db.get(`
SELECT
COUNT(DISTINCT conversation_id) as total_sessions,
SUM(CASE WHEN human_mode = 1 THEN 1 ELSE 0 END) as human_sessions,
MAX(updated_at) as last_activity
FROM chat_v2_state
`, [], (err, row) => {
if (err) {
console.error('❌ Fel vid hämtning av global statistik:', err.message);
return res.status(500).json({ error: err.message });
}
res.json(row || { total_sessions: 0, human_sessions: 0, last_activity: null });
});
});

// GET /api/admin/user-stats/:username - Hämtar statistik för en specifik agent
router.get('/api/admin/user-stats/:username', authenticateToken, (req, res) => {
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
router.get('/api/admin/agent-tickets/:username', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
try {
const { username } = req.params;

const user = await getUserByUsername(username);
const officeTags = user && user.routing_tag
? user.routing_tag.split(',').map(t => t.trim()).filter(t => t)
: [];

const placeholders = officeTags.length > 0
? officeTags.map(() => '?').join(',')
: "'__NOMATCH__'";

const params = [username, ...officeTags];

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
AND (
s.owner = ?
OR
s.office IN (${placeholders})
)
ORDER BY s.updated_at DESC
`;

db.all(sql, params, async (err, rows) => {
if (err) return res.status(500).json({ error: err.message });
const ticketsWithData = await Promise.all(rows.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
return {
...t,
office_color: t.office_color,
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
router.post('/api/admin/update-office-color', authenticateToken, async (req, res) => {
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
: path.join(__dirname, '..', 'knowledge');
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
router.post('/api/admin/update-agent-color', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { username, color } = req.body;
db.run("UPDATE users SET agent_color = ? WHERE username = ?", [color, username], (err) => {
if (err) return res.status(500).json({ error: err.message });
io.emit('agent:color_updated', { username, color });
res.json({ success: true });
});
});

// NY: Hantera agentens kontorsroller (routing_tags) - SYNCHRONIZED WITH RENDERER
router.post('/api/admin/update-agent-offices', authenticateToken, async (req, res) => {
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
router.get('/api/admin/office-tickets/:tag', authenticateToken, async (req, res) => {
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
AND (s.session_type IS NULL OR s.session_type != 'internal')
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
router.post('/api/admin/update-role-by-username', authenticateToken, (req, res) => {
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
router.post('/api/admin/create-office', authenticateToken, async (req, res) => {
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
const knowledgePath = isPackaged ? path.join(process.resourcesPath, 'knowledge') : path.join(__dirname, '..', 'knowledge');
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
router.delete('/api/admin/office/:tag', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: "Access denied" });

const { tag } = req.params;
if (!tag) return res.status(400).json({ error: "Tag required" });

try {
// 1. Radera knowledge-filen om den finns
const knowledgePath = isPackaged ? path.join(process.resourcesPath, 'knowledge') : path.join(__dirname, '..', 'knowledge');
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

// =============================================================================
// ADMIN: SYSTEMKONFIGURATION
// =============================================================================
router.get('/api/admin/system-config', authenticateToken, (req, res) => {
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

router.post('/api/admin/system-config', authenticateToken, (req, res) => {
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
// 📚 ADMIN — KUNSKAPSBANK / BASFAKTA (Del 3)
// =====================================================================

router.get('/api/admin/basfakta-list', authenticateToken, (req, res) => {
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


// =====================================================================
// 🛠️ ADMIN — GET - BASFAKTA-SKAPA/TA BORT SEKTIONER/AI KEYWORD VALIDERING
// =====================================================================
router.get('/api/admin/basfakta/:filename', authenticateToken, (req, res) => {
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

// =====================================================================
// 🛠️ ADMIN — PUT BASFAKTA-SKAPA/TA BORT SEKTIONER/AI KEYWORD VALIDERING
// =====================================================================
router.put('/api/admin/basfakta/:filename', authenticateToken, async (req, res) => {
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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Bygg en map från title -> original sektion för snabb uppslagning
const originalByTitle = {};
(originalData.sections || []).forEach(s => {
originalByTitle[s.title] = s;
});

// Bygg uppdaterade sektioner
const updatedSections = [];
for (const proposed of sections) {
const orig = originalByTitle[proposed.title];
if (orig) {
// Befintlig sektion – bevara keywords och alla extra fält exakt
updatedSections.push({ ...orig, title: proposed.title, answer: proposed.answer });
} else {
// Ny sektion – generera keywords via AI
let keywords = [];
try {
const kwRes = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{
role: 'system',
content: 'Du är ett system som genererar sökord för en trafikskolas kunskapsbas. Svara ENBART med en kommaseparerad lista med 5-10 korta, relevanta sökord på svenska i lowercase. Inga punkter, inga förklaringar, inga radbrytningar – bara orden separerade med komma.'
},
{
role: 'user',
content: `Rubrik: ${proposed.title}\nText: ${proposed.answer}`
}
],
max_tokens: 100,
temperature: 0
});
const raw = kwRes.choices[0]?.message?.content?.trim() || '';
keywords = raw
.split(',')
.map(k => k.trim().toLowerCase())
.filter(k => k.length > 0);
} catch (kwErr) {
console.warn('[BASFAKTA KEYWORDS] AI-generering misslyckades:', kwErr.message);
keywords = [];
}
updatedSections.push({ title: proposed.title, answer: proposed.answer, keywords });
}
}

const proposedData = { ...originalData, sections: updatedSections };

// AI JSON-validering (befintlig logik bevarad)
try {
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
console.log(`✅ [BASFAKTA] ${filename} uppdaterad. Sektioner: ${updatedSections.length}`);

// 🔄 HOT-RELOAD AV RAG-MOTORN
try {
loadKnowledgeBase();
console.log(`🔄 [RAG] Kunskapsdatabasen omladdad i minnet efter uppdatering!`);
} catch(e) {
console.error(`⚠️ [RAG] Kunde inte ladda om databasen:`, e);
}

res.json({ success: true, message: 'Filen sparad och validerad.' });

} catch (err) {
console.error('[BASFAKTA PUT]', err);
res.status(500).json({ error: 'Kunde inte spara filen.' });
}
});

// =====================================================================
// 🛠️ ADMIN — AVAILABLE-SERVICES (Tillägg B)
// =====================================================================
router.get('/api/admin/available-services', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

try {
// Hämta från den nya filen i assets/js
const templatePath = isPackaged
? path.join(process.resourcesPath, 'Renderer', 'assets', 'js', 'service_templates.json')
: path.join(__dirname, '..', 'Renderer', 'assets', 'js', 'service_templates.json');

if (fs.existsSync(templatePath)) {
const data = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
// Returnerar hela arrayen (inklusive keywords)
res.json(data);
} else {
console.warn('[SERVICES] Hittade inte service_templates.json på:', templatePath);
res.json([]);
}
} catch (e) {
console.error('[SERVICES] Kunde inte läsa service_templates.json:', e);
res.status(500).json({ error: 'Kunde inte läsa tjänstemallar' });
}
});

// ============================================================
// GET /api/admin/rag-failures — Hämtar RAG-misslyckanden
// DELETE /api/admin/rag-failures — Töm tabellen
// ============================================================
router.get('/api/admin/rag-failures', authenticateToken, (req, res) => {
const limit = Math.min(parseInt(req.query.limit) || 200, 500);
db.all(
`SELECT id, query, session_type, ts_fallback_used, ts_fallback_success, ts_url, created_at
FROM rag_failures ORDER BY created_at DESC LIMIT ?`,
[limit],
(err, rows) => {
if (err) return res.status(500).json({ error: err.message });
res.json(rows || []);
}
);
});

router.delete('/api/admin/rag-failures', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') {
return res.status(403).json({ error: 'Ej behörig' });
}
db.run(`DELETE FROM rag_failures`, (err) => {
if (err) return res.status(500).json({ error: err.message });
res.json({ success: true });
});
});

module.exports = router;
