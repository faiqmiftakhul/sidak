# SIDAK v1.7 — Semantic color system + unified filter toolbar

Status: **disetujui** (v1.7 + deploy murni Cloudflare Pages Function)
Tanggal: 2026-09-09 · Scope: `web/` (React/Vite, light mode only) + `functions/` (Cloudflare Pages Functions)

## Keputusan (hasil brainstorming)

1. **FilterToolbar diterapkan di Antrean SAJA** (§7 menjadi pola bersama; halaman lain tak difilter ulang).
2. **Rumah (Beranda) mempertahankan 4 kartu lama** → roles: attention, money, ratio·reactive (O/E 3 bulan), coverage. Tidak ada kartu `neutral` di Rumah, karena O/E kota harus tetap tampak.
3. **Ikon memakai @mdi/js** (bukan Lucide): `mdiHospitalBuilding`, `mdiAlertOutline`, `mdiCashMultiple`, `mdiGauge`, `mdiCalendarMonth`.
4. **Sumber tunggal status reaktif = helper `OE_STATUS(oe)`** di `src/lib/data.ts`: `oe ≤ 1.05 → wajar`, `1.05 < oe ≤ 1.2 → diamati`, `oe > 1.2 → perhatian`. Beranda migrasi dari ad-hoc `> 1.05`.

## Arsitektur pendekatan (dipilih A)

Token semantik sebagai **modul TS `src/lib/roles.ts`** + inline `style` (pola sama seperti `STATUS` yang sudah ada). Tanpa duplikasi CSS vars, tanpa dependency baru.

## Token (single source)

```
ROLE      text     t1(card bg)   t2(chip bg)
coverage  #0E7490  #E0F2F7       #CFE9F1
attention #C2410C  #FFF7ED       #FDE4CF
money     #1D4ED8  #DBEAFE       #BFD8FB
neutral   #475569  #F6F8FA       #E9EDF1
ratio     reaktif → OE_STATUS:
  wajar     #0F9D8F  #ECFDF5  #D3F3E7
  diamati   #A16207  #FEF9C3  #F7E3C0
  perhatian #C2410C  #FFF7ED  #FDE4CF
```

## Komponen

