import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:8000'
const OUT = process.env.SHOTS_DIR ?? 'shots-v14'
mkdirSync(OUT, { recursive: true })

const cadangan = JSON.parse(readFileSync('public/data/jawaban_cadangan.json', 'utf8'))

const MOCK = {
  teks: 'Berdasarkan seluruh modul di Kota Semarang, RS-31595 adalah yang paling perlu diperhatikan rupiah tertimbangnya paling besar. Selisih tertimbangnya tertinggi di kelasnya dan pita kepercayaan dari profil direkomendasikan untuk diperiksa manual oleh auditor.',
  angka: [
    { label: 'RS-31595', nilai: '1,461', satuan: '', sumber: 'severity' },
    { label: 'RS-31609', nilai: '1,386', satuan: '', sumber: 'severity' },
  ],
  sumber: 'modul #4 Severity & Upcoding',
  tautan: [{ label: 'Lihat profil RS-31595 →', url: '/faskes/31595' }],
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))
const TERAKHIR_VISIBLE = ".chat-log > :not(.turun):last-child"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })

await page.route('**/api/chat', async r => {
  await delay(2600)
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK) })
})
await page.route('**/data/jawaban_cadangan.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cadangan) }))

await page.goto(BASE + '/', { waitUntil: 'networkidle' })

// v1.5: pil "Tanya AI SIDAK" di kanan-atas → buka/tutup drawer
const pilTxt = ((await page.textContent('.ai-pil .ai-pil-txt')) ?? '').trim()
if (pilTxt !== 'Tanya AI SIDAK') throw new Error('label pil bukan "Tanya AI SIDAK": ' + pilTxt)
if ((await page.getAttribute('.ai-pil', 'aria-expanded')) !== 'false') throw new Error('aria-expanded awal bukan false')
if (await page.isVisible('#sidak-chat')) throw new Error('drawer terbuka sebelum dibuka')
const pilB = await page.locator('.ai-pil').boundingBox()
if (!pilB) throw new Error('pil tidak terbaca')
if (pilB.x + pilB.width > 1440 + 1) throw new Error('pil keluar viewport 1440')
await page.screenshot({ path: `${OUT}/00-topbar-pil.png` })
await page.click('.ai-pil')
await page.waitForSelector('#sidak-chat', { state: 'visible' })
if (!(await page.locator('.ai-pil').evaluate(el => el.classList.contains('aktif')))) throw new Error('pil tidak .aktif saat drawer terbuka')
if ((await page.getAttribute('.ai-pil', 'aria-expanded')) !== 'true') throw new Error('aria-expanded bukan true saat terbuka')
const colB = await page.locator('#sidak-chat').boundingBox()
if (!colB || colB.y < 55 || colB.width <= 0) throw new Error('drawer tidak di bawah topbar: y=' + colB?.y)
await page.screenshot({ path: `${OUT}/00-drawer-aktif.png` })
await page.click('.ai-pil')
await page.waitForSelector('#sidak-chat', { state: 'hidden' })
console.log('v1.5: pil kanan-atas → drawer turun dari bawah topbar; klik kedua menutup')

await page.keyboard.press('Control+J')
await page.waitForSelector('#sidak-chat', { state: 'visible' })
await page.keyboard.press('Control+J')
await page.waitForSelector('#sidak-chat', { state: 'hidden' })
await page.click('.top-search input')
await page.keyboard.type('RS-')
await page.keyboard.press('Control+J')
if (await page.isVisible('#sidak-chat')) throw new Error('Ctrl+J beraksi saat mengetik')
await page.keyboard.press('Escape')
console.log('v1.5: Ctrl+J membuka/menutup; diabaikan sementara mengetik')

await page.click('.ai-pil')
await page.waitForSelector('.chat-pok', { state: 'visible' })

const live = await page.getAttribute('.chat-log', 'aria-live')
if (live !== 'polite') throw new Error('aria-live bukan polite: ' + live)

await page.fill('.chat-in textarea', 'RS mana yang paling perlu diperhatikan di Semarang dan berapa rupiahnya?')
await page.click('.chat-in .btn.primary')

await delay(900)
const tut = await page.textContent('.skel-box .ai-tut')
if (!tut || !tut.includes('SIDAK sedang menganalisis')) throw new Error('THINKING tidak tampil: ' + tut)
await page.screenshot({ path: `${OUT}/01-tanyakan-thinking.png` })
console.log('(a) THINKING tampil', JSON.stringify(tut?.slice(0, 36)))

await page.waitForSelector('.chat-log .ai-jam', { timeout: 20000 })
await delay(300)
await page.screenshot({ path: `${OUT}/02-akhir-stream.png` })
if (/riwayat/i.test(await page.textContent('.chat-log') || '')) throw new Error('blok Riwayat di dalam stream')
console.log('(b) ujung stream = jawaban DONE, tanpa blok Riwayat')

await page.focus('.chat-head [aria-label="Riwayat percakapan"]')
if (!await page.evaluate(() => document.activeElement?.matches('[aria-label="Riwayat percakapan"]'))) throw new Error('tombol Riwayat tidak bisa difokus via Tab')
await page.click('.chat-head [aria-label="Riwayat percakapan"]')
await page.waitForSelector('.his-ovl')
await page.keyboard.press('Escape')
await page.waitForSelector('.his-ovl', { state: 'detached' })
if (!await page.isVisible('.chat-pok')) throw new Error('Esc ikut menutup drawer')
console.log('kb: Riwayat reachable via Tab; Esc menutup panel tanpa menutup drawer')

await page.click('.chat-head [aria-label="Riwayat percakapan"]')
await page.waitForSelector('.his-ovl')
await page.screenshot({ path: `${OUT}/03-riwayat-panel.png` })
await page.click('.his-item')
await page.waitForSelector('.his-ovl .his-detail .akpj table.t')
await page.screenshot({ path: `${OUT}/04-riwayat-detail.png` })
console.log('(c) panel riwayat: daftar + detail dengan tabel/komponen jawaban penuh')

await page.click('.his-back')
await page.waitForSelector('.his-ovl .his-item')
await page.click('.his-back')
await page.waitForSelector('.his-ovl', { state: 'detached' })

await page.route('**/api/chat', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
await page.fill('.chat-in textarea', 'Dari kabupaten mana pasien readmisi di Semarang paling banyak berasal?')
await page.click('.chat-in .btn.primary')
await page.waitForSelector('.chat-offline', { timeout: 15000 })
await page.waitForSelector('.chat-log .shelf-k', { timeout: 15000 })
await delay(300)
await page.screenshot({ path: `${OUT}/05-luring.png` })
console.log('(d) offline: banner amber + jawaban tersimpan menggantikan stream')

const page2 = await browser.newPage({ viewport: { width: 1280, height: 860 } })
await page2.route('**/api/chat', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
await page2.route('**/data/jawaban_cadangan.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cadangan) }))
await page2.goto(BASE + '/', { waitUntil: 'networkidle' })
await page2.click('.ai-pil')
await page2.fill('.chat-in textarea', 'Hitung total klaim katarak bulan lalu dalam tabel pivoting?')
await page2.click('.chat-in .btn.primary')
await page2.waitForSelector('.perr', { timeout: 15000 })
const akhir = await page2.textContent('.perr')
if (!/Coba lagi/.test(akhir || '')) throw new Error('kartu error tanpa tombol Coba lagi')
await page2.screenshot({ path: `${OUT}/06-error.png` })
await page2.click('.perr .btn')
await page2.waitForSelector('.skel-box', { timeout: 4000 })
console.log('error-path: gagal → kartu Coba lagi → retry masuk THINKING')

const page3 = await browser.newPage({ viewport: { width: 1280, height: 860 } })
await page3.route('**/api/chat', async r => { await delay(4000); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK) }) })
await page3.goto(BASE + '/', { waitUntil: 'networkidle' })
await page3.click('.ai-pil')
await page3.fill('.chat-in textarea', 'Apa tren readmisi terakhir?')
await page3.click('.chat-in .btn.primary')
await page3.waitForSelector('.skel-box', { timeout: 5000 })
await page3.click('.chat-in .btn.primary')
await page3.waitForFunction(() => document.querySelector('.ais .ai-jawab .hint')?.textContent?.includes('dihentikan'))
const akhir2 = await page3.textContent(TERAKHIR_VISIBLE)
if (!/dihentikan/.test(akhir2 || '')) throw new Error('STOPPED tidak jadi elemen terakhir')
console.log('stopped-path: Hentikan saat THINKING → marker "— dihentikan" jadi elemen terakhir')

// v1.5: coach mark menjangkar ke pil (di bawah-kanan), CTA membuka drawer
const page4 = await browser.newPage({ viewport: { width: 1280, height: 860 } })
await page4.goto(BASE + '/?demo=1', { waitUntil: 'networkidle' })
await page4.waitForSelector('.coach', { timeout: 6000 })
const coachB = await page4.locator('.coach').boundingBox()
const pilB4 = await page4.locator('.ai-pil').boundingBox()
if (!coachB || !pilB4) throw new Error('coach/pil tak terbaca')
if (coachB.y < pilB4.y || coachB.x > pilB4.x + 4) throw new Error('coach tidak di bawah-kanan pil')
await page4.screenshot({ path: `${OUT}/07-coach-pil.png` })
await page4.click('.coach .btn.primary')
await page4.waitForSelector('#sidak-chat', { state: 'visible' })
if (!(await page4.locator('.ai-pil').evaluate(el => el.classList.contains('aktif')))) throw new Error('CTA coach tidak membuka drawer aktif')
await page4.close()

// v1.5: di 1024px label pil tetap utuh dan di dalam layar
const page5 = await browser.newPage({ viewport: { width: 1024, height: 860 } })
await page5.goto(BASE + '/antrean', { waitUntil: 'networkidle' })
const teks5 = await page5.locator('.ai-pil .ai-pil-txt').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, show: getComputedStyle(el).display }))
if (teks5.show === 'none' || teks5.sw > teks5.cw + 1) throw new Error('label pil terpotong/sembunyi di 1024: ' + JSON.stringify(teks5))
const b5 = await page5.locator('.ai-pil').boundingBox()
if (!b5 || b5.x + b5.width > 1024 + 1) throw new Error('pil keluar viewport 1024')
await page5.screenshot({ path: `${OUT}/08-1024-pil.png` })
await page5.close()
console.log('v1.5: coach menjangkar ke pil; label pil utuh di 1024px')

await browser.close()
console.log('OK →', OUT)