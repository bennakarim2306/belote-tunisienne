# LOCAL dev script: art set "v2" (caricature portraits + classic French court halves).
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\prepare-v2-assets.ps1 -SourceDir <folder>
# (Windows PowerShell 5.1 — it ships System.Drawing.)
# <folder> holds av01_*.png … av12_*.png and raw_classic_{jack,queen,king}.png.
# Output: frontend/assets/anime/avatars-v2/ and frontend/assets/anime/cards/classic_*.png.
# The v1 set (painted portraits, painted court figures) is left untouched.
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
public static class V2Assets {
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
$avDir = Join-Path $AssetsDir "avatars-v2"; $cardsDir = Join-Path $AssetsDir "cards"
New-Item -ItemType Directory -Force $avDir, $cardsDir | Out-Null
$avDir = (Resolve-Path $avDir).Path; $cardsDir = (Resolve-Path $cardsDir).Path
$jpg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]88)

# ---- 12 caricature portraits: slight centre zoom, 256 px JPEG ----
foreach ($f in (Get-ChildItem -LiteralPath $SourceDir -Filter "av*_*.png" | Sort-Object Name)) {
  if ($f.BaseName -notmatch "^av(\d+)_") { continue }
  $id = [int]$Matches[1]
  $raw = New-Object System.Drawing.Bitmap $f.FullName
  $side = [int]($raw.Width * 0.86)
  $crop = [V2Assets]::Crop($raw, [int](($raw.Width - $side) / 2), [int]($raw.Height * 0.02), $side, $side)
  $small = [V2Assets]::Resize($crop, 256, 256)
  $p = Join-Path $avDir "av$id.jpg"; $small.Save($p, $jpg, $ep)
  "{0,-26} 256x256  {1} KB" -f "avatars-v2/av$id.jpg", [int]((Get-Item $p).Length / 1KB)
  $raw.Dispose(); $crop.Dispose(); $small.Dispose()
}

# ---- classic court halves: cleaned, trimmed, 420 px wide PNG ----
foreach ($c in @("jack", "queen", "king")) {
  $raw = New-Object System.Drawing.Bitmap (Join-Path $SourceDir "raw_classic_$c.png")
  $clean = [V2Assets]::Clean($raw, 128, 238)
  $w = 420; $h = [int][math]::Round($clean.Height * $w / $clean.Width)
  $small = [V2Assets]::Resize($clean, $w, $h)
  $p = Join-Path $cardsDir "classic_$c.png"; $small.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  "{0,-26} {1}x{2}  {3} KB  aspect {4}" -f "cards/classic_$c.png", $w, $h, [int]((Get-Item $p).Length / 1KB), [math]::Round($w / $h, 4)
  $raw.Dispose(); $clean.Dispose(); $small.Dispose()
}
