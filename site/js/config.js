export const BRAND = { nusantara: '#0857C3', cakrawala: '#307FE2', mentari: '#71C5E8' };

export const ACH_THRESHOLDS = { good: 1.0, warn: 0.9 };

export const PERCENT_COLUMNS_ARE_FRACTION = true;

export const PERF_CARDS = [
  { id: 'os', icon: 'wallet', title: 'Outstanding', label: 'Outstanding', unit: 'M', type: 'rka', value: 'os', target: 'rka_os', decimals: 0, chart: 'growth-os' },
  { id: 'deb', icon: 'users', title: 'Debitur', label: 'Debitur', type: 'rka', value: 'debitur', target: 'rka_deb', decimals: 0, chart: 'rank' },
  { id: 'sml', icon: 'flag', title: 'SML', label: 'SML', unit: 'M', type: 'ratio', value: 'dpk', target: 'rka_dpk', base: 'os', ratioLabel: '%SML/OS',
    inverse: true, decimals: 0, chart: 'sml' },
  { id: 'npl', icon: 'shield', title: 'NPL', label: 'NPL', unit: 'M', type: 'ratio', value: 'npl', target: 'rka_npl', base: 'os', ratioLabel: '%NPL/OS',
    inverse: true, decimals: 0, chart: 'npl' },
  { id: 'disb', icon: 'send', title: 'Disburse', label: 'Disburse', unit: 'M', type: 'disburse', value: 'disburse', prognosa: 'prognosa_disb',
    guidance: 'guidance_disb', decimals: 0, chart: 'disburse' },
  { id: 'disbrm', icon: 'user-check', title: 'Disburse/RM', label: 'Disburse per RM', unit: 'M', type: 'disburse', value: 'prod_rm', prognosa: 'prognosa_disb_rm',
    guidance: 'guidance_disb_rm', decimals: 2, chart: 'prod-rm' },
];

export const PERF_TREND_CHARTS = [
  { id: 'growth-os', title: 'Growth OS', long: 'Ratas growth OS harian (Rp M)', cur: 'graph_os', prev: 'graph_os_lalu', decimals: 0,
    badges: [
      { label: 'OS/hari kerja bulan lalu', of: 'prev', decimals: 2 },
      { label: 'OS/hari kerja bulan ini', of: 'cur', decimals: 2 },
    ] },
  { id: 'disburse', title: 'Disburse', long: 'Disburse kumulatif sejak awal bulan (Rp M)', cur: 'disburse', prev: 'disburse_lalu', decimals: 0,
    badges: [
      { label: 'Disb/hari kerja bulan lalu', of: 'prev', decimals: 2 },
      { label: 'Disb/hari kerja bulan ini', of: 'cur', decimals: 2 },
    ] },
  { id: 'prod-rm', title: 'Produktivitas RM', long: 'Produktivitas RM (Rp M per RM)', cur: 'prod_rm', prev: 'prod_rm_lalu', decimals: 2,
    badges: [
      { label: 'Jumlah RM bulan lalu', column: 'jum_rm_lalu', decimals: 0 },
      { label: 'Jumlah RM bulan ini', column: 'jum_rm', decimals: 0 },
    ] },
];

export const PERF_QUALITY_CHARTS = [
  { id: 'sml', title: 'SML', bar: 'dpk', line: 'line_dpk' },
  { id: 'npl', title: 'NPL', bar: 'npl', line: 'line_npl' },
];

