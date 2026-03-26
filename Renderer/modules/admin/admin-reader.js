// ============================================
// modules/admin/admin-reader.js
// VAD DEN GÖR: Admin — ärendereader (modal),
//              meddelandehistorik och navigering
// ANVÄNDS AV: renderer.js, admin-users.js,
//             admin-offices.js
// ============================================
// Beroenden (löses vid anropstid):
//   currentTicketList, currentTicketIdx    — renderer.js globals (let)
//   getAgentStyles                         — styling-utils.js
//   resolveTicketTitle                     — chat-engine.js
//   resolveLabel                           — styling-utils.js
//   UI_ICONS, ADMIN_UI_ICONS               — ui-constants.js
//   openNotesModal                         — notes-system.js
//   claimTicketFromReader, assignTicketFromReader — ipc-bridges.js
// ============================================

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
modal.setAttribute('data-current-id', currentTicketList[currentTicketIdx]?.conversation_id || '');
modal.style.display = 'flex';
modal.style.pointerEvents = 'all';
modal.onclick = (e) => {
if (e.target === modal) _closeReader();
};

// Lysa upp notes-ikonen om det finns anteckningar
const _t = (typeof currentTicketList !== 'undefined' ? currentTicketList : [])[currentTicketIdx];
if (_t?.conversation_id && typeof refreshNotesGlow === 'function') {
refreshNotesGlow(_t.conversation_id);
}
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

// 2. BRANDING: Ärendets kontorsfärg via routing_tag/owner — aldrig agentens hex-färg
const brandingTag = window._currentAdminOverrideTag || t.routing_tag || t.owner;
const rStyles = getAgentStyles(brandingTag);

const readerTitle = resolveTicketTitle(t);
const readerSubtitle = resolveLabel(t.routing_tag || t.owner);
const readerDate = t.updated_at ? new Date(t.updated_at * 1000).toLocaleDateString('sv-SE') : (t.timestamp ? new Date(t.timestamp).toLocaleDateString('sv-SE') : '—');
const readerExtra = (t.vehicle || t.vehicle_type) ? ' • ' + (t.vehicle || t.vehicle_type) : (t.contact_phone || t.phone ? ' • ' + (t.contact_phone || t.phone) : '');

// 3. Förbered ägardisplaytext för placeholder
const ownerDisplayName = t.owner && t.owner !== currentUser.username
? (typeof formatName === 'function' ? formatName(t.owner) : t.owner)
: null;

// 4. Förbered meddelandehistoriken
let messageHistoryHtml = '';
const messages = t.messages || [];
const readerInitial = (readerTitle || 'K').charAt(0).toUpperCase();

if (messages.length === 0) {
const raw = t.last_message || t.content || "Ingen historik ännu.";
const clean = raw.replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
const rendered = (typeof formatAtlasMessage === 'function') ? formatAtlasMessage(clean) : clean;
messageHistoryHtml = `
<div style="display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;">
<div style="background:${rStyles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${readerInitial}</div>
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:78%;">
<div style="font-size:9px; font-weight:700; opacity:0.4; margin-bottom:3px; padding-left:2px;">${readerTitle || 'Kund'}</div>
<div style="padding:9px 13px; border-radius:3px 12px 12px 12px; background:${rStyles.bubbleBg}; border:1px solid ${rStyles.border}; font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">${rendered}</div>
</div>
</div>`;
} else {
messageHistoryHtml = messages.map(m => {
const isUser = m.role === 'user';
const cleanText = (m.content || m.text || '').replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');const renderedText = (typeof formatAtlasMessage === 'function') ? formatAtlasMessage(cleanText) : cleanText;const smartTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const sameDay = d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  const t = d.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  return sameDay ? t : d.toLocaleDateString('sv-SE') + ' ' + t;
};
const timeStr = smartTime(m.timestamp);
if (isUser) {
return `
<div style="display:flex; width:100%; margin-bottom:12px; justify-content:flex-start;">
<div style="background:${rStyles.main}; color:white; margin-right:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; flex-shrink:0;">${readerInitial}</div>
<div style="display:flex; flex-direction:column; align-items:flex-start; max-width:78%;">
<div style="font-size:9px; font-weight:700; opacity:0.4; margin-bottom:3px; padding-left:2px;">${readerTitle || 'Kund'}${timeStr ? ' • ' + timeStr : ''}</div>
<div style="padding:9px 13px; border-radius:3px 12px 12px 12px; background:${rStyles.bubbleBg}; border:1px solid ${rStyles.border}; font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">${renderedText}</div>
</div>
</div>`;
} else {
return `
<div style="display:flex; width:100%; margin-bottom:12px; justify-content:flex-end;">
<div style="display:flex; flex-direction:column; align-items:flex-end; max-width:78%;">
<div style="font-size:9px; font-weight:700; opacity:0.4; margin-bottom:3px; padding-right:2px; color:rgba(255,255,255,0.7);">AGENT${timeStr ? ' • ' + timeStr : ''}</div>
<div style="padding:9px 13px; border-radius:12px 3px 12px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.07); font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">${renderedText}</div>
</div>
<div style="background:#3a3a3c; margin-left:10px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0; font-size:18px;">🤖</div>
</div>`;
}
}).join('');
}

