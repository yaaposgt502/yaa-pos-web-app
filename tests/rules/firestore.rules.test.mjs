// Pruebas de firestore.rules en el emulador local (proyecto "demo-", sin conexión a Firebase real).
// Ejecutar desde esta carpeta: npm install && npm test   (requiere Java 11+)
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, getDocs,
  runTransaction, increment, deleteField,
} from 'firebase/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
const rules = readFileSync(path.join(here, '../../firestore.rules'), 'utf8');

const OWNER = 'ownerUid';
const OTHER_OWNER = 'otherOwnerUid';

let env;

const ownerCtx = () => env.authenticatedContext(OWNER, { email: 'owner@test.com', email_verified: true }).firestore();
const otherOwnerCtx = () => env.authenticatedContext(OTHER_OWNER, { email: 'other@test.com', email_verified: true }).firestore();
const cashierCtx = () => env.authenticatedContext('cashierUid', { email: 'cajero@test.com' }).firestore();
const boundCtx = () => env.authenticatedContext('boundUid', { email: 'bound@test.com' }).firestore();
const impostorCtx = () => env.authenticatedContext('impostorUid', { email: 'bound@test.com' }).firestore();
const inactiveCtx = () => env.authenticatedContext('inactiveUid', { email: 'inactivo@test.com' }).firestore();
const strangerCtx = () => env.authenticatedContext('strangerUid', { email: 'extrano@test.com' }).firestore();
const anonCtx = () => env.unauthenticatedContext().firestore();

const op = (email, extra = {}) => ({
  id: email, email, name: 'Operador', role: 'Cajero', status: 'active',
  branch: 'Todas', branches: [], disabledTabs: [], ownerId: OWNER, passwordProtected: true, ...extra,
});

const product = (extra = {}) => ({
  id: 'p1', name: 'Paracetamol', code: 'P1', category: 'Medicina', price: 10, cost: 6,
  stock: 20, minStock: 2, unit: 'Pza', branch: 'Central', ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-yaa-pos',
    firestore: { rules, host: '127.0.0.1', port: 8085 },
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', OWNER), { id: OWNER, name: 'Dueño', email: 'owner@test.com' });
    await setDoc(doc(db, 'users', OTHER_OWNER), { id: OTHER_OWNER, name: 'Otra empresa', email: 'other@test.com' });

    for (const o of [op('cajero@test.com'), op('bound@test.com', { authUid: 'boundUid' }), op('inactivo@test.com', { status: 'inactive' })]) {
      await setDoc(doc(db, 'operators', o.email), o);
      await setDoc(doc(db, 'users', OWNER, 'operators', o.email), o);
    }
    // Operador antiguo que solo existe en la subcolección del tenant
    await setDoc(doc(db, 'users', OWNER, 'operators', 'legacy@test.com'), op('legacy@test.com'));

    await setDoc(doc(db, 'users', OWNER, 'products', 'p1'), product());
    // Dato viejo con tipos incorrectos (nunca se validó por el comodín)
    await setDoc(doc(db, 'users', OWNER, 'products', 'legacy'), { id: 'legacy', name: 'Viejo', price: '12.50', stock: '7' });
    await setDoc(doc(db, 'users', OWNER, 'sales', 's1'), { id: 's1', total: 10, date: '2026-11-01T10:00:00Z', branch: 'Central' });
    await setDoc(doc(db, 'users', OWNER, 'purchases', 'c1'), { id: 'c1', total: 50, date: '2026-11-01', status: 'Pendiente' });
    await setDoc(doc(db, 'users', OWNER, 'shifts', 't1'), { id: 't1', initialCash: 100, salesTotal: 0, expensesTotal: 0, state: 'open' });
    await setDoc(doc(db, 'users', OWNER, 'expenses', 'g1'), { id: 'g1', amount: 5, description: 'Agua', date: '2026-11-01', category: 'Varios' });
    await setDoc(doc(db, 'users', OWNER, 'configs', 'storeConfig'), { storeName: 'Farmacia', branches: [{ id: 'b1', name: 'Central' }], activeBranchId: 'b1' });
  });
});

