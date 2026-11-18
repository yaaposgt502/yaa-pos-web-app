import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as db from './src/server/db';
import { GoogleGenAI } from '@google/genai';
import { checkBranchLimit, checkUserLimit, checkProductLimit, getPlanDefinition } from './src/utils/planLimits';

// Load Firebase project config for cryptographic ID token verification
let firebaseProjectConfig: { projectId?: string; firestoreDatabaseId?: string } = {};
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  firebaseProjectConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
} catch (err) {
  console.warn('[Yaa POS Server] Could not load firebase-applet-config.json for token verification');
}

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseProjectConfig.projectId || '';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || firebaseProjectConfig.firestoreDatabaseId || '(default)';

// Google securetoken public X.509 certificate cache
let cachedCerts: { certs: Record<string, string>; expiresAt: number } = { certs: {}, expiresAt: 0 };

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < cachedCerts.expiresAt && Object.keys(cachedCerts.certs).length > 0) {
    return cachedCerts.certs;
  }
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase public keys: ${res.status}`);
  }
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = match ? Number(match[1]) : 3600;
  cachedCerts = { certs, expiresAt: now + maxAgeSec * 1000 };
  return certs;
}

interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

function base64UrlDecode(str: string): Buffer {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken | null> {
  if (!FIREBASE_PROJECT_ID) return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;

    const certs = await getGooglePublicCerts();
    const pem = certs[header.kid];
    if (!pem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const sig = base64UrlDecode(parts[2]);
    if (!verifier.verify(pem, sig)) return null;

    return {
      uid: payload.sub,
      email: typeof payload.email === 'string' ? payload.email.toLowerCase().trim() : undefined,
      emailVerified: Boolean(payload.email_verified)
    };
  } catch {
    return null;
  }
}

// Verify if an authenticated operator belongs to the requested tenant owner using their own Firebase ID token
async function verifyOperatorTenantAccess(idToken: string, operatorEmail: string, targetOwnerId: string): Promise<boolean> {
  if (!FIREBASE_PROJECT_ID || !operatorEmail || !/^[a-zA-Z0-9_\-]+$/.test(targetOwnerId)) {
    return false;
  }
  try {
    const encodedDoc = encodeURIComponent(operatorEmail.toLowerCase());
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/operators/${encodedDoc}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!res.ok) return false;
    const data = (await res.json()) as any;
    const fields = data?.fields;
    if (!fields) return false;
    const ownerId = fields.ownerId?.stringValue;
    const status = fields.status?.stringValue;
    return ownerId === targetOwnerId && status === 'active';
  } catch {
    return false;
  }
}

// Scrypt password hashing with per-user random salt and timing-safe comparison
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt:')) {
    const [, salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }
  // Legacy SHA-256 fallback for existing db.json records
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
  const a = Buffer.from(legacyHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Initialize Gemini client if API key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
  console.warn('GEMINI_API_KEY environment variable is not defined. AI Assistant features will be disabled or fallback to mock.');
}

process.on('uncaughtException', (err) => {
  console.error('[Yaa POS Server uncaughtException]:', err);
});
process.on('unhandledRejection', (reason, _promise) => {
  console.error('[Yaa POS Server unhandledRejection]:', reason);
});

async function startServer() {
  await db.initDb();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Harden Express behind reverse proxy (Hostinger / Cloud Run)
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers (compatible with AI Studio iframe preview and POS camera barcode scanner)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    next();
  });

  // Strict CORS policy for API endpoints
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers.host;
      const allowedOrigins = new Set<string>();
      if (process.env.APP_URL) {
        try { allowedOrigins.add(new URL(process.env.APP_URL).origin); } catch {}
      }
      if (host) {
        allowedOrigins.add(`https://${host}`);
        allowedOrigins.add(`http://${host}`);
      }
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isAllowed = isLocal || allowedOrigins.has(origin);
      if (!isAllowed) {
        return res.status(403).json({ error: 'Origen no permitido por la política CORS.' });
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
    }
    next();
  });

  // Lightweight in-memory rate limiter for auth and AI routes
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  function createRateLimiter(maxRequests: number, windowMs: number) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const key = `${req.ip || 'unknown'}:${req.path}`;
      const now = Date.now();
      const entry = rateBuckets.get(key);
      if (!entry || now > entry.resetAt) {
        rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }
      entry.count += 1;
      if (entry.count > maxRequests) {
        return res.status(429).json({ error: 'Demasiadas solicitudes. Intente nuevamente en unos minutos.' });
      }
      next();
    };
  }
  const authRateLimiter = createRateLimiter(25, 15 * 60 * 1000);
  const aiRateLimiter = createRateLimiter(30, 60 * 1000);

  // Set limits for JSON body payloads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Session storage with TTL: token -> { userId, expiresAt }
  const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  const sessions = new Map<string, { userId: string; expiresAt: number }>();

  function isPlainObject(val: unknown): val is Record<string, any> {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
  }

  // Security Auth Middleware: enforces valid in-memory session OR cryptographically verified Firebase ID Token
  async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
    }
    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'No autorizado. Token inválido.' });
    }

    // 1. Check local server session store
    const session = sessions.get(token);
    if (session) {
      if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Sesión expirada. Inicie sesión nuevamente.' });
      }
      (req as any).userId = session.userId;
      return next();
    }

    // 2. Cryptographically verify Firebase ID Token JWT (never trust raw UID strings)
    const decoded = await verifyFirebaseIdToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Token de autenticación inválido o expirado.' });
    }

    const requestedTenantId = typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'].trim() : '';
    if (requestedTenantId && requestedTenantId !== decoded.uid) {
      const isValidOp = decoded.email
        ? await verifyOperatorTenantAccess(token, decoded.email, requestedTenantId)
        : false;
      if (!isValidOp) {
        return res.status(403).json({ error: 'Acceso denegado al espacio de trabajo solicitado.' });
      }
      (req as any).userId = requestedTenantId;
      (req as any).actorUid = decoded.uid;
    } else {
      (req as any).userId = decoded.uid;
      (req as any).actorUid = decoded.uid;
    }
    next();
  }

  // --- API ROUTES ---

  // Auth Endpoints
  app.post('/api/auth/register', authRateLimiter, async (req, res) => {
    const { email, name, password } = req.body || {};
    if (typeof email !== 'string' || typeof name !== 'string' || typeof password !== 'string' || !email.trim() || !name.trim() || password.length < 6) {
      return res.status(400).json({ error: 'Correo, nombre y contraseña (mínimo 6 caracteres) son requeridos' });
    }

    try {
      const existing = await db.getUserByEmail(email.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      }

      const passwordHash = hashPassword(password);
      const user = await db.createUser(email.trim().toLowerCase(), name.trim(), passwordHash);

      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });

      res.status(201).json({ token, user });
    } catch (err: any) {
      console.error('[Register Error]:', err);
      res.status(500).json({ error: 'Error al registrar el usuario' });
    }
  });

  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    try {
      let safeUser: any = null;
      let targetUserId = '';

      const user = await db.getUserByEmail(email.trim().toLowerCase());
      if (user) {
        if (!verifyPassword(password, user.passwordHash)) {
          return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        targetUserId = user.id;
        const { passwordHash: _, ...rest } = user;
        safeUser = rest;
      } else {
        // Check if user is an operator
        const allUsers = await db.getUsers();
        let foundOp: any = null;
        let ownerId = '';
        for (const u of allUsers) {
          const ops = await db.getOperators(u.id);
          const match = ops.find((o: any) => (o.email || '').toLowerCase() === email.trim().toLowerCase());
          if (match) {
            foundOp = match;
            ownerId = u.id;
            break;
          }
        }
        if (!foundOp || !foundOp.passwordHash || !verifyPassword(password, foundOp.passwordHash)) {
          return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        if (foundOp.status !== 'active') {
          return res.status(403).json({ error: 'Su cuenta de operador ha sido desactivada por el administrador.' });
        }
        targetUserId = ownerId;
        const { passwordHash: _, ...rest } = foundOp;
        safeUser = { ...rest, id: ownerId, isOperator: true, operatorId: foundOp.id };
      }

      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { userId: targetUserId, expiresAt: Date.now() + SESSION_TTL_MS });
      res.json({ token, user: safeUser });
    } catch (err: any) {
      console.error('[Login Error]:', err);
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      sessions.delete(token);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth, async (req: any, res) => {
    const user = await db.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // Products CRUD
  app.get('/api/products', requireAuth, async (req: any, res) => {
    const items = await db.getProducts(req.userId);
    res.json(items);
  });

  app.post('/api/products', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const product = req.body;
    const currentProducts = await db.getProducts(req.userId);
    const isNew = !product.id || !currentProducts.some(p => p.id === product.id);
    if (isNew) {
      const userLic = await db.getLicense(req.userId);
      const prodCheck = checkProductLimit(currentProducts.length, userLic.planType);
      if (!prodCheck.allowed) {
        return res.status(403).json({ error: prodCheck.message });
      }
    }
    if (!product.id) {
      product.id = crypto.randomUUID();
    }
    const saved = await db.saveProduct(req.userId, product);
    res.json(saved);
  });

  app.delete('/api/products/:id', requireAuth, async (req: any, res) => {
    const success = await db.deleteProduct(req.userId, req.params.id);
    res.json({ success });
  });

  // Clients CRUD
  app.get('/api/clients', requireAuth, async (req: any, res) => {
    const items = await db.getClients(req.userId);
    res.json(items);
  });

  app.post('/api/clients', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const client = req.body;
    if (!client.id) {
      client.id = crypto.randomUUID();
    }
    const saved = await db.saveClient(req.userId, client);
    res.json(saved);
  });

  app.delete('/api/clients/:id', requireAuth, async (req: any, res) => {
    const success = await db.deleteClient(req.userId, req.params.id);
    res.json({ success });
  });

  // Providers CRUD
  app.get('/api/providers', requireAuth, async (req: any, res) => {
    const items = await db.getProviders(req.userId);
    res.json(items);
  });

  app.post('/api/providers', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const provider = req.body;
    if (!provider.id) {
      provider.id = crypto.randomUUID();
    }
    const saved = await db.saveProvider(req.userId, provider);
    res.json(saved);
  });

  app.delete('/api/providers/:id', requireAuth, async (req: any, res) => {
    const success = await db.deleteProvider(req.userId, req.params.id);
    res.json({ success });
  });

  // Sales (POS)
  app.get('/api/sales', requireAuth, async (req: any, res) => {
    const items = await db.getSales(req.userId);
    res.json(items);
  });

  app.post('/api/sales', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const sale = req.body;
    if (!sale.id) {
      sale.id = crypto.randomUUID();
    }
    const saved = await db.saveSale(req.userId, sale);
    res.json(saved);
  });

  // Purchases
  app.get('/api/purchases', requireAuth, async (req: any, res) => {
    const items = await db.getPurchases(req.userId);
    res.json(items);
  });

  app.post('/api/purchases', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const purchase = req.body;
    if (!purchase.id) {
      purchase.id = crypto.randomUUID();
    }
    const saved = await db.savePurchase(req.userId, purchase);
    res.json(saved);
  });

  // Expenses CRUD
  app.get('/api/expenses', requireAuth, async (req: any, res) => {
    const items = await db.getExpenses(req.userId);
    res.json(items);
  });

  app.post('/api/expenses', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const expense = req.body;
    if (!expense.id) {
      expense.id = crypto.randomUUID();
    }
    const saved = await db.saveExpense(req.userId, expense);
    res.json(saved);
  });

  app.delete('/api/expenses/:id', requireAuth, async (req: any, res) => {
    const success = await db.deleteExpense(req.userId, req.params.id);
    res.json({ success });
  });

  // Shifts (Open/Close Cash Register)
  app.get('/api/shifts', requireAuth, async (req: any, res) => {
    const items = await db.getShifts(req.userId);
    res.json(items);
  });

  app.post('/api/shifts', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const shift = req.body;
    if (!shift.id) {
      shift.id = crypto.randomUUID();
    }
    const saved = await db.saveShift(req.userId, shift);
    res.json(saved);
  });

  // Config Endpoints
  app.get('/api/config', requireAuth, async (req: any, res) => {
    const config = await db.getConfig(req.userId);
    res.json(config);
  });

  app.post('/api/config', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const currentConfig = await db.getConfig(req.userId);
    const prevBranches = currentConfig.branches || [];
    const newBranches = req.body.branches;
    if (Array.isArray(newBranches) && newBranches.length > prevBranches.length) {
      const userLic = await db.getLicense(req.userId);
      const branchCheck = checkBranchLimit(prevBranches.length, userLic.planType);
      if (!branchCheck.allowed) {
        return res.status(403).json({ error: branchCheck.message });
      }
    }
    const saved = await db.saveConfig(req.userId, req.body);
    res.json(saved);
  });

  // Operators CRUD with User Limit Enforced
  app.get('/api/operators', requireAuth, async (req: any, res) => {
    const items = await db.getOperators(req.userId);
    res.json(items);
  });

  app.post('/api/operators', requireAuth, async (req: any, res) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'Cuerpo de solicitud inválido' });
    }
    const op = req.body;
    const currentOps = await db.getOperators(req.userId);
    const isNew = !op.id || !currentOps.some(o => o.id === op.id || (o.email && o.email.toLowerCase() === (op.email || '').toLowerCase()));
    if (isNew) {
      const userLic = await db.getLicense(req.userId);
      const totalUsers = currentOps.length + 1; // 1 owner + operators
      const userCheck = checkUserLimit(totalUsers, userLic.planType);
      if (!userCheck.allowed) {
        return res.status(403).json({ error: userCheck.message });
      }
    }
    if (!op.id) op.id = crypto.randomUUID();
    if (op.password) {
      op.passwordHash = hashPassword(String(op.password));
      delete op.password;
    }
    op.passwordProtected = true;
    const saved = await db.saveOperator(req.userId, op);
    const { passwordHash: _, ...safeSaved } = saved;
    res.json(safeSaved);
  });

  app.delete('/api/operators/:id', requireAuth, async (req: any, res) => {
    const success = await db.deleteOperator(req.userId, req.params.id);
    res.json({ success });
  });

  // License & Plan Status Endpoint
  app.get('/api/license', requireAuth, async (req: any, res) => {
    const license = await db.getLicense(req.userId);
    const plan = getPlanDefinition(license.planType);
    const currentConfig = await db.getConfig(req.userId);
    const branches = currentConfig.branches || [];
    const operators = await db.getOperators(req.userId);
    const products = await db.getProducts(req.userId);
    res.json({
      license,
      plan,
      usage: {
        branches: branches.length,
        users: operators.length + 1,
        products: products.length
      },
      limits: {
        maxBranches: plan.maxBranches,
        maxUsers: plan.maxUsers,
        maxProducts: plan.maxProducts
      }
    });
  });

  // Change Plan Endpoint (validates allowed plan names)
  app.post('/api/license/change-plan', requireAuth, async (req: any, res) => {
    const { planType } = req.body || {};
    if (typeof planType !== 'string' || !planType.trim()) {
      return res.status(400).json({ error: 'planType es requerido' });
    }
    const license = await db.getLicense(req.userId);
    const newPlan = getPlanDefinition(planType.trim());
    const updatedLicense = {
      ...license,
      planType: newPlan.name,
      maxUsers: newPlan.maxUsers,
      maxBranches: newPlan.maxBranches
    };
    await db.saveLicense(req.userId, updatedLicense);
    res.json({ success: true, license: updatedLicense, plan: newPlan });
  });

  // --- SECURE FILE MANAGEMENT ENDPOINTS ---

  // Get file list metadata
  app.get('/api/files', requireAuth, async (req: any, res) => {
    const items = await db.getFiles(req.userId);
    res.json(items);
  });

  // Upload file as Base64 JSON
  app.post('/api/files', requireAuth, async (req: any, res) => {
    const { name, mimeType, base64 } = req.body || {};
    if (typeof name !== 'string' || typeof mimeType !== 'string' || typeof base64 !== 'string' || !name.trim() || !base64) {
      return res.status(400).json({ error: 'Faltan parámetros de archivo (name, mimeType, base64)' });
    }

    try {
      const saved = await db.saveFile(req.userId, name, mimeType, base64);
      res.json(saved);
    } catch (err: any) {
      console.error('[File Save Error]:', err);
      res.status(500).json({ error: 'Error al guardar el archivo en el servidor' });
    }
  });

  // Delete file
  app.delete('/api/files/:id', requireAuth, async (req: any, res) => {
    const success = await db.deleteFile(req.userId, req.params.id);
    res.json({ success });
  });

  // Secure File Download/Stream - enforcing tenant isolation and path traversal protection
  app.get('/api/files/download/:userId/:filename', requireAuth, async (req: any, res) => {
    if (req.userId !== req.params.userId) {
      return res.status(403).json({ error: 'Acceso denegado. No puede acceder a los archivos de otros usuarios.' });
    }

    const safeUserId = path.basename(String(req.params.userId));
    const safeFilename = path.basename(String(req.params.filename));
    if (safeUserId !== req.params.userId || safeFilename !== req.params.filename || !/^[a-zA-Z0-9_.\-@]+$/.test(safeUserId)) {
      return res.status(400).json({ error: 'Parámetros de archivo inválidos' });
    }

    const userDir = path.resolve(db.UPLOADS_DIR, safeUserId);
    const filePath = path.resolve(userDir, safeFilename);
    if (!filePath.startsWith(userDir + path.sep)) {
      return res.status(403).json({ error: 'Ruta de archivo no permitida' });
    }

    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'Archivo no encontrado' });
      }
    });
  });

  // --- SMART AI ASSISTANT ENDPOINT (GEMINI) ---
  app.post('/api/ai/chat', requireAuth, aiRateLimiter, async (req: any, res) => {
    const { prompt } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) {
      return res.status(400).json({ error: 'Prompt inválido o demasiado largo' });
    }

    try {
      // Gather relevant data to feed to Gemini context, preferring client-sent payload first
      const products = Array.isArray(req.body.products) ? req.body.products : await db.getProducts(req.userId);
      const sales = Array.isArray(req.body.sales) ? req.body.sales : await db.getSales(req.userId);
      const expenses = Array.isArray(req.body.expenses) ? req.body.expenses : await db.getExpenses(req.userId);
      const config = (req.body.config && typeof req.body.config === 'object') ? req.body.config : await db.getConfig(req.userId);

      // Create a summary of current store status for the AI
      const lowStockProducts = products.filter((p: any) => Number(p.stock) <= Number(p.minStock));
      const todaySales = sales.filter((s: any) => {
        const saleDate = new Date(s.date);
        const today = new Date();
        return saleDate.toDateString() === today.toDateString();
      });

      const todaySalesTotal = todaySales.reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0);
      const totalInventoryVal = products.reduce((acc: number, p: any) => acc + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0);
      const totalInventoryCost = products.reduce((acc: number, p: any) => acc + ((Number(p.stock) || 0) * (Number(p.cost) || 0)), 0);

      // Expiring products logic
      const now = Date.now();
      const alertDays = Number(config.alertDaysBeforeExpiration) || 30;
      const warningLimit = now + alertDays * 24 * 3600 * 1000;
      const expiringSoon = products.filter((p: any) => {
        if (!p.expirationDate) return false;
        const exp = new Date(p.expirationDate).getTime();
        return exp <= warningLimit && exp > now;
      });

      const currency = String(config.currency || 'Q');
      const storeName = String(config.storeName || 'Yaa POS');
      const businessType = String(config.businessType || 'general');

      const systemInstruction = `
Eres un asistente de Inteligencia Artificial experto en gestión de negocios y finanzas, integrado dentro del sistema Yaa POS, un Punto de Venta profesional para ferreterías, farmacias y librerías.
Tu objetivo es ayudar al comerciante a analizar sus datos de ventas, inventario, gastos, vencimientos de productos y brindarle consejos estratégicos.

Aquí están los datos actuales del negocio de este comerciante para que des respuestas precisas y personalizadas (no inventes datos que contradigan esto):
- Tipo de Negocio: ${businessType === 'hardware' ? 'Ferretería' : businessType === 'pharmacy' ? 'Farmacia' : businessType === 'bookstore' ? 'Librería' : 'General/Varios'}
- Nombre de la Tienda: ${storeName}
- Moneda activa: ${currency}
- Total de productos registrados: ${products.length}
- Valor de venta total del inventario: ${currency}${totalInventoryVal.toFixed(2)}
- Costo total de adquisición del inventario: ${currency}${totalInventoryCost.toFixed(2)}
- Productos con stock crítico (bajo el mínimo): ${lowStockProducts.slice(0, 50).map((p: any) => `${p.name} (Stock: ${p.stock}/${p.minStock} ${p.unit || ''})`).join(', ') || 'Ninguno'}
- Productos próximos a vencer (en los siguientes ${alertDays} días): ${expiringSoon.slice(0, 50).map((p: any) => `${p.name} (Vence: ${p.expirationDate})`).join(', ') || 'Ninguno'}
- Ventas registradas hoy: ${todaySales.length} ventas con un total acumulado de ${currency}${todaySalesTotal.toFixed(2)}
- Gastos registrados: ${expenses.length} gastos totales.

Por favor, responde de manera profesional, clara, amigable y estructurada en idioma español. Da ideas accionables para aumentar ventas, optimizar inventario o reducir gastos según lo solicitado.
Si el usuario hace preguntas generales o te pide analizar, usa estos datos reales para impresionarlo.
`;

      if (ai) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt.trim(),
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          }
        });

        res.json({ reply: response.text });
      } else {
        // Safe fallback in case API key is missing during local developer preview
        res.json({
          reply: `[MODO PREVIA] Hola, soy tu asistente de Yaa POS. (Para activar la IA real en producción, configura GEMINI_API_KEY en los secretos de la plataforma).
          
Analizando tus datos locales:
- Tu negocio está configurado como: **${businessType.toUpperCase()}**.
- Tienes **${products.length} productos** en catálogo.
- Hay **${lowStockProducts.length} productos con stock bajo el mínimo** (ej: ${lowStockProducts[0]?.name || 'Ninguno'}).
- Tienes **${expiringSoon.length} productos cercanos a vencer** (ej: ${expiringSoon[0]?.name || 'Ninguno'}).
- Hoy has realizado **${todaySales.length} ventas** sumando **${currency}${todaySalesTotal.toFixed(2)}**.

*Recomendación del sistema:* Mantén un control estricto sobre tus productos críticos para no perder ventas y revisa la sección de compras para reabastecerte.`
        });
      }
    } catch (err: any) {
      console.error('[AI Chat Error]:', err);
      res.status(500).json({ error: 'Error al procesar la solicitud con el Asistente de IA.' });
    }
  });

  // Safe JSON error handler for API requests (prevents stack trace leaks)
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON inválido en la solicitud' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'La solicitud excede el tamaño máximo permitido' });
    }
    console.error('[API Error]:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Yaa POS Server] running on port ${PORT}`);
  });
}

startServer();
