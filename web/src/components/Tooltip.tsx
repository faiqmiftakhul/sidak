import { useEffect, useState } from 'react'

interface Tip { label: string; desc?: string; extra?: string; kiri: boolean; x: number; y: number }

let timer: number | undefined
let simpan: ((t: Tip | null) => void) | undefined

function tampilkan(el: Element, segera: boolean) {
  const data = el.getAttribute('data-tip')
  if (!data) return
  const r = el.getBoundingClientRect()
  const kiri = r.right + 252 > window.innerWidth
  const info: Tip = {
    label: data,
    desc: el.getAttribute('data-tip-desc') || undefined,
    extra: el.getAttribute('data-tip-extra') || undefined,
    kiri,
    x: kiri ? r.left - 12 : r.right + 12,
    y: r.top + r.height / 2,
  }
  window.clearTimeout(timer)
  const show = () => simpan?.(info)
  if (segera) show()
  else timer = window.setTimeout(show, 300)
}

function sembunyi() {
  window.clearTimeout(timer)
  simpan?.(null)
}

/** Lapisan tooltip tunggal untuk rail sidebar. Daitur lewat atribut `data-tip` pada elemen. */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null)
  useEffect(() => {
    simpan = setTip
    const over = (ev: MouseEvent) => { const el = (ev.target as Element).closest?.('[data-tip]'); el ? tampilkan(el, false) : sembunyi() }
    const uit = (ev: MouseEvent) => { const t = ev.relatedTarget as Element | null; if (!t?.closest?.('[data-tip]')) sembunyi() }
    const masuk = (ev: FocusEvent) => { const el = (ev.target as Element).closest?.('[data-tip]'); el && tampilkan(el, true) }
    const keluar = () => sembunyi()
    document.addEventListener('mouseover', over)
    document.addEventListener('mouseout', uit)
    document.addEventListener('focusin', masuk)
    document.addEventListener('focusout', keluar)
    return () => {
      simpan = undefined
      document.removeEventListener('mouseover', over)
      document.removeEventListener('mouseout', uit)
      document.removeEventListener('focusin', masuk)
      document.removeEventListener('focusout', keluar)
    }
  }, [])
  if (!tip) return null
  return (
    <div
      id="sidak-tip"
      className={'side-tip' + (tip.kiri ? ' kiri' : '')}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      <b>{tip.label}</b>
      {tip.desc && <span>{tip.desc}</span>}
      {tip.extra && <span className="side-tip-extra">{tip.extra}</span>}
    </div>
  )
}