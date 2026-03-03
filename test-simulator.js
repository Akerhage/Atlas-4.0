#!/usr/bin/env node
// ============================================================
// test-simulator.js — Atlas RAG & Ärendesimulerare
// VAD DEN GÖR: Simulerar kontinuerlig kundtrafik för att testa
//              RAG-motorn, AI-svar och ärendehantering.
// KÖRNING:     node test-simulator.js
// ANPASSA:     INTERVAL_MS=60000 BATCH_MIN=2 node test-simulator.js
// STOPP:       Ctrl+C (skriver ut RAG-felrapport vid exit)
// ============================================================

const axios    = require('axios');
const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const FormData = require('form-data');

const SERVER_URL    = process.env.SERVER_URL    || 'http://localhost:3001';
const ADMIN_USER    = process.env.ADMIN_USER    || 'admin';
const ADMIN_PASS    = process.env.ADMIN_PASS    || 'password';
const INTERVAL_MS   = parseInt(process.env.INTERVAL_MS  || '600000', 10); // 10 min
const BATCH_MIN     = parseInt(process.env.BATCH_MIN     || '5',       10);
const BATCH_MAX     = parseInt(process.env.BATCH_MAX     || '10',      10);

// ============================================================
// FRÅGEDATABAS — hämtad från kundwidgetens snabbval + RAG-knowledge
// ============================================================

const VEHICLE_QUESTIONS = {
  bil: [
    'Vad kostar ett körkort för bil?',
    'Hur många lektioner behöver jag ta för B-körkort?',
    'Hur lång tid tar det att ta körkort?',
    'Vad ingår i riskutbildningen för bil?',
    'Kan jag köra med handledare och hur gammalt måste jag vara?',
    'Vad kostar teorin och hur bokar jag teoritest?',
    'Hur bokar jag uppkörning hos Trafikverket?',
    'Vad krävs för att ta körkort B?',
    'Hur mycket kostar ett 12-stegs intensivpaket?',
    'Vad är skillnaden mellan intensivkurs och vanlig utbildning?',
    'Kan jag boka enstaka lektioner eller måste jag ta ett paket?',
    'Ingår teoribok och teoriprov i paketet?',
    'Vad är nollutrymmesmetoden och hur övar man det?',
    'Hur lång tid tar handledarkursen?',
    'Vad ingår i introduktionskursen för handledare?',
  ],
  mc: [
    'Vad kostar ett MC-körkort?',
    'Vad är skillnaden mellan A och A2-körkort?',
    'Måste jag ta riskutbildning för MC?',
    'Kan jag börja med A1-körkort?',
    'Hur bokar jag MC-lektioner?',
    'Hur gammalt måste jag vara för MC A-körkort?',
    'Kan man ta MC-körkort utan att ha bil-körkort?',
    'Vad ingår i MC-paketen och vad kostar de?',
    'Vad är skillnaden på moped klass 1 och MC?',
  ],
  lastbil: [
    'Vad kostar ett C-körkort för lastbil?',
    'Hur tar man CE-körkort och vad krävs?',
    'Behöver jag B-körkort innan jag kan ta C?',
    'Hur lång tid tar lastbilsutbildningen?',
    'Vad ingår i C1-utbildningen?',
    'Finns det yrkeskompetensprogram för lastbil?',
  ],
  am: [
    'Vad kostar AM-kort?',
    'Hur gammalt måste man vara för AM-kort?',
    'Vad är skillnaden på AM och moped klass 2?',
    'Hur lång tid tar AM-kursen och vad ingår?',
    'Kan man ta AM-kort utan att ha annan körkortsbehörighet?',
  ],
};

const OFFICE_QUESTION_TEMPLATES = [
  'Vad är öppettiderna på er trafikskola i {{stad}}?',
  'Hur kontaktar jag kontoret i {{stad}}?',
  'Vilka tjänster erbjuder ni i {{stad}}?',
  'Vad är adressen till {{stad}}-kontoret?',
  'Vilket telefonnummer har ni i {{stad}}?',
  'Vilka fordonskategorier kan jag ta körkort på i {{stad}}?',
  'Erbjuder ni intensivkurs i {{stad}}?',
  'Är det lång kötid till lektioner i {{stad}}?',
];

