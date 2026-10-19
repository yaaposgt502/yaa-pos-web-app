import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Product, Provider, Purchase, PurchaseItem, AppConfig, User } from '../types';
import { isItemInBranch } from '../utils/branchHelper';
import { 
  Plus, 
  Search, 
  Trash2, 
  ShoppingBag, 
  Clock, 
  User as UserIcon, 
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
  Pill,
  Building2,
  ArrowRightLeft,
  Camera,
  Barcode,
  ScanLine,
  SwitchCamera,
  AlertTriangle
} from 'lucide-react';

interface PurchasingProps {
  products: Product[];
  providers: Provider[];
  purchases: Purchase[];
  currency: string;
  config?: AppConfig;
  user?: User | null;
  activeBranchName?: string;
  onSwitchBranch?: (branchName: string) => void;
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
  user,
  activeBranchName,
  onSwitchBranch,
  onSavePurchase, 
  onSaveProduct,
  onRefreshData 
}: PurchasingProps) {
  const isPharmacy = config?.businessType === 'pharmacy';

  // Available branches list
  const availableBranches = useMemo(() => {
    const list = config?.branches || [];

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
    return availableBranches[0]?.name || '';
  }, [activeBranchName, availableBranches]);

  useEffect(() => {
    if (activeBranchName) {
      setSelectedBranch(activeBranchName);
      setPurchaseBranch(activeBranchName);
    }
  }, [activeBranchName]);

  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchName || 'Todas');
  const [purchaseBranch, setPurchaseBranch] = useState<string>(defaultBranchName);
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
    const q = prodSearch.toLowerCase().trim();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.code.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [prodSearch, products]);

  // Barcode Scanner & Physical HID Reader states for Nueva Compra
  const [purchaseScanFeedback, setPurchaseScanFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string; sub?: string } | null>(null);
  const [isPurchaseBarcodeScannerOpen, setIsPurchaseBarcodeScannerOpen] = useState(false);
  const [purchaseScannerFacingMode, setPurchaseScannerFacingMode] = useState<'environment' | 'user'>('environment');
  const [purchaseScannerError, setPurchaseScannerError] = useState<string | null>(null);
  const [isPurchaseBarcodeScanning, setIsPurchaseBarcodeScanning] = useState(false);
  const [barcodeScanSuccessFlash, setBarcodeScanSuccessFlash] = useState(false);
  const [scannedBarcodePreview, setScannedBarcodePreview] = useState<string>('');

  const purchaseVideoRef = useRef<HTMLVideoElement | null>(null);
  const purchaseStreamRef = useRef<MediaStream | null>(null);
  const purchaseCodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const purchaseAnimFrameRef = useRef<number | null>(null);
  const lastPurchaseScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (purchaseScanFeedback) {
      const timer = setTimeout(() => setPurchaseScanFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [purchaseScanFeedback]);

  const selectProductForPurchase = (p: Product) => {
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
    setCurrentQuantity(prev => (prev && prev !== '0' ? prev : '1'));
  };

  const handlePurchaseBarcodeScan = (rawCode: string, fromCamera: boolean = false) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    const now = Date.now();
    if (lastPurchaseScanRef.current.code.toLowerCase() === cleanCode.toLowerCase() && (now - lastPurchaseScanRef.current.time) < 400) {
      return;
    }
    lastPurchaseScanRef.current = { code: cleanCode, time: now };

    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch (e) {}

    if (fromCamera) {
      setScannedBarcodePreview(cleanCode);
      setBarcodeScanSuccessFlash(true);
    }

    const cleanLower = cleanCode.toLowerCase();
    const matched = products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === cleanLower) ||
      (p.code && p.code.trim().toLowerCase() === cleanLower) ||
      (p.id && p.id.trim().toLowerCase() === cleanLower)
    );

    if (matched) {
      selectProductForPurchase(matched);
      setPurchaseScanFeedback({
        type: 'success',
        message: `✓ Producto seleccionado: ${matched.name}`,
        sub: `Código: ${cleanCode} | Stock actual: ${matched.stock} | Costo base: ${currency}${matched.cost.toFixed(2)}`
      });
      setTimeout(() => {
        if (quantityInputRef.current) {
          quantityInputRef.current.focus();
          quantityInputRef.current.select();
        }
      }, 100);
    } else {
      setProdSearch(cleanCode);
      setCurrentProduct(null);
      setPurchaseScanFeedback({
        type: 'warning',
        message: `Código no registrado en catálogo: "${cleanCode}"`,
        sub: `Puedes hacer clic abajo en "Registrar nuevo producto" para añadirlo a esta compra.`
      });
    }

    if (fromCamera) {
      setTimeout(() => {
        setBarcodeScanSuccessFlash(false);
        stopPurchaseBarcodeScanner();
      }, 700);
    }
  };

  const stopPurchaseBarcodeScanner = () => {
    if (purchaseAnimFrameRef.current) {
      cancelAnimationFrame(purchaseAnimFrameRef.current);
      purchaseAnimFrameRef.current = null;
    }
    if (purchaseCodeReaderRef.current) {
      try { purchaseCodeReaderRef.current.reset(); } catch (e) {}
      purchaseCodeReaderRef.current = null;
    }
    if (purchaseStreamRef.current) {
      try { purchaseStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      purchaseStreamRef.current = null;
    }
    if (purchaseVideoRef.current) {
      purchaseVideoRef.current.srcObject = null;
    }
    setIsPurchaseBarcodeScannerOpen(false);
    setPurchaseScannerError(null);
    setIsPurchaseBarcodeScanning(false);
  };

  const startPurchaseBarcodeScanner = async (mode: 'environment' | 'user' = 'environment') => {
    setPurchaseScannerFacingMode(mode);
    setPurchaseScannerError(null);
    setIsPurchaseBarcodeScanning(true);
    setIsPurchaseBarcodeScannerOpen(true);
    setScannedBarcodePreview('');
    setBarcodeScanSuccessFlash(false);

    if (purchaseAnimFrameRef.current) {
      cancelAnimationFrame(purchaseAnimFrameRef.current);
      purchaseAnimFrameRef.current = null;
    }
    if (purchaseCodeReaderRef.current) {
      try { purchaseCodeReaderRef.current.reset(); } catch (e) {}
      purchaseCodeReaderRef.current = null;
    }
    if (purchaseStreamRef.current) {
      try { purchaseStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      purchaseStreamRef.current = null;
    }

    setTimeout(async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setPurchaseScannerError('Tu navegador no permite acceso a la cámara o no está en un entorno seguro (HTTPS).');
          setIsPurchaseBarcodeScanning(false);
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        } catch (firstErr: any) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          } catch (fallbackErr: any) {
            setPurchaseScannerError(
              fallbackErr?.name === 'NotAllowedError' || fallbackErr?.name === 'PermissionDeniedError'
                ? 'Permiso de cámara denegado. Por favor concede acceso en tu navegador.'
                : 'No se pudo acceder a la cámara del dispositivo.'
            );
            setIsPurchaseBarcodeScanning(false);
            return;
          }
        }

        purchaseStreamRef.current = stream;
        const video = purchaseVideoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          try { await video.play(); } catch (e) {}
        }

        let detected = false;
        const onDetected = (code: string) => {
          if (detected || !code) return;
          detected = true;
          handlePurchaseBarcodeScan(code, true);
        };

        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'qr_code', 'itf']
            });

            const loop = async () => {
              if (detected || !purchaseVideoRef.current) return;
              if (purchaseVideoRef.current.readyState >= 2) {
                try {
                  const barcodes = await detector.detect(purchaseVideoRef.current);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    onDetected(barcodes[0].rawValue);
                    return;
                  }
                } catch (e) {}
              }
              purchaseAnimFrameRef.current = requestAnimationFrame(loop);
            };
            purchaseAnimFrameRef.current = requestAnimationFrame(loop);
            return;
          } catch (e) {}
        }

        // ZXing fallback
        try {
          const reader = new BrowserMultiFormatReader();
          purchaseCodeReaderRef.current = reader;
          reader.decodeFromStream(stream, purchaseVideoRef.current!, (res) => {
            if (res && !detected) {
              onDetected(res.getText());
            }
          });
        } catch (e) {}
      } catch (err: any) {
        setPurchaseScannerError('Error al iniciar escáner de cámara.');
        setIsPurchaseBarcodeScanning(false);
      }
    }, 200);
  };

  const togglePurchaseScannerCamera = () => {
    const nextMode = purchaseScannerFacingMode === 'environment' ? 'user' : 'environment';
    startPurchaseBarcodeScanner(nextMode);
  };

  useEffect(() => {
    return () => {
      stopPurchaseBarcodeScanner();
    };
  }, []);

  // Physical Barcode Reader Listener for Nueva Compra on Desktop & Tablet
  useEffect(() => {
    if (!isFormOpen) return;

    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPurchaseBarcodeScannerOpen || !!selectedPurchaseDetails) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3 && timeDiff < 150) {
          e.preventDefault();
          const code = buffer;
          buffer = '';
          handlePurchaseBarcodeScan(code, false);
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff > 80 && buffer.length > 0) {
          buffer = '';
        }
        buffer += e.key;
        lastKeyTime = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFormOpen, products, isPurchaseBarcodeScannerOpen, selectedPurchaseDetails, currency]);

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
      // 0. Branch filter (independent movements per branch)
      if (user?.isOperator && availableBranches.length > 0) {
        const allowed = (user.branches && user.branches.length > 0)
          ? user.branches
          : (user.branch && user.branch !== 'Todas') ? user.branch.split(',').map(s => s.trim()) : [];
        if (allowed.length > 0) {
          const match = allowed.some(a => a.toLowerCase().trim() === (pur.branch || defaultBranchName).toLowerCase().trim());
          if (!match) return false;
        }
      } else if (selectedBranch && selectedBranch !== 'Todas') {
        if (!isItemInBranch(pur.branch, selectedBranch, availableBranches)) {
          return false;
        }
      }

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
  }, [purchasesWithIndex, appliedFilters, selectedBranch, user, availableBranches, defaultBranchName]);

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

          <form onSubmit={handleSubmitPurchase} className="p-3.5 sm:p-6 space-y-5 sm:space-y-6">
            
            {/* Top Row: Fecha, Proveedor, Tipo de Pago, Comprobante, Nro. Comprobante */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
                {/* Product input search with Mobile Camera Button */}
                <div className="sm:col-span-4 space-y-1 relative">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">Producto</label>
                    <span className="text-[10px] text-blue-600 font-medium md:hidden flex items-center gap-1">
                      <Barcode className="w-3 h-3" />
                      Escáner cámara
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="BUSCAR PRODUCTO O ESCANEAR CÓDIGO..."
                        value={prodSearch}
                        onChange={(e) => {
                          setProdSearch(e.target.value);
                          if (currentProduct && e.target.value !== currentProduct.name) {
                            setCurrentProduct(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const q = prodSearch.trim();
                            if (q) handlePurchaseBarcodeScan(q, false);
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

                    {/* Mobile Camera Barcode Scanner Button */}
                    <button
                      type="button"
                      onClick={() => startPurchaseBarcodeScanner()}
                      className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs shrink-0 transition-all cursor-pointer h-9"
                      title="Escanear código de barras con la cámara"
                    >
                      <Camera className="w-4 h-4" />
                      <span className="text-[11px] font-semibold">Escanear</span>
                    </button>
                  </div>

                  {/* Feedback toast for scan */}
                  {purchaseScanFeedback && (
                    <div className={`mt-1.5 p-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
                      purchaseScanFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : purchaseScanFeedback.type === 'warning'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{purchaseScanFeedback.message}</p>
                        {purchaseScanFeedback.sub && <p className="text-[11px] opacity-85 truncate">{purchaseScanFeedback.sub}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPurchaseScanFeedback(null)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Dropdown list for search */}
                  {prodSearch.trim() !== '' && !currentProduct && (
                    <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-xl p-1.5 divide-y divide-slate-50 max-h-56 overflow-y-auto left-0">
                      {filteredProdList.map(p => (
                        <div
                          key={p.id}
                          onClick={() => selectProductForPurchase(p)}
                          className="p-2 hover:bg-blue-50/60 rounded-lg cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 uppercase truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Código: {p.code} {p.barcode ? `| CB: ${p.barcode}` : ''} | Stock: {p.stock}
                            </p>
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
                    ref={quantityInputRef}
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
            <div className="space-y-1.5">
              {/* Mobile Slide Hint (visible only on mobile screens < sm) */}
              <div className="sm:hidden flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Desliza la tabla para ver todas las opciones
                </span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  {purchaseItems.length} {purchaseItems.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-x-auto shadow-xs bg-white touch-pan-x overscroll-x-contain">
                <table className={`w-full ${isPharmacy ? 'min-w-[860px]' : 'min-w-[740px]'} lg:min-w-full text-left border-collapse text-xs`}>
                  <thead>
                    <tr className="bg-[#EBF5FF] border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <th className="py-2.5 px-4 font-bold min-w-[150px]">PRODUCTO</th>
                      <th className="py-2.5 px-3 font-bold text-center min-w-[70px]">LOTE</th>
                      <th className="py-2.5 px-3 font-bold text-center min-w-[90px]">VENCE</th>
                      <th className="py-2.5 px-3 font-bold text-center min-w-[75px]">CANTIDAD</th>
                      <th className="py-2.5 px-3 font-bold text-right min-w-[90px]">P. COSTO</th>
                      <th className="py-2.5 px-3 font-bold text-right min-w-[95px]">P. VTA UNIDAD</th>
                      {isPharmacy && (
                        <>
                          <th className="py-2.5 px-2 font-bold text-right min-w-[95px]">P. VTA BLISTER</th>
                          <th className="py-2.5 px-2 font-bold text-right min-w-[95px]">P. VTA CAJA</th>
                        </>
                      )}
                      <th className="py-2.5 px-3 font-bold text-right min-w-[85px]">SUBTOTAL</th>
                      <th className="py-2.5 px-4 font-bold text-center w-12 min-w-[60px]">ACCIONES</th>
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
                        <tr key={`${item.product.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors whitespace-nowrap">
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
          </div>

            {/* Calculations and Action Buttons Footer */}
            <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 -mx-3.5 sm:-mx-6 -mb-3.5 sm:-mb-6 p-4 sm:p-6 rounded-b-2xl">
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
                  <UserIcon className="w-3 h-3" />
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
              <>
                {/* Mobile Purchases History Cards (< sm) */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {filteredPurchases.slice().reverse().map((pur) => (
                    <div key={`mob-pur-${pur.id}`} className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-xs text-slate-800">
                              {pur.purchaseNumber}
                            </span>
                            <span className={`inline-block px-2 py-0.2 rounded-full text-[9px] font-black uppercase ${
                              pur.status === 'completed' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {pur.status === 'completed' ? 'Pagado' : 'Pendiente'}
                            </span>
                          </div>
                          <p className="font-semibold text-xs text-slate-800 uppercase mt-0.5">{getProviderName(pur.providerId)}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {new Date(pur.date).toLocaleDateString()} {pur.voucherType ? `• ${getVoucherLabel(pur.voucherType)}` : ''}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold font-mono text-slate-900 text-sm block">
                            {currency}{pur.total.toFixed(2)}
                          </span>
                          <span className="inline-block px-2 py-0.2 rounded-full text-[9px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-100 mt-0.5">
                            {getPaymentLabel(pur.paymentType).toLowerCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedPurchaseDetails(pur)}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Detalle</span>
                        </button>
                        {pur.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handlePayPurchase(pur)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Pagar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (sm and above, unchanged) */}
                <div className="hidden sm:block overflow-x-auto">
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
              </>
            )}
          </div>

        </div>
      )}

      {/* Detailed View Modal */}
      {selectedPurchaseDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-[#0084FF] text-white p-3.5 sm:p-4 flex justify-between items-center">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">Detalle de Compra N° {selectedPurchaseDetails.purchaseNumber}</span>
              </div>
              <button 
                onClick={() => setSelectedPurchaseDetails(null)}
                className="text-white/85 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
              
              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 text-xs">
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

              {/* Mobile swipe helper */}
              <div className="sm:hidden flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Desliza la tabla para ver todas las columnas
                </span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  {selectedPurchaseDetails.items.length} {selectedPurchaseDetails.items.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </div>

              {/* Products Table with horizontal scroll on mobile */}
              <div className="border border-slate-100 rounded-xl overflow-x-auto shadow-xs bg-white touch-pan-x overscroll-x-contain">
                <table className="w-full min-w-[540px] sm:min-w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#EBF5FF] border-b border-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <th className="py-2.5 px-4 font-bold min-w-[140px]">Producto</th>
                      <th className="py-2.5 px-3 font-bold text-center min-w-[70px]">Lote</th>
                      <th className="py-2.5 px-3 font-bold text-center min-w-[85px]">Vence</th>
                      <th className="py-2.5 px-3 font-bold text-center min-w-[75px]">Cantidad</th>
                      <th className="py-2.5 px-3 font-bold text-right min-w-[90px]">P. Unitario</th>
                      <th className="py-2.5 px-4 font-bold text-right min-w-[90px]">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 whitespace-nowrap">
                    {selectedPurchaseDetails.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800 uppercase min-w-[140px] whitespace-normal sm:whitespace-nowrap">{item.name}</td>
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
                <div className="w-full sm:w-64 space-y-2 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-100">
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

      {/* Mobile Barcode Scanner Camera Modal for Nueva Compra */}
      {isPurchaseBarcodeScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-200">
          {/* Header */}
          <div className="w-full max-w-md flex items-center justify-between text-white pt-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 rounded-xl">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">Escanear Producto (Compra)</h3>
                <p className="text-[11px] text-slate-300">Apunta la cámara al código de barras del producto</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePurchaseScannerCamera}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                title="Cambiar Cámara"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={stopPurchaseBarcodeScanner}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                title="Cerrar Escáner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="relative w-full max-w-sm aspect-4/3 rounded-3xl overflow-hidden bg-black border-2 border-white/20 shadow-2xl flex items-center justify-center my-auto">
            {purchaseScannerError ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{purchaseScannerError}</p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => startPurchaseBarcodeScanner(purchaseScannerFacingMode)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95"
                  >
                    Reintentar Escaneo
                  </button>
                  <button
                    type="button"
                    onClick={stopPurchaseBarcodeScanner}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  >
                    Ingresar Código Manualmente
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={purchaseVideoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                
                {/* Viewfinder Target Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className={`relative w-full max-w-[280px] h-48 border-2 ${barcodeScanSuccessFlash ? 'border-emerald-400 bg-emerald-500/25 shadow-[0_0_30px_rgba(52,211,153,0.6)]' : 'border-blue-400/90 bg-black/15 shadow-[0_0_20px_rgba(59,130,246,0.3)]'} rounded-2xl transition-all duration-200 flex flex-col justify-between p-2`}>
                    {/* Viewfinder Corners */}
                    <div className="flex justify-between">
                      <div className="w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                      <div className="w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    </div>

                    {/* Animated laser line */}
                    {!barcodeScanSuccessFlash && (
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
                    )}

                    {barcodeScanSuccessFlash && (
                      <div className="text-center py-2 bg-emerald-500/80 text-white rounded-lg backdrop-blur-xs shadow-lg animate-in zoom-in duration-150">
                        <p className="text-xs font-bold">¡Código Detectado!</p>
                        <p className="text-[11px] font-mono tracking-wider">{scannedBarcodePreview}</p>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <div className="w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                      <div className="w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
                  <span className="text-[11px] text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs font-medium">
                    {barcodeScanSuccessFlash ? '✓ ¡Código detectado! Cargando producto...' : 'Centra el código de barras físico del producto'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Footer Controls */}
          <div className="w-full max-w-sm pt-3 pb-2 text-center">
            <button
              type="button"
              onClick={stopPurchaseBarcodeScanner}
              className="w-full py-2.5 bg-white/10 hover:bg-white/20 active:scale-98 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/15"
            >
              Cancelar y escribir manualmente
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
