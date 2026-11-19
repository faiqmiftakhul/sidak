import { createContext, useContext } from 'react'

export type Modul = 'rujukan' | 'severity' | 'fragmentasi' | 'readmisi'
export const MODUL: Modul[] = ['rujukan', 'severity', 'fragmentasi', 'readmisi']

export const INFO: Record<Modul, { nomor: number; nama: string; pendek: string; unit: string; kejadian: string; warna: string }> = {
  rujukan: { nomor: 3, nama: 'Rujukan tidak sesuai', pendek: 'Rujukan', unit: 'FKTP', kejadian: 'kunjungan sakit yang dirujuk', warna: '#7C3AED' },
  severity: { nomor: 4, nama: 'Upcoding severity', pendek: 'Severity', unit: 'RS', kejadian: 'rawat inap severity III', warna: '#CA8A04' },
  fragmentasi: { nomor: 9, nama: 'Fragmentasi layanan', pendek: 'Fragmentasi', unit: 'RS', kejadian: 'kunjungan ulang ≤7 hari di RS sama', warna: '#0F9D8F' },
  readmisi: { nomor: 16, nama: 'Readmisi 30 hari', pendek: 'Readmisi', unit: 'RS', kejadian: 'rawat inap ulang ≤30 hari', warna: '#0E7490' },
}

export type Status = 'perhatian' | 'diamati' | 'wajar' | 'volume_rendah'
export const STATUS: Record<Status, { label: string; warna: string; bg: string }> = {
  perhatian: { label: 'Perlu perhatian', warna: '#C2410C', bg: '#FFF7ED' },
  diamati: { label: 'Diamati', warna: '#A16207', bg: '#FEF9C3' },
  wajar: { label: 'Dalam rentang wajar', warna: '#0F9D8F', bg: '#ECFDF5' },
  volume_rendah: { label: 'Volume rendah', warna: '#64748B', bg: '#F1F5F9' },
}

export interface Kontrib { nama: string; O: number; E: number; n: number }
export interface Hasil {
  n: number; O: number; E: number; OE: number | null; z: number | null; V?: number | null; rate: number
  status: Status; stabil: boolean; selisih: number; rupiah: number; rupiah_tertimbang: number
  kontributor: Kontrib[]
  pangsa_nonspes?: number | null; rate_sebelum_putih?: number | null; OE_sebelum_putih?: number | null; z_sebelum_putih?: number | null; pangsa_putih?: number | null
}
export interface Bulan { bln: number; O: number; E: number; n: number; OE?: number | null }
export interface Faskes {
  id: string; label: string; tipe: 'FKRTL' | 'FKTP'; kab: string; prov: string
  kelas: string; kelas_pendek: string; milik: string; jenis: string
  n_ritl?: number; n_rjtl?: number; n_kunjungan?: number
  modul: Partial<Record<Modul, Hasil>>
  rupiah: number; rupiah_tertimbang: number; n_perhatian: number
  bulanan: Partial<Record<Modul, Bulan[]>>
  sampel: Partial<Record<Modul, Record<string, string | number>[]>>
}
export interface KabModul {
  n: number; O: number; E: number; OE: number | null; z: number | null; rate: number | null
  n_faskes: number; n_perhatian: number; n_diamati: number; rupiah: number; rupiah_tertimbang: number
}
export interface Ringkasan {
  kota: string; periode: string; n_faskes_fkrtl: number; n_faskes_fktp: number
  n_perhatian: number; n_diamati: number; rupiah: number; rupiah_tertimbang: number
  per_modul: Record<Modul, { n_faskes: number; n_cukup: number; n_perhatian: number; n_diamati: number; n: number; O: number; E: number; rupiah: number; rupiah_tertimbang: number; n_diputihkan?: number }>
  tren: Record<Modul, Bulan[]>
  aliran: { readmisi: { asal: string; n: number; O: number; E: number }[]; rujukan: { asal: string; n: number; tertimbang: number }[]; pangsa_luar_kota_ritl: number }
  risiko_tinggi: { id: string; faskes: string; umur: number | null; cbg: string; dx: string; los: number; riw_ritl: number; p: number; bln: number }[]
  metrik: Record<string, any>
  min_n: Record<Modul, number>
}
export interface Demografi {
  sumber: Record<string, string>
  kecamatan: { kecamatan: string; kode_bps: string; luas_km2: number; penduduk_2020: number; penduduk_2025: number; kepadatan_2025: number; pertumbuhan_2020_2025_pct: number; rs: number; klinik: number; faskes_per_100rb: number }[]
}

