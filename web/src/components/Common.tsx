import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bulan, BULAN, Faskes, Hasil, INFO, Modul, STATUS, Status, num, oe, pct, rp, sebaya, useData } from '../lib/data'
import { Palet, usePalet } from '../lib/tema'

/** Kepala halaman: baris kecil, judul, kalimat pembuka, dan tempat untuk aksi. */
export function Kepala({ eyebrow, judul, sub, aksi }: { eyebrow: string; judul: ReactNode; sub?: ReactNode; aksi?: ReactNode }) {
  return (
    <header className="card-kepala" style={{ alignItems: 'flex-start', marginBottom: 'var(--s4)' }}>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{judul}</h1>
        {sub && <p className="sub" style={{ marginBottom: 0 }}>{sub}</p>}
      </div>
      {aksi}
    </header>
  )
}

export const Pill = ({ s }: { s: Status }) => {
  const p = usePalet().status[s]
  return (
    <span className="pill" style={{ background: p.bg, color: p.warna, borderColor: p.garis }}>
      <span className="titik" aria-hidden="true" />{STATUS[s].label}
    </span>
  )
}

export function Kpi({ label, nilai, warna, hint }: { label: string; nilai: string; warna?: 'red' | 'green' | 'amber'; hint?: ReactNode }) {
  return (
    <div className={'card kpi ' + (warna ?? '')}>
      <div className="l">{label}</div>
      <div className="v">{nilai}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

/**
 * Baris tabel yang bisa diklik sekaligus dijangkau papan ketik (Tab lalu Enter);
 * sebelumnya baris hanya punya onClick sehingga tak terjangkau tanpa tetikus.
 */
export const barisKlik = (buka: () => void) => ({
  className: 'klik',
  tabIndex: 0,
  onClick: buka,
  onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buka() }
  },
})

/** Bungkus tabel supaya bisa digulir mendatar di layar sempit, bukan merusak tata letak. */
export const BungkusTabel = ({ children }: { children: ReactNode }) => <div className="tabel-bungkus">{children}</div>

const gayaTooltip = (p: Palet) => ({
  contentStyle: { background: p.kartu, border: '1px solid ' + p.garis, borderRadius: 6, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,.18)' },
  labelStyle: { color: p.teks, fontWeight: 600 },
  itemStyle: { color: p.sumbu },
})