describe('Dueño', () => {
  test('lee y escribe sus productos', async () => {
    const db = ownerCtx();
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'products', 'p1')));
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'products', 'p2'), product({ id: 'p2' })));
  });

  test('puede borrar ventas, compras, turnos y configuración', async () => {
    const db = ownerCtx();
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'sales', 's1')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'purchases', 'c1')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'shifts', 't1')));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'configs', 'storeConfig')));
  });

  test('crea y edita operadores propios (tenant y global)', async () => {
    const db = ownerCtx();
    const nuevo = op('nuevo@test.com');
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'operators', nuevo.email), nuevo));
    await assertSucceeds(setDoc(doc(db, 'operators', nuevo.email), nuevo));
    await assertSucceeds(setDoc(doc(db, 'operators', 'cajero@test.com'), op('cajero@test.com', { status: 'inactive' })));
  });

  test('no puede guardar un operador con ownerId de otra empresa', async () => {
    const db = ownerCtx();
    const malo = op('x@test.com', { ownerId: OTHER_OWNER });
    await assertFails(setDoc(doc(db, 'users', OWNER, 'operators', malo.email), malo));
    await assertFails(setDoc(doc(db, 'operators', malo.email), malo));
  });

  test('no puede escribir en subcolecciones no declaradas', async () => {
    await assertFails(setDoc(doc(ownerCtx(), 'users', OWNER, 'cualquiera', 'x'), { a: 1 }));
  });

  test('reinicio de base de datos: puede listar y borrar operadores', async () => {
    const db = ownerCtx();
    const snap = await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'operators')));
    for (const d of snap.docs) await assertSucceeds(deleteDoc(d.ref));
  });
});

describe('Cajero (operador activo)', () => {
  test('lee los datos de la empresa y su perfil', async () => {
    const db = cashierCtx();
    await assertSucceeds(getDoc(doc(db, 'users', OWNER)));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'products')));
    await assertSucceeds(getDoc(doc(db, 'operators', 'cajero@test.com')));
    await assertSucceeds(getDoc(doc(db, 'licenses', OWNER)));
  });

  test('registra una venta en lote (venta + stock + turno + cliente)', async () => {
    const db = cashierCtx();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', OWNER, 'sales', 's2'), { id: 's2', total: 20, date: '2026-11-18T10:00:00Z', branch: 'Central', items: [] });
    batch.set(doc(db, 'users', OWNER, 'products', 'p1'), product({ stock: 18 }));
    batch.set(doc(db, 'users', OWNER, 'shifts', 't1'), { id: 't1', initialCash: 100, salesTotal: 20, expensesTotal: 0, state: 'open' });
    batch.set(doc(db, 'users', OWNER, 'clients', 'cl1'), { id: 'cl1', name: 'Cliente', balanceCredit: 0 });
    await assertSucceeds(batch.commit());
  });

  test('puede actualizar un producto viejo con tipos incorrectos', async () => {
    await assertSucceeds(updateDoc(doc(cashierCtx(), 'users', OWNER, 'products', 'legacy'), { stock: '6' }));
  });

  test('puede cerrar turno, pagar compra, editar configuración y borrar gastos', async () => {
    const db = cashierCtx();
    await assertSucceeds(updateDoc(doc(db, 'users', OWNER, 'shifts', 't1'), { state: 'closed', finalCash: 100 }));
    await assertSucceeds(updateDoc(doc(db, 'users', OWNER, 'purchases', 'c1'), { status: 'Pagada' }));
    await assertSucceeds(updateDoc(doc(db, 'users', OWNER, 'configs', 'storeConfig'), { activeBranchId: 'b1' }));
    await assertSucceeds(deleteDoc(doc(db, 'users', OWNER, 'expenses', 'g1')));
  });

  test('NO puede borrar ventas, compras, turnos ni configuración', async () => {
    const db = cashierCtx();
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'sales', 's1')));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'purchases', 'c1')));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'shifts', 't1')));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'configs', 'storeConfig')));
  });

  test('NO puede subirse permisos ni crear operadores', async () => {
    const db = cashierCtx();
    await assertFails(setDoc(doc(db, 'users', OWNER, 'operators', 'cajero@test.com'), op('cajero@test.com', { disabledTabs: [], role: 'Administrador' })));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'operators', 'amigo@test.com'), op('amigo@test.com')));
    await assertFails(deleteDoc(doc(db, 'users', OWNER, 'operators', 'bound@test.com')));
    await assertFails(setDoc(doc(db, 'operators', 'cajero@test.com'), op('cajero@test.com', { branches: [] })));
  });

  test('NO puede escribir en subcolecciones no declaradas', async () => {
    await assertFails(setDoc(doc(cashierCtx(), 'users', OWNER, 'cualquiera', 'x'), { a: 1 }));
  });

  test('NO puede cambiar el estado de la cuenta del dueño', async () => {
    await assertFails(updateDoc(doc(cashierCtx(), 'users', OWNER), { accountStatus: 'Activa' }));
  });

  test('NO puede leer datos de otra empresa', async () => {
    await assertFails(getDocs(collection(cashierCtx(), 'users', OTHER_OWNER, 'sales')));
  });
});

