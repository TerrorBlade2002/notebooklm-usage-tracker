param(
  [Parameter(Mandatory = $true)]
  [string]$ExtensionId,

  [string]$HostName = "com.astraglobal.nlm_tracker"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath = Join-Path $scriptDir "get_username.bat"

if (-not (Test-Path $batPath)) {
  throw "get_username.bat not found at: $batPath"
}

$manifestPath = Join-Path $env:LOCALAPPDATA "$HostName.json"
$manifest = @{
  name = $HostName
  description = "NotebookLM Usage Tracker native host"
  path = $batPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

$regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $regPath -Force | Out-Null
New-ItemProperty -Path $regPath -Name "(Default)" -Value $manifestPath -PropertyType String -Force | Out-Null

Write-Host "Installed native host: $HostName"
Write-Host "Manifest: $manifestPath"
Write-Host "Registry:  $regPath"
Write-Host "Allowed origin: chrome-extension://$ExtensionId/"
