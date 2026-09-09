#!/usr/bin/env node
// Smoke-test Cloudflare Pages Functions vs kontrak frontend (tanpa npm deps).
// Pakai:  node scripts/smoke-deploy.mjs --base http://localhost:8788 [--golden /tmp/sidak-golden]
// Keluar 0 bila semua asersi struktur lolos.

const args = process.argv.slice(2)
const base = (args[args.indexOf("--base") + 1] || "http://localhost:8788").replace(/\/+$/, "")
const goldenDir = args.indexOf("--golden") >= 0 ? args[args.indexOf("--golden") + 1] : null

let pass = 0, fail = 0
const catat = (nama, ok, info = "") => {
  if (ok) { pass++; console.log(`PASS  ${nama}${info ? "  · " + info : ""}`) }
  else { fail++; console.log(`FAIL  ${nama}  · ${info}`) }
}

const j = async (path, opts) => {
  const r = await fetch(base + path, opts)
  const body = await r.json().catch(() => null)
  return { status: r.status, body }
}

const fs = await import("node:fs")
const jsonFile = (p) => JSON.parse(fs.readFileSync(goldenDir + "/" + p, "utf8"))

const main = async () => {
  console.log(`base: ${base}${goldenDir ? "  · golden: " + goldenDir : ""}\n`)

  // 1) sehat
  const sehat = await j("/api/sehat")
  catat("GET /api/sehat", sehat.status === 200 && sehat.body?.ok === true && sehat.body.faskes > 0,
    `faskes=${sehat.body?.faskes} asisten=${sehat.body?.asisten}`)

  // 2) alat
  const trend = await j("/api/alat/trend?modul=readmisi")
  catat("GET /api/alat/trend?modul=readmisi",
    trend.status === 200 && Array.isArray(trend.body?.modul?.readmisi) && trend.body.modul.readmisi.length > 0,
    `${trend.body?.modul?.readmisi?.length ?? 0} bulan`)
  const daftar = await j("/api/alat/daftar_temuan?sedikit=true&jumlah=2")
  catat("GET /api/alat/daftar_temuan?sedikit=true&jumlah=2",
    daftar.status === 200 && Array.isArray(daftar.body?.temuan) && daftar.body.temuan.length >= 1,
    `${daftar.body?.jumlah_temuan ?? "?"} temuan`)
  const al = await j("/api/alat/jelaskan_temuan?faskes=RS-31595")
  catat("GET /api/alat/jelaskan_temuan?faskes=RS-31595",
    al.status === 200 && Array.isArray(Object.keys(al.body?.modul ?? {})) && Object.keys(al.body?.modul ?? {}).length >= 1,
    `modul=${Object.keys(al.body?.modul ?? {}).join(",")}`)

  // 3) digest
  const digest = await j("/api/ai/digest?scope=KOTA%20SEMARANG")
  catat("GET /api/ai/digest",
    digest.status === 200 && Array.isArray(digest.body?.insights) && digest.body.insights.length >= 1,
    `deterministik=${digest.body?.deterministik} kartu=${digest.body?.insights?.length ?? 0} dv=${digest.body?.data_version}`)

  // 4) SPA fallback
  const spa = await fetch(base + "/antrean")
  const spaText = await spa.text()
  catat("GET /antrean (SPA)", spa.status === 200 && /<div id="root">/.test(spaText), spa.status + "")

  // 5) golden diff (informasional)
  if (goldenDir) {
    try {
      const gold = await jsonFile("trend.json")
      const sama = JSON.stringify(gold) === JSON.stringify(trend.body)
      catat("golden trend.json", sama, sama ? "identik" : "berbeda (informasional)")
    } catch {
      console.log("SKIP  golden trend.json (belum direkam)")
    }
  }

  // 6) chat  (informasional; tanpa key harus 503)
  const chat = await j("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "berapa jumlah RS di Semarang" }], halaman: "/" }) })
  console.log(`INFO  POST /api/chat -> ${chat.status}${chat.body?.teks ? ` · ${String(chat.body.teks).slice(0, 60)}` : ""}${chat.body?.detail ? ` · ${chat.body.detail}` : ""}`)

  console.log(`\n${pass} PASS, ${fail} FAIL`)
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })