import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Client, Sale, Shift, AppConfig, PrescriptionData } from '../types';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  UserPlus, 
  DollarSign, 
  CreditCard, 
  ArrowRightLeft, 
  CheckCircle, 
  CheckCircle2,
  Printer, 
  AlertTriangle,
  Plus,
  Minus,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Star,
  RefreshCw,
  FolderPlus,
  Undo2,
  FileText,
  Clock,
  User,
  Info,
  Calendar,
  Loader2,
  FileSignature,
  Stethoscope,
  Eye,
  Upload,
  Camera,
  CameraOff,
  SwitchCamera
} from 'lucide-react';
import * as api from '../api';

interface Combo {
  id: string;
  name: string;
  products: string;
  price: number;
  cost: number;
  status: 'Activo' | 'Inactivo';
}

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  description: string;
}

interface Promo {
  id: string;
  code: string;
  name: string;
  value: string;
  type: 'percentage' | 'fixed' | 'special';
  status: 'Activo' | 'Inactivo';
  expiration: string;
}

interface POSProduct extends Product {
  isPromoItem?: boolean;
  promoType?: 'percentage' | 'fixed' | 'special';
  promoValue?: string;
}

interface POSProps {
  products: Product[];
  clients: Client[];
  shifts: Shift[];
  config: AppConfig;
  user: { id: string; name: string; email: string };
  onSaveSale: (sale: Sale) => Promise<Sale>;
  onRefreshData: () => void;
  onNavigate: (tab: string) => void;
}

interface CartItem {
  product: POSProduct;
  quantity: number;
  customPrice?: number;
  selectedUnit?: string;
  selectedLote?: string;
  prescription?: PrescriptionData;
}

interface CartSession {
  id: number;
  cart: CartItem[];
  selectedClientId: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
}

interface PendingOrder {
  id: string;
  customerName: string;
  items: Array<{ name: string; price: number; quantity: number; product: POSProduct }>;
  total: number;
}

// Maps products to realistic premium Unsplash stock images or uses custom product imageUrl
const getProductImage = (p: Product | { name: string; imageUrl?: string }): string => {
  if (p.imageUrl && p.imageUrl.trim() !== '') {
    return p.imageUrl;
  }
  const name = p.name || '';
  const n = name.toLowerCase();
  if (n.includes('whisky') || n.includes('johnnie')) {
    return 'https://images.unsplash.com/photo-1527281400828-ac7455a6839a?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('ron') || n.includes('cartavio') || n.includes('bacardi')) {
    return 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('vodka') || n.includes('absolut')) {
    return 'https://images.unsplash.com/photo-1550976037-233b2a4f5214?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('gin') || n.includes('beefeater') || n.includes('tanqueray')) {
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('pisco')) {
    return 'https://images.unsplash.com/photo-1532634922-8fe0b757fb13?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('cerveza') || n.includes('beer') || n.includes('corona') || n.includes('cusqueña') || n.includes('cusqueia')) {
    return 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('vino') || n.includes('wine')) {
    return 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('champagne') || n.includes('brut') || n.includes('sparkling')) {
    return 'https://images.unsplash.com/photo-1594487523089-f41750d6c668?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('tequila') || n.includes('don julio')) {
    return 'https://images.unsplash.com/photo-1516535794938-6063878f08cc?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('licor') || n.includes('café') || n.includes('kahlua') || n.includes('cafe')) {
    return 'https://images.unsplash.com/photo-1574316071802-0d684efa7bf5?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('baileys')) {
    return 'https://images.unsplash.com/photo-1620360244519-6f1ece7afd53?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('jägermeister') || n.includes('jager') || n.includes('jagermeister')) {
    return 'https://images.unsplash.com/photo-1561571994-3c61c554181a?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('red bull') || n.includes('monster') || n.includes('gatorade') || n.includes('energizante') || n.includes('naranja')) {
    return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('coca cola') || n.includes('cola') || n.includes('soda') || n.includes('sprite') || n.includes('inca kola')) {
    return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('agua') || n.includes('water') || n.includes('san luis')) {
    return 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('jugo') || n.includes('gloria') || n.includes('durazno')) {
    return 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('leche')) {
    return 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop&q=60';
  }
  if (n.includes('aceite') || n.includes('primor')) {
    return 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=60';
  }
  return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=60';
};

export const getProductEffectiveStock = (p: Product): number => {
  if (p.category === 'Combos' || p.category === 'Servicios' || p.category === 'Promociones') {
    return 999999;
  }
  const baseStock = typeof p.stock === 'number' && !isNaN(p.stock) ? p.stock : 0;
  if (p.expirationDates && p.expirationDates.length > 0) {
    const lotesSum = p.expirationDates.reduce((acc, r) => acc + (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)), 0);
    return Math.max(baseStock, lotesSum);
  }
  return baseStock;
};

