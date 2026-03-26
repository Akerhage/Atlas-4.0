// ============================================
// modules/modals.js
// VAD DEN GÖR: Modaler, dialoger, profilinställningar
//              och temabyte
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   UI_ICONS, ADMIN_UI_ICONS, AVATAR_ICONS     — ui-constants.js
//   getAgentStyles, formatName, showToast      — styling-utils.js
//   SERVER_URL, fetchHeaders, currentUser      — renderer.js globals
//   atlasConfirm (self), handleLogout          — renderer.js / modals.js
//   renderInbox, renderMyTickets               — inbox-view.js / tickets-view.js
//   openMyTicketDetail                         — tickets-view.js
//   performAssign (self), getAvatarBubbleHTML  — renderer.js
//   switchView                                 — renderer.js
// ============================================

// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║     VARNING — DIREKTANVÄNDNING AV agent_color               ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  Denna fil läser agent_color DIREKT från usersCache[] och   ║
// ⚠️  ║  currentUser — den använder INTE getAgentStyles() från      ║
// ⚠️  ║  styling-utils.js. Det är ett AVSIKTLIGT undantag för       ║
// ⚠️  ║  profilinställningar och assign-modalen.                    ║
// ⚠️  ║                                                              ║
// ⚠️  ║  STÄLLEN DÄR agent_color ANVÄNDS DIREKT (ÄNDRA INTE):       ║
// ⚠️  ║                                                              ║
// ⚠️  ║  rad ~173  assign-modal: agentlistan, border-left-färg      ║
// ⚠️  ║  rad ~265  profilmodal: initialColor för färgpickern        ║
// ⚠️  ║  rad ~331  profilmodal: inloggad agents egna accentknappar  ║
// ⚠️  ║  rad ~424  profilmodal: sparar ny agent_color till server   ║
// ⚠️  ║  rad ~438  profilmodal: sätter --accent-primary efter spara ║
// ⚠️  ║  rad ~446  profilmodal: synkar --agent-color på ärendekort  ║
// ⚠️  ║  rad ~726  internal assign: agentlistan, border+data-color  ║
// ⚠️  ║                                                              ║
// ⚠️  ║  ❌ ÄNDRA INTE: --accent-primary setProperty (rad 438)      ║
// ⚠️  ║     — utan den byter inte accentfärgen globalt vid spara.   ║
// ⚠️  ║  ❌ ÄNDRA INTE: fallback '#0071e3' i agent_color-uttrycken  ║
// ⚠️  ║     — den triggas när agent saknar sparad färg.             ║
// ⚠️  ║  ❌ ÄNDRA INTE: '#4cd964'-fallbacken på rad ~331            ║
// ⚠️  ║     — den är avsiktligt grön (aktiv-signal) för inloggad   ║
// ⚠️  ║     agent utan egen sparad färg.                            ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝

// ============================================================================
// ATLAS CONFIRM — Snygg Ja/Nej-ruta
// ============================================================================
function atlasConfirm(title, message) {
return new Promise((resolve) => {
let modal = document.getElementById('atlas-confirm-modal');

if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-confirm-modal';
modal.className = 'custom-modal-overlay glass-effect';
modal.style.display = 'none';
modal.style.zIndex = '30000';

// Kolla UI_ICONS innan användning
const sendIcon = (typeof UI_ICONS !== 'undefined' && UI_ICONS.SEND) ? UI_ICONS.SEND : '';

modal.innerHTML = `
<div class="glass-modal-box" style="border-top:3px solid var(--accent-primary);">
<div class="glass-modal-header"><h3 id="confirm-title"></h3></div>
<div class="glass-modal-body"><p id="confirm-message" style="margin: 15px 0 25px 0;"></p></div>
<div class="glass-modal-footer" style="justify-content:center;">
<button id="confirm-ok" class="btn-modal-confirm">${sendIcon} OK</button>
</div>
</div>`;
document.body.appendChild(modal);
}

modal.querySelector('#confirm-title').innerText = title;
modal.querySelector('#confirm-message').innerText = message;
const _cHex = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#')) ? currentUser.agent_color : '#0071e3';
modal.querySelector('.glass-modal-box').style.borderTop = `3px solid ${_cHex}`;
modal.style.display = 'flex';

const btnOk = modal.querySelector('#confirm-ok');
const newOk = btnOk.cloneNode(true);
btnOk.parentNode.replaceChild(newOk, btnOk);

const _cClose = (val) => { modal.style.display = 'none'; document.removeEventListener('keydown', _cEsc); modal.onclick = null; resolve(val); };
const _cEsc = (e) => { if (e.key === 'Escape') _cClose(false); };
document.addEventListener('keydown', _cEsc);
modal.onclick = (e) => { if (e.target === modal) _cClose(false); };
newOk.onclick = () => _cClose(true);
});
}

// CHANGE THEME =================================================================
function changeTheme(themeName) {
// Kolla både globala DOM-objektet och stylesheet-referensen
const stylesheet = (typeof DOM !== 'undefined' && DOM.themeStylesheet)
? DOM.themeStylesheet
: document.getElementById('theme-stylesheet');

if (stylesheet) {
stylesheet.href = `./assets/themes/${themeName}/${themeName}.css`;
}
localStorage.setItem('atlas-theme', themeName);
}

function changeSound(soundFile) {
localStorage.setItem('atlas-sound', soundFile);
}

// ============================================================================
// Ersättare för window.prompt med glassmorphism-design
// ============================================================================
function atlasPrompt(title, message, defaultValue = '') {
return new Promise((resolve) => {
let modal = document.getElementById('atlas-prompt-modal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-prompt-modal';
modal.className = 'custom-modal-overlay';
modal.style.display = 'none';
modal.style.zIndex = '30000';

modal.innerHTML = `
<div class="glass-modal-box" style="border-top:3px solid var(--accent-primary);">
<div class="glass-modal-header">
<h3 id="prompt-title"></h3>
</div>
<div class="glass-modal-body">
<p id="prompt-message"></p>
<textarea id="prompt-input" style="width:100%; height:80px; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; resize:none; font-family:inherit; font-size:14px; margin-top:10px;"></textarea>
</div>
<div class="glass-modal-footer" style="justify-content:flex-end;">
<button id="prompt-confirm" class="btn-modal-confirm">OK</button>
</div>
</div>
`;
document.body.appendChild(modal);
}

const titleEl = modal.querySelector('#prompt-title');
const msgEl = modal.querySelector('#prompt-message');
const inputEl = modal.querySelector('#prompt-input');
const confirmBtn = modal.querySelector('#prompt-confirm');

titleEl.textContent = title;
msgEl.textContent = message;
const _pHex = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#')) ? currentUser.agent_color : '#0071e3';
modal.querySelector('.glass-modal-box').style.borderTop = `3px solid ${_pHex}`;

// Sätter defaultValue om det finns (t.ex. vid redigering), annars tomt
inputEl.value = defaultValue;

modal.style.display = 'flex';
setTimeout(() => {
inputEl.focus();

// Placerar markören i slutet av texten om det är en redigering
inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
}, 50);

const close = (val) => {
modal.style.display = 'none';
confirmBtn.onclick = null;
document.removeEventListener('keydown', _pEsc);
modal.onclick = null;
resolve(val);
};
const _pEsc = (e) => { if (e.key === 'Escape') close(null); };
document.addEventListener('keydown', _pEsc);
modal.onclick = (e) => { if (e.target === modal) close(null); };

confirmBtn.onclick = () => close(inputEl.value);
});
}

