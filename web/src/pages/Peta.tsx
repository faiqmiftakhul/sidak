import { useState } from 'react'
import { Link } from 'react-router-dom'
import MapView, { IndikatorL1, IndikatorL2, LABEL_L1, LABEL_L2, Tingkat } from '../components/MapView'
import { Pill } from '../components/Common'
import { INFO, KOTA, KabModul, MODUL, Modul, judulKab, num, oe, pct, rp, useData } from '../lib/data'

export default function Peta() {
  const { faskes, kab, demo, ring } = useData()
  const [tingkat, setTingkat] = useState<Tingkat>('L1')
  const [m, setM] = useState<Modul>('readmisi')
  const [indL1, setIndL1] = useState<IndikatorL1>('OE')
  const [indL2, setIndL2] = useState<IndikatorL2>('penduduk_2025')
  const [fas, setFas] = useState(true)
  const [alir, setAlir] = useState<'readmisi' | 'rujukan'>('readmisi')
  const [pilihKab, setPilihKab] = useState<{ kab: string; d?: Partial<Record<Modul, KabModul>> } | null>({ kab: KOTA, d: kab[KOTA] })
  const [pilihKec, setPilihKec] = useState<string | null>(null)

  const kec = pilihKec ? demo.kecamatan.find(k => k.kecamatan === pilihKec) : null
  const fkKab = pilihKab ? faskes.filter(f => f.kab === pilihKab.kab && f.modul[m] && f.modul[m]!.status !== 'volume_rendah').sort((a, b) => (b.modul[m]!.OE ?? 0) - (a.modul[m]!.OE ?? 0)) : []

  return (
    <>
      <div className="eyebrow">Peta</div>
      <h1>Dari provinsi ke kecamatan dalam dua klik</h1>
      <p className="sub">L1: hasil deteksi per kabupaten/kota Jawa Tengah dari Data Sampel. L2: konteks Kota Semarang dari data publik (penduduk, faskes nyata). L3: aliran pasien dari kabupaten asal ke RS di Semarang.</p>
      <div className="toolbar">
        {(['L1', 'L2', 'L3'] as Tingkat[]).map(t => <span key={t} className={'chip' + (tingkat === t ? ' on' : '')} onClick={() => setTingkat(t)}>{t === 'L1' ? 'L1 · Jawa Tengah' : t === 'L2' ? 'L2 · Kecamatan Semarang' : 'L3 · Aliran pasien'}</span>)}
        <span style={{ flex: 1 }} />
        {tingkat === 'L1' && <>
          <select value={m} onChange={e => setM(e.target.value as Modul)}>{MODUL.map(k => <option key={k} value={k}>#{INFO[k].nomor} {INFO[k].nama}</option>)}</select>
          <select value={indL1} onChange={e => setIndL1(e.target.value as IndikatorL1)}>{(Object.keys(LABEL_L1) as IndikatorL1[]).map(k => <option key={k} value={k}>{LABEL_L1[k]}</option>)}</select>
        </>}
        {tingkat === 'L2' && <>
          <select value={indL2} onChange={e => setIndL2(e.target.value as IndikatorL2)}>{(Object.keys(LABEL_L2) as IndikatorL2[]).map(k => <option key={k} value={k}>{LABEL_L2[k]}</option>)}</select>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={fas} onChange={e => setFas(e.target.checked)} /> Titik faskes (OSM)</label>
        </>}
        {tingkat === 'L3' && <select value={alir} onChange={e => setAlir(e.target.value as any)}><option value="readmisi">Readmisi: asal domisili peserta</option><option value="rujukan">Rujukan FKTP: asal FKTP terdaftar</option></select>}
      </div>
      {tingkat === 'L2' && <div className="notice" style={{ marginBottom: 10 }}>Titik faskes dan demografi di lapisan ini berasal dari data publik (OpenStreetMap, BPS) dan <b>bukan</b> hasil deteksi. Hasil deteksi pada Data Sampel bersifat anonim per faskes dan ditampilkan di panel kanan, bukan di titik peta.</div>}
      <div style={{ position: 'relative' }}>
        <MapView tingkat={tingkat} modul={m} indL1={indL1} indL2={indL2} tampilFaskes={fas} aliranModul={alir}
          onPilihKab={(k, d) => setPilihKab({ kab: k, d })} onPilihKec={k => setPilihKec(k)} />
        <div className="map-info">
          {tingkat === 'L2' ? (
            kec ? <>
              <b>Kecamatan {kec.kecamatan}</b>
              <div className="kv" style={{ marginTop: 6, fontSize: 12 }}>
                <span className="k">Penduduk 2025</span><span>{num(kec.penduduk_2025)}</span>
                <span className="k">Pertumbuhan 2020–25</span><span>{pct(kec.pertumbuhan_2020_2025_pct)}</span>
                <span className="k">Kepadatan</span><span>{num(kec.kepadatan_2025)} jiwa/km²</span>
                <span className="k">RS (OSM)</span><span>{kec.rs}</span>
                <span className="k">Klinik/praktik (OSM)</span><span>{kec.klinik}</span>
                <span className="k">Faskes / 100 rb</span><span>{num(kec.faskes_per_100rb, 1)}</span>
              </div>
              <div className="hint">Sumber: {demo.sumber.demografi}; {demo.sumber.faskes}.</div>
            </> : <><b>Kota Semarang</b><div className="hint">Klik kecamatan untuk rincian. Total penduduk 2025: {num(demo.kecamatan.reduce((s, k) => s + k.penduduk_2025, 0))}. Hasil deteksi RS Semarang ada di <Link to="/antrean">antrean audit</Link>.</div></>
          ) : tingkat === 'L3' ? <>
            <b>Aliran ke RS Kota Semarang</b>
            <div className="hint" style={{ marginBottom: 6 }}>{alir === 'readmisi' ? `${pct(ring.aliran.pangsa_luar_kota_ritl)} rawat inap di RS Semarang adalah peserta berdomisili luar kota.` : 'Kunjungan rawat jalan berperujuk FKTP, menurut kabupaten/kota FKTP tempat peserta terdaftar.'}</div>
            <table className="t" style={{ fontSize: 12 }}>
              <thead><tr><th>Asal</th><th className="num">{alir === 'readmisi' ? 'Admisi' : 'Kunjungan'}</th><th className="num">{alir === 'readmisi' ? 'O/E' : 'Tertimbang'}</th></tr></thead>
              <tbody>{(alir === 'readmisi' ? ring.aliran.readmisi : ring.aliran.rujukan).slice(0, 12).map((r: any) => <tr key={r.asal}><td>{judulKab(r.asal)}</td><td className="num">{num(r.n)}</td><td className="num">{alir === 'readmisi' ? oe(r.E > 0 ? r.O / r.E : null) : num(r.tertimbang)}</td></tr>)}</tbody>
            </table>
            <div className="hint">Asal di luar Jawa Tengah tidak digambar sebagai garis.</div>
          </> : pilihKab ? <>
            <b>{judulKab(pilihKab.kab)}</b> · #{INFO[m].nomor} {INFO[m].nama}
            {pilihKab.d?.[m] ? (() => { const d = pilihKab.d![m]!; return <div className="kv" style={{ marginTop: 6, fontSize: 12 }}>
              <span className="k">Faskes dinilai</span><span>{d.n_faskes}</span>
              <span className="k">Perlu perhatian</span><span style={{ color: '#B53333', fontWeight: 600 }}>{d.n_perhatian}</span>
              <span className="k">Diamati</span><span style={{ color: '#C88A0A', fontWeight: 600 }}>{d.n_diamati}</span>
              <span className="k">O/E</span><span>{oe(d.OE)}</span>
              <span className="k">Angka mentah</span><span>{pct(d.rate)}</span>
              <span className="k">Selisih tertimbang</span><span>{rp(d.rupiah_tertimbang)}</span>
            </div> })() : <div className="hint">Tidak ada faskes dengan volume cukup.</div>}
            {fkKab.length > 0 && <>
              <div className="eyebrow" style={{ marginTop: 10 }}>Faskes (urut O/E)</div>
              <table className="t" style={{ fontSize: 12 }}><tbody>
                {fkKab.slice(0, 10).map(f => <tr key={f.id}><td><Link to={'/faskes/' + f.id}>{f.label}</Link><div className="hint">{f.kelas_pendek}</div></td><td className="num">{oe(f.modul[m]!.OE)}</td><td><Pill s={f.modul[m]!.status} /></td></tr>)}
              </tbody></table>
            </>}
            {pilihKab.kab === KOTA && <div className="hint" style={{ marginTop: 6 }}><span className="chip" onClick={() => setTingkat('L2')}>Buka kecamatan Semarang →</span></div>}
          </> : <div className="hint">Klik kabupaten/kota.</div>}
        </div>
      </div>
    </>
  )
}
