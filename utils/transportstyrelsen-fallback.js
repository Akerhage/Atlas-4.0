// ============================================
// utils/transportstyrelsen-fallback.js
// VAD DEN GÖR: När RAG-systemet inte hittar svar på
//              regelrelaterade frågor, hämtar denna modul
//              relevant sida från Transportstyrelsen.se
//              och kör ett andra AI-anrop med strikt
//              no-hallucination-prompt.
// ANVÄNDS AV: server.js (handleChatMessage)
// ============================================

const OpenAI = require('openai');

// --- URL-mappning per regulatoriskt ämne ---
// patterns: nyckelord som matchar frågan (lowercase)
// url: verifierade sidor på Transportstyrelsen.se (alla lowercase-paths)
const TOPIC_URL_MAP = [
  {
    patterns: ['körkortstillstånd', 'tillstånd', 'ansöka om körkort', 'ansök om körkort'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/'
  },
  {
    patterns: ['körkortsåterkallelse', 'körkortsförlust', 'återkallelse', 'nollning', 'promille', 'rattfylleri', 'förlorar körkortet', 'förlora körkortet', 'förlora körkort', 'förlora sitt körkort', 'körkort dras in', 'körkort tas', 'spärrtid', 'fortkörning körkort'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/forlorat-korkort/aterkallat-korkort/'
  },
  {
    patterns: ['riskutbildning', 'risk 1', 'risk 2', 'halkbana', 'riskettan', 'risktvåan', 'risktvå'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/'
  },
  {
    patterns: ['handledare', 'handledarskap', 'introduktionsutbildning', 'introkurs', 'övningsköra', 'övningskörning', 'övningskör', 'privat övningskörning'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/introduktionsutbildning/'
  },
  {
    patterns: ['be-körkort', 'be körkort', 'be-kort', 'släpvagn', 'b96', 'dragbil', 'utökad b'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/'
  },
  {
    patterns: ['c-körkort', 'ce-körkort', 'lastbilskörkort', 'ykb', 'tung lastbil', 'c1-körkort'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/tung-lastbil/c-tung-lastbil/'
  },
  {
    patterns: ['a-körkort', 'mc-körkort', 'motorcykelkörkort', 'a1-körkort', 'a2-körkort', 'motorcykel körkort'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/'
  },
  {
    patterns: ['am-körkort', 'moped', 'mopedkörkort', 'moppe', 'mopedbehörighet'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/'
  },
  {
    patterns: ['b-körkort', 'ta körkort bil', 'personbil', 'uppkörning', 'körprov', 'teoriprov', 'kunskapsprov', 'teoriprovet', 'kunskapsprovet', 'köra upp', 'ta körkort'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/'
  },
  {
    patterns: ['synskärpa', 'hälsokrav', 'läkarintyg', 'glasögon körkort', 'optiker körkort', 'medicinsk undersökning'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/'
  },
  {
    patterns: ['förnya körkort', 'förnya körkortet', 'förlängt körkort', 'körkortsförnyelse', 'förnya sitt körkort'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/fornya-korkortet/'
  },
  {
    patterns: ['internationellt körkort', 'utländskt körkort', 'byta körkort', 'utbyteskörkort', 'körkort utomlands'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/'
  },
  {
    patterns: ['ålder', 'åldersgräns', 'hur gammal', 'hur ung', 'fylla 18', 'fylla 16', 'lägsta ålder'],
    url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/'
  },
];

// Företagsspecifika nyckelord — om dessa matchar, blockera fallback
// (frågor om pris/bokning/kontakt tillhör trafikskolan, inte Transportstyrelsen)
const COMPANY_SPECIFIC_KEYWORDS = [
  'pris', 'kostar', ' kr', 'rabatt', 'erbjudande',
  'boka', 'bokning', 'ledig tid', 'bokningslänk',
  'öppettider', 'adress', 'telefon', 'kontakt', 'mail',
  'testlektion', 'provlektion', 'prova på',
  'paket', 'intensivkurs', 'totalpaket',
  'hos er', 'er trafikskola', 'ni erbjuder', 'ni har',
  'på er', 'er skola',
];

/**
 * Avgör om frågan gäller ett regulatoriskt ämne och returnerar
 * en matchande Transportstyrelsen-URL, eller null om ej tillämpligt.
 * @param {string} query
 * @returns {string|null}
 */
function classifyRegulatoryTopic(query) {
  const q = (query || '').toLowerCase();

  // Blockera om frågan är företagsspecifik
  for (const kw of COMPANY_SPECIFIC_KEYWORDS) {
    if (q.includes(kw)) return null;
  }

  // Matcha mot TOPIC_URL_MAP
  for (const entry of TOPIC_URL_MAP) {
    for (const pattern of entry.patterns) {
      if (q.includes(pattern.toLowerCase())) {
        return entry.url;
      }
    }
  }

  console.log(`[TS-Fallback] Ingen regulatorisk matchning för: "${q.substring(0, 60)}"`);
  return null;
}

/**
 * Hämtar en Transportstyrelsen-sida och returnerar rengjord text (max 3000 tecken).
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchAndCleanPage(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'sv-SE,sv;q=0.9', 'User-Agent': 'Atlas/3.0 (trafikskola-assistant)' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[TS-Fallback] HTTP ${response.status} för ${url}`);
      return null;
    }

    const html = await response.text();

    // Strippa HTML-taggar och rensa whitespace
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Begränsa till 3000 tecken — ta mittenpartiet (brukar ha mest innehåll)
    if (text.length > 3000) {
      const start = Math.floor((text.length - 3000) / 2);
      text = text.substring(start, start + 3000);
    }

    return text || null;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[TS-Fallback] Timeout för ${url}`);
    } else {
      console.warn(`[TS-Fallback] Fetch-fel för ${url}:`, err.message);
    }
    return null;
  }
}

/**
 * Huvud-entry-point. Försöker svara på en fråga via Transportstyrelsen-fallback.
 * Returnerar svars-strängen eller null om ingen matchning/svar hittades.
 * @param {string} query — Kundens ursprungliga fråga
 * @returns {Promise<string|null>}
 */
async function tryTransportstyrelseFallback(query) {
  // 1. Avgör om frågan är regulatorisk
  const url = classifyRegulatoryTopic(query);
  if (!url) return null;

  console.log(`[TS-Fallback] Regulatorisk fråga detekterad. Hämtar: ${url}`);

  // 2. Hämta sidan
  const pageContent = await fetchAndCleanPage(url);
  if (!pageContent) return null;

  // 3. Kör AI-anrop med strikt no-hallucination-prompt
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const openai = new OpenAI({ apiKey });

    const systemPrompt = `Du är Atlas — en faktasäker kundtjänstassistent för en svensk trafikskola.

REGLER (OBLIGATORISKA, GÄLLER UTAN UNDANTAG):
1. Svara ENDAST utifrån den bifogade texten från Transportstyrelsen.
2. Om svaret INTE finns i texten: svara med exakt ordet "SVAR_SAKNAS" och inget annat.
3. Lägg ALDRIG till information som inte finns i texten.
4. Ändra ALDRIG fakta, siffror, tider eller krav från texten.
5. Svara alltid på svenska. Använd **fetstil** för viktiga fakta (priser, åldrar, krav).
6. Avsluta alltid varje svar med en ny rad: "Källa: Transportstyrelsen.se"

BIFOGAD TEXT FRÅN TRANSPORTSTYRELSEN:
${pageContent}`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      max_tokens: 400,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim() || '';

    // Om AI inte hittade svar i texten
    if (!answer || answer.trim().startsWith('SVAR_SAKNAS')) {
      console.log('[TS-Fallback] AI hittade inget svar i Transportstyrelsen-texten.');
      return null;
    }

    console.log('[TS-Fallback] Svar returnerat från Transportstyrelsen-fallback.');
    return answer;

  } catch (err) {
    console.warn('[TS-Fallback] OpenAI-fel:', err.message);
    return null;
  }
}

module.exports = { tryTransportstyrelseFallback, classifyRegulatoryTopic };
