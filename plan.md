# Plan: Atlas RAG — Mänsklig Supportupplevelse
> Roll: Senior UX-expert & AI-arkitekt  
> Datum: 2026-03-12  
> Mål: Öka mänskligheten i chatten via kirurgiska prompt- och logikjusteringar, utan att röra databasarkitektur eller grundläggande RAG-flöde.

---

## Steg 1: Analys — Var Triggar Systemet på Vaga Frågor?

### Fynd 1.1 — `generateSmartClarification` Aktiveras Sällan
**Fil:** `legacy_engine.js` · Rad ~1875–1886

Klarifieringsfunktionen triggas via detta villkor:
```js
if (!hasBasfakta && bestScore < LOW_CONFIDENCE_THRESHOLD && nluResult.intent !== 'contact_info') {
  const clarification = await generateSmartClarification(...);
```
**Problemet:** `hasBasfakta` är nästan alltid `true` eftersom basfakta-chunks alltid injiceras som utfyllnad (rad ~1572–1578). Det betyder att villkoret `!hasBasfakta` sällan uppfylls — och systemet skickar istället vag kontext rakt till OpenAI, som då gissar eller serverar ett generellt svar utan att fråga om stad/fordon.

**Effekt för kunden:** Vid frågan "vad kostar det?" utan stad → AI svarar med ett vagt generellt svar istället för att proaktivt be om preciseringen.

### Fynd 1.2 — `price_lookup` utan Stad Nyttjar Inte Klarifieringsflödet
**Fil:** `legacy_engine.js` · Rad ~1321–1326

```js
if (isPriceWord) {
  nluResult.intent = 'price_lookup';
}
```
När intent sätts till `price_lookup` men `lockedCity` är `null`, körs hela RAG-flödet ändå. `PriceResolver` returnerar `found: false` men detta felfall triggar ingen klarificeringsfråga — det faller bara tyst genom till OpenAI med basfakta som kontext.

### Fynd 1.3 — `generateSmartClarification` Prompt är Teknisk
**Fil:** `legacy_engine.js` · Rad ~851–880

Nuvarande prompt-text:
```
"Det saknas: stad eller kontor och fordonstyp (bil, MC, moped/AM, lastbil)"
```
Detta är ett tekniskt internt format som läcks in i AI-prompten och riskerar ge ett robotaktigt svar.

---

## Steg 2: Åtgärder — Proaktivt & Mänskligt Tonläge

### Åtgärd 2.1 — Ny Trigger för Prisfrågor utan Stad (Kirurgisk)
**Fil:** `legacy_engine.js`  
**Placering:** Direkt efter att `lockedCity`/`priceResult` är klar, innan OpenAI-anropet.  
**Lägg in efter rad ~1960 (PriceResolver-blocket):**

```js
// === PROAKTIV KLARIFIERING: Prisfråga utan känd stad ===
if (
  nluResult.intent === 'price_lookup' &&
  !lockedCity &&
  !detectedCity
) {
  const clarification = await generateSmartClarification(query, nluResult, null, detectedVehicleType);
  return res.json({
    answer: clarification,
    context: [],
    sessionId,
    debug: { triggered_by: 'price_without_city', intent: nluResult.intent }
  });
}
```

**Varför det är säkert:** Kontexten nollas inte — `session.locked_context` påverkas inte. Nästa svar från kunden (med stad) löper normalt vidare in i RAG.

---

### Åtgärd 2.2 — Omskriven `generateSmartClarification` System-prompt
**Fil:** `legacy_engine.js` · Funktion `generateSmartClarification` · Rad ~851

**Byt ut nuvarande `systemPrompt` (rad ~851–857) mot:**

```js
const systemPrompt = `Du är Atlas — en varm, rådgivande kundtjänstassistent för en svensk trafikskola.
En kund har ställt en fråga som är lite för vag för att du ska kunna ge ett korrekt svar.

Din uppgift är att skriva ett svar (2–3 meningar, svenska) som:
1. SPEGLAR kundens ämne — visa att du uppfattat vad de undrar.
   Exempel: "Jag ser att du undrar om priset för körlektion!"
2. GUIDAR med en konkret fråga om det som saknas (stad och/eller fordon).
   Exempel: "För att jag ska kunna titta i rätt prislista, behöver jag bara veta vilken stad och vilket körkort det gäller?"
3. GER SNABBEXEMPEL på vanliga städer eller alternativ.
   Exempel: "Vi finns bland annat i Malmö, Göteborg, Stockholm, Lund och Helsingborg — kanske ett av dem stämmer?"

Var varm, konkret och hjälpsam. Gissa ALDRIG priser eller info du inte fått.
Avsluta INTE med "Hör av dig om du har frågor" — bjud i stället in kunden att svara direkt i chatten.`;
```

