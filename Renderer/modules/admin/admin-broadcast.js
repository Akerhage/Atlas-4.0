// ============================================
// modules/admin/admin-broadcast.js
// Systemmeddelanden till agenter och kontor
// ============================================

// ─── Scope-säker cache-hämtare ──────────────────────────────────────────────
// usersCache deklareras med `let` i renderer.js och exponeras INTE automatiskt
// på window. Vi försöker alla kända platser i prioritetsordning.
function _getCache() {
  if (Array.isArray(window.usersCache) && window.usersCache.length) return window.usersCache;
  try { if (typeof usersCache !== 'undefined' && Array.isArray(usersCache)) return usersCache; } catch (_) {}
  return [];
}

// ─── Agenter för ett kontor ──────────────────────────────────────────────────
// routing_tags är en komma-separerad sträng, t.ex. "goteborg_dingle,goteborg_hovas"
// Vi splittar, trimmar och jämför case-insensitivt för varje post.
function _agentsForOffice(tag) {
  const needle = tag.trim().toLowerCase();
  return _getCache().filter(u => {
    // Fältet heter routing_tag (singular) i usersCache — matchar DB-kolumnnamnet
    const rt = u.routing_tag || u.routing_tags || '';
    if (!rt) return false;
    return rt.split(',').some(t => t.trim().toLowerCase() === needle);
  });
}

// ─── ESC-stäng helper ────────────────────────────────────────────────────────
function _bindEsc(overlay) {
  function onKey(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
  }
  document.addEventListener('keydown', onKey);
}

// ─── Gemensam modal-skapare ───────────────────────────────────────────────────
function _createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'custom-modal-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10005',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,0.78)'
  ].join(';');
  return overlay;
}

// ─── Hämta styles för inloggad admin ─────────────────────────────────────────
function _adminStyles() {
  const color = (window.currentUser || {}).agent_color || '#0071e3';
  return typeof getAgentStyles === 'function'
    ? getAgentStyles(color)
    : { main: color, bg: 'rgba(0,113,227,0.1)', border: 'rgba(0,113,227,0.3)' };
}

// ─── Send-ikon ────────────────────────────────────────────────────────────────
function _sendIcon() {
  return (typeof UI_ICONS !== 'undefined' && UI_ICONS.SEND) ? UI_ICONS.SEND : '➤';
}

// ─── Modal-ram (header + body-wrapper) ───────────────────────────────────────
function _buildModalShell(styles, width, subtitle) {
  const box = document.createElement('div');
  box.className = 'glass-modal-box';
  box.style.cssText = [
    `width:${width}px`, 'padding:0',
    'background:#111115',
    'border:1px solid rgba(255,255,255,0.07)',
    'border-radius:12px', 'overflow:hidden',
    'box-shadow:0 40px 90px rgba(0,0,0,0.92)'
  ].join(';');

  box.innerHTML = `
    <div class="bcast-header" style="
      padding:11px 20px;
      display:flex; align-items:center; gap:10px;
      background:linear-gradient(90deg,${styles.bg},transparent);
      border-bottom:2px solid ${styles.main};">
      <span style="font-size:13px;opacity:.8;">📢</span>
      <span style="font-size:11px;font-weight:600;letter-spacing:1.5px;
        color:${styles.main};text-transform:uppercase;">Information</span>
      <span style="font-size:10px;color:var(--text-secondary,#888);
        opacity:.45;margin-left:4px;letter-spacing:.6px;">${subtitle}</span>
    </div>
    <div class="bcast-body" style="padding:16px 20px 18px;"></div>`;
  return box;
}

