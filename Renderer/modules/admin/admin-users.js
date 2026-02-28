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

// --- RENDER LISTA: AGENTER (FIXAD) ---
async function renderAdminUserList() {
const listContainer = document.getElementById('admin-main-list');
listContainer.innerHTML = '<div class="spinner-small"></div>';
try {
const res = await fetch(`${SERVER_URL}/api/admin/users`, { headers: fetchHeaders });
if (!res.ok) throw new Error(`Serverfel: ${res.status}`);
const users = await res.json();
users.sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username, 'sv'));
listContainer.innerHTML = users.map(u => {

const isAdmin = (u.role === 'support' || u.role === 'admin');
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
${u.status_text ? `<span style="font-size:10px; color:var(--accent-primary); opacity:0.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;" title="${u.status_text}">💬 ${u.status_text.substring(0, 40)}</span>` : ''}
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
// ADMIN - openAdminUserDetail (FULLSTÄNDIG- NOTES INTEGRERAD)
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
const tickets = await ticketsRes.json();
const u = users.find(user => user.username === username);

// Sparas för Ticket Reader-modalen (alla tickets — listan nedanför)
currentTicketList = tickets;
// Endast agentens egna ärenden — för stat-kortets ärendebläddare
window._agentOwnerTickets = tickets.filter(t => t.owner === username);
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
<div>
<h2 class="detail-subject">${displayTitle}</h2>
<div class="header-pills-row">${pillsHTML}</div>
</div>
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

<div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
<div class="admin-stat-card"
${window._agentOwnerTickets?.length > 0 ? `onclick="(function(){window._savedTicketList=currentTicketList;currentTicketList=window._agentOwnerTickets||[];openTicketReader(0,'${username}');})()" title="Öppna ärendebläddaren — ${u.display_name || u.username}s egna ärenden"` : ''}
style="${window._agentOwnerTickets?.length > 0 ? 'cursor:pointer;' : ''}"
onmouseover="${window._agentOwnerTickets?.length > 0 ? `this.style.borderColor='${styles.main}66'; this.style.background='${styles.main}08'` : ''}"
onmouseout="${window._agentOwnerTickets?.length > 0 ? `this.style.borderColor=''; this.style.background=''` : ''}">
<div style="font-size:38px; font-weight:800; color:${styles.main}; line-height:1;">${stats.active || 0}</div>
<div style="font-size:11px; opacity:0.5; text-transform:uppercase; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:5px;">
AKTIVA ÄRENDEN
${window._agentOwnerTickets?.length > 0 ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${styles.main}" stroke-width="2" opacity="0.6"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>` : ''}
</div>
</div>

<div class="glass-panel" style="padding:15px; border-radius:12px; border:1px solid var(--border-color); background:rgba(255,255,255,0.02);">
<h4 style="margin:0 0 12px 0; font-size:10px; opacity:0.5; text-transform:uppercase;">Kontorsbehörighet</h4>
<div style="display:flex; flex-wrap:wrap; gap:6px; overflow-y:auto; max-height:100px;">
${offices.map(o => {
const isAssigned = u.routing_tag && u.routing_tag.includes(o.routing_tag);
const displayName = o.city + (o.area ? ' / ' + o.area : '');
const bg = isAssigned ? 'rgba(100,60,200,0.25)' : 'rgba(255,255,255,0.04)';
const border = isAssigned ? 'rgba(150,100,255,0.5)' : 'rgba(255,255,255,0.06)';
const color = isAssigned ? '#b09fff' : 'inherit';
return `
<label style="display:flex; align-items:center; gap:6px; font-size:11px;
padding:5px 10px; border-radius:6px; ${readOnly ? 'cursor:default;' : 'cursor:pointer;'}
background:${bg}; border:1px solid ${border}; color:${color};">
<input type="checkbox" ${isAssigned ? 'checked' : ''}
${readOnly ? 'disabled' : `onchange="updateAgentOfficeRole('${u.username}', '${o.routing_tag}', this.checked, this)"`}>
${adminEscapeHtml(displayName)}
</label>`;
}).join('')}
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
<div class="atp-sender">${t.sender || 'Okänd kund'}</div>
<div class="atp-subject">${t.subject || 'Inget ämne'}</div>
</div>
<button class="atp-note-btn" 
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
} catch (e) {
console.error("Admin Agent Detail Error:", e);
detailBox.innerHTML = '<div class="template-item-empty" style="color:#ff453a;">Kunde inte ladda agentprofilen.</div>';
}
}
