import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BungkusTabel, Kepala, Pill, barisKlik } from '../components/Common'
import Ikon from '../components/Ikon'
import { Faskes, INFO, KOTA, MODUL, Modul, Status, StatusAudit, bacaStatusAudit, judulKab, num, oe, rp, useData } from '../lib/data'
import { usePalet } from '../lib/tema'

interface Baris { f: Faskes; m: Modul; status: Status; OE: number | null; z: number | null; n: number; rupiah: number; rupiah_t: number; stabil: boolean }

export default function Antrean() {
  const { faskes } = useData()
  const nav = useNavigate()
  const palet = usePalet()
  const [wil, setWil] = useState<'semarang' | 'jateng'>('semarang')
  const [mod, setMod] = useState<Modul | 'semua'>('semua')
  const [st, setSt] = useState<'aktif' | 'perhatian' | 'diamati' | 'semua'>('aktif')
  const [kelas, setKelas] = useState('semua')
  const [urut, setUrut] = useState<'rupiah_t' | 'OE' | 'z' | 'n'>('rupiah_t')
  const [q, setQ] = useState('')
  const audit = bacaStatusAudit()
  const AUDIT: Record<StatusAudit, string> = { belum: 'Belum dilihat', sedang: 'Sedang diaudit', selesai: 'Selesai' }

  const rows = useMemo(() => {
    const out: Baris[] = []
    faskes.filter(f => wil === 'jateng' || f.kab === KOTA).forEach(f => {
      MODUL.forEach(m => {
        const h = f.modul[m]
        if (!h) return
        if (mod !== 'semua' && m !== mod) return
        if (st === 'aktif' && !(h.status === 'perhatian' || h.status === 'diamati')) return
        if ((st === 'perhatian' || st === 'diamati') && h.status !== st) return
        if (kelas !== 'semua' && f.kelas_pendek !== kelas) return
        if (q && !f.label.toLowerCase().includes(q.toLowerCase()) && !f.kab.toLowerCase().includes(q.toLowerCase())) return
        out.push({ f, m, status: h.status, OE: h.OE, z: h.z, n: h.n, rupiah: h.rupiah, rupiah_t: h.rupiah_tertimbang, stabil: h.stabil })
      })
    })
    return out.sort((a, b) => ((b[urut] as number) ?? -1) - ((a[urut] as number) ?? -1))
  }, [faskes, wil, mod, st, kelas, urut, q])

  const kelasList = Array.from(new Set(faskes.filter(f => wil === 'jateng' || f.kab === KOTA).map(f => f.kelas_pendek))).sort()
  const total = rows.reduce((s, r) => s + r.rupiah, 0), totalT = rows.reduce((s, r) => s + r.rupiah_t, 0)

  function ekspor() {
    const head = ['faskes', 'tipe', 'kab_kota', 'kelas', 'kepemilikan', 'modul', 'status', 'stabil', 'n', 'O', 'E', 'OE', 'z', 'selisih_rupiah_sampel', 'selisih_rupiah_tertimbang', 'status_audit']
    const lines = rows.map(r => { const h = r.f.modul[r.m]!; return [r.f.label, r.f.tipe, r.f.kab, r.f.kelas, r.f.milik, `#${INFO[r.m].nomor} ${INFO[r.m].nama}`, r.status, r.stabil ? 'ya' : 'tidak', h.n, h.O, h.E, h.OE ?? '', h.z ?? '', h.rupiah, h.rupiah_tertimbang, AUDIT[audit[r.f.id] ?? 'belum']].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') })
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sidak_antrean_audit.csv'; a.click()
  }

  return (
    <>
      <Kepala
        eyebrow="Antrean audit"
        judul="Siapa yang perlu dilihat lebih dulu"
        sub="Satu daftar untuk empat modul, diurutkan menurut selisih rupiah. Tidak ada klaim tunggal di sini: setiap baris adalah pola satu faskes dibanding rekan sebayanya."
        aksi={<button className="btn" onClick={ekspor}><Ikon nama="unduh" ukuran={16} /> Ekspor CSV</button>}
      />

      <div className="toolbar" role="group" aria-label="Penyaring antrean">
        <button type="button" className={'chip' + (wil === 'semarang' ? ' on' : '')} aria-pressed={wil === 'semarang'} onClick={() => setWil('semarang')}>Kota Semarang</button>
        <button type="button" className={'chip' + (wil === 'jateng' ? ' on' : '')} aria-pressed={wil === 'jateng'} onClick={() => setWil('jateng')}>Seluruh Jawa Tengah</button>
        <select value={mod} onChange={e => setMod(e.target.value as Modul | 'semua')} aria-label="Saring modul"><option value="semua">Semua modul</option>{MODUL.map(k => <option key={k} value={k}>#{INFO[k].nomor} {INFO[k].nama}</option>)}</select>
        <select value={st} onChange={e => setSt(e.target.value as typeof st)} aria-label="Saring status"><option value="aktif">Perlu perhatian + diamati</option><option value="perhatian">Perlu perhatian saja</option><option value="diamati">Diamati saja</option><option value="semua">Semua status</option></select>
        <select value={kelas} onChange={e => setKelas(e.target.value)} aria-label="Saring kelas atau jenis faskes"><option value="semua">Semua kelas/jenis</option>{kelasList.map(k => <option key={k} value={k}>{k}</option>)}</select>
        <select value={urut} onChange={e => setUrut(e.target.value as typeof urut)} aria-label="Urutkan daftar"><option value="rupiah_t">Urut: rupiah tertimbang</option><option value="OE">Urut: O/E</option><option value="z">Urut: skor z</option><option value="n">Urut: volume</option></select>
        <input type="text" placeholder="Cari kode / kab" value={q} onChange={e => setQ(e.target.value)} aria-label="Cari kode faskes atau kabupaten" />
      </div>

      <div className="card soft" style={{ padding: '10px 14px', fontSize: 13, marginBottom: 'var(--s3)' }} aria-live="polite">
        <b>{num(rows.length)}</b> temuan · selisih sampel <b>{rp(total)}</b> · tertimbang <b>{rp(totalT)}</b>
      </div>

      <div className="card rapat">
        <BungkusTabel>
          <table className="t">
            <thead><tr><th>Faskes</th>{wil === 'jateng' && <th>Kab/Kota</th>}<th>Kelas · kepemilikan</th><th>Modul</th><th>Status</th><th className="num">Volume</th><th className="num">O / E</th><th className="num">O/E</th><th className="num">z</th><th className="num">Selisih</th><th className="num">Tertimbang</th><th>Tindak lanjut</th></tr></thead>
            <tbody>
              {rows.slice(0, 300).map((r, i) => { const h = r.f.modul[r.m]!; return (
                <tr key={i} {...barisKlik(() => nav('/faskes/' + r.f.id))}>
                  <td><Link to={'/faskes/' + r.f.id}><b>{r.f.label}</b></Link></td>
                  {wil === 'jateng' && <td>{judulKab(r.f.kab)}</td>}
                  <td>{r.f.kelas_pendek}<div className="hint">{r.f.milik}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}><span style={{ color: palet.modul[r.m], fontWeight: 600 }}>#{INFO[r.m].nomor}</span> {INFO[r.m].pendek}</td>
                  <td><Pill s={r.status} />{!r.stabil && r.status !== 'wajar' && r.status !== 'volume_rendah' && <div className="hint">tidak stabil antar paruh</div>}</td>
                  <td className="num">{num(h.n)}</td>
                  <td className="num">{num(h.O)} / {num(h.E, 1)}</td>
                  <td className="num"><b>{oe(h.OE)}</b></td>
                  <td className="num">{h.z == null ? '–' : num(h.z, 2)}</td>
                  <td className="num">{rp(h.rupiah)}</td>
                  <td className="num">{rp(h.rupiah_tertimbang)}</td>
                  <td className="hint">{AUDIT[audit[r.f.id] ?? 'belum']}</td>
                </tr>) })}
            </tbody>
          </table>
        </BungkusTabel>
        {rows.length === 0 && <div className="kaki-tabel hint">Tidak ada temuan yang cocok dengan penyaring ini. Longgarkan status atau kosongkan kotak pencarian.</div>}
        {rows.length > 300 && <div className="kaki-tabel hint">Menampilkan 300 dari {num(rows.length)} temuan. Gunakan penyaring, atau ekspor CSV untuk daftar utuh.</div>}
      </div>
    </>
  )
}
