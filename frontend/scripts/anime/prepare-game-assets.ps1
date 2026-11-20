# LOCAL dev script: raw generated artwork -> app-ready GAME TABLE assets + avatar portraits.
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\prepare-game-assets.ps1 -SourceDir <folder>
# (Windows PowerShell 5.1 — it ships System.Drawing.)
# <folder> must contain the raw PNGs named as in $map / av01_…av12_ below.
# Output: frontend/assets/anime/game/ and frontend/assets/anime/avatars/.
param(
  [Parameter(Mandatory = $true)][string]$SourceDir,
  [string]$AssetsDir = ""
)
$ErrorActionPreference = "Stop"
if (-not $AssetsDir) { $AssetsDir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\assets\anime" }
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class GameAssets {
  // alpha < cut -> fully transparent ; alpha >= solid -> opaque ; result trimmed to content
  public static Bitmap Clean(Bitmap src, int cut, int solid) {
    int w = src.Width, h = src.Height;
    Bitmap bmp = src.Clone(new Rectangle(0, 0, w, h), PixelFormat.Format32bppArgb);
    BitmapData d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    byte[] px = new byte[d.Stride * h];
    Marshal.Copy(d.Scan0, px, 0, px.Length);
    int minX = w, minY = h, maxX = -1, maxY = -1;
    for (int y = 0; y < h; y++) {
      int row = y * d.Stride;
      for (int x = 0; x < w; x++) {
        int i = row + x * 4;
        int a = px[i + 3];
        if (a < cut) { px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0; continue; }
        if (a >= solid) px[i + 3] = 255;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    Marshal.Copy(px, 0, d.Scan0, px.Length);
    bmp.UnlockBits(d);
    Bitmap outp = bmp.Clone(new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1), PixelFormat.Format32bppArgb);
    bmp.Dispose();
    return outp;
  }
  public static Bitmap Resize(Bitmap src, int w, int h) {
    Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.CompositingMode = CompositingMode.SourceCopy;
      g.CompositingQuality = CompositingQuality.HighQuality;
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      using (ImageAttributes ia = new ImageAttributes()) {
        ia.SetWrapMode(WrapMode.TileFlipXY);
        g.DrawImage(src, new Rectangle(0, 0, w, h), 0, 0, src.Width, src.Height, GraphicsUnit.Pixel, ia);
      }
    }
    return dst;
  }
  public static Bitmap Crop(Bitmap src, int x, int y, int w, int h) {
    return src.Clone(new Rectangle(x, y, w, h), PixelFormat.Format32bppArgb);
  }
}
"@

$map = @{
  bg        = "raw_bg_palasthof"
  table     = "raw_kartentisch"
  frame     = "raw_goldrahmen_smaragden"
  nameplate = "raw_smaragd_banner"
  hud       = "raw_smaragd_rahmenplatte"
  btnGreen  = "raw_luxurioeser_smaragd_button"
  btnRed    = "raw_roter_samtknopf"
  btnDark   = "raw_ornamentale_goldene_schaltflaeche"
  icoGreen  = "raw_glaenzender_smaragd_button"
  icoRed    = "raw_roter_goldrahmen_button"
  cardBack  = "raw_card_back"
}
function Load-Raw([string]$name) {
  $p = Join-Path $SourceDir "$name.png"
  if (-not (Test-Path -LiteralPath $p)) { throw "raw asset not found: $p" }
  New-Object System.Drawing.Bitmap $p
}
$gameDir = Join-Path $AssetsDir "game"; $avDir = Join-Path $AssetsDir "avatars"
New-Item -ItemType Directory -Force $gameDir, $avDir | Out-Null
$gameDir = (Resolve-Path $gameDir).Path; $avDir = (Resolve-Path $avDir).Path
$report = New-Object System.Collections.ArrayList
$jpg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]88)
function Save-Png($bmp, [string]$dir, [string]$name) {
  $p = Join-Path $dir $name
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  [void]$report.Add(("{0,-24} {1}x{2}  {3} KB" -f $name, $bmp.Width, $bmp.Height, [int]((Get-Item $p).Length / 1KB)))
}
function Save-Jpg($bmp, [string]$dir, [string]$name) {
  $p = Join-Path $dir $name
  $bmp.Save($p, $jpg, $ep)
  [void]$report.Add(("{0,-24} {1}x{2}  {3} KB" -f $name, $bmp.Width, $bmp.Height, [int]((Get-Item $p).Length / 1KB)))
}
# cleaned + trimmed + resized to a target height (or width)
function Get-Prepared([string]$key, [int]$height = 0, [int]$width = 0) {
  $raw = Load-Raw $map[$key]
  $clean = [GameAssets]::Clean($raw, 128, 238)
  if ($height -gt 0) { $h = $height; $w = [int][math]::Round($clean.Width * $height / $clean.Height) }
  else { $w = $width; $h = [int][math]::Round($clean.Height * $width / $clean.Width) }
  $out = [GameAssets]::Resize($clean, $w, $h)
  $raw.Dispose(); $clean.Dispose()
  $out
}

# ---- background ----
$b = Load-Raw $map.bg; Save-Jpg $b $gameDir "bg_game.jpg"; $b.Dispose()

