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

// Agentfärg styr korten i kundvyn
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

// Använd alltid inloggad agents färg direkt — undviker inaktuell usersCache och
// fel kontorsfärg. firstOffice används enbart för kontorsetiketten i statistikraden.
const firstOffice = uniqueOffices[0] ||
(customerObj.offices ? customerObj.offices.split(',')[0].trim() : null);
const _agentHex = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#'))
? currentUser.agent_color : '#0071e3';
const _hx = (h, a) => { try { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; } catch(e){ return `rgba(0,113,227,${a})`; } };
const styles = { main: _agentHex, bg: _hx(_agentHex,0.08), tagBg: _hx(_agentHex,0.2), bubbleBg: _hx(_agentHex,0.12), border: _hx(_agentHex,0.3) };

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
<div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
${tickets.length >= 1 ? `<button class="btn-glass-icon" id="cust-detail-ai-btn"
title="AI-summering av kundens historik"
style="color:#ffc400; border-color:rgba(255,196,0,0.3);">
${UI_ICONS.SPARKLES}
</button>` : ''}
${customerObj.email ? `<button class="btn-glass-icon" id="cust-detail-mail-btn"
title="Skicka nytt mail till kunden"
style="color:${styles.main}; border-color:${styles.border};">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
</button>` : ''}
<button class="btn-glass-icon notes-trigger-btn"
onclick="openCustomerNotesModal('${customerObj.email || ''}', '${(customerObj.name || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')"
title="Interna anteckningar om kunden"
style="color:${styles.main}; border-color:${styles.border};">
${UI_ICONS.NOTES}
</button>
</div>
</div>

<!-- AI-PANEL (collapsible) -->
<div id="cust-detail-ai-panel" style="display:none; padding:12px 20px; border-bottom:1px solid rgba(255,196,0,0.12); background:rgba(255,196,0,0.04); flex-shrink:0;">
<span style="font-size:10px; font-weight:600; color:#ffc400; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:4px;">✨ AI Kundanalys</span>
<span id="cust-detail-ai-text" style="font-size:12px; line-height:1.65; color:var(--text-secondary);"></span>
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

// Event listeners för AI och mail-knappar i kundheadern
const aiDetailBtn = detail.querySelector('#cust-detail-ai-btn');
if (aiDetailBtn) {
// Visa cachat resultat direkt om det finns
if (_aiSummaryCache[customerObj.email]) {
const _ap = detail.querySelector('#cust-detail-ai-panel');
const _at = detail.querySelector('#cust-detail-ai-text');
if (_ap && _at) { _at.textContent = _aiSummaryCache[customerObj.email]; _ap.style.display = 'block'; }
}
aiDetailBtn.onclick = async () => {
const panel = detail.querySelector('#cust-detail-ai-panel');
const txt   = detail.querySelector('#cust-detail-ai-text');
if (!panel) return;
// Toggle av: göm panelen om den redan visar ett resultat
if (panel.style.display !== 'none' && txt.textContent && txt.textContent !== '🤖 Analyserar...') {
panel.style.display = 'none'; return;
}
const email = customerObj.email;
if (_aiSummaryCache[email]) { txt.textContent = _aiSummaryCache[email]; panel.style.display = 'block'; return; }
panel.style.display = 'block'; txt.textContent = '🤖 Analyserar...'; aiDetailBtn.disabled = true;
try {
const r = await fetch(`${SERVER_URL}/api/customers/summarize`, {
method: 'POST', headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ email })
});
const data = await r.json();
const summary = data.summary || data.error || 'Inget svar.';
_aiSummaryCache[email] = summary; txt.textContent = summary;
} catch (e) { txt.textContent = 'Kunde inte nå servern.'; }
finally { aiDetailBtn.disabled = false; }
};
}
const mailDetailBtn = detail.querySelector('#cust-detail-mail-btn');
if (mailDetailBtn) {
mailDetailBtn.onclick = () => openCustomerMailCompose(customerObj.email, customerObj.name);
}

// Async: Lysa upp notes-ikonen om kunden har anteckningar
if (customerObj.email) {
(async () => {
try {
const res = await fetch(`${SERVER_URL}/api/customer-notes?email=${encodeURIComponent(customerObj.email)}`, { headers: fetchHeaders });
if (!res.ok) return;
const data = await res.json();
const notesBtn = detail.querySelector('.notes-trigger-btn');
if (notesBtn) {
if ((data.notes || []).length > 0) notesBtn.classList.add('has-notes-active');
else notesBtn.classList.remove('has-notes-active');
}
} catch (e) { /* Tyst felhantering */ }
})();
}
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
// Visa alltid inloggad agents färg — kundvyn är agentens perspektiv
const agentColor = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#'))
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
style="--agent-color:${agentColor}; margin-bottom:8px; cursor:pointer;"
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

