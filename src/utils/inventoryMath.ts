// Pure inventory / cash calculations shared by the sale, purchase and
// transfer flows. They never touch Firestore: the caller decides whether the
// result is written inside a transaction (online, using fresh server data)
// or as atomic increments in a batch (offline).
import { Product, Sale, SaleItem, Shift, Client } from '../types';

export type Lote = { date: string; stock: number; batch?: string };

export const toNum = (v: unknown): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const parsed = parseFloat(String(v ?? ''));
  return isNaN(parsed) ? 0 : parsed;
};

const loteStock = (r: { stock: unknown }) => (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0));

export function unitMultiplier(product: Product, selectedUnit?: string): number {
  if (selectedUnit === 'Blíster') return product.unitsPerBlister && product.unitsPerBlister > 0 ? product.unitsPerBlister : 1;
  if (selectedUnit === 'Caja') return product.unitsPerBox && product.unitsPerBox > 0 ? product.unitsPerBox : 1;
  return 1;
}

/**
 * Applies one sale line to a product. Positive quantities sell (deduct stock
 * and lots); negative quantities are a return (stock and lots go back).
 * Returns the updated product and the signed stock change in base units.
 */
export function applySaleItemToProduct(product: Product, item: SaleItem, saleBranch: string): { product: Product; stockDelta: number } {
  const units = item.quantity * unitMultiplier(product, item.selectedUnit);
  const lotesSum = (product.expirationDates || []).reduce((acc, r) => acc + loteStock(r), 0);
  const currentStock = Math.max(toNum(product.stock), lotesSum);
  const nextStock = Math.max(0, currentStock - units);

  let lotes: Lote[] | undefined = product.expirationDates ? product.expirationDates.map(r => ({ ...r })) : undefined;
  if (lotes && lotes.length > 0) {
    const matchesSelected = (r: Lote) => {
      const batchName = r.batch || product.initialBatch || 'Lote 01';
      return !!item.selectedLote && item.selectedLote.includes(batchName);
    };
    if (units > 0) {
      let remaining = units;
      lotes = lotes.map(r => {
        if (remaining > 0 && matchesSelected(r)) {
          const deduct = Math.min(loteStock(r), remaining);
          remaining -= deduct;
          return { ...r, stock: loteStock(r) - deduct };
        }
        return r;
      });
      if (remaining > 0) {
        lotes = lotes.map(r => {
          if (remaining <= 0) return r;
          const deduct = Math.min(loteStock(r), remaining);
          remaining -= deduct;
          return { ...r, stock: loteStock(r) - deduct };
        });
      }
    } else if (units < 0) {
      // Return: put the units back into the lot that was sold, or the first one.
      const restore = -units;
      let idx = lotes.findIndex(matchesSelected);
      if (idx < 0) idx = 0;
      lotes[idx] = { ...lotes[idx], stock: loteStock(lotes[idx]) + restore };
    }
    lotes = lotes.filter(r => loteStock(r) > 0);
  } else if (units < 0 && product.manageBatchAndExpiration && product.expirationDate) {
    // Every lot had been sold and removed: recreate one for the returned units.
    lotes = [{ date: product.expirationDate, stock: -units, batch: product.initialBatch || 'Lote 01' }];
  }

  const surviving = lotes && lotes.length > 0 ? lotes : undefined;
  const updated: Product = {
    ...product,
    branch: product.branch || saleBranch,
    stock: nextStock,
    expirationDate: surviving ? surviving[0].date : (nextStock > 0 ? product.expirationDate : undefined),
    initialBatch: surviving ? (surviving[0].batch || product.initialBatch) : product.initialBatch,
    expirationDates: surviving,
  };
  return { product: updated, stockDelta: -units };
}

export interface SaleShiftEffect {
  shift: Shift;
  salesTotalDelta: number;
  cashSalesDelta: number;
}

export function applySaleToShift(shift: Shift, sale: Sale, saleBranch: string): SaleShiftEffect {
  const cashSalesDelta = sale.paymentMethod === 'cash' ? sale.total : 0;
  const baseCash = (shift.cashSales !== undefined ? shift.cashSales : shift.salesTotal) || 0;
  return {
    shift: {
      ...shift,
      branch: shift.branch || saleBranch,
      salesTotal: (shift.salesTotal || 0) + sale.total,
      cashSales: baseCash + cashSalesDelta,
    },
    salesTotalDelta: sale.total,
    cashSalesDelta,
  };
}

export interface SaleClientEffect {
  client: Client;
  totalSpentDelta: number;
  loyaltyPointsDelta: number;
  balanceCreditDelta: number;
}

export function applySaleToClient(client: Client, sale: Sale, saleBranch: string): SaleClientEffect {
  // Math.trunc keeps returns symmetric with the original sale (floor(-x) would take one extra point).
  const loyaltyPointsDelta = Math.trunc(sale.total / 10);
  const balanceCreditDelta = sale.paymentMethod === 'credit' ? sale.total : 0;
  return {
    client: {
      ...client,
      branch: client.branch || saleBranch,
      totalSpent: (client.totalSpent || 0) + sale.total,
      loyaltyPoints: (client.loyaltyPoints || 0) + loyaltyPointsDelta,
      lastPurchaseDate: sale.total >= 0 ? new Date().toISOString().split('T')[0] : client.lastPurchaseDate,
      balanceCredit: (client.balanceCredit || 0) + balanceCreditDelta,
    },
    totalSpentDelta: sale.total,
    loyaltyPointsDelta,
    balanceCreditDelta,
  };
}

