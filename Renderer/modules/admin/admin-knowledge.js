// ============================================
// modules/admin/admin-knowledge.js
// VAD DEN GÖR: Admin — Kunskapsbank (Basfakta)
//              CRUD för JSON-kunskapsfiler
// ANVÄNDS AV: renderer.js, admin-config.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders              — renderer.js globals
//   adminEscapeHtml                       — admin-core.js
//   showToast                             — styling-utils.js
//   deleteBasfaktaSection                 — admin-tools.js
// ============================================

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

// deleteBasfaktaSection → flyttade till modules/admin/admin-tools.js

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
