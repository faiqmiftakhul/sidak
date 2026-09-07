import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface Angka { label: string; nilai: string; satuan?: string; sumber?: string }
interface Tautan { label: string; url: string }
interface Jawaban { teks: string; angka?: Angka[]; tautan?: Tautan[]; sumber?: string; cadangan?: boolean }
interface Pesan { role: 'user' | 'assistant'; content: string; jawaban?: Jawaban }

const SARAN: Record<string, string[]> = {
  '/': ['RS mana yang paling perlu diperhatikan di Semarang dan berapa rupiahnya?', 'Berapa estimasi selisih rupiah semua modul di Semarang?', 'Ringkas kondisi Kota Semarang dalam tiga kalimat'],
  '/peta': ['Kabupaten mana di Jawa Tengah dengan O/E readmisi tertinggi?', 'Dari kabupaten mana pasien readmisi di Semarang paling banyak berasal?', 'Kecamatan mana yang paling padat faskes?'],
  '/antrean': ['Urutkan tiga temuan terbesar dan alasannya', 'Berapa faskes yang statusnya perlu perhatian per modul?'],
  '/modul/readmisi': ['Kenapa RS dengan angka readmisi tinggi bisa berstatus wajar?', 'RS mana yang ditandai untuk readmisi dan berapa selisihnya?'],
  '/modul/severity': ['Apakah RS kelas A dengan severity III 22% itu wajar?', 'Berapa selisih tarif severity III dan II?'],
  '/modul/fragmentasi': ['Faskes mana yang diputihkan karena pola dialisis?', 'RS mana yang tersisa sebagai kandidat audit fragmentasi?'],
  '/modul/rujukan': ['Puskesmas atau klinik yang lebih banyak merujuk kasus ringan?', 'FKTP mana dengan pangsa rujukan non-spesialistik tertinggi?'],
  '/metodologi': ['Apa arti O/E dan skor z?', 'Kenapa model readmisi tidak memakai penyeimbangan kelas?'],
  default: ['Siapa dokter yang paling sering upcoding?', 'Apakah RS ini melakukan fraud?', 'Kenapa RS ini ditandai?'],
}

let cadangan: { tanya: string; jawab: Jawaban }[] | null = null
async function jawabanCadangan(q: string): Promise<Jawaban> {
  if (!cadangan) { try { cadangan = await (await fetch('/data/jawaban_cadangan.json')).json() } catch { cadangan = [] } }
  const tok = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3))
  const q1 = tok(q)
  let best: { s: number; j: Jawaban } | null = null
  for (const c of cadangan!) {
    const t = tok(c.tanya)
    let s = 0
    q1.forEach(w => { if (t.has(w)) s++ })
    s = s / Math.max(1, Math.max(q1.size, t.size))
    if (!best || s > best.s) best = { s, j: c.jawab }
  }
  if (best && best.s >= 0.4) return { ...best.j, cadangan: true }
  return { teks: 'Layanan asisten tidak terjangkau dan pertanyaan ini belum ada di jawaban tersimpan. Coba salah satu saran pertanyaan, atau buka halaman terkait langsung.', cadangan: true }
}

export default function Chat({ halaman }: { halaman: string }) {
  const [log, setLog] = useState<Pesan[]>([{ role: 'assistant', content: '', jawaban: { teks: 'Halo, saya Tanya SIDAK. Tanyakan apa saja tentang pola klaim di Kota Semarang, misalnya faskes mana yang perlu perhatian, mengapa ditandai, atau berapa estimasi selisih rupiahnya. Saya hanya menjawab dari data agregat yang sudah dihitung dan tidak memuat identitas peserta maupun dokter.' } }])
  const [q, setQ] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [log, sibuk])
  const saran = SARAN[halaman] ?? SARAN[Object.keys(SARAN).find(k => k !== 'default' && k !== '/' && halaman.startsWith(k)) ?? 'default'] ?? SARAN.default

  async function kirim(teks: string) {
    if (!teks.trim() || sibuk) return
    const baru: Pesan[] = [...log, { role: 'user', content: teks }]
    setLog(baru); setQ(''); setSibuk(true)
    let j: Jawaban
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: baru.filter(p => p.content || p.jawaban).map(p => ({ role: p.role, content: p.role === 'user' ? p.content : (p.jawaban?.teks ?? p.content) })), halaman }),
      })
      if (!r.ok) throw new Error(String(r.status))
      j = await r.json()
    } catch {
      j = await jawabanCadangan(teks)
    }
    setLog(l => [...l, { role: 'assistant', content: j.teks, jawaban: j }])
    setSibuk(false)
  }

  return (
    <>
      <div className="chat-head"><div><b>Tanya SIDAK</b><div className="hint">Asisten data · jawaban selalu dari angka yang sama dengan layar</div></div></div>
      <div className="chat-log">
        {log.map((p, i) => p.role === 'user'
          ? <div key={i} className="msg u">{p.content}</div>
          : <div key={i} className="msg a">
            {p.jawaban?.teks ?? p.content}
            {p.jawaban?.angka && p.jawaban.angka.length > 0 && <div className="angka">{p.jawaban.angka.map((a, k) => <div key={k}><b>{a.nilai}{a.satuan ? ' ' + a.satuan : ''}</b>{a.label}</div>)}</div>}
            {p.jawaban?.tautan && p.jawaban.tautan.length > 0 && <div className="tautan">{p.jawaban.tautan.map((t, k) => <Link key={k} to={t.url}>{t.label} →</Link>)}</div>}
            {(p.jawaban?.sumber || p.jawaban?.cadangan) && <div className="src">{p.jawaban.cadangan ? 'Jawaban tersimpan (mode luring). ' : ''}{p.jawaban.sumber ?? ''}</div>}
          </div>)}
        {sibuk && <div className="msg a dots"><span /><span /><span /></div>}
        <div ref={end} />
      </div>
      <div className="chat-sug">{saran.map(s => <span key={s} className="chip" onClick={() => kirim(s)}>{s}</span>)}</div>
      <form className="chat-in" onSubmit={e => { e.preventDefault(); kirim(q) }}>
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Tulis pertanyaan…" disabled={sibuk} />
        <button className="btn primary" disabled={sibuk}>Kirim</button>
      </form>
    </>
  )
}
