# KPR Analytics (versi GitHub, data dummy)

Folder ini salinan dashboard KPR Analytics yang **seluruh datanya dummy**, khusus untuk diunggah ke GitHub.

- **Nama RO dan kantor cabang** mengikuti nama asli (daftar di `pipeline/dummy_kanca.txt`).
- **Nama RM** dibuat acak: 661 nama orang Indonesia, masing-masing 2 kata. Jumlah RM di Performance juga 661.
- **Angka** (OS, debitur, disburse, NPL, realisasi, SLA) semuanya buatan `pipeline/make_dummy.py`.
- **Tidak ada** nama debitur, nomor rekening, NIK, token, atau file Excel asli.

Tampilan bisa langsung dibuka tanpa login karena memakai data dummy di `site/data/`.

## Cara pakai folder ini

1. **Lihat di laptop**: buka folder ini di VS Code, klik kanan `site/index.html` lalu **Open with Live Server**.
2. **Unggah ke GitHub** (dari terminal VS Code di folder ini):
   ```bash
   git init
   git add .
   git commit -m "Dashboard KPR versi demo (data dummy)"
   git branch -M main
   git remote add origin https://github.com/<akun-github>/kpr-analytics-demo.git
   git push -u origin main
   ```
3. **Terbitkan sebagai website**: di GitHub buka **Settings → Pages → Source: GitHub Actions**. Workflow
   `Terbitkan dashboard demo` berjalan sendiri. Alamatnya `https://<akun-github>.github.io/kpr-analytics-demo/`.
4. **Buat ulang data dummy** (bila kode berubah): klik dua kali `buat-data-dummy.bat`, lalu commit dan push lagi.

## Aturan penting

- **Jangan menaruh export asli** di `data_raw/` folder ini, dan jangan menyalin `site/data/` dari folder dashboard asli.
  `refresh-data.bat` sengaja tidak disertakan di sini.
- Workflow menolak terbit bila `site/data/meta.json` tidak bertanda dummy, bila ada file Excel atau CSV, atau bila
  `site/js/deploy.js` diisi alamat Apps Script.
- Logo Danantara dan BRI tidak ikut diterbitkan ke website.
- Untuk dashboard dengan data asli, tetap pakai folder `kpr-analytics` di laptop (mode A, B, atau C di bawah).

---

# KPR Analytics v2

Dashboard internal pengganti tiga dashboard Looker Studio (Performance, Portofolio, Realisasi KPR),
ditambah halaman Summary. Satu kode tampilan, tiga cara menjalankan:

| Mode | Website ada di | Data dibaca dari | Siapa yang bisa melihat data |
| --- | --- | --- | --- |
| **A. GitHub Pages + Apps Script** (disarankan) | `https://<akun>.github.io/kpr-analytics/` | Apps Script "KPR API" | hanya email di daftar `ALLOWED_EMAILS`, setelah login Google |
| B. Apps Script saja | `https://script.google.com/macros/s/.../exec` | Apps Script "KPR Dashboard" | hanya email yang diberi Share di spreadsheet agregat |
| C. Lokal | `http://127.0.0.1:5500` (VS Code + Live Server) | file JSON di `site/data/` | hanya laptop ini |

Data nasabah tidak pernah sampai ke dashboard: pipeline hanya membaca kolom yang terdaftar (allowlist),
membuang Nama Debitur, mengagregasi, lalu memeriksa hasilnya sebelum dipakai.

Bingung cara memasukkan data asli? Baca dulu [`PANDUAN-DATA-ASLI.md`](PANDUAN-DATA-ASLI.md) (bahasa sederhana, langkah demi langkah).

Panduan UX (pekerjaan pengguna, spesifikasi Atur panel, rencana uji pakai): [`docs/UX.md`](docs/UX.md).

---

## 1. Cara kerja mode A: GitHub untuk tampilan, Apps Script untuk penjaga data

**Jangan taruh token, password, atau data di GitHub.** Website GitHub Pages bisa dibuka siapa saja yang tahu
alamatnya, dan semua isi JavaScript-nya bisa dibaca lewat DevTools. Karena itu GitHub hanya menyimpan
*tampilan* (HTML, CSS, JS). Datanya dijaga Apps Script.

```text
Spreadsheet sumber (4 buah, PRIVAT)
        │  project Apps Script "KPR Pipeline" (akun Anda, cek perubahan tiap 5 menit)
        ▼
allowlist kolom → agregasi → cek data nasabah & total
        ▼
Spreadsheet "KPR Analytics - data agregat" (PRIVAT, tidak dibagikan ke siapa pun)
        ▲
        │  project Apps Script "KPR API" (akun Anda) membaca data, TAPI hanya menjawab bila:
        │    1. ada bukti login Google yang sah (ID token, dicek tanda tangannya), dan
        │    2. emailnya ada di daftar ALLOWED_EMAILS
        │
Browser tim ── buka https://<akun>.github.io/kpr-analytics/ ── tombol "Masuk dengan Google"
               (GitHub Pages: hanya tampilan kosong + layar login, tanpa data)
```

- Tidak ada token rahasia di mana pun. Dua nilai di `site/js/deploy.js` (alamat API dan Client ID) memang publik.
- Orang yang membuka website tanpa login hanya melihat layar "Masuk dengan Google".
- Orang yang login tapi emailnya tidak terdaftar melihat layar "Akses belum diberikan". Data tidak dikirim.
- Menambah atau menghapus orang: ubah `ALLOWED_EMAILS` di Script Properties project KPR API. Langsung berlaku.
- Login berlaku 1 jam, lalu diperbarui otomatis tanpa klik selama akun Google masih masuk di browser.

**Soal repo GitHub.** GitHub Pages di akun gratis hanya bisa dari repo **public**. Isi repo hanya kode (tanpa data,
tanpa token), tetapi nama kolom dan nama segmen tetap terlihat. Bila itu tidak boleh, pakai GitHub Pro (Pages dari
repo private), atau pakai mode B.

## 1a. Data live: dashboard memperbarui dirinya sendiri

Masalah lama: data hanya diperbarui dua kali sehari dan harus dimuat ulang manual. Sekarang alurnya otomatis:

