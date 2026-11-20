import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'gas', 'tempel'));
const projects = {
  'KPR-Pipeline': { dir: 'gas/pipeline', files: ['Config.js', 'Checks.js', 'Core.js', 'Main.js'] },
  'KPR-API': { dir: 'gas/api', files: ['Jwt.js', 'Code.js'] },
};
fs.mkdirSync(out, { recursive: true });
for (const [name, p] of Object.entries(projects)) {
  const code = p.files.map((f) => fs.readFileSync(path.join(ROOT, p.dir, f), 'utf8').trim()).join('\n\n') + '\n';
  fs.writeFileSync(path.join(out, `${name}.gs`), code);
  fs.copyFileSync(path.join(ROOT, p.dir, 'appsscript.json'), path.join(out, `${name}-appsscript.json`));
  console.log(`${name}.gs ${Math.round(code.length / 1024)} KB`);
}
