// ============================================================
// rag-debug.js — Atlas RAG Debug Script
// PLACERA I: C:\Atlas\rag-debug.js
// KÖR MED:   node rag-debug.js "din fråga här"
// ============================================================

const fs      = require('fs');
const path    = require('path');
const MiniSearch = require('minisearch');

// ── FÄRGER I TERMINALEN ──────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
};

function hdr(title, color = C.cyan) {
  const line = '─'.repeat(60);
  console.log(`\n${color}${C.bold}${line}`);
  console.log(`  ${title}`);
  console.log(`${line}${C.reset}`);
}

function ok(msg)   { console.log(`${C.green}  ✅ ${msg}${C.reset}`); }
function warn(msg) { console.log(`${C.yellow}  ⚠️  ${msg}${C.reset}`); }
function err(msg)  { console.log(`${C.red}  ❌ ${msg}${C.reset}`); }
function info(msg) { console.log(`${C.dim}     ${msg}${C.reset}`); }
function val(label, value) {
  console.log(`  ${C.bold}${label}:${C.reset} ${C.white}${JSON.stringify(value)}${C.reset}`);
}

// ── ROOT-DETEKTERING ─────────────────────────────────────────
const SERVER_ROOT = fs.existsSync('C:\\Atlas\\package.json') ? 'C:\\Atlas' : __dirname;
console.log(`\n${C.magenta}${C.bold}╔════════════════════════════════════════════════════════╗`);
console.log(`║           ATLAS RAG DEBUG SCRIPT v1.0                 ║`);
console.log(`╚════════════════════════════════════════════════════════╝${C.reset}`);
console.log(`  Root: ${SERVER_ROOT}`);

// ── LADDA .env ───────────────────────────────────────────────
require('dotenv').config({ path: path.join(SERVER_ROOT, '.env') });
if (process.env.OPENAI_API_KEY) {
  ok('.env laddad (OPENAI_API_KEY finns)');
} else {
  warn('.env saknar OPENAI_API_KEY – AI-svaret hoppas över');
}

// ── LADDA MODULER ────────────────────────────────────────────
hdr('MODULER', C.blue);
let ForceAddEngine, IntentEngine, contextLock, priceResolver, INTENT_PATTERNS;
try {
  const intentModule = require(path.join(SERVER_ROOT, 'patch', 'intentEngine'));
  IntentEngine      = intentModule.IntentEngine;
  INTENT_PATTERNS   = intentModule.INTENT_PATTERNS;
  ForceAddEngine    = require(path.join(SERVER_ROOT, 'patch', 'forceAddEngine'));
  contextLock       = require(path.join(SERVER_ROOT, 'utils', 'contextLock'));
  priceResolver     = require(path.join(SERVER_ROOT, 'utils', 'priceResolver'));
  ok('Alla moduler laddade');
} catch (e) {
  err(`Modulfel: ${e.message}`);
  process.exit(1);
}

// ── HÄMTA FRÅGAN ─────────────────────────────────────────────
const userQuery = process.argv.slice(2).join(' ').trim();
if (!userQuery) {
  err('Ingen fråga angiven!');
  console.log(`  Kör: ${C.cyan}node rag-debug.js "din fråga här"${C.reset}`);
  process.exit(1);
}

