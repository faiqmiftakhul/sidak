// Port 1:1 dari api/main.py — fungsi alat baca-saja + registry TOOLS.
// Setiap alat async (loader data statis) dan mengembalikan objek identik py.

import { KOTA, NAMA, NOMOR, STATUS, int, store, wilayahFaskes, ringkasFaskes } from "./data"
import type { Faskes } from "./data"

type Arg = Record<string, unknown>
type Hasil = unknown

export const jalankanAlat = async (name: string, args?: Arg): Promise<Hasil> => {
  const fn = ALAT[name]
  if (!fn) return { error: "alat tidak dikenal" }
  const bersih: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args ?? {})) if (v !== null && v !== undefined && v !== "") bersih[k] = v
  try {
    return await fn(bersih)
  } catch (e) {
    return { error: "argumen tidak valid: " + ((e as Error).message || String(e)) }
  }
}

const daftarTemuan = async (a: Arg): Promise<Hasil> => {
  const wilayah = (a.wilayah as string | undefined) ?? "semarang"
  const modul = (a.modul as string | undefined) ?? undefined
  const status = (a.status as string | undefined) ?? "aktif"
  const urut = (a.urut as string | undefined) ?? "rupiah_tertimbang"
  const jumlah = int(a.jumlah, 5)
  const sedikit = !!a.sedikit
  const { fs, wil } = await wilayahFaskes(wilayah)
  const rows: Array<[Faskes, string, any]> = []
  for (const f of fs) {
    for (const [k, h] of Object.entries(f.modul)) {
      if (modul && k !== modul) continue
      if (status === "aktif" && h.status !== "perhatian" && h.status !== "diamati") continue
      if ((status === "perhatian" || status === "diamati" || status === "wajar") && h.status !== status) continue
      rows.push([f, k, h])
    }
  }
  const key = (h: any) => ({ rupiah_tertimbang: h.rupiah_tertimbang, rupiah: h.rupiah, OE: h.OE || 0, z: h.z || 0, volume: h.n } as Record<string, number>)[urut] ?? h.rupiah_tertimbang
  rows.sort((x, y) => key(y[2]) - key(x[2]))
  const n = Math.min(jumlah, 20)
  if (sedikit) {
    return {
      wilayah: wil, jumlah_temuan: rows.length, tautan: "/antrean",
      temuan: rows.slice(0, n).map(([f, k, h]) => ({
        faskes: f.label, tipe: f.tipe, kelas: f.kelas_pendek,
        modul: NAMA[k], nomor: NOMOR[k], status: STATUS[h.status],
        OE: h.OE, z: h.z, selisih_rupiah_tertimbang: h.rupiah_tertimbang, tautan: "/faskes/" + f.id,
      })),
    }
  }
  return {
    wilayah: wil, jumlah_temuan: rows.length,
    total_selisih_rupiah_sampel: rows.reduce((s, r) => s + (r[2].status === "perhatian" || r[2].status === "diamati" ? r[2].rupiah : 0), 0),
    total_selisih_rupiah_tertimbang: rows.reduce((s, r) => s + (r[2].status === "perhatian" || r[2].status === "diamati" ? r[2].rupiah_tertimbang : 0), 0),
    temuan: rows.slice(0, n).map(([f, k]) => Object.assign(ringkasFaskes(f, k), { modul: (ringkasFaskes(f, k).modul as Record<string, unknown>)[k] })),
    tautan: "/antrean",
  }
}

const trend = async (a: Arg): Promise<Hasil> => {
  const wilayah = (a.wilayah as string | undefined) ?? "semarang"
  const modul = (a.modul as string | undefined) ?? undefined
  const S = await store()
  if (modul && !(modul in NOMOR)) return { error: "modul harus salah satu dari: " + Object.keys(NOMOR).join(", ") }
  const { wil } = await wilayahFaskes(wilayah)
  const mods = modul ? [modul] : Object.keys(NOMOR)
  const out: Record<string, unknown> = { wilayah: wil, modul: {}, tautan: "/modul/" + (modul || "readmisi") }
  const untuk = a.period != null && /^\d+$/.test(String(a.period)) ? int(a.period) : null
  for (const m of mods) {
    let bulanan = S.ring.tren[m]
    if (!bulanan) continue
    if (untuk != null && Array.isArray(bulanan)) bulanan = bulanan.slice(0, untuk)
    ;(out.modul as Record<string, unknown>)[m] = bulanan
  }
  if (modul && Object.keys(out.modul as object).length === 0)
    return { error: `deret bulanan tidak tersedia untuk modul ${modul} di ${wil}` }
  return out
}

