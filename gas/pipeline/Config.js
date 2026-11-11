var KPR_CONFIG = {
  "PERFORMANCE_COLUMNS": {
    "Tanggal": "tanggal",
    "Regional Office": "ro",
    "Hari Kerja": "hari_kerja",
    "Hari Kerja Bulan Lalu": "hari_kerja_lalu",
    "Hari": "hari",
    "OS": "os",
    "helper_os": "helper_os",
    "Gr_OS": "gr_os",
    "Gr_OS_lalu": "gr_os_lalu",
    "Graph_OS": "graph_os",
    "Graph_OS_lalu": "graph_os_lalu",
    "Graph_OS_Khusus": "graph_os_khusus",
    "Nilai Akhir_OS_Lalu": "nilai_akhir_os_lalu",
    "rka_os_baru": "rka_os",
    "Debitur": "debitur",
    "Gr_Deb": "gr_deb",
    "helper_Deb": "helper_deb",
    "RKA_Deb": "rka_deb",
    "DPK": "dpk",
    "helper_DPK": "helper_dpk",
    "Gr_DPK": "gr_dpk",
    "RKA_DPK": "rka_dpk",
    "Line Chart DPK": "line_dpk",
    "NPL": "npl",
    "helper_NPL": "helper_npl",
    "Gr_NPL": "gr_npl",
    "RKA_NPL": "rka_npl",
    "Line Chart NPL": "line_npl",
    "Disburse": "disburse",
    "Disburse_lalu": "disburse_lalu",
    "Graph_Disburse": "graph_disburse",
    "GR_Disburse": "gr_disburse",
    "GR_Disburse_Khusus": "gr_disburse_khusus",
    "Prognosa_disburse": "prognosa_disb",
    "Guidance_disb": "guidance_disb",
    "jum_RM": "jum_rm",
    "Jumlah RM Lalu": "jum_rm_lalu",
    "Prod_RM_Now": "prod_rm",
    "Prod_RM_Lalu": "prod_rm_lalu",
    "Prod_RM_Khusus": "prod_rm_khusus",
    "Prognosa_disburse_rm": "prognosa_disb_rm",
    "Guidance_disb_rm": "guidance_disb_rm"
  },
  "PERFORMANCE_REQUIRED": [
    "tanggal",
    "ro",
    "os",
    "rka_os",
    "debitur",
    "rka_deb",
    "dpk",
    "rka_dpk",
    "npl",
    "rka_npl",
    "disburse"
  ],
  "KUADRAN_COLUMNS": {
    "Tanggal": "tanggal",
    "Regional Office": "ro",
    "Kuadran": "kuadran",
    "Jumlah RM": "jumlah_rm",
    "Jumlah RM_Lalu": "jumlah_rm_lalu"
  },
  "KUADRAN_REQUIRED": [
    "tanggal",
    "ro",
    "kuadran",
    "jumlah_rm"
  ],
  "PORTFOLIO_COLUMNS": {
    "Bulan": "bulan",
    "RO": "ro",
    "KANCA": "kanca",
    "KC FIX": "kanca_fix",
    "Kode KC": "kode_kc",
    "Produk": "produk",
    "Tujuan Kredit": "tujuan",
    "Tier Dev": "tier",
    "Jenis Pendapatan": "jenis_pendapatan",
    "Kolek": "kolek",
    "Kategori OS": "kategori_os",
    "Rp.1": "os_rp",
    "No": "no",
    "Kategori Deb": "kategori_deb",
    "Jum Deb": "debitur"
  },
  "PORTFOLIO_REQUIRED": [
    "bulan",
    "ro",
    "produk",
    "kategori_os",
    "os_rp"
  ],
  "PORTFOLIO_GRAIN": [
    "bulan",
    "ro",
    "kanca",
    "produk",
    "tujuan",
    "tier"
  ],
  "REALISASI_COLUMNS": {
    "Tanggal Realisasi": "tanggal",
    "RO": "ro",
    "Kanca": "kanca",
    "Nama RM": "rm",
    "Tipe KPR": "tipe",
    "Tujuan Kredit": "tujuan",
    "Dev Local Champion": "dev_local_champion",
    "Plafond": "plafond",
    "Debitur Count": "debitur",
    "5 Sumber": "sumber5",
    "6 Sumber": "sumber6"
  },
  "REALISASI_REQUIRED": [
    "tanggal",
    "ro",
    "tipe",
    "plafond"
  ],
  "REALISASI_GRAIN": [
    "tanggal",
    "ro",
    "kanca",
    "rm",
    "tipe",
    "sumber5",
    "sumber6",
    "tujuan",
    "dev_local_champion"
  ],
  "SLA_COLUMNS": {
    "NAMA KANWIL": "ro",
    "NAMA BRANCH": "kanca",
    "process_group": "proses",
    "JENIS PENDAPATAN": "pendapatan",
    "JENIS PUTUSAN": "putusan",
    "JENIS KPR": "jenis_kpr",
    "DESKRIPSI CRS": "crs",
    "JENIS PEKERJAAN": "pekerjaan",
    "type": "type",
    "NOMINAL PENGAJUAN": "nominal_pengajuan",
    "NOMINAL PENCAIRAN": "nominal_cair",
    "TANGGAL PRAKARSA": "tgl_prakarsa",
    "TANGGAL ENTRY CLF AWAL": "tgl_clf_awal",
    "TANGGAL PUTUSAN": "tgl_putusan",
    "Tanggal Realisasi": "tgl_cair",
    "today": "today",
    "delta proses prakarsa": "delta_prakarsa",
    "delta proses analisa": "delta_analisa",
    "delta proses putusan": "delta_putusan"
  },
  "SLA_REQUIRED": [
    "ro",
    "proses"
  ],
  "SLA_GRAIN": [
    "ro",
    "kanca",
    "proses",
    "pendapatan",
    "putusan",
    "jenis_kpr",
    "crs",
    "pekerjaan",
    "type",
    "bulan",
    "umur"
  ],
  "SLA_STAGE_AGE": {
    "proses prakarsa": [
      "delta_prakarsa",
      "tgl_prakarsa"
    ],
    "proses analisis": [
      "delta_analisa",
      "tgl_clf_awal"
    ],
    "proses analisa": [
      "delta_analisa",
      "tgl_clf_awal"
    ],
    "sudah diputus": [
      "delta_putusan",
      "tgl_putusan"
    ]
  },
  "SLA_DONE_END": {
    "sudah cair": "tgl_cair",
    "ditolak": "tgl_putusan",
    "sudah diputus": "tgl_putusan"
  },
  "SLA_DAILY_EVENTS": {
    "prakarsa": [
      "tgl_prakarsa",
      "nominal_pengajuan"
    ],
    "analisa": [
      "tgl_clf_awal",
      "nominal_pengajuan"
    ],
    "putusan": [
      "tgl_putusan",
      "nominal_pengajuan"
    ],
    "cair": [
      "tgl_cair",
      "nominal_cair"
    ]
  },
  "SLA_DAILY_GRAIN": [
    "tanggal",
    "ro",
    "kanca",
    "pendapatan",
    "putusan",
    "tahap"
  ],
  "SLA_DAILY_SKIP": [
    "ditolak"
  ],
  "SENSITIVE_SOURCE_COLUMNS": {
    "realisasi": [
      "Nama Debitur"
    ],
    "sla": [
      "NAMA DEBITUR",
      "NAMA REKENING SIMPANAN"
    ]
  },
  "CATEGORY_FIELDS": [
    "proses",
    "pendapatan",
    "putusan",
    "jenis_kpr",
    "crs",
    "pekerjaan",
    "type",
    "bulan",
    "tipe",
    "sumber5",
    "sumber6",
    "tujuan",
    "dev_local_champion",
    "produk",
    "tier",
    "kolek",
    "kategori_os",
    "kategori_deb",
    "jenis_pendapatan",
    "kuadran",
    "kat",
    "tahap"
  ],
  "FORBIDDEN_FIELD_PATTERNS": [
    "nama[_ ]?debitur",
    "nasabah",
    "rekening",
    "\\bnorek\\b",
    "\\bcif\\b",
    "\\bnik\\b",
    "ktp",
    "alamat",
    "telp",
    "phone",
    "\\bhp\\b",
    "email",
    "npwp",
    "tgl[_ ]?lahir",
    "tanggal[_ ]?lahir"
  ],
  "LONG_DIGIT_PATTERN": "\\d{10,}"
};
