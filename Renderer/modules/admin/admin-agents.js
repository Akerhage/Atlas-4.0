// ============================================
// modules/admin/admin-agents.js
// VAD DEN GÖR: Admin — agent- och kontors-
//              åtgärder: lås upp sektioner,
//              tjänster, färger och roller
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders              — renderer.js globals
//   atlasPrompt                           — modals.js
//   showToast                             — styling-utils.js
//   adminEscapeHtml                       — admin-core.js
//   renderAdminUserList                   — admin-users.js
//   renderInbox, renderMyTickets          — inbox-view.js / tickets-view.js
//   usersCache[], currentUser             — renderer.js globals
// ============================================

// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║     KRITISK VARNING — AGENTFÄRG OCH LIVE-UPPDATERING        ║
// ⚠️  ║     LÄS DETTA INNAN DU ÄNDRAR NÅGOT I DENNA FIL             ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  updateAgentColor(username, color) hanterar TVÅ separata    ║
// ⚠️  ║  fall som BÅDA måste fungera:                               ║
// ⚠️  ║                                                              ║
// ⚠️  ║  FALL 1 — Annan agents färg ändras (admin redigerar):       ║
// ⚠️  ║    • DOM-uppdatering i admin-detaljvyn (header, avatar,     ║
// ⚠️  ║      pills, ärendekort via --atp-color)                     ║
// ⚠️  ║    • usersCache[] synkas direkt (cached.agent_color)        ║
// ⚠️  ║    • renderAdminUserList() + renderMyTickets() +            ║
// ⚠️  ║      renderInbox() triggas                                  ║
// ⚠️  ║                                                              ║
// ⚠️  ║  FALL 2 — Inloggad agent ändrar sin EGEN färg:              ║
// ⚠️  ║    • CSS-variabeln --accent-primary sätts globalt           ║
// ⚠️  ║      (styr ALL accentfärg i hela appen)                     ║
// ⚠️  ║    • currentUser.agent_color uppdateras + localStorage      ║
// ⚠️  ║    • Sidebar-avatarens ring och ikon uppdateras             ║
// ⚠️  ║    • Kundkortslistan + kunddetaljvyn + customer-reader-     ║
// ⚠️  ║      modal synkas (om öppen)                                ║
// ⚠️  ║                                                              ║
// ⚠️  ║  ❌ ÄNDRA INTE: if (currentUser && username === currentUser  ║
// ⚠️  ║     .username)-blocken — de är SEPARATA och båda krävs.    ║
// ⚠️  ║  ❌ ÄNDRA INTE: --accent-primary setProperty — tas den bort ║
// ⚠️  ║     slutar knappar, highlights och accenter att byta färg.  ║
// ⚠️  ║  ❌ ÄNDRA INTE: localStorage.setItem — tas den bort tappar  ║
// ⚠️  ║     agenten sin färg vid nästa sidladdning.                 ║
// ⚠️  ║                                                              ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║  CSS-VARIABLER SOM ANVÄNDS (ÄNDRA INTE NAMNEN):            ║
// ⚠️  ║                                                              ║
// ⚠️  ║  --accent-primary  global accentfärg (sätts på :root)       ║
// ⚠️  ║  --agent-color     ärendekort i kundlistan                  ║
// ⚠️  ║  --atp-color       .admin-ticket-preview-korten             ║
// ⚠️  ║                                                              ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝

// =============================================================================
// LÅS UPP SPECIFIK SEKTION I KONTORSVYN
// =============================================================================
window.unlockOfficeSection = function(sectionId, tag, btnElement) {
const box = document.getElementById(sectionId);
if (!box) return;

// Lås upp alla fält i denna sektion (utom färgväljaren som redan är klickbar)
box.querySelectorAll('input, textarea').forEach(el => {
if (el.id === 'inp-office-color') return;
el.disabled = false;
el.style.borderColor = 'var(--accent-primary)';
el.style.background = 'rgba(255,255,255,0.08)';
});

// Om det är pris-sektionen, visa lägg-till-knappen och papperskorgarna
if (sectionId === 'box-prices') {
const addBtn = document.getElementById('add-service-btn');
if (addBtn) addBtn.style.display = 'block';
box.querySelectorAll('.price-delete-btn').forEach(btn => btn.style.display = 'flex');
}

// Om det är info-sektionen: aktivera öppettider-kontroller och språk-pills
if (sectionId === 'box-info') {
// Visa × på befintliga öppettider-rader
box.querySelectorAll('.hours-remove-btn').forEach(btn => btn.style.display = 'flex');
// Visa + Lägg till rad-knappen
const addHoursBtn = document.getElementById('add-hours-btn');
if (addHoursBtn) addHoursBtn.style.display = 'block';
// Aktivera språk-pills: klickbara + visa × på extra pills
box.querySelectorAll('.lang-pill').forEach(pill => pill.style.cursor = 'pointer');
box.querySelectorAll('.lang-pill[data-extra="true"] .lang-remove-x').forEach(x => x.style.display = 'inline');
// Visa + Lägg till språk-knappen
const addLangBtn = document.getElementById('add-lang-btn');
if (addLangBtn) addLangBtn.style.display = 'block';

// _toggleLangPill: togglar aktiv/inaktiv stil på en pill
window._toggleLangPill = function(pill) {
const active = pill.getAttribute('data-active') === 'true';
// Om extra pill och man klickar × — ta bort pillen helt
if (!active === false && pill.getAttribute('data-extra') === 'true') {
// klick på × i en aktiv extra pill = ta bort
}
const nowActive = !active;
pill.setAttribute('data-active', nowActive);
// Läs kontorets accentfärg från header-gradienten (sparad på detail-header)
const oc = document.getElementById('inp-office-color')?.value || '#0071e3';
pill.style.border = `1px solid ${nowActive ? oc : 'rgba(255,255,255,0.12)'}`;
pill.style.color = nowActive ? oc : 'rgba(255,255,255,0.3)';
pill.style.background = nowActive ? oc + '18' : 'transparent';
pill.style.fontWeight = nowActive ? '600' : '400';
window._adminFormDirty = true;
};

// × på extra pills tar bort pillen helt
box.querySelectorAll('.lang-pill[data-extra="true"] .lang-remove-x').forEach(x => {
x.onclick = function(e) {
e.stopPropagation();
this.closest('.lang-pill').remove();
window._adminFormDirty = true;
};
});

// _addLangPill: lägger till ny pill från textfältet
window._addLangPill = function() {
const inp = document.getElementById('inp-lang-new');
if (!inp) return;
const val = inp.value.trim();
if (!val) return;
const normalized = val.toLowerCase();
// Kolla dublett
const existing = document.querySelector(`#lang-pill-group .lang-pill[data-lang="${normalized}"]`);
if (existing) { inp.value = ''; return; }
const oc = document.getElementById('inp-office-color')?.value || '#0071e3';
const group = document.getElementById('lang-pill-group');
const addBtn = document.getElementById('add-lang-btn');
const newPill = document.createElement('span');
newPill.className = 'lang-pill';
newPill.setAttribute('data-lang', normalized);
newPill.setAttribute('data-extra', 'true');
newPill.setAttribute('data-active', 'true');
newPill.style.cssText = `display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:3px 10px; border-radius:20px; cursor:pointer; transition:all 0.15s; border:1px solid ${oc}; color:${oc}; background:${oc}18; font-weight:600;`;
newPill.innerHTML = `${val.charAt(0).toUpperCase()+val.slice(1)}<span class="lang-remove-x" style="display:inline; font-size:13px; line-height:1; margin-left:2px; opacity:0.6; cursor:pointer;">×</span>`;
newPill.onclick = function() { window._toggleLangPill && window._toggleLangPill(this); };
newPill.querySelector('.lang-remove-x').onclick = function(e) {
e.stopPropagation();
newPill.remove();
window._adminFormDirty = true;
};
// Infoga i group — addBtn är ett syskon till group, inte ett barn, så använd appendChild
group.appendChild(newPill);
inp.value = '';
document.getElementById('lang-add-row').style.display = 'none';
if (addBtn) addBtn.style.display = 'block';
window._adminFormDirty = true;
};
}

// Ändra knappen till "Spara" och gör den aktiv
btnElement.innerHTML = '💾 Spara';
btnElement.classList.add('unlocked');

// Byt onclick till att anropa spar-funktionen
btnElement.onclick = () => {
window.saveOfficeSection(tag);
btnElement.innerHTML = '⏳ Sparar...'; // Visuell laddnings-feedback
};
};