const jelaskanTemuan = async (a: Arg): Promise<Hasil> => {
  const S = await store()
  const fid = String(a.faskes ?? "").replace(/^(RS|FKTP)-/, "").trim()
  const f = S.idx[fid]
  if (!f) return { error: "faskes tidak ditemukan; kode contoh RS-31595" }
  const modul = (a.modul as string | undefined)
  const o = ringkasFaskes(f, modul && modul in f.modul ? modul : null)
  const mo = o.modul as Record<string, any>
  for (const k of Object.keys(mo)) {
    const n = f.modul[k].n
    const cand = S.faskes
      .filter(x => x.id !== f.id && x.tipe === f.tipe && x.kelas === f.kelas && x.modul[k] && x.modul[k].status !== "volume_rendah")
      .sort((x, y) => Math.abs(x.modul[k].n - n) - Math.abs(y.modul[k].n - n))
    mo[k].pembanding_sebaya = cand.slice(0, 3).map(x => ({ faskes: x.label, OE: x.modul[k].OE, status: STATUS[x.modul[k].status] }))
  }
  o.bulanan = f.bulanan ?? {}
  o.catatan = "Indikasi statistik untuk prioritas audit, bukan bukti pelanggaran."
  return o
}

const ambilIndikator = async (a: Arg): Promise<Hasil> => {
  const modul = (a.modul as string | undefined) ?? ""
  if (!(modul in NOMOR)) return { error: "modul harus salah satu dari: " + Object.keys(NOMOR).join(", ") }
  const wilayah = (a.wilayah as string | undefined) ?? "semarang"
  const pecah = (a.pecah as string | undefined)
  const { fs, wil } = await wilayahFaskes(wilayah)
  const sub = fs.filter(f => f.modul[modul])
  const agg = (g: Faskes[]) => {
    const O = g.reduce((s, f) => s + f.modul[modul].O, 0)
    const E = g.reduce((s, f) => s + f.modul[modul].E, 0)
    const n = g.reduce((s, f) => s + f.modul[modul].n, 0)
    return {
      faskes: g.length,
      faskes_dinilai: g.filter(f => f.modul[modul].status !== "volume_rendah").length,
      perlu_perhatian: g.filter(f => f.modul[modul].status === "perhatian").length,
      diamati: g.filter(f => f.modul[modul].status === "diamati").length,
      volume: n, observed: O,
      expected: Math.round(E * 10) / 10,
      OE: E ? Math.round((O / E) * 1000) / 1000 : null,
      angka_mentah_pct: n ? Math.round((O / n) * 1000) / 10 : null,
      selisih_rupiah_sampel: g.reduce((s, f) => s + (f.modul[modul].status === "perhatian" || f.modul[modul].status === "diamati" ? f.modul[modul].rupiah : 0), 0),
      selisih_rupiah_tertimbang: g.reduce((s, f) => s + (f.modul[modul].status === "perhatian" || f.modul[modul].status === "diamati" ? f.modul[modul].rupiah_tertimbang : 0), 0),
    }
  }
  const out: Record<string, unknown> = { modul: NAMA[modul], nomor: NOMOR[modul], wilayah: wil, total: agg(sub), tautan: "/modul/" + modul }
  if (pecah === "kelas" || pecah === "kepemilikan" || pecah === "jenis_fktp") {
    const kk = pecah !== "kepemilikan" ? "kelas_pendek" : "milik"
    const keys = Array.from(new Set(sub.map(f => String((f as unknown as Record<string, unknown>)[kk])))).sort()
    const p: Record<string, unknown> = {}
    for (const k of keys) p[k] = agg(sub.filter(f => String((f as unknown as Record<string, unknown>)[kk]) === k))
    out["pecah_" + pecah] = p
  }
  if (wil === KOTA) {
    const S = await store()
    out.tren_bulanan = S.ring.tren[modul]
    out.metrik_model = S.ring.metrik[modul]
  }
  return out
}

const bandingkanKabkota = async (a: Arg): Promise<Hasil> => {
  const modul = (a.modul as string | undefined) ?? ""
  if (!(modul in NOMOR)) return { error: "modul tidak dikenal" }
  const S = await store()
  const urut = (a.urut as string | undefined) ?? "OE"
  const jumlah = int(a.jumlah, 10)
  const rows = Object.entries(S.kab).filter(([, v]) => v[modul] && v[modul]!.OE != null && (v[modul]!.n_faskes ?? 0) > 0)
  rows.sort((x, y) => ((y[1][modul] as unknown as Record<string, number>)[urut] ?? 0) - ((x[1][modul] as unknown as Record<string, number>)[urut] ?? 0))
  return {
    modul: NAMA[modul],
    kab_kota: rows.slice(0, jumlah).map(([kab_kota, v]) => ({ kab_kota, ...v[modul] })),
    tautan: "/peta",
  }
}

