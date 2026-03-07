// ============================================
// modules/customers-view.js
// VAD DEN GÖR: Kunder-vyn — lista och detaljer
//              för unika kunder baserat på
//              ärenden i chat_v2_state.
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders               — renderer.js globals
//   getAgentStyles, resolveLabel, showToast — styling-utils.js
//   UI_ICONS, ADMIN_UI_ICONS               — ui-constants.js
//   formatAtlasMessage                     — renderer.js
//   openNotesModal                         — notes-system.js
// ============================================

// Modul-lokal state
let _customerItems    = [];
let _currentTickets   = [];
let _currentTicketIdx = 0;
let _currentCustomerObj = null;
let _aiSummaryCache = {}; // email → summering (överlever ticket-navigering)

// ============================================================================
// RENDER CUSTOMER LIST — Hämtar data i bakgrunden, visar TOM lista vid start
// ============================================================================
async function renderCustomerList() {
const container = document.getElementById('customer-list');
if (!container) return;

// Tom lista vid start
container.innerHTML = '';

// Återställ placeholder och rensa eventuell tidigare selektion
_restoreCustomerPlaceholder();

// Hämta kunddata från server
try {
const res = await fetch(`${SERVER_URL}/api/customers`, { headers: fetchHeaders });
if (!res.ok) throw new Error(`Serverfel: ${res.status}`);
const data = await res.json();
_customerItems = data.customers || [];
console.log('[Kunder] Laddade:', _customerItems.length, 'kunder. Exempel:', _customerItems[0]);
} catch (err) {
console.error('❌ Customer list error:', err);
_customerItems = [];
}

// Koppla sökning (återställer fält och sätter handlers)
_setupCustomerSearch();

// Koppla dead-zone-lyssnare på höger kolumn (en gång)
_setupDeadZoneListener();
}

// ============================================================================
// SETUP SÖKNING — Kopplar båda sökfälten med bidirektionell sync
// ============================================================================
function _setupCustomerSearch() {
const topEl  = document.getElementById('customer-search-top');
const mainEl = document.getElementById('customer-search-main');

// Återställ värden vid ny aktivering
if (topEl)  topEl.value  = '';
if (mainEl) mainEl.value = '';

// Autofokusera placeholder-sökfältet
setTimeout(() => {
  if (mainEl) mainEl.focus();
}, 50);

// Sync-flagga för att undvika rekursiv loop
let _syncing = false;

if (topEl) {
topEl.oninput = () => {
if (_syncing) return;
_syncing = true;
if (mainEl) mainEl.value = topEl.value;
_syncing = false;
_handleCustomerSearch(topEl.value);
};
}

if (mainEl) {
mainEl.oninput = () => {
if (_syncing) return;
_syncing = true;
if (topEl) topEl.value = mainEl.value;
_syncing = false;
_handleCustomerSearch(mainEl.value);
};
}
}

// ============================================================================
// DEAD ZONE LISTENER — Klick direkt på höger kolumnens bakgrund återställer
// ============================================================================
function _setupDeadZoneListener() {
const editorEl = document.querySelector('#view-customers .template-editor-container');
if (!editorEl || editorEl._deadZoneSetup) return;
editorEl._deadZoneSetup = true;

editorEl.addEventListener('click', (e) => {
// Klick direkt på containern (bakgrunden) — inte på innehåll inuti
if (e.target === editorEl) {
_restoreCustomerPlaceholder();
}
});
}

// ============================================================================
// HANTERA SÖK — Visar träffar om text >= 3 tecken, annars töm listan
// ============================================================================
function _handleCustomerSearch(rawText) {
const text = (rawText || '').trim().toLowerCase();
const container = document.getElementById('customer-list');
if (!container) return;

if (text.length < 3) {
container.innerHTML = '';
return;
}

const filtered = _customerItems.filter(c => {
const searchable = [
c.name    || '',
c.email   || '',
c.phone   || '',
c.offices || ''
].join(' ').toLowerCase();
return searchable.includes(text);
});

_renderCustomerCards(filtered, container);
}

