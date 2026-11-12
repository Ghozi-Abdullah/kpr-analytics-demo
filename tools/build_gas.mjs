import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'gas', 'dashboard', 'Index.html');
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const bundle = await esbuild.build({
  entryPoints: [path.join(SITE, 'js', 'app.js')],
  bundle: true, format: 'iife', target: ['chrome109', 'safari16', 'firefox115', 'edge109'],
  minify: true, write: false, legalComments: 'none', charset: 'utf8',
});
const IMG_TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const inlineImages = (text) => text.replace(/(["'`])img\/([\w.-]+\.(?:webp|png|svg|jpg))\1/g, (whole, quote, name) => {
  const file = path.join(SITE, 'img', name);
  if (!fs.existsSync(file)) { console.error(`GAGAL: gambar img/${name} tidak ditemukan`); process.exit(1); }
  return `${quote}data:${IMG_TYPES[path.extname(name)]};base64,${fs.readFileSync(file).toString('base64')}${quote}`;
});
const appJs = inlineImages(bundle.outputFiles[0].text);

const styles = await esbuild.build({
  entryPoints: [path.join(SITE, 'css', 'main.css')],
  bundle: true, minify: true, write: false, loader: { '.woff2': 'dataurl' }, legalComments: 'none',
});
const css = styles.outputFiles[0].text;

const EXTERNAL = /src\s*=\s*["']\s*(?:https?:)?\/\/|href\s*=\s*["']\s*(?!https:\/\/www\.flaticon\.com\/uicons["'])(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|(?:fetch|import)\s*\(\s*["'`]\s*(?:https?:)?\/\/|@import\s+["']?\s*(?:https?:)?\/\//i;
for (const [name, text] of [['bundle', appJs], ['css', css]]) {
  const m = text.match(EXTERNAL);
  if (m) { console.error(`GAGAL: ${name} memuat resource dari luar: ${m[0]}`); process.exit(1); }
}

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<base target="_top">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>KPR Analytics</title>
<style>${css}</style>
</head>
<body>
<div id="app"><div class="boot" role="status">Memuat dashboard</div></div>
<script>${safeScript(read('lib/chart.umd.min.js'))}</script>
<script>${safeScript(read('lib/chartjs-plugin-datalabels.min.js'))}</script>
<script>${safeScript(appJs)}</script>
</body>
</html>
`;
fs.writeFileSync(OUT, html);
console.log(`Ditulis ${path.relative(ROOT, OUT)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB). Lanjutkan: cd gas/dashboard && npx clasp push`);
