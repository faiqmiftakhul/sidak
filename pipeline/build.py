"""
SIDAK - pipeline indikator untuk demo Kota Semarang / Jawa Tengah.

Membaca Data Sampel BPJS Kesehatan (CSV reguler), menghitung empat modul
dalam kerangka O/E yang sama, dan menulis JSON prakomputasi ke
sidak/web/public/data/. Tidak ada identitas peserta yang ditulis.

Jalankan:  python build.py            (dari folder sidak/pipeline)
"""
import json, os, re, sys, time
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CSV = os.path.join(ROOT, "Data sampel CSV", "reguler")
OUT = os.path.join(HERE, "..", "web", "public", "data")
os.makedirs(OUT, exist_ok=True)

TERLARANG = "data_sample_real"        # berkas identitas nyata: tidak boleh disentuh
for root_, _, files in os.walk(os.path.join(HERE)):
    assert not any(TERLARANG in f for f in files), "berkas terlarang di folder pipeline"

PROV = "JAWA TENGAH"
KOTA = "KOTA SEMARANG"
BATAS_LATIH = pd.Timestamp("2024-07-01")
AKHIR_JENDELA = pd.Timestamp("2024-12-01")
JENDELA = 30
LOOKBACK = 180
TOP_KAT = 200
SEED = 20260905
MIN_N = {"readmisi": 30, "severity": 30, "fragmentasi": 100, "rujukan": 100}
T0 = time.time()


def jam(s):
    print("[%6.1f dtk] %s" % (time.time() - T0, s), flush=True)


def f(n):
    return format(int(n), ",").replace(",", ".")


def kelas_pendek(k):
    k = str(k)
    k = k.replace("RS Swasta Setara Type ", "Setara ").replace("RS Kelas ", "")
    k = k.replace("RS TNI Polri Kelas ", "TNI/Polri ")
    return k


def kategorikan(A, B, kolom):
    """Bekukan kategori dari A (latih); nilai tak dikenal di B menjadi LAIN."""
    Xa, Xb = A.copy(), B.copy()
    for c in kolom:
        v = A[c].astype(str)
        top = v.value_counts().index[:TOP_KAT]
        cats = list(top) + ["LAIN"]
        Xa[c] = pd.Categorical(np.where(v.isin(top), v, "LAIN"), categories=cats)
        w = B[c].astype(str)
        Xb[c] = pd.Categorical(np.where(w.isin(top), w, "LAIN"), categories=cats)
    return Xa, Xb


def gbm(latih, semua, KAT, NUM, y):
    Xa, Xb = kategorikan(latih[KAT + NUM], semua[KAT + NUM], KAT)
    clf = HistGradientBoostingClassifier(
        max_iter=400, learning_rate=0.06, max_leaf_nodes=31, min_samples_leaf=60,
        l2_regularization=1.0, early_stopping=True, validation_fraction=0.12,
        n_iter_no_change=25, categorical_features=KAT, random_state=SEED)
    clf.fit(Xa, latih[y])
    return clf.predict_proba(Xb)[:, 1], int(clf.n_iter_)


def hitung_riwayat(ev_key, ev_day, idx_key, idx_day, lookback):
    """Jumlah kejadian dengan kunci sama dalam (hari-lookback, hari) sebelum indeks."""
    ev = np.sort(ev_key.astype(np.int64) * 100000 + ev_day.astype(np.int64))
    k = idx_key.astype(np.int64) * 100000 + idx_day.astype(np.int64)
    return np.searchsorted(ev, k, side="left") - np.searchsorted(ev, k - lookback, side="left")