// ── KOPIERA ALIAS/MAPS FRÅN legacy_engine.js ─────────────────
const CITY_ALIASES = {
  'stockholm':'Stockholm','sthlm':'Stockholm','djursholm':'Stockholm',
  'kungsholmen':'Stockholm','lindhagsplan':'Stockholm','ostermalm':'Stockholm','östermalm':'Stockholm',
  'sodermalm':'Stockholm','södermalm':'Stockholm','solna':'Stockholm',
  'goteborg':'Göteborg','göteborg':'Göteborg','gbg':'Göteborg',
  'gothenburg':'Göteborg','hogsbo':'Göteborg','högsbo':'Göteborg',
  'molndal':'Göteborg','mölndal':'Göteborg','molnlycke':'Göteborg',
  'mölnlycke':'Göteborg','ullevi':'Göteborg','vastra frolunda':'Göteborg',
  'västra frölunda':'Göteborg','frölunda':'Göteborg','frolunda':'Göteborg','hovas':'Göteborg','hovås':'Göteborg',
  'aby':'Göteborg','åby':'Göteborg','kungalv':'Göteborg','kungälv':'Göteborg',
  'malmo':'Malmö','malmö':'Malmö','bulltofta':'Malmö','limhamn':'Malmö',
  'jägersro':'Malmö','jagersro':'Malmö','hamnen':'Malmö',
  'sodervarn':'Malmö','södervärn':'Malmö','triangeln':'Malmö',
  'varnhem':'Malmö','värnhem':'Malmö','vastra hamnen':'Malmö',
  'helsingborg':'Helsingborg','lund':'Lund','katedral':'Lund',
  'sodertull':'Lund','södertull':'Lund','angelholm':'Ängelholm',
  'ängelholm':'Ängelholm','eslov':'Eslöv','eslöv':'Eslöv',
  'gavle':'Gävle','gävle':'Gävle','hassleholm':'Hässleholm',
  'hässleholm':'Hässleholm','kalmar':'Kalmar','kristianstad':'Kristianstad',
  'kungsbacka':'Kungsbacka','landskrona':'Landskrona',
  'linkoping':'Linköping','linköping':'Linköping','trelleborg':'Trelleborg',
  'umea':'Umeå','umeå':'Umeå','uppsala':'Uppsala','varberg':'Varberg',
  'vasteras':'Västerås','västerås':'Västerås','vaxjo':'Växjö','växjö':'Växjö',
  'vellinge':'Vellinge','ystad':'Ystad'
};

const VEHICLE_MAP = {
  'SLÄP':   ['be','be-kort','b96','släp'],
  'LASTBIL':['lastbil','c','c1','ce','c-körkort','tung lastbil'],
  'AM':     ['am','moped','moppe'],
  'BIL':    ['bil','personbil','b-körkort'],
  'MC':     ['mc','motorcykel','a1','a2','a-körkort'],
  'INTRO':  ['introduktionskurs','handledarkurs','handledare','introkurs','handledar']
};

const UNIFIED_SYNONYMS = {
  'handledare': ['handledarutbildning','introduktionskurs','handledarskap'],
  'obligatorisk': ['krav','måste','krävs'],
  'pris': ['pris','kostar','kostnad','avgift'],
  'boka': ['boka','bokning','reservera'],
};

// ── LADDA KUNSKAPSBAS ────────────────────────────────────────
hdr('KUNSKAPSBAS', C.blue);
const KNOWLEDGE_PATH = path.join(SERVER_ROOT, 'knowledge');
if (!fs.existsSync(KNOWLEDGE_PATH)) {
  err(`Knowledge-mappen saknas: ${KNOWLEDGE_PATH}`);
  process.exit(1);
}

let allChunks   = [];
let knownCities = [];
let knownAreas  = {};
let officeData  = {};
let chunkMap    = new Map();
let criticalAnswers = [];
let fileCount   = 0;

const files = fs.readdirSync(KNOWLEDGE_PATH);

// Extrahera fordonstyp från tjänstnamn
function extractVehicleFromService(text) {
  const lower = (text||'').toLowerCase();
  if (/introduktion|handledare/.test(lower)) return 'INTRO';
  if (/\bam\b|\bmoped\b/.test(lower))   return 'AM';
  if (/\bmc\b|\ba1\b|\ba2\b/.test(lower)) return 'MC';
  if (/\blastbil\b|\b(c1?e?)\b/.test(lower)) return 'LASTBIL';
  if (/\bsläp\b|\bb96\b/.test(lower))   return 'SLÄP';
  if (/\bbil\b|\bpersonbil\b/.test(lower)) return 'BIL';
  return null;
}

