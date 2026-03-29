const express = require('express');
const fs = require('fs');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/admin.ts');
const dbPath = require.resolve('../../../db');
const legacyEnginePath = require.resolve('../../../legacy_engine');
const authMiddlewarePath = require.resolve('../../../middleware/auth');
const bcryptPath = require.resolve('bcrypt');
const openaiPath = require.resolve('openai');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return app;
}

function fakeAuth(req, res, next) {
  req.user = {
    id: Number(req.headers['x-user-id'] || 1),
    username: req.headers['x-test-user'] || 'patrik',
    role: req.headers['x-test-role'] || 'admin',
  };
  next();
}

function buildAdminDeps(overrides = {}) {
  const io = { emit: vi.fn() };
  const authRoutes = { setJwtExpiresIn: vi.fn() };
  const deps = {
    io,
    getEnvPath: () => 'C:/Atlas/.env',
    getFilePaths: () => ({
      mainJs: 'C:/Atlas/main.js',
      legacyJs: 'C:/Atlas/legacy_engine.ts',
      rendererJs: 'C:/Atlas/Renderer/renderer.js',
      intentJs: 'C:/Atlas/patch/intentEngine.ts',
      knowledgePath: 'C:/Atlas/knowledge',
    }),
    BLOCKED_CONFIG_KEYS: ['JWT_SECRET'],
    recreateMailTransporter: vi.fn(),
    setSetting: vi.fn(),
    runDatabaseBackup: vi.fn(),
    authRoutes,
    ...overrides,
  };
  return deps;
}

