# =============================================================================
#  TRAM MO KET - phan mem chay nen tren laptop Windows de MO KET TIEN
#  Ket (KiotViet) cam vao may in hoa don KV804 (cong DK / RJ11); may in cam USB vao laptop.
#  Web / app Cham Cong Tram gui lenh -> phan mem nay gui lenh ESC/POS "mo ket" toi may in.
#
#  MA MO KET DUNG 1 LAN: moi lan mo phai co (nonce, otp) voi otp = HMAC-SHA256(khoa bi mat cua CHU, nonce)
#  -> 6 so. Khoa bi mat chi phan mem nay va CHU biet (CHU nhan khoa khi ghep noi lan dau). Quan ly gui yeu cau,
#  CHU thay ma tren app / web roi gui cho quan ly. Ma dung 1 lan, het han sau 15 phut, sai 5 lan la huy ma.
#
#  Dia chi:  http://<IP laptop>:8787
#    GET  /status    : tinh trang (may in dang dung)            - ai cung goi duoc
#    GET  /pair      : ma ghep noi + IP LAN + danh sach may in    - CHI tu chinh laptop, CHI tu web Cham Cong
#                      (khoa bi mat chi tra LAN DAU, hoac khi gui kem header X-Owner-Secret dung)
#    POST /config    : doi may in / chan mo ket                     - CHI tu chinh laptop, CHI tu web Cham Cong
#    POST /open      : mo ket: header X-Drawer-Token + body { nonce, otp, by, source }
#
#  Cau hinh: %ProgramData%\TramMoKet\config.json   Nhat ky: %ProgramData%\TramMoKet\log.txt
# =============================================================================
$ErrorActionPreference = 'Stop'
$Version = '1.1.0'
$Dir = Join-Path $env:ProgramData 'TramMoKet'
$ConfigPath = Join-Path $Dir 'config.json'
$LogPath = Join-Path $Dir 'log.txt'
$UsedPath = Join-Path $Dir 'used.json'
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

function Write-Log([string]$msg) {
  try {
    $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $msg
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    if ((Get-Item $LogPath).Length -gt 2MB) { Move-Item -Force $LogPath "$LogPath.old" }
  } catch {}
}

# ---------------- Gui du lieu RAW toi may in (winspool) ----------------
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class TramRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string name, out IntPtr h, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern int StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr h, byte[] buf, int count, out int written);

  // Tra ve null neu thanh cong, nguoc lai la thong bao loi
  public static string Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) return "Khong mo duoc may in '" + printer + "' (loi " + Marshal.GetLastWin32Error() + ")";
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "Tram Mo Ket"; di.pDataType = "RAW";
      if (StartDocPrinter(h, 1, di) == 0) return "StartDocPrinter loi " + Marshal.GetLastWin32Error();
      try {
        if (!StartPagePrinter(h)) return "StartPagePrinter loi " + Marshal.GetLastWin32Error();
        int written;
        bool ok = WritePrinter(h, data, data.Length, out written);
        EndPagePrinter(h);
        if (!ok || written != data.Length) return "WritePrinter loi " + Marshal.GetLastWin32Error();
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
    return null;
  }
}
"@

# ---------------- Cau hinh ----------------
function New-Token([int]$bytes = 20) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ($b | ForEach-Object { '{0:x2}' -f $_ })
}

function Get-Printers {
  try { @(Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name) }
  catch { @(Get-WmiObject Win32_Printer | Select-Object -ExpandProperty Name) }
}

function Find-ReceiptPrinter {
  $all = Get-Printers
  $hit = $all | Where-Object { $_ -match 'KV|KIOT|80|POS|XP-|XPRINTER|RECEIPT|THERMAL' } | Select-Object -First 1
  if ($hit) { return $hit }
  try { (Get-CimInstance Win32_Printer | Where-Object Default | Select-Object -First 1).Name } catch { '' }
}

