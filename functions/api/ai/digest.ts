// Port 1:1 /api/ai/digest dari api/main.py → Cloudflare Pages Function.
// LLM bila ada kunci; selalu ada fallback deterministik (sama persis antarmuka).

import { NOMOR, NAMA, KOTA, rp, inisialisasi, store, wilayahFaskes } from "../../lib/data"
import { buatClient, ekstrakJson, NASKH_DIGEST, KEY, type Client } from "../../lib/llm"

const _g = globalThis as any
const KACHE_DIGEST = new Map<string, { generated_at: number; data_version: string; deterministik: boolean; insights: unknown[] }>()
const DIGEST_MAX = 16

const labelWilayah = (w: string): string => {
  if (w === KOTA) return "Kota Semarang"
  if (w === "JAWA TENGAH") return "Jawa Tengah"
  return w.toLowerCase().split(" ").map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(" ")
}

async function faktaDigest(scope: string): Promise<Record<string, unknown>> {
  const { fs, wil } = await wilayahFaskes(scope)
  const S = await store()
  const per: Record<string, unknown> = {}
  for (const m of Object.keys(NOMOR)) {
    const sub = fs.filter(f => f.modul[m] && f.modul[m].status !== "volume_rendah")
    per[m] = {
      nomor: NOMOR[m], nama: NAMA[m],
      faskes_perlu_perhatian: sub.filter(f => f.modul[m].status === "perhatian").length,
      selisih_rupiah_tertimbang: sub.reduce((s, f) => s + (f.modul[m].status === "perhatian" || f.modul[m].status === "diamati" ? f.modul[m].rupiah_tertimbang : 0), 0),
    }
  }
  const kandidat = []
  for (const f of fs) {
    for (const [k, h] of Object.entries(f.modul)) {
      if (h.status === "perhatian" && h.OE != null)
        kandidat.push({ faskes: f.label, id: f.id, kelas: f.kelas_pendek, modul: NAMA[k], OE: h.OE, selisih_rupiah_tertimbang: h.rupiah_tertimbang, tautan: "/faskes/" + f.id })
    }
  }
  kandidat.sort((x, y) => y.selisih_rupiah_tertimbang - x.selisih_rupiah_tertimbang)
  return {
    wilayah: wil, periode: S.ring.periode,
    jumlah_faskes: fs.length,
    faskes_fkrtl: fs.filter(f => f.tipe === "FKRTL").length,
    faskes_fktp: fs.filter(f => f.tipe === "FKTP").length,
    faskes_perlu_perhatian: fs.filter(f => Object.values(f.modul).some(h => h.status === "perhatian")).length,
    selisih_rupiah_sampel: fs.reduce((s, f) => s + f.rupiah, 0),
    selisih_rupiah_tertimbang: fs.reduce((s, f) => s + f.rupiah_tertimbang, 0),
    per_modul: per, faskes_paling_menonjol: kandidat.slice(0, 5),
    tautan_pilihan: ["/antrean", "/peta", "/metodologi"].concat(Object.keys(NOMOR).map(m => "/modul/" + m)),
  }
}