def tabel_oe(d, min_n, biaya, dimensi):
    """d: kolom faskes, y, p, bln, bobot, dimensi. Mengembalikan tabel per faskes."""
    d = d.assign(v=d.p * (1 - d.p), h=d.bln % 2)
    g = d.groupby("faskes").agg(n=("y", "size"), O=("y", "sum"), E=("p", "sum"),
                                V=("v", "sum"), bobot=("bobot", "mean"))
    h = d.groupby(["faskes", "h"]).agg(O=("y", "sum"), E=("p", "sum")).unstack(fill_value=0)
    oe1 = (h["O"][0] / h["E"][0].replace(0, np.nan)).reindex(g.index)
    oe2 = (h["O"][1] / h["E"][1].replace(0, np.nan)).reindex(g.index)
    g["OE"] = g.O / g.E.replace(0, np.nan)
    g["z"] = (g.O - g.E) / np.sqrt(g.V.replace(0, np.nan))
    g["stabil"] = (oe1 > 1) & (oe2 > 1)
    cukup = g.n >= min_n
    tanda = cukup & (g.OE > 1.05) & (g.z > 1.96)
    amati = cukup & ~tanda & (g.OE > 1.05) & (g.z > 1.0)
    g["status"] = np.select([~cukup, tanda & g.stabil, tanda & ~g.stabil, amati],
                            ["volume_rendah", "perhatian", "diamati", "diamati"], "wajar")
    g["selisih"] = (g.O - g.E).clip(lower=0)
    g["rupiah"] = g.selisih * biaya
    g["rupiah_tertimbang"] = g.rupiah * g.bobot
    g["rate"] = g.O / g.n
    # penyumbang: dimensi dengan O-E terbesar (hanya disimpan utk faskes bertanda)
    kontrib = {}
    for fk in g.index[g.status.isin(["perhatian", "diamati"])]:
        s = d[d.faskes == fk].groupby("dimensi").agg(O=("y", "sum"), E=("p", "sum"), n=("y", "size"))
        s["d"] = s.O - s.E
        s = s.sort_values("d", ascending=False).head(3)
        kontrib[fk] = [{"nama": str(i), "O": int(r.O), "E": round(float(r.E), 1), "n": int(r.n)}
                       for i, r in s.iterrows()]
    g["kontributor"] = pd.Series(kontrib)
    return g


def bulanan(d, faskes_list):
    m = d[d.faskes.isin(faskes_list)].groupby(["faskes", "bln"]).agg(O=("y", "sum"), E=("p", "sum"), n=("y", "size"))
    out = {}
    for fk, r in m.groupby(level=0):
        out[fk] = [{"bln": int(b), "O": int(x.O), "E": round(float(x.E), 1), "n": int(x.n)}
                   for (_, b), x in r.iterrows()]
    return out


def tren_kota(d):
    m = d.groupby("bln").agg(O=("y", "sum"), E=("p", "sum"), n=("y", "size"))
    return [{"bln": int(b), "O": int(x.O), "E": round(float(x.E), 1), "n": int(x.n),
             "OE": round(float(x.O / x.E), 3) if x.E > 0 else None} for b, x in m.iterrows()]


# ====================================================================== MUAT
jam("membaca FKRTL")
KOL = ["PSTV01", "PSTV15", "FKL02", "FKL03", "FKL04", "FKL05", "FKL06", "FKL07", "FKL08",
       "FKL09", "FKL10", "FKL12", "FKL13", "FKL14", "FKL15A", "FKL17A", "FKL19", "FKL19A",
       "FKL20", "FKL23", "FKL29", "FKL47"]
CACHE = os.environ.get("SIDAK_CACHE", os.path.join(HERE, "_cache"))
os.makedirs(CACHE, exist_ok=True)
_c = os.path.join(CACHE, "fkrtl2024.parquet")
if os.path.exists(_c):
    df = pd.read_parquet(_c)
else:
    df = pd.read_csv(os.path.join(CSV, "202403_fkrtl.csv"), usecols=KOL,
                     parse_dates=["FKL03", "FKL04"], low_memory=False)
    df = df[df.FKL03.dt.year == 2024].copy()
    df.to_parquet(_c)
df["faskes"] = df.FKL02.str[:-11]
df["day"] = (df.FKL03 - pd.Timestamp("2020-01-01")).dt.days
df["bln"] = df.FKL03.dt.month
df["pid"] = pd.factorize(df.PSTV01)[0]
jam("FKRTL 2024: %s baris, %s faskes" % (f(len(df)), f(df.faskes.nunique())))

jam("membaca kepesertaan")
ps = pd.read_csv(os.path.join(CSV, "2015202401_kepesertaan.csv"),
                 usecols=["PSTV01", "PSTV03", "PSTV05", "PSTV08", "PSTV10", "PSTV14"], low_memory=False)
ps = ps.drop_duplicates("PSTV01", keep="last").set_index("PSTV01")
ps["lahir"] = pd.to_datetime(ps.PSTV03, errors="coerce")
df = df.join(ps[["lahir", "PSTV05", "PSTV08", "PSTV10", "PSTV14"]], on="PSTV01")
df["umur"] = ((df.FKL03 - df.lahir).dt.days / 365.25).clip(0, 110)
del ps

