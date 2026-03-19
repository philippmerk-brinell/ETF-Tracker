Write-Host "ETF Tracker - Update wird durchgefuhrt..." -ForegroundColor Cyan

Set-Location $PSScriptRoot

git pull

Write-Host "Frontend wird gebaut..." -ForegroundColor Yellow
Set-Location frontend
npm run build
Set-Location ..

Write-Host "Backend-Abhangigkeiten werden aktualisiert..." -ForegroundColor Yellow
Set-Location backend
npm install
Set-Location ..

Write-Host "PM2-Prozess wird neu geladen..." -ForegroundColor Yellow
pm2 reload etf-tracker

Write-Host "Fertig! App lauft auf http://localhost:3001" -ForegroundColor Green
