"""
Membuat jawaban tersimpan (mode luring) untuk Tanya SIDAK dari alat yang sama
dengan yang dipakai asisten, tanpa LLM. Keluaran: web/public/data/jawaban_cadangan.json

Jalankan: python buat_cadangan.py   (dari folder sidak/api, setelah pipeline)
"""
import json, os
import main as M

OUT = os.path.join(M.DATA, "jawaban_cadangan.json")
rp, NAMA, NOMOR = M.rp, M.NAMA, M.NOMOR
J = []


def tambah(tanya, teks, angka=(), tautan=()):
    J.append({"tanya": tanya, "jawab": {"teks": teks, "angka": [{"label": a[0], "nilai": a[1]} for a in angka],
                                         "tautan": [{"label": t[0], "url": t[1]} for t in tautan],
                                         "sumber": "Data Sampel BPJS Kesehatan 2024, SIDAK"}})


def pct(v):
    return "-" if v is None else ("%s%%" % format(v, ".1f").replace(".", ","))


def oe(v):
    return "-" if v is None else format(v, ".2f").replace(".", ",")


# 1. siapa paling perlu diperhatikan
t = M.daftar_temuan("semarang", None, "aktif", "rupiah_tertimbang", 3)
top = t["temuan"]
kal = "; ".join("%s (%s, %s) pada modul #%d %s dengan O/E %s dan selisih %s tertimbang" % (
    x["faskes"], x["kelas"], x["kepemilikan"], x["modul"]["nomor"], x["modul"]["nama"], oe(x["modul"]["OE"]), rp(x["modul"]["selisih_rupiah_tertimbang"])) for x in top)
tambah("RS mana yang paling perlu diperhatikan di Semarang dan berapa rupiahnya?",
       "Tiga temuan dengan selisih terbesar di Kota Semarang: %s. Total %d temuan berstatus perlu perhatian atau diamati, dengan selisih %s pada sampel (≈ %s tertimbang). Ini indikasi statistik untuk prioritas audit, bukan bukti pelanggaran." % (
           kal, t["jumlah_temuan"], rp(t["total_selisih_rupiah_sampel"]), rp(t["total_selisih_rupiah_tertimbang"])),
       [("temuan aktif", str(t["jumlah_temuan"])), ("selisih sampel", rp(t["total_selisih_rupiah_sampel"])), ("tertimbang", rp(t["total_selisih_rupiah_tertimbang"]))],
       [("Antrean audit", "/antrean")] + [(x["faskes"], x["tautan"]) for x in top])
tambah("Urutkan tiga temuan terbesar dan alasannya",
       "Urutan menurut selisih rupiah tertimbang: %s. Ketiganya melewati ambang ganda O/E > 1,05 dan z > 1,96." % kal,
       [(x["faskes"], oe(x["modul"]["OE"])) for x in top], [("Antrean audit", "/antrean")])

# 2. total rupiah semua modul
r = M.ringkas_wilayah("semarang")
pm = r["per_modul"]
tambah("Berapa estimasi selisih rupiah semua modul di Semarang?",
       "Selisih rupiah faskes yang ditandai di Kota Semarang berjumlah %s pada data sampel, atau sekitar %s setelah dibobot ke populasi peserta. Rinciannya: rujukan %s, severity %s, fragmentasi %s, readmisi %s (tertimbang). Angka tertimbang adalah orde besaran, bukan nilai pasti." % (
           rp(r["selisih_rupiah_sampel"]), rp(r["selisih_rupiah_tertimbang"]), rp(pm["rujukan"]["selisih_rupiah_tertimbang"]),
           rp(pm["severity"]["selisih_rupiah_tertimbang"]), rp(pm["fragmentasi"]["selisih_rupiah_tertimbang"]), rp(pm["readmisi"]["selisih_rupiah_tertimbang"])),
       [("sampel", rp(r["selisih_rupiah_sampel"])), ("tertimbang", rp(r["selisih_rupiah_tertimbang"]))], [("Beranda", "/")])
