// ============================================
// legacy_engine.js
// VAD DEN GÖR: Stateless RAG-motor. Laddar kunskapsbas, kör NLU/intent, bygger kontext och anropar OpenAI.
// ANVÄNDS AV: server.js (via runLegacyFlow + loadKnowledgeBase)
// ============================================
// ARKITEKTUR: Inject State → Execute Logic → Extract State → Return till V3 Server

// =============================================================================
// SECTION 1: ENVIRONMENT & CONFIGURATION
// =============================================================================

const PORT = 3001;
process.env.LANG = 'sv_SE.UTF-8';

// Modul-importer
const fs          = require('fs');
const path        = require('path');
const MiniSearch  = require('minisearch');
const OpenAI      = require('openai');
const crypto      = require('crypto');

// 🛑 DUAL-MODE PATH SELECTOR (DEN EXAKTA LÖSNINGEN)
// 1. Utveckling: Vi kollar om C:\Atlas\package.json finns.
// 2. Produktion: Vi använder Electron's resourcesPath.

let SERVER_ROOT;
const DEV_PATH = 'C:\\Atlas';

// Development Mode Detection
if (fs.existsSync(DEV_PATH) && fs.existsSync(path.join(DEV_PATH, 'package.json'))) {
SERVER_ROOT = DEV_PATH;
console.log(`[Legacy Engine] 🔧 UTVECKLARLÄGE: Tvingad till ${SERVER_ROOT}`);
} else {

// Production Mode (Electron ASAR)
SERVER_ROOT = process.env.ATLAS_ROOT_PATH || process.resourcesPath || __dirname;

if (SERVER_ROOT.includes('app.asar')) {
SERVER_ROOT = path.dirname(SERVER_ROOT);
}
console.log(`[Legacy Engine] 📦 PRODUKTIONSLÄGE: Detekterad ${SERVER_ROOT}`);
}

// Path Validation & Emergency Rescue
if (!fs.existsSync(path.join(SERVER_ROOT, 'patch'))) {
console.error(`❌ [CRITICAL] Patch-mappen saknas på: ${path.join(SERVER_ROOT, 'patch')}`);

if (fs.existsSync(path.join(__dirname, 'patch'))) {
SERVER_ROOT = __dirname;
console.log(`   ✅ [RESCUE] Hittade patch i __dirname, bytte till: ${SERVER_ROOT}`);
}
}

console.log(`[Legacy Engine] 🔒 FINAL SERVER_ROOT: ${SERVER_ROOT}`);

// DEFINIERA EXAKTA SÖKVÄGAR
const PATCH_PATH     = path.join(SERVER_ROOT, 'patch');
const UTILS_PATH     = path.join(SERVER_ROOT, 'utils');

// LADDA MODULER (Patch & Utils)
let ForceAddEngine, IntentEngine, contextLock, priceResolver, INTENT_PATTERNS;

try {
console.log(`[Legacy Engine] 🔍 Letar patchar i: ${PATCH_PATH}`);

// Kasta fel direkt om mappen saknas
if (!fs.existsSync(PATCH_PATH)) throw new Error(`Patch-mappen saknas på: ${PATCH_PATH}`);

// Ladda Patchar
ForceAddEngine = require(path.join(PATCH_PATH, 'forceAddEngine'));
const intentModule = require(path.join(PATCH_PATH, 'intentEngine'));
IntentEngine = intentModule.IntentEngine;
INTENT_PATTERNS = intentModule.INTENT_PATTERNS;

// Ladda Utils
if (fs.existsSync(path.join(UTILS_PATH, 'contextLock.js'))) {
contextLock = require(path.join(UTILS_PATH, 'contextLock'));
} else {
console.warn("⚠️ contextLock.js hittades inte i utils.");
}

if (fs.existsSync(path.join(UTILS_PATH, 'priceResolver.js'))) {
priceResolver = require(path.join(UTILS_PATH, 'priceResolver'));
} else {
console.warn("⚠️ priceResolver.js hittades inte i utils.");
}

console.log("✅ [Legacy Engine] Alla moduler (Patch & Utils) laddade.");

} catch (e) {
console.error("❌ [FATAL] Kunde inte ladda Legacy Engine-moduler:", e.message);

// Nödfallslösning för att inte krascha servern
ForceAddEngine = class { constructor() { this.mustAddChunks = []; } execute() { return { mustAddChunks: [], forceHighConfidence: false }; } };
IntentEngine = class { parseIntent() { return { intent: 'unknown', slots: {} }; } };
}

// Temporär Sessions-lagring
const sessions = new Map();

// ====================================================================
// SECTION 2: SESSION & STATE MANAGEMENT UTILS
// ====================================================================

// generateSessionId - Create Unique Session Identifier
function generateSessionId() {
return crypto.randomBytes(16).toString('hex');
}

// createEmptySession - Initialize New Session Object
function createEmptySession(sessionId) {
const newSession = {
id: sessionId,
created: Date.now(),
messages: [],
locked_context: {city: null,area: null,vehicle: null},
linksSentByVehicle: {AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false}, 
isFirstMessage: true
};
sessions.set(sessionId, newSession);
return newSession;
}

// appendToSession - Add Message to Session History
function appendToSession(sessionId, role, content) {
const session = sessions.get(sessionId);
if (!session) return;
session.messages.push({ role, content, timestamp: Date.now() });
}

// getResourcePath - Smart Path Resolution Helper
function getResourcePath(filename) {
const checkPath = path.join(SERVER_ROOT, filename);
if (fs.existsSync(checkPath)) return checkPath;

// 2. Fallback för env/dev
if (process.env.ATLAS_ROOT_PATH) {
return path.join(process.env.ATLAS_ROOT_PATH, filename);
}
return path.join(__dirname, filename);
}

// ENVIRONMENT LOADING & API CONFIGURATION
// Ladda .env-filer
const dotenvPath = getResourcePath('.env');
require('dotenv').config({ path: dotenvPath });

// API Keys & External Services
const CLIENT_API_KEY      = process.env.CLIENT_API_KEY;
const OPENAI_API_KEY      = process.env.OPENAI_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

if (!OPENAI_API_KEY) {
console.error('FEL: OPENAI_API_KEY saknas i .env (Legacy Engine)');
}

console.log('Legacy Engine: OpenAI-klient initialiserad.');

// --- Knowledge Base Paths ---
let KNOWLEDGE_PATH = path.join(SERVER_ROOT, 'knowledge');
if (!fs.existsSync(KNOWLEDGE_PATH)) {
// Fallback: kolla bredvid scriptet om SERVER_ROOT pekade fel
KNOWLEDGE_PATH = path.join(__dirname, 'knowledge');
}
console.log("📢 KNOWLEDGE_PATH satt till:", KNOWLEDGE_PATH);

if (!fs.existsSync(KNOWLEDGE_PATH)) {
console.error(`FATAL: Knowledge-mappen saknas på: ${KNOWLEDGE_PATH}`);
}

const SYSTEM_PROMPT_PATH = getResourcePath('systembeskrivning.md');
const CONFIG_PATH = getResourcePath('config.json');

// OpenAI Client Initialization
const openai = new OpenAI({apiKey: OPENAI_API_KEY});

// ====================================================================
// SECTION 3: GLOBAL STATE & MEMORY (Read-Only after Init)
// ====================================================================
const VERSION = '3.4 - Atlas Legacy Engine';

// Knowledge Base Storage
let miniSearch;
let allChunks = [];
let knownCities = [];
let knownAreas = {};
let cityOffices = {};
let officePrices = {};
let officeContactData = {};
let officeData = {};
let chunkMap = new Map();
let intentEngine;
let criticalAnswers = [];
let bookingLinks = {};

// rebuildChunkMap - Index Chunks by ID
function rebuildChunkMap() {
if (!Array.isArray(allChunks)) {
chunkMap = new Map();
return;
}
chunkMap = new Map(allChunks.map(c => [c.id, c]));
}

// Search & Confidence Thresholds
const LOW_CONFIDENCE_THRESHOLD = 0.25;
const LOW_CONFIDENCE_SLICE = 8;
const MAX_CHUNKS = 18;

// =============================================================================
// SECTION 3.1: CITY & VEHICLE ALIASES (NLU Mapping)
// =============================================================================

const CITY_ALIASES = {
// --- Stockholm (inkl. Djursholm, Enskededalen, Kungsholmen, Österåker, Östermalm, Södermalm, Solna) ---
'stockholm': 'Stockholm',
'sthlm': 'Stockholm',
'djursholm': 'Stockholm',
'enskededalen': 'Stockholm',
'kungsholmen': 'Stockholm',
'lindhagsplan': 'Stockholm',
'osteraker': 'Stockholm',
'osteråker': 'Stockholm',
'österaker': 'Stockholm',
'österåker': 'Stockholm',
'ostermalm': 'Stockholm',
'ostermälm': 'Stockholm',
'östermalm': 'Stockholm',
'sodermalm': 'Stockholm',
'södermalm': 'Stockholm',
'solna': 'Stockholm',

// --- Göteborg (inkl. Högsbo, Mölndal, Mölnlycke, Stora Holm, Ullevi, Västra Frölunda) ---
'goteborg': 'Göteborg',
'göteborg': 'Göteborg',
'gbg': 'Göteborg',
'gothenburg': 'Göteborg',
'hogsbo': 'Göteborg',
'högsbo': 'Göteborg',
'molndal': 'Göteborg',
'mölndal': 'Göteborg',
'molnlycke': 'Göteborg',
'mölnlycke': 'Göteborg',
'stora holm': 'Göteborg',
'storaholm': 'Göteborg',
'ullevi': 'Göteborg',
'frölunda': 'Göteborg',
'frolunda': 'Göteborg',
'vastra frolunda': 'Göteborg',
'västra frölunda': 'Göteborg',
'hovas': 'Göteborg',
'hovås': 'Göteborg',
'dingle': 'Göteborg',
'kungalv': 'Göteborg',
'kungälv': 'Göteborg',
'aby': 'Göteborg',
'åby': 'Göteborg',

// --- Malmö (inkl. Bulltofta, Limhamn, Södervärn, Triangeln, Värnhem, Västra Hamnen) ---
'malmo': 'Malmö',
'malmö': 'Malmö',
'bulltofta': 'Malmö',
'limhamn': 'Malmö',
'jägersro': 'Malmö',
'jagersro': 'Malmö',
'hamnen': 'Malmö',
'sodervarn': 'Malmö',
'sodervärn': 'Malmö',
'södervarn': 'Malmö',
'södervärn': 'Malmö',
'triangeln': 'Malmö',
'varnhem': 'Malmö',
'värnhem': 'Malmö',
'vastra hamnen': 'Malmö',
'västra hamnen': 'Malmö',
'vastra_hamnen': 'Malmö',

// --- Helsingborg (inkl. Hälsobacken) ---
'helsingborg': 'Helsingborg',
'halsobacken': 'Helsingborg',
'hälsobacken': 'Helsingborg',

// --- Lund (inkl. Katedral, Södertull) ---
'lund': 'Lund',
'katedral': 'Lund',
'sodertull': 'Lund',
'södertull': 'Lund',

// --- Övriga Orter ---
'angelholm': 'Ängelholm',
'ängelholm': 'Ängelholm',
'eslov': 'Eslöv',
'eslöv': 'Eslöv',
'gavle': 'Gävle',
'gävle': 'Gävle',
'hassleholm': 'Hässleholm',
'hässleholm': 'Hässleholm',
'hollviken': 'Höllviken',
'höllviken': 'Höllviken',
'kalmar': 'Kalmar',
'kristianstad': 'Kristianstad',
'kungsbacka': 'Kungsbacka',
'landskrona': 'Landskrona',
'linkoping': 'Linköping',
'linköping': 'Linköping',
'trelleborg': 'Trelleborg',
'umea': 'Umeå',
'umeå': 'Umeå',
'uppsala': 'Uppsala',
'varberg': 'Varberg',
'vasteras': 'Västerås',
'västeras': 'Västerås',
'vasterås': 'Västerås',
'västerås': 'Västerås',
'vaxjo': 'Växjö',
'växjo': 'Växjö',
'vaxjö': 'Växjö',
'växjö': 'Växjö',
'vellinge': 'Vellinge',
'ystad': 'Ystad'
};

const VEHICLE_MAP = {
'SLÄP': ['be', 'be-kort', 'be körkort', 'be-körkort', 'b96', 'släp', 'tungt släp', 'utökad b'],
'LASTBIL': ['lastbil', 'c', 'c1', 'c1e', 'ce', 'c-körkort', 'tung lastbil', 'medeltung lastbil', 'tung trafik', 'tungt fordon', 'tunga fordon'],
'AM': ['am', 'moped', 'mopedutbildning', 'moppe', 'klass 1'],
'BIL': ['bil', 'personbil', 'b-körkort', 'b körkort', 'körlektion bil', 'körlektion personbil'],
'MC': ['mc', 'motorcykel', 'a1', 'a2', 'a-körkort', '125cc', '125 cc', 'lätt motorcykel', 'tung motorcykel'],
'INTRO': ['introduktionskurs', 'handledarkurs', 'handledare']
};

