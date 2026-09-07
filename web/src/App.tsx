import { useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Beranda from './pages/Beranda'
import Peta from './pages/Peta'
import Antrean from './pages/Antrean'
import Profil from './pages/Profil'
import ModulPage from './pages/Modul'
import Metodologi from './pages/Metodologi'
import Chat from './components/Chat'
import { INFO, MODUL } from './lib/data'

export default function App() {
  const [chat, setChat] = useState(true)
  const loc = useLocation()
  return (
    <div className={'app' + (chat ? ' chat-open' : '')}>
      <nav className="side">
        <div className="brand">SIDAK</div>
        <div className="tag">Sistem Deteksi Dini Pola Klaim Tidak Wajar di Fasilitas Kesehatan<br />Demo · Kota Semarang · 2024</div>
        <NavLink to="/" end>🏠 Beranda</NavLink>
        <NavLink to="/peta">🗺️ Peta</NavLink>
        <NavLink to="/antrean">📋 Antrean audit</NavLink>
        <div className="grp">Modul</div>
        {MODUL.map(m => <NavLink key={m} to={'/modul/' + m}>#{INFO[m].nomor} {INFO[m].nama}</NavLink>)}
        <div className="grp">Lainnya</div>
        <NavLink to="/metodologi">📖 Metodologi & data</NavLink>
        <button className="btn-chat" onClick={() => setChat(c => !c)}>{chat ? 'Tutup Tanya SIDAK' : '💬 Tanya SIDAK'}</button>
        <div className="foot">Data Sampel BPJS Kesehatan Edisi 2025 (anonim, ±1% peserta). Faskes ditampilkan dengan kode samaran. SIDAK memberi indikasi statistik, bukan vonis.</div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Beranda />} />
          <Route path="/peta" element={<Peta />} />
          <Route path="/antrean" element={<Antrean />} />
          <Route path="/faskes/:id" element={<Profil />} />
          <Route path="/modul/:m" element={<ModulPage />} />
          <Route path="/metodologi" element={<Metodologi />} />
        </Routes>
      </main>
      {chat && <aside className="chat-col"><Chat halaman={loc.pathname} /></aside>}
    </div>
  )
}