```text
Seseorang mengubah / menempel data di spreadsheet sumber
        │  KPR Pipeline mengecek "terakhir diubah" tiap 5 menit (cepat, tidak membaca isi)
        │  ada perubahan? tunggu 90 detik sampai pengeditan selesai, lalu bangun ulang data agregat
        ▼
Spreadsheet agregat punya versi baru
        │  dashboard yang sedang terbuka mengecek versi tiap 90 detik (mode lokal: tiap 60 detik)
        ▼
Panel diperbarui di tempat: filter, halaman, dan posisi scroll tidak berubah
```

- Di pojok kanan atas ada tanda titik hijau berdenyut dan tulisan "Diperbarui 3 menit lalu". Titik abu-abu artinya
  perangkat sedang offline atau server tidak bisa dihubungi; dashboard mencoba lagi sendiri.
- Saat data baru masuk muncul pemberitahuan singkat. Bila sedang di mode Atur panel, pembaruan ditunda sampai selesai.
- Tab yang tidak dilihat tidak mengecek apa pun, jadi tidak membebani kuota.
- Ubah jeda cek pipeline lewat Script Property `WATCH_MINUTES` (pilihan 1, 5, 10, 15, atau 30), lalu jalankan
  `installTrigger` lagi. Tetap ada bangun ulang harian pukul 05.00 sebagai cadangan.
- Kuota akun Gmail gratis: total jalan pemicu 90 menit per hari. Cek tiap 5 menit memakai sekitar 10 menit per hari,
  tiap bangun ulang sekitar 1 sampai 2 menit. Akun Google Workspace kantor punya kuota 6 jam per hari.

**Yang perlu diketahui atasan:** dashboard sekarang selalu menampilkan isi spreadsheet sumber paling baru, paling
lambat sekitar 7 menit setelah sumber diubah, tanpa ada yang menekan tombol. Tetapi dashboard tidak bisa lebih baru
dari sumbernya. Bila spreadsheet sumber hanya diisi sekali sehari dari core banking, datanya tetap data harian.
Supaya benar-benar intraday, tim pengisi sumber perlu memperbarui spreadsheet lebih sering.

Memperbarui project yang sudah terpasang: `clasp push` di `gas/pipeline` lalu jalankan `installTrigger` sekali;
`clasp push` di `gas/api` lalu **Deploy → Manage deployments → Edit → New version** (supaya aksi `version` aktif).
Mode B: `npm run build:gas`, `clasp push` di `gas/dashboard`, lalu deploy versi baru.

> **Catatan kebijakan.** Proyek ini memakai akun Gmail pribadi. Data internal bank yang disimpan atau diolah di akun
> pribadi bisa melanggar kebijakan keamanan informasi kantor, walaupun sudah diagregasi. Mintalah persetujuan tim IT
> atau atasan sebelum memakai data asli, dan pertimbangkan akun Google Workspace milik kantor bila tersedia.

## 2. Pasang (sekali saja)

Siapkan: Node.js 18+, Python 3.10+, akun Google pemilik spreadsheet sumber, akun GitHub.

### 2a. Persiapan alat

1. Buka https://script.google.com/home/usersettings lalu aktifkan **Google Apps Script API**.
2. Di terminal VS Code, dari folder proyek:

   ```bash
   npm install
   npx clasp login
   ```

### 2b. Project pipeline (pengolah data)

1. Di https://script.google.com buat project baru bernama **KPR Pipeline**. Salin **Script ID** dari Project Settings.
2. Salin `gas/pipeline/.clasp.json.example` menjadi `gas/pipeline/.clasp.json`, isi `scriptId`.
3. Kirim kode:

   ```bash
   cd gas/pipeline
   npx clasp push
   cd ../..
   ```

4. Di editor Apps Script, buka **Project Settings → Script Properties**, tambahkan:

   | Property | Isi |
   | --- | --- |
   | `SRC_PERFORMANCE` | ID spreadsheet Performance (bagian URL di antara `/d/` dan `/edit`) |
   | `SRC_KUADRAN` | (opsional) ID spreadsheet Kuadran RM. Kosongkan bila Kuadran RM ada di spreadsheet Performance |
   | `SRC_PORTFOLIO` | ID spreadsheet Portofolio |
   | `SRC_REALISASI` | ID spreadsheet Realisasi |
   | `SRC_SLA` | (opsional) ID spreadsheet SLA. Kosongkan bila belum ada; halaman SLA menampilkan pesan data belum ada |
   | `SRC_..._SHEET` | (opsional) nama sheet bila berbeda dari bawaan. Bawaan: Performance `2026`, Kuadran `Kuadran RM`, Portfolio `Tabel`, Realisasi `All`. Bila sheet itu tidak ada, dipakai sheet yang judul kolomnya cocok |

5. Jalankan fungsi **setup** (pilih di menu fungsi, klik Run, beri izin). Log menampilkan alamat dan `AGG_ID`
   spreadsheet agregat yang baru dibuat.
6. Jalankan **buildAll**. Log menampilkan jumlah baris tiap dataset. Bila gagal (kolom hilang, ada data nasabah
   yang lolos), data lama tidak diubah dan alasannya tertulis di log dan di sheet `info`.
7. Jalankan **installTrigger**. Pipeline lalu memeriksa spreadsheet sumber tiap 5 menit dan membangun ulang data
   begitu ada yang berubah (penjelasan lengkap di bagian 1a). Saat pertama dijalankan, Google meminta izin baru
   "melihat file Google Drive": izin baca saja, dipakai untuk membaca waktu terakhir file sumber diubah.

### 2c. Login Google (Google Cloud, gratis)

1. Buka https://console.cloud.google.com, buat project baru bernama **KPR Dashboard**.
2. Buka menu **Google Auth Platform** (di sebagian tampilan bernama **APIs & Services → OAuth consent screen**), klik **Get started**.
   Isi nama aplikasi `KPR Analytics`, email dukungan, pilih **External**, isi email kontak, lalu Create.
3. Di **Audience**, klik **Publish app** (status *In production*). Dashboard hanya meminta `openid` dan `email`,
   jadi tidak perlu verifikasi Google.
4. Di **Clients**, klik **Create client** → jenis **Web application**.
   - Authorized JavaScript origins: `https://<akun-github>.github.io`
   - Authorized redirect URIs: `https://<akun-github>.github.io/kpr-analytics/` (pakai garis miring di akhir)
5. Klik Create, salin **Client ID** (berakhiran `.apps.googleusercontent.com`).

### 2d. Project penjaga data (KPR API)

1. Di https://script.google.com buat project baru **KPR API**, salin Script ID ke `gas/api/.clasp.json`
   (contoh di `gas/api/.clasp.json.example`).
