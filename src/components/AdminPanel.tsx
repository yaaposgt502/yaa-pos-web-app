import React, { useEffect, useState, useMemo } from 'react';
import * as api from '../api';
import { User, UserFile, License } from '../types';
import { 
  Shield, 
  Users, 
  FileText, 
  LogOut, 
  Calendar, 
  Mail, 
  User as UserIcon, 
  Download, 
  ExternalLink, 
  Clock, 
  Search,
  Loader2,
  HardDrive,
  LayoutDashboard,
  ShoppingCart,
  ShieldCheck,
  Plus,
  Edit,
  Lock,
  Unlock,
  Eye,
  BarChart,
  Settings,
  Info,
  Check,
  AlertCircle,
  X,
  CreditCard,
  Building,
  Building2,
  Activity,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  Globe,
  Percent,
  Layers,
  Store,
  DollarSign,
  Wallet,
  CheckCircle,
  XCircle,
  TrendingUp,
  MapPin,
  FileSpreadsheet,
  Package,
  Sparkles,
  Menu
} from 'lucide-react';
import { PlanDefinition, getAllPlans, getPlanDefinition, savePlans } from '../utils/planLimits';
import { toLocalDateString } from '../utils/dateHelper';
import PlanModal from './PlanModal';

interface AdminPanelProps {
  user: User;
  onLogout: () => void;
  onViewPOS: () => void;
}

