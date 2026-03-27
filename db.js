// ============================================
// db.js
// VAD DEN GÖR: SQLite-hantering — tabellinitiering, migrationer och alla query-funktioner.
// ANVÄNDS AV: server.js, routes/team.js, routes/admin.js, routes/archive.js,
//             routes/customer.js, routes/customers.js, routes/auth.js, main.js
// SENAST STÄDAD: 2026-03-17
// ============================================

const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const isPackaged = process.env.IS_PACKAGED === 'true';
const dbPath = isPackaged
  ? require('path').join(process.env.ATLAS_ROOT_PATH, 'atlas.db')
  : require('path').join(__dirname, 'atlas.db');
const db = new sqlite3.Database(dbPath);

// DATABASE CONFIGURATION & OPTIMIZATION
db.configure("busyTimeout", 5000);

db.run("PRAGMA journal_mode = WAL", (err) => {
if (err) {
console.error('❌ FATAL: Could not enable WAL mode:', err);
process.exit(1);
} else {
console.log('✅ SQLite WAL mode enabled');
}
});

// Table Creation Tracker
let tablesCreated = 0;
const REQUIRED_TABLES = 11;

function checkAllTablesCreated() {
tablesCreated++;
if (tablesCreated === REQUIRED_TABLES) {
console.log('✅ All database tables initialized successfully');
syncOfficeAreaFromKnowledge();
}
}

function syncOfficeAreaFromKnowledge() {
const knowledgePath = isPackaged
? path.join(process.env.ATLAS_ROOT_PATH, 'knowledge')
: path.join(__dirname, 'knowledge');
try {
const files = fs.readdirSync(knowledgePath)
.filter(f => f.endsWith('.json') && !f.startsWith('basfakta'));

let updated = 0;
for (const file of files) {
try {
const data = JSON.parse(fs.readFileSync(path.join(knowledgePath, file), 'utf8'));
// Fälten ligger direkt på root, inte i office_info
if (data.type === 'kontor_info' && data.area && data.city) {
// Härledd routing_tag från filnamnet (goteborg_ullevi.json → goteborg_ullevi)
const tag = path.basename(file, '.json');
db.run(
"UPDATE offices SET area = ? WHERE routing_tag = ? AND (area IS NULL OR area = '')",
[data.area, tag]
);
updated++;
}
} catch (_) {}
}
console.log(`✅ Office area synkad: ${updated} kontor uppdaterade från JSON-filer`);
} catch (err) {
console.error('⚠️ Kunde inte synka office area:', err.message);
}
}