const UNIFIED_SYNONYMS = {
// === VIKTIGA BEGREPPS-KOPPLINGAR ===
'behöver gå': ['måste gå', 'krävs', 'genomföra', 'obligatorisk', 'behöver genomföra'],
'obligatorisk': ['krav', 'måste', 'krävs', 'obligatoriskt moment'],
'göra om': ['ta om', 'göra om', 'genomföra på nytt', 'underkänd'],
'två elever': ['två elever', '2 elever'],
'handledare': ['handledare', 'din handledare', 'handledaren', 'privat handledare', 'handledarskap', 'introduktionskurs'],
'elev': ['du som ska ta körkort', 'du som elev', 'elev', 'student'],
'privat körning': ['privat övningskörning', 'övningsköra privat', 'köra hemma'],
'övningskör': ['övningskör', 'övningsköra', 'träna körning', 'körträning'],
'körkortstillstånd': ['tillstånd', 'krävs', 'giltigt', 'handledarintyg', 'grupp 1'],
'giltighetstid': ['giltighetstid', 'hur länge gäller', 'giltighet', 'förfaller', 'utgår'],
'prövotid': ['prövotid', '2 år', 'förarprov', 'göra om prov', 'körkort indraget', 'återkallat körkort'],
'syntest': ['syntest', 'synundersökning', 'synprov', 'synintyg', 'optiker'],

// === MÅTT & TID ===
'14 år och 9 månader': ['14 år och 9 månader', '14,5 år', '14 år 9 mån', 'övningsköra moped'],
'15 år': ['15 år', '15-åring', 'myndig moped'],
'16 år': ['16 år', '16-åring', 'övningsköra bil'],
'18 år': ['18 år', '18-åring', 'myndig'],
'24 år': ['24 år', '24-åring', 'krav för handledare'],
'2 år': ['2 år', 'två år', 'prövotid'],
'5 år': ['5 år', 'fem år', 'giltighetstid intro'],
'3 månader': ['3 månader', 'tre månader'],
'17 timmar': ['17 timmar', 'minst 17 timmar', 'am kurslängd'], // Specifikt för AM
'320 minuter': ['320 minuter', 'trafikkörning am', '4 x 80 min'], // Specifikt för AM

// === LEKTIONSLÄNGDER (VIKTIGT FÖR PRISER) ===
'80 min': ['80 min', '80 minuter', 'standardlektion', 'körlektion'],
'40 min': ['40 min', '40 minuter', 'halv lektion'],
'100 min': ['100 min', '100 minuter', 'dubbel lektion'],
'3,5 timmar': ['3,5 timmar', 'tre och en halv timme', 'riskettan tid'],

// === FORDON & KURSER ===
'am': ['am', 'moped', 'moped klass 1', 'eu-moped', 'moppe', 'am-kort'],
'mc': ['mc', 'motorcykel', 'a-behörighet', 'a1', 'a2', 'tung mc', 'lätt mc'],
'motorcykel': ['mc', 'motorcykel', 'motorcyklar', 'vilka mc', 'vilken mc', 'yamaha', 'mt-07', 'motorcykel typ'],
'bil': ['bil', 'personbil', 'b-körkort', 'b-behörighet'],
'automat': ['automat', 'automatväxlad', 'villkor 78', 'kod 78'],
'manuell': ['manuell', 'växlad bil'],
'risk 1': ['risk 1', 'riskettan', 'riskutbildning del 1', 'alkohol och droger'],
'risk 2': ['risk 2', 'risktvåan', 'halkbana', 'halka', 'hal utbildning'],
'halkbanan': ['risk 2', 'risktvåan', 'stora holm', 'gillinge'], // Specifika banor
'intro': ['introduktionskurs', 'handledarkurs', 'handledarutbildning'],

// === PLATSER (KOLLAR MOT DIN LISTA) ===
'stora holm': ['stora holm', 'halkbana göteborg', 'manöverbana göteborg'],
'göteborg': ['göteborg', 'gbg', 'gothenburg'],
'stockholm': ['stockholm', 'sthlm', '08'],

// === BETALNING & KONTAKT ===
'avbokning': ['avbokning', 'avboka', 'omboka', 'återbud', 'sjuk'],
'avboka': ['avbokning', 'avboka', 'omboka'],
'rabatt': ['rabatt', 'studentrabatt', 'kampanj', 'erbjudande', 'billigare'],
'pris': ['pris', 'kostar', 'kostnad', 'avgift', 'prislapp', 'vad tar ni'],
'betalning': ['betalning', 'betala', 'betalningsalternativ', 'hur betalar jag', 'betala med'],
'betala': ['betalning', 'betala', 'betalningsalternativ'],
'delbetalning': ['faktura', 'delbetala', 'delbetalning', 'klarna', 'avbetalning'],
'delbetala': ['delbetalning', 'faktura', 'klarna'],
'faktura': ['faktura', 'klarna', 'delbetala', 'kredit', 'scancloud', 'delbetalning', 'swish', 'kort','fe 7283'],
'boka': ['boka', 'bokning', 'reservera', 'anmäla', 'köpa'],
'bokning': ['boka', 'bokning', 'reservera'],
'bokar': ['boka', 'bokning'],
'kontakt': ['kontakt', 'telefon', 'ring', 'maila', 'e-post', 'support', 'kundtjänst', 'öppettider']
};

// ====================================================================
// SECTION 4: TEXT PROCESSING & TOOLS
// ====================================================================

// expandQuery - Add Synonyms to Search Query
function expandQuery(query) {
let expanded = query.toLowerCase();
for (const [key, synonyms] of Object.entries(UNIFIED_SYNONYMS)) {
if (expanded.includes(key.toLowerCase())) {
const limited = synonyms.slice(0, 2);
limited.forEach(syn => expanded += ' ' + syn.toLowerCase());
}
}
if (expanded.length > 250) {
expanded = expanded.substring(0, 250);
}
return expanded;
}

// isBasfaktaType - Check if Chunk is Base Knowledge
function isBasfaktaType(c) {
if (!c) return false;
const t = (c.type || '').toString().toLowerCase();
const s = (c.source || '').toLowerCase();
// Om den har typ basfakta ELLER kommer från en fil som börjar på basfakta_
return t.includes('basfakta') || s.startsWith('basfakta_');
}

// normalizeText - Clean & Normalize User Input
function normalizeText(s) {
if (!s) return '';
return s.toString()
.toLowerCase()
.normalize('NFD').replace(/[\u0300-\u036f]/g, "") 
.replace(/\b(\d+)\s?cc\b/g, '$1 cc')
.replace(/\b(\d+)\s?k\s?w\b/g, '$1 kW')
.replace(/[^\w\s\d]/g, ' ')
.replace(/\s+/g, ' ')
.trim();
}

// normalizedExpandQuery - Normalize + Expand Query
function normalizedExpandQuery(q) {
const normalized = normalizeText(q);
return expandQuery(normalized);
}

// isLowConfidence - Check if Search Results Are Weak
function isLowConfidence(results) {
if (!results || results.length === 0) return true;
const best = results[0];
return (typeof best.score === 'number') ? (best.score < LOW_CONFIDENCE_THRESHOLD) : true;
}

// ====================================================================
// SECTION 4.1: EXTERNAL TOOLS (Weather, Jokes, Prices)
// ====================================================================

// get_joke - Return Random Joke
async function get_joke() {
try {
const jokes = [
"– Har du sett den nya filmen om lastbilar? - Nä, men jag har sett trailern 😅",
"– Var hittar jag däck med svensk text? Här finns ju bara dubbade. 😅",
"-Är det här jag ska stoppa in bensinslangen? – Ja, det är det som är tanken! 😅"
];
const joke = jokes[Math.floor(Math.random() * jokes.length)];
return { joke };
} catch (e) {
return { joke: "Jag har inga skämt just nu 😅" };
}
}

// get_quote - Return Inspirational Quote
async function get_quote() {
try {
const quotes = [
"Den bästa tiden att börja var igår. Den näst bästa är idag.",
"Framgång kommer av små steg tagna varje dag.",
"Gör ditt bästa idag – framtiden tackar dig."
];
const quote = quotes[Math.floor(Math.random() * quotes.length)];
return { quote };
} catch (e) {
return { quote: "Kunde inte hämta ett citat just nu." };
}
}

// fetchWeather - Get Weather Data from OpenWeather API
async function fetchWeather(rawCity) {
const city = (rawCity || 'Stockholm').toString().toLowerCase().trim();
const normalizedCity = CITY_ALIASES[city] || city;
const targetCity = normalizedCity || 'Stockholm';
const apiKey = process.env.OPENWEATHER_API_KEY;
if (!apiKey) {
return { error: "OpenWeather API-nyckel saknas" };
}
const url = `https://api.openweathermap.org/data/2.5/weather?q=${targetCity},SE&appid=${apiKey}&units=metric&lang=sv`;
try {
const res = await fetch(url);
const data = await res.json();
if (data.cod !== 200) {
return { error: `Kunde inte hämta väder för ${targetCity}` };
}

return {
city: data.name,
temperature: Math.round(data.main.temp),
description: data.weather[0].description
};
} catch (e) {
console.error('[WEATHER ERROR]', e.message);
return { error: "Väder-API:t svarar inte" };
}
}

// calculate_price - Simple Price Calculation Tool
async function calculate_price(amount, unit_price) {
try {
const total = amount * unit_price;
return { total };
} catch (e) {
return { error: "Kunde inte räkna ut priset." };
}
}

// generate_image - DALL-E Image Generation (Placeholder)
async function generate_image(prompt) {
try {
const res = await openai.images.generate({
model: "gpt-image-1",
prompt: prompt,
size: "1024x1024"
});
const imageBase64 = res.data[0].b64_json;
return { image: imageBase64 };
} catch (e) {
console.error("Image generation error:", e);
return { error: "Kunde inte generera bilden." };
}
}

// GLOBAL TOOL DEFINITION (OpenAI Function Calling)
const globalAvailableTools = [
{ type: "function", function: { name: "get_weather", description: "Hämtar väder för en svensk stad.", parameters: { type: "object", properties: { city: { type: "string", description: "Stad i Sverige" } }, required: ["city"] } } },
{ type: "function", function: { name: "get_joke", description: "Returnerar ett slumpmässigt skämt." } },
{ type: "function", function: { name: "get_quote", description: "Returnerar ett inspirerande citat." } },
{ type: "function", function: { name: "calculate_price", description: "Räknar ut totalpris.", parameters: { type: "object", properties: { amount: { type: "number" }, unit_price: { type: "number" } }, required: ["amount", "unit_price"] } } },
{ type: "function", function: { name: "generate_image", description: "Genererar en bild baserat på en prompt.", parameters: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } } }
];

// ====================================================================
// SECTION 5: AI & RAG LOGIC
// ====================================================================

