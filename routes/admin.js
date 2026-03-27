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

// Validerar routing_tag — tillåter bara a-z, 0-9 och _ (inga slash, punkter etc.)
function isValidRoutingTag(tag) {
  return typeof tag === 'string' && /^[a-z0-9_]+$/.test(tag);
}

// =========================================================================
// ADMIN & ANVÄNDARHANTERING (Komplett Atlas Suite)
// =========================================================================
// 1. GET: Hämta användare till "Tilldela"-rutan
router.get('/api/auth/users', authenticateToken, (req, res) => {
db.all("SELECT username, role, agent_color, avatar_id, status_text, display_name, is_online, routing_tag FROM users WHERE role != 'system' ORDER BY username ASC", [], (err, rows) => {
if (err) return res.status(500).json({ error: "Database error" });
res.json(rows);
});
});

// 2. GET: Hämta ALLA användare för Admin-panelen
router.get('/api/admin/users', authenticateToken, (req, res) => {
db.all("SELECT id, username, role, agent_color, avatar_id, status_text, display_name, is_online, last_seen, routing_tag, allowed_views FROM users WHERE role != 'system' ORDER BY username ASC", [], (err, rows) => {
if (err) return res.status(500).json({ error: "Database error" });
res.json(rows);
});
});

// 3. POST: Skapa ny agent
router.post('/api/admin/create-user', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
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
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const { userId, username, password, role, display_name, agent_color, avatar_id, routing_tag } = req.body;

try {
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
console.log(`👤 [ADMIN] Uppdaterade profil för @${username} (ID: ${userId})`);
// Live-uppdatering: ny agentfärg och eventuell rolländring
if (typeof io !== 'undefined') {
    if (agent_color) io.emit('agent:color_updated', { username, color: agent_color });
    if (role) io.emit('agent:profile_updated', { username, role });
}
res.json({ success: true });
});
} catch (e) {
console.error("System error during update:", e);
res.status(500).json({ error: "Systemfel vid uppdatering" });
}
});


// 4. POST: Uppdatera roll (Gör till Admin / Ta bort Admin)
router.post('/api/admin/update-role', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
const { userId, newRole } = req.body;
if (userId === req.user.id) return res.status(400).json({ error: "Du kan inte ändra din egen roll" });

db.run("UPDATE users SET role = ? WHERE id = ?", [newRole, userId], (err) => {
if (err) return res.status(500).json({ error: "Kunde inte uppdatera roll" });
// Live-uppdatering: slå upp username och meddela agentens klient
db.get("SELECT username FROM users WHERE id = ?", [userId], (e2, row) => {
    if (!e2 && row && typeof io !== 'undefined') {
        io.emit('agent:profile_updated', { username: row.username, role: newRole });
    }
});
res.json({ success: true });
});
});

// 5. POST: Reset lösenord (Administrativt)
router.post('/api/admin/reset-password', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
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
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
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
// Alla autentiserade agenter kan läsa — bara skrivoperationer kräver admin/support
router.get('/api/admin/user-stats/:username', authenticateToken, async (req, res) => {
const { username } = req.params;

try {
// 1. Hämta agentens routing_tags för att inkludera kontorets ärenden i active_count
const userRow = await new Promise((resolve, reject) => {
db.get("SELECT routing_tag FROM users WHERE username = ?", [username],
(err, row) => err ? reject(err) : resolve(row));
});
const tags = userRow?.routing_tag
? userRow.routing_tag.split(',').map(t => t.trim()).filter(t => t)
: [];

// 2. Bygg active_count dynamiskt — owned + ej-claimade via routing_tag
let activeExpr, activeParams;
if (tags.length > 0) {
const ph = tags.map(() => '?').join(',');
activeExpr = `(SELECT COUNT(DISTINCT conversation_id) FROM chat_v2_state WHERE human_mode = 1 AND (is_archived IS NULL OR is_archived = 0) AND session_type != 'internal' AND (owner = ? OR office IN (${ph}))) as active_count`;
activeParams = [username, ...tags];
} else {
activeExpr = `(SELECT COUNT(*) FROM chat_v2_state WHERE owner = ? AND human_mode = 1 AND (is_archived IS NULL OR is_archived = 0)) as active_count`;
activeParams = [username];
}

const statsQuery = `
SELECT
-- Pågående: ägda + kontorets ej-tilldelade ärenden
${activeExpr},
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

const params = [...activeParams, username, username, username];

db.get(statsQuery, params, (err, row) => {
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
} catch (err) {
console.error("❌ Stats Error:", err);
res.status(500).json({ error: "Kunde inte hämta statistik" });
}
});

// NY: Hämta alla ärenden för en specifik agent (för bläddraren)
// Inkluderar BÅDE direkt tilldelade (owner=username) OCH
// kontor agenten bevakar (office IN routing_tags). Exkl. interna.
// Alla autentiserade agenter kan läsa — bara skrivoperationer kräver admin/support
router.get('/api/admin/agent-tickets/:username', authenticateToken, async (req, res) => {
try {
const { username } = req.params;

// 1. Hämta agentens routing_tags från DB (alltid färsk — aldrig från JWT-cache)
const userRow = await new Promise((resolve, reject) => {
db.get("SELECT routing_tag FROM users WHERE username = ?", [username],
(err, row) => err ? reject(err) : resolve(row));
});

const tags = userRow?.routing_tag
? userRow.routing_tag.split(',').map(t => t.trim()).filter(t => t)
: [];

let sql, params;

if (tags.length > 0) {
const placeholders = tags.map(() => '?').join(',');
sql = `
SELECT DISTINCT
s.conversation_id,
s.session_type,
s.human_mode,
s.owner,
s.sender,
s.updated_at,
s.is_archived,
s.office AS routing_tag,
o.office_color,
s.name,
s.email,
s.phone,
CASE WHEN s.owner = ? THEN 1 ELSE 0 END as is_assigned
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND s.session_type != 'internal'
AND (s.owner = ? OR s.office IN (${placeholders}))
ORDER BY s.updated_at DESC
`;
params = [username, username, ...tags];
} else {
sql = `
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
s.name,
s.email,
s.phone,
1 as is_assigned
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND s.session_type != 'internal'
AND s.owner = ?
ORDER BY s.updated_at DESC
`;
params = [username];
}

db.all(sql, params, async (err, rows) => {
if (err) return res.status(500).json({ error: err.message });
const ticketsWithData = await Promise.all(rows.map(async (t) => {
const stored = await getContextRow(t.conversation_id);
const ctx = stored?.context_data || {};
const locked = ctx.locked_context || {};
return {
...t,
office_color: t.office_color,
subject: ctx.locked_context?.subject || locked?.subject || "Inget ämne",
preview: locked?.subject || ctx.messages?.find(m => m.role === 'user')?.content || ctx.messages?.find(m => m.role === 'user')?.text || null,
contact_name: locked?.name || locked?.contact_name || locked?.full_name || t.name || null,
contact_email: locked?.email || locked?.contact_email || t.email || null,
contact_phone: locked?.phone || locked?.contact_phone || t.phone || null,
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
if (req.user.role !== 'admin') {
return res.status(403).json({ error: "Access denied" });
}
const { routing_tag, color } = req.body;
if (!routing_tag || !color) return res.status(400).json({ error: "routing_tag och color krävs" });
if (!isValidRoutingTag(routing_tag)) {
  return res.status(400).json({ error: 'Ogiltigt routing_tag-format' });
}

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
// Agenter får bara ändra sin egen färg — admins får ändra vems som helst
const { username, color } = req.body;
if (req.user.role !== 'admin' && req.user.username !== username) {
return res.status(403).json({ error: 'Du kan bara ändra din egen profilfärg.' });
}
db.run("UPDATE users SET agent_color = ? WHERE username = ?", [color, username], (err) => {
if (err) return res.status(500).json({ error: err.message });
io.emit('agent:color_updated', { username, color });
res.json({ success: true });
});
});

// NY: Hantera agentens kontorsroller (routing_tags) - SYNCHRONIZED WITH RENDERER
router.post('/api/admin/update-agent-offices', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin')
return res.status(403).json({ error: "Access denied" });

// Body: { username, tag, isChecked }
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

// Live-uppdatering: Meddela alla klienter att agentens kontor ändrades
if (typeof io !== 'undefined') {
io.emit('agent:offices_updated', { username, newTags: newRoutingTag });
}

res.json({ success: true, newTags: newRoutingTag });
});
} catch (e) {
console.error("❌ Systemfel i update-agent-offices:", e);
res.status(500).json({ error: "Internt serverfel" });
}
});

// =====================================================================
// ADMIN — VY-BEHÖRIGHETER (RBAC)
// PUT /api/admin/user-views/:username
// Body: { allowed_views: ["inbox","my-tickets"] } eller null för att ta bort begränsning
// =====================================================================
router.put('/api/admin/user-views/:username', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const { username } = req.params;
const { allowed_views } = req.body;

// null = inga begränsningar (visa allt), array = begränsa till listade vyer
const value = Array.isArray(allowed_views) ? JSON.stringify(allowed_views) : null;

db.run("UPDATE users SET allowed_views = ? WHERE username = ?", [value, username], (err) => {
if (err) {
console.error('[VIEWS] Kunde inte spara vy-behörigheter:', err);
return res.status(500).json({ error: err.message });
}
console.log(`✅ [VIEWS] Uppdaterade allowed_views för @${username}: ${value}`);

// Live-uppdatering: slå upp aktuell roll och meddela agentens klient direkt
// (inkludera rollen så klienten kan korrigera cachad admin-roll)
if (typeof io !== 'undefined') {
    db.get("SELECT role FROM users WHERE username = ?", [username], (e2, row) => {
        const role = (!e2 && row) ? row.role : null;
        io.emit('agent:views_updated', { username, allowed_views: value, role });
    });
}

res.json({ success: true, allowed_views: value });
});
});

// Hämta ärenden för ett specifikt kontor (Används i Admin -> Kontor)
// Alla autentiserade agenter kan läsa — bara skrivoperationer kräver admin/support
router.get('/api/admin/office-tickets/:tag', authenticateToken, async (req, res) => {
try {
const { tag } = req.params;
const sql = `
SELECT
s.conversation_id,
s.owner,
s.session_type,
s.sender,
s.updated_at,
s.name,
s.email,
s.phone,
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

const locked = ctx.locked_context || {};
return {
...t,
office_color: t.office_color,
subject: locked.subject || "Inget ämne",
preview: locked.subject || ctx.messages?.find(m => m.role === 'user')?.content || ctx.messages?.find(m => m.role === 'user')?.text || null,
contact_name: locked.name || locked.contact_name || locked.full_name || t.name || null,
contact_email: locked.email || locked.contact_email || t.email || null,
contact_phone: locked.phone || locked.contact_phone || t.phone || null,
messages: ctx.messages || []
};
}));
res.json(ticketsWithData);
});
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Uppdatera roll baserat på användarnamn (anropas från admin-agents.js)
router.post('/api/admin/update-role-by-username', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
const { username, newRole } = req.body;
db.run("UPDATE users SET role = ? WHERE username = ?", [newRole, username], (err) => {
if (err) return res.status(500).json({ error: err.message });
// Live-uppdatering: meddela agentens klient direkt om rollbytet
if (typeof io !== 'undefined') {
    io.emit('agent:profile_updated', { username, role: newRole });
}
res.json({ success: true });
});
});