// 4. BYGG MODALENS HTML
modal.innerHTML = `
<div class="glass-modal-box glass-effect" style="width:860px; max-width:95vw; border-top:3px solid ${rStyles.main}; position:relative; display:flex; flex-direction:column; max-height:88vh; overflow:hidden;">

<div style="padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; justify-content:space-between; align-items:center; flex-shrink:0; background:linear-gradient(90deg, ${rStyles.main}14, transparent);">
<div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
<div style="width:40px; height:40px; border-radius:10px; background:${rStyles.main}; color:black; font-weight:800; font-size:17px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 12px ${rStyles.main}55;">
${(readerTitle || 'U').substring(0,1).toUpperCase()}
</div>
<div style="min-width:0;">
<div style="font-size:15px; font-weight:700; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px;">${readerTitle || 'Okänd'}</div>
<div style="font-size:10px; opacity:0.4; color:white; letter-spacing:0.3px;">${readerSubtitle || ''} • ${readerDate}${readerExtra}</div>
</div>
</div>

<div style="display:flex; align-items:center; gap:5px; flex-shrink:0; margin-left:10px;">
<button class="btn-glass-icon notes-trigger-btn"
data-id="${t.conversation_id}"
onclick="openNotesModal('${t.conversation_id}')"
title="Interna anteckningar – visas aldrig för kunden"style="color:${rStyles.main}; border-color:${rStyles.border};">
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

<div id="reader-chat-scroll" style="flex:1; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:10px; min-height:0;">
${messageHistoryHtml}
<div id="reader-typing-indicator-${t.conversation_id}" style="display:none; font-size:12px; font-style:italic; color:${rStyles.main}; opacity:0.75; padding:4px 2px;">✍️ Kunden skriver...</div>
</div>

<div style="padding:10px 14px; border-top:1px solid rgba(255,255,255,0.07); background:rgba(0,0,0,0.18); flex-shrink:0;">
<div style="display:flex; gap:8px; align-items:flex-end;">
<textarea id="reader-quick-reply"
placeholder="${ownerDisplayName ? `Svar tar över från ${ownerDisplayName} (Ctrl+Enter)` : 'Snabbsvar till kunden... (Ctrl+Enter för att skicka)'}"
style="flex:1; min-height:58px; max-height:280px; overflow-y:auto; padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:var(--text-primary); resize:vertical; font-family:inherit; font-size:13px; line-height:1.5; outline:none; transition:border-color 0.2s, height 0.15s ease;"
onfocus="this.style.borderColor='${rStyles.main}66'"
onblur="this.style.borderColor='rgba(255,255,255,0.12)'"></textarea>
<label for="reader-file-input"
id="reader-upload-label"
title="Bifoga fil eller bild"
style="cursor:pointer; padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); font-size:16px; display:inline-flex; align-items:center; flex-shrink:0;">
📎
</label>
<input type="file" id="reader-file-input"
accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
style="display:none;">
<button id="reader-send-btn" class="btn-glass-icon"
style="width:38px; height:38px; flex-shrink:0; color:${rStyles.main}; border-color:${rStyles.border}; background:${rStyles.main}1a;"
title="Skicka svar och ta ärendet (Ctrl+Enter)">
${UI_ICONS.SEND}
</button>
</div>
</div>

<div style="padding:9px 14px; border-top:1px solid rgba(255,255,255,0.07); background:rgba(0,0,0,0.3); display:flex; justify-content:space-between; align-items:center; flex-shrink:0; gap:8px;">
<div style="display:flex; gap:6px; flex-shrink:0;">
<button class="btn-glass-icon" id="reader-archive-btn"
title="Arkivera ärende"
style="color:var(--text-secondary);">
${UI_ICONS.ARCHIVE}
</button>
<button class="btn-glass-icon" id="reader-delete-btn"
title="Ta bort permanent"
style="color:#ff453a;">
${UI_ICONS.TRASH}
</button>
</div>
${State.templates?.length ? `<div style="flex:1; min-width:0;"><select id="reader-template-select" class="filter-select" style="width:100%; max-width:240px; font-size:11px;"><option value="">📋 Välj mall...</option>${(State.templates || []).map(tmpl => `<option value="${tmpl.id}">${tmpl.title}</option>`).join('')}</select></div>` : '<div style="flex:1;"></div>'}
<div style="display:flex; gap:6px; flex-shrink:0;">
<button id="reader-ai-btn" class="btn-glass-icon"
style="color:${rStyles.main}; border-color:${rStyles.border}; background:rgba(255,255,255,0.07);"
title="AI-svar – fungerar endast på företagsspecifika frågor eller körkortsfrågor">
${UI_ICONS.AI}
</button>
<button class="btn-glass-icon" onclick="assignTicketFromReader('${t.conversation_id}')"
title="Vidarebefordra ärendet till en kollega"
style="color:var(--text-secondary);">
${UI_ICONS.ASSIGN}
</button>
<button class="btn-glass-icon" onclick="claimTicketFromReader('${t.conversation_id}')"
title="Ta ärendet – du blir ansvarig agent"
style="color:${rStyles.main}; border-color:${rStyles.border}; background:${rStyles.main}1a;">
${UI_ICONS.CLAIM}
</button>
</div>
</div>

</div>`; // Slut på modal.innerHTML

