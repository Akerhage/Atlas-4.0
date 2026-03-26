// ============================================
// modules/ipc-bridges.js
// VAD DEN GÖR: Kopplar UI-knappar till Electron
//              main-process via IPC
// ANVÄNDS AV: renderer.js, alla vyer
// ============================================

// --- IPC BRYGGOR (Kopplar knappar i UI till main.js/db.js) ---

window.claimTicket = async (conversationId) => {
  if (window.atlasTeam && window.atlasTeam.claimTicket) {
    // Electron IPC-path
    try {
      const result = await window.atlasTeam.claimTicket(conversationId, currentUser.username);
      if (typeof renderInbox === 'function') renderInbox();
      if (typeof renderMyTickets === 'function') renderMyTickets();
      return result;
    } catch (err) { console.error("\u274c IPC Claim Error:", err); throw err; }
  } else {
    // Webb/VPS-path: Direkt HTTP-anrop mot servern
    const res = await fetch(`${SERVER_URL}/team/claim`, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify({ conversationId })
    });
    if (!res.ok) throw new Error(`Claim misslyckades: ${res.status}`);
    const result = await res.json();
    if (typeof renderInbox === 'function') renderInbox();
    if (typeof renderMyTickets === 'function') renderMyTickets();
    return result;
  }
};

window.claimTicketFromReader = async (conversationId) => {
  const result = await window.claimTicket(conversationId);
  const modal = document.getElementById('atlas-reader-modal');
  if (modal) modal.style.display = 'none';
  // Takeover: socket team:ticket_claimed_self visar toast — ingen dubbel toast
  if (!result?.previousOwner) {
    showToast('✅ Ärendet är nu ditt!');
  }
};

window.assignTicketFromReader = async (conversationId) => {
// Öppnar tilldelnings-modal (Verifierad mot showAssignModal på rad 3592)
if (typeof showAssignModal === 'function') {
showAssignModal({ conversation_id: conversationId });
}
};

// --- MALL & URKLIPP BRYGGOR ---

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
