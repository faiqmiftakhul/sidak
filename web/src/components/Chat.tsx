import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  mdiArrowDown, mdiArrowLeft, mdiChevronRight, mdiClose, mdiContentCopy, mdiDeleteOutline, mdiFullscreen, mdiFullscreenExit,
  mdiHistory, mdiMagnify, mdiPlus, mdiSend, mdiStop, mdiThumbDown, mdiThumbDownOutline, mdiThumbUp, mdiThumbUpOutline,
} from '@mdi/js'
import { Icon } from './Icon'
import SidakMark from './SidakMark'
import { TentangAI } from './TentangAI'
import { OEChip, RupiahText, Spark, StatusPill } from './sig'
import { AiDorongan } from './ai'
import { Faskes, INFO, KOTA, MODUL, Modul, num, useData } from '../lib/data'

interface Angka { label: string; nilai: string; satuan?: string; sumber?: string }
interface Tautan { label: string; url: string }
interface Jawaban { teks: string; angka?: Angka[]; tautan?: Tautan[]; sumber?: string; cadangan?: boolean }
interface Pesan { id: string; role: 'user' | 'assistant'; content: string; jawaban?: Jawaban; at: number; henti?: boolean }
interface Konvo { id: string; judul: string; at: number; pesan: Pesan[] }

const SARAN: Record<string, string[]> = {
  '/': ['RS mana yang paling perlu diperhatikan di Semarang dan berapa rupiahnya?', 'Berapa estimasi selisih rupiah semua modul di Semarang?', 'Ringkas kondisi Kota Semarang dalam tiga kalimat'],
  '/peta': ['Kabupaten mana di Jawa Tengah dengan O/E readmisi tertinggi?', 'Dari kabupaten mana pasien readmisi di Semarang paling banyak berasal?', 'Kecamatan mana yang paling padat faskes?'],
  '/antrean': ['Urutkan tiga temuan terbesar dan alasannya', 'Berapa faskes yang statusnya perlu perhatian per modul?'],
  '/modul/readmisi': ['Kenapa RS dengan angka readmisi tinggi bisa berstatus wajar?', 'RS mana yang ditandai untuk readmisi dan berapa selisihnya?'],
  '/modul/severity': ['Apakah RS kelas A dengan severity III 22% itu wajar?', 'Berapa selisih tarif severity III dan II?'],
  '/modul/fragmentasi': ['Faskes mana yang diputihkan karena pola dialisis?', 'RS mana yang tersisa sebagai kandidat audit fragmentasi?'],
  '/modul/rujukan': ['Puskesmas atau klinik yang lebih banyak merujuk kasus ringan?', 'FKTP mana dengan pangsa rujukan non-spesialistik tertinggi?'],
  '/metodologi': ['Apa arti O/E dan skor z?', 'Kenapa model readmisi tidak memakai penyeimbangan kelas?'],
  default: ['Faskes mana yang O/E-nya paling tinggi di modul #4?', 'Berapa tren readmisi 30 hari bulan ini?', 'Kenapa sebuah faskes ditandai perlu perhatian?'],
}

const EMPTY_SUG = [
  'Faskes mana yang paling perlu diperhatikan di Semarang?',
  'Kenapa estimasi selisih rupiah bulan ini naik?',
  'Bandingkan modul #4 dan #16: mana yang lebih besar dampaknya?',
  'Ringkas 3 temuan utama untuk rapat audit',
  'Bagaimana tren readmisi 30 hari dalam 6 bulan terakhir?',
  'Apa arti O/E dalam deteksi anomali klaim?',
]

const ALASAN = ['Data tidak sesuai', 'Tidak menjawab pertanyaan', 'Sumber tidak jelas']
const KUNCI_H = 'sidak_chat_sejarah_v1'
const KUNCI_FB = 'sidak_chat_fb_v1'
const KUNCI_W = 'sidak_chat_w'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

let cadangan: { tanya: string; jawab: Jawaban }[] | null = null
async function jawabanCadangan(q: string): Promise<Jawaban | null> {
  if (!cadangan) { try { cadangan = await (await fetch('/data/jawaban_cadangan.json')).json() } catch { cadangan = [] } }
  const tok = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3))
  const q1 = tok(q)
  let best: { s: number; j: Jawaban; n: number } | null = null
  for (const c of cadangan!) {
    const t = tok(c.tanya)
    let s = 0
    q1.forEach(w => { if (t.has(w)) s++ })
    const rasio = s / Math.max(1, Math.max(q1.size, t.size))
    if (!best || rasio > best.s) best = { s: rasio, j: c.jawab, n: s }
  }
  // Samakan ambang dengan backend: minimal 2 kata kunci DAN rasio >= 0.5 —
  // supaya pertanyaan berbeda tidak menerima jawaban cadangan yang sama.
  if (best && best.n >= 2 && best.s >= 0.5) return { ...best.j, cadangan: true }
  return null
}