// ============================================================================
// RENDERA KUNDKORT i given container
// ============================================================================
function _renderCustomerCards(list, container) {
container.innerHTML = '';

if (list.length === 0) {
container.innerHTML = '<div class="template-item-empty">Inga kunder matchade sökningen.</div>';
return;
}

list.forEach(customer => {
const el = document.createElement('div');
el.className = 'team-ticket-card';

const firstOffice = customer.offices ? customer.offices.split(',')[0].trim() : null;

// ÄNDRING A: Agentfärg (inloggad agent) styr korten i kundvyn, inte kontorsfärg
const agentColor = (typeof currentUser !== 'undefined' && currentUser.agent_color)
? currentUser.agent_color
: '#0071e3';

el.style.setProperty('border-left', `4px solid ${agentColor}`, 'important');
el.style.setProperty('--agent-color', agentColor);

const lastContact = customer.last_contact
? new Date(customer.last_contact * 1000).toLocaleDateString('sv-SE')
: '—';

el.innerHTML = `
<div class="ticket-header-row">
<div class="ticket-title">
<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${customer.name || '—'}</span>
</div>
<div class="ticket-top-right" style="color:${agentColor};">
<span style="background:${agentColor}22; color:${agentColor}; border:1px solid ${agentColor}44; font-size:10px; padding:2px 8px; border-radius:10px;">${customer.total_tickets}</span>
</div>
</div>
<div class="ticket-preview" style="font-size:11px;">
${customer.email ? `<span>${customer.email}</span>` : ''}
${customer.email && customer.phone ? ' &middot; ' : ''}
${customer.phone ? `<span>${customer.phone}</span>` : ''}
${!customer.email && !customer.phone ? '<span style="opacity:0.4;">Ingen kontaktinfo</span>' : ''}
</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${lastContact}</div>
<div class="ticket-tag" style="color:${agentColor}; border-color:${agentColor}44;">
${firstOffice ? resolveLabel(firstOffice) : '—'}
</div>
</div>
`;

el.onclick = () => {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
el.classList.add('active-ticket');
openCustomerDetail(customer);
};

container.appendChild(el);
});
}

// ============================================================================
// ÅTERSTÄLL PLACEHOLDER — Döljer kunddetalj och visar placeholder igen
// ============================================================================
function _restoreCustomerPlaceholder() {
const placeholder = document.getElementById('customer-placeholder');
const detail      = document.getElementById('customer-detail');
if (placeholder) placeholder.style.display = '';
if (detail)      detail.style.display      = 'none';

// Rensa aktiv-markering i listan
const container = document.getElementById('customer-list');
if (container) {
container.querySelectorAll('.team-ticket-card').forEach(c => c.classList.remove('active-ticket'));
}

_currentCustomerObj = null;
}