// --- 5. LOGIK FÖR KNAPPAR (Kopplas efter att HTML injicerats) ---
modal.style.pointerEvents = 'all';

let readerAdminActiveTemplateHtml = null;

// Stäng via ESC/klick-utanför (global handler i renderer.js)

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

// --- Snabbsvar-logik ---
const sendBtn = modal.querySelector('#reader-send-btn');
const replyTA = modal.querySelector('#reader-quick-reply');
const convId = t.conversation_id;

const readerFileInput = modal.querySelector('#reader-file-input');
const readerUploadLabel = modal.querySelector('#reader-upload-label');

if (readerFileInput) {
readerFileInput.addEventListener('change', async (e) => {
const file = e.target.files?.[0];
if (!file) return;
if (readerUploadLabel) readerUploadLabel.textContent = '⏳';
try {
const formData = new FormData();
formData.append('file', file);
formData.append('session_id', convId);
const res = await fetch(`${SERVER_URL}/api/upload`, {
method: 'POST',
headers: { 'Authorization': fetchHeaders['Authorization'] },
body: formData
});
if (!res.ok) throw new Error('Uppladdning misslyckades');
const data = await res.json();
const textarea = modal.querySelector('#reader-quick-reply');
if (textarea) {
const isImage = file.type.startsWith('image/');
const markdown = isImage
? `\n![Bild](${data.url})\n`
: `\n📎 [Fil: ${data.originalName || file.name}](${data.url})\n`;
if (!window._pendingAttachments) window._pendingAttachments = new Map();
const existingMarkdown = window._pendingAttachments.get(textarea.id) || '';
window._pendingAttachments.set(textarea.id, existingMarkdown + '\n' + markdown);
const statusText = isImage ? '📷 Bild inklistrad — skickas med meddelandet' : `📎 Fil bifogad: ${file.name} — skickas med meddelandet`;
textarea.placeholder = statusText;
if (!textarea.value.trim()) textarea.value = '';
textarea.focus();
}
} catch (err) {
showToast('❌ Uppladdning misslyckades: ' + err.message);
} finally {
if (readerUploadLabel) readerUploadLabel.textContent = '📎';
readerFileInput.value = '';
}
});

const readerTA = modal.querySelector('#reader-quick-reply');
if (readerTA) {
readerTA.addEventListener('paste', async (e) => {
const items = e.clipboardData?.items;
if (!items) return;
for (const item of Array.from(items)) {
if (item.type.startsWith('image/')) {
e.preventDefault();
const file = item.getAsFile();
if (!file) break;
if (readerUploadLabel) readerUploadLabel.textContent = '⏳';
try {
const formData = new FormData();
formData.append('file', file);
formData.append('session_id', convId);
const res = await fetch(`${SERVER_URL}/api/upload`, {
method: 'POST',
headers: { 'Authorization': fetchHeaders['Authorization'] },
body: formData
});
if (!res.ok) throw new Error('Fel');
const data = await res.json();
const markdown = `\n![Bild](${data.url})\n`;
if (!window._pendingAttachments) window._pendingAttachments = new Map();
const existingMarkdown = window._pendingAttachments.get(readerTA.id) || '';
window._pendingAttachments.set(readerTA.id, existingMarkdown + '\n' + markdown);
readerTA.placeholder = '📷 Bild inklistrad — skickas med meddelandet';
if (!readerTA.value.trim()) readerTA.value = '';
readerTA.focus();
} catch (err) {
showToast('❌ ' + err.message);
} finally {
if (readerUploadLabel) readerUploadLabel.textContent = '📎';
}
break;
}
}
});
}
}

