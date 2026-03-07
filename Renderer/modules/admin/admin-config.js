// ============================================
// modules/admin/admin-config.js
// VAD DEN GÖR: Admin — systemkonfiguration,
//              nätverksinställningar och AI-motor
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders                       — renderer.js globals
//   ADMIN_UI_ICONS                                 — ui-constants.js
//   showToast                                      — styling-utils.js
//   atlasConfirm                                   — renderer.js
//   renderDriftSecuritySection, unlockDriftField,  — renderer.js (Drift-funktioner)
//   saveDriftFieldAndLock, saveDriftSetting        — renderer.js (Drift-funktioner)
// ============================================

// =============================================================================
// ADMIN TAB 3 — SYSTEMKONFIGURATION
// =============================================================================
function renderSystemConfigNav() {
const listContainer = document.getElementById('admin-main-list');
if (!listContainer) return;

const sections = [
{ id: 'paths', icon: '📁', label: 'Systemsökvägar' },
{ id: 'drift', icon: '🛡️', label: 'Drift & Säkerhet' },
{ id: 'network', icon: '🌐', label: 'Nätverksinställningar' },
{ id: 'email', icon: '📧', label: 'E-postkonfiguration' },
{ id: 'ai', icon: '🤖', label: 'AI-motor' },
{ id: 'rag', icon: '⚡', label: 'RAG — Poängsättning' },
{ id: 'bookinglinks', icon: '🔗', label: 'Bokningslänkar' },
{ id: 'knowledge', icon: '📚', label: 'Kunskapsbank' },
{ id: 'gaps', icon: '🔍', label: 'Kunskapsluckor' },
{ id: 'reports', icon: '📊', label: 'Rapporter <span style="font-size:9px; font-weight:700; color:var(--accent-primary); opacity:0.85; letter-spacing:0.4px; vertical-align:middle; margin-left:3px;">AI</span>' }
];

listContainer.innerHTML = sections.map(s => `
<div class="admin-sysconfig-nav-item" onclick="openSystemConfigSection('${s.id}', this)">
<span>${s.icon}</span>
<span>${s.label}</span>
</div>
`).join('');
}

async function openSystemConfigSection(section, element) {
const wasOpen = element && element.dataset.kbOpen === 'true';
document.querySelectorAll('.admin-sysconfig-nav-item').forEach(el => {
el.classList.remove('active');
el.dataset.kbOpen = 'false';
});
const existingKb = document.getElementById('kb-sublist');
if (existingKb) existingKb.remove();
if (element && !(section === 'knowledge' && wasOpen)) element.classList.add('active');

const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;

placeholder.style.display = 'none';
detailBox.style.display = 'flex';

if (section === 'knowledge') {
if (wasOpen) {
if (detailBox) detailBox.style.display = 'none';
if (placeholder) { placeholder.style.display = 'flex'; }
return;
}
if (element) element.dataset.kbOpen = 'true';
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/basfakta-list`, { headers: fetchHeaders });
if (!res.ok) throw new Error('List fetch failed');
const files = await res.json();
renderBasfaktaSubList(files);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte ladda kunskapsbanken.</div>';
}
return;
}

if (section === 'drift') {
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/operation-settings`, { headers: fetchHeaders });
if (!res.ok) throw new Error('Drift fetch failed');
const settings = await res.json();
renderDriftSecuritySection(detailBox, settings);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta drift-inställningar.</div>';
}
return;
}

if (section === 'gaps') {
renderRagFailuresInDetail(detailBox);
return;
}

if (section === 'reports') {
renderReportSection(detailBox);
return;
}

if (section === 'rag') {
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/rag-scores`, { headers: fetchHeaders });
if (!res.ok) throw new Error('RAG scores fetch failed');
const scores = await res.json();
renderRagScoresSection(scores, detailBox);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta RAG-poängsättning.</div>';
}
return;
}

if (section === 'bookinglinks') {
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/booking-links`, { headers: fetchHeaders });
if (!res.ok) throw new Error('Booking links fetch failed');
const links = await res.json();
renderBookingLinksSection(links, detailBox);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta bokningslänkar.</div>';
}
return;
}

detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/system-config`, { headers: fetchHeaders });
if (!res.ok) throw new Error('Config fetch failed');
const config = await res.json();
renderConfigSection(section, config, detailBox);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta konfiguration.</div>';
}
}

function renderConfigSection(section, config, detailBox) {
let rows = '';

if (section === 'network') {
rows = `
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🌐 Nätverksinställningar</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
Styr hur Atlas-servern exponeras lokalt och via internet. För att Atlas ärendesystem ska vara åtkomligt via webben — t.ex. för kundchatten eller fjärrinloggning — måste både porten och ngrok-domänen vara korrekt konfigurerade.
</p>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Ändringar kräver omstart av servern för att träda i kraft. Fel port eller ngrok-domän gör att systemet blir oåtkomligt utifrån.</span>
</div>
<div style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:-12px 0 14px 0; display:grid; grid-template-columns:90px 1fr; gap:2px 10px;">
<span style="opacity:0.7;">PORT</span><span>Den port som Atlasservern lyssnar på lokalt.</span>
<span style="opacity:0.7;">NGROK Domain</span><span>Den fasta publika URL som tunnlar trafik från internet till den lokala servern via ngrok.</span>
</div>
${buildConfigRow('PORT', 'PORT (Serverport)', config.PORT, false)}
${buildConfigRow('NGROK_DOMAIN', 'NGROK Domain', config.NGROK_DOMAIN, false)}
`;
} else if (section === 'email') {
rows = `
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">📧 E-postkonfiguration</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
Inloggningsuppgifterna som Atlas använder för att skicka utgående e-post — t.ex. avisering om nya ärenden. Använd en app-specifik lösenordsnyckel om kontot har tvåfaktorsautentisering aktiverat (rekommenderas).
</p>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Lösenordet lagras i <code>.env</code> och visas alltid maskerat. Ändringar kräver omstart av servern.</span>
</div>
${buildConfigRow('EMAIL_USER', 'E-postadress', config.EMAIL_USER, false)}
${buildConfigRow('EMAIL_PASS', 'Lösenord / App-nyckel', config.EMAIL_PASS, true)}
`;
} else if (section === 'ai') {
rows = `
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🤖 AI-motor — Confidence-trösklar</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
API-nyckeln kopplar Atlas till OpenAI. Confidence-trösklarna styr hur säker AI:n måste vara på en frågekategori innan den agerar — lägre värde ger fler svar men ökar risken för felklassificering, högre värde ger färre men säkrare svar.
</p>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>API-nyckeln är känslig — dela den aldrig. Ändringar till trösklar kräver omstart av servern för att aktiveras i AI-motorn.</span>
</div>
<div style="overflow-y:auto; max-height:calc(75vh - 180px); padding-right:8px;">
${buildConfigRow('OPENAI_API_KEY', 'OpenAI API-nyckel', config.OPENAI_API_KEY, true)}
${buildConfigRow('defaultConfidence', 'Default Confidence', config.defaultConfidence)}
${buildConfigRow('conf_weather', 'Väder (weather)', config.conf_weather)}
${buildConfigRow('conf_testlesson', 'Testlektion', config.conf_testlesson)}
${buildConfigRow('conf_risk', 'Risk', config.conf_risk)}
${buildConfigRow('conf_handledare', 'Handledare', config.conf_handledare)}
${buildConfigRow('conf_tillstand', 'Tillstånd', config.conf_tillstand)}
${buildConfigRow('conf_policy', 'Policy', config.conf_policy)}
${buildConfigRow('conf_contact', 'Kontakt', config.conf_contact)}
${buildConfigRow('conf_booking', 'Bokning', config.conf_booking)}
${buildConfigRow('conf_price', 'Pris', config.conf_price)}
${buildConfigRow('conf_discount', 'Rabatt', config.conf_discount)}
${buildConfigRow('conf_intent', 'Avsikt (intent)', config.conf_intent)}
</div>
`;
} else if (section === 'paths') {
rows = `
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">📁 Systemsökvägar</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
Visar de filsystemsökvägar som servern använder internt. Dessa sätts automatiskt vid installation och är skrivskyddade — de kan inte ändras via gränssnittet. Kontakta systemadministratören om sökvägarna behöver justeras.
</p>
<div style="font-size:11px; color:rgba(150,150,180,0.6); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>🔒</span>
<span>Skrivskyddade fält. Ändras enbart direkt i konfigurationsfilen vid behov.</span>
</div>
${buildConfigRow('DEV_PATH', 'Utvecklingssökväg', config.DEV_PATH, false, true)}
${buildConfigRow('KNOWLEDGE_BASE_PATH', 'Kunskapsbas-sökväg', config.KNOWLEDGE_BASE_PATH, false, true)}
`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
${rows}
<div id="sysconfig-restart-notice" style="display:none;" class="admin-restart-notice">⚠️ Kräver omstart av servern för att träda i kraft</div>
<div id="sysconfig-changed-files" style="margin-top:12px;"></div>
</div>
</div>
`;
}

