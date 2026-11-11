# Cara memakai data asli (versi gampang)

Bayangkan dashboard ini seperti **etalase toko**.

- **Data asli** = bahan mentah (file Excel atau Google Sheets dari kantor).
- **Pipeline** = dapur. Bahan dicuci dan dipotong di sini: kolom nama debitur dan nomor rekening dibuang,
  angka dijumlahkan, lalu dicek sekali lagi supaya tidak ada data nasabah yang lolos.
- **Dashboard** = etalase. Yang dipajang hanya hasil dari dapur, bukan bahan mentahnya.

Jadi kamu tidak pernah "menyambungkan" Excel langsung ke dashboard. Kamu menaruh bahan di dapur,
menyalakan dapur, lalu etalase terisi sendiri.

> **Sebelum mulai:** data bank yang diolah di laptop pribadi atau akun Gmail pribadi bisa melanggar aturan kantor.
> Minta izin tim IT atau atasan dulu.

Ada dua jalan. Mulai dari Jalan 1. Jalan 2 baru dipakai kalau tim lain juga mau membuka dashboard.

---

## Jalan 1: di laptop sendiri (paling gampang)

Cocok untuk mencoba dan mencocokkan angka dengan Looker Studio. Yang bisa melihat hanya kamu.

1. **Siapkan 3 file Excel asli** (ditambah `sla.xlsx` kalau mau halaman SLA). Export dari spreadsheet sumber (File, Download, Microsoft Excel).
   Sheet-nya biarkan apa adanya, tidak perlu dipindah atau diganti nama.
2. **Ganti nama filenya persis seperti ini** (huruf kecil semua):

   | Spreadsheet sumber | Nama file | Sheet yang dibaca |
   | --- | --- | --- |
   | Dashboard Performance | `performance.xlsx` | `2026` (Performance) dan `Kuadran RM` |
   | Dashboard Portfolio | `portfolio.xlsx` | `Tabel` |
   | Dashboard Realisasi | `realisasi.xlsx` | `All` |
   | Data SLA (opsional) | `sla.xlsx` | sheet mana saja yang judul kolomnya cocok |

   Sheet lain di file yang sama (misalnya pivot) tidak dibaca. Kalau sheet `2026` nanti berganti jadi `2027`,
   dapur otomatis memakai sheet yang judul kolomnya cocok dan menulis pemberitahuannya. Kalau dua-duanya masih ada,
   ganti tulisan `"2026"` di `pipeline/config.py` (bagian `SOURCES`) jadi `"2027"`.
3. **Buka folder `data_raw`.** Hapus semua isinya, termasuk file kecil bernama `.dummy`
   (file ini tanda bahwa isinya data contoh). Lalu taruh 3 file tadi di sana.
4. **Klik dua kali `refresh-data.bat`** di folder `kpr-analytics` (folder yang berisi `data_raw`, `pipeline`, dan `site`).
   Muncul jendela hitam. Dia mengecek judul kolom dulu, lalu memproses data. Tunggu sampai tertulis **BERHASIL**,
   lalu tekan tombol apa saja untuk menutup. Saat pertama kali, dia juga memasang pandas dan openpyxl (butuh internet).
5. **Refresh browser dashboard.** Tulisan "Dummy" di pojok kanan atas berganti jadi waktu data asli.

Setiap ada data baru: ganti 3 file di `data_raw`, klik dua kali `refresh-data.bat`, refresh browser. Selesai.

### Cara lain lewat VS Code

Buka **folder `kpr-analytics` itu sendiri** (File, Open Folder, pilih `kpr-analytics`), bukan folder di atasnya.
Setelah itu:

- **Ctrl+Shift+B** menjalankan Refresh data dashboard.
- **Ctrl+Shift+P**, ketik **Run Task**, lalu pilih **Cek kolom file Excel** untuk cek judul kolom saja.
- **Go Live** membuka dashboard di `http://127.0.0.1:5500/`.

Kalau alamat dashboard di browser masih `http://127.0.0.1:5500/kpr-analytics/site/`, artinya VS Code membuka folder
satu tingkat di atas `kpr-analytics`. Dalam keadaan itu Ctrl+Shift+B tidak menemukan tugasnya, dan Live Server ikut
melayani folder `data_raw`. Buka ulang foldernya dengan cara di atas.