// =============================================================================
// LÄGG TILL TJÄNST PÅ KONTOR
// =============================================================================
async function openAddServicePanel() {
const panel = document.getElementById('add-service-panel');
const select = document.getElementById('new-service-select');
const priceInput = document.getElementById('new-service-price');
if (!panel || !select) return;

panel.style.display = 'block';
select.innerHTML = '<option value="">Hämtar tjänster...</option>';
if (priceInput) priceInput.value = ''; // Nollställ prisfältet!

try {
const res = await fetch(`${SERVER_URL}/api/admin/available-services`, { headers: fetchHeaders });
const services = await res.json();

// Spara globalt så confirmAddService kan läsa keywords senare
window._availableServiceTemplates = services; 

// Filtrera bort tjänster som redan finns på kontoret
const existing = new Set(
Array.from(document.querySelectorAll('#price-list-grid [data-service-name]'))
.map(el => el.getAttribute('data-service-name'))
);

const available = services.filter(s => !existing.has(s.service_name));
if (!available.length) {
select.innerHTML = '<option value="">Inga nya tillgängliga tjänster</option>';
} else {
select.innerHTML = '<option value="">— Välj tjänst —</option>' +
available.map(s => `<option value="${adminEscapeHtml(s.service_name)}">${adminEscapeHtml(s.service_name)}</option>`).join('');
}

// Tvinga prisrutan att bli tom om man byter tjänst
select.onchange = () => {
if (priceInput) priceInput.value = '';
};

} catch (e) {
select.innerHTML = '<option value="">Kunde inte hämta tjänster</option>';
}
}

function confirmAddService() {
const select = document.getElementById('new-service-select');
const priceInput = document.getElementById('new-service-price');
if (!select || !priceInput) return;

const serviceName = select.value;
const price = parseInt(priceInput.value) || 0;

if (!serviceName) { showToast('Välj en tjänst i listan.'); return; }

// Hitta tjänsten i vår globala template-lista för att få ut dess keywords
const template = (window._availableServiceTemplates || []).find(s => s.service_name === serviceName);
const keywords = template ? template.keywords : [];

const grid = document.getElementById('price-list-grid');
if (!grid) return;

const row = document.createElement('div');
row.className = 'price-row';
row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,100,0,0.15); border-radius:8px; border:1px solid rgba(0,200,100,0.2); margin-bottom:4px;';

// BAKAR IN KEYWORDS i DOM:en så vi kan plocka dem när vi sparar
row.setAttribute('data-keywords', JSON.stringify(keywords));

row.innerHTML = `
<span style="font-size:13px;" data-service-name="${adminEscapeHtml(serviceName)}">${adminEscapeHtml(serviceName)} <span style="font-size:10px; opacity:0.5;">(ny)</span></span>
<div style="display:flex; align-items:center; gap:8px;">
<input type="number" class="price-inp" data-new-service="${adminEscapeHtml(serviceName)}" value="${price}" style="width:80px; text-align:right; border-color:rgba(0,200,100,0.4); background:rgba(0,200,100,0.05); color:white; padding:4px; border-radius:4px;">
<span style="font-size:11px; opacity:0.6;">SEK</span>
<button class="price-delete-btn" onclick="this.closest('.price-row').remove(); window._adminFormDirty=true;" style="width:22px; height:22px; border-radius:50%; background:rgba(255,69,58,0.15); border:1px solid rgba(255,69,58,0.3); color:#ff453a; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; padding:0; line-height:1;">×</button>
</div>
`;
grid.appendChild(row);
window._adminFormDirty = true;

// Stäng panelen
document.getElementById('add-service-panel').style.display = 'none';
select.value = '';
priceInput.value = '';
showToast(`✅ ${serviceName} tillagd — spara för att bekräfta`);
}


window.createNewUser = async () => {
const username = await atlasPrompt("Ny Agent", "Ange inloggningsnamn:");
if (!username) return;
const password = await atlasPrompt("Lösenord", `Ange lösenord för ${username}:`, "Välkommen123!");
if (!password) return;
const res = await fetch(`${SERVER_URL}/api/admin/create-user`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ username, password, role: 'agent' }) });
if (res.ok) renderAdminUserList();
else alert("Kunde inte skapa agent.");
};

window.toggleAdminStatus = async (username, isAdmin) => {
const newRole = isAdmin ? 'admin' : 'agent';
const res = await fetch(`${SERVER_URL}/api/admin/update-role-by-username`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ username, newRole }) });
if (res.ok) showToast(`Rättigheter uppdaterade för @${username}`);
};