// === SYSTEM PROMPT FUNCTION AND RAG ANSWER GENERATOR
async function generate_rag_answer(userQuestion, retrievedContext, detectedCity, detectedArea, isFirstMessage = false, mode = 'knowledge', localAvailabilityNote = '') {

// === HÄLSNINGS-LOGIK
let timeGreeting = "";
if (isFirstMessage) {
const hour = new Date().getHours();
if (hour >= 5 && hour < 10) timeGreeting = "God morgon! ";
else if (hour >= 10 && hour < 17) timeGreeting = "Hej! ";
else if (hour >= 17 && hour < 22) timeGreeting = "God kväll! ";
else timeGreeting = "Hej! ";
}

const greetingInstruction = isFirstMessage
? `Börja alltid svaret med EXAKT: "${timeGreeting}" och fortsätt sedan direkt med svaret.`
: `Hälsa aldrig - gå rakt på sak.`;

const cityInclusionInstruction = detectedCity
? `\n\nOBS: Om frågan är platsberoende, MÅSTE du inkludera staden i svaret. Exempel: "I ${detectedCity} erbjuder vi ..." eller "På vårt kontor i ${detectedCity} ...".`
: '';

// === SYSTEM PROMPT - KNOWLEDGE/RAG-MODE
let systemPrompt = `
Du är Atlas — en varm, hjälpsam och faktasäker kundtjänstassistent för en svensk trafikskola.

// === KRITISKA SVARSREGLER (DESSA GÄLLER ÖVER ALL ANNAN KONTEXT) ===
Du MÅSTE följa dessa regler slaviskt, även om kontexten verkar vag:

1. **MC-LEKTIONER:** PRIORITERA ALLTID svaret: "15-20 lektioner behövs vanligtvis för din **MC-utbildning**, individuellt". (Nämn intensivvecka + 5 lektioner endast som ett tillägg).
2. **AUTOMAT:** INKLUDERA ALLTID: "**villkor 78**" (automat) kod.
3. **GILTIGHETSTID:** - **Köp & Paket:** Giltighetstiden på alla köp av tjänster, paket och lektioner är **2 år (24 månader)**.
- **Genomförda kurser:** Giltighetstiden på genomförda kurser (Riskutbildningar, Handledarkurser/Introduktionskurser) samt Körkortstillstånd är alltid **5 år**.

// === REGLER FÖR DATAHANTERING & HALLUCINATION ===
- **KONTAKTINFO-TVÅNG:** Om kontexten innehåller siffror (telefon, orgnr, adress), MÅSTE du skriva ut dem.
- **<EXACT_FACT> REGEL:** Om kontexten innehåller text inom <EXACT_FACT>...</EXACT_FACT>: 1. Använd EXAKT den texten. 2. Tolka inte. 3. Lägg inte till "vanligtvis".
- **KOMPLEXA SVAR:** Om frågan har flera delar (t.ex. pris OCH innehåll), MÅSTE du använda en punktlista.

// === TON & FORMAT ===
- Var varm, rådgivande och mänsklig i språket.
- Skriv fullständiga meningar, tydligt och kortfattat.
- Använd fetstil för priser, kursnamn och viktiga fakta: **så här**.
- Om frågan kräver ett artigt inledande (första svar i sessionen) ska hälsningen hanteras av servern.

// === FÖRBUD & RULES ===
- ANVÄND ENDAST information från KONTEXTEN. Skapa aldrig ny fakta.
- ÄNDRA aldrig pris, tider, telefonnummer, eller andra fakta från kontexten.
- Säg aldrig bokningslänkar — servern lägger in dessa automatiskt.
- **LOKALT UTBUD (KRITISKT):** Bekräfta ALDRIG att en specifik kurs, tjänst eller utbildning erbjuds på ett specifikt kontor eller ort, om det inte finns ett chunk i kontexten som explicit och direkt bekräftar detta för just det kontoret/orten. Generell kursinformation, nationella priser eller basfakta om en kurs bekräftar INTE att kursen erbjuds lokalt. Om lokal bekräftelse saknas: tillämpa FALLBACK-regeln nedan.

// === KANONFRASER (Använd exakt när ämnet tas upp) ===
- Testlektion: "Testlektion (även kallad provlektion eller prova-på) är ett nivåtest för bil-elever och kan endast bokas en gång per elev."
- Startlektion MC: "Startlektion är nivåbedömning, 80 minuter inför MC intensivvecka."
- Riskutbildning: "Risk 1 är cirka 3,5 timmar och Risk 2 är 4–5 timmar och kan göras i vilken ordning som helst."
- Handledare: "Handledaren måste vara minst 24 år, haft körkort i minst 5 av de senaste 10 åren och både elev och handledare behöver gå introduktionskurs."
- Automat: "Automat ger villkor 78."

// === FALLBACK (INTELLIGENT) ===
- Om information saknas i kontexten: GISSA ALDRIG priser, tider, tillgänglighet eller annat du inte vet.
- Analysera istället VAD kunden frågar om och formulera ett kortfattat, mänskligt svar (max 2–3 meningar) som:
  1. Erkänner att du inte har den specifika informationen
  2. Förklarar KORT varför om det är uppenbart (t.ex. att bokningsscheman/lediga tider inte finns i databasen, eller att du behöver veta stad och fordonstyp för att ge rätt svar)
  3. Hänvisar till ett konkret nästa steg: be om mer info om frågan är för vag, tipsa om hemsidan för bokning/tider, eller föreslå att kunden klickar på headset-knappen för direkt kontakt med en handläggare
- Var varm och mänsklig — förklara, gissa inte.

LÄS NEDAN KONTEXT NOGA OCH SVARA UTIFRÅN DEN (MEN FÖLJ DE KRITISKA REGLERNA ÖVERST):
<<KONTEXT_BIFOGAD_AV_SERVERN>>
Svara alltid på svenska.
Använd **text** (dubbelstjärnor) för att fetmarkera priser och andra viktiga fakta.

${greetingInstruction}
${cityInclusionInstruction}
`.trim();

// === SYSTEM PROMPT - CHAT-MODE
if (mode === "chat") {
systemPrompt = `
Du är Atlas — en varm, personlig och lätt humoristisk assistent för en svensk trafikskola.

TON & FORMAT
- Vara varm, mänsklig och lätt skämtsam när det passar.
- Håll det kort, tydligt och hjälpsamt.
- Använd svenska.
- Fetstil behövs inte i fria chat-svar men är ok när det förtydligar något.

TOOLS & NÄR DE FÅR ANVÄNDAS
- Om användaren frågar om VÄDER, SKÄMT, Citat eller BILDER: **ANVÄND ALLTID motsvarande tool OMEDELBART**. Fråga ALDRIG användaren om de vill att du ska göra det - gör det direkt.
• Väderfrågor: Anropa get_weather med rätt stad
• Skämtfrågor: Anropa get_joke
• Citatfrågor: Anropa get_quote
- Servern förväntar sig tool_calls i dessa fall - returnera ALDRIG vanlig text när ett tool finns tillgängligt.

FÖRBUD
- Säg aldrig bokningslänkar — servern lägger in dem när relevant.
- Svara aldrig på faktafrågor om körkort/kurser - dessa hanteras av ett annat system.

FALLBACK
- Om du är osäker: svara kort och vänligt, t.ex. "Jag har tyvärr ingen information om detta — du kan alltid  klicka på knappen ovan (headsetet) för att prata med support-teamet?"

Svara alltid på svenska.
Använd **text** (dubbelstjärnor) för att fetmarkera viktiga fakta när det passar.
${greetingInstruction}
`.trim();
}

// UTOMATISKT VISITKORT
if (detectedCity) {
const cityKey = detectedCity.toLowerCase();
// Fall 1: Vi har data för staden i officeData
if (officeData[cityKey] && officeData[cityKey].length > 0) {
const offices = officeData[cityKey];
// Scenario A: ETT kontor/stad (ex. Eslöv)
if (offices.length === 1) {
const office = offices[0];
const name = office.name || `Kontoret i ${office.city}`;
const phone = (office.contact && office.contact.phone) ? office.contact.phone : (office.phone || "");
const email = (office.contact && office.contact.email) ? office.contact.email : (office.email || "");
const address = (office.contact && office.contact.address) ? office.contact.address : (office.address || "");

let hoursText = "";
if (office.opening_hours && Array.isArray(office.opening_hours)) {
hoursText = office.opening_hours.map(h => `${h.days}: ${h.hours}`).join(", ");
}

const contactCard = `
---------------------------------------------------------------------
🚨 INSTRUKTION FÖR PLATSSPECIFIK KONTAKTINFO (${office.city}) 🚨
Användaren frågar om kontaktuppgifter i: ${office.city}.
Du MÅSTE presentera svaret EXAKT enligt följande mall:

"Här har du kontaktuppgifterna till oss i ${office.city}:

**${name}**
📍 ${address}
📞 ${phone}
📧 ${email}
${hoursText ? `🕒 Öppettider: ${hoursText}` : ''}

Ring oss gärna om du har frågor, du kan också fortsätta chatten med ditt lokala kontor!"
---------------------------------------------------------------------
`;
systemPrompt += "\n" + contactCard;
} 
// Scenario B: FLERA kontor/stad (ex. Göteborg/Malmö/Stockholm)
else if (offices.length > 1) {
// Identifiera om vi har en exakt matchning på område (t.ex. Mölnlycke)
const areaMatch = detectedArea ? offices.find(o => o.area && o.area.toLowerCase() === detectedArea.toLowerCase()) : null;

if (areaMatch) {
const office = areaMatch;
const name = office.name;
const phone = office.contact?.phone || office.phone || "";
const email = office.contact?.email || office.email || "";
const address = office.contact?.address || office.address || "";
const hours = office.opening_hours?.map(h => `${h.days}: ${h.hours}`).join(", ") || "";

// Tvinga AI:n att använda den specifika datan
systemPrompt += `\n\nVIKTIGT: Användaren frågar om kontoret i ${office.area}. Du MÅSTE svara med dessa uppgifter:
**${name}**
📍 ${address}
📞 ${phone}
📧 ${email}
${hours ? `🕒 Öppettider: ${hours}` : ""}`;
} else {
// Om inget specifikt område valts, lista alternativen kortfattat
const list = offices.map(o => `* ${o.area}: ${o.contact?.phone || 'Se hemsida'}`).join("\n");
systemPrompt += `\n\nVi har flera kontor i ${detectedCity}:
${list}
Svara på frågan baserat på den bifogade kontexten men nämn att vi finns på flera platser.`;
}
}
}
}

// Injicera lokal tillgänglighetsnotering om sådan finns
if (localAvailabilityNote) {
systemPrompt += localAvailabilityNote;
}

// === TRIGGERS
if (mode === "chat") {
const lower = userQuestion.toLowerCase();
// — 1: Tvinga knowledge-mode om användaren frågar om priser/körkort
if (lower.includes("pris") || lower.includes("kostar") || lower.includes("körkort") || lower.includes("paket") || lower.includes("lektion") || lower.includes("riskettan") || lower.includes("risktvåan") || lower.includes("am") || lower.includes("mc") || lower.includes("bil")) {
mode = "knowledge";
}
// — 2: Om användaren ber om väder, skämt, citat, bild → håll kvar chat-mode
if (lower.includes("väder") || lower.includes("skämt") || lower.includes("citat") || lower.includes("bild") || lower.includes("rita") || lower.includes("generera")) {
mode = "chat";
}
}

// === TOOL FORCING FÖR CHAT-MODE
let toolForcingInstruction = "";
if (mode === "chat") {
const lowerQ = userQuestion.toLowerCase();
if (lowerQ.includes("väder")) {
const cityMatch = detectedCity || "Stockholm";
toolForcingInstruction = `\n\n[SYSTEM INSTRUCTION: User asked about weather. You MUST call get_weather tool with city="${cityMatch}". Do NOT respond with text.]`;
} else if (lowerQ.includes("skämt") || lowerQ.includes("vits")) {
toolForcingInstruction = `\n\n[SYSTEM INSTRUCTION: User asked for a joke. You MUST call get_joke tool. Do NOT respond with text.]`;
} else if (lowerQ.includes("citat")) {
toolForcingInstruction = `\n\n[SYSTEM INSTRUCTION: User asked for a quote. You MUST call get_quote tool. Do NOT respond with text.]`;
}
}

// === USER MESSAGE
const userContent = mode === "knowledge" ? `Fråga: ${userQuestion}\n\nKONTEXT:\n${retrievedContext || ""}` : userQuestion + toolForcingInstruction; 

// === TOOLS CHAT-MODE
let tools = [];
if (mode === "chat") {
tools = globalAvailableTools;
}

// === SEND TO OPENAI
const messages = [
{ role: "system", content: systemPrompt },
{ role: "user", content: userContent }
];

const apiParams = {
model: "gpt-4o-mini",
messages,
max_tokens: mode === "chat" ? 600 : 700,
temperature: mode === "chat" ? 0.7 : 0.0,
top_p: 1.0
};

// FORCE TOOL USAGE
if (mode === "chat" && tools && tools.length > 0) {
const lowerQ = userQuestion.toLowerCase();
if (lowerQ.includes("väder")) {
apiParams.tools = tools;
apiParams.tool_choice = { type: "function", function: { name: "get_weather" } };
} else if (lowerQ.includes("skämt") || lowerQ.includes("vits")) {
apiParams.tools = tools;
apiParams.tool_choice = { type: "function", function: { name: "get_joke" } };
} else if (lowerQ.includes("citat")) {
apiParams.tools = tools;
apiParams.tool_choice = { type: "function", function: { name: "get_quote" } };
} else {
apiParams.tools = tools;
}
}

let resp;
try {
resp = await openai.chat.completions.create(apiParams, { timeout: 15000 });
} catch (error) {
console.error("!!! OPENAI ERROR:", error.message);
return { type: 'answer', answer: "OpenAI tog för lång tid på sig eller svarade inte. Försök igen." };
}

const text = resp.choices?.[0]?.message?.content?.trim() || "";

// === CHAT-MODE LOGIC
if (mode === "chat") {
const toolCall = resp.choices?.[0]?.message?.tool_calls;
if (toolCall && toolCall.length > 0) {
return { type: "tool_request", model: "gpt-4o-mini", messages, tools, max_tokens: 600, temperature: 0.7 };
}
if (!text || text.length < 1) {
return { type: "answer", answer: "Jag kan hjälpa dig! Vill du att jag kollar vädret, drar ett skämt eller ska jag söka i vår kunskapsbas åt dig?", messages, model: "gpt-4o-mini" };
}
return { type: "answer", answer: text, messages, model: "gpt-4o-mini" };
}

// === KNOWLEDGE MODE RETURN ANSWER
let finalAnswer = text;
if (isFirstMessage && timeGreeting) {
if (!finalAnswer.toLowerCase().startsWith(timeGreeting.trim().toLowerCase())) {
finalAnswer = `${timeGreeting}${finalAnswer}`;
}
}
if (!finalAnswer || finalAnswer.length < 2) {
// Sista nödutgång om AI returnerar tom sträng — ska sällan träffas efter system-prompt-ändringen
finalAnswer = "Jag har tyvärr inte den informationen just nu. Klicka på headset-knappen ovan om du vill prata med en av oss direkt!";
}
finalAnswer = finalAnswer;
return { type: "answer", answer: finalAnswer, messages, model: "gpt-4o-mini" };
}

