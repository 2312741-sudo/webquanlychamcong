@echo off
rem ================================================================
rem  CAI DAT "TRAM MO KET" - chay file nay (tu xin quyen Admin)
rem ================================================================
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)
set "DEST=%ProgramData%\TramMoKet"
set "STARTUP=%ProgramData%\Microsoft\Windows\Start Menu\Programs\StartUp"

echo Dang dung ban cu (neu co)...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*TramMoKet.ps1*' } | Invoke-CimMethod -MethodName Terminate | Out-Null"

echo Dang chep phan mem vao %DEST% ...
if not exist "%DEST%" mkdir "%DEST%"
copy /Y "%~dp0TramMoKet.ps1" "%DEST%\TramMoKet.ps1" >nul
rem Cho phep tai khoan thuong ghi cau hinh / nhat ky (SID nhom Users)
icacls "%DEST%" /grant *S-1-5-32-545:(OI)(CI)M >nul

echo Mo cong 8787 (chi mang noi bo cua quan)...
netsh http delete urlacl url=http://+:8787/ >nul 2>&1
netsh http add urlacl url=http://+:8787/ sddl=D:(A;;GX;;;WD) >nul
netsh advfirewall firewall delete rule name="Tram Mo Ket" >nul 2>&1
netsh advfirewall firewall add rule name="Tram Mo Ket" dir=in action=allow protocol=TCP localport=8787 remoteip=localsubnet profile=any >nul

echo Tu chay khi bat may...
> "%DEST%\ChayAn.vbs" echo CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""%DEST%\TramMoKet.ps1""", 0, False
copy /Y "%DEST%\ChayAn.vbs" "%STARTUP%\TramMoKet.vbs" >nul

echo Khoi dong...
start "" wscript.exe "%DEST%\ChayAn.vbs"
timeout /t 3 >nul
start "" "http://localhost:8787/status"

echo.
echo ================================================================
echo  XONG! Trinh duyet vua mo trang tinh trang: thay "ok":true la chay roi.
echo  Tiep theo: mo web Cham Cong tren CHINH laptop nay
echo    Cai dat ^> Ket tien ^> bam "Ghep noi voi laptop nay".
echo ================================================================
pause
