# LOCAL dev script: cuts a 4 x 2 sticker sheet along bending lines, for sheets whose stickers touch.
# Prefer this over slice-sticker-sheet.ps1 when that one reports merged shapes (straight cuts clip artwork).
#   powershell.exe -ExecutionPolicy Bypass -File scripts\anime\seam-sticker-sheet.ps1 -Sheet <png> -OutDir <folder>
param([string]$Sheet, [string]$OutDir, [int]$Win = 95)
# winding seam cut: each separating line may bend (dynamic programming) so it only
# crosses opaque pixels where two stickers really touch
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Seam {
  public static string Run(string sheet, string outDir, int win) {
    Bitmap src = new Bitmap(sheet); int w = src.Width, h = src.Height;
    BitmapData d = src.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = d.Stride; byte[] px = new byte[stride*h]; Marshal.Copy(d.Scan0, px, 0, px.Length); src.UnlockBits(d); src.Dispose();
    Func<int,int,int> A = (x,y) => px[y*stride+x*4+3];
    int best = h/2, bc = int.MaxValue;
    for (int y = h/2-60; y <= h/2+60; y++) { int c = 0; for (int x = 0; x < w; x++) if (A(x,y) >= 40) c++; if (c < bc || (c == bc && Math.Abs(y-h/2) < Math.Abs(best-h/2))) { bc = c; best = y; } }
    int[] rows = { 0, best, h }; string rep = "row cut y=" + best + " opaque=" + bc + "\n"; int n = 0;
    for (int r = 0; r < 2; r++) {
      int y0 = rows[r], y1 = rows[r+1], H = y1-y0; int[][] seams = new int[5][];
      seams[0] = new int[H]; seams[4] = new int[H]; for (int i = 0; i < H; i++) seams[4][i] = w;
      for (int k = 1; k < 4; k++) {
        int lo = w*k/4-win, W = 2*win+1; double[,] cost = new double[H,W]; int[,] prev = new int[H,W];
        for (int i = 0; i < H; i++) for (int j = 0; j < W; j++) {
          int a = A(lo+j, y0+i); double c = (a >= 40 ? 50.0 : a*0.05) + 0.002*Math.Abs(j-win);
          if (i == 0) { cost[i,j] = c; continue; }
          double m = double.MaxValue; int mj = j;
          for (int dj = -3; dj <= 3; dj++) { int q = j+dj; if (q < 0 || q >= W) continue; double v = cost[i-1,q] + 0.02*Math.Abs(dj); if (v < m) { m = v; mj = q; } }
          cost[i,j] = c+m; prev[i,j] = mj;
        }
        int e = 0; for (int j = 1; j < W; j++) if (cost[H-1,j] < cost[H-1,e]) e = j;
        seams[k] = new int[H]; int hit = 0; for (int i = H-1; i >= 0; i--) { seams[k][i] = lo+e; if (A(lo+e,y0+i) >= 40) hit++; e = prev[i,e]; }
        rep += "row " + (r+1) + " seam " + k + ": crosses " + hit + " opaque px\n";
      }
      for (int c = 0; c < 4; c++) {
        n++; int minX = w, maxX = -1; for (int i = 0; i < H; i++) { minX = Math.Min(minX, seams[c][i]); maxX = Math.Max(maxX, seams[c+1][i]); }
        int bw = maxX-minX; Bitmap o = new Bitmap(bw, H, PixelFormat.Format32bppArgb);
        BitmapData od = o.LockBits(new Rectangle(0,0,bw,H), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb); byte[] op = new byte[od.Stride*H];
        for (int i = 0; i < H; i++) for (int x = seams[c][i]; x < seams[c+1][i]; x++) { int si = (y0+i)*stride+x*4, di = i*od.Stride+(x-minX)*4; for (int b = 0; b < 4; b++) op[di+b] = px[si+b]; }
        // keep the largest shape; drop stray shapes under 1.5% of it that touch the outer sheet-side bounds
        int[] lab = new int[bw*H]; var sz = new List<int>(); var st = new Stack<int>(); int m2 = 0;
        for (int s = 0; s < bw*H; s++) { if (lab[s] != 0 || op[(s/bw)*od.Stride+(s%bw)*4+3] < 40) continue; m2++; lab[s] = m2; st.Push(s); int cnt = 0;
          while (st.Count > 0) { int q = st.Pop(); cnt++; int x = q%bw, y = q/bw; for (int t = 0; t < 4; t++) { int nx = x+(t==0?1:t==1?-1:0), ny = y+(t==2?1:t==3?-1:0); if (nx<0||ny<0||nx>=bw||ny>=H) continue; int z = ny*bw+nx; if (lab[z]!=0||op[ny*od.Stride+nx*4+3]<40) continue; lab[z]=m2; st.Push(z); } } sz.Add(cnt); }
        int big = 0; foreach (int v in sz) big = Math.Max(big, v); int dropped = 0; foreach (int v in sz) if (v < big*0.004) dropped++;
        for (int s = 0; s < bw*H; s++) { int di = (s/bw)*od.Stride+(s%bw)*4; bool kill = lab[s] != 0 && sz[lab[s]-1] < big*0.004; if (kill) op[di]=op[di+1]=op[di+2]=op[di+3]=0; }
        Marshal.Copy(op,0,od.Scan0,op.Length); o.UnlockBits(od); o.Save(System.IO.Path.Combine(outDir, n+"_s.png"), ImageFormat.Png); o.Dispose();
        rep += "  sticker " + n + ": " + sz.Count + " shapes, dropped " + dropped + "\n";
      }
    }
    return rep;
  }
}
"@
New-Item -ItemType Directory -Force $OutDir | Out-Null
[Seam]::Run($Sheet, $OutDir, $Win)
