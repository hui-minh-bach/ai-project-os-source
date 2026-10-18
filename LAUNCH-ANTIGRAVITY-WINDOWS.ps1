$ErrorActionPreference='Stop'
$launcher=Join-Path $PSScriptRoot 'LOGIN-ANTIGRAVITY-WINDOWS.cmd'
if (!(Test-Path -LiteralPath $launcher)) { throw 'Missing Antigravity launcher' }
Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d','/c',('"'+$launcher+'"')) -WorkingDirectory $PSScriptRoot
Write-Host 'Opened official Google Antigravity CLI login.'
