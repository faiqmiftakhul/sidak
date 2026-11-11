# Metode Observed/Expected (O/E) di SIDAK

Dokumen teknis tentang bagaimana nilai *observed* (O) dan *expected* (E) dihitung untuk keempat modul SIDAK, termasuk model machine learning yang dipakai. Sumber kebenaran: `sidak/pipeline/build.py`. Angka metrik diambil dari `build.log` dan `web/public/data/semarang.json` hasil build terakhir.

## 1. Gambaran umum

SIDAK tidak menilai satu klaim benar atau salah. SIDAK menilai **faskes**: apakah jumlah kejadian tertentu di faskes itu lebih banyak daripada yang wajar untuk pasien dan kasus yang ditanganinya.

Setiap modul mengikuti pola yang sama:

1. **Unit analisis:** satu baris = satu kejadian (rawat inap, kunjungan rawat jalan, atau kunjungan FKTP).
2. **Label `y` (observed per baris):** 1 jika kejadian yang dicurigai terjadi, 0 jika tidak.
3. **Probabilitas `p` (expected per baris):** peluang `y = 1` untuk baris itu *seandainya ditangani oleh faskes rata-rata nasional*, mengingat karakteristik pasien dan kasusnya.
4. **Agregasi per faskes:** `O = Σy`, `E = Σp`, lalu O/E, z-score, status, dan rupiah.

| Modul | Unit | `y = 1` jika | Cara menghitung `p` |
|---|---|---|---|
| #16 Readmisi | Rawat inap (RITL) | Pasien dirawat inap lagi (di faskes mana pun) 0–30 hari setelah pulang | **Model ML** (gradient boosting) |
| #4 Upcoding severity | Rawat inap (RITL) dengan tingkat keparahan I/II/III | Diklaim keparahan III | **Model ML** (gradient boosting) |
| #9 Fragmentasi layanan | Kunjungan rawat jalan (RJTL) | Pasien kembali ke faskes yang sama 1–7 hari setelah kunjungan sebelumnya | Standardisasi tidak langsung: rasio nasional per INA-CBG |
| #3 Rujukan tidak sesuai | Kunjungan sakit FKTP | Pasien dirujuk lanjut ke FKRTL | Standardisasi tidak langsung: rasio nasional per (diagnosis × jenis FKTP) |

Data: Data Sampel BPJS Kesehatan Edisi 2025, tahun pelayanan 2024 (FKRTL: 1.697.886 baris dari 3.088 faskes; FKTP: 2.596.846 kunjungan sakit). Model dilatih pada **data nasional**, lalu hasilnya ditampilkan untuk Jawa Tengah dan Kota Semarang.

## 2. Kerangka O/E bersama (`tabel_oe`)

Untuk setiap faskes *f* dengan himpunan baris *i ∈ f*:

```
n      = jumlah baris
O      = Σ y_i                       (kejadian teramati)
E      = Σ p_i                       (kejadian yang diharapkan)
O/E    = O / E                       (Rasio Kewajaran Klaim)
V      = Σ p_i (1 − p_i)             (varians O di bawah hipotesis "faskes wajar")
z      = (O − E) / √V
selisih = max(O − E, 0)              (kelebihan kejadian)
```

**Stabilitas.** Baris dibagi dua menurut bulan ganjil dan genap. Faskes disebut `stabil` jika O/E > 1 di **kedua** paruh. Ini mencegah faskes ditandai karena lonjakan satu-dua bulan saja.

**Status:**

| Status | Syarat |
|---|---|
| `volume_rendah` | n < batas minimum (readmisi 30, severity 30, fragmentasi 100, rujukan 100) |
| `perhatian` | O/E > 1,05 **dan** z > 1,96 **dan** stabil |
| `diamati` | O/E > 1,05 dan z > 1,96 tapi tidak stabil, **atau** O/E > 1,05 dan 1,0 < z ≤ 1,96 |
| `wajar` | selain di atas |

**Rupiah.** `rupiah = selisih × biaya per kejadian` (definisi biaya berbeda per modul, lihat di bawah). Karena Data Sampel adalah sampel berbobot, `rupiah_tertimbang = rupiah × rerata bobot (PSTV15)` faskes itu, sebagai perkiraan nilai di populasi. Hanya faskes berstatus `perhatian`/`diamati` yang dijumlahkan ke total rupiah.

