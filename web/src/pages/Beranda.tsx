import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MapView from '../components/MapView'
import { Kpi, Pill, Tren } from '../components/Common'
import { INFO, KOTA, MODUL, Modul, aktif, num, oe, rp, useData } from '../lib/data'

export default function Beranda() {
  const { ring, faskes } = useData()
  const nav = useNavigate()
  const [m, setM] = useState<Modul>('readmisi')
  const sem = faskes.filter(f => f.kab === KOTA)
  const antrean = sem.filter(f => f.rupiah > 0).sort((a, b) => b.rupiah_tertimbang - a.rupiah_tertimbang).slice(0, 8)
  const bulanTerakhir = ring.tren[m].slice(-3)
  const oeTerakhir = bulanTerakhir.reduce((s, r) => s + r.O, 0) / Math.max(1e-9, bulanTerakhir.reduce((s, r) => s + r.E, 0))
  return (
    <>
      <div className="eyebrow">Kota Semarang · {ring.periode}</div>
      <h1>Empat pola klaim tidak wajar, dinilai per faskes</h1>
      <p className="sub">Setiap klaim terlihat sah. Polanya baru tampak ketika satu faskes dibandingkan dengan rekan sebayanya. Berikut hasilnya untuk {ring.n_faskes_fkrtl} RS dan {ring.n_faskes_fktp} FKTP di Kota Semarang.</p>
      <div className="grid4">
        <Kpi label="Faskes perlu perhatian" nilai={num(ring.n_perhatian)} warna="red" hint={`dari ${ring.n_faskes_fkrtl + ring.n_faskes_fktp} faskes · ${ring.n_diamati} lainnya diamati`} />
        <Kpi label="Selisih rupiah (sampel)" nilai={rp(ring.rupiah)} hint={<>≈ <b>{rp(ring.rupiah_tertimbang)}</b> setelah dibobot ke populasi peserta</> as any} />
        <Kpi label={`O/E ${INFO[m].pendek}, 3 bulan terakhir`} nilai={oe(oeTerakhir)} warna={oeTerakhir > 1.05 ? 'amber' : 'green'} hint="kejadian nyata ÷ kejadian wajar, seluruh kota" />
        <Kpi label="Cakupan data" nilai={`${num(ring.per_modul.readmisi.n)} RITL`} hint={`${num(ring.per_modul.fragmentasi.n)} kunjungan RJTL · ${num(ring.per_modul.rujukan.n)} kunjungan FKTP`} />
      </div>

      <h2>Per modul</h2>
      <div className="grid4">
        {MODUL.map(k => { const p = ring.per_modul[k]; return (
          <Link key={k} to={'/modul/' + k} className="card" style={{ borderTop: '4px solid ' + INFO[k].warna }}>
            <div className="eyebrow">Modul #{INFO[k].nomor}</div>
            <h3 style={{ margin: '2px 0 8px' }}>{INFO[k].nama}</h3>
            <div className="kv">
              <span className="k">Dinilai</span><span>{p.n_cukup} dari {p.n_faskes} {INFO[k].unit}</span>
              <span className="k">Perlu perhatian</span><span style={{ color: '#B53333', fontWeight: 600 }}>{p.n_perhatian}</span>
              <span className="k">Diamati</span><span style={{ color: '#C88A0A', fontWeight: 600 }}>{p.n_diamati}</span>
              <span className="k">O/E kota</span><span>{oe(p.E > 0 ? p.O / p.E : null)}</span>
              <span className="k">Selisih</span><span>{rp(p.rupiah)}</span>
            </div>
          </Link>) })}
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Jawa Tengah: O/E {INFO[m].nama.toLowerCase()} per kabupaten/kota</h3>
            <select value={m} onChange={e => setM(e.target.value as Modul)}>{MODUL.map(k => <option key={k} value={k}>#{INFO[k].nomor} {INFO[k].nama}</option>)}</select>
          </div>
          <MapView tingkat="L1" modul={m} indL1="OE" kecil onPilihKab={() => nav('/peta')} />
          <div className="hint">Klik peta untuk membuka tampilan penuh.</div>
        </div>
        <div className="card">
          <Tren rows={ring.tren[m]} judul={`Kota Semarang: ${INFO[m].kejadian} nyata vs wajar per bulan`} />
        </div>
      </div>

      <h2>Antrean audit: mulai dari sini</h2>
      <div className="card">
        <table className="t">
          <thead><tr><th>Faskes</th><th>Kelas</th><th>Modul yang menandai</th><th className="num">Selisih (sampel)</th><th className="num">Tertimbang</th></tr></thead>
          <tbody>
            {antrean.map(f => <tr key={f.id} onClick={() => nav('/faskes/' + f.id)} style={{ cursor: 'pointer' }}>
              <td><b>{f.label}</b><div className="hint">{f.milik}</div></td>
              <td>{f.kelas_pendek}</td>
              <td>{MODUL.filter(k => aktif(f.modul[k])).map(k => <span key={k} style={{ marginRight: 6 }}><Pill s={f.modul[k]!.status} /> <span className="hint">#{INFO[k].nomor} O/E {oe(f.modul[k]!.OE)}</span></span>)}</td>
              <td className="num">{rp(f.rupiah)}</td>
              <td className="num">{rp(f.rupiah_tertimbang)}</td>
            </tr>)}
          </tbody>
        </table>
        <div className="hint" style={{ marginTop: 8 }}><Link to="/antrean">Lihat antrean lengkap →</Link></div>
      </div>
    </>
  )
}
