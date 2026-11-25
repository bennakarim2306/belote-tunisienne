# LOCAL dev script: alert/result emblems cut by slice-sticker-sheet.ps1 -> app assets.
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\prepare-emblems.ps1 -SourceDir <folder>
# <folder> holds <kind>.png (belote, contre, ...). Output: assets/anime/emblems/<kind>.png,
# square (-Size, default 384 px), transparent, trimmed, content centred. (Windows PowerShell 5.1.)
param([Parameter(Mandatory = $true)][string]$SourceDir, [int]$Size = 384)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\assets\anime\emblems"
New-Item -ItemType Directory -Force $out | Out-Null; $out = (Resolve-Path $out).Path
foreach ($f in Get-ChildItem -LiteralPath $SourceDir -Filter *.png) {
  $b = New-Object System.Drawing.Bitmap $f.FullName
  # trim to the visible content
  $x0 = $b.Width; $x1 = 0; $y0 = $b.Height; $y1 = 0
  for ($y = 0; $y -lt $b.Height; $y += 2) { for ($x = 0; $x -lt $b.Width; $x += 2) { if ($b.GetPixel($x, $y).A -ge 40) { if ($x -lt $x0) { $x0 = $x }; if ($x -gt $x1) { $x1 = $x }; if ($y -lt $y0) { $y0 = $y }; if ($y -gt $y1) { $y1 = $y } } } }
  $x0 = [math]::Max(0, $x0 - 2); $y0 = [math]::Max(0, $y0 - 2); $x1 = [math]::Min($b.Width - 1, $x1 + 2); $y1 = [math]::Min($b.Height - 1, $y1 + 2)
  $t = $b.Clone((New-Object System.Drawing.Rectangle $x0, $y0, ($x1 - $x0 + 1), ($y1 - $y0 + 1)), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $b.Dispose(); $b = $t
  $S = $Size; $k = [math]::Min($S / $b.Width, $S / $b.Height); $w = [int]($b.Width * $k); $h = [int]($b.Height * $k)
  $o = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($o)
  $g.InterpolationMode = "HighQualityBicubic"; $g.PixelOffsetMode = "HighQuality"; $g.CompositingQuality = "HighQuality"
  $g.DrawImage($b, [int](($S - $w) / 2), [int](($S - $h) / 2), $w, $h)
  $g.Dispose(); $p = Join-Path $out $f.Name; $o.Save($p, [System.Drawing.Imaging.ImageFormat]::Png); $o.Dispose(); $b.Dispose()
  "{0,-18} {1} KB" -f $f.Name, [int]((Get-Item $p).Length / 1KB)
}
