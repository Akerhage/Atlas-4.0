// ============================================
// modules/admin/admin-offices.js
// VAD DEN GÖR: Admin — kontorslista och
//              kontorsdetaljer
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders, currentUser,         — renderer.js globals
//   officeData, usersCache, window._adminFormDirty — renderer.js globals
//   ADMIN_UI_ICONS, UI_ICONS                       — ui-constants.js
//   getAgentStyles, resolveLabel, showToast        — styling-utils.js
//   atlasConfirm                                   — renderer.js
//   openNotesModal, loadNotes                      — notes-system.js
//   window.unlockOfficeSection                     — renderer.js (definieras ej här)
//   window.saveOfficeSection                       — definieras inuti openAdminOfficeDetail
// ============================================

// ===================================================
// ADMIN - RENDER OFFICE LIST
// ===================================================
async function renderAdminOfficeList() {
const listContainer = document.getElementById('admin-main-list');
listContainer.innerHTML = '<div class="spinner-small"></div>';

try {
// Använder din nya fetchHeaders som nu fungerar
const res = await fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders });
const offices = await res.json();

// Sortera: A-Ö
offices.sort((a, b) => a.city.localeCompare(b.city, 'sv'));

listContainer.innerHTML = offices.map(o => {
const subtext = o.area ? o.area : '';
const initial = (o.city || 'K').charAt(0).toUpperCase();
const oc = o.office_color || '#0071e3';

return `
<div class="admin-mini-card" onclick="openAdminOfficeDetail('${o.routing_tag}', this)" style="--agent-color: ${oc}" data-routing-tag="${o.routing_tag}">
<div class="office-card-bubble" style="background:${oc}18; border-color:${oc}; color:${oc};">
${initial}
</div>
<div style="min-width:0; flex:1; overflow:hidden;">
<div class="office-card-sub" style="color:${oc};">${o.city}</div>
<div style="font-size:10px; opacity:0.6; color:var(--text-secondary); min-height:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${subtext}</div>
</div>
</div>`;
}).join('');
} catch (e) {
console.error("Office List Error:", e);
listContainer.innerHTML = '<p class="error-text">Kunde inte ladda kontor.</p>';
}
}