/** Deducts transferred units from the source product (lots first-in order). */
export function applyTransferOut(source: Product, quantity: number, sourceBranchName: string): Product {
  const currentStock = Math.max(0, toNum(source.stock));
  const updated: Product = { ...source, branch: source.branch || sourceBranchName, stock: Math.max(0, currentStock - quantity) };
  if (source.expirationDates && source.expirationDates.length > 0) {
    let rem = quantity;
    updated.expirationDates = source.expirationDates
      .map(r => {
        if (rem <= 0) return r;
        const s = loteStock(r);
        const deduct = Math.min(s, rem);
        rem -= deduct;
        return { ...r, stock: s - deduct };
      })
      .filter(r => loteStock(r) > 0);
  } else {
    delete updated.expirationDates;
  }
  return updated;
}

/** Adds transferred units to an existing target product, or builds the new one. */
export function applyTransferIn(
  source: Product,
  target: Product | undefined,
  quantity: number,
  targetBranchName: string,
  newTargetId: string
): Product {
  if (target) {
    const lotes = target.expirationDates ? [...target.expirationDates] : [];
    if (lotes.length > 0) lotes[0] = { ...lotes[0], stock: (Number(lotes[0].stock) || 0) + quantity };
    const updated: Product = { ...target, branch: targetBranchName, stock: toNum(target.stock) + quantity };
    if (lotes.length > 0) updated.expirationDates = lotes;
    else delete updated.expirationDates;
    return updated;
  }
  const created: Product = { ...source, id: newTargetId, branch: targetBranchName, stock: quantity };
  if (source.expirationDate) {
    created.expirationDates = [{ date: source.expirationDate, stock: quantity, batch: source.initialBatch || '00101' }];
  } else if (source.expirationDates && source.expirationDates.length > 0) {
    created.expirationDates = [{ date: source.expirationDates[0].date, stock: quantity, batch: source.expirationDates[0].batch || '00101' }];
  } else {
    delete created.expirationDates;
  }
  return created;
}

export function applyPurchaseItemToProduct(
  product: Product,
  item: {
    quantity: number;
    cost: number;
    lote?: string;
    expirationDate?: string;
    pricePerUnit?: number;
    pricePerBlister?: number;
    pricePerBox?: number;
  }
): Product {
  let dateStr = '';
  if (item.expirationDate && item.expirationDate !== '—') {
    const rawDate = item.expirationDate.trim();
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else {
        dateStr = rawDate;
      }
    } else {
      dateStr = rawDate;
    }
  }

  const batchName = (item.lote && item.lote !== '—')
    ? item.lote.trim()
    : (product.initialBatch || '00101');

  let currentLotes = product.expirationDates ? product.expirationDates.map(r => ({ ...r })) : [];
  const existingProductStock = typeof product.stock === 'number' && !isNaN(product.stock) ? product.stock : 0;

  if (currentLotes.length === 0 && existingProductStock > 0) {
    currentLotes.push({
      batch: product.initialBatch || '00101',
      date: product.expirationDate || '',
      stock: existingProductStock
    });
  }

  // Find if there is an existing lote with the SAME batch name AND the SAME date
  const existingIdx = currentLotes.findIndex(r => {
    const sameBatch = (r.batch || '').trim().toLowerCase() === batchName.toLowerCase();
    if (!sameBatch) return false;
    if (dateStr && r.date && r.date !== '—') {
      return r.date === dateStr;
    }
    return true;
  });

  if (existingIdx > -1) {
    const currentLoteStock = typeof currentLotes[existingIdx].stock === 'number' ? currentLotes[existingIdx].stock : (parseInt(currentLotes[existingIdx].stock as any) || 0);
    currentLotes[existingIdx].stock = currentLoteStock + item.quantity;
    if (dateStr) {
      currentLotes[existingIdx].date = dateStr;
    }
  } else {
    currentLotes.push({
      batch: batchName,
      date: dateStr || product.expirationDate || '',
      stock: item.quantity
    });
  }

  const lotesSum = currentLotes.reduce((sum, r) => sum + (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)), 0);
  const nextStock = Math.max(existingProductStock + item.quantity, lotesSum);

  const updatedPrices: Partial<Product> = {};
  if (typeof item.pricePerUnit === 'number' && item.pricePerUnit > 0) {
    updatedPrices.pricePerUnit = item.pricePerUnit;
    updatedPrices.price = item.pricePerUnit;
  }
  if (typeof item.pricePerBlister === 'number' && item.pricePerBlister >= 0) {
    updatedPrices.pricePerBlister = item.pricePerBlister;
  }
  if (typeof item.pricePerBox === 'number' && item.pricePerBox >= 0) {
    updatedPrices.pricePerBox = item.pricePerBox;
  }

  return {
    ...product,
    stock: nextStock,
    cost: item.cost > 0 ? item.cost : product.cost,
    expirationDate: dateStr || product.expirationDate,
    initialBatch: product.initialBatch || batchName,
    expirationDates: currentLotes,
    manageBatchAndExpiration: true,
    ...updatedPrices
  };
}

