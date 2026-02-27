// ============================================
// modules/admin/admin-forms.js
// VAD DEN GÖR: Admin — formulär för att skapa
//              nya agenter och kontor
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders, currentUser,         — renderer.js globals
//   officeData, usersCache,                        — renderer.js globals
//   window._adminFormDirty, window._newAgentState, — renderer.js globals
//   window._newOfficePrices, window._newOfficeColor— renderer.js globals
//   ADMIN_UI_ICONS, UI_ICONS, AVATAR_ICONS         — ui-constants.js
//   getAgentStyles, resolveLabel, showToast        — styling-utils.js
//   atlasConfirm                                   — renderer.js
//   renderAdminUserList                            — admin-users.js
//   renderAdminOfficeList                          — admin-offices.js
//   openAdminUserDetail                            — admin-users.js
//   openAdminOfficeDetail                          — admin-offices.js
// ============================================

// =============================================================================
// ADMIN: WINDOW FUNKTIONER & HJÄLPLOGIK
// =============================================================================
// =============================================================================
// OpenNewAgentForm (inline i detaljvyn) 25/2
// =============================================================================
window.openNewAgentForm = async function(editUser = null) {
window._adminFormDirty = false;
const styles = getAgentStyles();
const isEdit = !!editUser;

// Lokalt state för formuläret (closure) - anpassas om vi redigerar
let _avatarId = isEdit ? (editUser.avatar_id ?? 0) : 0;
const activeColor = isEdit ? editUser.agent_color : '#0071e3';

document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;
placeholder.style.display = 'none';
detailBox.style.display = 'flex';

// Hämta kontor
let offices = [];
try {
const r = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
if (r.ok) offices = await r.json();
} catch (_) {}

// Bygg avatar-grid HTML
const avatarGridHTML = AVATAR_ICONS.map((svg, i) => {
const isSelected = i === _avatarId;
const color = isEdit ? editUser.agent_color : '#0071e3';
return `
<div class="new-agent-avatar-opt ${isSelected ? 'nao-selected' : ''}" data-id="${i}" style="cursor:pointer;padding:8px;border-radius:10px;border:2px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'};background:${isSelected ? color + '15' : 'rgba(255,255,255,0.03)'};display:flex;align-items:center;justify-content:center;color:${isSelected ? color : 'rgba(255,255,255,0.35)'};transition:all 0.15s;width:36px;height:36px;box-sizing:border-box;">
<span style="display:flex;width:20px;height:20px;">${svg}</span>
</div>`}).join('');

// Bygg kontors-badges HTML
const officeBadgesHTML = offices.map(o => {
const isChecked = isEdit && editUser.routing_tag && editUser.routing_tag.split(',').map(t => t.trim()).includes(o.routing_tag);
const color = isEdit ? editUser.agent_color : '#0071e3';
return `
<label class="new-agent-office-label" style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:6px 10px;border-radius:8px;background:${isChecked ? color + '22' : 'rgba(255,255,255,0.03)'};border:1px solid ${isChecked ? color : 'rgba(255,255,255,0.07)'};transition:all 0.15s; color:${isChecked ? 'white' : 'inherit'};">
<input type="checkbox" class="new-agent-office-cb" value="${adminEscapeHtml(o.routing_tag)}" data-city="${adminEscapeHtml(o.city)}" ${isChecked ? 'checked' : ''} style="accent-color:${color};width:14px;height:14px;" onchange="window._toggleNewAgentOffice(this);">
<span>${adminEscapeHtml(o.city)}${o.area ? ' – ' + adminEscapeHtml(o.area) : ''}</span>
</label>`}).join('');

detailBox.innerHTML = `
<div class="detail-container" style="padding:24px;width:100%;overflow-y:auto;box-sizing:border-box;">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:16px;">
<h2 style="margin:0;font-size:18px;color:white;font-weight:700;">${isEdit ? 'Redigera agent' : 'Skapa ny agent'}</h2>
<div style="display:flex;gap:8px;">
<button class="btn-glass-icon" style="color: ${styles.main}; border-color: ${styles.main}66;" onclick="saveNewAgent(${isEdit ? "'" + editUser.id + "'" : 'null'})" title="Spara agent">${ADMIN_UI_ICONS.SAVE}</button>
<button class="btn-glass-icon" style="color:#ff453a;border-color:rgba(255,69,58,0.4);" onclick="renderAdminUserList();document.getElementById('admin-placeholder').style.display='flex';document.getElementById('admin-detail-content').style.display='none';" title="Avbryt">${ADMIN_UI_ICONS.CANCEL}</button>
</div>
</div>

<!-- 2-kolumnslayout -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">

<!-- Vänster: Baskonfiguration -->
<div style="display:flex;flex-direction:column;gap:16px;">

<!-- Live avatar-preview (med inbyggd färgväljare) -->
<div style="display:flex;align-items:center;gap:16px;padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);">
<div id="new-agent-avatar-preview" style="width:64px;height:64px;border-radius:50%;background:${activeColor};display:flex;align-items:center;justify-content:center;color:white;font-size:26px;font-weight:700;box-shadow:0 0 20px ${activeColor}66;flex-shrink:0;transition:background 0.2s,box-shadow 0.2s;">
${isEdit ? `<span style="display:flex;width:32px;height:32px;color:white;">${AVATAR_ICONS[_avatarId]}</span>` : 'A'}
</div>
<div style="flex:1;min-width:0;">
<div id="new-agent-preview-name" style="font-size:14px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isEdit ? (editUser.display_name || editUser.username) : 'Ny agent'}</div>
<div id="new-agent-preview-role" style="font-size:11px;opacity:0.5;margin-top:2px;">${isEdit ? editUser.role.toUpperCase() : 'Agent'}</div>
</div>
<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;">
<input type="color" id="new-agent-color" value="${activeColor}"
style="width:34px;height:34px;border:none;background:transparent;cursor:pointer;border-radius:8px;padding:2px;"
title="Välj accentfärg" oninput="window._updateNewAgentColor(this.value);">
<span id="new-agent-color-hex" style="font-family:monospace;font-size:10px;opacity:0.5;">${activeColor}</span>
</div>
</div>

<!-- Användarnamn -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Användarnamn *</label>
<input id="new-agent-username" class="filter-input" type="text" value="${isEdit ? editUser.username : ''}" ${isEdit ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'placeholder="t.ex. anna.karlsson"'}
oninput="window._adminFormDirty=true; const prev=document.getElementById('new-agent-avatar-preview'); if(prev&&!prev.querySelector('svg'))prev.textContent=this.value.charAt(0).toUpperCase()||'A'; const dn=document.getElementById('new-agent-displayname'); if(dn&&!dn._touched){dn.placeholder='t.ex. Anna Karlsson'; document.getElementById('new-agent-preview-name').textContent=this.value||'Ny agent';}">
</div>

<!-- Visningsnamn -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Visningsnamn</label>
<input id="new-agent-displayname" class="filter-input" type="text" value="${isEdit ? (editUser.display_name || '') : ''}" placeholder="t.ex. Anna Karlsson"
oninput="window._adminFormDirty=true; this._touched=true; document.getElementById('new-agent-preview-name').textContent=this.value||document.getElementById('new-agent-username').value||'Ny agent';">
</div>

<!-- Lösenord -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Lösenord ${isEdit ? '(lämna tomt för att behålla)' : '*'}</label>
<input id="new-agent-password" class="filter-input" type="password" placeholder="${isEdit ? 'Nytt lösenord' : 'Välj ett starkt lösenord'}"
oninput="window._adminFormDirty=true; window._checkNewAgentPw();">
</div>

<!-- Bekräfta lösenord -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Bekräfta lösenord ${isEdit ? '' : '*'}</label>
<input id="new-agent-password2" class="filter-input" type="password" placeholder="Upprepa lösenordet"
oninput="window._adminFormDirty=true; window._checkNewAgentPw();">
<div id="pw-match-indicator" style="font-size:11px;margin-top:5px;height:14px;"></div>
</div>

<!-- Roll -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Roll</label>
<select id="new-agent-role" class="filter-input" style="cursor:pointer;"
onchange="document.getElementById('new-agent-preview-role').textContent=this.options[this.selectedIndex].text; window._adminFormDirty=true;">
<option value="agent" ${isEdit && editUser.role === 'agent' ? 'selected' : ''}>Agent</option>
<option value="support" ${isEdit && (editUser.role === 'support' || editUser.role === 'admin') ? 'selected' : ''}>Support / Admin</option>
</select>
</div>

</div>

<!-- Höger: Avatar-väljare + Kontor -->
<div style="display:flex;flex-direction:column;gap:20px;">

<!-- Avatar-grid -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:10px;letter-spacing:0.05em;">Välj avatar</label>
<div id="new-agent-avatar-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
${avatarGridHTML}
</div>
</div>

<!-- Kopplade kontor -->
${offices.length ? `<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:10px;letter-spacing:0.05em;">Kopplade kontor</label>
<div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto;padding-right:4px;">
${officeBadgesHTML}
</div>
</div>` : ''}

</div>
</div>
</div>`;

// Lösenordsmatch-validator
window._checkNewAgentPw = function() {
const pw1 = document.getElementById('new-agent-password')?.value || '';
const pw2 = document.getElementById('new-agent-password2')?.value || '';
const ind = document.getElementById('pw-match-indicator');
if (!ind) return;
if (!pw2) { ind.textContent = ''; return; }
if (pw1 === pw2) { ind.textContent = '✓ Lösenorden matchar'; ind.style.color = '#4cd964'; }
else { ind.textContent = '✗ Lösenorden matchar inte'; ind.style.color = '#ff453a'; }
};

// Kontors-toggle: visuell feedback + toast
window._toggleNewAgentOffice = function(cb) {
const label = cb.closest('.new-agent-office-label');
const city = cb.dataset.city || cb.value;
const color = document.getElementById('new-agent-color')?.value || '#0071e3';
window._adminFormDirty = true;
if (cb.checked) {
if (label) {
label.style.background = color + '22';
label.style.borderColor = color;
label.style.color = 'white';
}
showToast(`📍 Kontor tillagt: ${city}`);
} else {
if (label) {
label.style.background = 'rgba(255,255,255,0.03)';
label.style.borderColor = 'rgba(255,255,255,0.07)';
label.style.color = '';
}
showToast(`🗑️ Kontor borttaget: ${city}`);
}
};

// Färg + avatar-preview-uppdatering
window._updateNewAgentColor = function(color) {
document.getElementById('new-agent-color-hex').textContent = color;
window._adminFormDirty = true;
const prev = document.getElementById('new-agent-avatar-preview');
if (prev) { prev.style.background = color; prev.style.boxShadow = `0 0 20px ${color}66`; }
// Uppdatera vald avatar-ikon i grid
document.querySelectorAll('.new-agent-avatar-opt.nao-selected').forEach(el => {
el.style.color = color;
el.style.borderColor = color;
el.style.background = color + '26';
});
// Uppdatera redan valda kontors-badges till ny färg
document.querySelectorAll('.new-agent-office-cb:checked').forEach(cb => {
const label = cb.closest('.new-agent-office-label');
if (label) { label.style.background = color + '22'; label.style.borderColor = color; }
});
};

// Avatar-grid klick-hantering
const avatarGrid = document.getElementById('new-agent-avatar-grid');
if (avatarGrid) {
// Om vi inte redigerar, markera första som vald som standard. 
// Om vi redigerar sköts detta redan av avatarGridHTML.
if (!isEdit) {
const first = avatarGrid.querySelector('.new-agent-avatar-opt');
if (first) first.classList.add('nao-selected');
_avatarId = 0;
}

avatarGrid.addEventListener('click', function(e) {
const opt = e.target.closest('.new-agent-avatar-opt');
if (!opt) return;
_avatarId = parseInt(opt.dataset.id);
const color = document.getElementById('new-agent-color')?.value || '#0071e3';

// Återställ alla, markera vald
avatarGrid.querySelectorAll('.new-agent-avatar-opt').forEach(el => {
el.classList.remove('nao-selected');
el.style.borderColor = 'rgba(255,255,255,0.08)';
el.style.background = 'rgba(255,255,255,0.03)';
el.style.color = 'rgba(255,255,255,0.35)';
});
opt.classList.add('nao-selected');
opt.style.borderColor = color;
opt.style.background = color + '26';
opt.style.color = color;

// Visa vald avatar i preview-bubblan
const prev = document.getElementById('new-agent-avatar-preview');
if (prev) {
prev.style.background = color;
prev.style.boxShadow = `0 0 20px ${color}66`;
prev.innerHTML = `<span style="display:flex;width:32px;height:32px;color:white;">${AVATAR_ICONS[_avatarId]}</span>`;
}
window._adminFormDirty = true;
});
}

// Exponera avatar-id för saveNewAgent
window._newAgentState = { getAvatarId: () => _avatarId };
};

