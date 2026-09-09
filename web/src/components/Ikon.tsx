/**
 * Ikon garis 24×24 yang digambar langsung (tanpa pustaka, tanpa unduhan daring)
 * supaya aplikasi tetap utuh saat luring. Emoji tidak dipakai sebagai ikon
 * karena bentuknya berbeda-beda antar sistem dan tidak ikut warna teks.
 */
import type { ReactNode } from 'react'

export type NamaIkon =
  | 'beranda' | 'peta' | 'antrean' | 'buku' | 'obrolan' | 'matahari' | 'bulan'
  | 'menu' | 'silang' | 'unduh' | 'kanan' | 'cari' | 'perisai' | 'panah'

const JALUR: Record<NamaIkon, ReactNode> = {
  beranda: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  peta: <><path d="m9 4-6 2.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5" /><path d="M15 6.5V20" /></>,
  antrean: <><path d="M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><rect x="8.5" y="2.5" width="7" height="4" rx="1" /><path d="m8.5 12 1.8 1.8L14 10" /><path d="M8.5 17.5h7" /></>,
  buku: <><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H9a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H3z" /><path d="M21 5.5A1.5 1.5 0 0 0 19.5 4H15a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H21z" /></>,
  obrolan: <><path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5v-15A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5z" /><path d="M8.5 8.5h7" /><path d="M8.5 12h4.5" /></>,
  matahari: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></>,
  bulan: <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  silang: <path d="m6 6 12 12M18 6 6 18" />,
  unduh: <><path d="M12 3v12" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 20h16" /></>,
  kanan: <path d="m9 5 7 7-7 7" />,
  cari: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  perisai: <><path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.6 7.5 10 4.3-1.4 7.5-5 7.5-10v-6z" /><path d="m8.8 11.8 2.2 2.2 4.2-4.2" /></>,
  panah: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
}

interface Props { nama: NamaIkon; ukuran?: number; tebal?: number; className?: string }

export default function Ikon({ nama, ukuran = 18, tebal = 1.7, className }: Props) {
  return (
    <svg
      className={className} width={ukuran} height={ukuran} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={tebal} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      {JALUR[nama]}
    </svg>
  )
}
