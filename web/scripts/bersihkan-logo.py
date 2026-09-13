"""Membersihkan logo mentah jadi master ikon.

Jalankan dari folder web/:  python scripts/bersihkan-logo.py
  masuk  : ../sidak-logo.png  (PNG mentah; ada halo abu-abu & lensa semi-transparan)
  keluar : assets/sidak-logo.png (1024², transparan, siap dipakai generate-icons.mjs)

Butuh: pillow, numpy, scipy.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

WEB = Path(__file__).resolve().parent.parent
SRC = WEB.parent / "sidak-logo.png"
DST = WEB / "assets" / "sidak-logo.png"

im = Image.open(SRC).convert("RGBA")
a = np.array(im).astype(np.int16)
rgb, al = a[..., :3], a[..., 3]

# 1) Artwork "tegas" = alpha tinggi; lubang di dalamnya (interior lensa) ikut dipertahankan.
solid = al >= 180
filled = nd.binary_fill_holes(solid)
# Kros terpotong oleh lensa jadi 5 komponen terpisah -> semuanya dipertahankan;
# yang dibuang hanya bercak kecil (< 500 px) sisa noise yang kebetulan pekat.
lab, n = nd.label(filled)
if n > 1:
    sizes = nd.sum(filled, lab, range(1, n + 1))
    besar = {i + 1 for i, s in enumerate(sizes) if s >= 500}
    print("komponen dipertahankan:", len(besar), "dari", n)
    filled = np.isin(lab, list(besar))
# sisakan beberapa piksel tepi supaya antialias tidak tergunting
keep = nd.binary_dilation(filled, iterations=3)

# 2) Halo/noise di luar artwork dibuang total.
al_new = np.where(keep, al, 0)

# 3) Interior translusen (lensa) dikomposit ke putih -> opak, supaya terbaca di latar gelap
#    dan di atas pil teal.
interior = filled & ~solid & (al > 0)
f = (al[interior] / 255.0)[:, None]
rgb[interior] = np.round(rgb[interior] * f + 255 * (1 - f))
al_new[interior] = 255

img = Image.fromarray(np.dstack([rgb, al_new]).astype(np.uint8), "RGBA")

# 4) Crop ke konten, lalu pad jadi bujur sangkar + margin 4%.
bbox = img.getbbox()
img = img.crop(bbox)
w, h = img.size
side = max(w, h)
pad = round(side * 0.04)
canvas = Image.new("RGBA", (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
canvas.paste(img, (pad + (side - w) // 2, pad + (side - h) // 2))
canvas = canvas.resize((1024, 1024), Image.LANCZOS)
DST.parent.mkdir(parents=True, exist_ok=True)
canvas.save(DST, optimize=True)

chk = np.array(canvas)
print("crop bbox:", bbox, "-> keluaran", canvas.size)
print("piksel transparan %%: %.1f" % ((chk[..., 3] == 0).mean() * 100))
print("sisa piksel samar (0<a<32) %%: %.2f" % (((chk[..., 3] > 0) & (chk[..., 3] < 32)).mean() * 100))
print("ditulis:", DST)