// ─── Textarea + skicka-rad ────────────────────────────────────────────────────
function _buildInputRow(inputId, placeholder, styles, onSend) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:flex-end;gap:12px;';

  const ta = document.createElement('textarea');
  ta.id = inputId;
  ta.placeholder = placeholder;
  ta.style.cssText = [
    'flex:1', 'height:46px', 'resize:none',
    'padding:11px 13px',
    'border-radius:8px',
    'background:rgba(0,0,0,0.55)',
    'border:1px solid rgba(255,255,255,0.06)',
    'color:var(--text-primary,#e8e8e8)',
    'font-family:inherit', 'font-size:14px',
    'line-height:1.45', 'outline:none',
    'transition:border-color .2s'
  ].join(';');
  ta.addEventListener('focus', () => { ta.style.borderColor = `${styles.main}55`; });
  ta.addEventListener('blur',  () => { ta.style.borderColor = 'rgba(255,255,255,0.06)'; });
  // Ctrl/Cmd+Enter → skicka
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onSend();
  });

  const btn = document.createElement('button');
  btn.title = 'Skicka (Ctrl+Enter)';
  btn.style.cssText = [
    'flex-shrink:0',
    'width:40px', 'height:40px',
    `background:${styles.bg}`,
    `border:1px solid ${styles.border || styles.main + '44'}`,
    `color:${styles.main}`,
    'border-radius:50%',
    'display:flex', 'align-items:center', 'justify-content:center',
    'cursor:pointer',
    'font-size:14px',
    'transition:opacity .2s'
  ].join(';');
  btn.innerHTML = _sendIcon();
  btn.onmouseenter = () => { btn.style.opacity = '.75'; };
  btn.onmouseleave = () => { btn.style.opacity = '1'; };
  btn.addEventListener('click', onSend);

  row.appendChild(ta);
  row.appendChild(btn);
  return row;
}

// ─── Utför sändning ───────────────────────────────────────────────────────────
window.executeBroadcastAction = function(type, target, displayName, overlay) {
  const inputId = type === 'agent' ? 'broadcast-msg-input' : 'broadcast-office-input';
  const inp = document.getElementById(inputId);
  if (!inp || !inp.value.trim()) {
    if (typeof showToast === 'function') showToast('❌ Skriv något innan du skickar.', 3000, 'warning');
    return;
  }
  const message = inp.value.trim();

  if (window.socketAPI) {
    if (type === 'agent') {
      window.socketAPI.emit('agent:broadcast', { username: target, message });
    } else {
      window.socketAPI.emit('office:broadcast', { office_tag: target, message });
    }
  }

  if (window.NotifSystem) {
    const histText = type === 'agent'
      ? `Meddelande till ${displayName}`
      : `Utskick: ${displayName}`;
    window.NotifSystem.addHistory('📢', histText);
  }

  if (typeof showToast === 'function') showToast(`✅ Skickat till ${displayName}`, 3000, 'success');
  overlay.remove();
};