// ====================================================================
// SECTION 5b: SMART CLARIFICATION — AI-driven motfråga för vaga frågor
// Anropas när konfidenstjänsten bedömer att kontexten är för svag.
// Analyserar frågan + NLU-slots och ber kunden om rätt info.
// ====================================================================
async function generateSmartClarification(query, nluResult, detectedCity, detectedVehicle) {
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Bygg lista på vad som saknas baserat på vad NLU hittade
const missing = [];
if (!detectedCity) missing.push('stad eller kontor');
if (!detectedVehicle) missing.push('fordonstyp (bil, MC, moped/AM, lastbil)');

const missingText = missing.length > 0 ? missing.join(' och ') : 'mer specifik information';

const systemPrompt = `Du är Atlas — en varm, hjälpsam kundtjänstassistent för en svensk trafikskola.
Kunden har ställt en fråga som är för vag för att du ska kunna ge ett korrekt svar.
Din uppgift: Skriv ett kort, naturligt svar (1–2 meningar) på svenska som:
1. Visar att du förstår vad kunden frågar om (nämn gärna ämnet)
2. Ber om den specifika information du saknar för att kunna hjälpa
Gissa ALDRIG priser, tider eller annan fakta. Var vänlig och konkret.`;

const userPrompt = `Kundens fråga: "${query}"
Identifierat ämne: ${nluResult?.intent || 'okänt'}
Hittade nyckelord: stad=${detectedCity || 'saknas'}, fordon=${detectedVehicle || 'saknas'}
Det saknas: ${missingText}
Skriv en kort, smart motfråga som hjälper kunden precisera sin fråga.`;

try {
const completion = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: systemPrompt },
{ role: 'user', content: userPrompt }
],
max_tokens: 150,
temperature: 0.5
});
return completion.choices[0]?.message?.content?.trim()
|| 'För att kunna hjälpa dig — kan du berätta i vilken stad och vilket typ av fordon (bil, MC, moped?) det gäller?';
} catch (err) {
console.error('[CLARIFICATION] AI-fel:', err.message);
return 'För att hjälpa dig på bästa sätt — kan du berätta lite mer? Vilken stad och vilket typ av fordon gäller det?';
}
}

// ====================================================================
// SECTION 6: KNOWLEDGE BASE INITIALIZATION (Runs Once)
// ====================================================================
const loadKnowledgeBase = () => {
let files = [];
try {
files = fs.readdirSync(KNOWLEDGE_PATH);
} catch (err) {
console.error(`[FATAL FILE ERROR] Kunde inte läsa: ${KNOWLEDGE_PATH}`);
console.error(`Fel: ${err.message}`);
process.exit(1);
}

let tempChunks = [];
let officeCount = 0;
let basfaktaCount = 0;
let hybridCount = 0;
knownCities = [];
cityOffices = {};
officePrices = {};

files.forEach(file => {
const filePath = path.join(KNOWLEDGE_PATH, file);
try {
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Räknare för denna fil
let fileChunksCreated = 0;
let fileType = '';

// =================================================================
// SPECIAL: Hantera nollutrymme FÖRST
// =================================================================
if (file === 'basfakta_nollutrymme.json') {
if (data.sections && Array.isArray(data.sections)) {
criticalAnswers = data.sections;
}
}

// =================================================================
// STEG 1: Kontrollera filtyp
// =================================================================
const hasBasfakta = file.startsWith('basfakta_') || (data.sections && Array.isArray(data.sections) && data.sections.length > 0);
const hasOfficeData = data.city && data.prices && Array.isArray(data.prices);

// =================================================================
// STEG 2A: BASFAKTA-DATA (kan kombineras med kontorsdata)
// =================================================================
if (hasBasfakta) {
const contentData = data.sections || data.content || [];

if (Array.isArray(contentData) && contentData.length > 0) {
contentData.forEach((section, idx) => {
const chunk = {
id: `${file}_${idx}`,
title: section.title || "Info",
text: section.answer || section.content || '',
keywords: section.keywords || [],
type: 'basfakta',
source: file,
// NYTT: Bevara score_boost om den finns
...(section.score_boost && { score_boost: section.score_boost })
};
tempChunks.push(chunk);
fileChunksCreated++;
});

if (!hasOfficeData) {
basfaktaCount++;
fileType = 'basfakta';
}
}
}

// =================================================================
// STEG 2B: STADS/KONTOR-DATA (kan kombineras med basfakta)
// =================================================================
if (hasOfficeData) {
const cityKey = data.city.toLowerCase();

// Initiera officeData struktur
if (!officeData[cityKey]) officeData[cityKey] = [];
officeData[cityKey].push(data);

// Spara kontaktdata
if (!officeContactData[cityKey]) officeContactData[cityKey] = data;
if (data.id) officeContactData[data.id.toLowerCase()] = data;

officeCount++;
const officeName = data.area ? `${data.city} - ${data.area}` : data.city;

// Registrera område och stad
if (data.city && data.area) {
knownAreas[data.area.toLowerCase()] = data.city;
}
if (!knownCities.includes(data.city)) {
knownCities.push(data.city);
}
if (!cityOffices[data.city]) {
cityOffices[data.city] = [];
}
cityOffices[data.city].push(officeName);

const priceData = { AM: null, BIL: null, MC: null, LASTBIL: null, INTRO: null };
const bookingLinks = data.booking_links || null;

// Skapa prischunks från varje pris
let priceChunksCreated = 0;
data.prices.forEach(price => {
let vehicle = extractVehicle(price.service_name);
if (!vehicle && /(mc|motorcykel|a1|a2|a-körkort)/i.test(price.service_name)) {
vehicle = "MC";
}

let linkKey = vehicle;
if (linkKey === 'BIL') linkKey = 'CAR';
const bookingUrl = (bookingLinks && linkKey) ? bookingLinks[linkKey] : null;

if (vehicle) {
if (!priceData[vehicle]) priceData[vehicle] = price.price;

const priceChunk = {
id: `${file}_price_${vehicle}_${price.service_name.replace(/\s+/g, '_')}`,
title: `${price.service_name} i ${officeName}`,
text: `${price.service_name} kostar ${price.price} SEK i ${officeName}.`,
city: data.city,
area: data.area || null,
office: officeName,
vehicle: vehicle,
price: price.price,
service_name: price.service_name,
booking_url: bookingUrl,
booking_links: bookingLinks,
keywords: [
...(price.keywords || []),
data.city,
vehicle,
'pris',
'kostnad',
`${price.price}`,
officeName,
...(data.area ? [data.area] : [])
],
type: 'price',
source: file
};
tempChunks.push(priceChunk);
priceChunksCreated++;
fileChunksCreated++;
}
});

const languages = Array.isArray(data.languages) ? data.languages.join(", ") : "Svenska";
const languageKeywords = Array.isArray(data.languages) ? data.languages.map(l => l.toLowerCase()) : [];

// Hämta beskrivning om den finns, annars tom sträng
const description = data.description ? data.description + "\n\n" : "";

// Hämta befintliga keywords från filen
const existingKeywords = Array.isArray(data.keywords) ? data.keywords : [];

// Bygg texten MED beskrivning OCH språk
const contactText = `
${description}Kontaktuppgifter för ${officeName}:
Adress: ${data.contact?.address || 'Information saknas'}
Telefon: ${data.contact?.phone || 'Information saknas'}
E-post: ${data.contact?.email || 'Information saknas'}
Öppettider: ${data.opening_hours?.map(h => `${h.days}: ${h.hours}`).join(", ") || 'Information saknas'}

Vi erbjuder undervisning på följande språk: ${languages}.
`.trim();

const kontorDoc = {
id: `kontor_${data.id || file}`,
title: `Kontaktuppgifter och Språk för ${officeName}`,
text: contactText, 
city: data.city,
area: data.area || null,
office: officeName,
booking_links: bookingLinks,
keywords: [
...existingKeywords, 
'kontakt', 'öppettider', 'adress', 'telefon', 'språk', 'undervisning', 
...languageKeywords
], 
type: 'kontor_info',
source: file
};

tempChunks.push(kontorDoc);
fileChunksCreated++;
officePrices[officeName] = priceData;

// Bestäm filtyp baserat på kombination
if (hasBasfakta) {
fileType = 'hybrid';
hybridCount++;
} else {
fileType = 'kontor';
}
}

// =================================================================
// STEG 3: LOGGA RESULTAT FÖR DENNA FIL
// =================================================================
if (fileChunksCreated > 0) {
let logMessage = `✅ ${file}: `;

if (fileType === 'hybrid') {
const basfaktaChunks = tempChunks.filter(c => c.source === file && c.type === 'basfakta').length;
const priceChunks = tempChunks.filter(c => c.source === file && c.type === 'price').length;
logMessage += `${basfaktaChunks} basfakta + ${priceChunks} pris + 1 kontor (HYBRID 🔀)`;
} else if (fileType === 'basfakta') {
logMessage += `${fileChunksCreated} basfakta-chunks`;
} else if (fileType === 'kontor') {
const priceChunks = tempChunks.filter(c => c.source === file && c.type === 'price').length;
logMessage += `${priceChunks} prischunks + 1 kontorchunk`;
if (data.area) logMessage += ` för ${data.city} - ${data.area}`;
else logMessage += ` för ${data.city}`;
}

console.log(logMessage);
} else if (!hasBasfakta && !hasOfficeData) {
console.log(`⚠️  ${file}: Okänd filstruktur (varken basfakta eller stadsfil)`);
}

} catch (err) {
console.error(`❌ [FEL] Kunde inte läsa eller parsa fil: ${filePath}`, err.message);
}
});

// Tilldela globala chunks
allChunks = [...tempChunks];

// Hjälpfunktion för att extrahera fordonstyp
function extractVehicle(text) {
const lower = (text || "").toLowerCase();
if (/(^|\b)(am|moped|moppe)\b/.test(lower)) return "AM";
if (/(^|\b)(b96|be|släp)\b/.test(lower)) return "SLÄP";
if (/(^|\b)(bil|personbil)\b/.test(lower)) return "BIL";
if (/(^|\b)(mc|a1|a2|motorcykel|motorcyklar)\b/.test(lower)) return "MC";
if (/(^|\b)(lastbil|c1|c|ce|ykb)\b/.test(lower)) return "LASTBIL";
if (/(^|\b)(introduktion|handledarkurs|handledare|handledarutbildning)\b/.test(lower)) return "INTRO";
return null;
}

// =================================================================
// MINISEARCH INITIALISERING
// =================================================================
if (miniSearch) {
try { miniSearch.removeAll(); } catch (e) {}
}

miniSearch = new MiniSearch({
fields: ['title', 'text', 'city', 'area', 'office', 'keywords', 'vehicle'],
storeFields: ['title', 'text', 'city', 'area', 'office', 'vehicle', 'type', 'price', 'id', 'booking_url', 'booking_links'],
searchOptions: {
prefix: true,
fuzzy: 0.2,
boost: {
keywords: 6,
office: 5,
city: 4,
area: 3,
vehicle: 2,
title: 3,
text: 1
}
}
});

miniSearch.addAll(allChunks);
rebuildChunkMap();

// Initiera IntentEngine
try {
// Vi skickar med de faktiska områdena som vi registrerade under laddningen (knownAreas)
intentEngine = new IntentEngine(knownCities, CITY_ALIASES, VEHICLE_MAP, knownAreas);
} catch (e) {
console.error('[FATAL] Kunde inte initiera IntentEngine:', e.message);
}
};

