const priceResolver = require('../../../utils/priceResolver.ts');

function createChunkMap(chunks) {
  return new Map(chunks.map((chunk) => [chunk.id, chunk]));
}

describe('utils/priceResolver', () => {
  it('returns an exact city + service name match before fallback logic', () => {
    const chunkMap = createChunkMap([
      {
        id: 'malmo_bil_exact',
        type: 'price',
        city: 'Malmo',
        service_name: 'B-korkort',
        title: 'B-korkort i Malmo',
        price: 12995,
      },
      {
        id: 'malmo_bil_other',
        type: 'price',
        city: 'Malmo',
        service_name: 'Baspaket',
        title: 'Baspaket i Malmo',
        price: 9995,
      },
    ]);

    const result = priceResolver.resolvePrice({
      city: 'Malmo',
      serviceTerm: 'B-korkort',
      chunkMap,
      globalFallback: {},
    });

    expect(result).toMatchObject({
      found: true,
      price: 12995,
      source: 'exact_name_match',
    });
    expect(result.matches).toHaveLength(1);
  });

  it('uses the median from city matches when only fuzzy matches are available', () => {
    const chunkMap = createChunkMap([
      {
        id: 'gbg_risk_1',
        type: 'price',
        city: 'Goteborg',
        service_name: 'Risk 1',
        title: 'Risk 1 i Goteborg',
        price: 700,
        keywords: ['riskettan', 'risk 1'],
      },
      {
        id: 'gbg_risk_2',
        type: 'price',
        city: 'Goteborg',
        service_name: 'Riskettan express',
        title: 'Riskettan express i Goteborg',
        price: 900,
        keywords: ['riskettan'],
      },
      {
        id: 'sthlm_risk',
        type: 'price',
        city: 'Stockholm',
        service_name: 'Risk 1',
        title: 'Risk 1 i Stockholm',
        price: 1500,
        keywords: ['riskettan', 'risk 1'],
      },
    ]);

    const result = priceResolver.resolvePrice({
      city: 'Goteborg',
      serviceTerm: 'riskettan',
      chunkMap,
      globalFallback: {},
    });

    expect(result).toMatchObject({
      found: true,
      price: 800,
      source: 'city_fallback',
    });
    expect(result.matches).toHaveLength(2);
  });

  it('does not allow intro searches to match non-intro services', () => {
    const chunkMap = createChunkMap([
      {
        id: 'lund_risk',
        type: 'price',
        city: 'Lund',
        service_name: 'Risk 1',
        title: 'Risk 1 i Lund',
        price: 1200,
        keywords: ['introduktionskurs'],
      },
    ]);

    const result = priceResolver.resolvePrice({
      city: 'Lund',
      serviceTerm: 'introduktionskurs',
      chunkMap,
      globalFallback: {},
    });

    expect(result).toEqual({
      found: false,
      price: 0,
      source: 'not_found',
    });
  });

  it('falls back to the global price table when no city result exists', () => {
    const result = priceResolver.resolvePrice({
      city: 'Uppsala',
      serviceTerm: 'Handledarkurs',
      chunkMap: createChunkMap([]),
      globalFallback: {
        Handledarkurs: {
          price: 499,
          currency: 'SEK',
        },
      },
    });

    expect(result).toEqual({
      found: true,
      price: 499,
      currency: 'SEK',
      source: 'global_fallback',
    });
  });
});