// Använd ärendets kontor för färger
const tStyles = getAgentStyles(t.routing_tag || t.owner || 'unclaimed');
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
const label    = isUser ? (_currentCustomerObj?.name || 'KUND').toUpperCase() : (m.role === 'agent' ? (m.sender || 'AGENT').toUpperCase() : 'ATLAS');

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
// Öppna ärende-modal direkt från header-ikon
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

// ============================================================================
// SKICKA NYTT MAIL — öppnar komposeringsdialog med kundens mail förifyllt
// ============================================================================
function openCustomerMailCompose(email, name) {
const _mHex = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#')) ? currentUser.agent_color : '#0071e3';
const _mRgba = (a) => { try { const r=parseInt(_mHex.slice(1,3),16),g=parseInt(_mHex.slice(3,5),16),b=parseInt(_mHex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; } catch(e){ return `rgba(0,113,227,${a})`; } };
const overlay = document.createElement('div');
overlay.className = 'custom-modal-overlay';
overlay.style.zIndex = '10001';
overlay.innerHTML = `
<div class="glass-modal-box glass-effect" style="width:520px; max-width:92vw; border-top:3px solid ${_mHex};">
<div style="padding:18px 22px 14px; border-bottom:1px solid ${_mRgba(0.15)}; background:linear-gradient(90deg,${_mRgba(0.06)},transparent); display:flex; align-items:center;">
<div>
<div style="font-size:15px; font-weight:700; color:${_mHex};">Nytt mail</div>
<div style="font-size:11px; opacity:0.4; margin-top:2px;">Skapar ett nytt mailärende</div>
</div>
</div>
<div style="padding:18px 22px; display:flex; flex-direction:column; gap:12px;">
<div>
<label style="font-size:10px; font-weight:700; opacity:0.4; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Till</label>
<input id="cust-mail-to" class="filter-input" value="${(email || '').replace(/"/g,'&quot;')}" style="width:100%; box-sizing:border-box; font-size:13px;">
</div>
<div>
<label style="font-size:10px; font-weight:700; opacity:0.4; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Ämne</label>
<input id="cust-mail-subject" class="filter-input" placeholder="Ämne..." style="width:100%; box-sizing:border-box; font-size:13px;">
</div>
<div>
<label style="font-size:10px; font-weight:700; opacity:0.4; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:5px;">Meddelande</label>
<textarea id="cust-mail-body" placeholder="Skriv ditt meddelande..." style="width:100%; height:130px; resize:vertical; box-sizing:border-box; padding:10px 12px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:var(--text-primary); font-size:13px; font-family:inherit; outline:none; transition:border-color 0.2s;"></textarea>
</div>
</div>
<div style="padding:12px 22px 18px; display:flex; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.06);">
<button id="cust-mail-send" class="btn-glass-icon" title="Skicka mail" style="width:38px; height:38px;">${UI_ICONS.SEND}</button>
</div>
</div>`;
document.body.appendChild(overlay);
overlay.style.display = 'flex';
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
const _mailEscHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', _mailEscHandler); } };
document.addEventListener('keydown', _mailEscHandler);
overlay.addEventListener('remove', () => document.removeEventListener('keydown', _mailEscHandler));
overlay.querySelector('#cust-mail-send').onclick = async () => {
const to      = overlay.querySelector('#cust-mail-to').value.trim();
const subject = overlay.querySelector('#cust-mail-subject').value.trim() || 'Kontakt från kundtjänst';
const body    = overlay.querySelector('#cust-mail-body').value.trim();
if (!to || !to.includes('@')) { showToast('❌ Ange en giltig mailadress.'); return; }
if (!body) { showToast('❌ Meddelandet kan inte vara tomt.'); return; }
const sendBtn = overlay.querySelector('#cust-mail-send');
sendBtn.disabled = true;
// team:create_mail_ticket — servern skapar ärendet, skickar mail och
// sparar sentInfo.messageId direkt → korrekt e-posttrådning från svar #1.
// socketAPI.once() finns via socket-client.js — avregistreras automatiskt efter första svar.
try {
await new Promise((resolve, reject) => {
const timeout = setTimeout(() => reject(new Error('Timeout — inget svar från servern')), 10000);
window.socketAPI.once('mail:ticket_created', (data) => { clearTimeout(timeout); resolve(data.conversationId); });
window.socketAPI.once('server:error', (data) => { clearTimeout(timeout); reject(new Error(data.message)); });
window.socketAPI.emit('team:create_mail_ticket', {
customerEmail: to,
customerName: name || null,
subject: subject,
message: body,
html: body.replace(/\n/g, '<br>')
});
});
showToast('✅ Mail skickat!');
overlay.remove();
} catch (err) {
showToast('❌ ' + err.message);
sendBtn.disabled = false;
sendBtn.textContent = 'Skicka';
}
};
}

// ============================================================================
// INFO-MODAL — förklarar Kundregistret för agenter
// ============================================================================
function showCustomersInfoModal() {
const _iHex = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#')) ? currentUser.agent_color : '#0071e3';
const _iRgba = (a) => { try { const r=parseInt(_iHex.slice(1,3),16),g=parseInt(_iHex.slice(3,5),16),b=parseInt(_iHex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; } catch(e){ return `rgba(0,113,227,${a})`; } };
const overlay = document.createElement('div');
overlay.className = 'custom-modal-overlay';
overlay.style.zIndex = '10001';
overlay.innerHTML = `
<div class="glass-modal-box glass-effect" style="width:460px; max-width:90vw; border-top:3px solid ${_iHex};">
<div style="padding:20px 22px 14px; border-bottom:1px solid ${_iRgba(0.15)}; background:linear-gradient(90deg,${_iRgba(0.06)},transparent); display:flex; align-items:center; gap:12px;">
<div style="width:36px; height:36px; border-radius:50%; background:${_iRgba(0.12)}; border:1px solid ${_iRgba(0.3)}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${_iHex}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
</div>
<div>
<div style="font-size:15px; font-weight:700; color:${_iHex};">Kundregistret</div>
<div style="font-size:11px; opacity:0.4; margin-top:1px;">Ärendehistorik och kundanalys</div>
</div>
</div>
<div style="padding:18px 22px; display:flex; flex-direction:column; gap:10px;">
<div style="font-size:12px; line-height:1.6; color:var(--text-secondary);">Kundregistret samlar alla kunder som kontaktat er, oavsett kanal (chatt eller mail).</div>
<div style="display:flex; flex-direction:column; gap:8px; margin-top:2px;">
<div style="display:flex; align-items:flex-start; gap:10px;">
<span style="font-size:14px; flex-shrink:0; margin-top:1px;">🔍</span>
<span style="font-size:12px; color:var(--text-secondary); line-height:1.5;"><strong style="color:var(--text-primary);">Sök</strong> — skriv namn, e-post eller telefon. Minst 3 tecken för att trigga sökning.</span>
</div>
<div style="display:flex; align-items:flex-start; gap:10px;">
<span style="font-size:14px; flex-shrink:0; margin-top:1px;">📋</span>
<span style="font-size:12px; color:var(--text-secondary); line-height:1.5;"><strong style="color:var(--text-primary);">Kundkort</strong> — klicka för att se statistik och hela ärendehistoriken. Klicka ett ärende för att bläddra i konversationen.</span>
</div>
<div style="display:flex; align-items:flex-start; gap:10px;">
<span style="font-size:14px; flex-shrink:0; margin-top:1px;">✨</span>
<span style="font-size:12px; color:var(--text-secondary); line-height:1.5;"><strong style="color:var(--text-primary);">AI-analys</strong> — knappen i kundheadern sammanfattar hela kundens historik med AI. Resultatet cachas under sessionen.</span>
</div>
<div style="display:flex; align-items:flex-start; gap:10px;">
<span style="font-size:14px; flex-shrink:0; margin-top:1px;">✉️</span>
<span style="font-size:12px; color:var(--text-secondary); line-height:1.5;"><strong style="color:var(--text-primary);">Skicka mail</strong> — starta ett nytt mailärende direkt från kundkortet. Mailadressen är förifylld automatiskt.</span>
</div>
<div style="display:flex; align-items:flex-start; gap:10px;">
<span style="font-size:14px; flex-shrink:0; margin-top:1px;">📝</span>
<span style="font-size:12px; color:var(--text-secondary); line-height:1.5;"><strong style="color:var(--text-primary);">Anteckningar</strong> — interna noteringar om kunden, synliga för alla agenter.</span>
</div>
</div>
</div>
</div>`;
document.body.appendChild(overlay);
overlay.style.display = 'flex';
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}