//=====================================================//
//=========SHOW ASSIGN MODAL LOGIN/PROFIL-SIDAN=======//
//=====================================================//
async function showAssignModal(ticket) {
let users = [];
try {
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
if (res.ok) users = await res.json();
} catch (e) {
console.error("Kunde inte hämta användarlistan:", e);
return;
}

const agentList = users.filter(u => u.username.toLowerCase() !== 'admin');
agentList.sort((a, b) => formatName(a.username).localeCompare(formatName(b.username), 'sv'));

const modal = document.createElement('div');
modal.className = 'custom-modal-overlay';
modal.style.display = 'flex';
modal.style.zIndex = '20000';

modal.innerHTML = `
<div class="glass-modal-box glass-effect">
<div class="glass-modal-header">
<h3>Tilldela ärende</h3>
</div>
<div class="glass-modal-body" style="overflow-y: auto; flex: 1; padding: 20px;">
<div class="agent-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
${agentList.map(u => {
const displayName = u.display_name || formatName(u.username);
const avatarHtml = getAvatarBubbleHTML(u, "38px");
return `
<div class="agent-card" 
onclick="window.executeAssign('${ticket.conversation_id}', '${escAttr(u.username)}', '${escAttr(displayName)}')"
style="border-left: 4px solid ${u.agent_color || '#0071e3'}; cursor: pointer;">
${avatarHtml}
<div class="agent-card-info">
<div class="agent-card-name">${displayName}</div>
<div class="agent-card-status">${u.status_text || (u.is_online ? 'Tillgänglig' : 'Ej inloggad')}</div>
</div>
</div>`;
}).join('')}
</div>
</div>
</div>
</div>`;

document.body.appendChild(modal);

// Stäng via klick utanför eller ESC
const closeAssign = () => { if (document.body.contains(modal)) document.body.removeChild(modal); document.removeEventListener('keydown', escAssign); };
const escAssign = (e) => { if (e.key === 'Escape') closeAssign(); };
modal.onclick = (e) => { if (e.target === modal) closeAssign(); };
document.addEventListener('keydown', escAssign);

// Stabil global referens för klicket
window.executeAssign = async (convId, username, displayName) => {
closeAssign();
await performAssign(convId, username);
showToast(`✅ Ärende tilldelat till ${displayName}`);
};
}

//=====================================================//
//========= HJÄLPFUNKTION FÖR TILLDELNING ===========//
//=====================================================//
async function performAssign(conversationId, targetAgent) {
try {
const res = await fetch(`${SERVER_URL}/team/assign`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ conversationId, targetAgent })
});

if (res.ok) {
// 1. Uppdatera listvyn
renderInbox();
renderMyTickets();

// 2. Stäng admin-reader-modalen om den är öppen (admin tilldelade härifrån)
const readerModal = document.getElementById('atlas-reader-modal');
if (readerModal) readerModal.style.display = 'none';

// 3. TOTALRENSA alla detaljvyer (Inkorg OCH Mina Ärenden) för att slippa ghosting
const views = [
{ det: 'inbox-detail', ph: 'inbox-placeholder' },
{ det: 'my-ticket-detail', ph: 'my-detail-placeholder' }
];

views.forEach(v => {
const detail = document.getElementById(v.det);
const placeholder = document.getElementById(v.ph);
if (detail) {
detail.innerHTML = '';
detail.style.display = 'none';
detail.removeAttribute('data-current-id');
}
if (placeholder) {
placeholder.style.display = 'flex';
}
});

} else {
console.error("Servern svarade inte OK vid tilldelning.");
}
} catch (err) {
console.error("Assign error:", err);
}
}

