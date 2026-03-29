const express = require('express');
const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');
const { withTestServer } = require('../../helpers/http-test-server');

const routePath = require.resolve('../../../routes/notes.ts');
const dbPath = require.resolve('../../../db');
const authMiddlewarePath = require.resolve('../../../middleware/auth');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

function fakeAuth(req, res, next) {
  req.user = {
    username: req.headers['x-test-user'] || 'patrik',
    role: req.headers['x-test-role'] || 'agent',
  };
  next();
}

describe('routes/notes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns internal notes for a ticket', async () => {
    const dbModule = {
      getTicketNotes: vi.fn(async () => [{ id: 1, content: 'Intern notering' }]),
      addTicketNote: vi.fn(),
      updateTicketNote: vi.fn(),
      deleteTicketNote: vi.fn(),
      getTicketNoteById: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/notes/conv-1', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(response.json).toEqual([{ id: 1, content: 'Intern notering' }]);
        expect(dbModule.getTicketNotes).toHaveBeenCalledWith('conv-1');
      });
    } finally {
      restore();
    }
  });

  it('creates a new internal note using the logged-in agent name', async () => {
    const dbModule = {
      getTicketNotes: vi.fn(),
      addTicketNote: vi.fn(async () => {}),
      updateTicketNote: vi.fn(),
      deleteTicketNote: vi.fn(),
      getTicketNoteById: vi.fn(),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/notes', {
          method: 'POST',
          body: { conversationId: 'conv-2', content: 'Följ upp med kund' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbModule.addTicketNote).toHaveBeenCalledWith('conv-2', 'patrik', 'Följ upp med kund');
      });
    } finally {
      restore();
    }
  });

  it('rejects updates for missing notes', async () => {
    const dbModule = {
      getTicketNotes: vi.fn(),
      addTicketNote: vi.fn(),
      updateTicketNote: vi.fn(),
      deleteTicketNote: vi.fn(),
      getTicketNoteById: vi.fn(async () => null),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/notes/11', {
          method: 'PUT',
          body: { content: 'Ny text' },
        });

        expect(response.status).toBe(404);
        expect(response.json).toEqual({ error: 'Note not found' });
      });
    } finally {
      restore();
    }
  });

  it('prevents non-admins from editing notes they do not own', async () => {
    const dbModule = {
      getTicketNotes: vi.fn(),
      addTicketNote: vi.fn(),
      updateTicketNote: vi.fn(),
      deleteTicketNote: vi.fn(),
      getTicketNoteById: vi.fn(async () => ({ id: 11, agent_name: 'anna' })),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/notes/11', {
          method: 'PUT',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'agent' },
          body: { content: 'Ny text' },
        });

        expect(response.status).toBe(403);
        expect(response.json).toEqual({ error: 'Access denied' });
        expect(dbModule.updateTicketNote).not.toHaveBeenCalled();
      });
    } finally {
      restore();
    }
  });

  it('allows admins to delete notes they do not own', async () => {
    const dbModule = {
      getTicketNotes: vi.fn(),
      addTicketNote: vi.fn(),
      updateTicketNote: vi.fn(),
      deleteTicketNote: vi.fn(async () => {}),
      getTicketNoteById: vi.fn(async () => ({ id: 11, agent_name: 'anna' })),
    };

    const { module: router, restore } = loadCjsWithMocks(routePath, {
      [dbPath]: dbModule,
      [authMiddlewarePath]: fakeAuth,
    });

    try {
      await withTestServer(createApp(router), async ({ request }) => {
        const response = await request('/api/notes/11', {
          method: 'DELETE',
          headers: { 'x-test-user': 'patrik', 'x-test-role': 'admin' },
        });

        expect(response.status).toBe(200);
        expect(response.json).toEqual({ success: true });
        expect(dbModule.deleteTicketNote).toHaveBeenCalledWith('11');
      });
    } finally {
      restore();
    }
  });
});