2. Kirim kode: `cd gas/api`, lalu `npx clasp push`, lalu kembali ke folder utama dengan `cd ../..`.
3. Script Properties:

   | Property | Isi |
   | --- | --- |
   | `AGG_ID` | ID spreadsheet agregat (dari log `setup` di langkah 2b) |
   | `CLIENT_ID` | Client ID dari langkah 2c |
   | `ALLOWED_EMAILS` | email tim, dipisah koma. Contoh: `andi@gmail.com, budi@gmail.com`. Awalan `@` = satu domain, mis. `@kantor.co.id` |

4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Klik Deploy, beri izin.
   Salin alamat yang berakhiran `/exec`.

"Anyone" artinya siapa pun bisa *memanggil* alamat itu, tetapi tanpa login sah dan email terdaftar jawabannya
hanya `{"ok":false}`. Logika pemeriksaannya diuji di `tools/test_api.mjs` (token palsu, kedaluwarsa, Client ID lain,
email tidak terdaftar: semua ditolak).

### 2e. Isi alamat lalu terbitkan di GitHub Pages

1. Buka `site/js/deploy.js`, isi:

   ```js
   export const API = {
     url: 'https://script.google.com/macros/s/XXXX/exec',
     clientId: 'XXXX.apps.googleusercontent.com',
   };
   ```

2. Buat repo baru di GitHub bernama `kpr-analytics` (public untuk akun gratis), lalu dari terminal VS Code:

   ```bash
   git init
   git add .
   git status          # pastikan tidak ada data_raw/, site/data/, .clasp.json
   git commit -m "KPR Analytics v2"
   git branch -M main
   git remote add origin https://github.com/<akun-github>/kpr-analytics.git
   git push -u origin main
   ```

3. Di GitHub: **Settings → Pages → Source: GitHub Actions**. Workflow `Terbitkan dashboard` berjalan sendiri
   (lihat tab **Actions**). Workflow menolak terbit bila ada file data di folder situs atau `deploy.js` belum diisi.
4. Buka `https://<akun-github>.github.io/kpr-analytics/`, klik **Masuk dengan Google**.

Memperbarui tampilan: ubah file di `site/`, cek di mode lokal, lalu `git add`, `git commit`, `git push`.
Website terbit ulang otomatis.

### 2f. Alternatif mode B: dashboard langsung di Apps Script (tanpa GitHub Pages)

1. Buat project **KPR Dashboard**, salin Script ID ke `gas/dashboard/.clasp.json`, isi Script Property `AGG_ID`.
2. `npm run build:gas`, lalu `cd gas/dashboard` dan `npx clasp push`.
3. **Deploy → Web app**. Execute as: **User accessing the web app**. Who has access: **Anyone with Google account**.
4. Share spreadsheet agregat ke email tim sebagai **Viewer**, dan matikan "Viewers and commenters can see the option
   to download, print, and copy". Saat pertama membuka, tim klik **Advanced → Go to KPR Dashboard**.
5. Memperbarui: `npm run build:gas`, `clasp push`, lalu **Deploy → Manage deployments → Edit → New version**.

## 3. Mode C: lokal (VS Code + Live Server)

1. Install Python 3.10+ dan extension **Live Server** dan **Python** di VS Code.
2. `pip install -r requirements.txt`
3. Coba dengan data dummy:

   ```bash
   python pipeline/make_dummy.py
   python pipeline/build_data.py
   ```

4. Klik **Go Live** di status bar. Browser terbuka di `http://127.0.0.1:5500`.

Data dummy memakai pasangan RO dan kanca dari `pipeline/dummy_kanca.txt` (8 kanca per RO, mencakup semua provinsi dan
wilayah Jabodetabek tiap RO). Angka hariannya sengaja naik turun seperti data asli: hari libur dan akhir pekan sepi,
ada hari akad massal, angsuran menumpuk di awal dan akhir bulan, SML naik di tengah bulan lalu turun saat penagihan
akhir bulan, dan pola musiman (Lebaran, akhir tahun). Isinya buatan, bukan data nasabah.

Pakai data asli: hapus isi `data_raw/` (termasuk `.dummy`), simpan export tiap spreadsheet sebagai
`performance.xlsx` (sheet `2026` dan `Kuadran RM`), `portfolio.xlsx` (sheet `Tabel`), `realisasi.xlsx` (sheet `All`), dan bila ada `sla.xlsx`,
lalu jalankan `python pipeline/build_data.py` (atau Ctrl+Shift+B). Bila pipeline gagal, `site/data/` tidak diubah.
Nama file dan sheet diatur di `SOURCES` pada `pipeline/config.py`. Nama sheet dicocokkan tanpa peduli huruf besar/kecil;
bila sheet yang diminta tidak ada (mis. `2026` sudah berganti `2027`), pipeline memakai sheet yang judul kolomnya cocok
dan menulis pemberitahuan di log. Data dummy dibuat dengan susunan file dan sheet yang sama.

Cara paling gampang di Windows: klik dua kali `refresh-data.bat` di folder proyek. Skrip ini mencari Python, memasang
pandas dan openpyxl bila belum ada, mengecek judul kolom, lalu menjalankan pipeline, dan jendelanya tetap terbuka supaya
pesan BERHASIL atau GAGAL bisa dibaca. Skrip ini tidak bergantung pada folder yang sedang dibuka di VS Code. Untuk
Ctrl+Shift+B dan task VS Code, buka folder `kpr-analytics` itu sendiri (bukan folder di atasnya), karena pengaturan di
`.vscode/` hanya dibaca dari folder yang dibuka; dashboard lalu tersedia di `http://127.0.0.1:5500/`.

