const crypto = require('crypto');
const path = require('path');
const { loadSourceSnippets } = require('../helpers/load-source-snippets');

const legacyPath = path.resolve(__dirname, '../../legacy_engine.ts');

function loadLegacyHelpers(options = {}) {
  const consoleOverrides = options.consoleOverrides || {};
  return loadSourceSnippets({
    filePath: legacyPath,
    snippets: [
      {
        start: 'const sessions = new Map();',
        end: '// ENVIRONMENT LOADING & API CONFIGURATION',
      },
      {
        start: 'let miniSearch;',
        end: '// Search & Confidence Thresholds',
      },
      {
        start: 'const LOW_CONFIDENCE_THRESHOLD = 0.25;',
        end: '// =============================================================================\n// SECTION 3.1: CITY & VEHICLE ALIASES (NLU Mapping)',
      },
      {
        start: 'const CITY_ALIASES = {',
        end: '// ====================================================================\n// SECTION 4: TEXT PROCESSING & TOOLS',
      },
      {
        start: 'function expandQuery(query) {',
        end: 'async function get_joke() {',
      },
      {
        start: 'async function get_joke() {',
        end: '// GLOBAL TOOL DEFINITION (OpenAI Function Calling)',
      },
      {
        start: 'function extractVehicle(text) {',
        end: '// =================================================================\n// MINISEARCH INITIALISERING',
      },
      {
        start: 'async function generateSmartClarification(query, nluResult, detectedCity, detectedVehicle, lockedCtx = {}) {',
        end: '// ====================================================================\n// SECTION 6: KNOWLEDGE BASE INITIALIZATION (Runs Once)',
      },
      {
        start: 'const loadKnowledgeBase = () => {',
        end: '// ====================================================================\n// BOOKING LINKS LOADER (Läser utils/booking-links.json vid uppstart)',
      },
      {
        start: 'const loadBookingLinks = () => {',
        end: '// Starta initiering',
      },
      {
        start: 'async function runLegacyFlow(payload, contextFromDB, templatesFromDB) {',
        end: 'function injectSessionState(sessionId, contextData) {',
      },
      {
        start: 'function injectSessionState(sessionId, contextData) {',
        end: 'module.exports = { runLegacyFlow, loadKnowledgeBase };',
      },
    ],
    sandbox: {
      crypto,
      fs: options.fs || { existsSync: vi.fn(() => false) },
      path,
      SERVER_ROOT: options.serverRoot || 'C:/Atlas',
      __dirname: options.dirname || 'C:/Atlas',
      fetch: options.fetch || vi.fn(),
      openai: options.openai || { images: { generate: vi.fn() } },
      generate_rag_answer: options.generate_rag_answer || vi.fn(async () => ({ type: 'answer', answer: 'Mock answer' })),
      MiniSearch: options.MiniSearch || vi.fn(function MockMiniSearch() { return { addAll: vi.fn(), removeAll: vi.fn() }; }),
      ForceAddEngine: options.ForceAddEngine || vi.fn(function MockForceAddEngine() { return { execute: vi.fn(() => ({ mustAddChunks: [], forceHighConfidence: false })) }; }),
      IntentEngine: options.IntentEngine || vi.fn(function MockIntentEngine() { return { kind: 'intent-engine' }; }),
      KNOWLEDGE_PATH: options.knowledgePath || path.join(options.serverRoot || 'C:/Atlas', 'knowledge'),
      OpenAI: options.OpenAI || vi.fn(function MockOpenAI() { return { chat: { completions: { create: vi.fn() } } }; }),
      UTILS_PATH: options.utilsPath || path.join(options.serverRoot || 'C:/Atlas', 'utils'),
      Math: options.math || Math,
      process: {
        env: {
          ...(options.env || {}),
        },
        exit: options.processExit || vi.fn(),
      },
      console: {
        warn: consoleOverrides.warn || vi.fn(),
        error: consoleOverrides.error || vi.fn(),
        log: consoleOverrides.log || vi.fn(),
      },
    },
    exportExpression: 'module.exports = { sessions, generateSessionId, createEmptySession, appendToSession, getResourcePath, rebuildChunkMap, setAllChunks: (value) => { allChunks = value; }, getChunkMap: () => chunkMap, expandQuery, isBasfaktaType, normalizeText, normalizedExpandQuery, isLowConfidence, get_joke, get_quote, fetchWeather, calculate_price, generate_image, extractVehicle, generateSmartClarification, loadKnowledgeBase, loadBookingLinks, getBookingLinks: () => bookingLinks, getAllChunks: () => allChunks, getKnownCities: () => knownCities, getKnownAreas: () => knownAreas, getCityOffices: () => cityOffices, getOfficePrices: () => officePrices, getOfficeContactData: () => officeContactData, getCriticalAnswers: () => criticalAnswers, getMiniSearch: () => miniSearch, setMiniSearch: (value) => { miniSearch = value; }, getIntentEngine: () => intentEngine, setKnownAreas: (value) => { knownAreas = value; }, setOfficeData: (value) => { officeData = value; }, setCriticalAnswers: (value) => { criticalAnswers = value; }, setIntentEngine: (value) => { intentEngine = value; }, runLegacyFlow, injectSessionState, getSessionState };',
  });
}

