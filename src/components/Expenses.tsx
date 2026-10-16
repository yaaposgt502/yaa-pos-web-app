import React, { useState, useMemo, useEffect } from 'react';
import { Expense, AppConfig, User } from '../types';
import { isItemInBranch, getOperationalBranches } from '../utils/branchHelper';
import { 
  Plus, 
  Search, 
  Trash2, 
  TrendingDown, 
  Calendar, 
  FileText, 
  Tag, 
  AlertCircle,
  X,
  ArrowDownToLine,
  Building2,
  CheckCircle2
} from 'lucide-react';

interface ExpensesProps {
  expenses: Expense[];
  currency: string;
  onSaveExpense: (expense: Expense) => Promise<Expense>;
  onDeleteExpense: (id: string) => Promise<{ success: boolean }>;
  onRefreshData: () => void;
  config?: AppConfig;
  user?: User | null;
  activeBranchName?: string;
  onSwitchBranch?: (branchName: string) => void;
}

export default function Expenses({ 
  expenses, 
  currency, 
  onSaveExpense, 
  onDeleteExpense, 
  onRefreshData,
  config,
  user,
  activeBranchName,
  onSwitchBranch
}: ExpensesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchName || 'Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Available branches list
  const availableBranches = useMemo(() => {
    return getOperationalBranches(config, user);
  }, [config, user]);

  const hasMultipleBranches = availableBranches.length > 1;

  const defaultBranchName = useMemo(() => {
    if (activeBranchName && activeBranchName !== 'Todas') return activeBranchName;
    return availableBranches[0]?.name || 'Sede Central';
  }, [activeBranchName, availableBranches]);

  useEffect(() => {
    if (activeBranchName) {
      setSelectedBranch(activeBranchName);
      setFormBranch(activeBranchName);
    }
  }, [activeBranchName]);

  // Helper to get local date and time formatted for datetime-local input
  const getLocalDateTimeString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().substring(0, 16);
  };

  // Form fields
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBranch, setFormBranch] = useState(defaultBranchName);
  const [formDateTime, setFormDateTime] = useState(getLocalDateTimeString());
  const [formPaymentMethod, setFormPaymentMethod] = useState('Efectivo');
  const [formVoucherNumber, setFormVoucherNumber] = useState('');
  const [formObservations, setFormObservations] = useState('');

  const categories = ['Todas', 'Servicios', 'Alquiler', 'Papelería/Oficina', 'Sueldos/Planilla', 'Impuestos', 'Mantenimiento', 'Otros'];
  const formCategories = categories.filter(c => c !== 'Todas');

  // Clear Form fields
  const handleClearForm = () => {
    setFormDesc('');
    setFormAmount('');
    setFormCategory('');
    setFormBranch(defaultBranchName);
    setFormDateTime(getLocalDateTimeString());
    setFormPaymentMethod('Efectivo');
    setFormVoucherNumber('');
    setFormObservations('');
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc || !formAmount || !formCategory || !formPaymentMethod) {
      alert('Por favor complete todos los campos obligatorios (*)');
      return;
    }

    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('El monto del gasto debe ser un número positivo.');
      return;
    }

    const expenseData: Expense = {
      id: '',
      date: new Date(formDateTime).toISOString(),
      description: formDesc,
      amount: amountNum,
      category: formCategory,
      branch: formBranch || defaultBranchName,
      paymentMethod: formPaymentMethod,
      voucherNumber: formVoucherNumber,
      observations: formObservations
    };

    try {
      await onSaveExpense(expenseData);
      setIsModalOpen(false);
      handleClearForm();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al registrar el gasto');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este gasto de los registros?')) {
      try {
        await onDeleteExpense(id);
        onRefreshData();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar el gasto');
      }
    }
  };

  // Filter & Search Logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            e.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Todas' || e.category === selectedCategory;
      
      // Branch filter (independent movements per branch)
      let matchesBranch = true;
      if (!hasMultipleBranches) {
        matchesBranch = true;
      } else if (user?.isOperator && availableBranches.length > 0) {
        matchesBranch = availableBranches.some(ab => 
          ab.name.toLowerCase().trim() === (e.branch || defaultBranchName).toLowerCase().trim()
        );
      } else if (selectedBranch !== 'Todas') {
        matchesBranch = isItemInBranch(e.branch, selectedBranch, availableBranches);
      }

      return matchesSearch && matchesCategory && matchesBranch;
    });
  }, [expenses, searchQuery, selectedCategory, selectedBranch, user, availableBranches, defaultBranchName, hasMultipleBranches]);

  const expensesTotalSum = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <div id="expenses-view" className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight font-sans">Gestión de Gastos Operacionales</h1>
          <p className="text-xs text-[#64748B] mt-0.5">Registre desembolsos, pagos de servicios o suministros operativos de forma centralizada.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Registrar Gasto
        </button>
      </div>

      {/* Stats and filters card block */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Sum Card (ColSpan 4) */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs p-4 sm:p-5 flex items-center justify-between md:col-span-4 h-full">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Gastos Filtrados</span>
            <h2 className="text-2xl font-bold text-[#1F2937] font-mono tracking-tight">
              {currency}{expensesTotalSum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span className="text-[11px] text-[#64748B] font-mono">Contabilizado de {filteredExpenses.length} registros</span>
          </div>
          <div className="p-2.5 bg-rose-50 text-[#DC2626] rounded-lg">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* Filters Card (ColSpan 8) */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs p-4 sm:p-5 md:col-span-8 flex flex-col sm:flex-row gap-3 items-center h-full">
          <div className="relative w-full sm:flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar gasto por descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] text-xs font-medium text-[#1F2937] bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-[#64748B] shrink-0">Categoría:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white text-[#1F2937] font-medium"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {hasMultipleBranches && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-medium text-[#64748B] shrink-0 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Sucursal:</span>
              </span>
              <select
                value={selectedBranch}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranch(val);
                  if (val !== 'Todas' && onSwitchBranch) {
                    onSwitchBranch(val);
                  }
                }}
                className="w-full sm:w-auto text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white font-medium text-[#1F2937]"
              >
                {!user?.isOperator && <option value="Todas">Todas las sucursales</option>}
                {availableBranches.map(b => (
                  <option key={b.id || b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="py-16 text-center text-[#64748B] text-xs">No se encontraron gastos registrados para los filtros seleccionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Descripción</th>
                  {hasMultipleBranches && <th className="py-3 px-4">Sucursal</th>}
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredExpenses.slice().reverse().map((e) => (
                  <tr key={e.id} className="text-[#64748B] hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-[#1F2937]">
                      {new Date(e.date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#1F2937]">{e.description}</div>
                      {(e.paymentMethod || e.voucherNumber || e.observations) && (
                        <div className="text-[10px] text-[#64748B] mt-0.5 flex flex-wrap gap-x-2.5 gap-y-1 items-center">
                          {e.paymentMethod && <span className="bg-slate-100 text-[#1F2937] px-1.5 py-0.5 rounded text-[10px]">💵 {e.paymentMethod}</span>}
                          {e.voucherNumber && <span className="text-[#64748B] font-mono">Ref: {e.voucherNumber}</span>}
                          {e.observations && <span className="text-[#64748B] italic">💬 {e.observations}</span>}
                        </div>
                      )}
                    </td>
                    {hasMultipleBranches && (
                      <td className="py-3 px-4 text-xs font-medium">
                        <span className="inline-flex items-center gap-1 bg-slate-50 text-[#1F2937] border border-[#E2E8F0] px-2 py-0.5 rounded text-[11px] font-medium">
                          <Building2 className="w-3 h-3 text-[#2563EB]" />
                          {e.branch || defaultBranchName}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-xs font-medium">
                      <span className="bg-slate-100 text-[#1F2937] px-2 py-0.5 rounded border border-[#E2E8F0] text-xs">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#DC2626] tabular-nums">
                      -{currency}{e.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="p-1.5 text-slate-400 hover:text-[#DC2626] rounded-md hover:bg-rose-50 transition-colors cursor-pointer inline-block"
                        title="Eliminar Gasto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden shadow-xl border border-[#E2E8F0] flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header / Banner de color #172B4D */}
            <div className="bg-[#172B4D] text-white px-5 py-4 relative flex justify-between items-center shadow-xs">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span className="p-1 bg-white/10 rounded-md">
                    <TrendingDown className="w-4 h-4 text-blue-300" />
                  </span>
                  Gestión de Gastos Operacionales
                </h3>
                <p className="text-xs text-slate-300 font-normal">Registra desembolsos y egresos de caja</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1 hover:bg-white/15 rounded-md text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left max-h-[75vh] overflow-y-auto bg-slate-50/35">
              
              {/* Fecha y Hora */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Fecha y Hora</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-3 flex items-center text-slate-400 pointer-events-none">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="datetime-local"
                    value={formDateTime}
                    onChange={(e) => setFormDateTime(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-700 font-medium font-mono shadow-xs"
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic font-medium pl-1">Se registra automáticamente al momento actual</p>
              </div>

              {/* Sucursal asignada (Solo visible si hay más de 1 sucursal) */}
              {hasMultipleBranches && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Sucursal del Gasto *</span>
                  </label>
                  <select
                    required
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden bg-white text-[#1F2937] font-medium shadow-2xs"
                  >
                    {availableBranches.map(b => (
                      <option key={b.id || b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#64748B] italic font-medium pl-1">El gasto quedará registrado de forma independiente en esta sucursal</p>
                </div>
              )}

              {/* Categoría del Gasto */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Categoría del Gasto *</label>
                <select
                  required
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden bg-white text-[#1F2937] font-medium shadow-2xs"
                >
                  <option value="" disabled>Seleccione una categoría...</option>
                  {formCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Descripción del Gasto */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Descripción del Gasto *</label>
                <textarea
                  required
                  placeholder="Ej: Pago de factura de luz del mes"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden bg-white text-[#1F2937] min-h-[60px] shadow-2xs"
                />
              </div>

              {/* Importe */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Importe *</label>
                <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden bg-white shadow-2xs focus-within:ring-1 focus-within:ring-[#2563EB] transition-all">
                  <div className="bg-slate-100 text-[#1F2937] font-bold font-mono px-3.5 flex items-center justify-center text-xs border-r border-[#E2E8F0]">
                    {currency}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 focus:outline-hidden font-mono text-right font-bold text-xs text-[#1F2937] bg-white"
                  />
                </div>
              </div>

              {/* Método de Pago */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Método de Pago *</label>
                <select
                  required
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                  className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden bg-white text-[#1F2937] font-medium shadow-2xs"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
                <p className="text-[10px] text-[#64748B] italic font-medium pl-1">Solo los gastos en efectivo afectan el arqueo de caja</p>
              </div>

              {/* Comprobante/Referencia */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Comprobante/Referencia</label>
                <input
                  type="text"
                  placeholder="Ej: Factura N° 001-12345"
                  value={formVoucherNumber}
                  onChange={(e) => setFormVoucherNumber(e.target.value)}
                  className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden bg-white text-[#1F2937] font-medium shadow-2xs"
                />
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Observaciones</label>
                <textarea
                  placeholder="Información adicional (opcional)"
                  value={formObservations}
                  onChange={(e) => setFormObservations(e.target.value)}
                  className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden bg-white text-[#1F2937] min-h-[50px] shadow-2xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  Registrar Gasto
                </button>
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-[#E2E8F0] text-[#1F2937] rounded-lg text-xs font-medium transition-all text-center cursor-pointer"
                >
                  Limpiar Formulario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
