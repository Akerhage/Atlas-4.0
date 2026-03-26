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
{ id: 'drift', icon: '🛡️', label: 'Drift & Säkerhet' },
{ id: 'email', icon: '📧', label: 'E-postkonfiguration' },
{ id: 'network', icon: '🌐', label: 'Nätverksinställningar' },
{ id: 'ai', icon: '🤖', label: 'AI-motor' },
{ id: 'rag', icon: '⚡', label: 'RAG — Poängsättning' },
{ id: 'bookinglinks', icon: '🔗', label: 'Bokningslänkar' },
{ id: 'tsurls',      icon: '🏛️', label: 'Transportstyrelsen-länkar' },
{ id: 'knowledge', icon: '📚', label: 'Kunskapsbank' },
{ id: 'gaps', icon: '🔍', label: 'Kunskapsluckor' },
{ id: 'reports', icon: '📊', label: 'Rapporter <span style="font-size:9px; font-weight:700; color:var(--accent-primary); opacity:0.85; letter-spacing:0.4px; vertical-align:middle; margin-left:3px;">AI</span>' },
{ id: 'paths', icon: '📁', label: 'Systemsökvägar' }
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

if (section === 'tsurls') {
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/ts-urls`, { headers: fetchHeaders });
if (!res.ok) throw new Error('TS-URLs fetch failed');
const urls = await res.json();
renderTsUrlsSection(urls, detailBox);
} catch (e) {
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta Transportstyrelsen-länkar.</div>';
}
return;
}

if (section === 'email') {
detailBox.innerHTML = '<div class="spinner-small"></div>';
try {
  const [configRes, opsRes] = await Promise.all([
    fetch(`${SERVER_URL}/api/admin/system-config`, { headers: fetchHeaders }),
    fetch(`${SERVER_URL}/api/admin/operation-settings`, { headers: fetchHeaders })
  ]);
  if (!configRes.ok || !opsRes.ok) throw new Error('Fetch misslyckades');
  const config = await configRes.json();
  const ops = await opsRes.json();
  renderEmailFullSection(detailBox, config, ops);
} catch (e) {
  detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b;">Kunde inte hämta e-postkonfiguration.</div>';
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

function renderEmailFullSection(detailBox, config, ops) {
  function _buildToggleRow(id, field, label, value) {
    const checked    = value === true || value === 'true';
    const pillColor  = checked ? '#4cd964' : 'var(--text-secondary)';
    const pillBg     = checked ? 'rgba(76,217,100,0.12)' : 'rgba(255,255,255,0.05)';
    const pillBorder = checked ? '1px solid rgba(76,217,100,0.4)' : '1px solid rgba(255,255,255,0.12)';
    const pillText   = checked ? '● Aktiverad' : 'Avaktiverad';
    return `
<div class="admin-config-row" style="margin-bottom:18px;">
<label style="font-size:13px; color:var(--text-secondary); margin-bottom:6px; display:block;">${label}</label>
<div style="display:flex; align-items:center; gap:12px; width:100%;">
<input type="checkbox" id="drift-${id}" ${checked ? 'checked' : ''} disabled style="display:none;">
<button id="drift-toggle-${id}" onclick="_driftToggle('${id}')"
  style="pointer-events:none; cursor:pointer; padding:5px 14px; border-radius:20px;
  font-size:13px; font-weight:600; transition:all 0.2s;
  color:${pillColor}; background:${pillBg}; border:${pillBorder};">
  ${pillText}
</button>
<button class="admin-lock-btn" id="drift-lock-${id}" style="margin-left:auto;" onclick="unlockDriftField('${id}','${field}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none;" id="drift-save-${id}" onclick="saveDriftFieldAndLock('${id}','${field}')">Spara</button>
</div>
</div>`;
  }

  detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">📧 E-postkonfiguration</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
Inloggningsuppgifterna som Atlas använder för att skicka utgående e-post — t.ex. avisering om nya ärenden. Använd en app-specifik lösenordsnyckel om kontot har tvåfaktorsautentisering aktiverat (rekommenderas).
</p>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 20px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Lösenordet lagras i <code>.env</code> och visas alltid maskerat. Ändringar kräver omstart av servern.</span>
</div>
${buildConfigRow('EMAIL_USER', 'E-postadress (avsändare)', config.EMAIL_USER, false)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Den e-postadress Atlas skickar notifikationer från. Måste vara registrerad och aktiv hos er e-postleverantör.</p>
${buildConfigRow('EMAIL_PASS', 'Lösenord / App-nyckel', config.EMAIL_PASS, true)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Har kontot tvåstegsverifiering aktiverat måste en app-specifik nyckel genereras — inte det vanliga lösenordet. Skapas i kontoinställningarna hos din e-postleverantör (t.ex. Google, Brevo).</p>
<hr style="border:none; border-top:1px solid rgba(255,255,255,0.07); margin:24px 0;">
<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">📨 Inkommande e-post (Intercom)</h4>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 18px 0;">
Styr om Atlas ska lyssna på inkorgen via IMAP och automatiskt skapa ärenden av inkommande mail. Kräver att IMAP-åtkomst är aktiverat i e-postkontots inställningar.
</p>
${_buildToggleRow('imap', 'imap_enabled', 'IMAP-polling aktiv', ops.imap_enabled)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Atlas kontrollerar inkorgen var 15:e sekund efter olästa mail.</p>
${_buildToggleRow('imap-inbound', 'imap_inbound', 'Inkommande mail skapar ärenden', ops.imap_inbound)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Varje nytt mail skapar ett ärende i Inkorgen och notifierar agenter. Mailet markeras som läst i inkorgen men raderas inte.</p>
<hr style="border:none; border-top:1px solid rgba(255,255,255,0.07); margin:24px 0;">
<div style="margin-bottom:20px;">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
    <label style="font-size:13px; color:var(--text-secondary); font-weight:600;">📵 E-POST BLOCKLISTA (Spam-filter)</label>
    <button onclick="window._openAddSpamModal()"
      style="padding:3px 12px; border-radius:6px; background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.15); color:var(--text-primary);
      cursor:pointer; font-size:12px; flex-shrink:0;">+ Lägg till</button>
  </div>
  <p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:0 0 10px 0;">
    E-postadresser eller domäner som blockeras från att skapa ärenden via Intercom-funktionen.
    Ange bara domännamnet (t.ex. <code style="opacity:0.8;">example.com</code>) för att blockera hela domänen.
  </p>
  <div id="spam-blocklist-wrap" style="display:flex; flex-direction:column; gap:6px;
    max-height:200px; overflow-y:auto;">
    <p style="color:var(--text-secondary); font-size:12px; opacity:0.5; margin:0;">Laddar...</p>
  </div>
</div>
</div>
</div>`;

  if (typeof window._loadSpamBlocklist === 'function') {
    window._loadSpamBlocklist();
  }
}

