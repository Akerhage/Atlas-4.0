const crypto = require('crypto');
const express = require('express');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/webhook.ts');
const dbPath = require.resolve('../../../db');
const legacyEnginePath = require.resolve('../../../legacy_engine');
const templatesPath = require.resolve('../../../routes/templates');

function createWebhookApp(router) {
  const app = express();
  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use('/', router);
  return app;
}

function signBody(secret, body) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

describe('routes/webhook', () => {
  beforeEach(() => {
    process.env.LHC_WEBHOOK_SECRET = 'atlas-secret';
  });

  afterEach(() => {
    delete process.env.LHC_WEBHOOK_SECRET;
    vi.restoreAllMocks();
  });

  it('rejects webhook requests with an invalid HMAC signature', async () => {
    const db = { run: vi.fn() };
    const dbModule = {
      db,
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
      getV2State: vi.fn(async () => ({ human_mode: 0 })),
      setHumanMode: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
    });
    router.init({
      io: { emit: vi.fn() },
      sendToLHC: vi.fn(),
      parseContextData: (value) => value || { messages: [] },
      HUMAN_TRIGGERS: ['människa'],
      HUMAN_RESPONSE_TEXT: 'Jag kopplar dig vidare.',
    });

    try {
      await withTestServer(createWebhookApp(router), async ({ request }) => {
        const response = await request('/webhook/lhc-chat', {
          method: 'POST',
          headers: { 'x-signature': 'bad-signature' },
          body: { chat_id: 'chat-1', id: 1, msg: 'Hej', type: 'chat' },
        });

        expect(response.status).toBe(403);
        expect(response.text).toBe('Forbidden');
      });
    } finally {
      restore();
    }
  });

  it('returns 400 for unknown ingest types even with a valid signature', async () => {
    const db = { run: vi.fn() };
    const dbModule = {
      db,
      getContextRow: vi.fn(async () => null),
      upsertContextRow: vi.fn(async () => {}),
      getV2State: vi.fn(async () => ({ human_mode: 0 })),
      setHumanMode: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
    });
    router.init({
      io: { emit: vi.fn() },
      sendToLHC: vi.fn(),
      parseContextData: (value) => value || { messages: [] },
      HUMAN_TRIGGERS: ['människa'],
      HUMAN_RESPONSE_TEXT: 'Jag kopplar dig vidare.',
    });

    const body = { chat_id: 'chat-1', id: 1, msg: 'Hej', type: 'fax' };

    try {
      await withTestServer(createWebhookApp(router), async ({ request }) => {
        const response = await request('/webhook/lhc-chat', {
          method: 'POST',
          headers: { 'x-signature': signBody('atlas-secret', body) },
          body,
        });

        expect(response.status).toBe(400);
        expect(response.json).toEqual({
          error: 'Invalid or missing ingest type',
          received: 'fax',
        });
      });
    } finally {
      restore();
    }
  });

  it('ignores duplicate webhook message ids without running the RAG flow', async () => {
    const runLegacyFlow = vi.fn();
    const db = { run: vi.fn() };
    const dbModule = {
      db,
      getContextRow: vi.fn(async () => ({ last_message_id: 7 })),
      upsertContextRow: vi.fn(async () => {}),
      getV2State: vi.fn(async () => ({ human_mode: 0 })),
      setHumanMode: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
    });
    router.init({
      io: { emit: vi.fn() },
      sendToLHC: vi.fn(),
      parseContextData: (value) => value || { messages: [] },
      HUMAN_TRIGGERS: ['människa'],
      HUMAN_RESPONSE_TEXT: 'Jag kopplar dig vidare.',
    });

    const body = { chat_id: 'chat-1', id: 7, msg: 'Hej igen', type: 'chat' };

    try {
      await withTestServer(createWebhookApp(router), async ({ request }) => {
        const response = await request('/webhook/lhc-chat', {
          method: 'POST',
          headers: { 'x-signature': signBody('atlas-secret', body) },
          body,
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({});
        expect(runLegacyFlow).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('activates human mode when a trigger phrase is detected', async () => {
    const io = { emit: vi.fn() };
    const sendToLHC = vi.fn(async () => {});
    const upsertContextRow = vi.fn(async () => {});
    const setHumanMode = vi.fn(async () => {});

    const db = { run: vi.fn() };
    const dbModule = {
      db,
      getContextRow: vi.fn(async () => ({ context_data: { messages: [] }, last_message_id: 3 })),
      upsertContextRow,
      getV2State: vi.fn(async () => ({ human_mode: 0 })),
      setHumanMode,
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow: vi.fn() },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
    });
    router.init({
      io,
      sendToLHC,
      parseContextData: (value) => value || { messages: [] },
      HUMAN_TRIGGERS: ['människa'],
      HUMAN_RESPONSE_TEXT: 'Jag kopplar dig vidare.',
    });

    const body = { chat_id: 'chat-2', id: 9, msg: 'Jag vill prata med en människa', type: 'chat' };

    try {
      await withTestServer(createWebhookApp(router), async ({ request }) => {
        const response = await request('/webhook/lhc-chat', {
          method: 'POST',
          headers: { 'x-signature': signBody('atlas-secret', body) },
          body,
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({});
        expect(upsertContextRow).toHaveBeenCalledWith(expect.objectContaining({
          conversation_id: 'chat-2',
          last_message_id: 9,
        }));
        expect(setHumanMode).toHaveBeenCalledWith('chat-2', 'customer');
        expect(sendToLHC).toHaveBeenCalledWith('chat-2', 'Jag kopplar dig vidare.');
        expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'human_mode_triggered', sessionId: 'chat-2' });
      });
    } finally {
      restore();
    }
  });
  it('reactivates archived mail tickets before running the RAG flow', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const io = { emit: vi.fn() };
    const sendToLHC = vi.fn(async () => {});
    const upsertContextRow = vi.fn(async () => {});
    const runLegacyFlow = vi.fn(async () => ({
      response_payload: 'Atlas svar',
      new_context: {
        locked_context: { city: 'Goteborg', area: null, vehicle: 'BIL' },
        linksSentByVehicle: { CAR: true },
      },
    }));
    const db = {
      run: vi.fn((sql, params, callback) => callback(null)),
    };
    const dbModule = {
      db,
      getContextRow: vi.fn(async () => ({
        last_message_id: 1,
        updated_at: 1709999990,
        context_data: {
          messages: [{ role: 'user', content: 'Tidigare mail' }],
          locked_context: { city: 'Malmo', area: null, vehicle: 'MC' },
          linksSentByVehicle: { MC: true },
        },
      })),
      upsertContextRow,
      getV2State: vi
        .fn()
        .mockResolvedValueOnce({ is_archived: 1, human_mode: 0 })
        .mockResolvedValueOnce({ human_mode: 0 }),
      setHumanMode: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => [{ id: 'tpl-1' }]) },
    });
    router.init({
      io,
      sendToLHC,
      parseContextData: (value) => value || { messages: [] },
      HUMAN_TRIGGERS: ['människa'],
      HUMAN_RESPONSE_TEXT: 'Jag kopplar dig vidare.',
    });

    const body = { chat_id: 'mail-1', id: 5, msg: 'Har ni oppet i morgon?', type: 'mail' };

    try {
      await withTestServer(createWebhookApp(router), async ({ request }) => {
        const response = await request('/webhook/lhc-chat', {
          method: 'POST',
          headers: { 'x-signature': signBody('atlas-secret', body) },
          body,
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({});
        expect(db.run).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining('UPDATE chat_v2_state SET is_archived = 0'),
          [1710000000, 'mail-1'],
          expect.any(Function)
        );
        expect(db.run).toHaveBeenNthCalledWith(
          2,
          'UPDATE local_qa_history SET is_archived = 0 WHERE id = ?',
          ['mail-1'],
          expect.any(Function)
        );
        expect(runLegacyFlow).toHaveBeenCalledWith(
          { query: 'Har ni oppet i morgon?', sessionId: 'mail-1', isFirstMessage: false },
          expect.objectContaining({ locked_context: { city: 'Malmo', area: null, vehicle: 'MC' } }),
          [{ id: 'tpl-1' }]
        );
        expect(upsertContextRow).toHaveBeenCalledWith({
          conversation_id: 'mail-1',
          last_message_id: 5,
          context_data: {
            messages: [
              { role: 'user', content: 'Tidigare mail' },
              { role: 'user', content: 'Har ni oppet i morgon?', timestamp: 1710000000000 },
              { role: 'atlas', content: 'Atlas svar', timestamp: 1710000000000 },
            ],
            locked_context: { city: 'Goteborg', area: null, vehicle: 'BIL' },
            linksSentByVehicle: { CAR: true },
          },
          updated_at: 1710000000,
        });
        expect(sendToLHC).toHaveBeenCalledWith('mail-1', 'Atlas svar');
        expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'new_message', sessionId: 'mail-1' });
      });
    } finally {
      restore();
    }
  });

  it('stays silent when the conversation is already in human mode', async () => {
    const runLegacyFlow = vi.fn();
    const sendToLHC = vi.fn(async () => {});
    const dbModule = {
      db: { run: vi.fn() },
      getContextRow: vi.fn(async () => ({ last_message_id: 0 })),
      upsertContextRow: vi.fn(async () => {}),
      getV2State: vi.fn(async () => ({ human_mode: 1 })),
      setHumanMode: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
    });
    router.init({
      io: { emit: vi.fn() },
      sendToLHC,
      parseContextData: (value) => value || { messages: [] },
      HUMAN_TRIGGERS: ['människa'],
      HUMAN_RESPONSE_TEXT: 'Jag kopplar dig vidare.',
    });

    const body = { chat_id: 'chat-human', id: 2, msg: 'Hej igen', type: 'chat' };

    try {
      await withTestServer(createWebhookApp(router), async ({ request }) => {
        const response = await request('/webhook/lhc-chat', {
          method: 'POST',
          headers: { 'x-signature': signBody('atlas-secret', body) },
          body,
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({});
        expect(runLegacyFlow).not.toHaveBeenCalled();
        expect(sendToLHC).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('returns early when the RAG flow asks to escalate', async () => {
    const sendToLHC = vi.fn(async () => {});
    const upsertContextRow = vi.fn(async () => {});
    const runLegacyFlow = vi.fn(async () => ({ response_payload: 'ESKALERA', new_context: {} }));
    const db = { run: vi.fn((sql, params, callback) => callback(null)) };
    const dbModule = {
      db,
      getContextRow: vi.fn(async () => ({ last_message_id: 0, updated_at: 1710000000, context_data: { messages: [] } })),
      upsertContextRow,
      getV2State: vi.fn(async () => ({ human_mode: 0 })),
      setHumanMode: vi.fn(async () => {}),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { runLegacyFlow },
      [templatesPath]: { getTemplatesCached: vi.fn(async () => []) },
    });
    router.init({
      io: { emit: vi.fn() },
      sendToLHC,
      parseContextData: (value) => value || { messages: [] },
      HUMAN_TRIGGERS: ['människa'],
      HUMAN_RESPONSE_TEXT: 'Jag kopplar dig vidare.',
    });

    const body = { chat_id: 'chat-escalate', id: 3, msg: 'Kan ni ta over?', type: 'chat' };

    try {
      await withTestServer(createWebhookApp(router), async ({ request }) => {
        const response = await request('/webhook/lhc-chat', {
          method: 'POST',
          headers: { 'x-signature': signBody('atlas-secret', body) },
          body,
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({});
        expect(upsertContextRow).not.toHaveBeenCalled();
        expect(sendToLHC).not.toHaveBeenCalled();
        expect(db.run).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });
});

