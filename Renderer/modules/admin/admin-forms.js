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
// openNewAgentForm — SKAPA / REDIGERA AGENT
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

// Bygg vybehörighet-HTML (bara för nya agenter, inte vid redigering)
const _navV = [['my-tickets','Mina ärenden'],['inbox','Inkorgen'],['archive','Garaget'],['customers','Kunder'],['templates','Mailmallar'],['about','Om']];
const _adminV = [['admin-users','Agenter'],['admin-offices','Kontor'],['admin-config','Systemkonfig']];
const vybHTML = !isEdit
  ? '<div>'
    + '<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:8px;letter-spacing:0.05em;">Vybehörighet <span style="text-transform:none;font-style:italic;font-size:9px;opacity:0.7;">(alla aktiva som standard)</span></label>'
    + '<div style="padding:14px 18px;background:rgba(255,140,0,0.03);border:1px solid rgba(255,140,0,0.18);border-radius:12px;">'
    + '<div style="font-size:8px;opacity:0.3;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Sidomenyn</div>'
    + '<div id="na-nav-view-pills" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">'
    + _navV.map(([v,l]) => '<span class="na-view-pill" data-view-key="'+v+'" data-active="true" onclick="window._toggleNavViewPill(this)" style="display:inline-flex;align-items:center;font-size:11px;padding:5px 12px;border-radius:20px;cursor:pointer;background:'+activeColor+'22;border:1px solid '+activeColor+';color:'+activeColor+';transition:all 0.15s;">'+l+'</span>').join('')
    + '</div>'
    + '<div style="font-size:8px;opacity:0.3;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Admin-flikar</div>'
    + '<div id="na-admin-view-pills" style="display:flex;flex-wrap:wrap;gap:5px;">'
    + _adminV.map(([v,l]) => '<span class="na-view-pill" data-view-key="'+v+'" data-active="true" onclick="window._toggleNavViewPill(this)" style="display:inline-flex;align-items:center;font-size:11px;padding:5px 12px;border-radius:20px;cursor:pointer;background:'+activeColor+'22;border:1px solid '+activeColor+';color:'+activeColor+';transition:all 0.15s;">'+l+'</span>').join('')
    + '</div></div></div>'
  : '';

