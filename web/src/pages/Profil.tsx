import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Penjelasan, Pill, Tren } from '../components/Common'
import { INFO, KOTA, MODUL, Modul, StatusAudit, bacaStatusAudit, judulKab, num, oe, pct, rp, simpanStatusAudit, useData } from '../lib/data'

export default function Profil() {
  const { id } = useParams()
  const { faskes } = useData()
  const f = faskes.find(x => x.id === id)
  const [audit, setAudit] = useState<StatusAudit>(bacaStatusAudit()[id ?? ''] ?? 'belum')
  const [tab, setTab] = useState<Modul | null>(null)
  if (!f) return <div className="card">Faskes tidak ditemukan.</div>
  const moduls = MODUL.filter(m => f.modul[m])
  const m = tab && f.modul[tab] ? tab : (moduls.find(k => f.modul[k]!.status === 'perhatian') ?? moduls.find(k => f.modul[k]!.status === 'diamati') ?? moduls[0])
  const h = f.modul[m]!
  const bln = f.bulanan[m] ?? []
  const sampel = f.sampel[m] ?? []
  const ubah = (s: StatusAudit) => { setAudit(s); simpanStatusAudit(f.id, s) }

  return (
    <>
      <div className="eyebrow"><Link to="/antrean">Antrean audit</Link> › {judulKab(f.kab)}</div>
      <h1>{f.label} <span style={{ fontWeight: 400, fontSize: 16, color: '#5F666E' }}>· {f.kelas_pendek} · {f.milik}</span></h1>
      <p className="sub">{f.tipe === 'FKRTL' ? `${num(f.n_ritl)} rawat inap dan ${num(f.n_rjtl)} kunjungan rawat jalan pada sampel 2024.` : `${num(f.n_kunjungan)} kunjungan sakit pada sampel 2024.`} Kode faskes adalah kode samaran dari Data Sampel; identitas RS tidak tersedia.
        {f.kab !== KOTA && <> Faskes ini berada di {judulKab(f.kab)}; rincian bulanan dan sampel klaim hanya disiapkan untuk Kota Semarang.</>}</p>

      <div className="grid4">
        {moduls.map(k => { const x = f.modul[k]!; return (
          <div key={k} className="card" style={{ cursor: 'pointer', borderTop: '4px solid ' + INFO[k].warna, outline: k === m ? '2px solid #0D366B' : 'none' }} onClick={() => setTab(k)}>
            <div className="eyebrow">Modul #{INFO[k].nomor}</div>
            <h3 style={{ margin: '2px 0 6px' }}>{INFO[k].nama}</h3>
            <Pill s={x.status} />
            <div className="kv" style={{ marginTop: 8, fontSize: 12 }}>
              <span className="k">O / E</span><span>{num(x.O)} / {num(x.E, 1)}</span>
              <span className="k">O/E · z</span><span><b>{oe(x.OE)}</b> · {x.z == null ? '–' : num(x.z, 2)}</span>
              <span className="k">Angka mentah</span><span>{pct(x.rate)}</span>
              <span className="k">Selisih</span><span>{rp(x.rupiah)}</span>
            </div>
          </div>) })}
        {moduls.length < 4 && <div className="card soft"><div className="eyebrow">Skor gabungan</div><div style={{ fontSize: 22, fontWeight: 700, color: '#0D366B', margin: '6px 0' }}>{rp(f.rupiah)}</div><div className="hint">jumlah selisih rupiah dari modul yang menandai (sampel) · ≈ {rp(f.rupiah_tertimbang)} tertimbang</div></div>}
      </div>

      <h2>#{INFO[m].nomor} {INFO[m].nama}</h2>
      <Penjelasan f={f} m={m} h={h} />

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          {bln.length > 0 ? <Tren rows={bln} judul="Per bulan: kejadian nyata vs wajar" /> : <div className="hint">Rincian bulanan tidak tersedia untuk faskes di luar Kota Semarang.</div>}
          {m === 'fragmentasi' && h.OE_sebelum_putih != null && <div className="hint" style={{ marginTop: 8 }}>Sebelum daftar putih klinis: angka {pct(h.rate_sebelum_putih)} dan O/E {oe(h.OE_sebelum_putih)}. Pola klinis wajar (dialisis, kemoterapi, radioterapi, rehabilitasi, transfusi) sebesar <b>{pct(h.pangsa_putih)}</b> kunjungan telah dikeluarkan.</div>}
          {m === 'rujukan' && h.pangsa_nonspes != null && <div className="hint" style={{ marginTop: 8 }}>Pangsa rujukan berdiagnosis non-spesialistik: <b>{pct(h.pangsa_nonspes)}</b>.</div>}
        </div>
        <div className="card">
          <h3>Tindak lanjut</h3>
          <div className="row" style={{ marginBottom: 10 }}>
            {(['belum', 'sedang', 'selesai'] as StatusAudit[]).map(s => <span key={s} className={'chip' + (audit === s ? ' on' : '')} onClick={() => ubah(s)}>{s === 'belum' ? 'Belum dilihat' : s === 'sedang' ? 'Sedang diaudit' : 'Selesai'}</span>)}
          </div>
          <div className="hint">Status disimpan di peramban ini (demo). Di pilot, status masuk ke sistem manajemen kasus audit cabang.</div>
          <h3 style={{ marginTop: 16 }}>Sampel klaim untuk auditor</h3>
          {sampel.length === 0 ? <div className="hint">Tidak ada sampel: faskes tidak berada di Kota Semarang, tidak ada kejadian, atau modul FKTP.</div> : <>
            <div style={{ overflowX: 'auto' }}>
              <table className="t mono" style={{ fontSize: 11 }}>
                <thead><tr>{Object.keys(sampel[0]).map(k => <th key={k}>{k === 'p' ? 'peluang' : k === 'gap' ? 'jeda (hari)' : k === 'jeda' ? 'jeda (hari)' : k === 'FKL47' ? 'tarif' : k === 'FKL19' ? 'INA-CBG' : k === 'FKL17A' ? 'dx utama' : k === 'los' ? 'LOS' : k}</th>)}</tr></thead>
                <tbody>{sampel.slice(0, 12).map((r, i) => <tr key={i}>{Object.entries(r).map(([k, v]) => <td key={k}>{k === 'FKL47' ? rp(Number(v)) : String(v)}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="hint">Hanya kolom teknis; tanpa nomor kartu, SEP, nama peserta, atau nama dokter. {sampel.length} baris tersedia untuk diekspor.</div>
          </>}
        </div>
      </div>
    </>
  )
}