function renderConfigSection(section, config, detailBox) {
let rows = '';

if (section === 'network') {
rows = `
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🌐 Nätverksinställningar</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 20px 0;">
Visar aktiva serveradresser och lokala portinställningar. Dessa behöver normalt aldrig ändras under löpande drift.
</p>

<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">🟢 Live-serveradresser</h4>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 12px 0;">
  Dessa adresser är aktiva när Atlas körs via VPS-servern (Hetzner).
</p>
<div style="display:flex; flex-direction:column; gap:8px; margin-bottom:24px;">
  <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px;
    background:rgba(76,217,100,0.05); border:1px solid rgba(76,217,100,0.2);">
    <span style="font-size:14px;">🛡️</span>
    <div style="flex:1;">
      <div style="font-size:11px; color:var(--text-secondary); opacity:0.6; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.4px;">Atlas Ärendesystem</div>
      <div style="font-size:13px; color:#4cd964; font-family:monospace;">atlas-support.se</div>
    </div>
    <span style="font-size:10px; color:#4cd964; background:rgba(76,217,100,0.12); border:1px solid rgba(76,217,100,0.3); padding:2px 8px; border-radius:10px;">LIVE</span>
  </div>
  <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px;
    background:rgba(76,217,100,0.05); border:1px solid rgba(76,217,100,0.2);">
    <span style="font-size:14px;">💬</span>
    <div style="flex:1;">
      <div style="font-size:11px; color:var(--text-secondary); opacity:0.6; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.4px;">Kundchatt</div>
      <div style="font-size:13px; color:#4cd964; font-family:monospace;">atlas-support.se/kundchatt</div>
    </div>
    <span style="font-size:10px; color:#4cd964; background:rgba(76,217,100,0.12); border:1px solid rgba(76,217,100,0.3); padding:2px 8px; border-radius:10px;">LIVE</span>
  </div>
</div>

<hr style="border:none; border-top:1px solid rgba(255,255,255,0.07); margin:0 0 24px 0;">

<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">⚙️ Lokala inställningar</h4>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 16px 0;">
  Den port som servern lyssnar på internt. Ändras normalt inte.
</p>
${buildConfigRow('PORT', 'PORT (Serverport)', config.PORT, false)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 24px 0;">Den lokala port som Atlas-processen lyssnar på. Ändring kräver omstart.</p>

<hr style="border:none; border-top:1px solid rgba(255,255,255,0.07); margin:0 0 24px 0;">

<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">🔁 Ngrok — Nödlösning vid driftavbrott</h4>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.06); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 14px 0; display:flex; gap:7px; align-items:flex-start;">
  <span>ℹ️</span>
  <span>Ngrok används <strong>enbart</strong> som reservlösning om VPS-servern (Hetzner) skulle vara otillgänglig. Fungerar bara när Atlas körs lokalt — inte via VPS i normaldrift. Kunder ges ngrok-adressen tillfälligt till dess VPS är uppe igen.</span>
</div>
${buildConfigRow('NGROK_DOMAIN', 'Ngrok-domän (reservadress)', config.NGROK_DOMAIN, false)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 0 0;">Den fasta ngrok-adressen som tunnlar trafik från internet till den lokala datorn. Konfigureras i ngrok-kontot och ändras sällan.</p>
`;
} else if (section === 'ai') {
rows = `
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🤖 AI-motor — Confidence-trösklar</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 6px 0;">
Confidence-trösklarna styr hur säker AI:n måste vara på en frågekategori innan den svarar. Värden anges mellan 0 och 1 — ju högre värde desto säkrare måste AI:n vara. Lägre värde ger fler svar men med högre risk för felsvar.
</p>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 24px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Ändringar till trösklar kräver omstart av servern för att aktiveras. Ändra försiktigt — felaktiga värden kan göra att AI:n slutar svara på vissa frågor.</span>
</div>

<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">🔑 API-koppling</h4>
${buildWriteOnlyRow('OPENAI_API_KEY', 'OpenAI API-nyckel')}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 24px 0;">Nyckeln som kopplar Atlas till OpenAI. Behöver bara bytas om den nuvarande inaktiveras eller komprometteras. Visas aldrig i klartext.</p>

<hr style="border:none; border-top:1px solid rgba(255,255,255,0.07); margin:0 0 24px 0;">
<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">⚖️ Tröskelvärden per kategori</h4>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 16px 0;">
Varje kategori har ett eget tröskelvärde som styr när AI:n anser sig tillräckligt säker för att svara. Standardvärdet används som fallback om inget kategorispecifikt värde matchar.
</p>

${buildConfigRow('defaultConfidence', 'Standardvärde (Default Confidence)', config.defaultConfidence)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Används som fallback för frågor som inte matchar någon specifik kategori nedan.</p>

${buildConfigRow('conf_weather', 'Väder', config.conf_weather)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om väder och förhållanden vid körprovet. Sällan relevant — ofta satt högt.</p>

${buildConfigRow('conf_testlesson', 'Testlektion / Uppkörning', config.conf_testlesson)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om att boka eller genomföra uppkörning och körprov.</p>

${buildConfigRow('conf_risk', 'Riskutbildning (Risk 1 & 2)', config.conf_risk)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om Risk 1 (halkbana) och Risk 2 (landsväg). Obligatoriska moment i körkortutbildningen.</p>

${buildConfigRow('conf_handledare', 'Handledarkurs / Introduktionsutbildning', config.conf_handledare)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om handledarskapet vid privat övningskörning — krav, kurs och registrering.</p>

${buildConfigRow('conf_tillstand', 'Körkortstillstånd', config.conf_tillstand)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om att ansöka om körkortstillstånd hos Transportstyrelsen — förutsättning för att börja övningsköra.</p>

${buildConfigRow('conf_policy', 'Policy / Avtal / Avbokning', config.conf_policy)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om trafikskolans regler, avbokningsvillkor, ångervrätt och kundavtal.</p>

${buildConfigRow('conf_contact', 'Kontakt & Öppettider', config.conf_contact)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om hur man når trafikskolan — adress, telefon, öppettider och kontor.</p>

${buildConfigRow('conf_booking', 'Bokning av lektion', config.conf_booking)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om att boka körlektioner, paket och tillgänglighet hos specifikt kontor.</p>

${buildConfigRow('conf_price', 'Priser & Paket', config.conf_price)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om vad lektioner, paket och kurser kostar — per kontor och körkortstyp.</p>

${buildConfigRow('conf_discount', 'Rabatter & Erbjudanden', config.conf_discount)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 20px 0;">Frågor om kampanjer, rabattkoder och eventuella prisnedsättningar.</p>

${buildConfigRow('conf_intent', 'Avsikt / Allmän förfrågan', config.conf_intent)}
<p style="font-size:11px; color:var(--text-secondary); opacity:0.55; margin:4px 0 0 0;">Används för att tolka vad kunden egentligen frågar om när frågan är vag eller otydlig.</p>
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
<div id="sysconfig-restart-notice" style="display:none;" class="admin-restart-notice">🔄 Servern startar om automatiskt inom några sekunder...</div>
<div id="sysconfig-changed-files" style="margin-top:12px;"></div>
</div>
</div>
`;
}

function buildWriteOnlyRow(fieldId, label) {
  return `
<div class="admin-config-row" id="row-${fieldId}">
<label>${label}</label>
<input
  class="admin-config-field"
  id="field-${fieldId}"
  type="password"
  value=""
  placeholder="Klistra in ny nyckel h&#228;r..."
  autocomplete="new-password"
  style="display:none;"
  disabled
>
<span id="writeonly-mask-${fieldId}"
  style="flex:1; font-size:16px; color:var(--text-secondary); opacity:0.5; letter-spacing:3px;">••••••••••••••••</span>
<button class="admin-lock-btn" id="lock-${fieldId}"
  onclick="_unlockWriteOnly('${fieldId}')">✏️ Byt nyckel</button>
<button class="config-save-btn" style="display:none;" id="save-${fieldId}"
  onclick="saveSystemConfigField('${fieldId}')" title="Spara">
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
</button>
</div>
`;
}

function _unlockWriteOnly(fieldId) {
  const field = document.getElementById(`field-${fieldId}`);
  const lockBtn = document.getElementById(`lock-${fieldId}`);
  const saveBtn = document.getElementById(`save-${fieldId}`);
  const mask = document.getElementById(`writeonly-mask-${fieldId}`);
  if (!field || !lockBtn) return;

  field.style.display = '';
  field.disabled = false;
  field.value = '';
  field.focus();
  if (mask) mask.style.display = 'none';

  lockBtn.textContent = '✕ Avbryt';
  lockBtn.classList.add('unlocked');
  if (saveBtn) saveBtn.style.display = 'inline-flex';

  lockBtn.onclick = () => {
    field.style.display = 'none';
    field.disabled = true;
    field.value = '';
    if (mask) mask.style.display = '';
    lockBtn.textContent = '✏️ Byt nyckel';
    lockBtn.classList.remove('unlocked');
    lockBtn.onclick = () => _unlockWriteOnly(fieldId);
    if (saveBtn) saveBtn.style.display = 'none';
  };
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
const mask = document.getElementById(`writeonly-mask-${fieldId}`);
field.disabled = true;
if (mask) {
  // Write-only fält (t.ex. API-nyckel) — dölj input och visa maskering igen
  field.style.display = 'none';
  field.value = '';
  mask.style.display = '';
  if (lockBtn) { lockBtn.textContent = '✏️ Byt nyckel'; lockBtn.classList.remove('unlocked'); lockBtn.onclick = () => _unlockWriteOnly(fieldId); }
} else {
  const isMasked = field.getAttribute('data-masked') === 'true';
  if (isMasked) field.value = '••••••••';
  if (lockBtn) { lockBtn.textContent = '🔒 Låst'; lockBtn.classList.remove('unlocked'); lockBtn.onclick = () => unlockConfigField(fieldId); }
}
if (saveBtn) saveBtn.style.display = 'none';

} catch (e) {
showToast('❌ Nätverksfel vid sparning.');
} finally {
if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
}
// =============================================================================
// RAG — POÄNGSÄTTNING
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
RAG (Retrieval-Augmented Generation) är det system som hämtar rätt kunskapsbitar ur databasen och skickar dem till AI:n. Varje regel nedan styr hur högt en viss typ av kunskapsbit prioriteras — högre poäng innebär att den "vinner" och skickas till AI:n om flera bitar konkurrerar.
</p>
<div style="font-size:11px; color:#ff6b6b; background:rgba(255,107,107,0.08); border:1px solid rgba(255,107,107,0.25); border-radius:6px; padding:7px 11px; margin:0 0 24px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Ändra med stor försiktighet. En regel som oavsiktligt får för högt värde kan tränga undan andra svar och ge felaktig information till kunden. Kräver omstart för att aktiveras.</span>
</div>

<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">📋 Regler</h4>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 16px 0;">
Reglerna körs i prioritetsordning. En regel med högre poäng vinner alltid över en med lägre om båda matchar samma fråga. Standardvärden är testade och rekommenderade — ändra bara om du vet vad du gör.
</p>

${buildRagRow(
  'a1_am', 'rag_score_a1_am', 'AM / Moped', 25000,
  'Prioriterar kunskapsbitar om AM-kort och mopedutbildning. Måste ligga högre än fallback-regeln nedan för att AM-frågor ska besvaras korrekt.'
)}

${buildRagRow(
  'fix_saknade', 'rag_score_fix_saknade', 'Fallback — Saknade svar', 20000,
  'Injiceras när AI:n inte hittar ett specifikt svar (intent = okänt). Håll detta värde lägre än övriga regler — annars kan den generella fallbacken tränga undan korrekta specifika svar.'
)}

${buildRagRow(
  'c8_kontakt', 'rag_score_c8_kontakt', 'Kontaktinformation', 25000,
  'Prioriterar trafikskolans kontaktuppgifter och öppettider när kunden frågar om hur man når skolan, utan att nämna en specifik stad.'
)}

${buildRagRow(
  'b1_policy', 'rag_score_b1_policy', 'Policy / Avtal / Avbokning', 50000,
  'Prioriterar policy-chunks när kunden frågar om avbokning, ångerrätt, sjukanmälan eller villkor. Satt högt för att aldrig ge fel svar vid avtalsrelaterade frågor.'
)}

${buildRagRow(
  'c7_teori', 'rag_score_c7_teori', 'Teoriappen (Mitt Körkort)', 55000,
  'Högst prioritet av alla regler. Garanterar att information om teorilärningsappen alltid visas korrekt när kunden frågar om "Mitt Körkort"-appen eller teoriinlärning.'
)}

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
// BOKNINGSLÄNKAR
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
<div id="bl-row-${key}" class="admin-config-row" style="display:grid; grid-template-columns:220px 1fr auto auto; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:0;">
<div>
  <div style="font-size:13px; color:var(--text-primary); font-weight:500; line-height:1.3;">${meta.label}
    <span style="font-size:10px; opacity:0.3; margin-left:5px; font-family:monospace; font-weight:400;">${key}</span>
  </div>
  ${meta.hint ? `<div style="font-size:11px; color:var(--text-secondary); opacity:0.5; margin-top:3px; line-height:1.4;">${meta.hint}</div>` : ''}
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
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 24px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Länkarna sparas i <code>utils/booking-links.json</code> och läses in av RAG-motorn vid uppstart. Kräver omstart av servern för att träda i kraft.</span>
</div>
<h4 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--accent-primary);">🎓 Kurskategorier</h4>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.65; margin:0 0 14px 0;">Klicka på låset vid en rad för att redigera länken. Spara när du är klar.</p>
<div style="display:grid; grid-template-columns:220px 1fr auto auto; gap:0 10px; padding:0 0 8px 0; border-bottom:1px solid rgba(255,255,255,0.12); margin-bottom:0;">
<span style="font-size:10px; text-transform:uppercase; letter-spacing:0.07em; color:var(--accent-primary); opacity:0.7;">Kurstyp</span>
<span style="font-size:10px; text-transform:uppercase; letter-spacing:0.07em; color:var(--accent-primary); opacity:0.7;">URL</span>
<span></span><span></span>
</div>
${Object.keys(LABELS).map(k => buildLinkRow(k)).join('')}
<div id="bl-notice" style="display:none; margin-top:16px;" class="admin-restart-notice">
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
  { type: 'overview',      icon: '📊', label: 'Systemöversikt',           desc: 'Totaler, AI-andel, RAG-fel, toppagenter och toppkontor' },
  { type: 'agents',        icon: '👤', label: 'Agentstatistik',            desc: 'Per agent: ärenden och hantering' },
  { type: 'rag_gaps',      icon: '🔍', label: 'Kunskapsluckor',            desc: 'Vanligaste RAG-failures' },
  { type: 'contacts',      icon: '📧', label: 'Kundkontakter',             desc: 'Sessioner med e-post / telefon' },
  { type: 'escalation',    icon: '📤', label: 'Eskaleringsmönster',        desc: 'Eskaleringstrend per månad och toppkontor' },
  { type: 'gap_plan',      icon: '🛠️', label: 'Kunskapslucke-åtgärdsplan', desc: 'AI-gruppering av luckor + förslag på nya KB-sektioner' },
  { type: 'volume_trends', icon: '📊', label: 'Kundvolym & trender',       desc: 'Ärenden per dag/vecka, toppkontor, trender' }
];

