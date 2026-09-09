import { Link } from 'react-router-dom'
import type { KeyboardEvent, ReactNode } from 'react'
import { mdiClose, mdiMagnify } from '@mdi/js'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bulan, BULAN, Faskes, Hasil, INFO, Modul, STATUS, Status, num, oe, pct, rp, sebaya, useData } from '../lib/data'
import { Icon } from './Icon'

/** Pengendali keyboard Enter/Spasi untuk elemen klik (mis. baris tabel). */
export function onEnter(fn: () => void) {
  return (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }
}

/** Tombol chip filter yang konsisten & keyboard-accessible (dipakai semua toolbar). */
export function Chip({ aktif, onClick, judul, children }: { aktif?: boolean; onClick: () => void; judul?: string; children: ReactNode }) {
  return <button type="button" className={'chip' + (aktif ? ' on' : '')} aria-pressed={!!aktif} title={judul} onClick={onClick}>{children}</button>
}

/** Select berlabel untuk toolbar filter. */
export function Pilih<T extends string>({ label, nilai, ubah, opsi }: { label: string; nilai: T; ubah: (v: T) => void; opsi: { nilai: T; label: string }[] }) {
  return (
    <label className="pilih">
      <span className="fl">{label}</span>
      <select value={nilai} onChange={e => ubah(e.target.value as T)}>
        {opsi.map(o => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
      </select>
    </label>
  )
}

/** Pagination konsisten untuk tabel: ringkasan "Menampilkan a–b dari N", ukuran 25/50/100, halaman. */
export function Pager({ total, page, per, ubah, ubahPer }: { total: number; page: number; per: number; ubah: (p: number) => void; ubahPer: (p: number) => void }) {
  const nHal = Math.max(1, Math.ceil(total / per))
  const dari = total === 0 ? 0 : (page - 1) * per + 1
  const sampai = Math.min(total, page * per)
  return (
    <div className="pager" aria-live="polite">
      <span>Menampilkan <b>{num(dari)}–{num(sampai)}</b> dari <b>{num(total)}</b></span>
      <span style={{ flex: 1 }} />
      <span className="hint">Per halaman</span>
      <div className="pages" role="group" aria-label="Jumlah baris per halaman">{[25, 50, 100].map(p => <button key={p} type="button" className={per === p ? 'on' : ''} aria-pressed={per === p} onClick={() => ubahPer(p)}>{p}</button>)}</div>
      <button type="button" disabled={page <= 1} onClick={() => ubah(page - 1)}>← Sebelum</button>
      <span>Hal. {page}/{nHal}</span>
      <button type="button" disabled={page >= nHal} onClick={() => ubah(page + 1)}>Berikut →</button>
    </div>
  )
}

/** Kolom pencarian dengan ikon & tombol bersihkan (dipakai semua pencarian). */
export function Cari({ nilai, ubah, saran }: { nilai: string; ubah: (v: string) => void; saran: string }) {
  return (
    <span className="cari">
      <Icon path={mdiMagnify} size={16} />
      <input type="search" value={nilai} onChange={e => ubah(e.target.value)} placeholder={saran} aria-label={saran} autoComplete="off" />
      {nilai !== '' && <button type="button" className="cari-x" onClick={() => ubah('')} aria-label="Bersihkan pencarian"><Icon path={mdiClose} size={14} /></button>}
    </span>
  )
}

export function Tren({ rows, tinggi = 220, judul }: { rows: Bulan[]; tinggi?: number; judul?: string }) {
  const d = rows.map(r => ({ bln: BULAN[r.bln], Nyata: r.O, Wajar: Math.round(r.E * 10) / 10, OE: r.E > 0 ? Math.round((r.O / r.E) * 100) / 100 : null }))
  return (
    <div>
      {judul && <h3>{judul}</h3>}
      <ResponsiveContainer width="100%" height={tinggi}>
        <LineChart data={d} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#ECEEF0" vertical={false} />
          <XAxis dataKey="bln" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: any) => num(Number(v), 1)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Nyata" stroke="var(--brand)" strokeWidth={2} isAnimationActive={false} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Wajar" stroke="var(--grey-2)" strokeWidth={2} isAnimationActive={false} strokeDasharray="5 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Peringkat({ rows, m, nilai = 'OE', tinggi = 320, refX }: { rows: Faskes[]; m: Modul; nilai?: 'OE' | 'rate' | 'rupiah'; tinggi?: number; refX?: number }) {
  const d = rows.map(f => ({ nama: f.label, v: nilai === 'OE' ? f.modul[m]!.OE ?? 0 : nilai === 'rate' ? f.modul[m]!.rate : f.modul[m]!.rupiah, status: f.modul[m]!.status, id: f.id }))
  return (
    <ResponsiveContainer width="100%" height={tinggi}>
      <BarChart data={d} layout="vertical" margin={{ top: 4, right: 30, left: 20, bottom: 0 }}>
        <CartesianGrid stroke="#ECEEF0" horizontal={false} />
        {refX != null && nilai === 'OE' && <ReferenceLine x={refX} stroke="var(--grey-2)" strokeDasharray="4 3" label={{ value: '1,0', position: 'insideBottomRight', fontSize: 10, fill: 'var(--grey-2)' }} />}
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: any) => (nilai === 'rupiah' ? rp(v, 0) : nilai === 'rate' ? v + '%' : oe(v))} />
        <YAxis type="category" dataKey="nama" width={90} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: any) => (nilai === 'rupiah' ? rp(Number(v)) : nilai === 'rate' ? pct(Number(v)) : oe(Number(v)))} />
        <Bar dataKey="v" isAnimationActive={false} shape={(p: any) => <rect x={p.x} y={p.y} width={p.width} height={p.height} fill={STATUS[p.payload.status as Status].warna} rx={3} />} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Kartu penjelasan wajib: O, E, O/E, z, sebaya, penyumbang, dan kalimat pengingat. */
