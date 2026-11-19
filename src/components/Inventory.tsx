import React, { useState, useMemo, useEffect, useRef } from 'react';
import { esc } from '../utils/escapeHtml';
import { useConfigList } from '../utils/useConfigList';
import { BrowserMultiFormatReader } from '@zxing/library';
import { Product, AppConfig, Sale, Purchase, Branch, User, StockMovement } from '../types';
import * as api from '../api';
import { isItemInBranch, getOperationalBranches } from '../utils/branchHelper';
import { compressImage, compressDataUrlIfNeeded } from '../utils/imageCompressor';
import { matchProductsByCode, SUPPORTED_BARCODE_FORMATS, getProductCodes } from '../utils/barcodeHelper';
import { 
  Plus, 
  PlusCircle,
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  ChevronRight, 
  PackageOpen, 
  RefreshCcw,
  CheckCircle2,
  Download,
  FileUp,
  FileSpreadsheet,
  FileText,
  Package,
  Boxes,
  Wrench,
  Tag,
  Barcode,
  MapPin,
  X,
  Sparkles,
  Layers,
  Printer,
  QrCode,
  TrendingUp,
  Gift,
  Truck,
  SlidersHorizontal,
  Info,
  Check,
  ShoppingBag,
  Clock,
  Folder,
  Eye,
  List,
  ArrowRightLeft,
  ArrowRight,
  Loader2,
  Camera,
  ScanLine,
  SwitchCamera
} from 'lucide-react';

interface InventoryProps {
  products: Product[];
  allProducts?: Product[];
  config: AppConfig;
  onSaveProduct: (product: Product) => Promise<Product>;
  onDeleteProduct: (id: string) => Promise<{ success: boolean }>;
  onRefreshData: () => void;
  onTransferStock?: (sourceBranchId: string, targetBranchId: string, productId: string, quantity: number) => Promise<void>;
  sales?: Sale[];
  purchases?: Purchase[];
  user?: User | null;
  activeBranchName?: string;
  branches?: Branch[];
  onSwitchBranch?: (branchName: string) => void;
}

// Interfaces for persistent items
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

function renderBarcodeSVG(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  const binaryPattern = Math.abs(hash).toString(2).padStart(20, '1010') + "11010101011";
  
  const bars: React.ReactNode[] = [];
  let x = 10;
  for (let i = 0; i < 45; i++) {
    const isWide = binaryPattern[i % binaryPattern.length] === '1';
    const width = isWide ? 2.2 : 0.8;
    bars.push(
      <rect key={i} x={x} y={2} width={width} height={36} fill="black" />
    );
    x += width + (i % 3 === 0 ? 1.6 : 0.8);
  }

  return (
    <svg viewBox={`0 0 ${x + 10} 40`} className="w-full h-11 mx-auto" preserveAspectRatio="none">
      {bars}
    </svg>
  );
}

// Helper to calculate total effective stock taking into account expirationDates/lotes sum
export const getProductStock = (p: Product | null | undefined): number => {
  if (!p) return 0;
  const baseStock = typeof p.stock === 'number' && !isNaN(p.stock) ? p.stock : 0;
  if (p.expirationDates && p.expirationDates.length > 0) {
    const lotesSum = p.expirationDates.reduce((acc, r) => acc + (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)), 0);
    return Math.max(baseStock, lotesSum);
  }
  return baseStock;
};

