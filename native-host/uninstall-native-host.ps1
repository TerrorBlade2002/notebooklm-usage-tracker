param(
  [string]$HostName = "com.astraglobal.nlm_tracker"
)

$ErrorActionPreference = "Stop"

$manifestPath = Join-Path $env:LOCALAPPDATA "$HostName.json"
$regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

if (Test-Path $regPath) {
  Remove-Item -Path $regPath -Recurse -Force
  Write-Host "Removed registry key: $regPath"
}

if (Test-Path $manifestPath) {
  Remove-Item -Path $manifestPath -Force
  Write-Host "Removed manifest: $manifestPath"
}

Write-Host "Native host uninstall complete."
