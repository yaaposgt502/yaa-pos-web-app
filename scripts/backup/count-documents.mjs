// Cuenta documentos (y suma montos) por empresa y colección. SOLO LECTURA.
// Sirve para verificar un respaldo: se ejecuta sobre la base original y sobre
// la base restaurada, y se comparan los dos informes con compare-counts.mjs.
//
// Uso (producción, lo ejecuta el dueño con sus credenciales de Google Cloud):
//   node count-documents.mjs --project <PROJECT_ID> --database <DATABASE_ID> --out informe.json
// Uso (emulador local, sin costo):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node count-documents.mjs --project demo-yaa-pos --database "(default)" --out informe.json
//
// Costo en producción: usa consultas de agregación (count/sum), que cobran
// 1 lectura por cada 1,000 entradas de índice. Además lista las empresas
// (1 lectura por empresa). Con 100 empresas de ~20,000 documentos son unas
// 3,000 lecturas ≈ USD 0.001.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, AggregateField } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const projectId = arg('project');
const databaseId = arg('database');
const out = arg('out') || 'informe-conteo.json';
if (!projectId || !databaseId) {
  console.error('Faltan --project y --database. Ejemplo: --project demo-yaa-pos --database "(default)"');
  process.exit(1);
}
const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (usingEmulator && !projectId.startsWith('demo-')) {
  console.error('Con el emulador use un proyecto "demo-".');
  process.exit(1);
}

const app = initializeApp(usingEmulator ? { projectId } : { projectId, credential: applicationDefault() });
const db = getFirestore(app, databaseId);

const TENANT_COLLECTIONS = [
  'products', 'clients', 'providers', 'sales', 'purchases', 'expenses', 'shifts',
  'files', 'configs', 'operators', 'quotations', 'consignments', 'stockMovements', 'dailyStats',
];
// Montos que se suman para detectar diferencias de contenido, no solo de cantidad.
const SUMS = { sales: 'total', purchases: 'total', expenses: 'amount', products: 'stock' };

async function countCollection(ref, sumField) {
  const aggregations = { n: AggregateField.count() };
  if (sumField) aggregations.sum = AggregateField.sum(sumField);
  const snap = await ref.aggregate(aggregations).get();
  const data = snap.data();
  return sumField ? { count: data.n, [`suma_${sumField}`]: Math.round((data.sum || 0) * 100) / 100 } : { count: data.n };
}

const report = { proyecto: projectId, base: databaseId, fecha: new Date().toISOString(), global: {}, empresas: {} };

for (const col of ['operators', 'licenses', 'admins']) {
  report.global[col] = await countCollection(db.collection(col));
}

// listDocuments incluye empresas que solo tienen subcolecciones.
const tenants = await db.collection('users').listDocuments();
for (const tenant of tenants) {
  const entry = {};
  for (const col of TENANT_COLLECTIONS) {
    const r = await countCollection(tenant.collection(col), SUMS[col]);
    if (r.count > 0) entry[col] = r;
  }
  report.empresas[tenant.id] = entry;
}

writeFileSync(out, JSON.stringify(report, null, 2));
const totalDocs = Object.values(report.empresas).reduce((a, e) => a + Object.values(e).reduce((b, c) => b + c.count, 0), 0);
console.log(`Empresas: ${tenants.length} · Documentos en subcolecciones: ${totalDocs} · Informe: ${out}`);
