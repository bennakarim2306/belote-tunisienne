# LOCAL dev script: alert/result emblems cut by slice-sticker-sheet.ps1 -> app assets.
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\prepare-emblems.ps1 -SourceDir <folder>
# <folder> holds <kind>.png (belote, contre, ...). Output: assets/anime/emblems/<kind>.png,
# 384 px square, transparent, content centred. (Windows PowerShell 5.1.)
param([Parameter(Mandatory = $true)][string]$SourceDir)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\assets\anime\emblems"
New-Item -ItemType Directory -Force $out | Out-Null; $out = (Resolve-Path $out).Path
foreach ($f in Get-ChildItem -LiteralPath $SourceDir -Filter *.png) {
  $b = New-Object System.Drawing.Bitmap $f.FullName
  $S = 384; $k = [math]::Min($S / $b.Width, $S / $b.Height); $w = [int]($b.Width * $k); $h = [int]($b.Height * $k)
  $o = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($o)
  $g.InterpolationMode = "HighQualityBicubic"; $g.PixelOffsetMode = "HighQuality"; $g.CompositingQuality = "HighQuality"
  $g.DrawImage($b, [int](($S - $w) / 2), [int](($S - $h) / 2), $w, $h)
  $g.Dispose(); $p = Join-Path $out $f.Name; $o.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $o.Dispose(); $b.Dispose()
  "{0,-18} {1} KB" -f $f.Name, [int]((Get-Item $p).Length / 1KB)
}
