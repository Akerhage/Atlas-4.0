// ============================================
// modules/notif-system.js
// Notifikationsklocka — bell-knapp, badge och
// panel med Notiser (toasts) + Historik (events)
// ============================================

window.NotifSystem = (function () {

  const MAX_NOTIFS   = 50;
  const MAX_HISTORY  = 50;
  const KEY_NOTIFS   = 'atlas_notifs';
  const KEY_HISTORY  = 'atlas_history';
  const KEY_SEEN     = 'atlas_notif_seen';

  // --- LocalStorage-hjälpare ---
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }
  function save(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch(e) { console.warn('NotifSystem: localStorage-fel', e); }
  }

  function getNotifs()   { return load(KEY_NOTIFS);   }
  function getHistory()  { return load(KEY_HISTORY);  }
  function getLastSeen() { return parseInt(localStorage.getItem(KEY_SEEN) || '0', 10); }

  // Strippa HTML till ren text, max 90 tecken
  function stripHtmlLocal(html) {
    if (!html) return '';
    const t = document.createElement('div');
    t.innerHTML = html;
    const text = (t.textContent || t.innerText || '').replace(/\s+/g, ' ').trim();
    return text.length > 90 ? text.substring(0, 90) + '…' : text;
  }

  // Tidsetikett — "HH:MM" idag, annars "d mån HH:MM"
  function timeLabel(ts) {
    const d   = new Date(ts);
    const now = new Date();
    const timeStr = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return timeStr;
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) + ' ' + timeStr;
  }

  // Enkel HTML-escape för panelinnehåll
  function esc(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ================================================
  // Badge-uppdatering — uppdaterar ALLA .notif-badge-bubble
  // ================================================
  function updateBadge() {
    const count = getNotifs().filter(n => n.ts > getLastSeen()).length;
    document.querySelectorAll('.notif-badge-bubble').forEach(el => {
      if (count > 0) {
        el.textContent = count > 99 ? '99+' : String(count);
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });
  }

  // ================================================
  // addNotif — anropas från showToast() hook
  // ================================================
  function addNotif(html) {
    const text = stripHtmlLocal(html);
    if (!text) return;
    const notifs = getNotifs();
    notifs.unshift({ id: Date.now(), text, ts: Date.now() });
    if (notifs.length > MAX_NOTIFS) notifs.length = MAX_NOTIFS;
    save(KEY_NOTIFS, notifs);
    updateBadge();
  }

  // ================================================
  // addHistory — anropas från socket-events
  // ================================================
  function addHistory(icon, text, conversationId) {
    if (!text) return;
    const history = getHistory();
    const item = { id: Date.now(), icon: icon || '●', text: String(text), ts: Date.now() };
    if (conversationId) item.cid = String(conversationId);
    history.unshift(item);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    save(KEY_HISTORY, history);
    // Uppdatera historik-fliken live om panelen är öppen
    const panel = document.getElementById('notif-panel');
    if (panel && panel.style.display !== 'none') {
      const histTab = document.getElementById('notif-tab-historik');
      if (histTab && histTab.style.display !== 'none') renderHistoryTab();
    }
  }

  // ================================================
  // Rendera Notiser-fliken
  // ================================================
  function renderNotifTab() {
    const el = document.getElementById('notif-tab-notiser');
    if (!el) return;
    const notifs  = getNotifs();
    const seen    = getLastSeen();
    if (!notifs.length) {
      el.innerHTML = '<div class="notif-empty">Inga notiser ännu</div>';
      return;
    }
    el.innerHTML = notifs.map(n => `
      <div class="notif-item${n.ts > seen ? ' notif-unread' : ''}">
        <span class="notif-item-text">${esc(n.text)}</span>
        <span class="notif-item-time">${timeLabel(n.ts)}</span>
      </div>`).join('');
  }

  // ================================================
  // Rendera Historik-fliken
  // ================================================
  function renderHistoryTab() {
    const el = document.getElementById('notif-tab-historik');
    if (!el) return;
    const history = getHistory();
    if (!history.length) {
      el.innerHTML = '<div class="notif-empty">Ingen historik ännu</div>';
      return;
    }
    el.innerHTML = history.map(h => {
      const clickAttr = (h.cid && window.openTicketFromHistory)
        ? ` onclick="window.openTicketFromHistory('${esc(h.cid)}')" title="Klicka för att öppna ärendet" style="cursor:pointer"`
        : '';
      return `
      <div class="notif-item${h.cid ? ' notif-history-clickable' : ''}"${clickAttr}>
        <span class="notif-history-icon">${esc(h.icon)}</span>
        <span class="notif-item-text">${esc(h.text)}</span>
        <span class="notif-item-time">${timeLabel(h.ts)}</span>
      </div>`;
    }).join('');
  }

  // ================================================
  // Byt flik (Notiser / Historik)
  // ================================================
  let _activeTab = 'notiser';

  function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.notif-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    const elNotis   = document.getElementById('notif-tab-notiser');
    const elHistorik = document.getElementById('notif-tab-historik');
    if (elNotis)    elNotis.style.display    = tab === 'notiser'  ? 'block' : 'none';
    if (elHistorik) elHistorik.style.display = tab === 'historik' ? 'block' : 'none';
  }

  // ================================================
  // Rendera hela panelen
  // ================================================
  function renderPanel() {
    renderNotifTab();
    renderHistoryTab();
  }

  // ================================================
  // Positionera panelen nära klickad bell-knapp
  // ================================================
  function positionPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    // Hitta synlig (rendered) bell-knapp
    let bell = null;
    document.querySelectorAll('.notif-bell-btn').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) bell = b;
    });
    if (bell) {
      const r = bell.getBoundingClientRect();
      panel.style.top   = (r.bottom + 8) + 'px';
      panel.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
      panel.style.left  = 'auto';
    }
  }

  // ================================================
  // Växla panelen öppen/stängd
  // ================================================
  function togglePanel(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    if (panel.style.display !== 'none') {
      panel.style.display = 'none';
      return;
    }
    // Markera sett → nollställer badge
    localStorage.setItem(KEY_SEEN, Date.now().toString());
    updateBadge();
    renderPanel();
    switchTab(_activeTab);
    panel.style.display = 'flex';
    positionPanel();
  }

  // ================================================
  // Rensa allt
  // ================================================
  function clearAll() {
    save(KEY_NOTIFS,  []);
    save(KEY_HISTORY, []);
    localStorage.setItem(KEY_SEEN, Date.now().toString());
    updateBadge();
    renderPanel();
  }

  // ================================================
  // Hämta ärendenamn från DOM (ticket-kort i Inkorg / Mina Ärenden)
  // Returnerar kundnamn om kortet finns, annars kortad ID
  // ================================================
  function getTicketLabel(conversationId) {
    const card = document.querySelector(`#my-tickets-list .team-ticket-card[data-id="${conversationId}"]`)
               || document.querySelector(`#inbox-list .team-ticket-card[data-id="${conversationId}"]`);
    if (!card) return `#${String(conversationId).slice(-6)}`;
    // Titeltexten finns i andra <span> inuti .ticket-title (första är ikon)
    const spans = card.querySelectorAll('.ticket-title span');
    const name = (spans.length >= 2 ? spans[spans.length - 1] : spans[0])?.textContent?.trim();
    return name || `#${String(conversationId).slice(-6)}`;
  }

  // ================================================
  // Bell-SVG HTML
  // ================================================
  const BELL_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>`;

  // ================================================
  // Injicera bell i ett .header-actions-element
  // ================================================
  function injectBell(container) {
    if (container.querySelector('.notif-bell-btn')) return; // Redan injicerad
    const btn = document.createElement('button');
    btn.className = 'header-button notif-bell-btn';
    btn.title = 'Notiser';
    btn.setAttribute('aria-label', 'Notiser');
    btn.innerHTML = BELL_SVG + '<span class="notif-badge-bubble" style="display:none">0</span>';
    btn.addEventListener('click', togglePanel);
    // Alltid sist (längst till höger) i header-actions
    container.appendChild(btn);
    // Uppdatera just injicerad badge direkt
    updateBadge();
  }

  // ================================================
  // Init — körs en gång från renderer.js
  // ================================================
  function init() {
    // Injicera bell i alla befintliga .header-actions
    document.querySelectorAll('.header-actions').forEach(injectBell);

    // MutationObserver: fånga ny .header-actions vid vybyten
    const observer = new MutationObserver(() => {
      document.querySelectorAll('.header-actions').forEach(injectBell);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Klick utanför panel → stäng
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('notif-panel');
      if (!panel || panel.style.display === 'none') return;
      if (!panel.contains(e.target) && !e.target.closest('.notif-bell-btn')) {
        panel.style.display = 'none';
      }
    });

    updateBadge();
    console.log('🔔 NotifSystem initierat');
  }

  // Publikt API
  return { init, addNotif, addHistory, togglePanel, clearAll, switchTab, updateBadge, getTicketLabel };

}());
