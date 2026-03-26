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
const fs = require('fs');
const path = require('path');

// --- URL-mappning per regulatoriskt ämne ---
// patterns: nyckelord som matchar frågan (lowercase)
// url: verifierade sidor på Transportstyrelsen.se (alla lowercase-paths)
// key: stabil ID-nyckel för UI-redigering
const TOPIC_URL_MAP = [
{
key: 'TILLSTAND',
patterns: ['körkortstillstånd', 'tillstånd', 'ansöka om körkort', 'ansök om körkort'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/korkortstillstand/'
},
{
key: 'ATERKALLELSE',
patterns: ['körkortsåterkallelse', 'körkortsförlust', 'återkallelse', 'nollning', 'promille', 'rattfylleri', 'förlorar körkortet', 'förlora körkortet', 'förlora körkort', 'förlora sitt körkort', 'körkort dras in', 'körkort tas', 'spärrtid', 'fortkörning körkort'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/forlorat-korkort/aterkallat-korkort/'
},
{
key: 'RISK',
patterns: ['riskutbildning', 'risk 1', 'risk 2', 'halkbana', 'riskettan', 'risktvåan', 'risktvå'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/riskutbildning/riskutbildning-bil/'
},
{
key: 'HANDLEDARE',
patterns: ['handledare', 'handledarskap', 'introduktionsutbildning', 'introkurs', 'övningsköra', 'övningskörning', 'övningskör', 'privat övningskörning'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/handledarskap-och-ovningskorning/introduktionsutbildning/'
},
{
key: 'BE_B96',
patterns: ['be-körkort', 'be körkort', 'be-kort', 'släpvagn', 'b96', 'dragbil', 'utökad b'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/'
},
{
key: 'YKB',
patterns: [
'ykb', 'yrkeskompetensbevis',
'grundutbildning lastbil', 'fortbildning lastbil',
'140 timmar', '35 timmar', 'ykb grundutbildning', 'ykb fortbildning',
'förnya ykb', 'ykb förnyelse', 'ykb-kort',
'ykb 140h', 'ykb 35h'
],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/yrkestrafik/ykb/'
},
{
key: 'CE',
patterns: ['c-körkort', 'ce-körkort', 'lastbilskörkort', 'tung lastbil', 'c1-körkort', 'lastbilsutbildning', 'lastbil utbildning'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/tung-lastbil/c-tung-lastbil/'
},
{
key: 'MC_A',
patterns: ['a-körkort', 'mc-körkort', 'motorcykelkörkort', 'a1-körkort', 'a2-körkort', 'motorcykel körkort'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/'
},
{
key: 'AM_MOPED',
patterns: ['am-körkort', 'moped', 'mopedkörkort', 'moppe', 'mopedbehörighet'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/am-korkort-for-moped-klass-i/'
},
{
key: 'B',
patterns: ['b-körkort', 'ta körkort bil', 'personbil', 'uppkörning', 'körprov', 'teoriprov', 'kunskapsprov', 'teoriprovet', 'kunskapsprovet', 'köra upp', 'ta körkort'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/valj-behorighet/personbil-och-latt-lastbil/b-personbil-och-latt-lastbil/'
},
{
key: 'HALSA',
patterns: ['synskärpa', 'hälsokrav', 'läkarintyg', 'glasögon körkort', 'optiker körkort', 'medicinsk undersökning'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/medicinska-krav/'
},
{
key: 'FORNYA',
patterns: ['förnya körkort', 'förnya körkortet', 'förlängt körkort', 'körkortsförnyelse', 'förnya sitt körkort'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/fornya-korkortet/'
},
{
key: 'INTERNATIONELLT',
patterns: ['internationellt körkort', 'utländskt körkort', 'byta körkort', 'utbyteskörkort', 'körkort utomlands'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/har-korkort/utlandska-korkort/'
},
{
key: 'ALDER',
patterns: ['ålder', 'åldersgräns', 'hur gammal', 'hur ung', 'fylla 18', 'fylla 16', 'lägsta ålder'],
url: 'https://www.transportstyrelsen.se/sv/vagtrafik/korkort/ta-korkort/'
},
];

// Ladda URL-overrides från JSON om filen finns (redigeras via Admin-UI)
try {
const overridePath = path.join(__dirname, 'transportstyrelsen-urls.json');
if (fs.existsSync(overridePath)) {
const overrides = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
for (const entry of TOPIC_URL_MAP) {
if (overrides[entry.key]) entry.url = overrides[entry.key];
}
console.log('[TS-Fallback] URL-overrides laddade från transportstyrelsen-urls.json');
}
} catch (e) {
console.warn('[TS-Fallback] Kunde inte ladda URL-overrides:', e.message);
}

// Företagsspecifika nyckelord — om dessa matchar, blockera fallback
// OBS: 'kostar' och 'pris' är kvar för att blockera VANLIGA prisfrågor till oss
// Men vi tillåter fortfarande TS-fallback om det är regelverk som har officiella priser
const COMPANY_SPECIFIC_KEYWORDS = [
'pris', 'kostar', ' kr', 'rabatt', 'erbjudande',
'boka', 'bokning', 'ledig tid', 'bokningslänk',
'öppettider', 'adress', 'telefon', 'kontakt', 'mail',
'testlektion', 'provlektion', 'prova på',
'paket', 'intensivkurs', 'totalpaket',
'hos er', 'er trafikskola', 'ni erbjuder', 'ni har',
'på er', 'er skola', 'lediga tider', 'boka tid'
];

/**
* Avgör om frågan gäller ett regulatoriskt ämne och returnerar
* en matchande Transportstyrelsen-URL, eller null om ej tillämpligt.
* @param {string} query
* @returns {string|null}
*/
function classifyRegulatoryTopic(query) {
const q = (query || '').toLowerCase();

for (const kw of COMPANY_SPECIFIC_KEYWORDS) {
if (q.includes(kw)) return null;
}

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

// Transportstyrelsen.se har tung navigation i början.
// Hoppa förbi navigationsinnehållet genom att leta efter
// huvudinnehållet efter vanliga landmärken.
const landmarks = [
'huvudinnehall',
'Du är här',
'Återkallat körkort',
'Körkortet kan återkallas',
'Spärrtid',
'Vad händer',
'Om du har förlorat'
];
let startIndex = 0;
for (const mark of landmarks) {
const idx = text.indexOf(mark);
if (idx > 0 && idx < text.length * 0.7) {
startIndex = idx;
break;
}
}
// Ta 3000 tecken från huvudinnehållet, inte från navigationen
if (text.length - startIndex > 3000) {
text = text.substring(startIndex, startIndex + 3000);
} else {
text = text.substring(startIndex);
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

// console.log(`[TS-Fallback] Regulatorisk fråga detekterad. Hämtar: ${url}`);

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

// console.log('[TS-Fallback] Svar returnerat från Transportstyrelsen-fallback.');
const sourceLine = `\n\n📋 *Källa: [Transportstyrelsen.se](${url})* — vill du veta mer eller boka, kan du fortsätta fråga mig!`;
return answer + sourceLine;

} catch (err) {
console.warn('[TS-Fallback] OpenAI-fel:', err.message);
return null;
}
}

module.exports = { tryTransportstyrelseFallback, classifyRegulatoryTopic };