async function digestDeterministik(scope: string): Promise<unknown[]> {
  const { fs, wil } = await wilayahFaskes(scope)
  const lwil = labelWilayah(wil)
  const total_tbg = fs.reduce((s, f) => s + f.rupiah_tertimbang, 0)
  const n_perhatian = fs.filter(f => Object.values(f.modul).some(h => h.status === "perhatian")).length
  const mods: Array<{ m: string; tbg: number; per: number; OE: number | null }> = []
  for (const m of Object.keys(NOMOR)) {
    const sub = fs.filter(f => f.modul[m] && f.modul[m].status !== "volume_rendah")
    const tbg = sub.reduce((s, f) => s + (f.modul[m].status === "perhatian" || f.modul[m].status === "diamati" ? f.modul[m].rupiah_tertimbang : 0), 0)
    const per = sub.filter(f => f.modul[m].status === "perhatian").length
    const O = sub.reduce((s, f) => s + f.modul[m].O, 0)
    const E = sub.reduce((s, f) => s + f.modul[m].E, 0)
    mods.push({ m, tbg, per, OE: E ? O / E : null })
  }
  mods.sort((x, y) => y.tbg - x.tbg)
  let best: { f: any; k: string; h: any } | null = null
  for (const f of fs) {
    for (const [k, h] of Object.entries(f.modul)) {
      if (h.status === "perhatian" && h.OE && (!best || h.rupiah_tertimbang > best.h.rupiah_tertimbang))
        best = { f, k, h }
    }
  }
  const ins: unknown[] = []
  const top = mods[0]
  if (top && top.tbg > 0) {
    ins.push({
      id: "modul-teratas", module: top.m, scope: wil,
      text: `Dampak terbesar kini dari modul #${NOMOR[top.m]} ${NAMA[top.m]}.`,
      isi: `Menyumbang ${rp(top.tbg)} dari selisih tertimbang ${lwil} — prioritas tertinggi untuk audit.`,
      link: "/modul/" + top.m,
    })
  }
  if (best) {
    const { f, k, h } = best
    ins.push({
      id: "faskes-teratas", module: k, scope: wil,
      text: `${f.label} mencatat O/E ${String(Math.round(h.OE * 100) / 100).replace(".", ",")} pada modul #${NOMOR[k]} — tertinggi di antara faskes perlu perhatian.`,
      isi: `Selisih tertimbang ${rp(h.rupiah_tertimbang)} — kandidat pertama untuk verifikasi klaim.`,
      link: "/faskes/" + f.id,
    })
  }
  if (fs.length) {
    ins.push({
      id: "cakupan", module: "all", scope: wil,
      text: `${n_perhatian} faskes berstatus Perlu perhatian dari ${fs.length} di ${lwil}.`,
      isi: `Selisih tertimbang keseluruhan ${rp(total_tbg)} · urutan prioritas ada di antrean audit.`,
      link: "/antrean",
    })
  }
  return ins.slice(0, 3)
}

async function digestAi(scope: string, model: Client | null): Promise<unknown[] | null> {
  if (!model) return null
  const fakta = await faktaDigest(scope)
  const r = await model.chat.completions.create({
    temperature: 0, max_tokens: 700,
    messages: [{ role: "user", content: NASKH_DIGEST.replace("%s", JSON.stringify(fakta)) }],
  })
  const j = ekstrakJson(r.choices[0]?.message?.content ?? "")
  const arr = j && Array.isArray(j.insights) ? j.insights : (Array.isArray(j) ? j : null)
  if (!arr) return null
  const out: unknown[] = []
  for (let i = 0; i < arr.length; i++) {
    const g = arr[i]
    if (!g || typeof g !== "object") continue
    const r2 = g as Record<string, any>
    const teks = String(r2.text ?? "").trim()
    const link = String(r2.link ?? "").trim()
    const mod = String(r2.module ?? "all")
    if (!teks || !link.startsWith("/") || (!(mod in NOMOR) && mod !== "all") || teks.length > 120) continue
    out.push({ id: "ai-" + i, module: mod, scope: String(r2.scope ?? ""), text: teks, isi: String(r2.isi ?? "").trim() || null, link })
  }
  return out.slice(0, 3).length ? out.slice(0, 3) : null
}

export async function onRequest(context: { request: Request; env: Record<string, string | undefined> }): Promise<Response> {
  const { request, env } = context
  _g.SUMODOP_API_KEY = env.SUMODOP_API_KEY
  _g.SUMODOP_BASE_URL = env.SUMODOP_BASE_URL
  _g.SIDAK_MODEL = env.SIDAK_MODEL
  inisialisasi(request, env)
  const S = await store()
  const url = new URL(request.url)
  const scope = url.searchParams.get("scope") ?? KOTA
  const kunci = scope.trim().toUpperCase()
  const cache = KACHE_DIGEST.get(kunci)
  if (cache) return Response.json(cache)
  const model = KEY() ? (() => { try { return buatClient() } catch { return null } })() : null
  let ins: unknown[] | null = null
  try { ins = await digestAi(scope, model) } catch { ins = null }
  const det = ins === null
  if (det) ins = await digestDeterministik(scope)
  const res = { generated_at: Math.round(Date.now() / 1000 * 100) / 100, data_version: S.dv, deterministik: det, insights: ins ?? [] }
  if (KACHE_DIGEST.size >= DIGEST_MAX) KACHE_DIGEST.clear()
  KACHE_DIGEST.set(kunci, res)
  return Response.json(res)
}