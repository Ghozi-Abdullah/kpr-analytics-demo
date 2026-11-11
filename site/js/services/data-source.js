import { decode } from '../core/values.js';
import { API } from '../deploy.js';
import { API_MODE, AuthError, session, dropSession } from './auth.js';

export const IS_GAS = typeof window.google !== 'undefined' && !!window.google?.script?.run;
export const MODE = IS_GAS ? 'gas' : API_MODE ? 'api' : 'local';
export { AuthError };

const cache = new Map();
const tables = new Map();

function gasCall(fn, ...args) {
  return new Promise((resolve, reject) => {
    window.google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((err) => reject(gasError(err)))[fn](...args);
  });
}

export class AccessError extends Error {}

function gasError(err) {
  const msg = String(err?.message || err?.error || err || '');
  if (msg.includes('AKSES_DITOLAK')) return new AccessError('Akun ini belum diberi akses ke data dashboard.');
  if (msg.includes('BELUM_DISETEL')) return new Error('Dashboard belum disetel: Script Property AGG_ID belum diisi.');
  if (msg.includes('DATA_KOSONG')) return new Error('Data agregat belum dibangun. Jalankan buildAll() di project pipeline.');
  return new Error(`Gagal memuat data dari Apps Script. ${msg}`);
}

async function apiCall(action, payload = {}) {
  const s = session();
  if (!s) throw new AuthError('Silakan masuk dengan akun Google.');
  let res;
  try {
    res = await fetch(API.url, {
      method: 'POST', redirect: 'follow', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: s.token, ...payload }),
    });
  } catch {
    throw new Error('Server Apps Script tidak bisa dihubungi. Cek koneksi internet lalu coba lagi.');
  }
  if (!res.ok) throw new Error(`Server Apps Script menjawab ${res.status}. Cek alamat API di js/deploy.js.`);
  let body;
  try { body = await res.json(); } catch { throw new Error('Jawaban server tidak terbaca. Pastikan deploy KPR API memakai akses "Anyone".'); }
  if (body.ok) return body.data;
  if (body.error === 'AUTH') { dropSession(); throw new AuthError('Sesi login berakhir. Silakan masuk lagi.'); }
  if (body.error === 'DENIED') throw new AccessError(`Akun ${body.email || 'ini'} belum ada di daftar akses dashboard.`);
  throw gasError(new Error(body.error || body.message || 'Kesalahan tidak dikenal'));
}

function remote(fn, ...args) {
  if (IS_GAS) return gasCall(fn, ...args);
  if (fn === 'getBoot') return apiCall('boot');
  if (fn === 'getBundle') return apiCall('bundle', { paths: args[0] });
  if (fn === 'saveLayout') return apiCall('saveLayout', { view: args[0], text: args[1] });
  if (fn === 'getVersion') return apiCall('version');
  throw new Error(`Aksi ${fn} tidak dikenal`);
}

async function gunzipJson(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

async function decodePayload(p) {
  if (p && p.enc === 'gz64') return gunzipJson(p.data);
  if (p && typeof p.data === 'string') return JSON.parse(p.data);
  return p;
}

async function fetchLocal(path) {
  let res;
  try {
    res = await fetch(`data/${path}`, { cache: 'no-store' });
  } catch {
    throw new Error('Data tidak bisa dibaca. Buka dashboard lewat Live Server (klik "Go Live" di VS Code).');
  }
  if (!res.ok) throw new Error(`File data/${path} belum ada. Jalankan "python pipeline/build_data.py", lalu muat ulang halaman.`);
  return res.json();
}

let queue = null;
function gasFetch(path) {
  if (!queue) {
    const q = { paths: [] };
    q.promise = new Promise((r) => { setTimeout(r, 0); }).then(() => { queue = null; return remote('getBundle', q.paths); });
    queue = q;
  }
  queue.paths.push(path);
  return queue.promise.then((map) => {
    if (!map || !(path in map)) throw new Error(`Data ${path} tidak ada di spreadsheet agregat. Jalankan buildAll() di project pipeline.`);
    return decodePayload(map[path]);
  });
}

export function load(paths) {
  const missing = paths.filter((p) => !cache.has(p));
  if (missing.length) {
    if (MODE !== 'local') {
      for (const p of missing) cache.set(p, gasFetch(p));
    } else {
      for (const p of missing) cache.set(p, fetchLocal(p));
    }
    for (const p of missing) cache.get(p).catch(() => cache.delete(p));
  }
  return Promise.all(paths.map((p) => cache.get(p)));
}

export const loadOne = async (path) => (await load([path]))[0];

export async function loadTable(path, fallback = null) {
  if (tables.has(path)) return tables.get(path);
  let raw;
  try {
    raw = await loadOne(path);
  } catch (err) {
    if (fallback) return fallback;
    throw err;
  }
  const rows = decode(raw);
  tables.set(path, rows);
  return rows;
}

export function clearCache() { cache.clear(); tables.clear(); }

export async function getVersion() {
  if (MODE === 'local') {
    const res = await fetch('data/meta.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`meta.json ${res.status}`);
    const meta = await res.json();
    return meta.generated_at || '';
  }
  const r = await remote('getVersion');
  return (r && r.version) || '';
}

export async function boot() {
  if (MODE !== 'local') {
    const res = await remote('getBoot');
    const meta = await decodePayload(res.meta);
    cache.set('meta.json', Promise.resolve(meta));
    return { email: res.email || '', meta, layouts: res.layouts || {}, mode: MODE };
  }
  const meta = await loadOne('meta.json');
  return { email: '', meta, layouts: null, mode: 'local' };
}

const LAYOUT_VERSION = 13;
const LS = (view) => `kpr.layout.v${LAYOUT_VERSION}.${view}`;

export function readLayout(view, bootLayouts) {
  let text = null;
  if (bootLayouts) text = bootLayouts[view] || null;
  else {
    try { text = localStorage.getItem(LS(view)); } catch { text = null; }
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed?.v === LAYOUT_VERSION && Array.isArray(parsed.items) ? parsed.items : null;
  } catch { return null; }
}

export async function writeLayout(view, items, bootLayouts) {
  const text = items ? JSON.stringify({ v: LAYOUT_VERSION, items: items.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })) }) : '';
  if (MODE !== 'local') {
    await remote('saveLayout', view, text);
    if (bootLayouts) bootLayouts[view] = text || null;
    return;
  }
  try {
    if (text) localStorage.setItem(LS(view), text); else localStorage.removeItem(LS(view));
  } catch {
    throw new Error('Penyimpanan browser tidak tersedia');
  }
}
