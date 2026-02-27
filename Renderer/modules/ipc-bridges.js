// ============================================
// modules/ipc-bridges.js
// VAD DEN GÖR: Kopplar UI-knappar till Electron
//              main-process via IPC
// ANVÄNDS AV: renderer.js, alla vyer
// ============================================

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
