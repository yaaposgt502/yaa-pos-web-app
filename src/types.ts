export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  role?: string;
  isOperator?: boolean;
  operatorId?: string;
  accountStatus?: 'Activa' | 'Suspendida';
  disabledTabs?: string[];
}

export interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  expirationDate?: string; // YYYY-MM-DD
  unit: string; // e.g. 'Pza', 'Kg', 'Litro'
  location?: string;
  detail?: string;
  imageUrl?: string;
  
  // Pharmacy fields
  registrationDate?: string;
  barcode?: string;
  pharmacyType?: string; // e.g. Genérico, Comercial/De Marca
  prescriptionRequired?: string; // e.g. sin receta médica, bajo receta médica
  sanitaryRegister?: string;
  discount?: number;
  unitsPerBox?: number;
  unitsPerBlister?: number;
  marginPercent?: number;
  pricePerUnit?: number;
  pricePerBlister?: number;
  pricePerBox?: number;
  laboratory?: string;
  symptoms?: string;
  status?: string; // Activo, Inactivo
  manageBatchAndExpiration?: boolean;
  expirationAlertDays?: number;
  initialBatch?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  balanceCredit: number; // For credit accounts
  limitCredit: number;
}

export interface Provider {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address?: string;
  nit?: string;
  totalPurchases?: number;
  creditPending?: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
  selectedUnit?: string;
}

export interface Sale {
  id: string;
  date: string; // ISO string
  items: SaleItem[];
  total: number;
  profit: number;
  received: number;
  change: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit';
  clientId?: string;
  shiftId: string;
  operatorId?: string;
  operatorName?: string;
  voucherType?: 'ticket' | 'boleta' | 'factura' | 'recibo';
  saleType?: 'presencial' | 'delivery';
}

export interface PurchaseItem {
  productId: string;
  name: string;
  quantity: number;
  cost: number;
  lote?: string;
  expirationDate?: string;
}

export interface Purchase {
  id: string;
  date: string; // ISO string
  items: PurchaseItem[];
  total: number;
  providerId: string;
  status: 'completed' | 'pending';
  paymentType?: 'cash' | 'credit';
  voucherType?: 'factura' | 'boleta' | 'nota_venta';
  voucherNumber?: string;
  ivaOption?: 'sumar' | 'incluir' | 'no_aplicar';
  subtotal?: number;
  ivaAmount?: number;
}

export interface Expense {
  id: string;
  date: string; // ISO string or YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  paymentMethod?: string;
  voucherNumber?: string;
  observations?: string;
}

export interface Shift {
  id: string;
  openedAt: string; // ISO string
  closedAt?: string; // ISO string
  initialCash: number;
  finalCash?: number;
  salesTotal: number;
  expensesTotal: number;
  state: 'open' | 'closed';
}

export interface UserFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: string; // ISO string
}

export interface AppConfig {
  storeName: string;
  logo?: string;
  address?: string;
  phone?: string;
  currency: string;
  alertDaysBeforeExpiration: number;
  businessType: 'hardware' | 'pharmacy' | 'bookstore' | 'general';
  
  // Tax & Currency configurations
  taxName?: string;
  taxRate?: string;
  taxCalculation?: string;
  systemCurrency?: string;
  
  // Tax & Business identification
  nit?: string;
  razonSocial?: string;
  email?: string;
  
  // Document sequences (Comprobantes)
  facturaSeries?: string;
  facturaCorrelativo?: string;
  boletaSeries?: string;
  boletaCorrelativo?: string;
  notaVentaSeries?: string;
  notaVentaCorrelativo?: string;

  // Custom Ticket options
  ticketHeader?: string;
  ticketFooter?: string;
  showLogoInTicket?: boolean;
  showOperatorInTicket?: boolean;
  ticketFontSize?: 'sm' | 'md' | 'lg';

  // Digital certificate
  certificateName?: string;
  certificatePassword?: string;
  certificateExpiration?: string;

  // Master lists
  categories?: string[];
  units?: string[];
}

export interface License {
  userId: string;
  clientName: string;
  clientEmail: string;
  application: string; // "Yaa POS"
  planType: string; // 'Premium Anual' | 'Mensual Básico' | 'Demo 15 días' | 'Gratuito'
  expirationDate: string; // YYYY-MM-DD
  status: 'Pendiente' | 'Activa' | 'Vencida' | 'Suspendida' | 'Activo' | 'Por Vencer' | 'Expirada';
  licenseStartDate?: string; // YYYY-MM-DD
}
