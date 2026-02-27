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

// =============================================================================
// NY FUNKTION: Lås upp specifik sektion i Kontorsvyn
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
// ADMIN — TILLÄGG B: LÄGG TILL TJÄNST PÅ KONTOR (Uppdaterad)
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
const newRole = isAdmin ? 'support' : 'agent';
const res = await fetch(`${SERVER_URL}/api/admin/update-role-by-username`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ username, newRole }) });
if (res.ok) showToast(`Rättigheter uppdaterade för @${username}`);
};

// =============================================================================
// UI: UPPDATERA FÄRGER PÅ AGENTER
// =============================================================================
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

// 2. Uppdatera Avatar-ringen OCH ikonen inuti (Det du störde dig på!)
const avatar = detailBox.querySelector('.msg-avatar');
if (avatar) {
avatar.style.borderColor = color;
// Här letar vi upp div:en inuti bubblan. 
// Eftersom din getAvatarBubbleHTML har "color: ${color}" på inner-diven, uppdaterar vi den här:
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
}

// KIRURGISK FIX: Synka med sidofältet om det är JAG (currentUser) som ändras
if (currentUser && username === currentUser.username) {
currentUser.agent_color = color;
localStorage.setItem('atlas_user', JSON.stringify(currentUser));

const sideAvatarRing = document.querySelector('.sidebar-footer .user-avatar');
const sideIconContainer = document.querySelector('.sidebar-footer .user-initial');
if (sideAvatarRing) sideAvatarRing.style.setProperty('border-color', color, 'important');
if (sideIconContainer) sideIconContainer.style.setProperty('background-color', color, 'important');
}

// --- DIN ORIGINAL-LOGIK (RÖR EJ) ---
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
window.updateAgentOfficeRole = async (username, tag, isChecked, checkboxEl) => {
const res = await fetch(`${SERVER_URL}/api/admin/update-agent-offices`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ username, tag, isChecked })
});
if (res.ok) {
showToast("Kontor uppdaterat");
// Visuell uppdatering direkt utan reload
if (checkboxEl) {
const label = checkboxEl.closest('label');
if (label) {
label.style.background = isChecked ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
label.style.borderColor = isChecked ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
label.style.color = isChecked ? '#b09fff' : '';
}
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
