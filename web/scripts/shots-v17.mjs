import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = process.env.SHOTS_DIR ?? 'shots-v17'
mkdirSync(OUT, { recursive: true })

const MOCK_DIGEST = { insights: [] }
const delay = (ms) => new Promise(r => setTimeout(r, ms))
const browser = await chromium.launch()
const OUT_VIEW = { width: 1440, height: 900 }

async function buka(view = OUT_VIEW) {
  const page = await browser.newPage({ viewport: view })
  await page.route('**/api/ai/digest*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DIGEST) }))
  await page.route('**/api/chat', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  return page
}

function cek(b, msg) { if (!b) throw new Error('PALING: ' + msg); console.log('ok', msg) }

// 1 — Rumah 1440: baris KPI semantik
let p = await buka()
await p.goto(BASE + '/', { waitUntil: 'networkidle' })
cek((await p.locator('.kpi-card').count()) === 4, 'rumah: 4 kpi-card')
cek((await p.locator('.kpi-card .kpi-chip').count()) === 4, 'rumah: setiap kpi-card punya chip')
const chipBg = await p.locator('.kpi-card').first().locator('.kpi-chip').evaluate(el => getComputedStyle(el).backgroundColor)
if (chipBg === 'rgb(255, 255, 255)') throw new Error('PALING: chip attention tidak bertingkat warna: ' + chipBg)
await p.screenshot({ path: `${OUT}/01-rumah.png` })

// 2 — Rumah: kartu per-modul putih + mini O/E bar
await p.locator('h2', { hasText: 'Per modul' }).scrollIntoViewIfNeeded()
await delay(300)
cek((await p.locator('.modkart').count()) === 4, 'rumah: 4 kartu modul')
cek((await p.locator('.oe-mini').count()) === 4, 'rumah: mini O/E bar di 4 kartu modul')
const modBorder = await p.locator('.modkart').first().evaluate(el => getComputedStyle(el).borderTopWidth + ' ' + getComputedStyle(el).borderTopColor)
if (modBorder.includes('4px')) throw new Error('PALING: kartu modul masih border-top berwarna: ' + modBorder)
await p.screenshot({ path: `${OUT}/02-permodul.png` })
await p.close()

// 3 — Modul readmisi: KpiCard + pill status O/E
p = await buka()
await p.goto(BASE + '/modul/readmisi', { waitUntil: 'networkidle' })
cek((await p.locator('.kpi-card').count()) === 4, 'modul: 4 kpi-card')
const oeCard = p.locator('.kpi-card', { has: p.locator('.kpi-label', { hasText: 'O/E kota' }) })
cek((await oeCard.locator('.kpi-pill').count()) === 1, 'modul: kartu O/E kota punya pill status')
cek((await oeCard.locator('.kpi-spark').count()) === 1, 'modul: kartu O/E kota punya sparkline')
await p.screenshot({ path: `${OUT}/03-modul.png` })

// 4 — Profil FKTP/RS: chip sm
await p.goto(BASE + '/faskes/31595', { waitUntil: 'networkidle' })
cek((await p.locator('.kpi-card.sm').count()) === 4, 'profil: 4 chip metrik sm')
await p.screenshot({ path: `${OUT}/04-profil.png` })
await p.close()

// 5 — Antrean dengan filter: chip aktif + hasil + CSV (n)
const CHIP_SEL = 'st=perhatian&mod=readmisi'
p = await buka()
await p.goto(BASE + '/antrean?' + CHIP_SEL, { waitUntil: 'networkidle' })
await delay(300)
const chipN = await p.locator('.fchips .fchip').count()
cek(chipN >= 2, 'antrean: chip aktif tampil (ada Status + Modul), n=' + chipN)
cek((await p.locator('.fhasil').textContent().then(t => t ?? '').then(t => /faskes cocok/.test(t))), 'antrean: hasil filter aria-live tampil')
const csv = await p.locator('button', { hasText: /Ekspor CSV \(\d/ }).count()
cek(csv === 1, 'antrean: tombol Ekspor CSV (n)')
cek((await p.locator('.fsel').count()) === 2, 'antrean: dropdown status & modul di rail')
await p.screenshot({ path: `${OUT}/05-antrean-chip.png` })
await p.close()

// 6 — Antrean default: tanpa chip
p = await buka()
await p.goto(BASE + '/antrean', { waitUntil: 'networkidle' })
await delay(300)
cek((await p.locator('.fchips .fchip').count()) === 0, 'antrean default: tanpa baris chip')
await p.screenshot({ path: `${OUT}/06-antrean-default.png` })
await p.close()

// 7 & 8 — 1024px
p = await buka({ width: 1024, height: 820 })
await p.goto(BASE + '/modul/readmisi', { waitUntil: 'networkidle' })
await p.screenshot({ path: `${OUT}/07-modul-1024.png` })
await p.goto(BASE + '/antrean?' + CHIP_SEL, { waitUntil: 'networkidle' })
await delay(300)
cek((await p.locator('.fchip').count()) >= 2, 'antrean 1024: chip aktif tetap tampil')
await p.screenshot({ path: `${OUT}/08-antrean-1024.png` })
await p.close()

await browser.close()
console.log('OK →', OUT)