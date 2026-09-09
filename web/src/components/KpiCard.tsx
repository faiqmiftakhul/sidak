import { Link } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { mdiArrowDown, mdiArrowUp, mdiMinus } from '@mdi/js'
import { Icon } from './Icon'
import { STATUS, type Status } from '../lib/data'
import { OE_STATUS, POLARITY, POLARITY_COLOR, ROLE_ICON, ROLE_TOK, type OES, type Role } from '../lib/roles'

export interface KpiDelta { value: string; parezek: number }

function Spark({ v, warna }: { v: number[]; warna: string }) {
  const lo = Math.min(...v, 0)
  const hi = Math.max(...v, 1)
  const rng = hi - lo || 1
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 47 + 0.5},${23 - ((x - lo) / rng) * 21 - 1}`).join(' ')
  return (
    <svg className="kpi-spark" width="48" height="24" viewBox="0 0 48 24" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={warna} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const PIL_STATUS: Record<OES, Status> = { wajar: 'wajar', diamati: 'diamati', perhatian: 'perhatian' }

export default function KpiCard({ role, icon, label, value, delta, sparkline, href, statusPill, hint, variant, style }: {
  role: Role
  icon?: string
  label: string
  value: ReactNode
  delta?: KpiDelta
  sparkline?: number[]
  href?: string
  statusPill?: boolean
  hint?: ReactNode
  variant?: 'lg' | 'sm'
  style?: CSSProperties
}) {
  const sm = variant === 'sm'
  const oev = sparkline && sparkline.length ? sparkline[sparkline.length - 1] : null
  const tok = ROLE_TOK(role, oev)
  const oes = role === 'ratio' ? OE_STATUS(oev) : null
  const pil = statusPill && oes ? STATUS[PIL_STATUS[oes]] : null
  const ikon = icon ?? ROLE_ICON[role]
  const isi = (
    <div className={'kpi-card' + (sm ? ' sm' : '')} style={style}>
      <div className="kpi-top">
        <span className="kpi-chip" style={{ background: tok.t2 }}><Icon path={ikon} size={sm ? 14 : 16} style={{ color: tok.text }} /></span>
        <span className="kpi-label">{label}</span>
        {pil && <span className="kpi-pill" style={{ color: tok.text, background: tok.t2 }}>{pil.label}</span>}
      </div>
      <div className="kpi-value" style={{ color: tok.text }}>{value}</div>
      {delta && <div className="kpi-delta" style={{ color: POLARITY_COLOR[POLARITY[role]] }}><Icon path={delta.parezek === 0 ? mdiMinus : delta.parezek > 0 ? mdiArrowUp : mdiArrowDown} size={12} />{delta.value}</div>}
      {sparkline && !sm && <Spark v={sparkline} warna={tok.text} />}
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  )
  if (href) return <Link to={href} className="kpi-card-link" style={{ '--kpi-hover': tok.text } as CSSProperties}>{isi}</Link>
  return isi
}