// =============================================================================
// TABLE INITIALIZATION
// =============================================================================
db.serialize(() => {

// Legacy Tables (RAG / V1) - READ ONLY
db.run(`CREATE TABLE IF NOT EXISTS templates (
id INTEGER PRIMARY KEY,
title TEXT,
content TEXT,
group_name TEXT,
owner TEXT DEFAULT NULL
)`, (err) => {
if (err) {
console.error('❌ FATAL: Could not create templates table:', err);
process.exit(1);
}
// Migration: lägg till owner-kolumn om den saknas (ignorerar fel om den redan finns)
db.run(`ALTER TABLE templates ADD COLUMN owner TEXT DEFAULT NULL`, () => {});
console.log('✅ Table "templates" ready');
checkAllTablesCreated();
});

// --- Table: settings ---
db.run(`CREATE TABLE IF NOT EXISTS settings (
key TEXT PRIMARY KEY,
value TEXT
)`, (err) => {
if (err) {
console.error('❌ FATAL: Could not create settings table:', err);
process.exit(1);
}
console.log('✅ Table "settings" ready');
db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('upload_ttl_days', '90')`);
checkAllTablesCreated();
});

// --- Table: context_store (RAG Memory) ---
db.run(`CREATE TABLE IF NOT EXISTS context_store (
conversation_id TEXT PRIMARY KEY,
last_message_id INTEGER,
context_data TEXT,
updated_at INTEGER
)`, (err) => {
if (err) {
console.error('❌ FATAL: Could not create context_store table:', err);
process.exit(1);
}
console.log('✅ Table "context_store" ready');
checkAllTablesCreated();
});

// -----------------------------------------------------------------------
// Table: chat_v2_state (Isolerad state — Human Mode, Owner, Session Type)
// -----------------------------------------------------------------------
db.run(`CREATE TABLE IF NOT EXISTS chat_v2_state (
conversation_id TEXT PRIMARY KEY,
human_mode INTEGER DEFAULT 0,
owner TEXT DEFAULT NULL,
updated_at INTEGER
)`, (err) => {
if (err) {
console.error('❌ FATAL: Could not create chat_v2_state table:', err);
process.exit(1);
}
console.log('✅ Table "chat_v2_state" ready');
checkAllTablesCreated();
});

// Table: offices
db.run(`CREATE TABLE IF NOT EXISTS offices (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT UNIQUE,
city TEXT,
area TEXT,
routing_tag TEXT UNIQUE,
office_color TEXT DEFAULT '#0071e3',
phone TEXT DEFAULT '010-333 32 31',
address TEXT DEFAULT 'Adress saknas',
email TEXT DEFAULT 'info@trafikskola.se',
link_am TEXT DEFAULT '',
link_bil TEXT DEFAULT '',
link_mc TEXT DEFAULT '',
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
if (err) console.error('❌ Could not create offices table:', err);
else { console.log('✅ Table "offices" ready'); checkAllTablesCreated(); }
});

// 6. Tabell för anteckningar (ticket_notes)
db.run(`CREATE TABLE IF NOT EXISTS ticket_notes (
id INTEGER PRIMARY KEY AUTOINCREMENT,
conversation_id TEXT,
agent_name TEXT,
content TEXT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
if (err) console.error('❌ Could not create ticket_notes table:', err);
else { 
console.log('✅ Table "ticket_notes" ready');
checkAllTablesCreated();
}
});

// Table: rag_failures (Kunskapsluckor — AI-frågor utan svar)
db.run(`CREATE TABLE IF NOT EXISTS rag_failures (
id INTEGER PRIMARY KEY AUTOINCREMENT,
query TEXT NOT NULL,
session_type TEXT DEFAULT 'unknown',
ts_fallback_used INTEGER DEFAULT 0,
ts_fallback_success INTEGER DEFAULT 0,
ts_url TEXT DEFAULT NULL,
created_at INTEGER DEFAULT (strftime('%s','now'))
)`, (err) => {
if (err) console.error('❌ rag_failures table error:', err);
else console.log('✅ Table "rag_failures" ready');
checkAllTablesCreated();
});

// Table: uploaded_files (TTL-baserad filrensning)
db.run(`CREATE TABLE IF NOT EXISTS uploaded_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  filepath TEXT NOT NULL,
  uploaded_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER,
  deleted INTEGER DEFAULT 0
)`, (err) => {
if (err) console.error('❌ uploaded_files table error:', err);
else console.log('✅ Table "uploaded_files" ready');
checkAllTablesCreated();
});
db.run(`CREATE INDEX IF NOT EXISTS idx_uploads_conv ON uploaded_files(conversation_id)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_uploads_expires ON uploaded_files(expires_at)`);

// Migration: Add session_type Column
db.run(
`ALTER TABLE chat_v2_state ADD COLUMN session_type TEXT DEFAULT 'customer'`,
(err) => {
if (err && !err.message.includes('duplicate column')) {
console.error('❌ Could not add session_type to chat_v2_state:', err);
process.exit(1);
} else if (!err) {
console.log('✅ Column "session_type" added to chat_v2_state');
}
}
);

// Migration: Add is_archived Column to chat_v2_state
db.run(
`ALTER TABLE chat_v2_state ADD COLUMN is_archived INTEGER DEFAULT 0`,
(err) => {
if (err && !err.message.includes('duplicate column')) {
console.error('❌ Could not add is_archived to chat_v2_state:', err);
} else if (!err) {
console.log('✅ Column "is_archived" added to chat_v2_state');
}
}
);

// Migration: Lägg till metadata-kolumner för filter i Garaget
db.run("ALTER TABLE chat_v2_state ADD COLUMN vehicle TEXT DEFAULT NULL", (err) => {
if (!err) console.log('✅ Kolumn "vehicle" tillagd i chat_v2_state');
});

db.run(`ALTER TABLE chat_v2_state ADD COLUMN office TEXT DEFAULT NULL`, (err) => {
if (!err) console.log('✅ Kolumn "office" tillagd i chat_v2_state');
});

db.run(`ALTER TABLE chat_v2_state ADD COLUMN sender TEXT DEFAULT NULL`, (err) => {
if (!err) console.log('✅ Kolumn "sender" tillagd i chat_v2_state');
});

// Migration: close_reason — varför ärendet avslutades
db.run(`ALTER TABLE chat_v2_state ADD COLUMN close_reason TEXT DEFAULT NULL`, (err) => {
if (!err) console.log('✅ Kolumn "close_reason" tillagd i chat_v2_state');
});

// Table: local_qa_history
db.run(`CREATE TABLE IF NOT EXISTS local_qa_history (
id INTEGER PRIMARY KEY,
question TEXT NOT NULL,
answer TEXT NOT NULL,
timestamp INTEGER NOT NULL,
is_archived INTEGER DEFAULT 0  -- 0 = Inkorg, 1 = Arkiv
)`, (err) => {
if (err) console.error('⚠️ Could not create local_qa_history table:', err);
else {
console.log('✅ Table "local_qa_history" ready with archive support');
checkAllTablesCreated(); 
}
});

// -----------------------------------------------------------------------
// Table: customer_notes (Interna anteckningar per kundprofil, email-baserat)
// -----------------------------------------------------------------------
db.run(`CREATE TABLE IF NOT EXISTS customer_notes (
id INTEGER PRIMARY KEY AUTOINCREMENT,
customer_email TEXT NOT NULL,
agent_name TEXT NOT NULL,
content TEXT NOT NULL,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
if (err) console.error('⚠️ Could not create customer_notes table:', err);
else {
console.log('✅ Table "customer_notes" ready');
checkAllTablesCreated();
}
});

// -----------------------------------------------------------------------
// TEAM INBOX INDEX (PRESTANDA, SÄKER)
// -----------------------------------------------------------------------
db.run(`
CREATE INDEX IF NOT EXISTS idx_inbox_queue
ON chat_v2_state (human_mode, owner, updated_at)
`, (err) => {
if (err) {
console.error('⚠️  WARNING: Could not create inbox index:', err);
console.error('   Team inbox queries will be slower but functional');
} else {
console.log('✅ Index "idx_inbox_queue" ready');
}
});

// -----------------------------------------------------------------------
// PRESTANDA-INDEX (Audit V1/V2/V3 — saknade index)
// -----------------------------------------------------------------------
db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_notes_conv
ON ticket_notes (conversation_id)`, (err) => {
if (err) console.error('⚠️ idx_ticket_notes_conv:', err);
else console.log('✅ Index "idx_ticket_notes_conv" ready');
});

db.run(`CREATE INDEX IF NOT EXISTS idx_qa_history_archived
ON local_qa_history (is_archived)`, (err) => {
if (err) console.error('⚠️ idx_qa_history_archived:', err);
else console.log('✅ Index "idx_qa_history_archived" ready');
});

db.run(`CREATE INDEX IF NOT EXISTS idx_rag_failures_created
ON rag_failures (created_at)`, (err) => {
if (err) console.error('⚠️ idx_rag_failures_created:', err);
else console.log('✅ Index "idx_rag_failures_created" ready');
});


// -----------------------------------------------------------------------
// AUTH & TEAM TABLES
// -----------------------------------------------------------------------

// Authentication Table (SaaS Login System - Atlas Identity Schema)
// Vi skapar alla kolumner direkt här för en ren start utan redundanta ALTER-kommandon.
db.run(`CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY,
username TEXT UNIQUE,
password_hash TEXT NOT NULL,
role TEXT DEFAULT 'agent',
routing_tag TEXT,         /* Unikt ID för eskalering, t.ex. 'ullevi' */
office_id INTEGER,        /* Referens-ID för kontor */
display_name TEXT DEFAULT NULL,
agent_color TEXT DEFAULT '#0071e3',
avatar_id INTEGER DEFAULT 1,
status_text TEXT DEFAULT '',
is_online INTEGER DEFAULT 0,
last_seen INTEGER,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
if (err) {
console.error('❌ FATAL: Could not create users table:', err);
process.exit(1);
}
console.log('✅ Table "users" ready (Atlas 3.8 Clean Start)');
checkAllTablesCreated();
});

