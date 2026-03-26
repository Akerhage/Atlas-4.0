// ============================================
// modules/admin/admin-core.js
// VAD DEN GÖR: Admin — master tab-hanterare
//              och HTML-escape-hjälpare
// ANVÄNDS AV: renderer.js
// ============================================
// Beroenden (löses vid anropstid):
//   atlasConfirm, isSupportAgent, currentUser   — renderer.js globals
//   renderAdminUserList                          — admin-users.js
//   renderAdminOfficeList                        — admin-offices.js
//   renderSystemConfigNav                        — admin-config.js
//   renderAdminAbout                             — admin-audit.js
//   openNewAgentForm, openNewOfficeForm          — admin-forms.js
// ============================================

// --- MASTER TAB-HANTERARE ---
window.switchAdminTab = async (tab) => {
if (window._adminFormDirty) {
const ok = await atlasConfirm('Osparade ändringar', 'Du har ändringar som inte sparats. Navigera bort?');
if (!ok) return;
window._adminFormDirty = false;
}

// ===== BEHÖRIGHETSKONTROLL =====
if (!currentUser) {
const list = document.getElementById('admin-main-list');
const listTitle = document.getElementById('admin-list-title');
if (listTitle) listTitle.innerText = '';
if (list) list.innerHTML = `<div style="padding:30px 20px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; color:#ff6b6b; font-size:13px;"><div style="font-size:32px; margin-bottom:4px;">🔒</div><strong>Behörighet saknas</strong><div style="opacity:0.7; max-width:200px; line-height:1.5;">Denna panel kräver inloggning.</div></div>`;
document.getElementById('admin-placeholder').style.display = 'none';
document.getElementById('admin-detail-content').style.display = 'none';
return;
}

// UI-feedback för flikar (säker selektion utan globalt event-objekt)
document.querySelectorAll('#view-admin .header-tab').forEach(t => t.classList.remove('active'));
const tabBtn = document.querySelector(`#view-admin .header-tab[onclick*="'${tab}'"]`);
if (tabBtn) tabBtn.classList.add('active');

// Återställ högerpanelen till placeholder
document.getElementById('admin-placeholder').style.display = 'flex';
document.getElementById('admin-detail-content').style.display = 'none';

const listTitle = document.getElementById('admin-list-title');
const actionContainer = document.getElementById('admin-list-actions');
actionContainer.innerHTML = '';

if (tab === 'users') {
listTitle.innerText = "Personal";
if (isSupportAgent()) {
actionContainer.innerHTML = `<button class="btn-glass-icon" onclick="openNewAgentForm()" title="Lägg till ny agent i systemet"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></button>`;
}
renderAdminUserList();
} else if (tab === 'offices') {
listTitle.innerText = "Kontorsnätverk";
if (isSupportAgent()) {
actionContainer.innerHTML = `<button class="btn-glass-icon" onclick="openNewOfficeForm()" title="Lägg till nytt kontor i systemet"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="13" height="18"/><path d="M21 15V9"/><path d="M21 3v3"/><line x1="19" y1="6" x2="23" y2="6"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="13" y1="9" x2="13" y2="9"/><line x1="9" y1="14" x2="9" y2="14"/><line x1="13" y1="14" x2="13" y2="14"/></svg></button>`;
}
renderAdminOfficeList();
} else if (tab === 'config') {
listTitle.innerText = "Systemkonfiguration";
renderSystemConfigNav();
} else if (tab === 'about') {
listTitle.innerText = "Om Atlas";
actionContainer.innerHTML = '';
renderAdminAbout();
}
// Synca ikon-position: flik med knapp → förskjut ikonen vänster
const paneHdr = document.querySelector('.admin-sidebar-list .pane-header');
if (paneHdr) paneHdr.classList.toggle('has-action', (tab === 'users' || tab === 'offices') && isSupportAgent());
};

// =============================================================================
// SEKTIONS-TOOLTIP — JS-baserad smart positionering för .sh-tip ikoner
// Skapar en enda tooltip-div vid body-nivå och positionerar den dynamiskt
// baserat på tillgängligt utrymme (ovan/nedan/horisontellt klämd).
// =============================================================================
(function initShTipTooltips() {
  let tipEl = null;
  let hideTimer = null;

  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.id = 'atlas-sh-tooltip';
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function showTip(anchor, text) {
    clearTimeout(hideTimer);
    const el = ensureTip();
    el.textContent = text;
    el.style.display = 'block';
    el.style.opacity = '0';

    // Mät tooltip-höjden efter att innehåll är satt
    const tipW = 230;
    const tipH = el.getBoundingClientRect().height || 72;
    const gap  = 8;
    const pad  = 10; // marginal mot viewportens kanter

    const rect = anchor.getBoundingClientRect();

    // Horisontell position: centrerad mot ankaret, klämd till viewport
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tipW - pad));

    // Vertikal position: välj ovan om det finns plats, annars nedan
    const spaceAbove = rect.top - gap - pad;
    const spaceBelow = window.innerHeight - rect.bottom - gap - pad;
    let top;
    if (spaceAbove >= tipH) {
      // Visa ovanför ankaret
      top = rect.top - tipH - gap;
    } else if (spaceBelow >= tipH) {
      // Visa nedanför ankaret
      top = rect.bottom + gap;
    } else {
      // Nödlösning: mitt i skärmen vid ankaret (extremfall)
      top = Math.max(pad, rect.top - tipH / 2);
    }

    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
    el.style.opacity = '1';
  }

  function hideTip() {
    if (!tipEl) return;
    tipEl.style.opacity = '0';
    hideTimer = setTimeout(() => {
      if (tipEl) tipEl.style.display = 'none';
    }, 150);
  }

  // Event-delegation — fångar alla .sh-tip oavsett när de skapas i DOM
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest?.('.sh-tip');
    if (!target || !target.dataset.tip) return;
    showTip(target, target.dataset.tip);
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest?.('.sh-tip');
    if (!target) return;
    hideTip();
  });

  // Dölj tooltip om man scrollar (annars hänger den kvar)
  document.addEventListener('scroll', hideTip, true);
})();

// =============================================================================
// ADMIN TAB 3 — KUNSKAPSBANK (BASFAKTA) — HTML-escape-hjälpare
// =============================================================================
function adminEscapeHtml(str) {
if (!str) return '';
return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}