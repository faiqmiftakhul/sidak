import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { Peringkat, Pill, Tren } from '../components/Common'
import { Faskes, INFO, KOTA, Modul, STATUS, num, oe, pct, rp, useData } from '../lib/data'

const DEF: Record<Modul, { apa: string; kejadian: string; wajar: string; putih: string; sorot: string }> = {
  rujukan: {
    apa: 'FKTP merujuk kasus ringan yang seharusnya selesai di FKTP. Setiap rujukan sah di atas kertas; polanya terlihat dari rasio rujuk yang jauh di atas FKTP sebaya dengan bauran diagnosis yang sama.',
    kejadian: 'Kunjungan sakit yang berakhir "rujuk lanjut".',
    wajar: 'Rasio rujuk nasional per diagnosis dan jenis FKTP (puskesmas, klinik, dokter praktik), distandardisasi ke bauran diagnosis FKTP tersebut.',
    putih: 'Diagnosis di luar daftar non-spesialistik tidak dihitung sebagai indikator pendamping; rujukan balik program rujuk balik belum dapat dikenali di Data Sampel.',
    sorot: 'Indikator pendamping: pangsa rujukan berdiagnosis non-spesialistik (daftar PPK FKTP).',
  },
  severity: {
    apa: 'Tingkat keparahan INA-CBG dinaikkan agar tarif lebih tinggi. Severity III dibayar sekitar dua kali severity I pada kelompok kasus yang sama.',
    kejadian: 'Rawat inap dengan severity III.',
    wajar: 'Peluang severity III per admisi dari model kecocokan (gradient boosting) berdasarkan kelompok INA-CBG dasar, diagnosis, usia, lama rawat, kelas rawat. Kelas RS sengaja tidak dipakai sebagai fitur agar RS tidak "dimaafkan" oleh kelasnya.',
    putih: 'RS rujukan tertinggi (kelas A, vertikal) tetap dinilai, tetapi pembanding sebaya di kartu penjelasan diambil dari kelas yang sama.',
    sorot: 'Selisih rupiah = kelebihan severity III × selisih tarif III–II pada kelompok kasus yang sama.',
  },
  fragmentasi: {
    apa: 'Layanan yang bisa satu kunjungan dipecah menjadi beberapa kunjungan rawat jalan. Tiap kunjungan sah; polanya terlihat dari kunjungan ulang ≤7 hari di RS yang sama yang jauh di atas wajar.',
    kejadian: 'Kunjungan rawat jalan yang berjarak 1–7 hari dari kunjungan sebelumnya oleh peserta yang sama di RS yang sama.',
    wajar: 'Rasio kunjungan ulang nasional per kelompok INA-CBG rawat jalan, distandardisasi ke bauran kasus RS.',
    putih: 'Dialisis, kemoterapi, radioterapi, rehabilitasi medik, fisioterapi, transfusi, hemofilia, thalasemia dikeluarkan lebih dulu (daftar putih klinis).',
    sorot: 'Saklar daftar putih memperlihatkan siapa yang "memutih" karena pola klinis wajar dan siapa yang tersisa.',
  },
  readmisi: {
    apa: 'Pasien dipulangkan lalu dirawat inap lagi dalam 30 hari. Bisa karena pulang terlalu dini, perawatan tidak tuntas, atau episode yang dipecah untuk dua klaim.',
    kejadian: 'Rawat inap ulang ≤30 hari setelah pulang, di RS mana pun; pasien meninggal dan jendela terpotong dikecualikan.',
    wajar: 'Peluang readmisi per admisi dari gradient boosting (INA-CBG, status pulang, diagnosis, jeda sejak rawat inap sebelumnya, riwayat 180 hari di luar RS yang dinilai, usia). Dijumlahkan per RS menjadi Expected.',
    putih: 'RS khusus (jiwa, ibu-anak) dibandingkan dengan pembanding sebaya sejenis pada kartu penjelasan.',
    sorot: 'Konfigurasi deteksi hanya memakai riwayat pasien di luar RS yang dinilai agar RS tidak dimaafkan oleh riwayat readmisinya sendiri.',
  },
}

