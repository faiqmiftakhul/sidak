// Port periksa_angka/kumpulkan_angka dari api/main.py.
// Angka di jawaban model wajib ada di hasil alat. Bilangan bulat kecil, tahun,
// dan kode (RS-31595, #4, J-4-14) tidak diperiksa.

const RE_ANGKA = /(?<![\w\-#/.,])(Rp\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(\s?(?:juta|jt|miliar|M|triliun|T|%))?(?![\w\-])/g
const KALI: Record<string, number> = { jt: 1e6, juta: 1e6, M: 1e9, miliar: 1e9, T: 1e12, triliun: 1e12 }
const KONSTANTA = [0, 1, 1.05, 1.2, 1.96, 7, 30, 100]

const nilai = (n: string, unit: string): number => parseFloat(n.replace(/\./g, "").replace(",", ".")) * (KALI[unit] ?? 1)

export function kumpulkanAngka(...sumber: unknown[]): number[] {
  const vals = new Set<number>(KONSTANTA)
  const jalan = (x: unknown): void => {
    if (typeof x === "boolean" || x == null) return
    if (typeof x === "number") { vals.add(x); return }
    if (Array.isArray(x)) { x.forEach(jalan); return }
    if (typeof x === "object") { Object.values(x as Record<string, unknown>).forEach(jalan); return }
    if (typeof x === "string") {
      for (const t of x.match(/\d+(?:\.\d+)?/g) ?? []) vals.add(parseFloat(t))
      for (const m of x.matchAll(RE_ANGKA)) vals.add(nilai(m[2], (m[3] ?? "").trim()))
    }
  }
  sumber.forEach(jalan)
  return [...vals]
}

export function periksaAngka(jawaban: Record<string, any>, sumber: number[]): string[] {
  const teks = [String(jawaban.teks ?? "")]
  for (const a of Array.isArray(jawaban.angka) ? jawaban.angka : []) if (a && typeof a === "object") teks.push(String(a.nilai ?? ""))
  const salah: string[] = []
  for (const t of teks) {
    for (const m of t.matchAll(RE_ANGKA)) {
      const rp = m[1], n = m[2], unit = (m[3] ?? "").trim()
      const kali = KALI[unit] ?? 1
      const tafsir: Array<[number, number]> = [[nilai(n, unit), n.includes(",") ? n.split(",")[1].length : 0]]
      // "1.461" bisa ribuan gaya Indonesia atau desimal gaya Inggris; terima bila salah satunya cocok.
      if (!n.includes(",") && n.split(".").length === 2) tafsir.push([parseFloat(n) * kali, n.split(".")[1].length])
      const v0 = tafsir[0][0]
      if (!rp && !unit && tafsir.every(([, d]) => d === 0) && (v0 < 100 || (v0 >= 1900 && v0 <= 2100))) continue
      const calon = unit === "%" ? [...sumber, ...sumber.map(s => s * 100), ...sumber.map(s => (s - 1) * 100)] : sumber
      if (!tafsir.some(([v, d]) => calon.some(s => Math.abs(v - s) <= 0.5 * 10 ** -d * kali + 1e-9))) salah.push(m[0].trim())
    }
  }
  return salah
}

export function jawabanDitahan(hasil: Array<[string, unknown]>, salah: string[]): Record<string, any> {
  const tautan: Array<{ label: string; url: string }> = []
  for (const [, r] of hasil) {
    const u = r && typeof r === "object" ? (r as Record<string, unknown>).tautan : null
    if (typeof u === "string" && u.startsWith("/") && !tautan.some(t => t.url === u)) tautan.push({ label: "Buka halaman terkait", url: u })
  }
  console.warn("jawaban ditahan, angka tak tertelusur:", salah)
  return {
    teks: "Angka pada jawaban otomatis tidak cocok dengan data, jadi jawabannya tidak ditampilkan. Angka resminya ada di halaman terkait.",
    angka: [], tautan: tautan.slice(0, 2), ditahan: true,
  }
}
