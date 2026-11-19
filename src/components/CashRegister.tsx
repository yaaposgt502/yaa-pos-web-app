import React, { useState, useMemo, useEffect } from 'react';
import { esc } from '../utils/escapeHtml';
import { Shift, Sale, Expense, User, AppConfig, Branch } from '../types';
import { isItemInBranch } from '../utils/branchHelper';
import { parseSafeDate, formatDisplayDateTime } from '../utils/dateHelper';
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
  ArrowRight,
  Printer,
  Building2
} from 'lucide-react';

interface CashRegisterProps {
  shifts: Shift[];
  sales: Sale[];
  expenses: Expense[];
  currency: string;
  onSaveShift: (shift: Shift) => Promise<Shift>;
  onRefreshData: () => void;
  onNavigate?: (tab: string) => void;
  user?: User | null;
  config?: AppConfig;
  activeBranchName?: string;
  branches?: Branch[];
  onSwitchBranch?: (branchId: string) => void;
}

export default function CashRegister({ 
  shifts, 
  sales, 
  expenses, 
  currency, 
  onSaveShift, 
  onRefreshData,
  onNavigate,
  user,
  config,
  activeBranchName,
  branches,
  onSwitchBranch
}: CashRegisterProps) {
  const [initialCashInput, setInitialCashInput] = useState('');
  const [finalCashInput, setFinalCashInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formObservations, setFormObservations] = useState('');
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [selectedShiftForTicket, setSelectedShiftForTicket] = useState<Shift | null>(null);

  const availableBranches = useMemo(() => {
    return branches || config?.branches || [];
  }, [branches, config?.branches]);

  const userAllowedBranches = useMemo(() => {
    if (!user?.isOperator) return [];
    if (user.branches && user.branches.length > 0) return user.branches;
    if (user.branch && user.branch !== 'Todas') return user.branch.split(',').map(s => s.trim());
    return [];
  }, [user]);

  const defaultBranch = useMemo(() => {
    if (activeBranchName) return activeBranchName;
    if (userAllowedBranches.length > 0) return userAllowedBranches[0];
    if (config?.activeBranchId && availableBranches.length > 0) {
      const b = availableBranches.find(br => br.id === config.activeBranchId);
      if (b) return b.name;
    }
    return availableBranches[0]?.name || '';
  }, [activeBranchName, userAllowedBranches, config?.activeBranchId, availableBranches]);

  const [selectedBranch, setSelectedBranch] = useState<string>(defaultBranch);

  useEffect(() => {
    if (activeBranchName) {
      setSelectedBranch(activeBranchName);
    }
  }, [activeBranchName]);

  // Date and Time formatter matching DD/MM/YYYY HH:mm
  const formatShiftDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return formatDisplayDateTime(dateStr);
  };

  // Helper to calculate cash sales for past shifts
  const getShiftCashSales = (sh: Shift): number => {
    if (sh.cashSales !== undefined) return sh.cashSales;
    const byShiftId = sales.filter(s => s.shiftId === sh.id && s.paymentMethod === 'cash');
    if (byShiftId.length > 0) {
      return byShiftId.reduce((acc, s) => acc + s.total, 0);
    }
    const start = parseSafeDate(sh.openedAt).getTime();
    const end = sh.closedAt ? parseSafeDate(sh.closedAt).getTime() : Date.now();
    const byDate = sales.filter(s => {
      const t = parseSafeDate(s.date).getTime();
      return t >= start && t <= end && s.paymentMethod === 'cash';
    });
    if (byDate.length > 0) {
      return byDate.reduce((acc, s) => acc + s.total, 0);
    }
    return sh.salesTotal || 0;
  };

  // Computed shifts to display (only real shifts; no sample data)
  const displayShifts = useMemo(() => {
    let list = shifts || [];
    
    // Independent shifts per branch
    if (user?.isOperator && userAllowedBranches.length > 0) {
      list = list.filter(sh => {
        if (sh.branch) {
          return userAllowedBranches.some(name => name.toLowerCase().trim() === sh.branch?.toLowerCase().trim());
        }
        return true;
      });
    } else if (selectedBranch && selectedBranch !== 'Todas') {
      list = list.filter(sh => isItemInBranch(sh.branch, selectedBranch, availableBranches));
    }

    // Sort chronologically ascending to assign proper shift numbers (Caja #1, Caja #2, Caja #3)
    const sortedAsc = [...list].sort((a, b) => parseSafeDate(a.openedAt).getTime() - parseSafeDate(b.openedAt).getTime());
    
    const withNumbers = sortedAsc.map((sh, idx) => ({
      ...sh,
      shiftNumber: sh.shiftNumber || (idx + 1),
      cashierName: sh.cashierName || user?.name || 'Cajero'
    }));

    // Return reversed so newest shift is on top (Caja #3, Caja #2, Caja #1) exactly as shown in reference image
    return withNumbers.reverse();
  }, [shifts, user, userAllowedBranches, selectedBranch, availableBranches]);

  // Direct 80mm printer output helper
  const print80mmReceipt = (sh: Shift) => {
    const cashSales = sh.cashSales !== undefined ? sh.cashSales : getShiftCashSales(sh);
    const expected = sh.initialCash + cashSales - (sh.expensesTotal || 0);
    const counted = sh.finalCash !== undefined ? sh.finalCash : expected;
    const diff = counted - expected;
    const isExact = Math.abs(diff) < 0.01;
    const cashier = sh.cashierName || user?.name || 'Cajero';
    const store = config?.storeName || 'MI NEGOCIO / FARMACIA';

    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Corte de Caja 80mm - Caja #${sh.shiftNumber || 1}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 5mm 2mm;
              font-size: 11px;
              line-height: 1.35;
              color: #000;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .border-top { border-top: 1px dashed #000; padding-top: 5px; margin-top: 6px; }
            .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 6px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
            .signature { margin-top: 30px; border-top: 1px solid #000; width: 65%; margin-left: auto; margin-right: auto; }
          </style>
        </head>
        <body>
          <div class="text-center bold" style="font-size: 13px;">${esc(store)}</div>
          <div class="text-center" style="font-size: 10px;">CORTE DE CAJA / ARQUEO</div>
          <div class="text-center bold" style="font-size: 12px; margin: 4px 0;">CAJA #${sh.shiftNumber || 1}</div>
          
          <div class="border-top border-bottom" style="font-size: 10px;">
            <div class="row"><span>Cajero:</span><span class="bold">${esc(cashier)}</span></div>
            <div class="row"><span>Apertura:</span><span>${formatShiftDate(sh.openedAt)}</span></div>
            <div class="row"><span>Cierre:</span><span>${formatShiftDate(sh.closedAt)}</span></div>
            <div class="row"><span>Estado:</span><span class="bold">${sh.state === 'open' ? 'ABIERTA' : 'CERRADA'}</span></div>
          </div>

          <div class="border-bottom">
            <div class="row"><span>(+) Fondo Inicial:</span><span class="bold">${esc(currency)} ${sh.initialCash.toFixed(2)}</span></div>
            <div class="row"><span>(+) Ventas Efectivo:</span><span class="bold">${esc(currency)} ${cashSales.toFixed(2)}</span></div>
            <div class="row"><span>(-) Gastos Turno:</span><span class="bold">${esc(currency)} ${(sh.expensesTotal || 0).toFixed(2)}</span></div>
          </div>

          <div class="border-bottom">
            <div class="row"><span>Efectivo Esperado:</span><span class="bold">${esc(currency)} ${expected.toFixed(2)}</span></div>
            <div class="row bold" style="font-size: 12px;"><span>Efectivo Contado:</span><span>${esc(currency)} ${counted.toFixed(2)}</span></div>
            <div class="row bold">
              <span>Diferencia:</span>
              <span>${isExact ? 'Exacto (0.00)' : (diff > 0 ? `+${esc(currency)}${diff.toFixed(2)} (Sobrante)` : `-${esc(currency)}${Math.abs(diff).toFixed(2)} (Faltante)`)}</span>
            </div>
          </div>

          <div class="text-center" style="margin-top: 25px;">
            <div class="signature"></div>
            <div style="font-size: 9px; margin-top: 4px;">Firma del Responsable</div>
            <div style="font-size: 8px; margin-top: 10px; color: #555;">Comprobante de Caja 80mm - Yaa POS</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Find active open shift FOR THIS BRANCH
  const activeShift = useMemo(() => {
    return shifts.find(s => s.state === 'open' && isItemInBranch(s.branch, selectedBranch, availableBranches));
  }, [shifts, selectedBranch, availableBranches]);

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
    
    const targetBranch = activeShift.branch || selectedBranch;

    // Filter sales in this shift strictly for this branch
    const shiftSales = sales.filter(s => 
      s.shiftId === activeShift.id && 
      isItemInBranch(s.branch, targetBranch, availableBranches)
    );
    const totalSales = shiftSales.reduce((acc, s) => acc + s.total, 0);
    const cashSales = shiftSales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.total, 0);
    const cardSales = shiftSales.filter(s => s.paymentMethod === 'card').reduce((acc, s) => acc + s.total, 0);
    const transferSales = shiftSales.filter(s => s.paymentMethod === 'transfer').reduce((acc, s) => acc + s.total, 0);
    const creditSales = shiftSales.filter(s => s.paymentMethod === 'credit').reduce((acc, s) => acc + s.total, 0);

    // Contado sales = cash + card
    const contadoSales = cashSales + cardSales;
    // Total ingresos = contadoSales + transferSales (real funds received)
    const totalIngresos = contadoSales + transferSales;

    // Filter expenses made since shift opening FOR THIS BRANCH ONLY
    const openingTime = parseSafeDate(activeShift.openedAt).getTime();
    const shiftExpenses = expenses.filter(e => {
      const matchBranch = isItemInBranch(e.branch, targetBranch, availableBranches);
      return matchBranch && parseSafeDate(e.date).getTime() >= openingTime;
    });
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
  }, [activeShift, selectedBranch, sales, expenses, availableBranches]);

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

    const shiftBranch = selectedBranch || (availableBranches[0]?.name || '');

    const newShift: Shift = {
      id: '', // Server generates UUID
      openedAt: new Date().toISOString(),
      initialCash: cashVal,
      salesTotal: 0,
      expensesTotal: 0,
      state: 'open',
      cashierName: user?.name || 'Cajero',
      branch: shiftBranch,
      shiftNumber: (displayShifts.length || 0) + 1
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
      cashSales: shiftMetrics.cashSales,
      expensesTotal: shiftMetrics.totalExpenses,
      state: 'closed',
      cashierName: activeShift.cashierName || user?.name || 'Cajero',
      observations: formObservations.trim() || undefined
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

  // Table view matching the user's reference image exactly
  const renderHistoricShiftsTable = () => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
      <h3 className="font-extrabold text-slate-800 text-sm sm:text-base tracking-tight">
        Historial de Turnos de Caja y Arqueos Anteriores
      </h3>

      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="w-full text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="border-b border-slate-150 text-[10px] sm:text-[11px] font-extrabold text-slate-600 uppercase tracking-wider bg-slate-50/50">
              <th className="py-3 px-4">TURNO / CAJERO</th>
              <th className="py-3 px-4">SUCURSAL</th>
              <th className="py-3 px-4">APERTURA</th>
              <th className="py-3 px-4">CIERRE</th>
              <th className="py-3 px-4 text-center">FONDO INICIAL</th>
              <th className="py-3 px-4 text-center">VENTAS EFECTIVO</th>
              <th className="py-3 px-4 text-center">EFECTIVO CONTADO</th>
              <th className="py-3 px-4 text-center">DIFERENCIA</th>
              <th className="py-3 px-4 text-center">COMPROBANTE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {displayShifts.map((sh) => {
              const cashSales = sh.cashSales !== undefined ? sh.cashSales : getShiftCashSales(sh);
              const expected = sh.initialCash + cashSales - (sh.expensesTotal || 0);
              const counted = sh.finalCash !== undefined ? sh.finalCash : expected;
              const diff = counted - expected;
              const isExact = Math.abs(diff) < 0.01;

              return (
                <tr key={sh.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-800 text-xs sm:text-sm">
                      Caja #{sh.shiftNumber}
                    </div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      {sh.cashierName}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {sh.branch || 'Principal'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-xs font-normal">
                    {formatShiftDate(sh.openedAt)}
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-xs font-normal">
                    {sh.closedAt ? (
                      formatShiftDate(sh.closedAt)
                    ) : (
                      <span className="text-emerald-600 font-bold">En curso</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700">
                    {currency} {sh.initialCash.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono text-xs font-bold text-slate-800">
                    {currency} {cashSales.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono text-xs font-black text-slate-900">
                    {currency} {counted.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    {isExact ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6f7ef] text-[#0d824d]">
                        Exacto
                      </span>
                    ) : diff > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                        +{currency}{diff.toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
                        -{currency}{Math.abs(diff).toFixed(2)}
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedShiftForTicket(sh)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-slate-200 shadow-2xs active:scale-95"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>Corte 80mm</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div id="cash-register-view" className="w-full space-y-6">
      {/* Branch selector & Independent Movements Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Caja Registradora por Sucursal</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              {selectedBranch}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeShift ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {activeShift ? 'Turno Abierto' : 'Caja Cerrada'}
              </span>
            </h2>
          </div>
        </div>

        {availableBranches.length > 1 && !userAllowedBranches.length && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Cambiar sede de caja:</label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                const match = availableBranches.find(b => b.name === e.target.value);
                if (match && onSwitchBranch) onSwitchBranch(match.id);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              {availableBranches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeShift ? (
        /* ACTIVE OPEN SHIFT VIEW - MATCHING THE DESIGN OF THE USER IMAGE */
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-xs border border-[#E2E8F0] overflow-hidden animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="bg-[#172B4D] text-white px-6 py-4 relative flex justify-between items-center shadow-xs">
            <div className="space-y-0.5">
              <h2 className="font-bold text-base flex items-center gap-2">
                <span className="p-1 bg-white/10 rounded-md">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                </span>
                Cierre de Turno y Arqueo
              </h2>
              <p className="text-xs text-slate-300 font-normal">Verifique los montos de efectivo físico antes de finalizar el turno</p>
            </div>
            <button 
              onClick={() => onNavigate?.('dashboard')} 
              className="p-1.5 hover:bg-white/15 rounded-md text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Volver al Dashboard"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Two Columns Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-6 bg-slate-50/50">
            
            {/* Left Column (col-span-7) */}
            <div id="cash-register-left" className="lg:col-span-7 space-y-5">
              
              {/* 1. BALANCE GENERAL */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] tracking-wider uppercase">
                  <span className="w-1 h-3 bg-[#2563EB] rounded-full"></span>
                  Balance General
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Caja Inicial */}
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-2xs border-l-4 border-l-[#2563EB]">
                    <span className="text-xs font-semibold text-[#64748B] block mb-1">Caja Inicial</span>
                    <div className="text-xl font-bold text-[#1F2937] font-mono tracking-tight">
                      {currency}{activeShift.initialCash.toFixed(2)}
                    </div>
                  </div>
                  {/* Total Ingresos */}
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-2xs border-l-4 border-l-[#16A34A]">
                    <span className="text-xs font-semibold text-[#64748B] block mb-1">Total Ingresos</span>
                    <div className="text-xl font-bold text-[#16A34A] font-mono tracking-tight">
                      {currency}{shiftMetrics.totalIngresos.toFixed(2)}
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
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] tracking-wider uppercase">
                  <span className="w-1 h-3 bg-[#2563EB] rounded-full"></span>
                  Arqueo de Efectivo
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-2xs space-y-2.5">
                  <div className="flex justify-between items-center text-xs text-[#64748B]">
                    <span>Saldo Inicial:</span>
                    <span className="font-mono font-semibold text-[#1F2937]">{currency}{activeShift.initialCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#64748B]">
                    <span>(+) Ventas Efectivo:</span>
                    <span className="font-mono font-semibold text-[#16A34A]">+{currency}{shiftMetrics.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#64748B]">
                    <span>(+) Adelantos Crédito:</span>
                    <span className="font-mono font-semibold text-[#16A34A]">+{currency}0.00</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#64748B]">
                    <span>(+) Pagos de Cuotas:</span>
                    <span className="font-mono font-semibold text-[#16A34A]">+{currency}0.00</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#64748B]">
                    <span>(-) Gastos Efectivo:</span>
                    <span className="font-mono font-semibold text-[#DC2626]">-{currency}{shiftMetrics.totalExpenses.toFixed(2)}</span>
                  </div>
                  
                  <div className="border-t border-[#E2E8F0] pt-2.5 flex justify-between items-center font-bold text-[#1F2937]">
                    <span className="text-xs">Esperado en Caja:</span>
                    <span className="font-mono text-base">{currency}{expectedCash.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 2. EFECTIVO FÍSICO REAL INPUT */}
              <form onSubmit={handleCloseRegister} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1F2937]">Efectivo Físico Contado</label>
                  <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden bg-white shadow-2xs focus-within:ring-1 focus-within:ring-[#2563EB] transition-all">
                    <div className="bg-slate-100 text-[#1F2937] font-bold font-mono px-4 flex items-center justify-center text-xs border-r border-[#E2E8F0]">
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
                      className="w-full px-3.5 py-2.5 focus:outline-hidden font-mono text-right font-bold text-lg text-[#1F2937] bg-white"
                    />
                  </div>
                  
                  {/* Difference Gray Badge */}
                  <div className="flex justify-end pt-1">
                    {(() => {
                      const physical = parseFloat(finalCashInput) || 0;
                      const diff = physical - expectedCash;
                      let badgeColor = "bg-slate-100 text-[#64748B] border border-[#E2E8F0]";
                      let diffText = `${currency}${diff.toFixed(2)}`;
                      if (finalCashInput) {
                        if (Math.abs(diff) < 0.01) {
                          badgeColor = "bg-emerald-50 text-[#16A34A] border border-emerald-200";
                          diffText = "Caja Cuadra (0.00)";
                        } else if (diff > 0) {
                          badgeColor = "bg-blue-50 text-[#2563EB] border border-blue-200";
                          diffText = `Sobrante: +${currency}${diff.toFixed(2)}`;
                        } else {
                          badgeColor = "bg-rose-50 text-[#DC2626] border border-rose-200";
                          diffText = `Faltante: -${currency}${Math.abs(diff).toFixed(2)}`;
                        }
                      }
                      return (
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold ${badgeColor} transition-all`}>
                          {diffText}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* 3. OBSERVACIONES */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1F2937]">Observaciones / Justificación</label>
                  <textarea
                    placeholder="Justificación de diferencias o notas de turno..."
                    value={formObservations}
                    onChange={(e) => setFormObservations(e.target.value)}
                    className="w-full text-xs border border-[#E2E8F0] rounded-lg p-2.5 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden min-h-[70px] bg-white text-[#1F2937] placeholder-slate-400"
                  />
                </div>

                {errorMessage && (
                  <div className="text-xs text-[#DC2626] bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">
                    {errorMessage}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-white" />
                    Cerrar Turno de Caja
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('dashboard')}
                    className="w-full py-2 text-[#64748B] hover:text-[#1F2937] text-xs font-medium transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>

            </div>

          </div>
        </div>
        {renderHistoricShiftsTable()}
      </div>
    ) : (
        /* NO ACTIVE SHIFT - CLOSED STATE VIEW WITH FORM TO OPEN AND HISTORIC LIST */
        <div className="space-y-6">
          
          {/* Main Shift Action Console */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs p-5 space-y-5 max-w-xl">
            
            {/* State Banner */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3.5">
              <div className="space-y-0.5">
                <h2 className="font-bold text-[#1F2937] text-base">Caja de Cobro</h2>
                <p className="text-xs text-[#64748B]">Control de turno y flujo de efectivo para ventas presenciales.</p>
              </div>
              <div className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 uppercase bg-rose-50 text-[#DC2626] border border-rose-200">
                <Lock className="w-3.5 h-3.5" /> Cerrada
              </div>
            </div>

            {/* FORM TO OPEN REGISTER */}
            <form onSubmit={handleOpenRegister} className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-[#E2E8F0] p-3.5 rounded-lg space-y-1">
                <h3 className="font-semibold text-xs text-[#1F2937] flex items-center gap-1.5">
                  <Unlock className="w-4 h-4 text-[#16A34A]" />
                  Apertura de Caja
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Ingrese el fondo de efectivo inicial en gaveta para dar cambio antes de iniciar operaciones en este turno.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Fondo de Caja Inicial *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#64748B] font-bold font-mono text-xs">
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
                    className="w-full pl-8 pr-3.5 py-2 rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] font-mono font-bold text-xs text-[#1F2937] bg-white"
                  />
                </div>
              </div>

              {errorMessage && <div className="text-xs text-[#DC2626] bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">{errorMessage}</div>}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                Iniciar Apertura de Caja
              </button>
            </form>
          </div>

          {/* Historial de Turnos de Caja y Arqueos Anteriores Card matching reference image */}
          {renderHistoricShiftsTable()}

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

      {/* 5. MODAL COMPROBANTE CORTE 80MM */}
      {selectedShiftForTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-sky-400" />
                <span className="font-extrabold text-sm">Comprobante de Corte 80mm</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShiftForTicket(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 80mm Ticket Paper Preview */}
            <div className="p-4 overflow-y-auto bg-slate-100 flex justify-center">
              <div className="w-[280px] bg-white p-4 shadow-sm border border-slate-200 rounded-sm font-mono text-[11px] text-slate-800 space-y-2">
                <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-300">
                  <h4 className="font-bold text-xs uppercase">{config?.storeName || 'MI NEGOCIO / FARMACIA'}</h4>
                  <p className="text-[10px] text-slate-500 font-sans">CORTE DE CAJA - ARQUEO DE TURNO</p>
                  <p className="font-bold text-xs text-blue-700">{`Caja #${selectedShiftForTicket.shiftNumber || 1}`}</p>
                </div>

                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cajero:</span>
                    <span className="font-bold">{selectedShiftForTicket.cashierName || user?.name || 'Cajero'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Apertura:</span>
                    <span>{formatShiftDate(selectedShiftForTicket.openedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cierre:</span>
                    <span>{formatShiftDate(selectedShiftForTicket.closedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estado:</span>
                    <span className="font-bold uppercase text-emerald-700">{selectedShiftForTicket.state === 'open' ? 'Abierta' : 'Cerrada'}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>(+) Fondo Inicial:</span>
                    <span className="font-bold">{currency} {selectedShiftForTicket.initialCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>(+) Ventas Efectivo:</span>
                    <span className="font-bold">{currency} {((selectedShiftForTicket.cashSales !== undefined ? selectedShiftForTicket.cashSales : getShiftCashSales(selectedShiftForTicket))).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>(-) Gastos / Egresos:</span>
                    <span className="font-bold text-rose-600">-{currency} {(selectedShiftForTicket.expensesTotal || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Efectivo Esperado:</span>
                    <span className="font-bold">{currency} {(selectedShiftForTicket.initialCash + (selectedShiftForTicket.cashSales !== undefined ? selectedShiftForTicket.cashSales : getShiftCashSales(selectedShiftForTicket)) - (selectedShiftForTicket.expensesTotal || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[11px] bg-slate-50 p-1 rounded">
                    <span>Efectivo Contado:</span>
                    <span>{currency} {(selectedShiftForTicket.finalCash !== undefined ? selectedShiftForTicket.finalCash : selectedShiftForTicket.initialCash).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Diferencia:</span>
                    <span>Exacto (0.00)</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-4 pb-2 text-center text-[9px] text-slate-400 space-y-4">
                  <div className="pt-6 border-b border-slate-300 max-w-[160px] mx-auto"></div>
                  <p>Firma del Responsable de Caja</p>
                  <p className="text-[8px]">Comprobante Térmico 80mm - Yaa POS</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3.5 bg-white border-t border-slate-200 flex justify-between gap-2.5">
              <button
                type="button"
                onClick={() => print80mmReceipt(selectedShiftForTicket)}
                className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Corte 80mm
              </button>
              <button
                type="button"
                onClick={() => setSelectedShiftForTicket(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
