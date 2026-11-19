// Datos de prueba para el ENTORNO DE PRUEBAS (emuladores locales).
//
// Uso:  npm run emulators      (en otra terminal)
//       npm run seed:staging
//
// Crea dos empresas de prueba (A con dos sucursales y un operador
// restringido a una sucursal, y B con una sucursal) en los emuladores de
// Auth y Firestore. Las contraseñas se generan al azar y se guardan en
// staging/credentials.local.json (excluido de git).
//
// SEGURIDAD: solo habla con 127.0.0.1 y con el proyecto "demo-yaa-pos".
// No usa credenciales reales ni puede llegar a Firebase de producción.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = 'demo-yaa-pos';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = `http://127.0.0.1:8085/v1/projects/${PROJECT}/databases/(default)/documents`;
const here = dirname(fileURLToPath(import.meta.url));
const credentialsFile = join(here, '../../staging/credentials.local.json');

if (!PROJECT.startsWith('demo-')) throw new Error('El proyecto de pruebas debe empezar con "demo-".');

// ---------------------------------------------------------------- helpers ---
const toValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
};

async function put(path, data) {
  const res = await fetch(`${FIRESTORE}/${path}`, {
    method: 'PATCH',
    // "Bearer owner" es el acceso de administrador del EMULADOR (ignora reglas).
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error(`Firestore ${path}: ${res.status} ${await res.text()}`);
}

async function createUser(email, password, displayName) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data?.error?.message === 'EMAIL_EXISTS') {
      throw new Error(`${email} ya existe en el emulador. Reinicie los emuladores sin datos importados (npm run emulators) y vuelva a ejecutar.`);
    }
    throw new Error(`Auth ${email}: ${JSON.stringify(data)}`);
  }
  return data.localId;
}

