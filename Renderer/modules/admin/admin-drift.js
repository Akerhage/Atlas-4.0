// ============================================
// modules/admin/admin-drift.js
// VAD DEN GÖR: Admin — Drift & Säkerhet,
//              lås/upplåsning och sparning av
//              driftsinställningar
// ANVÄNDS AV: renderer.js, admin-config.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders              — renderer.js globals
// ============================================

// =====================================================================
// 📵 SPAM / BLOCKLIST-FUNKTIONER
// =====================================================================
async function _loadSpamBlocklist() {
  const wrap = document.getElementById('spam-blocklist-wrap');
  if (!wrap) return;
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/email-blocklist`, { headers: fetchHeaders });
    const rows = await res.json();
    if (!rows.length) {
      wrap.innerHTML = '<p style="color:var(--text-secondary);font-size:12px;opacity:0.5;margin:0;">Inga blockerade adresser eller domäner.</p>';
      return;
    }
    wrap.innerHTML = rows.map(r => `
      <div style="display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px;
        background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); font-size:12px;">
        <span style="font-size:14px;">${r.type === 'domain' ? '🌐' : '✉️'}</span>
        <span style="flex:1; color:var(--text-primary); font-family:monospace;">${r.pattern}</span>
        <span style="color:var(--text-secondary); font-size:11px; opacity:0.5; white-space:nowrap;">${r.added_by || ''}</span>
        <button onclick="window._deleteSpamEntry(${r.id}, this)"
          style="padding:3px 8px; border-radius:5px; background:rgba(255,50,50,0.1);
          border:1px solid rgba(255,80,80,0.25); color:#ff6b6b; cursor:pointer; font-size:12px;
          flex-shrink:0;">✕</button>
      </div>
    `).join('');
  } catch(e) {
    const w = document.getElementById('spam-blocklist-wrap');
    if (w) w.innerHTML = '<p style="color:#ff6b6b;font-size:12px;margin:0;">Kunde inte ladda blocklista.</p>';
  }
}
window._loadSpamBlocklist = _loadSpamBlocklist;

window._deleteSpamEntry = async function(id, btn) {
  btn.textContent = '⏳';
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/email-blocklist/${id}`, {
      method: 'DELETE', headers: fetchHeaders
    });
    if (!res.ok) throw new Error('Fel');
    if (typeof showToast === 'function') showToast('✅ Borttagen från blocklistan');
    window._loadSpamBlocklist();
  } catch(e) {
    alert('Kunde inte ta bort: ' + e.message);
    btn.textContent = '✕';
  }
};

