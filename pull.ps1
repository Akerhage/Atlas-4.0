# Atlas Pull Script - Med felkontroll
# Hamtar senaste filer fran servern till lokal C:\Atlas\
# Anvand detta nar du byter dator (hem <-> jobb) for att synka koden.
# REGEL: Kod-filer hamtas fran servern (senaste deploy). Data-filer (knowledge) hamtas alltid.

$SERVER = "root@204.168.129.104"
$REMOTE = "/apps/atlas/"

Write-Host "PULL PABORJAD" -ForegroundColor Cyan
Write-Host "   Hamtar senaste koden fran servern..." -ForegroundColor Gray
Write-Host ""

# ============================================
# SAKERHETSFRAOGA - Bekrafta innan pull borjar
# ============================================
Write-Host "BEKRAFTELSE KRAVS" -ForegroundColor Yellow
$confirm = Read-Host "Vill du HAMTA fran server TILL denna dator? (j/n)"

if ($confirm -ne "j" -and $confirm -ne "J") {
    Write-Host ""
    Write-Host "PULL AVBRUTEN av anvandare." -ForegroundColor Red
    Write-Host ""
    Read-Host "Tryck Enter for att stanga"
    exit 0
}

Write-Host ""
Write-Host "Ok, pull paborjas..." -ForegroundColor Green
Write-Host ""

$pullFailed = $false
$pulledItems = 0
$failedItems = @()

# ============================================
# Kod-filer
# ============================================
Write-Host "Kopierar kod-filer..." -ForegroundColor Yellow

$codeFiles = @(
    "server.js",
    "db.js",
    "legacy_engine.js",
    "main-client.js",
    "package.json",
    "ecosystem.config.js",
    "widget.js"
)

foreach ($file in $codeFiles) {
    Write-Host "  -> $file" -ForegroundColor Gray
    
    scp "${SERVER}:${REMOTE}${file}" C:\Atlas\ 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        $pulledItems++
    } else {
        Write-Host "    MISSLYCKADES: $file" -ForegroundColor Red
        $pullFailed = $true
        $failedItems += $file
    }
}

Write-Host ""

# ============================================
# Mappar
# ============================================
Write-Host "Kopierar mappar..." -ForegroundColor Yellow

$folders = @(
    "routes",
    "middleware",
    "patch",
    "utils",
    "Renderer",
    "kundchatt",
    "knowledge"
)

foreach ($folder in $folders) {
    Write-Host "  -> $folder/" -ForegroundColor Gray
    
    scp -r "${SERVER}:${REMOTE}${folder}/*" "C:\Atlas\${folder}\" 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        $pulledItems++
    } else {
        Write-Host "    MISSLYCKADES: $folder/" -ForegroundColor Red
        $pullFailed = $true
        $failedItems += "$folder/"
    }
}

Write-Host ""

# ============================================
# Felhantering
# ============================================
if ($pullFailed) {
    Write-Host "PULL MISSLYCKADES DELVIS!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Foljande kunde inte hamtas:" -ForegroundColor Red
    foreach ($item in $failedItems) {
        Write-Host "   - $item" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Mojliga orsaker:" -ForegroundColor Yellow
    Write-Host "   - Internetanslutning borta" -ForegroundColor Yellow
    Write-Host "   - SSH-nyckel saknas eller utgangen" -ForegroundColor Yellow
    Write-Host "   - Servern ar nere" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Forsok igen nar anslutningen ar stabil." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Tryck Enter for att stanga"
    exit 1
}

# ============================================
# KLART!
# ============================================
Write-Host "PULL FARDIG!" -ForegroundColor Green
Write-Host "   Alla filer uppdaterade fran servern." -ForegroundColor Green
Write-Host ""
Write-Host "Lokala maskin-specifika filer HAMTAS ALDRIG:" -ForegroundColor Yellow
Write-Host "   - .env (miljövariabler)" -ForegroundColor Gray
Write-Host "   - atlas.db (lokal databas)" -ForegroundColor Gray
Write-Host "   - uploads/ (lokala filer)" -ForegroundColor Gray
Write-Host ""
Write-Host "Du kan nu borja koda!" -ForegroundColor Green
Write-Host ""
Read-Host "Tryck Enter for att stanga"

