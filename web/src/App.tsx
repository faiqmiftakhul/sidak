import { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Beranda from './pages/Beranda'
import Peta from './pages/Peta'
import Antrean from './pages/Antrean'
import Profil from './pages/Profil'
import ModulPage from './pages/Modul'
import Metodologi from './pages/Metodologi'
import Chat from './components/Chat'
import Topbar from './components/Topbar'
import ContextStrip from './components/ContextStrip'
import CoachMark from './components/CoachMark'
import { TooltipLayer } from './components/Tooltip'
import { AiCtx, AiDorongan } from './components/ai'
import { Icon } from './components/Icon'
import { BRAND_JUDUL, FOOT_PERIODE, FOOT_SAMPEL, MODUL_NAV, NAV, TOGGLE } from './lib/labels'
import { INFO, MODUL, Modul, useData } from './lib/data'

const KUNCI_KOLAPS = 'sidak.sidebar.collapsed'

export default function App() {
  const { ring, faskes } = useData()
  const loc = useLocation()
  const [chat, setChat] = useState(false)
  const [besar, setBesar] = useState(false)
  const [kolaps, setKolaps] = useState(() => { try { return localStorage.getItem(KUNCI_KOLAPS) === '1' } catch { return false } })
  const [digestBaru, setDigestBaru] = useState(false)
  const [dorongan, setDorongan] = useState<AiDorongan | null>(null)

  const demo = useMemo(() => new URLSearchParams(window.location.search).has('demo'), [])
  const [coach, setCoach] = useState(false)

  useEffect(() => {
    if (chat) return
    let t: ReturnType<typeof setTimeout>
    try {
      if (localStorage.getItem('sidak.coachmark.v1') === '1' && !demo) return
    } catch { /* abaikan */ }
    t = setTimeout(() => setCoach(true), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat])

  const openChat = () => { setChat(true); setDigestBaru(false) }
  const toggleChat = () => { setChat(c => { if (!c) setDigestBaru(false); return !c }) }
  const tutupCoach = () => { setCoach(false); try { localStorage.setItem('sidak.coachmark.v1', '1') } catch { /* abaikan */ } }

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null
      const ketik = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      const ctrl = ev.ctrlKey || ev.metaKey
      if (ctrl && ev.key.toLowerCase() === 'j' && !ketik) { ev.preventDefault(); toggleChat() }
      if (ctrl && ev.key.toLowerCase() === 'b' && !ketik) {
        ev.preventDefault()
        setKolaps(c => { const n = !c; try { localStorage.setItem(KUNCI_KOLAPS, n ? '1' : '0') } catch { /* abaikan */ } return n })
      }
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const h = () => { if (!chat) setDigestBaru(true) }
    window.addEventListener('sidak:digest', h)
    return () => window.removeEventListener('sidak:digest', h)
  }, [chat])

  useEffect(() => {
    let t = `SIDAK — ${NAV.home.label}`
    const p = loc.pathname
    if (p.startsWith('/peta')) t = `SIDAK — ${NAV.peta.label}`
    else if (p.startsWith('/antrean')) t = `SIDAK — ${NAV.antrean.label}`
    else if (p.startsWith('/modul/')) { const m = p.split('/')[2] as Modul; if (INFO[m]) t = `SIDAK — #${INFO[m].nomor} ${INFO[m].nama}` }
    else if (p.startsWith('/faskes/')) { const f = faskes.find(x => x.id === p.split('/')[2]); t = 'SIDAK — ' + (f ? f.label : 'Profil faskes') }
    else if (p.startsWith('/metodologi')) t = 'SIDAK — Metodologi'
    document.title = t
  }, [loc.pathname, faskes])

  return (
    <AiCtx.Provider value={{ buka: (d) => { setDorongan(d ?? null); openChat() } }}>
      <div className={'app' + (chat ? ' chat-open' : '') + (kolaps ? ' collapsed' : '') + (besar ? ' chat-besar' : '')}>
        <nav className="side" aria-label="Navigasi utama">
          <div className="brand" data-tip={BRAND_JUDUL}><img className="brand-mark" src="/favicon-48x48.png?v=2" alt="Logo SIDAK" width="24" height="24" /><span className="brand-text">SIDAK</span></div>
          <div className="tag">Sistem Indikasi Audit Klaim<br />fokus Kota Semarang · data sampel 2024–2025</div>

          <NavLink to="/" end data-tip={NAV.home.label} data-tip-desc={NAV.home.desc} aria-describedby="sidak-tip">
            <Icon path={NAV.home.icon} size={18} /><span className="nav-label">{NAV.home.label}</span>
          </NavLink>
          <NavLink to="/peta" data-tip={NAV.peta.label} data-tip-desc={NAV.peta.desc} aria-describedby="sidak-tip">
            <Icon path={NAV.peta.icon} size={18} /><span className="nav-label">{NAV.peta.label}</span>
          </NavLink>
          <NavLink to="/antrean" data-tip={NAV.antrean.label} data-tip-desc={NAV.antrean.desc} data-tip-extra={`${ring.n_perhatian} temuan menunggu verifikasi`} aria-describedby="sidak-tip">
            <Icon path={NAV.antrean.icon} size={18} /><span className="nav-label">{NAV.antrean.label}</span>
            {ring.n_perhatian > 0 && <span className="count per">{ring.n_perhatian}</span>}
          </NavLink>

          <div className="grp">Modul pemantauan</div>
          <div className="legend">angka = faskes Perlu perhatian</div>
          <div className="mod-sep" aria-hidden="true" />
          {MODUL.map(m => {
            const p = ring.per_modul[m]
            const tl = MODUL_NAV[m]
            return (
              <NavLink key={m} to={'/modul/' + m} data-tip={tl.label} data-tip-desc={tl.desc} data-tip-extra={p.n_perhatian > 0 ? `${p.n_perhatian} faskes berstatus Perlu perhatian` : 'Tidak ada faskes perlu perhatian'} aria-describedby="sidak-tip">
                <Icon path={tl.icon} size={kolaps ? 20 : 18} />
                <span className="nav-label">{tl.label}</span>
                {p.n_perhatian > 0 && <span className="count per">{p.n_perhatian}</span>}
              </NavLink>
            )
          })}

          <div className="side-foot">
            <div className="foot-item" data-tip={FOOT_PERIODE.label} aria-describedby="sidak-tip">
              <Icon path={FOOT_PERIODE.icon} size={14} /><span className="nav-label">{ring.periode}</span>
            </div>
            <div className="foot-item" data-tip={FOOT_SAMPEL.label} aria-describedby="sidak-tip">
              <Icon path={FOOT_SAMPEL.icon} size={14} /><span className="nav-label">Sampel ±1% · anonim</span>
            </div>
          </div>

          <button type="button" className="side-toggle" onClick={() => { const n = !kolaps; setKolaps(n); try { localStorage.setItem(KUNCI_KOLAPS, n ? '1' : '0') } catch { /* abaikan */ } }} aria-expanded={!kolaps} data-tip={kolaps ? TOGGLE.lebarTip : TOGGLE.sempitTip} aria-describedby="sidak-tip" aria-label={kolaps ? TOGGLE.lebarTip : TOGGLE.sempitTip}>
            <Icon path={TOGGLE.icon} size={18} className="tg-ico" /><span className="nav-label">{kolaps ? TOGGLE.lebar : TOGGLE.sempit}</span>
          </button>
        </nav>

        <header className="top">
          <Topbar aiAktif={chat} aiBadge={digestBaru} onTanyaAI={toggleChat} />
          <ContextStrip />
        </header>

        <main className="main">
          <Routes>
            <Route path="/" element={<div className="page"><Beranda /></div>} />
            <Route path="/peta" element={<div className="page" data-fullbleed><Peta /></div>} />
            <Route path="/antrean" element={<div className="page"><Antrean /></div>} />
            <Route path="/faskes/:id" element={<div className="page"><Profil /></div>} />
            <Route path="/modul/:m" element={<div className="page"><ModulPage /></div>} />
            <Route path="/metodologi" element={<div className="page"><Metodologi /></div>} />
          </Routes>
        </main>

        <div className="chat-scrim" onClick={() => setChat(false)} aria-hidden="true" />

        <aside id="sidak-chat" className="chat-col" aria-label="Asisten Tanya AI SIDAK">
          <Chat halaman={loc.pathname} onTutup={() => setChat(false)} buka={chat} besar={besar} setBesar={setBesar} dorongan={dorongan} onDoronganTerpakai={() => setDorongan(null)} />
        </aside>

        {coach && !chat && <CoachMark onCoba={openChat} onTutup={tutupCoach} />}
        <TooltipLayer />
      </div>
    </AiCtx.Provider>
  )
}