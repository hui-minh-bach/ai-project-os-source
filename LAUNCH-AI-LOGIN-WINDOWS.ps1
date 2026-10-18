param([ValidateSet('claude','gemini')][string]$Kind)
$ErrorActionPreference = 'Stop'
$scriptName = if($Kind -eq 'claude') {'LOGIN-CLAUDE-WINDOWS.cmd'} else {'LOGIN-GEMINI-WINDOWS.cmd'}
$script = Join-Path $PSScriptRoot $scriptName
if(!(Test-Path $script)) { throw 'Missing login script' }
Start-Process -FilePath $script -WorkingDirectory $PSScriptRoot
Write-Host 'Opened official CLI login in a new window.'