function buildConfigRow(fieldId, label, value, isMasked, isReadonly) {
isMasked = isMasked || false;
isReadonly = isReadonly || false;
const displayValue = isMasked ? '••••••••' : (value || '');
const actualValue = (value || '').toString().replace(/"/g, '&quot;');
return `
<div class="admin-config-row" id="row-${fieldId}">
<label>${label}</label>
<input
class="admin-config-field"
id="field-${fieldId}"
type="text"
value="${displayValue}"
data-actual="${actualValue}"
data-masked="${isMasked}"
${isReadonly ? 'readonly style="opacity:0.4; cursor:not-allowed;"' : 'disabled'}
>
${!isReadonly ? `
<button class="admin-lock-btn" id="lock-${fieldId}" onclick="unlockConfigField('${fieldId}')">🔒 Låst</button>
<button class="config-save-btn" style="display:none;" id="save-${fieldId}" onclick="saveSystemConfigField('${fieldId}')" title="Spara"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></button>
` : ''}
</div>
`;
}

function unlockConfigField(fieldId) {
const field = document.getElementById(`field-${fieldId}`);
const lockBtn = document.getElementById(`lock-${fieldId}`);
const saveBtn = document.getElementById(`save-${fieldId}`);
if (!field || !lockBtn) return;

const isMasked = field.getAttribute('data-masked') === 'true';
if (isMasked) field.value = field.getAttribute('data-actual') || '';

field.disabled = false;
field.focus();
lockBtn.textContent = '🔓 Låst upp';
lockBtn.classList.add('unlocked');
if (saveBtn) saveBtn.style.display = 'inline-flex';

lockBtn.onclick = () => {
field.disabled = true;
if (isMasked) field.value = '••••••••';
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockConfigField(fieldId);
if (saveBtn) saveBtn.style.display = 'none';
};
}

async function saveSystemConfigField(fieldId) {
const field = document.getElementById(`field-${fieldId}`);
if (!field) return;
const value = field.value.trim();
if (!value) { showToast('❌ Värdet får inte vara tomt.'); return; }

const saveBtn = document.getElementById(`save-${fieldId}`);
if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.4'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/system-config`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ field: fieldId, value })
});
const data = await res.json();
if (!res.ok) { showToast(`❌ ${data.error || 'Serverfel'}`); return; }

showToast(`✅ ${fieldId} uppdaterad!`);

const changedEl = document.getElementById('sysconfig-changed-files');
if (changedEl && data.changedFiles && data.changedFiles.length) {
changedEl.innerHTML = `
<div style="font-size:11px; color:var(--text-secondary);">
<div style="margin-bottom:4px; opacity:0.6;">Synkade filer:</div>
${data.changedFiles.map(f => `<div style="font-family:monospace;">✓ ${f}</div>`).join('')}
</div>
`;
}

if (data.restartRequired) {
const notice = document.getElementById('sysconfig-restart-notice');
if (notice) notice.style.display = 'flex';
}

