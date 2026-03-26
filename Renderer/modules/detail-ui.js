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

// ⚠️  ╔══════════════════════════════════════════════════════════════╗
// ⚠️  ║     KRITISK VARNING — DETALJVYNS HEADER OCH FÄRGER          ║
// ⚠️  ╠══════════════════════════════════════════════════════════════╣
// ⚠️  ║                                                              ║
// ⚠️  ║  renderDetailHeader(item, styles, extraActions) är          ║
// ⚠️  ║  konsument av färgobjektet från getAgentStyles() i          ║
// ⚠️  ║  styling-utils.js. Den skapar INGA egna hex-värden.         ║
// ⚠️  ║                                                              ║
// ⚠️  ║  FÄRGNYCKLAR SOM ANVÄNDS HÄR (från styles-objektet):        ║
// ⚠️  ║   styles.main   → header-gradient, border, subject-text,    ║
// ⚠️  ║                   pill-text/border, kundhistorik-knapp       ║
// ⚠️  ║   styles.bg     → header-bakgrundsgradient (8% opacity)     ║
// ⚠️  ║   styles.border → pill-kantlinje (30% opacity)              ║
// ⚠️  ║                                                              ║
// ⚠️  ║  ❌ ÄNDRA INTE: styles.bg || styles.main + '1a' — fallback  ║
// ⚠️  ║     om bg saknas (äldre data utan bg-nyckel).               ║
// ⚠️  ║  ❌ ÄNDRA INTE: '!important' på border-bottom och           ║
// ⚠️  ║     detail-subject color — CSS-specificiteten kräver det.   ║
// ⚠️  ║                                                              ║
// ⚠️  ║  getVehicleIcon(type): Matchar fordonstyp mot UI_ICONS-     ║
// ⚠️  ║  biblioteket. Strängarna (BIL/MC/AM/LASTBIL/SLÄP) matchar  ║
// ⚠️  ║  exakt vad DB och locked_context sparar — ändra inte        ║
// ⚠️  ║  jämförelsesträngarna utan att verifiera mot DB-data.       ║
// ⚠️  ╚══════════════════════════════════════════════════════════════╝

// ===================================================
// STÄDAR VYERNA OCH RENDERAR OM
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
'admin-detail-content': 'admin-placeholder'
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

// 3. AGENT (Om tilldelat) — för interna ärenden visas motparten, inte ägaren
if (item.owner) {
  let pillName;
  if (item.session_type === 'internal') {
    const myUsername = (currentUser?.username || '').toLowerCase();
    const iAmSender = item.sender &&
      item.sender.toLowerCase() === myUsername;
    pillName = iAmSender ? item.owner : item.sender;
  } else {
    pillName = item.owner;
  }
  pills += `<span class="pill">${UI_ICONS.AGENT_SMALL} ${formatName(pillName || item.owner)}</span>`;
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

// 7. AVSLUTNINGSORSAK (Garaget — visas om close_reason finns)
if (item.close_reason) {
let closedLabel = '';
let closedIcon = '🔒';
if (item.close_reason === 'inactivity') {
closedLabel = 'Stängd: inaktivitet';
closedIcon = '⏱️';
} else if (item.close_reason === 'customer') {
closedLabel = 'Kunden avslutade';
closedIcon = '👋';
} else if (item.close_reason.startsWith('agent:')) {
const agentName = item.close_reason.replace('agent:', '');
closedLabel = `Avslutad av ${agentName}`;
closedIcon = '✅';
} else {
closedLabel = item.close_reason;
}
pills += `<span class="pill" title="Avslutningsorsak">${closedIcon} ${closedLabel}</span>`;
}

const aiBadge = item.human_mode === 0 ? `<span class="ai-badge">AI</span>` : '';

// Intern-badge för privata kollegor-till-kollega-ärenden
const isInternalTicket = item.session_type === 'internal' || item.routing_tag === 'INTERNAL';
const rawTitle = resolveTicketTitle(item);
// Kapitalisera första bokstaven (contact_name kan vara lowercase "admin" etc. från DB)
const displayTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
const internalBadge = isInternalTicket
  ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:#f1c40f; background:rgba(241,196,15,0.12); border:1px solid rgba(241,196,15,0.3); border-radius:6px; padding:2px 8px; margin-left:8px; flex-shrink:0;">${UI_ICONS.LOCK} Internt meddelande</span>`
  : '';

// Avatar-ring för kunden (klickbar för att se ärendehistorik)
// Visas inte för interna ärenden — ingen kundhistorik finns att visa
const customerName = item.contact_name || item.name || item.customer_name || 'Kund';
const customerInitials = customerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
const avatarHTML = email && !isInternalTicket ?
`<div style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: ${styles.main}22; border: 2px solid ${styles.main}; color: ${styles.main}; font-weight: 700; font-size: 12px; cursor: pointer; margin-right: 10px; flex-shrink: 0;"
onclick="showCustomerReaderModal('${email}')"
title="Visa kundens ärendehistorik: ${customerName}">${customerInitials}</div>` : '';

// Ingen separat profil-knapp längre — den är integrerad i avataren
// Lägg till "Fråga kollega"-knapp (eyeBtn) före övriga extraActions
const _eyeSubject = (item.subject || item.contact_name || '').replace(/'/g, "\\'");
const eyeBtn = `<button
  class="notes-trigger-btn header-button icon-only-btn"
  onclick="window.askColleagueAbout('${item.conversation_id || item.id}', '${_eyeSubject}')"
  title="Fråga en kollega om detta ärende"
  style="color:var(--text-secondary);">
  <svg xmlns='http://www.w3.org/2000/svg' width='15' height='15'
    viewBox='0 0 24 24' fill='none' stroke='currentColor'
    stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
    <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/>
    <circle cx='12' cy='12' r='3'/>
  </svg>
</button>`;
extraActions = eyeBtn + extraActions;

return `
<div class="detail-header-top" style="background: linear-gradient(90deg, color-mix(in srgb, ${styles.main} 12%, rgba(255,255,255,0.02)), transparent), rgba(0,0,0,0.15); border-top: 3px solid ${styles.main}; border-radius: 12px 12px 0 0; border-bottom: none; padding: 14px 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08);">
<div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
<div style="flex: 1; overflow: hidden;">
<div class="detail-subject" style="color:${styles.main} !important; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
${avatarHTML}
<span>${displayTitle} ${aiBadge}</span>${internalBadge}
</div>
<div style="display: flex; gap: 4px; flex-wrap: wrap; font-size:11px; margin-top:6px; align-items: center;">
${pills}
</div>
</div>
<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 20px;">
${extraActions}
<div style="width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
<button class="notes-trigger-btn header-button icon-only-btn"
data-id="${item.conversation_id || item.id}"
title="Interna anteckningar – visas aldrig för kunden"
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