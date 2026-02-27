// ============================================
// priceResolver.js
// VAD DEN GÖR: Slår upp priser från chunk-kartan med exakt stad+tjänst-matchning och fallback-logik.
// ANVÄNDS AV: legacy_engine.js
// SENAST STÄDAD: 2026-02-27
// ============================================

function median(values) {
const validValues = values.filter(v => typeof v === 'number' && v > 0);

if (!validValues || validValues.length === 0) return 0;

const sorted = [...validValues].sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);

if (sorted.length % 2 === 0) {
return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
} else {
return sorted[mid];
}
}

function serviceMatchesChunk(serviceTerm, chunk) {
if (!serviceTerm || !chunk) return false;
const term = serviceTerm.toString().toLowerCase().trim();
const chunkName = (chunk.service_name || chunk.title || "").toLowerCase();

// 1. Exakt matchning på namn
if (chunkName === term) return true;

// 2. Logik-spärrar: Förhindrar att "Bil" matchar fel tjänst
const isTestlektionSearch = term.includes("testlektion");
const isRiskSearch = term.includes("risk");
const isIntroSearch = term.includes("intro") || term.includes("handledar");

// Om vi söker efter en specifik typ, måste den typen finnas i namnet
if (isTestlektionSearch && !chunkName.includes("testlektion")) return false;
if (isRiskSearch && !chunkName.includes("risk")) return false;
if (isIntroSearch && !(chunkName.includes("intro") || chunkName.includes("handledar"))) return false;

// 3. Keyword-match (Strikt)
if (chunk.keywords && Array.isArray(chunk.keywords)) {
for (const kw of chunk.keywords) {
if (kw.toString().toLowerCase() === term) return true;
}
}

// 4. Inkluderar-match
if (chunkName.includes(term)) {
// Säkerhetskoll: Låt inte Risk-priser slinka med vid testlektions-sökning
if (isTestlektionSearch && chunkName.includes("risk")) return false;
return true;
}

return false;
}

module.exports = {
resolvePrice({ city, serviceTerm, chunkMap, globalFallback }) {
const allChunks = Array.from(chunkMap.values());
const allPriceChunks = allChunks.filter(c => c.type === 'price');
const matches = [];

// --- STEG 1: EXAKT MATCHNING (Stad + Tjänstenamn) ---
if (city && serviceTerm) {
const term = serviceTerm.toLowerCase().trim();
const cityLower = city.toLowerCase().trim();

const exactNameMatch = allPriceChunks.find(c => {
const chunkCity = (c.city || "").toLowerCase().trim();
const chunkName = (c.service_name || c.title || "").toLowerCase().trim();
return chunkCity === cityLower && chunkName === term && Number(c.price) > 0;
});

if (exactNameMatch) {
return {
found: true,
price: Number(exactNameMatch.price),
currency: exactNameMatch.currency || 'SEK',
source: 'exact_name_match',
matches: [{ id: exactNameMatch.id, service_name: exactNameMatch.service_name || exactNameMatch.title, price: exactNameMatch.price }]
};
}
}

// --- STEG 2: NORMAL SÖKNING (I vald stad) ---
if (city && serviceTerm) {
const cityMatches = [];
for (const chunk of allPriceChunks) {
const chunkCity = (chunk.city || '').toString().toLowerCase();

if (chunkCity !== city.toString().toLowerCase()) continue;

const p = Number(chunk.price);
if (isNaN(p) || p <= 0) continue;

if (serviceMatchesChunk(serviceTerm, chunk)) {
cityMatches.push(p);
matches.push({ chunk, matchedOn: 'city_fuzzy' });
}
}

if (cityMatches.length > 0) {
const priceValue = median(cityMatches);
if (priceValue > 0) {
return {
found: true,
price: priceValue,
currency: 'SEK',
source: 'city_fallback',
matches: matches.map(m => ({ id: m.chunk.id, service_name: m.chunk.service_name || m.chunk.title, price: m.chunk.price }))
};
}
}
}

// --- STEG 3: GLOBAL FALLBACK ---
if (globalFallback && serviceTerm) {
const term = serviceTerm.toLowerCase().trim();
const key = Object.keys(globalFallback).find(k => k.toLowerCase() === term);
if (key) {
const entry = globalFallback[key];
if (entry.price > 0) {
return {
found: true,
price: entry.price,
currency: entry.currency || 'SEK',
source: 'global_fallback'
};
}
}
}

return { found: false, price: 0, source: 'not_found' };
}
};