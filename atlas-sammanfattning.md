# Atlas – sammanfattning 2026-02-27 10:32:54

**Mapp:** C:\Atlas

## Grundstatistik
- Filer: **30**
- Rader: **22 834**
- Blanka: **2 894** (~12.7%)
- Tecken: **857 658**
- Snitt rader/fil: **761.1**

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

## Rekommendationer
Duplicerad kod:
```bash
npx jscpd . --min-lines 5 --min-tokens 30 --ignore "**/themes/**,**/quill*" --reporters console,html
```

Död kod:
```bash
npx knip --reporter compact
```