describe('legacy_engine helpers', () => {
  it('creates stable in-memory sessions and appends messages', () => {
    const { sessions, generateSessionId, createEmptySession, appendToSession } = loadLegacyHelpers();

    const sessionId = generateSessionId();
    expect(sessionId).toMatch(/^[a-f0-9]{32}$/);

    const session = createEmptySession(sessionId);
    expect(sessions.get(sessionId)).toBe(session);
    expect(session.locked_context).toEqual({ city: null, area: null, vehicle: null });
    expect(session.isFirstMessage).toBe(true);

    appendToSession(sessionId, 'user', 'Hej');
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toMatchObject({ role: 'user', content: 'Hej' });
  });

  it('resolves resource paths via server root, env fallback and dirname fallback', () => {
    const fs = {
      existsSync: vi.fn((candidate) => candidate === path.join('C:/Atlas', 'config.json')),
    };
    const { getResourcePath } = loadLegacyHelpers({ fs, serverRoot: 'C:/Atlas', dirname: 'C:/Legacy', env: { ATLAS_ROOT_PATH: 'D:/AtlasData' } });

    expect(getResourcePath('config.json')).toBe(path.join('C:/Atlas', 'config.json'));
    expect(getResourcePath('missing.json')).toBe(path.join('D:/AtlasData', 'missing.json'));

    const missingEverywhereFs = { existsSync: vi.fn(() => false) };
    const fallbackHelpers = loadLegacyHelpers({ fs: missingEverywhereFs, serverRoot: 'C:/Atlas', dirname: 'C:/Legacy', env: {} });
    expect(fallbackHelpers.getResourcePath('missing.json')).toBe(path.join('C:/Legacy', 'missing.json'));
  });

  it('rebuilds the chunk map from the current allChunks array and clears invalid state', () => {
    const helpers = loadLegacyHelpers();

    helpers.setAllChunks([
      { id: 'a', text: 'Chunk A' },
      { id: 'b', text: 'Chunk B' },
    ]);
    helpers.rebuildChunkMap();
    expect(Array.from(helpers.getChunkMap().keys())).toEqual(['a', 'b']);

    helpers.setAllChunks(null);
    helpers.rebuildChunkMap();
    expect(Array.from(helpers.getChunkMap().keys())).toEqual([]);
  });

  it('expands known query terms with capped synonym lists and truncates overly long strings', () => {
    const { expandQuery } = loadLegacyHelpers();

    const expanded = expandQuery('Jag vill avboka');
    expect(expanded).toContain('avbokning');
    expect(expanded).not.toContain('omboka');

    const truncated = expandQuery('pris '.repeat(80));
    expect(truncated.length).toBe(250);
  });

  it('detects basfakta chunks from either type or source metadata', () => {
    const { isBasfaktaType } = loadLegacyHelpers();

    expect(isBasfaktaType({ type: 'Basfakta entry' })).toBe(true);
    expect(isBasfaktaType({ source: 'basfakta_intro.json' })).toBe(true);
    expect(isBasfaktaType({ type: 'faq', source: 'city_office.json' })).toBe(false);
    expect(isBasfaktaType(null)).toBe(false);
  });

  it('normalizes accents, punctuation and common vehicle-unit spellings', () => {
    const { normalizeText, normalizedExpandQuery } = loadLegacyHelpers();

    expect(normalizeText('\u00C5\u00C4\u00D6! 125cc, 35 kw??')).toBe('aao 125 cc 35 kW');
    expect(normalizeText('')).toBe('');

    const expanded = normalizedExpandQuery('\u00C5\u00C4\u00D6! 125cc, pris??');
    expect(expanded.startsWith('aao 125 cc pris')).toBe(true);
    expect(expanded).toContain('kostar');
  });

  it('flags low-confidence result sets based on the best score', () => {
    const { isLowConfidence } = loadLegacyHelpers();

    expect(isLowConfidence([])).toBe(true);
    expect(isLowConfidence([{ score: 0.2 }])).toBe(true);
    expect(isLowConfidence([{ score: 0.26 }])).toBe(false);
    expect(isLowConfidence([{ other: 1 }])).toBe(true);
  });

  it('returns deterministic joke and quote payloads when Math.random is controlled', async () => {
    const math = Object.create(Math);
    math.random = () => 0;
    const { get_joke, get_quote } = loadLegacyHelpers({ math });

    await expect(get_joke()).resolves.toEqual({ joke: expect.any(String) });
    await expect(get_quote()).resolves.toEqual({ quote: expect.any(String) });
  });

  it('returns weather data with city alias normalization when OpenWeather succeeds', async () => {
    const fetch = vi.fn(async () => ({
      json: async () => ({
        cod: 200,
        name: 'Stockholm',
        main: { temp: 6.6 },
        weather: [{ description: 'soligt' }],
      }),
    }));
    const { fetchWeather } = loadLegacyHelpers({
      env: { OPENWEATHER_API_KEY: 'weather-key' },
      fetch,
    });

    await expect(fetchWeather('sthlm')).resolves.toEqual({
      city: 'Stockholm',
      temperature: 7,
      description: 'soligt',
    });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('q=Stockholm,SE'));
  });

  it('returns safe errors when weather config or API responses fail', async () => {
    const missingKeyFetch = vi.fn();
    const { fetchWeather: withoutKey } = loadLegacyHelpers({ fetch: missingKeyFetch });
    await expect(withoutKey('goteborg')).resolves.toEqual({ error: 'OpenWeather API-nyckel saknas' });
    expect(missingKeyFetch).not.toHaveBeenCalled();

    const apiFetch = vi.fn(async () => ({ json: async () => ({ cod: 404 }) }));
    const weatherError = vi.fn();
    const { fetchWeather: apiFailure } = loadLegacyHelpers({
      env: { OPENWEATHER_API_KEY: 'weather-key' },
      fetch: apiFetch,
      consoleOverrides: { error: weatherError },
    });
    await expect(apiFailure('Stockholm')).resolves.toEqual({ error: expect.stringContaining('Stockholm') });

    const thrownFetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const { fetchWeather: networkFailure } = loadLegacyHelpers({
      env: { OPENWEATHER_API_KEY: 'weather-key' },
      fetch: thrownFetch,
      consoleOverrides: { error: weatherError },
    });
    await expect(networkFailure('Stockholm')).resolves.toEqual({ error: expect.stringContaining('API') });
    expect(weatherError).toHaveBeenCalledWith('[WEATHER ERROR]', 'offline');
  });

  it('calculates total prices and proxies successful image generation', async () => {
    const images = { generate: vi.fn(async () => ({ data: [{ b64_json: 'base64-image' }] })) };
    const { calculate_price, generate_image } = loadLegacyHelpers({ openai: { images } });

    await expect(calculate_price(4, 299)).resolves.toEqual({ total: 1196 });
    await expect(generate_image('En bil')).resolves.toEqual({ image: 'base64-image' });
    expect(images.generate).toHaveBeenCalledWith({
      model: 'gpt-image-1',
      prompt: 'En bil',
      size: '1024x1024',
    });
  });

  it('returns a safe error when image generation fails', async () => {
    const errorLog = vi.fn();
    const images = { generate: vi.fn(async () => { throw new Error('image down'); }) };
    const { generate_image } = loadLegacyHelpers({ openai: { images }, consoleOverrides: { error: errorLog } });

    await expect(generate_image('En MC')).resolves.toEqual({ error: 'Kunde inte generera bilden.' });
    expect(errorLog).toHaveBeenCalled();
  });

  it('extracts the expected vehicle buckets from user text', () => {
    const { extractVehicle } = loadLegacyHelpers();

    expect(extractVehicle('Jag vill gå handledarkurs')).toBe('INTRO');
    expect(extractVehicle('Behöver AM mopedkurs')).toBe('AM');
    expect(Array.from(extractVehicle('Vad krävs för släp och B96?').normalize('NFC')).map((ch) => ch.charCodeAt(0))).toEqual([83, 76, 196, 80]);
    expect(extractVehicle('Jag vill ta MC-körkort')).toBe('MC');
    expect(extractVehicle('Hur fungerar YKB för lastbil?')).toBe('LASTBIL');
    expect(extractVehicle('Jag vill ta bil')).toBe('BIL');
    expect(extractVehicle('Hej där')).toBeNull();
  });

  it('bridges DB context into session state and returns safe defaults when missing', () => {
    const warn = vi.fn();
    const { injectSessionState, getSessionState } = loadLegacyHelpers({ consoleOverrides: { warn } });

    injectSessionState('conv-1', {
      locked_context: { city: 'Goteborg', area: 'Ullevi', vehicle: 'MC' },
      linksSentByVehicle: { MC: true },
      messages: [{ role: 'user', content: 'Hej' }],
    });

    expect(getSessionState('conv-1')).toEqual({
      locked_context: { city: 'Goteborg', area: 'Ullevi', vehicle: 'MC' },
      linksSentByVehicle: { MC: true },
      messages: [{ role: 'user', content: 'Hej' }],
    });

    expect(getSessionState('missing-session')).toEqual({
      locked_context: { city: null, area: null, vehicle: null },
      linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
      messages: [],
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('returns a 400 payload when the legacy flow is called without any query input', async () => {
    const helpers = loadLegacyHelpers();

    const result = await helpers.runLegacyFlow({ sessionId: 'legacy-400' }, null, []);

    expect(result.statusCode).toBe(400);
    expect(result.error).toEqual({ error: 'Query saknas' });
    expect(result.new_context).toEqual({
      locked_context: { city: null, area: null, vehicle: null },
      linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
      messages: [],
    });
  });

  it('rejects empty questions before the RAG pipeline starts', async () => {
    const helpers = loadLegacyHelpers();

    const result = await helpers.runLegacyFlow({ query: '   ', sessionId: 'legacy-empty' }, null, []);

    expect(result.statusCode).toBe(400);
    expect(result.error).toEqual({ error: 'Tom fråga mottagen' });
  });

  it('short-circuits exact emergency answers before intent parsing', async () => {
    const helpers = loadLegacyHelpers();
    helpers.setCriticalAnswers([{ keywords: ['nollutrymme'], answer: 'Håll avstånd och stanna direkt.' }]);

    const result = await helpers.runLegacyFlow({ query: 'nollutrymme', sessionId: 'legacy-critical' }, null, []);

    expect(result.response_payload).toEqual({
      answer: 'Håll avstånd och stanna direkt.',
      sessionId: 'legacy-critical',
      locked_context: { city: null, area: null, vehicle: null },
    });
  });

  it('answers directly when the customer asks about an unknown city outside Atlas coverage', async () => {
    const helpers = loadLegacyHelpers();
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'price_lookup', slots: { vehicle: 'MC' } })) });
    helpers.setKnownAreas({ ullevi: 'Goteborg' });
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({ query: 'Vad kostar MC i Kiruna?', sessionId: 'legacy-city' }, null, []);

    expect(result.response_payload.answer).toContain('inga kontor i Kiruna ännu');
    expect(result.response_payload.sessionId).toBe('legacy-city');
    expect(result.response_payload.locked_context).toEqual({ city: null, area: null, vehicle: 'MC' });
  });

  it('asks for city proactively on price questions with known vehicle but no city', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: 'Vilken stad gäller det?' } }],
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
    const helpers = loadLegacyHelpers({ OpenAI, env: { OPENAI_API_KEY: 'openai-key' } });
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'price_lookup', slots: { vehicle: 'MC' } })) });
    helpers.setKnownAreas({});
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({ query: 'Vad kostar MC?', sessionId: 'legacy-price' }, null, []);

    expect(result.response_payload.answer).toBe('Vilken stad gäller det?');
    expect(result.response_payload.debug).toEqual({ triggered_by: 'price_without_city', intent: 'price_lookup' });
  });

  it('re-triggers city clarification when the previous Atlas answer already asked for a city', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: 'Vilken stad gäller det för MC?' } }],
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
    const helpers = loadLegacyHelpers({ OpenAI, env: { OPENAI_API_KEY: 'openai-key' } });
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'service_inquiry', slots: { vehicle: 'MC' } })) });
    helpers.setKnownAreas({});
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({
      query: 'Och för MC?',
      sessionId: 'legacy-loop',
      sessionContext: [{ role: 'atlas', content: 'Vilken stad gäller det?' }],
    }, null, []);

    expect(result.response_payload.answer).toBe('Vilken stad gäller det för MC?');
    expect(result.response_payload.debug).toEqual({ triggered_by: 'city_question_loop', intent: 'service_inquiry' });
  });
  it('falls back to a clarification when search results stay below the confidence threshold', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: 'Jag behöver veta stad och fordon för att svara säkert.' } }],
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
    const ForceAddEngine = vi.fn(function MockForceAddEngine() {
      return {
        execute: vi.fn(() => ({ mustAddChunks: [], forceHighConfidence: false })),
      };
    });
    const helpers = loadLegacyHelpers({ OpenAI, ForceAddEngine, env: { OPENAI_API_KEY: 'openai-key' } });
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'risk_info', slots: { vehicle: 'BIL' } })) });
    helpers.setMiniSearch({ search: vi.fn(() => []) });
    helpers.setAllChunks([]);
    helpers.setCriticalAnswers([]);
    helpers.setKnownAreas({});
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({ query: 'Jag behöver hjälp', sessionId: 'legacy-low-confidence' }, null, []);

    expect(result.response_payload).toEqual({
      answer: 'Jag behöver veta stad och fordon för att svara säkert.',
      context: [],
      debug: { low_confidence: true, best_score: 0 },
    });
  });

  it('uses emergency fallback answers after search when critical keywords match and no chunks were force-added', async () => {
    const ForceAddEngine = vi.fn(function MockForceAddEngine() {
      return {
        execute: vi.fn(() => ({ mustAddChunks: [], forceHighConfidence: false })),
      };
    });
    const helpers = loadLegacyHelpers({ ForceAddEngine });
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'risk_info', slots: { vehicle: 'BIL' } })) });
    helpers.setMiniSearch({ search: vi.fn(() => [{ id: 'bf-risketta', score: 0.31 }]) });
    helpers.setAllChunks([
      {
        id: 'bf-risketta',
        type: 'basfakta',
        source: 'basfakta_risk1.json',
        text: 'Riskettan är obligatorisk.',
        keywords: ['risketta'],
      },
    ]);
    helpers.setCriticalAnswers([{ id: 'critical-risk1', keywords: ['risketta'], answer: 'Riskettan är obligatorisk.' }]);
    helpers.setKnownAreas({});
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({
      query: 'Kan jag boka risketta?',
      sessionId: 'legacy-emergency',
      isFirstMessage: true,
    }, null, []);

    expect(result.response_payload).toEqual({
      sessionId: 'legacy-emergency',
      answer: 'God morgon! Riskettan är obligatorisk.',
      emergency_mode: true,
      context: [],
      locked_context: { city: null, area: null, vehicle: 'BIL' },
      debug: {
        nlu: { intent: 'risk_info', slots: { vehicle: 'BIL' } },
        fallback_id: 'critical-risk1',
      },
    });
    expect(result.new_context.messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'God morgon! Riskettan är obligatorisk.',
    });
  });
  it('returns a technical search error when MiniSearch fails mid-flow', async () => {
    const helpers = loadLegacyHelpers();
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'contact_info', slots: {} })) });
    helpers.setMiniSearch({ search: vi.fn(() => { throw new Error('index offline'); }) });
    helpers.setAllChunks([]);
    helpers.setCriticalAnswers([]);
    helpers.setKnownAreas({});
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({ query: 'Vad har ni för öppettider?', sessionId: 'legacy-search-error' }, null, []);

    expect(result.response_payload).toEqual({
      answer: 'Ett tekniskt fel uppstod vid sökning.',
      sessionId: 'legacy-search-error',
      error: 'index offline',
    });
  });

  it('returns a technical AI error when answer generation throws after context building', async () => {
    const generate_rag_answer = vi.fn(async () => {
      throw new Error('openai down');
    });
    const helpers = loadLegacyHelpers({ generate_rag_answer });
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'contact_info', slots: {} })) });
    helpers.setMiniSearch({ search: vi.fn(() => [{ id: 'office-1', score: 0.8 }]) });
    helpers.setAllChunks([
      {
        id: 'office-1',
        type: 'kontor_info',
        title: 'Öppettider',
        text: 'Vi har öppet vardagar 08-17.',
        city: 'Goteborg',
      },
    ]);
    helpers.setCriticalAnswers([]);
    helpers.setKnownAreas({});
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({ query: 'Vad har ni för öppettider?', sessionId: 'legacy-ai-error' }, null, []);

    expect(generate_rag_answer).toHaveBeenCalledTimes(1);
    expect(result.response_payload).toEqual({
      answer: 'Tekniskt fel vid AI-anrop.',
      sessionId: 'legacy-ai-error',
    });
  });
  it('returns a normal RAG answer after successful retrieval and answer generation', async () => {
    const generate_rag_answer = vi.fn(async () => ({ type: 'answer', answer: 'Vi har öppet vardagar 08-17.' }));
    const helpers = loadLegacyHelpers({ generate_rag_answer });
    helpers.setIntentEngine({ parseIntent: vi.fn(() => ({ intent: 'contact_info', slots: {} })) });
    helpers.setMiniSearch({ search: vi.fn(() => [{ id: 'office-1', score: 0.8 }]) });
    helpers.setAllChunks([
      {
        id: 'office-1',
        type: 'kontor_info',
        title: 'Öppettider',
        text: 'Vi har öppet vardagar 08-17.',
        city: 'Goteborg',
      },
    ]);
    helpers.setCriticalAnswers([]);
    helpers.setKnownAreas({});
    helpers.setOfficeData({ goteborg_ullevi: { city: 'Goteborg' } });

    const result = await helpers.runLegacyFlow({ query: 'Vad har ni för öppettider?', sessionId: 'legacy-success' }, null, []);

    expect(generate_rag_answer).toHaveBeenCalledTimes(1);
    expect(result.response_payload).toEqual({
      answer: 'Vi har öppet vardagar 08-17.',
      sessionId: 'legacy-success',
      locked_context: { city: null, area: null, vehicle: null },
    });
  });
  it('loads booking links from utils and resets safely on missing or invalid files', () => {
    const warn = vi.fn();
    const error = vi.fn();
    const fs = {
      existsSync: vi.fn((target) => target === path.join('C:/Atlas', 'utils', 'booking-links.json')),
      readFileSync: vi.fn(() => JSON.stringify({ BIL: 'https://book.example/bil', MC: 'https://book.example/mc' })),
    };
    const helpers = loadLegacyHelpers({
      fs,
      serverRoot: 'C:/Atlas',
      utilsPath: path.join('C:/Atlas', 'utils'),
      consoleOverrides: { warn, error },
    });

    helpers.loadBookingLinks();
    expect(fs.readFileSync).toHaveBeenCalledWith(path.join('C:/Atlas', 'utils', 'booking-links.json'), 'utf8');
    expect(helpers.getBookingLinks()).toEqual({ BIL: 'https://book.example/bil', MC: 'https://book.example/mc' });

    fs.existsSync.mockImplementationOnce(() => false);
    helpers.loadBookingLinks();
    expect(helpers.getBookingLinks()).toEqual({});
    expect(warn.mock.calls.some(([message]) => String(message).includes('[BookingLinks]') && String(message).includes('booking-links.json'))).toBe(true);

    fs.existsSync.mockImplementationOnce(() => true);
    fs.readFileSync.mockImplementationOnce(() => '{bad json');
    helpers.loadBookingLinks();
    expect(helpers.getBookingLinks()).toEqual({});
    expect(error.mock.calls.some(([message]) => String(message).includes('[BookingLinks] Kunde inte'))).toBe(true);
  });

  it('builds a smart clarification prompt from intent, city, vehicle and locked context', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: 'Jag ser att du undrar om priset. Vilken stad och vilket fordon galler det?' } }],
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
    const { generateSmartClarification } = loadLegacyHelpers({
      OpenAI,
      env: { OPENAI_API_KEY: 'openai-key' },
    });

    const answer = await generateSmartClarification(
      'Vad kostar det?',
      { intent: 'price_lookup' },
      'Goteborg',
      'MC',
      { city: 'Malmo', vehicle: 'BIL' }
    );

    expect(answer).toContain('Vilken stad och vilket fordon');
    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][0];
    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.messages[1].content).toContain('Kundens fråga: "Vad kostar det?"');
    expect(payload.messages[1].content).toContain('pris eller kostnad');
    expect(payload.messages[1].content).toContain('Goteborg');
    expect(payload.messages[1].content).toContain('MC');
    expect(payload.messages[1].content).toContain('Malmo');
  });

  it('falls back to a default clarification when the AI answer is empty', async () => {
    const OpenAI = vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: vi.fn(async () => ({ choices: [{ message: { content: '   ' } }] })),
          },
        },
      };
    });
    const { generateSmartClarification } = loadLegacyHelpers({
      OpenAI,
      env: { OPENAI_API_KEY: 'openai-key' },
    });

    const answer = await generateSmartClarification('Hej', { intent: 'booking' }, null, null, {});
    expect(answer.toLowerCase()).toContain('vilken stad');
    expect(answer.toLowerCase()).toContain('fordon');
  });

  it('returns a safe clarification when OpenAI throws', async () => {
    const error = vi.fn();
    const OpenAI = vi.fn(function MockOpenAI() {
      return {
        chat: {
          completions: {
            create: vi.fn(async () => {
              throw new Error('clarifier offline');
            }),
          },
        },
      };
    });
    const { generateSmartClarification } = loadLegacyHelpers({
      OpenAI,
      env: { OPENAI_API_KEY: 'openai-key' },
      consoleOverrides: { error },
    });

    const answer = await generateSmartClarification('Behöver hjälp', { intent: 'service_inquiry' }, null, 'BIL', {});
    expect(answer.toLowerCase()).toContain('vilken stad');
    expect(answer.toLowerCase()).toContain('lite mer');
    expect(error.mock.calls.some(([message]) => String(message).includes('[CLARIFICATION]'))).toBe(true);
  });
  it('loads basfakta, office and hybrid knowledge into searchable chunks', () => {
    const miniAddAll = vi.fn();
    const miniRemoveAll = vi.fn();
    const MiniSearch = vi.fn(function MockMiniSearch(config) {
      this.config = config;
      this.addAll = miniAddAll;
      this.removeAll = miniRemoveAll;
    });
    const IntentEngine = vi.fn(function MockIntentEngine(...args) {
      this.args = args;
    });
    const fs = {
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => [
        'basfakta_nollutrymme.json',
        'basfakta_risk1.json',
        'goteborg_ullevi.json',
        'malmo_city.json',
      ]),
      readFileSync: vi.fn((filePath) => {
        const fileName = path.basename(String(filePath));
        if (fileName === 'basfakta_nollutrymme.json') {
          return JSON.stringify({ sections: [{ title: 'Nollutrymme', answer: 'Hall avstand', keywords: ['avstand'] }] });
        }
        if (fileName === 'basfakta_risk1.json') {
          return JSON.stringify({ sections: [{ title: 'Risk 1', answer: 'Risketta info', keywords: ['risketta'], score_boost: 3 }] });
        }
        if (fileName === 'goteborg_ullevi.json') {
          return JSON.stringify({
            id: 'goteborg_ullevi',
            city: 'Goteborg',
            area: 'Ullevi',
            sections: [{ title: 'Handledare', answer: 'Handledarinfo', keywords: ['handledare'] }],
            prices: [
              { service_name: 'Korlektion Bil', price: 799, keywords: ['bil'] },
              { service_name: 'MC-start', price: 1299, keywords: ['mc'] },
            ],
            contact: { address: 'Gata 1', phone: '010-000 00 00', email: 'goteborg@example.com' },
            opening_hours: [{ days: 'Man-Fre', hours: '08-17' }],
            languages: ['Svenska', 'Engelska'],
            booking_links: { CAR: 'https://book.example/car', MC: 'https://book.example/mc' },
            keywords: ['goteborg'],
            description: 'Valkommen till Goteborg',
          });
        }
        if (fileName === 'malmo_city.json') {
          return JSON.stringify({
            id: 'malmo_city',
            city: 'Malmo',
            prices: [{ service_name: 'Korlektion Bil', price: 699, keywords: ['bil'] }],
            contact: { address: 'Gata 2', phone: '010-111 11 11', email: 'malmo@example.com' },
            opening_hours: [{ days: 'Man-Fre', hours: '09-18' }],
            languages: ['Svenska'],
            booking_links: { CAR: 'https://book.example/malmo' },
          });
        }
        return '{}';
      }),
    };
    const log = vi.fn();
    const helpers = loadLegacyHelpers({
      fs,
      MiniSearch,
      IntentEngine,
      knowledgePath: path.join('C:/Atlas', 'knowledge'),
      consoleOverrides: { log },
    });

    helpers.loadKnowledgeBase();

    expect(helpers.getCriticalAnswers()).toEqual([{ title: 'Nollutrymme', answer: 'Hall avstand', keywords: ['avstand'] }]);
    expect(helpers.getKnownCities()).toEqual(['Goteborg', 'Malmo']);
    expect(helpers.getKnownAreas()).toEqual({ ullevi: 'Goteborg' });
    expect(helpers.getCityOffices()).toEqual({ Goteborg: ['Goteborg - Ullevi'], Malmo: ['Malmo'] });
    expect(helpers.getOfficePrices()['Goteborg - Ullevi']).toEqual({ AM: null, BIL: 799, MC: 1299, LASTBIL: null, INTRO: null });
    expect(helpers.getOfficeContactData().goteborg.id).toBe('goteborg_ullevi');
    expect(helpers.getAllChunks().some((chunk) => chunk.type === 'basfakta' && chunk.source === 'basfakta_risk1.json')).toBe(true);
    expect(helpers.getAllChunks().some((chunk) => chunk.type === 'price' && chunk.city === 'Goteborg' && chunk.vehicle === 'BIL')).toBe(true);
    expect(helpers.getAllChunks().some((chunk) => chunk.type === 'kontor_info' && chunk.city === 'Malmo')).toBe(true);
    expect(helpers.getMiniSearch().addAll).toHaveBeenCalledWith(helpers.getAllChunks());
    expect(IntentEngine).toHaveBeenCalledWith(['Goteborg', 'Malmo'], expect.any(Object), expect.any(Object), { ullevi: 'Goteborg' });
    expect(log.mock.calls.some(([message]) => String(message).includes('goteborg_ullevi.json'))).toBe(true);
  });

  it('rebuilds search state on reload and logs parse errors without crashing the knowledge load', () => {
    const miniAddAll = vi.fn();
    const miniRemoveAll = vi.fn();
    const MiniSearch = vi.fn(function MockMiniSearch() {
      this.addAll = miniAddAll;
      this.removeAll = miniRemoveAll;
    });
    const error = vi.fn();
    const fs = {
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn()
        .mockReturnValueOnce(['good.json'])
        .mockReturnValueOnce(['broken.json']),
      readFileSync: vi.fn((filePath) => {
        const fileName = path.basename(String(filePath));
        if (fileName === 'good.json') {
          return JSON.stringify({ city: 'Lund', prices: [{ service_name: 'Korlektion Bil', price: 650, keywords: ['bil'] }], contact: { address: 'Gata 3', phone: '010', email: 'lund@example.com' } });
        }
        return '{bad json';
      }),
    };
    const helpers = loadLegacyHelpers({ fs, MiniSearch, consoleOverrides: { error } });

    helpers.loadKnowledgeBase();
    helpers.loadKnowledgeBase();

    expect(miniRemoveAll).toHaveBeenCalledTimes(1);
    expect(miniAddAll).toHaveBeenCalledTimes(2);
    expect(miniAddAll.mock.calls[1][0]).toEqual([]);
    expect(error.mock.calls.some(([message]) => String(message).includes('Kunde inte läsa eller parsa fil'))).toBe(true);
  });

  it('fails fast when the knowledge folder cannot be read at startup', () => {
    const error = vi.fn();
    const processExit = vi.fn(() => {
      throw new Error('exit 1');
    });
    const fs = {
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => {
        throw new Error('missing knowledge');
      }),
    };
    const helpers = loadLegacyHelpers({ fs, processExit, consoleOverrides: { error } });

    expect(() => helpers.loadKnowledgeBase()).toThrow('exit 1');
    expect(processExit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.some(([message]) => String(message).includes('[FATAL FILE ERROR]'))).toBe(true);
  });
});

















