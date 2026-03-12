// ============================================
// modules/admin/admin-users.js
// VAD DEN GÖR: Admin — användarlista och
//              användardetaljer
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   SERVER_URL, fetchHeaders, currentUser,         — renderer.js globals
//   usersCache, window._adminFormDirty             — renderer.js globals
//   ADMIN_UI_ICONS, UI_ICONS                       — ui-constants.js
//   getAgentStyles, formatName, showToast          — styling-utils.js
//   atlasConfirm, atlasPrompt                      — renderer.js
//   openNotesModal, loadNotes                      — notes-system.js
// ============================================

// --- RENDER LISTA: AGENTER ---
async function renderAdminUserList() {
const listContainer = document.getElementById('admin-main-list');
listContainer.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/users`, { headers: fetchHeaders });
if (!res.ok) throw new Error(`Serverfel: ${res.status}`);
const users = await res.json();
users.sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username, 'sv'));
listContainer.innerHTML = users.map(u => {

const isAdmin = (u.role === 'admin');
const agentColor = u.agent_color || '#0071e3';
const displayName = u.display_name || formatName(u.username);

return `
<div class="admin-mini-card" onclick="openAdminUserDetail('${u.username}', this)" 
style="--agent-color: ${agentColor}; position: relative;">
<div style="width:32px; height:32px; position:relative; flex-shrink:0;">
${getAvatarBubbleHTML(u, "100%")}
${u.is_online ? '<div style="position:absolute; bottom:0; right:0; width:8px; height:8px; border-radius:50%; background:#4cd964; box-shadow:0 0 5px #4cd964; border:1px solid #1e1e1e; z-index:1;"></div>' : ''}
</div>
<div style="flex: 1; overflow: hidden; padding-left: 6px;">
<div style="display:flex; align-items:center; gap:6px;">
<span style="font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
${u.status_text ? `<span style="font-size:10px; color:var(--accent-primary); opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; text-align:right;" title="${u.status_text}">💬 ${u.status_text.substring(0, 40)}</span>` : ''}
</div>
<div style="font-size:10px; color:var(--text-secondary); opacity:0.7;">
${isAdmin ? '★ ADMIN' : 'AGENT'} • @${u.username}
</div>
</div>
</div>`;
}).join('');
} catch (e) {
console.error("User List Error:", e);
listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#ff6b6b; font-size:12px;">Kunde inte hämta agenter.<br>Kontrollera din inloggning.</div>';
}
}

// =============================================================================
// ADMIN - openAdminUserDetail
// =============================================================================
async function openAdminUserDetail(username, element) {
if (window._adminFormDirty) {
const ok = await atlasConfirm('Osparade ändringar', 'Du har ändringar som inte sparats. Navigera bort?');
if (!ok) return;
window._adminFormDirty = false;
}
if(element) {
document.querySelectorAll('.admin-mini-card').forEach(c => c.classList.remove('active'));
element.classList.add('active');
}

const detailBox = document.getElementById('admin-detail-content');
const placeholder = document.getElementById('admin-placeholder');
if (!detailBox || !placeholder) return;

placeholder.style.display = 'none';
detailBox.style.display = 'flex';
detailBox.innerHTML = '<div class="spinner-small"></div>';
detailBox.setAttribute('data-current-id', username); // Säkrar system-städning

try {
// 1. Hämta all data parallellt
const [userRes, officesRes, statsRes, ticketsRes] = await Promise.all([
fetch(`${SERVER_URL}/api/admin/users`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/public/offices`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/user-stats/${username}`, { headers: fetchHeaders }),
fetch(`${SERVER_URL}/api/admin/agent-tickets/${username}`, { headers: fetchHeaders })
]);

const users = await userRes.json();
const offices = await officesRes.json();
const stats = await statsRes.json();
const ticketsRaw = await ticketsRes.json();

// Guard: om endpointen returnerar 403/fel-objekt → använd tom array
const tickets = Array.isArray(ticketsRaw) ? ticketsRaw : [];

const u = users.find(user => user.username === username);

// Sparas för Ticket Reader-modalen (alla tickets — listan nedanför)
currentTicketList = tickets;
// Tilldelade ärenden (owner = username) — för ärendebläddaren i stat-kortet
window._agentOwnerTickets = tickets.filter(t => t.is_assigned === 1 || t.owner === username);
// Kontors-ärenden via routing_tag (ej direkt tilldelade)
window._agentRoutingTickets = tickets.filter(t => t.is_assigned === 0 && t.owner !== username);
const styles = getAgentStyles(username);
const readOnly = !isSupportAgent(); // Agent ser i läsläge

// --- ADMIN ACTIONS (HEADERN) ---
const actionsHTML = readOnly ? `
<button id="agent-detail-notes-btn" class="notes-trigger-btn footer-icon-btn"
data-id="agent_${u.username}"
onclick="openNotesModal('agent_${u.username}')"
style="color:${styles.main}"
title="Interna anteckningar om agenten">
${UI_ICONS.NOTES}
</button>
` : `
<button id="agent-detail-notes-btn" class="notes-trigger-btn footer-icon-btn"
data-id="agent_${u.username}"
onclick="openNotesModal('agent_${u.username}')"
style="color:${styles.main}"
title="Interna anteckningar om agenten">
${UI_ICONS.NOTES}
</button>

<button id="agent-detail-edit-btn" class="footer-icon-btn" 
onclick='openNewAgentForm(${JSON.stringify(u)})' 
title="Redigera profil" 
style="color:${styles.main}">
${ADMIN_UI_ICONS.EDIT}
</button>

<button class="footer-icon-btn danger"
onclick="deleteUser('${u.id}', '${u.username}')"
title="Radera användare"
style="color:#ff453a; border:none; background:transparent;">
${UI_ICONS.TRASH}
</button>
`;

// --- TITEL & PILLS ---
const displayTitle = u.display_name || u.username;
const pillsHTML = `
<div class="pill" style="border-color:${styles.main}; color:${styles.main}; font-weight:800;">${u.role.toUpperCase()}</div>
<div class="pill" style="color:${styles.main}bb; border-color:${styles.main}35;">@${u.username}</div>
${readOnly ? '<div class="pill">👁️ Läsläge</div>' : ''}
`;

// --- RENDERARE
detailBox.innerHTML = `
<div class="detail-container">
<div class="detail-header-top" style="border-bottom: 2px solid ${styles.main}; background: linear-gradient(90deg, ${styles.bg}, transparent);">
<div style="display:flex; align-items:center; gap:15px;">
<div class="msg-avatar" style="width:60px; height:60px; border: 3px solid ${styles.main}; font-size:24px;">
${getAvatarBubbleHTML(u, "100%")}
</div>
<div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
<h2 class="detail-subject" style="font-size:20px; font-weight:800; margin:0;">${displayTitle}</h2>
<div class="header-pills-row" style="justify-content:flex-start;">${pillsHTML}</div>
</div>
</div>

<div style="flex:1; display:flex; justify-content:center; align-items:center;">
${tickets.length > 0 ? `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;" onclick="openTicketReader(0,'${username}')" title="Öppna ärendebläddaren"><span style="background:rgba(255,255,255,0.05);border:1px solid ${styles.main}55;border-radius:20px;padding:4px 14px;font-size:10px;color:${styles.main};white-space:nowrap;display:inline-flex;align-items:center;gap:5px;">🔥 ${tickets.length} Aktiva ärenden</span><div style="font-size:9px;opacity:0.65;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">${window._agentOwnerTickets?.length > 0 ? `<span style="color:${styles.main}99;">${window._agentOwnerTickets.length} tilldelade</span>` : ''}${window._agentRoutingTickets?.length > 0 ? `<span>+${window._agentRoutingTickets.length} via kontor</span>` : ''}</div></div>` : `<span style="font-size:10px; opacity:0.25;">Inga aktiva ärenden</span>`}
</div>

<div class="detail-footer-toolbar" style="background:transparent; border:none; padding:0; gap:10px;">
<div style="margin-right:15px; text-align:right;">
<div style="font-size:9px; opacity:0.5; color:var(--text-secondary);">PROFILFÄRG</div>
<input type="color" value="${styles.main}" 
${readOnly ? 
'disabled style="width:28px; height:28px; pointer-events:none; opacity:0.4; background:none; border:none;"' : 
`oninput="(function(c){const h=document.querySelector('#admin-detail-content .detail-header-top');if(h){h.style.borderBottomColor=c;h.style.background='linear-gradient(90deg,'+c+'22,transparent)';}const a=document.querySelector('#admin-detail-content .msg-avatar');if(a){a.style.borderColor=c;const ua=a.querySelector('.user-avatar');if(ua)ua.style.borderColor=c;const ai=a.querySelector('.avatar-inner-icon');if(ai)ai.style.color=c;}const pills=document.querySelectorAll('#admin-detail-content .header-pills-row .pill');pills.forEach(p=>{p.style.borderColor=c+'66';p.style.color=c;});const stat=document.querySelector('#admin-detail-content .admin-stat-card');if(stat){stat.style.borderColor=c+'44';const num=stat.querySelector('div[style*=font-size]');if(num)num.style.color=c;}document.querySelectorAll('#admin-detail-content .admin-ticket-preview').forEach(tp=>{tp.style.setProperty('--atp-color',c);tp.style.borderLeftColor=c;});const title=document.querySelector('#admin-detail-content .detail-subject');if(title)title.style.color=c;const mc=document.querySelector('#admin-main-list .admin-mini-card.active');if(mc){mc.style.setProperty('--agent-color',c);const mua=mc.querySelector('.user-avatar');if(mua)mua.style.borderColor=c;const mai=mc.querySelector('.avatar-inner-icon');if(mai)mai.style.color=c;const mcSpan=mc.querySelector('span[style*=font-weight]');if(mcSpan)mcSpan.style.color=c;}clearTimeout(window._agentColorTimer);window._agentColorTimer=setTimeout(()=>updateAgentColor('${u.username}',c),700);})(this.value)" style="width:28px; height:28px; cursor:pointer; background:none; border:none;"`
}>
</div>
${actionsHTML}
</div>
</div>

<div class="detail-body" style="padding:25px; display:flex; flex-direction:column; gap:20px; overflow-y:auto; flex:1; min-height:0;">

<div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">

<div style="display:flex; flex-direction:column; gap:6px;">
<h4 style="margin:0; font-size:10px; opacity:0.5; text-transform:uppercase;">Kontorsbehörighet</h4>
<div class="glass-panel" style="padding:15px; border-radius:12px; border:1px solid var(--border-color); background:rgba(255,255,255,0.02); flex:1; display:flex; flex-direction:column;">
<div style="display:flex; flex-direction:column; gap:4px; overflow-y:auto; max-height:160px;">
${(() => {
const byCity = {};
offices.forEach(o => { if (!byCity[o.city]) byCity[o.city] = []; byCity[o.city].push(o); });
const entries = Object.entries(byCity).sort((a,b) => {
  const am = a[1].length > 1, bm = b[1].length > 1;
  if (am && !bm) return -1; if (!am && bm) return 1;
  return a[0].localeCompare(b[0], 'sv');
});
const cbHide = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;';
const pillStyle = (bg,bd,cl,ro) => `display:inline-flex;align-items:center;justify-content:center;font-size:10px;padding:4px 8px;border-radius:20px;white-space:nowrap;margin:2px 0;${ro?'cursor:default;':'cursor:pointer;'}background:${bg};border:1px solid ${bd};color:${cl};`;
const groups = entries.filter(([,cos]) => cos.length > 1);
const singles = entries.filter(([,cos]) => cos.length === 1);
let html = '';

// Rad 1: gruppchhips alltid överst — flex OK här, buttons blockifieras inte
if (groups.length) {
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:flex-start;">';
  groups.forEach(([city, cos]) => {
    const ac = cos.filter(o => u.routing_tag && u.routing_tag.includes(o.routing_tag)).length;
    const gid = 'cg_' + city.toLowerCase().replace(/[^a-z0-9]/g,'');
    const bid = gid+'_btn', cid = gid+'_ch', kid = gid+'_ct';
    const bg = ac > 0 ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
    const bd = ac > 0 ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
    const cl = ac > 0 ? '#b09fff' : 'inherit';
    const oc = readOnly ? '' : `onclick="(function(){const g=document.getElementById('${gid}');const ch=document.getElementById('${cid}');const open=g.style.display!=='none'&&g.style.display!=='';if(open){g.style.display='none';ch.style.transform='';}else{g.style.display='block';ch.style.transform='rotate(90deg)';}})();"`;
    html += `<button id="${bid}" type="button" ${oc} style="${pillStyle(bg,bd,cl,readOnly)}outline:none;"><span id="${cid}" style="font-size:7px;display:inline-block;transition:transform 0.15s;opacity:0.5;">▶</span>${adminEscapeHtml(city)}<span id="${kid}" style="opacity:0.5;font-size:9px;">&nbsp;(${ac}/${cos.length})</span></button>`;
  });
  html += '</div>';
}

// Sub-paneler per grupp — display:block så labels är äkta inline-flex
groups.forEach(([city, cos]) => {
  const gid = 'cg_' + city.toLowerCase().replace(/[^a-z0-9]/g,'');
  const bid = gid+'_btn', kid = gid+'_ct';
  const subUpdate = `(function(){const g=document.getElementById('${gid}');const ct=document.getElementById('${kid}');const btn=document.getElementById('${bid}');if(!ct||!g||!btn)return;const n=g.querySelectorAll('input:checked').length;ct.textContent=' ('+n+'/${cos.length})';const s=n>0;btn.style.background=s?'rgba(100,60,200,0.25)':'rgba(255,255,255,0.04)';btn.style.borderColor=s?'rgba(150,100,255,0.5)':'rgba(255,255,255,0.06)';btn.style.color=s?'#b09fff':'inherit';})()`;
  const pills = cos.map(o => {
    const ia = u.routing_tag && u.routing_tag.includes(o.routing_tag);
    const pbg = ia ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
    const pbd = ia ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
    const pcl = ia ? '#b09fff' : 'inherit';
    return `<label style="${pillStyle(pbg,pbd,pcl,readOnly)}margin-right:4px;"><input type="checkbox" style="${cbHide}" data-rt="${o.routing_tag}" ${ia?'checked':''} ${readOnly?'disabled':`onchange="updateAgentOfficeRole('${u.username}','${o.routing_tag}',this.checked,this,'${adminEscapeHtml(u.display_name||u.username)}');${subUpdate};"`}>${adminEscapeHtml(o.area||o.city)}</label>`;
  }).join('');
  html += `<div id="${gid}" style="display:none;padding:3px 0 1px 8px;border-left:1px solid rgba(100,60,200,0.25);">${pills}</div>`;
});

// Rad 2: enkontor-städer — display:block så labels är äkta inline-flex
if (singles.length) {
  html += '<div style="display:block;padding-top:2px;">';
  singles.forEach(([,cos]) => {
    const o = cos[0];
    const ia = u.routing_tag && u.routing_tag.includes(o.routing_tag);
    const dn = o.city + (o.area ? ' / ' + o.area : '');
    const bg = ia ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
    const bd = ia ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
    const cl = ia ? '#b09fff' : 'inherit';
    html += `<label style="${pillStyle(bg,bd,cl,readOnly)}margin-right:4px;"><input type="checkbox" style="${cbHide}" ${ia?'checked':''} ${readOnly?'disabled':`onchange="updateAgentOfficeRole('${u.username}','${o.routing_tag}',this.checked,this,'${adminEscapeHtml(u.display_name||u.username)}')"}`}>${adminEscapeHtml(dn)}</label>`;
  });
  html += '</div>';
}
return html;
})()}
</div>
</div>
</div>