export default function ModulPage() {
  const { m: mm } = useParams()
  const m = (mm ?? 'readmisi') as Modul
  const { faskes, ring } = useData()
  const [wil, setWil] = useState<'semarang' | 'jateng'>('semarang')
  const [putih, setPutih] = useState(true)
  const [nilai, setNilai] = useState<'OE' | 'rate' | 'rupiah'>('OE')
  const info = INFO[m], def = DEF[m], p = ring.per_modul[m]
  const rows = faskes.filter(f => f.modul[m] && (wil === 'jateng' || f.kab === KOTA) && f.modul[m]!.status !== 'volume_rendah')
  const urut = [...rows].sort((a, b) => (nilai === 'rupiah' ? b.modul[m]!.rupiah - a.modul[m]!.rupiah : nilai === 'rate' ? b.modul[m]!.rate - a.modul[m]!.rate : (b.modul[m]!.OE ?? 0) - (a.modul[m]!.OE ?? 0)))
  const tampil = urut.slice(0, wil === 'jateng' ? 25 : 30)
  const sebelum = m === 'fragmentasi' && !putih
  const scatter = rows.map(f => { const h = f.modul[m]!; return { x: h.n, y: sebelum ? (h.OE_sebelum_putih ?? h.OE) : h.OE, z: 1, nama: f.label, status: h.status, kelas: f.kelas_pendek, id: f.id } }).filter(r => r.y != null)

  return (
    <>
      <div className="eyebrow">Modul #{info.nomor}</div>
      <h1>{info.nama}</h1>
      <p className="sub">{def.apa}</p>
      <div className="grid3">
        <div className="card"><div className="eyebrow">Kejadian</div><div style={{ fontSize: 13, marginTop: 4 }}>{def.kejadian}</div></div>
        <div className="card"><div className="eyebrow">Angka wajar (Expected)</div><div style={{ fontSize: 13, marginTop: 4 }}>{def.wajar}</div></div>
        <div className="card"><div className="eyebrow">Daftar putih & catatan</div><div style={{ fontSize: 13, marginTop: 4 }}>{def.putih} {def.sorot}</div></div>
      </div>

      <div className="grid4" style={{ marginTop: 14 }}>
        <div className="card kpi"><div className="l">{info.unit} dinilai di Semarang</div><div className="v">{p.n_cukup}</div><div className="hint">dari {p.n_faskes}; minimum {ring.min_n[m]} {m === 'rujukan' ? 'kunjungan sakit' : m === 'fragmentasi' ? 'kunjungan RJTL' : 'rawat inap'}</div></div>
        <div className="card kpi red"><div className="l">Perlu perhatian</div><div className="v">{p.n_perhatian}</div><div className="hint">{p.n_diamati} diamati{m === 'fragmentasi' && p.n_diputihkan != null ? ` · ${p.n_diputihkan} memutih setelah daftar putih` : ''}</div></div>
        <div className="card kpi"><div className="l">O/E kota</div><div className="v">{oe(p.E > 0 ? p.O / p.E : null)}</div><div className="hint">{num(p.O)} kejadian vs {num(p.E, 1)} wajar</div></div>
        <div className="card kpi"><div className="l">Selisih rupiah</div><div className="v">{rp(p.rupiah)}</div><div className="hint">sampel · ≈ {rp(p.rupiah_tertimbang)} tertimbang</div></div>
      </div>

      <div className="toolbar" style={{ marginTop: 18 }}>
        <span className={'chip' + (wil === 'semarang' ? ' on' : '')} onClick={() => setWil('semarang')}>Kota Semarang</span>
        <span className={'chip' + (wil === 'jateng' ? ' on' : '')} onClick={() => setWil('jateng')}>Jawa Tengah (25 teratas)</span>
        <select value={nilai} onChange={e => setNilai(e.target.value as any)}><option value="OE">Urut O/E</option><option value="rate">Urut angka mentah</option><option value="rupiah">Urut selisih rupiah</option></select>
        {m === 'fragmentasi' && <label style={{ fontSize: 13 }}><input type="checkbox" checked={putih} onChange={e => setPutih(e.target.checked)} /> Terapkan daftar putih klinis</label>}
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Peringkat {info.unit} ({nilai === 'OE' ? 'O/E' : nilai === 'rate' ? 'angka mentah' : 'selisih rupiah'})</h3>
          <Peringkat rows={tampil} m={m} nilai={nilai} tinggi={Math.max(260, tampil.length * 20)} />
          <div className="hint">Warna = status. Klik nama di tabel bawah untuk membuka profil.</div>
        </div>
        <div className="card">
          <h3>Volume vs O/E{sebelum ? ' (sebelum daftar putih)' : ''}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid stroke="#ECEEF0" />
              <XAxis dataKey="x" type="number" name="Volume" tick={{ fontSize: 11 }} scale="log" domain={['auto', 'auto']} allowDataOverflow />
              <YAxis dataKey="y" type="number" name="O/E" tick={{ fontSize: 11 }} />
              <ZAxis dataKey="z" range={[50, 50]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => { const d = payload?.[0]?.payload; return d ? <div className="card" style={{ padding: '6px 10px', fontSize: 12 }}><b>{d.nama}</b> · {d.kelas}<br />volume {num(d.x)} · O/E {oe(d.y)}<br /><Pill s={d.status} /></div> : null }} />
              <Scatter data={scatter} isAnimationActive={false} shape={(pr: any) => <circle cx={pr.cx} cy={pr.cy} r={6} fill={STATUS[pr.payload.status as keyof typeof STATUS].warna} stroke="#fff" />} />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="hint">Garis wajar = 1,0. Faskes kecil menyebar lebih lebar; itu sebabnya skor z ikut menentukan status, bukan O/E saja.</div>
        </div>
      </div>

      {m === 'fragmentasi' && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Sebelum dan sesudah daftar putih klinis (Kota Semarang)</h3>
          <table className="t">
            <thead><tr><th>RS</th><th>Kelas</th><th className="num">Pangsa pola klinis wajar</th><th className="num">Angka sebelum</th><th className="num">O/E sebelum</th><th className="num">Angka sesudah</th><th className="num">O/E sesudah</th><th>Status</th></tr></thead>
            <tbody>{faskes.filter(f => f.kab === KOTA && f.modul.fragmentasi && f.modul.fragmentasi.status !== 'volume_rendah').sort((a, b) => (b.modul.fragmentasi!.OE_sebelum_putih ?? 0) - (a.modul.fragmentasi!.OE_sebelum_putih ?? 0)).map(f => { const h = f.modul.fragmentasi!; const memutih = (h.OE_sebelum_putih ?? 0) > 1.05 && h.status === 'wajar'; return (
              <tr key={f.id} style={memutih ? { background: '#E6F6EF' } : undefined}><td><Link to={'/faskes/' + f.id}>{f.label}</Link></td><td>{f.kelas_pendek}</td><td className="num">{pct(h.pangsa_putih)}</td><td className="num">{pct(h.rate_sebelum_putih)}</td><td className="num">{oe(h.OE_sebelum_putih)}</td><td className="num">{pct(h.rate)}</td><td className="num"><b>{oe(h.OE)}</b></td><td><Pill s={h.status} />{memutih && <span className="hint"> memutih</span>}</td></tr>) })}</tbody>
          </table>
        </div>
      )}

      {m === 'rujukan' && ring.metrik.rujukan?.top_dx_rujukan_semarang && (
        <div className="grid2" style={{ marginTop: 14 }}>
          <div className="card"><h3>Diagnosis rujukan tersering FKTP Semarang</h3>
            {ring.metrik.rujukan.top_dx_rujukan_semarang.map((d: any) => <div key={d.dx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 4 }}><span className="mono">{d.dx}</span><div className="bar"><div style={{ width: (d.n / ring.metrik.rujukan.top_dx_rujukan_semarang[0].n) * 100 + '%', background: '#6A5ACD' }} /></div><span className="num">{num(d.n)}</span></div>)}
            <div className="hint">Nasional: rasio rujuk {pct(ring.metrik.rujukan.rasio_rujuk_nasional)}; {pct(ring.metrik.rujukan.pangsa_nonspes_nasional)} rujukan berdiagnosis non-spesialistik ({ring.metrik.rujukan.n_diagnosis_nonspes} kode).</div></div>
          <div className="card"><h3>Puskesmas vs klinik vs dokter praktik (Semarang)</h3>
            <table className="t"><thead><tr><th>Jenis</th><th className="num">FKTP dinilai</th><th className="num">Rasio rujuk</th><th className="num">O/E</th><th className="num">Perlu perhatian</th></tr></thead>
              <tbody>{Array.from(new Set(rows.filter(f => f.kab === KOTA).map(f => f.kelas_pendek))).map(j => { const g = rows.filter(f => f.kab === KOTA && f.kelas_pendek === j); const O = g.reduce((s, f) => s + f.modul.rujukan!.O, 0), E = g.reduce((s, f) => s + f.modul.rujukan!.E, 0), n = g.reduce((s, f) => s + f.modul.rujukan!.n, 0); return <tr key={j}><td>{j}</td><td className="num">{g.length}</td><td className="num">{pct(n ? (O / n) * 100 : null)}</td><td className="num">{oe(E ? O / E : null)}</td><td className="num">{g.filter(f => f.modul.rujukan!.status === 'perhatian').length}</td></tr> })}</tbody></table></div>
        </div>
      )}

      {m === 'readmisi' && (
        <div className="grid2" style={{ marginTop: 14 }}>
          <div className="card"><Tren rows={ring.tren.readmisi} judul="Kota Semarang per bulan: readmisi nyata vs wajar" /></div>
          <div className="card"><h3>Daftar pasien risiko tinggi (pencegahan, anonim)</h3>
            <div className="hint" style={{ marginBottom: 6 }}>Admisi Okt–Nov 2024 di RS Semarang dengan peluang readmisi tertinggi. Untuk tim pencegahan RS: pastikan rencana pulang dan kontrol. Tanpa identitas.</div>
            <table className="t" style={{ fontSize: 12 }}><thead><tr><th>ID</th><th>RS</th><th className="num">Umur</th><th>INA-CBG</th><th>Dx</th><th className="num">LOS</th><th className="num">Riw. RITL</th><th className="num">Peluang</th></tr></thead>
              <tbody>{ring.risiko_tinggi.slice(0, 10).map(r => <tr key={r.id}><td className="mono">{r.id}</td><td><Link to={'/faskes/' + r.faskes}>RS-{r.faskes}</Link></td><td className="num">{r.umur ?? '–'}</td><td className="mono">{r.cbg}</td><td className="mono">{r.dx}</td><td className="num">{r.los}</td><td className="num">{r.riw_ritl}</td><td className="num"><b>{pct(r.p * 100, 0)}</b></td></tr>)}</tbody></table></div>
        </div>
      )}

      <h2>Semua {info.unit} yang dinilai ({wil === 'semarang' ? 'Kota Semarang' : 'Jawa Tengah'})</h2>
      <div className="card" style={{ padding: 0 }}>
        <table className="t">
          <thead><tr><th>Faskes</th>{wil === 'jateng' && <th>Kab/Kota</th>}<th>Kelas</th><th className="num">Volume</th><th className="num">Kejadian</th><th className="num">Wajar</th><th className="num">Angka</th><th className="num">O/E</th><th className="num">z</th><th className="num">Selisih</th><th>Status</th></tr></thead>
          <tbody>{urut.slice(0, 200).map((f: Faskes) => { const h = f.modul[m]!; return <tr key={f.id}><td><Link to={'/faskes/' + f.id}><b>{f.label}</b></Link></td>{wil === 'jateng' && <td>{f.kab}</td>}<td>{f.kelas_pendek}</td><td className="num">{num(h.n)}</td><td className="num">{num(h.O)}</td><td className="num">{num(h.E, 1)}</td><td className="num">{pct(h.rate)}</td><td className="num"><b>{oe(h.OE)}</b></td><td className="num">{h.z == null ? '–' : num(h.z, 2)}</td><td className="num">{rp(h.rupiah)}</td><td><Pill s={h.status} /></td></tr> })}</tbody>
        </table>
      </div>
    </>
  )
}
