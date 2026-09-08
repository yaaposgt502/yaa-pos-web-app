import React, { useState, useEffect } from 'react';
import * as api from './api';
import { Product, Client, Provider, Sale, Purchase, Expense, Shift, UserFile, AppConfig, User } from './types';

// Sub-components
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Purchasing from './components/Purchasing';
import Expirations from './components/Expirations';
import Complementos from './components/Complementos';
import ClientsProviders from './components/ClientsProviders';
import Expenses from './components/Expenses';
import CashRegister from './components/CashRegister';
import DailyReports from './components/DailyReports';
import { SalesLedger } from './components/SalesLedger';
import Settings from './components/Settings';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';

// Icons
import { 
  LayoutDashboard, 
  LayoutGrid,
  ShoppingCart, 
  Package, 
  FileSpreadsheet,
  ShoppingBag, 
  Calendar, 
  Sparkles, 
  Users, 
  TrendingDown, 
  Inbox, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut,
  Power,
  ArrowLeft,
  User as UserIcon,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  Truck,
  CreditCard,
  Check,
  X,
  Shield,
  Menu,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';

const defaultAppConfig: AppConfig = {
  storeName: 'Yaa POS',
  currency: 'Q',
  alertDaysBeforeExpiration: 30,
  businessType: 'general',
  nit: '',
  razonSocial: '',
  email: '',
  address: '',
  phone: '',
  facturaSeries: 'F001',
  facturaCorrelativo: '000001',
  boletaSeries: 'B001',
  boletaCorrelativo: '000001',
  notaVentaSeries: 'NV01',
  notaVentaCorrelativo: '000001',
  ticketHeader: '¡Gracias por su compra!',
  ticketFooter: 'Conserve su comprobante. Vuelva pronto.',
  showLogoInTicket: true,
  showOperatorInTicket: true,
  ticketFontSize: 'sm',
  ticketPaperSize: '80mm',
  facturaPaperSize: '80mm',
  comprobantePaperSize: '80mm',
  certificateName: '',
  certificatePassword: '',
  certificateExpiration: '',
  felEnabled: false,
  felCertifierName: '',
  felApiKey: ''
};

const calculateDaysRemaining = (expirationDate: string): number => {
  if (!expirationDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  exp.setHours(0, 0, 0, 0);
  const diffTime = exp.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

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

export default function App() {
  const [token, setToken] = useState<string | null>(api.getToken());
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'admin' | 'pos'>('admin');

  // Core collections
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [config, setConfig] = useState<AppConfig>(defaultAppConfig);

  // Loading & UI states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  // Subscription / License Suspension state
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [userLicense, setUserLicense] = useState<any>(null);
  const [showSuspensionModal, setShowSuspensionModal] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Internet connectivity state for PWA offline detection
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingWrites, setPendingWrites] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  // Auto-validate session on startup
  useEffect(() => {
    async function checkSession() {
      if (token) {
        try {
          const profile = await api.getMe();
          if (profile.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
            const license = await api.getUserLicense(profile.id);
            const val = api.performValidation(license, profile);
            if (val.isBlocked) {
              setAuthError(val.reason);
              try {
                await api.logoutUser();
              } catch {
                api.setToken(null);
                setToken(null);
                setUser(null);
              }
              setIsInitializing(false);
              return;
            }
          }
          setUser(profile);
          await loadAllData();
        } catch (err: any) {
          if (err instanceof Error) {
            setAuthError(err.message);
          }
          try {
            await api.logoutUser();
          } catch {
            api.setToken(null);
            setToken(null);
            setUser(null);
          }
        }
      }
      setIsInitializing(false);
    }
    checkSession();
  }, [token]);

  // Handle session expiration dispatch
  useEffect(() => {
    const handleLogoutEvent = () => {
      setToken(null);
      setUser(null);
      setActiveTab('dashboard');
    };
    window.addEventListener('yaa_pos_logout', handleLogoutEvent);
    return () => window.removeEventListener('yaa_pos_logout', handleLogoutEvent);
  }, []);

  // Redirect operators if they end up on a disabled tab
  useEffect(() => {
    if (user?.isOperator && user.disabledTabs && user.disabledTabs.includes(activeTab)) {
      const firstAvailableTab = sidebarTabs.find(tab => !user.disabledTabs?.includes(tab.id));
      if (firstAvailableTab) {
        setActiveTab(firstAvailableTab.id);
      }
    }
  }, [user, activeTab]);

  // Monitor user's subscription and license suspension status
  useEffect(() => {
    if (user && user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      const userId = user.id;
      let latestLicense: any = null;
      let latestUser: any = user;

      const runValidation = async () => {
        const val = api.performValidation(latestLicense, latestUser);
        setIsSuspended(val.isBlocked);
        setSuspensionReason(val.reason);
        if (val.isBlocked) {
          setAuthError(val.reason);
          try {
            await api.logoutUser();
          } catch {
            api.setToken(null);
            setToken(null);
            setUser(null);
          }
          setActiveTab('dashboard');
        }
      };

      // Subscribe to user license
      const unsubscribeLicense = api.subscribeUserLicense(userId, (cloudLicense) => {
        if (cloudLicense) {
          setUserLicense(cloudLicense);
          latestLicense = cloudLicense;
          runValidation();
          
          // Sync with local storage
          const saved = localStorage.getItem('yaa_pos_licenses');
          let currentList: any[] = [];
          if (saved) {
            try { currentList = JSON.parse(saved); } catch {}
          }
          const idx = currentList.findIndex((l: any) => l.userId === userId);
          if (idx >= 0) {
            currentList[idx] = cloudLicense;
          } else {
            currentList.push(cloudLicense);
          }
          localStorage.setItem('yaa_pos_licenses', JSON.stringify(currentList));
          window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
        }
      });

      // Subscribe to user profile
      const unsubscribeProfile = api.subscribeUserProfile(userId, (cloudUser) => {
        if (cloudUser) {
          latestUser = cloudUser;
          runValidation();
        }
      });

      // Local storage listener fallback
      const handleLicenseChange = () => {
        const saved = localStorage.getItem('yaa_pos_licenses');
        if (saved) {
          try {
            const licenses = JSON.parse(saved);
            const myLicense = licenses.find((l: any) => l.userId === userId);
            if (myLicense) {
              setUserLicense(myLicense);
              latestLicense = myLicense;
              runValidation();
            }
          } catch (e) {
            console.error(e);
          }
        }
      };

      window.addEventListener('storage', handleLicenseChange);
      window.addEventListener('yaa_pos_licenses_updated', handleLicenseChange);

      return () => {
        unsubscribeLicense();
        unsubscribeProfile();
        window.removeEventListener('storage', handleLicenseChange);
        window.removeEventListener('yaa_pos_licenses_updated', handleLicenseChange);
      };
    } else {
      setIsSuspended(false);
      setUserLicense(null);
    }
  }, [user?.id]);

  // Handle simulating payment / reactivation
  const handleSimulatePayment = () => {
    if (!user) return;
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('🚨 ACCESO RESTRINGIDO: Solo el Administrador de Licencias con ID "uSEwpR9zZPWvekBQKdx1SMsrs7n1" tiene la potestad de restablecer licencias en Yaa POS. Su cuenta actual no tiene privilegios de facturación.');
      return;
    }
    const saved = localStorage.getItem('yaa_pos_licenses');
    if (saved) {
      try {
        const licenses = JSON.parse(saved);
        const updated = licenses.map((l: any) => {
          if (l.userId === user.id) {
            return {
              ...l,
              status: 'Activo'
            };
          }
          return l;
        });
        localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
        window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
        
        // Show beautiful temporary success toast
        setShowSuccessToast(true);
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 4000);
      } catch (e) {
        console.error('Error simulating payment:', e);
      }
    }
  };

  // Handle simulating suspension for testing
  const handleToggleSimulation = () => {
    if (!user) return;
    const saved = localStorage.getItem('yaa_pos_licenses');
    if (saved) {
      try {
        const licenses = JSON.parse(saved);
        
        // If they are currently suspended, they are trying to activate it. Verify admin permission.
        if (isSuspended && user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
          alert('🚨 ACCESO RESTRINGIDO: Solo el Administrador con ID "uSEwpR9zZPWvekBQKdx1SMsrs7n1" puede restablecer o activar licencias suspendidas. Por favor, inicie sesión con la cuenta administradora para reactivar.');
          return;
        }

        const updated = licenses.map((l: any) => {
          if (l.userId === user.id) {
            const nextStatus = l.status === 'Suspendida' ? 'Activo' : 'Suspendida';
            return {
              ...l,
              status: nextStatus
            };
          }
          return l;
        });
        localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
        window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
        
        if (!isSuspended) {
          setShowSuspensionModal(true);
        }
      } catch (e) {
        console.error('Error toggling license simulation:', e);
      }
    }
  };

  // 1. Real-time automatic synchronization of all collections when user is logged in
  useEffect(() => {
    if (!user || !token) {
      return;
    }

    setIsDataLoading(true);

    const unsubProducts = api.subscribeProducts((prods, meta) => {
      setProducts(prods);
      setIsDataLoading(false);
      setPendingWrites(prev => ({ ...prev, products: !!meta?.hasPendingWrites }));
    });

    const unsubClients = api.subscribeClients((clis, meta) => {
      setClients(clis);
      setPendingWrites(prev => ({ ...prev, clients: !!meta?.hasPendingWrites }));
    });

    const unsubProviders = api.subscribeProviders((provs, meta) => {
      setProviders(provs);
      setPendingWrites(prev => ({ ...prev, providers: !!meta?.hasPendingWrites }));
    });

    const unsubSales = api.subscribeSales((sls, meta) => {
      setSales(sls);
      setPendingWrites(prev => ({ ...prev, sales: !!meta?.hasPendingWrites }));
    });

    const unsubPurchases = api.subscribePurchases((purcs, meta) => {
      setPurchases(purcs);
      setPendingWrites(prev => ({ ...prev, purchases: !!meta?.hasPendingWrites }));
    });

    const unsubExpenses = api.subscribeExpenses((exps, meta) => {
      setExpenses(exps);
      setPendingWrites(prev => ({ ...prev, expenses: !!meta?.hasPendingWrites }));
    });

    const unsubShifts = api.subscribeShifts((sfts, meta) => {
      setShifts(sfts);
      setPendingWrites(prev => ({ ...prev, shifts: !!meta?.hasPendingWrites }));
    });

    const unsubFiles = api.subscribeFiles((fls, meta) => {
      setFiles(fls);
      setPendingWrites(prev => ({ ...prev, files: !!meta?.hasPendingWrites }));
    });

    const unsubConfig = api.subscribeConfig((cfg, meta) => {
      if (cfg) setConfig(cfg);
      setPendingWrites(prev => ({ ...prev, config: !!meta?.hasPendingWrites }));
    });

    return () => {
      unsubProducts();
      unsubClients();
      unsubProviders();
      unsubSales();
      unsubPurchases();
      unsubExpenses();
      unsubShifts();
      unsubFiles();
      unsubConfig();
    };
  }, [user?.id, token]);

  // 2. Synchronize authentication state across multiple browser tabs automatically
  useEffect(() => {
    const handleStorageAuthChange = (e: StorageEvent) => {
      if (e.key === 'yaa_pos_token') {
        const newToken = e.newValue;
        if (newToken !== token) {
          api.setToken(newToken);
          setToken(newToken);
          if (!newToken) {
            setUser(null);
          } else {
            api.getMe().then((profile) => {
              setUser(profile);
            }).catch(() => {
              api.setToken(null);
              setToken(null);
              setUser(null);
            });
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageAuthChange);
    return () => window.removeEventListener('storage', handleStorageAuthChange);
  }, [token]);

  // Fetch all collections from the backend (manual refresh fallback)
  async function loadAllData() {
    if (!user) return;
    setIsDataLoading(true);
    try {
      const [prods, clis, provs, sls, purcs, exps, sfts, fls, cfg] = await Promise.all([
        api.getProducts(),
        api.getClients(),
        api.getProviders(),
        api.getSales(),
        api.getPurchases(),
        api.getExpenses(),
        api.getShifts(),
        api.getFiles(),
        api.getConfig()
      ]);

      setProducts(prods);
      setClients(clis);
      setProviders(provs);
      setSales(sls);
      setPurchases(purcs);
      setExpenses(exps);
      setShifts(sfts);
      setFiles(fls);
      setConfig(cfg || defaultAppConfig);
    } catch (err) {
      console.error('Error on manual loadAllData refresh (active subscriptions still running):', err);
    } finally {
      setIsDataLoading(false);
    }
  }

  // --- AUTH ACTIONS ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsInitializing(true);

    try {
      let res;
      if (authMode === 'login') {
        res = await api.loginUser(authEmail, authPassword);
      } else {
        if (!authName) {
          setAuthError('Por favor complete su nombre');
          setIsInitializing(false);
          return;
        }
        res = await api.registerUser(authEmail, authName, authPassword);
      }

      // Live verification of user status and license before setting session state
      if (res.user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
        const license = await api.getUserLicense(res.user.id);
        const val = api.performValidation(license, res.user);
        if (val.isBlocked) {
          setAuthError(val.reason);
          try {
            await api.logoutUser();
          } catch {
            api.setToken(null);
            setToken(null);
            setUser(null);
          }
          setIsInitializing(false);
          return;
        }
      }

      setToken(res.token);
      setUser(res.user);
      setAuthPassword('');
      setAuthEmail('');
      setAuthName('');
    } catch (err: any) {
      setAuthError(err.message || 'Error de autenticación');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logoutUser();
    } finally {
      setToken(null);
      setUser(null);
      setProducts([]);
      setClients([]);
      setProviders([]);
      setSales([]);
      setPurchases([]);
      setExpenses([]);
      setShifts([]);
      setFiles([]);
      setConfig(defaultAppConfig);
      setActiveTab('dashboard');
      setViewMode('admin');
    }
  };

  // --- DELEGATED API CALLS ---
  const onSaveProduct = async (p: Product) => {
    const saved = await api.saveProduct(p);
    await loadAllData();
    return saved;
  };

  const onDeleteProduct = async (id: string) => {
    const res = await api.deleteProduct(id);
    await loadAllData();
    return res;
  };

  const onSaveClient = async (c: Client) => {
    const saved = await api.saveClient(c);
    await loadAllData();
    return saved;
  };

  const onDeleteClient = async (id: string) => {
    const res = await api.deleteClient(id);
    await loadAllData();
    return res;
  };

  const onSaveProvider = async (p: Provider) => {
    const saved = await api.saveProvider(p);
    await loadAllData();
    return saved;
  };

  const onDeleteProvider = async (id: string) => {
    const res = await api.deleteProvider(id);
    await loadAllData();
    return res;
  };

  const onSaveSale = async (s: Sale) => {
    // 1. Descontar stock
    for (const item of s.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const mult = item.selectedUnit === 'Blíster' 
          ? (product.unitsPerBlister && product.unitsPerBlister > 0 ? product.unitsPerBlister : 1) 
          : (item.selectedUnit === 'Caja' 
              ? (product.unitsPerBox && product.unitsPerBox > 0 ? product.unitsPerBox : 1) 
              : 1);
        const unitsToDeduct = item.quantity * mult;
        
        const lotesSum = (product.expirationDates || []).reduce((acc, r) => acc + (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)), 0);
        const currentStock = Math.max(product.stock || 0, lotesSum);
        const nextStock = Math.max(0, currentStock - unitsToDeduct);

        let updatedExpirationDates = product.expirationDates;
        if (updatedExpirationDates && updatedExpirationDates.length > 0) {
          let remainingDeduct = unitsToDeduct;
          // First attempt to deduct from matching selected batch
          updatedExpirationDates = updatedExpirationDates.map(r => {
            const batchName = r.batch || product.initialBatch || 'Lote 01';
            if (remainingDeduct > 0 && item.selectedLote && item.selectedLote.includes(batchName)) {
              const currentLoteStock = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
              const deduct = Math.min(currentLoteStock, remainingDeduct);
              remainingDeduct -= deduct;
              return { ...r, stock: currentLoteStock - deduct };
            }
            return r;
          });
          // Deduct remaining from any available lote
          if (remainingDeduct > 0) {
            updatedExpirationDates = updatedExpirationDates.map(r => {
              if (remainingDeduct <= 0) return r;
              const currentLoteStock = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
              const deduct = Math.min(currentLoteStock, remainingDeduct);
              remainingDeduct -= deduct;
              return { ...r, stock: currentLoteStock - deduct };
            });
          }

          // Eliminar automáticamente los lotes y fechas de vencimiento sin stock (stock <= 0) para no confundir en punto de venta
          updatedExpirationDates = updatedExpirationDates.filter(r => {
            const currentLoteStock = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
            return currentLoteStock > 0;
          });
        }

        const survivingLotes = (updatedExpirationDates && updatedExpirationDates.length > 0) ? updatedExpirationDates : undefined;
        const nextExpirationDate = survivingLotes && survivingLotes.length > 0 
          ? survivingLotes[0].date 
          : (nextStock > 0 ? product.expirationDate : undefined);
        const nextInitialBatch = survivingLotes && survivingLotes.length > 0 
          ? (survivingLotes[0].batch || product.initialBatch) 
          : product.initialBatch;

        await api.saveProduct({
          ...product,
          stock: nextStock,
          expirationDate: nextExpirationDate,
          initialBatch: nextInitialBatch,
          expirationDates: survivingLotes
        });
      }
    }

    // 2. Actualizar caja (shift activo)
    const activeShift = shifts.find(sh => sh.state === 'open');
    if (activeShift) {
      await api.saveShift({
        ...activeShift,
        salesTotal: (activeShift.salesTotal || 0) + s.total
      });
    }

    // 3. Actualizar historial de cliente (gastos, puntos, última compra)
    if (s.clientId && s.clientId !== 'general') {
      const client = clients.find(c => c.id === s.clientId);
      if (client) {
        const pointsEarned = Math.floor(s.total / 10);
        await api.saveClient({
          ...client,
          totalSpent: (client.totalSpent || 0) + s.total,
          loyaltyPoints: (client.loyaltyPoints || 0) + pointsEarned,
          lastPurchaseDate: new Date().toISOString().split('T')[0],
          balanceCredit: s.paymentMethod === 'credit' 
            ? (client.balanceCredit || 0) + s.total 
            : (client.balanceCredit || 0)
        });
      }
    }

    const saved = await api.saveSale(s);
    await loadAllData();
    return saved;
  };

  const onSavePurchase = async (pur: Purchase) => {
    // 1. Aumentar stock e ingresar costo, lote y vencimiento del producto si la compra está completada
    if (pur.status === 'completed') {
      const updatedProductsMap = new Map<string, Product>();

      for (const item of pur.items) {
        let product = updatedProductsMap.get(item.productId) || products.find(p => p.id === item.productId);
        
        if (!product) {
          product = products.find(p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        }

        if (!product) {
          const itemAny = item as any;
          const initialUnitPrice = item.pricePerUnit || itemAny.price || (item.cost ? Number((item.cost * 1.3).toFixed(2)) : 0);
          const newProd: Product = {
            id: item.productId && !item.productId.startsWith('NEW_') ? item.productId : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            code: itemAny.productCode || `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
            name: item.name,
            category: itemAny.productCategory || 'General',
            cost: item.cost || 0,
            price: initialUnitPrice,
            pricePerUnit: initialUnitPrice,
            pricePerBlister: item.pricePerBlister || 0,
            pricePerBox: item.pricePerBox || 0,
            stock: 0,
            minStock: 5,
            unit: 'Pza',
            expirationDate: item.expirationDate || '',
            initialBatch: item.lote || '00101',
            manageBatchAndExpiration: true,
            expirationDates: []
          };
          product = newProd;
        }

        const updatedProd = applyPurchaseItemToProduct(product, item);
        updatedProductsMap.set(updatedProd.id, updatedProd);
      }

      for (const updatedProd of updatedProductsMap.values()) {
        await api.saveProduct(updatedProd);
      }
    }

    // 2. Actualizar métricas del proveedor (compras totales, cuentas por pagar)
    if (pur.providerId) {
      const provider = providers.find(p => p.id === pur.providerId);
      if (provider) {
        const extraCredit = pur.paymentType === 'credit' ? pur.total : 0;
        await api.saveProvider({
          ...provider,
          totalPurchases: (provider.totalPurchases || 0) + pur.total,
          creditPending: (provider.creditPending || 0) + extraCredit
        });
      }
    }

    const saved = await api.savePurchase(pur);
    await loadAllData();
    return saved;
  };

  const onSaveExpense = async (e: Expense) => {
    // Descontar caja / registrar gasto en el turno activo
    const activeShift = shifts.find(sh => sh.state === 'open');
    if (activeShift) {
      await api.saveShift({
        ...activeShift,
        expensesTotal: (activeShift.expensesTotal || 0) + e.amount
      });
    }

    const saved = await api.saveExpense(e);
    await loadAllData();
    return saved;
  };

  const onDeleteExpense = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (expense) {
      const activeShift = shifts.find(sh => sh.state === 'open');
      if (activeShift) {
        await api.saveShift({
          ...activeShift,
          expensesTotal: Math.max(0, (activeShift.expensesTotal || 0) - expense.amount)
        });
      }
    }
    const res = await api.deleteExpense(id);
    await loadAllData();
    return res;
  };

  const onSaveShift = async (s: Shift) => {
    const saved = await api.saveShift(s);
    await loadAllData();
    return saved;
  };

  const onSaveConfig = async (cfg: AppConfig) => {
    const saved = await api.saveConfig(cfg);
    setConfig(saved);
    await loadAllData();
    return saved;
  };

  const onUploadFile = async (f: File) => {
    const saved = await api.uploadFile(f);
    await loadAllData();
    return saved;
  };

  const onDeleteFile = async (id: string) => {
    const res = await api.deleteFile(id);
    await loadAllData();
    return res;
  };

  const onAskAI = async (prompt: string) => {
    return api.askAI(prompt, products, sales, expenses, config);
  };

  // --- RENDER SECTIONS ---

  // Loading/Spin overlay
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-sm font-medium animate-pulse">Iniciando Yaa POS...</p>
      </div>
    );
  }

  // AUTH VIEW (Login & Register)
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-[#0F1C3F] via-[#15234E] to-[#1E306E] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl space-y-6 border border-slate-100/10">
          
          {/* Logo Heading */}
          <div className="text-center space-y-1.5">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight font-display">Yaa POS</h1>
            <p className="text-xs text-slate-400 font-medium">Sistema Punto de Venta</p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            {authMode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5" /> Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Gómez"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Correo Electrónico
              </label>
              <input
                type="email"
                required
                placeholder="usuario@correo.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

             <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden p-1 cursor-pointer"
                  title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-[#1E88E5] hover:bg-[#1E88E5]/90 text-white rounded-xl font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer"
            >
              {authMode === 'login' ? 'Iniciar Sesión' : 'Crear mi Cuenta'}
            </button>
          </form>

          {/* Toggle Button */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              {authMode === 'login' 
                ? '¿No tienes cuenta? Registrate aquí (Crear una cuenta)' 
                : '¿Ya tienes una cuenta? Iniciar sesión'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- ADMIN VIEW ---
  if (user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && viewMode === 'admin') {
    return <AdminPanel user={user} onLogout={handleLogout} onViewPOS={() => setViewMode('pos')} />;
  }

  const getLicenseStatus = () => {
    if (!userLicense) return 'Activa';
    if (userLicense.status === 'Por vencer' || userLicense.status === 'Por Vencer') return 'Por vencer';
    
    if (userLicense.expirationDate) {
      const daysLeft = calculateDaysRemaining(userLicense.expirationDate);
      if (daysLeft <= 7 && daysLeft > 0) {
        return 'Por vencer';
      }
    }
    return userLicense.status || 'Activa';
  };

  // --- FULL LAYOUT (SIDEBAR + CONTENT PANELS) ---

  const sidebarTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'punto-de-venta', label: 'Punto de Venta', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'inventario', label: 'Inventario', icon: <Package className="w-4 h-4" /> },
    { id: 'libro-ventas', label: 'Libro Auxiliar de Ventas', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> },
    { id: 'compras', label: 'Gestión Compras', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'vencimientos', label: 'Vencimientos', icon: <Calendar className="w-4 h-4" /> },
    { id: 'complementos', label: 'Complementos', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
    { id: 'clientes', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
    { id: 'proveedores', label: 'Proveedores', icon: <Truck className="w-4 h-4" /> },
    { id: 'gastos', label: 'Gastos', icon: <TrendingDown className="w-4 h-4" /> },
    { id: 'apertura-cierre', label: 'Apertura y Cierre', icon: <Inbox className="w-4 h-4" /> },
    { id: 'reportes', label: 'Reportes Diarios', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'configuracion', label: 'Configuración', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  const visibleSidebarTabs = sidebarTabs.filter((tab) => {
    if (user?.isOperator && user.disabledTabs?.includes(tab.id)) {
      // Configuración is the place for operator/cajero info, but maybe they shouldn't view settings if config is disabled
      return false;
    }
    return true;
  });

  const renderActiveComponent = () => {
    if (isSuspended) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-lg mx-auto py-16 animate-scale-up">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center border border-red-100 shadow-sm">
            <CreditCard className="w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight font-display">Servicio Restringido</h2>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              {suspensionReason || 'Las funciones de Yaa POS han sido suspendidas temporalmente debido a la falta de pago de la suscripción mensual de su cuenta en Yaa POS.'}
            </p>
          </div>
          <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 text-left space-y-1.5 w-full">
            <p className="text-xs text-red-800 font-bold uppercase tracking-wider">¿Cómo reactivar el servicio?</p>
            <p className="text-[11px] text-red-700 leading-relaxed">
              Comunícate con el administrador para regularizar tu licencia o simular el pago para restablecer el acceso a todos los módulos de Yaa POS.
            </p>
          </div>
          <button
            onClick={handleSimulatePayment}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 cursor-pointer uppercase tracking-wider"
          >
            Pagar y Reactivar Servicio Completo
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard products={products} sales={sales} expenses={expenses} shifts={shifts} config={config} onNavigate={setActiveTab} />;
      case 'punto-de-venta':
        return (
          <POS 
            products={products} 
            clients={clients} 
            shifts={shifts} 
            config={config} 
            user={user!}
            onSaveSale={onSaveSale} 
            onRefreshData={loadAllData} 
            onNavigate={setActiveTab} 
          />
        );
      case 'inventario':
        return (
          <Inventory 
            products={products} 
            config={config} 
            onSaveProduct={onSaveProduct} 
            onDeleteProduct={onDeleteProduct} 
            onRefreshData={loadAllData} 
            sales={sales}
            purchases={purchases}
          />
        );
      case 'libro-ventas':
        return (
          <SalesLedger 
            sales={sales}
            clients={clients}
            config={config}
            products={products}
          />
        );
      case 'compras':
        return (
          <Purchasing 
            products={products} 
            providers={providers} 
            purchases={purchases} 
            currency={config.currency} 
            config={config}
            onSavePurchase={onSavePurchase} 
            onSaveProduct={onSaveProduct}
            onRefreshData={loadAllData} 
          />
        );
      case 'vencimientos':
        return (
          <Expirations 
            products={products} 
            config={config} 
            onSaveProduct={onSaveProduct} 
            onRefreshData={loadAllData} 
          />
        );
      case 'complementos':
        return (
          <Complementos 
            files={files} 
            config={config} 
            onUploadFile={onUploadFile} 
            onDeleteFile={onDeleteFile} 
            onAskAI={onAskAI} 
            onRefreshData={loadAllData} 
          />
        );
      case 'clientes':
        return (
          <ClientsProviders 
            clients={clients} 
            providers={providers} 
            currency={config.currency} 
            onSaveClient={onSaveClient} 
            onDeleteClient={onDeleteClient} 
            onSaveProvider={onSaveProvider} 
            onDeleteProvider={onDeleteProvider} 
            onRefreshData={loadAllData} 
            mode="clients"
          />
        );
      case 'proveedores':
        return (
          <ClientsProviders 
            clients={clients} 
            providers={providers} 
            currency={config.currency} 
            onSaveClient={onSaveClient} 
            onDeleteClient={onDeleteClient} 
            onSaveProvider={onSaveProvider} 
            onDeleteProvider={onDeleteProvider} 
            onRefreshData={loadAllData} 
            mode="providers"
          />
        );
      case 'gastos':
        return (
          <Expenses 
            expenses={expenses} 
            currency={config.currency} 
            onSaveExpense={onSaveExpense} 
            onDeleteExpense={onDeleteExpense} 
            onRefreshData={loadAllData} 
          />
        );
      case 'apertura-cierre':
        return (
          <CashRegister 
            shifts={shifts} 
            sales={sales} 
            expenses={expenses} 
            currency={config.currency} 
            onSaveShift={onSaveShift} 
            onRefreshData={loadAllData} 
            onNavigate={setActiveTab}
          />
        );
      case 'reportes':
        return <DailyReports sales={sales} expenses={expenses} clients={clients} config={config} products={products} onNavigate={setActiveTab} />;
      case 'configuracion':
        return <Settings config={config} user={user} onSaveConfig={onSaveConfig} />;
      default:
        return <Dashboard products={products} sales={sales} expenses={expenses} shifts={shifts} config={config} onNavigate={setActiveTab} />;
    }
  };

  const hasPendingSync = Object.values(pendingWrites).some(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* Banner for "Por vencer" */}
      {user && user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && getLicenseStatus() === 'Por vencer' && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 z-40 shrink-0 shadow-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Su licencia vencerá en {calculateDaysRemaining(userLicense?.expirationDate)} días. Comuníquese con el administrador para renovarla.</span>
        </div>
      )}
      
      {/* MOBILE HEADER NAVBAR */}
      <div className="md:hidden bg-[#0A1221] text-slate-100 px-4 py-3 relative flex items-center justify-between border-b border-slate-800 shrink-0 min-h-[52px]">
        {/* Left Action: ArrowLeft (when inside any module) or empty spacer (when on dashboard) */}
        <div className="flex items-center z-10">
          {activeTab !== 'dashboard' ? (
            <button
              id="btn-mobile-back-dashboard"
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="p-1.5 -ml-1 hover:bg-slate-800 active:scale-95 rounded-xl text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1 bg-slate-800/60 border border-slate-700/60 shadow-xs"
              title="Regresar a Dashboard"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          ) : (
            <div className="w-6 shrink-0" />
          )}
        </div>

        {/* Centered Store Name & Active Section */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[65%] truncate pointer-events-none">
          <span className="text-sm font-black text-white tracking-wide font-display block truncate">
            {config.storeName || 'Yaa POS'}
          </span>
          <span className="text-[9.5px] text-blue-400 font-bold tracking-wider uppercase block -mt-0.5 truncate">
            {sidebarTabs.find(t => t.id === activeTab)?.label || 'Punto de Venta'}
          </span>
        </div>

        {/* Right Connectivity Status */}
        <div className="flex items-center gap-2 shrink-0 z-10">
          {isOnline ? (
            hasPendingSync ? (
              <div className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full text-[9px] font-bold" title="Sincronizando cambios locales con el servidor...">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>Sincronizando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[9px] font-bold" title="Conectado y sincronizado">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>En línea</span>
              </div>
            )
          ) : (
            hasPendingSync ? (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-[9px] font-bold" title="Sin conexión. Ventas/cambios guardados en caché. Se enviarán al volver Internet.">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>Offline (Pte. Sincronizar)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full text-[9px] font-bold" title="Sin conexión">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Sin conexión</span>
              </div>
            )
          )}
          {isDataLoading && (
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* 1. DESKTOP SIDEBAR (Hidden on mobile) */}
        <aside className="hidden md:flex md:w-64 bg-[#0A1221] text-slate-300 flex-col justify-between shrink-0 border-r border-slate-800">
          
          {/* Top Header Logo */}
          <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-wider font-display block">Yaa POS</span>
                {isOnline ? (
                  hasPendingSync ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" title="Sincronizando..." />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="En línea" />
                  )
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Sin conexión" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Punto de Venta</span>
                {!isOnline && (
                  <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wider">
                    {hasPendingSync ? 'Pte. Sinc' : 'Offline'}
                  </span>
                )}
              </div>
            </div>
            {isDataLoading && (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            )}
          </div>

          {/* Navigation Links list */}
          <nav className="px-3 py-2 space-y-1 overflow-y-auto flex-1 max-h-[calc(100vh-180px)]">
            {user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && (
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer uppercase tracking-wider mb-3 animate-pulse shrink-0"
              >
                <Shield className="w-4 h-4 text-emerald-100" />
                <span>Consola Admin</span>
              </button>
            )}
            {visibleSidebarTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20' 
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Bottom profile and logout */}
          <div className="border-t border-slate-800 px-3 py-4 space-y-3 shrink-0 bg-[#070D18]">
            <div className="flex items-center gap-2.5 px-3">
              <div className="p-1.5 bg-slate-800 text-blue-400 rounded-full shrink-0">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.name}</p>
                <p className="text-[9px] text-slate-500 font-mono truncate">{user.email}</p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 bg-red-950 hover:bg-red-900 text-red-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-red-900/40 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
            </button>
          </div>
        </aside>

        {/* 2. MAIN ACTIVE VIEWPORT (Right Column) */}
        <main className={`flex-1 p-4 sm:p-6 md:p-8 ${activeTab === 'dashboard' ? 'pb-24' : 'pb-6'} md:pb-8 overflow-y-auto max-h-screen bg-white`}>
          <ErrorBoundary key={activeTab}>
            {renderActiveComponent()}
          </ErrorBoundary>
        </main>
      </div>

      {/* 3. MOBILE & IPHONE BOTTOM NAVIGATION BAR (ONLY SHOWN ON DASHBOARD) */}
      {activeTab === 'dashboard' && (
        <nav 
          id="mobile-bottom-navbar" 
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1836] text-white border-t border-slate-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none transition-all duration-300"
        >
          {/* 1. Dashboard */}
          <button
            id="btn-nav-dashboard"
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex-1 flex flex-col items-center justify-center py-1 px-1 text-white transition-all active:scale-95 cursor-pointer"
          >
            <div className="p-1 rounded-xl transition-all bg-[#1E88E5]/30 text-[#38bdf8]">
              <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[10px] sm:text-[11px] mt-0.5 font-black text-white block truncate tracking-tight">
              Dashboard
            </span>
          </button>

          {/* 2. Punto de Venta */}
          <button
            id="btn-nav-venta"
            type="button"
            onClick={() => setActiveTab('punto-de-venta')}
            className="flex-1 flex flex-col items-center justify-center py-1 px-0.5 transition-all active:scale-95 cursor-pointer text-slate-400 hover:text-slate-200"
          >
            <div className="p-1 rounded-xl transition-all">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[9px] sm:text-[10.5px] tracking-tight mt-0.5 whitespace-nowrap font-medium">
              Punto de Venta
            </span>
          </button>

          {/* 3. Inventario */}
          <button
            id="btn-nav-inventario"
            type="button"
            onClick={() => setActiveTab('inventario')}
            className="flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer text-slate-400 hover:text-slate-200"
          >
            <div className="p-1 rounded-xl transition-all">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight mt-0.5 truncate font-medium">
              Inventario
            </span>
          </button>

          {/* 4. Compras */}
          <button
            id="btn-nav-compras"
            type="button"
            onClick={() => setActiveTab('compras')}
            className="flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer text-slate-400 hover:text-slate-200"
          >
            <div className="p-1 rounded-xl transition-all">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight mt-0.5 truncate font-medium">
              Compras
            </span>
          </button>

          {/* 5. Menú */}
          <button
            id="btn-nav-menu"
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer text-slate-400 hover:text-slate-200"
          >
            <div className="p-1 rounded-xl transition-all">
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight mt-0.5 truncate font-medium">
              Menú
            </span>
          </button>
        </nav>
      )}

      {/* Floating Suspension Alert Modal */}
      {isSuspended && showSuspensionModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-scale-up">
            
            {/* Top Banner Accent */}
            <div className="bg-gradient-to-r from-red-600 to-amber-600 px-6 py-8 text-center text-white relative">
              <button 
                onClick={() => setShowSuspensionModal(false)}
                className="absolute top-4 right-4 bg-black/10 hover:bg-black/20 text-white/80 hover:text-white p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-black tracking-tight uppercase font-display">Suscripción Suspendida</h2>
              <p className="text-xs text-white/80 mt-1 font-medium">Pago Pendiente de la Licencia Yaa POS</p>
            </div>

            {/* Body Content */}
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="font-bold text-red-800 text-xs uppercase tracking-wider">Aviso de Facturación</h4>
                  <p className="text-xs text-red-700 leading-relaxed">
                    Estimado cliente <strong>{user?.name}</strong>: {suspensionReason || 'el sistema ha detectado que no se ha registrado el pago de su suscripción correspondiente a este período de facturación.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-left">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalles de la Licencia:</h4>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Plan Actual</span>
                    <span className="text-slate-700 font-bold">{userLicense?.planType || 'Mensual Básico'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Vencimiento</span>
                    <span className="text-red-500 font-bold">{userLicense?.expirationDate || 'Falta de pago'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Estado del Servicio</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                      SUSPENDIDO
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed text-left">
                Todas las funciones y módulos de Yaa POS se encuentran temporalmente bloqueados por falta de pago. Regularice su pago o simule el abono para restablecer el acceso completo inmediatamente.
              </p>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSimulatePayment}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-98 cursor-pointer uppercase"
              >
                <Check className="w-4 h-4" /> Registrar Pago (Reactivar)
              </button>
              <button
                type="button"
                onClick={() => setShowSuspensionModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 font-bold text-xs py-3 px-4 rounded-xl border border-slate-200 transition-colors cursor-pointer uppercase"
              >
                Modo Consulta (Cerrar)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-5 py-4 rounded-2xl shadow-xl flex items-center gap-3 z-55 border border-emerald-500 transition-all duration-300 animate-slide-in">
          <div className="bg-white/20 p-1.5 rounded-full shrink-0">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold">¡Suscripción Reactivada!</p>
            <p className="text-[10px] text-white/80 font-medium">Su pago ha sido procesado con éxito. Servicio restablecido.</p>
          </div>
        </div>
      )}

      {/* MOBILE MENU MODAL / BOTTOM SHEET (MATCHING USER'S IMAGE Dashboard (2).png EXACTLY) */}
      {isMobileMenuOpen && (
        <div id="mobile-menu-modal" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center md:hidden animate-fade-in">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-9 z-10 animate-slide-up max-h-[90vh] overflow-y-auto border border-slate-100">
            {/* Header bar */}
            <div className="flex items-center justify-between mb-6 pb-2.5 border-b border-slate-100">
              <div className="space-y-0.5">
                <span className="text-sm font-black text-slate-800 tracking-tight font-display block">Menú</span>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">{config.storeName || 'Yaa POS'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4-column Circular Icons Grid (Exact layout from Dashboard (2).png) */}
            <div className="grid grid-cols-4 gap-y-6 gap-x-2 text-center select-none">
              
              {/* 1. Vencimientos */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('vencimientos');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Calendar className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  Vencimientos
                </span>
              </button>

              {/* 2. Complementos */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('complementos');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-amber-400 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  Complementos
                </span>
              </button>

              {/* 3. Clientes */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('clientes');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Users className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  Clientes
                </span>
              </button>

              {/* 4. Proveedores */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('proveedores');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Truck className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  Proveedores
                </span>
              </button>

              {/* 5. Gastos */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('gastos');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <TrendingDown className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  Gastos
                </span>
              </button>

              {/* 6. caja */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('apertura-cierre');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Inbox className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  caja
                </span>
              </button>

              {/* 7. Reportes Diarios */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('reportes');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[10.5px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors leading-tight line-clamp-2">
                  Reportes<br/>Diarios
                </span>
              </button>

              {/* 8. Configuración */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('configuracion');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <SettingsIcon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  Configuración
                </span>
              </button>

              {/* 9. Cerrar sesión */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-pink-100 text-rose-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform border border-pink-200">
                  <Power className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-bold text-rose-700/80 mt-2 tracking-tight group-hover:text-rose-800 transition-colors whitespace-nowrap">
                  Cerrar sesión
                </span>
              </button>

              {/* 10. Consola Admin (Solo Administrador) */}
              {user?.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('admin');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-13 h-13 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <Shield className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 mt-2 tracking-tight group-hover:text-emerald-900 transition-colors">
                    Admin
                  </span>
                </button>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
