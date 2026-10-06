import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import * as db from './src/server/db';
import { GoogleGenAI } from '@google/genai';

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
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Yaa POS Server unhandledRejection]:', reason);
});

async function startServer() {
  await db.initDb();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Set limits for file uploading via base64 JSON
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Session storage: token -> userId (in-memory for maximum simplicity and zero dependencies)
  const sessions = new Map<string, string>();

  // Security Auth Middleware
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
    }
    const token = authHeader.substring(7);
    let userId = sessions.get(token);
    if (!userId) {
      // If not in standard in-memory sessions, treat token as the Firebase UID directly
      userId = token;
    }
    (req as any).userId = userId;
    next();
  }

  // --- API ROUTES ---

  // Auth Endpoints
  app.post('/api/auth/register', async (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      }

      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      const user = await db.createUser(email, name, passwordHash);

      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, user.id);

      res.status(201).json({ token, user });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al registrar el usuario' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }

    try {
      const user = await db.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const hash = crypto.createHash('sha256').update(password).digest('hex');
      if (user.passwordHash !== hash) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, user.id);

      const { passwordHash: _, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al iniciar sesión' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      sessions.delete(token);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const token = authHeader.substring(7);
    const userId = sessions.get(token);
    if (!userId) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    const user = await db.getUserById(userId);
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
    const product = req.body;
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
    const saved = await db.saveConfig(req.userId, req.body);
    res.json(saved);
  });

  // --- SECURE FILE MANAGEMENT ENDPOINTS ---

  // Get file list metadata
  app.get('/api/files', requireAuth, async (req: any, res) => {
    const items = await db.getFiles(req.userId);
    res.json(items);
  });

  // Upload file as Base64 JSON
  app.post('/api/files', requireAuth, async (req: any, res) => {
    const { name, mimeType, base64 } = req.body;
    if (!name || !mimeType || !base64) {
      return res.status(400).json({ error: 'Faltan parámetros de archivo (name, mimeType, base64)' });
    }

    try {
      const saved = await db.saveFile(req.userId, name, mimeType, base64);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error al guardar el archivo en el servidor' });
    }
  });

  // Delete file
  app.delete('/api/files/:id', requireAuth, async (req: any, res) => {
    const success = await db.deleteFile(req.userId, req.params.id);
    res.json({ success });
  });

  // Secure File Download/Stream - verifying that requested user matches the logged-in user!
  app.get('/api/files/download/:userId/:filename', requireAuth, async (req: any, res) => {
    // SECURITY ENFORCEMENT: Enforce that the authenticated user can only download their own files!
    if (req.userId !== req.params.userId) {
      return res.status(403).json({ error: 'Acceso denegado. No puede acceder a los archivos de otros usuarios.' });
    }

    const filePath = path.join(db.UPLOADS_DIR, req.params.userId, req.params.filename);
    try {
      res.sendFile(filePath);
    } catch (err) {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  });

  // --- SMART AI ASSISTANT ENDPOINT (GEMINI) ---
  app.post('/api/ai/chat', requireAuth, async (req: any, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt es requerido' });
    }

    try {
      // Gather relevant data to feed to Gemini context, preferring client-sent payload first
      const products = req.body.products || await db.getProducts(req.userId);
      const sales = req.body.sales || await db.getSales(req.userId);
      const expenses = req.body.expenses || await db.getExpenses(req.userId);
      const config = req.body.config || await db.getConfig(req.userId);

      // Create a summary of current store status for the AI
      const lowStockProducts = products.filter(p => p.stock <= p.minStock);
      const todaySales = sales.filter(s => {
        const saleDate = new Date(s.date);
        const today = new Date();
        return saleDate.toDateString() === today.toDateString();
      });

      const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.total, 0);
      const totalInventoryVal = products.reduce((acc, p) => acc + (p.stock * p.price), 0);
      const totalInventoryCost = products.reduce((acc, p) => acc + (p.stock * p.cost), 0);

      // Expiring products logic
      const now = Date.now();
      const alertDays = config.alertDaysBeforeExpiration || 30;
      const warningLimit = now + alertDays * 24 * 3600 * 1000;
      const expiringSoon = products.filter(p => {
        if (!p.expirationDate) return false;
        const exp = new Date(p.expirationDate).getTime();
        return exp <= warningLimit && exp > now;
      });

      const systemInstruction = `
Eres un asistente de Inteligencia Artificial experto en gestión de negocios y finanzas, integrado dentro del sistema Yaa POS, un Punto de Venta profesional para ferreterías, farmacias y librerías.
Tu objetivo es ayudar al comerciante a analizar sus datos de ventas, inventario, gastos, vencimientos de productos y brindarle consejos estratégicos.

Aquí están los datos actuales del negocio de este comerciante para que des respuestas precisas y personalizadas (no inventes datos que contradigan esto):
- Tipo de Negocio: ${config.businessType === 'hardware' ? 'Ferretería' : config.businessType === 'pharmacy' ? 'Farmacia' : config.businessType === 'bookstore' ? 'Librería' : 'General/Varios'}
- Nombre de la Tienda: ${config.storeName}
- Moneda activa: ${config.currency}
- Total de productos registrados: ${products.length}
- Valor de venta total del inventario: ${config.currency}${totalInventoryVal.toFixed(2)}
- Costo total de adquisición del inventario: ${config.currency}${totalInventoryCost.toFixed(2)}
- Productos con stock crítico (bajo el mínimo): ${lowStockProducts.map(p => `${p.name} (Stock: ${p.stock}/${p.minStock} ${p.unit})`).join(', ') || 'Ninguno'}
- Productos próximos a vencer (en los siguientes ${alertDays} días): ${expiringSoon.map(p => `${p.name} (Vence: ${p.expirationDate})`).join(', ') || 'Ninguno'}
- Ventas registradas hoy: ${todaySales.length} ventas con un total acumulado de ${config.currency}${todaySalesTotal.toFixed(2)}
- Gastos registrados: ${expenses.length} gastos totales.

Por favor, responde de manera profesional, clara, amigable y estructurada en idioma español. Da ideas accionables para aumentar ventas, optimizar inventario o reducir gastos según lo solicitado.
Si el usuario hace preguntas generales o te pide analizar, usa estos datos reales para impresionarlo.
`;

      if (ai) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
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
- Tu negocio está configurado como: **${config.businessType.toUpperCase()}**.
- Tienes **${products.length} productos** en catálogo.
- Hay **${lowStockProducts.length} productos con stock bajo el mínimo** (ej: ${lowStockProducts[0]?.name || 'Ninguno'}).
- Tienes **${expiringSoon.length} productos cercanos a vencer** (ej: ${expiringSoon[0]?.name || 'Ninguno'}).
- Hoy has realizado **${todaySales.length} ventas** sumando **${config.currency}${todaySalesTotal.toFixed(2)}**.

*Recomendación del sistema:* Mantén un control estricto sobre tus productos críticos para no perder ventas y revisa la sección de compras para reabastecerte.`
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Error al procesar la solicitud con el Asistente de IA: ' + err.message });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Yaa POS Server] running on port ${PORT}`);
  });
}

startServer();