detailBox.innerHTML = `
<div class="detail-container" style="padding:0;width:100%;overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;">
<!-- HEADER — modellerar efter hjälpmodaler -->
<div id="na-form-header" style="background:linear-gradient(90deg,${activeColor}22,transparent); border-bottom:2px solid ${activeColor}; padding:14px 20px; flex-shrink:0; display:flex; align-items:center; gap:14px;">
<div id="form-avatar-preview" style="width:44px; height:44px; border-radius:50%; background:${activeColor}; display:flex; align-items:center; justify-content:center; color:white; font-size:18px; font-weight:700; box-shadow:0 0 14px ${activeColor}55; flex-shrink:0; transition:all 0.2s;">
${isEdit ? `<span style="display:flex;width:22px;height:22px;color:white;">${AVATAR_ICONS[_avatarId]}</span>` : 'A'}
</div>
<div style="min-width:0; flex:1;">
<h2 id="form-display-name" style="margin:0; font-size:16px; font-weight:700; color:${activeColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color 0.2s;">${isEdit ? (editUser.display_name || editUser.username) : 'Ny agent'}</h2>
<div id="form-role-badge" style="font-size:10px; opacity:0.55; margin-top:2px; text-transform:uppercase; letter-spacing:0.3px; color:${activeColor};">${isEdit ? editUser.role.toUpperCase() : 'AGENT'}</div>
</div>
<div style="display:flex; gap:6px; flex-shrink:0;">
<button class="btn-glass-icon" style="color:#ff453a; border-color:rgba(255,69,58,0.4);" onclick="renderAdminUserList();document.getElementById('admin-placeholder').style.display='flex';document.getElementById('admin-detail-content').style.display='none';" title="Avbryt">${ADMIN_UI_ICONS.CANCEL}</button>
${isEdit ? `<button id="form-delete-agent-btn" class="btn-glass-icon danger" style="color:#ff453a; border-color:rgba(255,69,58,0.4);" onclick="deleteUser('${editUser.id}', '${editUser.username}')" title="Radera användare">${UI_ICONS.TRASH}</button>` : ''}
<button id="na-agent-save-btn" class="btn-glass-icon" style="color:${activeColor}; border-color:${activeColor}66; background:${activeColor}11;" onclick="saveNewAgent(${isEdit ? "'" + editUser.id + "'" : 'null'})" title="Spara agent"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
</div>
</div>

<!-- CONTENT -->
<div style="padding:20px 24px; flex:1; overflow-y:auto; box-sizing:border-box;">

<!-- Övre raden: formulärfält + avatar-väljare -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;margin-bottom:20px;">

<!-- Vänster: Formfält -->
<div style="display:flex;flex-direction:column;gap:14px;">

<!-- Dolda state-element -->
<div id="new-agent-avatar-preview" style="display:none;"></div>
<div id="new-agent-preview-name" style="display:none;">${isEdit ? (editUser.display_name || editUser.username) : 'Ny agent'}</div>

<!-- Avatar-ikon stor + färgväljare + roll bredvid -->
<div style="display:flex; align-items:center; gap:16px; margin-bottom:4px;">
<div id="new-agent-avatar-preview-big" style="width:64px; height:64px; border-radius:50%; background:${activeColor}; display:flex; align-items:center; justify-content:center; color:white; font-size:26px; font-weight:700; box-shadow:0 0 20px ${activeColor}66; flex-shrink:0; transition:all 0.2s;">
${isEdit ? `<span style="display:flex;width:32px;height:32px;color:white;">${AVATAR_ICONS[_avatarId]}</span>` : 'A'}
</div>
<div style="display:flex; flex-direction:column; gap:8px;">
<div style="display:flex; align-items:center; gap:8px;">
<label style="font-size:10px; text-transform:uppercase; opacity:0.45; letter-spacing:0.05em; white-space:nowrap;">Roll</label>
<select id="new-agent-role" class="filter-input" style="cursor:pointer; font-size:12px; padding:4px 10px;"
onchange="const role=this.options[this.selectedIndex].text; const rb=document.getElementById('form-role-badge'); if(rb)rb.textContent=role.toUpperCase(); window._adminFormDirty=true;">
<option value="agent" ${isEdit && editUser.role === 'agent' ? 'selected' : ''}>Agent</option>
<option value="admin" ${isEdit && editUser.role === 'admin' ? 'selected' : ''}>Admin</option>
</select>
<input type="color" id="new-agent-color" value="${activeColor}"
style="width:30px; height:30px; border:none; background:transparent; cursor:pointer; border-radius:6px; padding:0; flex-shrink:0;"
title="Välj accentfärg" oninput="window._updateNewAgentColor(this.value);">
<span id="new-agent-color-hex" style="font-family:monospace; font-size:11px; opacity:0.5;">${activeColor}</span>
</div>
</div>
</div>

<!-- Rad 1: Användarnamn + Lösenord -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Användarnamn *</label>
<input id="new-agent-username" class="filter-input" type="text" value="${isEdit ? editUser.username : ''}" ${isEdit ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'placeholder="t.ex. anna.karlsson"'}
oninput="this.value=this.value.toLowerCase(); window._adminFormDirty=true; const prev=document.getElementById('new-agent-avatar-preview'); if(prev&&!prev.querySelector('svg'))prev.textContent=this.value.charAt(0).toUpperCase()||'A'; const dn=document.getElementById('new-agent-displayname'); if(dn&&!dn._touched){dn.placeholder='t.ex. Anna Karlsson'; document.getElementById('new-agent-preview-name').textContent=this.value||'Ny agent'; document.getElementById('form-display-name').textContent=this.value||'Ny agent';}">
</div>
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Lösenord ${isEdit ? '(lämna tomt)' : '*'}</label>
<input id="new-agent-password" class="filter-input" type="password" placeholder="${isEdit ? 'Nytt lösenord' : 'Välj ett starkt lösenord'}"
oninput="window._adminFormDirty=true; window._checkNewAgentPw();">
</div>
</div>

<!-- Rad 2: Visningsnamn + Bekräfta lösenord -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Visningsnamn</label>
<input id="new-agent-displayname" class="filter-input" type="text" value="${isEdit ? (editUser.display_name || '') : ''}" placeholder="t.ex. Anna Karlsson"
oninput="window._adminFormDirty=true; this._touched=true; const name=this.value||document.getElementById('new-agent-username').value||'Ny agent'; document.getElementById('new-agent-preview-name').textContent=name; document.getElementById('form-display-name').textContent=name;">
</div>
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:6px;letter-spacing:0.05em;">Bekräfta lösenord ${isEdit ? '' : '*'}</label>
<input id="new-agent-password2" class="filter-input" type="password" placeholder="Upprepa lösenordet"
oninput="window._adminFormDirty=true; window._checkNewAgentPw();">
</div>
</div>
<div id="pw-match-indicator" style="font-size:11px;margin-top:-6px;height:14px;"></div>

</div>

<!-- Höger: Avatar-väljare -->
<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:10px;letter-spacing:0.05em;">Välj avatar</label>
<div id="new-agent-avatar-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
${avatarGridHTML}
</div>
</div>

</div><!-- /Övre raden -->

<!-- Nedre raden: Kopplade kontor + Vybehörighet sida vid sida -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

<!-- Kopplade kontor -->
${offices.length ? `<div>
<label style="font-size:10px;text-transform:uppercase;opacity:0.5;display:block;margin-bottom:8px;letter-spacing:0.05em;">Kopplade kontor</label>
<div style="display:flex;flex-direction:column;gap:5px;max-height:220px;overflow-y:auto;padding-right:4px;">
${officeBadgesHTML}
</div>
</div>` : '<div></div>'}

<!-- Vybehörighet -->
${vybHTML || '<div></div>'}

</div><!-- /Nedre raden -->

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

// Vybehörighet-pill toggle (aktiv/inaktiv)
window._toggleNavViewPill = function(pill) {
const isActive = pill.getAttribute('data-active') === 'true';
const newActive = !isActive;
pill.setAttribute('data-active', newActive);
const color = document.getElementById('new-agent-color')?.value || '#0071e3';
pill.style.background = newActive ? color + '22' : 'rgba(255,255,255,0.04)';
pill.style.borderColor = newActive ? color : 'rgba(255,255,255,0.1)';
pill.style.color = newActive ? color : 'rgba(255,255,255,0.35)';
window._adminFormDirty = true;
};

// Färg + avatar-preview-uppdatering
window._updateNewAgentColor = function(color) {
document.getElementById('new-agent-color-hex').textContent = color;
window._adminFormDirty = true;
// Uppdatera header-avatar
const headerAvatar = document.getElementById('form-avatar-preview');
if (headerAvatar) { headerAvatar.style.background = color; headerAvatar.style.boxShadow = `0 0 16px ${color}55`; }
// Uppdatera preview-avatar (dold state-element)
const prev = document.getElementById('new-agent-avatar-preview');
if (prev) { prev.style.background = color; prev.style.boxShadow = `0 0 20px ${color}66`; }
// Uppdatera stor synlig avatar-cirkel i innehållet
const bigAvatar = document.getElementById('new-agent-avatar-preview-big');
if (bigAvatar) { bigAvatar.style.background = color; bigAvatar.style.boxShadow = `0 0 20px ${color}66`; }
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
// Uppdatera header gradient + border
const hdr = document.getElementById('na-form-header');
if (hdr) { hdr.style.background = `linear-gradient(90deg,${color}22,transparent)`; hdr.style.borderBottom = `2px solid ${color}`; }
// Uppdatera roll-badge färg
const badge = document.getElementById('form-role-badge');
if (badge) badge.style.color = color;
// Uppdatera titel-text färg (Ny agent / namn)
const titleEl = document.getElementById('form-display-name');
if (titleEl) titleEl.style.color = color;
// Uppdatera spara-knappen
const saveBtn = document.getElementById('na-agent-save-btn');
if (saveBtn) { saveBtn.style.color = color; saveBtn.style.borderColor = color + '66'; saveBtn.style.background = color + '11'; }
// Uppdatera aktiva vybehörighet-pills
document.querySelectorAll('.na-view-pill[data-active="true"]').forEach(pill => {
pill.style.background = color + '22'; pill.style.borderColor = color; pill.style.color = color;
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

// Visa vald avatar i dold preview-bubbla (state)
const prev = document.getElementById('new-agent-avatar-preview');
if (prev) {
prev.style.background = color;
prev.style.boxShadow = `0 0 20px ${color}66`;
prev.innerHTML = `<span style="display:flex;width:32px;height:32px;color:white;">${AVATAR_ICONS[_avatarId]}</span>`;
}
// Uppdatera stor synlig avatar-cirkel i innehållet
const bigAvatar = document.getElementById('new-agent-avatar-preview-big');
if (bigAvatar) {
bigAvatar.style.background = color;
bigAvatar.style.boxShadow = `0 0 20px ${color}66`;
bigAvatar.innerHTML = `<span style="display:flex;width:32px;height:32px;color:white;">${AVATAR_ICONS[_avatarId]}</span>`;
}
// Uppdatera header-avataren också
const headerAvatar = document.getElementById('form-avatar-preview');
if (headerAvatar) {
headerAvatar.style.background = color;
headerAvatar.style.boxShadow = `0 0 16px ${color}55`;
headerAvatar.innerHTML = `<span style="display:flex;width:24px;height:24px;color:white;">${AVATAR_ICONS[_avatarId]}</span>`;
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
}

// Spara vybehörighet alltid vid nyskapande (null-logik fungerar inte för admin-flikar)
if (!isEdit) {
const allViewKeys = ['my-tickets','inbox','archive','customers','templates','about','admin-users','admin-offices','admin-config'];
const activePills = document.querySelectorAll('.na-view-pill[data-active="true"]');
const activeKeys = Array.from(activePills).map(p => p.getAttribute('data-view-key')).filter(Boolean);
const keysToSave = activeKeys.length > 0 ? activeKeys : allViewKeys;
await fetch(`${SERVER_URL}/api/admin/user-views/${encodeURIComponent(username)}`, {
method: 'PUT', headers: fetchHeaders,
body: JSON.stringify({ allowed_views: keysToSave })
}).catch(e => console.error('[VIEWS] Could not save views:', e));
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
// openNewOfficeForm — SKAPA NYTT KONTOR
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
'Lastbil': [
{ service_name: 'C Totalpaket 5',                   price: 0, currency: 'SEK', keywords: ['c körkort','c totalpaket 5','lastbil','tung lastbil'] },
{ service_name: 'C Totalpaket 10',                  price: 0, currency: 'SEK', keywords: ['c körkort','c totalpaket 10','lastbil'] },
{ service_name: 'C Totalpaket 15',                  price: 0, currency: 'SEK', keywords: ['c körkort','c totalpaket 15','lastbil'] },
{ service_name: 'C Paket + YKB 140H',               price: 0, currency: 'SEK', keywords: ['c ykb paket','lastbil ykb'] },
{ service_name: 'C Körlektion (1 st)',               price: 0, currency: 'SEK', keywords: ['c körlektion','lastbil lektion'] },
{ service_name: 'C Lektionspaket 5',                price: 0, currency: 'SEK', keywords: ['c lektionspaket 5','lastbil'] },
{ service_name: 'C Lektionspaket 10',               price: 0, currency: 'SEK', keywords: ['c lektionspaket 10','lastbil'] },
{ service_name: 'C Uppvärmning & ekipage vid prov', price: 0, currency: 'SEK', keywords: ['uppvärmning','ekipage','c körkort'] },
{ service_name: 'CE Totalpaket 5',                  price: 0, currency: 'SEK', keywords: ['ce körkort','ce totalpaket 5','lastbil med släp'] },
{ service_name: 'CE Totalpaket 10',                 price: 0, currency: 'SEK', keywords: ['ce körkort','ce totalpaket 10','lastbil med släp'] },
{ service_name: 'CE Totalpaket 15',                 price: 0, currency: 'SEK', keywords: ['ce körkort','ce totalpaket 15','lastbil med släp'] },
{ service_name: 'CE Lektionspaket 5',               price: 0, currency: 'SEK', keywords: ['ce lektionspaket 5','lastbil med släp'] },
{ service_name: 'CE Lektionspaket 10',              price: 0, currency: 'SEK', keywords: ['ce lektionspaket 10','lastbil med släp'] },
{ service_name: 'CE Lektionspaket 15',              price: 0, currency: 'SEK', keywords: ['ce lektionspaket 15','lastbil med släp'] },
{ service_name: 'CE Körlektion (1 st)',              price: 0, currency: 'SEK', keywords: ['ce körlektion','lastbil med släp lektion'] },
{ service_name: 'CE Uppvärmning & ekipage vid prov',price: 0, currency: 'SEK', keywords: ['uppvärmning','ekipage','ce körkort'] },
{ service_name: 'C1 Paket (3 lektioner)',           price: 0, currency: 'SEK', keywords: ['c1 körkort','c1 paket','medeltung lastbil'] },
{ service_name: 'C1 Körlektion (1 st)',             price: 0, currency: 'SEK', keywords: ['c1 körlektion','medeltung lastbil'] },
{ service_name: 'C1 Uppvärmning & ekipage vid prov',price: 0, currency: 'SEK', keywords: ['uppvärmning','ekipage','c1 körkort'] },
{ service_name: 'D Totalpaket 5 (Buss)',            price: 0, currency: 'SEK', keywords: ['d körkort','buss','busskörkort','d totalpaket'] },
{ service_name: 'D Körlektion (1 st, Buss)',        price: 0, currency: 'SEK', keywords: ['d körlektion','buss'] },
{ service_name: 'D Lektionspaket 5 (Buss)',         price: 0, currency: 'SEK', keywords: ['d lektionspaket 5','buss'] },
{ service_name: 'D Lektionspaket 10 (Buss)',        price: 0, currency: 'SEK', keywords: ['d lektionspaket 10','buss'] },
{ service_name: 'D Lektionspaket 15 (Buss)',        price: 0, currency: 'SEK', keywords: ['d lektionspaket 15','buss'] },
{ service_name: 'D Uppvärmning & ekipage vid prov (Buss)', price: 0, currency: 'SEK', keywords: ['uppvärmning','ekipage','d körkort','buss'] },
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

const oc = window._newOfficeColor || '#0071e3';

detailBox.innerHTML = `
<div class="detail-container" style="padding:0; width:100%; overflow-y:auto; box-sizing:border-box; display:flex; flex-direction:column;">
<!-- Gradient Header (matchar agent-formuläret) -->
<div id="no-form-header" style="background:linear-gradient(90deg,${oc}22,transparent); border-bottom:2px solid ${oc}; padding:18px 24px; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:16px;">
<div style="display:flex; align-items:center; gap:14px; min-width:0; flex:1;">
<div id="no-avatar-circle" style="width:48px; height:48px; border-radius:12px; background:${oc}; display:flex; align-items:center; justify-content:center; color:white; font-size:22px; font-weight:700; box-shadow:0 0 16px ${oc}55; flex-shrink:0; transition:all 0.2s;">N</div>
<div style="min-width:0; flex:1;">
<div id="no-preview-name" style="font-size:16px; font-weight:700; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Nytt kontor</div>
<div id="no-preview-tag" style="font-size:10px; margin-top:3px; font-family:monospace; color:${oc}; opacity:0.7;">routing_tag</div>
</div>
</div>
<div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
<input type="color" id="no-color-picker" value="${oc}"
style="width:32px; height:32px; border:none; background:transparent; cursor:pointer; border-radius:6px; padding:1px;"
title="Välj kontorsfärg" oninput="window._noUpdateColor(this.value)">
<span id="no-color-hex" style="font-family:monospace; font-size:9px; opacity:0.4;">${oc}</span>
</div>
<div style="width:1px; height:20px; background:rgba(255,255,255,0.1);"></div>
<div style="display:flex; gap:6px;">
<button class="btn-glass-icon" style="color:#ff453a; border-color:rgba(255,69,58,0.4);" onclick="renderAdminOfficeList(); document.getElementById('admin-placeholder').style.display='flex'; document.getElementById('admin-detail-content').style.display='none';" title="Avbryt">${ADMIN_UI_ICONS.CANCEL}</button>
<button id="no-save-btn" class="btn-glass-icon" style="color:${oc}; border-color:${oc}66; background:${oc}11;" onclick="saveNewOffice()" title="Spara kontor">${ADMIN_UI_ICONS.SAVE}</button>
</div>
</div>
</div>
<!-- Scrollbart innehåll -->
<div style="padding:20px 24px; flex:1; overflow-y:auto; box-sizing:border-box;">
<!-- 2-kolumnsgrid -->
<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;">

