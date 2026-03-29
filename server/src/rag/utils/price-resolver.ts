// ============================================
// Price Resolver — exact city+service matching with fallback logic
// Ported from: utils/priceResolver.js
// ============================================

export interface KnowledgeChunk {
  id: string;
  title: string;
  text: string;
  type: 'basfakta' | 'price' | 'kontor_info';
  source: string;
  city?: string;
  area?: string;
  vehicle?: string;
  price?: number;
  currency?: string;
  service_name?: string;
  keywords?: string[];
  booking_url?: string;
  booking_links?: Record<string, string>;
  score?: number;
  boost?: number;
}

export interface PriceResult {
  found: boolean;
  price: number;
  currency?: string;
  source: 'exact_name_match' | 'city_fallback' | 'global_fallback' | 'not_found';
  matches?: Array<{ id: string; service_name: string; price: number }>;
}

function median(values: number[]): number {
  const valid = values.filter(v => typeof v === 'number' && v > 0);
  if (!valid.length) return 0;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function serviceMatchesChunk(serviceTerm: string, chunk: KnowledgeChunk): boolean {
  if (!serviceTerm || !chunk) return false;
  const term = serviceTerm.toLowerCase().trim();
  const chunkName = (chunk.service_name || chunk.title || '').toLowerCase();

  if (chunkName === term) return true;

  const isTestlektionSearch = term.includes('testlektion');
  const isRiskSearch = term.includes('risk');
  const isIntroSearch = term.includes('intro') || term.includes('handledar');

  if (isTestlektionSearch && !chunkName.includes('testlektion')) return false;
  if (isRiskSearch && !chunkName.includes('risk')) return false;
  if (isIntroSearch && !(chunkName.includes('intro') || chunkName.includes('handledar'))) return false;

  if (chunk.keywords && Array.isArray(chunk.keywords)) {
    for (const kw of chunk.keywords) {
      if (kw.toString().toLowerCase() === term) return true;
    }
  }

  if (chunkName.includes(term)) {
    if (isTestlektionSearch && chunkName.includes('risk')) return false;
    return true;
  }

  return false;
}

export function resolvePrice(opts: {
  city?: string | null;
  serviceTerm?: string | null;
  chunks: KnowledgeChunk[];
  globalFallback?: Record<string, { price: number; currency?: string }>;
}): PriceResult {
  const { city, serviceTerm, chunks, globalFallback } = opts;
  const priceChunks = chunks.filter(c => c.type === 'price');

  // Step 1: Exact match (city + service name)
  if (city && serviceTerm) {
    const term = serviceTerm.toLowerCase().trim();
    const cityLower = city.toLowerCase().trim();

    const exact = priceChunks.find(c => {
      const cCity = (c.city || '').toLowerCase().trim();
      const cName = (c.service_name || c.title || '').toLowerCase().trim();
      const p = Number(c.price);
      return cCity === cityLower && cName === term && !isNaN(p) && p > 0;
    });

    if (exact) {
      return {
        found: true,
        price: Number(exact.price),
        currency: exact.currency || 'SEK',
        source: 'exact_name_match',
        matches: [{ id: exact.id, service_name: exact.service_name || exact.title, price: Number(exact.price) }],
      };
    }
  }

  // Step 2: City fuzzy (all matching services in city, take median)
  if (city && serviceTerm) {
    const cityPrices: number[] = [];
    const matches: Array<{ id: string; service_name: string; price: number }> = [];

    for (const chunk of priceChunks) {
      if ((chunk.city || '').toLowerCase() !== city.toLowerCase()) continue;
      const p = Number(chunk.price);
      if (isNaN(p) || p <= 0) continue;
      if (serviceMatchesChunk(serviceTerm, chunk)) {
        cityPrices.push(p);
        matches.push({ id: chunk.id, service_name: chunk.service_name || chunk.title, price: p });
      }
    }

    if (cityPrices.length > 0) {
      const price = median(cityPrices);
      if (price > 0) {
        return { found: true, price, currency: 'SEK', source: 'city_fallback', matches };
      }
    }
  }

  // Step 3: Global fallback
  if (globalFallback && serviceTerm) {
    const term = serviceTerm.toLowerCase().trim();
    const key = Object.keys(globalFallback).find(k => k.toLowerCase() === term);
    if (key && globalFallback[key].price > 0) {
      return {
        found: true,
        price: globalFallback[key].price,
        currency: globalFallback[key].currency || 'SEK',
        source: 'global_fallback',
      };
    }
  }

  return { found: false, price: 0, source: 'not_found' };
}