const GENERAL_QUESTIONS = [
  'Hur lång tid tar det att få körkortstillstånd?',
  'Kan jag ta körkort om jag har glasögon?',
  'Vad gäller om man blivit av med körkortet?',
  'Är det möjligt att köra lastbil med vanligt B-körkort?',
  'Kan man ta körkort utomlands och använda det i Sverige?',
  'Vad är BE-körkort?',
  'Kan man ta B96 istället för BE-körkort?',
  'Vad kostar riskutbildning för bil och MC?',
  'Hur funkar körkortsprocessen steg för steg?',
  'Vad är körkortsbeviset och hur länge gäller det?',
  'Hur ansöker man om körkortstillstånd hos Transportstyrelsen?',
  'Hur bokar man uppkörning och vad kostar det?',
  'Vad händer om man underkänns på uppkörningen?',
  'Erbjuder ni paketpris som inkluderar teori och praktik?',
  'Vad är era betalningsalternativ och betalar ni avbeställningsavgift?',
];

// Falska kunddata för simulering
const FAKE_NAMES = [
  'Emma Lindqvist', 'Lucas Bergström', 'Maja Andersson', 'Oliver Svensson',
  'Ida Karlsson', 'Noah Johansson', 'Alice Nilsson', 'William Eriksson',
  'Sofia Persson', 'Elias Magnusson', 'Lina Olsson', 'Jakob Larsson',
  'Wilma Gustafsson', 'Hugo Pettersson', 'Klara Jonsson', 'Filip Hansson',
  'Elin Ström', 'Max Lindberg', 'Saga Björk', 'Viktor Engström',
];

const FAKE_EMAILS = [
  'emma.lindqvist@gmail.com', 'lucas.berg@hotmail.com', 'maja.a@live.se',
  'oliver.sv@yahoo.se', 'ida.k@proton.me', 'noah.j@gmail.com',
  'alice.nilsson99@gmail.com', 'william.e@outlook.com', 'sofia.p@icloud.com',
  'elias.m@gmail.com', 'lina.o@hotmail.se', 'jakob.l@gmail.com',
  'elin.strom@proton.me', 'max.lbg@gmail.com', 'saga.bjork@live.se',
];

const FORM_SUBJECTS = [
  'Fråga om priser',
  'Vill veta mer om utbildning',
  'Behöver hjälp med bokning',
  'Fråga om körkortsprocessen',
  'Intresserad av intensivkurs',
  'Vad kostar det?',
  'Fråga om MC-körkort',
];

// ============================================================
// HJÄLPFUNKTIONER
// ============================================================

const sleep     = (ms) => new Promise(r => setTimeout(r, ms));
const randInt   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randItem  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const newSid    = () => 'sim_' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);

let authToken   = null;
let offices     = [];
let batchNum    = 0;
let sessionCount = 0;
let formCount    = 0;
let ragFailures  = [];

