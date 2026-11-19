import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, User, License } from '../types';
import * as api from '../api';
import { getSystemBranches } from '../utils/branchHelper';
import { checkUserLimit, checkFeatureAllowed, getPlanDefinition } from '../utils/planLimits';
import { 
  Settings2, 
  Store, 
  DollarSign, 
  Calendar, 
  Briefcase, 
  Save, 
  User as UserIcon, 
  Lock,
  Globe,
  Database,
  Users,
  List,
  FileText,
  Eye,
  EyeOff,
  ShieldCheck,
  Download,
  Upload,
  Plus,
  Trash2,
  Check,
  MapPin,
  Mail,
  Printer,
  Shield,
  FileSpreadsheet,
  Activity,
  BookOpen,
  Wrench,
  Sliders,
  X,
  Loader2,
  CheckCircle2,
  QrCode,
  Building2,
  ShoppingCart,
  Package,
  History,
  ShoppingBag,
  Sparkles,
  Truck,
  TrendingDown,
  Inbox,
  BarChart3,
  LayoutDashboard,
  Settings as SettingsIcon,
  Pencil,
  Search,
  Filter,
  ShieldAlert,
  KeyRound,
  UserPlus,
  ChevronDown,
  AlertCircle,
  Copy
} from 'lucide-react';

export const PANEL_MODULE_GROUPS = [
  {
    category: 'PRINCIPAL',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'punto-de-venta', label: 'Punto de venta' },
    ]
  },
  {
    category: 'VENTAS Y CAJA',
    items: [
      { id: 'historial-ventas', label: 'Historial de Ventas' },
      { id: 'apertura-cierre', label: 'Apertura y Cierre' },
      { id: 'clientes', label: 'Clientes' },
    ]
  },
  {
    category: 'INVENTARIO Y ALMACÉN',
    items: [
      { id: 'inventario', label: 'Inventario' },
      { id: 'compras', label: 'Gestión Compras' },
      { id: 'vencimientos', label: 'Vencimientos' },
      { id: 'proveedores', label: 'Proveedores' },
    ]
  },
  {
    category: 'ADMINISTRACIÓN Y FINANZAS',
    items: [
      { id: 'gastos', label: 'Gastos' },
      { id: 'reportes', label: 'Reportes Diarios' },
      { id: 'sucursales', label: 'Sucursales' },
      { id: 'configuracion', label: 'Configuración' },
    ]
  }
];

const getDefaultCategoriesForType = (type: string) => {
  if (type === 'pharmacy') return ['Medicamentos', 'Cuidado Personal', 'Dispositivos Médicos', 'Suplementos', 'Fórmulas', 'Perfumería'];
  if (type === 'bookstore') return ['Útiles Escolares', 'Oficina', 'Cuadernos', 'Libros', 'Papelería', 'Arte/Dibujo'];
  if (type === 'hardware') return ['Herramientas', 'Tornillería', 'Pinturas', 'Plomería', 'Electricidad', 'Seguridad', 'Construcción'];
  return ['Abarrotes', 'Bebidas', 'Snacks', 'Limpieza', 'Lácteos', 'Otros'];
};

const getDefaultUnitsForType = (type: string) => {
  if (type === 'pharmacy') return ['Caja', 'Frasco', 'Tableta', 'Ampolla', 'Blister', 'Sobre'];
  if (type === 'bookstore') return ['Pza', 'Docena', 'Millar', 'Caja', 'Pliego', 'Paquete'];
  if (type === 'hardware') return ['Pza', 'Kg', 'Metro', 'Litro', 'Par', 'Caja'];
  return ['Pza', 'Kg', 'Litro', 'Caja', 'Paquete', 'Bolsa'];
};

interface SettingsProps {
  config: AppConfig;
  user: User | null;
  userLicense?: License | null;
  onOpenPlanUpgrade?: () => void;
  onSaveConfig: (config: AppConfig) => Promise<AppConfig>;
}