describe('Etapa 2: ventas, devoluciones y kardex', () => {
  const movement = (extra = {}) => ({
    id: 's2_p1', productId: 'p1', productName: 'Paracetamol', type: 'venta', quantity: -2,
    refId: 's2', branch: 'Central', date: '2026-11-18T10:00:00Z', ...extra,
  });

  test('el cajero registra venta con stock, turno y movimiento de kardex en una transacción', async () => {
    const db = cashierCtx();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', OWNER, 'sales', 's2'), { id: 's2', total: 20, date: '2026-11-18T10:00:00Z', items: [] });
    batch.set(doc(db, 'users', OWNER, 'products', 'p1'), product({ stock: 18 }));
    batch.set(doc(db, 'users', OWNER, 'stockMovements', 's2_p1'), movement());
    await assertSucceeds(batch.commit());
  });

  test('el cajero marca una venta como devuelta una sola vez', async () => {
    const db = cashierCtx();
    const ref = doc(db, 'users', OWNER, 'sales', 's1');
    await assertSucceeds(updateDoc(ref, { returnSaleId: 'ret_s1', returnedAt: '2026-11-18T11:00:00Z' }));
    await assertFails(updateDoc(ref, { returnSaleId: 'ret_otra', returnedAt: '2026-11-18T12:00:00Z' }));
  });

  test('el cajero NO puede cambiar montos ni artículos de una venta', async () => {
    const db = cashierCtx();
    await assertFails(updateDoc(doc(db, 'users', OWNER, 'sales', 's1'), { total: 1 }));
    await assertFails(updateDoc(doc(db, 'users', OWNER, 'sales', 's1'), { returnSaleId: 'ret_s1', total: 0 }));
  });

  test('reenviar la misma venta (reintento sin conexión) se acepta', async () => {
    const db = cashierCtx();
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'sales', 's1'), { id: 's1', total: 10, date: '2026-11-01T10:00:00Z', branch: 'Central' }));
  });

  test('el dueño sí puede corregir una venta', async () => {
    await assertSucceeds(updateDoc(doc(ownerCtx(), 'users', OWNER, 'sales', 's1'), { total: 12 }));
  });

  test('los movimientos de kardex no se modifican ni los borra el cajero', async () => {
    const db = cashierCtx();
    const ref = doc(db, 'users', OWNER, 'stockMovements', 's2_p1');
    await assertSucceeds(setDoc(ref, movement()));
    await assertSucceeds(setDoc(ref, movement()));
    await assertFails(setDoc(ref, movement({ quantity: -1 })));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(deleteDoc(doc(ownerCtx(), 'users', OWNER, 'stockMovements', 's2_p1')));
  });

  test('un movimiento de kardex mal formado se rechaza', async () => {
    const db = cashierCtx();
    await assertFails(setDoc(doc(db, 'users', OWNER, 'stockMovements', 'x'), movement({ id: 'x', type: 'regalo' })));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'stockMovements', 'y'), movement({ id: 'y', quantity: '2' })));
  });

  test('dos cajas venden el mismo producto a la vez: no se pierde stock (transacciones)', async () => {
    const sell = (db, saleId, qty) => runTransaction(db, async (tx) => {
      const ref = doc(db, 'users', OWNER, 'products', 'p1');
      const snap = await tx.get(ref);
      const stock = snap.data().stock;
      tx.set(doc(db, 'users', OWNER, 'sales', saleId), { id: saleId, total: qty * 10, date: '2026-11-18T10:00:00Z' });
      tx.set(ref, { ...snap.data(), stock: stock - qty });
    });
    await Promise.all([sell(cashierCtx(), 'sA', 3), sell(ownerCtx(), 'sB', 5), sell(boundCtx(), 'sC', 2)]);
    const final = await getDoc(doc(ownerCtx(), 'users', OWNER, 'products', 'p1'));
    assert.equal(final.data().stock, 10);
  });

  test('venta sin conexión con increment() y deleteField() pasa las reglas y suma bien', async () => {
    const db = cashierCtx();
    const b1 = writeBatch(db);
    b1.set(doc(db, 'users', OWNER, 'sales', 'off1'), { id: 'off1', total: 30, date: '2026-11-18T10:00:00Z' });
    b1.update(doc(db, 'users', OWNER, 'products', 'p1'), { stock: increment(-3), expirationDates: deleteField() });
    b1.update(doc(db, 'users', OWNER, 'shifts', 't1'), { salesTotal: increment(30) });
    const b2 = writeBatch(db);
    b2.update(doc(db, 'users', OWNER, 'products', 'p1'), { stock: increment(-4) });
    b2.update(doc(db, 'users', OWNER, 'shifts', 't1'), { salesTotal: increment(40) });
    await assertSucceeds(b1.commit());
    await assertSucceeds(b2.commit());
    const p = await getDoc(doc(ownerCtx(), 'users', OWNER, 'products', 'p1'));
    const t = await getDoc(doc(ownerCtx(), 'users', OWNER, 'shifts', 't1'));
    assert.equal(p.data().stock, 13);
    assert.equal(t.data().salesTotal, 70);
  });

  test('otra empresa NO lee ni escribe el kardex', async () => {
    const db = otherOwnerCtx();
    await assertFails(getDocs(collection(db, 'users', OWNER, 'stockMovements')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'stockMovements', 'z'), movement({ id: 'z' })));
  });
});