// ============================================================================
// ÖPPNA KUNDDETALJER (höger kolumn) — hämtar data och bygger vyn
// ============================================================================
async function openCustomerDetail(customerObj) {
_currentCustomerObj = customerObj;

const placeholder = document.getElementById('customer-placeholder');
const detail      = document.getElementById('customer-detail');
if (!placeholder || !detail) return;

placeholder.style.display = 'none';
detail.style.display = 'flex';
detail.innerHTML = '<div class="spinner-small" style="margin:40px auto;"></div>';

// Hämta ärenden för kunden
let tickets = [];
try {
const params = new URLSearchParams();
if (customerObj.email) {
params.set('email', customerObj.email);
} else {
params.set('name', customerObj.name || '');
params.set('phone', customerObj.phone || '');
}
const res = await fetch(`${SERVER_URL}/api/customers/tickets?${params}`, { headers: fetchHeaders });
if (res.ok) {
const data = await res.json();
tickets = data.tickets || [];
}
} catch (err) {
console.error('❌ Customer tickets error:', err);
}

// Spara i modul-state
_currentTickets = tickets;

// Statistik
const activeCount    = tickets.filter(t => t.is_archived === 0 || t.is_archived === null).length;
const archivedCount  = tickets.filter(t => t.is_archived === 1).length;
const uniqueOffices  = [...new Set(tickets.map(t => t.routing_tag).filter(Boolean))];
const uniqueVehicles = [...new Set(tickets.map(t => t.vehicle).filter(Boolean))];

const firstOffice = uniqueOffices[0] ||
(customerObj.offices ? customerObj.offices.split(',')[0].trim() : null);
const agentStyleColor = (typeof currentUser !== 'undefined' && currentUser.agent_color)
? currentUser.agent_color : null;
const styles = agentStyleColor
? getAgentStyles(currentUser.username)
: getAgentStyles(firstOffice || 'unclaimed');

const lastContactDate = customerObj.last_contact
? new Date(customerObj.last_contact * 1000).toLocaleDateString('sv-SE')
: '—';

detail.innerHTML = `
<div class="detail-container" style="border-top:none; border-bottom:none; background:none; box-shadow:none; flex:1; display:flex; flex-direction:column; min-height:0;">

<!-- KUNDHEADER -->
<div class="detail-header-top"
style="border-bottom:2px solid ${styles.main}; background:linear-gradient(90deg,${styles.bg},transparent); flex-shrink:0; display:flex; align-items:center; justify-content:space-between;">
<div style="display:flex; align-items:center; gap:15px;">
<div style="width:52px; height:52px; border:2px solid ${styles.main}; font-size:20px; font-weight:700;
background:${styles.bg}; color:${styles.main}; display:flex; align-items:center;
justify-content:center; border-radius:50%; flex-shrink:0;">
${(customerObj.name || '?').charAt(0).toUpperCase()}
</div>
<div>
<h2 class="detail-subject" style="color:${styles.main};">${customerObj.name || '—'}</h2>
<div class="header-pills-row">
${customerObj.email
? `<div class="pill" style="color:${styles.main}aa; border-color:${styles.main}35;">${customerObj.email}</div>`
: ''}
${customerObj.phone
? `<div class="pill" style="color:${styles.main}aa; border-color:${styles.main}35;">${customerObj.phone}</div>`
: ''}
<div class="pill" style="border-color:${styles.main}40; color:${styles.main};">${customerObj.total_tickets} ärenden</div>
<div class="pill" style="color:var(--text-secondary); border-color:var(--border-color);">${lastContactDate}</div>
</div>
</div>
</div>
<!-- ÄNDRING 3: Notes-knapp i kundheadern -->
<button class="btn-glass-icon notes-trigger-btn"
onclick="openCustomerNotesModal('${customerObj.email || ''}', '${(customerObj.name || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')"
title="Interna anteckningar om kunden"
style="color:${styles.main}; border-color:${styles.border}; flex-shrink:0;">
${UI_ICONS.NOTES}
</button>
</div>

<!-- STATISTIKRAD (4 rutor) -->
<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:15px 20px;
flex-shrink:0; background:rgba(0,0,0,0.1); border-bottom:1px solid rgba(255,255,255,0.05);">
<div class="admin-stat-card" style="text-align:center; padding:12px;">
<div style="font-size:28px; font-weight:800; color:${styles.main}; line-height:1;">${activeCount}</div>
<div style="font-size:10px; opacity:0.5; text-transform:uppercase; margin-top:4px;">Aktiva</div>
</div>
<div class="admin-stat-card" style="text-align:center; padding:12px;">
<div style="font-size:28px; font-weight:800; color:var(--text-secondary); line-height:1;">${archivedCount}</div>
<div style="font-size:10px; opacity:0.5; text-transform:uppercase; margin-top:4px;">Arkiverade</div>
</div>
<div class="admin-stat-card" style="padding:12px;">
<div style="font-size:9px; opacity:0.5; text-transform:uppercase; margin-bottom:6px;">Kontor</div>
<div style="font-size:11px; color:var(--text-primary); line-height:1.4;">${uniqueOffices.map(o => resolveLabel(o)).join(', ') || '—'}</div>
</div>
<div class="admin-stat-card" style="padding:12px;">
<div style="font-size:9px; opacity:0.5; text-transform:uppercase; margin-bottom:6px;">Fordon</div>
<div style="font-size:11px; color:var(--text-primary); line-height:1.4;">${uniqueVehicles.join(', ') || '—'}</div>
</div>
</div>

<!-- ÄRENDELISTA (byts ut mot reader vid klick) -->
<div id="customer-ticket-list-body" class="detail-body" style="flex:1; overflow-y:auto; padding:15px 20px;">
${_buildTicketListHtml()}
</div>

</div>
`;
}

