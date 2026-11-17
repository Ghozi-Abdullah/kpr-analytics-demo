import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.resolve(ROOT, process.argv[2] || '_site');
const TARGET = ['chrome109', 'safari16', 'firefox115', 'edge109'];
const RUNTIME_FILES = ['css/login-photo.webp', 'css/google-g.svg', 'css/google-g.png', 'icon.svg', 'apple-touch-icon.png'];
const RUNTIME_DIRS = ['img', 'data'];

const fail = (msg) => { console.error(`GAGAL: ${msg}`); process.exit(1); };
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
const copy = (rel) => {
  const from = path.join(SITE, rel);
  if (!fs.existsSync(from)) return false;
  fs.cpSync(from, path.join(OUT, rel), { recursive: true });
  return true;
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

const js = await esbuild.build({
  entryPoints: [path.join(SITE, 'js', 'app.js')],
  bundle: true, format: 'esm', target: TARGET, minify: true, legalComments: 'none', charset: 'utf8',
  outdir: path.join(OUT, 'assets'), entryNames: 'app-[hash]', metafile: true, write: true,
});
const css = await esbuild.build({
  entryPoints: [path.join(SITE, 'css', 'main.css')],
  bundle: true, minify: true, legalComments: 'none', charset: 'utf8',
  loader: { '.woff2': 'file', '.jpg': 'file', '.webp': 'file', '.png': 'file', '.svg': 'file' },
  outdir: path.join(OUT, 'assets'), entryNames: 'app-[hash]', assetNames: '[name]-[hash]', metafile: true, write: true,
});

const outputOf = (meta, test) => Object.entries(meta.outputs).find(([, o]) => test(o))?.[0];
const rel = (abs) => path.relative(OUT, path.resolve(ROOT, abs)).split(path.sep).join('/');
const appJs = outputOf(js.metafile, (o) => o.entryPoint);
const appCss = outputOf(css.metafile, (o) => o.entryPoint);
if (!appJs || !appCss) fail('hasil esbuild tidak lengkap');
const fontFor = (name) => {
  const out = outputOf(css.metafile, (o) => Object.keys(o.inputs).some((i) => i.endsWith(name)));
  if (!out) fail(`font ${name} tidak ikut terbundel`);
  return rel(out);
};

const vendorText = ['js/file-check.js', 'lib/chart.umd.min.js', 'lib/chartjs-plugin-datalabels.min.js'].map(read).join('\n;\n');
const vendorName = `assets/vendor-${hash(vendorText)}.js`;
fs.writeFileSync(path.join(OUT, vendorName), vendorText);

for (const f of RUNTIME_FILES) copy(f);
for (const d of RUNTIME_DIRS) copy(d);
for (const f of ['lib/LICENSE-chartjs.md', 'lib/LICENSE-datalabels.md', 'lib/fonts/LICENSE-OFL-GoogleSansFlex.txt']) copy(f);

let html = read('index.html');
const swap = (from, to) => {
  if (!html.includes(from)) fail(`baris "${from}" tidak ada di index.html`);
  html = html.replace(from, to);
};
swap('href="lib/fonts/google-sans-flex-latin-400-normal.woff2"', `href="${fontFor('google-sans-flex-latin-400-normal.woff2')}"`);
swap('href="lib/fonts/google-sans-flex-latin-500-normal.woff2"', `href="${fontFor('google-sans-flex-latin-500-normal.woff2')}"`);
swap('<link rel="stylesheet" href="css/main.css">', `<link rel="stylesheet" href="${rel(appCss)}">`);
swap(`  <script src="js/file-check.js"></script>
  <script src="lib/chart.umd.min.js"></script>
  <script src="lib/chartjs-plugin-datalabels.min.js"></script>
  <script type="module" src="js/app.js"></script>`, `  <script src="${vendorName}"></script>
  <script type="module" src="${rel(appJs)}"></script>`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const EXTERNAL = /src\s*=\s*["']\s*(?:https?:)?\/\/|href\s*=\s*["']\s*(?!https:\/\/www\.flaticon\.com\/uicons["'])(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|(?:fetch|import)\s*\(\s*["'`]\s*(?:https?:)?\/\/|@import\s+["']?\s*(?:https?:)?\/\//i;
for (const f of [appJs, appCss].map((x) => path.resolve(ROOT, x)).concat(path.join(OUT, 'index.html'))) {
  const m = fs.readFileSync(f, 'utf8').match(EXTERNAL);
  if (m) fail(`${path.relative(OUT, f)} memuat resource dari luar: ${m[0]}`);
}
if (/ on[a-z]+=/i.test(html) || !html.includes("script-src 'self';")) fail('aturan CSP di index.html dilonggarkan');

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((t, e) => t + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`Situs siap di ${path.relative(ROOT, OUT) || '.'}: ${rel(appJs)}, ${rel(appCss)}, ${vendorName} (aset ${(size(path.join(OUT, 'assets')) / 1024).toFixed(0)} KB)`);