export function Tren({ rows, tinggi = 220, judul }: { rows: Bulan[]; tinggi?: number; judul?: string }) {
  const p = usePalet()
  const d = rows.map(r => ({ bln: BULAN[r.bln], Nyata: r.O, Wajar: Math.round(r.E * 10) / 10, OE: r.E > 0 ? Math.round((r.O / r.E) * 100) / 100 : null }))
  return (
    <div>
      {judul && <h3>{judul}</h3>}
      <ResponsiveContainer width="100%" height={tinggi}>
        <LineChart data={d} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={p.kisi} vertical={false} />
          <XAxis dataKey="bln" tick={{ fontSize: 11, fill: p.sumbu }} stroke={p.garis} />
          <YAxis tick={{ fontSize: 11, fill: p.sumbu }} stroke={p.garis} />
          <Tooltip formatter={(v: any) => num(Number(v), 1)} {...gayaTooltip(p)} />
          <Legend wrapperStyle={{ fontSize: 12, color: p.sumbu }} />
          <Line type="monotone" dataKey="Nyata" stroke={p.nyata} strokeWidth={2} isAnimationActive={false} dot={{ r: 3, fill: p.nyata, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="Wajar" stroke={p.wajar} strokeWidth={2} isAnimationActive={false} strokeDasharray="5 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Peringkat({ rows, m, nilai = 'OE', tinggi = 320 }: { rows: Faskes[]; m: Modul; nilai?: 'OE' | 'rate' | 'rupiah'; tinggi?: number }) {
  const p = usePalet()
  const d = rows.map(f => ({ nama: f.label, v: nilai === 'OE' ? f.modul[m]!.OE ?? 0 : nilai === 'rate' ? f.modul[m]!.rate : f.modul[m]!.rupiah, status: f.modul[m]!.status, id: f.id }))
  return (
    <ResponsiveContainer width="100%" height={tinggi}>
      <BarChart data={d} layout="vertical" margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
        <CartesianGrid stroke={p.kisi} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: p.sumbu }} stroke={p.garis} tickFormatter={(v: any) => (nilai === 'rupiah' ? rp(v, 0) : nilai === 'rate' ? v + '%' : oe(v))} />
        <YAxis type="category" dataKey="nama" width={90} tick={{ fontSize: 11, fill: p.sumbu }} stroke={p.garis} />
        <Tooltip formatter={(v: any) => (nilai === 'rupiah' ? rp(Number(v)) : nilai === 'rate' ? pct(Number(v)) : oe(Number(v)))} cursor={{ fill: p.kisi, opacity: .5 }} {...gayaTooltip(p)} />
        <Bar dataKey="v" isAnimationActive={false} shape={(pr: any) => <rect x={pr.x} y={pr.y} width={pr.width} height={pr.height} fill={p.status[pr.payload.status as Status].warna} rx={3} />} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Kartu penjelasan wajib: O, E, O/E, z, sebaya, penyumbang, dan kalimat pengingat. */
export function Penjelasan({ f, m, h }: { f: Faskes; m: Modul; h: Hasil }) {
  const data = useData()
  const peers = sebaya(data.faskes, f, m)
  const cls = h.status === 'perhatian' ? 'red' : h.status === 'diamati' ? 'amber' : h.status === 'wajar' ? 'green' : ''
  const info = INFO[m]
  return (
    <div className={'explain ' + cls}>
      <b>Mengapa {f.label} berstatus “{STATUS[h.status].label}” pada modul #{info.nomor}?</b>
      <div style={{ marginTop: 6 }}>
        Dari <b>{num(h.n)}</b> {info.unit === 'FKTP' ? 'kunjungan sakit' : m === 'fragmentasi' ? 'kunjungan rawat jalan' : 'rawat inap'}, tercatat <b>{num(h.O)}</b> {info.kejadian} ({pct(h.rate)}).
        Dengan bauran kasus yang sama, rekan sebaya menghasilkan <b>{num(h.E, 1)}</b> kejadian yang wajar. Rasio O/E <b>{oe(h.OE)}</b>, skor z <b>{h.z == null ? '–' : num(h.z, 2)}</b>
        {h.status === 'volume_rendah' ? <> — volume di bawah ambang minimum sehingga tidak dinilai.</> : h.status === 'wajar' ? <> — masih di dalam rentang wajar.</> : h.stabil ? <> — melewati ambang ganda (O/E &gt; 1,05 dan z &gt; 1,96) dan konsisten di dua paruh periode.</> : <> — melewati ambang tetapi belum konsisten di dua paruh periode, sehingga hanya diamati.</>}
        {h.selisih > 0 && h.status !== 'volume_rendah' && <> Selisih <b>{num(h.selisih, 1)}</b> kejadian ≈ <b>{rp(h.rupiah)}</b> pada sampel (≈ {rp(h.rupiah_tertimbang)} tertimbang).</>}
      </div>
      {h.kontributor.length > 0 && <div style={{ marginTop: 6 }}>Penyumbang terbesar: {h.kontributor.map(k => <span key={k.nama} className="mono" style={{ marginRight: 8 }}>{k.nama} ({k.O} vs {num(k.E, 1)})</span>)}</div>}
      {peers.length > 0 && <div style={{ marginTop: 6 }}>Pembanding sebaya ({f.kelas_pendek}, Jawa Tengah): {peers.map(p => <Link key={p.id} to={'/faskes/' + p.id} style={{ marginRight: 8 }}>{p.label} O/E {oe(p.modul[m]!.OE)}</Link>)}</div>}
      <div className="hint" style={{ marginTop: 8 }}>Ini indikasi statistik untuk memprioritaskan audit, bukan bukti pelanggaran. Keputusan tetap di tangan auditor.</div>
    </div>
  )
}