Sebelum memproses, judul kolom bisa dicek dulu dengan `python pipeline/check_columns.py` (task VS Code
**Cek kolom file Excel**). Skrip ini hanya membaca baris judul tiap file, lalu menulis per file: kolom wajib yang ada
atau kurang, kolom tambahan yang dikenali, dan kolom yang dibuang (termasuk Nama Debitur). Daftar kolom yang dikenali sama
dengan briefing awal dan tercantum lengkap di `PANDUAN-DATA-ASLI.md`. Pencocokan judul tidak peduli huruf besar/kecil,
spasi, atau urutan kolom, dan baris judul laporan di atas tabel dilewati otomatis (dicari di 15 baris pertama).
Kolom tambahan boleh tidak ada; panel yang memakainya tampil kosong.
Segmen Portofolio dicocokkan dari isi kolom (tidak peduli huruf besar/kecil): Produk `KPR`/`Komersial` dan `KPRS`/`Subsidi`,
Tujuan Kredit `Primary`/`Secondary`/`Refinancing`, Tier Dev `Dev Tier 1`/`Tier 1` dan `Non Dev Tier 1`/`Non Tier 1`
(`PORTFOLIO_NODES` di `site/js/config.js`; satu segmen boleh menerima beberapa isi). Bila isi data tidak cocok, panel
Segmen portofolio menampilkan tanda kuning yang membuka daftar isi kolom sebenarnya. Pesan "kolom wajib tidak ditemukan" menyebut
judul kolom seperti di Excel (mis. `rka_os_baru`, atau `Rp (kolom Rp yang kedua)` untuk portofolio).
SLA: tanpa `sla.xlsx`, pipeline membuat data contoh dengan RO dan kanca dari Realisasi (`pipeline/sla_sample.py`,
ditandai `sample` di meta). Dengan `sla.xlsx`, nama NAMA KANWIL dan NAMA BRANCH disamakan dengan RO/kanca dashboard lain
lewat kunci nama (`name_key`, sama di Python dan Apps Script). Realisasi: 7 sumber dari kolom Tipe KPR, 6 dan 5 sumber dari kolom `6 Sumber` dan `5 Sumber` (opsional, baris
kosong memakai Tipe KPR). Tiap mode hanya menampilkan daftar sumbernya (`REALISASI_SUMBER_7/6/5`); isi lain dipadankan
lewat `REALISASI_PADANAN`, dan yang tidak bisa dipadankan tetap masuk Total serta ditandai chip kuning. Performance: baris ganda tanggal + RO yang sama diabaikan (dipakai baris
berisi OS), kolom Disburse dibaca harian lalu dijumlahkan sejak tanggal 1, baris tanggal yang belum terjadi disembunyikan
(RKA dan Hari Kerja bulan depan dipakai Outlook), dan Kuadran RM boleh bulanan. Rinciannya di `PANDUAN-DATA-ASLI.md`.

## 4. Aturan GitHub

`.gitignore` sudah mengecualikan `data_raw/`, `site/data/`, `node_modules/`, `.clasp.json`, `.env`, dan file kredensial.
Selalu jalankan `git status` sebelum commit. Jangan pernah commit file `.xlsx`, `.csv`, atau JSON data.
`pipeline/dummy_kanca.txt` hanya berisi nama kantor cabang dan RO-nya (tanpa data nasabah), dipakai untuk membuat data
dummy. Bila kantor menganggap daftar ini internal, tambahkan baris `pipeline/dummy_kanca.txt` ke `.gitignore`.

## 5. Struktur folder

Nama folder dan file mengikuti isinya, jadi untuk mencari sesuatu cukup lihat namanya.

```text
kpr-analytics/
├── site/                              tampilan (dipakai mode lokal dan build Apps Script)
│   ├── index.html                     satu halaman, 4 tampilan: #/ringkasan (Summary) #/performance #/portofolio #/realisasi
│   ├── img/                           logo Danantara dan BRI (WebP, ikut ditanam ke build Apps Script)
│   ├── css/
│   │   ├── main.css                   memuat semua file CSS di bawah sesuai urutan
│   │   ├── base.css                   token warna (Nusantara, Cakrawala, Mentari), font, ikon
│   │   ├── sidebar.css, page-header.css, board.css, dialogs.css, responsive.css
│   │   └── kpi.css, summary-tiles.css, summary-rows.css, charts.css, map.css, insights.css, ask.css, outlook.css, portfolio.css, ...
│   ├── js/
│   │   ├── app.js                     kerangka: navigasi, filter, mode Atur panel, simpan tata letak
│   │   ├── config.js                  pemetaan kolom ke KPI, ambang warna, node portofolio, cadangan wilayah RO
│   │   ├── deploy.js                  alamat KPR API + Client ID (publik, bukan rahasia)
│   │   ├── core/                      format angka dan tanggal, ikon, kontrol filter, komponen kecil
│   │   ├── services/                  data-source.js, datasets.js (pemuat data), live.js (cek versi), auth.js, router.js
│   │   ├── analytics/                 insights.js (mesin temuan), outlook.js + outlook-text.js (proyeksi dan kebutuhan), measures.js, wording.js, data-hub.js
│   │   ├── ask/                       Tanya data: lexicon.js (kamus), parser.js, answers.js, engine.js, ask-dialog.js
│   │   ├── board/board.js             papan panel 12 kolom: seret, ubah ukuran, susun ulang, keyboard
│   │   ├── charts/charts.js           semua grafik Chart.js (garis, batang, kombinasi SML/NPL)
│   │   ├── widgets/                   widget-kit.js (isi panel), insights-panel.js (kartu temuan), outlook-panel.js (Outlook dan kebutuhan), summary-rows.js (judul baris dan Penjelasan di Summary)
│   │   ├── models/                    perhitungan Performance dan Portofolio
│   │   ├── map/                       peta: provinces.js, branch-locations.js, kanca-points.js (koordinat kanca), territory.js (wilayah RO dari kanca), metro-areas.js + metro-map.js (Jabodetabek), indonesia-map.js, map-panel.js, map-popout.js (jendela detail), kanca-source.js
│   │   └── views/                     isi tiap halaman: ringkasan.js (Summary), performance.js, portofolio.js, realisasi.js
│   └── lib/                           Chart.js, plugin datalabels, font Google Sans Flex (lokal, tanpa CDN)
├── pipeline/                          pipeline Python (mode lokal): config.py (daftar kolom), build_data.py, check_columns.py (cek judul kolom), checks.py
├── gas/
│   ├── pipeline/                      project Apps Script "KPR Pipeline": Config.js, Core.js, Checks.js, Main.js
│   ├── api/                           project Apps Script "KPR API" (mode A): cek token Google + daftar email, kirim data
│   └── dashboard/                     project Apps Script "KPR Dashboard" (mode B): Code.js + Index.html (hasil build)
├── tools/
│   ├── build_gas.mjs                  gabungkan site/ menjadi gas/dashboard/Index.html
│   ├── sync_gas_config.py             salin allowlist dari pipeline/config.py ke gas/pipeline/Config.js
│   ├── dump_xlsx.py                   ubah data_raw/*.xlsx jadi JSON untuk uji
│   ├── geo/to_js.py                   ubah batas provinsi (Natural Earth) jadi site/js/map/provinces.js
│   ├── test_gas_parity.mjs            bukti hasil pipeline Apps Script = hasil pipeline Python
│   └── test_api.mjs                   uji keamanan KPR API (token palsu, kedaluwarsa, email tidak terdaftar)
├── refresh-data.bat                   klik dua kali di Windows: cek kolom lalu bangun ulang data dashboard
├── .github/workflows/pages.yml        terbitkan site/ (tanpa data) ke GitHub Pages
└── docs/UX.md
```