const aliranPasien = async (a: Arg): Promise<Hasil> => {
  const S = await store()
  const a2 = S.ring.aliran
  const jumlah = int(a.jumlah, 10)
  if (a.modul === "rujukan") {
    return {
      keterangan: "kunjungan rawat jalan di RS Semarang berperujuk FKTP, menurut kab/kota FKTP terdaftar peserta",
      asal: a2.rujukan.slice(0, jumlah), tautan: "/peta",
    }
  }
  return {
    keterangan: "rawat inap di RS Semarang menurut kab/kota domisili peserta; O = readmisi, E = wajar",
    pangsa_luar_kota_ritl_pct: a2.pangsa_luar_kota_ritl,
    asal: a2.readmisi.slice(0, jumlah), tautan: "/peta",
  }
}

const demografiKecamatan = async (a: Arg): Promise<Hasil> => {
  const S = await store()
  const urut = (a.urut as string | undefined) ?? "penduduk_2025"
  const ks = S.demo.kecamatan
    .filter(k => k[urut] != null)
    .sort((x, y) => Number(y[urut]) - Number(x[urut]))
  return { sumber: S.demo.sumber, kecamatan: ks, tautan: "/peta" }
}

const ringkasWilayah = async (a: Arg): Promise<Hasil> => {
  const wilayah = (a.wilayah as string | undefined) ?? "semarang"
  const S = await store()
  const { fs, wil } = await wilayahFaskes(wilayah)
  const per: Record<string, unknown> = {}
  for (const m of Object.keys(NOMOR)) {
    const r = (await ambilIndikator({ modul: m, wilayah: wil })) as Record<string, unknown>
    per[m] = r["total"]
  }
  return {
    wilayah: wil, periode: S.ring.periode,
    faskes_fkrtl: fs.filter(f => f.tipe === "FKRTL").length,
    faskes_fktp: fs.filter(f => f.tipe === "FKTP").length,
    faskes_perlu_perhatian: fs.filter(f => f.n_perhatian > 0).length,
    selisih_rupiah_sampel: fs.reduce((s, f) => s + f.rupiah, 0),
    selisih_rupiah_tertimbang: fs.reduce((s, f) => s + f.rupiah_tertimbang, 0),
    per_modul: per, tautan: "/",
  }
}

const faskesCount = async (a: Arg): Promise<Hasil> => {
  const wilayah = (a.wilayah as string | undefined) ?? "semarang"
  const { fs, wil } = await wilayahFaskes(wilayah)
  return {
    wilayah: wil,
    faskes_fkrtl: fs.filter(f => f.tipe === "FKRTL").length,
    faskes_fktp: fs.filter(f => f.tipe === "FKTP").length,
    faskes_perlu_perhatian: fs.filter(f => f.n_perhatian > 0).length,
    tautan: "/",
  }
}

const metodologi = async (a: Arg): Promise<Hasil> => {
  const S = await store()
  return {
    kerangka: "O = kejadian nyata; E = jumlah peluang per kejadian dari model/tabel sebaya; O/E; z=(O-E)/sqrt(sum p(1-p)). " +
      "Perlu perhatian bila O/E>1,05 dan z>1,96 dan konsisten di dua paruh periode; Diamati bila melewati sebagian ambang atau tidak konsisten. " +
      "Selisih rupiah=(O-E) x biaya rata-rata per kejadian; tertimbang = dikalikan bobot sampel.",
    ambang_volume_minimum: S.ring.min_n,
    metrik_model: S.ring.metrik,
    data: "Data Sampel BPJS Kesehatan Edisi 2025 (±1% peserta, anonim, kode faskes samaran), klaim 2024. " +
      "Peta: GADM 4.1; titik faskes: OpenStreetMap; demografi: BPS Kota Semarang Dalam Angka 2026.",
    tautan: "/metodologi",
  }
}

