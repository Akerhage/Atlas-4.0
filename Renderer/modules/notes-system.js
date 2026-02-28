// ============================================
// modules/notes-system.js
// VAD DEN GÖR: Anteckningar kopplade till ärenden
// ANVÄNDS AV: renderer.js
// ============================================

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
<div class="glass-modal-box" style="width: 480px; max-height: 75vh; display: flex; flex-direction: column;">
<div class="glass-modal-header" style="display:flex; align-items:center; justify-content:space-between;">
<h3 style="margin:0;">Interna kommentarer</h3>
<button id="close-notes-btn" class="btn-glass-icon" style="width:28px; height:28px;" title="Stäng">✕</button>
</div>
<div class="glass-modal-body" style="flex: 1; overflow-y: auto; padding: 12px 15px;">
<div id="notes-list-container" style="margin-bottom: 12px;">Laddar...</div>

<div class="note-input-area" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
<label style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; display: block;">Ny anteckning</label>
<div style="position:relative;">
<textarea id="note-textarea" placeholder="Vad behöver kollegorna veta?"
style="width:100%; height:70px; padding-right:44px; box-sizing:border-box; resize:none;"></textarea>
<div style="position:absolute; top:6px; right:6px;">
<button id="add-note-btn" class="btn-glass-icon" style="width:32px; height:32px; color:#4cd964; border-color:rgba(76,217,100,0.4);" title="Spara anteckning">
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
</button>
</div>
</div>
</div>
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
saveBtn.style.opacity = '0.5';

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
saveBtn.style.opacity = '';
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
<div class="note-item" id="note-card-${n.id}" style="margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
<div class="note-header" style="margin-bottom: 4px;">
<span style="color: var(--accent-primary); font-weight: bold; font-size: 12px;">${n.agent_name} · <span style="opacity:0.5; font-weight:400;">${dateStr} ${timeStr}</span></span>
</div>
<div class="note-body" id="note-body-${n.id}" data-content="${escapedAttr}" style="font-size: 13px; line-height: 1.4; color: #eee;">${escapedHtml}</div>
<div style="display:flex; justify-content:flex-end; gap:4px; margin-top:5px;">
<button class="btn-glass-icon" style="width:26px; height:26px; padding:0;" onclick="window.editNote(${n.id}, '${conversationId}')" title="Redigera">${ADMIN_UI_ICONS.EDIT}</button>
<button class="btn-glass-icon" style="width:26px; height:26px; padding:0; color:#ff453a; border-color:rgba(255,69,58,0.3);" onclick="window.deleteNote(${n.id}, '${conversationId}')" title="Radera">${ADMIN_UI_ICONS.DELETE}</button>
</div>
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