export default function AdminPanel({ user, onLogout, onViewPOS }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFiles, setUserFiles] = useState<UserFile[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sidebar navigation tab state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileAdminNavOpen, setIsMobileAdminNavOpen] = useState(false);

  // Licenses persistence state
  const [licenses, setLicenses] = useState<License[]>([]);
  
  // Modal toggles & states
  const [isNewLicenseModalOpen, setIsNewLicenseModalOpen] = useState(false);
  const [isEditLicenseModalOpen, setIsEditLicenseModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [isFilesDrawerOpen, setIsFilesDrawerOpen] = useState(false);

  // State for renewing license modal
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewingLicenseUser, setRenewingLicenseUser] = useState<License | null>(null);
  const [renewDuration, setRenewDuration] = useState<30 | 365>(30);

  // Form states for Create License
  const [formUserId, setFormUserId] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formClientEmail, setFormClientEmail] = useState('');
  const [formPlanType, setFormPlanType] = useState('Básico');
  const [formExpirationDate, setFormExpirationDate] = useState('');
  const [formStatus, setFormStatus] = useState<License['status']>('Activa');

  // Synchronized Plans catalog state
  const [plans, setPlans] = useState<PlanDefinition[]>(() => getAllPlans());
  const [isPreviewPlanModalOpen, setIsPreviewPlanModalOpen] = useState(false);

  useEffect(() => {
    const handlePlansUpdated = () => {
      setPlans(getAllPlans());
    };
    window.addEventListener('yaa_pos_plans_updated', handlePlansUpdated);
    window.addEventListener('storage', handlePlansUpdated);
    return () => {
      window.removeEventListener('yaa_pos_plans_updated', handlePlansUpdated);
      window.removeEventListener('storage', handlePlansUpdated);
    };
  }, []);

  // Plan creation & editing modal states
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanDefinition | null>(null);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planPeriod, setPlanPeriod] = useState('/mes');
  const [planBadge, setPlanBadge] = useState('Activo');
  const [planFeaturesText, setPlanFeaturesText] = useState('');
  const [planStatus, setPlanStatus] = useState('Activo');
  const [planMaxBranches, setPlanMaxBranches] = useState<number>(1);
  const [planMaxUsers, setPlanMaxUsers] = useState<number>(3);
  const [planMaxProducts, setPlanMaxProducts] = useState<number>(250);
  const [planFelAllowed, setPlanFelAllowed] = useState<boolean>(false);
  const [planAiAssistantAllowed, setPlanAiAssistantAllowed] = useState<boolean>(false);
  const [planMultiBranchAllowed, setPlanMultiBranchAllowed] = useState<boolean>(false);
  const [countries, setCountries] = useState([
    { id: 'GT', name: 'Guatemala', currency: 'Q (GTQ)', defaultTax: 12, taxName: 'IVA', isDefault: true },
    { id: 'PE', name: 'Perú', currency: 'S/ (PEN)', defaultTax: 18, taxName: 'IGV', isDefault: false },
    { id: 'MX', name: 'México', currency: '$ (MXN)', defaultTax: 16, taxName: 'IVA', isDefault: false },
    { id: 'CO', name: 'Colombia', currency: '$ (COP)', defaultTax: 19, taxName: 'IVA', isDefault: false },
    { id: 'US', name: 'Estados Unidos', currency: '$ (USD)', defaultTax: 0, taxName: 'Sales Tax', isDefault: false },
  ]);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 'efectivo', name: 'Efectivo', type: 'Local', enabled: true, fee: '0%' },
    { id: 'tarjeta', name: 'Tarjeta Débito / Crédito (Visa / Mastercard)', type: 'Pasarela', enabled: true, fee: '3.5%' },
    { id: 'transferencia', name: 'Transferencia Bancaria Directa', type: 'Local', enabled: true, fee: '0%' },
    { id: 'qr', name: 'Pago con QR / Billetera Digital', type: 'Digital', enabled: true, fee: '1.5%' },
    { id: 'credito', name: 'Crédito / Cuenta Corriente', type: 'Interno', enabled: true, fee: '0%' },
  ]);

  // Config states
  const [appName, setAppName] = useState(() => localStorage.getItem('yaa_pos_admin_app_name') || 'Yaa POS');
  const [smtpServer, setSmtpServer] = useState(() => localStorage.getItem('yaa_pos_admin_smtp') || 'smtp.yaapos.com');
  const [backupFreq, setBackupFreq] = useState(() => localStorage.getItem('yaa_pos_admin_backup') || 'Cada 24 horas (Recomendado)');
  const [storageLimit, setStorageLimit] = useState(() => localStorage.getItem('yaa_pos_admin_storage') || '250 MB');
  const [showConfigSuccess, setShowConfigSuccess] = useState(false);

  const [rawCloudLicenses, setRawCloudLicenses] = useState<License[]>([]);
  const [hasLoadedCloudLicenses, setHasLoadedCloudLicenses] = useState(false);

  // Real-time synchronization of users and licenses from Firestore across all devices (desktop, tablet, mobile)
  useEffect(() => {
    let isMounted = true;
    setIsUsersLoading(true);
    setError(null);

    const deduplicateAndSortUsers = (list: User[]): User[] => {
      const uniqueList: User[] = [];
      const seenIds = new Set<string>();
      for (const u of list) {
        if (u.id && !seenIds.has(u.id)) {
          seenIds.add(u.id);
          uniqueList.push(u);
        }
      }
      return uniqueList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    };

    api.getAdminUsers()
      .then((list) => {
        if (!isMounted) return;
        setUsers(deduplicateAndSortUsers(list));
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error('Error fetching admin users:', err);
        setError(err.message || 'Error al cargar los usuarios de Firestore');
      })
      .finally(() => {
        if (isMounted) setIsUsersLoading(false);
      });

    api.getAdminLicenses()
      .then((list) => {
        if (!isMounted) return;
        setRawCloudLicenses(list);
        setHasLoadedCloudLicenses(true);
      })
      .catch((err) => {
        console.error('Error loading initial licenses from Firestore:', err);
        if (isMounted) setHasLoadedCloudLicenses(true);
      });

    const unsubUsers = api.subscribeAdminUsers((liveUsers) => {
      if (!isMounted) return;
      setUsers(deduplicateAndSortUsers(liveUsers));
      setIsUsersLoading(false);
    });

    const unsubLicenses = api.subscribeAdminLicenses((liveLicenses) => {
      if (!isMounted) return;
      setRawCloudLicenses(liveLicenses);
      setHasLoadedCloudLicenses(true);
    });

    return () => {
      isMounted = false;
      unsubUsers();
      unsubLicenses();
    };
  }, []);

  // Reconcile users and cloud licenses so every device displays the exact same status
  useEffect(() => {
    if (!hasLoadedCloudLicenses && users.length === 0) return;

    const mergedMap = new Map<string, License>();
    const usersById = new Map<string, User>();
    users.forEach((u) => {
      if (u.id) usersById.set(u.id, u);
    });

    // 1. Populate with live Firestore licenses (authoritative source of truth across all devices)
    rawCloudLicenses.forEach((l) => {
      if (!l.userId) return;
      const targetUser = usersById.get(l.userId);
      const resolved = api.resolveCompanyLicenseState(l, targetUser);
      const normalizedLic: License = {
        ...l,
        status: resolved
      };
      mergedMap.set(l.userId, normalizedLic);

      // Auto-heal Firestore license document if its stored status differs from the resolved state (e.g., expired by date)
      if (l.status !== resolved && user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
        api.saveAdminLicense(normalizedLic).catch((err) =>
          console.error('Error auto-syncing resolved license status to Firestore:', err)
        );
      }

      // Auto-heal user accountStatus if out of sync with license status
      if (targetUser && user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
        const expectedAccountStatus =
          resolved === 'Suspendida'
            ? 'Suspendida'
            : resolved === 'Desactivada'
            ? 'Desactivada'
            : 'Activa';
        if ((targetUser.accountStatus || 'Activa') !== expectedAccountStatus) {
          api.saveAdminUser({
            ...targetUser,
            accountStatus: expectedAccountStatus
          }).catch((err) =>
            console.error('Error auto-syncing user accountStatus to Firestore:', err)
          );
        }
      }
    });

    // 2. Ensure all registered users have a consistent license entry derived from their user profile
    users.forEach((u) => {
      if (!mergedMap.has(u.id)) {
        const defaultExp =
          (u as any).licenseExpiresAt ||
          toLocalDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
        const initialStatus =
          u.accountStatus === 'Suspendida'
            ? 'Suspendida'
            : u.accountStatus === 'Desactivada'
            ? 'Desactivada'
            : api.isLicenseDateExpired(defaultExp)
            ? 'Expirada'
            : 'Activa';

        const newLic: License = {
          userId: u.id,
          clientName: u.name || 'Empresa',
          clientEmail: u.email || '',
          application: 'Yaa POS',
          planType: (u as any).plan || 'Básico',
          licenseStartDate: u.createdAt ? u.createdAt.split('T')[0] : toLocalDateString(),
          expirationDate: defaultExp,
          status: initialStatus
        };
        mergedMap.set(u.id, newLic);

        if (hasLoadedCloudLicenses && user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
          api.saveAdminLicense(newLic).catch((err) =>
            console.error('Error saving default user license to Firestore:', err)
          );
        }
      }
    });

    const updated = Array.from(mergedMap.values());
    setLicenses(updated);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
  }, [users, rawCloudLicenses, hasLoadedCloudLicenses, user.id]);

  // Load files for selected user
  const handleSelectUser = async (targetUser: User) => {
    setSelectedUser(targetUser);
    setIsFilesLoading(true);
    setUserFiles([]);
    try {
      const files = await api.getAdminUserFiles(targetUser.id);
      setUserFiles(files);
    } catch (err: any) {
      console.error('Error fetching files for user:', targetUser.id, err);
      setError(`Error al cargar archivos de ${targetUser.name}: ${err.message}`);
    } finally {
      setIsFilesLoading(false);
    }
  };

  // Inspect client from the license table
  const handleInspectClient = async (lic: License) => {
    const targetUser = users.find(u => u.id === lic.userId) || {
      id: lic.userId,
      name: lic.clientName,
      email: lic.clientEmail
    } as User;
    
    await handleSelectUser(targetUser);
    setIsFilesDrawerOpen(true);
  };

  // Helper to persist both license and user accountStatus atomically so all devices stay in sync
  const persistLicenseAndUserSync = async (targetLicense: License) => {
    const rawStatus = String(targetLicense.status || '').trim();
    let normalizedStatus: License['status'] =
      rawStatus === 'Activo' || rawStatus === 'Activa' || rawStatus === 'Por Vencer' || rawStatus === 'Por vencer'
        ? 'Activa'
        : rawStatus === 'Vencida' || rawStatus === 'Expirada'
        ? 'Expirada'
        : rawStatus === 'Suspendida'
        ? 'Suspendida'
        : rawStatus === 'Desactivada'
        ? 'Desactivada'
        : rawStatus === 'Pendiente'
        ? 'Pendiente'
        : 'Activa';

    let finalExpirationDate = targetLicense.expirationDate;
    const todayStr = toLocalDateString();

    if (normalizedStatus === 'Activa') {
      // Ensure an explicitly activated license has a valid non-expired date so it does not immediately resolve to Expirada
      if (!finalExpirationDate || api.isLicenseDateExpired(finalExpirationDate)) {
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        finalExpirationDate = toLocalDateString(nextMonth);
      }
    } else if (normalizedStatus === 'Expirada') {
      // If admin explicitly marks license as Expirada and date was in the future, adjust expirationDate to yesterday
      if (!finalExpirationDate || !api.isLicenseDateExpired(finalExpirationDate)) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        finalExpirationDate = toLocalDateString(yesterday);
      }
    }

    const syncedLicense: License = {
      ...targetLicense,
      expirationDate: finalExpirationDate,
      licenseStartDate: targetLicense.licenseStartDate || todayStr,
      status: normalizedStatus
    };

    const expectedAccountStatus: User['accountStatus'] =
      normalizedStatus === 'Suspendida'
        ? 'Suspendida'
        : normalizedStatus === 'Desactivada'
        ? 'Desactivada'
        : 'Activa';

    setRawCloudLicenses((prev) => {
      const exists = prev.some((l) => l.userId === syncedLicense.userId);
      return exists
        ? prev.map((l) => (l.userId === syncedLicense.userId ? syncedLicense : l))
        : [syncedLicense, ...prev];
    });

    setLicenses((prev) => {
      const exists = prev.some((l) => l.userId === syncedLicense.userId);
      const next = exists
        ? prev.map((l) => (l.userId === syncedLicense.userId ? syncedLicense : l))
        : [syncedLicense, ...prev];
      localStorage.setItem('yaa_pos_licenses', JSON.stringify(next));
      return next;
    });

    const targetUser = users.find(
      (u) => u.id === syncedLicense.userId || (syncedLicense.clientEmail && u.email === syncedLicense.clientEmail)
    );
    let updatedUser: User | null = null;
    if (targetUser) {
      updatedUser = {
        ...targetUser,
        accountStatus: expectedAccountStatus,
        plan: syncedLicense.planType,
        licenseExpiresAt: syncedLicense.expirationDate
      };
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? updatedUser! : u)));
    }

    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));

    await api.saveAdminLicense(syncedLicense);
    if (updatedUser) {
      await api.saveAdminUser(updatedUser);
    }
  };

  // Create new license submit handler
  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('Acceso Denegado: Su usuario no tiene permisos para realizar esta acción. ID de administrador requerido: uSEwpR9zZPWvekBQKdx1SMsrs7n1');
      return;
    }
    if (!formClientName || !formClientEmail) {
      alert('Por favor complete el nombre y correo del cliente');
      return;
    }

    const matchedUser = users.find(
      (u) => u.id === formUserId || u.email.toLowerCase() === formClientEmail.trim().toLowerCase()
    );
    const newId = matchedUser?.id || formUserId || 'usr_' + Math.random().toString(36).substr(2, 9);
    const defaultExp = toLocalDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const newLic: License = {
      userId: newId,
      clientName: formClientName.trim(),
      clientEmail: formClientEmail.trim(),
      application: 'Yaa POS',
      planType: formPlanType,
      licenseStartDate: toLocalDateString(),
      expirationDate: formExpirationDate || defaultExp,
      status: formStatus
    };

    try {
      await persistLicenseAndUserSync(newLic);
    } catch (err: any) {
      console.error('Error saving new license to Firestore:', err);
    }

    // Close modal and reset fields
    setIsNewLicenseModalOpen(false);
    setFormUserId('');
    setFormClientName('');
    setFormClientEmail('');
    setFormPlanType('Básico');
    setFormExpirationDate('');
    setFormStatus('Activa');
  };

  // Edit license triggers
  const handleEditLicenseClick = (lic: License) => {
    const targetUser = users.find((u) => u.id === lic.userId || u.email === lic.clientEmail);
    const currentResolved = resolveFullLicenseState(lic, targetUser);
    setEditingLicense(lic);
    setFormPlanType(lic.planType || 'Básico');
    setFormExpirationDate(lic.expirationDate || toLocalDateString(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
    setFormStatus(
      currentResolved === 'Suspendida'
        ? 'Suspendida'
        : currentResolved === 'Expirada'
        ? 'Expirada'
        : 'Activa'
    );
    setIsEditLicenseModalOpen(true);
  };

  // Edit license submit handler
  const handleSaveEditedLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('Acceso Denegado: Su usuario no tiene permisos para realizar esta acción. ID de administrador requerido: uSEwpR9zZPWvekBQKdx1SMsrs7n1');
      return;
    }
    if (!editingLicense) return;

    const targetLicense: License = {
      ...editingLicense,
      planType: formPlanType,
      expirationDate: formExpirationDate,
      status: formStatus
    };

    setIsEditLicenseModalOpen(false);
    setEditingLicense(null);

    try {
      await persistLicenseAndUserSync(targetLicense);
    } catch (err: any) {
      console.error('Error saving edited license to Firestore:', err);
      alert('Error al guardar cambio en la nube, pero se actualizó localmente: ' + err.message);
    }
  };

  // Instantly toggle license lock/suspension status
  const handleToggleLock = async (lic: License) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('Acceso Denegado: Su usuario no tiene permisos para realizar esta acción. ID de administrador requerido: uSEwpR9zZPWvekBQKdx1SMsrs7n1');
      return;
    }
    const targetUser = users.find((u) => u.id === lic.userId || u.email === lic.clientEmail);
    const currentState = resolveFullLicenseState(lic, targetUser);
    const nextStatus: License['status'] =
      currentState === 'Suspendida'
        ? api.isLicenseDateExpired(lic.expirationDate)
          ? 'Expirada'
          : 'Activa'
        : 'Suspendida';

    const updatedLicense: License = {
      ...lic,
      status: nextStatus
    };

    try {
      await persistLicenseAndUserSync(updatedLicense);
    } catch (err: any) {
      console.error('Error toggling license status in Firestore:', err);
    }
  };

  // Update a single license field instantly (for inline tables)
  const handleUpdateLicenseField = async (userId: string, field: keyof License, value: any) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('Acceso Denegado: Su usuario no tiene permisos para realizar esta acción. ID de administrador requerido: uSEwpR9zZPWvekBQKdx1SMsrs7n1');
      return;
    }
    const existing = licenses.find((l) => l.userId === userId);
    if (!existing) return;

    const updatedLicense: License = {
      ...existing,
      [field]: value
    } as License;

    try {
      await persistLicenseAndUserSync(updatedLicense);
    } catch (err: any) {
      console.error('Error saving inline license field update to Firestore:', err);
      alert('Error al guardar cambio en la nube, pero se actualizó localmente: ' + err.message);
    }
  };

  // Resolve license state consistently across all devices: Suspendida, Expirada, Activa, Desactivada, Pendiente
  const resolveFullLicenseState = (
    lic?: Partial<License> | null,
    targetUser?: Partial<User> | null
  ): 'Pendiente' | 'Activa' | 'Por vencer' | 'Expirada' | 'Suspendida' | 'Desactivada' => {
    return api.resolveCompanyLicenseState(lic, targetUser);
  };

  const getBadge = (status: 'Pendiente' | 'Activa' | 'Por vencer' | 'Expirada' | 'Suspendida' | 'Desactivada') => {
    switch (status) {
      case 'Activa':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Activa
          </span>
        );
      case 'Por vencer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-amber-50 text-amber-800 border border-amber-200 shadow-3xs animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Por vencer
          </span>
        );
      case 'Expirada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-red-50 text-red-800 border border-red-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            Expirada
          </span>
        );
      case 'Suspendida':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-rose-50 text-rose-800 border border-rose-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
            Suspendida
          </span>
        );
      case 'Pendiente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-slate-50 text-slate-500 border border-slate-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            Pendiente
          </span>
        );
      case 'Desactivada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-slate-900/10 text-slate-800 border border-slate-400 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0" />
            Desactivada
          </span>
        );
      default:
        return null;
    }
  };

  // Helper to normalize legacy and new Spanish statuses
  const normalizeLicenseStatus = (status: string): 'Pendiente' | 'Activa' | 'Vencida' | 'Suspendida' => {
    if (status === 'Activo' || status === 'Activa' || status === 'Por Vencer' || status === 'Por vencer') return 'Activa';
    if (status === 'Pendiente') return 'Pendiente';
    if (status === 'Expirada' || status === 'Vencida') return 'Vencida';
    return 'Suspendida';
  };

  // Helper to calculate days remaining using local timezone dates so all devices compute identical days
  const calculateDaysRemaining = (expirationDate: string): number => {
    if (!expirationDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cleanDate = expirationDate.trim().split('T')[0];
    const parts = cleanDate.split('-');
    let exp: Date;
    if (parts.length === 3) {
      exp = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      exp = new Date(expirationDate);
    }
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Brand new license and account action handlers
  const handleActivateLicense = async (lic: License) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('No autorizado');
      return;
    }
    const todayStr = toLocalDateString();
    const updated: License = {
      ...lic,
      status: 'Activa',
      licenseStartDate: lic.licenseStartDate || todayStr
    };

    try {
      await persistLicenseAndUserSync(updated);
      alert('Licencia activada correctamente.');
    } catch (err) {
      console.error('Error activating license in Firestore:', err);
    }
  };

  const handleDeactivateLicense = async (lic: License) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('No autorizado');
      return;
    }
    const updated: License = {
      ...lic,
      status: 'Desactivada'
    };

    try {
      await persistLicenseAndUserSync(updated);
      alert('Licencia desactivada correctamente.');
    } catch (err) {
      console.error('Error deactivating license in Firestore:', err);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('No autorizado');
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    const targetLic = licenses.find((l) => l.userId === userId) || {
      userId,
      clientName: targetUser?.name || 'Empresa',
      clientEmail: targetUser?.email || '',
      application: 'Yaa POS',
      planType: (targetUser as any)?.plan || 'Básico',
      expirationDate: (targetUser as any)?.licenseExpiresAt || toLocalDateString(),
      status: 'Suspendida' as const
    };

    try {
      await persistLicenseAndUserSync({
        ...targetLic,
        status: 'Suspendida'
      });
      alert('Usuario y licencia suspendidos.');
    } catch (err) {
      console.error('Error suspending user and license in Firestore:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('No autorizado');
      return;
    }
    if (!window.confirm('¿Está seguro de que desea eliminar permanentemente este usuario y su licencia de la base de datos? Esta acción es irreversible.')) {
      return;
    }
    try {
      await api.deleteAdminUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setLicenses(licenses.filter(l => l.userId !== userId));
      setRawCloudLicenses(rawCloudLicenses.filter(l => l.userId !== userId));
      
      const saved = localStorage.getItem('yaa_pos_licenses');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter((l: any) => l.userId !== userId);
          localStorage.setItem('yaa_pos_licenses', JSON.stringify(filtered));
          window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
        } catch {}
      }
      alert('Usuario eliminado de forma permanente.');
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar usuario: ' + err.message);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingLicenseUser) return;
    
    const days = renewDuration;
    const today = new Date();
    const expDate = new Date();
    expDate.setDate(today.getDate() + days);

    const updatedLicense: License = {
      ...renewingLicenseUser,
      status: 'Activa',
      licenseStartDate: toLocalDateString(today),
      expirationDate: toLocalDateString(expDate)
    };

    try {
      await persistLicenseAndUserSync(updatedLicense);
    } catch (err) {
      console.error('Error saving renewed license:', err);
    }

    setIsRenewModalOpen(false);
    setRenewingLicenseUser(null);
    alert(`Licencia renovada exitosamente por ${days} días.`);
  };

  // Dynamic calculations for cards matching the dashboard
  const stats = useMemo(() => {
    const totalUsers = users.length;
    
    // License status counts using unified resolver
    const activeLic = licenses.filter(l => {
      const targetUser = users.find(u => u.id === l.userId || u.email === l.clientEmail);
      return resolveFullLicenseState(l, targetUser) === 'Activa';
    }).length;

    const enPrueba = licenses.filter(l => {
      const isDemo = l.planType?.toLowerCase().includes('demo') || l.planType?.toLowerCase().includes('prueba');
      return isDemo || l.status === 'Pendiente';
    }).length;

    const proximasAVencer = licenses.filter(l => {
      const targetUser = users.find(u => u.id === l.userId || u.email === l.clientEmail);
      const resolved = resolveFullLicenseState(l, targetUser);
      const days = calculateDaysRemaining(l.expirationDate);
      return resolved === 'Activa' && days > 0 && days <= 7;
    }).length;

    const vencidas = licenses.filter(l => {
      const targetUser = users.find(u => u.id === l.userId || u.email === l.clientEmail);
      return resolveFullLicenseState(l, targetUser) === 'Expirada';
    }).length;

    const suspendidos = licenses.filter(l => {
      const targetUser = users.find(u => u.id === l.userId || u.email === l.clientEmail);
      return resolveFullLicenseState(l, targetUser) === 'Suspendida';
    }).length;

    // Monthly Recurring Revenue (MRR)
    let mrr = 0;
    licenses.forEach(l => {
      const targetUser = users.find(u => u.id === l.userId || u.email === l.clientEmail);
      if (resolveFullLicenseState(l, targetUser) === 'Activa') {
        if (l.planType?.includes('Básico') || l.planType?.includes('Mensual')) {
          mrr += 250;
        } else if (l.planType?.includes('Anual') || l.planType?.includes('Premium')) {
          mrr += 200; // 2400 / 12
        }
      }
    });

    return {
      totalUsers,
      activeLic,
      enPrueba,
      proximasAVencer,
      vencidas,
      suspendidos,
      mrr
    };
  }, [licenses, users]);

  // Handle dropdown quick selection of existing user in Create Form
  const handleQuickUserSelect = (uid: string) => {
    const found = users.find(u => u.id === uid);
    if (found) {
      setFormUserId(found.id);
      setFormClientName(found.name);
      setFormClientEmail(found.email);
    }
  };

  // Plans handlers (Nuevo, Editar, Eliminar)
  const handleOpenNewPlan = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanPrice('Q 199.00');
    setPlanPeriod('/mes');
    setPlanBadge('Nuevo');
    setPlanFeaturesText('1 sucursal o punto de venta\nHasta 3 usuarios (operadores y admin)\nHasta 250 productos en catálogo\nControl de ventas y caja');
    setPlanStatus('Activo');
    setPlanMaxBranches(1);
    setPlanMaxUsers(3);
    setPlanMaxProducts(250);
    setPlanFelAllowed(false);
    setPlanAiAssistantAllowed(false);
    setPlanMultiBranchAllowed(false);
    setIsNewPlanModalOpen(true);
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const newFeatures = planFeaturesText.split('\n').map(s => s.trim()).filter(Boolean);
    const newPlan: PlanDefinition = {
      id: `plan_${Date.now()}`,
      name: planName || 'Nuevo Plan',
      price: planPrice || 'Q 0.00',
      period: planPeriod || '/mes',
      status: planStatus || 'Activo',
      badge: planBadge || 'Activo',
      maxBranches: Number(planMaxBranches) || 1,
      maxUsers: Number(planMaxUsers) || 3,
      maxProducts: Number(planMaxProducts) || 999999,
      felAllowed: Boolean(planFelAllowed),
      aiAssistantAllowed: Boolean(planAiAssistantAllowed),
      multiBranchAllowed: Boolean(planMultiBranchAllowed),
      features: newFeatures.length > 0 ? newFeatures : ['Acceso al sistema POS']
    };
    const updated = [...plans, newPlan];
    setPlans(updated);
    savePlans(updated);
    setIsNewPlanModalOpen(false);
  };

  const handleEditPlanClick = (plan: PlanDefinition) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(plan.price);
    setPlanPeriod(plan.period || '/mes');
    setPlanBadge(plan.badge || 'Activo');
    setPlanFeaturesText((plan.features || []).join('\n'));
    setPlanStatus(plan.status || 'Activo');
    setPlanMaxBranches(typeof plan.maxBranches === 'number' ? plan.maxBranches : 1);
    setPlanMaxUsers(typeof plan.maxUsers === 'number' ? plan.maxUsers : 3);
    setPlanMaxProducts(typeof plan.maxProducts === 'number' ? plan.maxProducts : 999999);
    setPlanFelAllowed(Boolean(plan.felAllowed));
    setPlanAiAssistantAllowed(Boolean(plan.aiAssistantAllowed));
    setPlanMultiBranchAllowed(Boolean(plan.multiBranchAllowed));
    setIsEditPlanModalOpen(true);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    const newFeatures = planFeaturesText.split('\n').map(s => s.trim()).filter(Boolean);
    const updated: PlanDefinition[] = plans.map(p => {
      if (p.id === editingPlan.id) {
        return {
          ...p,
          name: planName,
          price: planPrice,
          period: planPeriod,
          status: planStatus,
          badge: planBadge,
          maxBranches: Number(planMaxBranches) || 1,
          maxUsers: Number(planMaxUsers) || 3,
          maxProducts: Number(planMaxProducts) || 999999,
          felAllowed: Boolean(planFelAllowed),
          aiAssistantAllowed: Boolean(planAiAssistantAllowed),
          multiBranchAllowed: Boolean(planMultiBranchAllowed),
          features: newFeatures.length > 0 ? newFeatures : p.features
        };
      }
      return p;
    });

    setPlans(updated);
    savePlans(updated);
    setIsEditPlanModalOpen(false);
    setEditingPlan(null);
  };

  const handleDeletePlan = (planId: string) => {
    if (!confirm('¿Estás seguro de eliminar este plan de suscripción? Esta acción actualizará los planes disponibles para todos los clientes.')) return;
    const updated = plans.filter(p => p.id !== planId);
    setPlans(updated);
    savePlans(updated);
  };

  // Save Config handler
  const handleSaveConfig = () => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('Acceso Denegado: Su usuario no tiene permisos para realizar esta acción.');
      return;
    }
    localStorage.setItem('yaa_pos_admin_app_name', appName);
    localStorage.setItem('yaa_pos_admin_smtp', smtpServer);
    localStorage.setItem('yaa_pos_admin_backup', backupFreq);
    localStorage.setItem('yaa_pos_admin_storage', storageLimit);
    
    setShowConfigSuccess(true);
    setTimeout(() => {
      setShowConfigSuccess(false);
    }, 4000);
  };

  const filteredUsers = users.filter(u => {
    const term = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term)
    );
  });

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'No registrada';
    try {
      const clean = isoString.trim().split('T')[0];
      const parts = clean.split('-');
      const d =
        parts.length === 3
          ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
          : new Date(isoString);
      return d.toLocaleDateString('es-GT', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans select-none antialiased">
      
      {/* 1. LEFT SIDEBAR - Original Dark Palette (#0A1221) - DESKTOP */}
      <aside className="hidden lg:flex w-64 bg-[#0A1221] text-slate-300 flex-col justify-between shrink-0 border-r border-slate-800 shadow-2xl z-20">
        
        {/* LOGO & APP NAME */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white tracking-wider font-display block">Yaa POS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">Consola Admin</span>
            </div>
          </div>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* NAVIGATION MENUS */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          
          {/* TAB: DASHBOARD */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          {/* TAB: EMPRESAS */}
          <button
            type="button"
            onClick={() => setActiveTab('empresas')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'empresas' || activeTab === 'clientes' || activeTab === 'usuarios' || activeTab === 'licencias_activas'
                ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Empresas</span>
          </button>

          {/* TAB: PAISES / IMPUESTOS */}
          <button
            type="button"
            onClick={() => setActiveTab('paises_impuestos')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'paises_impuestos'
                ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>Países / Impuestos</span>
          </button>

          {/* TAB: PLANES */}
          <button
            type="button"
            onClick={() => setActiveTab('planes')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'planes'
                ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
            }`}
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 shrink-0" />
              <span>Planes</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'planes' ? 'bg-white/25 text-white' : 'bg-slate-800/80 text-slate-400'
            }`}>
              {plans.length}
            </span>
          </button>

          {/* TAB: METODOS DE PAGO */}
          <button
            type="button"
            onClick={() => setActiveTab('metodos_pago')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'metodos_pago'
                ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Métodos de pago</span>
          </button>

          {/* TAB: MI PERFIL */}
          <button
            type="button"
            onClick={() => setActiveTab('perfil')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'perfil' || activeTab === 'configuracion'
                ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
            }`}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span>Mi Perfil</span>
          </button>
        </nav>

        {/* LOGGED IN USER PROFILE FOOTER & LOGOUT BUTTON */}
        <div className="border-t border-slate-800 px-3 py-4 space-y-3 shrink-0 bg-[#070D18]">
          <div className="flex items-center gap-2.5 px-3">
            <div className="p-1.5 bg-slate-800 text-blue-400 rounded-full shrink-0">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <p className="text-[9px] text-slate-400 font-mono truncate">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewPOS}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-700/60 cursor-pointer transition-colors"
          >
            <Store className="w-3.5 h-3.5 text-blue-400" /> Ir a mi Tienda POS
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2 bg-red-950 hover:bg-red-900 text-red-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-red-900/40 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MOBILE / TABLET SLIDE-OUT DRAWER FOR ADMIN */}
      {isMobileAdminNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileAdminNavOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-[#0A1221] text-slate-300 flex flex-col justify-between z-10 shadow-2xl h-full animate-in slide-in-from-left duration-200 border-r border-slate-800">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-lg font-black text-white tracking-wider font-display block">Yaa POS</span>
                <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase block">Consola Admin</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileAdminNavOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => { setActiveTab('dashboard'); setIsMobileAdminNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('empresas'); setIsMobileAdminNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'empresas' || activeTab === 'clientes' || activeTab === 'usuarios' || activeTab === 'licencias_activas'
                    ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Empresas</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('paises_impuestos'); setIsMobileAdminNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'paises_impuestos'
                    ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
                }`}
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>Países / Impuestos</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('planes'); setIsMobileAdminNavOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'planes'
                    ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>Planes</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'planes' ? 'bg-white/25 text-white' : 'bg-slate-800/80 text-slate-400'
                }`}>
                  {plans.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('metodos_pago'); setIsMobileAdminNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'metodos_pago'
                    ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Métodos de pago</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('perfil'); setIsMobileAdminNavOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'perfil' || activeTab === 'configuracion'
                    ? 'bg-[#1E88E5] text-white shadow-md shadow-[#1E88E5]/20 font-bold'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400 font-semibold'
                }`}
              >
                <UserIcon className="w-4 h-4 shrink-0" />
                <span>Mi Perfil</span>
              </button>
            </nav>

            {/* Profile footer in drawer */}
            <div className="border-t border-slate-800 px-3 py-4 space-y-3 shrink-0 bg-[#070D18]">
              <div className="flex items-center gap-2.5 px-3">
                <div className="p-1.5 bg-slate-800 text-blue-400 rounded-full shrink-0">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user.name}</p>
                  <p className="text-[9px] text-slate-400 font-mono truncate">{user.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onViewPOS}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-slate-700/60 cursor-pointer transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-blue-400" /> Ir a mi Tienda POS
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="w-full py-2 bg-red-950 hover:bg-red-900 text-red-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-red-900/40 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN LAYOUT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* TOP BAR HEADER */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3.5 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMobileAdminNavOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Abrir menú de administración"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-800">
              Consola de Administración
            </h2>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <button
              type="button"
              onClick={onViewPOS}
              className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl px-3 sm:px-4 py-1.5 text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-xs"
            >
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">Panel de tienda</span>
              <span className="sm:hidden">Tienda</span>
            </button>

            <div className="w-8 h-8 rounded-full bg-[#1E88E5] text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
              {user.name ? user.name[0].toUpperCase() : 'A'}
            </div>
          </div>
        </header>

        {/* CORE VIEWS RENDERER */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-8 space-y-6 lg:space-y-8">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* PAGE HEADER */}
              <div>
                <span className="text-[11px] font-black text-blue-600 tracking-widest uppercase block mb-1">
                  ADMINISTRACIÓN
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1E88E5] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Plataforma</h1>
                    <p className="text-xs text-slate-500 font-medium">Métricas globales de la plataforma Yaa POS.</p>
                  </div>
                </div>
              </div>

              {/* 6 METRIC STATS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                
                {/* 1. Empresas */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-blue-50 text-[#1E88E5] rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 block truncate">Empresas</span>
                    <span className="text-lg font-black text-slate-900 tracking-tight block">
                      {users.length}
                    </span>
                  </div>
                </div>

                {/* 2. Activas */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 block truncate">Activas</span>
                    <span className="text-lg font-black text-slate-900 tracking-tight block">
                      {stats.activeLic}
                    </span>
                  </div>
                </div>

                {/* 3. En prueba */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 border border-amber-100">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 block truncate">En prueba</span>
                    <span className="text-lg font-black text-slate-900 tracking-tight block">
                      {stats.enPrueba}
                    </span>
                  </div>
                </div>

                {/* 4. Vencidas */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0 border border-red-100">
                    <X className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 block truncate">Vencidas</span>
                    <span className="text-lg font-black text-slate-900 tracking-tight block">
                      {stats.vencidas}
                    </span>
                  </div>
                </div>

                {/* 5. Usuarios */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0 border border-purple-100">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 block truncate">Usuarios</span>
                    <span className="text-lg font-black text-slate-900 tracking-tight block">
                      {stats.totalUsers}
                    </span>
                  </div>
                </div>

                {/* 6. MRR */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
                    <DollarSign className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 block truncate">MRR</span>
                    <span className="text-lg font-black text-slate-900 tracking-tight block">
                      Q {stats.mrr.toFixed(2)}
                    </span>
                  </div>
                </div>

              </div>

              {/* CHARTS ROW */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* CHART 1: Crecimiento de empresas */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-800 mb-6">Crecimiento de empresas</h3>
                  
                  <div className="h-64 relative flex flex-col justify-between">
                    {/* Grid Lines */}
                    <div className="relative w-full h-48">
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        <div className="border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>4</span>
                        </div>
                        <div className="border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>3</span>
                        </div>
                        <div className="border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>2</span>
                        </div>
                        <div className="border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>1</span>
                        </div>
                        <div className="border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>0</span>
                        </div>
                      </div>

                      {/* SVG line */}
                      <svg className="absolute inset-0 w-full h-full overflow-visible pl-6" preserveAspectRatio="none" viewBox="0 0 500 150">
                        <defs>
                          <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1E88E5" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#1E88E5" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 10 140 Q 100 135, 180 120 T 320 80 T 480 30"
                          fill="none"
                          stroke="#1E88E5"
                          strokeWidth="2.5"
                        />
                        <path
                          d="M 10 140 Q 100 135, 180 120 T 320 80 T 480 30 L 480 150 L 10 150 Z"
                          fill="url(#growthGrad)"
                        />
                        <circle cx="10" cy="140" r="4" fill="#1E88E5" stroke="#ffffff" strokeWidth="2" />
                        <circle cx="180" cy="120" r="4" fill="#1E88E5" stroke="#ffffff" strokeWidth="2" />
                        <circle cx="320" cy="80" r="4" fill="#1E88E5" stroke="#ffffff" strokeWidth="2" />
                        <circle cx="480" cy="30" r="5" fill="#1E88E5" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                    </div>

                    <div className="flex justify-between text-[11px] font-medium text-slate-400 pl-6 pt-2">
                      <span>Mar</span>
                      <span>Abr</span>
                      <span>May</span>
                      <span>Jun</span>
                      <span>Jul</span>
                      <span>Ago</span>
                    </div>
                  </div>
                </div>

                {/* CHART 2: Empresas por plan */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-800 mb-6">Empresas por plan</h3>
                  
                  <div className="h-64 flex flex-col justify-center items-center relative">
                    <div className="w-full space-y-4 px-4">
                      {plans.map((p: any, idx: number) => {
                        const count = licenses.filter(l => l.planType?.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])).length;
                        const percentage = licenses.length > 0 ? Math.round((count / licenses.length) * 100) : (idx === 0 ? 60 : idx === 1 ? 30 : 10);
                        return (
                          <div key={p.id} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-slate-700">
                              <span className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-[#1E88E5]' : idx === 1 ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                                {p.name}
                              </span>
                              <span className="font-mono text-slate-400">{percentage}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-[#1E88E5]' : idx === 1 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* TABLE: EMPRESAS / LICENCIAS */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-slate-800 text-sm">
                      Empresas Registradas ({licenses.length})
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar empresa o correo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNewLicenseModalOpen(true)}
                      className="px-4 py-2 bg-[#1E88E5] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" /> Nueva Licencia
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 font-semibold border-b border-slate-100 text-[11px]">
                        <th className="py-3.5 px-6">Empresa / Cliente</th>
                        <th className="py-3.5 px-6">Plan</th>
                        <th className="py-3.5 px-6">Expiración</th>
                        <th className="py-3.5 px-6 text-center">Estado</th>
                        <th className="py-3.5 px-6 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {licenses
                        .filter(lic => {
                          const term = searchQuery.toLowerCase();
                          return lic.clientName.toLowerCase().includes(term) || lic.clientEmail.toLowerCase().includes(term);
                        })
                        .map((lic) => {
                          const targetUser = users.find(u => u.id === lic.userId) || {
                            id: lic.userId,
                            name: lic.clientName,
                            email: lic.clientEmail,
                            accountStatus: 'Activa'
                          } as User;
                          const resolvedState = resolveFullLicenseState(lic, targetUser);

                          return (
                            <tr key={lic.userId} className="hover:bg-slate-50/60 transition-colors">
                            
                            {/* Cliente */}
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-50 text-blue-600 font-black text-xs rounded-full flex items-center justify-center uppercase">
                                  {lic.clientName[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate text-xs">{lic.clientName}</p>
                                  <p className="text-[11px] text-slate-400 truncate font-mono">{lic.clientEmail}</p>
                                </div>
                              </div>
                            </td>

                            {/* Tipo de Plan */}
                            <td className="py-3.5 px-6 font-medium text-slate-700">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[11px] font-medium">
                                {lic.planType}
                              </span>
                            </td>

                            {/* Fecha de Expiracion */}
                            <td className="py-3.5 px-6 font-mono text-slate-500 text-[11px]">
                              {formatDate(lic.expirationDate)}
                            </td>

                            {/* Estado */}
                            <td className="py-3.5 px-6 text-center">
                              <div className="flex justify-center">
                                {getBadge(resolvedState)}
                              </div>
                            </td>

                            {/* Acciones */}
                            <td className="py-3.5 px-6">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleInspectClient(lic)}
                                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-200 shadow-3xs cursor-pointer"
                                  title="Inspeccionar archivos"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleLock(lic)}
                                  className={`p-1.5 rounded-lg transition-all border shadow-3xs cursor-pointer ${
                                    resolvedState === 'Suspendida' 
                                      ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                  title={resolvedState === 'Suspendida' ? 'Reactivar Licencia' : 'Suspender Licencia'}
                                >
                                  {resolvedState === 'Suspendida' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditLicenseClick(lic)}
                                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-200 shadow-3xs cursor-pointer"
                                  title="Editar Licencia"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB: EMPRESAS (MATCHING EXACT SCREENSHOT DESIGN) */}
          {(activeTab === 'empresas' || activeTab === 'clientes') && (() => {
            const allEmpresas = licenses.length > 0 ? licenses : users.map(u => ({
              id: u.id,
              userId: u.id,
              clientName: u.name || 'Empresa',
              clientEmail: u.email,
              planType: (u as any).plan || 'Básico',
              expirationDate: (u as any).licenseExpiresAt || '',
              status: (u.accountStatus === 'Suspendida' ? 'Suspendida' : 'Activa') as any,
              maxUsers: 3,
              storeCount: 1,
              taxId: (u as any).taxId || (u as any).nit || (u as any).ruc || 'CF / Sin RUC'
            } as any));

            const filteredEmpresas = allEmpresas.filter(emp => {
              const term = searchQuery.toLowerCase();
              const name = (emp.clientName || '').toLowerCase();
              const email = (emp.clientEmail || '').toLowerCase();
              const ruc = (emp.taxId || '').toLowerCase();
              return name.includes(term) || email.includes(term) || ruc.includes(term);
            });

            return (
              <div className="space-y-6 animate-fade-in">
                
                {/* 1. HEADER: Exact match with screenshot */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#00a86b] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-[#00a86b] tracking-wider uppercase block">
                        ADMINISTRACIÓN
                      </span>
                      <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                        Empresas
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Clientes del SaaS.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsNewLicenseModalOpen(true)}
                    className="px-5 py-2.5 bg-[#00a86b] hover:bg-[#00925d] text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" /> Nueva empresa
                  </button>
                </div>

                {/* 2. MAIN CARD CONTAINER */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-6">
                  
                  {/* Top Search Input */}
                  <div className="relative w-full max-w-xs">
                    <input
                      type="text"
                      placeholder="Buscar empresa..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white text-xs border border-slate-200 rounded-full px-4 py-2.5 text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#00a86b] focus:border-transparent font-medium"
                    />
                  </div>

                  {/* Table with columns: Empresa | NIT | Plan | Usuarios | Vencimiento | Estado | Acciones */}
                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-500 font-semibold border-b border-slate-100 text-xs">
                          <th className="pb-3 px-3 sm:px-4 font-semibold text-slate-600 whitespace-nowrap">Empresa</th>
                          <th className="pb-3 px-3 sm:px-4 font-semibold text-slate-600 whitespace-nowrap">NIT</th>
                          <th className="pb-3 px-3 sm:px-4 font-semibold text-slate-600 whitespace-nowrap">Plan</th>
                          <th className="pb-3 px-3 sm:px-4 font-semibold text-slate-600 whitespace-nowrap">Usuarios</th>
                          <th className="pb-3 px-3 sm:px-4 font-semibold text-slate-600 whitespace-nowrap">Vencimiento</th>
                          <th className="pb-3 px-3 sm:px-4 font-semibold text-center text-slate-600 whitespace-nowrap">Estado</th>
                          <th className="pb-3 px-3 sm:px-4 font-semibold text-right text-slate-600 whitespace-nowrap">Acciones</th>
                        </tr>
                      </thead>
                      {filteredEmpresas.length > 0 && (
                        <tbody className="divide-y divide-slate-100">
                          {filteredEmpresas.map((emp) => {
                            const targetUser = users.find(u => u.id === emp.userId || u.email === emp.clientEmail);
                            const resolvedState = resolveFullLicenseState(emp, targetUser);
                            const rucValue = (emp as any).taxId || (targetUser as any)?.taxId || (targetUser as any)?.nit || (targetUser as any)?.ruc || 'CF / Sin NIT';
                            const userCount = emp.maxUsers ? `1 / ${emp.maxUsers}` : '1 / 3';

                            return (
                              <tr key={emp.userId || emp.id} className="hover:bg-slate-50/60 transition-colors">
                                
                                {/* Empresa */}
                                <td className="py-3.5 sm:py-4 px-3 sm:px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#00a86b] font-bold text-xs flex items-center justify-center uppercase shrink-0">
                                      {emp.clientName ? emp.clientName[0] : 'E'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 truncate max-w-[160px] sm:max-w-[220px]">{emp.clientName}</p>
                                      <p className="text-[11px] text-slate-400 font-mono truncate max-w-[160px] sm:max-w-[220px]">{emp.clientEmail}</p>
                                    </div>
                                  </div>
                                </td>

                                {/* NIT */}
                                <td className="py-3.5 sm:py-4 px-3 sm:px-4 font-mono text-slate-600 whitespace-nowrap">
                                  {rucValue}
                                </td>

                                {/* Plan */}
                                <td className="py-3.5 sm:py-4 px-3 sm:px-4 whitespace-nowrap">
                                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[11px] font-medium whitespace-nowrap">
                                    {emp.planType || 'Básico'}
                                  </span>
                                </td>

                                {/* Usuarios */}
                                <td className="py-3.5 sm:py-4 px-3 sm:px-4 font-mono text-slate-600 whitespace-nowrap">
                                  {userCount}
                                </td>

                                {/* Vencimiento */}
                                <td className="py-3.5 sm:py-4 px-3 sm:px-4 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                                  {formatDate(emp.expirationDate)}
                                </td>

                                {/* Estado */}
                                <td className="py-3.5 sm:py-4 px-3 sm:px-4 text-center whitespace-nowrap">
                                  <div className="flex justify-center">
                                    {getBadge(resolvedState)}
                                  </div>
                                </td>

                                {/* Acciones */}
                                <td className="py-3.5 sm:py-4 px-3 sm:px-4 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (targetUser) setSelectedUser(targetUser);
                                        setIsFilesDrawerOpen(true);
                                      }}
                                      className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-200 shadow-3xs cursor-pointer"
                                      title="Ver archivos y respaldos"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleLock(emp)}
                                      className={`p-1.5 rounded-lg transition-all border shadow-3xs cursor-pointer ${
                                        resolvedState === 'Suspendida' 
                                          ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                      }`}
                                      title={resolvedState === 'Suspendida' ? 'Reactivar Licencia' : 'Suspender Licencia'}
                                    >
                                      {resolvedState === 'Suspendida' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleEditLicenseClick(emp)}
                                      className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-200 shadow-3xs cursor-pointer"
                                      title="Editar Empresa / Licencia"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      )}
                    </table>
                  </div>

                  {/* Empty State when no companies match/exist */}
                  {filteredEmpresas.length === 0 && (
                    <div className="bg-[#f8fafc] border border-slate-100/80 rounded-2xl py-20 px-4 text-center flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-sky-50 text-slate-700 rounded-full flex items-center justify-center text-2xl mb-3 shadow-xs">
                        📬
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1">Sin empresas registradas</h4>
                      <p className="text-xs text-slate-500">Crea la primera tienda con el botón &ldquo;Nueva empresa&rdquo;.</p>
                    </div>
                  )}

                </div>

              </div>
            );
          })()}

          {/* TAB: USUARIOS REGISTRADOS (CONSOLA DE CONTROL) */}
          {activeTab === 'usuarios' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs animate-fade-in">
              <div className="p-6 border-b border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800 text-sm font-display flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-[#00a86b]" />
                    Usuarios Registrados y Control de Licencias
                  </h3>
                  <p className="text-xs text-slate-500">
                    Administra las cuentas de los usuarios, activa o desactiva sus licencias y realiza renovaciones de plan.
                  </p>
                </div>
                
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o correo electrónico..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 font-sans"
                  />
                </div>
              </div>

              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="p-4 pl-6">Nombre / Correo</th>
                      <th className="p-4">Registro</th>
                      <th className="p-4">Estado Cuenta</th>
                      <th className="p-4">Plan / Licencia</th>
                      <th className="p-4">Vigencia (Inicio - Fin)</th>
                      <th className="p-4">Días Restantes</th>
                      <th className="p-4 pr-6 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">
                          No se encontraron usuarios registrados que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        // Find matching license
                        const lic = licenses.find(l => l.userId === u.id) || {
                          userId: u.id,
                          clientName: u.name,
                          clientEmail: u.email,
                          application: 'Yaa POS',
                          planType: 'Pendiente',
                          expirationDate: '',
                          status: 'Pendiente' as const
                        };

                        const daysLeft = lic.expirationDate ? calculateDaysRemaining(lic.expirationDate) : 0;
                        const normalizedStatus = resolveFullLicenseState(lic, u);
                        const accountStatus = u.accountStatus || 'Activa';

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/40 transition-colors">
                            {/* USER INFO */}
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-bold font-sans text-sm border border-slate-200 shrink-0">
                                  {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-extrabold text-slate-800 block truncate leading-tight">{u.name}</span>
                                  <span className="text-[10px] text-slate-400 block truncate">{u.email}</span>
                                </div>
                              </div>
                            </td>

                            {/* REG DATE */}
                            <td className="p-4 text-slate-500 font-medium font-mono">
                              {u.createdAt ? u.createdAt.split('T')[0] : 'No registrado'}
                            </td>

                            {/* ACCOUNT STATUS */}
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                accountStatus === 'Activa' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-red-50 text-red-700 border border-red-100'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${accountStatus === 'Activa' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                {accountStatus}
                              </span>
                            </td>

                            {/* PLAN & LICENSE STATUS */}
                            <td className="p-4 space-y-1">
                              <span className="text-slate-700 font-extrabold block">{lic.planType || 'Pendiente'}</span>
                              
                              {getBadge(normalizedStatus)}
                            </td>

                            {/* DATES */}
                            <td className="p-4 space-y-0.5 font-mono text-[11px] text-slate-500">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 w-10 block text-[9px] font-sans uppercase font-bold">Inicio</span>
                                <span className="text-slate-600 font-bold">{lic.licenseStartDate || 'Pendiente'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400 w-10 block text-[9px] font-sans uppercase font-bold">Fin</span>
                                <span className={`font-bold ${normalizedStatus === 'Expirada' || daysLeft === 0 ? 'text-red-500' : 'text-slate-600'}`}>
                                  {lic.expirationDate || 'Sin vigencia'}
                                </span>
                              </div>
                            </td>

                            {/* DAYS REMAINING */}
                            <td className="p-4">
                              {(normalizedStatus === 'Activa' || normalizedStatus === 'Por vencer') && daysLeft > 0 ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  normalizedStatus === 'Por vencer' 
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse' 
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}>
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  {daysLeft} días {daysLeft <= 7 && '¡Pronto a vencer!'}
                                </span>
                              ) : normalizedStatus === 'Suspendida' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                  Suspendido
                                </span>
                              ) : normalizedStatus === 'Desactivada' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/10 text-slate-800 border border-slate-300">
                                  Desactivado
                                </span>
                              ) : normalizedStatus === 'Pendiente' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                                  Pendiente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                                  Vencida
                                </span>
                              )}
                            </td>

                            {/* ROW ACTIONS */}
                            <td className="p-4 pr-6 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* ACTIVATE */}
                                <button
                                  type="button"
                                  onClick={() => handleActivateLicense(lic)}
                                  disabled={normalizedStatus === 'Activa' && accountStatus === 'Activa'}
                                  className={`p-2 rounded-xl border transition-all ${
                                    normalizedStatus === 'Activa' && accountStatus === 'Activa'
                                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-white hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 border-slate-200 hover:border-emerald-200 shadow-3xs cursor-pointer active:scale-95'
                                  }`}
                                  title="Activar Licencia"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>

                                {/* DEACTIVATE */}
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateLicense(lic)}
                                  disabled={normalizedStatus === 'Pendiente'}
                                  className={`p-2 rounded-xl border transition-all ${
                                    normalizedStatus === 'Pendiente'
                                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-white hover:bg-amber-50 text-amber-600 hover:text-amber-700 border-slate-200 hover:border-amber-200 shadow-3xs cursor-pointer active:scale-95'
                                  }`}
                                  title="Desactivar Licencia"
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </button>

                                {/* RENEW */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenewingLicenseUser(lic);
                                    setRenewDuration(30);
                                    setIsRenewModalOpen(true);
                                  }}
                                  className="p-2 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-xl shadow-3xs cursor-pointer active:scale-95 transition-all"
                                  title="Renovar Licencia"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>

                                {/* SUSPEND USER */}
                                <button
                                  type="button"
                                  onClick={() => handleSuspendUser(u.id)}
                                  disabled={accountStatus === 'Suspendida'}
                                  className={`p-2 rounded-xl border transition-all ${
                                    accountStatus === 'Suspendida'
                                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border-slate-200 hover:border-rose-200 shadow-3xs cursor-pointer active:scale-95'
                                  }`}
                                  title="Suspender Usuario"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>

                                {/* DELETE USER */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-2 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-xl shadow-3xs cursor-pointer active:scale-95 transition-all"
                                  title="Eliminar Usuario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PAISES / IMPUESTOS */}
          {activeTab === 'paises_impuestos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Configuración de Países e Impuestos</h2>
                  <p className="text-xs text-slate-400">Gestiona las tasas tributarias (IVA, IGV), monedas por defecto y localizaciones fiscales.</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-semibold border-b border-slate-100 text-[11px]">
                      <th className="py-3.5 px-6">País</th>
                      <th className="py-3.5 px-6">Moneda Oficial</th>
                      <th className="py-3.5 px-6">Impuesto Predeterminado</th>
                      <th className="py-3.5 px-6">Porcentaje (%)</th>
                      <th className="py-3.5 px-6 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {countries.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-6 font-bold text-slate-800 flex items-center gap-2">
                          <Globe className="w-4 h-4 text-blue-600" /> {c.name}
                        </td>
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-700">{c.currency}</td>
                        <td className="py-3.5 px-6 text-slate-600">{c.taxName}</td>
                        <td className="py-3.5 px-6 font-mono font-bold text-blue-600">{c.defaultTax}%</td>
                        <td className="py-3.5 px-6 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${c.isDefault ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {c.isDefault ? 'Activo / Principal' : 'Habilitado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PLANES (SINCRONIZADO EN TIEMPO REAL CON EL MODAL DE CLIENTES) */}
          {activeTab === 'planes' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header with live sync indicator and Preview button */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#00a86b] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black text-[#00a86b] tracking-wider uppercase block">
                        ADMINISTRACIÓN
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Sincronizado en tiempo real con Modal de Suscripción
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                      Planes de Suscripción
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Catálogo central de planes. Las modificaciones se reflejan en vivo en el modal de suscripción de los clientes.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsPreviewPlanModalOpen(true)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                    title="Previsualizar el modal de planes exactamente como lo ve el cliente"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Ver Modal de Suscripción</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenNewPlan}
                    className="px-5 py-2.5 bg-[#00a86b] hover:bg-[#00925d] text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Nuevo plan
                  </button>
                </div>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {plans.map((p: PlanDefinition) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-3xl border border-slate-200/90 p-7 shadow-xs flex flex-col justify-between space-y-6 hover:shadow-md transition-all relative overflow-hidden"
                  >
                    {p.badge && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-[10px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-bl-xl shadow-2xs">
                        {p.badge}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between pr-16">
                        <h3 className="font-bold text-lg text-slate-900">{p.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'Activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.status || 'Activo'}
                        </span>
                      </div>

                      {/* Price block */}
                      <div className="flex items-baseline">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">
                          {p.price}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold ml-1.5">
                          {p.period || '/mes'}
                        </span>
                      </div>

                      {/* Resource limits indicator */}
                      <div className="py-2.5 border-y border-slate-100 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Sucursales</span>
                          <span className="text-xs font-black text-slate-800">
                            {p.maxBranches >= 999 ? 'Ilimitadas' : p.maxBranches || 1}
                          </span>
                        </div>
                        <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Usuarios</span>
                          <span className="text-xs font-black text-slate-800">
                            {p.maxUsers >= 999 ? 'Ilimitados' : p.maxUsers || 3}
                          </span>
                        </div>
                        <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Productos</span>
                          <span className="text-xs font-black text-slate-800">
                            {p.maxProducts >= 999999 ? 'Ilimitados' : (p.maxProducts || 'Ilimitados')}
                          </span>
                        </div>
                      </div>

                      {/* Feature chips */}
                      <div className="space-y-1.5">
                        {p.felAllowed && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded-xl px-2.5 py-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Facturación Electrónica SAT (FEL)</span>
                          </div>
                        )}
                        {p.aiAssistantAllowed && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 rounded-xl px-2.5 py-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Asistente Inteligente IA Gemini</span>
                          </div>
                        )}
                      </div>

                      {/* Feature checklist */}
                      <ul className="space-y-2 pt-1 border-t border-slate-100">
                        {p.features && p.features.map((f: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                            <Check className="w-4 h-4 text-[#00a86b] shrink-0 mt-0.5 stroke-[2.5]" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions at bottom */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleEditPlanClick(p)}
                        className="flex-1 px-4 py-2 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-500" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(p.id)}
                        className="px-3.5 py-2 rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Eliminar este plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: METODOS DE PAGO */}
          {activeTab === 'metodos_pago' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Métodos de Pago</h2>
                <p className="text-xs text-slate-400">Configuración de pasarelas y formas de cobro habilitadas en los terminales de punto de venta.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-semibold border-b border-slate-100 text-[11px]">
                      <th className="py-3.5 px-6">Método</th>
                      <th className="py-3.5 px-6">Tipo</th>
                      <th className="py-3.5 px-6">Comisión</th>
                      <th className="py-3.5 px-6 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentMethods.map((pm) => (
                      <tr key={pm.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-6 font-bold text-slate-800 flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-600" /> {pm.name}
                        </td>
                        <td className="py-3.5 px-6 text-slate-600">{pm.type}</td>
                        <td className="py-3.5 px-6 font-mono text-slate-500">{pm.fee}</td>
                        <td className="py-3.5 px-6 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pm.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {pm.enabled ? 'Habilitado' : 'Desactivado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: MI PERFIL */}
          {activeTab === 'perfil' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Mi Perfil</h2>
                <p className="text-xs text-slate-400">Credenciales del administrador del sistema.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                  <div className="w-14 h-14 rounded-full bg-[#1E88E5] text-white font-black text-xl flex items-center justify-center">
                    {user.name ? user.name[0].toUpperCase() : 'A'}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{user.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                    <span className="inline-block mt-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Super Administrador
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nombre de Usuario</label>
                    <input
                      type="text"
                      disabled
                      value={user.name}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Correo Electrónico</label>
                    <input
                      type="email"
                      disabled
                      value={user.email}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONFIGURACION */}
          {activeTab === 'configuracion' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Configuración del Servidor</h2>
                <p className="text-xs text-slate-400">Parámetros operativos y directivas de sincronización.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                {showConfigSuccess && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-3.5 text-xs font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>¡Configuración guardada exitosamente!</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nombre del Sistema</label>
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Servidor SMTP</label>
                    <input
                      type="text"
                      value={smtpServer}
                      onChange={(e) => setSmtpServer(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Respaldo Automático</label>
                    <select
                      value={backupFreq}
                      onChange={(e) => setBackupFreq(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Cada 24 horas (Recomendado)">Cada 24 horas (Recomendado)</option>
                      <option value="Semanalmente">Semanalmente</option>
                      <option value="Desactivado">Desactivado</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Límite Almacenamiento</label>
                    <select
                      value={storageLimit}
                      onChange={(e) => setStorageLimit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="250 MB">250 MB</option>
                      <option value="500 MB">500 MB</option>
                      <option value="1 GB (Premium)">1 GB (Premium)</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-800">
                    Sincronización en tiempo real con Firestore activa. Las modificaciones se aplican al instante.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-5 py-2 bg-[#1E88E5] hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Guardar Parámetros
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ==================== 3. MODALES / DRAWERS ==================== */}

      {/* FILE EXPLORER SIDE SLIDING DRAWER */}
      {isFilesDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Overlay background */}
          <div 
            onClick={() => setIsFilesDrawerOpen(false)} 
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
          />

          <div className="absolute inset-y-0 right-0 max-w-lg w-full flex pl-10">
            <div className="w-full bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-200">
              
              {/* Header */}
              <div className="bg-slate-50 px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Archivos del Cliente</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{selectedUser?.name}</p>
                </div>
                <button 
                  onClick={() => setIsFilesDrawerOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isFilesLoading ? (
                  <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <p className="text-xs font-bold">Consultando archivos del servidor...</p>
                  </div>
                ) : userFiles.length === 0 ? (
                  <div className="py-24 text-center text-slate-400 space-y-3 flex flex-col items-center justify-center">
                    <FileText className="w-12 h-12 text-slate-200" />
                    <p className="text-xs font-bold max-w-xs leading-relaxed">Este usuario no tiene archivos registrados.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userFiles.map((file) => (
                      <div 
                        key={file.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100/50 transition-all"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-extrabold text-slate-800 truncate flex items-center gap-1.5" title={file.name}>
                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            {file.name}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                            <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">{formatBytes(file.size)}</span>
                            <span>{formatDate(file.uploadedAt)}</span>
                          </div>
                        </div>

                        <a
                          href={file.path}
                          target="_blank"
                          rel="noreferrer referrer"
                          className="p-2.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-3xs cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsFilesDrawerOpen(false)}
                  className="px-5 py-2.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-wide cursor-pointer shadow-md"
                >
                  Cerrar Panel
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW LICENSE MODAL (Exactly matching system look & feel) */}
      {isNewLicenseModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-5 flex justify-between items-center shadow-md">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1.5 bg-white/10 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-emerald-100" />
                  </span>
                  Emitir Nueva Licencia
                </h3>
                <p className="text-xs text-emerald-100 font-medium font-sans">Registra la habilitación del sistema de punto de venta</p>
              </div>
              <button 
                onClick={() => setIsNewLicenseModalOpen(false)} 
                className="p-1.5 hover:bg-white/15 rounded-full text-emerald-100 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateLicense} className="p-6 space-y-4 text-left bg-slate-50/20 max-h-[70vh] overflow-y-auto">
              
              {/* Optional Quick select */}
              {users.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Copiar datos de un usuario registrado (Opcional)</label>
                  <select
                    onChange={(e) => handleQuickUserSelect(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium cursor-pointer focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Seleccione para rellenar rápido...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Client Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Nombre del Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora El Sol"
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Client Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={formClientEmail}
                  onChange={(e) => setFormClientEmail(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Plan Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Tipo de Plan</label>
                <select
                  value={formPlanType}
                  onChange={(e) => setFormPlanType(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  {plans.map((p: any) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.price}{p.period})
                    </option>
                  ))}
                  <option value="Demo 15 días">Demo 15 días</option>
                  <option value="Gratuito">Gratuito</option>
                </select>
              </div>

              {/* Expiration Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Fecha de Expiración</label>
                <input
                  type="date"
                  value={formExpirationDate}
                  onChange={(e) => setFormExpirationDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-mono focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Initial Status */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Estado de Licencia</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(['Activa', 'Suspendida', 'Expirada'] as const).map((st) => {
                    const isSelected = (formStatus === 'Activo' ? 'Activa' : formStatus) === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setFormStatus(st);
                          if (st === 'Activa' && (!formExpirationDate || api.isLicenseDateExpired(formExpirationDate))) {
                            const nextMonth = new Date();
                            nextMonth.setDate(nextMonth.getDate() + 30);
                            setFormExpirationDate(toLocalDateString(nextMonth));
                          } else if (st === 'Expirada' && (!formExpirationDate || !api.isLicenseDateExpired(formExpirationDate))) {
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            setFormExpirationDate(toLocalDateString(yesterday));
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          isSelected
                            ? st === 'Activa'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-500/20'
                              : st === 'Suspendida'
                              ? 'bg-rose-50 text-rose-800 border-rose-400 ring-2 ring-rose-500/20'
                              : 'bg-red-50 text-red-800 border-red-400 ring-2 ring-red-500/20'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
                <select
                  value={formStatus === 'Activo' ? 'Activa' : formStatus}
                  onChange={(e) => {
                    const nextSt = e.target.value as License['status'];
                    setFormStatus(nextSt);
                    if (nextSt === 'Activa' && (!formExpirationDate || api.isLicenseDateExpired(formExpirationDate))) {
                      const nextMonth = new Date();
                      nextMonth.setDate(nextMonth.getDate() + 30);
                      setFormExpirationDate(toLocalDateString(nextMonth));
                    } else if (nextSt === 'Expirada' && (!formExpirationDate || !api.isLicenseDateExpired(formExpirationDate))) {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setFormExpirationDate(toLocalDateString(yesterday));
                    }
                  }}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Activa">Activa</option>
                  <option value="Suspendida">Suspendida</option>
                  <option value="Expirada">Expirada</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-150">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#009b72] hover:bg-[#008662] text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md uppercase tracking-wider"
                >
                  <ShieldCheck className="w-4 h-4" /> Registrar Licencia
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewLicenseModalOpen(false)}
                  className="w-full py-2.5 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all text-center"
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT LICENSE MODAL */}
      {isEditLicenseModalOpen && editingLicense && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-5 flex justify-between items-center shadow-md">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1.5 bg-white/10 rounded-lg">
                    <Edit className="w-5 h-5 text-blue-100" />
                  </span>
                  Modificar Licencia
                </h3>
                <p className="text-xs text-blue-100 font-medium font-sans truncate">Cliente: {editingLicense.clientName}</p>
              </div>
              <button 
                onClick={() => { setIsEditLicenseModalOpen(false); setEditingLicense(null); }} 
                className="p-1.5 hover:bg-white/15 rounded-full text-blue-100 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditedLicense} className="p-6 space-y-4 text-left bg-slate-50/20 max-h-[70vh] overflow-y-auto">
              
              {/* Plan Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Tipo de Plan *</label>
                <select
                  value={formPlanType}
                  onChange={(e) => setFormPlanType(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {plans.map((p: any) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.price}{p.period})
                    </option>
                  ))}
                  <option value="Demo 15 días">Demo 15 días</option>
                  <option value="Gratuito">Gratuito</option>
                </select>
              </div>

              {/* Expiration Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Fecha de Expiración *</label>
                <input
                  type="date"
                  required
                  value={formExpirationDate}
                  onChange={(e) => setFormExpirationDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-mono focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Estado de Licencia *</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(['Activa', 'Suspendida', 'Expirada'] as const).map((st) => {
                    const isSelected = (formStatus === 'Activo' ? 'Activa' : formStatus) === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setFormStatus(st);
                          if (st === 'Activa' && (!formExpirationDate || api.isLicenseDateExpired(formExpirationDate))) {
                            const nextMonth = new Date();
                            nextMonth.setDate(nextMonth.getDate() + 30);
                            setFormExpirationDate(toLocalDateString(nextMonth));
                          } else if (st === 'Expirada' && (!formExpirationDate || !api.isLicenseDateExpired(formExpirationDate))) {
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            setFormExpirationDate(toLocalDateString(yesterday));
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          isSelected
                            ? st === 'Activa'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-500/20'
                              : st === 'Suspendida'
                              ? 'bg-rose-50 text-rose-800 border-rose-400 ring-2 ring-rose-500/20'
                              : 'bg-red-50 text-red-800 border-red-400 ring-2 ring-red-500/20'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
                <select
                  value={formStatus === 'Activo' ? 'Activa' : formStatus}
                  onChange={(e) => {
                    const nextSt = e.target.value as License['status'];
                    setFormStatus(nextSt);
                    if (nextSt === 'Activa' && (!formExpirationDate || api.isLicenseDateExpired(formExpirationDate))) {
                      const nextMonth = new Date();
                      nextMonth.setDate(nextMonth.getDate() + 30);
                      setFormExpirationDate(toLocalDateString(nextMonth));
                    } else if (nextSt === 'Expirada' && (!formExpirationDate || !api.isLicenseDateExpired(formExpirationDate))) {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setFormExpirationDate(toLocalDateString(yesterday));
                    }
                  }}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Activa">Activa</option>
                  <option value="Suspendida">Suspendida</option>
                  <option value="Expirada">Expirada</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-150">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md uppercase tracking-wider"
                >
                  <Check className="w-4 h-4" /> Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditLicenseModalOpen(false); setEditingLicense(null); }}
                  className="w-full py-2.5 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all text-center"
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* NUEVO PLAN MODAL */}
      {isNewPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#00a86b] text-white px-6 py-5 flex justify-between items-center shadow-md">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1.5 bg-white/15 rounded-lg">
                    <Plus className="w-5 h-5 text-white" />
                  </span>
                  Crear Nuevo Plan
                </h3>
                <p className="text-xs text-emerald-100 font-medium">Define las características y precio del nuevo plan</p>
              </div>
              <button 
                onClick={() => setIsNewPlanModalOpen(false)} 
                className="p-1.5 hover:bg-white/15 rounded-full text-white/80 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreatePlan} className="p-6 space-y-4 text-left bg-slate-50/20">
              {/* Plan Name and Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Nombre del Plan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Básico, Profesional, etc."
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Insignia / Badge (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Recomendado, Popular, Ilimitado"
                    value={planBadge}
                    onChange={(e) => setPlanBadge(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Price and Period */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Precio / Tarifa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Q 199.00"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Frecuencia / Periodo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: /mes o /año"
                    value={planPeriod}
                    onChange={(e) => setPlanPeriod(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Estado *</label>
                <select
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Próximamente">Próximamente</option>
                </select>
              </div>

              {/* Resource Limits */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">Límites y Permisos del Plan</span>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Sucursales</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="1"
                      value={planMaxBranches}
                      onChange={(e) => setPlanMaxBranches(parseInt(e.target.value) || 1)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#00a86b]"
                    />
                    <span className="text-[9px] text-slate-400 block leading-tight">999 = Ilim.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Usuarios</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="3"
                      value={planMaxUsers}
                      onChange={(e) => setPlanMaxUsers(parseInt(e.target.value) || 1)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#00a86b]"
                    />
                    <span className="text-[9px] text-slate-400 block leading-tight">999 = Ilim.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Productos</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="250"
                      value={planMaxProducts}
                      onChange={(e) => setPlanMaxProducts(parseInt(e.target.value) || 250)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#00a86b]"
                    />
                    <span className="text-[9px] text-slate-400 block leading-tight">999999 = Ilim.</span>
                  </div>
                </div>

                <div className="space-y-2 mt-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planFelAllowed}
                      onChange={(e) => setPlanFelAllowed(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Habilitar Facturación Electrónica SAT (FEL)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planAiAssistantAllowed}
                      onChange={(e) => setPlanAiAssistantAllowed(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Habilitar Asistente Inteligente con IA (Gemini)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planMultiBranchAllowed}
                      onChange={(e) => setPlanMultiBranchAllowed(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Habilitar Múltiples Sucursales y Traslado de Stock</span>
                  </label>
                </div>
              </div>

              {/* Plan Features */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Características (una por línea) *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="1000 productos&#10;2 usuarios&#10;100.000 ventas/mes"
                  value={planFeaturesText}
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Buttons */}
              <div className="space-y-2 pt-3 border-t border-slate-150">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#00a86b] hover:bg-[#00925d] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Crear Plan
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewPlanModalOpen(false)}
                  className="w-full py-2.5 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {isEditPlanModalOpen && editingPlan && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#00a86b] text-white px-6 py-5 flex justify-between items-center shadow-md">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1.5 bg-white/15 rounded-lg">
                    <Edit className="w-5 h-5 text-white" />
                  </span>
                  Editar Plan de Suscripción
                </h3>
                <p className="text-xs text-emerald-100 font-medium">Modificando: {editingPlan.name}</p>
              </div>
              <button 
                onClick={() => { setIsEditPlanModalOpen(false); setEditingPlan(null); }} 
                className="p-1.5 hover:bg-white/15 rounded-full text-white/80 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePlan} className="p-6 space-y-4 text-left bg-slate-50/20">
              {/* Plan Name and Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Nombre del Plan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Básico, Profesional, etc."
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Insignia / Badge (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Recomendado, Popular, Ilimitado"
                    value={planBadge}
                    onChange={(e) => setPlanBadge(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Price and Period */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Precio / Tarifa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Q 199.00"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Frecuencia / Periodo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: /mes o /año"
                    value={planPeriod}
                    onChange={(e) => setPlanPeriod(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Estado *</label>
                <select
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none cursor-pointer"
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Próximamente">Próximamente</option>
                </select>
              </div>

              {/* Resource Limits */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">Límites y Permisos del Plan</span>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Sucursales</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="1"
                      value={planMaxBranches}
                      onChange={(e) => setPlanMaxBranches(parseInt(e.target.value) || 1)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#00a86b]"
                    />
                    <span className="text-[9px] text-slate-400 block leading-tight">999 = Ilim.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Usuarios</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="3"
                      value={planMaxUsers}
                      onChange={(e) => setPlanMaxUsers(parseInt(e.target.value) || 1)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#00a86b]"
                    />
                    <span className="text-[9px] text-slate-400 block leading-tight">999 = Ilim.</span>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Productos</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="250"
                      value={planMaxProducts}
                      onChange={(e) => setPlanMaxProducts(parseInt(e.target.value) || 250)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-[#00a86b]"
                    />
                    <span className="text-[9px] text-slate-400 block leading-tight">999999 = Ilim.</span>
                  </div>
                </div>

                <div className="space-y-2 mt-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planFelAllowed}
                      onChange={(e) => setPlanFelAllowed(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Habilitar Facturación Electrónica SAT (FEL)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planAiAssistantAllowed}
                      onChange={(e) => setPlanAiAssistantAllowed(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Habilitar Asistente Inteligente con IA (Gemini)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planMultiBranchAllowed}
                      onChange={(e) => setPlanMultiBranchAllowed(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Habilitar Múltiples Sucursales y Traslado de Stock</span>
                  </label>
                </div>
              </div>

              {/* Plan Features */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Características (una por línea) *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="1000 productos&#10;2 usuarios&#10;100.000 ventas/mes"
                  value={planFeaturesText}
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#00a86b] focus:border-transparent outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Buttons */}
              <div className="space-y-2 pt-3 border-t border-slate-150">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#00a86b] hover:bg-[#00925d] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditPlanModalOpen(false); setEditingPlan(null); }}
                  className="w-full py-2.5 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW LICENSE MODAL (Requirement 8) */}
      {isRenewModalOpen && renewingLicenseUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-5 flex justify-between items-center shadow-md">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1.5 bg-white/10 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-blue-100" />
                  </span>
                  Renovar Licencia
                </h3>
                <p className="text-xs text-blue-100 font-medium font-sans">Selecciona el período de renovación de plan</p>
              </div>
              <button 
                onClick={() => { setIsRenewModalOpen(false); setRenewingLicenseUser(null); }} 
                className="p-1.5 hover:bg-white/15 rounded-full text-blue-100 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRenewSubmit} className="p-6 space-y-4 text-left bg-slate-50/20">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-1 text-slate-700">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Cliente Seleccionado</span>
                <span className="font-black text-xs block truncate">{renewingLicenseUser.clientName}</span>
                <span className="text-[10px] text-slate-500 block truncate">{renewingLicenseUser.clientEmail}</span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider font-sans">Duración de la Licencia</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRenewDuration(30)}
                    className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                      renewDuration === 30
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20 font-sans'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-sans'
                    }`}
                  >
                    <span className="block text-lg font-black tracking-tight font-sans">30 Días</span>
                    <span className="text-[10px] text-slate-400 font-medium font-sans">Plan Mensual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewDuration(365)}
                    className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                      renewDuration === 365
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20 font-sans'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-sans'
                    }`}
                  >
                    <span className="block text-lg font-black tracking-tight font-sans">365 Días</span>
                    <span className="text-[10px] text-slate-400 font-medium font-sans">Plan Anual</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl font-mono text-[10px] text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Nueva fecha inicio:</span>
                  <span className="font-bold text-slate-700">{new Date().toISOString().split('T')[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nueva fecha vencimiento:</span>
                  <span className="font-bold text-emerald-600">
                    {(() => {
                      const d = new Date();
                      d.setDate(d.getDate() + renewDuration);
                      return d.toISOString().split('T')[0];
                    })()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-150">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md uppercase tracking-wider active:scale-98 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Confirmar Renovación
                </button>
                <button
                  type="button"
                  onClick={() => { setIsRenewModalOpen(false); setRenewingLicenseUser(null); }}
                  className="w-full py-2.5 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all text-center cursor-pointer font-sans"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Subscription Modal (Vista Previa Cliente en Tiempo Real) */}
      <PlanModal
        isOpen={isPreviewPlanModalOpen}
        onClose={() => setIsPreviewPlanModalOpen(false)}
        userId={user.id}
        userLicense={{
          id: 'admin_preview_license',
          userId: user.id,
          application: 'Yaa POS',
          clientName: 'Vista Previa Cliente',
          clientEmail: user.email,
          planType: 'Profesional',
          issueDate: new Date().toISOString().split('T')[0],
          expirationDate: '2030-12-31',
          status: 'Activo'
        }}
        currentBranchesCount={1}
        currentUsersCount={2}
        currentProductsCount={48}
        onPlanUpdated={(newLic) => {
          console.log('Vista previa plan actualizado:', newLic);
        }}
      />

    </div>
  );
}