/* ==========================================================
FUNKTION: PROFIL & LÖSENORD
Inkluderar: Live Preview, Direkt-UI-update & Logga ut
========================================================== */
async function showProfileSettings() {
// 1. Hämta data
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
const users = await res.json();
const me = users.find(u => u.username === currentUser.username) || currentUser;

let overlay = document.getElementById('atlas-profile-modal');
if (!overlay) {
overlay = document.createElement('div');
overlay.id = 'atlas-profile-modal';
overlay.className = 'custom-modal-overlay';
document.body.appendChild(overlay);
}

let selectedAvatarId = me.avatar_id || 0;
const initialColor = me.agent_color || '#0071e3';

overlay.innerHTML = `
<div class="glass-modal-box glass-effect" style="width: 400px; max-height: 92vh; display: flex; flex-direction: column; padding: 0 !important;">
<div class="glass-modal-header" style="flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
<div id="profile-preview-avatar" style="width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 2px solid ${initialColor}; color: ${initialColor}; transition: all 0.2s;">
${AVATAR_ICONS[selectedAvatarId]}
</div>
<div style="flex: 1;">
<h3 style="margin:0; font-size: 15px; letter-spacing: 0.5px;">MIN PROFIL</h3>
<div style="font-size: 10px; opacity: 0.5;">Inloggad som @${me.username}</div>
</div>
</div>

<div class="glass-modal-body" style="padding: 15px 20px; overflow-y: auto; flex: 1;">
<div class="settings-group">
<label style="font-size: 10px; text-transform: uppercase; opacity: 0.4; margin-bottom: 4px;">Visningsnamn</label>
<input type="text" id="pref-display-name" autocomplete="off" value="${me.display_name || ''}" placeholder="${formatName(me.username)}" style="padding: 8px 12px; font-size: 13px;">

<label style="margin-top: 10px; font-size: 10px; text-transform: uppercase; opacity: 0.4; margin-bottom: 4px;">Statusmeddelande</label>
<input type="text" id="pref-status-text" autocomplete="off" value="${me.status_text || ''}" placeholder="Vad gör du just nu?" maxlength="40" style="padding: 8px 12px; font-size: 13px;">
</div>

<div class="settings-group" style="margin-top: 15px;">
<label style="font-size: 10px; text-transform: uppercase; opacity: 0.4; margin-bottom: 6px;">Profilfärg & Ikon</label>
<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
<div id="pref-color-line" style="flex: 1; height: 2px; background-color: ${initialColor} !important; border-radius: 2px; opacity: 0.8;"></div>
<div style="display: flex; align-items: center; gap: 8px;">
<input type="color" id="pref-color" value="${initialColor}" style="width: 38px; height: 28px; cursor: pointer; background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0;">
<span id="pref-color-hex" style="font-family: monospace; font-size: 10px; opacity: 0.4; min-width: 55px;">${initialColor.toUpperCase()}</span>
</div>
</div>

<div class="avatar-picker-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 5px;">
${AVATAR_ICONS.map((svg, index) => `
<div class="avatar-option ${selectedAvatarId == index ? 'selected' : ''}" 
data-id="${index}"
style="color: ${initialColor}; cursor: pointer; padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: center; transition: all 0.2s; height: 32px;">
${svg}
</div>
`).join('')}
</div>
</div>

<hr style="border:0; border-top:1px solid rgba(255,255,255,0.08); margin: 15px 0;">

<div class="settings-group">
<label style="color:#888; font-size: 10px; text-transform: uppercase; margin-bottom: 6px;">Byt Lösenord</label>
<input type="password" id="old-pass" autocomplete="new-password" placeholder="Nuvarande" style="margin-top:0; font-size: 12px; padding: 8px 12px;">
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
<input type="password" id="new-pass" autocomplete="new-password" placeholder="Nytt" style="font-size: 12px; padding: 8px 12px;">
<input type="password" id="confirm-pass" autocomplete="new-password" placeholder="Bekräfta" style="font-size: 12px; padding: 8px 12px;">
</div>
</div>
</div>

<div class="glass-modal-footer" style="flex-shrink: 0; padding: 12px 20px; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
<button id="prof-logout-btn" title="Logga ut" style="background: rgba(255,69,58,0.1); border: 1px solid rgba(255,69,58,0.2); color: #ff453a; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0 !important;">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
</button>
<div style="flex:1"></div>
<button class="btn-glass-icon" id="prof-save-btn" title="Spara ändringar" 
style="width: 36px; height: 36px; border-radius: 8px; color: ${currentUser.agent_color || '#4cd964'}; border-color: ${currentUser.agent_color ? currentUser.agent_color + '4d' : 'rgba(76,217,100,0.3)'}; background: ${currentUser.agent_color ? currentUser.agent_color + '1a' : 'rgba(76,217,100,0.05)'}; display: flex; align-items: center; justify-content: center; padding: 0;">
${ADMIN_UI_ICONS.SAVE}
</button>
</div>
</div>`;

overlay.style.display = 'flex';

const colorInput = overlay.querySelector('#pref-color');
const colorLine = overlay.querySelector('#pref-color-line');
const colorHexDisplay = overlay.querySelector('#pref-color-hex');
const previewContainer = overlay.querySelector('#profile-preview-avatar');
const avatarOptions = overlay.querySelectorAll('.avatar-option');

// LIVE SYNC LOGIK
const syncProfileUI = (color, avatarId, statusText) => {
// 0. Uppdatera CSS-accentvariabeln direkt (styr HEM-vyn, knappar, statusrad m.m.)
document.documentElement.style.setProperty('--accent-primary', color);

// 1. Modal-preview (Uppe i modalen)
if (previewContainer) {
previewContainer.style.borderColor = color;
previewContainer.style.color = color;
previewContainer.innerHTML = AVATAR_ICONS[avatarId];
}
if (colorLine) colorLine.style.setProperty('background-color', color, 'important');
if (colorHexDisplay) colorHexDisplay.innerText = color.toUpperCase();
avatarOptions.forEach(opt => opt.style.color = color);

// 2. Sidofältet (Footer) - Färg & Avatar
const sideAvatarRing = document.querySelector('.sidebar-footer .user-avatar');
const sideIconContainer = document.querySelector('.sidebar-footer .user-initial');

if (sideAvatarRing) sideAvatarRing.style.setProperty('border-color', color, 'important');
if (sideIconContainer) {
sideIconContainer.style.setProperty('background-color', color, 'important');
sideIconContainer.innerHTML = AVATAR_ICONS[avatarId];
const svg = sideIconContainer.querySelector('svg');
if (svg) { svg.style.width = '20px'; svg.style.height = '20px'; }
}

// 3. Statustext — skriv om nameEl med innerHTML precis som updateProfileUI gör (undviker dubbla spans)
const nameEl = document.getElementById('current-user-name');
if (nameEl) {
const displayName = currentUser.display_name || currentUser.username || 'Agent';
const statusHtml = statusText ? '<span class="user-status-text" style="display:block; font-size:10px; color:' + color + '; opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">💬 ' + statusText + '</span>' : '';
const safeName = displayName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
nameEl.innerHTML = '<span style="display:block; font-weight:600; color:white;">' + (safeName.charAt(0).toUpperCase() + safeName.slice(1)) + '</span>' + statusHtml;
}

// 4. Spara-knappen
const saveBtn = document.getElementById('prof-save-btn');
if (saveBtn) {
saveBtn.style.setProperty('color', color, 'important');
saveBtn.style.setProperty('border-color', color + '4d', 'important');
saveBtn.style.setProperty('background', color + '1a', 'important');
}

// 5. Mallar-listan — direkt DOM-uppdatering (currentUser.agent_color inte sparat ännu)
document.querySelectorAll('#view-templates .template-group-header').forEach(h => {
const hexToRgba = (hex, a) => { try { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; } catch(e) { return `rgba(0,113,227,${a})`; } };
h.style.setProperty('--group-bg', hexToRgba(color, 0.08), 'important');
h.style.setProperty('--group-text', color, 'important');
h.style.setProperty('--group-border', hexToRgba(color, 0.3), 'important');
const arrow = h.querySelector('.group-arrow');
if (arrow) arrow.style.setProperty('color', color, 'important');
const name = h.querySelector('.group-name');
if (name) name.style.setProperty('color', color, 'important');
const count = h.querySelector('.group-count');
if (count) count.style.setProperty('background', color, 'important');
});
}; // Slut på syncProfileUI

// --- EVENTLYSSNARE FÖR REALTIDSUPPDATERING ---
colorInput.oninput = (e) => {
syncProfileUI(e.target.value, selectedAvatarId, document.getElementById('pref-status-text').value.trim());
};

document.getElementById('pref-status-text').oninput = (e) => {
syncProfileUI(colorInput.value, selectedAvatarId, e.target.value.trim());
};

avatarOptions.forEach(opt => {
opt.onclick = () => {
avatarOptions.forEach(o => o.classList.remove('selected'));
opt.classList.add('selected');
selectedAvatarId = parseInt(opt.dataset.id);
syncProfileUI(colorInput.value, selectedAvatarId, document.getElementById('pref-status-text').value.trim());
};
});

overlay.querySelector('#prof-logout-btn').onclick = async () => {
overlay.style.display = 'none';
if (await atlasConfirm("Logga ut", "Vill du verkligen logga ut från Atlas?")) handleLogout();
};

overlay.querySelector('#prof-save-btn').onclick = async () => {
const profileData = {
display_name: document.getElementById('pref-display-name').value.trim(),
status_text: document.getElementById('pref-status-text').value.trim(),
agent_color: colorInput.value,
avatar_id: selectedAvatarId
};
try {
const profRes = await fetch(`${SERVER_URL}/api/auth/update-profile`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify(profileData)
});
if (!profRes.ok) throw new Error("Kunde inte spara");
currentUser = { ...currentUser, ...profileData };
localStorage.setItem('atlas_user', JSON.stringify(currentUser));

// Uppdatera CSS-accentvariabeln omedelbart (väntar inte på socket-roundtrip)
document.documentElement.style.setProperty('--accent-primary', profileData.agent_color);
// Uppdatera sidofältets avatar, namn och statustext via den centrala funktionen
if (typeof updateProfileUI === 'function') updateProfileUI();

// Live-uppdatering av kundvyn vid profilfärgsändring
const _newColor = colorInput.value;
document.querySelectorAll('#customer-list .team-ticket-card').forEach(card => {
card.style.setProperty('border-left', `4px solid ${_newColor}`, 'important');
card.style.setProperty('--agent-color', _newColor);
const tag = card.querySelector('.ticket-tag');
if (tag) { tag.style.color = _newColor; tag.style.borderColor = _newColor + '44'; }
const badge = card.querySelector('.ticket-top-right span');
if (badge) { badge.style.color = _newColor; badge.style.background = _newColor + '22'; badge.style.borderColor = _newColor + '44'; }
});
document.querySelectorAll('#customer-ticket-list-body .team-ticket-card').forEach(card => {
card.style.setProperty('border-left', `3px solid ${_newColor}`, 'important');
card.style.setProperty('--agent-color', _newColor);
const tag = card.querySelector('.ticket-tag');
if (tag) { tag.style.color = _newColor; tag.style.borderColor = _newColor + '44'; }
});
const readerModal = document.getElementById('customer-reader-modal');
if (readerModal && readerModal.style.display !== 'none') {
const topBorder = readerModal.querySelector('.glass-modal-box');
if (topBorder) topBorder.style.borderTopColor = _newColor;
const headerBg = readerModal.querySelector('.glass-modal-box > div');
if (headerBg) headerBg.style.background = `linear-gradient(90deg, ${_newColor}14, transparent)`;
const avatarBox = readerModal.querySelector('.glass-modal-box > div div[style*="border-radius:9px"]');
if (avatarBox) { avatarBox.style.background = _newColor; avatarBox.style.boxShadow = `0 2px 10px ${_newColor}55`; }
const notesBtn = readerModal.querySelector('.notes-trigger-btn');
if (notesBtn) notesBtn.style.color = _newColor;
}
overlay.style.display = 'none';
if (typeof showToast === 'function') showToast("✅ Profilen sparad!");
} catch (e) { alert("Fel: " + e.message); }
};
}

