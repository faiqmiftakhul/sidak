// Port jawab_deterministik dari api/main.py.
// Pertanyaan berstruktur dijawab kode dari hasil alat: cepat, dan angkanya identik dengan data.

import { KOTA, NAMA, NOMOR, STATUS, labelWilayah, rp, store } from "./data"

type J = Record<string, any>

const INFO_PENDEK: Record<string, string> = { rujukan: "Rujukan", severity: "Severity", fragmentasi: "Fragmentasi", readmisi: "Readmisi" }
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const UNIT_VOLUME: Record<string, string> = { rujukan: "kunjungan sakit", fragmentasi: "kunjungan RJTL", severity: "rawat inap", readmisi: "rawat inap" }
const URUT_LABEL: Record<string, string> = { rupiah_tertimbang: "selisih rupiah tertimbang", rupiah: "selisih rupiah sampel", OE: "O/E", z: "skor z", volume: "volume" }
const CATATAN = "Ini indikasi statistik dari sampel ±1% peserta untuk prioritas audit, bukan bukti pelanggaran."
const KONSEP = "O/E adalah perbandingan kejadian nyata (O) dengan kejadian wajar (E), yaitu jumlah yang diperkirakan bila faskes " +
  "melayani pasien yang sama seperti rekan sebayanya. O/E 1 berarti sesuai perkiraan, di atas 1 berarti kejadian nyata lebih banyak. " +
  "Skor z mengukur seberapa jauh selisih itu dari kebetulan; z di atas 1,96 berarti selisihnya kecil kemungkinan terjadi karena kebetulan. " +
  "SIDAK memberi status Perlu perhatian bila O/E di atas 1,05, z di atas 1,96, dan polanya konsisten di dua paruh periode; " +
  "Diamati bila hanya sebagian ambang terlewati."