// =============================================================================
// ADMIN: SKAPA NYTT KONTOR (TOTALSYNKAD MED FLAGSHIP-FILER)
// =============================================================================
router.post('/api/admin/create-office', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin')
return res.status(403).json({ error: "Access denied" });

const { city, area, routing_tag, office_color, brand, services_offered,
prices: customPrices, contact, description, languages,
opening_hours: customOpeningHours, booking_links: customBookingLinks } = req.body;

if (!city || !routing_tag) return res.status(400).json({ error: "City and Routing Tag required" });
if (!isValidRoutingTag(routing_tag)) {
  return res.status(400).json({ error: 'Ogiltigt routing_tag-format' });
}

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
brand?.toLowerCase(),
brand?.toLowerCase().split(' ')[0],
"trafikskola", "körskola", "körkort",
city.toLowerCase(),
(area || "").toLowerCase(),
"kontakt", "priser", "telefon", "mail", "adress",
"öppettider", "språk", "undervisning", "utbildning"
].filter(k => k && k.trim()),
contact: {
phone,
email,
address,
zip: "",
city_zip: city,
coordinates: { lat: 59.3293, lng: 18.0686 }
},
opening_hours: (Array.isArray(customOpeningHours) && customOpeningHours.length)
? customOpeningHours
: [
{ days: "Mån – Tors", hours: "08:30 – 17:00" },
{ days: "Fredag", hours: "08:00 – 14:00" }
],
services_offered: services_offered || ["Bil"],
languages: (Array.isArray(languages) && languages.length) ? languages : ["svenska", "engelska"],
prices: [],
booking_links: {
CAR: customBookingLinks?.CAR || null,
MC:  customBookingLinks?.MC  || null,
AM:  customBookingLinks?.AM  || null
},
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
if (kw.some(k => ['lastbil','c körkort','ce körkort','c1 körkort','buss','tung lastbil'].includes(k))) sSet.add('Lastbil');
if (kw.some(k => ['ykb','yrkeskompetensbevis'].includes(k))) sSet.add('YKB');
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

// 6. Användar-angivna bokningslänkar tar precedens över auto-genererade
if (customBookingLinks?.CAR) templateData.booking_links.CAR = customBookingLinks.CAR;
if (customBookingLinks?.MC)  templateData.booking_links.MC  = customBookingLinks.MC;
if (customBookingLinks?.AM)  templateData.booking_links.AM  = customBookingLinks.AM;

// 7. Skriv till fil
const knowledgePath = isPackaged ? path.join(process.resourcesPath, 'knowledge') : path.join(__dirname, '..', 'knowledge');
fs.writeFileSync(path.join(knowledgePath, `${routing_tag}.json`), JSON.stringify(templateData, null, 2), 'utf8');

// 8. Ladda om RAG-motorn så nya kontoret är sökbart direkt
try { loadKnowledgeBase(); console.log(`🔄 [ADMIN] RAG-motorn omladdad efter skapande av ${routing_tag}`); } catch (ragErr) { console.error('⚠️ RAG-reload misslyckades:', ragErr); }

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
if (!isValidRoutingTag(tag)) {
  return res.status(400).json({ error: 'Ogiltigt routing_tag-format' });
}

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

// 4. Ladda om RAG-motorn så raderat kontor inte längre svarar
try { loadKnowledgeBase(); console.log(`🔄 [ADMIN] RAG-motorn omladdad efter radering av ${tag}`); } catch (ragErr) { console.error('⚠️ RAG-reload misslyckades:', ragErr); }

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
// Backup .env innan skrivning
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

