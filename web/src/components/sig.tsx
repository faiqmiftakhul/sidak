import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { mdiAlertOutline, mdiBookOpenVariant, mdiCheckCircleOutline, mdiChevronDown, mdiContentCopy, mdiEyeOutline, mdiInformationOutline } from '@mdi/js'
import { Bulan, STATUS, Status, StatusAudit, num, oe, rp } from '../lib/data'
import { Icon } from './Icon'

const IKON_STATUS: Record<Status, string> = {
  perhatian: mdiAlertOutline,
  diamati: mdiEyeOutline,
  wajar: mdiCheckCircleOutline,
  volume_rendah: mdiInformationOutline,
}

/** Status faskes: ikon + label. Warna selalu amber/slate — merah tidak pernah untuk unsur non-sistem. */
export function StatusPill({ s, md }: { s: Status; md?: boolean }) {
  return (
    <span className={'status ' + s + (md ? ' md' : '')} style={{ color: STATUS[s].warna, background: STATUS[s].bg }}>
      <Icon path={IKON_STATUS[s]} size={md ? 15 : 12} />{STATUS[s].label}
    </span>
  )
}

const LEBAR = { normal: 64, besar: 128 } as const
const BATAS = 2.4

function Track({ v, besar, warna, ci, med }: { v: number | null; besar?: boolean; warna: string; ci?: [number, number] | null; med?: number | null }) {
  const W = besar ? LEBAR.besar : LEBAR.normal
  const H = besar ? 18 : 12
  const P = 4
  const x = (x0: number) => P + (Math.min(Math.max(x0, 0), BATAS) / BATAS) * (W - P * 2)
  const y = H / 2
  const lo = ci ? x(ci[0]) : null, hi = ci ? x(ci[1]) : null
  return (
    <svg className="otrack" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1={P} x2={W - P} y1={y} y2={y} stroke="var(--line)" strokeWidth={2} strokeLinecap="round" />
      <line x1={x(1)} x2={x(1)} y1={y - 3} y2={y + 3} stroke="var(--grey-2)" strokeWidth={1.3} />
      {besar && lo != null && hi != null && <line x1={lo} x2={hi} y1={y - 5} y2={y - 5} stroke={warna} strokeWidth={4} strokeOpacity={.3} strokeLinecap="round" />}
      {besar && lo != null && <line x1={lo} x2={lo} y1={y - 7} y2={y - 3} stroke={warna} strokeWidth={1.6} strokeOpacity={.6} />}
      {besar && hi != null && <line x1={hi} x2={hi} y1={y - 7} y2={y - 3} stroke={warna} strokeWidth={1.6} strokeOpacity={.6} />}
      {besar && med != null && <line x1={x(med)} x2={x(med)} y1={y - 3} y2={y + 3} stroke="var(--grey)" strokeWidth={1.6} strokeDasharray="2 2" />}
      {v != null && <circle cx={x(v)} cy={y} r={besar ? 4.5 : 3.5} fill={warna} stroke="#fff" strokeWidth={1.2} />}
    </svg>
  )
}

/** Rasio O/E dengan rel 1,0 + skor z + tanda n kecil. Besar: kimia CI & median sebaya. */
export function OEChip({ v, z, n, st, besar, ci, med }: {
  v: number | null; z?: number | null; n?: number; st: Status; besar?: boolean; ci?: [number, number] | null; med?: number | null
}) {
  const warna = st ? STATUS[st].warna : 'var(--brand)'
  const ketil = n != null && n < 30 && !besar
  const judul = v == null
    ? `${STATUS[st]?.label?.toLowerCase() ?? 'status'} — tidak ada O/E.`
    : `O/E ${oe(v)}${z != null ? ` · z ${num(z, 1)}` : ''}. 1,0 = sesuai rekan sebaya.${n != null ? ` (n=${num(n)})` : ''}${st === 'volume_rendah' ? ' — volume di bawah ambang minimum.' : ''}`
  return (
    <span className={'oechip' + (besar ? ' besar' : '') + (ketil ? ' kecil' : '')} title={judul}>
      <Track v={v} besar={besar} warna={warna} ci={ci} med={med} />
      <b style={{ color: warna }}>{oe(v)}</b>
      {z != null && !besar && <span className="z">z {num(z, 1)}</span>}
      {ketil && <span className="z">n&lt;30</span>}
    </span>
  )
}

/** Angka rupiah dengan awalan "≈" (orde besaran, bukan angka pasti). */
export function RupiahText({ v }: { v: number | null | undefined }) {
  return <span className="rt" title="≈ = (O−E) × biaya rata-rata per kejadian × bobot sampel. Orde besaran, bukan angka pasti.">{rp(v)}</span>
}

/** Kode faskes samaran: klik untuk salin. */
export function FaskesCode({ id }: { id: string }) {
  const [kopi, setKopi] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const salin = async () => {
    try { await navigator.clipboard.writeText(id) } catch { /* abaikan */ }
    setKopi(true); window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setKopi(false), 1400)
  }
  return <button type="button" className={'fcode' + (kopi ? ' kopi' : '')} onClick={salin} title="Salin kode samaran"><Icon path={mdiContentCopy} size={12} />{id}</button>
}

