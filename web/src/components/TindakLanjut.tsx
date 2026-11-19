import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AKSI_TL, LABEL_TL, OPSI_KESIMPULAN, StatusAudit } from '../lib/data'

const fmtWaktu = (t: number) => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Label status tindak lanjut. Dengan `onAksi`: tombol yang membuka menu aksi; tanpa: label baca-saja. */
export function LabelTL({ status, kesimpulan, onAksi, nama }: { status: StatusAudit; kesimpulan?: string; onAksi?: (ke: StatusAudit) => void; nama?: string }) {
  const [buka, setBuka] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!buka || !btn.current) return
    // Menu "fixed": tabel ada di wadah ber-scroll, jadi posisi "absolute" akan terpotong di baris bawah.
    const r = btn.current.getBoundingClientRect()
    const tinggi = menu.current?.offsetHeight ?? 120
    const top = r.bottom + 6 + tinggi > window.innerHeight ? r.top - 6 - tinggi : r.bottom + 6
    setPos({ top, right: window.innerWidth - r.right })
  }, [buka])
  // Fokus setelah menu berada di posisinya; preventScroll agar fokus tidak memicu scroll yang menutup menu.
  useEffect(() => { if (buka && pos) menu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }) }, [buka, pos])
  useEffect(() => {
    if (!buka) return
    const tutup = (e: Event) => {
      const di = menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)
      if (e.type === 'resize' || !di) { setBuka(false); setPos(null) }
    }
    document.addEventListener('mousedown', tutup); window.addEventListener('scroll', tutup, true); window.addEventListener('resize', tutup)
    return () => { document.removeEventListener('mousedown', tutup); window.removeEventListener('scroll', tutup, true); window.removeEventListener('resize', tutup) }
  }, [buka])

  const isi = <><span className="tl-titik" aria-hidden="true" />{LABEL_TL[status]}</>
  if (!onAksi) return <span className={'tl-label ' + status} title={kesimpulan || undefined}>{isi}</span>
  const tombolMenu = (e: React.KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    if (e.key === 'Escape' || e.key === 'Tab') { setBuka(false); setPos(null); if (e.key === 'Escape') btn.current?.focus() }
  }
  return (
    // Hentikan klik dan tombol keyboard agar tidak sampai ke baris tabel (Enter di baris = buka profil).
    <span className="tl-wrap" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <button ref={btn} type="button" className={'tl-label tl-btn ' + status} aria-haspopup="menu" aria-expanded={buka}
        aria-label={`Tindak lanjut${nama ? ' ' + nama : ''}: ${LABEL_TL[status]}. Ubah`} onClick={() => { setBuka(b => !b); setPos(null) }}>
        {isi}<svg className="tl-caret" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z" /></svg>
      </button>
      {status === 'selesai' && kesimpulan && <span className="tl-kes" title={kesimpulan}>{kesimpulan}</span>}
      {buka && (
        <div ref={menu} className="tl-menu" role="menu" aria-label="Aksi tindak lanjut" onKeyDown={tombolMenu}
          style={{ position: 'fixed', top: pos?.top ?? 0, right: pos?.right ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          {AKSI_TL[status].map(a => (
            <button key={a.label} type="button" role="menuitem" onClick={() => { setBuka(false); setPos(null); onAksi(a.ke) }}>
              <span className={'tl-titik ' + a.ke} aria-hidden="true" />
              <span>{a.label}{a.ket && <span className="tl-ket">{a.ket}</span>}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

/** Dialog "Tandai selesai" / "Ubah kesimpulan": kesimpulan wajib, catatan opsional. */
export function DialogSelesai({ subjudul, ubah, kesimpulanAwal, catatanAwal, onSimpan, onBatal }: {
  subjudul: string; ubah?: boolean; kesimpulanAwal?: string; catatanAwal?: string
  onSimpan: (kesimpulan: string, catatan: string) => void; onBatal: () => void
}) {
  const [kes, setKes] = useState(kesimpulanAwal ?? '')
  const [cat, setCat] = useState(catatanAwal ?? '')
  const kotak = useRef<HTMLDivElement>(null)
  const asal = useRef<Element | null>(document.activeElement)
  useEffect(() => {
    kotak.current?.querySelector<HTMLInputElement>('input:checked, input')?.focus()
    const kembali = asal.current
    return () => { (kembali as HTMLElement | null)?.focus?.() }
  }, [])
  const tombol = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onBatal() }
    if (e.key !== 'Tab' || !kotak.current) return
    const f = [...kotak.current.querySelectorAll<HTMLElement>('input, textarea, button:not([disabled])')]
    if (!f.length) return
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
  }
  return (
    <div className="tl-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onBatal() }}>
      <div ref={kotak} className="tl-dialog" role="dialog" aria-modal="true" aria-labelledby="tl-dlg-judul" onKeyDown={tombol}>
        <h2 id="tl-dlg-judul">{ubah ? 'Ubah kesimpulan' : 'Tandai selesai'}</h2>
        <p className="tl-dlg-sub">{subjudul}</p>
        <fieldset className="tl-opsi">
          <legend>Kesimpulan pemeriksaan</legend>
          {OPSI_KESIMPULAN.map(o => (
            <label key={o}><input type="radio" name="tl-kes" value={o} checked={kes === o} onChange={() => setKes(o)} />{o}</label>
          ))}
        </fieldset>
        <label className="tl-cat-lbl" htmlFor="tl-cat">Catatan (opsional)</label>
        <textarea id="tl-cat" value={cat} onChange={e => setCat(e.target.value)} placeholder="Temuan di klaim sampel, klarifikasi kode, rencana tindak lanjut…" />
        <p className="tl-wajib">Kesimpulan wajib dipilih untuk menandai selesai. Pilihan netral, bukan label pelanggaran.</p>
        <div className="tl-dlg-aksi">
          <button type="button" className="btn" onClick={onBatal}>Batal</button>
          <button type="button" className="btn primary" disabled={!kes} onClick={() => onSimpan(kes, cat)}>{ubah ? 'Simpan kesimpulan' : 'Simpan sebagai selesai'}</button>
        </div>
      </div>
    </div>
  )
}

const URUT_TL: StatusAudit[] = ['belum', 'sedang', 'selesai']

/** Kartu Profil: tahap baca-saja + satu tombol utama untuk langkah berikutnya. */
export function KartuTL({ status, kesimpulan, waktu, onAksi }: { status: StatusAudit; kesimpulan: string; waktu: number | null; onAksi: (ke: StatusAudit) => void }) {
  const i = URUT_TL.indexOf(status)
  const meta = waktu ? (status === 'sedang' ? `sejak ${fmtWaktu(waktu)}` : status === 'selesai' ? `selesai ${fmtWaktu(waktu)}` : '') : ''
  return (
    <div className="tl-kartu" aria-live="polite">
      <ol className="tl-tahap" aria-label="Tahap tindak lanjut">
        {URUT_TL.map((v, j) => (
          <li key={v} className={j < i || status === 'selesai' ? 'lewat' : undefined} aria-current={j === i ? 'step' : undefined}>
            <span className="tl-bul" aria-hidden="true" />{LABEL_TL[v]}
          </li>
        ))}
      </ol>
      <div className="tl-st"><LabelTL status={status} />{meta && <span className="tl-meta">{meta}</span>}</div>
      {status === 'belum' && <>
        <p className="tl-desk">Faskes ini belum diperiksa. Mulai saat Anda membuka klaim sampelnya.</p>
        <div className="tl-aksi"><button type="button" className="btn primary" onClick={() => onAksi('sedang')}>Mulai pemeriksaan</button></div>
      </>}
      {status === 'sedang' && <>
        <p className="tl-desk">Periksa klaim sampel, lalu tandai selesai dengan kesimpulan.</p>
        <div className="tl-aksi">
          <button type="button" className="btn primary" onClick={() => onAksi('selesai')}>Tandai selesai…</button>
          <button type="button" className="tl-tautan" onClick={() => onAksi('belum')}>Batalkan pemeriksaan</button>
        </div>
      </>}
      {status === 'selesai' && <>
        <div className="tl-kes-kotak"><b>Kesimpulan</b>{kesimpulan || 'Belum diisi'}</div>
        <div className="tl-aksi">
          <button type="button" className="btn" onClick={() => onAksi('selesai')}>{kesimpulan ? 'Ubah kesimpulan…' : 'Isi kesimpulan…'}</button>
          <button type="button" className="tl-tautan" onClick={() => onAksi('sedang')}>Buka kembali</button>
        </div>
      </>}
    </div>
  )
}
