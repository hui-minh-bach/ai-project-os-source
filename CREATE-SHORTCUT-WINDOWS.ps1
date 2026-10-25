$ErrorActionPreference='Stop'
$menu=Join-Path ([Environment]::GetFolderPath('Programs')) 'AI Project OS Personal.lnk'
$client=New-Object -ComObject WScript.Shell
$shortcut=$client.CreateShortcut($menu)
$shortcut.TargetPath=Join-Path $PSScriptRoot 'RUN-WINDOWS.cmd'
$shortcut.WorkingDirectory=$PSScriptRoot
$shortcut.Description='AI Project OS Personal Edition - chạy riêng trên máy'
$shortcut.IconLocation=Join-Path $env:SystemRoot 'System32\SHELL32.dll'
$shortcut.Save()
Write-Host "Da tao shortcut trong Start Menu: $menu"
