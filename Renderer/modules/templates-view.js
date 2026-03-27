// ============================================
// modules/templates-view.js
// VAD DEN GÖR: Mailmallar — lista, editor,
//              spara och radera
// ANVÄNDS AV: renderer.js
// ============================================

// Fasta grupper för teammallar (samma ordning som flikarna)
const TEMPLATE_FIXED_GROUPS = ['AM', 'BIL', 'MC', 'SLÄP', 'LASTBIL/BUSS', 'ENGELSKA', 'ÖVRIGA'];

// Aktiv flik — 'mine' för privata, annars ett gruppnamn
let currentTemplateTab = 'mine';

// Byt aktiv flik och re-rendera
function switchTemplateTab(group) {
currentTemplateTab = group;

// Uppdatera knapp-stilar
document.querySelectorAll('#template-tabs .header-tab').forEach(btn => {
btn.classList.toggle('active', btn.dataset.group === group);
});

// Visa/dölj GRUPP-väljaren (dold vid "Mina Mallar")
const groupWrapper = document.getElementById('template-group-wrapper');
if (groupWrapper) groupWrapper.style.display = (group === 'mine') ? 'none' : 'flex';

// Stäng redigeraren och visa placeholder vid fliktbyte
if (DOM.editorForm) DOM.editorForm.style.display = 'none';
if (DOM.editorPlaceholder) DOM.editorPlaceholder.style.removeProperty('display');

renderTemplates(State.templates);
}

// ==========================================================
// MALL-HANTERARE — LADDA
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
// MALL-HANTERARE — RENDERA
// ==========================================================
function renderTemplates(list = State.templates) {
// Säkra att både användare och list-elementet existerar
if (!currentUser || !DOM.templateList) {
if (!DOM.templateList) console.warn("⚠️ DOM.templateList saknas - kan inte rendera mallar.");
return;
}

// Uppdatera badge på "Mina Mallar"-fliken
const myCount = (list || []).filter(t => t.owner && t.owner === currentUser.username).length;
const mineBadge = document.getElementById('badge-tmpl-mine');
if (mineBadge) {
mineBadge.textContent = myCount;
mineBadge.style.display = myCount > 0 ? 'inline-flex' : 'none';
}

// Filtrera baserat på aktiv flik
let filtered;
if (currentTemplateTab === 'mine') {
filtered = (list || []).filter(t => t.owner && t.owner === currentUser.username);
} else {
// Teammallar: visa mallar som matchar gruppen (eller ÖVRIGA för okända grupper)
if (currentTemplateTab === 'ÖVRIGA') {
filtered = (list || []).filter(t => !t.owner && (!t.group_name || !TEMPLATE_FIXED_GROUPS.includes(t.group_name)));
} else {
filtered = (list || []).filter(t => !t.owner && t.group_name === currentTemplateTab);
}
}

// Agentens profilfärg styr mallarnas färgtema
const styles = getAgentStyles(currentUser.username);
DOM.templateList.innerHTML = '';

if (filtered.length === 0) {
DOM.templateList.innerHTML = '<div style="padding:16px 12px; color:var(--text-secondary); font-size:13px; opacity:0.6;">Inga mallar här ännu.</div>';
return;
}

// Flat lista — sorterad alfabetiskt, inga grupp-headers (tabs i header visar kontexten)
filtered.sort((a, b) => a.title.localeCompare(b.title, 'sv'));

filtered.forEach(t => {
const item = document.createElement('div');
item.className = 'template-item';
item.style.setProperty('border-left', `2px solid ${styles.border}`, 'important');

const _previewHtml = (t.content || '').replace(/<\/?(p|div|br)[^>]*>/gi, ' ');
const tempDiv = document.createElement('div');
tempDiv.innerHTML = _previewHtml;
const plainText = (tempDiv.textContent || tempDiv.innerText || '').replace(/\s+/g, ' ').trim();
const preview = plainText.substring(0, 60) + (plainText.length > 60 ? '...' : '');

item.innerHTML = `
<div class="template-item-content">
<span class="template-title">${t.title}</span>
<span class="template-preview">${preview}</span>
</div>
`;

item.onclick = () => openTemplateEditor(t);
DOM.templateList.appendChild(item);
});
}

// ==========================================================
// MALL-HANTERARE — ÖPPNA
// ==========================================================
function openTemplateEditor(t) {
isLoadingTemplate = true;

const editorContainer = document.querySelector('#view-templates .template-editor-container');

if (editorContainer) {
editorContainer.querySelectorAll('#template-editor-form label').forEach(label => {
label.style.setProperty('margin-bottom', '4px', 'important');
label.style.setProperty('display', 'block', 'important');
label.style.setProperty('padding-left', '2px', 'important');
label.style.setProperty('font-size', '11px', 'important');
});
}

// Döljer placeholdern och visar formuläret
if (DOM.editorPlaceholder) DOM.editorPlaceholder.style.setProperty('display', 'none', 'important');
if (DOM.editorForm) DOM.editorForm.style.setProperty('display', 'flex', 'important');

// Fyller i fälten
if (DOM.inputs.id) DOM.inputs.id.value = t.id;
if (DOM.inputs.title) DOM.inputs.title.value = t.title;

// Sätt grupp: välj matchande option eller ÖVRIGA som fallback
const groupInput = DOM.inputs.group;
if (groupInput) {
const groupVal = TEMPLATE_FIXED_GROUPS.includes(t.group_name) ? t.group_name : 'ÖVRIGA';
groupInput.value = groupVal;
}

// Sätt owner
const ownerInput = document.getElementById('template-owner-input');
if (ownerInput) ownerInput.value = t.owner || '';

// Visa/dölj grupp-väljaren
const groupWrapper = document.getElementById('template-group-wrapper');
if (groupWrapper) groupWrapper.style.display = t.owner ? 'none' : 'flex';

if (quill) {
quill.root.innerHTML = t.content;
}

const deleteBtn = document.getElementById('delete-template-btn');
if(deleteBtn) deleteBtn.style.display = 'block';

const saveBtn = DOM.editorForm?.querySelector('button[type="submit"]');
if (saveBtn) {
saveBtn.disabled = true;
}

setTimeout(() => {
isLoadingTemplate = false;
}, 50);
}