describe('routes/admin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks non-admins from creating users', async () => {
    const bcrypt = { hash: vi.fn(async () => 'hashed') };
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/create-user', {
          method: 'POST',
          headers: { 'x-test-role': 'agent' },
          body: { username: 'Lisa', password: 'secret123' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Access denied' });
        expect(dbModule.db.run).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('creates users with normalized defaults and a lowercase username', async () => {
    const bcrypt = { hash: vi.fn(async () => 'hashed-password') };
    const dbRun = vi.fn((sql, params, callback) => callback.call({ lastID: 33 }, null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/create-user', {
          method: 'POST',
          body: { username: 'Lisa', password: 'secret123' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, userId: 33 });
        expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
        expect(dbRun).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          ['lisa', 'hashed-password', 'agent', 'lisa', '#0071e3', 0, null],
          expect.any(Function)
        );
      });
    } finally {
      restore();
    }
  });

  it('blocks admins from changing their own role', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/update-role', {
          method: 'POST',
          headers: { 'x-user-id': '7' },
          body: { userId: 7, newRole: 'agent' },
        });

        expect(response.status).toBe(400);
        expect(response.json).toEqual({ error: 'Du kan inte \u00E4ndra din egen roll' });
        expect(dbModule.db.run).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('rejects invalid routing tags when updating office colors', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/update-office-color', {
          method: 'POST',
          body: { routing_tag: '../bad', color: '#123456' },
        });

        expect(response.status).toBe(400);
        expect(response.json).toEqual({ error: 'Ogiltigt routing_tag-format' });
        expect(dbModule.db.run).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('updates office colors in SQL and the office JSON file', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const officeJson = { id: 'goteborg_ullevi', office_color: '#0071e3' };
    const deps = buildAdminDeps();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(officeJson));
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/update-office-color', {
          method: 'POST',
          body: { routing_tag: 'goteborg_ullevi', color: '#ff6600' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbRun).toHaveBeenCalledWith(
          'UPDATE offices SET office_color = ? WHERE routing_tag = ?',
          ['#ff6600', 'goteborg_ullevi'],
          expect.any(Function)
        );
        const savedPayload = JSON.parse(writeSpy.mock.calls[0][1]);
        expect(savedPayload.office_color).toBe('#ff6600');
        expect(deps.io.emit).toHaveBeenCalledWith('office:color_updated', { routing_tag: 'goteborg_ullevi', color: '#ff6600' });
      });
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      restore();
    }
  });

  it('adds office tags to an agent profile and emits the update', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(async () => ({ username: 'lisa', routing_tag: 'malmo' })),
      getContextRow: vi.fn(),
    };
    const deps = buildAdminDeps();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/update-agent-offices', {
          method: 'POST',
          body: { username: 'lisa', tag: 'goteborg', isChecked: true },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, newTags: 'malmo,goteborg' });
        expect(dbRun).toHaveBeenCalledWith(
          'UPDATE users SET routing_tag = ? WHERE username = ?',
          ['malmo,goteborg', 'lisa'],
          expect.any(Function)
        );
        expect(deps.io.emit).toHaveBeenCalledWith('agent:offices_updated', { username: 'lisa', newTags: 'malmo,goteborg' });
      });
    } finally {
      restore();
    }
  });

  it('stores user view restrictions as JSON and includes the current role in the live update', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbGet = vi.fn((sql, params, callback) => callback(null, { role: 'agent' }));
    const dbModule = {
      db: { run: dbRun, get: dbGet, all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const deps = buildAdminDeps();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/user-views/lisa', {
          method: 'PUT',
          body: { allowed_views: ['inbox', 'my-tickets'] },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, allowed_views: '["inbox","my-tickets"]' });
        expect(dbRun).toHaveBeenCalledWith(
          'UPDATE users SET allowed_views = ? WHERE username = ?',
          ['["inbox","my-tickets"]', 'lisa'],
          expect.any(Function)
        );
        expect(deps.io.emit).toHaveBeenCalledWith('agent:views_updated', {
          username: 'lisa',
          allowed_views: '["inbox","my-tickets"]',
          role: 'agent',
        });
      });
    } finally {
      restore();
    }
  });

  it('creates a new office JSON file with synchronized services and booking links', async () => {
    const dbGet = vi.fn((sql, params, callback) => callback(null, null));
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: dbGet, all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const loadKnowledgeBase = vi.fn();
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/create-office', {
          method: 'POST',
          body: {
            city: 'Goteborg',
            area: 'Ullevi',
            routing_tag: 'goteborg_ullevi',
            brand: 'M\u00E5rtenssons Trafikskola',
            services_offered: ['Bil'],
            prices: [
              { service_name: 'K\u00F6rlektion Bil', price: 899, currency: 'SEK', keywords: ['bil'] },
              { service_name: 'K\u00F6rlektion MC', price: 1499, currency: 'SEK', keywords: ['mc', 'motorcykel'] },
            ],
            booking_links: { CAR: 'https://custom/car' },
          },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        const savedPayload = JSON.parse(writeSpy.mock.calls[0][1]);
        expect(savedPayload.id).toBe('martenssons_trafikskola_goteborg_ullevi');
        expect(savedPayload.services_offered).toEqual(expect.arrayContaining(['Bil', 'MC']));
        expect(savedPayload.prices[0].keywords).toEqual(expect.arrayContaining(['bil', 'goteborg', 'ullevi']));
        expect(savedPayload.booking_links).toEqual({
          CAR: 'https://custom/car',
          MC: 'https://mitt.mydrivingacademy.com/login',
          AM: null,
        });
        expect(loadKnowledgeBase).toHaveBeenCalledTimes(1);
      });
    } finally {
      writeSpy.mockRestore();
      restore();
    }
  });
  it('reads system configuration from .env and companion files without exposing blocked keys', async () => {
    const deps = buildAdminDeps({
      getEnvPath: () => 'C:/Atlas/.env.test',
      getFilePaths: () => ({
        mainJs: 'C:/Atlas/main.js',
        legacyJs: 'C:/Atlas/legacy_engine.ts',
        rendererJs: 'C:/Atlas/Renderer/renderer.js',
        intentJs: 'C:/Atlas/patch/intentEngine.ts',
        knowledgePath: 'C:/Atlas/knowledge',
      }),
      BLOCKED_CONFIG_KEYS: ['JWT_SECRET', 'CLIENT_API_KEY'],
    });
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      const target = String(filePath);
      if (target.endsWith('.env.test')) return 'PORT=3001\nJWT_SECRET=hidden\nEMAIL_USER=test@example.com';
      if (target.endsWith('main.js')) return 'const SERVER_PORT = 3001;';
      if (target.endsWith('legacy_engine.ts')) return "const PORT = 4000;\nconst DEV_PATH = '/atlas/dev';";
      if (target.endsWith('renderer.js')) return 'const NGROK_HOST = "https://atlas-support.se";';
      if (target.endsWith('intentEngine.ts')) return "this.defaultConfidence = 0.2;\nintent = 'price_lookup';\nconfidence = 0.75\nintent = 'booking';\nconfidence = 0.76";
      return ''; 
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/system-config', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json.EMAIL_USER).toBe('test@example.com');
        expect(response.json.JWT_SECRET).toBeUndefined();
        expect(response.json._main_PORT).toBe('3001');
        expect(response.json._legacy_PORT).toBe('4000');
        expect(response.json.DEV_PATH).toBe('/atlas/dev');
        expect(response.json._renderer_NGROK).toBe('https://atlas-support.se');
        expect(response.json.defaultConfidence).toBe('0.2');
        expect(response.json.conf_price).toBe('0.75');
        expect(response.json.conf_booking).toBe('0.76');
      });
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
      restore();
    }
  });

  it('updates EMAIL_USER in system-config and hot-reloads the mail transporter without restart', async () => {
    const deps = buildAdminDeps({
      getEnvPath: () => 'C:/Atlas/.env.test',
    });
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    const copySpy = vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue('EMAIL_USER=old@example.com\nEMAIL_PASS=secret');
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/system-config', {
          method: 'POST',
          body: { field: 'EMAIL_USER', value: 'new@example.com' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, changedFiles: ['.env'], restartRequired: false });
        expect(writeSpy.mock.calls[0][1]).toContain('EMAIL_USER=new@example.com');
        expect(deps.recreateMailTransporter).toHaveBeenCalledTimes(1);
      });
    } finally {
      copySpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      restore();
    }
  });

  it('lists basfakta files from the knowledge folder and sorts by section title', async () => {
    const deps = buildAdminDeps({
      getFilePaths: () => ({
        mainJs: 'C:/Atlas/main.js',
        legacyJs: 'C:/Atlas/legacy_engine.ts',
        rendererJs: 'C:/Atlas/Renderer/renderer.js',
        intentJs: 'C:/Atlas/patch/intentEngine.ts',
        knowledgePath: 'C:/Atlas/knowledge',
      }),
    });
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      const target = String(filePath);
      if (target.endsWith('basfakta_alpha.json')) return JSON.stringify({ id: 'alpha', section_title: 'A-sektion' });
      if (target.endsWith('basfakta_beta.json')) return JSON.stringify({ id: 'beta', section_title: 'B-sektion' });
      return ''; 
    });
    const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue(['basfakta_beta.json', 'not-this.txt', 'basfakta_alpha.json']);

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/basfakta-list', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual([
          { filename: 'basfakta_alpha.json', id: 'alpha', section_title: 'A-sektion' },
          { filename: 'basfakta_beta.json', id: 'beta', section_title: 'B-sektion' },
        ]);
      });
    } finally {
      readSpy.mockRestore();
      readdirSpy.mockRestore();
      restore();
    }
  });

  it('updates basfakta sections while preserving old metadata and generating keywords for new sections', async () => {
    process.env.OPENAI_API_KEY = 'openai-test-key';
    const loadKnowledgeBase = vi.fn();
    const deps = buildAdminDeps({
      getFilePaths: () => ({
        mainJs: 'C:/Atlas/main.js',
        legacyJs: 'C:/Atlas/legacy_engine.ts',
        rendererJs: 'C:/Atlas/Renderer/renderer.js',
        intentJs: 'C:/Atlas/patch/intentEngine.ts',
        knowledgePath: 'C:/Atlas/knowledge',
      }),
    });
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const createCompletion = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: 'riskettan, goteborg, pris' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'OK' } }] });
    const OpenAI = vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: createCompletion,
          },
        },
      };
    });

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: OpenAI,
    });
    router.init(deps);

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const readSpy = vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
      id: 'basfakta_risk.json',
      sections: [
        { title: 'Risk 1', answer: 'Gamla svaret', keywords: ['riskettan'], extra: 'bevara' },
      ],
    }));
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/basfakta/basfakta_risk.json', {
          method: 'PUT',
          body: {
            sections: [
              { title: 'Risk 1', answer: 'Nya svaret' },
              { title: 'Risk 2', answer: 'Ny sektion' },
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, message: 'Filen sparad och validerad.' });
        const savedPayload = JSON.parse(writeSpy.mock.calls[0][1]);
        expect(savedPayload.sections[0]).toEqual({ title: 'Risk 1', answer: 'Nya svaret', keywords: ['riskettan'], extra: 'bevara' });
        expect(savedPayload.sections[1]).toEqual({ title: 'Risk 2', answer: 'Ny sektion', keywords: ['riskettan', 'goteborg', 'pris'] });
        expect(loadKnowledgeBase).toHaveBeenCalledTimes(1);
      });
    } finally {
      delete process.env.OPENAI_API_KEY;
      existsSpy.mockRestore();
      readSpy.mockRestore();
      writeSpy.mockRestore();
      restore();
    }
  });

  it('returns available service templates for admins', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((filePath) => /service_templates\.json$/.test(String(filePath)));
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (/service_templates\.json$/.test(String(filePath))) {
        return JSON.stringify([{ id: 'car', label: 'Bil', keywords: ['bil'] }]);
      }
      return '';
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/available-services', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual([{ id: 'car', label: 'Bil', keywords: ['bil'] }]);
      });
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
      restore();
    }
  });

  it('lists rag failures with a capped limit for authenticated users', async () => {
    const dbAll = vi.fn((sql, params, callback) => callback(null, [{
      id: 1,
      query: 'Vad kostar riskettan?',
      session_type: 'chat',
      ts_fallback_used: 1,
      ts_fallback_success: 0,
      ts_url: 'https://transportstyrelsen.se/risk',
      created_at: '2026-03-27 10:00:00',
    }]));
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: dbAll },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/rag-failures?limit=999', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual([{
          id: 1,
          query: 'Vad kostar riskettan?',
          session_type: 'chat',
          ts_fallback_used: 1,
          ts_fallback_success: 0,
          ts_url: 'https://transportstyrelsen.se/risk',
          created_at: '2026-03-27 10:00:00',
        }]);
        expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('FROM rag_failures'), [500], expect.any(Function));
      });
    } finally {
      restore();
    }
  });

  it('clears rag failures for admins', async () => {
    const dbRun = vi.fn((sql, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/rag-failures', { method: 'DELETE' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbRun).toHaveBeenCalledWith('DELETE FROM rag_failures', expect.any(Function));
      });
    } finally {
      restore();
    }
  });

  it('merges persisted rag scores with defaults', async () => {
    const dbAll = vi.fn((sql, params, callback) => callback(null, [
      { key: 'rag_score_c8_kontakt', value: '31000' },
      { key: 'rag_score_b1_policy', value: 'not-a-number' },
    ]));
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: dbAll },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/rag-scores', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json.rag_score_c8_kontakt).toBe(31000);
        expect(response.json.rag_score_b1_policy).toBe(50000);
        expect(response.json.rag_score_fix_saknade).toBe(20000);
        expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('FROM settings'), expect.any(Array), expect.any(Function));
      });
    } finally {
      restore();
    }
  });

  it('persists rag scores in settings with restart metadata', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/rag-scores', {
          method: 'POST',
          body: { field: 'rag_score_b1_policy', value: '54000' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, field: 'rag_score_b1_policy', value: 54000, restartRequired: true });
        expect(dbRun).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO settings'),
          ['rag_score_b1_policy', '54000'],
          expect.any(Function)
        );
      });
    } finally {
      restore();
    }
  });

  it('reads booking links with defaults merged in', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((filePath) => /booking-links\.json$/.test(String(filePath)));
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (/booking-links\.json$/.test(String(filePath))) {
        return JSON.stringify({
          CAR: {
            type: 'info',
            text: 'Anpassad biltext',
            linkText: 'bokning',
            url: 'https://custom.example/car',
          },
        });
      }
      return '';
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/booking-links', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json.CAR.url).toBe('https://custom.example/car');
        expect(response.json.CAR.text).toBe('Anpassad biltext');
        expect(response.json.INTRO.url).toContain('handledarutbildning');
      });
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
      restore();
    }
  });

  it('updates booking links while preserving existing metadata', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      const target = String(filePath);
      if (/booking-links\.json$/.test(target)) return true;
      if (/[\\/]utils$/.test(target)) return false;
      return false;
    });
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (/booking-links\.json$/.test(String(filePath))) {
        return JSON.stringify({
          CAR: {
            type: 'info',
            text: 'Beh\u00E5ll denna text',
            linkText: 'h\u00E4r',
            url: 'https://old.example/car',
          },
        });
      }
      return '';
    });
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/booking-links', {
          method: 'POST',
          body: { key: 'CAR', url: 'https://new.example/car   ' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, key: 'CAR', url: 'https://new.example/car', restartRequired: true });
        const savedPayload = JSON.parse(writeSpy.mock.calls[0][1]);
        expect(savedPayload.CAR).toEqual({
          type: 'info',
          text: 'Beh\u00E5ll denna text',
          linkText: 'h\u00E4r',
          url: 'https://new.example/car',
        });
        expect(mkdirSpy).toHaveBeenCalledTimes(1);
      });
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      restore();
    }
  });

  it('reads transportstyrelsen URLs with defaults merged in', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((filePath) => /transportstyrelsen-urls\.json$/.test(String(filePath)));
    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (/transportstyrelsen-urls\.json$/.test(String(filePath))) {
        return JSON.stringify({ TILLSTAND: 'https://custom.example/tillstand' });
      }
      return '';
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/ts-urls', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json.TILLSTAND).toBe('https://custom.example/tillstand');
        expect(response.json.B).toContain('/b-personbil-och-latt-lastbil/');
      });
    } finally {
      existsSpy.mockRestore();
      readSpy.mockRestore();
      restore();
    }
  });

  it('updates transportstyrelsen URLs and trims the saved value', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      const target = String(filePath);
      if (/transportstyrelsen-urls\.json$/.test(target)) return false;
      if (/[\\/]utils$/.test(target)) return false;
      return false;
    });
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/ts-urls', {
          method: 'POST',
          body: { key: 'B', url: 'https://custom.example/b   ' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, key: 'B', url: 'https://custom.example/b', restartRequired: true });
        const savedPayload = JSON.parse(writeSpy.mock.calls[0][1]);
        expect(savedPayload.B).toBe('https://custom.example/b');
        expect(savedPayload.TILLSTAND).toContain('korkortstillstand');
        expect(mkdirSpy).toHaveBeenCalledTimes(1);
      });
    } finally {
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
      restore();
    }
  });

  it('updates user profiles with password changes and emits live updates', async () => {
    const bcrypt = { hash: vi.fn(async () => 'new-password-hash') };
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const deps = buildAdminDeps();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/update-user-profile', {
          method: 'POST',
          body: {
            userId: 9,
            username: 'lisa',
            password: 'secret123',
            role: 'support',
            display_name: 'Lisa',
            agent_color: '#ff5500',
            avatar_id: 4,
            routing_tag: 'goteborg_ullevi',
          },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
        expect(dbRun).toHaveBeenCalledWith(
          expect.stringContaining('password_hash = ?'),
          ['support', 'Lisa', '#ff5500', 4, 'goteborg_ullevi', 'new-password-hash', 9],
          expect.any(Function)
        );
        expect(deps.io.emit).toHaveBeenCalledWith('agent:color_updated', { username: 'lisa', color: '#ff5500' });
        expect(deps.io.emit).toHaveBeenCalledWith('agent:profile_updated', { username: 'lisa', role: 'support' });
      });
    } finally {
      restore();
    }
  });

  it('resets passwords for admins through bcrypt and SQL', async () => {
    const bcrypt = { hash: vi.fn(async () => 'reset-hash') };
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/reset-password', {
          method: 'POST',
          body: { userId: 11, newPassword: 'new-secret' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(bcrypt.hash).toHaveBeenCalledWith('new-secret', 10);
        expect(dbRun).toHaveBeenCalledWith(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          ['reset-hash', 11],
          expect.any(Function)
        );
      });
    } finally {
      restore();
    }
  });

  it('blocks admins from deleting themselves', async () => {
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'x-user-id': '5' },
          body: { userId: 5 },
        });

        expect(response.status).toBe(400);
        expect(response.json).toEqual({ error: 'Du kan inte ta bort dig sj\u00E4lv' });
        expect(dbModule.db.get).not.toHaveBeenCalled();
        expect(dbModule.db.run).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('deletes a user and releases their owned tickets', async () => {
    const dbGet = vi.fn((sql, params, callback) => callback(null, { username: 'lisa' }));
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: dbGet, all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/delete-user', {
          method: 'POST',
          body: { userId: 13 },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbGet).toHaveBeenCalledWith('SELECT username FROM users WHERE id = ?', [13], expect.any(Function));
        expect(dbRun).toHaveBeenNthCalledWith(1, 'DELETE FROM users WHERE id = ?', [13], expect.any(Function));
        expect(dbRun).toHaveBeenNthCalledWith(2, 'UPDATE chat_v2_state SET owner = NULL WHERE owner = ?', ['lisa'], expect.any(Function));
      });
    } finally {
      restore();
    }
  });

  it('returns global dashboard stats with sane defaults', async () => {
    const dbGet = vi.fn((sql, params, callback) => callback(null, {
      total_sessions: 12,
      human_sessions: 4,
      last_activity: '2026-03-27 12:00:00',
    }));
    const dbModule = {
      db: { run: vi.fn(), get: dbGet, all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/user-stats', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          total_sessions: 12,
          human_sessions: 4,
          last_activity: '2026-03-27 12:00:00',
        });
        expect(dbGet).toHaveBeenCalledWith(expect.stringContaining('COUNT(DISTINCT conversation_id)'), [], expect.any(Function));
      });
    } finally {
      restore();
    }
  });

  it('builds per-agent stats using routing tags when they exist', async () => {
    const dbGet = vi.fn()
      .mockImplementationOnce((sql, params, callback) => callback(null, { routing_tag: 'goteborg_ullevi,malmo' }))
      .mockImplementationOnce((sql, params, callback) => callback(null, {
        active_count: 3,
        archived_count: 5,
        mail_handled: 2,
        internals_sent: 1,
        total_active: 12,
        total_archived: 20,
        ai_answered: 9,
        human_handled: 11,
        spam_count: 4,
      }));
    const dbModule = {
      db: { run: vi.fn(), get: dbGet, all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/user-stats/lisa', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          active: 3,
          archived: 5,
          mail_handled: 2,
          internals_sent: 1,
          total_active: 12,
          total_archived: 20,
          ai_answered: 9,
          human_handled: 11,
          spam_count: 4,
        });
        expect(dbGet).toHaveBeenNthCalledWith(1, 'SELECT routing_tag FROM users WHERE username = ?', ['lisa'], expect.any(Function));
        expect(dbGet.mock.calls[1][0]).toContain('office IN (?,?)');
        expect(dbGet.mock.calls[1][1]).toEqual(['lisa', 'goteborg_ullevi', 'malmo', 'lisa', 'lisa', 'lisa']);
      });
    } finally {
      restore();
    }
  });

  it('returns agent tickets enriched with stored context data', async () => {
    const dbGet = vi.fn((sql, params, callback) => callback(null, { routing_tag: 'goteborg_ullevi' }));
    const dbAll = vi.fn((sql, params, callback) => callback(null, [{
      conversation_id: 'conv-77',
      session_type: 'chat',
      human_mode: 1,
      owner: 'lisa',
      sender: 'customer',
      updated_at: '2026-03-27 13:00:00',
      is_archived: 0,
      routing_tag: 'goteborg_ullevi',
      office_color: '#ffaa00',
      name: 'Fallback Name',
      email: 'fallback@example.com',
      phone: '070-000 00 00',
      is_assigned: 1,
    }]));
    const dbModule = {
      db: { run: vi.fn(), get: dbGet, all: dbAll },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(async () => ({
        context_data: {
          locked_context: {
            subject: 'Hjälp med bokning',
            name: 'Lisa Kund',
            email: 'lisa@example.com',
            phone: '070-123 45 67',
          },
          messages: [{ role: 'user', content: 'Jag behöver hjälp med bokning' }],
        },
      })),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/agent-tickets/lisa', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual([expect.objectContaining({
          conversation_id: 'conv-77',
          subject: 'Hjälp med bokning',
          preview: 'Hjälp med bokning',
          contact_name: 'Lisa Kund',
          contact_email: 'lisa@example.com',
          contact_phone: '070-123 45 67',
          office_color: '#ffaa00',
          messages: [{ role: 'user', content: 'Jag behöver hjälp med bokning' }],
        })]);
        expect(dbGet).toHaveBeenCalledWith('SELECT routing_tag FROM users WHERE username = ?', ['lisa'], expect.any(Function));
        expect(dbAll.mock.calls[0][0]).toContain('LEFT JOIN offices');
        expect(dbAll.mock.calls[0][1]).toEqual(['lisa', 'lisa', 'goteborg_ullevi']);
      });
    } finally {
      restore();
    }
  });

  it('allows agents to update only their own color profile', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const deps = buildAdminDeps();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/update-agent-color', {
          method: 'POST',
          headers: { 'x-test-role': 'agent', 'x-test-user': 'lisa' },
          body: { username: 'lisa', color: '#112233' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbRun).toHaveBeenCalledWith(
          'UPDATE users SET agent_color = ? WHERE username = ?',
          ['#112233', 'lisa'],
          expect.any(Function)
        );
        expect(deps.io.emit).toHaveBeenCalledWith('agent:color_updated', { username: 'lisa', color: '#112233' });
      });
    } finally {
      restore();
    }
  });
  it('returns assignable users for auth user lookups', async () => {
    const rows = [{ username: 'anna', role: 'agent', agent_color: '#123456', avatar_id: 2, status_text: 'Online', display_name: 'Anna', is_online: 1, routing_tag: 'goteborg' }];
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn((sql, params, callback) => callback(null, rows)) },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/auth/users', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual(rows);
        expect(dbModule.db.all).toHaveBeenCalledWith(
          expect.stringContaining('SELECT username, role, agent_color'),
          [],
          expect.any(Function)
        );
      });
    } finally {
      restore();
    }
  });

  it('returns all admin users with routing and view metadata', async () => {
    const rows = [{ id: 4, username: 'lisa', role: 'support', routing_tag: 'malmo', allowed_views: '["inbox"]' }];
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn((sql, params, callback) => callback(null, rows)) },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/users', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual(rows);
        expect(dbModule.db.all).toHaveBeenCalledWith(
          expect.stringContaining('allowed_views'),
          [],
          expect.any(Function)
        );
      });
    } finally {
      restore();
    }
  });

  it('returns office tickets enriched from stored context data', async () => {
    const dbAll = vi.fn((sql, params, callback) => callback(null, [{
      conversation_id: 'office-1',
      owner: 'anna',
      session_type: 'customer',
      sender: 'customer',
      updated_at: '2026-03-27 14:00:00',
      name: 'Fallback Namn',
      email: 'fallback@example.com',
      phone: '0700000000',
      office_color: '#ff9900',
    }]));
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: dbAll },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(async () => ({
        context_data: JSON.stringify({
          locked_context: {
            name: 'Kund Kontor',
            email: 'kund@example.com',
            phone: '070123123',
          },
          messages: [{ role: 'user', text: 'Behöver hjälp med en bokning' }],
        }),
      })),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/office-tickets/goteborg_ullevi', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual([expect.objectContaining({
          conversation_id: 'office-1',
          office_color: '#ff9900',
          subject: 'Inget ämne',
          preview: 'Behöver hjälp med en bokning',
          contact_name: 'Kund Kontor',
          contact_email: 'kund@example.com',
          contact_phone: '070123123',
          messages: [{ role: 'user', text: 'Behöver hjälp med en bokning' }],
        })]);
        expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN offices'), ['goteborg_ullevi'], expect.any(Function));
      });
    } finally {
      restore();
    }
  });

  it('updates user roles by username and emits a live profile update', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const deps = buildAdminDeps();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(deps);

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/update-role-by-username', {
          method: 'POST',
          body: { username: 'lisa', newRole: 'support' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbRun).toHaveBeenCalledWith(
          'UPDATE users SET role = ? WHERE username = ?',
          ['support', 'lisa'],
          expect.any(Function)
        );
        expect(deps.io.emit).toHaveBeenCalledWith('agent:profile_updated', { username: 'lisa', role: 'support' });
      });
    } finally {
      restore();
    }
  });

  it('deletes offices, removes the knowledge file and cleans agent routing tags', async () => {
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbAll = vi.fn((sql, params, callback) => callback(null, [
      { id: 7, routing_tag: 'goteborg_ullevi,malmo' },
      { id: 8, routing_tag: 'goteborg_ullevi' },
    ]));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: dbAll },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };
    const loadKnowledgeBase = vi.fn();

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/office/goteborg_ullevi', { method: 'DELETE' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(unlinkSpy).toHaveBeenCalledTimes(1);
        expect(String(unlinkSpy.mock.calls[0][0])).toContain('knowledge');
        expect(String(unlinkSpy.mock.calls[0][0])).toContain('goteborg_ullevi.json');
        expect(dbRun).toHaveBeenNthCalledWith(1, 'DELETE FROM offices WHERE routing_tag = ?', ['goteborg_ullevi'], expect.any(Function));
        expect(dbRun).toHaveBeenNthCalledWith(2, 'UPDATE users SET routing_tag = ? WHERE id = ?', ['malmo', 7], expect.any(Function));
        expect(dbRun).toHaveBeenNthCalledWith(3, 'UPDATE users SET routing_tag = ? WHERE id = ?', [null, 8], expect.any(Function));
        expect(dbAll).toHaveBeenCalledWith('SELECT id, routing_tag FROM users WHERE routing_tag LIKE ?', ['%goteborg_ullevi%'], expect.any(Function));
        expect(loadKnowledgeBase).toHaveBeenCalledTimes(1);
      });
    } finally {
      existsSpy.mockRestore();
      unlinkSpy.mockRestore();
      restore();
    }
  });

  it('lists uploaded files with customer metadata from context_store', async () => {
    const files = [{
      id: 1,
      conversation_id: 'conv-upload',
      filename: 'atlas_1.pdf',
      original_name: 'kund.pdf',
      uploaded_at: 1710000000,
      expires_at: 1710500000,
      filepath: 'C:/Atlas/uploads/atlas_1.pdf',
      customer_name: 'Kund Upload',
      customer_email: 'kund@example.com',
      subject: 'Bokning',
    }];
    const dbModule = {
      db: { run: vi.fn(), get: vi.fn(), all: vi.fn((sql, params, callback) => callback(null, files)) },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/uploaded-files', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ files });
      });
    } finally {
      restore();
    }
  });

  it('deletes a single uploaded file from disk and marks it deleted in SQL', async () => {
    const dbGet = vi.fn((sql, params, callback) => callback(null, { filepath: 'C:/Atlas/uploads/a.pdf' }));
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: dbGet, all: vi.fn() },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/uploaded-files/4', { method: 'DELETE' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbGet).toHaveBeenCalledWith('SELECT filepath FROM uploaded_files WHERE id = ?', ['4'], expect.any(Function));
        expect(unlinkSpy).toHaveBeenCalledWith('C:/Atlas/uploads/a.pdf');
        expect(dbRun).toHaveBeenCalledWith('UPDATE uploaded_files SET deleted = 1 WHERE id = ?', ['4'], expect.any(Function));
      });
    } finally {
      unlinkSpy.mockRestore();
      restore();
    }
  });

  it('bulk deletes uploaded files and reports how many active files were cleared', async () => {
    const dbAll = vi.fn((sql, params, callback) => callback(null, [
      { filepath: 'C:/Atlas/uploads/a.pdf' },
      { filepath: 'C:/Atlas/uploads/b.pdf' },
    ]));
    const dbRun = vi.fn((sql, params, callback) => callback(null));
    const dbModule = {
      db: { run: dbRun, get: vi.fn(), all: dbAll },
      getUserByUsername: vi.fn(),
      getContextRow: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [legacyEnginePath]: { loadKnowledgeBase: vi.fn() },
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: { hash: vi.fn() },
      [openaiPath]: vi.fn(),
    });
    router.init(buildAdminDeps());

    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/admin/uploaded-files', { method: 'DELETE' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true, deleted: 2 });
        expect(unlinkSpy).toHaveBeenCalledTimes(2);
        expect(dbRun).toHaveBeenCalledWith('UPDATE uploaded_files SET deleted = 1 WHERE deleted = 0', [], expect.any(Function));
      });
    } finally {
      unlinkSpy.mockRestore();
      restore();
    }
  });
});


