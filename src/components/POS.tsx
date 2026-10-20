import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Client, Sale, Shift, AppConfig, PrescriptionData, Branch } from '../types';
import { isItemInBranch } from '../utils/branchHelper';
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
  SwitchCamera,
  Building2,
  Barcode
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
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
  user: { id: string; name: string; email: string; branch?: string; branches?: string[]; isOperator?: boolean };
  onSaveSale: (sale: Sale) => Promise<Sale>;
  onRefreshData: () => void;
  onNavigate: (tab: string) => void;
  activeBranchName?: string;
  branches?: Branch[];
  onSwitchBranch?: (branchId: string) => void;
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

export default function POS({ 
  products, 
  clients, 
  shifts, 
  config, 
  user, 
  onSaveSale, 
  onRefreshData, 
  onNavigate,
  activeBranchName,
  branches,
  onSwitchBranch
}: POSProps) {
  const currency = config.currency || 'Q';
  const taxName = config?.taxName || 'IVA';
  const taxRateVal = parseFloat(config?.taxRate || '12') || 0;
  const taxCalculation = config?.taxCalculation || 'Incluido';

  const userAllowedBranches = useMemo(() => {
    const u = user as any;
    if (!u?.isOperator) return [];
    if (u?.branches && u.branches.length > 0) return u.branches;
    if (u?.branch && u.branch !== 'Todas') return u.branch.split(',').map((s: string) => s.trim());
    return [];
  }, [user]);

  const currentOperatingBranch = useMemo(() => {
    if (activeBranchName) return activeBranchName;
    if (userAllowedBranches.length > 0) {
      return userAllowedBranches[0];
    }
    if (config.activeBranchId && (branches || config.branches)) {
      const allBr = branches || config.branches || [];
      const b = allBr.find(br => br.id === config.activeBranchId);
      if (b) return b.name;
    }
    return branches?.[0]?.name || config.branches?.[0]?.name || '';
  }, [activeBranchName, userAllowedBranches, config.activeBranchId, config.branches, branches]);

  const currentShift = useMemo(() => {
    return shifts.find(s => s.state === 'open' && isItemInBranch(s.branch, currentOperatingBranch, branches || config.branches));
  }, [shifts, currentOperatingBranch, branches, config.branches]);

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

  // Mobile Barcode Scanner for POS
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [barcodeScannerError, setBarcodeScannerError] = useState<string | null>(null);
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);
  const [barcodeScannerFacingMode, setBarcodeScannerFacingMode] = useState<'environment' | 'user'>('environment');
  const [barcodeScanSuccessFlash, setBarcodeScanSuccessFlash] = useState(false);
  const [scannedBarcodePreview, setScannedBarcodePreview] = useState<string>('');
  const [barcodeFeedbackBanner, setBarcodeFeedbackBanner] = useState<{ 
    type: 'success' | 'error'; 
    message: string; 
    sub?: string;
    product?: POSProduct;
  } | null>(null);

  const barcodeVideoRef = useRef<HTMLVideoElement | null>(null);
  const barcodeStreamRef = useRef<MediaStream | null>(null);
  const barcodeCodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const barcodeAnimFrameRef = useRef<number | null>(null);

  const stopPosBarcodeScanner = () => {
    if (barcodeAnimFrameRef.current) {
      cancelAnimationFrame(barcodeAnimFrameRef.current);
      barcodeAnimFrameRef.current = null;
    }
    if (barcodeCodeReaderRef.current) {
      try { barcodeCodeReaderRef.current.reset(); } catch (e) {}
      barcodeCodeReaderRef.current = null;
    }
    if (barcodeStreamRef.current) {
      try { barcodeStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      barcodeStreamRef.current = null;
    }
    if (barcodeVideoRef.current) {
      barcodeVideoRef.current.srcObject = null;
    }
    setIsBarcodeScannerOpen(false);
    setBarcodeScannerError(null);
    setIsBarcodeScanning(false);
  };

  const startPosBarcodeScanner = async (mode: 'environment' | 'user' = 'environment') => {
    setBarcodeScannerFacingMode(mode);
    setBarcodeScannerError(null);
    setIsBarcodeScanning(true);
    setIsBarcodeScannerOpen(true);
    setScannedBarcodePreview('');
    setBarcodeScanSuccessFlash(false);

    if (barcodeAnimFrameRef.current) {
      cancelAnimationFrame(barcodeAnimFrameRef.current);
      barcodeAnimFrameRef.current = null;
    }
    if (barcodeCodeReaderRef.current) {
      try { barcodeCodeReaderRef.current.reset(); } catch (e) {}
      barcodeCodeReaderRef.current = null;
    }
    if (barcodeStreamRef.current) {
      try { barcodeStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      barcodeStreamRef.current = null;
    }

    setTimeout(async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (err: any) {
        console.warn('Initial HD camera stream failed, trying basic:', err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode }
          });
        } catch (err2: any) {
          console.warn('FacingMode camera failed, trying fallback stream:', err2);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (permErr: any) {
            console.error('Camera permission/access denied:', permErr);
            setBarcodeScannerError(
              permErr?.name === 'NotAllowedError' || permErr?.name === 'PermissionDeniedError'
                ? 'Permiso de cámara denegado. Por favor, concede permiso de cámara en tu navegador para escanear.'
                : 'No se pudo acceder a la cámara del dispositivo. Puedes buscar o ingresar el código manualmente.'
            );
            setIsBarcodeScanning(false);
            return;
          }
        }
      }

      if (!stream) {
        setBarcodeScannerError('No se encontró una cámara disponible en el dispositivo.');
        setIsBarcodeScanning(false);
        return;
      }

      barcodeStreamRef.current = stream;
      const video = barcodeVideoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        try {
          await video.play();
        } catch (e) {
          console.warn('Video play error:', e);
        }
      }

      let detected = false;

      const onBarcodeDetected = (rawCode: string) => {
        if (detected || !rawCode) return;
        detected = true;
        processBarcodeScan(rawCode, true);
      };

      // Native BarcodeDetector first
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'qr_code', 'itf']
          });

          const detectLoop = async () => {
            if (detected || !barcodeVideoRef.current) return;
            if (barcodeVideoRef.current.readyState >= 2) {
              try {
                const barcodes = await detector.detect(barcodeVideoRef.current);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  onBarcodeDetected(barcodes[0].rawValue);
                  return;
                }
              } catch (detErr) {}
            }
            barcodeAnimFrameRef.current = requestAnimationFrame(detectLoop);
          };

          barcodeAnimFrameRef.current = requestAnimationFrame(detectLoop);
          return;
        } catch (e) {
          console.warn('Native BarcodeDetector init failed, using ZXing:', e);
        }
      }

      // ZXing fallback
      try {
        const codeReader = new BrowserMultiFormatReader();
        barcodeCodeReaderRef.current = codeReader;
        codeReader.decodeFromStream(stream, barcodeVideoRef.current!, (result, err) => {
          if (result && !detected) {
            onBarcodeDetected(result.getText());
          }
        });
      } catch (zxingErr) {
        console.warn('ZXing fallback start error:', zxingErr);
      }
    }, 200);
  };

  const togglePosScannerCamera = () => {
    const nextMode = barcodeScannerFacingMode === 'environment' ? 'user' : 'environment';
    startPosBarcodeScanner(nextMode);
  };

  useEffect(() => {
    return () => {
      stopPosBarcodeScanner();
    };
  }, []);

  useEffect(() => {
    if (barcodeFeedbackBanner) {
      const timer = setTimeout(() => {
        setBarcodeFeedbackBanner(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [barcodeFeedbackBanner]);

  const isAnyModalOpen = isCartModalOpen || isAddClientModalOpen || isCheckoutModalOpen || isPendingOrdersModalOpen || isNuevoPedidoModalOpen || isDevolucionesModalOpen || isCotizacionesModalOpen || isPrescriptionModalOpen || !!viewingPrescriptionItem || isLiveCameraOpen || !!previewEnlargedPhoto || isBarcodeScannerOpen;

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

  // Local state for pending orders (starts clean, persists real orders created via "Nuevo Pedido")
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(() => {
    try {
      const saved = localStorage.getItem('yaa_pos_pending_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Purge legacy example mock orders
          return parsed.filter((o: any) => o && o.id !== 'PED-0412' && o.id !== 'PED-0415');
        }
      }
    } catch (e) {}
    return [];
  });

  // Sync real pending orders with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('yaa_pos_pending_orders', JSON.stringify(pendingOrders));
    } catch (e) {}
  }, [pendingOrders]);

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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const queryNoZeros = query.replace(/^0+/, '');
      result = result.filter(p => {
        const pBarcode = (p.barcode || '').toLowerCase().trim();
        const pCode = (p.code || '').toLowerCase().trim();
        const barcodeMatch = pBarcode.includes(query) || (queryNoZeros.length > 0 && pBarcode.includes(queryNoZeros));
        const codeMatch = pCode.includes(query) || (queryNoZeros.length > 0 && pCode.includes(queryNoZeros));
        const nameMatch = p.name?.toLowerCase().includes(query);
        const catMatch = p.category?.toLowerCase().includes(query);
        const detailMatch = p.detail?.toLowerCase().includes(query);
        const descMatch = (p as any).description?.toLowerCase().includes(query);
        const symptomsMatch = p.symptoms?.toLowerCase().includes(query);
        const labMatch = p.laboratory?.toLowerCase().includes(query);

        const matchesQuery = nameMatch || codeMatch || catMatch || detailMatch || descMatch || barcodeMatch || symptomsMatch || labMatch;
        if (!matchesQuery) return false;

        // If it matches code or barcode directly, include it regardless of selected category
        if (barcodeMatch || codeMatch) return true;

        if (selectedCategory !== 'Todos') {
          return p.category === selectedCategory;
        }
        return true;
      });
      return result;
    }

    if (selectedCategory !== 'Todos') {
      result = result.filter(p => p.category === selectedCategory);
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

  // Barcode Processing Engine (handles both Physical HID Scanner Guns & Camera Scanners)
  const lastScanTimestampRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const processBarcodeScan = (rawCode: string, fromCamera: boolean = false) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    // Guard against duplicate reads (rapid bounce within 400ms)
    const now = Date.now();
    if (lastScanTimestampRef.current.code.toLowerCase() === cleanCode.toLowerCase() && (now - lastScanTimestampRef.current.time) < 400) {
      return;
    }
    lastScanTimestampRef.current = { code: cleanCode, time: now };

    try {
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {}

    if (fromCamera) {
      setScannedBarcodePreview(cleanCode);
      setBarcodeScanSuccessFlash(true);
    }

    const cleanCodeLower = cleanCode.toLowerCase();
    const cleanCodeNoZeros = cleanCodeLower.replace(/^0+/, '');

    const matched = products.find(p => {
      const pBarcode = (p.barcode || '').trim().toLowerCase();
      const pCode = (p.code || '').trim().toLowerCase();
      const pId = (p.id || '').trim().toLowerCase();
      return (
        pBarcode === cleanCodeLower ||
        (cleanCodeNoZeros.length > 0 && pBarcode === cleanCodeNoZeros) ||
        pCode === cleanCodeLower ||
        (cleanCodeNoZeros.length > 0 && pCode === cleanCodeNoZeros) ||
        pId === cleanCodeLower
      );
    });

    // Reset category so the found product is guaranteed to be shown in the visual list
    setSelectedCategory('Todos');

    if (matched) {
      // Set search query to display the product in the product list (Venta Visual / Rápida)
      setSearchQuery(matched.barcode?.trim() || matched.code?.trim() || cleanCode);
      setBarcodeFeedbackBanner({
        type: 'success',
        message: `Producto encontrado: ${matched.name}`,
        sub: `Código: ${matched.code} ${matched.barcode ? `| CB: ${matched.barcode}` : ''} | Precio: ${currency}${matched.price.toFixed(2)} | Stock: ${getProductEffectiveStock(matched)}`,
        product: matched as POSProduct
      });
    } else {
      setSearchQuery(cleanCode);
      setBarcodeFeedbackBanner({
        type: 'error',
        message: `Producto no encontrado`,
        sub: `No existe ningún producto con el código de barras "${cleanCode}". Verifica en Inventario o regístralo.`
      });
    }

    if (fromCamera) {
      setTimeout(() => {
        setBarcodeScanSuccessFlash(false);
        stopPosBarcodeScanner();
      }, 650);
    }
  };

  // Physical Barcode Reader Listener for Desktop and Tablet in POS
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not hijack typing inside text modals like client registration, checkout notes, etc.
      if (
        isAddClientModalOpen || 
        isPrescriptionModalOpen || 
        isDevolucionesModalOpen || 
        isCotizacionesModalOpen || 
        isBarcodeScannerOpen || 
        isLiveCameraOpen
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime;

      if (e.key === 'Enter') {
        // Physical scanner burst detection (typically >= 3 chars typed within < 120ms between keys)
        if (buffer.length >= 3 && timeDiff < 150) {
          e.preventDefault();
          const code = buffer;
          buffer = '';
          processBarcodeScan(code, false);
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Reset buffer if delay exceeds typical hardware scanner burst
        if (timeDiff > 80 && buffer.length > 0) {
          buffer = '';
        }
        buffer += e.key;
        lastKeyTime = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [products, currency, isAddClientModalOpen, isPrescriptionModalOpen, isDevolucionesModalOpen, isCotizacionesModalOpen, isBarcodeScannerOpen, isLiveCameraOpen]);

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
      setErrorMessage(`Debe abrir la caja registradora en "${currentOperatingBranch}" para poder vender.`);
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
      branch: currentOperatingBranch,
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
      
      {/* 1. TOP HEADER & QUICK ACTION BUTTONS */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Header Title & Subtitle */}
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-[#2563EB] shrink-0" />
            <span className="truncate">Punto de Venta</span>
          </h1>
          <p className="text-xs text-[#64748B] font-normal truncate sm:whitespace-normal">
            Registra transacciones, administra pedidos en espera y emite comprobantes al instante.
          </p>
        </div>

        {/* Professional SaaS Action Buttons Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scrollbar-none sm:flex-wrap shrink-0">
          {/* Mobile Quick Barcode Scanner Button */}
          <button
            type="button"
            onClick={() => startPosBarcodeScanner()}
            className="md:hidden h-9 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            title="Escanear código de barras con la cámara"
          >
            <Camera className="w-4 h-4 text-white" />
            <Barcode className="w-3.5 h-3.5 text-blue-200" />
            <span>Escanear</span>
          </button>

          {/* 1. Nuevo Pedido (Primary Action) */}
          <button
            type="button"
            onClick={() => setIsNuevoPedidoModalOpen(true)}
            className="h-9 px-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 shrink-0 text-white" />
            <span>Nuevo Pedido</span>
          </button>

          {/* 2. Ver Pedidos (Secondary Action) */}
          <button
            type="button"
            onClick={() => setIsPendingOrdersModalOpen(true)}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-[#E2E8F0] text-[#1F2937] text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Star className="w-3.5 h-3.5 shrink-0 text-amber-500 fill-amber-500/20" />
            <span>Pedidos en Espera</span>
            {pendingOrders.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md leading-none">
                {pendingOrders.length}
              </span>
            )}
          </button>

          {/* 3. Cotizaciones */}
          <button
            type="button"
            onClick={() => setIsCotizacionesModalOpen(true)}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-[#E2E8F0] text-[#1F2937] text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>Cotizaciones</span>
          </button>

          {/* 4. Devoluciones */}
          <button
            type="button"
            onClick={() => setIsDevolucionesModalOpen(true)}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] border border-[#E2E8F0] text-[#1F2937] text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Undo2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>Devoluciones</span>
          </button>

          {/* 5. Cerrar Turno */}
          <button
            type="button"
            onClick={() => onNavigate('apertura-cierre')}
            className="h-9 px-3.5 bg-white hover:bg-rose-50 active:scale-[0.98] border border-rose-200 text-[#DC2626] text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
            <span>Cerrar Turno</span>
          </button>
        </div>
      </div>

      {/* 2. MODE SELECTOR (Segmented Control) & Operating Branch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Segmented control for POS Mode */}
        <div className="inline-flex p-1 bg-slate-200/70 border border-[#E2E8F0] rounded-lg">
          <button
            onClick={() => setPosMode('classica')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              posMode === 'classica' 
                ? 'bg-white text-[#1F2937] shadow-xs' 
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Venta Visual</span>
          </button>
          <button
            onClick={() => setPosMode('rapida')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              posMode === 'rapida' 
                ? 'bg-white text-[#1F2937] shadow-xs' 
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Venta Rápida / Código</span>
          </button>
        </div>

        {/* Operating Branch Tag */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs text-[#1F2937] shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
          <span className="text-[11px] text-[#64748B] font-medium">Sede:</span>
          {branches && branches.length > 1 && onSwitchBranch && !userAllowedBranches.length ? (
            <select
              value={branches.find(b => b.name.toLowerCase().trim() === currentOperatingBranch.toLowerCase().trim())?.id || ''}
              onChange={(e) => onSwitchBranch(e.target.value)}
              className="bg-transparent border-0 text-xs font-semibold text-[#1F2937] focus:outline-hidden cursor-pointer p-0"
              title="Cambiar sucursal para operar"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-[#1F2937]">{currentOperatingBranch}</span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ml-1 ${
            currentShift 
              ? 'bg-emerald-50 text-[#16A34A] border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {currentShift ? 'Caja Abierta' : 'Caja Cerrada'}
          </span>
        </div>
      </div>

      {/* 3. SALES SESSIONS (Multiple Cart Tabs) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#64748B] font-medium mr-1">Ventas activas:</span>
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              activeSessionId === s.id
                ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xs'
                : 'bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#1F2937] hover:bg-slate-50'
            }`}
          >
            <span>Ticket #{s.id}</span>
            {sessions.length > 1 && (
              <span 
                onClick={(e) => handleCloseSession(s.id, e)}
                className="text-[11px] hover:text-rose-200 leading-none p-0.5 rounded transition-colors"
                title="Cerrar ticket"
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          onClick={handleAddSession}
          className="px-3 py-1.5 bg-white border border-dashed border-[#CBD5E1] rounded-lg text-xs font-medium text-[#64748B] hover:text-[#1F2937] hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Ticket</span>
        </button>
      </div>

      {/* 4. MAIN POS GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        
        {/* Left Column: Product Search, Filter & Catalog Grid */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Search bar & Category dropdown */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] p-3 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-center">
              {/* Search input with Mobile Scanner Button */}
              <div className="flex gap-2 w-full items-center">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código de barras o descripción..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const q = searchQuery.trim();
                        if (q) {
                          processBarcodeScan(q, false);
                        }
                      }
                    }}
                    className="w-full pl-9 pr-8 py-2 rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] text-xs font-medium bg-white text-[#1F2937]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setBarcodeFeedbackBanner(null);
                      }}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Mobile Barcode Scanner Camera Button */}
                <button
                  type="button"
                  onClick={() => startPosBarcodeScanner()}
                  className="md:hidden flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-xs shrink-0 transition-all cursor-pointer"
                  title="Escanear código de barras con la cámara"
                >
                  <Camera className="w-4 h-4" />
                  <Barcode className="w-3.5 h-3.5 -ml-0.5" />
                  <span className="text-[11px] font-semibold">Escanear</span>
                </button>
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white text-[#1F2937] text-xs font-medium cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] w-full sm:w-44"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Barcode scan result feedback banner */}
            {barcodeFeedbackBanner && (
              <div className={`w-full p-2.5 sm:p-3 rounded-lg border text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200 ${
                barcodeFeedbackBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  {barcodeFeedbackBanner.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold truncate">{barcodeFeedbackBanner.message}</p>
                    {barcodeFeedbackBanner.sub && (
                      <p className="text-[11px] opacity-90 truncate">{barcodeFeedbackBanner.sub}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {barcodeFeedbackBanner.product && (
                    <button
                      type="button"
                      onClick={() => {
                        addToCart(barcodeFeedbackBanner.product!);
                        setBarcodeFeedbackBanner(null);
                      }}
                      className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition-all whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar al Ticket</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setBarcodeFeedbackBanner(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* VENTA CLASSICA: Visual Grid with Smooth Scrollable Viewport & Stock Badge & Images */}
          {posMode === 'classica' && (
            <div className="max-h-[620px] sm:max-h-[680px] overflow-y-auto pr-1 pb-3 scroll-smooth">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
                {filteredProducts.map(p => {
                  const effStock = getProductEffectiveStock(p);
                  const stockBadgeClass = effStock <= 0 
                    ? 'bg-rose-50 text-[#DC2626] border-rose-200' 
                    : effStock <= p.minStock 
                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                    : 'bg-emerald-50 text-[#16A34A] border-emerald-200';

                  return (
                    <div 
                      key={p.id}
                      onClick={() => openAddToCartModal(p)}
                      className="bg-white rounded-lg border border-[#E2E8F0] shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all overflow-hidden cursor-pointer relative flex flex-col group"
                    >
                      {/* Stock indicator badge */}
                      <div className={`absolute top-2 right-2 ${stockBadgeClass} border font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shadow-2xs z-10`}>
                        {effStock}
                      </div>

                      {/* Prescription badge */}
                      {isPrescriptionRequired(p) && (
                        <div className="absolute top-2 left-2 bg-rose-50 text-[#DC2626] border border-rose-200 font-bold text-[9px] px-1.5 py-0.5 rounded shadow-2xs z-10 flex items-center gap-1 uppercase tracking-wider">
                          <Stethoscope className="w-2.5 h-2.5" />
                          <span>Receta</span>
                        </div>
                      )}

                      {/* Image container */}
                      <div className="h-28 bg-[#F8FAFC] flex items-center justify-center p-2.5 relative select-none border-b border-[#F1F5F9] group-hover:bg-slate-100/60 transition-colors">
                        <img 
                          src={getProductImage(p)} 
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain mix-blend-multiply"
                        />
                      </div>

                      {/* Description & Price */}
                      <div className="p-3 text-center flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-[#1F2937] line-clamp-2 uppercase min-h-[32px]">
                            {p.name}
                          </h4>
                          <div className="text-sm font-bold text-[#2563EB] font-mono mt-1">
                            {currency}{p.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-[10px] font-medium tracking-wide text-[#64748B] uppercase mt-2">
                          {p.category}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-16 text-center bg-white rounded-lg border border-[#E2E8F0] p-8 text-[#64748B]">
                    <SlidersHorizontal className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                    <p className="text-sm font-medium">No se encontraron productos coincidentes en esta categoría.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VENTA RAPIDA: Fast List view optimized for keyboard or fast search */}
          {posMode === 'rapida' && (
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider px-2 mb-3">Lista de Productos</h3>
              <div className="divide-y divide-[#E2E8F0] max-h-[500px] overflow-y-auto pr-1">
                {filteredProducts.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => openAddToCartModal(p)}
                    className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-semibold text-[#1F2937]">{p.name}</h4>
                        {isPrescriptionRequired(p) && (
                          <span className="text-[9px] bg-rose-50 text-[#DC2626] font-bold px-1.5 py-0.5 rounded border border-rose-200 uppercase flex items-center gap-0.5">
                            <Stethoscope className="w-2.5 h-2.5" />
                            Receta
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#64748B] font-mono mt-0.5">Cód: {p.code} | Stock: <span className="font-semibold text-[#1F2937]">{getProductEffectiveStock(p)}</span></p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="text-xs font-bold text-[#2563EB] font-mono">{currency}{p.price.toFixed(2)}</span>
                      <button 
                        className="px-2.5 py-1 bg-slate-100 text-[#2563EB] hover:bg-[#2563EB] hover:text-white rounded-md text-[11px] font-semibold transition-colors"
                        onClick={(e) => { e.stopPropagation(); openAddToCartModal(p); }}
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Checkout Sidebar Pane */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col sticky top-4">
          
          {/* Header */}
          <div className="bg-[#172B4D] text-white px-4 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-300" />
              <h2 className="font-semibold text-xs uppercase tracking-wider text-white">Ticket de Venta</h2>
            </div>
            <span className="text-[11px] font-mono text-blue-200 bg-white/10 px-2 py-0.5 rounded-md">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.length === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>

          {/* Sidebar content container */}
          <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
            
            <div className="space-y-4 flex-1">
              {/* Client Selection Row */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#1F2937] uppercase tracking-wider">Cliente</label>
                <div className="flex gap-2">
                  <select
                    value={selectedClientId}
                    onChange={(e) => updateActiveSession(s => ({ ...s, selectedClientId: e.target.value }))}
                    className="w-full text-xs font-medium border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] h-9"
                  >
                    <option value="general">Cliente General / Consumidor Final</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.balanceCredit > 0 ? `(Saldo: ${currency}${c.balanceCredit.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-[#E2E8F0] text-[#1F2937] rounded-lg transition-colors cursor-pointer h-9 w-9 flex items-center justify-center shrink-0"
                    title="Registrar nuevo cliente"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cart items list / Empty cart illustration */}
              <div className="border-t border-[#E2E8F0] pt-3">
                {cart.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-[#64748B] text-center select-none">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border border-[#E2E8F0] mb-2.5 text-slate-400">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-xs text-[#1F2937]">Carrito vacío</h3>
                    <p className="text-[11px] text-[#64748B] mt-0.5">Haz clic en productos para agregarlos al ticket</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0] max-h-56 overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-[#1F2937] truncate uppercase">{item.product.name}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-mono font-bold text-[#1F2937]">{currency}{(item.customPrice ?? item.product.price).toFixed(2)}</span>
                            {item.selectedUnit && (
                              <span className="text-[10px] bg-slate-100 text-[#64748B] px-1.5 py-0.2 rounded font-medium">{item.selectedUnit}</span>
                            )}
                            {item.selectedLote && (
                              <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.2 rounded truncate max-w-[80px]" title={item.selectedLote}>
                                {item.selectedLote.split('–')[0].trim()}
                              </span>
                            )}
                            {item.prescription && (
                              <button
                                type="button"
                                onClick={() => setViewingPrescriptionItem(item)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 text-[10px] font-bold transition-colors cursor-pointer"
                                title="Ver receta médica registrada"
                              >
                                <FileSignature className="w-3 h-3 text-[#2563EB]" />
                                <span>Receta</span>
                                <Eye className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center border border-[#E2E8F0] rounded-md bg-white p-0.5">
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 hover:bg-slate-100 text-[#64748B] rounded transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-mono font-bold text-[#1F2937] min-w-[20px] text-center">
                            {item.quantity}
                          </span>
                          <button 
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 hover:bg-slate-100 text-[#64748B] rounded transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-[#DC2626] p-1.5 rounded transition-colors"
                          title="Eliminar producto"
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
            <div className="border-t border-[#E2E8F0] pt-3 space-y-3 shrink-0">
              
              {/* Discount selection row */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider shrink-0">Descuento</span>
                <div className="flex items-center border border-[#E2E8F0] rounded-lg overflow-hidden w-full bg-white">
                  <span className="pl-3 text-[#64748B] font-medium font-mono text-xs">
                    {discountType === 'fixed' ? currency : '%'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => updateActiveSession(s => ({ ...s, discountValue: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-transparent text-[#1F2937] font-semibold focus:outline-hidden text-right text-xs"
                  />
                  <div className="flex border-l border-[#E2E8F0] shrink-0 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => updateActiveSession(s => ({ ...s, discountType: 'percent' }))}
                      className={`px-3 py-1 font-semibold text-xs ${
                        discountType === 'percent' 
                          ? 'bg-[#2563EB] text-white' 
                          : 'text-[#64748B] hover:bg-slate-100'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveSession(s => ({ ...s, discountType: 'fixed' }))}
                      className={`px-3 py-1 font-semibold text-xs ${
                        discountType === 'fixed' 
                          ? 'bg-[#2563EB] text-white' 
                          : 'text-[#64748B] hover:bg-slate-100'
                      }`}
                    >
                      {currency}
                    </button>
                  </div>
                </div>
              </div>

              {/* Price list values */}
              <div className="bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] p-3.5 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-[#64748B] font-medium">
                  <span>Subtotal:</span>
                  <span>{currency}{cartTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#64748B] font-medium">
                  <span>Descuento:</span>
                  <span className="text-[#DC2626] font-semibold">-{currency}{cartTotals.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#64748B] font-medium">
                  <span>{taxName} ({taxRateVal.toFixed(2)}%):</span>
                  <span>{currency}{cartTotals.iva.toFixed(2)}</span>
                </div>
                
                {/* LARGE TOTAL VALUE HIGHLIGHTED */}
                <div className="flex justify-between border-t border-[#E2E8F0] pt-2.5 items-baseline">
                  <span className="text-[#1F2937] text-xs font-bold uppercase tracking-wider font-sans">Total a Pagar:</span>
                  <span className="text-[#1F2937] text-2xl font-bold font-mono tracking-tight">
                    {currency}{cartTotals.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Main Primary Submit Button (#2563EB) */}
              <button
                ref={staticBtnRef}
                type="button"
                disabled={cart.length === 0 || isSubmittingSale}
                onClick={() => {
                  if (isSubmittingSale) return;
                  setIsCheckoutModalOpen(true);
                }}
                className="w-full py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white rounded-lg text-sm font-semibold tracking-wide transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingSale ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>PROCESANDO VENTA...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>COBRAR {currency}{cartTotals.total.toFixed(2)}</span>
                  </>
                )}
              </button>

              {/* Footer navigation tools */}
              <div className="flex items-center justify-between text-xs font-medium px-1 text-[#64748B]">
                <button
                  type="button"
                  onClick={() => onNavigate('historial-ventas')}
                  className="hover:text-[#1F2937] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Historial</span>
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="hover:text-[#DC2626] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar Carrito</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING MOBILE & IPHONE BOTTOM CHECKOUT BUTTON */}
      {cart.length > 0 && !isAnyModalOpen && !isStaticBtnVisible && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 lg:hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          <button
            type="button"
            disabled={cart.length === 0 || isSubmittingSale}
            onClick={() => {
              if (isSubmittingSale) return;
              setIsCartModalOpen(true);
            }}
            className="w-[280px] h-[44px] px-4 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-lg flex items-center justify-between gap-2 cursor-pointer border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2">
              {isSubmittingSale ? (
                <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
              ) : (
                <ShoppingCart className="w-4 h-4 text-white shrink-0" />
              )}
              <span className="truncate">{isSubmittingSale ? 'Procesando...' : 'Cobrar Venta'}</span>
            </div>
            <span className="bg-blue-800/70 text-white px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0">
              {currency}{cartTotals.total.toFixed(2)}
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
                className="w-full py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] text-white rounded-lg text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingSale ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 text-white" />
                    <span>Continuar y Cobrar ({currency}{cartTotals.total.toFixed(2)})</span>
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
          <div className="bg-white rounded-lg max-w-md w-full p-5 sm:p-6 shadow-lg space-y-4 border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#2563EB]" />
                <span>Registrar Nuevo Cliente</span>
              </h3>
              <button 
                onClick={() => setIsAddClientModalOpen(false)}
                className="text-slate-400 hover:text-[#1F2937] p-1 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddClientSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Eduardo"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full text-xs font-medium border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1F2937]">Teléfono</label>
                  <input
                    type="text"
                    placeholder="8888-8888"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full text-xs font-medium border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1F2937]">Límite de Crédito ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={newClientLimit}
                    onChange={(e) => setNewClientLimit(e.target.value)}
                    className="w-full text-xs font-medium border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="cliente@dominio.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="w-full text-xs font-medium border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#1F2937] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHECKOUT DIALOG */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4 border border-[#E2E8F0] my-auto">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#16A34A]" />
                <span>Completar Venta y Cobro</span>
              </h3>
              <button 
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-[#1F2937] p-1 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
              
              {/* Payment selection grid */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('cash'); setCashReceived(''); }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'cash' 
                        ? 'border-[#2563EB] bg-blue-50/70 text-[#2563EB] shadow-2xs' 
                        : 'border-[#E2E8F0] hover:bg-slate-50 text-[#64748B]'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('card'); setCashReceived(''); }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'card' 
                        ? 'border-[#2563EB] bg-blue-50/70 text-[#2563EB] shadow-2xs' 
                        : 'border-[#E2E8F0] hover:bg-slate-50 text-[#64748B]'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Tarjeta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('transfer'); setCashReceived(''); }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'transfer' 
                        ? 'border-[#2563EB] bg-blue-50/70 text-[#2563EB] shadow-2xs' 
                        : 'border-[#E2E8F0] hover:bg-slate-50 text-[#64748B]'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Transferencia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('credit'); setCashReceived(''); }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      paymentMethod === 'credit' 
                        ? 'border-[#2563EB] bg-blue-50/70 text-[#2563EB] shadow-2xs' 
                        : 'border-[#E2E8F0] hover:bg-slate-50 text-[#64748B]'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Crédito POS</span>
                  </button>
                </div>
              </div>

              {/* Tipo de Comprobante */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Tipo de Comprobante</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['ticket', 'boleta', 'factura', 'recibo'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setVoucherType(t)}
                      className={`py-1.5 rounded-lg border text-xs font-medium capitalize transition-all cursor-pointer ${
                        voucherType === t
                          ? 'border-[#2563EB] bg-blue-50 text-[#2563EB] font-semibold'
                          : 'border-[#E2E8F0] hover:bg-slate-50 text-[#64748B]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de Venta */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Modalidad de Entrega</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['presencial', 'delivery'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSaleType(s)}
                      className={`py-1.5 rounded-lg border text-xs font-medium capitalize transition-all cursor-pointer ${
                        saleType === s
                          ? 'border-[#2563EB] bg-blue-50 text-[#2563EB] font-semibold'
                          : 'border-[#E2E8F0] hover:bg-slate-50 text-[#64748B]'
                      }`}
                    >
                      {s === 'presencial' ? 'Venta Presencial' : 'Servicio a Domicilio'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumen de Venta */}
              <div className="bg-[#F8FAFC] rounded-lg p-3.5 border border-[#E2E8F0] space-y-2.5">
                <div className="border-b border-[#E2E8F0] pb-2 flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#1F2937] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Detalle de Artículos</span>
                  </span>
                  <span className="text-[11px] font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {cart.reduce((acc, curr) => acc + curr.quantity, 0)} {cart.reduce((acc, curr) => acc + curr.quantity, 0) === 1 ? 'ítem' : 'ítems'}
                  </span>
                </div>

                {/* List of items */}
                <div className="max-h-36 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <p className="text-center text-xs text-[#64748B] py-3">El carrito está vacío</p>
                  ) : (
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[#64748B] font-semibold uppercase text-[10px] tracking-wider text-left border-b border-[#E2E8F0]">
                          <th className="py-1.5 pr-2">Producto</th>
                          <th className="py-1.5 px-1 text-center">Cant.</th>
                          <th className="py-1.5 px-1 text-right">P. Unit.</th>
                          <th className="py-1.5 pl-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-[#1F2937]">
                        {cart.map((item) => (
                          <tr key={item.product.id}>
                            <td className="py-1.5 pr-2 font-medium truncate max-w-[140px]" title={item.product.name}>
                              {item.product.name}
                            </td>
                            <td className="py-1.5 px-1 text-center font-mono font-medium">
                              {item.quantity}
                            </td>
                            <td className="py-1.5 px-1 text-right font-mono text-[#64748B]">
                              {currency}{(item.customPrice ?? item.product.price).toFixed(2)}
                            </td>
                            <td className="py-1.5 pl-2 text-right font-mono font-semibold text-[#1F2937]">
                              {currency}{((item.customPrice ?? item.product.price) * item.quantity).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Subtotals & Total */}
                <div className="border-t border-[#E2E8F0] pt-2 space-y-1 font-mono text-xs text-[#64748B]">
                  <div className="flex justify-between font-sans text-xs">
                    <span className="text-[#64748B]">Cliente:</span>
                    <span className="font-semibold text-[#1F2937] truncate max-w-[180px]">
                      {selectedClientObj?.name || 'Consumidor Final'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{currency}{cartTotals.subtotal.toFixed(2)}</span>
                  </div>
                  {cartTotals.discountAmount > 0 && (
                    <div className="flex justify-between text-[#DC2626]">
                      <span>Descuento:</span>
                      <span className="font-semibold">-{currency}{cartTotals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{taxName} ({taxRateVal.toFixed(2)}%):</span>
                    <span>{currency}{cartTotals.iva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-[#1F2937] border-t border-[#E2E8F0] pt-2 items-baseline font-sans">
                    <span className="uppercase tracking-wider">Total a Cobrar:</span>
                    <span className="text-[#1F2937] text-xl font-bold font-mono tracking-tight">
                      {currency}{cartTotals.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Conditional cash calculator */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#1F2937]">Efectivo Recibido *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#64748B] font-mono font-semibold text-xs">
                        {currency}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={cartTotals.total}
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] font-mono text-sm font-semibold bg-white text-[#1F2937]"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-semibold bg-emerald-50 border border-emerald-200 text-[#16A34A] p-2.5 rounded-lg font-mono">
                    <span className="font-sans font-medium text-xs">Cambio a Devolver:</span>
                    <span className="text-sm font-bold">{currency}{changeDue.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="text-xs font-medium text-[#DC2626] bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingSale || cart.length === 0}
                className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white rounded-lg text-xs font-semibold tracking-wide shadow-xs cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingSale ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                    <span>Registrando venta...</span>
                  </>
                ) : (
                  <span>Confirmar y Cobrar ({currency}{cartTotals.total.toFixed(2)})</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PENDING ORDERS LIST (Pedidos por Atender) */}
      {isPendingOrdersModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Pedidos Pendientes por Atender</span>
              </h3>
              <button 
                onClick={() => setIsPendingOrdersModalOpen(false)}
                className="text-slate-400 hover:text-[#1F2937] p-1 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-80 pr-1">
              {pendingOrders.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-2">
                    <Star className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <h4 className="text-xs font-semibold text-[#1F2937]">No hay pedidos pendientes</h4>
                  <p className="text-[11px] text-[#64748B] mt-0.5 max-w-xs mx-auto">
                    Los pedidos creados con la opción "Nuevo Pedido" aparecerán aquí listos para ser atendidos.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPendingOrdersModalOpen(false);
                      setIsNuevoPedidoModalOpen(true);
                    }}
                    className="mt-3 px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Registrar Nuevo Pedido</span>
                  </button>
                </div>
              ) : (
                pendingOrders.map(order => (
                  <div key={order.id} className="border border-[#E2E8F0] rounded-lg p-3.5 space-y-2.5 bg-white shadow-2xs">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-[#1F2937]">{order.id}</span>
                        <h4 className="text-xs font-medium text-[#64748B] mt-0.5">Cliente: <span className="font-semibold text-[#1F2937]">{order.customerName}</span></h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#16A34A]">{currency}{order.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-xs text-[#64748B] space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="font-mono text-[#1F2937]">{currency}{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end pt-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingOrders(prev => prev.filter(o => o.id !== order.id))}
                        className="px-2.5 py-1.5 text-slate-500 hover:text-[#DC2626] hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => handleLoadPendingOrder(order)}
                        className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                      >
                        Cargar en Carrito y Atender
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NUEVO PEDIDO FORM */}
      {isNuevoPedidoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#2563EB]" />
                <span>Registrar Nuevo Pedido Externo</span>
              </h3>
              <button 
                onClick={() => setIsNuevoPedidoModalOpen(false)}
                className="text-slate-400 hover:text-[#1F2937] p-1 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">Nombre del Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Alejandro Ruiz"
                  value={orderClientName}
                  onChange={(e) => setOrderClientName(e.target.value)}
                  className="w-full text-xs font-medium border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
              </div>

              {/* Add product to order */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#1F2937]">Buscar Producto</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Escriba código o nombre..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#E2E8F0] rounded-lg text-xs bg-white text-[#1F2937] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>

                {orderSearch && (
                  <div className="border border-[#E2E8F0] rounded-lg max-h-32 overflow-y-auto divide-y divide-[#E2E8F0] bg-white shadow-xs">
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
                        className="p-2 text-xs hover:bg-slate-50 cursor-pointer flex justify-between font-medium text-[#1F2937]"
                      >
                        <span>{p.name}</span>
                        <span className="text-[#2563EB] font-mono font-semibold">{currency}{p.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected items in order */}
              <div className="border border-[#E2E8F0] rounded-lg p-3 min-h-[80px] max-h-36 overflow-y-auto space-y-2 bg-[#F8FAFC]">
                {orderItems.length === 0 ? (
                  <p className="text-xs text-[#64748B] text-center py-4">Agregue productos para el pedido</p>
                ) : (
                  orderItems.map(item => (
                    <div key={item.product.id} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-[#1F2937]">{item.product.name}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="font-semibold text-[#1F2937]">x{item.quantity}</span>
                        <button 
                          type="button" 
                          onClick={() => setOrderItems(prev => prev.filter(i => i.product.id !== item.product.id))}
                          className="text-[#DC2626] hover:text-red-700 font-bold text-sm px-1"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="text-right text-xs font-semibold font-mono text-[#1F2937]">
                Total Pedido: {currency}{orderItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0).toFixed(2)}
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setIsNuevoPedidoModalOpen(false)}
                  className="px-4 py-2 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#1F2937] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={orderItems.length === 0}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  Registrar Pedido Pendiente
                </button>
              </div>
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
          <div className="bg-white rounded-lg max-w-lg w-full overflow-hidden shadow-xl border border-[#E2E8F0] flex flex-col my-auto max-h-[90vh] min-h-0">
            
            {/* Header: Enterprise SaaS style header (#172B4D) */}
            <div className="bg-[#172B4D] text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-[#243B61]">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4 text-blue-300" />
                <h3 className="font-semibold text-sm text-white tracking-tight">Agregar al Carrito</h3>
              </div>
              <button 
                onClick={() => {
                  setIsAddToCartModalOpen(false);
                  setSelectedProductToAddToCart(null);
                }}
                className="text-slate-300 hover:text-white transition-colors cursor-pointer p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              
              {/* Product Info Section */}
              <div className="flex items-center gap-3.5 bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                <div className="w-16 h-16 bg-white rounded-md border border-[#E2E8F0] flex items-center justify-center p-2 shrink-0 shadow-2xs">
                  <img 
                    src={getProductImage(selectedProductToAddToCart)} 
                    alt={selectedProductToAddToCart.name}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h4 className="font-bold text-[#1F2937] text-xs sm:text-sm tracking-tight uppercase truncate">
                    {selectedProductToAddToCart.name}
                  </h4>
                  <p className="text-[11px] text-[#64748B] font-mono">
                    Código: {selectedProductToAddToCart.code || 'GDU-0001'}
                  </p>
                  <div className="flex items-center gap-3 pt-0.5">
                    <div>
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase block">Precio Venta</span>
                      <span className="text-xs sm:text-sm font-bold text-[#2563EB] font-mono">
                        {currency}{selectedProductToAddToCart.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-5 w-[1px] bg-[#E2E8F0] self-end" />
                    <div>
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase block">Costo Base</span>
                      <span className="text-xs sm:text-sm font-semibold text-[#1F2937] font-mono">
                        {currency}{(selectedProductToAddToCart.cost ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3.5">
                
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
                className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <ShoppingCart className="w-4 h-4 text-white" />
                <span>Agregar al Carrito</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: REGISTRO DE RECETA (VENTANA BAJO RECETA MÉDICA) */}
      {isPrescriptionModalOpen && pendingPrescriptionItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-lg max-w-2xl w-full shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col my-auto max-h-[92vh]">
            
            {/* Header: Enterprise theme #172B4D */}
            <div className="bg-[#172B4D] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between border-b border-[#243B61] shrink-0">
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
                          Foto o Comprobante de la Receta <span className="text-slate-400 font-normal">(Opcional)</span>
                        </label>
                        {rxRecipePhoto && (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-150 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Foto adjunta
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* 1. Botón Principal: Cámara directa (móvil/tablet) */}
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#0086F0] hover:bg-[#0076d6] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all active:scale-[0.98]">
                          <Camera className="w-4 h-4 text-white shrink-0" />
                          <span>Cámara</span>
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

                        {/* 2. Botón Subir Archivo o desde Galería */}
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
                        📷 Campo opcional. En dispositivos móviles y tablets, el botón <strong>"Cámara"</strong> activa directamente la cámara trasera para fotografiar la receta física si desea adjuntarla.
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
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Registrar y Agregar al Carrito</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: VER DETALLE DE RECETA REGISTRADA EN CARRITO */}
      {viewingPrescriptionItem && viewingPrescriptionItem.prescription && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg max-w-md w-full shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col">
            <div className="bg-[#172B4D] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#243B61]">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-blue-300" />
                <h3 className="font-semibold text-sm text-white">Receta Médica Registrada</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingPrescriptionItem(null)}
                className="text-slate-300 hover:text-white cursor-pointer p-1 rounded-md"
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

      {/* MODAL: ESCÁNER DE CÓDIGO DE BARRAS MÓVIL EN PUNTO DE VENTA */}
      {isBarcodeScannerOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[70] flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between text-white shrink-0 pt-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  Escanear Producto (POS)
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Cámara Móvil
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300">Apunta la cámara al código de barras para agregarlo al carrito</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePosScannerCamera}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer"
                title="Cambiar entre cámara trasera y delantera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={stopPosBarcodeScanner}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer"
                title="Cerrar escáner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Viewfinder area */}
          <div className="relative flex-1 my-4 flex items-center justify-center overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl">
            {barcodeScannerError ? (
              <div className="p-6 text-center max-w-sm space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h5 className="font-bold text-white text-base">Acceso a la Cámara</h5>
                  <p className="text-xs text-slate-300 leading-relaxed">{barcodeScannerError}</p>
                </div>
                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => startPosBarcodeScanner(barcodeScannerFacingMode)}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reintentar Escaneo</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopPosBarcodeScanner}
                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Buscar Producto Manualmente</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={barcodeVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Reticle / Target Scanner Frame */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className={`relative w-full max-w-[290px] h-52 border-2 ${barcodeScanSuccessFlash ? 'border-emerald-400 bg-emerald-500/25 shadow-[0_0_30px_rgba(52,211,153,0.6)]' : 'border-blue-400/90 bg-black/15 shadow-[0_0_20px_rgba(59,130,246,0.3)]'} rounded-2xl transition-all duration-200 flex flex-col justify-between p-2`}>
                    {/* Corners */}
                    <div className="flex justify-between">
                      <div className="w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-md -mt-1.5 -ml-1.5" />
                      <div className="w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-md -mt-1.5 -mr-1.5" />
                    </div>

                    {/* Animated Laser line */}
                    {!barcodeScanSuccessFlash && (
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse" />
                    )}

                    {barcodeScanSuccessFlash && (
                      <div className="my-auto flex flex-col items-center justify-center gap-2 animate-in zoom-in-90 duration-150">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                        <span className="text-sm font-mono font-black text-white bg-black/80 px-3 py-1.5 rounded-lg border border-emerald-400/60 shadow-lg tracking-wider">
                          {scannedBarcodePreview}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <div className="w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-md -mb-1.5 -ml-1.5" />
                      <div className="w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-md -mb-1.5 -mr-1.5" />
                    </div>
                  </div>
                </div>

                {/* Status Guide Banner */}
                <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
                  <span className="inline-block bg-black/75 backdrop-blur-xs text-white text-[11px] px-3.5 py-1.5 rounded-full border border-white/15 font-medium shadow-md">
                    {barcodeScanSuccessFlash ? '✓ ¡Código detectado! Buscando producto...' : 'Centra el código de barras físico dentro del recuadro'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="shrink-0 pt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={stopPosBarcodeScanner}
              className="w-full py-3 px-4 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Cerrar escáner y buscar manualmente</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              Al detectar el código, se buscará y agregará automáticamente al carrito actual.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