// ====================================================================
// BOOKING LINKS LOADER (Läser utils/booking-links.json vid uppstart)
// ====================================================================
const loadBookingLinks = () => {
const filePath = path.join(UTILS_PATH, 'booking-links.json');
try {
if (fs.existsSync(filePath)) {
bookingLinks = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} else {
console.warn('[BookingLinks] utils/booking-links.json saknas — faller tillbaka på hårdkodade defaults.');
bookingLinks = {};
}
} catch (err) {
console.error('[BookingLinks] Kunde inte läsa booking-links.json:', err.message);
bookingLinks = {};
}
};

// Starta initiering
loadKnowledgeBase();
loadBookingLinks();

// ====================================================================
// THE CORE EXECUTION ENGINE (Stateless Wrapper)
// ====================================================================
async function runLegacyFlow(payload, contextFromDB, templatesFromDB) {
return new Promise(async (resolve, reject) => {

// 1. SETUP: Mock Request/Response & Session Injection
const req = {body: payload,headers: {},id: 'LEGACY_CALL'};
let sessionId = req.body.sessionId || generateSessionId(); 

// 2. Injicera state direkt
injectSessionState(sessionId, contextFromDB);

// 3. Säkra att sessionen finns i minnet
if (!sessions.has(sessionId)) {createEmptySession(sessionId);}

if (payload.locked_context) {
const session = sessions.get(sessionId);

// Vi uppdaterar minnes-sessionen direkt så att sökningen nedan använder rätt fordon
if (payload.locked_context.vehicle) session.locked_context.vehicle = payload.locked_context.vehicle;
if (payload.locked_context.city) session.locked_context.city = payload.locked_context.city;
if (payload.locked_context.area) session.locked_context.area = payload.locked_context.area;
}

// 4. Mock Response Object som returnerar data till V2-servern
const res = {
json: (data) => resolve({ 
response_payload: data, 
new_context: getSessionState(sessionId) // Skickar alltid med state
}),
status: (code) => {

return {
json: (errData) => resolve({ 
error: errData, 
statusCode: code,
new_context: getSessionState(sessionId) // Skickar alltid med state även vid fel
})
}
},
send: (msg) => resolve({ 
msg,
new_context: getSessionState(sessionId)
})
};

// VARIABLER UTANFÖR TRY (För att scope ska funka i catch)
let nluResult = null;
let session = null;
let queries = [];

try {

// INPUT VALIDATION & PRE-PROCESSING
const isFirstMessage = req.body.isFirstMessage || false;

if (Array.isArray(req.body.queries) && req.body.queries.length > 0) {
queries = req.body.queries;
} else if (req.body.query) {
queries = [req.body.query];
} else if (req.body.question) {
queries = [req.body.question];
} else {
return res.status(400).json({ error: 'Query saknas' });
}

const query = queries[0] || "";

if (!query.trim()) {
return res.status(400).json({ error: 'Tom fråga mottagen' });
}

const queryLower = (query || '').toLowerCase();
let forceHighConfidence = false;

// SESSIONSHANTERING - Hämta sessionen igen (referens för användning nedan)
session = sessions.get(sessionId);

// === SNABB-VAKT FÖR NOLLUTRYMME (Återställer snabbhet & stoppar timeouts) ===
const queryLowerClean = query.toLowerCase().trim().replace(/[?!.]/g, '');

const hasBusinessKeywords = /pris|kostar|boka|betala|am|mc|bil|körkort|lektion|faktura|avgift/.test(queryLowerClean);

if (!hasBusinessKeywords) {
const emergencyMatch = (criticalAnswers || []).find(entry => 
entry.keywords && Array.isArray(entry.keywords) && 
entry.keywords.some(kw => queryLowerClean === kw.toLowerCase())
);

if (emergencyMatch) {
return res.json({
answer: emergencyMatch.answer,
sessionId: sessionId,
locked_context: session.locked_context || { city: null, area: null, vehicle: null }
});
}
}

// ====================================================================
// STEP 3: INTENT & CONTEXT RESOLUTION
// ====================================================================
const lockedContext = session.locked_context || {};
const contextPayload = lockedContext;

// 1. BRUTAL TVÄTT AV INPUT
const rawLower = query.toLowerCase();
const sanitizedQuery = rawLower.replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

// 2. KÖR DEN BEFINTLIGA MOTORN
nluResult = intentEngine.parseIntent(sanitizedQuery, contextPayload);

// 3. MANUELL ÖVERKÖRNING: STAD
if (!nluResult.slots.city) {
for (const [alias, realCity] of Object.entries(CITY_ALIASES)) {
if (new RegExp(`\\b${alias}\\b`, 'i').test(sanitizedQuery)) {
nluResult.slots.city = realCity;
break;
}
}
}

// 4. MANUELL ÖVERKÖRNING: FORDON
if (!nluResult.slots.vehicle) {
for (const [realVehicle, aliases] of Object.entries(VEHICLE_MAP)) {
const match = aliases.some(word => new RegExp(`\\b${word}\\b`, 'i').test(sanitizedQuery));
if (match) {
nluResult.slots.vehicle = realVehicle;
break;
}
}
}

// 5. MANUELL ÖVERKÖRNING: INTENT & SLOTS
if (nluResult.intent === 'unknown') {
const isPriceWord = /pris|kostar|kostnad|avgift/i.test(sanitizedQuery) || 
(/\bbetala\b/i.test(sanitizedQuery) && !sanitizedQuery.includes('alternativ'));

if (isPriceWord) {
nluResult.intent = 'price_lookup';
} else if (/boka|tid|när/i.test(sanitizedQuery)) {
nluResult.intent = 'booking';
} else if (nluResult.slots.vehicle || nluResult.slots.city) {
nluResult.intent = 'service_inquiry';
}
}

if (!nluResult.slots.service) {
const q = sanitizedQuery.toLowerCase();
if (q.includes('risk 1') || q.includes('riskettan')) nluResult.slots.service = 'Risk 1';
else if (q.includes('risk 2') || q.includes('halk')) nluResult.slots.service = 'Risk 2';
else if (q.includes('intro') || q.includes('handledar')) nluResult.slots.service = 'Introduktionskurs';
else if (q.includes('testlektion') || q.includes('provlektion')) nluResult.slots.service = 'Testlektion';
else if (q.includes('am') || q.includes('moped')) nluResult.slots.service = 'AM';
else if (q.includes('mc') || q.includes('motorcykel')) nluResult.slots.service = 'MC';
}

// === FALLBACK: Förkortade ortsnamn för flervords-areas (ex. "frölunda" → "västra frölunda")
// IntentEngine matchar bara exakt "västra frölunda" — detta fångar kortformer
if (!nluResult.slots.area && nluResult.slots.city) {
const qLow = sanitizedQuery.toLowerCase();
const cityLow = nluResult.slots.city.toLowerCase();
for (const [areaName, areaCity] of Object.entries(knownAreas)) {
if (areaCity.toLowerCase() !== cityLow) continue;
if (!areaName.includes(' ')) continue; // Enordiga areas hanteras redan av IntentEngine
const distinctWords = areaName.split(/\s+/).filter(w => w.length >= 6);
if (distinctWords.some(w => qLow.includes(w))) {
nluResult.slots.area = areaName;
break;
}
}
}

// ====================================================================
// STEP 3: RESOLUTION
// ====================================================================
const detectedCity = nluResult.slots.city;
const detectedArea = nluResult.slots.area;

// Originallogik för lockedCity och detectedVehicleType
const lockedCity = detectedCity || lockedContext.city;
const detectedVehicleType = nluResult.slots.vehicle || lockedContext.vehicle;
const wasFirstMessage = isFirstMessage;

const isLegalQuestion = /regler|giltighet|giltig|krav|ålder|villkor|policy|gäller|faktura/i.test(sanitizedQuery);

if (detectedVehicleType) {
session.locked_context.vehicle = detectedVehicleType;
}
if (detectedCity) {
session.locked_context.city = detectedCity;
}
if (detectedArea) {
session.locked_context.area = detectedArea;
}

// 6. MANUELL ÖVERKÖRNING: KONTAKT & FAKTURA
if (/telefon|nummer|ringa|kontakta|adress|mail|email|öppettider|faktura/i.test(sanitizedQuery)) {
nluResult.intent = 'contact_info';
}

// FIX SCENARIO 5: Skapa ett "effektivt" intent för sökningen
const effectiveIntent = isLegalQuestion ? 'legal_query' : nluResult.intent;

// ====================================================================
// STEP 4: INTELLIGENT MODE SWITCHING (SÄKERHETSPRINCIP: RAG FIRST)
// ====================================================================

// 1. Initiera variabler
let forcedMode = null;
let mode = 'knowledge'; // Vi utgår ALLTID från att det är knowledge (Säkrast)

// 2. Definiera vad som FÅR vara Chat (Småprat & Tools)
const strictChatTriggers = [
"väder", "skämt", "vits", "citat", "bild", "rita", "generera", 
"hej", "tja", "tjena", "hallå", "god morgon", "god kväll", "goddag",
"tack", "tusen tack", "schysst", "vem är du", "vad heter du",
"bot", "människa", "personal", "leva", "mår du"
];

// === REVIDERAD LISTA (Tillåter "vad är" för chat-mode) ===
const ragBlockers = [
"pris", "kostar", "boka", "betala", "faktura", "pengar", "offert", "rabatt",
"körkort", "paket", "kurser", "utbildning", "bil", "mc", "am", "moped", 
"lastbil", "släp", "risk", "halkbana", "handledare", "intro", "teori",
"intensiv", "lektion", "övningskör", "syn", "tillstånd",
"regler", "ålder", "gäller", "krav", "giltig", "ansöka",
"steg", "utbildningskontroll", "prov", "uppkörning", "ykb", "moms", "swish", "klarna", "avgift"
];

// 4. BEHÅLL DIN BEFINTLIGA LOGIK FÖR PRIS-SÖKNINGAR
if (session.locked_context.vehicle && session.locked_context.city && nluResult.slots.area && nluResult.intent === 'unknown') {
const lastUserMsg = session.messages.filter(m => m.role === 'user').slice(-2, -1)[0];
if (lastUserMsg && /pris|kostar|kostnad/i.test(lastUserMsg.content)) {
forcedMode = 'knowledge';
nluResult.intent = 'price_lookup';
}
}

// 5. Analysera innehållet
const queryCheck = queryLower || "";
const containsChatTrigger = strictChatTriggers.some(kw => queryCheck.includes(kw));
const containsRagKeyword = ragBlockers.some(kw => queryCheck.includes(kw));

// 6. BESLUTSLOGIK (FIXAD PRIORITET)
if (forcedMode) {
mode = forcedMode;
} 
else if (containsRagKeyword) {
// HÖGSTA PRIORITET: Om affärsord finns -> ALLTID RAG
mode = 'knowledge';
}
else if (nluResult.intent === 'weather') {
mode = 'chat';
}
else if (containsChatTrigger) {
mode = 'chat';
} 
else {
mode = 'knowledge';
}

// Kontaktinfo ska ALLTID vara knowledge (Säkerhetsspärr)
if (nluResult.intent === 'contact_info') mode = 'knowledge';

// STEP 5: SEARCH & RETRIEVAL (Här börjar nästa sektion i din fil)

let retrievedContext = "";
let topResults = [];

try {

let searchQuery = query;

// Om vi har ett specifikt område (t.ex. "Ullevi" eller "Stora Holm") Lägg till det i söksträngen för att boosta träffar.
if (detectedArea && !query.toLowerCase().includes(detectedArea.toLowerCase())) {
searchQuery = `${query} ${detectedArea}`;
} 

// Om vi vet staden men inget område, lägg till staden för tydlighet
else if (detectedCity && !query.toLowerCase().includes(detectedCity.toLowerCase()) && !detectedArea) {
searchQuery = `${query} ${detectedCity}`;
}

const expandedQuery = normalizedExpandQuery(searchQuery);

// 1. GÖR GRUNDSÖKNINGEN - Hämtar allt som tekniskt matchar orden i din databas.
const allResults = miniSearch.search(expandedQuery, {
fuzzy: 0.2, prefix: true,
boost: { keywords: 6, office: 5, city: 4, area: 3, vehicle: 2, title: 3, text: 1 }
});

// 2. SMART STADSFILTRERING (Hard Filter) Skyddar mot att blanda ihop städer (t.ex. Eslöv vs Göteborg).
let filteredRawResults = allResults;
const targetCity = lockedCity || detectedCity; 

if (targetCity) {
const targetCityLower = targetCity.toLowerCase();

filteredRawResults = allResults.filter(result => {
const chunk = allChunks.find(c => c.id === result.id);
if (!chunk) return false;

// REGEL A: Behåll ALLTID "Basfakta" (som saknar city-property)..
if (!chunk.city) return true;

// REGEL B: Kasta bort fel stad.
if (chunk.city.toLowerCase() !== targetCityLower) {
return false; 
}

// REGEL C: Rätt stad -> Behåll
return true;
});
}

// ============================================================
// 🚀 RANKING-LOGIK V2 (INTENT-STYRD BOOSTING)
// ============================================================
let uniqueResults = Array.from(new Map(filteredRawResults.map(item => [item.id, item])).values());

uniqueResults = uniqueResults.map(result => {
const fullChunk = allChunks.find(c => c.id === result.id);
if (fullChunk) {
let finalScore = result.score;

// 1. GRUNDLÄGGANDE MATCHNING (Stad/Fordon/Område)
if (detectedArea && fullChunk.area && fullChunk.area.toLowerCase() === detectedArea.toLowerCase()) finalScore += 2000;
else if (detectedCity && fullChunk.city && fullChunk.city.toLowerCase() === detectedCity.toLowerCase() && !detectedArea) finalScore += 1000;

if (detectedVehicleType && fullChunk.vehicle === detectedVehicleType) finalScore += 2000;

// 2. INTENT-BOOSTING (DETTA ÄR FIXEN)
// Vi boostar ENDAST om användaren uttryckligen frågar efter PRIS.
if (nluResult.intent === 'price_lookup' && fullChunk.type === 'price') {
// Säkerhetsspärr: Boosta inte MC-priser om vi pratar om BIL
if (!detectedVehicleType || (fullChunk.vehicle === detectedVehicleType)) {
finalScore += 50000; // Garanterad plats i Top 30
}
}

// Boosta kontakt-info ENDAST om frågan handlar om kontakt
if (nluResult.intent === 'contact_info' && (fullChunk.type === 'office_info' || fullChunk.type === 'kontor_info')) {
finalScore += 50000;
}

// Boosta bokningslänkar ENDAST om frågan handlar om bokning
if (nluResult.intent === 'booking' && fullChunk.booking_url) {
finalScore += 10000;
}

// 3. SUPER-BOOST (Den gamla logiken för exakta träffar)
if (detectedCity && detectedVehicleType && 
fullChunk.city && fullChunk.city.toLowerCase() === detectedCity.toLowerCase() && 
fullChunk.vehicle === detectedVehicleType && 
fullChunk.type === 'price') {
finalScore += 100000; 
}

return {...result, score: finalScore, type: fullChunk.type, keywords: fullChunk.keywords ?? [], text: fullChunk.text };
}

return { ...result, keywords: result.keywords ?? [], text: result.text };
});

// SORTERA EFTER DE NYA POÄNGEN
uniqueResults.sort((a, b) => b.score - a.score);

// Klipp Top 30 (Nu innehåller den garanterat priset om intent var 'price_lookup')
let selectedChunks = uniqueResults.slice(0, 30);

// FYLL PÅ MED BASFAKTA (Säkerhetsnät)
if (selectedChunks.length < 30) {
const extra = allChunks.filter(c => 
!c.city && // Endast generella filer (Basfakta)
!selectedChunks.map(s => s.id).includes(c.id)
).slice(0, 30 - selectedChunks.length);

const extraMapped = extra.map(c => ({
id: c.id, score: 0, type: c.type, keywords: c.keywords || [], text: c.text
}));
selectedChunks = selectedChunks.concat(extraMapped);
}

// Spara resultatet
uniqueResults = selectedChunks;
// ============================================================

// ============================================================
// 1. INITIALISERING & FORCE-ADD LOGIK
// ============================================================
topResults = uniqueResults;
let mustAddChunks = [];

// Skapa motor för att tvinga in kritiska filer baserat på sökord/intent
const forceAddEngine = new ForceAddEngine(allChunks);

// SÄKERHET FÖR SCENARIO 5: 
// Vi sparar original-intentet, men ändrar det till 'legal_query' under sökningen 
// om det är en fråga om regler/giltighet.
const originalIntent = nluResult.intent;
const isLegalOverride = isLegalQuestion && !queryLower.includes('faktura');
if (isLegalOverride) nluResult.intent = 'legal_query';

// Vi skickar in detectedVehicleType (som kan vara null vid bypass) i slots-objektet
const originalVehicleSlot = nluResult.slots.vehicle;
nluResult.slots.vehicle = detectedVehicleType;

const forceAddResult = forceAddEngine.execute(queryLower,{...nluResult,area: nluResult.slots?.area || null},lockedCity);
mustAddChunks = forceAddResult.mustAddChunks;
forceHighConfidence = forceAddResult.forceHighConfidence || false;

// Återställ nluResult efteråt för att inte förstöra sessionen/loggarna
nluResult.intent = originalIntent;
nluResult.slots.vehicle = originalVehicleSlot;

// ============================================================
// 2. EMERGENCY FALLBACK (Kritiska svar direkt)
// ============================================================
if (Array.isArray(criticalAnswers) && forceAddResult.mustAddChunks.length === 0) {
for (const entry of criticalAnswers) {
const matches = entry.keywords && Array.isArray(entry.keywords) && entry.keywords.some(kw => queryLower.includes(kw));
if (matches) {
const timeGreeting = isFirstMessage ? "God morgon! " : "";
appendToSession(sessionId, 'assistant', timeGreeting + entry.answer);

return res.json({
sessionId: sessionId,
answer: timeGreeting + entry.answer,
emergency_mode: true,
context: [],
locked_context: { city: lockedContext.city, area: lockedContext.area, vehicle: lockedContext.vehicle },
debug: { nlu: nluResult, fallback_id: entry.id }
});
}
}
}

// ============================================================
// 3. KATEGORISERING & KONTORS-PRIORITERING
// ============================================================
// Ge basfakta en initial boost innan vi går in i finliret
const allBasfakta = mustAddChunks.filter(c => isBasfaktaType(c));
allBasfakta.forEach(c => c.score *= 1.8);
mustAddChunks = [...allBasfakta, ...mustAddChunks.filter(c => !isBasfaktaType(c))];

// Om stad är vald, hämta relevanta kontorsfiler (öppettider, adress etc.)
if (detectedCity || detectedArea) {
const officeChunks = allChunks.filter(c => {
const isOfficeFile = c.source && !c.source.includes('basfakta_');
if (!isOfficeFile) return false;
const matchesCity = c.city && detectedCity && c.city.toLowerCase() === detectedCity.toLowerCase();
const matchesArea = detectedArea ? (c.area && c.area.toLowerCase() === detectedArea.toLowerCase()) : true;
return matchesCity && matchesArea;
});

const withBooking = officeChunks.filter(c => c.text?.toLowerCase().includes('boka') || (c.keywords || []).some(k => k.toLowerCase().includes('boka')));
const withoutBooking = officeChunks.filter(c => !withBooking.includes(c));

mustAddChunks.push(...withBooking);
mustAddChunks.push(...withoutBooking.slice(0, 3));
}

if (detectedArea) {
mustAddChunks = mustAddChunks.map(c => {
if (
(c.type === 'office_info' || c.type === 'kontor_info') &&
c.area &&
c.area.toLowerCase() === detectedArea.toLowerCase()
) {
return {
...c,
score: Math.max(c.score || 0, 25000)
};
}
return c;
});
}

// ============================================================
// 4. GEOGRAFISK SORTERING (Area > City > Global)
// ============================================================
if (detectedArea && detectedCity) {
const areaResults = uniqueResults.filter(r => r.area && r.area.toLowerCase() === detectedArea.toLowerCase() && r.city === detectedCity);
const cityResults = uniqueResults.filter(r => r.city === detectedCity && (!r.area || r.area.toLowerCase() !== detectedArea.toLowerCase()));
const otherResults = uniqueResults.filter(r => r.city !== detectedCity);
topResults = [...areaResults, ...cityResults, ...otherResults];
} else if (detectedCity) {
const cityResults = uniqueResults.filter(r => r.city === detectedCity);
const otherResults = uniqueResults.filter(r => r.city !== detectedCity);
topResults = [...cityResults, ...otherResults];
}

// ============================================================
// 5. SMART PRIORITERING (Policy vs Pris vs Fordon)
// ============================================================
const topResultsMap = new Map(topResults.map(r => [r.id, r]));
const requiredVehicle = detectedVehicleType;

// Intent Detection
const isStrictPriceQuery = /\b(kostar|pris|prislista|kostnad|hur mycket|betala)\b/i.test(query);
const isPackageQuery = /\b(paket|ingår|innehåll|totalpaket|lektionspaket)\b/i.test(query);

const policyKeywords = [
'avgift', 'trafikverket', 'fotografering', 'passagerare', 'barn i bilen', 
'säsong', 'vinteruppehåll', 'när börjar', 'när slutar', 'halka',
'giltighet', 'förlänger', 'gammalt tillstånd', 'hur ansöker',
'kostar appen', 'appen', 'app', 'gratis', 'premium', 'obligatorisk', 
'indraget körkort', 'genrep', 'fejkad uppkörning', 'bedömning', 
'återfallselev', 'antal lektioner', 'startlektion', 'provlektion mc', 'faktura', 'giltig'
];

const isPolicyQuery = policyKeywords.some(kw => query.toLowerCase().includes(kw));

let hasSniperMatch = false;

// Huvudloopen för poängsättning - FULLSTÄNDIG OCH INTEGRERAD
mustAddChunks.forEach(chunk => {
let forcedScore = 0;

const chunkText = (
(chunk.title || '') + ' ' + 
(chunk.text || '') + ' ' + 
(chunk.answer || '') + ' ' + 
(chunk.keywords || []).join(' ')
).toLowerCase();

// Vi kollar matchning mot policy-keywords i den specifika chunken
const hasPolicyMatch = policyKeywords.some(kw => chunkText.includes(kw));

// Variabler för logiken nedan
const targetArea = (detectedArea || nluResult.slots.area || "").toLowerCase();

// Regex för betalfrågor (OBS: Innehåller INTE "kostar" eller "pris" för att inte krocka med paket)
const isPaymentQuery = /betal|klarna|swish|faktura|delbetala|avgift/.test(queryLower);

// ============================================================
// 1. "THE SNIPER" & JSON-BOOST (Högsta Prioritet: 5 Miljoner)
// ============================================================

// A) UNIVERSAL BOOST: Kolla om chunken har en inbyggd boost direkt i JSON-filen
if (chunk.boost) {
forcedScore = chunk.boost;
hasSniperMatch = true; 
}
// B) Betalningsalternativ
else if (queryLower.includes('betalningsalternativ') && chunk.title === 'Betalningsalternativ') {
forcedScore = 5000000;
hasSniperMatch = true;
}
// C) Fakturaadress
else if (queryLower.includes('fakturaadress') && chunk.title?.toLowerCase().includes('fakturaadress')) {
forcedScore = 5000000;
hasSniperMatch = true;
}
// D) MC-SÄSONG (Boostar filen basfakta_mc_lektioner_utbildning.json)
else if (queryLower.includes('säsong') && (chunk.source?.includes('mc_lektioner') || chunk.title?.includes('säsong'))) {
forcedScore = 5000000;
hasSniperMatch = true;
}

// ============================================================
// 2. POLICY & BETALNING - Bredare Uppfångning (2 000 000 Poäng)
// ============================================================
else if (isPaymentQuery && (
chunk.source?.includes('policy') || 
chunk.title?.includes('Betalning') || 
chunk.source?.includes('nollutrymme')
)) {
forcedScore = 2000000; 
hasSniperMatch = true;
}

// ============================================================
// 3. AREA-SKALPEL - Kontorsspecifikt (75 000 Poäng)
// ============================================================
// Detta är standardläget för kontor: Visar priser och info för det valda kontoret (t.ex. Ullevi).
// Ligger som 'else if' så att Betalning/Sniper alltid går före.
else if (targetArea && chunk.area && chunk.area.toLowerCase() === targetArea) {
forcedScore = 75000; 
}

// ============================================================
// 4. KONTORS-INFO BOOST - Kontakt & Öppettider (65 000 Poäng)
// ============================================================
// Hjälper till att visa rätt adress/tider när man frågar om kontakt.
// Undviker att kicka in om man frågar om faktura.
else if (nluResult.intent === 'contact_info' && 
(chunk.type === 'kontor_info' || chunk.type === 'office_info') &&
!queryLower.includes('faktura')) {
forcedScore = 65000;
}

// ============================================================
// 5. DINA SKYDDSREGLER & FIXAR (BEVARADE EXAKT)
// ============================================================

// SKYDDSREGEL 1. Om poängen redan är över 30 000 (från ForceAdd), rör den inte!
else if (chunk.score && chunk.score >= 30000) {
forcedScore = chunk.score; 
}
// SKYDDSREGEL 2. FAKTURA-BOOST (Nollutrymme-skydd för betalningar)
else if (queryLower.includes('faktura') && chunk.source && chunk.source.includes('nollutrymme')) {
forcedScore = 50000; 
}
// SKYDDSREGEL 3. HÄLSA, DIAGNOS & TILLSTÅND (Fixar FAIL [85])
else if (queryLower.includes('läkarintyg') || queryLower.includes('diagnos') || queryLower.includes('adhd') || queryLower.includes('diabetes')) {
if (chunk.source && chunk.source.includes('korkortstillstand')) {
forcedScore = 48000; 
}
}
// SKYDDSREGEL 4. SJUKDOM & AVBOKNING (Säkrar policy-matchning vid sjuk-avbokning)
else if (queryLower.includes('sjuk') || (queryLower.includes('läkarintyg') && queryLower.includes('avboka'))) {
if (chunk.source && chunk.source.includes('policy_kundavtal')) {
forcedScore = 48000; 
}
}
// SKYDDSREGEL 5. SUPPORT & KONTAKT FALLBACK (Fixar FAIL [34])
else if (queryLower.includes('support') || queryLower.includes('ring') || queryLower.includes('kundtjänst')) {
if (chunk.source && (chunk.source.includes('om_foretaget') || chunk.source.includes('nollutrymme') || chunk.source.includes('saknade_svar'))) {
forcedScore = 47000; 
}
}
// SKYDDSREGEL 6. TUNG TRAFIK KONTAKT & BOKNING (Fixar FAIL [9])
else if (queryLower.includes('tung') && (queryLower.includes('kontakt') || queryLower.includes('boka') || queryLower.includes('offert'))) {
if (chunk.source && chunk.source.includes('lastbil')) {
forcedScore = 46000;
}
}
// SKYDDSREGEL 7. ÅTERFALLSELEVER (Fixar FAIL [61])
else if (queryLower.includes('återfall') || queryLower.includes('kört förut') || queryLower.includes('haft körkort')) {
if (chunk.source && (chunk.source.includes('lektioner_paket_bil') || chunk.source.includes('mc_lektioner_utbildning'))) {
forcedScore = 44000;
}
}
// SKYDDSREGEL 8. GILTIGHETSPRIORITET (Säkrar 24 månader vs 5 år)
else if (queryLower.includes('giltig') || queryLower.includes('länge')) {
if (queryLower.includes('paket') && chunk.source && chunk.source.includes('policy_kundavtal')) {
forcedScore = 42000; 
} else if ((queryLower.includes('tillstånd') || queryLower.includes('intro')) && chunk.type === 'basfakta') {
forcedScore = 42000; 
} else {
forcedScore = 28000;
}
}

// A) POLICY-PRIO (28 000)
else if (isPolicyQuery && hasPolicyMatch) {
forcedScore = 28000;
} 
// B) STADSPRIORITET
else if (lockedCity && chunk.city && chunk.city.toLowerCase() === lockedCity.toLowerCase() && (chunk.type === 'kontor_info' || chunk.type === 'office_info')) {
forcedScore = (nluResult.intent === 'contact_info') ? 45000 : 27000; 
}
// NYTT: Prioritera Testlektioner vid prisfrågor för bil
else if (isStrictPriceQuery && nluResult.slots.vehicle === 'BIL' && chunk.service_name === 'Testlektion BIL') {
forcedScore = 35000; 
}
// C) STRIKT PRIS-BOOST (25 000)
else if (isStrictPriceQuery && (chunk.id.includes('paket') || (chunk.title && /paket|totalpaket/i.test(chunk.title)))) {
forcedScore = 25000;
}
// D) ALLMÄN PAKET-BOOST (18 000)
else if (isPackageQuery && !isStrictPriceQuery && (chunk.id.includes('paket') || (chunk.title && /paket/i.test(chunk.title)))) {
forcedScore = 18000;
}
// E) FORDONS-PRIORITET (12 000)
else if (requiredVehicle && chunk.vehicle && chunk.vehicle.toUpperCase() === requiredVehicle.toUpperCase()) {
forcedScore = 12000;
} 
else {
forcedScore = chunk.score && chunk.score > 0 ? chunk.score : 9999;
}

const forcedChunk = { ...chunk, score: forcedScore, match: { score: forcedScore } };
topResultsMap.set(chunk.id, forcedChunk);
});

// ============================================================
// 6. SLUTFÖRING & SORTERING
// ============================================================
// Säkerställ strikt sortering på score
topResults = Array.from(topResultsMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0));

// Spara 30 chunks för att inte tappa stadsinfo innan City Guard körs
topResults = topResults.slice(0, 30).filter(r => r.score > 0);

// Konfidenstjänst: Returnera klarifieringsfråga om resultaten är för svaga
if (!forceHighConfidence) {
const hasBasfakta = topResults.some(r => isBasfaktaType(r));
const bestScore = topResults[0]?.score || 0;
const isContactQuery = nluResult.intent === 'contact_info';
const threshold = isContactQuery ? 0.05 : LOW_CONFIDENCE_THRESHOLD;

if (!hasBasfakta && bestScore < threshold && nluResult.intent !== 'contact_info') {
// AI analyserar frågan och ber om rätt info istället för hårdkodad sträng
const clarification = await generateSmartClarification(query, nluResult, lockedCity || detectedCity, detectedVehicleType);
return res.json({ answer: clarification, context: [], debug: { low_confidence: true, best_score: bestScore } });
}
} 

// 1. Stadssäkring & Områdes-skalpell
if (lockedCity) {
const targetCity = lockedCity.toLowerCase();
const targetArea = (detectedArea || nluResult.slots.area || "").toLowerCase();

topResults = topResults.filter(chunk => {
const chunkCity = (chunk.city || '').toString().toLowerCase();
const chunkArea = (chunk.area || '').toString().toLowerCase();

// Basfakta (global info) får alltid passera
if (chunkCity === '') return true;

// Fel stad rensas alltid bort
if (chunkCity !== targetCity) return false;

if (targetArea && chunkArea && chunkArea !== targetArea) {
return false;
}

return true;
});
}

// 2. Fordonssäkring & Filtrering med OFFICE BYPASS
let filteredResults = topResults;
const isOfficeBypass = nluResult.intent === 'contact_info' || /vilka|erbjuder|utbud|utbildningar/i.test(queryLower);

if (detectedVehicleType) {
if (!isOfficeBypass) {

// Standard-filter för vanliga frågor
filteredResults = topResults.filter(chunk => {
const noVehicle = !chunk.vehicle;
const matchesVehicle = chunk.vehicle === detectedVehicleType;
const isGeneral = chunk.type === 'basfakta' || chunk.type === 'office_info' || chunk.type === 'kontor_info';
const isForceAdded = (chunk.score || 0) >= 4000;
return noVehicle || matchesVehicle || isGeneral || isForceAdded;
});
} else {
// Boosta kontor_info så den vinner över priser och paket i kontext-fönstret
filteredResults = topResults.map(chunk => {
if (chunk.type === 'kontor_info' || chunk.type === 'office_info') {
return { ...chunk, score: hasSniperMatch ? 50000 : 999999 }; 
}
return chunk;
});
}
}

// Rensa dubbletter från topResults
const uniqueMap = new Map();
filteredResults.forEach(r => {
if (!uniqueMap.has(r.id)) {
uniqueMap.set(r.id, r);
}
});

const uniqueTopResults = Array.from(uniqueMap.values());

// ============================================================
// PriceResolver: Slå upp exakt pris om intent är price_lookup
// ============================================================
// Kör INTE PriceResolver om vi letar efter Betalning eller Säsong
const isSeasonQuery = queryLower.includes('säsong');
if (!hasSniperMatch && !isSeasonQuery && (nluResult.intent === 'price_lookup' || /(?:kostar|pris|avgift)/i.test(query))) {

const serviceToLookup = nluResult.slots.service || query;

const priceResult = priceResolver.resolvePrice({
city: lockedCity,
serviceTerm: serviceToLookup, 
chunkMap: chunkMap, 
globalFallback: null 
});

if (priceResult.found && Number(priceResult.price) > 0) {
const bestMatchName = priceResult.matches[0]?.service_name || serviceToLookup;
const priceText = `PRISUPPGIFT: Priset för ${bestMatchName} i ${lockedCity || 'våra städer'} är exakt ${priceResult.price} SEK.`;

uniqueTopResults.unshift({
id: 'price_resolver_force',
title: 'Hämtat Pris',
text: priceText,
score: 999999,
type: 'price',
price: priceResult.price
});
}
}

// ============================================================
// 🛡️ SISTA SÄKERHETSSPÄRREN (CITY GUARD & KILL SWITCH)
// ============================================================
if (typeof uniqueTopResults !== 'undefined') {
let safeList = [...uniqueTopResults];

if (lockedCity) {
const safeCity = lockedCity.toLowerCase().trim();
safeList = safeList.filter(c => {
if (c.city && c.city.toLowerCase() !== safeCity) {
return false; 
}
return true;
});
}

safeList = safeList.filter(c => {
if (c.price !== undefined && c.price !== null) {
if (Number(c.price) <= 0) return false;
}

if (c.text) {
const zeroPattern = /(?:\s|\*\*|:)0\s*(?:kr|sek|:-)|(?:kostar|pris).{0,15}\b0\b/i;
if (zeroPattern.test(c.text)) {
return false;
}
}
return true;
});

uniqueTopResults.length = 0; 
uniqueTopResults.push(...safeList); 
}

// ============================================================
// 📝 BYGG CONTEXT
// ============================================================
const MAX_CONTEXT_TOKENS = 2500; 
let contextTokens = 0;
const contextParts = [];

for (const r of uniqueTopResults) {
const chunk = r; 
if (!chunk) continue;

let text = `${chunk.title}: ${chunk.text || ''}`;

if (chunk.price && Number(chunk.price) > 0) {
text += ` - ${chunk.price} SEK`;
}

const estimatedTokens = Math.ceil(text.length / 4);
if (contextTokens + estimatedTokens > MAX_CONTEXT_TOKENS) break;
contextParts.push(text);
contextTokens += estimatedTokens;
}
retrievedContext = contextParts.join('\n\n');

// === SMART LOKAL TILLGÄNGLIGHETS-KONTROLL
// Om kunden frågar om en specifik tjänst på ett specifikt område: kolla om det faktiskt finns
// lokal data för det kontoret. Om inte → hitta alternativa kontor i samma stad som har tjänsten.
let localAvailabilityNote = '';
if (detectedArea && (lockedCity || detectedCity) && nluResult && nluResult.intent !== 'contact_info') {
const cityLower = (lockedCity || detectedCity).toLowerCase();
const areaLower = detectedArea.toLowerCase();
const areaWords = new Set(areaLower.split(/\s+/));
const cityWords = new Set(cityLower.split(/\s+/));

// Extrakt meningsbärande serviceord från frågan (6+ tecken, ej ortsnamn)
const commonStop = new Set(['kunde', 'boken', 'vilken', 'frågar', 'börjar', 'startar', 'körkort', 'kör', 'att', 'och', 'eller', 'men', 'för', 'inte', 'till', 'från', 'med', 'vid', 'hos', 'kan', 'vill', 'vara']);
const queryWords = query.toLowerCase()
.replace(/[?!.,]/g, '')
.split(/\s+/)
.filter(w => w.length >= 6 && !areaWords.has(w) && !cityWords.has(w) && !commonStop.has(w));

if (queryWords.length > 0) {
// Kolla om det finns lokal prischunk för detta kontor + tjänst
const hasLocalServiceChunk = allChunks.some(c =>
c.city?.toLowerCase() === cityLower &&
c.area?.toLowerCase() === areaLower &&
(c.type === 'price' || c.type === 'basfakta') &&
queryWords.some(w =>
(c.service_name || '').toLowerCase().includes(w) ||
(c.title || '').toLowerCase().includes(w) ||
(c.text || '').toLowerCase().includes(w)
)
);

if (!hasLocalServiceChunk) {
// Hitta alternativa kontor i samma stad med matchande tjänst
const alternatives = [...new Set(
allChunks
.filter(c =>
c.city?.toLowerCase() === cityLower &&
c.area && c.area.toLowerCase() !== areaLower &&
c.type === 'price' &&
queryWords.some(w =>
(c.service_name || '').toLowerCase().includes(w) ||
(c.title || '').toLowerCase().includes(w)
)
)
.map(c => c.area)
)].slice(0, 4);

const cityName = lockedCity || detectedCity;
if (alternatives.length > 0) {
localAvailabilityNote = `\n\n[SYSTEMNOTERING — LOKAL TILLGÄNGLIGHET: Tjänsten kunden frågar om erbjuds INTE vid kontoret i ${detectedArea}. Matchande tjänst finns däremot vid följande kontor i ${cityName}: ${alternatives.join(', ')}. Du MÅSTE svara tydligt att tjänsten INTE erbjuds i ${detectedArea}, och sedan nämna dessa alternativa kontor som kunden kan vända sig till.]`;
} else {
localAvailabilityNote = `\n\n[SYSTEMNOTERING — LOKAL TILLGÄNGLIGHET: Tjänsten kunden frågar om verkar inte erbjudas vid kontoret i ${detectedArea}, och inga andra matchande kontor i ${cityName} hittades. Svara ärligt att du inte kan bekräfta att tjänsten erbjuds här och hänvisa kunden till hemsidan eller att kontakta supporten för hjälp.]`;
}
}
}
}

let ragResult;
let finalAnswer;

} catch (searchError) {
console.error("❌ [SEARCH ERROR]", searchError.message);
console.error("❌ Stack:", searchError.stack);

return res.json({
answer: "Ett tekniskt fel uppstod vid sökning.",
sessionId: sessionId,
error: searchError.message
});
}

try {
ragResult = await generate_rag_answer(query, retrievedContext, lockedCity, detectedArea, isFirstMessage, mode, localAvailabilityNote);

} catch (e) {
console.error("!!! OPENAI ERROR:", e.message);
return res.json({ answer: "Tekniskt fel vid AI-anrop.", sessionId: sessionId });
}

if (ragResult.type === 'answer') {
finalAnswer = ragResult.answer;
} else if (ragResult.type === 'tool_request') {
try {
const initial = await openai.chat.completions.create(
{
model: ragResult.model,
messages: ragResult.messages,
tools: ragResult.tools,
max_tokens: ragResult.max_tokens,
temperature: ragResult.temperature
},
{ timeout: 15000 }
);

const msg = initial.choices?.[0]?.message;

if (!msg?.tool_calls || msg.tool_calls.length === 0) {
finalAnswer = msg?.content?.trim() || 'Jag kunde inte formulera ett svar.';
} else {
const toolResults = [];

for (const call of msg.tool_calls) {

// Parsar arguments på ett säkert sätt
let args = {};
try {
args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
} catch (e) {
args = {};
}

// Kör verktyget med try/catch
let result;
try {
switch (call.function?.name) {
case "get_weather":
result = await fetchWeather(args.city);
break;
case "get_joke":
result = await get_joke();
break;
case "get_quote":
result = await get_quote();
break;
case "calculate_price":
result = await calculate_price(args.amount, args.unit_price);
break;
case "generate_image":
result = await generate_image(args.prompt);
break;
default:
result = { error: `Okänt verktyg: ${call.function?.name}` };
}
} catch (toolError) {
result = { error: `Kunde inte köra ${call.function?.name}` };
}

toolResults.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
}

// Skicka resultatet till OpenAI igen för slutgiltigt svar
try {
const final = await openai.chat.completions.create(
{
model: ragResult.model,
messages: [...ragResult.messages, msg, ...toolResults],
max_tokens: 600,
temperature: 0.7
},
{ timeout: 15000 }
);
finalAnswer = final?.choices?.[0]?.message?.content?.trim() || 'Tekniskt fel.';
} catch (finalError) {
console.error("ERROR: Slutgiltigt OpenAI-anrop misslyckades:", finalError);
finalAnswer = 'Ett tekniskt fel uppstod vid generering av svar.';
}
}
} catch (chatError) {
console.error("ERROR: Chat-läget kraschade:", chatError);
finalAnswer = 'Något gick fel i chat-läget. Försök igen.';
}
}

// ✅ SLUTPUNKT – SVARET SKICKAS TILL KLIENTEN
return res.json({
answer: finalAnswer,
sessionId: sessionId,
locked_context: session.locked_context
});


// STEP 7: POST-PROCESSING (Booking Links)
// Länkarna läses in från utils/booking-links.json vid uppstart via loadBookingLinks().
// Faller tillbaka på tomt objekt om filen saknas (ingen krasch).
const GENERAL_FALLBACK_LINKS = Object.keys(bookingLinks).length > 0 ? bookingLinks : {
'AM':     { type: 'info', text: 'Boka din AM-kurs via vår hemsida här',               linkText: 'här',     url: 'https://mydrivingacademy.com/two-wheels/ta-am-korkort/' },
'MC':     { type: 'info', text: 'För mer MC-information, kolla vår hemsida',           linkText: 'hemsida', url: 'https://mydrivingacademy.com/two-wheels/home/' },
'CAR':    { type: 'info', text: 'För mer information om bilkörkort, kolla vår hemsida',linkText: 'hemsida', url: 'https://mydrivingacademy.com/kom-igang/' },
'INTRO':  { type: 'book', text: 'Boka Handledarkurs/Introduktionskurs här',            linkText: 'här',     url: 'https://mydrivingacademy.com/handledarutbildning/' },
'RISK1':  { type: 'book', text: 'Boka Riskettan (Risk 1) här',                         linkText: 'här',     url: 'https://mydrivingacademy.com/riskettan/' },
'RISK2':  { type: 'book', text: 'Boka Risktvåan/Halkbana (Risk 2) här',               linkText: 'här',     url: 'https://mydrivingacademy.com/halkbana/' },
'TEORI':  { type: 'book', text: 'Plugga körkortsteori i appen Mitt Körkort här',       linkText: 'här',     url: 'https://mydrivingacademy.com/app/' },
'B96/BE': { type: 'book', text: 'Boka Släpvagnsutbildning (B96/BE) här',              linkText: 'här',     url: 'https://mydrivingacademy.com/slapvagn/' },
'TUNG':   { type: 'book', text: 'Boka utbildning för Tung Trafik (C/CE) här',         linkText: 'här',     url: 'https://mydrivingacademy.com/tungtrafik/' },
'POLICY': { type: 'info', text: 'Läs våra köpvillkor och policy här',                  linkText: 'här',     url: 'https://mydrivingacademy.com/privacy-policy/' }
};

let bookingLinkAdded = false;
let finalBookingLink = null;
let linkVehicleType = null;

const officeChunk = topResults.find(r => r.booking_links && typeof r.booking_links === 'object');
if (officeChunk && officeChunk.booking_links) {
const links = officeChunk.booking_links;
let serviceKey = null;
if (detectedVehicleType) {
serviceKey = detectedVehicleType.toUpperCase();
if (serviceKey === 'BIL') serviceKey = 'CAR';
} else if (/\bam\b/.test(queryLower) || queryLower.includes('moped')) {
serviceKey = 'AM';
} else if (/\bmc\b/.test(queryLower) || queryLower.includes('motorcykel')) {
serviceKey = 'MC';
} else {
const topPriceChunk = topResults.find(r => r.type === 'price' && r.vehicle);
if (topPriceChunk && topPriceChunk.vehicle) serviceKey = topPriceChunk.vehicle === 'BIL' ? 'CAR' : topPriceChunk.vehicle;
}
if (!serviceKey && session.detectedVehicleType) {
const sessionVehicleKey = session.detectedVehicleType.toUpperCase();
if (links[sessionVehicleKey]) serviceKey = sessionVehicleKey;
}
if (!serviceKey) serviceKey = links.AM ? 'AM' : links.MC ? 'MC' : links.CAR ? 'CAR' : null;

if (serviceKey && links[serviceKey]) {
finalBookingLink = links[serviceKey];
linkVehicleType = serviceKey;
bookingLinkAdded = true; 
}
}

if (!bookingLinkAdded) {
let fallbackType = null;
if (queryLower.includes('policy') || queryLower.includes('villkor') || queryLower.includes('orgnr') || queryLower.includes('faktura')) {
const fallbackData = GENERAL_FALLBACK_LINKS['POLICY'];
if (fallbackData) {
const markdownLink = `[${fallbackData.linkText}](${fallbackData.url})`;
finalAnswer += `\n\n---\n\n${fallbackData.text.replace(fallbackData.linkText, markdownLink)}`;
bookingLinkAdded = true;
}
} else if (detectedVehicleType) {
fallbackType = detectedVehicleType.toUpperCase();
if (fallbackType === 'BIL') fallbackType = 'CAR';
if (fallbackType === 'LASTBIL' || fallbackType === 'SLÄP') fallbackType = 'TUNG';
} else if (/\bam\b/.test(queryLower) || queryLower.includes('moped')) fallbackType = 'AM';
else if (/\bmc\b/i.test(queryLower) || queryLower.includes('motorcykel')) fallbackType = 'MC';
else if (queryLower.includes('handledar')) fallbackType = 'INTRO';
else if (queryLower.includes('risk 1')) fallbackType = 'RISK1';
else if (queryLower.includes('risk 2')) fallbackType = 'RISK2';
else if (queryLower.includes('teori')) fallbackType = 'TEORI';
else if (queryLower.includes('tung trafik')) fallbackType = 'TUNG';
else if (queryLower.includes('lektion')) fallbackType = 'CAR';

if (fallbackType) {
const fallbackData = GENERAL_FALLBACK_LINKS[fallbackType];
if (fallbackData) {
finalBookingLink = fallbackData.url;
linkVehicleType = fallbackType;
bookingLinkAdded = true; 
}
}
}

if (finalBookingLink) {
const vehicleKey = (linkVehicleType || 'CAR').toUpperCase().replace('BIL', 'CAR'); 
const isExplicitRequest = nluResult.intent === 'booking_link' || nluResult.intent === 'booking' || nluResult.intent === 'contact_info' || /bokningslänk|länk/i.test(query);
const linkAlreadySent = session.linksSentByVehicle[vehicleKey] === true;

if (isExplicitRequest || !linkAlreadySent) {
let linkText;
switch (vehicleKey) {
case 'MC': linkText = 'Boka din MC-kurs här'; break;
case 'AM': linkText = 'Boka din AM-kurs här'; break;
case 'CAR': default: linkText = 'Boka din körlektion här'; break;
}
finalAnswer += `\n\n✅ [${linkText}](${finalBookingLink})`;
session.linksSentByVehicle[vehicleKey] = true;
} 
}

// STEP 8: FINALIZATION & CLEANUP
appendToSession(sessionId, 'assistant', finalAnswer);

if (session) {
session.locked_context = {
city: lockedContext.city || detectedCity || null,
area: lockedContext.area || detectedArea || null,
vehicle: lockedContext.vehicle || detectedVehicleType || null
};
}

res.json({
sessionId: sessionId,
answer: finalAnswer,
context: uniqueTopResults.map(r => ({
id: r.id,
title: r.title, 
text: (r.text || "").slice(0, 200), 
city: r.city, 
type: r.type, 
score: r.score 
})),
locked_context: { 
city: detectedCity || lockedContext.city || null,
area: detectedArea || lockedContext.area || null,
vehicle: detectedVehicleType || lockedContext.vehicle || null 
},
debug: { 
nlu: nluResult, 
detected_city: lockedCity, 
detected_area: detectedArea, 
chunks_used: uniqueTopResults.length 
}
});

} catch (e) {
console.error(`[FATAL ERROR] ${e.message}\n${e.stack}`);
res.status(500).json({
answer: 'Jag förstår inte riktigt vad du menar nu? Kan du omformulera din fråga.',
sessionId: sessionId
});
} finally {
}
});
}

