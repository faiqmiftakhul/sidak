import { useEffect, useRef } from 'react'
import { Sparkle } from './Sparkle'

/** Coach mark sekali-lihat: memperkenalkan tombol "Tanya AI SIDAK" di topbar. Jangkarnya di bawah-kanan tombol. Fokus terperangkap, Esc menutup. */
export default function CoachMark({ onCoba, onTutup }: { onCoba: () => void; onTutup: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const pil = document.querySelector<HTMLElement>('.ai-pil')
    if (pil && ref.current) {
      const r = pil.getBoundingClientRect()
      const card = ref.current.getBoundingClientRect()
      ref.current.style.top = (r.bottom + 12) + 'px'
      ref.current.style.right = Math.max(0, window.innerWidth - r.right) + 'px'
    }
    const t = window.setTimeout(() => { ref.current?.querySelector<HTMLButtonElement>('button')?.focus() }, 60)
    const k = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        onTutup()
        document.querySelector<HTMLButtonElement>('.ai-pil')?.focus()
        return
      }
      if (ev.key !== 'Tab') return
      const btns = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      if (btns.length === 0) return
      const i = btns.indexOf(ev.target as HTMLButtonElement)
      if (ev.shiftKey) { if (i <= 0) { ev.preventDefault(); btns[btns.length - 1].focus() } }
      else if (i === btns.length - 1) { ev.preventDefault(); btns[0].focus() }
    }
    const luar = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) onTutup() }
    document.addEventListener('keydown', k)
    document.addEventListener('mousedown', luar)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', k)
      document.removeEventListener('mousedown', luar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="coach" ref={ref} role="dialog" aria-labelledby="coach-jdl" aria-live="polite">
      <div className="coach-star"><Sparkle size={16} /></div>
      <b id="coach-jdl">Tanya AI SIDAK</b>
      <p>Asisten AI data klaim — tanya apa saja tentang data klaim dan audit. Contoh: “Faskes mana yang paling perlu diperhatikan?”</p>
      <div className="coach-btn">
        <button type="button" className="btn primary" onClick={onCoba}>Coba sekarang</button>
        <button type="button" className="btn ghost" onClick={onTutup}>Nanti</button>
      </div>
    </div>
  )
}