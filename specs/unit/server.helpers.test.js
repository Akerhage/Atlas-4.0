const path = require('path');
const { loadSourceSnippets } = require('../helpers/load-source-snippets');

const serverPath = path.resolve(__dirname, '../../server.ts');

function loadServerHelpers(options = {}) {
  const snippets = [
    {
      start: 'function getWritablePath(relativePath) {',
      end: 'const SERVER_VERSION = "4.0";',
    },
    {
      start: 'function parseContextData(raw) {',
      end: 'let imapEnabled    = true;',
    },
    {
      start: 'let imapEnabled    = true;',
      end: '// === MAIL CONFIGURATION (NODEMAILER) ===',
    },
    {
      start: 'let mailTransporter = nodemailer.createTransport({',
      end: '// === AUTH DEPENDENCIES ===',
    },
    {
      start: 'async function generateAutoSubject(sessionId, contextData) {',
      end: 'async function runTsFallback({ query, responseText, result, v2State }) {',
    },
    {
      start: 'async function runTsFallback({ query, responseText, result, v2State }) {',
      end: 'async function handleChatMessage({',
    },
    {
      start: 'async function handleChatMessage({',
      end: 'function mergeContext(prev, next) {',
    },
    {
      start: 'function mergeContext(prev, next) {',
      end: "function assertValidContext(ctx, source = 'unknown') {",
    },
    {
      start: "function assertValidContext(ctx, source = 'unknown') {",
      end: '// EXPRESS & MIDDLEWARE SETUP',
    },
    {
      start: 'const extractEmail = (raw) => {',
      end: 'const senderEmail = extractEmail(fromRaw);',
    },
    {
      start: 'async function sendToLHC(chatId, message, retries = 3) {',
      end: '// Archive-routes (POST /search_all, POST+GET /api/inbox/*, GET /api/archive)',
    },
    {
      start: 'let isScanning = false;',
      end: 'const inactivityState = new Map();',
    },
    {
      start: 'async function checkChatInactivity() {',
      end: 'setInterval(checkChatInactivity, 60000);',
    },
    {
      start: 'function runDatabaseBackup() {',
      end: 'async function runUploadCleanup() {',
    },
    {
      start: 'async function runUploadCleanup() {',
      end: 'async function runMonthlyExport() {',
    },
    {
      start: 'async function runMonthlyExport() {',
      end: 'const BLOCKED_CONFIG_KEYS = [\'JWT_SECRET\', \'CLIENT_API_KEY\', \'NGROK_TOKEN\', \'LHC_WEBHOOK_SECRET\', \'GITHUB_TOKEN\'];',
    },
    {
      start: 'function getEnvPath() {',
      end: 'adminRoutes.init({ io, getEnvPath, getFilePaths, BLOCKED_CONFIG_KEYS, recreateMailTransporter,',
    },
  ];

  const exportNames = [
    'getWritablePath',
    'parseContextData',
    'getSetting',
    'setSetting',
    'loadEmailBlocklist',
    'loadOperationSettings',
    'recreateMailTransporter',
    'generateAutoSubject',
    'runTsFallback',
    'handleChatMessage',
    'mergeContext',
    'assertValidContext',
    'extractEmail',
    'extractName',
    'sendToLHC',
    'checkEmailReplies',
    'checkChatInactivity',
    'runDatabaseBackup',
    'runUploadCleanup',
    'runMonthlyExport',
    'getEnvPath',
    'getFilePaths',
  ];

  return loadSourceSnippets({
    filePath: serverPath,
    snippets,
    sandbox: {
      console: {
        warn: options.warn || vi.fn(),
        error: options.error || vi.fn(),
        log: options.log || vi.fn(),
      },
      path,
      Buffer,
      Date: options.DateOverride || Date,
      setTimeout: options.setTimeoutOverride || setTimeout,
      fs: options.fs || {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(() => []),
        statSync: vi.fn(() => ({ mtimeMs: 0 })),
        unlinkSync: vi.fn(),
      },
      fetch: options.fetch || vi.fn(),
      imapSimple: options.imapSimple || { connect: vi.fn(async () => ({ on: vi.fn(), openBox: vi.fn(async () => {}), search: vi.fn(async () => []), addFlags: vi.fn(async () => {}), end: vi.fn(async () => {}) })) },
      simpleParser: options.simpleParser || vi.fn(async () => ({ text: '', attachments: [] })),
      nodemailer: options.nodemailer || { createTransport: vi.fn(() => ({ kind: 'transport' })) },
      OpenAI: options.OpenAI || vi.fn(function MockOpenAI() { return { chat: { completions: { create: vi.fn() } } }; }),
      PDFDocument: options.PDFDocument || vi.fn(function MockPdfDocument() {
        return {
          on: vi.fn(),
          fontSize: vi.fn(function chain() { return this; }),
          text: vi.fn(function chain() { return this; }),
          moveDown: vi.fn(function chain() { return this; }),
          end: vi.fn(),
        };
      }),
      isPackaged: options.isPackaged ?? false,
      process: options.processOverride || { env: {} },
      __dirname: options.dirname || 'C:/Atlas',
      aiEnabled: options.aiEnabled ?? false,
      inactivityState: options.inactivityState || new Map(),
      autoHumanExit: options.autoHumanExit ?? false,
      db: options.db || { get: vi.fn(), run: vi.fn(), all: vi.fn() },
      backupPath: options.backupPath || path.join(options.dirname || 'C:/Atlas', 'backups'),
      getContextRow: options.getContextRow || vi.fn(async () => null),
      upsertContextRow: options.upsertContextRow || vi.fn(async () => {}),
      getV2State: options.getV2State || vi.fn(async () => null),
      setHumanMode: options.setHumanMode || vi.fn(async () => {}),
      getAllOffices: options.getAllOffices || vi.fn(async () => []),
      updateTicketFlags: options.updateTicketFlags || vi.fn(async () => {}),
      getAllTemplates: options.getAllTemplates || vi.fn(async () => []),
      runLegacyFlow: options.runLegacyFlow || vi.fn(async () => ({ response_payload: { answer: '' }, new_context: {} })),
      HUMAN_TRIGGERS: options.humanTriggers || ['människa', 'support', 'prata med'],
      HUMAN_RESPONSE_TEXT: options.humanResponseText || 'Jag kopplar in en mänsklig kollega direkt.',
      humanModeLocks: options.humanModeLocks || new Set(),
      io: options.io || { emit: vi.fn() },
      require: options.requireOverride || require,
    },
    exportExpression: `module.exports = { ${exportNames.join(', ')}, getEmailBlocklist: () => emailBlocklist, getMailTransporter: () => mailTransporter, getOperationSettingsState: () => ({ imapEnabled, imapInbound, backupInterval, backupPath, jwtExpiresIn, autoHumanExit, uploadTtlDays }), setAutoHumanExit: (value) => { autoHumanExit = value; }, setImapEnabled: (value) => { imapEnabled = value; }, setImapInbound: (value) => { imapInbound = value; }, setEmailBlocklist: (value) => { emailBlocklist = value; }, setIsScanning: (value) => { isScanning = value; }, getIsScanning: () => isScanning, getInactivityState: () => inactivityState };`,
  });
}

