// SIDAK icon generator — jalankan sekali: node scripts/generate-icons.mjs (dari folder web/)
// Input : assets/icon-full.svg (FULL mark, transparan), assets/icon-full-white.svg (varian dot putih
//         untuk tile), assets/icon-simple-raster.svg (SIMPLE mark, warna terang tetap untuk PNG/ICO).
// Output: public/favicon.ico, favicon.svg, favicon-16/32/48/96.png, apple 180, android 192/512,
//         maskable 512, site.webmanifest.
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const FULL = join(ASSETS, 'icon-full.svg')
const FULL_WHITE = join(ASSETS, 'icon-full-white.svg')
const SIMPLE = join(ASSETS, 'icon-simple-raster.svg')

const TEAL = { r: 14, g: 116, b: 144 } // #0E7490

// Rasterisasi SVG dengan densitas tinggi lalu diturunkan (lanczos) agar tepi tegas.
async function raster(svg, { w, h }) {
  const big = await sharp(await readFile(svg), { density: 300 })
    .resize(w * 3, h * 3, { fit: 'contain', kernel: 'lanczos3' })
    .png()
    .toBuffer()
  return sharp(big).resize(w, h, { fit: 'contain', kernel: 'lanczos3' }).png().toBuffer()
}

async function tile({ size, artPx, sourceFullWhite = FULL_WHITE }) {
  const base = await sharp({ create: { width: size, height: size, channels: 3, background: TEAL } })
    .png()
    .toBuffer()
  const h = Math.round(artPx * (171 / 178))
  const art = await raster(sourceFullWhite, { w: Math.round(artPx), h })
  return sharp(base).composite([{ input: art, gravity: 'center', blend: 'over' }]).removeAlpha().png().toBuffer()
}

await mkdir(PUB, { recursive: true })

const faviconSvg = await readFile(join(ASSETS, 'icon-full.svg'))
await writeFile(join(PUB, 'favicon.svg'), faviconSvg)

const simple16 = await raster(SIMPLE, { w: 16, h: 16 })
const simple32 = await raster(SIMPLE, { w: 32, h: 32 })
const simple48 = await raster(SIMPLE, { w: 48, h: 48 })
await writeFile(join(PUB, 'favicon-16x16.png'), simple16)
await writeFile(join(PUB, 'favicon-32x32.png'), simple32)
await writeFile(join(PUB, 'favicon.ico'), await pngToIco([simple16, simple32, simple48]))

await writeFile(join(PUB, 'favicon-48x48.png'), await raster(FULL, { w: 48, h: 48 }))
await writeFile(join(PUB, 'favicon-96x96.png'), await raster(FULL, { w: 96, h: 96 }))
await writeFile(join(PUB, 'android-chrome-192x192.png'), await raster(FULL, { w: 192, h: 192 }))
await writeFile(join(PUB, 'android-chrome-512x512.png'), await raster(FULL, { w: 512, h: 512 }))

// apple 180: tile teal OPAK, mark putih ~10% padding (80% area).
await writeFile(join(PUB, 'apple-touch-icon.png'), await tile({ size: 180, artPx: 144 }))

// maskable 512: full-bleed teal, artwork muat dalam lingkaran aman 80% (utama-tengah, diameter 410),
// yaitu sisi terpanjang <= 410/sqrt(2) ~ 290.
const SAFE = 410 / Math.sqrt(2)
await writeFile(join(PUB, 'maskable-icon-512x512.png'), await tile({ size: 512, artPx: SAFE }))

// Verifikasi: tile harus OPAK.
for (const f of ['apple-touch-icon.png', 'maskable-icon-512x512.png']) {
  const m = await sharp(join(PUB, f)).metadata()
  if (m.hasAlpha !== false || m.channels !== 3) throw new Error(`${f} tidak opak!`)
}

console.log('OK — ikon ditulis ke public/:')
for (const f of ['favicon.ico', 'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'favicon-96x96.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'maskable-icon-512x512.png']) {
  const p = join(PUB, f)
  let info = ''
  try {
    const m = await sharp(p).metadata()
    info = `${m.width}x${m.height}`
  } catch { info = 'any' }
  const s = await stat(p)
  console.log(`  ${f}  ${info}  ${(s.size / 1024).toFixed(1)} kB`)
}