function Load-Config {
  $cfg = $null
  if (Test-Path $ConfigPath) { try { $cfg = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch {} }
  if (-not $cfg) { $cfg = [pscustomobject]@{} }
  $defaults = [ordered]@{
    port = 8787
    token = (New-Token)
    ownerSecret = (New-Token 32)   # khoa bi mat cua CHU (tao ma mo ket dung 1 lan)
    claimed = $false               # da tra khoa bi mat cho CHU khi ghep noi lan dau
    printerName = ''
    drawerPin = 0            # 0 = chan 2 (pho bien), 1 = chan 5
    enabled = $true
    allowedOrigins = @('https://webquanlychamcong.vercel.app', 'http://localhost:3000')
  }
  foreach ($k in $defaults.Keys) {
    if (-not ($cfg.PSObject.Properties.Name -contains $k)) { $cfg | Add-Member -NotePropertyName $k -NotePropertyValue $defaults[$k] }
  }
  if (-not $cfg.printerName) { $cfg.printerName = Find-ReceiptPrinter }
  Save-Config $cfg
  return $cfg
}

function Save-Config($cfg) { $cfg | ConvertTo-Json -Depth 5 | Set-Content -Path $ConfigPath -Encoding UTF8 }

function Get-LanIps {
  $ips = @()
  foreach ($ni in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($ni.OperationalStatus -ne 'Up') { continue }
    if ($ni.NetworkInterfaceType -eq 'Loopback' -or $ni.NetworkInterfaceType -eq 'Tunnel') { continue }
    foreach ($a in $ni.GetIPProperties().UnicastAddresses) {
      if ($a.Address.AddressFamily -ne 'InterNetwork') { continue }
      $s = $a.Address.ToString()
      if ($s.StartsWith('169.254.') -or $s.StartsWith('127.')) { continue }
      $ips += $s
    }
  }
  return $ips
}

# ---------------- Ma dung 1 lan ----------------
# otp = 6 so tu HMAC-SHA256(khoa = UTF8(ownerSecret), du lieu = UTF8(nonce)); khop web (lib/cashDrawer.ts) va app
function Get-Otp([string]$secret, [string]$nonce) {
  $hmac = New-Object System.Security.Cryptography.HMACSHA256 (,[System.Text.Encoding]::UTF8.GetBytes($secret))
  $h = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($nonce))
  $v = ([int64]$h[0] * 16777216 + [int64]$h[1] * 65536 + [int64]$h[2] * 256 + [int64]$h[3]) -band 0x7fffffff
  return ('{0:D6}' -f ($v % 1000000))
}

function Now-Ms { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

$script:Used = @{}
if (Test-Path $UsedPath) {
  try { (Get-Content $UsedPath -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $script:Used[$_.Name] = [int64]$_.Value } } catch {}
}
function Mark-Used([string]$nonce) {
  $now = Now-Ms
  $script:Used[$nonce] = $now
  foreach ($k in @($script:Used.Keys)) { if ($now - $script:Used[$k] -gt 2 * 86400000) { $script:Used.Remove($k) } }
  try { $script:Used | ConvertTo-Json -Compress | Set-Content -Path $UsedPath -Encoding UTF8 } catch {}
}

$script:NonceFails = @{}
$script:Fails = New-Object System.Collections.ArrayList
$OtpTtlMs = 15 * 60 * 1000

# Tra ve null neu ma hop le (va danh dau da dung), nguoc lai la thong bao loi
function Check-Otp($cfg, [string]$nonce, [string]$otp) {
  $now = Now-Ms
  while ($script:Fails.Count -gt 0 -and $now - [int64]$script:Fails[0] -gt 600000) { $script:Fails.RemoveAt(0) }
  if ($script:Fails.Count -ge 20) { return 'Nhap sai ma qua nhieu lan, tam khoa 10 phut' }
  if (-not $nonce -or -not ($nonce -match '^[A-Za-z0-9_-]{4,64}\.(\d{12,14})$')) { return 'Thieu ma yeu cau mo ket' }
  $created = [int64]$Matches[1]
  if ([math]::Abs($now - $created) -gt $OtpTtlMs) { return 'Ma da het han (qua 15 phut) - gui yeu cau moi' }
  if ($script:Used.ContainsKey($nonce)) { return 'Ma nay da duoc dung - gui yeu cau moi' }
  if (-not $otp -or -not ($otp -match '^\d{6}$')) { return 'Ma mo ket gom 6 so' }
  if ($otp -ne (Get-Otp ([string]$cfg.ownerSecret) $nonce)) {
    [void]$script:Fails.Add($now)
    $n = 1 + [int]$script:NonceFails[$nonce]
    $script:NonceFails[$nonce] = $n
    if ($n -ge 5) { Mark-Used $nonce; return 'Sai ma 5 lan - yeu cau nay da bi huy, gui yeu cau moi' }
    return "Sai ma mo ket (con $(5 - $n) lan thu)"
  }
  Mark-Used $nonce
  $script:NonceFails.Remove($nonce)
  return $null
}

# ---------------- Mo ket ----------------
function Open-Drawer($cfg) {
  if (-not $cfg.enabled) { return 'Mo ket dang bi tat tren may nay' }
  if (-not $cfg.printerName) { return 'Chua chon may in (vao web > Cai dat > Ket tien de chon)' }
  $m = [byte]([int]$cfg.drawerPin -band 1)
  # ESC p m t1 t2 : xung mo ket (t1=25*2ms, t2=250*2ms)
  $bytes = [byte[]](0x1B, 0x70, $m, 0x19, 0xFA)
  return [TramRawPrinter]::Send([string]$cfg.printerName, $bytes)
}

# ---------------- HTTP ----------------
function Send-Json($ctx, [int]$code, $obj, [string]$allowOrigin) {
  $res = $ctx.Response
  $res.StatusCode = $code
  $res.ContentType = 'application/json; charset=utf-8'
  if ($allowOrigin) { $res.AddHeader('Access-Control-Allow-Origin', $allowOrigin); $res.AddHeader('Vary', 'Origin') }
  $res.AddHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  $res.AddHeader('Access-Control-Allow-Headers', 'Content-Type, X-Drawer-Token, X-Owner-Secret, X-Claim')
  $res.AddHeader('Access-Control-Allow-Private-Network', 'true')
  $res.AddHeader('Cache-Control', 'no-store')
  $buf = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 5 -Compress))
  $res.ContentLength64 = $buf.Length
  $res.OutputStream.Write($buf, 0, $buf.Length)
  $res.OutputStream.Close()
}

