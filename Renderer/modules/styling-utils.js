// ============================================
// modules/styling-utils.js
// VAD DEN GÖR: Hjälpfunktioner för färger,
//              labels, namn och notifieringar
// ANVÄNDS AV: renderer.js + alla vyer
// ============================================

// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║     KRITISK VARNING — NAVET I ATLAS FÄRGSYSTEM              ║
// ⚠️  ║     LÄS HELA DETTA BLOCK INNAN DU ÄNDRAR NÅGOT              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  getAgentStyles(tag) är DEN ENDA funktionen som får         ║
// ⚠️  ║  producera färgobjekt i Atlas. Alla vyer (Inkorg,           ║
// ⚠️  ║  Mina Ärenden, Arkiv, Admin, Detaljvyer) anropar            ║
// ⚠️  ║  denna funktion — de skapar INTE egna hex-värden.           ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  PRIORITETSORDNING FÖR FÄRGHÄMTNING (ÄNDRA INTE):          ║
// ⚠️  ║                                                              ║
// ⚠️  ║    1. officeData[]  → office_color  (kontorets färg)        ║
// ⚠️  ║       Nyckel: routing_tag (t.ex. "goteborg_ullevi")         ║
// ⚠️  ║    2. usersCache[]  → agent_color   (agentens färg)         ║
// ⚠️  ║    3. currentUser   → agent_color   (inloggad agent)        ║
// ⚠️  ║    4. '#0071e3'     → blå fallback  (alltid sist)           ║
// ⚠️  ║                                                              ║
// ⚠️  ║  Ordningen är AVSIKTLIG: kontorets färg slår alltid         ║
// ⚠️  ║  agentens. Ett ärende färgas efter var det hör hemma,       ║
// ⚠️  ║  inte efter vem som tagit det.                              ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  UTDATA-OBJEKTETS NYCKLAR (ÄNDRA INTE NAMNEN):             ║
// ⚠️  ║                                                              ║
// ⚠️  ║   { main, bg, tagBg, bubbleBg, border }                    ║
// ⚠️  ║                                                              ║
// ⚠️  ║   main     — ren hex,         t.ex. '#926b16'              ║
// ⚠️  ║   bg       — 8%  opacity rgba  (kortbakgrunder)             ║
// ⚠️  ║   tagBg    — 20% opacity rgba  (pill-bakgrunder)            ║
// ⚠️  ║   bubbleBg — 12% opacity rgba  (avatarbubblor)              ║
// ⚠️  ║   border   — 30% opacity rgba  (kantlinjer)                 ║
// ⚠️  ║                                                              ║
// ⚠️  ║  detail-ui.js, inbox-view.js, tickets-view.js och          ║
// ⚠️  ║  archive-view.js förväntar sig exakt dessa nycklar.         ║
// ⚠️  ║  Byter du namn → tyst fel, ingen färg visas.               ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  SPECIALFALL SOM MÅSTE FINNAS KVAR:                        ║
// ⚠️  ║                                                              ║
// ⚠️  ║  • 'unclaimed' → röd (#ff4444). Signalerar oplockat        ║
// ⚠️  ║    ärende. Används som visuell varning i UI.                ║
// ⚠️  ║                                                              ║
// ⚠️  ║  • resolveLabel(): 'CITY'-specialfallet (M-CITY/S-CITY)    ║
// ⚠️  ║    och 'VÄSTRA '-förkortningen är AVSIKTLIGA p.g.a.        ║
// ⚠️  ║    platsbrist i ärendekort för Malmö/Stockholm.             ║
// ⚠️  ║                                                              ║
// ⚠️  ║  • hexToRgba() är inlinead inuti getAgentStyles() —        ║
// ⚠️  ║    den är inte global. Flytta den inte ut.                  ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  FILER SOM BEROR PÅ DENNA (KONTROLLERA ALLA VID ÄNDRING):  ║
// ⚠️  ║   detail-ui.js     → styles.main / .bg / .border           ║
// ⚠️  ║   admin-offices.js → office_color via officeData[]          ║
// ⚠️  ║   admin-agents.js  → agent_color via usersCache[]           ║
// ⚠️  ║   modals.js        → agent_color direkt (ej via funk.)      ║
// ⚠️  ║   inbox-view.js    → getAgentStyles(routing_tag)            ║
// ⚠️  ║   tickets-view.js  → getAgentStyles(owner)                  ║
// ⚠️  ║   archive-view.js  → getAgentStyles(routing_tag)            ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝

// ⚠️ LOCK — resolveLabel(tag)
// Matchar routing_tag mot officeData[] och returnerar ett kort visningsnamn.
// ❌ ÄNDRA INTE: 'CITY'-specialfallet → M-CITY / S-CITY (platsbrist i ärendekort)
// ❌ ÄNDRA INTE: 'VÄSTRA '-förkortningen → V-Hamnen etc. (samma skäl)
// ❌ ÄNDRA INTE: tag.toLowerCase() — routing_tags är alltid lowercase i DB.
function resolveLabel(tag) {
const office = officeData.find(o => o.routing_tag === (tag ? tag.toLowerCase() : tag));
if (!office) return tag ? tag.toUpperCase() : "ÄRENDE";

const city = office.city || "";
const area = office.area || "";

// 1. Hantera City-specialfall (Malmö/Stockholm)
if (area.toUpperCase() === 'CITY') {
if (city.toUpperCase().includes('MALMÖ')) return 'M-CITY';
if (city.toUpperCase().includes('STOCKHOLM')) return 'S-CITY';
}

// 2. Förkorta långa namn (t.ex. Västra Hamnen -> V-Hamnen)
let finalLabel = area || city;
if (finalLabel.toUpperCase().startsWith('VÄSTRA ')) {
finalLabel = 'V-' + finalLabel.substring(7);
}

return finalLabel.toUpperCase();
}


// Kompakt ersättare för formatName
function formatName(tag) {
const office = officeData.find(o => o.routing_tag === (tag ? tag.toLowerCase() : tag));
if (office) return office.name;
return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : "";
}

// Kompakt ersättare för getCityFromOwner
function getCityFromOwner(tag) {
const office = officeData.find(o => o.routing_tag === (tag ? tag.toLowerCase() : tag));
return office ? office.city : "Support";
}

// ⚠️ LOCK — getAgentStyles(tag): ENDA källan till färgobjekt i Atlas.
// ❌ ÄNDRA INTE: prioritetsordningen office → usersCache → currentUser → fallback.
// ❌ ÄNDRA INTE: nyckelnamnen main/bg/tagBg/bubbleBg/border — alla vyer beror på dem.
// ❌ ÄNDRA INTE: 'unclaimed'-specialfallet — röd färg är en avsiktlig varningssignal.
// ❌ ÄNDRA INTE: hex-valideringen (startsWith('#')) — skyddar mot undefined/null-krasch.
// ❌ FLYTTA INTE: hexToRgba() — den är avsiktligt inlinead, inte global.
function getAgentStyles(tag) {
const fallbackHex = '#b8955a'; // Dämpad guld — visas när inget kontor/agent-matchning finns
const fallback = { main: fallbackHex, bg: 'rgba(184, 149, 90, 0.08)', border: 'rgba(184, 149, 90, 0.3)', bubbleBg: 'rgba(184, 149, 90, 0.12)' };

if (!tag || tag.toLowerCase() === 'unclaimed') return { ...fallback, main: '#ff4444', bg: 'rgba(255, 68, 68, 0.08)' };

// 1. Hämta färg (Prioritet: SQL-kontor -> Användarprofil -> usersCache -> Fallback)
const office = officeData.find(o => o.routing_tag === tag.toLowerCase());
let hex = fallbackHex;
if (office) {
hex = office.office_color;
} else {
const u = usersCache.find(u => u.username === tag);
// Fallback-kedja: cache → currentUser (synkront vid omstart) → blå standard
hex = u?.agent_color
|| (tag === currentUser?.username ? (currentUser?.agent_color || fallbackHex) : fallbackHex);
}

// Säkerställ att hex är en sträng och börjar med #
if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) hex = fallbackHex;

const hexToRgba = (h, a) => {
try {
let r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
return `rgba(${r}, ${g}, ${b}, ${a})`;
} catch(e) { return `rgba(0, 113, 227, ${a})`; }
};

return {
main: hex,
bg: hexToRgba(hex, 0.08),
tagBg: hexToRgba(hex, 0.2),
bubbleBg: hexToRgba(hex, 0.12),
border: hexToRgba(hex, 0.3)
};
}

// Visa toast-notifiering
function showToast(message, duration = 3000) {
let container = document.getElementById('atlas-toast-container');
if (!container) {
  container = document.createElement('div');
  container.id = 'atlas-toast-container';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column-reverse;gap:6px;z-index:10000;pointer-events:none;';
  document.body.appendChild(container);
}
const toast = document.createElement('div');
toast.className = 'toast-notification';
toast.innerHTML = message;
toast.style.cssText = `
background: rgba(20, 20, 30, 0.95);
color: #fff;
padding: 12px 20px;
border-radius: 8px;
border: 1px solid rgba(255, 255, 255, 0.2);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
animation: slideIn 0.3s ease;
font-size: 14px;
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
pointer-events: auto;
white-space: nowrap;
`;
container.appendChild(toast);
setTimeout(() => {
  toast.style.animation = 'slideOut 0.3s ease';
  setTimeout(() => toast.remove(), 300);
}, duration);
}

function stripHtml(html) {
if (!html) return "";
// Skapa ett temporärt element för att extrahera ren text
const tmp = document.createElement("DIV");
tmp.innerHTML = html;
let text = tmp.textContent || tmp.innerText || "";
// Kapa texten om den är för lång (så slipper CSS jobba ihjäl sig)
return text.length > 60 ? text.substring(0, 60) + "..." : text;
}