<!-- VÄNSTER KOLUMN -->
<div style="display:grid; gap:10px;">

<!-- Rad: Stad + Område -->
<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:5px;">Stad *</label>
<input id="new-office-city" class="filter-input" type="text" placeholder="t.ex. Göteborg"
oninput="window._adminFormDirty=true; window._updateRoutingTagPreview(); window._noPreviewUpdate();">
</div>
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:5px;">Ömrade</label>
<input id="new-office-area" class="filter-input" type="text" placeholder="t.ex. Ullevi"
oninput="window._adminFormDirty=true; window._updateRoutingTagPreview(); window._noPreviewUpdate();">
</div>
</div>

<!-- Routing Tag — dolt, auto-genereras, värdet används av saveNewOffice -->
<input id="new-office-tag" type="hidden">

<!-- Rad: Adress (full) -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:5px;">Adress</label>
<input id="new-office-address" class="filter-input" type="text" placeholder="Gatuadress, Postnummer Stad" oninput="window._adminFormDirty=true;">
</div>

<!-- Rad: Telefon + E-post -->
<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:5px;">Telefon</label>
<input id="new-office-phone" class="filter-input" type="text" placeholder="010-20 70 775" oninput="window._adminFormDirty=true;">
</div>
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:5px;">E-post</label>
<input id="new-office-email" class="filter-input" type="email" placeholder="hej@mydrivingacademy.com" oninput="window._adminFormDirty=true;">
</div>
</div>