# profil faskes (untuk semua Indonesia; disimpan hanya Jawa Tengah)
prof = df.groupby("faskes").agg(prov=("FKL05", "first"), kab=("FKL06", "first"), milik=("FKL07", "first"),
                                jenis=("FKL08", "first"), kelas=("FKL09", "first"),
                                n_ritl=("FKL10", lambda s: int((s == "RITL").sum())),
                                n_rjtl=("FKL10", lambda s: int((s == "RJTL").sum())))
prof["kelas_pendek"] = prof.kelas.map(kelas_pendek)
prof["kab"] = prof.kab.astype(str)

# ====================================================================== READMISI
jam("modul #16 readmisi")
ri = df[df.FKL10 == "RITL"].sort_values(["pid", "FKL03", "FKL04"]).reset_index(drop=True)
ri["los"] = (ri.FKL04 - ri.FKL03).dt.days.clip(lower=0)
ri["masuk_berikut"] = ri.groupby("pid").FKL03.shift(-1)
ri["jeda"] = (ri.masuk_berikut - ri.FKL04).dt.days
ri["y"] = ((ri.jeda >= 0) & (ri.jeda <= JENDELA)).astype(int)
ri["pulang_lalu"] = ri.groupby("pid").FKL04.shift(1)
ri["jeda_lalu"] = (ri.FKL03 - ri.pulang_lalu).dt.days.fillna(9999).clip(upper=9999)
meninggal = ri.FKL14.astype(str).str.contains("Meninggal", case=False)
layak = (~meninggal) & (ri.FKL04 < AKHIR_JENDELA)
# riwayat 180 hari di LUAR faskes yang dinilai (konfigurasi deteksi)
combo_all = pd.factorize(df.pid.astype(str) + "|" + df.faskes)[0]
df["combo"] = combo_all
ri = ri.merge(df[["pid", "faskes", "combo"]].drop_duplicates(), on=["pid", "faskes"], how="left")
for jenis, kode in [("ritl", "RITL"), ("rjtl", "RJTL")]:
    ev = df[df.FKL10 == kode]
    semua = hitung_riwayat(ev.pid.values, ev.day.values, ri.pid.values, ri.day.values, LOOKBACK)
    sama = hitung_riwayat(ev.combo.values, ev.day.values, ri.combo.values, ri.day.values, LOOKBACK)
    ri["riw_" + jenis] = np.maximum(semua - sama, 0)
ri.loc[ri.riw_ritl > 0, "riw_ritl"] -= 0  # indeks sendiri bertanggal sama tidak terhitung (side=left)
ri["kelamin"] = ri.PSTV05.astype(str)
ri["basis"] = ri.FKL19.astype(str).str.rsplit("-", n=1).str[0]   # INA-CBG tanpa digit keparahan
ri["dimensi"] = ri.basis
ri["sev"] = ri.FKL23.astype(str).str.extract(r"keparahan (\d)")[0].map({"1": "I", "2": "II", "3": "III"})
KAT_R = ["FKL19", "FKL14", "FKL15A", "FKL17A", "FKL13", "FKL12", "kelamin", "FKL20"]
NUM_R = ["umur", "los", "FKL47", "riw_ritl", "riw_rjtl", "jeda_lalu", "bln"]
rl = ri[layak].copy()
latih = rl[rl.FKL04 < BATAS_LATIH]
uji_mask = rl.FKL04 >= BATAS_LATIH
rl["p"], it = gbm(latih, rl, KAT_R, NUM_R, "y")
auc = roc_auc_score(rl.y[uji_mask], rl.p[uji_mask])
strata = latih.groupby("FKL19").y.mean()
p_strata = rl.FKL19.map(strata).fillna(latih.y.mean())
auc_strata = roc_auc_score(rl.y[uji_mask], p_strata[uji_mask])
jam("GBM readmisi: %d iterasi, AUC uji %.3f (strata %.3f), O/E agregat uji %.3f"
    % (it, auc, auc_strata, rl.y[uji_mask].sum() / rl.p[uji_mask].sum()))
biaya_readmisi = float(ri[ri.jeda.between(0, JENDELA)].FKL47.mean())  # rata2 tarif rawat ulang ~ proxy
biaya_readmisi = float(ri.merge(ri[["pid", "FKL03"]], left_on=["pid", "masuk_berikut"],
                                right_on=["pid", "FKL03"], suffixes=("", "_b")).FKL47.mean()) if False else biaya_readmisi
