/** Tanda merek SIDAK (desain ikon penuh): 9 titik tersusun 3×3 + garis "bar audit" di tengah, dengan satu titik outlier amber di kanan-atas. Warna titik mengikuti currentColor; outlier selalu amber sesuai palet. */
export default function SidakMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <circle cx="7" cy="8" r="3.1" />
        <circle cx="16" cy="8" r="3.1" />
        <circle cx="7" cy="17.6" r="3.1" />
        <circle cx="16" cy="17.6" r="3.1" />
        <circle cx="25" cy="17.6" r="3.1" />
        <circle cx="7" cy="27.3" r="3.1" />
        <circle cx="16" cy="27.3" r="3.1" />
        <circle cx="25" cy="27.3" r="3.1" />
      </g>
      <circle cx="25" cy="4.7" r="3.1" fill="#D97706" />
      <g stroke="currentColor" strokeOpacity=".75" strokeWidth="1.5" strokeLinecap="round">
        <line x1="1" y1="12.7" x2="3.7" y2="12.7" />
        <line x1="10.3" y1="12.7" x2="12.7" y2="12.7" />
        <line x1="19.3" y1="12.7" x2="21.7" y2="12.7" />
        <line x1="28.3" y1="12.7" x2="31" y2="12.7" />
      </g>
    </svg>
  )
}