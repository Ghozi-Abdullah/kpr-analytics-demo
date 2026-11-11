export const METRIC_WORDS = {
  os: ['os', 'outstanding', 'baki debet', 'bakidebet', 'saldo kredit', 'saldo pinjaman', 'saldo', 'total kredit', 'portofolio kredit'],
  growth: ['growth', 'growth os', 'pertumbuhan', 'pertumbuhan os', 'pertumbuhan kredit', 'tumbuh', 'pertambahan os', 'penambahan os',
    'kenaikan os', 'net growth', 'nett growth'],
  npl: ['npl', 'kredit bermasalah', 'kredit macet', 'macet', 'non performing', 'non performing loan', 'kol 3', 'kol 4', 'kol 5',
    'kolektibilitas 3', 'bermasalah'],
  sml: ['sml', 'dpk', 'dalam perhatian khusus', 'special mention', 'special mention loan', 'kol 2', 'kolektibilitas 2', 'kol2'],
  disburse: ['disburse', 'disbursement', 'disburs', 'pencairan', 'dicairkan', 'cair', 'penyaluran', 'booking', 'penyaluran kredit'],
  realisasi: ['realisasi', 'realisasi kredit', 'realisasi kpr', 'akad', 'akad kredit'],
  debitur: ['debitur', 'nasabah', 'noa', 'jumlah debitur', 'jumlah nasabah', 'jumlah akun'],
  ticket: ['rata rata plafond', 'rata rata plafon', 'plafond rata rata', 'plafon rata rata', 'ticket size', 'ticket', 'tiket',
    'average plafond', 'avg plafond', 'nilai per akad', 'plafond per debitur', 'plafon per debitur', 'ukuran kredit'],
  plafond: ['plafond', 'plafon', 'limit kredit'],
  prodrm: ['produktivitas', 'produktivitas rm', 'disburse per rm', 'per rm', 'produktif', 'productivity'],
  rmcount: ['jumlah rm', 'berapa rm', 'banyak rm', 'rm aktif', 'headcount rm', 'jumlah marketing'],
  runoff: ['runoff', 'run off', 'pelunasan', 'angsuran', 'prepayment', 'pelunasan dipercepat', 'take over', 'takeover'],
  kancacount: ['jumlah kanca', 'jumlah cabang', 'berapa kanca', 'berapa cabang', 'banyak kanca', 'banyak cabang'],
};

export const MODIFIER_WORDS = {
  target: ['rka', 'target', 'pencapaian', 'capaian', 'achievement', 'ach', 'gap', 'jarak ke target', 'guidance'],
  prognosa: ['prognosa'],
  nominal: ['nominal', 'rupiah', 'rp', 'nilai rupiah', 'total'],
  ratio: ['rasio', 'ratio', 'persen', 'persentase', '%'],
};

