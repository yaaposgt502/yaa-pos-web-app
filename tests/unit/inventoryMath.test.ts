// Pruebas de los cálculos de inventario y caja (sin Firebase).
// Ejecutar desde la raíz del proyecto: npx tsx --test tests/unit/inventoryMath.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySaleItemToProduct,
  applySaleToShift,
  applySaleToClient,
  applyPurchaseItemToProduct,
  applyTransferOut,
  applyTransferIn,
  applyStockAdjustment,
} from '../../src/utils/inventoryMath';
import { esc } from '../../src/utils/escapeHtml';
import type { Product, Sale, SaleItem, Shift, Client } from '../../src/types';

const product = (extra: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Paracetamol', code: 'P1', category: 'Medicina', price: 10, cost: 6,
  stock: 20, minStock: 2, unit: 'Pza', ...extra,
});

const item = (extra: Partial<SaleItem> = {}): SaleItem => ({
  productId: 'p1', name: 'Paracetamol', quantity: 2, price: 10, cost: 6, ...extra,
});

const sale = (extra: Partial<Sale> = {}): Sale => ({
  id: 's1', date: '2026-11-18T10:00:00Z', items: [item()], total: 20, profit: 8,
  received: 20, change: 0, paymentMethod: 'cash', shiftId: 't1', ...extra,
});

test('venta simple descuenta stock y devuelve el cambio para increment()', () => {
  const r = applySaleItemToProduct(product(), item(), 'Central');
  assert.equal(r.product.stock, 18);
  assert.equal(r.stockDelta, -2);
  assert.equal(r.product.branch, 'Central');
});

test('venta por caja usa unidades por caja', () => {
  const r = applySaleItemToProduct(product({ unitsPerBox: 10, stock: 50 }), item({ quantity: 2, selectedUnit: 'Caja' }), 'Central');
  assert.equal(r.product.stock, 30);
  assert.equal(r.stockDelta, -20);
});

test('venta descuenta primero del lote elegido y elimina lotes vacíos', () => {
  const p = product({
    stock: 10,
    expirationDates: [
      { batch: 'A', date: '2027-01-01', stock: 4 },
      { batch: 'B', date: '2027-06-01', stock: 6 },
    ],
  });
  const r = applySaleItemToProduct(p, item({ quantity: 6, selectedLote: 'B' }), 'Central');
  assert.equal(r.product.stock, 4);
  assert.deepEqual(r.product.expirationDates, [{ batch: 'A', date: '2027-01-01', stock: 4 }]);
});

test('devolución (cantidad negativa) repone stock y el lote vendido', () => {
  const p = product({
    stock: 8,
    expirationDates: [
      { batch: 'A', date: '2027-01-01', stock: 4 },
      { batch: 'B', date: '2027-06-01', stock: 4 },
    ],
  });
  const r = applySaleItemToProduct(p, item({ quantity: -2, selectedLote: 'B' }), 'Central');
  assert.equal(r.product.stock, 10);
  assert.equal(r.stockDelta, 2);
  assert.equal(r.product.expirationDates?.find(l => l.batch === 'B')?.stock, 6);
  assert.equal(r.product.expirationDates?.find(l => l.batch === 'A')?.stock, 4);
});

test('devolución cuando todos los lotes se vendieron recrea un lote', () => {
  const p = product({ stock: 0, manageBatchAndExpiration: true, expirationDate: '2027-01-01', initialBatch: 'A', expirationDates: undefined });
  const r = applySaleItemToProduct(p, item({ quantity: -3 }), 'Central');
  assert.equal(r.product.stock, 3);
  assert.deepEqual(r.product.expirationDates, [{ date: '2027-01-01', stock: 3, batch: 'A' }]);
});

test('turno: suma ventas y efectivo; respeta turnos antiguos sin cashSales', () => {
  const shift: Shift = { id: 't1', openedAt: '2026-11-18T08:00:00Z', initialCash: 100, salesTotal: 50, expensesTotal: 0, state: 'open' };
  const cash = applySaleToShift(shift, sale(), 'Central');
  assert.equal(cash.shift.salesTotal, 70);
  assert.equal(cash.shift.cashSales, 70); // legado: cashSales = salesTotal
  assert.equal(cash.salesTotalDelta, 20);
  assert.equal(cash.cashSalesDelta, 20);
  const card = applySaleToShift({ ...shift, cashSales: 10 }, sale({ paymentMethod: 'card' }), 'Central');
  assert.equal(card.shift.cashSales, 10);
  assert.equal(card.cashSalesDelta, 0);
});

test('cliente: venta y devolución a crédito son simétricas', () => {
  const client: Client = { id: 'c1', name: 'Ana', phone: '', email: '', balanceCredit: 0, limitCredit: 500, loyaltyPoints: 0, totalSpent: 0 };
  const s = applySaleToClient(client, sale({ total: 95, paymentMethod: 'credit' }), 'Central');
  assert.equal(s.client.balanceCredit, 95);
  assert.equal(s.loyaltyPointsDelta, 9);
  const back = applySaleToClient(s.client, sale({ total: -95, paymentMethod: 'credit' }), 'Central');
  assert.equal(back.client.balanceCredit, 0);
  assert.equal(back.client.loyaltyPoints, 0);
  assert.equal(back.client.totalSpent, 0);
});

test('compra suma stock y crea el lote', () => {
  const r = applyPurchaseItemToProduct(product({ stock: 0, expirationDates: [] }), { quantity: 12, cost: 5, lote: 'L1', expirationDate: '2027-03-01' });
  assert.equal(r.stock, 12);
  assert.equal(r.cost, 5);
  assert.deepEqual(r.expirationDates, [{ batch: 'L1', date: '2027-03-01', stock: 12 }]);
});

test('transferencia: sale del origen y entra al destino (existente o nuevo)', () => {
  const source = product({ stock: 10, branch: 'Central', expirationDates: [{ batch: 'A', date: '2027-01-01', stock: 10 }] });
  const out = applyTransferOut(source, 4, 'Central');
  assert.equal(out.stock, 6);
  assert.equal(out.expirationDates?.[0].stock, 6);

  const existing = product({ id: 'p2', stock: 1, branch: 'Norte', expirationDates: [{ batch: 'A', date: '2027-01-01', stock: 1 }] });
  const inExisting = applyTransferIn(source, existing, 4, 'Norte', 'nuevo');
  assert.equal(inExisting.id, 'p2');
  assert.equal(inExisting.stock, 5);

  const inNew = applyTransferIn(source, undefined, 4, 'Norte', 'p3');
  assert.equal(inNew.id, 'p3');
  assert.equal(inNew.stock, 4);
  assert.equal(inNew.branch, 'Norte');
});

test('ajuste manual: entrada al primer lote, salida en orden', () => {
  const p = product({ stock: 10, expirationDates: [{ batch: 'A', date: '2027-01-01', stock: 4 }, { batch: 'B', date: '2027-06-01', stock: 6 }] });
  const up = applyStockAdjustment(p, 3);
  assert.equal(up.stock, 13);
  assert.equal(up.expirationDates?.[0].stock, 7);
  const down = applyStockAdjustment(p, -5);
  assert.equal(down.stock, 5);
  assert.equal(down.expirationDates?.[0].stock, 0);
  assert.equal(down.expirationDates?.[1].stock, 5);
});

test('esc() neutraliza HTML en impresiones', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc('Tom & "Jerry\''), 'Tom &amp; &quot;Jerry&#39;');
  assert.equal(esc(undefined), '');
  assert.equal(esc(12.5), '12.5');
});
