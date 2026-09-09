import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { mdiDownload, mdiShieldCheckOutline } from '@mdi/js'
import { Penjelasan, Tren } from '../components/Common'
import KpiCard from '../components/KpiCard'
import { Icon } from '../components/Icon'
import { Sparkle } from '../components/Sparkle'
import { useAi } from '../components/ai'
import { DotPlot, FaskesCode, LABEL_AUDIT, OEChip, Progres, RupiahText, StatusPill } from '../components/sig'
import { AKTIVITAS_KEY, CATATAN_KEY, Faskes, INFO, KOTA, MODUL, Modul, STATUS, StatusAudit, TEMUAN_KEY, ambilJSON, bacaStatusAudit, judulKab, num, oe, pct, rp, sebaya, simpanJSON, simpanStatusAudit, useData } from '../lib/data'

const OPSI_TEMUAN = ['Belum ada kesimpulan', 'Dokumentasi medis tidak lengkap', 'Kode perlu klarifikasi', 'Proses layanan perlu perbaikan', 'Tidak ditemukan masalah setelah pemeriksaan']

const fmtTgl = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Profil() {
  const { id } = useParams()
  const { faskes, ring } = useData()
  const { buka } = useAi()
  const f = faskes.find(x => x.id === id)
  const [tab, setTab] = useState<Modul | null>(null)
  const [audit, setAuditS] = useState<StatusAudit>(bacaStatusAudit()[id ?? ''] ?? 'belum')
  const [catatan, setCatatan] = useState('')
  const [temuan, setTemuan] = useState('')
  const [akt, setAkt] = useState<{ t: number; s: string }[]>([])
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!f) return
    setAuditS(bacaStatusAudit()[f.id] ?? 'belum')
    setCatatan(String(ambilJSON(CATATAN_KEY)[f.id] ?? ''))
    setTemuan(String(ambilJSON(TEMUAN_KEY)[f.id] ?? ''))
    const a = ambilJSON(AKTIVITAS_KEY)[f.id]; setAkt(Array.isArray(a) ? a : [])
  }, [f?.id])

  const moduls = f ? MODUL.filter(k => f.modul[k]) : []
  const m = tab && f?.modul[tab] ? tab : (moduls.find(k => f?.modul[k]!.status === 'perhatian') ?? moduls.find(k => f?.modul[k]!.status === 'diamati') ?? moduls[0])
  const h = m && f ? f.modul[m]! : undefined

  const gKel = useMemo(() => {
    if (!f || !m || !h) return { n: 0, P: 0, rank: 0, med: null as number | null, vs: [] as number[] }
    const mn = ring.min_n[m]
    const vs = faskes.filter(x => x.id !== f.id && x.tipe === f.tipe && x.kelas === f.kelas && x.modul[m] && x.modul[m]!.status !== 'volume_rendah' && x.modul[m]!.n >= mn && x.modul[m]!.OE != null).map(x => x.modul[m]!.OE as number).sort((a, b) => a - b)
    const oeVal = h.OE
    const diBawah = oeVal == null ? 0 : vs.filter(v => v <= oeVal).length
    return { n: vs.length, P: vs.length ? Math.round((diBawah / vs.length) * 100) : 0, rank: Math.min(diBawah + 1, vs.length), med: vs.length ? vs[Math.floor((vs.length - 1) / 2)] : null, vs }
  }, [faskes, f, m, h, ring.min_n])

  const peersTop = useMemo(() => (f && m ? sebaya(faskes, f, m) : []), [faskes, f, m])
  const ci: [number, number] | null = h && h.E > 0 && h.O > 0 ? [Math.max(0, (h.O - 1.96 * Math.sqrt(h.O)) / h.E), (h.O + 1.96 * Math.sqrt(h.O)) / h.E] : null

  const catat = (s: string) => {
    const n = [...akt, { t: Date.now(), s }].slice(-24)
    setAkt(n); const o = ambilJSON(AKTIVITAS_KEY); o[f!.id] = n; simpanJSON(AKTIVITAS_KEY, o)
  }
  const setAudit = (s: StatusAudit) => {
    if (s === audit || !f) return
    setAuditS(s); simpanStatusAudit(f.id, s); catat(`progres audit → ${LABEL_AUDIT[s]}`)
  }
  const ubahCatatan = (v: string) => {
    setCatatan(v); if (!f) return
    const o = ambilJSON(CATATAN_KEY); if (v === '') delete o[f.id]; else o[f.id] = v; simpanJSON(CATATAN_KEY, o)
  }
  const ubahTemuan = (v: string) => {
    setTemuan(v); if (!f) return
    const o = ambilJSON(TEMUAN_KEY); if (!v) delete o[f.id]; else o[f.id] = v; simpanJSON(TEMUAN_KEY, o)
    if (v) catat(`kesimpulan → ${v}`)
  }

  function ekspor() {
    if (!f) return
    const g: string[] = []
    g.push('RINGKASAN AUDIT — SIDAK (Data Sampel anonim ±1%)')
    g.push('Faskes: ' + f.label + ' · ' + f.kelas_pendek + ' · ' + judulKab(f.kab) + ' · ' + f.milik)
    g.push('Periode: ' + ring.periode)
    MODUL.forEach(k => {
      const x = f.modul[k]; if (!x) return
      g.push('')
      g.push(`[#${INFO[k].nomor} ${INFO[k].nama}] ${STATUS[x.status].label}`)
      g.push(`  n=${num(x.n)} | O=${num(x.O)} | E=${num(x.E, 1)} | O/E=${oe(x.OE)} | z=${x.z == null ? '-' : num(x.z, 2)}`)
      g.push(`  selisih sampel=${rp(x.rupiah)} | tertimbang≈${rp(x.rupiah_tertimbang)}`)
    })
    g.push('')
    g.push('Status audit: ' + LABEL_AUDIT[audit])
    g.push('Kesimpulan sementara: ' + (temuan || '-'))
    g.push('Catatan: ' + (catatan.replace(/\n/g, ' | ') || '-'))
    g.push('Aktivitas:')
    akt.slice().reverse().forEach(x => g.push('  - ' + fmtTgl(x.t) + ' ' + x.s))
    const blob = new Blob(['\ufeff' + g.join('\n')], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sidak-ringkasan-' + f.id + '.txt'; a.click()
  }

  if (!f) return <div className="card">Faskes tidak ditemukan.</div>
  const bln = f.bulanan[m] ?? []
  const sampel = f.sampel[m] ?? []

  return (
    <>
      <div className="profil-top">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow"><Link to="/antrean">Antrean audit</Link> › {judulKab(f.kab)} · {f.kelas_pendek} · {f.milik}</div>
          <h1>{f.label}</h1>
          <div className="hbar" style={{ marginTop: 4 }}><FaskesCode id={f.id} /><span className="hint" style={{ margin: 0 }}>kode samaran dari Data Sampel</span></div>
        </div>
        <div className="hbar" style={{ justifyContent: 'flex-end' }}>
          {f && <button className="chip ghost" type="button" onClick={() => buka({ konteks: `${f.label} · ${f.kab}`, pertanyaan: `Apa temuan utama untuk ${f.label}?` })}><Sparkle size={13} /> Tanya AI tentang {f.id}</button>}
          {moduls.map(k => <StatusPill key={k} s={f.modul[k]!.status} />)}
          <button className="btn primary" type="button" onClick={() => railRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{audit === 'belum' ? 'Mulai audit' : 'Lanjutkan audit'}</button>
        </div>
      </div>

      <div className="info-banner" style={{ marginBottom: 12 }}><Icon path={mdiShieldCheckOutline} size={18} />
        <span>Hasil per modul di bawah adalah <b>indikasi statistik</b> untuk memprioritaskan audit: O/E, skor z, dan selisih rupiah dibaca berpasangan dan dibandingkan dengan rekan sebaya sekelas. Keputusan penetapan tetap di tangan auditor pada pemeriksaan klaim sampel.</span>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {moduls.map(k => <button key={k} type="button" className={m === k ? 'on' : ''} onClick={() => setTab(k)}>#{INFO[k].nomor} {INFO[k].nama}</button>)}
      </div>

      <div className="profil-lay">
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Penjelasan f={f} m={m} h={h!} />

          <div className="card">
            <div className="hbar" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Posisi O/E • modul #{INFO[m].nomor}</h3>
              <span className="percentil">{gKel.n > 0 ? <>Posisi <b>persentil ke-{gKel.P}</b> dari {gKel.n} {f.tipe === 'FKTP' ? 'FKTP' : 'RS'} sekelas dengan volume cukup</> : 'Belum ada pembanding sekelas yang cukup'}</span>
            </div>
            <div className="metrik" style={{ marginTop: 12 }}>
              <KpiCard role="ratio" label="O/E" value={oe(h!.OE)} variant="sm" />
              <KpiCard role="neutral" label="Skor z" value={h!.z == null ? '–' : num(h!.z, 2)} variant="sm" />
              <KpiCard role="coverage" label={`Volume ${INFO[m].kejadian.toLowerCase()}`} value={num(h!.n)} variant="sm" />
              <KpiCard role="money" label="≈ Selisih tertimbang" value={rp(h!.rupiah_tertimbang)} variant="sm" />
            </div>
            <div style={{ marginTop: 12 }}>
              <OEChip besar v={h!.OE} n={h!.n} st={h!.status} ci={ci} med={gKel.med} />
            </div>
            {gKel.n > 0 && <div style={{ marginTop: 8 }}><DotPlot nilai={gKel.vs.slice(0, 40)} f={h!.OE ?? 0} kelas={f.kelas_pendek} /></div>}
            <div className="hint" style={{ marginTop: 8 }}>
              Sebaran O/E rekan sebaya sekelas (abu) vs faskes ini (ambar). Garis putus-putus = wajar (1,0); garis pendek &mdash; = median rekan sebaya. Kimia pendek di atas rel = selang keyakinan 95% untuk O/E.
            </div>
          </div>

          <div className="card">
            {bln.length > 0 ? <Tren rows={bln} judul={`Per bulan: ${INFO[m].kejadian} nyata vs wajar`} /> : <div className="hint">Rincian bulanan tidak tersedia untuk faskes di luar Kota Semarang.</div>}
            {m === 'fragmentasi' && h!.OE_sebelum_putih != null && <div className="hint" style={{ marginTop: 8 }}>Sebelum daftar putih klinis: angka {pct(h!.rate_sebelum_putih)} dan O/E {oe(h!.OE_sebelum_putih)}. Pola klinis wajar (dialisis, kemoterapi, radioterapi, rehabilitasi, transfusi) sebesar <b>{pct(h!.pangsa_putih)}</b> kunjungan telah dikeluarkan.</div>}
            {m === 'rujukan' && h!.pangsa_nonspes != null && <div className="hint" style={{ marginTop: 8 }}>Pangsa rujukan berdiagnosis non-spesialistik: <b>{pct(h!.pangsa_nonspes)}</b>.</div>}
          </div>

          {peersTop.length > 0 && (
            <div className="card">
              <h3>Rekan sebaya terdekat (volume)</h3>
              {peersTop.map(p => <div key={p.id} className="hbar" style={{ padding: '4px 0', justifyContent: 'space-between' }}><Link to={'/faskes/' + p.id} style={{ fontSize: 13 }}>{p.label}</Link><OEChip v={p.modul[m]!.OE} n={p.modul[m]!.n} st={p.modul[m]!.status} /></div>)}
              <div className="hint">Sebaya = faskes lain dengan tipe & kelas sama serta volume terdekat pada modul ini.</div>
            </div>
          )}

          <div className="card">
            <h3>Sampel klaim untuk auditor</h3>
            {sampel.length === 0 ? <div className="hint">Tidak ada sampel: faskes tidak berada di Kota Semarang, tidak ada kejadian, atau modul FKTP.</div> : <>
              <div style={{ overflowX: 'auto' }}>
                <table className="t mono" style={{ fontSize: 11 }}>
                  <thead><tr>{Object.keys(sampel[0]).map(k => <th key={k}>{k === 'p' ? 'peluang' : k === 'gap' || k === 'jeda' ? 'jeda (hari)' : k === 'FKL47' ? 'tarif' : k === 'FKL19' ? 'INA-CBG' : k === 'FKL17A' ? 'dx utama' : k === 'los' ? 'LOS' : k}</th>)}</tr></thead>
                  <tbody>{sampel.slice(0, 12).map((r, i) => <tr key={i}>{Object.entries(r).map(([k, v]) => <td key={k}>{k === 'FKL47' ? rp(Number(v)) : String(v)}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="hint">Hanya kolom teknis; tanpa nomor kartu, SEP, nama peserta, atau nama dokter. {sampel.length} baris tersedia untuk diekspor.</div>
            </>}
          </div>
        </div>

        <div className="aular" ref={railRef}>
          <div className="aular-box">
            <div className="card">
              <h3>Tindak lanjut</h3>
              <Progres nilai={audit} fb={setAudit} />
              <div className="hint">Disimpan di peramban ini (demo). Di pilot, masuk ke sistem manajemen kasus audit cabang.</div>
            </div>
            <div className="card">
              <h3>Kesimpulan sementara</h3>
              <select value={temuan} onChange={e => ubahTemuan(e.target.value)} aria-label="Kesimpulan sementara">
                {OPSI_TEMUAN.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <div className="hint">Pilihan netral — bukan label pelanggaran.</div>
            </div>
            <div className="card">
              <h3>Catatan audit</h3>
              <textarea value={catatan} onChange={e => ubahCatatan(e.target.value)} placeholder="Temuan di klaim sampel, klarifikasi kode, rencana tindak lanjut…" aria-label="Catatan audit" />
              <div className="hint">Autosimpan · nampak di antrean audit.</div>
            </div>
            <div className="card">
              <h3>Aktivitas</h3>
              {akt.length === 0 ? <div className="hint">Belum ada aktivitas pada faskes ini.</div> : <div className="timeline">{akt.slice().reverse().slice(0, 8).map((x, i) => <div key={i} className="tl"><span className="tgl">{fmtTgl(x.t)}</span><span>{x.s}</span></div>)}</div>}
            </div>
            <button className="btn primary rail-cta" type="button" onClick={ekspor}><Icon path={mdiDownload} size={15} /> Ekspor ringkasan audit</button>
          </div>
        </div>
      </div>
    </>
  )
}