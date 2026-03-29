const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');

const dbModulePath = require.resolve('../../../db.ts');
const sqlite3Path = require.resolve('sqlite3');

function createSqliteMock() {
  const fakeDb = {
    run: vi.fn(function run(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
      }

      if (callback) {
        callback.call({ changes: 1, lastID: 123 }, null);
      }

      return this;
    }),
    get: vi.fn((sql, params, callback) => {
      callback(null, null);
    }),
    all: vi.fn((sql, params, callback) => {
      callback(null, []);
    }),
    configure: vi.fn(),
    serialize: vi.fn((fn) => fn()),
    getAllTemplates: vi.fn(async () => []),
  };

  function Database() {
    return fakeDb;
  }

  return {
    sqlite3: { Database },
    fakeDb,
  };
}

describe('db.js', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses context_store JSON when loading a context row', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.get.mockImplementationOnce((sql, params, callback) => {
      callback(null, {
        conversation_id: 'conv-1',
        last_message_id: 3,
        context_data: '{"messages":[{"role":"user","content":"hej"}]}',
        updated_at: 100,
      });
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      const row = await module.getContextRow('conv-1');

      expect(row.context_data).toEqual({
        messages: [{ role: 'user', content: 'hej' }],
      });
    } finally {
      restore();
    }
  });

  it('stores context rows as JSON strings during upsert', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await module.upsertContextRow({
        conversation_id: 'conv-upsert',
        last_message_id: 7,
        context_data: { messages: [{ role: 'atlas', content: 'Svar' }] },
        updated_at: 123456,
      });

      const call = fakeDb.run.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO context_store'));
      expect(call[1][0]).toBe('conv-upsert');
      expect(call[1][1]).toBe(7);
      expect(call[1][2]).toBe('{"messages":[{"role":"atlas","content":"Svar"}]}');
      expect(call[1][3]).toBe(123456);
    } finally {
      restore();
    }
  });

  it('returns a safe default state when chat_v2_state does not exist', async () => {
    const { sqlite3 } = createSqliteMock();
    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      await expect(module.getV2State('missing-conv')).resolves.toEqual({
        conversation_id: 'missing-conv',
        human_mode: 0,
        owner: null,
        session_type: 'customer',
        updated_at: null,
      });
    } finally {
      restore();
    }
  });

  it('activates human mode with the provided session type and owner', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await module.setHumanMode('conv-human', 'message', 'patrik');

      const call = fakeDb.run.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO chat_v2_state'));
      expect(call[1][0]).toBe('conv-human');
      expect(call[1][1]).toBe('patrik');
      expect(call[1][2]).toBe('message');
      expect(typeof call[1][3]).toBe('number');
    } finally {
      restore();
    }
  });

  it('filters out disallowed flags before updating ticket metadata', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await module.updateTicketFlags('conv-2', {
        vehicle: 'MC',
        office: 'goteborg_ullevi',
        hacked_column: 'DROP TABLE',
      });

      const updateCall = fakeDb.run.mock.calls.find(([sql]) => String(sql).includes('UPDATE chat_v2_state'));
      expect(updateCall[0]).toContain('vehicle = ?');
      expect(updateCall[0]).toContain('office = ?');
      expect(updateCall[0]).not.toContain('hacked_column');
      expect(updateCall[1]).toEqual(expect.arrayContaining(['MC', 'goteborg_ullevi', 'conv-2']));
    } finally {
      restore();
    }
  });

  it('claims a ticket by inserting missing state and then forcing the owner', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.get.mockImplementation((sql, params, callback) => {
      if (String(sql).includes('SELECT owner FROM chat_v2_state')) {
        callback(null, { owner: 'old-owner' });
        return;
      }

      callback(null, null);
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await expect(module.claimTicket('conv-3', 'new-owner')).resolves.toBe(true);

      const sqlStatements = fakeDb.run.mock.calls.map(([sql]) => String(sql));
      expect(sqlStatements.some((sql) => sql.includes('INSERT OR IGNORE INTO chat_v2_state'))).toBe(true);
      expect(sqlStatements.some((sql) => sql.includes('SET owner = ?'))).toBe(true);
    } finally {
      restore();
    }
  });

  it('looks up users case-insensitively and resolves the inserted user id', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.get.mockImplementation((sql, params, callback) => {
      if (String(sql).includes('FROM users WHERE username = ?')) {
        callback(null, { username: 'patrik', routing_tag: 'goteborg_ullevi' });
        return;
      }
      callback(null, null);
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await expect(module.getUserByUsername('PATRIK')).resolves.toEqual({ username: 'patrik', routing_tag: 'goteborg_ullevi' });
      const getCall = fakeDb.get.mock.calls.find(([sql]) => String(sql).includes('FROM users WHERE username = ?'));
      expect(getCall[1]).toEqual(['patrik']);

      await expect(module.createUser('lisa', 'hash', 'agent', 'malmo', '#00ff00', 2)).resolves.toBe(123);
      const runCall = fakeDb.run.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO users'));
      expect(runCall[1]).toEqual(['lisa', 'hash', 'agent', 'malmo', '#00ff00', 2]);
    } finally {
      restore();
    }
  });

  it('loads agent tickets using both direct ownership and office tags', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.get.mockImplementation((sql, params, callback) => {
      if (String(sql).includes('FROM users WHERE username = ?')) {
        callback(null, { username: 'patrik', routing_tag: 'goteborg_ullevi,malmo_city' });
        return;
      }
      callback(null, null);
    });
    fakeDb.all.mockImplementation((sql, params, callback) => {
      callback(null, [{ conversation_id: 'conv-office' }]);
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      const rows = await module.getAgentTickets('patrik');

      expect(rows).toEqual([{ conversation_id: 'conv-office' }]);
      const allCall = fakeDb.all.mock.calls.find(([sql]) => String(sql).includes('FROM chat_v2_state s'));
      expect(allCall[0]).toContain('s.office IN (?,?)');
      expect(allCall[1]).toEqual(['patrik', 'patrik', 'goteborg_ullevi', 'malmo_city']);
    } finally {
      restore();
    }
  });

  it('supports ticket note CRUD helpers and note lookup by id', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.all.mockImplementation((sql, params, callback) => {
      if (String(sql).includes('FROM ticket_notes')) {
        callback(null, [{ id: 1, content: 'Första noten' }]);
        return;
      }
      callback(null, []);
    });
    fakeDb.get.mockImplementation((sql, params, callback) => {
      if (String(sql).includes('FROM ticket_notes WHERE id = ?')) {
        callback(null, { id: 9, agent_name: 'patrik', content: 'Finns' });
        return;
      }
      callback(null, null);
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await expect(module.getTicketNotes('conv-note')).resolves.toEqual([{ id: 1, content: 'Första noten' }]);
      await expect(module.addTicketNote('conv-note', 'patrik', 'Ny note')).resolves.toBe(123);
      await expect(module.updateTicketNote(9, 'Uppdaterad note')).resolves.toBeUndefined();
      await expect(module.deleteTicketNote(9)).resolves.toBeUndefined();
      await expect(module.getTicketNoteById(9)).resolves.toEqual({ id: 9, agent_name: 'patrik', content: 'Finns' });

      const sqlStatements = fakeDb.run.mock.calls.map(([sql]) => String(sql));
      expect(sqlStatements.some((sql) => sql.includes('INSERT INTO ticket_notes'))).toBe(true);
      expect(sqlStatements.some((sql) => sql.includes('UPDATE ticket_notes SET content = ?'))).toBe(true);
      expect(sqlStatements.some((sql) => sql.includes('DELETE FROM ticket_notes'))).toBe(true);
    } finally {
      restore();
    }
  });
  it('loads the team inbox with only active human-mode tickets', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.all.mockImplementationOnce((sql, params, callback) => {
      callback(null, [{ conversation_id: 'conv-inbox', human_mode: 1 }]);
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      const rows = await module.getTeamInbox();

      expect(rows).toEqual([{ conversation_id: 'conv-inbox', human_mode: 1 }]);
      const call = fakeDb.all.mock.calls.find(([sql]) => String(sql).includes('FROM chat_v2_state'));
      expect(call[0]).toContain('human_mode = 1');
      expect(call[0]).toContain("session_type != 'internal'");
      expect(call[1]).toEqual([]);
    } finally {
      restore();
    }
  });

  it('saves and deletes templates through the templates table', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await expect(module.saveTemplate({ id: 'tpl-1', title: 'Svar', group_name: 'allmant', content: 'Hej!', owner: 'patrik' })).resolves.toBeUndefined();
      await expect(module.deleteTemplate('tpl-1')).resolves.toBeUndefined();

      expect(fakeDb.run).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT OR REPLACE INTO templates'),
        ['tpl-1', 'Svar', 'allmant', 'Hej!', 'patrik'],
        expect.any(Function)
      );
      expect(fakeDb.run).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM templates WHERE id = ?',
        ['tpl-1'],
        expect.any(Function)
      );
    } finally {
      restore();
    }
  });

  it('stores, lists, archives and deletes local QA rows', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.all.mockImplementation((sql, params, callback) => {
      if (String(sql).includes('FROM local_qa_history')) {
        callback(null, [{ id: 'qa-1', question: 'Fraga', answer: 'Svar', is_archived: 0 }]);
        return;
      }
      callback(null, []);
    });
    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await expect(module.saveLocalQA({ id: 'qa-1', question: 'Fraga', answer: 'Svar', timestamp: 1234 })).resolves.toBeUndefined();
      await expect(module.getLocalQAHistory(10)).resolves.toEqual([{ id: 'qa-1', question: 'Fraga', answer: 'Svar', is_archived: 0 }]);
      await expect(module.updateQAArchivedStatus('qa-1', true)).resolves.toBeUndefined();
      await expect(module.deleteLocalQA('qa-1')).resolves.toBeUndefined();

      expect(fakeDb.run).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT OR REPLACE INTO local_qa_history'),
        ['qa-1', 'Fraga', 'Svar', 1234, 0],
        expect.any(Function)
      );
      expect(fakeDb.run).toHaveBeenNthCalledWith(
        2,
        'UPDATE local_qa_history SET is_archived = ? WHERE id = ?',
        [1, 'qa-1'],
        expect.any(Function)
      );
      expect(fakeDb.run).toHaveBeenNthCalledWith(
        3,
        'DELETE FROM local_qa_history WHERE id = ?',
        ['qa-1'],
        expect.any(Function)
      );
    } finally {
      restore();
    }
  });

  it('deletes a conversation transactionally and commits even if uploaded_files cleanup warns', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fakeDb.run.mockImplementation(function run(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      if (String(sql).includes('DELETE FROM uploaded_files')) {
        callback(new Error('upload cleanup failed'));
        return this;
      }
      if (callback) {
        callback.call({ changes: 1, lastID: 123 }, null);
      }
      return this;
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      await expect(module.deleteConversation('conv-delete')).resolves.toBe(true);
      const sqlStatements = fakeDb.run.mock.calls.map(([sql]) => String(sql));
      expect(sqlStatements).toEqual(expect.arrayContaining([
        'BEGIN TRANSACTION',
        'COMMIT',
        'DELETE FROM uploaded_files WHERE conversation_id = ?',
      ]));
      expect(warnSpy).toHaveBeenCalledWith('[Delete] uploaded_files fel:', 'upload cleanup failed');
      expect(logSpy.mock.calls.some(([message]) => String(message).includes('conv-delete'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
      restore();
    }
  });

  it('rolls back deleteConversation when an earlier delete fails', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.run.mockImplementation(function run(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      if (String(sql).includes('DELETE FROM context_store')) {
        callback(new Error('context delete failed'));
        return this;
      }
      if (callback) {
        callback.call({ changes: 1, lastID: 123 }, null);
      }
      return this;
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      await expect(module.deleteConversation('conv-fail')).rejects.toThrow('context delete failed');
      const sqlStatements = fakeDb.run.mock.calls.map(([sql]) => String(sql));
      expect(sqlStatements).toContain('ROLLBACK');
    } finally {
      restore();
    }
  });

  it('updates user passwords and profiles through targeted SQL helpers', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      fakeDb.run.mockClear();

      await expect(module.updateUserPassword('patrik', 'new-hash')).resolves.toBe(1);
      await expect(module.updateUserProfile(9, {
        agent_color: '#112233',
        avatar_id: 4,
        status_text: 'Tillganglig',
        routing_tag: 'goteborg_ullevi',
      })).resolves.toBeUndefined();

      expect(fakeDb.run).toHaveBeenNthCalledWith(
        1,
        'UPDATE users SET password_hash = ? WHERE username = ?',
        ['new-hash', 'patrik'],
        expect.any(Function)
      );
      expect(fakeDb.run).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE users SET agent_color = ?'),
        ['#112233', 4, 'Tillganglig', 'goteborg_ullevi', 9],
        expect.any(Function)
      );
    } finally {
      restore();
    }
  });

  it('loads office collections and office-enriched user rows', async () => {
    const { sqlite3, fakeDb } = createSqliteMock();
    fakeDb.all.mockImplementation((sql, params, callback) => {
      if (String(sql).includes('FROM offices ORDER BY name ASC')) {
        callback(null, [{ routing_tag: 'goteborg_ullevi', name: 'Goteborg Ullevi' }]);
        return;
      }
      callback(null, []);
    });
    fakeDb.get.mockImplementation((sql, params, callback) => {
      const sqlText = String(sql);
      if (sqlText.includes('FROM offices WHERE routing_tag = ?')) {
        callback(null, { routing_tag: 'goteborg_ullevi', city: 'Goteborg' });
        return;
      }
      if (sqlText.includes('LEFT JOIN offices o ON u.office_id = o.id')) {
        callback(null, { username: 'patrik', office_name: 'Goteborg Ullevi', office_color: '#ffaa00' });
        return;
      }
      callback(null, null);
    });

    const { module, restore } = loadCjsWithMocks(dbModulePath, {
      [sqlite3Path]: sqlite3,
    });

    try {
      await expect(module.getAllOffices()).resolves.toEqual([{ routing_tag: 'goteborg_ullevi', name: 'Goteborg Ullevi' }]);
      await expect(module.getOfficeByTag('goteborg_ullevi')).resolves.toEqual({ routing_tag: 'goteborg_ullevi', city: 'Goteborg' });
      await expect(module.getUserWithOffice('patrik')).resolves.toEqual({ username: 'patrik', office_name: 'Goteborg Ullevi', office_color: '#ffaa00' });

      expect(fakeDb.get.mock.calls.some(([sql]) => String(sql).includes('FROM offices WHERE routing_tag = ?'))).toBe(true);
      expect(fakeDb.get.mock.calls.some(([sql]) => String(sql).includes('LEFT JOIN offices o ON u.office_id = o.id'))).toBe(true);
    } finally {
      restore();
    }
  });
});