// Terminal-färger
const C = {
  reset:   '\x1b[0m',
  bright:  '\x1b[1m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  gray:    '\x1b[90m',
  white:   '\x1b[37m',
};

function ts()     { return new Date().toLocaleTimeString('sv-SE'); }
function logOk(m)   { console.log(`${C.gray}[${ts()}]${C.reset} ✅ ${C.green}${m}${C.reset}`); }
function logInfo(m) { console.log(`${C.gray}[${ts()}]${C.reset} ℹ️  ${C.cyan}${m}${C.reset}`); }
function logWarn(m) { console.log(`${C.gray}[${ts()}]${C.reset} ⚠️  ${C.yellow}${m}${C.reset}`); }
function logErr(m)  { console.log(`${C.gray}[${ts()}]${C.reset} ❌ ${C.red}${m}${C.reset}`); }
function logRag(m)  { console.log(`${C.gray}[${ts()}]${C.reset} 🤖 ${C.blue}${m}${C.reset}`); }
function logHead(m) { console.log(`\n${C.bright}${C.cyan}${m}${C.reset}`); }

// ============================================================
// AUTENTISERING
// ============================================================

async function login() {
  try {
    const res = await axios.post(`${SERVER_URL}/api/auth/login`, {
      username: ADMIN_USER,
      password: ADMIN_PASS,
    }, { timeout: 10000 });
    authToken = res.data.token;
    logOk(`Inloggad som "${ADMIN_USER}" — token OK`);
    return true;
  } catch (err) {
    logErr(`Inloggning misslyckades: ${err.response?.data?.error || err.message}`);
    return false;
  }
}

function authHdr() {
  return {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };
}

// ============================================================
// HÄMTA KONTOR
// ============================================================

async function fetchOffices() {
  try {
    const res = await axios.get(`${SERVER_URL}/api/public/offices`, { timeout: 10000 });
    offices = res.data || [];
    logOk(`Hämtade ${offices.length} kontor från API:t`);
  } catch (err) {
    logErr(`Kunde inte hämta kontor: ${err.message}`);
    offices = [];
  }
}

// ============================================================
// RAG-KVALITETSKONTROLL
// ============================================================

const RAG_FAIL_PATTERNS = [
  /vet inte/i,
  /har inte (den\s)?information/i,
  /kan inte (hitta|svara|hjälpa)/i,
  /hittar ingen information/i,
  /saknar information/i,
  /inte tillgänglig/i,
  /unfortunately/i,
  /I don't (know|have)/i,
  /no information/i,
];

function checkRagQuality(question, answer, sessionId, city) {
  if (!answer || answer.trim().length === 0) {
    ragFailures.push({ ts: new Date().toISOString(), sessionId, city, question, answer: '(tomt svar)' });
    logWarn(`RAG-FEL [${sessionId.substring(5, 17)}] Tomt svar på: "${question.substring(0, 55)}"`);
    return false;
  }

  const hitsFail = RAG_FAIL_PATTERNS.some(p => p.test(answer));
  const tooShort = answer.trim().length < 60;

  if (hitsFail || tooShort) {
    ragFailures.push({
      ts: new Date().toISOString(),
      sessionId,
      city,
      question,
      answer: answer.substring(0, 250),
    });
    logWarn(`RAG-FEL [${sessionId.substring(5, 17)}] Dåligt svar på: "${question.substring(0, 55)}"`);
    logWarn(`         → "${answer.substring(0, 100)}"`);
    return false;
  }

  return true;
}

// ============================================================
// SIMULERA KUNDCHATT
// ============================================================

async function simulateChat(office) {
  const sessionId = newSid();
  const vehicleKeys = Object.keys(VEHICLE_QUESTIONS);
  const vehicle     = randItem(vehicleKeys);
  const questions   = [...VEHICLE_QUESTIONS[vehicle]].sort(() => Math.random() - 0.5);
  const cityName    = office?.city || null;

  // Välj 2–4 frågor om fordon + ev. kontorsfråga
  const numQ     = randInt(2, 4);
  const selected = questions.slice(0, numQ);
  if (office && Math.random() > 0.4) {
    const tpl = randItem(OFFICE_QUESTION_TEMPLATES);
    selected.push(tpl.replace('{{stad}}', office.city || 'okänd'));
  }

  logInfo(`CHATT [${sessionId.substring(5, 17)}] @ ${cityName || 'generell'} — ${selected.length} frågor om ${vehicle}`);

  const context = office ? {
    locked_context: {
      city:    office.city    || null,
      area:    office.area    || null,
      vehicle: vehicle,
    },
  } : {};

  for (const question of selected) {
    try {
      const res = await axios.post(`${SERVER_URL}/api/customer/message`, {
        sessionId,
        message: question,
        context,
      }, { timeout: 20000 });

      const answer = res.data?.answer || '';
      logRag(`  Q: "${question.substring(0, 60)}"`);
      logRag(`  A: "${answer.substring(0, 80)}${answer.length > 80 ? '…' : ''}"`);

      checkRagQuality(question, answer, sessionId, cityName);
    } catch (err) {
      logErr(`  Chattfel: ${err.response?.data?.error || err.message}`);
    }

    await sleep(randInt(800, 2500));
  }

  sessionCount++;
  return sessionId;
}

// ============================================================
// SIMULERA FORMULÄRÄRENDE
// office = null  →  skickar till centralsupport (huvud-inkorgen)
// office = {...} →  skickar till kontorets routing_tag
// ============================================================

async function simulateForm(office) {
  const name    = randItem(FAKE_NAMES);
  const email   = randItem(FAKE_EMAILS);
  const vehicle = randItem(Object.keys(VEHICLE_QUESTIONS));
  const allQ    = [...VEHICLE_QUESTIONS[vehicle], ...GENERAL_QUESTIONS];
  const message = randItem(allQ);
  const phone   = `07${randInt(10, 99)}-${randInt(100000, 999999)}`;

  // Källkod kundwidget: om ingen kontors-match → agent_id = 'centralsupport'
  const isCentral = !office;
  const agentId   = isCentral ? 'centralsupport' : office.routing_tag;
  const dest      = isCentral ? 'Centralsupport' : office.city;

  try {
    const res = await axios.post(`${SERVER_URL}/api/customer/message-form`, {
      name,
      email,
      phone,
      subject:  randItem(FORM_SUBJECTS),
      message,
      city:     office?.city  || null,
      area:     office?.area  || null,
      vehicle,
      agent_id: agentId,
    }, { timeout: 10000 });

    if (res.data?.success) {
      const label = isCentral ? '📥 CENTRAL' : `📬 KONTOR`;
      logOk(`FORMULÄR ${label} [${res.data.sessionId?.substring(0, 8) || '?'}] ${name} → ${dest}: "${message.substring(0, 45)}"`);
      formCount++;
      return res.data.sessionId;
    }
  } catch (err) {
    logErr(`Formulärfel: ${err.response?.data?.error || err.message}`);
  }
  return null;
}

// ============================================================
// TESTA GENERELLA KUNSKAPSDATABASENS RAG
// ============================================================

async function testKnowledgeBase() {
  logHead('── Kunskapsbas-test ──');
  const sessionId = newSid();
  const testQ = [...GENERAL_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);

  for (const question of testQ) {
    try {
      const res = await axios.post(`${SERVER_URL}/api/customer/message`, {
        sessionId,
        message: question,
      }, { timeout: 20000 });

      const answer = res.data?.answer || '';
      logRag(`  KB Q: "${question.substring(0, 60)}"`);
      logRag(`  KB A: "${answer.substring(0, 80)}${answer.length > 80 ? '…' : ''}"`);
      checkRagQuality(question, answer, sessionId, null);
    } catch (err) {
      logErr(`KB-frågefel: ${err.message}`);
    }
    await sleep(1000);
  }
}

// ============================================================
// SIMULERA FILUPPLADDNING — CHATT
// Flöde: POST /api/upload (multipart) → skicka chat-msg med fil-URL
// ============================================================

async function simulateFileUploadChat() {
  if (!fs.existsSync(TEST_FILE)) {
    logWarn(`Testfil saknas: ${TEST_FILE}`);
    return;
  }

  logHead('── Filuppladdning (chatt) ──');
  const sessionId = newSid();

  // 1. Ladda upp filen
  let fileUrl = null;
  let savedFilename = null;
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_FILE), {
      filename: 'test-fil-chatt.png',
      contentType: 'image/png',
    });

    const upRes = await axios.post(`${SERVER_URL}/api/upload`, form, {
      headers: form.getHeaders(),
      timeout: 15000,
    });

    if (upRes.data?.success && upRes.data?.url) {
      fileUrl = upRes.data.url;
      savedFilename = upRes.data.filename;
      logOk(`Fil uppladdad → ${fileUrl}`);
      uploadCount++;
    } else {
      logErr('Upload-svar saknade url');
      return;
    }
  } catch (err) {
    logErr(`Uppladdningsfel (chatt): ${err.response?.data?.error || err.message}`);
    return;
  }

  // 2. Verifiera att filen faktiskt finns i /uploads/ på disk
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  const diskFile   = path.join(uploadsDir, path.basename(fileUrl));
  if (fs.existsSync(diskFile)) {
    const size = fs.statSync(diskFile).size;
    logOk(`Verifierad på disk: uploads/${path.basename(fileUrl)} (${(size / 1024).toFixed(1)} KB)`);
  } else {
    logWarn(`Filen hittades INTE på disk: ${diskFile}`);
  }

  // 3. Skicka ett chat-meddelande som refererar filen (som kundwidgeten gör)
  const fullUrl = `${SERVER_URL}${fileUrl}`;
  try {
    const res = await axios.post(`${SERVER_URL}/api/customer/message`, {
      sessionId,
      message: `Hej! Jag bifogar en fil med frågan. [Bifogad fil: ${savedFilename}](${fullUrl})`,
    }, { timeout: 15000 });

    const answer = res.data?.answer || '';
    logRag(`  Chat+fil svar: "${answer.substring(0, 80)}"`);
  } catch (err) {
    logErr(`Chat-fil-meddelande-fel: ${err.response?.data?.error || err.message}`);
  }

  // 4. Verifiera att filen är nåbar via HTTP
  try {
    const dlRes = await axios.get(`${SERVER_URL}${fileUrl}`, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const dlSize = dlRes.data.byteLength;
    logOk(`Fil nåbar via HTTP: ${fileUrl} (${(dlSize / 1024).toFixed(1)} KB nedladdad)`);
  } catch (err) {
    logErr(`HTTP-åtkomst misslyckades: ${err.response?.status || err.message}`);
  }
}

