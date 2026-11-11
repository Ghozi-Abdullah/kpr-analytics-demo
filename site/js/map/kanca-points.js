import { kancaLabel, kancaProvince } from './branch-locations.js';

const LON0 = 94.8;
const LAT0 = 6.3;
const SCALE = 21;

export const toMap = (lat, lon) => [(lon - LON0) * SCALE, (LAT0 - lat) * SCALE];

export const KANCA_POINTS = {
  'ID-BA': [['negara', -8.36, 114.62], ['denpasar renon', -8.675, 115.233], ['renon', -8.675, 115.233], ['denpasar gajah mada', -8.656, 115.212],
    ['denpasar', -8.655, 115.22], ['tabanan', -8.54, 115.125], ['kuta', -8.705, 115.18], ['singaraja', -8.112, 115.088], ['gianyar', -8.54, 115.33]],
  'ID-BB': [['tanjung pandan', -2.74, 107.635], ['pangkal pinang', -2.13, 106.11]],
  'ID-BE': [['bengkulu', -3.8, 102.265], ['manna', -4.46, 102.9], ['arga makmur', -3.44, 102.2]],
  'ID-BT': [['bumi serpong damai', -6.3, 106.665], ['bsd', -6.3, 106.665], ['pamulang', -6.34, 106.735], ['gading serpong', -6.24, 106.63],
    ['serpong', -6.31, 106.67], ['rangkasbitung', -6.36, 106.25], ['cilegon', -6.017, 106.05], ['tangerang city', -6.178, 106.63],
    ['tangerang', -6.178, 106.63], ['bintaro', -6.275, 106.72], ['serang', -6.12, 106.15], ['balaraja', -6.2, 106.45],
    ['bandara soekarno hatta', -6.125, 106.655]],
  'ID-GO': [['limboto', 0.625, 122.97], ['gorontalo', 0.54, 123.06]],
  'ID-JA': [['jambi', -1.61, 103.61], ['sungai penuh', -2.06, 101.39], ['muara bungo', -1.49, 102.12]],
  'ID-JB': [['bandung sukarno hatta', -6.943, 107.635], ['sukarno hatta', -6.943, 107.635], ['bandung aa', -6.921, 107.607], ['bandung dewi sartika', -6.928, 107.604],
    ['bandung a.h. nasution', -6.915, 107.69], ['a.h. nasution', -6.915, 107.69], ['bandung dago', -6.89, 107.613], ['bandung', -6.917, 107.619],
    ['bogor pajajaran', -6.6, 106.81], ['bogor', -6.595, 106.79], ['bekasi siliwangi', -6.27, 107.0], ['bekasi', -6.24, 106.99],
    ['indramayu', -6.33, 108.32], ['tasikmalaya', -7.33, 108.22], ['cirebon gunung jati', -6.705, 108.555], ['cirebon', -6.71, 108.56],
    ['sumedang', -6.86, 107.92], ['cianjur', -6.82, 107.14], ['karawang', -6.3, 107.3], ['depok', -6.4, 106.82], ['kuningan', -6.98, 108.48],
    ['cimahi', -6.87, 107.54], ['majalengka', -6.84, 108.23], ['cikarang', -6.26, 107.15], ['sukabumi', -6.92, 106.93], ['garut', -7.21, 107.9],
    ['soreang', -7.03, 107.52], ['purwakarta', -6.555, 107.44], ['subang', -6.57, 107.76]],
  'ID-JI': [['malang kawi', -7.975, 112.625], ['malang', -7.98, 112.63], ['gresik', -7.16, 112.65], ['jember', -8.17, 113.7], ['probolinggo', -7.75, 113.21],
    ['mojokerto', -7.47, 112.43], ['surabaya jemursari', -7.32, 112.745], ['surabaya kaliasin', -7.265, 112.74], ['surabaya hr muhammad', -7.285, 112.7],
    ['surabaya diponegoro', -7.28, 112.73], ['surabaya rajawali', -7.235, 112.735], ['surabaya pahlawan', -7.245, 112.738], ['surabaya', -7.26, 112.74],
    ['bojonegoro', -7.15, 111.88], ['pamekasan', -7.16, 113.48], ['sidoarjo', -7.45, 112.71], ['lamongan', -7.12, 112.415], ['madiun', -7.63, 111.52],
    ['jombang', -7.55, 112.23], ['tuban', -6.9, 112.05], ['kediri', -7.82, 112.01], ['banyuwangi', -8.22, 114.37], ['pasuruan', -7.645, 112.905],
    ['blitar', -8.1, 112.17], ['lumajang', -8.13, 113.22], ['sumenep', -7.01, 113.86], ['bondowoso', -7.91, 113.82], ['tulungagung', -8.07, 111.9]],
  'ID-JK': [['gunung sahari', -6.155, 106.84], ['jatinegara', -6.215, 106.87], ['tanah abang', -6.19, 106.81], ['kebon jeruk', -6.19, 106.77],
    ['gatot subroto', -6.233, 106.82], ['cibubur', -6.36, 106.88], ['kck', -6.213, 106.818], ['kebayoran', -6.24, 106.8], ['kramat', -6.185, 106.845],
    ['veteran', -6.17, 106.83], ['pluit', -6.12, 106.79], ['rasuna said', -6.22, 106.83], ['pancoran', -6.245, 106.845], ['kelapa gading', -6.16, 106.905],
    ['rawamangun', -6.195, 106.89], ['cut mutiah', -6.185, 106.835], ['pantai indah kapuk', -6.11, 106.74], ['daan mogot', -6.155, 106.76],
    ['kemayoran', -6.16, 106.85], ['kalideres', -6.14, 106.71], ['s parman', -6.19, 106.795], ['semanggi', -6.215, 106.815], ['jakarta', -6.2, 106.83]],
  'ID-JT': [['demak', -6.89, 110.64], ['tegal', -6.87, 109.14], ['semarang pandanaran', -6.985, 110.41], ['semarang patimura', -6.975, 110.43],
    ['semarang a. yani', -6.99, 110.425], ['brigjen sudiarto', -7.0, 110.455], ['semarang', -6.99, 110.42], ['bumiayu', -7.25, 109.0],
    ['cilacap', -7.72, 109.01], ['ungaran', -7.14, 110.4], ['solo - sudirman', -7.57, 110.83], ['solo kartasura', -7.555, 110.74], ['kartasura', -7.555, 110.74],
    ['solo slamet riyadi', -7.565, 110.81], ['solo', -7.57, 110.82], ['kendal', -6.92, 110.2], ['cepu', -7.15, 111.59], ['pati', -6.75, 111.04],
    ['purbalingga', -7.39, 109.36], ['purwokerto', -7.42, 109.235], ['salatiga', -7.33, 110.5], ['brebes', -6.87, 109.04], ['purwodadi', -7.09, 110.91],
    ['pekalongan', -6.89, 109.675], ['pemalang', -6.89, 109.38], ['magelang', -7.47, 110.22], ['kudus', -6.8, 110.84], ['karanganyar', -7.6, 110.95],
    ['batang', -6.91, 109.73], ['purworejo', -7.71, 110.01], ['wonosobo', -7.36, 109.9], ['klaten', -7.71, 110.6], ['slawi', -6.98, 109.14],
    ['rembang', -6.71, 111.34], ['blora', -6.97, 111.42], ['boyolali', -7.53, 110.6], ['jepara', -6.59, 110.67], ['kutoarjo', -7.72, 109.91],
    ['sragen', -7.43, 111.02], ['kebumen', -7.67, 109.65], ['wonogiri', -7.81, 110.92]],
  'ID-KB': [['pontianak gajah mada', -0.035, 109.335], ['pontianak', -0.03, 109.33], ['melawi', -0.335, 111.74], ['singkawang', 0.905, 108.985],
    ['ketapang', -1.85, 109.98], ['sintang', 0.07, 111.5]],
  'ID-KI': [['bontang', 0.13, 117.5], ['sangatta', 0.51, 117.55], ['samarinda pelita', -0.485, 117.165], ['samarinda', -0.5, 117.15],
    ['balikpapan', -1.245, 116.85], ['tarakan', 3.3, 117.63], ['tanjung selor', 2.84, 117.37], ['tenggarong', -0.42, 116.99]],
  'ID-KR': [['batam nagoya', 1.145, 104.01], ['batam center', 1.13, 104.055], ['batam', 1.13, 104.03], ['tanjung pinang', 0.92, 104.45],
    ['tanjung balai karimun', 1.0, 103.42]],
  'ID-KS': [['tanjung tabalong', -2.17, 115.38], ['batulicin', -3.43, 115.99], ['martapura', -3.41, 114.85], ['banjarmasin', -3.32, 114.59], ['rantau', -2.95, 115.17]],
  'ID-KT': [['sampit', -2.54, 112.95], ['pangkalan bun', -2.68, 111.63], ['palangkaraya', -2.21, 113.92]],
  'ID-LA': [['teluk betung', -5.45, 105.26], ['tanjung karang', -5.42, 105.26], ['bandar lampung', -5.43, 105.26], ['kalianda', -5.73, 105.59],
    ['metro', -5.11, 105.31], ['bandar jaya', -4.92, 105.24], ['tulang bawang', -4.47, 105.24], ['pringsewu', -5.36, 104.98]],
  'ID-MA': [['ambon', -3.69, 128.18], ['masohi', -3.3, 128.96]],
  'ID-MU': [['ternate', 0.79, 127.38], ['soa-sio', 0.68, 127.43]],
  'ID-NB': [['sumbawa', -8.49, 117.42], ['mataram', -8.58, 116.12], ['praya', -8.71, 116.27], ['bima', -8.46, 118.73]],
  'ID-NT': [['kupang', -10.17, 123.61], ['bajawa', -8.79, 120.98], ['waingapu', -9.66, 120.26], ['labuan bajo', -8.49, 119.89]],
  'ID-PA': [['jayapura', -2.53, 140.72], ['abepura', -2.6, 140.65], ['sentani', -2.57, 140.51], ['timika', -4.55, 136.89], ['merauke', -8.49, 140.4],
    ['biak', -1.18, 136.08], ['wamena', -4.09, 138.95], ['nabire', -3.37, 135.5]],
  'ID-PB': [['sorong', -0.88, 131.26], ['manokwari', -0.86, 134.06], ['fakfak', -2.93, 132.3], ['bintuni', -2.11, 133.53]],
  'ID-RI': [['tembilahan', -0.33, 103.16], ['pekanbaru tuanku tambusai', 0.5, 101.43], ['pekanbaru sudirman', 0.51, 101.45],
    ['pekanbaru lancang kuning', 0.535, 101.43], ['pekanbaru', 0.51, 101.44], ['selat panjang', 1.01, 102.71], ['dumai', 1.67, 101.45],
    ['teluk kuantan', -0.53, 101.56], ['bangkinang', 0.34, 101.03], ['pangkalan kerinci', 0.39, 101.86], ['pasir pengaraian', 0.86, 100.29],
    ['bagan batu', 1.74, 100.95], ['siak', 0.79, 102.05], ['bengkalis', 1.47, 102.11], ['rengat', -0.38, 102.55]],
  'ID-SA': [['manado boulevard', 1.48, 124.83], ['manado', 1.49, 124.84], ['tondano', 1.3, 124.91], ['bitung', 1.44, 125.19], ['kotamobagu', 0.73, 124.32]],
  'ID-SB': [['padang', -0.95, 100.35], ['batu sangkar', -0.46, 100.59], ['bukittinggi', -0.305, 100.37], ['dharmasraya', -1.05, 101.37],
    ['solok', -0.79, 100.66], ['payakumbuh', -0.22, 100.63]],
  'ID-SG': [['raha', -4.84, 122.72], ['kendari by pass', -3.99, 122.52], ['kendari', -3.97, 122.51], ['kolaka', -4.05, 121.59], ['bau-bau', -5.47, 122.62]],
  'ID-SN': [['palopo', -2.99, 120.2], ['tamalanrea', -5.13, 119.49], ['watampone', -4.54, 120.33], ['sidrap', -3.93, 119.8], ['panakkukang', -5.155, 119.445],
    ['takalar', -5.41, 119.49], ['pare-pare', -4.01, 119.62], ['bulukumba', -5.56, 120.19], ['sungguminasa', -5.205, 119.45], ['bantaeng', -5.55, 119.95],
    ['maros', -5.0, 119.57], ['somba opu', -5.14, 119.41], ['makassar sudirman', -5.145, 119.42], ['makassar', -5.14, 119.42], ['barru', -4.41, 119.62],
    ['pinrang', -3.79, 119.65], ['pangkep', -4.83, 119.55], ['masamba', -2.55, 120.33], ['benteng selayar', -6.12, 120.46], ['sengkang', -4.13, 120.03],
    ['jeneponto', -5.68, 119.73], ['watansopeng', -4.35, 119.88], ['sinjai', -5.12, 120.25], ['enrekang', -3.56, 119.79]],
  'ID-SR': [['majene', -3.54, 118.97], ['mamuju', -2.68, 118.89], ['polewali', -3.41, 119.33]],
  'ID-SS': [['palembang a. rivai', -2.975, 104.75], ['palembang sriwijaya', -2.985, 104.76], ['palembang', -2.98, 104.755], ['lubuk linggau', -3.3, 102.86],
    ['muara enim', -3.65, 103.77], ['pagar alam', -4.02, 103.25], ['baturaja', -4.13, 104.17], ['lahat', -3.79, 103.54], ['prabumulih', -3.43, 104.24]],
  'ID-ST': [['palu', -0.9, 119.87], ['morowali', -2.55, 121.97], ['luwuk', -0.95, 122.79]],
  'ID-SU': [['medan putri hijau', 3.595, 98.675], ['medan sisingamangaraja', 3.565, 98.69], ['medan iskandar muda', 3.58, 98.655], ['medan', 3.59, 98.67],
    ['pematang siantar', 2.96, 99.06], ['gunung sitoli', 1.29, 97.61], ['sibolga', 1.74, 98.78], ['binjai', 3.6, 98.49], ['sidikalang', 2.74, 98.32],
    ['lubuk pakam', 3.56, 98.87], ['rantau prapat', 2.1, 99.83], ['kisaran', 2.98, 99.62], ['kabanjahe', 3.1, 98.49], ['stabat', 3.73, 98.45],
    ['tebing tinggi', 3.33, 99.16], ['padang sidempuan', 1.38, 99.27]],
  'ID-YO': [['yogyakarta adisucipto', -7.78, 110.4], ['adisucipto', -7.78, 110.4], ['yogyakarta mlati', -7.745, 110.34], ['mlati', -7.745, 110.34],
    ['yogyakarta cik ditiro', -7.78, 110.375], ['yogyakarta', -7.795, 110.37], ['sleman', -7.715, 110.355], ['wonosari', -7.965, 110.6], ['bantul', -7.89, 110.33]],
};