// ======================================================
// SPARA AGENT (Hybrid: Skapa & Uppdatera)
// ======================================================
window.saveNewAgent = async function(editUserId = null) {
const isEdit = !!editUserId;
const username = (document.getElementById('new-agent-username')?.value || '').trim().toLowerCase();
const displayNameRaw = (document.getElementById('new-agent-displayname')?.value || '').trim();
const display_name = displayNameRaw || username;
const password = document.getElementById('new-agent-password')?.value || '';
const password2 = document.getElementById('new-agent-password2')?.value || '';
const role = document.getElementById('new-agent-role')?.value || 'agent';
const agentColor = document.getElementById('new-agent-color')?.value || '#0071e3';

// Hämta valt avatar-ID direkt från DOM (eftersom det är där vi sparar markeringen)
const selectedAvatar = document.querySelector('.new-agent-avatar-opt.nao-selected');
const avatarId = selectedAvatar ? parseInt(selectedAvatar.dataset.id) : 0;

// Samla valda kontor
const checkedOffices = document.querySelectorAll('.new-agent-office-cb:checked');
const routingTag = [...checkedOffices].map(cb => cb.value).filter(Boolean).join(',') || null;

// --- VALIDERING ---
if (!username) { showToast('Ange ett användarnamn.'); return; }

// Lösenord krävs bara vid nyskapande, eller om man faktiskt skrivit något i fältet
if (!isEdit && !password) { showToast('Ange ett lösenord för den nya agenten.'); return; }

if (password) {
if (password.length < 6) { showToast('Lösenordet måste vara minst 6 tecken.'); return; }
if (password !== password2) { showToast('Lösenorden matchar inte.'); return; }
}

// Bestäm endpoint och payload
const url = isEdit ? `${SERVER_URL}/api/admin/update-user-profile` : `${SERVER_URL}/api/admin/create-user`;
const payload = { 
username, 
role, 
display_name, 
agent_color: agentColor, 
avatar_id: avatarId, 
routing_tag: routingTag 
};

// Lägg bara till lösenordet i skicket om det faktiskt har ändrats/fyllts i
if (password) payload.password = password;
if (isEdit) payload.userId = editUserId;

try {
const res = await fetch(url, {
method: 'POST', 
headers: fetchHeaders,
body: JSON.stringify(payload)
});

if (res.ok) {
window._adminFormDirty = false;

// --- UPPDATERA LOKAL CACHE (Säkrar att UI:t stämmer direkt) ---
// Vi letar upp agenten i vår lokala cache och skriver över med de nya värdena
const cached = usersCache.find(u => u.username === username);
if (cached) {
cached.display_name = display_name;
cached.role = role;
cached.agent_color = agentColor;
cached.avatar_id = avatarId;
cached.routing_tag = routingTag;
} else if (!isEdit) {
// Om det är en helt ny agent kan vi behöva hämta hela listan på nytt
// eller pusha det nya objektet (renderAdminUserList gör oftast detta åt oss)
}

showToast(isEdit ? `✅ Profilen för @${username} är uppdaterad!` : `✅ Agenten @${username} skapad!`);

// 1. Rendera om listan till vänster (så färg/namn uppdateras där)
await renderAdminUserList();

renderMyTickets?.();
renderInbox?.();

// 2. Öppna detaljvyn igen (så headern och ikonerna uppdateras med den nya cachen)
openAdminUserDetail(username, null);

} else {
const err = await res.json().catch(() => ({}));
showToast('Fel: ' + (err.error || 'Kunde inte spara agenten.'));
}
} catch (e) { 
console.error("Save Agent Error:", e);
showToast('Anslutningsfel vid sparning.'); 
}
};

