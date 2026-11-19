// Builds a product's kardex (inventory card). Since Stage 2 every stock change
// is recorded in stockMovements; older sales and purchases have no movement,
// so they are derived from the sale / purchase documents, without counting
// anything twice.
import { Product, Sale, Purchase, StockMovement, Branch } from '../types';
import { isItemInBranch } from './branchHelper';
import { unitMultiplier } from './inventoryMath';

export interface KardexEntry {
  id: string;
  date: string;
  type: 'entrada' | 'salida' | 'inicial';
  concept: string;
  reference: string;
  quantity: number;
  price?: number;
  cost?: number;
  balance: number;
  user: string;
  operation: string;
  motivo: string;
  lote: string;
  vence: string;
}

const MOVEMENT_TEXT: Record<StockMovement['type'], { concept: string; motivo: string }> = {
  venta: { concept: 'Venta (POS)', motivo: 'Venta' },
  devolucion: { concept: 'Devolución de venta', motivo: 'Devolución' },
  compra: { concept: 'Compra a Proveedor', motivo: 'Compra' },
  transferencia_salida: { concept: 'Transferencia a otra sucursal', motivo: 'Transferencia' },
  transferencia_entrada: { concept: 'Transferencia desde otra sucursal', motivo: 'Transferencia' },
  ajuste: { concept: 'Ajuste Manual', motivo: 'Ajuste Manual' },
};

const shortRef = (id: string) => `Ref. ${id.slice(-8).toUpperCase()}`;

export function buildKardexHistory(input: {
  product: Product;
  movements: StockMovement[];
  sales: Sale[];
  purchases: Purchase[];
  legacyAdjustments?: Array<{ id: string; date: string; type: 'entrada' | 'salida'; quantity: number; reference?: string; lote?: string; vence?: string }>;
  branchFilter?: string; // 'Todas' or a branch name
  branches?: Branch[];
}): KardexEntry[] {
  const { product } = input;
  const inBranch = (b?: string) =>
    !input.branchFilter || input.branchFilter === 'Todas' || isItemInBranch(b, input.branchFilter, input.branches);
  const vence = product.expirationDate || '—';
  const history: KardexEntry[] = [];

  // 1. Recorded movements (source of truth since Stage 2).
  const movementRefs = new Set<string>();
  for (const m of input.movements) {
    if (m.productId !== product.id) continue;
    movementRefs.add(m.refId);
    if (!inBranch(m.branch) || !m.quantity) continue;
    const text = MOVEMENT_TEXT[m.type] || { concept: m.type, motivo: m.type };
    const isIn = m.quantity > 0;
    history.push({
      id: m.id,
      date: m.date,
      type: isIn ? 'entrada' : 'salida',
      concept: m.type === 'ajuste' ? (m.reason || text.concept) : text.concept,
      reference: m.type === 'ajuste' ? (m.reason || 'Ajuste de inventario') : shortRef(m.refId),
      quantity: Math.abs(m.quantity),
      cost: product.cost,
      price: product.price,
      balance: 0,
      user: m.operatorName || '—',
      operation: isIn ? 'Entrada' : 'Salida',
      motivo: text.motivo,
      lote: '—',
      vence,
    });
  }

  // 2. Older sales (and returns) that have no movement.
  for (const sale of input.sales) {
    if (movementRefs.has(sale.id) || !inBranch(sale.branch)) continue;
    let units = 0;
    let price: number | undefined;
    let cost: number | undefined;
    let lote = '—';
    for (const item of sale.items || []) {
      if (item.productId !== product.id) continue;
      units += item.quantity * unitMultiplier(product, item.selectedUnit);
      price = item.price;
      cost = item.cost;
      if (item.selectedLote) lote = item.selectedLote;
    }
    if (!units) continue;
    const isReturn = units < 0;
    history.push({
      id: `sale-${sale.id}-${product.id}`,
      date: sale.date,
      type: isReturn ? 'entrada' : 'salida',
      concept: isReturn ? 'Devolución de venta' : 'Venta (POS)',
      reference: shortRef(sale.id),
      quantity: Math.abs(units),
      price,
      cost,
      balance: 0,
      user: sale.operatorName || '—',
      operation: isReturn ? 'Entrada' : 'Salida',
      motivo: isReturn ? 'Devolución' : 'Venta',
      lote,
      vence,
    });
  }

  // 3. Older purchases that have no movement. Only received (completed)
  //    purchases added stock; pending orders did not.
  for (const purchase of input.purchases) {
    if (movementRefs.has(purchase.id) || purchase.status !== 'completed' || !inBranch(purchase.branch)) continue;
    let units = 0;
    let cost: number | undefined;
    let lote = '—';
    let itemVence = vence;
    for (const item of purchase.items || []) {
      if (!item || item.productId !== product.id) continue;
      units += item.quantity;
      cost = item.cost;
      if (item.lote) lote = item.lote;
      if (item.expirationDate) itemVence = item.expirationDate;
    }
    if (!units) continue;
    history.push({
      id: `purchase-${purchase.id}-${product.id}`,
      date: purchase.date,
      type: 'entrada',
      concept: 'Compra a Proveedor',
      reference: shortRef(purchase.id),
      quantity: units,
      cost,
      balance: 0,
      user: '—',
      operation: 'Entrada',
      motivo: 'Compra',
      lote,
      vence: itemVence,
    });
  }

  // 4. Adjustments that older versions kept only in this browser.
  for (const adj of input.legacyAdjustments || []) {
    history.push({
      id: adj.id,
      date: adj.date,
      type: adj.type,
      concept: adj.reference || 'Ajuste Manual',
      reference: adj.reference || 'Ajuste de inventario',
      quantity: adj.quantity,
      cost: product.cost,
      price: product.price,
      balance: 0,
      user: '—',
      operation: adj.type === 'entrada' ? 'Entrada' : 'Salida',
      motivo: 'Ajuste Manual',
      lote: adj.lote || '—',
      vence: adj.vence || vence,
    });
  }

  history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Opening balance: what the stock was before the first recorded entry.
  let sumIn = 0;
  let sumOut = 0;
  for (const h of history) {
    if (h.type === 'entrada') sumIn += h.quantity;
    else sumOut += h.quantity;
  }
  const currentStock = typeof product.stock === 'number' ? product.stock : parseFloat(String(product.stock)) || 0;
  const opening = Math.max(0, currentStock - sumIn + sumOut);
  const firstDate = history.length > 0 ? history[0].date : (product.registrationDate || new Date().toISOString());

  const initial: KardexEntry = {
    id: `initial-${product.id}`,
    date: firstDate,
    type: 'inicial',
    concept: 'Saldo inicial',
    reference: history.length > 0 ? 'Calculado desde el stock actual' : 'Stock actual',
    quantity: opening,
    cost: product.cost,
    price: product.price,
    balance: opening,
    user: '—',
    operation: 'Entrada',
    motivo: 'Inicial',
    lote: product.initialBatch || '—',
    vence,
  };

  let balance = opening;
  for (const h of history) {
    balance += h.type === 'entrada' ? h.quantity : -h.quantity;
    h.balance = balance;
  }
  return [initial, ...history].reverse();
}

// Expiration dates are stored as "YYYY-MM-DD" (no time). new Date() reads
// them as UTC midnight, which shows the previous day in Guatemala (UTC-6);
// they are formatted as local dates instead. Empty values show "—".
export function formatKardexDate(value?: string): string {
  if (!value || value === '—' || value === '-') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString();
}