/** Angka gaya Indonesia: 1.234,5 */
export function fid(x: number | null | undefined, d = 0): string {
  if (x == null) return "-"
  const [i, f] = Math.abs(x).toFixed(d).split(".")
  return (x < 0 && Number(Math.abs(x).toFixed(d)) !== 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (f ? "," + f : "")
}

const judul = (x: string) => x.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
const namaModul = (m: string) => `modul #${NOMOR[m]} ${NAMA[m]}`
const slugModul = (no: number) => Object.keys(NOMOR).find(k => NOMOR[k] === no)!

async function sumber(mod?: string | null): Promise<string> {
  const per = (await store()).ring.periode.split(" (")[0]
  return mod ? `Modul #${NOMOR[mod]} · Data Sampel BPJS ${per}` : `Data Sampel BPJS Kesehatan ${per}, SIDAK`
}

export async function jawabDeterministik(slot: J, hasil: Array<[string, unknown]>, mod: string | null): Promise<J | null> {
  const r = Object.fromEntries(hasil) as Record<string, J>
  const intent = slot.intent, met = slot.metric ?? "rupiah"
  if (intent === "comparison" && slot.banding) {
    const b = await detBanding(hasil)
    if (b) b.deterministik = true
    return b
  }
  if (!["fact", "aggregate", "ranking", "list", "trend", "concept"].includes(intent)) return null
  let out: J | null = null
  if (intent === "concept" && slot._asal === "heuristic") {
    out = { teks: KONSEP, angka: [], tautan: [{ label: "Metodologi", url: "/metodologi" }], sumber: "Metodologi SIDAK" }
  } else if (r.jelaskan_temuan) out = await detFaskes(r.jelaskan_temuan, mod)
  else if (r.trend) out = await detTren(r.trend)
  else if (r.daftar_temuan) out = await detDaftar(r.daftar_temuan, r.faskes_count, mod, slot)
  else if (r.faskes_count) {
    const c = r.faskes_count, w = await labelWilayah(c.wilayah)
    out = {
      teks: `Terdapat ${fid(c.faskes_fkrtl)} RS dan ${fid(c.faskes_fktp)} FKTP di ${w} dalam Data Sampel BPJS Kesehatan. Dari jumlah itu, ${fid(c.faskes_perlu_perhatian)} faskes berstatus Perlu perhatian pada setidaknya satu modul.`,
      angka: [{ label: "RS", nilai: fid(c.faskes_fkrtl) }, { label: "FKTP", nilai: fid(c.faskes_fktp) }],
      tautan: [{ label: "Antrean audit", url: "/antrean" }], sumber: await sumber(),
    }
  } else if (r.ambil_indikator && !r.ambil_indikator.error) out = await detIndikator(r.ambil_indikator, met)
  else if (r.ringkas_wilayah) out = await detWilayah(r.ringkas_wilayah, met)
  if (out) out.deterministik = true
  return out
}

async function detBanding(hasil: Array<[string, unknown]>): Promise<J | null> {
  const item = hasil.map(([, r]) => r as J).filter(r => r && typeof r === "object" && !r.error)
  if (item.length < 2) return null
  if ("total" in item[0]) {
    const lw = await labelWilayah(item[0].wilayah)
    const urut = item.map(a => [slugModul(a.nomor), a.total] as [string, J]).sort((x, y) => y[1].selisih_rupiah_tertimbang - x[1].selisih_rupiah_tertimbang)
    const [[m1, t1], [m2, t2]] = urut
    const buka = t1.selisih_rupiah_tertimbang === t2.selisih_rupiah_tertimbang
      ? `Dampak rupiah ${namaModul(m1)} dan ${namaModul(m2)} di ${lw} sama besar: ${rp(t1.selisih_rupiah_tertimbang)} tertimbang.`
      : `Dampak ${namaModul(m1)} lebih besar di ${lw}: ${rp(t1.selisih_rupiah_tertimbang)} tertimbang dibandingkan ${rp(t2.selisih_rupiah_tertimbang)} pada ${namaModul(m2)}.`
    const kap = (x: string) => x[0].toUpperCase() + x.slice(1)
    const rinci = urut.map(([m, t]) => `${kap(namaModul(m))}: O/E ${fid(t.OE, 2)}, ${fid(t.perlu_perhatian)} dari ${fid(t.faskes_dinilai)} faskes yang dinilai berstatus Perlu perhatian, selisih ${rp(t.selisih_rupiah_sampel)} pada sampel.`).join(" ")
    return {
      teks: `${buka} ${rinci} ${CATATAN}`,
      angka: urut.map(([m, t]) => ({ label: `#${NOMOR[m]} ${NAMA[m]}`, nilai: rp(t.selisih_rupiah_tertimbang), satuan: "tertimbang" })),
      tautan: urut.map(([m]) => ({ label: `Modul #${NOMOR[m]}`, url: "/modul/" + m })), sumber: await sumber(),
    }
  }
  const baris = item.map(j => {
    const mods = j.modul as Record<string, J>, ks = Object.keys(mods)
    return [j, ks.find(k => mods[k].status === STATUS.perhatian) ?? ks.find(k => mods[k].status === STATUS.diamati) ?? null] as [J, string | null]
  }).sort((x, y) => y[0].selisih_rupiah_tertimbang - x[0].selisih_rupiah_tertimbang)
  const teks = [`${baris[0][0].faskes} mencatat selisih tertimbang lebih besar: ${rp(baris[0][0].selisih_rupiah_tertimbang)} dibandingkan ${rp(baris[1][0].selisih_rupiah_tertimbang)} pada ${baris[1][0].faskes}.`]
  for (const [j, k] of baris) {
    if (k) { const h = j.modul[k]; teks.push(`${j.faskes} (${j.tipe} ${j.kelas}): ${h.status} pada ${namaModul(k)}, O/E ${fid(h.OE, 2)} dan skor z ${fid(h.z, 2)}.`) }
    else teks.push(`${j.faskes} (${j.tipe} ${j.kelas}): tidak ditandai di modul mana pun.`)
  }
  return {
    teks: [...teks, CATATAN].join(" "),
    angka: baris.map(([j]) => ({ label: j.faskes, nilai: rp(j.selisih_rupiah_tertimbang), satuan: "tertimbang" })),
    tautan: baris.map(([j]) => ({ label: j.faskes, url: j.tautan })), sumber: await sumber(),
  }
}

async function detWilayah(w: J, met: string): Promise<J> {
  const lw = await labelWilayah(w.wilayah), per = w.per_modul
  const mods = Object.keys(NOMOR)
  if (met === "oe") {
    const ada = mods.filter(m => per[m].OE != null)
    return {
      teks: `O/E tiap modul di ${lw}: ${ada.map(m => `${namaModul(m)} O/E ${fid(per[m].OE, 2)}`).join("; ")}. O/E di atas 1 berarti kejadian nyata lebih banyak dari yang wajar. ${CATATAN}`,
      angka: ada.map(m => ({ label: "O/E " + NAMA[m], nilai: fid(per[m].OE, 2) })),
      tautan: [{ label: "Ringkasan", url: "/" }], sumber: await sumber(),
    }
  }
  const urut = [...mods].sort((a, b) => per[b].selisih_rupiah_tertimbang - per[a].selisih_rupiah_tertimbang)
  const rinci = urut.map(m => `${namaModul(m)} ${rp(per[m].selisih_rupiah_tertimbang)}`).join(", ")
  return {
    teks: `Estimasi selisih rupiah faskes yang ditandai di ${lw} adalah ${rp(w.selisih_rupiah_sampel)} pada data sampel, atau sekitar ${rp(w.selisih_rupiah_tertimbang)} setelah dibobot ke populasi peserta. Rincian tertimbang: ${rinci}. ${CATATAN}`,
    angka: [{ label: "Selisih sampel", nilai: rp(w.selisih_rupiah_sampel) }, { label: "Selisih tertimbang", nilai: rp(w.selisih_rupiah_tertimbang) }],
    tautan: [{ label: "Antrean audit", url: "/antrean" }], sumber: await sumber(),
  }
}

async function detIndikator(a: J, met: string): Promise<J> {
  const m = slugModul(a.nomor), t = a.total, lw = await labelWilayah(a.wilayah)
  const hitung = `${fid(t.perlu_perhatian)} dari ${fid(t.faskes_dinilai)} faskes yang dinilai berstatus Perlu perhatian dan ${fid(t.diamati)} Diamati.`
  const oeKal = `O/E ${namaModul(m)} di ${lw} adalah ${fid(t.OE, 2)}: ${fid(t.observed)} kejadian nyata dibanding ${fid(t.expected, 1)} kejadian wajar.`
  const rpKal = `Selisih rupiah ${namaModul(m)} di ${lw} adalah ${rp(t.selisih_rupiah_sampel)} pada data sampel, atau sekitar ${rp(t.selisih_rupiah_tertimbang)} tertimbang.`
  const urutan = met === "oe" ? [oeKal, hitung] : met === "count" ? [hitung, oeKal] : [rpKal, hitung]
  return {
    teks: [...urutan, CATATAN].join(" "),
    angka: [{ label: "O/E", nilai: fid(t.OE, 2) }, { label: "Perlu perhatian", nilai: fid(t.perlu_perhatian) }, { label: "Selisih tertimbang", nilai: rp(t.selisih_rupiah_tertimbang) }],
    tautan: [{ label: `Modul #${NOMOR[m]}`, url: "/modul/" + m }], sumber: await sumber(m),
  }
}

async function detDaftar(d: J, hitung: J | undefined, mod: string | null, slot: J): Promise<J> {
  const lw = await labelWilayah(d.wilayah), rows: J[] = d.temuan.slice(0, 5)
  const lingkup = mod ? " pada " + namaModul(mod) : ""
  if (!rows.length) {
    return {
      teks: `Tidak ada faskes di ${lw} yang berstatus Perlu perhatian atau Diamati${lingkup}. ${CATATAN}`,
      angka: [], tautan: mod ? [{ label: "Modul", url: "/modul/" + mod }] : [{ label: "Antrean audit", url: "/antrean" }], sumber: await sumber(mod),
    }
  }
  const buka = hitung
    ? `${fid(hitung.faskes_perlu_perhatian)} faskes di ${lw} berstatus perlu perhatian pada setidaknya satu modul.`
    : `Ada ${fid(d.jumlah_temuan)} temuan berstatus perlu perhatian atau diamati di ${lw}${lingkup}.`
  const urut = ({ oe: "OE", z: "z", count: "volume" } as Record<string, string>)[slot.metric] ?? "rupiah_tertimbang"
  // Ringkas agar muat di panel chat: kolom Modul hanya bila barisnya lintas modul, nama modul versi pendek.
  const tabel = mod || new Set(rows.map(x => x.nomor)).size === 1
    ? ["| Faskes | Status | O/E | Selisih |", "|---|---|---|---|",
      ...rows.map(x => `| ${x.faskes} | ${x.status} | ${fid(x.OE, 2)} | ${rp(x.selisih_rupiah_tertimbang)} |`)]
    : ["| Faskes | Modul | Status | O/E | Selisih |", "|---|---|---|---|---|",
      ...rows.map(x => `| ${x.faskes} | #${x.nomor} ${INFO_PENDEK[slugModul(x.nomor)]} | ${x.status} | ${fid(x.OE, 2)} | ${rp(x.selisih_rupiah_tertimbang)} |`)]
  return {
    teks: `${buka} Urutan teratas menurut ${URUT_LABEL[urut]}:\n${tabel.join("\n")}\n${CATATAN}`,
    angka: rows.slice(0, 3).map(x => ({ label: x.faskes, nilai: fid(x.OE, 2), satuan: "O/E" })),
    tautan: [...rows.slice(0, 3).map(x => ({ label: x.faskes, url: x.tautan })), { label: "Antrean audit", url: "/antrean" }],
    sumber: await sumber(mod),
  }
}

async function detTren(tr: J): Promise<J | null> {
  if (tr.error || tr.wilayah !== KOTA) return { teks: "Deret bulanan hanya tersedia untuk Kota Semarang dalam sampel saat ini.", angka: [], tautan: [], sumber: await sumber() }
  const kal: string[] = [], angka: J[] = []
  for (const [m, deret] of Object.entries(tr.modul as Record<string, J[]>)) {
    const oe = deret.map(b => b.OE).filter((x): x is number => x != null)
    if (oe.length < 6) continue
    const awal = (oe[0] + oe[1] + oe[2]) / 3, akhir = (oe[oe.length - 3] + oe[oe.length - 2] + oe[oe.length - 1]) / 3
    const arah = akhir - awal > 0.05 ? "meningkat" : awal - akhir > 0.05 ? "menurun" : "fluktuatif tanpa arah naik atau turun yang jelas"
    const b0 = deret[0], b1 = deret[deret.length - 1]
    kal.push(`O/E bulanan ${namaModul(m)} ${arah}: ${fid(b0.OE, 2)} pada ${BULAN[b0.bln - 1]} 2024 dan ${fid(b1.OE, 2)} pada ${BULAN[b1.bln - 1]} 2024 (puncak ${fid(Math.max(...oe), 2)}).`)
    angka.push({ label: `O/E ${NAMA[m]} ${BULAN[b1.bln - 1]}`, nilai: fid(b1.OE, 2) })
  }
  if (!kal.length) return null
  const ms = Object.keys(tr.modul)
  return {
    teks: kal.join(" ") + " Pembanding tiap bulan adalah kejadian wajar bulan yang sama di Kota Semarang.",
    angka, tautan: [{ label: "Grafik tren", url: tr.tautan }], sumber: await sumber(ms.length === 1 ? ms[0] : null),
  }
}

async function detFaskes(j: J, mod: string | null): Promise<J> {
  if (j.error) return { teks: "Data itu tidak tersedia dalam sampel saat ini.", angka: [], tautan: [], sumber: "" }
  const mods = j.modul as Record<string, J>, kode = j.faskes
  const ks = Object.keys(mods)
  const pilih = mod && mod in mods ? mod : (ks.find(k => mods[k].status === STATUS.perhatian) ?? ks.find(k => mods[k].status === STATUS.diamati) ?? null)
  if (!pilih) {
    const rinci = ks.filter(k => mods[k].OE != null).map(k => `${namaModul(k)} O/E ${fid(mods[k].OE, 2)}`).join("; ")
    return {
      teks: `${kode} (${j.tipe} ${j.kelas}, ${judul(j.kab_kota)}) tidak ditandai: semua modul yang dinilai berada dalam rentang wajar atau volumenya terlalu kecil. ${rinci}.`,
      angka: [], tautan: [{ label: kode, url: j.tautan }], sumber: await sumber(), deterministik: true,
    }
  }
  const h = mods[pilih]
  let teks: string
  if (h.status === STATUS.volume_rendah) {
    teks = `${kode} pada ${namaModul(pilih)}: volume ${fid(h.volume)} ${UNIT_VOLUME[pilih]} terlalu kecil untuk dinilai.`
  } else {
    const konsisten = h.stabil_dua_paruh ? "konsisten di dua paruh periode" : "belum konsisten di dua paruh periode"
    teks = `${kode} berstatus ${h.status} pada ${namaModul(pilih)}: O/E ${fid(h.OE, 2)} dan skor z ${fid(h.z, 2)}, ${konsisten}. ` +
      `Dari ${fid(h.volume)} ${UNIT_VOLUME[pilih]}, tercatat ${fid(h.observed)} kejadian dibanding ${fid(h.expected, 1)} kejadian wajar, ` +
      `selisih ${fid(h.selisih_kejadian, 1)} kejadian atau ${rp(h.selisih_rupiah_sampel)} pada sampel (sekitar ${rp(h.selisih_rupiah_tertimbang)} tertimbang).`
    const kon: J[] = h.penyumbang_terbesar ?? []
    if (kon.length) teks += ` Penyumbang terbesar: ${kon.slice(0, 3).map(k => `${k.nama} (${fid(k.O)} vs ${fid(k.E, k.E >= 1 ? 1 : 2)} wajar)`).join(", ")}.`
    const seb: J[] = h.pembanding_sebaya ?? []
    if (seb.length) teks += ` Pembanding sebaya kelas yang sama: ${seb.map(x => `${x.faskes} O/E ${fid(x.OE, 2)}`).join(", ")}.`
  }
  const lain = ks.filter(k => k !== pilih).map(k => `${namaModul(k)} ${String(mods[k].status).toLowerCase()}`)
  if (lain.length) teks += ` Modul lain: ${lain.join("; ")}.`
  return {
    teks: teks + " " + CATATAN,
    angka: [{ label: "O/E", nilai: fid(h.OE, 2) }, { label: "Skor z", nilai: fid(h.z, 2) }, { label: "Selisih tertimbang", nilai: rp(h.selisih_rupiah_tertimbang) }],
    tautan: [{ label: kode, url: j.tautan }, { label: `Modul #${NOMOR[pilih]}`, url: "/modul/" + pilih }],
    sumber: await sumber(pilih),
  }
}