const RULES = new Map(Object.entries(KANCA_POINTS).map(([prov, list]) => [prov, list
  .map(([key, lat, lon]) => ({ key, lat, lon, re: new RegExp(`(^|[^a-z])(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![a-z])`) }))]));
const cache = new Map();

const titleWord = (w) => (/^[A-Z]{4,}$/.test(w) ? w[0] + w.slice(1).toLowerCase() : w);
export const shortKancaName = (raw) => kancaLabel(raw).replace(/^(kc|kanca)\s+/i, '').trim().split(/\s+/).map(titleWord).join(' ');

export function kancaPoint(raw, prov = kancaProvince(raw)) {
  const id = `${prov}|${raw}`;
  if (cache.has(id)) return cache.get(id);
  const name = kancaLabel(raw).toLowerCase().replace(/\s+/g, ' ');
  let best = null;
  let bestScore = -1;
  for (const rule of RULES.get(prov) || []) {
    const m = rule.re.exec(name);
    if (!m) continue;
    const end = m.index + m[1].length + m[2].length;
    const score = end * 100 + rule.key.length;
    if (score > bestScore) { best = rule; bestScore = score; }
  }
  const out = best ? { lat: best.lat, lon: best.lon, xy: toMap(best.lat, best.lon) } : null;
  cache.set(id, out);
  return out;
}
