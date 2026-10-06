import React, { useState, useMemo, useEffect } from 'react';
import { Branch, AppConfig, Product, User, Sale, Shift, Expense, Purchase } from '../types';
import { isItemInBranch } from '../utils/branchHelper';
import { 
  Building2, 
  Plus, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  UserCheck, 
  CheckCircle2, 
  Star, 
  Edit3, 
  Trash2, 
  ArrowRightLeft, 
  Search, 
  Filter, 
  X, 
  Store, 
  Check, 
  AlertCircle,
  Package,
  Layers,
  Info,
  DollarSign,
  TrendingDown,
  Inbox,
  BarChart3,
  ShieldCheck,
  ShoppingCart
} from 'lucide-react';

interface BranchesProps {
  config: AppConfig;
  products?: Product[];
  branchProducts?: Product[];
  user?: User | null;
  onSaveConfig: (cfg: AppConfig) => Promise<AppConfig>;
  onNavigate?: (tab: string) => void;
  sales?: Sale[];
  shifts?: Shift[];
  expenses?: Expense[];
  purchases?: Purchase[];
  activeBranchName?: string;
  onSwitchBranch?: (branchId: string) => void;
  onTransferStock?: (sourceBranchId: string, targetBranchId: string, productId: string, quantity: number) => Promise<void>;
}

const defaultBranchesSeed: Branch[] = [
  {
    id: 'branch-1',
    name: 'Sucursal Central (Sede Principal)',
    code: 'SUC-01',
    address: '6ta Avenida 12-40, Zona 1, Centro Histórico',
    city: 'Ciudad de Guatemala',
    department: 'Guatemala',
    phone: '2234-5678',
    email: 'central@yaapos.com',
    manager: 'Luis Fernando Mijangos',
    openingHours: 'Lun - Sáb: 07:30 - 20:30',
    isMain: true,
    isActive: true,
    notes: 'Sede central con almacén principal y atención al público.',
    createdAt: '2026-01-15T08:00:00.000Z'
  },
  {
    id: 'branch-2',
    name: 'Sucursal Zona 10 - Pradera',
    code: 'SUC-02',
    address: 'Boulevard Los Próceres 18-20, Zona 10',
    city: 'Ciudad de Guatemala',
    department: 'Guatemala',
    phone: '2367-8901',
    email: 'zona10@yaapos.com',
    manager: 'Karla Estrada',
    openingHours: 'Lun - Dom: 08:00 - 21:00',
    isMain: false,
    isActive: true,
    notes: 'Punto de venta zona comercial, alto flujo de clientes.',
    createdAt: '2026-03-10T09:30:00.000Z'
  },
  {
    id: 'branch-3',
    name: 'Sucursal Mixco - San Cristóbal',
    code: 'SUC-03',
    address: '3ra Calle 8-15, Sector B-1, Boulevard San Cristóbal',
    city: 'Mixco',
    department: 'Guatemala',
    phone: '2478-1122',
    email: 'mixco@yaapos.com',
    manager: 'Roberto Gómez',
    openingHours: 'Lun - Sáb: 08:00 - 19:30',
    isMain: false,
    isActive: true,
    notes: 'Sucursal residencial con servicio a domicilio.',
    createdAt: '2026-05-20T10:00:00.000Z'
  }
];

