import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MapView from '../components/MapView'
import { TentangAI } from '../components/TentangAI'
import { Sparkle } from '../components/Sparkle'
import { Pilih, Tren, onEnter } from '../components/Common'
import KpiCard from '../components/KpiCard'
import { RupiahText, StatusPill } from '../components/sig'
import { OE_STATUS, RATIO } from '../lib/roles'
import { INFO, KOTA, MODUL, Modul, aktif, num, oe, rp, useData } from '../lib/data'

interface Minat { id: string; teks: string; link: string; isi: string | null }

const tglRingkas = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })

export default function Beranda() {
  const { ring, faskes } = useData()
  const nav = useNavigate()
  const [m, setM] = useState<Modul>('readmisi')
  const sem = faskes.filter(f => f.kab === KOTA)
  const antrean = sem.filter(f => f.rupiah > 0).sort((a, b) => b.rupiah_tertimbang - a.rupiah_tertimbang).slice(0, 8)
  const buka = (e: { ctrlKey?: boolean; metaKey?: boolean; button?: number }, id: string) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) { window.open('/faskes/' + id, '_blank', 'noopener'); return }
    nav('/faskes/' + id)
  }
  const bulanTerakhir = ring.tren[m].slice(-3)
  const oeTerakhir = bulanTerakhir.reduce((s, r) => s + r.O, 0) / Math.max(1e-9, bulanTerakhir.reduce((s, r) => s + r.E, 0))
  const [minat, setMinat] = useState<Minat[] | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/ai/digest?scope=' + encodeURIComponent(KOTA))
      .then(r => { if (!r.ok) throw 0; return r.json() })
      .then(d => {
        if (!live || !Array.isArray(d.insights)) return
        const list = d.insights
          .map((g: Record<string, unknown>, i: number) => ({ id: String(g.id ?? i), teks: String(g.text ?? ''), link: String(g.link ?? '/'), isi: g.isi ? String(g.isi) : null }))
          .filter((x: Minat) => x.teks.trim())
        setMinat(list)
        if (list.length > 0) window.dispatchEvent(new CustomEvent('sidak:digest'))
      })
      .catch(() => { if (live) setMinat([]) })
    return () => { live = false }
  }, [])
  return (
    <>
      <div className="eyebrow">Kota Semarang · {ring.periode}</div>
      <h1>Empat pola klaim tidak wajar, dinilai per faskes</h1>
      <p className="sub">Setiap klaim terlihat sah. Polanya baru tampak ketika satu faskes dibandingkan dengan rekan sebayanya. Berikut hasilnya untuk {ring.n_faskes_fkrtl} RS dan {ring.n_faskes_fktp} FKTP di Kota Semarang.</p>

      {minat === null && (
        <div className="bacaan-skel" aria-hidden="true">
          <div className="bar" /><div className="bar" /><div className="bar" />
        </div>
      )}
      {minat !== null && minat.length > 0 && (
        <div className="bacaan">
          <div className="bacaan-top">
            <div className="eyebrow" style={{ fontSize: '10.5px' }}>Bacaan Tanya AI SIDAK</div>
            <div style={{ marginLeft: 'auto' }}><TentangAI kecil /></div>
          </div>
          <div className="ros">
            {minat.slice(0, 3).map((x, i) => (
              <div key={x.id} className={'bacaan-card' + (i === 0 ? ' pk' : '')}>
                <div className="bak">
                  <b>{x.teks}</b>
                  {x.isi && <div className="bacaan-yl">{x.isi}</div>}
                </div>
                <Link to={x.link}>Lihat selengkapnya →</Link>
              </div>
            ))}
          </div>
          <div className="att">
            <span className="ai"><Sparkle size={12} /> Dihasilkan Tanya AI SIDAK</span>
            <span> · fakta dari data sampel ±1% · {tglRingkas()}</span>
          </div>
        </div>
      )}
      <div className="grid4">
        <KpiCard role="attention" label="Faskes perlu perhatian" value={num(ring.n_perhatian)} href="/antrean?st=perhatian" hint={<>dari {ring.n_faskes_fkrtl + ring.n_faskes_fktp} faskes · {ring.n_diamati} lainnya diamati · buka antrean →</>} />
        <KpiCard role="money" label="Selisih rupiah (sampel)" value={rp(ring.rupiah)} hint={<>≈ <b>{rp(ring.rupiah_tertimbang)}</b> setelah dibobot ke populasi peserta</>} />
        <KpiCard role="ratio" label={`O/E ${INFO[m].pendek}, 3 bulan terakhir`} value={oe(oeTerakhir)} statusPill href={'/modul/' + m} sparkline={bulanTerakhir.map(b => b.E > 0 ? b.O / b.E : null).filter((x): x is number => x != null)} hint="kejadian nyata ÷ kejadian wajar, seluruh kota" />
        <KpiCard role="coverage" label="Cakupan data" value={`${num(ring.per_modul.readmisi.n)} RITL`} hint={`${num(ring.per_modul.fragmentasi.n)} kunjungan RJTL · ${num(ring.per_modul.rujukan.n)} kunjungan FKTP`} />
      </div>

      <h2>Per modul</h2>
      <div className="grid4">
        {MODUL.map(k => { const p = ring.per_modul[k]; const oev = p.E > 0 ? p.O / p.E : null; const oes = OE_STATUS(oev); const fillW = oev == null ? 0 : Math.min(100, (oev / 1.6) * 100); return (
          <Link key={k} to={'/modul/' + k} className="modkart">
            <div className="modkart-head"><span className="mono modkart-no">#{INFO[k].nomor}</span><h3 style={{ margin: 0 }}>{INFO[k].nama}</h3></div>
            <div className="kv">
              <span className="k">Dinilai</span><span>{p.n_cukup} dari {p.n_faskes} {INFO[k].unit}</span>
              <span className="k">Perlu perhatian</span><span className="modkart-pill">{p.n_perhatian}</span>
            </div>
            <div className="oe-mini">
              <div className="oe-track"><div className="oe-fill" style={{ width: fillW + '%', background: RATIO[oes].text }} /><span className="oe-tick" title="Tanda 1,0 = wajar" /></div>
              <span className="oe-tag">{oe(oev)}</span>
            </div>
          </Link>) })}
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Jawa Tengah: O/E {INFO[m].nama.toLowerCase()} per kabupaten/kota</h3>
            <Pilih label="Modul" nilai={m} ubah={setM} opsi={MODUL.map(k => ({ nilai: k, label: `#${INFO[k].nomor} ${INFO[k].nama}` }))} />
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
            {antrean.map(f => <tr key={f.id} tabIndex={0} role="link" aria-label={`Buka profil ${f.label}`} onClick={e => buka(e, f.id)} onKeyDown={onEnter(() => nav('/faskes/' + f.id))}>
              <td><b>{f.label}</b><div className="hint">{f.milik}</div></td>
              <td>{f.kelas_pendek}</td>
              <td>{MODUL.filter(k => aktif(f.modul[k])).map(k => <span key={k} style={{ marginRight: 8 }}><StatusPill s={f.modul[k]!.status} /> <span className="hint">#{INFO[k].nomor} O/E {oe(f.modul[k]!.OE)}</span></span>)}</td>
              <td className="num"><RupiahText v={f.rupiah} /></td>
              <td className="num"><RupiahText v={f.rupiah_tertimbang} /></td>
            </tr>)}
          </tbody>
        </table>
        <div className="hint" style={{ marginTop: 8 }}><Link to="/antrean">Lihat antrean lengkap →</Link></div>
      </div>
    </>
  )
}
