import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Beranda from './pages/Beranda'
import Peta from './pages/Peta'
import Antrean from './pages/Antrean'
import Profil from './pages/Profil'
import ModulPage from './pages/Modul'
import Metodologi from './pages/Metodologi'
import Chat from './components/Chat'
import Ikon from './components/Ikon'
import { INFO, MODUL, Modul, useData } from './lib/data'
import { useTema } from './lib/tema'

/** Nama halaman untuk bilah atas; dipakai juga sebagai judul dokumen. */
function judulHalaman(path: string, faskes: { id: string; label: string }[]): string {
  if (path === '/') return 'Beranda'
  if (path === '/peta') return 'Peta'
  if (path === '/antrean') return 'Antrean audit'
  if (path === '/metodologi') return 'Metodologi & data'
  if (path.startsWith('/modul/')) {
    const m = path.slice(7) as Modul
    return INFO[m] ? `Modul #${INFO[m].nomor} · ${INFO[m].nama}` : 'Modul'
  }
  if (path.startsWith('/faskes/')) {
    const f = faskes.find(x => x.id === path.slice(8))
    return f ? f.label : 'Profil faskes'
  }
  return 'SIDAK'
}

export default function App() {
  const { ring, faskes } = useData()
  const { tema, setTema } = useTema()
  const loc = useLocation()
  const [chat, setChat] = useState(() => window.innerWidth > 1180)
  const [sisiBuka, setSisiBuka] = useState(false)
  const judul = judulHalaman(loc.pathname, faskes)

  // pindah halaman: tutup laci, kembali ke puncak, perbarui judul tab
  useEffect(() => {
    setSisiBuka(false)
    document.querySelector('.main')?.scrollTo({ top: 0 })
    document.title = `${judul} · SIDAK`
  }, [loc.pathname, judul])

  // Esc menutup lapisan mengambang
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (sisiBuka) setSisiBuka(false)
      else if (chat && window.innerWidth <= 1180) setChat(false)
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [sisiBuka, chat])

  const gelap = tema === 'gelap'

  return (
    <div className={'app' + (chat ? ' chat-open' : '') + (sisiBuka ? ' sisi-buka' : '')}>
      <nav className="side" aria-label="Navigasi utama">
        <button className="ikon-btn tutup-sisi" onClick={() => setSisiBuka(false)} aria-label="Tutup menu">
          <Ikon nama="silang" />
        </button>
        <div className="brand">
          <span className="lambang" aria-hidden="true"><Ikon nama="perisai" ukuran={18} /></span>
          <span className="nama">SIDAK</span>
        </div>
        <div className="tag">Sistem Deteksi Dini Pola Klaim Tidak Wajar di Fasilitas Kesehatan</div>

        <NavLink to="/" end><Ikon nama="beranda" /> Beranda</NavLink>
        <NavLink to="/peta"><Ikon nama="peta" /> Peta</NavLink>
        <NavLink to="/antrean"><Ikon nama="antrean" /> Antrean audit</NavLink>

        <div className="grp">Modul deteksi</div>
        {MODUL.map(m => (
          <NavLink key={m} to={'/modul/' + m}>
            <span className="nomor">#{INFO[m].nomor}</span> {INFO[m].nama}
          </NavLink>
        ))}

        <div className="grp">Lainnya</div>
        <NavLink to="/metodologi"><Ikon nama="buku" /> Metodologi &amp; data</NavLink>

        <div className="foot">
          Data Sampel BPJS Kesehatan Edisi 2025 (anonim, ±1% peserta). Faskes memakai kode samaran.
          SIDAK memberi indikasi statistik, bukan vonis.
        </div>
      </nav>

      <div className="kolom-isi">
        <header className="topbar">
          <button className="ikon-btn buka-menu" onClick={() => setSisiBuka(true)} aria-label="Buka menu" aria-expanded={sisiBuka}>
            <Ikon nama="menu" />
          </button>
          <div className="jejak">
            <span>Kota Semarang</span>
            <Ikon nama="kanan" ukuran={14} />
            <b>{judul}</b>
          </div>
          <div className="kanan">
            <span className="lencana-periode">{ring.periode}</span>
            <button
              className="ikon-btn" onClick={() => setTema(gelap ? 'terang' : 'gelap')}
              aria-label={gelap ? 'Beralih ke tema terang' : 'Beralih ke tema gelap'} title={gelap ? 'Tema terang' : 'Tema gelap'}
            >
              <Ikon nama={gelap ? 'matahari' : 'bulan'} />
            </button>
            <button
              className={'btn' + (chat ? ' primary' : '')} onClick={() => setChat(c => !c)} aria-pressed={chat}
            >
              <Ikon nama="obrolan" ukuran={16} /> Tanya SIDAK
            </button>
          </div>
        </header>

        <main className="main">
          <div className="isi">
            <Routes>
              <Route path="/" element={<Beranda />} />
              <Route path="/peta" element={<Peta />} />
              <Route path="/antrean" element={<Antrean />} />
              <Route path="/faskes/:id" element={<Profil />} />
              <Route path="/modul/:m" element={<ModulPage />} />
              <Route path="/metodologi" element={<Metodologi />} />
            </Routes>
          </div>
        </main>
      </div>

      {chat && <aside className="chat-col" aria-label="Asisten Tanya SIDAK"><Chat halaman={loc.pathname} onTutup={() => setChat(false)} /></aside>}

      {(sisiBuka || chat) && (
        <button
          className="tirai" aria-label="Tutup panel"
          onClick={() => { if (sisiBuka) setSisiBuka(false); else setChat(false) }}
        />
      )}
    </div>
  )
}
