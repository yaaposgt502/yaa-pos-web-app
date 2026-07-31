import React, { useState, useMemo } from 'react';
import { Product, AppConfig } from '../types';
import { 
  Calendar, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  XOctagon, 
  Clock,
  RefreshCw
} from 'lucide-react';

interface ExpirationsProps {
  products: Product[];
  config: AppConfig;
  onSaveProduct: (product: Product) => Promise<Product>;
  onRefreshData: () => void;
}

export default function Expirations({ products, config, onSaveProduct, onRefreshData }: ExpirationsProps) {
  const currency = config.currency || 'Q';
  const alertDays = config.alertDaysBeforeExpiration || 30;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'expired' | 'soon' | 'valid'>('all');

  const handleRetirar = async (product: Product) => {
    if (product.stock === 0) {
      alert(`El producto "${product.name}" ya se encuentra con stock en 0.`);
      return;
    }
    const confirmMessage = `¿Está seguro de que desea retirar y dar de baja el producto "${product.name}"?\nEsto establecerá su stock en 0 de forma inmediata en el inventario.`;
    if (window.confirm(confirmMessage)) {
      try {
        const updated: Product = {
          ...product,
          stock: 0
        };
        await onSaveProduct(updated);
        onRefreshData();
      } catch (err: any) {
        alert('Error al dar de baja: ' + err.message);
      }
    }
  };

  // Filter products that have expiration dates or manage batches
  const productsWithExpiry = useMemo(() => {
    return products.filter(p => p.expirationDate || p.manageBatchAndExpiration || p.initialBatch || (p.expirationDates && p.expirationDates.length > 0));
  }, [products]);

  // Current timestamp helper
  const now = useMemo(() => Date.now(), []);

  // Compute status for each product
  const productsStatus = useMemo(() => {
    return productsWithExpiry.map(p => {
      const primaryDateStr = p.expirationDate || (p.expirationDates && p.expirationDates.length > 0 ? p.expirationDates[0].date : '');
      const expTime = primaryDateStr ? new Date(primaryDateStr).getTime() : 0;
      const warningTimeLimit = now + alertDays * 24 * 3600 * 1000;
      
      let status: 'expired' | 'soon' | 'valid' = 'valid';
      let daysLeft = expTime ? Math.ceil((expTime - now) / (24 * 3600 * 1000)) : 999;

      if (expTime > 0) {
        if (expTime <= now) {
          status = 'expired';
        } else if (expTime <= warningTimeLimit) {
          status = 'soon';
        }
      }

      return {
        product: p,
        status,
        daysLeft
      };
    });
  }, [productsWithExpiry, now, alertDays]);

  // Counts
  const counts = useMemo(() => {
    let expired = 0;
    let soon = 0;
    let valid = 0;

    productsStatus.forEach(x => {
      if (x.status === 'expired') expired++;
      else if (x.status === 'soon') soon++;
      else valid++;
    });

    return { expired, soon, valid, total: productsWithExpiry.length };
  }, [productsStatus, productsWithExpiry]);

  // Filter and search logic
  const filteredItems = useMemo(() => {
    return productsStatus.filter(item => {
      const matchesSearch = item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.product.code.includes(searchQuery);
      
      const matchesFilter = filterStatus === 'all' || item.status === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [productsStatus, searchQuery, filterStatus]);

  return (
    <div id="expirations-view" className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Control de Vencimientos</h1>
        <p className="text-sm text-slate-500">
          Supervise fechas de caducidad. El margen de alerta configurado actualmente es de <b>{alertDays} días</b>.
        </p>
      </div>

      {/* Widgets Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Total catalogued */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Catalogados</span>
            <h3 className="text-xl font-extrabold text-slate-800 font-mono">{counts.total}</h3>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Expired */}
        <div 
          onClick={() => setFilterStatus('expired')}
          className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-red-200 transition-all"
        >
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Ya Vencidos</span>
            <h3 className={`text-xl font-extrabold font-mono ${counts.expired > 0 ? 'text-red-600' : 'text-slate-800'}`}>{counts.expired}</h3>
          </div>
          <div className={`p-2 rounded-lg ${counts.expired > 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
            <XOctagon className="w-5 h-5" />
          </div>
        </div>

        {/* Expiring Soon */}
        <div 
          onClick={() => setFilterStatus('soon')}
          className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-200 transition-all"
        >
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Próximos a Vencer</span>
            <h3 className={`text-xl font-extrabold font-mono ${counts.soon > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{counts.soon}</h3>
          </div>
          <div className={`p-2 rounded-lg ${counts.soon > 0 ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Safe */}
        <div 
          onClick={() => setFilterStatus('valid')}
          className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-200 transition-all"
        >
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Vigentes</span>
            <h3 className="text-xl font-extrabold text-slate-800 font-mono">{counts.valid}</h3>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            placeholder="Filtrar por nombre de producto con fecha registrada..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Tab state toggler */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`flex-1 md:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              filterStatus === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('expired')}
            className={`flex-1 md:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              filterStatus === 'expired' ? 'bg-red-500 text-white shadow-xs' : 'text-red-500 hover:bg-red-50'
            }`}
          >
            Vencidos
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('soon')}
            className={`flex-1 md:flex-none text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              filterStatus === 'soon' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-600 hover:bg-amber-50'
            }`}
          >
            A vencer
          </button>
        </div>
      </div>

      {/* List display */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400 space-y-3">
            <CheckCircle className="w-12 h-12 text-slate-200" />
            <div>
              <p className="text-sm font-semibold">Ningún producto coincide con el filtro</p>
              <p className="text-xs text-slate-400 mt-0.5">Su catálogo está libre de incidentes en este criterio.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-xs font-medium uppercase">
                  <th className="py-3 px-5">Producto</th>
                  <th className="py-3 px-4 text-center">Código</th>
                  <th className="py-3 px-4 text-center">Stock Disponible</th>
                  <th className="py-3 px-4 text-center">Fecha Caducidad</th>
                  <th className="py-3 px-4 text-center">Tiempo Restante</th>
                  <th className="py-3 px-5 text-right">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map(({ product, status, daysLeft }) => (
                  <tr key={product.id} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-800">{product.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">Categoría: {product.category}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500">{product.code}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono font-bold text-slate-700">{product.stock} {product.unit || 'Pza'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs font-bold text-slate-700">
                      {(() => {
                        const raw = product.expirationDate || (product.expirationDates && product.expirationDates.length > 0 ? product.expirationDates[0].date : '—');
                        if (raw && raw.includes('-')) {
                          const parts = raw.split('-');
                          return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : raw;
                        }
                        return raw || '—';
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {status === 'expired' ? (
                        <span className="text-xs text-red-600 font-bold font-mono">
                          Vencido hace {Math.abs(daysLeft)} días
                        </span>
                      ) : status === 'soon' ? (
                        <span className="text-xs text-amber-600 font-bold font-mono flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Vence en {daysLeft} días
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-bold font-mono">
                          Vence en {daysLeft} días (Seguro)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          status === 'expired' ? 'bg-red-50 text-red-700 border border-red-100' :
                          status === 'soon' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {status === 'expired' ? 'Vencido' :
                           status === 'soon' ? 'Ofertar' : 'Vigente'}
                        </span>
                        {status === 'expired' && product.stock > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRetirar(product)}
                            className="px-2 py-1 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all cursor-pointer uppercase active:scale-95"
                          >
                            Dar de Baja
                          </button>
                        )}
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
  );
}
