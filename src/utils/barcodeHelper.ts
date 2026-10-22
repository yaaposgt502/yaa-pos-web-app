import { Product } from '../types';

/**
 * Extracts all searchable codes from a product as clean strings,
 * strictly preserving original text and leading zeros (e.g., "00101", "0025", "1234").
 */
export function getProductCodes(product: Product): string[] {
  const codes: string[] = [];
  if (!product) return codes;

  const addCode = (val?: string | null) => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed && !codes.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
        codes.push(trimmed);
      }
    }
  };

  // 1. Primary code / SKU (e.g., "SKU-00010", "00101", "12345")
  addCode(product.code);

  // 2. Barcode (e.g., "7501008494498", "00101", "1234")
  addCode(product.barcode);

  // 3. Explicit SKU if present
  addCode((product as any).sku);

  // 4. Alternative codes (array or string with comma/semicolon/slash/space)
  const alt = (product as any).alternativeCodes || (product as any).altCodes || (product as any).altCode;
  if (Array.isArray(alt)) {
    alt.forEach(a => addCode(String(a)));
  } else if (typeof alt === 'string') {
    alt.split(/[,;\s/|]+/).forEach(part => addCode(part));
  }

  // 5. Sanitary register (often used in pharmacies for verification)
  if (product.sanitaryRegister) {
    addCode(product.sanitaryRegister);
  }

  // 6. Product database ID
  addCode(product.id);

  return codes;
}

export interface BarcodeMatchResult {
  exactMatches: Product[];
  partialMatches: Product[];
  cleanCode: string;
}

/**
 * Searches products by scanned code (barcode, SKU, alternative codes, short 4-5 digit codes).
 * Strictly preserves leading zeros and textual representation.
 */
export function matchProductsByCode(
  products: Product[],
  rawCode: string
): BarcodeMatchResult {
  const cleanCode = (rawCode || '').trim();
  if (!cleanCode) {
    return { exactMatches: [], partialMatches: [], cleanCode: '' };
  }

  const queryLower = cleanCode.toLowerCase();

  // 1. Exact matches: where ANY registered code equals the scanned code exactly (case-insensitive)
  const exactMatches = products.filter(p => {
    const pCodes = getProductCodes(p);
    return pCodes.some(c => c.toLowerCase() === queryLower);
  });

  if (exactMatches.length > 0) {
    return { exactMatches, partialMatches: [], cleanCode };
  }

  // 2. Partial matches: if no exact match, look for code prefix or substring match
  const partialMatches = products.filter(p => {
    const pCodes = getProductCodes(p);
    return pCodes.some(c => c.toLowerCase().includes(queryLower));
  });

  return { exactMatches: [], partialMatches, cleanCode };
}

/**
 * Standard supported formats for BarcodeDetector API, including short codes (4-8 digits)
 */
export const SUPPORTED_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'itf',
  'qr_code',
  'data_matrix',
  'aztec'
];