// ==================================================
// ℹ️ ADMIN INFO MODAL (header-knapp)
// ==================================================
window.showAdminInfoModal = function() {
const _ahx = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#')) ? currentUser.agent_color : '#0071e3';
const modal = document.createElement('div');
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '20000';
modal.innerHTML = `
<div class="glass-modal-box glass-effect" style="max-width:500px; border-top:3px solid ${_ahx}; overflow:hidden;">
<div style="padding:16px 18px 14px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; gap:12px; flex-shrink:0; background:linear-gradient(90deg, ${_ahx}22, transparent);">
<div style="width:38px; height:38px; border-radius:10px; background:${_ahx}; color:black; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 12px ${_ahx}55;">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
</div>
<div>
<div style="font-size:15px; font-weight:700; color:white;">Admin-panelen</div>
<div style="font-size:10px; opacity:0.4; color:white; letter-spacing:0.3px;">Systemadministration • Atlas ${ATLAS_VERSION}</div>
</div>
</div>
<div class="glass-modal-body" style="font-size:13px; line-height:1.7;">
<div style="padding:12px; border-radius:8px; background:rgba(255,69,58,0.1); border:1px solid rgba(255,69,58,0.3); margin-bottom:16px; color:#ff6b6b;">
⚠️ <strong>Varning:</strong> Ändringar här påverkar systemets prestanda och stabilitet.
Endast behörig personal bör ändra dessa värden.
</div>
<ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:8px;">
<li><strong>Agenter</strong> — Skapa, redigera och ta bort supportpersonal. Klicka på pennan för att redigera profiluppgifter, behörighet eller lösenord. Klicka på färgväljaren för att ändra agentens profilfärg direkt.</li>
<li><strong>Kontor &amp; Utbildningar</strong> — Hantera kontor, tjänster och priser. Klicka på de enskilda lås-knapparna på varje sektion för att låsa upp redigeringsläge.</li>
<li><strong>Systemkonfiguration</strong> — AI-trösklar, nätverksinställningar och säkerhet. Känsliga fält (lösenord, API-nycklar) visas maskerade.</li>
</ul>
<div style="margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); display:grid; gap:6px; font-size:12px;">
<div style="display:flex; justify-content:space-between;"><span style="opacity:0.5;">Version</span><span>Atlas ${ATLAS_VERSION}</span></div>
<div style="display:flex; justify-content:space-between;"><span style="opacity:0.5;">Plattform</span><span>Electron / Node.js / SQLite</span></div>
<div style="display:flex; justify-content:space-between;"><span style="opacity:0.5;">Skapad av</span><span>Patrik Åkerhage</span></div>
</div>
</div>
</div>`;
document.body.appendChild(modal);
modal.style.display = 'flex';
modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
};