# ---- table top, seat frame, icon buttons, card back: single images ----
$b = Get-Prepared "table" -width 1200; Save-Png $b $gameDir "table_top.png"; $b.Dispose()
$b = Get-Prepared "frame" -width 360
# measure the transparent hole across the middle row (for the portrait size)
$y = [int]($b.Height / 2); $x0 = -1; $x1 = -1
for ($x = [int]($b.Width * 0.05); $x -lt $b.Width; $x++) { if ($b.GetPixel($x, $y).A -lt 16) { $x0 = $x; break } }
for ($x = [int]($b.Width * 0.95); $x -gt 0; $x--) { if ($b.GetPixel($x, $y).A -lt 16) { $x1 = $x; break } }
[void]$report.Add("  -> seat_frame hole: x $x0..$x1 of $($b.Width) = $([math]::Round(($x1 - $x0) / $b.Width, 3)) of the width")
Save-Png $b $gameDir "seat_frame.png"; $b.Dispose()
$b = Get-Prepared "icoGreen" -width 160; Save-Png $b $gameDir "btn_icon_green.png"; $b.Dispose()
$b = Get-Prepared "icoRed" -width 160; Save-Png $b $gameDir "btn_icon_red.png"; $b.Dispose()
$b = Get-Prepared "cardBack" -width 240; Save-Png $b $gameDir "card_back.png"; $b.Dispose()

# ---- horizontal 3-slices: left cap / stretchable centre / right cap ----
foreach ($s in @(
    @{ key = "nameplate"; name = "nameplate"; height = 96; cap = 62 },
    @{ key = "btnGreen"; name = "btn_green"; height = 120; cap = 92 },
    @{ key = "btnRed"; name = "btn_red"; height = 120; cap = 92 },
    @{ key = "btnDark"; name = "btn_dark"; height = 120; cap = 92 })) {
  $b = Get-Prepared $s.key -height $s.height
  $c = $s.cap; $w = $b.Width; $h = $b.Height
  $p = [GameAssets]::Crop($b, 0, 0, $c, $h); Save-Png $p $gameDir "$($s.name)_l.png"; $p.Dispose()
  $p = [GameAssets]::Crop($b, $c, 0, $w - 2 * $c, $h); Save-Png $p $gameDir "$($s.name)_c.png"; $p.Dispose()
  $p = [GameAssets]::Crop($b, $w - $c, 0, $c, $h); Save-Png $p $gameDir "$($s.name)_r.png"; $p.Dispose()
  [void]$report.Add("  -> $($s.name): ${w}x${h}, cap ${c}px")
  $b.Dispose()
}

# ---- HUD panel: 9-slice with thin uniform edges + separate crest ----
$b = Get-Prepared "hud" -width 900
$w = $b.Width; $h = $b.Height
# the crest sticks out above the frame: find the real top edge at 22% of the width
$xProbe = [int]($w * 0.22); $top = 0
for ($y = 0; $y -lt $h; $y++) { if ($b.GetPixel($xProbe, $y).A -gt 200) { $top = $y; break } }
$body = [GameAssets]::Crop($b, 0, $top, $w, $h - $top)
$bw = $body.Width; $bh = $body.Height; $c = 96; $t = 8
$ex = [int]($bw * 0.25); $ey = [int]($bh * 0.5)
$parts = @{
  tl = @(0, 0, $c, $c); tr = @(($bw - $c), 0, $c, $c); bl = @(0, ($bh - $c), $c, $c); br = @(($bw - $c), ($bh - $c), $c, $c)
  t = @($ex, 0, $t, $c); b = @($ex, ($bh - $c), $t, $c); l = @(0, $ey, $c, $t); r = @(($bw - $c), $ey, $c, $t)
  c = @($ex, $ey, $t, $t)
}
foreach ($k in $parts.Keys) { $r = $parts[$k]; $p = [GameAssets]::Crop($body, $r[0], $r[1], $r[2], $r[3]); Save-Png $p $gameDir "hud_panel_$k.png"; $p.Dispose() }
$cw = [int]($w * 0.2); $ch = $top + 34
$p = [GameAssets]::Crop($b, [int](($w - $cw) / 2), 0, $cw, $ch); Save-Png $p $gameDir "hud_crest.png"; $p.Dispose()
[void]$report.Add("  -> hud_panel: body ${bw}x${bh}, corner ${c}px, frame top at y=$top, crest ${cw}x${ch}")
$body.Dispose(); $b.Dispose()

# ---- 12 portraits: zoom on the face a little, 256 px JPEG ----
foreach ($f in (Get-ChildItem -LiteralPath $SourceDir -Filter "av*_*.png" | Sort-Object Name)) {
  if ($f.BaseName -notmatch "^av(\d+)_") { continue }
  $id = [int]$Matches[1]
  $raw = New-Object System.Drawing.Bitmap $f.FullName
  $side = [int]($raw.Width * 0.82)
  $crop = [GameAssets]::Crop($raw, [int](($raw.Width - $side) / 2), [int]($raw.Height * 0.02), $side, $side)
  $small = [GameAssets]::Resize($crop, 256, 256)
  Save-Jpg $small $avDir "av$id.jpg"
  $raw.Dispose(); $crop.Dispose(); $small.Dispose()
}
$report
"TOTAL game: {0} KB, avatars: {1} KB" -f [int]((Get-ChildItem $gameDir | Measure-Object Length -Sum).Sum / 1KB), [int]((Get-ChildItem $avDir | Measure-Object Length -Sum).Sum / 1KB)
