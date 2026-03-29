const INTENT_PATTERNS: Record<string, RegExp> = {
  price: /(vad kostar|pris|hur mycket|kostar det|pris för|vad tar ni|pris på|prislista|finns pris)/i,
  discount: /(rabatt|erbjudande|rea|kampanj|studentrabatt|rabatter)/i,
  booking: /(boka|bokning|bokar|ledig tid|bokningslänk|bokningssida|hur bokar)/i,
  policy: /(avboka|ånger|återbetalning|avbokning|vab|villkor|ångerrätt|avbokningsregler|policy|kundavtal|faktura\s?(adress|till)|vart\s?skicka|skicka\s?till|betala|betalning|betalningssätt|betalningsalternativ|giltighet)/i,
  risk: /\b(risk ?1|riskettan|risk ?2|risktvåan|halkbana)\b/i,
  intent_info: /(vad är|beskriv|förklara|vad innebär|definition|hur fungerar)/i,
  testlesson: /(testlektion|provlektion|prova[-\s]?på|prova[-\s]?på-?uppkörning|prov-?lektion|vad kostar(?:.*\s)?testlek(?:tion)?|kostar.*testlek(?:tion)?)/i,
  handledare: /(handledare|introduktionskurs|introkurs|handledarkurs)/i,
  tillstand: /(körkortstillstånd|tillstånd|körkortstillståndet|körkortstillståndet)/i,
  contact: /(adress|hitta|ligger|karta|telefon|telefonnummer|nummer|numret|kontakt|mail|öppettider|vart|språk)/i,
  weather: /\b(väder|vad är det för väder|temperatur|hur varmt|regn|snö|sol)\b/i,
  ykb: /\b(ykb|grundutbildning|fortbildning|140 timmar|35 timmar)\b/i,
  age_limit: /\b(ålder|gammal|fyllt|när får man)\b/i,
  legal_query: /(rattfylleri|spärrtid|promille|körkortsåterkallelse|återkallelse|nollning|körkortet dras in|förlora körkortet|förlorar körkortet|körkort dras in|körkort tas in)/i,
};

type ServiceKeywordEntry = {
  term: string;
  kws: string[];
};

const SERVICE_KEYWORD_MAP: ServiceKeywordEntry[] = [
  { term: 'Körlektion BIL', kws: ['körlektion bil', 'lektion bil'] },
  { term: 'Testlektion Bil', kws: ['testlektion', 'provlektion'] },
  { term: 'Risk 1', kws: ['riskettan', 'risk 1'] },
  { term: 'Risk 2', kws: ['risktvåan', 'risk 2', 'halkbana'] },
  { term: 'AM Mopedutbildning', kws: ['am-kurs', 'am kurs', 'mopedutbildning', 'moppekort'] },
  { term: 'Introduktionskurs', kws: ['introduktionskurs', 'handledarkurs'] },
  { term: 'Totalpaket', kws: ['totalpaket'] },
  { term: 'Intensivkurs', kws: ['intensiv', 'intensivutbildning', 'intensivvecka'] },
];

type ParsedSlots = {
  city: string | null;
  area: string | null;
  vehicle: string | null;
  service: string | null;
};

type ContextSlots = Partial<ParsedSlots>;
type VehicleMap = Record<string, string[]>;
type AreaMap = Record<string, string>;

