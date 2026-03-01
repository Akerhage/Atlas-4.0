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
    const styles = getAgentStyles(firstOffice || 'unclaimed');

    el.style.setProperty('border-left', `4px solid ${styles.main}`, 'important');
    el.style.setProperty('--agent-color', styles.main);

    const lastContact = customer.last_contact
      ? new Date(customer.last_contact * 1000).toLocaleDateString('sv-SE')
      : '—';

    el.innerHTML = `
      <div class="ticket-header-row">
        <div class="ticket-title">
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${customer.name || '—'}</span>
        </div>
        <div class="ticket-top-right" style="color:${styles.main};">
          <span style="background:rgba(0,113,227,0.15); color:#0071e3; border:1px solid rgba(0,113,227,0.3); font-size:10px; padding:2px 8px; border-radius:10px;">${customer.total_tickets}</span>
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
        <div class="ticket-tag" style="color:${styles.main}; border-color:${styles.main}44;">
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
  const styles = getAgentStyles(firstOffice || 'unclaimed');

  const lastContactDate = customerObj.last_contact
    ? new Date(customerObj.last_contact * 1000).toLocaleDateString('sv-SE')
    : '—';

  detail.innerHTML = `
    <div class="detail-container" style="border-top:none; border-bottom:none; background:none; box-shadow:none; flex:1; display:flex; flex-direction:column; min-height:0;">

      <!-- KUNDHEADER -->
      <div class="detail-header-top"
           style="border-bottom:2px solid ${styles.main}; background:linear-gradient(90deg,${styles.bg},transparent); flex-shrink:0;">
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
              <div class="pill" style="border-color:rgba(0,113,227,0.4); color:#0071e3;">${customerObj.total_tickets} ärenden</div>
              <div class="pill" style="color:var(--text-secondary); border-color:var(--border-color);">${lastContactDate}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- STATISTIKRAD (4 rutor) -->
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:15px 20px;
                  flex-shrink:0; background:rgba(0,0,0,0.1); border-bottom:1px solid rgba(255,255,255,0.05);">
        <div class="admin-stat-card" style="text-align:center; padding:12px;">
          <div style="font-size:28px; font-weight:800; color:#4cd964; line-height:1;">${activeCount}</div>
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
    const tStyles  = getAgentStyles(t.routing_tag || t.owner || 'unclaimed');
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
           style="border-left:3px solid ${tStyles.main} !important; margin-bottom:8px; cursor:pointer;"
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
          <div class="ticket-tag" style="color:${tStyles.main}; border-color:${tStyles.main}44;">
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
// ÖPPNA INLINE-LÄSVY för ärende på index idx
// ============================================================================
function _openCustomerTicketReader(idx) {
  _currentTicketIdx = idx;

  const bodyEl = document.getElementById('customer-ticket-list-body');
  if (!bodyEl) return;

  const t = _currentTickets[idx];
  if (!t) return;

  const tStyles      = getAgentStyles(t.routing_tag || t.owner || 'unclaimed');
  const titleDisplay = t.subject || t.question || 'Ärende';
  const hasPrev      = idx > 0;
  const hasNext      = idx < _currentTickets.length - 1;

  // Bygg bubbel-historik
  const messages = Array.isArray(t.answer) ? t.answer : [];
  let bubblesHtml = '';

  if (messages.length === 0) {
    bubblesHtml = '<div style="opacity:0.4; text-align:center; font-size:12px; padding:30px 0;">Ingen meddelandehistorik.</div>';
  } else {
    bubblesHtml = messages.map(m => {
      if (m.role === 'system') return '';
      const isUser  = m.role === 'user';
      const rawText = m.content || m.text || '';
      const clean   = rawText.replace(/^📧\s*(\((Mail|Svar)\):)?\s*/i, '');
      const rendered = (typeof formatAtlasMessage === 'function') ? formatAtlasMessage(clean) : clean;
      const label   = isUser ? 'KUND' : (m.role === 'agent' ? (m.sender || 'AGENT').toUpperCase() : 'ATLAS');

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

  bodyEl.innerHTML = `
    <!-- READER TOOLBAR -->
    <div style="display:flex; align-items:center; justify-content:space-between;
                padding-bottom:12px; margin-bottom:14px; flex-shrink:0;
                border-bottom:1px solid rgba(255,255,255,0.07);">

      <!-- Tillbaka-knapp -->
      <button class="footer-icon-btn"
              onclick="_renderTicketListBody()"
              title="Tillbaka till ärendelistan"
              style="display:flex; align-items:center; gap:6px; font-size:12px;
                     color:var(--text-secondary); padding:6px 10px; border-radius:8px;">
        ${ADMIN_UI_ICONS.ARROW_LEFT}
        <span>Tillbaka</span>
      </button>

      <!-- Ärendetitel -->
      <div style="flex:1; font-size:11px; opacity:0.5; text-align:center;
                  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 12px;">
        ${titleDisplay}
      </div>

      <!-- Höger: notes + paginering -->
      <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
        <button class="btn-glass-icon notes-trigger-btn"
                onclick="openNotesModal('${t.conversation_id}')"
                title="Interna anteckningar"
                style="color:${tStyles.main}; border-color:${tStyles.border};">
          ${UI_ICONS.NOTES}
        </button>
        <div style="width:1px; height:16px; background:rgba(255,255,255,0.1); margin:0 4px;"></div>
        <button class="btn-glass-icon"
                onclick="_openCustomerTicketReader(${idx - 1})"
                title="Föregående ärende"
                ${hasPrev ? '' : 'disabled style="opacity:0.22; pointer-events:none;"'}>
          ${ADMIN_UI_ICONS.ARROW_LEFT}
        </button>
        <span style="font-size:11px; font-weight:700; opacity:0.55; font-family:monospace;
                     min-width:36px; text-align:center; color:white;">
          ${idx + 1}/${_currentTickets.length}
        </span>
        <button class="btn-glass-icon"
                onclick="_openCustomerTicketReader(${idx + 1})"
                title="Nästa ärende"
                ${hasNext ? '' : 'disabled style="opacity:0.22; pointer-events:none;"'}>
          ${ADMIN_UI_ICONS.ARROW_RIGHT}
        </button>
      </div>
    </div>

    <!-- MEDDELANDEBUBBLAR -->
    <div style="display:flex; flex-direction:column;">
      ${bubblesHtml}
    </div>
  `;
}
