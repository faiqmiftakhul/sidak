import { useEffect, useRef, useState } from 'react'
import { mdiInformationOutline } from '@mdi/js'
import { Icon } from './Icon'

const BUTIR = [
  'Jawaban dihasilkan AI dari data klaim anonim ±1%',
  'Setiap angka punya sumber yang bisa diklik',
  'Hasil berupa indikasi prioritas audit — keputusan akhir oleh auditor manusia',
]

/** Popover "Tentang AI ini": tiga poin transparansi. Dipakai di koridor asisten dan kartu Bacaan. */
export function TentangAI({ kecil = false }: { kecil?: boolean }) {
  const [buka, setBuka] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setBuka(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [])
  return (
    <div className={kecil ? 'ta-po kecil' : 'ta-po'} ref={ref}>
      <button type="button" className="his-btn" onClick={() => setBuka(b => !b)} aria-expanded={buka} aria-label="Tentang AI ini" title="Tentang AI ini">
        <Icon path={mdiInformationOutline} size={kecil ? 15 : 16} />
      </button>
      {buka && (
        <div className="method-po tentang-po" role="dialog" aria-label="Tentang AI ini">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Tentang AI ini</div>
          <ul className="tentang-isi">
            {BUTIR.map(b => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}