Kode sengaja tanpa komentar. Penjelasan cara pakai ada di README ini.

Mengubah allowlist kolom: edit `pipeline/config.py`, lalu `python tools/sync_gas_config.py`, lalu `clasp push` di `gas/pipeline`.
Uji kesetaraan kedua pipeline: `npm run test:parity`. Uji keamanan KPR API: `npm run test:api`.

## 6. Keamanan data

| Lapisan | Yang dijaga |
| --- | --- |
| Allowlist kolom | Hanya kolom terdaftar yang dibaca. Kolom baru di sheet (mis. "No Rekening") otomatis tidak ikut. |
| Nama Debitur dibuang | Tidak ada di allowlist; pemeriksaan memastikan tidak satu pun nilainya muncul di output. |
| Cek angka panjang | Teks ≥10 digit di output (mirip rekening/NIK) membuat pipeline gagal. |
| Agregasi | Realisasi diringkas per tanggal × RO × kanca × RM × tipe; debitur menjadi angka hitungan. |
| Gagal = tidak menulis | Bila satu cek gagal, data lama di spreadsheet agregat atau `site/data/` tidak disentuh. |
| Login (mode A) | ID token Google dicek tanda tangannya dengan kunci publik Google, juga penerbit, Client ID, masa berlaku, dan email terverifikasi. |
| Daftar akses (mode A) | Data hanya dikirim ke email di `ALLOWED_EMAILS`. Spreadsheet agregat tidak dibagikan ke siapa pun. |
| Akses (mode B) | Web app berjalan sebagai pengguna; hanya akun yang diberi Share spreadsheet agregat yang bisa membaca data. |
| Izin minimum | KPR API: `spreadsheets.readonly` + `script.external_request` (ambil kunci publik Google). Pipeline terpisah. |
| GitHub Pages | Workflow menolak terbit bila ada file data di folder situs. Token login hanya di sessionStorage tab, hilang saat tab ditutup. |
| Tanpa sumber luar | Library dan font ditanam; build gagal bila kode memuat resource dari domain lain. |
| Git | Data, `.clasp.json`, `.env`, kredensial ada di `.gitignore`. Repo hanya berisi kode. |

Pemeriksaan lokal kapan saja: `python pipeline/checks.py`. Jangan pakai "Publish to web" di Google Sheets.

## 7. Fitur tampilan

- **Sidebar gelombang biru** di tengah kiri, seperti desain Finance Dashboard: logo di kiri atas dan status data di kiri
  bawah tetap di latar terang. Menu dibuka dan ditutup dengan tombol panah bulat di tepi gelombang (tidak terbuka hanya
  karena kursor lewat). Saat terbuka, sidebar berubah menjadi panel biru penuh dari atas sampai bawah, lebarnya mengikuti
  nama menu terpanjang (sekitar 185 px) supaya tidak terlalu lebar. Konten bergeser ke kanan dengan animasi transform (tanpa menghitung
  ulang tata letak tiap frame), dan grafik baru menyesuaikan ukuran setelah gerakan selesai. Saat menu halaman diklik,
  penanda aktif langsung pindah, lalu panel digambar bertahap dari atas sehingga klik terasa instan. Pilihan
  terbuka/tertutup diingat browser. Saat Atur panel, menu otomatis dirapatkan. Di HP, navigasi pindah ke bawah layar.
- **Judul halaman di tengah** seperti header Looker: "Dashboard Summary KPR", "Dashboard Performance KPR",
  "Dashboard Portofolio KPR", "Dashboard Realisasi KPR". Logo Danantara di kiri dan logo BRI di kanan sejajar judul;
  baris di bawahnya berisi Tanya data (kiri), keterangan halaman (tengah), dan status data serta Atur panel (kanan).
  Di layar sempit kedua logo tetap di atas, lalu judul, tombol, dan Tanya data bertumpuk. Filter di bawahnya rata tengah.
- **Halaman Summary dibagi per dashboard**: satu baris Performance, satu baris Realisasi, satu baris Portofolio. Tiap
  baris diawali judul baris dengan garis pemisah dan tombol "Buka ..." ke dashboard aslinya, lalu chart, lalu panel
  **Penjelasan** di bawah chart: tiga poin terpenting dashboard itu (dihitung dari data, sama seperti Insight analitik)
  berjajar dalam tiga kolom. Teks panjang ada di paling bawah: **Analisis lengkap** lalu **Outlook dan kebutuhan**.
  Isi tiap baris: Performance = kartu KPI, Growth OS harian, Peta Indonesia; Realisasi = Realisasi per bulan, Per tipe
  KPR; Portofolio = Tren OS portofolio, Kualitas portofolio. Panel lain (Capaian RO per KPI, Kualitas kredit per bulan,
  dan seterusnya) tetap bisa ditambahkan lewat Atur panel.
- **Header panel ala Looker**: judul (dengan satuan, mis. "Growth OS harian (Rp M)") di kiri, kotak angka ringkas
  (mis. OS/hari kerja bulan lalu dan bulan ini) di kanan judul. Tidak ada deskripsi di bawah judul; keterangannya
  muncul saat kursor diarahkan ke judul dan tetap dibaca pembaca layar.