// ============================================================
// SIMULERA FILUPPLADDNING — FORMULÄR (mail-liknande)
// Flöde: POST /api/upload → POST /api/customer/message-form med fil-URL i meddelandet
// ============================================================

async function simulateFileUploadForm() {
  if (!fs.existsSync(TEST_FILE)) {
    logWarn(`Testfil saknas: ${TEST_FILE}`);
    return;
  }

  logHead('── Filuppladdning (formulär/mail) ──');

  // 1. Ladda upp filen
  let fileUrl = null;
  let savedFilename = null;
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_FILE), {
      filename: 'test-fil-chatt.png',
      contentType: 'image/png',
    });

    const upRes = await axios.post(`${SERVER_URL}/api/upload`, form, {
      headers: form.getHeaders(),
      timeout: 15000,
    });

    if (upRes.data?.success && upRes.data?.url) {
      fileUrl = upRes.data.url;
      savedFilename = upRes.data.filename;
      logOk(`Fil uppladdad (formulär) → ${fileUrl}`);
      uploadCount++;
    } else {
      logErr('Upload-svar saknade url');
      return;
    }
  } catch (err) {
    logErr(`Uppladdningsfel (formulär): ${err.response?.data?.error || err.message}`);
    return;
  }

  // 2. Skicka formulärärende med fil-URL i meddelandet
  const name  = randItem(FAKE_NAMES);
  const email = randItem(FAKE_EMAILS);
  const fullUrl = `${SERVER_URL}${fileUrl}`;
  try {
    const res = await axios.post(`${SERVER_URL}/api/customer/message-form`, {
      name,
      email,
      phone:    `076-${randInt(1000000, 9999999)}`,
      subject:  'Bifogad fil — testärende',
      message:  `Hej! Jag skickar en fil med frågan. Se bifogad bild: [${savedFilename}](${fullUrl})`,
      city:     null,
      vehicle:  'BIL',
      agent_id: 'centralsupport',
    }, { timeout: 10000 });

    if (res.data?.success) {
      logOk(`Formulär+fil skickat (${name}) → ärendeID: ${res.data.sessionId?.substring(0, 12)}`);
      formCount++;
    }
  } catch (err) {
    logErr(`Formulär+fil-fel: ${err.response?.data?.error || err.message}`);
  }
}