// ======================================================
// FIX 1c — openNewOfficeForm (inline i detaljvyn)
// ======================================================
window.openNewOfficeForm = async function() {
window._adminFormDirty = false;
window._newOfficePrices = [];
window._newOfficeColor = '#0071e3';

document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;
placeholder.style.display = 'none';
detailBox.style.display = 'flex';

// Paketmallar för tjänste-knappar
const PKG_TEMPLATES = {
'Bil': [
{ service_name: 'Testlektion BIL',   price: 0, currency: 'SEK', keywords: ['bil','testlektion','provlektion'] },
{ service_name: 'Körlektion Bil',    price: 0, currency: 'SEK', keywords: ['körlektion','bil','lektion'] },
{ service_name: 'Risk 1 BIL',        price: 0, currency: 'SEK', keywords: ['risk 1','riskettan','bil'] },
{ service_name: 'Risk 2 BIL',        price: 0, currency: 'SEK', keywords: ['risk 2','halkbana','bil'] },
{ service_name: 'Minipaket BIL',     price: 0, currency: 'SEK', keywords: ['minipaket','paket','bil'] },
{ service_name: 'Mellanpaket BIL',   price: 0, currency: 'SEK', keywords: ['mellanpaket','paket','bil'] },
{ service_name: 'Baspaket BIL',      price: 0, currency: 'SEK', keywords: ['baspaket','paket','bil'] },
],
'MC': [
{ service_name: 'Körlektion MC',     price: 0, currency: 'SEK', keywords: ['körlektion','mc','motorcykel','lektion'] },
{ service_name: 'Risk 1 MC',         price: 0, currency: 'SEK', keywords: ['risk 1','riskettan','mc'] },
{ service_name: 'Risk 2 MC',         price: 0, currency: 'SEK', keywords: ['risk 2','mc','knix'] },
],
'AM':   [{ service_name: 'AM Mopedutbildning', price: 0, currency: 'SEK', keywords: ['moped','am','moppekort'] }],
'Släp': [
{ service_name: 'B96 Paket',         price: 0, currency: 'SEK', keywords: ['b96','släp'] },
{ service_name: 'BE Paket',          price: 0, currency: 'SEK', keywords: ['be','släp'] },
],
};

// Hämta kontorlista för kopiera-dropdown
let templateOptions = '<option value="">Välj kontor att kopiera...</option>';
try {
const r = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
if (r.ok) {
const allOffices = await r.json();
templateOptions += allOffices.map(o => `<option value="${o.routing_tag}">${o.city}${o.area ? ' – ' + o.area : ''}</option>`).join('');
}
} catch (_) {}

detailBox.innerHTML = `
<div class="detail-container" style="padding:25px; width:100%; overflow-y:auto; box-sizing:border-box;">
<!-- Header -->
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:16px;">
<h2 style="margin:0; font-size:18px; color:white;">Nytt kontor</h2>
<div style="display:flex; gap:8px;">
<button id="no-save-btn" class="btn-glass-icon" style="color: ${oc}; border-color: ${oc}66;" onclick="saveNewOffice()" title="Spara">${ADMIN_UI_ICONS.SAVE}</button>
<button class="btn-glass-icon" style="color:#ff453a; border-color:rgba(255,69,58,0.4);" onclick="renderAdminOfficeList(); document.getElementById('admin-placeholder').style.display='flex'; document.getElementById('admin-detail-content').style.display='none';" title="Avbryt">${ADMIN_UI_ICONS.CANCEL}</button>
</div>
</div>

<!-- 2-kolumnsgrid -->
<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start;">

<!-- VÄNSTER KOLUMN -->
<div style="display:grid; gap:14px;">

<!-- Profil-cirkel + color picker -->
<div style="display:flex; align-items:center; gap:16px; padding:14px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);">
<div id="no-avatar-circle" style="width:64px; height:64px; border-radius:14px; background:#0071e3; display:flex; align-items:center; justify-content:center; color:white; font-size:28px; font-weight:700; box-shadow:0 0 20px rgba(0,113,227,0.4); flex-shrink:0; transition:background 0.2s;">N</div>
<div style="flex:1; min-width:0;">
<div id="no-preview-name" style="font-size:14px; font-weight:600; color:white;">Nytt kontor</div>
<div id="no-preview-tag" style="font-size:11px; opacity:0.5; margin-top:2px; font-family:monospace;">routing_tag</div>
</div>
<div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
<input type="color" id="no-color-picker" value="#0071e3"
style="width:34px; height:34px; border:none; background:transparent; cursor:pointer; border-radius:8px;"
oninput="window._noUpdateColor(this.value)">
<span id="no-color-hex" style="font-family:monospace; font-size:10px; opacity:0.5;">#0071e3</span>
</div>
</div>

<!-- Stad -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Stad *</label>
<input id="new-office-city" class="filter-input" type="text" placeholder="t.ex. Göteborg"
oninput="window._adminFormDirty=true; window._updateRoutingTagPreview(); window._noPreviewUpdate();">
</div>

<!-- Område -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Område</label>
<input id="new-office-area" class="filter-input" type="text" placeholder="t.ex. Ullevi (lämna tomt för centralt)"
oninput="window._adminFormDirty=true; window._updateRoutingTagPreview(); window._noPreviewUpdate();">
</div>

<!-- Routing Tag -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Routing Tag (auto-genereras)</label>
<input id="new-office-tag" class="filter-input" type="text" placeholder="auto"
oninput="window._adminFormDirty=true; document.getElementById('no-preview-tag').textContent=this.value||'routing_tag';">
</div>

<!-- Adress -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Adress</label>
<input id="new-office-address" class="filter-input" type="text" placeholder="Gatuadress, Postnummer Stad" oninput="window._adminFormDirty=true;">
</div>

<!-- Telefon -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Telefon</label>
<input id="new-office-phone" class="filter-input" type="text" placeholder="010-20 70 775" oninput="window._adminFormDirty=true;">
</div>

<!-- E-post -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">E-post</label>
<input id="new-office-email" class="filter-input" type="email" placeholder="hej@mydrivingacademy.com" oninput="window._adminFormDirty=true;">
</div>

<!-- Språk -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Språk (komma-separerade)</label>
<input id="new-office-languages" class="filter-input" type="text" placeholder="svenska, engelska" value="svenska, engelska" oninput="window._adminFormDirty=true;">
</div>

<!-- Beskrivning -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px;">Beskrivning</label>
<textarea id="new-office-desc" class="filter-input" rows="3" placeholder="Välkommen till oss..."
style="resize:vertical; font-family:inherit; line-height:1.5;" oninput="window._adminFormDirty=true;"></textarea>
</div>

</div><!-- /VÄNSTER -->

<!-- HÖGER KOLUMN -->
<div style="display:grid; gap:14px;">

<!-- Tjänster & Priser rubrik -->
<div style="font-size:11px; text-transform:uppercase; opacity:0.4; letter-spacing:0.08em; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.06);">Tjänster &amp; Priser</div>

<!-- Paket-knappar -->
<div style="display:flex; gap:8px; flex-wrap:wrap;">
<button class="btn-glass-small" onclick="window._noAddPackage('Bil')" style="font-size:12px;">+ Bil</button>
<button class="btn-glass-small" onclick="window._noAddPackage('MC')" style="font-size:12px;">+ MC</button>
<button class="btn-glass-small" onclick="window._noAddPackage('AM')" style="font-size:12px;">+ AM</button>
<button class="btn-glass-small" onclick="window._noAddPackage('Släp')" style="font-size:12px;">+ Släp</button>
</div>

<!-- Kopiera från kontor -->
<div>
<div style="font-size:10px; text-transform:uppercase; opacity:0.4; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
<div style="flex:1; height:1px; background:rgba(255,255,255,0.08);"></div>
<span>eller kopiera från</span>
<div style="flex:1; height:1px; background:rgba(255,255,255,0.08);"></div>
</div>
<select id="no-copy-select" class="filter-input" onchange="window._noLoadTemplate(this.value)">
${templateOptions}
</select>
</div>

<!-- Prislista -->
<div id="no-price-list" style="display:grid; gap:4px; max-height:400px; overflow-y:auto; padding-right:4px;">
<div style="font-size:12px; opacity:0.3; padding:10px 0; text-align:center;">Inga tjänster tillagda ännu.</div>
</div>

</div><!-- /HÖGER -->

</div><!-- /grid -->
</div>`;

// ──────── Hjälpfunktioner (window-scope) ────────

window._updateRoutingTagPreview = function() {
const city = document.getElementById('new-office-city')?.value || '';
const area = document.getElementById('new-office-area')?.value || '';
const tagEl = document.getElementById('new-office-tag');
if (!tagEl) return;
const clean = (s) => s.toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[^a-z0-9]/g,'');
const generated = area ? `${clean(city)}_${clean(area)}` : clean(city);
tagEl.value = generated;
const previewTag = document.getElementById('no-preview-tag');
if (previewTag) previewTag.textContent = generated || 'routing_tag';
};

