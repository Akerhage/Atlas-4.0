// ============================================
// Force-Add Engine — injects critical basfakta chunks by intent
// Prevents hallucination on key topics (policy, MC, prices, etc.)
// Ported from: patch/forceAddEngine.js
// ============================================

import type { KnowledgeChunk } from '../utils/price-resolver';
import type { IntentResult } from './intent-engine';

export interface ForceAddResult {
  mustAddChunks: KnowledgeChunk[];
  forceHighConfidence: boolean;
}

export class ForceAddEngine {
  private allChunks: KnowledgeChunk[];
  private scores: Record<string, number>;

  constructor(allChunks: KnowledgeChunk[], scores: Record<string, number> = {}) {
    this.allChunks = allChunks;
    this.scores = {
      rag_score_a1_am: 25000,
      rag_score_fix_saknade: 20000,
      rag_score_c8_kontakt: 25000,
      rag_score_b1_policy: 50000,
      rag_score_c7_teori: 55000,
      ...scores,
    };
  }

  execute(queryLower: string, intentResult: IntentResult, lockedCity: string | null): ForceAddResult {
    const mustAddChunks: KnowledgeChunk[] = [];
    let forceHighConfidence = false;
    const addedIds = new Set<string>();

    const addChunks = (chunks: KnowledgeChunk[], score: number, prepend = false) => {
      const newChunks = chunks.filter(c => !addedIds.has(c.id));
      for (const c of newChunks) {
        c.score = score;
        addedIds.add(c.id);
        if (prepend) {
          mustAddChunks.unshift(c);
        } else {
          mustAddChunks.push(c);
        }
      }
      return newChunks.length;
    };

    const findBySource = (pattern: string) =>
      this.allChunks.filter(c => c.source?.toLowerCase().includes(pattern.toLowerCase()));

    const findByBoost = () =>
      this.allChunks.filter(c => c.boost && c.boost > 0);

    const { intent, slots } = intentResult;
    const { vehicle } = slots;

    // TIER 1: Exact boost from JSON (5M points)
    const boosted = findByBoost();
    for (const chunk of boosted) {
      if (queryLower.includes((chunk.title || '').toLowerCase().slice(0, 15))) {
        addChunks([chunk], 5_000_000, true);
        forceHighConfidence = true;
      }
    }

    // Group A: AM/Moped
    if (/\b(am|moped|eu-moped)\b/i.test(queryLower)) {
      addChunks(findBySource('basfakta_am_kort'), this.scores.rag_score_a1_am);
      forceHighConfidence = true;
    }

    // Group B: Policy
    if (intent === 'policy' || /avbok|sjuk|ånger|villkor|betalning|faktura|klarna|swish/i.test(queryLower)) {
      addChunks(findBySource('basfakta_policy_kundavtal'), this.scores.rag_score_b1_policy, true);
      forceHighConfidence = true;
    }

    if (/betalning|klarna|swish|faktur/i.test(queryLower)) {
      addChunks(findBySource('basfakta_om_foretaget'), 8000);
    }

    if (/körkortstillstånd|tillstånd/i.test(queryLower)) {
      addChunks(findBySource('basfakta_korkortstillstand'), 7000);
    }

    // Group C: Specific knowledge
    if (/risk\s*1|riskettan/i.test(queryLower)) {
      addChunks(findBySource('basfakta_riskutbildning'), 9000, true);
    }

    if (/risk\s*2|risktvåan/i.test(queryLower)) {
      addChunks(findBySource('basfakta_riskutbildning'), 9000, true);
    }

    if (/\b(mc|motorcykel|a-körkort|a1|a2)\b/i.test(queryLower)) {
      addChunks(findBySource('basfakta_mc'), 85000, true);
      forceHighConfidence = true;
    }

    if (/\b(paket|mini|mellan|bas|total)\b/i.test(queryLower) && vehicle === 'BIL') {
      addChunks(findBySource('basfakta_lektioner_paket_bil'), 8500);
    }

    if (/\b(paket|mini|mellan|bas)\b/i.test(queryLower) && vehicle === 'MC') {
      addChunks(findBySource('basfakta_lektioner_paket_mc'), 9200);
    }

    if (/\b(lastbil|c-körkort|ce|c1)\b/i.test(queryLower)) {
      addChunks(findBySource('basfakta_lastbil'), 7000);
    }

    if (/\b(släp|be|b96)\b/i.test(queryLower)) {
      addChunks(findBySource('basfakta_be_b96'), 6500);
    }

    // C7: Teori-appen
    if (/\b(teori|app|mitt körkort|appen)\b/i.test(queryLower)) {
      addChunks(findBySource('basfakta_korkortsteori'), this.scores.rag_score_c7_teori, true);
      forceHighConfidence = true;
    }

    // C8: Contact queries
    if (intent === 'contact_info' || /adress|telefon|öppettider|kontakt/i.test(queryLower)) {
      addChunks(findBySource('basfakta_om_foretaget'), this.scores.rag_score_c8_kontakt);
      // Also add office-specific chunks if city locked
      if (lockedCity) {
        const officeChunks = this.allChunks.filter(
          c => c.type === 'kontor_info' && c.city?.toLowerCase() === lockedCity.toLowerCase(),
        );
        addChunks(officeChunks, 60000);
      }
    }

    // C9: Automat/Manuell
    if (/automat|manuell|villkor\s*78/i.test(queryLower)) {
      addChunks(findBySource('basfakta_personbil_b'), 85000, true);
      forceHighConfidence = true;
    }

    // Fix rules
    if (/12.?steg|stegguide/i.test(queryLower)) {
      addChunks(findBySource('basfakta_12_stegsguide'), 11000);
    }

    if (/giltighet|giltig|hur länge gäller/i.test(queryLower)) {
      addChunks(findBySource('basfakta_policy_kundavtal'), 30000);
      addChunks(findBySource('basfakta_korkortstillstand'), 30000);
      forceHighConfidence = true;
    }

    if (/testlektion/i.test(queryLower) && vehicle === 'BIL') {
      addChunks(findBySource('basfakta_lektioner_paket_bil'), 35000);
    }

    if (/\b(ykb|yrkeskompetens)\b/i.test(queryLower)) {
      addChunks(findBySource('basfakta_lastbil'), 18000);
    }

    if (/hur lång tid|hur länge tar|utbildningstid/i.test(queryLower)) {
      addChunks(findBySource('basfakta_lektioner_paket_bil'), 17000, true);
    }

    // Fallback: Unknown intent with low results
    if (intent === 'unknown' || intent === 'intent_info') {
      const nollChunks = findBySource('basfakta_nollutrymme');
      if (/\b(hej|hallå|tjena|god morgon|god kväll|hey)\b/i.test(queryLower)) {
        addChunks(nollChunks, 11000);
      }
    }

    return { mustAddChunks, forceHighConfidence };
  }
}
