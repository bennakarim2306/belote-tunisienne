# LOCAL dev script: turns the raw generated artwork into app-ready home assets.
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\prepare-assets.ps1 -SourceDir <folder with the 5 raw images>
# (Windows PowerShell 5.1: it ships System.Drawing; PowerShell 7 cannot compile the helper.)
# Raw files are matched by name fragment (see $map). Output: frontend/assets/anime/home/.
# What it does:
#   - background  -> JPEG (no alpha needed)
#   - button panels -> ragged outer glow removed (alpha binarised), trimmed,
#     scaled to 60 %, cut into 9 slices so corners keep their shape at any size
#   - logo / flag -> faint edge fringe removed, trimmed, resized
param(
  [Parameter(Mandatory = $true)][string]$SourceDir,
  [string]$OutDir = ""
)
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\assets\anime\home" }
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class AnimeAssets {
  // alpha >= solid -> 255 ; alpha < cut -> 0 (rgb cleared) ; in between kept. Returns trimmed copy.
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
      g.SmoothingMode = SmoothingMode.HighQuality;
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
  bg   = "Innenhof"
  hero = "Hero-Panel"
  dark = "Arabesken"
  logo = "Emblem"
  flag = "Goldfransen"
}
function Find-Raw([string]$fragment) {
  $f = Get-ChildItem -LiteralPath $SourceDir -File | Where-Object { $_.Name -like "*$fragment*" } | Select-Object -First 1
  if (-not $f) { throw "raw asset not found: *$fragment*" }
  $f.FullName
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path
$report = @()
function Save-Png($bmp, [string]$name) {
  $p = Join-Path $OutDir $name
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  $script:report += "{0,-22} {1}x{2}  {3} KB" -f $name, $bmp.Width, $bmp.Height, [int]((Get-Item $p).Length / 1KB)
}

# ---- background -> JPEG q88 ----
$bg = New-Object System.Drawing.Bitmap (Find-Raw $map.bg)
$jpg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]88)
$bgPath = Join-Path $OutDir "bg_arena.jpg"
$bg.Save($bgPath, $jpg, $ep)
$report += "{0,-22} {1}x{2}  {3} KB" -f "bg_arena.jpg", $bg.Width, $bg.Height, [int]((Get-Item $bgPath).Length / 1KB)
$bg.Dispose()

# ---- button panels -> cleaned, 60 %, 9 slices ----
# corner = slice size in OUTPUT pixels; must contain the corner ornament
$panels = @(
  @{ key = "hero"; name = "tile_hero"; corner = 100 },
  @{ key = "dark"; name = "tile_dark"; corner = 150 }
)
foreach ($p in $panels) {
  $raw = New-Object System.Drawing.Bitmap (Find-Raw $map[$p.key])
  $clean = [AnimeAssets]::Clean($raw, 238, 238)   # drop the semi-transparent glow entirely
  $w = [int][math]::Round($clean.Width * 0.6); $h = [int][math]::Round($clean.Height * 0.6)
  $small = [AnimeAssets]::Resize($clean, $w, $h)
  $c = $p.corner
  $xs = @(0, $c, ($w - $c)); $ws = @($c, ($w - 2 * $c), $c)
  $ys = @(0, $c, ($h - $c)); $hs = @($c, ($h - 2 * $c), $c)
  $names = @(@("tl", "t", "tr"), @("l", "c", "r"), @("bl", "b", "br"))
  for ($r = 0; $r -lt 3; $r++) {
    for ($k = 0; $k -lt 3; $k++) {
      $s = [AnimeAssets]::Crop($small, $xs[$k], $ys[$r], $ws[$k], $hs[$r])
      Save-Png $s "$($p.name)_$($names[$r][$k]).png"
      $s.Dispose()
    }
  }
  $report += "  -> $($p.name): panel ${w}x${h}, corner ${c}px"
  $raw.Dispose(); $clean.Dispose(); $small.Dispose()
}

# ---- logo + flag -> fringe removed, trimmed, resized ----
foreach ($a in @(@{ key = "logo"; name = "logo_belote_tunisienne.png"; width = 720 }, @{ key = "flag"; name = "flag_banner.png"; width = 240 })) {
  $raw = New-Object System.Drawing.Bitmap (Find-Raw $map[$a.key])
  $clean = [AnimeAssets]::Clean($raw, 96, 240)
  $h = [int][math]::Round($clean.Height * $a.width / $clean.Width)
  $small = [AnimeAssets]::Resize($clean, $a.width, $h)
  Save-Png $small $a.name
  $raw.Dispose(); $clean.Dispose(); $small.Dispose()
}
$report
