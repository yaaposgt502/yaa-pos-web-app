// Pruebas del kardex y de la cobertura de reportes (sin Firebase).
// Ejecutar: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKardexHistory, formatKardexDate } from '../../src/utils/kardex';
import { liveCoversRange, toRangeIso } from '../../src/utils/rangeMath';
import type { Product, Sale, Purchase, StockMovement } from '../../src/types';

const product: Product = {
  id: 'p1', name: 'Paracetamol', code: 'P1', category: 'Medicina', price: 10, cost: 6,
  stock: 25, minStock: 2, unit: 'Pza', expirationDate: '2027-01-01', initialBatch: 'A',
};

const mov = (id: string, type: StockMovement['type'], quantity: number, date: string, extra: Partial<StockMovement> = {}): StockMovement => ({
  id, productId: 'p1', productName: 'Paracetamol', type, quantity, refId: id.split('_p1')[0], date, operatorName: 'Ana', ...extra,
});

const sale = (id: string, qty: number, date: string, extra: Partial<Sale> = {}): Sale => ({
  id, date, items: [{ productId: 'p1', name: 'Paracetamol', quantity: qty, price: 10, cost: 6 }], total: qty * 10, profit: qty * 4,
  received: qty * 10, change: 0, paymentMethod: 'cash', shiftId: 't1', operatorName: 'Luis', ...extra,
});

test('kardex: movimientos, venta antigua, devolución y compra pendiente', () => {
  const movements = [
    mov('sale_new_p1', 'venta', -2, '2026-11-18T10:00:00Z'),
    mov('ret_sale_new_p1', 'devolucion', 2, '2026-11-18T11:00:00Z'),
    mov('adj_1_p1', 'ajuste', 5, '2026-11-18T12:00:00Z', { reason: 'Conteo físico' }),
  ];
  const sales = [
    sale('sale_new', 2, '2026-11-18T10:00:00Z'),               // ya tiene movimiento: no se duplica
    sale('sale_old', 3, '2026-11-01T10:00:00Z'),               // venta anterior a la Etapa 2
    sale('ret_old', -1, '2026-11-02T10:00:00Z', { originalSaleId: 'sale_old' }), // devolución antigua
  ];
  const purchases: Purchase[] = [
    { id: 'pur_ok', date: '2026-10-30T10:00:00Z', items: [{ productId: 'p1', name: 'Paracetamol', quantity: 10, cost: 6 } as any], total: 60, providerId: 'v1', status: 'completed' },
    { id: 'pur_pend', date: '2026-11-03T10:00:00Z', items: [{ productId: 'p1', name: 'Paracetamol', quantity: 50, cost: 6 } as any], total: 300, providerId: 'v1', status: 'pending' },
  ];
  const k = buildKardexHistory({ product, movements, sales, purchases });
  const chronological = [...k].reverse();

  assert.equal(chronological[0].type, 'inicial');
  assert.equal(k.length, 1 + 3 + 2 + 1, 'inicial + 3 movimientos + 2 ventas antiguas + 1 compra recibida');
  assert.ok(!k.some(e => e.id.includes('pur_pend')), 'la compra pendiente no suma stock');
  const oldReturn = k.find(e => e.id === 'sale-ret_old-p1')!;
  assert.equal(oldReturn.type, 'entrada');
  assert.equal(oldReturn.quantity, 1);
  assert.equal(oldReturn.motivo, 'Devolución');
  assert.equal(k.find(e => e.id === 'adj_1_p1')!.concept, 'Conteo físico');
  assert.equal(k.find(e => e.id === 'sale_new_p1')!.user, 'Ana');
  // El saldo final coincide con el stock actual.
  assert.equal(k[0].balance, 25);
  // Saldo inicial = 25 - entradas (10 + 1 + 2 + 5) + salidas (3 + 2) = 12
  assert.equal(chronological[0].quantity, 12);
});

test('kardex: filtro por sucursal', () => {
  const movements = [
    mov('a_p1', 'venta', -1, '2026-11-18T10:00:00Z', { branch: 'Central' }),
    mov('b_p1', 'venta', -4, '2026-11-18T10:00:00Z', { branch: 'Norte' }),
  ];
  const branches = [
    { id: 'b1', name: 'Central', code: 'C', address: '', city: '', isActive: true },
    { id: 'b2', name: 'Norte', code: 'N', address: '', city: '', isActive: true },
  ] as any;
  const k = buildKardexHistory({ product, movements, sales: [], purchases: [], branchFilter: 'Norte', branches });
  assert.deepEqual(k.filter(e => e.type !== 'inicial').map(e => e.id), ['b_p1']);
});

test('reportes: la lista en vivo basta si la empresa tiene menos registros que el límite', () => {
  assert.equal(liveCoversRange(['2026-01-01T00:00:00Z'], 300, '2020-01-01T00:00:00Z'), true);
});

test('reportes: con la lista llena, solo basta si llega al inicio del rango', () => {
  const dates = Array.from({ length: 300 }, (_, i) => new Date(Date.UTC(2026, 10, 18) - i * 3600_000).toISOString());
  const oldest = dates[dates.length - 1];
  assert.equal(liveCoversRange(dates, 300, new Date(new Date(oldest).getTime() + 1).toISOString()), true);
  assert.equal(liveCoversRange(dates, 300, '2026-01-01T00:00:00.000Z'), false);
  assert.equal(liveCoversRange(dates, 300, null), false, '"Todo" con la lista llena requiere consultar');
});

test('reportes: el rango cubre el día completo en hora local', () => {
  const { fromIso, toIso } = toRangeIso('2026-11-01', '2026-11-30');
  assert.equal(new Date(fromIso!).getTime(), new Date('2026-11-01T00:00:00').getTime());
  assert.equal(new Date(toIso!).getTime(), new Date('2026-11-30T23:59:59.999').getTime());
  assert.deepEqual(toRangeIso('', ''), { fromIso: null, toIso: null });
});

test('kardex: fecha de vencimiento sin hora se muestra como fecha local', () => {
  assert.equal(formatKardexDate('2027-01-01'), new Date(2027, 0, 1).toLocaleDateString());
  assert.equal(formatKardexDate('—'), '—');
  assert.equal(formatKardexDate(undefined), '—');
  assert.equal(formatKardexDate('texto libre'), 'texto libre');
});
