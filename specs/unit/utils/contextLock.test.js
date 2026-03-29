const contextLock = require('../../../utils/contextLock.ts');

describe('utils/contextLock', () => {
  it('prefers explicit city and vehicle over saved values', () => {
    expect(
      contextLock.resolveContext(
        { savedCity: 'Malmo', savedArea: 'Vastra Hamnen', savedVehicle: 'BIL' },
        { explicitCity: 'Goteborg', explicitArea: null, explicitVehicle: 'MC' }
      )
    ).toEqual({
      city: 'Goteborg',
      area: null,
      vehicle: 'MC',
    });
  });

  it('clears saved area when the explicit city changes', () => {
    expect(
      contextLock.resolveContext(
        { savedCity: 'Goteborg', savedArea: 'Ullevi', savedVehicle: 'BIL' },
        { explicitCity: 'Malmo', explicitArea: null, explicitVehicle: null }
      )
    ).toEqual({
      city: 'Malmo',
      area: null,
      vehicle: 'BIL',
    });
  });

  it('keeps the saved area when the city remains the same', () => {
    expect(
      contextLock.resolveContext(
        { savedCity: 'Goteborg', savedArea: 'Ullevi', savedVehicle: 'BIL' },
        { explicitCity: 'goteborg', explicitArea: null, explicitVehicle: null }
      )
    ).toEqual({
      city: 'goteborg',
      area: 'Ullevi',
      vehicle: 'BIL',
    });
  });

  it('prefers an explicit area even when the city changed', () => {
    expect(
      contextLock.resolveContext(
        { savedCity: 'Goteborg', savedArea: 'Ullevi', savedVehicle: 'BIL' },
        { explicitCity: 'Malmo', explicitArea: 'Triangeln', explicitVehicle: null }
      )
    ).toEqual({
      city: 'Malmo',
      area: 'Triangeln',
      vehicle: 'BIL',
    });
  });
});