window._noUpdateColor = function(hex) {
window._newOfficeColor = hex;
const circle = document.getElementById('no-avatar-circle');
if (circle) { circle.style.background = hex; circle.style.boxShadow = `0 0 20px ${hex}66`; }
const label = document.getElementById('no-color-hex');
if (label) label.textContent = hex;
};

window._noPreviewUpdate = function() {
const city = document.getElementById('new-office-city')?.value || '';
const area = document.getElementById('new-office-area')?.value || '';
const circle = document.getElementById('no-avatar-circle');
if (circle) circle.textContent = (city.charAt(0) || 'N').toUpperCase();
const nameEl = document.getElementById('no-preview-name');
if (nameEl) nameEl.textContent = city ? (area ? `${city} – ${area}` : city) : 'Nytt kontor';
};

window._noAddPackage = function(type) {
const templates = PKG_TEMPLATES[type] || [];
const existing = new Set(window._newOfficePrices.map(p => p.service_name));
const toAdd = templates.filter(p => !existing.has(p.service_name));
window._newOfficePrices.push(...toAdd);
window._noRenderPriceList();
};

window._noLoadTemplate = async function(tag) {
if (!tag) return;
try {
const r = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders });
if (!r.ok) { showToast('Kunde inte läsa kontorsdata.'); return; }
const data = await r.json();
const prices = data.prices || [];
const cityKey = (data.city || '').toLowerCase();
const areaKey = (data.area || '').toLowerCase();
const stopWords = new Set([cityKey, areaKey, 'my', 'mårtenssons', 'trafikskola', 'my driving academy'].filter(k => k));
window._newOfficePrices = prices.map(p => ({
...p,
keywords: (p.keywords || []).filter(kw => !stopWords.has(kw.toLowerCase()))
}));
window._noRenderPriceList();
// Återställ dropdown
const sel = document.getElementById('no-copy-select');
if (sel) sel.value = '';
} catch (_) { showToast('Anslutningsfel vid kopiering.'); }
};