<!-- Rad: Språk + Beskrivning -->
<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:5px;">Språk</label>
<input id="new-office-languages" class="filter-input" type="text" placeholder="svenska, engelska" value="svenska, engelska" oninput="window._adminFormDirty=true;">
</div>
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:5px;">Beskrivning</label>
<input id="new-office-desc" class="filter-input" type="text" placeholder="Kort beskrivning av kontoret" oninput="window._adminFormDirty=true;">
</div>
</div>

<!-- Öppettider -->
<div>
<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; letter-spacing:0.05em;">Öppettider</label>
<button class="btn-glass-small" onclick="window._noAddHoursRow()" style="font-size:10px; padding:2px 8px;">+ dag</button>
</div>
<div id="no-hours-list" style="display:grid; gap:5px;">
<div class="no-hours-row" style="display:grid; grid-template-columns:1fr 1fr auto; gap:5px; align-items:center;">
<input class="filter-input no-hours-days" placeholder="Mån – Tors" value="Mån – Tors" style="font-size:12px;" oninput="window._adminFormDirty=true;">
<input class="filter-input no-hours-h" placeholder="08:00 – 17:00" value="08:30 – 17:00" style="font-size:12px;" oninput="window._adminFormDirty=true;">
<button onclick="this.closest('.no-hours-row').remove()" style="width:22px;height:22px;border-radius:50%;background:rgba(255,69,58,0.15);border:1px solid rgba(255,69,58,0.3);color:#ff453a;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">×</button>
</div>
<div class="no-hours-row" style="display:grid; grid-template-columns:1fr 1fr auto; gap:5px; align-items:center;">
<input class="filter-input no-hours-days" placeholder="Fredag" value="Fredag" style="font-size:12px;" oninput="window._adminFormDirty=true;">
<input class="filter-input no-hours-h" placeholder="08:00 – 12:00" value="08:00 – 14:00" style="font-size:12px;" oninput="window._adminFormDirty=true;">
<button onclick="this.closest('.no-hours-row').remove()" style="width:22px;height:22px;border-radius:50%;background:rgba(255,69,58,0.15);border:1px solid rgba(255,69,58,0.3);color:#ff453a;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">×</button>
</div>
</div>
</div>