// ============================================================
// HÄMTA INKORG
// ============================================================

async function fetchInbox() {
  try {
    const res = await axios.get(`${SERVER_URL}/team/inbox`, {
      headers: authHdr(),
      timeout: 10000,
    });
    return res.data?.tickets || [];
  } catch (err) {
    logErr(`Inkorg-fel: ${err.response?.data?.error || err.message}`);
    return [];
  }
}

// ============================================================
// CLAIM TICKET
// ============================================================

async function claimTicket(conversationId) {
  try {
    await axios.post(`${SERVER_URL}/team/claim`, {
      conversationId,
      agentName: ADMIN_USER,
    }, { headers: authHdr(), timeout: 10000 });
    logOk(`  Plockat: ${conversationId.substring(0, 18)}`);
    return true;
  } catch (err) {
    logErr(`  Claim-fel (${conversationId.substring(0, 14)}): ${err.response?.data?.error || err.message}`);
    return false;
  }
}

// ============================================================
// SVARA PÅ TICKET
// ============================================================

const AGENT_REPLIES = [
  'Tack för din fråga! Vi återkommer inom kort med mer information.',
  'Hej! Vi har tagit emot ditt ärende och undersöker det nu.',
  'Tack! Vi hjälper dig gärna. Kan du berätta lite mer om din situation?',
  'Vi har noterat din förfrågan och återkommer snarast.',
  'Hej och välkommen! Vi tittar på detta och hör av oss.',
  'Tack för kontakten! Berätta gärna om du har fler frågor.',
];