// Om ändringen kräver omstart — trigga pm2 restart automatiskt efter 800ms
if (restartRequired) {
setTimeout(() => {
const { exec } = require('child_process');
exec('pm2 restart atlas', (err) => {
if (err) console.error('[SYSCONFIG] pm2 restart misslyckades:', err.message);
else console.log('[SYSCONFIG] Server omstartad automatiskt via pm2');
});
}, 800);
}
} catch (err) {
console.error('[SYSCONFIG POST]', err);
res.status(500).json({ error: 'Kunde inte spara konfiguration.' });
}
});

// =====================================================================
// ADMIN — KUNSKAPSBANK / BASFAKTA
// =====================================================================

router.get('/api/admin/basfakta-list', authenticateToken, (req, res) => {
// Alla inloggade får läsa listan — bara PUT är admin-only

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
// ADMIN — BASFAKTA (GET)
// =====================================================================
router.get('/api/admin/basfakta/:filename', authenticateToken, (req, res) => {
// Alla inloggade får läsa basfakta — bara PUT är admin-only

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
// ADMIN — BASFAKTA (PUT)
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

// Hot-reload av RAG-motorn
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
// ADMIN — AVAILABLE-SERVICES
// =====================================================================
router.get('/api/admin/available-services', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

try {
// Hämta från assets/data
const templatePath = isPackaged
? path.join(process.resourcesPath, 'Renderer', 'assets', 'data', 'service_templates.json')
: path.join(__dirname, '..', 'Renderer', 'assets', 'data', 'service_templates.json');

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
if (req.user.role !== 'admin') {
return res.status(403).json({ error: 'Ej behörig' });
}
db.run(`DELETE FROM rag_failures`, (err) => {
if (err) return res.status(500).json({ error: err.message });
res.json({ success: true });
});
});

// =============================================================================
// ADMIN: RAG — POÄNGSÄTTNING
// Läser och skriver ForceAddEngine-scores i settings-tabellen.
// =============================================================================

const RAG_SCORE_DEFAULTS = {
rag_score_a1_am:       25000,
rag_score_fix_saknade: 20000,
rag_score_c8_kontakt:  25000,
rag_score_b1_policy:   50000,
rag_score_c7_teori:    55000
};

const RAG_SCORE_KEYS = Object.keys(RAG_SCORE_DEFAULTS);

// GET — Returnerar alla RAG-scores (från settings-tabellen, med default-fallback)
router.get('/api/admin/rag-scores', authenticateToken, (req, res) => {
const placeholders = RAG_SCORE_KEYS.map(() => '?').join(',');
db.all(
`SELECT key, value FROM settings WHERE key IN (${placeholders})`,
RAG_SCORE_KEYS,
(err, rows) => {
if (err) return res.status(500).json({ error: err.message });
const result = { ...RAG_SCORE_DEFAULTS };
(rows || []).forEach(row => {
const parsed = parseInt(row.value, 10);
if (!isNaN(parsed)) result[row.key] = parsed;
});
res.json(result);
}
);
});

// POST — Sparar ett enskilt RAG-score i settings-tabellen
router.post('/api/admin/rag-scores', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const { field, value } = req.body;

if (!field || value === undefined || value === null) {
return res.status(400).json({ error: 'field och value krävs.' });
}
if (!RAG_SCORE_KEYS.includes(field)) {
return res.status(400).json({ error: `Okänt RAG-score-fält: ${field}` });
}

const numVal = parseInt(value, 10);
if (isNaN(numVal) || numVal < 0) {
return res.status(400).json({ error: 'value måste vara ett heltal >= 0.' });
}

db.run(
`INSERT INTO settings (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
[field, String(numVal)],
function(err) {
if (err) {
console.error('[RAG-SCORES] Kunde inte spara:', err.message);
return res.status(500).json({ error: 'Kunde inte spara RAG-score.' });
}
console.log(`⚡ [RAG-SCORES] ${field} = ${numVal}`);
res.json({ success: true, field, value: numVal, restartRequired: true });
}
);
});

// =============================================================================
// ADMIN: BOKNINGSLÄNKAR
// Läser och skriver utils/booking-links.json.
// legacy_engine.js läser samma fil vid uppstart via loadBookingLinks().
// Kräver omstart av servern för att aktiveras i RAG-motorn.
// =============================================================================

const BOOKING_LINKS_PATH = isPackaged
? path.join(process.resourcesPath, 'utils', 'booking-links.json')
: path.join(__dirname, '..', 'utils', 'booking-links.json');

const BOOKING_LINKS_DEFAULTS = {
AM:     { type: 'info', text: 'Boka din AM-kurs via vår hemsida här',                linkText: 'här',     url: 'https://mydrivingacademy.com/two-wheels/ta-am-korkort/' },
MC:     { type: 'info', text: 'För mer MC-information, kolla vår hemsida',            linkText: 'hemsida', url: 'https://mydrivingacademy.com/two-wheels/home/' },
CAR:    { type: 'info', text: 'För mer information om bilkörkort, kolla vår hemsida', linkText: 'hemsida', url: 'https://mydrivingacademy.com/kom-igang/' },
INTRO:  { type: 'book', text: 'Boka Handledarkurs/Introduktionskurs här',             linkText: 'här',     url: 'https://mydrivingacademy.com/handledarutbildning/' },
RISK1:  { type: 'book', text: 'Boka Riskettan (Risk 1) här',                          linkText: 'här',     url: 'https://mydrivingacademy.com/riskettan/' },
RISK2:  { type: 'book', text: 'Boka Risktvåan/Halkbana (Risk 2) här',                linkText: 'här',     url: 'https://mydrivingacademy.com/halkbana/' },
TEORI:  { type: 'book', text: 'Plugga körkortsteori i appen Mitt Körkort här',        linkText: 'här',     url: 'https://mydrivingacademy.com/app/' },
'B96/BE': { type: 'book', text: 'Boka Släpvagnsutbildning (B96/BE) här',             linkText: 'här',     url: 'https://mydrivingacademy.com/slapvagn/' },
TUNG:   { type: 'book', text: 'Boka utbildning för Tung Trafik (C/CE) här',          linkText: 'här',     url: 'https://mydrivingacademy.com/tungtrafik/' },
POLICY: { type: 'info', text: 'Läs våra köpvillkor och policy här',                   linkText: 'här',     url: 'https://mydrivingacademy.com/privacy-policy/' }
};

// GET — Returnerar alla bokningslänkar (från fil, med default-fallback)
router.get('/api/admin/booking-links', authenticateToken, (req, res) => {
try {
if (fs.existsSync(BOOKING_LINKS_PATH)) {
const data = JSON.parse(fs.readFileSync(BOOKING_LINKS_PATH, 'utf8'));
// Slå ihop med defaults så att nya nycklar alltid finns
res.json({ ...BOOKING_LINKS_DEFAULTS, ...data });
} else {
res.json(BOOKING_LINKS_DEFAULTS);
}
} catch (err) {
console.error('[BOOKING-LINKS GET]', err.message);
res.status(500).json({ error: 'Kunde inte läsa booking-links.json.' });
}
});

// POST — Uppdaterar en enskild nyckel (t.ex. { key: 'CAR', url: 'https://...' })
router.post('/api/admin/booking-links', authenticateToken, (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

const { key, url } = req.body;

if (!key || !url || typeof url !== 'string' || !url.startsWith('http')) {
return res.status(400).json({ error: 'key och en giltig url (http/https) krävs.' });
}

const validKeys = Object.keys(BOOKING_LINKS_DEFAULTS);
if (!validKeys.includes(key)) {
return res.status(400).json({ error: `Okänd nyckel: ${key}. Giltiga: ${validKeys.join(', ')}` });
}

try {
// Läs nuvarande fil (eller defaults om den saknas)
let current = { ...BOOKING_LINKS_DEFAULTS };
if (fs.existsSync(BOOKING_LINKS_PATH)) {
try {
current = { ...current, ...JSON.parse(fs.readFileSync(BOOKING_LINKS_PATH, 'utf8')) };
} catch (e) {
console.warn('[BOOKING-LINKS POST] Kunde inte parsa befintlig fil, skriver ny.');
}
}

// Uppdatera URL för nyckeln (bevarar type/text/linkText)
current[key] = { ...current[key], url: url.trim() };

// Säkerställ att mappen finns (packad app)
const dir = path.dirname(BOOKING_LINKS_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(BOOKING_LINKS_PATH, JSON.stringify(current, null, 2), 'utf8');
console.log(`🔗 [BOOKING-LINKS] ${key} → ${url.trim()}`);
res.json({ success: true, key, url: url.trim(), restartRequired: true });

} catch (err) {
console.error('[BOOKING-LINKS POST]', err.message);
res.status(500).json({ error: 'Kunde inte spara booking-links.json.' });
}
});

// =============================================================================
// ENDPOINTS: GET + POST /api/admin/ts-urls
// Läser och skriver utils/transportstyrelsen-urls.json.
// transportstyrelsen-fallback.js läser samma fil vid uppstart.
// Kräver omstart av servern för att träda i kraft.
// =============================================================================

const TS_URLS_PATH = isPackaged
  ? path.join(process.resourcesPath, 'utils', 'transportstyrelsen-urls.json')
  : path.join(__dirname, '..', 'utils', 'transportstyrelsen-urls.json');

const TS_URLS_DEFAULTS = {
  TILLSTAND:       'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/',
  ATERKALLELSE:    'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/forlorat-korkort/aterkallat-korkort/',
  RISK:            'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/',
  HANDLEDARE:      'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/introduktionsutbildning/',
  BE_B96:          'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/',
  YKB:             'https://www.transportstyrelsen.se/sv/vagtrafik/yrkestrafik/ykb/',
  CE:              'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/tung-lastbil/c-tung-lastbil/',
  MC_A:            'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/',
  AM_MOPED:        'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/am-korkort-for-moped-klass-i/',
  B:               'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/',
  HALSA:           'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/medicinska-krav/',
  FORNYA:          'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/fornya-korkortet/',
  INTERNATIONELLT: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/',
  ALDER:           'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/'
};

router.get('/api/admin/ts-urls', authenticateToken, (req, res) => {
  try {
    if (fs.existsSync(TS_URLS_PATH)) {
      const data = JSON.parse(fs.readFileSync(TS_URLS_PATH, 'utf8'));
      res.json({ ...TS_URLS_DEFAULTS, ...data });
    } else {
      res.json(TS_URLS_DEFAULTS);
    }
  } catch (err) {
    console.error('[TS-URLS GET]', err.message);
    res.status(500).json({ error: 'Kunde inte läsa transportstyrelsen-urls.json.' });
  }
});

router.post('/api/admin/ts-urls', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

  const { key, url } = req.body;
  if (!key || !url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({ error: 'key och en giltig url (http/https) krävs.' });
  }
  if (!Object.keys(TS_URLS_DEFAULTS).includes(key)) {
    return res.status(400).json({ error: `Okänd nyckel: ${key}` });
  }

  try {
    let current = { ...TS_URLS_DEFAULTS };
    if (fs.existsSync(TS_URLS_PATH)) {
      try { current = { ...current, ...JSON.parse(fs.readFileSync(TS_URLS_PATH, 'utf8')) }; }
      catch (e) { console.warn('[TS-URLS POST] Kunde inte parsa befintlig fil, skriver ny.'); }
    }
    current[key] = url.trim();
    const dir = path.dirname(TS_URLS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TS_URLS_PATH, JSON.stringify(current, null, 2), 'utf8');
    console.log(`🌐 [TS-URLS] ${key} → ${url.trim()}`);
    res.json({ success: true, key, url: url.trim(), restartRequired: true });
  } catch (err) {
    console.error('[TS-URLS POST]', err.message);
    res.status(500).json({ error: 'Kunde inte spara transportstyrelsen-urls.json.' });
  }
});

// =============================================================================
// ENDPOINT: POST /api/admin/generate-report — AI-genererade rapporter
// Körs SQL-queries mot DB, skickar data till OpenAI, returnerar Markdown.
// =============================================================================
router.post('/api/admin/generate-report', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI ej aktiverat', details: 'OPENAI_API_KEY saknas i miljövariabler (.env).' });
const { type, customQuery } = req.body;
if (!type) return res.status(400).json({ error: 'type saknas' });
if (type === 'custom' && !customQuery?.trim()) {
return res.status(400).json({ error: 'customQuery saknas' });
}

// Hjälpfunktion: kör en SQL-query och returnerar promise med rows
const query = (sql, params = []) => new Promise((resolve, reject) => {
db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

// OpenAI-instans används av både custom (fas 1+2) och övriga typer (fas 2)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

try {
let reportTitle = '';
let dataContext = '';

// --- SYSTEMÖVERSIKT (kombinerar aktivitet + AI-prestanda) ---
if (type === 'overview') {
reportTitle = 'Systemöversikt';
const [totals, byAgent, topOffices, ragStats, ragRecent] = await Promise.all([
query(`
SELECT
  COUNT(*) as totalt,
  SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) as arkiverade,
  SUM(CASE WHEN human_mode=0 THEN 1 ELSE 0 END) as ai_hanterade,
  SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade,
  SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mailärenden,
  SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattärenden
FROM chat_v2_state WHERE session_type != 'internal'`),
query(`
SELECT owner,
  COUNT(*) as totalt,
  SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) as arkiverade,
  SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade,
  SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mailärenden,
  SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattärenden
FROM chat_v2_state
WHERE session_type != 'internal' AND owner IS NOT NULL
GROUP BY owner ORDER BY totalt DESC LIMIT 10`),
query(`
SELECT office as kontor, COUNT(*) as totalt,
  SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattar,
  SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mail,
  SUM(CASE WHEN human_mode=0 THEN 1 ELSE 0 END) as ai_hanterade,
  SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade
FROM chat_v2_state
WHERE session_type != 'internal' AND office IS NOT NULL
GROUP BY office ORDER BY totalt DESC LIMIT 10`),
query(`
SELECT
  COUNT(*) as totalt_failures,
  SUM(CASE WHEN ts_fallback_used=1 THEN 1 ELSE 0 END) as ts_fallback_anvand,
  SUM(CASE WHEN ts_fallback_success=1 THEN 1 ELSE 0 END) as ts_fallback_lyckad
FROM rag_failures`),
query(`SELECT COUNT(*) as failures_senaste_7_dagar FROM rag_failures WHERE created_at > strftime('%s','now') - 604800`)
]);
dataContext = `TOTALT SYSTEM:\n${JSON.stringify(totals[0], null, 2)}\n\nTOPP-10 AGENTER:\n${JSON.stringify(byAgent, null, 2)}\n\nTOPP-10 KONTOR:\n${JSON.stringify(topOffices, null, 2)}\n\nRAG-FAILURES & TS-FALLBACK:\n${JSON.stringify(ragStats[0], null, 2)}\n\nFAILURES SENASTE 7 DAGARNA:\n${JSON.stringify(ragRecent[0], null, 2)}`;

// --- AKTIVITETSRAPPORT ---
} else if (type === 'activity') {
reportTitle = 'Aktivitetsrapport';
const [byAgent, byOffice, totals] = await Promise.all([
query(`
SELECT owner,
COUNT(*) as totalt,
SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) as arkiverade,
SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade,
SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mailärenden,
SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattärenden
FROM chat_v2_state
WHERE session_type != 'internal' AND owner IS NOT NULL
GROUP BY owner ORDER BY totalt DESC`),
query(`
SELECT office as kontor, COUNT(*) as totalt,
SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) as arkiverade
FROM chat_v2_state
WHERE session_type != 'internal' AND office IS NOT NULL
GROUP BY office ORDER BY totalt DESC`),
query(`
SELECT
COUNT(*) as totalt_alla,
SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) as arkiverade,
SUM(CASE WHEN human_mode=0 THEN 1 ELSE 0 END) as ai_hanterade,
SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade,
SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mailärenden,
SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattärenden
FROM chat_v2_state WHERE session_type != 'internal'`)
]);
dataContext = `TOTALSUMMERING:\n${JSON.stringify(totals[0], null, 2)}\n\nPER AGENT:\n${JSON.stringify(byAgent, null, 2)}\n\nPER KONTOR:\n${JSON.stringify(byOffice, null, 2)}`;

// --- AGENTSTATISTIK ---
} else if (type === 'agents') {
reportTitle = 'Agentstatistik';
const [agents, agentTickets] = await Promise.all([
query(`SELECT username, display_name, role, routing_tag FROM users ORDER BY username`),
query(`
SELECT owner,
COUNT(*) as totalt,
SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) as arkiverade,
SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade,
SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mail,
SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chatt,
SUM(CASE WHEN session_type='internal' THEN 1 ELSE 0 END) as interna
FROM chat_v2_state
WHERE owner IS NOT NULL
GROUP BY owner`)
]);
dataContext = `AGENTER I SYSTEMET:\n${JSON.stringify(agents, null, 2)}\n\nÄRENDESTATISTIK PER AGENT:\n${JSON.stringify(agentTickets, null, 2)}`;

// --- KUNSKAPSLUCKOR (RAG-FAILURES) ---
} else if (type === 'rag_gaps') {
reportTitle = 'Kunskapsluckor (RAG-failures)';
const [topGaps, recent, total] = await Promise.all([
query(`
SELECT query, COUNT(*) as förekomster, MAX(created_at) as senast_sedd
FROM rag_failures
GROUP BY query ORDER BY förekomster DESC LIMIT 30`),
query(`SELECT query, created_at FROM rag_failures ORDER BY created_at DESC LIMIT 20`),
query(`SELECT COUNT(*) as totalt FROM rag_failures`)
]);
dataContext = `TOTALT ANTAL FAILURES: ${total[0]?.totalt || 0}\n\nVANLIGASTE FRÅGOR UTAN SVAR (topp 30):\n${JSON.stringify(topGaps, null, 2)}\n\nSENASTE 20 FAILURES:\n${JSON.stringify(recent, null, 2)}`;

// --- KUNDKONTAKTER ---
} else if (type === 'contacts') {
reportTitle = 'Kundkontakter';
const [contacts, stats] = await Promise.all([
query(`
SELECT name, email, phone, office as kontor, session_type,
datetime(updated_at, 'unixepoch') as datum,
close_reason
FROM chat_v2_state
WHERE (email IS NOT NULL OR phone IS NOT NULL)
AND session_type != 'internal'
ORDER BY updated_at DESC LIMIT 200`),
query(`
SELECT
COUNT(*) as totalt,
SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) as med_email,
SUM(CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) as med_telefon
FROM chat_v2_state
WHERE (email IS NOT NULL OR phone IS NOT NULL)
AND session_type != 'internal'`)
]);
dataContext = `SAMMANFATTNING:\n${JSON.stringify(stats[0], null, 2)}\n\nKUNDKONTAKTER (senaste 200):\n${JSON.stringify(contacts, null, 2)}`;

// --- ANPASSAD RAPPORT (AGENTISK: AI planerar SQL → körs → AI skriver rapport) ---
} else if (type === 'custom') {
reportTitle = 'Anpassad rapport';

// Komplett databasschema som AI:n får för att konstruera korrekta SQL-queries
const DB_SCHEMA = `DATABAS-SCHEMA (SQLite):

