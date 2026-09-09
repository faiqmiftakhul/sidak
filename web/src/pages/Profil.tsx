import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BungkusTabel, Kepala, Penjelasan, Pill, Tren } from '../components/Common'
import Ikon from '../components/Ikon'
import { INFO, KOTA, MODUL, Modul, StatusAudit, bacaStatusAudit, judulKab, num, oe, pct, rp, simpanStatusAudit, useData } from '../lib/data'
import { usePalet } from '../lib/tema'

const LABEL_AUDIT: Record<StatusAudit, string> = { belum: 'Belum dilihat', sedang: 'Sedang diaudit', selesai: 'Selesai' }

export default function Profil() {
  const { id } = useParams()
  const { faskes } = useData()
  const palet = usePalet()
  const f = faskes.find(x => x.id === id)
  const [audit, setAudit] = useState<StatusAudit>(bacaStatusAudit()[id ?? ''] ?? 'belum')
  const [tab, setTab] = useState<Modul | null>(null)
  if (!f) return <div className="card">Faskes tidak ditemukan. <Link to="/antrean">Kembali ke antrean audit</Link>.</div>
  const moduls = MODUL.filter(m => f.modul[m])
  const m = tab && f.modul[tab] ? tab : (moduls.find(k => f.modul[k]!.status === 'perhatian') ?? moduls.find(k => f.modul[k]!.status === 'diamati') ?? moduls[0])
  const h = f.modul[m]!
  const bln = f.bulanan[m] ?? []
  const sampel = f.sampel[m] ?? []
  const ubah = (s: StatusAudit) => { setAudit(s); simpanStatusAudit(f.id, s) }

  return (
    <>
      <Kepala
        eyebrow={`Antrean audit › ${judulKab(f.kab)}`}
        judul={<>{f.label} <span style={{ fontWeight: 400, fontSize: 15, color: 'var(--teks-3)' }}>· {f.kelas_pendek} · {f.milik}</span></>}
        sub={<>
          {f.tipe === 'FKRTL' ? `${num(f.n_ritl)} rawat inap dan ${num(f.n_rjtl)} kunjungan rawat jalan pada sampel 2024.` : `${num(f.n_kunjungan)} kunjungan sakit pada sampel 2024.`} Kode faskes adalah kode samaran dari Data Sampel; identitas RS tidak tersedia.
          {f.kab !== KOTA && <> Faskes ini berada di {judulKab(f.kab)}; rincian bulanan dan sampel klaim hanya disiapkan untuk Kota Semarang.</>}
        </>}
        aksi={<Link className="btn" to="/antrean"><Ikon nama="antrean" ukuran={16} /> Antrean audit</Link>}
      />

      <div className="grid4">
        {moduls.map(k => { const x = f.modul[k]!; return (
          <button
            key={k} type="button" className={'card klik pita' + (k === m ? ' terpilih' : '')}
            style={{ borderTopColor: palet.modul[k] }} onClick={() => setTab(k)} aria-pressed={k === m}
          >
            <div className="eyebrow">Modul #{INFO[k].nomor}</div>
            <h3 style={{ margin: '4px 0 8px' }}>{INFO[k].nama}</h3>
            <Pill s={x.status} />
            <div className="kv" style={{ marginTop: 10, fontSize: 12 }}>
              <span className="k">O / E</span><span>{num(x.O)} / {num(x.E, 1)}</span>
              <span className="k">O/E · z</span><span><b>{oe(x.OE)}</b> · {x.z == null ? '–' : num(x.z, 2)}</span>
              <span className="k">Angka mentah</span><span>{pct(x.rate)}</span>
              <span className="k">Selisih</span><span>{rp(x.rupiah)}</span>
            </div>
          </button>) })}
        {moduls.length < 4 && <div className="card soft"><div className="eyebrow">Skor gabungan</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--merek)', margin: '8px 0' }}>{rp(f.rupiah)}</div><div className="hint">jumlah selisih rupiah dari modul yang menandai (sampel) · ≈ {rp(f.rupiah_tertimbang)} tertimbang</div></div>}
      </div>

      <h2>#{INFO[m].nomor} {INFO[m].nama}</h2>
      <Penjelasan f={f} m={m} h={h} />

      <div className="grid2" style={{ marginTop: 'var(--s3)' }}>
        <div className="card">
          {bln.length > 0 ? <Tren rows={bln} judul="Per bulan: kejadian nyata vs wajar" /> : <div className="hint">Rincian bulanan tidak tersedia untuk faskes di luar Kota Semarang.</div>}
          {m === 'fragmentasi' && h.OE_sebelum_putih != null && <div className="hint" style={{ marginTop: 10 }}>Sebelum daftar putih klinis: angka {pct(h.rate_sebelum_putih)} dan O/E {oe(h.OE_sebelum_putih)}. Pola klinis wajar (dialisis, kemoterapi, radioterapi, rehabilitasi, transfusi) sebesar <b>{pct(h.pangsa_putih)}</b> kunjungan telah dikeluarkan.</div>}
          {m === 'rujukan' && h.pangsa_nonspes != null && <div className="hint" style={{ marginTop: 10 }}>Pangsa rujukan berdiagnosis non-spesialistik: <b>{pct(h.pangsa_nonspes)}</b>.</div>}
        </div>
        <div className="card">
          <h3>Tindak lanjut</h3>
          <div className="row" style={{ marginBottom: 10 }} role="group" aria-label="Status audit faskes ini">
            {(['belum', 'sedang', 'selesai'] as StatusAudit[]).map(s => (
              <button key={s} type="button" className={'chip' + (audit === s ? ' on' : '')} aria-pressed={audit === s} onClick={() => ubah(s)}>{LABEL_AUDIT[s]}</button>
            ))}
          </div>
          <div className="hint">Status disimpan di peramban ini (demo). Di pilot, status masuk ke sistem manajemen kasus audit cabang.</div>

          <h3 style={{ marginTop: 'var(--s5)' }}>Sampel klaim untuk auditor</h3>
          {sampel.length === 0 ? <div className="hint">Tidak ada sampel: faskes tidak berada di Kota Semarang, tidak ada kejadian, atau modul FKTP.</div> : <>
            <BungkusTabel>
              <table className="t mono" style={{ fontSize: 11 }}>
                <thead><tr>{Object.keys(sampel[0]).map(k => <th key={k}>{k === 'p' ? 'peluang' : k === 'gap' ? 'jeda (hari)' : k === 'jeda' ? 'jeda (hari)' : k === 'FKL47' ? 'tarif' : k === 'FKL19' ? 'INA-CBG' : k === 'FKL17A' ? 'dx utama' : k === 'los' ? 'LOS' : k}</th>)}</tr></thead>
                <tbody>{sampel.slice(0, 12).map((r, i) => <tr key={i}>{Object.entries(r).map(([k, v]) => <td key={k}>{k === 'FKL47' ? rp(Number(v)) : String(v)}</td>)}</tr>)}</tbody>
              </table>
            </BungkusTabel>
            <div className="hint">Hanya kolom teknis; tanpa nomor kartu, SEP, nama peserta, atau nama dokter. {sampel.length} baris tersedia untuk diekspor.</div>
          </>}
        </div>
      </div>
    </>
  )
}
