"""LOCAL dev script: converts the transparent PNGs of the new design to WebP.

    py -I scripts/anime/to-webp.py <assets/anime> <report.csv> [quality]

WebP keeps the transparency (JPEG cannot) and is about 5 times smaller here.
Writes <name>.webp next to each <name>.png and a report with sizes and the
difference to the original (PSNR in dB over colour and alpha; above ~40 dB the
eye sees no difference). Deleting the PNGs and changing the code references is
a separate step, so nothing breaks if this script stops half-way.
"""
import csv
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

root = Path(sys.argv[1])
report = Path(sys.argv[2])
quality = int(sys.argv[3]) if len(sys.argv) > 3 else 88


def psnr(a: Image.Image, b: Image.Image) -> float:
    diff = ImageChops.difference(a, b)
    mse = sum(v * v for v in ImageStat.Stat(diff).rms) / 4
    return 99.0 if mse == 0 else 20 * math.log10(255 / math.sqrt(mse))


rows = []
for png in sorted(root.rglob("*.png")):
    src = Image.open(png).convert("RGBA")
    out = png.with_suffix(".webp")
    # method 6 = slowest, smallest; alpha kept nearly lossless so cut-out edges stay clean
    src.save(out, "WEBP", quality=quality, method=6, alpha_quality=95, exact=False)
    back = Image.open(out).convert("RGBA")
    # compare only where something is visible (fully transparent pixels may change colour freely)
    mask = src.getchannel("A").point(lambda v: 255 if v > 0 else 0)
    a = Image.new("RGBA", src.size)
    b = Image.new("RGBA", src.size)
    a.paste(src, mask=mask)
    b.paste(back, mask=mask)
    rows.append([str(png.relative_to(root)).replace("\\", "/"), png.stat().st_size, out.stat().st_size, round(psnr(a, b), 1), f"{src.width}x{src.height}"])

with report.open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["file", "png_bytes", "webp_bytes", "psnr_db", "size"])
    w.writerows(rows)

before = sum(r[1] for r in rows)
after = sum(r[2] for r in rows)
worst = sorted(rows, key=lambda r: r[3])[:8]
print(f"{len(rows)} images: {before / 1048576:.1f} MB -> {after / 1048576:.1f} MB")
print("lowest similarity:", ", ".join(f"{r[0]} {r[3]} dB" for r in worst))
