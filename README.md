# SIDAK — demo Kota Semarang

Sistem Deteksi Dini Pola Klaim Tidak Wajar di Fasilitas Kesehatan. Demo untuk Healthkathon BPJS Kesehatan 2026, Kategori 2 · Faskes, modul #3 rujukan tidak sesuai, #4 upcoding severity, #9 fragmentasi layanan, #16 readmisi.

Dokumen: rancangan produk `docs/PRD-SIDAK-DEMO-SEMARANG.md`, slide proposal `docs/PROPOSAL-SIDAK-FASKES-2026.pptx`.

## Struktur

```
sidak/
  pipeline/geo_prep.py   batas GADM, titik faskes OSM, demografi BPS -> web/public/data/geo/
  pipeline/build.py      Data Sampel BPJS -> indikator 4 modul (O/E) -> web/public/data/*.json
  api/main.py            FastAPI: /api/chat + /api/ai/digest (SumoPod AI + alat baca-saja), /api/alat/*, statis dist/
  api/buat_cadangan.py   jawaban tersimpan untuk mode luring -> web/public/data/jawaban_cadangan.json
  web/                   React + Vite + MapLibre GL + Recharts
```

## Menjalankan

Prasyarat: Python 3.11+ (pandas, scikit-learn, pyarrow, fastapi, uvicorn, openai), Node 20+.
Data Sampel BPJS Kesehatan diletakkan di `../Data sampel CSV/reguler/` (tidak disertakan di repositori).

```bash
# 1. geometri dan data terbuka (sekali; sumber diunduh ke folder sementara, lihat sumber_data_terbuka.md)
python pipeline/geo_prep.py <folder berisi gadm2.zip, gadm3.zip, osm.json>

# 2. indikator (±10 menit pertama kali; hasil baca CSV di-cache di pipeline/_cache)
python pipeline/build.py

# 3. jawaban tersimpan untuk asisten (mode luring)
cd api && python buat_cadangan.py && cd ..

# 4. antarmuka (opsional; hasil build sudah disertakan di web/dist)
cd web && npm install && npm run build && cd ..

# 5. server (menyajikan dist/ dan /api)
set SUMODOP_API_KEY=...      # opsional; tanpa ini asisten memakai jawaban tersimpan/digest deterministik
cd api && uvicorn main:app --port 8000
# buka http://127.0.0.1:8000
```

Hasil build `web/dist` dan data indikator sudah ada di repositori, jadi untuk sekadar menjalankan demo cukup langkah 5.

Pengembangan antarmuka: `cd web && npm run dev` (port 5173, proxy `/api` ke 8000).

Model asisten diatur lewat `SIDAK_MODEL` (bawaan `MiniMax-M2.7-highspeed`).

## Menyimak demo (30 detik)

1. **"Ringkas 3 temuan utama untuk rapat audit."** — asisten Tanya AI SIDAK terbuka lewat tombol di kanan-atas, pertanyaan terisi dengan pertanyaan audit yang relevan.
2. Kartu jawaban muncul; klik **"Tanya tentang ini"** untuk pertanyaan lanjutan.
3. Klik **"Lihat di Antrean →"** — antrean audit terbuka dengan filter modul/status yang sama persis.
4. Di beranda, kartu **Bacaan Tanya AI SIDAK** mengarahkan ke halaman modul/faskes/antrean terkait (di bawah tab Peta/Beranda).

Tanpa `SUMODOP_API_KEY`, `GET /api/ai/digest` tetap menjawab lewat agregat deterministik (flag `deterministik: true`); dengan key, asisten memakai alat baca-saja yang sama dengan antarmuka.

## Prinsip data

- Hanya Data Sampel BPJS (anonim, kode faskes samaran). Berkas `refs/data_sample_real.csv` tidak boleh disentuh; pipeline memeriksa namanya.
- Tidak ada identitas peserta, dokter, SEP, atau nomor kartu di keluaran mana pun. Sampel klaim hanya kolom teknis.
- Titik faskes dan demografi di peta kecamatan adalah data publik (OSM, BPS) sebagai konteks, tidak dikaitkan dengan hasil deteksi.
- Asisten hanya memanggil alat baca-saja ke tabel indikator yang sama dengan antarmuka, sehingga angkanya selalu identik.
