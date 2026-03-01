// ============================================
// routes/customers.js — Kundprofiler
// VAD DEN GÖR: Listar unika kunder grupperade
//              per email (eller namn+telefon),
//              samt hämtar alla ärenden per kund.
// ANVÄNDS AV: server.js via app.use('/api', customerProfileRoutes)
//             + customerProfileRoutes.init({})
// ============================================
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const authenticateToken = require('../middleware/auth');

// Tom init — reserverad för framtida beroenden
router.init = function(opts) {};

// -------------------------------------------------------------------------
// GET /api/customers — Unika kunder grupperade per email/namn+telefon
// -------------------------------------------------------------------------
router.get('/customers', authenticateToken, (req, res) => {
  const sql = `
    SELECT
      LOWER(TRIM(s.email)) as email,
      s.name,
      s.phone,
      COUNT(s.conversation_id) as total_tickets,
      SUM(CASE WHEN s.is_archived = 0 THEN 1 ELSE 0 END) as active_tickets,
      MAX(s.updated_at) as last_contact,
      GROUP_CONCAT(DISTINCT s.office) as offices,
      GROUP_CONCAT(DISTINCT s.vehicle) as vehicles,
      GROUP_CONCAT(DISTINCT s.owner) as agents
    FROM chat_v2_state s
    WHERE s.name IS NOT NULL
      AND s.name != ''
      AND s.session_type != 'internal'
    GROUP BY LOWER(TRIM(COALESCE(s.email, s.name || s.phone)))
    ORDER BY last_contact DESC
    LIMIT 500
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('❌ Customer list error:', err);
      return res.status(500).json({ error: 'Kunde inte hämta kundlistan' });
    }
    res.json({ customers: rows || [] });
  });
});

// -------------------------------------------------------------------------
// GET /api/customers/tickets — Alla ärenden för en specifik kund
// Query-params: email=X  ELLER  name=Y&phone=Z
// Returnerar samma format som /api/archive
// -------------------------------------------------------------------------
router.get('/customers/tickets', authenticateToken, (req, res) => {
  const { email, name, phone } = req.query;

  if (!email && !(name && phone)) {
    return res.status(400).json({ error: 'email eller name+phone krävs som query-parametrar' });
  }

  let sql, params;

  if (email) {
    sql = `
      SELECT
        s.conversation_id,
        s.updated_at,
        s.owner,
        s.session_type,
        s.sender,
        s.human_mode,
        s.office,
        s.is_archived,
        o.office_color,
        c.context_data
      FROM chat_v2_state s
      LEFT JOIN context_store c ON s.conversation_id = c.conversation_id
      LEFT JOIN offices o ON s.office = o.routing_tag
      WHERE LOWER(TRIM(s.email)) = LOWER(TRIM(?))
        AND s.session_type != 'internal'
      ORDER BY s.updated_at DESC
    `;
    params = [email];
  } else {
    sql = `
      SELECT
        s.conversation_id,
        s.updated_at,
        s.owner,
        s.session_type,
        s.sender,
        s.human_mode,
        s.office,
        s.is_archived,
        o.office_color,
        c.context_data
      FROM chat_v2_state s
      LEFT JOIN context_store c ON s.conversation_id = c.conversation_id
      LEFT JOIN offices o ON s.office = o.routing_tag
      WHERE s.name = ?
        AND s.phone = ?
        AND s.session_type != 'internal'
      ORDER BY s.updated_at DESC
    `;
    params = [name, phone];
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('❌ Customer tickets error:', err);
      return res.status(500).json({ error: 'Kunde inte hämta ärenden för kunden' });
    }

    // Samma format som /api/archive
    const cleanRows = rows.map(row => {
      let ctx = {};
      try {
        ctx = (typeof row.context_data === 'string') ? JSON.parse(row.context_data) : (row.context_data || {});
      } catch (e) {
        ctx = {};
      }

      const locked = ctx.locked_context || {};
      const msgs = ctx.messages || [];

      let question = 'Inget meddelande';
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
        is_archived: row.is_archived,
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

    res.json({ tickets: cleanRows });
  });
});

module.exports = router;
