$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class SidebarWin {
  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$screenWidth  = [SidebarWin]::GetSystemMetrics(0)
$screenHeight = [SidebarWin]::GetSystemMetrics(1)

$width  = 420
$x      = $screenWidth - $width
$y      = 0
$height = $screenHeight

$url    = "file:///C:/Users/ECC/Desktop/Trust%20wallet/index.html"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$profile = Join-Path $env:LOCALAPPDATA "TrustWalletSidebarProfile"

# Already open? Just bring the window to the front.
$existing = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like "*TrustWalletSidebarProfile*" -and $_.CommandLine -like "*--app=*" }
if ($existing) {
  try {
    $proc = Get-Process -Id $existing.ProcessId -ErrorAction Stop
    if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
      [SidebarWin]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
      [SidebarWin]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
      exit 0
    }
  } catch { }
}

Start-Process $chrome -ArgumentList `
  "--user-data-dir=$profile", `
  "--app=`"$url`"", `
  "--window-size=$width,$height", `
  "--window-position=$x,$y"
