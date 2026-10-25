# Run on clean Windows 10 / 11 QA VM. Does not start paid provider calls.
[CmdletBinding()]
param([string]$InstallDir=(Join-Path $env:LOCALAPPDATA 'Programs\AIProjectOSPersonal'))
$ErrorActionPreference='Stop';$fail=@()
$paths=@('AI-Project-OS.exe','RUN-WINDOWS.cmd','src\server.mjs','public\index.html','runtime-win-x64\node.exe')
foreach($item in $paths){if(!(Test-Path -LiteralPath (Join-Path $InstallDir $item))){$fail+="Missing: $item"}}
if(!$fail.Count){
 $node=Join-Path $InstallDir 'runtime-win-x64\node.exe'
 $ver=& $node --version
 if($LASTEXITCODE -ne 0 -or $ver -ne 'v22.23.3'){$fail+="Invalid bundled Node: $ver"}
}
$data=Join-Path $env:LOCALAPPDATA 'AIProjectOSPersonal\data'
if(!(Test-Path $data)){Write-Host 'Data dir does not exist yet (normal before first run).' -ForegroundColor Yellow}
if($fail.Count){$fail | ForEach-Object {Write-Error $_};exit 1}
Write-Host 'Static install layout and bundled Node version PASS. Interactive startup/restore/signature STILL REQUIRE MANUAL QA.' -ForegroundColor Green
exit 0
