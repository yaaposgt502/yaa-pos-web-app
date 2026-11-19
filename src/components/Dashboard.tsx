import React from 'react';
import { useRangeData } from '../utils/useRangeData';
import { Product, Sale, Expense, Shift, AppConfig, User, Branch } from '../types';
import { isItemInBranch } from '../utils/branchHelper';
import { parseSafeDate, toLocalDateString, formatDisplayTime, formatDisplayDateTime } from '../utils/dateHelper';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  CheckCircle, 
  CheckCircle2, 
  Inbox, 
  BarChart3, 
  PieChart, 
  ChevronDown, 
  Banknote, 
  CreditCard, 
  ArrowRightLeft, 
  Wallet, 
  ShoppingBag, 
  ExternalLink, 
  Receipt,
  Building2 
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  shifts: Shift[];
  config: AppConfig;
  onNavigate: (tab: string) => void;
  user?: User | null;
  activeBranchName?: string;
  branches?: Branch[];
  onSwitchBranch?: (branchId: string) => void;
}

export default function Dashboard({ 
  products, 
  sales: liveSales, 
  expenses: liveExpenses, 
  shifts: rawShifts, 
  config, 
  onNavigate, 
  user,
  activeBranchName,
  branches,
  onSwitchBranch
}: DashboardProps) {
  const availableBranches = React.useMemo(() => {
    return branches || config.branches || [];
  }, [branches, config.branches]);

  // If user is operator with restricted branches:
  // "Solo verá y operará en las sucursales marcadas."
  const allowedBranches = React.useMemo(() => {
    if (!user?.isOperator) return [];
    if (user.branches && user.branches.length > 0) return user.branches.map(b => b.toLowerCase().trim());
    if (user.branch && user.branch !== 'Todas') return user.branch.split(',').map(s => s.toLowerCase().trim());
    return [];
  }, [user]);

  const defaultBranch = React.useMemo(() => {
    if (activeBranchName) return activeBranchName;
    if (allowedBranches.length > 0) return allowedBranches[0];
    if (config.activeBranchId && availableBranches.length > 0) {
      const b = availableBranches.find(br => br.id === config.activeBranchId);
      if (b) return b.name;
    }
    return availableBranches[0]?.name || 'Todas';
  }, [activeBranchName, allowedBranches, config.activeBranchId, availableBranches]);

  const [selectedBranch, setSelectedBranch] = React.useState<string>(defaultBranch);

  React.useEffect(() => {
    if (activeBranchName) {
      setSelectedBranch(activeBranchName);
    }
  }, [activeBranchName]);

  // The dashboard shows up to the last 30 days: read all sales/expenses of
  // that window, not only the most recent ones kept by the live listeners.
  const dashboardStart = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const salesRange = useRangeData('sales', liveSales, dashboardStart, '');
  const expensesRange = useRangeData('expenses', liveExpenses, dashboardStart, '');
  const rawSales = salesRange.items;
  const expenses = expensesRange.items;

  const sales = React.useMemo(() => {
    if (user?.isOperator && allowedBranches.length > 0) {
      return rawSales.filter(s => {
        if (s.branch) return allowedBranches.some(ab => ab.toLowerCase().trim() === s.branch?.toLowerCase().trim());
        return allowedBranches.some(ab => ab.includes('central') || ab.includes('principal'));
      });
    }
    if (selectedBranch && selectedBranch !== 'Todas') {
      return rawSales.filter(s => isItemInBranch(s.branch, selectedBranch, availableBranches));
    }
    return rawSales;
  }, [rawSales, user, allowedBranches, selectedBranch, availableBranches]);

  const shifts = React.useMemo(() => {
    if (user?.isOperator && allowedBranches.length > 0) {
      return rawShifts.filter(sh => {
        if (sh.branch) return allowedBranches.some(ab => ab.toLowerCase().trim() === sh.branch?.toLowerCase().trim());
        return allowedBranches.some(ab => ab.includes('central') || ab.includes('principal'));
      });
    }
    if (selectedBranch && selectedBranch !== 'Todas') {
      return rawShifts.filter(sh => isItemInBranch(sh.branch, selectedBranch, availableBranches));
    }
    return rawShifts;
  }, [rawShifts, user, allowedBranches, selectedBranch, availableBranches]);

  const branchExpenses = React.useMemo(() => {
    if (user?.isOperator && allowedBranches.length > 0) {
      return expenses.filter(e => {
        if (e.branch) return allowedBranches.some(ab => ab.toLowerCase().trim() === e.branch?.toLowerCase().trim());
        return allowedBranches.some(ab => ab.includes('central') || ab.includes('principal'));
      });
    }
    if (selectedBranch && selectedBranch !== 'Todas') {
      return expenses.filter(e => isItemInBranch(e.branch, selectedBranch, availableBranches));
    }
    return expenses;
  }, [expenses, user, allowedBranches, selectedBranch, availableBranches]);

  // Calculations
  const currency = config.currency || 'Q';
  
  // Today's boundaries
  const today = React.useMemo(() => new Date(), []);
  const todayDateStr = React.useMemo(() => toLocalDateString(today), [today]);

  const todaySales = React.useMemo(() => {
    return sales.filter(s => toLocalDateString(s.date) === todayDateStr);
  }, [sales, todayDateStr]);
  const todaySalesTotal = React.useMemo(() => todaySales.reduce((acc, s) => acc + (Number(s.total) || 0), 0), [todaySales]);
  const todayProfit = React.useMemo(() => todaySales.reduce((acc, s) => acc + (Number(s.profit) || 0), 0), [todaySales]);

  const todayExpenses = React.useMemo(() => {
    return branchExpenses.filter(e => toLocalDateString(e.date) === todayDateStr);
  }, [branchExpenses, todayDateStr]);
  const todayExpensesTotal = React.useMemo(() => todayExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0), [todayExpenses]);

  const lowStock = products.filter(p => p.stock <= p.minStock);
  
  // Expiring items in the alert window
  const now = Date.now();
  const alertDays = config.alertDaysBeforeExpiration || 30;
  const warningLimit = now + alertDays * 24 * 3600 * 1000;
  
  const expiringSoon = products.filter(p => {
    if (!p.expirationDate) return false;
    const exp = parseSafeDate(p.expirationDate).getTime();
    return exp <= warningLimit && exp > now;
  });

  // Current Shift Status
  const currentShift = shifts.find(s => s.state === 'open' && isItemInBranch(s.branch, selectedBranch, availableBranches));

  // --- Sales Trend Data for Main Chart ---
  const [timeframe, setTimeframe] = React.useState<'7days' | '14days' | '30days'>('7days');
  const [hoveredPoint, setHoveredPoint] = React.useState<{ label: string; fullDate: string; total: number; count: number; x: number; y: number } | null>(null);

  const salesTrendData = React.useMemo(() => {
    const days = timeframe === '7days' ? 7 : timeframe === '14days' ? 14 : 30;
    const result: { dateStr: string; label: string; fullDate: string; total: number; count: number }[] = [];
    
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dateKey = toLocalDateString(d);

      // Format label: "Vie 17", "Sáb 18", "Dom 19", etc.
      const rawDayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
      const cleanDayName = rawDayName.replace('.', '').trim();
      const capitalized = cleanDayName.charAt(0).toUpperCase() + cleanDayName.slice(1);
      const label = `${capitalized} ${d.getDate()}`;
      const fullDate = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      // Calculate real sales for this specific calendar day using robust local date comparison
      const daySales = sales.filter(s => {
        if (!s.date) return false;
        return toLocalDateString(s.date) === dateKey;
      });

      const total = daySales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      result.push({
        dateStr: dateKey,
        label,
        fullDate,
        total,
        count: daySales.length
      });
    }

    return result;
  }, [sales, timeframe]);

  // Dynamic Scale and Ticks Calculation for Y-Axis
  const trendScale = React.useMemo(() => {
    const maxVal = Math.max(...salesTrendData.map(d => d.total), 0);
    
    // Target maximum
    let targetMax = maxVal === 0 ? 100 : maxVal * 1.18;
    
    // Choose clean step for tick marks
    let step = 20;
    if (targetMax <= 100) step = 20;
    else if (targetMax <= 500) step = 100;
    else if (targetMax <= 1000) step = 200;
    else if (targetMax <= 2500) step = 500;
    else if (targetMax <= 5000) step = 1000;
    else if (targetMax <= 10000) step = 2000;
    else if (targetMax <= 25000) step = 5000;
    else if (targetMax <= 50000) step = 10000;
    else if (targetMax <= 100000) step = 20000;
    else step = Math.ceil(targetMax / 5 / 10000) * 10000;

    const tickSteps = 5;
    let finalMax = step * tickSteps;
    if (finalMax < maxVal) {
      finalMax = Math.ceil(maxVal / step) * step;
    }

    const ticks: number[] = [];
    for (let i = tickSteps; i >= 0; i--) {
      ticks.push(Math.round((finalMax / tickSteps) * i));
    }

    return { max: finalMax, ticks };
  }, [salesTrendData]);

  // --- 4 Bottom Visual Cards State & Computation ---
  const [categoryTimeframe, setCategoryTimeframe] = React.useState<'today' | 'week' | 'month' | 'all'>('today');
  const [topProductsTimeframe, setTopProductsTimeframe] = React.useState<'today' | 'week' | 'month' | 'all'>('today');

  // Helper filter by timeframe using robust date parsing
  const filterSalesByTimeframe = (tf: 'today' | 'week' | 'month' | 'all') => {
    const n = new Date();
    if (tf === 'today') {
      const todayStr = toLocalDateString(n);
      return sales.filter(s => toLocalDateString(s.date) === todayStr);
    }
    if (tf === 'week') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
      return sales.filter(s => parseSafeDate(s.date).getTime() >= cutoff.getTime());
    }
    if (tf === 'month') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      cutoff.setHours(0, 0, 0, 0);
      return sales.filter(s => parseSafeDate(s.date).getTime() >= cutoff.getTime());
    }
    return sales;
  };

  // 1. Top 5 Categories Data
  const topCategoriesData = React.useMemo(() => {
    const targetSales = filterSalesByTimeframe(categoryTimeframe);

    const prodToCat: { [idOrName: string]: string } = {};
    products.forEach(p => {
      const cat = p.category ? p.category.trim() : '';
      if (cat) {
        prodToCat[p.id] = cat;
        prodToCat[p.name] = cat;
      }
    });

    const catTotals: { [category: string]: number } = {};
    targetSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const cat = prodToCat[item.productId] || prodToCat[item.name] || 'General';
        catTotals[cat] = (catTotals[cat] || 0) + (Number(item.quantity || 1) * Number(item.price || 0));
      });
    });

    const sorted = Object.entries(catTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    if (sorted.length === 0) {
      return {
        items: [],
        max: 0,
        ticks: []
      };
    }

    const maxVal = Math.max(...sorted.map(s => s.amount), 10);
    const step = maxVal > 5000 ? 2000 : maxVal > 2000 ? 1000 : maxVal > 1000 ? 500 : 100;
    const roundedMax = Math.ceil((maxVal * 1.15) / step) * step;
    const tickCount = 3;
    const ticks = [];
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(Math.round((roundedMax / tickCount) * i));
    }

    return {
      items: sorted,
      max: roundedMax,
      ticks
    };
  }, [sales, products, categoryTimeframe]);

  // 2. Top 5 Products Data
  const topProductsList = React.useMemo(() => {
    const targetSales = filterSalesByTimeframe(topProductsTimeframe);

    const counts: { [name: string]: { count: number; productId: string } } = {};
    targetSales.forEach(sale => {
      (sale.items || []).forEach(item => {
        if (!counts[item.name]) {
          counts[item.name] = { count: 0, productId: item.productId };
        }
        counts[item.name].count += Number(item.quantity) || 1;
      });
    });

    const sorted = Object.entries(counts)
      .map(([name, data]) => {
        const prodMatch = products.find(p => p.id === data.productId || p.name === name);
        return {
          name,
          count: data.count,
          image: prodMatch?.imageUrl || ''
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sorted.map((item, idx) => ({
      rank: idx + 1,
      ...item
    }));
  }, [sales, products, topProductsTimeframe]);

  // 3. Recent Sales Data (Top 5)
  const recentSalesList = React.useMemo(() => {
    if (sales.length === 0) {
      return [];
    }

    // Sort descending by date so the newest sales appear at the top
    const sorted = [...sales].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime());

    return sorted.slice(0, 5).map((sale, idx) => {
      const timeStr = formatDisplayTime(sale.date);
      const ticketNum = `#TKT-${sale.id ? sale.id.slice(-6).toUpperCase() : String(sales.length - idx).padStart(6, '0')}`;

      return {
        ticket: ticketNum,
        client: (sale as any).clientName || 'Cliente general',
        total: Number(sale.total) || 0,
        method: sale.paymentMethod || 'cash',
        time: timeStr
      };
    });
  }, [sales]);

  // 4. Payment Methods Breakdown Data
  const paymentMethodsData = React.useMemo(() => {
    const C = 2 * Math.PI * 35; // Circle circumference with radius 35 ≈ 219.91

    const totals: { [method: string]: number } = {
      cash: 0,
      card: 0,
      transfer: 0,
      other: 0
    };

    sales.forEach(sale => {
      const method = sale.paymentMethod === 'cash' ? 'cash' :
                     sale.paymentMethod === 'card' ? 'card' :
                     sale.paymentMethod === 'transfer' ? 'transfer' : 'other';
      totals[method] += (Number(sale.total) || 0);
    });

    const totalSalesSum = Object.values(totals).reduce((sum, v) => sum + v, 0);

    if (totalSalesSum === 0) {
      return {
        items: [
          { name: 'Efectivo', amount: 0, pct: 0, color: '#0066FF' },
          { name: 'Tarjeta', amount: 0, pct: 0, color: '#10B981' },
          { name: 'Transferencia', amount: 0, pct: 0, color: '#8B5CF6' },
          { name: 'Otro', amount: 0, pct: 0, color: '#F59E0B' }
        ],
        total: 0,
        donutSegments: [{ color: '#e2e8f0', dash: C, offset: 0 }]
      };
    }

    const items = [
      { name: 'Efectivo', amount: totals.cash, pct: Math.round((totals.cash / totalSalesSum) * 100), color: '#0066FF' },
      { name: 'Tarjeta', amount: totals.card, pct: Math.round((totals.card / totalSalesSum) * 100), color: '#10B981' },
      { name: 'Transferencia', amount: totals.transfer, pct: Math.round((totals.transfer / totalSalesSum) * 100), color: '#8B5CF6' },
      { name: 'Otro', amount: totals.other, pct: Math.max(0, 100 - Math.round((totals.cash / totalSalesSum) * 100) - Math.round((totals.card / totalSalesSum) * 100) - Math.round((totals.transfer / totalSalesSum) * 100)), color: '#F59E0B' }
    ];

    let cumulative = 0;
    const donutSegments = items.map(it => {
      const dash = (Math.max(it.pct, 0) / 100) * C;
      const offset = (cumulative / 100) * C;
      cumulative += Math.max(it.pct, 0);
      return { color: it.color, dash, offset };
    });

    return {
      items,
      total: totalSalesSum,
      donutSegments
    };
  }, [sales]);

  return (
    <div id="dashboard-view" className="space-y-6">
      {allowedBranches.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3.5 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-emerald-950">Acceso de operador restringido: </span>
            <span className="text-emerald-800">Solo verá y operará en las sucursales asignadas ({user?.branches?.join(', ') || user?.branch}).</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight">Panel de Control</h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Resumen operacional y métricas clave de {config.storeName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {availableBranches.length > 1 && !allowedBranches.length && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-2xs border border-[#E2E8F0]">
              <Building2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
              <span className="text-xs font-semibold text-[#64748B]">Sede:</span>
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  const match = availableBranches.find(b => b.name === e.target.value);
                  if (match && onSwitchBranch) onSwitchBranch(match.id);
                }}
                className="bg-transparent font-medium text-xs text-[#1F2937] focus:outline-hidden cursor-pointer"
                title="Cambiar sucursal del panel de control"
              >
                {availableBranches.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
                <option value="Todas">Todas (Consolidado)</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-lg shadow-2xs border border-[#E2E8F0]">
            <Clock className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="text-xs text-[#1F2937] font-medium capitalize font-sans">
              {today.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Cash register warning if closed */}
      {!currentShift && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 text-xs">Caja Registradora Cerrada</h3>
              <p className="text-[11px] text-amber-800">Debe realizar la apertura de caja para procesar cobros en el Punto de Venta.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('apertura-cierre')}
            className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs shrink-0"
          >
            Abrir Caja Ahora
          </button>
        </div>
      )}

      {/* Stats KPI Grid */}
      {/* Stats KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Sales */}
        <div 
          onClick={() => onNavigate('historial-ventas')}
          className="bg-white p-3.5 sm:p-5 rounded-lg border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors"
          title="Ver Historial de Ventas"
        >
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-[#64748B] uppercase tracking-wider block truncate">Ventas de Hoy</span>
            <h3 className="text-base sm:text-2xl font-bold text-[#1F2937] font-mono tracking-tight truncate">
              {currency}{todaySalesTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-[#16A34A] font-medium flex items-center gap-0.5 truncate">
              <ArrowUpRight className="w-3 h-3 shrink-0" />
              <span>{todaySales.length} {todaySales.length === 1 ? 'venta' : 'ventas'}</span>
            </span>
          </div>
          <div className="p-2 sm:p-2.5 bg-blue-50 text-[#2563EB] rounded-lg shrink-0 ml-1">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Profit */}
        <div className="bg-white p-3.5 sm:p-5 rounded-lg border border-[#E2E8F0] shadow-xs flex items-center justify-between">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-[#64748B] uppercase tracking-wider block truncate">Ganancia Estimada</span>
            <h3 className="text-base sm:text-2xl font-bold text-[#1F2937] font-mono tracking-tight truncate">
              {currency}{todayProfit.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] sm:text-[11px] text-[#64748B] font-medium truncate block">
              Calculado según costo
            </span>
          </div>
          <div className="p-2 sm:p-2.5 bg-emerald-50 text-[#16A34A] rounded-lg shrink-0 ml-1">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Low Stock */}
        <div 
          onClick={() => onNavigate('inventario')}
          className="bg-white p-3.5 sm:p-5 rounded-lg border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors"
        >
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-[#64748B] uppercase tracking-wider block truncate">Stock Crítico</span>
            <h3 className="text-base sm:text-2xl font-bold text-[#1F2937] font-mono tracking-tight">
              {lowStock.length}
            </h3>
            <span className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-0.5 truncate ${lowStock.length > 0 ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
              {lowStock.length > 0 ? 'Reabastecer' : 'Stock óptimo'}
            </span>
          </div>
          <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ml-1 ${lowStock.length > 0 ? 'bg-rose-50 text-[#DC2626]' : 'bg-slate-50 text-[#64748B]'}`}>
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Expirations */}
        <div 
          onClick={() => onNavigate('vencimientos')}
          className="bg-white p-3.5 sm:p-5 rounded-lg border border-[#E2E8F0] shadow-xs flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors"
        >
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-[#64748B] uppercase tracking-wider block truncate">Vencimientos</span>
            <h3 className="text-base sm:text-2xl font-bold text-[#1F2937] font-mono tracking-tight">
              {expiringSoon.length}
            </h3>
            <span className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-0.5 truncate ${expiringSoon.length > 0 ? 'text-amber-700' : 'text-[#64748B]'}`}>
              {expiringSoon.length > 0 ? `< ${alertDays} días` : 'Sin alertas'}
            </span>
          </div>
          <div className={`p-2 sm:p-2.5 rounded-lg shrink-0 ml-1 ${expiringSoon.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-[#64748B]'}`}>
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (ColSpan: 2) - Exactly matching user screenshot */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 lg:col-span-2 flex flex-col justify-between relative">
          {/* Header with Title and Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
              Ventas de los {timeframe === '7days' ? 'últimos 7 días' : timeframe === '14days' ? 'últimos 14 días' : 'últimos 30 días'}
            </h2>
            
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                  className="appearance-none bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-3.5 pr-8 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
                >
                  <option value="7days">Últimos 7 días</option>
                  <option value="14days">Últimos 14 días</option>
                  <option value="30days">Últimos 30 días</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* SVG Chart Container */}
          <div className="relative w-full overflow-hidden mt-1 pt-2">
            {/* Interactive Tooltip */}
            {hoveredPoint && (
              <div 
                className="absolute pointer-events-none bg-slate-900/95 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700/50 backdrop-blur-xs text-xs z-30 transition-all transform -translate-x-1/2 -translate-y-full mb-3 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  left: `${(hoveredPoint.x / 760) * 100}%`,
                  top: `${(hoveredPoint.y / 290) * 100}%`
                }}
              >
                <div className="font-medium text-slate-300 capitalize text-[10px] pb-1 border-b border-slate-700/80">
                  {hoveredPoint.fullDate}
                </div>
                <div className="pt-1.5 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {currency}{hoveredPoint.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({hoveredPoint.count} {hoveredPoint.count === 1 ? 'venta' : 'ventas'})
                  </span>
                </div>
              </div>
            )}

            <svg
              viewBox="0 0 760 290"
              className="w-full h-auto max-h-[320px] overflow-visible select-none"
            >
              <defs>
                <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066FF" stopOpacity="0.20" />
                  <stop offset="80%" stopColor="#0066FF" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#0066FF" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Y-Axis Horizontal Gridlines and Currency Labels */}
              {trendScale.ticks.map((tick, i) => {
                const tickY = 25 + (i / (trendScale.ticks.length - 1)) * 220;
                return (
                  <g key={i}>
                    <line
                      x1="85"
                      y1={tickY}
                      x2="735"
                      y2={tickY}
                      stroke="#f1f5f9"
                      strokeWidth="1.2"
                    />
                    <text
                      x="75"
                      y={tickY + 4}
                      textAnchor="end"
                      className="fill-slate-500 font-medium font-mono"
                      style={{ fontSize: '11px' }}
                    >
                      {currency} {tick.toLocaleString('es-ES')}
                    </text>
                  </g>
                );
              })}

              {/* Calculate dynamic points */}
              {(() => {
                const points = salesTrendData.map((d, index) => {
                  const x = salesTrendData.length > 1
                    ? 85 + (index / (salesTrendData.length - 1)) * 650
                    : 85 + 325;
                  const fraction = trendScale.max > 0 ? d.total / trendScale.max : 0;
                  const y = 245 - fraction * 220;
                  return { ...d, x, y };
                });

                const linePath = points.map((p, idx) => (idx === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)).join(' ');
                const areaPath = points.length > 0
                  ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} 245 L ${points[0].x.toFixed(1)} 245 Z`
                  : '';

                return (
                  <>
                    {/* Area Under Curve */}
                    {areaPath && (
                      <path
                        d={areaPath}
                        fill="url(#salesTrendGradient)"
                      />
                    )}

                    {/* Blue Stroke Line */}
                    {linePath && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="#0066FF"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* X-Axis Day Labels */}
                    {points.map((p, idx) => (
                      <text
                        key={`label-${idx}`}
                        x={p.x}
                        y="270"
                        textAnchor="middle"
                        className="fill-slate-600 font-semibold tracking-tight"
                        style={{ fontSize: '11px' }}
                      >
                        {p.label}
                      </text>
                    ))}

                    {/* Circle Nodes & Hover Interactions */}
                    {points.map((p, idx) => {
                      const isHovered = hoveredPoint?.label === p.label;
                      return (
                        <g
                          key={`point-${idx}`}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPoint({ label: p.label, fullDate: p.fullDate, total: p.total, count: p.count, x: p.x, y: p.y })}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          {/* Hitbox */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="15"
                            fill="transparent"
                          />
                          
                          {/* Halo on hover */}
                          {isHovered && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="10"
                              fill="#0066FF"
                              fillOpacity="0.25"
                            />
                          )}

                          {/* Data dot */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? "6.5" : "5"}
                            fill="#0066FF"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            className="transition-all duration-150"
                          />
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Operational Highlights (ColSpan: 1) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Estado de Operaciones</h2>
          
          <div className="space-y-4">
            {/* Cash register Status */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <div className="p-2 bg-white rounded-lg shadow-2xs border border-slate-100">
                <CheckCircle className={`w-5 h-5 ${currentShift ? 'text-emerald-500' : 'text-slate-400'}`} />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-slate-800">Caja Registradora</h4>
                <p className="text-[11px] text-slate-500">
                  {currentShift 
                    ? `Abierta con ${currency}${currentShift.initialCash.toFixed(2)}` 
                    : 'Cerrada. No se permiten transacciones.'}
                </p>
                <button
                  onClick={() => onNavigate('apertura-cierre')}
                  className="text-[10px] text-blue-600 hover:underline font-semibold block pt-1"
                >
                  {currentShift ? 'Administrar Turno / Cerrar' : 'Realizar Apertura'}
                </button>
              </div>
            </div>

            {/* Quick Category Insight */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <div className="p-2 bg-white rounded-lg shadow-2xs border border-slate-100">
                <Package className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-slate-800">Catálogo de Productos</h4>
                <p className="text-[11px] text-slate-500">
                  {products.length} productos registrados.
                </p>
                <div className="flex gap-2 pt-1.5">
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium font-mono">
                    Stock Total: {products.reduce((acc, p) => acc + p.stock, 0)} Pzas
                  </span>
                </div>
              </div>
            </div>

            {/* Active Business Type */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              <div className="p-2 bg-white rounded-lg shadow-2xs border border-slate-100">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-slate-800">Moneda & Configuración</h4>
                <p className="text-[11px] text-slate-500">
                  Moneda: {currency} ({config.currency === 'Q' ? 'Quetzales' : config.currency})
                </p>
                <p className="text-[11px] text-slate-500">
                  Negocio: <span className="capitalize font-medium">{config.businessType === 'hardware' ? 'Ferretería' : config.businessType === 'pharmacy' ? 'Farmacia' : config.businessType === 'bookstore' ? 'Librería' : 'General'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Cards Row strictly matching user image */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
        
        {/* Card 1: Ventas por categoría (Top 5) */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Header with Title and Dropdown */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-[#1F2937] text-sm tracking-tight">Ventas por categoría (Top 5)</h3>
              <div className="relative">
                <select
                  value={categoryTimeframe}
                  onChange={(e) => setCategoryTimeframe(e.target.value as any)}
                  className="appearance-none bg-white border border-[#E2E8F0] hover:border-slate-300 rounded-lg pl-2.5 pr-7 py-1 text-xs font-semibold text-[#1F2937] shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] cursor-pointer transition-colors"
                >
                  <option value="today">Hoy</option>
                  <option value="week">Esta semana</option>
                  <option value="month">Este mes</option>
                  <option value="all">Todo</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Horizontal Bar Chart List or Empty State */}
            {topCategoriesData.items.length > 0 ? (
              <div className="space-y-3.5">
                {topCategoriesData.items.map((cat, idx) => {
                  const widthPct = topCategoriesData.max > 0 ? (cat.amount / topCategoriesData.max) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center gap-2.5">
                      <span className="w-16 text-xs font-medium text-[#64748B] truncate text-left shrink-0">
                        {cat.name}
                      </span>
                      <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden flex items-center">
                        <div
                          className="bg-[#2563EB] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(widthPct, 3)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-[#1F2937] shrink-0 text-right min-w-[70px]">
                        {currency}{cat.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-[#64748B]">
                <PieChart className="w-7 h-7 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-medium text-[#1F2937]">Sin ventas en este período</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">Se actualizará al registrar ventas por categoría</p>
              </div>
            )}
          </div>

          {/* Scale Axis at bottom */}
          {topCategoriesData.items.length > 0 && topCategoriesData.ticks.length > 0 && (
            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-[10px] font-mono text-[#64748B] font-semibold pl-16 pr-14 mt-4">
              {topCategoriesData.ticks.map((tick, i) => (
                <span key={i}>{currency}{tick >= 1000 ? `${(tick / 1000).toFixed(0)}K` : tick}</span>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Productos más vendidos (Top 5) */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Header with Title and Dropdown */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-[#1F2937] text-sm tracking-tight">Productos más vendidos (Top 5)</h3>
              <div className="relative">
                <select
                  value={topProductsTimeframe}
                  onChange={(e) => setTopProductsTimeframe(e.target.value as any)}
                  className="appearance-none bg-white border border-[#E2E8F0] hover:border-slate-300 rounded-lg pl-2.5 pr-7 py-1 text-xs font-semibold text-[#1F2937] shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] cursor-pointer transition-colors"
                >
                  <option value="today">Hoy</option>
                  <option value="week">Esta semana</option>
                  <option value="month">Este mes</option>
                  <option value="all">Todo</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Product List or Empty State */}
            {topProductsList.length > 0 ? (
              <div className="divide-y divide-[#E2E8F0]">
                {topProductsList.map((prod, idx) => (
                  <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-semibold text-[#64748B] w-3 text-center shrink-0">
                        {prod.rank}
                      </span>
                      <div className="w-7 h-7 rounded-md bg-[#F8FAFC] flex items-center justify-center overflow-hidden shrink-0 border border-[#E2E8F0] p-0.5">
                        {prod.image ? (
                          <img src={prod.image} alt={prod.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        ) : (
                          <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                      <span className="text-xs font-medium text-[#1F2937] truncate" title={prod.name}>
                        {prod.name}
                      </span>
                    </div>
                    <span className="text-xs font-semibold font-mono text-[#1F2937] shrink-0">
                      {prod.count} uds
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#64748B]">
                <Package className="w-7 h-7 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-medium text-[#1F2937]">Sin ventas en este período</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">Los artículos vendidos aparecerán en este ranking</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Ventas recientes */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Header with Link */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-[#1F2937] text-sm tracking-tight">Ventas recientes</h3>
              <button
                onClick={() => onNavigate('reportes')}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
              >
                Ver todas
              </button>
            </div>

            {/* Table or Empty State */}
            {recentSalesList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
                      <th className="pb-2 font-medium">Ticket</th>
                      <th className="pb-2 font-medium">Cliente</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium text-center">Método</th>
                      <th className="pb-2 font-medium text-right">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {recentSalesList.map((sale, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 font-mono font-medium text-[#1F2937]">
                          {sale.ticket}
                        </td>
                        <td className="py-2 font-medium text-[#64748B] max-w-[85px] truncate">
                          {sale.client}
                        </td>
                        <td className="py-2 font-mono font-bold text-[#1F2937] text-right whitespace-nowrap tabular-nums">
                          {currency}{sale.total.toFixed(2)}
                        </td>
                        <td className="py-2 text-center">
                          <div className="inline-flex items-center justify-center">
                            {sale.method === 'cash' ? (
                              <span className="p-0.5 text-[#16A34A] rounded-sm" title="Efectivo">
                                <Banknote className="w-3.5 h-3.5" />
                              </span>
                            ) : sale.method === 'card' ? (
                              <span className="p-0.5 text-[#2563EB] rounded-sm" title="Tarjeta">
                                <CreditCard className="w-3.5 h-3.5" />
                              </span>
                            ) : sale.method === 'transfer' ? (
                              <span className="p-0.5 text-purple-600 rounded-sm" title="Transferencia">
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="p-0.5 text-amber-600 rounded-sm" title="Otro">
                                <Wallet className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-right font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                          {sale.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-[#64748B]">
                <Receipt className="w-7 h-7 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-medium text-[#1F2937]">Sin ventas recientes</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">Tus ventas del POS aparecerán aquí</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Ventas por método de pago */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs p-4 sm:p-5 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-bold text-[#1F2937] text-sm tracking-tight">Ventas por método de pago</h3>
            </div>

            {/* Centered Donut Graphic */}
            <div className="flex justify-center items-center py-3">
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {paymentMethodsData.donutSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="35"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="21"
                      strokeDasharray={`${seg.dash} ${2 * Math.PI * 35 - seg.dash}`}
                      strokeDashoffset={-seg.offset}
                      className="transition-all duration-500"
                    />
                  ))}
                </svg>
              </div>
            </div>

            {/* Vertical Legend List */}
            <div className="space-y-2.5 text-xs pt-1">
              {paymentMethodsData.items.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <span className="text-slate-700 font-medium truncate text-xs">{m.name}</span>
                  </div>
                  <span className="font-mono text-slate-700 font-semibold whitespace-nowrap text-xs">
                    {currency} {m.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({m.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Total in bold blue */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-4">
            <span className="text-xs font-bold text-slate-800">Total</span>
            <span className="text-sm font-extrabold text-[#0066FF] font-mono">
              {currency} {paymentMethodsData.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
