@echo off
rem GO CAI DAT "TRAM MO KET" (tu xin quyen Admin)
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*TramMoKet.ps1*' } | Invoke-CimMethod -MethodName Terminate | Out-Null"
del /Q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\StartUp\TramMoKet.vbs" >nul 2>&1
netsh http delete urlacl url=http://+:8787/ >nul 2>&1
netsh advfirewall firewall delete rule name="Tram Mo Ket" >nul 2>&1
rmdir /S /Q "%ProgramData%\TramMoKet" >nul 2>&1
echo Da go "Tram Mo Ket". Nho bam "Huy ghep noi" trong web Cham Cong ^> Cai dat ^> Ket tien.
pause