async function replyToTicket(conversationId) {
  try {
    await axios.post(`${SERVER_URL}/api/team/reply`, {
      conversationId,
      message: randItem(AGENT_REPLIES),
    }, { headers: authHdr(), timeout: 10000 });
    logOk(`  Svarade: ${conversationId.substring(0, 18)}`);
    return true;
  } catch (err) {
    logErr(`  Svar-fel: ${err.response?.data?.error || err.message}`);
    return false;
  }
}

// ============================================================
// ARKIVERA TICKET
// ============================================================

async function archiveTicket(conversationId) {
  try {
    await axios.post(`${SERVER_URL}/api/inbox/archive`, {
      conversationId,
    }, { headers: authHdr(), timeout: 10000 });
    logOk(`  Arkiverad: ${conversationId.substring(0, 18)}`);
    return true;
  } catch (err) {
    logErr(`  Arkiv-fel: ${err.response?.data?.error || err.message}`);
    return false;
  }
}

// ============================================================
// HANTERA SIMULERADE ÄRENDEN I INKORG
// ============================================================

async function processInbox() {
  logHead('── Inkorgsbehandling ──');
  const allTickets = await fetchInbox();

  // Hitta simulerade ärenden (sim_-prefix) eller med fake-epost
  const simTickets = allTickets.filter(t =>
    t.conversation_id?.startsWith('sim_') ||
    FAKE_EMAILS.includes(t.contact_email)
  );

  if (simTickets.length === 0) {
    logInfo(`Inga simulerade ärenden i inkorg (${allTickets.length} totalt)`);
    return;
  }

  logInfo(`Hanterar ${simTickets.length} simulerade ärenden...`);

  // Max 5 per runda för att inte överbelasta
  for (const ticket of simTickets.slice(0, 5)) {
    const convId = ticket.conversation_id;
    const action  = Math.random();

    if (action < 0.3) {
      // 30%: Plocka → Svara → Arkivera (fullt flöde)
      if (await claimTicket(convId)) {
        await sleep(400);
        await replyToTicket(convId);
        await sleep(400);
        await archiveTicket(convId);
      }
    } else if (action < 0.55) {
      // 25%: Plocka → Svara (öppet)
      if (await claimTicket(convId)) {
        await sleep(400);
        await replyToTicket(convId);
      }
    } else if (action < 0.70) {
      // 15%: Bara arkivera
      await archiveTicket(convId);
    }
    // 30%: Lämna i inkorg (obehandlat — testar att listan inte växer okontrollerat)

    await sleep(randInt(300, 800));
  }
}

