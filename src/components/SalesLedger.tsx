import React, { useState, useMemo, useEffect } from 'react';
import { useRangeData } from '../utils/useRangeData';
import RangeNotice from './RangeNotice';
import { Sale, Client, AppConfig, Product, User, Branch } from '../types';
import { isItemInBranch } from '../utils/branchHelper';
import { parseSafeDate, isDateInRange, formatDisplayDateTime, toLocalDateString, getTodayDateString, isToday } from '../utils/dateHelper';
import { 
  FileSpreadsheet, 
  History,
  Search, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  Calendar, 
  Filter, 
  Building2, 
  QrCode, 
  X, 
  Printer, 
  DollarSign, 
  CreditCard, 
  Building, 
  Eye, 
  Inbox, 
  ArrowUpDown, 
  Download, 
  Users 
} from 'lucide-react';

interface SalesLedgerProps {
  sales: Sale[];
  clients: Client[];
  config: AppConfig;
  products?: Product[];
  user?: User | null;
  activeBranchName?: string;
  branches?: Branch[];
  onSwitchBranch?: (branchId: string) => void;
}

export const SalesLedger: React.FC<SalesLedgerProps> = ({
  sales: liveSales,
  clients,
  config,
  products = [],
  user,
  activeBranchName,
  branches,
  onSwitchBranch
}) => {
  const currency = config.currency || 'Q';

  // Available branches list
  const availableBranches = useMemo(() => {
    return branches || config.branches || [];
  }, [branches, config.branches]);

  // If user is operator with restricted branches:
  // "Solo verá y operará en las sucursales marcadas."
  const allowedBranches = useMemo(() => {
    if (!user?.isOperator) return [];
    if (user.branches && user.branches.length > 0) return user.branches.map(b => b.toLowerCase().trim());
    if (user.branch && user.branch !== 'Todas') return user.branch.split(',').map(s => s.toLowerCase().trim());
    return [];
  }, [user]);

  const defaultBranch = useMemo(() => {
    if (activeBranchName) return activeBranchName;
    if (allowedBranches.length > 0) return allowedBranches[0];
    if (config.activeBranchId && availableBranches.length > 0) {
      const b = availableBranches.find(br => br.id === config.activeBranchId);
      if (b) return b.name;
    }
    // For admins when there are no branches or just 1, show all
    if (!user?.isOperator && availableBranches.length <= 1) {
      return 'Todas';
    }
    return availableBranches[0]?.name || 'Todas';
  }, [activeBranchName, allowedBranches, config.activeBranchId, availableBranches, user]);

  const [selectedBranch, setSelectedBranch] = useState<string>(defaultBranch);

  useEffect(() => {
    if (activeBranchName) {
      setSelectedBranch(activeBranchName);
    }
  }, [activeBranchName]);

  // Date filtering state - Robust local / Guatemala calendar date handling
  const todayStr = useMemo(() => getTodayDateString(), []);
  const [datePreset, setDatePreset] = useState<'today' | 'month' | '30days' | 'all' | 'custom'>('month');
  
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => getTodayDateString());

  // All sales of the selected period (not only the most recent ones kept by
  // the live listener).
  const salesRange = useRangeData('sales', liveSales, startDate, endDate);
  const sales = salesRange.items;

  const effectiveSales = useMemo(() => {
    if (user?.isOperator && allowedBranches.length > 0) {
      return sales.filter(s => {
        if (s.branch) {
          return allowedBranches.some(ab => ab.toLowerCase().trim() === s.branch?.toLowerCase().trim());
        }
        return allowedBranches.some(ab => ab.includes('central') || ab.includes('principal'));
      });
    }

    if (selectedBranch && selectedBranch !== 'Todas' && availableBranches.length > 1) {
      return sales.filter(s => isItemInBranch(s.branch, selectedBranch, availableBranches));
    }

    return sales;
  }, [sales, user, allowedBranches, selectedBranch, availableBranches]);

  // Secondary filters
  const [selectedUser, setSelectedUser] = useState<string>('Todos');
  const [selectedVoucherType, setSelectedVoucherType] = useState<string>('Todos');
  const [selectedSaleType, setSelectedSaleType] = useState<string>('Todos');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Document Modal Viewer state
  const [documentModalSale, setDocumentModalSale] = useState<Sale | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<'ticket' | 'factura' | 'comprobante'>('ticket');

  // Client lookup helper
  const getClientName = (clientId: string) => {
    if (!clientId || clientId === 'cf' || clientId === 'general') return 'Consumidor Final';
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Consumidor Final';
  };

  // Distinct operators
  const operators = useMemo(() => {
    return config.operators || [];
  }, [config.operators]);

  // Apply Quick Date Range Preset
  const applyPreset = (preset: 'today' | 'month' | '30days' | 'all') => {
    setDatePreset(preset);
    const todayFormatted = getTodayDateString();

    if (preset === 'today') {
      setStartDate(todayFormatted);
      setEndDate(todayFormatted);
    } else if (preset === 'month') {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setStartDate(firstDay);
      setEndDate(todayFormatted);
    } else if (preset === '30days') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      setStartDate(toLocalDateString(past30));
      setEndDate(todayFormatted);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Search and date filtered transactions
  const filteredSales = useMemo(() => {
    return effectiveSales.filter(s => {
      // Date Range filter using robust date normalizer (prevents UTC/local day-jump exclusion)
      if (datePreset === 'today') {
        if (!isToday(s.date) && !isDateInRange(s.date, startDate, endDate)) return false;
      } else if (startDate || endDate) {
        if (!isDateInRange(s.date, startDate, endDate)) return false;
      }

      if (selectedUser !== 'Todos') {
        const seller = (s.operatorName || 'Administrador').toLowerCase();
        if (seller !== selectedUser.toLowerCase()) return false;
      }

      if (selectedVoucherType !== 'Todos') {
        const vt = (s.voucherType || 'ticket').toLowerCase();
        if (vt !== selectedVoucherType.toLowerCase()) return false;
      }

      if (selectedSaleType !== 'Todos') {
        const st = (s.saleType || 'presencial').toLowerCase();
        if (st !== selectedSaleType.toLowerCase()) return false;
      }

      if (selectedPaymentMethod !== 'Todos') {
        const pm = (s.paymentMethod || 'cash').toLowerCase();
        if (pm !== selectedPaymentMethod.toLowerCase()) return false;
      }

      return true;
    });
  }, [effectiveSales, startDate, endDate, selectedUser, selectedVoucherType, selectedSaleType, selectedPaymentMethod]);

  // Search filter across transactions with support for ticket numbers (#TKT-XXXXXX, TKT-XXXXXX, #TXXXXX)
  const searchedSales = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return filteredSales;

    return filteredSales.filter(sale => {
      const clientName = getClientName(sale.clientId).toLowerCase();
      const matchClient = clientName.includes(q);
      const matchProduct = (sale.items || []).some(item => (item.name || '').toLowerCase().includes(q));
      const matchMethod = (sale.paymentMethod || '').toLowerCase().includes(q);
      const rawId = (sale.id || '').toLowerCase();
      const matchId = rawId.includes(q);
      
      // Match ticket representations as printed on receipts
      const endSix = sale.id ? sale.id.slice(-6).toLowerCase() : '';
      const endFive = sale.id ? sale.id.slice(-5).toLowerCase() : '';
      const ticketFull = `tkt-${endSix}`;
      const ticketShort = `#tkt-${endSix}`;
      const miniTicket = `#t${endFive}`;
      const miniTicketRaw = `t${endFive}`;
      const matchTicket = ticketFull.includes(q) || ticketShort.includes(q) || miniTicket.includes(q) || miniTicketRaw.includes(q) || endSix.includes(q);

      const matchOperator = (sale.operatorName || '').toLowerCase().includes(q);
      const matchBranch = (sale.branch || '').toLowerCase().includes(q);
      const matchTotal = (Number(sale.total) || 0).toFixed(2).includes(q);

      return matchClient || matchProduct || matchMethod || matchId || matchTicket || matchOperator || matchBranch || matchTotal;
    });
  }, [filteredSales, searchQuery, clients]);

  // Guarantee chronological descending order: NEWEST SALES ALWAYS AT THE TOP
  const sortedSales = useMemo(() => {
    return [...searchedSales].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());
  }, [searchedSales]);

  return (
    <div id="sales-ledger-view" className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/80 shadow-2xs">
              <History className="w-6 h-6" />
            </div>
            Historial de Ventas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registro y consulta de comprobantes fiscales, facturas, tickets y transacciones emitidas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Imprimir Historial
          </button>
        </div>
      </div>

      {allowedBranches.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Acceso de operador restringido: </span>
            <span>Solo verá y operará en las sucursales marcadas ({user?.branches?.join(', ') || user?.branch}).</span>
          </div>
        </div>
      )}

      {/* 2. TRANSACTIONS LEDGER TABLE */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              Detalle de Comprobantes y Transacciones ({searchedSales.length})
            </h3>
            <p className="text-[11px] text-slate-400 font-medium font-sans">
              Listado de ventas registradas en el período seleccionado
            </p>
          </div>
          
          <RangeNotice loading={salesRange.loading} truncated={salesRange.truncated} fromCache={salesRange.fromCache} error={salesRange.error} />
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Date Presets */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  datePreset === 'today'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => applyPreset('month')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  datePreset === 'month'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Este Mes
              </button>
              <button
                type="button"
                onClick={() => applyPreset('30days')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  datePreset === '30days'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Días
              </button>
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  datePreset === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo
              </button>
            </div>

            {/* Date Inputs */}
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                title="Fecha Desde"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                title="Fecha Hasta"
              />
            </div>

            {/* Sucursal Filter */}
            {availableBranches.length > 1 && !allowedBranches.length && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px] font-bold text-slate-500">Sede:</span>
                <select
                  value={selectedBranch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedBranch(val);
                    if (val !== 'Todas' && onSwitchBranch) {
                      onSwitchBranch(val);
                    }
                  }}
                  className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  {availableBranches.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                  <option value="Todas">Todas (Consolidado)</option>
                </select>
              </div>
            )}

            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Buscar cliente, producto, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden text-xs font-medium bg-slate-50/50 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {sortedSales.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Inbox className="w-10 h-10 text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">No se encontraron ventas para esta búsqueda o rango de fechas.</p>
            {(startDate || endDate || searchQuery || selectedBranch !== 'Todas' || selectedUser !== 'Todos' || selectedPaymentMethod !== 'Todos') && (
              <button
                type="button"
                onClick={() => {
                  setDatePreset('all');
                  setStartDate('');
                  setEndDate('');
                  setSearchQuery('');
                  setSelectedUser('Todos');
                  setSelectedVoucherType('Todos');
                  setSelectedSaleType('Todos');
                  setSelectedPaymentMethod('Todos');
                  setSelectedBranch('Todas');
                }}
                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-all cursor-pointer shadow-2xs"
              >
                Mostrar Todas las Ventas del Sistema ({sales.length})
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< sm screens) */}
            <div className="sm:hidden divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
              {sortedSales.map((sale) => (
                <div key={`mob-sale-${sale.id}`} className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{getClientName(sale.clientId)}</span>
                        <span className="px-1.5 py-0.2 rounded font-bold text-[9px] bg-slate-100 text-slate-700 border border-slate-200">
                          {sale.branch || 'General'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatDisplayDateTime(sale.date)} • Op: {sale.operatorName || 'Admin'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-sm text-slate-900 block">
                        {currency} {(Number(sale.total) || 0).toFixed(2)}
                      </span>
                      <span className={`inline-block px-1.5 py-0.2 rounded font-bold text-[9px] mt-0.5 ${
                        sale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        sale.paymentMethod === 'card' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        sale.paymentMethod === 'transfer' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {sale.paymentMethod === 'cash' ? 'Efectivo' :
                         sale.paymentMethod === 'card' ? 'Tarjeta' :
                         sale.paymentMethod === 'transfer' ? 'Transfer' : 'Crédito'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                    <span className="text-[10px] text-slate-500 capitalize">
                      {sale.voucherType || 'ticket'} • {sale.saleType || 'presencial'}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('ticket'); }}
                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-blue-100 shadow-2xs"
                      >
                        <Receipt className="w-3 h-3 text-blue-600" /> Ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('factura'); }}
                        className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-purple-100 shadow-2xs"
                      >
                        <FileText className="w-3 h-3 text-purple-600" /> Detallado
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (sm and above) */}
            <div className="hidden sm:block overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Fecha/Hora</th>
                    <th className="py-2.5 px-3">Sucursal</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Comprobante</th>
                    <th className="py-2.5 px-3 text-center">Tipo</th>
                    <th className="py-2.5 px-3 text-center">Método</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center">Ver Comprobantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedSales.map((sale) => (
                    <tr key={sale.id} className="text-slate-700 hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[10px]">
                        {formatDisplayDateTime(sale.date)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                          {sale.branch || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {getClientName(sale.clientId)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-medium">
                        {sale.operatorName || 'Administrador'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600 capitalize text-[11px]">
                        {sale.voucherType || 'ticket'}
                      </td>
                      <td className="py-2.5 px-3 text-center capitalize text-slate-500 text-[11px]">
                        {sale.saleType || 'presencial'}
                      </td>
                      <td className="py-2.5 px-3 text-center capitalize">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${
                          sale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          sale.paymentMethod === 'card' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          sale.paymentMethod === 'transfer' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {sale.paymentMethod === 'cash' ? 'Efectivo' :
                           sale.paymentMethod === 'card' ? 'Tarjeta' :
                           sale.paymentMethod === 'transfer' ? 'Transfer' : 'Crédito'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {currency} {sale.total.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('ticket'); }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-blue-100 shadow-2xs"
                            title="Ver Ticket"
                          >
                            <Receipt className="w-3 h-3 text-blue-600" /> Ticket
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('factura'); }}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-purple-100 shadow-2xs"
                            title="Ver comprobante detallado (sin validez fiscal)"
                          >
                            <FileText className="w-3 h-3 text-purple-600" /> Detallado
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('comprobante'); }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-emerald-100 shadow-2xs"
                            title="Ver Comprobante"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Comprobante
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

      {/* 6. DOCUMENT VIEWER MODAL (TICKET, FACTURA Y COMPROBANTE) */}
      {documentModalSale && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col my-auto max-h-[90vh]">
            
            {/* Top Banner & Document Type Selector Tabs */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shrink-0">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-400" />
                  Documento de Venta #{documentModalSale.id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Fecha: {formatDisplayDateTime(documentModalSale.date)} | Cliente: {getClientName(documentModalSale.clientId)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Document switcher tabs */}
                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedDocumentType('ticket')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedDocumentType === 'ticket' 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDocumentType('factura')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedDocumentType === 'factura' 
                        ? 'bg-purple-600 text-white shadow-xs' 
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Detallado
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDocumentType('comprobante')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedDocumentType === 'comprobante' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Comprobante
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDocumentModalSale(null)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable / Renderable Content Area */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100/70 flex justify-center items-start min-h-[380px]">
              
              {/* TICKET FORMAT */}
              {selectedDocumentType === 'ticket' && (
                <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 w-full max-w-sm text-xs font-mono space-y-4 text-slate-800 print:shadow-none print:border-none">
                  <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                    <h4 className="font-extrabold text-base tracking-tight uppercase text-slate-900">{config.storeName || 'MI NEGOCIO'}</h4>
                    {config.address && <p className="text-[10px] text-slate-500">{config.address}</p>}
                    {config.phone && <p className="text-[10px] text-slate-500">Tel: {config.phone}</p>}
                    <p className="text-[10px] font-bold text-slate-600">NIT: {config.nit || 'C/F'}</p>
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 font-bold text-[10px] rounded mt-1 border border-blue-100">
                      TICKET DE VENTA
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3 text-slate-600">
                    <div className="flex justify-between">
                      <span>No. Ticket:</span>
                      <span className="font-bold text-slate-800">#TKT-{documentModalSale.id.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fecha/Hora:</span>
                      <span>{formatDisplayDateTime(documentModalSale.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cliente:</span>
                      <span className="font-bold truncate max-w-[150px]">{getClientName(documentModalSale.clientId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vendedor:</span>
                      <span>{documentModalSale.operatorName || 'Administrador'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tipo Venta:</span>
                      <span className="capitalize">{documentModalSale.saleType || 'presencial'}</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Cant x Producto</span>
                      <span>Subtotal</span>
                    </div>
                    <div className="space-y-1.5">
                      {documentModalSale.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="truncate pr-2">{item.quantity}x {item.name}</span>
                            <span className="font-bold shrink-0">{currency} {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                          {item.prescription && (
                            <div className="text-[9px] text-blue-800 bg-blue-50/70 p-1.5 rounded border border-blue-100 space-y-0.5">
                              <div><strong>Rx Receta:</strong> {item.prescription.prescriptionNumber} ({item.prescription.prescriptionType || 'Bajo receta'})</div>
                              <div><strong>Médico:</strong> {item.prescription.doctorName} {item.prescription.doctorLicense ? `(Col. ${item.prescription.doctorLicense})` : ''}</div>
                              <div><strong>Paciente:</strong> {item.prescription.patientName} {item.prescription.patientDpi ? `- DPI: ${item.prescription.patientDpi}` : ''}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex justify-between font-extrabold text-sm text-slate-900 border-b border-slate-200 pb-1">
                      <span>TOTAL A PAGAR:</span>
                      <span className="text-blue-700">{currency} {documentModalSale.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Método de Pago:</span>
                      <span className="font-bold capitalize">{documentModalSale.paymentMethod === 'cash' ? 'Efectivo' : documentModalSale.paymentMethod === 'card' ? 'Tarjeta' : documentModalSale.paymentMethod === 'transfer' ? 'Transferencia' : 'Crédito'}</span>
                    </div>
                    {documentModalSale.paymentMethod === 'cash' && documentModalSale.received > 0 && (
                      <>
                        <div className="flex justify-between text-slate-500 text-[10px]">
                          <span>Efectivo Recibido:</span>
                          <span>{currency} {documentModalSale.received.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[10px]">
                          <span>Cambio / Vuelto:</span>
                          <span>{currency} {documentModalSale.change.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-center pt-3 border-t border-dashed border-slate-300 space-y-1">
                    <p className="text-[10px] font-bold text-slate-500">*** ¡Gracias por su compra! ***</p>
                    <p className="text-[9px] text-slate-400">Conserve este ticket para cualquier reclamo o garantía.</p>
                  </div>
                </div>
              )}

              {/* FACTURA FORMAT */}
              {selectedDocumentType === 'factura' && (
                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 w-full max-w-2xl text-xs space-y-6 text-slate-800 print:shadow-none print:border-none">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-800 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-blue-700" />
                        <h4 className="font-black text-xl text-slate-900 tracking-tight uppercase">{config.razonSocial || config.storeName || 'MI NEGOCIO'}</h4>
                      </div>
                      {config.address && <p className="text-slate-500 font-medium">{config.address}</p>}
                      {config.phone && <p className="text-slate-500 font-medium">Teléfono: {config.phone}</p>}
                      {config.nit && <p className="font-bold text-slate-700">NIT: {config.nit}</p>}
                    </div>

                    <div className="bg-slate-50 border-slate-200 text-slate-800 border-2 p-4 rounded-xl text-center min-w-[200px] space-y-1 shrink-0">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-700">
                        COMPROBANTE DE VENTA
                      </span>
                      <span className="block font-mono text-sm font-black text-slate-900">
                        Ref. {documentModalSale.id.slice(-8).toUpperCase()}
                      </span>
                      <div className="pt-1 text-[9px] text-amber-700 font-bold border-t border-slate-200">
                        DOCUMENTO SIN VALIDEZ FISCAL
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">CLIENTE</span>
                      <span className="font-bold text-slate-900 text-sm">{getClientName(documentModalSale.clientId)}</span>
                      <span className="block text-slate-500 text-[11px]">NIT / DPI: {clients.find(c => c.id === documentModalSale.clientId)?.nit || 'C/F'}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">FECHA DE EMISIÓN</span>
                      <span className="font-bold text-slate-800 font-mono text-xs">{formatDisplayDateTime(documentModalSale.date)}</span>
                      <span className="block text-slate-500 text-[11px]">Moneda: GTQ / {currency}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-3 rounded-l-lg">Cant.</th>
                          <th className="py-2.5 px-3">Descripción / Producto</th>
                          <th className="py-2.5 px-3 text-right">P. Unitario</th>
                          <th className="py-2.5 px-3 text-right rounded-r-lg">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {documentModalSale.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold font-mono text-slate-700">{item.quantity}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              <div>{item.name}</div>
                              {item.prescription && (
                                <div className="text-[10px] text-blue-700 font-mono mt-0.5">
                                  Rx #{item.prescription.prescriptionNumber} | Dr. {item.prescription.doctorName} (Col. {item.prescription.doctorLicense || 'S/N'}) | Paciente: {item.prescription.patientName}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">{currency} {item.price.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{currency} {(item.price * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-end border-t border-slate-200 pt-4">
                    <div className="space-y-1 max-w-xs">
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {config.ticketFooter || 'Comprobante de venta para control interno.'}
                      </p>
                      <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[10px] pt-1">
                        <FileText className="w-4 h-4 text-amber-600" /> No es una factura electrónica (FEL). Sin validez fiscal.
                      </div>
                    </div>

                    {(() => {
                      const docTaxRate = (parseFloat(config.taxRate || '12') || 0) / 100;
                      const docNet = docTaxRate > 0 ? documentModalSale.total / (1 + docTaxRate) : documentModalSale.total;
                      const docTax = documentModalSale.total - docNet;
                      return (
                        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl min-w-[220px] space-y-1.5 font-mono">
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>Subtotal Neto:</span>
                            <span>{currency} {docNet.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 text-[11px]">
                            <span>{config.taxName || 'IVA'} Incluido ({(docTaxRate * 100).toFixed(0)}%):</span>
                            <span>{currency} {docTax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-1.5">
                            <span>TOTAL:</span>
                            <span className="text-blue-700">{currency} {documentModalSale.total.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* COMPROBANTE FORMAT */}
              {selectedDocumentType === 'comprobante' && (
                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 w-full max-w-xl text-xs space-y-6 text-slate-800 print:shadow-none print:border-none">
                  <div className="flex justify-between items-start border-b-2 border-emerald-600 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        <h4 className="font-extrabold text-lg text-slate-900 tracking-tight">{config.storeName || 'MI NEGOCIO'}</h4>
                      </div>
                      <p className="text-slate-500 text-[11px]">Comprobante de Cancelación / Entrega</p>
                      {config.phone && <p className="text-slate-500 text-[11px]">Atención al Cliente: {config.phone}</p>}
                    </div>

                    <div className="text-right space-y-1">
                      <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-black text-xs rounded-lg border border-emerald-200 uppercase">
                        COMPROBANTE DE PAGO
                      </span>
                      <span className="block font-mono font-bold text-slate-700 text-xs">#CMP-{documentModalSale.id.slice(-6).toUpperCase()}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">{formatDisplayDateTime(documentModalSale.date)}</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">RECIBIDO DE (CLIENTE)</span>
                        <span className="font-extrabold text-slate-900 text-sm">{getClientName(documentModalSale.clientId)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">FORMA DE PAGO</span>
                        <span className="inline-block px-2.5 py-0.5 rounded font-extrabold text-xs capitalize bg-white text-emerald-800 border border-emerald-200 mt-0.5">
                          {documentModalSale.paymentMethod === 'cash' ? 'Efectivo' : documentModalSale.paymentMethod === 'card' ? 'Tarjeta' : documentModalSale.paymentMethod === 'transfer' ? 'Transferencia' : 'Crédito'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">CONCEPTO Y DETALLE DE PRODUCTOS</span>
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {documentModalSale.items.map((item, idx) => (
                        <div key={idx} className="p-3 flex justify-between items-center bg-white hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-800 text-xs block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{item.quantity} unidad(es) x {currency}{item.price.toFixed(2)}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900">{currency} {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-300">TOTAL CANCELADO:</span>
                    <span className="font-mono font-black text-xl text-emerald-400">{currency} {documentModalSale.total.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-center">
                    <div className="space-y-1">
                      <div className="border-b border-slate-300 h-10 w-3/4 mx-auto" />
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">FIRMA CAJERO / EMPRESA</span>
                      <span className="block text-[10px] text-slate-400">{documentModalSale.operatorName || 'Administrador'}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="border-b border-slate-300 h-10 w-3/4 mx-auto" />
                      <span className="block text-[10px] font-bold text-slate-500 uppercase">FIRMA CLIENTE</span>
                      <span className="block text-[10px] text-slate-400">Recibido Conforme</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer Controls */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 font-medium hidden sm:block">
                Mostrando como: <strong className="capitalize text-slate-800">{selectedDocumentType}</strong>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Documento
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentModalSale(null)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