d_re = rl.rename(columns={"PSTV15": "bobot"})[["faskes", "y", "p", "bln", "bobot", "dimensi"]]
T_re = tabel_oe(d_re, MIN_N["readmisi"], biaya_readmisi, "dimensi")
MET = {"readmisi": {"n_latih": int(len(latih)), "n_uji": int(uji_mask.sum()), "iterasi": it,
                    "auc": round(auc, 3), "auc_strata": round(auc_strata, 3),
                    "oe_agregat_uji": round(float(rl.y[uji_mask].sum() / rl.p[uji_mask].sum()), 3),
                    "base_rate": round(float(rl.y.mean()) * 100, 1), "biaya_per_kejadian": round(biaya_readmisi),
                    "n_dikecualikan_meninggal": int(meninggal.sum()),
                    "n_dikecualikan_jendela": int(((~meninggal) & (ri.FKL04 >= AKHIR_JENDELA)).sum())}}

# ====================================================================== SEVERITY
jam("modul #4 severity")
sv = ri[ri.sev.isin(["I", "II", "III"])].copy()
sv["y"] = (sv.sev == "III").astype(int)
sv["dimensi"] = sv.basis
KAT_S = ["basis", "FKL15A", "FKL17A", "FKL13", "FKL14", "FKL12", "kelamin"]
NUM_S = ["umur", "los", "bln"]
latih_s = sv[sv.FKL04 < BATAS_LATIH]
uji_s = sv.FKL04 >= BATAS_LATIH
sv["p"], it_s = gbm(latih_s, sv, KAT_S, NUM_S, "y")
auc_s = roc_auc_score(sv.y[uji_s], sv.p[uji_s])
# selisih tarif III vs II pada basis yang sama
tar = sv.groupby(["basis", "sev"]).FKL47.mean().unstack()
delta = (tar["III"] - tar["II"]).dropna()
delta = delta[delta > 0]
sv["delta"] = sv.basis.map(delta).fillna(delta.median())
delta_faskes = sv.groupby("faskes").delta.mean()
jam("GBM severity: %d iterasi, AUC uji %.3f, pangsa III %.1f%%, delta tarif median Rp %s"
    % (it_s, auc_s, sv.y.mean() * 100, f(delta.median())))
d_sv = sv.rename(columns={"PSTV15": "bobot"})[["faskes", "y", "p", "bln", "bobot", "dimensi"]]
T_sv = tabel_oe(d_sv, MIN_N["severity"], 1.0, "dimensi")
T_sv["rupiah"] = T_sv.selisih * delta_faskes.reindex(T_sv.index).fillna(delta.median())
T_sv["rupiah_tertimbang"] = T_sv.rupiah * T_sv.bobot
MET["severity"] = {"n_latih": int(len(latih_s)), "n_uji": int(uji_s.sum()), "iterasi": it_s, "auc": round(auc_s, 3),
                   "pangsa_iii_nasional": round(float(sv.y.mean()) * 100, 1),
                   "delta_tarif_median": round(float(delta.median())),
                   "oe_agregat_uji": round(float(sv.y[uji_s].sum() / sv.p[uji_s].sum()), 3)}

# ====================================================================== FRAGMENTASI
jam("modul #9 fragmentasi")
rj = df[df.FKL10 == "RJTL"].sort_values(["pid", "faskes", "FKL03"]).copy()
rj["prev"] = rj.groupby(["pid", "faskes"]).FKL03.shift(1)
rj["gap"] = (rj.FKL03 - rj.prev).dt.days
rj["y"] = rj.gap.between(1, 7).astype(int)
desk = rj.FKL19A.astype(str).str.upper()
dx = rj.FKL17A.astype(str).str.upper()
POLA = r"DIALISIS|KEMOTERAPI|RADIOTERAPI|REHABILITASI|FISIOTERAPI|TRANSFUSI|HEMOFILIA|THALAS"
rj["putih"] = desk.str.contains(POLA, regex=True) | dx.str.match(r"^(Z49|Z51|Z50|D56|D57|D66|D67|N185|Z54)")
rj["dimensi"] = rj.FKL19.astype(str).str.slice(0, 6)
# Expected: rasio nasional per CBG (indirect standardization), sel kecil -> nasional
g_fr = rj.groupby("FKL19").y.agg(["size", "mean"])
g_fr = g_fr[g_fr["size"] >= 30]["mean"]
rj["p"] = rj.FKL19.map(g_fr).fillna(rj.y.mean())
biaya_rjtl = rj.groupby("faskes").FKL47.mean()
d_fr_semua = rj.rename(columns={"PSTV15": "bobot"})[["faskes", "y", "p", "bln", "bobot", "dimensi", "putih"]]
T_fr_sebelum = tabel_oe(d_fr_semua, MIN_N["fragmentasi"], 1.0, "dimensi")
d_fr = d_fr_semua[~d_fr_semua.putih]
T_fr = tabel_oe(d_fr, MIN_N["fragmentasi"], 1.0, "dimensi")
for T in (T_fr, T_fr_sebelum):
    T["rupiah"] = T.selisih * biaya_rjtl.reindex(T.index).fillna(biaya_rjtl.median())
    T["rupiah_tertimbang"] = T.rupiah * T.bobot