// ====================================================================
// SECTION 8: STATELESS BRIDGES (Interface for V2 DB)
// ====================================================================
function injectSessionState(sessionId, contextData) {
if (!contextData) return;
if (!sessions.has(sessionId)) {createEmptySession(sessionId);}
const session = sessions.get(sessionId);

// Mappa databas-fält till session-objektet
if (contextData.locked_context) {
session.locked_context = contextData.locked_context;}
if (contextData.linksSentByVehicle) {session.linksSentByVehicle = contextData.linksSentByVehicle;}
if (contextData.messages) {session.messages = contextData.messages;}
}

// ====================================================================
// STATE EXTRACTION HELPER (Get modified state back to V2 DB)
// ====================================================================
function getSessionState(sessionId) {
const session = sessions.get(sessionId);
if (!session) {
console.warn(`[STATE] Session ${sessionId} finns inte vid getSessionState!`);
return {
locked_context: { city: null, area: null, vehicle: null },
linksSentByVehicle: { AM: false, MC: false, CAR: false, INTRO: false, RISK1: false, RISK2: false },
messages: []
};
}

console.log(`[STATE EXTRACT] Returnerar från session:`, JSON.stringify({
locked_context: session.locked_context,
vehicle_exists: !!session.locked_context.vehicle
}));

return {
locked_context: session.locked_context,
linksSentByVehicle: session.linksSentByVehicle,
messages: session.messages
};
}

module.exports = { runLegacyFlow, loadKnowledgeBase };