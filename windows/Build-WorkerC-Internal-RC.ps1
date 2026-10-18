# Offline user experience (once installed): Node must be BUNDLED, never downloaded by the consumer.
# This builds an UNSIGNED INTERNAL QA installer. It does not publish, sign, or update.
[CmdletBinding()]
param(
 [string]$SourceRoot=(Split-Path -Parent $PSScriptRoot),
 [string]$ISCC="${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
 [string]$NodeZip="",
 [string]$NodeVersion='22.23.3'
)
$ErrorActionPreference='Stop'
$expectedNode='2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71'
if($NodeVersion -ne '22.23.3'){throw 'Node runtime pin or SHA must be reviewed together.'}
if(!(Test-Path -LiteralPath $ISCC)){throw 'Inno Setup 6 ISCC.exe is required on this Windows build host.'}
$source=(Resolve-Path -LiteralPath $SourceRoot).Path
# Assemble the separate AGPL editor into ONE Windows installer at build time.
# This fails closed when the official release or notices cannot be verified.
& (Join-Path $PSScriptRoot "Prepare-Concat-Bundle.ps1") -SourceRoot $source
if($LASTEXITCODE -and $LASTEXITCODE -ne 0){throw "Concat offline bundle build failed."}

foreach($f in @('src\server.mjs','AI-Project-OS.exe','RUN-WINDOWS.cmd','public\index.html','src\launcher.mjs')){
 if(!(Test-Path -LiteralPath (Join-Path $source $f))){throw "Missing application file: $f"}
}
$staging=Join-Path $env:TEMP ("aios-c-stage-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
try{
 if(!$NodeZip){
  $NodeZip=Join-Path $staging "node-v$NodeVersion-win-x64.zip"
  $url="https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
  Write-Host "Downloading official pinned Node runtime for build host: $url"
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $NodeZip -TimeoutSec 180
 }
 $actual=(Get-FileHash -LiteralPath $NodeZip -Algorithm SHA256).Hash.ToLowerInvariant()
 if($actual -ne $expectedNode){throw "Node official archive SHA256 mismatch: $actual"}
 $payload=Join-Path $staging 'payload'
 New-Item -ItemType Directory -Path $payload | Out-Null
 # Accept only the source tree; never embed generated user work, vaults, or production credentials.
 foreach($item in Get-ChildItem -LiteralPath $source -Force){
  if($item.Name -in @('.git','.data','node_modules','backups','runtime-win-x64','runtime-win-arm64','output')){continue}
  Copy-Item -LiteralPath $item.FullName -Destination $payload -Recurse -Force
 }
 $sensitive=@(Get-ChildItem -LiteralPath $payload -File -Recurse | Where-Object {
  $_.Name -match '^(vault\.enc\.json|projects\.json|\.env(\..*)?|session-\d+\.json)$'
 })
 if($sensitive.Count){throw 'Customer data or credentials found in installer staging; inspect and remove at source.'}
 $runtimeFolder=Join-Path $staging 'runtime_extracted'
 Expand-Archive -LiteralPath $NodeZip -DestinationPath $runtimeFolder
 $sourceRuntime=Join-Path $runtimeFolder "node-v$NodeVersion-win-x64"
 $runtimeDest=Join-Path $payload 'runtime-win-x64'
 Copy-Item -LiteralPath $sourceRuntime -Destination $runtimeDest -Recurse
 $reported=& (Join-Path $runtimeDest 'node.exe') --version
 if($LASTEXITCODE -ne 0 -or $reported -ne "v$NodeVersion"){throw "Staged runtime failed self-test: $reported"}
 # The staged runtime is verified *before* calling the installer compiler.
 $hashes=@(Get-ChildItem -LiteralPath $payload -File -Recurse | Sort-Object FullName | ForEach-Object {
  @{path=$_.FullName.Substring($payload.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
 })
 @{type='INTERNAL_UNSIGNED_QA_PAYLOAD';files=$hashes} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $payload 'QA_PAYLOAD_SHA256.json') -Encoding UTF8
 $receipt=@{version='0.8.5-rc';internalUnsigned=$true;nodeVersion=$NodeVersion;nodeArchiveSha256=$actual;builtAt=(Get-Date).ToUniversalTime().ToString('o')}
 $receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $staging 'QA_BUILD_RECEIPT.json') -Encoding UTF8
 $iss=Join-Path $PSScriptRoot 'WorkerC-Internal-RC.iss'
 & $ISCC "/DPayloadDir=$payload" '/DProductVersion=0.8.5-rc' $iss
 if($LASTEXITCODE -ne 0){throw "ISCC failed with exit code $LASTEXITCODE"}
 $installer=Join-Path $PSScriptRoot 'output\AIProjectOS-0.8.5-rc-UNSIGNED-INTERNAL-RC.exe'
 if(!(Test-Path -LiteralPath $installer)){throw 'Installer output missing after compiler exit.'}
 $sha=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
 Write-Host "INTERNAL QA ONLY (UNSIGNED). Installer SHA256=$sha"
 Write-Host "Installer: $installer"
}finally{
 # Ephemeral build staging only, never a customer data directory.
 if(Test-Path -LiteralPath $staging){Remove-Item -LiteralPath $staging -Recurse -Force}
}
