import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Expense, AppConfig, Client, Product } from '../types';
import { 
  TrendingUp, 
  DollarSign, 
  TrendingDown, 
  ArrowRightLeft, 
  CreditCard, 
  Receipt, 
  FileSpreadsheet, 
  Search, 
  BarChart,
  Inbox,
  Calendar,
  Filter,
  BarChart3,
  UserCheck,
  X,
  Eye,
  Building,
  Printer,
  FileText,
  CheckCircle2,
  QrCode,
  Building2
} from 'lucide-react';
import * as api from '../api';

interface DailyReportsProps {
  sales: Sale[];
  expenses: Expense[];
  clients: Client[];
  config: AppConfig;
  products?: Product[];
}

const getLocalDateStr = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function DailyReports({ sales, expenses, clients, config, products = [] }: DailyReportsProps) {
  const currency = config.currency || 'Q';
  
  // Toggles detailed transactional ledger & other financial sheets
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Document Viewer Modal State (Ticket, Factura, Comprobante)
  const [documentModalSale, setDocumentModalSale] = useState<Sale | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<'ticket' | 'factura' | 'comprobante'>('ticket');

  // Loaded operators state
  const [operators, setOperators] = useState<any[]>([]);

  // Filter States - Default to the current month to show all relevant sales automatically
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return getLocalDateStr(firstDay);
  });

  const [endDate, setEndDate] = useState<string>(() => {
    return getLocalDateStr(new Date());
  });

  const [selectedUser, setSelectedUser] = useState('Todos');
  const [selectedVoucherType, setSelectedVoucherType] = useState('Todos');
  const [selectedSaleType, setSelectedSaleType] = useState('Todos');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Todos');
  const [datePreset, setDatePreset] = useState<'today' | 'month' | '30days' | 'all' | 'custom'>('month');

  // Multi-preset applicator
  const applyPreset = (preset: 'today' | 'month' | '30days' | 'all') => {
    const now = new Date();
    if (preset === 'today') {
      const todayStr = getLocalDateStr(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(getLocalDateStr(firstDay));
      setEndDate(getLocalDateStr(now));
    } else if (preset === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      setStartDate(getLocalDateStr(thirtyDaysAgo));
      setEndDate(getLocalDateStr(now));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
    setDatePreset(preset);
  };

  // Real-time synchronization when new sales are made while preserving selected preset
  useEffect(() => {
    if (datePreset !== 'custom') {
      applyPreset(datePreset);
    }
  }, [sales, datePreset]);

  // Fetch operators on mount for the "USUARIO" filter
  useEffect(() => {
    async function loadOperators() {
      try {
        const list = await api.getOperators();
        setOperators(list);
      } catch (err) {
        console.warn('Failed to load operators for reports:', err);
      }
    }
    loadOperators();
  }, []);

  // Filter sales dynamically based on all 6 criteria
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // Robust YYYY-MM-DD string extraction in user's local timezone
      const localDate = new Date(s.date);
      const yyyy = localDate.getFullYear();
      const mm = String(localDate.getMonth() + 1).padStart(2, '0');
      const dd = String(localDate.getDate()).padStart(2, '0');
      const sLocalDateStr = `${yyyy}-${mm}-${dd}`;

      // 1. Start Date boundary
      if (startDate) {
        if (sLocalDateStr < startDate) return false;
      }
      
      // 2. End Date boundary
      if (endDate) {
        if (sLocalDateStr > endDate) return false;
      }

      // 3. User filter
      if (selectedUser !== 'Todos') {
        const seller = s.operatorName || 'Administrador';
        if (seller.toLowerCase() !== selectedUser.toLowerCase()) return false;
      }

      // 4. Voucher Type filter
      if (selectedVoucherType !== 'Todos') {
        const vType = s.voucherType || 'ticket';
        if (vType.toLowerCase() !== selectedVoucherType.toLowerCase()) return false;
      }

      // 5. Sale Type filter
      if (selectedSaleType !== 'Todos') {
        const sType = s.saleType || 'presencial';
        if (sType.toLowerCase() !== selectedSaleType.toLowerCase()) return false;
      }

      // 6. Payment Method filter
      if (selectedPaymentMethod !== 'Todos') {
        let mapped = '';
        if (selectedPaymentMethod === 'Efectivo') mapped = 'cash';
        else if (selectedPaymentMethod === 'Tarjeta') mapped = 'card';
        else if (selectedPaymentMethod === 'Transferencia') mapped = 'transfer';
        else if (selectedPaymentMethod === 'Crédito POS') mapped = 'credit';

        if (mapped && s.paymentMethod !== mapped) return false;
      }

      return true;
    });
  }, [sales, startDate, endDate, selectedUser, selectedVoucherType, selectedSaleType, selectedPaymentMethod]);

  // Filter expenses based on Date Range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const localDate = new Date(e.date);
      const yyyy = localDate.getFullYear();
      const mm = String(localDate.getMonth() + 1).padStart(2, '0');
      const dd = String(localDate.getDate()).padStart(2, '0');
      const eLocalDateStr = `${yyyy}-${mm}-${dd}`;

      if (startDate) {
        if (eLocalDateStr < startDate) return false;
      }
      if (endDate) {
        if (eLocalDateStr > endDate) return false;
      }
      return true;
    });
  }, [expenses, startDate, endDate]);

  // Statistics summaries
  const stats = useMemo(() => {
    const salesSum = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const profitSum = filteredSales.reduce((acc, s) => acc + s.profit, 0);
    const salesCount = filteredSales.length;
    const averageTicket = salesCount > 0 ? (salesSum / salesCount) : 0;
    const expensesSum = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netBalance = salesSum - expensesSum;

    return { salesSum, profitSum, salesCount, averageTicket, expensesSum, netBalance };
  }, [filteredSales, filteredExpenses]);

  // Payment method breakdown for conic-gradient donut chart
  const paymentMethodStats = useMemo(() => {
    let cash = 0;
    let card = 0;
    let transfer = 0;
    let credit = 0;

    filteredSales.forEach(s => {
      if (s.paymentMethod === 'cash') cash += s.total;
      else if (s.paymentMethod === 'card') card += s.total;
      else if (s.paymentMethod === 'transfer') transfer += s.total;
      else if (s.paymentMethod === 'credit') credit += s.total;
    });

    const total = cash + card + transfer + credit || 1;

    return [
      { name: 'efectivo', amount: cash, color: '#005F73', pct: (cash / total) * 100 },
      { name: 'tarjeta', amount: card, color: '#0A9396', pct: (card / total) * 100 },
      { name: 'transferencia', amount: transfer, color: '#94D2BD', pct: (transfer / total) * 100 },
      { name: 'crédito', amount: credit, color: '#E9D8A6', pct: (credit / total) * 100 }
    ].filter(p => p.amount > 0);
  }, [filteredSales]);

  // CSS Conic gradient style computation for Payment Donut
  const donutBackground = useMemo(() => {
    if (paymentMethodStats.length === 0) {
      return 'conic-gradient(#E2E8F0 0% 100%)';
    }
    const gradientParts: string[] = [];
    let cumulative = 0;
    paymentMethodStats.forEach(stat => {
      const start = cumulative;
      cumulative += stat.pct;
      gradientParts.push(`${stat.color} ${start}% ${cumulative}%`);
    });
    return `conic-gradient(${gradientParts.join(', ')})`;
  }, [paymentMethodStats]);

  // Sales by seller for Bar Chart
  const salesBySeller = useMemo(() => {
    const sellerMap: { [name: string]: number } = {};
    
    // Always list Administrador
    sellerMap['Administrador'] = 0;
    operators.forEach(op => {
      sellerMap[op.name] = 0;
    });

    filteredSales.forEach(s => {
      const seller = s.operatorName || 'Administrador';
      sellerMap[seller] = (sellerMap[seller] || 0) + s.total;
    });

    return Object.entries(sellerMap).map(([name, amount]) => ({
      name,
      amount
    }));
  }, [filteredSales, operators]);

  // Relative calculations for Y-Axis and bar heights in the bar chart
  const barChartTicks = useMemo(() => {
    const maxAmount = Math.max(...salesBySeller.map(s => s.amount), 100);
    const roundedMax = Math.ceil(maxAmount / 50) * 50;
    const ticks: number[] = [];
    for (let i = 5; i >= 0; i--) {
      ticks.push((roundedMax / 5) * i);
    }
    return { ticks, max: roundedMax };
  }, [salesBySeller]);

  // Top products leaderboard
  const topProducts = useMemo(() => {
    const productMap: { [id: string]: { name: string; quantity: number; totalRevenue: number } } = {};
    
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const key = item.productId || item.name;
        if (!productMap[key]) {
          productMap[key] = {
            name: item.name,
            quantity: 0,
            totalRevenue: 0
          };
        }
        productMap[key].quantity += item.quantity;
        productMap[key].totalRevenue += item.quantity * item.price;
      });
    });

    return Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [filteredSales]);

  // Detailed Ledger search filter
  const searchedSales = useMemo(() => {
    return filteredSales.filter(sale => {
      const clientName = getClientName(sale.clientId).toLowerCase();
      const matchClient = clientName.includes(searchQuery.toLowerCase());
      const matchProduct = sale.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchMethod = sale.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase());
      return matchClient || matchProduct || matchMethod;
    });
  }, [filteredSales, searchQuery]);

  // Computation helper for the detailed "Resumen detallado de ingresos" Modal
  const modalData = useMemo(() => {
    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let creditSales = 0;

    filteredSales.forEach(s => {
      if (s.paymentMethod === 'cash') cashSales += s.total;
      else if (s.paymentMethod === 'card') cardSales += s.total;
      else if (s.paymentMethod === 'transfer') transferSales += s.total;
      else if (s.paymentMethod === 'credit') creditSales += s.total;
    });

    const totalContado = cashSales + cardSales + transferSales;
    const totalCreditoCuotas = 0; // Standard 0 as requested by image reference
    const ingresoTotal = totalContado + totalCreditoCuotas;

    // Classification by Category (facturado)
    const categoryMap: { [cat: string]: { contado: number; credito: number; total: number } } = {};
    
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        let category = 'Sin categoría';
        if (products && products.length > 0) {
          const prod = products.find(p => p.id === item.productId || p.name.toLowerCase() === item.name.toLowerCase());
          if (prod && prod.category) {
            category = prod.category;
          }
        }
        if (!categoryMap[category]) {
          categoryMap[category] = { contado: 0, credito: 0, total: 0 };
        }
        
        const itemTotal = item.quantity * item.price;
        if (s.paymentMethod === 'credit') {
          categoryMap[category].credito += itemTotal;
        } else {
          categoryMap[category].contado += itemTotal;
        }
        categoryMap[category].total += itemTotal;
      });
    });

    // If there are no sales/categories, default to show "Sin categoría"
    if (Object.keys(categoryMap).length === 0) {
      categoryMap['Sin categoría'] = { contado: 0, credito: 0, total: 0 };
    }

    const categoriesArray = Object.entries(categoryMap).map(([name, data]) => ({
      name,
      ...data
    }));

    return {
      cashSales,
      cardSales,
      transferSales,
      creditSales,
      totalContado,
      totalCreditoCuotas,
      ingresoTotal,
      categoriesArray
    };
  }, [filteredSales, products]);

  function getClientName(id?: string) {
    if (!id) return 'Consumidor Final (C.F.)';
    return clients.find(c => c.id === id)?.name || 'Consumidor Final (C.F.)';
  }

  return (
    <div id="reports-view" className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-slate-700" />
            Reportes y Estadísticas
          </h1>
          <p className="text-sm text-slate-500">Analiza tus ventas y desempeño en tiempo real</p>
        </div>

        {/* Dynamic Detail Sheet Toggle Button */}
        <button
          type="button"
          onClick={() => setShowDetailedModal(true)}
          className="px-4.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Más Detalles
        </button>
      </div>

      {/* 2. FILTERS CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 space-y-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            FILTROS DE BÚSQUEDA
          </h2>
          
          {/* QUICK PRESET BUTTONS FOR QUICK SYNC AND INTUITIVE ACCESS */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                datePreset === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => applyPreset('month')}
              className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                datePreset === 'month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Este Mes
            </button>
            <button
              type="button"
              onClick={() => applyPreset('30days')}
              className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                datePreset === '30days'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Últimos 30 Días
            </button>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                datePreset === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          
          {/* FECHA DESDE */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FECHA DESDE</label>
            <div className="relative">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* FECHA HASTA */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FECHA HASTA</label>
            <div className="relative">
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* USUARIO */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">USUARIO</label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E')] bg-[size:0.6rem_auto] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="Todos">Todos</option>
              <option value="Administrador">Administrador</option>
              {operators.map(op => (
                <option key={op.id} value={op.name}>{op.name}</option>
              ))}
            </select>
          </div>

          {/* TIPO COMPROBANTE */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TIPO COMPROBANTE</label>
            <select 
              value={selectedVoucherType} 
              onChange={(e) => setSelectedVoucherType(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E')] bg-[size:0.6rem_auto] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="Todos">Todos</option>
              <option value="ticket">Ticket</option>
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
              <option value="recibo">Recibo</option>
            </select>
          </div>

          {/* TIPO VENTA */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TIPO VENTA</label>
            <select 
              value={selectedSaleType} 
              onChange={(e) => setSelectedSaleType(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E')] bg-[size:0.6rem_auto] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="Todos">Todos</option>
              <option value="presencial">Presencial</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

          {/* METODO PAGO */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">METODO PAGO</label>
            <select 
              value={selectedPaymentMethod} 
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E')] bg-[size:0.6rem_auto] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="Todos">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Crédito POS">Crédito POS</option>
            </select>
          </div>

        </div>
      </div>

      {/* 3. CORE SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* VENTAS TOTALES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#005F73]" />
          <div className="space-y-1.5 pl-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">VENTAS TOTALES</span>
            <h3 className="text-2xl font-black text-slate-800 font-mono">
              {currency} {stats.salesSum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium block">Ingresos del periodo</span>
          </div>
          <div className="p-4 bg-slate-50 text-[#005F73] rounded-2xl group-hover:scale-105 transition-transform duration-200 shadow-3xs">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* CANTIDAD DE VENTAS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0A9396]" />
          <div className="space-y-1.5 pl-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">CANTIDAD DE VENTAS</span>
            <h3 className="text-2xl font-black text-slate-800 font-mono">
              {stats.salesCount}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium block">Transacciones registradas</span>
          </div>
          <div className="p-4 bg-slate-50 text-[#0A9396] rounded-2xl group-hover:scale-105 transition-transform duration-200 shadow-3xs">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* TICKET PROMEDIO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#E9D8A6]" />
          <div className="space-y-1.5 pl-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">TICKET PROMEDIO</span>
            <h3 className="text-2xl font-black text-slate-800 font-mono">
              {currency} {stats.averageTicket.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium block">Promedio por venta</span>
          </div>
          <div className="p-4 bg-slate-50 text-amber-600 rounded-2xl group-hover:scale-105 transition-transform duration-200 shadow-3xs">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* 4. EXPANDABLE SECTION (Utilidad, Gastos, Balance Neto) */}
      {showMoreDetails && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-200">
          
          {/* UTILIDAD / MARGEN */}
          <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">UTILIDAD ESTIMADA</span>
              <h3 className="text-xl font-extrabold text-emerald-700 font-mono">
                {currency} {stats.profitSum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <span className="text-[10px] text-emerald-600 font-semibold">
                ~{stats.salesSum > 0 ? ((stats.profitSum / stats.salesSum) * 100).toFixed(0) : 0}% de margen
              </span>
            </div>
            <div className="p-3 bg-white text-emerald-600 rounded-xl shadow-2xs border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* GASTOS OPERATIVOS */}
          <div className="bg-red-50/40 p-5 rounded-2xl border border-red-100 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-red-800 uppercase tracking-wider block">GASTOS OPERATIVOS</span>
              <h3 className="text-xl font-extrabold text-red-700 font-mono">
                {currency} {stats.expensesSum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">{filteredExpenses.length} egresos en periodo</span>
            </div>
            <div className="p-3 bg-white text-red-500 rounded-xl shadow-2xs border border-red-100">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          {/* BALANCE NETO REAL */}
          <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">BALANCE NETO REAL</span>
              <h3 className={`text-xl font-extrabold font-mono ${stats.netBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {currency} {stats.netBalance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">Ingresos menos gastos cargados</span>
            </div>
            <div className={`p-3 bg-white rounded-xl shadow-2xs border border-blue-100 ${stats.netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

        </div>
      )}

      {/* 5. VISUAL CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CHART 1: VENTAS POR METODO DE PAGO (Conic Donut) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b pb-3">
            <span className="text-[#005F73]">●</span> Ventas por método de pago
          </h3>

          <div className="flex flex-col items-center justify-center py-4">
            <div 
              className="relative w-44 h-44 rounded-full flex items-center justify-center shadow-inner" 
              style={{ background: donutBackground }}
            >
              {/* White central overlay to make it a donut */}
              <div className="absolute w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-2xs border border-slate-50">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Total</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  {currency}{stats.salesSum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Custom high-fidelity legends */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-6 max-w-sm">
              {paymentMethodStats.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs font-bold text-slate-600 capitalize">
                  <span className="w-3 h-3 rounded-md" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({item.pct.toFixed(0)}%)</span>
                </div>
              ))}
              {paymentMethodStats.length === 0 && (
                <span className="text-xs text-slate-400 italic">No hay registros</span>
              )}
            </div>
          </div>
        </div>

        {/* CHART 2: VENTAS POR VENDEDOR (Vertical Bar Chart) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b pb-3">
            <span className="text-blue-500">📊</span> Ventas por vendedor
          </h3>

          <div className="relative pt-6">
            <div className="flex h-48 items-end gap-4 border-b border-slate-200 pb-2 relative">
              
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[8px] text-slate-400 font-mono pr-2">
                {barChartTicks.ticks.map((tick, i) => (
                  <div key={i} className="w-full flex items-center gap-2">
                    <span className="w-12 text-right">{currency}{tick.toFixed(2)}</span>
                    <div className="flex-1 border-t border-slate-100" />
                  </div>
                ))}
              </div>

              {/* Vertical Bars representation */}
              <div className="flex-1 flex justify-around items-end h-full pl-14 z-10">
                {salesBySeller.map((seller, index) => {
                  const heightPercent = barChartTicks.max > 0 ? (seller.amount / barChartTicks.max) * 100 : 0;
                  return (
                    <div key={index} className="flex flex-col items-center group relative w-20">
                      
                      {/* Tooltip */}
                      <div className="absolute -top-10 bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                        {currency}{seller.amount.toFixed(2)}
                      </div>
                      
                      {/* Bar */}
                      <div 
                        className="w-12 bg-[#005F73] rounded-t-lg transition-all duration-300 hover:bg-[#0A9396] cursor-pointer shadow-3xs"
                        style={{ height: `${Math.max(heightPercent, 2)}%` }}
                      />
                      
                      {/* Seller Name Label */}
                      <span className="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">
                        {seller.name}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* 6. TOP PRODUCTS TABLE */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 border-b pb-3">
            <span className="text-amber-500">🏆</span> Top productos vendidos
          </h3>

          {topProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
              <Inbox className="w-10 h-10 text-slate-200" />
              <p className="text-sm">No hay registros en este período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">PRODUCTO</th>
                    <th className="py-2.5 px-3 text-center">CANTIDAD</th>
                    <th className="py-2.5 px-3 text-right">INGRESOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topProducts.map((p, i) => (
                    <tr key={i} className="text-slate-700 hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black flex items-center justify-center mx-auto border border-amber-100 shadow-3xs">
                          {i + 1}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {p.name}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-bold text-[10px] font-mono border border-blue-100/50">
                          {p.quantity.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        {currency} {p.totalRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 7. DETAILED TRANSACTION LEDGER (MÁS DETALLES PANEL) */}
      {showMoreDetails && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-5 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Libro Auxiliar de Ventas ({searchedSales.length})</h3>
              <p className="text-[11px] text-slate-400 font-medium">Registro detallado de transacciones bajo los filtros actuales</p>
            </div>
            
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Filtrar por cliente, producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden text-xs font-medium"
              />
            </div>
          </div>

          {searchedSales.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
              <Inbox className="w-10 h-10 text-slate-200" />
              <p className="text-sm">No se encontraron ventas para esta búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase">
                    <th className="py-2.5 px-3">Fecha/Hora</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Usuario/Vendedor</th>
                    <th className="py-2.5 px-3">Comprobante</th>
                    <th className="py-2.5 px-3 font-medium text-center">Tipo</th>
                    <th className="py-2.5 px-3 text-center">Método</th>
                    <th className="py-2.5 px-3 text-right">Total Cobrado</th>
                    <th className="py-2.5 px-3 text-center">Ver Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {searchedSales.slice().reverse().map((sale) => (
                    <tr key={sale.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-mono">
                        {new Date(sale.date).toLocaleString('es-ES', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {getClientName(sale.clientId)}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-medium">
                        {sale.operatorName || 'Administrador'}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-500 capitalize">
                        {sale.voucherType || 'ticket'}
                      </td>
                      <td className="py-3 px-3 text-center capitalize text-slate-500">
                        {sale.saleType || 'presencial'}
                      </td>
                      <td className="py-3 px-3 text-center capitalize">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
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
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        {currency} {sale.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('ticket'); }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer border border-blue-100"
                            title="Ver Ticket"
                          >
                            <Receipt className="w-3 h-3 text-blue-600" /> Ticket
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('factura'); }}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer border border-purple-100"
                            title="Ver Factura"
                          >
                            <FileText className="w-3 h-3 text-purple-600" /> Factura
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('comprobante'); }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer border border-emerald-100"
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
          )}
        </div>
      )}

      {/* 8. DETAILED REPORTS MODAL */}
      {showDetailedModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-[#0084FF] text-white px-6 py-4.5 relative flex justify-between items-center shadow-md">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1.5 bg-white/10 rounded-lg">
                    <BarChart className="w-5 h-5 text-blue-100" />
                  </span>
                  Resumen detallado de ingresos
                </h3>
              </div>
              <button 
                onClick={() => setShowDetailedModal(false)} 
                className="p-1.5 hover:bg-white/15 rounded-full text-blue-100 hover:text-white transition-all cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-slate-50/50">
              
              {/* FILTERS CONTAINER */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-3xs grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* FECHA DESDE */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">Fecha desde</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* FECHA HASTA */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">Fecha hasta</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* USUARIO */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">Usuario</label>
                  <select 
                    value={selectedUser} 
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22/%3E%3C/svg%3E')] bg-[size:0.6rem_auto] bg-[position:right_12px_center] bg-no-repeat pr-8"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Administrador">Administrador</option>
                    {operators.map(op => (
                      <option key={op.id} value={op.name}>{op.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* THREE CORE STATS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ventas Contado */}
                <div className="bg-[#e2f0d9] border border-emerald-200/60 p-4 rounded-2xl flex items-center gap-4 shadow-3xs">
                  <div className="p-3.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-emerald-800/80 uppercase tracking-wider block">Ingreso por ventas (contado)</span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      {currency} {modalData.totalContado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Pagos de crédito */}
                <div className="bg-[#e2f0f9] border border-indigo-200/50 p-4 rounded-2xl flex items-center gap-4 shadow-3xs">
                  <div className="p-3.5 bg-indigo-100 text-indigo-800 rounded-2xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-indigo-800/80 uppercase tracking-wider block">Pagos de crédito (cuotas)</span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      {currency} {modalData.totalCreditoCuotas.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Ingreso Total */}
                <div className="bg-[#fef3cd] border border-amber-200/60 p-4 rounded-2xl flex items-center gap-4 shadow-3xs">
                  <div className="p-3.5 bg-amber-100 text-amber-800 rounded-2xl">
                    <Building className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Ingreso total</span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      {currency} {modalData.ingresoTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 1: CLASIFICACION POR FORMA DE PAGO */}
              <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-2xs">
                <div className="bg-slate-50/75 px-4.5 py-3.5 border-b border-slate-150">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Clasificación por forma de pago (ingresos)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/60 text-indigo-950 font-extrabold border-b border-indigo-100/80 uppercase tracking-wider">
                        <th className="py-3 px-5 text-slate-600 font-bold">FORMA DE PAGO</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">VENTAS CONTADO</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">PAGOS CRÉDITO</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Efectivo Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-700 capitalize">efectivo</td>
                        <td className="py-3 px-5 text-right font-mono text-slate-700 font-medium">
                          {currency} {modalData.cashSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-slate-400">
                          {currency} 0.00
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-slate-800">
                          {currency} {modalData.cashSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* Tarjeta Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-700 capitalize">tarjeta</td>
                        <td className="py-3 px-5 text-right font-mono text-slate-700 font-medium">
                          {currency} {modalData.cardSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-slate-400">
                          {currency} 0.00
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-slate-800">
                          {currency} {modalData.cardSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* Transferencia Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-700 capitalize">transferencias</td>
                        <td className="py-3 px-5 text-right font-mono text-slate-700 font-medium">
                          {currency} {modalData.transferSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-slate-400">
                          {currency} 0.00
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-slate-800">
                          {currency} {modalData.transferSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* Totales Row */}
                      <tr className="bg-slate-50/60 font-black border-t-2 border-slate-200">
                        <td className="py-3.5 px-5 text-slate-800">Totales</td>
                        <td className="py-3.5 px-5 text-right font-mono text-slate-900">
                          {currency} {modalData.totalContado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-slate-500">
                          {currency} 0.00
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-slate-900 text-sm">
                          {currency} {modalData.totalContado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: CLASIFICACION POR TIPO DE VENTA */}
              <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-2xs">
                <div className="bg-slate-50/75 px-4.5 py-3.5 border-b border-slate-150">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Clasificación por tipo de venta</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/60 text-indigo-950 font-extrabold border-b border-indigo-100/80 uppercase tracking-wider">
                        <th className="py-3 px-5 text-slate-600 font-bold">TIPO DE VENTA</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">FACTURADO</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">INGRESO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Contado Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-700">Contado</td>
                        <td className="py-3 px-5 text-right font-mono text-slate-700 font-medium">
                          {currency} {modalData.totalContado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-slate-800">
                          {currency} {modalData.totalContado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {/* Crédito Row */}
                      <tr className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-5 font-bold text-slate-700 flex items-center gap-1.5">
                          Crédito 
                          <span className="text-blue-600 hover:text-blue-800 cursor-pointer text-[10px] font-extrabold flex items-center gap-0.5 select-none transition-colors">
                            <Eye className="w-3 h-3" /> Ver
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-slate-700 font-medium">
                          {currency} {modalData.creditSales.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-slate-800">
                          {currency} 0.00
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 3: CLASIFICACION POR CATEGORIA (FACTURADO) */}
              <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-2xs">
                <div className="bg-slate-50/75 px-4.5 py-3.5 border-b border-slate-150">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Clasificación por categoría (facturado)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-indigo-50/60 text-indigo-950 font-extrabold border-b border-indigo-100/80 uppercase tracking-wider">
                        <th className="py-3 px-5 text-slate-600 font-bold">CATEGORÍA</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">CONTADO</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">CRÉDITO</th>
                        <th className="py-3 px-5 text-right text-slate-600 font-bold">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {modalData.categoriesArray.map((cat, i) => (
                        <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-5 font-bold text-slate-700 capitalize">{cat.name}</td>
                          <td className="py-3 px-5 text-right font-mono text-slate-700 font-medium">
                            {currency} {cat.contado.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-5 text-right font-mono text-slate-700 font-medium">
                            {currency} {cat.credito.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-5 text-right font-mono font-bold text-slate-800">
                            {currency} {cat.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {/* Totales Row */}
                      <tr className="bg-slate-50/60 font-black border-t-2 border-slate-200">
                        <td className="py-3.5 px-5 text-slate-800">Totales</td>
                        <td className="py-3.5 px-5 text-right font-mono text-slate-900">
                          {currency} {modalData.categoriesArray.reduce((acc, c) => acc + c.contado, 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-slate-900">
                          {currency} {modalData.categoriesArray.reduce((acc, c) => acc + c.credito, 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-slate-900 text-sm">
                          {currency} {modalData.categoriesArray.reduce((acc, c) => acc + c.total, 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AUXILIARY HISTORICAL TRANSACTIONS LEDGER (PRESERVING ALL ORIGINAL DETAILS) */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Libro Auxiliar de Ventas ({searchedSales.length})</h4>
                    <p className="text-[11px] text-slate-400 font-medium font-sans">Registro de transacciones detallado correspondiente a los filtros actuales</p>
                  </div>
                  
                  <div className="relative w-full sm:w-64">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Filtrar por cliente, producto, método..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8.5 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden text-xs font-medium"
                    />
                  </div>
                </div>

                {searchedSales.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                    <Inbox className="w-8 h-8 text-slate-200" />
                    <p className="text-xs font-medium">No se encontraron ventas para esta búsqueda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-3">Fecha/Hora</th>
                          <th className="py-2 px-3">Cliente</th>
                          <th className="py-2 px-3">Usuario</th>
                          <th className="py-2 px-3">Comprobante</th>
                          <th className="py-2 px-3 text-center">Tipo</th>
                          <th className="py-2 px-3 text-center">Método</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-center">Ver Comprobantes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {searchedSales.slice().reverse().map((sale) => (
                          <tr key={sale.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                            <td className="py-2 px-3 font-mono text-[10px]">
                              {new Date(sale.date).toLocaleString('es-ES', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-800">
                              {getClientName(sale.clientId)}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-medium">
                              {sale.operatorName || 'Administrador'}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-500 capitalize text-[11px]">
                              {sale.voucherType || 'ticket'}
                            </td>
                            <td className="py-2 px-3 text-center capitalize text-slate-500 text-[11px]">
                              {sale.saleType || 'presencial'}
                            </td>
                            <td className="py-2 px-3 text-center capitalize">
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
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
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                              {currency} {sale.total.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('ticket'); }}
                                  className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer border border-blue-100"
                                  title="Ver Ticket"
                                >
                                  <Receipt className="w-2.5 h-2.5 text-blue-600" /> Ticket
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('factura'); }}
                                  className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer border border-purple-100"
                                  title="Ver Factura"
                                >
                                  <FileText className="w-2.5 h-2.5 text-purple-600" /> Factura
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setDocumentModalSale(sale); setSelectedDocumentType('comprobante'); }}
                                  className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer border border-emerald-100"
                                  title="Ver Comprobante"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Comprobante
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Footer with Cerrar Button */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailedModal(false)}
                className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-md select-none active:scale-95 uppercase tracking-wide"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 9. DOCUMENT VIEWER MODAL (TICKET, FACTURA Y COMPROBANTE) */}
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
                  Fecha: {new Date(documentModalSale.date).toLocaleString('es-ES')} | Cliente: {getClientName(documentModalSale.clientId)}
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
                    Factura
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
                      <span>{new Date(documentModalSale.date).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
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
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span className="truncate pr-2">{item.quantity}x {item.name}</span>
                          <span className="font-bold shrink-0">{currency} {(item.price * item.quantity).toFixed(2)}</span>
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
                  {/* Factura Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-800 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-purple-700" />
                        <h4 className="font-black text-xl text-slate-900 tracking-tight uppercase">{config.storeName || 'MI NEGOCIO, S.A.'}</h4>
                      </div>
                      {config.address && <p className="text-slate-500 font-medium">{config.address}</p>}
                      {config.phone && <p className="text-slate-500 font-medium">Teléfono: {config.phone}</p>}
                      <p className="font-bold text-slate-700">NIT Emisor: {config.nit || '12345678-9'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Régimen: Pequeño Contribuyente / Sujeto a Retención Definitiva</p>
                    </div>

                    <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-xl text-center min-w-[200px] space-y-1 shrink-0">
                      <span className="block text-[10px] font-black text-purple-800 uppercase tracking-widest">FACTURA ELECTRÓNICA FEL</span>
                      <span className="block font-mono text-xs font-bold text-slate-700">Serie: FEL-A1</span>
                      <span className="block font-mono text-sm font-black text-purple-900">No. 00{documentModalSale.id.slice(-6).toUpperCase()}</span>
                      <div className="pt-1 text-[9px] text-purple-700 font-mono border-t border-purple-200">
                        AUT: 4E82B1C9-{documentModalSale.id.slice(0, 8).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Client & Date Info Table */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">RECEPTOR / CLIENTE</span>
                      <span className="font-bold text-slate-900 text-sm">{getClientName(documentModalSale.clientId)}</span>
                      <span className="block text-slate-500 text-[11px]">NIT / DPI: C/F (Consumidor Final)</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">FECHA DE EMISIÓN</span>
                      <span className="font-bold text-slate-800 font-mono text-xs">{new Date(documentModalSale.date).toLocaleString('es-ES')}</span>
                      <span className="block text-slate-500 text-[11px]">Moneda: GTQ / {currency}</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-purple-900 text-white font-bold uppercase text-[10px]">
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
                            <td className="py-2.5 px-3 font-medium text-slate-800">{item.name}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">{currency} {item.price.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{currency} {(item.price * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Section */}
                  <div className="flex justify-between items-end border-t border-slate-200 pt-4">
                    <div className="space-y-1 max-w-xs">
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Sujeto a pagos trimestrales ISR / Documento Tributario Electrónico emitido conforme a la resolución de la SAT.
                      </p>
                      <div className="flex items-center gap-1.5 text-purple-700 font-bold text-[10px] pt-1">
                        <QrCode className="w-4 h-4" /> Certificado Digitalmente por la SAT
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl min-w-[220px] space-y-1.5 font-mono">
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Subtotal Neto:</span>
                        <span>{currency} {(documentModalSale.total * 0.88).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>IVA Incluido (12%):</span>
                        <span>{currency} {(documentModalSale.total * 0.12).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-1.5">
                        <span>TOTAL FACTURA:</span>
                        <span className="text-purple-700">{currency} {documentModalSale.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPROBANTE FORMAT */}
              {selectedDocumentType === 'comprobante' && (
                <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 w-full max-w-xl text-xs space-y-6 text-slate-800 print:shadow-none print:border-none">
                  {/* Header Banner */}
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
                      <span className="block text-[10px] text-slate-400 font-mono">{new Date(documentModalSale.date).toLocaleString('es-ES')}</span>
                    </div>
                  </div>

                  {/* Recibido de info */}
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

                  {/* Concept / Items Breakdown */}
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

                  {/* Total Highlight Banner */}
                  <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-300">TOTAL CANCELADO:</span>
                    <span className="font-mono font-black text-xl text-emerald-400">{currency} {documentModalSale.total.toFixed(2)}</span>
                  </div>

                  {/* Signatures */}
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
}
