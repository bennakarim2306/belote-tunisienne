# LOCAL dev script: cuts a sticker sheet (default 4 x 2) into 8 files "1_s.png" … "8_s.png"
# (left to right, top row then bottom row) for prepare-stickers.ps1.
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\slice-sticker-sheet.ps1 -Sheet <png> -OutDir <folder>
# Stickers on generated sheets are packed tightly and often poke a few pixels into
# the neighbouring grid cell, so a plain grid cut would slice bits of the neighbours.
# Instead every separate opaque shape is found (connected components on the alpha
# channel) and given to the grid cell that holds its centre; each output contains
# only the shapes of its own cell, on a transparent canvas.
param(
  [Parameter(Mandatory = $true)][string]$Sheet,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Cols = 4,
  [int]$Rows = 2
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class SheetSlicer {
  // returns one bitmap per cell (row-major); report[i] = "components:pixels"
  public static Bitmap[] Slice(Bitmap src, int cols, int rows, int alphaMin, out string[] report) {
    int w = src.Width, h = src.Height;
    Bitmap bmp = src.Clone(new Rectangle(0, 0, w, h), PixelFormat.Format32bppArgb);
    BitmapData d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = d.Stride;
    byte[] px = new byte[stride * h];
    Marshal.Copy(d.Scan0, px, 0, px.Length);
    bmp.UnlockBits(d); bmp.Dispose();
    int[] label = new int[w * h];
    var compCell = new List<int>();
    var stack = new Stack<int>();
    int cw = w / cols, ch = h / rows;
    int n = 0;
    var compPixels = new List<int>();
    for (int i = 0; i < w * h; i++) {
      if (label[i] != 0 || px[(i / w) * stride + (i % w) * 4 + 3] < alphaMin) continue;
      n++; label[i] = n; stack.Push(i);
      long sx = 0, sy = 0; int cnt = 0;
      while (stack.Count > 0) {
        int p = stack.Pop(); int x = p % w, y = p / w;
        sx += x; sy += y; cnt++;
        for (int k = 0; k < 4; k++) {
          int nx = x + (k == 0 ? 1 : k == 1 ? -1 : 0), ny = y + (k == 2 ? 1 : k == 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          int q = ny * w + nx;
          if (label[q] != 0 || px[ny * stride + nx * 4 + 3] < alphaMin) continue;
          label[q] = n; stack.Push(q);
        }
      }
      int cx = (int)(sx / cnt), cy = (int)(sy / cnt);
      int cell = Math.Min(rows - 1, cy / ch) * cols + Math.Min(cols - 1, cx / cw);
      compCell.Add(cell); compPixels.Add(cnt);
    }
    var outs = new Bitmap[cols * rows];
    report = new string[cols * rows];
    for (int c = 0; c < cols * rows; c++) {
      int minX = w, minY = h, maxX = -1, maxY = -1, comps = 0, pix = 0;
      for (int k = 0; k < compCell.Count; k++) if (compCell[k] == c) { comps++; pix += compPixels[k]; }
      for (int i = 0; i < w * h; i++) {
        int l = label[i]; if (l == 0 || compCell[l - 1] != c) continue;
        int x = i % w, y = i / w;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      report[c] = comps + ":" + pix;
      if (maxX < 0) { outs[c] = null; continue; }
      // include the soft (semi-transparent) edge: pixels below alphaMin next to a kept shape
      int bw = maxX - minX + 3, bh = maxY - minY + 3;
      Bitmap o = new Bitmap(bw, bh, PixelFormat.Format32bppArgb);
      BitmapData od = o.LockBits(new Rectangle(0, 0, bw, bh), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      byte[] op = new byte[od.Stride * bh];
      for (int y = minY - 1; y <= maxY + 1; y++) {
        if (y < 0 || y >= h) continue;
        for (int x = minX - 1; x <= maxX + 1; x++) {
          if (x < 0 || x >= w) continue;
          int l = label[y * w + x];
          bool keep = l != 0 && compCell[l - 1] == c;
          if (!keep && l == 0) {
            for (int dy = -1; dy <= 1 && !keep; dy++) for (int dx = -1; dx <= 1 && !keep; dx++) {
              int nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              int nl = label[ny * w + nx];
              if (nl != 0 && compCell[nl - 1] == c) keep = true;
            }
          }
          if (!keep) continue;
          int si = y * stride + x * 4, di = (y - minY + 1) * od.Stride + (x - minX + 1) * 4;
          op[di] = px[si]; op[di + 1] = px[si + 1]; op[di + 2] = px[si + 2]; op[di + 3] = px[si + 3];
        }
      }
      Marshal.Copy(op, 0, od.Scan0, op.Length);
      o.UnlockBits(od);
      outs[c] = o;
    }
    return outs;
  }
  // Fallback for sheets where neighbouring stickers touch: find the cut line near
  // each nominal grid line that crosses the fewest opaque pixels (within +-win).
  public static int[] Seams(Bitmap src, int parts, bool vertical, int bandStart, int bandEnd, int win, int alphaMin) {
    int w = src.Width, h = src.Height;
    BitmapData d = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    byte[] px = new byte[d.Stride * h];
    Marshal.Copy(d.Scan0, px, 0, px.Length);
    int stride = d.Stride;
    src.UnlockBits(d);
    int len = vertical ? w : h;
    int[] cuts = new int[parts + 1];
    cuts[0] = 0; cuts[parts] = len;
    for (int k = 1; k < parts; k++) {
      int nominal = len * k / parts, best = nominal, bestCount = int.MaxValue;
      for (int c = Math.Max(1, nominal - win); c <= Math.Min(len - 2, nominal + win); c++) {
        int count = 0;
        for (int t = bandStart; t < bandEnd; t++) {
          int x = vertical ? c : t, y = vertical ? t : c;
          if (px[y * stride + x * 4 + 3] >= alphaMin) count++;
        }
        // prefer the line closest to the nominal one on ties
        if (count < bestCount || (count == bestCount && Math.Abs(c - nominal) < Math.Abs(best - nominal))) { bestCount = count; best = c; }
      }
      cuts[k] = best;
    }
    return cuts;
  }
  // keep the biggest shape of a crop plus every shape that does not touch the crop edge
  public static Bitmap KeepMain(Bitmap crop, int alphaMin) {
    int w = crop.Width, h = crop.Height;
    Bitmap bmp = crop.Clone(new Rectangle(0, 0, w, h), PixelFormat.Format32bppArgb);
    BitmapData d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = d.Stride; byte[] px = new byte[stride * h];
    Marshal.Copy(d.Scan0, px, 0, px.Length);
    int[] label = new int[w * h]; var sizes = new List<int>(); var edge = new List<bool>(); var st = new Stack<int>(); int n = 0;
    for (int i = 0; i < w * h; i++) {
      if (label[i] != 0 || px[(i / w) * stride + (i % w) * 4 + 3] < alphaMin) continue;
      n++; label[i] = n; st.Push(i); int cnt = 0; bool touches = false;
      while (st.Count > 0) {
        int q = st.Pop(); int x = q % w, y = q / w; cnt++;
        if (x == 0 || y == 0 || x == w - 1 || y == h - 1) touches = true;
        for (int k = 0; k < 4; k++) {
          int nx = x + (k == 0 ? 1 : k == 1 ? -1 : 0), ny = y + (k == 2 ? 1 : k == 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          int r = ny * w + nx; if (label[r] != 0 || px[ny * stride + nx * 4 + 3] < alphaMin) continue;
          label[r] = n; st.Push(r);
        }
      }
      sizes.Add(cnt); edge.Add(touches);
    }
    int main = 0; for (int k = 1; k < sizes.Count; k++) if (sizes[k] > sizes[main]) main = k;
    for (int i = 0; i < w * h; i++) {
      int l = label[i]; int si = (i / w) * stride + (i % w) * 4;
      bool keep = l != 0 && (l - 1 == main || !edge[l - 1]);
      if (!keep && px[si + 3] < alphaMin) {
        // soft edge next to a kept pixel stays; everything else is cleared
        int x = i % w, y = i / w; bool near = false;
        for (int dy = -1; dy <= 1 && !near; dy++) for (int dx = -1; dx <= 1 && !near; dx++) {
          int nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          int nl = label[ny * w + nx]; if (nl != 0 && (nl - 1 == main || !edge[nl - 1])) near = true;
        }
        keep = near;
      }
      if (!keep) { px[si] = 0; px[si + 1] = 0; px[si + 2] = 0; px[si + 3] = 0; }
    }
    Marshal.Copy(px, 0, d.Scan0, px.Length); bmp.UnlockBits(d);
    return bmp;
  }
}
"@
New-Item -ItemType Directory -Force $OutDir | Out-Null
$src = New-Object System.Drawing.Bitmap $Sheet
"sheet {0}x{1}, grid {2}x{3}" -f $src.Width, $src.Height, $Cols, $Rows
$report = $null
$outs = [SheetSlicer]::Slice($src, $Cols, $Rows, 40, [ref]$report)
$src.Dispose()
# Fallback: stickers touching each other merge into one shape, leaving empty cells.
# Then cut along the emptiest lines near the grid instead.
if (($outs | Where-Object { -not $_ }).Count -gt 0) {
  "shapes merge across cells -> cutting along the emptiest lines near the grid instead"
  foreach ($o in $outs) { if ($o) { $o.Dispose() } }
  $src = New-Object System.Drawing.Bitmap $Sheet
  $rowCuts = [SheetSlicer]::Seams($src, $Rows, $false, 0, $src.Width, 80, 40)
  $outs = @(); $report = @()
  for ($r = 0; $r -lt $Rows; $r++) {
    $colCuts = [SheetSlicer]::Seams($src, $Cols, $true, $rowCuts[$r], $rowCuts[$r + 1], 80, 40)
    "  row $($r + 1): y $($rowCuts[$r])-$($rowCuts[$r + 1]), x cuts $($colCuts -join ',')"
    for ($c = 0; $c -lt $Cols; $c++) {
      $rect = New-Object System.Drawing.Rectangle $colCuts[$c], $rowCuts[$r], ($colCuts[$c + 1] - $colCuts[$c]), ($rowCuts[$r + 1] - $rowCuts[$r])
      $crop = $src.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $outs += [SheetSlicer]::KeepMain($crop, 40); $crop.Dispose()
      $report += "seam:$($rect.Width * $rect.Height)"
    }
  }
  $src.Dispose()
}
$sizes = @()
for ($i = 0; $i -lt $outs.Length; $i++) {
  $parts = $report[$i].Split(":")
  if (-not $outs[$i]) { "{0}: EMPTY - no sticker found in this cell" -f ($i + 1); continue }
  $p = Join-Path $OutDir ("{0}_s.png" -f ($i + 1))
  $outs[$i].Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  $sizes += [int]$parts[1]
  "{0} -> {1}  {2}x{3}, {4} shape(s)" -f ($i + 1), (Split-Path $p -Leaf), $outs[$i].Width, $outs[$i].Height, $parts[0]
  $outs[$i].Dispose()
}
# a sticker much smaller than the others usually means a merged or missing one
if ($sizes.Count) {
  $avg = ($sizes | Measure-Object -Average).Average
  for ($i = 0; $i -lt $sizes.Count; $i++) { if ($sizes[$i] -lt 0.45 * $avg -or $sizes[$i] -gt 1.8 * $avg) { "WARNING: sticker {0} size is unusual ({1:N0} px vs avg {2:N0})" -f ($i + 1), $sizes[$i], $avg } }
}
