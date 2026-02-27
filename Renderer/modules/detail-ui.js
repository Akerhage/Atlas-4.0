// ============================================
// modules/detail-ui.js
// VAD DEN GÖR: Detaljvy-huvuden, fordonsikoner
//              och återställning av detaljvyer
// ANVÄNDS AV: renderer.js, inbox-view.js,
//             tickets-view.js
// ============================================
// Beroenden (löses vid anropstid):
//   UI_ICONS                    — ui-constants.js
//   officeData[]                — renderer.js global
//   formatName, resolveTicketTitle — renderer.js / chat-engine.js
// ============================================

// ===================================================
// 4. STÄDAR VYERNA OCH RENDERAR OM
// ===================================================
function checkAndResetDetail(detailId, affectedId = null) {
const detail = document.getElementById(detailId);
if (!detail) return;

const currentId = detail.getAttribute('data-current-id');
if (!currentId) return;

// Om ett specifikt ID skickas in -> reset endast om det är det ärendet som visas
if (affectedId && affectedId !== currentId) return;

// 🧹 Stäng & rensa detaljvyn
detail.style.display = 'none';
detail.innerHTML = '';
detail.removeAttribute('data-current-id');

// 🗺️ MAPPNING: Vilken placeholder hör till vilken detaljvy?
const placeholderMap = {
'inbox-detail': 'inbox-placeholder',
'my-ticket-detail': 'my-detail-placeholder',
'archive-detail': 'archive-placeholder',
'admin-detail-content': 'admin-placeholder' // 🔥 TILLAGD: Nu hittar även Admin hem till sin Hero!
};

const placeholderId = placeholderMap[detailId];
const placeholder = document.getElementById(placeholderId);

if (placeholder) {
placeholder.style.display = 'flex'; // Flex används för att Hero-ikonen ska centreras perfekt
}

console.log(`🧹 System-städning: Resetade ${detailId} (session ${currentId})`);
}

// ============================================================================
// MASTER HEADER ENGINE - SYNCHRONIZED
// ============================================================================
function renderDetailHeader(item, styles, extraActions = '') {
const timestamp = item.timestamp || (item.updated_at ? item.updated_at * 1000 : Date.now());
const dateStr = new Date(timestamp).toLocaleString('sv-SE', {
year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
});

const vIcon = getVehicleIcon(item.vehicle || item.vehicle_type);

// 1. Grund-pills (Datum)
let pills = `<span class="pill">${UI_ICONS.CALENDAR} ${dateStr}</span>`;

// 2. MOTTAGARE (Destination) - Fullständigt namn
const _officeMatch = officeData.find(o =>
o.routing_tag === item.routing_tag || o.routing_tag === item.owner
);
let officeLabel = null;
if (_officeMatch) {
officeLabel = (_officeMatch.name || `${_officeMatch.city} ${_officeMatch.area}`).toUpperCase();
} else if (item.city || item.destination) {
officeLabel = (item.city || item.destination).toUpperCase();
}

if (officeLabel) {
pills += `<span class="pill" style="color:${styles.main}; border-color:${styles.border}; font-weight:700;">${UI_ICONS.CITY_SMALL} ${officeLabel}</span>`;
}

// 3. AGENT (Om tilldelat)
if (item.owner) {
pills += `<span class="pill">${UI_ICONS.AGENT_SMALL} ${formatName(item.owner)}</span>`;
}

// 4. FORDONSTYP
const vehicleName = item.vehicle || item.vehicle_type;
if (vehicleName) {
pills += `<span class="pill" title="Fordon">${vIcon || ''} ${vehicleName.toUpperCase()}</span>`;
}

// 5. EPOST
const email = item.email || item.contact_email;
if (email) {
pills += `<span class="pill">${UI_ICONS.MAIL} ${email}</span>`;
}

// 6. MOBIL (Chatt-specifikt fält)
const phone = item.phone || item.contact_phone;
if (phone) {
pills += `<span class="pill">${UI_ICONS.PHONE} ${phone}</span>`;
}

const aiBadge = item.human_mode === 0 ? `<span class="ai-badge">AI</span>` : '';

return `
<div class="detail-header-top" style="background: linear-gradient(90deg, ${styles.bg || styles.main + '1a'}, transparent); border-bottom: 2px solid ${styles.main} !important;">
<div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
<div style="flex: 1; overflow: hidden;">
<div class="detail-subject">
${resolveTicketTitle(item)} ${aiBadge}
</div>
<div style="display: flex; gap: 6px; flex-wrap: wrap; font-size:11px; margin-top:6px;">
${pills}
</div>
</div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 20px;">
${extraActions}
<div style="width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
<button class="notes-trigger-btn header-button icon-only-btn"
data-id="${item.conversation_id || item.id}"
onclick="openNotesModal('${item.conversation_id || item.id}')">
${UI_ICONS.NOTES}
</button>
</div>
</div>
</div>`;
}

//---------------------------------------
//-------GET VEHICLE ICON-------------//
//---------------------------------------
function getVehicleIcon(type) {
if (!type) return '';
const t = type.toUpperCase();
if (t === 'BIL') return UI_ICONS.CAR;
if (t === 'MC') return UI_ICONS.BIKE;
if (t === 'AM' || t === 'MOPED') return UI_ICONS.MOPED;
if (t === 'LASTBIL' || t === 'TUNG') return UI_ICONS.TRUCK;
if (t === 'SLÄP') return UI_ICONS.TRAILER;
return '';
}