const pass = () => `Prueba-${randomBytes(6).toString('hex')}`;
const iso = (daysAgo, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// ------------------------------------------------------------------- main ---
async function main() {
  // Comprobar que los emuladores están encendidos (y que son locales).
  try {
    await fetch(`${AUTH}/`);
    await fetch(`http://127.0.0.1:8085/`);
  } catch {
    throw new Error('No se encontraron los emuladores en 127.0.0.1. Ejecute primero: npm run emulators');
  }

  const creds = {
    empresaA: { email: 'duena.a@demo.test', password: pass() },
    operadorNorte: { email: 'cajero.norte@demo.test', password: pass() },
    empresaB: { email: 'dueno.b@demo.test', password: pass() },
  };

  const uidA = await createUser(creds.empresaA.email, creds.empresaA.password, 'Dueña Empresa A');
  const uidOp = await createUser(creds.operadorNorte.email, creds.operadorNorte.password, 'Cajero Norte');
  const uidB = await createUser(creds.empresaB.email, creds.empresaB.password, 'Dueño Empresa B');

  // ---- Empresa A: dos sucursales ----
  await put(`users/${uidA}`, { id: uidA, name: 'Dueña Empresa A', email: creds.empresaA.email });
  await put(`users/${uidA}/configs/storeConfig`, {
    storeName: 'Farmacia Demo A', currency: 'Q', taxRate: 0.12, taxName: 'IVA', businessType: 'pharmacy',
    activeBranchId: 'br-central',
    branches: [
      { id: 'br-central', name: 'Central', code: 'SUC-01', address: 'Zona 1', city: 'Guatemala', isActive: true, isMain: true },
      { id: 'br-norte', name: 'Norte', code: 'SUC-02', address: 'Zona 18', city: 'Guatemala', isActive: true, isMain: false },
    ],
  });
  const productsA = [
    { id: 'a-p1', name: 'Paracetamol 500mg', code: 'PARA500', branch: 'Central', stock: 40, price: 10, cost: 6 },
    { id: 'a-p2', name: 'Paracetamol 500mg', code: 'PARA500', branch: 'Norte', stock: 15, price: 10, cost: 6 },
    { id: 'a-p3', name: 'Alcohol en gel', code: 'GEL01', branch: 'Central', stock: 20, price: 25, cost: 15 },
    { id: 'a-p4', name: 'Vitamina C', code: 'VITC', branch: 'Norte', stock: 12, price: 35, cost: 20 },
  ];
  for (const p of productsA) {
    await put(`users/${uidA}/products/${p.id}`, { ...p, category: 'Medicina', minStock: 2, unit: 'Pza' });
  }
  await put(`users/${uidA}/clients/a-c1`, { id: 'a-c1', name: 'Cliente Central', phone: '5555-0001', email: '', balanceCredit: 0, limitCredit: 500, branch: 'Central' });
  await put(`users/${uidA}/clients/a-c2`, { id: 'a-c2', name: 'Cliente Norte', phone: '5555-0002', email: '', balanceCredit: 0, limitCredit: 500, branch: 'Norte' });
  await put(`users/${uidA}/providers/a-v1`, { id: 'a-v1', name: 'Distribuidora Demo', contact: 'Ventas', phone: '2222-0000', email: '', totalPurchases: 0, creditPending: 0 });
  const salesA = [
    { id: 'a-s1', branch: 'Central', productId: 'a-p1', qty: 2, price: 10, daysAgo: 1 },
    { id: 'a-s2', branch: 'Norte', productId: 'a-p2', qty: 3, price: 10, daysAgo: 2 },
    { id: 'a-s3', branch: 'Norte', productId: 'a-p4', qty: 1, price: 35, daysAgo: 3 },
  ];
  for (const s of salesA) {
    await put(`users/${uidA}/sales/${s.id}`, {
      id: s.id, date: iso(s.daysAgo), total: s.qty * s.price, profit: s.qty * 4, received: s.qty * s.price, change: 0,
      paymentMethod: 'cash', shiftId: 'hist', branch: s.branch, operatorName: 'Datos de prueba',
      items: [{ productId: s.productId, name: 'Producto', quantity: s.qty, price: s.price, cost: 6 }],
    });
  }

  // Operador de A restringido a la sucursal Norte (vinculado a su cuenta).
  const op = {
    id: 'op-norte', email: creds.operadorNorte.email, name: 'Cajero Norte', role: 'Cajero', status: 'active',
    branch: 'Norte', branches: ['Norte'], disabledTabs: ['configuracion'], ownerId: uidA, passwordProtected: true, authUid: uidOp,
  };
  await put(`users/${uidA}/operators/${op.email}`, op);
  await put(`operators/${op.email}`, op);

  // ---- Empresa B: una sucursal ----
  await put(`users/${uidB}`, { id: uidB, name: 'Dueño Empresa B', email: creds.empresaB.email });
  await put(`users/${uidB}/configs/storeConfig`, {
    storeName: 'Tienda Demo B', currency: 'Q', taxRate: 0.12, taxName: 'IVA', businessType: 'general',
    activeBranchId: 'br-b1',
    branches: [{ id: 'br-b1', name: 'Principal B', code: 'B-01', address: 'Mixco', city: 'Guatemala', isActive: true, isMain: true }],
  });
  await put(`users/${uidB}/products/b-p1`, { id: 'b-p1', name: 'Producto exclusivo de B', code: 'B001', branch: 'Principal B', stock: 9, price: 50, cost: 30, category: 'General', minStock: 1, unit: 'Pza' });

  mkdirSync(dirname(credentialsFile), { recursive: true });
  writeFileSync(credentialsFile, JSON.stringify({
    nota: 'Cuentas SOLO del emulador local (proyecto demo-yaa-pos). No son cuentas reales.',
    ...creds,
    uids: { empresaA: uidA, operadorNorte: uidOp, empresaB: uidB },
  }, null, 2));

  console.log('Datos de prueba cargados en los emuladores:');
  console.log(`  Empresa A (2 sucursales): ${creds.empresaA.email}`);
  console.log(`  Operador de A, solo sucursal Norte: ${creds.operadorNorte.email}`);
  console.log(`  Empresa B (1 sucursal): ${creds.empresaB.email}`);
  console.log(`  Contraseñas en: staging/credentials.local.json`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