describe('server helpers', () => {
  it('builds writable paths from the app root in both dev and packaged mode', () => {
    const devHelpers = loadServerHelpers({
      isPackaged: false,
      dirname: 'C:/Atlas',
      processOverride: { env: { ATLAS_ROOT_PATH: 'C:/AtlasData' } },
    });
    const packagedHelpers = loadServerHelpers({
      isPackaged: true,
      dirname: 'C:/Atlas',
      processOverride: { env: { ATLAS_ROOT_PATH: 'D:/AtlasData' } },
    });

    expect(devHelpers.getWritablePath('backups/test.db')).toBe(path.join('C:/Atlas', 'backups/test.db'));
    expect(packagedHelpers.getWritablePath('backups/test.db')).toBe(path.join('D:/AtlasData', 'backups/test.db'));
  });

  it('normalizes missing or invalid context data into the default structure', () => {
    const { parseContextData } = loadServerHelpers();

    expect(parseContextData(null)).toEqual({
      messages: [],
      locked_context: { city: null, area: null, vehicle: null },
      linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
    });

    expect(parseContextData('{bad json')).toEqual({
      messages: [],
      locked_context: { city: null, area: null, vehicle: null },
      linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
    });
  });

  it('parses stored context and restores missing nested fields', () => {
    const { parseContextData } = loadServerHelpers();

    expect(parseContextData(JSON.stringify({ messages: 'bad', locked_context: null }))).toEqual({
      messages: [],
      locked_context: { city: null, area: null, vehicle: null },
      linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
    });

    expect(parseContextData({
      messages: [{ role: 'user', content: 'Hej' }],
      locked_context: { city: 'Goteborg', area: null, vehicle: 'BIL' },
      linksSentByVehicle: { CAR: true },
    })).toEqual({
      messages: [{ role: 'user', content: 'Hej' }],
      locked_context: { city: 'Goteborg', area: null, vehicle: 'BIL' },
      linksSentByVehicle: { CAR: true },
    });
  });

  it('reads and persists operation settings through the settings table helpers', async () => {
    const values = {
      imap_enabled: 'false',
      imap_inbound: 'true',
      backup_interval_hours: '12',
      jwt_expires_in: '48h',
      auto_human_exit: 'true',
      upload_ttl_days: '45',
    };
    const db = {
      get: vi.fn((sql, [key], callback) => callback(null, values[key] ? { value: values[key] } : null)),
      run: vi.fn(),
      all: vi.fn(),
    };
    const log = vi.fn();
    const helpers = loadServerHelpers({ db, log, dirname: 'C:/Atlas' });

    await expect(helpers.getSetting('jwt_expires_in', '24h')).resolves.toBe('48h');
    await expect(helpers.getSetting('backup_path', 'fallback')).resolves.toBe('fallback');

    helpers.setSetting('backup_interval_hours', 72);
    expect(db.run).toHaveBeenCalledWith(
      'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      ['backup_interval_hours', '72']
    );

    await helpers.loadOperationSettings();
    expect(helpers.getOperationSettingsState()).toEqual({
      imapEnabled: false,
      imapInbound: true,
      backupInterval: 12,
      backupPath: path.join('C:/Atlas', 'backups'),
      jwtExpiresIn: '48h',
      autoHumanExit: true,
      uploadTtlDays: 45,
    });
    expect(log.mock.calls.some(([message]) => String(message).includes('[Settings] IMAP:false'))).toBe(true);
  });

  it('loads the email blocklist from SQL rows and resets safely on errors', async () => {
    const log = vi.fn();
    const warn = vi.fn();
    const db = {
      all: vi.fn((sql, params, callback) => callback(null, [{ id: 1, pattern: '@spam.test', type: 'domain', added_by: 'admin' }])),
      get: vi.fn(),
      run: vi.fn(),
    };
    const helpers = loadServerHelpers({ db, log, warn });

    await helpers.loadEmailBlocklist();
    expect(helpers.getEmailBlocklist()).toEqual([{ id: 1, pattern: '@spam.test', type: 'domain', added_by: 'admin' }]);
    expect(log.mock.calls.some(([message]) => String(message).includes('[Blocklist] 1 poster'))).toBe(true);

    db.all.mockImplementationOnce((sql, params, callback) => callback(new Error('db down')));
    await helpers.loadEmailBlocklist();
    expect(helpers.getEmailBlocklist()).toEqual([]);
    expect(String(warn.mock.calls.at(-1)[0])).toContain('db down');
  });

  it('recreates the mail transporter with the latest env credentials', () => {
    const processOverride = { env: { EMAIL_USER: 'old@example.com', EMAIL_PASS: 'old-pass' } };
    const nodemailer = {
      createTransport: vi.fn((config) => ({ config })),
    };
    const log = vi.fn();
    const helpers = loadServerHelpers({ processOverride, nodemailer, log });

    processOverride.env.EMAIL_USER = 'new@example.com';
    processOverride.env.EMAIL_PASS = 'new-pass';
    helpers.recreateMailTransporter();

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    expect(nodemailer.createTransport.mock.calls[1][0].auth).toEqual({
      user: 'new@example.com',
      pass: 'new-pass',
    });
    expect(helpers.getMailTransporter().config.auth.user).toBe('new@example.com');
    expect(log.mock.calls.some(([message]) => String(message).includes('[HotReload] mailTransporter') && String(message).includes('new@example.com'))).toBe(true);
  });

  it('generates and stores an auto subject from the latest customer messages', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: 'MC-bokning Goteborg' } }],
    }));
    const OpenAI = vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create,
          },
        },
      };
    });
    const getContextRow = vi.fn(async () => ({
      last_message_id: 'msg-9',
      context_data: {
        locked_context: {},
        messages: [{ role: 'user', content: 'Hej' }],
      },
    }));
    const upsertContextRow = vi.fn(async () => {});
    const DateOverride = { now: () => 1710000000000 };
    const log = vi.fn();
    const helpers = loadServerHelpers({
      OpenAI,
      getContextRow,
      upsertContextRow,
      DateOverride,
      log,
      processOverride: { env: { OPENAI_API_KEY: 'openai-key' } },
    });

    await helpers.generateAutoSubject('conv-1', {
      locked_context: {},
      messages: [
        { role: 'user', content: 'Jag vill boka MC-lektion i Goteborg' },
        { role: 'atlas', content: 'Absolut' },
        { role: 'user', content: 'Vilka tider finns?' },
      ],
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(getContextRow).toHaveBeenCalledWith('conv-1');
    expect(upsertContextRow).toHaveBeenCalledWith({
      conversation_id: 'conv-1',
      last_message_id: 'msg-9',
      context_data: {
        locked_context: { subject: 'MC-bokning Goteborg' },
        messages: [{ role: 'user', content: 'Hej' }],
      },
      updated_at: 1710000000,
    });
    expect(log.mock.calls.some(([message]) => String(message).includes('[AUTO-SUBJECT] conv-1'))).toBe(true);
  });

  it('skips auto subject generation when subject already exists or API key is missing', async () => {
    const create = vi.fn();
    const OpenAI = vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create,
          },
        },
      };
    });

    const noKeyHelpers = loadServerHelpers({ OpenAI, processOverride: { env: {} } });
    await expect(noKeyHelpers.generateAutoSubject('conv-2', { locked_context: {}, messages: [] })).resolves.toBeUndefined();

    const existingSubjectHelpers = loadServerHelpers({
      OpenAI,
      processOverride: { env: { OPENAI_API_KEY: 'openai-key' } },
    });
    await expect(existingSubjectHelpers.generateAutoSubject('conv-2', {
      locked_context: { subject: 'Finns redan' },
      messages: [{ role: 'user', content: 'Hej' }],
    })).resolves.toBeUndefined();

    expect(create).not.toHaveBeenCalled();
  });

  it('returns the original answer when TS fallback is disabled or the answer is not a miss', async () => {
    const db = { get: vi.fn(), run: vi.fn(), all: vi.fn() };
    const { runTsFallback } = loadServerHelpers({ aiEnabled: false, db });
    const result = { response_payload: { answer: 'Originalt svar' } };

    await expect(runTsFallback({
      query: 'Hej',
      responseText: 'Originalt svar',
      result,
      v2State: { session_type: 'customer' },
    })).resolves.toBe('Originalt svar');
    expect(db.run).not.toHaveBeenCalled();
  });

  it('replaces low-confidence responses with a sourced Transportstyrelsen answer and logs the attempt', async () => {
    const db = { get: vi.fn(), run: vi.fn((sql, params, callback) => callback(null)), all: vi.fn() };
    const classifyRegulatoryTopic = vi.fn(() => 'https://www.transportstyrelsen.se/test');
    const tryTransportstyrelseFallback = vi.fn(async () => 'TS-svar');
    const requireOverride = (moduleId) => {
      if (moduleId === './utils/transportstyrelsen-fallback') {
        return { classifyRegulatoryTopic, tryTransportstyrelseFallback };
      }
      return require(moduleId);
    };
    const { runTsFallback } = loadServerHelpers({ aiEnabled: true, db, requireOverride, processOverride: { env: { OPENAI_API_KEY: 'openai-key' } } });
    const result = { response_payload: { answer: 'ingen information om detta' } };

    const finalAnswer = await runTsFallback({
      query: 'Hur länge gäller körkortstillståndet?',
      responseText: 'ingen information om detta',
      result,
      v2State: { session_type: 'customer' },
    });

    expect(finalAnswer).toBe('TS-svar');
    expect(result.response_payload.answer).toBe('TS-svar');
    expect(classifyRegulatoryTopic).toHaveBeenCalledWith('Hur länge gäller körkortstillståndet?');
    expect(tryTransportstyrelseFallback).toHaveBeenCalledWith('Hur länge gäller körkortstillståndet?');
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO rag_failures'),
      ['Hur länge gäller körkortstillståndet?', 'customer', 1, 1, 'https://www.transportstyrelsen.se/test'],
      expect.any(Function)
    );
  });

  it('merges context without clobbering previous state when the next payload is partial', () => {
    const { mergeContext } = loadServerHelpers();
    const prev = {
      messages: [{ role: 'user', content: 'Hej' }],
      locked_context: { city: 'Malmo', area: null, vehicle: 'BIL' },
      linksSentByVehicle: { CAR: true },
    };

    expect(mergeContext(prev, null)).toBe(prev);
    expect(mergeContext(prev, { locked_context: { city: 'Goteborg', area: 'Ullevi', vehicle: 'MC' } })).toEqual({
      messages: prev.messages,
      locked_context: { city: 'Goteborg', area: 'Ullevi', vehicle: 'MC' },
      linksSentByVehicle: prev.linksSentByVehicle,
    });
    expect(mergeContext(prev, { messages: [{ role: 'atlas', content: 'Svar' }], linksSentByVehicle: { MC: true } })).toEqual({
      messages: [{ role: 'atlas', content: 'Svar' }],
      locked_context: prev.locked_context,
      linksSentByVehicle: { MC: true },
    });
  });

  it('throws on null context and warns when nested structures are missing', () => {
    const warn = vi.fn();
    const { assertValidContext } = loadServerHelpers({ warn });

    expect(() => assertValidContext(null, 'unit-test')).toThrow('Ogiltigt context-objekt');

    assertValidContext({ messages: [], locked_context: null, linksSentByVehicle: null }, 'partial-test');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('extracts sender email and sender name from raw mail headers', () => {
    const { extractEmail, extractName } = loadServerHelpers();

    expect(extractEmail('Atlas Kund <kund@example.com>')).toBe('kund@example.com');
    expect(extractEmail(' KUND@EXAMPLE.COM ')).toBe('kund@example.com');
    expect(extractName('"Atlas Kund" <kund@example.com>')).toBe('Atlas Kund');
    expect(extractName('kund@example.com')).toBeNull();
  });

  it('skips LHC sends when config is incomplete and posts authenticated payloads when enabled', async () => {
    const missingFetch = vi.fn();
    const { sendToLHC: withoutConfig } = loadServerHelpers({
      processOverride: { env: { LHC_WEBHOOK_SECRET: 'temp_secret_12345' } },
      fetch: missingFetch,
    });
    await expect(withoutConfig('chat-1', 'Hej')).resolves.toBeUndefined();
    expect(missingFetch).not.toHaveBeenCalled();

    const successFetch = vi.fn(async () => ({ ok: true }));
    const { sendToLHC: withConfig } = loadServerHelpers({
      processOverride: {
        env: {
          LHC_API_URL: 'https://lhc.example',
          LHC_API_USER: 'atlas-user',
          LHC_API_KEY: 'atlas-key',
          LHC_WEBHOOK_SECRET: 'real-secret',
        },
      },
      fetch: successFetch,
    });

    await expect(withConfig('chat-2', { answer: 'Atlas svar' })).resolves.toBeUndefined();
    expect(successFetch).toHaveBeenCalledWith('https://lhc.example/restapi/v2/chat/sendmessage/chat-2', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from('atlas-user:atlas-key').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ msg: 'Atlas svar' }),
    });
  });

  it('retries failed LHC sends and logs once on the final failure', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const setTimeoutOverride = vi.fn((callback) => {
      callback();
      return 0;
    });
    const log = vi.fn();
    const { sendToLHC } = loadServerHelpers({
      processOverride: {
        env: {
          LHC_API_URL: 'https://lhc.example',
          LHC_API_USER: 'atlas-user',
          LHC_API_KEY: 'atlas-key',
          LHC_WEBHOOK_SECRET: 'real-secret',
        },
      },
      fetch,
      setTimeoutOverride,
      log,
    });

    await expect(sendToLHC('chat-3', 'Hej', 3)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(setTimeoutOverride).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.some(([message]) => String(message).includes('chat-3') && String(message).includes('[LHC]'))).toBe(true);
  });
  it('skips email polling when an IMAP scan is already in progress', async () => {
    const connect = vi.fn();
    const helpers = loadServerHelpers({ imapSimple: { connect } });
    helpers.setIsScanning(true);

    await helpers.checkEmailReplies();

    expect(connect).not.toHaveBeenCalled();
    expect(helpers.getIsScanning()).toBe(true);
  });

  it('marks malformed IMAP messages as seen when the header block is missing', async () => {
    const connection = {
      on: vi.fn(),
      openBox: vi.fn(async () => {}),
      search: vi.fn(async () => [{ parts: [], attributes: { uid: 101 } }]),
      addFlags: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
    };
    const helpers = loadServerHelpers({ imapSimple: { connect: vi.fn(async () => connection) } });

    await helpers.checkEmailReplies();

    expect(connection.addFlags).toHaveBeenCalledWith(101, '\\Seen');
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(helpers.getIsScanning()).toBe(false);
  });

  it('ignores outgoing echo emails from Atlas itself', async () => {
    const connection = {
      on: vi.fn(),
      openBox: vi.fn(async () => {}),
      search: vi.fn(async () => [{
        parts: [{ which: 'HEADER', body: { from: ['Atlas <atlas@example.com>'], subject: ['Svar'] } }],
        attributes: { uid: 202 },
      }]),
      addFlags: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
    };
    const helpers = loadServerHelpers({
      imapSimple: { connect: vi.fn(async () => connection) },
      processOverride: { env: { EMAIL_USER: 'atlas@example.com', EMAIL_PASS: 'secret' } },
    });

    await helpers.checkEmailReplies();

    expect(connection.addFlags).toHaveBeenCalledWith(202, '\\Seen');
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  it('drops blocklisted senders before any ticket matching or parsing happens', async () => {
    const simpleParser = vi.fn();
    const connection = {
      on: vi.fn(),
      openBox: vi.fn(async () => {}),
      search: vi.fn(async () => [{
        parts: [{ which: 'HEADER', body: { from: ['Spam <offer@spam.test>'], subject: ['Kampanj'] } }],
        attributes: { uid: 303 },
      }]),
      addFlags: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
    };
    const helpers = loadServerHelpers({
      imapSimple: { connect: vi.fn(async () => connection) },
      simpleParser,
      processOverride: { env: { EMAIL_USER: 'atlas@example.com', EMAIL_PASS: 'secret' } },
    });
    helpers.setEmailBlocklist([{ pattern: '@spam.test', type: 'domain' }]);

    await helpers.checkEmailReplies();

    expect(connection.addFlags).toHaveBeenCalledWith(303, '\\Seen');
    expect(simpleParser).not.toHaveBeenCalled();
  });

  it('ignores uncoupled inbound emails when IMAP inbound creation is disabled', async () => {
    const simpleParser = vi.fn();
    const connection = {
      on: vi.fn(),
      openBox: vi.fn(async () => {}),
      search: vi.fn(async () => [{
        parts: [{ which: 'HEADER', body: { from: ['Kund <kund@example.com>'], subject: ['Ny fråga'] } }],
        attributes: { uid: 404 },
      }]),
      addFlags: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
    };
    const helpers = loadServerHelpers({
      imapSimple: { connect: vi.fn(async () => connection) },
      simpleParser,
      processOverride: { env: { EMAIL_USER: 'atlas@example.com', EMAIL_PASS: 'secret' } },
    });
    helpers.setImapInbound(false);
    helpers.setImapEnabled(false);

    await helpers.checkEmailReplies();

    expect(connection.addFlags).toHaveBeenCalledWith(404, '\\Seen');
    expect(simpleParser).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledTimes(1);
  });
  it('marks existing ticket emails as seen when the parsed body is effectively empty', async () => {
    const simpleParser = vi.fn(async () => ({ text: ' ', attachments: [] }));
    const connection = {
      on: vi.fn(),
      openBox: vi.fn(async () => {}),
      search: vi.fn(async () => [{
        parts: [
          { which: 'HEADER', body: { from: ['Kund <kund@example.com>'], subject: ['[Ärende: ABC123] Hej'], 'message-id': ['msg-1'] } },
          { which: '', body: 'raw-mail' },
        ],
        attributes: { uid: 505 },
      }]),
      addFlags: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
    };
    const getV2State = vi.fn(async () => ({ is_archived: 0 }));
    const getContextRow = vi.fn(async () => null);
    const upsertContextRow = vi.fn(async () => {});
    const helpers = loadServerHelpers({
      imapSimple: { connect: vi.fn(async () => connection) },
      simpleParser,
      getV2State,
      getContextRow,
      upsertContextRow,
      processOverride: { env: { EMAIL_USER: 'atlas@example.com', EMAIL_PASS: 'secret' } },
    });

    await helpers.checkEmailReplies();

    expect(simpleParser).toHaveBeenCalledWith('raw-mail');
    expect(connection.addFlags).toHaveBeenCalledWith(505, '\\Seen');
    expect(getV2State).not.toHaveBeenCalled();
    expect(getContextRow).not.toHaveBeenCalled();
    expect(upsertContextRow).not.toHaveBeenCalled();
  });

  it('revives archived ticket emails, appends the customer reply and emits inbox updates', async () => {
    class FixedDate extends Date {
      static now() {
        return 1710000000000;
      }
    }

    const simpleParser = vi.fn(async () => ({ text: 'Hej från kunden', attachments: [] }));
    const connection = {
      on: vi.fn(),
      openBox: vi.fn(async () => {}),
      search: vi.fn(async () => [{
        parts: [
          { which: 'HEADER', body: { from: ['Kund <kund@example.com>'], subject: ['[Ärende: ABC123] Hej'], 'message-id': ['msg-2'] } },
          { which: '', body: 'raw-mail-2' },
        ],
        attributes: { uid: 606 },
      }]),
      addFlags: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
    };
    const db = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        callback?.(null);
      }),
    };
    const io = { emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) };
    const getV2State = vi.fn(async () => ({ is_archived: 1 }));
    const getContextRow = vi.fn(async () => ({
      last_message_id: 4,
      context_data: {
        messages: [{ role: 'atlas', content: 'Hej!' }],
        locked_context: { city: 'Goteborg' },
      },
    }));
    const upsertContextRow = vi.fn(async () => {});
    const helpers = loadServerHelpers({
      DateOverride: FixedDate,
      imapSimple: { connect: vi.fn(async () => connection) },
      simpleParser,
      db,
      io,
      getV2State,
      getContextRow,
      upsertContextRow,
      processOverride: { env: { EMAIL_USER: 'atlas@example.com', EMAIL_PASS: 'secret' } },
    });

    await helpers.checkEmailReplies();

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE chat_v2_state'),
      [1710000000, 'ABC123'],
      expect.any(Function)
    );
    expect(upsertContextRow).toHaveBeenCalledWith({
      conversation_id: 'ABC123',
      last_message_id: 5,
      context_data: {
        messages: [
          { role: 'atlas', content: 'Hej!' },
          {
            role: 'user',
            content: 'Hej från kunden',
            timestamp: 1710000000000,
            messageId: 'msg-2',
            isEmail: true,
          },
        ],
        locked_context: { city: 'Goteborg' },
      },
      updated_at: 1710000000,
    });
    expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'new_message', sessionId: 'ABC123' });
    expect(io.emit).toHaveBeenCalledWith('team:customer_reply', expect.objectContaining({
      conversationId: 'ABC123',
      sender: 'user',
      isEmail: true,
    }));
    expect(connection.addFlags).toHaveBeenCalledWith(606, '\\Seen');
  });
  it('creates a new inbound mail ticket when no ticket id exists and IMAP inbound is enabled', async () => {
    class FixedDate extends Date {
      static now() {
        return 1710000000000;
      }
    }

    const simpleParser = vi.fn(async () => ({ text: 'Hej från nytt mail', attachments: [] }));
    const connection = {
      on: vi.fn(),
      openBox: vi.fn(async () => {}),
      search: vi.fn(async () => [{
        parts: [
          { which: 'HEADER', body: { from: ['Lisa Kund <lisa@example.com>'], subject: ['Ny fråga från kund'], 'message-id': ['msg-new'] } },
          { which: '', body: 'raw-mail-new' },
        ],
        attributes: { uid: 707 },
      }]),
      addFlags: vi.fn(async () => {}),
      end: vi.fn(async () => {}),
    };
    const db = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        callback?.(null);
      }),
    };
    const io = { emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) };
    const upsertContextRow = vi.fn(async () => {});
    const getContextRow = vi.fn(async () => ({
      last_message_id: 0,
      context_data: {
        messages: [],
        locked_context: {
          name: 'Lisa Kund',
          email: 'lisa@example.com',
          subject: 'Ny fråga från kund',
        },
      },
    }));
    const getV2State = vi.fn(async () => ({ is_archived: 0 }));
    const requireOverride = (moduleId) => {
      if (moduleId === 'crypto') {
        return { randomUUID: () => 'abcd1234-ffff-eeee-dddd-ccccbbbb0000' };
      }
      return require(moduleId);
    };
    const helpers = loadServerHelpers({
      DateOverride: FixedDate,
      imapSimple: { connect: vi.fn(async () => connection) },
      simpleParser,
      db,
      io,
      upsertContextRow,
      getContextRow,
      getV2State,
      requireOverride,
      processOverride: { env: { EMAIL_USER: 'atlas@example.com', EMAIL_PASS: 'secret' } },
    });
    helpers.setImapInbound(true);
    helpers.setImapEnabled(true);

    await helpers.checkEmailReplies();

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, 'message', 1, NULL, NULL, ?, ?, ?, 'imap', 0)"),
      ['MAIL_INBOUND_ABCD1234', 1710000000, 'Lisa Kund', 'lisa@example.com'],
      expect.any(Function)
    );
    expect(upsertContextRow).toHaveBeenNthCalledWith(1, {
      conversation_id: 'MAIL_INBOUND_ABCD1234',
      last_message_id: 0,
      context_data: {
        messages: [],
        locked_context: {
          name: 'Lisa Kund',
          email: 'lisa@example.com',
          subject: 'Ny fråga från kund',
        },
      },
      updated_at: 1710000000,
    });
    expect(upsertContextRow).toHaveBeenNthCalledWith(2, {
      conversation_id: 'MAIL_INBOUND_ABCD1234',
      last_message_id: 1,
      context_data: {
        messages: [
          {
            role: 'user',
            content: 'Hej från nytt mail',
            timestamp: 1710000000000,
            messageId: 'msg-new',
            isEmail: true,
          },
        ],
        locked_context: {
          name: 'Lisa Kund',
          email: 'lisa@example.com',
          subject: 'Ny fråga från kund',
        },
      },
      updated_at: 1710000000,
    });
    expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'new_message', sessionId: 'MAIL_INBOUND_ABCD1234' });
    expect(connection.addFlags).toHaveBeenCalledWith(707, '\\Seen');
  });
  it('sends an inactivity warning once when an AI session waits too long for the customer', async () => {
    class FixedDate extends Date {
      static now() {
        return 1710000000000;
      }
    }

    const roomEmit = vi.fn();
    const io = {
      emit: vi.fn(),
      to: vi.fn(() => ({ emit: roomEmit })),
    };
    const db = {
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn((sql, params, callback) => callback(null, [
        {
          conversation_id: 'conv-warn',
          updated_at: 1710000000 - (16 * 60),
          human_mode: 0,
          context_data: { messages: [{ role: 'atlas', content: 'Hur kan jag hjälpa dig?' }] },
        },
      ])),
    };
    const helpers = loadServerHelpers({ DateOverride: FixedDate, db, io, inactivityState: new Map() });

    await helpers.checkChatInactivity();

    expect(io.to).toHaveBeenCalledWith('conv-warn');
    expect(roomEmit).toHaveBeenCalledWith('team:session_warning', {
      conversationId: 'conv-warn',
      sessionId: 'conv-warn',
      minutesLeft: 5,
    });
    expect(helpers.getInactivityState().get('conv-warn')).toEqual({ warningSentAt: 1710000000 });
    expect(db.run).not.toHaveBeenCalled();
  });

  it('archives inactive sessions atomically and notifies both team and customer', async () => {
    class FixedDate extends Date {
      static now() {
        return 1710000000000;
      }
    }

    const roomEmit = vi.fn();
    const io = {
      emit: vi.fn(),
      to: vi.fn(() => ({ emit: roomEmit })),
    };
    const db = {
      get: vi.fn(),
      run: vi.fn((sql, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        callback?.(null);
      }),
      all: vi.fn((sql, params, callback) => callback(null, [
        {
          conversation_id: 'conv-archive',
          updated_at: 1710000000 - (21 * 60),
          human_mode: 0,
          context_data: { messages: [{ role: 'agent', content: 'Vi väntar på dig.' }] },
        },
      ])),
    };
    const helpers = loadServerHelpers({ DateOverride: FixedDate, db, io, inactivityState: new Map() });

    await helpers.checkChatInactivity();

    expect(db.run).toHaveBeenCalledWith('BEGIN TRANSACTION', expect.any(Function));
    expect(db.run).toHaveBeenCalledWith(
      "UPDATE chat_v2_state SET is_archived = 1, close_reason = 'inactivity', updated_at = ? WHERE conversation_id = ?",
      [1710000000, 'conv-archive'],
      expect.any(Function)
    );
    expect(db.run).toHaveBeenCalledWith("UPDATE local_qa_history SET is_archived = 1 WHERE id = ?", ['conv-archive'], expect.any(Function));
    expect(db.run).toHaveBeenCalledWith('COMMIT', expect.any(Function));
    expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'ticket_archived', sessionId: 'conv-archive' });
    expect(roomEmit).toHaveBeenCalledWith('team:session_status', {
      conversationId: 'conv-archive',
      status: 'archived',
      close_reason: 'inactivity',
      message: 'Chatten har stängts automatiskt på grund av inaktivitet.',
    });
    expect(helpers.getInactivityState().has('conv-archive')).toBe(false);
  });

  it('resets warning state when the customer becomes active again and clears stale entries', async () => {
    class FixedDate extends Date {
      static now() {
        return 1710000000000;
      }
    }

    const inactivityState = new Map([
      ['conv-reset', { warningSentAt: 1709999000 }],
      ['stale-session', { warningSentAt: 1709998000 }],
    ]);
    const helpers = loadServerHelpers({
      DateOverride: FixedDate,
      inactivityState,
      db: {
        get: vi.fn(),
        run: vi.fn(),
        all: vi.fn((sql, params, callback) => callback(null, [
          {
            conversation_id: 'conv-reset',
            updated_at: 1710000000 - (5 * 60),
            human_mode: 0,
            context_data: { messages: [{ role: 'atlas', content: 'Svara gärna här.' }] },
          },
        ])),
      },
    });

    await helpers.checkChatInactivity();

    expect(helpers.getInactivityState().get('conv-reset')).toEqual({ warningSentAt: null });
    expect(helpers.getInactivityState().has('stale-session')).toBe(false);
  });

  it('turns off lingering human mode when auto-exit is enabled and an agent has no open tickets left', async () => {
    const io = { emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) };
    const db = {
      run: vi.fn(),
      get: vi.fn((sql, params, callback) => callback(null, { cnt: 0 })),
      all: vi.fn((sql, params, callback) => {
        if (String(sql).includes('SELECT DISTINCT owner')) {
          callback(null, [{ owner: 'agent-1' }]);
          return;
        }
        callback(null, []);
      }),
    };
    const helpers = loadServerHelpers({ db, io, inactivityState: new Map() });
    helpers.setAutoHumanExit(true);

    await helpers.checkChatInactivity();

    expect(db.run).toHaveBeenCalledWith('UPDATE chat_v2_state SET human_mode=0 WHERE owner=? AND is_archived=0', ['agent-1']);
    expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'human_mode_triggered', sessionId: null });
  });
  it('writes a database backup, creates the backup directory and prunes old files', () => {
    class FixedDate extends Date {
      constructor(...args) {
        super(...(args.length ? args : ['2026-03-27T10:11:12.000Z']));
      }
      static now() {
        return new Date('2026-03-27T10:11:12.000Z').getTime();
      }
    }

    const fs = {
      existsSync: vi.fn((target) => target !== path.join('C:/Atlas', 'backups')),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => Array.from({ length: 16 }, (_, index) => 'atlas_' + String(index + 1).padStart(2, '0') + '.db')),
      statSync: vi.fn((target) => {
        const fileName = path.basename(target);
        const order = Number(fileName.match(/(\d+)/)[1]);
        return { mtimeMs: 1000 - order };
      }),
      unlinkSync: vi.fn(),
    };
    const db = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn((sql, callback) => callback(null)),
    };
    const log = vi.fn();
    const helpers = loadServerHelpers({
      DateOverride: FixedDate,
      fs,
      db,
      log,
    });

    helpers.runDatabaseBackup();

    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('C:/Atlas', 'backups'), { recursive: true });
    expect(db.run).toHaveBeenCalledWith(
      "VACUUM INTO 'C:\\Atlas\\backups\\atlas_2026-03-27T10-11.db'",
      expect.any(Function)
    );
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join('C:/Atlas', 'backups', 'atlas_15.db'));
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join('C:/Atlas', 'backups', 'atlas_16.db'));
    expect(log.mock.calls.some(([message]) => String(message).includes('[Backup] atlas.db'))).toBe(true);
  });

  it('logs backup failures from VACUUM and cleanup without throwing', () => {
    const error = vi.fn();
    const fs = {
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => {
        throw new Error('cleanup failed');
      }),
      statSync: vi.fn(),
      unlinkSync: vi.fn(),
    };
    const db = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn((sql, callback) => callback(new Error('vacuum failed'))),
    };
    const helpers = loadServerHelpers({ fs, db, error });

    expect(() => helpers.runDatabaseBackup()).not.toThrow();
    expect(error.mock.calls.some((args) => String(args[0]).includes('[Backup] Fel:') && String(args[1]).includes('vacuum failed'))).toBe(true);

    db.run.mockImplementationOnce((sql, callback) => callback(null));
    helpers.runDatabaseBackup();
    expect(error.mock.calls.some((args) => String(args[0]).includes('[Backup] Rensning misslyckades:') && String(args[1]).includes('cleanup failed'))).toBe(true);
  });

  it('marks expired uploads as deleted and removes files from disk when present', async () => {
    const fs = {
      existsSync: vi.fn((target) => target === 'C:/Atlas/uploads/one.pdf'),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => ({ mtimeMs: 0 })),
      unlinkSync: vi.fn(),
    };
    const db = {
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn((sql, params, callback) => callback(null, [
        { id: 1, filepath: 'C:/Atlas/uploads/one.pdf', filename: 'one.pdf' },
        { id: 2, filepath: 'C:/Atlas/uploads/two.pdf', filename: 'two.pdf' },
      ])),
    };
    const log = vi.fn();
    const DateOverride = { now: () => 1710000000000 };
    const helpers = loadServerHelpers({ fs, db, log, DateOverride });

    await helpers.runUploadCleanup();

    expect(db.all).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, filepath, filename FROM uploaded_files'),
      [1710000000],
      expect.any(Function)
    );
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith('C:/Atlas/uploads/one.pdf');
    expect(db.run).toHaveBeenCalledTimes(2);
    expect(db.run).toHaveBeenNthCalledWith(1, 'UPDATE uploaded_files SET deleted = 1 WHERE id = ?', [1]);
    expect(db.run).toHaveBeenNthCalledWith(2, 'UPDATE uploaded_files SET deleted = 1 WHERE id = ?', [2]);
    expect(log.mock.calls.some(([message]) => String(message).includes('[Upload-Cleanup]') && String(message).includes('2'))).toBe(true);
  });

  it('warns on upload cleanup database and filesystem failures', async () => {
    const warn = vi.fn();
    const fs = {
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => ({ mtimeMs: 0 })),
      unlinkSync: vi.fn(() => {
        throw new Error('locked');
      }),
    };
    const db = {
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    };
    const helpers = loadServerHelpers({ fs, db, warn });

    db.all.mockImplementationOnce((sql, params, callback) => callback(new Error('db broke')));
    await helpers.runUploadCleanup();
    expect(warn.mock.calls.some((args) => String(args[0]).includes('[Upload-Cleanup] DB-fel:') && String(args[1]).includes('db broke'))).toBe(true);

    db.all.mockImplementationOnce((sql, params, callback) => callback(null, [{ id: 5, filepath: 'C:/Atlas/uploads/five.pdf', filename: 'five.pdf' }]));
    await helpers.runUploadCleanup();
    expect(warn.mock.calls.some((args) => String(args[0]).includes('Kunde inte radera C:/Atlas/uploads/five.pdf') && String(args[1]).includes('locked'))).toBe(true);
  });

  it('generates a monthly export pdf and emails it without AI when OpenAI is disabled', async () => {
    class FixedDate extends Date {
      constructor(...args) {
        super(...(args.length ? args : ['2026-03-27T10:11:12.000Z']));
      }
      static now() {
        return new Date('2026-03-27T10:11:12.000Z').getTime();
      }
    }

    const events = {};
    const pdfDoc = {
      on: vi.fn((event, handler) => {
        events[event] = handler;
        return pdfDoc;
      }),
      fontSize: vi.fn(() => pdfDoc),
      text: vi.fn(() => pdfDoc),
      moveDown: vi.fn(() => pdfDoc),
      end: vi.fn(() => {
        events.data?.(Buffer.from('atlas-report'));
        events.end?.();
      }),
    };
    const PDFDocument = vi.fn(function MockPdfDocument() { return pdfDoc; });
    const fs = {
      existsSync: vi.fn((target) => target !== path.join('C:/Atlas', 'exports')),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => ({ mtimeMs: 0 })),
      unlinkSync: vi.fn(),
    };
    const db = {
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn((sql, callback) => callback(null, [
        {
          total_tickets: 8,
          ai_handled: 5,
          human_handled: 3,
          kontor: 'goteborg_ullevi',
          avg_response_min: 12.4,
        },
      ])),
    };
    const sendMail = vi.fn(async () => {});
    const helpers = loadServerHelpers({
      DateOverride: FixedDate,
      PDFDocument,
      fs,
      db,
      aiEnabled: false,
      processOverride: { env: { EMAIL_USER: 'atlas@example.com' } },
      nodemailer: { createTransport: vi.fn(() => ({ sendMail })) },
    });

    await helpers.runMonthlyExport();

    expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('C:/Atlas', 'exports'), { recursive: true });
    expect(db.all).toHaveBeenCalledTimes(1);
    expect(PDFDocument).toHaveBeenCalledWith({ margin: 50 });
    expect(pdfDoc.text).toHaveBeenNthCalledWith(1, 'Atlas Månadsrapport – 2026-02', { align: 'center' });
    expect(pdfDoc.text).toHaveBeenNthCalledWith(
      2,
      'Ingen AI-sammanfattning (OpenAI ej aktiverad).',
      { align: 'left', lineGap: 6 }
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('C:/Atlas', 'exports', 'atlas_rapport_2026-02.pdf'),
      Buffer.from('atlas-report')
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'atlas@example.com',
      subject: 'Atlas Månadsrapport 2026-02',
      attachments: [
        expect.objectContaining({
          filename: 'atlas_rapport_2026-02.pdf',
          content: Buffer.from('atlas-report'),
        }),
      ],
    }));
  });

  it('uses OpenAI for the monthly export summary when AI mode is enabled', async () => {
    class FixedDate extends Date {
      constructor(...args) {
        super(...(args.length ? args : ['2026-03-27T10:11:12.000Z']));
      }
    }

    const events = {};
    const pdfDoc = {
      on: vi.fn((event, handler) => {
        events[event] = handler;
        return pdfDoc;
      }),
      fontSize: vi.fn(() => pdfDoc),
      text: vi.fn(() => pdfDoc),
      moveDown: vi.fn(() => pdfDoc),
      end: vi.fn(() => {
        events.data?.(Buffer.from('atlas-ai-report'));
        events.end?.();
      }),
    };
    const create = vi.fn(async () => ({
      choices: [{ message: { content: 'AI-sammanfattning för månaden.' } }],
    }));
    const OpenAI = vi.fn(function MockOpenAI(config) {
      this.config = config;
      return {
        chat: {
          completions: {
            create,
          },
        },
      };
    });
    const sendMail = vi.fn(async () => {});
    const helpers = loadServerHelpers({
      DateOverride: FixedDate,
      PDFDocument: vi.fn(function MockPdfDocument() { return pdfDoc; }),
      OpenAI,
      aiEnabled: true,
      processOverride: { env: { OPENAI_API_KEY: 'openai-key', EMAIL_USER: 'atlas@example.com' } },
      db: {
        get: vi.fn(),
        run: vi.fn(),
        all: vi.fn((sql, callback) => callback(null, [
          {
            total_tickets: 4,
            ai_handled: 3,
            human_handled: 1,
            kontor: null,
            avg_response_min: 8,
          },
        ])),
      },
      fs: {
        existsSync: vi.fn(() => true),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readdirSync: vi.fn(() => []),
        statSync: vi.fn(() => ({ mtimeMs: 0 })),
        unlinkSync: vi.fn(),
      },
      nodemailer: { createTransport: vi.fn(() => ({ sendMail })) },
    });

    await helpers.runMonthlyExport();

    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'openai-key' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-4o-mini',
      max_tokens: 600,
    }));
    expect(String(create.mock.calls[0][0].messages[0].content)).toContain('Okänt: 4 ärenden');
    expect(pdfDoc.text).toHaveBeenNthCalledWith(2, 'AI-sammanfattning för månaden.', { align: 'left', lineGap: 6 });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('logs monthly export failures without throwing', async () => {
    const error = vi.fn();
    const helpers = loadServerHelpers({
      db: {
        get: vi.fn(),
        run: vi.fn(),
        all: vi.fn((sql, callback) => callback(new Error('stats failed'))),
      },
      error,
    });

    await expect(helpers.runMonthlyExport()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('❌ Fel i månadsrapport:', 'stats failed');
  });
  it('builds env and file paths correctly in both dev and packaged mode', () => {
    const devHelpers = loadServerHelpers({
      isPackaged: false,
      dirname: 'C:/Atlas',
      processOverride: { env: { ATLAS_ROOT_PATH: 'C:/AtlasData' }, resourcesPath: 'C:/Atlas/resources', cwd: () => 'C:/Atlas' },
    });
    const packagedHelpers = loadServerHelpers({
      isPackaged: true,
      dirname: 'C:/Atlas',
      processOverride: { env: { ATLAS_ROOT_PATH: 'D:/AtlasData' }, resourcesPath: 'D:/AtlasResources', cwd: () => 'D:/PackagedApp' },
    });

    expect(devHelpers.getEnvPath()).toBe(path.join('C:/Atlas', '.env'));
    expect(devHelpers.getFilePaths()).toEqual({
      mainJs: path.join('C:/Atlas', 'main.js'),
      legacyJs: path.join('C:/Atlas', 'legacy_engine.ts'),
      rendererJs: path.join('C:/Atlas', 'Renderer', 'renderer.js'),
      intentJs: path.join('C:/Atlas', 'patch', 'intentEngine.ts'),
      knowledgePath: path.join('C:/Atlas', 'knowledge'),
    });

    expect(packagedHelpers.getEnvPath()).toBe(path.join('D:/PackagedApp', '.env'));
    expect(packagedHelpers.getFilePaths()).toEqual({
      mainJs: path.join('D:/AtlasResources', 'main.js'),
      legacyJs: path.join('D:/AtlasResources', 'legacy_engine.ts'),
      rendererJs: path.join('D:/AtlasResources', 'Renderer', 'renderer.js'),
      intentJs: path.join('D:/AtlasResources', 'patch', 'intentEngine.ts'),
      knowledgePath: path.join('D:/AtlasResources', 'knowledge'),
    });
  });
  it('returns an empty shell response when query or sessionId is missing', async () => {
    const { handleChatMessage } = loadServerHelpers();

    await expect(handleChatMessage({ query: '', sessionId: 'conv-1' })).resolves.toEqual({ answer: '', sessionId: 'conv-1' });
    await expect(handleChatMessage({ query: 'Hej', sessionId: '' })).resolves.toEqual({ answer: '', sessionId: '' });
  });

  it('rejects archived conversations before touching the rest of the flow', async () => {
    const getV2State = vi.fn(async () => ({ is_archived: 1 }));
    const getContextRow = vi.fn(async () => null);
    const { handleChatMessage } = loadServerHelpers({ getV2State, getContextRow });

    const result = await handleChatMessage({ query: 'Hej', sessionId: 'archived-1', isFirstMessage: false });

    expect(result.sessionId).toBe('archived-1');
    expect(result.answer).toContain('Denna chatt är avslutad');
    expect(getContextRow).not.toHaveBeenCalled();
  });

  it('skips duplicate human-mode triggers while the race guard lock is active', async () => {
    const db = { get: vi.fn(), all: vi.fn(), run: vi.fn((sql, params, callback) => { if (typeof params === 'function') { callback = params; } if (callback) callback(null); }) };
    const upsertContextRow = vi.fn(async () => {});
    const { handleChatMessage } = loadServerHelpers({
      db,
      upsertContextRow,
      setTimeoutOverride: vi.fn(() => 0),
      getV2State: vi.fn(async () => ({ human_mode: 0 })),
      getContextRow: vi.fn(async () => null),
      humanTriggers: ['support'],
    });

    const firstResult = await handleChatMessage({ query: 'Jag vill ha support', sessionId: 'conv-lock', isFirstMessage: false });
    const secondResult = await handleChatMessage({ query: 'Jag vill ha support', sessionId: 'conv-lock', isFirstMessage: false });

    expect(firstResult).toEqual({ answer: 'Jag kopplar in en mänsklig kollega direkt.', sessionId: 'conv-lock' });
    expect(secondResult).toEqual({ answer: '', sessionId: 'conv-lock' });
    expect(db.run).toHaveBeenCalledTimes(1);
    expect(upsertContextRow).toHaveBeenCalledTimes(1);
  });

  it('routes human triggers to the matching office, stores context and updates ticket flags', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const db = { get: vi.fn(), all: vi.fn(), run: vi.fn((sql, params, callback) => callback(null)) };
    const getContextRow = vi.fn(async () => ({
      last_message_id: 2,
      context_data: {
        messages: [],
        locked_context: { city: null, area: null, vehicle: null },
        linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
      },
    }));
    const upsertContextRow = vi.fn(async () => {});
    const getAllOffices = vi.fn(async () => [{ city: 'Goteborg', area: 'Ullevi', routing_tag: 'goteborg_ullevi' }]);
    const setHumanMode = vi.fn(async () => {});
    const updateTicketFlags = vi.fn(async () => {});
    const io = { emit: vi.fn() };
    const { handleChatMessage } = loadServerHelpers({
      db,
      getV2State: vi.fn(async () => ({ human_mode: 0 })),
      getContextRow,
      upsertContextRow,
      getAllOffices,
      setHumanMode,
      updateTicketFlags,
      io,
      humanTriggers: ['support'],
      humanResponseText: 'Jag kopplar dig vidare.',
    });

    const result = await handleChatMessage({
      query: 'Jag vill ha support',
      sessionId: 'conv-human',
      isFirstMessage: false,
      providedContext: {
        locked_context: {
          city: 'Goteborg',
          area: 'Ullevi',
          name: 'Lisa Kund',
          email: 'lisa@example.com',
          vehicle: 'MC',
        },
      },
    });

    expect(result).toEqual({ answer: 'Jag kopplar dig vidare.', sessionId: 'conv-human' });
    expect(getAllOffices).toHaveBeenCalledTimes(1);
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO chat_v2_state'),
      ['conv-human', 'goteborg_ullevi', 1710000000],
      expect.any(Function)
    );
    const firstUpsert = upsertContextRow.mock.calls[0][0];
    expect(firstUpsert).toEqual(expect.objectContaining({
      conversation_id: 'conv-human',
      last_message_id: 2,
      updated_at: 1710000000,
    }));
    expect(firstUpsert.context_data.locked_context).toEqual({
      city: 'Goteborg',
      area: 'Ullevi',
      vehicle: 'MC',
      name: 'Lisa Kund',
      email: 'lisa@example.com',
    });
    expect(firstUpsert.context_data.messages).toEqual([{ role: 'user', content: 'Jag vill ha support', timestamp: 1710000000000 }]);
    expect(upsertContextRow).toHaveBeenNthCalledWith(2, expect.objectContaining({
      conversation_id: 'conv-human',
      last_message_id: 1,
      updated_at: 1710000000,
    }));
    expect(setHumanMode).toHaveBeenCalledWith('conv-human', 'customer');
    expect(updateTicketFlags).toHaveBeenCalledWith('conv-human', {
      vehicle: 'MC',
      name: 'Lisa Kund',
      email: 'lisa@example.com',
    });
    expect(io.emit).toHaveBeenCalledWith('team:update', { type: 'human_mode_triggered', sessionId: 'conv-human', office: 'goteborg_ullevi' });
  });

  it('initializes new customer sessions and stores the AI response path when no human trigger matches', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const db = { get: vi.fn(), all: vi.fn(), run: vi.fn((sql, params, callback) => callback(null)) };
    const upsertContextRow = vi.fn(async () => {});
    const runLegacyFlow = vi.fn(async () => ({
      response_payload: { answer: 'Atlas svar' },
      new_context: {
        locked_context: { city: 'Malmo', area: null, vehicle: 'BIL' },
        linksSentByVehicle: { CAR: true },
      },
    }));
    const getAllTemplates = vi.fn(async () => [{ id: 'tpl-1' }]);
    const { handleChatMessage } = loadServerHelpers({
      db,
      getV2State: vi.fn(async () => null),
      getContextRow: vi.fn(async () => null),
      upsertContextRow,
      runLegacyFlow,
      getAllTemplates,
      humanTriggers: ['support'],
      humanResponseText: 'Jag kopplar dig vidare.',
    });

    const result = await handleChatMessage({
      query: 'Vad kostar en lektion?',
      sessionId: 'conv-ai',
      isFirstMessage: true,
      providedContext: { locked_context: { agent_id: 'goteborg_ullevi' } },
    });

    expect(result).toEqual({ answer: 'Atlas svar' });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, 'customer', 0, NULL, ?, ?)"),
      ['conv-ai', 'goteborg_ullevi', 1710000000],
      expect.any(Function)
    );
    const [legacyPayload, legacyContext, legacyTemplates] = runLegacyFlow.mock.calls[0];
    expect(legacyPayload).toEqual(expect.objectContaining({
      query: 'Vad kostar en lektion?',
      sessionId: 'conv-ai',
      isFirstMessage: true,
    }));
    expect(legacyPayload.sessionContext[0]).toEqual({ role: 'user', content: 'Vad kostar en lektion?', timestamp: 1710000000000 });
    expect(legacyContext).toEqual({
      locked_context: { city: null, area: null, vehicle: null, agent_id: 'goteborg_ullevi' },
      linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
    });
    expect(legacyTemplates).toEqual([{ id: 'tpl-1' }]);
    expect(upsertContextRow).toHaveBeenCalledWith({
      conversation_id: 'conv-ai',
      last_message_id: 2,
      context_data: {
        messages: [
          { role: 'user', content: 'Vad kostar en lektion?', timestamp: 1710000000000 },
          { role: 'atlas', content: 'Atlas svar', timestamp: 1710000000000 },
        ],
        locked_context: { city: 'Malmo', area: null, vehicle: 'BIL' },
        linksSentByVehicle: { CAR: true },
      },
      updated_at: 1710000000,
    });
  });
});




