T_fr["rate_sebelum_putih"] = T_fr_sebelum.rate.reindex(T_fr.index)
T_fr["OE_sebelum_putih"] = T_fr_sebelum.OE.reindex(T_fr.index)
T_fr["pangsa_putih"] = d_fr_semua.groupby("faskes").putih.mean().reindex(T_fr.index)
MET["fragmentasi"] = {"n_kunjungan": int(len(rj)), "rate_nasional_7hr": round(float(rj.y.mean()) * 100, 1),
                      "pangsa_putih_nasional": round(float(rj.putih.mean()) * 100, 1),
                      "rate_nasional_setelah_putih": round(float(d_fr.y.mean()) * 100, 1),
                      "biaya_per_kejadian_median": round(float(biaya_rjtl.median()))}

# nilai hilir rujukan: rata2 tarif kunjungan RJTL dengan perujuk FKTP (dipakai modul #3)
perujuk_fktp = rj.FKL29.astype(str).str.upper().str.match(r"^(PUSKESMAS|KLINIK|DOKTER|PRAKT|RAWAT INAP$|NON RAWAT INAP$)")
biaya_rujukan = float(rj[perujuk_fktp].FKL47.mean()) if perujuk_fktp.any() else float(rj.FKL47.mean())

# ====================================================================== ALIRAN (Semarang)
jam("aliran pasien ke Kota Semarang")
sem_fk = prof.index[prof.kab == KOTA]
al_re = rl[rl.faskes.isin(sem_fk)].groupby("PSTV10").agg(n=("y", "size"), O=("y", "sum"), E=("p", "sum"))
al_re = al_re[al_re.n >= 5].sort_values("n", ascending=False)
rj_sem = rj[rj.faskes.isin(sem_fk) & perujuk_fktp]
al_ru = rj_sem.groupby("PSTV14").agg(n=("y", "size"), bobot=("PSTV15", "sum"))
al_ru = al_ru[al_ru.n >= 5].sort_values("n", ascending=False)
ALIRAN = {"readmisi": [{"asal": str(k), "n": int(r.n), "O": int(r.O), "E": round(float(r.E), 1)} for k, r in al_re.iterrows()],
          "rujukan": [{"asal": str(k), "n": int(r.n), "tertimbang": int(r.bobot)} for k, r in al_ru.iterrows()],
          "pangsa_luar_kota_ritl": round(float((rl[rl.faskes.isin(sem_fk)].PSTV10.astype(str) != KOTA).mean()) * 100, 1)}

# pasien risiko tinggi (pencegahan) : admisi terbaru di Semarang dengan p tertinggi, anonim
rr = rl[rl.faskes.isin(sem_fk) & (rl.FKL03 >= "2024-10-01")].sort_values("p", ascending=False).head(25)
RISIKO = [{"id": "P-%04d" % (i + 1), "faskes": r.faskes, "umur": int(r.umur) if pd.notna(r.umur) else None,
           "cbg": str(r.FKL19), "dx": str(r.FKL17A), "los": int(r.los), "riw_ritl": int(r.riw_ritl),
           "p": round(float(r.p), 2), "bln": int(r.bln)} for i, (_, r) in enumerate(rr.iterrows())]

# sampel klaim teknis untuk faskes Semarang bertanda (tanpa identitas)
def sampel(dsub, kolom, n=20):
    s = dsub.sample(min(n, len(dsub)), random_state=SEED)
    return [{k: (str(v) if not isinstance(v, (int, float, np.integer, np.floating)) else round(float(v), 2))
             for k, v in zip(kolom, row)} for row in s[kolom].itertuples(index=False)]

SAMPEL = {}
for fk in sem_fk:
    SAMPEL[fk] = {
        "readmisi": sampel(rl[(rl.faskes == fk) & (rl.y == 1)].assign(tgl=lambda x: x.FKL03.dt.strftime("%Y-%m-%d")),
                           ["tgl", "FKL19", "FKL17A", "los", "jeda", "FKL47", "p"]),
        "severity": sampel(sv[(sv.faskes == fk) & (sv.y == 1)].assign(tgl=lambda x: x.FKL03.dt.strftime("%Y-%m-%d")),
                           ["tgl", "FKL19", "FKL17A", "los", "FKL47", "p"]),
        "fragmentasi": sampel(rj[(rj.faskes == fk) & (rj.y == 1) & (~rj.putih)].assign(tgl=lambda x: x.FKL03.dt.strftime("%Y-%m-%d")),
                              ["tgl", "FKL19", "FKL17A", "gap", "FKL47"]),
    }

