/**
* @file seed_test_tickets.js
* @description Skapar 4 testärenden direkt mot Atlas-servern via HTTP.
*
* Skapar:
*   1. Mail-ärende → Centralsupport (office: 'admin')
*   2. Mail-ärende → Högsbo (office: 'goteborg_hogsbo')
*   3. Livechatt → eskaleras till Centralsupport (office: 'admin')
*   4. Livechatt → eskaleras till Högsbo (office: 'goteborg_hogsbo')
*
* Alla ärenden skapas med owner = NULL så de hamnar i Inkorgen som "Oplockat".
*
* @usage node tests/scripts/seed_test_tickets.js
*/

'use strict';
const http = require('http');

const SERVER = 'http://localhost:3001';

// ─── HJÄLPARE ─────────────────────────────────────────────────────────────────
function post(path, body) {
return new Promise((resolve, reject) => {
const data = JSON.stringify(body);
const url  = new URL(path, SERVER);
const opts = {
hostname: url.hostname,
port:     url.port || 3001,
path:     url.pathname,
method:   'POST',
headers:  {
'Content-Type':   'application/json',
'Content-Length': Buffer.byteLength(data),
},
};
const req = http.request(opts, res => {
let raw = '';
res.on('data', chunk => raw += chunk);
res.on('end', () => {
try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
catch { resolve({ status: res.statusCode, body: raw }); }
});
});
req.on('error', reject);
req.write(data);
req.end();
});
}

function sleep(ms) {
return new Promise(r => setTimeout(r, ms));
}

const sep = (msg) => console.log(`\n${'─'.repeat(60)}\n${msg}\n${'─'.repeat(60)}`);
const ok  = (msg) => console.log(`  ✅ ${msg}`);
const err = (msg) => console.log(`  ❌ ${msg}`);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
console.log('\n══════════════════════════════════════════════════════════════');
console.log('   🌱 ATLAS SEED — 4 testärenden');
console.log('══════════════════════════════════════════════════════════════');
console.log(`   Server: ${SERVER}`);

// ══════════════════════════════════════════════════════════════════════════
// 1. MAIL-ÄRENDE → CENTRALSUPPORT
// Simulerar ett formulär-inlämning utan kontor (fallback → office: admin)
// ══════════════════════════════════════════════════════════════════════════
sep('📧 1) Mail-ärende → Centralsupport');
try {
const r = await post('/api/customer/message-form', {
name:    'Anna Testsson',
email:   'anna.test@example.com',
phone:   '0701234567',
subject: 'Fråga om körkort',
message: 'Hej! Jag undrar hur lång tid det tar att ta körkort om man börjar från noll. Vänliga hälsningar, Anna',
// Inget city/area/agent_id → hamnar hos admin (centralsupport)
});
if (r.status === 200 && r.body.success) {
ok(`Skapat! Session-ID: ${r.body.sessionId}`);
ok('office = admin (centralsupport), owner = NULL');
} else {
err(`Misslyckades: ${JSON.stringify(r.body)}`);
}
} catch (e) {
err(`Fel: ${e.message}`);
}

await sleep(300);

// ══════════════════════════════════════════════════════════════════════════
// 2. MAIL-ÄRENDE → HÖGSBO
// Skickar agent_id = routing_tag för Högsbo direkt i body
// (Samma sätt som kundchatten skickar när kund valt kontor)
// ══════════════════════════════════════════════════════════════════════════
sep('📧 2) Mail-ärende → Högsbo');
try {
const r = await post('/api/customer/message-form', {
name:    'Björn Testberg',
email:   'bjorn.test@example.com',
phone:   '0709876543',
subject: 'Boka uppkörning',
message: 'Hej! Jag skulle vilja boka uppkörning på ert kontor i Högsbo. Vilka tider finns lediga i mars?',
city:    'Göteborg',
area:    'Högsbo',
// agent_id sätter office direkt — matchar routingTag-logiken i server.js
agent_id: 'goteborg_hogsbo',
});
if (r.status === 200 && r.body.success) {
ok(`Skapat! Session-ID: ${r.body.sessionId}`);
ok('office = goteborg_hogsbo, owner = NULL');
} else {
err(`Misslyckades: ${JSON.stringify(r.body)}`);
}
} catch (e) {
err(`Fel: ${e.message}`);
}

