const express = require('express');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/customers.ts');
const dbPath = require.resolve('../../../db');
const authMiddlewarePath = require.resolve('../../../middleware/auth');
const openaiPath = require.resolve('openai');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

function fakeAuth(req, res, next) {
  req.user = {
    username: req.headers['x-test-user'] || 'patrik',
    display_name: req.headers['x-test-display-name'] || 'Patrik',
    role: req.headers['x-test-role'] || 'admin',
  };
  next();
}

describe('routes/customers', () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it('lists grouped customer profiles', async () => {
    const dbAll = vi.fn((sql, params, callback) => callback(null, [
      {
        email: 'kund@example.com',
        name: 'Kund Test',
        phone: '0701234567',
        total_tickets: 2,
        active_tickets: 1,
        last_contact: 1711111111,
        offices: 'goteborg_ullevi',
        vehicles: 'BIL',
        agents: 'patrik',
      },
    ]));
    const dbModule = { db: { all: dbAll } };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: vi.fn(),
    });
    router.init({});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customers', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          customers: [expect.objectContaining({
            email: 'kund@example.com',
            total_tickets: 2,
            active_tickets: 1,
          })],
        });
      });
    } finally {
      restore();
    }
  });

  it('requires either email or name and phone when loading customer tickets', async () => {
    const dbModule = { db: { all: vi.fn() } };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: vi.fn(),
    });
    router.init({});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customers/tickets', { method: 'GET' });

        expect(response.status).toBe(400);
        expect(response.json).toEqual({ error: 'email eller name+phone krävs som query-parametrar' });
      });
    } finally {
      restore();
    }
  });

  it('maps customer ticket history into the archive-style response shape', async () => {
    const contextData = {
      locked_context: {
        name: 'Kund Test',
        email: 'kund@example.com',
        phone: '0701234567',
        city: 'Goteborg',
        vehicle: 'BIL',
        subject: 'Fraga om riskettan',
      },
      messages: [
        { role: 'user', content: 'Vad kostar riskettan?' },
        { role: 'atlas', content: 'Riskettan kostar 799 kr.' },
      ],
    };
    const dbAll = vi.fn((sql, params, callback) => callback(null, [
      {
        conversation_id: 'conv-1',
        updated_at: 1711111111,
        owner: 'patrik',
        human_mode: 1,
        office_color: '#0088cc',
        session_type: 'customer',
        is_archived: 0,
        office: 'goteborg_ullevi',
        context_data: JSON.stringify(contextData),
      },
    ]));
    const dbModule = { db: { all: dbAll } };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: vi.fn(),
    });
    router.init({});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customers/tickets?email=kund@example.com', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json.tickets).toHaveLength(1);
        expect(response.json.tickets[0]).toMatchObject({
          conversation_id: 'conv-1',
          question: 'Vad kostar riskettan?',
          routing_tag: 'goteborg_ullevi',
          contact_name: 'Kund Test',
          contact_email: 'kund@example.com',
          contact_phone: '0701234567',
          city: 'Goteborg',
          vehicle: 'BIL',
          subject: 'Fraga om riskettan',
        });
      });
    } finally {
      restore();
    }
  });

  it('summarizes a customer history through OpenAI when a key is configured', async () => {
    process.env.OPENAI_API_KEY = 'openai-test-key';

    const dbAll = vi.fn((sql, params, callback) => callback(null, [
      {
        conversation_id: 'conv-1',
        updated_at: 1711111111,
        is_archived: 0,
        office: 'goteborg_ullevi',
        context_data: JSON.stringify({
          locked_context: { vehicle: 'BIL' },
          messages: [{ role: 'user', content: 'Jag vill boka körlektion' }],
        }),
      },
    ]));
    const createCompletion = vi.fn(async () => ({
      choices: [{ message: { content: 'Kunden frågar främst om bilkörlektioner i Göteborg.' } }],
    }));
    const OpenAI = vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: createCompletion,
          },
        },
      };
    });
    const dbModule = { db: { all: dbAll } };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: OpenAI,
    });
    router.init({});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customers/summarize', {
          method: 'POST',
          body: { email: 'kund@example.com' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ summary: 'Kunden frågar främst om bilkörlektioner i Göteborg.' });
        expect(createCompletion).toHaveBeenCalledTimes(1);
      });
    } finally {
      restore();
    }
  });

  it('stores customer notes with a normalized email and trimmed content', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback.call({ lastID: 12 }, null));
    const dbModule = {
      db: {
        all: vi.fn(),
        run: dbRun,
        get: vi.fn(),
      },
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: vi.fn(),
    });
    router.init({});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customer-notes', {
          method: 'POST',
          body: { email: ' Kund@Example.com ', content: '  Viktig anteckning  ' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ id: 12, ok: true });
        expect(dbRun).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO customer_notes'),
          ['kund@example.com', 'patrik', 'Viktig anteckning'],
          expect.any(Function)
        );
      });
    } finally {
      restore();
    }
  });

  it('prevents agents from deleting another agents customer note', async () => {
    const dbGet = vi.fn((sql, params, callback) => callback(null, { agent_name: 'anna' }));
    const dbModule = {
      db: {
        all: vi.fn(),
        run: vi.fn(),
        get: dbGet,
      },
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: vi.fn(),
    });
    router.init({});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/customer-notes/17', {
          method: 'DELETE',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'agent' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Inte tillåtet — du kan bara ta bort egna anteckningar' });
      });
    } finally {
      restore();
    }
  });
});
