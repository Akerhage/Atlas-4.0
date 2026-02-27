// ============================================
// routes/notes.js — Interna ärendeanteckningar
// VAD DEN GÖR: CRUD för agentanteckningar
//              kopplade till ett ärende
// ANVÄNDS AV: server.js via app.use('/api', notesRoutes)
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const { getTicketNotes, addTicketNote, updateTicketNote, deleteTicketNote, getTicketNoteById } = require('../db');
const authenticateToken = require('../middleware/auth');

// =============================================================================
// INTERNAL NOTES API
// =============================================================================
router.get('/notes/:conversationId', authenticateToken, async (req, res) => {
try {
const notes = await getTicketNotes(req.params.conversationId);
res.json(notes);
} catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notes', authenticateToken, async (req, res) => {
const { conversationId, content } = req.body;
const agentName = req.user.username;
try {
await addTicketNote(conversationId, agentName, content);
res.json({ success: true });
} catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notes/:id', authenticateToken, async (req, res) => {
try {
const note = await getTicketNoteById(req.params.id);
if (!note) return res.status(404).json({ error: 'Note not found' });
if (note.agent_name !== req.user.username && req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });

await updateTicketNote(req.params.id, req.body.content);
res.json({ success: true });
} catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notes/:id', authenticateToken, async (req, res) => {
try {
const note = await getTicketNoteById(req.params.id);
if (!note) return res.status(404).json({ error: 'Note not found' });
if (note.agent_name !== req.user.username && req.user.role !== 'admin' && req.user.role !== 'support') return res.status(403).json({ error: 'Access denied' });

await deleteTicketNote(req.params.id);
res.json({ success: true });
} catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
