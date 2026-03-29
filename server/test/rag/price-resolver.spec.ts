import { resolvePrice, type KnowledgeChunk } from '../../src/rag/utils/price-resolver';

function makeChunk(overrides: Partial<KnowledgeChunk>): KnowledgeChunk {
  return {
    id: 'test-1',
    title: 'Test',
    text: 'Test text',
    type: 'price',
    source: 'test.json',
    ...overrides,
  };
}

describe('Price Resolver', () => {
  describe('exact match', () => {
    it('finds exact city + service name match', () => {
      const chunks = [
        makeChunk({ id: 'p1', city: 'Stockholm', service_name: 'Körlektion', price: 750 }),
        makeChunk({ id: 'p2', city: 'Göteborg', service_name: 'Körlektion', price: 650 }),
      ];

      const result = resolvePrice({ city: 'Stockholm', serviceTerm: 'Körlektion', chunks });

      expect(result.found).toBe(true);
      expect(result.price).toBe(750);
      expect(result.source).toBe('exact_name_match');
    });

    it('is case-insensitive', () => {
      const chunks = [
        makeChunk({ id: 'p1', city: 'Stockholm', service_name: 'Körlektion', price: 750 }),
      ];

      const result = resolvePrice({ city: 'stockholm', serviceTerm: 'körlektion', chunks });
      expect(result.found).toBe(true);
      expect(result.price).toBe(750);
    });
  });

  describe('city fallback (median)', () => {
    it('returns median when multiple matches in city', () => {
      const chunks = [
        makeChunk({ id: 'p1', city: 'Stockholm', service_name: 'Lektion Bas', price: 600, keywords: ['körlektion'] }),
        makeChunk({ id: 'p2', city: 'Stockholm', service_name: 'Lektion Plus', price: 800, keywords: ['körlektion'] }),
        makeChunk({ id: 'p3', city: 'Stockholm', service_name: 'Lektion Premium', price: 1000, keywords: ['körlektion'] }),
      ];

      const result = resolvePrice({ city: 'Stockholm', serviceTerm: 'körlektion', chunks });
      expect(result.found).toBe(true);
      expect(result.price).toBe(800); // median of 600, 800, 1000
      expect(result.source).toBe('city_fallback');
    });
  });

  describe('not found', () => {
    it('returns not_found when no matching chunks', () => {
      const result = resolvePrice({ city: 'Eslöv', serviceTerm: 'Körlektion', chunks: [] });
      expect(result.found).toBe(false);
      expect(result.source).toBe('not_found');
    });

    it('returns not_found when city matches but service does not', () => {
      const chunks = [
        makeChunk({ id: 'p1', city: 'Stockholm', service_name: 'Risk 1', price: 1200 }),
      ];

      const result = resolvePrice({ city: 'Stockholm', serviceTerm: 'Körlektion', chunks });
      expect(result.found).toBe(false);
    });
  });

  describe('safety checks', () => {
    it('ignores chunks with price <= 0', () => {
      const chunks = [
        makeChunk({ id: 'p1', city: 'Stockholm', service_name: 'Gratis', price: 0 }),
      ];

      const result = resolvePrice({ city: 'Stockholm', serviceTerm: 'Gratis', chunks });
      expect(result.found).toBe(false);
    });

    it('does not mix testlektion with risk', () => {
      const chunks = [
        makeChunk({ id: 'p1', city: 'Stockholm', service_name: 'Risk 1 Testlektion', price: 500, keywords: ['risk'] }),
      ];

      const result = resolvePrice({ city: 'Stockholm', serviceTerm: 'testlektion', chunks });
      expect(result.found).toBe(false); // blocked by safety check
    });
  });

  describe('global fallback', () => {
    it('uses global fallback when no city match', () => {
      const result = resolvePrice({
        city: null,
        serviceTerm: 'Körlektion',
        chunks: [],
        globalFallback: { 'Körlektion': { price: 700, currency: 'SEK' } },
      });

      expect(result.found).toBe(true);
      expect(result.price).toBe(700);
      expect(result.source).toBe('global_fallback');
    });
  });
});
