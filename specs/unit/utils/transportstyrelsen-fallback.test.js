const { loadCjsWithMocks } = require('../../helpers/load-cjs-with-mocks');

const modulePath = require.resolve('../../../utils/transportstyrelsen-fallback.ts');
const openaiPath = require.resolve('openai');
const permitQuery = 'Hur l\u00E4nge g\u00E4ller k\u00F6rkortstillst\u00E5ndet?';

describe('utils/transportstyrelsen-fallback', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('blocks company-specific price questions from using the fallback', () => {
    const OpenAI = vi.fn();
    const { module, restore } = loadCjsWithMocks(modulePath, {
      [openaiPath]: OpenAI,
    });

    try {
      expect(module.classifyRegulatoryTopic('Vad kostar handledarkurs hos er?')).toBeNull();
    } finally {
      restore();
    }
  });

  it('maps regulatory permit questions to a Transportstyrelsen URL', () => {
    const OpenAI = vi.fn();
    const { module, restore } = loadCjsWithMocks(modulePath, {
      [openaiPath]: OpenAI,
    });

    try {
      expect(module.classifyRegulatoryTopic(permitQuery)).toContain('korkortstillstand');
    } finally {
      restore();
    }
  });

  it('returns null when no OpenAI API key is configured', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => '<main>Du \u00E4r h\u00E4r K\u00F6rkortstillst\u00E5nd g\u00E4ller i fem \u00E5r.</main>',
    }));

    const OpenAI = vi.fn();
    const { module, restore } = loadCjsWithMocks(modulePath, {
      [openaiPath]: OpenAI,
    });

    try {
      await expect(module.tryTransportstyrelseFallback(permitQuery)).resolves.toBeNull();
      expect(OpenAI).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('returns a sourced fallback answer when Transportstyrelsen text and OpenAI answer exist', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';

    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => '<main>Du \u00E4r h\u00E4r K\u00F6rkortstillst\u00E5nd g\u00E4ller i fem \u00E5r.</main>',
    }));

    const createCompletion = vi.fn(async () => ({
      choices: [{ message: { content: 'K\u00F6rkortstillst\u00E5ndet g\u00E4ller i **5 \u00E5r**.' } }],
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

    const { module, restore } = loadCjsWithMocks(modulePath, {
      [openaiPath]: OpenAI,
    });

    try {
      const result = await module.tryTransportstyrelseFallback(permitQuery);

      expect(result).toContain('K\u00F6rkortstillst\u00E5ndet g\u00E4ller i **5 \u00E5r**.');
      expect(result).toContain('Transportstyrelsen.se');
      expect(createCompletion).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });
});
