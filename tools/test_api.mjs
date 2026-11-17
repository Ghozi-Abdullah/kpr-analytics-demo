import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ID = 'uji-123.apps.googleusercontent.com';
const signed = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const unsigned = (arr) => Buffer.from(arr.map((b) => b & 255));

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'kunci-1', alg: 'RS256', use: 'sig' };
const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

function makeToken(claims, { kid = 'kunci-1', key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com', aud: CLIENT_ID, iat: now, exp: now + 3600, email: 'andi@gmail.com', email_verified: true, ...claims,
  })).toString('base64url');
  const sig = crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(key).toString('base64url');
  return `${h}.${p}.${sig}`;
}

let fetches = 0;
const store = new Map();
const props = new Map(Object.entries({ AGG_ID: 'agg', CLIENT_ID, ALLOWED_EMAILS: 'andi@gmail.com,\n budi@gmail.com; @kantor.co.id', ADMIN_EMAILS: 'bos@gmail.com' }));
const cacheMap = new Map();
let sheetReads = 0;
const sheetRows = [['path', 'part', 'enc', 'content'], ['meta.json', '0', 'gz64', 'b:AAA'], ['perf_daily.json', '1', 'gz64', 'b:CCC'], ['perf_daily.json', '0', 'gz64', 'b:BBB']];
const quiet = { log() {}, info() {}, warn() {}, error() {} };
const ctx = vm.createContext({
  console: quiet,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    base64DecodeWebSafe: (s) => signed(Buffer.from(s, 'base64url')),
    base64EncodeWebSafe: (b) => unsigned(b).toString('base64url'),
    computeDigest: (_a, s) => signed(crypto.createHash('sha256').update(s, 'utf8').digest()),
    newBlob: (b) => ({ getDataAsString: () => unsigned(b).toString('utf8') }),
  },
  CacheService: { getScriptCache: () => ({
    get: (k) => cacheMap.get(k) ?? null, put: (k, v) => cacheMap.set(k, v), remove: (k) => cacheMap.delete(k),
    getAll: (keys) => Object.fromEntries(keys.filter((k) => cacheMap.has(k)).map((k) => [k, cacheMap.get(k)])),
    putAll: (o) => { for (const [k, v] of Object.entries(o)) cacheMap.set(k, v); },
  }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  UrlFetchApp: {
    fetch: () => { fetches += 1; return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ keys: [jwk] }) }; },
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : store.get(k) ?? null),
      setProperty: (k, v) => store.set(k, v), deleteProperty: (k) => store.delete(k),
      getProperties: () => Object.fromEntries([...props, ...store]),
    }),
  },
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => (n === 'data' ? { getDataRange: () => { sheetReads += 1; return { getValues: () => sheetRows }; } }
    : n === 'info' ? { getLastRow: () => 4, getRange: () => ({ getValues: () => [['status', 'OK'], ['waktu', '2026-11-08T10:00:00'], ['versi', '2026-11-08T09:58:00']] }) } : null) }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType() { return this; } }) },
});
for (const f of ['Jwt.js', 'Code.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas/api', f), 'utf8'), ctx, { filename: f });
const raw = (contents) => JSON.parse(ctx.doPost({ postData: { contents } }).text);
const post = (body) => raw(JSON.stringify(body));
const clearGuards = () => { for (const k of [...cacheMap.keys()]) if (/^(fail_|rate_|tok_)/.test(k)) cacheMap.delete(k); };

