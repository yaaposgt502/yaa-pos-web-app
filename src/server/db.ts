import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Product, Client, Provider, Sale, Purchase, Expense, Shift, UserFile, AppConfig, User, License } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

interface DbSchema {
  users: Array<User & { passwordHash: string }>;
  products: Record<string, Product[]>; // key is userId
  clients: Record<string, Client[]>; // key is userId
  providers: Record<string, Provider[]>; // key is userId
  sales: Record<string, Sale[]>; // key is userId
  purchases: Record<string, Purchase[]>; // key is userId
  expenses: Record<string, Expense[]>; // key is userId
  shifts: Record<string, Shift[]>; // key is userId
  files: Record<string, UserFile[]>; // key is userId
  configs: Record<string, AppConfig>; // key is userId
  licenses: Record<string, License>; // key is userId
  operators: Record<string, any[]>; // key is userId
}

const emptyDb: DbSchema = {
  users: [],
  products: {},
  clients: {},
  providers: {},
  sales: {},
  purchases: {},
  expenses: {},
  shifts: {},
  files: {},
  configs: {},
  licenses: {},
  operators: {}
};

let dbCache: DbSchema | null = null;

// Initialize Database structure
export async function initDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    try {
      const content = await fs.readFile(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
    } catch {
      dbCache = JSON.parse(JSON.stringify(emptyDb));
      await writeDb();
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    dbCache = JSON.parse(JSON.stringify(emptyDb));
  }
}

