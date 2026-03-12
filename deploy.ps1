# Atlas Deploy Script
$SERVER = "root@204.168.129.104"
$REMOTE = "/apps/atlas/"

Write-Host "🚀 Deployar filer till servern..." -ForegroundColor Cyan

# Huvudfiler
scp C:\Atlas\server.js ${SERVER}:${REMOTE}
scp C:\Atlas\db.js ${SERVER}:${REMOTE}
scp C:\Atlas\legacy_engine.js ${SERVER}:${REMOTE}
scp C:\Atlas\main-client.js ${SERVER}:${REMOTE}
scp C:\Atlas\rag-debug.js ${SERVER}:${REMOTE}
scp C:\Atlas\package.json ${SERVER}:${REMOTE}
scp C:\Atlas\ecosystem.config.js ${SERVER}:${REMOTE}

# Mappar
scp -r C:\Atlas\routes\* ${SERVER}:${REMOTE}routes/
scp -r C:\Atlas\middleware\* ${SERVER}:${REMOTE}middleware/
scp -r C:\Atlas\patch\* ${SERVER}:${REMOTE}patch/
scp -r C:\Atlas\utils\* ${SERVER}:${REMOTE}utils/
scp -r C:\Atlas\Renderer\* ${SERVER}:${REMOTE}Renderer/
scp -r C:\Atlas\kundchatt\* ${SERVER}:${REMOTE}kundchatt/
# OBS: knowledge/ deployas INTE — dessa filer ägs av servern (redigeras via admin-UI)
# Vill du ändå pusha knowledge manuellt (t.ex. efter lokal fix):
#   scp -r C:\Atlas\knowledge\* root@204.168.129.104:/apps/atlas/knowledge/

Write-Host "🔄 Startar om Atlas-processen (PM2)..." -ForegroundColor Yellow
# OBS: knowledge/ deployas INTE — dessa filer ägs av servern (redigeras via admin-UI)
# Vill du ändå pusha knowledge manuellt (t.ex. efter lokal fix):
# scp -r C:\Atlas\knowledge\* root@204.168.129.104:/apps/atlas/knowledge/
# Startar om specifikt processen "atlas" som definierats i ecosystem.config.js
ssh ${SERVER} "pm2 restart atlas"

Write-Host "✅ Allt klart! Servern kör nu den nya koden." -ForegroundColor Green