<div style="display:flex; flex-direction:column; gap:6px;">
<h4 style="margin:0; font-size:10px; opacity:0.5; text-transform:uppercase;">Vybehörighet</h4>
<div class="glass-panel" style="padding:15px; border-radius:12px; border:1px solid rgba(255,160,50,0.2); background:rgba(255,140,0,0.03); flex:1; display:flex; flex-direction:column;">
<div style="display:block;">
${
u.role === 'admin'
  ? `<span style="font-size:10px;opacity:0.45;font-style:italic;">&#128274; Admin har alltid full åtkomst till alla vyer och kan inte begränsas.</span>`
  : (() => {
const _parsed = u.allowed_views ? JSON.parse(u.allowed_views) : null;
const navViews = [
  { view: 'my-tickets', label: 'Mina ärenden' },
  ...(u.role === 'admin' ? [{ view: 'inbox', label: 'Inkorgen' }] : []),
  { view: 'archive',    label: 'Garaget' },
  { view: 'customers',  label: 'Kunder' },
  { view: 'templates',  label: 'Mailmallar' },
  { view: 'about',      label: 'Om' }
];
const adminTabs = [
  { view: 'admin-users',   label: 'Agenter' },
  { view: 'admin-offices', label: 'Kontor' },
  { view: 'admin-config',  label: 'Systemkonfig' }
];
const renderPill = (opt, isAdminTab) => {
  let isAllowed;
  if (isAdminTab) {
    const hasAnyAdminKey = _parsed && ['admin-users','admin-offices','admin-config'].some(k => _parsed.includes(k));
    isAllowed = !_parsed || !hasAnyAdminKey || _parsed.includes(opt.view);
  } else {
    isAllowed = _parsed === null || _parsed.includes(opt.view);
  }
  const bg     = isAllowed ? 'rgba(200,120,30,0.25)' : 'rgba(255,255,255,0.04)';
  const border = isAllowed ? 'rgba(255,160,50,0.5)'  : 'rgba(255,255,255,0.06)';
  const color  = isAllowed ? '#ffaa44'               : 'inherit';
  return `<label style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;padding:4px 8px;border-radius:20px;white-space:nowrap;margin:0 4px 4px 0;${readOnly?'cursor:default;':'cursor:pointer;'}background:${bg};border:1px solid ${border};color:${color};"><input type="checkbox" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0;" data-view-key="${opt.view}" ${isAllowed ? 'checked' : ''} ${readOnly ? 'disabled' : `onchange="(function(cb){const l=cb.closest('label');const on=cb.checked;l.style.background=on?'rgba(200,120,30,0.25)':'rgba(255,255,255,0.04)';l.style.borderColor=on?'rgba(255,160,50,0.5)':'rgba(255,255,255,0.06)';l.style.color=on?'#ffaa44':'inherit';saveUserViews('${u.username}','${opt.view}',cb.checked,'${adminEscapeHtml(u.display_name||u.username)}');})(this)"`}>${opt.label}</label>`;
};
return `<div style="font-size:8px;opacity:0.3;margin:0 0 3px 0;text-transform:uppercase;letter-spacing:0.06em;width:100%;">Sidomenyn vyer</div>` +
  navViews.map(o => renderPill(o, false)).join('') +
  `<div style="font-size:8px;opacity:0.3;margin:4px 0 3px 0;text-transform:uppercase;letter-spacing:0.06em;width:100%;">Admin-flikar</div>` +
  adminTabs.map(o => renderPill(o, true)).join('');
})()
}
</div>
</div>
</div>

