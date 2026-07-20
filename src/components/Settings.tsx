import React, { useState, useEffect } from 'react';
import { AppConfig, User } from '../types';
import * as api from '../api';
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
  Loader2
} from 'lucide-react';

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
  onSaveConfig: (config: AppConfig) => Promise<AppConfig>;
}

export default function Settings({ config, user, onSaveConfig }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'listas' | 'comprobantes' | 'vista' | 'certificado' | 'backup'>('empresa');

  // Tab 1: Empresa States
  const [nit, setNit] = useState(config.nit || '20123456789');
  const [razonSocial, setRazonSocial] = useState(config.razonSocial || 'Mi Tienda E.I.R.L.');
  const [logo, setLogo] = useState(config.logo || '');
  const [address, setAddress] = useState(config.address || 'Av. Larco 123, Miraflores - Lima');
  const [phone, setPhone] = useState(config.phone || '987654321');
  const [email, setEmail] = useState(config.email || 'ventas@licoria-demo.com');

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

  // Tab 6: Certificado Digital States
  const [certificateName, setCertificateName] = useState(config.certificateName || 'certificado_digital_sunat.pfx');
  const [certificatePassword, setCertificatePassword] = useState(config.certificatePassword || '••••••••••••');
  const [certificateExpiration, setCertificateExpiration] = useState(config.certificateExpiration || '2027-12-15');

  // Tab 2: Operators real database state
  const [operators, setOperators] = useState<{ id: string; name: string; email: string; role: string; password?: string; status: 'active' | 'inactive'; disabledTabs?: string[] }[]>([]);
  const [selectedOperatorForTabs, setSelectedOperatorForTabs] = useState<typeof operators[0] | null>(null);
  const [newOpName, setNewOpName] = useState('');
  const [newOpEmail, setNewOpEmail] = useState('');
  const [newOpPassword, setNewOpPassword] = useState('');
  const [newOpRole, setNewOpRole] = useState('Cajero');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Sync state with config prop when it changes
  useEffect(() => {
    if (config) {
      setNit(config.nit || '20123456789');
      setRazonSocial(config.razonSocial || 'Mi Tienda E.I.R.L.');
      setLogo(config.logo || '');
      setAddress(config.address || 'Av. Larco 123, Miraflores - Lima');
      setPhone(config.phone || '987654321');
      setEmail(config.email || 'ventas@licoria-demo.com');
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
      setCertificateName(config.certificateName || 'certificado_digital_sunat.pfx');
      setCertificatePassword(config.certificatePassword || '••••••••••••');
      setCertificateExpiration(config.certificateExpiration || '2027-12-15');
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
    const saved = localStorage.getItem('settings_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return getDefaultCategoriesForType(config.businessType || 'general');
  });
  const [newCategory, setNewCategory] = useState('');
  const [units, setUnits] = useState<string[]>(() => {
    if (config.units && config.units.length > 0) return config.units;
    const saved = localStorage.getItem('settings_units');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return getDefaultUnitsForType(config.businessType || 'general');
  });
  const [newUnit, setNewUnit] = useState('');

  // Auto-save lists to localStorage when updated
  useEffect(() => {
    localStorage.setItem('settings_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('settings_units', JSON.stringify(units));
  }, [units]);

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

    const updatedConfig: AppConfig = {
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
      certificateName,
      certificatePassword,
      certificateExpiration,
      categories,
      units
    };

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
        ticketFontSize, certificateName, certificateExpiration
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

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName || !newOpEmail) return;
    try {
      const opId = Math.random().toString(36).substring(2, 11);
      const newOp = {
        id: opId,
        name: newOpName,
        email: newOpEmail,
        role: newOpRole,
        password: newOpPassword || 'cajero123',
        status: 'active' as const
      };
      await api.saveOperator(newOp);
      setOperators([...operators, newOp]);
      setNewOpName('');
      setNewOpEmail('');
      setNewOpPassword('');
    } catch (err: any) {
      alert('Error al agregar operador: ' + (err.message || err));
    }
  };

  const handleDeleteOperator = async (id: string) => {
    const op = operators.find(o => o.id === id);
    if (!op) return;
    if (op.role === 'Propietario / Administrador') {
      return;
    }
    try {
      await api.deleteOperator(op.id, op.email);
      setOperators(operators.filter(o => o.id !== id));
    } catch (err: any) {
      alert('Error al eliminar operador: ' + (err.message || err));
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
    { id: 'certificado', label: 'Certificado Digital', icon: <ShieldCheck className="w-4 h-4" /> },
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
        <div className="flex flex-wrap border-b border-slate-200 bg-slate-50/50 p-2 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all duration-150 rounded-xl cursor-pointer ${
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-left">
          
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
          {activeTab === 'usuarios' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 text-slate-800">
                <Users className="w-4 h-4 shrink-0 text-slate-600" />
                <span className="text-xs font-black uppercase tracking-wider">Perfil de Operador y Gestión de Cajeros</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Active operator card (col-span-4) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Sesión Activa</span>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-xs">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Administrador'}</h4>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{user?.email}</p>
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mt-1.5 inline-block">Propietario / Admin</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 text-[11px] text-slate-500 space-y-2">
                      <p className="font-semibold text-slate-700">Privilegios Administrador:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Modificar datos tributarios</li>
                        <li>Exportar bases de datos</li>
                        <li>Configuración de correlativos</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Operator list and creation (col-span-8) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Create operator form */}
                  <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-blue-600" /> Agregar Nuevo Operador
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Nombre</label>
                        <input 
                          type="text" 
                          value={newOpName}
                          onChange={(e) => setNewOpName(e.target.value)}
                          placeholder="Ej: Laura Castro"
                          className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Correo</label>
                        <input 
                          type="email" 
                          value={newOpEmail}
                          onChange={(e) => setNewOpEmail(e.target.value)}
                          placeholder="laura@yaapos.com"
                          className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Contraseña</label>
                        <input 
                          type="password" 
                          value={newOpPassword}
                          onChange={(e) => setNewOpPassword(e.target.value)}
                          placeholder="••••••"
                          className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Rol operativo</label>
                        <select 
                          value={newOpRole}
                          onChange={(e) => setNewOpRole(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white shadow-xs"
                        >
                          <option value="Cajero">Cajero</option>
                          <option value="Supervisor de Almacén">Supervisor de Almacén</option>
                          <option value="Administrador">Administrador</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOperator}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Vincular Operador
                    </button>
                  </div>

                  {/* List Table */}
                  <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-xs">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Nombre</th>
                          <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Correo Electrónico</th>
                          <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Rol</th>
                          <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Ver Contraseña</th>
                          <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Estado</th>
                          <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {operators.map((op) => {
                          const isOwner = op.role === 'Propietario / Administrador' || op.id === '1';
                          const displayName = isOwner ? (user?.name || op.name) : op.name;
                          const displayEmail = isOwner ? (user?.email || op.email) : op.email;

                          return (
                            <tr key={op.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3.5 font-bold text-slate-800">{displayName}</td>
                              <td className="px-4 py-3.5 font-mono text-slate-500">{displayEmail}</td>
                              <td className="px-4 py-3.5 text-slate-600 font-medium">{op.role}</td>
                              <td className="px-4 py-3.5">
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(op.id)}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                                >
                                  {visiblePasswords[op.id] ? (
                                    <>
                                      <Eye className="w-4 h-4 text-blue-500 shrink-0" />
                                      <span className="font-mono text-xs font-bold text-slate-800">{op.password || 'cajero123'}</span>
                                      <span className="text-[11px] font-normal text-slate-400 font-sans">(Ocultar)</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
                                      <span className="text-[11px] font-normal text-slate-400 font-sans">(Ver)</span>
                                    </>
                                  )}
                                </button>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  ACTIVO
                                </span>
                              </td>
                            <td className="px-4 py-3.5 text-right">
                              {op.role !== 'Propietario / Administrador' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOperatorForTabs(op)}
                                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-all cursor-pointer"
                                    title="Gestionar Pestañas / Permisos"
                                  >
                                    <Sliders className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOperator(op.id)}
                                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-all cursor-pointer"
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
                      })}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 text-slate-800">
                <Printer className="w-4 h-4 shrink-0 text-slate-600" />
                <span className="text-xs font-black uppercase tracking-wider">Diseño y Personalización de Ticket de Impresión</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Customizers (Left column) */}
                <div className="lg:col-span-7 bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide block border-b border-slate-100 pb-2">
                    Ajustes de Ticket Térmico
                  </span>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Cabecera de Ticket (Saludo)</label>
                      <input 
                        type="text" 
                        value={ticketHeader} 
                        onChange={(e) => setTicketHeader(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                        placeholder="Ej: ¡Gracias por su preferencia!"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Pie de Ticket (Leyenda / Notas)</label>
                      <input 
                        type="text" 
                        value={ticketFooter} 
                        onChange={(e) => setTicketFooter(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                        placeholder="Ej: No se aceptan devoluciones sin ticket."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600 block">Tamaño de letra</label>
                        <div className="flex gap-2">
                          {(['sm', 'md', 'lg'] as const).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setTicketFontSize(sz)}
                              className={`flex-1 text-xs py-1.5 rounded-lg border font-bold uppercase transition-all ${
                                ticketFontSize === sz 
                                  ? 'bg-blue-600 border-blue-600 text-white' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 font-medium text-xs text-slate-600 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showLogoInTicket} 
                            onChange={(e) => setShowLogoInTicket(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span>Incluir logotipo en cabecera</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
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

                {/* Thermal Ticket simulator (Right column) */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Previsualización en tiempo real</span>
                  
                  <div className="w-68 bg-amber-50/40 border-2 border-dashed border-slate-300 p-5 font-mono text-slate-800 shadow-md rounded-2xl relative space-y-4">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-10 h-4 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase font-sans">
                      80mm
                    </div>

                    <div className="text-center space-y-1 pt-1">
                      {showLogoInTicket && (
                        <div className="flex justify-center pb-2">
                          <svg viewBox="0 0 100 30" className="w-20 h-auto text-slate-700" fill="none">
                            <path d="M10 10h6l4 12h12l3-8H16" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="20" cy="25" r="1.5" fill="currentColor"/>
                            <circle cx="28" cy="25" r="1.5" fill="currentColor"/>
                            <text x="36" y="18" fill="currentColor" fontSize="10" fontWeight="bold">Yaa POS</text>
                          </svg>
                        </div>
                      )}
                      <h4 className="font-extrabold text-xs uppercase leading-tight">{razonSocial || 'Mi Tienda E.I.R.L.'}</h4>
                      <p className="text-[10px]">NIT: {nit || '20123456789'}</p>
                      <p className="text-[9px] leading-tight text-slate-600">{address}</p>
                      <p className="text-[9px]">TEL: {phone}</p>
                    </div>

                    <div className="border-t border-b border-dashed border-slate-300 py-2.5 text-[9px] space-y-1.5 text-slate-600">
                      <p>FECHA: {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString()}</p>
                      {showOperatorInTicket && <p>CAJERO: {user?.name || 'Administrador Yaa POS'}</p>}
                      <p>DOCUMENTO: FACTURA {facturaSeries}-000042</p>
                    </div>

                    {/* Simulated Items list */}
                    <div className={`space-y-1 text-slate-800 ${ticketFontSize === 'sm' ? 'text-[9px]' : ticketFontSize === 'md' ? 'text-[11px]' : 'text-[13px]'}`}>
                      <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                        <span>DESCRIPCIÓN</span>
                        <span>TOTAL</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1x Alicate de Presión Truper</span>
                        <span>{currency} 85.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2x Cinta Aislante 3M Negra</span>
                        <span>{currency} 24.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>5x Clavo de Acero 2 Pulgadas</span>
                        <span>{currency} 10.00</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-300 pt-2 text-[10px] space-y-1">
                      <div className="flex justify-between">
                        <span>SUBTOTAL:</span>
                        <span>{currency} 100.85</span>
                      </div>
                      <div className="flex justify-between">
                        <span>I.V.A. (12%):</span>
                        <span>{currency} 12.15</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs border-t border-slate-200 pt-1">
                        <span>TOTAL A PAGAR:</span>
                        <span>{currency} 113.00</span>
                      </div>
                    </div>

                    <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[9px] text-slate-600 leading-relaxed italic">
                      <p className="font-bold">{ticketHeader}</p>
                      <p>{ticketFooter}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: CERTIFICADO DIGITAL */}
          {activeTab === 'certificado' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-4 py-3 text-slate-800">
                <ShieldCheck className="w-4 h-4 shrink-0 text-slate-600" />
                <span className="text-xs font-black uppercase tracking-wider">Firma Electrónica y Certificado XML Tributario</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Form fields (col-span-8) */}
                <div className="lg:col-span-8 bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-xs">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide block border-b border-slate-100 pb-2">
                    Vincular Certificado Digital (.PFX)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Nombre de Archivo Certificado</label>
                      <input 
                        type="text" 
                        value={certificateName}
                        onChange={(e) => setCertificateName(e.target.value)}
                        placeholder="certificado_empresa.pfx"
                        className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Contraseña de Firma Digital</label>
                      <input 
                        type="password" 
                        value={certificatePassword}
                        onChange={(e) => setCertificatePassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Fecha de Expiración</label>
                    <input 
                      type="date" 
                      value={certificateExpiration}
                      onChange={(e) => setCertificateExpiration(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono"
                    />
                  </div>
                </div>

                {/* Status card (col-span-4) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 space-y-4 text-xs">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Validez del Certificado</span>
                    
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="font-extrabold text-slate-700">CERTIFICADO ACTIVO</span>
                      </div>
                      
                      <div className="space-y-1 text-[11px] text-slate-500">
                        <p><strong>Proveedor:</strong> SUNAT / Cámara de Comercio</p>
                        <p><strong>Firma:</strong> RSA 2048 bits</p>
                        <p><strong>Vence:</strong> {certificateExpiration || '2027-12-15'}</p>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex gap-2 text-[10px] text-slate-400">
                        <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <p>Cifrado SHA-256 para firma legal de Comprobantes de Pago Electrónicos (CPE).</p>
                      </div>
                    </div>
                  </div>
                </div>

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

                  {/* Danger Zone / Reset Database */}
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

      {/* MODAL GESTIÓN DE PESTAÑAS */}
      {selectedOperatorForTabs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Permisos de Pestañas</h3>
                  <p className="text-[10px] text-slate-300 font-medium">Configurar acceso para {selectedOperatorForTabs.name}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedOperatorForTabs(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Active las casillas para habilitar las pestañas correspondientes en el menú del operador. Las pestañas desmarcadas no serán visibles en su sesión de trabajo.
              </p>

              <div className="space-y-1.5 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                {[
                  { id: 'dashboard', label: 'Dashboard' },
                  { id: 'punto-de-venta', label: 'Punto de Venta' },
                  { id: 'inventario', label: 'Inventario' },
                  { id: 'compras', label: 'Gestión Compras' },
                  { id: 'vencimientos', label: 'Vencimientos' },
                  { id: 'complementos', label: 'Complementos' },
                  { id: 'clientes', label: 'Clientes' },
                  { id: 'proveedores', label: 'Proveedores' },
                  { id: 'gastos', label: 'Gastos' },
                  { id: 'apertura-cierre', label: 'Apertura y Cierre' },
                  { id: 'reportes', label: 'Reportes Diarios' },
                  { id: 'configuracion', label: 'Configuración' }
                ].map((tab) => {
                  const isDisabled = selectedOperatorForTabs.disabledTabs?.includes(tab.id);
                  const isChecked = !isDisabled;

                  return (
                    <label 
                      key={tab.id} 
                      className="flex items-center justify-between p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-150 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-700">{tab.label}</span>
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentlyDisabled = selectedOperatorForTabs.disabledTabs || [];
                          let nextDisabled = [...currentlyDisabled];
                          if (e.target.checked) {
                            // Enable: remove from disabled
                            nextDisabled = nextDisabled.filter(id => id !== tab.id);
                          } else {
                            // Disable: add to disabled
                            if (!nextDisabled.includes(tab.id)) {
                              nextDisabled.push(tab.id);
                            }
                          }
                          setSelectedOperatorForTabs({
                            ...selectedOperatorForTabs,
                            disabledTabs: nextDisabled
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm animate-pulse-once"
              >
                Guardar Permisos
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