tambah("Ringkas kondisi Kota Semarang dalam tiga kalimat",
       "Dari %d RS dan %d FKTP di Kota Semarang, %d faskes berstatus perlu perhatian pada setidaknya satu modul. Selisih yang ditandai mencapai %s pada sampel (≈ %s tertimbang). Modul dengan faskes perlu perhatian terbanyak: %s." % (
           r["faskes_fkrtl"], r["faskes_fktp"], r["faskes_perlu_perhatian"], rp(r["selisih_rupiah_sampel"]), rp(r["selisih_rupiah_tertimbang"]),
           max(pm, key=lambda k: pm[k]["perlu_perhatian"])),
       [("RS", str(r["faskes_fkrtl"])), ("FKTP", str(r["faskes_fktp"])), ("perlu perhatian", str(r["faskes_perlu_perhatian"]))], [("Beranda", "/")])
tambah("Berapa faskes yang statusnya perlu perhatian per modul?",
       "; ".join("#%d %s: %d perlu perhatian, %d diamati dari %d dinilai" % (NOMOR[k], NAMA[k], pm[k]["perlu_perhatian"], pm[k]["diamati"], pm[k]["faskes_dinilai"]) for k in NOMOR) + ".",
       [(NAMA[k], str(pm[k]["perlu_perhatian"])) for k in NOMOR], [("Antrean audit", "/antrean")])

# 3. kab/kota readmisi tertinggi
b = M.bandingkan_kabkota("readmisi", "OE", 5)["kab_kota"]
tambah("Kabupaten mana di Jawa Tengah dengan O/E readmisi tertinggi?",
       "Lima kabupaten/kota Jawa Tengah dengan O/E readmisi tertinggi: %s. O/E di atas 1 berarti readmisi lebih banyak daripada wajar menurut bauran kasusnya." % "; ".join(
           "%s %s (%d faskes dinilai, %d perlu perhatian)" % (x["kab_kota"].title(), oe(x["OE"]), x["n_faskes"], x["n_perhatian"]) for x in b),
       [(x["kab_kota"].title(), oe(x["OE"])) for x in b], [("Peta L1", "/peta")])

# 4. aliran
a = M.aliran_pasien("readmisi", 5)
tambah("Dari kabupaten mana pasien readmisi di Semarang paling banyak berasal?",
       "Sebanyak %s rawat inap di RS Semarang adalah peserta berdomisili luar kota. Asal terbanyak: %s." % (
           pct(a["pangsa_luar_kota_ritl_pct"]), "; ".join("%s (%d admisi, readmisi %d vs wajar %s)" % (x["asal"].title(), x["n"], x["O"], format(x["E"], ".1f").replace(".", ",")) for x in a["asal"])),
       [(x["asal"].title(), str(x["n"])) for x in a["asal"]], [("Peta L3 aliran", "/peta")])

# 5. kecamatan
d = M.demografi_kecamatan("faskes_per_100rb")["kecamatan"]
tambah("Kecamatan mana yang paling padat faskes?",
       "Menurut titik faskes OpenStreetMap dan penduduk BPS 2025, kecamatan dengan faskes per 100 ribu penduduk tertinggi: %s. Ini data konteks publik, bukan hasil deteksi." % "; ".join(
           "%s (%s per 100 rb; %d RS, %d klinik)" % (x["kecamatan"], format(x["faskes_per_100rb"], ".1f").replace(".", ","), x["rs"], x["klinik"]) for x in d[:3]),
       [(x["kecamatan"], format(x["faskes_per_100rb"], ".1f").replace(".", ",")) for x in d[:3]], [("Peta L2", "/peta")])

# 6. readmisi: kenapa angka tinggi bisa wajar
tambah("Kenapa RS dengan angka readmisi tinggi bisa berstatus wajar?",
       "Karena yang dinilai bukan angka mentah, melainkan O/E: readmisi nyata dibandingkan dengan yang wajar untuk bauran kasus RS itu. RS yang merawat kasus kronis berat memang memiliki Expected tinggi, sehingga angka mentah tinggi bisa berujung O/E sekitar 1 dan status wajar. Sebaliknya RS dengan kasus ringan tetapi readmisi di atas wajar akan ditandai.",
       [], [("Modul readmisi", "/modul/readmisi"), ("Metodologi", "/metodologi")])
t = M.daftar_temuan("semarang", "readmisi", "aktif", "rupiah_tertimbang", 5)
tambah("RS mana yang ditandai untuk readmisi dan berapa selisihnya?",
       ("%d RS di Semarang ditandai (perlu perhatian atau diamati) pada modul readmisi: %s." % (t["jumlah_temuan"], "; ".join(
           "%s O/E %s, selisih %s sampel" % (x["faskes"], oe(x["modul"]["OE"]), rp(x["modul"]["selisih_rupiah_sampel"])) for x in t["temuan"])) if t["temuan"] else "Tidak ada RS di Semarang yang ditandai pada modul readmisi."),
       [(x["faskes"], oe(x["modul"]["OE"])) for x in t["temuan"]], [("Modul readmisi", "/modul/readmisi")])

