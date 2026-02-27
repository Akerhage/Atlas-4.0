// ============================================
// modules/styling-utils.js
// VAD DEN GÖR: Hjälpfunktioner för färger,
//              labels, namn och notifieringar
// ANVÄNDS AV: renderer.js + alla vyer
// ============================================

// Kompakt ersättare för resolveLabel
function resolveLabel(tag) {
const office = officeData.find(o => o.routing_tag === tag);
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
const office = officeData.find(o => o.routing_tag === tag);
if (office) return office.name;
return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : "";
}

// Kompakt ersättare för getCityFromOwner
function getCityFromOwner(tag) {
const office = officeData.find(o => o.routing_tag === tag);
return office ? office.city : "Support";
}

function getAgentStyles(tag) {
const fallbackHex = '#0071e3';
const fallback = { main: fallbackHex, bg: 'rgba(0, 113, 227, 0.08)', border: 'rgba(0, 113, 227, 0.3)', bubbleBg: 'rgba(0, 113, 227, 0.12)' };

if (!tag || tag.toLowerCase() === 'unclaimed') return { ...fallback, main: '#ff4444', bg: 'rgba(255, 68, 68, 0.08)' };

// 1. Hämta färg (Prioritet: SQL-kontor -> Användarprofil -> usersCache -> Fallback)
const office = officeData.find(o => o.routing_tag === tag.toLowerCase());
let hex = fallbackHex;
if (office) {
hex = office.office_color;
} else {
const u = usersCache.find(u => u.username === tag);
hex = u?.agent_color || (tag === currentUser?.username ? currentUser.agent_color : fallbackHex);
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
// Skapa toast-element
const toast = document.createElement('div');
toast.className = 'toast-notification';
toast.textContent = message;
toast.style.cssText = `
position: fixed;
bottom: 20px;
right: 20px;
background: rgba(20, 20, 30, 0.95);
color: #fff;
padding: 12px 20px;
border-radius: 8px;
border: 1px solid rgba(255, 255, 255, 0.2);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
z-index: 10000;
animation: slideIn 0.3s ease;
font-size: 14px;
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

document.body.appendChild(toast);

// Automatisk borttagning
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
