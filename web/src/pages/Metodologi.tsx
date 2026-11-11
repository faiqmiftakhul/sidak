import { Fragment } from 'react'
import { INFO, MODUL, num, oe, pct, rp, useData } from '../lib/data'

export default function Metodologi() {
  const { ring, demo } = useData()
  const M = ring.metrik
  return (
    <>
      <div className="eyebrow">Metodologi & data</div>
      <h1>Bagaimana angka-angka ini dihitung</h1>
      <p className="sub">Ditulis untuk pembaca awam. Rincian teknis tersedia di dokumentasi pipeline dan model (<b>penalaran model</b>: gradient boosting untuk readmisi dan severity; tabel standar untuk fragmentasi dan rujukan).</p>

      <div className="card">
        <h3>Satu kerangka untuk empat modul: O/E</h3>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Untuk setiap faskes kami hitung <b>Observed (O)</b>, jumlah kejadian yang benar-benar terjadi, dan <b>Expected (E)</b>, jumlah kejadian yang wajar bila faskes itu melayani pasien yang sama persis dengan cara rekan sebayanya. E adalah penjumlahan peluang per kejadian yang dihasilkan model atau tabel standar. <b>O/E</b> = 1,0 berarti sesuai perkiraan; 1,3 berarti 30% lebih banyak dari wajar. <b>Skor z</b> mengukur seberapa jauh selisih itu dari kebetulan (varian binomial Σp(1−p)); di atas 1,96 kecil kemungkinan hanya kebetulan.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Status <b>Perlu perhatian</b> diberikan bila O/E &gt; 1,05 <u>dan</u> z &gt; 1,96 <u>dan</u> polanya konsisten pada dua paruh periode (bulan ganjil vs genap). Bila melewati ambang tetapi tidak konsisten, atau hanya melewati sebagian ambang, statusnya <b>Diamati</b>. Faskes dengan volume di bawah minimum tidak dinilai. Selisih rupiah = (O − E) × biaya rata-rata per kejadian; nilai <b>tertimbang</b> mengalikan dengan bobot sampel peserta untuk menaksir skala populasi JKN.
        </p>
      </div>

      <div className="card">
        <h3>Mengurutkan antrean audit: skor z disesuaikan</h3>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          Skor z biasa membesar seiring volume. RS dengan puluhan ribu klaim dan O/E 1,1 bisa ber-z lebih tinggi daripada klinik dengan O/E 2,0, sehingga di skala nasional hampir semua RS besar tampak "signifikan". Sebaliknya, O/E menonjolkan faskes kecil yang angkanya mudah melonjak karena kebetulan.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          <b>Skor z disesuaikan</b> menambahkan variasi antarfaskes yang wajar (τ) ke galat setiap faskes, ditaksir dari sebaran nasional dengan metode efek acak aditif (Spiegelhalter 2005, dipakai pada funnel plot SHMI di NHS). Opsi urut <b>Prioritas</b> di antrean mengelompokkan temuan menjadi <b>P1</b> (z disesuaikan ≥ 3), <b>P2</b> (≥ 1,96), dan <b>P3</b>, lalu mengurutkan rupiah tertimbang di dalam tiap kelompok: polanya pasti tidak kebetulan, dan dampaknya besar. Status faskes tetap memakai aturan di atas; z disesuaikan hanya mengubah urutan.
        </p>
        {M.readmisi.overdispersi && <div className="kv" style={{ fontSize: 13 }}>
          {MODUL.map(m => M[m].overdispersi && <Fragment key={m}><span className="k">#{INFO[m].nomor} {INFO[m].pendek}</span><span>τ {num(M[m].overdispersi.tau, 3)} pada skala O/E · {num(M[m].overdispersi.k)} faskes nasional · φ {num(M[m].overdispersi.phi, 2)}</span></Fragment>)}
        </div>}
      </div>

      <h2>Per modul</h2>
      <div className="grid2">
        <div className="card">
          <h3>#{INFO.readmisi.nomor} Readmisi 30 hari</h3>
          <div className="kv" style={{ fontSize: 13 }}>
            <span className="k">Data latih</span><span>{num(M.readmisi.n_latih)} admisi indeks, pulang Jan–Jun 2024</span>
            <span className="k">Data uji</span><span>{num(M.readmisi.n_uji)} admisi, pulang Jul–Nov 2024</span>
            <span className="k">Dikecualikan</span><span>{num(M.readmisi.n_dikecualikan_meninggal)} meninggal, {num(M.readmisi.n_dikecualikan_jendela)} jendela terpotong (Desember)</span>
            <span className="k">Angka dasar</span><span>{pct(M.readmisi.base_rate)} readmisi</span>
            <span className="k">Model</span><span>Gradient boosting, {M.readmisi.iterasi} iterasi, tanpa penyeimbangan kelas</span>
            <span className="k">AUC uji</span><span><b>{num(M.readmisi.auc, 3)}</b> vs {num(M.readmisi.auc_strata, 3)} tabel INA-CBG</span>
            <span className="k">Kalibrasi</span><span>O/E agregat uji {oe(M.readmisi.oe_agregat_uji)}</span>
            <span className="k">Biaya per kejadian</span><span>{rp(M.readmisi.biaya_per_kejadian)}</span>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>Kalibrasi lebih penting daripada AUC: model yang menaksir terlalu tinggi akan membesarkan E semua RS dan menghapus temuan. Riwayat pasien dihitung hanya di luar RS yang dinilai (konfigurasi deteksi).</div>
        </div>
        <div className="card">
          <h3>#{INFO.severity.nomor} Upcoding severity</h3>
          <div className="kv" style={{ fontSize: 13 }}>
            <span className="k">Data latih / uji</span><span>{num(M.severity.n_latih)} / {num(M.severity.n_uji)} rawat inap</span>
            <span className="k">Kejadian</span><span>Severity III; pangsa nasional {pct(M.severity.pangsa_iii_nasional)}</span>
            <span className="k">Model</span><span>Gradient boosting, {M.severity.iterasi} iterasi; fitur klinis saja, tanpa kelas/kepemilikan RS</span>
            <span className="k">AUC uji</span><span>{num(M.severity.auc, 3)}</span>
            <span className="k">Kalibrasi</span><span>O/E agregat uji {oe(M.severity.oe_agregat_uji)}</span>
            <span className="k">Selisih tarif III−II</span><span>median {rp(M.severity.delta_tarif_median)} pada kelompok kasus yang sama</span>
          </div>
        </div>
        <div className="card">
          <h3>#{INFO.fragmentasi.nomor} Fragmentasi layanan</h3>
          <div className="kv" style={{ fontSize: 13 }}>
            <span className="k">Data</span><span>{num(M.fragmentasi.n_kunjungan)} kunjungan rawat jalan 2024</span>
            <span className="k">Kejadian</span><span>Kunjungan ulang 1–7 hari di RS sama; nasional {pct(M.fragmentasi.rate_nasional_7hr)}</span>
            <span className="k">Daftar putih</span><span>{pct(M.fragmentasi.pangsa_putih_nasional)} kunjungan berpola klinis wajar dikeluarkan; angka sesudahnya {pct(M.fragmentasi.rate_nasional_setelah_putih)}</span>
            <span className="k">Expected</span><span>Rasio nasional per kelompok INA-CBG (indirect standardization)</span>
            <span className="k">Biaya per kejadian</span><span>tarif rata-rata RJTL faskes tsb (median {rp(M.fragmentasi.biaya_per_kejadian_median)})</span>
          </div>
        </div>
        <div className="card">
          <h3>#{INFO.rujukan.nomor} Rujukan tidak sesuai</h3>
          <div className="kv" style={{ fontSize: 13 }}>
            <span className="k">Data</span><span>{num(M.rujukan.n_kunjungan)} kunjungan sakit FKTP 2024</span>
            <span className="k">Kejadian</span><span>Rujuk lanjut; nasional {pct(M.rujukan.rasio_rujuk_nasional)}</span>
            <span className="k">Expected</span><span>Rasio nasional per diagnosis × jenis FKTP</span>
            <span className="k">Pendamping</span><span>{M.rujukan.n_diagnosis_nonspes} diagnosis non-spesialistik; nasional {pct(M.rujukan.pangsa_nonspes_nasional)} rujukan</span>
            <span className="k">Biaya per kejadian</span><span>{rp(M.rujukan.biaya_hilir_per_rujukan)} (tarif RJTL rata-rata berperujuk FKTP)</span>
          </div>
        </div>
      </div>

      <h2>Sumber data</h2>
      <div className="card">
        <table className="t">
          <thead><tr><th>Data</th><th>Sumber</th><th>Pemakaian</th></tr></thead>
          <tbody>
            <tr><td>Klaim FKRTL, kunjungan FKTP, kepesertaan 2024</td><td>BPJS Kesehatan, Data Sampel Edisi 2025 (±1% peserta, anonim; kode faskes samaran)</td><td>Seluruh hasil deteksi</td></tr>
            <tr><td>Batas kabupaten/kota dan kecamatan</td><td>{demo.sumber.batas}</td><td>Peta L1, L2</td></tr>
            <tr><td>Titik RS, klinik, praktik dokter Kota Semarang</td><td>{demo.sumber.faskes}</td><td>Lapisan konteks L2 (bukan hasil deteksi)</td></tr>
            <tr><td>Penduduk per kecamatan</td><td>{demo.sumber.demografi}</td><td>Choropleth konteks L2</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Privasi dan batasan</h2>
      <div className="card" style={{ fontSize: 13, lineHeight: 1.6 }}>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Tidak ada nomor kartu, nomor SEP, nama peserta, atau nama dokter di layar mana pun, ekspor, maupun asisten. Sampel klaim hanya memuat kolom teknis.</li>
          <li>Kode faskes dalam Data Sampel adalah kode samaran; hasil deteksi tidak dapat dan tidak dikaitkan dengan RS bernama. Titik faskes di peta berasal dari OpenStreetMap sebagai konteks pasokan.</li>
          <li>Data Sampel ±1% peserta membuat pita kepercayaan lebar untuk faskes kecil; itulah alasan skor z dan syarat stabilitas. Pada data penuh, ketidakpastian menyempit sekitar 10 kali.</li>
          <li>Ekstrapolasi rupiah "tertimbang" memakai bobot sampel dan harus dibaca sebagai orde besaran, bukan angka pasti.</li>
          <li>SIDAK memberi indikasi statistik untuk memprioritaskan audit. Keputusan sah atau tidaknya klaim tetap melalui audit medis oleh manusia.</li>
        </ul>
      </div>
      <div className="hint" style={{ marginTop: 10 }}>Modul yang diangkat: {MODUL.map(m => `#${INFO[m].nomor} ${INFO[m].nama}`).join(' · ')} (Participant Guide Healthkathon 2026, Kategori 2 · Faskes).</div>
    </>
  )
}
