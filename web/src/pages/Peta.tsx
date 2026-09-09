import { useState } from 'react'
import { Link } from 'react-router-dom'
import MapView, { IndikatorL1, IndikatorL2, LABEL_L1, LABEL_L2, Tingkat } from '../components/MapView'
import { Chip, Pilih } from '../components/Common'
import { StatusPill } from '../components/sig'
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
        <div className="seg" role="group" aria-label="Tingkat penjelajahan">
          {(['L1', 'L2', 'L3'] as Tingkat[]).map(t => <button key={t} type="button" className={tingkat === t ? 'on' : ''} onClick={() => setTingkat(t)}>{t === 'L1' ? 'L1 · Provinsi' : t === 'L2' ? 'L2 · Kecamatan' : 'L3 · Aliran'}</button>)}
        </div>
        <span style={{ flex: 1 }} />
        {tingkat === 'L1' && <>
          <Pilih label="Modul" nilai={m} ubah={setM} opsi={MODUL.map(k => ({ nilai: k, label: `#${INFO[k].nomor} ${INFO[k].nama}` }))} />
          <Pilih label="Indikator" nilai={indL1} ubah={setIndL1} opsi={(Object.keys(LABEL_L1) as IndikatorL1[]).map(k => ({ nilai: k, label: LABEL_L1[k] }))} />
        </>}
        {tingkat === 'L2' && <>
          <Pilih label="Indikator" nilai={indL2} ubah={setIndL2} opsi={(Object.keys(LABEL_L2) as IndikatorL2[]).map(k => ({ nilai: k, label: LABEL_L2[k] }))} />
          <label className="cek"><input type="checkbox" checked={fas} onChange={e => setFas(e.target.checked)} /> Titik faskes (OSM)</label>
        </>}
        {tingkat === 'L3' && <Pilih label="Aliran" nilai={alir} ubah={v => setAlir(v)} opsi={[{ nilai: 'readmisi', label: 'Readmisi: asal domisili peserta' }, { nilai: 'rujukan', label: 'Rujukan FKTP: asal FKTP terdaftar' }]} />}
      </div>
      {tingkat === 'L2' && <div className="notice" style={{ marginBottom: 8 }}>Titik faskes dan demografi di lapisan ini berasal dari data publik (OpenStreetMap, BPS) dan <b>bukan</b> hasil deteksi. Hasil deteksi pada Data Sampel bersifat anonim per faskes dan ditampilkan di panel kanan, bukan di titik peta.</div>}
      <div style={{ position: 'relative' }}>
        <MapView tingkat={tingkat} modul={m} indL1={indL1} indL2={indL2} tampilFaskes={fas} aliranModul={alir}
          onPilihKab={(k, d) => setPilihKab({ kab: k, d })} onPilihKec={k => setPilihKec(k)} />
        <div className="map-info">
          {tingkat === 'L2' ? (
            kec ? <>
              <b>Kecamatan {kec.kecamatan}</b>
              <div className="kv" style={{ marginTop: 8, fontSize: 12 }}>
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
            <div className="hint" style={{ marginBottom: 8 }}>{alir === 'readmisi' ? `${pct(ring.aliran.pangsa_luar_kota_ritl)} rawat inap di RS Semarang adalah peserta berdomisili luar kota.` : 'Kunjungan rawat jalan berperujuk FKTP, menurut kabupaten/kota FKTP tempat peserta terdaftar.'}</div>
            <table className="t" style={{ fontSize: 12 }}>
              <thead><tr><th>Asal</th><th className="num">{alir === 'readmisi' ? 'Admisi' : 'Kunjungan'}</th><th className="num">{alir === 'readmisi' ? 'O/E' : 'Tertimbang'}</th></tr></thead>
              <tbody>{(alir === 'readmisi' ? ring.aliran.readmisi : ring.aliran.rujukan).slice(0, 12).map((r: any) => <tr key={r.asal}><td>{judulKab(r.asal)}</td><td className="num">{num(r.n)}</td><td className="num">{alir === 'readmisi' ? oe(r.E > 0 ? r.O / r.E : null) : num(r.tertimbang)}</td></tr>)}</tbody>
            </table>
            <div className="hint">Asal di luar Jawa Tengah tidak digambar sebagai garis.</div>
          </> : pilihKab ? <>
            <b>{judulKab(pilihKab.kab)}</b> · #{INFO[m].nomor} {INFO[m].nama}
            {pilihKab.d?.[m] ? (() => { const d = pilihKab.d![m]!; return <div className="kv" style={{ marginTop: 8, fontSize: 12 }}>
              <span className="k">Faskes dinilai</span><span>{d.n_faskes}</span>
              <span className="k">Perlu perhatian</span><span style={{ color: 'var(--perhatian)', fontWeight: 600 }}>{d.n_perhatian}</span>
              <span className="k">Diamati</span><span style={{ color: 'var(--diamati)', fontWeight: 600 }}>{d.n_diamati}</span>
              <span className="k">O/E</span><span>{oe(d.OE)}</span>
              <span className="k">Angka mentah</span><span>{pct(d.rate)}</span>
              <span className="k">Selisih tertimbang</span><span>{rp(d.rupiah_tertimbang)}</span>
            </div> })() : <div className="hint">Tidak ada faskes dengan volume cukup.</div>}
            {fkKab.length > 0 && <>
              <div className="eyebrow" style={{ marginTop: 10 }}>Faskes (urut O/E)</div>
              <table className="t" style={{ fontSize: 12 }}><tbody>
                {fkKab.slice(0, 10).map(f => <tr key={f.id}><td><Link to={'/faskes/' + f.id}>{f.label}</Link><div className="hint">{f.kelas_pendek}</div></td><td className="num">{oe(f.modul[m]!.OE)}</td><td><StatusPill s={f.modul[m]!.status} /></td></tr>)}
              </tbody></table>
            </>}
            {pilihKab.kab === KOTA && <div className="hint" style={{ marginTop: 8 }}><Chip onClick={() => setTingkat('L2')}>Buka kecamatan Semarang →</Chip></div>}
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 8 }}><Link to="/antrean">Lihat antrean audit →</Link></div>
          </> : <div className="hint">Klik kabupaten/kota.</div>}
        </div>
      </div>
    </>
  )
}
