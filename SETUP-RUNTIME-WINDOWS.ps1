# Customer-side first-run bootstrap: download official, pinned, SHA-256 verified Node.js.
# Never requires Administrator. Only modifies this application's own runtime-* directory.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Version = '22.23.3'
if ([Environment]::Is64BitOperatingSystem -ne $true) { throw 'Windows 64-bit is required.' }
if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
  $arch = 'arm64'; $sha = '33dad22e4cef5ee8f9fbb1b0d037fdacd0e56d12a4580f0d63f68b894deab535'
} else {
  $arch = 'x64'; $sha = '2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71'
}
$root = $PSScriptRoot
$dest = Join-Path $root "runtime-win-$arch"
$runtime = Join-Path $dest 'node.exe'
if ((Test-Path $runtime) -and (Test-Path (Join-Path $dest 'node_modules/npm/bin/npm-cli.js'))) { Write-Host "Node.js portable + npm exists: $runtime"; exit 0 }
$tmpRoot = Join-Path ([IO.Path]::GetTempPath()) ("aios-node-"+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpRoot | Out-Null
try {
  $file = "node-v$Version-win-$arch.zip"
  $url = "https://nodejs.org/dist/v$Version/$file"
  $archive = Join-Path $tmpRoot $file
  Write-Host "Downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing -TimeoutSec 120
  $actual = (Get-FileHash -Path $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $sha) { throw "SHA256 mismatch. Do NOT run this download. Expected: $sha; actual: $actual" }
  Expand-Archive -Path $archive -DestinationPath (Join-Path $tmpRoot 'unzipped') -Force
  $bundle = Join-Path (Join-Path $tmpRoot 'unzipped') ("node-v$Version-win-$arch")
  if (!(Test-Path (Join-Path $bundle 'node.exe'))) { throw 'Node binary missing inside official archive.' }
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  # Node's official archive includes npm and its JavaScript entry point.
  # Keep the complete verified bundle: copying node.exe alone breaks CLI setup.
  Copy-Item -Path (Join-Path $bundle '*') -Destination $dest -Recurse -Force
  if (!(Test-Path (Join-Path $dest 'node_modules/npm/bin/npm-cli.js'))) { throw 'Portable npm missing.' }
  $reported = & $runtime -v
  if ($reported -ne "v$Version") { Remove-Item $runtime -Force; throw "Unrecognized Node runtime: $reported" }
  Write-Host "Installed portable Node $reported - hash verified." -ForegroundColor Green
} catch {
  Write-Error $_
  exit 1
} finally {
  Remove-Item $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}
