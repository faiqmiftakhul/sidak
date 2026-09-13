/** Tanda merek SIDAK: kros layanan kesehatan + kaca pembesar dengan pencilan merah.
 *  Sumber: assets/sidak-logo.png → public/favicon-96x96.png (lihat scripts/generate-icons.mjs).
 *  Dekoratif: selalu didampingi teks atau aria-label pada elemen induk. */
export default function SidakMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/favicon-96x96.png?v=3"
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      className={className ? 'brand-mark ' + className : 'brand-mark'}
      draggable={false}
    />
  )
}