// ==================================================
// 📖 VY-GUIDE MODAL — öppnas från placeholders
// En detaljerad hjälpguide per vy (6 vyer totalt)
// ==================================================
window.showViewGuideModal = function(view) {
  // Agentfärg-hjälpare
  const _hex = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#'))
    ? currentUser.agent_color : '#0071e3';
  const _rgba = (a) => {
    try {
      const r = parseInt(_hex.slice(1,3),16), g = parseInt(_hex.slice(3,5),16), b = parseInt(_hex.slice(5,7),16);
      return `rgba(${r},${g},${b},${a})`;
    } catch(e) { return `rgba(0,113,227,${a})`; }
  };

  // Sektionsrubrik
  const sec = (label) =>
    `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:${_hex};font-weight:700;margin:20px 0 10px;opacity:0.85;border-bottom:1px solid ${_rgba(0.15)};padding-bottom:6px;">${label}</div>`;

  // Rad med emoji-ikon
  const row = (icon, label, text) =>
    `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:9px;">
      <span style="font-size:15px;flex-shrink:0;line-height:1.3;">${icon}</span>
      <span style="font-size:12px;color:var(--text-secondary);line-height:1.65;">
        ${label ? `<strong style="color:var(--text-primary);">${label}</strong> — ` : ''}${text || ''}
      </span>
    </div>`;

  // Inforuta (blå/varning)
  const note = (emoji, text, color) =>
    `<div style="display:flex;gap:10px;padding:10px 14px;border-radius:8px;background:${color||_rgba(0.08)};border:1px solid ${color ? 'rgba(255,69,58,0.3)' : _rgba(0.2)};margin-bottom:12px;">
      <span style="font-size:14px;flex-shrink:0;">${emoji}</span>
      <span style="font-size:12px;color:var(--text-secondary);line-height:1.6;">${text}</span>
    </div>`;

  const svgInbox = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${_hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`;
  const svgTickets = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${_hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const svgArchive = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${_hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
  const svgTemplates = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${_hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
  const svgAdmin = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${_hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const svgCustomers = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${_hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

  const configs = {
    'inbox': {
      title: 'Inkorgen',
      subtitle: 'Nya inkommande ärenden — här börjar allt',
      icon: svgInbox,
      content: `
        ${note('📬', 'Inkorgen är teamets gemensamma brevlåda. Hit hamnar alla ärenden som ännu inte tilldelats någon agent — Endast Admins ser Inkorgen')}
        ${sec('Vad syns i Inkorgen?')}
        ${row('💬', 'Chattärenden', 'Kunder som eskalerat en live-chatt från kundportalen och vill prata med en riktig person.')}
        ${row('✉️', 'Mailärenden', 'Kunder som fyllt i kontaktformuläret eller skickat ett mail direkt till er support.')}
        ${row('🏷️', 'Kontor-etikett', 'Den färgade etiketten på kortet visar vilket kontor kunden valde. Kortets färg matchar det kontoret i systemet.')}
        ${row('⏱️', 'Tidsstämpel', 'Visar när ärendet kom in eller när senaste händelse skedde.')}
        ${sec('Vad gör du med ett ärende?')}
        ${row('👆', 'Klicka', 'Öppna konversationshistoriken och se vad kunden skrivit.')}
        ${row('✋', 'Claima', 'Ta ärendet — det flyttas direkt till Mina Ärenden och du blir ansvarig agent.')}
        ${row('👤', 'Tilldela', 'Skicka ärendet till en kollega istället. Välj agent i tilldelningsmodalen.')}
        ${row('📁', 'Arkivera', 'Om ärendet inte behöver handläggas — Radera eller arkivera direkt till Garaget.')}
        ${sec('Tips')}
        ${row('🔴', 'Kolla inkorgen regelbundet', 'Inkorgen uppdateras i realtid — nytt ärende = ny rad direkt, inget sidladdning behövs.')}
        ${row('🎨', 'Färgkoder', 'Varje kontor har sin färg. Lär dig känna igen dem snabbt — du vet direkt vilket kontor ärendet tillhör utan att läsa etiketten.')}
        ${row('⚡', 'Snabbaste vägen', 'Klicka på ärendet → Läs snabbt → Svara och ärendet är ditt. Hela flödet tar under 15 sekunder.')}
      `
    },
    'my-tickets': {
      title: 'Mina Ärenden',
      subtitle: 'Dina aktiva chattar och mail — kunden väntar på dig',
      icon: svgTickets,
      content: `
        ${note('💡', 'Alla ärenden du har fått ansvar för hamnar här. Det är <strong style="color:var(--text-primary);">ditt</strong> ansvar att svara, tänk på att kunden väntar i chattarna, så prioritera dem först alltid.')}
        ${sec('Typer av ärenden')}
        ${row('💬', 'Chattärende', 'Kunden initierade en live-chatt via kundportalen och eskalerade till dig. Svar visas direkt i kundens chatt i realtid. Prioritera dessa!')}
        ${row('✉️', 'Mailärende', 'Kunden fyllde i ett kontaktformulär eller skickade mail. Alla svar samlas i samma e-posttråd — kunden ser en snygg konversation i sin inkorg.')}
        ${row('🔒', 'Internt ärende', 'Privata meddelanden mellan agenter — syns aldrig för andra. Bra för att lämna noteringar till kollegor.')}
        ${sec('Ärendekortet förklarat')}
        ${row('🖼️', 'Kuvert = Mail', 'Pratbubbla = Live-chatt')}
        ${row('👤', 'Kundnamn + Preview', 'Kundens namn och en förhandsgranskning av det senaste meddelandet i konversationen.')}
        ${row('🏷️', 'Kontors-etikett', 'Visar vilket kontor kunden skickade ärendet till.')}
        ${row('⏱️', 'Tidsstämpel', 'Tid sedan senaste händelse. Gamla ärenden syns tydligt — Prioritera dem!')}
        ${sec('Åtgärder i detaljvyn')}
        ${row('📝', 'Svara', 'Skriv ditt svar i textfältet längst ner och tryck Skicka (eller Ctrl+Enter).')}
        ${row('📋', 'Mailmallar', 'Rullgardinsmenyn ovanför svarrutan — välj en mall och texten klistras in direkt. Redigera och skicka.')}
        ${row('✨', 'AI-förslag', 'Atlas läser hela konversationshistoriken och skapar ett svar åt dig, redigera svaret vid behov och skicka.')}
        ${row('🔄', 'Auto-summering', 'Klicka på sammanfattningsikonen för att låta AI summera hela konversationen på sekunder. Ovärderligt när du tar över ett längre ärende eller behöver snabb kontext utan att läsa allt.')}
        ${row('📁', 'Arkivera chatt', '<strong style="color:var(--text-primary);">Stänger chatten permanent</strong> — kunden kopplas bort och ärendet hamnar i Garaget.')}
        ${row('📁', 'Arkivera mail', 'Mailärenden stängs <strong style="color:var(--text-primary);">aldrig permanent</strong> — svarar kunden igen återaktiveras ärendet automatiskt i Inkorgen med hela historiken intakt.')}
        ${row('🗑️', 'Radera', 'Tar bort ärendet permanent. Används sällan — arkivera hellre.')}
        ${sec('Tips')}
        ${row('⚡', 'AI-förslaget', 'Prova det för mailärenden främst — det sparar enormt mycket tid och håller hög kvalitet på svaren.')}
        ${row('🔄', 'Summering vid överlämning', 'Kör auto-summering innan du lämnar ett ärende till kollegan — hen ser direkt vad ärendet handlar om.')}
        ${row('🎯', 'Arkivera lösta ärenden direkt', 'En tom Mina Ärenden = alla kunder är omhändertagna.')}
      `
    },
    'archive': {
      title: 'Garaget',
      subtitle: 'Arkiverade och stängda ärenden — historiken lever här',
      icon: svgArchive,
      content: `
        ${note('🗄️', 'Garaget är arkivet för alla avslutade ärenden. Inget försvinner — allt är sökbart och läsbart här. Perfekt för uppföljning, statistik och att lära sig av tidigare konversationer.')}
        ${sec('Vad syns i Garaget?')}
        ${row('✅', 'Manuellt arkiverade', 'Ärenden du eller en kollega arkiverade via Arkivera-knappen i Mina Ärenden eller Inkorgen.')}
        ${row('⏰', 'Inaktivitets-stängda', 'Chattar där kunden slutade svara och systemets inaktivitetstimer stängde ärendet automatiskt.')}
        ${row('🤖', 'AI-hanterade chattar', 'Chattar som Atlas AI skötte helt utan mänsklig inblandning — visas om "Visa AI-ärenden" är aktiverat.')}
        ${sec('Filter och sökning')}
        ${row('🔍', 'Sökfältet', 'Sök på kundnamn, e-postadress eller nyckelord ur konversationen.')}
        ${row('📅', 'Datumfilter', 'Filtrera på tidsperiod — visa ärenden från specifika datum.')}
        ${row('☑️', 'Visa AI-ärenden', 'Checkboxen längst upp — döljer/visar chattar som aldrig eskalerade till mänsklig agent. Avmarkera för en renare lista.')}
        ${row('🏷️', 'Kontorsfilter', 'Filtrera ärenden per kontor eller kanal (chatt/mail).')}
        ${sec('I detaljvyn')}
        ${row('📜', 'Hela historiken', 'Läs hela konversationen från start till slut. Kundmeddelanden och agentens svar visas i kronologisk ordning.')}
        ${row('🔄', 'Bläddra', 'Navigera mellan arkiverade ärenden med pilknapparna i headern utan att stänga detaljvyn.')}
        ${sec('Tips')}
        ${row('📊', 'Bra för statistik', 'Granska gamla ärenden för att hitta mönster — vilka frågor ställs mest? Saknas en mailmall för det?')}
        ${row('🔎', 'Slå upp historik', 'Behöver du se vad som sades i ett gammalt ärende? Sök på kundens namn direkt.')}
      `
    },
    'templates': {
      title: 'Mailmallar',
      subtitle: 'Delade svarsmallar för hela teamet',
      icon: svgTemplates,
      content: `
        ${note('📋', 'Mailmallar är teamets gemensamma bibliotek av förberedda svar. Alla agenter ser samma mallar, sparade centralt på servern — ingen synkronisering behövs.')}
        ${sec('Vad är en mailmall?')}
        ${row('📝', 'Färdigt svar', 'En mall är ett förskrivet svar för vanliga frågor — ex. prisförfrågan, bokningsbekräftelse, välkomstmeddelande. Spara tid och håll hög kvalitet.')}
        ${row('✏️', 'Rich Text', 'Mallarna stödjer fetstil, rubriker, listor och mer. Texten ser professionell ut i kundens e-postinkorg (Outlook, Gmail etc.).')}
        ${row('⚡', 'Direktinklistring', 'I Mina Ärenden finns en mallmeny direkt ovanför svarrutan — välj mall och texten klistras in på ett ögonblick.')}
        ${sec('Skapa och redigera mallar')}
        ${row('➕', 'Ny mall', 'Klicka på "+ Ny mall"-knappen högst upp i listan. Ge mallen ett beskrivande namn.')}
        ${row('✏️', 'Redigera', 'Klicka på en mall i listan — editorn öppnas till höger. Skriv och formatera innehållet.')}
        ${row('💾', 'Spara', 'Klicka på diskettikonen uppe till höger i editorn. Mallen sparas direkt och är tillgänglig för hela teamet.')}
        ${row('🗑️', 'Radera', 'Välj mall och klicka på raderingsknappen. Bekräfta i dialogrutan — åtgärden är permanent.')}
        ${sec('Använda mallar när du svarar')}
        ${note('📥', 'Mallarna finns på <strong style="color:var(--text-primary);">två ställen</strong>: här i Mailmallar-vyn för att skapa/redigera, <strong style="color:var(--text-primary);">och direkt i Inkorgen och Mina Ärenden</strong> — öppna ett ärende, scrolla ner till svarsrutan och välj mall ur rullgardinsmenyn ovanför textrutan.')}
        ${row('1️⃣', 'Öppna ärendet', 'Gå till Mina Ärenden eller Inkorgen och klicka på ett mail- eller chattärende.')}
        ${row('2️⃣', 'Välj mall i svarsrutan', 'Rullgardinsmenyn ovanför chattinputen visar alla mallar. Välj mall → texten klistras in direkt.')}
        ${row('3️⃣', 'Redigera och skicka', 'Anpassa texten efter kunden och tryck Skicka (eller Ctrl+Enter).')}
        ${sec('Tips för bra mallar')}
        ${row('🏷️', 'Namnge smart', 'Använd tydliga namn: "Pris MC Göteborg", "Bekräftelse bokning", "Välkommen ny kund". Alla hittar rätt snabbt.')}
        ${row('🔄', 'Håll dem uppdaterade', 'Ändrades priserna? Uppdatera mallen direkt — alla agenter får den korrekta versionen automatiskt.')}
        ${row('💡', 'Skapa mallar för top 5', 'Lista de 5 vanligaste frågorna du svarar på och skapa en mall för var och en. Sparar timmar i veckan.')}
      `
    },
    'admin': {
      title: 'Admin',
      subtitle: 'Systemadministration — agenter, kontor & konfiguration',
      icon: svgAdmin,
      content: `
        ${note('⚠️', 'Admin-panelen är känslig. Ändringar tillämpas omedelbart och kan påverka systemets funktioner. Kontakta systemansvarig om du är osäker.', 'rgba(255,69,58,0.08)')}
        ${sec('Agenter')}
        ${row('👤', 'Se alla agenter', 'Listan visar samtliga supportpersoner i systemet — både ADMIN och AGENT-roller.')}
        ${row('✏️', 'Redigera profil', 'Klicka på pennan bredvid en agent för att ändra: namn, användarnamn, roll, lösenord och vilka vyer agenten har åtkomst till.')}
        ${row('🎨', 'Byta agentfärg', 'Klicka på färgplattan på agentkortet — en färgväljare öppnas. Ändringen syns direkt i hela gränssnittet för den agenten.')}
        ${row('📋', 'Visa agentens ärenden', 'Klicka på en agent för att se deras aktiva ärenden, statistik och kontorskoppling.')}
        ${row('➕', 'Ny agent', 'Klicka på "+ Ny agent" för att skapa ett nytt konto. Fyll i namn, användarnamn, lösenord och välj roll.')}
        ${sec('Kontor & Utbildningar')}
        ${row('🏢', 'Kontorsinfo', 'Namn, stad, telefon, öppettider och adress per kontor. Låsikonen i varje sektion — klicka för att låsa upp och redigera.')}
        ${row('📚', 'Utbildningar & Tjänster', 'Vilka körkortsbehörigheter och tjänster som erbjuds per kontor. Kopplas till RAG-systemet.')}
        ${row('💰', 'Priser', 'Prislista per kontor och tjänst. Uppdatera här och Atlas AI svarar med korrekta priser direkt.')}
        ${sec('Systemkonfiguration')}
        ${row('🤖', 'AI-parametrar', 'Tröskelvärden för intentmatchning och RAG-systemet. Påverkar hur Atlas AI tolkar kundfrågor — ändra varsamt.')}
        ${row('🌐', 'Nätverksinställningar', 'Portar, CORS-inställningar och timeout-värden för servern.')}
        ${row('🔑', 'API-nycklar', 'Visas maskerade av säkerhetsskäl. Klicka för att visa. Håll dem hemliga — dela aldrig.')}
        ${sec('Broadcast')}
        ${row('📡', 'Skicka notis-meddelande', 'Klicka på broadcast-ikonen på en agent eller ett kontor för att skicka ett direkt meddelande. Det poppar upp i mottagarens gränssnitt.')}
        ${row('👥', 'Till hela teamet', 'Skicka till alla inloggade agenter samtidigt — bra för akuta driftmeddelanden.')}
        ${sec('Tips')}
        ${row('💾', 'Spara alltid', 'Klicka alltid på Spara efter ändringar — många sektioner kräver ett explicit spara-steg.')}
        ${row('📞', 'Vid tveksamhet', 'Kontakta alltid systemansvarig innan du ändrar i Systemkonfiguration. Fel inställningar kan ta ner tjänsten.')}
      `
    },
    'customers': {
      title: 'Kundregistret',
      subtitle: 'Ärendehistorik och kundanalys — alla kunder på ett ställe',
      icon: svgCustomers,
      content: `
        ${note('👥', 'Kundregistret samlar automatiskt alla kunder som kontaktat er — oavsett om det skedde via chatt eller mail. Söker du efter en kund hittar du hela historiken direkt. En kund skapas automatiskt via kundens epost och/eller mobilnummer ')}
        ${sec('Sökning')}
        ${row('🔍', 'Sökfältet', 'Skriv minst 3 tecken — namn, e-postadress eller telefonnummer. Systemet söker och visar matchande kunder direkt.')}
        ${row('📋', 'Sökresultaten', 'Varje rad visar kundnamn, e-post och antal ärenden. Klicka på en kund i listan för att öppna kundkortet.')}
        ${sec('Kundkortet')}
        ${row('📊', 'Statistik', 'Antal ärenden per kanal (chatt/mail), första kontakt och senaste aktivitet.')}
        ${row('📜', 'Ärendehistorik', 'Alla ärenden kunden haft — klicka på ett ärende för att läsa hela konversationen.')}
        ${row('🔄', 'Alltid aktuellt', 'Registret uppdateras automatiskt när nya ärenden skapas — inget manuellt underhåll krävs.')}
        ${sec('Åtgärder')}
        ${row('✉️', 'Skicka mail', 'Starta ett nytt mailärende direkt från kundkortet — kundens e-postadress är förifylld automatiskt.')}
        ${row('✨', 'AI-analys', 'Knappen i kundheadern låter Atlas AI sammanfatta hela kundens historik. Perfekt kontext innan du ringer eller svarar. Resultatet cachas under sessionen.')}
        ${row('📝', 'Anteckningar', 'Lägg interna noteringar om kunden — synliga för alla agenter men aldrig för kunden. Bra för allergier, specialönskemål eller återkommande kunder.')}
        ${sec('Tips')}
        ${row('🎯', 'Kolla alltid kontext', 'Slå upp kunden innan du svarar — har hen ärenden sedan tidigare? Vad handlade de om? Det lyfter kvaliteten enormt.')}
        ${row('⚡', 'AI-analysen', 'Kör den en gång per kund — du får en snabb sammanfattning på 5 sekunder som annars hade tagit 5 minuter att läsa igenom.')}
      `
    }
  };

  const data = configs[view] || configs['inbox'];

  const overlay = document.createElement('div');
  overlay.className = 'custom-modal-overlay';
  overlay.style.zIndex = '20000';
  overlay.innerHTML = `
    <div class="glass-modal-box glass-effect" style="width:560px;max-width:92vw;max-height:84vh;border-top:3px solid ${_hex};padding:0;display:flex;flex-direction:column;overflow:hidden;">
      <!-- Fade-header i agentfärg -->
      <div style="padding:20px 24px 16px;background:linear-gradient(135deg,${_rgba(0.12)} 0%,transparent 70%);border-bottom:1px solid ${_rgba(0.18)};display:flex;align-items:center;gap:14px;flex-shrink:0;">
        <div style="width:42px;height:42px;border-radius:12px;background:${_rgba(0.15)};border:1px solid ${_rgba(0.3)};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${data.icon}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:800;color:${_hex};letter-spacing:0.3px;">${data.title}</div>
          <div style="font-size:11px;opacity:0.4;margin-top:2px;">${data.subtitle}</div>
        </div>
      </div>
      <!-- Scrollbar body -->
      <div style="flex:1;overflow-y:auto;padding:4px 24px 16px;">
        ${data.content}
      </div>
      <!-- Footer -->
      <div style="padding:10px 24px;border-top:1px solid ${_rgba(0.12)};display:flex;align-items:center;flex-shrink:0;background:${_rgba(0.03)};">
        <span style="font-size:11px;opacity:0.25;">Atlas Support Guide v4.0</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.style.display = 'flex';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
};

// ==================================================
// NYTT MAIL — KOMPOSITOR
// ==================================================
function showNewMailComposer(options = {}) {
let modal = document.getElementById('atlas-mail-composer');

// Fält finns redan (andra anropet) — sätt värden och visa utan att återskapa
if (modal && document.getElementById('composer-to')) {
document.getElementById('composer-to').value = options.recipient || '';
document.getElementById('composer-subject').value = options.subject || '';
document.getElementById('composer-body').value = options.body || '';
modal.style.display = 'flex';
// Sätt rätt mode via befintliga knappar (setMode är bunden till första anropets closure)
if (options.isInternal) {
  const intBtn = document.getElementById('btn-mode-internal');
  if (intBtn) intBtn.click();
} else {
  const extBtn = document.getElementById('btn-mode-external');
  if (extBtn) extBtn.click();
}
if (options.isInternal && options.recipient) {
  setTimeout(() => {
    const agentCards = modal.querySelectorAll('.agent-select-card');
    agentCards.forEach(card => {
      if (card.dataset.username === options.recipient) card.click();
    });
  }, 50);
} else {
  setTimeout(() => { if (!options.isInternal) document.getElementById('composer-to').focus(); }, 50);
}
modal.dataset.appendAfterSend = options.appendAfterSend || '';
return;
}

// Statiskt skal från index.html finns men saknar formuläret — eller modal saknas helt
if (!modal) {
modal = document.createElement('div');
modal.id = 'atlas-mail-composer';
modal.className = 'custom-modal-overlay';
modal.style.display = 'none';
document.body.appendChild(modal);
}
// Injicera fullt formulär-HTML (ersätter det tomma statiska skalet)
const _nmHex = (typeof currentUser !== 'undefined' && currentUser?.agent_color?.startsWith?.('#')) ? currentUser.agent_color : '#0071e3';

const mailIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
const internalIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

modal.innerHTML = `
<div class="glass-modal-box glass-effect" style="border-top:3px solid ${_nmHex};">
<div class="glass-modal-header" style="flex-direction: column; align-items: flex-start; gap: 8px; padding:12px 18px;">
<h3 style="display:flex; align-items:center; gap:12px; margin:0; font-size:1rem; color:${_nmHex};">Nytt meddelande</h3>
<div style="display:flex; background:rgba(255,255,255,0.1); border-radius:8px; padding:3px; width:100%;">
<button id="btn-mode-external" class="toggle-mode-btn active" style="flex:1; border:none; background:var(--accent-primary); color:white; padding:6px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13px;">
${mailIconSvg} Externt Mail
</button>
<button id="btn-mode-internal" class="toggle-mode-btn" style="flex:1; border:none; background:transparent; color:#aaa; padding:6px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13px;">
${internalIconSvg} Internt
</button>
</div>
</div>
<div class="glass-modal-body" style="padding:10px 18px;">
<div style="margin-bottom:10px;">
<label id="label-recipient" style="display:block; color:#aaa; font-size:10px; text-transform:uppercase; margin-bottom:4px; font-weight:bold;">Mottagare:</label>
<input type="text" id="composer-to" list="composer-to-suggestions" placeholder="kund@exempel.se" autocomplete="off" style="width:100%; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; font-size:13px;">
<datalist id="composer-to-suggestions"></datalist>
<div id="composer-agent-grid" class="agent-grid" style="display:none; max-height: 120px; overflow-y: auto; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px;"></div>
<input type="hidden" id="selected-internal-agent">
</div>
<div id="composer-subject-row" style="margin-bottom:10px;">
<label style="display:block; color:#aaa; font-size:10px; text-transform:uppercase; margin-bottom:4px; font-weight:bold;">Ämne / Rubrik:</label>
<input type="text" id="composer-subject" placeholder="Vad gäller ärendet?" style="width:100%; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; font-size:13px;">
</div>
<div style="margin-bottom:0;">
<label style="display:block; color:#aaa; font-size:10px; text-transform:uppercase; margin-bottom:4px; font-weight:bold;">Meddelande:</label>
<textarea id="composer-body" placeholder="Skriv ditt meddelande här..." style="width:100%; height:95px; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; resize:none; font-family:inherit; font-size:13px; line-height:1.5;"></textarea>
<div style="display:flex; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap;" id="composer-file-area">
<label for="composer-file-input" style="cursor:pointer; padding:6px 12px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); font-size:13px; display:inline-flex; align-items:center; gap:6px; color:var(--text-secondary);">📎 Bifoga fil</label>
<input type="file" id="composer-file-input" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style="display:none;">
<span id="composer-file-status" style="font-size:12px; color:var(--text-secondary); font-style:italic;"></span>
</div>
</div>
</div>
<div id="composer-info-box" style="margin-bottom:8px; padding:8px 12px; border-radius:8px; font-size:11px; line-height:1.5; background:rgba(0,113,227,0.07); border:1px solid rgba(0,113,227,0.2); color:rgba(255,255,255,0.5); display:none;"></div>
<div class="glass-modal-footer" style="justify-content:flex-end;">
<button id="composer-send" class="btn-modal-confirm" style="width:38px; height:38px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:10px; flex-shrink:0;" title="Skicka">
${UI_ICONS.SEND}
</button>
</div>
</div>`;

// Fil-upload i composer — ladda upp direkt, patcha conversation_id när ärendet skapats
let _composerUploadedFiles = []; // { filename, url, originalName }

const composerFileInput = modal.querySelector('#composer-file-input');
const composerFileStatus = modal.querySelector('#composer-file-status');

if (composerFileInput) {
composerFileInput.addEventListener('change', async (e) => {
const file = e.target.files?.[0];
if (!file) return;
composerFileStatus.textContent = '⏳ Laddar upp...';
try {
const formData = new FormData();
formData.append('file', file);
formData.append('session_id', 'unknown');
const res = await fetch(`${SERVER_URL}/api/upload`, {
method: 'POST',
headers: { 'Authorization': fetchHeaders['Authorization'] },
body: formData
});
if (!res.ok) throw new Error('Uppladdning misslyckades');
const data = await res.json();
_composerUploadedFiles.push({
filename: data.filename || data.url.split('/').pop(),
url: data.url,
originalName: data.originalName || file.name
});
const textarea = modal.querySelector('#composer-body');
if (textarea) {
const isImage = file.type.startsWith('image/');
const markdown = isImage
? `\n![Bild](${data.url})\n`
: `\n📎 [Fil: ${data.originalName || file.name}](${data.url})\n`;
if (!window._pendingAttachments) window._pendingAttachments = new Map();
const existingMarkdown = window._pendingAttachments.get(textarea.id) || '';
window._pendingAttachments.set(textarea.id, existingMarkdown + '\n' + markdown);
const statusText = isImage ? '📷 Bild inklistrad — skickas med meddelandet' : `📎 Fil bifogad: ${file.name} — skickas med meddelandet`;
textarea.placeholder = statusText;
if (!textarea.value.trim()) textarea.value = '';
}
composerFileStatus.textContent = `✅ ${file.name} bifogad`;
setTimeout(() => { composerFileStatus.textContent = ''; }, 3000);
} catch (err) {
composerFileStatus.textContent = '❌ ' + err.message;
} finally {
composerFileInput.value = '';
}
});

const composerTextarea = modal.querySelector('#composer-body');
if (composerTextarea) {
composerTextarea.addEventListener('paste', async (e) => {
const items = e.clipboardData?.items;
if (!items) return;
for (const item of Array.from(items)) {
if (item.type.startsWith('image/')) {
e.preventDefault();
const file = item.getAsFile();
if (!file) break;
composerFileStatus.textContent = '⏳ Laddar upp...';
try {
const formData = new FormData();
formData.append('file', file);
formData.append('session_id', 'unknown');
const res = await fetch(`${SERVER_URL}/api/upload`, {
method: 'POST',
headers: { 'Authorization': fetchHeaders['Authorization'] },
body: formData
});
if (!res.ok) throw new Error('Fel');
const data = await res.json();
_composerUploadedFiles.push({
filename: data.filename || data.url.split('/').pop(),
url: data.url,
originalName: data.originalName || 'inklistrad-bild.png'
});
const markdown = `\n![Bild](${data.url})\n`;
if (!window._pendingAttachments) window._pendingAttachments = new Map();
const existingMarkdown = window._pendingAttachments.get(composerTextarea.id) || '';
window._pendingAttachments.set(composerTextarea.id, existingMarkdown + '\n' + markdown);
composerTextarea.placeholder = '📷 Bild inklistrad — skickas med meddelandet';
if (!composerTextarea.value.trim()) composerTextarea.value = '';
composerFileStatus.textContent = '✅ Bild bifogad';
setTimeout(() => { composerFileStatus.textContent = ''; }, 3000);
} catch (err) {
composerFileStatus.textContent = '❌ ' + err.message;
}
break;
}
}
});
}
}

let isInternalMode = false;
const btnExt = document.getElementById('btn-mode-external');
const btnInt = document.getElementById('btn-mode-internal');
const toInp = document.getElementById('composer-to');
const subInp = document.getElementById('composer-subject');
const bodyInp = document.getElementById('composer-body');
const labelRec = document.getElementById('label-recipient');
const agentGrid = document.getElementById('composer-agent-grid');

btnExt.onclick = () => setMode(false);
btnInt.onclick = () => setMode(true);

setMode(options.isInternal === true ? true : false);

modal.style.display = 'flex';
modal.dataset.appendAfterSend = options.appendAfterSend || '';
toInp.value = options.recipient || '';
subInp.value = options.subject || '';
bodyInp.value = options.body || '';
if (options.isInternal && options.recipient) {
  setTimeout(() => {
    const agentCards = modal.querySelectorAll('.agent-select-card');
    agentCards.forEach(card => {
      if (card.dataset.username === options.recipient) card.click();
    });
  }, 50);
} else {
  setTimeout(() => { if (!isInternalMode) toInp.focus(); }, 50);
}
modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

// Hämta kända e-postadresser för autocomplete (tyst — inga fel visas)
fetch(`${SERVER_URL}/api/team/known-emails`, { headers: fetchHeaders })
.then(r => r.ok ? r.json() : null)
.then(data => {
const dl = document.getElementById('composer-to-suggestions');
if (!dl || !data?.emails?.length) return;
dl.innerHTML = data.emails.map(e => `<option value="${e}"></option>`).join('');
})
.catch(() => {});

document.getElementById('composer-send').onclick = async () => {
const subject = isInternalMode ? 'Internt meddelande' : subInp.value.trim();
const pendingMarkdown = window._pendingAttachments?.get(bodyInp.id) || '';
if (pendingMarkdown) {
  bodyInp.value = (bodyInp.value.trim() + '\n\n' + pendingMarkdown.trim()).trim();
  window._pendingAttachments.delete(bodyInp.id);
}
const appendAfterSend = modal.dataset.appendAfterSend || '';
const body = (bodyInp.value.trim() + appendAfterSend).trim();
const recipient = isInternalMode ? document.getElementById('selected-internal-agent').value : toInp.value.trim();

if (isInternalMode) {
if (!recipient) { showToast("⚠️ Välj en kollega att skicka till!"); return; }
} else {
if (!recipient || !recipient.includes('@')) { showToast("⚠️ Ange giltig e-postadress!"); return; }
if (!subject) { showToast("⚠️ Ange ett ämne!"); return; }
}
if (!body) { showToast("⚠️ Skriv ett meddelande!"); return; }

const btn = document.getElementById('composer-send');
btn.disabled = true;

try {
let newConversationId = null;
if (isInternalMode) {
const res = await fetch(`${SERVER_URL}/api/team/create-internal`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ recipient, subject, message: body })
});
const data = await res.json();
if (!data.success) throw new Error(data.error);
newConversationId = data.conversationId;
} else {
// team:create_mail_ticket — servern skapar ärendet, skickar mail och
// sparar sentInfo.messageId direkt → korrekt e-posttrådning från svar #1.
// socketAPI.once() finns via socket-client.js — avregistreras automatiskt efter första svar.
if (!window.socketAPI) throw new Error("Ingen socket-anslutning");
newConversationId = await new Promise((resolve, reject) => {
const timeout = setTimeout(() => reject(new Error('Timeout — inget svar från servern')), 10000);
window.socketAPI.once('mail:ticket_created', (data) => { clearTimeout(timeout); resolve(data.conversationId); });
window.socketAPI.once('server:error', (data) => { clearTimeout(timeout); reject(new Error(data.message)); });
window.socketAPI.emit('team:create_mail_ticket', {
customerEmail: recipient,
customerName: null,
subject: subject,
message: body,
html: body
  .replace(/!\[([^\]]*)\]\(\/uploads\/([^)]+)\)/g,
    (_, alt, f) => `<img src="${SERVER_URL}/api/public/uploads/${f}" alt="${alt || 'Bild'}" style="max-width:100%; border-radius:4px;">`)
  .replace(/📎 \[Fil: ([^\]]+)\]\(\/uploads\/([^)]+)\)/g,
    (_, name, f) => `<a href="${SERVER_URL}/api/public/uploads/${f}" target="_blank">📎 ${name}</a>`)
  .replace(/\n/g, '<br>')
});
});
}