**Byt ut nuvarande `userPrompt` (rad ~859–866) mot:**

```js
const intentLabel = {
  price_lookup: 'pris eller kostnad',
  booking: 'bokning eller lediga tider',
  risk_info: 'riskutbildning',
  handledare_course: 'handledarutbildning',
  tillstand_info: 'körkortstillstånd',
  contact_info: 'kontaktuppgifter',
  service_inquiry: 'tjänst eller utbildning',
}[nluResult?.intent] || 'körkortsfråga';

const vehicleLabel = detectedVehicle
  ? `kundens fordonstyp verkar vara ${detectedVehicle}`
  : 'fordonstyp oklart (bil, MC, moped/AM eller lastbil)';

const cityHint = detectedCity
  ? `Kunden verkar befinna sig i närheten av ${detectedCity}.`
  : 'Stad är helt okänd.';

const exampleCities = 'Malmö, Göteborg, Stockholm, Lund, Helsingborg, Uppsala, Linköping, Umeå, Gävle eller Varberg';

const userPrompt = `Kundens fråga: "${query}"
Ämne: ${intentLabel}
${vehicleLabel}
${cityHint}
Exempel på våra städer: ${exampleCities}
Skriv en varm, smart klarifieringsfråga som speglar ämnet och ber om rätt preciseringar.`;
```

---

### Åtgärd 2.3 — Berika Fallback-texten i Huvud-systemprompt
**Fil:** `legacy_engine.js` · Huvud-systemPrompt · Sektion `// === FALLBACK (INTELLIGENT) ===` · Rad ~618

**Byt ut nuvarande fallback-text mot:**

```
// === FALLBACK (INTELLIGENT) ===
- Om information saknas i kontexten: GISSA ALDRIG priser, tider, tillgänglighet eller annat du inte vet.
- Avled istället kunden mjukt: spegla deras fråga ("Jag ser att du undrar om X!"), fråga sedan om det som saknas på ett naturligt sätt.
- Om stad saknas vid prisfråga: "För att hitta rätt prislista behöver jag bara veta vilken stad du planerar att köra i — vi finns bland annat i Malmö, Göteborg, Stockholm och Lund!"
- Om fordon saknas: "Och gäller det bil, MC, moped (AM) eller kanske lastbil?"
- Var varm och hjälpsam — förklara, gissa inte.
- Avsluta aldrig med "Hör av dig om du har frågor" — chatten är redan öppen, bjud in direkt.
```

---

## Steg 3: Kontext-Optimering — contextLock.js

### Fynd 3.1 — Kontexten Bevaras, Men Klarifieringen Läser Den Inte
**Fil:** `legacy_engine.js` · Rad ~1300–1304

`lockedContext.city` hämtas korrekt och skickas med som `contextPayload`, men när `generateSmartClarification` anropas (rad 1886) skickas `lockedCity || detectedCity` — om ingen stad är låst skickas `null`.

**`contextLock.js` fungerar korrekt** — `resolveCity`, `resolveArea`, `resolveArea` med `cityChanged`-logiken är solid. Problemet är att informationen inte når `generateSmartClarification`.

### Åtgärd 3.1 — Skicka Mer Kontext till Klarificeringen
**Fil:** `legacy_engine.js` · Rad ~1886  
**Byt ut:**
```js
const clarification = await generateSmartClarification(query, nluResult, lockedCity || detectedCity, detectedVehicleType);
```
**Mot:**
```js
const clarification = await generateSmartClarification(
  query,
  nluResult,
  lockedCity || detectedCity,
  detectedVehicleType,
  session.locked_context  // ← skicka hela låste kontexten för kontextmedveten klarifiering
);
```

**Och uppdatera funktionssignaturen** (rad ~841):
```js
// FÖRE:
async function generateSmartClarification(query, nluResult, detectedCity, detectedVehicle) {

// EFTER:
async function generateSmartClarification(query, nluResult, detectedCity, detectedVehicle, lockedCtx = {}) {
```

**Lägg till i `userPrompt`-logiken** (direkt efter `cityHint`):
```js
const prevHistory = lockedCtx.city
  ? `Kunden har tidigare i sessionen pratat om: ${[lockedCtx.city, lockedCtx.vehicle].filter(Boolean).join(', ')}.`
  : '';
```
Och infoga `${prevHistory}` i `userPrompt`-strängen — detta ger AI:n möjlighet att säga "Menar du fortfarande i Göteborg, eller är det en annan stad?"

### Änd 3.2 — Kontextminnets Potential vid "vad kostar det?"
Vid en följdfråga som "ok men vad kostar det då?" inom en session där `lockedContext.city = "Göteborg"` och `lockedContext.vehicle = "MC"` är redan satt, fungerar flödet korrekt idag (se rad ~1363–1370). Detta är ett befintligt styrkefall — dokumenteras för teamet som en positiv egenskap att kommunicera i demomaterialet.

