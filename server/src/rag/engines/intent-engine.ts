// ============================================
// Intent Engine — NLU for user query classification
// Ported from: patch/intentEngine.js
// ============================================

export interface IntentResult {
  intent: string;
  confidence: number;
  slots: {
    city: string | null;
    area: string | null;
    vehicle: string | null;
    service: string | null;
  };
}

const INTENT_PATTERNS: Record<string, { pattern: RegExp; intent: string; confidence: number }[]> = {
  weather: [{ pattern: /väder|vad är det för väder|temperatur/i, intent: 'weather', confidence: 0.95 }],
  testlesson: [{ pattern: /testlektion|provlektion|prova.?på/i, intent: 'testlesson_info', confidence: 0.92 }],
  risk: [{ pattern: /risk\s*[12]|riskettsan|riskettan|halkbana|risktvåan/i, intent: 'risk_info', confidence: 0.86 }],
  handledare: [{ pattern: /handledare|introduktionskurs|övningskör/i, intent: 'handledare_course', confidence: 0.82 }],
  legal: [{ pattern: /rattfylleri|spärrtid|körkortsåterkallelse|återkallat|prövotid/i, intent: 'legal_query', confidence: 0.82 }],
  policy: [{ pattern: /avbok|ånger|villkor|betalning|giltighet|avbeställ|sjuk/i, intent: 'policy', confidence: 0.85 }],
  contact: [{ pattern: /adress|telefon|mail|öppettider|kontakt|hitta/i, intent: 'contact_info', confidence: 0.8 }],
  tillstand: [{ pattern: /körkortstillstånd|tillstånd|ansök|syntest/i, intent: 'tillstand_info', confidence: 0.8 }],
  booking: [{ pattern: /boka|bokning|ledig tid|bokningslänk/i, intent: 'booking', confidence: 0.76 }],
  price: [{ pattern: /vad kostar|pris|hur mycket|kostar det|priset/i, intent: 'price_lookup', confidence: 0.75 }],
  discount: [{ pattern: /rabatt|erbjudande|kampanj|student/i, intent: 'discount', confidence: 0.7 }],
};

const VEHICLE_MAP: Record<string, string> = {
  bil: 'BIL', personbil: 'BIL', b: 'BIL', 'b-körkort': 'BIL',
  mc: 'MC', motorcykel: 'MC', 'a-körkort': 'MC', a1: 'MC', a2: 'MC',
  moped: 'AM', am: 'AM', 'eu-moped': 'AM',
  lastbil: 'LASTBIL', 'c-körkort': 'LASTBIL', c: 'LASTBIL', ce: 'LASTBIL',
  släp: 'SLÄP', be: 'SLÄP', b96: 'SLÄP', 'b-släp': 'SLÄP',
};

export class IntentEngine {
  private knownCities: Set<string>;
  private cityAliases: Map<string, string>;
  private areaToCity: Map<string, string>;

  constructor(
    knownCities: string[],
    cityAliases: Record<string, string>,
    areaToCity: Record<string, string>,
  ) {
    this.knownCities = new Set(knownCities.map(c => c.toLowerCase()));
    this.cityAliases = new Map(
      Object.entries(cityAliases).map(([k, v]) => [k.toLowerCase(), v]),
    );
    this.areaToCity = new Map(
      Object.entries(areaToCity).map(([k, v]) => [k.toLowerCase(), v]),
    );
  }

  parseIntent(rawQuery: string, context: Record<string, unknown> = {}): IntentResult {
    const query = rawQuery.toLowerCase().trim();
    const result: IntentResult = {
      intent: 'unknown',
      confidence: 0,
      slots: { city: null, area: null, vehicle: null, service: null },
    };

    // 1. Match intent patterns
    for (const category of Object.values(INTENT_PATTERNS)) {
      for (const { pattern, intent, confidence } of category) {
        if (pattern.test(query)) {
          if (confidence > result.confidence) {
            result.intent = intent;
            result.confidence = confidence;
          }
        }
      }
    }

    // 2. Extract area (triggers city)
    for (const [area, city] of this.areaToCity) {
      if (query.includes(area)) {
        result.slots.area = area.charAt(0).toUpperCase() + area.slice(1);
        result.slots.city = city;
        break;
      }
    }

    // 3. Extract city (aliases → real city)
    if (!result.slots.city) {
      for (const [alias, realCity] of this.cityAliases) {
        if (query.includes(alias)) {
          result.slots.city = realCity;
          break;
        }
      }
    }

    // 4. Direct city match
    if (!result.slots.city) {
      for (const city of this.knownCities) {
        if (query.includes(city)) {
          result.slots.city = city.charAt(0).toUpperCase() + city.slice(1);
          break;
        }
      }
    }

    // 5. Extract vehicle
    const words = query.split(/\s+/);
    for (const word of words) {
      const clean = word.replace(/[^a-zåäö0-9-]/gi, '').toLowerCase();
      if (VEHICLE_MAP[clean]) {
        result.slots.vehicle = VEHICLE_MAP[clean];
        break;
      }
    }

    // 6. If still unknown but has some info, set generic intent
    if (result.intent === 'unknown' && result.confidence === 0) {
      result.intent = 'intent_info';
      result.confidence = 0.65;
    }

    return result;
  }
}