export default function Branches({ 
  config, 
  products = [], 
  branchProducts = [],
  user, 
  onSaveConfig, 
  onNavigate,
  sales = [],
  shifts = [],
  expenses = [],
  purchases = [],
  activeBranchName,
  onSwitchBranch,
  onTransferStock
}: BranchesProps) {
  // Current branches list from config or defaults
  const allBranches: Branch[] = useMemo(() => {
    if (config.branches && config.branches.length > 0) {
      return config.branches;
    }
    return defaultBranchesSeed;
  }, [config.branches]);

  // If user is operator with restricted branches:
  // "Solo verá y operará en las sucursales marcadas."
  const isBranchRestricted = useMemo(() => {
    if (!user?.isOperator) return false;
    const allowed = (user.branches && user.branches.length > 0)
      ? user.branches
      : (user.branch && user.branch !== 'Todas') ? user.branch.split(',').map(s => s.trim()) : [];
    return allowed.length > 0;
  }, [user]);

  const branches: Branch[] = useMemo(() => {
    if (user?.isOperator) {
      const allowedNames = (user.branches && user.branches.length > 0)
        ? user.branches
        : (user.branch && user.branch !== 'Todas') ? user.branch.split(',').map(s => s.trim()) : [];
      if (allowedNames.length > 0) {
        const filtered = allBranches.filter(b => 
          allowedNames.some(name => name.toLowerCase().trim() === b.name.toLowerCase().trim())
        );
        const missingNames = allowedNames.filter(name => 
          !filtered.some(b => b.name.toLowerCase().trim() === name.toLowerCase().trim())
        );
        const synthesized: Branch[] = missingNames.map((name, idx) => ({
          id: `branch-assigned-${idx}`,
          name: name,
          code: `SUC-${String(idx + 1).padStart(2, '0')}`,
          address: 'Sede autorizada para operaciones',
          city: 'Guatemala',
          isActive: true,
          isMain: idx === 0 && filtered.length === 0
        }));
        return [...filtered, ...synthesized];
      }
    }
    return allBranches;
  }, [allBranches, user]);

  const activeBranchId = useMemo(() => {
    if (activeBranchName) {
      const found = branches.find(b => b.name.toLowerCase().trim() === activeBranchName.toLowerCase().trim());
      if (found) return found.id;
    }
    const defaultBranchId = config.activeBranchId || branches.find(b => b.isMain)?.id || branches[0]?.id || '';
    if (user?.isOperator && isBranchRestricted) {
      const currentBranch = allBranches.find(b => b.id === defaultBranchId);
      const isAllowed = currentBranch && branches.some(b => b.id === currentBranch.id);
      if (!isAllowed) {
        return branches[0]?.id || defaultBranchId;
      }
    }
    return defaultBranchId;
  }, [config.activeBranchId, branches, allBranches, user, isBranchRestricted, activeBranchName]);

  // Compute strictly independent movements and financial metrics for each branch
  const branchMetrics = useMemo(() => {
    const map = new Map<string, {
      salesTotal: number;
      salesCount: number;
      expensesTotal: number;
      shiftsCount: number;
      activeShift: Shift | undefined;
      purchasesTotal: number;
      productsCount: number;
      totalStock: number;
    }>();

    branches.forEach(b => {
      const bSales = sales.filter(s => isItemInBranch(s.branch, b.name, branches));
      const salesTotal = bSales.reduce((acc, s) => acc + s.total, 0);
      const bExpenses = expenses.filter(e => isItemInBranch(e.branch, b.name, branches));
      const expensesTotal = bExpenses.reduce((acc, e) => acc + e.amount, 0);
      const bShifts = shifts.filter(sh => isItemInBranch(sh.branch, b.name, branches));
      const activeShift = bShifts.find(sh => sh.state === 'open');
      const bPurchases = purchases.filter(p => isItemInBranch(p.branch, b.name, branches));
      const purchasesTotal = bPurchases.reduce((acc, p) => acc + p.total, 0);
      const bProducts = products.filter(p => isItemInBranch(p.branch, b.name, branches));
      const totalStock = bProducts.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

      map.set(b.id, {
        salesTotal,
        salesCount: bSales.length,
        expensesTotal,
        shiftsCount: bShifts.length,
        activeShift,
        purchasesTotal,
        productsCount: bProducts.length,
        totalStock
      });
    });

    return map;
  }, [branches, sales, expenses, shifts, purchases, products]);

  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formDepartment, setFormDepartment] = useState('Guatemala');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formManager, setFormManager] = useState('');
  const [formOpeningHours, setFormOpeningHours] = useState('Lun - Sáb: 08:00 - 20:00');
  const [formIsMain, setFormIsMain] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Transfer form state
  const [transferSource, setTransferSource] = useState(branches[0]?.id || '');
  const [transferTarget, setTransferTarget] = useState(branches[1]?.id || '');
  const [transferProductId, setTransferProductId] = useState(products[0]?.id || '');
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    return branches.filter((branch) => {
      const matchesSearch = 
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (branch.manager && branch.manager.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (branch.city && branch.city.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? branch.isActive :
        !branch.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [branches, searchTerm, statusFilter]);

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingBranch(null);
    const nextNum = branches.length + 1;
    const formattedCode = `SUC-0${nextNum}`;
    setFormName('');
    setFormCode(formattedCode);
    setFormAddress('');
    setFormCity('Ciudad de Guatemala');
    setFormDepartment('Guatemala');
    setFormPhone('');
    setFormEmail('');
    setFormManager(user?.name || '');
    setFormOpeningHours('Lun - Sáb: 08:00 - 20:00');
    setFormIsMain(branches.length === 0);
    setFormIsActive(true);
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setFormName(branch.name);
    setFormCode(branch.code);
    setFormAddress(branch.address);
    setFormCity(branch.city || 'Ciudad de Guatemala');
    setFormDepartment(branch.department || 'Guatemala');
    setFormPhone(branch.phone || '');
    setFormEmail(branch.email || '');
    setFormManager(branch.manager || '');
    setFormOpeningHours(branch.openingHours || 'Lun - Sáb: 08:00 - 20:00');
    setFormIsMain(Boolean(branch.isMain));
    setFormIsActive(branch.isActive);
    setFormNotes(branch.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Save Branch (Create or Update)
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('El nombre de la sucursal es obligatorio.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('El código de sucursal es obligatorio.');
      return;
    }
    if (!formAddress.trim()) {
      setFormError('La dirección de la sucursal es obligatoria.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      let updatedBranches: Branch[] = [];

      if (editingBranch) {
        // Update existing
        updatedBranches = branches.map((b) => {
          if (b.id === editingBranch.id) {
            return {
              ...b,
              name: formName.trim(),
              code: formCode.trim().toUpperCase(),
              address: formAddress.trim(),
              city: formCity.trim(),
              department: formDepartment.trim(),
              phone: formPhone.trim(),
              email: formEmail.trim(),
              manager: formManager.trim(),
              openingHours: formOpeningHours.trim(),
              isMain: formIsMain,
              isActive: formIsActive,
              notes: formNotes.trim()
            };
          }
          // If this one becomes main, unmark other mains
          if (formIsMain && b.id !== editingBranch.id) {
            return { ...b, isMain: false };
          }
          return b;
        });
      } else {
        // Create new
        const newBranch: Branch = {
          id: `branch-${Date.now()}`,
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          city: formCity.trim(),
          department: formDepartment.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          manager: formManager.trim(),
          openingHours: formOpeningHours.trim(),
          isMain: formIsMain || branches.length === 0,
          isActive: formIsActive,
          notes: formNotes.trim(),
          createdAt: new Date().toISOString()
        };

        if (formIsMain) {
          updatedBranches = branches.map(b => ({ ...b, isMain: false }));
          updatedBranches.push(newBranch);
        } else {
          updatedBranches = [...branches, newBranch];
        }
      }

      const newConfig: AppConfig = {
        ...config,
        branches: updatedBranches,
        activeBranchId: formIsMain ? (editingBranch?.id || updatedBranches[updatedBranches.length - 1].id) : activeBranchId
      };

      await onSaveConfig(newConfig);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar la sucursal.');
    } finally {
      setIsSaving(false);
    }
  };

  // Switch Active Branch
  const handleSetActiveBranch = async (branchId: string) => {
    try {
      if (onSwitchBranch) {
        onSwitchBranch(branchId);
        return;
      }
      const newConfig: AppConfig = {
        ...config,
        branches,
        activeBranchId: branchId
      };
      await onSaveConfig(newConfig);
    } catch (err) {
      console.error('Error switching active branch:', err);
    }
  };

  // Set Main Branch
  const handleSetMainBranch = async (branchId: string) => {
    try {
      const updated = branches.map(b => ({
        ...b,
        isMain: b.id === branchId
      }));
      const newConfig: AppConfig = {
        ...config,
        branches: updated,
        activeBranchId: branchId
      };
      await onSaveConfig(newConfig);
    } catch (err) {
      console.error('Error setting main branch:', err);
    }
  };

  // Toggle active/inactive
  const handleToggleBranchActive = async (branch: Branch) => {
    if (branch.isMain && branch.isActive) {
      alert('No se puede desactivar la sucursal principal.');
      return;
    }
    try {
      const updated = branches.map(b => {
        if (b.id === branch.id) {
          return { ...b, isActive: !b.isActive };
        }
        return b;
      });
      const newConfig: AppConfig = {
        ...config,
        branches: updated
      };
      await onSaveConfig(newConfig);
    } catch (err) {
      console.error('Error toggling branch status:', err);
    }
  };

  // Delete Branch
  const handleDeleteBranch = async (branch: Branch) => {
    if (branch.isMain) {
      alert('No se puede eliminar la sucursal principal. Asigne otra como principal primero.');
      return;
    }
    if (branches.length <= 1) {
      alert('Debe mantener al menos una sucursal registrada en el sistema.');
      return;
    }

    if (!confirm(`¿Está seguro de eliminar la sucursal "${branch.name}" (${branch.code})?`)) {
      return;
    }

    try {
      const updated = branches.filter(b => b.id !== branch.id);
      const newActive = activeBranchId === branch.id ? (updated[0]?.id || '') : activeBranchId;
      const newConfig: AppConfig = {
        ...config,
        branches: updated,
        activeBranchId: newActive
      };
      await onSaveConfig(newConfig);
    } catch (err) {
      console.error('Error deleting branch:', err);
    }
  };

  // Products belonging to the selected transfer source branch
  const sourceBranchProducts = useMemo(() => {
    const srcBranch = branches.find(b => b.id === transferSource);
    if (!srcBranch) return products;
    return products.filter(p => isItemInBranch(p.branch, srcBranch.name, branches) && (p.stock || 0) > 0);
  }, [products, branches, transferSource]);

  useEffect(() => {
    if (sourceBranchProducts.length > 0) {
      if (!sourceBranchProducts.some(p => p.id === transferProductId)) {
        setTransferProductId(sourceBranchProducts[0].id);
      }
    } else {
      setTransferProductId('');
    }
  }, [sourceBranchProducts, transferProductId]);

  // Handle Transfer Dispatch
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferSource === transferTarget) {
      alert('La sucursal de origen y destino no pueden ser la misma.');
      return;
    }
    const product = products.find(p => p.id === transferProductId);
    if (!product) {
      alert('Seleccione un producto para transferir.');
      return;
    }

    try {
      if (onTransferStock) {
        await onTransferStock(transferSource, transferTarget, transferProductId, transferQuantity);
      }
      setTransferSuccess(true);
      setTimeout(() => {
        setTransferSuccess(false);
        setIsTransferModalOpen(false);
        setTransferNotes('');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Error al realizar el traslado entre sucursales.');
    }
  };

  return (
    <div id="branches-view" className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* 1. Header Banner & Actions */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-150 shrink-0 shadow-2xs">
            <Building2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                Sucursales y Puntos de Emisión
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/80 text-blue-800 border border-blue-200/60">
                {branches.length} Sedes
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Administre las distintas ubicaciones físicas, almacenes y cajas de cobro de su negocio.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsTransferModalOpen(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-slate-200 shadow-2xs"
          >
            <ArrowRightLeft className="w-4 h-4 text-slate-600" />
            <span>Transferir Stock</span>
          </button>

          {!isBranchRestricted && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-[#0086F0] hover:bg-[#0076d6] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Sucursal</span>
            </button>
          )}
        </div>
      </div>

      {isBranchRestricted && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Acceso de operador restringido: </span>
            <span>Solo verá y operará en las sucursales marcadas ({branches.map(b => b.name).join(', ')}).</span>
          </div>
        </div>
      )}

      {/* 2. Active Branch Operational Context Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-200 shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Sucursal Activa para Operaciones:</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="font-extrabold text-sm sm:text-base text-white flex items-center gap-1.5">
              {activeBranch?.name || 'Sucursal Central'}
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-800/80 text-blue-200 font-bold">
                {activeBranch?.code || 'SUC-01'}
              </span>
            </p>
          </div>
        </div>

        {/* Quick switcher select */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-blue-200 font-medium hidden md:inline">Cambiar sede activa:</label>
          <select
            value={activeBranchId}
            onChange={(e) => handleSetActiveBranch(e.target.value)}
            className="bg-slate-900/90 text-white text-xs font-bold border border-blue-500/40 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-400 cursor-pointer shadow-inner"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code}) {b.isMain ? '★ Principal' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Sedes</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {branches.length}
          </div>
          <p className="text-[10px] text-slate-400">Puntos de atención registrados</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Activas / Operativas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {branches.filter(b => b.isActive).length}
          </div>
          <p className="text-[10px] text-slate-400">Abiertas para facturación y ventas</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sede Principal</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="text-sm font-extrabold text-slate-800 truncate">
            {branches.find(b => b.isMain)?.name.replace(/\(.*\)/, '') || 'Central'}
          </div>
          <p className="text-[10px] text-slate-400">Almacén y bodega matriz</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stock Catálogo</span>
            <Package className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 font-mono">
            {products.length}
          </div>
          <p className="text-[10px] text-slate-400">Artículos disponibles para sincronizar</p>
        </div>
      </div>

      {/* 4. Filter and View Switcher Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, código, zona o encargado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todas ({branches.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Activas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'inactive' ? 'bg-white text-slate-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Inactivas
            </button>
          </div>

          {/* Cards / Table mode switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'
              }`}
              title="Vista de Tarjetas"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'
              }`}
              title="Vista de Tabla"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Branch List (Cards View) */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBranches.map((branch) => {
            const isCurrentActive = branch.id === activeBranchId;
            return (
              <div 
                key={branch.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                  isCurrentActive 
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' 
                    : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Card Top */}
                <div className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {branch.code}
                        </span>
                        {branch.isMain && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Principal
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          branch.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {branch.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                        {branch.name}
                      </h3>
                    </div>

                    {isCurrentActive && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white shrink-0">
                        En uso
                      </span>
                    )}
                  </div>

                  {/* Details items */}
                  <div className="space-y-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{branch.address}, {branch.city}</span>
                    </div>

                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{branch.phone}</span>
                      </div>
                    )}

                    {branch.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{branch.email}</span>
                      </div>
                    )}

                    {branch.manager && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Encargado: <strong>{branch.manager}</strong></span>
                      </div>
                    )}

                    {branch.openingHours && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[11px]">{branch.openingHours}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-150 flex items-center justify-between gap-2">
                  {!isCurrentActive ? (
                    <button
                      type="button"
                      onClick={() => handleSetActiveBranch(branch.id)}
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-slate-250 hover:border-blue-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      Activar para POS
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Sucursal actual
                    </span>
                  )}

                  {!user?.isOperator && (
                    <div className="flex items-center gap-1">
                      {!branch.isMain && (
                        <button
                          type="button"
                          onClick={() => handleSetMainBranch(branch.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                          title="Marcar como sede principal"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(branch)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                        title="Editar información de sucursal"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {!branch.isMain && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(branch)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                          title="Eliminar sucursal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-150 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">CÓDIGO</th>
                  <th className="py-3 px-4">NOMBRE DE SUCURSAL</th>
                  <th className="py-3 px-4">UBICACIÓN / DIRECCIÓN</th>
                  <th className="py-3 px-4">ENCARGADO</th>
                  <th className="py-3 px-4">TELÉFONO</th>
                  <th className="py-3 px-4 text-center">ESTADO</th>
                  <th className="py-3 px-4 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBranches.map((branch) => {
                  const isCurrentActive = branch.id === activeBranchId;
                  return (
                    <tr key={branch.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {branch.code}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          {branch.name}
                          {branch.isMain && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                          )}
                          {isCurrentActive && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded">
                              Activa POS
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{branch.openingHours}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {branch.address}, {branch.city}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {branch.manager || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {branch.phone || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleBranchActive(branch)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            branch.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {branch.isActive ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        {!isCurrentActive && (
                          <button
                            type="button"
                            onClick={() => handleSetActiveBranch(branch.id)}
                            className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-bold cursor-pointer"
                          >
                            Seleccionar
                          </button>
                        )}
                        {!user?.isOperator && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(branch)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                              title="Editar sucursal"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {!branch.isMain && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBranch(branch)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                title="Eliminar sucursal"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. MODAL: CREAR / EDITAR SUCURSAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {editingBranch ? 'Editar Sucursal' : 'Registrar Nueva Sucursal'}
                  </h3>
                  <p className="text-[10px] text-slate-400">Configure los datos de la sede comercial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveBranch} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-bold text-slate-700">Nombre de la Sucursal *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Sucursal Pradera Zona 10"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Código Sede *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. SUC-02"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Dirección Completa *</label>
                <input
                  type="text"
                  required
                  placeholder="Calle, avenida, número y zona..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Municipio / Ciudad</label>
                  <input
                    type="text"
                    placeholder="Ej. Guatemala, Mixco, Villa Nueva"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Departamento</label>
                  <input
                    type="text"
                    placeholder="Ej. Guatemala, Quetzaltenango"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Teléfono de Contacto</label>
                  <input
                    type="text"
                    placeholder="Ej. 2333-4455"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="sucursal@empresa.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Encargado o Administrador</label>
                  <input
                    type="text"
                    placeholder="Nombre del responsable"
                    value={formManager}
                    onChange={(e) => setFormManager(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Horario de Atención</label>
                  <input
                    type="text"
                    placeholder="Ej. Lun - Sáb: 08:00 - 20:00"
                    value={formOpeningHours}
                    onChange={(e) => setFormOpeningHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsMain}
                    onChange={(e) => setFormIsMain(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="font-bold text-slate-800">
                    Establecer como Sucursal Principal (Matriz)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="font-bold text-slate-800">
                    Sucursal activa y disponible para ventas
                  </span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Notas u Observaciones</label>
                <textarea
                  placeholder="Información adicional sobre la sede, ubicación o permisos..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] focus:bg-white min-h-[60px]"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-150 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isSaving ? 'Guardando...' : editingBranch ? 'Actualizar Sucursal' : 'Crear Sucursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: TRANSFERENCIA ENTRE SUCURSALES */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-400" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Transferencia de Inventario entre Sucursales
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-6 space-y-4 text-xs">
              {transferSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>¡Transferencia registrada y despachada con éxito!</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Sucursal Origen *</label>
                  <select
                    value={transferSource}
                    onChange={(e) => setTransferSource(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id} disabled={b.id === transferTarget}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">Sucursal Destino *</label>
                  <select
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id} disabled={b.id === transferSource}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Producto a Transferir *</label>
                <select
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {sourceBranchProducts.length === 0 ? (
                    <option value="">Sin productos con stock en esta sucursal</option>
                  ) : (
                    sourceBranchProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} - Stock en sucursal: {p.stock} {p.unit || 'Pza'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Cantidad a Enviar *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Motivo / Guía de Traslado</label>
                <input
                  type="text"
                  placeholder="Ej. Reabastecimiento semanal de inventario"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-150 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
                >
                  Registrar Traslado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
