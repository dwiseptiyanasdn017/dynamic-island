# Membaca info media yang sedang diputar (Spotify, YouTube di browser, Windows Media Player, dll.)
# lewat Windows System Media Transport Controls, dan status layar penuh/presentasi,
# lalu mencetak 1 baris JSON setiap ada perubahan: {"media":{...},"layar":N}
# layar = SHQueryUserNotificationState: 1 normal, 2 aplikasi layar penuh, 3 game/video layar penuh, 4 mode presentasi, 5 jam tenang
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DiLayar {
  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
  public static int Status() { int s; return SHQueryUserNotificationState(out s) == 0 ? s : 0; }
}
'@

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, [Type]$type) {
  $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $t.Wait(3000)
  return $t.Result
}

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgrType  = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]

$mgr = $null
try { $mgr = Await ($mgrType::RequestAsync()) $mgrType } catch { $mgr = $null }

$last = ''
while ($true) {
  $out = @{ ada = $false }
  if (-not $mgr) { $out = @{ ada = $false; galat = 'Info musik tidak tersedia di Windows ini' } }
  $s = $null
  if ($mgr) { $s = $mgr.GetCurrentSession() }
  if ($s) {
    $p = Await ($s.TryGetMediaPropertiesAsync()) $propType
    $info = $s.GetPlaybackInfo()
    $out = @{
      ada    = $true
      judul  = [string]$p.Title
      artis  = [string]$p.Artist
      album  = [string]$p.AlbumTitle
      app    = [string]$s.SourceAppUserModelId
      status = [string]$info.PlaybackStatus
    }
  }
  $json = @{ media = $out; layar = [DiLayar]::Status() } | ConvertTo-Json -Compress -Depth 4
  if ($json -ne $last) {
    Write-Output $json
    [Console]::Out.Flush()
    $last = $json
  }
  Start-Sleep -Milliseconds 1500
}