export const INTENT_WORDS = {
  help: ['bantuan', 'help', 'bisa apa', 'bisa tanya apa', 'contoh pertanyaan', 'cara pakai', 'fitur', 'bisa ditanya apa'],
  define: ['apa itu', 'apa arti', 'arti', 'artinya', 'definisi', 'maksud', 'maksudnya', 'pengertian', 'rumus', 'cara hitung',
    'dihitung', 'singkatan', 'kepanjangan', 'apa sih'],
  why: ['kenapa', 'mengapa', 'penyebab', 'sebab', 'faktor', 'pendorong', 'driver', 'apa yang membuat', 'alasan', 'kok', 'disebabkan'],
  forecast: ['proyeksi', 'prediksi', 'perkiraan', 'forecast', 'estimasi', 'akan', 'bakal', 'tercapai', 'capai target', 'tembus',
    'kejar', 'akhir bulan nanti', 'outlook', 'mencapai target', 'bisa capai'],
  anomaly: ['anomali', 'aneh', 'tidak wajar', 'janggal', 'tidak biasa', 'lonjakan', 'anjlok', 'drop', 'spike', 'outlier',
    'penyimpangan', 'tidak normal'],
  compare: ['bandingkan', 'perbandingan', 'banding', 'dibanding', 'dibandingkan', 'vs', 'versus', 'lawan', 'komparasi'],
  trend: ['tren', 'trend', 'perkembangan', 'grafik', 'riwayat', 'historis', 'history', 'pergerakan', 'dari bulan ke bulan',
    'bulanan', 'harian', 'naik turun', 'time series', 'progres'],
  share: ['porsi', 'kontribusi', 'komposisi', 'proporsi', 'share', 'bagian', 'distribusi', 'sebaran', 'mix', 'pangsa'],
  change: ['naik', 'turun', 'perubahan', 'berubah', 'selisih', 'bertambah', 'berkurang', 'delta', 'kenaikan', 'penurunan',
    'meningkat', 'menurun', 'mom', 'month on month', 'memburuk', 'membaik'],
  summary: ['ringkasan', 'rangkuman', 'summary', 'kondisi', 'keadaan', 'gambaran', 'overview', 'status', 'profil', 'performa', 'kinerja',
    'ceritakan', 'jelaskan', 'apa kabar', 'highlight', 'insight', 'temuan', 'analisis', 'analisa', 'rekap', 'situasi'],
  plan: ['dibutuhkan', 'butuh berapa', 'perlu berapa', 'harus berapa', 'kebutuhan', 'diperlukan', 'perlu naik', 'harus naik', 'perlu dinaikkan', 'harus dinaikkan', 'naik berapa',
    'agar capai', 'supaya capai', 'untuk capai', 'agar mencapai', 'supaya mencapai', 'untuk mencapai', 'simulasi', 'skenario',
    'what if', 'kalau naik', 'jika naik', 'bila naik', 'kalau turun', 'jika turun', 'bila turun', 'batas npl',
    'npl maksimal', 'maksimal npl', 'ruang npl', 'butuh dorongan', 'perlu dorongan'],
  coverage: ['cakupan', 'cakupan wilayah', 'mencakup', 'meliputi', 'membawahi', 'kanca mana saja', 'cabang mana saja', 'kanca apa saja',
    'cabang apa saja', 'daftar kanca', 'daftar cabang', 'kanca di', 'cabang di', 'kantor cabang di', 'kc di', 'pembagian wilayah',
    'pembagian jakarta', 'wilayah kerja', 'area kerja', 'teritori', 'batas wilayah', 'masuk ro', 'ikut ro', 'masuk region', 'masuk wilayah',
    'di bawah ro', 'peta wilayah', 'bedanya jakarta', 'dilayani', 'ditangani', 'dipegang', 'memegang', 'ro mana'],
  count: ['berapa banyak', 'ada berapa', 'berapa jumlah'],
  average: ['rata rata', 'rerata', 'rata2', 'average', 'avg', 'per hari kerja', 'per hari'],
  value: ['berapa', 'nilai', 'posisi', 'angka', 'besaran'],
};

export const ORDER_WORDS = {
  desc: ['tertinggi', 'terbesar', 'terbanyak', 'teratas', 'paling tinggi', 'paling besar', 'paling banyak', 'top', 'juara',
    'unggul', 'tinggi', 'besar', 'terkuat', 'tercepat'],
  asc: ['terendah', 'terkecil', 'tersedikit', 'terbawah', 'paling rendah', 'paling kecil', 'paling sedikit', 'rendah', 'kecil',
    'terlemah', 'paling lambat', 'terlambat'],
  best: ['terbaik', 'paling bagus', 'paling baik', 'terbagus', 'paling sehat'],
  worst: ['terburuk', 'terjelek', 'paling buruk', 'paling jelek', 'paling parah', 'terparah'],
  rank: ['peringkat', 'ranking', 'rangking', 'urutan', 'urutkan', 'daftar', 'list', 'mana saja', 'siapa saja', 'leaderboard'],
};

export const COMPARATOR_WORDS = {
  gt: ['di atas', 'diatas', 'lebih dari', 'lebih besar dari', 'melebihi', 'lebih tinggi dari', 'minimal', 'sedikitnya', '>', 'atas', 'melampaui'],
  lt: ['di bawah', 'dibawah', 'kurang dari', 'lebih kecil dari', 'lebih rendah dari', 'maksimal', '<', 'bawah', 'tidak sampai'],
};

export const GROUP_WORDS = {
  ro: ['ro', 'region', 'regional', 'kanwil', 'wilayah', 'regional office', 'kantor wilayah'],
  kanca: ['kanca', 'cabang', 'kc', 'kantor cabang', 'kcp', 'uker', 'unit kerja'],
  rm: ['rm', 'marketing', 'relationship manager', 'tenaga pemasar', 'pemasar', 'sales'],
  tipe: ['tipe', 'jenis', 'program', 'tipe kpr', 'jenis kpr', 'tipe realisasi', 'sumber', 'sumber realisasi'],
  node: ['segmen', 'segment', 'produk'],
  tujuan: ['tujuan', 'tujuan kredit', 'tujuan penggunaan'],
  prov: ['provinsi', 'propinsi'],
};

