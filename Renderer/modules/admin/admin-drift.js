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
console.log(`[Drift] ${field} = ${value}`);
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
const extras = inputType === 'number' ? 'min="1" max="168"' : '';
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
Driftkritiska inställningar som påverkar systemets beteende direkt: hur ofta databasen säkerhetskopieras, var kopian sparas, hur länge inloggningssessioner gäller och om IMAP-polling för inkommande e-post ska vara aktiv.
</p>
<div style="font-size:11px; color:#ff6b6b; background:rgba(255,107,107,0.08); border:1px solid rgba(255,107,107,0.25); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Felaktiga ändringar här kan påverka systemets tillgänglighet och datasäkerhet. Ändra endast om du vet vad du gör.</span>
</div>
${buildDriftLockRow('imap', 'imap_enabled', 'IMAP-polling (e-post)', s.imap_enabled, 'checkbox')}
${buildDriftLockRow('imap-inbound', 'imap_inbound', 'Inkommande mail skapar nya ärenden (Intercom)', s.imap_inbound, 'checkbox')}
${buildDriftLockRow('backup-interval', 'backup_interval_hours', 'Backup-intervall (timmar)', s.backup_interval_hours, 'number')}
${buildDriftLockRow('backup-path', 'backup_path', 'Backup-sökväg', s.backup_path, 'text')}
${buildDriftLockRow('jwt', 'jwt_expires_in', 'JWT-livslängd (t.ex. 24h, 7d)', s.jwt_expires_in, 'jwt')}
${buildDriftLockRow('auto-exit', 'auto_human_exit', 'Auto-Human-Exit (återgå till AI när alla ärenden stängs)', s.auto_human_exit, 'checkbox')}
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