// ============================================================
// LOGGNING TILL FIL
// ============================================================

const LOG_DIR      = path.join(__dirname, '..', 'logs');
const TEST_FILE    = path.join(__dirname, '..', '..', 'exports', 'test-fil-chatt.png');
let   uploadCount  = 0;

function saveLog() {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

    const now    = new Date();
    const stamp  = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const file   = path.join(LOG_DIR, `sim-${stamp}.json`);

    const grouped = {};
    ragFailures.forEach(f => {
      const key = f.question.substring(0, 80);
      if (!grouped[key]) grouped[key] = { count: 0, city: f.city, answers: [] };
      grouped[key].count++;
      if (grouped[key].answers.length < 3) grouped[key].answers.push(f.answer.substring(0, 200));
    });

    const report = {
      genererad:        now.toISOString(),
      server:           SERVER_URL,
      batchar:          batchNum,
      chattsessioner:   sessionCount,
      formularärenden:  formCount,
      filuppladdningar: uploadCount,
      rag_fel_totalt:   ragFailures.length,
      rag_fel:          Object.entries(grouped)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([fråga, { count, city, answers }]) => ({ fråga, antal: count, stad: city, exempelsvar: answers })),
      alla_fel:         ragFailures,
    };

    fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n${C.green}📁 Logg sparad: ${file}${C.reset}`);
  } catch (err) {
    console.error(`Kunde inte spara logg: ${err.message}`);
  }
}

// ============================================================
// RAPPORT (terminal)
// ============================================================

function printReport() {
  const divider = '═'.repeat(50);
  console.log(`\n${C.bright}${C.yellow}${divider}${C.reset}`);
  console.log(`${C.bright}  📊 ATLAS SIMULATOR — RAPPORT${C.reset}`);
  console.log(`${C.bright}${C.yellow}${divider}${C.reset}`);
  console.log(`  Totala chattsessioner:  ${C.white}${sessionCount}${C.reset}`);
  console.log(`  Formulärärenden:        ${C.white}${formCount}${C.reset} (inkl. centralsupport)`);
  console.log(`  Filuppladdningar:       ${C.white}${uploadCount}${C.reset}`);
  console.log(`  Körda batcher:          ${C.white}${batchNum}${C.reset}`);
  console.log(`  RAG-fel totalt:         ${ragFailures.length > 0 ? C.red : C.green}${ragFailures.length}${C.reset}`);

  if (ragFailures.length > 0) {
    const grouped = {};
    ragFailures.forEach(f => {
      const key = f.question.substring(0, 70);
      if (!grouped[key]) grouped[key] = { count: 0, city: f.city, sample: f.answer };
      grouped[key].count++;
    });

    console.log(`\n${C.bright}  Frågor som RAG inte kunde besvara:${C.reset}`);
    Object.entries(grouped)
      .sort(([, a], [, b]) => b.count - a.count)
      .forEach(([q, { count, city, sample }]) => {
        console.log(`  ${C.red}• [${count}x]${C.reset} "${q}"`);
        if (city) console.log(`    ${C.gray}Stad: ${city}${C.reset}`);
        console.log(`    ${C.gray}Svar: "${sample.substring(0, 100)}"${C.reset}`);
      });
  }

  console.log(`${C.bright}${C.yellow}${divider}${C.reset}\n`);
}

// ============================================================
// KÖR EN SIMULERINGSRUNDA
// ============================================================

async function runBatch() {
  batchNum++;
  const size = randInt(BATCH_MIN, BATCH_MAX);
  logHead(`══ BATCH #${batchNum} — ${size} sessioner [${new Date().toLocaleTimeString('sv-SE')}] ══`);

  for (let i = 0; i < size; i++) {
    // 20% av sessionerna går till centralsupport (ingen kontors-match)
    // Speglar kundwidgetens logik: om ingen kontors-match → centralsupport
    const toCentral = Math.random() < 0.20;
    const office    = toCentral ? null : (offices.length > 0 ? randItem(offices) : null);
    const isForm    = Math.random() < 0.35; // 35% formulär, 65% chatt

    if (isForm) {
      await simulateForm(office); // null → agent_id='centralsupport'
    } else {
      await simulateChat(office); // null → ingen locked_context → centralsupport
    }

    // Realistisk paus mellan sessioner
    await sleep(randInt(2000, 5000));
  }

  // Extra: alltid minst 1 explicit centralsupport-formulär per batch
  logInfo('Skickar explicit centralsupport-formulär...');
  await simulateForm(null);
  await sleep(1500);

  // Filuppladdning — testar var 2:a batch (chatt en gång, formulär nästa)
  if (batchNum % 2 === 1) {
    await simulateFileUploadChat();
  } else {
    await simulateFileUploadForm();
  }
  await sleep(1500);

  // Hantera inkorg efter batch
  await sleep(2000);
  await processInbox();
}