// Write cache to file
async function writeDb() {
  if (!dbCache) return;
  await fs.writeFile(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
}

// User-related functions
export async function getUsers() {
  if (!dbCache) await initDb();
  return dbCache!.users;
}

export async function getUserByEmail(email: string) {
  if (!dbCache) await initDb();
  return dbCache!.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function getUserById(id: string) {
  if (!dbCache) await initDb();
  return dbCache!.users.find(u => u.id === id);
}

export async function createUser(email: string, name: string, passwordHash: string) {
  if (!dbCache) await initDb();
  const existing = await getUserByEmail(email);
  if (existing) throw new Error('User already exists');

  const newUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    passwordHash
  };

  dbCache!.users.push(newUser);
  
  // Initialize user's structures
  const userId = newUser.id;
  dbCache!.products[userId] = [];
  dbCache!.clients[userId] = [];
  dbCache!.providers[userId] = [];
  dbCache!.sales[userId] = [];
  dbCache!.purchases[userId] = [];
  dbCache!.expenses[userId] = [];
  dbCache!.shifts[userId] = [];
  dbCache!.files[userId] = [];
  if (!dbCache!.licenses) dbCache!.licenses = {};
  if (!dbCache!.operators) dbCache!.operators = {};
  dbCache!.operators[userId] = [];
  dbCache!.licenses[userId] = {
    userId,
    clientName: name,
    clientEmail: email,
    application: 'Yaa POS',
    planType: 'Básico',
    expirationDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Activa',
    licenseStartDate: new Date().toISOString().split('T')[0],
    maxUsers: 3,
    maxBranches: 1
  };
  dbCache!.configs[userId] = {
    storeName: `Mi Ferretería/Farmacia - ${name}`,
    currency: 'Q', // Default to Quetzal (common in Guatemala/Latin America, or user can edit)
    alertDaysBeforeExpiration: 30,
    businessType: 'general'
  };

  // Seed default items for first-time onboarding
  seedDefaultDataForUser(userId);

  await writeDb();

  const { passwordHash: _, ...userSafe } = newUser;
  return userSafe;
}

function seedDefaultDataForUser(userId: string) {
  if (!dbCache) return;

  // Default Clients
  dbCache.clients[userId] = [
    { id: crypto.randomUUID(), name: 'Consumidor Final', phone: '00000000', email: 'cf@yaapos.com', balanceCredit: 0, limitCredit: 0 },
    { id: crypto.randomUUID(), name: 'Juan Pérez', phone: '55551234', email: 'juan@example.com', balanceCredit: 150.00, limitCredit: 1000.00 }
  ];

  // Default Providers
  dbCache.providers[userId] = [
    { id: crypto.randomUUID(), name: 'Distribuidora Central S.A.', contact: 'Ing. Carlos Gómez', phone: '22221111', email: 'contacto@distcentral.com' },
    { id: crypto.randomUUID(), name: 'Proveedora del Istmo', contact: 'Marta Solís', phone: '24445555', email: 'marta@provistmo.com' }
  ];

  // Default Products
  dbCache.products[userId] = [
    { id: 'p1', name: 'Martillo de Uña 16oz', code: '750123456701', category: 'Herramientas', price: 65.00, cost: 40.00, stock: 15, minStock: 5, unit: 'Pza' },
    { id: 'p2', name: 'Tornillo de Ensamble 2" x 50', code: '750123456702', category: 'Fijaciones', price: 12.00, cost: 7.00, stock: 120, minStock: 20, unit: 'Pza' },
    { id: 'p3', name: 'Paracetamol 500mg (Caja 100 tab)', code: '750123456703', category: 'Medicamentos', price: 45.00, cost: 25.00, stock: 35, minStock: 10, expirationDate: '2026-12-15', unit: 'Pza' },
    { id: 'p4', name: 'Amoxicilina Suspensión 250mg', code: '750123456704', category: 'Antibióticos', price: 85.00, cost: 50.00, stock: 4, minStock: 5, expirationDate: '2026-08-30', unit: 'Pza', prescriptionRequired: 'bajo receta médica' },
    { id: 'p5', name: 'Cuaderno Universitario Espiral Liso', code: '750123456705', category: 'Papelería', price: 18.00, cost: 10.00, stock: 50, minStock: 15, unit: 'Pza' }
  ];

  // Default Expenses
  dbCache.expenses[userId] = [
    { id: crypto.randomUUID(), date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), description: 'Pago de Energía Eléctrica', amount: 350.00, category: 'Servicios' },
    { id: crypto.randomUUID(), date: new Date().toISOString(), description: 'Compra de bolsas de empaque', amount: 75.00, category: 'Papelería/Oficina' }
  ];

  // Default Shifts matching historic records
  dbCache.shifts[userId] = [
    {
      id: crypto.randomUUID(),
      openedAt: '2026-09-09T08:28:00.000Z',
      closedAt: '2026-09-10T02:54:00.000Z',
      initialCash: 200.00,
      salesTotal: 8.00,
      cashSales: 8.00,
      expensesTotal: 0.00,
      finalCash: 283.00,
      state: 'closed',
      cashierName: 'Luis Fernando Mijangos',
      shiftNumber: 1
    },
    {
      id: crypto.randomUUID(),
      openedAt: '2026-09-10T02:54:00.000Z',
      closedAt: '2026-09-16T15:19:00.000Z',
      initialCash: 150.00,
      salesTotal: 81.00,
      cashSales: 81.00,
      expensesTotal: 0.00,
      finalCash: 231.00,
      state: 'closed',
      cashierName: 'Luis Fernando Mijangos',
      shiftNumber: 2
    },
    {
      id: crypto.randomUUID(),
      openedAt: '2026-09-16T15:19:00.000Z',
      closedAt: '2026-09-18T01:19:00.000Z',
      initialCash: 100.00,
      salesTotal: 0.00,
      cashSales: 0.00,
      expensesTotal: 0.00,
      finalCash: 100.00,
      state: 'closed',
      cashierName: 'Luis Fernando Mijangos',
      shiftNumber: 3
    }
  ];

  // Default config
  dbCache.configs[userId] = {
    storeName: 'Mi Ferretería y Variedades Yaa POS',
    currency: 'Q',
    alertDaysBeforeExpiration: 45,
    businessType: 'general'
  };
}

// Generic Getter helper
function getCollection<T>(collectionName: keyof DbSchema, userId: string): T[] {
  if (!dbCache) return [];
  const userMap = dbCache[collectionName] as unknown as Record<string, T[]>;
  if (!userMap[userId]) {
    userMap[userId] = [];
  }
  return userMap[userId];
}

// Generic Setter helper
async function saveCollection<T extends { id: string }>(
  collectionName: keyof DbSchema,
  userId: string,
  item: T
): Promise<T> {
  if (!dbCache) await initDb();
  const userMap = dbCache![collectionName] as unknown as Record<string, T[]>;
  if (!userMap[userId]) {
    userMap[userId] = [];
  }

  const index = userMap[userId].findIndex(x => x.id === item.id);
  if (index >= 0) {
    userMap[userId][index] = item;
  } else {
    userMap[userId].push(item);
  }

  await writeDb();
  return item;
}

// Generic Delete helper
async function deleteFromCollection<T extends { id: string }>(
  collectionName: keyof DbSchema,
  userId: string,
  itemId: string
): Promise<boolean> {
  if (!dbCache) await initDb();
  const userMap = dbCache![collectionName] as unknown as Record<string, T[]>;
  if (!userMap[userId]) return false;

  const originalLength = userMap[userId].length;
  userMap[userId] = userMap[userId].filter(x => x.id !== itemId);
  
  const success = userMap[userId].length < originalLength;
  if (success) {
    await writeDb();
  }
  return success;
}

