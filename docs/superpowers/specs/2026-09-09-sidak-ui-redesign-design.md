# SIDAK UI Redesign — Design Spec

Tanggal: 2026-09-09 · Status: disetujui (Fase 1 dieksekusi) · Produk: SIDAK (BPJS Kesehatan audit tool)

## 1. Tujuan

Merancang ulang antarmuka SIDAK menjadi alat investigasi-audit yang kalem dan presisi:
indikasi ≠ vonis. **Data, metrik, filter, dan logika bisnis TIDAK diubah** — hanya
visual, hierarki, interaksi, dan cara statistik dikomunikasikan. Seluruh copy dalam
Bahasa Indonesia, tanpa kata "curang/penipuan/fraud/tersangka", dan **merah tidak
pernah muncul pada elemen faskes** (merah khusus error sistem).

## 2. Keputusan pengguna (disetujui)

| Aspek | Keputusan |
|---|---|
| Warna brand | Petrol teal `#0E7490` (hover `#155E75`, tint `#E0F2F7`) menggantikan navy `#0D366B` |
| Sidebar | **Tetap gelap** (teal-tinted, bukan kanvas terang) |
| Tipografi | **IBM Plex Sans + IBM Plex Mono** (dipertahankan; tidak ke Plus Jakarta Sans) |
| Stack CSS | **Pertahankan CSS token** (tidak migrasi Tailwind) |
| Scope | Bertahap 3 fase |

## 3. Foundations (token, styles.css)

- Brand: `--brand:#0E7490` `--brand-hover:#155E75` `--brand-tint:#E0F2F7`
  menggantikan `--navy`; seleksi/fokus/aktif teal; `--navys` → tint teal.
- Status (StatusPill selalu ikon+teks+warna, ukuran sm/md):
  - Dalam rentang wajar — `#0F9D8F` on `#ECFDF5` (ikon circle-check)
  - Diamati — `#A16207` on `#FEF9C3` (ikon eye)
  - Perlu perhatian — `#C2410C` on `#FFF7ED`, border `#FED7AA` (ikon triangle-alert)
  - Volume rendah — slate `#64748B` on `#F1F5F9`
- Progres audit: Belum (outline slate) → Sedang (`#1D4ED8` on `#DBEAFE`) → Selesai
  (solid `#0F766E` + check).
- Charts: palette Okabe-Ito (colorblind-safe); ramp peta **amber berurutan**
  (menggantikan ramp navy/blue); garis ref putus-putus `#94A3B8`.
- Permukaan: canvas `#F6F8FA` · card `#FFFFFF` · border `#E2E8F0` · divider `#EDF2F7`
  · ink `#1E293B` · secondary `#475569` · muted `#94A3B8`.
- `tabular-nums` pada SEMUA angka (O/E, z, rupiah). `--red` dihapus dari elemen
  faskes; `--danger` baru hanya untuk error.
- Font tetap Plex; skala font saat ini diterima (12/13/14/16/20/28 dikonfirmasi).

## 4. App shell

- **Sidebar 240px → 72px (icon rail saat kolaps).** Urutan: logo SIDAK + tagline
  "Sistem Indikasi Audit Klaim" → Rumah → Peta → Antrean audit (badge count) →
  divider "Modul" → #3/#4/#9/#16 (masing-masing dot-count "Perlu perhatian") →
  Tanya SIDAK. Item Metodologi dipindah ke tombol "Metode" di topbar. Footer:
  pemilih periode + badge "Sampel ±1%".
- **Topbar 56px**: breadcrumb (Wilayah › Cakupan › Halaman), pencarian global
  `Ctrl+K` (kode faskes + modul), tombol "Metode", avatar.
- **ContextStrip 32px** di bawah topbar, dapat ditutup (persistensi
  `localStorage`): "Data sampel anonim ±1% · kode faskes disamarkan · hasil =
  indikasi untuk prioritas audit, bukan vonis" + tautan "Pelajari metode".

## 5. Komponen signature (Fase 2)

- `StatusPill` (ikon+teks+warna, dari `Pill`).
- `OEChip`: mono value + micro-track 64×10 (tick 1.0, dot = nilai, warna status) +
  badge z; tooltip kalimat awam; dashed outline + catatan bila `n<30`; variant
  besar menambah whisker CI (≈1.96√O/E, dihitung client) + `median` peer.