- **Peta Indonesia** (peta panas provinsi, tanpa library dan tanpa sumber dari luar):
  - Performance dan Summary: per wilayah Regional Office (capaian OS, %NPL, %SML, disburse vs prognosa, OS).
    Wilayah RO ditentukan oleh kantor cabangnya: daftar kanca per RO dibaca dari data (`dim_kanca.json`), lalu tiap
    kanca dipetakan ke provinsi lewat nama kotanya. Jadi bila ada kanca yang pindah RO, peta ikut berubah sendiri.
    Provinsi yang dilayani beberapa RO diwarnai menurut RO dengan kanca terbanyak; tooltip menyebut semua RO beserta
    jumlah kancanya, dan label RO yang bukan pemilik warna diberi titik warna nilainya sendiri.
  - Tombol **Jabodetabek** di atas peta membuka peta kotak per wilayah kota (Jakarta Utara, Pusat, Barat, Selatan, Timur,
    Tangerang, Tangsel, Serang, Lebak, Bogor, Depok, Bekasi, Karawang). Garis tebal memisahkan Jakarta 1, 2, dan 3
    sesuai kancanya: Jakarta 1 di Jakarta Pusat, Utara, dan sebagian Timur; Jakarta 2 di Jakarta Selatan, Cibubur,
    Bogor, Depok, Bekasi, dan Karawang; Jakarta 3 di Jakarta Barat dan Banten. Wilayah yang dilayani dua RO diberi pita
    warna kedua. Klik DKI Jakarta atau Banten di peta Indonesia juga membuka tampilan ini. Wilayah kota tiap kanca
    ditentukan dari kata kunci di `site/js/map/metro-areas.js`.
  - Bila data kanca belum ada, peta memakai cadangan `RO_TERRITORY` di `site/js/config.js` (jumlah kanca per provinsi
    dari daftar pasangan RO dan kanca).
  - **Klik wilayah di peta** membuka jendela detail yang memperbesar peta ke wilayah itu. Pilih **Per region** (semua
    provinsi tempat RO itu punya kanca) atau **Per pulau** (Sumatera, Jawa, Kalimantan, Sulawesi, Bali dan Nusa Tenggara,
    Maluku dan Papua). Isinya: peta yang diperbesar dengan **titik tiap kantor cabang**, ringkasan angka, dan daftar
    kantor cabang beserta %NPL, %SML, OS, dan realisasinya. Warna titik = nilai ukuran terpilih per kanca (legenda di
    bawah peta). Kanca yang berdekatan digabung jadi lingkaran berangka; klik lingkaran itu untuk memperbesar sampai
    titiknya terpisah. Klik provinsi untuk memperbesar provinsi itu dan menyaring daftar; tombol "Perkecil" kembali satu
    langkah. Arahkan kursor ke titik untuk melihat angkanya; klik titik untuk menandai barisnya di daftar, dan arahkan
    kursor ke baris daftar untuk menandai titiknya di peta. Nama kanca muncul di samping titik bila ada tempat. Klik nama
    kanca di daftar untuk membukanya di Portofolio (atau memfilter halaman yang sedang dibuka). Tombol "Filter dashboard
    ke ..." memfilter seluruh halaman ke RO tersebut.
  - **Koordinat kanca** ada di `site/js/map/kanca-points.js`: tiap kanca BRI di daftar (281 kanca) diberi titik lintang
    dan bujur tingkat kota atau kawasan (mis. Jakarta Kramat, Pluit, dan Kelapa Gading punya titik masing-masing).
    Semua titik sudah dicek berada di provinsinya; yang di pulau kecil (Ternate, Tidore, Tarakan, Karimun) sengaja tetap di
    lokasi pulaunya. Ini perkiraan, bukan alamat kantor. Bila kantor punya koordinat resmi, ganti angkanya di baris
    `['nama kanca', lintang, bujur]`. Nama kanca yang belum dikenal ditaruh di tengah provinsinya dan disebut di legenda.
  - Portofolio dan Realisasi: per provinsi dari data kantor cabang. Lokasi kanca ditentukan dari nama kotanya
    (`site/js/map/branch-locations.js`, sudah mencakup 281 kanca dari daftar). Klik provinsi untuk melihat kanca di dalamnya,
    lalu klik kanca untuk memfilter. Tampilan Jabodetabek di sini menghitung nilai per wilayah kota langsung dari kancanya.
    Kanca baru yang kotanya belum ada: tambahkan nama kotanya di `KANCA_CITY`.
  - Warna biru berurutan (5 kelas, makin gelap makin tinggi) dengan legenda, label nilai yang tidak saling menimpa
    (label di pulau padat seperti Jawa dipindah ke laut dengan garis penunjuk), tooltip, dan daftar peringkat.
  - Sumber batas provinsi: Natural Earth admin-1 (domain publik), 33 provinsi, disederhanakan dengan mapshaper
    (`tools/geo/to_js.py` membuat `site/js/map/provinces.js`).
- **Kartu ringkasan tanpa grafik**: kartu paling kiri (Outstanding, ALL KPR, Total realisasi) diwarnai biru Nusantara
  penuh sebagai angka utama; kartu lain putih dengan garis tepi tipis. Isinya label, nilai, status capaian (pil hijau/
  kuning/merah + "vs RKA"/"vs prognosa"), dan angka pendamping. Kartu terpilih ditandai garis tepi biru; kartu tipe KPR
  Realisasi diberi kotak warna kecil yang sama dengan warna di chart.
- **Warna teks merek**: judul dan angka memakai navy #0B2147, teks kedua abu kebiruan, judul panel biru Nusantara
  (seperti judul chart di Looker), latar halaman biru sangat muda #EEF3FA.
- **SML dan NPL harian dalam satu chart** (seperti Looker): garis %SML/OS atau %NPL/OS melayang tepat di atas puncak
  batang nominal, hampir bersentuhan, dan tidak pernah menembus batang. Skala garis disembunyikan dan dihitung otomatis
  supaya garis menempel; persen dibaca dari label di garis, nominal dari angka tegak di dalam batang. Garis RKA diberi
  label di sisi kanan luar area chart.
- **Nilai langsung terlihat di chart** tanpa perlu diarahkan kursor: chart garis memberi label berkala (jaraknya
  menyesuaikan lebar chart) dan selalu menampilkan nilai terakhir; chart batang menampilkan nilai di ujung batang;
  teks label memakai warna tinta netral supaya tidak ramai;
  batang bertumpuk menampilkan totalnya. Label yang bertabrakan disembunyikan otomatis; detail lengkap tetap di
  tooltip dan tombol tabel.
