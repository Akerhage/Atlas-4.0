const ForceAddEngine = require('../../../patch/forceAddEngine.ts');

describe('patch/forceAddEngine', () => {
  it('filters out zero-price chunks and keeps unique chunk ids across calls', () => {
    const engine = new ForceAddEngine([]);

    const added = engine.addChunks(
      [
        { id: 'valid', type: 'price', price: 799, text: 'Risk 1: 799 kr' },
        { id: 'zero-price', type: 'price', price: 0, text: 'Risk 1: 0 kr' },
        { id: 'zero-text', type: 'price', price: 799, text: 'Risk 1: 0 kr' },
      ],
      9000
    );

    const addedAgain = engine.addChunks(
      [{ id: 'valid', type: 'price', price: 799, text: 'Duplicate id' }],
      9000
    );

    expect(added).toBe(1);
    expect(addedAgain).toBe(0);
    expect(engine.mustAddChunks).toHaveLength(1);
    expect(engine.mustAddChunks[0].id).toBe('valid');
  });

  it('prepends locked-city driving lesson price chunks with highest priority', () => {
    const engine = new ForceAddEngine([
      { id: 'risk', type: 'price', city: 'malmo', service_name: 'Risk 1', price: 799 },
      { id: 'lesson', type: 'price', city: 'malmo', service_name: 'K\u00F6rlektion Bil', price: 1149, text: 'K\u00F6rlektion Bil 1149 kr' },
    ]);

    engine.addChunks([{ id: 'risk', type: 'price', city: 'malmo', service_name: 'Risk 1', price: 799 }], 5000);
    const added = engine.rule_A4_LockedCityGenericPrice('vad kostar lektion', 'price_lookup', {}, 'malmo');

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({
      id: 'lesson',
      score: 10000,
      forced: true,
    });
  });

  it('injects AM chunks when the vehicle slot is locked to AM', () => {
    const engine = new ForceAddEngine([
      { id: 'am-course', type: 'basfakta', source: 'basfakta_am_kort_och_kurser.json', title: 'AM-kurs' },
    ]);

    const added = engine.rule_A1_AM('hej', 'intent_info', { vehicle: 'AM' });

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'am-course', score: engine.scores.a1_am });
  });

  it('does not inject policy chunks for pure tillstand questions without policy words', () => {
    const engine = new ForceAddEngine([
      { id: 'policy', type: 'basfakta', source: 'basfakta_policy_kundavtal.json' },
    ]);

    expect(engine.rule_B1_Policy('hur lang ar handlaggningstiden for korkortstillstand?', 'tillstand_info', {})).toBe(0);
    expect(engine.mustAddChunks).toHaveLength(0);
  });

  it('injects policy chunks with high confidence for avbokning questions', () => {
    const engine = new ForceAddEngine([
      { id: 'policy', type: 'basfakta', source: 'basfakta_policy_kundavtal.json' },
    ]);

    const added = engine.rule_B1_Policy('vad g\u00E4ller vid avbokning av k\u00F6rlektion?', 'policy', {});

    expect(added).toBe(1);
    expect(engine.forceHighConfidence).toBe(true);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'policy', score: engine.scores.b1_policy });
  });

  it('uses lower finance fallback scores when the intent is not payment-related', () => {
    const engine = new ForceAddEngine([
      { id: 'company', type: 'basfakta', source: 'basfakta_om_foretaget.json', title: 'Om foretaget' },
    ]);

    const added = engine.rule_B2_Finance('kan jag betala med swish?', 'smalltalk', {});

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'company', score: 3000 });
  });

  it('injects provotid facts together with general tillstand chunks', () => {
    const engine = new ForceAddEngine([
      { id: 'provtid', type: 'basfakta', source: 'basfakta_12_stegsguide_bil.json', keywords: ['pr\u00F6votid'], title: 'Pr\u00F6votid' },
      { id: 'tillstand', type: 'basfakta', source: 'basfakta_korkortstillstand.json', title: 'Tillstand' },
    ]);

    const added = engine.rule_B4_KortTillstand('vad g\u00E4ller pr\u00F6votid f\u00F6r k\u00F6rkortstillst\u00E5nd?', 'tillstand_info', {});

    expect(added).toBe(1);
    expect(engine.mustAddChunks).toEqual([
      expect.objectContaining({ id: 'provtid', score: 10000 }),
      expect.objectContaining({ id: 'tillstand', score: 7000 }),
    ]);
  });

  it('marks the exact 24 months fact for package validity questions', () => {
    const chunk = {
      id: 'validity',
      type: 'basfakta',
      source: 'basfakta_policy_kundavtal.json',
      title: 'Paket giltighet',
      text: 'Alla paket g\u00E4ller i 24 m\u00E5nader fr\u00E5n k\u00F6pdatum.',
    };
    const engine = new ForceAddEngine([chunk]);

    const added = engine.rule_B5_SpecificFact('paket giltighet', 'policy', {});

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0].text).toContain('<EXACT_FACT>24 m\u00E5nader</EXACT_FACT>');
  });

  it('injects specific Risk 1 chunks with high confidence', () => {
    const engine = new ForceAddEngine([
      { id: 'risk1', type: 'basfakta', source: 'basfakta_riskutbildning_bil_mc.json', title: 'Risk 1 Bil' },
      { id: 'risk2', type: 'basfakta', source: 'basfakta_riskutbildning_bil_mc.json', title: 'Risk 2 Bil' },
    ]);

    const added = engine.rule_C1a_Risk1('vad ar riskettan?', 'risk_info', {});

    expect(added).toBe(1);
    expect(engine.forceHighConfidence).toBe(true);
    expect(engine.mustAddChunks[0].id).toBe('risk1');
  });

  it('injects specific Risk 2 chunks with high confidence', () => {
    const engine = new ForceAddEngine([
      { id: 'risk1', type: 'basfakta', source: 'basfakta_riskutbildning_bil_mc.json', title: 'Risk 1 Bil' },
      { id: 'risk2', type: 'basfakta', source: 'basfakta_riskutbildning_bil_mc.json', title: 'Risktv\u00E5an / Halkbanan' },
    ]);

    const added = engine.rule_C1b_Risk2('vad ingar i halkbana risk 2?', 'risk_info', {});

    expect(added).toBe(1);
    expect(engine.forceHighConfidence).toBe(true);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'risk2', score: 9000 });
  });

  it('injects generic risk chunks only when no specific risk keyword is present', () => {
    const engine = new ForceAddEngine([
      { id: 'risk-generic', type: 'basfakta', source: 'basfakta_riskutbildning_bil_mc.json', title: 'Riskutbildning' },
    ]);

    expect(engine.rule_C1c_RiskGeneric('riskutbildning', 'risk_course', {})).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'risk-generic', score: 6500 });
  });

  it('injects MC behorighet facts with very high confidence', () => {
    const engine = new ForceAddEngine([
      { id: 'mc-license', type: 'basfakta', source: 'basfakta_mc_a_a1_a2.json', title: 'A1 och A2' },
    ]);

    const added = engine.rule_C2_MC_Behorighet('vad galler for a1 125cc?', 'intent_info', { vehicle: null });

    expect(added).toBe(1);
    expect(engine.forceHighConfidence).toBe(true);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'mc-license', score: 85000 });
  });

  it('uses the lower package score for bil facts when only the vehicle slot is known', () => {
    const engine = new ForceAddEngine([
      { id: 'bil-package', type: 'basfakta', source: 'basfakta_lektioner_paket_bil.json', title: 'Bilpaket' },
    ]);

    const added = engine.rule_C4_Paket_Bil('beratta mer om utbildningen', 'intent_info', { vehicle: 'BIL' });

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'bil-package', score: 4000 });
  });

  it('prepends seasonal MC chunks ahead of standard package chunks', () => {
    const engine = new ForceAddEngine([
      { id: 'mc-package', type: 'basfakta', source: 'basfakta_lektioner_paket_mc.json', title: 'MC-paket' },
      { id: 'mc-season', type: 'basfakta', source: 'basfakta_mc_lektioner_utbildning.json', title: 'MC-sasong' },
    ]);

    const added = engine.rule_C5_Paket_MC('mc paket vinter', 'booking', { vehicle: null });

    expect(added).toBe(2);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'mc-season', score: 9200 });
    expect(engine.mustAddChunks[1]).toMatchObject({ id: 'mc-package', score: 8500 });
  });

  it('skips heavy-vehicle chunk injection for payment questions', () => {
    const engine = new ForceAddEngine([
      { id: 'truck', type: 'basfakta', source: 'basfakta_lastbil_c_ce_c1_c1e.json', title: 'Lastbil' },
    ]);

    const added = engine.rule_C6_TungaFordon('kan jag betala med klarna for lastbil?', 'policy', { vehicle: 'LASTBIL' });

    expect(added).toBe(0);
    expect(engine.mustAddChunks).toHaveLength(0);
  });

  it('prioritizes theory app chunks above other low-priority context', () => {
    const engine = new ForceAddEngine([
      { id: 'theory-app', type: 'basfakta', source: 'basfakta_korkortsteori_mitt_korkort.json', title: 'Mitt Kortkort' },
    ]);

    const added = engine.rule_C7_TeoriAppen('hur fungerar appen mittkorkort?', 'intent_info', {});

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'theory-app', score: engine.scores.c7_teori });
  });

  it('injects office info with very high priority for contact questions in a known city', () => {
    const engine = new ForceAddEngine([
      { id: 'office-1', type: 'office_info', city: 'malmo', title: 'Malmo kontor' },
      { id: 'company', type: 'basfakta', source: 'basfakta_om_foretaget.json', title: 'Om foretaget' },
    ]);

    const added = engine.rule_C8_Kontakt('vad ar adressen i malmo?', 'contact_info', { city: 'malmo' }, null);

    expect(added).toBe(2);
    expect(engine.forceHighConfidence).toBe(true);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'office-1', score: 60000, forced: true });
  });

  it('injects bil facts for automat and manuell questions', () => {
    const engine = new ForceAddEngine([
      { id: 'car-facts', type: 'basfakta', source: 'basfakta_personbil_b.json', title: 'Automat och manuell' },
    ]);

    const added = engine.rule_C9_BilFakta('kan jag ta korkort for automat?', 'intent_info', {});

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'car-facts', score: 85000 });
  });

  it('removes policy chunks when tillstand validity should win', () => {
    const engine = new ForceAddEngine([
      { id: 'policy', type: 'basfakta', source: 'basfakta_policy_kundavtal.json', title: 'Paket giltighet' },
      { id: 'permit', type: 'basfakta', source: 'basfakta_korkortstillstand.json', title: 'Korkortstillstand' },
    ]);

    engine.addChunks([{ id: 'policy', type: 'basfakta', source: 'basfakta_policy_kundavtal.json', title: 'Paket giltighet' }], 1000);
    const added = engine.rule_Fix_Giltighet('hur lange ar korkortstillstand giltigt och kan jag forlanga det?', 'tillstand_info');

    expect(added).toBe(1);
    expect(engine.mustAddChunks.some((chunk) => String(chunk.source).includes('policy_kundavtal'))).toBe(false);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'permit', score: 30000 });
  });

  it('injects slape chunks for BE and B96 questions', () => {
    const engine = new ForceAddEngine([
      { id: 'slap', type: 'basfakta', source: 'basfakta_be_b96.json', title: 'BE och B96' },
    ]);

    const added = engine.rule_Fix_TungTrafik('vad galler for be-kort och slap over 750 kg?');

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'slap', score: 11000 });
  });

  it('adds extra MC place and test-lesson facts when the question asks for both', () => {
    const engine = new ForceAddEngine([
      { id: 'mc-places', type: 'basfakta', source: 'basfakta_mc_a_a1_a2.json', title: 'MC-orter' },
      { id: 'mc-test', type: 'basfakta', source: 'basfakta_mc_lektioner_utbildning.json', title: 'MC-testlektion' },
    ]);

    const added = engine.rule_Fix_MC_Extra('var erbjuder ni mc testlektion i olika orter?');

    expect(added).toBe(2);
    expect(engine.mustAddChunks.map(({ id }) => id)).toEqual(['mc-test', 'mc-places']);
  });

  it('injects missing-answer guidance with high confidence for unknown questions', () => {
    const engine = new ForceAddEngine([
      { id: 'fallback', type: 'basfakta', source: 'basfakta_saknade_svar.json', title: 'Saknade svar' },
    ]);

    const added = engine.rule_Fix_SaknadeSvar('detta forstar jag inte', 'unknown');

    expect(added).toBe(1);
    expect(engine.forceHighConfidence).toBe(true);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'fallback', score: engine.scores.fix_saknade });
  });

  it('injects identity fallback chunks for greeting-style meta questions', () => {
    const engine = new ForceAddEngine([
      { id: 'identity', type: 'basfakta', source: 'basfakta_nollutrymme.json', title: 'Vem ar Atlas' },
    ]);

    const added = engine.rule_Fix_Nollutrymme('hej', 'greeting');

    expect(added).toBe(1);
    expect(engine.forceHighConfidence).toBe(true);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'identity', score: 11000 });
  });

  it('injects personbil age facts for B-korkort requirement questions', () => {
    const engine = new ForceAddEngine([
      { id: 'personbil', type: 'basfakta', source: 'basfakta_personbil_b.json', title: 'Personbil B' },
    ]);

    const added = engine.rule_Fix_PersonbilInfo('hur gammal maste man vara for b-korkort och ovningskora bil?', 'service_inquiry', null);

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'personbil', score: 8500 });
  });

  it('prioritizes YKB and lastbil knowledge above price-like context', () => {
    const engine = new ForceAddEngine([
      { id: 'truck-ykb', type: 'basfakta', source: 'basfakta_lastbil_c_ce_c1_c1e.json', title: 'YKB och lastbil' },
    ]);

    const added = engine.rule_Fix_Lastbil_YKB('hur lang tid tar ykb fortbildning 35 tim?', 'intent_info');

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'truck-ykb', score: 18000 });
  });

  it('chooses vehicle-specific utbildningstid chunks based on the query', () => {
    const engine = new ForceAddEngine([
      { id: 'mc-time', type: 'basfakta', source: 'basfakta_mc_lektioner_utbildning.json', title: 'MC-utbildningstid' },
      { id: 'bil-time', type: 'basfakta', source: 'basfakta_lektioner_paket_bil.json', title: 'Bil-utbildningstid' },
    ]);

    const added = engine.rule_Fix_Utbildningstid('hur lang tid tar mc utbildning?', 'intent_info', { vehicle: null });

    expect(added).toBe(1);
    expect(engine.mustAddChunks[0]).toMatchObject({ id: 'mc-time', score: 17000 });
  });

  it('combines bil and MC utbildningskontroll chunks when the query mentions mc', () => {
    const engine = new ForceAddEngine([
      { id: 'bil-check', type: 'basfakta', source: 'basfakta_lektioner_paket_bil.json', title: 'Utbildningskontroll bil' },
      { id: 'mc-check', type: 'basfakta', source: 'basfakta_mc_lektioner_utbildning.json', title: 'Utbildningskontroll mc' },
    ]);

    const added = engine.rule_Fix_Utbildningskontroll('steg 8 utbildningskontroll mc', 'booking');

    expect(added).toBe(2);
    expect(engine.mustAddChunks.map(({ id }) => id)).toEqual(['mc-check', 'bil-check']);
  });

  it('returns an empty forced context for weather intents even if support keywords exist', () => {
    const engine = new ForceAddEngine([
      { id: 'company', type: 'basfakta', source: 'basfakta_om_foretaget.json', title: 'Om foretaget' },
    ]);

    const result = engine.execute('support vad blir vadret idag', { intent: 'weather', slots: { vehicle: null, city: null } }, null);

    expect(result).toEqual({ mustAddChunks: [], forceHighConfidence: false });
  });

  it('forces legal-query permit context with handledare support chunks', () => {
    const engine = new ForceAddEngine([
      { id: 'permit', type: 'basfakta', source: 'basfakta_korkortstillstand.json', title: 'Tillstand' },
      { id: 'handledare', type: 'basfakta', source: 'basfakta_introduktionskurs_handledarkurs_bil.json', title: 'Handledare' },
    ]);

    const result = engine.execute('vad galler vid aterkallelse och handledare?', { intent: 'legal_query', slots: { vehicle: null, city: null } }, null);

    expect(result.forceHighConfidence).toBe(true);
    expect(result.mustAddChunks[0]).toMatchObject({ id: 'permit', score: 15000 });
    expect(result.mustAddChunks.some((chunk) => chunk.id === 'handledare')).toBe(true);
  });
});


