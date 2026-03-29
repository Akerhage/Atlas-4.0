import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import MiniSearch from 'minisearch';

import { IntentEngine, type IntentResult } from './engines/intent-engine';
import { ForceAddEngine } from './engines/force-add-engine';
import { resolveContext, type ContextSlots } from './utils/context-lock';
import { resolvePrice, type KnowledgeChunk } from './utils/price-resolver';
import { tryTransportstyrelseFallback } from './utils/transportstyrelsen-fallback';
import { PrismaService } from '../database/prisma.service';

const MAX_CONTEXT_TOKENS = 2500;
const MIN_CONFIDENCE = 0.25;

interface Session {
  id: string;
  messages: Array<{ role: string; content: string }>;
  locked_context: ContextSlots;
  pending_query: string | null;
  pending_query_attempts: number;
  linksSentByVehicle: Record<string, boolean>;
  isFirstMessage: boolean;
}

interface QueryPayload {
  query: string;
  sessionId: string;
  isFirstMessage?: boolean;
  session_type?: string;
  context?: { locked_context?: ContextSlots };
}

@Injectable()
export class RagService implements OnModuleInit {
  private openai: OpenAI;
  private chunks: KnowledgeChunk[] = [];
  private miniSearch: MiniSearch;
  private intentEngine!: IntentEngine;
  private forceAddEngine!: ForceAddEngine;
  private sessions = new Map<string, Session>();
  private knownCities: string[] = [];
  private cityAliases: Record<string, string> = {};
  private areaToCity: Record<string, string> = {};
  private bookingLinks: Record<string, Record<string, string>> = {};

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });

    this.miniSearch = new MiniSearch({
      fields: ['title', 'text', 'city', 'area', 'keywords_joined', 'vehicle'],
      storeFields: ['title', 'text', 'city', 'area', 'vehicle', 'type', 'source', 'price', 'service_name', 'keywords', 'booking_links', 'boost', 'id'],
      searchOptions: {
        fuzzy: 0.2,
        prefix: true,
        boost: { title: 3, keywords_joined: 4, city: 2, area: 2 },
      },
    });
  }

  async onModuleInit() {
    await this.loadKnowledgeBase();
  }

  async loadKnowledgeBase() {
    const knowledgePath = join(__dirname, '..', '..', '..', 'knowledge');
    if (!existsSync(knowledgePath)) {
      console.warn('⚠️ Knowledge directory not found:', knowledgePath);
      return;
    }

    const files = readdirSync(knowledgePath).filter(f => f.endsWith('.json'));
    this.chunks = [];
    const cities = new Set<string>();
    let chunkId = 0;

    for (const file of files) {
      try {
        const content = JSON.parse(readFileSync(join(knowledgePath, file), 'utf-8'));

        if (file.startsWith('basfakta_')) {
          // Basfakta file: sections array
          const sections = content.sections || [];
          for (const section of sections) {
            this.chunks.push({
              id: `bf_${chunkId++}`,
              title: section.title || '',
              text: section.answer || '',
              type: 'basfakta',
              source: file,
              keywords: section.keywords || [],
              boost: section.score_boost || 0,
            });
          }
        } else {
          // Office file: city, area, prices, contact
          const city = content.city || '';
          const area = content.area || '';
          const routingTag = content.id || file.replace('.json', '');

          if (city) cities.add(city);
          if (area) this.areaToCity[area.toLowerCase()] = city;

          // Contact info chunk
          if (content.contact) {
            this.chunks.push({
              id: `office_${chunkId++}`,
              title: `${content.city} ${content.area || ''} - Kontaktinfo`,
              text: `Adress: ${content.contact.address || ''}, Telefon: ${content.contact.phone || ''}, E-post: ${content.contact.email || ''}`,
              type: 'kontor_info',
              source: file,
              city,
              area,
              keywords: ['kontakt', 'adress', 'telefon', 'öppettider'],
            });
          }

          // Price chunks
          if (content.prices && Array.isArray(content.prices)) {
            for (const price of content.prices) {
              if (Number(price.price) > 0) {
                this.chunks.push({
                  id: `price_${chunkId++}`,
                  title: price.service_name || '',
                  text: `${price.service_name}: ${price.price} SEK`,
                  type: 'price',
                  source: file,
                  city,
                  area,
                  price: Number(price.price),
                  currency: 'SEK',
                  service_name: price.service_name,
                  keywords: price.keywords || [],
                });
              }
            }
          }

          // Store booking links
          if (content.booking_links) {
            this.bookingLinks[routingTag] = content.booking_links;
          }
        }
      } catch (err) {
        console.error(`Failed to parse ${file}:`, err);
      }
    }

    // Build search index
    const indexed = this.chunks.map(c => ({
      ...c,
      keywords_joined: (c.keywords || []).join(' '),
    }));
    this.miniSearch.addAll(indexed);

    this.knownCities = Array.from(cities);
    this.intentEngine = new IntentEngine(this.knownCities, this.cityAliases, this.areaToCity);
    this.forceAddEngine = new ForceAddEngine(this.chunks);

    console.log(`📚 Knowledge loaded: ${this.chunks.length} chunks, ${this.knownCities.length} cities`);
  }

  async query(payload: QueryPayload): Promise<{ answer: string; locked_context?: ContextSlots }> {
    const { query, sessionId, context } = payload;
    const queryLower = query.toLowerCase().trim();

    // Get or create session
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        messages: [],
        locked_context: context?.locked_context || { city: null, area: null, vehicle: null },
        pending_query: null,
        pending_query_attempts: 0,
        linksSentByVehicle: {},
        isFirstMessage: true,
      };
      this.sessions.set(sessionId, session);
    }

    // 1. Intent extraction
    const intentResult = this.intentEngine.parseIntent(queryLower);

    // 2. Context resolution
    const resolvedContext = resolveContext(
      session.locked_context,
      {
        city: intentResult.slots.city,
        area: intentResult.slots.area,
        vehicle: intentResult.slots.vehicle,
      },
    );
    session.locked_context = resolvedContext;

    // 3. Proactive clarification (price without city)
    if (intentResult.intent === 'price_lookup' && !resolvedContext.city) {
      session.messages.push({ role: 'user', content: query });
      const answer = 'Vilken stad eller ort gäller din fråga? Vi har kontor på flera orter och priserna kan skilja sig.';
      session.messages.push({ role: 'assistant', content: answer });
      return { answer, locked_context: resolvedContext };
    }

    // 4. Search + Force-add
    const searchResults = this.miniSearch.search(queryLower, {
      filter: (result) => {
        // City guard: remove wrong city
        if (resolvedContext.city && result.city) {
          if (result.city.toLowerCase() !== resolvedContext.city.toLowerCase()) return false;
        }
        return true;
      },
    });

    // Map search results to chunks
    let rankedChunks: KnowledgeChunk[] = searchResults
      .slice(0, 30)
      .map(r => this.chunks.find(c => c.id === r.id))
      .filter(Boolean) as KnowledgeChunk[];

    // 5. Force-add engine
    const { mustAddChunks, forceHighConfidence } = this.forceAddEngine.execute(
      queryLower, intentResult, resolvedContext.city,
    );

    // Merge force-add chunks (prepend, deduplicate)
    const existingIds = new Set(rankedChunks.map(c => c.id));
    for (const chunk of mustAddChunks) {
      if (!existingIds.has(chunk.id)) {
        rankedChunks.unshift(chunk);
        existingIds.add(chunk.id);
      }
    }

    // 6. Confidence check
    const topScore = rankedChunks[0]?.score || 0;
    if (topScore < MIN_CONFIDENCE && !forceHighConfidence && rankedChunks.length === 0) {
      // Try Transportstyrelsen fallback
      const apiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
      const tsFallback = await tryTransportstyrelseFallback(queryLower, apiKey);
      if (tsFallback.answer) {
        // Log RAG failure with TS success
        this.logRagFailure(queryLower, session.id, true, true, tsFallback.url);
        session.messages.push({ role: 'user', content: query });
        session.messages.push({ role: 'assistant', content: tsFallback.answer });
        return { answer: tsFallback.answer, locked_context: resolvedContext };
      }
      // Log RAG failure
      this.logRagFailure(queryLower, session.id, tsFallback.used, false, tsFallback.url);
    }

    // 7. Price resolution
    let priceNote = '';
    if (intentResult.intent === 'price_lookup' && resolvedContext.city && intentResult.slots.service) {
      const priceResult = resolvePrice({
        city: resolvedContext.city,
        serviceTerm: intentResult.slots.service,
        chunks: this.chunks,
      });
      if (priceResult.found) {
        priceNote = `\n\n💰 Pris: ${priceResult.price} ${priceResult.currency}`;
      }
    }

    // 8. Build context for LLM
    let contextText = '';
    let tokenCount = 0;
    for (const chunk of rankedChunks) {
      const entry = `${chunk.title}: ${chunk.text}${chunk.price ? ` — ${chunk.price} SEK` : ''}\n\n`;
      const approxTokens = entry.length / 4;
      if (tokenCount + approxTokens > MAX_CONTEXT_TOKENS) break;
      contextText += entry;
      tokenCount += approxTokens;
    }

    // 9. Generate answer via OpenAI
    const systemPrompt = this.buildSystemPrompt(contextText, resolvedContext);
    const conversationHistory = session.messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 700,
        messages: [
          { role: 'system' as const, content: systemPrompt },
          ...conversationHistory,
          { role: 'user' as const, content: query },
        ],
      });

      let answer = completion.choices[0]?.message?.content?.trim() || 'Jag kunde inte generera ett svar just nu.';
      answer += priceNote;

      // 10. Add booking links
      answer = this.appendBookingLinks(answer, resolvedContext, session);

      // Update session
      session.messages.push({ role: 'user', content: query });
      session.messages.push({ role: 'assistant', content: answer });
      session.isFirstMessage = false;

      return { answer, locked_context: resolvedContext };
    } catch (err) {
      console.error('OpenAI error:', err);
      return {
        answer: '⚠️ Ett fel uppstod vid kontakt med AI-tjänsten. Försök igen om en stund.',
        locked_context: resolvedContext,
      };
    }
  }

  private buildSystemPrompt(contextText: string, context: ContextSlots): string {
    return `Du är Atlas, en AI-assistent för en trafikskola i Sverige. Svara alltid på svenska.

KRITISKA SVARSREGLER:
- MC-LEKTIONER: "15-20 lektioner behövs vanligtvis" (BARA om frågan explicit handlar om antal MC-lektioner)
- AUTOMAT: Nämn ALLTID "villkor 78" vid automatlåda-frågor
- GILTIGHETSTID: Köp & Paket = 24 månader. Genomförda kurser + Körkortstillstånd = 5 år. Presentkort = 1 år.
- FLERA ORTER: Lista ALDRIG priser från flera städer i samma svar. Fråga vilken stad om okänt.
- KONTAKTINFO: Om kontext innehåller telefon/adress, MÅSTE du ange det.

${context.city ? `Användarens stad: ${context.city}` : ''}
${context.area ? `Område: ${context.area}` : ''}
${context.vehicle ? `Fordonstyp: ${context.vehicle}` : ''}

KONTEXT FRÅN KUNSKAPSBASEN:
${contextText || 'Ingen relevant information hittades i kunskapsbasen.'}

Om du inte hittar svaret i kontexten ovan, erkänn det ärligt. Gissa aldrig priser eller tjänster.`;
  }

  private appendBookingLinks(answer: string, context: ContextSlots, session: Session): string {
    // Skip if no vehicle context
    if (!context.vehicle) return answer;

    const vehicleKey = context.vehicle.toUpperCase();
    const keyMap: Record<string, string> = {
      AM: 'AM', MC: 'MC', BIL: 'CAR', LASTBIL: 'CAR', SLÄP: 'CAR',
    };
    const linkKey = keyMap[vehicleKey];
    if (!linkKey || session.linksSentByVehicle[linkKey]) return answer;

    // Find booking link for the locked city/area
    for (const [tag, links] of Object.entries(this.bookingLinks)) {
      if (context.city && tag.toLowerCase().includes(context.city.toLowerCase())) {
        const url = links[linkKey];
        if (url) {
          session.linksSentByVehicle[linkKey] = true;
          // Don't append URL directly — just note that booking is available
          return answer;
        }
      }
    }

    return answer;
  }

  private async logRagFailure(query: string, sessionType: string, tsUsed: boolean, tsSuccess: boolean, tsUrl: string | null) {
    try {
      await this.prisma.ragFailure.create({
        data: { query, sessionType, tsFallbackUsed: tsUsed, tsFallbackSuccess: tsSuccess, tsUrl },
      });
    } catch (err) {
      console.error('Failed to log RAG failure:', err);
    }
  }

  // Public method for knowledge gap analysis
  async analyzeGaps(queries: string[]): Promise<{ analysis: string }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: 'Analysera dessa frågor som AI-systemet inte kunde besvara. Identifiera mönster och föreslå vilka kunskapsområden som bör förbättras. Svara på svenska.',
          },
          {
            role: 'user',
            content: `Frågor som inte besvarades:\n${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
          },
        ],
      });
      return { analysis: completion.choices[0]?.message?.content || 'Ingen analys tillgänglig.' };
    } catch {
      return { analysis: 'AI-analys misslyckades.' };
    }
  }

  async analyzeGapSingle(query: string): Promise<{ suggestion: string }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: 'Analysera varför RAG-systemet inte kunde besvara denna fråga. Föreslå vilken kunskapsbas-sektion som bör läggas till eller uppdateras. Svara på svenska.',
          },
          { role: 'user', content: query },
        ],
      });
      return { suggestion: completion.choices[0]?.message?.content || 'Ingen suggestion.' };
    } catch {
      return { suggestion: 'AI-analys misslyckades.' };
    }
  }
}