**Penyumbang.** Untuk faskes bertanda, O dan E dipecah per `dimensi` (INA-CBG dasar untuk FKRTL, diagnosis untuk FKTP), lalu tiga dimensi dengan O − E terbesar disimpan sebagai `kontributor`. Ini yang menjawab "kenapa faskes ini ditandai".

### Contoh hitung (ilustrasi)

Sebuah RS memiliki 400 rawat inap. Model memberi `p` rata-rata 0,12, sehingga E = 48. Teramati O = 66 readmisi.

```
O/E = 66 / 48            = 1,375
V   ≈ 400 × 0,12 × 0,88  = 42,2   (pendekatan; aslinya Σ p_i(1−p_i) per baris)
z   = (66 − 48) / √42,2  = 2,77
selisih = 18 kejadian → 18 × Rp 5.698.402 ≈ Rp 102,6 juta (nilai sampel)
```

Jika O/E di bulan ganjil dan genap sama-sama > 1, statusnya `perhatian`.

## 3. Modul #16 Readmisi 30 hari (ML)

### 3.1 Pembentukan label

1. Ambil semua baris RITL, urutkan per peserta (`PSTV01`) menurut tanggal masuk.
2. Untuk setiap rawat inap (rawat inap indeks), cari rawat inap berikutnya milik peserta yang sama, **di faskes mana pun**.
3. `jeda = tanggal masuk berikutnya − tanggal pulang indeks` (hari).
4. `y = 1` jika 0 ≤ jeda ≤ 30.
5. Dikecualikan: pasien yang pulang meninggal (5.085 baris) dan rawat inap yang pulang ≥ 1 Des 2024 karena jendela 30 harinya belum lengkap (15.800 baris).

Readmisi selalu diatribusikan ke **faskes rawat inap indeks**, walaupun pasien dirawat ulang di RS lain.

Base rate nasional: **13,6%**.

### 3.2 Fitur (X)

| Fitur | Kolom | Jenis | Keterangan |
|---|---|---|---|
| Kode INA-CBG lengkap | `FKL19` | kategori | Termasuk digit keparahan |
| Status pulang | `FKL14` | kategori | Misalnya sembuh, atas persetujuan dokter, pulang paksa, dirujuk |
| Diagnosis masuk | `FKL15A` | kategori | ICD-10 3 digit |
| Diagnosis primer | `FKL17A` | kategori | ICD-10 3 digit |
| Kelas rawat | `FKL13` | kategori | Kelas 1/2/3 (kelas bangsal, bukan tipe RS) |
| Segmen peserta | `FKL12` | kategori | PBI, PPU, PBPU, dst. |
| Jenis kelamin | `PSTV05` | kategori | Dari tabel kepesertaan |
| Casemix main group | `FKL20` | kategori | Digit pertama INA-CBG |
| Umur | dari `PSTV03` | numerik | Tahun, dipotong 0–110 |
| Lama rawat (LOS) | `FKL04 − FKL03` | numerik | Hari |
| Biaya tagih | `FKL47` | numerik | Rupiah, rawat inap indeks |
| Riwayat RITL 180 hari | turunan | numerik | Jumlah rawat inap peserta dalam 180 hari sebelumnya **di faskes lain** |
| Riwayat RJTL 180 hari | turunan | numerik | Jumlah kunjungan rawat jalan dalam 180 hari sebelumnya **di faskes lain** |
| Jeda dari rawat inap sebelumnya | turunan | numerik | Hari sejak pulang rawat inap terakhir (9999 jika tidak ada) |
| Bulan | dari `FKL03` | numerik | 1–12, untuk musiman |

Riwayat sengaja dihitung **di luar faskes yang dinilai**. Kalau riwayat di faskes yang sama ikut dihitung, pola readmisi berulang milik faskes itu sendiri akan "diserap" ke dalam E dan tidak terdeteksi.

Kategori dibekukan dari data latih: 200 nilai terbanyak per kolom dipertahankan, sisanya menjadi `LAIN`.

**Tidak termasuk fitur:** ID faskes, tipe/kelas RS (`FKL09`), provinsi/kabupaten faskes. Akibatnya E adalah "angka harapan bila pasien yang sama ditangani faskes rata-rata nasional". Lihat bagian 7.1.

### 3.3 Target (y) dan contoh dataset latih

Target: `y` = readmisi ≤ 30 hari (biner). Satu baris = satu rawat inap indeks.