// Patcha conversation_id på uppladdade filer
if (_composerUploadedFiles.length > 0 && newConversationId) {
for (const f of _composerUploadedFiles) {
fetch(`${SERVER_URL}/api/upload/patch-conversation`, {
method: 'POST',
headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ filename: f.filename, conversation_id: newConversationId })
}).catch(err => console.warn('[Upload-Patch]', err.message));
}
_composerUploadedFiles = [];
}

modal.style.display = 'none';
modal.dataset.appendAfterSend = '';
bodyInp.placeholder = 'Skriv ditt meddelande här...';
if (typeof playNotificationSound === 'function') playNotificationSound();

setTimeout(async () => {
if (typeof renderMyTickets === 'function') await renderMyTickets();
if (typeof switchView === 'function') switchView('my-tickets');
const fakeTicket = {
conversation_id: newConversationId,
session_type: isInternalMode ? 'internal' : 'message',
subject: subject,
owner: currentUser.username,
sender: currentUser.username,
contact_email: isInternalMode ? '' : recipient,
messages: [{ sender: currentUser.username, text: body, timestamp: Date.now(), role: 'agent' }]
};
if (typeof openMyTicketDetail === 'function') openMyTicketDetail(fakeTicket);
}, 600);
} catch (err) {
showToast("❌ Fel: " + err.message);
btn.innerText = "Skicka";
btn.disabled = false;
}
};

