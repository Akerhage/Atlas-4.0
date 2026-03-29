const express = require('express');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/knowledge.ts');
const dbPath = require.resolve('../../../db');
const legacyEnginePath = require.resolve('../../../legacy_engine');
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
    role: req.headers['x-test-role'] || 'admin',
  };
  next();
}

describe('routes/knowledge', () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it('falls back to office data from the database when the JSON file is missing', async () => {
    const fs = require('fs');
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const dbModule = {
      db: {
        get: vi.fn((sql, params, callback) => {
          callback(null, {
            city: 'Goteborg',
            area: 'Ullevi',
            office_color: '#0088cc',
            phone: '010-333 32 31',
            email: 'goteborg@example.com',
            address: 'Testgatan 1',
          });
        }),
      },
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: vi.fn(),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/knowledge/goteborg_ullevi', {
          method: 'GET',
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          id: 'goteborg_ullevi',
          city: 'Goteborg',
          area: 'Ullevi',
          office_color: '#0088cc',
          contact: {
            phone: '010-333 32 31',
            email: 'goteborg@example.com',
            address: 'Testgatan 1',
          },
          description: 'Information h\u00E4mtad fr\u00E5n databasen (Ingen JSON-fil hittades).',
          prices: [],
          services_offered: [],
        });
      });
    } finally {
      existsSpy.mockRestore();
      restore();
    }
  });

  it('rejects PUT requests from non-admin users', async () => {
    const fs = require('fs');
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const dbModule = {
      db: {
        get: vi.fn(),
        run: vi.fn(),
      },
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: vi.fn(),
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/knowledge/goteborg_ullevi', {
          method: 'PUT',
          headers: { 'x-test-role': 'agent' },
          body: { description: 'Ny text' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Access denied' });
      });
    } finally {
      existsSpy.mockRestore();
      restore();
    }
  });

  it('updates prices, syncs keywords, trims booking links and reloads knowledge safely', async () => {
    process.env.OPENAI_API_KEY = 'openai-test-key';

    const fs = require('fs');
    const originalReadFileSync = fs.readFileSync;
    const originalOfficeData = {
      id: 'goteborg_ullevi',
      type: 'kontor_info',
      brand: 'M\u00E5rtenssons Trafikskola',
      city: 'Goteborg',
      area: 'Ullevi',
      description: 'Gamla texten',
      keywords: ['goteborg'],
      booking_links: {
        CAR: 'https://book/car',
        MC: 'https://book/mc',
        AM: 'https://book/am',
      },
      contact: {
        phone: '010-333 32 31',
        email: 'office@example.com',
        address: 'Testgatan 1',
        coordinates: { lat: 57.7, lng: 11.9 },
      },
      prices: [
        { service_name: 'K\u00F6rlektion Bil', keywords: [] },
      ],
      services: [
        { title: 'Bil', keywords: [] },
      ],
    };

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const loadKnowledgeBase = vi.fn();

    const validationCreate = vi.fn(async () => ({
      choices: [{ message: { content: 'OK' } }],
    }));

    const OpenAI = vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: validationCreate,
          },
        },
      };
    });

    const dbModule = {
      db: {
        get: vi.fn(),
        run: dbRun,
      },
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase },
      [authMiddlewarePath]: fakeAuth,
      [openaiPath]: OpenAI,
    });

    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...args) => {
      if (String(filePath).endsWith('goteborg_ullevi.json')) {
        return JSON.stringify(originalOfficeData);
      }
      return originalReadFileSync.call(fs, filePath, ...args);
    });
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/knowledge/goteborg_ullevi', {
          method: 'PUT',
          body: {
            description: 'Ny kontorstext',
            office_color: '#ff6600',
            prices: [
              { service_name: 'K\u00F6rlektion Bil', keywords: [] },
              { service_name: 'Risk 1', keywords: [] },
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          success: true,
          message: 'Kontoret uppdaterat utan att skada RAG-strukturen.',
        });

        const savedPayload = JSON.parse(writeSpy.mock.calls[0][1]);
        expect(savedPayload.services_offered).toEqual(['Bil']);
        expect(savedPayload.booking_links).toEqual({
          CAR: 'https://book/car',
          MC: null,
          AM: null,
        });
        expect(savedPayload.keywords).toEqual(expect.arrayContaining(['goteborg', 'ullevi', 'm\u00E5rtenssons']));
        expect(savedPayload.prices[0].keywords).toEqual(expect.arrayContaining(['goteborg', 'ullevi', 'm\u00E5rtenssons']));
        expect(dbRun).toHaveBeenCalledWith(
          'UPDATE offices SET office_color = ? WHERE routing_tag = ?',
          ['#ff6600', 'goteborg_ullevi'],
          expect.any(Function)
        );
        expect(loadKnowledgeBase).toHaveBeenCalledTimes(1);
      });
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      restore();
    }
  });
});
