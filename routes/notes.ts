// ============================================
// routes/notes.js - Interna ärendeanteckningar
// VAD DEN GÖR: CRUD för agentanteckningar
//              kopplade till ett ärende
// ANVÄNDS AV: server.js via app.use('/api', notesRoutes)
// ============================================

const express = require('express');
const { getTicketNotes, addTicketNote, updateTicketNote, deleteTicketNote, getTicketNoteById } = require('../db');
const authenticateToken = require('../middleware/auth');

type AuthenticatedUser = {
  username: string;
  role: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: Record<string, unknown> | unknown[]) => unknown;
};

type RequestLike<TParams = Record<string, string>, TBody = Record<string, unknown>> = {
  params: TParams;
  body: TBody;
};

type AuthenticatedRequest<TBody = Record<string, unknown>, TParams = Record<string, string>> = RequestLike<TParams, TBody> & {
  user: AuthenticatedUser;
};

type NoteRecord = {
  agent_name: string;
};

type CreateNoteBody = {
  conversationId: string;
  content: string;
};

type UpdateNoteBody = {
  content: string;
};

const router = express.Router();

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

router.get('/notes/:conversationId', authenticateToken, async (req: RequestLike<{ conversationId: string }>, res: ResponseLike) => {
  try {
    const notes = await getTicketNotes(req.params.conversationId);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

router.post('/notes', authenticateToken, async (req: AuthenticatedRequest<CreateNoteBody>, res: ResponseLike) => {
  const { conversationId, content } = req.body;
  const agentName = req.user.username;

  try {
    await addTicketNote(conversationId, agentName, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
});

router.put('/notes/:id', authenticateToken, async (req: AuthenticatedRequest<UpdateNoteBody, { id: string }>, res: ResponseLike) => {
  try {
    const note = await getTicketNoteById(req.params.id) as NoteRecord | null;
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (note.agent_name !== req.user.username && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await updateTicketNote(req.params.id, req.body.content);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
});

router.delete('/notes/:id', authenticateToken, async (req: AuthenticatedRequest<Record<string, never>, { id: string }>, res: ResponseLike) => {
  try {
    const note = await getTicketNoteById(req.params.id) as NoteRecord | null;
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (note.agent_name !== req.user.username && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await deleteTicketNote(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
});

module.exports = router;