// =============================================================================
// ADMIN - openAdminOfficeDetail (FULLSTÄNDIG - ALL LOGIK INKLUDERAD)
// =============================================================================
async function openAdminOfficeDetail(tag, element) {
if (!tag) return;
if (window._adminFormDirty) {
const ok = await atlasConfirm('Osparade ändringar', 'Du har ändringar som inte sparats. Navigera bort?');
if (!ok) return;
window._adminFormDirty = false;
}

// 1. UI Feedback i listan
if (element) {
document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
element.classList.add('active');
}

const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;

placeholder.style.display = 'none';
detailBox.style.display = 'flex';
detailBox.innerHTML = '<div class="spinner-small"></div>';
detailBox.setAttribute('data-current-id', tag); 

try {
// 2. Hämta all data parallellt
const [res, ticketsRes, usersRes] = await Promise.all([
fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/office-tickets/${tag}`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/users`, { headers: fetchHeaders })
]);

if (!res.ok) throw new Error(`Kunde inte hitta kontorsdata för ${tag}`);

const data = await res.json();
const oc = data.office_color || '#0071e3';
const tickets = await ticketsRes.json();
const connectedAgents = (usersRes.ok ? await usersRes.json() : [])
.filter(u => u.routing_tag?.split(',').map(s => s.trim()).includes(tag));
currentTicketList = tickets; // Sparas för Reader-modalen
const readOnly = !isSupportAgent(); // Agent ser i läsläge

// 3. Rendera Master-Header och Body
detailBox.innerHTML = `
<div class="detail-container" id="box-office-master">

<div class="detail-header-top" id="office-detail-header" style="border-bottom: 2px solid ${oc}; background: linear-gradient(90deg, ${oc}1a, transparent); padding: 15px 20px;">
<div style="display:flex; align-items:center; gap:20px;">
<div class="profile-avatar" id="office-avatar-circle" style="width: 54px; height: 54px; background: ${oc}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff; font-weight: 800; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
${data.city ? data.city.substring(0,1) : 'K'}
</div>
<div>
<h2 class="detail-subject" style="margin-bottom: 4px;">${data.city} ${data.area ? '- ' + data.area : ''}</h2>
<div class="header-pills-row" style="display:flex; align-items:center; gap:8px;">
<div class="pill office-pill-accent" style="border-color:${oc}; color:${oc}; font-weight: 800;">KONTOR</div>

<div id="office-id-pill" class="pill" style="border-color:${oc}66; color:${oc}; opacity: 0.8; font-family: monospace;">ID: ${tag}</div>

<button class="notes-trigger-btn footer-icon-btn"
data-id="office_${tag}"
onclick="openNotesModal('office_${tag}')"
style="color:${oc}; padding: 4px 8px;"
title="Interna anteckningar om kontoret">
${UI_ICONS.NOTES}
</button>
</div>
</div>
</div>

<div class="detail-footer-toolbar" style="background:transparent; border:none; padding:0; gap:10px; display:${readOnly ? 'none' : 'flex'}">
<div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
<span style="font-size:8px; opacity:0.4; text-transform:uppercase; letter-spacing:0.5px;">Färg</span>
<input type="color" id="inp-office-color" value="${data.office_color || '#0071e3'}"
oninput="window._updateOfficeLiveColor(this.value)"
title="Profilfärg — sparas automatiskt"
style="width:28px; height:28px; cursor:pointer; border:none; background:transparent; border-radius:4px;">
<span id="inp-office-color-hex" style="font-family:monospace; font-size:9px; opacity:0.45;">${data.office_color || '#0071e3'}</span>
</div>
<button class="btn-glass-icon" onclick="deleteOffice('${tag}')" title="Radera kontor permanent"
style="color:#ff453a; border:none; background:transparent;">
${ADMIN_UI_ICONS.DELETE}
</button>
</div>
</div>
<div class="detail-body" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; padding:25px; overflow-y:auto; flex:1; min-height:0;">

<div style="display: flex; flex-direction: column; gap: 20px;">

<div class="glass-panel" id="box-contact" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid ${oc}44;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Kontaktuppgifter</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-contact', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<div style="display: grid; gap: 12px;">
<input type="text" id="inp-phone" class="filter-input" value="${data.contact?.phone || ''}" disabled placeholder="Telefon">
<input type="text" id="inp-email" class="filter-input" value="${data.contact?.email || ''}" disabled placeholder="E-post">
<input type="text" id="inp-address" class="filter-input" value="${data.contact?.address || ''}" disabled placeholder="Adress">
</div>
</div>

<div class="glass-panel" id="box-prices" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid ${oc}44;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Tjänster & Priser</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-prices', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<div class="price-list" style="display: grid; gap: 8px;" id="price-list-grid">
${data.prices ? data.prices.map((p, idx) => `
<div class="price-row" data-service-idx="${idx}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
<span style="font-size: 13px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" data-service-name="${p.service_name}">${p.service_name}</span>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink:0;">
<input type="number" class="price-inp" data-idx="${idx}" value="${p.price}" disabled style="width: 80px; text-align: right;">
<span style="font-size: 11px; opacity: 0.6;">SEK</span>
<button class="price-delete-btn" title="Ta bort tjänst"
style="display:none; width:22px; height:22px; border-radius:50%; background:rgba(255,69,58,0.15);
border:1px solid rgba(255,69,58,0.3); color:#ff453a; cursor:pointer; font-size:14px;
align-items:center; justify-content:center; padding:0; line-height:1; flex-shrink:0;"
onclick="this.closest('.price-row').remove(); window._adminFormDirty=true;">×</button>
</div>
</div>
`).join('') : '<div class="template-item-empty">Inga priser inlagda.</div>'}
</div>
<button id="add-service-btn" style="display:none; margin-top:10px; width:100%;" class="btn-glass-small" onclick="openAddServicePanel()">
+ Lägg till tjänst
</button>
<div id="add-service-panel" style="display:none; margin-top:14px; padding:12px; background:rgba(0,113,227,0.05); border:1px solid rgba(0,113,227,0.2); border-radius:8px;">
<div style="font-size:11px; color:var(--text-secondary); margin-bottom:8px; text-transform:uppercase;">Välj tjänst att lägga till</div>
<select id="new-service-select" class="filter-input" style="width:100%; margin-bottom:8px;">
<option value="">Hämtar tjänster...</option>
</select>
<div style="display:flex; gap:8px; align-items:center;">
<input type="number" id="new-service-price" class="filter-input" placeholder="Pris (SEK)" style="flex:1; width:auto;">
<button class="btn-glass-small" onclick="confirmAddService()" style="background:rgba(0,200,100,0.15); border-color:rgba(0,200,100,0.3);">+ Lägg till</button>
<button class="btn-glass-small" onclick="document.getElementById('add-service-panel').style.display='none'">Avbryt</button>
</div>
</div>
</div>

<div class="glass-panel" id="box-booking" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid ${oc}44;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Bokningslänkar</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-booking', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<div style="display:grid; gap:10px;">
${[['CAR','Bil'], ['MC','MC'], ['AM','AM/Moped']].map(([key, label]) => `
<div style="display:flex; align-items:center; gap:10px;">
<span style="font-size:11px; opacity:0.5; text-transform:uppercase; width:52px; flex-shrink:0;">${label}</span>
<input id="inp-booking-${key.toLowerCase()}" class="filter-input" type="url" disabled
placeholder="https://..."
value="${(data.booking_links && data.booking_links[key]) || ''}"
style="flex:1;">
</div>`).join('')}
</div>
</div>

<div class="glass-panel" id="box-desc" style="padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid ${oc}44;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
<h4 style="margin: 0; color: ${oc}; font-size:11px; text-transform:uppercase;">AI Kunskap (Beskrivning)</h4>
<button class="admin-lock-btn" onclick="unlockOfficeSection('box-desc', '${tag}', this)" style="display:${readOnly ? 'none' : 'block'};">🔒 Lås upp</button>
</div>
<textarea id="inp-desc" class="filter-input" style="width: 100%; height: 120px; resize: none;" disabled>${data.description || ''}</textarea>
<div style="font-size: 12px; opacity: 0.4; margin-top: 8px;">💡 Denna text används av Atlas AI för att svara på frågor om kontoret.</div>
</div>
</div>

<div style="display: flex; flex-direction: column;">
<div class="glass-panel" id="box-tickets" style="padding: 20px; border-radius: 12px; background: rgba(0,0,0,0.2); border: 1px solid ${oc}44; height: 100%; display: flex; flex-direction: column; overflow:hidden;">
<h4 style="margin: 0 0 15px 0; color: ${oc}; font-size:11px; text-transform:uppercase;">Aktiva Ärenden (${tickets.length})</h4>
<div class="scroll-list">
${tickets.length ? tickets.map((t, idx) => `
<div class="admin-ticket-preview" onclick="openTicketReader(${idx}, '${tag}')" 
style="border-left: 3px solid ${oc} !important; --atp-color: ${oc} !important;">
<div style="flex:1; min-width:0;">
<div class="atp-sender">${t.sender || 'Okänd kund'}</div>
<div class="atp-subject">${t.subject || 'Inget ämne'}</div>
</div>
<button class="atp-note-btn" 
onclick="event.stopPropagation(); openNotesModal('${t.conversation_id || t.id}')" 
title="Intern anteckning"
style="color:${oc} !important;">
${UI_ICONS.NOTES}
</button>
</div>
`).join('') : '<div class="template-item-empty" style="text-align:center;">Kön är tom ✅</div>'}
</div>
</div>

<div class="glass-panel" id="box-agents" style="padding:20px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); margin-top:16px;">
<h4 style="margin:0 0 12px 0; color:${oc}; font-size:11px; text-transform:uppercase;">Kopplade Agenter</h4>
${connectedAgents.length ? connectedAgents.map(u => `
<div style="display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
${getAvatarBubbleHTML(u, '28px')}
<span style="font-size:13px; flex:1;">${u.display_name || u.username}</span>
${u.is_online ? '<span style="width:7px;height:7px;border-radius:50%;background:#4cd964;box-shadow:0 0 4px #4cd964;flex-shrink:0;"></span>' : ''}
</div>`).join('')
: '<div style="opacity:0.4;font-size:12px;padding-top:6px;">Inga agenter kopplade</div>'}
</div>

</div>
</div>
</div>`;

// 4. Koppla Editeringsfunktioner
window.toggleEditMode = (boxId) => {
const box = document.getElementById(boxId);
box.querySelectorAll('input, textarea').forEach(el => {
if (el.id === 'inp-office-color') return; // färgväljare är alltid aktiv
el.disabled = false;
el.style.borderColor = 'var(--accent-primary)';
el.style.background = 'rgba(255,255,255,0.08)';
});
// Visa raderingsknapparna på prisrader
box.querySelectorAll('.price-delete-btn').forEach(btn => btn.style.display = 'flex');
const editModeTrigger = document.getElementById('edit-mode-trigger');
if (editModeTrigger) editModeTrigger.style.display = 'none';

const saveActions = box.querySelector('.save-actions');
if (saveActions) {
saveActions.style.setProperty('display', 'none', 'important');
// Starta inaktiva — aktiveras först vid faktisk ändring
const saveBtns = saveActions.querySelectorAll('button');
saveBtns.forEach(btn => {
btn.style.opacity = '0.35';
btn.style.pointerEvents = 'none';
btn.style.cursor = 'not-allowed';
btn.style.color = '';
btn.style.borderColor = '';
});
const activateSave = () => {
saveBtns.forEach(btn => {
btn.style.opacity = '1';
btn.style.pointerEvents = 'auto';
btn.style.cursor = 'pointer';
if (btn.getAttribute('data-action') === 'cancel') {
btn.style.color = '#ff453a';
btn.style.borderColor = 'rgba(255,69,58,0.4)';
} else if (btn.getAttribute('data-action') === 'save') {
btn.style.color = '#4cd964';
btn.style.borderColor = 'rgba(76,217,100,0.4)';
}
});
// Lyssna bara en gång
box.querySelectorAll('input, textarea').forEach(el => {
el.removeEventListener('input', activateSave);
el.removeEventListener('change', activateSave);
});
};
box.querySelectorAll('input, textarea').forEach(el => {
el.addEventListener('input', activateSave);
el.addEventListener('change', activateSave);
});
}

const addServiceBtn = document.getElementById('add-service-btn');
if (addServiceBtn) addServiceBtn.style.display = 'block';
};

window.cancelEdit = (boxId) => {
openAdminOfficeDetail(tag); // Ladda om vyn
};

// Live-uppdatering av kontorets accentfärg — kallas från color picker oninput
// Sparas automatiskt med debounce, ingen spara-knapp behövs för färgändring
window._updateOfficeLiveColor = (hex) => {
// Hex-display bredvid pickern
const hexEl = document.getElementById('inp-office-color-hex');
if (hexEl) hexEl.textContent = hex;

// Header — gradient och border
const header = document.getElementById('office-detail-header');
if (header) {
header.style.borderBottomColor = hex;
header.style.background = `linear-gradient(90deg, ${hex}1a, transparent)`;
}

// Avatar-bubbla i headern
const avatar = document.getElementById('office-avatar-circle');
if (avatar) avatar.style.background = hex;

// KONTOR-pill
const pill = document.querySelector('.office-pill-accent');
if (pill) { pill.style.borderColor = hex; pill.style.color = hex; }

// ID-pill
const idPill = document.getElementById('office-id-pill');
if (idPill) { idPill.style.borderColor = hex + '66'; idPill.style.color = hex; }

// Notes-knapp i headern (finns i .header-pills-row, ej .detail-footer-toolbar)
const notesBtn = document.querySelector('.header-pills-row .notes-trigger-btn');
if (notesBtn) notesBtn.style.color = hex;

// Aktivt kort i listan
const activeCard = document.querySelector('#admin-main-list .admin-mini-card.active');
if (activeCard) {
activeCard.style.setProperty('--agent-color', hex);
const bubble = activeCard.querySelector('.office-card-bubble');
if (bubble) { bubble.style.background = hex + '18'; bubble.style.borderColor = hex; bubble.style.color = hex; }
const sub = activeCard.querySelector('.office-card-sub');
if (sub) sub.style.color = hex;
}

// Ärendekortens vänsterlinje i kontorsdetaljvyn
document.querySelectorAll('#admin-detail-content .admin-ticket-preview').forEach(card => {
card.style.setProperty('--atp-color', hex);
});

// Section-panelernas borders (glass-panel med id)
['box-contact', 'box-prices', 'box-booking', 'box-desc', 'box-tickets'].forEach(id => {
const panel = document.getElementById(id);
if (panel) panel.style.borderColor = hex + '44';
});

// Section-titlar (h4 med kontorets färg)
document.querySelectorAll('#admin-detail-content .glass-panel h4').forEach(h4 => {
h4.style.color = hex;
});

// Rubrikens titel
const detailTitle = document.querySelector('#admin-detail-content .detail-subject');
if (detailTitle) detailTitle.style.color = hex;

// Auto-spara med debounce — snabb endpoint, ingen AI-validering
clearTimeout(window._colorSaveTimer);
window._colorSaveTimer = setTimeout(async () => {
try {
const saveRes = await fetch(`${SERVER_URL}/api/admin/update-office-color`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ routing_tag: tag, color: hex })
});
if (saveRes.ok) {
await preloadOffices();      // Uppdatera officeData-cache
renderMyTickets?.();         // Ärendekort i Mina Ärenden
renderInbox?.();             // Ärendekort i Inkorg
showToast('🎨 Kontorsfärg sparad');
}

} catch (e) {
console.error('[OfficeColor] Auto-spara misslyckades:', e);
}
}, 700);
};


