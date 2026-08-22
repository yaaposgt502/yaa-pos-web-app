import React, { useState, useMemo } from 'react';
import { Product, Provider, Purchase, PurchaseItem, AppConfig } from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  ShoppingBag, 
  Clock, 
  User, 
  Tag, 
  Layers, 
  AlertCircle,
  TrendingDown,
  X,
  FileText,
  CheckCircle2,
  Calendar,
  Filter,
  RotateCcw,
  Eye,
  Pill
} from 'lucide-react';

interface PurchasingProps {
  products: Product[];
  providers: Provider[];
  purchases: Purchase[];
  currency: string;
  config?: AppConfig;
  onSavePurchase: (purchase: Purchase) => Promise<Purchase>;
  onSaveProduct: (product: Product) => Promise<Product>;
  onRefreshData: () => void;
}

export default function Purchasing({ 
  products, 
  providers, 
  purchases, 
  currency, 
  config,
  onSavePurchase, 
  onSaveProduct,
  onRefreshData 
}: PurchasingProps) {
  const isPharmacy = config?.businessType === 'pharmacy';
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState<'completed' | 'pending'>('completed');
  
  const [purchaseDate, setPurchaseDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
  const [voucherType, setVoucherType] = useState<'factura' | 'boleta' | 'nota_venta'>('factura');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [ivaOption, setIvaOption] = useState<'sumar' | 'incluir' | 'no_aplicar'>('sumar');

  // Search states for purchasing form
  const [prodSearch, setProdSearch] = useState('');
  
  // Adding item states
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [currentQuantity, setCurrentQuantity] = useState<string>('');
  const [currentCost, setCurrentCost] = useState<string>('');
  const [currentLote, setCurrentLote] = useState<string>('');
  const [currentVencimiento, setCurrentVencimiento] = useState<string>('');

  // Pharmacy specific selling prices states
  const [currentPriceUnit, setCurrentPriceUnit] = useState<string>('');
  const [currentPriceBlister, setCurrentPriceBlister] = useState<string>('');
  const [currentPriceBox, setCurrentPriceBox] = useState<string>('');

  // Filtering states for the purchase history
  const [filterProvider, setFilterProvider] = useState('all');
  const [filterExactDate, setFilterExactDate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');

  // Applied filter settings
  const [appliedFilters, setAppliedFilters] = useState({
    provider: 'all',
    exactDate: '',
    startDate: '',
    endDate: '',
    status: 'all',
    payment: 'all',
  });

  // Selected purchase detail modal
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<any | null>(null);

  interface DraftPurchaseItem {
    product: Product;
    quantity: number;
    cost: number;
    lote: string;
    expirationDate: string;
    pricePerUnit?: number;
    pricePerBlister?: number;
    pricePerBox?: number;
  }
  const [purchaseItems, setPurchaseItems] = useState<DraftPurchaseItem[]>([]);

  const filteredProdList = useMemo(() => {
    if (!prodSearch.trim()) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(prodSearch.toLowerCase()) || 
      p.code.includes(prodSearch)
    ).slice(0, 5);
  }, [prodSearch, products]);

  // Calculations for Draft Purchase
  const ivaRate = 0.12;

  const rawSubtotal = useMemo(() => {
    return purchaseItems.reduce((acc, item) => acc + (item.quantity * item.cost), 0);
  }, [purchaseItems]);

  const calculations = useMemo(() => {
    let subtotal = 0;
    let iva = 0;
    let total = 0;

    if (ivaOption === 'sumar') {
      subtotal = rawSubtotal;
      iva = subtotal * ivaRate;
      total = subtotal + iva;
    } else if (ivaOption === 'incluir') {
      total = rawSubtotal;
      subtotal = total / (1 + ivaRate);
      iva = total - subtotal;
    } else { // no_aplicar
      subtotal = rawSubtotal;
      iva = 0;
      total = subtotal;
    }

    return { subtotal, iva, total };
  }, [rawSubtotal, ivaOption]);

  // Index mapping to keep purchase numbers stable chronologically
  const purchasesWithIndex = useMemo(() => {
    return purchases.map((pur, index) => ({
      ...pur,
      purchaseNumber: index + 1
    }));
  }, [purchases]);

  // Apply filters
  const filteredPurchases = useMemo(() => {
    return purchasesWithIndex.filter((pur) => {
      // 1. Provider
      if (appliedFilters.provider !== 'all' && pur.providerId !== appliedFilters.provider) {
        return false;
      }

      // 2. Exact Date
      if (appliedFilters.exactDate) {
        const purDateStr = new Date(pur.date).toISOString().split('T')[0];
        if (purDateStr !== appliedFilters.exactDate) {
          return false;
        }
      }

      // 3. Date Range
      if (appliedFilters.startDate || appliedFilters.endDate) {
        const purTime = new Date(pur.date).getTime();
        if (appliedFilters.startDate) {
          const startTime = new Date(appliedFilters.startDate + 'T00:00:00').getTime();
          if (purTime < startTime) return false;
        }
        if (appliedFilters.endDate) {
          const endTime = new Date(appliedFilters.endDate + 'T23:59:59').getTime();
          if (purTime > endTime) return false;
        }
      }

      // 4. Status
      if (appliedFilters.status !== 'all') {
        if (appliedFilters.status === 'completed' && pur.status !== 'completed') return false;
        if (appliedFilters.status === 'pending' && pur.status !== 'pending') return false;
      }

      // 5. Payment type
      if (appliedFilters.payment !== 'all') {
        const payment = pur.paymentType || 'cash';
        if (appliedFilters.payment === 'cash' && payment !== 'cash') return false;
        if (appliedFilters.payment === 'credit' && payment !== 'credit') return false;
      }

      return true;
    });
  }, [purchasesWithIndex, appliedFilters]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      provider: filterProvider,
      exactDate: filterExactDate,
      startDate: filterStartDate,
      endDate: filterEndDate,
      status: filterStatus,
      payment: filterPayment,
    });
  };

  const handleResetFilters = () => {
    setFilterProvider('all');
    setFilterExactDate('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterStatus('all');
    setFilterPayment('all');
    setAppliedFilters({
      provider: 'all',
      exactDate: '',
      startDate: '',
      endDate: '',
      status: 'all',
      payment: 'all',
    });
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId) {
      alert('Por favor seleccione un proveedor');
      return;
    }
    if (purchaseItems.length === 0) {
      alert('Debe agregar al menos un artículo para comprar.');
      return;
    }

    const newPurchase: Purchase = {
      id: '',
      date: new Date(purchaseDate + 'T12:00:00').toISOString(),
      items: purchaseItems.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        cost: item.cost,
        lote: item.lote,
        expirationDate: item.expirationDate,
        pricePerUnit: item.pricePerUnit,
        pricePerBlister: item.pricePerBlister,
        pricePerBox: item.pricePerBox
      })),
      total: calculations.total,
      providerId: selectedProviderId,
      status: purchaseStatus,
      paymentType,
      voucherType,
      voucherNumber,
      ivaOption,
      subtotal: calculations.subtotal,
      ivaAmount: calculations.iva
    };

    try {
      await onSavePurchase(newPurchase);
      setIsFormOpen(false);
      setPurchaseItems([]);
      setSelectedProviderId('');
      setVoucherNumber('');
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar la compra');
    }
  };

  const handlePayPurchase = async (pur: Purchase) => {
    try {
      // Confirm action with simple dialog
      const confirmPayment = window.confirm('¿Está seguro de que desea marcar esta compra como Pagada y recibir el stock?');
      if (!confirmPayment) return;

      const updatedPurchase: Purchase = {
        ...pur,
        status: 'completed'
      };
      await onSavePurchase(updatedPurchase);
      onRefreshData();
    } catch (err: any) {
      alert('Error al realizar el pago: ' + err.message);
    }
  };

  const getProviderName = (id: string) => {
    return providers.find(p => p.id === id)?.name || 'Proveedor Desconocido';
  };

  const getVoucherLabel = (type?: string) => {
    if (type === 'factura') return 'Factura';
    if (type === 'boleta') return 'Boleta';
    if (type === 'nota_venta') return 'Nota de Venta';
    return 'Comprobante';
  };

  const getPaymentLabel = (type?: string) => {
    if (type === 'cash') return 'Contado';
    if (type === 'credit') return 'Crédito';
    return 'Contado';
  };

  return (
    <div id="purchasing-view" className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestión de Compras</h1>
          <p className="text-sm text-slate-500">Registra y controla tus compras</p>
        </div>
        {!isFormOpen && (
          <button
            onClick={() => {
              setIsFormOpen(true);
              if (providers.length > 0) setSelectedProviderId(providers[0].id);
            }}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm cursor-pointer shadow-xs active:scale-98 transition-all"
          >
            <Plus className="w-4 h-4" /> Nueva Compra
          </button>
        )}
      </div>

      {isFormOpen ? (
        /* Purchase Entry Form Card */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
          
          {/* Header */}
          <div className="bg-[#0084FF] text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShoppingBag className="w-4 h-4" />
              <span>Nueva Compra</span>
            </div>
            <button 
              type="button" 
              onClick={() => { setIsFormOpen(false); setPurchaseItems([]); }}
              className="text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitPurchase} className="p-6 space-y-6">
            
            {/* Top Row: Fecha, Proveedor, Tipo de Pago, Comprobante, Nro. Comprobante */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Fecha */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Fecha</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                  required
                />
              </div>

              {/* Proveedor */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Proveedor</label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 font-medium"
                  required
                >
                  <option value="">Seleccione...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Pago */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Tipo de Pago</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 font-medium"
                >
                  <option value="cash">Contado</option>
                  <option value="credit">Crédito</option>
                </select>
              </div>

              {/* Comprobante */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Comprobante</label>
                <select
                  value={voucherType}
                  onChange={(e) => setVoucherType(e.target.value as any)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 font-medium"
                >
                  <option value="factura">Factura</option>
                  <option value="boleta">Boleta</option>
                  <option value="nota_venta">Nota de Venta</option>
                </select>
              </div>

              {/* Nro. Comprobante */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Nro. Comprobante</label>
                <input
                  type="text"
                  placeholder="F001-000001"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 font-mono"
                />
              </div>
            </div>

            {/* Receipt status selection (suma / no suma stock) */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="flex items-start gap-2 text-blue-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <span className="font-bold">Estado del Recibo: </span>
                  <span>Si selecciona "Completado y Recibido", se añadirá el stock al inventario automáticamente al guardar la compra.</span>
                </div>
              </div>
              <select
                value={purchaseStatus}
                onChange={(e) => setPurchaseStatus(e.target.value as any)}
                className="text-xs border border-blue-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 font-bold focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-8 shrink-0 min-w-[180px]"
              >
                <option value="completed">Completado y Recibido (Suma Stock)</option>
                <option value="pending">Orden Pendiente (No altera stock)</option>
              </select>
            </div>

            {/* Tab Bar Header */}
            <div className="border-b border-slate-100 flex">
              <button
                type="button"
                className="bg-white border-x border-t border-slate-200 rounded-t-xl px-4 py-2 text-xs font-bold text-[#0086F0] flex items-center gap-1.5 -mb-[1px]"
              >
                <Layers className="w-3.5 h-3.5" />
                Productos
              </button>
            </div>

            {/* Product Quick Form Input Row */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
              {/* Row 1: Product, Quantity, Cost, Batch, Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Product input search */}
                <div className="sm:col-span-4 space-y-1 relative">
                  <label className="block text-xs font-bold text-slate-700">Producto</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="BUSCAR PRODUCTO..."
                      value={prodSearch}
                      onChange={(e) => {
                        setProdSearch(e.target.value);
                        if (currentProduct && e.target.value !== currentProduct.name) {
                          setCurrentProduct(null);
                        }
                      }}
                      className="w-full text-xs border border-slate-200 rounded-xl pl-3 pr-8 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 uppercase font-medium"
                    />
                    {currentProduct && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentProduct(null);
                          setProdSearch('');
                          setCurrentCost('');
                          setCurrentLote('');
                          setCurrentVencimiento('');
                          setCurrentPriceUnit('');
                          setCurrentPriceBlister('');
                          setCurrentPriceBox('');
                        }}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown list for search */}
                  {prodSearch.trim() !== '' && !currentProduct && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-xl p-1.5 divide-y divide-slate-50 max-h-56 overflow-y-auto left-0">
                      {filteredProdList.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setCurrentProduct(p);
                            setProdSearch(p.name);
                            setCurrentCost(p.cost.toString());
                            setCurrentPriceUnit(p.pricePerUnit?.toString() || p.price?.toString() || '');
                            setCurrentPriceBlister(p.pricePerBlister?.toString() || '');
                            setCurrentPriceBox(p.pricePerBox?.toString() || '');

                            const initialBatchName = (p.expirationDates && p.expirationDates.length > 0 && p.expirationDates[p.expirationDates.length - 1].batch)
                              ? p.expirationDates[p.expirationDates.length - 1].batch
                              : (p.initialBatch || '00101');
                            const initialExpDate = (p.expirationDates && p.expirationDates.length > 0 && p.expirationDates[p.expirationDates.length - 1].date)
                              ? p.expirationDates[p.expirationDates.length - 1].date
                              : (p.expirationDate || '');
                            
                            let formattedExp = initialExpDate;
                            if (initialExpDate && initialExpDate.includes('/')) {
                              const parts = initialExpDate.split('/');
                              if (parts.length === 3) {
                                formattedExp = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                              }
                            }

                            setCurrentLote(initialBatchName);
                            setCurrentVencimiento(formattedExp);
                          }}
                          className="p-2 hover:bg-blue-50/60 rounded-lg cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 uppercase truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Código: {p.code} | Stock: {p.stock}</p>
                          </div>
                          <span className="text-[10px] font-bold text-[#0086F0] bg-blue-50 px-2 py-0.5 rounded-sm shrink-0 border border-blue-100">Seleccionar</span>
                        </div>
                      ))}

                      <div
                        onClick={() => {
                          const cleanName = prodSearch.trim().toUpperCase();
                          const newProd: Product = {
                            id: `NEW_${Date.now()}`,
                            code: `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
                            name: cleanName,
                            category: 'General',
                            cost: 0,
                            price: 0,
                            stock: 0,
                            minStock: 5,
                            unit: 'Pza',
                            initialBatch: '00101',
                            expirationDate: '',
                            manageBatchAndExpiration: true,
                            expirationDates: []
                          };
                          setCurrentProduct(newProd);
                          setProdSearch(cleanName);
                          setCurrentCost('');
                          setCurrentLote('00101');
                          setCurrentVencimiento('');
                          setCurrentPriceUnit('');
                          setCurrentPriceBlister('');
                          setCurrentPriceBox('');
                        }}
                        className="p-2.5 hover:bg-blue-50 rounded-lg cursor-pointer flex items-center justify-between text-xs text-[#0086F0] font-bold bg-blue-50/40 mt-1"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Plus className="w-4 h-4 shrink-0" />
                          <span className="truncate">Registrar nuevo producto "{prodSearch.trim().toUpperCase()}"</span>
                        </div>
                        <span className="text-[10px] bg-[#0086F0] text-white px-2 py-0.5 rounded-md shrink-0">Nuevo</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cantidad */}
                <div className="sm:col-span-1 space-y-1">
                  <label className="block text-xs font-bold text-slate-700 text-center">Cant.</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Cant."
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-2 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 font-mono font-bold text-center"
                  />
                </div>

                {/* Precio Costo */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700 text-right">Precio Costo ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={currentCost}
                    onChange={(e) => setCurrentCost(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 font-mono text-right"
                  />
                </div>

                {/* Precio Venta x Unidad (Visible en todos los giros) */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700 text-right">Precio Venta x Unidad ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={currentPriceUnit}
                    onChange={(e) => setCurrentPriceUnit(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 text-right"
                  />
                </div>

                {/* Lote */}
                <div className={isPharmacy ? "sm:col-span-2 space-y-1" : "sm:col-span-1 space-y-1"}>
                  <label className="block text-xs font-bold text-slate-700">Lote</label>
                  <input
                    type="text"
                    placeholder="Lote (opc.)"
                    value={currentLote}
                    onChange={(e) => setCurrentLote(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-2 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 font-mono"
                  />
                </div>

                {/* Vencimiento */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Vencimiento</label>
                  <input
                    type="date"
                    value={currentVencimiento}
                    onChange={(e) => setCurrentVencimiento(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 text-slate-600"
                  />
                </div>

                {/* Add Button for standard mode (non-pharmacy) */}
                {!isPharmacy && (
                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentProduct) {
                          alert('Por favor seleccione un producto de la búsqueda');
                          return;
                        }
                        const q = parseInt(currentQuantity);
                        if (isNaN(q) || q <= 0) {
                          alert('Por favor ingrese una cantidad válida mayor a 0');
                          return;
                        }
                        const c = parseFloat(currentCost);
                        if (isNaN(c) || c < 0) {
                          alert('Por favor ingrese un costo unitario válido');
                          return;
                        }

                        const pUnit = parseFloat(currentPriceUnit);

                        setPurchaseItems(prev => {
                          const existingIdx = prev.findIndex(item => item.product.id === currentProduct.id && item.lote === currentLote);
                          if (existingIdx > -1) {
                            const updated = [...prev];
                            updated[existingIdx].quantity += q;
                            if (!isNaN(pUnit) && pUnit > 0) updated[existingIdx].pricePerUnit = pUnit;
                            return updated;
                          }
                          const effectiveLote = currentLote.trim() || currentProduct.initialBatch || '00101';
                          return [...prev, {
                            product: currentProduct,
                            quantity: q,
                            cost: c,
                            lote: effectiveLote,
                            pricePerUnit: !isNaN(pUnit) && pUnit > 0 ? pUnit : (currentProduct.pricePerUnit || currentProduct.price || 0),
                            expirationDate: currentVencimiento 
                              ? (() => {
                                  const parts = currentVencimiento.split('-');
                                  if (parts.length === 3) {
                                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                  }
                                  return currentVencimiento;
                                })()
                              : (currentProduct.expirationDate || '—')
                          }];
                        });

                        // Reset fields
                        setCurrentProduct(null);
                        setProdSearch('');
                        setCurrentQuantity('');
                        setCurrentCost('');
                        setCurrentLote('');
                        setCurrentVencimiento('');
                        setCurrentPriceUnit('');
                        setCurrentPriceBlister('');
                        setCurrentPriceBox('');
                      }}
                      className="w-full h-9 bg-[#0086F0] text-white rounded-xl flex items-center justify-center hover:bg-[#0074D0] active:scale-95 transition-all cursor-pointer shadow-sm"
                      title="Agregar producto a la lista"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Pharmacy Specific Selling Prices Row (Visible only when businessType is pharmacy) */}
              {isPharmacy && (
                <div className="pt-3 border-t border-slate-200/80 mt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Precio Venta x Blister */}
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Precio Venta x Blister ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={currentPriceBlister}
                        onChange={(e) => setCurrentPriceBlister(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 text-right"
                      />
                    </div>

                    {/* Precio Venta x Caja */}
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Precio Venta x Caja ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={currentPriceBox}
                        onChange={(e) => setCurrentPriceBox(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 text-right"
                      />
                    </div>

                    {/* Add Product to Purchase button */}
                    <div className="sm:col-span-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentProduct) {
                            alert('Por favor seleccione un producto de la búsqueda');
                            return;
                          }
                          const q = parseInt(currentQuantity);
                          if (isNaN(q) || q <= 0) {
                            alert('Por favor ingrese una cantidad válida mayor a 0');
                            return;
                          }
                          const c = parseFloat(currentCost);
                          if (isNaN(c) || c < 0) {
                            alert('Por favor ingrese un costo unitario válido');
                            return;
                          }

                          const pUnit = parseFloat(currentPriceUnit);
                          const pBlister = parseFloat(currentPriceBlister);
                          const pBox = parseFloat(currentPriceBox);

                          setPurchaseItems(prev => {
                            const existingIdx = prev.findIndex(item => item.product.id === currentProduct.id && item.lote === currentLote);
                            if (existingIdx > -1) {
                              const updated = [...prev];
                              updated[existingIdx].quantity += q;
                              if (!isNaN(pUnit) && pUnit > 0) updated[existingIdx].pricePerUnit = pUnit;
                              if (!isNaN(pBlister) && pBlister >= 0) updated[existingIdx].pricePerBlister = pBlister;
                              if (!isNaN(pBox) && pBox >= 0) updated[existingIdx].pricePerBox = pBox;
                              return updated;
                            }
                            const effectiveLote = currentLote.trim() || currentProduct.initialBatch || '00101';
                            return [...prev, {
                              product: currentProduct,
                              quantity: q,
                              cost: c,
                              lote: effectiveLote,
                              pricePerUnit: !isNaN(pUnit) && pUnit > 0 ? pUnit : (currentProduct.pricePerUnit || currentProduct.price || 0),
                              pricePerBlister: !isNaN(pBlister) && pBlister >= 0 ? pBlister : (currentProduct.pricePerBlister || 0),
                              pricePerBox: !isNaN(pBox) && pBox >= 0 ? pBox : (currentProduct.pricePerBox || 0),
                              expirationDate: currentVencimiento 
                                ? (() => {
                                    const parts = currentVencimiento.split('-');
                                    if (parts.length === 3) {
                                      return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                    }
                                    return currentVencimiento;
                                  })()
                                : (currentProduct.expirationDate || '—')
                            }];
                          });

                          // Reset fields
                          setCurrentProduct(null);
                          setProdSearch('');
                          setCurrentQuantity('');
                          setCurrentCost('');
                          setCurrentLote('');
                          setCurrentVencimiento('');
                          setCurrentPriceUnit('');
                          setCurrentPriceBlister('');
                          setCurrentPriceBox('');
                        }}
                        className="w-full h-9 bg-[#0086F0] text-white rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs hover:bg-[#0074D0] active:scale-95 transition-all cursor-pointer shadow-sm"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Agregar a Compra</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Purchase Items List Table */}
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#EBF5FF] border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4 font-bold">PRODUCTO</th>
                    <th className="py-2.5 px-3 font-bold text-center">LOTE</th>
                    <th className="py-2.5 px-3 font-bold text-center">VENCE</th>
                    <th className="py-2.5 px-3 font-bold text-center">CANTIDAD</th>
                    <th className="py-2.5 px-3 font-bold text-right">P. COSTO</th>
                    <th className="py-2.5 px-3 font-bold text-right">P. VTA UNIDAD</th>
                    {isPharmacy && (
                      <>
                        <th className="py-2.5 px-2 font-bold text-right">P. VTA BLISTER</th>
                        <th className="py-2.5 px-2 font-bold text-right">P. VTA CAJA</th>
                      </>
                    )}
                    <th className="py-2.5 px-3 font-bold text-right">SUBTOTAL</th>
                    <th className="py-2.5 px-4 font-bold text-center w-12">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseItems.length === 0 ? (
                    <tr>
                      <td colSpan={isPharmacy ? 10 : 8} className="py-12 text-center text-slate-400 font-medium">
                        No se han agregado productos para comprar todavía. Utilice el formulario superior.
                      </td>
                    </tr>
                  ) : (
                    purchaseItems.map((item, idx) => (
                      <tr key={`${item.product.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800 uppercase">
                          {item.product.name}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {item.lote}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {item.expirationDate}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const q = parseInt(e.target.value) || 1;
                              setPurchaseItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: q } : it));
                            }}
                            className="w-16 text-center border border-slate-200 rounded-lg py-1 text-xs font-mono font-bold text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.cost}
                            onChange={(e) => {
                              const c = parseFloat(e.target.value) || 0;
                              setPurchaseItems(prev => prev.map((it, i) => i === idx ? { ...it, cost: c } : it));
                            }}
                            className="w-20 text-right border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono font-bold text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.pricePerUnit !== undefined ? item.pricePerUnit : ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setPurchaseItems(prev => prev.map((it, i) => i === idx ? { ...it, pricePerUnit: isNaN(val) ? 0 : val } : it));
                            }}
                            className="w-20 text-right border border-slate-200 rounded-lg py-1 px-2 text-xs font-mono font-bold text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                          />
                        </td>
                        {isPharmacy && (
                          <>
                            <td className="py-3 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.pricePerBlister !== undefined ? item.pricePerBlister : ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setPurchaseItems(prev => prev.map((it, i) => i === idx ? { ...it, pricePerBlister: isNaN(val) ? 0 : val } : it));
                                }}
                                className="w-16 text-right border border-blue-200 rounded-lg py-1 px-1.5 text-xs font-mono font-bold text-blue-700 bg-blue-50/40 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                              />
                            </td>
                            <td className="py-3 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.pricePerBox !== undefined ? item.pricePerBox : ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setPurchaseItems(prev => prev.map((it, i) => i === idx ? { ...it, pricePerBox: isNaN(val) ? 0 : val } : it));
                                }}
                                className="w-16 text-right border border-blue-200 rounded-lg py-1 px-1.5 text-xs font-mono font-bold text-blue-700 bg-blue-50/40 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                              />
                            </td>
                          </>
                        )}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                          {currency}{(item.quantity * item.cost).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setPurchaseItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations and Action Buttons Footer */}
            <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
              {/* Bottom Left: IVA options */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IVA EN TOTAL</span>
                <select
                  value={ivaOption}
                  onChange={(e) => setIvaOption(e.target.value as any)}
                  className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9 min-w-[140px]"
                >
                  <option value="sumar">Sumar IVA</option>
                  <option value="incluir">Incluir IVA</option>
                  <option value="no_aplicar">No Aplicar</option>
                </select>
              </div>

              {/* Bottom Middle: Calculations */}
              <div className="flex flex-wrap items-center gap-6 text-slate-700 font-mono">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">SUBTOTAL</span>
                  <span className="text-sm font-bold text-slate-800">{currency}{calculations.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">IVA (12.00%)</span>
                  <span className="text-sm font-bold text-slate-800">{currency}{calculations.iva.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">TOTAL</span>
                  <span className="text-lg font-black text-[#0086F0]">{currency}{calculations.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Bottom Right: Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); setPurchaseItems([]); }}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-xs active:scale-98 transition-all cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={purchaseItems.length === 0}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-[#0086F0] to-[#015FA9] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-center"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Guardar Compra
                </button>
              </div>
            </div>

          </form>
        </div>
      ) : (
        /* History Purchases List Card with Filters as shown in the focused selector */
        <div className="space-y-4">
          
          {/* Filters Bar matching the user's image exactly */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-3 items-end">
              
              {/* Proveedor */}
              <div className="lg:col-span-3 md:col-span-3 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Proveedor
                </label>
                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                >
                  <option value="all">Todos los proveedores</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Fecha Exacta */}
              <div className="lg:col-span-2 md:col-span-3 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Fecha Exacta
                </label>
                <input
                  type="date"
                  value={filterExactDate}
                  onChange={(e) => setFilterExactDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                />
              </div>

              {/* Rango de Fechas */}
              <div className="lg:col-span-3 md:col-span-3 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Rango de Fechas
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-2 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                  />
                  <span className="text-slate-400 text-xs shrink-0">-</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-2 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                  />
                </div>
              </div>

              {/* Estado */}
              <div className="lg:col-span-1.5 md:col-span-1.5 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Estado</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                >
                  <option value="all">Todos</option>
                  <option value="completed">Pagado</option>
                  <option value="pending">Pendiente</option>
                </select>
              </div>

              {/* Pago */}
              <div className="lg:col-span-1.5 md:col-span-1.5 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Pago</label>
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                >
                  <option value="all">Todos</option>
                  <option value="cash">Contado</option>
                  <option value="credit">Crédito</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="lg:col-span-1 md:col-span-6 flex gap-1.5">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="flex-1 bg-[#0086F0] hover:bg-[#0074D0] text-white rounded-xl h-9 flex items-center justify-center gap-1 font-bold text-xs cursor-pointer shadow-xs active:scale-98 transition-all"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filtrar
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl h-9 w-9 flex items-center justify-center cursor-pointer transition-colors"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>

          {/* History Purchases Table Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            {filteredPurchases.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400 space-y-3">
                <ShoppingBag className="w-12 h-12 text-slate-300" />
                <div>
                  <p className="text-sm font-semibold">No se encontraron compras</p>
                  <p className="text-xs text-slate-400 mt-0.5">Pruebe ajustando los filtros seleccionados o registre una nueva compra.</p>
                </div>
                <button
                  onClick={handleResetFilters}
                  className="text-xs bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all mt-2"
                >
                  Restablecer Filtros
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse animate-in fade-in duration-150">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-5 text-left font-bold">FECHA</th>
                      <th className="py-3 px-4 text-center font-bold">N° COMPRA</th>
                      <th className="py-3 px-4 text-left font-bold">PROVEEDOR</th>
                      <th className="py-3 px-4 text-right font-bold">TOTAL</th>
                      <th className="py-3 px-4 text-center font-bold">ESTADO</th>
                      <th className="py-3 px-4 text-center font-bold">TIPO PAGO</th>
                      <th className="py-3 px-5 text-center font-bold w-32">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredPurchases.slice().reverse().map((pur) => (
                      <tr key={pur.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Fecha */}
                        <td className="py-3.5 px-5 font-mono text-xs text-slate-600">
                          {new Date(pur.date).toLocaleDateString()}
                        </td>

                        {/* N° Compra */}
                        <td className="py-3.5 px-4 text-center font-bold font-mono text-slate-800 text-xs">
                          {pur.purchaseNumber}
                        </td>

                        {/* Proveedor */}
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800 uppercase text-xs">{getProviderName(pur.providerId)}</p>
                          {pur.voucherType && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              {getVoucherLabel(pur.voucherType)} {pur.voucherNumber ? `N° ${pur.voucherNumber}` : '—'}
                            </p>
                          )}
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 text-right font-bold font-mono text-slate-900 text-xs">
                          {currency}{pur.total.toFixed(2)}
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            pur.status === 'completed' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {pur.status === 'completed' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>

                        {/* Tipo de Pago */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-100">
                            {getPaymentLabel(pur.paymentType).toLowerCase()}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Detail Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedPurchaseDetails(pur)}
                              className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Pagar Button (if pending) */}
                            {pur.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handlePayPurchase(pur)}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Pagar
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
      )}

      {/* Detailed View Modal */}
      {selectedPurchaseDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-[#0084FF] text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-sm">
                <FileText className="w-4 h-4" />
                <span>Detalle de Compra N° {selectedPurchaseDetails.purchaseNumber}</span>
              </div>
              <button 
                onClick={() => setSelectedPurchaseDetails(null)}
                className="text-white/85 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              
              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Proveedor</span>
                  <span className="font-bold text-slate-800 uppercase">{getProviderName(selectedPurchaseDetails.providerId)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Fecha / Hora</span>
                  <span className="font-bold text-slate-800">{new Date(selectedPurchaseDetails.date).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Tipo de Pago</span>
                  <span className="font-bold text-slate-800 uppercase">{getPaymentLabel(selectedPurchaseDetails.paymentType)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Documento</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {getVoucherLabel(selectedPurchaseDetails.voucherType)} {selectedPurchaseDetails.voucherNumber ? `N° ${selectedPurchaseDetails.voucherNumber}` : '—'}
                  </span>
                </div>
              </div>

              {/* Products Table */}
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-xs bg-white text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#EBF5FF] border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-4 font-bold">Producto</th>
                      <th className="py-2.5 px-3 font-bold text-center">Lote</th>
                      <th className="py-2.5 px-3 font-bold text-center">Vence</th>
                      <th className="py-2.5 px-3 font-bold text-center">Cantidad</th>
                      <th className="py-2.5 px-3 font-bold text-right">P. Unitario</th>
                      <th className="py-2.5 px-4 font-bold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedPurchaseDetails.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800 uppercase">{item.name}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">{item.lote || '—'}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">{item.expirationDate || '—'}</td>
                        <td className="py-3 px-3 text-center font-bold font-mono text-slate-900">{item.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">{currency}{item.cost.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-slate-800">{currency}{(item.quantity * item.cost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end text-xs font-mono text-slate-700">
                <div className="w-64 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Subtotal:</span>
                    <span className="font-bold text-slate-800">
                      {currency}{(selectedPurchaseDetails.subtotal || selectedPurchaseDetails.total).toFixed(2)}
                    </span>
                  </div>
                  {selectedPurchaseDetails.ivaAmount !== undefined && selectedPurchaseDetails.ivaAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">IVA (12.00%):</span>
                      <span className="font-bold text-slate-800">{currency}{selectedPurchaseDetails.ivaAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
                    <span className="text-slate-500 font-black">TOTAL:</span>
                    <span className="font-black text-[#0086F0]">{currency}{selectedPurchaseDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-2">
              {selectedPurchaseDetails.status === 'pending' && (
                <button
                  onClick={() => {
                    handlePayPurchase(selectedPurchaseDetails);
                    setSelectedPurchaseDetails(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Marcar como Pagada
                </button>
              )}
              <button
                onClick={() => setSelectedPurchaseDetails(null)}
                className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs active:scale-98 transition-all"
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