// Migration: Add Team Management Columns to QA History
// Dessa ligger kvar för att säkra att historik-tabellen har rätt fält för din vision.
const alterColumns = [
"ALTER TABLE local_qa_history ADD COLUMN handled_by INTEGER",
"ALTER TABLE local_qa_history ADD COLUMN handled_at DATETIME",
"ALTER TABLE local_qa_history ADD COLUMN solution_text TEXT",
"ALTER TABLE local_qa_history ADD COLUMN original_question TEXT",
"ALTER TABLE local_qa_history ADD COLUMN is_archived INTEGER DEFAULT 0",
"ALTER TABLE chat_v2_state ADD COLUMN email TEXT",
"ALTER TABLE chat_v2_state ADD COLUMN phone TEXT",
"ALTER TABLE chat_v2_state ADD COLUMN name TEXT",
"ALTER TABLE chat_v2_state ADD COLUMN source TEXT",
  "ALTER TABLE users ADD COLUMN allowed_views TEXT DEFAULT NULL"
];

alterColumns.forEach(sql => {
db.run(sql, err => {
// Vi loggar endast riktiga fel, inte "duplicate column" som uppstår vid omstart.
if (err && !err.message.includes('duplicate column')) {
console.warn('[DB] Column migration warning:', err.message);
}
});
});