<!-- Bokningslänkar -->
<div>
<label style="font-size:10px; text-transform:uppercase; opacity:0.5; display:block; margin-bottom:6px; letter-spacing:0.05em;">Bokningslänkar</label>
<div style="display:grid; gap:5px;">
<div style="display:grid; grid-template-columns:28px 1fr; gap:6px; align-items:center;">
<span style="font-size:10px; font-weight:700; opacity:0.55; text-transform:uppercase;">BIL</span>
<input id="no-booking-car" class="filter-input" type="url" style="font-size:11px;" placeholder="https://booking.mydrivingacademy.com/..." oninput="window._adminFormDirty=true;">
</div>
<div style="display:grid; grid-template-columns:28px 1fr; gap:6px; align-items:center;">
<span style="font-size:10px; font-weight:700; opacity:0.55; text-transform:uppercase;">MC</span>
<input id="no-booking-mc" class="filter-input" type="url" style="font-size:11px;" placeholder="https://booking.mydrivingacademy.com/..." oninput="window._adminFormDirty=true;">
</div>
<div style="display:grid; grid-template-columns:28px 1fr; gap:6px; align-items:center;">
<span style="font-size:10px; font-weight:700; opacity:0.55; text-transform:uppercase;">AM</span>
<input id="no-booking-am" class="filter-input" type="url" style="font-size:11px;" placeholder="https://booking.mydrivingacademy.com/..." oninput="window._adminFormDirty=true;">
</div>
</div>
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
<button class="btn-glass-small" onclick="window._noAddPackage('Lastbil')" style="font-size:12px;">+ Lastbil</button>
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
</div><!-- /scrollable-content -->
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
if (circle) { circle.style.background = hex; circle.style.boxShadow = `0 0 16px ${hex}55`; }
const label = document.getElementById('no-color-hex');
if (label) label.textContent = hex;
// Uppdatera header gradient + border
const hdr = document.getElementById('no-form-header');
if (hdr) { hdr.style.background = `linear-gradient(90deg,${hex}22,transparent)`; hdr.style.borderBottom = `2px solid ${hex}`; }
// Uppdatera routing_tag färg i headern
const tag = document.getElementById('no-preview-tag');
if (tag) tag.style.color = hex;
// Uppdatera spara-knapp
const saveBtn = document.getElementById('no-save-btn');
if (saveBtn) { saveBtn.style.color = hex; saveBtn.style.borderColor = hex + '66'; saveBtn.style.background = hex + '11'; }
};