// ============================================================
// HUVUD-LOOP
// ============================================================

async function main() {
  console.log(`\n${C.bright}${C.green}╔══════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bright}${C.green}║   🚗  Atlas Test Simulator — Startad         ║${C.reset}`);
  console.log(`${C.bright}${C.green}╚══════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.gray}  Server:   ${SERVER_URL}${C.reset}`);
  console.log(`${C.gray}  Admin:    ${ADMIN_USER}${C.reset}`);
  console.log(`${C.gray}  Intervall: ${INTERVAL_MS / 60000} minuter${C.reset}`);
  console.log(`${C.gray}  Batch:    ${BATCH_MIN}–${BATCH_MAX} sessioner${C.reset}`);
  console.log(`${C.gray}  Stopp:    Ctrl+C (skriver rapport)${C.reset}\n`);

  // Vid Ctrl+C — skriv rapport + spara loggfil och avsluta
  process.on('SIGINT', () => {
    console.log('\n');
    printReport();
    saveLog();
    process.exit(0);
  });

  // Periodisk rapport + logg varje timme
  setInterval(() => {
    if (sessionCount > 0 || ragFailures.length > 0) {
      printReport();
      saveLog();
    }
  }, 60 * 60 * 1000);

  // 1. Logga in som admin
  const ok = await login();
  if (!ok) {
    logErr('Kan inte starta utan inloggning.');
    logErr('Ange env-variablar: ADMIN_USER=admin ADMIN_PASS=dittlösenord node test-simulator.js');
    process.exit(1);
  }

  // 2. Hämta kontor
  await fetchOffices();

  // 3. Kör första batch direkt
  await runBatch();

  // 4. Kör kunskapsbas-test
  await sleep(3000);
  await testKnowledgeBase();

  // 5. Schemalägg upprepade batcher
  console.log(`\n${C.gray}⏰  Nästa batch om ${INTERVAL_MS / 60000} minuter...${C.reset}\n`);

  setInterval(async () => {
    // Förnya token var 6:e batch (säkrar mot utgången JWT)
    if (batchNum % 6 === 0) {
      logInfo('Förnyar JWT-token...');
      await login();
    }

    await runBatch();

    // Kunskapsbas-test var 3:e batch
    if (batchNum % 3 === 0) {
      await sleep(3000);
      await testKnowledgeBase();
    }

    console.log(`\n${C.gray}⏰  Nästa batch om ${INTERVAL_MS / 60000} minuter...${C.reset}\n`);
  }, INTERVAL_MS);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
