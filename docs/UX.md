# Catatan UX: KPR Analytics v2

Dokumen kerja singkat untuk tim. Isinya: untuk apa dashboard ini dipakai, apa yang diubah dari versi sebelumnya,
cara kerja fitur Atur panel, Tanya data, Outlook, peta wilayah, data live, dan rencana uji pakai.

## 1. Pekerjaan yang dibantu (Jobs to Be Done)

| Saat... | Saya ingin... | Supaya... | Yang menjawab |
| --- | --- | --- | --- |
| membuka laptop pagi hari | tahu posisi KPI terbaru dan mana yang meleset | bisa langsung menegur RO yang tertinggal | Summary: baris Performance (kartu KPI, chart, Penjelasan) |
| menyiapkan bahan untuk direktur | punya temuan yang tajam beserta angkanya, bukan sekadar grafik | direktur bisa mengambil keputusan dari bahan yang sama | Summary: Penjelasan tiap baris dan Analisis lengkap (tombol salin sebagai teks) |
| ditanya "kenapa angkanya begitu?" | jawaban cepat tanpa membuka banyak panel | diskusi tidak tertunda | Tanya data ("kenapa OS naik bulan lalu?") |
| mendekati akhir bulan | tahu apakah disburse masih bisa kejar guidance | bisa mendorong RO/RM yang perlu digenjot | Insight Lintasan target, panel Laju disburse |
| rapat dengan RO | membandingkan RO di semua KPI sekaligus | diskusi berbasis angka yang sama | Peta panas capaian, Peringkat RO, Tanya data ("bandingkan ...") |
| meninjau kualitas kredit | melihat segmen dan kanca mana yang NPL-nya naik | menentukan fokus penagihan | Insight Kualitas kredit dan Kantong risiko, panel Portofolio, titik kanca di jendela detail peta |
| data sumber baru saja diisi | dashboard ikut terbarui tanpa ada yang menekan tombol | semua orang melihat angka yang sama dan terbaru | Data live (titik hijau, "Diperbarui X menit lalu") |
| menyusun rencana bulan depan | tahu berapa disburse yang dibutuhkan dan harus naik berapa persen dari biasanya | target dibagi ke RO dengan angka yang masuk akal | Outlook dan kebutuhan, Tanya data ("disburse bulan depan harus naik berapa persen?") |
| membahas wilayah Jakarta | melihat beda Jakarta 1, 2, dan 3 | tidak salah menegur RO | Peta, tampilan Jabodetabek, Tanya data ("kanca di Jakarta 2") |

Kebutuhan sosial: tiap orang punya fokus berbeda (pimpinan wilayah vs analis), jadi susunan panel bisa diatur per akun.

## 2. Ukuran keberhasilan (HEART, dipilih 3)

- **Task success**: waktu menemukan "RO mana yang capaian OS-nya di bawah 90%" kurang dari 20 detik, lewat Summary atau Tanya data.
- **Engagement**: minimal 3 dari 5 anggota tim membuka dashboard tiap hari kerja selama 2 minggu pertama.
- **Adoption**: Penjelasan atau Analisis lengkap di Summary, atau jawaban Tanya data, disalin ke bahan rapat minimal sekali per minggu.

## 3. Kritik versi sebelumnya dan perubahannya

