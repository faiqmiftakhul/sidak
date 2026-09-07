# PRD — SIDAK Demo Kota Semarang

**Produk:** SIDAK — Sistem Deteksi Dini Pola Klaim Tidak Wajar di Fasilitas Kesehatan
**Lingkup dokumen:** aplikasi demo untuk juri Healthkathon 2026 (Kategori 2 · Faskes), wilayah Kota Semarang, empat modul
**Status:** draf v0.1 · 5 September 2026 · belum ada implementasi
**Pemilik:** [Ketua Tim] · Penyusun: tim SIDAK

---

## 0. Ringkasan satu halaman

SIDAK membandingkan setiap fasilitas kesehatan (faskes) dengan rekan sebayanya (kelas, wilayah, bauran kasus), lalu mengurutkan faskes yang paling menyimpang untuk empat modus klaim tidak wajar: rujukan tidak sesuai (#3), upcoding severity (#4), fragmentasi layanan (#9), dan readmisi (#16). Demo ini menunjukkan seluruh alur pada satu kota nyata, Kota Semarang, memakai Data Sampel BPJS Kesehatan 2024 yang sudah dianonimkan, diperkaya peta dan data demografi terbuka, dan dilengkapi asisten AI "Tanya SIDAK" agar juri dapat memperoleh jawaban tanpa menjelajah peta atau daftar temuan.

Prinsip yang tidak boleh dilanggar: SIDAK **tidak memvonis fraud**. Ia memberi tahu auditor ke mana harus melihat lebih dulu. Keputusan tetap di tangan manusia.

### Nama

Judul proposal: **S**istem Deteks**i** **D**ini Pol**a** **K**laim Tidak Wajar di Fasilitas Kesehatan → **SIDAK**. Kata "sidak" (inspeksi mendadak) sudah dipahami awam dan memberi kesan tindakan, bukan sekadar laporan. Semua rujukan "SORAI" di deck, README, dan kode diganti menjadi SIDAK (lihat §12, keputusan K-1).

### Mengapa Kota Semarang

| Ukuran (Data Sampel 2024, RS ≥30 admisi RITL) | Semarang | Catatan |
|---|---|---|
| RS dengan volume cukup | 20 | kelas A, B, C, D, TNI/Polri, RS khusus jiwa |
| Admisi rawat inap | 2.769 | |
| Rentang readmisi 30 hari antar RS | 2% – 34% | ada yang jelas menyimpang, ada yang bersih |
| Pangsa severity III (median / maks) | 7,9% / 22,8% | nasional 4,8% |
| Pangsa kunjungan ulang RJTL ≤7 hari di RS sama (median / maks) | 36% / 93% | yang 93% berpola hemodialisis |
| FKTP dengan ≥100 kunjungan sakit | 160 | 89 klinik pratama, 37 puskesmas, 30 dokter umum |
| Rasio rujuk per FKTP (p10 / median / p90) | 9% / 16% / 27% | maks 42% |
| Pangsa rujukan berdiagnosis non-spesialistik (median / maks) | 12% / 51% | nasional 14% |

Setiap modul punya variasi lebar **dan** contoh "positif palsu klasik" (RS kelas A untuk severity, faskes dialisis untuk fragmentasi, RS jiwa untuk readmisi). Itu bahan terbaik untuk memperlihatkan mengapa penyesuaian bauran kasus perlu. Semarang juga satu provinsi dengan Tegal, sehingga kasus RSUD Kardinah dapat dipakai sebagai konteks masalah tanpa menunjuk RS tertentu.

---

## 1. Tujuan dan ukuran keberhasilan demo

### Tujuan

1. Juri memahami dalam ≤5 menit bahwa deteksi tingkat faskes menemukan pola yang tidak terlihat per klaim.
2. Juri melihat empat modul berjalan pada data nyata satu kota, bukan tangkapan layar.
3. Juri melihat bahwa sistem adil bagi faskes jujur: penyesuaian bauran kasus, daftar putih klinis, dan bahasa yang tidak memvonis.
4. Juri dapat bertanya dalam bahasa sehari-hari dan mendapat jawaban berangka yang dapat ditelusuri ke tampilan.

### Ukuran keberhasilan

| Ukuran | Target |
|---|---|
| Durasi skenario demo utama (§9) | ≤5 menit tanpa jeda muat >2 detik |
| Pertanyaan chatbot dalam set uji (§7.6) yang dijawab benar dan berangka | ≥90% dari 40 pertanyaan |
| Jawaban chatbot yang menyebut identitas peserta atau menyebut "fraud" sebagai vonis | 0 |
| Layar yang menampilkan nomor kartu, nomor SEP, nama dokter, atau nama RS yang dikaitkan dengan hasil deteksi | 0 |
| Waktu muat awal aplikasi (laptop demo, tanpa internet) | ≤3 detik |

---

## 2. Pengguna dan skenario

| Persona | Kebutuhan dalam demo | Peran juri yang mewakili |
|---|---|---|
| **Kepala Cabang BPJS Kesehatan Semarang** | Gambaran kota dalam satu layar: berapa faskes perlu perhatian, berapa rupiah selisih, tren bulanan | Juri manajemen / bisnis |
| **Auditor / tim anti-fraud cabang** | Antrean audit terurut, bukti per faskes, alasan penandaan, ekspor daftar sampel klaim | Juri operasional |
| **Verifikator** | Konteks saat memverifikasi: apakah RS ini memang menyimpang, atau readmisi ini wajar secara klinis | Juri klinis |
| **Pembina faskes / pemda** | Peta: di kecamatan mana pasokan faskes tipis, ke mana pasien luar kota mengalir | Juri kebijakan |
| **Orang awam** | Bertanya bebas ke Tanya SIDAK dan mendapat jawaban sederhana | Juri umum |

Demo dijalankan oleh presenter; satu skenario "juri memegang kendali" disiapkan untuk sesi tanya jawab (§9.2).

---

## 3. Lingkup

### Masuk lingkup

- Wilayah: Kota Semarang, dengan peta Provinsi Jawa Tengah sebagai pintu masuk (35 kabupaten/kota) dan Kota Semarang per kecamatan (16 kecamatan) sebagai lapisan konteks.
- Periode: klaim 2024 dari Data Sampel BPJS Kesehatan (Edisi 2025), dipotong bulanan.
- Empat modul: #3, #4, #9, #16, masing-masing dengan indikator, model, daftar putih, dan kartu penjelasan.
- Peta geospasial tiga tingkat dan integrasi data terbuka (§6).
- Asisten AI Tanya SIDAK (§7).
- Antrean audit lintas modul, profil faskes, ekspor CSV/PDF.
- Mode luring penuh untuk demo (data prakomputasi di laptop).

### Di luar lingkup demo

- Integrasi langsung ke sistem produksi BPJS (V-Claim, aplikasi verifikasi, SIPP). Dicantumkan sebagai rencana pilot.
- Penilaian klaim individual (sah/tidak sah). SIDAK berhenti di antrean audit dan daftar sampel klaim.
- Manajemen kasus audit (tindak lanjut, sanksi). Cukup status "belum dilihat / sedang diaudit / selesai" untuk demo.
- Modul lain di Participant Guide selain empat yang diangkat.
- Pelatihan ulang model dari antarmuka.

### Batasan data yang harus jujur disampaikan di layar

- Kode faskes dalam Data Sampel adalah **kode samaran**. Hasil deteksi per RS/FKTP tidak dapat dan tidak boleh dikaitkan dengan RS nyata bernama. Di demo, faskes hasil deteksi ditampilkan sebagai "RS-31595 · Kelas A · Swasta" dan sejenisnya.
- Data Sampel berisi ±1% peserta. Angka rupiah adalah nilai sampel yang diekstrapolasi memakai bobot (PSTV15) dan diberi label "estimasi tertimbang".
- Lokasi faskes hanya sampai kabupaten/kota (FKL06, FKP06). Lapisan kecamatan diisi data terbuka (demografi, pasokan faskes nyata), bukan hasil deteksi.

---

## 4. Modul deteksi

Semua modul memakai kerangka yang sama sehingga tampilan dan penjelasan seragam.

**Kerangka O/E**: untuk tiap faskes, *Observed* = kejadian nyata, *Expected* = jumlah peluang per kejadian yang dihitung model dari rekan sebaya. Rasio O/E dan skor z (varian binomial Σ p(1−p)). Faskes ditandai bila **O/E > 1,05 dan z > 1,96**, dan hanya bila volume minimum terpenuhi. Stabilitas dicek dengan pemisahan paruh (split-half). Rupiah selisih = (O − E) × biaya rata-rata kejadian.

Tiga tingkat status di antarmuka, bukan label "fraud":
- **Perlu perhatian** (merah): memenuhi ambang ganda dan stabil di dua paruh.
- **Diamati** (kuning): memenuhi salah satu ambang atau tidak stabil.
- **Dalam rentang wajar** (hijau).

### 4.1 Modul #3 · Rujukan tidak sesuai (FKTP)

| Aspek | Rincian |
|---|---|
| Unit analisis | FKTP di Kota Semarang, ≥100 kunjungan sakit per periode |
| Kejadian | Kunjungan sakit yang berakhir "RUJUK LANJUT" (FKP13) |
| Expected | Rasio rujuk nasional per diagnosis (FKP14A), distandardisasi ke bauran diagnosis FKTP tersebut; dibedakan jenis FKTP (puskesmas / klinik / dokter umum) |
| Indikator pendamping | Pangsa rujukan berdiagnosis non-spesialistik (daftar 20 diagnosis PPK FKTP, dapat diperluas ke 144); nilai hilir per rujukan (biaya FKRTL episode rujukan) |
| Daftar putih | Kunjungan dengan komorbid berat, rujukan balik program rujuk balik (PRB), FKTP tanpa dokter tetap (dari data terbuka bila tersedia) |
| Tampilan khas | Peringkat FKTP; sebar (scatter) rasio rujuk vs pangsa non-spesialistik; diagnosis teratas yang dirujuk; **peta aliran** FKTP di kab/kota asal → RS Semarang (memakai FKL29 tipe perujuk dan FKP06) |
| Sorotan demo | FKTP dengan pangsa non-spesialistik 51% vs median 12%; kontras puskesmas vs klinik pratama |

### 4.2 Modul #4 · Upcoding severity (FKRTL)

| Aspek | Rincian |
|---|---|
| Unit analisis | RS di Kota Semarang, ≥30 admisi RITL |
| Kejadian | Admisi dengan severity III (FKL23) |
| Expected | Model kecocokan severity (`model/severity.py`): peluang severity III per admisi dari INA-CBG (FKL19/FKL20–22), diagnosis utama, usia, LOS, kelas rawat, dengan kelas RS **tidak** dimasukkan sebagai fitur agar RS tidak "dimaafkan" oleh kelasnya sendiri; kalibrasi diperiksa per kelas |
| Indikator pendamping | Selisih tarif rata-rata severity III vs II pada kelompok CBG yang sama (≈2× menurut analisis); pangsa diagnosis sekunder "penguat" (dari berkas diagnosis sekunder) |
| Daftar putih | RS rujukan tertinggi (kelas A, vertikal) dibandingkan hanya dengan sesamanya; kelompok CBG yang memang didominasi severity III |
| Tampilan khas | Corong severity per RS vs rekan sebaya; heatmap CBG × severity; kartu "mengapa RS ini ditandai" |
| Sorotan demo | Dua RS di 22–23% severity III: RS kelas A (kemungkinan lolos setelah penyesuaian) vs RS swasta setara B (kandidat temuan) |

### 4.3 Modul #9 · Fragmentasi layanan / kontrol ulang berlebih (FKRTL)

| Aspek | Rincian |
|---|---|
| Unit analisis | RS di Kota Semarang, ≥100 kunjungan RJTL |
| Kejadian | Kunjungan RJTL yang berjarak ≤7 hari (dan ≤30 hari) dari kunjungan RJTL sebelumnya oleh peserta yang sama di RS yang sama; turunan: kunjungan RJTL ≤30 hari setelah pulang RITL dari RS yang sama |
| Expected | Rasio kunjungan ulang nasional per CBG rawat jalan × jenis kasus, distandardisasi ke bauran kasus RS |
| Daftar putih klinis | Hemodialisis, kemoterapi, radioterapi, rehabilitasi medik, kontrol pasca-operasi dalam 30 hari, ANC/PNC. Diidentifikasi dari kode CBG dan prosedur, ditampilkan sebagai lapisan terpisah "pola klinis wajar" |
| Indikator pendamping | Kunjungan RJTL per peserta per bulan; pangsa RJTL bertarif prosedur signifikan yang dipecah |
| Tampilan khas | Peringkat RS setelah pemutihan; garis waktu satu peserta (anonim) yang memperlihatkan pecahan kunjungan; ubin per RS "sebelum vs sesudah daftar putih" |
| Sorotan demo | Faskes 93% (dialisis) dan RS khusus bedah 67% diputihkan otomatis; RS swasta B dan C di 49–50% tersisa sebagai kandidat audit |

### 4.4 Modul #16 · Readmisi 30 hari (FKRTL)

| Aspek | Rincian |
|---|---|
| Unit analisis | RS di Kota Semarang, ≥30 admisi indeks |
| Kejadian | Rawat inap ulang dalam 30 hari setelah pulang, peserta sama, RS mana pun; pasien meninggal dan jendela terpotong dikecualikan |
| Expected | Gradient boosting (`model/readmisi.py`): peluang readmisi per admisi dari kelompok INA-CBG, status pulang, diagnosis utama dan masuk, jeda sejak rawat inap sebelumnya, riwayat 180 hari (RITL/RJTL/FKTP), usia. Tanpa penyeimbangan kelas agar terkalibrasi. **Konfigurasi deteksi** memakai riwayat di luar RS yang dinilai |
| Kinerja acuan | AUC 0,814 vs baseline strata 0,755; kalibrasi agregat O/E 0,97–1,03 |
| Daftar putih | RS jiwa dan RS khusus dibandingkan dengan sesamanya; readmisi terencana (kemoterapi siklus, bedah bertahap) bila teridentifikasi dari CBG |
| Tampilan khas | O/E per RS dengan pita kepercayaan; distribusi jeda hari (puncak hari 1–3 mencurigakan); **daftar pasien risiko tinggi** anonim untuk pencegahan; peta asal peserta (PSTV10) yang readmisi di Semarang |
| Sorotan demo | Rentang 2%–34%; RS yang ditandai vs RS dengan angka mentah tinggi tetapi Expected juga tinggi |

### 4.5 Lintas modul

- **Skor gabungan faskes**: jumlah rupiah selisih dari modul yang menandainya, bukan rata-rata skor, supaya mudah diartikan.
- **Antrean audit**: satu daftar untuk semua modul, urut rupiah selisih, dengan filter modul/kelas/kepemilikan/status.
- **Kartu penjelasan** (wajib di setiap temuan): O, E, O/E, z, volume, tiga pembanding sebaya terdekat, tiga fitur/diagnosis penyumbang terbesar, pernyataan "ini indikasi statistik, bukan bukti pelanggaran".
- **Daftar sampel klaim**: 20–50 klaim per temuan untuk auditor, hanya kolom teknis (tanggal, CBG, severity, LOS, biaya), tanpa identitas.

---

## 5. Data internal (Data Sampel BPJS Kesehatan)

| Berkas | Kolom kunci yang dipakai | Kegunaan |
|---|---|---|
| `202403_fkrtl.csv` | PSTV01 (samaran), FKL02 (faskes), FKL03–04 (tanggal), FKL06 (kab/kota RS), FKL07–09 (kepemilikan, jenis, kelas), FKL10 (RJTL/RITL), FKL14 (status pulang), FKL15A/17A (diagnosis), FKL19–23 (INA-CBG dan severity), FKL29 (tipe perujuk), FKL47 (tarif), PSTV15 (bobot) | Modul #4, #9, #16; peta kab/kota |
| `202402_fktpkapitasi.csv` | FKP02, FKP03, FKP06 (kab/kota FKTP), FKP08 (jenis), FKP13 (status pulang, "RUJUK LANJUT"), FKP14A (diagnosis), FKP22 (jenis kunjungan) | Modul #3 |
| `2015202401_kepesertaan.csv` | PSTV03 (lahir), PSTV05, PSTV08 (segmen), **PSTV10 (kab/kota domisili)**, PSTV14 (kab/kota FKTP terdaftar) | Peta aliran pasien; fitur usia/segmen |
| `202405_diagnosissekunder.csv` | diagnosis sekunder per klaim | Modul #4 (penguat severity) |
| `202404_nonkapitasi.csv` | layanan non-kapitasi FKTP | Konteks modul #3 (opsional) |

**Berkas terlarang**: `refs/data_sample_real.csv` (data identitas nyata) tidak boleh dibaca, disalin, atau dimuat oleh aplikasi mana pun. Tambahkan pemeriksaan di skrip muat yang menolak nama berkas ini.

**Prakomputasi**: semua indikator dihitung luring oleh pipeline Python dan disimpan sebagai tabel Parquet/SQLite. Aplikasi demo tidak menghitung model saat berjalan. Sel dengan jumlah <10 disamarkan sebagai "<10".

---

## 6. Peta geospasial dan data terbuka

### 6.1 Tiga tingkat peta

| Tingkat | Wilayah | Isi | Sumber geometri |
|---|---|---|---|
| **L1 Provinsi** | Jawa Tengah, 35 kab/kota | Choropleth satu indikator terpilih per modul (dari Data Sampel via FKL06/FKP06); klik → L2 | Batas kab/kota (§6.2 G-1) |
| **L2 Kota** | Kota Semarang, 16 kecamatan | Lapisan **konteks**: penduduk, kepadatan, pangsa lansia 60+, jumlah RS/puskesmas/klinik nyata (titik); lapisan **hasil** ditampilkan agregat kota di panel, faskes hasil deteksi sebagai kartu anonim di panel samping (tidak dipetakan) | Batas kecamatan (G-1), titik faskes (G-3, G-4) |
| **L3 Aliran** | Jawa Tengah → Semarang | Garis aliran dari kab/kota domisili peserta (PSTV10) ke RS Semarang untuk readmisi dan rujukan; tebal garis = jumlah, warna = O/E | Centroid kab/kota |

Label tetap di L2: "Titik faskes dan demografi berasal dari data publik dan **bukan** hasil deteksi. Hasil deteksi pada data sampel bersifat anonim per faskes." Di mode produksi (pilot), kode faskes asli memungkinkan penempatan hasil di titik RS; ini disebut di layar sebagai fitur pilot, tidak disimulasikan dengan penempatan palsu.

### 6.2 Inventaris data terbuka

Status: **T** = sudah dipastikan tersedia dan formatnya diketahui; **V** = perlu verifikasi ketersediaan/lisensi sebelum dipakai.

| Kode | Data | Sumber | Format | Status | Dipakai untuk |
|---|---|---|---|---|---|
| G-1 | Batas administrasi kab/kota Jawa Tengah dan kecamatan Kota Semarang | Badan Informasi Geospasial (Ina-Geoportal, RBI) atau GADM level 2/3; alternatif OpenStreetMap relasi admin | GeoJSON/SHP | V (GADM: T) | L1, L2 |
| G-2 | Batas provinsi Indonesia | sudah ada di proyek (`prov.json`) | GeoJSON | T | pintu masuk nasional (opsional) |
| G-3 | Daftar RS: nama, kelas, kepemilikan, jumlah tempat tidur, alamat | Kemenkes RS Online / SIRS (rsonline.kemkes.go.id) | tabel web / CSV | V | titik RS di L2, pasokan per kecamatan |
| G-4 | Lokasi puskesmas, klinik, RS (koordinat) | OpenStreetMap (amenity=hospital/clinic/doctors) via Overpass; Data Dasar Puskesmas Kemenkes | GeoJSON/CSV | T (OSM) / V (Kemenkes) | titik faskes di L2 |
| D-1 | Penduduk per kecamatan, kelompok umur, kepadatan | BPS Kota Semarang, "Kota Semarang Dalam Angka 2025" | tabel/xlsx | T (publikasi) / V (format mesin) | choropleth konteks, penyebut per kapita |
| D-2 | Jumlah peserta JKN per kab/kota dan segmen | BPJS Kesehatan (laporan publik) atau agregasi kepesertaan Data Sampel × bobot | tabel | V | penyebut cakupan |
| D-3 | Penduduk miskin / desil kesejahteraan | BPS (tingkat kota; kecamatan tidak dipublikasikan) | tabel | T (kota) | konteks segmen PBI, hanya tingkat kota |
| D-4 | Profil Kesehatan Kota Semarang (kasus penyakit, kunjungan puskesmas) | Dinas Kesehatan Kota Semarang / Satu Data Kota Semarang (data.semarangkota.go.id) | pdf/xlsx | V | konteks modul #3 per kecamatan |
| D-5 | Tarif INA-CBG per regional dan kelas RS | PMK tarif JKN (lampiran) | pdf/tabel | T | rupiah selisih severity |
| D-6 | Daftar 144 diagnosis kompetensi FKTP | PMK 5/2014 (PPK dokter FKTP) | pdf | T | modul #3 (perluasan dari 20 ke 144) |

Aturan pakai: hanya data berlisensi terbuka atau publikasi resmi; simpan sumber dan tanggal unduh di berkas `sumber_data_terbuka.md`; tampilkan atribusi di kaki peta (OSM wajib mencantumkan © OpenStreetMap contributors).

### 6.3 Indikator turunan dari data terbuka

- **Pasokan per 100 ribu penduduk** per kecamatan: RS, tempat tidur, puskesmas, klinik. Dipakai sebagai konteks: kecamatan dengan pasokan tipis dan rujukan tinggi berbeda maknanya dari kecamatan padat faskes dengan rujukan tinggi.
- **Rasio pasien luar kota**: pangsa admisi RS Semarang dari peserta berdomisili luar Semarang (PSTV10). Semarang adalah rujukan regional; readmisi pasien luar kota ke RS yang sama patut dibaca berbeda.
- **Indeks lansia** per kecamatan sebagai pengingat bahwa Expected memang naik di wilayah tua.

---

## 7. Asisten AI "Tanya SIDAK"

### 7.1 Tujuan

Pengguna bertanya dalam bahasa Indonesia sehari-hari dan memperoleh jawaban berangka, dengan sumber dan tautan ke tampilan terkait, tanpa harus menjelajah peta atau daftar notifikasi. Asisten menjawab **dari data SIDAK yang sudah dihitung**, tidak mengarang, dan tidak memvonis.

### 7.2 Contoh pertanyaan yang harus terjawab

| Pertanyaan | Alat yang dipanggil | Bentuk jawaban |
|---|---|---|
| "RS mana yang paling perlu diperhatikan bulan ini di Semarang?" | `daftar_temuan(wilayah, periode, urut=rupiah)` | 3–5 faskes anonim, modul, O/E, rupiah, tautan antrean |
| "Kenapa RS-31598 ditandai?" | `jelaskan_temuan(faskes, modul)` | O, E, z, pembanding sebaya, penyumbang utama, kalimat pengingat |
| "Berapa kerugian estimasi dari fragmentasi di Semarang tahun 2024?" | `ambil_indikator(modul=9, wilayah, periode)` | angka tertimbang, cara hitung ringkas, tautan modul |
| "Apakah RS kelas A dengan severity III 22% itu wajar?" | `bandingkan_sebaya(faskes)` | posisi vs sesama kelas A, status |
| "Dari kabupaten mana pasien readmisi di Semarang paling banyak berasal?" | `aliran_pasien(modul=16, tujuan=Semarang)` | 5 asal teratas, tautan L3 |
| "Puskesmas atau klinik yang lebih banyak merujuk kasus ringan?" | `ambil_indikator(modul=3, pecah=jenis_fktp)` | perbandingan dua angka |
| "Tunjukkan peta readmisi Jawa Tengah" | `buka_tampilan(L1, modul=16)` | navigasi + satu kalimat ringkasan |
| "Siapa dokter yang paling sering upcoding?" | tidak ada alat | penolakan sopan: SIDAK tidak memuat identitas dokter maupun peserta |
| "Apakah RS ini melakukan fraud?" | `jelaskan_temuan` | menjawab dengan status statistik dan menegaskan keputusan ada di auditor |

### 7.3 Arsitektur

```
Pengguna ─► UI chat (streaming) ─► Backend Tanya SIDAK
                                      │  1. Model bahasa: Claude Opus 5 (claude-opus-5) via Anthropic SDK,
                                      │     adaptive thinking, streaming, pemanggilan alat (tool use)
                                      │  2. Alat = fungsi baca-saja ke lapisan semantik SIDAK
                                      │     (tabel indikator prakomputasi, bukan data baris)
                                      │  3. Pengetahuan statis (metodologi, glosarium, batasan data)
                                      │     dimuat di system prompt dengan prompt caching
                                      ▼
                             Jawaban terstruktur: teks + angka + tautan tampilan (+ spesifikasi grafik kecil)
```

- **Alat baca-saja** (skema JSON ketat, `strict: true`): `cari_faskes`, `ambil_indikator`, `daftar_temuan`, `jelaskan_temuan`, `bandingkan_sebaya`, `aliran_pasien`, `ringkas_wilayah`, `buka_tampilan`. Tidak ada alat tulis, tidak ada SQL bebas.
- **Lapisan semantik**: kamus indikator (nama, definisi, satuan, cara hitung, sumber) yang sama dipakai UI dan asisten, sehingga angka di chat selalu sama dengan angka di layar.
- **Keluaran terstruktur**: jawaban dipaksa ke skema `{teks, angka:[{label,nilai,satuan,sumber}], tautan:[...], grafik?}` agar UI dapat merender kartu angka dan tombol "buka tampilan".
- **Pengetahuan statis** di system prompt: ringkasan metodologi O/E, definisi tiap modul, daftar putih, batasan Data Sampel, gaya bahasa. Diletakkan di awal dan dibekukan agar cache prompt efektif.
- **Model**: `claude-opus-5` dengan adaptive thinking dan streaming; `fallbacks` sisi server diaktifkan sesuai anjuran SDK. Model dapat diganti lewat konfigurasi; bila panitia mensyaratkan model lokal, lapisan alat tetap sama.

### 7.4 Pagar pengaman

1. **Tidak ada data identitas** di jangkauan asisten: alat hanya mengembalikan agregat per faskes/wilayah, sel <10 disamarkan. Asisten secara teknis tidak bisa menyebut peserta, SEP, kartu, atau dokter.
2. **Bahasa non-vonis**: system prompt melarang kata "fraud", "curang", "menipu" sebagai simpulan; wajib menyebut "indikasi statistik" dan "perlu audit".
3. **Wajib berangka dan bersumber**: setiap klaim kuantitatif harus berasal dari hasil alat; bila alat tidak mengembalikan data, asisten berkata "tidak tersedia di data sampel".
4. **Lingkup**: pertanyaan di luar SIDAK (cuaca, opini politik, resep obat) ditolak singkat.
5. **Jejak audit**: setiap pertanyaan, alat yang dipanggil, dan jawaban dicatat lokal untuk ditinjau.
6. **Ketahanan demo**: 12 pertanyaan skenario disiapkan jawaban cadangannya (cache lokal) agar demo tetap jalan bila koneksi API terputus; ditandai "jawaban tersimpan" di UI.

### 7.5 Antarmuka

- Panel samping yang dapat dibuka di semua halaman; juga mode layar penuh untuk sesi tanya jawab juri.
- Saran pertanyaan (chips) yang berubah sesuai konteks halaman.
- Jawaban menampilkan kartu angka, tombol "Buka di peta / antrean / profil", dan catatan sumber.
- Bahasa Indonesia baku ringkas; panjang jawaban default ≤120 kata kecuali diminta rinci.

### 7.6 Evaluasi

Set uji 40 pertanyaan (30 dalam lingkup, 5 di luar lingkup, 5 jebakan identitas/vonis) dengan jawaban acuan dari tabel indikator. Kriteria lulus per pertanyaan: alat yang benar dipanggil, angka cocok ±0 (karena dari tabel yang sama), tautan benar, tidak melanggar pagar. Dijalankan otomatis setiap kali system prompt atau alat berubah.

---

## 8. Kebutuhan fungsional per halaman

| # | Halaman | Kebutuhan inti |
|---|---|---|
| F-1 | **Beranda kota** | 4 ubin KPI (faskes perlu perhatian, rupiah selisih tertimbang, tren 3 bulan, cakupan data); peta L1 kecil; antrean audit 10 teratas; panel Tanya SIDAK |
| F-2 | **Peta** | Pemilih tingkat L1/L2/L3, pemilih modul dan indikator, legenda kuantil, tooltip, klik → panel wilayah, saklar lapisan konteks (penduduk, lansia, faskes nyata), atribusi sumber |
| F-3 | **Antrean audit** | Tabel lintas modul: faskes anonim, kelas, kepemilikan, modul, O/E, z, rupiah, status stabilitas, status tindak lanjut; filter dan urut; ekspor CSV |
| F-4 | **Profil faskes** | Empat kartu modul dengan status; grafik O/E bulanan; kartu penjelasan; tiga pembanding sebaya; daftar sampel klaim teknis; tombol "tandai sedang diaudit" |
| F-5 | **Halaman modul** (×4) | Definisi singkat, peringkat faskes, grafik khas modul (§4), lapisan daftar putih sebelum/sesudah, unduh metodologi |
| F-6 | **Metodologi & data** | Penjelasan O/E untuk awam, kinerja model, batasan Data Sampel, daftar sumber terbuka dengan tanggal, pernyataan privasi |
| F-7 | **Tanya SIDAK** | §7 |

Kebutuhan umum: bahasa Indonesia; angka format Indonesia (titik ribuan, koma desimal); tombol "Bagaimana angka ini dihitung?" di setiap KPI; tidak ada halaman yang memuat identitas.

---

## 9. Skenario demo

### 9.1 Skenario utama (5 menit, presenter)

1. **Masalah (30 dtk)** — Beranda: "Di Semarang, 2.769 rawat inap sampel, 20 RS. Per klaim semua sah. Per faskes, inilah yang terlihat." Tunjuk ubin rupiah selisih.
2. **Peta (45 dtk)** — L1 Jawa Tengah readmisi O/E; klik Semarang → L2 kecamatan dengan titik RS nyata dan choropleth lansia. Sebutkan label konteks vs deteksi.
3. **Readmisi (60 dtk)** — Halaman modul #16: rentang 2%–34%; satu RS dengan angka mentah tinggi tetapi Expected tinggi (hijau) vs satu RS ditandai (merah). Buka kartu penjelasan.
4. **Severity (45 dtk)** — Modul #4: dua RS di 22–23%. Kelas A lolos setelah penyesuaian, swasta setara B tidak. "Ini yang membuat sistem adil."
5. **Fragmentasi (45 dtk)** — Modul #9: saklar daftar putih klinis. Faskes dialisis 93% dan RS bedah 67% memutih; RS swasta 49–50% tersisa.
6. **Rujukan (30 dtk)** — Modul #3: FKTP 51% non-spesialistik vs median 12%; peta aliran L3 dari kab/kota tetangga.
7. **Tanya SIDAK (45 dtk)** — Ketik: "RS mana yang paling perlu diperhatikan dan berapa rupiahnya?" lalu "Kenapa RS itu ditandai?" Jawaban berangka dengan tombol buka profil.
8. **Penutup (20 dtk)** — Antrean audit: "Auditor cabang mulai dari sini, bukan dari 30 ribu klaim."

### 9.2 Skenario juri memegang kendali

Layar Tanya SIDAK layar penuh dengan 8 saran pertanyaan, termasuk satu jebakan ("siapa dokternya?") untuk memperlihatkan pagar pengaman.

---

## 10. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| **Privasi** | Hanya Data Sampel anonim; `refs/data_sample_real.csv` diblokir di kode; sel <10 disamarkan; tidak ada identitas di UI, ekspor, log, maupun alat asisten |
| **Kinerja** | Semua indikator prakomputasi; respons halaman <1 dtk; geometri disederhanakan (≤1 MB per lapisan) |
| **Luring** | Aplikasi dan peta berjalan tanpa internet (GeoJSON lokal, tanpa ubin basemap daring; basemap daring opsional bila ada koneksi). Hanya Tanya SIDAK yang butuh internet, dengan cadangan jawaban tersimpan |
| **Reproduksibilitas** | Satu perintah membangun ulang seluruh tabel indikator dari CSV Data Sampel; versi data dan model dicatat |
| **Aksesibilitas** | Palet peta aman buta warna (hindari merah-hijau murni bersandingan; gunakan warna + simbol/status teks); kontras teks WCAG AA |
| **Keamanan** | Kunci API di variabel lingkungan, tidak di repositori; asisten hanya alat baca |
| **Bahasa** | Antarmuka dan asisten berbahasa Indonesia |

---

## 11. Arsitektur dan tumpukan teknologi (usulan, belum diputuskan)

```
CSV Data Sampel ─► pipeline Python (pandas/DuckDB; model dari model/*.py)
                     ─► tabel indikator Parquet/SQLite + GeoJSON lokal
                     ─► API baca (FastAPI) ──► UI web (React + MapLibre GL, grafik ringan)
                                         └──► Tanya SIDAK (Anthropic SDK, tool use)
```

- **Pipeline**: Python 3.11, pandas, DuckDB untuk agregasi cepat, scikit-learn (model sudah ada), pyarrow.
- **API**: FastAPI; endpoint = alat yang sama dipakai asisten (satu lapisan semantik).
- **UI**: React + MapLibre GL untuk peta vektor tanpa ketergantungan kunci; ECharts/Recharts untuk grafik. Alternatif cepat bila waktu terbatas: Streamlit + pydeck dengan fungsi yang sama tetapi polesan lebih rendah. Keputusan di K-3.
- **Asisten**: Anthropic SDK (Python), `claude-opus-5`, tool runner, structured outputs, prompt caching untuk pengetahuan statis, streaming ke UI.
- **Paket demo**: satu laptop, Docker Compose atau skrip start tunggal; data dan geometri disertakan; repositori publik tanpa CSV Data Sampel (unduh terpisah sesuai ketentuan BPJS).

---

## 12. Keputusan yang dibutuhkan

| # | Keputusan | Rekomendasi | Batas waktu |
|---|---|---|---|
| K-1 | Nama SIDAK dan penjabarannya; ubah judul slide 1 dan seluruh "SORAI" | Pakai SIDAK dengan judul proposal tetap; bila ingin akronim yang rapi per kata, ubah judul menjadi "Sistem Deteksi Anomali Klaim" dan sesuaikan deck | sebelum revisi deck |
| K-2 | Konfirmasi ke panitia bahwa Data Sampel BPJS 2025 diizinkan untuk demo (Admin WA 0858-3771-6188) | Kirim pertanyaan tertulis, simpan jawabannya | segera |
| K-3 | Tumpukan UI: React+MapLibre (polesan) vs Streamlit (kecepatan) | React+MapLibre jika ada ≥2 minggu pengembangan; jika tidak, Streamlit | sebelum mulai implementasi |
| K-4 | Sumber batas kecamatan: BIG vs GADM vs OSM | GADM/OSM untuk demo (tersedia dan bebas), BIG untuk pilot | minggu 1 |
| K-5 | Perluasan daftar diagnosis non-spesialistik dari 20 ke 144 | Lakukan; meningkatkan kredibilitas modul #3 | minggu 1 |
| K-6 | Model asisten: Claude Opus 5 (rekomendasi SDK) vs model lain | `claude-opus-5`; abstraksi alat memungkinkan ganti model | minggu 2 |

---

## 13. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Juri menganggap faskes anonim "tidak nyata" | kredibilitas | Label jelas, tunjukkan bahwa di pilot kode asli tersedia; peta konteks memakai faskes nyata dari data publik |
| Koneksi internet putus saat demo | Tanya SIDAK gagal | Jawaban tersimpan untuk 12 pertanyaan skenario; peta dan data sepenuhnya luring |
| Asisten mengarang angka | kepercayaan | Keluaran terstruktur dari alat saja; set uji 40 pertanyaan; log |
| Data terbuka tidak tersedia dalam format mesin (BPS, RS Online) | lapisan konteks kosong | Salin manual dari publikasi ke CSV dengan sumber dan tanggal; batasi ke indikator yang pasti ada (penduduk, faskes OSM) |
| Volume RS kecil di sampel membuat pita kepercayaan lebar | banyak status "diamati" | Tampilkan pita kepercayaan; jelaskan bahwa data penuh (100×) menyempitkannya |
| Ketidaksengajaan memuat data identitas | pelanggaran aturan | Blokir nama berkas di kode; tinjauan layar akhir dengan daftar periksa |
| Waktu pengembangan | demo tidak selesai | Prioritas: F-1, F-3, F-4, modul #16 dan #4 dulu; peta L1; asisten dengan 5 alat inti; sisanya bertahap |

---

## 14. Tahapan (rencana, belum dimulai)

| Tahap | Keluaran | Perkiraan |
|---|---|---|
| T0 | Keputusan K-1…K-6; unduh dan verifikasi data terbuka; `sumber_data_terbuka.md` | 3 hari |
| T1 | Pipeline indikator empat modul untuk Jawa Tengah/Semarang; tabel Parquet; set uji angka | 1 minggu |
| T2 | UI: beranda, antrean, profil faskes, peta L1/L2 | 1 minggu |
| T3 | Halaman modul, daftar putih, peta L3 aliran | 4 hari |
| T4 | Tanya SIDAK: alat, system prompt, keluaran terstruktur, set uji 40 pertanyaan, jawaban cadangan | 4 hari |
| T5 | Latihan demo, rekaman video cadangan, tinjauan privasi layar demi layar | 2 hari |

---

## 15. Pertanyaan terbuka

1. Apakah panitia mengizinkan menampilkan nama RS nyata dari sumber publik pada lapisan konteks, meskipun tidak dikaitkan dengan hasil deteksi?
2. Apakah demo boleh menyebut kasus RSUD Kardinah sebagai konteks masalah? Rekomendasi: sebut sebagai "kasus di Jawa Tengah yang dilaporkan media" tanpa nama.
3. Apakah bobot sampel (PSTV15) cukup untuk ekstrapolasi rupiah tingkat kota, atau cukup tampilkan nilai sampel saja dengan label?
4. Perlu tidaknya mode "data penuh" simulasi untuk menunjukkan pita kepercayaan yang menyempit.

---

## Lampiran A · Glosarium untuk awam

- **O/E**: perbandingan kejadian nyata dengan kejadian yang diperkirakan wajar. 1,0 berarti sesuai perkiraan; 1,3 berarti 30% lebih banyak dari wajar.
- **Skor z**: seberapa jauh selisih itu dari kebetulan. Di atas 1,96 berarti kecil kemungkinan hanya kebetulan.
- **Rekan sebaya**: faskes lain dengan kelas, wilayah, dan jenis kasus serupa.
- **Daftar putih klinis**: pola yang memang wajar secara medis (misalnya cuci darah rutin) dan dikecualikan dari penandaan.
- **Severity**: tingkat keparahan kasus (I, II, III) yang menentukan tarif INA-CBG.
- **Readmisi**: dirawat inap lagi dalam 30 hari setelah pulang.
- **Fragmentasi**: layanan yang bisa satu kunjungan dipecah menjadi beberapa kunjungan.