export const TIPE_WORDS = {
  'Dev Tier 1': ['developer tier 1', 'dev tier 1', 'developer tier1', 'dev tier1', 'tier 1', 'tier1', 'developer'],
  'Non Dev Tier 1': ['non dev tier 1', 'non dev tier1', 'non tier 1', 'non tier1', 'non tier', 'nontier', 'nontier 1', 'dev non tier 1', 'developer non tier 1'],
  Secondary: ['secondary', 'seken', 'second', 'rumah bekas', 'sekunder'],
  FLPP: ['flpp', 'rumah subsidi flpp'],
  LNP: ['lnp'],
  'Top Up': ['top up', 'topup'],
  'Karyawan BRI': ['karyawan bri', 'karyawan', 'pegawai bri', 'pegawai'],
  ETB: ['etb', 'existing to bank', 'nasabah existing'],
  'Local Champ': ['local champ', 'local champion', 'dev local champion'],
  'Dev Tier 3': ['dev tier 3', 'developer tier 3', 'tier 3', 'tier3'],
  Subsidi: ['sumber subsidi', 'realisasi subsidi'],
};

export const NODE_WORDS = {
  komersial: ['komersial', 'non subsidi', 'kpr komersial'],
  subsidi: ['subsidi', 'kpr subsidi', 'kpr sejahtera', 'kprs'],
  primary: ['primary', 'primer', 'rumah baru'],
  secondary: ['secondary', 'sekunder', 'seken'],
  refinancing: ['refinancing', 'refinance', 'refinansial'],
  tier1: ['tier 1', 'dev tier 1', 'developer tier 1'],
  nontier1: ['non tier 1', 'non tier', 'dev non tier 1', 'non dev tier 1'],
};

export const FI_WORDS = {
  FI: ['fi', 'fixed income', 'fix income', 'payroll', 'penghasilan tetap', 'berpenghasilan tetap'],
  NFI: ['nfi', 'non fixed income', 'non fix income', 'non payroll', 'non fi', 'penghasilan tidak tetap', 'wiraswasta'],
};

export const RO_ALIASES = {
  medan: ['medan', 'mdn'],
  pekanbaru: ['pekanbaru', 'pku', 'pekan baru'],
  padang: ['padang'],
  palembang: ['palembang', 'plg'],
  'bandar lampung': ['bandar lampung', 'lampung', 'bdl'],
  'jakarta 1': ['jakarta 1', 'jkt 1', 'jakarta satu', 'jakarta i'],
  'jakarta 2': ['jakarta 2', 'jkt 2', 'jakarta dua', 'jakarta ii'],
  'jakarta 3': ['jakarta 3', 'jkt 3', 'jakarta tiga', 'jakarta iii'],
  bandung: ['bandung', 'bdg'],
  semarang: ['semarang', 'smg'],
  yogyakarta: ['yogyakarta', 'yogya', 'jogja', 'jogjakarta', 'yogyakarta kota'],
  surabaya: ['surabaya', 'sby'],
  malang: ['malang', 'mlg'],
  banjarmasin: ['banjarmasin', 'bjm'],
  makassar: ['makassar', 'makasar', 'mks'],
  manado: ['manado', 'menado'],
  denpasar: ['denpasar', 'dps'],
  jayapura: ['jayapura'],
};

