"""
SIDAK API - asisten "Tanya SIDAK" dan penyaji data prakomputasi.

Jalankan:  uvicorn main:app --port 8000 --reload   (dari folder sidak/api)
Butuh ANTHROPIC_API_KEY di lingkungan untuk asisten; tanpa kunci, /api/chat
mengembalikan 503 dan antarmuka jatuh ke jawaban tersimpan.

Prinsip: asisten hanya memanggil alat baca-saja ke tabel indikator yang sama
dengan yang dipakai antarmuka. Tidak ada data baris, tidak ada identitas.
"""
import json, os, re, time
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "web", "public", "data")
DIST = os.path.join(HERE, "..", "web", "dist")
MODEL = os.environ.get("SIDAK_MODEL", "claude-opus-5")
KOTA = "KOTA SEMARANG"
NOMOR = {"rujukan": 3, "severity": 4, "fragmentasi": 9, "readmisi": 16}
NAMA = {"rujukan": "Rujukan tidak sesuai", "severity": "Upcoding severity",
        "fragmentasi": "Fragmentasi layanan", "readmisi": "Readmisi 30 hari"}
STATUS = {"perhatian": "Perlu perhatian", "diamati": "Diamati", "wajar": "Dalam rentang wajar",
          "volume_rendah": "Volume rendah (tidak dinilai)"}