// =============================================================================
// SPARA SEKTION NÄR DU REDIGERAR ETT KONTORS INFO
// =============================================================================
window.saveOfficeSection = async (tag) => {
try {
const res = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders });
const currentData = await res.json();

// Hämta värden från formulären
currentData.contact.phone = document.getElementById('inp-phone').value;
currentData.contact.email = document.getElementById('inp-email').value;
currentData.contact.address = document.getElementById('inp-address').value;
currentData.description = document.getElementById('inp-desc').value;
const colorInput = document.getElementById('inp-office-color');
if (colorInput) currentData.office_color = colorInput.value;

// Bokningslänkar
const bookingKeys = { car: 'CAR', mc: 'MC', am: 'AM' };
if (!currentData.booking_links) currentData.booking_links = {};
Object.entries(bookingKeys).forEach(([inputKey, dataKey]) => {
const el = document.getElementById(`inp-booking-${inputKey}`);
if (el) currentData.booking_links[dataKey] = el.value.trim() || null;
});

// Priser — bygg komplett array från kvarvarande DOM-rader (raderade är borta)
const remainingPrices = [];
document.querySelectorAll('#price-list-grid .price-row').forEach(row => {
const inp = row.querySelector('.price-inp');
if (!inp) return;
const newService = inp.getAttribute('data-new-service');
const idx = inp.getAttribute('data-idx');

if (newService) {
// NY TJÄNST: Läs in de inbakade keywordsen från HTML-raden
let kw = [];
try {
kw = JSON.parse(row.getAttribute('data-keywords') || '[]');
} catch(e) {}
remainingPrices.push({ service_name: newService, price: parseInt(inp.value) || 0, currency: "SEK", keywords: kw });
} else if (idx !== null && currentData.prices[idx]) {
// EXISTERANDE TJÄNST: bevara keywords från filen, uppdatera bara pris
remainingPrices.push({ ...currentData.prices[idx], price: parseInt(inp.value) || 0 });
}
});
currentData.prices = remainingPrices;

const saveRes = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, {
method: 'PUT',
headers: fetchHeaders,
body: JSON.stringify(currentData)
});

if (saveRes.ok) {
window._adminFormDirty = false; // Markerar formuläret som sparat
showToast("✅ Kontorsdata sparad!");
await preloadOffices();
renderMyTickets?.();
renderInbox?.();
openAdminOfficeDetail(tag, null); // Laddar om och låser vyn automatiskt
}
} catch (e) { 
console.error("Admin Save Error:", e); 
showToast("❌ Ett fel uppstod vid sparning.");
}
};

} catch (e) {
console.error("Admin Office Detail Error:", e);
detailBox.innerHTML = '<div class="template-item-empty">Kunde inte ladda kontorsdata.</div>';
}
}