let failed = 0;
function expect(name, res, check) {
  const ok = check(res);
  if (!ok) failed += 1;
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${ok ? '' : `  -> ${JSON.stringify(res)}`}`);
}

const good = makeToken({});
expect('token sah + email terdaftar: boot', post({ action: 'boot', token: good }), (r) => r.ok && r.data.email === 'andi@gmail.com' && r.data.meta.data === 'AAA');
expect('bundle menyusun potongan berurutan', post({ action: 'bundle', token: good, paths: ['perf_daily.json'] }), (r) => r.ok && r.data['perf_daily.json'].data === 'BBBCCC');
expect('nama data tak dikenal ditolak', post({ action: 'bundle', token: good, paths: ['../rahasia'] }), (r) => !r.ok && r.error === 'BAD');
expect('simpan tata letak', post({ action: 'saveLayout', token: good, view: 'performance', text: '{"v":1,"items":[{"id":"trend","x":0,"y":0,"w":6,"h":8,"evil":"<img src=x onerror=alert(1)>"}]}' }), (r) => r.ok);
expect('tata letak kembali saat boot (field asing dibuang)', post({ action: 'boot', token: good }), (r) => r.ok && r.data.layouts.performance === '{"v":1,"items":[{"id":"trend","x":0,"y":0,"w":6,"h":8}]}');
expect('tata letak halaman SLA bisa disimpan', post({ action: 'saveLayout', token: good, view: 'sla', text: '{"v":1,"items":[]}' }), (r) => r.ok);
expect('tata letak dengan id berbahaya ditolak', post({ action: 'saveLayout', token: good, view: 'sla', text: '{"v":1,"items":[{"id":"<script>","x":0,"y":0,"w":1,"h":1}]}' }), (r) => r.error === 'BAD');
expect('tata letak dengan angka aneh ditolak', post({ action: 'saveLayout', token: good, view: 'sla', text: '{"v":1,"items":[{"id":"trend","x":-1,"y":0,"w":1e9,"h":1}]}' }), (r) => r.error === 'BAD');
expect('halaman tak dikenal ditolak', post({ action: 'saveLayout', token: good, view: 'admin', text: '{"v":1,"items":[]}' }), (r) => r.error === 'BAD');
expect('kunci publik di-cache (1x ambil)', { fetches }, (r) => r.fetches === 1);
expect('versi data untuk pembaruan otomatis', post({ action: 'version', token: good }), (r) => r.ok && r.data.version === '2026-11-08T09:58:00' && r.data.status === 'OK');
expect('versi data tanpa login ditolak', post({ action: 'version' }), (r) => !r.ok && r.error === 'AUTH' && !r.data);
expect('tanpa token', post({ action: 'boot' }), (r) => !r.ok && r.error === 'AUTH' && !r.data);
expect('Client ID lain', post({ action: 'boot', token: makeToken({ aud: 'lain.apps.googleusercontent.com' }) }), (r) => r.error === 'AUTH');
expect('token kedaluwarsa', post({ action: 'boot', token: makeToken({ exp: Math.floor(Date.now() / 1000) - 600 }) }), (r) => r.error === 'AUTH');
expect('penerbit bukan Google', post({ action: 'boot', token: makeToken({ iss: 'https://evil.example' }) }), (r) => r.error === 'AUTH');
expect('email belum terverifikasi', post({ action: 'boot', token: makeToken({ email_verified: false }) }), (r) => r.error === 'AUTH');
const [h, , s] = good.split('.');
const forged = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: 9999999999, email: 'andi@gmail.com', email_verified: true, x: 1 })).toString('base64url');
expect('isi token diubah (tanda tangan lama)', post({ action: 'boot', token: `${h}.${forged}.${s}` }), (r) => r.error === 'AUTH');
expect('ditandatangani kunci lain', post({ action: 'boot', token: makeToken({}, { key: otherKey }) }), (r) => r.error === 'AUTH');
expect('kid tidak dikenal', post({ action: 'boot', token: makeToken({}, { kid: 'palsu' }) }), (r) => r.error === 'AUTH');
expect('email tidak terdaftar', post({ action: 'boot', token: makeToken({ email: 'orang@gmail.com' }) }), (r) => r.error === 'DENIED' && r.email === 'orang@gmail.com' && !r.data);
expect('domain terdaftar (@kantor.co.id)', post({ action: 'boot', token: makeToken({ email: 'Siti@Kantor.co.id' }) }), (r) => r.ok);
expect('domain mirip ditolak', post({ action: 'boot', token: makeToken({ email: 'x@palsukantor.co.id' }) }), (r) => r.error === 'DENIED');
const noBig = { ...ctx };
expect('runtime tanpa BigInt tetap memeriksa (cadangan tokeninfo)', (() => {
  const c2 = vm.createContext({ ...noBig, BigInt: undefined, UrlFetchApp: { fetch: () => ({ getResponseCode: () => 400, getContentText: () => '{}' }) } });
  for (const f of ['Jwt.js', 'Code.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas/api', f), 'utf8'), c2);
  return JSON.parse(c2.doPost({ postData: { contents: JSON.stringify({ action: 'boot', token: makeToken({ email: 'baru@gmail.com' }) }) } }).text);
})(), (r) => r.error === 'AUTH');

expect('isi permintaan bukan JSON ditolak', raw('bukan json'), (r) => r.error === 'BAD' && !r.data);
expect('isi permintaan kosong ditolak', raw(''), (r) => r.error === 'BAD');
expect('isi permintaan raksasa ditolak sebelum diproses', raw(JSON.stringify({ action: 'boot', token: good, pad: 'x'.repeat(30000) })), (r) => r.error === 'BAD');
expect('aksi tak dikenal ditolak', post({ action: 'hapusSemua', token: good }), (r) => r.error === 'BAD');
expect('permintaan berupa array ditolak', raw('[1,2]'), (r) => r.error === 'BAD');
expect('token kelewat panjang ditolak', post({ action: 'boot', token: 'a'.repeat(5000) }), (r) => r.error === 'AUTH');
expect('prototype pollution lewat paths diabaikan', post({ action: 'bundle', token: good, paths: ['__proto__'] }), (r) => r.error === 'BAD');
expect('pesan error internal tidak bocor ke yang belum login', post({ action: 'boot', token: 'x.y.z' }), (r) => r.error === 'AUTH' && !('message' in r));

clearGuards();
const fetchesBefore = fetches;
const bogus = makeToken({}, { key: otherKey });
const first = post({ action: 'boot', token: bogus });
const again = post({ action: 'boot', token: bogus });
expect('token palsu yang sama langsung ditolak (tanpa cek ulang)', { first, again, f: fetches - fetchesBefore }, (r) => r.first.error === 'AUTH' && r.again.error === 'AUTH' && r.f === 0);
expect('kid palsu tidak memaksa ambil kunci Google berulang', (() => {
  const before = fetches;
  for (let i = 0; i < 5; i += 1) post({ action: 'boot', token: makeToken({ n: i }, { kid: `palsu-${i}` }) });
  return fetches - before;
})(), (n) => n === 0);

clearGuards();
const sessionToken = makeToken({ email: 'budi@gmail.com' });
post({ action: 'boot', token: sessionToken });
let lastBrute;
for (let i = 0; i < 60; i += 1) lastBrute = post({ action: 'boot', token: makeToken({ n: i }, { key: otherKey }) });
expect('serbuan token palsu: login baru ditahan (BUSY)', lastBrute, (r) => r.error === 'BUSY');
expect('serbuan token palsu: token sah yang baru juga ditahan dulu', post({ action: 'boot', token: makeToken({ email: 'siti@kantor.co.id' }) }), (r) => r.error === 'BUSY');
expect('serbuan token palsu: pengguna yang sudah login tetap jalan', post({ action: 'version', token: sessionToken }), (r) => r.ok);

clearGuards();
const busy = makeToken({ email: 'budi@gmail.com', n: 'rate' });
let rate = [];
for (let i = 0; i < 95; i += 1) rate.push(post({ action: 'version', token: busy }));
expect('pengguna sah dibatasi kalau terlalu sering (90/menit)', rate, (r) => r.slice(0, 90).every((x) => x.ok) && r[94].error === 'BUSY');
expect('batas per pengguna tidak mengganggu pengguna lain', post({ action: 'version', token: good }), (r) => r.ok);
expect('token dengan azp lain ditolak', post({ action: 'boot', token: makeToken({ azp: 'lain.apps.googleusercontent.com' }) }), (r) => r.error === 'AUTH');
clearGuards();

clearGuards();
const bos = makeToken({ email: 'bos@gmail.com' });
const tamu = makeToken({ email: 'tamu@gmail.com' });
const rina = makeToken({ email: 'rina@gmail.com' });
expect('admin utama masuk dengan peran admin', post({ action: 'boot', token: bos }), (r) => r.ok && r.data.role === 'admin');
expect('pengguna biasa berperan viewer', post({ action: 'boot', token: good }), (r) => r.ok && r.data.role === 'viewer');
expect('viewer tidak bisa membuka daftar pengguna', post({ action: 'adminList', token: good }), (r) => r.error === 'FORBIDDEN' && !r.data);
expect('viewer tidak bisa menambah pengguna', post({ action: 'adminSave', token: good, email: 'jahat@gmail.com', role: 'admin', status: 'active' }), (r) => r.error === 'FORBIDDEN');
expect('orang luar tidak bisa memanggil aksi admin', post({ action: 'adminSave', token: tamu, email: 'tamu@gmail.com', role: 'admin', status: 'active' }), (r) => r.error === 'DENIED');
expect('orang luar ditolak dan belum tercatat meminta', post({ action: 'boot', token: tamu }), (r) => r.error === 'DENIED' && r.asked === false);
expect('orang luar bisa minta akses', post({ action: 'requestAccess', token: tamu }), (r) => r.ok && r.data.status === 'pending');
expect('minta akses tidak memberi akses', post({ action: 'boot', token: tamu }), (r) => r.error === 'DENIED' && r.asked === true);
expect('minta akses dua kali tetap satu permintaan', (post({ action: 'requestAccess', token: tamu }), post({ action: 'adminList', token: bos })), (r) => r.ok && r.data.requests.length === 1 && r.data.requests[0].email === 'tamu@gmail.com');
expect('minta akses tanpa token ditolak', post({ action: 'requestAccess' }), (r) => r.error === 'AUTH');
expect('admin menyetujui permintaan', post({ action: 'adminDecide', token: bos, email: 'tamu@gmail.com', approve: true }), (r) => r.ok && r.data.requests.length === 0 && r.data.users.some((u) => u.email === 'tamu@gmail.com' && u.role === 'viewer'));
expect('setelah disetujui langsung bisa masuk', post({ action: 'boot', token: tamu }), (r) => r.ok && r.data.role === 'viewer');
expect('admin menonaktifkan pengguna', post({ action: 'adminSave', token: bos, email: 'tamu@gmail.com', role: 'viewer', status: 'off' }), (r) => r.ok);
expect('akun nonaktif langsung terputus walau token masih berlaku', post({ action: 'bundle', token: tamu, paths: ['meta.json'] }), (r) => r.error === 'DENIED');
expect('akun nonaktif tidak bisa minta akses lagi', post({ action: 'requestAccess', token: tamu }), (r) => r.ok && r.data.status === 'off');
expect('admin menambah pengguna baru', post({ action: 'adminSave', token: bos, email: ' Rina@Gmail.com ', role: 'viewer', status: 'active' }), (r) => r.ok && r.data.users.some((u) => u.email === 'rina@gmail.com'));
expect('pengguna baru bisa masuk', post({ action: 'boot', token: rina }), (r) => r.ok);
expect('admin menaikkan pengguna jadi admin', post({ action: 'adminSave', token: bos, email: 'rina@gmail.com', role: 'admin', status: 'active' }), (r) => r.ok);
expect('admin baru bisa membuka daftar', post({ action: 'adminList', token: rina }), (r) => r.ok && r.data.log.length > 0);
expect('admin tidak bisa mengubah akses sendiri', post({ action: 'adminSave', token: rina, email: 'rina@gmail.com', role: 'admin', status: 'off' }), (r) => r.error === 'BAD' && /sendiri/.test(r.message));
expect('admin tidak bisa menghapus diri sendiri', post({ action: 'adminRemove', token: rina, email: 'rina@gmail.com' }), (r) => r.error === 'BAD');
expect('admin utama tidak bisa diubah dari halaman', post({ action: 'adminSave', token: rina, email: 'bos@gmail.com', role: 'viewer', status: 'off' }), (r) => r.error === 'BAD');
expect('admin utama tidak bisa dihapus dari halaman', post({ action: 'adminRemove', token: rina, email: 'bos@gmail.com' }), (r) => r.error === 'BAD');
expect('email tidak valid ditolak', post({ action: 'adminSave', token: bos, email: '<img src=x onerror=1>@x.com', role: 'viewer', status: 'active' }), (r) => r.error === 'BAD');
expect('email berupa kunci jebakan ditolak', post({ action: 'adminSave', token: bos, email: '__proto__', role: 'viewer', status: 'active' }), (r) => r.error === 'BAD');
expect('peran tak dikenal ditolak', post({ action: 'adminSave', token: bos, email: 'x@gmail.com', role: 'root', status: 'active' }), (r) => r.error === 'BAD');
expect('admin menghapus pengguna', post({ action: 'adminRemove', token: bos, email: 'rina@gmail.com' }), (r) => r.ok && !r.data.users.some((u) => u.email === 'rina@gmail.com'));
expect('pengguna yang dihapus langsung terputus', post({ action: 'adminList', token: rina }), (r) => r.error === 'DENIED');
expect('admin menolak permintaan', (post({ action: 'requestAccess', token: rina }), post({ action: 'adminDecide', token: bos, email: 'rina@gmail.com', approve: false })), (r) => r.ok && r.data.requests.length === 0 && !r.data.users.some((u) => u.email === 'rina@gmail.com'));
expect('menyetujui permintaan yang tidak ada ditolak', post({ action: 'adminDecide', token: bos, email: 'hantu@gmail.com', approve: true }), (r) => r.error === 'BAD');
expect('riwayat mencatat login dan penolakan', post({ action: 'adminList', token: bos }), (r) => r.ok && r.data.log.some((x) => x[2] === 'masuk') && r.data.log.some((x) => x[2] === 'ditolak') && r.data.log.length <= 60);
expect('permintaan akses dibatasi jumlahnya', (() => {
  let last;
  for (let i = 0; i < 34; i += 1) last = post({ action: 'requestAccess', token: makeToken({ email: `orang${i}@gmail.com` }) });
  return last;
})(), (r) => r.error === 'BUSY');
clearGuards();

for (const k of [...cacheMap.keys()]) if (/^d[hc]:/.test(k)) cacheMap.delete(k);
const readsBefore = sheetReads;
const cold = post({ action: 'bundle', token: good, paths: ['perf_daily.json', 'meta.json'] });
const warm = post({ action: 'bundle', token: good, paths: ['perf_daily.json', 'meta.json'] });
expect('data kedua kali diambil dari cache, bukan spreadsheet', { cold, warm, reads: sheetReads - readsBefore }, (r) => r.cold.ok && r.warm.ok && r.reads === 1
  && r.warm.data['perf_daily.json'].data === 'BBBCCC' && r.warm.data['meta.json'].data === 'AAA' && r.warm.data['perf_daily.json'].enc === 'gz64');
expect('cache data terikat versi data', [...cacheMap.keys()].filter((k) => /^d[hc]:/.test(k)), (keys) => keys.length > 0 && keys.every((k) => k.includes('2026-11-08T09:58:00')));
cacheMap.delete('dc:2026-11-08T09:58:00:perf_daily.json:1');
const partial = post({ action: 'bundle', token: good, paths: ['perf_daily.json'] });
expect('potongan cache hilang: baca ulang dari spreadsheet', { partial, reads: sheetReads - readsBefore }, (r) => r.partial.ok && r.partial.data['perf_daily.json'].data === 'BBBCCC' && r.reads === 2);
expect('data yang tidak ada di spreadsheet tidak dibuat-buat', post({ action: 'bundle', token: good, paths: ['sla.json'] }), (r) => r.ok && !('sla.json' in r.data));

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji KPR API lulus.');
process.exit(failed ? 1 : 0);