| Temuan | Tingkat | Perubahan di v2 |
| --- | --- | --- |
| Dashboard dianggap tidak dipakai karena datanya tidak real-time | Tinggi | Pipeline mengecek perubahan spreadsheet sumber tiap 5 menit dan membangun ulang bila ada perubahan; dashboard yang terbuka mengecek versi tiap 90 detik dan memperbarui panel tanpa memuat ulang halaman |
| Tidak ada analitik; panel analisis lama berisi perintah ("lakukan penagihan") | Tinggi | Mesin temuan: growth = disburse dikurangi runoff, proyeksi berbasis pola hari kerja, efek nominal vs efek pertumbuhan OS pada %NPL, konsentrasi, anomali, kantong risiko. Ditulis sebagai temuan dan implikasi, diurutkan menurut dampak rupiah, dengan tingkat keyakinan |
| Mencari satu angka spesifik butuh banyak klik dan filter | Sedang | Tanya data: pertanyaan bahasa sehari-hari dijawab di browser, tampil seperti chat (kolom ketik di bawah, obrolan dari atas ke bawah, pertanyaan kanan, jawaban kiri) dengan tombol menuju panel terkait |
| Tidak ada arahan angka untuk bulan berikutnya | Tinggi | Outlook dan kebutuhan: laju biasa, disburse yang dibutuhkan untuk target, kenaikan dalam persen, per hari kerja, per RM, debitur baru, simulasi, batas NPL, dan kebutuhan per RO |
| Peta tidak membedakan Jakarta 1, 2, dan 3 | Sedang | Wilayah RO dihitung dari kantor cabangnya; tampilan Jabodetabek per wilayah kota dengan garis batas antar-RO |
| Sidebar terasa lambat dan bentuknya melar saat dibuka | Sedang | Penanda aktif pindah seketika, panel digambar bertahap, konten bergeser dengan transform; saat dibuka sidebar menjadi panel biru penuh dari atas ke bawah selebar nama menu |
| Peta hanya bisa dilihat skala nasional | Sedang | Klik wilayah membuka jendela detail yang memperbesar peta per region atau per pulau, dengan titik tiap kantor cabang (warna = nilai, kanca berdekatan digabung lalu bisa diperbesar), daftar kanca, dan angkanya |
| Halaman ringkasan terlalu banyak teks di atas, chart tenggelam | Tinggi | Halaman diganti nama jadi Summary dan dibagi per dashboard: tiap baris berisi chart lalu Penjelasan singkat di bawahnya; Analisis lengkap dan Outlook pindah ke paling bawah |
| Huruf di daftar filter berbeda dengan dashboard (terutama di Firefox) | Rendah | Daftar pilihan buatan sendiri dengan huruf dashboard dan dukungan keyboard |
| Susunan halaman tetap; tiap orang menggulir ke panel yang sama setiap hari | Tinggi | Papan panel yang bisa diatur per akun (seret, ubah ukuran, sembunyikan, tambah) |
| Data hanya bisa dibuka di satu laptop (Live Server) | Tinggi | GitHub Pages + Apps Script dengan login Google dan daftar email |
| Perbandingan antar-RO tersebar di beberapa chart | Sedang | Peta panas RO × KPI, Peta risiko, Peta Indonesia, Kontribusi pertumbuhan OS |
| Warna biru tidak mengikuti palet brand | Rendah | Nusantara #0857C3 sebagai warna utama, Cakrawala untuk interaksi, Mentari untuk pembanding |

Yang dipertahankan karena sudah berhasil: tab biru lengkung S di kiri (kini dengan penanda halaman yang bergeser),
pohon portofolio ala Looker Studio, tooltip gelap, tombol tabel data dan unduh PNG di tiap chart.

## 4. Atur panel (spesifikasi interaksi)

Pemicu: tombol **Atur panel** di kanan atas. Satu mode saja, terlihat jelas (bar biru muda menggantikan filter).

| Aksi | Mouse / sentuh | Keyboard (fokus ke ikon titik di kiri judul panel) | Umpan balik |
| --- | --- | --- | --- |
| Pindah | seret panel | panah kiri/kanan/atas/bawah | panel lain bergeser, bayangan putus-putus di posisi tujuan |
| Ubah ukuran | tarik sudut kanan bawah | Shift + panah | ukuran mengikuti sel grid 12 kolom |
| Sembunyikan | tombol × | Delete | toast dengan tombol Urungkan; panel pindah ke daftar Panel tersedia |
| Tambah | seret dari daftar Panel tersedia, atau tombol + | Tab ke tombol + lalu Enter | panel muncul di posisi jatuh atau di paling bawah |
| Urungkan | tombol Urungkan | Ctrl/Cmd + Z | hingga 40 langkah dalam sesi |
| Kembali ke awal | tombol Tata letak awal | | toast dengan Urungkan |
| Selesai | tombol Selesai | Esc | fokus kembali ke tombol Atur panel |

Aturan:
- Simpan otomatis 0,7 detik setelah perubahan terakhir. Status "Menyimpan", lalu "Tersimpan"; bila gagal, "Gagal menyimpan" dengan tombol Coba lagi.
- Tidak ada dialog konfirmasi; semua aksi bisa diurungkan.
- Saat mode atur aktif, isi panel tidak bisa diklik, sidebar dirapatkan, dan pembaruan data live ditunda sampai selesai.
- Lebar papan di bawah 900 px: panel ditumpuk satu kolom dan Atur panel dimatikan (tombol abu-abu dengan keterangan).
- Tata letak disimpan per halaman dan per akun.

## 5. Tanya data (spesifikasi singkat)

- Pemicu: tombol di kiri atas, tombol di sidebar, atau tombol `/` dan `Ctrl/Cmd + K`.
- Jenis pertanyaan: nilai, peringkat, perbandingan, tren, komposisi, perubahan, proyeksi, penjelasan (kenapa),
  anomali, ringkasan wilayah, syarat ("RO dengan NPL di atas 4%"), definisi istilah.
