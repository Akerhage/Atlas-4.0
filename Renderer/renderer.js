// ============================================
// renderer.js
// VAD DEN GÖR: All UI-logik för Atlas — chatt, inkorg, ärendehantering, mallar, arkiv, profil och inloggning.
// ANVÄNDS AV: index.html (Electron renderer process)
// SENAST STÄDAD: 2026-02-27
// ============================================
const ATLAS_VERSION = '3.14'; // Centralt versionsnummer — uppdatera ENDAST här
// 1. Bibliotek med 15 valbara SVG-avatarer
const AVATAR_ICONS = [
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>', // Person
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.37 12.9a5 5 0 1 1-6.6-6.6l.73.73a3 3 0 1 0 5.14 5.14l.73.73Z"></path><path d="M13 13 4 4"></path><path d="m18 10 3-3"></path></svg>', // Nyckel
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>', // Bil
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 21v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8"></path><path d="M21 21v-8a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v8"></path><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"></path><path d="M12 3v18"></path></svg>', // Kontor
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>', // Karta
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>', // Klocka
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>', // Telefon
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>', // Glob
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>', // Butik
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"></path><path d="m16 8-4 4-4-4"></path><path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"></path></svg>', // Stjärna
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>', // Check
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>', // Chattbubbla
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>', // Hjälp
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>', // Sköld
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>' // Glad gubbe
];

// Centralt bibliotek för alla UI-ikoner i Atlas
const UI_ICONS = {
// FORDON (14px)
CAR: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
BIKE: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 14-1-3"/><path d="m3 9 6 2a2 2 0 0 1 2-2h2a2 2 0 0 1 1.99 1.81"/><path d="M8 17h3a1 1 0 0 0 1-1 6 6 0 0 1 6-6 1 1 0 0 0 1-1v-.75A5 5 0 0 0 17 5"/><circle cx="19" cy="17" r="3"/><circle cx="5" cy="17" r="3"/></svg>`,
MOPED: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M7 15h.01"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/></svg>`,
TRUCK: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
TRAILER: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h14V7H3z"/><path d="M17 17h5"/><circle cx="7" cy="17" r="2"/><circle cx="13" cy="17" r="2"/><path d="M22 14v3"/></svg>`,

// KANALER
MAIL: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>`,
CHAT: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
LOCK: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,

// ÅTGÄRDER (18px)
ARCHIVE: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>`,
TRASH: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
RESTORE: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/></svg>`,
NOTES: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`,
CLAIM: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4"/><path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v15"/><path d="M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0"/></svg>`,
ASSIGN: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>`,
TAKE_OVER: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
SEND: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg>`,
AI: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>`,
CALENDAR: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
CITY_SMALL: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
AGENT_SMALL: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
PHONE: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`
};

const ADMIN_UI_ICONS = {
EDIT:        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`,
SAVE:        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
CANCEL:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
DELETE:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
NEW:         `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>`,
ARROW_LEFT:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
ARROW_RIGHT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
};

// =============================================================================
// 🟢 ATLAS CORE REPAIR (Global Scope - Rad 50)
// =============================================================================
window.updateInboxVisibility = function() {
// currentUser är redan definierad som global let på rad 120 i din fil
if (!currentUser) return; 

const inboxTab = document.querySelector('li[data-view="inbox"]');
const adminTab = document.getElementById('menu-admin');

const isSupport = currentUser.role === 'support' || currentUser.role === 'admin';

// Måste använda setProperty med 'important' — CSS .menu-item{display:flex!important} vinner annars
if (inboxTab) inboxTab.style.setProperty('display', isSupport ? 'flex' : 'none', 'important');
if (adminTab) adminTab.style.setProperty('display', 'flex', 'important');

console.log("📍 [UI] updateInboxVisibility kördes för:", currentUser.role);
};

// --- IPC BRYGGOR (Kopplar knappar i UI till main.js/db.js) ---

window.claimTicket = async (conversationId) => {
// Mappar mot main.js:144 -> ipcMain.handle('team:claim-ticket')
if (window.electronAPI && window.electronAPI['team:claim-ticket']) {
try {
await window.electronAPI['team:claim-ticket'](conversationId, currentUser.username);
if (typeof showToast === 'function') showToast("Ärende plockat!");
if (typeof renderInbox === 'function') renderInbox();
} catch (err) { console.error("❌ IPC Claim Error:", err); }
}
};

window.claimTicketFromReader = async (conversationId) => {
await window.claimTicket(conversationId);
const modal = document.getElementById('atlas-reader-modal');
if (modal) modal.style.display = 'none';
showToast('✅ Ärendet är nu ditt!');
};

window.assignTicketFromReader = async (conversationId) => {
// Öppnar tilldelnings-modal (Verifierad mot showAssignModal på rad 3592)
if (typeof showAssignModal === 'function') {
showAssignModal({ conversation_id: conversationId });
}
};

// --- MALL & URKLIPP BRYGGOR (Lagar anropen som flaggades i audit) ---

window.saveTemplates = async (templates) => {
// Kopplar anropet till window.electronAPI.saveTemplates (Rad 5083)
if (window.electronAPI && window.electronAPI.saveTemplates) {
return await window.electronAPI.saveTemplates(templates);
}
};

window.deleteTemplate = async (id) => {
// Kopplar anropet till window.electronAPI.deleteTemplate (Rad 5118)
if (window.electronAPI && window.electronAPI.deleteTemplate) {
return await window.electronAPI.deleteTemplate(id);
}
};

window.getAppInfo = async () => {
// Kopplar anropet till window.electronAPI.getAppInfo (Rad 4854)
if (window.electronAPI && window.electronAPI.getAppInfo) {
return await window.electronAPI.getAppInfo();
}
};

window.saveQA = async (qaData) => {
// Kopplar anropet till window.electronAPI.saveQA (Rad 1029)
if (window.electronAPI && window.electronAPI.saveQA) {
return await window.electronAPI.saveQA(qaData);
}
};

window.deleteQA = async (id) => {
// Kopplar anropet till window.electronAPI.deleteQA (Rad 1462)
if (window.electronAPI && window.electronAPI.deleteQA) {
return await window.electronAPI.deleteQA(id);
}
};

// --- XSS SKYDD ---
window.esc = function(str) { 
return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
};

// =============================================================================
// === 2. DOM ELEMENT CACHE (För prestanda & Säkerhet) ===
// Vi initierar objektet tomt här, och fyller det i DOMContentLoaded
let DOM = {
views: {},
inputs: {},
menuItems: null
};

// Tvinga rätt färg direkt vid uppstart för att undvika "blå-buggen"
(function initGlobalTheme() {
const savedUser = JSON.parse(localStorage.getItem('atlas_user'));
if (savedUser && savedUser.agent_color) {
document.documentElement.style.setProperty('--accent-primary', savedUser.agent_color);
}
})();

// =============================================================================
//=========ÄNRA AVATAR BUBBLANS FÄRGER OCH BILD=================================
// =============================================================================
function getAvatarBubbleHTML(user, size = "32px") {
if (!user) return `<div class="user-avatar" style="width:${size}; height:${size}; background:#333; border-radius:50%;"></div>`;

const color = user.agent_color || '#0071e3';
const avatarId = user.avatar_id;

// Hämta innehåll: Ikon om ID finns, annars initial
let content = '';
if (avatarId !== undefined && avatarId !== null && AVATAR_ICONS[avatarId]) {
content = AVATAR_ICONS[avatarId];
} else {
const displayName = user.display_name || (typeof formatName === 'function' ? formatName(user.username) : user.username);
content = displayName.charAt(0).toUpperCase();
}

// Returnera HTML - Notera klassen "avatar-inner-icon" för live-uppdatering
return `
<div class="user-avatar" style="width: ${size}; height: ${size}; border: 2px solid ${color}; position: relative; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); overflow: hidden;">
<div class="avatar-inner-icon" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: ${color}; fill: currentColor;">
${content}
</div>
${user.is_online !== undefined ? `<span class="status-indicator ${user.is_online ? 'online' : ''}" style="position: absolute; bottom: 0; right: 0; width: 25%; height: 25%; border-radius: 50%; background: ${user.is_online ? '#2ecc71' : '#95a5a6'}; border: 2px solid #1e1e1e;"></span>` : ''}
</div>
`;
}

// Ladda användaren DIREKT så den finns tillgänglig för allt
let authToken = localStorage.getItem('atlas_token');
let currentUser = JSON.parse(localStorage.getItem('atlas_user') || 'null');

// --- DYNAMISK KONTORSHANTERING (Ersätter 200+ rader hårdkodning) ---
let officeData = []; // Lagrar alla kontor från SQL i minnet
let usersCache = []; // Lagrar alla användare för agentfärger

// Bulk-mode state för Inkorg
let isBulkMode = false;
let selectedBulkTickets = new Set();

// Hämtar alla kontor från servern och lagrar dem i officeData för snabb uppslag
async function preloadOffices() {
try {
const res = await fetch(`${SERVER_URL}/api/public/offices`);
officeData = await res.json();
console.log(`✅ Laddat ${officeData.length} kontor från SQL.`);
} catch (err) { console.error("Kunde inte förladda kontor:", err); }
}

console.log('📋 officeData:', JSON.stringify(officeData.map(o => ({ tag: o.routing_tag, area: o.area, city: o.city }))));


// Hämtar alla användare från servern och lagrar dem i usersCache för agentfärger och namnuppslag
async function preloadUsers() {
try {
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
if (res.ok) usersCache = await res.json();
} catch (_) {}
}

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

// Säkra att window.currentUser finns (för legacy-stöd)
if (currentUser) window.currentUser = currentUser;

// Returnerar true om inloggad användare har rollen 'admin' eller 'support'
function isSupportAgent() {
// Atlas: Vi litar på rollen som hämtats från databasen vid inloggning.
// Vi kollar efter både 'admin' och 'support' för att vara framtidssäkrade.
return currentUser && (currentUser.role === 'admin' || currentUser.role === 'support');
}

// 🛑 DEBUG (Uppdaterad för att visa både namn och roll)
if (currentUser) {
console.log("LOGGAD IN SOM:", currentUser.username);
console.log("ROLL:", currentUser.role);
console.log("HAR SUPPORT-BEHÖRIGHET?", isSupportAgent()); 
}

// =============================================================================
// 🔒 SECURITY INTERCEPTOR (Måste ligga först i filen)
// =============================================================================
const originalFetch = window.fetch;

// Skriv över standard-fetch för att fånga 401 (Utloggad) globalt
window.fetch = async (...args) => {
try {
const response = await originalFetch(...args);

// Om servern säger "Unauthorized" (401), logga ut direkt
if (response.status === 401) {
console.warn("⛔ 401 Unauthorized detekterat - Tvingar utloggning...");
handleLogout(); 
return response;
}

return response;
} catch (err) {
throw err;
}
};

const isElectron = (typeof window.electronAPI !== 'undefined');
// Ljudfil för notifieringar
const NOTIFICATION_SOUND = "assets/js/pling.mp3";

// ==========================================================
// === 1. NÄTVERK & MILJÖKONFIGURATION ===
// ==========================================================

// DIN NGROK-ADRESS (Uppdaterad för webb-åtkomst)
const NGROK_HOST = window.location.origin; // Dynamisk — härleds från aktuell URL

// Välj URL: Localhost för Electron, Ngrok för Webb/Mobil
let SERVER_URL = (isElectron || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
? 'http://localhost:3001' 
: NGROK_HOST;

console.log(`🌍 Miljö: ${isElectron ? 'ELECTRON' : 'WEBB'}`);
console.log(`🔗 Server URL: ${SERVER_URL}`);

// === 2. AUTHENTICATION & LOGIN UI ===
const loginModalHTML = `
<div id="login-modal" class="custom-modal-overlay" style="display:none;">
<div class="glass-modal-box glass-effect">
<div class="glass-modal-header" style="justify-content:center; position:relative;">
<h2 style="margin:0; color:var(--text-primary); font-size:1.5rem;">Atlas Login</h2>
<button class="modal-close" aria-label="Stäng login">×</button>
</div>

<div class="glass-modal-body" style="margin-top:20px;">
<form id="login-form" style="display:flex; flex-direction:column; gap:15px;">
<input type="text" id="login-user" placeholder="Användarnamn" required>
<input type="password" id="login-pass" placeholder="Lösenord" required>

<button id="login-btn" type="submit" class="btn-modal-confirm" style="width:100%;">Logga in</button>
</form>
<p id="login-error" style="color:#ff6b6b; margin-top:15px; font-size:13px; min-height:18px;"></p>
</div>
</div>
</div>
`;

// Smart definition av fetchHeaders - Hämtar alltid senaste token från 'atlas_token'
Object.defineProperty(window, 'fetchHeaders', {
get() {
const token = localStorage.getItem('atlas_token'); // Här är nyckeln vi såg i din logg

// Valfritt: Varning i konsolen om token saknas när man försöker hämta data
if (!token) console.warn("⚠️ FetchHeaders anropades utan att 'atlas_token' finns i minnet.");

return {
'Content-Type': 'application/json',
'Authorization': token ? `Bearer ${token}` : '',
'ngrok-skip-browser-warning': 'true' // Bra att ha kvar om du kör via ngrok ibland
};
},
configurable: true
});

// Hjälpfunktion: Avkoda JWT för att se utgångsdatum
function parseJwt(token) {
try {
const base64Url = token.split('.')[1];
const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
}).join(''));
return JSON.parse(jsonPayload);
} catch (e) { return null; }
}

// ============================================================================
// 🎨 ATLAS CONFIRM - Snygg Ja/Nej-ruta (SÄKRAD)
// ============================================================================
function atlasConfirm(title, message) {
return new Promise((resolve) => {
let modal = document.getElementById('atlas-confirm-modal');

if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-confirm-modal';
modal.className = 'custom-modal-overlay glass-effect';
modal.style.display = 'none';
modal.style.zIndex = '30000';

// Kolla UI_ICONS innan användning
const sendIcon = (typeof UI_ICONS !== 'undefined' && UI_ICONS.SEND) ? UI_ICONS.SEND : '';

modal.innerHTML = `
<div class="glass-modal-box">
<div class="glass-modal-header"><h3 id="confirm-title"></h3></div>
<div class="glass-modal-body"><p id="confirm-message" style="margin: 15px 0 25px 0;"></p></div>
<div class="glass-modal-footer" style="justify-content:center; gap:15px;">
<button id="confirm-cancel" class="btn-modal-cancel">Avbryt</button>
<button id="confirm-ok" class="btn-modal-confirm">${sendIcon} OK</button>
</div>
</div>`;
document.body.appendChild(modal);
}

modal.querySelector('#confirm-title').innerText = title;
modal.querySelector('#confirm-message').innerText = message;
modal.style.display = 'flex';

const btnOk = modal.querySelector('#confirm-ok');
const btnCancel = modal.querySelector('#confirm-cancel');
const newOk = btnOk.cloneNode(true);
const newCancel = btnCancel.cloneNode(true);
btnOk.parentNode.replaceChild(newOk, btnOk);
btnCancel.parentNode.replaceChild(newCancel, btnCancel);

newOk.onclick = () => { modal.style.display = 'none'; resolve(true); };
newCancel.onclick = () => { modal.style.display = 'none'; resolve(false); };
});
}

// CHANGE THEME =================================================================
function changeTheme(themeName) {
// Kolla både globala DOM-objektet och stylesheet-referensen
const stylesheet = (typeof DOM !== 'undefined' && DOM.themeStylesheet) 
? DOM.themeStylesheet 
: document.getElementById('theme-link');

if (stylesheet) {
stylesheet.href = `./assets/themes/${themeName}/${themeName}.css`;
}
localStorage.setItem('atlas-theme', themeName);
}

// ============================================================================
// FIX 1: BADGE-HANTERING + WINDOWS TASKBAR ICON (SÄKRAD)
// ============================================================================
async function updateInboxBadge() {
if (typeof authToken === 'undefined' || !authToken) return;
const inboxBadge = document.getElementById('badge-inbox');
const myBadge = document.getElementById('badge-my-tickets');
try {
// Hämta både inkorg och mina ärenden parallellt
const [inboxRes, myRes] = await Promise.all([
fetch(`${SERVER_URL}/team/inbox`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/team/my-tickets?t=${Date.now()}`, { headers: fetchHeaders })
]);

const inboxData = await inboxRes.json();
const myData = await myRes.json();

const inboxTickets = inboxData.tickets || [];
const myTickets = myData.tickets || [];

// Inkorg: alla oplockat (live-chattar + mail + plockade ärenden)
const inboxCount = inboxTickets.filter(t => !t.owner).length;

// Plockade ärenden i inkorgen (routade till kontor)
const claimedCount = (inboxData.claimed || []).length;

// Mina ärenden: alla som API:et returnerar för denna agent
const myCount = myTickets.length;

const totalInbox = inboxCount + claimedCount;
const totalCount = totalInbox + myCount;

// Uppdatera badges
if (inboxBadge) {
inboxBadge.textContent = totalInbox;
inboxBadge.style.setProperty('display', totalInbox > 0 ? 'flex' : 'none', 'important');
}
if (myBadge) {
myBadge.textContent = myCount;
myBadge.style.setProperty('display', myCount > 0 ? 'flex' : 'none', 'important');
}

// Windows aktivitetsfält
if (typeof isElectron !== 'undefined' && isElectron && window.electronAPI?.setTaskbarIcon) {
if (totalCount > 0) {
const badgeDataUrl = drawTaskbarBadge(totalCount);
window.electronAPI.setTaskbarIcon(badgeDataUrl, `${totalCount} ärenden`);
} else {
window.electronAPI.setTaskbarIcon(null, '');
}
}
} catch (err) {
console.warn("Badge-systemet väntar...");
}
}
// Hjälpfunktion: Ritar röd cirkel - BEVARAD EXAKT
function drawTaskbarBadge(number) {
const size = 32; 
const canvas = document.createElement('canvas');
canvas.width = size;
canvas.height = size;
const ctx = canvas.getContext('2d');
ctx.beginPath();
ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
ctx.fillStyle = '#ff4444'; 
ctx.fill();
ctx.fillStyle = 'white';
ctx.font = 'bold 20px "Segoe UI", sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
const text = number > 99 ? '99+' : number.toString();
ctx.fillText(text, size / 2, (size / 2) + 2); 
return canvas.toDataURL();
}

// Gör den globalt tillgänglig för init-scriptet
window.updateInboxBadge = updateInboxBadge;

// =========================================================
// PROFILEN NERE TILL VÄNSTER - LOGIN-DELEN
// =========================================================
function updateProfileUI() {
console.log("🔧 updateProfileUI() körs");
const container = document.getElementById('user-profile-container');
const loginBtn = document.getElementById('login-btn-sidebar');
const nameEl = document.getElementById('current-user-name');
const initialContainer = document.querySelector('.user-initial');
const avatarRing = document.querySelector('.user-avatar');

if (authToken && currentUser) {
if (container) {
container.style.display = 'flex';
container.style.cursor = 'pointer';
container.onclick = () => { showProfileSettings(); };
}
if (loginBtn) loginBtn.style.display = 'none';

const color = currentUser.agent_color || '#0071e3';
const displayName = currentUser.display_name || currentUser.username || 'Agent';

// 1. Sätt global färg (Säkrar mot Ctrl+R buggen)
document.documentElement.style.setProperty('--accent-primary', color);

// 2. Namn och Status (innerHTML rensar gamla spänner automatiskt = ingen dubbeltext)
if (nameEl) {
nameEl.innerHTML = `
<span style="display:block; font-weight:600; color:white;">${displayName.charAt(0).toUpperCase() + displayName.slice(1)}</span>
${currentUser.status_text ? `<span class="user-status-text" style="display:block; font-size:10px; color:${color}; opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;" title="${currentUser.status_text}">💬 ${currentUser.status_text}</span>` : ''}
`;
}

// 3. Avatar & Färg
if (initialContainer) {
initialContainer.style.backgroundColor = color;
initialContainer.innerHTML = AVATAR_ICONS[currentUser.avatar_id || 0];
const svg = initialContainer.querySelector('svg');
if (svg) { svg.style.width = '20px'; svg.style.height = '20px'; }
}
if (avatarRing) avatarRing.style.borderColor = color;

} else {
if (container) container.style.display = 'none';
if (loginBtn) loginBtn.style.display = 'flex';
}

updateInboxVisibility();
}

//=======check auth =========//////
function checkAuth() {
console.log("🔐 checkAuth() körs");
// 1. Finns ingen token? Visa modal.
if (!authToken) {
console.log("  ⚠️ Ingen token - Visar login-modal");
const modal = document.getElementById('login-modal');
if(modal) modal.style.display = 'flex';
updateProfileUI(); // Döljer profilen
return false;
}

// 2. Har token gått ut?
const decoded = parseJwt(authToken);
if (decoded && decoded.exp) {
const now = Math.floor(Date.now() / 1000);
if (decoded.exp < now) {
console.warn("⚠️ Token har gått ut. Loggar ut...");
handleLogout();
return false;
}

// Sätt timer för auto-logout
const timeUntilExpiry = (decoded.exp * 1000) - Date.now();
if (timeUntilExpiry > 0) {
setTimeout(() => {
alert("Sessionen har gått ut.");
handleLogout();
}, timeUntilExpiry);
}
}

// 3. Allt ok - Uppdatera UI
console.log("  ✅ Token OK, uppdaterar profil-UI");
updateProfileUI();
return true;
}

// Rensar token och användarsession och laddar om sidan för att nollställa allt state
function handleLogout() {
console.log("🚪 Loggar ut...");
localStorage.removeItem('atlas_token');
localStorage.removeItem('atlas_user');
// Vi laddar om sidan för att nollställa allt (socket, state, minne)
location.reload(); 
}

// === MAIL - SPARA FRÅGA + SVAR
let lastEmailContext = "";

// === SOCKET.IO SETUP (NGROK) ===
let socket = null;
window.socketAPI = {
isConnected: () => false,
emit: () => console.warn("Socket not ready yet"),
on: () => {}
};

// Initierar Socket.IO-anslutningen mot servern och sätter upp det globala socketAPI-objektet
function initializeSocket() {
if (typeof io === 'undefined' || !authToken) return;
console.log("🔌 Initializing Socket.io connection...");

// ExtraHeaders låser upp Ngrok för webbsockets
socket = io(SERVER_URL, {
auth: { token: authToken },
extraHeaders: {
"ngrok-skip-browser-warning": "true"
},
reconnection: true,
reconnectionAttempts: 10
});

// Koppla upp det globala API:et
window.socketAPI = {
isConnected: () => socket && socket.connected,
emit: (event, data) => socket && socket.emit(event, data),
on: (event, cb) => socket && socket.on(event, cb)
};

socket.on('connect', () => {
console.log("🟢 Socket connected!");
updateServerStatusUI(true);
});

socket.on('disconnect', () => {
console.warn("🔴 Socket disconnected");
updateServerStatusUI(false);
});

socket.on('connect_error', (err) => {
console.error("❌ Socket Connect Error:", err.message);
if (err.message.includes("Authentication error")) {
handleLogout(); 
}
});

// Aktivera lyssnare för chatt och events
setupSocketListeners();
}

// Uppdaterar server-statusindikatorn i UI med grön/röd status
function updateServerStatusUI(connected) {
const statusEl = document.getElementById('server-status');
if (statusEl) {
statusEl.textContent = connected ? "🟢 LIVE" : "🔴 Frånkopplad";
statusEl.style.color = connected ? "#4cd137" : "#ff6b6b";
}
}

// === DYNAMISK SOCKET-LADDNING (RETRY LOGIK) ===
async function loadSocketIoScriptWithRetry(retries = 30) {
const scriptUrl = `${SERVER_URL}/socket.io/socket.io.js`;

for (let i = 0; i < retries; i++) {
try {
// Försök nå servern med HEAD-anrop (inkluderar headers för Ngrok)
const res = await fetch(scriptUrl, { 
method: 'HEAD',
headers: { 'ngrok-skip-browser-warning': 'true' }
});

if (res.ok) {
console.log("✅ Servern svarar! Laddar socket-script...");
const script = document.createElement('script');
script.src = scriptUrl;
script.onload = () => initializeSocket();
script.onerror = () => {
// Fallback till CDN om lokala scriptet failar
console.warn("⚠️ Lokalt script failade, testar CDN...");
const cdn = document.createElement('script');
cdn.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
cdn.onload = () => initializeSocket();
document.head.appendChild(cdn);
};
document.head.appendChild(script);
return;
}
} catch (err) {
// Servern startar upp... uppdatera UI
const statusEl = document.getElementById('server-status');
if (statusEl) {
statusEl.textContent = `⏳ Startar servern... (${Math.round((i/retries)*100)}%)`;
statusEl.style.color = "orange";
}
}
await new Promise(r => setTimeout(r, 1000));
}

console.error("❌ Server Timeout.");
addBubble("⚠️ Kunde inte ansluta till servern. Kontrollera att den är igång.", 'atlas');
}

// ==========================================================
// === UI INITIALIZATION (Hero Placeholders)
// ==========================================================
function initHeroPlaceholders() {
const placeholders = {
'inbox-placeholder': {
title: 'Inkorgen',
subtitle: 'Välj ett inkommande ärende för att påbörja hanteringen.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"/><path d="M7 12h10"/><path d="m12 7 5 5-5 5"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>'
},
'my-detail-placeholder': {
title: 'Mina Ärenden',
subtitle: 'Fortsätt konversationen genom att välja en av dina aktiva chattar.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 7h8"/><path d="M8 11h5"/></svg>'
},
'archive-placeholder': {
title: 'Garaget',
subtitle: 'Sök och filtrera bland alla dina avslutade och arkiverade ärenden.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/></svg>'
},
'editor-placeholder': {
title: 'Mailmallar',
subtitle: 'Välj en mall i listan för att redigera eller skapa en ny.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
},
'admin-placeholder': { // <--- NU TILLAGD FÖR ATT MATCHA DIN INDEX.HTML RAD 395
title: 'Admin Dashboard',
subtitle: 'Välj en agent eller ett kontor för att hantera inställningar.',
bgIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
fgIcon: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>'
}
};

Object.keys(placeholders).forEach(id => {
const el = document.getElementById(id);
if (el) {
const data = placeholders[id];
el.innerHTML = `
<div class="hero-placeholder">
<div class="hero-bg-icon">${data.bgIcon}</div>
<div class="hero-content">
<div class="hero-fg-icon">${data.fgIcon}</div>
<div class="hero-title">${data.title}</div>
<div class="hero-subtitle">${data.subtitle}</div>
</div>
</div>`;
}
});
}

// ==========================================================
// SOCKET-LYSSNARE / EVENTS (SÄKRAD
// ==========================================================
function setupSocketListeners() {
if (!window.socketAPI) return;

// 🛡️ VAKT: Förhindrar dubbla lyssnare vid reconnect (Säkring mot "Ghost UI")
if (window.socketListenersAttached) return; 
window.socketListenersAttached = true;

console.log("📡 Registrerar Socket-lyssnare...");

// 1. Svar från Atlas (Bot)
window.socketAPI.on('server:answer', (data) => {
console.log("📥 Mottog svar:", data);
addBubble(data.answer, 'atlas');

if (State.currentSession) {
State.currentSession.add('atlas', data.answer);
State.currentSession.isFirstMsg = false;
if (data.locked_context && State.currentSession.context) {
State.currentSession.context.locked_context = data.locked_context;
}
saveLocalQA(State.currentSession);
}
});

// 2. Versionsinfo
window.socketAPI.on('server:info', (data) => {
const verEl = document.getElementById('server-version-display');
if (verEl) verEl.textContent = data.version;
});

// 3. Felmeddelanden
window.socketAPI.on('server:error', (err) => {
addBubble(`⚠️ Serverfel: ${err.message}`, 'atlas');
});

// 4. TEAM UPDATE (INKORG / MINA ÄRENDEN / ARKIV) - NU SAMLAD HÄR
// Debounce-timer: förhindrar scrollbar-flimmer vid snabba socket-events
let _teamUpdateDebounce = null;
window.socketAPI.on('team:update', (evt) => {
updateInboxBadge();
if (evt.type === 'client_typing') return;

if (
(evt.type === 'new_message' || evt.type === 'human_mode_triggered')
&& State.soundEnabled
) {
playNotificationSound();
}

clearTimeout(_teamUpdateDebounce);
_teamUpdateDebounce = setTimeout(() => {
renderInbox();
renderMyTickets();
if (DOM.views && DOM.views.archive && DOM.views.archive.style.display === 'flex') {
renderArchive();
}
}, 350);
});

// 4b. Lyssna på specifika kundmeddelanden (Loveable API)
window.socketAPI.on('team:customer_message', (data) => {
console.log("📩 Nytt kundmeddelande via API:", data);
updateInboxBadge();
if (State.soundEnabled) playNotificationSound();

// Vi triggar en render för att se det nya meddelandet i listan direkt
if (DOM.views.inbox.style.display === 'flex') renderInbox();
});

// 4c. Lyssna på helt nya ärenden (t.ex. interna meddelanden)
window.socketAPI.on('team:new_ticket', (data) => {
console.log("🆕 Nytt ärende i kön:", data);
updateInboxBadge();
if (State.soundEnabled) playNotificationSound();

// Uppdatera vyn om användaren står i inkorgen
if (DOM.views.inbox.style.display === 'flex') renderInbox();
});

// ================================================
// team:customer_reply
// ================================================
window.socketAPI.on('team:customer_reply', (data) => {
const { conversationId, message, sender, isEmail } = data;

// Badge + ljud (övertar från team:update för inkommande kundmeddelanden)
updateInboxBadge();
if (sender === 'user' && State.soundEnabled) playNotificationSound();

// Kolla BÅDA detaljvyerna oberoende — båda existerar alltid i DOM (display togglas, ej remove)
const myDetail    = document.getElementById('my-ticket-detail');
const inboxDetail = document.getElementById('inbox-detail');
const isMyTicketOpen = myDetail?.getAttribute('data-current-id') === conversationId;
const isInboxOpen    = inboxDetail?.getAttribute('data-current-id') === conversationId;
if (!isMyTicketOpen && !isInboxOpen) return; // Ingen av vyerna visar detta ärende

// Välj rätt chattcontainer baserat på vilken vy som är aktiv
let chatContainer = null;
if (isMyTicketOpen) chatContainer = document.getElementById('my-chat-scroll-area');
else if (isInboxOpen) chatContainer = document.querySelector('#inbox-detail .inbox-chat-history');
if (!chatContainer) return;

const wrapper = document.createElement('div');

// Avgör bubbelsida: eget meddelande → höger, kund/kollega → vänster
const isOwnMessage = sender && sender.toLowerCase() === (currentUser?.username || '').toLowerCase();
const isCustomer   = !sender || sender.toLowerCase() === 'user';

const activeDetail = document.querySelector('.template-editor-container[style*="display: flex"]');
const theme = getAgentStyles(activeDetail?.getAttribute('data-owner') || 'unclaimed');
const clean = (message || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');

// Tidsstämpel för live-bubblan
const _now = new Date();
const _timeStr = _now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const _dateStr = _now.toLocaleDateString('sv-SE');

if (isOwnMessage) {
// Eget agent-svar: höger sida — matchar statisk 'atlas'-rad i openMyTicketDetail
const agentStyles = getAgentStyles(sender);
const ownInitial = (currentUser?.username || '?')[0].toUpperCase();
wrapper.className = 'msg-row atlas';
wrapper.style.cssText = 'display:flex; width:100%; margin-bottom:12px; justify-content:flex-end;';
wrapper.innerHTML = `
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-right:4px;">Du • ${_timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
<div class="msg-avatar" style="background:${agentStyles.main}; color:white; font-weight:bold; margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${ownInitial}</div>
`;
} else if (isCustomer) {
// Kundmeddelande: vänster sida — matchar statisk 'user'-rad i openMyTicketDetail
wrapper.className = 'msg-row user';
wrapper.style.cssText = 'display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;';
wrapper.innerHTML = `
<div class="msg-avatar" style="background:rgba(255,255,255,0.15); color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">K</div>
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-left:4px;"><b>Kund</b> • ${_dateStr} ${_timeStr}</div>
<div class="bubble" style="background:${theme.bubbleBg} !important; border:1px solid ${theme.border} !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
`;
} else {
// Kollegas inkommande meddelande (intern chatt): vänster sida med agentens EGNA färg (ej ärendets tema)
const agentStyles = getAgentStyles(sender);
const colInitial = (sender || '?')[0].toUpperCase();
const senderName = (typeof formatName === 'function') ? formatName(sender) : sender;
wrapper.className = 'msg-row user';
wrapper.style.cssText = 'display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;';
wrapper.innerHTML = `
<div class="msg-avatar" style="background:${agentStyles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${colInitial}</div>
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-left:4px;"><b>${senderName}</b> • ${_dateStr} ${_timeStr}</div>
<div class="bubble" style="background:${agentStyles.bubbleBg} !important; border:1px solid ${agentStyles.border} !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
`;
}

chatContainer.appendChild(wrapper);

// Auto-scroll bara om agenten inte scrollat upp manuellt (läser data-auto-scroll)
const shouldAutoScroll = chatContainer.getAttribute('data-auto-scroll') === 'true';
const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;

if (shouldAutoScroll || isNearBottom) {
setTimeout(() => {
chatContainer.scrollTo({
top: chatContainer.scrollHeight,
behavior: 'smooth'
});
}, 50);
}
});

// ===============================
// KUNDEN SKRIVER (BEHÅLL DENNA!)
// ===============================
let typingTimer = null;

// Lyssna på kund-typing: visa typing-indikatorn i öppen detaljvy
window.socketAPI.on('team:client_typing', (data) => {
const { sessionId } = data;
const indicator = document.getElementById(`typing-indicator-${sessionId}`);
if (!indicator) return;
indicator.style.display = 'block';
clearTimeout(typingTimer);
typingTimer = setTimeout(() => {
indicator.style.display = 'none';
}, 3000);
});

// Lyssna på presence-uppdateringar (agent online/offline)
// Uppdaterar cachen — korten uppdateras automatiskt nästa gång de renderas
window.socketAPI.on('presence:update', (data) => {
const { userId, status } = data;
const user = usersCache.find(u => u.id === userId);
if (user) {
user.is_online = (status === 'online') ? 1 : 0;
if (data.lastSeen) user.last_seen = data.lastSeen;
}
});

// Lyssna på ärende-status: stäng detaljvyn om det öppna ärendet raderades av en kollega
window.socketAPI.on('team:session_status', (data) => {
const { conversationId, status } = data;
if (status !== 'deleted') return; // Arkivering hanteras av team:update — ingen action här

// Kolla om just detta ärende är öppet INNAN vi nollställer (data-current-id tas bort av checkAndResetDetail)
const wasOpen = ['inbox-detail', 'my-ticket-detail'].some(id => {
const el = document.getElementById(id);
return el && el.getAttribute('data-current-id') === conversationId;
});

// Stäng detaljvyn och visa placeholder om ärendet är öppet
checkAndResetDetail('inbox-detail', conversationId);
checkAndResetDetail('my-ticket-detail', conversationId);

// Visa toast endast om agenten faktiskt hade ärendet öppet
if (wasOpen) {
showToast('🗑️ Ärendet togs bort av en kollega');
}
});

window.socketAPI.on('team:ticket_taken', (data) => {
const { conversationId, takenBy } = data;
const wasOpen = ['inbox-detail', 'my-ticket-detail'].some(id => {
const el = document.getElementById(id);
return el && el.getAttribute('data-current-id') === conversationId;
});
checkAndResetDetail('my-ticket-detail', conversationId);
renderMyTickets?.();
if (wasOpen) {
showToast(`⚠️ ${takenBy} tog över detta ärende`);
}
});

// ==========================================================
// 📩 LYSSNA PÅ AI-SVAR (SKRÄDDARSYDD FÖR DIN RENDERER.JS)
// ==========================================================
window.socketAPI.on('ai:prediction', async (data) => {
console.log("📡 Meddelande mottaget från servern:", data); 

// --- NY LOGIK: HÄMTA TILL RUTAN OM VI ÄR I "MINA ÄRENDEN" ---
const myTicketInput = document.getElementById('my-ticket-chat-input');
const detailView = document.getElementById('my-ticket-detail');

// Om detaljvyn syns OCH rutan finns -> Lägg in texten där
if (detailView && detailView.style.display === 'flex' && myTicketInput) {
console.log("🤖 AI lägger svaret i textrutan direkt.");
myTicketInput.value = data.answer; // Klistra in svaret
myTicketInput.disabled = false;    // Lås upp om den var låst
myTicketInput.focus();             // Sätt markören där

if (typeof playNotificationSound === 'function') playNotificationSound();
return; // AVSLUTA HÄR - Ingen kopiering till urklipp behövs då
}

// --- DIN GAMLA LOGIK (FALLBACK FÖR URKLIPP) ---
if (data.is_email_draft) {
console.log("🤖 AI har genererat ett mail-svar! Tvingar kopiering...");

const now = new Date();
const timeStamp = now.toLocaleString('sv-SE', { 
year: 'numeric', month: '2-digit', day: '2-digit', 
hour: '2-digit', minute: '2-digit' 
});

// 1. Skapa Plain Text-version (Använder din lastEmailContext)
const finalContentPlain = `${data.answer}\n\n` + 
`--------------------------------------------------\n` +
`URSPRUNGLIGT MEDDELANDE (Mottaget: ${timeStamp}):\n` +
`${lastEmailContext}\n\n` + 
`Med vänlig hälsning\n` +
`Supporten My Driving Academy`;

// 2. Skapa Rich Text-version (HTML) med din formatAtlasMessage-funktion
const answerHtml = formatAtlasMessage(data.answer);
const contextHtml = lastEmailContext.replace(/\n/g, '<br>');

const finalContentHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.4;">
<div>${answerHtml}</div>
<br>
<div style="border-top: 1px solid #ccc; padding-top: 10px; color: #666;">
<strong>URSPRUNGLIGT MEDDELANDE (Mottaget: ${timeStamp}):</strong><br>
${contextHtml}
</div>
<br>
Med vänlig hälsning,<br>
<strong>Supporten My Driving Academy</strong>
</div>
`;

// 3. Hantera kopiering baserat på din miljö (Electron vs Webb)
if (window.electronAPI && typeof window.electronAPI.send === 'function') {

// ELECTRON-LÄGE (Patric)
window.electronAPI.send('force-copy-html-to-clipboard', {
html: finalContentHtml,
text: finalContentPlain
});
if (typeof playNotificationSound === 'function') playNotificationSound();
console.log("✅ Kopierat AI-svar via Electron (Rich Text)");
} else {

// WEBB-LÄGE
try {
const typeHtml = "text/html";
const typeText = "text/plain";
const blobHtml = new Blob([finalContentHtml], { type: typeHtml });
const blobText = new Blob([finalContentPlain], { type: typeText });

const clipboardData = [new ClipboardItem({
[typeHtml]: blobHtml,
[typeText]: blobText
})];

await navigator.clipboard.write(clipboardData);
if (typeof playNotificationSound === 'function') playNotificationSound();
console.log("✅ Kopierat AI-svar via Web Clipboard API");
} catch (err) {
console.error("❌ Webb-kopiering misslyckades:", err);
await navigator.clipboard.writeText(finalContentPlain);
if (typeof playNotificationSound === 'function') playNotificationSound();
}
}
}
});
// ==========================================================
// 🎨 LIVE FÄRG-SYNK (OFFICE & AGENT)
// ==========================================================
window.socketAPI.on('office:color_updated', ({ routing_tag, color }) => {
console.log(`🎨 [LIVE] Kontorsfärg uppdaterad: ${routing_tag} → ${color}`);
const office = officeData.find(o => o.routing_tag === routing_tag);
if (office) office.office_color = color;
renderInbox();
renderMyTickets();
if (document.getElementById('view-archive')?.style.display === 'flex') renderArchive();
});

window.socketAPI.on('agent:color_updated', ({ username, color }) => {
console.log(`🎨 [LIVE] Agentfärg uppdaterad: ${username} → ${color}`);
const user = usersCache.find(u => u.username === username);
if (user) user.agent_color = color;
if (currentUser?.username === username) currentUser.agent_color = color;
renderInbox();
renderMyTickets();
if (document.getElementById('view-archive')?.style.display === 'flex') renderArchive();
});

} // <-- Stänger setupSocketListeners-funktionen

// ==========================================================
// === 1. GLOBALA INSTÄLLNINGAR & STATE ===
// ==========================================================
let API_KEY = null;
const API_URL = `${SERVER_URL}/search_all`;

const State = {
currentSession: null,
inboxMode: 'team', 
templates: [],
localQA: [],
teamTickets: [],
archiveItems: [],
inboxExpanded: {
"Live-Chattar": false,
"Inkomna MAIL": false,
"Plockade Ärenden": false
},
// Sparar tiden när man lämnade respektive vy
lastSeen: {
inbox: Date.now(),
'my-tickets': Date.now(),
archive: Date.now(),
templates: Date.now()
}
};

// Quill Editor Instance
let quill = null;
let isLoadingTemplate = false;

// ==========================================================
// 3. CHATT MOTOR (Session & Logic)
// ==========================================================
class ChatSession {
constructor() {
// Lägg till unik random-del för att undvika kollisioner
this.id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
this.messages = [];
this.startTime = new Date();

// 👈 KRITISK FIX: HEM-vyn är ALLTID privat
this.session_type = 'private'; 

this.context = {
locked_context: {
city: null,
area: null,
vehicle: null
},
linksSentByVehicle: {
AM: false,
MC: false,
CAR: false,
INTRO: false,
RISK1: false,
RISK2: false
}
};

this.isFirstMsg = true;
}

add(role, text) {
this.messages.push({ role, text, timestamp: new Date() });
}

getContextHistory() {
return this.messages.map(m => ({ 
role: m.role, 
content: m.text 
})).slice(-10); // Skicka bara sista 10 för context window
}

getFullText() {
return this.messages.map(m => 
`${m.role === 'user' ? 'Användare' : 'Atlas'}: ${m.text}`
).join('\n\n');
}
}

// ==========================================================
// ⚠️ VIKTIGT – INTRO-BUBBLA ÄGS AV index.html
// Renderer.js får ALDRIG skapa första Atlas-meddelandet.
// isFirstMsg sätts därför till false här medvetet.
// Ändra INTE detta utan att även uppdatera index.html + server-flödet.
// ==========================================================
function initChat(skipSave = false) {
console.log("🏠 initChat() körs (skipSave=" + skipSave + ")");
// Spara bara om vi inte bett om att hoppa över
if (!skipSave && State.currentSession && State.currentSession.messages.length > 0) {
saveLocalQA(State.currentSession);
}

State.currentSession = new ChatSession();

// 🛑 ULTRA-KOMPAKT FIX:
// padding: 15px (Mindre ram runt texten)
// max-width: 380px (Smalare box totalt)

console.log("  Rendering intro message...");

if (DOM.chatMessages) {
DOM.chatMessages.innerHTML = `
<div style="width: 100%; display: flex; justify-content: flex-start; padding: 20px; box-sizing: border-box;">
<div style="
background: rgba(15, 15, 25, 0.7); /* Mörkare bas för läsbarhet i ljusa teman */
backdrop-filter: blur(12px);
padding: 18px; 
border-radius: 12px;
border: 1px solid var(--accent-primary);
max-width: 380px;
box-shadow: 0 10px 30px rgba(0,0,0,0.5);
">
<h3 style="margin: 0 0 10px 0; color: var(--accent-primary); font-size: 14px; display:flex; align-items:center; gap:10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
Privat för dig endast
</h3>
<p style="margin: 0 0 12px 0; line-height: 1.5; font-size: 13px; color: #ffffff;">
Här kan du testa frågor mot Atlas AI utan att det loggas som kundärenden.
</p>
<div style="font-size: 11px; color: rgba(255,255,255,0.5); font-style: italic; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
Dessa sessioner sparas lokalt i ditt Garage, men syns inte för teamet.
</div>
</div>
</div>
`;

State.currentSession.isFirstMsg = false;
console.log('[CHAT] Ny session startad (Privat):', State.currentSession.id);
}
}

//----------------------------------------------
//---------HANDLE USER MESSAGE----------------//
//----------------------------------------------
async function handleUserMessage(text) {
if (!text.trim()) return;

// 1. UI Update (Visa användarens meddelande direkt)
if (State.currentSession) State.currentSession.add('user', text);
addBubble(text, 'user');

// Töm endast om fältet existerar
if (DOM.messageInput) {
DOM.messageInput.value = '';
}

// 2. Skicka via Socket.IO
if (window.socketAPI && window.socketAPI.isConnected()) {
try {
const payload = {
query: text,
sessionId: State.currentSession?.id,
isFirstMessage: State.currentSession?.isFirstMsg,
session_type: State.currentSession?.session_type, 
context: State.currentSession?.context
};

if (State.currentSession?.isFirstMsg && currentUser) {
window.socketAPI.emit('team:assign_self', { 
sessionId: State.currentSession.id, 
agentName: currentUser.username 
});

checkAndResetDetail('inbox-detail');
checkAndResetDetail('my-ticket-detail');
checkAndResetDetail('archive-detail');
}

window.socketAPI.emit('client:message', payload);

} catch (err) {
console.error(err);
addBubble(`⚠️ Kunde inte skicka via socket: ${err.message}`, 'atlas');
}
} else {
addBubble("⚠️ Ingen anslutning till servern.", 'atlas');
console.error("Socket not connected.");
}
}

//----------------------------------------------
//---------ADD BUBBLE----------------//
//----------------------------------------------
function addBubble(text, role) {
// Avbryt direkt om chatt-containern saknas
if (!DOM.chatMessages) {
console.warn("⚠️ DOM.chatMessages saknas. Kan inte rita bubbla:", text);
return;
}

const wrapper = document.createElement('div');
wrapper.className = `message ${role}`;

const bubble = document.createElement('div');
bubble.className = 'bubble';

// Markdown-lite parsing - BEVARAD EXAKT
let html = text
.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
.replace(/\n/g, '<br>')
.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="atlas-link">$1</a>');

bubble.innerHTML = html;
wrapper.appendChild(bubble);

// Append och scroll
DOM.chatMessages.appendChild(wrapper);
DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// ============================================================================
// HJÄLPFUNKTION: Fixar namnet (Anna Andersson) oavsett var det ligger
// ============================================================================
function resolveTicketTitle(t) {
// 1. Prioritera namn i roten
if (t.contact_name) return t.contact_name;

// 2. Kolla inuti context_data (Viktigt för Demo-ärenden)
if (t.context_data) {
try {
const ctx = typeof t.context_data === 'string' ? JSON.parse(t.context_data) : t.context_data;
if (ctx.locked_context && ctx.locked_context.name) return ctx.locked_context.name;
if (ctx.name) return ctx.name;
} catch(e) {}
}

// 3. Kolla locked_context direkt
if (t.locked_context) {
if (t.locked_context.name) return t.locked_context.name;
if (t.locked_context.contact_name) return t.locked_context.contact_name;
}

// 4. Fallback: Använd användarens namn från session
if (t.sender && t.session_type === 'internal') {
return (typeof formatName === 'function') ? formatName(t.sender) : t.sender;
}

// 5. Fallbacks
if (t.contact_email) return t.contact_email;
if (t.subject && !t.subject.startsWith('DEMO_')) return t.subject;
const shortId = t.conversation_id.replace('session_', '').substring(0, 6);
return `Ärende #${shortId}`;
}

// Add missing function declaration for saveLocalQA
function saveLocalQA(session, forceArchive = false) {
// Implementation for saving local QA session
if (window.electronAPI && window.electronAPI.saveQA) {
const qaData = {
id: session.id,
question: session.messages.find(m => m.role === 'user')?.text || '',
answer: JSON.stringify(session.messages),
timestamp: Date.now(),
is_archived: forceArchive ? 1 : 0,
session_type: session.session_type || 'private'
};
window.electronAPI.saveQA(qaData);
}
}

// ===================================================
// 4. STÄDAR VYERNA OCH RENDERAR OM
// ===================================================
function checkAndResetDetail(detailId, affectedId = null) {
const detail = document.getElementById(detailId);
if (!detail) return;

const currentId = detail.getAttribute('data-current-id');
if (!currentId) return;

// Om ett specifikt ID skickas in -> reset endast om det är det ärendet som visas
if (affectedId && affectedId !== currentId) return;

// 🧹 Stäng & rensa detaljvyn
detail.style.display = 'none';
detail.innerHTML = '';
detail.removeAttribute('data-current-id');

// 🗺️ MAPPNING: Vilken placeholder hör till vilken detaljvy?
const placeholderMap = {
'inbox-detail': 'inbox-placeholder',
'my-ticket-detail': 'my-detail-placeholder',
'archive-detail': 'archive-placeholder',
'admin-detail-content': 'admin-placeholder' // 🔥 TILLAGD: Nu hittar även Admin hem till sin Hero!
};

const placeholderId = placeholderMap[detailId];
const placeholder = document.getElementById(placeholderId);

if (placeholder) {
placeholder.style.display = 'flex'; // Flex används för att Hero-ikonen ska centreras perfekt
}

console.log(`🧹 System-städning: Resetade ${detailId} (session ${currentId})`);
}

// ===================================================
// 4. UNIFIED INBOX (RENDER) - MED NYA RÖDA BADGES
// ===================================================
async function renderInbox() {
// 🛡️ SÄKERHETSSPÄRR
if (!DOM.inboxList) return; 

// Vi använder cachen istället för getElementById
const container = DOM.inboxList;

try {
const res = await fetch(`${SERVER_URL}/team/inbox?t=${Date.now()}`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte ladda kön");

const data = await res.json();

// 1. HÄMTA KATEGORIER (Läser de tre listorna direkt från servern)
let unassignedChats = data.live_chats || [];
let unassignedMails = data.mail || [];
let claimedByOthers = data.claimed || [];

// Fallback för agenter (om servern bara skickar 'tickets'-arrayen)
if (!data.live_chats && data.tickets) {
const fallback = data.tickets.filter(t => {
if (t.session_type === 'internal') return false;
if (!t.owner) return true;
if (currentUser && t.owner.toLowerCase() !== currentUser.username.toLowerCase()) return true;
return false;
});
unassignedChats = fallback.filter(t => t.session_type === 'customer' && !t.owner);
unassignedMails = fallback.filter(t => t.session_type === 'message' && !t.owner);
claimedByOthers = fallback.filter(t => t.owner);
}

// Skapa visibleTickets för städpatrullen att checka emot
const visibleTickets = [...unassignedChats, ...unassignedMails, ...claimedByOthers];

// 🧹 STÄDPATRULL - Rensar detaljvyn om ärendet blivit plockat/arkiverat
const detail = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');
const currentId = detail?.getAttribute('data-current-id');

if (detail && placeholder) {
if (!currentId) {
detail.innerHTML = ''; 
detail.style.display = 'none';
placeholder.style.display = 'flex';
} else {
const stillVisible = visibleTickets.find(t => t.conversation_id === currentId);
if (!stillVisible) {
console.log("🧹 Ärendet borta - totalrensar vyn.");
detail.innerHTML = ''; 
detail.style.display = 'none';
detail.removeAttribute('data-current-id');
placeholder.style.display = 'flex';
}
}
}

// 2. SORTERING (Nyast överst i varje korg)
const sortFn = (a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0);
unassignedChats.sort(sortFn);
unassignedMails.sort(sortFn);
claimedByOthers.sort(sortFn);

// 🔥 RENSA FÖRST NU - Efter att vi fixat vyer
container.innerHTML = ''; 

// NY RENDER GROUP med minne och Custom Badges
const renderGroup = (title, tickets, icon, groupKey, badgeClass) => {
const defaultExpanded = State.inboxExpanded[groupKey];
const header = document.createElement('div');
header.className = 'template-group-header'; 

// 🔥 HÄR ANVÄNDER VI DIN NYA CSS-KLASS FÖR BADGEN!
const countHtml = tickets.length > 0 
? `<span class="group-badge ${badgeClass}">${tickets.length}</span>` 
: `<span class="group-count empty">0</span>`;

header.innerHTML = `
<div class="group-header-content">
<span class="group-arrow ${defaultExpanded ? 'expanded' : ''}">▶</span>
<span class="group-name">${icon} ${title}</span>
</div>
${countHtml}`;

const content = document.createElement('div');
content.className = `template-group-content ${defaultExpanded ? 'expanded' : ''}`;

if (tickets.length === 0) {
content.innerHTML = `<div style="padding:15px; text-align:center; opacity:0.5; font-style:italic; font-size:13px;">Inga ärenden i denna kö.</div>`;
} else {
tickets.forEach(t => {
const card = document.createElement('div');
const isInternal = (t.session_type === 'internal' || t.routing_tag === 'INTERNAL');
const styles = isInternal ? { main: '#f1c40f', bg: 'transparent', border: 'rgba(241,196,15,0.3)', bubbleBg: 'rgba(241,196,15,0.15)' } : getAgentStyles(t.routing_tag || t.owner);

// Deklarera variablerna innan de används i HTML
const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const dateStr = new Date(t.updated_at * 1000).toLocaleDateString('sv-SE');
const actionIcon = UI_ICONS.CLAIM;
let tagText = t.routing_tag ? resolveLabel(t.routing_tag) : (t.owner ? resolveLabel(t.owner) : (t.session_type === 'message' ? 'MAIL' : 'CHATT'));

const isMail = t.session_type === 'message';
const typeIcon = isMail ? `${UI_ICONS.MAIL}` : `${UI_ICONS.CHAT}`;

card.className = `team-ticket-card${isInternal ? ' internal-ticket' : ''}`;
card.setAttribute('data-id', t.conversation_id);
card.setAttribute('data-owner', (t.owner || '').toUpperCase());

// KIRURGISK FIX: Uppdatera båda variablerna och tvinga kanten direkt
card.style.borderLeft = `4px solid ${styles.main}`;
card.style.setProperty('--agent-color', styles.main);
card.style.setProperty('--atp-color', styles.main);

// Variabler deklareras INNAN de används i sökindex och HTML
const displayTitle = esc(resolveTicketTitle(t));

// Hämtar text från context_data för att slippa "Ingen text"
let rawPreview = t.last_message || t.question || t.subject;
if (!rawPreview && t.context_data) {
try {
const ctx = typeof t.context_data === 'string' ? JSON.parse(t.context_data) : t.context_data;
if (ctx.messages && ctx.messages.length > 0) {
rawPreview = ctx.messages[0].content || ctx.messages[0].text;
}
} catch(e) {}
}
const isPrivateInbox = t.session_type === 'internal';
const previewText = isPrivateInbox
? `<span style="color:#f1c40f; display:flex; align-items:center; gap:4px;">${UI_ICONS.LOCK} Privat ärende</span>`
: stripHtml(rawPreview || "Ingen text...");
const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color: ${styles.main}; display: flex; align-items: center; opacity: 0.9;" title="${t.vehicle}">${vIcon}</span>` : '';

// Sökindex: bara synliga fält — undviker falska träffar från meddelandetext
const searchIndex = [
displayTitle, tagText, dateStr,
t.sender || '', t.contact_email || '',
t.routing_tag || '', t.owner || ''
].join(' ').toLowerCase();
card.setAttribute('data-search', searchIndex);

card.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title">
<span style="opacity:0.7; margin-right:6px; display:flex; align-items:center;">${typeIcon}</span>
<span style="color:${styles.main}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right">
${vehicleHtml}
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
<div class="ticket-preview">${previewText}</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${dateStr} • ${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="claim-mini-btn claim-action" title="Plocka ärende" style="color:${styles.main}" onclick="event.stopPropagation(); claimTicket('${t.conversation_id}')">
${UI_ICONS.CLAIM}
</button>`;

// Claim-knapp (inline onclick ersätts med querySelector-handler)
const btn = card.querySelector('.claim-action');
btn.onclick = async (e) => {
e.stopPropagation();
const myName = currentUser.username;
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id, agentName: myName })
});
showToast('✅ Ärendet är nu ditt!');
renderInbox();
};

// Long-press (800ms) aktiverar bulk mode — kort klick öppnar detaljvy
let _lpTimer = null;
let _lpFired = false;
card.addEventListener('mousedown', () => {
_lpFired = false;
_lpTimer = setTimeout(() => {
_lpFired = true;
_lpTimer = null;
if (!isBulkMode) {
isBulkMode = true;
container.classList.add('bulk-mode-active');
showBulkToolbar();
}
toggleBulkCard(card, t.conversation_id);
}, 800);
});
card.addEventListener('mouseup', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
if (_lpFired) { _lpFired = false; return; } // long press hanterade redan
if (isBulkMode) {
toggleBulkCard(card, t.conversation_id);
} else {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
card.classList.add('active-ticket');
openInboxDetail(t);
}
});
card.addEventListener('mouseleave', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
});

content.appendChild(card);
});
}

header.onclick = () => {
const isExpanded = content.classList.toggle('expanded');
header.querySelector('.group-arrow').classList.toggle('expanded');
State.inboxExpanded[groupKey] = isExpanded; 
};
container.appendChild(header);
container.appendChild(content);
};

// 🔥 RENDER GROUP MED NYA CSS-KLASSERNA FÖR BADGES (Emoji-fria)
renderGroup("Live-Chattar", unassignedChats, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>`, "Live-Chattar", "live-badge"); 

renderGroup("Inkomna MAIL", unassignedMails, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>`, "Inkomna MAIL", "mail-badge");

renderGroup("Plockade Ärenden", claimedByOthers, `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; vertical-align:middle;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`, "Plockade Ärenden", "picked-badge");

// Uppdatera även den lilla röda pricken i menyn om det behövs
updateInboxBadge();

} catch (err) {
console.error("Inbox fel:", err);
container.innerHTML = `<div class="template-item-empty" style="color:#ff6b6b">Kunde inte ladda inkorgen.</div>`;

// Felhantering för vyer
const detail = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');
if (detail && placeholder) {
detail.innerHTML = ''; // LÄGG TILL DENNA
detail.style.display = 'none';
placeholder.style.display = 'flex';
detail.removeAttribute('data-current-id');
}
}
} // Slut på async function renderInbox()

// ============================================================================
// renderInboxFromTickets — Ritar om inkorgslistan med sökresultat (MED BULK + SELECT ALL)
// ============================================================================
function renderInboxFromTickets(tickets, searchTerm) {
const container = DOM.inboxList;
if (!container) return;

container.innerHTML = '';
// TVINGA SORTERING: Nyast (högst timestamp) först i listan
tickets.sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));

if (tickets.length === 0) {
container.innerHTML = `<div class="template-item-empty" style="padding:24px; text-align:center; opacity:0.6;">
Inga ärenden matchade <strong>"${esc(searchTerm)}"</strong>
</div>`;
return;
}

// 1. SKAPA HEADER (Med "Markera alla"-knappen)
const header = document.createElement('div');
header.className = 'template-group-header';
header.style.display = 'flex';
header.style.justifyContent = 'space-between';
header.style.alignItems = 'center';

header.innerHTML = `
<div class="group-header-content">
<span class="group-name" style="opacity:0.7;">Sökresultat för "${esc(searchTerm)}"</span>
<span class="group-badge live-badge" style="margin-left:8px;">${tickets.length}</span>
</div>
<button id="btn-select-all-search" class="claim-mini-btn" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; font-size:10px; padding:4px 8px; border-radius:4px; cursor:pointer;">
Markera alla
</button>`;

// Samma ordning som i din kod
container.appendChild(header);

const content = document.createElement('div');
content.className = 'template-group-content expanded';

// Aktivera bulk-läge visuellt om det redan är igång
if (typeof isBulkMode !== 'undefined' && isBulkMode) {
container.classList.add('bulk-mode-active');
}

tickets.forEach(t => {
const card = document.createElement('div');

// 🔥 DIN ORIGINAL-MAPPING - EXAKT SOM DU SKREV DEN
const styles = getAgentStyles(t.routing_tag || t.owner);
const timeStr = new Date(t.updated_at * 1000).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const dateStr = new Date(t.updated_at * 1000).toLocaleDateString('sv-SE');
const isMail = t.session_type === 'message';
const typeIcon = isMail ? UI_ICONS.MAIL : UI_ICONS.CHAT;
const displayTitle = esc(resolveTicketTitle(t));
const previewText = stripHtml(t.last_message || "Ingen text...");
const tagText = t.routing_tag ? resolveLabel(t.routing_tag) : (t.owner ? resolveLabel(t.owner) : (isMail ? 'MAIL' : 'CHATT'));
const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color:${styles.main}; display:flex; align-items:center; opacity:0.9;" title="${t.vehicle}">${vIcon}</span>` : '';

card.className = 'team-ticket-card';
card.setAttribute('data-id', t.conversation_id);
// KIRURGISK FIX: Uppdatera båda variablerna och tvinga kanten direkt
card.style.borderLeft = `4px solid ${styles.main}`;
card.style.setProperty('--agent-color', styles.main);
card.style.setProperty('--atp-color', styles.main);

// Om kortet redan är valt i en pågående bulk-session
if (typeof selectedTicketIds !== 'undefined' && selectedTicketIds.has(t.conversation_id)) {
card.classList.add('bulk-selected');
}

card.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title">
<span style="opacity:0.7; margin-right:6px; display:flex; align-items:center;">${typeIcon}</span>
<span style="color:${styles.main}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right">
${vehicleHtml}
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
<div class="ticket-preview">${previewText}</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${dateStr} • ${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="claim-mini-btn claim-action" title="Plocka ärende" style="color:${styles.main}">
${UI_ICONS.CLAIM}
</button>`;

// --- MULTISELECT / LONG-PRESS LOGIK ---
let _lpTimer = null;
let _lpFired = false;

card.addEventListener('mousedown', () => {
_lpFired = false;
_lpTimer = setTimeout(() => {
_lpFired = true;
_lpTimer = null;
if (!isBulkMode) {
isBulkMode = true;
container.classList.add('bulk-mode-active');
if (typeof showBulkToolbar === 'function') showBulkToolbar();
}
if (typeof toggleBulkCard === 'function') toggleBulkCard(card, t.conversation_id);
}, 800);
});

card.addEventListener('mouseup', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
if (_lpFired) { _lpFired = false; return; }

if (isBulkMode) {
if (typeof toggleBulkCard === 'function') toggleBulkCard(card, t.conversation_id);
} else {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
card.classList.add('active-ticket');
openInboxDetail(t);
}
});

card.addEventListener('mouseleave', () => {
clearTimeout(_lpTimer);
_lpTimer = null;
});

const btn = card.querySelector('.claim-action');
btn.onclick = async (ev) => {
ev.stopPropagation();
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id, agentName: currentUser.username })
});
showToast('✅ Ärendet är nu ditt!');
renderInbox();
const searchEl = document.getElementById('inbox-search');
if (searchEl) searchEl.value = '';
};

content.appendChild(card);
});

// 2. APPEND CONTENT (Samma plats som i din kod)
container.appendChild(content);

// 3. LOGIK FÖR "MARKERA ALLA" (Ligger sist i funktionen)
const selectAllBtn = document.getElementById('btn-select-all-search');
if (selectAllBtn) {
selectAllBtn.onclick = (e) => {
e.stopPropagation();
if (!isBulkMode) {
isBulkMode = true;
container.classList.add('bulk-mode-active');
showBulkToolbar();
}

const currentlySelectedInSearch = tickets.filter(t => selectedTicketIds.has(t.conversation_id));
const shouldSelectAll = currentlySelectedInSearch.length < tickets.length;

tickets.forEach(t => {
const cardEl = content.querySelector(`.team-ticket-card[data-id="${t.conversation_id}"]`);
if (shouldSelectAll) {
if (!selectedTicketIds.has(t.conversation_id)) {
selectedTicketIds.add(t.conversation_id);
if (cardEl) cardEl.classList.add('bulk-selected');
}
} else {
selectedTicketIds.delete(t.conversation_id);
if (cardEl) cardEl.classList.remove('bulk-selected');
}
});

if (typeof updateBulkCount === 'function') updateBulkCount();
if (selectedTicketIds.size === 0) {
isBulkMode = false;
container.classList.remove('bulk-mode-active');
hideBulkToolbar();
}
};
}
}

// ============================================================================
// 2. DETALJVY FÖR INKORG (FIXAD: OPTIMISTISK STÄNGNING)
// ============================================================================
function openInboxDetail(ticket) {
const detailView = document.getElementById('inbox-detail');
const placeholder = document.getElementById('inbox-placeholder');

if (!detailView || !placeholder) return;

placeholder.style.display = 'none';
detailView.style.display = 'flex';
detailView.setAttribute('data-current-id', ticket.conversation_id);

const styles = getAgentStyles(ticket.routing_tag || ticket.owner);
detailView.className = 'template-editor-container';
detailView.setAttribute('data-owner', ticket.owner || 'unclaimed');
detailView.style.setProperty('border-top', 'none', 'important');
detailView.style.setProperty('background', `linear-gradient(to bottom, ${styles.bg}, transparent)`, 'important');
detailView.innerHTML = '';

const isMine = currentUser && ticket.owner === currentUser.username;
const mainTitle = esc(resolveTicketTitle(ticket));

let topActionBtn = '';
if (isSupportAgent()) {
topActionBtn += `<button class="action-icon-btn" id="detail-assign-btn" title="Tilldela ärende">${UI_ICONS.ASSIGN}</button>`;
}
if (!ticket.owner) {
topActionBtn += `<button class="action-icon-btn" id="detail-claim-btn" title="Plocka ärende">${UI_ICONS.CLAIM}</button>`;
} else if (ticket.owner && !isMine) {
topActionBtn += `<button class="action-icon-btn danger" id="detail-takeover-btn" title="Ta över från ${ticket.owner}">${UI_ICONS.TAKE_OVER}</button>`;
}

if (topActionBtn) topActionBtn = `<div style="display:flex; gap:8px; align-items:center; justify-content:flex-end;">${topActionBtn}</div>`;

let bodyContent = '';
const formatTime = (ts) => (!ts) ? '' : new Date(ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

if (ticket.session_type === 'message') {
const messages = ticket.messages || [];
let mailHistoryHtml = '';

if (messages.length === 0) {
mailHistoryHtml = '<div style="padding:40px; opacity:0.5; text-align:center;">Ingen historik ännu.</div>';
} else {
messages.forEach(m => {
const isUser = m.role === 'user';
const clean = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
const timeStr = m.timestamp ? formatTime(m.timestamp) : '';
const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleDateString('sv-SE') : '';

if (isUser) {
const avatarInitial = mainTitle ? mainTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${styles.main}; color:white; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; margin-right:12px; flex-shrink:0;">${avatarInitial}</div>`;
mailHistoryHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
${userAvatar}
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-left:2px;"><b>${mainTitle || 'Kund'}</b> • ${dateStr} ${timeStr}</div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important; padding:15px; border-radius:12px;">
${formatAtlasMessage(clean)}
</div>
</div>
</div>`;
} else {
mailHistoryHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-right:2px;">Atlas • ${timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:15px; border-radius:12px;">
${formatAtlasMessage(clean)}
</div>
</div>
<div class="msg-avatar" style="background:#3a3a3c; margin-left:12px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0; font-size:18px;">🤖</div>
</div>`;
}
});
}

bodyContent = `<div class="inbox-chat-history" style="padding:10px 5px;">${mailHistoryHtml}</div>`;
} else {
const messages = ticket.messages || [];
let chatHistoryHtml = '';

if (messages.length > 0) {
messages.forEach(m => {
const isUser = m.role === 'user';
const atlasAvatar = `<div class="msg-avatar" style="background:#3a3a3c; margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">🤖</div>`;
const userInitial = mainTitle ? mainTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${styles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${userInitial}</div>`;
const timeStr = m.timestamp ? formatTime(m.timestamp) : '';
const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleDateString('sv-SE') : '';

if (isUser) {
chatHistoryHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
${userAvatar}
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-left:2px;"><b>${mainTitle || 'Kund'}</b> • ${dateStr} ${timeStr}</div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important; padding:10px 14px; border-radius:12px;">
${formatAtlasMessage(m.content || m.text).trim()}
</div>
</div>
</div>`;
} else {
chatHistoryHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:80%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:4px; padding-right:2px;">Atlas • ${timeStr}</div>
<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:10px 14px; border-radius:12px;">
${formatAtlasMessage(m.content || m.text).trim()}
</div>
</div>
${atlasAvatar}
</div>`;
}
});
}

bodyContent = `<div class="inbox-chat-history" style="padding:10px 5px;">${chatHistoryHtml}</div>`;
}

// Villkor för Snabbsvar: admin/agent + chattärende (customer) + ej plockat
const canQuickReply = ['admin', 'agent'].includes(currentUser?.role)
&& ticket.session_type === 'customer';

const content = document.createElement('div');
content.className = 'detail-container';
content.innerHTML = `
${renderDetailHeader(ticket, styles, topActionBtn)}
<div class="detail-body scroll-list" id="inbox-detail-body">
${bodyContent}
</div>
${canQuickReply ? `
<div id="quick-reply-area" style="padding:8px 16px; border-top:1px solid ${styles.border}; background:${styles.bg}; display:flex; align-items:flex-end; gap:8px;">
<textarea id="quick-reply-input" placeholder="Snabbsvar... (Ctrl+Enter)"
style="flex:1; min-height:44px; max-height:120px; resize:vertical; padding:8px 10px; border-radius:8px;
background:rgba(255,255,255,0.07); border:1px solid ${styles.border};
color:var(--text-primary); font-size:13px; font-family:inherit; box-sizing:border-box;"></textarea>
<button id="btn-quick-reply-send" title="Skicka svar" style="flex-shrink:0; width:36px; height:36px; border-radius:8px;
background:${styles.main}; color:white; border:none; cursor:pointer;
display:flex; align-items:center; justify-content:center;">
${UI_ICONS.SEND}
</button>
</div>` : ''}
<div class="detail-footer-area">
<div class="detail-footer-toolbar" style="padding: 12px 20px; border-top:1px solid var(--border-color); background:rgba(0,0,0,0.25); display:flex; justify-content:flex-end; gap:12px;">
<button class="footer-icon-btn btn-archive-red" id="btn-archive" title="Arkivera">${UI_ICONS.ARCHIVE}</button>
<button class="footer-icon-btn danger" id="btn-delete" title="Ta bort permanent">${UI_ICONS.TRASH}</button>
</div>
</div>
`;

detailView.style.padding = '0';
detailView.style.background = 'transparent';
detailView.innerHTML = '';
detailView.appendChild(content);
refreshNotesGlow(ticket.conversation_id);

// Koppla Quick Reply-logik efter HTML är i DOM
if (canQuickReply) {
const quickReply = async () => {
const input = document.getElementById('quick-reply-input');
const msg = (input?.value || '').trim();
if (!msg) return;
const qrBtn = document.getElementById('btn-quick-reply-send');
if (qrBtn) { qrBtn.disabled = true; qrBtn.style.opacity = '0.5'; }
try {
// 1. Claima ärendet (flyttar det till Mina Ärenden)
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST', headers: fetchHeaders,
body: JSON.stringify({ conversationId: ticket.conversation_id, agentName: currentUser.username })
});
// 2. Skicka svaret via socket
window.socketAPI.emit('team:agent_reply', {
conversationId: ticket.conversation_id,
message: msg
});
// Stäng detail + ladda om inkorg (ärendet försvinner dit — det är nu i Mina Ärenden)
clearDetailView();
renderInbox();
renderMyTickets?.();
showToast('✅ Svar skickat! Ärendet ligger i Mina Ärenden.');
} catch(err) {
console.error('[QuickReply] Fel:', err);
showToast('❌ Fel vid skicka — försök igen.');
if (qrBtn) { qrBtn.disabled = false; qrBtn.style.opacity = '1'; }
}
};
const qrBtn = document.getElementById('btn-quick-reply-send');
if (qrBtn) qrBtn.onclick = quickReply;
const qrInput = document.getElementById('quick-reply-input');
if (qrInput) qrInput.addEventListener('keydown', (e) => {
if (e.ctrlKey && e.key === 'Enter') quickReply();
});
}

const clearDetailView = () => {
if (detailView) {
detailView.innerHTML = '';
detailView.style.display = 'none';
detailView.removeAttribute('data-current-id');
}
if (placeholder) { placeholder.style.display = 'flex'; }
};

const handleClaim = async (action) => {
clearDetailView();
try {
if (window.electronAPI) {
await window.atlasTeam.claimTicket(ticket.conversation_id, currentUser.username);
} else {
await fetch(`${SERVER_URL}/team/claim`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: ticket.conversation_id })
});
}
const toastMsg = action === 'takeover' ? '✅ Du har tagit över ärendet!' : '✅ Ärendet är nu ditt!';
showToast(toastMsg);
renderInbox();
updateInboxBadge();
} catch (err) {
console.error("Fel vid claim:", err);
}
};

const assignBtn = document.getElementById('detail-assign-btn');
if (assignBtn) assignBtn.onclick = async () => { await showAssignModal(ticket); };

const claimBtn = document.getElementById('detail-claim-btn');
if (claimBtn) claimBtn.onclick = () => handleClaim('claim');

const takeoverBtn = document.getElementById('detail-takeover-btn');
if (takeoverBtn) takeoverBtn.onclick = () => handleClaim('takeover');

const inboxArchive = document.getElementById('btn-archive');
if (inboxArchive) {
inboxArchive.onclick = async () => {
clearDetailView();
try {
await fetch(`${SERVER_URL}/api/inbox/archive`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: ticket.conversation_id }) });
showToast('✅ Ärendet arkiverat!');
renderInbox();
} catch (err) {
console.error("Fel vid arkivering:", err);
}
};
}

const inboxDelete = document.getElementById('btn-delete');
if (inboxDelete) {
inboxDelete.onclick = async () => {
if (await atlasConfirm('Ta bort', 'Är du säker? Detta raderar ärendet permanent.')) {
clearDetailView();

try {
await fetch(`${SERVER_URL}/api/inbox/delete`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: ticket.conversation_id }) });

if (window.electronAPI && ticket.id) {
await window.electronAPI.deleteQA(ticket.id).catch(e => console.log("Lokal städning ej nödvändig"));
}

showToast("✅ Ärendet raderat");

const listContainer = document.getElementById('inbox-list');
if (listContainer) {
const cards = listContainer.querySelectorAll('.team-ticket-card');
cards.forEach(card => {
if (card.getAttribute('data-id') === ticket.conversation_id) {
card.remove();
}
});
if (listContainer.children.length === 0) {
listContainer.innerHTML = `
<div class="template-item-empty" style="padding:40px; text-align:center; opacity:0.6;">
<div style="margin-bottom:15px; opacity: 0.3;">
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
</div>
<div>Inga olösta ärenden.</div>
</div>`;
}
}
} catch (err) {
console.error("Fel vid radering:", err);
showToast("❌ Kunde inte radera ärendet");
}
}
};
}
}

// ============================================================================
// MINA ÄRENDEN: LISTA (FIXAD: Rätt namn & Agent-etikett)
// ============================================================================
async function renderMyTickets() {
// 🛡️ SÄKERHETSSPÄRR
if (!DOM.myTicketsList) return;

// Vi använder cachen istället för getElementById
const container = DOM.myTicketsList;

try {
const res = await fetch(`${SERVER_URL}/team/my-tickets?t=${Date.now()}`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte hämta ärenden");
const data = await res.json();
let tickets = data.tickets || [];
tickets.sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));

// Filtrera till agentens egna ärenden + kontorsärenden
if (window.currentUser && window.currentUser.username) {
const myName = window.currentUser.username.toLowerCase();

// Agentens bevakade kontor-taggar (från token/localStorage)
const myOfficeTags = (window.currentUser.routing_tag || '')
.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

// TILLÅT OM: Jag är personlig ägare ELLER kontoret tillhör mig ELLER avsändare (interna)
tickets = tickets.filter(t => {
if (t.owner && t.owner.toLowerCase() === myName) return true;
if (t.sender && t.sender.toLowerCase() === myName) return true;
if (t.routing_tag && myOfficeTags.includes(t.routing_tag.toLowerCase())) return true;
return false;
});
}

// 🔥 KIRURGISK FIX: Ta bort "Inga ärenden"-vyn om vi faktiskt har ärenden nu
if (tickets.length > 0) {
const existingPlaceholder = container.querySelector('.template-item-empty');
if (existingPlaceholder) existingPlaceholder.remove();
}

// Städpatrull: Ta bort kort som inte längre ska finnas i listan (arkiverade etc)
const ticketIds = tickets.map(t => t.conversation_id);
Array.from(container.children).forEach(card => {
const id = card.getAttribute('data-id');
if (id && !ticketIds.includes(id)) card.remove();
});

// 🧹 STÄDPATRULL (Totalrensar om ärendet inte längre är ditt)
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');
const currentId = detail?.getAttribute('data-current-id');

if (detail && placeholder) {
if (!currentId) {
detail.innerHTML = ''; 
detail.style.display = 'none';
placeholder.style.display = 'flex';
} else {
const stillMine = tickets.find(t => t.conversation_id === currentId);
if (!stillMine) {
console.log("🧹 Ärendet borta - totalrensar Mina Ärenden-vyn.");
detail.innerHTML = ''; // <--- VIKTIGT: Rensar bort "skiten" som annars fastnar
detail.style.display = 'none';
detail.removeAttribute('data-current-id');
placeholder.style.display = 'flex';
}
}
}

// 🔥 RENSA LISTAN INNAN RENDER
//container.innerHTML = '';

if (tickets.length === 0) {
container.innerHTML = `
<div class="template-item-empty" style="padding:40px; text-align:center; opacity:0.6;">
<div style="margin-bottom:15px; opacity: 0.3;">
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
</div>
<div>Du har inga pågående ärenden.</div>
</div>`;
return;
}

tickets.forEach((t, index) => {
const myName = currentUser.username;
const isInternal = (t.session_type === 'internal' || t.routing_tag === 'INTERNAL');
const styles = isInternal ? { main: '#f1c40f', bg: 'transparent', border: 'rgba(241,196,15,0.3)', bubbleBg: 'rgba(241,196,15,0.15)' } : getAgentStyles(t.routing_tag || t.owner || myName);

// Visa kontoret (routing_tag) på kortet. Interna ärenden visar avsändarens visningsnamn.
const tagText = (t.session_type === 'internal')
? (() => { const u = usersCache.find(u => u.username === (t.sender || t.owner)); return (u?.display_name || t.sender || t.owner || 'INTERN').toUpperCase(); })()
: resolveLabel(t.routing_tag || t.owner || myName);

const isMail = t.session_type === 'message';
const typeIcon = isMail ? `${UI_ICONS.MAIL}` : `${UI_ICONS.CHAT}`;
let displayTitle = resolveTicketTitle(t);

if (t.session_type === 'internal' && t.sender) {
displayTitle = (typeof formatName === 'function') ? formatName(t.sender) : t.sender;
}

// Hämtar text från context_data
let myRawPreview = t.last_message || t.question || t.subject;
if (!myRawPreview && t.context_data) {
try {
const ctx = typeof t.context_data === 'string' ? JSON.parse(t.context_data) : t.context_data;
if (ctx.messages && ctx.messages.length > 0) {
myRawPreview = ctx.messages[0].content || ctx.messages[0].text;
}
} catch(e) {}
}
const isPrivateTicket = t.session_type === 'internal';
const myPreviewText = isPrivateTicket
? `<span style="color:#f1c40f; display:flex; align-items:center; gap:4px;">${UI_ICONS.LOCK} Privat ärende</span>`
: stripHtml(myRawPreview || "...");

const vIcon = getVehicleIcon(t.vehicle);
const vehicleHtml = vIcon ? `<span style="color: ${styles.main}; display: flex; align-items: center; opacity: 0.9;" title="${t.vehicle}">${vIcon}</span>` : '';
const timeStr = new Date(t.updated_at * 1000).toLocaleString('sv-SE', { 
year: 'numeric', month: 'numeric', day: 'numeric', 
hour: '2-digit', minute: '2-digit' 
});

// Kolla om kortet redan finns, annars skapa det
let card = container.querySelector(`.team-ticket-card[data-id="${t.conversation_id}"]`);
const isNew = !card;

if (isNew) {
card = document.createElement('div');
card.className = `team-ticket-card mine${isInternal ? ' internal-ticket' : ''}`;
card.setAttribute('data-id', t.conversation_id);
card.setAttribute('data-owner', (t.owner || '').toUpperCase());
}

// Tvinga uppdatering av färg och kant vid varje rendering (Dubbel-säkrad för alla vyer)
card.style.borderLeft = `4px solid ${styles.main}`;
card.style.setProperty('--agent-color', styles.main);
card.style.setProperty('--atp-color', styles.main);

if (currentId === t.conversation_id) {
card.classList.add('active-ticket');
card.style.background = "rgba(255,255,255,0.1)";
}

// Rensat dubbel-taggar och trasiga knappar
// ERSÄTT card.innerHTML i renderMyTickets med detta:
card.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title">
<span style="opacity:0.7; margin-right:4px; display:flex; align-items:center;">${typeIcon}</span>
<span style="color:${styles.main}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right">
${vehicleHtml}
<button class="notes-trigger-btn" data-id="${t.conversation_id}" title="Interna anteckningar" style="color:${styles.main}" onclick="event.stopPropagation(); openNotesModal('${t.conversation_id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
<div class="ticket-preview">${myPreviewText}</div>

<div class="ticket-footer-bar">
<div class="ticket-time">${timeStr}</div>
<div class="ticket-tag" style="color:${styles.main}">${tagText}</div>
</div>
<button class="mini-action-btn archive-action" title="Arkivera till Garaget" style="color:${styles.main}" onclick="event.stopPropagation(); archiveTicket('${t.conversation_id}')">
${UI_ICONS.ARCHIVE}
</button>`;

card.onclick = () => {
container.querySelectorAll('.team-ticket-card').forEach(c => {
c.classList.remove('active-ticket');
c.style.background = ''; 
});
card.classList.add('active-ticket');
card.style.background = "rgba(255,255,255,0.1)";
openMyTicketDetail(t);
};

const btn = card.querySelector('.archive-action');
if(btn) {
btn.onclick = async (e) => {
e.stopPropagation();
try {
await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: t.conversation_id })
});
showToast('✅ Ärendet arkiverat!');
// STÄNG VYN: Om det arkiverade ärendet råkar vara det som är öppet
checkAndResetDetail('my-ticket-detail', t.conversation_id);
renderMyTickets();
} catch(err) {
console.error("Arkiveringsfel:", err);
}
};
}

// Placera kortet på rätt plats enligt sortering
if (container.children[index] !== card) {
container.insertBefore(card, container.children[index]);
} else if (!card.parentNode) {
container.appendChild(card);
}
});

} catch (err) {
console.error("Mina ärenden fel:", err);
container.innerHTML = '<div class="template-item-empty" style="color:#ff6b6b">Kunde inte ladda listan.</div>';

// Återställ och RENSA vyer vid fel
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');
if (detail && placeholder) {
detail.innerHTML = ''; // Rensa!
detail.style.display = 'none';
placeholder.style.display = 'flex';
detail.removeAttribute('data-current-id');
}
}
}

// =========================================================
// 🧹 MINA ÄRENDEN - FUNKTIONEN (KOMPLETT VERSION)
// =========================================================
function openMyTicketDetail(ticket) {
const detail = document.getElementById('my-ticket-detail');
const placeholder = document.getElementById('my-detail-placeholder');

if (!detail || !placeholder) return;

placeholder.style.display = 'none';
detail.style.display = 'flex';
detail.setAttribute('data-current-id', ticket.conversation_id);

// 1. STILAR & FÄRG (FIX FÖR GULT & INGEN LINJE)
// Vi inkluderar _isLocal här så att dina egna Ida-chattar blir gula
const isInternal = (ticket.session_type === 'internal' || ticket.routing_tag === 'INTERNAL' || ticket._isLocal);

const internalYellow = {
main: '#f1c40f',
bg: 'transparent', // Ingen bakgrundsfärg som kan läcka
border: 'rgba(241, 196, 15, 0.3)',
bubbleBg: 'rgba(241, 196, 15, 0.15)'
};

let styles = isInternal ? internalYellow : getAgentStyles(ticket.routing_tag || ticket.owner);

detail.classList.add('template-editor-container');
detail.setAttribute('data-owner', ticket.owner || 'unclaimed');

// HÄR DÖDAR VI LINJERNA HELT
detail.style.setProperty('border-top', 'none', 'important');
detail.style.setProperty('border-bottom', 'none', 'important');
detail.style.setProperty('background', 'none', 'important');
detail.style.setProperty('box-shadow', 'none', 'important');

detail.innerHTML = '';

// 2. DATA-PREPP (KIRURGISK FIX FÖR MAIL-TYP)
const displayTitle = resolveTicketTitle(ticket);
const isMail = ticket.session_type === 'mail' || ticket.session_type === 'message' || ticket.routing_tag === 'MAIL';

// --- CHATT / MAIL ---
let bodyContent = '';

if (isMail) {
const messages = ticket.messages || [];

// Oscar Berg-fix: Om historik saknas, använd ticket.last_message
if (messages.length === 0) {
const raw = ticket.last_message || ticket.content || "Inget innehåll...";
const clean = raw.replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
bodyContent = `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;">
<div class="msg-avatar" style="background:${styles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">K</div>
<div style="display:flex; flex-direction:column; max-width:75%;">
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px;"><b>Inkommet Mail</b></div>
<div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important;">${formatAtlasMessage(clean)}</div>
</div>
</div>`;
} else {
messages.forEach(m => {
const isUser = m.role === 'user';
const clean = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');

bodyContent += `
<div class="msg-row ${isUser ? 'user' : 'atlas'}" style="display:flex; width:100%; margin-bottom:12px; justify-content:${isUser ? 'flex-start' : 'flex-end'};">
${isUser ? `<div class="msg-avatar" style="background:${styles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">K</div>` : ''}
<div class="bubble" style="background: ${isUser ? styles.bubbleBg : 'rgba(255,255,255,0.05)'} !important; border: 1px solid ${isUser ? styles.border : 'rgba(255,255,255,0.1)'} !important; color: var(--text-primary) !important; max-width:75%;">${formatAtlasMessage(clean)}</div>
${!isUser ? '<div class="msg-avatar" style="background:#3a3a3c; margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%;">🤖</div>' : ''}
</div>`;
});
}
} else {
// --- CHATT (MINA ÄRENDEN) ---
const messages = ticket.messages || []; 
messages.forEach(m => {
const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '';
const dateStrMsg = m.timestamp ? new Date(m.timestamp).toLocaleDateString('sv-SE') : '';

let isUser = (m.role === 'user');
let rowDisplayTitle = displayTitle; 

if (isInternal) {
if (m.sender && m.sender.toLowerCase() !== currentUser.username.toLowerCase()) {
isUser = true;
rowDisplayTitle = (typeof formatName === 'function') ? formatName(m.sender) : m.sender;
} else {
isUser = false;
}
}

const senderStyles = isInternal ? internalYellow : (isUser ? getAgentStyles(m.sender) : styles);
const leftInitial = rowDisplayTitle ? rowDisplayTitle.charAt(0).toUpperCase() : 'K';
const userAvatar = `<div class="msg-avatar" style="background:${senderStyles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${leftInitial}</div>`;

let rightAvatarContent = '🤖';
let rightAvatarStyle = 'background:#3a3a3c;';

if (isInternal && !isUser) {
rightAvatarContent = currentUser.username.charAt(0).toUpperCase();
rightAvatarStyle = `background:${styles.main}; color:white; font-weight:bold;`;
}

const atlasAvatar = `<div class="msg-avatar" style="${rightAvatarStyle} margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0;">${rightAvatarContent}</div>`;
const content = formatAtlasMessage(m.text || m.content || "").trim();

if (isUser) {
bodyContent += `<div class="msg-row user" style="display:flex; width:100% !important; margin-bottom:12px; justify-content:flex-start;">${userAvatar}<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:75%;"><div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-left:4px;"><b>${rowDisplayTitle || 'Kund'}</b> • ${dateStrMsg} ${time}</div><div class="bubble" style="background:${senderStyles.bubbleBg} !important; border:1px solid ${senderStyles.border} !important; color:var(--text-primary) !important;">${content}</div></div></div>`;
} else {
const senderLabel = isInternal ? 'Du' : 'Atlas';
bodyContent += `<div class="msg-row atlas" style="display:flex; width:100% !important; margin-bottom:12px; justify-content:flex-end;"><div style="display:flex; flex-direction:column; align-items:flex-end; max-width:75%;"><div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:2px; padding-right:4px;">${senderLabel} • ${time}</div><div class="bubble" style="background:${styles.bubbleBg} !important; border:1px solid ${styles.border} !important; color:var(--text-primary) !important;">${content}</div></div>${atlasAvatar}</div>`;
}
});
}

const typingText = isInternal ? '✍️ Kollegan skriver...' : '✍️ Kunden skriver...';
bodyContent += `<div id="typing-indicator-${ticket.conversation_id}" style="display:none; padding:5px 15px; font-size:12px; color:${styles.main}; font-style:italic; margin-top:5px; text-align:left;">${typingText}</div>`;

let templateOptions = `<option value="">📋 Välj mall att kopiera...</option>`;
if (State.templates) {
State.templates.forEach(t => { templateOptions += `<option value="${t.id}">${t.title}</option>`; });
}

const contentBox = document.createElement('div');
contentBox.className = 'detail-container';
contentBox.innerHTML = `
${renderDetailHeader(ticket, styles)}
<div class="detail-body scroll-list" id="my-chat-scroll-area">
${bodyContent}
</div>
<div class="detail-footer-area">
<form id="my-ticket-chat-form">
<textarea id="my-ticket-chat-input" placeholder="${ticket.is_archived ? 'Ärendet är arkiverat' : 'Skriv ett meddelande...'}" ${ticket.is_archived ? 'disabled' : ''}></textarea>
<button type="submit" id="${isMail ? 'btn-send-mail-action' : 'btn-reply-action'}" class="send-button-ticket">
${UI_ICONS.SEND}
</button>
</form>
<div style="display:flex; justify-content: space-between; align-items:center; padding: 0 20px 15px 20px;">
<div style="flex:1; max-width:60%;"><select id="quick-template-select" class="filter-select">${templateOptions}</select></div>
<div style="display:flex; gap:10px;">
${isMail ? `<button type="button" class="footer-icon-btn" id="btn-ai-draft" title="AI Förslag">${UI_ICONS.AI}</button>` : ''}
<button type="button" class="footer-icon-btn btn-archive-red" id="btn-archive-my" title="Arkivera">${UI_ICONS.ARCHIVE}</button>
<button type="button" class="footer-icon-btn danger" id="btn-delete-my" title="Radera">${UI_ICONS.TRASH}</button>
</div>
</div>
</div>
`;

detail.style.padding = '0';
detail.style.background = 'transparent';
detail.innerHTML = '';
detail.appendChild(contentBox);

refreshNotesGlow(ticket.conversation_id);

const scrollArea = document.getElementById('my-chat-scroll-area');
if (scrollArea) {
scrollArea.style.scrollBehavior = 'auto';
scrollArea.scrollTop = scrollArea.scrollHeight; // Scrolla till botten direkt
scrollArea.setAttribute('data-auto-scroll', 'true');
}

if (!isMail) {
const chatInput = document.getElementById('my-ticket-chat-input');
let typingTimer;
if (chatInput) {
chatInput.addEventListener('input', () => {
window.socketAPI.emit('team:agent_typing', { sessionId: ticket.conversation_id, is_typing: true });
clearTimeout(typingTimer);
typingTimer = setTimeout(() => {
window.socketAPI.emit('team:agent_typing', { sessionId: ticket.conversation_id, is_typing: false });
}, 2500);
});
setTimeout(() => chatInput.focus(), 50);
}
}

attachMyTicketListeners(ticket, isMail);
}

// =========================================================
// 🔌 KNAPPAR & LYSSNARE (SMART HTML-HANTERING)
// =========================================================
function attachMyTicketListeners(ticket, isMail) {

// Variabel för att spara mallens "snygga" HTML (med bilder/fetstil) i bakgrunden
let activeTemplateHtml = null; 

// 1. VÄLJ MALL -> SPARA HTML & VISA TEXT
const tSelect = document.getElementById('quick-template-select');
if (tSelect) {
tSelect.onchange = () => {
const tId = tSelect.value;
if (!tId) return;
const t = State.templates.find(x => x.id == tId);

if (t) {
const inp = document.getElementById('my-ticket-chat-input');
if (inp) {
// Spara original-HTML (med bilder etc) i minnet
activeTemplateHtml = t.content;

// Visa ren text i rutan så du ser vad du skickar
const tempDiv = document.createElement('div');
tempDiv.innerHTML = t.content;
const cleanText = (tempDiv.innerText || tempDiv.textContent || '').trim();

inp.value = cleanText; 
inp.focus(); 

// Trigga input-eventet så att rutan kan auto-expandera om det behövs
inp.dispatchEvent(new Event('input'));

tSelect.value = ""; 
}
}
};
}

// Lyssna om du ändrar texten manuellt
const inpField = document.getElementById('my-ticket-chat-input');
if (inpField) {
inpField.addEventListener('input', () => {
// Om du ändrar texten manuellt, måste vi släppa mallens HTML
activeTemplateHtml = null;
});
}

// 2. SKICKA-KNAPPEN
const form = document.getElementById('my-ticket-chat-form');
if(form) {
form.onsubmit = (e) => {
e.preventDefault();
const inp = document.getElementById('my-ticket-chat-input');
const msg = inp.value.trim();
if(!msg) return;

if (isMail) {

// SKICKA MAIL (mall-HTML om vald, annars konvertera radbrytningar till <br>)
window.socketAPI.emit('team:send_email_reply', {
conversationId: ticket.conversation_id,
message: msg,
html: activeTemplateHtml || msg.replace(/\n/g, '<br>'),
customerEmail: ticket.contact_email || '',
subject: ticket.subject || 'Svar'
});

// Visuell feedback på knappen
const btn = form.querySelector('button[type="submit"]');
const originalText = btn.innerHTML;
btn.innerHTML = "⏳ Skickar...";
btn.disabled = true;

setTimeout(() => {
btn.innerHTML = originalText;
btn.disabled = false;
}, 2000);

} else {

// SKICKA CHATT
window.socketAPI.emit('team:agent_reply', { 
conversationId: ticket.conversation_id, 
message: msg 
});
}
inp.value = '';
activeTemplateHtml = null; // Nollställ
};
}

// 3. AI TROLLSTAV
const btnAI = document.getElementById('btn-ai-draft');
if (btnAI && isMail) {
btnAI.onclick = () => {
const inp = document.getElementById('my-ticket-chat-input');
const originalMsg = ticket.messages && ticket.messages.length > 0 ? ticket.messages[0].content : ticket.last_message;
inp.value = "🤖 Tänker så det knakar... (Hämtar AI-svar)";
inp.disabled = true;

window.socketAPI.emit('team:email_action', { 
conversationId: ticket.conversation_id, 
action: 'draft',
content: originalMsg 
});
};
}

// 4. Arkivera (Direkt utan bekräftelsepopup — toast visas istället)
const btnArch = document.getElementById('btn-archive-my');
if(btnArch) btnArch.onclick = async () => {
archiveTicketFromMyTickets(ticket.conversation_id);
showToast('✅ Ärendet arkiverat!');
checkAndResetDetail('inbox-detail');
checkAndResetDetail('my-ticket-detail');
checkAndResetDetail('archive-detail');
};

const btnDel = document.getElementById('btn-delete-my');
if(btnDel) {
btnDel.onclick = async () => {
if (await atlasConfirm('Ta bort', 'Är du säker? Detta raderar ärendet permanent från databasen.')) {

// UI-Reset
checkAndResetDetail('my-ticket-detail');

try {
// 1. Radera på Servern (MASTER DELETE)
await fetch(`${SERVER_URL}/api/inbox/delete`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId: ticket.conversation_id })
});

// 2. Radera lokalt om Electron
if (window.electronAPI) {
// Vi använder ticket.id eller conversation_id
const idToDelete = ticket.id || ticket.conversation_id;
if(idToDelete) await window.electronAPI.deleteQA(idToDelete).catch(e => console.log("Lokal städning ej nödvändig"));
}

// 3. Visa toast-notifiering
showToast("✅ Ärendet raderat");

// 4. Ta bort från UI utan att göra full refresh
const listContainer = document.getElementById('my-tickets-list');
if (listContainer) {
const cards = listContainer.querySelectorAll('.team-ticket-card');
cards.forEach(card => {
if (card.getAttribute('data-id') === ticket.conversation_id) {
card.remove();
}
});
}

// 5. Om listan blir tom, visa placeholder
if (listContainer && listContainer.children.length === 0) {
listContainer.innerHTML = `
<div class="template-item-empty" style="padding:40px; text-align:center; opacity:0.6;">
<div style="margin-bottom:15px; opacity: 0.3;">
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>
</div>
<div>Du har inga pågående ärenden.</div>
</div>`;
}
} catch (err) {
console.error("Kunde inte radera på servern:", err);
showToast("❌ Kunde inte radera ärendet");
}
};
}
} // End of attachMyTicketListeners function -- stänger if(btnDel) + funktionen
} // stänger attachMyTicketListeners

// ============================================================================
// Ersättare för window.prompt med glassmorphism-design
// ============================================================================
function atlasPrompt(title, message, defaultValue = '') {
return new Promise((resolve) => {
let modal = document.getElementById('atlas-prompt-modal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-prompt-modal';
modal.className = 'custom-modal-overlay';
modal.style.display = 'none';
modal.style.zIndex = '30000';

modal.innerHTML = `
<div class="glass-modal-box">
<div class="glass-modal-header">
<h3 id="prompt-title"></h3>
</div>
<div class="glass-modal-body">
<p id="prompt-message"></p>
<textarea id="prompt-input" style="width:100%; height:80px; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; resize:none; font-family:inherit; font-size:14px; margin-top:10px;"></textarea>
</div>
<div class="glass-modal-footer">
<button id="prompt-cancel" class="btn-modal-cancel">Avbryt</button>
<button id="prompt-confirm" class="btn-modal-confirm">OK</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

const titleEl = modal.querySelector('#prompt-title');
const msgEl = modal.querySelector('#prompt-message');
const inputEl = modal.querySelector('#prompt-input');
const confirmBtn = modal.querySelector('#prompt-confirm');
const cancelBtn = modal.querySelector('#prompt-cancel');

titleEl.textContent = title;
msgEl.textContent = message;

// Sätter defaultValue om det finns (t.ex. vid redigering), annars tomt
inputEl.value = defaultValue; 

modal.style.display = 'flex';
setTimeout(() => {
inputEl.focus();

// Placerar markören i slutet av texten om det är en redigering
inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
}, 50);

const close = (val) => {
modal.style.display = 'none';
confirmBtn.onclick = null;
cancelBtn.onclick = null;
resolve(val);
};

confirmBtn.onclick = () => close(inputEl.value);
cancelBtn.onclick = () => close(null);
});
}

// Hjälpfunktion för att faktiskt utföra arkiveringen mot servern
async function archiveTicketFromMyTickets(conversationId) {
try {
const res = await fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId })
});

if (!res.ok) throw new Error('Kunde inte arkivera ärendet');

// Återställ UI - TOTALRENSNING
const myDetail = document.getElementById('my-ticket-detail');
if (myDetail) {
myDetail.innerHTML = ''; 
myDetail.style.display = 'none';
myDetail.removeAttribute('data-current-id');
}
const myPlaceholder = document.getElementById('my-detail-placeholder');
if (myPlaceholder) myPlaceholder.style.display = 'flex';

renderMyTickets();
updateInboxBadge();

} catch (err) {
console.error("Arkivfel:", err);
alert("Ett fel uppstod vid arkivering: " + err.message);
}
}

/* ===============================================================
RENDER ARCHIVE (GARAGET) - MED SÖKFUNKTION & OPTIMERING (FIXAD)
=============================================================== */
async function renderArchive(applyFilters = false) {
// 🛡️ SÄKERHETSSPÄRR
if (!DOM.archiveList) return;

// Vi använder cachen istället för getElementById
const container = DOM.archiveList;

// 1. Hämta data (om vi inte bara filtrerar befintlig data)
if (!applyFilters) {
State.archiveItems = []; 

try {
const res = await fetch(`${SERVER_URL}/api/archive`, { headers: fetchHeaders });
if (res.ok) {
const data = await res.json();
if (data.archive) State.archiveItems.push(...data.archive);
}
} catch (err) { console.error("Server-arkiv fel:", err); }

if (window.electronAPI) {
try {
const localAll = await window.electronAPI.loadQAHistory();
const localArchived = localAll.filter(item => item.is_archived === 1);

// --- FIX: DUBBLETT-KOLL BÖRJAR HÄR ---
localArchived.forEach(x => {
// Kolla om ärendet redan laddats från servern (via conversation_id)
const exists = State.archiveItems.some(serverItem => 
serverItem.conversation_id === x.conversation_id
);

// Lägg bara till om det INTE finns
if (!exists) {
x._isLocal = true;
State.archiveItems.push(x);
}
});

} catch (err) { console.error("Lokalt arkiv fel:", err); }
}
populateArchiveDropdowns();
}

// 2. HÄMTA VÄRDEN FRÅN FILTER & SÖK (UPPDATERAD: OFFICE & SUPER-SEARCH)
const typeVal = document.getElementById('filter-type')?.value || 'all';
const agentVal = document.getElementById('filter-agent')?.value || 'all';
const vehicleVal = document.getElementById('filter-vehicle')?.value || 'all';
const cityVal = document.getElementById('filter-city')?.value || 'all';
const officeVal = document.getElementById('filter-office')?.value || 'all';
const dateStart = document.getElementById('filter-date-start')?.value;
const dateEnd = document.getElementById('filter-date-end')?.value;
const searchText = document.getElementById('filter-search')?.value.toLowerCase().trim() || '';

// Hämta värdet från AI-checkboxen
const showAI = document.getElementById('archive-show-ai')?.checked || false;

let filtered = State.archiveItems.filter(item => {

// --- 🔥 H. AI-FILTER (MÅSTE VARA FÖRST FÖR ATT REAGERA DIREKT) ---
// Om ärendet är ett rent AI-svar (human_mode === 0) och checkboxen INTE är ikryssad -> Dölj det.
if (item.human_mode === 0 && !showAI) return false;

// A. TYP (Mail/Chatt)
const itemType = item.session_type === 'message' ? 'mail' : 'chat';
if (typeVal !== 'all' && itemType !== typeVal) return false;

// B. AGENT (Ägare)
if (agentVal !== 'all' && item.owner !== agentVal) return false;

// C. FORDON
const itemVehicle = item.vehicle || "Okänd";
if (vehicleVal !== 'all' && itemVehicle !== vehicleVal) return false;

// D. STAD (Kolla både item.city och ägarens stad)
if (cityVal !== 'all') {
const itemCity = item.city || (typeof getCityFromOwner === 'function' ? getCityFromOwner(item.owner) : '');
if (itemCity !== cityVal) return false;
}

// E. KONTOR (Ny hierarki)
if (officeVal !== 'all') {
const itemOffice = item.office || item.routing_tag || '';
if (itemOffice !== officeVal) return false;
}

// F. DATUM
if (dateStart || dateEnd) {
const itemDate = new Date(item.timestamp).setHours(0, 0, 0, 0);
if (dateStart && itemDate < new Date(dateStart).setHours(0, 0, 0, 0)) return false;
if (dateEnd && itemDate > new Date(dateEnd).setHours(0, 0, 0, 0)) return false;
}

// G. SUPER-SEARCH (Inkluderar Notes, Kontaktinfo och ID:n)
if (searchText) {
const searchableString = [
item.contact_name, 
item.contact_email, 
item.contact_phone,
item.subject, 
item.question, 
item.conversation_id,
item.id, 
item.city, 
item.office,
item.vehicle,
item.notes, // 🔥 Nu kan du söka i interna anteckningar!
item.owner
].filter(Boolean).join(' ').toLowerCase();

if (!searchableString.includes(searchText)) return false;
}
return true;
});

// Sortera efter senaste händelse
filtered.sort((a, b) => b.timestamp - a.timestamp);

// 🧹 STÄDPATRULL (Rensar detaljvyn om inga träffar finns)
const detail = document.getElementById('archive-detail');
const placeholder = document.getElementById('archive-placeholder');
if (filtered.length === 0 && detail && placeholder) {
detail.style.display = 'none';
placeholder.style.display = 'flex';
}

container.innerHTML = '';
if (filtered.length === 0) {
container.innerHTML = '<div class="template-item-empty">Inga ärenden matchade sökningen.</div>';
return;
}

// 3. RENDERA LISTAN
filtered.forEach(item => {
const el = document.createElement('div');

// Identifiera interna ärenden och skapa en CSS-klass för dem
const isInternal = (item.routing_tag === 'INTERNAL' || item.session_type === 'internal' || item._isLocal);
const internalClass = isInternal ? 'internal-ticket' : '';

const styles = isInternal ? { main: '#f1c40f' } : getAgentStyles(item.routing_tag || item.owner || (item._isLocal ? currentUser.username : 'unclaimed'));

const isMail = item.session_type === 'message';
const typeIcon = isMail ? `${UI_ICONS.MAIL}` : `${UI_ICONS.CHAT}`;

let displayTitle = resolveTicketTitle(item) || "Ärende utan titel";
if (isInternal && item.sender) {
displayTitle = (typeof formatName === 'function') ? formatName(item.sender) : item.sender;
}

// Hämta preview
let rawPreview = item.question || item.last_message || item.subject;
if (!rawPreview && item.context_data) {
try {
const ctx = typeof item.context_data === 'string' ? JSON.parse(item.context_data) : item.context_data;
if (ctx.messages && ctx.messages.length > 0) {
rawPreview = ctx.messages[0].content || ctx.messages[0].text;
}
} catch(e) {}
}

const vIcon = getVehicleIcon(item.vehicle);
const fullDateStr = new Date(item.timestamp).toLocaleString('sv-SE', { 
year: 'numeric', month: 'numeric', day: 'numeric', 
hour: '2-digit', minute: '2-digit' 
});

let previewDisplay = (item._isLocal || isInternal) 
? `<span style="opacity: 0.6; font-style: italic;">🔒 Privat internt meddelande</span>` 
: stripHtml(rawPreview || '...');

const isAI = item.human_mode === 0; // 0 = AI-besvarat

// Sätt Master-klasserna för layout - NU MED internal-ticket KLASSEN
el.className = `team-ticket-card ${internalClass} archive-card ${isAI ? 'is-ai-chat' : 'is-human-chat'}`;
el.style.setProperty('border-left', `4px solid ${styles.main}`, 'important');
el.style.setProperty('--agent-color', styles.main); // För hover/glöd

// Rendera kortets HTML
el.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title" style="color: ${isInternal ? styles.main : 'var(--text-primary)'} !important;">
<span style="opacity:0.7; margin-right:6px; display:flex; align-items:center;">${typeIcon}</span>
<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
</div>
<div class="ticket-top-right" style="color: ${styles.main} !important;">
${vIcon ? `<span style="display:flex; align-items:center; opacity:0.9;" title="${item.vehicle}">${vIcon}</span>` : ''}
<button class="notes-trigger-btn" data-id="${item.conversation_id || item.id}" title="Interna anteckningar" style="color:inherit;" onclick="event.stopPropagation(); openNotesModal('${item.conversation_id || item.id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>

<div class="ticket-preview">${previewDisplay}</div>

<div class="ticket-footer-bar">
<div class="ticket-time">${fullDateStr}</div>
<div class="ticket-tag" style="background: ${isInternal ? styles.main + '22' : 'rgba(255,255,255,0.05)'}; color: ${styles.main}; border: 1px solid ${styles.main}44;">
${(item.routing_tag || item.office) ? resolveLabel(item.routing_tag || item.office) : (item.city ? item.city.toUpperCase() : '—')}
</div>
</div>
`;

// 6. Klick-händelse (Öppnar detaljvy)
el.onclick = () => {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
el.classList.add('active-ticket');

const placeholder = document.getElementById('archive-placeholder');
const detail = document.getElementById('archive-detail');

if (placeholder) placeholder.style.display = 'none';
if (detail) {
detail.style.display = 'flex';
detail.innerHTML = '';

// KIRURGISK FIX: Tvinga gult om det är privat (_isLocal) eller internt
const isInternalItem = (item.routing_tag === 'INTERNAL' || item.session_type === 'internal' || item._isLocal);
const internalYellow = {
main: '#f1c40f',
bg: 'transparent',
border: 'rgba(241, 196, 15, 0.3)',
bubbleBg: 'rgba(241, 196, 15, 0.15)'
};

const themeStyles = isInternalItem ? internalYellow : getAgentStyles(item.routing_tag || item.owner || 'unclaimed');

// DÖDAR LINJEN OCH BAKGRUNDEN HÄR
detail.className = 'detail-container';
detail.style.borderTop = 'none';
detail.style.borderBottom = 'none';
detail.style.background = 'none';
detail.style.boxShadow = 'none';

let historyHtml = '<div class="inbox-chat-history" style="padding:20px;">';
let messages = [];
try {
if (Array.isArray(item.answer)) messages = item.answer;
else if (typeof item.answer === 'string' && (item.answer.startsWith('[') || item.answer.startsWith('{'))) {
messages = JSON.parse(item.answer);
} else { messages = [{ role: 'user', content: item.answer || "..." }]; }
} catch(e) { messages = []; }

messages.forEach(m => {
const isUser = m.role === 'user';
const clean = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
const avatarInitial = isUser ? (item.contact_name ? item.contact_name.charAt(0).toUpperCase() : 'K') : '🤖';

if (isUser) {
historyHtml += `
<div class="msg-row user" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-start;">
	<div class="msg-avatar" style="background:${themeStyles.main}; color:white; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; margin-right:12px; flex-shrink:0;">${avatarInitial}</div>
	<div class="bubble" style="background:${themeStyles.bubbleBg} !important; border:1px solid ${themeStyles.border} !important; color:var(--text-primary) !important; padding:15px; border-radius:12px; line-height:1.5;">
		${formatAtlasMessage(clean)}
	</div>
</div>`;
} else {
historyHtml += `
<div class="msg-row atlas" style="display:flex; width:100%; margin-bottom:15px; justify-content:flex-end;">
	<div class="bubble" style="background:var(--bg-dark-tertiary) !important; border:1px solid rgba(255,255,255,0.1) !important; color:var(--text-primary) !important; padding:15px; border-radius:12px; line-height:1.5;">
		${formatAtlasMessage(clean)}
	</div>
	<div class="msg-avatar" style="background:#3a3a3c; margin-left:12px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0; font-size:18px;">🤖</div>
</div>`;
}
});

historyHtml += '</div>';

const restoreBtn = isMail ? `<button class="footer-icon-btn" id="archive-restore-btn" title="Återaktivera">${UI_ICONS.RESTORE}</button>` : '';
const fullView = document.createElement('div');
fullView.className = 'detail-container';

fullView.innerHTML = `
${renderDetailHeader(item, themeStyles)}
<div class="detail-body" style="flex:1; overflow-y:auto;">
${historyHtml}
</div>
<div class="detail-footer-toolbar" style="padding: 15px 20px; background: rgba(0, 0, 0, 0.4); display: flex; justify-content: flex-end; gap: 10px;">
${restoreBtn}
<button class="footer-icon-btn danger" id="archive-delete-btn" title="Radera permanent">${UI_ICONS.TRASH}</button>
</div>
`;

// 🎯 DÖDAR LINJEN PÅ DET NYA ELEMENTET INNAN DET APPENDAS
fullView.style.setProperty('border-top', 'none', 'important');
fullView.style.setProperty('border-bottom', 'none', 'important');
fullView.style.setProperty('box-shadow', 'none', 'important');
fullView.style.setProperty('background', 'none', 'important');

detail.appendChild(fullView);

if (typeof refreshNotesGlow === 'function') refreshNotesGlow(item.conversation_id);

const delBtn = fullView.querySelector('#archive-delete-btn');
if (delBtn) delBtn.onclick = async () => {
if (await atlasConfirm("Radera permanent", "Är du säker?")) {
await fetch(`${SERVER_URL}/api/inbox/delete`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: item.conversation_id }) });
renderArchive(false);
detail.innerHTML = '';
detail.style.display = 'none';
placeholder.style.display = 'flex';
}
};

const resBtn = fullView.querySelector('#archive-restore-btn');
if (resBtn) resBtn.onclick = async () => {
await fetch(`${SERVER_URL}/team/claim`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: item.conversation_id, agentName: currentUser.username }) });
showToast('✅ Ärendet återaktiverat!');
if (typeof switchView === 'function') switchView('my-tickets');
};
}
};

container.appendChild(el);
});
// Event listener är borta härifrån eftersom filtreringen nu sker i toppen!
}

// ============================================================================
// POPULERA DROPDOWNS I GARAGET (Använder formatName)
// ============================================================================
function populateArchiveDropdowns() {
const agents = new Set();
const cities = new Set();
const offices = new Set();
const vehicles = new Set();

State.archiveItems.forEach(item => {
if (item.owner) agents.add(item.owner);
if (item.city) cities.add(item.city);
if (item.office || item.routing_tag) offices.add(item.office || item.routing_tag);
if (item.vehicle) vehicles.add(item.vehicle);
});

const fill = (id, data, label) => {
const el = document.getElementById(id);
if (!el) return;
const current = el.value;
el.innerHTML = `<option value="all">Alla ${label}</option>`;
Array.from(data).sort().forEach(val => {
let display = val;
if (id === 'filter-agent') display = formatName(val);
else if (id === 'filter-office') display = resolveLabel(val);
el.innerHTML += `<option value="${val}">${display.toUpperCase()}</option>`;
});
el.value = data.has(current) ? current : 'all';
};

fill('filter-agent', agents, 'agent');
fill('filter-city', cities, 'stad');
fill('filter-office', offices, 'kontor');
fill('filter-vehicle', vehicles, 'fordon');
}

// ==========================================================
// 5. MALL-HANTERARE (1 - LADDA)
// ==========================================================
async function loadTemplates() {
try {
if (isElectron) {
State.templates = await window.electronAPI.loadTemplates() || [];
} else {
const res = await fetch(`${SERVER_URL}/api/templates`, { headers: fetchHeaders });
if (!res.ok) throw new Error("Kunde inte hämta mallar");
State.templates = await res.json();
}
renderTemplates(State.templates);
} catch (err) {
console.error("Mall-fel:", err);
}
}

// ==========================================================
// 5. MALL-HANTERARE (2 - RENDERA) - SÄKRAD
// ==========================================================
function renderTemplates(list = State.templates) {
// Säkra att både användare och list-elementet existerar
if (!currentUser || !DOM.templateList) {
if (!DOM.templateList) console.warn("⚠️ DOM.templateList saknas - kan inte rendera mallar.");
return;
}

// KIRURGISK FIX: Hämta stilar baserat på agentens profilfärg (istället för routing_tag)
// Detta utrotar de 52 blåa träffarna och synkar mallarna med ditt lila tema.
const styles = getAgentStyles(currentUser.username);
DOM.templateList.innerHTML = '';

if (list.length === 0) {
DOM.templateList.innerHTML = '<div class="template-item-empty">Inga mallar hittades.</div>';
return;
}

// Gruppering baserat på group_name
const groups = {};
list.forEach(t => {
const g = t.group_name || 'Övrigt';
if (!groups[g]) groups[g] = [];
groups[g].push(t);
});

Object.keys(groups).sort().forEach(gName => {
groups[gName].sort((a, b) => a.title.localeCompare(b.title, 'sv'));
const header = document.createElement('div');
header.className = 'template-group-header';

// Injicera färgtemat kirurgiskt i grupp-rubriken (vinner över style.css)
header.style.setProperty('--group-bg', styles.bg, 'important');
header.style.setProperty('--group-text', styles.main, 'important');
header.style.setProperty('--group-border', styles.border, 'important');
header.style.setProperty('border-left', `4px solid ${styles.main}`, 'important');

header.innerHTML = `
<div class="group-header-content">
<span class="group-arrow" style="color:${styles.main} !important;">▶</span>
<span class="group-name" style="color:${styles.main} !important;">${gName}</span>
</div>
<span class="group-count" style="background:${styles.main} !important; color: white !important;">${groups[gName].length}</span>
`;

const content = document.createElement('div');
content.className = 'template-group-content';

groups[gName].forEach(t => {
const item = document.createElement('div');
item.className = 'template-item';

// Subtil vänsterkant på varje mall för att knyta ihop temat
item.style.setProperty('border-left', `2px solid ${styles.border}`, 'important');

// Get content preview (first 60 chars, strip HTML)
const tempDiv = document.createElement('div');
tempDiv.innerHTML = t.content || '';
const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();
const preview = plainText.substring(0, 60) + (plainText.length > 60 ? '...' : '');

item.innerHTML = `
<div class="template-item-content">
<span class="template-title">${t.title}</span>
<span class="template-preview">${preview}</span>
</div>
`;

// Din befintliga funktionskontroll
item.onclick = () => {
if (typeof openTemplateEditor === 'function') {
openTemplateEditor(t);
} else {
console.error("Kritiskt fel: openTemplateEditor saknas fortfarande i scope!");
}
};

content.appendChild(item);
});

header.onclick = () => {
content.classList.toggle('expanded');
header.querySelector('.group-arrow').classList.toggle('expanded');
};

DOM.templateList.appendChild(header);
DOM.templateList.appendChild(content);
});
}

// ==========================================================
// 5. MALL-HANTERARE (3 - ÖPPNA)
// ==========================================================
function openTemplateEditor(t) {
console.log("📂 Öppnar mall:", t.title);
isLoadingTemplate = true;

// Använd currentUser.username för att garantera rätt färgtema
const styles = getAgentStyles(window.currentUser?.username || 'Agent');
const editorContainer = document.querySelector('#view-templates .template-editor-container');

if (editorContainer) {
// 1. Kanteffekt och gradient
editorContainer.style.setProperty('border-top', `4px solid ${styles.main}`, 'important');
editorContainer.style.setProperty('background', `linear-gradient(to bottom, ${styles.bg}, transparent)`, 'important');

// 2. SYMMETRI-FIX: Luft mellan etikett och rutor (Drar upp fälten i linje med knapparna)
editorContainer.querySelectorAll('#template-editor-form label').forEach(label => {
label.style.setProperty('margin-bottom', '4px', 'important'); 
label.style.setProperty('display', 'block', 'important');
label.style.setProperty('padding-left', '2px', 'important');
label.style.setProperty('font-size', '11px', 'important'); 
});
}

// --- SÄKRAD LOGIK FÖR DETALJVY ---
// Gömmer placeholdern och visar formuläret
if (DOM.editorPlaceholder) DOM.editorPlaceholder.style.setProperty('display', 'none', 'important');
if (DOM.editorForm) DOM.editorForm.style.setProperty('display', 'flex', 'important');

// Fyller i fälten
if (DOM.inputs.id) DOM.inputs.id.value = t.id;
if (DOM.inputs.title) DOM.inputs.title.value = t.title;
if (DOM.inputs.group) DOM.inputs.group.value = t.group_name || '';

if (quill) {
quill.root.innerHTML = t.content; 
}

const deleteBtn = document.getElementById('delete-template-btn');
if(deleteBtn) deleteBtn.style.display = 'block';

// Säkrad sökning med optional chaining (?.)
const saveBtn = DOM.editorForm?.querySelector('button[type="submit"]');
if (saveBtn) {
saveBtn.disabled = true; 
}

setTimeout(() => {
isLoadingTemplate = false;
}, 50);
}

// ==========================================================
// VY-HANTERARE (SwitchView)
// ==========================================================
function switchView(viewId) {
const now = Date.now();

// A. Hitta vyn vi lämnar
const previousView = DOM.views ? Object.keys(DOM.views).find(key => DOM.views[key] && DOM.views[key].style.display === 'flex') : null;

if (previousView) {
State.lastSeen[previousView] = now;
resetToPlaceholder(previousView);
}

// 1. Dölj alla vyer
if (DOM.views) {
Object.values(DOM.views).forEach(v => {
if (v) v.style.display = 'none';
});
}

// 2. Visa den valda vyn
if (DOM.views && DOM.views[viewId]) {
DOM.views[viewId].style.display = 'flex';
}

// 🔥 KRITISK FIX: Låser höjden för mall-containern så CSS-centrering fungerar
if (viewId === 'templates') {
const tc = document.querySelector('#view-templates .templates-container');
if (tc) {
tc.style.height = 'calc(100vh - 71px)';
}
}

// 3. Uppdatera menyn
if (DOM.menuItems) {
DOM.menuItems.forEach(item => {
item.classList.toggle('active', item.dataset.view === viewId);
});
}

// 4. Ladda data (Special-logik)
if (viewId === 'inbox') {
State.inboxExpanded = { "Live-Chattar": false, "Inkomna MAIL": false, "Plockade Ärenden": false };
const searchEl = document.getElementById('inbox-search');
if (searchEl) searchEl.value = '';
renderInbox();
} 
else if (viewId === 'my-tickets') {
renderMyTickets();
}
else if (viewId === 'archive') {
renderArchive();
}
else if (viewId === 'admin') {
switchAdminTab('users');
}
else if (viewId === 'about') {
renderAboutGrid();
}
}

// Renderar Om-vyn med systeminformation, temainställningar och ljudkontroll
async function renderAboutGrid() {
const grid = document.getElementById('about-grid');
if (!grid) return;

const savedTheme = localStorage.getItem('atlas-theme') || 'standard-theme';
const soundOn = State.soundEnabled !== false;
const themeOptions = [
['standard-theme', 'Standard Vision ⚡'],
['onyx-ultradark', 'Atlas Onyx ⚫'],
['carbon-theme', 'Atlas Carbon ⬛'], // 🔥 LÄGG TILL DENNA RAD HÄR
['apple-dark', 'Apple Dark 🍏'],
['apple-road', 'Apple Road 		'],
['atlas-nebula', 'Atlas Nebula 🌌'],
['sunset-horizon', 'Sunset Horizon 🌅'],
['atlas-navigator', 'Atlas Navigator 🧭'],
].map(([v, l]) => `<option value="${v}"${savedTheme === v ? ' selected' : ''}>${l}</option>`).join('');

grid.innerHTML = `
<div class="about-cell glass-effect" style="overflow-y: auto;">
<h3 class="about-cell-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Snabbguide &amp; Genvägar</h3>
<div class="guide-section">
<div class="guide-step"><span class="step-number">1</span><div class="step-content"><strong>Markera text</strong> i vilket program som helst</div></div>
<div class="guide-step"><span class="step-number">2</span><div class="step-content"><strong>Tryck Ctrl+C</strong> för att kopiera</div></div>
<div class="guide-step"><span class="step-number">3</span><div class="step-content"><strong>Tryck Ctrl+P</strong> för att starta <strong>NY</strong> chatt</div></div>
<div class="guide-step"><span class="step-number">4</span><div class="step-content"><strong>Ctrl+Alt+P</strong> för att ställa en <strong>följdfråga</strong></div></div>
</div>
<div class="shortcut-list" style="margin-top:12px;">
<div class="shortcut-item"><div><kbd>Ctrl</kbd>+<kbd>P</kbd></div><span>Ny fråga</span></div>
<div class="shortcut-item"><div><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd></div><span>Följdfråga</span></div>
<div class="shortcut-item"><div><kbd>Ctrl</kbd>+<kbd>S</kbd></div><span>Spara mall</span></div>
<div class="shortcut-item"><div><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd></div><span>Byt tema</span></div>
</div>
</div>

<div class="about-cell glass-effect">
<h3 class="about-cell-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9z"/></svg> Utseende &amp; Ljud</h3>
<div class="setting-item">
<label>Välj tema</label>
<select id="theme-select" class="filter-select" onchange="changeTheme(this.value)">${themeOptions}</select>
</div>
<div class="setting-item" style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; padding-top:15px; border-top:1px solid var(--border-color);">
<label style="cursor:pointer; display:flex; align-items:center; gap:8px;">🔔 Pling-ljud vid nytt ärende</label>
<input type="checkbox" id="sound-toggle" ${soundOn ? 'checked' : ''} style="transform:scale(1.3); cursor:pointer; appearance:auto; -webkit-appearance:checkbox; width:16px; height:16px; flex-shrink:0;" onchange="window._handleSoundToggle(this.checked)">
</div>
</div>

<div class="about-cell glass-effect">
<h3 class="about-cell-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Min Statistik</h3>
<div id="about-stats-content" style="flex:1; min-height:0; overflow:hidden; display:flex; align-items:center; justify-content:center;"><div class="spinner-small"></div></div>
</div>

<div class="about-cell glass-effect no-scroll">
<h3 class="about-cell-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> System &amp; Status</h3>
<div class="info-item"><span class="info-label">Atlas Version:</span><span id="app-version-display">${ATLAS_VERSION}</span></div>
<div class="info-item"><span class="info-label">Server Version:</span><span id="server-version-display">Hämtar...</span></div>
<div class="info-item"><span class="info-label">Serverstatus:</span><span id="server-status" style="color:#f1c40f; font-weight:700;">● Ansluter...</span></div>
<div class="info-item" id="about-user-info"></div>
<div class="info-item"><span class="info-label">Skapad av:</span><span>Patrik Åkerhage</span></div>
</div>
`;

// Populera serverstatus direkt med aktuellt socket-läge
const statusEl = document.getElementById('server-status');
const verEl = document.getElementById('server-version-display');
if (statusEl && window.socketAPI) {
const connected = window.socketAPI.isConnected();
statusEl.textContent = connected ? "🟢 LIVE" : "🔴 Frånkopplad";
statusEl.style.color = connected ? "#4cd137" : "#ff6b6b";
}
// Försök hämta version via REST om socket-versionen inte är känd
if (verEl && verEl.textContent === 'Hämtar...') {
try {
const vRes = await fetch(`${SERVER_URL}/api/public/version`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
if (vRes.ok) { const vData = await vRes.json(); verEl.textContent = vData.version || SERVER_VERSION || '—'; }
} catch (_) { verEl.textContent = '—'; }
}

// Ladda statistik
try {
const res = await fetch(`${SERVER_URL}/api/admin/user-stats/${currentUser.username}`, { headers: fetchHeaders });
const stats = res.ok ? await res.json() : {};
const s = (k) => stats[k] ?? 0;

const statsEl = document.getElementById('about-stats-content');
const userEl  = document.getElementById('about-user-info');

// Fix: namn och roll i ett enda span (eliminerar dubblett)
if (userEl) userEl.innerHTML = `
<span class="info-label">Inloggad som:</span>
<span><strong>${currentUser.display_name || currentUser.username}</strong>&nbsp;<span style="font-size:10px; opacity:0.45;">${(currentUser.role||'').toUpperCase()}</span></span>`;

// Mini-ikoner för statistikrader
const ICO = {
bolt:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
archive: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
mail:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
chat:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
pulse:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
check:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
robot:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
person:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
filter:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`
};

// Hjälpfunktion: ett stat-kort (siffra + läsbar etikett, centrerat)
const statCard = (label, val, color = 'var(--text-primary)') =>
`<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px 6px; background:rgba(255,255,255,0.04); border-radius:8px; border:1px solid var(--border-color); flex:1; min-height:0; text-align:center;">
<strong style="font-size:18px; font-weight:800; color:${color}; line-height:1.2;">${val}</strong>
<span style="font-size:11px; color:var(--text-secondary); opacity:0.85; margin-top:1px;">${label}</span>
</div>`;

// Hjälpfunktion: systemrad (etikett vänster / värde höger)
const sysRow = (label, val, color = 'var(--text-secondary)') =>
`<div style="display:flex; align-items:center; justify-content:space-between; gap:4px; padding:3px 6px; border-radius:6px; background:rgba(255,255,255,0.025);">
<span style="font-size:11px; color:var(--text-secondary); opacity:0.8;">${label}</span>
<strong style="font-size:14px; font-weight:700; color:${color}; white-space:nowrap;">${val}</strong>
</div>`;

if (statsEl) statsEl.innerHTML = `
<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; height:100%; overflow:hidden;">

<!-- Vänster: Egna -->
<div style="display:flex; flex-direction:column; gap:3px; min-height:0;">
<div style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--accent-primary); margin-bottom:1px;">Egna</div>
${statCard('Aktiva',     s('active'),         'var(--accent-primary)')}
${statCard('Arkiverade', s('archived'),       '#4cd964')}
${statCard('Mail',       s('mail_handled'),   'var(--text-primary)')}
${statCard('Interna',    s('internals_sent'), 'var(--text-primary)')}
</div>

<!-- Höger: Systemtotal -->
<div style="display:flex; flex-direction:column; gap:3px; border-left:1px solid var(--border-color); padding-left:8px; min-height:0;">
<div style="font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-secondary); opacity:0.7; margin-bottom:1px;">Systemtotal</div>
${sysRow('Pågående',      s('total_active'),  'var(--text-primary)')}
${sysRow('Avslutade',     s('total_archived'), 'var(--text-primary)')}
${sysRow('AI-besvarade',  s('ai_answered'),   'var(--accent-primary)')}
${sysRow('Agenthandlade', s('human_handled'), '#4cd964')}
${sysRow('Spam/Tomma',    s('spam_count'),    '#ff453a')}
</div>

</div>`;
} catch (_) {
const statsEl = document.getElementById('about-stats-content');
if (statsEl) statsEl.innerHTML = '<div style="opacity:0.4; font-size:12px; padding:8px;">Statistik ej tillgänglig.</div>';
}
}

window._handleSoundToggle = function(checked) {
State.soundEnabled = checked;
localStorage.setItem('atlas-sound-enabled', checked);
if (checked && typeof playNotificationSound === 'function') playNotificationSound();
};

// Stänger detaljvyn och visar tillbaka hero-platshållaren för angiven vy
function resetToPlaceholder(viewId) {
const mapping = {
'inbox':      { ph: 'inbox-placeholder',    det: 'inbox-detail' },
'my-tickets': { ph: 'my-detail-placeholder',  det: 'my-ticket-detail' },
'archive':    { ph: 'archive-placeholder',    det: 'archive-detail' },
'templates':  { ph: 'editor-placeholder',      det: 'template-editor-form' }
};

const target = mapping[viewId];
if (target) {
const phEl = document.getElementById(target.ph);
const detEl = document.getElementById(target.det);

if (phEl) phEl.style.display = 'flex';

if (detEl) {
// 🔥 SPECIALHANTERING: Rensa innehåll på ALLT utom mallarna
// Vi vill inte döda Quill-editorn genom att tömma dess HTML!
if (viewId !== 'templates') {
detEl.innerHTML = ''; 
} else {
// För mallar: Nollställ bara formuläret istället för att radera det
if (typeof detEl.reset === 'function') detEl.reset();
if (window.quill) quill.setContents([]); 
}

detEl.style.display = 'none';
detEl.removeAttribute('data-current-id');
}
}
}

//---------------------------------------
//-------GET AGENT STYLES-------------//
//---------------------------------------
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

// =============================================================================
// HJÄLPFUNKTIONER (FORMATERING & LJUD)
// =============================================================================
// Spela upp notisljud
function playNotificationSound() {
// Kontrollera att NOTIFICATION_SOUND är definierad högst upp i filen
if (typeof NOTIFICATION_SOUND === 'undefined') return;

try {
const audio = new Audio(NOTIFICATION_SOUND);
audio.volume = 0.5; // Justera volym (0.0 - 1.0)
audio.play().catch(e => console.warn("Kunde inte spela ljud (Autoplay policy?):", e));
} catch (err) {
console.error("Ljudfel:", err);
}
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

//------------------------------------------------------------
//------- MAIL-LÖSNING (KOMPLETT MED TIDSTÄMPEL) -------------
//------------------------------------------------------------
async function handleEmailReply(ticket) {
console.log("📩 Direkt-hantering av e-post för:", ticket.contact_name);

// 1. Extrahera data
const customerEmail = ticket.contact_email || ticket.email || "";
const mailSubject = ticket.subject || "Ärende från Atlas";
const originalMsg = ticket.last_message || "Ingen meddelandetext hittades";

// 🔥 SPARA FRÅGAN FÖR ATT BIFOGA TILL AI-SVARET SENARE
lastEmailContext = originalMsg; 

// 2. Skapa AI-instruktion för servern (Brusfilter)
const aiInstruction = `[SYSTEM-NOTERING: Detta är ett inkommande e-postmeddelande. Det kan innehålla mycket ovidkommande information. Din uppgift är att ignorera allt brus och endast fokusera på de faktiska frågorna som rör trafikskolan.]\n\nKUNDENS MAIL:\n${originalMsg}`;

try {
// 3. Kopiera kundens fråga till urklipp (Pling 1)
await navigator.clipboard.writeText(originalMsg);

// 4. Meddela servern att starta AI-generering
if (window.socketAPI) {
window.socketAPI.emit('team:email_action', { 
conversationId: ticket.conversation_id, 
action: 'auto_mailto_triggered',
content: aiInstruction 
});
}

// 5. Bekräfta start med ljud
playNotificationSound();

// 6. Öppna Outlook
const mailtoLink = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}`;
window.location.href = mailtoLink;

console.log("✅ Server notifierad. Outlook öppnad.");

} catch (err) {
console.error("❌ Fel vid e-post-hantering:", err);
window.location.href = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}`;
}
}

// ==========================================================
// 📂 MAIL - AUTOSVAR MED MALL ELLER SERVER
// ==========================================================
async function handleEmailTemplateReply(ticket) {
const templateSelect = document.getElementById('quick-template-select');
const selectedId = templateSelect.value;

if (!selectedId) {
alert("Välj en mall i listan till vänster först!");
templateSelect.focus();
return;
}

const template = State.templates.find(t => t.id == selectedId);
if (!template) return;

// 1. Hämta HTML-innehållet (för formatering/bilder) och Text (för fallback)
const templateHtml = template.content;
const tempDiv = document.createElement("div");
tempDiv.innerHTML = templateHtml;
const templatePlainText = tempDiv.textContent || tempDiv.innerText || "";

// 2. Förbered originalfrågan (radbrytningar för både HTML och Text)
const originalMsg = ticket.last_message || (ticket.messages && ticket.messages[0]?.content) || "";
const originalMsgHtml = originalMsg.replace(/\n/g, '<br>');

// 3. Sätt ihop Rich Text-versionen (HTML)
// Inkluderar <style> för att nollställa marginaler i Outlook/Word
const finalHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.2;">
<style>
p { margin: 0 !important; margin-bottom: 0 !important; padding: 0 !important; }
</style>
<div class="template-content">
${templateHtml}
</div>
<br><br>
<div style="border-top: 1px solid #ccc; padding-top: 10px; color: #666;">
<strong>URSPRUNGLIG FRÅGA:</strong><br>
${originalMsgHtml}
</div>
<br>
Med vänlig hälsning,<br>
<strong>Supporten My Driving Academy</strong>
</div>
`;

// 4. Sätt ihop Plain Text-versionen (Fallback)
const finalPlainText = `${templatePlainText}\n\n------------------\nURSPRUNGLIG FRÅGA:\n${originalMsg}`;

// 5. Hantera kopiering baserat på miljö
if (window.electronAPI && typeof window.electronAPI.send === 'function') {
// ELECTRON-LÄGE
window.electronAPI.send('force-copy-html-to-clipboard', {
html: finalHtml,
text: finalPlainText
});
console.log("✅ Kopierat via Electron IPC");
} else {
// WEBB-LÄGE (Ngrok/Browser)
try {
const typeHtml = "text/html";
const typeText = "text/plain";
const blobHtml = new Blob([finalHtml], { type: typeHtml });
const blobText = new Blob([finalPlainText], { type: typeText });

const data = [new ClipboardItem({
[typeHtml]: blobHtml,
[typeText]: blobText
})];

await navigator.clipboard.write(data);
console.log("✅ Kopierat Rich Text via Web Clipboard API");
} catch (err) {
console.error("❌ Webb-kopiering misslyckades:", err);
// Sista utvägen: Kopiera bara vanlig text om Rich Text nekas
await navigator.clipboard.writeText(finalPlainText);
}
}

// 6. Feedback & Öppna Outlook
playNotificationSound();
const originalText = templateSelect.options[templateSelect.selectedIndex].text;
templateSelect.options[templateSelect.selectedIndex].text = "✅ Rich Text kopierad!";

const customerEmail = ticket.contact_email || ticket.email || (ticket.locked_context ? ticket.locked_context.email : "") || "";
const mailSubject = ticket.subject || "Ärende från Atlas";
const mailtoLink = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}`;

window.location.href = mailtoLink;

setTimeout(() => {
templateSelect.options[templateSelect.selectedIndex].text = originalText;
templateSelect.value = "";
}, 2000);
}



// ==========================================================
// 📖 HJÄLPSYSTEM (KONTEXTUELL MANUAL)
// ==========================================================
function toggleHelp() {
const overlay = document.getElementById('atlas-help-overlay');
const content = document.getElementById('help-content-area');
const currentView = document.querySelector('.menu-item.active')?.dataset.view || 'chat';

if (overlay.style.display === 'flex') {
overlay.style.display = 'none';
return;
}

const helpTexts = {
'chat': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>Hemvyn (Privat AI)</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
<span><b>Sekretess</b>: Ingenting du skriver här loggas centralt. Dina konversationer sparas enbart lokalt på din enhet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4"/></svg></span>
<span><b>Genvägar</b>: Kortkommandona fungerar globalt i Windows även när appen körs minimerad i bakgrunden.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></span>
<span><b>Ctrl+P</b>: Startar en helt ny, ren session och rensar AI-minnet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
<span><b>Ctrl+Alt+P</b>: Fortsätter dialogen i den aktuella sessionen utan att rensa minnet.</span>
</li>
</ul>`,
'inbox': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>Om Inkorgen</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></span>
<span><b>Plocka</b>: Ta ägarskap. Detta visar teamet att kunden hanteras.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg></span>
<span><b>Tilldela ärende</b>: Använd tilldela-ikonen för att skicka ett inkommet ärende direkt till en specifik agent utan att plocka det själv.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
<span><b>Ta över</b>: Ta över ett ärende från en supportkollega vid behov.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#f39c12;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/></svg></span>
<span><b>Arkivera</b>: Flyttar ärendet till Garaget och stänger det permanent.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#ff6b6b;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>
<span><b>Radera</b>: Rensar bort ärendet helt från systemet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
<span><b>Sökfältet</b>: Filtrerar direkt bland alla aktiva ärenden i inkorgen. Sökningen inkluderar inte arkiverade ärenden, privata sessioner eller interna meddelanden.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m14 17 2 2 4-4"/></svg></span>
<span><b>Flerval (Bulk)</b>: Håll in musknappen på ett ärende (lång-klick) för att aktivera flervalsläget. Markera sedan flera ärenden och plocka eller arkivera dem alla på en gång via verktygsfältet som dyker upp.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg></span>
<span><b>Snabbsvar</b>: För live-chattar visas en snabbsvarsruta direkt i Inkorgen. Skriv ditt svar och tryck <b>Ctrl+Enter</b> för att svara och plocka ärendet i samma steg.</span>
</li>
</ul>`,
'my-tickets': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>Mina Ärenden</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>
<span><b>Aktiva ärenden</b>: Det går utmärkt att ha flera chattar och mail igång parallellt. Välj ett ärende i listan för att öppna detaljvyn och svara kunden.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
<span><b>Starta nytt ärende</b>: Via knappen högst upp i vyn kan du skapa ett nytt externt mail till en kund eller skicka ett privat internt meddelande direkt till en kollega.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#f39c12;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/></svg></span>
<span><b>Arkivera</b>: Flyttar ärendet till Garaget och stänger det permanent.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#ff6b6b;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></span>
<span><b>Radera</b>: Rensar bort ärendet helt från systemet.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px; color:#f39c12;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h2"/><path d="M20 8v11a2 2 0 0 1-2 2h-2"/><path d="m9 15 3-3 3 3"/><path d="M12 12v9"/></svg></span>
<span><b>Arkivering av mail</b>: Chattar som arkiveras stängs permanent. Mail-ärenden stängs dock aldrig helt — svarar kunden på mailet återaktiveras ärendet automatiskt i Inkorgen.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></span>
<span><b>AI-förslag</b>: Klicka på AI-ikonen i svarsrutan för mail-ärenden för att låta Atlas analysera historiken och skapa ett utkast till svar åt dig.</span>
</li>
</ul>`,
'archive': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>Garaget (Smart Arkiv)</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
<span><b>Fritextsökning</b>: Sök bland alla avslutade ärenden via kundens mailadress, telefonnummer eller nyckelord från konversationen.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></span>
<span><b>Filtrera på kontor</b>: Hitta snabbt ärenden kopplade till en specifik stad eller plats via ortsfiltret.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></span>
<span><b>Fordonstyp</b>: Filtrera på körkortstyp eller fordonskategori för att snabbt hitta relevanta konversationer.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
<span><b>Agenthistorik</b>: Filtrera på kollega för att se hur ärenden hanterats tidigare — perfekt för onboarding och kvalitetssäkring.</span>
</li>
</ul>`,
'templates': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg></span>Gemensamma Mallar</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg></span>
<span><b>Global lagring</b>: Alla mallar sparas på servern och är omedelbart tillgängliga för hela teamet — ingen synkronisering behövs.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg></span>
<span><b>Rich Text</b>: Stöd för bilder och avancerad formatering för proffsiga kundsvar i Outlook och andra mailklienter.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg></span>
<span><b>Integrerat i svarsrutan</b>: I Mina Ärenden finns en rullgardinsmeny ovanför chattinputen. Välj en mall och texten klistras in direkt — blixtsnabbt och utan klipp-klistra.</span>
</li>
</ul>`,
'about': `
<h4><span class="help-header-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>Inställningar</h4>
<ul>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></span>
<span><b>Teman</b>: Anpassa Atlas utseende med ett av de professionella temana — från ljust minimalistiskt till mörkt och djärvt.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
<span><b>Ljud</b>: Slå av eller på notisljud för inkommande meddelanden och händelser.</span>
</li>
<li style="display:flex; align-items:flex-start; gap:12px;">
<span class="help-icon-inline" style="flex-shrink:0; margin-top:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
<span><b>Lokalt</b>: Dina inställningar sparas enbart för din inloggning och påverkar inte andra användare.</span>
</li>
</ul>`
};

content.innerHTML = helpTexts[currentView] || "<h4>Atlas AI</h4><p>Välj en sektion i menyn för hjälp.</p>";

overlay.style.display = 'flex';

// Lägg till click-outside handler för att stänga
overlay.onclick = (e) => {
if (e.target === overlay) {
overlay.style.display = 'none';
}
};
}

// ===== GLOBAL ESC KEY HANDLER FÖR ALLA MODALER =====
document.addEventListener('keydown', (event) => {
if (event.key === 'Escape') {
// Login modal
const loginModalEsc = document.getElementById('login-modal');
if (loginModalEsc && (loginModalEsc.style.display === 'flex' || window.getComputedStyle(loginModalEsc).display !== 'none')) {
loginModalEsc.style.display = 'none';
event.preventDefault();
return;
}
// Help overlay
const helpOverlay = document.getElementById('atlas-help-overlay');
if (helpOverlay && helpOverlay.style.display === 'flex') {
helpOverlay.style.display = 'none';
event.preventDefault();
return;
}

// Mail composer
const mailComposer = document.getElementById('atlas-mail-composer');
if (mailComposer && mailComposer.style.display === 'flex') {
mailComposer.style.display = 'none';
event.preventDefault();
return;
}

// Prompt modal
const promptModal = document.getElementById('atlas-prompt-modal');
if (promptModal && promptModal.style.display === 'flex') {
promptModal.style.display = 'none';
event.preventDefault();
return;
}

// Confirm modal
const confirmModal = document.getElementById('atlas-confirm-modal');
if (confirmModal && confirmModal.style.display === 'flex') {
confirmModal.style.display = 'none';
event.preventDefault();
return;
}

// Notes modal
const notesModal = document.getElementById('atlas-notes-modal');
if (notesModal && notesModal.style.display === 'flex') {
notesModal.style.display = 'none';
notesModal.innerHTML = '';
event.preventDefault();
return;
}

// Profile modal
const profileModal = document.getElementById('atlas-profile-modal');
if (profileModal && profileModal.style.display === 'flex') {
profileModal.style.display = 'none';
event.preventDefault();
return;
}

// Reader modal
const readerModal = document.getElementById('atlas-reader-modal');
if (readerModal && readerModal.style.display === 'flex') {
readerModal.style.display = 'none';
event.preventDefault();
return;
}
}
});


// ==========================================================
// 📖 FORMATTERING AV TEXT (OPTIMERAD + FILSTÖD)
// ==========================================================
function formatAtlasMessage(text) {
if (!text) return "<i>(Ingen text hittades)</i>";
let processedText = text.toString();

// 1. HTML-Detektering (Behåll din logik)
const hasHtml = /<[a-z][\s\S]*>/i.test(processedText) || processedText.includes("<div");
if (hasHtml) {
return processedText.replace(/^(<br\s*\/?>|\s)+/i, '').replace(/((<br\s*\/?>|\s)+)$/i, '');
}

// 2. Sanera och förbered text (Behåll din logik)
const sanitized = processedText
.replace(/\r\n/g, '\n')
.replace(/\r/g, '\n')
.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 3. Bild- och filstöd (Dina smarta regex)
let content = sanitized.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
const fullUrl = url.startsWith('/uploads') ? `${SERVER_URL}${url}` : url;
return `<div class="chat-image-container" style="margin: 10px 0;"><img src="${fullUrl}" alt="${alt}" style="max-width:100%; border-radius:8px; cursor:pointer;" onclick="window.open('${fullUrl}')"></div>`;
});

content = content.replace(/📎\s?\[Fil:\s?(.*?)\]\((.*?)\)/g, (match, name, url) => {
const fullUrl = url.startsWith('/uploads') ? `${SERVER_URL}${url}` : url;
return `<a href="${fullUrl}" target="_blank" class="file-attachment-link">📄 <b>${name}</b></a>`;
});

// 4. Bold & Länkar
content = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (match, label, url) => {
const fullUrl = url.startsWith('/uploads') ? `${SERVER_URL}${url}` : url;
return `<a href="${fullUrl}" target="_blank" class="atlas-link">${label}</a>`;
});

// 5. Splitta i rader, rensa tomma, slå ihop med <br> (undviker block-element som tvingar 100% bredd)
return content.split('\n')
.map(line => line.trim())
.filter(line => line !== '')
.join('<br>');
}

// Hjälpfunktion för att visa ren text i ärendekortet (tar bort HTML-taggar)
function stripHtml(html) {
if (!html) return "";
// Skapa ett temporärt element för att extrahera ren text
const tmp = document.createElement("DIV");
tmp.innerHTML = html;
let text = tmp.textContent || tmp.innerText || "";
// Kapa texten om den är för lång (så slipper CSS jobba ihjäl sig)
return text.length > 60 ? text.substring(0, 60) + "..." : text;
}

// ============================================================================
// MASTER HEADER ENGINE - SYNCHRONIZED
// ============================================================================
function renderDetailHeader(item, styles, extraActions = '') {
const timestamp = item.timestamp || (item.updated_at ? item.updated_at * 1000 : Date.now());
const dateStr = new Date(timestamp).toLocaleString('sv-SE', { 
year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' 
});

const vIcon = getVehicleIcon(item.vehicle || item.vehicle_type);

// 1. Grund-pills (Datum)
let pills = `<span class="pill">${UI_ICONS.CALENDAR} ${dateStr}</span>`;

// 2. MOTTAGARE (Destination) - Fullständigt namn
const _officeMatch = officeData.find(o =>
o.routing_tag === item.routing_tag || o.routing_tag === item.owner
);
let officeLabel = null;
if (_officeMatch) {
officeLabel = (_officeMatch.name || `${_officeMatch.city} ${_officeMatch.area}`).toUpperCase();
} else if (item.city || item.destination) {
officeLabel = (item.city || item.destination).toUpperCase();
}

if (officeLabel) {
pills += `<span class="pill" style="color:${styles.main}; border-color:${styles.border}; font-weight:700;">${UI_ICONS.CITY_SMALL} ${officeLabel}</span>`;
}

// 3. AGENT (Om tilldelat)
if (item.owner) {
pills += `<span class="pill">${UI_ICONS.AGENT_SMALL} ${formatName(item.owner)}</span>`;
}

// 4. FORDONSTYP
const vehicleName = item.vehicle || item.vehicle_type;
if (vehicleName) {
pills += `<span class="pill" title="Fordon">${vIcon || ''} ${vehicleName.toUpperCase()}</span>`;
}

// 5. EPOST
const email = item.email || item.contact_email;
if (email) {
pills += `<span class="pill">${UI_ICONS.MAIL} ${email}</span>`;
}

// 6. MOBIL (Chatt-specifikt fält)
const phone = item.phone || item.contact_phone;
if (phone) {
pills += `<span class="pill">${UI_ICONS.PHONE} ${phone}</span>`;
}

const aiBadge = item.human_mode === 0 ? `<span class="ai-badge">AI</span>` : '';

return `
<div class="detail-header-top" style="background: linear-gradient(90deg, ${styles.bg || styles.main + '1a'}, transparent); border-bottom: 2px solid ${styles.main} !important;">
<div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
<div style="flex: 1; overflow: hidden;">
<div class="detail-subject">
${resolveTicketTitle(item)} ${aiBadge}
</div>
<div style="display: flex; gap: 6px; flex-wrap: wrap; font-size:11px; margin-top:6px;">
${pills}
</div>
</div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 20px;">
${extraActions} 
<div style="width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div> 
<button class="notes-trigger-btn header-button icon-only-btn"
data-id="${item.conversation_id || item.id}"
onclick="openNotesModal('${item.conversation_id || item.id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
</div>`;
}

//---------------------------------------
//-------GET VEHICLE ICON-------------//
//---------------------------------------
function getVehicleIcon(type) {
if (!type) return '';
const t = type.toUpperCase();
if (t === 'BIL') return UI_ICONS.CAR;
if (t === 'MC') return UI_ICONS.BIKE;
if (t === 'AM' || t === 'MOPED') return UI_ICONS.MOPED;
if (t === 'LASTBIL' || t === 'TUNG') return UI_ICONS.TRUCK;
if (t === 'SLÄP') return UI_ICONS.TRAILER;
return ''; 
}

//=====================================================//
//=========SHOW ASSIGN MODAL LOGIN/PROFIL-SIDAN=======//
//=====================================================//
async function showAssignModal(ticket) {
let users = [];
try {
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
if (res.ok) users = await res.json();
} catch (e) {
console.error("Kunde inte hämta användarlistan:", e);
return;
}

const agentList = users.filter(u => u.username.toLowerCase() !== 'admin');
agentList.sort((a, b) => formatName(a.username).localeCompare(formatName(b.username), 'sv'));

const modal = document.createElement('div');
modal.className = 'custom-modal-overlay';
modal.style.display = 'flex';
modal.style.zIndex = '20000';

modal.innerHTML = `
<div class="glass-modal-box glass-effect">
<div class="glass-modal-header">
<h3>Tilldela ärende</h3>
</div>
<div class="glass-modal-body" style="overflow-y: auto; flex: 1; padding: 20px;">
<div class="agent-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
${agentList.map(u => {
const displayName = u.display_name || formatName(u.username);
const avatarHtml = getAvatarBubbleHTML(u, "38px");
return `
<div class="agent-card" 
onclick="window.executeAssign('${ticket.conversation_id}', '${u.username}', '${displayName}')" 
style="border-left: 4px solid ${u.agent_color || '#0071e3'}; cursor: pointer;">
${avatarHtml}
<div class="agent-card-info">
<div class="agent-card-name">${displayName}</div>
<div class="agent-card-status">${u.status_text || (u.is_online ? 'Tillgänglig' : 'Ej inloggad')}</div>
</div>
</div>`;
}).join('')}
</div>
</div>
<div class="glass-modal-footer" style="margin-top: 15px;">
<button id="assign-cancel" class="btn-modal-cancel" style="width: 100%;">Avbryt</button>
</div>
</div>`;

document.body.appendChild(modal);

// Stabil global referens för klicket
window.executeAssign = async (convId, username, displayName) => {
if (document.body.contains(modal)) document.body.removeChild(modal);
await performAssign(convId, username);
showToast(`✅ Ärende tilldelat till ${displayName}`);
};

modal.querySelector('#assign-cancel').onclick = () => {
if (document.body.contains(modal)) document.body.removeChild(modal);
};
}

//=====================================================//
//========= HJÄLPFUNKTION FÖR TILLDELNING ===========//
//=====================================================//
async function performAssign(conversationId, targetAgent) {
try {
const res = await fetch(`${SERVER_URL}/team/assign`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId, targetAgent })
});

if (res.ok) {
// 1. Uppdatera listvyn
renderInbox();
renderMyTickets();

// 2. TOTALRENSA alla detaljvyer (Inkorg OCH Mina Ärenden) för att slippa ghosting
const views = [
{ det: 'inbox-detail', ph: 'inbox-placeholder' },
{ det: 'my-ticket-detail', ph: 'my-detail-placeholder' }
];

views.forEach(v => {
const detail = document.getElementById(v.det);
const placeholder = document.getElementById(v.ph);
if (detail) {
detail.innerHTML = '';
detail.style.display = 'none';
detail.removeAttribute('data-current-id');
}
if (placeholder) {
placeholder.style.display = 'flex';
}
});

console.log(`✅ Ärendet har skickats till ${targetAgent}!`);
} else {
console.error("Servern svarade inte OK vid tilldelning.");
}
} catch (err) {
console.error("Assign error:", err);
}
}

/* ==========================================================
FUNKTION: PROFIL & LÖSENORD
Inkluderar: Live Preview, Direkt-UI-update & Logga ut
========================================================== */
async function showProfileSettings() {
// 1. Hämta data
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
const users = await res.json();
const me = users.find(u => u.username === currentUser.username) || currentUser;

let overlay = document.getElementById('atlas-profile-modal');
if (!overlay) {
overlay = document.createElement('div');
overlay.id = 'atlas-profile-modal';
overlay.className = 'custom-modal-overlay';
document.body.appendChild(overlay);
}

let selectedAvatarId = me.avatar_id || 0;
const initialColor = me.agent_color || '#0071e3';

// TAJTAD LAYOUT - Optimerad för att slippa scroll
overlay.innerHTML = `
<div class="glass-modal-box glass-effect" style="width: 400px; max-height: 92vh; display: flex; flex-direction: column; padding: 0 !important;">
<div class="glass-modal-header" style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
<div id="profile-preview-avatar" style="width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 2px solid ${initialColor}; color: ${initialColor}; transition: all 0.2s;">
${AVATAR_ICONS[selectedAvatarId]}
</div>
<div style="flex: 1;">
<h3 style="margin:0; font-size: 15px; letter-spacing: 0.5px;">MIN PROFIL</h3>
<div style="font-size: 10px; opacity: 0.5;">Inloggad som @${me.username}</div>
</div>
</div>

<div class="glass-modal-body" style="padding: 15px 20px; overflow-y: auto; flex: 1;">
<div class="settings-group">
<label style="font-size: 10px; text-transform: uppercase; opacity: 0.4; margin-bottom: 4px;">Visningsnamn</label>
<input type="text" id="pref-display-name" value="${me.display_name || ''}" placeholder="${formatName(me.username)}" style="padding: 8px 12px; font-size: 13px;">

<label style="margin-top: 10px; font-size: 10px; text-transform: uppercase; opacity: 0.4; margin-bottom: 4px;">Statusmeddelande</label>
<input type="text" id="pref-status-text" value="${me.status_text || ''}" placeholder="Vad gör du just nu?" maxlength="40" style="padding: 8px 12px; font-size: 13px;">
</div>

<div class="settings-group" style="margin-top: 15px;">
<label style="font-size: 10px; text-transform: uppercase; opacity: 0.4; margin-bottom: 6px;">Profilfärg & Ikon</label>
<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
<div id="pref-color-line" style="flex: 1; height: 2px; background-color: ${initialColor} !important; border-radius: 2px; opacity: 0.8;"></div>
<div style="display: flex; align-items: center; gap: 8px;">
<input type="color" id="pref-color" value="${initialColor}" style="width: 38px; height: 28px; cursor: pointer; background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0;">
<span id="pref-color-hex" style="font-family: monospace; font-size: 10px; opacity: 0.4; min-width: 55px;">${initialColor.toUpperCase()}</span>
</div>
</div>

<div class="avatar-picker-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 5px;">
${AVATAR_ICONS.map((svg, index) => `
<div class="avatar-option ${selectedAvatarId == index ? 'selected' : ''}" 
data-id="${index}"
style="color: ${initialColor}; cursor: pointer; padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: center; transition: all 0.2s; height: 32px;">
${svg}
</div>
`).join('')}
</div>
</div>

<hr style="border:0; border-top:1px solid rgba(255,255,255,0.08); margin: 15px 0;">

<div class="settings-group">
<label style="color:#888; font-size: 10px; text-transform: uppercase; margin-bottom: 6px;">Byt Lösenord</label>
<input type="password" id="old-pass" placeholder="Nuvarande" style="margin-top:0; font-size: 12px; padding: 8px 12px;">
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
<input type="password" id="new-pass" placeholder="Nytt" style="font-size: 12px; padding: 8px 12px;">
<input type="password" id="confirm-pass" placeholder="Bekräfta" style="font-size: 12px; padding: 8px 12px;">
</div>
</div>
</div>

<div class="glass-modal-footer" style="flex-shrink: 0; padding: 12px 20px; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
<button id="prof-logout-btn" title="Logga ut" style="background: rgba(255,69,58,0.1); border: 1px solid rgba(255,69,58,0.2); color: #ff453a; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0 !important;">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
</button>
<div style="flex:1"></div>
<button class="btn-glass-icon" title="Avbryt" style="width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0;" onclick="document.getElementById('atlas-profile-modal').style.display='none'">
${ADMIN_UI_ICONS.CANCEL}
</button>
<button class="btn-glass-icon" id="prof-save-btn" title="Spara ändringar" 
style="width: 36px; height: 36px; border-radius: 8px; color: ${currentUser.agent_color || '#4cd964'}; border-color: ${currentUser.agent_color ? currentUser.agent_color + '4d' : 'rgba(76,217,100,0.3)'}; background: ${currentUser.agent_color ? currentUser.agent_color + '1a' : 'rgba(76,217,100,0.05)'}; display: flex; align-items: center; justify-content: center; padding: 0;">
${ADMIN_UI_ICONS.SAVE}
</button>
</div>
</div>`;

overlay.style.display = 'flex';

const colorInput = overlay.querySelector('#pref-color');
const colorLine = overlay.querySelector('#pref-color-line');
const colorHexDisplay = overlay.querySelector('#pref-color-hex');
const previewContainer = overlay.querySelector('#profile-preview-avatar');
const avatarOptions = overlay.querySelectorAll('.avatar-option');

// LIVE SYNC LOGIK (KOMPLETT: Realtid, Inga dubbletter & Korrekt Logik)
const syncProfileUI = (color, avatarId, statusText) => {
// 0. Global färgvariabel för CSS (kryssrutor, scrollbars etc)
document.documentElement.style.setProperty('--accent-primary', color);

// 1. Modal-preview (Uppe i modalen)
if (previewContainer) {
previewContainer.style.borderColor = color;
previewContainer.style.color = color;
previewContainer.innerHTML = AVATAR_ICONS[avatarId];
}
if (colorLine) colorLine.style.setProperty('background-color', color, 'important');
if (colorHexDisplay) colorHexDisplay.innerText = color.toUpperCase();
avatarOptions.forEach(opt => opt.style.color = color);

// 2. Sidofältet (Footer) - Färg & Avatar
const sideAvatarRing = document.querySelector('.sidebar-footer .user-avatar');
const sideIconContainer = document.querySelector('.sidebar-footer .user-initial');

if (sideAvatarRing) sideAvatarRing.style.setProperty('border-color', color, 'important');
if (sideIconContainer) {
sideIconContainer.style.setProperty('background-color', color, 'important');
sideIconContainer.innerHTML = AVATAR_ICONS[avatarId];
const svg = sideIconContainer.querySelector('svg');
if (svg) { svg.style.width = '20px'; svg.style.height = '20px'; }
}

// 3. Statustext — skriv om nameEl med innerHTML precis som updateProfileUI gör (undviker dubbla spans)
const nameEl = document.getElementById('current-user-name');
if (nameEl) {
const displayName = currentUser.display_name || currentUser.username || 'Agent';
const statusHtml = statusText ? '<span class="user-status-text" style="display:block; font-size:10px; color:' + color + '; opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">💬 ' + statusText + '</span>' : '';
nameEl.innerHTML = '<span style="display:block; font-weight:600; color:white;">' + (displayName.charAt(0).toUpperCase() + displayName.slice(1)) + '</span>' + statusHtml;
}

// 4. Ärendekort - Live-uppdatera kort som tillhör Agenten/ADMIN
const myName = currentUser.username.toUpperCase();
document.querySelectorAll('.team-ticket-card:not(.internal-ticket)').forEach(card => {
const owner = (card.getAttribute('data-owner') || '').toUpperCase();
const tagEl = card.querySelector('.ticket-tag');
if (owner === myName || owner === 'ADMIN' || (tagEl && (tagEl.innerText === myName || tagEl.innerText === 'ADMIN'))) {
card.style.setProperty('--agent-color', color);
card.style.borderLeft = `4px solid ${color}`;
card.querySelectorAll('.ticket-tag, .atp-note-btn, .notes-trigger-btn, .claim-mini-btn, .ticket-title span, .ticket-vehicle-icon, svg').forEach(el => {
el.style.color = color;
if (el.classList.contains('ticket-tag')) el.style.borderColor = color;
if (el.tagName === 'svg' || el.closest('svg')) {
el.style.fill = 'currentColor';
el.style.color = color;
}
});
}
});

// 5. Spara-knappen (Döda det hårdkodade gröna)
const saveBtn = document.getElementById('prof-save-btn');
if (saveBtn) {
saveBtn.style.setProperty('color', color, 'important');
saveBtn.style.setProperty('border-color', color + '4d', 'important');
saveBtn.style.setProperty('background', color + '1a', 'important');
}

// 6. Ärendevyn (Den öppna vyn till höger i realtid)
const openHeader = document.querySelector('.detail-header-top');
const detailContainer = document.getElementById('my-ticket-detail');
const activeCard = document.querySelector('.active-ticket');
const activeOwner = (activeCard?.getAttribute('data-owner') || '').toUpperCase();

if (activeOwner === myName || activeOwner === 'ADMIN') {
if (openHeader) {
openHeader.style.borderBottomColor = color;
openHeader.style.background = `linear-gradient(90deg, ${color}1a, transparent)`;
openHeader.querySelectorAll('.notes-trigger-btn, .detail-subject').forEach(el => {
el.style.color = color;
});
}
if (detailContainer) {
detailContainer.style.setProperty('border-top-color', color, 'important');
detailContainer.querySelectorAll('.message.atlas .bubble, .msg-row.atlas .bubble').forEach(b => {
b.style.setProperty('background-color', color + '1a', 'important');
b.style.setProperty('border-color', color, 'important');
});
}
}

// 7. Mallar-listan
const templatesView = document.getElementById('view-templates');
if (templatesView && templatesView.style.display === 'flex') {
if (typeof renderTemplates === 'function') {
renderTemplates();
}
}
}; // Slut på syncProfileUI

// --- EVENTLYSSNARE FÖR REALTIDSUPPDATERING ---
colorInput.oninput = (e) => {
syncProfileUI(e.target.value, selectedAvatarId, document.getElementById('pref-status-text').value.trim());
};

document.getElementById('pref-status-text').oninput = (e) => {
syncProfileUI(colorInput.value, selectedAvatarId, e.target.value.trim());
};

avatarOptions.forEach(opt => {
opt.onclick = () => {
avatarOptions.forEach(o => o.classList.remove('selected'));
opt.classList.add('selected');
selectedAvatarId = parseInt(opt.dataset.id);
syncProfileUI(colorInput.value, selectedAvatarId, document.getElementById('pref-status-text').value.trim());
};
});

overlay.querySelector('#prof-logout-btn').onclick = async () => {
overlay.style.display = 'none';
if (await atlasConfirm("Logga ut", "Vill du verkligen logga ut från Atlas?")) handleLogout();
};

overlay.querySelector('#prof-save-btn').onclick = async () => {
const profileData = {
display_name: document.getElementById('pref-display-name').value.trim(),
status_text: document.getElementById('pref-status-text').value.trim(),
agent_color: colorInput.value,
avatar_id: selectedAvatarId
};
try {
const profRes = await fetch(`${SERVER_URL}/api/auth/update-profile`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify(profileData)
});
if (!profRes.ok) throw new Error("Kunde inte spara");
currentUser = { ...currentUser, ...profileData };
localStorage.setItem('atlas_user', JSON.stringify(currentUser));
const sideName = document.getElementById('current-user-name');
if (sideName) sideName.innerText = profileData.display_name || formatName(currentUser.username);
overlay.style.display = 'none';
if (typeof showToast === 'function') showToast("✅ Profilen sparad!");
} catch (e) { alert("Fel: " + e.message); }
};
}


/* ==========================================================
FAS 3: ADMIN MASTER MODE - KONSOLIDERAD v4.0
========================================================== */
// --- GLOBALA VARIABLER FÖR ADMIN-LÄSARE ---
let currentTicketList = [];
let currentTicketIdx = -1;
window._adminFormDirty = false;

// --- MASTER TAB-HANTERARE ---
window.switchAdminTab = async (tab) => {
if (window._adminFormDirty) {
const ok = await atlasConfirm('Osparade ändringar', 'Du har ändringar som inte sparats. Navigera bort?');
if (!ok) return;
window._adminFormDirty = false;
}

// ===== BEHÖRIGHETSKONTROLL =====
if (!currentUser) {
const list = document.getElementById('admin-main-list');
const listTitle = document.getElementById('admin-list-title');
if (listTitle) listTitle.innerText = '';
if (list) list.innerHTML = `<div style="padding:30px 20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; color:#ff6b6b; font-size:13px;"><div style="font-size:32px; margin-bottom:4px;">🔒</div><strong>Behörighet saknas</strong><div style="opacity:0.7; max-width:200px; line-height:1.5;">Denna panel kräver inloggning.</div></div>`;
document.getElementById('admin-placeholder').style.display = 'none';
document.getElementById('admin-detail-content').style.display = 'none';
return;
}

// UI-feedback för flikar (säker selektion utan globalt event-objekt)
document.querySelectorAll('#view-admin .header-tab').forEach(t => t.classList.remove('active'));
const tabBtn = document.querySelector(`#view-admin .header-tab[onclick*="'${tab}'"]`);
if (tabBtn) tabBtn.classList.add('active');

// Återställ högerpanelen till placeholder
document.getElementById('admin-placeholder').style.display = 'flex';
document.getElementById('admin-detail-content').style.display = 'none';

const listTitle = document.getElementById('admin-list-title');
const actionContainer = document.getElementById('admin-list-actions');
actionContainer.innerHTML = '';

if (tab === 'users') {
listTitle.innerText = "Personal";
if (isSupportAgent()) {
actionContainer.innerHTML = `<button class="btn-glass-icon" onclick="openNewAgentForm()" title="Ny Agent" style="margin-right: 24px !important;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></button>`;
}
renderAdminUserList();
} else if (tab === 'offices') {
listTitle.innerText = "Kontorsnätverk";
if (isSupportAgent()) {
actionContainer.innerHTML = `<button class="btn-glass-icon" onclick="openNewOfficeForm()" title="Nytt Kontor" style="margin-right: 24px !important;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="13" height="18"/><path d="M21 15V9"/><path d="M21 3v3"/><line x1="19" y1="6" x2="23" y2="6"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="13" y1="9" x2="13" y2="9"/><line x1="9" y1="14" x2="9" y2="14"/><line x1="13" y1="14" x2="13" y2="14"/></svg></button>`;
}
renderAdminOfficeList();
} else if (tab === 'config') {
listTitle.innerText = "Systemkonfiguration";
renderSystemConfigNav();
} else if (tab === 'about') {
listTitle.innerText = "Om Atlas";
actionContainer.innerHTML = '';
renderAdminAbout();
}
};

// =============================================================================
// FIX 6 — Om Atlas
// =============================================================================
async function renderAdminAbout() {
const listContainer = document.getElementById('admin-main-list');
const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!listContainer) return;

// Show full-width in the list pane, hide detail pane
if (placeholder) placeholder.style.display = 'none';
if (detailBox) { detailBox.style.display = 'none'; }

// Check backend status
let backendOk = false;
let dbOk = false;
try {
const r = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
backendOk = r.ok;
dbOk = r.ok;
} catch (_) {}

const dot = (ok) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ok ? '#4cd964' : '#555'};box-shadow:${ok ? '0 0 5px #4cd964' : 'none'};margin-right:6px;"></span>`;

listContainer.innerHTML = `
<div style="padding:20px; display:flex; flex-direction:column; gap:16px;">

<div style="padding:16px 18px; border-radius:12px; background:rgba(255,69,58,0.1); border:1px solid rgba(255,69,58,0.35); color:#ff6b6b; font-size:12px; line-height:1.6;">
<strong style="font-size:13px; display:block; margin-bottom:6px;">⚠ Varning — Systemkonfiguration</strong>
Ändringar i systemkonfigurationen kan påverka prestanda och stabilitet. Endast behörig personal bör ändra dessa värden. Kontakta systemansvarig vid tveksamhet.
</div>

<div class="glass-panel" style="padding:18px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
<h4 style="margin:0 0 12px 0; color:var(--accent-primary); font-size:11px; text-transform:uppercase; letter-spacing:1px;">Versionsinformation</h4>
<div style="display:grid; gap:8px; font-size:13px;">
<div style="display:flex; justify-content:space-between;">
<span style="opacity:0.5;">Version</span><strong>Atlas v3.12</strong>
</div>
<div style="display:flex; justify-content:space-between;">
<span style="opacity:0.5;">Build-datum</span><strong>2026-02-20</strong>
</div>
<div style="display:flex; justify-content:space-between;">
<span style="opacity:0.5;">Plattform</span><strong>Electron / Node.js / SQLite</strong>
</div>
</div>
</div>

<div class="glass-panel" style="padding:18px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
<h4 style="margin:0 0 12px 0; color:var(--accent-primary); font-size:11px; text-transform:uppercase; letter-spacing:1px;">Komponentstatus</h4>
<div style="display:grid; gap:8px; font-size:13px;">
<div>${dot(backendOk)}Backend / API-server</div>
<div>${dot(dbOk)}Databas (SQLite)</div>
<div>${dot(false)}AI-motor (kontrolleras separat)</div>
</div>
</div>

<div class="glass-panel" style="padding:18px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
<h4 style="margin:0 0 12px 0; color:var(--accent-primary); font-size:11px; text-transform:uppercase; letter-spacing:1px;">Support</h4>
<div style="font-size:12px; opacity:0.6; line-height:1.8;">
Vid tekniska problem, kontakta systemansvarig.<br>
Intern support: <strong style="color:var(--text-primary); opacity:1;">it@atlas.se</strong>
</div>
</div>

</div>`;
}

// --- RENDER LISTA: AGENTER (FIXAD) ---
async function renderAdminUserList() {
const listContainer = document.getElementById('admin-main-list');
listContainer.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/users`, { headers: fetchHeaders });
if (!res.ok) throw new Error(`Serverfel: ${res.status}`);
const users = await res.json();
users.sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username, 'sv'));
listContainer.innerHTML = users.map(u => {

const isAdmin = (u.role === 'support' || u.role === 'admin');
const agentColor = u.agent_color || '#0071e3';
const displayName = u.display_name || formatName(u.username);

return `
<div class="admin-mini-card" onclick="openAdminUserDetail('${u.username}', this)" 
style="--agent-color: ${agentColor}; position: relative;">
<div style="width:32px; height:32px; position:relative; flex-shrink:0;">
${getAvatarBubbleHTML(u, "100%")}
${u.is_online ? '<div style="position:absolute; bottom:0; right:0; width:8px; height:8px; border-radius:50%; background:#4cd964; box-shadow:0 0 5px #4cd964; border:1px solid #1e1e1e; z-index:1;"></div>' : ''}
</div>
<div style="flex: 1; overflow: hidden; padding-left: 6px;">
<div style="display:flex; align-items:center; gap:6px;">
<span style="font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
${u.status_text ? `<span style="font-size:10px; color:var(--accent-primary); opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;" title="${u.status_text}">💬 ${u.status_text.substring(0, 40)}</span>` : ''}
</div>
<div style="font-size:10px; color:var(--text-secondary); opacity:0.7;">
${isAdmin ? '★ ADMIN' : 'AGENT'} • @${u.username}
</div>
</div>
</div>`;
}).join('');
} catch (e) {
console.error("User List Error:", e);
listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#ff6b6b; font-size:12px;">Kunde inte hämta agenter.<br>Kontrollera din inloggning.</div>';
}
}

// =============================================================================
// ADMIN - openAdminUserDetail (FULLSTÄNDIG- NOTES INTEGRERAD)
// =============================================================================
async function openAdminUserDetail(username, element) {
if (window._adminFormDirty) {
const ok = await atlasConfirm('Osparade ändringar', 'Du har ändringar som inte sparats. Navigera bort?');
if (!ok) return;
window._adminFormDirty = false;
}
if(element) {
document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
element.classList.add('active');
}

const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;

placeholder.style.display = 'none';
detailBox.style.display = 'flex';
detailBox.innerHTML = '<div class="spinner-small"></div>';
detailBox.setAttribute('data-current-id', username); // Säkrar system-städning

try {
// 1. Hämta all data parallellt
const [userRes, officesRes, statsRes, ticketsRes] = await Promise.all([
fetch(`${SERVER_URL}/api/admin/users`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/user-stats/${username}`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/agent-tickets/${username}`, { headers: fetchHeaders })
]);

const users = await userRes.json();
const offices = await officesRes.json();
const stats = await statsRes.json();
const tickets = await ticketsRes.json();
const u = users.find(user => user.username === username);

// Sparas för Ticket Reader-modalen
currentTicketList = tickets;
const styles = getAgentStyles(username);
const readOnly = !isSupportAgent(); // Agent ser i läsläge

// --- ADMIN ACTIONS (HEADERN) ---
const actionsHTML = readOnly ? `
<button id="agent-detail-notes-btn" class="notes-trigger-btn footer-icon-btn"
data-id="agent_${u.username}"
onclick="openNotesModal('agent_${u.username}')"
style="color:${styles.main}"
title="Interna anteckningar om agenten">
${UI_ICONS.NOTES}
</button>
` : `
<button id="agent-detail-notes-btn" class="notes-trigger-btn footer-icon-btn"
data-id="agent_${u.username}"
onclick="openNotesModal('agent_${u.username}')"
style="color:${styles.main}"
title="Interna anteckningar om agenten">
${UI_ICONS.NOTES}
</button>

<button id="agent-detail-edit-btn" class="footer-icon-btn" 
onclick='openNewAgentForm(${JSON.stringify(u)})' 
title="Redigera profil" 
style="color:${styles.main}">
${ADMIN_UI_ICONS.EDIT}
</button>

<button class="footer-icon-btn danger" 
onclick="deleteUser('${u.id}', '${u.username}')" 
title="Radera användare" 
style="color:#ff453a; border-color:rgba(255,69,58,0.3);">
${UI_ICONS.TRASH}
</button>
`;

// --- TITEL & PILLS ---
const displayTitle = u.display_name || u.username;
const pillsHTML = `
<div class="pill" style="border-color:${styles.main}; color:${styles.main}; font-weight:800;">${u.role.toUpperCase()}</div>
<div class="pill">@${u.username}</div>
${readOnly ? '<div class="pill">👁️ Läsläge</div>' : ''}
`;

// --- RENDERARE
detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-header-top" style="border-bottom: 2px solid ${styles.main}; background: linear-gradient(90deg, ${styles.bg}, transparent);">
<div style="display:flex; align-items:center; gap:15px;">
<div class="msg-avatar" style="width:60px; height:60px; border: 3px solid ${styles.main}; font-size:24px;">
${getAvatarBubbleHTML(u, "100%")}
</div>
<div>
<h2 class="detail-subject">${displayTitle}</h2>
<div class="header-pills-row">${pillsHTML}</div>
</div>
</div>

<div class="detail-footer-toolbar" style="background:transparent; border:none; padding:0; gap:10px;">
<div style="margin-right:15px; text-align:right;">
<div style="font-size:9px; opacity:0.5; color:var(--text-secondary);">PROFILFÄRG</div>
<input type="color" value="${styles.main}" 
${readOnly ? 
'disabled style="width:28px; height:28px; pointer-events:none; opacity:0.4; background:none; border:none;"' : 
`oninput="(function(c){const h=document.querySelector('#admin-detail-content .detail-header-top');if(h){h.style.borderBottomColor=c;h.style.background='linear-gradient(90deg,'+c+'22,transparent)';}const a=document.querySelector('#admin-detail-content .msg-avatar');if(a)a.style.borderColor=c;clearTimeout(window._agentColorTimer);window._agentColorTimer=setTimeout(()=>updateAgentColor('${u.username}',c),700);})(this.value)" style="width:28px; height:28px; cursor:pointer; background:none; border:none;"`
}>
</div>
${actionsHTML}
</div>
</div>

<div class="detail-body" style="padding:25px; display:flex; flex-direction:column; gap:20px; overflow-y:auto; flex:1; min-height:0;">

<div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
<div class="admin-stat-card">
<div style="font-size:32px; font-weight:800; color:${styles.main};">${stats.active || 0}</div>
<div style="font-size:11px; opacity:0.5; text-transform:uppercase;">AKTIVA ÄRENDEN</div>
</div>

<div class="glass-panel" style="padding:15px; border-radius:12px; border:1px solid var(--border-color); background:rgba(255,255,255,0.02);">
<h4 style="margin:0 0 12px 0; font-size:10px; opacity:0.5; text-transform:uppercase;">Kontorsbehörighet</h4>
<div style="display:flex; flex-wrap:wrap; gap:6px; overflow-y:auto; max-height:100px;">
${offices.map(o => {
const isAssigned = u.routing_tag && u.routing_tag.includes(o.routing_tag);
const displayName = o.city + (o.area ? ' / ' + o.area : '');
const bg = isAssigned ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
const border = isAssigned ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
const color = isAssigned ? '#b09fff' : 'inherit';
return `
<label style="display:flex; align-items:center; gap:6px; font-size:11px;
padding:5px 10px; border-radius:6px; ${readOnly ? 'cursor:default;' : 'cursor:pointer;'}
background:${bg}; border:1px solid ${border}; color:${color};">
<input type="checkbox" ${isAssigned ? 'checked' : ''}
${readOnly ? 'disabled' : `onchange="updateAgentOfficeRole('${u.username}', '${o.routing_tag}', this.checked, this)"`}>
${adminEscapeHtml(displayName)}
</label>`;
}).join('')}
</div>
</div>
</div>

<div style="flex:1; display:flex; flex-direction:column; min-height:0;">
<h4 style="margin:0 0 12px 0; font-size:10px; opacity:0.5; text-transform:uppercase;">Pågående ärenden för agent</h4>
<div class="scroll-list" style="background:rgba(0,0,0,0.1); border-radius:12px; padding:10px; border:1px solid var(--border-color);">
${tickets.length ? tickets.map((t, idx) => `
<div class="admin-ticket-preview" onclick="openTicketReader(${idx}, '${username}')"
style="border-left: 3px solid ${styles.main} !important; --atp-color: ${styles.main} !important;">
<div style="flex:1; min-width:0;">
<div class="atp-sender">${t.sender || 'Okänd kund'}</div>
<div class="atp-subject">${t.subject || 'Inget ämne'}</div>
</div>
<button class="atp-note-btn" 
onclick="event.stopPropagation(); openNotesModal('${t.conversation_id || t.id}')" 
title="Intern anteckning">
${UI_ICONS.NOTES}
</button>
</div>
`).join('') : '<div class="template-item-empty">Inga aktiva ärenden.</div>'}
</div>
</div>
</div>
</div>`;

detailBox.querySelectorAll('.atp-note-btn').forEach(btn => {
btn.style.setProperty('color', 'var(--atp-color, #0071e3)', 'important');
});
} catch (e) {
console.error("Admin Agent Detail Error:", e);
detailBox.innerHTML = '<div class="template-item-empty" style="color:#ff453a;">Kunde inte ladda agentprofilen.</div>';
}
}

// ===================================================
// ADMIN - RENDER OFFICE LIST
// ===================================================
async function renderAdminOfficeList() {
const listContainer = document.getElementById('admin-main-list');
listContainer.innerHTML = '<div class="spinner-small"></div>';

try {
// Använder din nya fetchHeaders som nu fungerar
const res = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
const offices = await res.json();

// Sortera: A-Ö
offices.sort((a, b) => a.city.localeCompare(b.city, 'sv'));

listContainer.innerHTML = offices.map(o => {
const subtext = o.area ? o.area : '';
const initial = (o.city || 'K').charAt(0).toUpperCase();
const oc = o.office_color || '#0071e3';

return `
<div class="admin-mini-card" onclick="openAdminOfficeDetail('${o.routing_tag}', this)" style="--agent-color: ${oc}" data-routing-tag="${o.routing_tag}">
<div class="office-card-bubble" style="background:${oc}18; border-color:${oc}; color:${oc};">
${initial}
</div>
<div style="min-width:0; flex:1; overflow:hidden;">
<div class="office-card-sub" style="color:${oc};">${o.city}</div>
<div style="font-size:10px; opacity:0.6; color:var(--text-secondary); min-height:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${subtext}</div>
</div>
</div>`;
}).join('');
} catch (e) {
console.error("Office List Error:", e);
listContainer.innerHTML = '<p class="error-text">Kunde inte ladda kontor.</p>';
}
}

// =============================================================================
// ADMIN - openAdminOfficeDetail (FULLSTÄNDIG - ALL LOGIK INKLUDERAD)
// =============================================================================
async function openAdminOfficeDetail(tag, element) {
if (!tag) return;
if (window._adminFormDirty) {
const ok = await atlasConfirm('Osparade ändringar', 'Du har ändringar som inte sparats. Navigera bort?');
if (!ok) return;
window._adminFormDirty = false;
}

// 1. UI Feedback i listan
if (element) {
document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
element.classList.add('active');
}

const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;

placeholder.style.display = 'none';
detailBox.style.display = 'flex';
detailBox.innerHTML = '<div class="spinner-small"></div>';
detailBox.setAttribute('data-current-id', tag); 

try {
// 2. Hämta all data parallellt
const [res, ticketsRes, usersRes] = await Promise.all([
fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/office-tickets/${tag}`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/users`, { headers: fetchHeaders })
]);

if (!res.ok) throw new Error(`Kunde inte hitta kontorsdata för ${tag}`);

const data = await res.json();
const oc = data.office_color || '#0071e3';
const tickets = await ticketsRes.json();
const connectedAgents = (usersRes.ok ? await usersRes.json() : [])
.filter(u => u.routing_tag?.split(',').map(s => s.trim()).includes(tag));
currentTicketList = tickets; // Sparas för Reader-modalen
const readOnly = !isSupportAgent(); // Agent ser i läsläge

// 3. Rendera Master-Header och Body
detailBox.innerHTML = `
<div class="detail-container" id="box-office-master">

<div class="detail-header-top" id="office-detail-header" style="border-bottom: 2px solid ${oc}; background: linear-gradient(90deg, ${oc}1a, transparent); padding: 15px 20px;">
<div style="display:flex; align-items:center; gap:20px;">
<div class="profile-avatar" id="office-avatar-circle" style="width: 54px; height: 54px; background: ${oc}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff; font-weight: 800; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
${data.city ? data.city.substring(0,1) : 'K'}
</div>
<div>
<h2 class="detail-subject" style="margin-bottom: 4px;">${data.city} ${data.area ? '- ' + data.area : ''}</h2>
<div class="header-pills-row" style="display:flex; align-items:center; gap:8px;">
<div class="pill office-pill-accent" style="border-color:${oc}; color:${oc}; font-weight: 800;">KONTOR</div>

<div class="pill" style="border-color:${oc}66; color:${oc}; opacity: 0.8; font-family: monospace;">ID: ${tag}</div>

<button class="notes-trigger-btn footer-icon-btn"
data-id="office_${tag}"
onclick="openNotesModal('office_${tag}')"
style="color:${oc}; padding: 4px 8px;"
title="Interna anteckningar om kontoret">
${UI_ICONS.NOTES}
</button>
</div>
</div>
</div>

<div class="detail-footer-toolbar" style="background:transparent; border:none; padding:0; gap:10px;">
<button class="btn-glass-icon" onclick="deleteOffice('${tag}')" title="Radera kontor permanent"
style="color:#ff453a; border-color:rgba(255,69,58,0.3); display:${readOnly ? 'none' : 'flex'}">
${ADMIN_UI_ICONS.DELETE}
</button>
</button>
</div>
</div>
<div class="detail-body" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; padding:25px; overflow-y:auto; flex:1; min-height:0;">

<div style="display: flex; flex-direction: column; gap: 20px;">

<div class="glass-panel" id="box-contact" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color);">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Kontaktuppgifter</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-contact', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<div style="display: grid; gap: 12px;">
<input type="text" id="inp-phone" class="filter-input" value="${data.contact?.phone || ''}" disabled placeholder="Telefon">
<input type="text" id="inp-email" class="filter-input" value="${data.contact?.email || ''}" disabled placeholder="E-post">
<input type="text" id="inp-address" class="filter-input" value="${data.contact?.address || ''}" disabled placeholder="Adress">
<div style="display:flex; align-items:center; gap:10px; padding:8px 0;
border-top:1px solid rgba(255,255,255,0.05); margin-top:4px;">
<label style="font-size:11px; opacity:0.5; text-transform:uppercase; min-width:80px;">
Profilfärg
</label>
<input type="color" id="inp-office-color" value="${data.office_color || '#0071e3'}"
oninput="window._updateOfficeLiveColor(this.value)"
style="width:28px; height:28px; cursor:pointer; border:none;
background:transparent; border-radius:4px;">
<span id="inp-office-color-hex"
style="font-family:monospace; font-size:12px; opacity:0.6;">
${data.office_color || '#0071e3'}
</span>
</div>
</div>
</div>

<div class="glass-panel" id="box-prices" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color);">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Tjänster & Priser</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-prices', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<div class="price-list" style="display: grid; gap: 8px;" id="price-list-grid">
${data.prices ? data.prices.map((p, idx) => `
<div class="price-row" data-service-idx="${idx}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
<span style="font-size: 13px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" data-service-name="${p.service_name}">${p.service_name}</span>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink:0;">
<input type="number" class="price-inp" data-idx="${idx}" value="${p.price}" disabled style="width: 80px; text-align: right;">
<span style="font-size: 11px; opacity: 0.6;">SEK</span>
<button class="price-delete-btn" title="Ta bort tjänst"
style="display:none; width:22px; height:22px; border-radius:50%; background:rgba(255,69,58,0.15);
border:1px solid rgba(255,69,58,0.3); color:#ff453a; cursor:pointer; font-size:14px;
align-items:center; justify-content:center; padding:0; line-height:1; flex-shrink:0;"
onclick="this.closest('.price-row').remove(); window._adminFormDirty=true;">×</button>
</div>
</div>
`).join('') : '<div class="template-item-empty">Inga priser inlagda.</div>'}
</div>
<button id="add-service-btn" style="display:none; margin-top:10px; width:100%;" class="btn-glass-small" onclick="openAddServicePanel()">
+ Lägg till tjänst
</button>
<div id="add-service-panel" style="display:none; margin-top:14px; padding:12px; background:rgba(0,113,227,0.05); border:1px solid rgba(0,113,227,0.2); border-radius:8px;">
<div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px; text-transform:uppercase;">Välj tjänst att lägga till</div>
<select id="new-service-select" class="filter-input" style="width:100%; margin-bottom:8px;">
<option value="">Hämtar tjänster...</option>
</select>
<div style="display:flex; gap:8px; align-items:center;">
<input type="number" id="new-service-price" class="filter-input" placeholder="Pris (SEK)" style="flex:1; width:auto;">
<button class="btn-glass-small" onclick="confirmAddService()" style="background:rgba(0,200,100,0.15); border-color:rgba(0,200,100,0.3);">+ Lägg till</button>
<button class="btn-glass-small" onclick="document.getElementById('add-service-panel').style.display='none'">Avbryt</button>
</div>
</div>
</div>

<div class="glass-panel" id="box-booking" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color);">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Bokningslänkar</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-booking', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<div style="display:grid; gap:10px;">
${[['CAR','Bil'], ['MC','MC'], ['AM','AM/Moped']].map(([key, label]) => `
<div style="display:flex; align-items:center; gap:10px;">
<span style="font-size:11px; opacity:0.5; text-transform:uppercase; width:52px; flex-shrink:0;">${label}</span>
<input id="inp-booking-${key.toLowerCase()}" class="filter-input" type="url" disabled
placeholder="https://..."
value="${(data.booking_links && data.booking_links[key]) || ''}"
style="flex:1;">
</div>`).join('')}
</div>
</div>

<div class="glass-panel" id="box-desc" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color);">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">AI Kunskap (Beskrivning)</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-desc', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<textarea id="inp-desc" class="filter-input" style="width: 100%; height: 120px; resize: none;" disabled>${data.description || ''}</textarea>
<div style="font-size: 12px; opacity: 0.4; margin-top: 8px;">💡 Denna text används av Atlas AI för att svara på frågor om kontoret.</div>
</div>
</div>

<div style="display: flex; flex-direction: column;">
<div class="glass-panel" style="padding: 20px; border-radius: 12px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); height: 100%; display: flex; flex-direction: column; overflow:hidden;">
<h4 style="margin: 0 0 15px 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Aktiva Ärenden (${tickets.length})</h4>
<div class="scroll-list">
${tickets.length ? tickets.map((t, idx) => `
<div class="admin-ticket-preview" onclick="openTicketReader(${idx}, '${tag}')" 
style="border-left: 3px solid ${oc} !important; --atp-color: ${oc} !important;">
<div style="flex:1; min-width:0;">
<div class="atp-sender">${t.sender || 'Okänd kund'}</div>
<div class="atp-subject">${t.subject || 'Inget ämne'}</div>
</div>
<button class="atp-note-btn" 
onclick="event.stopPropagation(); openNotesModal('${t.conversation_id || t.id}')" 
title="Intern anteckning"
style="color:${oc} !important;">
${UI_ICONS.NOTES}
</button>
</div>
`).join('') : '<div class="template-item-empty" style="text-align:center;">Kön är tom ✅</div>'}
</div>
</div>

<div class="glass-panel" id="box-agents" style="padding:20px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); margin-top:16px;">
<h4 style="margin:0 0 12px 0; color:${oc}; font-size:11px; text-transform:uppercase;">Kopplade Agenter</h4>
${connectedAgents.length ? connectedAgents.map(u => `
<div style="display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
${getAvatarBubbleHTML(u, '28px')}
<span style="font-size:13px; flex:1;">${u.display_name || u.username}</span>
${u.is_online ? '<span style="width:7px;height:7px;border-radius:50%;background:#4cd964;box-shadow:0 0 4px #4cd964;flex-shrink:0;"></span>' : ''}
</div>`).join('')
: '<div style="opacity:0.4;font-size:12px;padding-top:6px;">Inga agenter kopplade</div>'}
</div>

</div>
</div>
</div>`;

// 4. Koppla Editeringsfunktioner
window.toggleEditMode = (boxId) => {
const box = document.getElementById(boxId);
box.querySelectorAll('input, textarea').forEach(el => {
if (el.id === 'inp-office-color') return; // färgväljare är alltid aktiv
el.disabled = false;
el.style.borderColor = 'var(--accent-primary)';
el.style.background = 'rgba(255,255,255,0.08)';
});
// Visa raderingsknapparna på prisrader
box.querySelectorAll('.price-delete-btn').forEach(btn => btn.style.display = 'flex');
document.getElementById('edit-mode-trigger').style.display = 'none';

const saveActions = box.querySelector('.save-actions');
if (saveActions) {
saveActions.style.setProperty('display', 'none', 'important');
// Starta inaktiva — aktiveras först vid faktisk ändring
const saveBtns = saveActions.querySelectorAll('button');
saveBtns.forEach(btn => {
btn.style.opacity = '0.35';
btn.style.pointerEvents = 'none';
btn.style.cursor = 'not-allowed';
btn.style.color = '';
btn.style.borderColor = '';
});
const activateSave = () => {
saveBtns.forEach(btn => {
btn.style.opacity = '1';
btn.style.pointerEvents = 'auto';
btn.style.cursor = 'pointer';
if (btn.getAttribute('data-action') === 'cancel') {
btn.style.color = '#ff453a';
btn.style.borderColor = 'rgba(255,69,58,0.4)';
} else if (btn.getAttribute('data-action') === 'save') {
btn.style.color = '#4cd964';
btn.style.borderColor = 'rgba(76,217,100,0.4)';
}
});
// Lyssna bara en gång
box.querySelectorAll('input, textarea').forEach(el => {
el.removeEventListener('input', activateSave);
el.removeEventListener('change', activateSave);
});
};
box.querySelectorAll('input, textarea').forEach(el => {
el.addEventListener('input', activateSave);
el.addEventListener('change', activateSave);
});
}

const addServiceBtn = document.getElementById('add-service-btn');
if (addServiceBtn) addServiceBtn.style.display = 'block';
};

window.cancelEdit = (boxId) => {
openAdminOfficeDetail(tag); // Ladda om vyn
};

// Live-uppdatering av kontorets accentfärg — kallas från color picker oninput
// Sparas automatiskt med debounce, ingen spara-knapp behövs för färgändring
window._updateOfficeLiveColor = (hex) => {
// Hex-display bredvid pickern
const hexEl = document.getElementById('inp-office-color-hex');
if (hexEl) hexEl.textContent = hex;

// Header — gradient och border
const header = document.getElementById('office-detail-header');
if (header) {
header.style.borderBottomColor = hex;
header.style.background = `linear-gradient(90deg, ${hex}1a, transparent)`;
}

// Avatar-bubbla i headern
const avatar = document.getElementById('office-avatar-circle');
if (avatar) avatar.style.background = hex;

// KONTOR-pill
const pill = document.querySelector('.office-pill-accent');
if (pill) { pill.style.borderColor = hex; pill.style.color = hex; }

// Notes-knapp i headern
const notesBtn = document.querySelector('.detail-footer-toolbar .notes-trigger-btn');
if (notesBtn) notesBtn.style.color = hex;

// Aktivt kort i listan
const activeCard = document.querySelector('#admin-main-list .admin-mini-card.active');
if (activeCard) {
activeCard.style.setProperty('--agent-color', hex);
const bubble = activeCard.querySelector('.office-card-bubble');
if (bubble) { bubble.style.background = hex + '18'; bubble.style.borderColor = hex; bubble.style.color = hex; }
const sub = activeCard.querySelector('.office-card-sub');
if (sub) sub.style.color = hex;
}

// Ärendekortens vänsterlinje i kontorsdetaljvyn
document.querySelectorAll('#admin-detail-content .admin-ticket-preview').forEach(card => {
card.style.setProperty('--atp-color', hex);
});

// Auto-spara med debounce — snabb endpoint, ingen AI-validering
clearTimeout(window._colorSaveTimer);
window._colorSaveTimer = setTimeout(async () => {
try {
const saveRes = await fetch(`${SERVER_URL}/api/admin/update-office-color`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ routing_tag: tag, color: hex })
});
if (saveRes.ok) {
await preloadOffices();      // Uppdatera officeData-cache
renderMyTickets?.();         // Ärendekort i Mina Ärenden
renderInbox?.();             // Ärendekort i Inkorg
showToast('🎨 Kontorsfärg sparad');
}

} catch (e) {
console.error('[OfficeColor] Auto-spara misslyckades:', e);
}
}, 700);
};


// =============================================================================
// SPARA SEKTION NÄR DU REDIGERAR ETT KONTORS INFO
// =============================================================================
window.saveOfficeSection = async (tag) => {
try {
const res = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders });
const currentData = await res.json();

// Hämta värden från formulären
currentData.contact.phone = document.getElementById('inp-phone').value;
currentData.contact.email = document.getElementById('inp-email').value;
currentData.contact.address = document.getElementById('inp-address').value;
currentData.description = document.getElementById('inp-desc').value;
const colorInput = document.getElementById('inp-office-color');
if (colorInput) currentData.office_color = colorInput.value;

// Bokningslänkar
const bookingKeys = { car: 'CAR', mc: 'MC', am: 'AM' };
if (!currentData.booking_links) currentData.booking_links = {};
Object.entries(bookingKeys).forEach(([inputKey, dataKey]) => {
const el = document.getElementById(`inp-booking-${inputKey}`);
if (el) currentData.booking_links[dataKey] = el.value.trim() || null;
});

// Priser — bygg komplett array från kvarvarande DOM-rader (raderade är borta)
const remainingPrices = [];
document.querySelectorAll('#price-list-grid .price-row').forEach(row => {
const inp = row.querySelector('.price-inp');
if (!inp) return;
const newService = inp.getAttribute('data-new-service');
const idx = inp.getAttribute('data-idx');

if (newService) {
// NY TJÄNST: Läs in de inbakade keywordsen från HTML-raden
let kw = [];
try {
kw = JSON.parse(row.getAttribute('data-keywords') || '[]');
} catch(e) {}
remainingPrices.push({ service_name: newService, price: parseInt(inp.value) || 0, currency: "SEK", keywords: kw });
} else if (idx !== null && currentData.prices[idx]) {
// EXISTERANDE TJÄNST: bevara keywords från filen, uppdatera bara pris
remainingPrices.push({ ...currentData.prices[idx], price: parseInt(inp.value) || 0 });
}
});
currentData.prices = remainingPrices;

const saveRes = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, {
method: 'PUT',
headers: fetchHeaders,
body: JSON.stringify(currentData)
});

if (saveRes.ok) {
window._adminFormDirty = false; // Markerar formuläret som sparat
showToast("✅ Kontorsdata sparad!");
await preloadOffices();
renderMyTickets?.();
renderInbox?.();
openAdminOfficeDetail(tag, null); // Laddar om och låser vyn automatiskt
}
} catch (e) { 
console.error("Admin Save Error:", e); 
showToast("❌ Ett fel uppstod vid sparning.");
}
};

} catch (e) {
console.error("Admin Office Detail Error:", e);
detailBox.innerHTML = '<div class="template-item-empty">Kunde inte ladda kontorsdata.</div>';
}
}

// =============================================================================
// NY FUNKTION: Lås upp specifik sektion i Kontorsvyn
// =============================================================================
window.unlockOfficeSection = function(sectionId, tag, btnElement) {
const box = document.getElementById(sectionId);
if (!box) return;

// Lås upp alla fält i denna sektion (utom färgväljaren som redan är klickbar)
box.querySelectorAll('input, textarea').forEach(el => {
if (el.id === 'inp-office-color') return;
el.disabled = false;
el.style.borderColor = 'var(--accent-primary)';
el.style.background = 'rgba(255,255,255,0.08)';
});

// Om det är pris-sektionen, visa lägg-till-knappen och papperskorgarna
if (sectionId === 'box-prices') {
const addBtn = document.getElementById('add-service-btn');
if (addBtn) addBtn.style.display = 'block';
box.querySelectorAll('.price-delete-btn').forEach(btn => btn.style.display = 'flex');
}

// Ändra knappen till "Spara" och gör den aktiv
btnElement.innerHTML = '💾 Spara';
btnElement.classList.add('unlocked');

// Byt onclick till att anropa spar-funktionen
btnElement.onclick = () => {
window.saveOfficeSection(tag);
btnElement.innerHTML = '⏳ Sparar...'; // Visuell laddnings-feedback
};
};

// =============================================================================
// ADMIN — TILLÄGG B: LÄGG TILL TJÄNST PÅ KONTOR (Uppdaterad)
// =============================================================================
async function openAddServicePanel() {
const panel = document.getElementById('add-service-panel');
const select = document.getElementById('new-service-select');
const priceInput = document.getElementById('new-service-price');
if (!panel || !select) return;

panel.style.display = 'block';
select.innerHTML = '<option value="">Hämtar tjänster...</option>';
if (priceInput) priceInput.value = ''; // Nollställ prisfältet!

try {
const res = await fetch(`${SERVER_URL}/api/admin/available-services`, { headers: fetchHeaders });
const services = await res.json();

// Spara globalt så confirmAddService kan läsa keywords senare
window._availableServiceTemplates = services; 

// Filtrera bort tjänster som redan finns på kontoret
const existing = new Set(
Array.from(document.querySelectorAll('#price-list-grid [data-service-name]'))
.map(el => el.getAttribute('data-service-name'))
);

const available = services.filter(s => !existing.has(s.service_name));
if (!available.length) {
select.innerHTML = '<option value="">Inga nya tillgängliga tjänster</option>';
} else {
select.innerHTML = '<option value="">— Välj tjänst —</option>' +
available.map(s => `<option value="${adminEscapeHtml(s.service_name)}">${adminEscapeHtml(s.service_name)}</option>`).join('');
}

// Tvinga prisrutan att bli tom om man byter tjänst
select.onchange = () => {
if (priceInput) priceInput.value = '';
};

} catch (e) {
select.innerHTML = '<option value="">Kunde inte hämta tjänster</option>';
}
}

function confirmAddService() {
const select = document.getElementById('new-service-select');
const priceInput = document.getElementById('new-service-price');
if (!select || !priceInput) return;

const serviceName = select.value;
const price = parseInt(priceInput.value) || 0;

if (!serviceName) { showToast('Välj en tjänst i listan.'); return; }

// Hitta tjänsten i vår globala template-lista för att få ut dess keywords
const template = (window._availableServiceTemplates || []).find(s => s.service_name === serviceName);
const keywords = template ? template.keywords : [];

const grid = document.getElementById('price-list-grid');
if (!grid) return;

const row = document.createElement('div');
row.className = 'price-row';
row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,100,0,0.15); border-radius:8px; border:1px solid rgba(0,200,100,0.2); margin-bottom:4px;';

// BAKAR IN KEYWORDS i DOM:en så vi kan plocka dem när vi sparar
row.setAttribute('data-keywords', JSON.stringify(keywords));

row.innerHTML = `
<span style="font-size:13px;" data-service-name="${adminEscapeHtml(serviceName)}">${adminEscapeHtml(serviceName)} <span style="font-size:10px; opacity:0.5;">(ny)</span></span>
<div style="display:flex; align-items:center; gap:8px;">
<input type="number" class="price-inp" data-new-service="${adminEscapeHtml(serviceName)}" value="${price}" style="width:80px; text-align:right; border-color:rgba(0,200,100,0.4); background:rgba(0,200,100,0.05); color:white; padding:4px; border-radius:4px;">
<span style="font-size:11px; opacity:0.6;">SEK</span>
<button class="price-delete-btn" onclick="this.closest('.price-row').remove(); window._adminFormDirty=true;" style="width:22px; height:22px; border-radius:50%; background:rgba(255,69,58,0.15); border:1px solid rgba(255,69,58,0.3); color:#ff453a; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; padding:0; line-height:1;">×</button>
</div>
`;
grid.appendChild(row);
window._adminFormDirty = true;

// Stäng panelen
document.getElementById('add-service-panel').style.display = 'none';
select.value = '';
priceInput.value = '';
showToast(`✅ ${serviceName} tillagd — spara för att bekräfta`);
}

// =============================================================================
// ADMIN TAB 3 — SYSTEMKONFIGURATION
// =============================================================================
function renderSystemConfigNav() {
const listContainer = document.getElementById('admin-main-list');
if (!listContainer) return;

const sections = [
{ id: 'network', icon: '🌐', label: 'Nätverksinställningar' },
{ id: 'email', icon: '📧', label: 'E-postkonfiguration' },
{ id: 'ai', icon: '🤖', label: 'AI-motor' },
{ id: 'paths', icon: '📁', label: 'Systemsökvägar' },
{ id: 'knowledge', icon: '📚', label: 'Kunskapsbank' },
{ id: 'drift', icon: '🛡️', label: 'Drift & Säkerhet' }
];

listContainer.innerHTML = sections.map(s => `
<div class="admin-sysconfig-nav-item" onclick="openSystemConfigSection('${s.id}', this)">
<span>${s.icon}</span>
<span>${s.label}</span>
</div>
`).join('');
}

async function openSystemConfigSection(section, element) {
const wasOpen = element && element.dataset.kbOpen === 'true';
document.querySelectorAll('.admin-sysconfig-nav-item').forEach(el => {
el.classList.remove('active');
el.dataset.kbOpen = 'false';
});
const existingKb = document.getElementById('kb-sublist');
if (existingKb) existingKb.remove();
if (element && !(section === 'knowledge' && wasOpen)) element.classList.add('active');

const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;

placeholder.style.display = 'none';
detailBox.style.display = 'flex';

if (section === 'knowledge') {
if (wasOpen) {
if (detailBox) detailBox.style.display = 'none';
if (placeholder) { placeholder.style.display = 'flex'; }
return;
}
if (element) element.dataset.kbOpen = 'true';
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/basfakta-list`, { headers: fetchHeaders });
if (!res.ok) throw new Error('List fetch failed');
const files = await res.json();
renderBasfaktaSubList(files);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte ladda kunskapsbanken.</div>';
}
return;
}

if (section === 'drift') {
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/operation-settings`, { headers: fetchHeaders });
if (!res.ok) throw new Error('Drift fetch failed');
const settings = await res.json();
renderDriftSecuritySection(detailBox, settings);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta drift-inställningar.</div>';
}
return;
}

detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/system-config`, { headers: fetchHeaders });
if (!res.ok) throw new Error('Config fetch failed');
const config = await res.json();
renderConfigSection(section, config, detailBox);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta konfiguration.</div>';
}
}

function renderConfigSection(section, config, detailBox) {
let rows = '';

if (section === 'network') {
rows = `
<h3 style="margin:0 0 20px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🌐 Nätverksinställningar</h3>
${buildConfigRow('PORT', 'PORT (Serverport)', config.PORT, false)}
${buildConfigRow('NGROK_DOMAIN', 'NGROK Domain', config.NGROK_DOMAIN, false)}
`;
} else if (section === 'email') {
rows = `
<h3 style="margin:0 0 20px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">📧 E-postkonfiguration</h3>
${buildConfigRow('EMAIL_USER', 'E-postadress', config.EMAIL_USER, false)}
${buildConfigRow('EMAIL_PASS', 'Lösenord / App-nyckel', config.EMAIL_PASS, true)}
`;
} else if (section === 'ai') {
rows = `
<h3 style="margin:0 0 20px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🤖 AI-motor — Confidence-trösklar</h3>
<div style="overflow-y:auto; max-height:calc(75vh - 120px); padding-right:8px;">
${buildConfigRow('OPENAI_API_KEY', 'OpenAI API-nyckel', config.OPENAI_API_KEY, true)}
${buildConfigRow('defaultConfidence', 'Default Confidence', config.defaultConfidence)}
${buildConfigRow('conf_weather', 'Väder (weather)', config.conf_weather)}
${buildConfigRow('conf_testlesson', 'Testlektion', config.conf_testlesson)}
${buildConfigRow('conf_risk', 'Risk', config.conf_risk)}
${buildConfigRow('conf_handledare', 'Handledare', config.conf_handledare)}
${buildConfigRow('conf_tillstand', 'Tillstånd', config.conf_tillstand)}
${buildConfigRow('conf_policy', 'Policy', config.conf_policy)}
${buildConfigRow('conf_contact', 'Kontakt', config.conf_contact)}
${buildConfigRow('conf_booking', 'Bokning', config.conf_booking)}
${buildConfigRow('conf_price', 'Pris', config.conf_price)}
${buildConfigRow('conf_discount', 'Rabatt', config.conf_discount)}
${buildConfigRow('conf_intent', 'Avsikt (intent)', config.conf_intent)}
</div>
`;
} else if (section === 'paths') {
rows = `
<h3 style="margin:0 0 20px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">📁 Systemsökvägar (Skrivskyddade)</h3>
${buildConfigRow('DEV_PATH', 'Utvecklingssökväg', config.DEV_PATH, false, true)}
${buildConfigRow('KNOWLEDGE_BASE_PATH', 'Kunskapsbas-sökväg', config.KNOWLEDGE_BASE_PATH, false, true)}
`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
${rows}
<div id="sysconfig-restart-notice" style="display:none;" class="admin-restart-notice">⚠️ Kräver omstart av servern för att träda i kraft</div>
<div id="sysconfig-changed-files" style="margin-top:12px;"></div>
</div>
</div>
`;
}

function unlockDriftField(id, field) {
const inp = document.getElementById(`drift-${id}`);
const lockBtn = document.getElementById(`drift-lock-${id}`);
const saveBtn = document.getElementById(`drift-save-${id}`);
if (!inp || !lockBtn) return;
inp.disabled = false;
if (inp.type !== 'checkbox') inp.focus();
lockBtn.textContent = '🔓 Låst upp';
lockBtn.classList.add('unlocked');
if (saveBtn) saveBtn.style.display = 'inline-block';
lockBtn.onclick = () => {
inp.disabled = true;
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockDriftField(id, field);
if (saveBtn) saveBtn.style.display = 'none';
};
}

async function saveDriftFieldAndLock(id, field) {
const inp = document.getElementById(`drift-${id}`);
const lockBtn = document.getElementById(`drift-lock-${id}`);
const saveBtn = document.getElementById(`drift-save-${id}`);
if (!inp) return;
const value = inp.type === 'checkbox' ? inp.checked.toString() : inp.value.trim();
const labelEl = document.getElementById(`drift-${id}-label`);
if (labelEl) labelEl.textContent = inp.checked ? 'Aktiverad' : 'Avaktiverad';
await saveDriftSetting(field, value);
inp.disabled = true;
if (lockBtn) {
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockDriftField(id, field);
}
if (saveBtn) saveBtn.style.display = 'none';
}

async function saveDriftSetting(field, value) {
try {
const res = await fetch(`${SERVER_URL}/api/admin/operation-settings`, {
method: 'POST',
headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ field, value })
});
if (!res.ok) throw new Error('Save failed');
console.log(`[Drift] ${field} = ${value}`);
} catch (e) {
alert('Kunde inte spara inställning: ' + e.message);
}
}

function renderDriftSecuritySection(detailBox, s) {
function buildDriftLockRow(id, field, label, value, inputType) {
if (inputType === 'checkbox') {
const checked = value === true || value === 'true';
return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">${label}</label>
<div style="display:flex; align-items:center; gap:12px;">
<input type="checkbox" id="drift-${id}" ${checked ? 'checked' : ''} disabled>
<span style="font-size:13px;" id="drift-${id}-label">${checked ? 'Aktiverad' : 'Avaktiverad'}</span>
<button class="admin-lock-btn" id="drift-lock-${id}" onclick="unlockDriftField('${id}','${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="drift-save-${id}" onclick="saveDriftFieldAndLock('${id}','${field}')">Spara</button>
</div>
</div>`;
}
const extraStyle = inputType === 'number' ? 'width:80px;' : inputType === 'jwt' ? 'width:120px;' : 'flex:1;';
const actualType = inputType === 'jwt' ? 'text' : inputType;
const extras = inputType === 'number' ? 'min="1" max="168"' : '';
return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">${label}</label>
<div style="display:flex; align-items:center; gap:8px;">
<input type="${actualType}" id="drift-${id}" class="admin-config-field" value="${value}" ${extras} style="${extraStyle}" disabled>
<button class="admin-lock-btn" id="drift-lock-${id}" onclick="unlockDriftField('${id}','${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="drift-save-${id}" onclick="saveDriftFieldAndLock('${id}','${field}')">Spara</button>
</div>
</div>`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
<h3 style="margin:0 0 20px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🛡️ Drift & Säkerhet</h3>
${buildDriftLockRow('imap', 'imap_enabled', 'IMAP-polling (e-post)', s.imap_enabled, 'checkbox')}
${buildDriftLockRow('backup-interval', 'backup_interval_hours', 'Backup-intervall (timmar)', s.backup_interval_hours, 'number')}
${buildDriftLockRow('backup-path', 'backup_path', 'Backup-sökväg', s.backup_path, 'text')}
${buildDriftLockRow('jwt', 'jwt_expires_in', 'JWT-livslängd (t.ex. 24h, 7d)', s.jwt_expires_in, 'jwt')}
${buildDriftLockRow('auto-exit', 'auto_human_exit', 'Auto-Human-Exit (återgå till AI när alla ärenden stängs)', s.auto_human_exit, 'checkbox')}
</div>
</div>
`;
}

function buildConfigRow(fieldId, label, value, isMasked, isReadonly) {
isMasked = isMasked || false;
isReadonly = isReadonly || false;
const displayValue = isMasked ? '••••••••' : (value || '');
const actualValue = (value || '').toString().replace(/"/g, '&quot;');
return `
<div class="admin-config-row" id="row-${fieldId}">
<label>${label}</label>
<input
class="admin-config-field"
id="field-${fieldId}"
type="text"
value="${displayValue}"
data-actual="${actualValue}"
data-masked="${isMasked}"
${isReadonly ? 'readonly style="opacity:0.4; cursor:not-allowed;"' : 'disabled'}
>
${!isReadonly ? `
<button class="admin-lock-btn" id="lock-${fieldId}" onclick="unlockConfigField('${fieldId}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="save-${fieldId}" onclick="saveSystemConfigField('${fieldId}')">Spara</button>
` : ''}
</div>
`;
}

function unlockConfigField(fieldId) {
const field = document.getElementById(`field-${fieldId}`);
const lockBtn = document.getElementById(`lock-${fieldId}`);
const saveBtn = document.getElementById(`save-${fieldId}`);
if (!field || !lockBtn) return;

const isMasked = field.getAttribute('data-masked') === 'true';
if (isMasked) field.value = field.getAttribute('data-actual') || '';

field.disabled = false;
field.focus();
lockBtn.textContent = '🔓 Låst upp';
lockBtn.classList.add('unlocked');
if (saveBtn) saveBtn.style.display = 'inline-block';

lockBtn.onclick = () => {
field.disabled = true;
if (isMasked) field.value = '••••••••';
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockConfigField(fieldId);
if (saveBtn) saveBtn.style.display = 'none';
};
}

async function saveSystemConfigField(fieldId) {
const field = document.getElementById(`field-${fieldId}`);
if (!field) return;
const value = field.value.trim();
if (!value) { showToast('❌ Värdet får inte vara tomt.'); return; }

const saveBtn = document.getElementById(`save-${fieldId}`);
if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '...'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/system-config`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ field: fieldId, value })
});
const data = await res.json();
if (!res.ok) { showToast(`❌ ${data.error || 'Serverfel'}`); return; }

showToast(`✅ ${fieldId} uppdaterad!`);

const changedEl = document.getElementById('sysconfig-changed-files');
if (changedEl && data.changedFiles && data.changedFiles.length) {
changedEl.innerHTML = `
<div style="font-size:11px; color:var(--text-secondary);">
<div style="margin-bottom:4px; opacity:0.6;">Synkade filer:</div>
${data.changedFiles.map(f => `<div style="font-family:monospace;">✓ ${f}</div>`).join('')}
</div>
`;
}

if (data.restartRequired) {
const notice = document.getElementById('sysconfig-restart-notice');
if (notice) notice.style.display = 'flex';
}

// Lås fältet igen
const lockBtn = document.getElementById(`lock-${fieldId}`);
field.disabled = true;
if (lockBtn) { lockBtn.textContent = '🔒 Låst'; lockBtn.classList.remove('unlocked'); lockBtn.onclick = () => unlockConfigField(fieldId); }
if (saveBtn) saveBtn.style.display = 'none';

} catch (e) {
showToast('❌ Nätverksfel vid sparning.');
} finally {
if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Spara'; }
}
}

// =============================================================================
// ADMIN TAB 3 — KUNSKAPSBANK (BASFAKTA)
// =============================================================================
function adminEscapeHtml(str) {
if (!str) return '';
return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderBasfaktaSubList(files) {
const detailBox = document.getElementById('admin-detail-content');
const listContainer = document.getElementById('admin-main-list');
if (!detailBox) return;

if (listContainer) {
const existing = listContainer.querySelector('#kb-sublist');
if (existing) existing.remove();

const subList = document.createElement('div');
subList.id = 'kb-sublist';
subList.style.cssText = 'padding-left:14px; border-left:2px solid rgba(0,113,227,0.3); margin-left:8px; margin-top:4px;';
subList.innerHTML = files.map(f => `
<div class="admin-sysconfig-nav-item" style="font-size:11px; padding:7px 10px;" onclick="openBasfaktaEditor('${adminEscapeHtml(f.filename)}', this)">
📄 ${adminEscapeHtml((f.section_title || f.filename).replace(/^BASFAKTA\s*-\s*/i, ''))}
</div>
`).join('');

const kbItem = listContainer.querySelector('[onclick*="knowledge"]');
if (kbItem) kbItem.after(subList);
else listContainer.appendChild(subList);
}

detailBox.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-secondary); font-size:13px; opacity:0.6;">Välj en fil i listan till vänster</div>';
}

async function openBasfaktaEditor(filename, element) {
document.querySelectorAll('#kb-sublist .admin-sysconfig-nav-item').forEach(el => el.classList.remove('active'));
if (element) element.classList.add('active');

const detailBox = document.getElementById('admin-detail-content');
if (!detailBox) return;
detailBox.innerHTML = '<div class="spinner-small"></div>';

try {
const res = await fetch(`${SERVER_URL}/api/admin/basfakta/${encodeURIComponent(filename)}`, { headers: fetchHeaders });
if (!res.ok) throw new Error('Fetch failed');
const data = await res.json();
detailBox.setAttribute('data-kb-file', filename);

const sectionsHtml = data.sections.map((s, idx) => `
<div class="admin-kb-section-card" id="kb-section-${idx}">
<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
<input type="text" class="admin-kb-title-field" id="kb-title-${idx}" value="${adminEscapeHtml(s.title)}" readonly>
<button class="admin-lock-btn" onclick="unlockBasfaktaSection(${idx})" id="kb-lock-${idx}" style="flex-shrink:0;">🔒 Lås upp</button><button id="kb-delete-${idx}" onclick="deleteBasfaktaSection(${idx})" style="flex-shrink:0; background:transparent; border:1px solid rgba(255,69,58,0.3); color:rgba(255,69,58,0.6); border-radius:6px; padding:4px 8px; font-size:11px; cursor:pointer;" title="Ta bort sektion">🗑</button>
</div>
<textarea class="admin-kb-answer-field" id="kb-answer-${idx}" rows="3" readonly>${adminEscapeHtml(s.answer)}</textarea>
<div class="admin-kb-keywords">
${(s.keywords || []).map(k => `<span class="kw-pill">${adminEscapeHtml(k)}</span>`).join('')}
</div>
</div>
`).join('');

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:20px;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
<div>
<h3 style="margin:0; font-size:14px; color:var(--accent-primary);">${adminEscapeHtml(data.section_title || filename)}</h3>
<div style="font-size:11px; opacity:0.5; margin-top:4px;">${data.sections.length} sektioner • ${adminEscapeHtml(filename)}</div>
</div>
<button class="header-button icon-only-btn" title="Spara fil" onclick="saveBasfaktaFile('${adminEscapeHtml(filename)}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
</div>
<div id="kb-sections-container">${sectionsHtml}</div>
<div style="margin-top:16px; text-align:center;">
<button onclick="addNewBasfaktaSection()" style="background:transparent; border:1px dashed rgba(0,113,227,0.4); color:rgba(0,113,227,0.7); border-radius:8px; padding:8px 20px; font-size:12px; cursor:pointer; width:100%;" title="Lägg till ny sektion">＋ Lägg till sektion</button>
</div>
</div>
</div>
`;
} catch (e) {
detailBox.innerHTML = `<div style="padding:20px; color:#ff6b6b;">Kunde inte ladda: ${adminEscapeHtml(filename)}</div>`;
}
}

// =============================================================================
// unlockBasfaktaSection (lägger till inline Spara-knapp)
// =============================================================================
function unlockBasfaktaSection(idx) {
const card = document.getElementById(`kb-section-${idx}`);
const titleField = document.getElementById(`kb-title-${idx}`);
const answerField = document.getElementById(`kb-answer-${idx}`);
const lockBtn = document.getElementById(`kb-lock-${idx}`);
if (!card || !titleField || !answerField || !lockBtn) return;

card.classList.add('unlocked');
titleField.removeAttribute('readonly');
answerField.removeAttribute('readonly');
answerField.style.height = 'auto';
answerField.style.height = answerField.scrollHeight + 'px';
lockBtn.textContent = '💾 Spara';
lockBtn.classList.add('unlocked');

lockBtn.onclick = () => {
const detailBox = document.getElementById('admin-detail-content');
const filenameAttr = detailBox ? detailBox.getAttribute('data-kb-file') : null;
if (filenameAttr) saveBasfaktaFile(filenameAttr);
};
}

// =============================================================================
// NY FUNKTION: deleteBasfaktaSection — tar bort en sektion från DOM och sparar
// =============================================================================
function deleteBasfaktaSection(idx) {
const card = document.getElementById(`kb-section-${idx}`);
if (!card) return;

if (!confirm('Är du säker på att du vill ta bort denna sektion permanent?')) return;

card.remove();

// Omindexera kvarvarande sektioner (uppdatera id:n)
const container = document.getElementById('kb-sections-container');
if (!container) return;
const remaining = container.querySelectorAll('.admin-kb-section-card');
remaining.forEach((c, newIdx) => {
c.id = `kb-section-${newIdx}`;
const t = c.querySelector('[id^="kb-title-"]');
const a = c.querySelector('[id^="kb-answer-"]');
const l = c.querySelector('[id^="kb-lock-"]');
const d = c.querySelector('[id^="kb-delete-"]');
if (t) t.id = `kb-title-${newIdx}`;
if (a) a.id = `kb-answer-${newIdx}`;
if (l) { l.id = `kb-lock-${newIdx}`; l.onclick = () => unlockBasfaktaSection(newIdx); }
if (d) { d.id = `kb-delete-${newIdx}`; d.onclick = () => deleteBasfaktaSection(newIdx); }
});

// Spara direkt
const detailBox = document.getElementById('admin-detail-content');
const filenameAttr = detailBox ? detailBox.getAttribute('data-kb-file') : null;
if (filenameAttr) saveBasfaktaFile(filenameAttr);
}

// =============================================================================
// NY FUNKTION: addNewBasfaktaSection — lägger till ny sektionskort längst ner
// =============================================================================
function addNewBasfaktaSection() {
const container = document.getElementById('kb-sections-container');
if (!container) return;

const existing = container.querySelectorAll('.admin-kb-section-card');
const newIdx = existing.length;

const newCard = document.createElement('div');
newCard.className = 'admin-kb-section-card unlocked';
newCard.id = `kb-section-${newIdx}`;
newCard.style.cssText = 'border: 1px solid rgba(0,113,227,0.4); background: rgba(0,113,227,0.06);';
newCard.innerHTML = `
<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
<input type="text" class="admin-kb-title-field" id="kb-title-${newIdx}" placeholder="Rubrik / Fråga..." style="flex:1;">
<button class="admin-lock-btn unlocked" id="kb-lock-${newIdx}" style="flex-shrink:0;" onclick="
(function(){
const detailBox = document.getElementById('admin-detail-content');
const fn = detailBox ? detailBox.getAttribute('data-kb-file') : null;
if(fn) saveBasfaktaFile(fn);
})()
">💾 Spara</button>
</div>
<textarea class="admin-kb-answer-field" id="kb-answer-${newIdx}" rows="3" placeholder="Skriv svaret här..."></textarea>
<div class="admin-kb-keywords" style="opacity:0.4; font-size:11px; margin-top:6px;">Keywords genereras automatiskt av AI vid sparning</div>
`;

container.appendChild(newCard);
newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
document.getElementById(`kb-title-${newIdx}`)?.focus();
}


async function saveBasfaktaFile(filename) {
const detailBox = document.getElementById('admin-detail-content');
if (!detailBox) return;

const sections = [];
let idx = 0;
while (document.getElementById(`kb-section-${idx}`)) {
const title = document.getElementById(`kb-title-${idx}`)?.value || '';
const answer = document.getElementById(`kb-answer-${idx}`)?.value || '';
sections.push({ title, answer });
idx++;
}

const saveBtn = detailBox.querySelector('button[onclick*="saveBasfaktaFile"]');
if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '⏳ Validerar...'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/basfakta/${encodeURIComponent(filename)}`, {
method: 'PUT',
headers: fetchHeaders,
body: JSON.stringify({ sections })
});
const data = await res.json();

if (!res.ok) {
showToast(`❌ ${data.error || 'Valideringsfel'}`);
if (data.aiMessage) {
const container = detailBox.querySelector('.detail-container');
if (container) {
const errDiv = document.createElement('div');
errDiv.style.cssText = 'margin-top:12px; padding:12px; background:rgba(255,0,0,0.1); border:1px solid rgba(255,0,0,0.3); border-radius:8px; font-size:12px; color:#ff6b6b;';
errDiv.textContent = `AI-validering: ${data.aiMessage}`;
container.appendChild(errDiv);
}
}
} else {
showToast('✅ Filen sparad och validerad!');
openBasfaktaEditor(filename, null);
}
} catch (e) {
showToast('❌ Nätverksfel vid sparning.');
} finally {
if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`; }
}
}

//=============================================
//====== OPEN TICKET READER CONTENT admin
//=============================================
function openTicketReader(idx, overrideTag = null) {
// 1. Spara index och den valda färg-taggen globalt
currentTicketIdx = idx;
window._currentAdminOverrideTag = overrideTag; 

let modal = document.getElementById('atlas-reader-modal');

// 2. Skapa modalen om den inte finns
if (!modal) { 
modal = document.createElement('div');
modal.id = 'atlas-reader-modal';
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '10000';
document.body.appendChild(modal);
}

// 3. Rendera innehållet (nu med kännedom om overrideTag)
renderReaderContent();

// 4. Visa modalen och aktivera stängning vid klick utanför
modal.style.display = 'flex';
modal.style.pointerEvents = 'all';
modal.onclick = (e) => { 
if (e.target === modal) modal.style.display = 'none'; 
};
}

// =============================================
// ====== RENDER READER CONTENT admin
// =============================================
function renderReaderContent() {
// 1. Säkra att vi har ett ärende och en modal att skriva till
const list = (typeof currentTicketList !== 'undefined') ? currentTicketList : (window._currentAdminTickets || []);
const t = list[currentTicketIdx];
if (!t) return;

const modal = document.getElementById('atlas-reader-modal');
if (!modal) return;

// 2. BRANDING: Använd sparad overrideTag (t.ex. Patric/Gävle) om den finns
const brandingTag = window._currentAdminOverrideTag || t.routing_tag || t.owner;
const rStyles = getAgentStyles(brandingTag);

const readerTitle = resolveTicketTitle(t);
const readerSubtitle = resolveLabel(t.routing_tag || t.owner);

// 3. OSCAR BERG-FIX: Förbered meddelandehistoriken
let messageHistoryHtml = '';
const messages = t.messages || [];

if (messages.length === 0) {
// Om historiken är tom, använd last_message
const raw = t.last_message || t.content || "Ingen historik ännu.";
const clean = raw.replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
messageHistoryHtml = `
<div style="display:flex; flex-direction:column; align-items:flex-start;">
<div style="font-size:9px; font-weight:700; letter-spacing:0.8px; opacity:0.4; margin-bottom:3px; color:${rStyles.main};">INKOMMET MEDDELANDE</div>
<div style="max-width:78%; padding:9px 13px; border-radius:3px 12px 12px 12px; background:${rStyles.bubbleBg}; border:1px solid ${rStyles.border}; font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">
${clean}
</div>
</div>`;
} else {
// Om historik finns, loopa igenom meddelandena
messageHistoryHtml = messages.map(m => {
const isUser = m.role === 'user'; 
const cleanText = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
return `
<div style="display:flex; flex-direction:column; align-items:${isUser ? 'flex-start' : 'flex-end'};">
<div style="font-size:9px; font-weight:700; letter-spacing:0.8px; opacity:0.4; margin-bottom:3px; color:${isUser ? rStyles.main : 'rgba(255,255,255,0.7)'};">
${isUser ? 'KUND' : 'AGENT'}
</div>
<div style="max-width:78%; padding:9px 13px; border-radius:${isUser ? '3px 12px 12px 12px' : '12px 3px 12px 12px'}; background:${isUser ? rStyles.bubbleBg : 'rgba(255,255,255,0.05)'}; border:1px solid ${isUser ? rStyles.border : 'rgba(255,255,255,0.07)'}; font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">
${cleanText}
</div>
</div>`;
}).join('');
}

// 4. BYGG MODALENS HTML
modal.innerHTML = `
<div class="glass-modal-box glass-effect" style="width:680px; max-width:92vw; border-top:3px solid ${rStyles.main}; position:relative; display:flex; flex-direction:column; max-height:82vh; overflow:hidden;">

<button id="reader-close-btn"
style="position:absolute; top:10px; right:10px; z-index:10; width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;"
onmouseover="this.style.background='rgba(255,69,58,0.45)';this.style.color='white'"
onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.4)'">
${ADMIN_UI_ICONS.CANCEL}
</button>

<div style="padding:14px 48px 14px 16px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; justify-content:space-between; align-items:center; flex-shrink:0; background:linear-gradient(90deg, ${rStyles.main}14, transparent);">
<div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
<div style="width:40px; height:40px; border-radius:10px; background:${rStyles.main}; color:black; font-weight:800; font-size:17px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 12px ${rStyles.main}55;">
${(readerTitle || 'U').substring(0,1).toUpperCase()}
</div>
<div style="min-width:0;">
<div style="font-size:15px; font-weight:700; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">${readerTitle || 'Okänd'}</div>
<div style="font-size:10px; opacity:0.4; color:white; letter-spacing:0.3px;">${readerSubtitle || ''} • ${t.conversation_id.replace('session_','').substring(0,10)}</div>
</div>
</div>

<div style="display:flex; align-items:center; gap:5px; flex-shrink:0; margin-left:10px;">
<button class="btn-glass-icon notes-trigger-btn"
onclick="openNotesModal('${t.conversation_id}')"
title="Interna anteckningar"
style="color:${rStyles.main}; border-color:${rStyles.border};">
${UI_ICONS.NOTES}
</button>
<div style="width:1px; height:16px; background:rgba(255,255,255,0.1); margin:0 3px;"></div>
<button class="btn-glass-icon" id="reader-prev"
${currentTicketIdx === 0 ? 'disabled' : ''}
style="${currentTicketIdx === 0 ? 'opacity:0.22; pointer-events:none;' : ''}"
title="Föregående ärende">
${ADMIN_UI_ICONS.ARROW_LEFT}
</button>
<span style="font-size:11px; font-weight:700; opacity:0.55; font-family:monospace; color:white; min-width:32px; text-align:center;">${currentTicketIdx + 1}/${currentTicketList.length}</span>
<button class="btn-glass-icon" id="reader-next"
${currentTicketIdx === currentTicketList.length - 1 ? 'disabled' : ''}
style="${currentTicketIdx === currentTicketList.length - 1 ? 'opacity:0.22; pointer-events:none;' : ''}"
title="Nästa ärende">
${ADMIN_UI_ICONS.ARROW_RIGHT}
</button>
</div>
</div>

<div style="flex:1; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:10px; min-height:0;">
${messageHistoryHtml}
</div>

<div style="padding:9px 14px; border-top:1px solid rgba(255,255,255,0.07); background:rgba(0,0,0,0.3); display:flex; justify-content:flex-end; align-items:center; gap:8px; flex-shrink:0;">
<button class="btn-glass-icon" onclick="assignTicketFromReader('${t.conversation_id}')"
title="Tilldela ärende till agent"
style="color:var(--text-secondary);">
${UI_ICONS.ASSIGN}
</button>
<button class="btn-glass-icon" onclick="claimTicketFromReader('${t.conversation_id}')"
title="Plocka upp ärendet"
style="color:${rStyles.main}; border-color:${rStyles.border}; background:${rStyles.main}1a;">
${UI_ICONS.CLAIM}
</button>
</div>

</div>`; // Slut på modal.innerHTML

// --- 5. LOGIK FÖR KNAPPAR (Kopplas efter att HTML injicerats) ---
modal.style.pointerEvents = 'all';

const closeBtn = modal.querySelector('#reader-close-btn');
if (closeBtn) {
closeBtn.style.pointerEvents = 'all';
closeBtn.onclick = () => { modal.style.display = 'none'; };
}

const prevBtn = modal.querySelector('#reader-prev');
const nextBtn = modal.querySelector('#reader-next');

if (prevBtn && currentTicketIdx > 0) {
prevBtn.style.pointerEvents = 'all';
prevBtn.onclick = () => navigateReader(-1);
}

if (nextBtn && currentTicketIdx < currentTicketList.length - 1) {
nextBtn.style.pointerEvents = 'all';
nextBtn.onclick = () => navigateReader(1);
}
} // <--- Denna stänger hela funktionen renderReaderContent

// ===================================================
// ADMIN - NAVIGERA READER
// ===================================================
function navigateReader(dir) {
const newIdx = currentTicketIdx + dir;
if (newIdx >= 0 && newIdx < currentTicketList.length) {
currentTicketIdx = newIdx;
renderReaderContent();
}
}

// =============================================================================
// ADMIN: WINDOW FUNKTIONER & HJÄLPLOGIK
// =============================================================================
// =============================================================================
// OpenNewAgentForm (inline i detaljvyn) 25/2
// =============================================================================
window.openNewAgentForm = async function(editUser = null) {
window._adminFormDirty = false;
const isEdit = !!editUser;

// Lokalt state för formuläret (closure) - anpassas om vi redigerar
let _avatarId = isEdit ? (editUser.avatar_id ?? 0) : 0;
const activeColor = isEdit ? editUser.agent_color : '#0071e3';

document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;
placeholder.style.display = 'none';
detailBox.style.display = 'flex';

// Hämta kontor
let offices = [];
try {
const r = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
if (r.ok) offices = await r.json();
} catch (_) {}

// Bygg avatar-grid HTML
const avatarGridHTML = AVATAR_ICONS.map((svg, i) => {
const isSelected = i === _avatarId;
const color = isEdit ? editUser.agent_color : '#0071e3';
return `
<div class="new-agent-avatar-opt ${isSelected ? 'nao-selected' : ''}" data-id="${i}" style="cursor:pointer;padding:8px;border-radius:10px;border:2px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'};background:${isSelected ? color + '15' : 'rgba(255,255,255,0.03)'};display:flex;align-items:center;justify-content:center;color:${isSelected ? color : 'rgba(255,255,255,0.35)'};transition:all 0.15s;width:36px;height:36px;box-sizing:border-box;">
<span style="display:flex;width:20px;height:20px;">${svg}</span>
</div>`}).join('');

// Bygg kontors-badges HTML
const officeBadgesHTML = offices.map(o => {
const isChecked = isEdit && editUser.routing_tag && editUser.routing_tag.split(',').map(t => t.trim()).includes(o.routing_tag);
const color = isEdit ? editUser.agent_color : '#0071e3';
return `
<label class="new-agent-office-label" style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:6px 10px;border-radius:8px;background:${isChecked ? color + '22' : 'rgba(255,255,255,0.03)'};border:1px solid ${isChecked ? color : 'rgba(255,255,255,0.07)'};transition:all 0.15s; color:${isChecked ? 'white' : 'inherit'};">
<input type="checkbox" class="new-agent-office-cb" value="${adminEscapeHtml(o.routing_tag)}" data-city="${adminEscapeHtml(o.city)}" ${isChecked ? 'checked' : ''} style="accent-color:${color};width:14px;height:14px;" onchange="window._toggleNewAgentOffice(this);">
<span>${adminEscapeHtml(o.city)}${o.area ? ' – ' + adminEscapeHtml(o.area) : ''}</span>
</label>`}).join('');

detailBox.innerHTML = `
<div class="detail-container" style="padding:24px;width:100%;overflow-y:auto;box-sizing:border-box;">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:16px;">
<h2 style="margin:0;font-size:18px;color:white;font-weight:700;">${isEdit ? 'Redigera agent' : 'Skapa ny agent'}</h2>
<div style="display:flex;gap:8px;">
<button class="btn-glass-icon" style="color: ${styles.main}; border-color: ${styles.main}66;" onclick="saveNewAgent(${isEdit ? "'" + editUser.id + "'" : 'null'})" title="Spara agent">${ADMIN_UI_ICONS.SAVE}</button>
<button class="btn-glass-icon" style="color:#ff453a;border-color:rgba(255,69,58,0.4);" onclick="renderAdminUserList();document.getElementById('admin-placeholder').style.display='flex';document.getElementById('admin-detail-content').style.display='none';" title="Avbryt">${ADMIN_UI_ICONS.CANCEL}</button>
</div>
</div>

<!-- 2-kolumnslayout -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">

<!-- Vänster: Baskonfiguration -->
<div style="display:flex;flex-direction:column;gap:16px;">

<!-- Live avatar-preview (med inbyggd färgväljare) -->
<div style="display:flex;align-items:center;gap:16px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);">
<div id="new-agent-avatar-preview" style="width:64px;height:64px;border-radius:50%;background:${activeColor};display:flex;align-items:center;justify-content:center;color:white;font-size:26px;font-weight:700;box-shadow:0 0 20px ${activeColor}66;flex-shrink:0;transition:background 0.2s,box-shadow 0.2s;">
${isEdit ? `<span style="display:flex;width:32px;height:32px;color:white;">${AVATAR_ICONS[_avatarId]}</span>` : 'A'}
</div>
<div style="flex:1;min-width:0;">
<div id="new-agent-preview-name" style="font-size:14px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isEdit ? (editUser.display_name || editUser.username) : 'Ny agent'}</div>
<div id="new-agent-preview-role" style="font-size:11px;opacity:0.5;margin-top:2px;">${isEdit ? editUser.role.toUpperCase() : 'Agent'}</div>
</div>
<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;">
<input type="color" id="new-agent-color" value="${activeColor}"
style="width:34px;height:34px;border:none;background:transparent;cursor:pointer;border-radius:8px;padding:2px;"
title="Välj accentfärg" oninput="window._updateNewAgentColor(this.value);">
<span id="new-agent-color-hex" style="font-family:monospace;font-size:10px;opacity:0.5;">${activeColor}</span>
</div>
</div>

<!-- Användarnamn -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Användarnamn *</label>
<input id="new-agent-username" class="filter-input" type="text" value="${isEdit ? editUser.username : ''}" ${isEdit ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'placeholder="t.ex. anna.karlsson"'}
oninput="window._adminFormDirty=true; const prev=document.getElementById('new-agent-avatar-preview'); if(prev&&!prev.querySelector('svg'))prev.textContent=this.value.charAt(0).toUpperCase()||'A'; const dn=document.getElementById('new-agent-displayname'); if(dn&&!dn._touched){dn.placeholder='t.ex. Anna Karlsson'; document.getElementById('new-agent-preview-name').textContent=this.value||'Ny agent';}">
</div>

<!-- Visningsnamn -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Visningsnamn</label>
<input id="new-agent-displayname" class="filter-input" type="text" value="${isEdit ? (editUser.display_name || '') : ''}" placeholder="t.ex. Anna Karlsson"
oninput="window._adminFormDirty=true; this._touched=true; document.getElementById('new-agent-preview-name').textContent=this.value||document.getElementById('new-agent-username').value||'Ny agent';">
</div>

<!-- Lösenord -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Lösenord ${isEdit ? '(lämna tomt för att behålla)' : '*'}</label>
<input id="new-agent-password" class="filter-input" type="password" placeholder="${isEdit ? 'Nytt lösenord' : 'Välj ett starkt lösenord'}"
oninput="window._adminFormDirty=true; window._checkNewAgentPw();">
</div>

<!-- Bekräfta lösenord -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Bekräfta lösenord ${isEdit ? '' : '*'}</label>
<input id="new-agent-password2" class="filter-input" type="password" placeholder="Upprepa lösenordet"
oninput="window._adminFormDirty=true; window._checkNewAgentPw();">
<div id="pw-match-indicator" style="font-size:11px;margin-top:5px;height:14px;"></div>
</div>

<!-- Roll -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Roll</label>
<select id="new-agent-role" class="filter-input" style="cursor:pointer;"
onchange="document.getElementById('new-agent-preview-role').textContent=this.options[this.selectedIndex].text; window._adminFormDirty=true;">
<option value="agent" ${isEdit && editUser.role === 'agent' ? 'selected' : ''}>Agent</option>
<option value="support" ${isEdit && (editUser.role === 'support' || editUser.role === 'admin') ? 'selected' : ''}>Support / Admin</option>
</select>
</div>

</div>

<!-- Höger: Avatar-väljare + Kontor -->
<div style="display:flex;flex-direction:column;gap:20px;">

<!-- Avatar-grid -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:10px;letter-spacing:0.05em;">Välj avatar</label>
<div id="new-agent-avatar-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
${avatarGridHTML}
</div>
</div>

<!-- Kopplade kontor -->
${offices.length ? `<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:10px;letter-spacing:0.05em;">Kopplade kontor</label>
<div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto;padding-right:4px;">
${officeBadgesHTML}
</div>
</div>` : ''}

</div>
</div>
</div>`;

// Lösenordsmatch-validator
window._checkNewAgentPw = function() {
const pw1 = document.getElementById('new-agent-password')?.value || '';
const pw2 = document.getElementById('new-agent-password2')?.value || '';
const ind = document.getElementById('pw-match-indicator');
if (!ind) return;
if (!pw2) { ind.textContent = ''; return; }
if (pw1 === pw2) { ind.textContent = '✓ Lösenorden matchar'; ind.style.color = '#4cd964'; }
else { ind.textContent = '✗ Lösenorden matchar inte'; ind.style.color = '#ff453a'; }
};

// Kontors-toggle: visuell feedback + toast
window._toggleNewAgentOffice = function(cb) {
const label = cb.closest('.new-agent-office-label');
const city = cb.dataset.city || cb.value;
const color = document.getElementById('new-agent-color')?.value || '#0071e3';
window._adminFormDirty = true;
if (cb.checked) {
if (label) {
label.style.background = color + '22';
label.style.borderColor = color;
label.style.color = 'white';
}
showToast(`📍 Kontor tillagt: ${city}`);
} else {
if (label) {
label.style.background = 'rgba(255,255,255,0.03)';
label.style.borderColor = 'rgba(255,255,255,0.07)';
label.style.color = '';
}
showToast(`🗑️ Kontor borttaget: ${city}`);
}
};

// Färg + avatar-preview-uppdatering
window._updateNewAgentColor = function(color) {
document.getElementById('new-agent-color-hex').textContent = color;
window._adminFormDirty = true;
const prev = document.getElementById('new-agent-avatar-preview');
if (prev) { prev.style.background = color; prev.style.boxShadow = `0 0 20px ${color}66`; }
// Uppdatera vald avatar-ikon i grid
document.querySelectorAll('.new-agent-avatar-opt.nao-selected').forEach(el => {
el.style.color = color;
el.style.borderColor = color;
el.style.background = color + '26';
});
// Uppdatera redan valda kontors-badges till ny färg
document.querySelectorAll('.new-agent-office-cb:checked').forEach(cb => {
const label = cb.closest('.new-agent-office-label');
if (label) { label.style.background = color + '22'; label.style.borderColor = color; }
});
};

// Avatar-grid klick-hantering
const avatarGrid = document.getElementById('new-agent-avatar-grid');
if (avatarGrid) {
// Om vi inte redigerar, markera första som vald som standard. 
// Om vi redigerar sköts detta redan av avatarGridHTML.
if (!isEdit) {
const first = avatarGrid.querySelector('.new-agent-avatar-opt');
if (first) first.classList.add('nao-selected');
_avatarId = 0;
}

avatarGrid.addEventListener('click', function(e) {
const opt = e.target.closest('.new-agent-avatar-opt');
if (!opt) return;
_avatarId = parseInt(opt.dataset.id);
const color = document.getElementById('new-agent-color')?.value || '#0071e3';

// Återställ alla, markera vald
avatarGrid.querySelectorAll('.new-agent-avatar-opt').forEach(el => {
el.classList.remove('nao-selected');
el.style.borderColor = 'rgba(255,255,255,0.08)';
el.style.background = 'rgba(255,255,255,0.03)';
el.style.color = 'rgba(255,255,255,0.35)';
});
opt.classList.add('nao-selected');
opt.style.borderColor = color;
opt.style.background = color + '26';
opt.style.color = color;

// Visa vald avatar i preview-bubblan
const prev = document.getElementById('new-agent-avatar-preview');
if (prev) {
prev.style.background = color;
prev.style.boxShadow = `0 0 20px ${color}66`;
prev.innerHTML = `<span style="display:flex;width:32px;height:32px;color:white;">${AVATAR_ICONS[_avatarId]}</span>`;
}
window._adminFormDirty = true;
});
}

// Exponera avatar-id för saveNewAgent
window._newAgentState = { getAvatarId: () => _avatarId };
};

// ======================================================
// SPARA AGENT (Hybrid: Skapa & Uppdatera)
// ======================================================
window.saveNewAgent = async function(editUserId = null) {
const isEdit = !!editUserId;
const username = (document.getElementById('new-agent-username')?.value || '').trim().toLowerCase();
const displayNameRaw = (document.getElementById('new-agent-displayname')?.value || '').trim();
const display_name = displayNameRaw || username;
const password = document.getElementById('new-agent-password')?.value || '';
const password2 = document.getElementById('new-agent-password2')?.value || '';
const role = document.getElementById('new-agent-role')?.value || 'agent';
const agentColor = document.getElementById('new-agent-color')?.value || '#0071e3';

// Hämta valt avatar-ID direkt från DOM (eftersom det är där vi sparar markeringen)
const selectedAvatar = document.querySelector('.new-agent-avatar-opt.nao-selected');
const avatarId = selectedAvatar ? parseInt(selectedAvatar.dataset.id) : 0;

// Samla valda kontor
const checkedOffices = document.querySelectorAll('.new-agent-office-cb:checked');
const routingTag = [...checkedOffices].map(cb => cb.value).filter(Boolean).join(',') || null;

// --- VALIDERING ---
if (!username) { showToast('Ange ett användarnamn.'); return; }

// Lösenord krävs bara vid nyskapande, eller om man faktiskt skrivit något i fältet
if (!isEdit && !password) { showToast('Ange ett lösenord för den nya agenten.'); return; }

if (password) {
if (password.length < 6) { showToast('Lösenordet måste vara minst 6 tecken.'); return; }
if (password !== password2) { showToast('Lösenorden matchar inte.'); return; }
}

// Bestäm endpoint och payload
const url = isEdit ? `${SERVER_URL}/api/admin/update-user-profile` : `${SERVER_URL}/api/admin/create-user`;
const payload = { 
username, 
role, 
display_name, 
agent_color: agentColor, 
avatar_id: avatarId, 
routing_tag: routingTag 
};

// Lägg bara till lösenordet i skicket om det faktiskt har ändrats/fyllts i
if (password) payload.password = password;
if (isEdit) payload.userId = editUserId;

try {
const res = await fetch(url, {
method: 'POST', 
headers: fetchHeaders,
body: JSON.stringify(payload)
});

if (res.ok) {
window._adminFormDirty = false;

// --- UPPDATERA LOKAL CACHE (Säkrar att UI:t stämmer direkt) ---
// Vi letar upp agenten i vår lokala cache och skriver över med de nya värdena
const cached = usersCache.find(u => u.username === username);
if (cached) {
cached.display_name = display_name;
cached.role = role;
cached.agent_color = agentColor;
cached.avatar_id = avatarId;
cached.routing_tag = routingTag;
} else if (!isEdit) {
// Om det är en helt ny agent kan vi behöva hämta hela listan på nytt
// eller pusha det nya objektet (renderAdminUserList gör oftast detta åt oss)
}

showToast(isEdit ? `✅ Profilen för @${username} är uppdaterad!` : `✅ Agenten @${username} skapad!`);

// 1. Rendera om listan till vänster (så färg/namn uppdateras där)
await renderAdminUserList();

renderMyTickets?.();
renderInbox?.();

// 2. Öppna detaljvyn igen (så headern och ikonerna uppdateras med den nya cachen)
openAdminUserDetail(username, null);

} else {
const err = await res.json().catch(() => ({}));
showToast('Fel: ' + (err.error || 'Kunde inte spara agenten.'));
}
} catch (e) { 
console.error("Save Agent Error:", e);
showToast('Anslutningsfel vid sparning.'); 
}
};

// ======================================================
// FIX 1c — openNewOfficeForm (inline i detaljvyn)
// ======================================================
window.openNewOfficeForm = async function() {
window._adminFormDirty = false;
window._newOfficePrices = [];
window._newOfficeColor = '#0071e3';

document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;
placeholder.style.display = 'none';
detailBox.style.display = 'flex';

// Paketmallar för tjänste-knappar
const PKG_TEMPLATES = {
'Bil': [
{ service_name: 'Testlektion BIL',   price: 0, currency: 'SEK', keywords: ['bil','testlektion','provlektion'] },
{ service_name: 'Körlektion Bil',    price: 0, currency: 'SEK', keywords: ['körlektion','bil','lektion'] },
{ service_name: 'Risk 1 BIL',        price: 0, currency: 'SEK', keywords: ['risk 1','riskettan','bil'] },
{ service_name: 'Risk 2 BIL',        price: 0, currency: 'SEK', keywords: ['risk 2','halkbana','bil'] },
{ service_name: 'Minipaket BIL',     price: 0, currency: 'SEK', keywords: ['minipaket','paket','bil'] },
{ service_name: 'Mellanpaket BIL',   price: 0, currency: 'SEK', keywords: ['mellanpaket','paket','bil'] },
{ service_name: 'Baspaket BIL',      price: 0, currency: 'SEK', keywords: ['baspaket','paket','bil'] },
],
'MC': [
{ service_name: 'Körlektion MC',     price: 0, currency: 'SEK', keywords: ['körlektion','mc','motorcykel','lektion'] },
{ service_name: 'Risk 1 MC',         price: 0, currency: 'SEK', keywords: ['risk 1','riskettan','mc'] },
{ service_name: 'Risk 2 MC',         price: 0, currency: 'SEK', keywords: ['risk 2','mc','knix'] },
],
'AM':   [{ service_name: 'AM Mopedutbildning', price: 0, currency: 'SEK', keywords: ['moped','am','moppekort'] }],
'Släp': [
{ service_name: 'B96 Paket',         price: 0, currency: 'SEK', keywords: ['b96','släp'] },
{ service_name: 'BE Paket',          price: 0, currency: 'SEK', keywords: ['be','släp'] },
],
};

// Hämta kontorlista för kopiera-dropdown
let templateOptions = '<option value="">Välj kontor att kopiera...</option>';
try {
const r = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
if (r.ok) {
const allOffices = await r.json();
templateOptions += allOffices.map(o => `<option value="${o.routing_tag}">${o.city}${o.area ? ' – ' + o.area : ''}</option>`).join('');
}
} catch (_) {}

detailBox.innerHTML = `
<div class="detail-container" style="padding:25px; width:100%; overflow-y:auto; box-sizing:border-box;">
<!-- Header -->
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:16px;">
<h2 style="margin:0; font-size:18px; color:white;">Nytt kontor</h2>
<div style="display:flex; gap:8px;">
<button id="no-save-btn" class="btn-glass-icon" style="color: ${oc}; border-color: ${oc}66;" onclick="saveNewOffice()" title="Spara">${ADMIN_UI_ICONS.SAVE}</button>
<button class="btn-glass-icon" style="color:#ff453a; border-color:rgba(255,69,58,0.4);" onclick="renderAdminOfficeList(); document.getElementById('admin-placeholder').style.display='flex'; document.getElementById('admin-detail-content').style.display='none';" title="Avbryt">${ADMIN_UI_ICONS.CANCEL}</button>
</div>
</div>

<!-- 2-kolumnsgrid -->
<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start;">

<!-- VÄNSTER KOLUMN -->
<div style="display:grid; gap:14px;">

<!-- Profil-cirkel + color picker -->
<div style="display:flex; align-items:center; gap:16px; padding:14px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);">
<div id="no-avatar-circle" style="width:64px; height:64px; border-radius:14px; background:#0071e3; display:flex; align-items:center; justify-content:center; color:white; font-size:28px; font-weight:700; box-shadow:0 0 20px rgba(0,113,227,0.4); flex-shrink:0; transition:background 0.2s;">N</div>
<div style="flex:1; min-width:0;">
<div id="no-preview-name" style="font-size:14px; font-weight:600; color:white;">Nytt kontor</div>
<div id="no-preview-tag" style="font-size:11px; opacity:0.5; margin-top:2px; font-family:monospace;">routing_tag</div>
</div>
<div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
<input type="color" id="no-color-picker" value="#0071e3"
style="width:34px; height:34px; border:none; background:transparent; cursor:pointer; border-radius:8px;"
oninput="window._noUpdateColor(this.value)">
<span id="no-color-hex" style="font-family:monospace; font-size:10px; opacity:0.5;">#0071e3</span>
</div>
</div>

<!-- Stad -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Stad *</label>
<input id="new-office-city" class="filter-input" type="text" placeholder="t.ex. Göteborg"
oninput="window._adminFormDirty=true; window._updateRoutingTagPreview(); window._noPreviewUpdate();">
</div>

<!-- Område -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Område</label>
<input id="new-office-area" class="filter-input" type="text" placeholder="t.ex. Ullevi (lämna tomt för centralt)"
oninput="window._adminFormDirty=true; window._updateRoutingTagPreview(); window._noPreviewUpdate();">
</div>

<!-- Routing Tag -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Routing Tag (auto-genereras)</label>
<input id="new-office-tag" class="filter-input" type="text" placeholder="auto"
oninput="window._adminFormDirty=true; document.getElementById('no-preview-tag').textContent=this.value||'routing_tag';">
</div>

<!-- Adress -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Adress</label>
<input id="new-office-address" class="filter-input" type="text" placeholder="Gatuadress, Postnummer Stad" oninput="window._adminFormDirty=true;">
</div>

<!-- Telefon -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Telefon</label>
<input id="new-office-phone" class="filter-input" type="text" placeholder="010-20 70 775" oninput="window._adminFormDirty=true;">
</div>

<!-- E-post -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">E-post</label>
<input id="new-office-email" class="filter-input" type="email" placeholder="hej@mydrivingacademy.com" oninput="window._adminFormDirty=true;">
</div>

<!-- Språk -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Språk (komma-separerade)</label>
<input id="new-office-languages" class="filter-input" type="text" placeholder="svenska, engelska" value="svenska, engelska" oninput="window._adminFormDirty=true;">
</div>

<!-- Beskrivning -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Beskrivning</label>
<textarea id="new-office-desc" class="filter-input" rows="3" placeholder="Välkommen till oss..."
style="resize:vertical; font-family:inherit; line-height:1.5;" oninput="window._adminFormDirty=true;"></textarea>
</div>

</div><!-- /VÄNSTER -->

<!-- HÖGER KOLUMN -->
<div style="display:grid; gap:14px;">

<!-- Tjänster & Priser rubrik -->
<div style="font-size:11px; text-transform:uppercase; opacity:0.4; letter-spacing:0.08em; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.06);">Tjänster &amp; Priser</div>

<!-- Paket-knappar -->
<div style="display:flex; gap:8px; flex-wrap:wrap;">
<button class="btn-glass-small" onclick="window._noAddPackage('Bil')" style="font-size:12px;">+ Bil</button>
<button class="btn-glass-small" onclick="window._noAddPackage('MC')" style="font-size:12px;">+ MC</button>
<button class="btn-glass-small" onclick="window._noAddPackage('AM')" style="font-size:12px;">+ AM</button>
<button class="btn-glass-small" onclick="window._noAddPackage('Släp')" style="font-size:12px;">+ Släp</button>
</div>

<!-- Kopiera från kontor -->
<div>
<div style="font-size:10px; text-transform:uppercase; opacity:0.4; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
<div style="flex:1; height:1px; background:rgba(255,255,255,0.08);"></div>
<span>eller kopiera från</span>
<div style="flex:1; height:1px; background:rgba(255,255,255,0.08);"></div>
</div>
<select id="no-copy-select" class="filter-input" onchange="window._noLoadTemplate(this.value)">
${templateOptions}
</select>
</div>

<!-- Prislista -->
<div id="no-price-list" style="display:grid; gap:4px; max-height:400px; overflow-y:auto; padding-right:4px;">
<div style="font-size:12px; opacity:0.3; padding:10px 0; text-align:center;">Inga tjänster tillagda ännu.</div>
</div>

</div><!-- /HÖGER -->

</div><!-- /grid -->
</div>`;

// ──────── Hjälpfunktioner (window-scope) ────────

window._updateRoutingTagPreview = function() {
const city = document.getElementById('new-office-city')?.value || '';
const area = document.getElementById('new-office-area')?.value || '';
const tagEl = document.getElementById('new-office-tag');
if (!tagEl) return;
const clean = (s) => s.toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[^a-z0-9]/g,'');
const generated = area ? `${clean(city)}_${clean(area)}` : clean(city);
tagEl.value = generated;
const previewTag = document.getElementById('no-preview-tag');
if (previewTag) previewTag.textContent = generated || 'routing_tag';
};

window._noUpdateColor = function(hex) {
window._newOfficeColor = hex;
const circle = document.getElementById('no-avatar-circle');
if (circle) { circle.style.background = hex; circle.style.boxShadow = `0 0 20px ${hex}66`; }
const label = document.getElementById('no-color-hex');
if (label) label.textContent = hex;
};

window._noPreviewUpdate = function() {
const city = document.getElementById('new-office-city')?.value || '';
const area = document.getElementById('new-office-area')?.value || '';
const circle = document.getElementById('no-avatar-circle');
if (circle) circle.textContent = (city.charAt(0) || 'N').toUpperCase();
const nameEl = document.getElementById('no-preview-name');
if (nameEl) nameEl.textContent = city ? (area ? `${city} – ${area}` : city) : 'Nytt kontor';
};

window._noAddPackage = function(type) {
const templates = PKG_TEMPLATES[type] || [];
const existing = new Set(window._newOfficePrices.map(p => p.service_name));
const toAdd = templates.filter(p => !existing.has(p.service_name));
window._newOfficePrices.push(...toAdd);
window._noRenderPriceList();
};

window._noLoadTemplate = async function(tag) {
if (!tag) return;
try {
const r = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders });
if (!r.ok) { showToast('Kunde inte läsa kontorsdata.'); return; }
const data = await r.json();
const prices = data.prices || [];
const cityKey = (data.city || '').toLowerCase();
const areaKey = (data.area || '').toLowerCase();
const stopWords = new Set([cityKey, areaKey, 'my', 'mårtenssons', 'trafikskola', 'my driving academy'].filter(k => k));
window._newOfficePrices = prices.map(p => ({
...p,
keywords: (p.keywords || []).filter(kw => !stopWords.has(kw.toLowerCase()))
}));
window._noRenderPriceList();
// Återställ dropdown
const sel = document.getElementById('no-copy-select');
if (sel) sel.value = '';
} catch (_) { showToast('Anslutningsfel vid kopiering.'); }
};

window._noRemovePrice = function(idx) {
window._newOfficePrices.splice(idx, 1);
window._noRenderPriceList();
};

window._noRenderPriceList = function() {
const list = document.getElementById('no-price-list');
if (!list) return;
if (!window._newOfficePrices.length) {
list.innerHTML = '<div style="font-size:12px; opacity:0.3; padding:10px 0; text-align:center;">Inga tjänster tillagda ännu.</div>';
return;
}
list.innerHTML = window._newOfficePrices.map((p, i) => `
<div class="no-price-row" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:4px;">
<span style="font-size:12px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.service_name}</span>
<div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;">
<input type="number" data-idx="${i}" value="${p.price}"
style="width:80px; text-align:right; padding:4px 8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:inherit; font-size:12px;"
oninput="window._newOfficePrices[${i}].price=parseFloat(this.value)||0">
<span style="font-size:11px; opacity:0.5;">SEK</span>
<button onclick="window._noRemovePrice(${i})"
style="width:22px; height:22px; border-radius:50%; background:rgba(255,69,58,0.15); border:1px solid rgba(255,69,58,0.3); color:#ff453a; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; padding:0; line-height:1;">×</button>
</div>
</div>`).join('');
};

};

window.saveNewOffice = async function() {
const city = document.getElementById('new-office-city')?.value.trim();
const area = document.getElementById('new-office-area')?.value.trim() || '';
const routingTag = document.getElementById('new-office-tag')?.value.trim();
if (!city || !routingTag) { showToast('Ange minst stad och routing tag.'); return; }

// Samla kontaktuppgifter
const contact = {
phone:   document.getElementById('new-office-phone')?.value.trim() || '',
email:   document.getElementById('new-office-email')?.value.trim() || '',
address: document.getElementById('new-office-address')?.value.trim() || '',
};

// Hämta beskrivning & språk
const description = document.getElementById('new-office-desc')?.value.trim() || '';
const langRaw = document.getElementById('new-office-languages')?.value || 'svenska, engelska';
const languages = langRaw.split(',').map(s => s.trim()).filter(Boolean);

// Bestäm services_offered automatiskt från priser, eller tom array om priserna saknas
const prices = window._newOfficePrices || [];
const sSet = new Set();
prices.forEach(p => {
const kw = p.keywords || [];
if (kw.includes('bil')) sSet.add('Bil');
if (kw.includes('mc') || kw.includes('motorcykel')) sSet.add('MC');
if (kw.includes('am') || kw.includes('moped')) sSet.add('AM');
if (kw.includes('b96') || kw.includes('be') || kw.includes('släp')) sSet.add('Släp');
});
const services_offered = [...sSet];

// Disable Spara-knapp under sparning
const saveBtn = document.getElementById('no-save-btn');
if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/create-office`, {
method: 'POST', headers: fetchHeaders,
body: JSON.stringify({
city, area, routing_tag: routingTag,
office_color: window._newOfficeColor || '#0071e3',
services_offered,
prices,
contact,
description,
languages
})
});
if (res.ok) {
window._adminFormDirty = false;
showToast(`✅ Kontoret ${city} är nu live!`);
await renderAdminOfficeList();
openAdminOfficeDetail(routingTag, null);
} else {
const err = await res.json().catch(() => ({}));
showToast('Fel: ' + (err.error || 'Kunde inte skapa kontor.'));
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
} catch (e) {
showToast('Anslutningsfel.');
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
};


window.createNewUser = async () => {
const username = await atlasPrompt("Ny Agent", "Ange inloggningsnamn:");
if (!username) return;
const password = await atlasPrompt("Lösenord", `Ange lösenord för ${username}:`, "Välkommen123!");
if (!password) return;
const res = await fetch(`${SERVER_URL}/api/admin/create-user`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ username, password, role: 'agent' }) });
if (res.ok) renderAdminUserList();
else alert("Kunde inte skapa agent.");
};

window.toggleAdminStatus = async (username, isAdmin) => {
const newRole = isAdmin ? 'support' : 'agent';
const res = await fetch(`${SERVER_URL}/api/admin/update-role-by-username`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ username, newRole }) });
if (res.ok) showToast(`Rättigheter uppdaterade för @${username}`);
};

// =============================================================================
// UI: UPPDATERA FÄRGER PÅ AGENTER
// =============================================================================
window.updateAgentColor = async (username, color) => {
const res = await fetch(`${SERVER_URL}/api/admin/update-agent-color`, { 
method: 'POST', 
headers: fetchHeaders, 
body: JSON.stringify({ username, color }) 
});

if (res.ok) {
showToast("Färg sparad");

// --- START PÅ LIVE-UPPDATERING I UI ---
const detailBox = document.getElementById('admin-detail-content');
if (detailBox) {
// 1. Uppdatera Headern
const headerTop = detailBox.querySelector('.detail-header-top');
if (headerTop) {
headerTop.style.borderBottomColor = color;
headerTop.style.background = `linear-gradient(90deg, ${color}22, transparent)`;
}

// 2. Uppdatera Avatar-ringen OCH ikonen inuti (Det du störde dig på!)
const avatar = detailBox.querySelector('.msg-avatar');
if (avatar) {
avatar.style.borderColor = color;
// Här letar vi upp div:en inuti bubblan. 
// Eftersom din getAvatarBubbleHTML har "color: ${color}" på inner-diven, uppdaterar vi den här:
const innerIconContainer = avatar.querySelector('.avatar-inner-icon') || avatar.querySelector('.user-avatar div');
if (innerIconContainer) {
innerIconContainer.style.color = color;
}
}

// 3. Uppdatera de nya SVG-ikonerna (Notes och Pennan)
const notesBtn = document.getElementById('agent-detail-notes-btn');
const editBtn = document.getElementById('agent-detail-edit-btn');
if (notesBtn) notesBtn.style.color = color;
if (editBtn) editBtn.style.color = color;

// 4. Uppdatera Piller & Ärendekort
const rolePill = detailBox.querySelector('.header-pills-row .pill');
if (rolePill) { 
rolePill.style.borderColor = color; 
rolePill.style.color = color; 
}

detailBox.querySelectorAll('.admin-ticket-preview').forEach(card => {
card.style.setProperty('--atp-color', color);
});
}

// KIRURGISK FIX: Synka med sidofältet om det är JAG (currentUser) som ändras
if (currentUser && username === currentUser.username) {
currentUser.agent_color = color;
localStorage.setItem('atlas_user', JSON.stringify(currentUser));

const sideAvatarRing = document.querySelector('.sidebar-footer .user-avatar');
const sideIconContainer = document.querySelector('.sidebar-footer .user-initial');
if (sideAvatarRing) sideAvatarRing.style.setProperty('border-color', color, 'important');
if (sideIconContainer) sideIconContainer.style.setProperty('background-color', color, 'important');
}

// --- DIN ORIGINAL-LOGIK (RÖR EJ) ---
const cached = usersCache.find(u => u.username === username);
if (cached) cached.agent_color = color;

renderAdminUserList();
renderMyTickets?.();
renderInbox?.();
}
};

// =============================================================================
// UI: UPPDATERA ROLLER PÅ AGENTER
// =============================================================================
window.updateAgentOfficeRole = async (username, tag, isChecked, checkboxEl) => {
const res = await fetch(`${SERVER_URL}/api/admin/update-agent-offices`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ username, tag, isChecked })
});
if (res.ok) {
showToast("Kontor uppdaterat");
// Visuell uppdatering direkt utan reload
if (checkboxEl) {
const label = checkboxEl.closest('label');
if (label) {
label.style.background = isChecked ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
label.style.borderColor = isChecked ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
label.style.color = isChecked ? '#b09fff' : '';
}
}
}
};

// =============================================================================
// UI: SPARA KONTORS FAKTA
// =============================================================================
async function saveOfficeKnowledge(tag) {
try {
const resGet = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders });
const data = await resGet.json();

// Uppdatera priser
document.querySelectorAll('.price-inp').forEach(input => {
const idx = input.getAttribute('data-idx');
if (data.prices && data.prices[idx]) data.prices[idx].price = parseInt(input.value) || 0;
});

// KORREKTA ID:N (Matchar openAdminOfficeDetail)
if(document.getElementById('inp-phone')) data.contact.phone = document.getElementById('inp-phone').value;
if(document.getElementById('inp-email')) data.contact.email = document.getElementById('inp-email').value;
if(document.getElementById('inp-address')) data.contact.address = document.getElementById('inp-address').value;
if(document.getElementById('inp-desc')) data.description = document.getElementById('inp-desc').value;

const resPut = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { method: 'PUT', headers: fetchHeaders, body: JSON.stringify(data) });
if (resPut.ok) showToast("✅ Kontorsdata sparad!");
} catch (err) { alert("Kunde inte spara: " + err.message); }
}

window.resetUserPassword = (id, name) => {
// DEL 4B: Dedikerad tvåfälts-modal — inget hårdkodat lösenord
let modal = document.getElementById('atlas-reset-pw-modal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-reset-pw-modal';
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '30000';
modal.innerHTML = `
<div class="glass-modal-box" style="min-width:340px;">
<div class="glass-modal-header"><h3 id="rpw-title">Återställ lösenord</h3></div>
<div class="glass-modal-body" style="display:flex; flex-direction:column; gap:12px;">
<p id="rpw-msg" style="opacity:0.7; font-size:13px;"></p>
<input id="rpw-pass1" type="password" placeholder="Nytt lösenord"
style="width:100%; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; font-size:14px; box-sizing:border-box;">
<input id="rpw-pass2" type="password" placeholder="Bekräfta lösenord"
style="width:100%; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; font-size:14px; box-sizing:border-box;">
<p id="rpw-error" style="color:#ff6b6b; font-size:12px; min-height:16px;"></p>
</div>
<div class="glass-modal-footer">
<button id="rpw-cancel" class="btn-modal-cancel">Avbryt</button>
<button id="rpw-ok" class="btn-modal-ok">Spara</button>
</div>
</div>`;
document.body.appendChild(modal);
}
document.getElementById('rpw-msg').textContent = `Nytt lösenord för @${name}:`;
document.getElementById('rpw-pass1').value = '';
document.getElementById('rpw-pass2').value = '';
document.getElementById('rpw-error').textContent = '';
modal.style.display = 'flex';
setTimeout(() => document.getElementById('rpw-pass1')?.focus(), 50);

document.getElementById('rpw-cancel').onclick = () => { modal.style.display = 'none'; };
document.getElementById('rpw-ok').onclick = async () => {
const p1 = document.getElementById('rpw-pass1').value.trim();
const p2 = document.getElementById('rpw-pass2').value.trim();
if (!p1) { document.getElementById('rpw-error').textContent = 'Lösenord får inte vara tomt.'; return; }
if (p1 !== p2) { document.getElementById('rpw-error').textContent = 'Lösenorden matchar inte.'; return; }
modal.style.display = 'none';
const res = await fetch(`${SERVER_URL}/api/admin/reset-password`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ userId: id, newPassword: p1 }) });
if (res.ok) showToast("Lösenord ändrat");
};
};

window.deleteUser = async (id, name) => {
const ok = await atlasConfirm("Radera agent", `Ta bort @${name} permanent?\nAgentens aktiva ärenden frigörs tillbaka till inkorgen.`);
if (!ok) return;
try {
const res = await fetch(`${SERVER_URL}/api/admin/delete-user`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ userId: id }) });
if (res.ok) {
showToast(`🗑️ @${name} raderad. Ärenden frigjorda till inkorgen.`);
renderAdminUserList();
document.getElementById('admin-placeholder').style.display = 'flex';
document.getElementById('admin-detail-content').style.display = 'none';
} else {
const err = await res.json().catch(() => ({}));
showToast('Fel: ' + (err.error || 'Kunde inte radera agenten.'));
}
} catch (e) { showToast('Anslutningsfel.'); }
};

window.deleteOffice = async (tag) => {
const ok = await atlasConfirm('Radera kontor', 'Är du säker? Detta raderar både databasposten och JSON-filen permanent.');
if (!ok) return;
try {
const res = await fetch(`${SERVER_URL}/api/admin/office/${tag}`, { method: 'DELETE', headers: fetchHeaders });
if (res.ok) {
showToast('🗑️ Kontor och tillhörande data raderat.');
await renderAdminOfficeList();
document.getElementById('admin-placeholder').style.display = 'flex';
document.getElementById('admin-detail-content').style.display = 'none';
} else {
const err = await res.json().catch(() => ({}));
showToast('Fel: ' + (err.error || 'Kunde inte radera kontoret.'));
}
} catch (e) { showToast('Anslutningsfel.'); }
};

// =============================================================================
// UI: UPPDATERA GLÖD-EFFEKT PÅ KNAPPAR
// =============================================================================
async function refreshNotesGlow(conversationId) {
try {
const res = await fetch(`${SERVER_URL}/api/notes/${conversationId}`, { headers: fetchHeaders });
const notes = await res.json();

// Hitta alla knappar i hela appen som hör till detta ID (Inbox, Mina Ärenden, Garage)
const buttons = document.querySelectorAll(`.notes-trigger-btn[data-id="${conversationId}"]`);

buttons.forEach(btn => {
if (notes && notes.length > 0) {
btn.classList.add('has-notes-active'); // Denna klass triggar animationen i din CSS
} else {
btn.classList.remove('has-notes-active');
}
});
} catch (err) {
// Tyst felhantering för att inte störa användaren vid t.ex. nätverksblink
}
}

// =============================================================================
// MODAL: ÖPPNA INTERNA ANTECKNINGAR
// =============================================================================
async function openNotesModal(conversationId) {
let modal = document.getElementById('atlas-notes-modal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-notes-modal';
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '20000';
document.body.appendChild(modal);
}

// Vi bygger om HTML varje gång för att garantera att vi har rätt ID:n och rensar gammalt skräp
modal.innerHTML = `
<div class="glass-modal-box" style="width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
<div class="glass-modal-header">
<h3>Interna kommentarer</h3>
</div>
<div class="glass-modal-body" style="flex: 1; overflow-y: auto; padding: 15px;">
<div id="notes-list-container" style="margin-bottom: 20px;">Laddar...</div>

<div class="note-input-area" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
<label style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 8px; display: block;">
Skriv ny anteckning
</label>
<textarea id="note-textarea" placeholder="Vad behöver kollegorna veta?" 
style="width:100%; height:80px; margin-bottom: 10px;"></textarea>
<button id="add-note-btn" class="btn-modal-confirm" style="width: 100%;">Spara anteckning</button>
</div>
</div>
<div class="glass-modal-footer">
<button id="close-notes-btn" class="btn-modal-cancel">Stäng</button>
</div>
</div>
`;

modal.style.display = 'flex';

// 1. Ladda anteckningarna (Denna rensar "Laddar..." direkt)
loadNotes(conversationId);

// 2. Koppla sparaknappen (onclick skriver över eventuella gamla lyssnare)
const saveBtn = document.getElementById('add-note-btn');
saveBtn.onclick = async () => {
const textarea = document.getElementById('note-textarea');
const content = textarea.value.trim();
if (!content) return;

saveBtn.disabled = true;
saveBtn.innerText = "Sparar...";

try {
const res = await fetch(`${SERVER_URL}/api/notes`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId, content })
});

if (res.ok) {
textarea.value = '';
await loadNotes(conversationId); // Ladda om listan
refreshNotesGlow(conversationId); // Uppdatera lysande ikon i listan
}
} catch (err) {
console.error("Fel vid sparande av notis:", err);
} finally {
saveBtn.disabled = false;
saveBtn.innerText = "Spara anteckning";
}
};

// 3. Stängknapp
document.getElementById('close-notes-btn').onclick = () => {
modal.style.display = 'none';
modal.innerHTML = ''; // TOTALRENSNING vid stängning för att stoppa ghosting
};
}
// =============================================================================
// LOGIK: HÄMTA ANTECKNINGAR TILL MODAL
// =============================================================================
async function loadNotes(conversationId) {
const container = document.getElementById('notes-list-container');
if (!container) return;

container.innerHTML = '<div style="opacity: 0.5; padding: 10px; font-style: italic;">Hämtar anteckningar...</div>';

try {
const res = await fetch(`${SERVER_URL}/api/notes/${conversationId}`, { headers: fetchHeaders });
const notes = await res.json();

if (!notes || notes.length === 0) {
container.innerHTML = '<div style="opacity: 0.4; padding: 20px; text-align: center; font-size: 13px;">Inga interna anteckningar ännu.</div>';
return;
}

container.innerHTML = notes.map(n => {
const d = new Date(n.created_at);
const dateStr = d.toLocaleDateString('sv-SE');
const timeStr = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
// Lagra råinnehåll i data-attribut — undviker HTML-stripping i editNote
const rawContent = n.content || '';
const escapedAttr = rawContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const escapedHtml = rawContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
return `
<div class="note-item" id="note-card-${n.id}" style="margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
<div class="note-header" style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 4px;">
<span style="color: var(--accent-primary); font-weight: bold; font-size: 12px;">${n.agent_name} · <span style="opacity:0.5; font-weight:400;">${dateStr} ${timeStr}</span></span>
<div style="display:flex; gap:4px;">
<button class="btn-glass-icon" style="width:26px; height:26px; padding:0;" onclick="window.editNote(${n.id}, '${conversationId}')" title="Redigera">${ADMIN_UI_ICONS.EDIT}</button>
<button class="btn-glass-icon" style="width:26px; height:26px; padding:0; color:#ff453a; border-color:rgba(255,69,58,0.3);" onclick="window.deleteNote(${n.id}, '${conversationId}')" title="Radera">${ADMIN_UI_ICONS.DELETE}</button>
</div>
</div>
<div class="note-body" id="note-body-${n.id}" data-content="${escapedAttr}" style="font-size: 13px; line-height: 1.4; color: #eee;">${escapedHtml}</div>
</div>`;
}).join('');

} catch (e) {
console.error("Noteload error:", e);
container.innerHTML = '<div style="color: #ff6b6b;">Kunde inte ladda anteckningar.</div>';
}
}
// Global alias — möjliggör anrop från inline onclick-attribut
window.loadNotes = loadNotes;

// =============================================================================
// FIX 3b — Redigera not (ROBUST: data-content + .value = undviker HTML-stripping)
// =============================================================================
window.editNote = function(id, convId) {
const card = document.getElementById(`note-card-${id}`);
const body = document.getElementById(`note-body-${id}`);
if (!card || !body) { console.warn('editNote: hittade ej note-card/body för id', id); return; }

// Läs råtext från data-attribut (HTML-säkert, undviker stripping av specialtecken)
const currentContent = body.dataset.content || body.textContent || '';

body.innerHTML = `
<textarea id="note-edit-${id}" style="width:100%; height:70px; padding:8px; border-radius:6px; border:1px solid var(--accent-primary); background:rgba(0,0,0,0.4); color:white; resize:vertical; font-family:inherit; font-size:13px;"></textarea>
<div style="display:flex; gap:8px; margin-top:6px;">
<button class="btn-glass-icon" style="width:auto; padding:0 12px; border-radius:20px; display:flex; align-items:center; gap:6px; color:#4cd964; border-color:rgba(76,217,100,0.4);" onclick="window.saveNoteEdit(${id}, '${convId}')">${ADMIN_UI_ICONS.SAVE} <span style="font-size:11px;">Spara</span></button>
<button class="btn-glass-icon" style="width:auto; padding:0 12px; border-radius:20px; display:flex; align-items:center; gap:6px; color:#ff453a; border-color:rgba(255,69,58,0.4);" onclick="window.loadNotes('${convId}')">${ADMIN_UI_ICONS.CANCEL} <span style="font-size:11px;">Avbryt</span></button>
</div>`;
// Sätt texten via .value (undviker HTML-injection i textarea-innehållet)
const textarea = document.getElementById(`note-edit-${id}`);
if (textarea) { textarea.value = currentContent; textarea.focus(); }
};

window.saveNoteEdit = async function(id, convId) {
const textarea = document.getElementById(`note-edit-${id}`);
if (!textarea) return;
const content = textarea.value.trim();
if (!content) return;
try {
const res = await fetch(`${SERVER_URL}/api/notes/${id}`, {
method: 'PUT',
headers: fetchHeaders,
body: JSON.stringify({ content })
});
if (res.ok) await loadNotes(convId);
else showToast('Kunde inte spara anteckning.');
} catch (e) { showToast('Nätverksfel.'); }
};

// =============================================================================
// FIX 3c — Radera not
// =============================================================================
window.deleteNote = async function(id, convId) {
try {
const res = await fetch(`${SERVER_URL}/api/notes/${id}`, { method: 'DELETE', headers: fetchHeaders });
if (res.ok) {
showToast('✅ Anteckning raderad!');
await loadNotes(convId);
} else showToast('Kunde inte radera anteckning.');
} catch (e) { showToast('Nätverksfel.'); }
};

// ---------------------------------------------------------------------------
// SLUT PÅ INITIALISERING (DOMContentLoaded)
// ---------------------------------------------------------------------------
// ==========================================================
// 🔲 BULK MODE — Flervalsfunktioner för Inkorg
// ==========================================================

function toggleBulkCard(card, id) {
if (selectedBulkTickets.has(id)) {
selectedBulkTickets.delete(id);
card.classList.remove('bulk-selected');
} else {
selectedBulkTickets.add(id);
card.classList.add('bulk-selected');
}
updateBulkToolbar();
}

function showBulkToolbar() {
if (document.getElementById('bulk-action-toolbar')) return;
const inboxView = document.getElementById('view-inbox');
if (!inboxView) return;
const toolbar = document.createElement('div');
toolbar.id = 'bulk-action-toolbar';
toolbar.className = 'bulk-action-toolbar';
toolbar.innerHTML = `
<span class="bulk-count-label">0 valda</span>
<div class="bulk-toolbar-btns">
<button class="bulk-btn bulk-btn-cancel" onclick="exitBulkMode()">Avbryt</button>
<button class="bulk-btn bulk-btn-claim" onclick="bulkClaim()">Plocka (0)</button>
<button class="bulk-btn bulk-btn-archive" onclick="bulkArchive()">Arkivera (0)</button>
</div>
`;
inboxView.appendChild(toolbar);
}

function updateBulkToolbar() {
const n = selectedBulkTickets.size;
const label = document.querySelector('#bulk-action-toolbar .bulk-count-label');
const claimBtn = document.querySelector('#bulk-action-toolbar .bulk-btn-claim');
const archBtn = document.querySelector('#bulk-action-toolbar .bulk-btn-archive');
if (label) label.textContent = `${n} valda`;
if (claimBtn) claimBtn.textContent = `Plocka (${n})`;
if (archBtn) archBtn.textContent = `Arkivera (${n})`;
}

window.exitBulkMode = function() {
isBulkMode = false;
selectedBulkTickets.clear();
if (DOM.inboxList) DOM.inboxList.classList.remove('bulk-mode-active');
document.querySelectorAll('#inbox-list .team-ticket-card.bulk-selected')
.forEach(c => c.classList.remove('bulk-selected'));
const toolbar = document.getElementById('bulk-action-toolbar');
if (toolbar) toolbar.remove();
};

window.bulkClaim = async function() {
const ids = [...selectedBulkTickets];
if (!ids.length) return;
exitBulkMode();
try {
await Promise.all(ids.map(id =>
fetch(`${SERVER_URL}/team/claim`, {
method: 'POST', headers: fetchHeaders,
body: JSON.stringify({ conversationId: id, agentName: currentUser.username })
})
));
showToast(`✅ ${ids.length} ärenden plockade!`);
} catch(e) {
console.error('[BulkClaim] Fel:', e);
showToast('⚠️ Några ärenden kunde inte plockas.');
}
renderInbox();
};

window.bulkArchive = async function() {
const ids = [...selectedBulkTickets];
if (!ids.length) return;
exitBulkMode();
try {
await Promise.all(ids.map(id =>
fetch(`${SERVER_URL}/api/inbox/archive`, {
method: 'POST', headers: fetchHeaders,
body: JSON.stringify({ conversationId: id })
})
));
showToast(`✅ ${ids.length} ärenden arkiverade!`);
} catch(e) {
console.error('[BulkArchive] Fel:', e);
showToast('⚠️ Några ärenden kunde inte arkiveras.');
}
renderInbox();
};

// ==========================================================
// FRISTÅENDE HJÄLPFUNKTIONER (GLOBAL SCOPE)
// ==========================================================
function auditDOM() {
console.log(`🔍 Startar DOM-Audit för Atlas ${ATLAS_VERSION}...`);
let errors = 0;

const check = (name, el) => {
if (!el) {
console.error(`❌ KABELBROTT: Elementet "${name}" saknas i index.html!`);
errors++;
}
};

if (typeof DOM === 'undefined') return console.error("❌ DOM-objektet saknas helt!");

// Kontrollera huvudvyer
Object.entries(DOM.views).forEach(([key, el]) => check(`Vy: ${key}`, el));

// Kontrollera kritiska fält
check("ChatMessages", DOM.chatMessages);
check("InboxList", DOM.inboxList);
check("ArchiveList", DOM.archiveList);
check("MyTicketsList", DOM.myTicketsList);


if (errors === 0) console.log("✅ ALLA DOM-KOPPLINGAR OK!");
else console.warn(`⚠️ HITTADE ${errors} FEL I KOPPLINGARNA.`);
}

/**
* ATLAS MASTER VALIDATOR
* Körs automatiskt för att hitta missmatchningar mellan JS, HTML och CSS.
*/
function masterSystemAudit() {
console.group("🚀 ATLAS SYSTEM INTEGRITY CHECK");

const missingInHtml = [];
const missingStyles = [];

// 1. Kontrollera alla objekt i DOM-cachen mot HTML
for (const [key, value] of Object.entries(DOM)) {
if (key === 'views' || key === 'inputs') {
for (const [subKey, subValue] of Object.entries(value)) {
if (!subValue) missingInHtml.push(`DOM.${key}.${subKey}`);
}
} else if (!value) {
missingInHtml.push(`DOM.${key}`);
}
}

// 2. Kontrollera om de ID:n vi använder faktiskt har CSS-regler
const criticalIDs = ['#chat-form', '#my-chat-input', '#my-ticket-chat-form', '#my-ticket-chat-input', '#my-chat-scroll-area'];

criticalIDs.forEach(id => {
const el = document.querySelector(id);

// Kontrollera endast styling om elementet faktiskt är synligt (inte dolt i en annan vy)
// offsetParent är null om elementet eller dess förälder har display: none
if (el && el.offsetParent !== null) { 
const styles = window.getComputedStyle(el);

// Om elementet inte har någon specifik bakgrund eller padding som vi förväntar oss från style.css
if (styles.padding === '0px' && styles.display === 'block') {
missingStyles.push(id);
}
}
});

// RAPPORTERING
if (missingInHtml.length > 0) {
console.warn("⚠️ HTML-SYNCH: Följande DOM-refs är null (borttagna vyer eller utgångna ID:n):", missingInHtml);
} else {
console.log("✅ HTML-SYNCH: Alla JS-referenser hittades i HTML.");
}

if (missingStyles.length > 0) {
console.warn("⚠️ CSS-VARNING: Följande ID:n saknar troligen styling i style.css:", missingStyles);
console.info("👉 Tips: Kolla om du glömt byta namn i style.css!");
} else {
console.log("✅ CSS-SYNCH: Alla kritiska element verkar ha stilregler.");
}

console.groupEnd();
}


// =============================================================================
// 🚀 ATLAS MASTER INIT - STARTMOTORN
// =============================================================================
async function initAtlasRenderer() {
console.log("📍 === ATLAS STARTAR (Global Context) ===");

// 1. Injicera login-modal i DOM
document.body.insertAdjacentHTML('beforeend', loginModalHTML);

// 1b. Koppla stäng-logik för login-modal (close-knapp + click-outside)
const _loginModal = document.getElementById('login-modal');
if (_loginModal) {
// Click-outside
_loginModal.addEventListener('click', (e) => {
if (e.target === _loginModal) _loginModal.style.display = 'none';
});

// Close-button
const closeBtn = _loginModal.querySelector('.modal-close');
if (closeBtn) closeBtn.addEventListener('click', () => { _loginModal.style.display = 'none'; });
}

// 2. Koppla kablarna (Fyll DOM-objektet)
// Detta MÅSTE ske här inne för att document.getElementById ska fungera
DOM = {
views: {
chat: document.getElementById('view-chat'),
templates: document.getElementById('view-templates'),
inbox: document.getElementById('view-inbox'),
'my-tickets': document.getElementById('view-my-tickets'),
archive: document.getElementById('view-archive'),
about: document.getElementById('view-about'),
admin: document.getElementById('view-admin')
},
menuItems: document.querySelectorAll('.menu-item'),
chatMessages: document.getElementById('chat-messages'),
messageInput: document.getElementById('my-chat-input'),
chatForm: document.getElementById('chat-form'),
appName: document.getElementById('app-name-display'),
myTicketsList: document.getElementById('my-tickets-list'),
myTicketDetail: document.getElementById('my-ticket-detail'),
myTicketPlaceholder: document.getElementById('my-detail-placeholder'),
myTicketChatForm: document.getElementById('my-ticket-chat-form'),
myTicketChatInput: document.getElementById('my-ticket-chat-input'),      
myTicketChatMessages: document.getElementById('my-chat-scroll-area'), 
templateList: document.getElementById('template-list'),
editorForm: document.getElementById('template-editor-form'),
editorPlaceholder: document.getElementById('editor-placeholder'),
inputs: {
id: document.getElementById('template-id-input'),
title: document.getElementById('template-title-input'),
group: document.getElementById('template-group-input'),
content: document.getElementById('template-content-input')
},
inboxList: document.getElementById('inbox-list'),
inboxDetail: document.getElementById('inbox-detail'),
inboxPlaceholder: document.getElementById('inbox-placeholder'),
archiveList: document.getElementById('archive-list'),
archiveDetail: document.getElementById('archive-detail'),
archivePlaceholder: document.getElementById('archive-placeholder'),
themeStylesheet: document.getElementById('theme-stylesheet')
};

// 3. Rensa och koppla sidomenyn (Väcker knapparna)
if (DOM.menuItems) {
DOM.menuItems.forEach(item => {
const newItem = item.cloneNode(true);
if (item.parentNode) item.parentNode.replaceChild(newItem, item);
newItem.addEventListener('click', () => switchView(newItem.dataset.view));
});
DOM.menuItems = document.querySelectorAll('.menu-item'); 
}

// 4. Autentisering och system-start
checkAuth();
await preloadOffices();
await preloadUsers();
initHeroPlaceholders();

// Socket-start
if (typeof io === 'undefined') {
loadSocketIoScriptWithRetry();
} else {
initializeSocket();
}

// =====================================
// 2. App Info & API Key (SÄKRAD)
// =====================================
if (window.electronAPI) {
const info = await window.electronAPI.getAppInfo();
API_KEY = info.CLIENT_API_KEY;
if (info.SERVER_URL) SERVER_URL = info.SERVER_URL; 

if (DOM.appName) DOM.appName.textContent = info.APP_NAME;
if (DOM.appVersion) DOM.appVersion.textContent = info.ATLAS_VERSION;

const sVer = info.SERVER_VERSION && info.SERVER_VERSION !== 'Väntar...'
? info.SERVER_VERSION
: 'Väntar...';

if (DOM.serverVersion) DOM.serverVersion.textContent = sVer;
}

// =====================================
// 3. Badges
// =====================================
updateInboxBadge();

setInterval(() => {
if (!authToken) return;
updateInboxBadge();
}, 10000);

// =====================================
// 3. Init Quill & Globala lyssnare (SÄKRAD)
// =====================================
if (typeof Quill !== 'undefined' && document.getElementById('quill-editor')) {
quill = new Quill('#quill-editor', {
theme: 'snow',
placeholder: 'Skriv mallens innehåll här...'
});

quill.on('text-change', (delta, oldDelta, source) => {
if (isLoadingTemplate) return;
if (source === 'user') {
const saveBtn = DOM.editorForm?.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = false;
}
});
}

// Säkra upp start-loopen med filter(Boolean)
[DOM.inputs.title, DOM.inputs.group].filter(Boolean).forEach(input => {
input.addEventListener('input', () => {
if (isLoadingTemplate) return;
const saveBtn = DOM.editorForm?.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = false;
});
});

// =====================================
// 4. Init State
// =====================================
initChat();
await loadTemplates();

// =====================================
// 5. Tema (SÄKRAD)
// =====================================
// Applicera alltid sparad tema — DOM.themeSelect existerar EJ än (Om-vyn ej rendererad)
// changeTheme() använder DOM.themeStylesheet (<link id="theme-stylesheet">) som alltid finns i HTML
const savedThemeOnLoad = localStorage.getItem('atlas-theme') || 'standard-theme';
changeTheme(savedThemeOnLoad);
// Synkronisera dropdownen om den redan är i DOM (annars sker det i renderAboutGrid)
if (DOM.themeSelect) DOM.themeSelect.value = savedThemeOnLoad;

// =====================================
// 6. EVENT LISTENERS (RENSAD)
// =====================================

// (Dubbletten för Meny borttagen här då den ligger i toppen nu)

// Skicka meddelande (SÄKRAD)
if (DOM.chatForm) {
DOM.chatForm.addEventListener('submit', (e) => {
e.preventDefault();
handleUserMessage(DOM.messageInput?.value || '');
});
}

// ==================================================
// 🖱️ SMART BAKGRUNDSKLICK (SÄKRAD)
// ==================================================
document.querySelectorAll('.template-list-container').forEach(container => {
container.addEventListener('click', (e) => {
const isCard = e.target.closest('.team-ticket-card') ||
e.target.closest('.template-item') ||
e.target.closest('.msg-row');

if (!isCard) {
const activeViewId = Object.keys(DOM.views).find(key =>
DOM.views[key] && DOM.views[key].style.display === 'flex'
);

if (activeViewId) {
resetToPlaceholder(activeViewId);
}
}
});
});

// Admin-sidebar: klick exakt på bakgrunden (ej på något kort/element) → återställ till placeholder
const adminMainList = document.getElementById('admin-main-list');
if (adminMainList) {
adminMainList.addEventListener('click', (e) => {
// Trigga bara om klicket landade direkt på container-elementet — aldrig på barn
if (e.target === adminMainList) {
const placeholder = document.getElementById('admin-placeholder');
const detailContent = document.getElementById('admin-detail-content');
if (placeholder) placeholder.style.display = 'flex';
if (detailContent) detailContent.style.display = 'none';
}
});
}

// ==================================================
// MINI-CHAT (SÄKRAD)
// ==================================================
if (DOM.myTicketChatForm) {
DOM.myTicketChatForm.addEventListener('submit', (e) => {
e.preventDefault();

const message = DOM.myTicketChatInput?.value.trim();
if (!message) return;

const detail = document.getElementById('my-ticket-detail');
const conversationId = detail?.getAttribute('data-current-id');

if (!conversationId) {
console.warn('⚠️ Ingen aktiv conversationId i mini-chat');
return;
}

if (window.socketAPI) {
window.socketAPI.emit('team:agent_reply', {
conversationId,
message
});
}

if (DOM.myTicketChatInput) DOM.myTicketChatInput.value = '';
});
}

// ==================================================
// LADDNING AV FUNKTIONER (DOM CONTENT LOADED)
// ==================================================
// 1. Sök mallar (SÄKRAD)
const tSearch = document.getElementById('template-search-input'); 
if (tSearch) {
tSearch.addEventListener('input', (e) => {
const term = e.target.value.toLowerCase();
if (!State.templates) return;
const filtered = State.templates.filter(t =>
t.title.toLowerCase().includes(term) ||
(t.group_name && t.group_name.toLowerCase().includes(term))
);
renderTemplates(filtered);
if (term.length > 0) {
document.querySelectorAll('.template-group-content').forEach(el => el.classList.add('expanded'));
}
});
}

// 2. Byt tema (SÄKRAD)
const themeDropdown = document.getElementById('theme-select');
const targetEl = themeDropdown || DOM.themeSelect; 
if (targetEl) {
const savedTheme = localStorage.getItem('atlas-theme');
if (savedTheme) targetEl.value = savedTheme;
const newDropdown = targetEl.cloneNode(true);
targetEl.parentNode.replaceChild(newDropdown, targetEl);
newDropdown.addEventListener('change', (e) => {
console.log("🎨 Manuellt byte av tema:", e.target.value);
changeTheme(e.target.value);
});
DOM.themeSelect = newDropdown;
}

// 3. Ny chatt (Header-knappen)
const headerNewChat = document.getElementById('new-chat-btn-header');
if (headerNewChat) {
const newBtn = headerNewChat.cloneNode(true);
headerNewChat.parentNode.replaceChild(newBtn, headerNewChat);
newBtn.addEventListener('click', async () => {
if (newBtn.disabled) return;
newBtn.disabled = true;
if (State.currentSession && State.currentSession.messages.length > 0) {
await saveLocalQA(State.currentSession, true);
}
initChat(true);
showToast('✅ Ny chatt påbörjad!');
if (DOM.views.archive && DOM.views.archive.style.display === 'flex') {
renderArchive();
}
setTimeout(() => { newBtn.disabled = false; }, 500);
});
}

// 4. "Skapa ny mall" knappen (HELT SÄKRAD)
const newTemplateBtn = document.getElementById('new-template-btn');
if (newTemplateBtn) {
newTemplateBtn.addEventListener('click', () => {
if (DOM.editorPlaceholder) DOM.editorPlaceholder.style.display = 'none';
if (DOM.editorForm) DOM.editorForm.style.display = 'flex';

if (DOM.inputs.id) DOM.inputs.id.value = '';
if (DOM.inputs.title) DOM.inputs.title.value = '';
if (DOM.inputs.group) DOM.inputs.group.value = '';

if (quill && quill.root) quill.root.innerHTML = '';

const delBtn = document.getElementById('delete-template-btn');
if (delBtn) delBtn.style.display = 'none';

if (DOM.editorForm) {
const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = true;
}
});
}

// 5. Spara mall (HELT SÄKRAD)
if (DOM.editorForm) {
DOM.editorForm.addEventListener('submit', async (e) => {
e.preventDefault();
const saveBtn = DOM.editorForm.querySelector('button[type="submit"]');
if (saveBtn) saveBtn.disabled = true;

const newTemplate = {
id: DOM.inputs.id?.value ? parseInt(DOM.inputs.id.value) : Date.now(),
title: DOM.inputs.title?.value || 'Namnlös mall',
group_name: DOM.inputs.group?.value || 'Övrigt',
content: quill ? quill.root.innerHTML : ''
};

const existingIdx = State.templates.findIndex(t => t.id === newTemplate.id);
if (existingIdx > -1) State.templates[existingIdx] = newTemplate;
else State.templates.push(newTemplate);

try {
if (isElectron) {
const result = await window.electronAPI.saveTemplates([newTemplate]);
if (result?.success === false) throw new Error(result.error || "Databasfel");
} else {
const res = await fetch(`${SERVER_URL}/api/templates/save`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify(newTemplate)
});
if (!res.ok) throw new Error("Serverfel");
}
await loadTemplates();
if (saveBtn) setTimeout(() => { saveBtn.disabled = false; }, 1500);
if (quill) quill.focus();
} catch (err) {
console.error("Fel vid sparning:", err);
alert("Kunde inte spara mallen: " + err.message);
if (saveBtn) saveBtn.disabled = false;
}
});
}


// 🗑️ RADERA MALL (SÄKRAD VERSION)
const delBtn = document.getElementById('delete-template-btn');
if (delBtn) {
delBtn.addEventListener('click', async () => {
const idInput = document.getElementById('template-id-input'); 
// Använd optional chaining för säkerhet
const id = idInput ? idInput.value : (DOM.inputs?.id ? DOM.inputs.id.value : null);

if (!id) return;

if (await atlasConfirm('Radera mall', 'Vill du ta bort denna mall permanent?')) {
try {
if (window.electronAPI) {
await window.electronAPI.deleteTemplate(id);
} else {
const res = await fetch(`${SERVER_URL}/api/templates/delete/${id}`, {
method: 'DELETE',
headers: fetchHeaders
});
if (!res.ok) throw new Error("Kunde inte radera mallen via webben");
}

// Kontrollera att elementen finns innan vi rör dem
const editorForm = document.getElementById('template-editor-form');
if (editorForm) {
editorForm.reset();
editorForm.style.display = 'none';
}

if (typeof quill !== 'undefined' && quill.setContents) quill.setContents([]); 
if (idInput) idInput.value = '';

const placeholder = document.getElementById('editor-placeholder');
if (placeholder) placeholder.style.display = 'flex';

if (typeof loadTemplates === 'function') {
await loadTemplates(); 
}
console.log("✅ Mall raderad och lista uppdaterad.");

} catch (err) {
console.error("Fel vid radering:", err);
alert("Tekniskt fel: " + err.message);
}
}
});
}

// =============================================================================
// 🎹 TANGENTBORDSGENVÄGAR (STEG 2)
// =============================================================================
document.addEventListener('keydown', (e) => {
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const cmdKey = isMac ? e.metaKey : e.ctrlKey;

// 1. NY CHATT: Ctrl + P (Använder det nya ikon-ID:t)
if (cmdKey && !e.altKey && e.key.toLowerCase() === 'p') {
e.preventDefault();
const newChatBtn = document.getElementById('new-chat-btn-header');
if (newChatBtn) newChatBtn.click();
}

// 2. FÖLJDFRÅGA: Ctrl + Alt + P
if (cmdKey && e.altKey && e.key.toLowerCase() === 'p') {
e.preventDefault();
const input = document.getElementById('my-chat-input');
if (input) input.focus();
}

// 3. BYT TEMA: Ctrl + Alt + T
// Använder lokal tema-lista istället för DOM-elementet (som bara finns efter Om-vyn renderats)
if (cmdKey && e.altKey && e.key.toLowerCase() === 't') {
e.preventDefault();
const THEME_CYCLE = [
'standard-theme',
'onyx-ultradark',
'carbon-theme',
'apple-dark',
'apple-road',
'atlas-nebula',
'sunset-horizon',
'atlas-navigator'
];

const currentTheme = localStorage.getItem('atlas-theme') || 'atlas-navigator';
const currentIdx   = THEME_CYCLE.indexOf(currentTheme);
const nextTheme    = THEME_CYCLE[(currentIdx + 1) % THEME_CYCLE.length];
changeTheme(nextTheme);
// Synkronisera dropdownen om Om-vyn råkar vara öppen
const select = document.getElementById('theme-select');
if (select) select.value = nextTheme;
showToast(`🎨 Tema: ${nextTheme.replace(/-/g, ' ')}`);
}

// 4. SPARA MALL: Ctrl + S (Använder det nya ikon-ID:t)
if (cmdKey && e.key.toLowerCase() === 's') {
const templateView = document.getElementById('view-templates');
if (templateView && templateView.style.display !== 'none') {
e.preventDefault();
const saveBtn = document.getElementById('save-template-btn');
if (saveBtn && !saveBtn.disabled) saveBtn.click();
}
}
});

// =============================================================================
// 📋 GLOBALA SYSTEM-GENVÄGAR (ELECTRON IPC)
// =============================================================================
if (window.electronAPI) {
window.electronAPI.onProcessClipboard((text, shouldClear) => {
console.log("📋 Klistrar in från globalt kommando...");
if (shouldClear && typeof initChat === 'function') initChat();
switchView('chat');
handleUserMessage(text);
});
}

// =============================================================================
// 🔐 AUTH INITIALIZATION & LOGIN (INUTI DOMContentLoaded)
// =============================================================================
const loginForm = document.getElementById('login-form');
if (loginForm) {
loginForm.addEventListener('submit', async (e) => {
e.preventDefault();
const user = document.getElementById('login-user').value;
const pass = document.getElementById('login-pass').value;
const errElem = document.getElementById('login-error');
const btn = loginForm.querySelector('button');

btn.disabled = true;
const originalText = btn.innerText;
btn.innerText = "Loggar in...";
errElem.textContent = "";

try {
const res = await fetch(`${SERVER_URL}/api/auth/login`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ username: user, password: pass })
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || 'Inloggning misslyckades');

// ✅ LAGRA GLOBALT FÖRE RELOAD
localStorage.setItem('atlas_token', data.token);
localStorage.setItem('atlas_user', JSON.stringify(data.user));

// 🔥 AGGRESSIV MODAL-STÄNGNING + INTERFACE RESET
const loginModal = document.getElementById('login-modal');
if (loginModal) {
loginModal.style.display = 'none !important';
loginModal.removeAttribute('style');
loginModal.setAttribute('style', 'display: none !important;');
}

// Göm formuläret för att försäkra visuell feedback
const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.style.opacity = '0.5';

// Visa loading state
const btn = document.getElementById('login-btn');
const originalText = btn?.innerText || 'Loggar in...';
if (btn) {
btn.disabled = true;
btn.innerText = '✅ Inloggad - Laddar...';
}

// Refresh efter kort fördröjning för att säkra DOM-uppdatering
setTimeout(() => {
console.log('🔐 Login framgångsrikt - Laddar om sidan...');
window.location.href = window.location.href;
}, 200);

} catch (err) {
errElem.textContent = err.message;
btn.disabled = false;
btn.innerText = originalText;
}
});
}

// =============================================================================
// 7. KOPPLA LOGOUT, LOGIN, AUTO-FILTER & LJUD (SIDOMENYN & GARAGET)
// =============================================================================
// 0. 🔥 KOPPLA LJUDREGLAGE (INSTÄLLNINGAR)
const soundToggle = document.getElementById('sound-toggle');
const savedSoundSetting = localStorage.getItem('atlas-sound-enabled');
State.soundEnabled = savedSoundSetting !== 'false'; 

if (soundToggle) {
soundToggle.checked = State.soundEnabled;
soundToggle.addEventListener('change', (e) => {
State.soundEnabled = e.target.checked;
localStorage.setItem('atlas-sound-enabled', e.target.checked);
if (State.soundEnabled) playNotificationSound();
});
}

// 1. Logga ut
const sidebarLogoutBtn = document.getElementById('logout-btn');
if (sidebarLogoutBtn) {
sidebarLogoutBtn.addEventListener('click', async (e) => {
e.preventDefault();
e.stopPropagation();

if (await atlasConfirm("Logga ut", "Vill du verkligen logga ut från Atlas?")) {
handleLogout();
}
});
}

// 2. Logga in
const sidebarLoginBtn = document.getElementById('login-btn-sidebar');
if (sidebarLoginBtn) {
sidebarLoginBtn.addEventListener('click', () => {
const modal = document.getElementById('login-modal');
if (modal) modal.style.display = 'flex';
});
}

// 3. ⚡ AUTOMATISK FILTRERING & SÖK (GARAGET)

// Lista på alla fält som ska trigga automatisk uppdatering vid ändring
const filterIds = [
'filter-type', 
'filter-agent', 
'filter-vehicle', 
'filter-city',
'filter-office', 
'filter-date-start', 
'filter-date-end'
];

filterIds.forEach(id => {
const el = document.getElementById(id);
if (el) {
el.addEventListener('change', () => {
console.log(`⚡ Filter auto-uppdatering: ${id}`);
renderArchive(true); // 'true' betyder filtrera lokalt för snabbhet
});
}
});

// Sökfältet (Uppdaterar medan du skriver)
const filterSearchInput = document.getElementById('filter-search');
if (filterSearchInput) {
filterSearchInput.addEventListener('input', () => {
renderArchive(true); 
});
}

// 4. RENSA-FUNKTION (Kopplad till den nya kryss-ikonen)
const resetFilterBtn = document.getElementById('reset-filters-btn');
if (resetFilterBtn) {
resetFilterBtn.addEventListener('click', () => {
console.log("🧹 Rensar alla filter...");

// Återställ dropdowns till "all"
['filter-type', 'filter-agent', 'filter-vehicle', 'filter-city'].forEach(id => {
const el = document.getElementById(id);
if (el) el.value = 'all';
});

// Töm datumfält
['filter-date-start', 'filter-date-end'].forEach(id => {
const el = document.getElementById(id);
if (el) el.value = '';
});

// Töm sökfältet
if (filterSearchInput) filterSearchInput.value = '';

// Uppdatera listan direkt
renderArchive(true);
});
}

// Lägg till toast-animationer om de inte finns
if (!document.getElementById('toast-styles')) {
const style = document.createElement('style');
style.id = 'toast-styles';
style.textContent = `
@keyframes slideIn {
from { transform: translateX(400px); opacity: 0; }
to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
from { transform: translateX(0); opacity: 1; }
to { transform: translateX(400px); opacity: 0; }
}
`;
document.head.appendChild(style);
}

// ==========================================================
// 📂 TOGGLE-LOGIK: ÖPPNA/STÄNG ALLA MALLGRUPPER (FIXAD)
// ==========================================================
document.addEventListener('click', (event) => {
const btn = event.target.closest('#collapse-all-btn');
if (!btn) return;

// Hitta alla grupper och pilar
const allContents = document.querySelectorAll('.template-group-content');
const allArrows = document.querySelectorAll('.group-arrow');
const iconSvg = btn.querySelector('svg');

// Kolla om vi ska öppna eller stänga (baserat på om någon är öppen)
// Logik: Om någon är öppen -> Stäng allt. Om alla är stängda -> Öppna allt.
const anyExpanded = Array.from(allContents).some(c => c.classList.contains('expanded'));

if (anyExpanded) {
// --- STÄNG ALLA ---
console.log("📂 Stänger alla grupper...");
allContents.forEach(c => {
c.classList.remove('expanded');
c.style.maxHeight = null;
});
allArrows.forEach(a => a.classList.remove('expanded'));

// Byt till PIL NER (Redo att öppna igen)
if(iconSvg) iconSvg.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';

} else {
// --- ÖPPNA ALLA ---
console.log("📂 Öppnar alla grupper...");
allContents.forEach(c => {
c.classList.add('expanded');
c.style.maxHeight = "2000px"; 
});
allArrows.forEach(a => a.classList.add('expanded'));

// Byt till PIL UPP (Redo att stänga)
if(iconSvg) iconSvg.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
}
});

// Stäng rutan automatiskt om man klickar utanför den
document.addEventListener('mousedown', (e) => {
const overlay = document.getElementById('atlas-help-overlay');
const trigger = document.querySelector('.info-icon-trigger');
if (overlay && overlay.style.display === 'block') {
if (!overlay.contains(e.target) && e.target !== trigger) {
overlay.style.display = 'none';
}
}
});

// Kör kollen 2 sekunder efter start
setTimeout(masterSystemAudit, 2000);
// Kör Audit 1 sekund efter start så att allt hunnit ritas ut
setTimeout(auditDOM, 1000);
// Försök köra synlighet direkt (ifall sessionen redan är laddad)
updateInboxVisibility();
console.log("🚀 ATLAS READY OCH SYSTEMET ÄR LIVE.");
}

document.addEventListener('DOMContentLoaded', initAtlasRenderer);

// ==================================================
// 🌐 GLOBAL MODAL-STÄNGNING (click outside + ESC)
// Stänger alla .custom-modal-overlay vid klick på bakgrund eller ESC
// ==================================================
document.addEventListener('click', (e) => {
if (e.target.classList.contains('custom-modal-overlay')) {
e.target.style.display = 'none';
}
});
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape') {
// Stäng inte modalen om fokus är inne i ett textfält
const active = document.activeElement;
if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
document.querySelectorAll('.custom-modal-overlay').forEach(m => m.style.display = 'none');
}
});

// ==================================================
// 🔍 INKORG-SÖKNING (Server-side, debounce 300ms)
// ==================================================
(function() {
let _searchTimer = null;
let _isSearchMode = false;

document.addEventListener('input', (e) => {
if (e.target.id !== 'inbox-search') return;
const term = e.target.value.trim();

clearTimeout(_searchTimer);

if (!term) {
if (_isSearchMode) {
_isSearchMode = false;
renderInbox();
}
return;
}

_searchTimer = setTimeout(async () => {
try {
const res = await fetch(`${SERVER_URL}/team/inbox/search?q=${encodeURIComponent(term)}`, {
headers: fetchHeaders
});
if (!res.ok) throw new Error('Sökfel');
const data = await res.json();
_isSearchMode = true;
renderInboxFromTickets(data.tickets || [], term);
} catch (err) {
console.error('❌ [Inbox Search]', err);
}
}, 300);
});
})();

// ==================================================
// ℹ️ ADMIN INFO MODAL
// ==================================================
window.showAdminInfoModal = function() {
const modal = document.createElement('div');
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '20000';
modal.innerHTML = `
<div class="glass-modal-box glass-effect" style="max-width:500px;">
<div class="glass-modal-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
<h3 style="margin:0;">Om Admin-panelen</h3>
<button onclick="this.closest('.custom-modal-overlay').remove()" style="background:none; border:none; color:var(--text-primary); opacity:0.6; cursor:pointer; padding:4px; font-size:18px; line-height:1; margin-top:-2px; flex-shrink:0;" title="Stäng">✕</button>
</div>
<div class="glass-modal-body" style="font-size:13px; line-height:1.7;">
<div style="padding:12px; border-radius:8px; background:rgba(255,69,58,0.1); border:1px solid rgba(255,69,58,0.3); margin-bottom:16px; color:#ff6b6b;">
⚠️ <strong>Varning:</strong> Ändringar här påverkar systemets prestanda och stabilitet.
Endast behörig personal bör ändra dessa värden.
</div>
<ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:8px;">
<li><strong>Agenter</strong> — Skapa, redigera och ta bort supportpersonal. Klicka på pennan för att redigera profiluppgifter, behörighet eller lösenord. Klicka på färgväljaren för att ändra agentens profilfärg direkt.</li>
<li><strong>Kontor &amp; Utbildningar</strong> — Hantera kontor, tjänster och priser. Klicka på de enskilda lås-knapparna på varje sektion för att låsa upp redigeringsläge.</li>
<li><strong>Systemkonfiguration</strong> — AI-trösklar, nätverksinställningar och säkerhet. Känsliga fält (lösenord, API-nycklar) visas maskerade.</li>
</ul>
<div style="margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); display:grid; gap:6px; font-size:12px;">
<div style="display:flex; justify-content:space-between;"><span style="opacity:0.5;">Version</span><span>Atlas ${ATLAS_VERSION}</span></div>
<div style="display:flex; justify-content:space-between;"><span style="opacity:0.5;">Plattform</span><span>Electron / Node.js / SQLite</span></div>
<div style="display:flex; justify-content:space-between;"><span style="opacity:0.5;">Skapad av</span><span>Patrik Åkerhage</span></div>
</div>
</div>
<div class="glass-modal-footer">
<button class="btn-modal-cancel" onclick="this.closest('.custom-modal-overlay').remove()">Stäng</button>
</div>
</div>`;
document.body.appendChild(modal);
modal.style.display = 'flex'; 
modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

// ==================================================
// 📧 NYTT MAIL – GLOBAL SCOPE (UTANFÖR ALLA FUNKTIONER)
// ==================================================
function showNewMailComposer() {
let modal = document.getElementById('atlas-mail-composer');

// Fält finns redan (andra anropet) — töm och visa utan att återskapa
if (modal && document.getElementById('composer-to')) {
document.getElementById('composer-to').value = '';
document.getElementById('composer-subject').value = '';
document.getElementById('composer-body').value = '';
modal.style.display = 'flex';
setTimeout(() => document.getElementById('composer-to').focus(), 50);
return;
}

// Statiskt skal från index.html finns men saknar formuläret — eller modal saknas helt
if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-mail-composer';
modal.className = 'custom-modal-overlay';
modal.style.display = 'none';
document.body.appendChild(modal);
}
// Injicera fullt formulär-HTML (ersätter det tomma statiska skalet)

const mailIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
const internalIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

modal.innerHTML = `
<div class="glass-modal-box glass-effect">
<div class="glass-modal-header" style="flex-direction: column; align-items: flex-start; gap: 10px;">
<h3 style="display:flex; align-items:center; gap:12px; margin:0; font-size:1.2rem;">Nytt meddelande</h3>
<div style="display:flex; background:rgba(255,255,255,0.1); border-radius:8px; padding:3px; width:100%;">
<button id="btn-mode-external" class="toggle-mode-btn active" style="flex:1; border:none; background:var(--accent-primary); color:white; padding:8px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
${mailIconSvg} Externt Mail
</button>
<button id="btn-mode-internal" class="toggle-mode-btn" style="flex:1; border:none; background:transparent; color:#aaa; padding:8px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
${internalIconSvg} Internt
</button>
</div>
</div>
<div class="glass-modal-body" style="padding-top:15px;">
<div style="margin-bottom:15px;">
<label id="label-recipient" style="display:block; color:#aaa; font-size:11px; text-transform:uppercase; margin-bottom:5px; font-weight:bold;">Mottagare:</label>
<input type="text" id="composer-to" placeholder="kund@exempel.se" style="width:100%; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white;">
<div id="composer-agent-grid" class="agent-grid" style="display:none; max-height: 220px; overflow-y: auto; grid-template-columns: 1fr 1fr; gap: 10px; padding: 5px;"></div>
<input type="hidden" id="selected-internal-agent">
</div>
<div style="margin-bottom:15px;">
<label style="display:block; color:#aaa; font-size:11px; text-transform:uppercase; margin-bottom:5px; font-weight:bold;">Ämne / Rubrik:</label>
<input type="text" id="composer-subject" placeholder="Vad gäller ärendet?" style="width:100%; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white;">
</div>
<div style="margin-bottom:0;">
<label style="display:block; color:#aaa; font-size:11px; text-transform:uppercase; margin-bottom:5px; font-weight:bold;">Meddelande:</label>
<textarea id="composer-body" placeholder="Skriv ditt meddelande här..." style="width:100%; height:180px; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; resize:none; font-family:inherit; font-size:14px; line-height:1.5;"></textarea>
</div>
</div>
<div class="glass-modal-footer">
<button id="composer-cancel" class="btn-modal-cancel">Avbryt</button>
<button id="composer-send" class="btn-modal-confirm">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>Skicka
</button>
</div>
</div>`;

let isInternalMode = false;
const btnExt = document.getElementById('btn-mode-external');
const btnInt = document.getElementById('btn-mode-internal');
const toInp = document.getElementById('composer-to');
const subInp = document.getElementById('composer-subject');
const bodyInp = document.getElementById('composer-body');
const labelRec = document.getElementById('label-recipient');
const agentGrid = document.getElementById('composer-agent-grid');

btnExt.onclick = () => setMode(false);
btnInt.onclick = () => setMode(true);

setMode(false);

modal.style.display = 'flex';
toInp.value = ''; subInp.value = ''; bodyInp.value = '';
setTimeout(() => { if(!isInternalMode) toInp.focus(); }, 50);

document.getElementById('composer-cancel').onclick = () => modal.style.display = 'none';

document.getElementById('composer-send').onclick = async () => {
const subject = subInp.value.trim();
const body = bodyInp.value.trim();
const recipient = isInternalMode ? document.getElementById('selected-internal-agent').value : toInp.value.trim();

if (isInternalMode) {
if (!recipient) { showToast("⚠️ Välj en kollega att skicka till!"); return; }
} else {
if (!recipient || !recipient.includes('@')) { showToast("⚠️ Ange giltig e-postadress!"); return; }
}
if (!subject) { showToast("⚠️ Ange ett ämne!"); return; }
if (!body) { showToast("⚠️ Skriv ett meddelande!"); return; }

const btn = document.getElementById('composer-send');
btn.innerText = "Skickar...";
btn.disabled = true;

try {
let newConversationId = null;
if (isInternalMode) {
const res = await fetch(`${SERVER_URL}/api/team/create-internal`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ recipient, subject, message: body })
});
const data = await res.json();
if (!data.success) throw new Error(data.error);
newConversationId = data.conversationId;
} else {
const tempId = `session_mail_${Date.now()}`;
if (!window.socketAPI) throw new Error("Ingen socket-anslutning");
window.socketAPI.emit('team:send_email_reply', {
conversationId: tempId,
message: body,
customerEmail: recipient,
subject: subject
});
newConversationId = tempId;
}

modal.style.display = 'none';
if (typeof playNotificationSound === 'function') playNotificationSound();

setTimeout(async () => {
if (typeof renderMyTickets === 'function') await renderMyTickets();
if (typeof switchView === 'function') switchView('my-tickets');
const fakeTicket = {
conversation_id: newConversationId,
session_type: isInternalMode ? 'internal' : 'message',
subject: subject,
owner: currentUser.username,
sender: currentUser.username,
contact_email: isInternalMode ? '' : recipient,
messages: [{ sender: currentUser.username, text: body, timestamp: Date.now(), role: 'agent' }]
};
if (typeof openMyTicketDetail === 'function') openMyTicketDetail(fakeTicket);
}, 600);
} catch (err) {
showToast("❌ Fel: " + err.message);
btn.innerText = "Skicka";
btn.disabled = false;
}
};

function setMode(internal) {
const btnExt = document.getElementById('btn-mode-external');
const btnInt = document.getElementById('btn-mode-internal');
const toInp = document.getElementById('composer-to');
const agentGrid = document.getElementById('composer-agent-grid');
const labelRec = document.getElementById('label-recipient');
isInternalMode = internal;
if (internal) {
btnInt.style.background = 'var(--accent-primary)';
btnInt.style.color = 'white';
btnExt.style.background = 'transparent';
btnExt.style.color = '#aaa';
toInp.style.display = 'none';
agentGrid.style.display = 'grid';
labelRec.innerText = "MOTTAGARE (INTERN):";
loadAgents();
} else {
btnExt.style.background = 'var(--accent-primary)';
btnExt.style.color = 'white';
btnInt.style.background = 'transparent';
btnInt.style.color = '#aaa';
agentGrid.style.display = 'none';
toInp.style.display = 'block';
labelRec.innerText = "MOTTAGARE (E-POST):";
}
}
}

// Koppla knapp och Ctrl+M – globalt
const btnNewMailMyTickets = document.getElementById('new-mail-btn-my-tickets');
if (btnNewMailMyTickets) {
btnNewMailMyTickets.onclick = () => showNewMailComposer();
}

document.addEventListener('keydown', (event) => {
if (event.ctrlKey && event.key === 'm') {
event.preventDefault();
showNewMailComposer();
}
});

// Hjälpfunktioner – globala
async function loadAgents() {
const agentGrid = document.getElementById('composer-agent-grid');
if (!agentGrid) return;
try {
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
const users = await res.json();
const agents = users.filter(u => u.username.toLowerCase() !== 'admin')
.sort((a, b) => {
const nameA = a.display_name || formatName(a.username);
const nameB = b.display_name || formatName(b.username);
return nameA.localeCompare(nameB, 'sv');
});
agentGrid.innerHTML = agents.map(u => {
const displayName = u.display_name || formatName(u.username);
const avatarHtml = getAvatarBubbleHTML(u, "30px");
return `
<div class="agent-card internal-select" onclick="window.selectInternalAgent(this, '${u.username}')"
style="border-left: 4px solid ${u.agent_color || '#0071e3'}; box-shadow: inset 0 0 0 9999px ${(u.agent_color || '#0071e3')}08; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; display: flex; align-items: center; gap: 10px; transition: background 0.2s;">
${avatarHtml}
<div style="overflow: hidden;">
<div style="font-size: 11px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</div>
${u.status_text ? `<div style="font-size: 10px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${u.status_text}">💬 ${u.status_text.substring(0, 40)}</div>` : ''}
</div>
</div>`;
}).join('');
} catch(e) {
console.error("LoadAgents Error:", e);
agentGrid.innerHTML = '<div style="color: #ff6b6b; padding: 10px;">Kunde inte ladda agenter</div>';
}
}

window.selectInternalAgent = (el, username) => {
document.querySelectorAll('.internal-select').forEach(card => card.style.background = 'rgba(255,255,255,0.03)');
el.style.background = 'rgba(255,255,255,0.15)';
document.getElementById('selected-internal-agent').value = username;
};