import React, { useState, useMemo, useEffect } from 'react';
import { Expense, AppConfig, User } from '../types';
import { isItemInBranch } from '../utils/branchHelper';
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
    const list = config?.branches && config.branches.length > 0 
      ? config.branches 
      : [
          { id: 'branch-1', name: 'Sucursal Central (Principal)', code: 'SUC-01', address: 'Zona Central', city: 'Guatemala', isMain: true, isActive: true },
          { id: 'branch-2', name: 'ferreteria 2', code: 'SUC-02', address: 'Km 14.5 Carretera', city: 'Mixco', isMain: false, isActive: true },
          { id: 'branch-3', name: 'FERRETERIA 3', code: 'SUC-03', address: 'Centro Comercial', city: 'Villa Nueva', isMain: false, isActive: true }
        ];

    if (user?.isOperator) {
      const allowed = (user.branches && user.branches.length > 0)
        ? user.branches
        : (user.branch && user.branch !== 'Todas') ? user.branch.split(',').map(s => s.trim()) : [];
      if (allowed.length > 0) {
        return list.filter(b => allowed.some(a => a.toLowerCase().trim() === b.name.toLowerCase().trim()));
      }
    }
    return list;
  }, [config?.branches, user]);

  const defaultBranchName = useMemo(() => {
    if (activeBranchName && activeBranchName !== 'Todas') return activeBranchName;
    return availableBranches[0]?.name || 'Sucursal Central (Principal)';
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
      if (user?.isOperator && availableBranches.length > 0) {
        matchesBranch = availableBranches.some(ab => 
          ab.name.toLowerCase().trim() === (e.branch || defaultBranchName).toLowerCase().trim()
        );
      } else if (selectedBranch !== 'Todas') {
        matchesBranch = isItemInBranch(e.branch, selectedBranch, availableBranches);
      }

      return matchesSearch && matchesCategory && matchesBranch;
    });
  }, [expenses, searchQuery, selectedCategory, selectedBranch, user, availableBranches, defaultBranchName]);

  const expensesTotalSum = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  return (
    <div id="expenses-view" className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Gestión de Gastos Operacionales</h1>
          <p className="text-sm text-slate-500">Registre desembolsos, pagos de servicios o suministros no relacionados con inventario directo.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm shadow-xs active:scale-98 transition-all cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Registrar Gasto
        </button>
      </div>

      {/* Stats and filters card block */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Sum Card (ColSpan 4) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex items-center justify-between md:col-span-4 h-full">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Gastos Filtrados</span>
            <h2 className="text-2xl font-black text-slate-800 font-mono">
              {currency}{expensesTotalSum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span className="text-[10px] text-slate-500 font-mono">Contabilizado de {filteredExpenses.length} registros</span>
          </div>
          <div className="p-3 bg-red-50 text-red-500 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* Filters Card (ColSpan 8) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 md:col-span-8 flex flex-col sm:flex-row gap-4 items-center h-full">
          <div className="relative w-full sm:flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              placeholder="Buscar gasto por descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-400 uppercase shrink-0">Categoría:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden bg-white"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-400 uppercase shrink-0 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
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
              className="w-full sm:w-auto text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden bg-white font-medium text-slate-700"
            >
              {!user?.isOperator && <option value="Todas">Todas las sucursales</option>}
              {availableBranches.map(b => (
                <option key={b.id || b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">No se encontraron gastos registrados para los filtros seleccionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse animate-in fade-in duration-150">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-xs font-medium uppercase">
                  <th className="py-3 px-5">Fecha</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4">Sucursal</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-5 text-right">Monto</th>
                  <th className="py-3 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredExpenses.slice().reverse().map((e) => (
                  <tr key={e.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-xs">
                      {new Date(e.date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{e.description}</div>
                      {(e.paymentMethod || e.voucherNumber || e.observations) && (
                        <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
                          {e.paymentMethod && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">💵 {e.paymentMethod}</span>}
                          {e.voucherNumber && <span className="text-slate-500 font-mono">📄 Ref: {e.voucherNumber}</span>}
                          {e.observations && <span className="text-slate-400 italic">💬 {e.observations}</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium">
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold">
                        <Building2 className="w-3 h-3 text-blue-500" />
                        {e.branch || defaultBranchName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-bold text-red-600">
                      -{currency}{e.amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer inline-block"
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
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-150 flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Header / Banner de color matching Cash Register */}
            <div className="bg-[#1E88E5] text-white px-6 py-5 relative flex justify-between items-center shadow-md">
              <div className="space-y-1">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span className="p-1 bg-white/10 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-indigo-100" />
                  </span>
                  Gestión de Gastos del Turno
                </h3>
                <p className="text-xs text-indigo-100 font-medium">Registra todos los egresos de efectivo del turno actual</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-1.5 hover:bg-white/15 rounded-full text-indigo-100 hover:text-white transition-all cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
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

              {/* Sucursal asignada */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Sucursal del Gasto *</span>
                </label>
                <select
                  required
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-700 font-medium shadow-xs"
                >
                  {availableBranches.map(b => (
                    <option key={b.id || b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 italic font-medium pl-1">El gasto quedará registrado de forma independiente en esta sucursal</p>
              </div>

              {/* Categoría del Gasto */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Categoría del Gasto *</label>
                <select
                  required
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-700 font-medium shadow-xs"
                >
                  <option value="" disabled>Seleccione una categoría...</option>
                  {formCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Descripción del Gasto */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Descripción del Gasto *</label>
                <textarea
                  required
                  placeholder="Ej: Pago de factura de luz del mes de noviembre"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-700 min-h-[70px] shadow-xs"
                />
              </div>

              {/* Importe */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Importe *</label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <div className="bg-[#ffc107] text-slate-900 font-black font-mono px-4 flex items-center justify-center text-xs">
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
                    className="w-full px-4 py-2.5 focus:outline-hidden font-mono text-right font-black text-sm text-slate-700 bg-white"
                  />
                </div>
              </div>

              {/* Método de Pago */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Método de Pago *</label>
                <select
                  required
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-700 font-medium shadow-xs"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
                <p className="text-[10px] text-slate-400 italic font-medium pl-1">Solo los gastos en efectivo afectan el arqueo de caja</p>
              </div>

              {/* Comprobante/Referencia */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Comprobante/Referencia</label>
                <input
                  type="text"
                  placeholder="Ej: Factura N° 001-12345"
                  value={formVoucherNumber}
                  onChange={(e) => setFormVoucherNumber(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-700 font-medium shadow-xs"
                />
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Observaciones</label>
                <textarea
                  placeholder="Información adicional (opcional)"
                  value={formObservations}
                  onChange={(e) => setFormObservations(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white text-slate-700 min-h-[60px] shadow-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-slate-200/60">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#ffb300] hover:bg-[#ff9f00] text-slate-900 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  Registrar Gasto
                </button>
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="w-full py-2.5 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
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
