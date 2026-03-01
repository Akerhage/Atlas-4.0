// ============================================
// modules/admin/admin-gaps.js
// VAD DEN GÖR: Admin — Kunskapsluckor
//              Visar frågor där RAG misslyckades,
//              med info om TS-fallback hjälpte.
// ANVÄNDS AV: admin-core.js (switchAdminTab 'gaps')
// ============================================

async function renderRagFailuresList() {
const listContainer = document.getElementById('admin-main-list');
const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!listContainer) return;

listContainer.innerHTML = '<div class="spinner-small"></div>';
if (placeholder) placeholder.style.display = 'flex';
if (detailBox) detailBox.style.display = 'none';

try {
const res = await fetch(`${SERVER_URL}/api/admin/rag-failures`, { headers: fetchHeaders });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const rows = await res.json();

if (!rows.length) {
listContainer.innerHTML = '<div style="padding:30px 20px; text-align:center; opacity:0.5; font-size:13px; line-height:1.6;">Inga misslyckanden registrerade ännu.<br><span style="font-size:11px;">Misslyckanden loggas automatiskt när AI inte hittar svar.</span></div>';
return;
}

// --- Sammanfattningsstatistik ---
const now = Math.floor(Date.now() / 1000);
const sevenDaysAgo = now - (7 * 24 * 3600);
const last7 = rows.filter(r => r.created_at >= sevenDaysAgo);
const totalSolved = rows.filter(r => r.ts_fallback_success === 1).length;
const pct = rows.length > 0 ? Math.round((totalSolved / rows.length) * 100) : 0;

const summaryHtml = `
<div style="padding:12px 14px 10px 14px; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.06); font-size:11px; color:var(--text-secondary); line-height:1.7;">
<span style="font-weight:700; color:var(--text-primary);">Totalt ${rows.length} misslyckanden</span>
— <span style="color:#4cd964;">${totalSolved} lösta av TS (${pct}%)</span>
— <span style="opacity:0.6;">${last7.length} senaste 7 dagarna</span>
</div>`;

// --- Räkna upprepningar ---
const queryCount = {};
rows.forEach(r => {
const key = (r.query || '').toLowerCase().trim();
queryCount[key] = (queryCount[key] || 0) + 1;
});

// --- Rendrera kort ---
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
<div class="admin-mini-card" style="--agent-color:#636366; flex-direction:column; align-items:flex-start; gap:5px; padding:10px 14px; cursor:default;">
<div style="display:flex; align-items:center; gap:6px; width:100%;">
${tsBadge}${freqBadge}
<span style="font-size:10px; opacity:0.4; margin-left:auto; white-space:nowrap;">${date}</span>
</div>
<div style="font-size:12px; color:var(--text-primary); line-height:1.45; word-break:break-word;">${adminEscapeHtml(r.query || '')}</div>
${tsUrlShort ? `<div style="font-size:10px; opacity:0.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${adminEscapeHtml(tsUrlShort)}</div>` : ''}
</div>`;
}).join('');

listContainer.innerHTML = summaryHtml + cardsHtml;

} catch (e) {
console.error('[admin-gaps] Fel:', e);
listContainer.innerHTML = '<div style="padding:20px; color:#ff6b6b; font-size:12px;">Kunde inte hämta data.</div>';
}
}

async function clearRagFailures() {
const ok = await atlasConfirm('Rensa Kunskapsluckor', 'Ta bort alla registrerade RAG-misslyckanden?');
if (!ok) return;
try {
const res = await fetch(`${SERVER_URL}/api/admin/rag-failures`, {
method: 'DELETE',
headers: fetchHeaders
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
renderRagFailuresList();
showToast('✅ Kunskapsluckor rensade.');
} catch (e) {
showToast('❌ Kunde inte rensa.');
}
}