if (sendBtn && replyTA) {
// Meddela kunden att agenten skriver
replyTA.addEventListener('input', () => {
if (window.socketAPI) {
window.socketAPI.emit('team:agent_typing', { sessionId: convId });
}
});

// Uppdatera typing-indikatorn för kunden i reader-vyn om den är öppen
window.socketAPI?.on && window.socketAPI.on('team:client_typing', (data) => {
if (data.sessionId === convId) {
const indicator = document.getElementById('reader-typing-indicator-' + convId);
if (indicator) {
indicator.style.display = 'block';
clearTimeout(indicator._hideTimer);
indicator._hideTimer = setTimeout(() => { indicator.style.display = 'none'; }, 3000);
}
}
});

const doSend = async () => {
const pendingMarkdown = window._pendingAttachments?.get(replyTA.id) || '';
if (pendingMarkdown) {
  replyTA.value = (replyTA.value.trim() + '\n\n' + pendingMarkdown.trim()).trim();
  window._pendingAttachments.delete(replyTA.id);
}
const msg = replyTA.value.trim();
if (!msg) return;
sendBtn.disabled = true;
sendBtn.style.opacity = '0.45';
try {
if (window.socketAPI) {
const isMail = t.session_type === 'message';
if (isMail) {
window.socketAPI.emit('team:send_email_reply', {
conversationId: convId,
message: msg,
html: readerAdminActiveTemplateHtml || msg.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'),
customerEmail: t.contact_email || '',
subject: 'Re: ' + (t.subject || t.question || 'Ditt ärende')
});
} else {
// AUTO-CLAIM sker i server.js vid team:agent_reply
window.socketAPI.emit('team:agent_reply', { conversationId: convId, message: msg });
}
}
// Behåll modalen öppen — agenten stänger den manuellt
replyTA.value = '';
replyTA.style.height = 'auto'; replyTA.style.height = Math.min(replyTA.scrollHeight, 280) + 'px'; // Återställ till standardhöjd
readerAdminActiveTemplateHtml = null;
window._pendingAttachments?.delete(replyTA.id);
replyTA.placeholder = 'Snabbsvar... (Ctrl+Enter för att skicka)';
sendBtn.disabled = false;
sendBtn.style.opacity = '';
showToast('✅ Meddelande skickat!');
} catch (err) {
console.error('Snabbsvar-fel:', err);
sendBtn.disabled = false;
sendBtn.style.opacity = '';
}
};
sendBtn.onclick = doSend;
replyTA.onkeydown = (e) => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); doSend(); } };