export const PROVINCE_ALIASES = {
  'ID-AC': ['aceh', 'nad'], 'ID-BA': ['bali'], 'ID-BB': ['bangka belitung', 'kep bangka belitung', 'babel'], 'ID-BE': ['bengkulu'],
  'ID-BT': ['banten'], 'ID-GO': ['gorontalo'], 'ID-JA': ['jambi'], 'ID-JB': ['jawa barat', 'jabar'], 'ID-JI': ['jawa timur', 'jatim'],
  'ID-JK': ['dki jakarta', 'dki'], 'ID-JT': ['jawa tengah', 'jateng'], 'ID-KB': ['kalimantan barat', 'kalbar'],
  'ID-KI': ['kalimantan timur', 'kaltim'], 'ID-KR': ['kepulauan riau', 'kepri'], 'ID-KS': ['kalimantan selatan', 'kalsel'],
  'ID-KT': ['kalimantan tengah', 'kalteng'], 'ID-LA': ['provinsi lampung'], 'ID-MA': ['maluku'], 'ID-MU': ['maluku utara', 'malut'],
  'ID-NB': ['nusa tenggara barat', 'ntb'], 'ID-NT': ['nusa tenggara timur', 'ntt'], 'ID-PA': ['papua'], 'ID-PB': ['papua barat'],
  'ID-RI': ['riau'], 'ID-SA': ['sulawesi utara', 'sulut'], 'ID-SB': ['sumatera barat', 'sumbar'], 'ID-SG': ['sulawesi tenggara', 'sultra'],
  'ID-SN': ['sulawesi selatan', 'sulsel'], 'ID-SR': ['sulawesi barat', 'sulbar'], 'ID-SS': ['sumatera selatan', 'sumsel'],
  'ID-ST': ['sulawesi tengah', 'sulteng'], 'ID-SU': ['sumatera utara', 'sumut'], 'ID-YO': ['di yogyakarta', 'diy'],
  'ISLAND-JAWA': ['jawa', 'pulau jawa'], 'ISLAND-SUMATERA': ['sumatera', 'sumatra'], 'ISLAND-KALIMANTAN': ['kalimantan'],
  'ISLAND-SULAWESI': ['sulawesi'],
};
export const ISLANDS = {
  'ISLAND-JAWA': ['ID-JK', 'ID-BT', 'ID-JB', 'ID-JT', 'ID-YO', 'ID-JI'],
  'ISLAND-SUMATERA': ['ID-AC', 'ID-SU', 'ID-SB', 'ID-RI', 'ID-KR', 'ID-JA', 'ID-BE', 'ID-SS', 'ID-BB', 'ID-LA'],
  'ISLAND-KALIMANTAN': ['ID-KB', 'ID-KT', 'ID-KS', 'ID-KI'],
  'ISLAND-SULAWESI': ['ID-SA', 'ID-GO', 'ID-ST', 'ID-SR', 'ID-SN', 'ID-SG'],
};

export const MONTH_WORDS = {
  1: ['januari', 'jan'], 2: ['februari', 'pebruari', 'feb', 'peb'], 3: ['maret', 'mar'], 4: ['april', 'apr'], 5: ['mei'],
  6: ['juni', 'jun'], 7: ['juli', 'jul'], 8: ['agustus', 'agu', 'agt', 'aug'], 9: ['september', 'sep', 'sept'],
  10: ['oktober', 'okt', 'oct'], 11: ['november', 'nov', 'nop'], 12: ['desember', 'des', 'dec'],
};

export const TIME_WORDS = {
  thisMonth: ['bulan ini', 'bln ini', 'bulan berjalan', 'mtd', 'month to date', 'sejak awal bulan', 'bulan sekarang', 'sisa bulan', 'sisa bulan ini'],
  nextMonth: ['bulan depan', 'bln depan', 'bulan berikutnya', 'bulan selanjutnya', 'bulan mendatang', 'next month'],
  lastMonth: ['bulan lalu', 'bulan kemarin', 'bulan sebelumnya', 'bln lalu', 'bulan kmrn'],
  ytd: ['tahun ini', 'ytd', 'year to date', 'sejak awal tahun', 'sepanjang tahun', 'sampai sekarang tahun ini'],
  lastYear: ['tahun lalu', 'tahun kemarin', 'tahun sebelumnya'],
  latest: ['hari ini', 'posisi terakhir', 'terkini', 'saat ini', 'sekarang', 'terbaru', 'update terakhir', 'per hari ini', 'data terakhir'],
  yesterday: ['kemarin'],
  thisWeek: ['minggu ini', 'pekan ini'],
  lastWeek: ['minggu lalu', 'pekan lalu', 'minggu kemarin'],
  quarter: ['kuartal', 'triwulan', 'quarter', 'q'],
  semester: ['semester'],
  last: ['terakhir'],
  monthUnit: ['bulan', 'bln'],
  dayUnit: ['hari'],
  weekUnit: ['minggu', 'pekan'],
  dateWord: ['tanggal', 'tgl', 'per tanggal'],
  until: ['sampai', 'hingga', 'sd', 's d', 'sampai dengan', 'ke'],
};