/** Titik sebaran O/E rekan sebaya (abu) vs faskes ini (amber), rel 1,0 putus-putus. */
export function DotPlot({ nilai, f, kelas }: { nilai: number[]; f: number; kelas: string }) {
  const semua = [f, ...nilai]
  const max = Math.max(BATAS, ...semua) * 1.08
  const W = 200, H = 30, y = H / 2
  const x = (v: number) => 8 + (Math.min(Math.max(v, 0), max) / max) * (W - 16)
  return (
    <svg className="dotplot" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sebaran O/E ${kelas}: kotak amber = faskes ini, titik abu = rekan sebaya, 1,0 = wajar.`}>
      <line x1={8} x2={W - 8} y1={y} y2={y} stroke="var(--line)" strokeWidth={1.5} />
      <line x1={x(1)} x2={x(1)} y1={y - 4} y2={y + 4} stroke="var(--grey-2)" strokeWidth={1.2} strokeDasharray="3 3" />
      {nilai.map((v, i) => <circle key={i} cx={x(v)} cy={y + ((i % 3 - 1) * 7)} r={3} fill="var(--grey-2)" opacity={.8} />)}
      <circle cx={x(f)} cy={y} r={5} fill="var(--perhatian)" stroke="#fff" strokeWidth={1.2} />
    </svg>
  )
}

/** Sparkline mini tren O/E bulanan (tabel & kartu). */
export function Spark({ rows }: { rows: Bulan[] }) {
  const vals = rows.map((r, i) => ({ i, v: r.OE ?? (r.E > 0 ? r.O / r.E : null) })).filter(p => p.v != null)
  if (vals.length < 2) return null
  const W = 92, H = 26, P = 3
  const max = Math.max(BATAS, ...vals.map(p => p.v as number)) * 1.05
  const x = (i: number) => P + (i / (vals.length - 1)) * (W - P * 2)
  const y = (v: number) => H - P - (Math.min(Math.max(v, 0), max) / max) * (H - P * 2)
  const pts = vals.map(p => `${x(p.i)},${y(p.v as number)}`).join(' ')
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1={P} x2={W - P} y1={y(1)} y2={y(1)} stroke="var(--grey-2)" strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TAHAP: { nilai: StatusAudit; label: string }[] = [
  { nilai: 'belum', label: 'Belum' },
  { nilai: 'sedang', label: 'Sedang' },
  { nilai: 'selesai', label: 'Selesai' },
]
export const LABEL_AUDIT: Record<StatusAudit, string> = TAHAP.reduce((o, t) => ({ ...o, [t.nilai]: t.label }), {} as Record<StatusAudit, string>)

/** Stepper progres audit Belum → Sedang → Selesai. */
export function Progres({ nilai, fb }: { nilai: StatusAudit; fb: (s: StatusAudit) => void }) {
  return (
    <span className="step" role="group" aria-label="Progres audit">
      {TAHAP.map((t, i) => <button key={t.nilai} type="button" className={nilai === t.nilai ? 'on s' + i : ''} aria-pressed={nilai === t.nilai} onClick={() => fb(t.nilai)}>{t.label}</button>)}
    </span>
  )
}

const AKORDEON = [
  {
    jdl: 'O/E — nyata ÷ wajar',
    isi: (
      <>O = kejadian yang benar-benar tercatat pada sampel; E = kejadian yang wajar bila pasien dilayani seperti rekan sebaya. <b>O/E 1,0 = sesuai wajar</b>; 1,3 = 30% lebih banyak dari wajar. Contoh: 14 readmisi nyata vs 10 wajar → O/E 1,40.</>
    ),
  },
  {
    jdl: 'Skor z — kebetulan atau bukan',
    isi: (
      <>Mengukur apakah selisih (O−E) sekadar kebetulan. <b>z &gt; 1,96</b> berarti kecil kemungkinan selisih terjadi secara acak (P≈0,05). O/E dan z dibaca berpasangan: faskes kecil bisa ber-O/E tinggi tetapi z-nya rendah.</>
    ),
  },
  {
    jdl: 'Selisih rupiah (≈)',
    isi: (
      <>≈ = (O−E) × biaya rata-rata per kejadian × bobot sampel ke populasi peserta. Ini <b>orde besaran untuk memprioritaskan</b> audit, bukan klaim-angka. Komponen biaya dari klaim F-KL pada Data Sampel yang terboboti.</>
    ),
  },
]

/** Popover "Metode": cara membaca angka + pintu ke halaman Metodologi. */
export function MethodPopover() {
  const [buka, setBuka] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setBuka(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [])
  return (
    <div className="topbarkanan" ref={ref}>
      <button type="button" className="met" onClick={() => setBuka(b => !b)} aria-expanded={buka}><Icon path={mdiBookOpenVariant} size={16} /><span className="met-txt">Metode</span><Icon path={mdiChevronDown} size={14} /></button>
      {buka && <div className="method-po">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Cara membaca angka</div>
        {AKORDEON.map(a => <details className="acc" key={a.jdl}><summary>{a.jdl}</summary><div className="isi">{a.isi}</div></details>)}
        <Link className="btn" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} to="/metodologi" onClick={() => setBuka(false)}>Buka halaman Metodologi</Link>
      </div>}
    </div>
  )
}