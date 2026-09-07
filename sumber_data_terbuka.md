# Sumber data terbuka yang dipakai demo SIDAK

Diakses 5 September 2026. Semua hanya sebagai lapisan konteks; hasil deteksi berasal dari Data Sampel BPJS Kesehatan.

| Kode PRD | Data | Sumber dan cara ambil | Lisensi / catatan |
|---|---|---|---|
| G-1 | Batas kabupaten/kota Jawa Tengah (35) dan kecamatan Kota Semarang (16) | GADM 4.1, `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_2.json.zip` dan `gadm41_IDN_3.json.zip`; disaring NAME_1 = JawaTengah; kode BPS di CC_2/CC_3 | Bebas untuk akademik dan non-komersial; untuk pilot resmi ganti ke batas BIG (Ina-Geoportal) |
| G-4 | Titik RS, klinik, praktik dokter Kota Semarang (592 titik bernama: 34 RS, 551 klinik, 7 praktik) | Overpass API: `area["name"="Kota Semarang"]["admin_level"="5"]; nwr["amenity"~"hospital|clinic|doctors"](area)`; poligon diambil pusatnya | ODbL, wajib atribusi "© OpenStreetMap contributors"; kelengkapan tidak dijamin |
| D-1 | Penduduk per kecamatan (sensus 2010, 2020, proyeksi 2025) dan luas | BPS, *Kota Semarang Dalam Angka 2026* (27 Feb 2026), disalin dari tabel kecamatan di `en.wikipedia.org/wiki/Semarang`; nilai dimasukkan ke `pipeline/geo_prep.py` | Publikasi resmi BPS; salinan manual, cocokkan ulang dengan PDF BPS sebelum pilot |
| D-5 | Selisih tarif severity III vs II | Dihitung langsung dari tarif klaim Data Sampel per kelompok INA-CBG, bukan dari lampiran PMK | Untuk pilot, ganti dengan tabel tarif PMK |
| D-6 | Daftar diagnosis non-spesialistik | 40 kode ICD-10 tersering dari PPK dokter FKTP (PMK 5/2014); daftar di `pipeline/build.py` (NONSPES) | Perluas ke 144 kode penuh saat pilot |

Belum dipakai (status V di PRD, perlu verifikasi format mesin): RS Online Kemenkes (kelas/tempat tidur RS bernama), Satu Data Kota Semarang, Profil Kesehatan Dinkes Kota Semarang.
