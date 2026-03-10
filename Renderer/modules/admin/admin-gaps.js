// ============================================
// modules/admin/admin-gaps.js
// VAD DEN GÖR: Admin — Kunskapsluckor
//              Visar frågor där RAG misslyckades,
//              med info om TS-fallback hjälpte.
//              Per-rad AI-analys med sektionsförslag.
// ANVÄNDS AV: admin-config.js (openSystemConfigSection 'gaps')
// ============================================

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

const hasEnoughData = rows.length >= 3;

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
<div class="admin-mini-card" id="gap-card-${r.id}"
style="--agent-color:#636366; flex-direction:column; align-items:flex-start; gap:5px; padding:10px 14px; cursor:default; margin-bottom:6px;">
<div style="display:flex; align-items:center; gap:6px; width:100%;">
${tsBadge}${freqBadge}
<span style="font-size:10px; opacity:0.4; margin-left:auto; white-space:nowrap;">${date}</span>
<button class="gap-ai-btn"
data-gapid="${r.id}"
data-query="${adminEscapeHtml(r.query || '')}"
data-ts-used="${r.ts_fallback_used || 0}"
data-ts-success="${r.ts_fallback_success || 0}"
data-ts-url="${adminEscapeHtml(r.ts_url || '')}"
title="AI-analys: varför misslyckades RAG och hur åtgärdar vi det?"
style="flex-shrink:0; margin-left:6px; padding:2px 8px; border-radius:5px;
border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05);
color:rgba(255,255,255,0.4); font-size:10px; cursor:pointer; line-height:1.7;
transition:color 0.15s, border-color 0.15s;">🤖</button>
</div>
<div style="font-size:12px; color:var(--text-primary); line-height:1.45; word-break:break-word;">${adminEscapeHtml(r.query || '')}</div>
${tsUrlShort ? `<div style="font-size:10px; opacity:0.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${adminEscapeHtml(tsUrlShort)}</div>` : ''}
<div class="gap-suggestion-panel" id="gap-suggestion-${r.id}" style="display:none; width:100%;"></div>
</div>`;
}).join('');

detailBox.innerHTML = `
<div class="detail-container" style="display:flex; flex-direction:column; height:100%;">

<!-- Header: rubrik + knappar (stängs innan statistikraden) -->
<div class="detail-header" style="padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
<span style="font-size:13px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:var(--accent-primary);">🔍 Kunskapsluckor</span>
<div style="display:flex; align-items:center; gap:4px;">
${hasEnoughData ? `
<button class="btn-glass-icon" id="btn-analyze-gaps" title="AI-analys av alla luckor" style="padding:5px 8px; margin-right:4px;">
  ${UI_ICONS.AI}
</button>` : ''}
<button class="btn-glass-icon" onclick="clearRagFailuresInDetail()" title="Rensa lista" style="padding:5px 8px;">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
</button>
</div>
</div>

<!-- Statistikrad (sybling till header, ej inuti den) -->
<div style="padding:10px 20px; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0;">
<div style="font-size:11px; color:var(--text-secondary); opacity:0.7; line-height:1.6; margin-bottom:3px;">
Frågor där RAG-motorn inte hittade svar — föll tillbaka på generiskt svar eller Transportstyrelsen.
<span style="font-size:10px; color:rgba(150,150,180,0.45); margin-left:4px;">Klicka 🤖 på ett kort för AI-förslag på KB-fix.</span>
</div>
<div style="font-size:11px; line-height:1.8;">
<span style="font-weight:700; color:var(--text-primary);">Totalt ${rows.length} misslyckanden</span>
— <span style="color:#4cd964;">${totalSolved} lösta av TS (${pct}%)</span>
— <span style="opacity:0.6;">${last7.length} senaste 7 dagarna</span>
</div>
</div>

<!-- Övergripande AI-panel (sybling, dold tills knappen trycks) -->
${hasEnoughData ? `
<div id="gaps-analysis-panel" style="display:none; padding:10px 20px;
border-bottom:1px solid rgba(0,113,227,0.15); background:rgba(0,113,227,0.06);
font-size:12px; line-height:1.65; color:var(--text-secondary); flex-shrink:0;">
<span style="font-size:10px; font-weight:600; color:#0071e3; text-transform:uppercase;
letter-spacing:0.5px; display:block; margin-bottom:5px;">AI Analys (alla luckor)</span>
<span id="gaps-analysis-text"></span>
</div>` : ''}

<!-- Scrollbar kortlista -->
<div id="gaps-card-list" style="flex:1; overflow-y:auto; padding:12px 14px;">
${cardsHtml}
</div>