function baca<T>(k: string, kosong: T): T { try { const j = localStorage.getItem(k); return j ? JSON.parse(j) as T : kosong } catch { return kosong } }
function grupHari(at: number): string {
  const d = new Date(), t = new Date(at)
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const n = Math.round((a - b) / 86400000)
  if (n === 0) return 'Hari ini'
  if (n === 1) return 'Kemarin'
  if (n < 7) return 'Minggu ini'
  return t.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
const waktu = (at: number) => new Date(at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

function kalimatPertama(t: string): { k: string; s: string } {
  const i = t.search(/[.;]\s|\n/)
  if (i <= 0 || i > 150) return { k: t, s: '' }
  return { k: t.slice(0, i + 1), s: t.slice(i + 1).trim() }
}

function cariFaskes(faskes: Faskes[], code: string): Faskes | null {
  const id = code.replace(/[^0-9]/g, '')
  if (id && id.length >= 3) { const f = faskes.find(x => x.id === id); if (f) return f }
  const b = code.replace(/^[A-Za-z]+[-\s]*/, '').toLowerCase()
  return faskes.find(x => x.label.toLowerCase().includes(b)) ?? null
}

function modulTerbesar(f: Faskes): Modul | null {
  let best: Modul | null = null
  for (const m of MODUL) {
    const h = f.modul[m]
    if (h && h.status !== 'volume_rendah' && (!best || (h.rupiah_tertimbang ?? 0) > (f.modul[best]!.rupiah_tertimbang ?? 0))) best = m
  }
  return best
}

function modulDariSumber(s?: string): Modul | null {
  if (!s) return null
  for (const m of MODUL) if (new RegExp('#\\s?' + INFO[m].nomor + '\\b').test(s)) return m
  const t = s.toLowerCase()
  if (t.includes('readmisi')) return 'readmisi'
  if (t.includes('severity') || t.includes('upcoding')) return 'severity'
  if (t.includes('fragmentasi')) return 'fragmentasi'
  if (t.includes('rujukan')) return 'rujukan'
  return null
}

function TeksBerlink({ teks, faskes, nav }: { teks: string; faskes: Faskes[]; nav: (id: string) => void }) {
  const re = /[A-Za-z]{1,4}-?\d{3,7}/g
  const potongan = teks.split(re)
  const kode = teks.match(re) ?? []
  return <>{potongan.map((p, i) => {
    const k = kode[i]
    if (!k) return <span key={i}>{p}</span>
    const f = cariFaskes(faskes, k)
    return <span key={i}>{p}{f ? <a className="kode-faskes" href={'/faskes/' + f.id} onClick={e => { e.preventDefault(); nav(f.id) }}>{k}</a> : <span className="mono">{k}</span>}</span>
  })}</>
}

function Bukti({ j, faskes, nav }: { j: Jawaban; faskes: Faskes[]; nav: (id: string) => void }) {
  const a = j.angka ?? []
  if (a.length === 0) return null
  const baris = a.map(x => ({ x, f: cariFaskes(faskes, x.label) }))
  if (baris.some(r => r.f)) {
    const kecil = baris.filter(r => { const m = r.f && modulTerbesar(r.f); return m && r.f!.modul[m]!.n < 30 })
    return (
      <div className="akpj">
        <table className="t">
          <thead><tr><th>Faskes</th><th>Kelas</th><th>O/E (z)</th><th>≈ Selisih tbg</th><th>Status</th><th>Tren</th></tr></thead>
          <tbody>{baris.map(({ x, f }) => {
            if (!f) return <tr key={x.label}><td className="mono">{x.label}</td><td colSpan={5} className="num">{x.nilai}{x.satuan ? ' ' + x.satuan : ''}</td></tr>
            const m = modulTerbesar(f)
            if (!m) return <tr key={x.label}><td className="mono">{x.label}</td><td>{f.kelas_pendek}</td><td colSpan={4} className="num">{x.nilai}{x.satuan ? ' ' + x.satuan : ''}</td></tr>
            const h = f.modul[m]!
            return (
              <tr key={x.label}>
                <td><a className="kode-faskes" href={'/faskes/' + f.id} onClick={e => { e.preventDefault(); nav(f.id) }}>{x.label}</a></td>
                <td>{f.kelas_pendek}</td>
                <td className="num"><OEChip v={h.OE} z={h.z} n={h.n} st={h.status} /></td>
                <td className="num"><RupiahText v={f.rupiah_tertimbang} /></td>
                <td><StatusPill s={h.status} /></td>
                <td><Spark rows={f.bulanan[m] ?? []} /></td>
              </tr>
            )
          })}</tbody>
        </table>
        {kecil.length > 0 && <div className="akai">Volume kecil pada {kecil.length} faskes — pita kepercayaan lebar; cek profil untuk garis CI.</div>}
      </div>
    )
  }
  if (a.length === 2 && /vs|dibanding|banding/i.test(j.teks)) {
    return <div className="abuk dua">{a.map(x => <div key={x.label} className="ab"><b>{x.nilai}{x.satuan ? ' ' + x.satuan : ''}</b><span>{x.label}</span></div>)}</div>
  }
  return <div className="abuk">{a.map(x => <div key={x.label} className="ab"><b>{x.nilai}{x.satuan ? ' ' + x.satuan : ''}</b><span>{x.label}</span></div>)}</div>
}

export default function Chat({ halaman, onTutup, buka, besar, setBesar, dorongan, onDoronganTerpakai }: { halaman: string; onTutup: () => void; buka: boolean; besar: boolean; setBesar: (b: boolean) => void; dorongan: AiDorongan | null; onDoronganTerpakai: () => void }) {
  const { faskes } = useData()
  const nav = useNavigate()
  const [sp] = useSearchParams()

  const draRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const inpRef = useRef<HTMLTextAreaElement>(null)
  const ctlRef = useRef<AbortController | null>(null)
  const ngetikRef = useRef(false)

  const [log, setLog] = useState<Pesan[]>(baca<Pesan[]>(KUNCI_H + ':aktif', []).filter(p => p && p.content))
  const [q, setQ] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [luring, setLuring] = useState(false)
  const [gagal, setGagal] = useState<string | null>(null)
  const [st, setSt] = useState<{ j: Jawaban; t: string; penuh: string } | null>(null)
  const [pwa, setPwa] = useState(false)
  const [bawah, setBawah] = useState(true)
  const [kon, setKon] = useState<string | null>(null)
  const [riw, setRiw] = useState(false)
  const [riwTampil, setRiwTampil] = useState<string | null>(null)
  const [riwKunci, setRiwKunci] = useState('')
  const [hapusId, setHapusId] = useState<string | null>(null)
  const [lebar, setLebar] = useState<number | null>(null)
  const [cts, setCts] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const riwRef = useRef(riw); riwRef.current = riw

  const [konvo, setKonvo] = useState<Konvo[]>(() => baca<Konvo[]>(KUNCI_H, []))
  const [idAktif, setIdAktif] = useState<string>(() => uid())
  const [fb, setFb] = useState<Record<string, { n: number; alasan: string[] }>>(() => baca(KUNCI_FB, {}))

  const pertanyaanAwal = useMemo(() => (dorongan?.pertanyaan ? [...EMPTY_SUG].filter(p => p !== dorongan.pertanyaan).slice(0, 5) : EMPTY_SUG), [dorongan])

  const konteks = useMemo(() => {
    const m = halaman.match(/^\/faskes\/([\w-]+)/)
    if (m) { const f = faskes.find(x => x.id === m[1]); if (f) return `${f.label} · ${f.kab}` }
    const mm = halaman.match(/^\/modul\/(\w+)/)
    if (mm && INFO[mm[1] as Modul]) return `Modul #${INFO[mm[1] as Modul].nomor} ${INFO[mm[1] as Modul].nama}`
    if (halaman.startsWith('/antrean')) return 'Antrean audit'
    if (halaman.startsWith('/peta')) return 'Peta'
    if (halaman.startsWith('/metodologi')) return 'Metodologi'
    return 'Kota Semarang'
  }, [halaman, faskes])

  /* ---- lebar & expand ---- */
  useEffect(() => { try { const v = localStorage.getItem(KUNCI_W); if (v) setLebar(Number(v)) } catch { /* abaikan */ } }, [])
  useEffect(() => { if (lebar != null) { try { localStorage.setItem(KUNCI_W, String(lebar)) } catch { /* abaikan */ } } }, [lebar])

  const tarik = (e: React.PointerEvent) => {
    if (besar) return
    const x0 = e.clientX, w0 = draRef.current?.offsetWidth ?? 420
    const mv = (ev: PointerEvent) => setLebar(Math.min(640, Math.max(360, w0 + (x0 - ev.clientX))))
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); document.body.style.cursor = '' }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }

  /* ---- fokus & Esc & trap ---- */
  useEffect(() => {
    if (!buka) return
    const awal = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => inpRef.current?.focus(), 80)
    const tutup = () => { onTutup() }
    const trap = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === 'Escape') { if (riwRef.current) { setRiw(false); return } tutup(); return }
      if (ev.key !== 'Tab' || !draRef.current) return
      const fokus: HTMLElement[] = Array.from(draRef.current.querySelectorAll<HTMLElement>('a[href],button,textarea,input,select,[tabindex],details summary'))
      if (fokus.length === 0) return
      const i = fokus.indexOf(ev.target as HTMLElement)
      if (ev.shiftKey) { if (i <= 0) { ev.preventDefault(); fokus[fokus.length - 1].focus() } }
      else if (i === fokus.length - 1) { ev.preventDefault(); fokus[0].focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { window.clearTimeout(t); document.removeEventListener('keydown', trap); (awal as HTMLElement | null)?.focus?.() }
  }, [buka]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- riwayat ---- */
  useEffect(() => {
    if (!log.length) return
    const t = window.setTimeout(() => {
      const entri: Konvo = { id: idAktif, judul: (log.find(p => p.role === 'user')?.content ?? 'Percakapan').slice(0, 42), at: log[0].at, pesan: log }
      setKonvo(p => p.some(k => k.id === idAktif) ? p.map(k => k.id === idAktif ? entri : k) : [entri, ...p])
    }, 900)
    return () => window.clearTimeout(t)
  }, [log, idAktif])

  useEffect(() => {
    try { localStorage.setItem(KUNCI_H, JSON.stringify(konvo.slice(0, 20))) } catch { /* abaikan */ }
  }, [konvo])
  useEffect(() => {
    const t = window.setTimeout(() => { try { localStorage.setItem(KUNCI_H + ':aktif', JSON.stringify(log)) } catch { /* abaikan */ } }, 1200)
    return () => window.clearTimeout(t)
  }, [log])

  useEffect(() => { try { localStorage.setItem(KUNCI_FB, JSON.stringify(fb)) } catch { /* abaikan */ } }, [fb])

  const bukaKonvo = (k: Konvo) => { ngetikRef.current = false; setLog(k.pesan); setIdAktif(k.id); setGagal(null); setLuring(false); setRiw(false); setRiwTampil(null); setKon(konteks); window.setTimeout(() => inpRef.current?.focus(), 80) }
  const percakapanBaru = () => { ngetikRef.current = false; setIdAktif(uid()); setLog([]); setGagal(null); setLuring(false); setRiw(false); setRiwTampil(null); window.setTimeout(() => inpRef.current?.focus(), 80) }

  /* ---- konteks chip ---- */
  useEffect(() => { setKon(konteks) }, [konteks])

  /* ---- auto scroll ---- */
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const cek = () => setBawah(el.scrollHeight - el.scrollTop - el.clientHeight < 70)
    cek()
    el.addEventListener('scroll', cek, { passive: true })
    return () => el.removeEventListener('scroll', cek)
  }, [])
  useEffect(() => { if (bawah) boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }) }, [log, st, sibuk, bawah])

  useEffect(() => {
    if (!sibuk) { setPwa(false); return }
    const t = window.setTimeout(() => setPwa(true), 1500)
    return () => window.clearTimeout(t)
  }, [sibuk])

  useEffect(() => {
    if (!riw) return
    setRiwTampil(null)
    setRiwKunci('')
    setHapusId(null)
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button')?.focus(), 60)
  }, [riw])

  useEffect(() => {
    if (import.meta.env.DEV) {
      const el = boxRef.current
      if (!el) return
      const anak = Array.from(el.children).filter(c => !c.classList.contains('turun'))
      const akhir = anak[anak.length - 1]
      const ok = !akhir || akhir.classList.contains('ais') || akhir.classList.contains('perr') || akhir.classList.contains('chat-awal')
      if (!ok && log.length > 0) console.warn('[CekAkhir] elemen terakhir stream bukan status AI:', akhir?.className ?? '(kosong)')
    }
  }, [log, st, sibuk, gagal, luring])

  const tonjol = (t: string) => { setCts(t); window.setTimeout(() => setCts(null), 1800) }
  const salin = async (t: string) => { try { await navigator.clipboard.writeText(t) } catch { /* abaikan */ } tonjol('Disalin') }

  const commit = (j: Jawaban, teks: string, henti: boolean) => {
    setLog(l => [...l, { id: uid(), role: 'assistant', content: teks, jawaban: j, at: Date.now(), henti }])
  }

  const mulaiKetik = (j: Jawaban) => {
    const penuh = j.teks || ''
    setSt({ j, t: '', penuh })
    void (async () => {
      let i = 0
      while (i < penuh.length) {
        if (ngetikRef.current) return
        i += 1 + Math.round(Math.random() * 2)
        setSt({ j, t: penuh.slice(0, i), penuh })
        await new Promise<void>(r => window.setTimeout(r, 9))
      }
      if (ngetikRef.current) return
      setSt(null)
      commit(j, penuh, false)
    })()
  }

  async function kirim(teks: string) {
    const t = teks.trim()
    if (!t || sibuk || (st && !ngetikRef.current)) return
    ngetikRef.current = false
    ctlRef.current = new AbortController()
    const baru: Pesan[] = [...log, { id: uid(), role: 'user', content: t, at: Date.now() }]
    setLog(baru); setQ(''); setSibuk(true); setGagal(null); setLuring(false)
    let j: Jawaban | null
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctlRef.current.signal,
        body: JSON.stringify({ messages: [...baru].filter(p => p.content || p.jawaban).map(p => ({ role: p.role, content: p.role === 'user' ? p.content : (p.jawaban?.teks ?? p.content) })), halaman }),
      })
      if (!r.ok) throw new Error(String(r.status))
      j = await r.json() as Jawaban
      setSibuk(false)
      mulaiKetik(j)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setSibuk(false)
        setLog(l => [...l, { id: uid(), role: 'assistant', content: '', at: Date.now(), henti: true }])
        return
      }
      setSibuk(false)
      try {
        j = await jawabanCadangan(t)
        if (!j) { setGagal(t); return }
        setLuring(true); mulaiKetik(j)
      } catch { setGagal(t) }
    }
  }

  const hentikan = () => {
    ngetikRef.current = true
    if (st) { const { j, t } = st; setSt(null); commit(j, t, true) }
    else { ctlRef.current?.abort(); setSibuk(false) }
  }

  const fbPilih = (id: string, n: number, alasan?: string) => {
    setFb(p => {
      const lama = p[id]
      if (n === 0) { const nx = { ...p }; delete nx[id]; return nx }
      if (alasan) {
        const list = (lama && lama.n === -1 ? lama.alasan : [])
        return { ...p, [id]: { n: -1, alasan: list.includes(alasan) ? list.filter(x => x !== alasan) : [...list, alasan] } }
      }
      return { ...p, [id]: { n, alasan: n === -1 ? (lama?.alasan ?? []) : [] } }
    })
  }

  const saranIkut = (lalu?: string) => (SARAN[halaman] ?? SARAN.default).filter(s => s !== lalu).slice(0, 3)

  /* ---- dorongan eksternal: prefill konteks + pertanyaan, tahan dua periode ---- */
  useEffect(() => {
    if (!dorongan || !buka) return
    const t = window.setTimeout(() => {
      if (dorongan.konteks) setKon(dorongan.konteks)
      if (dorongan.pertanyaan) setQ(dorongan.pertanyaan)
      onDoronganTerpakai()
    }, 120)
    return () => window.clearTimeout(t)
  }, [dorongan, buka]) // eslint-disable-line react-hooks/exhaustive-deps

  const terapkanFilter = (m: Modul) => {
    const n = new URLSearchParams(sp)
    n.set('mod', m)
    n.set('st', 'perhatian|diamati')
    nav('/antrean?' + n.toString())
    onTutup()
  }

  const daftarCadangan = useMemo(async () => {
    try { const r = await fetch('/data/jawaban_cadangan.json'); if (!r.ok) throw 0; return await r.json() as { tanya: string; jawab: Jawaban }[] }
    catch { return [] }
  }, [])

  const nFaskes = faskes.filter(f => f.kab === KOTA).length
  const pertanyaanPalingAkhir = [...log].reverse().find(x => x.role === 'user')?.content

  const blokAi = (p: Pesan, mode: 'hidup' | 'riw') => {
    const { k, s } = kalimatPertama(p.content)
    const mS = modulDariSumber(p.jawaban?.sumber)
    const fbK = fb[p.id]
    return (
      <div key={p.id} className="ais">
        <span className="logo-an"><SidakMark size={20} /></span>
        <div className="ais-b">
          {mode === 'hidup' && <button type="button" className="ai-sal" aria-label="Salin jawaban" onClick={() => salin(p.content)}><Icon path={mdiContentCopy} size={13} /></button>}
          <p className="ai-jawab"><TeksBerlink teks={k} faskes={faskes} nav={nav} />{p.henti && <span className="hint"> — dihentikan</span>}</p>
          {s && <p className="ai-sisa"><TeksBerlink teks={s} faskes={faskes} nav={nav} /></p>}
          {p.jawaban && <Bukti j={p.jawaban} faskes={faskes} nav={nav} />}
          <div className="asum">
            {p.jawaban?.cadangan && <span className="luring">Jawaban tersimpan · mode luring</span>}
            {p.jawaban?.sumber && (mS ? <Link className="chip-sumber" to={'/modul/' + mS}>{p.jawaban.sumber} →</Link> : <cite>{p.jawaban.sumber}</cite>)}
          </div>
          {p.jawaban?.tautan && p.jawaban.tautan.length > 0 && <div className="tautan">{p.jawaban.tautan.map((t, k) => <Link key={k} to={t.url}>{t.label} →</Link>)}</div>}
          {mode === 'hidup' && mS && p.jawaban?.sumber && (
            <div className="aks-chip">
              {halaman.startsWith('/antrean') && <button type="button" className="chip ghost" onClick={() => terapkanFilter(mS)}>Terapkan filter</button>}
              <Link className="chip ghost" to={'/antrean?mod=' + mS + '&st=' + encodeURIComponent('perhatian|diamati')}>Lihat di Antrean →</Link>
            </div>
          )}
          {mode === 'hidup' && <div className="ais-fu">{saranIkut(pertanyaanPalingAkhir).slice(0, 2).map(sg => <button key={sg} type="button" className="chip" onClick={() => kirim(sg)}>{sg}</button>)}</div>}
          {mode === 'hidup' && (
            <div className="ais-fb">
              <button type="button" className={fbK?.n === 1 ? 'on' : ''} aria-label={fbK?.n === 1 ? 'Hapus penilaian membantu' : 'Jawaban membantu'} onClick={() => fbPilih(p.id, fbK?.n === 1 ? 0 : 1)} aria-pressed={fbK?.n === 1}><Icon path={fbK?.n === 1 ? mdiThumbUp : mdiThumbUpOutline} size={14} /></button>
              <button type="button" className={fbK?.n === -1 ? 'on' : ''} aria-label={fbK?.n === -1 ? 'Hapus penilaian tidak membantu' : 'Jawaban kurang membantu'} onClick={() => fbPilih(p.id, fbK?.n === -1 ? 0 : -1)} aria-pressed={fbK?.n === -1}><Icon path={fbK?.n === -1 ? mdiThumbDown : mdiThumbDownOutline} size={14} /></button>
              {fbK?.n === -1 && <div className="fb-alasan">{ALASAN.map(a => <button key={a} type="button" className={fbK.alasan.includes(a) ? 'on' : ''} onClick={() => fbPilih(p.id, -1, a)} aria-pressed={fbK.alasan.includes(a)}>{a}</button>)}</div>}
            </div>
          )}
          <span className="ai-jam">{waktu(p.at)}{p.jawaban?.cadangan ? ' · luring' : ''}</span>
        </div>
      </div>
    )
  }

  const node: React.ReactNode[] = []
  let hariSebelum = ''
  log.forEach((p, i) => {
    const hg = grupHari(p.at)
    if (hg !== hariSebelum) { hariSebelum = hg; node.push(<div key={'se' + i} className="tgl-pisah">{hg}</div>) }
    if (p.role === 'user') node.push(<div key={p.id} className="msg u">{p.content}</div>)
    else node.push(blokAi(p, 'hidup'))
  })

  const kataRiw = riwKunci.trim().toLowerCase()
  const tampilKonvo = !kataRiw ? konvo : konvo.filter(k => k.judul.toLowerCase().includes(kataRiw))
  const konvoPil = riwTampil ? konvo.find(k => k.id === riwTampil) ?? null : null

  const ulasKonvo = (k: Konvo) => {
    const n: React.ReactNode[] = []
    let hs = ''
    k.pesan.forEach((p, i) => {
      const hg = grupHari(p.at)
      if (hg !== hs) { hs = hg; n.push(<div key={'se' + i} className="tgl-pisah">{hg}</div>) }
      if (p.role === 'user') n.push(<div key={p.id} className="msg u">{p.content}</div>)
      else n.push(blokAi(p, 'riw'))
    })
    return n
  }

  const hapusKon = (id: string) => {
    if (hapusId !== id) { setHapusId(id); return }
    setKonvo(p => p.filter(x => x.id !== id))
    setHapusId(null); setRiwTampil(null)
    if (id === idAktif) { setIdAktif(uid()); setLog([]); setGagal(null) }
  }

  const bersihDari = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); kirim(q) }
  }

  return (
    <div className="chat-pok" ref={draRef} tabIndex={-1} style={{ width: lebar != null && !besar ? lebar : undefined }}>
      <div className="chat-grip" onPointerDown={tarik} aria-hidden="true" />
      <div className="chat-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="logo-an"><SidakMark size={20} /></span>
          <div><b>Tanya AI SIDAK</b><div className="hint">Asisten AI data klaim — bukan pengganti audit</div></div>
        </div>
        <div className="head-k">
          <button type="button" className="his-btn" onClick={() => setRiw(o => !o)} aria-expanded={riw} aria-haspopup="dialog" aria-label="Riwayat percakapan" title="Riwayat percakapan"><Icon path={mdiHistory} size={16} /></button>
          <TentangAI />
          <button type="button" className="his-btn" aria-label={besar ? 'Ciutkan panel' : 'Perluas panel'} title={besar ? 'Ciutkan' : 'Perluas (fokus penuh)'} onClick={() => setBesar(!besar)}><Icon path={besar ? mdiFullscreenExit : mdiFullscreen} size={16} /></button>
          <button type="button" className="chat-close" onClick={onTutup} aria-label="Tutup asisten"><Icon path={mdiClose} size={18} /></button>
        </div>
      </div>

      {luring && <div className="chat-offline" role="status"><b>Sambungan terputus</b><span>Menampilkan jawaban tersimpan.</span></div>}
      {kon && <div className="chat-kontek"><button type="button" className="chip kontek" onClick={() => setKon(null)} title="Hapus konteks">Konteks: {kon}<span className="x">×</span></button></div>}

      <div className="chat-log" ref={boxRef} aria-live="polite">
        {luring ? (
          <ShelfCari daftar={daftarCadangan} onTanya={kirim} />
        ) : (
          <>
            {log.length === 0 && !st && !sibuk && !gagal && (
              <div className="chat-awal">
                <span className="logo-an besar"><SidakMark size={36} /></span>
                <h2>Ada yang ingin ditahu tentang data klaim?</h2>
                <p className="hint" style={{ maxWidth: 320 }}>Saya menjawab pertanyaan data klaim & audit. Saya tidak menampilkan data pasien dan tidak menggantikan keputusan audit.</p>
                <div className="chat-sug awal">{pertanyaanAwal.map(s => <button key={s} type="button" className="chip" onClick={() => kirim(s)}>{s}</button>)}</div>
              </div>
            )}

            {node}

            {st && (
              <div className="ais">
                <span className="logo-an"><SidakMark size={20} /></span>
                <div className="ais-b">
                  <p className="ai-jawab"><TeksBerlink teks={st.t} faskes={faskes} nav={nav} /><span className="caret" /></p>
                </div>
              </div>
            )}

            {sibuk && !st && (
              <div className="ais skel-box">
                <span className="logo-an"><SidakMark size={20} /></span>
                <div className="ais-b">
                  <div className="ai-tut">SIDAK sedang menganalisis…{pwa && <b className="ai-tut-telat">Memindai {num(nFaskes)} faskes di Kota Semarang…</b>}</div>
                  <div className="skel">
                    <div className="bar" style={{ width: '72%' }} />
                    <div className="bar" style={{ width: '88%' }} />
                    <div className="kartu" />
                    <div className="bar" style={{ width: '55%' }} />
                  </div>
                </div>
              </div>
            )}

            {!bawah && log.length > 0 && (
              <button type="button" className="turun" onClick={() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' }); setBawah(true) }}><Icon path={mdiArrowDown} size={14} /> Pertanyaan baru</button>
            )}

            {gagal && (
              <div className="perr" role="alert"><b>Jawaban gagal dimuat.</b> Dapatkan jawaban tersimpan ataupun periksa koneksi.<button type="button" className="btn sm" onClick={() => kirim(gagal)}>Coba lagi</button></div>
            )}
          </>
        )}
      </div>

      {!luring && (
        <form className="chat-in" onSubmit={ev => { ev.preventDefault(); (sibuk || st) ? hentikan() : kirim(q) }}>
          <span className="cari" style={{ flex: 1 }}>
            <textarea ref={inpRef} value={q} onChange={ev => { setQ(ev.target.value); ev.target.style.height = 'auto'; ev.target.style.height = Math.min(ev.target.scrollHeight, 120) + 'px' }} onKeyDown={bersihDari} placeholder="Tanya tentang data klaim, modul, atau faskes…" aria-label="Tulis pertanyaan untuk Tanya AI SIDAK" rows={1} disabled={sibuk || !!st} autoComplete="off" />
          </span>
          <button className="btn primary" disabled={(sibuk || st) ? false : !q.trim()} aria-label={sibuk || st ? 'Hentikan pembuatan jawaban' : 'Kirim pertanyaan'} type="submit">
            <Icon path={(sibuk || st) ? mdiStop : mdiSend} size={15} />{(sibuk || st) ? 'Hentikan' : 'Kirim'}
          </button>
        </form>
      )}
      {luring && <div className="chat-hint-lur">Kembali daring untuk bertanya — sementara itu telusuri jawaban tersimpan di atas.</div>}
      <div className="chat-foot">Jawaban dari data sampel anonim ±1% · bukan pengganti audit medis</div>

      {riw && (
        <div className="his-ovl" ref={panelRef} role="dialog" aria-modal="true" aria-label="Riwayat percakapan">
          <div className="his-ovl-h">
            <button type="button" className="his-back" onClick={() => riwTampil ? setRiwTampil(null) : setRiw(false)} aria-label="Kembali ke percakapan"><Icon path={mdiArrowLeft} size={16} /> Kembali</button>
            <b>{riwTampil ? 'Percakapan' : 'Riwayat'}</b>
            <button type="button" className="btn primary sm" onClick={percakapanBaru}><Icon path={mdiPlus} size={14} /> Percakapan baru</button>
          </div>

          {konvoPil ? (
            <div className="his-detail">
              <div className="his-dpk">
                <button type="button" className="btn primary" onClick={() => bukaKonvo(konvoPil)}><Icon path={mdiArrowLeft} size={14} /> Lanjutkan percakapan</button>
                <button type="button" className={'btn his-hapus' + (hapusId === konvoPil.id ? ' on' : '')} onClick={() => hapusKon(konvoPil.id)}>{hapusId === konvoPil.id ? 'Hapus?' : <><Icon path={mdiDeleteOutline} size={14} /> Hapus</>}</button>
              </div>
              {konvoPil.pesan.length === 0 && <div className="his-kosong">Belum ada pesan dalam percakapan ini.</div>}
              {ulasKonvo(konvoPil)}
            </div>
          ) : (
            <>
              <span className="cari his-cari"><Icon path={mdiMagnify} size={13} /><input type="search" value={riwKunci} onChange={e => setRiwKunci(e.target.value)} placeholder="Cari di riwayat…" aria-label="Cari di riwayat" /></span>
              <div className="his-lis">
                {tampilKonvo.length === 0 && <div className="his-kosong">{konvo.length === 0 ? 'Belum ada riwayat — pertanyaan pertama Anda akan tersimpan di sini.' : 'Tidak ada yang cocok.'}</div>}
                {Array.from(new Set(tampilKonvo.map(k => grupHari(k.at)))).map(g => (
                  <div key={g}>
                    <div className="his-grup">{g}</div>
                    {tampilKonvo.filter(k => grupHari(k.at) === g).map(k => {
                      const tanya = k.pesan.reduce((n, p) => n + (p.role === 'user' ? 1 : 0), 0)
                      return (
                        <div key={k.id} className="his-row">
                          <button type="button" className={'his-item' + (k.id === idAktif ? ' on' : '')} onClick={() => setRiwTampil(k.id)}>
                            <span>
                              <b>{k.judul}</b>
                              <span>{tanya} tanya-jawab · {waktu(k.at)}</span>
                            </span>
                            <Icon path={mdiChevronRight} size={16} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {cts && <div className="chat-toast" role="status">{cts}</div>}
    </div>
  )
}

function ShelfCari({ daftar, onTanya }: { daftar: Promise<{ tanya: string; jawab: Jawaban }[]>; onTanya: (t: string) => void }) {
  const [items, setItems] = useState<{ tanya: string; jawab: Jawaban }[] | null>(null)
  const [frag, setFrag] = useState('')
  useEffect(() => { let live = true; void daftar.then(d => { if (live) setItems(d) }); return () => { live = false } }, [daftar])
  const f = frag.trim().toLowerCase()
  const tampil = (items ?? []).filter(d => !f || d.tanya.toLowerCase().includes(f)).slice(0, 12)
  return (
    <>
      <span className="cari shelf-img"><Icon path={mdiHistory} size={13} /><input type="search" value={frag} onChange={e => setFrag(e.target.value)} placeholder="Cari jawaban tersimpan…" aria-label="Cari jawaban tersimpan" /></span>
      {!items ? <div className="hint" style={{ marginTop: 8 }}>Memuat jawaban tersimpan…</div>
        : items.length === 0 ? <div className="hint" style={{ marginTop: 8 }}>Belum ada jawaban tersimpan.</div>
          : tampil.length === 0 ? <div className="hint" style={{ marginTop: 8 }}>Tidak ada yang cocok.</div>
            : tampil.map(d => (
              <div key={d.tanya} className="shelf-k">
                <b>{d.tanya}</b>
                <p>{d.jawab.teks}</p>
                <button type="button" className="chip" onClick={() => onTanya(d.tanya)}>Tanya ini</button>
              </div>
            ))}
    </>
  )
}