BLN = {"readmisi": bulanan(d_re, sem_fk), "severity": bulanan(d_sv, sem_fk), "fragmentasi": bulanan(d_fr, sem_fk)}
TREN = {"readmisi": tren_kota(d_re[d_re.faskes.isin(sem_fk)]), "severity": tren_kota(d_sv[d_sv.faskes.isin(sem_fk)]),
        "fragmentasi": tren_kota(d_fr[d_fr.faskes.isin(sem_fk)])}
del df, rj, ri

# ====================================================================== RUJUKAN (FKTP)
jam("membaca FKTP")
fk = pd.read_csv(os.path.join(CSV, "202402_fktpkapitasi.csv"),
                 usecols=["PSTV01", "PSTV15", "FKP02", "FKP03", "FKP05", "FKP06", "FKP07", "FKP08", "FKP13", "FKP14A", "FKP22"],
                 low_memory=False)
fk = fk[(fk.FKP03.astype(str).str[:4] == "2024") & (fk.FKP22 == "KUNJUNGAN SAKIT")].copy()
fk["faskes"] = fk.FKP02.str[:-11]
fk["bln"] = fk.FKP03.astype(str).str[5:7].astype(int)
fk["y"] = (fk.FKP13 == "RUJUK LANJUT").astype(int)
fk["dx"] = fk.FKP14A.astype(str)
NONSPES = ["J06", "J00", "I10", "E11", "K30", "R50", "M79", "J02", "J03", "L23", "K04", "A09", "B35", "H10",
           "N39", "J45", "K29", "R51", "M54", "L20", "J01", "J11", "K59", "L30", "M25", "R05", "R10", "R42",
           "H66", "J20", "K52", "N30", "L50", "B86", "E78", "M10", "G44", "F41", "T14", "W57"]
fk["nonspes"] = fk.dx.isin(NONSPES)
jam("FKTP kunjungan sakit 2024: %s, rasio rujuk %.1f%%" % (f(len(fk)), fk.y.mean() * 100))
# Expected: rasio rujuk nasional per (diagnosis x jenis FKTP); sel kecil -> per diagnosis -> nasional
g1 = fk.groupby(["dx", "FKP08"]).y.agg(["size", "mean"])
g1 = g1[g1["size"] >= 50]["mean"]
g2 = fk.groupby("dx").y.agg(["size", "mean"])
g2 = g2[g2["size"] >= 50]["mean"]
key = pd.MultiIndex.from_arrays([fk.dx, fk.FKP08])
fk["p"] = pd.Series(g1.reindex(key).to_numpy(), index=fk.index)
fk["p"] = fk.p.fillna(fk.dx.map(g2)).fillna(fk.y.mean())
fk["dimensi"] = fk.dx
d_ru = fk.rename(columns={"PSTV15": "bobot"})[["faskes", "y", "p", "bln", "bobot", "dimensi"]]
T_ru = tabel_oe(d_ru, MIN_N["rujukan"], biaya_rujukan, "dimensi")
T_ru["pangsa_nonspes"] = fk[fk.y == 1].groupby("faskes").nonspes.mean().reindex(T_ru.index)
prof_f = fk.groupby("faskes").agg(prov=("FKP05", "first"), kab=("FKP06", "first"), milik=("FKP07", "first"),
                                  jenis=("FKP08", "first"))
prof_f["kab"] = prof_f.kab.astype(str)
sem_fktp = prof_f.index[prof_f.kab == KOTA]
BLN["rujukan"] = bulanan(d_ru, sem_fktp)
TREN["rujukan"] = tren_kota(d_ru[d_ru.faskes.isin(sem_fktp)])
top_dx_sem = fk[fk.faskes.isin(sem_fktp) & (fk.y == 1)].dx.value_counts().head(10)
MET["rujukan"] = {"n_kunjungan": int(len(fk)), "rasio_rujuk_nasional": round(float(fk.y.mean()) * 100, 1),
                  "pangsa_nonspes_nasional": round(float(fk[fk.y == 1].nonspes.mean()) * 100, 1),
                  "biaya_hilir_per_rujukan": round(biaya_rujukan), "n_diagnosis_nonspes": len(NONSPES),
                  "top_dx_rujukan_semarang": [{"dx": k, "n": int(v)} for k, v in top_dx_sem.items()]}