function Read-Body($ctx) {
  $sr = New-Object System.IO.StreamReader($ctx.Request.InputStream, [System.Text.Encoding]::UTF8)
  $t = $sr.ReadToEnd(); $sr.Close()
  if ([string]::IsNullOrWhiteSpace($t)) { return [pscustomobject]@{} }
  try { return $t | ConvertFrom-Json } catch { return [pscustomobject]@{} }
}

$cfg = Load-Config
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$($cfg.port)/")
try { $listener.Start() }
catch {
  Write-Log "Khong mo duoc cong $($cfg.port): $($_.Exception.Message) (da chay CaiDat.bat bang quyen Admin chua? / phan mem dang chay roi?)"
  exit 1
}
Write-Log "Tram Mo Ket $Version da chay - cong $($cfg.port), may in '$($cfg.printerName)', IP: $((Get-LanIps) -join ', ')"

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  try {
    $req = $ctx.Request
    $path = $req.Url.AbsolutePath.TrimEnd('/').ToLowerInvariant()
    $origin = $req.Headers['Origin']
    $isLocal = [System.Net.IPAddress]::IsLoopback($req.RemoteEndPoint.Address)
    $originAllowed = $origin -and ($cfg.allowedOrigins -contains $origin)
    # Trang khac mo tren laptop KHONG duoc doc ma ghep noi: chi tra CORS cho web Cham Cong
    $corsAdmin = if ($originAllowed) { $origin } else { $null }
    $corsAny = if ($origin) { $origin } else { '*' }

    if ($req.HttpMethod -eq 'OPTIONS') { Send-Json $ctx 200 @{ ok = $true } $corsAny; continue }

    switch ($path) {
      '/status' {
        Send-Json $ctx 200 @{ ok = $true; app = 'TramMoKet'; version = $Version; printer = $cfg.printerName; enabled = [bool]$cfg.enabled } $corsAny
      }
      '/pair' {
        if (-not $isLocal -or -not $originAllowed) { Send-Json $ctx 403 @{ ok = $false; error = 'Chi ghep noi duoc tu web Cham Cong mo tren chinh laptop nay' } $corsAdmin; break }
        $ownerOk = $req.Headers['X-Owner-Secret'] -and $req.Headers['X-Owner-Secret'] -eq $cfg.ownerSecret
        $resp = @{
          ok = $true; version = $Version; token = $cfg.token; port = [int]$cfg.port; lanIps = @(Get-LanIps)
          printer = $cfg.printerName; printers = @(Get-Printers); drawerPin = [int]$cfg.drawerPin; enabled = [bool]$cfg.enabled
          computer = $env:COMPUTERNAME; claimed = [bool]$cfg.claimed; ownerVerified = [bool]$ownerOk
        }
        # Khoa bi mat chi tra cho lan ghep noi DAU TIEN (CHU) hoac khi da chung minh biet khoa
        if ($req.Headers['X-Claim'] -eq '1' -and (-not $cfg.claimed -or $ownerOk)) {
          $resp.ownerSecret = $cfg.ownerSecret
          if (-not $cfg.claimed) { $cfg.claimed = $true; Save-Config $cfg; Write-Log 'Da giao khoa bi mat cho Chu (ghep noi lan dau)' }
        }
        Send-Json $ctx 200 $resp $corsAdmin
      }
      '/config' {
        if ($req.HttpMethod -ne 'POST' -or -not $isLocal -or -not $originAllowed) { Send-Json $ctx 403 @{ ok = $false; error = 'Khong duoc phep' } $corsAdmin; break }
        $b = Read-Body $ctx
        $ownerOk = $req.Headers['X-Owner-Secret'] -and $req.Headers['X-Owner-Secret'] -eq $cfg.ownerSecret
        if ($b.PSObject.Properties.Name -contains 'printerName') { $cfg.printerName = [string]$b.printerName }
        if ($b.PSObject.Properties.Name -contains 'drawerPin') { $cfg.drawerPin = [int]$b.drawerPin }
        # Bat / tat, doi ma ghep noi: chi CHU (biet khoa bi mat)
        if ($b.PSObject.Properties.Name -contains 'enabled' -and $ownerOk) { $cfg.enabled = [bool]$b.enabled }
        if ($b.PSObject.Properties.Name -contains 'newToken' -and $b.newToken -and $ownerOk) { $cfg.token = New-Token }
        Save-Config $cfg
        Write-Log "Doi cau hinh: may in '$($cfg.printerName)', chan $($cfg.drawerPin), bat=$($cfg.enabled)"
        Send-Json $ctx 200 @{ ok = $true; token = $cfg.token; printer = $cfg.printerName; drawerPin = [int]$cfg.drawerPin; enabled = [bool]$cfg.enabled } $corsAdmin
      }
      '/open' {
        if ($req.HttpMethod -ne 'POST') { Send-Json $ctx 405 @{ ok = $false; error = 'Dung POST' } $corsAny; break }
        $tok = $req.Headers['X-Drawer-Token']
        if (-not $tok -or $tok -ne $cfg.token) {
          Write-Log "TU CHOI mo ket: sai ma ghep noi (tu $($req.RemoteEndPoint.Address))"
          Send-Json $ctx 401 @{ ok = $false; error = 'Sai ma ghep noi - hay ghep noi lai tren web' } $corsAny; break
        }
        $b = Read-Body $ctx
        $who = "$($b.by) [$($b.source)] tu $($req.RemoteEndPoint.Address)"
        $otpErr = Check-Otp $cfg ([string]$b.nonce) ([string]$b.otp)
        if ($otpErr) { Write-Log "TU CHOI mo ket ($who): $otpErr"; Send-Json $ctx 403 @{ ok = $false; error = $otpErr; code = 'OTP' } $corsAny; break }
        $err = Open-Drawer $cfg
        if ($err) { Write-Log "LOI mo ket ($who): $err"; Send-Json $ctx 500 @{ ok = $false; error = $err } $corsAny }
        else { Write-Log "Mo ket: $who"; Send-Json $ctx 200 @{ ok = $true; printer = $cfg.printerName } $corsAny }
      }
      default { Send-Json $ctx 404 @{ ok = $false; error = 'Khong co duong dan nay' } $corsAny }
    }
  } catch {
    Write-Log "Loi xu ly yeu cau: $($_.Exception.Message)"
    try { Send-Json $ctx 500 @{ ok = $false; error = $_.Exception.Message } '*' } catch {}
  }
}