app = FastAPI(title="SIDAK API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ------------------------------------------------------------------ data
class Store:
    def __init__(self):
        self.t = 0
        self.muat()

    def muat(self):
        j = lambda n: json.load(open(os.path.join(DATA, n), encoding="utf-8"))
        self.faskes = j("faskes_jateng.json")
        self.kab = j("kabkota_jateng.json")
        self.ring = j("semarang.json")
        self.demo = j(os.path.join("geo", "kecamatan_demografi.json"))
        self.idx = {f["id"]: f for f in self.faskes}
        self.t = time.time()


S = Store()


def rp(v):
    if v is None:
        return "-"
    a = abs(v)
    if a >= 1e12: return "Rp %s T" % format(v / 1e12, ",.1f").replace(",", "X").replace(".", ",").replace("X", ".")
    if a >= 1e9: return "Rp %s M" % format(v / 1e9, ",.1f").replace(",", "X").replace(".", ",").replace("X", ".")
    if a >= 1e6: return "Rp %s jt" % format(v / 1e6, ",.1f").replace(",", "X").replace(".", ",").replace("X", ".")
    return "Rp %s" % format(round(v), ",").replace(",", ".")


def ringkas_faskes(f, m=None):
    o = {"faskes": f["label"], "tipe": f["tipe"], "kab_kota": f["kab"], "kelas": f["kelas_pendek"], "kepemilikan": f["milik"],
         "selisih_rupiah_sampel": f["rupiah"], "selisih_rupiah_tertimbang": f["rupiah_tertimbang"], "tautan": "/faskes/" + f["id"]}
    mods = [m] if m else list(f["modul"].keys())
    o["modul"] = {}
    for k in mods:
        h = f["modul"].get(k)
        if not h:
            continue
        o["modul"][k] = {"nomor": NOMOR[k], "nama": NAMA[k], "status": STATUS[h["status"]], "stabil_dua_paruh": h["stabil"],
                         "volume": h["n"], "observed": h["O"], "expected": h["E"], "OE": h["OE"], "z": h["z"],
                         "angka_mentah_pct": h["rate"], "selisih_kejadian": h["selisih"],
                         "selisih_rupiah_sampel": h["rupiah"], "selisih_rupiah_tertimbang": h["rupiah_tertimbang"],
                         "penyumbang_terbesar": h.get("kontributor", [])}
        for e in ("pangsa_nonspes", "rate_sebelum_putih", "OE_sebelum_putih", "pangsa_putih"):
            if h.get(e) is not None:
                o["modul"][k][e] = h[e]
    return o


def wilayah_faskes(wilayah):
    w = (wilayah or "semarang").strip().upper()
    if w in ("SEMARANG", "KOTA SEMARANG", ""):
        return [f for f in S.faskes if f["kab"] == KOTA], KOTA
    if w in ("JATENG", "JAWA TENGAH", "PROVINSI"):
        return S.faskes, "JAWA TENGAH"
    kab = next((k for k in S.kab if k == w or k.replace("KOTA ", "") == w.replace("KOTA ", "")), None)
    if kab:
        return [f for f in S.faskes if f["kab"] == kab], kab
    return [f for f in S.faskes if f["kab"] == KOTA], KOTA


# ------------------------------------------------------------------ alat baca-saja
def daftar_temuan(wilayah="semarang", modul=None, status="aktif", urut="rupiah_tertimbang", jumlah=5):
    fs, wil = wilayah_faskes(wilayah)
    rows = []
    for f in fs:
        for k, h in f["modul"].items():
            if modul and k != modul:
                continue
            if status == "aktif" and h["status"] not in ("perhatian", "diamati"):
                continue
            if status in ("perhatian", "diamati", "wajar") and h["status"] != status:
                continue
            rows.append((f, k, h))
    key = {"rupiah_tertimbang": lambda r: r[2]["rupiah_tertimbang"], "rupiah": lambda r: r[2]["rupiah"],
           "OE": lambda r: r[2]["OE"] or 0, "z": lambda r: r[2]["z"] or 0, "volume": lambda r: r[2]["n"]}.get(urut, lambda r: r[2]["rupiah_tertimbang"])
    rows.sort(key=key, reverse=True)
    return {"wilayah": wil, "jumlah_temuan": len(rows),
            "total_selisih_rupiah_sampel": sum(r[2]["rupiah"] for r in rows if r[2]["status"] in ("perhatian", "diamati")),
            "total_selisih_rupiah_tertimbang": sum(r[2]["rupiah_tertimbang"] for r in rows if r[2]["status"] in ("perhatian", "diamati")),
            "temuan": [dict(ringkas_faskes(f, k), modul=ringkas_faskes(f, k)["modul"][k]) for f, k, h in rows[:min(int(jumlah), 20)]],
            "tautan": "/antrean"}


def jelaskan_temuan(faskes, modul=None):
    fid = re.sub(r"^(RS|FKTP)-", "", str(faskes).strip(), flags=re.I)
    f = S.idx.get(fid)
    if not f:
        return {"error": "faskes tidak ditemukan; kode contoh RS-31595"}
    o = ringkas_faskes(f, modul if modul in f["modul"] else None)
    # pembanding sebaya: kelas sama, Jawa Tengah, volume terdekat
    for k in o["modul"]:
        n = f["modul"][k]["n"]
        cand = [x for x in S.faskes if x["id"] != f["id"] and x["tipe"] == f["tipe"] and x["kelas"] == f["kelas"]
                and x["modul"].get(k) and x["modul"][k]["status"] != "volume_rendah"]
        cand.sort(key=lambda x: abs(x["modul"][k]["n"] - n))
        o["modul"][k]["pembanding_sebaya"] = [{"faskes": x["label"], "OE": x["modul"][k]["OE"], "status": STATUS[x["modul"][k]["status"]]} for x in cand[:3]]
    o["bulanan"] = f.get("bulanan", {})
    o["catatan"] = "Indikasi statistik untuk prioritas audit, bukan bukti pelanggaran."
    return o


def ambil_indikator(modul, wilayah="semarang", pecah=None):
    if modul not in NOMOR:
        return {"error": "modul harus salah satu dari: " + ", ".join(NOMOR)}
    fs, wil = wilayah_faskes(wilayah)
    fs = [f for f in fs if f["modul"].get(modul)]
    def agg(g):
        O = sum(f["modul"][modul]["O"] for f in g); E = sum(f["modul"][modul]["E"] for f in g); n = sum(f["modul"][modul]["n"] for f in g)
        return {"faskes": len(g), "faskes_dinilai": sum(f["modul"][modul]["status"] != "volume_rendah" for f in g),
                "perlu_perhatian": sum(f["modul"][modul]["status"] == "perhatian" for f in g),
                "diamati": sum(f["modul"][modul]["status"] == "diamati" for f in g),
                "volume": n, "observed": O, "expected": round(E, 1), "OE": round(O / E, 3) if E else None,
                "angka_mentah_pct": round(O / n * 100, 1) if n else None,
                "selisih_rupiah_sampel": sum(f["modul"][modul]["rupiah"] for f in g if f["modul"][modul]["status"] in ("perhatian", "diamati")),
                "selisih_rupiah_tertimbang": sum(f["modul"][modul]["rupiah_tertimbang"] for f in g if f["modul"][modul]["status"] in ("perhatian", "diamati"))}
    out = {"modul": NAMA[modul], "nomor": NOMOR[modul], "wilayah": wil, "total": agg(fs), "tautan": "/modul/" + modul}
    if pecah in ("kelas", "kepemilikan", "jenis_fktp"):
        kk = "kelas_pendek" if pecah != "kepemilikan" else "milik"
        out["pecah_" + pecah] = {k: agg([f for f in fs if f[kk] == k]) for k in sorted(set(f[kk] for f in fs))}
    if wil == KOTA:
        out["tren_bulanan"] = S.ring["tren"].get(modul)
        out["metrik_model"] = S.ring["metrik"].get(modul)
    return out


def bandingkan_kabkota(modul, urut="OE", jumlah=10):
    if modul not in NOMOR:
        return {"error": "modul tidak dikenal"}
    rows = [(k, v[modul]) for k, v in S.kab.items() if v.get(modul) and v[modul].get("OE") is not None and v[modul]["n_faskes"] > 0]
    rows.sort(key=lambda r: r[1].get(urut) or 0, reverse=True)
    return {"modul": NAMA[modul], "kab_kota": [dict(kab_kota=k, **v) for k, v in rows[:int(jumlah)]], "tautan": "/peta"}


def aliran_pasien(modul="readmisi", jumlah=10):
    a = S.ring["aliran"]
    if modul == "rujukan":
        return {"keterangan": "kunjungan rawat jalan di RS Semarang berperujuk FKTP, menurut kab/kota FKTP terdaftar peserta",
                "asal": a["rujukan"][:int(jumlah)], "tautan": "/peta"}
    return {"keterangan": "rawat inap di RS Semarang menurut kab/kota domisili peserta; O = readmisi, E = wajar",
            "pangsa_luar_kota_ritl_pct": a["pangsa_luar_kota_ritl"], "asal": a["readmisi"][:int(jumlah)], "tautan": "/peta"}


def demografi_kecamatan(urut="penduduk_2025"):
    ks = sorted(S.demo["kecamatan"], key=lambda k: k.get(urut, 0), reverse=True)
    return {"sumber": S.demo["sumber"], "kecamatan": ks, "tautan": "/peta"}


def ringkas_wilayah(wilayah="semarang"):
    fs, wil = wilayah_faskes(wilayah)
    out = {"wilayah": wil, "periode": S.ring["periode"], "faskes_fkrtl": sum(f["tipe"] == "FKRTL" for f in fs),
           "faskes_fktp": sum(f["tipe"] == "FKTP" for f in fs),
           "faskes_perlu_perhatian": sum(f["n_perhatian"] > 0 for f in fs),
           "selisih_rupiah_sampel": sum(f["rupiah"] for f in fs), "selisih_rupiah_tertimbang": sum(f["rupiah_tertimbang"] for f in fs),
           "per_modul": {m: ambil_indikator(m, wilayah)["total"] for m in NOMOR}, "tautan": "/"}
    return out


def metodologi(topik=None):
    return {"kerangka": "O = kejadian nyata; E = jumlah peluang per kejadian dari model/tabel sebaya; O/E; z=(O-E)/sqrt(sum p(1-p)). "
                        "Perlu perhatian bila O/E>1,05 dan z>1,96 dan konsisten di dua paruh periode; Diamati bila melewati sebagian ambang atau tidak konsisten. "
                        "Selisih rupiah=(O-E) x biaya rata-rata per kejadian; tertimbang = dikalikan bobot sampel.",
            "ambang_volume_minimum": S.ring["min_n"], "metrik_model": S.ring["metrik"],
            "data": "Data Sampel BPJS Kesehatan Edisi 2025 (±1% peserta, anonim, kode faskes samaran), klaim 2024. "
                    "Peta: GADM 4.1; titik faskes: OpenStreetMap; demografi: BPS Kota Semarang Dalam Angka 2026.",
            "tautan": "/metodologi"}


ALAT = {
    "daftar_temuan": (daftar_temuan, "Daftar faskes yang ditandai (antrean audit), urut rupiah/O/E/z. Gunakan untuk 'siapa yang paling perlu diperhatikan'.",
                      {"wilayah": {"type": "string", "description": "semarang | jateng | nama kab/kota Jawa Tengah"},
                       "modul": {"type": "string", "enum": list(NOMOR), "description": "kosongkan untuk semua modul"},
                       "status": {"type": "string", "enum": ["aktif", "perhatian", "diamati", "wajar", "semua"]},
                       "urut": {"type": "string", "enum": ["rupiah_tertimbang", "rupiah", "OE", "z", "volume"]},
                       "jumlah": {"type": "integer"}}),
    "jelaskan_temuan": (jelaskan_temuan, "Kartu penjelasan satu faskes: O, E, O/E, z, status, penyumbang, pembanding sebaya, bulanan. Gunakan untuk 'kenapa RS-xxxx ditandai'.",
                        {"faskes": {"type": "string", "description": "kode, mis. RS-31595 atau FKTP-12345"},
                         "modul": {"type": "string", "enum": list(NOMOR)}}),
    "ambil_indikator": (ambil_indikator, "Agregat satu modul untuk suatu wilayah, opsional dipecah per kelas/kepemilikan/jenis FKTP. Termasuk tren bulanan dan metrik model untuk Semarang.",
                        {"modul": {"type": "string", "enum": list(NOMOR)}, "wilayah": {"type": "string"},
                         "pecah": {"type": "string", "enum": ["kelas", "kepemilikan", "jenis_fktp"]}}),
    "bandingkan_kabkota": (bandingkan_kabkota, "Peringkat kabupaten/kota Jawa Tengah untuk satu modul (peta L1).",
                           {"modul": {"type": "string", "enum": list(NOMOR)}, "urut": {"type": "string", "enum": ["OE", "rate", "rupiah_tertimbang", "n_perhatian"]}, "jumlah": {"type": "integer"}}),
    "aliran_pasien": (aliran_pasien, "Asal kab/kota pasien readmisi atau rujukan yang bermuara di RS Kota Semarang (peta L3).",
                      {"modul": {"type": "string", "enum": ["readmisi", "rujukan"]}, "jumlah": {"type": "integer"}}),
    "demografi_kecamatan": (demografi_kecamatan, "Penduduk, kepadatan, jumlah RS/klinik per kecamatan Kota Semarang (data publik BPS/OSM, konteks, bukan hasil deteksi).",
                            {"urut": {"type": "string", "enum": ["penduduk_2025", "kepadatan_2025", "faskes_per_100rb", "rs", "klinik", "pertumbuhan_2020_2025_pct"]}}),
    "ringkas_wilayah": (ringkas_wilayah, "Ringkasan eksekutif satu wilayah: jumlah faskes, yang perlu perhatian, rupiah, per modul.",
                        {"wilayah": {"type": "string"}}),
    "metodologi": (metodologi, "Penjelasan cara hitung O/E, ambang, metrik model, sumber data.", {"topik": {"type": "string"}}),
}

TOOLS = [{"name": n, "description": d, "input_schema": {"type": "object", "properties": p, "additionalProperties": False}} for n, (_, d, p) in ALAT.items()]

SYSTEM = """Anda adalah "Tanya SIDAK", asisten data untuk SIDAK (Sistem Deteksi Dini Pola Klaim Tidak Wajar di Fasilitas Kesehatan), demo untuk Kota Semarang pada Data Sampel BPJS Kesehatan 2024.

Cara kerja SIDAK: setiap faskes dibandingkan dengan rekan sebaya lewat rasio O/E (kejadian nyata dibagi kejadian wajar) dan skor z. Status "Perlu perhatian" bila O/E > 1,05 dan z > 1,96 dan konsisten di dua paruh periode; "Diamati" bila melewati sebagian ambang; "Dalam rentang wajar" bila tidak. Empat modul: #3 Rujukan tidak sesuai (FKTP), #4 Upcoding severity, #9 Fragmentasi layanan (kunjungan ulang <=7 hari), #16 Readmisi 30 hari.

Aturan yang tidak boleh dilanggar:
1. Jawab HANYA dari hasil alat. Setiap angka harus berasal dari alat; jika alat tidak memberi data, katakan "tidak tersedia di data sampel". Jangan mengarang.
2. Jangan pernah memvonis. Jangan gunakan kata "fraud", "curang", "menipu", "pelaku" sebagai simpulan. Gunakan "indikasi statistik", "perlu audit", "menyimpang dari rekan sebaya". Jika ditanya "apakah RS ini fraud", jawab dengan status statistiknya dan tegaskan keputusan ada pada auditor.
3. Tidak ada identitas: data tidak memuat nama dokter, nama peserta, nomor kartu, SEP, maupun nama RS asli (kode faskes samaran). Jika ditanya identitas, tolak singkat dan jelaskan alasannya.
4. Di luar lingkup SIDAK (cuaca, politik, resep obat, hal umum): tolak singkat dan sopan.
5. Bahasa Indonesia baku, ringkas, maksimal ~120 kata kecuali diminta rinci. Format rupiah gaya Indonesia (Rp 1,2 M; Rp 350 jt).
6. Selalu sertakan angka kunci di "angka" dan tautan halaman terkait di "tautan" (jalur relatif dari alat, mis. /faskes/31595, /modul/readmisi, /antrean, /peta, /metodologi).
7. Sebut bahwa rupiah "sampel" adalah nilai pada data sampel dan "tertimbang" adalah estimasi skala populasi bila relevan.

Keluarkan jawaban akhir sebagai JSON persis berbentuk:
{"teks": "...", "angka": [{"label": "...", "nilai": "...", "satuan": ""}], "tautan": [{"label": "...", "url": "/..."}], "sumber": "Data Sampel BPJS 2024, SIDAK"}
Tanpa teks lain di luar JSON."""


# ------------------------------------------------------------------ endpoint
class Chat(BaseModel):
    messages: list[dict[str, Any]]
    halaman: str | None = None


def jalankan_alat(name, args):
    fn = ALAT[name][0]
    try:
        return fn(**{k: v for k, v in (args or {}).items() if v not in (None, "")})
    except TypeError as e:
        return {"error": "argumen tidak valid: %s" % e}


def ekstrak_json(teks):
    m = re.search(r"\{.*\}", teks, re.S)
    if not m:
        return {"teks": teks.strip(), "angka": [], "tautan": []}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {"teks": teks.strip(), "angka": [], "tautan": []}


@app.post("/api/chat")
def chat(req: Chat):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY belum diatur")
    try:
        import anthropic
    except ImportError:
        raise HTTPException(503, "paket anthropic belum terpasang")
    client = anthropic.Anthropic()
    msgs = [{"role": m["role"], "content": m["content"]} for m in req.messages if m.get("content")][-12:]
    if req.halaman:
        msgs[-1] = {"role": "user", "content": msgs[-1]["content"] + f"\n\n(konteks: pengguna sedang membuka halaman {req.halaman})"}
    sistem = [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}]
    log = []
    for _ in range(6):
        kwargs = dict(model=MODEL, max_tokens=2000, system=sistem, tools=TOOLS, messages=msgs)
        if MODEL.startswith("claude-opus-5") or MODEL.startswith("claude-fable"):
            kwargs["thinking"] = {"type": "adaptive"}
            kwargs["output_config"] = {"effort": "low"}
        try:
            resp = client.messages.create(**kwargs)
        except TypeError:
            # SDK lama: parameter thinking/output_config belum dikenal
            kwargs.pop("thinking", None); kwargs.pop("output_config", None)
            resp = client.messages.create(**kwargs)
        if resp.stop_reason == "refusal":
            return {"teks": "Permintaan ini tidak dapat diproses oleh asisten.", "angka": [], "tautan": []}
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            teks = "".join(b.text for b in resp.content if b.type == "text")
            out = ekstrak_json(teks)
            out.setdefault("angka", []); out.setdefault("tautan", [])
            out["alat"] = log
            return out
        msgs.append({"role": "assistant", "content": resp.content})
        hasil = []
        for tu in tool_uses:
            r = jalankan_alat(tu.name, tu.input)
            log.append({"alat": tu.name, "argumen": tu.input})
            hasil.append({"type": "tool_result", "tool_use_id": tu.id, "content": json.dumps(r, ensure_ascii=False, default=str)[:60000]})
        msgs.append({"role": "user", "content": hasil})
    return {"teks": "Asisten tidak selesai menjawab; coba pertanyaan yang lebih spesifik.", "angka": [], "tautan": [], "alat": log}


@app.get("/api/alat/{nama}")
def alat_langsung(nama: str, request: Request):
    """Akses langsung ke alat (untuk pengujian dan pembuatan jawaban cadangan)."""
    if nama not in ALAT:
        raise HTTPException(404, "alat tidak dikenal")
    return jalankan_alat(nama, dict(request.query_params))


@app.get("/api/sehat")
def sehat():
    return {"ok": True, "faskes": len(S.faskes), "model": MODEL, "asisten": bool(os.environ.get("ANTHROPIC_API_KEY"))}


if os.path.isdir(DIST):
    from fastapi.responses import FileResponse
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")
    app.mount("/data", StaticFiles(directory=os.path.join(DIST, "data")), name="data")

    @app.get("/{path:path}")
    def spa(path: str):
        """Aplikasi satu halaman: rute React dilayani index.html."""
        p = os.path.join(DIST, path)
        if path and os.path.isfile(p):
            return FileResponse(p)
        return FileResponse(os.path.join(DIST, "index.html"))
