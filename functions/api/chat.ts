// Port 1:1 /api/chat dari api/main.py → Cloudflare Pages Function.
// Alur: pipeline ter-scope (slot → retrieval → komposisi) lalu fallback loop alat
// (tools OpenAI-compatible) dan jawaban tersimpan (cadangan) saat gagal.

import { NOMOR, KOTA, inisialisasi, store, muatCadangan } from "../lib/data"
import { buatClient, ekstrakJson, NASKH_PEKSTRAK, KEY, type Client } from "../lib/llm"
import { TOOLS, jalankanAlat } from "../lib/tools"

const _g = globalThis as any

const TEMPLATE: Record<string, string> = {
  A: "Saya hanya membahas data klaim dan alur audit SIDAK.",
  B: "Data pasien tidak tersedia — SIDAK hanya memuat data klaim yang telah dianonimkan.",
  C: "Itu di luar wewenang saya — SIDAK menampilkan indikasi statistik; keputusan akhir melalui audit medis.",
  D: "Pertanyaan itu di luar cakupan SIDAK. Saya bisa membantu soal data klaim, modul, atau antrean audit.",
  E: "Data itu tidak tersedia dalam sampel saat ini.",
  F: "Agar jawaban tepat, saya perlu satu klarifikasi: %s",
}
const REFUSAL_SLOT: Record<string, string> = { luar_cakupan: "D", rahasia: "A", injection: "A", pasien: "B", vonis: "C" }
const SLUG: Record<string, string> = {}
for (const [k, v] of Object.entries(NOMOR)) SLUG[String(v)] = k

const max_iter = 5
const KACHE_JAWABAN = new Map<string, { t: number; jawaban: Record<string, any> }>()
const KACHE_MAX = 512

const _tokens = (s: string): Set<string> => new Set((s || "").toLowerCase().match(/[a-z0-9]+/g) ?? [])

// Kata kunci domain SIDAK — pertanyaan tanpa satu pun dari ini (dan tanpa cabang
// heuristik yang cocok) dianggap luar cakupan saat ekstraksi slot via model gagal.
const KATA_DOMAIN = /klaim|\boe\b|o\/e|\bz\b|skor|modul|rujukan|severity|fragmentasi|readmisi|faskes|audit|antrean|sidak|bpjs|sampel|wilayah|prioritas|tren|rupiah|selisih|potensi|estimasi|kunjungan|statistik|semarang|\brs\b|\bfktp\b|\bdata\b|\bangka\b|analisa|analisis/