// -----------------------------------------------------------------------
// SPAM/BLOCK-LISTA (E-post-filter för inkommande IMAP-mail / Intercom)
// -----------------------------------------------------------------------
db.run(`CREATE TABLE IF NOT EXISTS email_blocklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'email',
  added_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error('⚠️ Could not create email_blocklist table:', err);
  else console.log('✅ Table "email_blocklist" ready');
});
db.run(`CREATE INDEX IF NOT EXISTS idx_blocklist_pattern ON email_blocklist(pattern)`);

}); // <--- Stänger db.serialize() korrekt

// =============================================================================
// QUERY FUNCTIONS - TEMPLATES
// =============================================================================

// getAllTemplates - Fetch All Templates from Database
db.getAllTemplates = () => {
return new Promise((resolve, reject) => {
db.all("SELECT * FROM templates", [], (err, rows) => {
if (err) reject(err);
else resolve(rows);
});
});
};


// getContextRow - Fetch Session Data from context_store
function getContextRow(conversationId) {
return new Promise((resolve, reject) => {

db.get(
`SELECT conversation_id, last_message_id, context_data, updated_at
FROM context_store
WHERE conversation_id = ?`,
[conversationId],
(err, row) => {
if (err) {
reject(err);
} else {
if (row?.context_data) {
try {
row.context_data = JSON.parse(row.context_data);
} catch (e) {
console.error(`[DB] Invalid JSON in context_store[${conversationId}]:`, e);
row.context_data = null;
}
}
resolve(row);
}
}
);
});
}

// upsertContextRow - Create or Update Session Data
function upsertContextRow({ conversation_id, last_message_id, context_data, updated_at }) {
return new Promise((resolve, reject) => {
const contextString = context_data ? JSON.stringify(context_data) : null;

db.run(
`INSERT INTO context_store (conversation_id, last_message_id, context_data, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(conversation_id) DO UPDATE SET
last_message_id = excluded.last_message_id,
context_data    = excluded.context_data,
updated_at      = excluded.updated_at`,
[conversation_id, last_message_id, contextString, updated_at],
(err) => {
if (err) reject(err);
else resolve();
}
);
});
}

// =============================================================================
// QUERY FUNCTIONS - V2 STATE (Human Mode, Owner, Session Type)
// =============================================================================
// getV2State - Fetch Human Mode & Owner Status
function getV2State(conversationId) {
return new Promise((resolve, reject) => {
db.get(
`
SELECT
conversation_id,
human_mode,
owner,
session_type,
is_archived,
updated_at,
name,
email,
phone,
source,
office,
vehicle,
sender
FROM chat_v2_state
WHERE conversation_id = ?
`,
[conversationId],
(err, row) => {
if (err) return reject(err);

// Default state om konversationen inte finns ännu
if (!row) {
resolve({
conversation_id: conversationId,
human_mode: 0,
owner: null,
session_type: 'customer',
updated_at: null
});
} else {
resolve(row);
}
}
);
});
}

// setHumanMode - Activate Human Mode (Irreversible, Atomic)
function setHumanMode(conversationId, sessionType = 'customer', initialOwner = null) {
const now = Math.floor(Date.now() / 1000);

return new Promise((resolve, reject) => {
db.run(
`INSERT INTO chat_v2_state (conversation_id, human_mode, owner, session_type, updated_at)
VALUES (?, 1, ?, ?, ?)
ON CONFLICT(conversation_id) DO UPDATE SET
human_mode   = 1,
owner        = CASE WHEN chat_v2_state.owner IS NULL THEN excluded.owner ELSE chat_v2_state.owner END,
session_type = excluded.session_type,
updated_at   = excluded.updated_at`,
[conversationId, initialOwner, sessionType, now],
(err) => {
if (err) reject(err);
else resolve();
}
);
});
}


/**
* claimTicket - Tar ägarskap för ett ärende (tillåter Take Over).
* Atomic två-stegs process: INSERT OR IGNORE → UPDATE (owner IS NULL-kravet borttaget).
*/
function claimTicket(conversationId, ownerUser) {
const now = Math.floor(Date.now() / 1000);

return new Promise((resolve, reject) => {
// Steg 1: Säkerställ att raden finns (om den inte gör det, skapa den)
db.run(
`INSERT OR IGNORE INTO chat_v2_state (conversation_id, human_mode, owner, updated_at)
VALUES (?, 1, NULL, ?)`,
[conversationId, now],
(err) => {
if (err) {
console.error(`[DB] claimTicket step 1 failed for ${conversationId}:`, err);
return reject(err);
}

// Steg 1.5: Hämta nuvarande ägare för audit-loggning
db.get(
`SELECT owner FROM chat_v2_state WHERE conversation_id = ?`,
[conversationId],
(errAudit, auditRow) => {
const previousOwner = auditRow?.owner || null;

// Steg 2: Tvinga ägarskap (tillåter Take Over)
db.run(
`UPDATE chat_v2_state
SET owner = ?, updated_at = ?
WHERE conversation_id = ?`,
[ownerUser, now, conversationId],
function (err) {
if (err) {
console.error(`[DB] claimTicket step 2 failed for ${conversationId}:`, err);
return reject(err);
}
// Permanent audit-logg vid ägarskifte
if (previousOwner && previousOwner !== ownerUser) {
console.log(`[AUDIT] Ärende överfört: ${conversationId} bytte ägare från "${previousOwner}" till "${ownerUser}"`);
} else if (!previousOwner) {
console.log(`✅ [DB] ${ownerUser} tog ärende ${conversationId} (ingen tidigare ägare)`);
} else {
console.log(`✅ [DB] ${ownerUser} bekräftade ägarskap för ${conversationId}`);
}
resolve(true);
}
); // UPDATE
} // auditRow callback
); // SELECT
}
);
});
}

// updateTicketFlags - Set Metadata (vehicle, topic, office, etc.)
function updateTicketFlags(conversationId, flags) {
// Whitelist — endast kända kolumner tillåts (skyddar mot SQL-injektion)
const ALLOWED_FLAGS = ['vehicle', 'office', 'sender', 'session_type', 'human_mode', 'is_archived', 'name', 'email', 'phone', 'source'];
const fields = [];
const values = [];

for (const [key, value] of Object.entries(flags)) {
if (!ALLOWED_FLAGS.includes(key)) {
console.warn(`⚠️ [DB] updateTicketFlags: Nekad icke-tillåten nyckel "${key}"`);
continue;
}
fields.push(`${key} = ?`);
values.push(value);
}

if (fields.length === 0) {
return Promise.resolve(); // Inget att uppdatera efter filtrering
}

// Vi använder sekunder (10 siffror) för timestamps — matchar övriga DB-fält
const now = Math.floor(Date.now() / 1000);

// Vi pushar nu-tiden först (för updated_at) och conversationId sist (för WHERE-klausulen)
values.push(now, conversationId);

return new Promise((resolve, reject) => {
db.run(
`UPDATE chat_v2_state
SET ${fields.join(', ')},
updated_at = ?
WHERE conversation_id = ?`,
values,
err => {
if (err) reject(err);
else resolve();
}
);
});
}

// getTeamInbox - Fetch All Active Tickets (Excluding Internal Private Messages)
function getTeamInbox() {
return new Promise((resolve, reject) => {
db.all(
`
SELECT
conversation_id,
session_type,
human_mode,
owner,
updated_at
FROM chat_v2_state
WHERE human_mode = 1
AND (is_archived IS NULL OR is_archived = 0)
AND (session_type IS NULL OR session_type != 'internal') -- Dölj interna meddelanden från Inkorgen
ORDER BY updated_at ASC
`,
[],
(err, rows) => {
if (err) reject(err);
else resolve(rows);
}
);
});
}

// saveTemplate - Save or Replace Template
function saveTemplate(template) {
return new Promise((resolve, reject) => {
db.run(
`INSERT OR REPLACE INTO templates (id, title, group_name, content, owner)
VALUES (?, ?, ?, ?, ?)`,
[template.id, template.title, template.group_name || null, template.content, template.owner || null],
(err) => {
if (err) reject(err);
else resolve();
}
);
});
}

function deleteTemplate(templateId) {
return new Promise((resolve, reject) => {
db.run('DELETE FROM templates WHERE id = ?', [templateId], (err) => {
if (err) reject(err);
else resolve();
});
});
}

// saveLocalQA - Save or Replace QA Entry
function saveLocalQA(qaItem) {
return new Promise((resolve, reject) => {
db.run(
`INSERT OR REPLACE INTO local_qa_history (id, question, answer, timestamp, is_archived) 
VALUES (?, ?, ?, ?, ?)`,
[qaItem.id, qaItem.question, qaItem.answer, qaItem.timestamp, qaItem.is_archived || 0],
(err) => {
if (err) reject(err);
else resolve();
}
);
});
}

// getLocalQAHistory - Fetch All QA Entries (Inbox + Archive)
function getLocalQAHistory(limit = 50) {
return new Promise((resolve, reject) => {
db.all(
'SELECT * FROM local_qa_history ORDER BY timestamp DESC LIMIT ?',
[limit],
(err, rows) => {
if (err) reject(err);
else resolve(rows || []);
}
);
});
}

// deleteLocalQA - Permanently Delete QA Entry
function deleteLocalQA(qaId) {
return new Promise((resolve, reject) => {
db.run('DELETE FROM local_qa_history WHERE id = ?', [qaId], (err) => {
if (err) reject(err);
else resolve();
});
});
}

// updateQAArchivedStatus - Move Entry Between Inbox/Archive
function updateQAArchivedStatus(id, status) {
return new Promise((resolve, reject) => {
db.run(
'UPDATE local_qa_history SET is_archived = ? WHERE id = ?',
[status ? 1 : 0, id],
(err) => {
if (err) reject(err);
else resolve();
}
);
});
}

// =============================================================================
// QUERY FUNCTIONS - AUTHENTICATION
// =============================================================================
// getUserByUsername - Uppdaterad för att hämta ALLA fält för Atlas
function getUserByUsername(username) {
return new Promise((resolve, reject) => {
// Vi lägger till de nya kolumnerna i SELECT-frågan
db.get(
"SELECT id, username, password_hash, role, agent_color, avatar_id, status_text, routing_tag, display_name, allowed_views FROM users WHERE username = ?",
[username.toLowerCase()], // Tvingar sökningen till små bokstäver
(err, row) => {
if (err) reject(err);
else resolve(row);
}
);
});
}

// createUser - Uppdaterad för Atlas med färg, tag och avatar
function createUser(username, passwordHash, role = 'agent', routingTag = null, color = '#0071e3', avatarId = 1) {
return new Promise((resolve, reject) => {
db.run(
"INSERT INTO users (username, password_hash, role, routing_tag, agent_color, avatar_id) VALUES (?, ?, ?, ?, ?, ?)", 
[username, passwordHash, role, routingTag, color, avatarId], 
function(err) {
if (err) reject(err); else resolve(this.lastID);
}
);
});
}

// =============================================================================
// HÄMTA AGENTENS ÄRENDEN (PERSONLIGA + KONTOR) - VERIFIERAD VERSION v3.9.2
// =============================================================================
function getAgentTickets(agentName) {
return new Promise(async (resolve, reject) => {
try {
// Färsk DB-uppläsning — aldrig från JWT-cache
const user = await getUserByUsername(agentName);
const officeTags = user && user.routing_tag
? user.routing_tag.split(',').map(t => t.trim()).filter(t => t)
: [];

let sql, params;

if (officeTags.length > 0) {
// Mina ärenden = jag är owner
//             ELLER internt meddelande där jag är avsändare
//             ELLER ärende skickat till ett kontor jag bevakar (ej upplockade av annan)
// DISTINCT förhindrar dubbletter om owner=agentName OCH office matchar
const placeholders = officeTags.map(() => '?').join(',');
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
o.office_color
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND (
s.owner = ?
OR (s.session_type = 'internal' AND s.sender = ?)
OR (
s.session_type != 'internal'
AND s.office IN (${placeholders})
)
)
ORDER BY s.updated_at ASC
`;
params = [agentName, agentName, ...officeTags];
} else {
// Inga kontor kopplade — visa bara egna + interna
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
o.office_color
FROM chat_v2_state s
LEFT JOIN offices o ON s.office = o.routing_tag
WHERE s.human_mode = 1
AND (s.is_archived IS NULL OR s.is_archived = 0)
AND (
s.owner = ?
OR (s.session_type = 'internal' AND s.sender = ?)
)
ORDER BY s.updated_at ASC
`;
params = [agentName, agentName];
}

db.all(sql, params, (err, rows) => {
if (err) {
console.error("❌ getAgentTickets SQL Error:", err);
reject(err);
} else {
resolve(rows);
}
});
} catch (error) {
console.error("❌ getAgentTickets Logic Error:", error);
reject(error);
}
});
}
// =============================================================================
// NY FUNKTION: TOTAL RADERING (STÄDAR ALLA TABELLER)
// =============================================================================
function deleteConversation(conversationId) {
// Atomisk radering — alla tre DELETE lyckas eller ingen (BEGIN/COMMIT/ROLLBACK)
return new Promise((resolve, reject) => {
db.serialize(() => {
db.run('BEGIN TRANSACTION', (beginErr) => {
if (beginErr) return reject(beginErr);

db.run(`DELETE FROM chat_v2_state WHERE conversation_id = ?`, [conversationId], (e1) => {
if (e1) { db.run('ROLLBACK'); return reject(e1); }

db.run(`DELETE FROM context_store WHERE conversation_id = ?`, [conversationId], (e2) => {
if (e2) { db.run('ROLLBACK'); return reject(e2); }

db.run(`DELETE FROM local_qa_history WHERE id = ?`, [conversationId], (e3) => {
if (e3) { db.run('ROLLBACK'); return reject(e3); }

db.run(
  'DELETE FROM uploaded_files WHERE conversation_id = ?',
  [conversationId],
  (e4) => {
    if (e4) {
      console.warn('[Delete] uploaded_files fel:', e4.message);
      // Fortsätt ändå — filen är redan raderad från disk
    }
    db.run('COMMIT', (commitErr) => {
      if (commitErr) { db.run('ROLLBACK'); return reject(commitErr); }
      console.log(`🧹 Raderade ärende ${conversationId} från alla tabeller (atomisk).`);
      resolve(true);
    }); // COMMIT
  }
); // uploaded_files
}); // local_qa_history
}); // context_store
}); // chat_v2_state
}); // BEGIN TRANSACTION
}); // db.serialize
}); // new Promise
}

// =============================================================================
// AUTH: BYT LÖSENORD
// =============================================================================
function updateUserPassword(username, newPasswordHash) {
return new Promise((resolve, reject) => {
db.run(
`UPDATE users SET password_hash = ? WHERE username = ?`,
[newPasswordHash, username],
function(err) {
if (err) reject(err);
else resolve(this.changes);
}
);
});
}

// Query-funktioner
function getTicketNotes(conversationId) {
return new Promise((resolve, reject) => {
db.all("SELECT * FROM ticket_notes WHERE conversation_id = ? ORDER BY created_at ASC", [conversationId], (err, rows) => {
if (err) reject(err); else resolve(rows);
});
});
}

function addTicketNote(conversationId, agentName, content) {
return new Promise((resolve, reject) => {
db.run("INSERT INTO ticket_notes (conversation_id, agent_name, content) VALUES (?, ?, ?)", 
[conversationId, agentName, content], function(err) {
if (err) reject(err); else resolve(this.lastID);
});
});
}

function updateTicketNote(id, content) {
return new Promise((resolve, reject) => {
db.run("UPDATE ticket_notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [content, id], (err) => {
if (err) reject(err); else resolve();
});
});
}

function deleteTicketNote(id) {
return new Promise((resolve, reject) => {
db.run("DELETE FROM ticket_notes WHERE id = ?", [id], (err) => {
if (err) reject(err); else resolve();
});
});
}

function updateUserProfile(userId, data) {
return new Promise((resolve, reject) => {
const { agent_color, avatar_id, status_text, routing_tag } = data;
db.run(
`UPDATE users SET agent_color = ?, avatar_id = ?, status_text = ?, routing_tag = ? WHERE id = ?`,
[agent_color, avatar_id, status_text, routing_tag, userId],
(err) => err ? reject(err) : resolve()
);
});
}

// Hämtar alla kontor för Admin/Kundchatt
function getAllOffices() {
return new Promise((resolve, reject) => {
db.all("SELECT * FROM offices ORDER BY name ASC", [], (err, rows) => {
if (err) reject(err); else resolve(rows);
});
});
}

// Hämtar ett specifikt kontor baserat på dess routing_tag
function getOfficeByTag(tag) {
return new Promise((resolve, reject) => {
db.get("SELECT * FROM offices WHERE routing_tag = ?", [tag], (err, row) => {
if (err) reject(err); else resolve(row);
});
});
}

function getUserWithOffice(username) {
return new Promise((resolve, reject) => {
const sql = `
SELECT 
u.*, 
o.name as office_name, 
o.routing_tag as office_tag, 
o.city as office_city, 
o.area as office_area,
o.office_color
FROM users u 
LEFT JOIN offices o ON u.office_id = o.id 
WHERE u.username = ?`;
db.get(sql, [username], (err, row) => {
if (err) reject(err); else resolve(row);
});
});
}

function getTicketNoteById(id) {
return new Promise((resolve, reject) => {
db.get("SELECT * FROM ticket_notes WHERE id = ?", [id], (err, row) => {
if (err) reject(err);
else resolve(row);
});
});
}


// =============================================================================
// MODULE EXPORTS
// =============================================================================
module.exports = {
db,
getAllTemplates: db.getAllTemplates,
getContextRow,
upsertContextRow,
getV2State,
setHumanMode,
claimTicket,
updateTicketFlags,
getTeamInbox,
getAgentTickets,
saveTemplate,
deleteTemplate,
saveLocalQA,
getLocalQAHistory,
deleteLocalQA,
updateQAArchivedStatus,
getUserByUsername,
createUser,
deleteConversation,
updateUserPassword,
getTicketNotes,
addTicketNote,
updateTicketNote,
deleteTicketNote,
updateUserProfile,
getAllOffices,
getOfficeByTag,
getTicketNoteById,
getUserWithOffice
};