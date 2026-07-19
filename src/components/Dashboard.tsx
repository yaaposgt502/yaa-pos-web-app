import React from 'react';
import { Product, Sale, Expense, Shift, AppConfig } from '../types';
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
  Inbox,
  BarChart3,
  PieChart
} from 'lucide-react';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  shifts: Shift[];
  config: AppConfig;
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ products, sales, expenses, shifts, config, onNavigate }: DashboardProps) {
  // Calculations
  const currency = config.currency || 'Q';
  
  // Today's boundaries
  const today = new Date();
  const todayStr = today.toDateString();

  const todaySales = sales.filter(s => new Date(s.date).toDateString() === todayStr);
  const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.total, 0);
  const todayProfit = todaySales.reduce((acc, s) => acc + s.profit, 0);

  const todayExpenses = expenses.filter(e => new Date(e.date).toDateString() === todayStr);
  const todayExpensesTotal = todayExpenses.reduce((acc, e) => acc + e.amount, 0);

  const lowStock = products.filter(p => p.stock <= p.minStock);
  
  // Expiring items in the alert window
  const now = Date.now();
  const alertDays = config.alertDaysBeforeExpiration || 30;
  const warningLimit = now + alertDays * 24 * 3600 * 1000;
  
  const expiringSoon = products.filter(p => {
    if (!p.expirationDate) return false;
    const exp = new Date(p.expirationDate).getTime();
    return exp <= warningLimit && exp > now;
  });

  // Current Shift Status
  const currentShift = shifts.find(s => s.state === 'open');

  // --- Data computation for new charts ---
  
  // Top Selling Products
  const topProductsData = React.useMemo(() => {
    if (sales.length === 0) {
      // Mock data matching the image when there is no sales history yet
      return [
        { name: "Whisky JackDaniel's", quantity: 32, color: '#1c3b69' },
        { name: "Vodka Absolut", quantity: 11, color: '#fca366' },
        { name: "Preparado", quantity: 8, color: '#59c2ce' }
      ];
    }

    const counts: { [name: string]: number } = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        counts[item.name] = (counts[item.name] || 0) + item.quantity;
      });
    });

    const sorted = Object.entries(counts)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    const colors = ['#1c3b69', '#fca366', '#59c2ce'];
    return sorted.map((item, index) => ({
      ...item,
      color: colors[index % colors.length]
    }));
  }, [sales]);

  // Max value for Top Products chart scale
  const barChartScale = React.useMemo(() => {
    const maxVal = Math.max(...topProductsData.map(p => p.quantity), 10);
    const roundedMax = Math.ceil(maxVal / 5) * 5;
    const ticks = [];
    for (let i = 5; i >= 0; i--) {
      ticks.push(Math.round((roundedMax / 5) * i));
    }
    return { ticks, max: roundedMax };
  }, [topProductsData]);

  // Sales by Category
  const categorySalesData = React.useMemo(() => {
    if (sales.length === 0) {
      // Mock categories matching the image when empty
      return [
        { name: 'Whisky', amount: 1800, pct: 55, color: '#1c3b69' },
        { name: 'Vodka', amount: 750, pct: 23, color: '#59c2ce' },
        { name: 'Preparado', amount: 460, pct: 14, color: '#fca366' },
        { name: 'Sin categoría', amount: 100, pct: 3, color: '#fb7a75' },
        { name: 'Otros', amount: 100, pct: 3, color: '#9bd1f4' },
        { name: 'Promociones', amount: 70, pct: 2, color: '#fcc87d' }
      ];
    }

    // Build product id/name to category lookup
    const prodToCat: { [idOrName: string]: string } = {};
    products.forEach(p => {
      const cat = p.category ? p.category.trim() : '';
      if (cat) {
        prodToCat[p.id] = cat;
        prodToCat[p.name] = cat;
      }
    });

    const catTotals: { [category: string]: number } = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const cat = prodToCat[item.productId] || prodToCat[item.name] || 'Sin categoría';
        catTotals[cat] = (catTotals[cat] || 0) + (item.quantity * item.price);
      });
    });

    const list = Object.entries(catTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const totalAmount = list.reduce((acc, c) => acc + c.amount, 0) || 1;

    const colors = ['#1c3b69', '#59c2ce', '#fca366', '#fb7a75', '#9bd1f4', '#fcc87d'];
    return list.map((item, index) => {
      const pct = Math.round((item.amount / totalAmount) * 100);
      return {
        ...item,
        pct,
        color: colors[index % colors.length]
      };
    });
  }, [sales, products]);

  // Conic-gradient background for the donut chart
  const donutGradient = React.useMemo(() => {
    if (categorySalesData.length === 0) {
      return 'conic-gradient(#e2e8f0 0% 100%)';
    }
    const parts: string[] = [];
    let cumulative = 0;
    categorySalesData.forEach(cat => {
      const start = cumulative;
      cumulative += cat.pct;
      parts.push(`${cat.color} ${start}% ${cumulative}%`);
    });
    if (cumulative < 100 && categorySalesData.length > 0) {
      parts.push(`#e2e8f0 ${cumulative}% 100%`);
    }
    return `conic-gradient(${parts.join(', ')})`;
  }, [categorySalesData]);

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Panel de Control</h1>
          <p className="text-sm text-slate-500">Bienvenido a {config.storeName}. Resumen de actividades de hoy.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-100">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-600 font-medium font-mono">
            {today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Cash register warning if closed */}
      {!currentShift && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 text-sm">La Caja Registradora está Cerrada</h3>
              <p className="text-xs text-amber-700">Debe realizar la apertura de caja para poder registrar nuevas ventas en el Punto de Venta.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('apertura-cierre')}
            className="text-xs font-semibold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
          >
            Abrir Caja Ahora
          </button>
        </div>
      )}

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ventas de Hoy</span>
            <h3 className="text-2xl font-bold text-slate-800 font-mono">
              {currency}{todaySalesTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              {todaySales.length} transacciones
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ganancia Estimada</span>
            <h3 className="text-2xl font-bold text-slate-800 font-mono">
              {currency}{todayProfit.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Basado en costo de catálogo
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock */}
        <div 
          onClick={() => onNavigate('inventario')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-red-200 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Stock Crítico</span>
            <h3 className="text-2xl font-bold text-slate-800 font-mono">
              {lowStock.length}
            </h3>
            <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${lowStock.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              {lowStock.length > 0 ? 'Requiere reabastecimiento' : 'Todo en orden'}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${lowStock.length > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Expirations */}
        <div 
          onClick={() => onNavigate('vencimientos')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-200 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Vencimientos</span>
            <h3 className="text-2xl font-bold text-slate-800 font-mono">
              {expiringSoon.length}
            </h3>
            <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${expiringSoon.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {expiringSoon.length > 0 ? `Vencen en < ${alertDays} días` : 'Ninguno cercano'}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${expiringSoon.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales (ColSpan: 2) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Últimas Ventas de Hoy</h2>
            <button 
              onClick={() => onNavigate('reportes')} 
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              Ver todos los reportes
            </button>
          </div>

          {todaySales.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Inbox className="w-8 h-8 text-slate-300" />
              <p className="text-sm">No se han registrado ventas el día de hoy.</p>
              <button
                onClick={() => onNavigate('punto-de-venta')}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir a Punto de Venta
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-medium uppercase">
                    <th className="py-2">Hora</th>
                    <th className="py-2">Artículos</th>
                    <th className="py-2">Pago</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {todaySales.slice(-5).reverse().map((sale) => (
                    <tr key={sale.id} className="text-slate-700">
                      <td className="py-3 font-mono text-xs">
                        {new Date(sale.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 max-w-[200px] truncate font-medium">
                        {sale.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                      </td>
                      <td className="py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${
                          sale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700' :
                          sale.paymentMethod === 'card' ? 'bg-blue-50 text-blue-700' :
                          sale.paymentMethod === 'transfer' ? 'bg-purple-50 text-purple-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {sale.paymentMethod === 'cash' ? 'Efectivo' :
                           sale.paymentMethod === 'card' ? 'Tarjeta' :
                           sale.paymentMethod === 'transfer' ? 'Transferencia' : 'Crédito'}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold font-mono">
                        {currency}{sale.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      {/* Visual Charts Row matching user image */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        
        {/* Chart 1: Productos Más Vendidos */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-[#0c5c3c] py-3.5 px-5 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-white" />
            <h3 className="font-bold text-white text-xs sm:text-sm tracking-wide">Productos Más Vendidos</h3>
          </div>
          
          {/* Content */}
          <div className="p-6 flex-1 flex flex-col justify-between bg-white">
            <div className="relative h-60 w-full mt-2 flex items-end">
              {/* Y-Axis scale numbers & horizontal gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-400 font-bold pr-2">
                {barChartScale.ticks.map((tick, i) => (
                  <div key={i} className="w-full flex items-center gap-3">
                    <span className="w-6 text-right font-mono">{tick}</span>
                    <div className="flex-1 border-t border-slate-100" />
                  </div>
                ))}
              </div>

              {/* Bars container */}
              <div className="flex-1 flex justify-around items-end h-full pl-10 pr-2 z-10">
                {topProductsData.map((prod, index) => {
                  const heightPercent = barChartScale.max > 0 ? (prod.quantity / barChartScale.max) * 100 : 0;
                  return (
                    <div key={index} className="flex flex-col items-center group relative w-1/3">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                        {prod.quantity} unidades
                      </div>

                      {/* Bar */}
                      <div 
                        style={{ 
                          height: `${Math.max(heightPercent, 4)}%`,
                          backgroundColor: prod.color 
                        }}
                        className="w-16 rounded-t-lg transition-all duration-300 hover:opacity-90 shadow-2xs cursor-pointer"
                      />

                      {/* Label */}
                      <span className="text-[10px] font-bold text-slate-500 mt-3 truncate w-full text-center px-1" title={prod.name}>
                        {prod.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Ventas por Categoría */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-[#2b4260] py-3.5 px-5 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-white" />
            <h3 className="font-bold text-white text-xs sm:text-sm tracking-wide">Ventas por Categoría</h3>
          </div>
          
          {/* Content */}
          <div className="p-6 flex-1 flex flex-col items-center justify-center bg-white">
            <div className="flex flex-col items-center justify-center py-4 w-full">
              {/* Donut container */}
              <div 
                className="relative w-44 h-44 rounded-full flex items-center justify-center shadow-xs" 
                style={{ background: donutGradient }}
              >
                {/* Donut center with the warm sand color from the user's image */}
                <div className="absolute w-28 h-28 bg-[#fce9db] rounded-full flex flex-col items-center justify-center shadow-inner border border-slate-100">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Total</span>
                  <span className="text-sm font-black text-slate-800 font-mono">
                    {sales.length > 0 ? `${config.currency || 'Q'}${sales.reduce((acc, s) => acc + s.total, 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : 'Demo'}
                  </span>
                </div>
              </div>

              {/* Legends matching image style */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2.5 mt-8 w-full max-w-md">
                {categorySalesData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                    <span 
                      className="w-5 h-2.5 rounded-xs inline-block" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span>{item.name}</span>
                    {sales.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono font-medium">({item.pct}%)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
