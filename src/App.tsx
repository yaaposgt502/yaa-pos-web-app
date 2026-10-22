import React, { useState, useEffect, useMemo } from 'react';
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
import Branches from './components/Branches';
import AdminPanel from './components/AdminPanel';
import Quotations from './components/Quotations';
import ErrorBoundary from './components/ErrorBoundary';
import PlanModal from './components/PlanModal';
import { getPlanDefinition, checkBranchLimit, checkUserLimit } from './utils/planLimits';
import { parseSafeDate } from './utils/dateHelper';

// Icons
import { 
  LayoutDashboard, 
  LayoutGrid,
  ShoppingCart, 
  Package, 
  FileText,
  FileSpreadsheet,
  History,
  ShoppingBag, 
  Calendar, 
  Sparkles, 
  Users, 
  TrendingDown, 
  Inbox, 
  BarChart3, 
  Building2,
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
  EyeOff,
  Store,
  ExternalLink
} from 'lucide-react';
import { getSystemBranches, getActiveBranch, getOperationalBranches, resolveBranch, isItemInBranch } from './utils/branchHelper';

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
  const [isPlanUpgradeModalOpen, setIsPlanUpgradeModalOpen] = useState(false);
  const [operatorsCount, setOperatorsCount] = useState(1);

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

  // Password Recovery Modal States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Auto-validate session on startup with safety timeout to prevent stuck loading screen
  useEffect(() => {
    let isCancelled = false;
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) {
        setIsInitializing(false);
      }
    }, 3500);

    async function checkSession() {
      if (token) {
        try {
          const profile = await Promise.race([
            api.getMe(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado al validar sesión')), 4000))
          ]);
          if (isCancelled) return;
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
          // Real-time onSnapshot listeners handle collection population without redundant full-collection fetches
        } catch (err: any) {
          if (isCancelled) return;
          try {
            await api.logoutUser();
          } catch {
            api.setToken(null);
            setToken(null);
            setUser(null);
          }
          if (api.isQuotaExceededError(err)) {
            setAuthError('Límite de cuota gratuita diaria de Firestore alcanzado (50,000 lecturas/día en base de datos secundaria). Puede reactivarla desvinculando la restricción gratuita en Firebase Console.');
          } else if (err instanceof Error && (err.message.includes('suspendida') || err.message.includes('desactivada') || err.message.includes('expirado'))) {
            setAuthError(err.message);
          }
        }
      }
      if (!isCancelled) {
        clearTimeout(safetyTimer);
        setIsInitializing(false);
      }
    }
    checkSession();

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
    };
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
    if (user?.isOperator && user.disabledTabs && (user.disabledTabs.includes(activeTab) || (activeTab === 'historial-ventas' && user.disabledTabs.includes('libro-ventas')))) {
      const firstAvailableTab = sidebarTabs.find(tab => !user.disabledTabs?.includes(tab.id) && !(tab.id === 'historial-ventas' && user.disabledTabs?.includes('libro-ventas')));
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
      setSales(prev => {
        const slsMap = new Map(sls.map(s => [s.id, s]));
        const merged = [...sls];
        for (const p of prev) {
          if (!slsMap.has(p.id)) {
            merged.push(p);
          }
        }
        return merged.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      });
      setPendingWrites(prev => ({ ...prev, sales: !!meta?.hasPendingWrites }));
    });

    const unsubPurchases = api.subscribePurchases((purcs, meta) => {
      setPurchases(prev => {
        const purcMap = new Map(purcs.map(p => [p.id, p]));
        const merged = [...purcs];
        for (const p of prev) {
          if (!purcMap.has(p.id)) {
            merged.push(p);
          }
        }
        return merged.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      });
      setPendingWrites(prev => ({ ...prev, purchases: !!meta?.hasPendingWrites }));
    });

    const unsubExpenses = api.subscribeExpenses((exps, meta) => {
      setExpenses(prev => {
        const expMap = new Map(exps.map(e => [e.id, e]));
        const merged = [...exps];
        for (const p of prev) {
          if (!expMap.has(p.id)) {
            merged.push(p);
          }
        }
        return merged.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      });
      setPendingWrites(prev => ({ ...prev, expenses: !!meta?.hasPendingWrites }));
    });

    const unsubShifts = api.subscribeShifts((sfts, meta) => {
      setShifts(prev => {
        const sftMap = new Map(sfts.map(s => [s.id, s]));
        const merged = [...sfts];
        for (const p of prev) {
          if (!sftMap.has(p.id)) {
            merged.push(p);
          }
        }
        return merged.sort((a, b) => parseSafeDate(b.openedAt).getTime() - parseSafeDate(a.openedAt).getTime());
      });
      setPendingWrites(prev => ({ ...prev, shifts: !!meta?.hasPendingWrites }));
    });

    const unsubFiles = api.subscribeFiles((fls, meta) => {
      setFiles(fls);
      setPendingWrites(prev => ({ ...prev, files: !!meta?.hasPendingWrites }));
    });

    const unsubConfig = api.subscribeConfig((cfg, meta) => {
      if (cfg) {
        if (cfg.branches && cfg.branches.length > 0) {
          const isOnlyLegacySeeds = cfg.branches.every(b =>
            (b.id === 'branch-1' && b.code === 'SUC-01') ||
            (b.id === 'branch-2' && b.code === 'SUC-02') ||
            (b.id === 'branch-3' && b.code === 'SUC-03') ||
            b.name === 'Sucursal Central (Sede Principal)' ||
            b.name === 'Sucursal Mixco - San Cristóbal' ||
            b.name === 'Sucursal Carretera a El Salvador'
          );
          if (isOnlyLegacySeeds) {
            const cleanedCfg: AppConfig = { ...cfg, branches: [], activeBranchId: '' };
            setConfig(cleanedCfg);
            api.saveConfig(cleanedCfg).catch(console.error);
            setPendingWrites(prev => ({ ...prev, config: !!meta?.hasPendingWrites }));
            return;
          }
        }
        setConfig(cfg);
      }
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
  const systemBranches = useMemo(() => getSystemBranches(config), [config]);
  const operationalBranches = useMemo(() => getOperationalBranches(config, user), [config, user]);
  const activeBranch = useMemo(() => getActiveBranch(config, user), [config, user]);

  // Track operators count for user limit validation
  useEffect(() => {
    if (user?.id) {
      api.getOperators().then(ops => {
        setOperatorsCount(Math.max(1, ops.length));
      }).catch(() => {});
    }
  }, [user?.id, activeTab]);

  const plan = useMemo(() => getPlanDefinition(userLicense?.planType), [userLicense?.planType]);
  const branchLimitInfo = useMemo(() => checkBranchLimit(operationalBranches.length, userLicense?.planType), [operationalBranches.length, userLicense?.planType]);
  const userLimitInfo = useMemo(() => checkUserLimit(operatorsCount, userLicense?.planType), [operatorsCount, userLicense?.planType]);

  // La pestaña "Sucursales" solo aparece cuando la cuenta tiene un plan que permite crear más de 1 sucursal
  const canManageBranches = useMemo(() => {
    const max = typeof userLicense?.maxBranches === 'number'
      ? userLicense.maxBranches
      : (plan?.maxBranches ?? 1);
    return max > 1 || Boolean(plan?.multiBranchAllowed);
  }, [userLicense?.maxBranches, plan]);

  useEffect(() => {
    if (!canManageBranches && activeTab === 'sucursales') {
      setActiveTab('dashboard');
    }
  }, [canManageBranches, activeTab]);

  // Independent collections per active branch (if no branches exist yet, show all items)
  const branchProducts = useMemo(
    () => products.filter(p => isItemInBranch(p.branch, activeBranch?.name, systemBranches)),
    [products, activeBranch?.name, systemBranches]
  );
  const branchClients = useMemo(
    () => clients.filter(c => isItemInBranch(c.branch, activeBranch?.name, systemBranches)),
    [clients, activeBranch?.name, systemBranches]
  );
  const branchProviders = useMemo(
    () => providers.filter(p => isItemInBranch(p.branch, activeBranch?.name, systemBranches)),
    [providers, activeBranch?.name, systemBranches]
  );
  const branchSales = useMemo(
    () => sales.filter(s => isItemInBranch(s.branch, activeBranch?.name, systemBranches)),
    [sales, activeBranch?.name, systemBranches]
  );
  const branchPurchases = useMemo(
    () => purchases.filter(p => isItemInBranch(p.branch, activeBranch?.name, systemBranches)),
    [purchases, activeBranch?.name, systemBranches]
  );
  const branchExpenses = useMemo(
    () => expenses.filter(e => isItemInBranch(e.branch, activeBranch?.name, systemBranches)),
    [expenses, activeBranch?.name, systemBranches]
  );
  const branchShifts = useMemo(
    () => shifts.filter(sh => isItemInBranch(sh.branch, activeBranch?.name, systemBranches)),
    [shifts, activeBranch?.name, systemBranches]
  );
  const branchFiles = useMemo(
    () => files.filter(f => isItemInBranch(f.branch, activeBranch?.name, systemBranches)),
    [files, activeBranch?.name, systemBranches]
  );
  const activeBranchOpenShift = useMemo(
    () => branchShifts.find(sh => sh.state === 'open'),
    [branchShifts]
  );

  // Broadcast helper for instant cross-tab synchronization with zero server reads
  const notifyBranchSync = (payload: { 
    type: 'branch_switch' | 'data_update' | 'sync_entity'; 
    branchId?: string; 
    branchName?: string; 
    timestamp: number;
    entity?: 'products' | 'clients' | 'providers' | 'sales' | 'purchases' | 'expenses' | 'shifts' | 'config';
    action?: 'save' | 'delete';
    item?: any;
    id?: string;
    multiUpdates?: {
      products?: Product[];
      clients?: Client[];
      providers?: Provider[];
      sales?: Sale[];
      purchases?: Purchase[];
      expenses?: Expense[];
      shifts?: Shift[];
      config?: AppConfig;
    };
  }) => {
    try {
      if (payload.branchId) {
        localStorage.setItem('yaa_pos_active_branch_id', payload.branchId);
      }
      localStorage.setItem('yaa_pos_branch_sync_event', JSON.stringify(payload));
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('yaa_pos_branch_sync');
        channel.postMessage(payload);
        channel.close();
      }
    } catch (e) {
      console.warn('Cross-tab sync broadcast warning:', e);
    }
  };

  // Automatic synchronization of active branch and branch data across browser tabs
  useEffect(() => {
    const applySyncedBranchId = (branchId?: string) => {
      if (!branchId) return;
      setConfig(prev => {
        if (prev.activeBranchId === branchId) return prev;
        return { ...prev, activeBranchId: branchId };
      });
    };

    const processCrossTabSync = (data: any) => {
      if (!data) return;
      if (data.branchId) applySyncedBranchId(data.branchId);

      // 1. Process batch multi-updates if provided (instant atomic multi-tab sync)
      if (data.multiUpdates) {
        if (Array.isArray(data.multiUpdates.products)) setProducts(data.multiUpdates.products);
        if (Array.isArray(data.multiUpdates.sales)) setSales(data.multiUpdates.sales);
        if (Array.isArray(data.multiUpdates.clients)) setClients(data.multiUpdates.clients);
        if (Array.isArray(data.multiUpdates.providers)) setProviders(data.multiUpdates.providers);
        if (Array.isArray(data.multiUpdates.purchases)) setPurchases(data.multiUpdates.purchases);
        if (Array.isArray(data.multiUpdates.expenses)) setExpenses(data.multiUpdates.expenses);
        if (Array.isArray(data.multiUpdates.shifts)) setShifts(data.multiUpdates.shifts);
        if (data.multiUpdates.config) setConfig(data.multiUpdates.config);
        return;
      }

      // 2. Process individual entity sync
      if (data.type === 'sync_entity' && data.entity) {
        const { entity, action, item, id } = data;
        if (entity === 'products') {
          if (action === 'delete' && id) setProducts(p => p.filter(x => x.id !== id));
          else if (item) setProducts(p => [item, ...p.filter(x => x.id !== item.id)]);
        } else if (entity === 'clients') {
          if (action === 'delete' && id) setClients(c => c.filter(x => x.id !== id));
          else if (item) setClients(c => [item, ...c.filter(x => x.id !== item.id)]);
        } else if (entity === 'providers') {
          if (action === 'delete' && id) setProviders(pr => pr.filter(x => x.id !== id));
          else if (item) setProviders(pr => [item, ...pr.filter(x => x.id !== item.id)]);
        } else if (entity === 'sales' && item) {
          setSales(s => [item, ...s.filter(x => x.id !== item.id)]);
        } else if (entity === 'purchases' && item) {
          setPurchases(pu => [item, ...pu.filter(x => x.id !== item.id)]);
        } else if (entity === 'expenses') {
          if (action === 'delete' && id) setExpenses(e => e.filter(x => x.id !== id));
          else if (item) setExpenses(e => [item, ...e.filter(x => x.id !== item.id)]);
        } else if (entity === 'shifts' && item) {
          setShifts(sh => [item, ...sh.filter(x => x.id !== item.id)]);
        } else if (entity === 'config' && item) {
          setConfig(item);
        }
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'yaa_pos_active_branch_id' && e.newValue) {
        applySyncedBranchId(e.newValue);
      } else if (e.key === 'yaa_pos_branch_sync_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          processCrossTabSync(parsed);
        } catch {}
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('yaa_pos_branch_sync');
        channel.onmessage = (event) => {
          processCrossTabSync(event.data);
        };
      } catch {}
    }

    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
      if (channel) channel.close();
    };
  }, [user?.id, token]);

  const handleSwitchActiveBranch = async (branchIdOrName: string) => {
    if (!branchIdOrName || branchIdOrName === 'Todas') return;
    const resolved =
      resolveBranch(config, branchIdOrName, user) ||
      systemBranches.find(
        b =>
          b.id === branchIdOrName ||
          b.name.toLowerCase().trim() === branchIdOrName.toLowerCase().trim() ||
          b.code.toLowerCase().trim() === branchIdOrName.toLowerCase().trim()
      );
    const nextBranchId = resolved ? resolved.id : branchIdOrName;
    const updated: AppConfig = {
      ...config,
      branches: config.branches || [],
      activeBranchId: nextBranchId
    };
    setConfig(updated);
    notifyBranchSync({
      type: 'branch_switch',
      branchId: nextBranchId,
      branchName: resolved?.name || branchIdOrName,
      timestamp: Date.now()
    });
    await onSaveConfig(updated);
  };

  async function loadAllData(overrideUser?: User) {
    const currentUser = overrideUser || user;
    if (!currentUser) return;
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
      setSales(prev => {
        const slsMap = new Map(sls.map(s => [s.id, s]));
        const merged = [...sls];
        for (const p of prev) {
          if (!slsMap.has(p.id)) {
            merged.push(p);
          }
        }
        return merged.sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
      });
      setPurchases(purcs);
      setExpenses(exps);
      setShifts(sfts);
      setFiles(fls);

      let resolvedCfg = cfg || defaultAppConfig;
      if (resolvedCfg.branches && resolvedCfg.branches.length > 0) {
        const isOnlyLegacySeeds = resolvedCfg.branches.every(b =>
          (b.id === 'branch-1' && b.code === 'SUC-01') ||
          (b.id === 'branch-2' && b.code === 'SUC-02') ||
          (b.id === 'branch-3' && b.code === 'SUC-03') ||
          b.name === 'Sucursal Central (Sede Principal)' ||
          b.name === 'Sucursal Mixco - San Cristóbal' ||
          b.name === 'Sucursal Carretera a El Salvador'
        );
        if (isOnlyLegacySeeds) {
          resolvedCfg = { ...resolvedCfg, branches: [], activeBranchId: '' };
          api.saveConfig(resolvedCfg).catch(console.error);
        }
      }
      setConfig(resolvedCfg);
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
      // Passwords are protected in Firebase Auth, never stored in plain text
      sessionStorage.removeItem('yaa_pos_session_password');
      localStorage.removeItem('yaa_pos_owner_password');
      setAuthPassword('');
      setAuthEmail('');
      setAuthName('');
    } catch (err: any) {
      if (api.isQuotaExceededError(err)) {
        setAuthError('Límite de cuota gratuita diaria de Firestore alcanzado (50,000 lecturas/día en base de datos secundaria). Puede reactivarla desvinculando la restricción gratuita en Firebase Console para permitir facturación en plan Blaze.');
      } else {
        setAuthError(err.message || 'Error de autenticación');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logoutUser();
    } finally {
      sessionStorage.removeItem('yaa_pos_session_password');
      localStorage.removeItem('yaa_pos_owner_password');
      localStorage.removeItem('yaa_pos_operator_email');
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

  // --- DELEGATED API CALLS (Isolated & Synchronized per Branch, Fully Integrated with Zero Redundant Server Reads) ---
  const onSaveProduct = async (p: Product) => {
    const branchName = p.branch || activeBranch?.name || '';
    const productWithBranch: Product = {
      ...p,
      ...(branchName ? { branch: branchName } : {})
    };
    const saved = await api.saveProduct(productWithBranch);
    let nextProducts: Product[] = [];
    setProducts(prev => {
      const idx = prev.findIndex(item => item.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        nextProducts = copy;
        return copy;
      }
      nextProducts = [saved, ...prev];
      return nextProducts;
    });
    notifyBranchSync({
      type: 'sync_entity',
      entity: 'products',
      action: 'save',
      item: saved,
      multiUpdates: { products: nextProducts },
      timestamp: Date.now()
    });
    return saved;
  };

  const onDeleteProduct = async (id: string) => {
    const res = await api.deleteProduct(id);
    let nextProducts: Product[] = [];
    setProducts(prev => {
      nextProducts = prev.filter(p => p.id !== id);
      return nextProducts;
    });
    notifyBranchSync({
      type: 'sync_entity',
      entity: 'products',
      action: 'delete',
      id,
      multiUpdates: { products: nextProducts },
      timestamp: Date.now()
    });
    return res;
  };

  const onSaveClient = async (c: Client) => {
    const branchName = c.branch || activeBranch?.name || '';
    const clientWithBranch: Client = {
      ...c,
      ...(branchName ? { branch: branchName } : {})
    };
    const saved = await api.saveClient(clientWithBranch);
    let nextClients: Client[] = [];
    setClients(prev => {
      const idx = prev.findIndex(item => item.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        nextClients = copy;
        return copy;
      }
      nextClients = [saved, ...prev];
      return nextClients;
    });
    notifyBranchSync({
      type: 'sync_entity',
      entity: 'clients',
      action: 'save',
      item: saved,
      multiUpdates: { clients: nextClients },
      timestamp: Date.now()
    });
    return saved;
  };

  const onDeleteClient = async (id: string) => {
    const res = await api.deleteClient(id);
    let nextClients: Client[] = [];
    setClients(prev => {
      nextClients = prev.filter(c => c.id !== id);
      return nextClients;
    });
    notifyBranchSync({
      type: 'sync_entity',
      entity: 'clients',
      action: 'delete',
      id,
      multiUpdates: { clients: nextClients },
      timestamp: Date.now()
    });
    return res;
  };

  const onSaveProvider = async (p: Provider) => {
    const branchName = p.branch || activeBranch?.name || '';
    const providerWithBranch: Provider = {
      ...p,
      ...(branchName ? { branch: branchName } : {})
    };
    const saved = await api.saveProvider(providerWithBranch);
    let nextProviders: Provider[] = [];
    setProviders(prev => {
      const idx = prev.findIndex(item => item.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        nextProviders = copy;
        return copy;
      }
      nextProviders = [saved, ...prev];
      return nextProviders;
    });
    notifyBranchSync({
      type: 'sync_entity',
      entity: 'providers',
      action: 'save',
      item: saved,
      multiUpdates: { providers: nextProviders },
      timestamp: Date.now()
    });
    return saved;
  };

  const onDeleteProvider = async (id: string) => {
    const res = await api.deleteProvider(id);
    let nextProviders: Provider[] = [];
    setProviders(prev => {
      nextProviders = prev.filter(p => p.id !== id);
      return nextProviders;
    });
    notifyBranchSync({
      type: 'sync_entity',
      entity: 'providers',
      action: 'delete',
      id,
      multiUpdates: { providers: nextProviders },
      timestamp: Date.now()
    });
    return res;
  };

  // --- CLIENT DEBT PAYMENT (ABONO) INTEGRATION ---
  const onClientPayment = async (params: { clientId: string; amount: number; paymentMethod: string; reference?: string; notes?: string }) => {
    const client = clients.find(c => c.id === params.clientId);
    if (!client) throw new Error('Cliente no encontrado.');

    const nextBalance = Math.max(0, (client.balanceCredit || 0) - params.amount);
    const updatedClient: Client = {
      ...client,
      balanceCredit: nextBalance
    };
    await api.saveClient(updatedClient);

    let updatedShift: Shift | undefined;
    if (params.paymentMethod === 'Efectivo') {
      const targetBranch = client.branch || activeBranch?.name || '';
      const activeShift = shifts.find(sh => sh.state === 'open' && isItemInBranch(sh.branch, targetBranch, systemBranches));
      if (activeShift) {
        updatedShift = {
          ...activeShift,
          salesTotal: (activeShift.salesTotal || 0) + params.amount,
          cashSales: ((activeShift.cashSales !== undefined ? activeShift.cashSales : activeShift.salesTotal) || 0) + params.amount
        };
        await api.saveShift(updatedShift);
      }
    }

    const nextClients = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
    setClients(nextClients);

    let nextShifts = shifts;
    if (updatedShift) {
      const us = updatedShift;
      nextShifts = shifts.map(sh => sh.id === us.id ? us : sh);
      setShifts(nextShifts);
    }

    notifyBranchSync({
      type: 'sync_entity',
      entity: 'clients',
      action: 'save',
      item: updatedClient,
      multiUpdates: { clients: nextClients, shifts: nextShifts },
      timestamp: Date.now()
    });
  };

  // --- PROVIDER PAYMENT (PAGO A PROVEEDOR) INTEGRATION ---
  const onProviderPayment = async (params: { providerId: string; amount: number; paymentMethod: string; voucherNumber?: string; notes?: string }) => {
    const provider = providers.find(p => p.id === params.providerId);
    if (!provider) throw new Error('Proveedor no encontrado.');

    const nextPending = Math.max(0, (provider.creditPending || 0) - params.amount);
    const updatedProvider: Provider = {
      ...provider,
      creditPending: nextPending
    };
    await api.saveProvider(updatedProvider);

    let createdExpense: Expense | undefined;
    let updatedShift: Shift | undefined;

    if (params.paymentMethod === 'Efectivo') {
      const targetBranch = provider.branch || activeBranch?.name || '';
      createdExpense = {
        id: `exp_prov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: new Date().toISOString(),
        description: `Pago a Proveedor: ${provider.name} ${params.voucherNumber ? `(Doc: ${params.voucherNumber})` : ''}`,
        amount: params.amount,
        category: 'Pago a Proveedores',
        branch: targetBranch,
        paymentMethod: 'Efectivo',
        voucherNumber: params.voucherNumber,
        observations: params.notes || 'Abono / Pago de cuenta pendiente a proveedor'
      };
      await api.saveExpense(createdExpense);

      const activeShift = shifts.find(sh => sh.state === 'open' && isItemInBranch(sh.branch, targetBranch, systemBranches));
      if (activeShift) {
        updatedShift = {
          ...activeShift,
          expensesTotal: (activeShift.expensesTotal || 0) + params.amount
        };
        await api.saveShift(updatedShift);
      }
    }

    const nextProviders = providers.map(p => p.id === updatedProvider.id ? updatedProvider : p);
    setProviders(nextProviders);

    let nextExpenses = expenses;
    if (createdExpense) {
      nextExpenses = [createdExpense, ...expenses];
      setExpenses(nextExpenses);
    }

    let nextShifts = shifts;
    if (updatedShift) {
      const us = updatedShift;
      nextShifts = shifts.map(sh => sh.id === us.id ? us : sh);
      setShifts(nextShifts);
    }

    notifyBranchSync({
      type: 'sync_entity',
      entity: 'providers',
      action: 'save',
      item: updatedProvider,
      multiUpdates: { providers: nextProviders, expenses: nextExpenses, shifts: nextShifts },
      timestamp: Date.now()
    });
  };

  const onSaveSale = async (s: Sale) => {
    const saleBranch = s.branch || activeBranch?.name || '';
    // Pre-generate deterministic idempotent sale ID to prevent duplicate sales upon sync or retry
    const saleId = s.id || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const saleWithBranch: Sale = { 
      ...s, 
      id: saleId,
      ...(saleBranch ? { branch: saleBranch } : {}) 
    };

    // 1. Descontar stock únicamente de los productos pertenecientes a esta sucursal
    const productUpdates: Product[] = [];
    const productsMap = new Map(products.map(p => [p.id, { ...p }]));

    for (const item of s.items) {
      const product =
        products.find(p => p.id === item.productId && isItemInBranch(p.branch, saleBranch, systemBranches)) ||
        products.find(p => p.id === item.productId);
      if (product) {
        const prodCopy = productsMap.get(product.id) || { ...product };
        const mult = item.selectedUnit === 'Blíster' 
          ? (prodCopy.unitsPerBlister && prodCopy.unitsPerBlister > 0 ? prodCopy.unitsPerBlister : 1) 
          : (item.selectedUnit === 'Caja' 
              ? (prodCopy.unitsPerBox && prodCopy.unitsPerBox > 0 ? prodCopy.unitsPerBox : 1) 
              : 1);
        const unitsToDeduct = item.quantity * mult;
        
        const lotesSum = (prodCopy.expirationDates || []).reduce((acc, r) => acc + (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)), 0);
        const currentStock = Math.max(prodCopy.stock || 0, lotesSum);
        const nextStock = Math.max(0, currentStock - unitsToDeduct);

        let updatedExpirationDates = prodCopy.expirationDates;
        if (updatedExpirationDates && updatedExpirationDates.length > 0) {
          let remainingDeduct = unitsToDeduct;
          // First attempt to deduct from matching selected batch
          updatedExpirationDates = updatedExpirationDates.map(r => {
            const batchName = r.batch || prodCopy.initialBatch || 'Lote 01';
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

          // Eliminar automáticamente los lotes y fechas de vencimiento sin stock (stock <= 0)
          updatedExpirationDates = updatedExpirationDates.filter(r => {
            const currentLoteStock = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
            return currentLoteStock > 0;
          });
        }

        const survivingLotes = (updatedExpirationDates && updatedExpirationDates.length > 0) ? updatedExpirationDates : undefined;
        const nextExpirationDate = survivingLotes && survivingLotes.length > 0 
          ? survivingLotes[0].date 
          : (nextStock > 0 ? prodCopy.expirationDate : undefined);
        const nextInitialBatch = survivingLotes && survivingLotes.length > 0 
          ? (survivingLotes[0].batch || prodCopy.initialBatch) 
          : prodCopy.initialBatch;

        const updatedProd: Product = {
          ...prodCopy,
          branch: prodCopy.branch || saleBranch,
          stock: nextStock,
          expirationDate: nextExpirationDate,
          initialBatch: nextInitialBatch,
          expirationDates: survivingLotes
        };

        productsMap.set(product.id, updatedProd);
        productUpdates.push(updatedProd);
      }
    }

    // 2. Actualizar caja (shift activo de esta sucursal)
    let shiftUpdate: Shift | undefined;
    const activeShift = shifts.find(sh => 
      sh.state === 'open' && (sh.id === s.shiftId || isItemInBranch(sh.branch, saleBranch, systemBranches))
    );
    if (activeShift) {
      const extraCash = s.paymentMethod === 'cash' ? s.total : 0;
      shiftUpdate = {
        ...activeShift,
        branch: activeShift.branch || saleBranch,
        salesTotal: (activeShift.salesTotal || 0) + s.total,
        cashSales: ((activeShift.cashSales !== undefined ? activeShift.cashSales : activeShift.salesTotal) || 0) + extraCash
      };
    }

    // 3. Actualizar historial de cliente (gastos, puntos, última compra)
    let clientUpdate: Client | undefined;
    if (s.clientId && s.clientId !== 'general') {
      const client = clients.find(c => c.id === s.clientId);
      if (client) {
        const pointsEarned = Math.floor(s.total / 10);
        clientUpdate = {
          ...client,
          branch: client.branch || saleBranch,
          totalSpent: (client.totalSpent || 0) + s.total,
          loyaltyPoints: (client.loyaltyPoints || 0) + pointsEarned,
          lastPurchaseDate: new Date().toISOString().split('T')[0],
          balanceCredit: s.paymentMethod === 'credit' 
            ? (client.balanceCredit || 0) + s.total 
            : (client.balanceCredit || 0)
        };
      }
    }

    // 4. Guardar atómicamente en Firestore & IndexedDB en una sola transacción Batch (0 duplicados, integridad total)
    const saved = await api.executeSaleTransaction({
      sale: saleWithBranch,
      productUpdates,
      shiftUpdate,
      clientUpdate
    });

    // 5. Actualizar estado local inmediatamente (0 lecturas al servidor, interfaz instantánea sin lag)
    const nextSales = [saved, ...sales.filter(x => x.id !== saved.id)];
    setSales(nextSales);

    let nextProducts = products;
    if (productUpdates.length > 0) {
      const updatedIds = new Set(productUpdates.map(p => p.id));
      nextProducts = products.map(p => {
        if (updatedIds.has(p.id)) {
          return productUpdates.find(up => up.id === p.id) || p;
        }
        return p;
      });
      setProducts(nextProducts);
    }

    let nextShifts = shifts;
    if (shiftUpdate) {
      const su = shiftUpdate;
      nextShifts = shifts.map(sh => sh.id === su.id ? su : sh);
      setShifts(nextShifts);
    }

    let nextClients = clients;
    if (clientUpdate) {
      const cu = clientUpdate;
      nextClients = clients.map(c => c.id === cu.id ? cu : c);
      setClients(nextClients);
    }

    notifyBranchSync({ 
      type: 'sync_entity', 
      entity: 'sales', 
      action: 'save',
      item: saved,
      multiUpdates: {
        sales: nextSales,
        products: nextProducts,
        shifts: nextShifts,
        clients: nextClients
      },
      branchId: activeBranch?.id, 
      branchName: saleBranch, 
      timestamp: Date.now() 
    });
    return saved;
  };

  const onSavePurchase = async (pur: Purchase) => {
    const purchaseBranch = pur.branch || activeBranch?.name || '';
    const updatedProductsList: Product[] = [];

    // 1. Aumentar stock e ingresar costo, lote y vencimiento del producto en ESTA sucursal si la compra está completada
    if (pur.status === 'completed') {
      const updatedProductsMap = new Map<string, Product>();

      for (const item of pur.items) {
        if (!item) continue;
        let product =
          updatedProductsMap.get(item.productId) ||
          products.find(p => p && p.id === item.productId && isItemInBranch(p.branch, purchaseBranch, systemBranches));
        
        if (!product && item.name) {
          const itemNeedle = item.name.trim().toLowerCase();
          product = products.find(
            p =>
              p &&
              p.name &&
              isItemInBranch(p.branch, purchaseBranch, systemBranches) &&
              p.name.trim().toLowerCase() === itemNeedle
          );
        }

        if (!product) {
          const itemNeedle = item.name ? item.name.trim().toLowerCase() : '';
          const templateProd = products.find(
            p => p && (p.id === item.productId || (p.name && itemNeedle && p.name.trim().toLowerCase() === itemNeedle))
          );
          const itemAny = item as any;
          const initialUnitPrice =
            item.pricePerUnit ||
            itemAny.price ||
            templateProd?.price ||
            (item.cost ? Number((item.cost * 1.3).toFixed(2)) : 0);
          const newProd: Product = {
            ...(templateProd || {}),
            id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            code: itemAny.productCode || templateProd?.code || `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
            name: item.name || templateProd?.name || 'Producto',
            category: itemAny.productCategory || templateProd?.category || 'General',
            cost: item.cost || templateProd?.cost || 0,
            price: initialUnitPrice,
            pricePerUnit: initialUnitPrice,
            pricePerBlister: item.pricePerBlister ?? templateProd?.pricePerBlister ?? 0,
            pricePerBox: item.pricePerBox ?? templateProd?.pricePerBox ?? 0,
            stock: 0,
            minStock: templateProd?.minStock ?? 5,
            unit: templateProd?.unit || 'Pza',
            expirationDate: item.expirationDate || '',
            initialBatch: item.lote || '00101',
            manageBatchAndExpiration: true,
            expirationDates: [],
            branch: purchaseBranch
          };
          product = newProd;
        }

        const updatedProd = {
          ...applyPurchaseItemToProduct(product, item),
          branch: purchaseBranch
        };
        updatedProductsMap.set(updatedProd.id, updatedProd);
      }

      for (const updatedProd of updatedProductsMap.values()) {
        await api.saveProduct(updatedProd);
        updatedProductsList.push(updatedProd);
      }
    }

    // 2. Actualizar métricas del proveedor (compras totales, cuentas por pagar)
    let updatedProvider: Provider | undefined;
    if (pur.providerId) {
      const provider = providers.find(p => p && p.id === pur.providerId);
      if (provider) {
        const extraCredit = pur.paymentType === 'credit' ? pur.total : 0;
        updatedProvider = {
          ...provider,
          branch: provider.branch || purchaseBranch,
          totalPurchases: (provider.totalPurchases || 0) + pur.total,
          creditPending: (provider.creditPending || 0) + extraCredit
        };
        await api.saveProvider(updatedProvider);
      }
    }

    // 3. Si la compra fue pagada en EFECTIVO, registrar egreso en caja / gastos para cuadre de caja
    let purchaseExpense: Expense | undefined;
    let updatedShift: Shift | undefined;
    if (pur.status === 'completed' && pur.paymentType === 'cash') {
      const provName = providers.find(p => p.id === pur.providerId)?.name || 'Proveedor';
      purchaseExpense = {
        id: `exp_pur_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: pur.date || new Date().toISOString(),
        description: `Pago de compra de mercadería a ${provName} ${pur.voucherNumber ? `(Doc: ${pur.voucherNumber})` : ''}`,
        amount: pur.total,
        category: 'Compras/Mercadería',
        branch: purchaseBranch,
        paymentMethod: 'Efectivo',
        voucherNumber: pur.voucherNumber,
        observations: `Compra al contado (${pur.items.length} artículos)`
      };
      await api.saveExpense(purchaseExpense);

      const activeShift = shifts.find(sh => 
        sh.state === 'open' && isItemInBranch(sh.branch, purchaseBranch, systemBranches)
      );
      if (activeShift) {
        updatedShift = {
          ...activeShift,
          expensesTotal: (activeShift.expensesTotal || 0) + pur.total
        };
        await api.saveShift(updatedShift);
      }
    }

    const purchaseWithBranch: Purchase = {
      ...pur,
      branch: purchaseBranch
    };

    const saved = await api.savePurchase(purchaseWithBranch);

    // 4. Actualizar estados locales de React de manera reactiva instantánea
    const nextPurchases = [saved, ...purchases.filter(p => p.id !== saved.id)];
    setPurchases(nextPurchases);

    let nextProducts = products;
    if (updatedProductsList.length > 0) {
      const updatedMap = new Map(updatedProductsList.map(p => [p.id, p]));
      nextProducts = products.map(p => updatedMap.get(p.id) || p);
      for (const p of updatedProductsList) {
        if (!nextProducts.some(x => x.id === p.id)) {
          nextProducts.push(p);
        }
      }
      setProducts(nextProducts);
    }

    let nextProviders = providers;
    if (updatedProvider) {
      const up = updatedProvider;
      nextProviders = providers.map(p => p.id === up.id ? up : p);
      setProviders(nextProviders);
    }

    let nextExpenses = expenses;
    if (purchaseExpense) {
      nextExpenses = [purchaseExpense, ...expenses];
      setExpenses(nextExpenses);
    }

    let nextShifts = shifts;
    if (updatedShift) {
      const us = updatedShift;
      nextShifts = shifts.map(sh => sh.id === us.id ? us : sh);
      setShifts(nextShifts);
    }

    notifyBranchSync({ 
      type: 'sync_entity', 
      entity: 'purchases', 
      action: 'save',
      item: saved,
      multiUpdates: {
        purchases: nextPurchases,
        products: nextProducts,
        providers: nextProviders,
        expenses: nextExpenses,
        shifts: nextShifts
      },
      branchId: activeBranch?.id, 
      branchName: purchaseBranch, 
      timestamp: Date.now() 
    });
    return saved;
  };

  // Transferir stock de forma independiente entre dos sucursales
  const onTransferStock = async (
    sourceBranchId: string,
    targetBranchId: string,
    productId: string,
    quantity: number
  ) => {
    const sourceBranchObj = systemBranches.find(b => b.id === sourceBranchId || b.name === sourceBranchId)
      || operationalBranches.find(b => b.id === sourceBranchId || b.name === sourceBranchId);
    const targetBranchObj = systemBranches.find(b => b.id === targetBranchId || b.name === targetBranchId)
      || operationalBranches.find(b => b.id === targetBranchId || b.name === targetBranchId);
    if (!sourceBranchObj || !targetBranchObj) {
      throw new Error('Sucursal de origen o destino no encontrada.');
    }

    const sourceProduct = products.find(p => p.id === productId);
    if (!sourceProduct) {
      throw new Error('Producto a transferir no encontrado.');
    }

    const currentStock = Math.max(0, sourceProduct.stock || 0);
    if (quantity <= 0 || quantity > currentStock) {
      throw new Error(`Cantidad inválida. Stock disponible en ${sourceBranchObj.name}: ${currentStock}`);
    }

    // 1. Descontar de la sucursal origen
    const nextSourceStock = Math.max(0, currentStock - quantity);
    const updatedSourceProduct: Product = {
      ...sourceProduct,
      branch: sourceProduct.branch || sourceBranchObj.name,
      stock: nextSourceStock
    };

    if (sourceProduct.expirationDates && sourceProduct.expirationDates.length > 0) {
      let rem = quantity;
      const updatedSourceLotes = sourceProduct.expirationDates
        .map(r => {
          if (rem <= 0) return r;
          const s = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
          const deduct = Math.min(s, rem);
          rem -= deduct;
          return { ...r, stock: s - deduct };
        })
        .filter(r => (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)) > 0);
      updatedSourceProduct.expirationDates = updatedSourceLotes;
    } else {
      delete updatedSourceProduct.expirationDates;
    }

    await api.saveProduct(updatedSourceProduct);

    // 2. Sumar o crear producto independiente en la sucursal destino
    const existingTargetProduct = products.find(
      p =>
        isItemInBranch(p.branch, targetBranchObj.name, systemBranches) &&
        (p.code.trim().toLowerCase() === sourceProduct.code.trim().toLowerCase() ||
          p.name.trim().toLowerCase() === sourceProduct.name.trim().toLowerCase())
    );

    let savedTargetProduct: Product;
    if (existingTargetProduct) {
      const nextTargetStock = (existingTargetProduct.stock || 0) + quantity;
      const targetLotes = existingTargetProduct.expirationDates
        ? [...existingTargetProduct.expirationDates]
        : [];
      if (targetLotes.length > 0) {
        targetLotes[0] = {
          ...targetLotes[0],
          stock: (Number(targetLotes[0].stock) || 0) + quantity
        };
      }
      savedTargetProduct = {
        ...existingTargetProduct,
        branch: targetBranchObj.name,
        stock: nextTargetStock
      };
      if (targetLotes.length > 0) {
        savedTargetProduct.expirationDates = targetLotes;
      } else if (existingTargetProduct.expirationDates) {
        savedTargetProduct.expirationDates = existingTargetProduct.expirationDates;
      } else {
        delete savedTargetProduct.expirationDates;
      }
      await api.saveProduct(savedTargetProduct);
    } else {
      savedTargetProduct = {
        ...sourceProduct,
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        branch: targetBranchObj.name,
        stock: quantity
      };
      if (sourceProduct.expirationDate) {
        savedTargetProduct.expirationDates = [
          { date: sourceProduct.expirationDate, stock: quantity, batch: sourceProduct.initialBatch || '00101' }
        ];
      } else if (sourceProduct.expirationDates && sourceProduct.expirationDates.length > 0) {
        savedTargetProduct.expirationDates = [
          { date: sourceProduct.expirationDates[0].date, stock: quantity, batch: sourceProduct.expirationDates[0].batch || '00101' }
        ];
      } else {
        delete savedTargetProduct.expirationDates;
      }
      await api.saveProduct(savedTargetProduct);
    }

    const nextProducts = products
      .map(p => p.id === updatedSourceProduct.id ? updatedSourceProduct : p)
      .map(p => p.id === savedTargetProduct.id ? savedTargetProduct : p);
    if (!nextProducts.some(p => p.id === savedTargetProduct.id)) {
      nextProducts.push(savedTargetProduct);
    }
    setProducts(nextProducts);

    notifyBranchSync({ 
      type: 'sync_entity',
      entity: 'products',
      action: 'save',
      item: updatedSourceProduct,
      multiUpdates: { products: nextProducts },
      branchId: activeBranch?.id, 
      branchName: activeBranch?.name, 
      timestamp: Date.now() 
    });
  };

  const onSaveExpense = async (e: Expense) => {
    const expenseBranch = e.branch || activeBranch?.name || '';
    const expenseWithBranch: Expense = { ...e, ...(expenseBranch ? { branch: expenseBranch } : {}) };

    let updatedShift: Shift | undefined;
    // Descontar caja / registrar gasto en el turno activo DE ESTA SUCURSAL
    const activeShift = shifts.find(sh => 
      sh.state === 'open' && isItemInBranch(sh.branch, expenseBranch, systemBranches)
    );
    if (activeShift) {
      updatedShift = {
        ...activeShift,
        branch: activeShift.branch || expenseBranch,
        expensesTotal: (activeShift.expensesTotal || 0) + e.amount
      };
      await api.saveShift(updatedShift);
    }

    const saved = await api.saveExpense(expenseWithBranch);
    const nextExpenses = [saved, ...expenses.filter(x => x.id !== saved.id)];
    setExpenses(nextExpenses);

    let nextShifts = shifts;
    if (updatedShift) {
      const us = updatedShift;
      nextShifts = shifts.map(sh => sh.id === us.id ? us : sh);
      setShifts(nextShifts);
    }

    notifyBranchSync({ 
      type: 'sync_entity',
      entity: 'expenses',
      action: 'save',
      item: saved,
      multiUpdates: { expenses: nextExpenses, shifts: nextShifts },
      branchId: activeBranch?.id, 
      branchName: expenseBranch, 
      timestamp: Date.now() 
    });
    return saved;
  };

  const onDeleteExpense = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    let updatedShift: Shift | undefined;
    if (expense) {
      const activeShift = shifts.find(sh => 
        sh.state === 'open' && isItemInBranch(sh.branch, expense.branch || activeBranch?.name, systemBranches)
      );
      if (activeShift) {
        updatedShift = {
          ...activeShift,
          expensesTotal: Math.max(0, (activeShift.expensesTotal || 0) - expense.amount)
        };
        await api.saveShift(updatedShift);
      }
    }
    const res = await api.deleteExpense(id);
    const nextExpenses = expenses.filter(e => e.id !== id);
    setExpenses(nextExpenses);

    let nextShifts = shifts;
    if (updatedShift) {
      const us = updatedShift;
      nextShifts = shifts.map(sh => sh.id === us.id ? us : sh);
      setShifts(nextShifts);
    }

    notifyBranchSync({ 
      type: 'sync_entity',
      entity: 'expenses',
      action: 'delete',
      id,
      multiUpdates: { expenses: nextExpenses, shifts: nextShifts },
      branchId: activeBranch?.id, 
      branchName: activeBranch?.name, 
      timestamp: Date.now() 
    });
    return res;
  };

  const onSaveShift = async (s: Shift) => {
    const shiftBranch = s.branch || activeBranch?.name || '';
    const shiftWithBranch: Shift = {
      ...s,
      ...(shiftBranch ? { branch: shiftBranch } : {})
    };
    const saved = await api.saveShift(shiftWithBranch);
    const nextShifts = [saved, ...shifts.filter(sh => sh.id !== saved.id)];
    setShifts(nextShifts);

    notifyBranchSync({ 
      type: 'sync_entity',
      entity: 'shifts',
      action: 'save',
      item: saved,
      multiUpdates: { shifts: nextShifts },
      branchId: activeBranch?.id, 
      branchName: shiftWithBranch.branch, 
      timestamp: Date.now() 
    });
    return saved;
  };

  const onSaveConfig = async (cfg: AppConfig) => {
    const saved = await api.saveConfig(cfg);
    setConfig(saved);
    notifyBranchSync({
      type: 'sync_entity',
      entity: 'config',
      action: 'save',
      item: saved,
      multiUpdates: { config: saved },
      branchId: saved.activeBranchId || activeBranch?.id,
      branchName: activeBranch?.name,
      timestamp: Date.now()
    });
    return saved;
  };

  const onUploadFile = async (f: File) => {
    const saved = await api.uploadFile(f);
    notifyBranchSync({ type: 'data_update', branchId: activeBranch?.id, branchName: activeBranch?.name, timestamp: Date.now() });
    await loadAllData();
    return saved;
  };

  const onDeleteFile = async (id: string) => {
    const res = await api.deleteFile(id);
    notifyBranchSync({ type: 'data_update', branchId: activeBranch?.id, branchName: activeBranch?.name, timestamp: Date.now() });
    await loadAllData();
    return res;
  };

  const onAskAI = async (prompt: string) => {
    return api.askAI(prompt, branchProducts, branchSales, branchExpenses, config);
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
        <div className="bg-white rounded-2xl w-full max-w-md p-5 sm:p-8 shadow-2xl space-y-6 border border-slate-100/10">
          
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

            {authMode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    const email = authEmail.trim() || prompt('Ingrese su correo electrónico para recibir el enlace de restablecimiento:');
                    if (!email) return;
                    try {
                      await api.sendPasswordReset(email);
                      alert(`✓ Se ha enviado el enlace seguro de restablecimiento de contraseña a ${email}. Revise su bandeja de entrada.`);
                    } catch (err: any) {
                      alert('Error al enviar restablecimiento: ' + (err.message || err));
                    }
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {authError && (
              <div className={`${api.isQuotaExceededError(authError) ? 'bg-amber-50 text-amber-950 border-amber-300' : 'bg-red-50 text-red-600 border-red-200'} border rounded-xl p-3.5 text-xs space-y-2`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${api.isQuotaExceededError(authError) ? 'text-amber-600' : 'text-red-500'}`} />
                  <div className="space-y-1">
                    <p className={`font-bold ${api.isQuotaExceededError(authError) ? 'text-amber-900' : 'text-red-700'}`}>
                      {api.isQuotaExceededError(authError) ? 'Límite de lecturas de Firestore alcanzado' : 'Aviso de autenticación'}
                    </p>
                    <p className="text-slate-700 leading-relaxed">{authError}</p>
                  </div>
                </div>
                {api.isQuotaExceededError(authError) && (
                  <div className="pt-2 border-t border-amber-200 flex flex-col gap-2">
                    <p className="text-[11px] text-slate-600">
                      Su base de datos secundaria está limitada por la cuota gratuita (50,000 lecturas/día). Aunque el proyecto tenga plan Blaze, debe abrir la consola y hacer clic en <strong>Habilitar facturación / Actualizar base de datos</strong>:
                    </p>
                    <a
                      href={api.FIRESTORE_UPGRADE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
                    >
                      <span>Abrir Firebase Console para actualizar base de datos</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
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
    
    if (userLicense.expirationDate) {
      const daysLeft = calculateDaysRemaining(userLicense.expirationDate);
      if (daysLeft <= 2 && daysLeft > 0) {
        return 'Por vencer';
      }
      if (daysLeft <= 0) {
        return 'Expirada';
      }
      return 'Activa';
    }

    if (userLicense.status === 'Por vencer' || userLicense.status === 'Por Vencer') return 'Por vencer';
    return userLicense.status || 'Activa';
  };

  // --- FULL LAYOUT (SIDEBAR + CONTENT PANELS) ---

  const sidebarTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'punto-de-venta', label: 'Punto de Venta', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'cotizaciones', label: 'Cotizaciones / Proformas', icon: <FileText className="w-4 h-4 text-sky-400" /> },
    { id: 'inventario', label: 'Inventario', icon: <Package className="w-4 h-4" /> },
    { id: 'historial-ventas', label: 'Historial de Ventas', icon: <History className="w-4 h-4 text-emerald-400" /> },
    { id: 'compras', label: 'Gestión Compras', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'vencimientos', label: 'Vencimientos', icon: <Calendar className="w-4 h-4" /> },
    { id: 'complementos', label: 'Complementos', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
    { id: 'clientes', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
    { id: 'proveedores', label: 'Proveedores', icon: <Truck className="w-4 h-4" /> },
    { id: 'gastos', label: 'Gastos', icon: <TrendingDown className="w-4 h-4" /> },
    { id: 'apertura-cierre', label: 'Apertura y Cierre', icon: <Inbox className="w-4 h-4" /> },
    { id: 'reportes', label: 'Reportes Diarios', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'sucursales', label: 'Sucursales', icon: <Building2 className="w-4 h-4" /> },
    { id: 'configuracion', label: 'Configuración', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  const visibleSidebarTabs = sidebarTabs.filter((tab) => {
    if (tab.id === 'sucursales' && !canManageBranches) {
      return false;
    }
    if (user?.isOperator && (user.disabledTabs?.includes(tab.id) || (tab.id === 'historial-ventas' && user.disabledTabs?.includes('libro-ventas')))) {
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
        return (
          <Dashboard
            products={branchProducts}
            sales={sales}
            expenses={expenses}
            shifts={shifts}
            config={config}
            onNavigate={setActiveTab}
            user={user}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
      case 'punto-de-venta':
        return (
          <POS 
            products={branchProducts} 
            clients={branchClients} 
            shifts={branchShifts} 
            config={config} 
            user={user!}
            onSaveSale={onSaveSale} 
            onRefreshData={loadAllData} 
            onNavigate={setActiveTab}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
      case 'cotizaciones':
        return (
          <Quotations
            products={branchProducts}
            clients={branchClients}
            config={config}
            user={user}
            activeBranch={activeBranch?.name}
            currency={config.currency}
            onBackToPOS={() => setActiveTab('punto-de-venta')}
            onClientCreated={() => {
              loadAllData();
            }}
            onNavigateToPOS={(items, client) => {
              sessionStorage.setItem('yaa_pos_proforma_to_cart', JSON.stringify({ items, client }));
              setActiveTab('punto-de-venta');
            }}
          />
        );
      case 'inventario':
        return (
          <Inventory 
            products={branchProducts} 
            allProducts={products}
            config={config} 
            onSaveProduct={onSaveProduct} 
            onDeleteProduct={onDeleteProduct} 
            onRefreshData={loadAllData} 
            sales={branchSales}
            purchases={branchPurchases}
            user={user}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
            onTransferStock={onTransferStock}
          />
        );
      case 'historial-ventas':
      case 'libro-ventas':
        return (
          <SalesLedger 
            sales={sales}
            clients={branchClients}
            config={config}
            products={branchProducts}
            user={user}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
      case 'compras':
        return (
          <Purchasing 
            products={branchProducts} 
            providers={branchProviders} 
            purchases={purchases} 
            currency={config.currency} 
            config={config}
            user={user}
            activeBranchName={activeBranch?.name}
            onSwitchBranch={handleSwitchActiveBranch}
            onSavePurchase={onSavePurchase} 
            onSaveProduct={onSaveProduct}
            onRefreshData={loadAllData} 
          />
        );
      case 'vencimientos':
        return (
          <Expirations 
            products={branchProducts} 
            config={config} 
            onSaveProduct={onSaveProduct} 
            onRefreshData={loadAllData}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
      case 'complementos':
        return (
          <Complementos 
            files={branchFiles} 
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
            clients={branchClients} 
            providers={branchProviders} 
            currency={config.currency} 
            onSaveClient={onSaveClient} 
            onDeleteClient={onDeleteClient} 
            onSaveProvider={onSaveProvider} 
            onDeleteProvider={onDeleteProvider} 
            onClientPayment={onClientPayment}
            onProviderPayment={onProviderPayment}
            onRefreshData={loadAllData} 
            mode="clients"
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
      case 'proveedores':
        return (
          <ClientsProviders 
            clients={branchClients} 
            providers={branchProviders} 
            currency={config.currency} 
            onSaveClient={onSaveClient} 
            onDeleteClient={onDeleteClient} 
            onSaveProvider={onSaveProvider} 
            onDeleteProvider={onDeleteProvider} 
            onClientPayment={onClientPayment}
            onProviderPayment={onProviderPayment}
            onRefreshData={loadAllData} 
            mode="providers"
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
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
            config={config}
            user={user}
            activeBranchName={activeBranch?.name}
            onSwitchBranch={handleSwitchActiveBranch}
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
            user={user}
            config={config}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
      case 'reportes':
        return (
          <DailyReports
            sales={sales}
            expenses={expenses}
            clients={branchClients}
            config={config}
            products={branchProducts}
            onNavigate={setActiveTab}
            user={user}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
      case 'sucursales':
        return (
          <Branches
            config={config}
            products={products}
            branchProducts={branchProducts}
            user={user}
            userLicense={userLicense}
            onOpenPlanUpgrade={() => setIsPlanUpgradeModalOpen(true)}
            onSaveConfig={onSaveConfig}
            onNavigate={setActiveTab}
            sales={sales}
            shifts={shifts}
            expenses={expenses}
            purchases={purchases}
            activeBranchName={activeBranch?.name}
            onSwitchBranch={handleSwitchActiveBranch}
            onTransferStock={onTransferStock}
          />
        );
      case 'configuracion':
        return (
          <Settings 
            config={config} 
            user={user} 
            userLicense={userLicense}
            onOpenPlanUpgrade={() => setIsPlanUpgradeModalOpen(true)}
            onSaveConfig={onSaveConfig} 
          />
        );
      default:
        return (
          <Dashboard
            products={branchProducts}
            sales={sales}
            expenses={expenses}
            shifts={shifts}
            config={config}
            onNavigate={setActiveTab}
            user={user}
            activeBranchName={activeBranch?.name}
            branches={operationalBranches}
            onSwitchBranch={handleSwitchActiveBranch}
          />
        );
    }
  };

  const hasPendingSync = Object.values(pendingWrites).some(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      {/* Banner for "Por vencer" (2 días antes de vencer) */}
      {user && user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && getLicenseStatus() === 'Por vencer' && (
        <div className="bg-amber-500 text-slate-900 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 z-40 shrink-0 shadow-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Su plan vencerá en {calculateDaysRemaining(userLicense?.expirationDate || '')} {calculateDaysRemaining(userLicense?.expirationDate || '') === 1 ? 'día' : 'días'}. Comuníquese con el administrador para renovarlo.</span>
        </div>
      )}
      
      {/* MOBILE HEADER NAVBAR */}
      <div className="md:hidden bg-[#172B4D] text-white px-3.5 py-2.5 relative flex items-center justify-between border-b border-white/10 shrink-0 min-h-[52px]">
        {/* Left Action: ArrowLeft to return to Dashboard when inside any module */}
        <div className="flex items-center z-10 min-w-[32px]">
          {activeTab !== 'dashboard' && (
            <button
              id="btn-mobile-back-dashboard"
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="p-1 -ml-1 text-white hover:text-white/80 active:scale-95 transition-all cursor-pointer flex items-center justify-center bg-transparent border-0 outline-none"
              title="Regresar al Dashboard"
              aria-label="Regresar al Dashboard"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5] text-white" />
            </button>
          )}
        </div>

        {/* Centered Store Name & Active Section */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-[60%] truncate pointer-events-none">
          <span className="text-sm font-bold text-white tracking-wide block truncate">
            {config.storeName || 'Yaa POS'}
          </span>
          <span className="text-[10px] text-blue-300 font-medium tracking-wider uppercase block -mt-0.5 truncate">
            {sidebarTabs.find(t => t.id === activeTab)?.label || 'Punto de Venta'}
            {activeBranch?.code ? ` • ${activeBranch.code}` : ''}
          </span>
        </div>

        {/* Right Connectivity Status */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 ml-auto">
          {isOnline ? (
            hasPendingSync ? (
              <div className="flex items-center gap-1 bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-medium" title="Sincronizando cambios locales con el servidor...">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="hidden sm:inline">Sincronizando</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-medium" title="Conectado y sincronizado">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="hidden sm:inline">En línea</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-medium" title="Sin conexión">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}
          {isDataLoading && (
            <Loader2 className="w-4 h-4 text-blue-300 animate-spin shrink-0" />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* 1. SIDEBAR (#172B4D) - ADAPTIVE ON TABLET AND DESKTOP */}
        <aside className={`hidden md:flex ${
          isSidebarCollapsed ? 'w-18' : 'w-64'
        } bg-[#172B4D] text-slate-200 flex-col justify-between shrink-0 border-r border-[#243B61] transition-all duration-200`}>
          
          {/* Top Header Brand */}
          <div className="px-4 py-4 border-b border-[#243B61] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                Y
              </div>
              <div className={`min-w-0 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                <span className="text-sm font-bold text-white tracking-tight block leading-tight">Yaa POS</span>
                <span className="text-[10px] text-slate-400 font-medium">Sistema POS</span>
              </div>
            </div>
            {isDataLoading && (
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
            )}
          </div>

          {/* Navigation Links list */}
          <nav className="px-2.5 py-3 space-y-1 overflow-y-auto flex-1 max-h-[calc(100vh-170px)]">
            {user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && (
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer uppercase tracking-wider mb-2 shrink-0 ${
                  isSidebarCollapsed ? 'px-1' : ''
                }`}
                title="Consola Admin"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                <span className={isSidebarCollapsed ? 'hidden' : 'inline'}>Consola Admin</span>
              </button>
            )}

            {visibleSidebarTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#2563EB] text-white font-semibold shadow-xs' 
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={tab.label}
                >
                  <span className={`flex items-center gap-2.5 min-w-0 truncate ${
                    isSidebarCollapsed ? 'justify-center w-full' : ''
                  }`}>
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
                      {tab.icon}
                    </span>
                    <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'inline'}`}>{tab.label}</span>
                  </span>
                  {tab.id === 'sucursales' && activeBranch?.code && !isSidebarCollapsed && (
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-black/25 text-blue-300'}`}
                    >
                      {activeBranch.code}
                    </span>
                  )}
                  {tab.id === 'apertura-cierre' && !isSidebarCollapsed && (
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                        activeBranchOpenShift 
                          ? (isActive ? 'bg-emerald-500/30 text-emerald-100' : 'bg-emerald-500/20 text-emerald-300')
                          : (isActive ? 'bg-amber-500/30 text-amber-100' : 'bg-amber-500/20 text-amber-300')
                      }`}
                    >
                      {activeBranchOpenShift ? 'Abierta' : 'Cerrada'}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom profile and logout */}
          <div className="border-t border-[#243B61] px-3.5 py-3.5 space-y-2.5 shrink-0 bg-[#112038]">
            <div className={`flex items-center gap-2.5 px-1 ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}>
              <div className="w-7 h-7 bg-white/10 text-blue-300 rounded-md flex items-center justify-center shrink-0 text-xs font-bold font-mono">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className={`min-w-0 flex-1 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{user.email}</p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className={`w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 hover:text-red-200 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 border border-red-500/20 cursor-pointer transition-colors ${
                isSidebarCollapsed ? 'px-0' : 'px-2'
              }`}
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className={isSidebarCollapsed ? 'hidden' : 'inline'}>Cerrar Sesión</span>
            </button>
          </div>
        </aside>

        {/* 2. MAIN ACTIVE VIEWPORT & DISCREET DESKTOP TOPBAR */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F5F7FA] overflow-hidden">
          {/* DISCREET TOPBAR (DESKTOP & TABLET) */}
          <header className="hidden md:flex h-14 bg-white border-b border-[#E2E8F0] px-4 lg:px-6 items-center justify-between shrink-0 z-10 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              {/* Sidebar Toggle Button (Desktop & Tablet) */}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden md:flex p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title={isSidebarCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
              >
                <Menu className="w-4 h-4" />
              </button>

              <h2 className="text-sm font-bold text-[#1F2937] tracking-tight flex items-center gap-2 truncate">
                {sidebarTabs.find(t => t.id === activeTab)?.icon}
                <span>{sidebarTabs.find(t => t.id === activeTab)?.label || 'Panel Principal'}</span>
              </h2>

              {activeBranch?.name && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-[#E2E8F0] px-2.5 py-1 rounded-md text-xs font-medium text-[#1F2937]">
                  <Building2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span className="truncate">{activeBranch.name}</span>
                  {activeBranch.code && (
                    <span className="text-[10px] font-mono text-slate-500 font-bold ml-0.5">({activeBranch.code})</span>
                  )}
                </div>
              )}

              {/* Shift status indicator */}
              <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                activeBranchOpenShift 
                  ? 'bg-emerald-50 text-[#16A34A] border-emerald-200' 
                  : 'bg-slate-50 text-[#64748B] border-[#E2E8F0]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeBranchOpenShift ? 'bg-[#16A34A]' : 'bg-slate-400'}`} />
                <span>{activeBranchOpenShift ? 'Caja Abierta' : 'Caja Cerrada'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Branch Switcher (when multiple branches available) */}
              {operationalBranches && operationalBranches.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#64748B] font-medium hidden xl:inline">Sede:</span>
                  <select
                    value={activeBranch?.id || ''}
                    onChange={(e) => handleSwitchActiveBranch(e.target.value)}
                    className="h-8 bg-white border border-[#E2E8F0] rounded-md px-2.5 text-xs font-medium text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                  >
                    {operationalBranches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Network / Sync status indicator */}
              <div className="flex items-center gap-1.5 text-xs text-[#64748B] pl-2 border-l border-[#E2E8F0]">
                {isOnline ? (
                  hasPendingSync ? (
                    <div className="flex items-center gap-1 text-[#2563EB]">
                      <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
                      <span className="font-medium text-[11px]">Sincronizando</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[#16A34A]">
                      <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                      <span className="font-medium text-[11px]">En línea</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-1 text-amber-600">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-medium text-[11px]">Sin conexión</span>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* MAIN SCROLLABLE CONTENT VIEWPORT */}
          <main className={`flex-1 p-3.5 sm:p-5 lg:p-7 ${
            activeTab === 'dashboard' ? 'pb-24' : 'pb-4'
          } md:pb-7 overflow-y-auto max-h-screen bg-[#F5F7FA]`}>
            <ErrorBoundary key={`${activeTab}-${activeBranch?.id || 'all'}`}>
              {renderActiveComponent()}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* 3. MOBILE & IPHONE BOTTOM NAVIGATION BAR (TOUCH-OPTIMIZED FOR PHONES) */}
      <nav 
        id="mobile-bottom-navbar" 
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#172B4D] text-white border-t border-white/10 shadow-lg px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none transition-all duration-300 ${
          activeTab === 'dashboard'
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none hidden'
        }`}
      >
        {/* 1. Dashboard */}
        <button
          id="btn-nav-dashboard"
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === 'dashboard' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-md transition-all ${
            activeTab === 'dashboard' ? 'bg-[#2563EB] text-white' : 'hover:bg-white/5'
          }`}>
            <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <span className={`text-[10px] sm:text-[11px] mt-0.5 block truncate tracking-tight ${
            activeTab === 'dashboard' ? 'font-bold text-white' : 'font-medium'
          }`}>
            Dashboard
          </span>
        </button>

        {/* 2. Punto de Venta */}
        <button
          id="btn-nav-venta"
          type="button"
          onClick={() => setActiveTab('punto-de-venta')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 transition-all active:scale-95 cursor-pointer ${
            activeTab === 'punto-de-venta' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-md transition-all ${
            activeTab === 'punto-de-venta' ? 'bg-[#2563EB] text-white' : 'hover:bg-white/5'
          }`}>
            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <span className={`text-[9px] sm:text-[10.5px] tracking-tight mt-0.5 whitespace-nowrap ${
            activeTab === 'punto-de-venta' ? 'font-bold text-white' : 'font-medium'
          }`}>
            Punto de Venta
          </span>
        </button>

        {/* 3. Inventario */}
        <button
          id="btn-nav-inventario"
          type="button"
          onClick={() => setActiveTab('inventario')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === 'inventario' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-md transition-all ${
            activeTab === 'inventario' ? 'bg-[#2563EB] text-white' : 'hover:bg-white/5'
          }`}>
            <Package className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <span className={`text-[10px] sm:text-[11px] tracking-tight mt-0.5 truncate ${
            activeTab === 'inventario' ? 'font-bold text-white' : 'font-medium'
          }`}>
            Inventario
          </span>
        </button>

        {/* 4. Compras */}
        <button
          id="btn-nav-compras"
          type="button"
          onClick={() => setActiveTab('compras')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === 'compras' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-md transition-all ${
            activeTab === 'compras' ? 'bg-[#2563EB] text-white' : 'hover:bg-white/5'
          }`}>
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <span className={`text-[10px] sm:text-[11px] tracking-tight mt-0.5 truncate ${
            activeTab === 'compras' ? 'font-bold text-white' : 'font-medium'
          }`}>
            Compras
          </span>
        </button>

        {/* 5. Menú */}
        <button
          id="btn-nav-menu"
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition-all active:scale-95 cursor-pointer ${
            !['dashboard', 'punto-de-venta', 'inventario', 'compras'].includes(activeTab)
              ? 'text-white' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-md transition-all ${
            !['dashboard', 'punto-de-venta', 'inventario', 'compras'].includes(activeTab)
              ? 'bg-[#2563EB] text-white' 
              : 'hover:bg-white/5'
          }`}>
            <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <span className={`text-[10px] sm:text-[11px] tracking-tight mt-0.5 truncate ${
            !['dashboard', 'punto-de-venta', 'inventario', 'compras'].includes(activeTab)
              ? 'font-bold text-white' 
              : 'font-medium'
          }`}>
            Menú
          </span>
        </button>
      </nav>

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
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  {config.storeName || 'Yaa POS'}
                  {user?.isOperator && (user.branches?.length || (user.branch && user.branch !== 'Todas')) && (
                    <span className="text-emerald-600 font-bold ml-1.5">• Sede: {user.branches?.join(', ') || user.branch}</span>
                  )}
                </span>
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
              
              {/* Historial de Ventas */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('historial-ventas');
                  setIsMobileMenuOpen(false);
                }}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-13 h-13 rounded-full bg-[#112356] text-emerald-400 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <History className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                  Historial Ventas
                </span>
              </button>

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

              {/* 8. Sucursales (Solo visible si el plan permite más de 1 sucursal) */}
              {canManageBranches && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('sucursales');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-13 h-13 rounded-full bg-[#112356] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <Building2 className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700 mt-2 tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
                    Sucursales
                  </span>
                </button>
              )}

              {/* 9. Configuración */}
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

      {/* Plan Upgrade & Switch Modal */}
      {user && (
        <PlanModal
          isOpen={isPlanUpgradeModalOpen}
          onClose={() => setIsPlanUpgradeModalOpen(false)}
          userId={user.id}
          userLicense={userLicense}
          currentBranchesCount={operationalBranches.length}
          currentUsersCount={operatorsCount}
          currentProductsCount={products.length}
          onPlanUpdated={(newLic) => {
            setUserLicense(newLic);
          }}
        />
      )}

    </div>
  );
}
