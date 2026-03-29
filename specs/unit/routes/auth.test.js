const express = require('express');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/auth.ts');
const dbPath = require.resolve('../../../db');
const authMiddlewarePath = require.resolve('../../../middleware/auth');
const bcryptPath = require.resolve('bcrypt');
const jwtPath = require.resolve('jsonwebtoken');

function createAuthApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

function fakeAuth(req, res, next) {
  req.user = {
    id: 1,
    username: req.headers['x-test-user'] || 'patrik',
    role: req.headers['x-test-role'] || 'admin',
  };
  next();
}

describe('routes/auth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'jwt-secret';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    vi.restoreAllMocks();
  });

  it('logs in successfully and returns the signed token payload', async () => {
    const bcrypt = { compare: vi.fn(async () => true), hash: vi.fn(async () => 'hashed') };
    const jwt = { sign: vi.fn(() => 'signed-token') };
    const dbModule = {
      db: { get: vi.fn(), run: vi.fn() },
      getUserByUsername: vi.fn(async () => ({
        id: 7,
        username: 'patrik',
        password_hash: 'hash',
        role: 'admin',
        agent_color: '#123456',
        display_name: 'Patrik',
        avatar_id: 2,
        status_text: 'Online',
        routing_tag: 'goteborg_ullevi',
        allowed_views: ['inbox'],
      })),
      createUser: vi.fn(),
      updateUserPassword: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [jwtPath]: jwt,
    });

    try {
      await withTestServer(createAuthApp(router), async ({ request }) => {
        const response = await request('/api/auth/login', {
          method: 'POST',
          body: { username: 'patrik', password: 'secret' },
          headers: { 'x-forwarded-for': '127.0.0.1' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({
          token: 'signed-token',
          user: {
            id: 7,
            username: 'patrik',
            role: 'admin',
            agent_color: '#123456',
            display_name: 'Patrik',
            avatar_id: 2,
            status_text: 'Online',
            routing_tag: 'goteborg_ullevi',
            allowed_views: ['inbox'],
          },
        });
        expect(jwt.sign).toHaveBeenCalledWith(
          { id: 7, username: 'patrik', role: 'admin', routing_tag: 'goteborg_ullevi' },
          'jwt-secret',
          { expiresIn: '24h' }
        );
      });
    } finally {
      restore();
    }
  });

  it('rate-limits repeated failed logins from the same IP', async () => {
    const bcrypt = { compare: vi.fn(async () => false), hash: vi.fn(async () => 'hashed') };
    const jwt = { sign: vi.fn(() => 'signed-token') };
    const dbModule = {
      db: { get: vi.fn(), run: vi.fn() },
      getUserByUsername: vi.fn(async () => ({
        id: 7,
        username: 'patrik',
        password_hash: 'hash',
        role: 'admin',
      })),
      createUser: vi.fn(),
      updateUserPassword: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [jwtPath]: jwt,
    });

    try {
      await withTestServer(createAuthApp(router), async ({ request }) => {
        for (let attempt = 0; attempt < 5; attempt++) {
          const response = await request('/api/auth/login', {
            method: 'POST',
            body: { username: 'patrik', password: 'wrong' },
            headers: { 'x-forwarded-for': '203.0.113.10' },
          });
          expect(response.status).toBe(401);
        }

        const blocked = await request('/api/auth/login', {
          method: 'POST',
          body: { username: 'patrik', password: 'wrong' },
          headers: { 'x-forwarded-for': '203.0.113.10' },
        });

        expect(blocked.status).toBe(429);
        expect(blocked.json.error).toContain('F\u00F6r m\u00E5nga inloggningsf\u00F6rs\u00F6k');
      });
    } finally {
      restore();
    }
  });

  it('rejects password changes when the old password is wrong', async () => {
    const bcrypt = { compare: vi.fn(async () => false), hash: vi.fn(async () => 'hashed') };
    const jwt = { sign: vi.fn(() => 'signed-token') };
    const dbModule = {
      db: { get: vi.fn(), run: vi.fn() },
      getUserByUsername: vi.fn(async () => ({
        id: 7,
        username: 'patrik',
        password_hash: 'hash',
      })),
      createUser: vi.fn(),
      updateUserPassword: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [jwtPath]: jwt,
    });

    try {
      await withTestServer(createAuthApp(router), async ({ request }) => {
        const response = await request('/api/auth/change-password', {
          method: 'POST',
          body: { oldPassword: 'wrong', newPassword: 'new-secret' },
        });

        expect(response.status).toBe(401);
        expect(response.json).toEqual({ error: 'Fel nuvarande l\u00F6senord' });
        expect(dbModule.updateUserPassword).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('blocks /auth/seed when users already exist', async () => {
    const bcrypt = { compare: vi.fn(async () => false), hash: vi.fn(async () => 'hashed') };
    const jwt = { sign: vi.fn(() => 'signed-token') };
    const dbModule = {
      db: {
        get: vi.fn((sql, params, callback) => callback(null, { c: 2 })),
        run: vi.fn(),
      },
      getUserByUsername: vi.fn(),
      createUser: vi.fn(),
      updateUserPassword: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
      [bcryptPath]: bcrypt,
      [jwtPath]: jwt,
    });

    try {
      await withTestServer(createAuthApp(router), async ({ request }) => {
        const response = await request('/api/auth/seed', {
          method: 'POST',
          body: { username: 'atlas', password: 'secret' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Setup already complete' });
        expect(dbModule.createUser).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });
});