TABELL chat_v2_state (Ärenden/Tickets):
- conversation_id TEXT PK
- human_mode INTEGER (0=AI hanterade helt, 1=mänsklig agent klev in)
- owner TEXT (agentens username, t.ex. "helen", "nathalie", "patric")
- updated_at INTEGER (UNIX epoch sekunder)
- session_type TEXT (customer=chatt, message=mail, internal=intern)
- is_archived INTEGER (0=aktiv/öppen, 1=arkiverad/stängd)
- vehicle TEXT (körkortstyp: B, MC, LASTBIL, AM, BE, etc.)
- office TEXT (kontors routing_tag, kopplar mot offices.routing_tag)
- sender TEXT (username för avsändare vid interna meddelanden)
- email TEXT (kundens e-post om angiven)
- phone TEXT (kundens telefon om angiven)
- name TEXT (kundens namn om angivet)
- close_reason TEXT (inactivity=avslutad p.g.a. inaktivitet, null=normal)

TABELL users (Agenter/Användare):
- id INTEGER PK
- username TEXT (t.ex. "helen", "nathalie", "patrik", "patric")
- display_name TEXT (visningsnamn, t.ex. "Helen", "Nathalie", "Patrik")
- role TEXT (admin eller agent)
- routing_tag TEXT (kommaseparerade kontor-taggar agenten ansvarar för)
- is_online INTEGER (0=offline, 1=online just nu)
- last_seen INTEGER (UNIX epoch sekunder — senaste inloggning/aktivitet)
- created_at DATETIME