// --- PRODUCTS ---
export async function getProducts(userId: string) {
  return getCollection<Product>('products', userId);
}
export async function saveProduct(userId: string, product: Product) {
  return saveCollection<Product>('products', userId, product);
}
export async function deleteProduct(userId: string, productId: string) {
  return deleteFromCollection('products', userId, productId);
}

// --- CLIENTS ---
export async function getClients(userId: string) {
  return getCollection<Client>('clients', userId);
}
export async function saveClient(userId: string, client: Client) {
  return saveCollection<Client>('clients', userId, client);
}
export async function deleteClient(userId: string, clientId: string) {
  return deleteFromCollection('clients', userId, clientId);
}

// --- PROVIDERS ---
export async function getProviders(userId: string) {
  return getCollection<Provider>('providers', userId);
}
export async function saveProvider(userId: string, provider: Provider) {
  return saveCollection<Provider>('providers', userId, provider);
}
export async function deleteProvider(userId: string, providerId: string) {
  return deleteFromCollection('providers', userId, providerId);
}

// --- SALES ---
export async function getSales(userId: string) {
  return getCollection<Sale>('sales', userId);
}
export async function saveSale(userId: string, sale: Sale) {
  // Deduct stocks
  if (!dbCache) await initDb();
  const products = dbCache!.products[userId] || [];
  
  for (const item of sale.items) {
    const prod = products.find(p => p.id === item.productId);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - item.quantity);
    }
  }

  // Update client balance if credit
  if (sale.paymentMethod === 'credit' && sale.clientId) {
    const clients = dbCache!.clients[userId] || [];
    const client = clients.find(c => c.id === sale.clientId);
    if (client) {
      client.balanceCredit += sale.total;
    }
  }

  const saved = await saveCollection<Sale>('sales', userId, sale);
  await writeDb();
  return saved;
}

// --- PURCHASES ---
export async function getPurchases(userId: string) {
  return getCollection<Purchase>('purchases', userId);
}
export async function savePurchase(userId: string, purchase: Purchase) {
  // If completed, add stock to products
  if (!dbCache) await initDb();
  if (purchase.status === 'completed') {
    const products = dbCache!.products[userId] || [];
    for (const item of purchase.items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.quantity;
        // update cost if changed
        prod.cost = item.cost;
      }
    }
  }
  const saved = await saveCollection<Purchase>('purchases', userId, purchase);
  await writeDb();
  return saved;
}

// --- EXPENSES ---
export async function getExpenses(userId: string) {
  return getCollection<Expense>('expenses', userId);
}
export async function saveExpense(userId: string, expense: Expense) {
  return saveCollection<Expense>('expenses', userId, expense);
}
export async function deleteExpense(userId: string, expenseId: string) {
  return deleteFromCollection('expenses', userId, expenseId);
}

// --- SHIFTS ---
export async function getShifts(userId: string) {
  return getCollection<Shift>('shifts', userId);
}
export async function saveShift(userId: string, shift: Shift) {
  return saveCollection<Shift>('shifts', userId, shift);
}

// --- CONFIG ---
export async function getConfig(userId: string) {
  if (!dbCache) await initDb();
  if (!dbCache!.configs[userId]) {
    dbCache!.configs[userId] = {
      storeName: 'Mi Ferretería y Variedades Yaa POS',
      currency: 'Q',
      alertDaysBeforeExpiration: 30,
      businessType: 'general'
    };
    await writeDb();
  }
  return dbCache!.configs[userId];
}
export async function saveConfig(userId: string, config: AppConfig) {
  if (!dbCache) await initDb();
  dbCache!.configs[userId] = config;
  await writeDb();
  return config;
}

// --- FILES STORAGE & METADATA ---
export async function getFiles(userId: string) {
  return getCollection<UserFile>('files', userId);
}

function assertSafeSegment(segment: string, label: string): string {
  const clean = path.basename(String(segment || '').trim());
  if (!clean || clean === '.' || clean === '..' || clean !== segment.trim() || !/^[a-zA-Z0-9_.\-@ ]+$/.test(clean)) {
    throw new Error(`Invalid ${label}`);
  }
  return clean;
}

