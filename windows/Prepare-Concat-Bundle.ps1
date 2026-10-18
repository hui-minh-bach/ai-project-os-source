# Build-host action only: produce an OFFLINE, hash-pinned Concat payload.
# End users never run this script. Do not distribute an unsigned build as commercial-ready.
[CmdletBinding()]
param([string]$SourceRoot=(Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$version='0.2.7'
$file='Concat-0.2.7-windows-x86_64-setup.exe'
$expected='305e833449c24c234c935244debd339a4ba25866fe5787c744f374c7ee5b9687'
$dir=Join-Path $SourceRoot 'vendor\concat'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$dest=Join-Path $dir $file
function DownloadPinned($url,$dest,$hash){
  if(Test-Path -LiteralPath $dest){
    $got=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
    if($got -eq $hash){return}
    throw "Existing Concat file has incorrect SHA-256: $dest"
  }
  $tmp="$dest.$([guid]::NewGuid().ToString('N')).partial"
  try{
    Write-Host "Fetching pinned upstream Concat package: $url"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp -TimeoutSec 900
    $got=(Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash.ToLowerInvariant()
    if($got -ne $hash){throw "Concat hash mismatch (refusing to package): $got"}
    Move-Item -LiteralPath $tmp -Destination $dest
  } finally {Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}
}
DownloadPinned "https://github.com/jub0t/Concat/releases/download/v$version/$file" $dest $expected
# License/source obligations: the source archive, license and third-party notices
# accompany the separate Concat installer in the distributable offline bundle.
$files=@{
  'Concat-LICENSE.txt'="https://raw.githubusercontent.com/jub0t/Concat/v$version/LICENSE";
  'Concat-THIRD_PARTY_NOTICES.md'="https://raw.githubusercontent.com/jub0t/Concat/v$version/THIRD_PARTY_NOTICES.md";
  'Concat-SOURCE-v0.2.7.zip'="https://github.com/jub0t/Concat/archive/refs/tags/v$version.zip"
}
foreach($name in $files.Keys){
  $output=Join-Path $dir $name
  if(!(Test-Path -LiteralPath $output)){
    $temp="$output.download"
    try{Invoke-WebRequest -UseBasicParsing -Uri $files[$name] -OutFile $temp -TimeoutSec 900
      if((Get-Item -LiteralPath $temp).Length -lt 1024){throw "Upstream license/source download too small: $name"}
      Move-Item -LiteralPath $temp -Destination $output
    }finally{Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}
  }
}
$receipt=@{project='Concat';version=$version;license='AGPL-3.0-or-later';source='https://github.com/jub0t/Concat/tree/v0.2.7';sha256=$expected;installer=$file;
  installMode='distinct AGPL program installed alongside AI Project OS';stagedSource='Concat-SOURCE-v0.2.7.zip'}
$receipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $dir 'BUNDLE-RECEIPT.json') -Encoding UTF8
Write-Host "Concat $version bundled for OFFLINE INSTALL (checksum verified)."
