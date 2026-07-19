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
  Activity,
  Trash2,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';

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
  const [formPlanType, setFormPlanType] = useState('Mensual Básico');
  const [formExpirationDate, setFormExpirationDate] = useState('');
  const [formStatus, setFormStatus] = useState<'Activo' | 'Por Vencer' | 'Suspendida' | 'Expirada'>('Activo');

  // Plans modification state
  const [plans, setPlans] = useState(() => {
    const saved = localStorage.getItem('yaa_pos_plans');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'demo',
        name: 'Demo 15 días',
        price: 'Q 0.00',
        period: ' / 15 días',
        badge: 'Prueba',
        desc: 'Evaluación completa y acceso ilimitado a todas las herramientas operativas durante dos semanas.',
        features: ['1 Sucursal', 'Base de datos compartida', 'Soporte vía chat']
      },
      {
        id: 'basic',
        name: 'Mensual Básico',
        price: 'Q 250.00',
        period: ' / mes',
        badge: 'Mensual',
        desc: 'Ideal para comercios minoristas, farmacias medianas y emprendimientos de facturación diaria.',
        features: ['Usuarios ilimitados del turno', 'Punto de venta e inventario', 'Cierres de caja y arqueos', 'Soporte técnico 24/7']
      },
      {
        id: 'premium',
        name: 'Premium Anual',
        price: 'Q 2,400.00',
        period: ' / año',
        badge: 'Anual',
        desc: 'Plan empresarial con descuento de dos meses incluidos para máxima estabilidad de tu negocio.',
        features: ['Todas las funciones habilitadas', 'Respaldos automáticos en la nube', 'Reportes de utilidades y ganancias', 'API para sincronización externa']
      }
    ];
  });

  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planPrice, setPlanPrice] = useState('');
  const [planDesc, setPlanDesc] = useState('');

  // Config states
  const [appName, setAppName] = useState(() => localStorage.getItem('yaa_pos_admin_app_name') || 'Yaa POS');
  const [smtpServer, setSmtpServer] = useState(() => localStorage.getItem('yaa_pos_admin_smtp') || 'smtp.yaapos.com');
  const [backupFreq, setBackupFreq] = useState(() => localStorage.getItem('yaa_pos_admin_backup') || 'Cada 24 horas (Recomendado)');
  const [storageLimit, setStorageLimit] = useState(() => localStorage.getItem('yaa_pos_admin_storage') || '250 MB');
  const [showConfigSuccess, setShowConfigSuccess] = useState(false);

  // Fetch users from firestore on mount
  useEffect(() => {
    async function loadUsers() {
      setIsUsersLoading(true);
      setError(null);
      try {
        const list = await api.getAdminUsers();
        // De-duplicate list by ID just in case
        const uniqueList: User[] = [];
        const seenIds = new Set<string>();
        for (const u of list) {
          if (u.id && !seenIds.has(u.id)) {
            seenIds.add(u.id);
            uniqueList.push(u);
          }
        }
        const sorted = uniqueList.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setUsers(sorted);
      } catch (err: any) {
        console.error('Error fetching admin users:', err);
        setError(err.message || 'Error al cargar los usuarios de Firestore');
      } finally {
        setIsUsersLoading(false);
      }
    }
    loadUsers();
  }, []);

  // Initialize and synchronize licenses with users list
  useEffect(() => {
    if (users.length > 0) {
      async function syncLicenses() {
        let firebaseLicenses: License[] = [];
        try {
          firebaseLicenses = await api.getAdminLicenses();
        } catch (err) {
          console.error("Error loading licenses from Firestore", err);
        }

        const saved = localStorage.getItem('yaa_pos_licenses');
        let localParsed: License[] = [];
        if (saved) {
          try {
            localParsed = JSON.parse(saved) as License[];
          } catch {}
        }

        const mergedMap = new Map<string, License>();
        
        // 1. Populate with local first
        localParsed.forEach(l => {
          if (l.userId) mergedMap.set(l.userId, l);
        });

        // 2. Override/add with Firestore licenses (cloud is source of truth)
        firebaseLicenses.forEach(l => {
          if (l.userId) mergedMap.set(l.userId, l);
        });

        // 3. Ensure all registered users have a license. Generate default if missing.
        users.forEach((u, index) => {
          if (!mergedMap.has(u.id)) {
            let plan = 'Mensual Básico';
            let status: 'Activo' | 'Por Vencer' | 'Suspendida' | 'Expirada' = 'Activo';
            
            if (index === 0) {
              plan = 'Premium Anual';
              status = 'Activo';
            } else if (index === 1) {
              plan = 'Mensual Básico';
              status = 'Activo';
            } else if (index === 2) {
              plan = 'Demo 15 días';
              status = 'Por Vencer';
            }

            const regDate = u.createdAt ? new Date(u.createdAt) : new Date();
            let expDate = new Date();
            if (plan === 'Premium Anual') expDate.setFullYear(regDate.getFullYear() + 1);
            else if (plan === 'Mensual Básico') expDate.setMonth(regDate.getMonth() + 1);
            else expDate.setDate(regDate.getDate() + 15);

            const newLic: License = {
              userId: u.id,
              clientName: u.name,
              clientEmail: u.email,
              application: 'Yaa POS',
              planType: plan,
              expirationDate: expDate.toISOString().split('T')[0],
              status: status
            };
            mergedMap.set(u.id, newLic);

            // Save new default to Firestore immediately
            api.saveAdminLicense(newLic).catch(err => console.error("Error saving auto-generated license to Firestore:", err));
          }
        });

        const updated = Array.from(mergedMap.values());
        setLicenses(updated);
        localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
      }
      
      syncLicenses();
    }
  }, [users]);

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

    const newId = formUserId || 'usr_' + Math.random().toString(36).substr(2, 9);
    const newLic: License = {
      userId: newId,
      clientName: formClientName,
      clientEmail: formClientEmail,
      application: 'Yaa POS',
      planType: formPlanType,
      expirationDate: formExpirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: formStatus
    };

    const updated = [newLic, ...licenses];
    setLicenses(updated);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
    
    try {
      await api.saveAdminLicense(newLic);
    } catch (err: any) {
      console.error('Error saving new license to Firestore:', err);
    }

    // Close modal and reset fields
    setIsNewLicenseModalOpen(false);
    setFormUserId('');
    setFormClientName('');
    setFormClientEmail('');
    setFormPlanType('Mensual Básico');
    setFormExpirationDate('');
    setFormStatus('Activo');
  };

  // Edit license triggers
  const handleEditLicenseClick = (lic: License) => {
    setEditingLicense(lic);
    setFormPlanType(lic.planType);
    setFormExpirationDate(lic.expirationDate);
    setFormStatus(lic.status);
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

    const updated = licenses.map(l => {
      if (l.userId === editingLicense.userId) {
        return targetLicense;
      }
      return l;
    });

    setLicenses(updated);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
    setIsEditLicenseModalOpen(false);
    setEditingLicense(null);

    try {
      await api.saveAdminLicense(targetLicense);
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
    let updatedLicense: License | null = null;
    const updated = licenses.map(l => {
      if (l.userId === lic.userId) {
        const nextStatus: 'Activo' | 'Suspendida' = l.status === 'Suspendida' ? 'Activo' : 'Suspendida';
        updatedLicense = {
          ...l,
          status: nextStatus
        };
        return updatedLicense;
      }
      return l;
    });
    setLicenses(updated);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));

    if (updatedLicense) {
      try {
        await api.saveAdminLicense(updatedLicense);
      } catch (err: any) {
        console.error('Error toggling license status in Firestore:', err);
      }
    }
  };

  // Update a single license field instantly (for inline tables)
  const handleUpdateLicenseField = async (userId: string, field: keyof License, value: any) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('Acceso Denegado: Su usuario no tiene permisos para realizar esta acción. ID de administrador requerido: uSEwpR9zZPWvekBQKdx1SMsrs7n1');
      return;
    }
    let updatedLicense: License | null = null;
    const updated = licenses.map(l => {
      if (l.userId === userId) {
        updatedLicense = {
          ...l,
          [field]: value
        } as License;
        return updatedLicense;
      }
      return l;
    });
    
    setLicenses(updated);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updated));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
    
    if (updatedLicense) {
      try {
        await api.saveAdminLicense(updatedLicense);
      } catch (err: any) {
        console.error('Error saving inline license field update to Firestore:', err);
        alert('Error al guardar cambio en la nube, pero se actualizó localmente: ' + err.message);
      }
    }
  };

  // Resolve license state into 6 possible states: Pendiente, Activa, Por vencer, Expirada, Suspendida, Desactivada
  const resolveFullLicenseState = (lic: License, targetUser: User): 'Pendiente' | 'Activa' | 'Por vencer' | 'Expirada' | 'Suspendida' | 'Desactivada' => {
    const accountStatus = targetUser?.accountStatus || 'Activa';

    if (accountStatus === 'Suspendida' || lic?.status === 'Suspendida') {
      return 'Suspendida';
    }
    if ((accountStatus as any) === 'Desactivada' || (lic?.status as any) === 'Desactivada') {
      return 'Desactivada';
    }
    if (lic?.status === 'Pendiente') {
      return 'Pendiente';
    }

    if (lic?.expirationDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (lic.expirationDate < todayStr) {
        return 'Expirada';
      }
      const daysRemaining = calculateDaysRemaining(lic.expirationDate);
      if (daysRemaining <= 7) {
        return 'Por vencer';
      }
    }
    return 'Activa';
  };

  const getBadge = (status: 'Pendiente' | 'Activa' | 'Por vencer' | 'Expirada' | 'Suspendida' | 'Desactivada') => {
    switch (status) {
      case 'Activa':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Activa
          </span>
        );
      case 'Por vencer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-3xs animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Por vencer
          </span>
        );
      case 'Expirada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-800 border border-red-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            Expirada
          </span>
        );
      case 'Suspendida':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
            Suspendida
          </span>
        );
      case 'Pendiente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-200 shadow-3xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            Pendiente
          </span>
        );
      case 'Desactivada':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-900/10 text-slate-800 border border-slate-400 shadow-3xs">
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
    if (status === 'Activo' || status === 'Activa') return 'Activa';
    if (status === 'Por Vencer' || status === 'Pendiente') return 'Pendiente';
    if (status === 'Expirada' || status === 'Vencida') return 'Vencida';
    return 'Suspendida';
  };

  // Helper to calculate days remaining
  const calculateDaysRemaining = (expirationDate: string): number => {
    if (!expirationDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expirationDate);
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
    const todayStr = new Date().toISOString().split('T')[0];
    const updated: License = {
      ...lic,
      status: 'Activa',
      licenseStartDate: lic.licenseStartDate || todayStr
    };
    
    // Save locally
    const updatedLicenses = licenses.map(l => l.userId === lic.userId ? updated : l);
    setLicenses(updatedLicenses);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updatedLicenses));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
    
    // Save to Firestore
    try {
      await api.saveAdminLicense(updated);
    } catch (err) {
      console.error('Error saving license in Firestore:', err);
    }

    // Activate user account too
    const targetUser = users.find(u => u.id === lic.userId);
    if (targetUser && targetUser.accountStatus !== 'Activa') {
      const updatedUser: User = {
        ...targetUser,
        accountStatus: 'Activa'
      };
      setUsers(users.map(u => u.id === targetUser.id ? updatedUser : u));
      try {
        await api.saveAdminUser(updatedUser);
      } catch (err) {
        console.error('Error saving user in Firestore:', err);
      }
    }
    alert('Licencia activada correctamente.');
  };

  const handleDeactivateLicense = async (lic: License) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('No autorizado');
      return;
    }
    const updated: License = {
      ...lic,
      status: 'Desactivada' as any
    };
    
    const updatedLicenses = licenses.map(l => l.userId === lic.userId ? updated : l);
    setLicenses(updatedLicenses);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updatedLicenses));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));

    try {
      await api.saveAdminLicense(updated);
    } catch (err) {
      console.error('Error saving license in Firestore:', err);
    }

    // Deactivate user account too
    const targetUser = users.find(u => u.id === lic.userId);
    if (targetUser && targetUser.accountStatus !== 'Desactivada') {
      const updatedUser: User = {
        ...targetUser,
        accountStatus: 'Desactivada'
      };
      setUsers(users.map(u => u.id === targetUser.id ? updatedUser : u));
      try {
        await api.saveAdminUser(updatedUser);
      } catch (err) {
        console.error('Error saving user in Firestore:', err);
      }
    }
    alert('Licencia desactivada correctamente.');
  };

  const handleSuspendUser = async (userId: string) => {
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('No autorizado');
      return;
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const updatedUser: User = {
      ...targetUser,
      accountStatus: 'Suspendida'
    };

    setUsers(users.map(u => u.id === userId ? updatedUser : u));
    try {
      await api.saveAdminUser(updatedUser);
    } catch (err) {
      console.error('Error saving user in Firestore:', err);
    }

    // Also set license as suspended
    const targetLic = licenses.find(l => l.userId === userId);
    if (targetLic) {
      const updatedLic: License = {
        ...targetLic,
        status: 'Suspendida'
      };
      const updatedLicenses = licenses.map(l => l.userId === userId ? updatedLic : l);
      setLicenses(updatedLicenses);
      localStorage.setItem('yaa_pos_licenses', JSON.stringify(updatedLicenses));
      window.dispatchEvent(new Event('yaa_pos_licenses_updated'));
      try {
        await api.saveAdminLicense(updatedLic);
      } catch (err) {
        console.error('Error saving license in Firestore:', err);
      }
    }
    alert('Usuario y licencia suspendidos.');
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
      licenseStartDate: today.toISOString().split('T')[0],
      expirationDate: expDate.toISOString().split('T')[0]
    };

    const updatedLicenses = licenses.map(l => l.userId === renewingLicenseUser.userId ? updatedLicense : l);
    setLicenses(updatedLicenses);
    localStorage.setItem('yaa_pos_licenses', JSON.stringify(updatedLicenses));
    window.dispatchEvent(new Event('yaa_pos_licenses_updated'));

    try {
      await api.saveAdminLicense(updatedLicense);
    } catch (err) {
      console.error('Error saving renewed license:', err);
    }

    // Ensure account is Active too
    const targetUser = users.find(u => u.id === renewingLicenseUser.userId);
    if (targetUser && targetUser.accountStatus !== 'Activa') {
      const updatedUser: User = {
        ...targetUser,
        accountStatus: 'Activa'
      };
      setUsers(users.map(u => u.id === targetUser.id ? updatedUser : u));
      try {
        await api.saveAdminUser(updatedUser);
      } catch (err) {
        console.error('Error saving active user status:', err);
      }
    }

    setIsRenewModalOpen(false);
    setRenewingLicenseUser(null);
    alert(`Licencia renovada exitosamente por ${days} días.`);
  };

  // Dynamic calculations for cards
  const stats = useMemo(() => {
    const totalUsers = users.length;
    
    // License status counts
    const activeLic = licenses.filter(l => {
      const norm = normalizeLicenseStatus(l.status);
      const days = calculateDaysRemaining(l.expirationDate);
      return norm === 'Activa' && days > 0;
    }).length;

    const proximasAVencer = licenses.filter(l => {
      const norm = normalizeLicenseStatus(l.status);
      const days = calculateDaysRemaining(l.expirationDate);
      return norm === 'Activa' && days > 0 && days <= 7;
    }).length;

    const vencidas = licenses.filter(l => {
      const norm = normalizeLicenseStatus(l.status);
      const days = calculateDaysRemaining(l.expirationDate);
      return norm === 'Vencida' || days === 0;
    }).length;

    const suspendidos = users.filter(u => u.accountStatus === 'Suspendida').length;

    return {
      totalUsers,
      activeLic,
      proximasAVencer,
      vencidas,
      suspendidos
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

  // Edit plans handlers
  const handleEditPlanClick = (plan: any) => {
    setEditingPlan(plan);
    setPlanPrice(plan.price);
    setPlanDesc(plan.desc);
    setIsEditPlanModalOpen(true);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (user.id !== 'uSEwpR9zZPWvekBQKdx1SMsrs7n1') {
      alert('Acceso Denegado: Su usuario no tiene permisos para realizar esta acción.');
      return;
    }
    if (!editingPlan) return;

    const updated = plans.map(p => {
      if (p.id === editingPlan.id) {
        return {
          ...p,
          price: planPrice,
          desc: planDesc
        };
      }
      return p;
    });

    setPlans(updated);
    localStorage.setItem('yaa_pos_plans', JSON.stringify(updated));
    setIsEditPlanModalOpen(false);
    setEditingPlan(null);
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
      const d = new Date(isoString);
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
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 flex font-sans select-none antialiased">
      
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-68 bg-[#001529] text-slate-300 flex flex-col shrink-0 border-r border-slate-900 shadow-2xl z-20">
        
        {/* LOGO */}
        <div className="px-6 py-6 border-b border-slate-800/60 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <ShoppingCart className="w-6 h-6 text-[#00a86b]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-white tracking-tight font-display">Yaa</span>
              <span className="text-xl font-black text-[#00a86b] tracking-tight font-display uppercase">POS</span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Admin Console</p>
          </div>
        </div>

        {/* NAVIGATION MENUS */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 mb-3">
            <button
              type="button"
              onClick={onViewPOS}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-[#0050b3] hover:bg-[#096dd9] text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider"
            >
              <ShoppingCart className="w-4 h-4 text-blue-100" />
              <span>Ir a mi Tienda POS</span>
            </button>
          </div>

          <div className="px-3 mb-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Control de Licencias
          </div>
          
          {/* TAB: DASHBOARD */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#00a86b] text-white shadow-lg shadow-emerald-900/25'
                : 'hover:bg-slate-850/55 hover:text-slate-100 text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          {/* TAB: CLIENTES / ARCHIVOS */}
          <button
            type="button"
            onClick={() => setActiveTab('clientes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'clientes'
                ? 'bg-[#00a86b] text-white shadow-lg shadow-emerald-900/25'
                : 'hover:bg-slate-850/55 hover:text-slate-100 text-slate-400'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Clientes / Repositorio</span>
          </button>

          {/* TAB: USUARIOS REGISTRADOS */}
          <button
            type="button"
            onClick={() => setActiveTab('usuarios')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'usuarios'
                ? 'bg-[#00a86b] text-white shadow-lg shadow-emerald-900/25'
                : 'hover:bg-slate-850/55 hover:text-slate-100 text-slate-400'
            }`}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span>Usuarios Registrados</span>
          </button>

          {/* TAB: LICENCIAS ACTIVAS */}
          <button
            type="button"
            onClick={() => setActiveTab('licencias_activas')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'licencias_activas'
                ? 'bg-[#00a86b] text-white shadow-lg shadow-emerald-900/25'
                : 'hover:bg-slate-850/55 hover:text-slate-100 text-slate-400'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Licencias Activas</span>
          </button>

          <div className="px-3 pt-6 mb-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Comercial
          </div>

          {/* TAB: PLANES Y PRECIOS */}
          <button
            type="button"
            onClick={() => setActiveTab('planes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'planes'
                ? 'bg-[#00a86b] text-white shadow-lg shadow-emerald-900/25'
                : 'hover:bg-slate-850/55 hover:text-slate-100 text-slate-400'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Planes y Precios</span>
          </button>

          {/* TAB: CONFIGURACION */}
          <button
            type="button"
            onClick={() => setActiveTab('configuracion')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'configuracion'
                ? 'bg-[#00a86b] text-white shadow-lg shadow-emerald-900/25'
                : 'hover:bg-slate-850/55 hover:text-slate-100 text-slate-400'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Configuración</span>
          </button>
        </nav>

        {/* LOGGED IN USER PROFILE FOOTER */}
        <div className="p-4 border-t border-slate-800/70 bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="w-9 h-9 bg-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center border border-emerald-500/20">
                {user.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#001529] rounded-full animate-pulse"></span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-100 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 bg-red-950/20 hover:bg-red-950/60 text-red-400 hover:text-red-100 border border-red-900/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-wider text-[10px]"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* TOP BAR HEADER */}
        <header className="bg-white border-b border-slate-200/80 px-8 py-5 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 font-display">
              {activeTab === 'dashboard' && 'Gestión de Licencias y Accesos'}
              {activeTab === 'clientes' && 'Repositorio General de Clientes'}
              {activeTab === 'usuarios' && 'Consola Central de Usuarios Registrados'}
              {activeTab === 'licencias_activas' && 'Monitoreo de Licencias Activas'}
              {activeTab === 'planes' && 'Configuración de Planes Comerciales'}
              {activeTab === 'configuracion' && 'Parámetros del Servidor y Sistema'}
            </h2>
            <p className="text-xs text-slate-400 font-medium font-sans">
              {activeTab === 'dashboard' && 'Visualiza, emite y administra el estado de las licencias de tus clientes'}
              {activeTab === 'clientes' && 'Inspecciona archivos, facturas de compras y respaldos de las bases de datos de los clientes'}
              {activeTab === 'usuarios' && 'Lista completa de cuentas registradas en el sistema de base de datos'}
              {activeTab === 'licencias_activas' && 'Consulta únicamente las licencias habilitadas y por vencer'}
              {activeTab === 'planes' && 'Valores comerciales de licenciamiento y características de Yaa POS'}
              {activeTab === 'configuracion' && 'Respaldos automatizados, logs de auditoría, y límites del sistema operativo'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'dashboard' && (
              <button
                type="button"
                onClick={() => setIsNewLicenseModalOpen(true)}
                className="px-5 py-3 bg-[#009b72] hover:bg-[#008662] text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 uppercase tracking-wide"
              >
                <Plus className="w-4 h-4 text-emerald-100" /> Nueva Licencia
              </button>
            )}
            <button
              type="button"
              onClick={onViewPOS}
              className="px-4 py-2.5 bg-[#0050b3] hover:bg-[#096dd9] text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer uppercase tracking-wider flex items-center gap-2 shrink-0"
            >
              <ShoppingCart className="w-4 h-4 text-blue-100" />
              <span>Ir a mi Tienda POS</span>
            </button>
            <span className="hidden md:flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
              <Activity className="w-3.5 h-3.5 text-emerald-500" /> Servidor Live
            </span>
          </div>
        </header>

        {/* CORE VIEWS RENDERER */}
        <main className="flex-1 p-8 space-y-8">
          
          {/* TAB: DASHBOARD */}
          {(activeTab === 'dashboard' || activeTab === 'licencias_activas') && (
            <>
              {/* DYNAMIC METRIC STATS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                
                {/* Total de usuarios */}
                <div className="bg-blue-50/70 border border-blue-100/70 rounded-3xl p-5 flex items-center gap-4 shadow-3xs hover:shadow-2xs transition-all">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-blue-600 block uppercase tracking-wider font-sans">Total de Usuarios</span>
                    <span className="text-2xl font-black text-blue-800 font-mono tracking-tight block">
                      {stats.totalUsers.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Usuarios con licencia activa */}
                <div className="bg-[#edfbf4] border border-[#d2f4df] rounded-3xl p-5 flex items-center gap-4 shadow-3xs hover:shadow-2xs transition-all">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl shrink-0">
                    <ShieldCheck className="w-5 h-5 text-[#00a86b]" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#00a86b] block uppercase tracking-wider font-sans">Licencias Activas</span>
                    <span className="text-2xl font-black text-emerald-800 font-mono tracking-tight block">
                      {stats.activeLic.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Licencias próximas a vencer (< 7 días) */}
                <div className="bg-[#fef9eb] border border-[#fdf0cd] rounded-3xl p-5 flex items-center gap-4 shadow-3xs hover:shadow-2xs transition-all">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-600 block uppercase tracking-wider font-sans">Próximas a Vencer</span>
                    <span className="text-2xl font-black text-amber-800 font-mono tracking-tight block">
                      {stats.proximasAVencer.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Licencias vencidas */}
                <div className="bg-orange-50 border border-orange-100 rounded-3xl p-5 flex items-center gap-4 shadow-3xs hover:shadow-2xs transition-all">
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl shrink-0">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-orange-600 block uppercase tracking-wider font-sans">Licencias Vencidas</span>
                    <span className="text-2xl font-black text-orange-800 font-mono tracking-tight block">
                      {stats.vencidas.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Usuarios suspendidos */}
                <div className="bg-[#fff1f1] border border-[#ffe0e0] rounded-3xl p-5 flex items-center gap-4 shadow-3xs hover:shadow-2xs transition-all">
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                    <Lock className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase tracking-wider font-sans">Usuarios Suspendidos</span>
                    <span className="text-2xl font-black text-rose-800 font-mono tracking-tight block">
                      {stats.suspendidos.toLocaleString()}
                    </span>
                  </div>
                </div>

              </div>

              {/* TABLE: ULTIMAS LICENCIAS EMITIDAS */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-6 py-5 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 text-sm font-sans">
                    {activeTab === 'licencias_activas' ? 'Monitoreo de Licencias Activas' : 'Últimas Licencias Emitidas'}
                  </h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-3 py-1 rounded-full font-mono">
                    Consola General ({licenses.length})
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 text-slate-500 font-bold border-b border-slate-150 uppercase tracking-wider text-[10px]">
                        <th className="py-4.5 px-6">Cliente</th>
                        <th className="py-4.5 px-6">Aplicación</th>
                        <th className="py-4.5 px-6">Tipo de Plan</th>
                        <th className="py-4.5 px-6">Fecha de Expiración</th>
                        <th className="py-4.5 px-6 text-center">Estado</th>
                        <th className="py-4.5 px-6 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {licenses
                        .filter(l => activeTab !== 'licencias_activas' || l.status === 'Activo' || l.status === 'Por Vencer')
                        .map((lic) => {
                          const targetUser = users.find(u => u.id === lic.userId) || {
                            id: lic.userId,
                            name: lic.clientName,
                            email: lic.clientEmail,
                            accountStatus: 'Activa'
                          } as User;
                          const resolvedState = resolveFullLicenseState(lic, targetUser);

                          return (
                            <tr key={lic.userId} className="hover:bg-slate-50/40 transition-colors">
                            
                            {/* Cliente */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 text-slate-700 font-black text-xs rounded-lg flex items-center justify-center uppercase font-mono">
                                  {lic.clientName[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-900 truncate text-sm">{lic.clientName}</p>
                                  <p className="text-[10px] text-slate-400 truncate font-mono">{lic.clientEmail}</p>
                                </div>
                              </div>
                            </td>

                            {/* Aplicacion */}
                            <td className="py-4 px-6 text-slate-600 font-semibold">
                              {lic.application}
                            </td>

                            {/* Tipo de Plan */}
                            <td className="py-4 px-6 font-medium">
                              {user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' ? (
                                <select
                                  value={lic.planType}
                                  onChange={(e) => handleUpdateLicenseField(lic.userId, 'planType', e.target.value)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                                >
                                  <option value="Demo 15 días">Demo 15 días</option>
                                  <option value="Mensual Básico">Mensual Básico</option>
                                  <option value="Premium Anual">Premium Anual</option>
                                  <option value="Gratuito">Gratuito</option>
                                </select>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px]">
                                  {lic.planType}
                                </span>
                              )}
                            </td>

                            {/* Fecha de Expiracion */}
                            <td className="py-4 px-6 font-mono text-slate-500 font-medium text-[11px]">
                              {user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' ? (
                                <input
                                  type="date"
                                  value={lic.expirationDate}
                                  onChange={(e) => handleUpdateLicenseField(lic.userId, 'expirationDate', e.target.value)}
                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-[11px] font-medium font-mono cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all"
                                />
                              ) : (
                                formatDate(lic.expirationDate)
                              )}
                            </td>

                            {/* Estado (Matching the exact look from user's image) */}
                            <td className="py-4 px-6 text-center">
                              <div className="flex justify-center">
                                {user.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' ? (
                                  <select
                                    value={lic.status}
                                    onChange={(e) => handleUpdateLicenseField(lic.userId, 'status', e.target.value as any)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-center block w-32 shadow-xs border cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-all ${
                                      lic.status === 'Activa' || lic.status === 'Activo' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                      lic.status === 'Por vencer' || lic.status === 'Por Vencer' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                      lic.status === 'Suspendida' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                      lic.status === 'Desactivada' ? 'bg-slate-900/10 text-slate-800 border-slate-300' :
                                      lic.status === 'Pendiente' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                                      'bg-red-50 text-red-800 border-red-200'
                                    }`}
                                  >
                                    <option value="Activa">Activa</option>
                                    <option value="Por vencer">Por vencer</option>
                                    <option value="Suspendida">Suspendida</option>
                                    <option value="Expirada">Expirada</option>
                                    <option value="Pendiente">Pendiente</option>
                                    <option value="Desactivada">Desactivada</option>
                                  </select>
                                ) : (
                                  getBadge(resolvedState)
                                )}
                              </div>
                            </td>

                            {/* Acciones (Matches action designs in screenshot) */}
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center gap-2">
                                {/* Eye button */}
                                <button
                                  type="button"
                                  onClick={() => handleInspectClient(lic)}
                                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200 shadow-3xs cursor-pointer active:scale-95"
                                  title="Inspeccionar archivos / carpeta"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {/* Lock button */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleLock(lic)}
                                  className={`p-2 rounded-xl transition-all border shadow-3xs cursor-pointer active:scale-95 ${
                                    lic.status === 'Suspendida' 
                                      ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                  }`}
                                  title={lic.status === 'Suspendida' ? 'Reactivar Licencia' : 'Suspender Licencia'}
                                >
                                  {lic.status === 'Suspendida' ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                                {/* Pencil edit button */}
                                <button
                                  type="button"
                                  onClick={() => handleEditLicenseClick(lic)}
                                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200 shadow-3xs cursor-pointer active:scale-95"
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
            </>
          )}

          {/* TAB: CLIENTES (CRM REPOSITORY & FILE INSPECTOR PANEL) */}
          {activeTab === 'clientes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Customer Card List (7 Columns) */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                
                {/* Search header bar */}
                <div className="p-5 border-b border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#00a86b]" />
                    <h3 className="font-extrabold text-slate-800 text-sm">Cartera de Clientes ({filteredUsers.length})</h3>
                  </div>
                  
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por nombre o correo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white text-xs border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {error && (
                  <div className="m-4 p-4 bg-red-50/75 border border-red-200 rounded-2xl text-xs text-red-600 font-medium">
                    {error}
                  </div>
                )}

                {/* Users list rows */}
                <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                  {isUsersLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                      <Loader2 className="w-8 h-8 text-[#00a86b] animate-spin" />
                      <p className="text-xs font-bold">Cargando base de datos de usuarios de Firestore...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs font-bold">
                      No se encontraron usuarios en la base de datos.
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUser?.id === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleSelectUser(u)}
                          className={`w-full text-left p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                            isSelected 
                              ? 'bg-emerald-50/40 border-l-4 border-[#00a86b]' 
                              : 'hover:bg-slate-50/50 border-l-4 border-transparent'
                          }`}
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-800 truncate">{u.name}</span>
                              {u.id === 'uSEwpR9zZPWvekBQKdx1SMsrs7n1' && (
                                <span className="bg-blue-500/10 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wide">ADMIN</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate font-medium">{u.email}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {u.id}
                            </div>
                          </div>

                          <div className="flex flex-col sm:items-end gap-1 font-sans">
                            <div className="text-xs text-slate-400 font-medium">
                              Reg: <span className="font-bold text-slate-600">{formatDate(u.createdAt)}</span>
                            </div>
                            <span className="text-[10px] text-[#00a86b] font-extrabold flex items-center gap-0.5 hover:underline uppercase tracking-wide">
                              Ver Archivos &rarr;
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

              </div>

              {/* Right Profile & Folder Inspector Panel (5 Columns) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Profile Widget */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-[#00a86b]" /> Detalle del Usuario
                  </h4>

                  {selectedUser ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                        <div className="w-11 h-11 bg-emerald-100 text-[#00a86b] font-black text-sm rounded-xl flex items-center justify-center uppercase font-mono">
                          {selectedUser.name ? selectedUser.name[0] : 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 text-sm truncate">{selectedUser.name}</p>
                          <p className="text-xs text-slate-500 font-mono truncate">{selectedUser.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                          <span className="text-slate-400 text-[10px] block font-bold uppercase tracking-wider">Identificador</span>
                          <span className="font-mono text-slate-600 block text-[10px] truncate" title={selectedUser.id}>{selectedUser.id}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                          <span className="text-slate-400 text-[10px] block font-bold uppercase tracking-wider">Miembro Desde</span>
                          <span className="text-slate-600 font-bold block text-[11px]">{formatDate(selectedUser.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs font-bold border-2 border-dashed border-slate-200 rounded-2xl">
                      Seleccione un cliente para ver su perfil y complementos
                    </div>
                  )}
                </div>

                {/* Cloud storage list of uploads */}
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs flex flex-col min-h-[300px]">
                  <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-amber-500" />
                      <h4 className="font-extrabold text-slate-800 text-sm">Archivos de Soporte / Complementos</h4>
                    </div>
                    {selectedUser && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono">
                        {userFiles.length}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto max-h-[40vh]">
                    {!selectedUser ? (
                      <p className="text-center text-xs text-slate-400 py-12 font-bold">Ningún cliente seleccionado</p>
                    ) : isFilesLoading ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                        <p className="text-xs text-slate-400 font-bold">Descargando metadatos de archivos...</p>
                      </div>
                    ) : userFiles.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 space-y-2 flex flex-col items-center">
                        <FileText className="w-10 h-10 text-slate-200" />
                        <p className="text-xs font-bold">El usuario no tiene archivos guardados en su repositorio.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userFiles.map((file) => (
                          <div 
                            key={file.id}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-100/50 transition-all"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs font-extrabold text-slate-800 truncate flex items-center gap-1.5" title={file.name}>
                                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                {file.name}
                              </p>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">{formatBytes(file.size)}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(file.uploadedAt)}</span>
                              </div>
                            </div>

                            <a
                              href={file.path}
                              target="_blank"
                              rel="noreferrer referrer"
                              className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-3xs cursor-pointer transition-colors"
                              title="Descargar archivo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

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

          {/* TAB: PLANES Y PRECIOS */}
          {activeTab === 'planes' && (
            <div className="space-y-8">
              <div className="max-w-4xl mx-auto text-center space-y-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight font-display">
                  Suscripciones y Licenciamiento Yaa POS
                </h3>
                <p className="text-sm text-slate-500 font-medium max-w-2xl mx-auto">
                  Configuración comercial de los tipos de planes vigentes de la plataforma para su emisión automatizada.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                
                {/* Plan 1 */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6.5 shadow-sm relative flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-[#00a86b] uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full">{plans[0].badge}</span>
                    <h4 className="text-lg font-extrabold text-slate-900">{plans[0].name}</h4>
                    <p className="text-xs text-slate-500">{plans[0].desc}</p>
                    <div className="pt-2">
                      <span className="text-2xl font-black text-slate-900 font-mono">{plans[0].price}</span>
                      <span className="text-slate-400 text-xs font-bold">{plans[0].period}</span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-2 pt-4 border-t border-slate-100">
                      {plans[0].features.map((feat: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> {feat}</li>
                      ))}
                    </ul>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleEditPlanClick(plans[0])}
                    className="w-full mt-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
                  >
                    Configurar Demo
                  </button>
                </div>

                {/* Plan 2 */}
                <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6.5 shadow-md relative flex flex-col justify-between">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full shadow-xs">Recomendado</div>
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-full">{plans[1].badge}</span>
                    <h4 className="text-lg font-extrabold text-slate-900">{plans[1].name}</h4>
                    <p className="text-xs text-slate-500">{plans[1].desc}</p>
                    <div className="pt-2">
                      <span className="text-2xl font-black text-slate-900 font-mono">{plans[1].price}</span>
                      <span className="text-slate-400 text-xs font-bold">{plans[1].period}</span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-2 pt-4 border-t border-slate-100">
                      {plans[1].features.map((feat: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> {feat}</li>
                      ))}
                    </ul>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleEditPlanClick(plans[1])}
                    className="w-full mt-6 py-3 bg-[#009b72] hover:bg-[#008662] text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
                  >
                    Modificar Tarifa
                  </button>
                </div>

                {/* Plan 3 */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6.5 shadow-sm relative flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider bg-purple-50 px-2.5 py-1 rounded-full">{plans[2].badge}</span>
                    <h4 className="text-lg font-extrabold text-slate-900">{plans[2].name}</h4>
                    <p className="text-xs text-slate-500">{plans[2].desc}</p>
                    <div className="pt-2">
                      <span className="text-2xl font-black text-slate-900 font-mono">{plans[2].price}</span>
                      <span className="text-slate-400 text-xs font-bold">{plans[2].period}</span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-2 pt-4 border-t border-slate-100">
                      {plans[2].features.map((feat: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> {feat}</li>
                      ))}
                    </ul>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleEditPlanClick(plans[2])}
                    className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition-all cursor-pointer"
                  >
                    Editar Plan
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* TAB: CONFIGURACION */}
          {activeTab === 'configuracion' && (
            <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-xs space-y-8">
              <div className="border-b border-slate-150 pb-5">
                <h3 className="text-base font-extrabold text-slate-800">Parámetros Operativos del Sistema</h3>
                <p className="text-xs text-slate-400 font-sans font-medium mt-1">Modifica políticas de renovación, copias de seguridad de firestore y notificaciones por correo</p>
              </div>

              {showConfigSuccess && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl p-4 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>¡Configuración guardada exitosamente en LocalStorage para esta sesión de administración!</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                
                {/* Input 1 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Nombre de la Aplicación</label>
                  <input 
                    type="text" 
                    value={appName} 
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" 
                  />
                </div>

                {/* Input 2 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Servidor SMTP de Notificaciones</label>
                  <input 
                    type="text" 
                    value={smtpServer} 
                    onChange={(e) => setSmtpServer(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden" 
                  />
                </div>

                {/* Select 1 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Respaldo Automático de Bases de Datos</label>
                  <select 
                    value={backupFreq}
                    onChange={(e) => setBackupFreq(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Cada 24 horas (Recomendado)">Cada 24 horas (Recomendado)</option>
                    <option value="Semanalmente">Semanalmente</option>
                    <option value="Desactivado">Desactivado</option>
                  </select>
                </div>

                {/* Select 2 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Límite de Almacenamiento por Cliente</label>
                  <select 
                    value={storageLimit}
                    onChange={(e) => setStorageLimit(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="250 MB">250 MB</option>
                    <option value="500 MB">500 MB</option>
                    <option value="1 GB (Premium)">1 GB (Premium)</option>
                  </select>
                </div>

              </div>

              {/* Status information boxes */}
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3">
                <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-emerald-800 text-xs">Sincronización Activa con Firebase</h5>
                  <p className="text-emerald-700 text-[11px] font-sans font-medium mt-0.5">La consola lee y escribe directamente en colecciones de Firestore en tiempo real. Todas las modificaciones de clientes y archivos se propagarán de inmediato.</p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-150">
                <button 
                  type="button" 
                  onClick={handleSaveConfig} 
                  className="px-6 py-3 bg-[#009b72] hover:bg-[#008662] text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Guardar Configuración
                </button>
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
                    <p className="text-xs font-bold max-w-xs leading-relaxed">Este usuario no ha subido ningún archivo o respaldo en la sección de complementos.</p>
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
                  <option value="Demo 15 días">Demo 15 días</option>
                  <option value="Mensual Básico">Mensual Básico</option>
                  <option value="Premium Anual">Premium Anual</option>
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
                <label className="block text-xs font-bold text-slate-600">Estado de Acceso</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Activo">Activo</option>
                  <option value="Por Vencer">Por Vencer</option>
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
                  <option value="Demo 15 días">Demo 15 días</option>
                  <option value="Mensual Básico">Mensual Básico</option>
                  <option value="Premium Anual">Premium Anual</option>
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
                <label className="block text-xs font-bold text-slate-600">Estado de Acceso *</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Activo">Activo</option>
                  <option value="Por Vencer">Por Vencer</option>
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

      {/* EDIT PLAN MODAL */}
      {isEditPlanModalOpen && editingPlan && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-5 flex justify-between items-center shadow-md">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1.5 bg-white/10 rounded-lg">
                    <Edit className="w-5 h-5 text-amber-100" />
                  </span>
                  Modificar Parámetros de Tarifa
                </h3>
                <p className="text-xs text-amber-100 font-medium font-sans truncate">Plan Comercial: {editingPlan.name}</p>
              </div>
              <button 
                onClick={() => { setIsEditPlanModalOpen(false); setEditingPlan(null); }} 
                className="p-1.5 hover:bg-white/15 rounded-full text-amber-100 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSavePlan} className="p-6 space-y-4 text-left bg-slate-50/20">
              
              {/* Plan Price */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Tarifa Mensual/Anual *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Q 300.00"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Plan Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Descripción Comercial del Plan *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detalles sobre el alcance del plan..."
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-150">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md uppercase tracking-wider"
                >
                  <Check className="w-4 h-4" /> Guardar Plan Comercial
                </button>
                <button
                  type="button"
                  onClick={() => { setIsEditPlanModalOpen(false); setEditingPlan(null); }}
                  className="w-full py-2.5 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all text-center"
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
                    <span className="text-[10px] text-slate-400 font-medium font-sans">Mensual Básico</span>
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
                    <span className="text-[10px] text-slate-400 font-medium font-sans">Premium Anual</span>
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

    </div>
  );
}
