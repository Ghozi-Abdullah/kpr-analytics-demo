import { kancaLabel } from './branch-locations.js';

export const METRO_NAME = 'Jabodetabek';
export const METRO_GRID = { cols: 7, rows: 4 };

export const METRO_AREAS = [
  { id: 'jakut', name: 'Jakarta Utara', short: 'Jakut', prov: 'ID-JK', x: 2, y: 0, w: 3,
    keys: ['pluit', 'kelapa gading', 'pantai indah kapuk', 'tanjung priok', 'sunter', 'koja', 'pademangan', 'penjaringan', 'cilincing', 'muara karang', 'ancol', 'jakarta utara'] },
  { id: 'serang', name: 'Serang dan Cilegon', short: 'Serang', prov: 'ID-BT', x: 0, y: 1,
    keys: ['serang', 'cilegon', 'merak', 'anyer'] },
  { id: 'tangerang', name: 'Tangerang', short: 'Tangerang', prov: 'ID-BT', x: 1, y: 1,
    keys: ['tangerang', 'gading serpong', 'balaraja', 'bandara soekarno hatta', 'karawaci', 'cikupa', 'tigaraksa', 'cikokol', 'alam sutera'] },
  { id: 'jakbar', name: 'Jakarta Barat', short: 'Jakbar', prov: 'ID-JK', x: 2, y: 1,
    keys: ['kebon jeruk', 'daan mogot', 'kalideres', 's parman', 'slipi', 'grogol', 'cengkareng', 'puri indah', 'kembangan', 'taman sari', 'tambora', 'palmerah', 'jakarta barat'] },
  { id: 'jakpus', name: 'Jakarta Pusat', short: 'Jakpus', prov: 'ID-JK', x: 3, y: 1,
    keys: ['gunung sahari', 'tanah abang', 'kck', 'kramat', 'veteran', 'cut mutiah', 'kemayoran', 'semanggi', 'menteng', 'thamrin', 'senen', 'gambir', 'cikini', 'salemba', 'harmoni', 'jakarta pusat'] },
  { id: 'jaktim', name: 'Jakarta Timur', short: 'Jaktim', prov: 'ID-JK', x: 4, y: 1,
    keys: ['jatinegara', 'rawamangun', 'cibubur', 'pulogadung', 'pulo gadung', 'cakung', 'duren sawit', 'kramat jati', 'pasar rebo', 'ciracas', 'matraman', 'cawang', 'halim', 'jakarta timur'] },
  { id: 'bekasi', name: 'Bekasi', short: 'Bekasi', prov: 'ID-JB', x: 5, y: 1,
    keys: ['bekasi', 'cikarang', 'cibitung', 'tambun'] },
  { id: 'karawang', name: 'Karawang', short: 'Karawang', prov: 'ID-JB', x: 6, y: 1,
    keys: ['karawang', 'cikampek'] },
  { id: 'lebak', name: 'Lebak dan Pandeglang', short: 'Lebak', prov: 'ID-BT', x: 0, y: 2,
    keys: ['rangkasbitung', 'lebak', 'pandeglang', 'labuan'] },
  { id: 'tangsel', name: 'Tangerang Selatan', short: 'Tangsel', prov: 'ID-BT', x: 1, y: 2,
    keys: ['bumi serpong damai', 'bsd', 'serpong', 'pamulang', 'bintaro', 'ciputat', 'tangerang selatan'] },
  { id: 'jaksel', name: 'Jakarta Selatan', short: 'Jaksel', prov: 'ID-JK', x: 2, y: 2, w: 2,
    keys: ['gatot subroto', 'kebayoran', 'rasuna said', 'pancoran', 'mampang', 'cilandak', 'fatmawati', 'pondok indah', 'tebet', 'kemang', 'blok m', 'pasar minggu', 'jagakarsa', 'setiabudi', 'simatupang', 'senayan', 'kuningan', 'jakarta selatan'] },
  { id: 'depok', name: 'Depok', short: 'Depok', prov: 'ID-JB', x: 4, y: 2,
    keys: ['depok', 'cimanggis', 'margonda'] },
  { id: 'bogor', name: 'Bogor', short: 'Bogor', prov: 'ID-JB', x: 2, y: 3, w: 3,
    keys: ['bogor', 'cibinong', 'cileungsi'] },
];

const AREA = new Map(METRO_AREAS.map((a) => [a.id, a]));
const RULES_BY_PROV = new Map();
for (const a of METRO_AREAS) {
  for (const k of a.keys) {
    const list = RULES_BY_PROV.get(a.prov) || [];
    list.push({ area: a.id, len: k.length, re: new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`) });
    RULES_BY_PROV.set(a.prov, list);
  }
}
for (const list of RULES_BY_PROV.values()) list.sort((a, b) => b.len - a.len);
export const METRO_PROVINCES = new Set(RULES_BY_PROV.keys());

const cache = new Map();

export function metroAreaOf(kanca, prov) {
  const id = `${prov}|${kanca}`;
  if (cache.has(id)) return cache.get(id);
  const rules = RULES_BY_PROV.get(prov);
  const n = kancaLabel(kanca).toLowerCase();
  const hit = rules ? rules.find((r) => r.re.test(n)) : null;
  const area = hit ? hit.area : '';
  cache.set(id, area);
  return area;
}

export const metroArea = (id) => AREA.get(id);