del fk

# ====================================================================== KELUARAN
jam("menulis keluaran")
MODUL = {"rujukan": T_ru, "severity": T_sv, "fragmentasi": T_fr, "readmisi": T_re}
NOMOR = {"rujukan": 3, "severity": 4, "fragmentasi": 9, "readmisi": 16}


def baris(T, fk, ekstra=()):
    r = T.loc[fk]
    o = {"n": int(r.n), "O": int(r.O), "E": round(float(r.E), 1),
         "OE": round(float(r.OE), 3) if pd.notna(r.OE) else None,
         "z": round(float(r.z), 2) if pd.notna(r.z) else None,
         "rate": round(float(r.rate) * 100, 1), "status": str(r.status), "stabil": bool(r.stabil),
         "selisih": round(float(r.selisih), 1), "rupiah": round(float(r.rupiah)),
         "rupiah_tertimbang": round(float(r.rupiah_tertimbang)),
         "kontributor": r.kontributor if isinstance(r.kontributor, list) else []}
    for e in ekstra:
        v = r[e]
        o[e] = None if pd.isna(v) else round(float(v) * (100 if e in ("pangsa_nonspes", "pangsa_putih", "rate_sebelum_putih") else 1), 3 if e == "OE_sebelum_putih" else 1)
    return o


# --- faskes FKRTL Jawa Tengah
FASKES = []
for fkid, p in prof[prof.prov == PROV].iterrows():
    m = {}
    if fkid in T_re.index: m["readmisi"] = baris(T_re, fkid)
    if fkid in T_sv.index: m["severity"] = baris(T_sv, fkid)
    if fkid in T_fr.index: m["fragmentasi"] = baris(T_fr, fkid, ("rate_sebelum_putih", "OE_sebelum_putih", "pangsa_putih"))
    if not m:
        continue
    rp = sum(v["rupiah"] for v in m.values() if v["status"] in ("perhatian", "diamati"))
    rpt = sum(v["rupiah_tertimbang"] for v in m.values() if v["status"] in ("perhatian", "diamati"))
    FASKES.append({"id": fkid, "label": "RS-" + fkid, "tipe": "FKRTL", "kab": p.kab, "prov": p.prov,
                   "kelas": str(p.kelas), "kelas_pendek": p.kelas_pendek, "milik": str(p.milik), "jenis": str(p.jenis),
                   "n_ritl": int(p.n_ritl), "n_rjtl": int(p.n_rjtl), "modul": m,
                   "rupiah": round(rp), "rupiah_tertimbang": round(rpt),
                   "n_perhatian": sum(v["status"] == "perhatian" for v in m.values()),
                   "bulanan": {k: BLN[k].get(fkid, []) for k in m} if p.kab == KOTA else {},
                   "sampel": SAMPEL.get(fkid, {}) if p.kab == KOTA else {}})
# --- FKTP Jawa Tengah
for fkid, p in prof_f[prof_f.prov == PROV].iterrows():
    if fkid not in T_ru.index:
        continue
    m = {"rujukan": baris(T_ru, fkid, ("pangsa_nonspes",))}
    aktif = m["rujukan"]["status"] in ("perhatian", "diamati")
    FASKES.append({"id": fkid, "label": "FKTP-" + fkid, "tipe": "FKTP", "kab": p.kab, "prov": p.prov,
                   "kelas": str(p.jenis), "kelas_pendek": str(p.jenis).title(), "milik": str(p.milik), "jenis": str(p.jenis),
                   "n_kunjungan": m["rujukan"]["n"], "modul": m,
                   "rupiah": m["rujukan"]["rupiah"] if aktif else 0,
                   "rupiah_tertimbang": m["rujukan"]["rupiah_tertimbang"] if aktif else 0,
                   "n_perhatian": int(m["rujukan"]["status"] == "perhatian"),
                   "bulanan": {"rujukan": BLN["rujukan"].get(fkid, [])} if p.kab == KOTA else {}, "sampel": {}})