files.forEach(file => {
  const fp = path.join(KNOWLEDGE_PATH, file);
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    fileCount++;

    // Nollutrymme
    if (file === 'basfakta_nollutrymme.json' && data.sections) {
      criticalAnswers = data.sections;
    }

    // Basfakta-filer
    if (file.startsWith('basfakta_') || (data.sections && Array.isArray(data.sections))) {
      (data.sections || []).forEach((s, i) => {
        allChunks.push({
          id: `${file}_${i}`,
          title: s.title || 'Info',
          text: s.answer || s.content || '',
          keywords: s.keywords || [],
          type: 'basfakta',
          source: file,
        });
      });
    }

    // Kontors-/prisjson
    if (data.city && data.prices) {
      const cityKey = data.city.toLowerCase();
      if (!officeData[cityKey]) officeData[cityKey] = [];
      officeData[cityKey].push(data);
      if (data.area) knownAreas[data.area.toLowerCase()] = data.city;
      if (!knownCities.includes(data.city)) knownCities.push(data.city);

      const officeName = data.area ? `${data.city} - ${data.area}` : data.city;

      // Prischunks
      (data.prices || []).forEach(p => {
        const vehicle = extractVehicleFromService(p.service_name);
        if (!vehicle) return;
        allChunks.push({
          id: `${file}_price_${vehicle}_${p.service_name.replace(/\s+/g,'_')}`,
          title: `${p.service_name} i ${officeName}`,
          text: `${p.service_name} kostar ${p.price} SEK i ${officeName}.`,
          city: data.city, area: data.area || null, office: officeName,
          vehicle, price: p.price, service_name: p.service_name,
          keywords: [...(p.keywords||[]), data.city, vehicle, `${p.price}`, officeName],
          type: 'price', source: file,
          booking_links: data.booking_links || null,
        });
      });

      // Kontaktkunk
      const hours = (data.opening_hours||[]).map(h=>`${h.days}: ${h.hours}`).join(', ');
      allChunks.push({
        id: `kontor_${data.id||file}`,
        title: `Kontaktuppgifter ${officeName}`,
        text: `Adress: ${data.contact?.address||''} Telefon: ${data.contact?.phone||''} E-post: ${data.contact?.email||''} Öppettider: ${hours}`,
        city: data.city, area: data.area||null, office: officeName,
        keywords: [...(data.keywords||[]),'kontakt','adress','telefon','öppettider'],
        type: 'kontor_info', source: file,
        booking_links: data.booking_links || null,
      });
    }
  } catch(e) {
    warn(`Kunde inte parsa: ${file} – ${e.message}`);
  }
});

chunkMap = new Map(allChunks.map(c => [c.id, c]));
ok(`${fileCount} JSON-filer inlästa → ${allChunks.length} chunks totalt`);
info(`Städer: ${knownCities.join(', ')}`);
info(`Områden: ${Object.keys(knownAreas).join(', ')}`);

// ── MINISEARCH ───────────────────────────────────────────────
const miniSearch = new MiniSearch({
  fields: ['title','text','city','area','office','keywords','vehicle'],
  storeFields: ['title','text','city','area','office','vehicle','type','price','id','booking_url','booking_links'],
  searchOptions: { prefix: true, fuzzy: 0.2,
    boost: { keywords:6, office:5, city:4, area:3, vehicle:2, title:3, text:1 } }
});
miniSearch.addAll(allChunks);

// ── INTENT ENGINE ────────────────────────────────────────────
const intentEngine = new IntentEngine(knownCities, CITY_ALIASES, VEHICLE_MAP, knownAreas);

// ── HJÄLPFUNKTIONER ──────────────────────────────────────────
function normalizeText(s) {
  return (s||'').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^\w\s\d]/g,' ').replace(/\s+/g,' ').trim();
}

function expandQuery(q) {
  let ex = q.toLowerCase();
  for (const [key, syns] of Object.entries(UNIFIED_SYNONYMS)) {
    if (ex.includes(key)) syns.slice(0,2).forEach(s => ex += ' ' + s);
  }
  return ex.length > 250 ? ex.substring(0,250) : ex;
}

function isBasfakta(c) {
  const t = (c?.type||'').toLowerCase();
  return t.includes('basfakta') || (c?.source||'').startsWith('basfakta_');
}

