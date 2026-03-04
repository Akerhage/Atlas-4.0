// ============================================
// modules/admin/admin-gaps.js
// VAD DEN GÖR: Admin — Kunskapsluckor
//              Visar frågor där RAG misslyckades,
//              med info om TS-fallback hjälpte.
// ANVÄNDS AV: admin-config.js (openSystemConfigSection 'gaps')
// ============================================

// Renderar Kunskapsluckor inuti detail-panelen (anropas från admin-config.js)
async function renderRagFailuresInDetail(detailBox) {
if (!detailBox) return;
detailBox.style.display = 'flex';
detailBox.innerHTML = '<div class="spinner-small"></div>';

try {
const res = await fetch(`${SERVER_URL}/api/admin/rag-failures`, { headers: fetchHeaders });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const rows = await res.json();

if (!rows.length) {
detailBox.innerHTML = `
<div class="detail-container" style="display:flex; flex-direction:column; height:100%;">
<div class="detail-header" style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; justify-content:space-between;">
<span style="font-size:13px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:var(--accent-primary);">🔍 Kunskapsluckor</span>
</div>
<div style="flex:1; display:flex; align-items:center; justify-content:center; opacity:0.5; font-size:13px; text-align:center; line-height:1.6; padding:40px;">
Inga misslyckanden registrerade ännu.<br><span style="font-size:11px;">Misslyckanden loggas automatiskt när AI inte hittar svar.</span>
</div>
</div>`;
return;
}

// Statistik
const now = Math.floor(Date.now() / 1000);
const sevenDaysAgo = now - (7 * 24 * 3600);
const last7 = rows.filter(r => r.created_at >= sevenDaysAgo);
const totalSolved = rows.filter(r => r.ts_fallback_success === 1).length;
const pct = rows.length > 0 ? Math.round((totalSolved / rows.length) * 100) : 0;

// Räkna upprepningar
const queryCount = {};
rows.forEach(r => {
const key = (r.query || '').toLowerCase().trim();
queryCount[key] = (queryCount[key] || 0) + 1;
});

const cardsHtml = rows.map(r => {
const freq = queryCount[(r.query || '').toLowerCase().trim()] || 1;
const date = new Date(r.created_at * 1000).toLocaleDateString('sv-SE', {
month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
});

const tsBadge = r.ts_fallback_success
? `<span style="font-size:10px; color:#4cd964; background:rgba(76,217,100,0.12); border:1px solid rgba(76,217,100,0.3); border-radius:4px; padding:1px 6px;">TS ✓</span>`
: r.ts_fallback_used
? `<span style="font-size:10px; color:#ff9f0a; background:rgba(255,159,10,0.12); border:1px solid rgba(255,159,10,0.3); border-radius:4px; padding:1px 6px;">TS ✗</span>`
: `<span style="font-size:10px; color:#636366; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:1px 6px;">RAG</span>`;

const freqBadge = freq > 1
? `<span style="font-size:10px; color:#0071e3; background:rgba(0,113,227,0.12); border:1px solid rgba(0,113,227,0.3); border-radius:4px; padding:1px 6px;">${freq}×</span>`
: '';

const tsUrlShort = r.ts_url
? r.ts_url.replace('https://www.transportstyrelsen.se/sv/vagtrafik/korkort/', 'TS: ').replace(/\/$/, '')
: null;

return `
<div class="admin-mini-card" style="--agent-color:#636366; flex-direction:column; align-items:flex-start; gap:5px; padding:10px 14px; cursor:default; margin-bottom:6px;">
<div style="display:flex; align-items:center; gap:6px; width:100%;">
${tsBadge}${freqBadge}
<span style="font-size:10px; opacity:0.4; margin-left:auto; white-space:nowrap;">${date}</span>
</div>
<div style="font-size:12px; color:var(--text-primary); line-height:1.45; word-break:break-word;">${adminEscapeHtml(r.query || '')}</div>
${tsUrlShort ? `<div style="font-size:10px; opacity:0.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${adminEscapeHtml(tsUrlShort)}</div>` : ''}
</div>`;
}).join('');

detailBox.innerHTML = `
<div class="detail-container" style="display:flex; flex-direction:column; height:100%;">
<div class="detail-header" style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
<span style="font-size:13px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:var(--accent-primary);">🔍 Kunskapsluckor</span>
<button class="btn-glass-icon" onclick="clearRagFailuresInDetail()" title="Rensa lista" style="padding:5px 8px;">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
</button>
</div>
<div style="padding:12px 14px 8px 14px; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.06); font-size:11px; color:var(--text-secondary); line-height:1.7; flex-shrink:0;">
<div style="font-size:12px; color:var(--text-secondary); opacity:0.7; margin-bottom:6px; line-height:1.5;">
Frågor där RAG-motorn inte hittade ett tillräckligt bra svar och föll tillbaka på generiskt svar eller Transportstyrelsens webbplats (TS). Används för att identifiera ämnen som saknas eller behöver förbättras i kunskapsbanken.
<span style="display:inline-block; margin-left:4px; font-size:10px; color:rgba(150,150,180,0.5);">Påverkar inte systemets funktion. Listan kan rensas manuellt.</span>
</div>
<span style="font-weight:700; color:var(--text-primary);">Totalt ${rows.length} misslyckanden</span>
— <span style="color:#4cd964;">${totalSolved} lösta av TS (${pct}%)</span>
— <span style="opacity:0.6;">${last7.length} senaste 7 dagarna</span>
</div>
<div style="flex:1; overflow-y:auto; padding:12px 14px;">
${cardsHtml}
</div>
</div>`;

} catch (e) {
console.error('[admin-gaps] Fel:', e);
detailBox.innerHTML = '<div style="padding:20px; color:#ff6b6b; font-size:12px;">Kunde inte hämta data.</div>';
}
}

// Rensa-knapp anropad inifrån detailBox
async function clearRagFailuresInDetail() {
const ok = await atlasConfirm('Rensa Kunskapsluckor', 'Ta bort alla registrerade RAG-misslyckanden?');
if (!ok) return;
try {
const res = await fetch(`${SERVER_URL}/api/admin/rag-failures`, {
method: 'DELETE',
headers: fetchHeaders
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
// Hitta aktiv detailBox och rendera om
const detailBox = document.getElementById('admin-detail-content');
renderRagFailuresInDetail(detailBox);
showToast('✅ Kunskapsluckor rensade.');
} catch (e) {
showToast('❌ Kunde inte rensa.');
}
}

// Bakåtkompatibilitet — anropades tidigare direkt från switchAdminTab('gaps')
async function renderRagFailuresList() {
const detailBox = document.getElementById('admin-detail-content');
renderRagFailuresInDetail(detailBox);
}

async function clearRagFailures() {
clearRagFailuresInDetail();
}