window._openAddSpamModal = async function() {
  const pattern = await atlasPrompt(
    '📵 Lägg till i blocklistan',
    'Ange e-postadress eller domän att blockera.\nExempel: spam@example.com eller example.com'
  );
  if (!pattern || !pattern.trim()) return;
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/email-blocklist`, {
      method: 'POST',
      headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: pattern.trim() })
    });
    const data = await res.json();
    if (data.error) { alert('Fel: ' + data.error); return; }
    if (typeof showToast === 'function') showToast(`✅ ${data.pattern} tillagd i blocklistan`);
    window._loadSpamBlocklist();
  } catch(e) {
    alert('Kunde inte lägga till: ' + e.message);
  }
};

function unlockDriftField(id, field) {
const inp = document.getElementById(`drift-${id}`);
const lockBtn = document.getElementById(`drift-lock-${id}`);
const saveBtn = document.getElementById(`drift-save-${id}`);
const toggleBtn = document.getElementById(`drift-toggle-${id}`);
if (!lockBtn) return;
if (inp) { inp.disabled = false; if (inp.type !== 'checkbox') inp.focus(); }
if (toggleBtn) toggleBtn.style.pointerEvents = 'auto';
lockBtn.textContent = '🔓 Låst upp';
lockBtn.classList.add('unlocked');
if (saveBtn) saveBtn.style.display = 'inline-block';
lockBtn.onclick = () => {
if (inp) inp.disabled = true;
if (toggleBtn) toggleBtn.style.pointerEvents = 'none';
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockDriftField(id, field);
if (saveBtn) saveBtn.style.display = 'none';
};
}

function _driftToggle(id) {
const inp = document.getElementById(`drift-${id}`);
const toggleBtn = document.getElementById(`drift-toggle-${id}`);
if (!inp || inp.disabled) return;
inp.checked = !inp.checked;
_driftUpdateToggleBtn(toggleBtn, inp.checked);
}

function _driftUpdateToggleBtn(btn, isActive) {
if (!btn) return;
if (isActive) {
btn.textContent = '● Aktiverad';
btn.style.color = '#4cd964';
btn.style.background = 'rgba(76,217,100,0.12)';
btn.style.border = '1px solid rgba(76,217,100,0.4)';
} else {
btn.textContent = 'Avaktiverad';
btn.style.color = 'var(--text-secondary)';
btn.style.background = 'rgba(255,255,255,0.05)';
btn.style.border = '1px solid rgba(255,255,255,0.12)';
}
}

async function saveDriftFieldAndLock(id, field) {
const inp = document.getElementById(`drift-${id}`);
const lockBtn = document.getElementById(`drift-lock-${id}`);
const saveBtn = document.getElementById(`drift-save-${id}`);
const toggleBtn = document.getElementById(`drift-toggle-${id}`);
if (!inp) return;
const value = inp.type === 'checkbox' ? inp.checked.toString() : inp.value.trim();
await saveDriftSetting(field, value);
if (inp) inp.disabled = true;
if (toggleBtn) toggleBtn.style.pointerEvents = 'none';
if (lockBtn) {
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockDriftField(id, field);
}
if (saveBtn) saveBtn.style.display = 'none';
}

async function saveDriftSetting(field, value) {
try {
const res = await fetch(`${SERVER_URL}/api/admin/operation-settings`, {
method: 'POST',
headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ field, value })
});
if (!res.ok) throw new Error('Save failed');
} catch (e) {
alert('Kunde inte spara inställning: ' + e.message);
}
}

function renderDriftSecuritySection(detailBox, s) {
function buildDriftLockRow(id, field, label, value, inputType) {
if (inputType === 'checkbox') {
const checked = value === true || value === 'true';
const pillColor    = checked ? '#4cd964' : 'var(--text-secondary)';
const pillBg       = checked ? 'rgba(76,217,100,0.12)' : 'rgba(255,255,255,0.05)';
const pillBorder   = checked ? '1px solid rgba(76,217,100,0.4)' : '1px solid rgba(255,255,255,0.12)';
const pillText     = checked ? '● Aktiverad' : 'Avaktiverad';
return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">${label}</label>
<div style="display:flex; align-items:center; gap:12px; width:100%;">
<input type="checkbox" id="drift-${id}" ${checked ? 'checked' : ''} disabled style="display:none;">
<button id="drift-toggle-${id}"
onclick="_driftToggle('${id}')"
style="pointer-events:none; cursor:pointer; padding:5px 14px; border-radius:20px;
font-size:13px; font-weight:600; transition:all 0.2s;
color:${pillColor}; background:${pillBg}; border:${pillBorder};">
${pillText}
</button>
<button class="admin-lock-btn" id="drift-lock-${id}" style="margin-left:auto;" onclick="unlockDriftField('${id}','${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="drift-save-${id}" onclick="saveDriftFieldAndLock('${id}','${field}')">Spara</button>
</div>
</div>`;
}
const extraStyle = inputType === 'number' ? 'width:80px;' : inputType === 'jwt' ? 'width:120px;' : 'flex:1;';
const actualType = inputType === 'jwt' ? 'text' : inputType;
const extras = inputType === 'number' ? (id === 'upload-ttl' ? 'min="1" max="3650"' : 'min="1" max="168"') : '';
return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">${label}</label>
<div style="display:flex; align-items:center; gap:8px; width:100%;">
<input type="${actualType}" id="drift-${id}" class="admin-config-field" value="${value}" ${extras} style="${extraStyle}" disabled>
<button class="admin-lock-btn" id="drift-lock-${id}" style="margin-left:auto;" onclick="unlockDriftField('${id}','${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="drift-save-${id}" onclick="saveDriftFieldAndLock('${id}','${field}')">Spara</button>
</div>
</div>`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🛡️ Drift & Säkerhet</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
Driftkritiska inställningar som påverkar systemets beteende direkt: hur ofta databasen säkerhetskopieras, var kopian sparas och hur länge inloggningssessioner gäller.
</p>
<div style="font-size:11px; color:#ff6b6b; background:rgba(255,107,107,0.08); border:1px solid rgba(255,107,107,0.25); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Felaktiga ändringar här kan påverka systemets tillgänglighet och datasäkerhet. Ändra endast om du vet vad du gör.</span>
</div>
${buildDriftLockRow('backup-path', 'backup_path', 'Backup-sökväg', s.backup_path, 'text')}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:-14px 0 18px 0;">Mappen på servern där databaskopior sparas automatiskt. Sökvägen måste vara skrivbar av serverkontot.</p>
${buildDriftLockRow('backup-interval', 'backup_interval_hours', 'Backup-intervall (timmar)', s.backup_interval_hours, 'number')}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:-14px 0 18px 0;">Hur ofta Atlas automatiskt skapar en kopia av databasen. Anges i timmar — standard är 12.</p>
${buildDriftLockRow('upload-ttl', 'upload_ttl_days', 'Fillagring (dagar)', s.upload_ttl_days || 90, 'number')}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:-14px 0 4px 0;">Antal dagar kunduppladdade filer sparas på servern. Filer raderas automatiskt efter detta. Standard: 90 dagar.</p>
<div style="display:flex; align-items:center; justify-content:space-between;
  cursor:pointer; user-select:none; margin-top:14px; margin-bottom:0;"
  onclick="
    const body = document.getElementById('files-section-body');
    const arrow = document.getElementById('files-section-arrow');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    arrow.textContent = isOpen ? '▶' : '▼';
  ">
  <h4 style="margin:0; font-size:12px; text-transform:uppercase;
    letter-spacing:0.5px; color:var(--accent-primary);">
    📁 Uppladdade filer
  </h4>
  <span id="files-section-arrow" style="color:var(--accent-primary);
    font-size:11px;">▶</span>
</div>

<div id="files-section-body" style="display:none; margin-top:12px; margin-bottom:6px;">
  <p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 12px 0;">
    Filer uppladdade av kunder och agenter. Sorteras på utgångsdatum.
    Raderas automatiskt efter ${s.upload_ttl_days || 90} dagar.
  </p>
  <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; align-items:center;">
    <input type="text" id="files-search" placeholder="Sök på kund, ärende eller filnamn..."
      style="flex:1; min-width:180px; padding:7px 12px; border-radius:8px;
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12);
      color:var(--text-primary); font-size:12px; outline:none;">
    <select id="files-sort" style="padding:7px 10px; border-radius:8px;
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12);
      color:var(--text-primary); font-size:12px; outline:none;">
      <option value="expires_asc">Utgår snart först</option>
      <option value="expires_desc">Senast utgående först</option>
      <option value="uploaded_desc">Nyast uppladdad</option>
      <option value="customer_asc">Kundnamn A-Ö</option>
    </select>
    <button id="files-download-all"
      style="padding:7px 12px; border-radius:8px; font-size:12px; cursor:pointer;
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
      color:var(--text-primary);">⬇ Ladda ner alla</button>
    <button id="files-delete-all"
      style="padding:7px 12px; border-radius:8px; font-size:12px; cursor:pointer;
      background:rgba(255,50,50,0.12); border:1px solid rgba(255,80,80,0.3);
      color:#ff6b6b;">🗑 Radera allt</button>
  </div>
  <div id="files-list" style="display:flex; flex-direction:column; gap:6px;
    max-height:340px; overflow-y:auto;">
    <p style="color:var(--text-secondary); font-size:12px;">Laddar filer...</p>
  </div>
</div>
<hr style="border:none; border-top:1px solid rgba(255,255,255,0.07); margin:24px 0;">
${buildDriftLockRow('jwt', 'jwt_expires_in', 'Sessionslängd (t.ex. 24h eller 7d)', s.jwt_expires_in, 'jwt')}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:-14px 0 18px 0;">Hur länge en agent är inloggad innan systemet automatiskt loggar ut. Ange t.ex. "24h" för ett dygn eller "7d" för en vecka.</p>
${buildDriftLockRow('auto-exit', 'auto_human_exit', 'Auto-återgång till AI', s.auto_human_exit, 'checkbox')}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:-14px 0 18px 0;">Återgår automatiskt till AI-läge när alla aktiva ärenden har stängts. Avaktivera om du vill styra detta manuellt.</p>
<hr style="border:none; border-top:1px solid rgba(255,255,255,0.07); margin:24px 0;">
<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase;
letter-spacing:0.5px; color:var(--accent-primary); display:flex; align-items:center; gap:7px;">
${UI_ICONS.BROADCAST} Skicka systemmeddelande</h4>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 12px 0;">
  Skickar ett popup-meddelande med plingljud till alla agenter som är inloggade just nu.
</p>
<textarea id="broadcast-message-input" rows="3"
placeholder="Skriv ditt meddelande här..."
style="width:100%; box-sizing:border-box; padding:10px 12px; border-radius:8px;
resize:vertical; border:1px solid rgba(255,255,255,0.12);
background:rgba(255,255,255,0.04); color:var(--text-primary);
font-size:13px; font-family:inherit; outline:none; margin-bottom:10px;"></textarea>
<div style="display:flex; align-items:center; gap:12px;">
<button id="broadcast-send-btn" title="Skicka till alla agenter"
style="display:flex; align-items:center; justify-content:center; padding:9px 14px; border-radius:8px;
background:var(--accent-primary); color:var(--text-primary); border:none; cursor:pointer;">${UI_ICONS.SEND}</button>
<span id="broadcast-confirm"
style="display:none; font-size:12px; color:#4cd964;">✅ Skickat!</span>
</div>
</div>
</div>
`;

