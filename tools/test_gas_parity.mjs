import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dumpDir = path.resolve(process.argv[2] || '.parity');
const ctx = vm.createContext({ console });
for (const f of ['Config.js', 'Checks.js', 'Core.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas/pipeline', f), 'utf8'), ctx, { filename: f });
}
const revive = (v) => (v && typeof v === 'object' && '$d' in v ? new Date(`${v.$d}Z`) : v);
const sources = {};
for (const name of ['performance', 'kuadran', 'portfolio', 'realisasi', 'sla']) {
  const file = path.join(dumpDir, `${name}.json`);
  if (!fs.existsSync(file)) continue;
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  sources[name] = {
    values: d.values.map((row) => row.map(revive)), file: d.file, sheet: d.sheet,
    fmtDate: (dt) => dt.toISOString().slice(0, 10),
  };
}
const t0 = Date.now();
const res = vm.runInContext('KPR', ctx).buildAll(sources, { now: '2026-01-01T00:00:00', isDummy: true });
console.log(`pipeline Apps Script: ${Date.now() - t0} ms`);
res.log.forEach((l) => console.log(l));
if (res.errors.length) { console.error('GAGAL:', res.errors); process.exit(1); }

const IGNORE = new Set(['generated_at', 'file', 'sheet', 'bytes']);
const diffs = [];
function same(a, b, p) {
  if (diffs.length > 20) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > Math.max(1e-6, Math.abs(b) * 1e-9)) diffs.push(`${p}: ${a} != ${b}`);
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) { diffs.push(`${p}: panjang ${a?.length} != ${b?.length}`); return; }
    a.forEach((x, i) => same(x, b[i], `${p}[${i}]`));
    return;
  }
  if (a && b && typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (!IGNORE.has(k)) same(a[k], b[k], `${p}.${k}`);
    return;
  }
  if (a !== b) diffs.push(`${p}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}
const pyDir = path.join(ROOT, 'site/data');
const pyFiles = [];
(function scan(dir, rel = '') {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) scan(full, `${rel}${f}/`);
    else if (f.endsWith('.json')) pyFiles.push(`${rel}${f}`);
  }
}(pyDir));
const pyMeta = JSON.parse(fs.readFileSync(path.join(pyDir, 'meta.json'), 'utf8'));
if (pyMeta.datasets?.sla?.sample) {
  console.log('sla: Python memakai data contoh (sla.xlsx tidak ada), sla.json dan sla_daily.json tidak dibandingkan');
  for (const f of ['sla.json', 'sla_daily.json']) if (pyFiles.includes(f)) pyFiles.splice(pyFiles.indexOf(f), 1);
}
const gasFiles = Object.keys(res.files).sort();
const missing = pyFiles.filter((f) => !res.files[f]);
const extra = gasFiles.filter((f) => !pyFiles.includes(f));
if (missing.length || extra.length) diffs.push(`file beda. hilang: ${missing} lebih: ${extra}`);
for (const f of pyFiles) {
  if (!res.files[f]) continue;
  const py = JSON.parse(fs.readFileSync(path.join(pyDir, f), 'utf8'));
  if (f === 'meta.json' && py.datasets?.sla?.sample) delete py.datasets.sla;
  same(res.files[f], py, f);
}
if (diffs.length) { console.error(`TIDAK SAMA (${diffs.length}+):\n${diffs.join('\n')}`); process.exit(1); }
console.log(`SAMA: ${pyFiles.length} file Apps Script identik dengan hasil Python.`);
