# LOCAL dev script: cuts a 4 x 2 sticker sheet into 8 files "1_s.png" … "8_s.png"
# (left to right, top row then bottom row) for prepare-stickers.ps1.
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\slice-sticker-sheet.ps1 -Sheet <png> -OutDir <folder>
# Reports cells whose content touches a cell border (sticker cut off or overlapping).
param(
  [Parameter(Mandatory = $true)][string]$Sheet,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Cols = 4,
  [int]$Rows = 2
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutDir | Out-Null
$src = New-Object System.Drawing.Bitmap $Sheet
$cw = [int][math]::Floor($src.Width / $Cols); $ch = [int][math]::Floor($src.Height / $Rows)
"sheet {0}x{1}, cell {2}x{3}" -f $src.Width, $src.Height, $cw, $ch
$n = 0
for ($r = 0; $r -lt $Rows; $r++) {
  for ($c = 0; $c -lt $Cols; $c++) {
    $n++
    $cell = $src.Clone((New-Object System.Drawing.Rectangle ($c * $cw), ($r * $ch), $cw, $ch), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    # opaque pixels on the cell border = the sticker probably crosses into a neighbour
    $hits = 0
    for ($x = 0; $x -lt $cw; $x += 3) { if ($cell.GetPixel($x, 0).A -gt 200) { $hits++ }; if ($cell.GetPixel($x, $ch - 1).A -gt 200) { $hits++ } }
    for ($y = 0; $y -lt $ch; $y += 3) { if ($cell.GetPixel(0, $y).A -gt 200) { $hits++ }; if ($cell.GetPixel($cw - 1, $y).A -gt 200) { $hits++ } }
    $p = Join-Path $OutDir ("{0}_s.png" -f $n)
    $cell.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
    "{0} -> {1}{2}" -f $n, (Split-Path $p -Leaf), $(if ($hits -gt 4) { "   WARNING: touches the cell border ($hits samples)" } else { "" })
    $cell.Dispose()
  }
}
$src.Dispose()