TABELL offices (Kontor):
- id INTEGER PK, name TEXT (visningsnamn), city TEXT, area TEXT
- routing_tag TEXT (unik nyckel, t.ex. "goteborg_ullevi", "malmo_city", "stockholm_sodermalm")
- phone, address, office_color

TABELL rag_failures (AI-misslyckanden/Kunskapsluckor):
- id PK, query TEXT (exakt fråga kunden ställde), session_type TEXT
- ts_fallback_used INTEGER (0|1), ts_fallback_success INTEGER (0|1)
- created_at INTEGER (UNIX epoch sekunder)

TABELL ticket_notes (Anteckningar kopplade till ärenden):
- id PK, conversation_id TEXT, agent_name TEXT, content TEXT, created_at DATETIME

KÄNDA AGENTER (username / display_name):
patrik/Patrik (admin), patric/Patric, nathalie/Nathalie, helen/Helen,
rebecka/Rebecka, ida/Ida, madeleine/Madeleine, ponker/Pontus, ponkeragent/Ponker

SQL-REGLER:
- Konvertera unix-tid: datetime(col, 'unixepoch') eller date(col, 'unixepoch')
- "Förra veckan" = col BETWEEN (strftime('%s','now')-1209600) AND (strftime('%s','now')-604800)
- "Senaste 7 dagarna" = col > strftime('%s','now') - 604800
- "Senaste 30 dagarna" = col > strftime('%s','now') - 2592000
- Sök agent på namn: owner = 'helen' ELLER owner IN (SELECT username FROM users WHERE display_name LIKE '%Helen%')
- Kontor koppling: chat_v2_state.office = offices.routing_tag
- Filtrera bort interna: WHERE session_type != 'internal'`;

// FAS 1: AI planerar vilka SQL-queries som behövs för att besvara frågan
const planCompletion = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{
role: 'system',
content: `Du är en SQLite-expert som planerar databasfrågor för ett ärendesystem på en svensk trafikskola.
Din uppgift: analysera användarens fråga och generera 1-5 SQLite SELECT-queries som EXAKT kan besvara den.