detailBox.innerHTML = `<div class="detail-body" style="padding:25px; overflow-y:auto;">
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">📊 Rapporter</h3>
<p style="margin:0 0 24px; font-size:12px; color:var(--text-secondary); opacity:0.7;">AI hämtar data ur databasen och genererar en Markdown-rapport som du kan ladda ner.</p>

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
<p style="margin:0 0 12px; font-size:12px; color:var(--text-secondary); opacity:0.65; line-height:1.6;">
  Beskriv fritt vad du vill se — AI analyserar frågan, tar fram rätt data ur databasen och skriver rapporten åt dig. Inga SQL-kunskaper krävs.
</p>
<div style="margin-bottom:12px; padding:10px 12px; border-radius:7px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); font-size:11px; color:var(--text-secondary); opacity:0.75; line-height:1.7;">
  <strong style="opacity:1; display:block; margin-bottom:5px;">Exempelfrågor du kan ställa:</strong>
  • Hur länge sedan var en agent inloggad och hur många ärenden hanterade hen förra veckan?<br>
  • Vilka 5 kontor hade flest ärenden senaste månaden?<br>
  • Hur stor andel av chattarna hanterades helt av AI vs mänsklig agent?<br>
  • Visa kunder som lämnat e-post de senaste 7 dagarna<br>
  • Fördelning av körkortstyper (B, MC, Lastbil) de senaste 30 dagarna<br>
  • Vilka RAG-failures har förekommit mer än 3 gånger senaste veckan?
</div>
<textarea id="report-custom-input"
placeholder="Skriv din fråga här... t.ex. 'Visa de 5 kontor med flest eskaleringar till mänsklig agent senaste månaden, med procentandel'"
style="width:100%; height:80px; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); color:var(--text-primary); font-size:13px; resize:vertical; box-sizing:border-box; outline:none;"></textarea>
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
throw new Error(err.details || err.error || `HTTP ${res.status}`);
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

// =============================================================================
// TRANSPORTSTYRELSEN-LÄNKAR — renderTsUrlsSection
// =============================================================================
function renderTsUrlsSection(urls, detailBox) {

const TS_LABELS = {
  TILLSTAND:       { label: 'Körkortstillstånd',                  hint: 'Villkor och ansökan om körkortstillstånd hos Transportstyrelsen.' },
  ATERKALLELSE:    { label: 'Körkortsåterkallelse & spärrtid',    hint: 'Regler kring återkallat körkort, rattfylleri och spärrtider.' },
  RISK:            { label: 'Riskutbildning (Risk 1 & Risk 2)',   hint: 'Obligatorisk Risk 1 (hal bana) och Risk 2 (landsväg).' },
  HANDLEDARE:      { label: 'Handledarskap & övningskörning',     hint: 'Krav, kurs och registrering för privat övningskörning.' },
  BE_B96:          { label: 'B96/BE-körkort (Släpvagn)',          hint: 'Utökad B-behörighet för att dra tyngre släp.' },
  YKB:             { label: 'YKB — Yrkeskompetensbevis',          hint: 'Grundutbildning och fortbildning för yrkesförare.' },
  CE:              { label: 'C/CE-körkort (Tung lastbil)',        hint: 'Behörighet för tung lastbil och fordon över 3 500 kg.' },
  MC_A:            { label: 'A/MC-körkort & behörigheter',        hint: 'A1, A2 och A-körkort för motorcykel.' },
  AM_MOPED:        { label: 'AM-körkort & mopedkörkort',          hint: 'Moped klass I och II — behörighet och ålderskrav.' },
  B:               { label: 'B-körkort (Personbil & uppkörning)', hint: 'Körprov, teoriprov och krav för vanligt bilkörkort.' },
  HALSA:           { label: 'Syn & hälsokrav för körkort',        hint: 'Medicinska krav, läkarintyg och syntest.' },
  FORNYA:          { label: 'Förnya körkortet',                   hint: 'Ansökan om förnyelse när körkortet löper ut.' },
  INTERNATIONELLT: { label: 'Internationellt & utländskt körkort',hint: 'Utbyte av utländskt körkort och internationellt körkort.' },
  ALDER:           { label: 'Ålderskrav & behörigheter',          hint: 'Lägsta ålder för olika körkortsklasser.' }
};

function buildTsRow(key) {
  const meta = TS_LABELS[key] || { label: key, hint: '' };
  const currentUrl = urls[key] || '';
  const safeUrl = currentUrl.replace(/"/g, '&quot;');
  return `
