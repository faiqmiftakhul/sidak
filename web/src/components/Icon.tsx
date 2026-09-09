import type { CSSProperties } from 'react'

/** Ikon SVG flat (Material Design Icons / @mdi/js), ikut warna teks. */
export function Icon({ path, size = 18, style, className }: { path: string; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" style={style} className={className}>
      <path d={path} />
    </svg>
  )
}