export interface Data {
  faskes: Faskes[]
  kab: Record<string, Partial<Record<Modul, KabModul>>>
  ring: Ringkasan
  demo: Demografi
  geoKab: GeoJSON.FeatureCollection
  geoKec: GeoJSON.FeatureCollection
  geoFaskes: GeoJSON.FeatureCollection
}

export const DataCtx = createContext<Data | null>(null)
export const useData = () => {
  const d = useContext(DataCtx)
  if (!d) throw new Error('data belum dimuat')
  return d
}

export async function muat(): Promise<Data> {
  const j = async (p: string) => (await fetch(p)).json()
  const [faskes, kab, ring, demo, geoKab, geoKec, geoFaskes] = await Promise.all([
    j('/data/faskes_jateng.json'), j('/data/kabkota_jateng.json'), j('/data/semarang.json'),
    j('/data/geo/kecamatan_demografi.json'), j('/data/geo/jateng_kabkota.geojson'),
    j('/data/geo/semarang_kecamatan.geojson'), j('/data/geo/faskes_osm.geojson'),
  ])
  return { faskes, kab, ring, demo, geoKab, geoKec, geoFaskes }
}

export const KOTA = 'KOTA SEMARANG'
export const BULAN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const rp = (v: number | null | undefined, digit = 1): string => {
  if (v == null || isNaN(v)) return '–'
  const a = Math.abs(v)
  if (a >= 1e12) return 'Rp ' + (v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: digit }) + ' T'
  if (a >= 1e9) return 'Rp ' + (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: digit }) + ' M'
  if (a >= 1e6) return 'Rp ' + (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: digit }) + ' jt'
  return 'Rp ' + Math.round(v).toLocaleString('id-ID')
}
export const num = (v: number | null | undefined, digit = 0): string =>
  v == null || isNaN(v) ? '–' : v.toLocaleString('id-ID', { minimumFractionDigits: digit, maximumFractionDigits: digit })