function setMode(internal) {
const btnExt = document.getElementById('btn-mode-external');
const btnInt = document.getElementById('btn-mode-internal');
const toInp = document.getElementById('composer-to');
const agentGrid = document.getElementById('composer-agent-grid');
const labelRec = document.getElementById('label-recipient');
const infoBox = document.getElementById('composer-info-box');
isInternalMode = internal;
if (internal) {
btnInt.style.background = 'var(--accent-primary)';
btnInt.style.color = 'white';
btnExt.style.background = 'transparent';
btnExt.style.color = '#aaa';
toInp.style.display = 'none';
agentGrid.style.display = 'grid';
labelRec.innerText = "MOTTAGARE (INTERN):";
const subjectRow = document.getElementById('composer-subject-row');
if (subjectRow) subjectRow.style.display = 'none';
if (infoBox) { infoBox.style.display = 'block'; infoBox.textContent = '🔒 Interna ärenden syns endast lokalt för dig och mottagaren, även i Garaget vid arkivering.'; }
loadAgents();
} else {
btnExt.style.background = 'var(--accent-primary)';
btnExt.style.color = 'white';
btnInt.style.background = 'transparent';
btnInt.style.color = '#aaa';
agentGrid.style.display = 'none';
toInp.style.display = 'block';
labelRec.innerText = "MOTTAGARE (E-POST):";
const subjectRow = document.getElementById('composer-subject-row');
if (subjectRow) subjectRow.style.display = '';
if (infoBox) { infoBox.style.display = 'block'; infoBox.textContent = '📧 Nytt ärende skapas via e-post och hamnar i kundens E-post-inkorg. Ärendet syns sen för hela teamet i systemet.'; }
}
}
}

