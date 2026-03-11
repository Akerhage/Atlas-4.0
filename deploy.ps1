# Atlas Deploy Script
$SERVER = "root@204.168.129.104"
$REMOTE = "/apps/atlas/"

# Huvudfiler
scp C:\Atlas\server.js ${SERVER}:${REMOTE}
scp C:\Atlas\db.js ${SERVER}:${REMOTE}
scp C:\Atlas\legacy_engine.js ${SERVER}:${REMOTE}
scp C:\Atlas\main-client.js ${SERVER}:${REMOTE}
scp C:\Atlas\package.json ${SERVER}:${REMOTE}
scp C:\Atlas\ecosystem.config.js ${SERVER}:${REMOTE}

# Mappar
scp -r C:\Atlas\routes\* ${SERVER}:${REMOTE}routes/
scp -r C:\Atlas\middleware\* ${SERVER}:${REMOTE}middleware/
scp -r C:\Atlas\patch\* ${SERVER}:${REMOTE}patch/
scp -r C:\Atlas\utils\* ${SERVER}:${REMOTE}utils/
scp -r C:\Atlas\Renderer\* ${SERVER}:${REMOTE}Renderer/
scp -r C:\Atlas\knowledge\* ${SERVER}:${REMOTE}knowledge/
scp -r C:\Atlas\kundchatt\* ${SERVER}:${REMOTE}kundchatt/

# Starta om
ssh $SERVER "pm2 restart atlas"

Write-Host "✅ Deploy klar!" -ForegroundColor Green
Read-Host "Tryck Enter för att stänga"