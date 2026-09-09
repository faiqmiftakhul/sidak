// Audit tata letak SIDAK (Playwright).
// Menjalankan pompa matriks rute × lebar, memeriksa:
//   a) luapan horizontal (scrollWidth > clientWidth tanpa wadah scroll)
//   b) elemen nyata menyeberang tepi kiri/kanan viewport
//   c) ikon pencarian menimpa area teks kolom input navbar
//   d) topbar muat tanpa luapan dan pil "Tanya AI SIDAK" utuh di 1024–1920px
//   e) kontrol sentuh ≥ 44px
//   tangkapan layar penuh halaman ke direktori tangkapan
// Keluar dengan kode 1 bila ada temuan → mudah dipasang sebagai gerbang CI.
//
// Pemakaian:
//   node scripts/audit-layout.mjs [--shots-dir <dir>] [--shots-only] [--base <url>]
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.AUDIT_BASE || 'http://localhost:8000'
const SHOTS = process.argv.includes('--shots-dir') ? process.argv[process.argv.indexOf('--shots-dir') + 1] : 'shots'
const SHOTS_ONLY = process.argv.includes('--shots-only')
const HEIGHT = 860

const ROUTES = [
  ['ringkasan', '/'],
  ['peta', '/peta'],
  ['modul-readmisi', '/modul/readmisi'],
  ['antrean', '/antrean'],
  ['profil-fktp', '/faskes/FKTP-11649'],
]
const WIDTHS = [1920, 1440, 1280, 1024]

function short(el) {
  const r = el.getBoundingClientRect()
  return `${el.tagName.toLowerCase()}.${String(el.className ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.') || '_'}`
}