// Lås fältet igen
const lockBtn = document.getElementById(`lock-${fieldId}`);
field.disabled = true;
if (lockBtn) { lockBtn.textContent = '🔒 Låst'; lockBtn.classList.remove('unlocked'); lockBtn.onclick = () => unlockConfigField(fieldId); }
if (saveBtn) saveBtn.style.display = 'none';

} catch (e) {
showToast('❌ Nätverksfel vid sparning.');
} finally {
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
}
// =============================================================================
// RAG — POÄNGSÄTTNING (Ny sektion)
// =============================================================================
function renderRagScoresSection(scores, detailBox) {
const DEFAULTS = {
rag_score_a1_am:       25000,
rag_score_fix_saknade: 20000,
rag_score_c8_kontakt:  25000,
rag_score_b1_policy:   50000,
rag_score_c7_teori:    55000
};

function val(key) {
return scores[key] !== undefined ? scores[key] : DEFAULTS[key];
}

function buildRagRow(id, field, label, defaultVal, hint) {
const current = val(field);
return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:4px; display:block;">
${label}
<span style="font-size:11px; opacity:0.5; margin-left:6px;">(default: ${defaultVal})</span>
</label>
${hint ? `<div style="font-size:11px; color:var(--text-secondary); opacity:0.6; margin-bottom:6px;">${hint}</div>` : ''}
<div style="display:flex; align-items:center; gap:8px;">
<input type="number" id="rag-${id}" class="admin-config-field"
value="${current}" min="0" max="9999999" style="width:120px;" disabled>
<button class="admin-lock-btn" id="rag-lock-${id}"
onclick="unlockRagField('${id}', '${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="rag-save-${id}"
onclick="saveRagField('${id}', '${field}')">Spara</button>
<button class="btn-glass-small" style="display:none; opacity:0.6;" id="rag-reset-${id}"
onclick="resetRagField('${id}', '${field}', ${defaultVal})">↺ Reset</button>
</div>
</div>
`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">⚡ RAG — Poängsättning</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
Styr vilka kunskapschunks som prioriteras när AI:n hämtar information via RAG (Retrieval-Augmented Generation). Chunks med högre poäng "vinner" konkurrensen och skickas till AI-motorn — lägre poäng innebär att andra regler kan tränga undan svaret.
</p>
<div style="font-size:11px; color:#ff6b6b; background:rgba(255,107,107,0.08); border:1px solid rgba(255,107,107,0.25); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Ändra med stor försiktighet. En regel som oavsiktligt övertrumfar en annan kan ge felaktiga kundsvar. Kräver omstart av servern för att aktiveras.</span>
</div>
<div style="overflow-y:auto; max-height:calc(75vh - 140px); padding-right:8px;">
${buildRagRow(
'a1_am', 'rag_score_a1_am', 'rule_A1_AM — AM/Moped chunks', 25000,
'Måste vara högre än rule_Fix_SaknadeSvar (se nedan) för att AM-frågor ska få rätt svar.'
)}
${buildRagRow(
'fix_saknade', 'rag_score_fix_saknade', 'rule_Fix_SaknadeSvar — Fallback-chunk', 20000,
'Injiceras vid intent=intent_info eller unknown. För högt värde tränger undan specifika svar.'
)}
${buildRagRow(
'c8_kontakt', 'rag_score_c8_kontakt', 'rule_C8_Kontakt — Kontaktinfo (contact_info intent)', 25000,
'Score för företagsinfochunks vid kontaktfrågor utan explicit stad.'
)}
${buildRagRow(
'b1_policy', 'rag_score_b1_policy', 'rule_B1_Policy — Policy (policy/booking intent)', 50000,
'Score för policy-chunks vid avbokning, ångerrätt, sjukanmälan m.m.'
)}
${buildRagRow(
'c7_teori', 'rag_score_c7_teori', 'rule_C7_TeoriAppen — Teoriapp-chunks', 55000,
'Högst av alla — garanterar att app-info vinner vid frågor om appen Mitt Körkort.'
)}
</div>
<div id="rag-scores-notice" style="display:none; margin-top:16px;"
class="admin-restart-notice">
✅ Värdet sparades. Starta om servern för att aktivera i RAG-motorn.
</div>
</div>
</div>
`;
}

function unlockRagField(id, field) {
const inp = document.getElementById(`rag-${id}`);
const lockBtn = document.getElementById(`rag-lock-${id}`);
const saveBtn = document.getElementById(`rag-save-${id}`);
const resetBtn = document.getElementById(`rag-reset-${id}`);
if (!inp || !lockBtn) return;

inp.disabled = false;
inp.focus();
lockBtn.textContent = '🔓 Låst upp';
lockBtn.classList.add('unlocked');
if (saveBtn) saveBtn.style.display = 'inline-block';
if (resetBtn) resetBtn.style.display = 'inline-block';

lockBtn.onclick = () => {
inp.disabled = true;
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockRagField(id, field);
if (saveBtn) saveBtn.style.display = 'none';
if (resetBtn) resetBtn.style.display = 'none';
};
}

async function saveRagField(id, field) {
const inp = document.getElementById(`rag-${id}`);
const saveBtn = document.getElementById(`rag-save-${id}`);
const lockBtn = document.getElementById(`rag-lock-${id}`);
const resetBtn = document.getElementById(`rag-reset-${id}`);
if (!inp) return;

const value = parseInt(inp.value, 10);
if (isNaN(value) || value < 0) { showToast('❌ Ogiltigt värde — måste vara ett heltal ≥ 0.'); return; }

if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.4'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/rag-scores`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ field, value })
});
const data = await res.json();
if (!res.ok) { showToast(`❌ ${data.error || 'Serverfel'}`); return; }

