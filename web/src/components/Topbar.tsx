import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { mdiChevronRight, mdiMagnify } from '@mdi/js'
import { Icon } from './Icon'
import SidakMark from './SidakMark'
import { MethodPopover } from './sig'
import { INFO, MODUL, Modul, useData } from '../lib/data'

const KOTA = 'Kota Semarang'

function PotongBreadcrumb(path: string): { label: string; to?: string }[] {
  const c: { label: string; to?: string }[] = [{ label: 'Jawa Tengah', to: '/peta' }, { label: KOTA, to: '/' }]
  if (path.startsWith('/peta')) c.push({ label: 'Peta' })
  else if (path.startsWith('/antrean')) c.push({ label: 'Antrean audit' })
  else if (path.startsWith('/modul/')) { const m = path.split('/')[2] as Modul; c.push({ label: `Modul #${INFO[m]?.nomor ?? ''}` }) }
  else if (path.startsWith('/faskes/')) c.push({ label: 'Profil faskes' })
  else if (path.startsWith('/metodologi')) c.push({ label: 'Metodologi' })
  else c.push({ label: 'Ringkasan' })
  return c
}

export default function Topbar({ aiAktif, aiBadge, onTanyaAI }: { aiAktif: boolean; aiBadge: boolean; onTanyaAI: () => void }) {
  const data = useData()
  const nav = useNavigate()
  const loc = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(false)

  const nbuka = () => { setBuka(true) }
  const ntutup = () => { setBuka(false); setQ('') }

  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setBuka(true) } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [])
  useEffect(() => { ntutup() }, [loc.pathname])

  const ql = q.trim().toLowerCase()
  const mods = ql ? MODUL.filter(m => `#${INFO[m].nomor} ${INFO[m].nama}`.toLowerCase().includes(ql)) : []
  const faks = ql ? data.faskes.filter(f => f.id.toLowerCase().includes(ql) || f.label.toLowerCase().includes(ql)).slice(0, 24) : []

  const bukaPertama = () => {
    const id = mods[0] ? '/modul/' + mods[0] : faks[0] ? '/faskes/' + faks[0].id : null
    if (id) { nav(id); ntutup() }
  }

  const crumbs = PotongBreadcrumb(loc.pathname)

  return (
    <div className="topbar">
      <nav className="crumb" aria-label="Breadcrumb">
        {crumbs.map((c, i) => {
          const terakhir = i === crumbs.length - 1
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {i > 0 && <span className="sep" aria-hidden="true"><Icon path={mdiChevronRight} size={12} /></span>}
              {c.to && !terakhir ? <Link to={c.to}>{c.label}</Link> : <span className={terakhir ? 'here' : ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>}
            </span>
          )
        })}
      </nav>

      <div className="top-search" data-tip="Cari (Ctrl K)" title="Cari (Ctrl K)">
        <Icon path={mdiMagnify} size={16} />
        <input ref={inputRef} type="text" value={q} onChange={e => setQ(e.target.value)} onFocus={nbuka} onKeyDown={e => { if (e.key === 'Escape') { ntutup(); inputRef.current?.blur() }; if (e.key === 'Enter') bukaPertama() }} placeholder="Cari faskes, modul…" aria-label="Cari faskes atau modul" aria-expanded={buka} autoComplete="off" />
        <kbd>Ctrl&nbsp;K</kbd>
      </div>

      <span style={{ flex: 1 }} />
      <MethodPopover />
      <button type="button" className={'ai-pil' + (aiAktif ? ' aktif' : '') + (aiBadge ? ' baru' : '')} onClick={onTanyaAI} aria-expanded={aiAktif} aria-haspopup="dialog" aria-controls="sidak-chat" aria-label="Tanya AI SIDAK" title={aiAktif ? 'Tutup Tanya AI SIDAK' : 'Buka Tanya AI SIDAK'}>
        <SidakMark size={20} />
        <span className="ai-pil-txt">Tanya AI SIDAK</span>
        {aiBadge && <span className="ai-pil-titik" aria-hidden="true" />}
      </button>
      <div className="avatar" title="Auditor · internal BPJS Kesehatan">A</div>

      {buka && <>
        <div className="search-back" onClick={ntutup} aria-hidden="true" />
        <div className="search-panel" role="dialog" aria-label="Hasil pencarian">
          {mods.length > 0 && <>
            <div className="g">Modul</div>
            {mods.map(m => <Link key={m} to={'/modul/' + m} onClick={ntutup}><span className="code">#{INFO[m].nomor}</span><span style={{ fontSize: 13 }}>{INFO[m].nama}</span><span className="sub">{data.ring.per_modul[m].n_perhatian} perlu perhatian</span></Link>)}
          </>}
          {faks.length > 0 && <>
            <div className="g">Faskes ({faks.length})</div>
            {faks.map(f => <Link key={f.id} to={'/faskes/' + f.id} onClick={ntutup}><span className="code">{f.id}</span><span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span><span className="sub">{f.kelas_pendek}</span></Link>)}
          </>}
          {mods.length === 0 && faks.length === 0 && ql !== '' && <div className="kosong">Tidak ada kecocokan untuk “{q}”. Coba kode faskes atau nama modul.</div>}
          {ql === '' && <div className="kosong">Ketik kode faskes (mis. RS-0417) atau nama modul.</div>}
        </div>
      </>}
    </div>
  )
}