<div id="ts-row-${key}" class="admin-config-row" style="display:grid; grid-template-columns:220px 1fr auto auto; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05); margin-bottom:0;">
<div>
  <div style="font-size:13px; color:var(--text-primary); font-weight:500; line-height:1.3;">${meta.label}
    <span style="font-size:10px; opacity:0.3; margin-left:5px; font-family:monospace; font-weight:400;">${key}</span>
  </div>
  ${meta.hint ? `<div style="font-size:11px; color:var(--text-secondary); opacity:0.5; margin-top:3px; line-height:1.4;">${meta.hint}</div>` : ''}
</div>
<input type="text" id="ts-${key}" class="admin-config-field"
  value="${safeUrl}" style="min-width:0; width:100%;" disabled
  placeholder="https://www.transportstyrelsen.se/...">
<button class="admin-lock-btn" id="ts-lock-${key}" style="white-space:nowrap; flex-shrink:0;"
  onclick="unlockTsUrlField('${key}')">🔒 Låst</button>
<button class="btn-glass-small" style="display:none; flex-shrink:0;" id="ts-save-${key}"
  onclick="saveTsUrlField('${key}')">Spara</button>
</div>
`;
}

detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-body" style="padding:25px;">
<h3 style="margin:0 0 6px 0; font-size:14px; text-transform:uppercase; color:var(--accent-primary);">🏛️ Transportstyrelsen-länkar</h3>
<p style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin:0 0 10px 0;">
Dessa URL:er används av AI:n som fallback-källhänvisning när den inte hittar ett lokalt svar i kunskapsbanken. Kunden skickas vidare till rätt sida hos Transportstyrelsen beroende på vilken behörighetsfråga de ställt.
</p>
<div style="font-size:11px; color:#0a84ff; background:rgba(10,132,255,0.08); border:1px solid rgba(10,132,255,0.2); border-radius:6px; padding:7px 11px; margin:0 0 10px 0; display:flex; gap:7px; align-items:flex-start;">
<span>ℹ️</span>
<span>Länkarna sparas i <code>utils/transportstyrelsen-urls.json</code> och läses in vid serverstart. Kräver omstart av servern för att träda i kraft.</span>
</div>
<div style="font-size:11px; color:#ff9f0a; background:rgba(255,159,10,0.08); border:1px solid rgba(255,159,10,0.2); border-radius:6px; padding:7px 11px; margin:0 0 24px 0; display:flex; gap:7px; align-items:flex-start;">
<span>⚠️</span>
<span>Ändra bara om Transportstyrelsens webbplats ändrat struktur och länkarna slutat fungera. Standardlänkarna är redan korrekt inställda.</span>
</div>
<div style="display:grid; grid-template-columns:220px 1fr auto auto; gap:0 10px; padding:0 0 8px 0; border-bottom:1px solid rgba(255,255,255,0.12); margin-bottom:0;">
<span style="font-size:10px; text-transform:uppercase; letter-spacing:0.07em; color:var(--accent-primary); opacity:0.7;">Behörighet / Ämne</span>
<span style="font-size:10px; text-transform:uppercase; letter-spacing:0.07em; color:var(--accent-primary); opacity:0.7;">URL</span>
<span></span><span></span>
</div>
${Object.keys(TS_LABELS).map(k => buildTsRow(k)).join('')}
<div id="ts-notice" style="display:none; margin-top:16px;" class="admin-restart-notice">
✅ Länken sparad. Starta om servern för att aktivera i RAG-motorn.
</div>
</div>
</div>
`;
}