- **`KpiCard`** (`src/components/KpiCard.tsx`): props `{role, icon, label, value, delta?, sparkline?, href?, statusPill?, hint?, variant?}`. Anatomi per §5 spec (padding 16, radius 10, border 1px #E2E8F0; chip 32×32 radius 8 tint-2 + ikon 16 role-color; label 11 uppercase; value 28 semibold tabular dalam `text` role; delta 12px diwarnai **polaritas** — worsening #C2410C / improving #0F9D8F / neutral #475569; sparkline 48×24 role-color via `Spark` + prop `warna`; hover border role 40%; fokus ring 2px teal; `variant='sm'` untuk Profil). Polaritas: attention, money, O/E — naik = worsening; coverage — selalu neutral.
- **FilterToolbar** (`src/components/Filter.tsx` + primitif di `Common.tsx`): `FilterSelect` (trigger ringkas "Status: 2"), `CheckMenu` (checkbox ber-coun), `Cari` (diperbarui min 180px @wrap), `ChipFilter` + "Hapus semua", `ResultCount` aria-live, kluster "Ekspor CSV (n)". Semua kontrol 36px, radius 6, gap 8, teks 13px, ikon 16px-sebelah-kiri (flex sibling, bukan absolute).
- Antrean mempertahankan **rail 280px** → primitif disamakan (36px/radius 6). State tetap di URL (sudah ada: `wil`,`st`,`mod`,`kelas`,`urut`,`q`). Baris chip aktif muncul HANYA jika filter ≠ default. Wrap maks 2 baris @1024px. Empty state + "Longgarkan filter".

## Peta aplikasi

- **Rumah**: 4 KpiCard ber-warna (attention → `/antrean?st=perhatian` · money · ratio·reactive w/ statusPill → `/modul/m` · coverage). Section "Per modul": kartu PUTIH (#E2E8F0), badge mono `#n` (`INFO[k].nomor`), nama, "Dinilai N · N perlu perhatian" pill amber, **mini O/E bar** 4px (track #E2E8F0, fill warna `OE_STATUS`, tick putus-putus @1.0 label "wajar"), hover border teal; **hapus border-top berwarna per modul**.
- **Modul**: 4 stat → KpiCard (coverage · attention → `/antrean?st=perhatian&mod=m` · ratio·reactive O/E kota + pill + sparkline `ring.tren[m]` · money ≈ selisih).
- **Profil**: `.metrik .mk` → role chips `variant='sm'` (O/E reactive, z neutral, volume coverage, ≈ selisih money).
- **Bacaan card**: tetap putih + sparkle; koreksi `.bacaan-card.pk` dari border-top brand → **border-left 3px amber** (hak eksklusif aksen kiri).

## Anti-pattern (wajib)

Tidak ada aksen hue per modul · tidak ada left-border di KpiCard · no gradient/glow/shadow · tanpa merah · delta hanya oleh polaritas · tanpa warna di luar token file.

## Kontras (dihitung, WCAG)

| pasangan | rasio | hasil |
|---|---|---|
| coverage #0E7490 / #E0F2F7 | 4.65 | AA normal ✓ |
| attention #C2410C / #FFF7ED | 4.88 | AA normal ✓ |
| money #1D4ED8 / #DBEAFE | 5.49 | AA normal ✓ |
| neutral #475569 / #F6F8FA | 7.12 | AA normal ✓ |
| diamati #A16207 / #FEF9C3 | 4.58 | AA normal ✓ |
| wajar #0F9D8F / #ECFDF5 | 3.19 | AA large-text (value 28px) ✓ |
| wajar #0F9D8F / putih (delta 12px) | 3.37 | exception dicatat |

Ikon pada chip tint-2: 4.23–6.44 → memenuhi 3:1 grafis ✓.

## Acceptance (dipetakan ulang)

- [ ] Rumah+Modul: 4 kartu ber-tint, 3 level warna, AA terverifikasi
- [ ] Modul O/E > 1.2 → keluarga amber + pill; scope 1.00 → hijau-teal
- [ ] Delta: simulasi +12% pada attention → amber panah atas; coverage → slate
- [ ] Mini O/E bar menampilkan tick 1.0 di semua kartu modul Rumah
- [ ] Kartu Bacaan berbeda visual dari KpiCard (left border vs tint) — screenshot berdampingan
- [ ] FilterToolbar: tinggi kontrol identik; baris chip hanya saat aktif; "Hapus semua" + hitungan; round-trip URL
- [ ] Rail Antrean memakai primitif bersama (grep import)
- [ ] `npm run audit:layout` LOLOS di 1024px (toolbar wrap ≤ 2 baris)
- [ ] grep: tanpa hex di luar token file
- [ ] `npm run build` bersih

## Deliverable

1. `roles.ts` + `KpiCard` + `Filter.tsx` + primitif
2. Diff halaman (Beranda, Modul, Profil, Antrean)
3. Matrix screenshot sebelum/sesudah (KPI, O/E reaktif 2 keadaan, toolbar ± chip, 1440 + 1024)
4. Catatan kontras

## Deploy — Cloudflare Pages + Pages Function (disetujui, jalur MURNI)

Tujuan: semua fungsi berjalan di Cloudflare, tanpa server.

**Statis**: `web/dist/` → Pages (data `/data/*.json`, `jawaban_cadangan.json`, ikon ikut). React-router: tambah `web/public/_redirects` berisi `/*  /index.html  200` (spa fallback).

**Backend port**: `api/main.py` (FastAPI, ~914 baris) → **TypeScript Pages Function** di `functions/` (repo root; Pages: root=repo, build=`cd web && npm run build`, output=`web/dist`, functions=`functions`, env `SUMOPOD_API_KEY` + opsional `SUMODOP_BASE_URL`, `SIDAK_MODEL` = secret).
- `/api/chat` (POST) → `functions/api/chat.ts`. Non-streaming JSON. Port: blok `jalankan_pipeline` (slot ter-scope) → blok loop alat OpenAI-function-calling (maks 5 iterasi, `alat_menyala` guard) → fallback `cari_cadangan` 503. SumoPod = OpenAI-compatible via `fetch('https://ai.sumopod.com/v1/chat/completions', {Authorization: Bearer})` — tanpa SDK.
- `/api/ai/digest` (GET) → `functions/api/ai/digest.ts`: LLM bila ada kunci, else `digest_deterministik`.
- `/api/alat/{nama}` (GET) → `functions/api/alat/[nama].ts`: registry alat baca-saja dari `Store` (load `web/public/data/*.json` secara lazy, cache modul).
- `/api/sehat` (GET) → mengembalikan `{ok, faskes, model, asisten}`.
- Cache LRU → `Map` modul (KACHE_JAWABAN, KACHE_DIGEST). Tanpa streaming/persistensi.
- Port trailing: versi asist tetap `jawaban_cadangan.json`.

**Verifikasi deploy**: `npx wrangler pages deploy . -- ...` (atau dashboard) lalu smoke: `/`, deep-link `/faskes/...`, `/api/sehat`, tanya `/api/chat` dengan & tanpa kunci, digest. Audit lokal (`npm run audit:layout`, shots) tetap jalan pra-push.

## Catatan footer sidebar (fix terkait)

Caption `jan–nov …` (periode) dan `Sampel ±1% · anonim` di footer sidebar dibedakan dari tombol "Sembunyikan side menu": kini 11px rapat, tanpa radius/hover, ikon 12px redup — hanya toggle yang tampil sebagai tombol (dilakukan 2026-09-09, build bersih).

## Open

- **Gambar user (belum dijelaskan teks)**: perbedaan tampilan lain di area sidebar — menunggu deskripsi teks karena model tidak mendukung input gambar. Jika ada penyesuaian lanjutan, masuk sebagai penambahan kecil setelah v1.7.