import { useState } from 'react'
import { Link } from 'react-router-dom'
import { mdiClose, mdiShieldCheckOutline } from '@mdi/js'
import { Icon } from './Icon'

const KEY = 'sidak_strip'

export default function ContextStrip() {
  const [ada, setAda] = useState(() => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } })
  if (!ada) return null
  return (
    <div className="strip" role="note">
      <Icon path={mdiShieldCheckOutline} size={16} />
      <span>Data sampel anonim ±1% · kode faskes disamarkan · hasil = indikasi untuk prioritas audit, <b>bukan vonis</b>. <Link to="/metodologi">Pelajari metode</Link></span>
      <button type="button" className="strip-x" onClick={() => { try { localStorage.setItem(KEY, '0') } catch { /* abaikan */ } setAda(false) }} aria-label="Tutup penjelasan data"><Icon path={mdiClose} size={15} /></button>
    </div>
  )
}