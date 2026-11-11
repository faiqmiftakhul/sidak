// Loader data statis untuk Cloudflare Pages Functions.
// MENYALIN persis perilaku api/main.py pada aset web/public/data/**
// (bukan data per-kota: data sampel hanya Kota Semarang + Jawa Tengah).

export const KOTA = "KOTA SEMARANG"
export const NOMOR: Record<string, number> = { rujukan: 3, severity: 4, fragmentasi: 9, readmisi: 16 }
export const NAMA: Record<string, string> = {
  rujukan: "Rujukan tidak sesuai",
  severity: "Upcoding severity",
  fragmentasi: "Fragmentasi layanan",
  readmisi: "Readmisi 30 hari",
}
export const STATUS: Record<string, string> = {
  perhatian: "Perlu perhatian",
  diamati: "Diamati",
  wajar: "Dalam rentang wajar",
  volume_rendah: "Volume rendah (tidak dinilai)",
}

export interface Indikator {
  n: number; O: number; E: number; OE: number; z: number; rate: number
  status: string; stabil: boolean; selisih: number
  rupiah: number; rupiah_tertimbang: number; kontributor: unknown[]
}
export interface Faskes {
  id: string; label: string; tipe: string; kab: string; prov: string
  kelas: string; kelas_pendek: string; milik: string; jenis: string
  n_ritl: number; n_rjtl: number
  modul: Record<string, Indikator>
  rupiah: number; rupiah_tertimbang: number; n_perhatian: number
  bulanan?: Record<string, unknown>; sampel?: unknown
}

const _g = globalThis as any

function setBase(url: string): void {
  _g.SIDAK_BASE = new URL(url).origin
}
function base(): string {
  return _g.SIDAK_BASE ?? ""
}

interface KurvaJ { dt: string; O: number; E: number; n: number; OE: number; bln?: number }
interface Ring {
  periode: string; min_n: Record<string, number>
  tren: Record<string, KurvaJ[]>
  metrik: Record<string, Record<string, unknown>>
  aliran: Record<string, unknown> & {
    readmisi: { asal: string; n: number; O: number; E: number }[]
    rujukan: { asal: string; n: number; tertimbang: number }[]
    pangsa_luar_kota_ritl?: number
  }
  n_faskes_fkrtl?: number; n_faskes_fktp?: number
}
interface KabModul { [m: string]: Partial<Indikator> & { n_faskes?: number; n_perhatian?: number; n_diamati?: number } }
interface Demo { sumber: Record<string, string>; kecamatan: Record<string, unknown>[] }

export interface Store {
  faskes: Faskes[]
  kab: Record<string, KabModul>
  ring: Ring
  demo: Demo
  idx: Record<string, Faskes>
  dv: string
  t: number
}

export async function digestHex(data: string): Promise<string> {
  const buf = new TextEncoder().encode(data)
  const h = await crypto.subtle.digest("SHA-1", buf)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("")
}

async function getJson<T>(rel: string): Promise<T> {
  return (await ambil(rel)).json() as Promise<T>
}

async function getText(rel: string): Promise<string> {
  return (await ambil(rel)).text()
}

async function ambil(rel: string): Promise<Response> {
  const aset = _g.SIDAK_ASSETS as { fetch: (u: string) => Promise<Response> } | undefined
  const url = new URL(rel, aset ? "https://assets.local" : base()).toString()
  const res = aset ? await aset.fetch(url) : await fetch(url)
  if (!res.ok) throw new Error(`data ${rel}: ${res.status}`)
  return res
}

function setAset(aset: unknown): void {
  _g.SIDAK_ASSETS = aset
}

let _store: Promise<Store> | null = null

export function store(): Promise<Store> {
  if (_store) return _store
  _store = (async () => {
    const [faskes, kab, ring, demo, ringTeks] = await Promise.all([
      getJson<Faskes[]>("/data/faskes_jateng.json"),
      getJson<Record<string, KabModul>>("/data/kabkota_jateng.json"),
      getJson<Ring>("/data/semarang.json"),
      getJson<Demo>("/data/geo/kecamatan_demografi.json"),
      getText("/data/semarang.json"),
    ])
    const idx: Record<string, Faskes> = {}
    for (const f of faskes) idx[f.id] = f
    const dv = (await digestHex(ringTeks)).slice(0, 10)
    return { faskes, kab, ring, demo, idx, dv, t: Date.now() / 1000 }
  })()
  return _store
}