// Auto-grow/shrink — körs alltid; tom ruta: scrollHeight < min-height → CSS min-height tar över
replyTA.addEventListener('input', () => {
replyTA.style.height = 'auto';
replyTA.style.height = Math.min(replyTA.scrollHeight, 280) + 'px';
});

// Mallväljare
const readerTSelect = modal.querySelector('#reader-template-select');
if (readerTSelect) {
readerTSelect.onchange = () => {
const tId = readerTSelect.value;
if (!tId) return;
const tmpl = (State.templates || []).find(x => x.id == tId);
if (tmpl) {
readerAdminActiveTemplateHtml = tmpl.content;
replyTA.value = (tmpl.content || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n').replace(/<p[^>]*>/gi, '')
  .replace(/<\/div>/gi, '\n').replace(/<div[^>]*>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
replyTA.style.height = 'auto';
replyTA.style.height = Math.min(replyTA.scrollHeight, 280) + 'px';
replyTA.focus();
readerTSelect.value = '';
}
};
// Kassa mallen om agenten redigerar manuellt
replyTA.addEventListener('input', (e) => {
if (e.isTrusted) readerAdminActiveTemplateHtml = null;
});
}
const aiBtn = modal.querySelector('#reader-ai-btn');
if (aiBtn) {
aiBtn.onclick = () => {
if (!replyTA) return;
const lastUser = [...(t.messages || [])].reverse().find(m => m.role === 'user');
const originalMsg = lastUser?.content || t.last_message || '';
if (!originalMsg) { showToast('Ingen kundtext att basera förslag på.'); return; }
replyTA.value = '🤖 Tänker... (Hämtar AI-förslag)';
replyTA.disabled = true;
window.socketAPI.emit('team:email_action', {
conversationId: convId,
action: 'draft',
content: originalMsg
});
};
}
}

// Archive-knapp i reader
const readerArchiveBtn = modal.querySelector('#reader-archive-btn');
if (readerArchiveBtn) {
readerArchiveBtn.onclick = async () => {
try {
await fetch(`${SERVER_URL}/api/inbox/archive`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: convId }) });
showToast('✅ Ärendet arkiverat!');
currentTicketList.splice(currentTicketIdx, 1);
if (currentTicketList.length === 0) { _closeReader(); }
else { currentTicketIdx = Math.min(currentTicketIdx, currentTicketList.length - 1); renderReaderContent(); }
} catch (err) { console.error('[reader-archive] Fel:', err); showToast('❌ Kunde inte arkivera.'); }
};
}

// Delete-knapp i reader
const readerDeleteBtn = modal.querySelector('#reader-delete-btn');
if (readerDeleteBtn) {
readerDeleteBtn.onclick = async () => {
if (!(await atlasConfirm('Ta bort', 'Är du säker? Detta raderar ärendet permanent.'))) return;
try {
await fetch(`${SERVER_URL}/api/inbox/delete`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ conversationId: convId }) });
showToast('✅ Ärendet raderat');
currentTicketList.splice(currentTicketIdx, 1);
if (currentTicketList.length === 0) { _closeReader(); }
else { currentTicketIdx = Math.min(currentTicketIdx, currentTicketList.length - 1); renderReaderContent(); }
} catch (err) { console.error('[reader-delete] Fel:', err); showToast('❌ Kunde inte radera.'); }
};
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
// Uppdatera notes-glow för det nya ärendet
const t = currentTicketList[currentTicketIdx];
if (t?.conversation_id && typeof refreshNotesGlow === 'function') {
refreshNotesGlow(t.conversation_id);
}
}
}

// ===================================================
// HELPER - CLOSE READER (Global scope)
// ===================================================
function _closeReader() {
const modal = document.getElementById('atlas-reader-modal');
if (modal) {
modal.style.display = 'none';
modal.style.pointerEvents = 'none';
modal.removeAttribute('data-current-id');
}

if (window._savedTicketList !== undefined) {
currentTicketList = window._savedTicketList;
delete window._savedTicketList;
}
}