// ─── Agent-modal (Privat) ─────────────────────────────────────────────────────
window.openAgentBroadcastModal = function(username, displayName) {
  const overlay = _createOverlay();
  const styles  = _adminStyles();
  const box     = _buildModalShell(styles, 460, `→ ${displayName}`);
  const body    = box.querySelector('.bcast-body');

  const doSend = () => window.executeBroadcastAction('agent', username, displayName, overlay);
  body.appendChild(_buildInputRow('broadcast-msg-input', 'Skriv ett meddelande…', styles, doSend));

  // MOTTAGARE-sektion — visa mottagaragen som pill med sin agentfärg
  const targetUser = _getCache().find(u => u.username === username);
  if (targetUser) {
    const aStyles  = typeof getAgentStyles === 'function' ? getAgentStyles(targetUser.agent_color) : { main: styles.main, bg: styles.bg };
    const isOnline = parseInt(targetUser.is_online) === 1;
    const dotColor = isOnline ? '#10b981' : 'rgba(255,255,255,0.35)';
    const name     = typeof formatName === 'function' ? formatName(username) : displayName;

    const section = document.createElement('div');
    section.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.04);';

    const lbl = document.createElement('div');
    lbl.style.cssText = `font-size:9px;letter-spacing:1px;text-transform:uppercase;color:${styles.main};font-weight:600;margin-bottom:8px;`;
    lbl.textContent = 'Mottagare (1)';

    const pill = document.createElement('div');
    pill.style.cssText = [
      'display:inline-flex', 'align-items:center', 'gap:5px',
      'padding:4px 12px 4px 9px',
      'border-radius:100px',
      `background:${aStyles.bg || 'rgba(255,255,255,0.04)'}`,
      `border:1px solid ${aStyles.main}88`,
      'font-size:11px',
      `color:${aStyles.main}`,
      'white-space:nowrap',
      `opacity:${isOnline ? '1' : '0.65'}`
    ].join(';');

    const dot = document.createElement('div');
    dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${dotColor};${isOnline ? `box-shadow:0 0 7px ${dotColor}88` : ''}`;

    pill.appendChild(dot);
    pill.appendChild(document.createTextNode(name));
    section.appendChild(lbl);
    section.appendChild(pill);
    body.appendChild(section);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  _bindEsc(overlay);
  setTimeout(() => document.getElementById('broadcast-msg-input')?.focus(), 80);
};

// ─── Kontors-modal (Grupputskick) ─────────────────────────────────────────────
window.openOfficeAgentsBroadcastModal = function(tag, cityName) {
  const overlay = _createOverlay();
  const styles  = _adminStyles();
  const box     = _buildModalShell(styles, 520, `→ ${cityName}`);
  const body    = box.querySelector('.bcast-body');

  // Input-rad
  const doSend = () => window.executeBroadcastAction('office', tag, cityName, overlay);
  body.appendChild(_buildInputRow('broadcast-office-input', `Meddelande till ${cityName}…`, styles, doSend));

  // Agentlista
  const agents = _agentsForOffice(tag);

  const section = document.createElement('div');
  section.style.cssText = [
    'margin-top:16px',
    'padding-top:14px',
    'border-top:1px solid rgba(255,255,255,0.04)'
  ].join(';');

  const label = document.createElement('div');
  label.style.cssText = [
    'font-size:9px',
    'letter-spacing:1px',
    'text-transform:uppercase',
    `color:${styles.main}`,
    'font-weight:600',
    'margin-bottom:9px'
  ].join(';');
  label.textContent = `Mottagare (${agents.length})`;
  section.appendChild(label);

  const pillsWrap = document.createElement('div');
  pillsWrap.style.cssText = [
    'display:flex', 'flex-wrap:wrap', 'gap:6px',
    'max-height:88px', 'overflow-y:auto',
    'padding-bottom:2px'
  ].join(';');

  if (!agents.length) {
    pillsWrap.innerHTML = '<span style="font-size:10px;opacity:.2;">Inga agenter hittades för detta kontor.</span>';
  } else {
    agents.forEach(u => {
      const aStyles  = typeof getAgentStyles === 'function' ? getAgentStyles(u.agent_color) : { main: '#aaa' };
      const isOnline = parseInt(u.is_online) === 1;
      const dotColor = isOnline ? '#10b981' : 'rgba(255,255,255,0.18)';
      const name     = typeof formatName === 'function' ? formatName(u.username) : u.username;

      const pill = document.createElement('div');
      pill.style.cssText = [
        'display:flex', 'align-items:center', 'gap:5px',
        'padding:4px 12px 4px 9px',
        'border-radius:100px',
        `background:${aStyles.bg || 'rgba(255,255,255,0.04)'}`,
        `border:1px solid ${aStyles.main}88`,
        'font-size:11px',
        `color:${aStyles.main}`,
        'white-space:nowrap',
        `opacity:${isOnline ? '1' : '0.65'}`
      ].join(';');

      const dot = document.createElement('div');
      dot.style.cssText = [
        'width:6px', 'height:6px', 'border-radius:50%',
        `background:${dotColor}`,
        isOnline ? `box-shadow:0 0 7px ${dotColor}88` : ''
      ].join(';');

      pill.appendChild(dot);
      pill.appendChild(document.createTextNode(name));
      pillsWrap.appendChild(pill);
    });
  }

  section.appendChild(pillsWrap);
  body.appendChild(section);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  _bindEsc(overlay);
  setTimeout(() => document.getElementById('broadcast-office-input')?.focus(), 80);
};