export const NUMBER_WORDS = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  sebelas: 11, 'dua belas': 12, 'lima belas': 15, 'dua puluh': 20,
};

export const STOP_WORDS = new Set(('yang di dan untuk pada dari ke nya sih dong ya yah tolong coba tampilkan lihat lihatkan kasih tau tahu ' +
  'saya aku kami mau ingin bisa berapakah adalah itu ini secara dengan oleh kah lah info data mana apa apakah si para ' +
  'tunjukkan sebutkan cari carikan buat bikin berikan beri minta mohon please pls gan bro sis kak pak bu nih deh kan aja ' +
  'saja sudah udah sedang lagi juga atau seperti misalnya kalau kalo jika gimana bagaimana gmn bgmn the of in for is what ' +
  'how much many which show me total keseluruhan semua seluruh dalam selama sepanjang terhadap atas bulan hari').split(/\s+/));

export const GLOSSARY = [
  { keys: ['os', 'outstanding', 'baki debet'], title: 'OS (outstanding)', text: 'Saldo pokok kredit yang masih berjalan pada suatu tanggal. Di dashboard, OS Performance memakai satuan Rp miliar (M).' },
  { keys: ['npl', 'non performing loan', 'kredit bermasalah'], title: 'NPL (non performing loan)', text: 'Kredit dengan kolektibilitas 3 (kurang lancar), 4 (diragukan), dan 5 (macet). %NPL = OS NPL dibagi total OS.' },
  { keys: ['sml', 'dpk', 'special mention', 'dalam perhatian khusus'], title: 'SML (special mention loan)', text: 'Kredit kolektibilitas 2 (dalam perhatian khusus), yaitu menunggak 1 sampai 90 hari. SML dipantau sebagai indikator awal sebelum kredit menjadi NPL. %SML = OS SML dibagi total OS.' },
  { keys: ['rka'], title: 'RKA', text: 'Rencana Kerja dan Anggaran: target yang ditetapkan untuk tiap bulan. Capaian = nilai aktual dibagi RKA. Untuk SML dan NPL, makin kecil makin baik, sehingga capaian dihitung RKA dibagi aktual.' },
  { keys: ['guidance'], title: 'Guidance', text: 'Target disburse bulanan yang dipakai sebagai pembanding "vs RKA" di kartu Disburse.' },
  { keys: ['prognosa'], title: 'Prognosa', text: 'Perkiraan capaian disburse akhir bulan dari data sumber. Kartu Disburse menampilkan capaian terhadap prognosa.' },
  { keys: ['disburse', 'disbursement', 'pencairan'], title: 'Disburse', text: 'Nilai kredit yang dicairkan sejak awal bulan sampai tanggal posisi (month to date), dari data Performance.' },
  { keys: ['realisasi', 'akad'], title: 'Realisasi', text: 'Plafond kredit yang direalisasikan per hari, per kanca, RM, dan sumber (7 sumber, atau 5 sumber bila LNP, Top Up, dan Karyawan BRI digabung jadi ETB), dari data Realisasi.' },
  { keys: ['etb', 'existing to bank'], title: 'ETB', text: 'Gabungan sumber LNP, Top Up, dan Karyawan BRI. Dipakai di tampilan 5 sumber dashboard Realisasi.' },
  { keys: ['runoff', 'run off', 'pelunasan'], title: 'Runoff', text: 'Penurunan OS karena angsuran pokok, pelunasan (termasuk pelunasan dipercepat dan take over ke bank lain), dan hapus buku. Dashboard menghitungnya sebagai disburse dikurangi pertumbuhan OS pada periode yang sama.' },
  { keys: ['growth', 'pertumbuhan'], title: 'Growth OS', text: 'Selisih OS pada tanggal posisi dengan OS akhir bulan sebelumnya. Growth = disburse dikurangi runoff.' },
  { keys: ['mtd', 'month to date'], title: 'MtD (month to date)', text: 'Akumulasi sejak tanggal 1 sampai tanggal posisi data pada bulan yang sama.' },
  { keys: ['ytd', 'year to date'], title: 'YTD (year to date)', text: 'Akumulasi sejak 1 Januari sampai tanggal posisi data pada tahun yang sama.' },
  { keys: ['bps', 'basis poin', 'basis point'], title: 'bps (basis poin)', text: '1 bps = 0,01 poin persentase. Contoh: %NPL naik dari 3,10% ke 3,25% berarti naik 15 bps.' },
  { keys: ['flpp'], title: 'FLPP', text: 'Fasilitas Likuiditas Pembiayaan Perumahan: KPR bersubsidi pemerintah untuk masyarakat berpenghasilan rendah.' },
  { keys: ['top up', 'topup'], title: 'Top Up', text: 'Tambahan plafond pada KPR yang sudah berjalan.' },
  { keys: ['fi', 'nfi', 'fixed income', 'non fixed income'], title: 'FI dan NFI', text: 'FI (fixed income): debitur berpenghasilan tetap, misalnya karyawan. NFI (non fixed income): debitur berpenghasilan tidak tetap, misalnya wiraswasta atau profesional.' },
  { keys: ['produktivitas', 'produktivitas rm', 'disburse per rm'], title: 'Produktivitas RM', text: 'Disburse sejak awal bulan dibagi jumlah RM pada tanggal yang sama.' },
  { keys: ['kanca', 'kantor cabang'], title: 'Kanca', text: 'Kantor cabang. Satu RO membawahi beberapa kanca.' },
  { keys: ['ro', 'regional office', 'region'], title: 'RO (Regional Office)', text: 'Kantor wilayah yang membawahi sejumlah kanca. Dashboard memakai 18 RO.' },
  { keys: ['plafond', 'plafon'], title: 'Plafond', text: 'Batas kredit yang disetujui saat akad. Plafond rata-rata = total plafond dibagi jumlah debitur.' },
  { keys: ['laju biasa', 'baseline'], title: 'Laju biasa', text: 'Rata-rata disburse per hari kerja dan rasio runoff terhadap OS selama 3 bulan penuh terakhir. Dipakai sebagai dasar proyeksi sisa bulan dan bulan berikutnya.' },
  { keys: ['outlook', 'kebutuhan disburse', 'disburse dibutuhkan'], title: 'Outlook dan kebutuhan disburse', text: 'Disburse yang dibutuhkan = target OS dikurangi OS akhir bulan sebelumnya, ditambah runoff yang diperkirakan. Hasilnya dibandingkan dengan laju biasa untuk mendapat persentase kenaikan yang dibutuhkan. Bila RKA bulan depan belum ada, target memakai kenaikan RKA rata-rata 3 bulan terakhir.' },
  { keys: ['proyeksi'], title: 'Proyeksi akhir bulan', text: 'Dashboard memproyeksikan angka akhir bulan dari pola bulan-bulan sebelumnya: berapa persen total bulan biasanya sudah tercapai pada hari kerja yang sama. Cara ini memperhitungkan penumpukan di akhir bulan, sehingga lebih akurat dari proyeksi linear.' },
];