function slotDefault(halaman?: string): Record<string, any> {
  const s: Record<string, any> = { intent: "aggregate", metric: "rupiah", module: "all", scope: KOTA, faskes: null, period: null, topN: 5, klarifikasi: null }
  if (halaman) {
    const mi = halaman.match(/\/modul\/([^/?#]+)/)
    if (mi) s.module = mi[1]
    const fid = halaman.match(/\/faskes\/(rs|fktp)(\d+)/i)
    if (fid) {
      s.faskes = (fid[1] + "-" + fid[2]).toUpperCase()
      s.intent = "fact"
    }
  }
  return s
}

export function slotHeuristik(teks: string, halaman?: string): Record<string, any> {
  const t = (teks || "").toLowerCase()
  const s = slotDefault(halaman)
  let cocok = false
  if (t.includes("apa itu") || t.includes("arti") || t.includes("maksud o/e") || t.includes("apa o/")) {
    cocok = true
    s.intent = "concept"; s.metric = "oe"
  } else if (t.includes("tren") || t.includes("per bulan") || t.includes("naik/turun") || t.includes("bulanan")) {
    cocok = true
    s.intent = "trend"; s.metric = "count"
    if (t.includes("16") || t.includes("readmisi")) s.module = "16"
    else if (t.includes("9") || t.includes("fragmentasi")) s.module = "9"
    else if (t.includes("4") || t.includes("severity")) s.module = "4"
    else if (t.includes("3") || t.includes("rujukan")) s.module = "3"
    else s.module = "all"
  } else if (t.includes("berapa jumlah rs") || t.includes("jumlah rs") || t.includes("berapa rs") ||
    t.includes("jumlah fktp") || t.includes("berapa fktp") || t.includes("banyak rs")) {
    cocok = true
    s.intent = "fact"; s.metric = "count"
  } else if (/\b(rs|fktp)[- ]?\d{3,}/.test(t)) {
    cocok = true
    s.faskes = t.match(/\b(rs|fktp)[- ]?\d{3,}/)![0].toUpperCase().replace(" ", "-")
    s.intent = "fact"
  } else if (t.includes("yang mana") || t.includes("mana saja") || t.includes("terbesar") || t.includes("tertinggi") ||
    t.includes("paling") || t.includes("peringkat") || t.includes("urutan") || t.includes("daftar") ||
    t.includes("ditandai") || t.includes("perlu diperhati") || t.includes("kandidat") || t.includes("antrean") || /\bmana\b/.test(t)) {
    cocok = true
    s.intent = "list"
    s.metric = t.includes("oe") ? "oe" : (t.includes(" z") || t.startsWith("z ") ? "z" : "rupiah")
  } else if (t.includes("selisih") || t.includes("rupiah")) {
    cocok = true
    s.intent = "aggregate"; s.metric = "rupiah"
  }
  const mod = t.match(/\bmodul[^\d]{0,3}(3|4|9|16)\b/)
  if (mod) { s.module = mod[1]; cocok = true }
  // Tidak ada cabang yang cocok DAN tidak menyebut domain sama sekali → tolak,
  // jangan dijawab dengan ringkasan wilayah default (penyebab jawaban seragam).
  if (!cocok && !KATA_DOMAIN.test(t)) {
    return { ...s, intent: "refusal", alasan: "luar_cakupan" }
  }
  return s
}

function modulSlug(m?: string | null): string | null {
  if (!m || String(m) === "all") return null
  return m in NOMOR ? m : (SLUG[String(m)] ?? null)
}

async function ekstrakSlot(teks: string, halaman: string | undefined, model: Client | null): Promise<Record<string, any>> {
  if (model) {
    try {
      const r = await model.chat.completions.create({
        temperature: 0, max_tokens: 140,
        messages: [{ role: "system", content: NASKH_PEKSTRAK.replace("%s", teks) }],
      })
      const j = ekstrakJson(r.choices[0]?.message?.content ?? "")
      if ("intent" in j) {
        j.metric ??= "rupiah"; j.module ??= "all"; j.scope ??= null; j.faskes ??= null
        j.period ??= null; j.topN ??= 5; j.klarifikasi ??= null
        j._asal = "model"
        if (j.intent === "comparison" && !j.klarifikasi) j.klarifikasi = "Apa yang ingin Anda bandingkan, dan dalam scope apa?"
        return j
      }
    } catch { /* jatuh ke heuristik */ }
  }
  const s = slotHeuristik(teks, halaman)
  s._asal = "heuristic"
  return s
}

function pilihRetrieval(slot: Record<string, any>): Array<[string, Record<string, any>]> {
  const intent = slot.intent
  const met = slot.metric ?? "rupiah"
  const mod = modulSlug(slot.module)
  const scop = slot.scope ?? KOTA
  const f = slot.faskes
  const topN = Math.min(Number(slot.topN) || 5, 20)
  if (intent === "concept") return [["metodologi", { topik: "oe" }]]
  if (f && (intent === "fact" || intent === "aggregate" || intent === "list" || intent === "comparison")) {
    const a: Record<string, any> = { faskes: f }
    if (mod) a.modul = mod
    return [["jelaskan_temuan", a]]
  }
  if (intent === "trend") return [["trend", { wilayah: scop, modul: mod, period: slot.period }]]
  if (intent === "comparison") {
    if (mod && (scop === "" || scop === "JAWA TENGAH" || scop === "JATENG"))
      return [["bandingkan_kabkota", { modul: mod, urut: "OE", jumlah: topN }]]
    return [["daftar_temuan", { wilayah: scop, modul: mod, status: "aktif", urut: "rupiah_tertimbang", jumlah: 2, sedikit: true }]]
  }
  if (intent === "ranking" || intent === "list") {
    const urut = ({ oe: "OE", z: "z", rupiah: "rupiah_tertimbang", count: "volume" } as Record<string, string>)[met] ?? "rupiah_tertimbang"
    const p: Array<[string, Record<string, any>]> = [["daftar_temuan", { wilayah: scop, modul: mod, status: "aktif", urut, jumlah: topN, sedikit: true }]]
    if (!mod) p.unshift(["faskes_count", { wilayah: scop }])
    return p
  }
  if (intent === "aggregate" || intent === "fact") {
    if (met === "count") return [["faskes_count", { wilayah: scop }]]
    if (mod) return [["ambil_indikator", { modul: mod, wilayah: scop }]]
    return [["ringkas_wilayah", { wilayah: scop }]]
  }
  if (intent === "workflow") return [["metodologi", {}]]
  return []
}

async function aksesRetrieval(pilihan: Array<[string, Record<string, any>]>): Promise<Array<[string, unknown]>> {
  const hasil: Array<[string, unknown]> = []
  for (const [nama, args] of pilihan) {
    const a = { ...args }
    if (a.modul == null) delete a.modul
    hasil.push([nama, await jalankanAlat(nama, a)])
  }
  return hasil
}

async function digestHex(text: string, algo: "SHA-1" | "SHA-256"): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const h = await crypto.subtle.digest(algo, buf)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("")
}

async function kunciKache(teks_q: string, slot: Record<string, any>, t: number): Promise<string> {
  const sub: Record<string, any> = {}
  for (const k of ["intent", "metric", "module", "scope", "faskes", "period", "topN"])
    if (k in slot) sub[k] = slot[k]
  const stabil = JSON.stringify(Object.keys(sub).sort().map(k => [k, sub[k]]))
  const raw = `${teks_q.trim().toLowerCase()}\x00${stabil}\x00${t.toFixed(3)}`
  return digestHex(raw, "SHA-256")
}

function simpanKache(kunci: string, jawaban: Record<string, any>): void {
  if (KACHE_JAWABAN.size >= KACHE_MAX) KACHE_JAWABAN.clear()
  KACHE_JAWABAN.set(kunci, { t: Date.now() / 1000, jawaban })
}

function canari(jawabanBaru: string, jawabanLama: string): void {
  const a = _tokens(jawabanBaru), b = _tokens(jawabanLama)
  if (!a.size || !b.size) return
  const irisan = [...a].filter(x => b.has(x)).length
  const sim = irisan / Math.max(Math.min(a.size, b.size), 1)
  if (sim > 0.9) console.warn("canari kemiripan %.2f (> .90)", sim)
}

function jawabanSebelumnya(msgs: Array<Record<string, any>>): string {
  for (const m of [...msgs].reverse()) {
    if (m.role === "assistant" && String(m.content ?? "").trim()) return String(m.content).slice(0, 4000)
  }
  return ""
}

function pesanKomposisi(teks_q: string, slot: Record<string, any>, hasil: Array<[string, unknown]>): string {
  const blok = hasil.map(([n, r]) => `## hasil ${n}\n${JSON.stringify(r)}`).join("\n\n")
  const kanal = ["intent", "metric", "module", "scope", "faskes", "topN"].map(k => `${k}=${slot[k]}`).join(" | ")
  return `${teks_q}\n\n(Kanal: ${kanal})\nData di bawah adalah SATU-SATUNYA sumber fakta untuk pertanyaan ini.\n${blok}`
}

async function komposisi(model: Client, msgs: Array<Record<string, any>>): Promise<Record<string, any>> {
  const resp = await model.chat.completions.create({ max_tokens: 2000, messages: msgs as any })
  const out = ekstrakJson(resp.choices[0]?.message?.content ?? "")
  if (!out.teks) throw new Error("komposisi kosong")
  return out
}

function ambilPertanyaan(msgs: Array<Record<string, any>>): string {
  for (const m of [...msgs].reverse()) {
    if (m.role === "user") {
      return String(m.content ?? "").replace(/\n*\(konteks: pengguna sedang membuka halaman[^)]*\)\s*$/, "").trim()
    }
  }
  return ""
}

async function jalankanPipeline(msgs: Array<Record<string, any>>, halaman: string | undefined, model: Client, t: number): Promise<Record<string, any> | null> {
  const teks_q = ambilPertanyaan(msgs)
  if (!teks_q) return null
  const slot = await ekstrakSlot(teks_q, halaman || "/", model)
  const intent = slot.intent
  if (intent === "refusal") {
    const huruf = REFUSAL_SLOT[String(slot.alasan ?? "luar_cakupan")] ?? "D"
    return { teks: TEMPLATE[huruf], angka: [], tautan: [], alat: [] }
  }
  if (intent === "clarify") {
    const q = slot.klarifikasi ?? "Boleh saya perjelas maksud pertanyaan ini?"
    return { teks: TEMPLATE["F"].replace("%s", q), angka: [], tautan: [], alat: [] }
  }
  const diizinkan = ["fact", "aggregate", "ranking", "list", "trend", "concept", "comparison"]
  if (intent === "workflow" || !diizinkan.includes(intent)) return null
  const pilihan = pilihRetrieval(slot) as Array<[string, Record<string, any>]>
  if (!pilihan.length) return null
  const hasil = await aksesRetrieval(pilihan)
  const kunci = await kunciKache(teks_q, slot, t)
  const cache = KACHE_JAWABAN.get(kunci)
  if (cache) {
    const out = { ...cache.jawaban }
    out.angka ??= []; out.tautan ??= []
    out.dari_kache = true
    out.alat = hasil.map(([n]) => n)
    return out
  }
  const pesan = pesanKomposisi(teks_q, slot, hasil)
  // Pertahankan hanya giliran terakhir (satu jawaban assistant terakhir + pesan
  // kini) agar model tidak meniru struktur/angka jawaban-jawaban lama.
  let idx_ais = -1
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "assistant") { idx_ais = i; break }
  const msgs_baru = (idx_ais >= 0 ? msgs.slice(idx_ais) : [...msgs])
  msgs_baru[msgs_baru.length - 1] = { role: "user", content: pesan }
  const jawaban = await komposisi(model, msgs_baru)
  jawaban.angka ??= []; jawaban.tautan ??= []
  jawaban.alat = hasil.map(([n]) => n)
  try { canari(String(jawaban.teks ?? ""), jawabanSebelumnya(msgs)) } catch { /* abaikan */ }
  simpanKache(kunci, jawaban)
  return jawaban
}

