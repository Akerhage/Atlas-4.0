const express = require('express');
const fs = require('fs');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/archive.ts');
const dbPath = require.resolve('../../../db');
const legacyEnginePath = require.resolve('../../../legacy_engine');
const templatesPath = require.resolve('../../../routes/templates');
const authMiddlewarePath = require.resolve('../../../middleware/auth');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

function fakeAuth(req, res, next) {
  req.user = {
    username: req.headers['x-test-user'] || 'patrik',
    role: req.headers['x-test-role'] || 'admin',
  };
  next();
}

describe('routes/archive', () => {
  beforeEach(() => {
    process.env.CLIENT_API_KEY = 'client-key';
  });

  afterEach(() => {
    delete process.env.CLIENT_API_KEY;
    vi.restoreAllMocks();
  });

  it('rejects /search_all requests with an invalid API key', async () => {
    const dbModule = {
      db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), serialize: vi.fn((fn) => fn()) },
      deleteConversation: vi.fn(),
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({
      io: { emit: vi.fn() },
      parseContextData: (value) => value,
      assertValidContext: vi.fn(),
      mergeContext: vi.fn((prev) => prev),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/search_all', {
          method: 'POST',
          headers: { 'x-api-key': 'wrong' },
          body: { query: 'hej', sessionId: 'conv-1' },
        });

        expect(response.status).toBe(401);
        expect(response.json).toEqual({ error: 'Ogiltig API-nyckel' });
      });
    } finally {
      restore();
    }
  });

  it('persists merged search context on successful /search_all responses', async () => {
    const getContextRow = vi.fn(async () => ({
      last_message_id: 4,
      updated_at: Math.floor(Date.now() / 1000),
      context_data: {
        messages: [{ role: 'user', content: 'hej' }],
        locked_context: { city: 'Malmo', area: null, vehicle: 'BIL' },
        linksSentByVehicle: { AM: false, MC: false, CAR: true, INTRO: false, RISK1: false, RISK2: false },
      },
    }));
    const upsertContextRow = vi.fn(async () => {});
    const runLegacyFlow = vi.fn(async () => ({
      response_payload: {
        answer: 'Atlas svar',
        context: [{ id: 'ctx-1' }],
      },
      new_context: {
        messages: [],
        locked_context: { city: 'Goteborg', area: 'Ullevi', vehicle: 'BIL' },
        linksSentByVehicle: { AM: false, MC: false, CAR: true, INTRO: false, RISK1: false, RISK2: false },
      },
    }));
    const mergeContext = vi.fn((prev, next) => ({
      ...prev,
      locked_context: next.locked_context,
      linksSentByVehicle: next.linksSentByVehicle,
    }));

    const dbModule = {
      db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), serialize: vi.fn((fn) => fn()) },
      deleteConversation: vi.fn(),
      getContextRow,
      upsertContextRow,
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => [{ id: 1 }]) },
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({
      io: { emit: vi.fn() },
      parseContextData: (value) => value,
      assertValidContext: vi.fn(),
      mergeContext,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/search_all', {
          method: 'POST',
          headers: { 'x-api-key': 'client-key' },
          body: { query: 'Vad kostar riskettan?', sessionId: 'conv-2', isFirstMessage: false },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          answer: 'Atlas svar',
          sessionId: 'conv-2',
          locked_context: { city: 'Goteborg', area: 'Ullevi', vehicle: 'BIL' },
          context: [{ id: 'ctx-1' }],
        });
        expect(upsertContextRow).toHaveBeenCalledWith(expect.objectContaining({
          conversation_id: 'conv-2',
          last_message_id: 5,
        }));
      });
    } finally {
      restore();
    }
  });

  it('blocks deleting internal conversations owned by someone else', async () => {
    const dbModule = {
      db: {
        get: vi.fn((sql, params, callback) => {
          callback(null, { session_type: 'internal', owner: 'anna', sender: 'erik' });
        }),
        all: vi.fn((sql, params, callback) => callback(null, [])),
        run: vi.fn(),
        serialize: vi.fn((fn) => fn()),
      },
      deleteConversation: vi.fn(),
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({
      io: { emit: vi.fn() },
      parseContextData: (value) => value,
      assertValidContext: vi.fn(),
      mergeContext: vi.fn((prev) => prev),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/inbox/delete', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'admin' },
          body: { conversationId: 'internal-1' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Du kan inte radera andras interna ärenden.' });
        expect(dbModule.deleteConversation).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('deletes inbox tickets, removes uploaded files and emits live updates', async () => {
    const deleteConversation = vi.fn(async () => {});
    const dbModule = {
      db: {
        get: vi.fn((sql, params, callback) => callback(null, { session_type: 'customer', owner: null, sender: null })),
        all: vi.fn((sql, params, callback) => callback(null, [{ filepath: 'C:/Atlas/uploads/file1.txt' }])),
        run: vi.fn(),
        serialize: vi.fn((fn) => fn()),
      },
      deleteConversation,
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
    };
    const io = { emit: vi.fn() };
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({
      io,
      parseContextData: (value) => value,
      assertValidContext: vi.fn(),
      mergeContext: vi.fn((prev) => prev),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/inbox/delete', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'admin' },
          body: { conversationId: 'conv-delete' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ status: 'success' });
        expect(unlinkSpy).toHaveBeenCalledWith('C:/Atlas/uploads/file1.txt');
        expect(deleteConversation).toHaveBeenCalledWith('conv-delete');
        expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'inbox_cleared', sessionId: 'conv-delete' });
        expect(io.emit).toHaveBeenCalledWith('team:session_status', { conversationId: 'conv-delete', status: 'deleted' });
      });
    } finally {
      existsSpy.mockRestore();
      unlinkSpy.mockRestore();
      restore();
    }
  });

  it('archives inbox tickets and broadcasts the archive event', async () => {
    const dbRun = vi.fn(function(sql, params, callback) {
      const sqlText = String(sql);
      if (sqlText.includes('UPDATE chat_v2_state')) {
        callback.call({ changes: 1 }, null);
        return;
      }
      if (sqlText.includes('UPDATE local_qa_history')) {
        callback.call({ changes: 0 }, null);
        return;
      }
      callback.call({ changes: 0 }, null);
    });
    const dbModule = {
      db: {
        get: vi.fn((sql, params, callback) => callback(null, { session_type: 'customer', owner: null, sender: null })),
        all: vi.fn((sql, params, callback) => callback(null, [])),
        run: dbRun,
        serialize: vi.fn((fn) => fn()),
      },
      deleteConversation: vi.fn(),
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
    };
    const io = { emit: vi.fn() };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({
      io,
      parseContextData: (value) => value,
      assertValidContext: vi.fn(),
      mergeContext: vi.fn((prev) => prev),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/inbox/archive', {
          method: 'POST',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'agent' },
          body: { conversationId: 'conv-archive' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ status: 'success', changes: 1 });
        expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'ticket_archived', sessionId: 'conv-archive' });
        expect(io.emit).toHaveBeenCalledWith('team:session_status', { conversationId: 'conv-archive', status: 'archived', message: 'Handläggaren har avslutat denna konversation.' });
      });
    } finally {
      restore();
    }
  });

  it('returns a formatted archive list with contact data from context_store', async () => {
    const dbModule = {
      db: {
        get: vi.fn(),
        all: vi.fn((sql, params, callback) => callback(null, [{
          conversation_id: 'arch-1',
          updated_at: 1711111111,
          owner: 'patrik',
          session_type: 'customer',
          sender: 'kund',
          human_mode: 1,
          office: 'goteborg_ullevi',
          name: 'Fallback Namn',
          email: 'fallback@example.com',
          phone: '0709999999',
          close_reason: 'agent:patrik',
          office_color: '#0088cc',
          context_data: JSON.stringify({
            locked_context: { name: 'Kund Arkiv', email: 'kund@example.com', phone: '0701231234', city: 'Goteborg', vehicle: 'BIL', subject: 'Arkiverat arende' },
            messages: [{ role: 'user', content: 'Hej, jag vill boka riskettan' }],
          }),
        }])),
        run: vi.fn(),
        serialize: vi.fn((fn) => fn()),
      },
      deleteConversation: vi.fn(),
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({
      io: { emit: vi.fn() },
      parseContextData: (value) => value,
      assertValidContext: vi.fn(),
      mergeContext: vi.fn((prev) => prev),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/archive', {
          method: 'GET',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'agent' },
        });

        expect(response.status).toBe(200);
        expect(response.json.archive).toHaveLength(1);
        expect(response.json.archive[0]).toMatchObject({
          conversation_id: 'arch-1',
          question: 'Hej, jag vill boka riskettan',
          routing_tag: 'goteborg_ullevi',
          contact_name: 'Kund Arkiv',
          contact_email: 'kund@example.com',
          contact_phone: '0701231234',
          city: 'Goteborg',
          vehicle: 'BIL',
          subject: 'Arkiverat arende',
          close_reason: 'agent:patrik',
        });
      });
    } finally {
      restore();
    }
  });

  it('returns pure AI chats from context_store with pagination metadata', async () => {
    const dbModule = {
      db: {
        get: vi.fn(),
        all: vi.fn((sql, params, callback) => callback(null, [{
          conversation_id: 'ai-1',
          updated_at: 1711111111,
          context_data: JSON.stringify({
            locked_context: { name: 'AI Kund', email: 'ai@example.com', phone: '0702222222', city: 'Malmo', vehicle: 'MC', subject: 'AI-only' },
            messages: [{ role: 'user', content: 'Kan ni hjalpa med MC?' }, { role: 'atlas', content: 'Ja' }],
          }),
        }])),
        run: vi.fn(),
        serialize: vi.fn((fn) => fn()),
      },
      deleteConversation: vi.fn(),
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
      [authMiddlewarePath]: fakeAuth,
    });
    router.init({
      io: { emit: vi.fn() },
      parseContextData: (value) => value,
      assertValidContext: vi.fn(),
      mergeContext: vi.fn((prev) => prev),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/archive/ai?offset=0', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          ai_chats: [expect.objectContaining({
            conversation_id: 'ai-1',
            question: 'Kan ni hjalpa med MC?',
            contact_name: 'AI Kund',
            contact_email: 'ai@example.com',
            contact_phone: '0702222222',
            city: 'Malmo',
            vehicle: 'MC',
            subject: 'AI-only',
          })],
          offset: 0,
          hasMore: false,
        });
      });
    } finally {
      restore();
    }
  });
});