// === FILHANTERING ===
let _allFiles = [];

// Försök rätta till felkodad UTF-8 (Windows/multer-artefakt)
function _fixEncoding(str) {
  if (!str) return str;
  try {
    return decodeURIComponent(escape(str));
  } catch(e) {
    return str;
  }
}

function _renderFileList(files) {
  const list = detailBox.querySelector('#files-list');
  if (!list) return;
  if (!files || files.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);font-size:12px;opacity:0.6;">Inga filer hittades.</p>';
    return;
  }
  list.innerHTML = files.map(f => {
    const expDate  = f.expires_at  ? new Date(f.expires_at  * 1000).toLocaleDateString('sv-SE') : '—';
    const customer = f.customer_name || f.customer_email || f.conversation_id || '—';
    const subject  = f.subject || '(inget ämne)';
    const fname = _fixEncoding(f.original_name) || f.filename;
    const isExpiringSoon = f.expires_at && (f.expires_at * 1000 - Date.now()) < 7 * 86400000;
    return `
    <div style="display:flex; align-items:center; gap:10px; padding:9px 12px;
      border-radius:8px; background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.07); font-size:12px;">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; color:var(--text-primary);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
          title="${fname}">${fname}</div>
        <div style="color:var(--text-secondary); opacity:0.7; margin-top:2px;">
          ${customer} · ${subject}
        </div>
      </div>
      <div style="white-space:nowrap; color:${isExpiringSoon ? '#ff9f43' : 'var(--text-secondary)'};
        font-size:11px; opacity:0.8;">
        Utgår: ${expDate}
      </div>
      <a href="${SERVER_URL}/uploads/${f.filename}" download="${fname}"
        title="Ladda ner ${fname}"
        style="padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.06);
        border:1px solid rgba(255,255,255,0.12); color:var(--text-primary);
        text-decoration:none; font-size:14px; flex-shrink:0;">⬇</a>
      <button onclick="window._deleteFile(${f.id}, this)"
        title="Radera ${fname}"
        style="padding:5px 8px; border-radius:6px; background:rgba(255,50,50,0.1);
        border:1px solid rgba(255,80,80,0.25); color:#ff6b6b;
        cursor:pointer; font-size:14px; flex-shrink:0;">🗑</button>
    </div>`;
  }).join('');
}