window._noPreviewUpdate = function() {
const city = document.getElementById('new-office-city')?.value || '';
const area = document.getElementById('new-office-area')?.value || '';
const circle = document.getElementById('no-avatar-circle');
if (circle) circle.textContent = (city.charAt(0) || 'N').toUpperCase();
const nameEl = document.getElementById('no-preview-name');
if (nameEl) nameEl.textContent = city ? (area ? `${city} – ${area}` : city) : 'Nytt kontor';
};

window._noAddHoursRow = function() {
const list = document.getElementById('no-hours-list');
if (!list) return;
const row = document.createElement('div');
row.className = 'no-hours-row';
row.style.cssText = 'display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center;';
row.innerHTML = '<input class="filter-input no-hours-days" placeholder="t.ex. Lördag" oninput="window._adminFormDirty=true;">'
  + '<input class="filter-input no-hours-h" placeholder="HH:MM – HH:MM" oninput="window._adminFormDirty=true;">'
  + '<button onclick="this.closest(\'.no-hours-row\').remove()" style="width:24px;height:24px;border-radius:50%;background:rgba(255,69,58,0.15);border:1px solid rgba(255,69,58,0.3);color:#ff453a;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">×</button>';
list.appendChild(row);
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
<div class="no-price-row" style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:4px; min-width:0;">
<span style="font-size:12px; flex:0 1 auto; max-width:70%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;" title="${p.service_name}">${p.service_name}</span>
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
if (kw.includes('lastbil') || kw.includes('c körkort') || kw.includes('ce körkort') || kw.includes('c1 körkort') || kw.includes('buss')) sSet.add('Lastbil');
});
const services_offered = [...sSet];

// Öppettider
const hoursRows = document.querySelectorAll('.no-hours-row');
const opening_hours = [...hoursRows].map(row => ({
days:  row.querySelector('.no-hours-days')?.value.trim() || '',
hours: row.querySelector('.no-hours-h')?.value.trim() || ''
})).filter(h => h.days && h.hours);

// Bokningslänkar
const booking_links = {
CAR: document.getElementById('no-booking-car')?.value.trim() || null,
MC:  document.getElementById('no-booking-mc')?.value.trim() || null,
AM:  document.getElementById('no-booking-am')?.value.trim() || null,
};

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
languages,
opening_hours,
booking_links
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