- Mengerti RO (nama kota, "region 09", "jkt 2"), provinsi dan pulau, kanca ("KC ..."), RM, sumber realisasi (termasuk ETB), segmen
  portofolio, FI/NFI, dan periode (hari ini, minggu lalu, Oktober, Q3, 3 bulan terakhir, sejak awal tahun).
- Pertanyaan lanjutan memakai konteks sebelumnya ("kalau bulan lalu?", "yang terendah?", "kalau Makassar?").
- Tampilan obrolan seperti aplikasi chat: kolom ketik di bawah, obrolan mengalir dari atas ke bawah, pertanyaan di gelembung
  kanan dan jawaban di gelembung kiri. Setelah bertanya, layar bergulir ke jawaban terbaru; jawaban panjang ditampilkan
  dari awal kalimatnya.
- Setiap jawaban menampilkan: kalimat jawaban, rincian angka, grafik kecil bila perlu, tombol "Buka di ..." (membuka
  panel terkait dengan filter yang sesuai), dan Salin. Tidak ada lagi baris cara membaca pertanyaan dan pertanyaan lanjutan.
- Pertanyaan rencana ("disburse yang dibutuhkan bulan depan", "kalau naik 15%", "batas NPL bulan depan", "RO mana paling
  butuh dorongan") dan pertanyaan wilayah ("kanca di Jakarta 2", "KC Cibubur masuk RO mana").
- Bila tidak paham atau nama tidak ditemukan, jawaban menyebut bagian yang tidak dikenali dan menawarkan nama yang mirip.
- Aksesibilitas: dialog native, kolom combobox dengan daftar saran yang bisa dipilih dengan panah, jawaban diumumkan ke pembaca layar.

## 5a. Outlook dan kebutuhan (spesifikasi singkat)

- Dua periode: bulan depan, dan sisa bulan ini (muncul selama bulan berjalan belum selesai).
- Laju biasa = rata-rata disburse per hari kerja dan rasio runoff terhadap OS selama 3 bulan penuh terakhir.
- Disburse dibutuhkan = target OS − OS akhir bulan ini + runoff yang diperkirakan. Kenaikan = dibutuhkan ÷ laju biasa − 1.
- Target bulan depan: RKA bila ada; bila belum, RKA bulan ini + kenaikan RKA rata-rata 3 bulan terakhir. Pengguna bisa
  mengisi target resmi di kolom Target OS.
- Pecahan kebutuhan: per hari kerja, per RM, dan debitur baru (tiket rata-rata realisasi 3 bulan terakhir).
- Skenario: slider kenaikan disburse (−30% sampai +80%), dan skenario runoff turun ke level terbaik 6 bulan terakhir.
- Kualitas: tren NPL 3 bulan, %NPL bila tren berlanjut, dan batas kenaikan NPL agar rasio tidak melewati sasaran.
- Kalimat ditulis sebagai kebutuhan dan skenario dengan angka, bukan perintah. Asumsi selalu tertulis di bawah panel.

## 6. Katalog panel

| Halaman | Tampil bawaan | Ada di daftar Panel tersedia |
| --- | --- | --- |
| Summary | Baris Performance (Kartu KPI, Growth OS harian, Peta Indonesia, Penjelasan Performance), baris Realisasi (Realisasi per bulan, Per sumber, Penjelasan Realisasi), baris Portofolio (Tren OS portofolio, Kualitas portofolio, Penjelasan Portofolio), lalu baris SLA (Progres berkas), lalu Analisis lengkap dan Outlook dan kebutuhan di paling bawah | Capaian RO per KPI, Kualitas kredit per bulan, Kualitas portofolio per bulan, Peta risiko RO, Laju disburse, Komersial dan Subsidi, Sinyal |
| Performance | Kartu KPI, Growth OS harian, Kuadran RM, Produktivitas RM, Disburse kumulatif, SML harian, NPL harian, Laju disburse, Peta risiko RO, Outlook dan kebutuhan, Peta Indonesia, Peringkat RO, Insight analitik | Kontribusi pertumbuhan OS, Disburse per RM per RO, Sinyal |
| Portofolio | Segmen, Pohon, Tren bulanan segmen, Kualitas per bulan, Peta Indonesia, Kualitas per RO, Kantor cabang %NPL tertinggi, Insight analitik | Kualitas kredit, Komersial dan Subsidi, Tier developer, Matriks kategori, FI dan NFI |
| SLA | Progres berkas (kartu ala kartu poker berisi jumlah berkas dan nominal, Analisa dan Cair juga dengan Min, rata-rata, Maks, di atas meja roadmap, dibagikan lalu dibalik saat pertama tampil, ikut miring mengikuti kursor, dengan pop-out tindak lanjut: arus masuk dan keluar 30 hari serta 5 kantor cabang yang perlu dikejar), Progres harian (batang bertumpuk per tanggal dengan warna palet brand dan angka di tiap potongan, kotak total dan rata-rata per hari yang bisa diklik untuk menyembunyikan proses, klik batang untuk detail hari itu), SLA per jenis pendapatan, Putusan Cabang dan CLF, Kantor cabang lewat SLA, Komposisi berkas (Pekerjaan, Pendapatan) | - |
| Realisasi | Ringkasan per sumber (7, 6, atau 5 sumber), Kumulatif harian, Kalender, Peringkat RM, Peringkat kantor cabang, Peta Indonesia, Realisasi per RO, Tujuan kredit, Dev Local Champion, Insight analitik | Realisasi per bulan (chart), Pola per tanggal, Tren bulanan per sumber |

## 6a. HP dan tablet

| Ukuran | Perilaku |
| --- | --- |
| HP tegak (320 sampai 412 px) | Panel bertumpuk, navigasi di bawah, filter satu baris yang bisa digeser, tombol Atur panel disembunyikan. Kartu Progres berkas 2 kolom dengan baris Min/Rata-rata/Maks bertumpuk. Grafik per RO memanjang, Kumulatif harian satu kolom. Pop-out tampil layar penuh, peta pop-out di atas daftar kantor cabang. |
| HP miring (sekitar 844×390) | Sidebar ringkas berisi menu saja, filter satu baris, menu filter pindah ke atas tombol bila ruang di bawah kurang. |
| Tablet tegak (768 sampai 820 px) | Panel bertumpuk 1 sampai 2 kolom, kartu Progres berkas 2×2. |
| Tablet miring (1024 sampai 1366 px) | Tata letak grid seperti desktop. Huruf kartu Progres berkas mengecil mengikuti lebar kartu. Daftar peringkat peta tetap di samping peta. |

Layar sentuh: legenda, tautan, dan judul kolom tabel punya area sentuh minimal 24 px. Pemeriksaan otomatis memastikan
tidak ada geser samping, zoom-out otomatis, teks terpotong, atau konten keluar panel di semua ukuran di atas.

## 7. Rencana uji pakai (5 orang, 30 menit per orang)

Fasilitator bukan pembuat dashboard. Satu pencatat. Pakai data dummy dulu, lalu data asli.

| No | Tugas (skenario) | Berhasil bila |
| --- | --- | --- |
| 1 | "Pagi ini, RO mana yang capaian Outstanding-nya paling rendah?" | menjawab benar dalam ≤20 detik, dari Summary atau Tanya data |
| 2 | "Kenapa OS nasional bulan lalu tumbuh lebih cepat atau lebih lambat dari bulan sebelumnya?" | menyebut apakah penyebabnya disburse atau runoff, dari Penjelasan Performance, Analisis lengkap, atau Tanya data |
| 3 | "Kirim ringkasan kondisi KPR hari ini ke grup direksi." | memakai tombol salin di Analisis lengkap (Summary) dan menempelkannya |
| 4 | "Pindahkan Peringkat RO ke paling atas halaman Performance, lalu sembunyikan Kuadran RM." | selesai tanpa bantuan; tata letak tetap setelah halaman dimuat ulang |
| 5 | "Kantor cabang mana dengan %NPL tertinggi di segmen Komersial Primary?" | memilih segmen di pohon atau bertanya di Tanya data |
| 6 | "Seberapa baru data yang sedang Anda lihat?" | membaca "Diperbarui X menit lalu" atau membuka Status data |
| 7 | "Agar OS Desember capai target, disburse harus naik berapa persen? RO mana yang paling berat?" | menyebut persen kenaikan dan RO teratas dari panel Outlook atau Tanya data |
| 8 | "Bekasi masuk wilayah RO mana?" | memakai tampilan Jabodetabek di peta atau Tanya data |
| 9 | "Di mana saja kanca RO Makassar, dan mana yang %NPL-nya paling tinggi?" | membuka jendela detail peta, membaca titik kanca, dan menunjuk titik yang paling gelap |

Setelah sesi, tanyakan: "Apa yang paling Anda ingat?", "Temuan mana yang akan Anda bawa ke rapat?", dan
"Pertanyaan apa yang Anda ketik tapi tidak terjawab?" (daftar ini dipakai untuk menambah kamus Tanya data).
Catat masalah dengan tingkat Kritis/Tinggi/Sedang/Rendah dan berapa orang yang mengalaminya.
