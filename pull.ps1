# Atlas Pull Script — Hämtar senaste filer från servern till lokal C:\Atlas\
# Använd detta när du byter dator (hem ↔ jobb) för att synka koden.
# REGEL: Kod-filer hämtas från servern (senaste deploy). Data-filer (knowledge) hämtas alltid.

$SERVER = "root@204.168.129.104"
$REMOTE = "/apps/atlas/"

Write-Host "⬇️  Hämtar filer från $SERVER..." -ForegroundColor Cyan

# Huvudfiler (kod)
scp ${SERVER}:${REMOTE}server.js         C:\Atlas\
scp ${SERVER}:${REMOTE}db.js             C:\Atlas\
scp ${SERVER}:${REMOTE}legacy_engine.js  C:\Atlas\
scp ${SERVER}:${REMOTE}main-client.js    C:\Atlas\
scp ${SERVER}:${REMOTE}rag-debug.js      C:\Atlas\
scp ${SERVER}:${REMOTE}package.json      C:\Atlas\
scp ${SERVER}:${REMOTE}ecosystem.config.js C:\Atlas\

# Mappar (kod)
scp -r ${SERVER}:${REMOTE}routes/*     C:\Atlas\routes\
scp -r ${SERVER}:${REMOTE}middleware/* C:\Atlas\middleware\
scp -r ${SERVER}:${REMOTE}patch/*      C:\Atlas\patch\
scp -r ${SERVER}:${REMOTE}utils/*      C:\Atlas\utils\
scp -r ${SERVER}:${REMOTE}Renderer/*   C:\Atlas\Renderer\
scp -r ${SERVER}:${REMOTE}kundchatt/*  C:\Atlas\kundchatt\

# Data-filer (alltid från servern — dessa ägs av VPS)
scp -r ${SERVER}:${REMOTE}knowledge/*  C:\Atlas\knowledge\

# Hoppas över: atlas.db, .env, uploads/, node_modules/

Write-Host ""
Write-Host "✅ Pull klar! Lokala filer uppdaterade från servern." -ForegroundColor Green
Write-Host "   OBS: .env, atlas.db och uploads/ hämtas aldrig — de är maskin-specifika." -ForegroundColor Yellow
Read-Host "Tryck Enter för att stänga"
