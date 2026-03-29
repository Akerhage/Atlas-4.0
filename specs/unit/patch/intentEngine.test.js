const { IntentEngine } = require('../../../patch/intentEngine.ts');

function createEngine() {
  return new IntentEngine(
    ['malmo', 'goteborg', 'lund'],
    { gbg: 'goteborg' },
    {
      BIL: ['bil', 'personbil'],
      MC: ['mc', 'motorcykel'],
      AM: ['moped', 'am-kort'],
    },
    { ullevi: 'goteborg' }
  );
}

describe('patch/intentEngine', () => {
  it('does not match cities inside larger words', () => {
    const engine = createEngine();

    expect(engine.extractCity('jag bor i fr\u00F6lunda', null)).toBeNull();
  });

  it('uses aliases when extracting the city', () => {
    const engine = createEngine();

    expect(engine.extractCity('vad kostar riskettan i gbg', null)).toBe('goteborg');
  });

  it('keeps LASTBIL from context when no other vehicle is mentioned', () => {
    const engine = createEngine();

    expect(engine.extractVehicle('hur fungerar utbildningen?', 'LASTBIL')).toBe('LASTBIL');
  });

  it('forces LASTBIL for YKB queries', () => {
    const engine = createEngine();

    expect(engine.extractVehicle('hur lang ar ykb grundutbildning?', null)).toBe('LASTBIL');
  });

  it('extracts price intent, city and service from a standard package question', () => {
    const engine = createEngine();

    expect(engine.parseIntent('Vad kostar totalpaket i Goteborg', {})).toMatchObject({
      intent: 'price_lookup',
      slots: {
        city: 'goteborg',
        service: 'Totalpaket',
      },
    });
  });

  it('lets an explicit city override the city inferred from an area', () => {
    const engine = createEngine();

    expect(engine.parseIntent('Jag vill boka MC vid Ullevi i Malmo', {})).toMatchObject({
      intent: 'booking',
      slots: {
        area: 'ullevi',
        city: 'malmo',
        vehicle: 'MC',
      },
    });
  });
});