let _cadangan: any[] | null = null

async function cariCadangan(teks: string): Promise<Record<string, any> | null> {
  if (_cadangan === null) {
    try { _cadangan = await muatCadangan() } catch { _cadangan = [] }
  }
  const t = _tokens(teks)
  if (!t.size) return null
  let best: Record<string, any> | null = null, skor = 0, best_ukuran = 1
  for (const c of _cadangan) {
    const ut = _tokens(String(c.tanya ?? ""))
    let s = 0; for (const w of ut) if (t.has(w)) s++
    if (s > skor) { skor = s; best = c.jawab; best_ukuran = Math.max(ut.size, 1) }
  }
  // Ambang: minimal 2 kata kunci DAN mencakup >= 50% kata pertanyaan cadangan —
  // skor 1 (kata generik seperti "apa"/"itu") tidak boleh mengembalikan jawaban.
  if (skor < 2 || skor / best_ukuran < 0.5) return null
  if (!best) return null
  return { ...best, cadangan: true }
}

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }): Promise<Response> {
  const { request, env } = context
  _g.SUMODOP_API_KEY = env.SUMODOP_API_KEY
  _g.SUMODOP_BASE_URL = env.SUMODOP_BASE_URL
  _g.SIDAK_MODEL = env.SIDAK_MODEL
  inisialisasi(request, env)
  if (!KEY()) return Response.json({ detail: "SUMODOP_API_KEY belum diatur" }, { status: 503 })
  const model = buatClient()
  const S = await store()
  try {
    const body = (await request.json().catch(() => null)) as { messages?: Array<Record<string, any>>; halaman?: string } | null
    const raw = body?.messages
    if (!Array.isArray(raw)) return Response.json({ detail: "body.messages wajib array" }, { status: 400 })
    const msgs: Array<Record<string, any>> = raw
      .filter(m => m && m.content)
      .map(m => ({ role: String(m.role ?? "user"), content: String(m.content ?? "") }))
      .slice(-12)
    if (body?.halaman && msgs.length) {
      msgs[msgs.length - 1] = { role: "user", content: msgs[msgs.length - 1].content + `\n\n(konteks: pengguna sedang membuka halaman ${body.halaman})` }
    }
    const awal_teks = ambilPertanyaan(msgs) || (msgs.length ? msgs[0].content : "")
    const log: string[] = []
    let alat_menyala = false

    const selesaiCadangan = async (): Promise<Response> => {
      const j = await cariCadangan(awal_teks)
      if (!j) return Response.json({ detail: "asisten tidak selesai dan pertanyaan belum ada di jawaban tersimpan" }, { status: 503 })
      j.angka ??= []; j.tautan ??= []
      j.alat = [...log]
      return Response.json(j)
    }

    let hasil_slot: Record<string, any> | null = null
    try { hasil_slot = await jalankanPipeline(msgs, body?.halaman, model, S.t) } catch { hasil_slot = null }
    if (hasil_slot) return Response.json(hasil_slot)

    const TOOLS_OPENAI = TOOLS.map(t => ({ type: "function", function: t }))
    const iter = async (): Promise<Response> => {
      for (let i = 0; i < max_iter; i++) {
        let resp
        try {
          resp = await model.chat.completions.create({ max_tokens: 2000, tools: TOOLS_OPENAI, messages: msgs as any })
        } catch {
          return selesaiCadangan()
        }
        const cho = resp.choices[0]
        if (cho.finish_reason === "content_filter")
          return Response.json({ teks: "Respons tidak dapat diproses oleh asisten.", angka: [], tautan: [] })
        const seg = cho.message
        if (seg.tool_calls?.length) {
          log.push("model_minta_alat")
          if (alat_menyala) return selesaiCadangan()
          msgs.push({
            role: "assistant", content: seg.content ?? "",
            tool_calls: seg.tool_calls.map(tc => ({ id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments } })),
          })
          const hasil: Record<string, any>[] = []
          for (const tc of seg.tool_calls) {
            let args: Record<string, any>
            try { args = JSON.parse(tc.function.arguments || "{}") } catch { args = {} }
            const r = await jalankanAlat(tc.function.name, args)
            log.push(tc.function.name)
            hasil.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(r).slice(0, 60000) })
          }
          alat_menyala = true
          msgs.push({ role: "user", content: hasil })
          continue
        }
        const teks = seg.content ?? ""
        const out = ekstrakJson(teks)
        out.angka ??= []; out.tautan ??= []
        out.alat = [...log]
        return Response.json(out)
      }
      return selesaiCadangan()
    }
    return iter()
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 })
  }
}