json.dump(FASKES, open(os.path.join(OUT, "faskes_jateng.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
jam("faskes Jawa Tengah ditulis: %d" % len(FASKES))

# --- agregat kab/kota Jawa Tengah per modul
KAB = {}
for nama, T in MODUL.items():
    pr = prof_f if nama == "rujukan" else prof
    TT = T.join(pr[["prov", "kab"]], how="inner")
    TT = TT[TT.prov == PROV]
    cukup = TT.n >= MIN_N[nama]
    g = TT.groupby("kab").agg(n=("n", "sum"), O=("O", "sum"), E=("E", "sum"), V=("V", "sum"),
                             rupiah=("rupiah", lambda s: float(s[TT.loc[s.index].status.isin(["perhatian", "diamati"])].sum())),
                             rupiah_tertimbang=("rupiah_tertimbang", lambda s: float(s[TT.loc[s.index].status.isin(["perhatian", "diamati"])].sum())))
    g["n_faskes"] = TT[cukup].groupby("kab").size()
    g["n_perhatian"] = TT[TT.status == "perhatian"].groupby("kab").size()
    g["n_diamati"] = TT[TT.status == "diamati"].groupby("kab").size()
    g = g.fillna(0)
    for kab, r in g.iterrows():
        KAB.setdefault(kab, {})[nama] = {"n": int(r.n), "O": int(r.O), "E": round(float(r.E), 1),
                                         "OE": round(float(r.O / r.E), 3) if r.E > 0 else None,
                                         "z": round(float((r.O - r.E) / np.sqrt(r.V)), 2) if r.V > 0 else None,
                                         "rate": round(float(r.O / r.n) * 100, 1) if r.n else None,
                                         "n_faskes": int(r.n_faskes), "n_perhatian": int(r.n_perhatian),
                                         "n_diamati": int(r.n_diamati), "rupiah": round(r.rupiah),
                                         "rupiah_tertimbang": round(r.rupiah_tertimbang)}
json.dump(KAB, open(os.path.join(OUT, "kabkota_jateng.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)

# --- ringkasan Kota Semarang
sem = [x for x in FASKES if x["kab"] == KOTA]
ring = {"kota": KOTA, "periode": "Jan-Nov 2024 (Data Sampel BPJS Kesehatan Edisi 2025)",
        "n_faskes_fkrtl": sum(x["tipe"] == "FKRTL" for x in sem), "n_faskes_fktp": sum(x["tipe"] == "FKTP" for x in sem),
        "n_perhatian": sum(x["n_perhatian"] > 0 for x in sem),
        "n_diamati": sum(any(v["status"] == "diamati" for v in x["modul"].values()) and x["n_perhatian"] == 0 for x in sem),
        "rupiah": sum(x["rupiah"] for x in sem), "rupiah_tertimbang": sum(x["rupiah_tertimbang"] for x in sem),
        "per_modul": {}, "tren": TREN, "aliran": ALIRAN, "risiko_tinggi": RISIKO, "metrik": MET, "min_n": MIN_N,
        "nomor_modul": NOMOR}
for nama in MODUL:
    xs = [x for x in sem if nama in x["modul"]]
    st = [x["modul"][nama]["status"] for x in xs]
    ring["per_modul"][nama] = {"n_faskes": len(xs), "n_cukup": sum(s != "volume_rendah" for s in st),
                               "n_perhatian": st.count("perhatian"), "n_diamati": st.count("diamati"),
                               "n": sum(x["modul"][nama]["n"] for x in xs), "O": sum(x["modul"][nama]["O"] for x in xs),
                               "E": round(sum(x["modul"][nama]["E"] for x in xs), 1),
                               "rupiah": sum(x["modul"][nama]["rupiah"] for x in xs if x["modul"][nama]["status"] in ("perhatian", "diamati")),
                               "rupiah_tertimbang": sum(x["modul"][nama]["rupiah_tertimbang"] for x in xs if x["modul"][nama]["status"] in ("perhatian", "diamati"))}
    if nama == "fragmentasi":
        ring["per_modul"][nama]["n_diputihkan"] = sum(1 for x in xs if x["modul"][nama].get("OE_sebelum_putih") and x["modul"][nama]["OE_sebelum_putih"] > 1.05 and x["modul"][nama]["status"] == "wajar")
json.dump(ring, open(os.path.join(OUT, "semarang.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
jam("selesai. Semarang: %d faskes, %d perlu perhatian, Rp %s selisih sampel, Rp %s tertimbang"
    % (len(sem), ring["n_perhatian"], f(ring["rupiah"]), f(ring["rupiah_tertimbang"])))
for nama, v in ring["per_modul"].items():
    print("  %-12s faskes %3d | cukup %3d | perhatian %2d | diamati %2d | Rp %s" % (nama, v["n_faskes"], v["n_cukup"], v["n_perhatian"], v["n_diamati"], f(v["rupiah"])))