export const pct = (v: number | null | undefined, digit = 1): string => (v == null || isNaN(v) ? '–' : num(v, digit) + '%')
export const oe = (v: number | null | undefined): string => (v == null || isNaN(v) ? '–' : v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export const judulKab = (k: string) => k.split(' ').map(w => (w === 'KOTA' ? 'Kota' : w.charAt(0) + w.slice(1).toLowerCase())).join(' ')

export const aktif = (h?: Hasil) => !!h && (h.status === 'perhatian' || h.status === 'diamati')

/** Rekan sebaya: faskes lain di Jawa Tengah dengan kelas sama dan volume cukup pada modul tsb. */
export function sebaya(all: Faskes[], f: Faskes, m: Modul, k = 3): Faskes[] {
  const cand = all.filter(x => x.id !== f.id && x.tipe === f.tipe && x.kelas === f.kelas && x.modul[m] && x.modul[m]!.status !== 'volume_rendah')
  const n = f.modul[m]?.n ?? 0
  return cand.sort((a, b) => Math.abs((a.modul[m]!.n) - n) - Math.abs((b.modul[m]!.n) - n)).slice(0, k)
}

export const STATUS_AUDIT_KEY = 'sidak_status_audit'
export type StatusAudit = 'belum' | 'sedang' | 'selesai'
export function bacaStatusAudit(): Record<string, StatusAudit> {
  try { return JSON.parse(localStorage.getItem(STATUS_AUDIT_KEY) || '{}') } catch { return {} }
}
export function simpanStatusAudit(id: string, s: StatusAudit) {
  try { const o = bacaStatusAudit(); o[id] = s; localStorage.setItem(STATUS_AUDIT_KEY, JSON.stringify(o)) } catch { /* abaikan */ }
}

export const CATATAN_KEY = 'sidak_catatan'
export const TEMUAN_KEY = 'sidak_temuan'
export const AKTIVITAS_KEY = 'sidak_aktivitas'
export const TAB_KEY = 'sidak_antrean_tab'

export const ambilJSON = (k: string): Record<string, any> => { try { return JSON.parse(localStorage.getItem(k) || '{}') } catch { return {} } }
export const simpanJSON = (k: string, o: Record<string, any>) => { try { localStorage.setItem(k, JSON.stringify(o)) } catch { /* abaikan */ } }

/* ---- Tindak lanjut audit (per faskes): status, kesimpulan, waktu, riwayat ---- */
export const TL_WAKTU_KEY = 'sidak_tl_waktu'
export const LABEL_TL: Record<StatusAudit, string> = { belum: 'Belum diperiksa', sedang: 'Sedang diperiksa', selesai: 'Selesai' }
export const OPSI_KESIMPULAN = ['Dokumentasi medis tidak lengkap', 'Kode perlu klarifikasi', 'Proses layanan perlu perbaikan', 'Tidak ditemukan masalah setelah pemeriksaan']
/** Aksi yang tersedia dari tiap status. "selesai" selalu lewat dialog kesimpulan. */
export const AKSI_TL: Record<StatusAudit, { ke: StatusAudit; label: string; ket?: string }[]> = {
  belum: [{ ke: 'sedang', label: 'Mulai pemeriksaan' }, { ke: 'selesai', label: 'Tandai selesai…', ket: 'Langsung isi kesimpulan' }],
  sedang: [{ ke: 'selesai', label: 'Tandai selesai…', ket: 'Pilih kesimpulan' }, { ke: 'belum', label: 'Batalkan pemeriksaan' }],
  selesai: [{ ke: 'selesai', label: 'Ubah kesimpulan…' }, { ke: 'sedang', label: 'Buka kembali', ket: 'Kembali ke sedang diperiksa' }],
}

/** Kesimpulan tersimpan; nilai bawaan lama "Belum ada kesimpulan" dianggap kosong. */
export const bacaKesimpulan = (id: string): string => { const v = String(ambilJSON(TEMUAN_KEY)[id] ?? ''); return OPSI_KESIMPULAN.includes(v) ? v : '' }
export const bacaWaktuTL = (id: string): number | null => { const v = ambilJSON(TL_WAKTU_KEY)[id]; return typeof v === 'number' ? v : null }

export interface SnapshotTL { st: StatusAudit; kes: unknown; cat: unknown; waktu: unknown; akt: unknown }
const ambilAtauHapus = (k: string, id: string, v: unknown) => { const o = ambilJSON(k); if (v === undefined) delete o[id]; else o[id] = v; simpanJSON(k, o) }
export const snapshotTL = (id: string): SnapshotTL => ({
  st: bacaStatusAudit()[id] ?? 'belum', kes: ambilJSON(TEMUAN_KEY)[id], cat: ambilJSON(CATATAN_KEY)[id], waktu: ambilJSON(TL_WAKTU_KEY)[id], akt: ambilJSON(AKTIVITAS_KEY)[id],
})
/** Urungkan: kembalikan persis keadaan sebelum aksi, termasuk riwayat. */
export function pulihkanTL(id: string, s: SnapshotTL) {
  simpanStatusAudit(id, s.st)
  ambilAtauHapus(TEMUAN_KEY, id, s.kes); ambilAtauHapus(CATATAN_KEY, id, s.cat); ambilAtauHapus(TL_WAKTU_KEY, id, s.waktu); ambilAtauHapus(AKTIVITAS_KEY, id, s.akt)
}
export function catatAktivitas(id: string, s: string) {
  const o = ambilJSON(AKTIVITAS_KEY); const a = Array.isArray(o[id]) ? o[id] : []
  o[id] = [...a, { t: Date.now(), s }].slice(-24); simpanJSON(AKTIVITAS_KEY, o)
}
/** Satu pintu untuk semua perubahan tindak lanjut (Antrean, Profil): status, waktu, kesimpulan, catatan, riwayat. */
export function ubahTindakLanjut(id: string, ke: StatusAudit, opsi: { kesimpulan?: string; catatan?: string } = {}) {
  const lama = bacaStatusAudit()[id] ?? 'belum'
  if (ke === 'selesai' && !opsi.kesimpulan) return
  simpanStatusAudit(id, ke)
  if (ke !== lama) { const w = ambilJSON(TL_WAKTU_KEY); w[id] = Date.now(); simpanJSON(TL_WAKTU_KEY, w) }
  if (opsi.kesimpulan) ambilAtauHapus(TEMUAN_KEY, id, opsi.kesimpulan)
  if (opsi.catatan !== undefined) ambilAtauHapus(CATATAN_KEY, id, opsi.catatan.trim() ? opsi.catatan : undefined)
  const s = ke === 'selesai' ? (lama === 'selesai' ? `kesimpulan diubah · ${opsi.kesimpulan}` : `selesai · ${opsi.kesimpulan}`)
    : ke === 'sedang' ? (lama === 'selesai' ? 'dibuka kembali' : 'pemeriksaan dimulai')
    : 'pemeriksaan dibatalkan'
  catatAktivitas(id, s)
}
