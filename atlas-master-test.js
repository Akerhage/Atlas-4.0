/**
* @file validate_atlas.js
* @description Testar exakta snabbval från TSX-filerna via din ngrok-url.
*/
const axios = require('axios');

const BASE_URL = 'https://uncongestive-roberta-unsurely.ngrok-free.dev';
const MY_EMAIL = 'patrik_akerhage@hotmail.com';

// Exakta kategorier och frågor från dina inskickade filer
const TEST_DATA = [
{
office: "Mårtenssons Trafikskola – Kristianstad",
tag: "kristianstad",
area: null, // Testar "ensamt kontor"-logiken
vehicle: "AM",
questions: [
"Hur gammal måste man vara för att börja AM-kursen?",
"Vad kostar AM-kursen och vad ingår i priset?"
]
},
{
office: "My Driving Academy - Göteborg – Ullevi",
tag: "goteborg_ullevi",
area: "Ullevi", // Testar area-routing
vehicle: "MC",
questions: [
"Vilka körkortsutbildningar erbjuder ni i {{stad}}?",
"Lånar ni ut utrustning (hjälm/ställ) under MC-lektionerna?"
]
}
];

async function runTest() {
console.log(`🚀 Startar validering mot: ${BASE_URL}`);

for (const sc of TEST_DATA) {
console.log(`\n🏢 Kontor: ${sc.office}`);

for (const q of sc.questions) {
const formattedQuestion = q.replace('{{stad}}', sc.office);

try {
// Skapa ärende via formuläret för att sätta alla flaggor korrekt (snygg data)
const res = await axios.post(`${BASE_URL}/api/customer/form`, {
name: "System Validator",
email: MY_EMAIL,
message: formattedQuestion,
city: sc.office,
area: sc.area,
vehicle: sc.vehicle
});

const convId = res.data.conversationId;
console.log(`   ✅ Skapat: "${formattedQuestion.substring(0, 30)}..." (ID: ${convId})`);

// Utför Agent-Actions för att testa knappar/flöde
// 1. Claim (Ta ärendet)
await axios.post(`${BASE_URL}/api/team/claim`, { conversationId: convId }, { headers: { 'user-id': 'patrik' } });

// 2. Reply (Agent-svar)
await axios.post(`${BASE_URL}/api/team/reply`, {
conversationId: convId,
message: "Automatiskt valideringssvar: Allt fungerar!",
role: 'agent'
}, { headers: { 'user-id': 'patrik' } });

// 3. Archive (Städa bort från aktiva listan)
await axios.post(`${BASE_URL}/api/inbox/archive`, { conversationId: convId });
console.log(`      📦 Flöde klart & Arkiverat.`);

} catch (err) {
console.error(`   ❌ Fel: ${err.message}`);
}
}
}
console.log("\n🏁 Testet är klart. Kontrollera Arkivet i Atlas.");
}

runTest();