</div>`;

// --- Övergripande AI-analys-knapp ---
if (hasEnoughData) {
const btnAnalyze = document.getElementById('btn-analyze-gaps');
if (btnAnalyze) {
btnAnalyze.onclick = async () => {
btnAnalyze.disabled = true;
const panel = document.getElementById('gaps-analysis-panel');
const txt = document.getElementById('gaps-analysis-text');
if (panel && txt) { panel.style.display = 'block'; txt.textContent = '🤖 Analyserar...'; }
try {
const r = await fetch(`${SERVER_URL}/api/admin/analyze-gaps`, { method: 'POST', headers: fetchHeaders });
const data = await r.json();
if (txt) txt.textContent = data.analysis || data.error || 'Inget svar.';
} catch (e) {
if (txt) txt.textContent = 'Kunde inte nå servern.';
} finally {
btnAnalyze.disabled = false;
}
};
}
}

// --- Per-rad AI-analys — event delegation på kortlistan ---
const cardList = document.getElementById('gaps-card-list');
if (cardList) {
cardList.addEventListener('click', async (e) => {

const copyBtn = e.target.closest('.gap-copy-btn');
if (copyBtn) {
const pre = copyBtn.closest('.gap-suggestion-panel')?.querySelector('pre');
if (pre) {
await navigator.clipboard.writeText(pre.textContent);
copyBtn.textContent = '✅ Kopierat!';
setTimeout(() => { copyBtn.textContent = '📋 Kopiera JSON'; }, 2000);
}
return;
}

const btn = e.target.closest('.gap-ai-btn');
if (!btn) return;

const gapId = btn.dataset.gapid;
const query = btn.dataset.query;
const tsFallbackUsed = btn.dataset.tsUsed === '1';
const tsFallbackSuccess = btn.dataset.tsSuccess === '1';
const tsUrl = btn.dataset.tsUrl;

const panel = document.getElementById(`gap-suggestion-${gapId}`);
if (!panel) return;

// Redan öppen → stäng vid nytt klick
if (panel.style.display !== 'none' && panel.dataset.loaded === '1') {
panel.style.display = 'none';
panel.dataset.loaded = '0';
return;
}

btn.disabled = true;
btn.textContent = '⏳';
panel.style.display = 'block';
panel.innerHTML = `<div style="padding:8px 0; font-size:11px; color:rgba(255,255,255,0.4);">Analyserar med AI...</div>`;

try {
const r = await fetch(`${SERVER_URL}/api/admin/analyze-gap-single`, {
method: 'POST',
headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
body: JSON.stringify({ query, ts_fallback_used: tsFallbackUsed, ts_fallback_success: tsFallbackSuccess, ts_url: tsUrl })
});
const data = await r.json();

if (data.error) {
panel.innerHTML = `<div style="padding:8px 0; font-size:11px; color:#ff6b6b;">${adminEscapeHtml(data.error)}</div>`;
} else {
const sectionJson = data.section ? JSON.stringify(data.section, null, 2) : null;
panel.innerHTML = `
<div style="margin-top:8px; padding:10px 12px; border-radius:8px;
background:rgba(0,113,227,0.07); border:1px solid rgba(0,113,227,0.18);
font-size:11px; line-height:1.65;">
<div style="font-size:10px; font-weight:600; color:#0071e3; text-transform:uppercase;
letter-spacing:0.5px; margin-bottom:7px;">🤖 AI-analys</div>
<div style="color:var(--text-secondary); margin-bottom:${data.target_file ? '10px' : '0'};">
${adminEscapeHtml(data.analysis || '')}
</div>
${data.target_file ? `
<div style="font-size:10px; color:rgba(255,255,255,0.4); margin-bottom:${sectionJson ? '6px' : '0'};">
📁 Föreslagen fil: <code style="color:#4cd964; font-size:10px;">${adminEscapeHtml(data.target_file)}</code>
</div>` : ''}
${sectionJson ? `
<pre style="background:rgba(0,0,0,0.35); border-radius:6px; padding:9px 11px;
font-size:10px; color:#a8ff78; overflow-x:auto;
white-space:pre-wrap; word-break:break-word; margin:0 0 8px 0;">${adminEscapeHtml(sectionJson)}</pre>
<button class="gap-copy-btn" style="padding:4px 12px; border-radius:5px;
border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05);
color:rgba(255,255,255,0.55); font-size:10px; cursor:pointer;">📋 Kopiera JSON</button>
` : ''}
</div>`;
panel.dataset.loaded = '1';
}
} catch (err) {
panel.innerHTML = `<div style="padding:8px 0; font-size:11px; color:#ff6b6b;">Kunde inte nå servern.</div>`;
} finally {
btn.disabled = false;
btn.textContent = '🤖';
}
});
}

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
const detailBox = document.getElementById('admin-detail-content');
renderRagFailuresInDetail(detailBox);
showToast('✅ Kunskapsluckor rensade.');
} catch (e) {
showToast('❌ Kunde inte rensa.');
}
}

// Bakåtkompatibilitet
async function renderRagFailuresList() {
const detailBox = document.getElementById('admin-detail-content');
renderRagFailuresInDetail(detailBox);
}

async function clearRagFailures() {
clearRagFailuresInDetail();
}