export default function Inventory({ 
  products, 
  allProducts,
  config, 
  onSaveProduct, 
  onDeleteProduct, 
  onRefreshData, 
  onTransferStock,
  sales = [], 
  purchases = [],
  user,
  activeBranchName,
  branches
}: InventoryProps) {
  const currency = config.currency || 'Q';

  // Transfer Stock Between Branches (Active when account has 2 or more branches)
  const availableBranches = useMemo(() => {
    if (branches && branches.length > 0) return branches;
    return getOperationalBranches(config, user);
  }, [branches, config, user]);

  const hasMultipleBranches = availableBranches.length >= 2;

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState<string>('');
  const [transferTargetId, setTransferTargetId] = useState<string>('');
  const [transferProductId, setTransferProductId] = useState<string>('');
  const [transferProductSearch, setTransferProductSearch] = useState<string>('');
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [transferSuccessMessage, setTransferSuccessMessage] = useState<string | null>(null);
  const [transferErrorMessage, setTransferErrorMessage] = useState<string | null>(null);

  // Initialize and synchronize default source & target branches
  useEffect(() => {
    if (availableBranches.length >= 2) {
      const activeObj = availableBranches.find(b => 
        (activeBranchName && (b.name === activeBranchName || b.code === activeBranchName || b.id === activeBranchName)) || b.isMain
      ) || availableBranches[0];

      if (!transferSourceId || !availableBranches.some(b => b.id === transferSourceId)) {
        setTransferSourceId(activeObj.id);
      }

      const other = availableBranches.find(b => b.id !== activeObj.id) || availableBranches[1];
      if (!transferTargetId || !availableBranches.some(b => b.id === transferTargetId) || transferTargetId === activeObj.id) {
        setTransferTargetId(other.id);
      }
    }
  }, [availableBranches, activeBranchName]);

  const productPool = useMemo(() => {
    return allProducts && allProducts.length > 0 ? allProducts : products;
  }, [allProducts, products]);

  const sourceBranchObj = useMemo(() => {
    return availableBranches.find(b => b.id === transferSourceId || b.name === transferSourceId);
  }, [availableBranches, transferSourceId]);

  const targetBranchObj = useMemo(() => {
    return availableBranches.find(b => b.id === transferTargetId || b.name === transferTargetId);
  }, [availableBranches, transferTargetId]);

  // Products belonging to the selected source branch with positive stock
  const sourceBranchProducts = useMemo(() => {
    if (!sourceBranchObj) return [];
    return productPool.filter(p => isItemInBranch(p.branch, sourceBranchObj.name, availableBranches) && (p.stock || 0) > 0);
  }, [productPool, sourceBranchObj, availableBranches]);

  // Filtered source products for modal search
  const filteredSourceProducts = useMemo(() => {
    if (!transferProductSearch.trim()) return sourceBranchProducts;
    const q = transferProductSearch.toLowerCase().trim();
    return sourceBranchProducts.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [sourceBranchProducts, transferProductSearch]);

  // Sync transferProductId when sourceBranchProducts changes
  useEffect(() => {
    if (sourceBranchProducts.length > 0) {
      if (!sourceBranchProducts.some(p => p.id === transferProductId)) {
        setTransferProductId(sourceBranchProducts[0].id);
      }
    } else {
      setTransferProductId('');
    }
  }, [sourceBranchProducts, transferProductId]);

  const selectedTransferProduct = useMemo(() => {
    return sourceBranchProducts.find(p => p.id === transferProductId) || null;
  }, [sourceBranchProducts, transferProductId]);

  const availableTransferStock = selectedTransferProduct ? Math.max(0, selectedTransferProduct.stock || 0) : 0;

  // Existing product in target branch (if already present)
  const targetExistingProduct = useMemo(() => {
    if (!targetBranchObj || !selectedTransferProduct) return null;
    return productPool.find(p =>
      isItemInBranch(p.branch, targetBranchObj.name, availableBranches) &&
      (p.code.trim().toLowerCase() === selectedTransferProduct.code.trim().toLowerCase() ||
        p.name.trim().toLowerCase() === selectedTransferProduct.name.trim().toLowerCase())
    );
  }, [productPool, targetBranchObj, selectedTransferProduct, availableBranches]);

  const targetCurrentStock = targetExistingProduct ? Math.max(0, targetExistingProduct.stock || 0) : 0;

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferErrorMessage(null);
    setTransferSuccessMessage(null);

    if (!sourceBranchObj || !targetBranchObj) {
      setTransferErrorMessage('Selecciona las sucursales de origen y destino.');
      return;
    }
    if (sourceBranchObj.id === targetBranchObj.id) {
      setTransferErrorMessage('La sucursal de origen y destino no pueden ser la misma.');
      return;
    }
    if (!selectedTransferProduct) {
      setTransferErrorMessage('Selecciona un producto con existencias para transferir.');
      return;
    }
    const qty = Math.floor(Number(transferQuantity));
    if (isNaN(qty) || qty <= 0) {
      setTransferErrorMessage('La cantidad a transferir debe ser mayor a 0.');
      return;
    }
    if (qty > availableTransferStock) {
      setTransferErrorMessage(`La cantidad supera el stock disponible (${availableTransferStock}) en ${sourceBranchObj.name}.`);
      return;
    }

    setIsTransferring(true);
    try {
      if (onTransferStock) {
        await onTransferStock(sourceBranchObj.id, targetBranchObj.id, selectedTransferProduct.id, qty);
      } else {
        // Fallback transfer via onSaveProduct
        const nextSourceStock = Math.max(0, availableTransferStock - qty);
        const updatedSourceProduct: Product = {
          ...selectedTransferProduct,
          branch: selectedTransferProduct.branch || sourceBranchObj.name,
          stock: nextSourceStock
        };

        if (selectedTransferProduct.expirationDates && selectedTransferProduct.expirationDates.length > 0) {
          let rem = qty;
          const updatedLotes = selectedTransferProduct.expirationDates
            .map(r => {
              if (rem <= 0) return r;
              const s = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
              const deduct = Math.min(s, rem);
              rem -= deduct;
              return { ...r, stock: s - deduct };
            })
            .filter(r => (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)) > 0);
          updatedSourceProduct.expirationDates = updatedLotes;
        } else {
          delete updatedSourceProduct.expirationDates;
        }

        await onSaveProduct(updatedSourceProduct);

        if (targetExistingProduct) {
          const nextTargetStock = (targetExistingProduct.stock || 0) + qty;
          const targetLotes = targetExistingProduct.expirationDates ? [...targetExistingProduct.expirationDates] : [];
          if (targetLotes.length > 0) {
            targetLotes[0] = {
              ...targetLotes[0],
              stock: (Number(targetLotes[0].stock) || 0) + qty
            };
          }
          const updatedTargetProduct: Product = {
            ...targetExistingProduct,
            branch: targetBranchObj.name,
            stock: nextTargetStock
          };
          if (targetLotes.length > 0) {
            updatedTargetProduct.expirationDates = targetLotes;
          } else if (targetExistingProduct.expirationDates) {
            updatedTargetProduct.expirationDates = targetExistingProduct.expirationDates;
          } else {
            delete updatedTargetProduct.expirationDates;
          }
          await onSaveProduct(updatedTargetProduct);
        } else {
          const newTargetProduct: Product = {
            ...selectedTransferProduct,
            id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            branch: targetBranchObj.name,
            stock: qty
          };
          if (selectedTransferProduct.expirationDate) {
            newTargetProduct.expirationDates = [
              { date: selectedTransferProduct.expirationDate, stock: qty, batch: selectedTransferProduct.initialBatch || '00101' }
            ];
          } else if (selectedTransferProduct.expirationDates && selectedTransferProduct.expirationDates.length > 0) {
            newTargetProduct.expirationDates = [
              { date: selectedTransferProduct.expirationDates[0].date, stock: qty, batch: selectedTransferProduct.expirationDates[0].batch || '00101' }
            ];
          } else {
            delete newTargetProduct.expirationDates;
          }
          await onSaveProduct(newTargetProduct);
        }
      }

      setTransferSuccessMessage(`¡Transferencia de ${qty} ${selectedTransferProduct.unit || 'unidad(es)'} de "${selectedTransferProduct.name}" realizada con éxito hacia ${targetBranchObj.name}!`);
      onRefreshData();

      setTimeout(() => {
        setIsTransferModalOpen(false);
        setTransferSuccessMessage(null);
        setTransferQuantity(1);
        setTransferNotes('');
        setTransferProductSearch('');
      }, 1500);
    } catch (err: any) {
      let msg = err.message || 'Error al realizar el traslado entre sucursales.';
      if (msg.includes('Unsupported field value: undefined') || msg.includes('setDoc()')) {
        msg = 'Se optimizó la sincronización con la base de datos. Por favor vuelve a pulsar "Confirmar y Transferir Stock".';
      }
      setTransferErrorMessage(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  // State for Sub-Navigation Tabs
  const [activeTab, setActiveTab] = useState<'stock' | 'combos' | 'servicios' | 'promociones' | 'barcodes'>('stock');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [stockFilter, setStockFilter] = useState<'all' | 'critical' | 'outOfStock' | 'expiring'>('all');

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // General Detail Modal State
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (detailProduct) {
      const currentInList = products.find(p => p.id === detailProduct.id);
      if (currentInList) {
        setDetailProduct(currentInList);
      }
    }
  }, [products]);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('');
  const [formUnit, setFormUnit] = useState('Pza');
  const [formExpirationDate, setFormExpirationDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDetail, setFormDetail] = useState('');

  // Pharmacy-specific form fields
  const [formRegistrationDate, setFormRegistrationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formBarcode, setFormBarcode] = useState('');
  const [formPharmacyType, setFormPharmacyType] = useState('Genérico'); // Genérico, Comercial/De Marca
  const [formPrescriptionRequired, setFormPrescriptionRequired] = useState('sin receta médica'); // sin receta médica, bajo receta médica
  const [formSanitaryRegister, setFormSanitaryRegister] = useState('');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formUnitsPerBox, setFormUnitsPerBox] = useState('');
  const [formUnitsPerBlister, setFormUnitsPerBlister] = useState('');
  const [formMarginPercent, setFormMarginPercent] = useState('');
  const [formPricePerUnit, setFormPricePerUnit] = useState('');
  const [formPricePerBlister, setFormPricePerBlister] = useState('0');
  const [formPricePerBox, setFormPricePerBox] = useState('0');
  const [laboratoriesList, setLaboratoriesList] = useConfigList<string>(
    config, 'laboratories', 'pharmacy_laboratories',
    ['Bayer', 'Genfar', 'Pfizer', 'Roche', 'Abbott', 'Sandoz', 'Laboratorios Ramos', 'Otros']
  );
  const [isAddLabModalOpen, setIsAddLabModalOpen] = useState(false);
  const [newLabName, setNewLabName] = useState('');
  const [formLaboratory, setFormLaboratory] = useState('Bayer');

  const combinedLabs = useMemo(() => {
    const fromProducts = products.map(p => p.laboratory).filter(Boolean) as string[];
    return Array.from(new Set([...laboratoriesList, ...fromProducts]));
  }, [laboratoriesList, products]);

  // Mobile Barcode Scanner State for Product Form & Inventory Search
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [barcodeScannerError, setBarcodeScannerError] = useState<string | null>(null);
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);
  const [scannerFacingMode, setScannerFacingMode] = useState<'environment' | 'user'>('environment');
  const [targetBarcodeField, setTargetBarcodeField] = useState<'barcode' | 'code' | 'inventory_search'>('barcode');
  const [scanSuccessFlash, setScanSuccessFlash] = useState(false);
  const [scannedCodePreview, setScannedCodePreview] = useState<string>('');
  const [inventoryScanFeedback, setInventoryScanFeedback] = useState<{ type: 'success' | 'error'; message: string; sub?: string } | null>(null);
  const [productFormScanFeedback, setProductFormScanFeedback] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);

  const videoScannerRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const stopBarcodeScanner = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {}
      codeReaderRef.current = null;
    }
    if (scannerStreamRef.current) {
      try {
        scannerStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      scannerStreamRef.current = null;
    }
    if (videoScannerRef.current) {
      videoScannerRef.current.srcObject = null;
    }
    setIsBarcodeScannerOpen(false);
    setBarcodeScannerError(null);
    setIsBarcodeScanning(false);
  };

  const startBarcodeScanner = async (field: 'barcode' | 'code' | 'inventory_search' = 'barcode', mode: 'environment' | 'user' = 'environment') => {
    setTargetBarcodeField(field);
    setScannerFacingMode(mode);
    setBarcodeScannerError(null);
    setIsBarcodeScanning(true);
    setIsBarcodeScannerOpen(true);
    setScannedCodePreview('');
    setScanSuccessFlash(false);

    // Stop previous streams/decoders if any
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (codeReaderRef.current) {
      try { codeReaderRef.current.reset(); } catch (e) {}
      codeReaderRef.current = null;
    }
    if (scannerStreamRef.current) {
      try { scannerStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      scannerStreamRef.current = null;
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
                : 'No se pudo acceder a la cámara del dispositivo. Puedes ingresar el código manualmente.'
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

      scannerStreamRef.current = stream;
      const video = videoScannerRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        try {
          await video.play();
        } catch (e) {
          console.warn('Video play caught:', e);
        }
      }

      let detected = false;

      const onDetected = (scannedCode: string) => {
        if (detected || !scannedCode) return;
        detected = true;
        const cleanCode = scannedCode.trim();

        try {
          if (navigator.vibrate) navigator.vibrate(100);
        } catch (e) {}

        setScannedCodePreview(cleanCode);
        setScanSuccessFlash(true);

        if (field === 'barcode') {
          setFormBarcode(cleanCode);
          setFormCode(prev => (!prev || prev.startsWith('SKU-') ? cleanCode : prev));
          const { exactMatches } = matchProductsByCode(products, cleanCode);
          const existing = exactMatches.find(p => !editingProduct || p.id !== editingProduct.id);
          if (existing) {
            setProductFormScanFeedback({
              type: 'warning',
              message: `Aviso: Este código ya pertenece a "${existing.name}" (SKU: ${existing.code})`
            });
          } else {
            setProductFormScanFeedback({
              type: 'success',
              message: `✓ Código de barras capturado: ${cleanCode}`
            });
          }
        } else if (field === 'code') {
          setFormCode(cleanCode);
        } else if (field === 'inventory_search') {
          setCodeFilter(cleanCode);
          const { exactMatches, partialMatches } = matchProductsByCode(products, cleanCode);
          if (exactMatches.length === 1) {
            const matched = exactMatches[0];
            setSearchQuery(matched.barcode?.trim() || matched.code?.trim() || cleanCode);
            setInventoryScanFeedback({
              type: 'success',
              message: `Producto identificado: ${matched.name}`,
              sub: `Código: ${cleanCode} | Stock: ${getProductStock(matched)} | Ubicación: ${matched.location || 'Almacén Principal'}`
            });
          } else if (exactMatches.length > 1) {
            setSearchQuery(cleanCode);
            setInventoryScanFeedback({
              type: 'success',
              message: `Se encontraron ${exactMatches.length} productos con el código "${cleanCode}"`,
              sub: exactMatches.map(p => p.name).slice(0, 3).join(', ') + (exactMatches.length > 3 ? '...' : '')
            });
          } else if (partialMatches.length > 0) {
            setSearchQuery(cleanCode);
            setInventoryScanFeedback({
              type: 'success',
              message: `Se encontraron ${partialMatches.length} coincidencia(s) para "${cleanCode}"`,
              sub: partialMatches.map(p => p.name).slice(0, 3).join(', ')
            });
          } else {
            setSearchQuery(cleanCode);
            setInventoryScanFeedback({
              type: 'error',
              message: `Producto no encontrado en inventario`,
              sub: `No existe ningún producto con el código "${cleanCode}". Puedes pulsar "Registrar Nuevo Producto" para añadirlo.`
            });
          }
        }

        setTimeout(() => {
          setScanSuccessFlash(false);
          stopBarcodeScanner();
        }, 650);
      };

      // 1. Hardware-accelerated native BarcodeDetector if supported
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: SUPPORTED_BARCODE_FORMATS
          });

          const detectLoop = async () => {
            if (detected || !videoScannerRef.current) return;
            if (videoScannerRef.current.readyState >= 2) {
              try {
                const barcodes = await barcodeDetector.detect(videoScannerRef.current);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  onDetected(barcodes[0].rawValue);
                  return;
                }
              } catch (detErr) {}
            }
            animFrameRef.current = requestAnimationFrame(detectLoop);
          };

          animFrameRef.current = requestAnimationFrame(detectLoop);
          return;
        } catch (e) {
          console.warn('Native BarcodeDetector init failed, using ZXing fallback:', e);
        }
      }

      // 2. Reliable cross-browser ZXing fallback
      try {
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;
        codeReader.decodeFromStream(stream, videoScannerRef.current!, (result, err) => {
          if (result && !detected) {
            onDetected(result.getText());
          }
        });
      } catch (zxingErr) {
        console.warn('ZXing fallback start error:', zxingErr);
      }
    }, 200);
  };

  const toggleScannerCamera = () => {
    const nextMode = scannerFacingMode === 'environment' ? 'user' : 'environment';
    startBarcodeScanner(targetBarcodeField, nextMode);
  };

  useEffect(() => {
    return () => {
      stopBarcodeScanner();
    };
  }, []);

  useEffect(() => {
    if (inventoryScanFeedback) {
      const timer = setTimeout(() => {
        setInventoryScanFeedback(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [inventoryScanFeedback]);

  useEffect(() => {
    if (productFormScanFeedback) {
      const timer = setTimeout(() => {
        setProductFormScanFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [productFormScanFeedback]);

  // Physical Barcode Reader Engine for Desktop & Tablet
  const lastPhysicalInventoryScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const handlePhysicalScanInForm = (rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    const now = Date.now();
    if (lastPhysicalInventoryScanRef.current.code.toLowerCase() === cleanCode.toLowerCase() && (now - lastPhysicalInventoryScanRef.current.time) < 400) {
      return;
    }
    lastPhysicalInventoryScanRef.current = { code: cleanCode, time: now };

    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch (e) {}

    // Fill barcode field and code field if empty/auto-generated
    setFormBarcode(cleanCode);
    setFormCode(prev => (!prev || prev.startsWith('SKU-') ? cleanCode : prev));

    // Check if barcode already belongs to another product
    const { exactMatches } = matchProductsByCode(products, cleanCode);
    const existing = exactMatches.find(p => !editingProduct || p.id !== editingProduct.id);

    if (existing) {
      setProductFormScanFeedback({
        type: 'warning',
        message: `Aviso: Este código ya pertenece a "${existing.name}" (SKU: ${existing.code})`
      });
    } else {
      setProductFormScanFeedback({
        type: 'success',
        message: `✓ Código de barras capturado: ${cleanCode}`
      });
    }
  };

  const handlePhysicalScanInTable = (rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    const now = Date.now();
    if (lastPhysicalInventoryScanRef.current.code.toLowerCase() === cleanCode.toLowerCase() && (now - lastPhysicalInventoryScanRef.current.time) < 400) {
      return;
    }
    lastPhysicalInventoryScanRef.current = { code: cleanCode, time: now };

    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch (e) {}

    setCodeFilter(cleanCode);

    const { exactMatches, partialMatches } = matchProductsByCode(products, cleanCode);

    if (exactMatches.length === 1) {
      const matched = exactMatches[0];
      setSearchQuery(matched.barcode?.trim() || matched.code?.trim() || cleanCode);
      setInventoryScanFeedback({
        type: 'success',
        message: `Producto identificado: ${matched.name}`,
        sub: `Código: ${cleanCode} | Stock: ${getProductStock(matched)} | Ubicación: ${matched.location || 'Almacén Principal'}`
      });
    } else if (exactMatches.length > 1) {
      setSearchQuery(cleanCode);
      setInventoryScanFeedback({
        type: 'success',
        message: `Se encontraron ${exactMatches.length} productos con el código "${cleanCode}"`,
        sub: exactMatches.map(p => p.name).slice(0, 3).join(', ') + (exactMatches.length > 3 ? '...' : '')
      });
    } else if (partialMatches.length > 0) {
      setSearchQuery(cleanCode);
      setInventoryScanFeedback({
        type: 'success',
        message: `Se encontraron ${partialMatches.length} coincidencia(s) para "${cleanCode}"`,
        sub: partialMatches.map(p => p.name).slice(0, 3).join(', ')
      });
    } else {
      setSearchQuery(cleanCode);
      setInventoryScanFeedback({
        type: 'error',
        message: `Producto no encontrado en inventario`,
        sub: `No existe ningún producto con el código "${cleanCode}". Puedes pulsar "Registrar Nuevo Producto" para añadirlo.`
      });
    }
  };

  // Global Keydown Listener for Hardware Barcode Scanners in Inventory View
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if camera scanner or specific modal is open
      if (
        isBarcodeScannerOpen || 
        isAddLabModalOpen || 
        isTransferModalOpen
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime;

      if (e.key === 'Enter') {
        // Fast sequence ending in Enter (typical physical scanner gun)
        if (buffer.length >= 3 && timeDiff < 150) {
          e.preventDefault();
          const code = buffer;
          buffer = '';
          if (isModalOpen) {
            handlePhysicalScanInForm(code);
          } else {
            handlePhysicalScanInTable(code);
          }
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
  }, [
    isModalOpen, 
    products, 
    isBarcodeScannerOpen, 
    isAddLabModalOpen, 
    isTransferModalOpen,
    editingProduct
  ]);

  const isBlisterHidden = useMemo(() => {
    if (!formUnit) return false;
    const unitLower = formUnit.toLowerCase().trim();
    return (
      unitLower === 'jarabe' ||
      unitLower === 'ampolla' ||
      unitLower === 'suspensión' ||
      unitLower === 'suspension' ||
      unitLower === 'frasco'
    );
  }, [formUnit]);

  const handleAddNewLaboratory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLabName.trim();
    if (!trimmed) return;
    if (!laboratoriesList.includes(trimmed)) {
      const updatedList = [...laboratoriesList, trimmed];
      setLaboratoriesList(updatedList);
    }
    setFormLaboratory(trimmed);
    setNewLabName('');
    setIsAddLabModalOpen(false);
  };

  const [formSymptoms, setFormSymptoms] = useState('');
  const [formStatus, setFormStatus] = useState('Activo');
  const [formManageBatchAndExpiration, setFormManageBatchAndExpiration] = useState(true);
  const [formExpirationAlertDays, setFormExpirationAlertDays] = useState('');
  const [formInitialBatch, setFormInitialBatch] = useState('00101');
  const [formExpirationRows, setFormExpirationRows] = useState<{ date: string; stock: string; batch: string }[]>([]);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (config.businessType === 'pharmacy' && formManageBatchAndExpiration && formExpirationRows.length > 0) {
      const hasAnyStockEntered = formExpirationRows.some(r => String(r.stock).trim() !== '');
      if (hasAnyStockEntered) {
        const sum = formExpirationRows.reduce((acc, r) => acc + (parseInt(r.stock) || 0), 0);
        setFormStock(sum.toString());
      }
    }
  }, [formExpirationRows, formManageBatchAndExpiration, config.businessType]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressed = await compressImage(file, 600, 600, 0.75);
      setFormImageUrl(compressed);
    } catch {
      alert("Error al procesar la imagen.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      try {
        const compressed = await compressImage(file, 600, 600, 0.75);
        setFormImageUrl(compressed);
      } catch {
        alert("Error al procesar la imagen.");
      }
    }
  };

  // Modals for special tabs
  const [isKardexOpen, setIsKardexOpen] = useState(false);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Product-specific Kardex modal states
  const [selectedKardexProduct, setSelectedKardexProduct] = useState<Product | null>(null);
  const [kardexBranch, setKardexBranch] = useState<string>(activeBranchName || 'Todas');

  useEffect(() => {
    if (activeBranchName) setKardexBranch(activeBranchName);
  }, [activeBranchName]);

  const [isProductKardexOpen, setIsProductKardexOpen] = useState(false);
  const [newAdjustmentQty, setNewAdjustmentQty] = useState('');
  const [newAdjustmentType, setNewAdjustmentType] = useState<'entrada' | 'salida'>('entrada');
  const [newAdjustmentReason, setNewAdjustmentReason] = useState('Ajuste de inventario');

  const [adjustmentMovements, setAdjustmentMovements] = useState<StockMovement[]>([]);
  const [kardexReloadKey, setKardexReloadKey] = useState(0);
  useEffect(() => {
    if (!selectedKardexProduct) { setAdjustmentMovements([]); return; }
    let cancelled = false;
    api.getStockMovements(selectedKardexProduct.id, 'ajuste').then(list => { if (!cancelled) setAdjustmentMovements(list); });
    return () => { cancelled = true; };
  }, [selectedKardexProduct?.id, kardexReloadKey]);

  const productKardexHistory = useMemo(() => {
    if (!selectedKardexProduct) return [];

    const history: Array<{
      id: string;
      date: string;
      type: 'entrada' | 'salida' | 'inicial';
      concept: string;
      reference: string;
      quantity: number;
      price?: number;
      cost?: number;
      balance: number;
      user: string;
      operation: string;
      motivo: string;
      lote: string;
      vence: string;
    }> = [];

    if (sales) {
      sales.forEach(sale => {
        if (kardexBranch !== 'Todas' && !isItemInBranch(sale.branch, kardexBranch, branches || config.branches)) {
          return;
        }
        const item = sale.items.find(i => i.productId === selectedKardexProduct.id);
        if (item) {
          history.push({
            id: `sale-${sale.id}-${item.productId}`,
            date: sale.date,
            type: 'salida',
            concept: 'Venta (POS)',
            reference: `Nota #${sale.id.substring(0, 6).toUpperCase()}`,
            quantity: item.quantity,
            price: item.price,
            cost: item.cost,
            balance: 0,
            user: 'Administrador',
            operation: 'Salida',
            motivo: 'Venta',
            lote: `LOTE-${selectedKardexProduct.code}-1`,
            vence: selectedKardexProduct.expirationDate || '9/12/2026'
          });
        }
      });
    }

    if (purchases) {
      purchases.forEach(purchase => {
        if (kardexBranch !== 'Todas' && !isItemInBranch(purchase.branch, kardexBranch, branches || config.branches)) {
          return;
        }
        const item = purchase.items.find(i => i.productId === selectedKardexProduct.id);
        if (item) {
          history.push({
            id: `purchase-${purchase.id}-${item.productId}`,
            date: purchase.date,
            type: 'entrada',
            concept: 'Compra a Proveedor',
            reference: `Orden #${purchase.id.substring(0, 6).toUpperCase()}`,
            quantity: item.quantity,
            cost: item.cost,
            balance: 0,
            user: 'Administrador',
            operation: 'Entrada',
            motivo: 'Compra',
            lote: item.lote || selectedKardexProduct.initialBatch || '00101',
            vence: item.expirationDate || selectedKardexProduct.expirationDate || '—'
          });
        }
      });
    }

    // Ajustes manuales registrados en el kardex de Firestore.
    adjustmentMovements.forEach(m => {
      const isIn = m.quantity > 0;
      history.push({
        id: m.id,
        date: m.date,
        type: isIn ? 'entrada' : 'salida',
        concept: m.reason || 'Ajuste Manual',
        reference: m.reason || 'Ajuste de inventario',
        quantity: Math.abs(m.quantity),
        cost: selectedKardexProduct.cost,
        price: selectedKardexProduct.price,
        balance: 0,
        user: m.operatorName || 'Usuario',
        operation: isIn ? 'Entrada' : 'Salida',
        motivo: 'Ajuste Manual',
        lote: selectedKardexProduct.initialBatch || '—',
        vence: selectedKardexProduct.expirationDate || '—'
      });
    });

    // Ajustes antiguos guardados solo en este navegador (solo lectura).
    const savedAdjustmentsKey = `kardex_adjustments_${selectedKardexProduct.id}`;
    const savedAdjustmentsStr = localStorage.getItem(savedAdjustmentsKey);
    if (savedAdjustmentsStr) {
      try {
        const adjustments = JSON.parse(savedAdjustmentsStr);
        adjustments.forEach((adj: any) => {
          history.push({
            id: adj.id,
            date: adj.date,
            type: adj.type,
            concept: adj.reference || 'Ajuste Manual',
            reference: adj.reference || 'Ajuste de inventario',
            quantity: adj.quantity,
            cost: selectedKardexProduct.cost,
            price: selectedKardexProduct.price,
            balance: 0,
            user: 'Administrador',
            operation: adj.type === 'entrada' ? 'Entrada' : 'Salida',
            motivo: 'Ajuste Manual',
            lote: adj.lote || `LOTE-${selectedKardexProduct.code}-1`,
            vence: adj.vence || selectedKardexProduct.expirationDate || '10/12/2026'
          });
        });
      } catch (e) {
        console.error(e);
      }
    }

    history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let sumEntradas = 0;
    let sumSalidas = 0;
    history.forEach(h => {
      if (h.type === 'entrada') sumEntradas += h.quantity;
      if (h.type === 'salida') sumSalidas += h.quantity;
    });

    let calculatedInitial = selectedKardexProduct.stock - sumEntradas + sumSalidas;
    if (calculatedInitial < 0) {
      calculatedInitial = 0;
    }

    const initialRecord = {
      id: `initial-${selectedKardexProduct.id}`,
      date: selectedKardexProduct.expirationDate || '2026-05-18T20:56:45.000Z',
      type: 'inicial' as const,
      concept: 'Inventario Inicial',
      reference: 'Stock demo ' + selectedKardexProduct.code,
      quantity: calculatedInitial,
      cost: selectedKardexProduct.cost,
      price: selectedKardexProduct.price,
      balance: calculatedInitial,
      user: 'administrador',
      operation: 'Entrada',
      motivo: 'Inicial',
      lote: `LOTE-${selectedKardexProduct.code}-1`,
      vence: selectedKardexProduct.expirationDate || '9/12/2026'
    };

    const fullHistory = [initialRecord, ...history];

    let currentBal = calculatedInitial;
    for (let i = 1; i < fullHistory.length; i++) {
      const entry = fullHistory[i];
      if (entry.type === 'entrada') {
        currentBal += entry.quantity;
      } else if (entry.type === 'salida') {
        currentBal -= entry.quantity;
      }
      entry.balance = currentBal;
    }

    return [...fullHistory].reverse();
  }, [selectedKardexProduct, sales, purchases, kardexBranch, branches, config.branches, adjustmentMovements]);

  const handlePrintKardex = () => {
    if (!selectedKardexProduct) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('No se pudo abrir la ventana de impresión. Por favor, permita las ventanas emergentes.');
      return;
    }

    const html = `
      <html>
        <head>
          <title>Kardex - ${esc(selectedKardexProduct.name)}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #1e293b; background: white; }
            h1 { color: #005e63; margin-bottom: 2px; font-size: 22px; font-weight: bold; }
            .subtitle { color: #64748b; font-size: 11px; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; border: 1px solid #e2e8f0; padding: 16px; border-radius: 12px; margin-bottom: 30px; font-size: 12px; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
            .info-value { font-weight: bold; color: #1e293b; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background-color: #ebf5ff; color: #004e7c; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .entrada { color: #047857; font-weight: bold; }
            .salida { color: #e11d48; font-weight: bold; }
            .badge-inicial { background-color: #0086F0; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            .badge-venta { background-color: #64748b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            .badge-compra { background-color: #059669; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            .badge-ajuste { background-color: #d97706; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Kardex de Inventario</h1>
          <div class="subtitle">Historial de movimientos para el producto seleccionado</div>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">CÓDIGO/SKU</span>
              <span class="info-value">${esc(selectedKardexProduct.code)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">PRODUCTO / CATEGORÍA</span>
              <span class="info-value">${esc(selectedKardexProduct.name)} (${esc(selectedKardexProduct.category || 'Varios')})</span>
            </div>
            <div class="info-item">
              <span class="info-label">TIPO</span>
              <span class="info-value">${esc(selectedKardexProduct.unit || 'Producto')}</span>
            </div>
            <div class="info-item">
              <span class="info-label">STOCK ACTUAL</span>
              <span class="info-value" style="color: #0086F0;">${esc(selectedKardexProduct.stock)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Oper.</th>
                <th>Referencia</th>
                <th>Motivo</th>
                <th>Lote</th>
                <th>Vence</th>
                <th class="text-center">Ing.</th>
                <th class="text-center">Sal.</th>
                <th class="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${productKardexHistory.map(h => {
                let badgeClass = 'badge-ajuste';
                if (h.motivo === 'Inicial') badgeClass = 'badge-inicial';
                if (h.motivo === 'Venta') badgeClass = 'badge-venta';
                if (h.motivo === 'Compra') badgeClass = 'badge-compra';

                return `
                  <tr>
                    <td style="color: #64748b; font-family: monospace;">${new Date(h.date).toLocaleDateString()}, ${new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${esc(h.user)}</td>
                    <td>${esc(h.operation)}</td>
                    <td><strong>${esc(h.concept)}</strong></td>
                    <td><span class="${esc(badgeClass)}">${esc(h.motivo)}</span></td>
                    <td>${esc(h.lote)}</td>
                    <td>${h.vence ? new Date(h.vence).toLocaleDateString() : '-'}</td>
                    <td class="text-center entrada">${h.type === 'entrada' || h.type === 'inicial' ? h.quantity : ''}</td>
                    <td class="text-center salida">${h.type === 'salida' ? h.quantity : ''}</td>
                    <td class="text-right" style="font-weight: bold;">${esc(h.balance)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportPDF = () => {
    // Both trigger browser print view which supports native PDF saving beautifully
    handlePrintKardex();
  };

  const handleOpenProductKardex = (p: Product) => {
    setSelectedKardexProduct(p);
    setIsProductKardexOpen(true);
    setNewAdjustmentQty('');
    setNewAdjustmentReason('Ajuste de inventario');
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKardexProduct || !newAdjustmentQty) return;

    const qty = parseInt(newAdjustmentQty);
    if (isNaN(qty) || qty <= 0) {
      alert('La cantidad debe ser un número entero mayor a cero.');
      return;
    }

    const currentStock = getProductStock(selectedKardexProduct);
    if (newAdjustmentType === 'salida' && qty > currentStock) {
      alert('No puedes retirar más de lo que hay en stock actual.');
      return;
    }

    // Stock y kardex en una sola operación (stockMovements, tipo "ajuste").
    try {
      const { product: saved } = await api.executeStockAdjustment({
        product: selectedKardexProduct,
        delta: newAdjustmentType === 'entrada' ? qty : -qty,
        reason: newAdjustmentReason || 'Ajuste de inventario',
        operatorName: user?.name
      });
      setSelectedKardexProduct(saved);
      setNewAdjustmentQty('');
      setNewAdjustmentReason('Ajuste de inventario');
      setKardexReloadKey(k => k + 1);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar el ajuste de stock');
    }
  };

  // Combos, servicios y promociones: guardados en la configuración de la
  // empresa en Firestore (antes solo en este navegador y con datos de ejemplo).
  const [combos, setCombos] = useConfigList<Combo>(config, 'combos', 'inventory_combos');
  const [services, setServices] = useConfigList<Service>(config, 'services', 'inventory_services');
  const [promos, setPromos] = useConfigList<Promo>(config, 'promos', 'inventory_promos');

  // Barcode search simulator state
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<Product | null>(null);

  // Barcode printer state variables
  const [selectedLabels, setSelectedLabels] = useState<Array<{ product: Product, quantity: number }>>([]);
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({});
  const [selectedLabelSize, setSelectedLabelSize] = useState<'A4_3x8' | 'A4_4x10' | 'A4_5x11' | 'thermal'>('A4_3x8');
  const [showLabelName, setShowLabelName] = useState(true);
  const [showLabelPrice, setShowLabelPrice] = useState(true);
  const [showLabelDescription, setShowLabelDescription] = useState(false);
  const [showLabelSku, setShowLabelSku] = useState(true);

  // Form states for adding new Combo/Service/Promo
  const [newComboName, setNewComboName] = useState('');
  const [newComboProducts, setNewComboProducts] = useState('');
  const [newComboPrice, setNewComboPrice] = useState('');
  const [newComboCost, setNewComboCost] = useState('');

  // States for dynamic components inside Combo (exact match to user image)
  interface ComboComponent {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    cost: number;
  }
  const [newComboComponents, setNewComboComponents] = useState<ComboComponent[]>([]);
  const [selectedComponentProductId, setSelectedComponentProductId] = useState('');
  const [selectedComponentQuantity, setSelectedComponentQuantity] = useState('');

  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('General');
  const [newServiceIcon, setNewServiceIcon] = useState('Wrench');
  const [newServiceDescription, setNewServiceDescription] = useState('');

  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoName, setNewPromoName] = useState('');
  const [newPromoValue, setNewPromoValue] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'fixed' | 'special'>('percentage');
  const [newPromoExpiration, setNewPromoExpiration] = useState('');

  // Master lists from localStorage or Firebase config (configured in Settings)
  const categoriesList = useMemo(() => {
    if (config.categories && config.categories.length > 0) {
      return config.categories;
    }
    if (config.businessType === 'pharmacy') {
      return ['Medicamentos', 'Cuidado Personal', 'Dispositivos Médicos', 'Suplementos', 'Fórmulas', 'Perfumería', 'General / Otros'];
    } else if (config.businessType === 'bookstore') {
      return ['Útiles Escolares', 'Oficina', 'Cuadernos', 'Libros', 'Papelería', 'Arte/Dibujo', 'General / Otros'];
    } else if (config.businessType === 'hardware') {
      return ['Herramientas', 'Tornillería', 'Pinturas', 'Plomería', 'Electricidad', 'Seguridad', 'Construcción', 'General / Otros'];
    } else {
      return ['Abarrotes', 'Bebidas', 'Snacks', 'Limpieza', 'Lácteos', 'General', 'Otros'];
    }
  }, [config.categories, config.businessType]);

  const unitsList = useMemo(() => {
    if (config.units && config.units.length > 0) {
      return config.units;
    }
    if (config.businessType === 'pharmacy') {
      return ['UNIDAD', 'CAJA', 'BLISTER', 'FRASCO', 'TABLETA', 'AMPOLLA', 'SOBRE'];
    } else if (config.businessType === 'bookstore') {
      return ['Pza', 'Docena', 'Millar', 'Caja', 'Pliego', 'Paquete'];
    } else if (config.businessType === 'hardware') {
      return ['Pza', 'Kg', 'Metro', 'Litro', 'Par', 'Caja'];
    } else {
      return ['Pza', 'Kg', 'Litro', 'Caja', 'Paquete', 'Bolsa'];
    }
  }, [config.units, config.businessType]);

  // Auto categories from active products
  const categories = useMemo(() => {
    const list = products.map(p => p.category).filter(Boolean);
    const unique = Array.from(new Set(list));
    return ['Todas', ...unique];
  }, [products]);

  // Handle open modal for ADD
  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCode('');
    setFormCategory(categoriesList[0] || 'General');
    setFormPrice('');
    setFormCost('');
    setFormStock('');
    setFormMinStock('5');
    setFormUnit(unitsList[0] || 'Pza');
    setFormExpirationDate('');
    setFormLocation('');
    setFormDetail('');
    setFormImageUrl('');
    
    // Reset pharmacy fields
    setFormRegistrationDate(new Date().toISOString().split('T')[0]);
    setFormBarcode('');
    setFormPharmacyType('Genérico');
    setFormPrescriptionRequired('sin receta médica');
    setFormSanitaryRegister('');
    setFormDiscount('0');
    setFormUnitsPerBox('');
    setFormUnitsPerBlister('');
    setFormMarginPercent('');
    setFormPricePerUnit('');
    setFormPricePerBlister('0');
    setFormPricePerBox('0');
    setFormLaboratory('Bayer');
    setFormSymptoms('');
    setFormStatus('Activo');
    setFormManageBatchAndExpiration(true);
    setFormExpirationAlertDays('');
    setFormInitialBatch('00101');
    setFormExpirationRows([
      { date: '', stock: '', batch: '00101' }
    ]);
    
    setIsModalOpen(true);
  };

  // Handle open modal for EDIT
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCode(p.code);
    setFormCategory(p.category);
    setFormPrice(p.price.toString());
    setFormCost(p.cost.toString());
    const effStock = getProductStock(p);
    setFormStock(effStock.toString());
    setFormMinStock(p.minStock.toString());
    setFormUnit(p.unit || 'Pza');
    setFormExpirationDate(p.expirationDate || '');
    setFormLocation(p.location || 'Almacén Principal');
    setFormDetail(p.detail || '');
    setFormImageUrl(p.imageUrl || '');

    // Populate pharmacy fields (or defaults if they don't exist on older products)
    setFormRegistrationDate(p.registrationDate || new Date().toISOString().split('T')[0]);
    setFormBarcode(p.barcode || '');
    setFormPharmacyType(p.pharmacyType || 'Genérico');
    setFormPrescriptionRequired(p.prescriptionRequired || 'sin receta médica');
    setFormSanitaryRegister(p.sanitaryRegister || '');
    setFormDiscount((p.discount ?? 0).toString());
    setFormUnitsPerBox((p.unitsPerBox ?? 100).toString());
    setFormUnitsPerBlister((p.unitsPerBlister ?? 10).toString());
    setFormMarginPercent((p.marginPercent ?? '').toString());
    setFormPricePerUnit((p.pricePerUnit ?? p.price ?? '').toString());
    setFormPricePerBlister((p.pricePerBlister ?? 0).toString());
    setFormPricePerBox((p.pricePerBox ?? 0).toString());
    setFormLaboratory(p.laboratory || 'Bayer');
    setFormSymptoms(p.symptoms || '');
    setFormStatus(p.status || 'Activo');
    setFormManageBatchAndExpiration(p.manageBatchAndExpiration ?? (config.businessType === 'pharmacy'));
    setFormExpirationAlertDays((p.expirationAlertDays ?? 15).toString());
    setFormInitialBatch(p.initialBatch || '00101');

    const validRows = (p.expirationDates || []).filter(r => (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)) > 0);
    if (validRows.length > 0) {
      const mappedRows = validRows.map(r => ({
        date: r.date,
        stock: r.stock.toString(),
        batch: r.batch || ''
      }));
      const rowsSum = mappedRows.reduce((acc, r) => acc + (parseInt(r.stock) || 0), 0);
      if (effStock > rowsSum && mappedRows.length > 0) {
        mappedRows[0].stock = ((parseInt(mappedRows[0].stock) || 0) + (effStock - rowsSum)).toString();
      }
      setFormExpirationRows(mappedRows);
    } else {
      setFormExpirationRows([
        { date: p.expirationDate || '', stock: effStock.toString(), batch: p.initialBatch || '00101' }
      ]);
    }

    setIsModalOpen(true);
  };

  // Submit Product Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const actualPrice = config.businessType === 'pharmacy' ? (formPricePerUnit || formPrice) : formPrice;
    
    if (!formName || !formCode || actualPrice === '' || formCost === '' || formStock === '') {
      alert('Por favor complete todos los campos obligatorios.');
      return;
    }

    const priceNum = parseFloat(actualPrice);
    const costNum = parseFloat(formCost);
    const stockNum = parseInt(formStock, 10);
    const minStockNum = parseInt(formMinStock, 10) || 0;

    if (isNaN(priceNum) || isNaN(costNum) || isNaN(stockNum)) {
      alert('Valores de precio, costo y stock deben ser numéricos.');
      return;
    }

    let finalImageUrl = formImageUrl || undefined;
    if (finalImageUrl && finalImageUrl.startsWith('data:image/') && finalImageUrl.length > 100000) {
      try {
        finalImageUrl = await compressDataUrlIfNeeded(finalImageUrl, 600, 0.75);
      } catch (e) {
        console.warn("Could not compress formImageUrl:", e);
      }
    }

    const useBatchManagement = config.businessType === 'pharmacy'
      ? formManageBatchAndExpiration
      : Boolean(editingProduct?.manageBatchAndExpiration && editingProduct?.expirationDates && editingProduct.expirationDates.length > 0);

    let preparedRows = [...formExpirationRows];
    if (useBatchManagement) {
      if (preparedRows.length === 0) {
        preparedRows = [{ date: formExpirationDate || '', stock: stockNum.toString(), batch: formInitialBatch || '00101' }];
      } else if (preparedRows.length === 1) {
        preparedRows[0] = {
          ...preparedRows[0],
          stock: stockNum.toString(),
          batch: preparedRows[0].batch || formInitialBatch || '00101',
          date: preparedRows[0].date || formExpirationDate || ''
        };
      } else {
        const lotesSum = preparedRows.reduce((acc, r) => acc + (parseInt(r.stock, 10) || 0), 0);
        if (lotesSum === 0 && stockNum > 0) {
          preparedRows[0] = { ...preparedRows[0], stock: stockNum.toString() };
        } else if (stockNum !== lotesSum) {
          if (config.businessType !== 'pharmacy') {
            // In standard mode, the single Stock input is authoritative; scale/adjust rows to match stockNum
            let rem = stockNum;
            preparedRows = preparedRows.map((r, idx) => {
              if (idx === preparedRows.length - 1) {
                return { ...r, stock: Math.max(0, rem).toString() };
              }
              const s = Math.min(rem, parseInt(r.stock, 10) || 0);
              rem = Math.max(0, rem - s);
              return { ...r, stock: s.toString() };
            });
          } else if (stockNum > 0) {
            const diff = stockNum - lotesSum;
            const currentFirstStock = parseInt(preparedRows[0].stock, 10) || 0;
            preparedRows[0] = { ...preparedRows[0], stock: Math.max(0, currentFirstStock + diff).toString() };
          }
        }
      }
    }

    const validPreparedRows = useBatchManagement 
      ? preparedRows.filter(r => (parseInt(r.stock, 10) || 0) > 0)
      : [];

    const computedStock = (config.businessType === 'pharmacy' && useBatchManagement && validPreparedRows.length > 0)
      ? validPreparedRows.reduce((acc, r) => acc + (parseInt(r.stock, 10) || 0), 0)
      : stockNum;

    const productData: Product = {
      ...(editingProduct || {}),
      id: editingProduct?.id || '', 
      name: formName,
      code: formCode,
      category: formCategory || 'General',
      price: priceNum,
      cost: costNum,
      stock: computedStock,
      minStock: minStockNum,
      unit: formUnit || 'Pza',
      expirationDate: useBatchManagement && validPreparedRows.length > 0 
        ? (validPreparedRows.find(r => r.date)?.date || formExpirationDate || undefined) 
        : (formExpirationDate || undefined),
      location: formLocation || 'Almacén Principal',
      detail: formDetail || '',
      imageUrl: finalImageUrl,
      branch: editingProduct?.branch || activeBranchName || undefined,
      
      // Pharmacy fields
      registrationDate: formRegistrationDate,
      barcode: formBarcode || formCode,
      pharmacyType: formPharmacyType,
      prescriptionRequired: formPrescriptionRequired,
      sanitaryRegister: formSanitaryRegister,
      discount: parseFloat(formDiscount) || 0,
      unitsPerBox: parseInt(formUnitsPerBox, 10) || 0,
      unitsPerBlister: isBlisterHidden ? 0 : (parseInt(formUnitsPerBlister, 10) || 0),
      marginPercent: parseFloat(formMarginPercent) || 0,
      pricePerUnit: parseFloat(formPricePerUnit) || priceNum,
      pricePerBlister: isBlisterHidden ? 0 : (parseFloat(formPricePerBlister) || 0),
      pricePerBox: parseFloat(formPricePerBox) || 0,
      laboratory: formLaboratory,
      symptoms: formSymptoms,
      status: formStatus,
      manageBatchAndExpiration: useBatchManagement,
      expirationAlertDays: parseInt(formExpirationAlertDays, 10) || 0,
      initialBatch: useBatchManagement && validPreparedRows.length > 0
        ? (validPreparedRows.find(r => r.batch)?.batch || formInitialBatch || '00101')
        : formInitialBatch,
      expirationDates: useBatchManagement && validPreparedRows.length > 0
        ? validPreparedRows.map(r => ({
            date: r.date,
            stock: parseInt(r.stock, 10) || 0,
            batch: r.batch || formInitialBatch || '00101'
          }))
        : []
    };

    try {
      const savedProd = await onSaveProduct(productData);
      if (detailProduct && detailProduct.id === savedProd.id) {
        setDetailProduct(savedProd);
      }
      setIsModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar el producto');
    }
  };

  // Delete product
  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este producto del inventario? Esta acción no se puede deshacer.')) {
      try {
        await onDeleteProduct(id);
        onRefreshData();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar el producto');
      }
    }
  };

  // Manual Stock Modal State (matches user screenshot)
  const [isManualStockModalOpen, setIsManualStockModalOpen] = useState(false);
  const [manualStockProduct, setManualStockProduct] = useState<Product | null>(null);
  const [manualStockQty, setManualStockQty] = useState('');
  const [manualStockReason, setManualStockReason] = useState('');
  const [manualStockLocation, setManualStockLocation] = useState('Almacén Principal');

  // Open "Aumentar Stock Manual" modal
  const handleOpenManualStockModal = (product: Product) => {
    setManualStockProduct(product);
    setManualStockQty('');
    setManualStockReason('');
    setManualStockLocation(product.location || 'Almacén Principal');
    setIsManualStockModalOpen(true);
  };

  // Confirm manual stock increase
  const handleConfirmManualStock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualStockProduct) return;

    const qty = parseInt(manualStockQty) || 0;
    if (qty <= 0) {
      alert('Por favor ingrese una cantidad mayor a 0 para agregar al stock.');
      return;
    }

    try {
      await api.executeStockAdjustment({
        product: manualStockProduct,
        delta: qty,
        reason: manualStockReason.trim() || 'Aumento manual de stock',
        operatorName: user?.name,
        extraFields: { location: manualStockLocation || manualStockProduct.location || 'Almacén Principal' }
      });
      setIsManualStockModalOpen(false);
      setManualStockProduct(null);
      setKardexReloadKey(k => k + 1);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar el stock');
    }
  };

  // Dynamic calculations for metric cards
  const stats = useMemo(() => {
    let totalItems = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let expiringAlerts = 0;

    products.forEach(p => {
      const effStock = getProductStock(p);
      totalItems += effStock;
      if (effStock === 0) {
        outOfStock++;
      } else if (effStock <= p.minStock) {
        lowStock++;
      }

      if (p.expirationDate) {
        const expDate = new Date(p.expirationDate);
        const today = new Date();
        const diffTime = expDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= (config.alertDaysBeforeExpiration || 15)) {
          expiringAlerts++;
        }
      }
    });

    return { totalItems, lowStock, outOfStock, expiringAlerts };
  }, [products, config]);

  // Filter products logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const effStock = getProductStock(p);
      // Name, category, barcode & code search
      const q = searchQuery.toLowerCase().trim();
      const pCodes = getProductCodes(p);
      const matchesSearch = !q || 
                            p.name.toLowerCase().includes(q) || 
                            p.category.toLowerCase().includes(q) ||
                            pCodes.some(codeVal => codeVal.toLowerCase().includes(q));
      
      // Code / Barcode filter
      const c = codeFilter.toLowerCase().trim();
      const matchesCode = !c || pCodes.some(codeVal => codeVal.toLowerCase().includes(c));

      // Location filter
      const matchesLocation = !locationFilter || (p.location || 'Almacén Principal').toLowerCase().includes(locationFilter.toLowerCase());

      // Category filter dropdown
      const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;

      // Metric filter
      let matchesStock = true;
      if (stockFilter === 'critical') {
        matchesStock = effStock <= p.minStock && effStock > 0;
      } else if (stockFilter === 'outOfStock') {
        matchesStock = effStock === 0;
      } else if (stockFilter === 'expiring') {
        matchesStock = !!p.expirationDate;
      }

      return matchesSearch && matchesCode && matchesLocation && matchesCategory && matchesStock;
    });
  }, [products, searchQuery, codeFilter, locationFilter, selectedCategory, stockFilter]);

  // Reset all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setCodeFilter('');
    setLocationFilter('');
    setSelectedCategory('Todas');
    setStockFilter('all');
  };

  // CSV Template download helper
  const downloadTemplate = () => {
    const headers = 'Código,Nombre,Categoría,Costo,Precio,Stock,Stock Mínimo,Unidad,Ubicación,Detalles\n';
    const sample = 'DEMO-P001,Whisky Black Label 750ml,Bebidas,220.00,299.99,51,5,Pza,Almacén Principal,Importado original de Escocia\n';
    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_inventario.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Excel Import logic
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      let count = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple CSV splitter, keeping quotes in mind or just simple split
        const columns = line.split(',');
        if (columns.length >= 6) {
          const code = columns[0]?.trim();
          const name = columns[1]?.trim();
          const category = columns[2]?.trim() || 'General';
          const cost = parseFloat(columns[3]) || 0;
          const price = parseFloat(columns[4]) || 0;
          const stock = parseInt(columns[5]) || 0;
          const minStock = parseInt(columns[6]) || 5;
          const unit = columns[7]?.trim() || 'Pza';
          const location = columns[8]?.trim() || 'Almacén Principal';
          const detail = columns[9]?.trim() || '';

          if (code && name) {
            const prod: Product = {
              id: '',
              name,
              code,
              category,
              cost,
              price,
              stock,
              minStock,
              unit,
              location,
              detail
            };
            try {
              await onSaveProduct(prod);
              count++;
            } catch (err) {
              console.error('Error importing:', err);
            }
          }
        }
      }
      onRefreshData();
      alert(`Importación completada: Se registraron ${count} productos correctamente.`);
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Barcode scanning simulator
  useEffect(() => {
    if (!barcodeSearch) {
      setBarcodeResult(null);
      return;
    }
    const { exactMatches, partialMatches } = matchProductsByCode(products, barcodeSearch);
    setBarcodeResult(exactMatches[0] || partialMatches[0] || null);
  }, [barcodeSearch, products]);

  // Special items creation handlers
  const handleAddComboComponent = () => {
    if (!selectedComponentProductId) return;
    const qty = parseFloat(selectedComponentQuantity) || 1;
    if (qty <= 0) return;
    
    const prod = products.find(p => p.id === selectedComponentProductId);
    if (!prod) return;

    const existingIndex = newComboComponents.findIndex(c => c.productId === prod.id);
    if (existingIndex > -1) {
      const updated = [...newComboComponents];
      updated[existingIndex].quantity += qty;
      setNewComboComponents(updated);
    } else {
      setNewComboComponents([
        ...newComboComponents,
        {
          productId: prod.id,
          name: prod.name,
          quantity: qty,
          price: prod.price,
          cost: prod.cost
        }
      ]);
    }

    setSelectedComponentProductId('');
    setSelectedComponentQuantity('');
  };

  const handleRemoveComboComponent = (productId: string) => {
    setNewComboComponents(newComboComponents.filter(c => c.productId !== productId));
  };

  const handleAddCombo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComboName) {
      alert('Por favor ingrese el nombre del combo.');
      return;
    }
    if (newComboComponents.length === 0) {
      alert('Por favor agregue al menos un producto componente al combo.');
      return;
    }

    const compiledProducts = newComboComponents
      .map(c => `${c.quantity}x ${c.name}`)
      .join(', ');

    const calculatedCost = newComboComponents.reduce((acc, c) => acc + (c.cost * c.quantity), 0);
    const calculatedPrice = newComboComponents.reduce((acc, c) => acc + (c.price * c.quantity), 0);

    const c: Combo = {
      id: 'combo-' + Date.now(),
      name: newComboName,
      products: compiledProducts,
      price: calculatedPrice,
      cost: calculatedCost,
      status: 'Activo'
    };

    setCombos([...combos, c]);
    
    // Reset form states
    setNewComboName('');
    setNewComboComponents([]);
    setSelectedComponentProductId('');
    setSelectedComponentQuantity('');
    setIsComboModalOpen(false);
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !newServicePrice) {
      alert('Complete los campos obligatorios');
      return;
    }
    const s: Service = {
      id: 'service-' + Date.now(),
      name: newServiceName,
      price: parseFloat(newServicePrice) || 0,
      category: newServiceCategory,
      icon: newServiceIcon,
      description: newServiceDescription
    };
    setServices([...services, s]);
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceCategory('General');
    setNewServiceIcon('Wrench');
    setNewServiceDescription('');
    setIsServiceModalOpen(false);
  };

  const handleAddPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoName || !newPromoValue) {
      alert('Complete los campos obligatorios');
      return;
    }
    const p: Promo = {
      id: 'promo-' + Date.now(),
      code: newPromoCode.toUpperCase(),
      name: newPromoName,
      value: newPromoValue,
      type: newPromoType,
      status: 'Activo',
      expiration: newPromoExpiration || '2026-12-31'
    };
    setPromos([...promos, p]);
    setNewPromoCode('');
    setNewPromoName('');
    setNewPromoValue('');
    setNewPromoType('percentage');
    setNewPromoExpiration('');
    setIsPromoModalOpen(false);
  };

  const handlePrintLabels = () => {
    if (selectedLabels.length === 0) {
      alert('Por favor, agregue al menos un producto para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('No se pudo abrir la ventana de impresión. Por favor, permita las ventanas emergentes.');
      return;
    }

    const flatLabels = selectedLabels.flatMap(item => 
      Array(item.quantity).fill(item.product)
    );

    let gridStyle = '';
    let labelHeight = '';
    if (selectedLabelSize === 'A4_3x8') {
      gridStyle = 'grid-template-columns: repeat(3, 1fr); grid-auto-rows: 34mm;';
      labelHeight = 'height: 34mm;';
    } else if (selectedLabelSize === 'A4_4x10') {
      gridStyle = 'grid-template-columns: repeat(4, 1fr); grid-auto-rows: 27mm;';
      labelHeight = 'height: 27mm;';
    } else if (selectedLabelSize === 'A4_5x11') {
      gridStyle = 'grid-template-columns: repeat(5, 1fr); grid-auto-rows: 24mm;';
      labelHeight = 'height: 24mm;';
    } else {
      gridStyle = 'grid-template-columns: 1fr; grid-auto-rows: auto;';
      labelHeight = 'height: auto; page-break-after: always; margin-bottom: 5mm;';
    }

    const generateBarcodeHTML = (code: string) => {
      let hash = 0;
      for (let i = 0; i < code.length; i++) {
        hash = (hash << 5) - hash + code.charCodeAt(i);
        hash |= 0;
      }
      const binary = Math.abs(hash).toString(2).padStart(20, '1010') + "11010101011";
      let rects = '';
      let x = 10;
      for (let i = 0; i < 45; i++) {
        const isWide = binary[i % binary.length] === '1';
        const width = isWide ? 2.2 : 0.8;
        rects += `<rect x="${x}" y="2" width="${width}" height="32" fill="black" />`;
        x += width + (i % 3 === 0 ? 1.6 : 0.8);
      }
      return `<svg viewBox="0 0 ${x + 10} 36" style="width: 100%; height: 11mm;" preserveAspectRatio="none">${rects}</svg>`;
    };

    const labelsHTML = flatLabels.map(p => {
      return `
        <div class="label-card" style="${labelHeight}">
          ${showLabelSku ? `
            <div class="barcode-container">
              ${generateBarcodeHTML(p.code)}
            </div>
          ` : ''}
          ${showLabelName ? `<div class="product-name">${esc(p.name)}</div>` : ''}
          ${showLabelPrice ? `<div class="product-price">${esc(currency)} ${p.price.toFixed(2)}</div>` : ''}
          ${showLabelDescription ? `<div class="product-desc">${esc(p.detail || '')}</div>` : ''}
          ${showLabelSku ? `
            <div class="sku-row">
              <span class="sku-cat">${esc(p.category || 'General')}</span>
              <span class="sku-code">${esc(p.code)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Etiquetas de Códigos de Barra</title>
          <style>
            @page {
              size: A4 portrait;
              margin: ${selectedLabelSize === 'thermal' ? '5mm' : '10mm'};
            }
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: white;
              color: black;
            }
            .grid-container {
              display: grid;
              gap: 2mm;
              width: 100%;
              box-sizing: border-box;
              ${gridStyle}
            }
            .label-card {
              border: 1px dashed #ddd;
              padding: 2.5mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              box-sizing: border-box;
              overflow: hidden;
              background: white;
            }
            .product-name {
              font-size: 8.5pt;
              font-weight: bold;
              margin: 1mm 0 0.5mm 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
            }
            .product-price {
              font-size: 11.5pt;
              font-weight: 900;
              margin: 0.3mm 0;
            }
            .product-desc {
              font-size: 7pt;
              color: #555;
              margin: 0.3mm 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
            }
            .barcode-container {
              width: 90%;
              height: 11mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .sku-row {
              display: flex;
              justify-content: center;
              gap: 2mm;
              font-size: 7.5pt;
              color: #333;
              margin-top: 0.5mm;
              font-family: monospace;
            }
            .sku-cat {
              font-weight: bold;
            }
            @media print {
              .label-card {
                border: ${selectedLabelSize === 'thermal' ? 'none' : '1px solid #aaa'};
              }
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${labelsHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Calculated totals for Kardex Valorado
  const kardexSummary = useMemo(() => {
    let totalInversion = 0;
    let valorVentaTotal = 0;
    let productsCount = products.length;

    products.forEach(p => {
      const effStock = getProductStock(p);
      totalInversion += effStock * p.cost;
      valorVentaTotal += effStock * p.price;
    });

    const gananciaEstimada = valorVentaTotal - totalInversion;
    const margenPromedio = totalInversion > 0 ? (gananciaEstimada / valorVentaTotal) * 100 : 0;

    return { totalInversion, valorVentaTotal, productsCount, gananciaEstimada, margenPromedio };
  }, [products]);

  return (
    <div id="inventory-view" className="space-y-6">
      
      {/* 1. Header with custom layout */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-[#2563EB]" /> Inventario
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">Monitorea y administra las existencias de tus productos en tiempo real</p>
        </div>

        {/* Action Buttons styled like professional SaaS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Transfer Stock Button (Visible when account has 2 or more branches) */}
          {hasMultipleBranches && (
            <button
              type="button"
              onClick={() => {
                setTransferErrorMessage(null);
                setTransferSuccessMessage(null);
                setIsTransferModalOpen(true);
              }}
              className="bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#1F2937] px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 text-xs shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
              title="Transferir existencias entre sucursales"
            >
              <ArrowRightLeft className="w-4 h-4 text-[#2563EB]" /> Transferir Stock
            </button>
          )}

          {/* Add Product Button (Primary Action) */}
          <button
            onClick={openAddModal}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Agregar Producto
          </button>

          {/* Download Template Button */}
          <button
            onClick={downloadTemplate}
            className="border border-[#E2E8F0] text-[#1F2937] hover:bg-slate-50 bg-white px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 text-xs shadow-2xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" /> Descargar Plantilla
          </button>

          {/* Upload Excel Button */}
          <label className="border border-[#E2E8F0] text-[#1F2937] hover:bg-slate-50 bg-white px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 text-xs shadow-2xs transition-all cursor-pointer">
            <FileUp className="w-4 h-4 text-[#2563EB]" /> Cargar Excel
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleExcelImport} 
              className="hidden" 
            />
          </label>

          {/* Kardex Valorado Button */}
          <button
            onClick={() => setIsKardexOpen(true)}
            className="text-[#1F2937] hover:bg-slate-50 px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 text-xs transition-all cursor-pointer border border-[#E2E8F0] bg-white shadow-2xs"
          >
            <FileText className="w-4 h-4 text-slate-500" /> Kardex Valorado General
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs styled with modern aesthetics */}
      <div className="flex overflow-x-auto pb-1 gap-1.5 border-b border-[#E2E8F0] scrollbar-none">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'stock' 
              ? 'bg-[#2563EB] text-white shadow-xs' 
              : 'bg-white text-[#64748B] hover:text-[#1F2937] hover:bg-slate-50 border border-[#E2E8F0]'
          }`}
        >
          <Package className="w-4 h-4" /> Stock
        </button>

        <button
          onClick={() => setActiveTab('combos')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'combos' 
              ? 'bg-[#2563EB] text-white shadow-xs' 
              : 'bg-white text-[#64748B] hover:text-[#1F2937] hover:bg-slate-50 border border-[#E2E8F0]'
          }`}
        >
          <Boxes className="w-4 h-4" /> Combos
        </button>

        <button
          onClick={() => setActiveTab('servicios')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'servicios' 
              ? 'bg-[#2563EB] text-white shadow-xs' 
              : 'bg-white text-[#64748B] hover:text-[#1F2937] hover:bg-slate-50 border border-[#E2E8F0]'
          }`}
        >
          <Wrench className="w-4 h-4" /> Servicios
        </button>

        <button
          onClick={() => setActiveTab('promociones')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'promociones' 
              ? 'bg-[#2563EB] text-white shadow-xs' 
              : 'bg-white text-[#64748B] hover:text-[#1F2937] hover:bg-slate-50 border border-[#E2E8F0]'
          }`}
        >
          <Tag className="w-4 h-4" /> Promociones
        </button>

        <button
          onClick={() => setActiveTab('barcodes')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'barcodes' 
              ? 'bg-[#2563EB] text-white shadow-xs' 
              : 'bg-white text-[#64748B] hover:text-[#1F2937] hover:bg-slate-50 border border-[#E2E8F0]'
          }`}
        >
          <Barcode className="w-4 h-4" /> Código de Barras
        </button>
      </div>

      {/* 3. Render content depending on selected tab */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          
          {/* Metric Cards Grid with click-to-filter capability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Stock Total */}
            <div 
              onClick={() => setStockFilter('all')}
              className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                stockFilter === 'all' 
                  ? 'bg-blue-50/60 border-[#2563EB] shadow-xs' 
                  : 'bg-white border-[#E2E8F0] hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-50 text-[#2563EB]">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-[#1F2937]">Stock Total</span>
                  <span className="block text-[11px] text-[#64748B]">En inventario</span>
                </div>
              </div>
              <span className="text-xl font-bold text-[#1F2937] font-mono">{stats.totalItems}</span>
            </div>

            {/* Card 2: Low Stock */}
            <div 
              onClick={() => setStockFilter('critical')}
              className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                stockFilter === 'critical' 
                  ? 'bg-amber-50/60 border-amber-400 shadow-xs' 
                  : 'bg-white border-[#E2E8F0] hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-[#1F2937]">Alertas Bajas</span>
                  <span className="block text-[11px] text-[#64748B]">Bajo mínimo</span>
                </div>
              </div>
              <span className="text-xl font-bold text-[#1F2937] font-mono">{stats.lowStock}</span>
            </div>

            {/* Card 3: Out of Stock */}
            <div 
              onClick={() => setStockFilter('outOfStock')}
              className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                stockFilter === 'outOfStock' 
                  ? 'bg-rose-50/60 border-rose-400 shadow-xs' 
                  : 'bg-white border-[#E2E8F0] hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-rose-50 text-[#DC2626]">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-[#1F2937]">Stock Agotado</span>
                  <span className="block text-[11px] text-[#64748B]">Sin existencias</span>
                </div>
              </div>
              <span className="text-xl font-bold text-[#1F2937] font-mono">{stats.outOfStock}</span>
            </div>

            {/* Card 4: Expirations */}
            <div 
              onClick={() => setStockFilter('expiring')}
              className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                stockFilter === 'expiring' 
                  ? 'bg-purple-50/60 border-purple-400 shadow-xs' 
                  : 'bg-white border-[#E2E8F0] hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-[#1F2937]">Vencimientos</span>
                  <span className="block text-[11px] text-[#64748B]">Alertas por lote</span>
                </div>
              </div>
              <span className="text-xl font-bold text-[#1F2937] font-mono">{stats.expiringAlerts}</span>
            </div>

          </div>

          {/* Inventory Barcode Scan Result Feedback Banner */}
          {inventoryScanFeedback && (
            <div className={`w-full p-2.5 sm:p-3 rounded-lg border text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200 ${
              inventoryScanFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {inventoryScanFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate">{inventoryScanFeedback.message}</p>
                  {inventoryScanFeedback.sub && (
                    <p className="text-[11px] opacity-90 truncate">{inventoryScanFeedback.sub}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInventoryScanFeedback(null)}
                className="text-slate-400 hover:text-slate-600 p-1 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4. Filters Panel matching professional SaaS layout */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-2xs p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
            
            {/* Input 1: Search text with Mobile Scan Button */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar por producto o código de barras..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const q = searchQuery.trim();
                      if (q) handlePhysicalScanInTable(q);
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white text-[#1F2937]"
                />
              </div>

              {/* Mobile Barcode Scanner Camera Button for Inventory */}
              <button
                type="button"
                onClick={() => startBarcodeScanner('inventory_search')}
                className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-xs shrink-0 transition-all cursor-pointer"
                title="Escanear código de barras con la cámara"
              >
                <Camera className="w-4 h-4" />
                <Barcode className="w-3.5 h-3.5 -ml-0.5" />
                <span className="text-[11px] font-semibold">Escanear</span>
              </button>
            </div>

            {/* Input 2: Barcode */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold text-xs">
                #
              </span>
              <input
                type="text"
                placeholder="Código..."
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const c = codeFilter.trim();
                    if (c) handlePhysicalScanInTable(c);
                  }
                }}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white text-[#1F2937] font-mono"
              />
            </div>

            {/* Input 3: Location */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <MapPin className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Ubicación..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white text-[#1F2937]"
              />
            </div>

            {/* Input 4: Dropdown selector */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-[#2563EB] bg-white text-[#1F2937] font-medium"
              >
                <option value="Todas">Tipo de productos (Todas)</option>
                {categories.filter(c => c !== 'Todas').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Input 5: Clear Filter Button */}
            <button
              onClick={handleClearFilters}
              className="w-full bg-slate-100 hover:bg-slate-200 border border-[#E2E8F0] text-[#1F2937] py-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
            >
              Limpiar Filtros
            </button>
          </div>

          {/* 5. Main Product List Table */}
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden">
            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center text-[#64748B] space-y-3">
                <PackageOpen className="w-10 h-10 text-slate-300" />
                <div>
                  <p className="text-sm font-semibold text-[#1F2937]">No se encontraron productos</p>
                  <p className="text-xs text-[#64748B] mt-0.5">Prueba cambiando los criterios de búsqueda o agrega un nuevo producto.</p>
                </div>
                <button
                  onClick={openAddModal}
                  className="text-xs bg-[#2563EB] text-white font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[#1D4ED8] transition-all mt-2 cursor-pointer"
                >
                  Registrar nuevo producto
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Card List (< sm screens) */}
                <div className="sm:hidden divide-y divide-[#E2E8F0]">
                  {filteredProducts.map((p) => {
                    const effStock = getProductStock(p);
                    const isCritical = effStock <= p.minStock && effStock > 0;
                    const isOutOfStock = effStock === 0;

                    let statusText = 'Normal';
                    let statusBadge = 'bg-emerald-50 text-[#16A34A] border-emerald-200';
                    if (isOutOfStock) {
                      statusText = 'Agotado';
                      statusBadge = 'bg-rose-50 text-[#DC2626] border-rose-200';
                    } else if (isCritical) {
                      statusText = 'Bajo';
                      statusBadge = 'bg-amber-50 text-amber-800 border-amber-200';
                    }

                    const nameInitials = p.name.slice(0, 2).toUpperCase();

                    return (
                      <div key={`mob-${p.id}`} className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden font-bold text-[#1F2937] text-xs shrink-0 shadow-2xs">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                nameInitials
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs text-[#1F2937] truncate">{p.name}</h4>
                              <p className="text-[10px] text-[#64748B] truncate">{p.category} • <span className="font-mono text-[#1F2937]">{p.code}</span></p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase border shrink-0 ${statusBadge}`}>
                            {statusText}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100/80">
                          <div className="flex items-center gap-2 text-[#64748B]">
                            <span>Stock: <strong className="font-mono text-xs text-[#1F2937] bg-slate-100 px-1.5 py-0.5 rounded border border-[#E2E8F0]">{effStock}</strong></span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{p.location || 'Almacén'}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setDetailProduct(p)}
                              className="px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-blue-50 rounded transition-colors"
                            >
                              Detalle
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenManualStockModal(p)}
                              className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors"
                              title="Aumentar Stock Manual"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenProductKardex(p)}
                              className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors"
                              title="Kardex"
                            >
                              <Folder className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 text-slate-500 hover:text-red-600 rounded-md border border-slate-200 hover:border-red-200 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (sm and above, unchanged) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Detalle</th>
                        <th className="py-3 px-4 text-center">Stock Total</th>
                        <th className="py-3 px-4">Ubicación</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {filteredProducts.map((p) => {
                        const effStock = getProductStock(p);
                        const isCritical = effStock <= p.minStock && effStock > 0;
                        const isOutOfStock = effStock === 0;

                        // Get status text and badge styling
                        let statusText = 'Normal';
                        let statusBadge = 'bg-emerald-50 text-[#16A34A] border-emerald-200'; // Green
                        if (isOutOfStock) {
                          statusText = 'Agotado';
                          statusBadge = 'bg-rose-50 text-[#DC2626] border-rose-200'; // Red
                        } else if (isCritical) {
                          statusText = 'Bajo';
                          statusBadge = 'bg-amber-50 text-amber-800 border-amber-200'; // Yellow/Amber
                        }

                        // Generate background or initials placeholder for mock image
                        const nameInitials = p.name.slice(0, 2).toUpperCase();

                        return (
                          <tr key={p.id} className="text-[#64748B] hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {/* Product Avatar */}
                                <div className="w-8 h-8 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center overflow-hidden font-bold text-[#1F2937] text-xs shrink-0 shadow-2xs">
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    nameInitials
                                  )}
                                </div>
                                <div>
                                  <div className="font-semibold text-[#1F2937] text-xs">{p.name}</div>
                                  <div className="text-[10px] text-[#64748B] mt-0.5">{p.category}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-[#1F2937] font-medium">{p.code}</td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => setDetailProduct(p)}
                                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-0.5 cursor-pointer"
                              >
                                Ver Detalle
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="bg-slate-100 text-[#1F2937] font-semibold font-mono text-xs px-2.5 py-0.5 rounded border border-[#E2E8F0] inline-block tabular-nums">
                                {effStock}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#1F2937] font-medium">{p.location || 'Almacén Principal'}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase inline-block border ${statusBadge}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Aumentar Stock Manual */}
                                <button
                                  onClick={() => handleOpenManualStockModal(p)}
                                  className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors cursor-pointer"
                                  title="Aumentar Stock Manual"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>

                                {/* Kardex del Producto */}
                                <button
                                  onClick={() => handleOpenProductKardex(p)}
                                  className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors cursor-pointer"
                                  title="Ver Kardex del Producto"
                                >
                                  <Folder className="w-3.5 h-3.5" />
                                </button>
                                
                                {/* Edit */}
                                <button
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-slate-100 rounded-md border border-[#E2E8F0] transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  className="p-1 text-slate-500 hover:text-red-600 rounded-md border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- Tab Panel: COMBOS --- */}
      {activeTab === 'combos' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-100 text-[#005e63] rounded-xl border border-slate-200/40">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  Combos y Paquetes de Productos
                </h2>
                <p className="text-xs text-slate-500 font-medium">Define combos y paquetes de productos</p>
              </div>
            </div>
            <button
              onClick={() => setIsComboModalOpen(true)}
              className="bg-[#005e63] hover:bg-[#004d52] text-white text-xs font-bold px-4.5 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
            >
              <Plus className="w-4 h-4" /> Nuevo Combo
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-2xs">
            <h3 className="font-extrabold text-slate-700 text-xs sm:text-sm tracking-wide">
              Combos y Paquetes de Productos
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/60 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-3 px-5 w-1/3">NOMBRE</th>
                    <th className="py-3 px-4 w-1/3">COMPONENTES</th>
                    <th className="py-3 px-4 text-center">PRECIO</th>
                    <th className="py-3 px-5 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {combos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        No hay combos registrados. Haga clic en "Nuevo Combo" para crear uno.
                      </td>
                    </tr>
                  ) : (
                    combos.map((c) => (
                      <tr key={c.id} className="text-slate-600 hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-800 text-[13px]">{c.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                              c.status === 'Activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-150'
                            }`}>
                              {c.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Costo: {currency}{c.cost.toFixed(2)} | Ganancia: {currency}{(c.price - c.cost).toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs text-slate-500 font-medium leading-relaxed block break-words max-w-xs sm:max-w-md">
                            {c.products}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="bg-teal-50/50 text-teal-700 font-black font-mono text-[12px] px-2.5 py-1 rounded-lg border border-teal-100/50">
                            {currency}{c.price.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => {
                                const updated = combos.map(combo => combo.id === c.id ? { ...combo, status: (combo.status === 'Activo' ? 'Inactivo' : 'Activo') as 'Activo' | 'Inactivo' } : combo);
                                setCombos(updated);
                              }}
                              className="text-[11px] font-extrabold text-[#005e63] hover:text-[#004d52] bg-teal-50/50 hover:bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100/40 transition-all cursor-pointer"
                            >
                              Alternar Estado
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('¿Eliminar este combo?')) {
                                  setCombos(combos.filter(item => item.id !== c.id));
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200/80 hover:border-red-150 transition-all cursor-pointer"
                              title="Eliminar combo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- Tab Panel: SERVICIOS --- */}
      {activeTab === 'servicios' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                <Wrench className="w-5 h-5 text-teal-600" /> Servicios y No Inventariados
              </h2>
              <p className="text-xs text-slate-500">Administra cargos adicionales, envíos, instalaciones o consultorías.</p>
            </div>
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="bg-[#005e63] hover:bg-[#004d52] text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar Servicio
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => {
              // Icon assignment
              let IconComp = Wrench;
              if (s.icon === 'Truck') IconComp = Truck;
              if (s.icon === 'Gift') IconComp = Gift;

              return (
                <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs flex gap-3 items-start relative">
                  <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-teal-600 shrink-0">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.category}</span>
                      <span className="text-sm font-bold text-teal-700 font-mono">{currency}{s.price.toFixed(2)}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-xs">{s.name}</h3>
                    <p className="text-slate-500 text-[11px] leading-relaxed">{s.description}</p>
                    
                    <div className="flex justify-end pt-2 border-t border-slate-50 mt-1">
                      <button
                        onClick={() => {
                          if (confirm('¿Eliminar este servicio?')) {
                            setServices(services.filter(item => item.id !== s.id));
                          }
                        }}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Tab Panel: PROMOCIONES --- */}
      {activeTab === 'promociones' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-5 h-5 text-teal-600" /> Cupones y Promociones
              </h2>
              <p className="text-xs text-slate-500">Configura cupones de descuento, porcentajes y campañas temporales.</p>
            </div>
            <button
              onClick={() => setIsPromoModalOpen(true)}
              className="bg-[#005e63] hover:bg-[#004d52] text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar Promoción
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promos.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex">
                <div className="bg-[#005e63] text-white p-4 flex flex-col justify-center items-center font-mono w-28 shrink-0 border-r border-dashed border-white/20">
                  <span className="text-xs text-teal-200 uppercase font-bold tracking-widest">Código</span>
                  <span className="text-sm font-bold mt-1 bg-white/10 px-1.5 py-0.5 rounded-sm">{p.code}</span>
                  <span className="text-xs text-yellow-300 font-extrabold mt-2">{p.value}</span>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 text-xs">{p.name}</h3>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase ${p.status === 'Activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-300" /> Expira: <span className="font-mono text-slate-500 font-semibold">{p.expiration}</span>
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-50 mt-2">
                    <button
                      onClick={() => {
                        const updated = promos.map(item => item.id === p.id ? { ...item, status: (item.status === 'Activo' ? 'Inactivo' : 'Activo') as 'Activo' | 'Inactivo' } : item);
                        setPromos(updated);
                      }}
                      className="text-[10px] font-bold text-[#005e63] hover:underline cursor-pointer"
                    >
                      Alternar estado
                    </button>
                    <span className="text-slate-200">|</span>
                    <button
                      onClick={() => {
                        setPromos(promos.filter(item => item.id !== p.id));
                      }}
                      className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Tab Panel: CODIGO DE BARRAS (Generador e Impresor de Etiquetas) --- */}
      {activeTab === 'barcodes' && (() => {
        // Filter products for barcode generator based on search input
        const filteredBarcodeProducts = products.filter(p => {
          if (!barcodeSearch) return true;
          const q = barcodeSearch.toLowerCase();
          return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
        });

        const previewProduct: Product = selectedLabels.length > 0 
          ? selectedLabels[0].product 
          : (products[0] || { id: 'sample', name: 'Aceite Primor 1L', code: '7770000000027', price: 21.75, category: 'D210-PRCT', stock: 10, minStock: 2, cost: 15, unit: 'Pza', detail: '' });

        const totalSelectedLabelsCount = selectedLabels.reduce((sum, item) => sum + item.quantity, 0);

        const handleAddLabel = (product: Product) => {
          const qtyToAdd = labelQuantities[product.id] || 1;
          setSelectedLabels(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
              return prev.map(item => item.product.id === product.id 
                ? { ...item, quantity: item.quantity + qtyToAdd }
                : item
              );
            }
            return [...prev, { product, quantity: qtyToAdd }];
          });
        };

        const handleQuantityChange = (productId: string, val: string) => {
          const num = parseInt(val) || 1;
          setLabelQuantities(prev => ({ ...prev, [productId]: Math.max(1, num) }));
        };

        const handleClearLabels = () => {
          setSelectedLabels([]);
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
            {/* Left Panel: Seleccionar Productos */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-4 sm:px-5 py-3 sm:py-4 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">Seleccionar Productos</h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  {filteredBarcodeProducts.length} {filteredBarcodeProducts.length === 1 ? 'prod.' : 'prods.'}
                </span>
              </div>

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-1 flex flex-col">
                {/* Search Bar */}
                <div className="relative shrink-0">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por código o nombre..."
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#005e63] bg-white text-slate-800"
                  />
                </div>

                {/* Products Table Container */}
                <div className="border border-slate-100 rounded-lg overflow-x-auto overflow-y-auto flex-1 max-h-[500px] touch-pan-x overscroll-x-contain">
                  {filteredBarcodeProducts.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <p className="text-xs">No se encontraron productos coincidentes.</p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[460px] sm:min-w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10 whitespace-nowrap">
                          <th className="py-2.5 px-3 sm:px-4">CÓDIGO</th>
                          <th className="py-2.5 px-2 sm:px-3">PRODUCTO</th>
                          <th className="py-2.5 px-2 sm:px-3 text-right">PRECIO</th>
                          <th className="py-2.5 px-2 sm:px-3 text-center">CANT.</th>
                          <th className="py-2.5 px-3 sm:px-4 text-center">AGREGAR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBarcodeProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors whitespace-nowrap">
                            <td className="py-2.5 px-3 sm:px-4 font-mono text-slate-500 text-[11px]">
                              {p.code}
                            </td>
                            <td className="py-2.5 px-2 sm:px-3 font-semibold text-slate-800 text-[11px] max-w-[150px] sm:max-w-none truncate">
                              {p.name}
                            </td>
                            <td className="py-2.5 px-2 sm:px-3 text-right font-bold text-slate-900 font-mono text-[11px]">
                              {currency}{p.price.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 sm:px-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={labelQuantities[p.id] || 1}
                                onChange={(e) => handleQuantityChange(p.id, e.target.value)}
                                className="w-11 sm:w-12 text-center border border-slate-200 rounded px-1 py-1 text-xs font-bold font-mono bg-white text-slate-800 focus:ring-1 focus:ring-[#005e63]"
                              />
                            </td>
                            <td className="py-2 px-3 sm:px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleAddLabel(p)}
                                className="p-1.5 bg-[#005e63] hover:bg-[#004d52] active:scale-95 text-white rounded-lg cursor-pointer transition-all shadow-xs flex items-center justify-center mx-auto"
                                title="Agregar etiquetas"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel: Vista Previa */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">Vista Previa</h3>
                  <span className="bg-[#0086F0] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    {totalSelectedLabelsCount} {totalSelectedLabelsCount === 1 ? 'etiqueta' : 'etiquetas'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClearLabels}
                    className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintLabels}
                    className="bg-[#005e63] hover:bg-[#004d52] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                </div>
              </div>

              {/* Sub-bar options exactly like reference image */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
                {/* Size Dropdown */}
                <div className="sm:col-span-5 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tamaño etiqueta</label>
                  <select
                    value={selectedLabelSize}
                    onChange={(e) => setSelectedLabelSize(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:ring-1 focus:ring-[#005e63]"
                  >
                    <option value="A4_3x8">Hoja A4 (3x8)</option>
                    <option value="A4_4x10">Hoja A4 (4x10)</option>
                    <option value="A4_5x11">Hoja A4 (5x11)</option>
                    <option value="thermal">Individual (Térmica)</option>
                  </select>
                </div>

                {/* Show checkboxes */}
                <div className="sm:col-span-7 flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mostrar en etiqueta</label>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1 font-medium">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={showLabelName}
                        onChange={(e) => setShowLabelName(e.target.checked)}
                        className="rounded border-slate-300 text-[#005e63] focus:ring-[#005e63] w-3.5 h-3.5"
                      />
                      <span>Nombre</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={showLabelPrice}
                        onChange={(e) => setShowLabelPrice(e.target.checked)}
                        className="rounded border-slate-300 text-[#005e63] focus:ring-[#005e63] w-3.5 h-3.5"
                      />
                      <span>Precio</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={showLabelDescription}
                        onChange={(e) => setShowLabelDescription(e.target.checked)}
                        className="rounded border-slate-300 text-[#005e63] focus:ring-[#005e63] w-3.5 h-3.5"
                      />
                      <span>Descripción</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={showLabelSku}
                        onChange={(e) => setShowLabelSku(e.target.checked)}
                        className="rounded border-slate-300 text-[#005e63] focus:ring-[#005e63] w-3.5 h-3.5"
                      />
                      <span>Código SKU</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Barcode Card Preview */}
              <div className="p-6 flex-1 flex flex-col justify-center items-center bg-slate-50/20 min-h-[300px]">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md w-full max-w-xs flex flex-col items-center justify-center text-center space-y-3 min-h-[180px] hover:shadow-lg transition-all duration-300">
                  {/* Barcode SVG */}
                  {showLabelSku && (
                    <div className="w-full px-2 max-h-[50px] overflow-hidden">
                      {renderBarcodeSVG(previewProduct.code)}
                    </div>
                  )}

                  {/* Name */}
                  {showLabelName && (
                    <div className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1 w-full px-2">
                      {previewProduct.name}
                    </div>
                  )}

                  {/* Price */}
                  {showLabelPrice && (
                    <div className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                      {currency} {previewProduct.price.toFixed(2)}
                    </div>
                  )}

                  {/* Description */}
                  {showLabelDescription && previewProduct.detail && (
                    <div className="text-[10px] text-slate-500 max-w-xs line-clamp-2 w-full px-2">
                      {previewProduct.detail}
                    </div>
                  )}

                  {/* SKU & Category label */}
                  {showLabelSku && (
                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono font-medium">
                      <span className="font-bold text-slate-500">{previewProduct.category || 'General'}</span>
                      <span>{previewProduct.code}</span>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 mt-4 text-center">
                  * Vista de previsualización. Haga clic en <strong className="text-slate-600">Imprimir</strong> para generar la hoja lista para su impresora.
                </p>

                {/* Selected items list to edit quantities */}
                {selectedLabels.length > 0 && (
                  <div className="w-full border-t border-slate-100 pt-4 mt-6 space-y-2 text-left">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Productos en cola</div>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1 w-full">
                      {selectedLabels.map(item => (
                        <div key={item.product.id} className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs shadow-xs">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="font-bold text-slate-800 truncate text-[11px]">{item.product.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.product.code}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLabels(prev => prev.map(l => l.product.id === item.product.id ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l));
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600 font-bold text-[10px]"
                              >
                                -
                              </button>
                              <span className="font-bold text-slate-700 font-mono w-6 text-center text-[11px]">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLabels(prev => prev.map(l => l.product.id === item.product.id ? { ...l, quantity: l.quantity + 1 } : l));
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600 font-bold text-[10px]"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLabels(prev => prev.filter(l => l.product.id !== item.product.id));
                              }}
                              className="text-rose-500 hover:text-rose-700 font-bold text-lg leading-none shrink-0"
                              title="Eliminar de la lista"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* =======================================================
          MODALS AND OVERLAYS SECTION
         ======================================================= */}

      {/* Modal 1: Product Form Dialog (ADD & EDIT) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150 overflow-y-auto overscroll-contain">
          <div className={`bg-white rounded-2xl ${config.businessType === 'pharmacy' ? 'max-w-4xl' : 'max-w-lg'} w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh] sm:max-h-[90vh] min-h-0`}>
            {/* Header */}
            <div className="bg-[#0084FF] text-white p-4 sm:px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-100" />
                {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  stopBarcodeScanner();
                  setIsModalOpen(false);
                }}
                className="text-white hover:text-blue-100 font-bold text-xl cursor-pointer transition-colors p-1"
              >
                ×
              </button>
            </div>

            <form 
              onSubmit={handleSubmit} 
              className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4 text-left flex-1 min-h-0 touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {config.businessType === 'pharmacy' ? (
                /* PHARMACY SPECIALIZED LAYOUT (FROM IMAGE) */
                <div className="space-y-4 min-h-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fecha de Registro */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Fecha de Registro (*)</label>
                      <input
                        type="date"
                        readOnly
                        value={formRegistrationDate}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-500 font-mono focus:outline-none"
                      />
                    </div>

                    {/* Código de Barra */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Código de Barra</label>
                        <span className="text-[10px] text-blue-600 font-medium md:hidden flex items-center gap-1">
                          <Barcode className="w-3 h-3" />
                          Escáner cámara
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="000000088 (Escanea con pistola o escribe)"
                          value={formBarcode}
                          onChange={(e) => setFormBarcode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val) handlePhysicalScanInForm(val);
                            }
                          }}
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => startBarcodeScanner('barcode')}
                          className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-xs shrink-0 transition-all cursor-pointer"
                          title="Escanear código de barras con la cámara del móvil"
                        >
                          <Camera className="w-4 h-4" />
                          <span className="text-[11px] font-semibold">Escanear</span>
                        </button>
                      </div>
                      {productFormScanFeedback && (
                        <div className={`mt-1.5 p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-150 ${
                          productFormScanFeedback.type === 'success' 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          <span>{productFormScanFeedback.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Código/SKU */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Código/SKU</label>
                      <input
                        type="text"
                        required
                        placeholder="SKU-00010"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                      />
                    </div>

                    {/* Ubicación */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Ubicación</label>
                      <input
                        type="text"
                        placeholder="Ingrese la ubicación en estantería"
                        value={formLocation}
                        onChange={(e) => setFormLocation(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
                      />
                    </div>

                    {/* Nombre del Producto (Full width) */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Nombre del Producto</label>
                      <input
                        type="text"
                        required
                        placeholder="Ingrese nombre del medicamento o insumo"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 font-medium"
                      />
                    </div>

                    {/* Tipo(*) & Venta Sujeta(*) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Tipo (*)</label>
                      <select
                        value={formPharmacyType}
                        onChange={(e) => setFormPharmacyType(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
                      >
                        <option value="Genérico">Genérico</option>
                        <option value="Comercial">Comercial / De Marca</option>
                        <option value="Insumo">Insumo Médico</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Venta Sujeta (*)</label>
                      <select
                        value={formPrescriptionRequired}
                        onChange={(e) => setFormPrescriptionRequired(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
                      >
                        <option value="sin receta médica">sin receta médica</option>
                        <option value="bajo receta médica">bajo receta médica</option>
                        <option value="receta médica retenida">receta médica retenida</option>
                      </select>
                      <p className="text-[10px] text-slate-400">
                        {formPrescriptionRequired !== 'sin receta médica' 
                          ? '⚕️ Este producto requerirá registrar la receta médica del paciente en el Punto de Venta al agregarlo al carrito.'
                          : 'Venta libre sin requerir receta médica.'}
                      </p>
                    </div>

                    {/* Registro Sanitario & Categoría(*) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Registro Sanitario</label>
                      <input
                        type="text"
                        placeholder="ingrese el registro sanitario"
                        value={formSanitaryRegister}
                        onChange={(e) => setFormSanitaryRegister(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Categoría (*)</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
                      >
                        {Array.from(new Set([formCategory, ...categoriesList])).filter(Boolean).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Presentación(*) & Descuento */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Presentación (*)</label>
                      <select
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
                      >
                        {unitsList.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Descuento %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formDiscount}
                        onChange={(e) => setFormDiscount(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                      />
                    </div>

                    {/* Stock Mínimo & Stock */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Stock Mínimo (*)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="ingrese el stock mínimo"
                        value={formMinStock}
                        onChange={(e) => setFormMinStock(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Stock (*)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="ingrese el stock"
                        value={formStock}
                        onChange={(e) => {
                          const newVal = e.target.value;
                          setFormStock(newVal);
                          if (formExpirationRows.length <= 1) {
                            setFormExpirationRows(prev => {
                              if (prev.length === 0) {
                                return [{ date: formExpirationDate || '', stock: newVal, batch: formInitialBatch || '00101' }];
                              }
                              return [{ ...prev[0], stock: newVal }];
                            });
                          }
                        }}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                      />
                    </div>

                    {/* Unidad x Caja & Unidad x Blister */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Unidad x Caja</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="100"
                        value={formUnitsPerBox}
                        onChange={(e) => setFormUnitsPerBox(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                      />
                    </div>

                    {!isBlisterHidden && (
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Unidad x Blister</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="10"
                          value={formUnitsPerBlister}
                          onChange={(e) => setFormUnitsPerBlister(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                        />
                      </div>
                    )}

                    {/* Precio Compra & Margen % */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Precio Compra (*)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        placeholder="ingrese el precio compra"
                        value={formCost}
                        onChange={(e) => setFormCost(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Margen % (*)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          placeholder="ingrese el margen"
                          value={formMarginPercent}
                          onChange={(e) => {
                            setFormMarginPercent(e.target.value);
                            const costVal = parseFloat(formCost);
                            const marginVal = parseFloat(e.target.value);
                            if (!isNaN(costVal) && !isNaN(marginVal)) {
                              const priceVal = costVal * (1 + marginVal / 100);
                              setFormPricePerUnit(priceVal.toFixed(2));
                            }
                          }}
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                        />
                        <button
                          type="button"
                          title="Calcular Precio"
                          onClick={() => {
                            const costVal = parseFloat(formCost);
                            const marginVal = parseFloat(formMarginPercent);
                            if (!isNaN(costVal) && !isNaN(marginVal)) {
                              const priceVal = costVal * (1 + marginVal / 100);
                              setFormPricePerUnit(priceVal.toFixed(2));
                            } else {
                              alert('Ingrese el Precio Compra y el Margen % primero');
                            }
                          }}
                          className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Precio Venta x Unidad & Precio Venta x Blister */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Precio Venta x Unidad (*)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="ingrese el precio venta x unidad"
                        value={formPricePerUnit}
                        onChange={(e) => setFormPricePerUnit(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800 font-bold text-blue-800"
                      />
                    </div>

                    {!isBlisterHidden && (
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Precio Venta x Blister</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={formPricePerBlister}
                          onChange={(e) => setFormPricePerBlister(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                        />
                      </div>
                    )}

                    {/* Precio Venta x Caja & Laboratorio */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Precio Venta x Caja</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formPricePerBox}
                        onChange={(e) => setFormPricePerBox(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono bg-white text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Laboratorio (*)</label>
                      <div className="flex gap-2 items-center">
                        <select
                          value={formLaboratory}
                          onChange={(e) => setFormLaboratory(e.target.value)}
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
                        >
                          {combinedLabs.map((lab) => (
                            <option key={lab} value={lab}>{lab}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setIsAddLabModalOpen(true)}
                          className="w-9 h-9 flex items-center justify-center bg-[#F0F4F9] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] text-[#2E3B4E] rounded-xl border border-slate-100 shadow-sm cursor-pointer transition-all duration-150 shrink-0"
                          title="Agregar nuevo laboratorio"
                        >
                          <Plus className="w-5 h-5" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    {/* Síntomas & Estado */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Síntomas (*)</label>
                      <input
                        type="text"
                        placeholder="Ingrese síntomas o indicaciones (ej: Dolor, Gripe)"
                        value={formSymptoms}
                        onChange={(e) => setFormSymptoms(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Estado (*)</label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 font-medium"
                      >
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                      </select>
                    </div>

                    {/* Gestionar por Lote y Vencimiento Section */}
                    <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-xs select-none">
                        <input
                          type="checkbox"
                          checked={formManageBatchAndExpiration}
                          onChange={(e) => setFormManageBatchAndExpiration(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        Gestionar por lote y vencimiento
                      </label>

                      {formManageBatchAndExpiration && (
                        <div className="space-y-4 mt-3 bg-slate-50/80 p-4 rounded-xl border border-slate-150 animate-in slide-in-from-top-2 duration-150">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Alerta vencimiento (días)</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="15"
                                value={formExpirationAlertDays}
                                onChange={(e) => setFormExpirationAlertDays(e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 font-mono focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Lote Inicial Predeterminado</label>
                              <input
                                type="text"
                                placeholder="00101"
                                value={formInitialBatch}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormInitialBatch(val);
                                  if (formExpirationRows.length <= 1) {
                                    setFormExpirationRows(prev => {
                                      if (prev.length === 0) {
                                        return [{ date: formExpirationDate || '', stock: formStock || '', batch: val }];
                                      }
                                      return [{ ...prev[0], batch: val }];
                                    });
                                  }
                                }}
                                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 font-mono focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                            <span className="text-xs font-bold text-slate-700 uppercase">Fechas de Vencimiento y Stock por Lote</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormExpirationRows([
                                  ...formExpirationRows,
                                  { date: '', stock: '', batch: formInitialBatch || '00101' }
                                ]);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-[#F0F4F9] hover:bg-[#E2E8F0] active:bg-[#CBD5E1] text-[#2E3B4E] rounded-xl border border-slate-100 shadow-sm cursor-pointer transition-all duration-150 shrink-0"
                              title="Agregar fecha de vencimiento"
                            >
                              <Plus className="w-5 h-5" strokeWidth={2.5} />
                            </button>
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {formExpirationRows.length === 0 ? (
                              <div className="text-center py-4 bg-white/50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                                Haga clic en el botón <strong className="text-slate-600 font-bold">+</strong> para registrar una fecha de vencimiento.
                              </div>
                            ) : (
                              formExpirationRows.map((row, index) => (
                                <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-lg border border-slate-200 items-end shadow-xs relative">
                                  <div className="sm:col-span-4 space-y-1">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase">Lote</label>
                                    <input
                                      type="text"
                                      placeholder="Ej: 00101"
                                      value={row.batch}
                                      onChange={(e) => {
                                        const updated = [...formExpirationRows];
                                        updated[index].batch = e.target.value;
                                        setFormExpirationRows(updated);
                                      }}
                                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div className="sm:col-span-4 space-y-1">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase">Fecha de Vencimiento</label>
                                    <input
                                      type="date"
                                      required
                                      value={row.date}
                                      onChange={(e) => {
                                        const updated = [...formExpirationRows];
                                        updated[index].date = e.target.value;
                                        setFormExpirationRows(updated);
                                        if (index === 0) {
                                          setFormExpirationDate(e.target.value);
                                        }
                                      }}
                                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div className="sm:col-span-3 space-y-1">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase">Stock</label>
                                    <input
                                      type="number"
                                      min="0"
                                      required
                                      placeholder="Ej: 50"
                                      value={row.stock}
                                      onChange={(e) => {
                                        const updated = [...formExpirationRows];
                                        updated[index].stock = e.target.value;
                                        setFormExpirationRows(updated);
                                      }}
                                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800 font-mono focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div className="sm:col-span-1 flex justify-center pb-0.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = formExpirationRows.filter((_, i) => i !== index);
                                        setFormExpirationRows(updated);
                                      }}
                                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                      title="Eliminar fila"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {formExpirationRows.length > 0 && (
                            <div className="text-right text-[10px] font-bold text-slate-500 uppercase pr-1">
                              Suma de stock en lotes: <span className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{formExpirationRows.reduce((acc, r) => acc + (parseInt(r.stock) || 0), 0)}</span> unidades.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Descripción */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Descripción</label>
                      <textarea
                        rows={2}
                        placeholder="Ingrese especificaciones, principio activo o detalles adicionales..."
                        value={formDetail}
                        onChange={(e) => setFormDetail(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white text-slate-800"
                      />
                    </div>

                    {/* Imagen del Producto */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Imagen del Producto</label>
                      {formImageUrl ? (
                        <div className="relative border border-slate-200 bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src={formImageUrl} alt="Product" className="w-16 h-16 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                            <div className="text-[11px] text-slate-500">
                              <span className="font-bold text-slate-700 block">Imagen cargada</span>
                              <span className="text-[9px]">Listo para guardar</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormImageUrl('')}
                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg hover:text-red-700 transition-colors"
                            title="Eliminar imagen"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed ${dragActive ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-slate-50/50'} rounded-xl p-4 text-center hover:bg-slate-50 transition-colors relative cursor-pointer`}
                          onClick={() => document.getElementById('product-image-file-input-pharmacy')?.click()}
                        >
                          <input
                            id="product-image-file-input-pharmacy"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <div className="text-xs text-slate-500 flex flex-col items-center gap-1.5 pointer-events-none">
                            <PackageOpen className="w-8 h-8 text-slate-400 animate-pulse" />
                            <span className="font-bold text-blue-600 hover:underline">Haga clic o arrastre aquí para cargar imagen</span>
                            <span>Formatos: JPG, PNG, GIF (Máx. 5MB)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD GENERAL INVENTORY LAYOUT */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Nombre del Producto *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Whisky Black Label 750ml, etc."
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] bg-white text-slate-800"
                    />
                  </div>

                  {/* Code */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Código de barras *</label>
                      <span className="text-[10px] text-blue-600 font-medium md:hidden flex items-center gap-1">
                        <Barcode className="w-3 h-3" />
                        Escáner cámara
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Ej: DEMO-P001 (Escanea con pistola o escribe)"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) handlePhysicalScanInForm(val);
                          }
                        }}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] font-mono bg-white text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => startBarcodeScanner('code')}
                        className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-xs shrink-0 transition-all cursor-pointer"
                        title="Escanear código de barras con la cámara del móvil"
                      >
                        <Camera className="w-4 h-4" />
                        <span className="text-[11px] font-semibold">Escanear</span>
                      </button>
                    </div>
                    {productFormScanFeedback && (
                      <div className={`mt-1.5 p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-150 ${
                        productFormScanFeedback.type === 'success' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        <span>{productFormScanFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Categoría *</label>
                    <select
                      required
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] bg-white text-slate-800 font-medium"
                    >
                      {Array.from(new Set([formCategory, ...categoriesList])).filter(Boolean).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Cost */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Costo de Adquisición ({currency}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      placeholder="0.00"
                      value={formCost}
                      onChange={(e) => setFormCost(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] font-mono bg-white text-slate-800"
                    />
                  </div>

                  {/* Price */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Precio de Venta ({currency}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0"
                      placeholder="0.00"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] font-mono bg-white text-slate-800"
                    />
                  </div>

                  {/* Initial Stock */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Stock Inicial *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="0"
                      value={formStock}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setFormStock(newVal);
                        if (formExpirationRows.length <= 1) {
                          setFormExpirationRows(prev => {
                            if (prev.length === 0) {
                              return [{ date: formExpirationDate || '', stock: newVal, batch: formInitialBatch || '00101' }];
                            }
                            return [{ ...prev[0], stock: newVal }];
                          });
                        }
                      }}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] font-mono bg-white text-slate-800"
                    />
                  </div>

                  {/* Min Stock */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Stock Mínimo de Alerta</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="5"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] font-mono bg-white text-slate-800"
                    />
                  </div>

                  {/* Unit */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Unidad de Medida</label>
                    <select
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] bg-white text-slate-700"
                    >
                      {unitsList.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>

                  {/* Expiration Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={formExpirationDate}
                      onChange={(e) => setFormExpirationDate(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] font-mono bg-white text-slate-800"
                    />
                  </div>

                  {/* Location */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Ubicación física en Tienda</label>
                    <input
                      type="text"
                      placeholder="Ej: Almacén Principal, Estante A-12"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] bg-white text-slate-800"
                    />
                  </div>

                  {/* Description details */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Descripción / Detalles adicionales</label>
                    <textarea
                      rows={2}
                      placeholder="Escribe comentarios, notas de proveedores o detalles del lote..."
                      value={formDetail}
                      onChange={(e) => setFormDetail(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#005e63] bg-white text-slate-800"
                    />
                  </div>

                  {/* Imagen del Producto */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Imagen del Producto</label>
                    {formImageUrl ? (
                      <div className="relative border border-slate-200 bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={formImageUrl} alt="Product" className="w-16 h-16 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                          <div className="text-[11px] text-slate-500">
                            <span className="font-bold text-slate-700 block">Imagen cargada</span>
                            <span className="text-[9px]">Listo para guardar</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormImageUrl('')}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg hover:text-red-700 transition-colors"
                          title="Eliminar imagen"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed ${dragActive ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-slate-50/50'} rounded-xl p-4 text-center hover:bg-slate-50 transition-colors relative cursor-pointer`}
                        onClick={() => document.getElementById('product-image-file-input-standard')?.click()}
                      >
                        <input
                          id="product-image-file-input-standard"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <div className="text-xs text-slate-500 flex flex-col items-center gap-1.5 pointer-events-none">
                          <PackageOpen className="w-8 h-8 text-slate-400 animate-pulse" />
                          <span className="font-bold text-[#005e63] hover:underline">Haga clic o arrastre aquí para cargar imagen</span>
                          <span>Formatos: JPG, PNG, GIF (Máx. 5MB)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons styled precisely like the image */}
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs py-3 border-t border-slate-100 mt-6 shrink-0 flex gap-3 justify-end z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.04)]">
                <button
                  type="button"
                  onClick={() => {
                    stopBarcodeScanner();
                    setIsModalOpen(false);
                  }}
                  className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs active:scale-98"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-bold shadow-xs active:scale-98 transition-colors cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Barcode Camera Scanner Modal for Product Form */}
      {isBarcodeScannerOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[70] flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          {/* Scanner Header */}
          <div className="flex items-center justify-between text-white shrink-0 pt-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  Escanear Código de Barras
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Cámara Móvil
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300">Apunta la cámara al código de barras del producto</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleScannerCamera}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer"
                title="Cambiar entre cámara trasera y delantera"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={stopBarcodeScanner}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors cursor-pointer"
                title="Cerrar escáner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scanner Viewfinder */}
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
                    onClick={() => startBarcodeScanner(targetBarcodeField, scannerFacingMode)}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    <span>Reintentar Escaneo</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopBarcodeScanner}
                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Ingresar Código Manualmente</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoScannerRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Reticle / Target Scanner Frame */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className={`relative w-full max-w-[290px] h-52 border-2 ${scanSuccessFlash ? 'border-emerald-400 bg-emerald-500/25 shadow-[0_0_30px_rgba(52,211,153,0.6)]' : 'border-blue-400/90 bg-black/15 shadow-[0_0_20px_rgba(59,130,246,0.3)]'} rounded-2xl transition-all duration-200 flex flex-col justify-between p-2`}>
                    {/* Corners */}
                    <div className="flex justify-between">
                      <div className="w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-md -mt-1.5 -ml-1.5" />
                      <div className="w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-md -mt-1.5 -mr-1.5" />
                    </div>

                    {/* Animated Laser line */}
                    {!scanSuccessFlash && (
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse" />
                    )}

                    {scanSuccessFlash && (
                      <div className="my-auto flex flex-col items-center justify-center gap-2 animate-in zoom-in-90 duration-150">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                        <span className="text-sm font-mono font-black text-white bg-black/80 px-3 py-1.5 rounded-lg border border-emerald-400/60 shadow-lg tracking-wider">
                          {scannedCodePreview}
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
                    {scanSuccessFlash 
                      ? (targetBarcodeField === 'inventory_search' ? '✓ ¡Código detectado! Buscando en inventario...' : '✓ ¡Código detectado! Completando formulario...') 
                      : 'Centra el código de barras físico dentro del recuadro'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="shrink-0 pt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={stopBarcodeScanner}
              className="w-full py-3 px-4 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Edit className="w-4 h-4" />
              <span>Cerrar escáner e ingresar código manualmente</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              {targetBarcodeField === 'inventory_search'
                ? 'Al detectar el código, se buscará e identificará el producto en el inventario.'
                : 'Al detectar el código, se completará automáticamente en el formulario.'}
            </p>
          </div>
        </div>
      )}

      {/* Modal 2: Product Detail Sheet */}
      {detailProduct && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                <Info className="w-5 h-5 text-teal-600" /> Ficha Técnica del Producto
              </h3>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-150">
                <div className="w-12 h-12 rounded-lg bg-teal-100 border border-teal-200 flex items-center justify-center overflow-hidden font-bold text-teal-800 text-sm shrink-0">
                  {detailProduct.imageUrl ? (
                    <img src={detailProduct.imageUrl} alt={detailProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    detailProduct.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{detailProduct.name}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {detailProduct.id}</span>
                </div>
              </div>

              {(() => {
                const formatDateDisplay = (raw: string) => {
                  if (!raw || raw === '—') return 'S/V';
                  if (raw.includes('-')) {
                    const parts = raw.split('-');
                    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                  }
                  return raw;
                };

                const totalProdStock = getProductStock(detailProduct);
                let lotesList: { batch: string; date: string; stock: number }[] = [];
                if (detailProduct.expirationDates && detailProduct.expirationDates.length > 0) {
                  const validExpDates = detailProduct.expirationDates.filter(r => (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)) > 0);
                  const sumLotes = validExpDates.reduce((s, r) => s + (typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0)), 0);
                  lotesList = validExpDates.map((r, idx) => {
                    const rawStock = typeof r.stock === 'number' ? r.stock : (parseInt(r.stock as any) || 0);
                    let calculatedStock = rawStock;
                    if (validExpDates.length === 1 && totalProdStock > 0) {
                      calculatedStock = totalProdStock;
                    } else if (sumLotes !== totalProdStock && sumLotes > 0) {
                      const ratio = rawStock / sumLotes;
                      calculatedStock = Math.round(totalProdStock * ratio);
                    } else if (sumLotes === 0 && idx === 0) {
                      calculatedStock = totalProdStock;
                    }
                    return {
                      batch: r.batch || detailProduct.initialBatch || '00101',
                      date: r.date || detailProduct.expirationDate || '—',
                      stock: calculatedStock
                    };
                  });
                } else if (totalProdStock > 0 && (detailProduct.manageBatchAndExpiration || detailProduct.initialBatch || detailProduct.expirationDate)) {
                  lotesList = [{
                    batch: detailProduct.initialBatch || '00101',
                    date: detailProduct.expirationDate || '—',
                    stock: totalProdStock
                  }];
                }

                const primaryBatch = detailProduct.initialBatch || (lotesList[0]?.batch) || '00101';
                const primaryExpDate = formatDateDisplay(detailProduct.expirationDate || (lotesList[0]?.date) || '');

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Código de barras</span>
                        <span className="font-mono text-slate-700 font-semibold">{detailProduct.code}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Categoría</span>
                        <span className="text-slate-700 font-semibold">{detailProduct.category}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Costo</span>
                        <span className="font-mono text-slate-700 font-semibold">{currency}{detailProduct.cost.toFixed(2)}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Precio de Venta</span>
                        <span className="font-mono text-teal-700 font-bold">{currency}{detailProduct.price.toFixed(2)}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Stock Total</span>
                        <span className="font-mono text-slate-700 font-semibold">{totalProdStock} {detailProduct.unit}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Alerta de mínimo</span>
                        <span className="font-mono text-slate-700 font-semibold">{detailProduct.minStock} {detailProduct.unit}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Lote Inicial</span>
                        <span className="font-mono text-slate-800 font-bold">{primaryBatch}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Vencimiento</span>
                        <span className="font-mono text-slate-800 font-bold">{primaryExpDate !== 'S/V' ? primaryExpDate : 'No aplica'}</span>
                      </div>
                      <div className="p-2 border border-slate-100 rounded-lg bg-white">
                        <span className="block text-[9px] text-slate-400 font-bold uppercase">Ubicación Física</span>
                        <span className="text-slate-700 font-semibold">{detailProduct.location || 'Almacén Principal'}</span>
                      </div>
                    </div>

                    {lotesList.length > 0 && (
                      <div className="p-3 border border-slate-200/80 rounded-xl bg-slate-50/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="block text-[10px] text-slate-600 font-bold uppercase tracking-wider">Lotes y Fechas de Vencimiento</span>
                          <span className="text-[10px] font-semibold text-slate-400">Total: {totalProdStock} {detailProduct.unit || 'Pza'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[9px] font-bold text-slate-400 uppercase border-b border-slate-200 pb-1 font-mono">
                          <span>Lote</span>
                          <span>Vencimiento</span>
                          <span className="text-right">Stock</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5 divide-y divide-slate-100">
                          {lotesList.map((r, idx) => (
                            <div key={idx} className="grid grid-cols-3 gap-2 text-xs text-slate-700 font-mono pt-1.5 first:pt-0 items-center">
                              <span className="truncate font-bold text-slate-800">{r.batch}</span>
                              <span className="text-slate-600">{formatDateDisplay(r.date)}</span>
                              <span className="font-bold text-blue-600 text-right bg-blue-50/80 px-2 py-0.5 rounded-md justify-self-end">{r.stock} {detailProduct.unit || 'u.'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {detailProduct.detail && (
                <div className="p-2 border border-slate-100 rounded-lg bg-white space-y-1">
                  <span className="block text-[9px] text-slate-400 font-bold uppercase">Detalles / Notas del Lote</span>
                  <p className="text-slate-600 leading-relaxed">{detailProduct.detail}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setDetailProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Kardex Valorado General Modal */}
      {isKardexOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-teal-600" /> Reporte de Kardex Valorado General
              </h3>
              <button
                type="button"
                onClick={() => setIsKardexOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Quick Metrics of Valuation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <span className="block text-[9px] text-slate-400 font-bold uppercase">Artículos</span>
                <span className="text-base font-bold text-slate-800 font-mono">{kardexSummary.productsCount}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <span className="block text-[9px] text-slate-400 font-bold uppercase">Costo Activo</span>
                <span className="text-base font-bold text-slate-800 font-mono">{currency}{kardexSummary.totalInversion.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <span className="block text-[9px] text-slate-400 font-bold uppercase">Valor Venta</span>
                <span className="text-base font-bold text-teal-700 font-mono">{currency}{kardexSummary.valorVentaTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                <span className="block text-[9px] text-emerald-600 font-bold uppercase">Margen Est.</span>
                <span className="text-base font-bold text-emerald-700 font-mono">{kardexSummary.margenPromedio.toFixed(1)}%</span>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-[11px] border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-2 text-center">Stock</th>
                    <th className="py-2.5 px-2 text-right">Costo Unit.</th>
                    <th className="py-2.5 px-2 text-right">Inversión</th>
                    <th className="py-2.5 px-2 text-right">Precio Unit.</th>
                    <th className="py-2.5 px-2 text-right">Total Venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {products.map((p) => {
                    const effStock = getProductStock(p);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-800">{p.name}</td>
                        <td className="py-2 px-2 text-center font-bold text-slate-700">{effStock}</td>
                        <td className="py-2 px-2 text-right">{currency}{p.cost.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-slate-700">{currency}{(effStock * p.cost).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right">{currency}{p.price.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-teal-700 font-bold">{currency}{(effStock * p.price).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400">Total de ganancia estimada del inventario: <span className="font-bold text-emerald-600 font-mono text-xs">{currency}{kardexSummary.gananciaEstimada.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></p>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#005e63] hover:bg-[#004d52] text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Printer className="w-4 h-4" /> Imprimir Reporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Create Combo Modal */}
      {isComboModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto overscroll-contain animate-in fade-in duration-150">
          <form
            onSubmit={handleAddCombo}
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-auto max-h-[90vh] min-h-0"
          >
            {/* Header: Title & close button */}
            <div className="bg-[#f8faff] text-slate-800 px-6 py-4.5 flex items-center justify-between shrink-0 border-b border-slate-100">
              <h3 className="text-lg font-black tracking-tight text-slate-800 font-display">
                Combo
              </h3>
              <button
                type="button"
                onClick={() => {
                  setNewComboName('');
                  setNewComboComponents([]);
                  setSelectedComponentProductId('');
                  setSelectedComponentQuantity('');
                  setIsComboModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 min-h-0">
              
              {/* Nombre Section */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-semibold text-sm">Nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Toma"
                  value={newComboName}
                  onChange={(e) => setNewComboName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Presentación Section */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-semibold text-sm">Presentación</label>
                <div className="w-full bg-slate-100 text-slate-500 rounded-xl px-4 py-3 text-sm select-none font-medium border border-slate-200/50">
                  combo
                </div>
              </div>

              {/* Producto & Cantidad Selectors */}
              <div className="grid grid-cols-12 gap-3 items-end">
                {/* Producto */}
                <div className="col-span-6 space-y-1.5">
                  <label className="block text-slate-700 font-semibold text-sm">Producto</label>
                  <select
                    value={selectedComponentProductId}
                    onChange={(e) => setSelectedComponentProductId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundPosition: 'right 12px center', backgroundSize: '16px', backgroundRepeat: 'no-repeat' }}
                  >
                    <option value="">Seleccionar producto</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({currency}{p.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cantidad */}
                <div className="col-span-3 space-y-1.5">
                  <label className="block text-slate-700 font-semibold text-sm">Cantidad</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Ej:"
                    value={selectedComponentQuantity}
                    onChange={(e) => setSelectedComponentQuantity(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-3 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-center placeholder:text-slate-400"
                  />
                </div>

                {/* Agregar Button */}
                <div className="col-span-3 flex flex-col items-center justify-center pb-0.5">
                  <button
                    type="button"
                    onClick={handleAddComboComponent}
                    className="flex flex-col items-center justify-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full border border-slate-200 hover:border-indigo-300 flex items-center justify-center bg-slate-50/50 hover:bg-indigo-50 transition-all shadow-sm">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 group-hover:text-indigo-600 transition-colors">Agregar</span>
                  </button>
                </div>
              </div>

              {/* Componentes Section */}
              <div className="space-y-2">
                <label className="block text-slate-700 font-semibold text-sm">Componentes</label>
                
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/25">
                  {/* Table Header with light-blue tint background */}
                  <div className="grid grid-cols-12 bg-blue-50/80 text-indigo-950 text-[10px] font-extrabold uppercase tracking-wider py-3 px-4 border-b border-slate-200/60">
                    <div className="col-span-6">Producto</div>
                    <div className="col-span-3 text-center">Cantidad</div>
                    <div className="col-span-3 text-right">Acciones</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100 min-h-[80px] flex flex-col justify-center">
                    {newComboComponents.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 font-medium text-xs">
                        Sin componentes
                      </div>
                    ) : (
                      newComboComponents.map((c) => (
                        <div key={c.productId} className="grid grid-cols-12 items-center py-2 px-4 text-xs hover:bg-slate-50/50 transition-colors">
                          <div className="col-span-6 font-semibold text-slate-800">{c.name}</div>
                          <div className="col-span-3 text-center font-mono font-bold text-slate-700 bg-slate-100 py-1 px-2 rounded-lg max-w-[50px] mx-auto">{c.quantity}</div>
                          <div className="col-span-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveComboComponent(c.productId)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-1 text-[11px] font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Quitar</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Footer with Guardar Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/50 px-6 py-4 rounded-b-3xl">
              <button
                type="submit"
                className="px-8 py-3 bg-[#005e63] hover:bg-[#004b4f] text-white rounded-2xl font-bold shadow-md hover:shadow-lg active:scale-98 transition-all text-sm cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 5: Create Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">Registrar Nuevo Servicio</h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">×</button>
            </div>

            <form onSubmit={handleAddService} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Nombre del Servicio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Reparación, Delivery, etc."
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Precio del Servicio *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Descripción</label>
                <textarea
                  rows={2}
                  placeholder="Describe brevemente en qué consiste el servicio..."
                  value={newServiceDescription}
                  onChange={(e) => setNewServiceDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800"
                />
              </div>

              <div className="flex gap-3 pt-3 mt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#005e63] hover:bg-[#004d52] text-white rounded-lg font-bold cursor-pointer"
                >
                  Registrar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Create Promo Modal */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">Crear Nueva Promoción / Cupón</h3>
              <button onClick={() => setIsPromoModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">×</button>
            </div>

            <form onSubmit={handleAddPromo} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Código del Cupón *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: APERTURA20"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono uppercase bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Nombre / Campaña *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Descuento 20% de Inauguración"
                  value={newPromoName}
                  onChange={(e) => setNewPromoName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase">Valor de Descuento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 15% o Q20.00"
                    value={newPromoValue}
                    onChange={(e) => setNewPromoValue(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono bg-white text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase">Tipo de Cupón</label>
                  <select
                    value={newPromoType}
                    onChange={(e) => setNewPromoType(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700"
                  >
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto Fijo ($)</option>
                    <option value="special">Especial (2x1, etc)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Fecha de Expiración</label>
                <input
                  type="date"
                  value={newPromoExpiration}
                  onChange={(e) => setNewPromoExpiration(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono bg-white text-slate-800"
                />
              </div>

              <div className="flex gap-3 pt-3 mt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPromoModalOpen(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#005e63] hover:bg-[#004d52] text-white rounded-lg font-bold cursor-pointer"
                >
                  Crear Cupón
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Product-specific Kardex Modal */}
      {isProductKardexOpen && selectedKardexProduct && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-5xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
            
            {/* Header with #0084FF Background */}
            <div className="flex items-center justify-between bg-[#0084FF] text-white px-6 py-4 shrink-0 shadow-sm">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Kardex — {selectedKardexProduct.name}</h3>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsProductKardexOpen(false);
                  setSelectedKardexProduct(null);
                }} 
                className="text-white hover:text-sky-100 font-bold text-2xl leading-none cursor-pointer transition-colors"
                title="Cerrar"
              >
                ×
              </button>
            </div>

            {/* Scrollable Container for Form and Tables */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Product Info Banner exactly like the image */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shadow-sm">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">CÓDIGO/SKU</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedKardexProduct.code}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">CATEGORÍA</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedKardexProduct.category || 'Sin Categoría'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">TIPO</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedKardexProduct.unit || 'Medicamento'}</span>
                </div>
                <div className="flex items-center justify-end sm:justify-end gap-2 col-span-2 sm:col-span-1">
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">STOCK ACTUAL</span>
                    <div className="font-bold text-sky-500 text-xl flex items-center gap-1 sm:justify-end">
                      <Boxes className="w-5 h-5 text-sky-400" />
                      <span>{selectedKardexProduct.stock}</span>
                    </div>
                  </div>
                </div>
              </div>



              {/* Movimientos Title Tab Indicator */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-slate-700 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <span className="text-slate-400">☰</span> Movimientos de inventario
                </span>
                <span className="bg-slate-200 text-slate-700 font-bold text-xs px-2.5 py-0.5 rounded-full">
                  {productKardexHistory.length}
                </span>
              </div>

              {/* History logs table with exact columns matching the image */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                  {productKardexHistory.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs">No hay movimientos registrados para este producto.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#EBF5FF] border-b border-slate-200 text-[#004e7c] text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                          <th className="py-2.5 px-4">Fecha</th>
                          <th className="py-2.5 px-3">Usuario</th>
                          <th className="py-2.5 px-3">Oper.</th>
                          <th className="py-2.5 px-3">Referencia</th>
                          <th className="py-2.5 px-3">Motivo</th>
                          <th className="py-2.5 px-3">Lote</th>
                          <th className="py-2.5 px-3">Vence</th>
                          <th className="py-2.5 px-3 text-center">Ing.</th>
                          <th className="py-2.5 px-3 text-center">Sal.</th>
                          <th className="py-2.5 px-4 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productKardexHistory.map((h, idx) => {
                          let badgeStyle = 'bg-amber-50 text-amber-700 border-amber-100';
                          if (h.motivo === 'Inicial') badgeStyle = 'bg-[#0086F0] text-white border-none';
                          if (h.motivo === 'Venta') badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                          if (h.motivo === 'Compra') badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100';

                          return (
                            <tr key={h.id || idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 text-slate-400 text-[10px] font-mono whitespace-nowrap">
                                {new Date(h.date).toLocaleDateString()}, {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-medium">
                                {h.user}
                              </td>
                              <td className="py-3 px-3 text-slate-700 font-semibold">
                                {h.operation}
                              </td>
                              <td className="py-3 px-3 text-slate-800 font-medium">
                                {h.concept}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-bold border ${badgeStyle}`}>
                                  {h.motivo}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                                {h.lote}
                              </td>
                              <td className="py-3 px-3 text-slate-500">
                                {h.vence ? new Date(h.vence).toLocaleDateString() : '-'}
                              </td>
                              <td className="py-3 px-3 text-center font-bold font-mono text-emerald-600 text-[12px]">
                                {h.type === 'entrada' || h.type === 'inicial' ? h.quantity : ''}
                              </td>
                              <td className="py-3 px-3 text-center font-bold font-mono text-rose-500 text-[12px]">
                                {h.type === 'salida' ? h.quantity : ''}
                              </td>
                              <td className="py-3 px-4 text-right font-bold font-mono text-slate-900 text-[12px]">
                                {h.balance}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

            {/* Footer with Print, PDF, and Close Slate Button */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50 shrink-0">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePrintKardex}
                  className="flex items-center gap-2 px-3 py-1.5 text-sky-600 hover:text-sky-800 font-bold text-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4 text-sky-500" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-3 py-1.5 text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  PDF
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProductKardexOpen(false);
                  setSelectedKardexProduct(null);
                }}
                className="px-5 py-2 bg-[#555E6C] hover:bg-[#464E5A] text-white rounded-lg font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              >
                <X className="w-3.5 h-3.5" /> Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal: Agregar Laboratorio */}
      {isAddLabModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">Registrar Nuevo Laboratorio</h3>
              <button 
                type="button"
                onClick={() => {
                  setIsAddLabModalOpen(false);
                  setNewLabName('');
                }} 
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-lg animate-none bg-transparent border-0"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddNewLaboratory} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Nombre del Laboratorio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pfizer, Genfar, Sandoz..."
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddLabModalOpen(false);
                    setNewLabName('');
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#005e63] hover:bg-[#004d52] text-white rounded-lg font-bold cursor-pointer transition-colors"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Aumentar Stock Manual (matches exact user design) */}
      {isManualStockModalOpen && manualStockProduct && (
        <div className="fixed inset-0 !m-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl md:max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col my-auto mx-auto animate-in zoom-in-95 duration-150">
            
            {/* Top Header */}
            <div className="bg-[#0084FF] px-5 sm:px-6 py-3.5 flex items-center justify-between text-white shadow-xs shrink-0 z-10">
              <div className="flex items-center gap-2.5">
                <PlusCircle className="w-5 h-5 stroke-[2.5] text-white" />
                <h3 className="font-bold text-base text-white tracking-wide">Aumentar Stock Manual</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManualStockModalOpen(false);
                  setManualStockProduct(null);
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleConfirmManualStock} className="flex flex-col">
              <div className="p-4 sm:p-5 md:p-6">
                <div className="flex flex-col md:flex-row gap-4 sm:gap-5 md:gap-6 items-start">
                  
                  {/* Left Column: Product Image Box */}
                  <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-44 lg:h-44 shrink-0 rounded-2xl bg-slate-50 border border-slate-200/80 p-2 sm:p-2.5 flex items-center justify-center overflow-hidden shadow-inner mx-auto md:mx-0">
                    {manualStockProduct.imageUrl ? (
                      <img
                        src={manualStockProduct.imageUrl}
                        alt={manualStockProduct.name}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center text-slate-300 flex flex-col items-center gap-2">
                        <Package className="w-12 h-12 md:w-14 md:h-14 stroke-[1.2] text-slate-300" />
                        <span className="text-[10px] md:text-[11px] font-bold text-slate-400">Sin imagen</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Product details & fields */}
                  <div className="flex-1 w-full space-y-2.5 sm:space-y-3">
                    <div>
                      <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight">
                        {manualStockProduct.name}
                      </h2>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1.5 font-mono">
                        <span>{manualStockProduct.code}</span>
                        <span>•</span>
                        <span className="text-slate-500 font-sans">{manualStockProduct.category || 'General'}</span>
                      </p>
                    </div>

                    {/* Stock Actual Box */}
                    <div className="bg-[#f0f8ff] border border-[#d8ecff] rounded-xl px-3.5 py-2 flex items-center gap-3">
                      <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-wider">STOCK ACTUAL</span>
                      <span className="text-xl sm:text-2xl font-black text-[#1e40af] font-mono leading-none">
                        {getProductStock(manualStockProduct)}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        ({manualStockProduct.unit || 'Unidad'})
                      </span>
                    </div>

                    {/* Ubicación */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">Ubicación</label>
                      <select
                        value={manualStockLocation}
                        onChange={(e) => setManualStockLocation(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 sm:py-2 text-xs text-slate-700 font-medium focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all outline-hidden cursor-pointer"
                      >
                        <option value={manualStockProduct.location || 'Almacén Principal'}>
                          {manualStockProduct.location || 'Almacén Principal'} -- Stock: {getProductStock(manualStockProduct)}
                        </option>
                        <option value="Almacén Secundario">Almacén Secundario</option>
                        <option value="Vitrina Principal">Vitrina Principal</option>
                        <option value="Bodega">Bodega</option>
                      </select>
                    </div>

                    {/* Cantidad a agregar */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">Cantidad a agregar</label>
                      <input
                        type="number"
                        min="1"
                        required
                        autoFocus
                        placeholder="0"
                        value={manualStockQty}
                        onChange={(e) => setManualStockQty(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 sm:py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all outline-hidden"
                      />
                    </div>

                    {/* Motivo (opcional) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">Motivo (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: Ajuste por conteo físico"
                        value={manualStockReason}
                        onChange={(e) => setManualStockReason(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 sm:py-2 text-xs text-slate-800 focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all outline-hidden"
                      />
                    </div>

                    {/* Nuevo stock estimado Box */}
                    <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl px-3.5 py-2 sm:py-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#166534]">Nuevo stock estimado</span>
                      <span className="text-lg sm:text-xl font-black text-[#166534] font-mono leading-none">
                        {getProductStock(manualStockProduct) + (parseInt(manualStockQty) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-3 sm:py-3.5 bg-slate-50/95 backdrop-blur-xs border-t border-slate-100 flex items-center justify-end gap-3 sm:gap-4 shrink-0 rounded-b-2xl sm:rounded-b-3xl z-10">
                <button
                  type="button"
                  onClick={() => {
                    setIsManualStockModalOpen(false);
                    setManualStockProduct(null);
                  }}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#10b981] hover:bg-[#059669] active:scale-98 text-white px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar aumento</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: TRANSFERIR STOCK ENTRE SUCURSALES */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-50/80 px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 border border-sky-150 flex items-center justify-center shrink-0 shadow-2xs">
                  <ArrowRightLeft className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                    Transferir Stock entre Sucursales
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Mueve existencias de productos de una sede a otra en tiempo real
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isTransferring) {
                    setIsTransferModalOpen(false);
                    setTransferErrorMessage(null);
                    setTransferSuccessMessage(null);
                  }
                }}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body & Form */}
            <form onSubmit={handleExecuteTransfer} className="p-5 sm:p-6 space-y-4 text-xs">
              
              {/* Alert: Error */}
              {transferErrorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="font-semibold">{transferErrorMessage}</span>
                </div>
              )}

              {/* Alert: Success */}
              {transferSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{transferSuccessMessage}</span>
                </div>
              )}

              {/* 1. Branch Selectors Row with visual direction */}
              <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Ruta de Transferencia</span>
                  <span className="text-sky-600 font-semibold lowercase">origen &rarr; destino</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                  {/* Source Branch */}
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 text-[11px]">
                      Sucursal Origen (De donde sale) *
                    </label>
                    <select
                      value={transferSourceId}
                      onChange={(e) => {
                        const newSrc = e.target.value;
                        setTransferSourceId(newSrc);
                        if (newSrc === transferTargetId) {
                          const other = availableBranches.find(b => b.id !== newSrc);
                          if (other) setTransferTargetId(other.id);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-xs shadow-2xs"
                    >
                      {availableBranches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.code ? `(${b.code})` : ''} {b.isMain ? '★ Principal' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Branch */}
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 text-[11px]">
                      Sucursal Destino (A donde llega) *
                    </label>
                    <select
                      value={transferTargetId}
                      onChange={(e) => setTransferTargetId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-xs shadow-2xs"
                    >
                      {availableBranches.map(b => (
                        <option key={b.id} value={b.id} disabled={b.id === transferSourceId}>
                          {b.name} {b.code ? `(${b.code})` : ''} {b.id === transferSourceId ? '(Origen actual)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Product Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 text-[11px]">
                    Producto a Transferir *
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {sourceBranchProducts.length} producto(s) con stock disponible en {sourceBranchObj?.name || 'origen'}
                  </span>
                </div>

                {/* Quick filter input for long product lists */}
                {sourceBranchProducts.length > 5 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrar por nombre o código..."
                      value={transferProductSearch}
                      onChange={(e) => setTransferProductSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                )}

                <select
                  value={transferProductId}
                  onChange={(e) => {
                    setTransferProductId(e.target.value);
                    setTransferQuantity(1);
                  }}
                  disabled={sourceBranchProducts.length === 0}
                  className="w-full px-3 py-2.5 bg-white border border-slate-250 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-xs shadow-2xs"
                >
                  {sourceBranchProducts.length === 0 ? (
                    <option value="">No hay productos con existencias en {sourceBranchObj?.name || 'esta sucursal'}</option>
                  ) : filteredSourceProducts.length === 0 ? (
                    <option value="">No coincide ningún producto con la búsqueda</option>
                  ) : (
                    filteredSourceProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `[${p.code}] ` : ''}{p.name} — Stock disponible: {p.stock || 0} {p.unit || 'Pza'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selected Product Info Badge & Stock Comparison */}
              {selectedTransferProduct && (
                <div className="bg-sky-50/50 border border-sky-150 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-sky-600" />
                      <span className="font-bold text-slate-800">{selectedTransferProduct.name}</span>
                      {selectedTransferProduct.code && (
                        <span className="font-mono text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-bold">
                          {selectedTransferProduct.code}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-700">
                      {currency} {(selectedTransferProduct.price || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Stock projection matrix */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sky-100 text-[11px]">
                    <div className="bg-white/80 p-2 rounded-xl border border-sky-100">
                      <span className="text-slate-500 block text-[10px]">Origen: {sourceBranchObj?.name}</span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="font-mono font-bold text-slate-700">{availableTransferStock}</span>
                        <span className="text-slate-400 font-mono text-[10px]">&rarr;</span>
                        <span className="font-mono font-bold text-amber-600">
                          {Math.max(0, availableTransferStock - (Number(transferQuantity) || 0))} {selectedTransferProduct.unit || 'Pza'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/80 p-2 rounded-xl border border-sky-100">
                      <span className="text-slate-500 block text-[10px]">Destino: {targetBranchObj?.name}</span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="font-mono font-bold text-slate-700">{targetCurrentStock}</span>
                        <span className="text-slate-400 font-mono text-[10px]">&rarr;</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {targetCurrentStock + (Number(transferQuantity) || 0)} {selectedTransferProduct.unit || 'Pza'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Quantity to Transfer & Helper Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 text-[11px]">
                    Cantidad a Transferir *
                  </label>
                  {selectedTransferProduct && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      Máximo disponible: <strong className="text-sky-700">{availableTransferStock}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={availableTransferStock || 1}
                    value={transferQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setTransferQuantity(val);
                    }}
                    disabled={sourceBranchProducts.length === 0}
                    className="w-32 px-3.5 py-2 bg-slate-50 border border-slate-250 rounded-xl font-mono font-extrabold text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />

                  {/* Helper Chips */}
                  {availableTransferStock > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setTransferQuantity(1)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] cursor-pointer"
                      >
                        1
                      </button>
                      {availableTransferStock >= 5 && (
                        <button
                          type="button"
                          onClick={() => setTransferQuantity(5)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          5
                        </button>
                      )}
                      {availableTransferStock >= 10 && (
                        <button
                          type="button"
                          onClick={() => setTransferQuantity(10)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          10
                        </button>
                      )}
                      {availableTransferStock >= 2 && (
                        <button
                          type="button"
                          onClick={() => setTransferQuantity(Math.floor(availableTransferStock / 2))}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          Mitad ({Math.floor(availableTransferStock / 2)})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setTransferQuantity(availableTransferStock)}
                        className="px-2 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg font-bold text-[10px] cursor-pointer"
                      >
                        Todo ({availableTransferStock})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Notes / Reason */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 text-[11px]">
                  Motivo / Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Reabastecimiento de inventario, solicitud de cliente, etc."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsTransferModalOpen(false);
                    setTransferErrorMessage(null);
                    setTransferSuccessMessage(null);
                  }}
                  disabled={isTransferring}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isTransferring || 
                    sourceBranchProducts.length === 0 || 
                    !selectedTransferProduct || 
                    transferQuantity <= 0 || 
                    transferQuantity > availableTransferStock
                  }
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl cursor-pointer text-xs flex items-center gap-2 shadow-sm transition-all active:scale-98"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transfiriendo...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Confirmar y Transferir Stock</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