### Dashboard masih memakai data lama?

1. Sudah klik dua kali `refresh-data.bat` dan muncul **BERHASIL**? Dashboard tidak membaca Excel langsung,
   jadi tanpa langkah ini isinya tetap yang lama.
2. Sudah pakai versi proyek terbaru? Ekstrak `kpr-analytics.zip` terbaru menimpa folder lama (file Excel di
   `data_raw` tidak ikut tertimpa), lalu klik dua kali `refresh-data.bat` lagi, karena cara dapur membaca data
   kadang ikut berubah.
3. Muncul **BELUM BERHASIL**? Baca baris `KURANG` atau `GAGAL` di jendela hitam. Dashboard sengaja tetap memakai data
   sebelumnya sampai masalahnya beres.
4. Sudah refresh browser setelah BERHASIL?

### Kalau muncul tulisan merah

Tenang, data lama tidak rusak. Kalau dapur gagal, etalase tetap memakai data sebelumnya.
Penyebab paling sering:

| Pesan | Artinya | Yang dilakukan |
| --- | --- | --- |
| `File sumber ... tidak ditemukan di data_raw/` | nama file belum persis | cek lagi nama file di tabel langkah 2 |
| `Kolom wajib untuk ... tidak ditemukan: rka_os_baru` | judul kolom itu tidak ada atau tulisannya beda | samakan judul kolom dengan daftar di bawah |
| `nama field terlarang` atau `data nasabah ikut terbawa` | ada kolom seperti nama, NIK, atau rekening yang ikut terbaca | hapus kolom itu dari file |

Daftar judul kolom di bawah sama dengan briefing awal (spreadsheet sumber dashboard Looker).
Huruf besar/kecil, spasi di depan/belakang, urutan kolom, dan baris judul laporan di atas tabel tidak masalah.
Nama sheet juga tidak peduli huruf besar/kecil (`kuadran rm` dianggap sama dengan `Kuadran RM`).

| File | Kolom wajib | Kolom tambahan yang dibaca | Kolom yang dibuang otomatis |
| --- | --- | --- | --- |
| `performance.xlsx`, sheet `2026` | Tanggal, Regional Office, OS, rka_os_baru, Debitur, RKA_Deb, DPK, RKA_DPK, NPL, RKA_NPL, Disburse | Hari Kerja, Hari Kerja Bulan Lalu, Hari, helper_os, Gr_OS, Gr_OS_lalu, Graph_OS, Graph_OS_lalu, Graph_OS_Khusus, Nilai Akhir_OS_Lalu, Gr_Deb, helper_Deb, helper_DPK, Gr_DPK, Line Chart DPK, helper_NPL, Gr_NPL, Line Chart NPL, Disburse_lalu, Graph_Disburse, GR_Disburse, GR_Disburse_Khusus, Prognosa_disburse, Guidance_disb, jum_RM, Jumlah RM Lalu, Prod_RM_Now, Prod_RM_Lalu, Prod_RM_Khusus, Prognosa_disburse_rm, Guidance_disb_rm | Bulan_lalu, Bulan Tahun |
| `performance.xlsx`, sheet `Kuadran RM` | Tanggal, Regional Office, Kuadran, Jumlah RM | Jumlah RM_Lalu | Bulan_lalu, Bulan Tahun |
| `portfolio.xlsx`, sheet `Tabel` | Bulan, RO, Produk, Kategori OS, Rp (kolom **Rp yang kedua**, nilai rupiah penuh) | KANCA, KC FIX, Kode KC, Tujuan Kredit, Tier Dev, Jenis Pendapatan, Kolek, No, Kategori Deb, Jum Deb | Rp yang pertama, % OS, Total OS, Jumlah Deb, Total Deb, % Deb, KC Tarikan, Fix |
| `sla.xlsx` (opsional) | NAMA KANWIL, process_group | NAMA BRANCH, JENIS PENDAPATAN, JENIS PUTUSAN, JENIS KPR, DESKRIPSI CRS, JENIS PEKERJAAN, type, NOMINAL PENGAJUAN, NOMINAL PENCAIRAN, TANGGAL PRAKARSA, TANGGAL ENTRY CLF AWAL, TANGGAL PUTUSAN, Tanggal Realisasi, today, delta proses prakarsa, delta proses analisa, delta proses putusan | **NAMA DEBITUR, NIK, NOMOR HANDPHONE, semua nomor/nama rekening, CIF, nama dan PN pegawai** (tidak pernah dibaca), serta kolom lain di luar daftar |
| `realisasi.xlsx`, sheet `All` | Tanggal Realisasi, RO, Tipe KPR, Plafond | Kanca, Nama RM, Tujuan Kredit, Dev Local Champion, Debitur Count, 5 Sumber, 6 Sumber | **Nama Debitur** (tidak pernah dibaca), no_tanggal, Bulan, Bulan_Date, RM Count |