export default function Settings({ config, user, userLicense, onOpenPlanUpgrade, onSaveConfig }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'listas' | 'comprobantes' | 'vista' | 'certificado' | 'backup'>('empresa');

  // Plan limits and features
  const plan = useMemo(() => getPlanDefinition(userLicense?.planType), [userLicense?.planType]);
  const felLimitInfo = useMemo(() => checkFeatureAllowed('fel', userLicense?.planType), [userLicense?.planType]);

  // Tab 1: Empresa States
  const [nit, setNit] = useState(config.nit || '');
  const [razonSocial, setRazonSocial] = useState(config.razonSocial || '');
  const [logo, setLogo] = useState(config.logo || '');
  const [address, setAddress] = useState(config.address || '');
  const [phone, setPhone] = useState(config.phone || '');
  const [email, setEmail] = useState(config.email || '');

  // Shared Config Fields
  const [storeName, setStoreName] = useState(config.storeName || 'Yaa POS');
  const [currency, setCurrency] = useState(config.currency || 'Q');
  const [alertDays, setAlertDays] = useState(config.alertDaysBeforeExpiration?.toString() || '30');
  const [businessType, setBusinessType] = useState<'hardware' | 'pharmacy' | 'bookstore' | 'general'>(config.businessType || 'general');

  // Tax & Currency configurations
  const [taxName, setTaxName] = useState(config.taxName || 'IVA');
  const [taxRate, setTaxRate] = useState(config.taxRate || '12');
  const [taxCalculation, setTaxCalculation] = useState(config.taxCalculation || 'Incluido');
  const [systemCurrency, setSystemCurrency] = useState(config.systemCurrency || 'GTQ - Quetzal Guatemalteco (Q/)');

  // Tab 4: Comprobantes States
  const [facturaSeries, setFacturaSeries] = useState(config.facturaSeries || 'F001');
  const [facturaCorrelativo, setFacturaCorrelativo] = useState(config.facturaCorrelativo || '000001');
  const [boletaSeries, setBoletaSeries] = useState(config.boletaSeries || 'B001');
  const [boletaCorrelativo, setBoletaCorrelativo] = useState(config.boletaCorrelativo || '000001');
  const [notaVentaSeries, setNotaVentaSeries] = useState(config.notaVentaSeries || 'NV01');
  const [notaVentaCorrelativo, setNotaVentaCorrelativo] = useState(config.notaVentaCorrelativo || '000001');

  // Tab 5: Vista de Comprobante States
  const [ticketHeader, setTicketHeader] = useState(config.ticketHeader || '¡Gracias por su compra!');
  const [ticketFooter, setTicketFooter] = useState(config.ticketFooter || 'Conserve su comprobante. Vuelva pronto.');
  const [showLogoInTicket, setShowLogoInTicket] = useState(config.showLogoInTicket ?? true);
  const [showOperatorInTicket, setShowOperatorInTicket] = useState(config.showOperatorInTicket ?? true);
  const [ticketFontSize, setTicketFontSize] = useState<'sm' | 'md' | 'lg'>(config.ticketFontSize || 'sm');
  const [ticketPaperSize, setTicketPaperSize] = useState<'80mm' | '58mm' | 'media_carta' | 'carta'>(config.ticketPaperSize || '80mm');
  const [facturaPaperSize, setFacturaPaperSize] = useState<'80mm' | '58mm' | 'media_carta' | 'carta'>(config.facturaPaperSize || '80mm');
  const [comprobantePaperSize, setComprobantePaperSize] = useState<'80mm' | '58mm' | 'media_carta' | 'carta'>(config.comprobantePaperSize || '80mm');
  const [previewDocType, setPreviewDocType] = useState<'ticket' | 'factura' | 'comprobante'>('ticket');

  // Tab 6: Certificado Digital States
  const [certificateName, setCertificateName] = useState(config.certificateName || '');
  const [certificatePassword, setCertificatePassword] = useState(config.certificatePassword || '');
  const [certificateExpiration, setCertificateExpiration] = useState(config.certificateExpiration || '');
  const [felEnabled, setFelEnabled] = useState<boolean>(config.felEnabled ?? false);
  const [felCertifierName, setFelCertifierName] = useState<string>(config.felCertifierName || '');
  const [felApiKey, setFelApiKey] = useState<string>(config.felApiKey || '');

  // Tab 2: Operators real database state
  const [operators, setOperators] = useState<api.Operator[]>([]);
  const [selectedOperatorForTabs, setSelectedOperatorForTabs] = useState<api.Operator | null>(null);
  const [editingOperator, setEditingOperator] = useState<api.Operator | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'Cajero' | 'Supervisor de Almacén' | 'Administrador'>('all');
  const [newOpPasswordVisible, setNewOpPasswordVisible] = useState(false);
  const [editOpPasswordVisible, setEditOpPasswordVisible] = useState(false);
  const [editOpNewPassword, setEditOpNewPassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [changingPasswordOp, setChangingPasswordOp] = useState<api.Operator | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [newPasswordValVisible, setNewPasswordValVisible] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalTabSearch, setModalTabSearch] = useState('');
  const [modalTabCategory, setModalTabCategory] = useState<'all' | 'ventas' | 'inventario' | 'finanzas' | 'admin'>('all');
  const [newOpName, setNewOpName] = useState('');
  const [newOpEmail, setNewOpEmail] = useState('');
  const [newOpPassword, setNewOpPassword] = useState('');
  const [newOpRole, setNewOpRole] = useState('Cajero');
  const [newOpBranch, setNewOpBranch] = useState('');
  const [newOpBranches, setNewOpBranches] = useState<string[]>([]);
  const [newOpPanels, setNewOpPanels] = useState<string[]>([
    'dashboard',
    'punto-de-venta',
    'historial-ventas',
    'apertura-cierre',
    'clientes'
  ]);

  const branchOptions = React.useMemo(() => {
    const registeredBranches = getSystemBranches(config);
    return registeredBranches.map(b => ({
      id: b.id,
      name: b.name,
      code: b.code
    }));
  }, [config]);

  const toggleNewOpPanel = (panelId: string) => {
    setNewOpPanels(prev => 
      prev.includes(panelId)
        ? prev.filter(id => id !== panelId)
        : [...prev, panelId]
    );
  };

  const handleNewOpRoleChange = (role: string) => {
    setNewOpRole(role);
    if (role === 'Cajero') {
      setNewOpPanels(['dashboard', 'punto-de-venta', 'historial-ventas', 'apertura-cierre', 'clientes']);
    } else if (role === 'Supervisor de Almacén') {
      setNewOpPanels(['dashboard', 'inventario', 'compras', 'vencimientos', 'proveedores', 'reportes']);
    } else if (role === 'Administrador') {
      const all = PANEL_MODULE_GROUPS.flatMap(g => g.items.map(i => i.id));
      setNewOpPanels(all);
    }
  };

  const availableBranches = branchOptions;

  // Sync state with config prop when it changes
  useEffect(() => {
    if (config) {
      setNit(config.nit || '');
      setRazonSocial(config.razonSocial || '');
      setLogo(config.logo || '');
      setAddress(config.address || '');
      setPhone(config.phone || '');
      setEmail(config.email || '');
      setStoreName(config.storeName || 'Yaa POS');
      setCurrency(config.currency || 'Q');
      setAlertDays(config.alertDaysBeforeExpiration?.toString() || '30');
      setBusinessType(config.businessType || 'general');
      setTaxName(config.taxName || 'IVA');
      setTaxRate(config.taxRate || '12');
      setTaxCalculation(config.taxCalculation || 'Incluido');
      setSystemCurrency(config.systemCurrency || 'GTQ - Quetzal Guatemalteco (Q/)');
      setFacturaSeries(config.facturaSeries || 'F001');
      setFacturaCorrelativo(config.facturaCorrelativo || '000001');
      setBoletaSeries(config.boletaSeries || 'B001');
      setBoletaCorrelativo(config.boletaCorrelativo || '000001');
      setNotaVentaSeries(config.notaVentaSeries || 'NV01');
      setNotaVentaCorrelativo(config.notaVentaCorrelativo || '000001');
      setTicketHeader(config.ticketHeader || '¡Gracias por su compra!');
      setTicketFooter(config.ticketFooter || 'Conserve su comprobante. Vuelva pronto.');
      setShowLogoInTicket(config.showLogoInTicket ?? true);
      setShowOperatorInTicket(config.showOperatorInTicket ?? true);
      setTicketFontSize(config.ticketFontSize || 'sm');
      setTicketPaperSize(config.ticketPaperSize || '80mm');
      setFacturaPaperSize(config.facturaPaperSize || '80mm');
      setComprobantePaperSize(config.comprobantePaperSize || '80mm');
      setCertificateName(config.certificateName || '');
      setCertificatePassword(config.certificatePassword || '');
      setCertificateExpiration(config.certificateExpiration || '');
      setFelEnabled(config.felEnabled ?? false);
      setFelCertifierName(config.felCertifierName || '');
      setFelApiKey(config.felApiKey || '');
      if (config.categories && config.categories.length > 0) {
        setCategories(config.categories);
      } else {
        setCategories(getDefaultCategoriesForType(config.businessType || 'general'));
      }
      if (config.units && config.units.length > 0) {
        setUnits(config.units);
      } else {
        setUnits(getDefaultUnitsForType(config.businessType || 'general'));
      }
    }
  }, [config]);

  useEffect(() => {
    async function loadOperators() {
      try {
        const list = await api.getOperators();
        setOperators(list);
      } catch (err) {
        console.error('Error loading operators from Firestore:', err);
      }
    }
    loadOperators();
  }, []);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Tab 3: Lists custom configurations
  const [categories, setCategories] = useState<string[]>(() => {
    if (config.categories && config.categories.length > 0) return config.categories;
    return getDefaultCategoriesForType(config.businessType || 'general');
  });
  const [newCategory, setNewCategory] = useState('');
  const [units, setUnits] = useState<string[]>(() => {
    if (config.units && config.units.length > 0) return config.units;
    return getDefaultUnitsForType(config.businessType || 'general');
  });
  const [newUnit, setNewUnit] = useState('');

  // Categorías y unidades se guardan en la configuración de la empresa (Guardar).

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Database Reset States & Handler
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleResetDatabase = async () => {
    if (resetConfirmation !== 'REINICIAR') {
      alert('Por favor, escriba la palabra REINICIAR exactamente para continuar.');
      return;
    }
    const confirmDouble = window.confirm('¿Está absolutamente seguro de que desea reiniciar la base de datos? Esta acción eliminará permanentemente todos sus productos, transacciones, operadores y archivos del sistema, y NO se puede deshacer.');
    if (!confirmDouble) return;

    try {
      setIsResetting(true);
      await api.resetUserDatabase();
      setResetConfirmation('');
      alert('✓ Base de datos reiniciada con éxito. Todos los registros y transacciones operativas han sido eliminados de su cuenta.');
    } catch (error: any) {
      alert('Error al reiniciar la base de datos: ' + (error.message || error));
    } finally {
      setIsResetting(false);
    }
  };

  // Logo upload helper
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      const response = await api.uploadFile(file);
      setLogo(response.path);
      alert('Logotipo subido y enlazado correctamente.');
    } catch (err: any) {
      alert('Error al subir logotipo: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !currency || !alertDays) {
      alert('Todos los campos obligatorios deben ser llenados.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    // Fields managed by this form. Everything else already stored in the config
    // document (branches, activeBranchId, etc.) is preserved below, because
    // saveConfig replaces the whole document.
    const formFields: Partial<AppConfig> = {
      storeName: razonSocial || storeName, // sync company name
      logo: logo || undefined,
      address: address || undefined,
      phone: phone || undefined,
      currency,
      alertDaysBeforeExpiration: parseInt(alertDays) || 30,
      businessType,
      taxName,
      taxRate,
      taxCalculation,
      systemCurrency,
      nit,
      razonSocial,
      email,
      facturaSeries,
      facturaCorrelativo,
      boletaSeries,
      boletaCorrelativo,
      notaVentaSeries,
      notaVentaCorrelativo,
      ticketHeader,
      ticketFooter,
      showLogoInTicket,
      showOperatorInTicket,
      ticketFontSize,
      ticketPaperSize,
      facturaPaperSize,
      comprobantePaperSize,
      // FEL credentials are no longer captured in the browser (Etapa 0).
      categories,
      units
    };

    const updatedConfig: AppConfig = { ...config, ...formFields } as AppConfig;
    // Optional fields cleared in the form must be removed, not kept from the old config.
    for (const [key, value] of Object.entries(formFields)) {
      if (value === undefined) delete (updatedConfig as any)[key];
    }

    // Strip undefined values to prevent Firestore serialization errors
    const cleanedConfig = Object.fromEntries(
      Object.entries(updatedConfig).filter(([_, v]) => v !== undefined)
    ) as AppConfig;

    try {
      await onSaveConfig(cleanedConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportBackup = () => {
    const dataToBackup = {
      appConfig: {
        storeName, logo, address, phone, currency, alertDaysBeforeExpiration: parseInt(alertDays), businessType,
        nit, razonSocial, email, facturaSeries, facturaCorrelativo, boletaSeries, boletaCorrelativo,
        notaVentaSeries, notaVentaCorrelativo, ticketHeader, ticketFooter, showLogoInTicket, showOperatorInTicket,
        ticketFontSize, ticketPaperSize, facturaPaperSize, comprobantePaperSize, certificateName, certificateExpiration
      },
      exportedAt: new Date().toISOString(),
      systemVersion: '1.2.0',
      status: 'success'
    };
    const blob = new Blob([JSON.stringify(dataToBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_yaapos_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewOpPassword(pwd);
    setNewOpPasswordVisible(true);
  };

  const handleOpenChangePassword = (op: api.Operator) => {
    setChangingPasswordOp(op);
    setNewPasswordVal('');
    setNewPasswordValVisible(false);
  };

  const handleCopyPassword = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveChangedPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordOp) return;
    if (!newPasswordVal || newPasswordVal.trim().length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres para ser válida en el sistema de autenticación.');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const cleanPass = newPasswordVal.trim();
      const updatedOp: api.Operator = {
        ...changingPasswordOp,
        password: cleanPass,
        passwordProtected: true
      };
      
      const savedOp = await api.saveOperator(updatedOp);
      
      // Update state without keeping plain text password
      setOperators(prev => prev.map(o => o.id === changingPasswordOp.id ? { ...savedOp, password: undefined, passwordProtected: true } : o));
      setChangingPasswordOp(null);
      setNewPasswordVal('');
      alert(`✓ Contraseña actualizada correctamente en el sistema de autenticación para "${changingPasswordOp.name}".\n\nEl operador ya puede iniciar sesión con estas credenciales.`);
    } catch (err: any) {
      alert('Error al actualizar contraseña: ' + (err.message || err));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    if (!email) return;
    const confirmReset = window.confirm(`¿Desea enviar un enlace seguro de restablecimiento de contraseña a "${email}"?`);
    if (!confirmReset) return;
    try {
      await api.sendPasswordReset(email);
      alert(`✓ Se ha enviado el enlace seguro de restablecimiento de contraseña a "${email}".\n\nEl operador podrá abrir el enlace en su correo y definir su nueva contraseña de forma segura y válida.`);
    } catch (err: any) {
      alert('Error al enviar enlace de restablecimiento: ' + (err.message || err));
    }
  };

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName.trim() || !newOpEmail.trim()) {
      alert('Por favor complete el nombre y correo electrónico.');
      return;
    }
    if (!newOpPassword || newOpPassword.trim().length < 6) {
      alert('La contraseña es requerida y debe tener al menos 6 caracteres para autenticarse válidamente en el sistema.');
      return;
    }

    const userLimit = checkUserLimit(operators.length, userLicense?.planType);
    if (!userLimit.allowed) {
      alert(userLimit.message);
      if (onOpenPlanUpgrade) onOpenPlanUpgrade();
      return;
    }

    setIsSubmittingUser(true);
    try {
      const opId = Math.random().toString(36).substring(2, 11);
      const allAppTabIds = PANEL_MODULE_GROUPS.flatMap(g => g.items.map(i => i.id));
      const disabledTabs = allAppTabIds.filter(id => !newOpPanels.includes(id));
      if (!newOpPanels.includes('historial-ventas') && !disabledTabs.includes('libro-ventas')) {
        disabledTabs.push('libro-ventas');
      }

      const assignedBranches = newOpBranches.length > 0 
        ? newOpBranches 
        : (newOpBranch && newOpBranch.trim() && newOpBranch !== 'Todas' ? newOpBranch.split(',').map(s => s.trim()) : []);
      const assignedBranch = assignedBranches.length > 0 ? assignedBranches.join(', ') : 'Todas';

      const newOp: api.Operator = {
        id: opId,
        name: newOpName.trim(),
        email: newOpEmail.trim().toLowerCase(),
        role: newOpRole,
        password: newOpPassword.trim(), // Sent to Firebase Auth for valid credentials, then stripped before Firestore
        branch: assignedBranch,
        branches: assignedBranches,
        disabledTabs: disabledTabs,
        status: 'active' as const,
        passwordProtected: true
      };
      
      const savedOp = await api.saveOperator(newOp);
      setOperators(prev => [...prev.filter(o => o.email.toLowerCase() !== savedOp.email.toLowerCase()), savedOp]);
      setNewOpName('');
      setNewOpEmail('');
      setNewOpPassword('');
      setNewOpRole('Cajero');
      setNewOpBranch('');
      setNewOpBranches([]);
      setNewOpPanels(['dashboard', 'punto-de-venta', 'historial-ventas', 'apertura-cierre', 'clientes']);
      setIsCreateUserModalOpen(false);
      alert('✓ Usuario operador registrado correctamente con contraseña válida en el sistema de autenticación.');
    } catch (err: any) {
      alert('Error al registrar operador: ' + (err.message || err));
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteOperator = async (id: string) => {
    const op = operators.find(o => o.id === id);
    if (!op) return;
    if (op.role === 'Propietario / Administrador') {
      return;
    }
    const confirmDelete = window.confirm(`¿Está seguro de eliminar al operador "${op.name}" (${op.email})?`);
    if (!confirmDelete) return;
    try {
      await api.deleteOperator(op.id, op.email);
      setOperators(operators.filter(o => o.id !== id));
      alert('✓ Operador eliminado correctamente.');
    } catch (err: any) {
      alert('Error al eliminar operador: ' + (err.message || err));
    }
  };

  const handleUpdateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOperator) return;
    if (editOpNewPassword && editOpNewPassword.trim().length > 0 && editOpNewPassword.trim().length < 6) {
      alert('La nueva contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }
    setIsSubmittingUser(true);
    try {
      const branchesArr = (editingOperator.branches && editingOperator.branches.length > 0)
        ? editingOperator.branches
        : (editingOperator.branch && editingOperator.branch !== 'Todas'
            ? editingOperator.branch.split(',').map(s => s.trim()).filter(Boolean)
            : []);

      const opToSave: api.Operator = {
        ...editingOperator,
        password: editOpNewPassword.trim() ? editOpNewPassword.trim() : undefined,
        branch: branchesArr.length > 0 ? branchesArr.join(', ') : 'Todas',
        branches: branchesArr,
        disabledTabs: editingOperator.disabledTabs || [],
        status: editingOperator.status || 'active',
        passwordProtected: true
      };

      const savedOp = await api.saveOperator(opToSave);
      setOperators(operators.map(o => o.id === editingOperator.id ? savedOp : o));
      setEditingOperator(null);
      setEditOpNewPassword('');
      alert('✓ Datos del operador actualizados correctamente.');
    } catch (err: any) {
      alert('Error al actualizar operador: ' + (err.message || err));
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleSaveOperatorTabs = async (operatorId: string, disabledTabs: string[]) => {
    try {
      const opToUpdate = operators.find(op => op.id === operatorId);
      if (!opToUpdate) return;
      
      const updatedOp = {
        ...opToUpdate,
        disabledTabs: disabledTabs
      };
      
      await api.saveOperator(updatedOp);
      
      // Update local state
      setOperators(operators.map(op => op.id === operatorId ? updatedOp : op));
      setSelectedOperatorForTabs(null);
      alert('✓ Permisos de pestañas actualizados correctamente para ' + opToUpdate.name);
    } catch (err: any) {
      alert('Error al guardar permisos: ' + (err.message || err));
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim())) return;
    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnit.trim()) return;
    if (units.includes(newUnit.trim())) return;
    setUnits([...units, newUnit.trim()]);
    setNewUnit('');
  };

  // Tab definitions
  const tabs = [
    { id: 'empresa', label: 'Empresa', icon: <Store className="w-4 h-4" /> },
    { id: 'usuarios', label: 'Usuarios', icon: <Users className="w-4 h-4" /> },
    { id: 'listas', label: 'Listas', icon: <List className="w-4 h-4" /> },
    { id: 'comprobantes', label: 'Comprobantes', icon: <FileText className="w-4 h-4" /> },
    { id: 'vista', label: 'Vista de Comprobante', icon: <Eye className="w-4 h-4" /> },
    { id: 'certificado', label: 'FEL (en desarrollo)', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'backup', label: 'Backup', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      
      {/* Page Title & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl shadow-xs">
            <Settings2 className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Configuración del Sistema</h1>
            <p className="text-xs text-slate-500 font-medium">Establezca los parámetros operativos, tributarios y de facturación.</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
            Personaliza tu sistema
          </span>
        </div>
      </div>

      <div id="settings-view" className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden animate-in fade-in duration-200">
        
        {/* Navigation Tabs bar */}
        <div className="flex overflow-x-auto no-scrollbar md:flex-wrap border-b border-slate-200 bg-slate-50/50 p-2 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all duration-150 rounded-xl cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content wrapper wrapped in the form selector */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 text-left">
          
          {/* TAB 1: EMPRESA */}
          {activeTab === 'empresa' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Blue card section header */}
              <div className="flex items-center gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-4 py-3 text-blue-800">
                <Store className="w-4 h-4 shrink-0 text-blue-600" />
                <span className="text-xs font-black uppercase tracking-wider">Datos de la empresa</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Logotipo Panel (Left side) */}
                <div className="lg:col-span-4 flex flex-col items-center space-y-4 bg-slate-50/60 border border-slate-100 rounded-2xl p-5 text-center">
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Logotipo</span>
                  
                  <div className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center min-h-[130px] relative shadow-xs">
                    {logo ? (
                      <img 
                        src={logo} 
                        alt="Logotipo de la Empresa" 
                        className="max-h-24 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      /* Precise Yaa POS SVG mockup from the image */
                      <div className="text-slate-700 flex flex-col items-center justify-center">
                        <svg viewBox="0 0 200 80" className="w-36 h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M25 25h14l8 24h32l6-18H41" stroke="#0086F0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="51" cy="58" r="4.5" fill="#0086F0"/>
                          <circle cx="73" cy="58" r="4.5" fill="#0086F0"/>
                          <path d="M54 18l-5 11h8l-5 11 9-13h-8l1-9z" fill="#EAB308" stroke="#EAB308" strokeWidth="0.5" strokeLinejoin="round"/>
                          <text x="86" y="42" fill="#0F172A" fontSize="21" fontWeight="900" fontFamily="Inter, sans-serif">Yaa POS</text>
                        </svg>
                      </div>
                    )}
                  </div>

                  <label className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cambiar logo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleLogoUpload} 
                    />
                  </label>
                  
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">PNG o JPG. Se muestra en comprobantes y reportes.</p>
                </div>

                {/* Form fields panel (Right side) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* IDENTIFICACIÓN TRIBUTARIA */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">Identificación Tributaria</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">NIT</label>
                        <input 
                          type="text" 
                          required
                          value={nit} 
                          onChange={(e) => setNit(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-mono"
                          placeholder="NIT de la Empresa"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">Razón Social</label>
                        <input 
                          type="text" 
                          required
                          value={razonSocial} 
                          onChange={(e) => setRazonSocial(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-sans"
                          placeholder="Nombre tributario legal"
                        />
                      </div>
                    </div>
                  </div>

                  {/* UBICACIÓN Y CONTACTO */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">Ubicación y Contacto</span>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">Dirección</label>
                        <input 
                          type="text" 
                          required
                          value={address} 
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs"
                          placeholder="Dirección fiscal"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Teléfono</label>
                          <input 
                            type="text" 
                            required
                            value={phone} 
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-mono"
                            placeholder="Número telefónico"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Email</label>
                          <input 
                            type="email" 
                            required
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs"
                            placeholder="ventas@empresa.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USUARIOS */}
          {activeTab === 'usuarios' && (() => {
            const filteredOperators = operators.filter(op => {
              const isOwner = op.role === 'Propietario / Administrador' || op.id === '1';
              const displayName = (isOwner ? (user?.name || op.name) : op.name).toLowerCase();
              const displayEmail = (isOwner ? (user?.email || op.email) : op.email).toLowerCase();
              const query = userSearchQuery.toLowerCase();
              const matchesSearch = displayName.includes(query) || displayEmail.includes(query);
              const matchesRole = userRoleFilter === 'all' || op.role === userRoleFilter;
              return matchesSearch && matchesRole;
            });

            const userLimitInfo = checkUserLimit(operators.length, userLicense?.planType);

            return (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Header Banner - Matches Empresa tab style & Yaa POS brand */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-50/70 border border-blue-100 rounded-2xl px-5 py-4 text-blue-900 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-950">Gestión de Usuarios y Cajeros</h3>
                      <p className="text-[11px] text-blue-700/80 font-medium mt-0.5">Controle los accesos, contraseñas y permisos del personal en el punto de venta</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!userLimitInfo.allowed) {
                          if (onOpenPlanUpgrade) {
                            onOpenPlanUpgrade();
                          } else {
                            alert(userLimitInfo.message);
                          }
                          return;
                        }
                        setNewOpName('');
                        setNewOpEmail('');
                        setNewOpPassword('');
                        setNewOpPasswordVisible(false);
                        setNewOpRole('Cajero');
                        setNewOpBranch('');
                        setNewOpBranches([]);
                        setNewOpPanels(['dashboard', 'punto-de-venta', 'historial-ventas', 'apertura-cierre', 'clientes']);
                        setIsCreateUserModalOpen(true);
                      }}
                      className={`active:scale-95 font-black text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer shrink-0 ${
                        !userLimitInfo.allowed
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {!userLimitInfo.allowed ? (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Límite Alcanzado (Ver Plan)</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Nuevo Usuario</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Plan limit warning banner when max users reached */}
                {!userLimitInfo.allowed && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="text-xs">
                        <span className="font-extrabold block sm:inline">Límite alcanzado: </span>
                        <span>{userLimitInfo.message}</span>
                      </div>
                    </div>
                    {onOpenPlanUpgrade && (
                      <button
                        type="button"
                        onClick={onOpenPlanUpgrade}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Actualizar Plan</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Active operator card (col-span-4) */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Sesión Actual</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Plan {plan.name}
                        </span>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-xs">
                        <div className="w-11 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                          {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Administrador'}</h4>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{user?.email}</p>
                          <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-black uppercase tracking-wider mt-1.5 inline-block border border-blue-100">
                            Propietario / Admin
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-2">
                        <p className="font-bold text-slate-700 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          Privilegios de Administrador:
                        </p>
                        <ul className="space-y-1.5 text-slate-600">
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Configuración tributaria y de comprobantes</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Crear y eliminar cuentas de cajeros</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Habilitar o restringir módulos del sistema</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Exportar e importar copias de seguridad</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* Summary stat card */}
                    <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Usuarios Registrados</span>
                        <p className="text-base font-black text-slate-800">
                          {operators.length} <span className="text-xs font-semibold text-slate-500">de {plan.maxUsers === 999 ? 'Ilimitados' : plan.maxUsers}</span>
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Operator list and creation (col-span-8) */}
                  <div className="lg:col-span-8 space-y-4">

                    {/* List Table with horizontal scroll for mobile and iPhone */}
                    <div className="border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
                      {/* Mobile horizontal swipe indicator */}
                      <div className="md:hidden px-3.5 py-2 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border-b border-blue-100 flex items-center justify-between text-[11px] text-blue-700 font-semibold select-none">
                        <span className="flex items-center gap-1.5">
                          <span>👉</span> Desliza horizontalmente para ver todas las opciones
                        </span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">
                          Deslizar ↔
                        </span>
                      </div>

                      <div 
                        className="w-full overflow-x-auto overscroll-x-contain touch-pan-x"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">Usuario / Nombre</th>
                              <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">Rol</th>
                              <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">Contraseña</th>
                              <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">Sucursales</th>
                              <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] whitespace-nowrap">Estado</th>
                              <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredOperators.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                  <UserIcon className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                                  <p className="text-xs font-bold text-slate-600">No se encontraron usuarios</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">Haga clic en "+ Nuevo Usuario" para dar de alta a un operador.</p>
                                </td>
                              </tr>
                            ) : (
                              filteredOperators.map((op) => {
                                const isOwner = op.role === 'Propietario / Administrador' || op.id === '1';
                                const displayName = isOwner ? (user?.name || op.name) : op.name;
                                const displayEmail = isOwner ? (user?.email || op.email) : op.email;

                                const roleColor = 
                                  op.role === 'Cajero' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  op.role === 'Supervisor de Almacén' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  op.role === 'Administrador' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  'bg-purple-50 text-purple-700 border-purple-200';

                                return (
                                  <tr key={op.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                          isOwner ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                          {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                        <div className="min-w-0">
                                          <span className="font-bold text-slate-800 block truncate">{displayName}</span>
                                          <span className="font-mono text-[10px] text-slate-400 block truncate">{displayEmail}</span>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleColor}`}>
                                        {op.role}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                          <span className="font-mono text-slate-400 tracking-widest text-xs">••••••••</span>
                                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                            Protegida en Auth
                                          </span>
                                        </div>

                                        {/* Botón para cambiar / asignar contraseña real */}
                                        <button
                                          type="button"
                                          onClick={() => handleOpenChangePassword(op)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs"
                                          title="Cambiar o asignar la contraseña real en Firebase Auth"
                                        >
                                          <KeyRound className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-600 shrink-0" />
                                          <span>Cambiar clave</span>
                                        </button>

                                        {!isOwner && (
                                          <button
                                            type="button"
                                            onClick={() => handleSendPasswordReset(displayEmail)}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer shadow-2xs"
                                            title="Enviar enlace seguro de restablecimiento de contraseña al correo del operador"
                                          >
                                            <Mail className="w-3.5 h-3.5 text-slate-500 hover:text-blue-600 shrink-0" />
                                            <span>Restablecer</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>

                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                      <span className="text-slate-600 font-medium text-xs">
                                        {op.branch || 'Todas'}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                                        op.status === 'inactive'
                                          ? 'bg-rose-50 text-rose-600 border-rose-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${op.status === 'inactive' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                        {op.status === 'inactive' ? 'INACTIVO' : 'ACTIVO'}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                      {op.role !== 'Propietario / Administrador' ? (
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const parsedBranches = (op.branches && op.branches.length > 0)
                                                ? op.branches
                                                : (op.branch && op.branch !== 'Todas'
                                                    ? op.branch.split(',').map(s => s.trim()).filter(Boolean)
                                                    : []);
                                              setEditingOperator({
                                                ...op,
                                                branches: parsedBranches,
                                                disabledTabs: op.disabledTabs || [],
                                                status: op.status || 'active'
                                              });
                                              setEditOpNewPassword('');
                                              setEditOpPasswordVisible(false);
                                            }}
                                            className="inline-flex items-center justify-center p-2 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all cursor-pointer"
                                            title="Editar Datos del Operador"
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteOperator(op.id)}
                                            className="inline-flex items-center justify-center p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                            title="Eliminar Operador"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] font-semibold text-slate-400 select-none">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 3: LISTAS */}
          {activeTab === 'listas' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 text-slate-800">
                <List className="w-4 h-4 shrink-0 text-slate-600" />
                <span className="text-xs font-black uppercase tracking-wider">Configuración de Listas Maestras y Unidades</span>
              </div>

              {/* Selector de Rubro de Negocio */}
              <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Giro de Punto de Venta del Propietario</h3>
                  <p className="text-xs text-slate-500">Seleccione el giro para pre-configurar las categorías y unidades de medida recomendadas para su rubro comercial.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {[
                    {
                      id: 'pharmacy',
                      name: 'Farmacias',
                      desc: 'Medicamentos y boticas',
                      icon: <Activity className="w-5 h-5 text-emerald-600" />,
                      color: 'border-emerald-100 bg-emerald-50/40 text-emerald-700 hover:bg-emerald-50',
                      activeColor: 'ring-2 ring-emerald-500 bg-emerald-50/60 text-emerald-800 border-emerald-300',
                      cats: ['Medicamentos', 'Cuidado Personal', 'Dispositivos Médicos', 'Suplementos', 'Fórmulas', 'Perfumería'],
                      unts: ['Caja', 'Frasco', 'Tableta', 'Ampolla', 'Blister', 'Sobre']
                    },
                    {
                      id: 'bookstore',
                      name: 'Librería',
                      desc: 'Útiles, libros y oficina',
                      icon: <BookOpen className="w-5 h-5 text-amber-600" />,
                      color: 'border-amber-100 bg-amber-50/40 text-amber-700 hover:bg-amber-50',
                      activeColor: 'ring-2 ring-amber-500 bg-amber-50/60 text-amber-800 border-amber-300',
                      cats: ['Útiles Escolares', 'Oficina', 'Cuadernos', 'Libros', 'Papelería', 'Arte/Dibujo'],
                      unts: ['Pza', 'Docena', 'Millar', 'Caja', 'Pliego', 'Paquete']
                    },
                    {
                      id: 'hardware',
                      name: 'Ferretería',
                      desc: 'Herramientas y materiales',
                      icon: <Wrench className="w-5 h-5 text-blue-600" />,
                      color: 'border-blue-100 bg-blue-50/40 text-blue-700 hover:bg-blue-50',
                      activeColor: 'ring-2 ring-blue-500 bg-blue-50/60 text-blue-800 border-blue-300',
                      cats: ['Herramientas', 'Tornillería', 'Pinturas', 'Plomería', 'Electricidad', 'Seguridad', 'Construcción'],
                      unts: ['Pza', 'Kg', 'Metro', 'Litro', 'Par', 'Caja']
                    },
                    {
                      id: 'general',
                      name: 'General / Otros',
                      desc: 'Abarrotes y tienda general',
                      icon: <Store className="w-5 h-5 text-slate-600" />,
                      color: 'border-slate-150 bg-slate-50/40 text-slate-700 hover:bg-slate-100/50',
                      activeColor: 'ring-2 ring-slate-600 bg-slate-100 text-slate-800 border-slate-300',
                      cats: ['Abarrotes', 'Bebidas', 'Snacks', 'Limpieza', 'Lácteos', 'Otros'],
                      unts: ['Pza', 'Kg', 'Litro', 'Caja', 'Paquete', 'Bolsa']
                    }
                  ].map((rubro) => {
                    const isSelected = businessType === rubro.id;
                    return (
                      <button
                        key={rubro.id}
                        type="button"
                        onClick={() => {
                          setBusinessType(rubro.id as any);
                          setCategories(rubro.cats);
                          setUnits(rubro.unts);
                        }}
                        className={`p-4 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between h-28 cursor-pointer relative group ${
                          isSelected ? rubro.activeColor : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg w-fit ${isSelected ? 'bg-white shadow-xs' : 'bg-slate-100'}`}>
                          {rubro.icon}
                        </div>
                        <div>
                          <div className="font-black text-xs text-slate-800">{rubro.name}</div>
                          <div className="text-[10px] text-slate-500 line-clamp-1 leading-normal font-medium">{rubro.desc}</div>
                        </div>
                        {isSelected && (
                          <span className="absolute top-3 right-3 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Categorías (Left side) */}
                <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide block border-b border-slate-100 pb-2">
                    Categorías de Producto
                  </span>

                  <div className="flex flex-wrap gap-2 py-2">
                    {categories.map((cat, idx) => (
                      <span 
                        key={idx} 
                        className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs"
                      >
                        {cat}
                        <button 
                          type="button" 
                          onClick={() => setCategories(categories.filter(c => c !== cat))}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input 
                      type="text" 
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory(e);
                        }
                      }}
                      placeholder="Nueva categoría..."
                      className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 rounded-xl shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Unidades de medida (Right side) */}
                <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide block border-b border-slate-100 pb-2">
                    Unidades de Medida
                  </span>

                  <div className="flex flex-wrap gap-2 py-2">
                    {units.map((unit, idx) => (
                      <span 
                        key={idx} 
                        className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-800 px-3 py-1.5 rounded-xl font-bold text-xs font-mono"
                      >
                        {unit}
                        <button 
                          type="button" 
                          onClick={() => setUnits(units.filter(u => u !== unit))}
                          className="text-blue-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input 
                      type="text" 
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddUnit(e);
                        }
                      }}
                      placeholder="Ej: Metro, Caja..."
                      className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAddUnit}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-xl shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: COMPROBANTES */}
          {activeTab === 'comprobantes' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 text-slate-800">
                <FileText className="w-4 h-4 shrink-0 text-slate-600" />
                <span className="text-xs font-black uppercase tracking-wider">Correlativos de Documentos y Comprobantes</span>
              </div>

              <div className="bg-white border border-slate-150 rounded-2xl p-6 space-y-6 shadow-xs">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Secuencias Numéricas de Facturación</h3>
                  <p className="text-xs text-slate-500">Configure la serie y el número correlativo de inicio para cada tipo de documento.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  
                  {/* Facturas */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wide">🧾 Facturas Electrónicas</span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Serie</label>
                        <input 
                          type="text" 
                          value={facturaSeries} 
                          onChange={(e) => setFacturaSeries(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Siguiente Correlativo</label>
                        <input 
                          type="text" 
                          value={facturaCorrelativo} 
                          onChange={(e) => setFacturaCorrelativo(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Boletas */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wide">🧾 Boletas de Venta</span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Serie</label>
                        <input 
                          type="text" 
                          value={boletaSeries} 
                          onChange={(e) => setBoletaSeries(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Siguiente Correlativo</label>
                        <input 
                          type="text" 
                          value={boletaCorrelativo} 
                          onChange={(e) => setBoletaCorrelativo(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notas de venta */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 space-y-3">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wide">📝 Notas de Venta / Tickets</span>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Serie</label>
                        <input 
                          type="text" 
                          value={notaVentaSeries} 
                          onChange={(e) => setNotaVentaSeries(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Siguiente Correlativo</label>
                        <input 
                          type="text" 
                          value={notaVentaCorrelativo} 
                          onChange={(e) => setNotaVentaCorrelativo(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* CONFIGURACIÓN DE IMPUESTOS */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Configuración de Impuestos</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Siglas (Ej: IVA)</label>
                      <input 
                        type="text" 
                        value={taxName} 
                        onChange={(e) => setTaxName(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-sans text-slate-800 font-medium"
                        placeholder="IVA"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Tasa (%)</label>
                      <input 
                        type="text" 
                        value={taxRate} 
                        onChange={(e) => setTaxRate(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-mono text-slate-800 font-medium"
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Cálculo</label>
                      <select 
                        value={taxCalculation} 
                        onChange={(e) => setTaxCalculation(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-sans text-slate-800 font-medium cursor-pointer"
                      >
                        <option value="Incluido">Incluido</option>
                        <option value="Sumar">Sumar</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* CONFIGURACIÓN DE MONEDA */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Configuración de Moneda</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                    <div className="sm:col-span-8 space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Moneda del Sistema</label>
                      <select 
                        value={systemCurrency} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setSystemCurrency(val);
                          if (val.includes('GTQ')) {
                            setCurrency('Q');
                          } else if (val.includes('USD')) {
                            setCurrency('$');
                          } else if (val.includes('PEN')) {
                            setCurrency('S/');
                          } else if (val.includes('MXN')) {
                            setCurrency('$');
                          } else if (val.includes('COP')) {
                            setCurrency('$');
                          }
                        }}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-sans text-slate-800 font-medium cursor-pointer"
                      >
                        <option value="GTQ - Quetzal Guatemalteco (Q/)">GTQ - Quetzal Guatemalteco (Q/)</option>
                        <option value="USD - Dólar Estadounidense ($)">USD - Dólar Estadounidense ($)</option>
                        <option value="PEN - Sol Peruano (S/)">PEN - Sol Peruano (S/)</option>
                        <option value="MXN - Peso Mexicano ($)">MXN - Peso Mexicano ($)</option>
                        <option value="COP - Peso Colombiano ($)">COP - Peso Colombiano ($)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-xs font-bold text-slate-600 block">Símbolo</label>
                      <input 
                        type="text" 
                        value={currency} 
                        readOnly
                        disabled
                        className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50 text-slate-500 font-mono font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VISTA DE COMPROBANTE */}
          {activeTab === 'vista' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 text-slate-800">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 shrink-0 text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wider">Diseño y Personalización de Ticket de Impresión</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline-block">
                  Formatos Térmicos y Hojas Estándar
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Customizers (Left column) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* SECCIÓN 1: SELECCIÓN DE MEDIDAS DE PAPEL */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        Medidas de Impresión por Documento
                      </span>
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        Seleccione el formato
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Configure el ancho del rollo térmico o formato de papel que utiliza su impresora para cada tipo de comprobante emitido:
                    </p>

                    {/* 1. Medida de Ticket */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          Medida de Ticket de Venta
                        </label>
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                          Actual: {ticketPaperSize === '80mm' ? '80 mm' : ticketPaperSize === '58mm' ? '58 mm' : ticketPaperSize === 'media_carta' ? 'Media Carta' : 'Carta/A4'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: '80mm', label: '80 mm', desc: 'Rollo Térmico 3 ⅛"' },
                          { id: '58mm', label: '58 mm', desc: 'Mini Rollo 2 ¼"' },
                          { id: 'media_carta', label: 'Media Carta', desc: '140 × 216 mm' },
                          { id: 'carta', label: 'Carta / A4', desc: 'Hoja Estándar' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setTicketPaperSize(opt.id as any)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              ticketPaperSize === opt.id
                                ? 'bg-blue-50/80 border-blue-600 text-blue-900 shadow-xs ring-1 ring-blue-500'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-xs font-bold block">{opt.label}</span>
                            <span className="text-[9px] text-slate-400 block leading-tight">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Medida de Factura */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          Medida de Factura (FEL / Fiscal)
                        </label>
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                          Actual: {facturaPaperSize === '80mm' ? '80 mm' : facturaPaperSize === '58mm' ? '58 mm' : facturaPaperSize === 'media_carta' ? 'Media Carta' : 'Carta/A4'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: '80mm', label: '80 mm', desc: 'Ticket Fiscal Térmico' },
                          { id: '58mm', label: '58 mm', desc: 'Mini Ticket Fiscal' },
                          { id: 'media_carta', label: 'Media Carta', desc: 'Formato Mitad Página' },
                          { id: 'carta', label: 'Carta / A4', desc: 'Estándar Oficial SAT' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFacturaPaperSize(opt.id as any)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              facturaPaperSize === opt.id
                                ? 'bg-blue-50/80 border-blue-600 text-blue-900 shadow-xs ring-1 ring-blue-500'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-xs font-bold block">{opt.label}</span>
                            <span className="text-[9px] text-slate-400 block leading-tight">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Medida de Comprobante / Boleta / Recibo */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                          Medida de Comprobante / Boleta / Recibo
                        </label>
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                          Actual: {comprobantePaperSize === '80mm' ? '80 mm' : comprobantePaperSize === '58mm' ? '58 mm' : comprobantePaperSize === 'media_carta' ? 'Media Carta' : 'Carta/A4'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: '80mm', label: '80 mm', desc: 'Rollo Térmico 3 ⅛"' },
                          { id: '58mm', label: '58 mm', desc: 'Mini Rollo 2 ¼"' },
                          { id: 'media_carta', label: 'Media Carta', desc: '140 × 216 mm' },
                          { id: 'carta', label: 'Carta / A4', desc: 'Hoja Estándar' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setComprobantePaperSize(opt.id as any)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              comprobantePaperSize === opt.id
                                ? 'bg-blue-50/80 border-blue-600 text-blue-900 shadow-xs ring-1 ring-blue-500'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-xs font-bold block">{opt.label}</span>
                            <span className="text-[9px] text-slate-400 block leading-tight">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 2: AJUSTES DE CONTENIDO Y TIPOGRAFÍA */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide block border-b border-slate-100 pb-2">
                      Personalización de Textos y Encabezados
                    </span>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">Cabecera de Ticket (Saludo o Lema)</label>
                        <input 
                          type="text" 
                          value={ticketHeader} 
                          onChange={(e) => setTicketHeader(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: ¡Gracias por su preferencia!"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600">Pie de Ticket (Leyenda / Políticas de Devolución)</label>
                        <input 
                          type="text" 
                          value={ticketFooter} 
                          onChange={(e) => setTicketFooter(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: No se aceptan devoluciones sin comprobante."
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-600 block">Tamaño de letra en ticket</label>
                          <div className="flex gap-2">
                            {(['sm', 'md', 'lg'] as const).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => setTicketFontSize(sz)}
                                className={`flex-1 text-xs py-1.5 rounded-lg border font-bold uppercase transition-all ${
                                  ticketFontSize === sz 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {sz === 'sm' ? 'Pequeño' : sz === 'md' ? 'Mediano' : 'Grande'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 font-medium text-xs text-slate-600 pt-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={showLogoInTicket} 
                              onChange={(e) => setShowLogoInTicket(e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Incluir logotipo en cabecera</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={showOperatorInTicket} 
                              onChange={(e) => setShowOperatorInTicket(e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>Mostrar nombre del cajero</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time Simulator (Right column) */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Previsualización en Vivo
                    </span>
                    
                    {/* Selector de vista previa */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPreviewDocType('ticket')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          previewDocType === 'ticket' 
                            ? 'bg-white text-blue-700 shadow-xs font-extrabold' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDocType('factura')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          previewDocType === 'factura' 
                            ? 'bg-white text-blue-700 shadow-xs font-extrabold' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Factura
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDocType('comprobante')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          previewDocType === 'comprobante' 
                            ? 'bg-white text-blue-700 shadow-xs font-extrabold' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Comprobante
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Paper Simulator container */}
                  {(() => {
                    const currentPaper = previewDocType === 'ticket' 
                      ? ticketPaperSize 
                      : previewDocType === 'factura' 
                        ? facturaPaperSize 
                        : comprobantePaperSize;
                    
                    const is58mm = currentPaper === '58mm';
                    const isMediaCarta = currentPaper === 'media_carta';
                    const isCarta = currentPaper === 'carta';

                    const widthClass = is58mm 
                      ? 'w-56' 
                      : (isMediaCarta || isCarta) 
                        ? 'w-80' 
                        : 'w-72';

                    return (
                      <div className={`${widthClass} bg-amber-50/40 border-2 border-dashed border-slate-300 p-4 sm:p-5 font-mono text-slate-800 shadow-md rounded-2xl relative space-y-4 transition-all duration-200`}>
                        {/* Paper size badge indicator */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2.5 px-2.5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center text-[9px] font-extrabold uppercase font-sans tracking-wider shadow-xs">
                          {is58mm ? '58 mm (Mini)' : currentPaper === '80mm' ? '80 mm (Estándar POS)' : isMediaCarta ? 'Media Carta' : 'Carta / A4'}
                        </div>

                        <div className="text-center space-y-1 pt-1.5">
                          {showLogoInTicket && (
                            <div className="flex justify-center pb-1.5">
                              {logo ? (
                                <img src={logo} alt="Logo" className="h-10 max-w-full object-contain mix-blend-multiply" />
                              ) : (
                                <svg viewBox="0 0 100 30" className="w-20 h-auto text-slate-700" fill="none">
                                  <path d="M10 10h6l4 12h12l3-8H16" stroke="currentColor" strokeWidth="2"/>
                                  <circle cx="20" cy="25" r="1.5" fill="currentColor"/>
                                  <circle cx="28" cy="25" r="1.5" fill="currentColor"/>
                                  <text x="36" y="18" fill="currentColor" fontSize="10" fontWeight="bold">Yaa POS</text>
                                </svg>
                              )}
                            </div>
                          )}
                          <h4 className="font-extrabold text-xs uppercase leading-tight">{razonSocial || storeName || 'Razón Social de la Empresa'}</h4>
                          <p className="text-[10px]">NIT: {nit || 'CF (Consumidor Final)'}</p>
                          <p className="text-[9px] leading-tight text-slate-600">{address || 'Dirección de la empresa'}</p>
                          <p className="text-[9px]">TEL: {phone || 'Teléfono'}</p>
                        </div>

                        <div className="border-t border-b border-dashed border-slate-300 py-2.5 text-[9px] space-y-1 text-slate-600">
                          <p>FECHA: {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          {showOperatorInTicket && <p>CAJERO: {user?.name || 'Administrador Yaa POS'}</p>}
                          <p className="font-bold text-slate-800 uppercase">
                            DOCUMENTO: {previewDocType === 'factura' ? `COMPROBANTE ${facturaSeries}-000042` : previewDocType === 'comprobante' ? `BOLETA ${boletaSeries}-000018` : `TICKET NV-${notaVentaSeries}-000095`}
                          </p>
                          {previewDocType === 'factura' && (
                            <p className="text-[8px] text-amber-700 font-bold truncate">DOCUMENTO SIN VALIDEZ FISCAL</p>
                          )}
                        </div>

                        {/* Simulated Items list */}
                        <div className={`space-y-1 text-slate-800 ${ticketFontSize === 'sm' || is58mm ? 'text-[9px]' : ticketFontSize === 'md' ? 'text-[11px]' : 'text-[12.5px]'}`}>
                          <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                            <span>DESCRIPCIÓN</span>
                            <span>TOTAL</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="truncate pr-1">{is58mm ? '1x Alicate Truper' : '1x Alicate de Presión Truper'}</span>
                            <span className="shrink-0">{currency} 85.00</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="truncate pr-1">{is58mm ? '2x Cinta 3M Neg' : '2x Cinta Aislante 3M Negra'}</span>
                            <span className="shrink-0">{currency} 24.00</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="truncate pr-1">{is58mm ? '5x Clavo Acero 2"' : '5x Clavo de Acero 2 Pulgadas'}</span>
                            <span className="shrink-0">{currency} 10.00</span>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-slate-300 pt-2 text-[10px] space-y-1">
                          <div className="flex justify-between text-slate-600">
                            <span>SUBTOTAL:</span>
                            <span>{currency} 100.85</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>{taxName} ({taxRate}%):</span>
                            <span>{currency} 12.15</span>
                          </div>
                          <div className="flex justify-between font-bold text-xs border-t border-slate-200 pt-1 text-slate-900">
                            <span>TOTAL A PAGAR:</span>
                            <span>{currency} 113.00</span>
                          </div>
                        </div>

                        <div className="text-center pt-2.5 border-t border-dashed border-slate-300 text-[9px] text-slate-600 leading-relaxed italic">
                          <p className="font-bold text-slate-700">{ticketHeader}</p>
                          <p>{ticketFooter}</p>
                        </div>

                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: CERTIFICADO DIGITAL Y FEL */}
          {activeTab === 'certificado' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-t border-slate-200/90 pt-5 pb-2">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border bg-amber-50 text-amber-600 border-amber-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                    Factura Electrónica (FEL)
                  </h2>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3 text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg">En desarrollo</span>
                </div>
                <p className="text-sm font-bold">
                  Yaa POS todavía no está conectado a un certificador FEL autorizado por la SAT.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Los comprobantes que genera el sistema son documentos internos <strong>sin validez fiscal</strong>. Mientras la integración no esté disponible,
                  emita sus facturas electrónicas desde su certificador o desde la herramienta de la SAT.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Por seguridad, las credenciales del certificador y la contraseña de firma ya no se capturan en esta pantalla. Cuando la integración esté lista,
                  se configurarán en un servidor protegido y nunca quedarán visibles en el navegador.
                </p>
              </div>
            </div>
          )}

          {/* TAB 7: BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 text-slate-800">
                <Database className="w-4 h-4 shrink-0 text-slate-600" />
                <span className="text-xs font-black uppercase tracking-wider">Respaldos del Sistema, Descargas e Importaciones</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Export/Import (col-span-8) */}
                <div className="lg:col-span-8 bg-white border border-slate-150 rounded-2xl p-6 space-y-6 shadow-xs">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Copia de Seguridad de Configuración y Parámetros</h3>
                    <p className="text-xs text-slate-500">Exporte un archivo de respaldo con el diseño del ticket, nombres tributarios, secuencias de facturas y llaves del sistema.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    
                    {/* Export Card */}
                    <div className="border border-slate-150 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors bg-slate-55/10">
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Download className="w-4 h-4 text-blue-600" /> Descargar Copia
                        </span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">Genera y descarga un archivo cifrado en formato JSON que puede guardar como copia física local.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer w-full mt-auto"
                      >
                        <Download className="w-3.5 h-3.5" /> Exportar JSON
                      </button>
                    </div>

                    {/* Import Card */}
                    <div className="border border-slate-150 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors">
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Upload className="w-4 h-4 text-slate-700" /> Restaurar Copia
                        </span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">Suba un archivo JSON de respaldo para cargar y sobreescribir los parámetros tributarios guardados previamente.</p>
                      </div>
                      <label className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer w-full text-center mt-auto">
                        <Upload className="w-3.5 h-3.5" /> Importar JSON
                        <input 
                          type="file" 
                          accept=".json" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const parsed = JSON.parse(event.target?.result as string);
                                if (parsed.appConfig) {
                                  if (parsed.appConfig.nit) setNit(parsed.appConfig.nit);
                                  if (parsed.appConfig.razonSocial) setRazonSocial(parsed.appConfig.razonSocial);
                                  if (parsed.appConfig.address) setAddress(parsed.appConfig.address);
                                  if (parsed.appConfig.phone) setPhone(parsed.appConfig.phone);
                                  if (parsed.appConfig.email) setEmail(parsed.appConfig.email);
                                  if (parsed.appConfig.logo) setLogo(parsed.appConfig.logo);
                                  if (parsed.appConfig.facturaSeries) setFacturaSeries(parsed.appConfig.facturaSeries);
                                  if (parsed.appConfig.boletaSeries) setBoletaSeries(parsed.appConfig.boletaSeries);
                                  alert('Parámetros de configuración importados con éxito del archivo JSON.');
                                } else {
                                  alert('Formato de copia de seguridad no válido.');
                                }
                              } catch {
                                alert('Error al procesar el archivo JSON de respaldo.');
                              }
                            };
                            reader.readAsText(file);
                          }}
                        />
                      </label>
                    </div>

                  </div>

                  {/* Danger Zone / Reset Database (account owner only) */}
                  {!user?.isOperator && (
                  <div className="border border-rose-100 bg-rose-50/10 rounded-xl p-5 space-y-4 mt-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Zona de Peligro: Reiniciar Base de Datos</h4>
                        <p className="text-xs text-rose-700 font-medium leading-relaxed mt-0.5">
                          Esta acción eliminará de forma permanente todos los productos, clientes, proveedores, ventas, compras, gastos, turnos y archivos del sistema asociados a su cuenta. El logotipo, configuración de la tienda y la sesión activa se mantendrán.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-4 pt-4 border-t border-rose-100">
                      <div className="text-[11px] text-slate-500 leading-normal">
                        Para proceder, escriba <strong className="font-mono text-rose-600 select-all">REINICIAR</strong> abajo y haga clic en el botón. Esta acción no se puede deshacer.
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                        <input 
                          type="text" 
                          placeholder="REINICIAR" 
                          value={resetConfirmation}
                          onChange={(e) => setResetConfirmation(e.target.value)}
                          className="border border-rose-200 rounded-xl px-3 text-xs font-mono uppercase text-center w-full sm:w-48 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white h-10 transition-all shrink-0"
                        />
                        <button
                          type="button"
                          disabled={resetConfirmation !== 'REINICIAR' || isResetting}
                          onClick={handleResetDatabase}
                          className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs px-5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer h-10 w-full sm:w-auto"
                        >
                          {isResetting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Reiniciando...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Reiniciar base de datos</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  )}

                </div>

                {/* System security cards (col-span-4) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                    <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Seguridad del Sistema</span>
                    
                    <div className="space-y-4 text-[11px] text-slate-500 leading-relaxed bg-white border border-slate-150 rounded-xl p-4">
                      <div className="flex gap-2 items-start">
                        <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-800 text-[11px]">Particionamiento por Usuario</p>
                          <p className="mt-0.5">Todos los inventarios, listas de clientes, transacciones e imágenes están cifrados y encriptados en carpetas de almacenamiento independientes vinculadas a su cuenta de correo.</p>
                        </div>
                      </div>

                      <div className="flex gap-2 items-start border-t border-slate-100 pt-3">
                        <Database className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-800 text-[11px]">Servicio de Base de Datos</p>
                          <p className="mt-0.5">Los datos se guardan de forma segura en un almacenamiento en disco de contenedor redundante para evitar fallos físicos.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Global persistent footer - Always visible for any active tab */}
          <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Cambios sincronizados directamente con la base de datos en tiempo real</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {saveSuccess && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3.5 py-2 rounded-xl animate-in fade-in duration-200">
                  ✓ ¡Cambios guardados correctamente!
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm min-w-[150px]"
              >
                <Check className="w-4 h-4" /> {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* MODAL GESTIÓN DE PESTAÑAS Y VENTANAS DEL SISTEMA */}
      {selectedOperatorForTabs && (() => {
        const SYSTEM_WINDOWS = [
          {
            id: 'dashboard',
            label: 'Dashboard',
            category: 'finanzas',
            categoryLabel: 'Finanzas y Reportes',
            desc: 'Métricas generales, gráficos de ventas y analítica comercial.',
            icon: LayoutDashboard,
            color: 'text-blue-600 bg-blue-50 border-blue-100',
            badge: 'Analítica'
          },
          {
            id: 'punto-de-venta',
            label: 'Punto de Venta',
            category: 'ventas',
            categoryLabel: 'Ventas y Caja',
            desc: 'Cobros rápidos, lectura de código de barras y emisión de tickets.',
            icon: ShoppingCart,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
            badge: 'Operación Principal'
          },
          {
            id: 'inventario',
            label: 'Inventario',
            category: 'inventario',
            categoryLabel: 'Inventario y Almacén',
            desc: 'Catálogo de productos, control de stock, precios y ajustes.',
            icon: Package,
            color: 'text-amber-600 bg-amber-50 border-amber-100',
            badge: 'Stock'
          },
          {
            id: 'historial-ventas',
            label: 'Historial de Ventas',
            category: 'ventas',
            categoryLabel: 'Ventas y Caja',
            desc: 'Registro de comprobantes, facturas FEL emitidas y reimpresión.',
            icon: History,
            color: 'text-teal-600 bg-teal-50 border-teal-100',
            badge: 'Comprobantes'
          },
          {
            id: 'compras',
            label: 'Gestión Compras',
            category: 'inventario',
            categoryLabel: 'Inventario y Almacén',
            desc: 'Recepción de mercadería, órdenes de compra y facturas proveedor.',
            icon: ShoppingBag,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
            badge: 'Abastecimiento'
          },
          {
            id: 'vencimientos',
            label: 'Vencimientos',
            category: 'inventario',
            categoryLabel: 'Inventario y Almacén',
            desc: 'Control de caducidades, alertas por lote y fármacos críticos.',
            icon: Calendar,
            color: 'text-rose-600 bg-rose-50 border-rose-100',
            badge: 'Fechas Lote'
          },
          {
            id: 'clientes',
            label: 'Clientes',
            category: 'ventas',
            categoryLabel: 'Ventas y Caja',
            desc: 'Directorio de clientes, cuentas corrientes de crédito y puntos.',
            icon: Users,
            color: 'text-purple-600 bg-purple-50 border-purple-100',
            badge: 'Créditos'
          },
          {
            id: 'proveedores',
            label: 'Proveedores',
            category: 'inventario',
            categoryLabel: 'Inventario y Almacén',
            desc: 'Directorio de proveedores comerciales y contactos de compra.',
            icon: Truck,
            color: 'text-sky-600 bg-sky-50 border-sky-100',
            badge: 'Contactos'
          },
          {
            id: 'gastos',
            label: 'Gastos',
            category: 'finanzas',
            categoryLabel: 'Finanzas y Reportes',
            desc: 'Egresos menores, pagos operativos y salidas de caja chica.',
            icon: TrendingDown,
            color: 'text-rose-600 bg-rose-50 border-rose-100',
            badge: 'Egresos'
          },
          {
            id: 'apertura-cierre',
            label: 'Apertura y Cierre',
            category: 'ventas',
            categoryLabel: 'Ventas y Caja',
            desc: 'Arqueo de caja, fondos iniciales, diferencias y corte térmico 80mm.',
            icon: Inbox,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
            badge: 'Corte 80mm'
          },
          {
            id: 'reportes',
            label: 'Reportes Diarios',
            category: 'finanzas',
            categoryLabel: 'Finanzas y Reportes',
            desc: 'Cortes contables del día, balance financiero y auditoría.',
            icon: BarChart3,
            color: 'text-blue-600 bg-blue-50 border-blue-100',
            badge: 'Cierre Z'
          },
          {
            id: 'sucursales',
            label: 'Sucursales',
            category: 'admin',
            categoryLabel: 'Administración',
            desc: 'Gestión de sedes, puntos de emisión y transferencias de inventario.',
            icon: Building2,
            color: 'text-violet-600 bg-violet-50 border-violet-100',
            badge: 'Nueva Pestaña',
            isNew: true
          },
          {
            id: 'configuracion',
            label: 'Configuración',
            category: 'admin',
            categoryLabel: 'Administración',
            desc: 'Datos fiscales, tickets, listas maestros y gestión de usuarios.',
            icon: SettingsIcon,
            color: 'text-slate-600 bg-slate-100 border-slate-200',
            badge: 'Parámetros'
          }
        ];

        const currentlyDisabled = selectedOperatorForTabs.disabledTabs || [];
        const isTabEnabled = (tabId: string) => {
          if (currentlyDisabled.includes(tabId)) return false;
          if (tabId === 'historial-ventas' && currentlyDisabled.includes('libro-ventas')) return false;
          return true;
        };

        const enabledCount = SYSTEM_WINDOWS.filter(w => isTabEnabled(w.id)).length;
        const totalCount = SYSTEM_WINDOWS.length;

        const filteredWindows = SYSTEM_WINDOWS.filter(w => {
          if (modalTabCategory !== 'all' && w.category !== modalTabCategory) return false;
          if (modalTabSearch.trim()) {
            const q = modalTabSearch.toLowerCase();
            return w.label.toLowerCase().includes(q) || 
                   w.desc.toLowerCase().includes(q) || 
                   w.categoryLabel.toLowerCase().includes(q);
          }
          return true;
        });

        const toggleWindow = (tabId: string) => {
          const idsToToggle = tabId === 'historial-ventas' ? ['historial-ventas', 'libro-ventas'] : [tabId];
          const currentlyActive = isTabEnabled(tabId);
          let nextDisabled = [...currentlyDisabled];

          if (currentlyActive) {
            // Disable: add to disabled
            idsToToggle.forEach(id => {
              if (!nextDisabled.includes(id)) {
                nextDisabled.push(id);
              }
            });
          } else {
            // Enable: remove from disabled
            nextDisabled = nextDisabled.filter(id => !idsToToggle.includes(id));
          }

          setSelectedOperatorForTabs({
            ...selectedOperatorForTabs,
            disabledTabs: nextDisabled
          });
        };

        const applyPreset = (preset: 'cajero' | 'almacen' | 'supervisor' | 'all' | 'none') => {
          let allowedIds: string[] = [];
          if (preset === 'cajero') {
            allowedIds = ['punto-de-venta', 'apertura-cierre', 'clientes', 'historial-ventas'];
          } else if (preset === 'almacen') {
            allowedIds = ['inventario', 'compras', 'vencimientos', 'proveedores'];
          } else if (preset === 'supervisor') {
            allowedIds = ['dashboard', 'punto-de-venta', 'inventario', 'historial-ventas', 'compras', 'vencimientos', 'clientes', 'proveedores', 'gastos', 'apertura-cierre', 'reportes', 'sucursales'];
          } else if (preset === 'all') {
            allowedIds = SYSTEM_WINDOWS.map(w => w.id);
          } else if (preset === 'none') {
            allowedIds = [];
          }

          const nextDisabled = SYSTEM_WINDOWS
            .filter(w => !allowedIds.includes(w.id))
            .flatMap(w => w.id === 'historial-ventas' ? ['historial-ventas', 'libro-ventas'] : [w.id]);

          setSelectedOperatorForTabs({
            ...selectedOperatorForTabs,
            disabledTabs: nextDisabled
          });
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92dvh] my-auto text-slate-800">
              
              {/* Header */}
              <div className="bg-[#0B1536] text-white px-6 py-5 flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black tracking-tight">Acceso a Ventanas y Permisos</h3>
                      <span className="text-[10px] font-bold bg-blue-500/30 border border-blue-400/40 text-blue-200 px-2.5 py-0.5 rounded-full">
                        {selectedOperatorForTabs.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      Configuración para <span className="text-white font-bold">{selectedOperatorForTabs.name}</span> ({selectedOperatorForTabs.email})
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedOperatorForTabs(null)}
                  className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Cerrar ventana"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Actions & Status Summary Toolbar */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 space-y-3 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Plantillas Rápidas:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPreset('cajero')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer"
                      >
                        🎯 Cajero
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('almacen')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer"
                      >
                        📦 Almacén
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('supervisor')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer"
                      >
                        ⚡ Supervisor
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('all')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs transition-all cursor-pointer"
                      >
                        ✓ Activar Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('none')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition-all cursor-pointer"
                      >
                        ✕ Bloquear Todo
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
                      enabledCount === totalCount
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : enabledCount > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      {enabledCount} de {totalCount} ventanas activas
                    </span>
                  </div>
                </div>

                {/* Search & Category Filter Pills */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={modalTabSearch}
                      onChange={(e) => setModalTabSearch(e.target.value)}
                      placeholder="Buscar ventana o módulo del sistema..."
                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    {modalTabSearch && (
                      <button 
                        type="button" 
                        onClick={() => setModalTabSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {[
                      { id: 'all', label: 'Todas' },
                      { id: 'ventas', label: 'Ventas y Caja' },
                      { id: 'inventario', label: 'Almacén' },
                      { id: 'finanzas', label: 'Finanzas' },
                      { id: 'admin', label: 'Administración' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setModalTabCategory(cat.id as any)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                          modalTabCategory === cat.id
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/80'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scrollable Windows List */}
              <div className="p-6 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/30">
                {filteredWindows.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 space-y-2">
                    <Search className="w-8 h-8 mx-auto stroke-1" />
                    <p className="text-xs font-semibold">No se encontraron ventanas con el criterio buscado.</p>
                  </div>
                ) : (
                  filteredWindows.map((tab) => {
                    const isChecked = isTabEnabled(tab.id);
                    const IconComponent = tab.icon;

                    return (
                      <div
                        key={tab.id}
                        onClick={() => toggleWindow(tab.id)}
                        className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3.5 ${
                          isChecked 
                            ? 'bg-white border-blue-200 shadow-xs hover:border-blue-300 ring-1 ring-blue-500/10' 
                            : 'bg-white/80 border-slate-200/80 hover:border-slate-300 opacity-65 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${tab.color} shadow-2xs`}>
                            <IconComponent className="w-5 h-5 stroke-[2]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-black text-slate-800 tracking-tight">{tab.label}</h4>
                              {tab.isNew && (
                                <span className="bg-violet-100 text-violet-700 border border-violet-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                  Nueva Pestaña
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                {tab.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 leading-snug mt-0.5 font-medium">
                              {tab.desc}
                            </p>
                          </div>
                        </div>

                        {/* Interactive iOS style Toggle Switch */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className={`text-[10px] font-black uppercase tracking-wider hidden sm:inline ${
                            isChecked ? 'text-blue-600' : 'text-slate-400'
                          }`}>
                            {isChecked ? 'Habilitada' : 'Oculta'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWindow(tab.id);
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              isChecked ? 'bg-blue-600 shadow-xs' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isChecked ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                <div className="text-[11px] text-slate-500 font-medium">
                  {enabledCount === 0 ? (
                    <span className="text-rose-600 font-bold">⚠️ El usuario no tendrá acceso a ninguna pestaña del menú.</span>
                  ) : (
                    <span>Las pestañas marcadas se mostrarán en la barra lateral del operador.</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedOperatorForTabs(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveOperatorTabs(selectedOperatorForTabs.id, selectedOperatorForTabs.disabledTabs || [])}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Guardar Permisos
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL: REGISTRAR NUEVO USUARIO / OPERADOR */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 text-slate-800 flex flex-col max-h-[92dvh] my-auto">
            
            {/* Modal Header: Clean light header with 'Nuevo usuario' and '✕' */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Nuevo usuario</h2>
              <button 
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddOperator} className="p-6 space-y-5 overflow-y-auto overscroll-contain flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  placeholder="Ej: Brenda Gómez"
                  className="w-full text-base sm:text-sm border border-slate-200/90 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium placeholder:text-slate-400 transition-all"
                />
              </div>

              {/* Correo */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Correo
                </label>
                <input
                  type="email"
                  required
                  value={newOpEmail}
                  onChange={(e) => setNewOpEmail(e.target.value)}
                  placeholder="brenda@yaapos.com"
                  className="w-full text-base sm:text-sm border border-slate-200/90 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-mono font-medium placeholder:text-slate-400 transition-all"
                />
              </div>

              {/* Contraseña */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 block">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                  >
                    Generar clave
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={newOpPasswordVisible ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newOpPassword}
                    onChange={(e) => setNewOpPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full text-base sm:text-sm border border-slate-200/90 rounded-2xl pl-4 pr-11 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-mono placeholder:text-slate-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setNewOpPasswordVisible(!newOpPasswordVisible)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {newOpPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Contraseña válida para iniciar sesión en el sistema. Protegida con autenticación segura.</p>
              </div>

              {/* Rol */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Rol
                </label>
                <div className="relative">
                  <select
                    value={newOpRole}
                    onChange={(e) => handleNewOpRoleChange(e.target.value)}
                    className="w-full appearance-none text-base sm:text-sm border border-slate-200/90 rounded-2xl px-4 py-3 pr-10 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-800 cursor-pointer transition-all"
                  >
                    <option value="Cajero">Cajero</option>
                    <option value="Supervisor de Almacén">Supervisor de Almacén</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Sucursales */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Sucursales
                </label>
                <div className="border border-slate-200/90 rounded-2xl p-4 space-y-2.5 bg-white">
                  {branchOptions.length === 0 ? (
                    <div className="text-center py-3 text-slate-400">
                      <p className="text-xs font-medium">No hay sucursales creadas aún.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">El usuario podrá operar de forma general hasta que el Propietario/Admin registre sucursales en la pestaña "Sucursales".</p>
                    </div>
                  ) : (
                    branchOptions.map((b) => {
                      const isSelected = newOpBranches.includes(b.name) || newOpBranch === b.name;
                      return (
                        <button
                          key={b.id || b.name}
                          type="button"
                          onClick={() => {
                            setNewOpBranches(prev => {
                              let next: string[];
                              if (prev.includes(b.name)) {
                                next = prev.filter(name => name !== b.name);
                              } else {
                                next = [...prev, b.name];
                              }
                              setNewOpBranch(next.join(', '));
                              return next;
                            });
                          }}
                          className={`flex items-center gap-3 w-full text-left p-2 rounded-xl transition-all cursor-pointer group ${
                            isSelected 
                              ? 'bg-emerald-50/70 border border-emerald-200/70' 
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected 
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs' 
                              : 'border-slate-300 group-hover:border-slate-400 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className={`text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {b.name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {(newOpBranches.length > 0 || (newOpBranch && newOpBranch.trim() && newOpBranch !== 'Todas')) ? (
                  <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1.5 transition-all animate-in fade-in duration-150">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Solo verá y operará en las sucursales marcadas.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 font-normal mt-1">
                    Sin marcar = acceso a todas las sucursales.
                  </p>
                )}
              </div>

              {/* Accesos del panel */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Accesos del panel
                </label>
                <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white space-y-5">
                  {PANEL_MODULE_GROUPS.map((group) => (
                    <div key={group.category} className="space-y-2.5">
                      <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block">
                        {group.category}
                      </span>
                      <div className="space-y-2">
                        {group.items.map((item) => {
                          const isChecked = newOpPanels.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleNewOpPanel(item.id)}
                              className="flex items-center gap-3 w-full text-left py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                isChecked
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'border-2 border-slate-300 group-hover:border-slate-400'
                              }`}>
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <span className={`text-sm ${isChecked ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer (Sticky on Mobile) */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-white sticky bottom-0 -mx-6 -mb-6 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  {isSubmittingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Registrando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> Crear usuario
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: EDITAR DATOS DEL OPERADOR */}
      {editingOperator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 text-slate-800 flex flex-col max-h-[92dvh] my-auto">
            
            {/* Modal Header: Clean light header with 'Editar usuario' and '✕' */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Editar usuario</h2>
              <button 
                type="button"
                onClick={() => {
                  setEditingOperator(null);
                  setEditOpNewPassword('');
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form with iPhone and mobile smooth touch scroll */}
            <form onSubmit={handleUpdateOperator} className="p-6 space-y-5 overflow-y-auto overscroll-contain flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={editingOperator.name}
                  onChange={(e) => setEditingOperator({ ...editingOperator, name: e.target.value })}
                  placeholder="Nombre del usuario"
                  className="w-full text-base sm:text-sm border border-slate-200/90 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-800 placeholder:text-slate-400 transition-all"
                />
              </div>

              {/* Rol */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Rol
                </label>
                <div className="relative">
                  <select
                    value={editingOperator.role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      const allTabIds = PANEL_MODULE_GROUPS.flatMap(g => g.items.map(i => i.id));
                      let nextDisabledTabs = editingOperator.disabledTabs || [];
                      if (nextRole === 'Cajero') {
                        const allowed = ['dashboard', 'punto-de-venta', 'historial-ventas', 'apertura-cierre', 'clientes'];
                        nextDisabledTabs = allTabIds.filter(id => !allowed.includes(id));
                      } else if (nextRole === 'Supervisor de Almacén') {
                        const allowed = ['dashboard', 'inventario', 'compras', 'vencimientos', 'proveedores', 'reportes'];
                        nextDisabledTabs = allTabIds.filter(id => !allowed.includes(id));
                      } else if (nextRole === 'Administrador') {
                        nextDisabledTabs = [];
                      }
                      setEditingOperator({
                        ...editingOperator,
                        role: nextRole,
                        disabledTabs: nextDisabledTabs
                      });
                    }}
                    className="w-full appearance-none text-base sm:text-sm border border-slate-200/90 rounded-2xl px-4 py-3 pr-10 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-medium text-slate-800 cursor-pointer transition-all"
                  >
                    <option value="Cajero">Cajero</option>
                    <option value="Supervisor de Almacén">Supervisor de Almacén</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Sucursales */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Sucursales
                </label>
                <div className="border border-slate-200/90 rounded-2xl p-4 space-y-2.5 bg-white">
                  {branchOptions.length === 0 ? (
                    <div className="text-center py-3 text-slate-400">
                      <p className="text-xs font-medium">No hay sucursales creadas aún.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">El usuario podrá operar de forma general hasta que el Propietario/Admin registre sucursales en la pestaña "Sucursales".</p>
                    </div>
                  ) : (
                    branchOptions.map((b) => {
                      const currentBranches = (editingOperator.branches && editingOperator.branches.length > 0)
                        ? editingOperator.branches
                        : (editingOperator.branch && editingOperator.branch !== 'Todas'
                            ? editingOperator.branch.split(',').map(s => s.trim()).filter(Boolean)
                            : []);
                      const isSelected = currentBranches.some(name => name.toLowerCase() === b.name.toLowerCase());

                      return (
                        <button
                          key={b.id || b.name}
                          type="button"
                          onClick={() => {
                            let next: string[];
                            if (isSelected) {
                              next = currentBranches.filter(name => name.toLowerCase() !== b.name.toLowerCase());
                            } else {
                              next = [...currentBranches, b.name];
                            }
                            setEditingOperator({
                              ...editingOperator,
                              branches: next,
                              branch: next.length > 0 ? next.join(', ') : 'Todas'
                            });
                          }}
                          className="flex items-center gap-3 w-full text-left py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                            isSelected 
                              ? 'bg-emerald-600 text-white shadow-2xs' 
                              : 'border-2 border-slate-300 group-hover:border-slate-400 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className={`text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {b.name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-slate-500 font-normal mt-1">
                  Solo verá y operará en las sucursales marcadas.
                </p>
              </div>

              {/* Accesos del panel */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">
                  Accesos del panel
                </label>
                <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-white space-y-5 max-h-64 overflow-y-auto">
                  {PANEL_MODULE_GROUPS.map((group) => (
                    <div key={group.category} className="space-y-2.5">
                      <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block">
                        {group.category}
                      </span>
                      <div className="space-y-2">
                        {group.items.map((item) => {
                          const currentDisabled = editingOperator.disabledTabs || [];
                          const isChecked = !currentDisabled.includes(item.id) && !(item.id === 'historial-ventas' && currentDisabled.includes('libro-ventas'));
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                let nextDisabled = [...currentDisabled];
                                if (isChecked) {
                                  nextDisabled.push(item.id);
                                  if (item.id === 'historial-ventas' && !nextDisabled.includes('libro-ventas')) {
                                    nextDisabled.push('libro-ventas');
                                  }
                                } else {
                                  nextDisabled = nextDisabled.filter(id => id !== item.id && !(item.id === 'historial-ventas' && id === 'libro-ventas'));
                                }
                                setEditingOperator({
                                  ...editingOperator,
                                  disabledTabs: nextDisabled
                                });
                              }}
                              className="flex items-center gap-3 w-full text-left py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                isChecked
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'border-2 border-slate-300 group-hover:border-slate-400 bg-white'
                              }`}>
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                              <span className={`text-sm ${isChecked ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 font-normal mt-1">
                  El usuario solo verá en su menú las secciones marcadas.
                </p>
              </div>

              {/* Activo Toggle Card */}
              <div className="border border-slate-200/90 rounded-2xl p-4 bg-white flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-slate-800 block">
                    Activo
                  </span>
                  <span className="text-xs text-slate-500 block">
                    Si lo desactivas, no podrá iniciar sesión.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingOperator({
                      ...editingOperator,
                      status: editingOperator.status === 'inactive' ? 'active' : 'inactive'
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    editingOperator.status !== 'inactive' ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      editingOperator.status !== 'inactive' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Seguridad y Contraseña */}
              <div className="space-y-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-blue-600" />
                      Seguridad y Acceso
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">Protegido por el sistema de autenticación.</p>
                  </div>
                  {editingOperator.role !== 'Propietario / Administrador' && (
                    <button
                      type="button"
                      onClick={() => handleSendPasswordReset(editingOperator.email)}
                      className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
                      title="Enviar enlace seguro al correo registrado del operador"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      <span>Enviar enlace de restablecimiento</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-600 block">
                    Asignar nueva contraseña directamente (opcional)
                  </label>
                  <div className="relative">
                    <input
                      type={editOpPasswordVisible ? 'text' : 'password'}
                      value={editOpNewPassword}
                      onChange={(e) => setEditOpNewPassword(e.target.value)}
                      placeholder="Dejar en blanco para mantener la actual (mín. 6 caracteres)"
                      className="w-full text-base sm:text-sm border border-slate-200/90 rounded-2xl pl-4 pr-11 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-mono placeholder:text-slate-400 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setEditOpPasswordVisible(!editOpPasswordVisible)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {editOpPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex items-center justify-end shrink-0 bg-white">
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  {isSubmittingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Guardar cambios
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR / ASIGNAR CONTRASEÑA REAL */}
      {changingPasswordOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 text-slate-800 flex flex-col my-auto">
            
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    {changingPasswordOp.password ? 'Cambiar contraseña' : 'Asignar contraseña'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {changingPasswordOp.name} ({changingPasswordOp.email})
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setChangingPasswordOp(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChangedPassword} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    Nueva contraseña real
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
                      let pwd = '';
                      for (let i = 0; i < 8; i++) {
                        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      setNewPasswordVal(pwd);
                      setNewPasswordValVisible(true);
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                  >
                    Generar clave
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={newPasswordValVisible ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full text-base sm:text-sm border border-slate-200/90 rounded-2xl pl-4 pr-11 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs font-mono placeholder:text-slate-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPasswordValVisible(!newPasswordValVisible)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={newPasswordValVisible ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {newPasswordValVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Esta contraseña se registrará y validará en Firebase Auth para que el usuario pueda iniciar sesión con éxito.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setChangingPasswordOp(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando en Auth...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Guardar contraseña
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