Contoh baris (**ilustrasi, nilai fiktif**, bukan data asli):

| FKL19 | FKL14 | FKL15A | FKL17A | FKL13 | FKL12 | kelamin | FKL20 | umur | los | FKL47 | riw_ritl | riw_rjtl | jeda_lalu | bln | **y** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| I-4-12-II | Atas persetujuan dokter | I50 | I50 | Kelas 3 | PBI APBN | P | I | 67 | 6 | 7.450.000 | 1 | 4 | 41 | 3 | **1** |
| J-4-16-I | Atas persetujuan dokter | J18 | J18 | Kelas 2 | PPU | L | J | 34 | 4 | 3.900.000 | 0 | 0 | 9999 | 5 | **0** |
| N-4-10-III | Atas persetujuan dokter | N18 | N18 | Kelas 3 | PBPU | L | N | 58 | 9 | 14.200.000 | 2 | 11 | 18 | 8 | **1** |
| O-6-10-I | Atas persetujuan dokter | O80 | O80 | Kelas 3 | PBI APBD | P | O | 26 | 2 | 2.800.000 | 0 | 1 | 9999 | 10 | **0** |

Model menghasilkan `p` per baris, misalnya 0,41 untuk baris pertama (gagal jantung, lansia, readmisi baru-baru ini) dan 0,04 untuk baris keempat (persalinan normal).

### 3.4 Model dan validasi

- Algoritma: `HistGradientBoostingClassifier` (scikit-learn), `max_iter=400`, `learning_rate=0.06`, `max_leaf_nodes=31`, `min_samples_leaf=60`, `l2_regularization=1.0`, early stopping (12% validasi, berhenti setelah 25 iterasi tanpa perbaikan), `random_state=20260905`.
- **Pembagian waktu:** latih = rawat inap yang pulang sebelum 1 Juli 2024 (**94.599 baris**), uji = pulang ≥ 1 Juli 2024 (**78.727 baris**). Pembagian berdasarkan waktu meniru pemakaian nyata: model dari masa lalu dipakai menilai bulan-bulan berikutnya.
- Hasil: berhenti di 81 iterasi. **AUC uji 0,810**, dibanding **0,759** untuk pembanding sederhana (rerata readmisi per kode INA-CBG). O/E agregat data uji **0,969**, artinya model sedikit memperkirakan lebih tinggi daripada kenyataan, sehingga O/E faskes cenderung konservatif.
- Setelah dilatih, model memberi `p` untuk **semua** baris (latih dan uji), lalu masuk ke `tabel_oe`.

### 3.5 Rupiah

Biaya per kejadian = rerata biaya tagih (`FKL47`) rawat inap indeks yang diikuti readmisi = **Rp 5.698.402**. Ini proksi; biaya rawat inap ulangnya sendiri belum dipakai (lihat 7.5).

## 4. Modul #4 Upcoding severity (ML)

### 4.1 Pembentukan label

- Populasi: rawat inap (RITL) yang tingkat keparahan INA-CBG-nya I, II, atau III (dibaca dari `FKL23`).
- `y = 1` jika keparahan III. Pangsa III nasional: **4,8%**.
- Pertanyaannya: "dengan diagnosis dan profil pasien seperti ini, seberapa besar peluang kasus wajar diklaim di keparahan III?" Faskes yang jauh lebih sering mengklaim III dibanding harapannya menjadi kandidat upcoding.

### 4.2 Fitur (X)

| Fitur | Kolom | Jenis |
|---|---|---|
| INA-CBG dasar (tanpa digit keparahan) | dari `FKL19`, mis. `I-4-12` | kategori |
| Diagnosis masuk | `FKL15A` | kategori |
| Diagnosis primer | `FKL17A` | kategori |
| Kelas rawat | `FKL13` | kategori |
| Status pulang | `FKL14` | kategori |
| Segmen peserta | `FKL12` | kategori |
| Jenis kelamin | `PSTV05` | kategori |
| Umur | dari `PSTV03` | numerik |
| Lama rawat | `FKL04 − FKL03` | numerik |
| Bulan | dari `FKL03` | numerik |

Kode INA-CBG **lengkap** sengaja tidak dipakai: digit terakhirnya adalah keparahan itu sendiri, sehingga akan membocorkan target. Biaya tagih juga tidak dipakai karena tarif ditentukan oleh keparahan.

