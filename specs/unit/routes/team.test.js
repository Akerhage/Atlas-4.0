const express = require('express');
const fs = require('fs');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/team.ts');
const dbPath = require.resolve('../../../db');
const authMiddlewarePath = require.resolve('../../../middleware/auth');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

function fakeAuth(req, res, next) {
  req.user = {
    id: 1,
    username: req.headers['x-test-user'] || 'admin',
    role: req.headers['x-test-role'] || 'admin',
  };
  req.teamUser = req.headers['x-test-team-user'] || null;
  next();
}

describe('routes/team', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns grouped inbox arrays for admin with enriched contact data', async () => {
    const db = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn((sql, params, callback) => {
        const sqlText = String(sql);
        let rows = [];

        if (sqlText.includes("s.session_type = 'customer'")) {
          rows = [{ conversation_id: 'live-1', office_color: '#1', name: 'Live Name', email: 'live@example.com', phone: '111' }];
        } else if (sqlText.includes("s.session_type = 'message'")) {
          rows = [{ conversation_id: 'mail-1', office_color: '#2', name: 'Mail Name', email: 'mail@example.com', phone: '222' }];
        } else if (sqlText.includes('(s.owner IS NOT NULL OR s.office IS NOT NULL)')) {
          rows = [{ conversation_id: 'claimed-1', office_color: '#3', name: 'Claimed Name', email: 'claimed@example.com', phone: '333' }];
        }

        callback(null, rows);
      }),
    };

    const getContextRow = vi.fn(async (conversationId) => ({
      context_data: {
        messages: [{ role: 'user', content: `Senaste for ${conversationId}` }],
        locked_context: {
          name: `${conversationId} kund`,
          email: `${conversationId}@example.com`,
          phone: '0701234567',
          subject: `Amne ${conversationId}`,
          city: 'Goteborg',
          vehicle: 'BIL',
        },
      },
    }));

    const dbModule = {
      db,
      getUserByUsername: vi.fn(),
      getContextRow,
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/inbox', {
          method: 'GET',
          headers: { 'x-test-role': 'admin', 'x-test-user': 'admin' },
        });

        expect(response.status).toBe(200);
        expect(response.json.live_chats).toHaveLength(1);
        expect(response.json.mail).toHaveLength(1);
        expect(response.json.claimed).toHaveLength(1);
        expect(response.json.live_chats[0]).toMatchObject({
          contact_name: 'live-1 kund',
          contact_email: 'live-1@example.com',
          city: 'Goteborg',
          vehicle: 'BIL',
        });
        expect(response.json.live_chats[0].subject).toContain('live-1');
      });
    } finally {
      restore();
    }
  });

  it('searches active inbox tickets against enriched contact data and messages', async () => {
    const db = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        callback(null, [
          { conversation_id: 'live-1', sender: 'kund1', owner: 'patrik', routing_tag: 'goteborg_ullevi', office_city: 'Goteborg', office_area: 'Ullevi', office_name: 'Goteborg Ullevi' },
          { conversation_id: 'live-2', sender: 'kund2', owner: 'anna', routing_tag: 'malmo_city', office_city: 'Malmo', office_area: 'City', office_name: 'Malmo City' },
        ]);
      }),
    };
    const getContextRow = vi.fn(async (conversationId) => {
      if (conversationId === 'live-1') {
        return {
          context_data: {
            messages: [{ role: 'user', content: 'Jag vill boka riskettan i Goteborg' }],
            locked_context: { name: 'Kund Ett', email: 'ett@example.com', subject: 'Risketta i Goteborg', city: 'Goteborg', vehicle: 'BIL' },
          },
        };
      }
      return {
        context_data: {
          messages: [{ role: 'user', content: 'Hej' }],
          locked_context: { name: 'Kund Tva', email: 'tva@example.com', subject: 'Annat arende', city: 'Malmo', vehicle: 'MC' },
        },
      };
    });
    const dbModule = {
      db,
      getUserByUsername: vi.fn(),
      getContextRow,
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/inbox/search?q=goteborg', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json.tickets).toHaveLength(1);
        expect(response.json.tickets[0]).toMatchObject({
          conversation_id: 'live-1',
          contact_name: 'Kund Ett',
          city: 'Goteborg',
          vehicle: 'BIL',
        });
      });
    } finally {
      restore();
    }
  });

  it('rejects system/admin claims when the target agent does not exist', async () => {
    const io = { emit: vi.fn() };
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(async () => null),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/claim', {
          method: 'POST',
          headers: { 'x-test-user': 'System', 'x-test-role': 'admin' },
          body: { conversationId: 'conv-1', agentName: 'ghost-agent' },
        });

        expect(response.status).toBe(400);
        expect(response.json.error).toContain('ghost-agent');
        expect(dbModule.claimTicket).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('blocks claims on private sessions', async () => {
    const io = { emit: vi.fn() };
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(async () => ({ session_type: 'private', owner: null })),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/claim', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'agent' },
          body: { conversationId: 'private-1' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Kan inte plocka privata sessioner', session_type: 'private' });
        expect(dbModule.claimTicket).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('claims tickets and emits takeover notifications when the owner changes', async () => {
    const io = { emit: vi.fn() };
    const getV2State = vi
      .fn()
      .mockResolvedValueOnce({ session_type: 'customer', owner: 'anna' })
      .mockResolvedValueOnce({ session_type: 'customer', owner: 'patrik' });
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State,
      claimTicket: vi.fn(async () => true),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/claim', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'agent' },
          body: { conversationId: 'conv-claim' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          status: 'success',
          owner: 'patrik',
          previousOwner: 'anna',
          session_type: 'customer',
        });
        expect(dbModule.claimTicket).toHaveBeenCalledWith('conv-claim', 'patrik');
        expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'ticket_claimed', sessionId: 'conv-claim', owner: 'patrik' });
        expect(io.emit).toHaveBeenCalledWith('team:ticket_taken', { conversationId: 'conv-claim', takenBy: 'patrik', previousOwner: 'anna' });
        expect(io.emit).toHaveBeenCalledWith('team:ticket_claimed_self', { conversationId: 'conv-claim', claimedBy: 'patrik', previousOwner: 'anna' });
      });
    } finally {
      restore();
    }
  });

  it('blocks agents from assigning tickets they do not own', async () => {
    const io = { emit: vi.fn() };
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(async () => ({ owner: 'anna' })),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/assign', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'agent' },
          body: { conversationId: 'conv-2', targetAgent: 'lisa' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Du kan bara vidarebefordra dina egna ärenden.' });
        expect(dbModule.claimTicket).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('assigns tickets and notifies both the previous and new owner', async () => {
    const io = { emit: vi.fn() };
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(async () => ({ owner: 'anna' })),
      claimTicket: vi.fn(async () => true),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/assign', {
          method: 'POST',
          headers: { 'x-test-user': 'admin', 'x-test-role': 'admin' },
          body: { conversationId: 'conv-3', targetAgent: 'lisa' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ status: 'success', assignedTo: 'lisa' });
        expect(dbModule.claimTicket).toHaveBeenCalledWith('conv-3', 'lisa');
        expect(io.emit).toHaveBeenCalledWith('team:ticket_taken', { conversationId: 'conv-3', takenBy: 'admin', previousOwner: 'anna' });
        expect(io.emit).toHaveBeenCalledWith('team:ticket_claimed_self', { conversationId: 'conv-3', claimedBy: 'lisa', previousOwner: 'anna' });
      });
    } finally {
      restore();
    }
  });

  it('returns enriched personal tickets for the active team user', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(async () => ({
        context_data: {
          messages: [{ role: 'atlas', content: 'Svar till kund' }],
          locked_context: {
            name: 'Kund Team',
            email: 'kund@example.com',
            phone: '0700000000',
            subject: 'Billektion',
            city: 'Malmo',
            vehicle: 'BIL',
          },
        },
      })),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(async () => [{ conversation_id: 'mine-1', office_color: '#123', is_archived: 0 }]),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/my-tickets', {
          method: 'GET',
          headers: { 'x-test-team-user': 'patrik' },
        });

        expect(response.status).toBe(200);
        expect(response.json.tickets).toHaveLength(1);
        expect(response.json.tickets[0]).toMatchObject({
          conversation_id: 'mine-1',
          last_message: 'Svar till kund',
          contact_name: 'Kund Team',
          contact_email: 'kund@example.com',
          subject: 'Billektion',
          city: 'Malmo',
          vehicle: 'BIL',
          is_archived: false,
        });
      });
    } finally {
      restore();
    }
  });

  it('returns a single ticket with contact details and messages', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(async () => ({
        context_data: {
          messages: [{ role: 'user', content: 'Hej Atlas' }],
          locked_context: { contact_name: 'Kund Detalj', email: 'detalj@example.com', phone: '0701111111', subject: 'MC-fraga', vehicle: 'MC' },
        },
      })),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(async () => ({ conversation_id: 'ticket-1', session_type: 'customer', routing_tag: 'goteborg_ullevi', owner: 'patrik', sender: 'kund', is_archived: 0, updated_at: 1711111111 })),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/team/ticket/ticket-1', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toMatchObject({
          conversation_id: 'ticket-1',
          routing_tag: 'goteborg_ullevi',
          owner: 'patrik',
          subject: 'MC-fraga',
          contact_name: 'Kund Detalj',
          contact_email: 'detalj@example.com',
          contact_phone: '0701111111',
          vehicle: 'MC',
        });
        expect(response.json.messages).toEqual([{ role: 'user', content: 'Hej Atlas' }]);
      });
    } finally {
      restore();
    }
  });

  it('returns known customer emails for mail autocomplete', async () => {
    const dbModule = {
      db: {
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn((sql, params, callback) => callback(null, [{ email: 'a@example.com' }, { email: 'b@example.com' }])),
      },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/team/known-emails', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ emails: ['a@example.com', 'b@example.com'] });
      });
    } finally {
      restore();
    }
  });
  it('rejects API replies without a conversation id or message', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/team/reply', {
          method: 'POST',
          body: { message: 'Hej' },
        });

        expect(response.status).toBe(400);
        expect(response.json).toEqual({ error: 'Missing conversationId or message' });
      });
    } finally {
      restore();
    }
  });

  it('stores API replies in context_store and emits a synced customer reply event', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const io = { emit: vi.fn() };
    const upsertContextRow = vi.fn(async () => {});
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(async () => ({
        last_message_id: 4,
        context_data: {
          messages: [{ role: 'user', content: 'Hej Atlas' }],
          locked_context: { city: 'Goteborg' },
          linksSentByVehicle: { CAR: true },
        },
      })),
      upsertContextRow,
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/team/reply', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik' },
          body: { conversationId: 'conv-reply', message: 'Vi hjalper dig vidare' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ status: 'success', saved_message: 'Vi hjalper dig vidare' });
        expect(upsertContextRow).toHaveBeenCalledWith({
          conversation_id: 'conv-reply',
          last_message_id: 5,
          context_data: {
            messages: [
              { role: 'user', content: 'Hej Atlas' },
              { role: 'agent', content: 'Vi hjalper dig vidare', sender: 'patrik', timestamp: 1710000000000 },
            ],
            locked_context: { city: 'Goteborg' },
            linksSentByVehicle: { CAR: true },
          },
          updated_at: 1710000000,
        });
        expect(io.emit).toHaveBeenCalledWith('team:customer_reply', {
          conversationId: 'conv-reply',
          message: 'Vi hjalper dig vidare',
          sender: 'patrik',
          timestamp: 1710000000000,
        });
      });
    } finally {
      restore();
    }
  });

  it('returns 500 when API reply persistence fails', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(async () => {
        throw new Error('db down');
      }),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/team/reply', {
          method: 'POST',
          body: { conversationId: 'conv-reply', message: 'Hej' },
        });

        expect(response.status).toBe(500);
        expect(response.json).toEqual({ error: 'Database error' });
      });
    } finally {
      restore();
    }
  });

  it('creates internal tickets, stores the first message and emits inbox updates', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const cryptoModule = require('crypto');
    vi.spyOn(cryptoModule, 'randomUUID')
      .mockReturnValueOnce('abcd1234-1111-2222-3333-444455556666')
      .mockReturnValueOnce('efgh5678-1111-2222-3333-444455556666');
    const io = { emit: vi.fn() };
    const upsertContextRow = vi.fn(async () => {});
    const db = {
      run: vi.fn((sql, params, callback) => callback(null)),
      get: vi.fn(),
      all: vi.fn(),
    };
    const dbModule = {
      db,
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow,
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/team/create-internal', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik' },
          body: { recipient: 'anna', subject: 'Eskalering', message: 'Kan du ta den har kunden?' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, conversationId: 'INTERNAL_abcd1234' });
        expect(db.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO chat_v2_state'),
          ['INTERNAL_abcd1234', 'anna', 'patrik', 1710000000],
          expect.any(Function)
        );
        expect(upsertContextRow).toHaveBeenCalledWith({
          conversation_id: 'INTERNAL_abcd1234',
          last_message_id: 1,
          context_data: {
            messages: [{
              id: 'efgh5678-1111-2222-3333-444455556666',
              sender: 'patrik',
              role: 'agent',
              text: 'Kan du ta den har kunden?',
              timestamp: 1710000000000,
            }],
            locked_context: {
              subject: 'Eskalering',
              name: 'patrik',
              email: 'Internt',
            },
          },
          updated_at: 1710000000,
        });
        expect(io.emit).toHaveBeenCalledWith('team:new_ticket', { conversationId: 'INTERNAL_abcd1234', owner: 'anna' });
        expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'new_message', sessionId: 'INTERNAL_abcd1234' });
      });
    } finally {
      restore();
    }
  });

  it('returns 500 when internal ticket creation fails', async () => {
    const db = {
      run: vi.fn((sql, params, callback) => callback(new Error('insert failed'))),
      get: vi.fn(),
      all: vi.fn(),
    };
    const dbModule = {
      db,
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
      upsertContextRow: vi.fn(),
      getV2State: vi.fn(),
      claimTicket: vi.fn(),
      getAgentTickets: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({ io: { emit: vi.fn() } });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/team/create-internal', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik' },
          body: { recipient: 'anna', message: 'Hej' },
        });

        expect(response.status).toBe(500);
        expect(response.json).toEqual({ error: 'Kunde inte skapa internt meddelande' });
      });
    } finally {
      restore();
    }
  });
});