function escapeRegex(value: string): string {
  return (value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class IntentEngine {
  private knownCities: string[];
  private cityAliases: Record<string, string>;
  private vehicleMap: VehicleMap;
  private areas: AreaMap;
  private defaultConfidence: number;

  constructor(knownCities: string[] = [], cityAliases: Record<string, string> = {}, vehicleMap: VehicleMap = {}, areas: AreaMap = {}) {
    this.knownCities = knownCities.map((city) => city.toLowerCase());
    this.cityAliases = this.flattenAliases(cityAliases);
    this.vehicleMap = vehicleMap;
    this.areas = areas || {};
    this.defaultConfidence = 0.2;
    console.log(`[IntentEngine] Initierad med ${this.knownCities.length} städer och ${Object.keys(this.areas).length} områden.`);
  }

  private flattenAliases(aliases: Record<string, string>): Record<string, string> {
    const flatMap: Record<string, string> = {};
    for (const [alias, city] of Object.entries(aliases || {})) {
      flatMap[this.norm(alias)] = this.norm(city);
    }
    return flatMap;
  }

  private norm(value: string | null | undefined): string {
    return (value || '')
      .toString()
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^\wåäö\s-]/g, '')
      .replace(/\s+/g, ' ');
  }

  extractCity(queryLower: string, currentContextCity: string | null): string | null {
    const query = (queryLower || '').toLowerCase();

    for (const [alias, city] of Object.entries(this.cityAliases)) {
      const aliasNorm = alias.toLowerCase();
      const pattern = new RegExp(`(?:^|[\\s,.-])${escapeRegex(aliasNorm)}(?:$|[\\s,.-])`, 'i');
      if (pattern.test(query)) {
        return city;
      }
    }

    for (const city of this.knownCities) {
      const normalizedCity = city.toLowerCase();
      const pattern = new RegExp(`(?:^|[\\s,.-])${escapeRegex(normalizedCity)}(?:$|[\\s,.-])`, 'i');
      if (pattern.test(query)) {
        return city;
      }
    }

    return currentContextCity || null;
  }

  extractVehicle(queryLower: string, vehicle: string | null): string | null {
    if (/\b(ykb|grundutbildning|fortbildning|140 timmar|35 timmar)\b/i.test(queryLower)) {
      return 'LASTBIL';
    }

    const isHeavyVehicleQuery = /\b(lastbil|c-körkort|ce-körkort|c1-körkort|c1e|tung trafik|lastbilsutbildning|lastbilskörkort|tungt fordon)\b/i.test(queryLower);
    if (isHeavyVehicleQuery) {
      return 'LASTBIL';
    }

    if (vehicle === 'LASTBIL') {
      const explicitOtherVehicle = /\b(mc-körkort|motorcykel|moped|am-körkort|personbil)\b/i.test(queryLower);
      if (!explicitOtherVehicle) {
        return 'LASTBIL';
      }
    }

    for (const [key, keywords] of Object.entries(this.vehicleMap)) {
      for (const keyword of keywords) {
        const cleanKeyword = this.norm(keyword);
        const pattern = new RegExp(`\\b${escapeRegex(cleanKeyword)}\\b`, 'i');
        if (pattern.test(queryLower)) {
          return key;
        }
      }
    }

    if (vehicle) {
      return vehicle.toUpperCase();
    }

    return null;
  }

  private extractService(queryLower: string): string | null {
    for (const entry of SERVICE_KEYWORD_MAP) {
      for (const keyword of entry.kws) {
        const cleanKeyword = this.norm(keyword);
        const pattern = new RegExp(`\\b${escapeRegex(cleanKeyword)}\\b`, 'i');
        if (pattern.test(queryLower)) {
          return entry.term;
        }
      }
    }
    return null;
  }

  parseIntent(rawQuery: string, context: ContextSlots = {}): { intent: string; confidence: number; slots: ParsedSlots } {
    const query = this.norm(rawQuery || '');
    const slots: ParsedSlots = {
      city: null,
      area: null,
      vehicle: null,
      service: null,
    };

    for (const [areaName, cityName] of Object.entries(this.areas)) {
      const areaRegex = new RegExp(`\\b${escapeRegex(this.norm(areaName))}\\b`, 'i');
      if (areaRegex.test(query)) {
        slots.area = areaName;
        slots.city = cityName;
        break;
      }
    }

    if (slots.area && slots.city) {
      const explicitCity = this.extractCity(query, null);
      if (explicitCity && explicitCity.toLowerCase() !== slots.city.toLowerCase()) {
        slots.city = explicitCity;
      }
    }

    if (!slots.city) {
      slots.city = this.extractCity(query, context.city || null);
    }

    slots.vehicle = this.extractVehicle(query, context.vehicle || null);
    slots.service = this.extractService(query);

    let intent = 'unknown';
    let confidence = this.defaultConfidence;

    if (INTENT_PATTERNS.weather.test(query)) {
      intent = 'weather';
      confidence = 0.95;
    } else if (INTENT_PATTERNS.testlesson.test(query)) {
      intent = 'testlesson_info';
      confidence = 0.92;
    } else if (INTENT_PATTERNS.risk.test(query)) {
      intent = 'risk_info';
      confidence = 0.86;
    } else if (INTENT_PATTERNS.handledare.test(query)) {
      intent = 'handledare_course';
      confidence = 0.82;
    } else if (INTENT_PATTERNS.tillstand.test(query)) {
      intent = 'tillstand_info';
      confidence = 0.8;
    } else if (INTENT_PATTERNS.policy.test(query)) {
      intent = 'policy';
      confidence = 0.85;
    } else if (INTENT_PATTERNS.contact.test(query)) {
      intent = 'contact_info';
      confidence = 0.8;
    } else if (INTENT_PATTERNS.booking.test(query)) {
      intent = 'booking';
      confidence = 0.76;
    } else if (INTENT_PATTERNS.price.test(query)) {
      intent = 'price_lookup';
      confidence = 0.75;
    } else if (INTENT_PATTERNS.discount.test(query)) {
      intent = 'discount';
      confidence = 0.7;
    } else if (INTENT_PATTERNS.intent_info.test(query)) {
      intent = 'intent_info';
      confidence = 0.65;
    } else if (INTENT_PATTERNS.legal_query.test(query)) {
      intent = 'legal_query';
      confidence = 0.82;
    }

    return {
      intent,
      confidence,
      slots: {
        city: slots.city || context.city || null,
        area: slots.area || context.area || null,
        vehicle: slots.vehicle || context.vehicle || null,
        service: slots.service || context.service || null,
      },
    };
  }
}

module.exports = { IntentEngine, INTENT_PATTERNS };