Isi kolom yang dipakai untuk segmen Portofolio: **Produk** `KPR` (Komersial) dan `KPRS` (Subsidi), **Tujuan Kredit**
`Primary`, `Secondary`, `Refinancing`, dan **Tier Dev** `Dev Tier 1` dan `Non Dev Tier 1`. Kalau suatu hari isinya
berubah, panel Segmen portofolio menampilkan tanda kuning **Isi segmen beda dengan data**; klik tanda itu untuk melihat
isi kolom yang tidak cocok, lalu samakan di `site/js/config.js` bagian `PORTFOLIO_NODES`.

Di dashboard Realisasi ada pilihan **Rincian sumber**: 7, 6, atau 5 sumber. Tiap pilihan selalu menampilkan
sumbernya sendiri, tidak lebih:

| Pilihan | Dibaca dari kolom | Sumber yang tampil |
| --- | --- | --- |
| 7 sumber | `Tipe KPR` | Dev Tier 1, Non Dev Tier 1, Secondary, FLPP, LNP, Top Up, Karyawan BRI |
| 6 sumber | `6 Sumber` | Dev Tier 1, ETB, Local Champ, Dev Tier 3, Secondary, Subsidi |
| 5 sumber | `5 Sumber` | Dev Tier 1, Non Dev Tier 1, ETB, Secondary, FLPP |

- Isi kolom yang masih memakai nama lain otomatis dipadankan: LNP, Top Up, dan Karyawan BRI masuk ETB; FLPP masuk
  Subsidi di 6 sumber; Local Champ dan Dev Tier 3 masuk Non Dev Tier 1 di 5 sumber. Kalau kolom `6 Sumber` atau
  `5 Sumber` kosong di suatu baris, dashboard memakai isi `Tipe KPR` baris itu.
- Di 6 sumber, Non Dev Tier 1 dibagi dua memakai kolom **Dev Local Champion**: kalau isinya menandakan local champion
  (`Ya`, `Y`, `1`, `Local Champion`, dan sejenisnya), masuk **Local Champ**; selain itu (termasuk kosong) masuk
  **Dev Tier 3**. Kalau kolom `6 Sumber` sudah berisi Local Champ atau Dev Tier 3, isi itu yang dipakai. Daftar isi yang
  dianggap "ya" ada di `REALISASI_LOCAL_CHAMP` di `site/js/config.js`.
- Kalau ada realisasi yang tidak bisa dimasukkan ke salah satu sumber (misalnya `Tipe KPR` tertulis ETB, padahal 7
  sumber butuh LNP, Top Up, atau Karyawan BRI), angkanya tetap masuk **Total realisasi**, dan muncul tanda kuning
  **... belum masuk 7 sumber**. Klik tanda itu untuk melihat isi kolom dan bulannya.
- Di mode 7 sumber, LNP, Top Up, dan Karyawan BRI ada di bawah judul ETB, lengkap dengan kolom Total ETB. Total ETB
  ikut menghitung baris yang tertulis ETB.
- Kalau kolom `6 Sumber` tidak ada, pilihan 6 sumber disembunyikan.
- Daftar sumber, urutan, dan padanannya ada di `site/js/config.js`: `REALISASI_SUMBER_7`, `REALISASI_SUMBER_6`,
  `REALISASI_SUMBER_5`, `REALISASI_PADANAN`, dan `REALISASI_TIPE_ALIAS` (beda tulisan, misalnya `Non Tier 1`).