await sleep(300);

// ══════════════════════════════════════════════════════════════════════════
// 3. LIVECHATT → ESKALERAS TILL CENTRALSUPPORT
// Steg 1: Skicka ett meddelande som AI svarar på (skapar session)
// Steg 2: Skicka ett andra meddelande med locked_context som triggar
//         human_mode utan kontor → office = admin
// ══════════════════════════════════════════════════════════════════════════
sep('💬 3) Livechatt → Centralsupport');
try {
// Generera ett session-ID precis som kundchatten gör
const sessionId = `session_${Date.now()}_seed_central`;

// Första meddelandet — triggar human mode med city = null → admin
const r = await post('/api/customer/message', {
sessionId,
message: 'Hej! Jag vill prata med en handledare om teoriprov.',
context: {
locked_context: {
city:     null,
area:     null,
vehicle:  'Bil',
agent_id: null,
// Inget kontor valt → fallback till admin
}
}
});

if (r.status === 200) {
ok(`Meddelande skickat! Session-ID: ${sessionId}`);

// Vänta lite och kolla om human_mode triggades
await sleep(500);

// Skicka ett uppföljningsmeddelande för att säkerställa att
// ärendet syns i inkorgen med innehåll
await post('/api/customer/message', {
sessionId,
message: 'Är någon tillgänglig nu?',
});

ok('office = admin (centralsupport), owner = NULL');
ok(`Session: ${sessionId}`);
} else {
err(`Misslyckades: ${JSON.stringify(r.body)}`);
}
} catch (e) {
err(`Fel: ${e.message}`);
}

await sleep(300);

// ══════════════════════════════════════════════════════════════════════════
// 4. LIVECHATT → ESKALERAS TILL HÖGSBO
// Samma flöde men med agent_id = goteborg_hogsbo i locked_context
// ══════════════════════════════════════════════════════════════════════════
sep('💬 4) Livechatt → Högsbo');
try {
const sessionId = `session_${Date.now()}_seed_hogsbo`;

const r = await post('/api/customer/message', {
sessionId,
message: 'Hej! Jag undrar om ni har lediga tider för körlektion.',
context: {
locked_context: {
city:     'Göteborg',
area:     'Högsbo',
vehicle:  'Bil',
agent_id: 'goteborg_hogsbo', // Pekar direkt på Högsbo
}
}
});

if (r.status === 200) {
ok(`Meddelande skickat! Session-ID: ${sessionId}`);

await sleep(500);

await post('/api/customer/message', {
sessionId,
message: 'Kan någon kontakta mig?',
});

ok('office = goteborg_hogsbo, owner = NULL');
ok(`Session: ${sessionId}`);
} else {
err(`Misslyckades: ${JSON.stringify(r.body)}`);
}
} catch (e) {
err(`Fel: ${e.message}`);
}

// ─── SAMMANFATTNING ───────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('   Klar! Kontrollera nu inkorgen som dessa användare:');
console.log('');
console.log('   Centralsupport-ärenden (mail + chatt):');
console.log('   → Logga in som @admin eller @patrik (har routing_tag "all")');
console.log('');
console.log('   Högsbo-ärenden (mail + chatt):');
console.log('   → Logga in som @ida eller @rebecka (har goteborg_hogsbo)');
console.log('');
console.log('   Förväntat: Ärenden visas i Inkorg → rätt korg per kontor');
console.log('   Om fix fungerar: Ida ser Högsbo-ärendena, inte admin-ärendena');
console.log('══════════════════════════════════════════════════════════════\n');
}

run().catch(e => {
console.error('\n🔴 Oväntat fel:', e.message);
process.exit(1);
});