</div>

<div style="flex:1; display:flex; flex-direction:column; min-height:0;">
<h4 style="margin:0 0 12px 0; font-size:10px; opacity:0.5; text-transform:uppercase;">Pågående ärenden för agent</h4>
<div class="scroll-list" style="background:rgba(0,0,0,0.1); border-radius:12px; padding:10px; border:1px solid var(--border-color);">
${tickets.length ? tickets.map((t, idx) => `
<div class="admin-ticket-preview" onclick="openTicketReader(${idx}, '${username}')"
style="border-left: 3px solid ${styles.main} !important; --atp-color: ${styles.main} !important;">
<div style="flex:1; min-width:0;">
<div class="atp-sender">${t.contact_name || t.sender || 'Okänd kund'}</div>
<div class="atp-subject">${t.preview || t.last_message || t.question || t.subject || 'Inget ämne'}</div>
</div>
<button class="atp-note-btn notes-trigger-btn"
data-id="${t.conversation_id || t.id}"
onclick="event.stopPropagation(); openNotesModal('${t.conversation_id || t.id}')"
title="Intern anteckning">
${UI_ICONS.NOTES}
</button>
</div>
`).join('') : '<div class="template-item-empty">Inga aktiva ärenden.</div>'}
</div>
</div>
</div>
</div>`;

detailBox.querySelectorAll('.atp-note-btn').forEach(btn => {
btn.style.setProperty('color', 'var(--atp-color, #0071e3)', 'important');
});
// Lysa upp notes-ikonen för agenten och deras ärendekort
if (typeof refreshNotesGlow === 'function') {
  refreshNotesGlow('agent_' + u.username);
  tickets.forEach(t => { if (t.conversation_id) refreshNotesGlow(t.conversation_id); });
}
} catch (e) {
console.error("Admin Agent Detail Error:", e);
detailBox.innerHTML = '<div class="template-item-empty" style="color:#ff453a;">Kunde inte ladda agentprofilen.</div>';
}
}