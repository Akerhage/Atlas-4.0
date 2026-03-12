# Atlas Pull Script — Hämtar senaste filer från servern till lokal C:\Atlas\
# Använd detta när du byter dator (hem ↔ jobb) för att synka koden.
# REGEL: Kod-filer hämtas från servern (senaste deploy). Data-filer (knowledge) hämtas alltid.

# Atlas Pull Script
$SERVER = "root@204.168.129.104"
$REMOTE = "/apps/atlas/"

Write-Host "⬇️ Hämtar senaste koden från servern till denna dator..." -ForegroundColor Cyan

# Kod-filer
scp ${SERVER}:${REMOTE}server.js         C:\Atlas\
scp ${SERVER}:${REMOTE}db.js             C:\Atlas\
scp ${SERVER}:${REMOTE}legacy_engine.js  C:\Atlas\
scp ${SERVER}:${REMOTE}main-client.js    C:\\Atlas\
scp ${SERVER}:${REMOTE}rag-debug.js      C:\Atlas\
scp ${SERVER}:${REMOTE}package.json      C:\Atlas\
scp ${SERVER}:${REMOTE}ecosystem.config.js C:\Atlas\

# Mappar
scp -r ${SERVER}:${REMOTE}routes/* C:\Atlas\routes\
scp -r ${SERVER}:${REMOTE}middleware/* C:\Atlas\middleware\
scp -r ${SERVER}:${REMOTE}patch/* C:\Atlas\patch\
scp -r ${SERVER}:${REMOTE}utils/* C:\Atlas\utils\
scp -r ${SERVER}:${REMOTE}Renderer/* C:\Atlas\Renderer\
scp -r ${SERVER}:${REMOTE}kundchatt/* C:\Atlas\kundchatt\

# Knowledge (Viktigt att dessa alltid är synkade)
scp -r ${SERVER}:${REMOTE}knowledge/* C:\Atlas\knowledge\

Write-Host "✅ Synkronisering klar! Du kan nu börja koda." -ForegroundColor Green
Write-Host ""
Write-Host "✅ Pull klar! Lokala filer uppdaterade från servern." -ForegroundColor Green
Write-Host "   OBS: .env, atlas.db och uploads/ hämtas aldrig — de är maskin-specifika." -ForegroundColor Yellow
Read-Host "Tryck Enter för att stänga"

