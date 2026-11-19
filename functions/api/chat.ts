// Port 1:1 /api/chat dari api/main.py → Cloudflare Pages Function.
// Alur: pipeline ter-scope (slot → retrieval → komposisi) lalu fallback loop alat
// (tools OpenAI-compatible) dan jawaban tersimpan (cadangan) saat gagal.

import { NOMOR, KOTA, inisialisasi, store, muatCadangan } from "../lib/data"
import { buatClient, ekstrakJson, NASKH_PEKSTRAK, SYSTEM_PROMPT, KEY, type Client } from "../lib/llm"
import { TOOLS, jalankanAlat } from "../lib/tools"
import { kumpulkanAngka, periksaAngka, jawabanDitahan } from "../lib/periksa"
import { jawabDeterministik } from "../lib/deterministik"

const _g = globalThis as any

const TEMPLATE: Record<string, string> = {
  A: "Saya hanya membahas data klaim dan alur audit SIDAK.",
  B: "Data pasien tidak tersedia — SIDAK hanya memuat data klaim yang telah dianonimkan.",
  C: "Itu di luar wewenang saya — SIDAK menampilkan indikasi statistik; keputusan akhir melalui audit medis.",
  D: "Itu di luar yang bisa saya bantu. Saya hanya menjawab dari data klaim SIDAK, misalnya faskes yang perlu perhatian, estimasi selisih rupiah, atau tren tiap modul.",
  E: "Data itu tidak tersedia dalam sampel saat ini.",
  F: "Agar jawaban tepat, saya perlu satu klarifikasi: %s",
  G: "SIDAK tidak menilai individu (dokter, tenaga kesehatan, atau pasien) — analisis hanya sampai tingkat faskes, sebagai indikasi untuk audit.",
}
// Penjaga deterministik sebelum klasifikasi model: penilaian individu dan permintaan vonis selalu ditolak.
const RE_INDIVIDU = /\b(dokter|dr\.|dpjp|perawat|bidan|nakes|tenaga (medis|kesehatan)|nama pasien|nik)\b/i
const RE_VONIS = /\b(apakah|benarkah|pasti|terbukti)\b.*\b(fraud|curang|kecurangan|korupsi|menipu|nakal)\b/i
const REFUSAL_SLOT: Record<string, string> = { luar_cakupan: "D", rahasia: "A", injection: "A", pasien: "B", vonis: "C" }
const SLUG: Record<string, string> = {}
for (const [k, v] of Object.entries(NOMOR)) SLUG[String(v)] = k