// ⚠️ LOCK — updateAgentColor(username, color)
// Hanterar BÅDE andras färger (admin) och inloggad agents egna färg.
// Se filhuvudet ovan för fullständig beskrivning av de två fallen.
// ❌ ÄNDRA INTE: --accent-primary setProperty (global accentfärg).
// ❌ ÄNDRA INTE: localStorage.setItem (bevarar färg över sidladdningar).
// ❌ ÄNDRA INTE: de två separata if(currentUser && username===...)-blocken.
// ❌ ÄNDRA INTE: cached.agent_color = color (synkar usersCache[]-cachen).
window.updateAgentColor = async (username, color) => {
const res = await fetch(`${SERVER_URL}/api/admin/update-agent-color`, { 
method: 'POST', 
headers: fetchHeaders, 
body: JSON.stringify({ username, color }) 
});

if (res.ok) {
showToast("Färg sparad");

// --- START PÅ LIVE-UPPDATERING I UI ---
const detailBox = document.getElementById('admin-detail-content');
if (detailBox) {
// 1. Uppdatera Headern
const headerTop = detailBox.querySelector('.detail-header-top');
if (headerTop) {
headerTop.style.borderBottomColor = color;
headerTop.style.background = `linear-gradient(90deg, ${color}22, transparent)`;
}

// 2. Uppdatera Avatar-ringen och ikonen inuti
const avatar = detailBox.querySelector('.msg-avatar');
if (avatar) {
avatar.style.borderColor = color;
// Letar upp div:en inuti bubblan för att synka ikonfärgen
const innerIconContainer = avatar.querySelector('.avatar-inner-icon') || avatar.querySelector('.user-avatar div');
if (innerIconContainer) {
innerIconContainer.style.color = color;
}
}

// 3. Uppdatera de nya SVG-ikonerna (Notes och Pennan)
const notesBtn = document.getElementById('agent-detail-notes-btn');
const editBtn = document.getElementById('agent-detail-edit-btn');
if (notesBtn) notesBtn.style.color = color;
if (editBtn) editBtn.style.color = color;

// 4. Uppdatera Piller & Ärendekort
const rolePill = detailBox.querySelector('.header-pills-row .pill');
if (rolePill) { 
rolePill.style.borderColor = color; 
rolePill.style.color = color; 
}

detailBox.querySelectorAll('.admin-ticket-preview').forEach(card => {
card.style.setProperty('--atp-color', color);
});

// 5. Uppdatera agentnamnet i rubriken (h2 .detail-subject, t.ex. "Madeleine")
const nameTitle = detailBox.querySelector('.detail-subject');
if (nameTitle) nameTitle.style.setProperty('color', color, 'important');
}

// Synka sidofältet om det är inloggad agents egna färg
if (currentUser && username === currentUser.username) {
// Uppdatera CSS-variabeln som styr HEM-vyn, knappar och all accentfärg globalt
document.documentElement.style.setProperty('--accent-primary', color);
currentUser.agent_color = color;
localStorage.setItem('atlas_user', JSON.stringify(currentUser));

const sideAvatarRing = document.querySelector('.sidebar-footer .user-avatar');
const sideIconContainer = document.querySelector('.sidebar-footer .user-initial');
if (sideAvatarRing) sideAvatarRing.style.setProperty('border-color', color, 'important');
if (sideIconContainer) sideIconContainer.style.setProperty('background-color', color, 'important');
}

// Live-uppdatering av kundvyn om det är inloggad agents egna färg
if (currentUser && username === currentUser.username) {
// 1. Kundkortslistan — vänsterbård och --agent-color på varje kort
document.querySelectorAll('#customer-list .team-ticket-card').forEach(card => {
card.style.setProperty('border-left', `4px solid ${color}`, 'important');
card.style.setProperty('--agent-color', color);
const tag = card.querySelector('.ticket-tag');
if (tag) { tag.style.color = color; tag.style.borderColor = color + '44'; }
const badge = card.querySelector('.ticket-top-right span');
if (badge) { badge.style.color = color; badge.style.background = color + '22'; badge.style.borderColor = color + '44'; }
});

// 2. Ärendekorten i kunddetaljvyn (listan under statistikrutorna)
document.querySelectorAll('#customer-ticket-list-body .team-ticket-card').forEach(card => {
card.style.setProperty('border-left', `3px solid ${color}`, 'important');
card.style.setProperty('--agent-color', color);
const tag = card.querySelector('.ticket-tag');
if (tag) { tag.style.color = color; tag.style.borderColor = color + '44'; }
});

// 3. Modal-bläddaren — om den råkar vara öppen just nu
const readerModal = document.getElementById('customer-reader-modal');
if (readerModal && readerModal.style.display !== 'none') {
const topBorder = readerModal.querySelector('.glass-modal-box');
if (topBorder) topBorder.style.borderTopColor = color;
const headerBg = readerModal.querySelector('.glass-modal-box > div');
if (headerBg) headerBg.style.background = `linear-gradient(90deg, ${color}14, transparent)`;
const avatarBox = readerModal.querySelector('.glass-modal-box > div div[style*="border-radius:9px"]');
if (avatarBox) { avatarBox.style.background = color; avatarBox.style.boxShadow = `0 2px 10px ${color}55`; }
const notesBtn = readerModal.querySelector('.notes-trigger-btn');
if (notesBtn) notesBtn.style.color = color;
}
}

// --- ORIGINAL-LOGIK (RÖR EJ) ---
const cached = usersCache.find(u => u.username === username);
if (cached) cached.agent_color = color;

renderAdminUserList();
renderMyTickets?.();
renderInbox?.();
}
};