// ════════════════════════════════════════════════════════════
//  HUVUDLOGIK
// ════════════════════════════════════════════════════════════
async function runDebug() {
  hdr(`FRÅGA`, C.magenta);
  console.log(`  ${C.bold}${C.white}"${userQuery}"${C.reset}`);

  // ── 1. NORMALISERING ───────────────────────────────────────
  hdr('STEG 1 — NORMALISERING', C.cyan);
  const rawLower      = userQuery.toLowerCase();
  const sanitized     = rawLower.replace(/[?!.,;:]/g,' ').replace(/\s+/g,' ').trim();
  const expandedQuery = expandQuery(normalizeText(sanitized));
  val('sanitized', sanitized);
  val('expandedQuery', expandedQuery.substring(0,150)+'...');

  // ── 2. INTENT ENGINE ───────────────────────────────────────
  hdr('STEG 2 — INTENT ENGINE', C.cyan);
  const nluResult = intentEngine.parseIntent(sanitized, {});
  val('intent',     nluResult.intent);
  val('confidence', nluResult.confidence);
  val('slots',      nluResult.slots);

  // Manuella överkörningar (exakt som legacy_engine)
  if (!nluResult.slots.city) {
    for (const [alias, city] of Object.entries(CITY_ALIASES)) {
      if (new RegExp(`\\b${alias}\\b`,'i').test(sanitized)) {
        nluResult.slots.city = city;
        warn(`City-alias match: "${alias}" → "${city}"`);
        break;
      }
    }
  }
  if (!nluResult.slots.vehicle) {
    for (const [vehicle, aliases] of Object.entries(VEHICLE_MAP)) {
      if (aliases.some(w => new RegExp(`\\b${w}\\b`,'i').test(sanitized))) {
        nluResult.slots.vehicle = vehicle;
        warn(`Vehicle-alias match → "${vehicle}"`);
        break;
      }
    }
  }

  val('slots (efter överkörning)', nluResult.slots);

  // Fallback area-detektering för kortformer (synkad med legacy_engine.js)
  if (!nluResult.slots.area && nluResult.slots.city) {
    const qLow2 = sanitized.toLowerCase();
    const cityLow2 = nluResult.slots.city.toLowerCase();
    for (const [areaName, areaCity] of Object.entries(knownAreas)) {
      if (areaCity.toLowerCase() !== cityLow2) continue;
      if (!areaName.includes(' ')) continue;
      const distinctWords = areaName.split(/\s+/).filter(w => w.length >= 6);
      if (distinctWords.some(w => qLow2.includes(w))) {
        nluResult.slots.area = areaName;
        warn(`Area-fallback: "${areaName}" (via kortform)`);
        break;
      }
    }
  }

  const detectedCity    = nluResult.slots.city;
  const detectedArea    = nluResult.slots.area;
  const detectedVehicle = nluResult.slots.vehicle;
  const lockedCity      = detectedCity;

  // ── 3. MINISEARCH ──────────────────────────────────────────
  hdr('STEG 3 — MINISEARCH', C.cyan);

  let searchQuery = sanitized;
  if (detectedArea && !sanitized.includes(detectedArea.toLowerCase()))
    searchQuery += ` ${detectedArea}`;
  else if (detectedCity && !sanitized.includes(detectedCity.toLowerCase()))
    searchQuery += ` ${detectedCity}`;

  const expanded = expandQuery(normalizeText(searchQuery));
  const rawResults = miniSearch.search(expanded, {
    fuzzy: 0.2, prefix: true,
    boost: { keywords:6, office:5, city:4, area:3, vehicle:2, title:3, text:1 }
  });

  console.log(`  Råa MiniSearch-träffar: ${C.bold}${rawResults.length}${C.reset}`);
  console.log(`\n  ${C.bold}Top 10 råa träffar:${C.reset}`);
  rawResults.slice(0,10).forEach((r,i) => {
    const chunk = allChunks.find(c=>c.id===r.id);
    const city  = chunk?.city ? `[${chunk.city}]` : '[global]';
    const veh   = chunk?.vehicle ? `[${chunk.vehicle}]` : '';
    const type  = chunk?.type || '?';
    console.log(`  ${C.dim}${String(i+1).padStart(2)}.${C.reset} ${C.yellow}${r.score.toFixed(2).padStart(8)}${C.reset}  ${type.padEnd(12)} ${city} ${veh}`);
    console.log(`       ${C.dim}${(chunk?.title||r.id).substring(0,65)}${C.reset}`);
  });

  // ── 4. STADSFILTRERING ─────────────────────────────────────
  hdr('STEG 4 — STADSFILTRERING', C.cyan);
  let filtered = rawResults;
  if (lockedCity) {
    const cl = lockedCity.toLowerCase();
    filtered = rawResults.filter(r => {
      const c = allChunks.find(x=>x.id===r.id);
      if (!c?.city) return true;             // global basfakta → behåll
      if (c.city.toLowerCase() !== cl) {
        return false;                         // fel stad → kasta
      }
      return true;
    });
    const removed = rawResults.length - filtered.length;
    info(`Stad: "${lockedCity}" → ${removed} chunks med fel stad borttagna`);
    info(`Kvar efter stadsfilter: ${filtered.length}`);
  } else {
    info('Ingen stad detekterad – ingen stadsfiltrering');
  }

  // ── 5. FORCE-ADD ENGINE ────────────────────────────────────
  hdr('STEG 5 — FORCE-ADD ENGINE', C.cyan);
  console.log(`  (Alla console.log från ForceAddEngine visas nedan)\n`);

  const forceEngine  = new ForceAddEngine(allChunks);
  const forceResult  = forceEngine.execute(
    rawLower,
    { ...nluResult, area: nluResult.slots?.area || null },
    lockedCity
  );

  const { mustAddChunks, forceHighConfidence } = forceResult;
  val('forceHighConfidence', forceHighConfidence);
  console.log(`\n  Force-addade chunks: ${C.bold}${mustAddChunks.length}${C.reset}`);
  mustAddChunks.forEach((c,i) => {
    const badge = c.forced ? `${C.green}[FORCED]${C.reset}` : '';
    console.log(`  ${C.dim}${String(i+1).padStart(2)}.${C.reset} score=${C.yellow}${(c.score||0).toLocaleString()}${C.reset}  ${(c.type||'').padEnd(12)} ${badge}`);
    console.log(`       ${C.dim}${(c.title||c.id).substring(0,65)}${C.reset}`);
  });

  // ── 6. SCORE-BOOSTING ──────────────────────────────────────
  hdr('STEG 6 — SCORE-BOOSTING & SAMMANSLAGNING', C.cyan);

  // Starta med filtrerade + force-addade
  const resultMap = new Map(filtered.map(r => [r.id, {...r}]));
  mustAddChunks.forEach(c => {
    resultMap.set(c.id, { ...c, id: c.id });
  });

  // Applicera boosting (samma logik som legacy_engine)
  const isStrictPrice  = /\b(kostar|pris|prislista|kostnad|hur mycket)\b/i.test(userQuery);
  const isPolicyQuery  = /giltighet|giltig|avbokning|återbetalning|villkor|faktura/i.test(userQuery);

  resultMap.forEach((r, id) => {
    const chunk = allChunks.find(c=>c.id===id) || r;
    let score   = r.score || 0;

    if (detectedArea && chunk.area?.toLowerCase() === detectedArea.toLowerCase()) score += 2000;
    else if (detectedCity && chunk.city?.toLowerCase() === detectedCity?.toLowerCase() && !detectedArea) score += 1000;
    if (detectedVehicle && chunk.vehicle === detectedVehicle) score += 2000;

    if (nluResult.intent === 'price_lookup' && chunk.type === 'price') {
      if (!detectedVehicle || chunk.vehicle === detectedVehicle) score += 50000;
    }
    if (nluResult.intent === 'contact_info' && (chunk.type==='kontor_info'||chunk.type==='office_info')) {
      score += 50000;
    }
    if (detectedCity && detectedVehicle &&
        chunk.city?.toLowerCase()===detectedCity?.toLowerCase() &&
        chunk.vehicle===detectedVehicle && chunk.type==='price') {
      score += 100000;
    }
    resultMap.set(id, { ...r, score });
  });

  let sorted = Array.from(resultMap.values()).sort((a,b)=>(b.score||0)-(a.score||0));

  console.log(`\n  ${C.bold}Top 15 efter boosting (det AI:n ser):${C.reset}`);
  sorted.slice(0,15).forEach((r,i) => {
    const chunk = allChunks.find(c=>c.id===r.id) || r;
    const city  = chunk?.city ? `[${chunk.city}]` : '[global]';
    const veh   = chunk?.vehicle ? `[${chunk.vehicle}]` : '';
    const type  = (chunk?.type||'?').padEnd(12);
    const forced= r.forced ? `${C.green}★${C.reset}` : ' ';
    console.log(`  ${forced}${C.dim}${String(i+1).padStart(2)}.${C.reset} ${C.yellow}${(r.score||0).toLocaleString().padStart(10)}${C.reset}  ${type} ${city} ${veh}`);
    console.log(`       ${C.dim}${(chunk?.title||r.id).substring(0,65)}${C.reset}`);
  });

  // ── 7. KONTEXT TILL AI ─────────────────────────────────────
  hdr('STEG 7 — KONTEXT TILL OPENAI', C.cyan);
  const MAX_TOKENS = 2500;
  let tokens = 0;
  const contextParts = [];
  const usedChunks   = [];

  for (const r of sorted.slice(0,30)) {
    const chunk = allChunks.find(c=>c.id===r.id) || r;
    let text = `${chunk.title||''}: ${chunk.text||''}`;
    if (chunk.price && Number(chunk.price)>0) text += ` - ${chunk.price} SEK`;
    const est = Math.ceil(text.length/4);
    if (tokens + est > MAX_TOKENS) break;
    contextParts.push(text);
    usedChunks.push(chunk);
    tokens += est;
  }

  console.log(`  Chunks i kontext: ${C.bold}${usedChunks.length}${C.reset}  (~${tokens} tokens)`);
  usedChunks.forEach((c,i) => {
    const city = c.city ? `[${c.city}]` : '[global]';
    console.log(`  ${C.dim}${String(i+1).padStart(2)}.${C.reset} ${(c.type||'?').padEnd(12)} ${city} ${C.dim}${(c.title||c.id).substring(0,55)}${C.reset}`);
  });

  console.log(`\n${C.dim}  ── KONTEXTTEXT (rådata till OpenAI) ─────────────────────────${C.reset}`);
  const contextStr = contextParts.join('\n\n');
  console.log(contextStr.substring(0,2000) + (contextStr.length>2000 ? '\n  [...trunkerad...]' : ''));

  // ── 7.5. LOKAL TILLGÄNGLIGHETS-CHECK ───────────────────────
  hdr('STEG 7.5 — LOKAL TILLGÄNGLIGHET', C.cyan);
  let localAvailabilityNote = '';

  if (detectedArea && lockedCity && nluResult.intent !== 'contact_info') {
    const cityLower = lockedCity.toLowerCase();
    const areaLower = detectedArea.toLowerCase();
    const areaWords = new Set(areaLower.split(/\s+/));
    const cityWords = new Set(cityLower.split(/\s+/));
    const commonStop = new Set(['kunde','boken','vilken','frågar','börjar','startar','körkort','kör','att','och','eller','men','för','inte','till','från','med','vid','hos','kan','vill','vara']);
    const queryWords = sanitized
      .replace(/[?!.,]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 6 && !areaWords.has(w) && !cityWords.has(w) && !commonStop.has(w));

    info(`Query-ord för tjänstmatchning: ${JSON.stringify(queryWords)}`);

    if (queryWords.length > 0) {
      const hasLocalServiceChunk = allChunks.some(c =>
        c.city?.toLowerCase() === cityLower &&
        c.area?.toLowerCase() === areaLower &&
        (c.type === 'price' || c.type === 'basfakta') &&
        (
          queryWords.some(w =>
            (c.service_name || '').toLowerCase().includes(w) ||
            (c.title || '').toLowerCase().includes(w) ||
            (c.text || '').toLowerCase().includes(w)
          ) ||
          (detectedVehicle && c.vehicle === detectedVehicle)
        )
      );

      if (hasLocalServiceChunk) {
        ok(`Lokal tjänst hittad för "${detectedArea}" — ingen systemnotering behövs`);
      } else {
        const alternatives = [...new Set(
          allChunks
            .filter(c =>
              c.city?.toLowerCase() === cityLower &&
              c.area && c.area.toLowerCase() !== areaLower &&
              c.type === 'price' &&
              (
                queryWords.some(w =>
                  (c.service_name || '').toLowerCase().includes(w) ||
                  (c.title || '').toLowerCase().includes(w)
                ) ||
                (detectedVehicle && c.vehicle === detectedVehicle)
              )
            )
            .map(c => c.area)
        )].slice(0, 4);

        if (alternatives.length > 0) {
          localAvailabilityNote = `\n\n[SYSTEMNOTERING — LOKAL TILLGÄNGLIGHET: Tjänsten kunden frågar om erbjuds INTE vid kontoret i ${detectedArea}. Matchande tjänst finns däremot vid följande kontor i ${lockedCity}: ${alternatives.join(', ')}. Du MÅSTE svara tydligt att tjänsten INTE erbjuds i ${detectedArea}, och sedan nämna dessa alternativa kontor som kunden kan vända sig till.]`;
          warn(`Ingen lokal tjänst i "${detectedArea}". Alternativ i ${lockedCity}: ${alternatives.join(', ')}`);
        } else {
          localAvailabilityNote = `\n\n[SYSTEMNOTERING — LOKAL TILLGÄNGLIGHET: Tjänsten kunden frågar om verkar inte erbjudas vid kontoret i ${detectedArea}, och inga andra matchande kontor i ${lockedCity} hittades. Svara ärligt att du inte kan bekräfta att tjänsten erbjuds här och hänvisa kunden till hemsidan eller att kontakta supporten för hjälp.]`;
          warn(`Ingen lokal tjänst i "${detectedArea}" och inga alternativ hittades`);
        }
      }
    } else {
      info('För få distinkta query-ord — hoppar över lokal tillgänglighets-check');
    }
  } else {
    info('Inget detekterat område — hoppar över lokal tillgänglighets-check');
  }

  if (localAvailabilityNote) {
    console.log(`\n${C.yellow}  SYSTEMNOTERING som injiceras:${C.reset}`);
    console.log(`${C.dim}${localAvailabilityNote}${C.reset}`);
  }

  // ── 8. AI-SVAR ─────────────────────────────────────────────
  hdr('STEG 8 — OPENAI-ANROP', C.cyan);

  if (!process.env.OPENAI_API_KEY) {
    warn('Hoppar över AI-anrop (ingen API-nyckel)');
    hdr('KLART — Ingen AI', C.magenta);
    return;
  }

  const OpenAI = require('openai');
  const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `Du är Atlas — en hjälpsam kundtjänstassistent för en svensk trafikskola.
Svara ENDAST utifrån kontexten nedan. Svara alltid på svenska.
Använd **fetstil** för priser och viktiga fakta.${localAvailabilityNote}`;

  const userContent = `Fråga: ${userQuery}\n\nKONTEXT:\n${contextStr}`;

  console.log(`  Modell: gpt-4o-mini | Temp: 0.0 | Max tokens: 700`);
  console.log(`  Skickar anrop...`);

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      max_tokens: 700,
      temperature: 0.0,
    });

    const answer = resp.choices?.[0]?.message?.content?.trim() || '(tomt svar)';
    const usage  = resp.usage;

    hdr('SVAR FRÅN AI', C.green);
    console.log(`\n${C.white}${C.bold}${answer}${C.reset}\n`);
    info(`Tokens: prompt=${usage?.prompt_tokens} completion=${usage?.completion_tokens} total=${usage?.total_tokens}`);
  } catch(e) {
    err(`OpenAI-fel: ${e.message}`);
  }

  // ── SAMMANFATTNING ─────────────────────────────────────────
  hdr('SAMMANFATTNING', C.magenta);
  val('Fråga',          userQuery);
  val('Intent',         nluResult.intent);
  val('Stad',           lockedCity || '(ingen)');
  val('Område',         detectedArea || '(inget)');
  val('Fordon',         detectedVehicle || '(inget)');
  val('Force-addade',   mustAddChunks.length);
  val('Chunks i kontext', usedChunks.length);
  val('Bästa score',    sorted[0]?.score || 0);
  val('Top chunk',      (allChunks.find(c=>c.id===sorted[0]?.id)||{}).title || '(ingen)');
  console.log('');
}

runDebug().catch(e => {
  err(`Oväntat fel: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});