import type { ReactNode } from 'react'
import { mdiChevronDown, mdiClose } from '@mdi/js'
import { Icon } from './Icon'

/** Dropdown multi-pilih ber-count; trigger menyebut pilihannya ("Status: Perlu perhatian + Diamati"). */
export function FilterCheck({ label, options, selected, onToggle, all, onAll }: {
  label: string
  options: { id: string; label: string; dot?: string; cnt?: number }[]
  selected: string[]
  onToggle: (id: string) => void
  all?: boolean
  onAll?: (v: boolean) => void
}) {
  const isAll = all === true || (all === undefined && options.length > 0 && options.every(o => selected.includes(o.id)))
  const dipilih = options.filter(o => selected.includes(o.id))
  const ringkas = isAll ? 'Semua' : dipilih.length === 0 ? 'Tidak ada' : dipilih.length <= 2 ? dipilih.map(o => o.label).join(' + ') : `${dipilih.length} dipilih`
  return (
    <details className="fsel">
      <summary title={label}>
        <span>{label}: <b>{ringkas}</b></span>
        <Icon path={mdiChevronDown} size={16} />
      </summary>
      <div className="fsel-men" role="menuitemcheckbox">
        <label className="fsel-all"><input type="checkbox" checked={isAll} onChange={e => onAll?.(e.target.checked)} />Semua {label.toLowerCase()}</label>
        <div className="fsel-lis">
          {options.map(o => (
            <label key={o.id} className="fsel-row">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
              {o.dot && <span className="fsel-dot" style={{ background: o.dot }} />}
              <span className="fsel-teks">{o.label}</span>
              {o.cnt != null && <span className="fsel-cnt">{o.cnt}</span>}
            </label>
          ))}
        </div>
      </div>
    </details>
  )
}

/** Baris chip filter aktif + Hapus semua + hasil filter (aria-live). */
export function FilterChips({ chips, onHapus, onHapusSemua, hasil }: {
  chips: { key: string; label: string }[]
  onHapus: (key: string) => void
  onHapusSemua: () => void
  hasil?: ReactNode
}) {
  if (chips.length === 0 && hasil == null) return null
  return (
    <div className="fchips">
      {chips.length > 0 && <span className="fchips-lbl">Filter aktif:</span>}
      {chips.map(c => (
        <span key={c.key} className="fchip"><span>{c.label}</span><button type="button" aria-label={`Hapus ${c.label}`} onClick={() => onHapus(c.key)}><Icon path={mdiClose} size={14} /></button></span>
      ))}
      {chips.length > 0 && <button type="button" className="fchip-hapus" onClick={onHapusSemua}>Atur ulang</button>}
      {hasil != null && <span className="fhasil" aria-live="polite">{hasil}</span>}
    </div>
  )
}