export function Penjelasan({ f, m, h }: { f: Faskes; m: Modul; h: Hasil }) {
  const data = useData()
  const peers = sebaya(data.faskes, f, m)
  const cls = h.status === 'perhatian' ? 'attention' : h.status === 'diamati' ? 'amber' : h.status === 'wajar' ? 'green' : ''
  const info = INFO[m]
  return (
    <div className={'explain ' + cls}>
      <b>Mengapa {f.label} berstatus “{STATUS[h.status].label}” pada modul #{info.nomor}?</b>
      <div style={{ marginTop: 8 }}>
        Dari <b>{num(h.n)}</b> {info.unit === 'FKTP' ? 'kunjungan sakit' : m === 'fragmentasi' ? 'kunjungan rawat jalan' : 'rawat inap'}, tercatat <b>{num(h.O)}</b> {info.kejadian} ({pct(h.rate)}).
        Dengan bauran kasus yang sama, rekan sebaya menghasilkan <b>{num(h.E, 1)}</b> kejadian yang wajar. Rasio O/E <b>{oe(h.OE)}</b>, skor z <b>{h.z == null ? '–' : num(h.z, 2)}</b>
        {h.status === 'volume_rendah' ? <> — volume di bawah ambang minimum sehingga tidak dinilai.</> : h.status === 'wajar' ? <> — masih di dalam rentang wajar.</> : h.stabil ? <> — melewati ambang ganda (O/E &gt; 1,05 dan z &gt; 1,96) dan konsisten di dua paruh periode.</> : <> — melewati ambang tetapi belum konsisten di dua paruh periode, sehingga hanya diamati.</>}
        {h.selisih > 0 && h.status !== 'volume_rendah' && <> Selisih <b>{num(h.selisih, 1)}</b> kejadian ≈ <b>{rp(h.rupiah)}</b> pada sampel (≈ {rp(h.rupiah_tertimbang)} tertimbang).</>}
      </div>
      {h.kontributor.length > 0 && <div style={{ marginTop: 8 }}>Penyumbang terbesar: {h.kontributor.map(k => <span key={k.nama} className="mono" style={{ marginRight: 8 }}>{k.nama} ({k.O} vs {num(k.E, 1)})</span>)}</div>}
      {peers.length > 0 && <div style={{ marginTop: 8 }}>Pembanding sebaya ({f.kelas_pendek}, Jawa Tengah): {peers.map(p => <Link key={p.id} to={'/faskes/' + p.id} style={{ marginRight: 8 }}>{p.label} O/E {oe(p.modul[m]!.OE)}</Link>)}</div>}
      <div className="hint" style={{ marginTop: 8 }}>Ini indikasi statistik untuk memprioritaskan audit, bukan bukti pelanggaran. Keputusan tetap di tangan auditor.</div>
    </div>
  )
}