### 4.3 Contoh dataset latih

**Ilustrasi, nilai fiktif:**

| basis | FKL15A | FKL17A | FKL13 | FKL14 | FKL12 | kelamin | umur | los | bln | **y (III?)** |
|---|---|---|---|---|---|---|---|---|---|---|
| J-4-16 | J18 | J18 | Kelas 3 | Atas persetujuan dokter | PBI APBN | L | 72 | 9 | 2 | **1** |
| J-4-16 | J18 | J18 | Kelas 2 | Atas persetujuan dokter | PPU | P | 41 | 3 | 2 | **0** |
| K-4-17 | K35 | K35 | Kelas 1 | Atas persetujuan dokter | PPU | L | 23 | 3 | 6 | **0** |
| I-4-12 | I50 | I50 | Kelas 3 | Meninggal | PBPU | P | 80 | 12 | 11 | **1** |

### 4.4 Model dan validasi

- Algoritma dan hiperparameter sama dengan readmisi.
- Pembagian waktu sama: latih **97.080 baris**, uji **97.131 baris**.
- Hasil: 115 iterasi, **AUC uji 0,871**. O/E agregat uji **0,905**, artinya di paruh kedua 2024 klaim keparahan III lebih jarang daripada yang diperkirakan model (lihat 7.3).

### 4.5 Rupiah

Untuk setiap INA-CBG dasar: `delta = rerata tarif III − rerata tarif II` (hanya yang positif; median nasional **Rp 2.938.911**). Biaya per kejadian sebuah faskes = rerata `delta` dari kasus-kasusnya, sehingga `rupiah = selisih × delta_faskes`.

## 5. Modul #9 Fragmentasi layanan (standardisasi tidak langsung)

- Populasi: kunjungan rawat jalan (RJTL) 2024, **1.503.675 kunjungan**.
- `y = 1` jika peserta yang sama datang lagi ke **faskes yang sama** 1–7 hari setelah kunjungan sebelumnya. Kunjungan di hari yang sama (jeda 0) tidak dihitung.
- **Daftar putih:** terapi berseri yang memang wajar berulang dikeluarkan dari O dan E: deskripsi INA-CBG mengandung dialisis, kemoterapi, radioterapi, rehabilitasi, fisioterapi, transfusi, hemofilia, thalassemia, atau diagnosis primer Z49, Z50, Z51, Z54, D56, D57, D66, D67. Rasio 7 hari nasional turun dari **34,8%** menjadi **23,8%** setelah daftar putih (pangsa kunjungan putih 17,5%).
- **Expected:** `p` = rasio kunjungan ulang 7 hari **nasional per kode INA-CBG** (hanya kode dengan ≥ 30 kunjungan; selebihnya memakai rasio nasional keseluruhan). Ini standardisasi tidak langsung, bukan ML.
- **Rupiah:** selisih × rerata biaya tagih RJTL faskes tersebut (median nasional **Rp 249.525**).

Contoh data (**ilustrasi**):

| faskes | FKL19 (RJ) | putih? | gap (hari) | **y** | p (rasio nasional kode itu) |
|---|---|---|---|---|---|
| RS-A | Q-5-44-0 | tidak | 4 | **1** | 0,21 |
| RS-A | Q-5-44-0 | tidak | 30 | **0** | 0,21 |
| RS-A | N-3-15-0 (hemodialisis) | **ya** | 3 | dikeluarkan | – |

## 6. Modul #3 Rujukan tidak sesuai (standardisasi tidak langsung)

- Populasi: kunjungan FKTP kapitasi 2024 berjenis "KUNJUNGAN SAKIT", **2.596.846 kunjungan**.
- `y = 1` jika status pulang "RUJUK LANJUT". Rasio rujuk nasional **15,1%**.
- **Expected:** `p` = rasio rujuk nasional per **(diagnosis ICD-10 3 digit × jenis FKTP)** bila sel itu berisi ≥ 50 kunjungan; jika tidak, rasio nasional per diagnosis (≥ 50); jika tidak juga, rasio nasional keseluruhan. Jenis FKTP (puskesmas, klinik pratama, dokter praktik perorangan) ikut menjadi pembanding karena kapasitasnya berbeda.
- **Indikator tambahan:** `pangsa_nonspes` = porsi rujukan sebuah FKTP yang diagnosisnya termasuk 40 diagnosis non-spesialistik (mis. J06, I10, E11, K30). Rerata nasional **18,1%**. Indikator ini ditampilkan sebagai konteks, tidak masuk ke E.
- **Rupiah:** selisih × rerata biaya tagih kunjungan RJTL yang perujuknya FKTP = **Rp 312.789** per rujukan.