VIKTIGT:
- Returnera ENBART giltig JSON, INGA förklaringar utanför JSON
- Alla SQL-queries MÅSTE vara SELECT-statements (aldrig INSERT/UPDATE/DELETE/DROP/ALTER)
- Lägg alltid LIMIT max 300 på queries som kan returnera många rader
- Om frågan är omöjlig med tillgänglig data (t.ex. frågar om saker som inte finns i schemat), sätt is_answerable=false

Returnera exakt detta JSON-schema:
{
  "is_answerable": true,
  "not_answerable_reason": null,
  "report_title": "Beskrivande rapporttitel på svenska (max 8 ord)",
  "queries": [
    { "label": "Vad denna query hämtar (svenska)", "sql": "SELECT ..." }
  ]
}`
},
{
role: 'user',
content: `Fråga från användaren: "${customQuery}"\n\n${DB_SCHEMA}`
}
],
response_format: { type: 'json_object' },
max_tokens: 1200,
temperature: 0
});

let plan;
try {
plan = JSON.parse(planCompletion.choices[0]?.message?.content || '{}');
} catch (parseErr) {
plan = { is_answerable: false, not_answerable_reason: 'Kunde inte tolka AI-svaret vid planering.' };
}

// Om frågan inte kan besvaras — returnera tidigt med hjälpsam förklaring
if (!plan.is_answerable) {
const notFoundMarkdown = `# Rapporten kan inte genereras\n\n**Orsak:** ${plan.not_answerable_reason || 'Frågan kan inte besvaras med tillgänglig data.'}\n\n## Vad du kan fråga om\n\nSystemet kan besvara frågor som rör:\n\n| Kategori | Exempel |\n|---|---|\n| **Agenter** | "Hur länge sen var Helen inloggad?" / "Hur många ärenden hanterade Nathalie förra veckan?" |\n| **Kontor** | "Vilka 5 kontor hade flest ärenden senaste månaden?" |\n| **AI vs mänsklig** | "Andel ärenden som AI hanterade helt utan agent?" |\n| **Kunder** | "Kunder som lämnat e-post senaste 7 dagarna" |\n| **Fordon/typ** | "Fördelning av B, MC och lastbil senaste månaden" |\n| **Trender** | "Ärenden per dag senaste 30 dagarna" |\n| **Kunskapsluckor** | "Vanligaste frågorna AI inte kunde svara på" |\n\n> **Tips:** Var specifik med tidsperiod (t.ex. "förra veckan", "senaste 30 dagarna") och personnamn för bäst resultat.`;
console.log(`📊 [REPORT] Ej besvarbar fråga: "${customQuery}"`);
return res.json({ markdown: notFoundMarkdown, title: 'Ej tillgänglig', generatedAt: new Date().toISOString() });
}

// Säkerhetsfilter — tillåt endast SELECT-statements
const isSafeSQL = (sql) => {
const s = sql.trim().toUpperCase().replace(/\s+/g, ' ');
if (!s.startsWith('SELECT')) return false;
const forbidden = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'CREATE ', 'TRUNCATE', 'ATTACH ', 'DETACH ', 'PRAGMA'];
return !forbidden.some(f => s.includes(f));
};

if (plan.report_title) reportTitle = plan.report_title;

// FAS 2: Kör SQL-queries mot databasen
const queryResults = [];
for (const q of (plan.queries || []).slice(0, 5)) {
if (!isSafeSQL(q.sql)) {
queryResults.push({ label: q.label, error: 'SQL nekades av säkerhetsfilter (måste vara SELECT)' });
continue;
}
try {
const rows = await query(q.sql);
queryResults.push({ label: q.label, rows: rows.slice(0, 300) });
} catch (sqlErr) {
queryResults.push({ label: q.label, error: `SQL-fel: ${sqlErr.message}` });
}
}

dataContext = queryResults.map(r =>
`### ${r.label}\n${r.error ? `FEL: ${r.error}` : JSON.stringify(r.rows, null, 2)}`
).join('\n\n');

console.log(`📊 [REPORT PLAN] Fråga: "${customQuery}" → ${(plan.queries||[]).length} queries, ${queryResults.filter(r=>!r.error).length} lyckades`);

