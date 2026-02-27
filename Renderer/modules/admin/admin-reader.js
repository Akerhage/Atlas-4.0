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