---

## Steg 4: Sömlös Transportstyrelsen-Fallback

### Fynd 4.1 — Trigger-strängen är Skör
**Fil:** `server.js` · Rad ~467

```js
if (aiEnabled && responseText.includes("hittar ingen information")) {
```
Problemet: Triggern är hårdkodad till just den frasen. Om AI-modellen formulerar sig något annorlunda ("kan inte hitta", "saknar information om") missar servern fallbacken helt.

### Åtgärd 4.1 — Bredare Trigger-kontroll
**Fil:** `server.js` · Rad ~467  
**Byt ut:**
```js
if (aiEnabled && responseText.includes("hittar ingen information")) {
```
**Mot:**
```js
const ragMissPatterns = [
  "hittar ingen information",
  "kan inte hitta",
  "har inte den informationen",
  "saknar information",
  "finns inte i",
  "inte tillgänglig"
];
const seemsLikeRAGMiss = ragMissPatterns.some(p => responseText.toLowerCase().includes(p));

if (aiEnabled && seemsLikeRAGMiss) {
```
**Notera:** Samma fix bör appliceras på den identiska blocket vid rad ~1043 (det andra call-stället).

---

### Åtgärd 4.2 — Bryggtext som Mänskliggör Övergången
**Fil:** `utils/transportstyrelsen-fallback.js` · Funktion `tryTransportstyrelseFallback` · Rad ~191–232

När Transportstyrelsen-svaret är framtaget, lägg till ett mänskligt prefix *innan* det returneras till `server.js`.

**I `tryTransportstyrelseFallback`, före `return`-raden efter `answer`:**
```js
const bridgePrefix =
  `Jag hittade inte svaret i vår egen kunskapsbas, ` +
  `men gick ett extra steg och kollade Transportstyrelsen åt dig:\n\n`;

return bridgePrefix + answer;
```

**Varför:** Kunden ser inte att det händer ett systembyxbyte — de upplever att Atlas "gick nExtra milen" för dem. Tillägget är ren text, rör inga modellparametrar.

---

### Åtgärd 4.3 — Käll-citatet Mer Inbjudande
**Fil:** `utils/transportstyrelsen-fallback.js` · System-prompt · Rad ~205

Nuvarande avslutningsregel:
```
"6. Avsluta alltid varje svar med en ny rad: "Källa: Transportstyrelsen.se""
```

**Byt ut mot:**
```
"6. Avsluta alltid svaret med (på ny rad): 
   "📋 Källa: Transportstyrelsen.se — vill du veta mer eller boka, kan du fortsätta fråga mig!""
```
Detta håller kunden kvar i dialogen snarare än att avsluta konversationen med en torr källhänvisning.

---

## Prioriteringslista

| Prioritet | Åtgärd | Risk | Fil |
|-----------|--------|------|-----|
| 🔴 HÖG | 2.1 — Ny trigger: prisfråga utan stad | Låg | `legacy_engine.js` |
| 🔴 HÖG | 2.2 — Ny klarifierings-prompt (Spegla, Guida, Förenkla) | Låg | `legacy_engine.js` |
| 🟡 MEDEL | 4.1 — Bredare TS-fallback trigger (2 ställen) | Låg | `server.js` |
| 🟡 MEDEL | 4.2 — Bryggtext vid TS-fallback | Låg | `transportstyrelsen-fallback.js` |
| 🟡 MEDEL | 3.1 — Skicka `locked_context` till klarificering | Låg | `legacy_engine.js` |
| 🟢 LÅG | 2.3 — Berika fallback-sektion i huvud-systemprompt | Mycket låg | `legacy_engine.js` |
| 🟢 LÅG | 4.3 — Mer inbjudande källcitering i TS-svar | Mycket låg | `transportstyrelsen-fallback.js` |

---

## Vad Denna Plan INTE Rör
- Ingen förändring av databasschema eller SQL.
- Ingen förändring av grundläggande RAG-rankningslogik (scores, boosting).
- Ingen förändring av `contextLock.js` — det fungerar korrekt idag.
- Ingen förändring av routning i ärendesystemet.
- Ingen förändring av socket/klient-kommunikation.

---

## Verifiering (Manuell)
Testa dessa fyra scenarion i chatten efter implementation:

1. **"Vad kostar en körlektion?"** (ingen stad, ingen session) → Ska få speglingssvar + stadsfråga med exempel.
2. **"Göteborg! Vad kostar det då?"** (stad angiven i föregående meddelande) → Ska ge pris direkt utan att be om mer.
3. **"Vilken ålder måste min handledare ha?"** (regelfrågana) → Ska trigga TS-fallback med bryggtext om intern info saknas.
4. **"tack så mycket!"** → Ska inte trigga RAG alls — enkelt chatsvar.
