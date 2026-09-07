"""
Menyiapkan lapisan geospasial dan demografi terbuka untuk demo SIDAK.

Masukan (diunduh terpisah, lihat sumber_data_terbuka.md):
  geo/gadm2.zip  - GADM 4.1 level 2 (kabupaten/kota) Indonesia
  geo/gadm3.zip  - GADM 4.1 level 3 (kecamatan) Indonesia
  geo/osm.json   - hasil Overpass: amenity=hospital|clinic|doctors di Kota Semarang
Keluaran (sidak/web/public/data/geo):
  jateng_kabkota.geojson, semarang_kecamatan.geojson, faskes_osm.geojson,
  kecamatan_demografi.json
"""
import json, os, re, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "geo")
OUT = os.path.join(HERE, "..", "web", "public", "data", "geo")
os.makedirs(OUT, exist_ok=True)


def sp(s):
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s).upper()


def nama_kab(p):
    n = sp(p["NAME_2"])
    if p.get("TYPE_2") == "Kota" and not n.startswith("KOTA "):
        n = "KOTA " + n
    return n


def bulatkan(geom, nd=4):
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    geom["coordinates"] = r(geom["coordinates"])
    return geom


# ---------------------------------------------------------------- L1 kab/kota
with zipfile.ZipFile(os.path.join(SRC, "gadm2.zip")) as f:
    d2 = json.load(f.open(f.namelist()[0]))
feats = []
for x in d2["features"]:
    p = x["properties"]
    if p["NAME_1"] != "JawaTengah" or p.get("TYPE_2") not in ("Kabupaten", "Kota"):
        continue
    feats.append({"type": "Feature", "geometry": bulatkan(x["geometry"]),
                  "properties": {"kab": nama_kab(p), "kode_bps": p["CC_2"],
                                 "tipe": p["TYPE_2"]}})
json.dump({"type": "FeatureCollection", "features": feats},
          open(os.path.join(OUT, "jateng_kabkota.geojson"), "w"), separators=(",", ":"))
print("L1 kab/kota Jawa Tengah:", len(feats))

# ---------------------------------------------------------------- L2 kecamatan
with zipfile.ZipFile(os.path.join(SRC, "gadm3.zip")) as f:
    d3 = json.load(f.open(f.namelist()[0]))
kec = []
for x in d3["features"]:
    p = x["properties"]
    if p.get("NAME_1") == "JawaTengah" and p.get("NAME_2") == "KotaSemarang":
        kec.append({"type": "Feature", "geometry": bulatkan(x["geometry"]),
                    "properties": {"kecamatan": sp(p["NAME_3"]).title(),
                                   "kode_bps": p["CC_3"]}})
json.dump({"type": "FeatureCollection", "features": kec},
          open(os.path.join(OUT, "semarang_kecamatan.geojson"), "w"), separators=(",", ":"))
print("L2 kecamatan Kota Semarang:", len(kec))

# ---------------------------------------------------------------- demografi
# Sumber: BPS, "Kota Semarang Dalam Angka 2026" (27 Feb 2026), via en.wikipedia.org/wiki/Semarang
# kolom: luas km2, sensus 2010, sensus 2020, proyeksi 2025
DEMO = {
    "Mijen": (56.52, 55708, 80906, 96357), "Gunungpati": (58.27, 88444, 98023, 102429),
    "Banyumanik": (29.74, 136368, 142076, 144087), "Gajahmungkur": (9.34, 59911, 56232, 56328),
    "Semarang Selatan": (5.95, 69617, 62030, 61981), "Candisari": (6.40, 75879, 75456, 75396),
    "Tembalang": (39.47, 159849, 189680, 204865), "Pedurungan": (21.11, 180468, 193151, 198452),
    "Genuk": (25.98, 92314, 123310, 141033), "Gayamsari": (6.22, 71767, 70261, 70381),
    "Semarang Timur": (5.42, 74782, 66302, 66482), "Semarang Utara": (11.39, 117836, 117605, 117865),
    "Semarang Tengah": (5.17, 60312, 55064, 55213), "Semarang Barat": (21.68, 154878, 148879, 149357),
    "Tugu": (28.13, 29436, 32822, 34398), "Ngaliyan": (42.99, 128415, 141727, 147797),
}

# ---------------------------------------------------------------- faskes OSM
o = json.load(open(os.path.join(SRC, "osm.json"), encoding="utf-8"))
pts = []
for e in o["elements"]:
    t = e.get("tags", {})
    lon = e.get("lon") or e.get("center", {}).get("lon")
    lat = e.get("lat") or e.get("center", {}).get("lat")
    if lon is None or not t.get("name"):
        continue
    nm = t["name"]
    am = t["amenity"]
    if am == "hospital" and not re.search(r"rumah\s*sakit|\bRS|hospital|RSUD|RSI|RSIA|RSKB|SMC", nm, re.I):
        continue  # buang poligon bangunan/paviliun yang ikut tertandai hospital
    pts.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
                "properties": {"nama": nm, "jenis": am, "osm_id": e["id"]}})


def dalam(pt, ring):
    x, y = pt
    n = len(ring)
    ins = False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi):
            ins = not ins
        j = i
    return ins


def kec_dari_titik(c):
    for k in kec:
        g = k["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            if dalam(c, poly[0]):
                return k["properties"]["kecamatan"]
    return None


for p in pts:
    p["properties"]["kecamatan"] = kec_dari_titik(p["geometry"]["coordinates"])
json.dump({"type": "FeatureCollection", "features": pts},
          open(os.path.join(OUT, "faskes_osm.geojson"), "w", encoding="utf-8"), ensure_ascii=False)
from collections import Counter
print("titik faskes OSM:", len(pts), Counter(p["properties"]["jenis"] for p in pts))

demo = []
for k in kec:
    nm = k["properties"]["kecamatan"]
    luas, p10, p20, p25 = DEMO[nm]
    fk = [p for p in pts if p["properties"]["kecamatan"] == nm]
    demo.append({"kecamatan": nm, "kode_bps": k["properties"]["kode_bps"], "luas_km2": luas,
                 "penduduk_2020": p20, "penduduk_2025": p25,
                 "kepadatan_2025": round(p25 / luas),
                 "pertumbuhan_2020_2025_pct": round((p25 / p20 - 1) * 100, 1),
                 "rs": sum(p["properties"]["jenis"] == "hospital" for p in fk),
                 "klinik": sum(p["properties"]["jenis"] in ("clinic", "doctors") for p in fk),
                 "faskes_per_100rb": round(len(fk) / p25 * 1e5, 1)})
json.dump({"sumber": {"demografi": "BPS, Kota Semarang Dalam Angka 2026 (via Wikipedia, diakses 5 Sep 2026)",
                      "faskes": "© OpenStreetMap contributors (Overpass API, diakses 5 Sep 2026)",
                      "batas": "GADM 4.1 (gadm.org), pemakaian non-komersial"},
           "kecamatan": demo},
          open(os.path.join(OUT, "kecamatan_demografi.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("demografi kecamatan ditulis; total penduduk 2025:", sum(d["penduduk_2025"] for d in demo))
