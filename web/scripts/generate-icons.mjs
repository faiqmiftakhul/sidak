// SIDAK icon generator — jalankan: node scripts/generate-icons.mjs (dari folder web/)
// Input : assets/sidak-logo.png — master 1024², transparan. Master itu diturunkan dari
//         ../sidak-logo.png oleh scripts/bersihkan-logo.py (buang halo, opakkan lensa, crop).
// Output: public/favicon.ico, favicon.svg, favicon-16/32/48/96.png, apple 180, android 192/512,
//         maskable 512, site.webmanifest.
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { writeFile, mkdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MASTER = join(ROOT, 'assets', 'sidak-logo.png')
const PUB = join(ROOT, 'public')

// Logo berwarna penuh (kros teal + kaca pembesar biru), jadi tile opak memakai dasar putih:
// dasar teal akan menelan kros yang juga teal.
const TILE = { r: 255, g: 255, b: 255 }

// Kuantisasi 256 warna: berkas jauh lebih ringan, gradasi teal masih mulus pada ukuran ikon.
const PNG = { compressionLevel: 9, effort: 10, palette: true, quality: 92 }

// Master sudah punya margin 4%. Untuk ukuran kecil margin itu dipangkas supaya siluet
// mengisi kanvas dan tetap terbaca di 16–48 px.
async function mark(size, { trim = false } = {}) {
  let s = sharp(MASTER)
  if (trim) s = s.trim({ threshold: 1 })
  return s.resize(size, size, { fit: 'contain', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png(PNG).toBuffer()
}

async function tile({ size, artPx }) {
  const base = await sharp({ create: { width: size, height: size, channels: 3, background: TILE } }).png().toBuffer()
  const art = await mark(Math.round(artPx), { trim: true })
  return sharp(base).composite([{ input: art, gravity: 'center', blend: 'over' }]).removeAlpha().png(PNG).toBuffer()
}

await mkdir(PUB, { recursive: true })

const p16 = await mark(16, { trim: true })
const p32 = await mark(32, { trim: true })
const p48 = await mark(48, { trim: true })
await writeFile(join(PUB, 'favicon-16x16.png'), p16)
await writeFile(join(PUB, 'favicon-32x32.png'), p32)
await writeFile(join(PUB, 'favicon-48x48.png'), p48)
await writeFile(join(PUB, 'favicon.ico'), await pngToIco([p16, p32, p48]))

await writeFile(join(PUB, 'favicon-96x96.png'), await mark(96, { trim: true }))
await writeFile(join(PUB, 'android-chrome-192x192.png'), await mark(192))
await writeFile(join(PUB, 'android-chrome-512x512.png'), await mark(512))

// favicon.svg: logo raster, jadi SVG hanya pembungkus PNG 192 px supaya tautan
// <link type="image/svg+xml"> di index.html tetap sahih dan tajam di layar HiDPI.
const b64 = (await mark(96, { trim: true })).toString('base64')
await writeFile(join(PUB, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">` +
  `<image href="data:image/png;base64,${b64}" width="96" height="96"/></svg>\n`)

// apple 180: tile OPAK (iOS tidak menghormati transparansi), mark ~80% area.
await writeFile(join(PUB, 'apple-touch-icon.png'), await tile({ size: 180, artPx: 144 }))

// maskable 512: full-bleed, artwork muat dalam lingkaran aman 80% (diameter 410),
// yaitu sisi terpanjang <= 410/sqrt(2) ~ 290.
await writeFile(join(PUB, 'maskable-icon-512x512.png'), await tile({ size: 512, artPx: 410 / Math.sqrt(2) }))

await writeFile(join(PUB, 'site.webmanifest'), JSON.stringify({
  name: 'SIDAK · Kota Semarang',
  short_name: 'SIDAK',
  description: 'Sistem deteksi anomali klaim JKN — demo Kota Semarang',
  lang: 'id',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#0E7490',
  icons: [
    { src: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n')

// Verifikasi: tile harus OPAK.
for (const f of ['apple-touch-icon.png', 'maskable-icon-512x512.png']) {
  const m = await sharp(join(PUB, f)).metadata()
  if (m.hasAlpha !== false || m.channels !== 3) throw new Error(`${f} tidak opak!`)
}

console.log('OK — ikon ditulis ke public/:')
for (const f of ['favicon.ico', 'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'favicon-96x96.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'maskable-icon-512x512.png', 'site.webmanifest']) {
  const p = join(PUB, f)
  let info = ''
  try { const m = await sharp(p).metadata(); info = `${m.width}x${m.height}` } catch { info = 'any' }
  const s = await stat(p)
  console.log(`  ${f}  ${info}  ${(s.size / 1024).toFixed(1)} kB`)
}