async function auditHalaman(page, vw) {
  const findings = []

  const { pesan: pesan0, overflow, tepi, cari, sentuh } = await page.evaluate((w) => {
    const vw = w
    const semua = [...document.querySelectorAll('body *')]
    const terlihat = (el) => {
      const s = getComputedStyle(el)
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const adaLeluhur = (el, sel) => {
      let n = el
      while (n && n !== document.body) { if (n.matches && n.matches(sel)) return true; n = n.parentElement }
      return false
    }
    // terlindung oleh pemotong horizontal (kotak gulir / overflow hidden) di atasnya?
    const adaPemotong = (el) => {
      let n = el.parentElement
      while (n && n !== document.body) {
        const ovx = getComputedStyle(n).overflowX
        if (ovx === 'auto' || ovx === 'scroll' || ovx === 'hidden') return true
        n = n.parentElement
      }
      return false
    }
    const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className ?? '').split(/\s+/).filter(Boolean).slice(0, 2).join('.') || '_'}`

    // a0) halaman itu sendiri bergulir horizontal → bocor paling nyata
    const pesan = document.documentElement.scrollWidth > window.innerWidth + 1
      ? `A0 halaman scrollWidth=${document.documentElement.scrollWidth} vs innerWidth=${window.innerWidth}`
      : null

    // a) luapan horizontal keluar tanpa wadah scroll/pemotong
    const overflow = []
    for (const el of semua) {
      if (!terlihat(el)) continue
      if (el.scrollWidth <= el.clientWidth + 2) continue
      const ov = getComputedStyle(el).overflowX
      if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') continue
      if (el.closest('[data-scroll="ok"]')) continue
      if (adaPemotong(el)) continue
      if (el.tagName === 'BODY' || el.tagName === 'HTML') continue
      overflow.push(`${label(el)} scrollW=${el.scrollWidth} clientW=${el.clientWidth}`)
    }

    // b) menyeberang tepi kiri/kanan viewport (bukan kartu full-bleed/gambar anonim)
    const tepi = []
    for (const el of semua) {
      if (!terlihat(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.left >= vw || r.right <= 0) continue // sepenuhnya di luar layar → bukan bocor
      if (el.closest('[data-fullbleed]')) continue
      if (adaLeluhur(el, '[aria-hidden="true"]')) continue
      if (adaPemotong(el)) continue
      if (r.left < -1) tepi.push(`${label(el)} kiri=${Math.round(r.left)}`)
      else if (r.right > vw + 1) tepi.push(`${label(el)} kanan=${Math.round(r.right)} (vw=${vw})`)
    }
    // d) topbar muat; pil AI utuh — diperiksa di evaluate terpisah (liat auditTopbar)

    // c) benang ikon vs area teks kolom pencarian
    const cari = []
    const pasangan = [
      ['.top-search > svg', '.top-search input'],
      ['.cari > svg', '.cari input'],
    ]
    for (const [selIkon, selInput] of pasangan) {
      const ikon = document.querySelector(selIkon)
      const input = document.querySelector(selInput)
      if (!ikon || !input) continue
      const a = ikon.getBoundingClientRect(), b = input.getBoundingClientRect()
      const tabrak = a.left < b.right && a.right > b.left
      if (tabrak) cari.push(`${selIkon} ∩ ${selInput} : s=[${Math.round(a.left)}..${Math.round(a.right)}] i=[${Math.round(b.left)}..${Math.round(b.right)}]`)
    }

    // e) jarak sentuh: kontrol audit (stepper progres, tombol rail, aksi profil) ≥ 44px
    const sentuh = []
    for (const sel of ['.step button', '.aular .rail-cta', '.profil-top .btn']) {
      for (const el of document.querySelectorAll(sel)) {
        if (!terlihat(el)) continue
        const r = el.getBoundingClientRect()
        if (r.width < 43 || r.height < 43) sentuh.push(`${sel} ${r.width.toFixed(0)}x${r.height.toFixed(0)}px`)
      }
    }

    return { pesan, overflow, tepi, cari, sentuh }
  }, vw)

  const topbar = []
  try {
    const pil = page.locator('.ai-pil')
    const n = await pil.count()
    if (n === 0) {
      topbar.push('ai-pil tidak ditemukan di topbar')
    } else {
      const box = await pil.first().boundingBox()
      if (box) {
        if (box.x + box.width > vw + 1) topbar.push(`ai-pil kanan=${Math.round(box.x + box.width)} (vw=${vw})`)
        if (box.width < 36) topbar.push(`ai-pil menghilang w=${Math.round(box.width)}`)
      }
      const terpotong = await pil.locator('.ai-pil-txt').evaluate((el) => el.scrollWidth > el.clientWidth + 1)
      if (terpotong) topbar.push('ai-pil label terpotong')
      const bar = await page.locator('.topbar').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
      if (bar && bar.sw > bar.cw + 1) topbar.push(`topbar scrollW=${bar.sw} clientW=${bar.cw}`)
    }
  } catch { topbar.push('gagal membaca topbar AI') }

  if (!SHOTS_ONLY) {
    if (pesan0) findings.push(`[A0 halaman] ${pesan0}`)
    overflow.forEach(m => findings.push(`[A luapan] ${m}`))
    tepi.forEach(m => findings.push(`[B tepi] ${m}`))
    cari.forEach(m => findings.push(`[C ikon] ${m}`))
    topbar.forEach(m => findings.push(`[D topbar] ${m}`))
    sentuh.forEach(m => findings.push(`[E sentuh] ${m}`))
  }
  return findings
}

async function main() {
  const dir = path.resolve(process.cwd(), SHOTS)
  await mkdir(dir, { recursive: true })
  const browser = await chromium.launch()
  const semua = []
  let total = 0

  for (const [nama, rute] of ROUTES) {
    for (const vw of WIDTHS) {
      const page = await browser.newPage({ viewport: { width: vw, height: HEIGHT }, deviceScaleFactor: 1 })
      const dua = vw === 1024 ? 2 : 1
      await page.goto(BASE + rute, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForTimeout(500 * dua)
      const temuan = await auditHalaman(page, vw)
      const label = `${nama} @${vw}`
      if (temuan.length) {
        total += temuan.length
        semua.push(`\n== ${label} ==\n` + temuan.join('\n'))
      } else {
        semua.push(`ok  ${label}`)
      }
      await page.screenshot({ path: path.join(dir, `${nama}-${vw}.png`), fullPage: false })
      await page.close()
    }
  }

  await browser.close()

  if (!SHOTS_ONLY) console.log(semua.join('\n'))
  console.log(`tangkap layar → ${dir}/`)
  if (SHOTS_ONLY) { console.log('mode tangkap-saja: tanpa pemeriksaan.'); return }
  if (total > 0) {
    console.log(`\nTIDAK LOLOS: ${total} temuan tata letak.`)
    process.exit(1)
  }
  console.log('LOLOS: tidak ada luapan (A), menyeberang tepi (B), tabrakan ikon pencarian (C), topbar yang tidak muat (D), atau kontrol sentuh < 44px (E).')
}

if (!existsSync(path.resolve(process.cwd(), 'package.json')))
  throw new Error('Jalankan dari direktori web/ (web/package.json).')
main().catch(e => { console.error(e); process.exit(2) })