describe('Operadores: vínculo por UID, inactivos y antiguos', () => {
  test('el operador vinculado entra con su propia cuenta', async () => {
    await assertSucceeds(getDocs(collection(boundCtx(), 'users', OWNER, 'sales')));
  });

  test('otra cuenta con el mismo correo NO entra', async () => {
    const db = impostorCtx();
    await assertFails(getDocs(collection(db, 'users', OWNER, 'sales')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'sales', 'x'), { total: 1, date: '2026-11-18' }));
  });

  test('un operador inactivo NO entra', async () => {
    await assertFails(getDocs(collection(inactiveCtx(), 'users', OWNER, 'products')));
  });

  test('un operador antiguo (solo en el tenant) sigue entrando', async () => {
    const db = env.authenticatedContext('legacyUid', { email: 'legacy@test.com' }).firestore();
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'products')));
  });
});

describe('Otras empresas y anónimos', () => {
  test('otra empresa NO lee ni escribe los datos del dueño', async () => {
    const db = otherOwnerCtx();
    await assertFails(getDoc(doc(db, 'users', OWNER, 'products', 'p1')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'products', 'p9'), product({ id: 'p9' })));
    await assertFails(getDoc(doc(db, 'users', OWNER)));
  });

  test('otra empresa NO puede secuestrar un operador global', async () => {
    const db = otherOwnerCtx();
    await assertFails(setDoc(doc(db, 'operators', 'cajero@test.com'), op('cajero@test.com', { ownerId: OTHER_OWNER })));
    await assertFails(updateDoc(doc(db, 'operators', 'cajero@test.com'), { ownerId: OTHER_OWNER }));
    await assertFails(deleteDoc(doc(db, 'operators', 'cajero@test.com')));
  });

  test('otra empresa sí puede crear un operador nuevo propio', async () => {
    const db = otherOwnerCtx();
    const o = op('suyo@test.com', { ownerId: OTHER_OWNER });
    await assertSucceeds(setDoc(doc(db, 'users', OTHER_OWNER, 'operators', o.email), o));
    await assertSucceeds(setDoc(doc(db, 'operators', o.email), o));
  });

  test('un extraño NO lee operadores ni licencias ajenas', async () => {
    const db = strangerCtx();
    await assertFails(getDoc(doc(db, 'operators', 'cajero@test.com')));
    await assertFails(getDoc(doc(db, 'licenses', OWNER)));
  });

  test('anónimo NO lee nada del tenant', async () => {
    await assertFails(getDoc(doc(anonCtx(), 'users', OWNER, 'products', 'p1')));
  });

  test('nadie salvo el admin escribe licencias', async () => {
    await assertFails(setDoc(doc(ownerCtx(), 'licenses', OWNER), { status: 'Activa', planType: 'Pro' }));
  });
});
