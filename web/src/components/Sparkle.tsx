import type { CSSProperties } from 'react'

/** Bintang empat runcing, warna amber #D97706. Ikon merek AI tanpa emoji. */
export function Sparkle({ size = 16, style, warna = '#D97706' }: { size?: number; style?: CSSProperties; warna?: string }) {
  const m = size / 2
  const t = size * 0.13
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true" focusable="false" style={style}>
      <path
        d={`M${m} ${t} L${m + (m - t) * 0.3} ${m - (m - t) * 0.3} L${size - t} ${m} L${m + (m - t) * 0.3} ${m + (m - t) * 0.3} L${m} ${size - t} L${m - (m - t) * 0.3} ${m + (m - t) * 0.3} L${t} ${m} L${m - (m - t) * 0.3} ${m - (m - t) * 0.3} Z`}
        fill={warna}
      />
    </svg>
  )
}