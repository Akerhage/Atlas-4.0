// ============================================
// routes/knowledge.js — Kunskapsdatabas
// VAD DEN GÖR: Läser och uppdaterar kontors-JSON-filer
//              för RAG-motorn. PUT triggar hot-reload.
// ANVÄNDS AV: server.js via app.use('/api', knowledgeRoutes)
// SENAST STÄDAD: 2026-02-27
// ============================================
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { db } = require('../db');
const { loadKnowledgeBase } = require('../legacy_engine');
const authenticateToken = require('../middleware/auth');

const isPackaged = process.env.IS_PACKAGED === 'true';

// =============================================================================
// GET KNOWLEDGE DATA (Hybrid: File System + DB Fallback)
// =============================================================================
router.get('/knowledge/:routingTag', authenticateToken, async (req, res) => {
const { routingTag } = req.params;

// 1. Försök ladda från fil (Rikare innehåll)
const knowledgePath = isPackaged
? path.join(process.resourcesPath, 'knowledge')
: path.join(__dirname, '..', 'knowledge');
const filePath = path.join(knowledgePath, `${routingTag}.json`);

if (fs.existsSync(filePath)) {
try {
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
return res.json(data);
} catch (e) {
console.error(`Error parsing knowledge file for ${routingTag}:`, e);
}
}

// 2. Fallback till Databasen (Om filen saknas)
try {
const office = await new Promise((resolve, reject) => {
db.get("SELECT * FROM offices WHERE routing_tag = ?", [routingTag], (err, row) => {
if (err) reject(err); else resolve(row);
});
});

if (office) {
// Bygg ett "fake" knowledge-objekt från DB-datan så frontend blir glad
const fallbackData = {
id: routingTag,
city: office.city,
area: office.area,
office_color: office.office_color,
contact: {
phone: office.phone,
email: office.email,
address: office.address
},
description: "Information hämtad från databasen (Ingen JSON-fil hittades).",
prices: [], // Tom lista som fallback
services_offered: []
};
return res.json(fallbackData);
} else {
return res.status(404).json({ error: "Kontoret hittades varken i DB eller som fil" });
}
} catch (err) {
return res.status(500).json({ error: "Databasfel vid hämtning av kontor" });
}
});