// Percakapan ringan dijawab tanpa LLM: cepat, dan tidak bisa dipakai untuk membelokkan model.
const PERCAKAPAN: Array<[RegExp, string]> = [
  [/^(hai+|halo+|hallo|helo|hello|hi+|hey|hei|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam)|assalamu.?alaikum( wr wb)?|permisi)( (sidak|tanya sidak|min|kak|semua))?$/,
    "Halo, saya Tanya SIDAK. Saya membantu membaca data klaim di SIDAK: faskes yang perlu perhatian, estimasi selisih rupiah, tren tiap modul, dan cara membaca O/E. Silakan tanyakan salah satunya, atau pilih contoh di bawah."],
  [/^(terima ?kasih|makasih|trims|thanks?|thank you|thx|tq|mantap|oke|ok|okay|sip|siap|baik)( (ya|banyak|sidak|min|kak))*$/,
    "Sama-sama. Kalau ada data klaim lain yang ingin dicek, tanyakan saja."],
  [/^((kamu|anda) siapa|siapa (kamu|anda)|(kamu|anda) bisa apa( saja| aja)?|bisa (bantu )?apa( saja| aja)?|apa yang bisa (kamu|anda) (bantu|lakukan)|bantuan|help|cara (pakai|menggunakan)( sidak)?|fiturnya apa( saja)?)$/,
    "Saya Tanya SIDAK, asisten untuk data klaim di aplikasi ini. Yang bisa saya bantu: menunjukkan faskes yang perlu perhatian, menghitung estimasi selisih rupiah, menjelaskan kenapa sebuah faskes ditandai, menampilkan tren bulanan tiap modul, dan menjelaskan cara membaca O/E serta skor z. Yang tidak bisa: menilai dokter atau pasien, memastikan ada kecurangan, dan menjawab di luar data klaim SIDAK."],
]
const HITUNGAN = /^(?=.*\d\s*[+\-*/x×:^]\s*\d)[\d\s+\-*/x×:^().,=]+(berapa|hasilnya|=)?\s*\??$/
const normal = (t: string): string => (t || "").toLowerCase().replace(/[^\p{L}\p{N}_\s/#-]/gu, " ").replace(/\s+/g, " ").trim()

// Jawaban tanpa LLM: percakapan ringan, atau pertanyaan yang persis sama dengan jawaban tersimpan (chip saran).
export async function jawabCepat(teks: string): Promise<Record<string, any> | null> {
  const n = normal(teks)
  if (!n) return null
  for (const [pola, isi] of PERCAKAPAN) if (pola.test(n)) return { teks: isi, angka: [], tautan: [], alat: [], cepat: true }
  if (HITUNGAN.test((teks || "").trim().toLowerCase())) return { teks: TEMPLATE.D, angka: [], tautan: [], alat: [], cepat: true }
  let daftar: Array<{ tanya?: string; jawab?: Record<string, any> }> = []
  try { daftar = await muatCadangan() } catch { daftar = [] }
  const c = daftar.find(x => normal(String(x.tanya ?? "")) === n)
  if (!c?.jawab) return null
  return { angka: [], tautan: [], ...c.jawab, alat: [], cepat: true }
}

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

const NAMA_MODUL: Array<[string, string]> = [["readmisi", "16"], ["fragmentasi", "9"], ["severity", "4"], ["upcoding", "4"], ["keparahan", "4"],
  ["rujukan", "3"], ["merujuk", "3"], ["rujuk", "3"]]
const TUNGGAL = /\b(rs|faskes|fktp|rumah sakit|klinik|puskesmas)\b[^?.]{0,40}?\b(tertinggi|terbesar|terbanyak|terparah|paling (tinggi|besar|banyak|parah|bermasalah|mahal))\b/
const JAMAK = /mana saja|apa saja|siapa saja|daftar|urutkan|urutan|peringkat|beberapa|semua|teratas|top\s*\d|\b\d+\s*(rs|faskes|fktp)\b|\b(dua|tiga|empat|lima|sepuluh)\b/
const BANDING = /\b(bandingkan|dibandingkan|banding|perbandingan|versus|vs)\b/
const NARASI = /\b(kenapa|mengapa|jelaskan|alasan|apa sebab|bagaimana bisa|bandingkan|dibandingkan|versus|vs|beda|perbedaan|rekomendasi|saran|sebaiknya)\b/
const reKata = (x: string) => new RegExp("\\b" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b")

// Kab/kota Jawa Tengah selain Kota Semarang yang disebut di pertanyaan (kunci S.kab), atau "JAWA TENGAH".
function wilayahDisebut(t: string, kabKeys: string[]): string | null {
  if (/jawa tengah|jateng|provinsi/.test(t)) return "JAWA TENGAH"
  if (/\b(kabupaten|kab\.?) semarang\b/.test(t)) return "KABUPATEN SEMARANG"
  for (const k of kabKeys) if (k.startsWith("KOTA ") && k !== KOTA && reKata(k.toLowerCase()).test(t)) return k
  for (const k of kabKeys) if (!k.startsWith("KOTA ") && k !== "SEMARANG" && reKata(k.toLowerCase()).test(t)) return k
  return null
}

export function slotHeuristik(teks: string, halaman?: string, kabKeys: string[] = []): Record<string, any> {
  const t = (teks || "").toLowerCase()
  const s = slotDefault(halaman)
  let cocok = false
  if (/\bapa itu\b|\barti(nya)?\b|\bmaksud o\/e|(^|\s)apa o\//.test(t)) {
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
    s.metric = t.includes("oe") || t.includes("o/e") ? "oe" : (t.includes(" z") || t.startsWith("z ") ? "z" : "rupiah")
    // "RS tertinggi" tanpa penanda jamak = satu faskes; daftar terurut dibuka dengan faskes teratas.
    s.tunggal = TUNGGAL.test(t) && !JAMAK.test(t)
    s.buka_teratas = !/perlu diperhati|perhatian|ditandai|kandidat|antrean/.test(t)
    s.kerugian = /kerugian|\brugi\b|merugikan/.test(t)
    s.tipe = /\brs\b|rumah sakit/.test(t) ? "FKRTL" : (/\bfktp\b|klinik|puskesmas/.test(t) ? "FKTP" : null)
  } else if (t.includes("selisih") || t.includes("rupiah")) {
    cocok = true
    s.intent = "aggregate"; s.metric = "rupiah"
  }
  const mod = t.match(/\bmodul[^\d]{0,3}(3|4|9|16)\b/)
  if (mod) { s.module = mod[1]; cocok = true }
  else if (t.includes("semua modul")) s.module = "all"
  else if (s.module === "all") {
    const nm = NAMA_MODUL.find(([kata]) => t.includes(kata))
    if (nm) { s.module = nm[1]; cocok = cocok || /\bberapa\b/.test(t) }
  }
  if (s.intent === "aggregate" && (t.includes("o/e") || /\boe\b/.test(t))) s.metric = "oe"
  const wil = wilayahDisebut(t, kabKeys)
  if (wil) s.scope = wil
  if (BANDING.test(t)) {
    const kode = [...new Set((t.match(/\b(?:rs|fktp)[- ]?\d{3,}/g) ?? []).map(x => x.toUpperCase().replace(" ", "-")))]
    const mods = [...new Set([...[...t.matchAll(/#\s?(3|4|9|16)\b/g)].map(m => m[1]), ...NAMA_MODUL.filter(([kata]) => t.includes(kata)).map(([, no]) => no)])]
    if (kode.length >= 2) { Object.assign(s, { intent: "comparison", banding: { faskes: kode.slice(0, 3) }, faskes: null }); cocok = true }
    else if (mods.length >= 2) { Object.assign(s, { intent: "comparison", banding: { modul: mods.slice(0, 4) }, module: "all" }); cocok = true }
  }
  // Tidak ada cabang yang cocok DAN tidak menyebut domain sama sekali → tolak,
  // jangan dijawab dengan ringkasan wilayah default (penyebab jawaban seragam).
  if (!cocok && !KATA_DOMAIN.test(t)) {
    return { ...s, intent: "refusal", alasan: "luar_cakupan" }
  }
  // Yakin = pola cocok dan bukan pertanyaan penjelasan/perbandingan (kecuali tentang satu faskes).
  s._yakin = cocok && (!NARASI.test(t) || !!s.faskes || !!s.banding)
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
  const b = slot.banding ?? {}
  if (intent === "comparison" && b.modul) return b.modul.map((m: string) => ["ambil_indikator", { modul: modulSlug(m), wilayah: scop }] as [string, Record<string, any>])
  if (intent === "comparison" && b.faskes) return b.faskes.map((x: string) => ["jelaskan_temuan", { faskes: x }] as [string, Record<string, any>])
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
    const p: Array<[string, Record<string, any>]> = [["daftar_temuan", { wilayah: scop, modul: mod, status: "aktif", urut, jumlah: slot.tunggal || slot.tipe ? 20 : topN, sedikit: true }]]
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
  const resp = await model.chat.completions.create({ max_tokens: 4000, messages: [{ role: "system", content: SYSTEM_PROMPT }, ...msgs] as any })
  const out = ekstrakJson(resp.choices[0]?.message?.content ?? "")
  if (resp.choices[0]?.finish_reason === "length") out.terpotong = true
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

async function jalankanPipeline(msgs: Array<Record<string, any>>, halaman: string | undefined, model: Client | null, t: number): Promise<Record<string, any> | null> {
  const teks_q = ambilPertanyaan(msgs)
  if (!teks_q) return null
  if (RE_INDIVIDU.test(teks_q)) return { teks: TEMPLATE.G, angka: [], tautan: [], alat: [] }
  if (RE_VONIS.test(teks_q)) return { teks: TEMPLATE.C, angka: [], tautan: [], alat: [] }
  // Pola kode yang yakin melewati panggilan LLM pembaca maksud (hemat 2-4 dtk).
  const kabKeys = Object.keys((await store()).kab)
  const slotH = slotHeuristik(teks_q, halaman || "/", kabKeys)
  const slot = slotH._yakin ? { ...slotH, _asal: "heuristic" } : await ekstrakSlot(teks_q, halaman || "/", model)
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
  const narasi = NARASI.test(teks_q.toLowerCase()) && !(slot.faskes || slot.banding)
  const det = narasi ? null : await jawabDeterministik(slot, hasil, modulSlug(slot.module))
  if (det) {
    det.angka ??= []; det.tautan ??= []
    det.alat = hasil.map(([n]) => n)
    simpanKache(kunci, det)
    return det
  }
  if (!model) return null
  const pesan = pesanKomposisi(teks_q, slot, hasil)
  // Pertahankan hanya giliran terakhir (satu jawaban assistant terakhir + pesan
  // kini) agar model tidak meniru struktur/angka jawaban-jawaban lama. Pertanyaan
  // user yang belum terjawab di antaranya dibuang: kalau ikut, model menjawab
  // pertanyaan lama dan jawabannya tersimpan di kache dengan kunci pertanyaan baru.
  let idx_ais = -1
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "assistant") { idx_ais = i; break }
  const msgs_baru = [...(idx_ais >= 0 ? [msgs[idx_ais]] : []), { role: "user", content: pesan }]
  const sumber = kumpulkanAngka(hasil.map(([, r]) => r), teks_q)
  let jawaban = await komposisi(model, msgs_baru)
  let salah = periksaAngka(jawaban, sumber)
  if (salah.length) {
    const koreksi = `Angka berikut tidak ada di data: ${salah.join(", ")}. Tulis ulang jawaban dalam format JSON yang sama, salin setiap angka persis dari data di atas.`
    jawaban = await komposisi(model, [...msgs_baru, { role: "assistant", content: JSON.stringify(jawaban) }, { role: "user", content: koreksi }])
    salah = periksaAngka(jawaban, sumber)
  }
  if (salah.length) jawaban = jawabanDitahan(hasil, salah)
  jawaban.angka ??= []; jawaban.tautan ??= []
  jawaban.alat = hasil.map(([n]) => n)
  try { canari(String(jawaban.teks ?? ""), jawabanSebelumnya(msgs)) } catch { /* abaikan */ }
  if (!jawaban.ditahan && !jawaban.terpotong) simpanKache(kunci, jawaban)
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
  const awal = (await request.clone().json().catch(() => null)) as { messages?: Array<Record<string, any>> } | null
  if (Array.isArray(awal?.messages)) {
    const cepat = await jawabCepat(ambilPertanyaan(awal!.messages.filter(m => m && (m.role === "user" || m.role === "assistant"))))
    if (cepat) return Response.json(cepat)
  }
  if (!KEY()) {
    // Tanpa kunci: pertanyaan berstruktur tetap terjawab dari template kode.
    const msgs0 = (Array.isArray(awal?.messages) ? awal!.messages : [])
      .filter(m => m && m.content && (m.role === "user" || m.role === "assistant"))
      .map(m => ({ role: String(m.role), content: String(m.content) })).slice(-12)
    const h0 = msgs0.length ? await jalankanPipeline(msgs0, (awal as any)?.halaman, null, (await store()).t).catch(() => null) : null
    if (h0) return Response.json(h0)
    return Response.json({ detail: "SUMODOP_API_KEY belum diatur" }, { status: 503 })
  }
  const model = buatClient()
  const S = await store()
  try {
    const body = (await request.json().catch(() => null)) as { messages?: Array<Record<string, any>>; halaman?: string } | null
    const raw = body?.messages
    if (!Array.isArray(raw)) return Response.json({ detail: "body.messages wajib array" }, { status: 400 })
    // Peran dari klien dibatasi user/assistant: pesan "system" palsu tidak boleh menimpa SYSTEM_PROMPT.
    const msgs: Array<Record<string, any>> = raw
      .filter(m => m && m.content && (m.role === "user" || m.role === "assistant"))
      .map(m => ({ role: String(m.role ?? "user"), content: String(m.content ?? "") }))
      .slice(-12)
    if (body?.halaman && msgs.length) {
      msgs[msgs.length - 1] = { role: "user", content: msgs[msgs.length - 1].content + `\n\n(konteks: pengguna sedang membuka halaman ${body.halaman})` }
    }
    const awal_teks = ambilPertanyaan(msgs) || (msgs.length ? msgs[0].content : "")
    const log: string[] = []
    const hasilAlat: Array<[string, unknown]> = []
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
    msgs.unshift({ role: "system", content: SYSTEM_PROMPT })
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
            hasilAlat.push([tc.function.name, r])
            log.push(tc.function.name)
            hasil.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(r).slice(0, 60000) })
          }
          alat_menyala = true
          msgs.push({ role: "user", content: hasil })
          continue
        }
        const teks = seg.content ?? ""
        let out = ekstrakJson(teks)
        const salah = periksaAngka(out, kumpulkanAngka(hasilAlat.map(([, r]) => r), awal_teks))
        if (salah.length) out = jawabanDitahan(hasilAlat, salah)
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