// --- AI-PRESTANDA ---
} else if (type === 'ai_performance') {
reportTitle = 'AI-prestanda';
const [overview, perOffice, ragStats, ragRecent] = await Promise.all([
query(`
SELECT
  COUNT(*) as totalt,
  SUM(CASE WHEN human_mode=0 THEN 1 ELSE 0 END) as ai_hanterade,
  SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade,
  SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattar,
  SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mail,
  SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) as arkiverade
FROM chat_v2_state WHERE session_type != 'internal'`),
query(`
SELECT office as kontor,
  COUNT(*) as totalt,
  SUM(CASE WHEN human_mode=0 THEN 1 ELSE 0 END) as ai_hanterade,
  SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as manskligt_hanterade
FROM chat_v2_state
WHERE session_type='customer' AND office IS NOT NULL
GROUP BY office ORDER BY totalt DESC LIMIT 15`),
query(`
SELECT
  COUNT(*) as totalt_failures,
  SUM(CASE WHEN ts_fallback_used=1 THEN 1 ELSE 0 END) as ts_fallback_anvand,
  SUM(CASE WHEN ts_fallback_success=1 THEN 1 ELSE 0 END) as ts_fallback_lyckad
FROM rag_failures`),
query(`SELECT COUNT(*) as failures_senaste_7_dagar FROM rag_failures WHERE created_at > strftime('%s','now') - 604800`)
]);
dataContext = `TOTALT SYSTEM:\n${JSON.stringify(overview[0], null, 2)}\n\nAI VS MÄNSKLIG AGENT PER KONTOR:\n${JSON.stringify(perOffice, null, 2)}\n\nRAG-FAILURES & TS-FALLBACK:\n${JSON.stringify(ragStats[0], null, 2)}\n\nSENASTE 7 DAGARNA:\n${JSON.stringify(ragRecent[0], null, 2)}`;

// --- ESKALERINGSMÖNSTER ---
} else if (type === 'escalation') {
reportTitle = 'Eskaleringsmönster';
const [perOffice, perAgent, escalationTrend] = await Promise.all([
query(`
SELECT office as kontor,
  COUNT(*) as totalt_chattar,
  SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as eskalerade_till_agent,
  SUM(CASE WHEN human_mode=0 THEN 1 ELSE 0 END) as hanterade_av_ai,
  ROUND(100.0 * SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) / COUNT(*), 1) as eskaleringsgrad_procent
FROM chat_v2_state
WHERE session_type='customer' AND office IS NOT NULL
GROUP BY office ORDER BY eskaleringsgrad_procent DESC, totalt_chattar DESC LIMIT 15`),
query(`
SELECT owner as agent,
  COUNT(*) as totalt_ärenden,
  SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattar,
  SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mail
FROM chat_v2_state
WHERE session_type != 'internal' AND owner IS NOT NULL
GROUP BY owner ORDER BY totalt_ärenden DESC LIMIT 15`),
query(`
SELECT
  strftime('%Y-%m', updated_at, 'unixepoch') as manad,
  COUNT(*) as chattar,
  SUM(CASE WHEN human_mode=1 THEN 1 ELSE 0 END) as eskalerade
FROM chat_v2_state
WHERE session_type='customer' AND updated_at IS NOT NULL
GROUP BY manad ORDER BY manad DESC LIMIT 6`)
]);
dataContext = `ESKALERINGSGRAD PER KONTOR:\n${JSON.stringify(perOffice, null, 2)}\n\nÄRENDEN PER AGENT:\n${JSON.stringify(perAgent, null, 2)}\n\nMÅNADSTREND (eskaleringar):\n${JSON.stringify(escalationTrend, null, 2)}`;

// --- KUNSKAPSLUCKE-ÅTGÄRDSPLAN ---
} else if (type === 'gap_plan') {
reportTitle = 'Kunskapslucke-åtgärdsplan';
const [topGaps, total, recentGaps] = await Promise.all([
query(`SELECT query, COUNT(*) as förekomster, MAX(created_at) as senast FROM rag_failures GROUP BY query ORDER BY förekomster DESC LIMIT 40`),
query(`SELECT COUNT(*) as totalt, SUM(CASE WHEN ts_fallback_success=1 THEN 1 ELSE 0 END) as ts_raddade FROM rag_failures`),
query(`SELECT query, COUNT(*) as förekomster FROM rag_failures WHERE created_at > strftime('%s','now') - 604800 GROUP BY query ORDER BY förekomster DESC LIMIT 20`)
]);
dataContext = `TOTALT: ${total[0]?.totalt || 0} failures, ${total[0]?.ts_raddade || 0} räddades av TS-fallback.\n\nALLA FAILURES (topp 40 efter frekvens):\n${JSON.stringify(topGaps, null, 2)}\n\nSENASTE 7 DAGARNA:\n${JSON.stringify(recentGaps, null, 2)}`;

// --- KUNDVOLYM & TRENDER ---
} else if (type === 'volume_trends') {
reportTitle = 'Kundvolym & trender';
const [perDay, perOffice, perWeek, summary] = await Promise.all([
query(`
SELECT date(updated_at, 'unixepoch') as dag,
  COUNT(*) as ärenden,
  SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattar,
  SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mail
FROM chat_v2_state
WHERE session_type != 'internal' AND updated_at > strftime('%s','now') - 2592000
GROUP BY dag ORDER BY dag DESC`),
query(`
SELECT office as kontor, COUNT(*) as ärenden,
  SUM(CASE WHEN session_type='customer' THEN 1 ELSE 0 END) as chattar,
  SUM(CASE WHEN session_type='message' THEN 1 ELSE 0 END) as mail
FROM chat_v2_state
WHERE session_type != 'internal' AND office IS NOT NULL
GROUP BY office ORDER BY ärenden DESC LIMIT 15`),
query(`
SELECT strftime('%Y-W%W', updated_at, 'unixepoch') as vecka,
  COUNT(*) as ärenden
FROM chat_v2_state
WHERE session_type != 'internal' AND updated_at > strftime('%s','now') - 7776000
GROUP BY vecka ORDER BY vecka DESC LIMIT 12`),
query(`
SELECT
  COUNT(*) as totalt_alla_tider,
  SUM(CASE WHEN updated_at > strftime('%s','now') - 2592000 THEN 1 ELSE 0 END) as senaste_30_dagar,
  SUM(CASE WHEN updated_at > strftime('%s','now') - 604800 THEN 1 ELSE 0 END) as senaste_7_dagar
FROM chat_v2_state WHERE session_type != 'internal'`)
]);
dataContext = `SUMMERING:\n${JSON.stringify(summary[0], null, 2)}\n\nPER DAG (senaste 30 dagar):\n${JSON.stringify(perDay, null, 2)}\n\nPER VECKA (senaste 12 veckor):\n${JSON.stringify(perWeek, null, 2)}\n\nTOPP-KONTOR (alla tider):\n${JSON.stringify(perOffice, null, 2)}`;

} else {
return res.status(400).json({ error: 'Okänd rapporttyp' });
}

// FAS 2 (för alla typer): OpenAI formaterar data som Markdown-rapport
// gap_plan får specialprompt — ska gruppera luckor och generera KB-sektioner
const systemPrompt = type === 'escalation'
? `Du är en dataanalytiker för Atlas — ett ärendehanteringssystem för en svensk trafikskola.
Generera en välstrukturerad Markdown-rapport på svenska utifrån den data du får.
Format:
- # Rapporttitel med datum
- ## Sektionsrubriker för varje ämnesområde
- Tabeller med | för tabulär data
- **Fetstil** för viktiga siffror och insikter
- Avsluta alltid med ## Sammanfattning och 2-3 konkreta insikter eller rekommendationer
Gissa ALDRIG data som inte finns. Om fältet är null/tomt, skriv "—".
VIKTIGT: Om alla eller nästan alla kontor har identisk eskaleringsgrad (t.ex. 100%), skriv INTE en lång tabell med varje kontor. Ange då den globala siffran i en enda mening. Visa alltid månads-trendtabellen — det är den viktigaste informationen i denna rapport.`
: type === 'gap_plan'
? `Du är expert på RAG-kunskapsbaser för svenska trafikskolor och arbetar med Atlas ärendesystem.
Du ska analysera de vanligaste frågorna som AI-motorn misslyckades besvara och skapa en konkret åtgärdsplan.

Format (Markdown):
- # Kunskapslucke-åtgärdsplan — [datum]
- ## Identifierade teman (gruppera liknande frågor i 4-8 teman, t.ex. "Priser & paket", "Körkortsregler", "Bokning")
  - Lista frågorna under varje tema
  - Ange hur många gånger temat förekommit totalt
- ## Åtgärdsplan — Förslag på nya KB-sektioner
  För varje tema: generera ett konkret JSON-liknande block med title, answer (2-4 meningar), keywords
- ## Prioritering
  Tabell: Tema | Förekomster | Prioritet (Hög/Medium/Låg)
- ## Sammanfattning
  2-3 meningar om de viktigaste luckorna och rekommenderad insats.

Gissa ALDRIG data. Använd **fetstil** för siffror och prioriteringar.`
: `Du är en dataanalytiker för Atlas — ett ärendehanteringssystem för en svensk trafikskola.
Generera en välstrukturerad Markdown-rapport på svenska utifrån den data du får.
Format:
- # Rapporttitel med datum
- ## Sektionsrubriker för varje ämnesområde
- Tabeller med | för tabulär data (agent/kontor-statistik etc.)
- **Fetstil** för viktiga siffror och insikter
- Avsluta alltid med ## Sammanfattning och 2-3 konkreta insikter eller rekommendationer
Gissa ALDRIG data som inte finns. Om fältet är null/tomt, skriv "—".`;

const userPrompt = type === 'custom'
? `Önskad rapport: "${customQuery}"\n\nNedan följer faktiska SQL-resultat hämtade direkt ur databasen. Basera rapporten ENBART på denna data — gissa aldrig:\n\n${dataContext}`
: `Skapa rapport: ${reportTitle}\n\nData:\n${dataContext}`;

