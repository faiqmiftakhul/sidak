import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { Chip, Pager, Peringkat, Pilih, Tren } from '../components/Common'
import KpiCard from '../components/KpiCard'
import { OEChip, Progres, RupiahText, Spark, StatusPill } from '../components/sig'
import { Sparkle } from '../components/Sparkle'
import { useAi } from '../components/ai'
import { Faskes, INFO, KOTA, Modul, STATUS, bacaStatusAudit, num, oe, pct, rp, simpanStatusAudit, useData } from '../lib/data'

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
  const { buka } = useAi()
  const [sp, setSP] = useSearchParams()
  const wil = (sp.get('wil') === 'jateng' ? 'jateng' : 'semarang') as 'semarang' | 'jateng'
  const nilai = (sp.get('nilai') as 'OE' | 'rate' | 'rupiah') || 'OE'
  const putih = sp.get('putih') !== '0'
  const patch = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v == null || v === '') n.delete(k); else n.set(k, v); setSP(n, { replace: true }) }

  const info = INFO[m], def = DEF[m], p = ring.per_modul[m]
  const rows = faskes.filter(f => f.modul[m] && (wil === 'jateng' || f.kab === KOTA) && f.modul[m]!.status !== 'volume_rendah')
  const urut = [...rows].sort((a, b) => (nilai === 'rupiah' ? b.modul[m]!.rupiah - a.modul[m]!.rupiah : nilai === 'rate' ? b.modul[m]!.rate - a.modul[m]!.rate : (b.modul[m]!.OE ?? 0) - (a.modul[m]!.OE ?? 0)))
  const chartRows = urut.slice(0, wil === 'jateng' ? 25 : 30)
  const [page, setPage] = useState(1)
  const [per, setPer] = useState(50)
  useEffect(() => setPage(1), [wil, nilai, putih, m])
  const tTable = urut.slice((page - 1) * per, page * per)
  const sebelum = m === 'fragmentasi' && !putih
  const scatter = rows.map(f => { const h = f.modul[m]!; return { x: h.n, y: sebelum ? (h.OE_sebelum_putih ?? h.OE) : h.OE, z: 1, nama: f.label, status: h.status, kelas: f.kelas_pendek, id: f.id } }).filter(r => r.y != null)

  const [versi, setVersi] = useState(0)
  const audit = useMemo(() => { void versi; return bacaStatusAudit() }, [versi])

  return (
    <>
      <div className="eyebrow">Modul #{info.nomor}</div>
      <h1>{info.nama}</h1>
      <p className="sub">{def.apa}</p>
      <div className="hbar" style={{ marginBottom: 12 }}>
        <button type="button" className="chip ghost" onClick={() => buka({ konteks: `Modul #${info.nomor} ${info.nama}`, pertanyaan: `Apa yang perlu diperiksa pada modul #${info.nomor} ${info.nama}?` })}><Sparkle size={13} /> Tanya AI tentang modul ini</button>
      </div>
      <details className="acc" open style={{ marginBottom: 12 }}>
        <summary>Bagaimana modul ini dinilai?</summary>
        <div className="isi" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div><div className="eyebrow">Kejadian</div><div style={{ marginTop: 4 }}>{def.kejadian}</div></div>
          <div><div className="eyebrow">Angka wajar (Expected)</div><div style={{ marginTop: 4 }}>{def.wajar}</div></div>
          <div><div className="eyebrow">Daftar putih & catatan</div><div style={{ marginTop: 4 }}>{def.putih} {def.sorot}</div></div>
        </div>
      </details>

      <div className="grid4">
        <KpiCard role="coverage" label={`${info.unit} dinilai di Semarang`} value={p.n_cukup} href={'/antrean?mod=' + m} hint={<>dari {p.n_faskes}; minimum {ring.min_n[m]} {m === 'rujukan' ? 'kunjungan sakit' : m === 'fragmentasi' ? 'kunjungan RJTL' : 'rawat inap'}</>} />
        <KpiCard role="attention" label="Perlu perhatian" value={p.n_perhatian} href={'/antrean?st=perhatian&mod=' + m} hint={<>{p.n_diamati} diamati{m === 'fragmentasi' && p.n_diputihkan != null ? ` · ${p.n_diputihkan} wajar setelah daftar putih` : ''}</>} />
        <KpiCard role="ratio" label="O/E kota" value={oe(p.E > 0 ? p.O / p.E : null)} statusPill sparkline={(ring.tren[m] ?? []).map(b => b.E > 0 ? b.O / b.E : null).filter((x): x is number => x != null)} hint={<>{num(p.O)} kejadian vs {num(p.E, 1)} wajar</>} />
        <KpiCard role="money" label="Selisih rupiah" value={rp(p.rupiah)} href={'/antrean?mod=' + m} hint={<>sampel · ≈ {rp(p.rupiah_tertimbang)} tertimbang</>} />
      </div>

      <div className="toolbar" style={{ marginTop: 18 }}>
        <div className="seg" role="group" aria-label="Wilayah">
          <button type="button" className={wil === 'semarang' ? 'on' : ''} onClick={() => patch('wil', 'semarang')}>Kota Semarang</button>
          <button type="button" className={wil === 'jateng' ? 'on' : ''} onClick={() => patch('wil', 'jateng')}>Jawa Tengah (25 teratas)</button>
        </div>
        <Pilih label="Urut" nilai={nilai} ubah={v => patch('nilai', v === 'OE' ? null : v)} opsi={[{ nilai: 'OE', label: 'O/E' }, { nilai: 'rate', label: 'Angka mentah' }, { nilai: 'rupiah', label: 'Selisih rupiah' }]} />
        {m === 'fragmentasi' && <label className="cek"><input type="checkbox" checked={putih} onChange={e => patch('putih', e.target.checked ? null : '0')} /> Terapkan daftar putih klinis</label>}
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Peringkat {info.unit} ({nilai === 'OE' ? 'O/E · tanda 1,0 = wajar' : nilai === 'rate' ? 'angka mentah' : 'selisih rupiah'})</h3>
          <Peringkat rows={chartRows} m={m} nilai={nilai} tinggi={Math.max(260, chartRows.length * 20)} refX={nilai === 'OE' ? 1 : undefined} />
          <div className="hint">Warna = status. Klik nama di tabel bawah untuk membuka profil.</div>
        </div>
        <div className="card">
          <h3>Volume vs O/E{sebelum ? ' (sebelum daftar putih)' : ''}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid stroke="#ECEEF0" />
              <ReferenceLine y={1} stroke="var(--grey-2)" strokeDasharray="4 3" label={{ value: '1,0', position: 'right', fontSize: 10, fill: 'var(--grey-2)' }} />
              <XAxis dataKey="x" type="number" name="Volume" tick={{ fontSize: 11 }} scale="log" domain={['auto', 'auto']} allowDataOverflow />
              <YAxis dataKey="y" type="number" name="O/E" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <ZAxis dataKey="z" range={[50, 50]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => { const d = payload?.[0]?.payload; return d ? <div className="card" style={{ padding: 8, fontSize: 12 }}><b>{d.nama}</b> · {d.kelas}<br />volume {num(d.x)} · O/E {oe(d.y)}<br /><StatusPill s={d.status} /></div> : null }} />
              <Scatter data={scatter} isAnimationActive={false} shape={(pr: any) => <circle cx={pr.cx} cy={pr.cy} r={6} fill={STATUS[pr.payload.status as keyof typeof STATUS].warna} stroke="#fff" />} />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="hint">Garis 1,0 = wajar. Faskes kecil menyebar lebih lebar; itu sebabnya skor z ikut menentukan status, bukan O/E saja.</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card" style={{ marginTop: 12 }}>
          <Tren rows={ring.tren[m]} judul={`Kota Semarang per bulan: ${INFO[m].kejadian} nyata vs wajar`} />
          <div className="hint" style={{ marginTop: 8 }}><Link to="/peta">Lihat peta Jawa Tengah untuk modul ini →</Link></div>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Ambang & interpretasi</h3>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--grey)' }}>
            Status didasarkan pada O/E dan skor z berpasan: dalam rentang wajar bila O/E ≤ 1,05 <b>atau</b> z ≤ 1,96; cukup sering dipakai ambang ganda dengan kestabilan dua paruh periode. Angka dipakai untuk <b>memprioritaskan audit</b> — setiap indikasi diverifikasi auditor pada klaim sampel.
          </div>
          <PenjelasanLengkap info={info} />
        </div>
      </div>

      {m === 'fragmentasi' && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Sebelum dan sesudah daftar putih klinis (Kota Semarang)</h3>
          <div className="twrap">
            <table className="t">
              <thead><tr><th>RS</th><th>Kelas</th><th className="num">Pangsa pola klinis wajar</th><th className="num">Angka sebelum</th><th className="num">O/E sebelum</th><th className="num">Angka sesudah</th><th className="num">O/E sesudah</th><th>Status</th></tr></thead>
              <tbody>{faskes.filter(f => f.kab === KOTA && f.modul.fragmentasi && f.modul.fragmentasi.status !== 'volume_rendah').sort((a, b) => (b.modul.fragmentasi!.OE_sebelum_putih ?? 0) - (a.modul.fragmentasi!.OE_sebelum_putih ?? 0)).map(f => { const h = f.modul.fragmentasi!; const memutih = (h.OE_sebelum_putih ?? 0) > 1.05 && h.status === 'wajar'; return (
                <tr key={f.id} className={memutih ? 'memutih' : undefined}><td><Link to={'/faskes/' + f.id}>{f.label}</Link></td><td>{f.kelas_pendek}</td><td className="num">{pct(h.pangsa_putih)}</td><td className="num">{pct(h.rate_sebelum_putih)}</td><td className="num">{oe(h.OE_sebelum_putih)}</td><td className="num">{pct(h.rate)}</td><td className="num"><b>{oe(h.OE)}</b></td><td><StatusPill s={h.status} />{memutih && <span className="hint"> wajar</span>}</td></tr>) })}</tbody>
            </table>
          </div>
        </div>
      )}

      {m === 'rujukan' && ring.metrik.rujukan?.top_dx_rujukan_semarang && (
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="card"><h3>Diagnosis rujukan tersering FKTP Semarang</h3>
            {ring.metrik.rujukan.top_dx_rujukan_semarang.map((d: any) => <div key={d.dx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 4 }}><span className="mono">{d.dx}</span><div className="bar"><div style={{ width: (d.n / ring.metrik.rujukan.top_dx_rujukan_semarang[0].n) * 100 + '%', background: 'var(--brand)' }} /></div><span className="num">{num(d.n)}</span></div>)}
            <div className="hint">Nasional: rasio rujuk {pct(ring.metrik.rujukan.rasio_rujuk_nasional)}; {pct(ring.metrik.rujukan.pangsa_nonspes_nasional)} rujukan berdiagnosis non-spesialistik ({ring.metrik.rujukan.n_diagnosis_nonspes} kode).</div></div>
          <div className="card"><h3>Puskesmas vs klinik vs dokter praktik (Semarang)</h3>
            <div className="twrap"><table className="t"><thead><tr><th>Jenis</th><th className="num">FKTP dinilai</th><th className="num">Rasio rujuk</th><th className="num">O/E</th><th className="num">Perlu perhatian</th></tr></thead>
              <tbody>{Array.from(new Set(rows.filter(f => f.kab === KOTA).map(f => f.kelas_pendek))).map(j => { const g = rows.filter(f => f.kab === KOTA && f.kelas_pendek === j); const O = g.reduce((s, f) => s + f.modul.rujukan!.O, 0), E = g.reduce((s, f) => s + f.modul.rujukan!.E, 0), n = g.reduce((s, f) => s + f.modul.rujukan!.n, 0); return <tr key={j}><td>{j}</td><td className="num">{g.length}</td><td className="num">{pct(n ? (O / n) * 100 : null)}</td><td className="num">{oe(E ? O / E : null)}</td><td className="num">{g.filter(f => f.modul.rujukan!.status === 'perhatian').length}</td></tr> })}</tbody></table></div></div>
        </div>
      )}

      {m === 'readmisi' && ring.risiko_tinggi.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Daftar pasien risiko tinggi (pencegahan, anonim)</h3>
          <div className="hint" style={{ marginBottom: 8 }}>Admisi Okt–Nov 2024 di RS Semarang dengan peluang readmisi tertinggi. Untuk tim pencegahan RS: pastikan rencana pulang dan kontrol. Tanpa identitas.</div>
          <div style={{ overflowX: 'auto' }}><table className="t" style={{ fontSize: 12 }}><thead><tr><th>ID</th><th>RS</th><th className="num">Umur</th><th>INA-CBG</th><th>Dx</th><th className="num">LOS</th><th className="num">Riw. RITL</th><th className="num">Peluang</th></tr></thead>
            <tbody>{ring.risiko_tinggi.slice(0, 10).map(r => <tr key={r.id}><td className="mono">{r.id}</td><td><Link to={'/faskes/' + r.faskes}>RS-{r.faskes}</Link></td><td className="num">{r.umur ?? '–'}</td><td className="mono">{r.cbg}</td><td className="mono">{r.dx}</td><td className="num">{r.los}</td><td className="num">{r.riw_ritl}</td><td className="num"><b>{pct(r.p * 100, 0)}</b></td></tr>)}</tbody></table></div>
        </div>
      )}

      <h2>Semua {info.unit} yang dinilai ({wil === 'semarang' ? 'Kota Semarang' : 'Jawa Tengah'})</h2>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table className="t">
            <thead><tr><th>Faskes</th>{wil === 'jateng' && <th>Kab/Kota</th>}<th>Kelas</th><th className="num">Volume</th><th className="num">O/E (z)</th><th>Tren 6 bln</th><th className="num">≈ Selisih tbg</th><th>Status</th><th>Progres</th></tr></thead>
            <tbody>{tTable.map((f: Faskes) => { const h = f.modul[m]!; return <tr key={f.id} className={'tr-' + h.status}><td><Link to={'/faskes/' + f.id}><b>{f.label}</b></Link></td>{wil === 'jateng' && <td>{f.kab}</td>}<td>{f.kelas_pendek}</td><td className="num">{num(h.n)}</td><td className="num"><OEChip v={h.OE} z={h.z} n={h.n} st={h.status} /></td><td><Spark rows={f.bulanan[m] ?? []} /></td><td className="num"><RupiahText v={h.rupiah_tertimbang} /></td><td><StatusPill s={h.status} /></td><td><Progres nilai={audit[f.id] ?? 'belum'} fb={s => { simpanStatusAudit(f.id, s); setVersi(v => v + 1) }} /></td></tr> })}</tbody>
          </table>
        </div>
        {tTable.length > 0 && <Pager total={urut.length} page={page} per={per} ubah={setPage} ubahPer={p => { setPer(p); setPage(1) }} />}
      </div>
    </>
  )
}

function PenjelasanLengkap({ info }: { info: (typeof INFO)[Modul] }) {
  return <div className="hint" style={{ marginTop: 8 }}>Pembatas ambang dan daftar putih dirinci di halaman <Link to="/metodologi">Metodologi</Link>. O/E dan z dihitung terhadap Expected berbasis rekan sebaya, bukan "normal" tunggal.</div>
}