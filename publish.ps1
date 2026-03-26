# Atlas Publish Script - Git Push + Deploy i ett steg
# Kör: .\publish.ps1 "Ditt commit-meddelande"
# Eller utan meddelande: .\publish.ps1  (använder automatiskt meddelande)

$commitMessage = $args[0]

Write-Host ""
Write-Host "===== ATLAS PUBLISH =====" -ForegroundColor Cyan
Write-Host "Steg 1: Pushar till GitHub..." -ForegroundColor Yellow
Write-Host ""

if ($commitMessage) {
    node C:\Atlas\tests\scripts\git-push.js $commitMessage
} else {
    node C:\Atlas\tests\scripts\git-push.js
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "GIT PUSH MISSLYCKADES - Deploy avbryts." -ForegroundColor Red
    Read-Host "Tryck Enter för att stänga"
    exit 1
}

Write-Host ""
Write-Host "Steg 2: Deployar till VPS..." -ForegroundColor Yellow
Write-Host ""

& C:\Atlas\deploy.ps1