function unlockTsUrlField(key) {
const inp     = document.getElementById(`ts-${key}`);
const lockBtn = document.getElementById(`ts-lock-${key}`);
const saveBtn = document.getElementById(`ts-save-${key}`);
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
  lockBtn.onclick = () => unlockTsUrlField(key);
  if (saveBtn) saveBtn.style.display = 'none';
};
}

async function saveTsUrlField(key) {
const inp     = document.getElementById(`ts-${key}`);
const saveBtn = document.getElementById(`ts-save-${key}`);
const lockBtn = document.getElementById(`ts-lock-${key}`);
if (!inp) return;

const url = inp.value.trim();
if (!url || !url.startsWith('http')) {
  showToast('❌ URL måste börja med http:// eller https://');
  return;
}

if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.4'; }

try {
  const res = await fetch(`${SERVER_URL}/api/admin/ts-urls`, {
    method: 'POST',
    headers: fetchHeaders,
    body: JSON.stringify({ key, url })
  });
  const data = await res.json();
  if (!res.ok) { showToast(`❌ ${data.error || 'Serverfel'}`); return; }

  showToast(`✅ ${key} sparad`);
  const notice = document.getElementById('ts-notice');
  if (notice) notice.style.display = 'flex';

  inp.disabled = true;
  if (lockBtn) {
    lockBtn.textContent = '🔒 Låst';
    lockBtn.classList.remove('unlocked');
    lockBtn.onclick = () => unlockTsUrlField(key);
  }
  if (saveBtn) saveBtn.style.display = 'none';

} catch (e) {
  showToast('❌ Nätverksfel vid sparning.');
} finally {
  if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = ''; }
}
}