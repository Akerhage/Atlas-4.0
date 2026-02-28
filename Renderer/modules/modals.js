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

// ============================================================================
// 🎨 ATLAS CONFIRM - Snygg Ja/Nej-ruta (SÄKRAD)
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
<div class="glass-modal-box">
<div class="glass-modal-header"><h3 id="confirm-title"></h3></div>
<div class="glass-modal-body"><p id="confirm-message" style="margin: 15px 0 25px 0;"></p></div>
<div class="glass-modal-footer" style="justify-content:center; gap:15px;">
<button id="confirm-cancel" class="btn-modal-cancel">Avbryt</button>
<button id="confirm-ok" class="btn-modal-confirm">${sendIcon} OK</button>
</div>
</div>`;
document.body.appendChild(modal);
}

modal.querySelector('#confirm-title').innerText = title;
modal.querySelector('#confirm-message').innerText = message;
modal.style.display = 'flex';

const btnOk = modal.querySelector('#confirm-ok');
const btnCancel = modal.querySelector('#confirm-cancel');
const newOk = btnOk.cloneNode(true);
const newCancel = btnCancel.cloneNode(true);
btnOk.parentNode.replaceChild(newOk, btnOk);
btnCancel.parentNode.replaceChild(newCancel, btnCancel);

newOk.onclick = () => { modal.style.display = 'none'; resolve(true); };
newCancel.onclick = () => { modal.style.display = 'none'; resolve(false); };
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
<div class="glass-modal-box">
<div class="glass-modal-header">
<h3 id="prompt-title"></h3>
</div>
<div class="glass-modal-body">
<p id="prompt-message"></p>
<textarea id="prompt-input" style="width:100%; height:80px; padding:10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; resize:none; font-family:inherit; font-size:14px; margin-top:10px;"></textarea>
</div>
<div class="glass-modal-footer">
<button id="prompt-cancel" class="btn-modal-cancel">Avbryt</button>
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
const cancelBtn = modal.querySelector('#prompt-cancel');

titleEl.textContent = title;
msgEl.textContent = message;

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
cancelBtn.onclick = null;
resolve(val);
};

confirmBtn.onclick = () => close(inputEl.value);
cancelBtn.onclick = () => close(null);
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
onclick="window.executeAssign('${ticket.conversation_id}', '${u.username}', '${displayName}')" 
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

// 2. TOTALRENSA alla detaljvyer (Inkorg OCH Mina Ärenden) för att slippa ghosting
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

console.log(`✅ Ärendet har skickats till ${targetAgent}!`);
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

// TAJTAD LAYOUT - Optimerad för att slippa scroll
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
<input type="text" id="pref-display-name" value="${me.display_name || ''}" placeholder="${formatName(me.username)}" style="padding: 8px 12px; font-size: 13px;">

<label style="margin-top: 10px; font-size: 10px; text-transform: uppercase; opacity: 0.4; margin-bottom: 4px;">Statusmeddelande</label>
<input type="text" id="pref-status-text" value="${me.status_text || ''}" placeholder="Vad gör du just nu?" maxlength="40" style="padding: 8px 12px; font-size: 13px;">
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
<input type="password" id="old-pass" placeholder="Nuvarande" style="margin-top:0; font-size: 12px; padding: 8px 12px;">
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
<input type="password" id="new-pass" placeholder="Nytt" style="font-size: 12px; padding: 8px 12px;">
<input type="password" id="confirm-pass" placeholder="Bekräfta" style="font-size: 12px; padding: 8px 12px;">
</div>
</div>
</div>

<div class="glass-modal-footer" style="flex-shrink: 0; padding: 12px 20px; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05);">
<button id="prof-logout-btn" title="Logga ut" style="background: rgba(255,69,58,0.1); border: 1px solid rgba(255,69,58,0.2); color: #ff453a; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0 !important;">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
</button>
<div style="flex:1"></div>
<button class="btn-glass-icon" title="Avbryt" style="width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0;" onclick="document.getElementById('atlas-profile-modal').style.display='none'">
${ADMIN_UI_ICONS.CANCEL}
</button>
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

// LIVE SYNC LOGIK (KOMPLETT: Realtid, Inga dubbletter & Korrekt Logik)
const syncProfileUI = (color, avatarId, statusText) => {
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
nameEl.innerHTML = '<span style="display:block; font-weight:600; color:white;">' + (displayName.charAt(0).toUpperCase() + displayName.slice(1)) + '</span>' + statusHtml;
}

// 4. Spara-knappen (Döda det hårdkodade gröna)
const saveBtn = document.getElementById('prof-save-btn');
if (saveBtn) {
saveBtn.style.setProperty('color', color, 'important');
saveBtn.style.setProperty('border-color', color + '4d', 'important');
saveBtn.style.setProperty('background', color + '1a', 'important');
}

// 5. Mallar-listan
const templatesView = document.getElementById('view-templates');
if (templatesView && templatesView.style.display === 'flex') {
if (typeof renderTemplates === 'function') {
renderTemplates();
}
}
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
const sideName = document.getElementById('current-user-name');
if (sideName) sideName.innerText = profileData.display_name || formatName(currentUser.username);
overlay.style.display = 'none';
if (typeof showToast === 'function') showToast("✅ Profilen sparad!");
} catch (e) { alert("Fel: " + e.message); }
};
}

// ==================================================
// ℹ️ ADMIN INFO MODAL
// ==================================================
window.showAdminInfoModal = function() {
const modal = document.createElement('div');
modal.className = 'custom-modal-overlay';
modal.style.zIndex = '20000';
modal.innerHTML = `
<div class="glass-modal-box glass-effect" style="max-width:500px;">
<div class="glass-modal-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
<h3 style="margin:0;">Om Admin-panelen</h3>
<button onclick="this.closest('.custom-modal-overlay').remove()" style="background:none; border:none; color:var(--text-primary); opacity:0.6; cursor:pointer; padding:4px; font-size:18px; line-height:1; margin-top:-2px; flex-shrink:0;" title="Stäng">✕</button>
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
// 📧 NYTT MAIL – GLOBAL SCOPE (UTANFÖR ALLA FUNKTIONER)
// ==================================================
function showNewMailComposer() {
let modal = document.getElementById('atlas-mail-composer');

// Fält finns redan (andra anropet) — töm och visa utan att återskapa
if (modal && document.getElementById('composer-to')) {
document.getElementById('composer-to').value = '';
document.getElementById('composer-subject').value = '';
document.getElementById('composer-body').value = '';
modal.style.display = 'flex';
setTimeout(() => document.getElementById('composer-to').focus(), 50);
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

const mailIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
const internalIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

modal.innerHTML = `
<div class="glass-modal-box glass-effect">
<div class="glass-modal-header" style="flex-direction: column; align-items: flex-start; gap: 8px; padding:12px 18px;">
<h3 style="display:flex; align-items:center; gap:12px; margin:0; font-size:1rem;">Nytt meddelande</h3>
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
<input type="text" id="composer-to" placeholder="kund@exempel.se" style="width:100%; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; font-size:13px;">
<div id="composer-agent-grid" class="agent-grid" style="display:none; max-height: 120px; overflow-y: auto; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px;"></div>
<input type="hidden" id="selected-internal-agent">
</div>
<div style="margin-bottom:10px;">
<label style="display:block; color:#aaa; font-size:10px; text-transform:uppercase; margin-bottom:4px; font-weight:bold;">Ämne / Rubrik:</label>
<input type="text" id="composer-subject" placeholder="Vad gäller ärendet?" style="width:100%; padding:7px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; font-size:13px;">
</div>
<div style="margin-bottom:0;">
<label style="display:block; color:#aaa; font-size:10px; text-transform:uppercase; margin-bottom:4px; font-weight:bold;">Meddelande:</label>
<textarea id="composer-body" placeholder="Skriv ditt meddelande här..." style="width:100%; height:95px; padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); color:white; resize:none; font-family:inherit; font-size:13px; line-height:1.5;"></textarea>
</div>
</div>
<div id="composer-info-box" style="margin-bottom:8px; padding:8px 12px; border-radius:8px; font-size:11px; line-height:1.5; background:rgba(0,113,227,0.07); border:1px solid rgba(0,113,227,0.2); color:rgba(255,255,255,0.5); display:none;"></div>
<div class="glass-modal-footer" style="gap:8px;">
<button id="composer-cancel" class="btn-glass-icon" style="width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; padding:0; color:rgba(255,255,255,0.45); flex-shrink:0;" title="Stäng">
${ADMIN_UI_ICONS.CANCEL}
</button>
<button id="composer-send" class="btn-modal-confirm" style="width:38px; height:38px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:10px; flex-shrink:0;" title="Skicka">
${UI_ICONS.SEND}
</button>
</div>
</div>`;

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

setMode(false);

modal.style.display = 'flex';
toInp.value = ''; subInp.value = ''; bodyInp.value = '';
setTimeout(() => { if(!isInternalMode) toInp.focus(); }, 50);

document.getElementById('composer-cancel').onclick = () => modal.style.display = 'none';

document.getElementById('composer-send').onclick = async () => {
const subject = subInp.value.trim();
const body = bodyInp.value.trim();
const recipient = isInternalMode ? document.getElementById('selected-internal-agent').value : toInp.value.trim();

if (isInternalMode) {
if (!recipient) { showToast("⚠️ Välj en kollega att skicka till!"); return; }
} else {
if (!recipient || !recipient.includes('@')) { showToast("⚠️ Ange giltig e-postadress!"); return; }
}
if (!subject) { showToast("⚠️ Ange ett ämne!"); return; }
if (!body) { showToast("⚠️ Skriv ett meddelande!"); return; }

const btn = document.getElementById('composer-send');
btn.innerText = "Skickar...";
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
const tempId = `session_mail_${Date.now()}`;
if (!window.socketAPI) throw new Error("Ingen socket-anslutning");
window.socketAPI.emit('team:send_email_reply', {
conversationId: tempId,
message: body,
customerEmail: recipient,
subject: subject
});
newConversationId = tempId;
}

modal.style.display = 'none';
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
if (infoBox) { infoBox.style.display = 'block'; infoBox.textContent = '🔒 Dessa ärenden kan ej läsas av andra i systemet och syns endast lokalt för dig i Garaget vid arkivering.'; }
loadAgents();
} else {
btnExt.style.background = 'var(--accent-primary)';
btnExt.style.color = 'white';
btnInt.style.background = 'transparent';
btnInt.style.color = '#aaa';
agentGrid.style.display = 'none';
toInp.style.display = 'block';
labelRec.innerText = "MOTTAGARE (E-POST):";
if (infoBox) { infoBox.style.display = 'block'; infoBox.textContent = '📧 Nytt ärende skapas via e-post och hamnar i kundens inkorg. Ärendet syns för hela teamet i systemet.'; }
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
<div class="agent-card internal-select" onclick="window.selectInternalAgent(this, '${u.username}', '${u.agent_color || '#0071e3'}')"
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