# 7. severity
i = M.ambil_indikator("severity", "semarang", "kelas")
ka = i["pecah_kelas"].get("A")
tambah("Apakah RS kelas A dengan severity III 22% itu wajar?",
       "Pangsa severity III yang tinggi pada RS kelas A sebagian besar wajar karena bauran kasusnya berat. SIDAK menilai O/E setelah menyesuaikan kelompok INA-CBG, diagnosis, usia, dan lama rawat, tanpa memasukkan kelas RS sebagai fitur. %s" % (
           ("Di Semarang, RS kelas A memiliki angka mentah %s dengan O/E %s dan %d faskes perlu perhatian." % (pct(ka["angka_mentah_pct"]), oe(ka["OE"]), ka["perlu_perhatian"])) if ka else "Kelas A tidak tersedia di data Semarang."),
       [("O/E kelas A", oe(ka["OE"])) if ka else ("O/E", "-")], [("Modul severity", "/modul/severity")])
mm = i.get("metrik_model") or {}
tambah("Berapa selisih tarif severity III dan II?",
       "Pada kelompok kasus yang sama, tarif severity III lebih tinggi dari severity II dengan median sekitar %s (Data Sampel 2024). Selisih inilah yang dipakai menghitung rupiah kelebihan severity III." % rp(mm.get("delta_tarif_median")),
       [("selisih tarif median", rp(mm.get("delta_tarif_median")))], [("Modul severity", "/modul/severity")])

# 8. fragmentasi
fs = [f for f in M.S.faskes if f["kab"] == M.KOTA and f["modul"].get("fragmentasi") and f["modul"]["fragmentasi"]["status"] != "volume_rendah"]
putih = sorted([f for f in fs if (f["modul"]["fragmentasi"].get("OE_sebelum_putih") or 0) > 1.05 and f["modul"]["fragmentasi"]["status"] == "wajar"],
               key=lambda f: -(f["modul"]["fragmentasi"].get("pangsa_putih") or 0))
tambah("Faskes mana yang diputihkan karena pola dialisis?",
       ("%d faskes di Semarang tampak menyimpang sebelum daftar putih klinis tetapi menjadi wajar sesudahnya: %s. Pola dialisis, kemoterapi, radioterapi, rehabilitasi, dan transfusi memang menuntut kunjungan berulang." % (
           len(putih), "; ".join("%s (%s kunjungan berpola klinis wajar; O/E %s → %s)" % (f["label"], pct(f["modul"]["fragmentasi"]["pangsa_putih"]), oe(f["modul"]["fragmentasi"]["OE_sebelum_putih"]), oe(f["modul"]["fragmentasi"]["OE"])) for f in putih[:4]))) if putih else "Tidak ada faskes Semarang yang berubah status karena daftar putih.",
       [(f["label"], pct(f["modul"]["fragmentasi"]["pangsa_putih"])) for f in putih[:3]], [("Modul fragmentasi", "/modul/fragmentasi")])
t = M.daftar_temuan("semarang", "fragmentasi", "aktif", "rupiah_tertimbang", 5)
tambah("RS mana yang tersisa sebagai kandidat audit fragmentasi?",
       ("Setelah daftar putih klinis, %d RS Semarang tetap ditandai: %s." % (t["jumlah_temuan"], "; ".join("%s (%s, O/E %s, %s)" % (x["faskes"], x["kelas"], oe(x["modul"]["OE"]), x["modul"]["status"]) for x in t["temuan"]))) if t["temuan"] else "Tidak ada RS yang tersisa ditandai.",
       [(x["faskes"], oe(x["modul"]["OE"])) for x in t["temuan"]], [("Modul fragmentasi", "/modul/fragmentasi")])

