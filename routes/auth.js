// ============================================
// routes/auth.js — Auth & publika endpoints
// VAD DEN GÖR: Hanterar inloggning, lösenordsbyte,
//              profiländring, seed och versionsinfo
// ANVÄNDS AV: server.js via app.use('/api', authRoutes)
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { db, getUserByUsername, createUser, updateUserPassword } = require('../db');
const JWT_SECRET = process.env.JWT_SECRET;
const authenticateToken = require('../middleware/auth');

// Brute-force-skydd för login (max 5 fel / 15 min per IP)
const loginAttempts = new Map(); // ip → { count, firstAttempt }
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 minuter

// JWT-utgångstid — synkas från server.js via setJwtExpiresIn() vid start och vid settings-ändring
let jwtExpiresIn = '24h';
router.setJwtExpiresIn = (val) => { jwtExpiresIn = val; };

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================
router.post('/auth/login', async (req, res) => {
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
router.post('/auth/change-password', authenticateToken, async (req, res) => {
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
// POST /api/auth/update-profile
// -------------------------------------------------------------------------
router.post('/auth/update-profile', authenticateToken, async (req, res) => {
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
router.post('/auth/seed', async (req, res) => {
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

// Serverns version (ingen auth krävs — används av klienten vid uppstart)
router.get('/public/version', (req, res) => {
res.json({ version: '3.14' });
});

module.exports = router;
