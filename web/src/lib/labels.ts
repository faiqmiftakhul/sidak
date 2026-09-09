import { mdiArrowSplitVertical, mdiArrowTopRight, mdiCalendarMonth, mdiClipboardList, mdiDatabaseOutline, mdiHistory, mdiMap, mdiPageLayoutSidebarLeft, mdiTrendingUp, mdiViewGridOutline } from '@mdi/js'
import { Modul } from './data'

export interface NavItem { label: string; desc: string; icon: string }

/** Satu-satunya sumber label navigasi. Dipakai sidebar, breadcrumb, dan judul dokumen. */
export const NAV: Record<'home' | 'peta' | 'antrean', NavItem> = {
  home: { label: 'Ringkasan', desc: 'Angka utama, peta, tren bulanan, antrean', icon: mdiViewGridOutline },
  peta: { label: 'Peta', desc: 'Sebaran faskes per wilayah dan aliran pasien', icon: mdiMap },
  antrean: { label: 'Antrean audit', desc: 'Temuan terurut prioritas untuk verifikasi', icon: mdiClipboardList },
}

export const MODUL_NAV: Record<Modul, NavItem> = {
  rujukan: { label: '#3 Rujukan tidak sesuai', desc: 'FKTP yang merujuk jauh di atas rekan sebaya', icon: mdiArrowTopRight },
  severity: { label: '#4 Upcoding keparahan', desc: 'Rawat inap severity III di atas yang wajar', icon: mdiTrendingUp },
  fragmentasi: { label: '#9 Fragmentasi layanan', desc: 'Kunjungan ulang ≤7 hari di RS sama', icon: mdiArrowSplitVertical },
  readmisi: { label: '#16 Readmisi 30 hari', desc: 'Rawat inap ulang ≤30 hari setelah pulang', icon: mdiHistory },
}

export const FOOT_PERIODE = { icon: mdiCalendarMonth, label: 'Periode data saat ini' }
export const FOOT_SAMPEL = { icon: mdiDatabaseOutline, label: 'Data klaim sampel ±1%, kode disamarkan' }
export const TOGGLE = {
  icon: mdiPageLayoutSidebarLeft,
  sempit: 'Sembunyikan',
  lebar: 'Tampilkan',
  sempitTip: 'Sembunyikan label menu',
  lebarTip: 'Tampilkan label menu',
}
export const BRAND_JUDUL = 'SIDAK — Sistem Informasi Deteksi Anomali Klaim'