# 9. rujukan
i = M.ambil_indikator("rujukan", "semarang", "jenis_fktp")
pj = i["pecah_jenis_fktp"]
tambah("Puskesmas atau klinik yang lebih banyak merujuk kasus ringan?",
       "Per jenis FKTP di Semarang: %s. O/E memperhitungkan bauran diagnosis dan jenis FKTP, sehingga perbandingan ini lebih adil daripada rasio rujuk mentah." % "; ".join(
           "%s rasio rujuk %s, O/E %s, %d perlu perhatian dari %d dinilai" % (k.title(), pct(v["angka_mentah_pct"]), oe(v["OE"]), v["perlu_perhatian"], v["faskes_dinilai"]) for k, v in pj.items() if v["faskes_dinilai"]),
       [(k.title(), oe(v["OE"])) for k, v in pj.items() if v["faskes_dinilai"]], [("Modul rujukan", "/modul/rujukan")])
top_ns = sorted([f for f in M.S.faskes if f["kab"] == M.KOTA and f["modul"].get("rujukan") and f["modul"]["rujukan"]["status"] != "volume_rendah"],
                key=lambda f: -(f["modul"]["rujukan"].get("pangsa_nonspes") or 0))[:3]
tambah("FKTP mana dengan pangsa rujukan non-spesialistik tertinggi?",
       "FKTP Semarang dengan pangsa rujukan berdiagnosis non-spesialistik tertinggi: %s. Pangsa ini indikator pendamping; status ditentukan oleh O/E rasio rujuk." % "; ".join(
           "%s (%s; %s, O/E %s, %s)" % (f["label"], f["kelas_pendek"], pct(f["modul"]["rujukan"]["pangsa_nonspes"]), oe(f["modul"]["rujukan"]["OE"]), M.STATUS[f["modul"]["rujukan"]["status"]]) for f in top_ns),
       [(f["label"], pct(f["modul"]["rujukan"]["pangsa_nonspes"])) for f in top_ns], [("Modul rujukan", "/modul/rujukan")])

# 10. metodologi & pagar
tambah("Apa arti O/E dan skor z?",
       "O adalah kejadian yang benar-benar terjadi; E adalah kejadian yang wajar bila faskes melayani pasien yang sama seperti rekan sebayanya. O/E = 1 berarti sesuai perkiraan, 1,3 berarti 30% lebih banyak. Skor z mengukur seberapa jauh selisih itu dari kebetulan; di atas 1,96 kecil kemungkinan hanya kebetulan. Faskes ditandai bila O/E > 1,05 dan z > 1,96 dan konsisten di dua paruh periode.",
       [], [("Metodologi", "/metodologi")])
tambah("Kenapa model readmisi tidak memakai penyeimbangan kelas?",
       "Karena Expected sebuah RS adalah penjumlahan peluang readmisi per admisi. Penyeimbangan kelas akan menggeser peluang ke atas dan membesarkan Expected semua RS, sehingga temuan hilang. Yang penting adalah kalibrasi: pada data uji, O/E agregat model %s." % oe((M.S.ring["metrik"]["readmisi"] or {}).get("oe_agregat_uji")),
       [("AUC uji", format(M.S.ring["metrik"]["readmisi"]["auc"], ".3f").replace(".", ","))], [("Metodologi", "/metodologi")])
tambah("Siapa dokter yang paling sering upcoding?",
       "SIDAK tidak memuat nama dokter, nama peserta, nomor kartu, maupun nomor SEP. Data Sampel BPJS bersifat anonim dan penilaian dilakukan pada tingkat faskes, bukan orang. Saya bisa menunjukkan RS mana yang pola severity-nya menyimpang dari rekan sebaya.",
       [], [("Modul severity", "/modul/severity")])
tambah("Apakah RS ini melakukan fraud?",
       "SIDAK tidak memvonis. Yang tersedia adalah status statistik: apakah pola klaim RS itu menyimpang dari rekan sebaya dengan bauran kasus serupa (perlu perhatian, diamati, atau wajar). Apakah penyimpangan itu pelanggaran hanya bisa diputuskan lewat audit medis oleh auditor. Sebutkan kode RS-nya untuk melihat kartu penjelasannya.",
       [], [("Antrean audit", "/antrean")])
tambah("Kenapa RS ini ditandai?",
       "Sebutkan kode faskesnya (misalnya RS-31595) agar saya bisa menampilkan kartu penjelasan: kejadian nyata vs wajar, O/E, skor z, penyumbang terbesar, dan pembanding sebaya.",
       [], [("Antrean audit", "/antrean")])

json.dump(J, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("jawaban tersimpan:", len(J), "->", OUT)
