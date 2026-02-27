// ============================================
// routes/templates.js — Mailmallar
// VAD DEN GÖR: CRUD för mailmallar + cache-hantering
// ANVÄNDS AV: server.js via app.use('/api', templatesRoutes)
//             getTemplatesCached exporteras för övriga delar av server.js
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const { db, getAllTemplates } = require('../db');
const authenticateToken = require('../middleware/auth');

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

// -------------------------------------------------------------------------
// ENDPOINT: // GET /api/templates - Fetch All Templates (For Electron IPC)
// -------------------------------------------------------------------------
router.get('/templates', authenticateToken, async (req, res) => {
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
router.post('/templates/save', authenticateToken, (req, res) => {
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

// POST /api/templates/delete - Alternativ raderingsväg för frontend-kompatibilitet
router.post('/templates/delete', authenticateToken, (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });
const { id } = req.body;
if (!id) return res.status(400).json({ error: "id saknas" });

db.run('DELETE FROM templates WHERE id = ?', [id], function(err) {
if (err) return res.status(500).json({ error: "Kunde inte radera" });
cachedTemplates = null;
res.json({ status: 'success' });
});
});

// -------------------------------------------------------------------------
// ENDPOINT: /api/templates/delete/:id (RADERA MALL VIA WEBB)
// -------------------------------------------------------------------------
router.delete('/templates/delete/:id', authenticateToken, (req, res) => {
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

module.exports = router;
module.exports.getTemplatesCached = getTemplatesCached;
