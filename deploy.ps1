# Atlas Deploy Script - Med backup & felkontroll
# VIKTIG REGEL: Skapa alltid backup fore deploy!
# Om något misslyckas kan du rollback direkt.

$SERVER = "root@204.168.129.104"
$REMOTE = "/apps/atlas/"
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$BACKUP_DIR = "/apps/atlas-backup-${TIMESTAMP}"

Write-Host "DEPLOY PABORJAD" -ForegroundColor Cyan
Write-Host ""

# ============================================
# SAKERHETSFRAOGA - Bekrafta innan deploy borjar
# ============================================
Write-Host "BEKRAFTELSE KRAVS" -ForegroundColor Yellow
$confirm = Read-Host "Vill du SKICKA fran denna dator TILL server? (j/n)"

if ($confirm -ne "j" -and $confirm -ne "J") {
    Write-Host ""
    Write-Host "DEPLOY AVBRUTEN av anvandare." -ForegroundColor Red
    Write-Host ""
    Read-Host "Tryck Enter for att stanga"
    exit 0
}

Write-Host ""
Write-Host "Ok, deploy paborjas..." -ForegroundColor Green
Write-Host ""

# ============================================
# STEG 1: Skapa backup fore deploy
# ============================================
Write-Host "Skapar backup pa servern innan deploy borjar..." -ForegroundColor Yellow
ssh ${SERVER} "cp -r $REMOTE $BACKUP_DIR"

if ($LASTEXITCODE -ne 0) {
    Write-Host "BACKUP MISSLYCKADES! Deploy avbryts for sakerhet." -ForegroundColor Red
    Write-Host "   Kontrollera SSH-anslutningen och forsok igen." -ForegroundColor Yellow
    Read-Host "Tryck Enter for att stanga"
    exit 1
}

Write-Host "Backup klar: $BACKUP_DIR" -ForegroundColor Green

# Rensa gamla backups - behall bara den senaste
Write-Host "Rensar gamla backups..." -ForegroundColor Gray
ssh -o BatchMode=yes -o ConnectTimeout=12 ${SERVER} "find /apps -maxdepth 1 -type d -name 'atlas-backup-*' -printf '%T@ %p\n' | sort -nr | tail -n +2 | cut -d' ' -f2- | xargs -r rm -rf" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Varning: kunde inte rensa gamla backups automatiskt (deploy fortsatter)." -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# STEG 2: Deploy filer med felkontroll
# ============================================
Write-Host "Kopierar filer till servern..." -ForegroundColor Cyan

$deployFailed = $false
$deployedFiles = 0
$failedFiles = @()

# Huvudfiler
$codeFiles = @(
    "C:\Atlas\server.js",
    "C:\Atlas\db.js",
    "C:\Atlas\legacy_engine.js",
    "C:\Atlas\main-client.js",
    "C:\Atlas\package.json",
    "C:\Atlas\ecosystem.config.js",
    "C:\Atlas\widget.js",
    "C:\Atlas\demo.html"
)

# Debug-verktyg (deployat separat till VPS-roten for enkel körning)
$debugFiles = @(
    "C:\Atlas\tests\scripts\rag-debug.js"
)

foreach ($file in $codeFiles + $debugFiles) {
    $fileName = [System.IO.Path]::GetFileName($file)
    Write-Host "  -> $fileName" -ForegroundColor Gray

    scp $file ${SERVER}:${REMOTE} 2>$null

    if ($LASTEXITCODE -eq 0) {
        $deployedFiles++
    } else {
        Write-Host "    MISSLYCKADES: $fileName" -ForegroundColor Red
        $deployFailed = $true
        $failedFiles += $fileName
    }
}

Write-Host ""

# Mappar
$folders = @(
    @("C:\Atlas\routes\*", "routes"),
    @("C:\Atlas\middleware\*", "middleware"),
    @("C:\Atlas\patch\*", "patch"),
    @("C:\Atlas\utils\*", "utils"),
    @("C:\Atlas\Renderer\*", "Renderer"),
    @("C:\Atlas\kundchatt\*", "kundchatt")
)

foreach ($folder in $folders) {
    $localPath = $folder[0]
    $folderName = $folder[1]
    Write-Host "  -> $folderName/" -ForegroundColor Gray
    
    scp -r $localPath ${SERVER}:${REMOTE}${folderName}/ 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        $deployedFiles++
    } else {
        Write-Host "    MISSLYCKADES: $folderName/" -ForegroundColor Red
        $deployFailed = $true
        $failedFiles += "$folderName/"
    }
}

Write-Host ""

# Om något misslyckas - ALLVARLIG VARNING
if ($deployFailed) {
    Write-Host "DEPLOY MISSLYCKADES DELVIS!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Foljande kunde inte kopieras:" -ForegroundColor Red
    foreach ($item in $failedFiles) {
        Write-Host "   - $item" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "BACKUP FINNS PA SERVERN:" -ForegroundColor Yellow
    Write-Host "   $BACKUP_DIR" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "FOR ATT ROLLBACK:" -ForegroundColor Yellow
    Write-Host "   ssh ${SERVER} 'rm -rf $REMOTE && mv $BACKUP_DIR $REMOTE'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Tryck Enter for att stanga"
    exit 1
}

Write-Host "Alla filer kopierade framgangsrikt!" -ForegroundColor Green
Write-Host ""

# ============================================
# STEG 3: Starta om Atlas-processen (PM2)
# ============================================
Write-Host "Startar om Atlas-processen (PM2)..." -ForegroundColor Yellow

ssh ${SERVER} "pm2 restart atlas" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "PM2 RESTART MISSLYCKADES!" -ForegroundColor Red
    Write-Host ""
    Write-Host "BACKUP ligger kvar pa servern:" -ForegroundColor Yellow
    Write-Host "   $BACKUP_DIR" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "FOR ATT ROLLBACK:" -ForegroundColor Yellow
    Write-Host "   ssh ${SERVER} 'rm -rf $REMOTE && mv $BACKUP_DIR $REMOTE && pm2 restart atlas'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Tryck Enter for att stanga"
    exit 1
}

Write-Host "PM2 restartat framgangsrikt!" -ForegroundColor Green
Write-Host ""

# ============================================
# KLART!
# ============================================
Write-Host "DEPLOY FARDIG!" -ForegroundColor Green
Write-Host "   atlas-support.se kors nu med ny kod." -ForegroundColor Green
Write-Host ""
Write-Host "Backup sparad for rollback:" -ForegroundColor Green
Write-Host "   $BACKUP_DIR" -ForegroundColor Gray
Write-Host ""
Read-Host "Tryck Enter for att stanga"