export async function saveFile(userId: string, fileName: string, mimeType: string, base64Content: string) {
  if (!dbCache) await initDb();

  const safeUserId = assertSafeSegment(userId, 'userId');
  const safeBaseName = path.basename(String(fileName || 'file')).replace(/[^a-zA-Z0-9_.\- ]/g, '_');
  const userUploadsDir = path.resolve(UPLOADS_DIR, safeUserId);
  if (!userUploadsDir.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
    throw new Error('Invalid upload directory');
  }
  await fs.mkdir(userUploadsDir, { recursive: true });

  const fileId = crypto.randomUUID();
  const diskFileName = `${fileId}_${safeBaseName}`;
  const diskFilePath = path.resolve(userUploadsDir, diskFileName);
  if (!diskFilePath.startsWith(userUploadsDir + path.sep)) {
    throw new Error('Invalid file path');
  }

  // Decode and write to disk
  const buffer = Buffer.from(base64Content, 'base64');
  await fs.writeFile(diskFilePath, buffer);

  const fileMetadata: UserFile = {
    id: fileId,
    name: safeBaseName,
    mimeType,
    size: buffer.length,
    path: `/api/files/download/${safeUserId}/${diskFileName}`,
    uploadedAt: new Date().toISOString()
  };

  const saved = await saveCollection<UserFile>('files', safeUserId, fileMetadata);
  return saved;
}

export async function deleteFile(userId: string, fileId: string) {
  if (!dbCache) await initDb();

  const safeUserId = assertSafeSegment(userId, 'userId');
  const filesList = dbCache!.files[safeUserId] || [];
  const fileMeta = filesList.find(f => f.id === fileId);
  if (!fileMeta) return false;

  const userUploadsDir = path.resolve(UPLOADS_DIR, safeUserId);
  const diskFileName = path.basename(fileMeta.path);
  const diskFilePath = path.resolve(userUploadsDir, diskFileName);
  if (!diskFilePath.startsWith(userUploadsDir + path.sep)) {
    return false;
  }

  // Delete physical file
  try {
    await fs.unlink(diskFilePath);
  } catch (err) {
    console.error('Could not delete physical file:', err);
    // Continue deleting metadata in case file doesn't exist
  }

  // Delete metadata
  return deleteFromCollection('files', safeUserId, fileId);
}

// --- LICENSES & PLAN REPOSITORIES ---
export async function getLicense(userId: string): Promise<License> {
  if (!dbCache) await initDb();
  if (!dbCache!.licenses) dbCache!.licenses = {};
  
  if (!dbCache!.licenses[userId]) {
    const user = await getUserById(userId);
    dbCache!.licenses[userId] = {
      userId,
      clientName: user?.name || 'Empresa',
      clientEmail: user?.email || '',
      application: 'Yaa POS',
      planType: 'Básico',
      expirationDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'Activa',
      licenseStartDate: new Date().toISOString().split('T')[0],
      maxUsers: 3,
      maxBranches: 1
    };
    await writeDb();
  }
  return dbCache!.licenses[userId];
}

export async function saveLicense(userId: string, license: License): Promise<License> {
  if (!dbCache) await initDb();
  if (!dbCache!.licenses) dbCache!.licenses = {};
  dbCache!.licenses[userId] = license;
  await writeDb();
  return license;
}

// --- OPERATORS / USERS PER COMPANY ---
export async function getOperators(userId: string): Promise<any[]> {
  if (!dbCache) await initDb();
  if (!dbCache!.operators) dbCache!.operators = {};
  return dbCache!.operators[userId] || [];
}

export async function saveOperator(userId: string, operator: any): Promise<any> {
  if (!dbCache) await initDb();
  if (!dbCache!.operators) dbCache!.operators = {};
  if (!dbCache!.operators[userId]) dbCache!.operators[userId] = [];

  const existingIdx = dbCache!.operators[userId].findIndex(o => o.id === operator.id || (o.email && o.email.toLowerCase() === (operator.email || '').toLowerCase()));
  if (existingIdx >= 0) {
    dbCache!.operators[userId][existingIdx] = operator;
  } else {
    dbCache!.operators[userId].push(operator);
  }
  await writeDb();
  return operator;
}

export async function deleteOperator(userId: string, operatorId: string): Promise<boolean> {
  if (!dbCache) await initDb();
  if (!dbCache!.operators || !dbCache!.operators[userId]) return false;
  const initialLen = dbCache!.operators[userId].length;
  dbCache!.operators[userId] = dbCache!.operators[userId].filter(o => o.id !== operatorId && o.email !== operatorId);
  const success = dbCache!.operators[userId].length < initialLen;
  if (success) await writeDb();
  return success;
}