// ============================================================================
// HJÄLPFUNKTION: Bygg HTML-sträng för ärendelistan från _currentTickets
// ============================================================================
function _buildTicketListHtml() {
if (_currentTickets.length === 0) {
return '<div class="template-item-empty">Inga ärenden hittades.</div>';
}

const header = `<h4 style="margin:0 0 12px 0; font-size:10px; opacity:0.5; text-transform:uppercase;">Ärendehistorik (${_currentTickets.length})</h4>`;

const cards = _currentTickets.map((t, i) => {
const agentColor = (typeof currentUser !== 'undefined' && currentUser.agent_color)
? currentUser.agent_color : '#0071e3';
const isMail   = t.session_type === 'message';
const typeIcon = isMail ? UI_ICONS.MAIL : UI_ICONS.CHAT;
const dateStr  = new Date(t.timestamp).toLocaleString('sv-SE', {
year: 'numeric', month: 'numeric', day: 'numeric',
hour: '2-digit', minute: '2-digit'
});
const isArchived   = t.is_archived === 1;
const titleDisplay = t.subject || t.question || 'Ärende';

return `
<div class="team-ticket-card"
style="border-left:3px solid ${agentColor} !important; margin-bottom:8px; cursor:pointer;"
onclick="_openCustomerTicketReader(${i})">
<div class="ticket-header-row">
<div class="ticket-title" style="font-size:12px;">
<span style="opacity:0.7; margin-right:6px; display:flex; align-items:center;">${typeIcon}</span>
<span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${titleDisplay}</span>
</div>
<div style="font-size:10px; flex-shrink:0;">
${isArchived
? '<span style="color:var(--text-secondary); opacity:0.5;">ARKIVERAT</span>'
: '<span style="color:#4cd964;">AKTIVT</span>'}
</div>
</div>
<div class="ticket-footer-bar">
<div class="ticket-time">${dateStr}</div>
<div class="ticket-tag" style="color:${agentColor}; border-color:${agentColor}44;">
${t.routing_tag ? resolveLabel(t.routing_tag) : '—'}
</div>
</div>
</div>
`;
}).join('');

return header + cards;
}

// ============================================================================
// ÅTERSTÄLL ÄRENDELISTAN i detail-body (från inline-läsvyn)
// ============================================================================
function _renderTicketListBody() {
const bodyEl = document.getElementById('customer-ticket-list-body');
if (!bodyEl) return;
bodyEl.innerHTML = _buildTicketListHtml();
}

// ============================================================================
// ÖPPNA ÄRENDE-MODAL för ärende på index idx
// Modellerad på admin-reader.js — modal framför listan, utan svarsruta
// ============================================================================
function _openCustomerTicketReader(idx) {
_currentTicketIdx = idx;
_renderCustomerReaderModal();
}

