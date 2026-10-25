# Installed Windows voices only. No network, registry edits, or voice installation.
# All user text and paths are JSON on stdin, never PowerShell source.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
function Get-Voices {
  $items = @()
  try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
    foreach ($v in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) {
      $items += @{id=('winrt:' + $v.Id); name=$v.DisplayName; culture=$v.Language; enabled=$true; engine='winrt'}
    }
  } catch { }
  $s = $null
  try {
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    foreach ($v in $s.GetInstalledVoices()) {
      $items += @{id=('sapi:' + $v.VoiceInfo.Name); name=$v.VoiceInfo.Name; culture=$v.VoiceInfo.Culture.Name; enabled=$v.Enabled; engine='sapi'}
    }
  } catch { } finally { if ($s) { $s.Dispose() } }
  return $items
}
function Await-WinRT($operation, $resultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and
    $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
  if (-not $method) { throw 'Windows Runtime async bridge unavailable.' }
  $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}
$voices = @(Get-Voices)
if ($payload.mode -eq 'probe') {
  [Console]::WriteLine((ConvertTo-Json -InputObject @($voices) -Depth 5 -Compress))
  exit 0
}
if ($payload.mode -ne 'synthesize') { throw 'Unsupported speech operation.' }
$v = $voices | Where-Object { $_.id -eq $payload.voiceId -and $_.enabled } | Select-Object -First 1
if (-not $v) { throw 'The selected installed Windows voice is no longer available.' }
if ([string]::IsNullOrWhiteSpace($payload.text)) { throw 'Empty speech text.' }
if ($v.engine -eq 'winrt') {
  $s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
  $speech = $null; $stream = $null; $file = $null
  try {
    $rawId = $v.id.Substring(6)
    $s.Voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Id -eq $rawId } | Select-Object -First 1
    $s.Options.SpeakingRate = [double]$payload.rate
    $s.Options.AudioVolume = [double]$payload.volume
    $null = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
    $speech = Await-WinRT ($s.SynthesizeTextToStreamAsync([string]$payload.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($speech.GetInputStreamAt(0))
    $file = [System.IO.File]::Open([string]$payload.output, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
    $stream.CopyTo($file)
  } finally {
    if ($file) { $file.Dispose() }
    if ($stream) { $stream.Dispose() }
    if ($s) { $s.Dispose() }
  }
} else {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $s.SelectVoice([string]$v.name)
    $s.Rate = [int][Math]::Round(([double]$payload.rate - 1.0) * 8.0)
    $s.Volume = [int][Math]::Round([double]$payload.volume * 100)
    $s.SetOutputToWaveFile([string]$payload.output)
    $s.Speak([string]$payload.text)
    $s.SetOutputToNull()
  } finally { $s.Dispose() }
}
[Console]::WriteLine((ConvertTo-Json -InputObject @{ok=$true;voice=$v.name;voiceId=$v.id;engine=$v.engine} -Compress))
