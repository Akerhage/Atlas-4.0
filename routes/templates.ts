// ============================================
// routes/templates.js - Mailmallar
// VAD DEN GÖR: CRUD för mailmallar + cache-hantering
// ANVÄNDS AV: server.js via app.use('/api', templatesRoutes)
//             getTemplatesCached exporteras för övriga delar av server.js
// ============================================

const express = require('express');
const { db, getAllTemplates } = require('../db');
const authenticateToken = require('../middleware/auth');

type TemplateRow = Record<string, unknown>;

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: Record<string, unknown> | TemplateRow[]) => unknown;
};

type RequestLike<TParams = Record<string, string>, TBody = Record<string, unknown>> = {
  params: TParams;
  body: TBody;
};

type SaveTemplateBody = {
  id?: number;
  title?: string;
  content?: string;
  group_name?: string;
  owner?: string | null;
};

type DeleteTemplateBody = {
  id?: number | string;
};

const router = express.Router();

let cachedTemplates: TemplateRow[] | null = null;
let templatesLoadedAt = 0;
const TEMPLATE_TTL = 60 * 1000;

async function getTemplatesCached(): Promise<TemplateRow[]> {
  const now = Date.now();
  if (!cachedTemplates || now - templatesLoadedAt > TEMPLATE_TTL) {
    cachedTemplates = await getAllTemplates() as TemplateRow[];
    templatesLoadedAt = now;
  }
  return cachedTemplates;
}

router.get('/templates', authenticateToken, async (_req: RequestLike, res: ResponseLike) => {
  try {
    const templates = await getTemplatesCached();
    res.json(templates);
  } catch (err) {
    console.error('[TEMPLATES] Load error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/templates/save', authenticateToken, (req: RequestLike<Record<string, string>, SaveTemplateBody>, res: ResponseLike) => {
  const { id, title, content, group_name, owner } = req.body;
  const sql = `
INSERT INTO templates (id, title, content, group_name, owner)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
title = excluded.title,
content = excluded.content,
group_name = excluded.group_name,
owner = excluded.owner
`;

  const finalId = id || Date.now();

  db.run(sql, [finalId, title, content, group_name, owner || null], function(this: { changes?: number; lastID?: number }, err: Error | null) {
    if (err) {
      console.error('Template Save Error:', err);
      return res.status(500).json({ error: 'Kunde inte spara mallen' });
    }

    cachedTemplates = null;
    return res.json({ status: 'success' });
  });
});

router.post('/templates/delete', authenticateToken, (req: RequestLike<Record<string, string>, DeleteTemplateBody>, res: ResponseLike) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id saknas' });
  }

  db.run('DELETE FROM templates WHERE id = ?', [id], function(this: { changes?: number }, err: Error | null) {
    if (err) {
      return res.status(500).json({ error: 'Kunde inte radera' });
    }
    cachedTemplates = null;
    return res.json({ status: 'success' });
  });
});

router.delete('/templates/delete/:id', authenticateToken, (req: RequestLike<{ id: string }>, res: ResponseLike) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'id saknas' });
  }

  db.run('DELETE FROM templates WHERE id = ?', [id], function(this: { changes?: number }, err: Error | null) {
    if (err) {
      console.error('[TEMPLATES] Delete error:', err);
      return res.status(500).json({ error: 'Kunde inte radera mallen' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Mall hittades inte' });
    }
    cachedTemplates = null;
    return res.json({ status: 'success' });
  });
});

module.exports = router;
module.exports.getTemplatesCached = getTemplatesCached;