- **Susunan ala Looker Studio, versi modern**:
  - Performance: 6 kartu KPI, Growth OS, Kuadran RM, Produktivitas RM, Disburse kumulatif, SML, NPL, lalu Laju
    disburse, Peta risiko RO, Peringkat RO.
  - Portofolio: kartu segmen di atas (ALL KPR, Komersial, Subsidi, Komersial Primary, Secondary, Refinancing, Dev Tier 1,
    Dev Non Tier 1; nama lengkap tampil utuh, porsi dari ALL KPR ada di baris bawah kartu), lalu pohon ALL KPR →
    Komersial/Subsidi → Primary/Secondary/Refinancing → Tier.
    Sembilan kategori Looker diringkas jadi matriks 3×3 per segmen (baris OS/SML/NPL, kolom Total/FI/NFI, % SML/NPL
    di bawah nilainya) plus bilah kualitas, jadi semua angka terlihat tanpa scroll. Ruang kosong diisi donut komposisi.
  - SLA: Progres berkas berupa empat kartu ala kartu poker (01 Prakarsa, 02 Analisa, 03 Putusan, 04 Cair) yang
    melayang di atas meja roadmap bergaris panah, lengkap dengan bayangan. Saat panel pertama terlihat, kartu dibagikan
    dari kiri lalu dibalik satu per satu; kartu ikut miring mengikuti kursor dan tegak saat disentuh. Tiap kartu memuat
    jumlah berkas dan nominal pengajuan (Cair: nominal cair). Kartu Analisa juga memuat umur tercepat (Min),
    rata-rata, dan terlama (Maks), yang lebih dari 3 hari berwarna kuning; kartu Cair memuat Min, rata-rata, dan Maks
    lama dari prakarsa sampai cair. Isi tiap kartu diatur di `SLA_CARD_RANGE` (`site/js/config.js`). Angka berkas dan
    kotak nominal berwarna sama dengan proses itu di grafik Progres harian; waktu hijau berarti paling lama 3 hari,
    kuning berarti lewat SLA.
    Klik kartu untuk membuka pop-out detail proses (KPI, berkas masuk 30 hari, umur berkas, RO, kantor cabang,
    pendapatan, putusan, jenis KPR). Progres harian adalah grafik batang bertumpuk per tanggal dalam satu bulan:
    Cair di paling bawah, lalu Putusan, Analisa, dan Prakarsa paling atas, dengan warna biru tua, Nusantara,
    Cakrawala, dan Mentari (`SLA_STAGE_COLOR`). Angka tiap proses tertulis di dalam potongan batangnya (putih di
    warna gelap, biru tua di warna muda), angka di atas batang adalah totalnya. Di atasnya ada kotak per proses berisi total bulan itu
    dan rata-rata per hari; klik kotak untuk menyembunyikan atau menampilkan proses itu. Klik batang untuk detail hari
    itu per RO dan kantor cabang. Berkas Ditolak tidak ditampilkan. Di bawahnya: SLA per jenis pendapatan, Putusan
    Cabang dan CLF, tabel kantor cabang, dan komposisi berkas (per pekerjaan atau pendapatan).
  - Realisasi: pilihan Rincian sumber (7 sumber dari kolom Tipe KPR, 6 dan 5 sumber dari kolom `6 Sumber` dan
    `5 Sumber`; ETB = LNP + Top Up + Karyawan BRI), Total realisasi
    + per sumber dengan tabel per bulan (judul ETB dan kolom Total ETB di mode 7 sumber), lalu grafik kumulatif harian
    Total di tengah dikelilingi tiap sumber.
- **Analisis lengkap** (halaman Summary, paling bawah), **Penjelasan** per baris di Summary, dan **Insight analitik** (bawah tiap halaman).
  Isinya temuan, bukan perintah: apa yang terjadi, seberapa besar, dibanding apa, dan implikasinya. Diurutkan menurut
  besarnya dampak dalam rupiah; temuan teratas tampil sebagai kartu biru lebar. Tombol salin menghasilkan teks rapi
  untuk dikirim ke direktur lewat email atau chat. Jenis temuan:
  - *Mesin pertumbuhan*: growth OS dipecah menjadi disburse dikurangi runoff (angsuran, pelunasan, hapus buku),
    lalu dibandingkan dengan bulan lalu untuk menunjukkan apakah perlambatan datang dari penyaluran atau dari runoff.
  - *Lintasan target*: proyeksi akhir bulan memakai pola kumulatif hari kerja 6 bulan terakhir (bukan garis lurus),
    lengkap dengan rentang dan kekurangan per hari kerja. Uji balik pada data dummy (pertengahan Agustus, September,
    Oktober): proyeksi pola hari kerja meleset 8 sampai 25% dari angka akhir bulan, proyeksi garis lurus meleset 32 sampai 51%.
  - *Kualitas kredit*: perubahan %NPL dipecah menjadi efek nominal NPL dan efek pertumbuhan OS, sehingga terlihat
    bila rasio turun hanya karena OS tumbuh. Pola SML turun bersamaan NPL naik ditandai sebagai perpindahan kolektibilitas.
  - *Pertumbuhan vs kualitas*: RO yang tumbuh di atas median sambil %NPL naik dalam 3 bulan.
  - *Sebaran kontribusi*, *Volume dan tiket* (efek jumlah debitur vs plafond rata-rata), *Komposisi produk*,
    *Ketergantungan* (porsi 10% RM teratas, RM yang berhenti menyalurkan), *Pola tidak biasa* (realisasi 5 hari kerja
    terakhir dibanding hari kerja yang sama 6 bulan sebelumnya), *Kantong risiko* (kanca dengan %NPL di atas 1,5 kali
    rata-rata dan berapa NPL yang "berlebih"), *Profil penghasilan* (FI vs NFI), *Kualitas per segmen*.
  - Setiap temuan punya tingkat keyakinan. Di awal bulan (kurang dari 5 hari kerja) temuan utama memakai penutupan
    bulan sebelumnya, karena angka bulan berjalan masih terlalu sedikit untuk disimpulkan.
