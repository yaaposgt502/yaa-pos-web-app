import React, { useState, useMemo } from 'react';
import { Shift, Sale, Expense } from '../types';
import { 
  Lock, 
  Unlock, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  History,
  CheckCircle2,
  X,
  FileText,
  Calendar,
  ArrowRight
} from 'lucide-react';

interface CashRegisterProps {
  shifts: Shift[];
  sales: Sale[];
  expenses: Expense[];
  currency: string;
  onSaveShift: (shift: Shift) => Promise<Shift>;
  onRefreshData: () => void;
  onNavigate?: (tab: string) => void;
}

export default function CashRegister({ 
  shifts, 
  sales, 
  expenses, 
  currency, 
  onSaveShift, 
  onRefreshData,
  onNavigate 
}: CashRegisterProps) {
  const [initialCashInput, setInitialCashInput] = useState('');
  const [finalCashInput, setFinalCashInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formObservations, setFormObservations] = useState('');
  const [showShiftDetails, setShowShiftDetails] = useState(false);

  // Find active open shift
  const activeShift = useMemo(() => {
    return shifts.find(s => s.state === 'open');
  }, [shifts]);

  // Sales and expenses registered DURING the active shift
  const shiftMetrics = useMemo(() => {
    if (!activeShift) {
      return { 
        totalSales: 0, 
        totalExpenses: 0, 
        cashSales: 0, 
        cardSales: 0, 
        transferSales: 0, 
        creditSales: 0,
        contadoSales: 0,
        totalIngresos: 0,
        shiftSales: [] as Sale[],
        shiftExpenses: [] as Expense[]
      };
    }
    
    // Filter sales in this shift
    const shiftSales = sales.filter(s => s.shiftId === activeShift.id);
    const totalSales = shiftSales.reduce((acc, s) => acc + s.total, 0);
    const cashSales = shiftSales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.total, 0);
    const cardSales = shiftSales.filter(s => s.paymentMethod === 'card').reduce((acc, s) => acc + s.total, 0);
    const transferSales = shiftSales.filter(s => s.paymentMethod === 'transfer').reduce((acc, s) => acc + s.total, 0);
    const creditSales = shiftSales.filter(s => s.paymentMethod === 'credit').reduce((acc, s) => acc + s.total, 0);

    // Contado sales = cash + card
    const contadoSales = cashSales + cardSales;
    // Total ingresos = contadoSales + transferSales (real funds received)
    const totalIngresos = contadoSales + transferSales;

    // Filter expenses made since shift opening
    const openingTime = new Date(activeShift.openedAt).getTime();
    const shiftExpenses = expenses.filter(e => new Date(e.date).getTime() >= openingTime);
    const totalExpenses = shiftExpenses.reduce((acc, e) => acc + e.amount, 0);

    return { 
      totalSales, 
      totalExpenses, 
      cashSales, 
      cardSales, 
      transferSales, 
      creditSales,
      contadoSales,
      totalIngresos,
      shiftSales,
      shiftExpenses
    };
  }, [activeShift, sales, expenses]);

  // Expected cash in drawer
  const expectedCash = useMemo(() => {
    if (!activeShift) return 0;
    return activeShift.initialCash + shiftMetrics.cashSales - shiftMetrics.totalExpenses;
  }, [activeShift, shiftMetrics]);

  // Handle Opening Shift
  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashVal = parseFloat(initialCashInput);
    if (isNaN(cashVal) || cashVal < 0) {
      setErrorMessage('Monto de apertura inválido');
      return;
    }

    setErrorMessage('');

    const newShift: Shift = {
      id: '', // Server generates UUID
      openedAt: new Date().toISOString(),
      initialCash: cashVal,
      salesTotal: 0,
      expensesTotal: 0,
      state: 'open'
    };

    try {
      await onSaveShift(newShift);
      setInitialCashInput('');
      onRefreshData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al abrir caja');
    }
  };

  // Handle Closing Shift
  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const cashFinalVal = parseFloat(finalCashInput);
    if (isNaN(cashFinalVal) || cashFinalVal < 0) {
      setErrorMessage('Monto de arqueo de cierre inválido');
      return;
    }

    setErrorMessage('');

    const closedShift: Shift = {
      ...activeShift,
      closedAt: new Date().toISOString(),
      finalCash: cashFinalVal,
      salesTotal: shiftMetrics.totalSales,
      expensesTotal: shiftMetrics.totalExpenses,
      state: 'closed'
    };

    try {
      await onSaveShift(closedShift);
      setFinalCashInput('');
      setFormObservations('');
      onRefreshData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cerrar caja');
    }
  };

  return (
    <div id="cash-register-view" className="w-full">
      {activeShift ? (
        /* ACTIVE OPEN SHIFT VIEW - MATCHING THE DESIGN OF THE USER IMAGE */
        <div className="bg-white rounded-3xl shadow-xl border border-slate-150/80 overflow-hidden animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="bg-[#0084FF] text-white px-6 py-5 relative flex justify-between items-center shadow-xs">
            <div className="space-y-0.5">
              <h2 className="font-extrabold text-lg flex items-center gap-2">
                <span className="p-1 bg-white/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-blue-100" />
                </span>
                Cierre de Turno y Arqueo
              </h2>
              <p className="text-xs text-blue-100 font-medium">Verifique los montos antes de cerrar el turno</p>
            </div>
            <button 
              onClick={() => onNavigate?.('dashboard')} 
              className="p-2 hover:bg-white/15 rounded-full text-blue-100 hover:text-white transition-all cursor-pointer"
              title="Volver al Dashboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Two Columns Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8 bg-slate-50/45">
            
            {/* Left Column (col-span-7) */}
            <div id="cash-register-left" className="lg:col-span-7 space-y-6">
              
              {/* 1. BALANCE GENERAL */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                  Balance General
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Caja Inicial */}
                  <div className="bg-white border border-slate-150/70 rounded-2xl p-4 shadow-xs border-l-4 border-blue-500">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Caja Inicial</span>
                    <div className="text-xl font-black text-slate-800 font-mono">
                      {currency} {activeShift.initialCash.toFixed(2)}
                    </div>
                  </div>
                  {/* Total Ingresos */}
                  <div className="bg-white border border-slate-150/70 rounded-2xl p-4 shadow-xs border-l-4 border-emerald-500">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Total Ingresos</span>
                    <div className="text-xl font-black text-emerald-600 font-mono">
                      {currency} {shiftMetrics.totalIngresos.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. DESGLOSE DE VENTAS */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                  Desglose de Ventas
                </div>

                <div className="space-y-3">
                  {/* Ventas al Contado row card */}
                  <div className="bg-white border border-slate-150/70 rounded-2xl p-4 shadow-xs flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1 bg-emerald-50 rounded-lg text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-bold text-slate-700">Ventas al Contado</span>
                    </div>
                    <span className="text-base font-black text-slate-800 font-mono">
                      {currency} {shiftMetrics.contadoSales.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ventas al Crédito */}
                    <div className="bg-white border border-slate-150/70 rounded-2xl p-3.5 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-[11px] font-bold">Ventas al Crédito</span>
                      </div>
                      <div className="text-base font-black text-slate-800 font-mono pl-3.5">
                        {currency} {shiftMetrics.creditSales.toFixed(2)}
                      </div>
                    </div>

                    {/* Gastos del Turno */}
                    <div className="bg-red-50/30 border border-red-100 rounded-2xl p-3.5 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-red-600">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span className="text-[11px] font-bold">Gastos del Turno</span>
                      </div>
                      <div className="text-base font-black text-red-600 font-mono pl-3.5">
                        {currency} {shiftMetrics.totalExpenses.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. MÉTODOS DE PAGO RECIBIDOS */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                  Métodos de Pago Recibidos
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Efectivo */}
                  <div className="bg-white border border-slate-150/70 rounded-2xl p-4 shadow-xs space-y-2 text-center">
                    <span className="text-xs font-bold text-slate-700 block">Efectivo</span>
                    <div className="flex justify-between items-center px-1 text-[10px] font-mono text-slate-400 border-b border-slate-100 pb-1.5">
                      <span className="text-emerald-600">+{currency}{shiftMetrics.cashSales.toFixed(2)}</span>
                      <span className="text-red-500">-{currency}{shiftMetrics.totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="text-xs font-black text-blue-600 font-mono">
                      {currency} {(shiftMetrics.cashSales - shiftMetrics.totalExpenses).toFixed(2)}
                    </div>
                  </div>

                  {/* Tarjeta */}
                  <div className="bg-white border border-slate-150/70 rounded-2xl p-4 shadow-xs space-y-2 text-center">
                    <span className="text-xs font-bold text-slate-700 block">Tarjeta</span>
                    <div className="flex justify-between items-center px-1 text-[10px] font-mono text-slate-400 border-b border-slate-100 pb-1.5">
                      <span className="text-emerald-600">+{currency}{shiftMetrics.cardSales.toFixed(2)}</span>
                      <span className="text-slate-400">-{currency}0.00</span>
                    </div>
                    <div className="text-xs font-black text-blue-600 font-mono">
                      {currency} {shiftMetrics.cardSales.toFixed(2)}
                    </div>
                  </div>

                  {/* Transferencia */}
                  <div className="bg-white border border-slate-150/70 rounded-2xl p-4 shadow-xs space-y-2 text-center">
                    <span className="text-xs font-bold text-slate-700 block">Transferencia</span>
                    <div className="flex justify-between items-center px-1 text-[10px] font-mono text-slate-400 border-b border-slate-100 pb-1.5">
                      <span className="text-emerald-600">+{currency}{shiftMetrics.transferSales.toFixed(2)}</span>
                      <span className="text-slate-400">-{currency}0.00</span>
                    </div>
                    <div className="text-xs font-black text-blue-600 font-mono">
                      {currency} {shiftMetrics.transferSales.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informative Link */}
              <div className="flex justify-center pt-4 border-t border-slate-150/60">
                <button 
                  type="button"
                  onClick={() => setShowShiftDetails(true)}
                  className="flex items-center gap-1.5 text-blue-600 font-extrabold hover:text-blue-800 hover:underline text-xs cursor-pointer transition-all bg-white hover:bg-slate-50 px-4 py-2 rounded-xl border border-slate-150 shadow-xs"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  Ver Informe Profesional Detallado
                </button>
              </div>

            </div>

            {/* Right Column (col-span-5) */}
            <div id="cash-register-right" className="lg:col-span-5 space-y-6">
              
              {/* 1. ARQUEO DE EFECTIVO */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                  Arqueo de Efectivo
                </div>

                <div className="bg-white border border-slate-150/80 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Saldo Inicial:</span>
                    <span className="font-mono font-bold text-slate-800">{currency} {activeShift.initialCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>(+) Ventas Efectivo:</span>
                    <span className="font-mono font-bold text-emerald-600">{currency} {shiftMetrics.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>(+) Adelantos Crédito:</span>
                    <span className="font-mono font-bold text-emerald-600">{currency} 0.00</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>(+) Pagos de Cuotas:</span>
                    <span className="font-mono font-bold text-emerald-600">{currency} 0.00</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>(-) Gastos Efectivo:</span>
                    <span className="font-mono font-bold text-red-500">-{currency} {shiftMetrics.totalExpenses.toFixed(2)}</span>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-3 flex justify-between items-center font-black text-slate-800">
                    <span className="text-xs">Esperado en Caja:</span>
                    <span className="font-mono text-base">{currency} {expectedCash.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 2. EFECTIVO FÍSICO REAL INPUT */}
              <form onSubmit={handleCloseRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Efectivo Físico Real</label>
                  <div className="flex rounded-2xl border-2 border-blue-500 overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-300 transition-all">
                    <div className="bg-blue-600 text-white font-black font-mono px-5 flex items-center justify-center text-sm">
                      {currency}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      placeholder="0.00"
                      value={finalCashInput}
                      onChange={(e) => setFinalCashInput(e.target.value)}
                      className="w-full px-4 py-3 focus:outline-hidden font-mono text-right font-black text-xl text-slate-700 bg-white"
                    />
                  </div>
                  
                  {/* Difference Gray Badge */}
                  <div className="flex justify-end">
                    {(() => {
                      const physical = parseFloat(finalCashInput) || 0;
                      const diff = physical - expectedCash;
                      let badgeColor = "bg-slate-500 text-white";
                      let diffText = `${currency} ${diff.toFixed(2)}`;
                      if (finalCashInput) {
                        if (Math.abs(diff) < 0.01) {
                          badgeColor = "bg-emerald-600 text-white";
                          diffText = "Caja Cuadra (0.00)";
                        } else if (diff > 0) {
                          badgeColor = "bg-blue-600 text-white";
                          diffText = `Sobrante: +${currency}${diff.toFixed(2)}`;
                        } else {
                          badgeColor = "bg-rose-600 text-white";
                          diffText = `Faltante: ${currency}${diff.toFixed(2)}`;
                        }
                      }
                      return (
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shadow-xs ${badgeColor} transition-all`}>
                          {diffText}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* 3. OBSERVACIONES */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Observaciones</label>
                  <textarea
                    placeholder="Justificación de diferencias..."
                    value={formObservations}
                    onChange={(e) => setFormObservations(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-2xl p-3 focus:ring-2 focus:ring-blue-500 focus:outline-hidden min-h-[85px] bg-white text-slate-800 placeholder-slate-400"
                  />
                </div>

                {errorMessage && (
                  <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 font-semibold">
                    {errorMessage}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#f05a30] hover:bg-[#d84a22] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    <Lock className="w-4 h-4 text-white" />
                    CERRAR TURNO
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('dashboard')}
                    className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>

            </div>

          </div>
        </div>
      ) : (
        /* NO ACTIVE SHIFT - CLOSED STATE VIEW WITH FORM TO OPEN AND HISTORIC LIST */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left side: Main Shift Action Console (7 columns) */}
          <div 
            className="lg:col-span-7 bg-white rounded-2xl border shadow-xs p-6 space-y-6"
            style={{ borderColor: '#1E88E5' }}
          >
            
            {/* State Banner */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-0.5">
                <h2 className="font-bold text-slate-800 text-lg">Caja de Cobro</h2>
                <p className="text-xs text-slate-500">Controle el flujo de dinero físico de su tienda.</p>
              </div>
              <div className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 uppercase bg-red-50 text-red-700 border border-red-200">
                <Lock className="w-3.5 h-3.5" /> Cerrada
              </div>
            </div>

            {/* FORM TO OPEN REGISTER */}
            <form onSubmit={handleOpenRegister} className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-2">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                  <Unlock className="w-4 h-4 text-emerald-600" />
                  Apertura de Caja
                </h3>
                <p className="text-xs text-slate-500">
                  Ingrese el efectivo base en caja física antes de iniciar ventas hoy (para dar cambios a clientes).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 uppercase">Fondo de Caja Inicial *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 font-bold font-mono">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    placeholder="0.00"
                    value={initialCashInput}
                    onChange={(e) => setInitialCashInput(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
              </div>

              {errorMessage && <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">{errorMessage}</div>}

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs active:scale-98 transition-all cursor-pointer"
              >
                Iniciar Apertura de Caja
              </button>
            </form>
          </div>

          {/* Right side: Historic closures list (5 columns) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-150 pb-2">
              <History className="w-4 h-4 text-slate-500" />
              Historial de Cierres de Caja
            </h3>

            {shifts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No hay registros de turnos de caja cerrados.</p>
            ) : (
              <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                {shifts.slice().reverse().map((sh) => (
                  <div key={sh.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">
                        {sh.state === 'open' ? 'Turno Actual Activo' : 'Cierre de Turno'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        sh.state === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {sh.state === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-mono">
                      <div>Apertura: {new Date(sh.openedAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      {sh.closedAt && <div>Cierre: {new Date(sh.closedAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono font-bold text-slate-700 bg-white border border-slate-100 rounded-lg p-2 text-center">
                      <div>
                        <span className="text-[8px] text-slate-400 block font-normal uppercase">Inicial</span>
                        {currency}{sh.initialCash.toFixed(2)}
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block font-normal uppercase">Ventas</span>
                        {currency}{(sh.salesTotal || 0).toFixed(2)}
                      </div>
                      {sh.finalCash !== undefined && (
                        <div>
                          <span className="text-[8px] text-slate-400 block font-normal uppercase">Cierre Real</span>
                          {currency}{sh.finalCash.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. DETAILED SHIFT REPORT MODAL */}
      {showShiftDetails && activeShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-150">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-sm">Informe Profesional Detallado del Turno</h3>
              </div>
              <button 
                onClick={() => setShowShiftDetails(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600">
              
              {/* Header Info Banner */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-150/80 rounded-2xl p-4 font-mono">
                <div>
                  <span className="text-slate-400 block uppercase text-[9px] font-bold">Apertura del Turno</span>
                  <span className="font-bold text-slate-800">{new Date(activeShift.openedAt).toLocaleString('es-ES')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[9px] font-bold">Estado de Caja</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <Unlock className="w-3.5 h-3.5 inline" /> ABIERTA Y ACTIVA
                  </span>
                </div>
              </div>

              {/* Transactions list during shift */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm border-b pb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Ventas Realizadas en este Turno ({shiftMetrics.shiftSales.length})
                </h4>
                
                {shiftMetrics.shiftSales.length === 0 ? (
                  <p className="text-slate-400 italic py-2">No se han registrado ventas en este turno.</p>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase font-bold">
                          <th className="py-2 px-3">Hora</th>
                          <th className="py-2 px-3">Concepto / Ítems</th>
                          <th className="py-2 px-3">Método</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {shiftMetrics.shiftSales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                              {new Date(sale.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-sans max-w-[240px] truncate">
                              {sale.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                sale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                sale.paymentMethod === 'card' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                sale.paymentMethod === 'transfer' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {sale.paymentMethod === 'cash' ? 'Efectivo' :
                                 sale.paymentMethod === 'card' ? 'Tarjeta' :
                                 sale.paymentMethod === 'transfer' ? 'Transferencia' : 'Crédito'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                              {currency}{sale.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Expenses list since shift opening */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-sm border-b pb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Egresos / Gastos Registrados en este Turno ({shiftMetrics.shiftExpenses.length})
                </h4>
                
                {shiftMetrics.shiftExpenses.length === 0 ? (
                  <p className="text-slate-400 italic py-2">No se han registrado gastos en este turno.</p>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 uppercase font-bold">
                          <th className="py-2 px-3">Fecha/Hora</th>
                          <th className="py-2 px-3">Descripción / Categoría</th>
                          <th className="py-2 px-3 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {shiftMetrics.shiftExpenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                              {new Date(expense.date).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="font-bold text-slate-700">{expense.description}</span>
                              <span className="text-[10px] text-slate-400 block">{expense.category}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-red-600">
                              -{currency}{expense.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Summary totals block */}
              <div className="bg-indigo-50/30 border border-indigo-100/80 rounded-2xl p-4 space-y-2">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-2">Cuadre del Arqueo Proyectado</h5>
                <div className="grid grid-cols-2 gap-y-1.5 text-[11px] font-mono">
                  <div>(+) Saldo Inicial en Caja:</div>
                  <div className="text-right font-bold text-slate-700">{currency} {activeShift.initialCash.toFixed(2)}</div>
                  <div>(+) Ventas Totales Registradas:</div>
                  <div className="text-right font-bold text-slate-700">{currency} {shiftMetrics.totalSales.toFixed(2)}</div>
                  <div className="pl-3 text-slate-400">└─ Ventas en Efectivo:</div>
                  <div className="text-right text-emerald-600">+{currency} {shiftMetrics.cashSales.toFixed(2)}</div>
                  <div className="pl-3 text-slate-400">└─ Ventas con Tarjeta:</div>
                  <div className="text-right text-slate-500">+{currency} {shiftMetrics.cardSales.toFixed(2)}</div>
                  <div className="pl-3 text-slate-400">└─ Ventas con Transferencia:</div>
                  <div className="text-right text-slate-500">+{currency} {shiftMetrics.transferSales.toFixed(2)}</div>
                  <div className="pl-3 text-slate-400">└─ Ventas al Crédito:</div>
                  <div className="text-right text-slate-500">+{currency} {shiftMetrics.creditSales.toFixed(2)}</div>
                  <div className="text-red-600">(-) Egresos / Gastos Totales:</div>
                  <div className="text-right font-bold text-red-600">-{currency} {shiftMetrics.totalExpenses.toFixed(2)}</div>
                  
                  <div className="border-t border-slate-200/80 pt-1.5 font-bold text-slate-800 text-xs">Efectivo Neto Esperado:</div>
                  <div className="border-t border-slate-200/80 pt-1.5 font-bold text-blue-700 text-xs text-right">
                    {currency} {expectedCash.toFixed(2)}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <FileText className="w-4 h-4" />
                Imprimir Informe
              </button>
              <button
                type="button"
                onClick={() => setShowShiftDetails(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
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