export default function POS({ products, clients, shifts, config, user, onSaveSale, onRefreshData, onNavigate }: POSProps) {
  const currency = config.currency || 'Q';
  const taxName = config?.taxName || 'IVA';
  const taxRateVal = parseFloat(config?.taxRate || '12') || 0;
  const taxCalculation = config?.taxCalculation || 'Incluido';
  const currentShift = useMemo(() => shifts.find(s => s.state === 'open'), [shifts]);

  const [voucherType, setVoucherType] = useState<'ticket' | 'boleta' | 'factura' | 'recibo'>('ticket');
  const [saleType, setSaleType] = useState<'presencial' | 'delivery'>('presencial');

  // Main UI Tabs
  const [posMode, setPosMode] = useState<'classica' | 'rapida'>('classica');

  // Multi-cart Session State
  const [sessions, setSessions] = useState<CartSession[]>([
    { id: 1, cart: [], selectedClientId: 'general', discountType: 'percent', discountValue: '' }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<number>(1);

  // Active Session Helper
  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const cart = activeSession?.cart || [];
  const selectedClientId = activeSession?.selectedClientId || '';
  const discountType = activeSession?.discountType || 'percent';
  const discountValue = activeSession?.discountValue || '';

  // Other dynamic states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [pastSales, setPastSales] = useState<Sale[]>([]);

  // Modals and submission state
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isPendingOrdersModalOpen, setIsPendingOrdersModalOpen] = useState(false);
  const [isNuevoPedidoModalOpen, setIsNuevoPedidoModalOpen] = useState(false);
  const [isDevolucionesModalOpen, setIsDevolucionesModalOpen] = useState(false);
  const [isCotizacionesModalOpen, setIsCotizacionesModalOpen] = useState(false);

  // Overlap and visibility detection for floating mobile button vs static cart button
  const staticBtnRef = useRef<HTMLButtonElement | null>(null);
  const [isStaticBtnVisible, setIsStaticBtnVisible] = useState(false);

  useEffect(() => {
    const checkVisibility = () => {
      if (!staticBtnRef.current) {
        setIsStaticBtnVisible(false);
        return;
      }

      const rect = staticBtnRef.current.getBoundingClientRect();

      // Check if any part of the static button is in or very near the browser viewport
      const visible = 
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < window.innerHeight + 20 &&
        rect.bottom > -20 &&
        rect.left < window.innerWidth + 20 &&
        rect.right > -20;

      setIsStaticBtnVisible(visible);
    };

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            setIsStaticBtnVisible(entry.isIntersecting);
          }
        },
        {
          root: null,
          rootMargin: '20px',
          threshold: 0,
        }
      );

      if (staticBtnRef.current) {
        observer.observe(staticBtnRef.current);
      }
    }

    window.addEventListener('scroll', checkVisibility, { passive: true, capture: true });
    window.addEventListener('resize', checkVisibility, { passive: true });
    const interval = setInterval(checkVisibility, 200);

    checkVisibility();

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', checkVisibility, { capture: true } as any);
      window.removeEventListener('resize', checkVisibility);
      clearInterval(interval);
    };
  }, [cart]);

  // Success completed state
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Add Client Form
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientLimit, setNewClientLimit] = useState('');

  // Devolucion Form
  const [refundSaleId, setRefundSaleId] = useState('');
  const [refundSaleObj, setRefundSaleObj] = useState<Sale | null>(null);
  const [refundSuccessMsg, setRefundSuccessMsg] = useState('');

  // Special states for Combos, Services, Promos
  const [combos] = useState<Combo[]>(() => {
    const saved = localStorage.getItem('inventory_combos');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'c1', name: 'Combo Hamburguesa + Gaseosa', products: 'Hambuguesa Clásica, Coca-Cola 350ml', price: 45.0, cost: 25.0, status: 'Activo' },
      { id: 'c2', name: 'Dúo de Whiskys Black Label', products: '2x Whisky Black Label 750ml', price: 350.0, cost: 220.0, status: 'Activo' }
    ];
  });

  const [services] = useState<Service[]>(() => {
    const saved = localStorage.getItem('inventory_services');
    if (saved) return JSON.parse(saved);
    return [
      { id: 's1', name: 'Entrega a Domicilio (Delivery)', price: 15.0, category: 'Logística', icon: 'Truck', description: 'Envío express al domicilio del cliente' },
      { id: 's2', name: 'Soporte Técnico Especializado', price: 150.0, category: 'Soporte', icon: 'Wrench', description: 'Instalación y configuración de equipos' },
      { id: 's3', name: 'Envoltura de Regalo Premium', price: 5.0, category: 'Personalización', icon: 'Gift', description: 'Empaque de lujo para obsequios especiales' }
    ];
  });

  const [promos] = useState<Promo[]>(() => {
    const saved = localStorage.getItem('inventory_promos');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'p1', code: 'PROMO10', name: '10% de Descuento General', value: '10', type: 'percentage', status: 'Activo', expiration: '2027-12-31' },
      { id: 'p2', code: 'DESCUENTOS50', name: 'Q50.00 de Descuento', value: '50', type: 'fixed', status: 'Activo', expiration: '2027-12-31' }
    ];
  });

  // Add to Cart modal states
  const [selectedProductToAddToCart, setSelectedProductToAddToCart] = useState<POSProduct | null>(null);
  const [isAddToCartModalOpen, setIsAddToCartModalOpen] = useState(false);
  const [selectedPriceType, setSelectedPriceType] = useState<string>('retail');
  const [customPriceVal, setCustomPriceVal] = useState<string>('');
  const [selectedUnitType, setSelectedUnitType] = useState<string>('Unidad');
  const [selectedLoteVal, setSelectedLoteVal] = useState<string>('Lote 01');
  const [addToCartQty, setAddToCartQty] = useState<number>(1);

  // Helper to determine if a product is prescription-only (configured in Registrar Nuevo Producto)
  const isPrescriptionRequired = (product?: POSProduct | Product | null): boolean => {
    if (!product) return false;
    const req = (product.prescriptionRequired || '').toLowerCase().trim();
    return req === 'bajo receta médica' || req === 'receta médica retenida' || (req.includes('receta') && !req.includes('sin receta'));
  };

  // Modal "Registro de Receta" states
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [pendingPrescriptionItem, setPendingPrescriptionItem] = useState<{
    product: POSProduct;
    quantity: number;
    customPrice: number;
    selectedUnit: string;
    selectedLote: string;
  } | null>(null);

  // Form states for prescription
  const [rxPatientDpi, setRxPatientDpi] = useState('');
  const [rxPatientName, setRxPatientName] = useState('');
  const [rxPatientAge, setRxPatientAge] = useState('');
  const [rxPatientPhone, setRxPatientPhone] = useState('');
  const [rxDoctorName, setRxDoctorName] = useState('');
  const [rxDoctorLicense, setRxDoctorLicense] = useState('');
  const [rxInstitution, setRxInstitution] = useState('');
  const [rxPrescriptionNumber, setRxPrescriptionNumber] = useState('');
  const [rxPrescriptionDate, setRxPrescriptionDate] = useState('');
  const [rxPrescriptionType, setRxPrescriptionType] = useState('bajo receta médica');
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [rxIndications, setRxIndications] = useState('');
  const [rxRecipePhoto, setRxRecipePhoto] = useState<string | null>(null);
  const [rxFormError, setRxFormError] = useState('');
  const [previewEnlargedPhoto, setPreviewEnlargedPhoto] = useState<string | null>(null);

  // Live camera stream states
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStreamError, setCameraStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  const stopLiveCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraOpen(false);
    setCameraStreamError(null);
  };

  const startLiveCamera = async (mode: 'environment' | 'user' = 'environment') => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    setIsLiveCameraOpen(true);
    setCameraStreamError(null);
    setCameraFacingMode(mode);

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn('Video play error:', e));
        }
      } catch (err: any) {
        console.warn('High-res camera stream failed, trying basic:', err);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          cameraStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.warn(e));
          }
        } catch (fallbackErr: any) {
          setCameraStreamError('No se pudo acceder a la cámara en vivo. Puedes usar el botón "Tomar Foto con Cámara" para activar directamente la cámara nativa de tu dispositivo.');
        }
      }
    }, 150);
  };

  const capturePhotoFromLiveCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setRxRecipePhoto(dataUrl);
      stopLiveCamera();
    }
  };

  const toggleCameraFacing = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    startLiveCamera(nextMode);
  };

  // State to view existing prescription from cart item
  const [viewingPrescriptionItem, setViewingPrescriptionItem] = useState<CartItem | null>(null);

  const isAnyModalOpen = isCartModalOpen || isAddClientModalOpen || isCheckoutModalOpen || isPendingOrdersModalOpen || isNuevoPedidoModalOpen || isDevolucionesModalOpen || isCotizacionesModalOpen || isPrescriptionModalOpen || !!viewingPrescriptionItem || isLiveCameraOpen || !!previewEnlargedPhoto;

  const availableLotes = useMemo(() => {
    if (!selectedProductToAddToCart) return [];
    const effStock = getProductEffectiveStock(selectedProductToAddToCart);
    
    // If it has specific multiple expirationDates, filter out empty/zero-stock ones
    if (selectedProductToAddToCart.expirationDates && selectedProductToAddToCart.expirationDates.length > 0) {
      const validExpDates = selectedProductToAddToCart.expirationDates.filter(r => {
        const s = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
        return s > 0;
      });

      if (validExpDates.length > 0) {
        const sumLoteStock = validExpDates.reduce((sum, r) => sum + (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)), 0);

        return validExpDates.map((r, idx) => {
          const batchName = r.batch || selectedProductToAddToCart.initialBatch || `Lote ${String(idx + 1).padStart(2, '0')}`;
          let dateStr = 'S/V';
          if (r.date && r.date !== '—') {
            if (r.date.includes('-')) {
              const parts = r.date.split('-');
              if (parts.length === 3) {
                dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
              } else {
                dateStr = r.date;
              }
            } else {
              dateStr = r.date;
            }
          }
          
          const rawLoteStock = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
          let loteStock = rawLoteStock;
          if (validExpDates.length === 1 && effStock > 0) {
            loteStock = effStock;
          } else if (sumLoteStock !== effStock && sumLoteStock > 0) {
            const ratio = rawLoteStock / sumLoteStock;
            loteStock = Math.round(effStock * ratio);
          } else if (sumLoteStock === 0 && idx === 0) {
            loteStock = effStock;
          }

          return {
            value: `${batchName} – Vence: ${dateStr}`,
            label: `${batchName} – Vence: ${dateStr} (Stock: ${loteStock})`,
            stock: loteStock
          };
        });
      }
    }

    // If it only has single expirationDate/batch and effStock > 0
    if (effStock > 0 && (selectedProductToAddToCart.expirationDate || selectedProductToAddToCart.initialBatch)) {
      const batchName = selectedProductToAddToCart.initialBatch || 'Lote 01';
      let dateStr = 'No aplica';
      if (selectedProductToAddToCart.expirationDate && selectedProductToAddToCart.expirationDate !== '—') {
        if (selectedProductToAddToCart.expirationDate.includes('-')) {
          const parts = selectedProductToAddToCart.expirationDate.split('-');
          if (parts.length === 3) {
            dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else {
            dateStr = selectedProductToAddToCart.expirationDate;
          }
        } else {
          dateStr = selectedProductToAddToCart.expirationDate;
        }
      }
      return [{
        value: `${batchName} – Vence: ${dateStr}`,
        label: `${batchName} – Vence: ${dateStr} (Stock: ${effStock})`,
        stock: effStock
      }];
    }

    // Default if none or 0 stock
    return [{
      value: 'Lote General',
      label: `Lote General (Stock: ${effStock})`,
      stock: effStock
    }];
  }, [selectedProductToAddToCart]);

  // Keep selectedLoteVal valid
  useEffect(() => {
    if (availableLotes.length > 0) {
      const exists = availableLotes.some(l => l.value === selectedLoteVal);
      if (!exists) {
        setSelectedLoteVal(availableLotes[0].value);
      }
    }
  }, [availableLotes, selectedLoteVal]);

  // Keep selectedProductToAddToCart updated when products change
  useEffect(() => {
    if (selectedProductToAddToCart) {
      const fresh = products.find(p => p.id === selectedProductToAddToCart.id);
      if (fresh) {
        const effStock = getProductEffectiveStock(fresh);
        setSelectedProductToAddToCart({
          ...fresh,
          stock: effStock
        });
      }
    }
  }, [products]);

  const selectedLoteObj = useMemo(() => {
    if (!availableLotes || availableLotes.length === 0) return null;
    return availableLotes.find(l => l.value === selectedLoteVal) || availableLotes[0];
  }, [availableLotes, selectedLoteVal]);

  const currentAvailableStock = useMemo(() => {
    if (!selectedProductToAddToCart) return 0;
    if (selectedLoteObj && typeof selectedLoteObj.stock === 'number') {
      return selectedLoteObj.stock;
    }
    return getProductEffectiveStock(selectedProductToAddToCart);
  }, [selectedProductToAddToCart, selectedLoteObj]);

  const openAddToCartModal = (product: POSProduct) => {
    if (product.isPromoItem) {
      updateActiveSession(s => ({
        ...s,
        discountType: product.promoType === 'percentage' ? 'percent' : 'fixed',
        discountValue: product.promoValue || ''
      }));
      alert(`Promoción "${product.name}" aplicada al carrito.`);
      return;
    }

    const effStock = getProductEffectiveStock(product);
    const effectiveProd = {
      ...product,
      stock: effStock
    };

    let initialLote = 'Lote General';
    if (effectiveProd.expirationDates && effectiveProd.expirationDates.length > 0) {
      const first = effectiveProd.expirationDates[0];
      const batchName = first.batch || effectiveProd.initialBatch || 'Lote 01';
      let dateStr = 'S/V';
      if (first.date && first.date !== '—') {
        if (first.date.includes('-')) {
          const parts = first.date.split('-');
          dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : first.date;
        } else {
          dateStr = first.date;
        }
      }
      initialLote = `${batchName} – Vence: ${dateStr}`;
    } else if (effectiveProd.expirationDate || effectiveProd.initialBatch) {
      const batchName = effectiveProd.initialBatch || 'Lote 01';
      let dateStr = 'No aplica';
      if (effectiveProd.expirationDate && effectiveProd.expirationDate !== '—') {
        if (effectiveProd.expirationDate.includes('-')) {
          const parts = effectiveProd.expirationDate.split('-');
          dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : effectiveProd.expirationDate;
        } else {
          dateStr = effectiveProd.expirationDate;
        }
      }
      initialLote = `${batchName} – Vence: ${dateStr}`;
    }

    setSelectedProductToAddToCart(effectiveProd);
    setSelectedLoteVal(initialLote);
    setSelectedPriceType('retail');
    setCustomPriceVal((effectiveProd.pricePerUnit || effectiveProd.price).toFixed(2));
    setSelectedUnitType('Unidad');
    setAddToCartQty(1);
    setIsAddToCartModalOpen(true);
  };

  // Cotizacion State
  const [quoteItems, setQuoteItems] = useState<CartItem[]>([]);
  const [quoteClientName, setQuoteClientName] = useState('');

  // Nuevo Pedido Form
  const [orderClientName, setOrderClientName] = useState('');
  const [orderItems, setOrderItems] = useState<CartItem[]>([]);
  const [orderSearch, setOrderSearch] = useState('');

  // Local state for pending orders (starts with 2 pre-populated from screenshot)
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);

  // Seed pending orders dynamically when products load
  useEffect(() => {
    if (products.length > 0 && pendingOrders.length === 0) {
      const p1 = products.find(p => p.name.toLowerCase().includes('ron')) || products[0];
      const p2 = products.find(p => p.name.toLowerCase().includes('inca')) || products[0];
      const p3 = products.find(p => p.name.toLowerCase().includes('vodka')) || products[0];

      setPendingOrders([
        {
          id: 'PED-0412',
          customerName: 'Alejandro Ruiz',
          total: 31.50,
          items: [
            { name: p1.name, price: p1.price, quantity: 1, product: p1 },
            { name: p2.name, price: p2.price, quantity: 1, product: p2 }
          ]
        },
        {
          id: 'PED-0415',
          customerName: 'María Delgado',
          total: 43.50,
          items: [
            { name: p3.name, price: p3.price, quantity: 2, product: p3 }
          ]
        }
      ]);
    }
  }, [products]);

  // Load past sales for return simulation
  useEffect(() => {
    api.getSales()
      .then(setPastSales)
      .catch(err => console.error('Error fetching past sales:', err));
  }, []);

  // Default client selector
  const defaultClient = useMemo(() => {
    return 'general';
  }, []);

  useEffect(() => {
    if (!selectedClientId && defaultClient) {
      setSessions(prev => prev.map(s => s.id === activeSessionId && !s.selectedClientId ? { ...s, selectedClientId: defaultClient } : s));
    }
  }, [defaultClient, selectedClientId, activeSessionId]);

  // Get unique categories list from config/localstorage plus actual products
  const categories = useMemo(() => {
    const masterCats = (() => {
      if (config.categories && config.categories.length > 0) {
        return config.categories;
      }
      const saved = localStorage.getItem('settings_categories');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as string[];
          if (parsed && parsed.length > 0) return parsed;
        } catch (e) {}
      }
      if (config.businessType === 'pharmacy') {
        return ['Medicamentos', 'Cuidado Personal', 'Dispositivos Médicos', 'Suplementos', 'Fórmulas', 'Perfumería'];
      } else if (config.businessType === 'bookstore') {
        return ['Útiles Escolares', 'Oficina', 'Cuadernos', 'Libros', 'Papelería', 'Arte/Dibujo'];
      } else if (config.businessType === 'hardware') {
        return ['Herramientas', 'Tornillería', 'Pinturas', 'Plomería', 'Electricidad', 'Seguridad', 'Construcción', 'General / Otros'];
      } else {
        return ['Abarrotes', 'Bebidas', 'Snacks', 'Limpieza', 'Lácteos', 'General', 'Otros'];
      }
    })();

    const productCats = products.map(p => p.category).filter(Boolean);
    const combined = new Set([...masterCats, ...productCats]);
    return ['Todos', ...Array.from(combined), 'Combos', 'Servicios', 'Promociones'];
  }, [products, config]);

  // Filter products based on search and selected category
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Combos') {
      const activeCombos = combos.filter(c => c.status === 'Activo');
      const mapped = activeCombos.map(c => ({
        id: c.id,
        code: 'COMBO-' + c.id.toUpperCase(),
        name: c.name,
        price: c.price,
        cost: c.cost,
        stock: 999999,
        minStock: 0,
        category: 'Combos',
        unit: 'Combo',
        description: c.products,
        status: 'Activo' as const,
        lotes: []
      }));
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return mapped.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));
      }
      return mapped;
    }

    if (selectedCategory === 'Servicios') {
      const mapped = services.map(s => ({
        id: s.id,
        code: 'SERV-' + s.id.toUpperCase(),
        name: s.name,
        price: s.price,
        cost: 0,
        stock: 999999,
        minStock: 0,
        category: 'Servicios',
        unit: 'Servicio',
        description: s.description,
        status: 'Activo' as const,
        lotes: []
      }));
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return mapped.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));
      }
      return mapped;
    }

    if (selectedCategory === 'Promociones') {
      const activePromos = promos.filter(p => p.status === 'Activo');
      const mapped = activePromos.map(p => ({
        id: p.id,
        code: p.code,
        name: `${p.name} (${p.code})`,
        price: p.type === 'percentage' ? 0 : parseFloat(p.value),
        cost: 0,
        stock: 999999,
        minStock: 0,
        category: 'Promociones',
        unit: 'Promo',
        description: `Promo ${p.type === 'percentage' ? p.value + '%' : currency + p.value} - Vence: ${p.expiration}`,
        status: 'Activo' as const,
        lotes: [],
        isPromoItem: true,
        promoValue: p.value,
        promoType: p.type
      }));
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return mapped.filter(p => 
          p.name.toLowerCase().includes(query) || 
          p.code.toLowerCase().includes(query) || 
          p.description.toLowerCase().includes(query)
        );
      }
      return mapped;
    }

    let result = products;

    if (selectedCategory !== 'Todos') {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(query);
        const codeMatch = p.code?.toLowerCase().includes(query);
        const catMatch = p.category?.toLowerCase().includes(query);
        const detailMatch = p.detail?.toLowerCase().includes(query);
        const descMatch = (p as any).description?.toLowerCase().includes(query);
        const barcodeMatch = p.barcode?.toLowerCase().includes(query);
        const symptomsMatch = p.symptoms?.toLowerCase().includes(query);
        const labMatch = p.laboratory?.toLowerCase().includes(query);

        return nameMatch || codeMatch || catMatch || detailMatch || descMatch || barcodeMatch || symptomsMatch || labMatch;
      });
    }

    return result;
  }, [searchQuery, selectedCategory, products, combos, services, promos]);

  // Updater for the active session state helper
  const updateActiveSession = (updater: (s: CartSession) => CartSession) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? updater(s) : s));
  };

  // Cart actions
  const addToCart = (product: POSProduct) => {
    if (product.isPromoItem) {
      updateActiveSession(s => ({
        ...s,
        discountType: product.promoType === 'percentage' ? 'percent' : 'fixed',
        discountValue: product.promoValue || ''
      }));
      alert(`Promoción "${product.name}" aplicada al carrito.`);
      return;
    }

    const isSpecial = product.category === 'Combos' || product.category === 'Servicios';
    const effStock = getProductEffectiveStock(product);
    if (!isSpecial && effStock <= 0) {
      alert(`El producto "${product.name}" no tiene stock disponible.`);
      return;
    }

    if (isPrescriptionRequired(product)) {
      openAddToCartModal(product);
      return;
    }

    updateActiveSession(s => {
      const existing = s.cart.find(item => item.product.id === product.id);
      if (existing) {
        if (!isSpecial && existing.quantity >= effStock) {
          alert(`No puedes agregar más. Stock disponible: ${effStock}`);
          return s;
        }
        return {
          ...s,
          cart: s.cart.map(item => 
            item.product.id === product.id 
              ? { ...item, quantity: item.quantity + 1 } 
              : item
          )
        };
      }
      return {
        ...s,
        cart: [...s.cart, { product: { ...product, stock: effStock }, quantity: 1, selectedUnit: isSpecial ? (product.category === 'Combos' ? 'Combo' : 'Servicio') : undefined }]
      };
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    updateActiveSession(s => {
      const updatedCart = s.cart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          
          const isSpecial = item.product.category === 'Combos' || item.product.category === 'Servicios';
          const mult = isSpecial 
            ? 1 
            : (item.selectedUnit === 'Blíster' 
                ? (item.product.unitsPerBlister && item.product.unitsPerBlister > 0 ? item.product.unitsPerBlister : 1) 
                : (item.selectedUnit === 'Caja' 
                    ? (item.product.unitsPerBox && item.product.unitsPerBox > 0 ? item.product.unitsPerBox : 1) 
                    : 1));
          const totalPhysicalUnits = newQty * mult;
          const effStock = getProductEffectiveStock(item.product);

          if (!isSpecial && totalPhysicalUnits > effStock) {
            alert(`No puedes agregar más. Stock disponible: ${effStock} unidades. (Estás intentando agregar ${newQty} ${item.selectedUnit || 'unidades'}, lo que equivale a ${totalPhysicalUnits} unidades físicas).`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];

      return {
        ...s,
        cart: updatedCart
      };
    });
  };

  const removeFromCart = (productId: string) => {
    updateActiveSession(s => ({
      ...s,
      cart: s.cart.filter(item => item.product.id !== productId)
    }));
  };

  const clearCart = () => {
    updateActiveSession(s => ({
      ...s,
      cart: []
    }));
  };

  // Cart calculations
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + ((item.customPrice ?? item.product.price) * item.quantity), 0);
    
    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = subtotal * (parseFloat(discountValue) || 0) / 100;
    } else {
      discountAmount = parseFloat(discountValue) || 0;
    }
    
    const taxableBase = Math.max(0, subtotal - discountAmount);
    
    let total = taxableBase;
    let iva = 0;
    const rate = taxRateVal / 100;

    if (taxCalculation === 'Sumar') {
      iva = taxableBase * rate;
      total = taxableBase + iva;
    } else {
      // 'Incluido'
      iva = taxableBase - (taxableBase / (1 + rate));
      total = taxableBase;
    }

    const cost = cart.reduce((acc, item) => acc + (item.product.cost * item.quantity), 0);
    const profit = total - cost;

    return { subtotal, discountAmount, total, profit, iva };
  }, [cart, discountType, discountValue, taxRateVal, taxCalculation]);

  const changeDue = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    const diff = received - cartTotals.total;
    return diff >= 0 ? diff : 0;
  }, [cashReceived, cartTotals.total]);

  // Sessions management
  const handleAddSession = () => {
    const nextId = sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) + 1 : 1;
    setSessions(prev => [
      ...prev,
      { id: nextId, cart: [], selectedClientId: defaultClient, discountType: 'percent', discountValue: '' }
    ]);
    setActiveSessionId(nextId);
  };

  const handleCloseSession = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      // Just clear
      setSessions([{ id: 1, cart: [], selectedClientId: defaultClient, discountType: 'percent', discountValue: '' }]);
      setActiveSessionId(1);
      return;
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[remaining.length - 1].id);
    }
  };

  // Add client submit
  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    try {
      const saved = await api.saveClient({
        id: '',
        name: newClientName,
        phone: newClientPhone || 'Sin teléfono',
        email: newClientEmail || 'sin@email.com',
        limitCredit: parseFloat(newClientLimit) || 0,
        balanceCredit: 0
      });

      onRefreshData();
      updateActiveSession(s => ({ ...s, selectedClientId: saved.id }));
      setIsAddClientModalOpen(false);
      
      // Reset form
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setNewClientLimit('');
    } catch (err: any) {
      alert('Error al guardar cliente: ' + err.message);
    }
  };

  // Checkout transaction finalization
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingSale) return;

    if (!currentShift) {
      setErrorMessage('Debe abrir la caja registradora para poder vender.');
      return;
    }
    if (cart.length === 0) {
      setErrorMessage('El carrito de compras está vacío.');
      return;
    }

    const receivedNum = parseFloat(cashReceived) || cartTotals.total;
    if (paymentMethod === 'cash' && receivedNum < cartTotals.total) {
      setErrorMessage('El efectivo recibido es menor que el total de la venta.');
      return;
    }

    const newSale: Sale = {
      id: '',
      date: new Date().toISOString(),
      items: cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.customPrice ?? item.product.price,
        cost: item.product.cost,
        selectedUnit: item.selectedUnit,
        selectedLote: item.selectedLote,
        prescription: item.prescription
      })),
      total: cartTotals.total,
      profit: cartTotals.profit,
      received: paymentMethod === 'cash' ? receivedNum : cartTotals.total,
      change: paymentMethod === 'cash' ? (receivedNum - cartTotals.total) : 0,
      paymentMethod,
      clientId: (selectedClientId && selectedClientId !== 'general') ? selectedClientId : undefined,
      shiftId: currentShift.id,
      operatorId: user?.id || '',
      operatorName: user?.name || 'Administrador',
      voucherType: voucherType,
      saleType: saleType
    };

    setIsSubmittingSale(true);
    try {
      const saved = await onSaveSale(newSale);
      setCompletedSale(saved);
      
      // Clear current cart session
      updateActiveSession(s => ({ ...s, cart: [], discountValue: '' }));
      setCashReceived('');
      setIsCheckoutModalOpen(false);
      setIsCartModalOpen(false);
      setErrorMessage('');
      onRefreshData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar la venta');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Load a pending order into current cart
  const handleLoadPendingOrder = (order: PendingOrder) => {
    updateActiveSession(s => {
      const newCart = [...s.cart];
      order.items.forEach(orderItem => {
        const existing = newCart.find(item => item.product.id === orderItem.product.id);
        if (existing) {
          existing.quantity += orderItem.quantity;
        } else {
          newCart.push({ product: orderItem.product, quantity: orderItem.quantity });
        }
      });
      return { ...s, cart: newCart };
    });

    // Remove from pending orders list
    setPendingOrders(prev => prev.filter(o => o.id !== order.id));
    setIsPendingOrdersModalOpen(false);
  };

  // Submit return refund
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundSaleId) return;

    const saleToRefund = pastSales.find(s => s.id.toLowerCase().includes(refundSaleId.toLowerCase()) || s.id === refundSaleId);
    if (!saleToRefund) {
      alert('Venta no encontrada.');
      return;
    }

    setRefundSaleObj(saleToRefund);
  };

  const handleConfirmRefund = async () => {
    if (!refundSaleObj) return;
    try {
      // Simulate/execute refund logic
      // In a real application, you would save negative sale or delete. Let's register a reversed sale
      const reversedSale: Sale = {
        ...refundSaleObj,
        id: '',
        total: -refundSaleObj.total,
        profit: -refundSaleObj.profit,
        date: new Date().toISOString(),
        items: refundSaleObj.items.map(i => ({ ...i, quantity: -i.quantity }))
      };
      await onSaveSale(reversedSale);
      setRefundSuccessMsg('¡La devolución se procesó exitosamente! Inventario reintegrado.');
      setRefundSaleObj(null);
      setRefundSaleId('');
      onRefreshData();
    } catch (err: any) {
      alert('Error al devolver: ' + err.message);
    }
  };

  // Quote submit print
  const handlePrintQuote = () => {
    if (quoteItems.length === 0) {
      alert('Agregue productos a la cotización.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Ventana bloqueada. Permita popups.');
      return;
    }

    const totalQuote = quoteItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const itemsRows = quoteItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${currency}${item.product.price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${currency}${(item.product.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cotización - ${config.storeName}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; }
            .details { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f4f4f4; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
            .total { text-align: right; font-size: 1.2rem; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${config.storeName}</h2>
            <p>Documento de Cotización de Productos</p>
          </div>
          <div class="details">
            <p><strong>Cliente:</strong> ${quoteClientName || 'Cliente General'}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align: center;">Cantidad</th>
                <th style="text-align: right;">Precio Unitario</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div class="total">
            Total Cotizado: ${currency}${totalQuote.toFixed(2)}
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
    setIsCotizacionesModalOpen(false);
  };

  // Create new order submit
  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderClientName || orderItems.length === 0) {
      alert('Por favor, asigne un cliente y al menos 1 producto.');
      return;
    }

    const newOrder: PendingOrder = {
      id: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: orderClientName,
      total: orderItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0),
      items: orderItems.map(item => ({
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        product: item.product
      }))
    };

    setPendingOrders(prev => [newOrder, ...prev]);
    alert('¡Pedido registrado como pendiente!');
    setOrderClientName('');
    setOrderItems([]);
    setIsNuevoPedidoModalOpen(false);
  };

  const selectedClientObj = useMemo(() => {
    return clients.find(c => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  return (
    <div id="pos-view" className="space-y-6">
      
      {/* 1. TOP HEADER & QUICK ACTION BUTTONS (Neat, minimized and elegant) */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 lg:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        {/* Header Title & Subtitle */}
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-2.5">
            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-[#0086F0] shrink-0" />
            <span className="truncate">Punto de Venta</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium truncate sm:whitespace-normal">
            Registra transacciones, administra pedidos y emite facturas en tiempo real.
          </p>
        </div>

        {/* Minimized & Clean Action Buttons Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1. Nuevo Pedido */}
          <button
            type="button"
            onClick={() => setIsNuevoPedidoModalOpen(true)}
            className="h-8.5 sm:h-9 px-2.5 sm:px-3 bg-[#0e9f6e] hover:bg-[#0b8a5c] active:scale-[0.98] text-white text-xs font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5 shrink-0 text-white" />
            <span className="truncate">Nuevo Pedido</span>
          </button>

          {/* 2. Ver Pedidos */}
          <button
            type="button"
            onClick={() => setIsPendingOrdersModalOpen(true)}
            className="h-8.5 sm:h-9 px-2.5 sm:px-3 bg-[#d97706] hover:bg-[#b45309] active:scale-[0.98] text-white text-xs font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Star className="w-3.5 h-3.5 shrink-0 text-white fill-white/30" />
            <span className="truncate">Ver Pedidos</span>
            <span className="px-1.5 py-0.2 bg-black/20 text-white text-[10px] font-black rounded-full leading-tight">
              {pendingOrders.length > 0 ? pendingOrders.length : 2}
            </span>
          </button>

          {/* 3. Devoluciones */}
          <button
            type="button"
            onClick={() => setIsDevolucionesModalOpen(true)}
            className="h-8.5 sm:h-9 px-2.5 sm:px-3 bg-[#3f4a56] hover:bg-[#323b45] active:scale-[0.98] text-white text-xs font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Undo2 className="w-3.5 h-3.5 shrink-0 text-white" />
            <span className="truncate">Devoluciones</span>
          </button>

          {/* 4. Cotizaciones */}
          <button
            type="button"
            onClick={() => setIsCotizacionesModalOpen(true)}
            className="h-8.5 sm:h-9 px-2.5 sm:px-3 bg-[#3b82f6] hover:bg-[#2563eb] active:scale-[0.98] text-white text-xs font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-white" />
            <span className="truncate">Cotizaciones</span>
          </button>

          {/* 5. Cerrar Turno */}
          <button
            type="button"
            onClick={() => onNavigate('apertura-cierre')}
            className="col-span-2 sm:col-span-1 lg:col-span-auto h-8.5 sm:h-9 px-2.5 sm:px-3 bg-[#f05252] hover:bg-[#e02424] active:scale-[0.98] text-white text-xs font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 shrink-0 text-white" />
            <span className="truncate">Cerrar Turno</span>
          </button>
        </div>
      </div>

      {/* 2. MODE SELECTOR (Venta Clasica vs Venta Rapida) */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setPosMode('classica')}
          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            posMode === 'classica' 
              ? 'border-b-2 border-[#0086F0] text-[#0086F0] bg-white rounded-t-xl' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Venta Clásica
        </button>
        <button
          onClick={() => setPosMode('rapida')}
          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            posMode === 'rapida' 
              ? 'border-b-2 border-[#0086F0] text-[#0086F0] bg-white rounded-t-xl' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Venta Rápida
        </button>
      </div>

      {/* 3. SALES SESSIONS (Multiple Cart Sessions e.g., "1", "2", "+ Nueva Venta") */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-black tracking-wide flex items-center gap-1.5 sm:gap-2 transition-all shadow-2xs border cursor-pointer ${
              activeSessionId === s.id
                ? 'bg-[#0086F0] border-[#0086F0] text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{s.id}</span>
            <span 
              onClick={(e) => handleCloseSession(s.id, e)}
              className="text-[10px] hover:text-rose-200 leading-none p-0.5 rounded-full transition-colors"
              title="Cerrar venta"
            >
              ×
            </span>
          </button>
        ))}
        <button
          onClick={handleAddSession}
          className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-white border border-dashed border-slate-300 rounded-lg sm:rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva Venta
        </button>
      </div>

      {/* 4. MAIN POS GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* Left Column: Product Search, Filter & Catalog Grid */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">
          
          {/* Search bar & Category dropdown (Exact match to reference) */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-center">
            
            {/* Search input */}
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <input
                type="text"
                placeholder="Buscar por nombre, código, descripción o escanear..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-3.5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] text-xs font-semibold bg-white text-slate-800"
              />
            </div>

            {/* Layout control and Category selector */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <span className="p-2 sm:p-2.5 bg-slate-50 rounded-lg sm:rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer hidden sm:block">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-slate-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 bg-white text-slate-600 text-xs font-bold cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] w-full sm:w-40"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* VENTA CLASSICA: Visual Grid with Smooth Scrollable Viewport & Stock Badge & Images */}
          {posMode === 'classica' && (
            <div className="max-h-[620px] sm:max-h-[680px] overflow-y-auto pr-1 pb-3 scroll-smooth">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map(p => {
                  const effStock = getProductEffectiveStock(p);
                  const stockColor = effStock <= 0 ? 'bg-rose-500' : effStock <= p.minStock ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <div 
                      key={p.id}
                      onClick={() => openAddToCartModal(p)}
                      className="bg-white rounded-2xl border border-slate-150 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer relative flex flex-col"
                    >
                      {/* Stock indicator badge exactly as shown in reference */}
                      <div className={`absolute top-2.5 right-2.5 ${stockColor} text-white font-black text-[10px] px-2 py-0.5 rounded-lg shadow-sm z-10`}>
                        {effStock}
                      </div>

                      {/* Prescription badge if product is bajo receta médica */}
                      {isPrescriptionRequired(p) && (
                        <div className="absolute top-2.5 left-2.5 bg-rose-600/95 text-white font-black text-[9px] px-2 py-0.5 rounded-lg shadow-sm z-10 flex items-center gap-1 uppercase tracking-wider backdrop-blur-2xs">
                          <Stethoscope className="w-2.5 h-2.5" />
                          <span>Receta</span>
                        </div>
                      )}

                      {/* Image space (using matching Unsplash photography for real visuals) */}
                      <div className="h-32 bg-slate-50 flex items-center justify-center p-3 relative select-none">
                        <img 
                          src={getProductImage(p)} 
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain mix-blend-multiply"
                        />
                      </div>

                      {/* Description & Name */}
                      <div className="p-3 text-center flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-[11px] font-bold text-slate-800 line-clamp-2 uppercase min-h-[32px]">
                            {p.name}
                          </h4>
                          <div className="text-[13px] font-extrabold text-[#0086F0] font-mono mt-1">
                            {currency}/{p.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-[9px] font-black tracking-wide text-slate-400 uppercase mt-2">
                          {p.category}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-100 p-8 text-slate-400">
                    <SlidersHorizontal className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm">No se encontraron productos coincidentes en esta categoría.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VENTA RAPIDA: Fast List view optimized for keyboard or fast search */}
          {posMode === 'rapida' && (
            <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-xs">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-2 mb-3">Lista de Productos</h3>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
                {filteredProducts.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => openAddToCartModal(p)}
                    className="flex items-center justify-between py-3 px-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-800">{p.name}</h4>
                        {isPrescriptionRequired(p) && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 font-extrabold px-1.5 py-0.2 rounded border border-rose-200 uppercase flex items-center gap-0.5">
                            <Stethoscope className="w-2.5 h-2.5" />
                            Receta
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Cód: {p.code} | Stock: <span className="font-bold text-slate-600">{getProductEffectiveStock(p)}</span></p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <span className="text-xs font-extrabold text-[#0086F0] font-mono">{currency}{p.price.toFixed(2)}</span>
                      <button 
                        className="px-2.5 py-1 bg-slate-100 text-[#0086F0] hover:bg-[#0086F0] hover:text-white rounded-lg text-[10px] font-black transition-colors"
                        onClick={(e) => { e.stopPropagation(); openAddToCartModal(p); }}
                      >
                        + AGREGAR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Checkout Sidebar Pane (Exact layout from screenshot) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-150 shadow-xs overflow-hidden flex flex-col">
          
          {/* Header layout exactly modeled from "Carrito de Compra" */}
          <div className="bg-[#0086F0] text-white px-5 py-4 flex items-center gap-2 shrink-0">
            <ShoppingCart className="w-5 h-5 text-sky-100" />
            <h2 className="font-bold text-sm tracking-wide">Carrito de Compra</h2>
          </div>

          {/* Sidebar content container */}
          <div className="p-5 space-y-6 flex-1 flex flex-col justify-between">
            
            <div className="space-y-5 flex-1">
              {/* Client Selection Row */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente</label>
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => updateActiveSession(s => ({ ...s, selectedClientId: e.target.value }))}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                  >
                    <option value="general">Cliente General</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.balanceCredit > 0 ? `(Debe: ${currency}${c.balanceCredit.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer h-9 w-9 flex items-center justify-center shrink-0"
                    title="Registrar nuevo cliente"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cart items list / Empty cart illustration */}
              <div className="border-t border-slate-100 pt-3">
                {cart.length === 0 ? (
                  <div className="py-14 flex flex-col items-center justify-center text-slate-400 text-center select-none">
                    {/* Centered Cart Empty Illustration */}
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-3 text-slate-300">
                      <ShoppingCart className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-xs text-slate-700">Carrito vacío</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Agrega productos para comenzar</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[11px] font-bold text-slate-800 truncate uppercase">{item.product.name}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono font-bold text-[#0086F0]">{currency}{(item.customPrice ?? item.product.price).toFixed(2)}</span>
                            {item.selectedUnit && (
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded">{item.selectedUnit}</span>
                            )}
                            {item.selectedLote && (
                              <span className="text-[9px] bg-teal-50 text-teal-600 px-1 rounded truncate max-w-[80px]" title={item.selectedLote}>
                                {item.selectedLote.split('–')[0].trim()}
                              </span>
                            )}
                            {item.prescription && (
                              <button
                                type="button"
                                onClick={() => setViewingPrescriptionItem(item)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-[#0086F0] border border-sky-200 text-[9px] font-black tracking-tight transition-colors cursor-pointer"
                                title="Ver receta médica registrada"
                              >
                                <FileSignature className="w-2.5 h-2.5 text-[#0086F0]" />
                                <span>Receta</span>
                                <Eye className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center border border-slate-150 rounded-lg bg-slate-50/50 p-0.5">
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 hover:bg-white text-slate-500 rounded transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-mono font-black text-slate-800 min-w-[20px] text-center">
                            {item.quantity}
                          </span>
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 hover:bg-white text-slate-500 rounded transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Calculations & Discounts & Actions bottom section */}
            <div className="border-t border-slate-100 pt-4 space-y-4 shrink-0">
              
              {/* Discount selection row */}
              <div className="flex items-center gap-2.5 text-xs">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Descuento</span>
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden w-full bg-white">
                  <span className="pl-3.5 text-slate-400 font-bold font-mono text-[11px]">
                    {discountType === 'fixed' ? currency : '%'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => updateActiveSession(s => ({ ...s, discountValue: e.target.value }))}
                    className="w-full px-2 py-1 bg-transparent text-slate-800 font-bold focus:outline-hidden text-right text-xs"
                  />
                  <div className="flex border-l border-slate-200 shrink-0 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => updateActiveSession(s => ({ ...s, discountType: 'percent' }))}
                      className={`px-3 py-1 font-extrabold text-[10px] ${
                        discountType === 'percent' 
                          ? 'bg-[#0086F0] text-white' 
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveSession(s => ({ ...s, discountType: 'fixed' }))}
                      className={`px-3 py-1 font-extrabold text-[10px] ${
                        discountType === 'fixed' 
                          ? 'bg-[#0086F0] text-white' 
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {currency}
                    </button>
                  </div>
                </div>
              </div>

              {/* Price list values */}
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 space-y-2.5 font-mono text-xs">
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>Subtotal:</span>
                  <span>{currency}/{cartTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>Descuento:</span>
                  <span className="text-rose-500 font-bold">-{currency}/{cartTotals.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>{taxName} ({taxRateVal.toFixed(2)}%):</span>
                  <span>{currency}/{cartTotals.iva.toFixed(2)}</span>
                </div>
                
                {/* LARGE TOTAL VALUE IN GREEN COLOURED STYLE EXACTLY LIKE SCREENSHOT */}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black items-center">
                  <span className="text-slate-800 text-xs tracking-wider uppercase font-sans">Total:</span>
                  <span className="text-emerald-500 text-xl tracking-tight">
                    {currency}/{cartTotals.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Main submit button in green (pill shape matched from screenshot) */}
              <button
                ref={staticBtnRef}
                type="button"
                disabled={cart.length === 0 || isSubmittingSale}
                onClick={() => {
                  if (isSubmittingSale) return;
                  setIsCheckoutModalOpen(true);
                }}
                className="w-full py-4 bg-[#0e9f6e] hover:bg-[#0b8a5c] active:scale-[0.98] text-white rounded-full text-sm font-extrabold tracking-wider uppercase transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 border border-emerald-400/30"
              >
                {isSubmittingSale ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>PROCESANDO...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>PROCESAR VENTA</span>
                  </>
                )}
              </button>

              {/* Footer navigation tools */}
              <div className="flex items-center justify-between text-[11px] font-bold px-1 text-slate-400">
                <button
                  type="button"
                  onClick={() => onNavigate('historial-ventas')}
                  className="hover:text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Historial de Ventas
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar Carrito
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING MOBILE & IPHONE BOTTOM CHECKOUT BUTTON */}
      {cart.length > 0 && !isAnyModalOpen && !isStaticBtnVisible && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 lg:hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          <button
            type="button"
            disabled={cart.length === 0 || isSubmittingSale}
            onClick={() => {
              if (isSubmittingSale) return;
              setIsCartModalOpen(true);
            }}
            className="w-[270px] h-[45px] px-4 bg-[#0e9f6e] hover:bg-[#0b8a5c] active:scale-[0.98] text-white rounded-full text-xs font-extrabold tracking-wider uppercase transition-all shadow-xl shadow-emerald-700/25 flex items-center justify-between gap-2 cursor-pointer border border-emerald-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-1.5">
              {isSubmittingSale ? (
                <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-white shrink-0" />
              )}
              <span className="truncate">{isSubmittingSale ? 'PROCESANDO...' : 'PROCESAR VENTA'}</span>
            </div>
            <span className="bg-emerald-800/60 text-emerald-100 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0">
              {currency}/{cartTotals.total.toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* ========================================================
          MODALS & OVERLAYS INTERFACES
      ======================================================== */}

      {/* MODAL 0: CARRITO DE COMPRA */}
      {isCartModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-start sm:items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden border border-slate-100 my-auto flex flex-col max-h-[90vh]">
            
            {/* Header matching Carrito de Compra style */}
            <div className="bg-[#0086F0] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-sky-100" />
                <h2 className="font-bold text-sm tracking-wide uppercase">Carrito de Compra</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCartModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body with Cart Details */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Client Selection */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente</label>
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => updateActiveSession(s => ({ ...s, selectedClientId: e.target.value }))}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0] h-9"
                  >
                    <option value="general">Cliente General</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.balanceCredit > 0 ? `(Debe: ${currency}${c.balanceCredit.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer h-9 w-9 flex items-center justify-center shrink-0"
                    title="Registrar nuevo cliente"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cart items list */}
              <div className="border-t border-slate-100 pt-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Productos en Carrito ({cart.length})</h3>
                {cart.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center text-slate-400 text-center select-none">
                    <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2 text-slate-300">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-xs text-slate-700">Carrito vacío</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Agrega productos para comenzar</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 truncate uppercase">{item.product.name}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono font-bold text-[#0086F0]">{currency}{(item.customPrice ?? item.product.price).toFixed(2)}</span>
                            {item.selectedUnit && (
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded">{item.selectedUnit}</span>
                            )}
                            {item.selectedLote && (
                              <span className="text-[9px] bg-teal-50 text-teal-600 px-1 rounded truncate max-w-[90px]" title={item.selectedLote}>
                                {item.selectedLote.split('–')[0].trim()}
                              </span>
                            )}
                            {item.prescription && (
                              <button
                                type="button"
                                onClick={() => setViewingPrescriptionItem(item)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-[#0086F0] border border-sky-200 text-[9px] font-black tracking-tight transition-colors cursor-pointer"
                                title="Ver receta médica registrada"
                              >
                                <FileSignature className="w-2.5 h-2.5 text-[#0086F0]" />
                                <span>Receta</span>
                                <Eye className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5 shrink-0">
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 hover:bg-white text-slate-600 rounded transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-mono font-black text-slate-800 min-w-[24px] text-center">
                            {item.quantity}
                          </span>
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 hover:bg-white text-slate-600 rounded transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount Row */}
              <div className="flex items-center gap-2.5 text-xs pt-1 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Descuento</span>
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden w-full bg-white">
                  <span className="pl-3.5 text-slate-400 font-bold font-mono text-[11px]">
                    {discountType === 'fixed' ? currency : '%'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => updateActiveSession(s => ({ ...s, discountValue: e.target.value }))}
                    className="w-full px-2 py-1 bg-transparent text-slate-800 font-bold focus:outline-hidden text-right text-xs"
                  />
                  <div className="flex border-l border-slate-200 shrink-0 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => updateActiveSession(s => ({ ...s, discountType: 'percent' }))}
                      className={`px-3 py-1 font-extrabold text-[10px] ${
                        discountType === 'percent' 
                          ? 'bg-[#0086F0] text-white' 
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveSession(s => ({ ...s, discountType: 'fixed' }))}
                      className={`px-3 py-1 font-extrabold text-[10px] ${
                        discountType === 'fixed' 
                          ? 'bg-[#0086F0] text-white' 
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {currency}
                    </button>
                  </div>
                </div>
              </div>

              {/* Totals Box */}
              <div className="bg-slate-50 rounded-2xl border border-slate-150 p-3.5 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>Subtotal:</span>
                  <span>{currency}/{cartTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>Descuento:</span>
                  <span className="text-rose-500 font-bold">-{currency}/{cartTotals.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-semibold">
                  <span>{taxName} ({taxRateVal.toFixed(2)}%):</span>
                  <span>{currency}/{cartTotals.iva.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between border-t border-slate-200 pt-2.5 text-base font-black items-center">
                  <span className="text-slate-800 text-xs tracking-wider uppercase font-sans">Total:</span>
                  <span className="text-emerald-600 text-xl tracking-tight">
                    {currency}/{cartTotals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3 shrink-0">
              <button
                type="button"
                disabled={cart.length === 0 || isSubmittingSale}
                onClick={() => {
                  if (isSubmittingSale) return;
                  setIsCartModalOpen(false);
                  setIsCheckoutModalOpen(true);
                }}
                className="w-full py-3.5 bg-[#0e9f6e] hover:bg-[#0b8a5c] active:scale-[0.98] text-white rounded-full text-xs sm:text-sm font-extrabold tracking-wider uppercase transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-emerald-400/30"
              >
                {isSubmittingSale ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>PROCESANDO...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>PROCESAR VENTA</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[11px] font-bold px-1 text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setIsCartModalOpen(false);
                    onNavigate('reportes');
                  }}
                  className="hover:text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Historial de Ventas
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar Carrito
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: ADD CLIENT */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#0086F0]" />
                Registrar Nuevo Cliente
              </h3>
              <button 
                onClick={() => setIsAddClientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddClientSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Eduardo"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                  <input
                    type="text"
                    placeholder="8888-8888"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Límite de Crédito ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={newClientLimit}
                    onChange={(e) => setNewClientLimit(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="cliente@dominio.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#0086F0] hover:bg-[#0076d6] text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                Guardar Cliente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHECKOUT DIALOG */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-100 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Completar Venta y Pago
              </h3>
              <button 
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-5">
              
              {/* Payment selection card layout */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('cash'); setCashReceived(''); }}
                    className={`p-3 rounded-xl border text-xs font-black flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'cash' 
                        ? 'border-[#0086F0] bg-blue-50/50 text-[#0086F0]' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    EFECTIVO
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('card'); setCashReceived(''); }}
                    className={`p-3 rounded-xl border text-xs font-black flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'card' 
                        ? 'border-[#0086F0] bg-blue-50/50 text-[#0086F0]' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    TARJETA
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('transfer'); setCashReceived(''); }}
                    className={`p-3 rounded-xl border text-xs font-black flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'transfer' 
                        ? 'border-[#0086F0] bg-blue-50/50 text-[#0086F0]' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    TRANSFERENCIA
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('credit'); setCashReceived(''); }}
                    className={`p-3 rounded-xl border text-xs font-black flex flex-col items-center gap-2 transition-all ${
                      paymentMethod === 'credit' 
                        ? 'border-[#0086F0] bg-blue-50/50 text-[#0086F0]' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    CRÉDITO POS
                  </button>
                </div>
              </div>

              {/* Tipo de Comprobante */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Comprobante</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['ticket', 'boleta', 'factura', 'recibo'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setVoucherType(t)}
                      className={`py-2 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        voucherType === t
                          ? 'border-[#0086F0] bg-blue-50 text-[#0086F0]'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de Venta */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Venta</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['presencial', 'delivery'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSaleType(s)}
                      className={`py-2 rounded-lg border text-[11px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        saleType === s
                          ? 'border-[#0086F0] bg-blue-50 text-[#0086F0]'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumen de Venta */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 shadow-sm">
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-[#0086F0]" />
                    Resumen de Venta
                  </span>
                  <span className="text-[10px] font-extrabold text-[#0086F0] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {cart.reduce((acc, curr) => acc + curr.quantity, 0)} {cart.reduce((acc, curr) => acc + curr.quantity, 0) === 1 ? 'Ítem' : 'Ítems'}
                  </span>
                </div>

                {/* List of items in checkout styled as requested with columns: PRODUCTO, LOTE, VENCE, CANT., P. UNIT., SUBT. */}
                <div className="max-h-36 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-4">El carrito está vacío</p>
                  ) : (
                    <div className="min-w-full inline-block align-middle">
                      <table className="min-w-full divide-y divide-slate-100 text-[10px]">
                        <thead>
                          <tr className="text-slate-400 font-bold uppercase text-[9px] tracking-wider text-left">
                            <th scope="col" className="py-1.5 pr-2 font-bold">PRODUCTO</th>
                            <th scope="col" className="py-1.5 px-1 font-bold text-center">LOTE</th>
                            <th scope="col" className="py-1.5 px-1 font-bold text-center">VENCE</th>
                            <th scope="col" className="py-1.5 px-1 font-bold text-center">CANT.</th>
                            <th scope="col" className="py-1.5 px-1 font-bold text-right">P. UNIT.</th>
                            <th scope="col" className="py-1.5 pl-2 font-bold text-right">SUBT.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {cart.map((item) => {
                            const lotName = item.selectedLote 
                              ? item.selectedLote.split('–')[0].replace('Lote', 'LT').trim() 
                              : `LT-${item.product.code ? item.product.code.slice(-4) : '001'}`;
                            const formattedVence = item.selectedLote && item.selectedLote.includes('Vence:')
                              ? item.selectedLote.split('Vence:')[1].trim()
                              : (item.product.expirationDate 
                                 ? (() => {
                                     // Use slice to avoid local timezone offset on date conversion
                                     const parts = item.product.expirationDate.split('-');
                                     if (parts.length === 3) {
                                       return `${parts[1]}/${parts[0].slice(-2)}`;
                                     }
                                     return item.product.expirationDate;
                                   })()
                                 : '—');
                            return (
                              <tr key={item.product.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 pr-2 font-semibold text-slate-800 uppercase max-w-[80px] truncate" title={item.product.name}>
                                  {item.product.name}
                                </td>
                                <td className="py-2 px-1 text-center font-mono text-[9px] text-slate-500">
                                  {lotName}
                                </td>
                                <td className="py-2 px-1 text-center font-mono text-[9px] text-slate-500">
                                  {formattedVence}
                                </td>
                                <td className="py-2 px-1 text-center font-bold font-mono text-slate-900">
                                  {item.quantity}
                                </td>
                                <td className="py-2 px-1 text-right font-mono text-slate-600">
                                  {currency}{(item.customPrice ?? item.product.price).toFixed(2)}
                                </td>
                                <td className="py-2 pl-2 text-right font-bold font-mono text-slate-800">
                                  {currency}{((item.customPrice ?? item.product.price) * item.quantity).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-2.5 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-500 text-[10.5px]">
                    <span>Cliente:</span>
                    <span className="font-sans font-bold text-slate-700 truncate max-w-[200px]" title={selectedClientObj?.name || 'Cliente General'}>
                      {selectedClientObj?.name || 'Cliente General'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>{currency}{cartTotals.subtotal.toFixed(2)}</span>
                  </div>
                  {cartTotals.discountAmount > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Descuento:</span>
                      <span className="font-bold">-{currency}{cartTotals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>{taxName} ({taxRateVal.toFixed(2)}%):</span>
                    <span>{currency}{cartTotals.iva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-slate-800 border-t border-slate-200 pt-2 items-center">
                    <span className="font-sans uppercase tracking-wide">Total Neto:</span>
                    <span className="text-emerald-500 text-base">{currency}{cartTotals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Conditional cash calculator */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Efectivo Recibido</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 font-black font-mono">
                        {currency}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={cartTotals.total}
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] font-mono text-sm font-bold bg-white text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-black text-slate-700 font-mono bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl">
                    <span>CAMBIO A DEVOLVER:</span>
                    <span className="text-blue-700 text-sm font-extrabold">{currency}/{changeDue.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingSale || cart.length === 0}
                className="w-full py-3.5 bg-[#0e9f6e] hover:bg-[#0b8a5c] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingSale ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                    <span>REGISTRANDO VENTA...</span>
                  </>
                ) : (
                  <span>Registrar Venta ({currency}/{cartTotals.total.toFixed(2)})</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PENDING ORDERS LIST (Pedidos por Atender) */}
      {isPendingOrdersModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-amber-500" />
                Pedidos Pendientes por Atender
              </h3>
              <button 
                onClick={() => setIsPendingOrdersModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-80 pr-1">
              {pendingOrders.map(order => (
                <div key={order.id} className="border border-slate-150 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="text-xs font-black font-mono text-slate-700">{order.id}</span>
                      <h4 className="text-xs font-extrabold text-slate-500 mt-0.5">Cliente: <span className="text-slate-800">{order.customerName}</span></h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-emerald-600 font-mono">{currency}/{order.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{currency}/{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleLoadPendingOrder(order)}
                      className="px-3 py-1.5 bg-[#0086F0] hover:bg-[#0076d6] text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      Cargar en Carrito y Atender
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NUEVO PEDIDO FORM */}
      {isNuevoPedidoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <FolderPlus className="w-5 h-5 text-emerald-500" />
                Registrar Nuevo Pedido Externo
              </h3>
              <button 
                onClick={() => setIsNuevoPedidoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nombre del Cliente</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Alejandro Ruiz"
                  value={orderClientName}
                  onChange={(e) => setOrderClientName(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0086F0]"
                />
              </div>

              {/* Add product to order */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Buscar Producto</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Escriba código o nombre..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-hidden"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>

                {orderSearch && (
                  <div className="border border-slate-150 rounded-xl max-h-32 overflow-y-auto divide-y divide-slate-50 bg-white">
                    {products.filter(p => p.name.toLowerCase().includes(orderSearch.toLowerCase())).slice(0, 5).map(p => (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setOrderItems(prev => {
                            const ext = prev.find(i => i.product.id === p.id);
                            if (ext) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
                            return [...prev, { product: p, quantity: 1 }];
                          });
                          setOrderSearch('');
                        }}
                        className="p-2 text-xs hover:bg-slate-50 cursor-pointer flex justify-between font-bold"
                      >
                        <span>{p.name}</span>
                        <span className="text-[#0086F0]">{currency}{p.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected items in order */}
              <div className="border border-slate-150 rounded-xl p-3 min-h-[80px] max-h-36 overflow-y-auto space-y-2">
                {orderItems.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4 font-bold">Agregue productos para el pedido</p>
                ) : (
                  orderItems.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">{item.product.name}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span>x{item.quantity}</span>
                        <button 
                          type="button" 
                          onClick={() => setOrderItems(prev => prev.filter(i => i.product.id !== item.product.id))}
                          className="text-rose-500 hover:text-rose-700 font-bold text-sm"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="text-right text-xs font-bold font-mono">
                Total Pedido: {currency}{orderItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0).toFixed(2)}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Registrar Pedido Pendiente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DEVOLUCIONES / REVERSES */}
      {isDevolucionesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Undo2 className="w-5 h-5 text-rose-500" />
                Procesar Devolución / Reintegro
              </h3>
              <button 
                onClick={() => { setIsDevolucionesModalOpen(false); setRefundSaleObj(null); setRefundSuccessMsg(''); }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {refundSuccessMsg ? (
              <div className="space-y-4 text-center py-4">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">{refundSuccessMsg}</p>
                <button
                  type="button"
                  onClick={() => { setRefundSuccessMsg(''); setIsDevolucionesModalOpen(false); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleRefundSubmit} className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">ID de la Venta / Código de Barra</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Ej: doc_id o código"
                      value={refundSaleId}
                      onChange={(e) => setRefundSaleId(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      className="px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
                    >
                      Buscar
                    </button>
                  </div>
                </form>

                {refundSaleObj && (
                  <div className="border border-slate-150 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">Venta Encontrada</h4>
                    <p className="text-[11px] text-slate-500"><strong>Fecha:</strong> {new Date(refundSaleObj.date).toLocaleDateString()}</p>
                    <p className="text-[11px] text-slate-500"><strong>Total:</strong> {currency}{refundSaleObj.total.toFixed(2)}</p>
                    
                    <div className="text-[10px] text-slate-500 space-y-1">
                      {refundSaleObj.items.map((it, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{it.quantity}x {it.name}</span>
                          <span>{currency}{(it.price * it.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmRefund}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm mt-2"
                    >
                      Confirmar Reintegro de Caja e Inventario
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 6: COTIZADOR */}
      {isCotizacionesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-blue-500" />
                Generar Cotización Rápida
              </h3>
              <button 
                onClick={() => setIsCotizacionesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Nombre Cliente Prospecto</label>
                <input
                  type="text"
                  placeholder="Ej: Juan de Dios"
                  value={quoteClientName}
                  onChange={(e) => setQuoteClientName(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden"
                />
              </div>

              {/* Selection for quote */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Cargar del carrito actual:</label>
                <button
                  type="button"
                  onClick={() => setQuoteItems(cart)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                >
                  Importar {cart.length} productos del carrito
                </button>
              </div>

              {/* Quote lists */}
              <div className="border border-slate-150 rounded-xl p-3 min-h-[100px] max-h-40 overflow-y-auto space-y-2">
                {quoteItems.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-6 font-bold">Sin ítems para cotizar. Importe del carrito para continuar.</p>
                ) : (
                  quoteItems.map(it => (
                    <div key={it.product.id} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">{it.product.name}</span>
                      <span className="font-mono font-bold text-slate-600">x{it.quantity} - {currency}{(it.product.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="text-right text-xs font-black font-mono">
                Total Cotizado: {currency}{quoteItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0).toFixed(2)}
              </div>

              <button
                type="button"
                onClick={handlePrintQuote}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Imprimir Documento de Cotización
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: SUCCESS REVENUE RECEIPT OVERLAY */}
      {completedSale && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 text-center border border-slate-100">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
            
            <div className="space-y-1">
              <h3 className="font-black text-lg text-slate-800">¡Venta Registrada Exitosamente!</h3>
              <p className="text-[11px] text-slate-400 font-medium">La transacción se guardó correctamente en el cierre activo.</p>
            </div>

            {/* Virtual invoice voucher style */}
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-left font-mono text-xs space-y-3 shadow-inner">
              <div className="text-center border-b border-slate-200 pb-2.5">
                <h4 className="font-black uppercase text-slate-800 text-[13px] tracking-wide">{config.storeName}</h4>
                <p className="text-[10px] text-slate-400 mt-1">Fecha: {new Date(completedSale.date).toLocaleString()}</p>
                <p className="text-[9px] text-slate-400">ID Venta: {completedSale.id.substring(0, 14)}...</p>
              </div>

              {/* Row headers */}
              <div className="space-y-1 text-slate-600">
                {completedSale.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.quantity}x {item.name.substring(0, 18)}</span>
                    <span>{currency}{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Total calculations */}
              <div className="border-t border-slate-200 pt-2 space-y-1.5 font-bold text-slate-800">
                <div className="flex justify-between text-[13px]">
                  <span>TOTAL NETO:</span>
                  <span className="text-emerald-600">{currency}{completedSale.total.toFixed(2)}</span>
                </div>
                {completedSale.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-slate-500 font-normal text-[10px]">
                      <span>Efectivo Recibido:</span>
                      <span>{currency}{completedSale.received.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-normal text-[10px]">
                      <span>Vuelto / Cambio:</span>
                      <span>{currency}{completedSale.change.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-slate-500 font-normal text-[10px] border-t border-slate-100 pt-1">
                  <span>Método Pago:</span>
                  <span className="capitalize">{completedSale.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR AL CARRITO (EXACT MATCH TO USER SPEC IMAGE) */}
      {isAddToCartModalOpen && selectedProductToAddToCart && (
        <div className="fixed inset-0 bg-slate-950/60 flex justify-center items-start sm:items-center p-4 z-50 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-auto max-h-[90vh] min-h-0">
            
            {/* Header: Gradient background with shopping cart icon & title */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 text-white px-6 py-4.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-white stroke-[2.5]" />
                <h3 className="font-bold text-base tracking-wide">Agregar al carrito</h3>
              </div>
              <button 
                onClick={() => {
                  setIsAddToCartModalOpen(false);
                  setSelectedProductToAddToCart(null);
                }}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
              
              {/* Product Info Section */}
              <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                <div className="w-20 h-20 bg-white rounded-xl border border-slate-150 flex items-center justify-center p-2 shrink-0 shadow-xs">
                  <img 
                    src={getProductImage(selectedProductToAddToCart)} 
                    alt={selectedProductToAddToCart.name}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="font-black text-slate-800 text-sm tracking-tight uppercase leading-snug">
                    {selectedProductToAddToCart.name}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Código: {selectedProductToAddToCart.code || 'GDU-0001'}
                  </p>
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">Precio Venta</span>
                      <span className="text-sm font-extrabold text-[#00a878] font-mono">
                        {currency}{selectedProductToAddToCart.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200 self-end" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-450 uppercase block">Costo Adquisición</span>
                      <span className="text-sm font-extrabold text-slate-600 font-mono">
                        {currency}{(selectedProductToAddToCart.cost ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                
                {/* 1. Precio de venta */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Precio de venta</label>
                  <div className="relative">
                    <select
                      value={selectedPriceType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedPriceType(val);
                        if (val === 'retail') {
                          setCustomPriceVal(selectedProductToAddToCart.price.toFixed(2));
                        } else if (val === 'wholesale') {
                          setCustomPriceVal((selectedProductToAddToCart.price * 0.9).toFixed(2));
                        } else if (val === 'distributor') {
                          setCustomPriceVal((selectedProductToAddToCart.price * 0.8).toFixed(2));
                        }
                      }}
                      className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3.5 py-3 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] appearance-none cursor-pointer pr-10"
                    >
                      <option value="retail">Retail ({currency}{selectedProductToAddToCart.price.toFixed(2)})</option>
                      <option value="wholesale">Mayorista ({currency}{(selectedProductToAddToCart.price * 0.9).toFixed(2)})</option>
                      <option value="distributor">Distribuidor ({currency}{(selectedProductToAddToCart.price * 0.8).toFixed(2)})</option>
                    </select>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* 2. Precio personalizado (opcional) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Precio personalizado <span className="text-slate-400 font-normal">(opcional)</span></label>
                  <div className="flex border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0086F0] focus-within:border-[#0086F0]">
                    <div className="bg-slate-50 border-r border-slate-200 px-3.5 flex items-center justify-center text-slate-700 text-xs font-bold font-mono">
                      Q
                    </div>
                    <input
                      type="text"
                      value={customPriceVal}
                      onChange={(e) => setCustomPriceVal(e.target.value)}
                      placeholder="2.50"
                      className="w-full text-xs font-semibold px-3.5 py-3 bg-white text-slate-800 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* 3. Unidad de venta */}
                {selectedProductToAddToCart.category !== 'Combos' && selectedProductToAddToCart.category !== 'Servicios' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Unidad de venta</label>
                    <div className="relative">
                      <select
                        value={selectedUnitType}
                        onChange={(e) => {
                          const val = e.target.value;
                          const mult = val === 'Blíster' 
                            ? (selectedProductToAddToCart.unitsPerBlister && selectedProductToAddToCart.unitsPerBlister > 0 ? selectedProductToAddToCart.unitsPerBlister : 1) 
                            : (val === 'Caja' 
                                ? (selectedProductToAddToCart.unitsPerBox && selectedProductToAddToCart.unitsPerBox > 0 ? selectedProductToAddToCart.unitsPerBox : 1) 
                                : 1);
                          const maxQ = Math.floor(currentAvailableStock / mult);
                          
                          if (maxQ <= 0 && val !== 'Unidad') {
                            alert(`No hay suficiente stock para vender en la presentación de ${val}. Requiere al menos ${mult} unidades, pero el stock actual es de ${currentAvailableStock} unidades.`);
                            return;
                          }

                          setSelectedUnitType(val);
                          setAddToCartQty(prev => Math.max(1, Math.min(maxQ, prev)));
                          
                          // Dynamically update custom price value based on selected unit
                          if (val === 'Blíster') {
                            const blisterPrice = selectedProductToAddToCart.pricePerBlister || 
                                                 (selectedProductToAddToCart.price * 0.92 * (selectedProductToAddToCart.unitsPerBlister || 10));
                            setCustomPriceVal(blisterPrice.toFixed(2));
                          } else if (val === 'Caja') {
                            const boxPrice = selectedProductToAddToCart.pricePerBox || 
                                             (selectedProductToAddToCart.price * 0.85 * (selectedProductToAddToCart.unitsPerBox || 100));
                            setCustomPriceVal(boxPrice.toFixed(2));
                          } else {
                            // 'Unidad'
                            const unitPrice = selectedProductToAddToCart.pricePerUnit || selectedProductToAddToCart.price;
                            setCustomPriceVal(unitPrice.toFixed(2));
                          }
                        }}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3.5 py-3 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] appearance-none cursor-pointer pr-10"
                      >
                        <option value="Unidad">
                          {selectedProductToAddToCart.unit || 'Unidad'} — {currency}{(selectedProductToAddToCart.pricePerUnit || selectedProductToAddToCart.price).toFixed(2)}
                        </option>
                        {selectedProductToAddToCart.pricePerBlister && selectedProductToAddToCart.pricePerBlister > 0 ? (
                          <option value="Blíster">
                            Blíster ({selectedProductToAddToCart.unitsPerBlister || 10} uds.) — {currency}{selectedProductToAddToCart.pricePerBlister.toFixed(2)}
                          </option>
                        ) : null}
                        {selectedProductToAddToCart.pricePerBox && selectedProductToAddToCart.pricePerBox > 0 ? (
                          <option value="Caja">
                            Caja ({selectedProductToAddToCart.unitsPerBox || 100} uds.) — {currency}{selectedProductToAddToCart.pricePerBox.toFixed(2)}
                          </option>
                        ) : null}
                      </select>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. Lote y vencimiento (opcional) */}
                {selectedProductToAddToCart.category !== 'Combos' && selectedProductToAddToCart.category !== 'Servicios' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Lote y vencimiento <span className="text-slate-400 font-normal">(opcional)</span></label>
                    <div className="relative">
                      <select
                        value={selectedLoteVal}
                        onChange={(e) => setSelectedLoteVal(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3.5 py-3 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0] appearance-none cursor-pointer pr-10"
                      >
                        {availableLotes.map((loteOpt, i) => (
                          <option key={i} value={loteOpt.value}>
                            {loteOpt.label}
                          </option>
                        ))}
                      </select>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                )}

                {/* 5. Cantidad */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Cantidad</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50/50 p-1">
                      <button 
                        type="button"
                        onClick={() => setAddToCartQty(prev => Math.max(1, prev - 1))}
                        className="w-10 h-10 hover:bg-white text-slate-600 rounded-lg flex items-center justify-center transition-colors border border-transparent hover:border-slate-100 shadow-2xs cursor-pointer"
                      >
                        <Minus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <input
                        type="number"
                        value={addToCartQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          const isSpecial = selectedProductToAddToCart.category === 'Combos' || selectedProductToAddToCart.category === 'Servicios';
                          const mult = isSpecial 
                            ? 1 
                            : (selectedUnitType === 'Blíster' 
                                ? (selectedProductToAddToCart.unitsPerBlister && selectedProductToAddToCart.unitsPerBlister > 0 ? selectedProductToAddToCart.unitsPerBlister : 1) 
                                : (selectedUnitType === 'Caja' 
                                    ? (selectedProductToAddToCart.unitsPerBox && selectedProductToAddToCart.unitsPerBox > 0 ? selectedProductToAddToCart.unitsPerBox : 1) 
                                    : 1));
                          const maxQty = isSpecial ? 999999 : Math.floor(currentAvailableStock / mult);
                          setAddToCartQty(Math.min(maxQty, Math.max(1, val)));
                        }}
                        className="w-14 text-center text-sm font-extrabold font-mono text-slate-800 focus:outline-hidden bg-transparent"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const isSpecial = selectedProductToAddToCart.category === 'Combos' || selectedProductToAddToCart.category === 'Servicios';
                          const mult = isSpecial 
                            ? 1 
                            : (selectedUnitType === 'Blíster' 
                                ? (selectedProductToAddToCart.unitsPerBlister && selectedProductToAddToCart.unitsPerBlister > 0 ? selectedProductToAddToCart.unitsPerBlister : 1) 
                                : (selectedUnitType === 'Caja' 
                                    ? (selectedProductToAddToCart.unitsPerBox && selectedProductToAddToCart.unitsPerBox > 0 ? selectedProductToAddToCart.unitsPerBox : 1) 
                                    : 1));
                          const maxQty = isSpecial ? 999999 : Math.floor(currentAvailableStock / mult);
                          setAddToCartQty(prev => Math.min(maxQty, prev + 1));
                        }}
                        className="w-10 h-10 hover:bg-white text-slate-600 rounded-lg flex items-center justify-center transition-colors border border-transparent hover:border-slate-100 shadow-2xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    {selectedProductToAddToCart.category !== 'Combos' && selectedProductToAddToCart.category !== 'Servicios' ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-100/70 px-3 py-2 rounded-lg border border-slate-150">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                        </svg>
                        <span>{currentAvailableStock} {selectedProductToAddToCart.unit || 'uds.'} disponibles</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-150 text-emerald-700">
                        <span>Servicio/Combo Activo</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Subtotal Box with soft mint/teal styling */}
              <div className="bg-[#e6f7f4] border border-teal-100 rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xs">
                <span className="font-bold text-sm text-teal-850">Subtotal</span>
                <span className="font-black text-lg text-teal-700 font-mono">
                  {currency}{(addToCartQty * (parseFloat(customPriceVal) || selectedProductToAddToCart.price)).toFixed(2)}
                </span>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAddToCartModalOpen(false);
                  setSelectedProductToAddToCart(null);
                }}
                className="px-5 py-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalPrice = parseFloat(customPriceVal) || selectedProductToAddToCart.price;
                  if (addToCartQty <= 0) return;

                  const isSpecial = selectedProductToAddToCart.category === 'Combos' || selectedProductToAddToCart.category === 'Servicios';
                  const mult = isSpecial 
                    ? 1 
                    : (selectedUnitType === 'Blíster' 
                        ? (selectedProductToAddToCart.unitsPerBlister && selectedProductToAddToCart.unitsPerBlister > 0 ? selectedProductToAddToCart.unitsPerBlister : 1) 
                        : (selectedUnitType === 'Caja' 
                            ? (selectedProductToAddToCart.unitsPerBox && selectedProductToAddToCart.unitsPerBox > 0 ? selectedProductToAddToCart.unitsPerBox : 1) 
                            : 1));
                  const totalUnitsRequested = addToCartQty * mult;
                  const maxQty = isSpecial ? 999999 : Math.floor(currentAvailableStock / mult);

                  if (!isSpecial && totalUnitsRequested > currentAvailableStock) {
                    alert(`No puedes agregar más de ${currentAvailableStock} unidades de este producto.`);
                    return;
                  }

                  const resolvedUnitName = isSpecial 
                    ? (selectedProductToAddToCart.category === 'Combos' ? 'Combo' : 'Servicio')
                    : (selectedUnitType === 'Unidad' ? (selectedProductToAddToCart.unit || 'Unidad') : selectedUnitType);

                  // If product requires prescription (bajo receta médica / receta retenida), trigger "Registro de Receta" modal
                  if (isPrescriptionRequired(selectedProductToAddToCart)) {
                    const currentClient = selectedClientId !== 'general' ? clients.find(c => c.id === selectedClientId) : null;
                    setPendingPrescriptionItem({
                      product: selectedProductToAddToCart,
                      quantity: addToCartQty,
                      customPrice: finalPrice,
                      selectedUnit: resolvedUnitName,
                      selectedLote: isSpecial ? 'N/A' : selectedLoteVal
                    });

                    // Pre-fill or initialize prescription fields
                    setRxPatientName(currentClient?.name || '');
                    setRxPatientDpi(currentClient?.nit || '');
                    setRxPatientAge('');
                    setRxPatientPhone(currentClient?.phone || '');
                    setRxDoctorName('');
                    setRxDoctorLicense('');
                    setRxInstitution('');
                    setRxPrescriptionNumber(`REC-${Date.now().toString().slice(-5)}`);
                    setRxPrescriptionDate(new Date().toISOString().split('T')[0]);
                    setRxPrescriptionType(selectedProductToAddToCart.prescriptionRequired === 'receta médica retenida' ? 'receta médica retenida' : 'bajo receta médica');
                    setRxDiagnosis('');
                    setRxIndications('');
                    setRxRecipePhoto(null);
                    setRxFormError('');

                    setIsAddToCartModalOpen(false);
                    setIsPrescriptionModalOpen(true);
                    return;
                  }

                  updateActiveSession(s => {
                    const existing = s.cart.find(item => item.product.id === selectedProductToAddToCart.id);
                    if (existing) {
                      if (existing.selectedUnit !== resolvedUnitName) {
                        alert(`El producto ya está en el carrito en la presentación de "${existing.selectedUnit}". Se actualizará a la nueva presentación de "${resolvedUnitName}" con la cantidad seleccionada.`);
                        return {
                          ...s,
                          cart: s.cart.map(item => 
                            item.product.id === selectedProductToAddToCart.id 
                              ? { 
                                  ...item, 
                                  quantity: addToCartQty, 
                                  customPrice: finalPrice,
                                  selectedUnit: resolvedUnitName,
                                  selectedLote: isSpecial ? 'N/A' : selectedLoteVal
                                } 
                              : item
                          )
                        };
                      }

                      // Same unit type: merge quantities
                      if (!isSpecial && existing.quantity + addToCartQty > maxQty) {
                        alert(`No puedes exceder el stock total de ${currentAvailableStock} unidades. Ya tienes ${existing.quantity} ${resolvedUnitName}(s) en el carrito (equivale a ${existing.quantity * mult} unidades).`);
                        return s;
                      }

                      return {
                        ...s,
                        cart: s.cart.map(item => 
                          item.product.id === selectedProductToAddToCart.id 
                            ? { 
                                ...item, 
                                quantity: item.quantity + addToCartQty,
                                customPrice: finalPrice,
                                selectedUnit: resolvedUnitName,
                                selectedLote: isSpecial ? 'N/A' : selectedLoteVal
                              } 
                            : item
                        )
                      };
                    }
                    return {
                      ...s,
                      cart: [...s.cart, { 
                        product: selectedProductToAddToCart, 
                        quantity: addToCartQty, 
                        customPrice: finalPrice,
                        selectedUnit: resolvedUnitName,
                        selectedLote: isSpecial ? 'N/A' : selectedLoteVal
                      }]
                    };
                  });

                  setIsAddToCartModalOpen(false);
                  setSelectedProductToAddToCart(null);
                }}
                className="px-5 py-3 bg-[#10b981] hover:bg-[#0e9f6e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <ShoppingCart className="w-4 h-4 text-white" />
                Agregar al carrito
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: REGISTRO DE RECETA (VENTANA BAJO RECETA MÉDICA) */}
      {isPrescriptionModalOpen && pendingPrescriptionItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            
            {/* Header: Blue background matching theme, title "Registro de Receta", white icon and X close */}
            <div className="bg-[#0086F0] text-white px-5 sm:px-6 py-4 flex items-center justify-between shadow-xs shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <FileSignature className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-wide flex items-center gap-2">
                    Registro de Receta
                    <span className="text-[10px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">
                      Obligatorio
                    </span>
                  </h3>
                  <p className="text-[11px] text-sky-100 font-medium">
                    Este producto requiere prescripción médica según la configuración del inventario
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPrescriptionModalOpen(false);
                  setPendingPrescriptionItem(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-white/20 text-white/90 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">

              {/* 1. Product Summary Card */}
              <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 bg-white rounded-xl border border-sky-200 flex items-center justify-center p-1.5 shrink-0 shadow-xs">
                    <img 
                      src={getProductImage(pendingPrescriptionItem.product)} 
                      alt={pendingPrescriptionItem.product.name}
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain mix-blend-multiply"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <Stethoscope className="w-3 h-3" />
                        {pendingPrescriptionItem.product.prescriptionRequired || 'Bajo receta médica'}
                      </span>
                      {pendingPrescriptionItem.product.sanitaryRegister && (
                        <span className="text-[10px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                          Reg: {pendingPrescriptionItem.product.sanitaryRegister}
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight truncate">
                      {pendingPrescriptionItem.product.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Presentación: <span className="font-bold text-slate-700">{pendingPrescriptionItem.selectedUnit}</span> | Cantidad: <span className="font-bold text-[#0086F0]">{pendingPrescriptionItem.quantity}</span> | Lote: <span className="font-bold text-slate-700">{pendingPrescriptionItem.selectedLote}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right sm:border-l sm:border-sky-200 sm:pl-4 self-end sm:self-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Subtotal Ítem</span>
                  <span className="text-base font-black text-[#0086F0] font-mono">
                    {currency}{(pendingPrescriptionItem.quantity * pendingPrescriptionItem.customPrice).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Validation error notice if any */}
              {rxFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{rxFormError}</span>
                </div>
              )}

              {/* Form Grid Sections */}
              <div className="space-y-4">
                
                {/* SECTION A: DATOS DEL PACIENTE */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#0086F0]" />
                      Datos del Paciente
                    </h4>
                    {selectedClientId && selectedClientId !== 'general' && (
                      <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                        Asociado al cliente de la venta
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Nombre Completo del Paciente <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Carlos Eduardo Méndez"
                        value={rxPatientName}
                        onChange={(e) => {
                          setRxPatientName(e.target.value);
                          if (rxFormError) setRxFormError('');
                        }}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        DPI / Cédula / DNI
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 2489 12345 0101"
                        value={rxPatientDpi}
                        onChange={(e) => setRxPatientDpi(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Edad (Años)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        placeholder="Ej: 34"
                        value={rxPatientAge}
                        onChange={(e) => setRxPatientAge(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Teléfono / Contacto <span className="text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 5544-3322"
                        value={rxPatientPhone}
                        onChange={(e) => setRxPatientPhone(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION B: DATOS DEL MÉDICO PRESCRIPTOR */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
                    <Stethoscope className="w-3.5 h-3.5 text-[#0086F0]" />
                    Datos del Médico Prescriptor
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Nombre del Médico <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Dr. Roberto Alonzo García"
                        value={rxDoctorName}
                        onChange={(e) => {
                          setRxDoctorName(e.target.value);
                          if (rxFormError) setRxFormError('');
                        }}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        No. Colegiado / Registro Médico
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: COL-12984"
                        value={rxDoctorLicense}
                        onChange={(e) => setRxDoctorLicense(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Clínica / Hospital / Institución <span className="text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Hospital San Juan de Dios / Clínica Médica Central"
                        value={rxInstitution}
                        onChange={(e) => setRxInstitution(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION C: DETALLES DE LA RECETA MÉDICA */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
                    <FileText className="w-3.5 h-3.5 text-[#0086F0]" />
                    Detalles de la Receta Médica
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        No. de Receta / Folio
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: REC-90812"
                        value={rxPrescriptionNumber}
                        onChange={(e) => setRxPrescriptionNumber(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Fecha de Emisión
                      </label>
                      <input
                        type="date"
                        value={rxPrescriptionDate}
                        onChange={(e) => setRxPrescriptionDate(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Modalidad de Venta
                      </label>
                      <select
                        value={rxPrescriptionType}
                        onChange={(e) => setRxPrescriptionType(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-250 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      >
                        <option value="bajo receta médica">Bajo receta médica</option>
                        <option value="receta médica retenida">Receta retenida en farmacia</option>
                      </select>
                    </div>

                    <div className="space-y-1 sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Indicaciones / Dosis / Diagnóstico <span className="text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ej: Tomar 1 cápsula cada 8 horas durante 7 días..."
                        value={rxIndications}
                        onChange={(e) => setRxIndications(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-250 rounded-xl px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0086F0]"
                      />
                    </div>

                    {/* Adjunto de foto de receta con soporte de cámara trasera directa */}
                    <div className="space-y-1.5 sm:col-span-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-600">
                          Foto o Comprobante de la Receta <span className="text-slate-400 font-normal">(Cámara trasera / archivo)</span>
                        </label>
                        {rxRecipePhoto && (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-150 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Foto adjunta
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* 1. Botón Principal: Tomar Foto directa con Cámara Trasera en Móviles y Tablets */}
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#0086F0] hover:bg-[#0076d6] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all active:scale-[0.98]">
                          <Camera className="w-4 h-4 text-white shrink-0" />
                          <span>{rxRecipePhoto ? 'Tomar Otra con Cámara' : 'Tomar Foto con Cámara'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setRxRecipePhoto(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        {/* 2. Botón Visor de Cámara en Vivo (Para apuntar la cámara y capturar en pantalla) */}
                        <button
                          type="button"
                          onClick={() => startLiveCamera('environment')}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                          title="Abrir visor de cámara en vivo para enfocar y tomar foto"
                        >
                          <Eye className="w-4 h-4 text-sky-400 shrink-0" />
                          <span>Cámara en Vivo</span>
                        </button>

                        {/* 3. Botón Subir Archivo o desde Galería */}
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-100 border border-slate-250 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-colors">
                          <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Subir de Galería</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setRxRecipePhoto(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        {/* Previsualización y acciones si ya hay foto */}
                        {rxRecipePhoto && (
                          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-2xs">
                            <div 
                              onClick={() => setPreviewEnlargedPhoto(rxRecipePhoto)}
                              className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 cursor-pointer border border-slate-150 hover:opacity-85 transition-opacity"
                              title="Clic para ver en grande"
                            >
                              <img src={rxRecipePhoto} alt="Receta" className="w-full h-full object-cover" />
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewEnlargedPhoto(rxRecipePhoto)}
                              className="text-xs text-[#0086F0] hover:underline font-bold px-1 cursor-pointer"
                            >
                              Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => setRxRecipePhoto(null)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 cursor-pointer"
                              title="Eliminar foto"
                            >
                              Quitar
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        📷 En dispositivos móviles y tablets, <strong>"Tomar Foto con Cámara"</strong> activa directamente la cámara trasera para fotografiar la receta física al instante.
                      </p>
                    </div>

                  </div>
                </div>

              </div>

            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 px-5 sm:px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsPrescriptionModalOpen(false);
                  if (pendingPrescriptionItem) {
                    setSelectedProductToAddToCart(pendingPrescriptionItem.product);
                    setIsAddToCartModalOpen(true);
                  }
                  setPendingPrescriptionItem(null);
                }}
                className="px-4 sm:px-5 py-2.5 border border-slate-250 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Volver
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!pendingPrescriptionItem) return;
                  if (!rxPatientName.trim()) {
                    setRxFormError('Por favor ingrese el nombre del paciente.');
                    return;
                  }
                  if (!rxDoctorName.trim()) {
                    setRxFormError('Por favor ingrese el nombre del médico prescriptor.');
                    return;
                  }

                  const prescriptionData: PrescriptionData = {
                    patientName: rxPatientName.trim(),
                    patientDpi: rxPatientDpi.trim(),
                    patientAge: rxPatientAge.trim(),
                    patientPhone: rxPatientPhone.trim(),
                    doctorName: rxDoctorName.trim(),
                    doctorLicense: rxDoctorLicense.trim(),
                    institution: rxInstitution.trim(),
                    prescriptionNumber: rxPrescriptionNumber.trim() || `REC-${Date.now().toString().slice(-5)}`,
                    prescriptionDate: rxPrescriptionDate || new Date().toISOString().split('T')[0],
                    prescriptionType: rxPrescriptionType,
                    diagnosis: rxDiagnosis.trim(),
                    indications: rxIndications.trim(),
                    recipePhoto: rxRecipePhoto || undefined,
                    registeredAt: new Date().toISOString()
                  };

                  const { product, quantity, customPrice, selectedUnit, selectedLote } = pendingPrescriptionItem;

                  updateActiveSession(s => {
                    const existing = s.cart.find(item => item.product.id === product.id);
                    if (existing) {
                      return {
                        ...s,
                        cart: s.cart.map(item =>
                          item.product.id === product.id
                            ? {
                                ...item,
                                quantity: quantity,
                                customPrice: customPrice,
                                selectedUnit: selectedUnit,
                                selectedLote: selectedLote,
                                prescription: prescriptionData
                              }
                            : item
                        )
                      };
                    }
                    return {
                      ...s,
                      cart: [
                        ...s.cart,
                        {
                          product,
                          quantity,
                          customPrice,
                          selectedUnit,
                          selectedLote,
                          prescription: prescriptionData
                        }
                      ]
                    };
                  });

                  setIsPrescriptionModalOpen(false);
                  setPendingPrescriptionItem(null);
                  setSelectedProductToAddToCart(null);
                }}
                className="px-5 sm:px-6 py-2.5 bg-[#10b981] hover:bg-[#0e9f6e] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                Registrar y Agregar al Carrito
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: VER DETALLE DE RECETA REGISTRADA EN CARRITO */}
      {viewingPrescriptionItem && viewingPrescriptionItem.prescription && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#0086F0] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4" />
                <h3 className="font-extrabold text-sm">Receta Médica Registrada</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingPrescriptionItem(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900 uppercase">{viewingPrescriptionItem.product.name}</p>
                <p className="text-[11px] text-slate-500">Cantidad: {viewingPrescriptionItem.quantity} {viewingPrescriptionItem.selectedUnit} | Lote: {viewingPrescriptionItem.selectedLote}</p>
              </div>
              <div className="space-y-1.5 border-t border-slate-150 pt-2 text-slate-700">
                <p><strong>Paciente:</strong> {viewingPrescriptionItem.prescription.patientName} {viewingPrescriptionItem.prescription.patientAge ? `(${viewingPrescriptionItem.prescription.patientAge} años)` : ''}</p>
                {viewingPrescriptionItem.prescription.patientDpi && <p><strong>DPI / Identificación:</strong> {viewingPrescriptionItem.prescription.patientDpi}</p>}
                {viewingPrescriptionItem.prescription.patientPhone && <p><strong>Teléfono:</strong> {viewingPrescriptionItem.prescription.patientPhone}</p>}
                <p><strong>Médico:</strong> {viewingPrescriptionItem.prescription.doctorName}</p>
                {viewingPrescriptionItem.prescription.doctorLicense && <p><strong>No. Colegiado:</strong> {viewingPrescriptionItem.prescription.doctorLicense}</p>}
                {viewingPrescriptionItem.prescription.institution && <p><strong>Institución:</strong> {viewingPrescriptionItem.prescription.institution}</p>}
                <p><strong>No. Receta / Folio:</strong> {viewingPrescriptionItem.prescription.prescriptionNumber}</p>
                <p><strong>Fecha Receta:</strong> {viewingPrescriptionItem.prescription.prescriptionDate}</p>
                <p><strong>Condición:</strong> <span className="font-bold text-rose-600 uppercase">{viewingPrescriptionItem.prescription.prescriptionType}</span></p>
                {viewingPrescriptionItem.prescription.indications && (
                  <p className="mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                    <strong>Indicaciones:</strong> {viewingPrescriptionItem.prescription.indications}
                  </p>
                )}
                {viewingPrescriptionItem.prescription.recipePhoto && (
                  <div className="mt-2">
                    <span className="font-bold block mb-1">Comprobante de Receta:</span>
                    <img src={viewingPrescriptionItem.prescription.recipePhoto} alt="Receta" className="max-h-48 rounded-lg border border-slate-200 object-contain w-full bg-slate-50" />
                  </div>
                )}
              </div>
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingPrescriptionItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CÁMARA TRASERA EN VIVO PARA CAPTURAR RECETA */}
      {isLiveCameraOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 text-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-800 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-sky-400" />
                <h3 className="font-extrabold text-sm">Visor de Cámara Trasera</h3>
              </div>
              <button
                type="button"
                onClick={stopLiveCamera}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Viewfinder */}
            <div className="relative bg-black min-h-[300px] aspect-4/3 flex items-center justify-center overflow-hidden">
              {cameraStreamError ? (
                <div className="p-6 text-center space-y-3">
                  <CameraOff className="w-12 h-12 text-rose-400 mx-auto" />
                  <p className="text-xs text-rose-300 font-medium">{cameraStreamError}</p>
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cerrar visor
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Guide overlay box for aligning the prescription */}
                  <div className="absolute inset-5 sm:inset-7 border-2 border-dashed border-sky-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                    <span className="text-[10px] font-bold text-sky-200 bg-black/60 px-2 py-0.5 rounded backdrop-blur-2xs self-start">
                      Enfoque la receta médica dentro del marco
                    </span>
                    <span className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded backdrop-blur-2xs self-center">
                      {cameraFacingMode === 'environment' ? '📷 Cámara Trasera Activa' : '🤳 Cámara Frontal Activa'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Controls Footer */}
            {!cameraStreamError && (
              <div className="p-3.5 sm:p-4 bg-slate-800 flex items-center justify-between gap-2.5 border-t border-slate-700">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Cambiar entre cámara trasera y frontal"
                >
                  <SwitchCamera className="w-4 h-4 text-sky-300" />
                  <span className="hidden sm:inline">Cambiar Cámara</span>
                </button>

                <button
                  type="button"
                  onClick={capturePhotoFromLiveCamera}
                  className="px-5 sm:px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-white" />
                  <span>Capturar Foto</span>
                </button>

                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="px-3 sm:px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: VER FOTO AMPLIADA DE RECETA */}
      {previewEnlargedPhoto && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <span className="font-bold text-sm">Vista de Comprobante de Receta</span>
              <button
                type="button"
                onClick={() => setPreviewEnlargedPhoto(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center overflow-auto flex-1">
              <img src={previewEnlargedPhoto} alt="Receta" className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-md" />
            </div>
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewEnlargedPhoto(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
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