type Fn = (a: Arg) => Promise<Hasil>
export const ALAT: Record<string, Fn> = {
  daftar_temuan: daftarTemuan,
  jelaskan_temuan: jelaskanTemuan,
  ambil_indikator: ambilIndikator,
  bandingkan_kabkota: bandingkanKabkota,
  aliran_pasien: aliranPasien,
  demografi_kecamatan: demografiKecamatan,
  ringkas_wilayah: ringkasWilayah,
  faskes_count: faskesCount,
  trend,
  metodologi,
}

const _desk = (d: string): string => d
export const TOOLS = [
  { name: "daftar_temuan", description: "Daftar faskes yang ditandai (antrean audit), urut rupiah/O/E/z. Gunakan untuk 'siapa yang paling perlu diperhatikan'.", input_schema: { type: "object", properties: { wilayah: { type: "string", description: _desk("semarang | jateng | nama kab/kota Jawa Tengah") }, modul: { type: "string", enum: Object.keys(NOMOR), description: "kosongkan untuk semua modul" }, status: { type: "string", enum: ["aktif", "perhatian", "diamati", "wajar", "semua"] }, urut: { type: "string", enum: ["rupiah_tertimbang", "rupiah", "OE", "z", "volume"] }, jumlah: { type: "integer" }, sedikit: { type: "boolean", description: "true = hanya baris tipis untuk tabel mini (tanpa rincian modul)" } }, additionalProperties: false } },
  { name: "jelaskan_temuan", description: "Kartu penjelasan satu faskes: O, E, O/E, z, status, penyumbang, pembanding sebaya, bulanan. Gunakan untuk 'kenapa RS-xxxx ditandai'.", input_schema: { type: "object", properties: { faskes: { type: "string", description: "kode, mis. RS-31595 atau FKTP-12345" }, modul: { type: "string", enum: Object.keys(NOMOR) } }, additionalProperties: false } },
  { name: "ambil_indikator", description: "Agregat satu modul untuk suatu wilayah, opsional dipecah per kelas/kepemilikan/jenis FKTP. Termasuk tren bulanan dan metrik model untuk Semarang.", input_schema: { type: "object", properties: { modul: { type: "string", enum: Object.keys(NOMOR) }, wilayah: { type: "string" }, pecah: { type: "string", enum: ["kelas", "kepemilikan", "jenis_fktp"] } }, additionalProperties: false } },
  { name: "bandingkan_kabkota", description: "Peringkat kabupaten/kota Jawa Tengah untuk satu modul (peta L1).", input_schema: { type: "object", properties: { modul: { type: "string", enum: Object.keys(NOMOR) }, urut: { type: "string", enum: ["OE", "rate", "rupiah_tertimbang", "n_perhatian"] }, jumlah: { type: "integer" } }, additionalProperties: false } },
  { name: "aliran_pasien", description: "Asal kab/kota pasien readmisi atau rujukan yang bermuara di RS Kota Semarang (peta L3).", input_schema: { type: "object", properties: { modul: { type: "string", enum: ["readmisi", "rujukan"] }, jumlah: { type: "integer" } }, additionalProperties: false } },
  { name: "demografi_kecamatan", description: "Penduduk, kepadatan, jumlah RS/klinik per kecamatan Kota Semarang (data publik BPS/OSM, konteks, bukan hasil deteksi).", input_schema: { type: "object", properties: { urut: { type: "string", enum: ["penduduk_2025", "kepadatan_2025", "faskes_per_100rb", "rs", "klinik", "pertumbuhan_2020_2025_pct"] } }, additionalProperties: false } },
  { name: "ringkas_wilayah", description: "Ringkasan eksekutif satu wilayah: jumlah faskes, yang perlu perhatian, rupiah, per modul.", input_schema: { type: "object", properties: { wilayah: { type: "string" } }, additionalProperties: false } },
  { name: "faskes_count", description: "Hitungan tipis satu wilayah: jumlah RS, FKTP, dan faskes yang perlu perhatian. Tanpa rupiah/O/E.", input_schema: { type: "object", properties: { wilayah: { type: "string" } }, additionalProperties: false } },
  { name: "trend", description: "Deret bulanan satu modul di Kota Semarang (12 bulan 2024). Gunakan untuk pertanyaan 'naik/turun', 'per bulan'.", input_schema: { type: "object", properties: { wilayah: { type: "string" }, modul: { type: "string", enum: Object.keys(NOMOR) }, period: { type: "integer" } }, additionalProperties: false } },
  { name: "metodologi", description: "Penjelasan cara hitung O/E, ambang, metrik model, sumber data.", input_schema: { type: "object", properties: { topik: { type: "string" } }, additionalProperties: false } },
]