Contoh data (**ilustrasi**):

| faskes | jenis FKTP | dx | **y (dirujuk?)** | p |
|---|---|---|---|---|
| FKTP-B | Puskesmas | J06 | **1** | 0,02 |
| FKTP-B | Puskesmas | E11 | **1** | 0,28 |
| FKTP-B | Puskesmas | K04 | **0** | 0,19 |

Merujuk pasien ISPA (J06) jauh lebih "mahal" dalam O − E daripada merujuk pasien diabetes (E11), karena harapan rujuknya jauh lebih rendah.

## 7. Catatan teknis dan keterbatasan

Bagian ini penting dibaca sebelum coaching dan Demo Day, karena beberapa poin kemungkinan ditanyakan juri.

### 7.1 Pembanding "sekelas, se-wilayah" belum diimplementasikan untuk FKRTL
Narasi video menyebut angka wajar dihitung terhadap faskes "sekelas, se-wilayah, dengan campuran kasus yang mirip". Di `build.py`, model readmisi dan severity serta tabel fragmentasi **tidak** memakai tipe RS (`FKL09`) maupun wilayah sebagai fitur. Penyesuaiannya berbasis **pasien dan kasus** (case-mix), dibandingkan dengan standar nasional. Hanya modul rujukan yang memakai jenis FKTP.

Ada dua pilihan:
- **Ubah narasi** menjadi "dibandingkan dengan pasien serupa secara nasional". Ini argumen yang sah: RS kelas A tidak "dimaafkan" hanya karena kelasnya; yang dimaafkan adalah pasiennya yang lebih berat.
- **Tambahkan `FKL09` dan provinsi** sebagai fitur, sehingga pembandingnya benar-benar sekelas dan se-wilayah. Risikonya: pola tidak wajar yang dilakukan bersama oleh satu kelas RS ikut terserap ke dalam E.

Sebaiknya hitung keduanya dan tampilkan perbedaannya. Yang penting, klaim di slide harus sama dengan kode.

### 7.2 Prediksi in-sample untuk paruh latih
`p` untuk baris Januari–Juni berasal dari model yang dilatih pada baris itu sendiri. Regularisasi (`min_samples_leaf=60`, early stopping) membatasi overfitting, tetapi O/E paruh pertama tetap sedikit tertarik ke 1. Perbaikan standar: **cross-fitting**, yaitu prediksi out-of-fold K-lipatan, sehingga setiap baris dinilai oleh model yang tidak pernah melihatnya. Ini juga bahan cerita ML yang baik.

### 7.3 Pergeseran waktu pada severity
O/E agregat uji severity 0,905: di paruh kedua 2024 model memperkirakan keparahan III terlalu tinggi sekitar 10%. Akibatnya O/E faskes di paruh kedua tertekan (konservatif). Opsi: kalibrasi ulang per bulan (misalnya isotonic/Platt pada data terbaru), atau latih ulang berkala.

### 7.4 Fitur yang bisa dimanipulasi
- **LOS** dipakai sebagai fitur di kedua model. Faskes yang memperpanjang lama rawat bersamaan dengan menaikkan keparahan akan menaikkan E-nya sendiri, sehingga sebagian upcoding tersamarkan.
- **Biaya tagih** (`FKL47`) dipakai di model readmisi; nilai ini ditentukan oleh koding faskes itu sendiri.

Opsi: latih versi tanpa LOS/biaya dan bandingkan peringkatnya. Faskes yang naik tajam di versi tanpa LOS layak diperhatikan.

### 7.5 Proksi biaya readmisi
Biaya per readmisi saat ini adalah rerata biaya **rawat inap indeks**, bukan biaya rawat inap ulangnya. Ada baris kode yang dimatikan (`if False`) untuk versi berbasis biaya rawat ulang. Sebaiknya diputuskan dan dijelaskan.

### 7.6 Daftar putih N185 tidak pernah cocok
Pola daftar putih fragmentasi memuat `N185`, padahal `FKL17A` adalah ICD-10 **3 digit**, sehingga `N185` tidak akan pernah cocok. Dampaknya kecil karena hemodialisis sudah tertangkap lewat deskripsi INA-CBG ("DIALISIS"), tetapi sebaiknya dirapikan.

