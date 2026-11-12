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
const props = new Map(Object.entries({ AGG_ID: 'agg', CLIENT_ID, ALLOWED_EMAILS: 'andi@gmail.com,\n budi@gmail.com; @kantor.co.id' }));
const cacheMap = new Map();
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
  CacheService: { getScriptCache: () => ({ get: (k) => cacheMap.get(k) ?? null, put: (k, v) => cacheMap.set(k, v), remove: (k) => cacheMap.delete(k) }) },
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
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => (n === 'data' ? { getDataRange: () => ({ getValues: () => sheetRows }) }
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

console.log(failed ? `\n${failed} uji GAGAL` : '\nSemua uji KPR API lulus.');
process.exit(failed ? 1 : 0);
