# ETF Signal Engine — daily launcher
# Scheduled via Windows Task Scheduler (Mon-Fri 23:00 local time)

$ProjectDir = "C:\Users\PhilippMerk\ETF-Tracker"
$LogFile    = "$ProjectDir\data\scheduler.log"
$Python     = "python"

Set-Location $ProjectDir

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content $LogFile "`n=== Run started: $timestamp ==="

& $Python main.py 2>&1 | Tee-Object -Append -FilePath $LogFile

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content $LogFile "=== Run finished: $timestamp ==="
