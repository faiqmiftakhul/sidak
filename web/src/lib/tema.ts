import { createContext, useContext } from 'react'
import type { Modul, Status } from './data'

export type Tema = 'terang' | 'gelap'
export const TEMA_KEY = 'sidak_tema'

export interface KtxTema { tema: Tema; setTema: (t: Tema) => void; gelap: boolean }
export const TemaCtx = createContext<KtxTema>({ tema: 'terang', setTema: () => {}, gelap: false })
export const useTema = () => useContext(TemaCtx)

/** Tema awal: pilihan tersimpan, kalau belum ada ikut setelan sistem. */
export function temaAwal(): Tema {
  try {
    const t = localStorage.getItem(TEMA_KEY)
    if (t === 'terang' || t === 'gelap') return t
  } catch { /* peramban tanpa storage */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang'
}

export function pasangTema(t: Tema) {
  document.documentElement.setAttribute('data-tema', t)
  try { localStorage.setItem(TEMA_KEY, t) } catch { /* abaikan */ }
}

/**
 * Palet untuk hal-hal yang tidak bisa memakai var() CSS: atribut SVG Recharts
 * dan paint MapLibre. Nilainya harus sejalan dengan token di styles.css.
 */
export interface Palet {
  status: Record<Status, { warna: string; bg: string; garis: string }>
  modul: Record<Modul, string>
  nyata: string
  wajar: string
  kisi: string
  sumbu: string
  kartu: string
  teks: string
  garis: string
  petaLatar: string
  petaGaris: string
  petaKosong: string
  seq: string[]
  oe: string[]
  aliran: string
  rs: string
  klinik: string
  pilih: string
}

export const PALET: Record<Tema, Palet> = {
  terang: {
    status: {
      perhatian: { warna: '#B53333', bg: '#FBECEC', garis: '#F0D2D2' },
      diamati: { warna: '#8A5E06', bg: '#FDF3DF', garis: '#F0E0B4' },
      wajar: { warna: '#0C6B49', bg: '#E6F6EF', garis: '#C6E6D6' },
      volume_rendah: { warna: '#5F6875', bg: '#EEF1F5', garis: '#DCE1E9' },
    },
    modul: { rujukan: '#5B4CC4', severity: '#C88A0A', fragmentasi: '#148F63', readmisi: '#14488B' },
    nyata: '#B53333',
    wajar: '#0D366B',
    kisi: '#E4E9F0',
    sumbu: '#5F6875',
    kartu: '#FFFFFF',
    teks: '#16202E',
    garis: '#DCE1E9',
    petaLatar: '#E3EAF3',
    petaGaris: '#FFFFFF',
    petaKosong: '#EDEFF3',
    seq: ['#EAF0F6', '#C5D6EA', '#93B3D9', '#5B86BC', '#0D366B'],
    oe: ['#148F63', '#A9C6EA', '#C88A0A', '#B53333'],
    aliran: '#5B4CC4',
    rs: '#B53333',
    klinik: '#148F63',
    pilih: '#0D366B',
  },
  gelap: {
    status: {
      perhatian: { warna: '#F5A19A', bg: '#33191B', garis: '#5A2A2A' },
      diamati: { warna: '#EFC868', bg: '#33280F', garis: '#5A4718' },
      wajar: { warna: '#63D3A7', bg: '#102E24', garis: '#1D5340' },
      volume_rendah: { warna: '#8593A8', bg: '#1B2739', garis: '#38485F' },
    },
    modul: { rujukan: '#9186E8', severity: '#E4B23F', fragmentasi: '#3EC08C', readmisi: '#5E9AE6' },
    nyata: '#EE7B72',
    wajar: '#7FB2F0',
    kisi: '#25324A',
    sumbu: '#8593A8',
    kartu: '#141D2E',
    teks: '#E8EEF7',
    garis: '#27344A',
    petaLatar: '#17222F',
    petaGaris: '#0B1220',
    petaKosong: '#1B2636',
    seq: ['#1B2739', '#22384F', '#2C5178', '#3A72A8', '#5E9AE6'],
    oe: ['#3EC08C', '#3C6E9E', '#E4B23F', '#EE7B72'],
    aliran: '#9186E8',
    rs: '#EE7B72',
    klinik: '#3EC08C',
    pilih: '#7FB2F0',
  },
}

export const usePalet = (): Palet => PALET[useTema().tema]
