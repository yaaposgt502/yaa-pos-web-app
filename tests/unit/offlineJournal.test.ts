// Pruebas de la bitácora de operaciones sin conexión (sin Firebase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPending, markSynced, markRejected, removeEntry, readJournal, rejectedEntries, describeRejection,
} from '../../src/utils/offlineJournal';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
};

const sale = { id: 'sale_1', kind: 'venta' as const, title: 'Venta Q35.00 · Norte', detail: '1 x Vitamina C', amount: 35 };

test('venta aceptada por el servidor: se quita de la bitácora', () => {
  const st = memory();
  addPending('k', sale, st);
  assert.equal(readJournal('k', st).length, 1);
  markSynced('k', 'sale_1', st);
  assert.equal(readJournal('k', st).length, 0);
});

test('venta rechazada: queda guardada con su motivo y no se borra al "sincronizar"', () => {
  const st = memory();
  addPending('k', { ...sale, retry: { sale: { id: 'sale_1', total: 35 } } }, st);
  markRejected('k', 'sale_1', 'Sin permiso', st);
  const r = rejectedEntries('k', st);
  assert.equal(r.length, 1);
  assert.equal(r[0].reason, 'Sin permiso');
  assert.equal(r[0].retry.sale.total, 35);
  markSynced('k', 'sale_1', st); // una respuesta tardía no la hace desaparecer
  assert.equal(rejectedEntries('k', st).length, 1);
  removeEntry('k', 'sale_1', st);
  assert.equal(readJournal('k', st).length, 0);
});

test('cada empresa tiene su propia bitácora', () => {
  const st = memory();
  addPending('k__empresaA', sale, st);
  markRejected('k__empresaA', 'sale_1', 'x', st);
  assert.equal(rejectedEntries('k__empresaB', st).length, 0);
  assert.equal(rejectedEntries('k__empresaA', st).length, 1);
});

test('el motivo del rechazo se explica en palabras del negocio', () => {
  assert.match(describeRejection({ code: 'permission-denied' }), /licencia/);
  assert.match(describeRejection({ message: 'NOT_FOUND: no entity to update' }), /ya no existe/);
});

test('sin almacenamiento disponible no falla', () => {
  addPending('k', sale, null);
  assert.deepEqual(readJournal('k', null), []);
});