const completion = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: systemPrompt },
{ role: 'user', content: userPrompt }
],
max_tokens: type === 'gap_plan' ? 3500 : 2000,
temperature: 0.2
});

const markdown = completion.choices[0]?.message?.content?.trim()
|| `# ${reportTitle}\n\nKunde inte generera rapport.`;

console.log(`📊 [REPORT] Genererade: ${reportTitle} (${markdown.length} tecken)`);
res.json({ markdown, title: reportTitle, generatedAt: new Date().toISOString() });

} catch (err) {
console.error('[REPORT] Fel:', err);
res.status(500).json({ error: 'Kunde inte generera rapport', details: err.message });
}
});

// ENDPOINT: POST /api/admin/analyze-gaps — Kort AI-analys av kunskapsluckor
router.post('/api/admin/analyze-gaps', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI ej aktiverat.' });

const query = (sql, params = []) => new Promise((resolve, reject) =>
db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
);

try {
const [topGaps, total] = await Promise.all([
query(`SELECT query, COUNT(*) as förekomster FROM rag_failures
GROUP BY query ORDER BY förekomster DESC LIMIT 30`),
query(`SELECT COUNT(*) as totalt FROM rag_failures`)
]);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: 'Du är en analytiker för ett ärendehanteringssystem för en svensk trafikskola. Analysera de vanligaste frågorna som AI-motorn misslyckades svara på. Svara i 3–5 meningar på svenska: identifiera de 2–3 vanligaste temana, uppskatta andel av total, och ge konkreta rekommendationer om vad som bör läggas till i kunskapsbanken. Inga rubriker, bara löpande text.' },
{ role: 'user', content: `Totalt ${total[0]?.totalt || 0} misslyckanden.\n\nVanligaste frågor:\n${topGaps.map(g => `${g.förekomster}× ${g.query}`).join('\n')}` }
],
max_tokens: 350,
temperature: 0.2
});

const analysis = completion.choices[0]?.message?.content?.trim() || 'Kunde inte generera analys.';
res.json({ analysis });
} catch (err) {
console.error('[analyze-gaps] Fel:', err);
res.status(500).json({ error: 'Kunde inte generera analys.' });
}
});

// ENDPOINT: POST /api/admin/analyze-gap-single — AI-analys av en specifik kunskapslucka
// Returnerar: { analysis, target_file, section? } som JSON
router.post('/api/admin/analyze-gap-single', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI ej aktiverat.' });

const { query, ts_fallback_used, ts_fallback_success, ts_url } = req.body;
if (!query) return res.status(400).json({ error: 'Fråga saknas.' });

try {
const knowledgePath = path.join(__dirname, '..', 'knowledge');
const files = fs.readdirSync(knowledgePath).filter(f => f.endsWith('.json'));
const basfaktaFiles = files.filter(f => f.startsWith('basfakta_'));
const kontorFiles = files.filter(f => !f.startsWith('basfakta_'));

const fileList = [
'BASFAKTA-filer (generell info, sektionsbaserade):',
...basfaktaFiles.map(f => `  - ${f}`),
'',
'KONTOR-filer (kontorsspecifik info: priser, öppettider, adress etc.):',
...kontorFiles.map(f => `  - ${f}`)
].join('\n');

const tsContext = ts_fallback_success
? 'TS-fallback användes och lyckades (hittade svar på Transportstyrelsen — frågan gäller regler/lagar).'
: ts_fallback_used
? `TS-fallback användes men misslyckades också${ts_url ? ` (URL: ${ts_url})` : ''}.`
: 'Ingen TS-fallback — frågan gäller troligen trafikskolans egna tjänster, priser eller rutiner.';

const systemPrompt = `Du är expert på RAG-kunskapsbaser för svenska trafikskolor. En kundfråga misslyckades — AI-motorn hittade inget tillräckligt bra svar i kunskapsbanken.

Tillgängliga kunskapsfiler:
${fileList}

Filformat:
- basfakta_*.json har ett "sections"-array. Varje sektion: { "title": "...", "answer": "...", "keywords": ["..."] }
- kontor-filer (stad_område.json) har kontorsinfo med priser, öppettider, kontaktuppgifter — ej sektionsbaserade.

Regler:
1. Om frågan gäller generell info (priser, kurser, regler) → välj lämpligaste basfakta-fil och generera en komplett section.
2. Om frågan gäller ett specifikt kontor → ange kontorsfilen men utelämna "section"-nyckeln.
3. Om inget passar → föreslå ett nytt filnamn (t.ex. basfakta_xxx.json) och generera ändå en section.

Svara ENBART som giltig JSON med exakt dessa nycklar:
{
"analysis": "1-2 meningar: varför RAG troligen misslyckades och vad som saknas i KB",
"target_file": "filnamn.json",
"section": { "title": "...", "answer": "Komplett svar på svenska, 2-4 meningar.", "keywords": ["...", "..."] }
}

Utelämna "section" om det gäller en kontorsfil. Inga förklaringar utanför JSON.`;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const completion = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: systemPrompt },
{ role: 'user', content: `Misslyckad kundfråga: "${query}"\n\nKontext: ${tsContext}` }
],
max_tokens: 500,
temperature: 0.2,
response_format: { type: 'json_object' }
});

const raw = completion.choices[0]?.message?.content?.trim() || '{}';
const parsed = JSON.parse(raw);
res.json(parsed);
} catch (err) {
console.error('[analyze-gap-single] Fel:', err);
res.status(500).json({ error: 'Kunde inte generera analys.' });
}
});

// ==========================================
// GET /api/admin/uploaded-files
// Hämtar alla uppladdade filer med kundinfo
// ==========================================
router.get('/api/admin/uploaded-files', authenticateToken, (req, res) => {
  const sql = `
    SELECT
      uf.id, uf.conversation_id, uf.filename, uf.original_name,
      uf.uploaded_at, uf.expires_at, uf.filepath,
      json_extract(cs.context_data, '$.locked_context.contact_name')  AS customer_name,
      json_extract(cs.context_data, '$.locked_context.contact_email') AS customer_email,
      json_extract(cs.context_data, '$.locked_context.subject')       AS subject
    FROM uploaded_files uf
    LEFT JOIN context_store cs ON cs.conversation_id = uf.conversation_id
    WHERE uf.deleted = 0
    ORDER BY uf.expires_at ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ files: rows || [] });
  });
});

// ==========================================
// DELETE /api/admin/uploaded-files/:id
// Raderar en enskild fil (disk + DB)
// ==========================================
router.delete('/api/admin/uploaded-files/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.get('SELECT filepath FROM uploaded_files WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Fil hittades ej' });
    try { fs.unlinkSync(row.filepath); } catch (e) { /* Ignorera om filen redan är borta */ }
    db.run('UPDATE uploaded_files SET deleted = 1 WHERE id = ?', [id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// ==========================================
// DELETE /api/admin/uploaded-files
// Raderar ALLA filer (disk + DB)
// ==========================================
router.delete('/api/admin/uploaded-files', authenticateToken, (req, res) => {
  db.all('SELECT filepath FROM uploaded_files WHERE deleted = 0', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    for (const row of (rows || [])) {
      try { fs.unlinkSync(row.filepath); } catch (e) { /* Ignorera */ }
    }
    db.run('UPDATE uploaded_files SET deleted = 1 WHERE deleted = 0', [], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true, deleted: rows?.length || 0 });
    });
  });
});

module.exports = router;