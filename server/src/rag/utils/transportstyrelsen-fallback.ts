// ============================================
// Transportstyrelsen Fallback — fetches regulatory pages
// when RAG can't answer, runs secondary AI call
// Ported from: utils/transportstyrelsen-fallback.js
// ============================================

import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TopicMapping {
  key: string;
  patterns: string[];
  url: string;
}

const TOPIC_URL_MAP: TopicMapping[] = [
  { key: 'TILLSTAND', patterns: ['körkortstillstånd', 'tillstånd', 'ansöka om körkort', 'ansök om körkort'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/' },
  { key: 'ATERKALLELSE', patterns: ['körkortsåterkallelse', 'återkallelse', 'nollning', 'promille', 'rattfylleri', 'spärrtid', 'fortkörning körkort'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/forlorat-korkort/aterkallat-korkort/' },
  { key: 'RISK', patterns: ['riskutbildning', 'risk 1', 'risk 2', 'halkbana', 'riskettan', 'risktvåan'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/' },
  { key: 'HANDLEDARE', patterns: ['handledare', 'handledarskap', 'introduktionsutbildning', 'övningsköra', 'övningskörning'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/introduktionsutbildning/' },
  { key: 'BE_B96', patterns: ['be-körkort', 'be körkort', 'släpvagn', 'b96'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/' },
  { key: 'YKB', patterns: ['ykb', 'yrkeskompetensbevis', '140 timmar', '35 timmar'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/yrkestrafik/ykb/' },
  { key: 'CE', patterns: ['c-körkort', 'ce-körkort', 'lastbilskörkort', 'tung lastbil'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/tung-lastbil/c-tung-lastbil/' },
  { key: 'MC_A', patterns: ['a-körkort', 'mc-körkort', 'motorcykelkörkort'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/' },
  { key: 'AM_MOPED', patterns: ['am-körkort', 'moped', 'mopedkörkort'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/am-korkort-for-moped-klass-i/' },
  { key: 'B', patterns: ['b-körkort', 'ta körkort bil', 'personbil', 'uppkörning', 'körprov', 'teoriprov'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/' },
  { key: 'HALSA', patterns: ['synskärpa', 'hälsokrav', 'läkarintyg', 'glasögon körkort'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/medicinska-krav/' },
  { key: 'FORNYA', patterns: ['förnya körkort', 'körkortsförnyelse'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/fornya-korkortet/' },
  { key: 'INTERNATIONELLT', patterns: ['internationellt körkort', 'utländskt körkort'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/' },
  { key: 'ALDER', patterns: ['ålder', 'åldersgräns', 'hur gammal', 'hur ung'], url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/' },
];

// Company-specific queries that should NOT trigger TS fallback
const COMPANY_KEYWORDS = ['pris', 'kostar', 'boka', 'bokning', 'avbok', 'paket', 'lektion', 'klarna', 'swish', 'faktura'];

function loadUrlOverrides(): void {
  try {
    const overridePath = join(__dirname, '..', '..', '..', '..', 'utils', 'transportstyrelsen-urls.json');
    if (existsSync(overridePath)) {
      const overrides = JSON.parse(readFileSync(overridePath, 'utf-8'));
      if (Array.isArray(overrides)) {
        for (const override of overrides) {
          const existing = TOPIC_URL_MAP.find(t => t.key === override.key);
          if (existing && override.url) {
            existing.url = override.url;
          }
        }
      }
    }
  } catch { /* ignore */ }
}

function classifyRegulatoryTopic(query: string): string | null {
  const lower = query.toLowerCase();

  // Block company-specific queries
  if (COMPANY_KEYWORDS.some(kw => lower.includes(kw))) return null;

  for (const topic of TOPIC_URL_MAP) {
    if (topic.patterns.some(p => lower.includes(p))) {
      return topic.url;
    }
  }
  return null;
}

async function fetchAndCleanPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Atlas-Support/4.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    let html = await res.text();

    // Strip scripts, styles, nav, header, footer
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    html = html.replace(/<header[\s\S]*?<\/header>/gi, '');
    html = html.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    html = html.replace(/<[^>]+>/g, ' ');
    html = html.replace(/\s+/g, ' ').trim();

    // Remove navigation cruft
    const landmarks = ['Du är här', 'Hoppa till innehåll', 'Meny', 'Sök på webbplatsen'];
    for (const lm of landmarks) {
      const idx = html.indexOf(lm);
      if (idx > 0 && idx < 500) {
        html = html.substring(idx + lm.length);
      }
    }

    return html.substring(0, 3000);
  } catch {
    return null;
  }
}

export async function tryTransportstyrelseFallback(
  query: string,
  openaiApiKey: string,
): Promise<{ answer: string | null; url: string | null; used: boolean }> {
  loadUrlOverrides();

  const url = classifyRegulatoryTopic(query);
  if (!url) return { answer: null, url: null, used: false };

  const pageContent = await fetchAndCleanPage(url);
  if (!pageContent) return { answer: null, url, used: true };

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: `Du är en ren fakta-assistent. Svara ENDAST baserat på den bifogade texten från Transportstyrelsen.se.
Om svaret inte finns i texten, svara EXAKT: SVAR_SAKNAS
Svara på svenska. Var koncis och korrekt.`,
        },
        {
          role: 'user',
          content: `FRÅGA: ${query}\n\nTEXT FRÅN TRANSPORTSTYRELSEN:\n${pageContent}`,
        },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer || answer === 'SVAR_SAKNAS') {
      return { answer: null, url, used: true };
    }

    return { answer, url, used: true };
  } catch {
    return { answer: null, url, used: true };
  }
}
