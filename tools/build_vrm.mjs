import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tools', 'vrm');
const LIB = path.join(ROOT, 'site', 'lib');

if (!fs.existsSync(path.join(DIR, 'node_modules', 'three'))) {
  console.error('GAGAL: jalankan "npm install" di folder tools/vrm dulu');
  process.exit(1);
}

await esbuild.build({
  entryPoints: [path.join(DIR, 'vtuber.js')],
  bundle: true, format: 'esm', target: ['chrome109', 'safari16', 'firefox115', 'edge109'],
  minify: true, legalComments: 'none', charset: 'utf8', nodePaths: [path.join(DIR, 'node_modules')],
  outfile: path.join(LIB, 'vtuber.js'),
});

const licenses = [
  ['three.js', path.join(DIR, 'node_modules', 'three', 'LICENSE')],
  ['@pixiv/three-vrm', path.join(DIR, 'node_modules', '@pixiv', 'three-vrm', 'LICENSE')],
];
const text = licenses.map(([name, file]) => `## ${name}\n\n${fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : 'MIT'}\n`).join('\n');
fs.writeFileSync(path.join(LIB, 'LICENSE-vtuber.md'), `# Lisensi pustaka di vtuber.js\n\n${text}`);
console.log(`site/lib/vtuber.js ${(fs.statSync(path.join(LIB, 'vtuber.js')).size / 1024).toFixed(0)} KB`);