export const RO_TERRITORY = [
  { key: 'medan', prov: { 'ID-SU': 15 } },
  { key: 'pekanbaru', prov: { 'ID-RI': 14, 'ID-KR': 4 } },
  { key: 'padang', prov: { 'ID-SB': 6, 'ID-JA': 1 } },
  { key: 'palembang', prov: { 'ID-SS': 8, 'ID-JA': 2, 'ID-BB': 2 } },
  { key: 'lampung', prov: { 'ID-LA': 7, 'ID-BE': 3 } },
  { key: 'jakarta 1', prov: { 'ID-JK': 13 }, metro: { jakpus: 8, jakut: 3, jaktim: 2 } },
  { key: 'jakarta 2', prov: { 'ID-JB': 6, 'ID-JK': 5 }, metro: { jaksel: 4, bogor: 2, bekasi: 2, jaktim: 1, depok: 1, karawang: 1 } },
  { key: 'jakarta 3', prov: { 'ID-BT': 10, 'ID-JK': 4 }, metro: { jakbar: 4, tangerang: 4, tangsel: 3, serang: 2, lebak: 1 } },
  { key: 'bandung', prov: { 'ID-JB': 18 } },
  { key: 'semarang', prov: { 'ID-JT': 22 } },
  { key: 'yogya', prov: { 'ID-JT': 16, 'ID-YO': 6 } },
  { key: 'surabaya', prov: { 'ID-JI': 15 } },
  { key: 'malang', prov: { 'ID-JI': 11 } },
  { key: 'banjarmasin', prov: { 'ID-KI': 8, 'ID-KS': 5, 'ID-KB': 5, 'ID-KT': 3 } },
  { key: 'makassar', prov: { 'ID-SN': 23, 'ID-SG': 5, 'ID-SR': 3, 'ID-MA': 2 } },
  { key: 'manado', prov: { 'ID-SA': 5, 'ID-ST': 3, 'ID-GO': 2, 'ID-MU': 2 } },
  { key: 'denpasar', prov: { 'ID-BA': 7, 'ID-NT': 4, 'ID-NB': 4 } },
  { key: 'jayapura', prov: { 'ID-PA': 8, 'ID-PB': 4 } },
];

export const PORTFOLIO_RP_UNIT = 'rupiah';

export const PORTFOLIO_NODES = [
  { id: 'all', label: 'ALL KPR', card: 'ALL KPR', icon: 'home', filter: {}, col: 1, row: '1 / span 2' },
  { id: 'komersial', label: 'Komersial', card: 'Komersial', icon: 'bank', filter: { produk: ['KPR', 'Komersial'] },
    parent: 'all', col: 2, row: '1', main: true },
  { id: 'subsidi', label: 'Subsidi', card: 'Subsidi', icon: 'shield', filter: { produk: ['KPRS', 'Subsidi'] },
    parent: 'all', col: 2, row: '2' },
  { id: 'primary', label: 'Primary', card: 'Komersial Primary', icon: 'key', filter: { produk: ['KPR', 'Komersial'], tujuan: 'Primary' },
    parent: 'komersial', col: 3, row: '1', main: true },
  { id: 'secondary', label: 'Secondary', card: 'Secondary', icon: 'repeat', filter: { produk: ['KPR', 'Komersial'], tujuan: 'Secondary' },
    parent: 'komersial', col: 3, row: '2' },
  { id: 'refinancing', label: 'Refinancing', card: 'Refinancing', icon: 'wallet',
    filter: { produk: ['KPR', 'Komersial'], tujuan: 'Refinancing' }, parent: 'komersial', col: 3, row: '3' },
  { id: 'tier1', label: 'Dev Tier 1', card: 'Dev Tier 1', icon: 'star',
    filter: { produk: ['KPR', 'Komersial'], tujuan: 'Primary', tier: ['Dev Tier 1', 'Tier 1'] }, parent: 'primary', col: 4, row: '1', main: true },
  { id: 'nontier1', label: 'Dev Non Tier 1', card: 'Dev Non Tier 1', icon: 'team',
    filter: { produk: ['KPR', 'Komersial'], tujuan: 'Primary', tier: ['Non Dev Tier 1', 'Non Tier 1'] }, parent: 'primary', col: 4, row: '2' },
];

