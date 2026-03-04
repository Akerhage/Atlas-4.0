// ============================================
// forceAddEngine.js
// VAD DEN GÖR: Tvångsinjicerar relevanta kunskapsblock (chunks) i RAG-kontexten baserat på sökord och intent.
// ANVÄNDS AV: legacy_engine.js
// SENAST STÄDAD: 2026-02-27
// ============================================

class forceAddEngine {
constructor(allChunks, scores = {}) {
this.allChunks = allChunks;
this.mustAddChunks = [];
this.forceHighConfidence = false;
this.version = "1.9.6";

// Scores med fallback till hårdkodade defaults
this.scores = {
a1_am:       scores.rag_score_a1_am       ?? 25000,
fix_saknade: scores.rag_score_fix_saknade  ?? 20000,
c8_kontakt:  scores.rag_score_c8_kontakt   ?? 25000,
b1_policy:   scores.rag_score_b1_policy    ?? 50000,
c7_teori:    scores.rag_score_c7_teori     ?? 55000
};
console.log(`[ForceAddEngine v${this.version}] Scores: ${JSON.stringify(this.scores)}`);
}

// === HJÄLPFUNKTIONER ===
qHas(queryLower, ...terms) {
return terms.some(t => queryLower.includes(t));
}

qReg(queryLower, re) {
return re.test(queryLower);
}

isBasfakta(c) {
const t = (c && c.type) ? c.type.toString().toLowerCase() : '';
return t === 'basfakta' || t === 'basfak' || t === 'basfacts' || t === 'basfacta' || t === 'bas-fakta';
}

// === CHUNK-HANTERING & PRIORITERING ===
addChunks(chunks, score, prepend = false) {

// 🛑 SÄKERHETSFILTER: Kasta bort pris-chunks som är 0 kr eller "0 SEK"
// Detta hindrar motorn från att tvinga in felaktiga priser via "bakdörren".
const validChunks = chunks.filter(c => {
if (c.type === 'price') {
const p = Number(c.price);
// 1. Om priset är 0, NaN eller negativt -> KASTA
if (isNaN(p) || p <= 0) {
return false;
}

// 2. Extra koll: Om texten avslöjar 0 kr
if (c.text && (c.text.includes(" 0 SEK") || c.text.includes(": 0 kr"))) {
return false;
}
}
return true; // Alla andra chunks (basfakta, etc) är OK
});

// Om vi inte har några chunks kvar efter filtret, avbryt
if (validChunks.length === 0) return 0;



const uniqueChunks = validChunks.filter(c => !this.mustAddChunks.some(existing => existing.id === c.id));

const scoredChunks = uniqueChunks.map(c => ({
...c,
score: score, // Överskriv score med regelns prioritet
forced: true
}));

if (prepend) {
this.mustAddChunks.unshift(...scoredChunks);
} else {
this.mustAddChunks.push(...scoredChunks);
}

return uniqueChunks.length; // Returnera antal tillagda (för loggning)
}

findBasfaktaBySource(sourceFilename) {
const cleanSearch = sourceFilename.toLowerCase()
.replace('.json', '')
.replace('basfakta_', '')
.replace(/_/g, ''); // Normalisera bort understreck

return this.allChunks.filter(c => {
if (!this.isBasfakta(c)) return false;
const s = (c.source || '').toLowerCase().replace(/_/g, '');
return s.includes(cleanSearch); // Tolerant matchning
});
}

// --- GRUPP A: HÖGSTA PRIO (KORT/TESTLEKTION/INGÅR) ---

rule_A1_AM(queryLower, intent, slots) {
if (slots.vehicle !== 'AM' && !this.qReg(queryLower, /\bam\b/) && !this.qHas(queryLower, 'moped', 'moppe')) {
return 0;
}
const chunks = this.findBasfaktaBySource('basfakta_am_kort_och_kurser.json');
const score = this.scores.a1_am;
const count = this.addChunks(chunks, score, false);
console.log(`[A1-AM] Lade till ${count} chunks (score: ${score})`);
return count;
}

/**
* REGEL A3: AM-INNEHÅLL (INAKTIVERAD - Hanteras av Nollutrymme Fallback)
*/
rule_A3_AM_Content(queryLower, intent, slots) {
// REGEL A3 ÄR INAKTIVERAD. AM-Ingår hanteras av EMERGENCY FALLBACK.
return 0;
}

rule_A4_LockedCityGenericPrice(queryLower, intent, slots, lockedCity) {
// Triggers om vi söker pris OCH har en låst stad OCH frågan inkluderar en lektionsterm
if (lockedCity && intent === 'price_lookup' && this.qHas(queryLower, 'körlektion', 'lektion', 'köra', 'lektioner')) {
const targetServiceName = "Körlektion Bil";

const matchingChunks = this.allChunks.filter(c => 
c.type === 'price' && 
(c.city || '').toString().toLowerCase() === lockedCity.toLowerCase() &&
c.service_name === targetServiceName // EXAKT matchning på tjänstens namn
);

// Lägg till med absolut högsta prioritet (10000) och preppend: true
const count = this.addChunks(matchingChunks, 10000, true);
if (count > 0) {
console.log(`[A4-LOCKED-PRICE] Lade till ${count} Körlektionspris för ${lockedCity} (score: 10000, FÖRST)`);
}
return count;
}
return 0;
}

// --- GRUPP B: KRITISK POLICY/INTRO/TILLSTÅND ---

/**
* REGEL B1: Injicerar policy-chunks vid avbokning/ånger/giltighetsfrågor.
*/
rule_B1_Policy(queryLower, intent, slots) {
// --- 1. VAKTEN: Blockera endast om det är en ren tillståndsfråga utan policy-ord ---
const policyKeywords = ['avbokning', 'avboka', 'sjukanmälan', 'ångerrätt', 'återbetalning'];
if (this.qHas(queryLower, 'tillstånd', 'körkortstillstånd', 'läkarintyg') && !this.qHas(queryLower, ...policyKeywords)) {
return 0; 
}

let added = 0;
const criticalKeywords = ['avbokning', 'avboka', 'sjukanmälan', 'sjukdom', 'sjuk', 'ångerrätt', 'återbetalning'];
const standardKeywords = [
'regler', 'villkor', 'policy', 'giltighetstid', 'trafikverket',
'krav', 'legitimation', 'handledare', 'övningskörning', 'alkolås',
'syntest', 'passagerare', 'barn i bilen', 
'övningsköra privat', 'bokning'
];

const hasCritical = this.qHas(queryLower, ...criticalKeywords);
const hasStandard = this.qHas(queryLower, ...standardKeywords);

if (hasCritical || hasStandard) {
const chunks = this.findBasfaktaBySource('basfakta_policy_kundavtal.json');

if (intent === 'policy' || intent === 'booking' || intent === 'legal_query') {
this.forceHighConfidence = true;
added += this.addChunks(chunks, this.scores.b1_policy, true);
} else {
// Om vi inte har rätt intent, sänk score till 3000 så MiniSearch vinner
added += this.addChunks(chunks, 3000, false);
}
}
return added;
}

/**
* REGEL B2: FÖRETAGSINFO/FINANS (Rensad: Hanterar ej Fakturaadress längre)
*/
rule_B2_Finance(queryLower, intent, slots) {
const has_keywords = this.qHas(queryLower,
'betalning', 'klarna', 'swish', 'faktura', 'orgnr', 'bankgiro',
'delbetala', 'kredit', 'finansiering', 'studentrabatt', 'rabatt',
'dyrare', 'billigare', 'olika priser', 'priser skiljer'
);

if (!has_keywords) return 0;

const generalChunks = this.findBasfaktaBySource('basfakta_om_foretaget.json');

// Intent-gate
if (intent === 'policy' || intent === 'booking' || intent === 'price_lookup') {
const count = this.addChunks(generalChunks, 8000, false);
console.log(`[B2-FINANS] Score: 8000 (Intent Match)`);
return count;
} else {
// Låg prio fallback (3 000)
const count = this.addChunks(generalChunks, 3000, false);
return count;
}
}

/**
* REGEL B4: KÖRKORTSTILLSTÅND)
*/
rule_B4_KortTillstand(queryLower, intent, slots) {
const has_keywords = this.qHas(queryLower, 
'körkortstillstånd', 'tillstånd', 'handläggningstid', 'läkarintyg', 'syntest', 'prövotid',
'ansöka', 'ansökan', 'hur ansöker'
);

if (intent !== 'tillstand_info' && !has_keywords) {
return 0;
}

if (this.qHas(queryLower, 'prövotid')) {
const provtidChunk = this.allChunks.filter(c =>
this.isBasfakta(c) && (c.keywords || []).includes('prövotid')
);
this.addChunks(provtidChunk, 10000, true);
}

const chunks = this.findBasfaktaBySource('basfakta_korkortstillstand.json');
return this.addChunks(chunks, 7000, false);
}

//REGEL B5: SPECIFIK GILTIGHET
rule_B5_SpecificFact(queryLower, intent, slots) {
let added = 0;
const isExplicitPackageGiltighet = this.qHas(queryLower, 'paket giltighet', 'presentkort giltighet', 'giltighet på paket');
const isPackageQuery = this.qHas(queryLower, 'paket', 'presentkort') && this.qHas(queryLower, 'hur länge gäller', 'giltig');

if (isExplicitPackageGiltighet || isPackageQuery) {
const giltighetChunks = this.allChunks.filter(c =>
this.isBasfakta(c) && (
(c.title || '').toLowerCase().includes('paket giltighet') ||
(c.title || '').toLowerCase().includes('presentkort')
)
);

giltighetChunks.forEach(c => {
c.text = c.text.replace(/24 månader/gi, '<EXACT_FACT>24 månader</EXACT_FACT>');
});

added += this.addChunks(giltighetChunks, 10000, true);
}
return added;
}

// --- GRUPP C: ÖVRIG KRITISK BASFAKTA ---

// --- C1: Risk 1 ---
rule_C1a_Risk1(queryLower, intent, slots) {
if (!this.qHas(queryLower, 'risk 1', 'riskettan')) {
return 0;
}

const allRiskChunks = this.findBasfaktaBySource('basfakta_riskutbildning_bil_mc.json');
const risk1Chunks = allRiskChunks.filter(c =>
(c.title || '').toLowerCase().includes('risk 1') ||
(c.title || '').toLowerCase().includes('riskettan')
);

const count = this.addChunks(risk1Chunks, 9000, true);
if (count > 0) {
this.forceHighConfidence = true;
console.log(`[C1a-RISK1] Lade till ${count} specifika Risk 1-chunks FÖRST (score: 9000, HIGH CONF)`);
}
return count;
}

// --- C1B: Risk 2 ---
rule_C1b_Risk2(queryLower, intent, slots) {
if (!this.qHas(queryLower, 'risk 2', 'risktvåan', 'halkbana')) {
return 0;
}

const allRiskChunks = this.findBasfaktaBySource('basfakta_riskutbildning_bil_mc.json');

const risk2Chunks = allRiskChunks.filter(c =>
(c.title || '').toLowerCase().includes('risk 2') ||
(c.title || '').toLowerCase().includes('risktvåan') ||
(c.title || '').toLowerCase().includes('halkbanan')
);

const count = this.addChunks(risk2Chunks, 9000, true);
if (count > 0) {
this.forceHighConfidence = true;
console.log(`[C1b-RISK2] Lade till ${count} specifika Risk 2-chunks FÖRST (score: 9000, HIGH CONF)`);
}
return count;
}

// --- C1C: Riskutbildning GENERELL ---
rule_C1c_RiskGeneric(queryLower, intent, slots) {
const hasGenericKeyword = this.qHas(queryLower, 'riskutbildning');
const hasSpecificKeyword = this.qHas(queryLower, 'risk 1', 'riskettan', 'risk 2', 'risktvåan', 'halkbana');

if ((intent === 'risk_course' || hasGenericKeyword) && !hasSpecificKeyword) {
const chunks = this.findBasfaktaBySource('basfakta_riskutbildning_bil_mc.json');
const count = this.addChunks(chunks, 6500, false);
console.log(`[C1c-RISK-GENERIC] Lade till ${count} generiska risk-chunks (score: 6500)`);
return count;
}
return 0;
}

// --- C2: MC BEHÖRIGHET ---
rule_C2_MC_Behorighet(queryLower, intent, slots) {
const has_mc_keywords = this.qHas(queryLower, 'motorcykel', 'a1', 'a2', '125cc', 'lätt motorcykel', 'tung motorcykel');

if (slots.vehicle === 'MC' || has_mc_keywords) {
const chunks = this.findBasfaktaBySource('basfakta_mc_a_a1_a2.json');
const count = this.addChunks(chunks, 6000, false);
console.log(`[C2-MC-BEHÖRIGHET] Lade till ${count} MC behörighets-chunks (score: 6000)`);
return count;
}
return 0;
}

// --- C4: PAKET BIL---
rule_C4_Paket_Bil(queryLower, intent, slots) {
// Tillåter avgifter/appar att visas (hård return 0 är borttagen)
const has_paket_keywords = this.qHas(queryLower, 'paket', 'totalpaket', 'minipaket', 'mellanpaket', 'baspaket', 'lektionspaket', 'avgift', 'avgifter');

if (slots.vehicle === 'BIL' || (has_paket_keywords && slots.vehicle === null)) {
const chunks = this.findBasfaktaBySource('basfakta_lektioner_paket_bil.json');
const score = (intent === 'price_lookup' || intent === 'booking' || has_paket_keywords) ? 8500 : 4000;
return this.addChunks(chunks, score, false);
}
return 0;
}

// --- C5: PAKET MC ---
rule_C5_Paket_MC(queryLower, intent, slots) {
const has_paket_keywords = this.qHas(queryLower, 'mc-paket', 'mc paket') || (this.qHas(queryLower, 'mc') && this.qHas(queryLower, 'paket'));
let count = 0;

// 1. Standardpaket för MC
if (slots.vehicle === 'MC' || has_paket_keywords) {
const chunks = this.findBasfaktaBySource('basfakta_lektioner_paket_mc.json');
count += this.addChunks(chunks, 8500, false);
console.log(`[C5-PAKET-MC] Lade till ${count} MC-paket-chunks (score: 8500)`);
}

// 2. Hantera MC-säsong, vinter och specifika testlektioner (Löser FAIL 94)
if (this.qHas(queryLower, 'säsong', 'vinter', 'väder', 'testlektion mc', 'när börjar ni', 'när slutar ni')) {
const seasonChunks = this.findBasfaktaBySource('basfakta_mc_lektioner_utbildning.json');
const addedSeason = this.addChunks(seasonChunks, 9200, true); // Prepend: true för hög prio
console.log(`[C5-SÄSONG-MC] Lade till ${addedSeason} säsongs-chunks (score: 9200)`);
count += addedSeason;
}

return count;
}

// --- C6: TUNGA FORDON/LASTBIL GENERELL ---
rule_C6_TungaFordon(queryLower, intent, slots) {
if (slots.vehicle === 'LASTBIL' || slots.vehicle === 'SLÄP') {
let chunkSource = (slots.vehicle === 'LASTBIL') 
? 'basfakta_lastbil_c_ce_c1_c1e.json' 
: 'basfakta_be_b96.json';

let score = 6500;
let addedCount = 0;

// Om frågan är specifik (innehåller sökord), ge den högre vikt
if (this.qHas(queryLower, 'lastbil', 'c-körkort', 'ce', 'släp', 'be-kort', 'b96')) { 
score = 7000;
// Använder prepend: true för att säkerställa att fakta ligger tidigt i kontexten
addedCount = this.addChunks(this.findBasfaktaBySource(chunkSource), score, true);
console.log(`[C6-TUNGA FORDON] Lade till ${addedCount} chunks (Kärnfråga, score: ${score})`);
} else {
// Laddar filen bara baserat på slot
addedCount = this.addChunks(this.findBasfaktaBySource(chunkSource), score, false);
console.log(`[C6-TUNGA FORDON] Lade till ${addedCount} chunks (Slot-baserad, score: ${score})`);
}
return addedCount;
}
return 0;
}

// --- C7: APPEN MITT KÖRKORT ---
rule_C7_TeoriAppen(queryLower, intent, slots) {
const has_app_keywords = this.qHas(queryLower, 'appen', 'app', 'mittkorkort', 'teori', 'statistik', 'bemästra', 'frågor', '90%', '900 frågor', 'gratis', 'premium');

if (has_app_keywords) {
// 1. Vi använder det exakta filnamnet för att garantera matchning
const chunks = this.findBasfaktaBySource('basfakta_korkortsteori_mitt_korkort.json');

// 2. Vi höjer poängen för att vinna över policyn och stadsinfo
// Detta garanterar att app-infon hamnar ABSOLUT ÖVERST i AI-kontexten.
return this.addChunks(chunks, this.scores.c7_teori, true);
}
return 0;
}

// --- C8: KONTAKT-SUPPORT-FAKTURA-BETALNING ETC GENERELL ---
rule_C8_Kontakt(queryLower, intent, slots, lockedCity) {
let added = 0;
const contactKeywords = [
'kontakta', 'kontakt', 'ring', 'telefon', 'mail', 'mejl', 'adress',
'öppettider', 'hitta hit', 'var ligger', 'karta', 'support', 'kundtjänst',
'faktura', 'bankgiro', 'swish', 'orgnr', 'organisationsnummer', 'vd', 'ägare'
];

if (this.qHas(queryLower, ...contactKeywords)) {
if (intent === 'contact_info') {
let score = this.scores.c8_kontakt;
let prepend = this.qHas(queryLower, 'kontakta support', 'ring support', 'kundtjänst nummer');
added += this.addChunks(this.findBasfaktaBySource('basfakta_om_foretaget.json'), score, prepend);
} else {
added += this.addChunks(this.findBasfaktaBySource('basfakta_om_foretaget.json'), 5000, false);
}
}

const targetCity = slots.city || lockedCity;
if (targetCity) {
const officeChunks = this.allChunks.filter(c => c.type === 'office_info' && (c.city || '').toLowerCase() === targetCity.toLowerCase());
if (officeChunks.length > 0) {
if (intent === 'contact_info' || intent === 'booking') {
added += this.addChunks(officeChunks, 60000, true);
this.forceHighConfidence = true; // Sätts direkt i regeln för explicit stadsmatch
} else {
added += this.addChunks(officeChunks, 8000, false);
}
}
}
return added;
}

// --- C9: BILFAKTA GENERELL ---
rule_C9_BilFakta(queryLower, intent, slots) {
// Hanterar Automat/Manuell-körkort
if (this.qHas(queryLower, 'automat', 'manuell', 'villkor 78', 'kod 78', 'körkort för automat', 'körkort för manuell')) {
const chunks = this.findBasfaktaBySource('basfakta_personbil_b.json');
const added = this.addChunks(chunks, 7500, true); 
if (added > 0) console.log(`[C9-BIL-FAKTA] Lade till ${added} Automat/Manuell-chunks (score: 7500)`);
return added;
}
return 0;
}

// === PRECISIONSREGLER ===

// --- FIX: STEG 1-12-GUIDE GENERELL ---
rule_Fix_StegGuide(queryLower, intent) {
if ((intent === 'intent_info' || intent === 'booking') && this.qHas(queryLower, 'steg', 'hur tar man körkort', 'processen', 'vägen till körkort')) {
const chunks = this.findBasfaktaBySource('basfakta_12_stegsguide_bil.json');
return this.addChunks(chunks, 11000, true);
}
return 0;
}

rule_Fix_Giltighet(queryLower, intent) {
let added = 0;

// ---------------------------------------------------------
// SCENARIO 1: Körkortstillstånd (5 år)
// ---------------------------------------------------------
if (this.qHas(queryLower, 'tillstånd', 'körkortstillstånd', 'förlänga', 'giltig', 'handledar', 'syn', 'läkarintyg')) {

// Intent-gate: Kräv tillstånd/policy-intent
if (intent === 'tillstand_info' || intent === 'policy' || intent === 'handledare_course') {
added += this.addChunks(this.findBasfaktaBySource('basfakta_korkortstillstand.json'), 30000, true);

if (this.qHas(queryLower, 'handledar', 'introduktionskurs')) {
added += this.addChunks(this.findBasfaktaBySource('basfakta_introduktionskurs_handledarkurs_bil.json'), 30000, true);
}

// Rensa policy-chunks för att undvika 24-månaders-förvirring
this.mustAddChunks = this.mustAddChunks.filter(c => !c.source.includes('policy_kundavtal'));
console.log(`[FIX-GILTIGHET] Tillstånd (5 år) - Score: 30000 (Intent Match)`);
} else {
// Fallback (8 500 - Kritisk info men fel intent)
added += this.addChunks(this.findBasfaktaBySource('basfakta_korkortstillstand.json'), 8500, false);
}
}

// ---------------------------------------------------------
// SCENARIO 2: Paket/Presentkort (24 månader)
// ---------------------------------------------------------
if (this.qHas(queryLower, 'paket', 'lektioner', 'presentkort') && 
this.qHas(queryLower, 'giltighet', 'länge gäller', 'giltig')) {

// Säkerhetscheck: Injicera INTE om vi pratar om tillstånd
if (!this.qHas(queryLower, 'tillstånd', 'körkortstillstånd', 'förlänga')) {

if (intent === 'policy' || intent === 'booking' || intent === 'price_lookup') {
added += this.addChunks(this.findBasfaktaBySource('basfakta_policy_kundavtal.json'), 42000, true);
console.log(`[FIX-GILTIGHET] Paket (24 mån) - Score: 42000 (Intent Match)`);
} else {
// Fallback (5 000 - Standard)
added += this.addChunks(this.findBasfaktaBySource('basfakta_policy_kundavtal.json'), 5000, false);
}
}
}

// ---------------------------------------------------------
// SCENARIO 3: Riskutbildning (5 år) - ÅTERSTÄLLD & SÄKRAD
// ---------------------------------------------------------
if (this.qHas(queryLower, 'risk 1', 'risk 2', 'riskutbildning', 'halkbana', 'riskettan')) {
const riskChunks = this.findBasfaktaBySource('basfakta_riskutbildning_bil_mc.json');

if (intent === 'risk_course' || intent === 'booking' || intent === 'policy') {
added += this.addChunks(riskChunks, 9500, true);
console.log(`[FIX-GILTIGHET] Riskutbildning - Score: 9500 (Intent Match)`);
} else {
// Fallback för att inte störa om man t.ex. frågar pris på paket som innehåller risk
added += this.addChunks(riskChunks, 5000, false);
}
}

// ---------------------------------------------------------
// SCENARIO 4: 12-stegsguiden / Prövotid - ÅTERSTÄLLD & SÄKRAD
// ---------------------------------------------------------
if (this.qHas(queryLower, 'steg 8', 'utbildningskontroll', 'steg 12', 'prövotid', 'prövotiden', 'moment')) {
const guideChunks = this.findBasfaktaBySource('basfakta_12_stegsguide_bil.json');

if (intent === 'intent_info' || intent === 'tillstand_info' || intent === 'booking') {
added += this.addChunks(guideChunks, 9900, true);
console.log(`[FIX-GILTIGHET] Stegguide/Prövotid - Score: 9900 (Intent Match)`);
} else {
added += this.addChunks(guideChunks, 5000, false);
}
}

return added;
}

// FIX 3: Tung Trafik (Endast Släp - Lastbil hanteras i FIX 10)
rule_Fix_TungTrafik(queryLower) {
if (this.qHas(queryLower, 'b96', 'be-kort', 'släp', '750 kg')) {
// Hämtar chunks för släp (BE/B96)
const chunks = this.findBasfaktaBySource('basfakta_be_b96.json');

// Vi sätter 11000 här också för att vara konsekventa och säkra svaret
return this.addChunks(chunks, 11000, true);
}
return 0;
}

// FIX 4: MC-platser och MC-Testlektioner
rule_Fix_MC_Extra(queryLower) {
let added = 0;

// Var finns MC? (frågor om orter/tillgänglighet)
if (this.qHas(queryLower, 'mc', 'motorcykel') && this.qHas(queryLower, 'var', 'erbjuder', 'finns ni', 'orter')) {
const chunks = this.findBasfaktaBySource('basfakta_mc_a_a1_a2.json');
added += this.addChunks(chunks, 9700, true);
}

// Testlektion MC måste prioriteras över bil
if (this.qHas(queryLower, 'testlektion', 'provlektion') && this.qHas(queryLower, 'mc', 'motorcykel')) {
const chunks = this.findBasfaktaBySource('basfakta_mc_lektioner_utbildning.json');
added += this.addChunks(chunks, 9900, true);
}

return added;
}


rule_Fix_SaknadeSvar(queryLower, intent) {
// Körs bara om vi inte vet vad användaren vill (unknown) eller om de uttryckligen ber om hjälp
if (intent !== 'unknown' && intent !== 'intent_info' && !this.qHas(queryLower, 'hjälp', 'förstår inte')) {
return 0;
}
const chunks = this.findBasfaktaBySource('basfakta_saknade_svar.json');
if (chunks.length) {
this.forceHighConfidence = true; 
return this.addChunks(chunks, this.scores.fix_saknade, true);
}
return 0;
}

rule_Fix_Nollutrymme(queryLower, intent) {
// Hindra hej/tack-svar från att injiceras i viktiga pris/faktafrågor
if (intent !== 'greeting' && !this.qHas(queryLower, 'vem är du', 'vad är du')) {
return 0;
}
const chunks = this.findBasfaktaBySource('basfakta_nollutrymme.json');
if (chunks.length) {
this.forceHighConfidence = true;
return this.addChunks(chunks, 11000, true);
}
return 0;
}

// FIX 8: Personbil Ålder/Krav (Löser FAIL [120])
rule_Fix_PersonbilInfo(queryLower, intent, vehicle) {
if ((intent === 'intent_info' && vehicle === 'BIL') || 
(this.qHas(queryLower, 'ålder', 'gammal', 'år', 'krav') && this.qHas(queryLower, 'b-körkort', 'bil', 'övningsköra'))) {

const chunks = this.findBasfaktaBySource('basfakta_personbil_b.json');
if (chunks.length) {
this.addChunks(chunks, 8500, true);
console.log(`[FIX-B-KÖRKORT] Lade till ${chunks.length} chunks för Personbil/Ålder`);
return 1;
}
}
return 0;
}

// FIX 9: Riskutbildning Generell (Löser FAIL [143] & [144])
rule_Fix_RiskInfo(queryLower, intent, service) {
if (intent === 'risk_info' || this.qHas(queryLower, 'risk', 'halkbana', 'riskettan', 'risktvåan', 'riskutbildning')) {
const chunks = this.findBasfaktaBySource('basfakta_riskutbildning_bil_mc.json');
if (chunks.length > 0) {
this.addChunks(chunks, 7000, false);
console.log(`[FIX-RISK-ALLA] Lade till ${chunks.length} generiska risk-chunks`);
return 1;
}
}
return 0;
}

// Lastbil Generell & YKB
// FIXAD: Sätt HÖGSTA prioritet (18000) för att slå ut pris-chunks
// och använd prepend: true för att säkerställa basfakta hamnar först
rule_Fix_Lastbil_YKB(queryLower, intent) {
  // Triggers för YKB och lastbilsutbildning (regelverk + tid + förnyelse)
  const isYKBQuery = this.qHas(queryLower, 'ykb', 'yrkeskompetensbevis', 'grundutbildning', 'fortbildning', '140 tim', '35 tim');
  const isLastbilQuery = this.qHas(queryLower, 'lastbil', 'c-körkort', 'ce-körkort', 'c1-körkort', 'lastbilsutbildning', 'tung lastbil');
  const isTimeQuery = this.qHas(queryLower, 'hur lång tid', 'hur länge', 'tid tar', 'timmar');
  const isFornyaQuery = this.qHas(queryLower, 'förnya', 'förnyelse', 'förnyar');
  
  // Kör om det är YKB ELLER (lastbil + (tid/förnya/intent_info))
  if (isYKBQuery || (isLastbilQuery && (isTimeQuery || isFornyaQuery || intent === 'intent_info' || intent === 'service_inquiry'))) {
    const chunks = this.findBasfaktaBySource('basfakta_lastbil_c_ce_c1_c1e.json');
    // Öka score till 18000 för att slå ut pris-chunks (som har ~7000)
    // prepend: true (tredje parametern) = läggs först i listan
    const count = this.addChunks(chunks, 18000, true);
    if (count > 0) {
      console.log(`[FIX-YKB/LASTBIL] Lade till ${count} basfakta-chunks FÖRE priser (score: 18000)`);
    }
    return count;
  }
  return 0;
}

// FIX 10b: Hur lång tid tar utbildningen? (alla fordon)
// Denna regel fångar upp generella "hur lång tid tar" frågor
rule_Fix_Utbildningstid(queryLower, intent, slots) {
  const isTimeQuery = this.qHas(queryLower, 'hur lång tid', 'hur länge tar', 'tid tar', 'duration', 'hur många timmar');
  const isUtbildningQuery = this.qHas(queryLower, 'utbildning', 'kurs', 'utbildningen', 'körkort');
  
  // Endast om det är en tid-fråga OM utbildning
  if (isTimeQuery && isUtbildningQuery) {
    let chunks = [];
    
    // Välj basfakta baserat på fordon
    if (slots.vehicle === 'LASTBIL' || this.qHas(queryLower, 'lastbil', 'c-körkort', 'ce')) {
      chunks = this.findBasfaktaBySource('basfakta_lastbil_c_ce_c1_c1e.json');
    } else if (slots.vehicle === 'MC' || this.qHas(queryLower, 'mc', 'motorcykel')) {
      chunks = this.findBasfaktaBySource('basfakta_mc_lektioner_utbildning.json');
    } else if (slots.vehicle === 'AM' || this.qHas(queryLower, 'moped', 'am')) {
      chunks = this.findBasfaktaBySource('basfakta_am_kort_och_kurser.json');
    } else {
      // Bil som fallback
      chunks = this.findBasfaktaBySource('basfakta_lektioner_paket_bil.json');
    }
    
    if (chunks.length > 0) {
      // Hög prioritet för att slå ut pris-chunks
      const count = this.addChunks(chunks, 17000, true);
      console.log(`[FIX-UTBILDNINGSTID] Lade till ${count} chunks för utbildningstid (score: 17000)`);
      return count;
    }
  }
  return 0;
}

// FIX 11: Utbildningskontroll (Steg 8)
rule_Fix_Utbildningskontroll(queryLower, intent) {
if ((intent === 'intent_info' || intent === 'booking') && this.qHas(queryLower, 'utbildningskontroll', 'steg 8', 'prova på', 'testlektion', 'uppkörning')) {
let count = this.addChunks(this.findBasfaktaBySource("basfakta_lektioner_paket_bil.json"), 9000, true);
if (queryLower.includes('mc')) {
count += this.addChunks(this.findBasfaktaBySource("basfakta_mc_lektioner_utbildning.json"), 9000, true);
}
return count;
}
return 0;
}

// === HUVUDMOTOR: EXECUTE ===

execute(queryLower, intentResult, lockedCity) {
this.mustAddChunks = [];
this.forceHighConfidence = false;
let totalAdded = 0;
let highConfCount = 0; 
const { intent, slots } = intentResult;

// --- PRECISIONSFIXAR: KEYWORD-FIRST (Säkrad Score: 18000) ---

// 1. SUPPORT (FAIL 32, 262)
if (this.qHas(queryLower, 'support', 'kundtjänst', 'hjälp', 'ring', 'kontakta', 'kontakt')) {
totalAdded += this.addChunks(this.findBasfaktaBySource('basfakta_om_foretaget.json'), 18000, true);
if (highConfCount++ < 2) this.forceHighConfidence = true;
}

// 1a. META-PRISFRÅGOR (t.ex. "Varför skiljer sig priserna åt i landet?")
if (this.qHas(queryLower, 'skiljer') ||
(this.qHas(queryLower, 'dyrare', 'billigare', 'olika priser') &&
this.qHas(queryLower, 'ort', 'stad', 'land', 'landet', 'region'))) {
const metaChunks = this.allChunks.filter(c =>
this.isBasfakta(c) &&
c.source && c.source.includes('basfakta_om_foretaget.json') &&
(c.keywords || []).some(k => ['dyrare', 'olika priser', 'varierar'].includes(k))
);
if (metaChunks.length > 0) {
totalAdded += this.addChunks(metaChunks, 18000, true);
if (highConfCount++ < 2) this.forceHighConfidence = true;
console.log(`[META-PRIS] Lade till ${metaChunks.length} meta-prischunks (score: 18000)`);
}
}

// 1b. FAKTURAADRESS GENERELL (Täcker alla varianter av fakturaadress-frågor)
if (this.qHas(queryLower, 'faktura', 'fakturaadress')) {
console.log(`[DEBUG-FAKTURA] Query matchar faktura-trigger`);

const fakturaChunks = this.allChunks.filter(c => {
const isBasfakta = this.isBasfakta(c);
const hasSource = c.source && c.source.includes('basfakta_om_foretaget.json');
const hasTitle = (c.title || '').toLowerCase().includes('faktura');

console.log(`[DEBUG-CHUNK] id=${c.id}, isBasfakta=${isBasfakta}, hasSource=${hasSource}, hasTitle=${hasTitle}`);

return isBasfakta && hasSource && hasTitle;
});

console.log(`[DEBUG-FAKTURA] Hittade ${fakturaChunks.length} chunks`);

if (fakturaChunks.length > 0) {
totalAdded += this.addChunks(fakturaChunks, 22000, true);
if (highConfCount++ < 2) this.forceHighConfidence = true;
console.log(`[FAKTURAADRESS-GENERELL] Lade till ${fakturaChunks.length} chunks (score: 22000)`);
} else {
console.log(`[DEBUG-FAKTURA] ❌ INGA CHUNKS HITTADES - Fallback till hela filen`);
const allCompanyChunks = this.findBasfaktaBySource('basfakta_om_foretaget.json');
totalAdded += this.addChunks(allCompanyChunks, 18000, true);
}
}

// 1c. HANDLEDARUTBILDNING (FAIL 33, 40)
if (this.qHas(queryLower, 'handledar', 'introduktionskurs', 'handledarkurs', 'hur lång tid', 'kostar handledarbevis')) {
const handledarChunks = this.allChunks.filter(c => 
this.isBasfakta(c) && 
c.source && 
c.source.includes('basfakta_introduktionskurs_handledarkurs_bil.json')
);

if (handledarChunks.length > 0) {
totalAdded += this.addChunks(handledarChunks, 22000, true);
if (highConfCount++ < 2) this.forceHighConfidence = true;
console.log(`[HANDLEDAR-GENERELL] Lade till ${handledarChunks.length} chunks (score: 22000)`);
}
}

// 2. TRAFIKVERKETS AVGIFTER (FAIL 41, 191)
if ((this.qHas(queryLower, 'avgift', 'avgifter') && this.qHas(queryLower, 'trafikverket', 'ingår', 'fotografering')) || this.qHas(queryLower, 'provavgift', 'fotografering')) {
totalAdded += this.addChunks(this.findBasfaktaBySource('basfakta_policy_kundavtal.json'), 18000, false);
if (highConfCount++ < 2) this.forceHighConfidence = true;
}

// 3. FAKTURAADRESS (FAIL 221-233)
if (this.qHas(queryLower, 'faktura', 'fakturaadress') && (this.qHas(queryLower, 'mda', 'mårtensson', 'academy', 'skicka', 'vart'))) {
const chunks = this.findBasfaktaBySource('basfakta_om_foretaget.json').filter(c => (c.title || '').toLowerCase().includes('faktura'));
totalAdded += this.addChunks(chunks.length ? chunks : this.findBasfaktaBySource('basfakta_om_foretaget.json'), 18000, false);
if (highConfCount++ < 2) this.forceHighConfidence = true;
}

// 4. INTRODUKTIONSKURS UNDANTAG MC (FAIL 159)
if (this.qHas(queryLower, 'kurs') && this.qHas(queryLower, 'mc', 'motorcykel', 'trafikskola') && this.qHas(queryLower, 'behöver', 'måste', 'gå', 'krävs')) {
totalAdded += this.addChunks(this.findBasfaktaBySource('basfakta_introduktionskurs_handledarkurs_bil.json'), 18000, false);
}

// 5. MC INTENSIV ANDRA STÄDER (Full täckning FAIL 357)
if (this.qHas(queryLower, 'intensiv', 'intensivvecka', 'intensivkurs', 'intensivutbildning') && this.qHas(queryLower, 'stockholm', 'malmö', 'andra orter', 'utanför göteborg', 'finns i', 'andra städer', 'inte bara göteborg', 'andra platser', 'finns på andra', 'övriga landet', 'fler orter')) {
totalAdded += this.addChunks(this.findBasfaktaBySource('basfakta_mc_lektioner_utbildning.json'), 18000, false);
if (highConfCount++ < 2) this.forceHighConfidence = true;
}

// 6. AM-MANÖVER ÅBY (Inkluderad i räknare)
if (this.qHas(queryLower, 'am', 'moped') && this.qHas(queryLower, 'åby', 'manöver')) {
totalAdded += this.addChunks(this.findBasfaktaBySource('basfakta_goteborg_banplatser.json'), 18000, false);
if (highConfCount++ < 2) this.forceHighConfidence = true;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`[FORCE-ADD ENGINE v${this.version}] Kör regler...`);
console.log(`Query: "${queryLower.slice(0, 80)}..."`);
console.log(`Intent: ${intentResult.intent}, Fordon: ${intentResult.slots.vehicle || 'N/A'}`);
console.log(`${'='.repeat(60)}`);

// --- 1. BASFAKTA PRECISIONS-FIXAR ---
// Dessa körs först för att fånga upp specifika sökord från din test-suite
totalAdded += this.rule_Fix_StegGuide(queryLower, intent);
totalAdded += this.rule_Fix_Giltighet(queryLower, intent);
totalAdded += this.rule_Fix_TungTrafik(queryLower);
totalAdded += this.rule_Fix_MC_Extra(queryLower);
totalAdded += this.rule_Fix_SaknadeSvar(queryLower, intent);
totalAdded += this.rule_Fix_Nollutrymme(queryLower, intent);
totalAdded += this.rule_Fix_PersonbilInfo(queryLower, intent, slots.vehicle);
totalAdded += this.rule_Fix_RiskInfo(queryLower, intent, slots.service);
totalAdded += this.rule_Fix_Lastbil_YKB(queryLower, intent);
totalAdded += this.rule_Fix_Utbildningstid(queryLower, intent, slots);
totalAdded += this.rule_Fix_Utbildningskontroll(queryLower, intent);
totalAdded += this.rule_B1_Policy(queryLower, intent, slots);

// --- 2. GLOBAL FALLBACK / INTENT OVERRIDES ---
if (intent === 'weather') {
return { mustAddChunks: [], forceHighConfidence: false };
}

// Tvinga in testlektion vid sökning (Fixar FAIL 93)
if (intent === 'testlesson_info' || /testlektion|provlektion/i.test(queryLower)) {
const chunks = this.allChunks.filter(c =>
(this.isBasfakta(c) && /testlektion.*elev/i.test(c.text)) ||
(this.isBasfakta(c) && /testlektion för bil/i.test(c.title))
);
if (chunks.length) totalAdded += this.addChunks(chunks, 9999, true);
}

// Tvinga in introduktionskurs/handledare (Fixar FAIL 35, 36)
if (intent === 'handledare_course' || this.qHas(queryLower, 'handledare', 'introduktionskurs')) {
const chunks = this.findBasfaktaBySource('basfakta_introduktionskurs_handledarkurs_bil.json');
if (chunks.length) totalAdded += this.addChunks(chunks, 9999, true);
}

// --- 3. SPECIFIKA MODULREGLER (Hög prioritet) ---
totalAdded += this.rule_A4_LockedCityGenericPrice(queryLower, intent, slots, lockedCity);
totalAdded += this.rule_C1a_Risk1(queryLower, intent, slots);
totalAdded += this.rule_C1b_Risk2(queryLower, intent, slots);
totalAdded += this.rule_C9_BilFakta(queryLower, intent, slots);
totalAdded += this.rule_B5_SpecificFact(queryLower, intent, slots); // Giltighetstids-tags

// --- 4. BEHÖRIGHET & PAKET (Medium prioritet) ---
totalAdded += this.rule_C2_MC_Behorighet(queryLower, intent, slots);
totalAdded += this.rule_C4_Paket_Bil(queryLower, intent, slots);
totalAdded += this.rule_C5_Paket_MC(queryLower, intent, slots);
totalAdded += this.rule_A1_AM(queryLower, intent, slots);
totalAdded += this.rule_C6_TungaFordon(queryLower, intent, slots);

// --- 5. EKONOMI, TEORI & SUPPORT (Låg prioritet) ---
totalAdded += this.rule_B2_Finance(queryLower, intent, slots);
totalAdded += this.rule_B4_KortTillstand(queryLower, intent, slots);
totalAdded += this.rule_C1c_RiskGeneric(queryLower, intent, slots);
totalAdded += this.rule_C7_TeoriAppen(queryLower, intent, slots);
totalAdded += this.rule_C8_Kontakt(queryLower, intent, slots, lockedCity);

console.log(`\n[FORCE-ADD] Totalt: ${totalAdded} unika chunks tillagda`);
console.log(`[FORCE-ADD] forceHighConfidence: ${this.forceHighConfidence}`);
console.log(`${'='.repeat(60)}\n`);

return {
mustAddChunks: this.mustAddChunks,
forceHighConfidence: this.forceHighConfidence
};
}
}

module.exports = forceAddEngine;