const express = require('express');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/templates.ts');
const dbPath = require.resolve('../../../db');
const authMiddlewarePath = require.resolve('../../../middleware/auth');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

function fakeAuth(req, res, next) {
  req.user = { id: 1, username: 'patrik', role: 'admin' };
  next();
}

describe('routes/templates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches template reads until the cache is invalidated', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    const getAllTemplates = vi.fn(async () => [{ id: 1, title: 'Svarsmall' }]);
    const db = {
      run: vi.fn((sql, params, callback) => {
        callback.call({ changes: 1, lastID: 1 }, null);
      }),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: { db, getAllTemplates },
      [authMiddlewarePath]: fakeAuth,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const first = await request('/api/templates', { method: 'GET' });
        const second = await request('/api/templates', { method: 'GET' });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(getAllTemplates).toHaveBeenCalledTimes(1);

        await request('/api/templates/save', {
          method: 'POST',
          body: { id: 1, title: 'Svarsmall', content: 'Hej', group_name: 'mail' },
        });

        const third = await request('/api/templates', { method: 'GET' });
        expect(third.status).toBe(200);
        expect(getAllTemplates).toHaveBeenCalledTimes(2);
      });
    } finally {
      restore();
    }
  });

  it('returns 404 when deleting a missing template through the REST delete endpoint', async () => {
    const getAllTemplates = vi.fn(async () => []);
    const db = {
      run: vi.fn((sql, params, callback) => {
        callback.call({ changes: 0 }, null);
      }),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: { db, getAllTemplates },
      [authMiddlewarePath]: fakeAuth,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/templates/delete/123', {
          method: 'DELETE',
        });

        expect(response.status).toBe(404);
        expect(response.json).toEqual({ error: 'Mall hittades inte' });
      });
    } finally {
      restore();
    }
  });
});
