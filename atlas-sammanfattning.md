# Atlas – sammanfattning 2026-02-24 16:01:38

**Mapp:** C:\Atlas

## Grundstatistik
- Filer: **28**
- Rader: **564 230**
- Blanka: **98 536** (~17.5%)
- Tecken: **31 071 177**
- Snitt rader/fil: **20151.1**

## Inkluderade filer
- .claude/settings.local.json
- .git/cursor/crepe/26d154dfdfe30c924915a7391e0fe51aede1d9f8/metadata.json
- db.js
- dist-client/win-unpacked/LICENSES.chromium.html
- dist-client/win-unpacked/vk_swiftshader_icd.json
- dist/win-unpacked/LICENSES.chromium.html
- dist/win-unpacked/resources/patch/forceAddEngine.js
- dist/win-unpacked/resources/patch/intentEngine.js
- dist/win-unpacked/resources/utils/contextLock.js
- dist/win-unpacked/resources/utils/priceResolver.js
- dist/win-unpacked/vk_swiftshader_icd.json
- electron-builder-client.json
- legacy_engine.js
- main-client.js
- main.js
- patch/forceAddEngine.js
- patch/intentEngine.js
- preload-loader.js
- preload.js
- Renderer/assets/css/style.css
- Renderer/index.html
- Renderer/loader.css
- Renderer/loader.html
- Renderer/loader.js
- Renderer/renderer.js
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
