// ============================================
// modules/templates-view.js
// VAD DEN GÖR: Mailmallar — lista, editor,
//              spara och radera
// ANVÄNDS AV: renderer.js
// ============================================

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