Kolom tambahan boleh tidak ada; dashboard tetap jalan, hanya panel yang memakainya jadi kosong.
Kolom di luar daftar (misalnya nomor rekening) otomatis tidak ikut.

### Cara dashboard Performance membaca data

- **Baris bantu tanggal 30 tidak perlu lagi.** Kalau ada dua baris dengan tanggal dan RO yang sama, dashboard memakai
  baris yang berisi OS dan mengabaikan baris bantunya. Untuk bulan 30 hari, garis bulan lalu tanggal 31 diambil
  langsung dari baris tanggal 31 bulan lalu. Kolom `..._Khusus` boleh tetap ada, tidak dipakai.
- **Kolom Disburse dibaca sebagai angka harian.** Dashboard menjumlahkannya sendiri sejak tanggal 1, jadi kartu
  Disburse = jumlah disburse bulan itu sampai tanggal terpilih. Garis bulan lalu juga dijumlahkan dengan cara yang sama.
- **Baris tanggal yang belum terjadi** (OS masih kosong, misalnya sampai 31 Desember) tidak ditampilkan. RKA dan Hari
  Kerja bulan depan dari baris itu dipakai untuk panel Outlook.
- **Kuadran RM boleh bulanan.** Dashboard memakai data kuadran di bulan yang sama dengan tanggal terpilih.
- **OS/hari kerja** = Graph_OS terakhir ÷ Hari Kerja sampai tanggal itu. Untuk bulan lalu: Graph_OS akhir bulan lalu ÷
  Hari Kerja akhir bulan lalu.
- **Disb/hari kerja** = jumlah disburse sejak tanggal 1 ÷ Hari Kerja sampai tanggal itu. Untuk bulan lalu: jumlah
  disburse sebulan penuh ÷ Hari Kerja akhir bulan lalu.

Kalau rumus di Looker berbeda, pembaginya bisa diganti di `site/js/config.js` bagian `PERF_TREND_CHARTS`
(isi `divisor` dengan nama kolom lain, misalnya `hari`).

> Kalau suatu hari judul kolom di spreadsheet kantor berubah, ganti tulisan di sebelah kiri tanda titik dua
> di `pipeline/config.py` (bagian `..._COLUMNS`), lalu jalankan `python tools/sync_gas_config.py` supaya versi
> Apps Script ikut berubah.

---

### Cara dashboard SLA membaca data

- Satu baris di `sla.xlsx` = satu pengajuan. Dashboard tidak menyimpan barisnya satu per satu; dapur menjumlahkannya
  per kanca, tahap, jenis pendapatan, jenis putusan, jenis KPR, CRS, pekerjaan, type, bulan prakarsa, dan umur.
- **Tahap** dibaca dari kolom `process_group`: Proses Prakarsa → 01 Prakarsa, Proses Analisis → 02 Analisa,
  Sudah Diputus → 03 Putusan (disetujui, menunggu cair), Sudah Cair → 04 Cair. Berkas Ditolak tidak ditampilkan.
- **Min, rata-rata, Maks di kartu**: untuk tahap 01–03 diambil dari umur berkas di tahap itu; untuk 04 Cair dari
  `Tanggal Realisasi` dikurangi `TANGGAL PRAKARSA`.
- **Data contoh SLA** (dipakai selama `sla.xlsx` belum ada) dibuat mirip pola asli: prakarsa lebih sepi di akhir
  pekan, dan jumlah pencairan per hari tidak pernah turun dari tanggal 1 sampai akhir bulan karena realisasi dikejar
  per bulan. Pola ini hanya untuk data contoh; data asli tampil apa adanya.
- **Grafik Progres harian** dibaca dari kolom tanggal: `TANGGAL PRAKARSA` (prakarsa baru), `TANGGAL ENTRY CLF AWAL`
  (masuk analisa), `TANGGAL PUTUSAN` (diputus), dan `Tanggal Realisasi` (cair). Dapur menjumlahkannya per hari, RO,
  kanca, jenis pendapatan, dan jenis putusan ke file `sla_daily.json`. Tidak ada nama atau nomor rekening yang ikut.
