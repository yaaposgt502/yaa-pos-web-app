// Compara dos informes de count-documents.mjs (original vs. restaurado).
// Sale con código 0 si son idénticos y 1 si hay diferencias. No lee Firebase.
// Uso: node compare-counts.mjs original.json restaurado.json
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
if (!a || !b) {
  console.error('Uso: node compare-counts.mjs original.json restaurado.json');
  process.exit(2);
}
const diffs = [];
const cmp = (path, x, y) => {
  if (JSON.stringify(x ?? null) !== JSON.stringify(y ?? null)) diffs.push(`${path}: ${JSON.stringify(x ?? null)} → ${JSON.stringify(y ?? null)}`);
};
for (const col of new Set([...Object.keys(a.global), ...Object.keys(b.global)])) cmp(`global/${col}`, a.global[col], b.global[col]);
for (const t of new Set([...Object.keys(a.empresas), ...Object.keys(b.empresas)])) {
  const ea = a.empresas[t] || {}, eb = b.empresas[t] || {};
  if (!a.empresas[t] || !b.empresas[t]) diffs.push(`empresa ${t}: falta en ${a.empresas[t] ? 'restaurado' : 'original'}`);
  for (const col of new Set([...Object.keys(ea), ...Object.keys(eb)])) cmp(`${t}/${col}`, ea[col], eb[col]);
}
if (diffs.length === 0) {
  console.log(`✔ Idénticos: ${Object.keys(a.empresas).length} empresas, mismos conteos y montos.`);
  process.exit(0);
}
console.log(`✖ ${diffs.length} diferencias:`);
diffs.forEach((d) => console.log('  ' + d));
process.exit(1);
