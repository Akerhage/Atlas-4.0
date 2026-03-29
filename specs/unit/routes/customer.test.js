const express = require('express');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/customer.ts');
const dbPath = require.resolve('../../../db');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

describe('routes/customer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards customer messages to a human agent when human mode is active', async () => {
    const io = { emit: vi.fn() };
    const db = { run: vi.fn((sql, params, callback) => callback(null)) };
    const getContextRow = vi.fn(async () => ({
      last_message_id: 2,
      context_data: { messages: [] },
    }));
    const upsertContextRow = vi.fn(async () => {});
    const getV2State = vi.fn(async () => ({ human_mode: 1 }));
    const handleChatMessage = vi.fn();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: { db, getContextRow, upsertContextRow, getV2State },
    });
    router.init({ io, handleChatMessage });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customer/message', {
          method: 'POST',
          body: { sessionId: 'chat-1', message: 'Hej, kan n�gon hj�lpa mig?' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toMatchObject({
          success: true,
          status: 'forwarded_to_agent',
          human_mode: true,
        });
        expect(upsertContextRow).toHaveBeenCalledWith(expect.objectContaining({
          conversation_id: 'chat-1',
          last_message_id: 3,
        }));
        expect(handleChatMessage).not.toHaveBeenCalled();
        expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'new_message', sessionId: 'chat-1' });
      });
    } finally {
      restore();
    }
  });

  it('creates session state and calls handleChatMessage in normal bot mode', async () => {
    const io = { emit: vi.fn() };
    const db = { run: vi.fn((sql, params, callback) => callback(null)) };
    const getContextRow = vi.fn(async () => null);
    const upsertContextRow = vi.fn(async () => {});
    const getV2State = vi.fn(async () => ({ human_mode: 0 }));
    const handleChatMessage = vi.fn(async () => ({ answer: 'Atlas svar', sessionId: 'chat-2' }));

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: { db, getContextRow, upsertContextRow, getV2State },
    });
    router.init({ io, handleChatMessage });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customer/message', {
          method: 'POST',
          body: { sessionId: 'chat-2', message: 'Vad kostar Risk 1?' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ answer: 'Atlas svar', sessionId: 'chat-2' });
        expect(handleChatMessage).toHaveBeenCalledWith({
          query: 'Vad kostar Risk 1?',
          sessionId: 'chat-2',
          isFirstMessage: true,
          session_type: 'customer',
          providedContext: undefined,
        });
        expect(db.run).toHaveBeenCalledTimes(2);
      });
    } finally {
      restore();
    }
  });

  it('stores message-form tickets with locked contact context', async () => {
    const io = { emit: vi.fn() };
    const db = { run: vi.fn((sql, params, callback) => callback(null)) };
    const getContextRow = vi.fn();
    const upsertContextRow = vi.fn(async () => {});
    const getV2State = vi.fn();
    const handleChatMessage = vi.fn();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: { db, getContextRow, upsertContextRow, getV2State },
    });
    router.init({ io, handleChatMessage });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customer/message-form', {
          method: 'POST',
          body: {
            name: 'Anna Andersson',
            email: 'anna@example.com',
            phone: '0701234567',
            subject: 'Hj�lp',
            message: 'Jag vill boka tid.',
            city: 'Malmo',
            vehicle: 'BIL',
          },
        });

        expect(response.status).toBe(200);
        expect(response.json.success).toBe(true);
        expect(upsertContextRow).toHaveBeenCalledWith(expect.objectContaining({
          last_message_id: 1,
          context_data: expect.objectContaining({
            locked_context: expect.objectContaining({
              name: 'Anna Andersson',
              email: 'anna@example.com',
              phone: '0701234567',
              city: 'Malmo',
              vehicle: 'BIL',
            }),
          }),
        }));
        expect(io.emit).toHaveBeenCalledWith('team:update', expect.objectContaining({ type: 'new_message' }));
      });
    } finally {
      restore();
    }
  });
});