showToast(`✅ ${field} sparad (${value})`);
const notice = document.getElementById('rag-scores-notice');
if (notice) notice.style.display = 'flex';

inp.disabled = true;
if (lockBtn) { lockBtn.textContent = '🔒 Låst'; lockBtn.classList.remove('unlocked'); lockBtn.onclick = () => unlockRagField(id, field); }
if (saveBtn) { saveBtn.style.display = 'none'; saveBtn.disabled = false; saveBtn.style.opacity = ''; }
if (resetBtn) resetBtn.style.display = 'none';
} catch (e) {
showToast('❌ Nätverksfel vid sparning.');
} finally {
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
}

async function resetRagField(id, field, defaultVal) {
const inp = document.getElementById(`rag-${id}`);
if (!inp) return;
inp.value = defaultVal;
await saveRagField(id, field);
}

// =============================================================================
// BOKNINGSLÄNKAR (Ny sektion — speglar RAG-poängsättningens mönster)
// =============================================================================
function renderBookingLinksSection(links, detailBox) {

const LABELS = {
AM:       { label: 'AM / Moped',                   hint: 'Visas när kunden frågar om moped- eller AM-kurs.' },
MC:       { label: 'MC / Motorcykel',               hint: 'Visas vid MC-frågor utan specifikt kontor.' },
CAR:      { label: 'Bil / Körlektion',              hint: 'Visas vid frågor om bilkörkort och generella lektioner.' },
INTRO:    { label: 'Handledarkurs / Introduktion',  hint: 'Visas vid frågor om introduktionskursen.' },
RISK1:    { label: 'Riskettan (Risk 1)',             hint: 'Visas vid frågor om Risk 1.' },
RISK2:    { label: 'Risktvåan / Halkbana (Risk 2)', hint: 'Visas vid frågor om Risk 2 / halkbana.' },
TEORI:    { label: 'Teoriapp (Mitt Körkort)',        hint: 'Visas vid frågor om teori och körkortsprov.' },
'B96/BE': { label: 'Släpvagn (B96/BE)',             hint: 'Visas vid frågor om släpvagnsutbildning.' },
TUNG:     { label: 'Tung Trafik (C/CE)',            hint: 'Visas vid frågor om lastbilsutbildning.' },
POLICY:   { label: 'Policy / Köpvillkor',           hint: 'Visas vid frågor om villkor, faktura och ångerrätt.' }
};

function buildLinkRow(key) {
const meta = LABELS[key] || { label: key, hint: '' };
const currentUrl = (links[key] && links[key].url) ? links[key].url : '';
const safeUrl = currentUrl.replace(/"/g, '&quot;');
return `
<div id="bl-row-${key}" style="display:grid; grid-template-columns:200px 1fr auto auto; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
<div>
<div style="font-size:13px; color:var(--text-primary); font-weight:500; line-height:1.3;">${meta.label}
<span style="font-size:10px; opacity:0.35; margin-left:5px; font-family:monospace; font-weight:400;">${key}</span>
</div>
${meta.hint ? `<div style="font-size:11px; color:var(--text-secondary); opacity:0.5; margin-top:2px; line-height:1.35;">${meta.hint}</div>` : ''}
</div>
<input type="text" id="bl-${key}" class="admin-config-field"
value="${safeUrl}" style="min-width:0; width:100%;" disabled
placeholder="https://...">
<button class="admin-lock-btn" id="bl-lock-${key}" style="white-space:nowrap; flex-shrink:0;"
onclick="unlockBookingLinkField('${key}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none; flex-shrink:0;" id="bl-save-${key}"
onclick="saveBookingLinkField('${key}')">Spara</button>
</div>
`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🔗 Bokningslänkar</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
De URL:er som AI-assistenten inkluderar i sina svar när en kund frågar om bokning för en specifik kurstyp. Varje länk är kopplad till en kurskategori och visas kontextberoende — kunden ser aldrig fler länkar än vad frågan motiverar.
</p>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 16px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Länkarna sparas i <code>utils/booking-links.json</code> och läses in av RAG-motorn vid uppstart. Kräver omstart av servern för att träda i kraft.</span>
</div>
<div style="display:grid; grid-template-columns:200px 1fr auto auto; gap:0 10px; padding:0 0 6px 0; border-bottom:1px solid rgba(255,255,255,0.09); margin-bottom:2px;">
<span style="font-size:10px; text-transform:uppercase; letter-spacing:0.06em; opacity:0.4; color:var(--text-secondary);">Kurstyp</span>
<span style="font-size:10px; text-transform:uppercase; letter-spacing:0.06em; opacity:0.4; color:var(--text-secondary);">URL</span>
<span></span><span></span>
</div>
<div style="overflow-y:auto; max-height:calc(75vh - 200px); padding-right:6px;">
${Object.keys(LABELS).map(k => buildLinkRow(k)).join('')}
</div>
<div id="bl-notice" style="display:none; margin-top:14px;" class="admin-restart-notice">
✅ Länken sparad. Starta om servern för att aktivera i RAG-motorn.
</div>
</div>
</div>
`;
}

function unlockBookingLinkField(key) {
const inp = document.getElementById(`bl-${key}`);
const lockBtn = document.getElementById(`bl-lock-${key}`);
const saveBtn = document.getElementById(`bl-save-${key}`);
if (!inp || !lockBtn) return;

inp.disabled = false;
inp.focus();
lockBtn.textContent = '🔓 Låst upp';
lockBtn.classList.add('unlocked');
if (saveBtn) saveBtn.style.display = 'inline-block';

lockBtn.onclick = () => {
inp.disabled = true;
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockBookingLinkField(key);
if (saveBtn) saveBtn.style.display = 'none';
};
}

async function saveBookingLinkField(key) {
const inp = document.getElementById(`bl-${key}`);
const saveBtn = document.getElementById(`bl-save-${key}`);
const lockBtn = document.getElementById(`bl-lock-${key}`);
if (!inp) return;

const url = inp.value.trim();
if (!url || !url.startsWith('http')) {
showToast('❌ URL måste börja med http:// eller https://');
return;
}

if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.4'; }

try {
const res = await fetch(`${SERVER_URL}/api/admin/booking-links`, {
method: 'POST',
headers: fetchHeaders,
body: JSON.stringify({ key, url })
});
const data = await res.json();
if (!res.ok) { showToast(`❌ ${data.error || 'Serverfel'}`); return; }

showToast(`✅ ${key} sparad`);
const notice = document.getElementById('bl-notice');
if (notice) notice.style.display = 'flex';

inp.disabled = true;
if (lockBtn) {
lockBtn.textContent = '🔒 Låst';
lockBtn.classList.remove('unlocked');
lockBtn.onclick = () => unlockBookingLinkField(key);
}
if (saveBtn) { saveBtn.style.display = 'none'; }

} catch (e) {
showToast('❌ Nätverksfel vid sparning.');
} finally {
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
}

// =============================================================================
// RAPPORTER — renderReportSection / generateReport / downloadReport
// =============================================================================
function renderReportSection(detailBox) {
const presets = [
{ type: 'activity', icon: '📈', label: 'Aktivitetsrapport',  desc: 'Ärenden per agent och kontor' },
{ type: 'agents',   icon: '👤', label: 'Agentstatistik',     desc: 'Per agent: ärenden och hantering' },
{ type: 'rag_gaps', icon: '🔍', label: 'Kunskapsluckor',     desc: 'Vanligaste RAG-failures' },
{ type: 'contacts', icon: '📧', label: 'Kundkontakter',      desc: 'Sessioner med e-post / telefon' }
];

detailBox.innerHTML = `<div class="detail-body" style="padding:25px; overflow-y:auto;">
<h2 style="margin:0 0 6px; font-size:17px; font-weight:600; opacity:0.9;">📊 Rapporter</h2>
<p style="margin:0 0 24px; font-size:13px; opacity:0.45;">AI hämtar data ur databasen och genererar en Markdown-rapport som du kan ladda ner.</p>

<div style="margin-bottom:24px;">
<div style="font-size:11px; opacity:0.45; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Fördefinierade rapporter</div>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
${presets.map(r => `
<button class="report-preset-btn" onclick="generateReport('${r.type}')">
<span style="font-size:22px; line-height:1;">${r.icon}</span>
<div style="text-align:left;">
<div style="font-weight:600; font-size:13px; margin-bottom:2px;">${r.label}</div>
<div style="font-size:11px; opacity:0.5;">${r.desc}</div>
</div>
</button>`).join('')}
</div>
</div>

<div style="margin-bottom:24px;">
<div style="font-size:11px; opacity:0.45; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Anpassad rapport med AI</div>
<textarea id="report-custom-input"
placeholder="Beskriv vilken rapport du önskar... t.ex. 'Visa de 5 mest aktiva agenterna den senaste månaden med fordonsfördelning'"
style="width:100%; height:90px; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:var(--text-primary); font-size:13px; resize:vertical; box-sizing:border-box; outline:none;"></textarea>
<button class="report-action-btn" onclick="generateReport('custom')" style="margin-top:10px;">
✨ Generera anpassad rapport
</button>
</div>

<div id="report-output" style="display:none;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
<div id="report-output-title" style="font-size:12px; opacity:0.5;"></div>
<button class="report-action-btn" onclick="downloadReport()">⬇️ Ladda ner .md</button>
</div>
<pre id="report-preview" style="
background:rgba(0,0,0,0.3);
border:1px solid rgba(255,255,255,0.08);
border-radius:8px; padding:16px; font-size:12px; line-height:1.65;
overflow-x:auto; white-space:pre-wrap; max-height:420px; overflow-y:auto;
font-family:monospace; margin:0;"></pre>
</div>
</div>`;
}

async function generateReport(type) {
const outputEl  = document.getElementById('report-output');
const previewEl = document.getElementById('report-preview');
const titleEl   = document.getElementById('report-output-title');

const customQuery = type === 'custom'
? (document.getElementById('report-custom-input')?.value?.trim() || '')
: null;

if (type === 'custom' && !customQuery) {
showToast('Beskriv vad du vill ha i rapporten.');
return;
}

// Visa laddning
if (outputEl)  outputEl.style.display = 'block';
if (previewEl) previewEl.textContent = '⏳ Hämtar data och genererar rapport...';
if (titleEl)   titleEl.textContent   = '';

try {
const res = await fetch(`${SERVER_URL}/api/admin/generate-report`, {
method: 'POST',
headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ type, customQuery })
});

if (!res.ok) {
const err = await res.json().catch(() => ({}));
throw new Error(err.error || `HTTP ${res.status}`);
}

const { markdown, title, generatedAt } = await res.json();

if (previewEl) previewEl.textContent = markdown;
if (titleEl) {
const dateStr = generatedAt
? new Date(generatedAt).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
: '';
titleEl.textContent = `${title} • ${dateStr}`;
}

// Spara för nedladdning
window._lastReportMarkdown = markdown;
window._lastReportTitle    = title;

} catch (err) {
if (previewEl) previewEl.textContent = `❌ Kunde inte generera rapport: ${err.message}`;
console.error('[REPORT] Fel:', err);
}
}

function downloadReport() {
const markdown = window._lastReportMarkdown;
if (!markdown) { showToast('Ingen rapport att ladda ner.'); return; }

const slug = (window._lastReportTitle || 'atlas-rapport')
.toLowerCase()
.replace(/[åä]/g, 'a').replace(/ö/g, 'o')
.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
const date     = new Date().toISOString().slice(0, 10);
const filename = `atlas-${slug}-${date}.md`;

const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' });
const url  = URL.createObjectURL(blob);
const a    = document.createElement('a');
a.href     = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
}