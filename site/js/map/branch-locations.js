export const KANCA_CITY = [
  ["ID-JK", ["jakarta", "jkt", "semanggi", "cibubur"]],
  ["ID-BT", ["tangerang", "serpong", "bumi serpong damai", "pamulang", "bintaro", "balaraja", "serang", "cilegon", "rangkasbitung", "bandara soekarno hatta"]],
  ["ID-JB", ["bandung", "bekasi", "cikarang", "bogor", "depok", "karawang", "purwakarta", "subang", "indramayu", "cirebon", "kuningan", "majalengka", "sumedang", "garut", "tasikmalaya", "cianjur", "sukabumi", "cimahi", "soreang"]],
  ["ID-YO", ["yogyakarta", "sleman", "bantul", "wonosari", "mlati"]],
  ["ID-JT", ["semarang", "brigjen sudiarto", "ungaran", "salatiga", "kendal", "demak", "kudus", "pati", "jepara", "rembang", "blora", "cepu", "purwodadi", "pekalongan", "batang", "pemalang", "tegal", "slawi", "brebes", "bumiayu", "purwokerto", "purbalingga", "cilacap", "kebumen", "kutoarjo", "purworejo", "magelang", "wonosobo", "klaten", "solo", "kartasura", "boyolali", "sragen", "karanganyar", "wonogiri"]],
  ["ID-JI", ["surabaya", "sidoarjo", "gresik", "mojokerto", "jombang", "lamongan", "tuban", "bojonegoro", "madiun", "kediri", "blitar", "tulungagung", "malang", "pasuruan", "probolinggo", "lumajang", "jember", "bondowoso", "banyuwangi", "pamekasan", "sumenep"]],
  ["ID-SU", ["medan", "binjai", "stabat", "lubuk pakam", "pematang siantar", "tebing tinggi", "kisaran", "rantau prapat", "sibolga", "padang sidempuan", "gunung sitoli", "kabanjahe", "sidikalang"]],
  ["ID-AC", ["banda aceh", "aceh", "lhokseumawe", "langsa", "meulaboh"]],
  ["ID-SB", ["padang", "bukittinggi", "payakumbuh", "batu sangkar", "solok", "dharmasraya"]],
  ["ID-KR", ["batam", "tanjung pinang", "tanjung balai karimun"]],
  ["ID-RI", ["pekanbaru", "dumai", "bengkalis", "siak", "tembilahan", "rengat", "bangkinang", "teluk kuantan", "pangkalan kerinci", "pasir pengaraian", "bagan batu", "selat panjang"]],
  ["ID-JA", ["jambi", "sungai penuh", "muara bungo"]],
  ["ID-BE", ["bengkulu", "manna", "arga makmur"]],
  ["ID-SS", ["palembang", "prabumulih", "lubuk linggau", "muara enim", "baturaja", "lahat", "pagar alam"]],
  ["ID-BB", ["pangkal pinang", "tanjung pandan"]],
  ["ID-LA", ["bandar lampung", "lampung", "teluk betung", "tanjung karang", "metro", "kalianda", "pringsewu", "bandar jaya", "tulang bawang"]],
  ["ID-BA", ["denpasar", "kuta", "tabanan", "gianyar", "singaraja", "negara"]],
  ["ID-NB", ["mataram", "sumbawa", "praya", "bima"]],
  ["ID-NT", ["kupang", "bajawa", "waingapu", "labuan bajo"]],
  ["ID-KB", ["pontianak", "singkawang", "ketapang", "sintang", "melawi"]],
  ["ID-KT", ["palangkaraya", "sampit", "pangkalan bun"]],
  ["ID-KS", ["banjarmasin", "martapura", "batulicin", "tanjung tabalong", "rantau"]],
  ["ID-KI", ["samarinda", "balikpapan", "bontang", "sangatta", "tenggarong", "tarakan", "tanjung selor"]],
  ["ID-SN", ["makassar", "panakkukang", "tamalanrea", "somba opu", "sungguminasa", "maros", "pangkep", "barru", "pare-pare", "pinrang", "sidrap", "enrekang", "palopo", "masamba", "sengkang", "watampone", "watansopeng", "sinjai", "bulukumba", "bantaeng", "jeneponto", "takalar", "benteng selayar"]],
  ["ID-SR", ["majene", "mamuju", "polewali"]],
  ["ID-SG", ["kendari", "kolaka", "raha", "bau-bau"]],
  ["ID-ST", ["palu", "luwuk", "morowali"]],
  ["ID-SA", ["manado", "bitung", "tondano", "kotamobagu"]],
  ["ID-GO", ["gorontalo", "limboto"]],
  ["ID-MU", ["ternate", "soa-sio"]],
  ["ID-MA", ["ambon", "masohi"]],
  ["ID-PB", ["sorong", "manokwari", "fakfak", "bintuni"]],
  ["ID-PA", ["jayapura", "abepura", "sentani", "timika", "merauke", "biak", "wamena", "nabire"]]
];

export function kancaLabel(raw) {
  return String(raw ?? '')
    .replace(/^\s*\d+\s*--\s*/, '')
    .replace(/\s*\(konsolidasi[^)]*\)\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const RULES = KANCA_CITY.flatMap(([prov, keys]) => keys.map((k) => ({
  prov, re: new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`),
})));
const cache = new Map();

export function kancaProvince(raw) {
  if (cache.has(raw)) return cache.get(raw);
  const n = kancaLabel(raw).toLowerCase();
  const hit = RULES.find((r) => r.re.test(n));
  const p = hit ? hit.prov : '';
  cache.set(raw, p);
  return p;
}