- `RupiahText`: "≈ Rp …" mono kanan, tooltip orde besaran.
- `FaskesCode`: chip mono, klik-salin + toast.
- `MethodPopover`: 3 akordeon (O/E · skor z · selisih rupiah), terhubung tombol Metode.

## 6. Halaman (Fase 2–3)

- Rumah: header+scope; 4 KPI klik → Antrean terfilter; kartu "empat pola yang
  dipantau"; preview peta L1 + tren bulanan (band CI binomial dari O/E bulanan);
  antrean top-10.
- Modul: panel penjelasan kolapsibel; Chart A ranking bar horizontal (ref 1.0);
  Chart B scatter volume(log) × O/E (dot ∝ ≈Rp); tabel global; filter persist URL.
- Antrean: filter rail 280px (Wilayah tree, Modul+count, Status, Kelas, Progres,
  Reset), tab simpan, stepper progres 1-klik + toast undo, catatan preview, batch
  select + bulk status.
- Peta: segmented L1/L2/L3; side panel kanan 360px (bukan modal); L3 aliran arcs
  lengkung dengan dim-highlight; semua layer punya alternatif tabel.
- Profil: header sticky (FaskesCode, pill modul, CTA audit), banner netral, tab
  per modul (OEChip besar + persentil sekelas dihitung client + dist plot peer +
  tren 12 bln CI + tabel sampel klaim + mini-peer), rail audit kanan sticky 320px
  (stepper, catatan autosave localStorage, dropdown temuan netral, timeline,
  ekspor ringkasan).
- Tanya SIDAK: drawer 400px, empty-state chips, citation chips, offline banner.

## 7. Aturan global

Tabel: header sticky, sortable (`aria-sort`), baris 44px, hover + aksen kiri 2px
warna status, focus teal, klik → profil (Ctrl+klik tab baru), chips filter di
hitung "Menampilkan 1–25 dari 214", pagination 25/50/100. Chart: ref "wajar = 1.0"
di semua; tooltip; keyboard reachable. State: loading skeleton (≥200ms) ·
empty-filter + "Longgarkan filter" · empty-clean (framing positif) · error card
(merah hanya di sini). A11y WCAG 2.1 AA; status tidak pernah warna-saja; live
region hasil filter; `prefers-reduced-motion`; target ≥44px.

## 8. Fase

- **Fase 1 (shell & etika)**: teal token + status amber + ramp peta amber; bersihkan
  kata larangan; sidebar baru (badges, tagline, footer periode+Sampel ±1%); topbar
  56px (breadcrumb, Ctrl+K, Metode, avatar); ContextStrip dismissible; index.html
  theme-color/favicon teal.
- **Fase 2 (komponen signature + halaman inti)**: StatusPill, OEChip, RupiahText,
  FaskesCode, MethodPopover; pages Rumah, Modul, Antrean, Peta, Profil.
- **Fase 3 (Tanya SIDAK + polish & verifikasi akhir)**: drawer 400px, empty-state,
  citation chips, offline banner + regulasi menyeluruh (tables, states, a11y).

## 9. Etika & batas keras

- Tidak ada kata larangan di layar/expor/chat.
- Merah dilarang pada elemen faskes; hanya untuk error sistem.
- "dibanding rekan sebaya", bukan "dibanding normal".
- Metrik turunan baru (persentil sekelas, CI ≈, selisih pop) dihitung client dari
  field existing `O,E,n` — tidak menyentuh pipeline.
- V1 light-mode, lebar 1024–1920px, desktop-first.

## 10. Peta file

- `web/src/styles.css`, `web/index.html`, `web/src/main.tsx`
- `web/src/App.tsx` (shell), `web/src/components/Topbar.tsx` (baru),
  `web/src/components/ContextStrip.tsx` (baru), `web/src/components/Chat.tsx`
- `web/src/lib/data.ts` (palet status), `web/src/components/Common.tsx`
  (status/chart color), `web/src/components/MapView.tsx` (ramp amber, seleksi teal)
- Halaman: `web/src/pages/{Beranda,Peta,Antrean,Modul,Profil,Metodologi}.tsx`