window._noRemovePrice = function(idx) {
window._newOfficePrices.splice(idx, 1);
window._noRenderPriceList();
};

window._noRenderPriceList = function() {
const list = document.getElementById('no-price-list');
if (!list) return;
if (!window._newOfficePrices.length) {
list.innerHTML = '<div style="font-size:12px; opacity:0.3; padding:10px 0; text-align:center;">Inga tjänster tillagda ännu.</div>';
return;
}
list.innerHTML = window._newOfficePrices.map((p, i) => `
<div class="no-price-row" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:4px;">
<span style="font-size:12px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.service_name}</span>
<div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;">
<input type="number" data-idx="${i}" value="${p.price}"
style="width:80px; text-align:right; padding:4px 8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:inherit; font-size:12px;"
oninput="window._newOfficePrices[${i}].price=parseFloat(this.value)||0">
<span style="font-size:11px; opacity:0.5;">SEK</span>
<button onclick="window._noRemovePrice(${i})"
style="width:22px; height:22px; border-radius:50%; background:rgba(255,69,58,0.15); border:1px solid rgba(255,69,58,0.3); color:#ff453a; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; padding:0; line-height:1;">×</button>
</div>
</div>`).join('');
};

};

window.saveNewOffice = async function() {
const city = document.getElementById('new-office-city')?.value.trim();
const area = document.getElementById('new-office-area')?.value.trim() || '';
const routingTag = document.getElementById('new-office-tag')?.value.trim();
if (!city || !routingTag) { showToast('Ange minst stad och routing tag.'); return; }

// Samla kontaktuppgifter
const contact = {
phone:   document.getElementById('new-office-phone')?.value.trim() || '',
email:   document.getElementById('new-office-email')?.value.trim() || '',
address: document.getElementById('new-office-address')?.value.trim() || '',
};

// Hämta beskrivning & språk
const description = document.getElementById('new-office-desc')?.value.trim() || '';
const langRaw = document.getElementById('new-office-languages')?.value || 'svenska, engelska';
const languages = langRaw.split(',').map(s => s.trim()).filter(Boolean);

// Bestäm services_offered automatiskt från priser, eller tom array om priserna saknas
const prices = window._newOfficePrices || [];
const sSet = new Set();
prices.forEach(p => {
const kw = p.keywords || [];
if (kw.includes('bil')) sSet.add('Bil');
if (kw.includes('mc') || kw.includes('motorcykel')) sSet.add('MC');
if (kw.includes('am') || kw.includes('moped')) sSet.add('AM');
if (kw.includes('b96') || kw.includes('be') || kw.includes('släp')) sSet.add('Släp');
});
const services_offered = [...sSet];

// Disable Spara-knapp under sparning
const saveBtn = document.getElementById('no-save-btn');
if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/create-office`, {
method: 'POST', headers: fetchHeaders,
body: JSON.stringify({
city, area, routing_tag: routingTag,
office_color: window._newOfficeColor || '#0071e3',
services_offered,
prices,
contact,
description,
languages
})
});
if (res.ok) {
window._adminFormDirty = false;
showToast(`✅ Kontoret ${city} är nu live!`);
await renderAdminOfficeList();
openAdminOfficeDetail(routingTag, null);
} else {
const err = await res.json().catch(() => ({}));
showToast('Fel: ' + (err.error || 'Kunde inte skapa kontor.'));
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
} catch (e) {
showToast('Anslutningsfel.');
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
};