export const REALISASI_SUMBER_7 = ['Dev Tier 1', 'Non Dev Tier 1', 'Secondary', 'FLPP', 'LNP', 'Top Up', 'Karyawan BRI'];
export const REALISASI_SUMBER_6 = ['Dev Tier 1', 'ETB', 'Local Champ', 'Dev Tier 3', 'Secondary', 'Subsidi'];
export const REALISASI_SUMBER_5 = ['Dev Tier 1', 'Non Dev Tier 1', 'ETB', 'Secondary', 'FLPP'];
export const REALISASI_PADANAN = {
  7: { 'Local Champ': 'Non Dev Tier 1', 'Dev Tier 3': 'Non Dev Tier 1', Subsidi: 'FLPP' },
  6: { LNP: 'ETB', 'Top Up': 'ETB', 'Karyawan BRI': 'ETB', FLPP: 'Subsidi' },
  5: { LNP: 'ETB', 'Top Up': 'ETB', 'Karyawan BRI': 'ETB', 'Local Champ': 'Non Dev Tier 1', 'Dev Tier 3': 'Non Dev Tier 1', Subsidi: 'FLPP' },
};
export const REALISASI_LOCAL_CHAMP = {
  from: 'Non Dev Tier 1', yes: 'Local Champ', no: 'Dev Tier 3',
  yesValues: ['ya', 'y', 'yes', 'iya', '1', 'true', 'local champ', 'local champion', 'lc'],
};
export const REALISASI_SUMBER_DEFAULT = '7';
export const REALISASI_TIPE_ALIAS = {
  'Developer Tier 1': 'Dev Tier 1', 'Tier 1': 'Dev Tier 1',
  'Non Tier 1': 'Non Dev Tier 1', 'Non Developer Tier 1': 'Non Dev Tier 1', 'Dev Non Tier 1': 'Non Dev Tier 1',
  'Local Champion': 'Local Champ', 'Dev Local Champion': 'Local Champ', 'Developer Tier 3': 'Dev Tier 3', 'Tier 3': 'Dev Tier 3',
  Topup: 'Top Up', Karyawan: 'Karyawan BRI',
};
export const REALISASI_PLAFOND_UNIT = 'juta';
export const REALISASI_HIGHLIGHT_MONTHS = 3;

export const SLA_TARGET_HARI = 3;
export const SLA_STAGES = [
  { id: 'prakarsa', no: '01', label: 'Prakarsa', event: 'Prakarsa baru', note: 'Berkas sedang diprakarsai', match: ['proses prakarsa', 'prakarsa'], active: true, icon: 'send' },
  { id: 'analisa', no: '02', label: 'Analisa', event: 'Masuk analisa', note: 'Sedang dianalisa', match: ['proses analisis', 'proses analisa', 'analisis', 'analisa'], active: true, icon: 'search' },
  { id: 'putusan', no: '03', label: 'Putusan', event: 'Diputus', note: 'Disetujui, menunggu cair', match: ['sudah diputus', 'diputus'], active: true, icon: 'check' },
  { id: 'cair', no: '04', label: 'Cair', event: 'Cair', note: 'Kredit sudah dicairkan', match: ['sudah cair', 'cair'], icon: 'wallet' },
];
export const SLA_SKIP_PROSES = ['ditolak', 'tolak'];
export const SLA_DETAIL_DAYS = 30;
export const SLA_DETAIL_TOP = 8;
export const SLA_CARD_RANGE = { analisa: 'umur', cair: 'lama' };
export const SLA_FLOW_NEXT = { prakarsa: 'analisa', analisa: 'putusan', putusan: 'cair' };
export const SLA_FLOW_RECENT = 7;
export const SLA_CHASE_TOP = 5;
export const SLA_CHASE_MIN = 3;
export const SLA_STAGE_COLOR = { prakarsa: '#71C5E8', analisa: '#307FE2', putusan: '#0857C3', cair: '#06357A' };
export const SLA_CRS_ORDER = ['Risiko sangat rendah', 'Risiko rendah', 'Risiko cukup rendah', 'Risiko sedang',
  'Risiko perlu mendapat perhatian', 'Risiko cukup tinggi', 'Risiko tinggi'];
export const SLA_JENIS_KPR_ORDER = ['Pembelian Rumah Baru', 'Pembelian Rumah Second', 'Take Over Murni', 'Take Over Top Up',
  'Top Up', 'Refinancing Rumah', 'Pembangunan', 'Refinancing Rumah Toko', 'Pembelian Rumah Kantor Baru',
  'Pembelian Rumah Toko Baru', 'Pembelian Rumah Toko Second'];
export const SLA_TYPE_LABEL = { payroll: 'Payroll', nonpayroll: 'Non payroll', sme: 'SME', lnp: 'LNP', karyawan: 'Karyawan' };
export const SLA_AGE_BUCKETS = [
  { max: 1, label: '0–1 hari' }, { max: 3, label: '2–3 hari' }, { max: 5, label: '4–5 hari' },
  { max: 10, label: '6–10 hari' }, { max: Infinity, label: '> 10 hari' },
];