- **Outlook dan kebutuhan** (Summary paling bawah, dan Performance): menjawab pertanyaan bisnis untuk bulan depan dan sisa bulan ini.
  - *Laju biasa*: rata-rata disburse per hari kerja dan rasio runoff 3 bulan penuh terakhir, dikalikan hari kerja bulan
    depan. Dari situ keluar proyeksi disburse, runoff, dan OS akhir bulan bila semuanya berjalan seperti biasa.
  - *Kebutuhan*: disburse yang dibutuhkan = target OS dikurangi OS akhir bulan ini, ditambah runoff yang diperkirakan.
    Dibandingkan dengan laju biasa menjadi "perlu naik X%", lalu dipecah per hari kerja, per RM, dan jumlah debitur baru
    (memakai tiket rata-rata realisasi 3 bulan terakhir).
  - *Target*: RKA bulan depan belum ada di data, jadi diperkirakan dari kenaikan RKA rata-rata 3 bulan terakhir. Kolom
    Target OS bisa diisi angka resmi dan semua hitungan langsung menyesuaikan.
  - *Simulasi*: geser kenaikan disburse untuk melihat OS akhir bulan dan capaian target. Ada juga skenario runoff turun ke
    level terbaiknya dalam 6 bulan terakhir, jadi terlihat berapa kenaikan disburse yang masih dibutuhkan.
  - *Kualitas*: tren NPL nominal 3 bulan terakhir, %NPL bila tren berlanjut, dan batas kenaikan NPL agar rasio tidak
    melewati sasaran (rasio RKA bulan ini).
  - *Per RO*: daftar RO diurutkan dari kenaikan terbesar yang dibutuhkan; klik untuk memfilter.
  - Mode *Sisa bulan ini* menghitung disburse yang dibutuhkan selama hari kerja tersisa agar OS bulan berjalan sesuai RKA
    dan agar disburse capai guidance, memakai pola hari kerja (berapa bagian disburse dan runoff yang biasanya terjadi
    setelah hari kerja yang sama).
- **Tanya data**: tombol di kiri atas (atau tekan `/` atau `Ctrl+K`). Tampil seperti aplikasi chat: kolom ketik ada di bawah,
  obrolan mengalir dari atas ke bawah, pertanyaan di kanan dan jawaban di kiri, dan layar otomatis bergulir ke jawaban
  terbaru. Saran pertanyaan muncul di atas kolom ketik saat mengetik. Ketik dengan bahasa
  sehari-hari, misalnya "RO mana NPL tertinggi?", "kenapa OS naik bulan lalu?", "bandingkan realisasi Jakarta 1 dan 3",
  "top 5 kanca realisasi Oktober", lalu lanjutkan dengan "kalau bulan lalu?" atau "yang terendah?". Pertanyaan rencana
  juga bisa: "berapa disburse yang dibutuhkan bulan depan?", "sisa bulan ini harus naik berapa persen?", "kalau disburse
  naik 15% bulan depan?", "batas kenaikan NPL bulan depan", "RO mana yang paling butuh dorongan bulan depan?". Pertanyaan
  wilayah: "kanca di Jakarta 2", "pembagian wilayah Jakarta 1, 2, dan 3", "KC Cibubur masuk RO mana?". Jawaban dihitung
  langsung di browser dari data yang sudah dimuat, tanpa mengirim data ke mana pun. Salah ketik kecil dibetulkan
  ("makasar" dibaca Makassar). Setiap jawaban berisi kalimat jawaban, rincian angka, grafik kecil bila perlu, tombol
  "Buka di ..." untuk membuka panel terkait, dan Salin. Kamus istilah ("apa itu SML") ada di `site/js/ask/lexicon.js`;
  menambah sinonim cukup menambah kata di sana.
- **Sidebar**: kotak putih penanda halaman aktif bergeser cepat saat pindah halaman, nama menu muncul di samping ikon
  saat menu dirapatkan, tombol Tanya data di bagian atas, dan status data live di bagian bawah. Semua gerakan
  dimatikan otomatis bila perangkat diatur "kurangi gerakan".
- **Filter**: pilihan RO, bulan, tanggal, segmen, dan sumber realisasi memakai daftar buatan sendiri (bukan daftar bawaan
  browser), jadi hurufnya sama dengan dashboard di Chrome, Edge, maupun Firefox. Bisa dipakai dengan keyboard: panah
  atas/bawah, Home/End, Enter, Esc, dan ketik huruf awal untuk lompat ke pilihan.
- **Palet**: Nusantara Blue #0857C3 untuk data utama dan tombol, Cakrawala Blue #307FE2 untuk sorotan,
  Mentari Blue #71C5E8 untuk pembanding (bulan lalu). Warna kategori memakai urutan tetap yang aman untuk buta warna.
- **Font**: Google Sans Flex disimpan lokal (lisensi OFL); bila gagal dimuat jatuh ke SF Pro, Aptos, atau Segoe UI.
- **Ikon**: [Uicons by Flaticon](https://www.flaticon.com/uicons) gaya rounded. Tiap ikon dua lapis: bentuk solid
  warna Mentari di belakang, garis luar warna biru di depan, jadi ikon ikut warna konteksnya (putih di kartu biru,
  biru di kartu putih). Bentuknya disimpan sebagai path SVG di `site/js/core/icons.js`, tanpa memuat apa pun dari luar.
  Lisensi gratis Flaticon mewajibkan atribusi; kreditnya ada di dialog Status data. Bila instansi punya langganan
  Flaticon Premium, kredit boleh dihapus.
- **Atur panel**: seret panel, tarik sudut kanan bawah untuk ukuran, × untuk menyembunyikan, tambah dari daftar
  Panel tersedia. Tersimpan otomatis per akun. Urungkan dengan tombol atau Ctrl/Cmd+Z. Keyboard: fokus ke ikon titik,
  panah untuk memindah, Shift+panah untuk ukuran, Delete untuk menyembunyikan.
- **Klik untuk menelusuri**: klik RO, tanggal, segmen, sumber realisasi, bulan, RM, atau kantor cabang untuk memfilter.
- Tiap panel punya tombol tabel data dan unduh PNG. Filter tersimpan di alamat halaman (bisa di-bookmark).
- Layar sempit (tablet tegak, HP): panel ditumpuk satu kolom.

## 8. Yang masih perlu dicek saat parity dengan Looker Studio

1. Lokasi kanca (`KANCA_CITY`) dan wilayah kota Jabodetabek (`metro-areas.js`): cek bila ada kanca baru. Wilayah RO sendiri mengikuti data kanca.
2. %Ach RKA Disburse: dipakai Disburse ÷ Guidance. Panel Laju disburse menganggap Guidance = target sebulan penuh.
3. Hari kerja tersisa: kolom `Hari Kerja` untuk tanggal yang ada, sisa bulan diperkirakan Senin–Jumat (tanpa libur nasional).
4. Pertumbuhan OS "sejak akhir bulan lalu" memakai OS pada baris terakhir bulan sebelumnya.
5. Satuan Plafond Realisasi (`REALISASI_PLAFOND_UNIT`, sekarang `juta`) dan Rp Portofolio (`PORTFOLIO_RP_UNIT`) di `site/js/config.js`.
6. Isi kolom Graph_* dan Line Chart DPK/NPL (`PERCENT_COLUMNS_ARE_FRACTION`).
