# LOCAL dev script: in-game window and label art -> app-ready slices.
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\prepare-ui-assets.ps1 -SourceDir <folder>
# (Windows PowerShell 5.1.) <folder> holds the raw PNGs named as in $map.
# Output: frontend/assets/anime/ui/
param(
  [Parameter(Mandatory = $true)][string]$SourceDir,
  [string]$OutDir = ""
)
$ErrorActionPreference = "Stop"
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\assets\anime\ui" }
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class UiAssets {
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
  modal    = "u3_dialogtafel"
  title    = "u2_smaragd_banner"
  scoreRow = "u1_antikgold_banner"
  chip     = "u9_pill"
  tile     = "u8_fliese"
  crest    = "u7_lorbeer"
  turn     = "u6_schriftband"
  bid      = "u5_bubble_green"
  contract = "u4_bubble_gold"
}
New-Item -ItemType Directory -Force $OutDir | Out-Null; $OutDir = (Resolve-Path $OutDir).Path
$report = New-Object System.Collections.ArrayList
function Save-Png($bmp, [string]$name) {
  $p = Join-Path $OutDir $name
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  [void]$report.Add(("{0,-26} {1}x{2}  {3} KB" -f $name, $bmp.Width, $bmp.Height, [int]((Get-Item $p).Length / 1KB)))
}
function Get-Prepared([string]$key, [int]$height = 0, [int]$width = 0) {
  $raw = New-Object System.Drawing.Bitmap (Join-Path $SourceDir "$($map[$key]).png")
  $clean = [UiAssets]::Clean($raw, 128, 238)
  if ($height -gt 0) { $h = $height; $w = [int][math]::Round($clean.Width * $height / $clean.Height) }
  else { $w = $width; $h = [int][math]::Round($clean.Height * $width / $clean.Width) }
  $out = [UiAssets]::Resize($clean, $w, $h)
  $raw.Dispose(); $clean.Dispose()
  $out
}
function Save-HSlice($b, [string]$name, [int]$cap) {
  $w = $b.Width; $h = $b.Height
  $p = [UiAssets]::Crop($b, 0, 0, $cap, $h); Save-Png $p "$($name)_l.png"; $p.Dispose()
  # centre: the whole middle part, so its painted gradient meets both caps without a seam
  $p = [UiAssets]::Crop($b, $cap, 0, $w - 2 * $cap, $h); Save-Png $p "$($name)_c.png"; $p.Dispose()
  $p = [UiAssets]::Crop($b, $w - $cap, 0, $cap, $h); Save-Png $p "$($name)_r.png"; $p.Dispose()
  [void]$report.Add("  -> $($name): ${w}x${h}, cap $cap (capRatio $([math]::Round($cap / $h, 4)))")
}

# ---- dialog window: 9-slice with thin uniform edges ----
$b = Get-Prepared "modal" -width 900
# edges and centre keep their full painted area (the interior has a radial
# gradient; a thin strip from the middle would look lighter than the corners)
$w = $b.Width; $h = $b.Height; $c = 120; $mw = $w - 2 * $c; $mh = $h - 2 * $c
$parts = @{
  tl = @(0, 0, $c, $c); tr = @(($w - $c), 0, $c, $c); bl = @(0, ($h - $c), $c, $c); br = @(($w - $c), ($h - $c), $c, $c)
  t = @($c, 0, $mw, $c); b = @($c, ($h - $c), $mw, $c); l = @(0, $c, $c, $mh); r = @(($w - $c), $c, $c, $mh)
  c = @($c, $c, $mw, $mh)
}
foreach ($k in $parts.Keys) { $r = $parts[$k]; $p = [UiAssets]::Crop($b, $r[0], $r[1], $r[2], $r[3]); Save-Png $p "modal_frame_$k.png"; $p.Dispose() }
[void]$report.Add("  -> modal_frame: ${w}x${h}, corner $c")
$b.Dispose()

# ---- 3-slice bands ----
$b = Get-Prepared "title" -height 100; Save-HSlice $b "title_ribbon" 72; $b.Dispose()
$b = Get-Prepared "scoreRow" -height 64; Save-HSlice $b "score_row" 40; $b.Dispose()
$b = Get-Prepared "chip" -height 120; Save-HSlice $b "chat_chip" 66; $b.Dispose()
$b = Get-Prepared "turn" -height 100; Save-HSlice $b "turn_banner" 90; $b.Dispose()

# ---- speech bubbles: 5-slice (cap / stretch / fixed tail / stretch / cap) ----
foreach ($bb in @(@{ key = "bid"; name = "bubble_bid" }, @{ key = "contract"; name = "bubble_contract" })) {
  $b = Get-Prepared $bb.key -height 96
  $w = $b.Width; $h = $b.Height; $cap = 28; $tail = 34; $tx = [int](($w - $tail) / 2)
  $p = [UiAssets]::Crop($b, 0, 0, $cap, $h); Save-Png $p "$($bb.name)_l.png"; $p.Dispose()
  $p = [UiAssets]::Crop($b, $cap, 0, $tx - $cap, $h); Save-Png $p "$($bb.name)_m.png"; $p.Dispose()
  $p = [UiAssets]::Crop($b, $tx + $tail, 0, $w - $cap - $tx - $tail, $h); Save-Png $p "$($bb.name)_mr.png"; $p.Dispose()
  $p = [UiAssets]::Crop($b, $tx, 0, $tail, $h); Save-Png $p "$($bb.name)_tail.png"; $p.Dispose()
  $p = [UiAssets]::Crop($b, $w - $cap, 0, $cap, $h); Save-Png $p "$($bb.name)_r.png"; $p.Dispose()
  # where the body ends and the tail starts (for clipping the tail off)
  $bodyBottom = 0; for ($y = $h - 1; $y -gt 0; $y--) { if ($b.GetPixel([int]($cap + 9), $y).A -gt 200) { $bodyBottom = $y; break } }
  [void]$report.Add("  -> $($bb.name): ${w}x${h}, cap $cap, tail $tail, body ends at y=$bodyBottom ($([math]::Round(($bodyBottom + 1) / $h, 4)))")
  $b.Dispose()
}

# ---- single images ----
$b = Get-Prepared "tile" -width 200; Save-Png $b "emoji_tile.png"; $b.Dispose()
$b = Get-Prepared "crest" -width 180; Save-Png $b "winner_crest.png"; $b.Dispose()
$report
"TOTAL ui: {0} KB" -f [int]((Get-ChildItem $OutDir | Measure-Object Length -Sum).Sum / 1KB)