window._filterAndSort = function() {
  const search = (detailBox.querySelector('#files-search')?.value || '').toLowerCase();
  const sort   = detailBox.querySelector('#files-sort')?.value || 'expires_asc';
  let filtered = _allFiles.filter(f => {
    if (!search) return true;
    return (f.original_name || '').toLowerCase().includes(search) ||
           (f.customer_name || '').toLowerCase().includes(search) ||
           (f.customer_email || '').toLowerCase().includes(search) ||
           (f.subject || '').toLowerCase().includes(search) ||
           (f.conversation_id || '').toLowerCase().includes(search);
  });
  filtered.sort((a, b) => {
    if (sort === 'expires_asc')   return (a.expires_at || 0) - (b.expires_at || 0);
    if (sort === 'expires_desc')  return (b.expires_at || 0) - (a.expires_at || 0);
    if (sort === 'uploaded_desc') return (b.uploaded_at || 0) - (a.uploaded_at || 0);
    if (sort === 'customer_asc') {
      const ca = (a.customer_name || a.customer_email || '').toLowerCase();
      const cb = (b.customer_name || b.customer_email || '').toLowerCase();
      return ca.localeCompare(cb, 'sv');
    }
    return 0;
  });
  _renderFileList(filtered);
};

window._deleteFile = async function(id, btn) {
  btn.textContent = '⏳';
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/uploaded-files/${id}`, {
      method: 'DELETE', headers: fetchHeaders
    });
    if (!res.ok) throw new Error('Fel vid radering');
    _allFiles = _allFiles.filter(f => f.id !== id);
    window._filterAndSort();
    if (typeof showToast === 'function') showToast('🗑 Fil raderad');
  } catch (e) {
    alert('Kunde inte radera: ' + e.message);
    btn.textContent = '🗑';
  }
};

async function _loadFiles() {
  try {
    const res  = await fetch(`${SERVER_URL}/api/admin/uploaded-files`, { headers: fetchHeaders });
    const data = await res.json();
    _allFiles  = data.files || [];
    window._filterAndSort();
  } catch (e) {
    const list = detailBox.querySelector('#files-list');
    if (list) list.innerHTML = '<p style="color:#ff6b6b;font-size:12px;">Kunde inte ladda filer.</p>';
  }
}

const filesSearch = detailBox.querySelector('#files-search');
const filesSort   = detailBox.querySelector('#files-sort');
if (filesSearch) filesSearch.addEventListener('input', window._filterAndSort);
if (filesSort)   filesSort.addEventListener('change', window._filterAndSort);

const dlAllBtn = detailBox.querySelector('#files-download-all');
if (dlAllBtn) {
  dlAllBtn.onclick = () => {
    const search = (detailBox.querySelector('#files-search')?.value || '').toLowerCase();
    const visible = _allFiles.filter(f =>
      !search ||
      (f.original_name || '').toLowerCase().includes(search) ||
      (f.customer_name || '').toLowerCase().includes(search) ||
      (f.subject || '').toLowerCase().includes(search)
    );
    visible.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = `${SERVER_URL}/uploads/${f.filename}`;
        a.download = f.original_name || f.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  };
}

const delAllBtn = detailBox.querySelector('#files-delete-all');
if (delAllBtn) {
  delAllBtn.onclick = async () => {
    if (!confirm(`Radera ALLA ${_allFiles.length} filer permanent? Detta går inte att ångra.`)) return;
    delAllBtn.textContent = '⏳';
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/uploaded-files`, {
        method: 'DELETE', headers: fetchHeaders
      });
      if (!res.ok) throw new Error('Fel');
      _allFiles = [];
      _renderFileList([]);
      delAllBtn.textContent = '✅ Klart';
      setTimeout(() => { delAllBtn.textContent = '🗑 Radera allt'; }, 3000);
    } catch (e) {
      alert('Kunde inte radera: ' + e.message);
      delAllBtn.textContent = '🗑 Radera allt';
    }
  };
}

_loadFiles();

// Broadcast-knapp logik
const broadcastBtn = detailBox.querySelector('#broadcast-send-btn');
const broadcastInput = detailBox.querySelector('#broadcast-message-input');
const broadcastConfirm = detailBox.querySelector('#broadcast-confirm');
if (broadcastBtn && broadcastInput) {
  broadcastBtn.onclick = () => {
    const msg = broadcastInput.value.trim();
    if (!msg) return;
    broadcastBtn.disabled = true;
    window.socketAPI.emit('admin:broadcast', { message: msg });
    broadcastInput.value = '';
    if (broadcastConfirm) {
      broadcastConfirm.style.display = 'inline';
      setTimeout(() => { broadcastConfirm.style.display = 'none'; }, 3000);
    }
    setTimeout(() => { broadcastBtn.disabled = false; }, 2000);
  };
}
}