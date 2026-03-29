import { IntentEngine } from '../../src/rag/engines/intent-engine';

describe('IntentEngine', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine(
      ['Stockholm', 'Göteborg', 'Malmö'],
      { 'gbg': 'Göteborg', 'sthlm': 'Stockholm' },
      { 'ullevi': 'Göteborg', 'högsbo': 'Göteborg', 'city': 'Stockholm' },
    );
  });

  describe('intent detection', () => {
    it('detects price intent', () => {
      const result = engine.parseIntent('Vad kostar en körlektion?');
      expect(result.intent).toBe('price_lookup');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('detects booking intent', () => {
      const result = engine.parseIntent('Jag vill boka en lektion');
      expect(result.intent).toBe('booking');
    });

    it('detects policy intent', () => {
      const result = engine.parseIntent('Vad gäller vid avbokning?');
      expect(result.intent).toBe('policy');
    });

    it('detects risk info intent', () => {
      const result = engine.parseIntent('Vad är risk 1?');
      expect(result.intent).toBe('risk_info');
    });

    it('detects contact intent', () => {
      const result = engine.parseIntent('Vad är er adress?');
      expect(result.intent).toBe('contact_info');
    });

    it('detects weather intent', () => {
      const result = engine.parseIntent('Vad är det för väder idag?');
      expect(result.intent).toBe('weather');
      expect(result.confidence).toBe(0.95);
    });

    it('detects testlektion intent', () => {
      const result = engine.parseIntent('Erbjuder ni testlektion?');
      expect(result.intent).toBe('testlesson_info');
    });

    it('returns generic intent for unknown queries', () => {
      const result = engine.parseIntent('hej');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('city extraction', () => {
    it('extracts direct city name', () => {
      const result = engine.parseIntent('Vad kostar det i Stockholm?');
      expect(result.slots.city).toBe('Stockholm');
    });

    it('resolves city alias', () => {
      const result = engine.parseIntent('Pris i gbg?');
      expect(result.slots.city).toBe('Göteborg');
    });

    it('returns null when no city mentioned', () => {
      const result = engine.parseIntent('Vad kostar en körlektion?');
      expect(result.slots.city).toBeNull();
    });
  });

  describe('area extraction', () => {
    it('extracts area and resolves city from it', () => {
      const result = engine.parseIntent('Körlektion Ullevi');
      expect(result.slots.area).toBeTruthy();
      expect(result.slots.city).toBe('Göteborg');
    });
  });

  describe('vehicle extraction', () => {
    it('extracts bil', () => {
      const result = engine.parseIntent('Körlektion bil');
      expect(result.slots.vehicle).toBe('BIL');
    });

    it('extracts mc', () => {
      const result = engine.parseIntent('mc körkort pris');
      expect(result.slots.vehicle).toBe('MC');
    });

    it('extracts am/moped', () => {
      const result = engine.parseIntent('Vad kostar moped?');
      expect(result.slots.vehicle).toBe('AM');
    });

    it('extracts lastbil', () => {
      const result = engine.parseIntent('C-körkort utbildning');
      expect(result.slots.vehicle).toBe('LASTBIL');
    });

    it('returns null when no vehicle', () => {
      const result = engine.parseIntent('Vad kostar det?');
      expect(result.slots.vehicle).toBeNull();
    });
  });
});
