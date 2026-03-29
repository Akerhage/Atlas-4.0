import { resolveCity, resolveVehicle, resolveArea, resolveContext } from '../../src/rag/utils/context-lock';

describe('Context Lock', () => {
  describe('resolveCity', () => {
    it('explicit city wins over saved', () => {
      expect(resolveCity('Göteborg', 'Stockholm')).toBe('Stockholm');
    });

    it('returns saved when no explicit', () => {
      expect(resolveCity('Göteborg', null)).toBe('Göteborg');
    });

    it('returns null when neither exists', () => {
      expect(resolveCity(null, null)).toBeNull();
    });

    it('returns explicit even when saved is null', () => {
      expect(resolveCity(null, 'Malmö')).toBe('Malmö');
    });
  });

  describe('resolveVehicle', () => {
    it('explicit vehicle wins over saved', () => {
      expect(resolveVehicle('BIL', 'MC')).toBe('MC');
    });

    it('returns saved when no explicit', () => {
      expect(resolveVehicle('MC', null)).toBe('MC');
    });
  });

  describe('resolveArea', () => {
    it('explicit area wins', () => {
      expect(resolveArea('Ullevi', 'Högsbo', false)).toBe('Högsbo');
    });

    it('clears area when city changed', () => {
      expect(resolveArea('Ullevi', null, true)).toBeNull();
    });

    it('keeps saved area when city unchanged', () => {
      expect(resolveArea('Ullevi', null, false)).toBe('Ullevi');
    });
  });

  describe('resolveContext', () => {
    it('resolves all slots together', () => {
      const result = resolveContext(
        { city: 'Göteborg', area: 'Ullevi', vehicle: 'BIL' },
        { city: 'Stockholm', area: null, vehicle: null },
      );

      expect(result.city).toBe('Stockholm');
      expect(result.area).toBeNull(); // area cleared because city changed
      expect(result.vehicle).toBe('BIL'); // vehicle preserved
    });

    it('preserves all slots when no explicit values', () => {
      const result = resolveContext(
        { city: 'Malmö', area: 'City', vehicle: 'MC' },
        {},
      );

      expect(result).toEqual({ city: 'Malmö', area: 'City', vehicle: 'MC' });
    });

    it('handles all null', () => {
      const result = resolveContext(
        { city: null, area: null, vehicle: null },
        {},
      );

      expect(result).toEqual({ city: null, area: null, vehicle: null });
    });

    it('sets area from explicit even on city change', () => {
      const result = resolveContext(
        { city: 'Göteborg', area: 'Ullevi', vehicle: null },
        { city: 'Stockholm', area: 'Kungsholmen' },
      );

      expect(result.city).toBe('Stockholm');
      expect(result.area).toBe('Kungsholmen'); // explicit wins even with city change
    });
  });
});