// =============================================================================
// UI: UPPDATERA ROLLER PÅ AGENTER
// =============================================================================
window.updateAgentOfficeRole = async (username, tag, isChecked, checkboxEl, agentName) => {
const res = await fetch(`${SERVER_URL}/api/admin/update-agent-offices`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ username, tag, isChecked })
});
if (res.ok) {
const officeName = checkboxEl?.closest('label')?.textContent.trim() || tag;
showToast(isChecked
  ? `${officeName} <span style="color:#4ade80;font-weight:600;">tillagt</span> på agenten ${agentName || username}`
  : `${officeName} <span style="color:#f87171;font-weight:600;">borttaget</span> från agenten ${agentName || username}`);

// Visuell uppdatering direkt på checkboxen utan väntan
if (checkboxEl) {
const label = checkboxEl.closest('label');
if (label) {
label.style.background = isChecked ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
label.style.borderColor = isChecked ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
label.style.color = isChecked ? '#b09fff' : '';
}
}

// 🔄 LIVE-UPPDATERING: Ladda om räknaren och ärendelistan för denna agent.
// Hämtar ny data från servern och uppdaterar AKTIVA ÄRENDEN + ärendelistan
// direkt i den öppna detaljvyn — utan att stänga och öppna om hela vyn.
try {
const [statsRes, ticketsRes] = await Promise.all([
fetch(`${SERVER_URL}/api/admin/user-stats/${username}`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/agent-tickets/${username}`, { headers: fetchHeaders })
]);
const stats = await statsRes.json();
const tickets = await ticketsRes.json();

// Uppdatera globala ticket-listorna
currentTicketList = tickets;
window._agentOwnerTickets = tickets.filter(t => t.is_assigned === 1 || t.owner === username);
window._agentRoutingTickets = tickets.filter(t => t.is_assigned === 0 && t.owner !== username);

const detailBox = document.getElementById('admin-detail-content');
if (!detailBox) return;

// Uppdatera räknaren (AKTIVA ÄRENDEN — total)
const statCard = detailBox.querySelector('.admin-stat-card');
if (statCard) {
const numEl = statCard.querySelector('div[style*="font-size:38px"]');
if (numEl) numEl.textContent = tickets.length || 0;

// Uppdatera uppdelningsraden (tilldelade / via kontor)
const breakdownEl = statCard.querySelector('div[style*="display:flex; gap:8px"]');
if (breakdownEl) {
const styles = getAgentStyles(username);
const ownedCount = window._agentOwnerTickets?.length || 0;
const routingCount = window._agentRoutingTickets?.length || 0;
breakdownEl.innerHTML = `
${ownedCount > 0 ? `<span style="color:${styles.main}99;">${ownedCount} tilldelade</span>` : ''}
${routingCount > 0 ? `<span style="opacity:0.6;">+${routingCount} via kontor</span>` : ''}
`;
}
}

// Uppdatera ärendelistan (Pågående ärenden för agent)
const styles = getAgentStyles(username);
const ticketListEl = detailBox.querySelector('.scroll-list');
if (ticketListEl) {
ticketListEl.innerHTML = tickets.length ? tickets.map((t, idx) => `
<div class="admin-ticket-preview" onclick="openTicketReader(${idx}, '${username}')"
style="border-left: 3px solid ${styles.main} !important; --atp-color: ${styles.main} !important;">
<div style="flex:1; min-width:0;">
<div class="atp-sender">${t.contact_name || t.sender || 'Okänd kund'}</div>
<div class="atp-subject">${t.preview || t.last_message || t.question || t.subject || 'Inget ämne'}</div>
</div>
<button class="atp-note-btn"
onclick="event.stopPropagation(); openNotesModal('${t.conversation_id || t.id}')"
title="Intern anteckning">
${UI_ICONS.NOTES}
</button>
</div>
`).join('') : '<div class="template-item-empty">Inga aktiva ärenden.</div>';

// Sätt notes-knapp-färger
ticketListEl.querySelectorAll('.atp-note-btn').forEach(btn => {
btn.style.setProperty('color', 'var(--atp-color, #0071e3)', 'important');
});
}
} catch (refreshErr) {
console.warn('⚠️ Kunde inte uppdatera agentdetaljer live:', refreshErr);
}
}
};

// =============================================================================
// UI: SPARA KONTORS FAKTA
// =============================================================================
async function saveOfficeKnowledge(tag) {
try {
const resGet = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { headers: fetchHeaders });
const data = await resGet.json();

// Uppdatera priser
document.querySelectorAll('.price-inp').forEach(input => {
const idx = input.getAttribute('data-idx');
if (data.prices && data.prices[idx]) data.prices[idx].price = parseInt(input.value) || 0;
});

// KORREKTA ID:N (Matchar openAdminOfficeDetail)
if(document.getElementById('inp-phone')) data.contact.phone = document.getElementById('inp-phone').value;
if(document.getElementById('inp-email')) data.contact.email = document.getElementById('inp-email').value;
if(document.getElementById('inp-address')) data.contact.address = document.getElementById('inp-address').value;
if(document.getElementById('inp-desc')) data.description = document.getElementById('inp-desc').value;

const resPut = await fetch(`${SERVER_URL}/api/knowledge/${tag}`, { method: 'PUT', headers: fetchHeaders, body: JSON.stringify(data) });
if (resPut.ok) showToast("✅ Kontorsdata sparad!");
} catch (err) { alert("Kunde inte spara: " + err.message); }
}

// =============================================================================
// SPARA VY-BEHÖRIGHETER FÖR AGENT
// Läser data-view-key-checkboxarna i Vy-behörigheter-panelen och sparar via API.
// =============================================================================
async function saveUserViews(username, viewKey, isNowVisible, agentName) {
const checkboxes = document.querySelectorAll('[data-view-key]');
const checked = Array.from(checkboxes)
  .filter(cb => cb.checked)
  .map(cb => cb.getAttribute('data-view-key'));

// Alla vyer ikryssade = inga begränsningar (null = visa allt)
const ALL_VIEWS = ['my-tickets', 'inbox', 'archive', 'customers', 'templates', 'about', 'admin-users', 'admin-offices', 'admin-config'];
const allChecked = ALL_VIEWS.every(v => checked.includes(v));
const payload = allChecked ? null : checked;

try {
  const res = await fetch(`${SERVER_URL}/api/admin/user-views/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: fetchHeaders,
    body: JSON.stringify({ allowed_views: payload })
  });
  if (!res.ok) throw new Error(`Serverfel: ${res.status}`);
  const VIEW_LABELS = {'my-tickets':'Mina ärendenvyn','inbox':'Inkorgen','archive':'Garaget','customers':'Kundvyn','templates':'Mailmallarvyn','about':'Om-sidan','admin-users':'Admin: Agenter','admin-offices':'Admin: Kontor','admin-config':'Admin: Systemkonfiguration'};
  const vname = VIEW_LABELS[viewKey] || viewKey || 'Vy';
  showToast(isNowVisible
    ? `${vname} är nu <span style="color:#4ade80;font-weight:600;">synlig</span> för agenten ${agentName || username}`
    : `${vname} är nu <span style="color:#f87171;font-weight:600;">dold</span> för agenten ${agentName || username}`);
} catch (e) {
  console.error('[VIEWS] Kunde inte spara vy-behörigheter:', e);
  showToast('❌ Kunde inte spara vy-behörigheter');
}
}