# Atlas – sammanfattning 2026-03-01 11:02:41

**Mapp:** C:\Atlas

## Grundstatistik
- Filer: **55**
- Rader: **24 030**
- Blanka: **3 021** (~12.6%)
- Tecken: **913 188**
- Snitt rader/fil: **436.9**

## Inkluderade filer
- .claude/settings.local.json
- .git/cursor/crepe/26d154dfdfe30c924915a7391e0fe51aede1d9f8/metadata.json
- db.js
- electron-builder-client.json
- legacy_engine.js
- main-client.js
- main.js
- middleware/auth.js
- patch/forceAddEngine.js
- patch/intentEngine.js
- preload-loader.js
- preload.js
- Renderer/assets/css/style.css
- Renderer/assets/js/service_templates.json
- Renderer/index.html
- Renderer/loader.css
- Renderer/loader.html
- Renderer/loader.js
- Renderer/modules/admin/admin-agents.js
- Renderer/modules/admin/admin-audit.js
- Renderer/modules/admin/admin-config.js
- Renderer/modules/admin/admin-core.js
- Renderer/modules/admin/admin-drift.js
- Renderer/modules/admin/admin-forms.js
- Renderer/modules/admin/admin-gaps.js
- Renderer/modules/admin/admin-offices.js
- Renderer/modules/admin/admin-reader.js
- Renderer/modules/admin/admin-tools.js
- Renderer/modules/admin/admin-users.js
- Renderer/modules/archive-view.js
- Renderer/modules/bulk-ops.js
- Renderer/modules/chat-engine.js
- Renderer/modules/detail-ui.js
- Renderer/modules/inbox-view.js
- Renderer/modules/ipc-bridges.js
- Renderer/modules/modals.js
- Renderer/modules/notes-system.js
- Renderer/modules/socket-client.js
- Renderer/modules/styling-utils.js
- Renderer/modules/templates-view.js
- Renderer/modules/tickets-view.js
- Renderer/modules/ui-constants.js
- Renderer/renderer.js
- routes/admin.js
- routes/archive.js
- routes/auth.js
- routes/customer.js
- routes/notes.js
- routes/team.js
- routes/templates.js
- routes/webhook.js
- server.js
- utils/contextLock.js
- utils/priceResolver.js
- utils/transportstyrelsen-fallback.js

## Rekommendationer
Duplicerad kod:
```bash
npx jscpd . --min-lines 5 --min-tokens 30 --ignore "**/themes/**,**/quill*" --reporters console,html
```

Död kod:
```bash
npx knip --reporter compact
```
