interface PriceChunk {
  id?: string;
  type?: string;
  city?: string | null;
  title?: string | null;
  text?: string | null;
  service_name?: string | null;
  keywords?: Array<string | number> | null;
  price?: number | string | null;
  currency?: string | null;
}

interface GlobalFallbackEntry {
  price: number;
  currency?: string;
}

interface ResolvePriceArgs {
  city?: string | null;
  serviceTerm?: string | null;
  chunkMap: Map<string, PriceChunk>;
  globalFallback?: Record<string, GlobalFallbackEntry> | null;
}

interface ResolvePriceMatch {
  id?: string;
  service_name?: string | null;
  price?: number | string | null;
}

interface ResolvePriceResult {
  found: boolean;
  price: number;
  source: string;
  currency?: string;
  matches?: ResolvePriceMatch[];
}

function median(values: number[]): number {
  const validValues = values.filter((value) => typeof value === 'number' && value > 0);

  if (validValues.length === 0) {
    return 0;
  }

  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return sorted[mid];
}

function serviceMatchesChunk(serviceTerm: string | null | undefined, chunk: PriceChunk | null | undefined): boolean {
  if (!serviceTerm || !chunk) {
    return false;
  }

  const term = serviceTerm.toString().toLowerCase().trim();
  const chunkName = (chunk.service_name || chunk.title || '').toLowerCase();

  if (chunkName === term) {
    return true;
  }

  const isTestlektionSearch = term.includes('testlektion');
  const isRiskSearch = term.includes('risk');
  const isIntroSearch = term.includes('intro') || term.includes('handledar');

  if (isTestlektionSearch && !chunkName.includes('testlektion')) {
    return false;
  }
  if (isRiskSearch && !chunkName.includes('risk')) {
    return false;
  }
  if (isIntroSearch && !(chunkName.includes('intro') || chunkName.includes('handledar'))) {
    return false;
  }

  if (Array.isArray(chunk.keywords)) {
    for (const keyword of chunk.keywords) {
      if (keyword.toString().toLowerCase() === term) {
        return true;
      }
    }
  }

  if (chunkName.includes(term)) {
    if (isTestlektionSearch && chunkName.includes('risk')) {
      return false;
    }
    return true;
  }

  return false;
}

function resolvePrice({ city, serviceTerm, chunkMap, globalFallback }: ResolvePriceArgs): ResolvePriceResult {
  const allChunks = Array.from(chunkMap.values());
  const allPriceChunks = allChunks.filter((chunk) => chunk.type === 'price');
  const matches: Array<{ chunk: PriceChunk; matchedOn: string }> = [];

  if (city && serviceTerm) {
    const term = serviceTerm.toLowerCase().trim();
    const cityLower = city.toLowerCase().trim();

    const exactNameMatch = allPriceChunks.find((chunk) => {
      const chunkCity = (chunk.city || '').toLowerCase().trim();
      const chunkName = (chunk.service_name || chunk.title || '').toLowerCase().trim();
      const exactPrice = Number(chunk.price);
      return chunkCity === cityLower && chunkName === term && !Number.isNaN(exactPrice) && exactPrice > 0;
    });

    if (exactNameMatch) {
      return {
        found: true,
        price: Number(exactNameMatch.price),
        currency: exactNameMatch.currency || 'SEK',
        source: 'exact_name_match',
        matches: [{
          id: exactNameMatch.id,
          service_name: exactNameMatch.service_name || exactNameMatch.title,
          price: exactNameMatch.price,
        }],
      };
    }
  }

  if (city && serviceTerm) {
    const cityMatches: number[] = [];
    for (const chunk of allPriceChunks) {
      const chunkCity = (chunk.city || '').toString().toLowerCase();
      if (chunkCity !== city.toString().toLowerCase()) {
        continue;
      }

      const price = Number(chunk.price);
      if (Number.isNaN(price) || price <= 0) {
        continue;
      }

      if (serviceMatchesChunk(serviceTerm, chunk)) {
        cityMatches.push(price);
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
          matches: matches.map(({ chunk }) => ({
            id: chunk.id,
            service_name: chunk.service_name || chunk.title,
            price: chunk.price,
          })),
        };
      }
    }
  }

  if (globalFallback && serviceTerm) {
    const term = serviceTerm.toLowerCase().trim();
    const key = Object.keys(globalFallback).find((entryKey) => entryKey.toLowerCase() === term);
    if (key) {
      const entry = globalFallback[key];
      if (entry.price > 0) {
        return {
          found: true,
          price: entry.price,
          currency: entry.currency || 'SEK',
          source: 'global_fallback',
        };
      }
    }
  }

  return { found: false, price: 0, source: 'not_found' };
}

module.exports = {
  resolvePrice,
};