export const EXAMPLES = [
  { group: 'Posisi dan capaian', items: ['Berapa OS nasional hari ini?', 'Capaian RKA OS Bandung', 'Realisasi bulan ini berapa?', 'NPL Jakarta 2 berapa persen?'] },
  { group: 'Peringkat', items: ['RO mana NPL tertinggi?', 'Top 5 kanca realisasi bulan ini', 'RM dengan realisasi terbesar Oktober', 'RO dengan growth OS terendah'] },
  { group: 'Tren dan perbandingan', items: ['Tren NPL 6 bulan terakhir', 'Bandingkan realisasi Jakarta 1 dan Jakarta 2', 'Porsi realisasi per sumber', 'RO mana yang NPL-nya naik paling tinggi?'] },
  { group: 'Analisis', items: ['Kenapa OS naik bulan lalu?', 'Proyeksi disburse akhir bulan', 'Ada anomali realisasi minggu ini?', 'Kondisi Makassar'] },
  { group: 'Rencana dan kebutuhan', items: ['Berapa disburse yang dibutuhkan bulan depan?', 'Sisa bulan ini disburse harus naik berapa persen?', 'Kalau disburse naik 15% bulan depan?', 'Batas kenaikan NPL bulan depan', 'RO mana yang paling butuh dorongan bulan depan?'] },
  { group: 'Wilayah', items: ['Pembagian wilayah Jakarta 1, 2, dan 3', 'Kanca di Jakarta 2', 'Provinsi Jawa Tengah dilayani RO mana?', 'KC Cibubur masuk RO mana?'] },
];
