// ============================================
// modules/bulk-ops.js
// VAD DEN GÖR: Bulk-operationer på ärenden
//              (markera flera, claim, arkivera)
// ANVÄNDS AV: renderer.js
// ============================================

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
