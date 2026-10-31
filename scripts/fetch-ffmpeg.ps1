$ErrorActionPreference = 'Continue'
$tools = '<WORKSPACE>\tools'
$out   = Join-Path $tools 'ffmpeg.zip'
$log   = Join-Path $tools 'ffmpeg-download.log'
$url   = 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip'
$total = 114768076

function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Add-Content -Path $log -Value $line -Encoding utf8
}

Log "start; target=$total bytes; url=$url"

$attempt = 0
while ($true) {
  $attempt++
  $have = if (Test-Path $out) { (Get-Item $out).Length } else { 0 }
  if ($have -ge $total) { Log "size reached $have"; break }
  if ($attempt -gt 400) { Log "giving up after $attempt attempts at $have bytes"; exit 1 }

  Log "attempt $attempt from byte $have"
  $args = @('-L','--ssl-no-revoke','--retry','5','--retry-delay','5','--retry-all-errors',
            '--speed-limit','1024','--speed-time','120',
            '-C','-','-o',$out,$url)
  $null = & curl.exe @args 2>&1
  $code = $LASTEXITCODE
  $now = if (Test-Path $out) { (Get-Item $out).Length } else { 0 }
  Log "curl exit=$code size=$now"

  if ($code -ne 0 -and $now -eq $have) {
    Log "no progress; retrying after 15s (resume kept)"
    Start-Sleep -Seconds 15
  }
}

# validate + extract
Log "validating zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($out)
  $entry = $zip.Entries | Where-Object { $_.FullName -match 'bin/ffmpeg\.exe$' } | Select-Object -First 1
  if (-not $entry) { Log "ffmpeg.exe not found in zip"; $zip.Dispose(); exit 1 }
  $dest = Join-Path $tools 'ffmpeg\bin'
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $dest 'ffmpeg.exe'), $true)
  $probe = $zip.Entries | Where-Object { $_.FullName -match 'bin/ffprobe\.exe$' } | Select-Object -First 1
  if ($probe) { [System.IO.Compression.ZipFileExtensions]::ExtractToFile($probe, (Join-Path $dest 'ffprobe.exe'), $true) }
  $zip.Dispose()
  $exe = Join-Path $dest 'ffmpeg.exe'
  Log ("extracted: " + (Get-Item $exe).Length + " bytes")
  $v = & $exe -version 2>&1 | Select-Object -First 1
  Log "version: $v"
  Log "DONE"
} catch {
  Log ("extract failed: " + $_.Exception.Message)
  exit 1
}