// Koppla knapp och Ctrl+M – globalt
const btnNewMailMyTickets = document.getElementById('new-mail-btn-my-tickets');
if (btnNewMailMyTickets) {
btnNewMailMyTickets.onclick = () => showNewMailComposer();
}

document.addEventListener('keydown', (event) => {
if (event.ctrlKey && event.key === 'm') {
event.preventDefault();
showNewMailComposer();
}
});

// Hjälpfunktioner – globala
async function loadAgents() {
const agentGrid = document.getElementById('composer-agent-grid');
if (!agentGrid) return;
try {
const res = await fetch(`${SERVER_URL}/api/auth/users`, { headers: fetchHeaders });
const users = await res.json();
const agents = users.filter(u => u.username.toLowerCase() !== 'admin')
.sort((a, b) => {
const nameA = a.display_name || formatName(a.username);
const nameB = b.display_name || formatName(b.username);
return nameA.localeCompare(nameB, 'sv');
});
agentGrid.innerHTML = agents.map(u => {
const displayName = u.display_name || formatName(u.username);
const avatarHtml = getAvatarBubbleHTML(u, "30px");
return `
<div class="agent-card internal-select" onclick="window.selectInternalAgent(this, '${escAttr(u.username)}', '${u.agent_color || '#0071e3'}')"
style="border-left: 4px solid ${u.agent_color || '#0071e3'}; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; display: flex; align-items: center; gap: 10px; transition: all 0.15s;" data-color="${u.agent_color || '#0071e3'}">
${avatarHtml}
<div style="overflow: hidden;">
<div style="font-size: 11px; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName}</div>
${u.status_text ? `<div style="font-size: 10px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${u.status_text}">💬 ${u.status_text.substring(0, 40)}</div>` : ''}
</div>
</div>`;
}).join('');
} catch(e) {
console.error("LoadAgents Error:", e);
agentGrid.innerHTML = '<div style="color: #ff6b6b; padding: 10px;">Kunde inte ladda agenter</div>';
}
}

window.selectInternalAgent = (el, username, color) => {
const c = color || '#0071e3';
document.querySelectorAll('.internal-select').forEach(card => {
card.style.background = 'rgba(255,255,255,0.03)';
card.style.outline = 'none';
card.style.boxShadow = 'none';
});
el.style.background = c + '22';
el.style.outline = `2px solid ${c}`;
el.style.boxShadow = `0 0 10px ${c}33`;
document.getElementById('selected-internal-agent').value = username;
};