export const rp = (v: number | null | undefined): string => {
  if (v == null) return "-"
  const a = Math.abs(v)
  const id = (x: number, suf: string) => "Rp " + x.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " " + suf
  if (a >= 1e12) return id(v / 1e12, "T")
  if (a >= 1e9) return id(v / 1e9, "M")
  if (a >= 1e6) return id(v / 1e6, "jt")
  return "Rp " + Math.round(v).toLocaleString("id-ID")
}

// status ujung yang dibawa alat: volumen kecil → status "volume_rendah" tidak pernah jadi "perhatian".
export const int = (v: unknown, d = 0): number => {
  const n = parseInt(String(v ?? ""), 10)
  return Number.isFinite(n) ? n : d
}

export async function wilayahFaskes(wilayah?: string): Promise<{ fs: Faskes[]; wil: string }> {
  const S = await store()
  const w = (wilayah || "semarang").trim().toUpperCase()
  if (w === "SEMARANG" || w === "KOTA SEMARANG" || w === "") {
    return { fs: S.faskes.filter(f => f.kab === KOTA), wil: KOTA }
  }
  if (w === "JATENG" || w === "JAWA TENGAH" || w === "PROVINSI") {
    return { fs: S.faskes, wil: "JAWA TENGAH" }
  }
  const kab = Object.keys(S.kab).find(k => k === w || k.replace("KOTA ", "") === w.replace("KOTA ", ""))
  if (kab) return { fs: S.faskes.filter(f => f.kab === kab), wil: kab }
  return { fs: S.faskes.filter(f => f.kab === KOTA), wil: KOTA }
}

export function ringkasFaskes(f: Faskes, m?: string | null): Record<string, unknown> {
  const o: Record<string, unknown> = {
    faskes: f.label, tipe: f.tipe, kab_kota: f.kab, kelas: f.kelas_pendek, kepemilikan: f.milik,
    selisih_rupiah_sampel: f.rupiah, selisih_rupiah_tertimbang: f.rupiah_tertimbang, tautan: "/faskes/" + f.id,
  }
  const mods = m ? [m] : Object.keys(f.modul)
  const mo: Record<string, unknown> = {}
  for (const k of mods) {
    const h = f.modul[k]
    if (!h) continue
    mo[k] = {
      nomor: NOMOR[k], nama: NAMA[k], status: STATUS[h.status], stabil_dua_paruh: h.stabil,
      volume: h.n, observed: h.O, expected: h.E, OE: h.OE, z: h.z,
      angka_mentah_pct: h.rate, selisih_kejadian: h.selisih,
      selisih_rupiah_sampel: h.rupiah, selisih_rupiah_tertimbang: h.rupiah_tertimbang,
      penyumbang_terbesar: h.kontributor,
    }
    for (const e of ["pangsa_nonspes", "rate_sebelum_putih", "OE_sebelum_putih", "pangsa_putih"]) {
      const v = (h as unknown as Record<string, unknown>)[e]
      if (v != null) (mo[k] as Record<string, unknown>)[e] = v
    }
  }
  o.modul = mo
  return o
}

export interface Cadangan { tanya: string; jawab: { teks: string; angka?: unknown[]; tautan?: unknown[] } }

let _cadanganCache: Cadangan[] | null = null
export async function muatCadangan(): Promise<Cadangan[]> {
  if (_cadanganCache) return _cadanganCache
  _cadanganCache = await getJson<Cadangan[]>("/data/jawaban_cadangan.json")
  return _cadanganCache
}

// Inisialisasi harus dipanggil di setiap onRequest agar tahu origin statis
// dan binding ASSETS (jika memuat data dari emulator/produksi).
export function inisialisasi(request: Request, env?: Record<string, unknown>): void {
  setBase(request.url)
  if (env && env.ASSETS) setAset(env.ASSETS)
}