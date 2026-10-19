import React, { useState, useMemo } from 'react';
import { Client, Provider, Branch } from '../types';
import { 
  Users, 
  Truck, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign,
  AlertCircle,
  Eye
} from 'lucide-react';

interface ClientsProvidersProps {
  clients: Client[];
  providers: Provider[];
  currency: string;
  onSaveClient: (client: Client) => Promise<Client>;
  onDeleteClient: (id: string) => Promise<{ success: boolean }>;
  onSaveProvider: (provider: Provider) => Promise<Provider>;
  onDeleteProvider: (id: string) => Promise<{ success: boolean }>;
  onRefreshData: () => void;
  mode?: 'clients' | 'providers';
  activeBranchName?: string;
  branches?: Branch[];
  onSwitchBranch?: (branchName: string) => void;
}

export default function ClientsProviders({ 
  clients, 
  providers, 
  currency, 
  onSaveClient, 
  onDeleteClient, 
  onSaveProvider, 
  onDeleteProvider, 
  onRefreshData,
  mode
}: ClientsProvidersProps) {
  const [activeTabState, setActiveTabState] = useState<'clients' | 'providers'>('clients');
  const activeTab = mode || activeTabState;
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  // Client fields
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientLimit, setClientLimit] = useState('');
  const [clientBalance, setClientBalance] = useState('');

  // Provider fields
  const [provName, setProvName] = useState('');
  const [provContact, setProvContact] = useState('');
  const [provPhone, setProvPhone] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [provAddress, setProvAddress] = useState('');
  const [provNit, setProvNit] = useState('');
  const [provTotalPurchases, setProvTotalPurchases] = useState('0');
  const [provCreditPending, setProvCreditPending] = useState('0');

  // View detailed provider modal state
  const [selectedProviderForView, setSelectedProviderForView] = useState<Provider | null>(null);
  const [isProviderViewOpen, setIsProviderViewOpen] = useState(false);

  // --- CLIENT MODAL OPEN ---
  const openClientAdd = () => {
    setEditingClient(null);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setClientLimit('1000');
    setClientBalance('0');
    setIsClientModalOpen(true);
  };

  const openClientEdit = (c: Client) => {
    setEditingClient(c);
    setClientName(c.name);
    setClientPhone(c.phone);
    setClientEmail(c.email);
    setClientAddress(c.address || '');
    setClientLimit(c.limitCredit.toString());
    setClientBalance(c.balanceCredit.toString());
    setIsClientModalOpen(true);
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;

    const newClient: Client = {
      id: editingClient?.id || '',
      name: clientName,
      phone: clientPhone || 'S/T',
      email: clientEmail || 'sin@correo.com',
      address: clientAddress || undefined,
      limitCredit: parseFloat(clientLimit) || 0,
      balanceCredit: parseFloat(clientBalance) || 0
    };

    try {
      await onSaveClient(newClient);
      setIsClientModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar el cliente');
    }
  };

  const handleClientDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este cliente? Se borrará el historial de saldos.')) {
      try {
        await onDeleteClient(id);
        onRefreshData();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar el cliente');
      }
    }
  };

  // --- PROVIDER MODAL OPEN ---
  const openProviderAdd = () => {
    setEditingProvider(null);
    setProvName('');
    setProvContact('');
    setProvPhone('');
    setProvEmail('');
    setProvAddress('');
    setProvNit('');
    setProvTotalPurchases('0');
    setProvCreditPending('0');
    setIsProviderModalOpen(true);
  };

  const openProviderEdit = (p: Provider) => {
    setEditingProvider(p);
    setProvName(p.name);
    setProvContact(p.contact);
    setProvPhone(p.phone);
    setProvEmail(p.email);
    setProvAddress(p.address || '');
    setProvNit(p.nit || '');
    setProvTotalPurchases((p.totalPurchases ?? 0).toString());
    setProvCreditPending((p.creditPending ?? 0).toString());
    setIsProviderModalOpen(true);
  };

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provName) return;

    const newProvider: Provider = {
      id: editingProvider?.id || '',
      name: provName,
      contact: provContact || 'S/C',
      phone: provPhone || 'S/T',
      email: provEmail || 'sin@correo.com',
      address: provAddress || undefined,
      nit: provNit || 'S/N',
      totalPurchases: parseFloat(provTotalPurchases) || 0,
      creditPending: parseFloat(provCreditPending) || 0
    };

    try {
      await onSaveProvider(newProvider);
      setIsProviderModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar el proveedor');
    }
  };

  const openProviderView = (p: Provider) => {
    setSelectedProviderForView(p);
    setIsProviderViewOpen(true);
  };

  const handleProviderDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este proveedor?')) {
      try {
        await onDeleteProvider(id);
        onRefreshData();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar el proveedor');
      }
    }
  };

  // --- FILTERS ---
  const filteredClients = useMemo(() => {
    if (activeTab !== 'clients') return [];
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clients, searchQuery, activeTab]);

  const filteredProviders = useMemo(() => {
    if (activeTab !== 'providers') return [];
    return providers.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      (p.nit && p.nit.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [providers, searchQuery, activeTab]);

  return (
    <div id="clients-providers-view" className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        {mode ? (
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
              {activeTab === 'clients' ? (
                <>
                  <Users className="w-6 h-6 text-[#2563EB]" />
                  Clientes
                </>
              ) : (
                <>
                  <Truck className="w-6 h-6 text-[#2563EB]" />
                  Proveedores
                </>
              )}
            </h1>
            <p className="text-[#64748B] text-xs">
              {activeTab === 'clients' ? 'Directorio y control de cuentas corrientes de clientes' : 'Administración y catálogo de proveedores homologados'}
            </p>
          </div>
        ) : (
          <div className="flex bg-slate-100 rounded-lg p-1 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => { setActiveTabState('clients'); setSearchQuery(''); }}
              className={`flex-1 sm:flex-none text-xs font-semibold px-4 py-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'clients' ? 'bg-white text-[#1F2937] shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              <Users className="w-4 h-4" /> Directorio de Clientes
            </button>
            <button
              onClick={() => { setActiveTabState('providers'); setSearchQuery(''); }}
              className={`flex-1 sm:flex-none text-xs font-semibold px-4 py-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'providers' ? 'bg-white text-[#1F2937] shadow-2xs' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              <Truck className="w-4 h-4" /> Proveedores Homologados
            </button>
          </div>
        )}

        <button
          onClick={activeTab === 'clients' ? openClientAdd : openProviderAdd}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> {activeTab === 'clients' ? 'Nuevo Cliente' : 'Nuevo Proveedor'}
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-2xs p-3.5 relative">
        <span className="absolute inset-y-0 left-3.5 flex items-center pl-3 text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder={activeTab === 'clients' ? "Buscar clientes por nombre, teléfono o correo..." : "Buscar proveedores por nombre, contacto o teléfono..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] text-xs font-medium text-[#1F2937] bg-white"
        />
      </div>

      {/* CLIENTS TAB TABLE */}
      {activeTab === 'clients' && (
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="py-16 text-center text-[#64748B] text-xs">No se encontraron clientes registrados.</div>
          ) : (
            <>
              {/* Mobile Clients Cards (< sm) */}
              <div className="sm:hidden divide-y divide-[#E2E8F0]">
                {filteredClients.map((c) => (
                  <div key={`mob-client-${c.id}`} className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-xs text-[#1F2937]">{c.name}</h4>
                        <p className="text-[10px] text-[#64748B] font-mono">{c.phone} {c.email ? `• ${c.email}` : ''}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md font-semibold font-mono text-[10px] tabular-nums border shrink-0 ${
                        c.balanceCredit > 0 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                      }`}>
                        Debe: {currency}{c.balanceCredit.toFixed(2)}
                      </span>
                    </div>

                    {c.address && (
                      <p className="text-[10px] text-slate-500 truncate">{c.address}</p>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                      <span className="text-[#64748B]">
                        Límite: <strong className="font-mono text-slate-800">{currency}{c.limitCredit.toFixed(2)}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openClientEdit(c)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClientDelete(c.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (sm and above, unchanged) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Teléfono</th>
                      <th className="py-3 px-4">Correo Electrónico</th>
                      <th className="py-3 px-4">Dirección Física</th>
                      <th className="py-3 px-4 text-right">Límite Crédito</th>
                      <th className="py-3 px-4 text-right">Saldo Deudor</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredClients.map((c) => (
                      <tr key={c.id} className="text-[#64748B] hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#1F2937]">{c.name}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#1F2937]">{c.phone}</td>
                        <td className="py-3 px-4 text-xs text-[#64748B]">{c.email}</td>
                        <td className="py-3 px-4 text-xs text-[#64748B] max-w-xs truncate">{c.address || 'Sin dirección registrada'}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-[#1F2937] tabular-nums">{currency}{c.limitCredit.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded-md font-semibold font-mono text-[11px] tabular-nums border ${
                            c.balanceCredit > 0 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                          }`}>
                            {currency}{c.balanceCredit.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openClientEdit(c)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleClientDelete(c.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* PROVIDERS TAB TABLE */}
      {activeTab === 'providers' && (
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden">
          {filteredProviders.length === 0 ? (
            <div className="py-16 text-center text-[#64748B] text-xs">No se encontraron proveedores registrados.</div>
          ) : (
            <>
              {/* Mobile Providers Cards (< sm) */}
              <div className="sm:hidden divide-y divide-[#E2E8F0]">
                {filteredProviders.map((p) => (
                  <div key={`mob-prov-${p.id}`} className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-xs text-[#1F2937]">{p.name}</h4>
                        <p className="text-[10px] text-[#64748B]">Contacto: {p.contact} • <span className="font-mono">{p.phone}</span></p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] font-mono border shrink-0 ${
                        (p.creditPending ?? 0) > 0 
                          ? 'bg-rose-50 text-[#DC2626] border-rose-200' 
                          : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                      }`}>
                        Pendiente: {currency}{(p.creditPending ?? 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                      <span className="text-[#64748B]">
                        Total compras: <strong className="font-mono text-slate-800">{currency}{(p.totalPurchases ?? 0).toFixed(2)}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openProviderView(p)}
                          className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openProviderEdit(p)}
                          className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProviderDelete(p.id)}
                          className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-rose-50 rounded-md border border-[#E2E8F0] transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (sm and above, unchanged) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">NIT / ID Fiscal</th>
                      <th className="py-3 px-4">Razón Social</th>
                      <th className="py-3 px-4">Contacto</th>
                      <th className="py-3 px-4">Teléfono</th>
                      <th className="py-3 px-4 text-right">Total Compras</th>
                      <th className="py-3 px-4 text-center">Crédito Pendiente</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredProviders.map((p) => (
                      <tr key={p.id} className="text-[#64748B] hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-[#1F2937] font-semibold">{p.nit || '—'}</td>
                        <td className="py-3 px-4 font-semibold text-[#1F2937]">{p.name}</td>
                        <td className="py-3 px-4 text-xs font-medium text-[#64748B]">{p.contact}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#1F2937]">{p.phone}</td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1F2937] text-right tabular-nums">
                          {currency}{(p.totalPurchases ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] font-mono inline-block min-w-[70px] text-center border tabular-nums ${
                            (p.creditPending ?? 0) > 0 
                              ? 'bg-rose-50 text-[#DC2626] border-rose-200' 
                              : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                          }`}>
                            {currency}{(p.creditPending ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openProviderView(p)}
                              className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors cursor-pointer"
                              title="Ver detalles"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openProviderEdit(p)}
                              className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleProviderDelete(p.id)}
                              className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-rose-50 rounded-md border border-[#E2E8F0] transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* CLIENT DIALOG MODAL */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#1F2937] text-sm">
                {editingClient ? 'Editar Información de Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">×</button>
            </div>

            <form onSubmit={handleClientSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">Nombre Completo *</label>
                <input
                  type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Teléfono</label>
                  <input
                    type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Correo Electrónico</label>
                  <input
                    type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">Dirección Física</label>
                <input
                  type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Límite de Crédito ({currency})</label>
                  <input
                    type="number" value={clientLimit} onChange={(e) => setClientLimit(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Saldo Deudor ({currency})</label>
                  <input
                    type="number" value={clientBalance} onChange={(e) => setClientBalance(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-[#E2E8F0] pt-4 mt-5">
                <button
                  type="button" onClick={() => setIsClientModalOpen(false)}
                  className="flex-1 py-2 border border-[#E2E8F0] rounded-lg text-[#64748B] text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs active:scale-[0.98] transition-colors cursor-pointer"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROVIDER DIALOG MODAL */}
      {isProviderModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-md w-full p-5 shadow-xl border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="font-bold text-[#1F2937] text-sm">
                {editingProvider ? 'Editar Distribuidora' : 'Registrar Proveedor'}
              </h3>
              <button onClick={() => setIsProviderModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">×</button>
            </div>

            <form onSubmit={handleProviderSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Razón Social / Distribuidora *</label>
                  <input
                    type="text" required value={provName} onChange={(e) => setProvName(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">NIT *</label>
                  <input
                    type="text" required value={provNit} onChange={(e) => setProvNit(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">Persona de Contacto *</label>
                <input
                  type="text" required value={provContact} onChange={(e) => setProvContact(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Teléfono de Oficina</label>
                  <input
                    type="text" value={provPhone} onChange={(e) => setProvPhone(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Correo de Pedidos</label>
                  <input
                    type="email" value={provEmail} onChange={(e) => setProvEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">Dirección de Despacho</label>
                <input
                  type="text" value={provAddress} onChange={(e) => setProvAddress(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Total Compras ({currency})</label>
                  <input
                    type="number" step="0.01" value={provTotalPurchases} onChange={(e) => setProvTotalPurchases(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Crédito Pendiente ({currency})</label>
                  <input
                    type="number" step="0.01" value={provCreditPending} onChange={(e) => setProvCreditPending(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button" onClick={() => setIsProviderModalOpen(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-blue-700 transition-colors"
                >
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROVIDER DETAILS MODAL (Eye Icon) */}
      {isProviderViewOpen && selectedProviderForView && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Detalles del Proveedor
              </h3>
              <button onClick={() => setIsProviderViewOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>

            <div className="space-y-3.5 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">NIT</span>
                  <span className="font-mono text-slate-800 font-semibold">{selectedProviderForView.nit || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Razón Social</span>
                  <span className="text-slate-800 font-semibold">{selectedProviderForView.name}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Contacto</span>
                  <span className="text-slate-800 font-medium">{selectedProviderForView.contact}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Teléfono</span>
                  <span className="font-mono text-slate-800">{selectedProviderForView.phone}</span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase">Correo Electrónico</span>
                <span className="text-slate-800">{selectedProviderForView.email}</span>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-400 uppercase">Dirección de Despacho</span>
                <span className="text-slate-800">{selectedProviderForView.address || 'Sin dirección registrada'}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Total Compras</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {currency}{(selectedProviderForView.totalPurchases ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Crédito Pendiente</span>
                  <span className={`px-2 py-0.5 rounded-lg text-white font-extrabold text-xs font-mono inline-block ${
                    (selectedProviderForView.creditPending ?? 0) > 0 ? 'bg-[#DC2626]' : 'bg-[#008A2E]'
                  }`}>
                    {currency}{(selectedProviderForView.creditPending ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 pt-4 mt-4">
              <button
                onClick={() => setIsProviderViewOpen(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
