import { ForceAddEngine } from '../../src/rag/engines/force-add-engine';
import type { KnowledgeChunk } from '../../src/rag/utils/price-resolver';
import type { IntentResult } from '../../src/rag/engines/intent-engine';

function makeChunk(id: string, source: string, type: 'basfakta' | 'price' | 'kontor_info' = 'basfakta', extra: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return { id, title: id, text: 'content', type, source, keywords: [], ...extra };
}

function makeIntent(intent: string, vehicle: string | null = null): IntentResult {
  return { intent, confidence: 0.8, slots: { city: null, area: null, vehicle, service: null } };
}

describe('ForceAddEngine', () => {
  const chunks = [
    makeChunk('am-1', 'basfakta_am_kort_och_kurser.json'),
    makeChunk('am-2', 'basfakta_am_kort_och_kurser.json'),
    makeChunk('pol-1', 'basfakta_policy_kundavtal.json'),
    makeChunk('pol-2', 'basfakta_policy_kundavtal.json'),
    makeChunk('mc-1', 'basfakta_mc_lektioner_utbildning.json'),
    makeChunk('mc-2', 'basfakta_mc_a_a1_a2.json'),
    makeChunk('risk-1', 'basfakta_riskutbildning.json'),
    makeChunk('teori-1', 'basfakta_korkortsteori_mitt_korkort.json'),
    makeChunk('bil-1', 'basfakta_personbil_b.json'),
    makeChunk('steg-1', 'basfakta_12_stegsguide.json'),
    makeChunk('till-1', 'basfakta_korkortstillstand.json'),
    makeChunk('foretag-1', 'basfakta_om_foretaget.json'),
    makeChunk('noll-1', 'basfakta_nollutrymme.json'),
    makeChunk('lastbil-1', 'basfakta_lastbil_c_ce_c1_c1e.json'),
    makeChunk('pkt-bil-1', 'basfakta_lektioner_paket_bil.json'),
    makeChunk('office-1', 'goteborg_ullevi.json', 'kontor_info', { city: 'Göteborg' }),
  ];

  let engine: ForceAddEngine;

  beforeEach(() => {
    engine = new ForceAddEngine(chunks);
  });

  it('injects AM chunks for moped queries', () => {
    const result = engine.execute('vad kostar am kort?', makeIntent('price_lookup'), null);
    expect(result.mustAddChunks.some(c => c.source.includes('am_kort'))).toBe(true);
    expect(result.forceHighConfidence).toBe(true);
  });

  it('injects policy chunks for avbokning queries', () => {
    const result = engine.execute('kan jag avboka min lektion?', makeIntent('policy'), null);
    expect(result.mustAddChunks.some(c => c.source.includes('policy_kundavtal'))).toBe(true);
    expect(result.forceHighConfidence).toBe(true);
  });

  it('injects MC chunks for motorcykel queries', () => {
    const result = engine.execute('mc körkort pris', makeIntent('price_lookup', 'MC'), null);
    expect(result.mustAddChunks.some(c => c.source.includes('mc'))).toBe(true);
  });

  it('injects risk chunks for risk 1 queries', () => {
    const result = engine.execute('vad är risk 1?', makeIntent('risk_info'), null);
    expect(result.mustAddChunks.some(c => c.source.includes('riskutbildning'))).toBe(true);
  });

  it('injects teori-appen chunks for app queries', () => {
    const result = engine.execute('vad är mitt körkort appen?', makeIntent('intent_info'), null);
    expect(result.mustAddChunks.some(c => c.source.includes('korkortsteori'))).toBe(true);
    expect(result.forceHighConfidence).toBe(true);
  });

  it('injects contact + office chunks for contact queries', () => {
    const result = engine.execute('vad är er adress?', makeIntent('contact_info'), 'Göteborg');
    expect(result.mustAddChunks.some(c => c.source.includes('om_foretaget'))).toBe(true);
    expect(result.mustAddChunks.some(c => c.type === 'kontor_info')).toBe(true);
  });

  it('injects automat chunks for automat queries', () => {
    const result = engine.execute('kan jag köra automat?', makeIntent('intent_info'), null);
    expect(result.mustAddChunks.some(c => c.source.includes('personbil_b'))).toBe(true);
    expect(result.forceHighConfidence).toBe(true);
  });

  it('injects giltighet chunks for validity queries', () => {
    const result = engine.execute('hur länge gäller mitt paket?', makeIntent('policy'), null);
    expect(result.mustAddChunks.some(c => c.source.includes('policy') || c.source.includes('korkortstillstand'))).toBe(true);
    expect(result.forceHighConfidence).toBe(true);
  });

  it('does not duplicate chunks', () => {
    const result = engine.execute('avbokning sjuk policy villkor', makeIntent('policy'), null);
    const ids = result.mustAddChunks.map(c => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('returns empty for unrelated queries', () => {
    const result = engine.execute('vad är 2+2?', makeIntent('unknown'), null);
    expect(result.mustAddChunks.length).toBe(0);
    expect(result.forceHighConfidence).toBe(false);
  });
});
