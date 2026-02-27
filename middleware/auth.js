// ============================================
// middleware/auth.js — JWT-autentisering
// VAD DEN GÖR: Express-middleware som verifierar
//              JWT Bearer-token och intern API-nyckel
// ANVÄNDS AV: server.js, routes/auth.js
// SENAST STÄDAD: 2026-02-27
// ============================================
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// authenticateToken - Verifierar JWT Bearer-token eller intern API-nyckel
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

module.exports = authenticateToken;