- **Umur berkas** untuk tahap 01–03 diambil dari kolom `delta proses prakarsa`, `delta proses analisa`, dan
  `delta proses putusan`. Kalau kolom itu kosong, dashboard menghitung dari kolom `today` dikurangi tanggal mulai tahap.
- **Batas SLA 3 hari per proses.** Paling lama 3 hari = tepat SLA, lebih dari 3 hari = lewat SLA. Angkanya diatur di
  `site/js/config.js` bagian `SLA_TARGET_HARI`.
- Lama waktu ditulis dalam hari dan jam, misalnya 2 hari 21 jam.
- **Lama prakarsa sampai cair** = Tanggal Realisasi dikurangi TANGGAL PRAKARSA.
- **Kalau `sla.xlsx` belum ada, halaman SLA memakai data contoh.** Angkanya buatan, tetapi RO dan kantor cabangnya
  diambil dari data Realisasi kamu, jadi filternya sama dengan dashboard lain. Di halaman SLA tertulis **Data contoh**.
  Begitu `sla.xlsx` ditaruh di `data_raw` dan `refresh-data.bat` dijalankan, data contoh otomatis diganti data asli.
- **Nama RO dan kanca disamakan dengan dashboard lain.** Misalnya `KANWIL JAKARTA 1` dibaca sebagai RO Jakarta 1 yang
  dipakai di Performance dan Realisasi, dan `KC BANDUNG DAGO` dibaca sebagai kanca yang sama di Realisasi. Kata seperti
  KANWIL, RO, REGIONAL OFFICE, KC, KCP, KANCA, BRI, serta huruf besar/kecil diabaikan saat mencocokkan. Jendela hitam
  menulis berapa RO dan kanca yang berhasil disamakan.

## Jalan 2: online supaya tim bisa membuka

Di sini dapurnya pindah ke Google. Bahan mentah tetap di Google Sheets milikmu (privat), dan ada
"satpam" yang hanya membukakan pintu untuk email yang terdaftar.

```text
Google Sheets sumber (3 file, privat)
      │  "KPR Pipeline" (dapur, cek perubahan tiap 5 menit)
      ▼
Spreadsheet agregat (privat, tanpa data nasabah)
      │  "KPR API" (satpam: cek login Google + daftar email)
      ▼
Website dashboard (GitHub Pages) → tim login dengan Google
```

Langkah besarnya (detail klik demi klik ada di `README.md` bagian 2):

1. **Minta izin** IT atau atasan.
2. **Pakai 3 Google Sheets sumber** milikmu (Performance, Portfolio, Realisasi). Jangan dibagikan ke siapa pun.
3. **Pasang dapur (KPR Pipeline):** isi ID ketiga spreadsheet (`SRC_PERFORMANCE`, `SRC_PORTFOLIO`, `SRC_REALISASI`;
   `SRC_KUADRAN` dikosongkan karena Kuadran RM ada di spreadsheet Performance), jalankan `setup`, `buildAll`, lalu
   `installTrigger`. Nama sheet `2026`, `Kuadran RM`, `Tabel`, dan `All` sudah jadi bawaan.
4. **Pasang satpam (KPR API):** isi `AGG_ID`, `CLIENT_ID`, dan `ALLOWED_EMAILS` (email tim), lalu Deploy.
5. **Pasang etalase:** isi alamat API di `site/js/deploy.js`, upload ke GitHub, aktifkan GitHub Pages.

Setelah itu tidak perlu menekan apa-apa lagi. Kalau isi Google Sheets sumber diubah, dashboard ikut
berubah sendiri paling lambat sekitar 7 menit.

Tidak mau pakai GitHub? Pakai **mode B** (dashboard langsung di Apps Script), lihat `README.md` bagian 2f.

---

## Yang tidak boleh

- Jangan taruh file Excel atau JSON data di folder `site/` atau di GitHub.
- Jangan pakai "Publish to web" di Google Sheets.
- Jangan simpan token atau password di file mana pun.

## Bonus: titik kanca di peta

Titik kantor cabang di peta pop-out ditaruh per kota (perkiraan). Kalau kantor punya koordinat persis,
buka `site/js/map/kanca-points.js` dan ganti angka di baris kanca itu: `['nama kanca', lintang, bujur]`.
