// ============================================
// modules/admin/admin-tools.js
// VAD DEN GÖR: Admin — verktyg för att radera
//              användare, kontor och återställa lösenord
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders                       — renderer.js globals
//   ADMIN_UI_ICONS                                 — ui-constants.js
//   showToast                                      — styling-utils.js
//   atlasConfirm                                   — renderer.js
//   renderAdminUserList                            — admin-users.js
//   renderAdminOfficeList                          — admin-offices.js
//   saveBasfaktaFile                               — renderer.js
// ============================================

// =============================================================================
// deleteBasfaktaSection — tar bort en sektion från DOM och sparar
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

window.resetUserPassword = (id, name) => {
// Tvåfälts-modal för lösenordsåterställning
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
<div class="glass-modal-footer" style="justify-content:flex-end;">
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

// Stäng via ESC eller klick utanför (global handler i renderer.js)
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
