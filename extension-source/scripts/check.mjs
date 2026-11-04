import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const exists = (relative) => fs.existsSync(path.join(root, relative));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (/\.(?:js|mjs)$/.test(entry.name)) result.push(full);
  }
  return result;
}

const references = [
  ...Object.values(manifest.icons || {}),
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.side_panel?.default_path,
  manifest.options_ui?.page,
  ...(manifest.content_scripts || []).flatMap((script) => [...(script.js || []), ...(script.css || [])]),
].filter(Boolean);
for (const ref of references) if (!exists(ref)) errors.push(`Arquivo referenciado pelo manifesto não existe: ${ref}`);

for (const file of walk(root)) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) errors.push(`Erro de sintaxe em ${rel}: ${(check.stderr || check.stdout).trim()}`);
  const source = fs.readFileSync(file, 'utf8');
  const importRe = /(?:from\s*|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g;
  for (const match of source.matchAll(importRe)) {
    const specifier = match[2];
    const resolved = path.resolve(path.dirname(file), specifier);
    if (!fs.existsSync(resolved)) errors.push(`Import local ausente em ${rel}: ${specifier}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Verificação concluída: manifesto e ${walk(root).length} arquivos JavaScript/MJS verificados.`);
