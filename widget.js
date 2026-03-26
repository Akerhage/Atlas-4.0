/**
 * Atlas Support Widget
 * Inbäddningsbar chattwidget — fungerar som Intercom.
 *
 * Minimal embed:
 *   <script src="https://atlas-support.se/widget.js"></script>
 *
 * Med config:
 *   <script src="https://atlas-support.se/widget.js"
 *     data-color="#2563eb"
 *     data-position="right"
 *     data-label="Fråga Atlas">
 *   </script>
 *
 * Programmatisk styrning:
 *   window.AtlasWidget.open()
 *   window.AtlasWidget.close()
 */
(function () {
  'use strict';

  // Dubbelinitiering-skydd
  if (window.__atlasWidgetLoaded) return;
  window.__atlasWidgetLoaded = true;

  // ─── Konstanter ────────────────────────────────────────────────────────────
  var CHAT_URL = 'https://atlas-support.se/kundchatt';
  var Z_INDEX  = 2147483647; // max möjliga z-index (samma som Intercom)

  // ─── Läs konfiguration från script-taggens data-attribut ───────────────────
  var scriptTag = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  var cfg = {
    color    : (scriptTag && scriptTag.getAttribute('data-color'))    || '#2563eb',
    position : (scriptTag && scriptTag.getAttribute('data-position')) || 'right',
    label    : (scriptTag && scriptTag.getAttribute('data-label'))    || 'Chatta med oss'
  };

  // ─── CSS (scopat under #atlas-widget-root) ─────────────────────────────────
  var css = [
    '#atlas-widget-root *,#atlas-widget-root *::before,#atlas-widget-root *::after{box-sizing:border-box;margin:0;padding:0;}',

    /* Flytande knapp */
    '#atlas-widget-btn{',
    '  position:fixed;',
    '  bottom:24px;',
    '  ' + cfg.position + ':24px;',
    '  z-index:' + Z_INDEX + ';',
    '  display:flex;',
    '  align-items:center;',
    '  gap:8px;',
    '  padding:0 20px 0 16px;',
    '  height:52px;',
    '  border-radius:26px;',
    '  background:' + cfg.color + ';',
    '  color:#fff;',
    '  border:none;',
    '  cursor:pointer;',
    '  box-shadow:0 4px 20px rgba(0,0,0,0.25);',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    '  font-size:15px;',
    '  font-weight:600;',
    '  letter-spacing:0.01em;',
    '  transition:transform 0.18s ease,box-shadow 0.18s ease;',
    '  outline:none;',
    '  user-select:none;',
    '}',
    '#atlas-widget-btn:hover{transform:scale(1.04);box-shadow:0 6px 28px rgba(0,0,0,0.32);}',
    '#atlas-widget-btn:active{transform:scale(0.97);}',

    /* Badge för olästa meddelanden */
    '#atlas-widget-badge{',
    '  position:absolute;',
    '  top:-4px;',
    '  right:-4px;',
    '  min-width:20px;',
    '  height:20px;',
    '  padding:0 5px;',
    '  border-radius:10px;',
    '  background:#ef4444;',
    '  color:#fff;',
    '  font-size:11px;',
    '  font-weight:700;',
    '  line-height:20px;',
    '  text-align:center;',
    '  display:none;',
    '  pointer-events:none;',
    '}',

    /* Iframe-container */
    '#atlas-widget-frame-wrap{',
    '  position:fixed;',
    '  bottom:90px;',
    '  ' + cfg.position + ':24px;',
    '  z-index:' + (Z_INDEX - 1) + ';',
    '  width:380px;',
    '  height:600px;',
    '  max-height:calc(100vh - 110px);',
    '  border-radius:16px;',
    '  overflow:hidden;',
    '  box-shadow:0 8px 40px rgba(0,0,0,0.28);',
    '  opacity:0;',
    '  transform:translateY(16px) scale(0.97);',
    '  pointer-events:none;',
    '  transition:opacity 0.22s ease,transform 0.22s ease;',
    '}',
    '#atlas-widget-frame-wrap.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}',

    /* Iframe */
    '#atlas-widget-iframe{width:100%;height:100%;border:none;display:block;background:#fff;}',

    /* Responsiv: smal skärm → full-bredd popup */
    '@media(max-width:480px){',
    '  #atlas-widget-frame-wrap{left:0!important;right:0!important;bottom:0;width:100%;height:75vh;border-radius:16px 16px 0 0;}',
    '}'
  ].join('\n');

  // ─── Injicera CSS ──────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.id  = 'atlas-widget-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ─── Bygg DOM ──────────────────────────────────────────────────────────────
  var root = document.createElement('div');
  root.id = 'atlas-widget-root';

  // Knapp
  var btn = document.createElement('button');
  btn.id = 'atlas-widget-btn';
  btn.setAttribute('aria-label', cfg.label);
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');

  // Ikon: pratbubbla (SVG inline)
  var iconChat = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  // Ikon: kryss
  var iconClose = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var iconSpan = document.createElement('span');
  iconSpan.id = 'atlas-widget-icon';
  iconSpan.innerHTML = iconChat;

  var labelSpan = document.createElement('span');
  labelSpan.id = 'atlas-widget-label';
  labelSpan.textContent = cfg.label;

  var badge = document.createElement('span');
  badge.id = 'atlas-widget-badge';
  badge.setAttribute('aria-live', 'polite');

  btn.appendChild(iconSpan);
  btn.appendChild(labelSpan);
  btn.appendChild(badge);

  // Iframe-wrapper
  var frameWrap = document.createElement('div');
  frameWrap.id = 'atlas-widget-frame-wrap';
  frameWrap.setAttribute('role', 'dialog');
  frameWrap.setAttribute('aria-label', 'Atlas support chatt');

  root.appendChild(frameWrap);
  root.appendChild(btn);
  document.body.appendChild(root);

  // ─── State ─────────────────────────────────────────────────────────────────
  var isOpen      = false;
  var iframeReady = false;

  // ─── Lazy-ladda iframe vid första öppning ──────────────────────────────────
  function ensureIframe() {
    if (iframeReady) return;
    iframeReady = true;
    var iframe = document.createElement('iframe');
    iframe.id    = 'atlas-widget-iframe';
    iframe.src   = CHAT_URL;
    iframe.title = 'Atlas support chatt';
    iframe.setAttribute('allow', 'microphone; camera');
    frameWrap.appendChild(iframe);
  }

  // ─── Öppna / stäng ─────────────────────────────────────────────────────────
  function open() {
    if (isOpen) return;
    isOpen = true;
    ensureIframe();
    frameWrap.classList.add('open');
    iconSpan.innerHTML = iconClose;
    labelSpan.textContent = 'Stäng';
    btn.setAttribute('aria-expanded', 'true');
    // Nollställ badge när chatten öppnas
    badge.style.display = 'none';
    badge.textContent   = '';
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    frameWrap.classList.remove('open');
    iconSpan.innerHTML    = iconChat;
    labelSpan.textContent = cfg.label;
    btn.setAttribute('aria-expanded', 'false');
  }

  function toggle() {
    isOpen ? close() : open();
  }

  btn.addEventListener('click', toggle);

  // ─── PostMessage: oläst-badge ───────────────────────────────────────────────
  // Kundchatten kan skicka: window.parent.postMessage({ type: 'atlas:unread', count: N }, '*')
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'atlas:unread') return;
    var count = parseInt(e.data.count, 10) || 0;
    if (count > 0 && !isOpen) {
      badge.textContent   = count > 99 ? '99+' : String(count);
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
      badge.textContent   = '';
    }
  });

  // ─── Stäng vid klick utanför ───────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    if (root.contains(e.target)) return;
    close();
  });

  // ─── Stäng med Escape ──────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });

  // ─── Publikt API ───────────────────────────────────────────────────────────
  window.AtlasWidget = {
    open  : open,
    close : close,
    toggle: toggle
  };
})();