### 7.7 Fragmentasi dan rujukan belum memakai ML
Dua modul ini memakai tabel rasio nasional. Metode ini sah dan mudah dijelaskan, tetapi hanya menyesuaikan satu-dua dimensi (kode INA-CBG; diagnosis × jenis FKTP). Meng-upgrade keduanya ke model gradient boosting dengan fitur umur, jenis kelamin, segmen, dan riwayat akan membuat keempat modul konsisten dan memperkuat kriteria "pendekatan GenAI/ML".

### 7.8 Asumsi independensi pada z-score
`V = Σ p(1−p)` menganggap setiap baris independen. Pada kenyataannya satu pasien bisa muncul berkali-kali, sehingga varians sebenarnya lebih besar (overdispersi) dan z-score cenderung terlalu tinggi. Syarat stabilitas antar paruh periode membantu meredamnya. Perbaikan lanjutan: shrinkage empirical Bayes atau model efek acak per faskes.

**Sudah ditambahkan: `z_od` (z disesuaikan untuk overdispersi).** Masukan coaching: pertimbangkan pengurutan audit berdasarkan z. z biasa naik seiring volume, sehingga di skala nasional hampir semua RS besar tampak signifikan. `z_overdispersi()` di `build.py` memakai metode efek acak aditif Spiegelhalter (2005), yaitu metode funnel plot SHMI:

```
se²  = V / E²                         (galat O/E per faskes)
φ    = rerata z² (z dipangkas 10%/90%), faskes bervolume cukup se-Indonesia
τ²   = max(0, (kφ − (k−1)) / (Σw − Σw²/Σw)),  w = 1/se²
z_od = (O/E − 1) / √(se² + τ²)
```

| Modul | k faskes | φ | τ (skala O/E) |
|---|---|---|---|
| #3 Rujukan | 10.319 | 4,00 | 0,216 |
| #4 Severity | 1.904 | 1,48 | 0,263 |
| #9 Fragmentasi | 2.104 | 15,56 | 0,266 |
| #16 Readmisi | 1.828 | 0,81 | 0 (tidak overdispersi; z_od = z) |

`z_od` **tidak** mengubah status. Nilai ini hanya dipakai untuk urutan: antrean punya opsi urut *Prioritas*, yaitu P1 (z_od ≥ 3), P2 (≥ 1,96), dan P3, lalu rupiah tertimbang di dalam tiap kelas. Contoh: RS-31595 severity (n 670, O/E 1,46) punya z 6,19, tetapi z_od-nya 1,69, sehingga turun ke P3. Sebaliknya RS-31606 (n 140, O/E 3,12) tetap P1 dengan z_od 4,95. Di Kota Semarang, dari 67 temuan aktif, 5 masuk P1, 6 masuk P2, dan 56 masuk P3.

### 7.9 Rujukan belum ditautkan ke hasil di FKRTL
Narasi menyebut SIDAK "menautkan rujukan FKTP ke klaim RS-nya". Di `build.py`, modul rujukan menghitung O/E di sisi FKTP saja; tautan per kunjungan lewat `FKP02` (No Asal Rujukan) belum dipakai. Biaya hilirnya pun berupa rerata. Penautan ini bisa menjadi pembeda kuat dibanding tim "rujukan semu": misalnya, rujukan yang di FKRTL hanya berakhir pada kunjungan rawat jalan tanpa tindakan adalah sinyal rujukan yang tidak perlu.

## 8. Ringkasan hasil build terakhir (Kota Semarang)

| Modul | Faskes | Cukup volume | Perhatian | Diamati | Rupiah sampel |
|---|---|---|---|---|---|
| #3 Rujukan | 285 | 160 | 25 | 27 | Rp 134.583.899 |
| #4 Severity | 28 | 20 | 9 | 2 | Rp 529.253.935 |
| #9 Fragmentasi | 32 | 22 | 3 | 1 | Rp 34.882.246 |
| #16 Readmisi | 28 | 20 | 0 | 0 | Rp 0 |

Total: 317 faskes, 36 berstatus perlu perhatian, Rp 698.720.080 selisih di data sampel, atau Rp 46.416.205.019 setelah dikalikan bobot sampel.