// 2. Uppdatera data (Totalbesiktigad - Idiotsäker & RAG-synkad)
router.put('/knowledge/:routingTag', authenticateToken, async (req, res) => {
if (req.user.role !== 'admin' && req.user.role !== 'support') {
return res.status(403).json({ error: "Access denied" });
}

const routingTag = req.params.routingTag;
const updates = req.body;

const knowledgePath = isPackaged
? path.join(process.resourcesPath, 'knowledge')
: path.join(__dirname, '..', 'knowledge');
const filePath = path.join(knowledgePath, `${routingTag}.json`);

if (!fs.existsSync(filePath)) {
return res.status(404).json({ error: "Knowledge file not found" });
}

try {
// Läs originalfilen för att bevara den fasta strukturen (id, keywords, etc.)
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// --- A. TOPPNIVÅ (TEXT & IDENTITET) ---
if (updates.description) data.description = updates.description;
if (updates.brand) data.brand = updates.brand;
if (updates.office_color) data.office_color = updates.office_color;

// Uppdatera namn om brand, stad eller område ändras (valfritt men rekommenderat)
data.name = `${data.brand} - ${data.city} ${data.area || ''}`.trim();

// --- B. KONTAKTUPPGIFTER & KOORDINATER (DJUP MERGE) ---
if (updates.contact) {
data.contact = {
...data.contact,
...updates.contact,
// Säkra att coordinates inte skrivs över av misstag om de saknas i updates
coordinates: updates.contact.coordinates ? {
...data.contact.coordinates,
...updates.contact.coordinates
} : data.contact.coordinates
};
}

// --- C. BOKNINGSLÄNKAR (CAR, MC, AM, PORTAL ETC.) ---
if (updates.booking_links) {
data.booking_links = {
...data.booking_links,
...updates.booking_links
};
}

// --- D. LISTOR & MATRISER (Hela listor ersätts) ---
if (updates.opening_hours) data.opening_hours = updates.opening_hours;
if (updates.languages) data.languages = updates.languages;
if (updates.services_offered) data.services_offered = updates.services_offered;

// --- E. PRISUPPDATERING (KOMPLETT ERSÄTTNING — stöder radering av rader) ---
if (updates.prices && Array.isArray(updates.prices)) {
data.prices = updates.prices;

// Dedup-synk av services_offered: baserat på keywords hos kvarvarande priser
const activeServices = new Set();
data.prices.forEach(p => {
const kw = p.keywords || [];
if (kw.some(k => k === 'bil')) activeServices.add('Bil');
if (kw.some(k => k === 'mc' || k === 'motorcykel')) activeServices.add('MC');
if (kw.some(k => k === 'am' || k === 'moped')) activeServices.add('AM');
});
// Bevara bara de tjänster som faktiskt har kvarvarande priser
data.services_offered = (data.services_offered || []).filter(s => activeServices.has(s));

// Städa booking_links för borttagna tjänster
if (data.booking_links) {
if (!activeServices.has('Bil')) data.booking_links.CAR = null;
if (!activeServices.has('MC')) data.booking_links.MC = null;
if (!activeServices.has('AM')) data.booking_links.AM = null;
}
}

// --- F. 🧠 GLOBAL SMART KEYWORD LOGIC (FÖR RAG-MOTORN) ---
// Detta garanterar att sökbarheten alltid är intakt efter en editering.
const city = data.city.toLowerCase();
const area = (data.area || "").toLowerCase();

const syncKeywords = (targetArr) => {
if (!Array.isArray(targetArr)) targetArr = [];
if (!targetArr.includes(city)) targetArr.push(city);
if (area && !targetArr.includes(area)) targetArr.push(area);
// Lägg även till brand-namnet som sökord (t.ex. "mårtenssons")
const brandKey = data.brand.toLowerCase().split(' ')[0];
if (!targetArr.includes(brandKey)) targetArr.push(brandKey);
return targetArr;
};

// Kör synk på alla nivåer där sökord finns
data.keywords = syncKeywords(data.keywords);
if (data.prices) data.prices.forEach(p => p.keywords = syncKeywords(p.keywords));
if (data.services) data.services.forEach(s => s.keywords = syncKeywords(s.keywords));

// --- G. AI-VALIDERING (Tillägg D) ---
try {
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const validation = await openai.chat.completions.create({
model: 'gpt-4o-mini',
messages: [
{ role: 'system', content: 'Du är en JSON-validerare för ett trafikskoleföretags kontorsdatabas. Kontrollera att JSON-strukturen är intakt och att kontaktuppgifter/priser är rimliga. Svara BARA "OK" om allt är godkänt, annars en kort förklaring på svenska.' },
{ role: 'user', content: `Kontor: ${routingTag}\nData:\n${JSON.stringify(data, null, 2)}` }
],
max_tokens: 200,
temperature: 0
});
const aiReply = validation.choices[0]?.message?.content?.trim() || 'OK';
if (!aiReply.startsWith('OK')) {
return res.status(422).json({ error: 'AI-validering nekade sparning.', aiMessage: aiReply });
}
} catch (aiErr) {
console.warn(`[KNOWLEDGE-PUT] AI-validering misslyckades, fortsätter ändå:`, aiErr.message);
}

// --- H. SKRIV TILL DISK ---
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

// --- I. SYNKA FÄRG TILL SQL (så preloadOffices/ärendekort får rätt färg direkt) ---
if (updates.office_color) {
await new Promise((resolve, reject) => {
db.run(
'UPDATE offices SET office_color = ? WHERE routing_tag = ?',
[updates.office_color, routingTag],
(err) => err ? reject(err) : resolve()
);
});
console.log(`🎨 [ADMIN-UPDATE] office_color synkad till SQL för ${routingTag}: ${updates.office_color}`);
}

console.log(`✅ [ADMIN-UPDATE] ${routingTag}.json sparad och SEO-säkrad.`);

// 🔄 HOT-RELOAD AV RAG-MOTORN FÖR KONTORSFILER
try {
loadKnowledgeBase();
console.log(`🔄 [RAG] Kunskapsdatabasen omladdad efter att kontoret uppdaterats!`);
} catch(e) {
console.error(`⚠️ [RAG] Kunde inte ladda om databasen:`, e);
}

res.json({ success: true, message: "Kontoret uppdaterat utan att skada RAG-strukturen." });

} catch (err) {
console.error(`❌ [PUT ERROR] ${routingTag}:`, err);
res.status(500).json({ error: "Kunde inte spara ändringar i filen." });
}
});

module.exports = router;