function _renderCustomerReaderModal() {
const idx = _currentTicketIdx;
const t   = _currentTickets[idx];
if (!t) return;

// Använd inloggad agents färg (samma som i ärendelistorna) med fallback till routing_tag
const agentColor = (typeof currentUser !== 'undefined' && currentUser.agent_color)
  ? currentUser.agent_color : null;
const tStyles = (typeof currentUser !== 'undefined' && currentUser.username)
  ? getAgentStyles(currentUser.username)
  : getAgentStyles(t.routing_tag || t.owner || 'unclaimed');
const titleDisplay = t.subject || t.question || 'Ärende';
const hasPrev      = idx > 0;
const hasNext      = idx < _currentTickets.length - 1;
const hasHistory   = _currentTickets.length >= 2;

// Skapa eller återanvänd modal-overlay (samma mönster som admin-reader.js)
let modal = document.getElementById('customer-reader-modal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'customer-reader-modal';
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '10000';
document.body.appendChild(modal);
}

// Bygg bubbel-historik
const messages = Array.isArray(t.answer) ? t.answer : [];
let bubblesHtml = '';

if (messages.length === 0) {
bubblesHtml = '<div style="opacity:0.4; text-align:center; font-size:12px; padding:30px 0;">Ingen meddelandehistorik.</div>';
} else {
bubblesHtml = messages.map(m => {
if (m.role === 'system') return '';
const isUser   = m.role === 'user';
const rawText  = m.content || m.text || '';
const clean    = rawText.replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
const rendered = (typeof formatAtlasMessage === 'function') ? formatAtlasMessage(clean) : clean;
const label    = isUser ? 'KUND' : (m.role === 'agent' ? (m.sender || 'AGENT').toUpperCase() : 'ATLAS');

return `
<div style="display:flex; flex-direction:column; align-items:${isUser ? 'flex-start' : 'flex-end'}; margin-bottom:10px;">
<div style="font-size:9px; font-weight:700; letter-spacing:0.8px; opacity:0.4; margin-bottom:3px;
color:${isUser ? tStyles.main : 'rgba(255,255,255,0.7)'};">
${label}
</div>
<div style="max-width:78%; padding:9px 13px;
border-radius:${isUser ? '3px 12px 12px 12px' : '12px 3px 12px 12px'};
background:${isUser ? tStyles.bubbleBg : 'rgba(255,255,255,0.05)'};
border:1px solid ${isUser ? tStyles.border : 'rgba(255,255,255,0.07)'};
font-size:13px; line-height:1.55; color:var(--text-primary); word-break:break-word;">
${rendered}
</div>
</div>
`;
}).join('');
}

modal.innerHTML = `
<div class="glass-modal-box glass-effect"
style="width:680px; max-width:92vw; border-top:3px solid ${tStyles.main};
position:relative; display:flex; flex-direction:column; max-height:82vh; overflow:hidden;">

<!-- HEADER — fast höjd, ingen radbrytning -->
<div style="height:68px; min-height:68px; max-height:68px; padding:0 12px 0 16px;
border-bottom:1px solid rgba(255,255,255,0.07);
display:flex; align-items:center; justify-content:space-between;
flex-shrink:0; overflow:hidden;
background:linear-gradient(90deg, ${tStyles.main}14, transparent);">

<!-- Vänster: ikon + titel + subtitle — får aldrig tränga på höger -->
<div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1; overflow:hidden;">
<div style="width:38px; height:38px; border-radius:9px; background:${tStyles.main};
color:black; font-weight:800; font-size:16px;
display:flex; align-items:center; justify-content:center;
flex-shrink:0; box-shadow:0 2px 10px ${tStyles.main}55;">
${(titleDisplay || 'U').substring(0,1).toUpperCase()}
</div>
<div style="min-width:0; overflow:hidden;">
<div style="font-size:14px; font-weight:700; color:white;
white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
${titleDisplay}
</div>
<div style="display:flex; align-items:center; gap:5px; margin-top:2px; flex-wrap:nowrap;">
<span style="font-size:10px; opacity:0.4; color:white; letter-spacing:0.3px;
white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">
${t.routing_tag ? resolveLabel(t.routing_tag) : '—'} • ${t.timestamp ? new Date(t.timestamp).toLocaleDateString('sv-SE') : '—'}
</span>
${t.is_archived === 1
? '<span style="flex-shrink:0; font-size:9px; font-weight:800; letter-spacing:0.5px; color:rgba(255,255,255,0.3); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:1px 6px; border-radius:4px; white-space:nowrap;">ARKIVERAT</span>'
: '<span style="flex-shrink:0; font-size:9px; font-weight:800; letter-spacing:0.5px; color:#4cd964; background:rgba(76,217,100,0.1); border:1px solid rgba(76,217,100,0.25); padding:1px 6px; border-radius:4px; white-space:nowrap;">AKTIVT</span>'}
</div>
</div>
</div>

<!-- Höger: notes + paginering — aldrig krympt -->
<div style="display:flex; align-items:center; gap:4px; flex-shrink:0; margin-left:8px;">
${hasHistory ? `<button class="btn-glass-icon" id="cust-reader-ai-btn"
title="AI-summering av kund"
style="color:${tStyles.main}; border-color:${tStyles.border};">
${UI_ICONS.AI}
</button>` : ''}
<button class="btn-glass-icon notes-trigger-btn"
data-id="${t.conversation_id}"
onclick="openNotesModal('${t.conversation_id}')"
title="Interna anteckningar"
style="color:${tStyles.main}; border-color:${tStyles.border};">
${UI_ICONS.NOTES}
</button>
<div style="width:1px; height:16px; background:rgba(255,255,255,0.1); margin:0 3px;"></div>
<button class="btn-glass-icon" id="cust-reader-prev"
${hasPrev ? '' : 'disabled style="opacity:0.22; pointer-events:none;"'}
title="Föregående ärende">
${ADMIN_UI_ICONS.ARROW_LEFT}
</button>
<span style="font-size:11px; font-weight:700; opacity:0.55; font-family:monospace;
color:white; min-width:36px; text-align:center;">
${idx + 1}/${_currentTickets.length}
</span>
<button class="btn-glass-icon" id="cust-reader-next"
${hasNext ? '' : 'disabled style="opacity:0.22; pointer-events:none;"'}
title="Nästa ärende">
${ADMIN_UI_ICONS.ARROW_RIGHT}
</button>
</div>
</div>

${hasHistory ? `
<div id="cust-ai-panel" style="display:${_aiSummaryCache[_currentCustomerObj?.email] ? 'block' : 'none'};
padding:10px 18px; border-bottom:1px solid rgba(0,113,227,0.15);
background:rgba(0,113,227,0.06); flex-shrink:0;">
<span style="font-size:10px; font-weight:600; color:#0071e3; text-transform:uppercase;
letter-spacing:0.5px; display:block; margin-bottom:4px;">AI Kundanalys</span>
<span id="cust-ai-text" style="font-size:12px; line-height:1.65; color:var(--text-secondary);">
${_aiSummaryCache[_currentCustomerObj?.email] || ''}
</span>
</div>` : ''}

<!-- MEDDELANDEBUBBLAR -->
<div style="flex:1; overflow-y:auto; padding:16px 18px;
display:flex; flex-direction:column; gap:10px; min-height:0;">
${bubblesHtml}
</div>

</div>
`;

// Visa modal + stäng vid klick utanför
modal.style.display = 'flex';
modal.style.pointerEvents = 'all';
modal.onclick = (e) => { if (e.target === modal) _closeCustomerReader(); };

// Lysa upp notes-ikonen om det finns anteckningar för detta ärende
if (t.conversation_id && typeof refreshNotesGlow === 'function') {
  refreshNotesGlow(t.conversation_id);
}

// Koppla paginerings-knappar efter inject
const prevBtn = modal.querySelector('#cust-reader-prev');
const nextBtn = modal.querySelector('#cust-reader-next');
if (prevBtn && hasPrev) prevBtn.onclick = () => { _currentTicketIdx--; _renderCustomerReaderModal(); };
if (nextBtn && hasNext) nextBtn.onclick = () => { _currentTicketIdx++; _renderCustomerReaderModal(); };

// AI-summering av hela kundhistoriken (cachas per email, överlever ticket-navigering)
const aiBtn = modal.querySelector('#cust-reader-ai-btn');
if (aiBtn) {
  aiBtn.onclick = async () => {
    const email = _currentCustomerObj?.email;
    aiBtn.disabled = true;
    const panel = modal.querySelector('#cust-ai-panel');
    const txt   = modal.querySelector('#cust-ai-text');
    if (panel && txt) { panel.style.display = 'block'; txt.textContent = '🤖 Analyserar...'; }
    try {
      const r = await fetch(`${SERVER_URL}/api/customers/summarize`, {
        method: 'POST',
        headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await r.json();
      const summary = data.summary || data.error || 'Inget svar.';
      if (email) _aiSummaryCache[email] = summary; // Cacha för navigering
      if (txt) txt.textContent = summary;
    } catch (e) {
      if (txt) txt.textContent = 'Kunde inte nå servern.';
    } finally {
      aiBtn.disabled = false;
    }
  };
}

// ESC stänger
const escHandler = (e) => {
if (e.key === 'Escape') { _closeCustomerReader(); document.removeEventListener('keydown', escHandler); }
};
document.addEventListener('keydown', escHandler);
}

function _closeCustomerReader() {
const modal = document.getElementById('customer-reader-modal');
if (modal) {
modal.style.display = 'none';
modal.style.pointerEvents = 'none';
}
}

// ============================================================================
// KUNDANTECKNINGAR MODAL — Öppnar notes-modal kopplad till kundprofil (email)
// ÄNDRING 3: Ny funktion, återanvänder modal-strukturen från notes-system.js
// ============================================================================
async function openCustomerNotesModal(email, customerName) {
if (!email) {
showToast('Kunden saknar e-postadress — kan inte öppna anteckningar.', 'warning');
return;
}

// Skapa eller återanvänd modal-overlay
let overlay = document.getElementById('customer-notes-overlay');
if (!overlay) {
overlay = document.createElement('div');
overlay.id = 'customer-notes-overlay';
overlay.style.cssText = `
position:fixed; inset:0; z-index:9999;
background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
display:flex; align-items:center; justify-content:center;
`;
document.body.appendChild(overlay);
}

overlay.innerHTML = `
<div style="background:var(--bg-secondary,#1a1a2e); border:1px solid rgba(255,255,255,0.1);
border-radius:16px; width:500px; max-width:92vw; max-height:80vh;
display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.6);">
<div style="display:flex; align-items:center; justify-content:space-between;
padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0;">
<h3 style="margin:0; font-size:13px; font-weight:700; color:var(--text-primary);">
Anteckningar — ${customerName || email}
</h3>
<button onclick="document.getElementById('customer-notes-overlay').remove()"
class="footer-icon-btn"
style="font-size:16px; opacity:0.5; line-height:1;">✕</button>
</div>
<div id="customer-notes-list"
style="flex:1; overflow-y:auto; padding:16px 20px; min-height:80px;">
<div style="opacity:0.4; font-size:12px; text-align:center; padding:20px 0;">Laddar...</div>
</div>
<div style="padding:12px 20px; border-top:1px solid rgba(255,255,255,0.07); flex-shrink:0;">
<textarea id="customer-notes-input" rows="3" placeholder="Skriv en intern anteckning om kunden..."
style="width:100%; box-sizing:border-box; background:rgba(255,255,255,0.05);
border:1px solid rgba(255,255,255,0.1); border-radius:8px;
color:var(--text-primary); font-size:12px; padding:8px 12px;
resize:vertical; font-family:inherit;"></textarea>
<button onclick="_submitCustomerNote('${email}')"
class="btn-glass-icon"
style="margin-top:8px; padding:6px 16px; font-size:12px; border-radius:8px; width:100%;">
Spara anteckning
</button>
</div>
</div>
`;

overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
overlay.style.display = 'flex';

// Stäng med ESC
const escHandler = (e) => {
if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
};
document.addEventListener('keydown', escHandler);

// Hämta befintliga anteckningar
await _loadCustomerNotes(email);
}

async function _loadCustomerNotes(email) {
const listEl = document.getElementById('customer-notes-list');
if (!listEl) return;

try {
const res = await fetch(`${SERVER_URL}/api/customer-notes?email=${encodeURIComponent(email)}`, { headers: fetchHeaders });
if (!res.ok) throw new Error(res.status);
const data = await res.json();
const notes = data.notes || [];

if (notes.length === 0) {
listEl.innerHTML = '<div style="opacity:0.4; font-size:12px; text-align:center; padding:20px 0;">Inga anteckningar ännu.</div>';
return;
}

listEl.innerHTML = notes.map(n => {
const date = new Date(n.created_at).toLocaleString('sv-SE', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
return `
<div style="padding:10px 12px; background:rgba(255,255,255,0.04); border-radius:8px; margin-bottom:8px;
border-left:3px solid rgba(255,255,255,0.15);">
<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
<span style="font-size:10px; font-weight:700; opacity:0.6;">${n.agent_name}</span>
<div style="display:flex; align-items:center; gap:8px;">
<span style="font-size:10px; opacity:0.4;">${date}</span>
<button onclick="_deleteCustomerNote(${n.id},'${email}')"
style="font-size:11px; opacity:0.4; background:none; border:none; cursor:pointer;
color:var(--text-primary); padding:0;" title="Ta bort">✕</button>
</div>
</div>
<div style="font-size:12px; line-height:1.5; white-space:pre-wrap;">${n.content}</div>
</div>
`;
}).join('');
} catch (err) {
if (listEl) listEl.innerHTML = '<div style="opacity:0.4; font-size:12px; text-align:center; padding:20px 0;">Kunde inte hämta anteckningar.</div>';
console.error('❌ Customer notes load error:', err);
}
}

async function _submitCustomerNote(email) {
const input = document.getElementById('customer-notes-input');
const content = (input?.value || '').trim();
if (!content) return;

try {
const res = await fetch(`${SERVER_URL}/api/customer-notes`, {
method: 'POST',
headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ email, content })
});
if (!res.ok) throw new Error(res.status);
if (input) input.value = '';
await _loadCustomerNotes(email);
} catch (err) {
showToast('Kunde inte spara anteckning', 'error');
console.error('❌ Customer note save error:', err);
}
}

async function _deleteCustomerNote(id, email) {
try {
const res = await fetch(`${SERVER_URL}/api/customer-notes/${id}`, {
method: 'DELETE',
headers: fetchHeaders
});
if (!res.ok) throw new Error(res.status);
await _loadCustomerNotes(email);
} catch (err) {
showToast('Kunde inte ta bort anteckning', 'error');
console.error('❌ Customer note delete error:', err);
}
}

window.openCustomerDetailByEmail = async (email) => {
switchView('customers');
const res = await fetch(`${SERVER_URL}/api/customers`, { headers: fetchHeaders });
const data = await res.json();
const customer = data.customers?.find(c => c.email === email) || 
{ email, name: 'Kund', total_tickets: 0, last_contact: null, offices: '' };
openCustomerDetail(customer);
};

// ================================================
// NY FUNKTION: Öppna ärende-modal direkt från header-ikon
// ================================================
window.showCustomerReaderModal = async (email) => {
if (!email) {
showToast('Kunden saknar e-post – kan inte öppna historik', 'warning');
return;
}

// Hämta kund + alla ärenden
let customer = null;
let tickets = [];

try {
const res = await fetch(`${SERVER_URL}/api/customers`, { headers: fetchHeaders });
const data = await res.json();
customer = data.customers?.find(c => c.email === email);

if (customer) {
const params = new URLSearchParams({ email });
const ticketRes = await fetch(`${SERVER_URL}/api/customers/tickets?${params}`, { headers: fetchHeaders });
const ticketData = await ticketRes.json();
tickets = ticketData.tickets || [];
}
} catch (e) {
console.error('Kunde inte hämta kunddata för modal', e);
}

if (!customer) customer = { email, name: 'Kund', total_tickets: tickets.length };

// Sätt state och öppna modalen
_currentCustomerObj = customer;
_currentTickets = tickets;
_currentTicketIdx = 0;

_renderCustomerReaderModal();
};