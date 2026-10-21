import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Product, 
  Client, 
  AppConfig, 
  User, 
  Quotation, 
  QuotationItem, 
  QuotationStatus, 
  Consignment, 
  ConsignmentItem, 
  ConsignmentLog 
} from '../types';
import * as api from '../api';
import { 
  FileText, 
  Plus, 
  Search, 
  Printer, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  Calendar, 
  User as UserIcon, 
  Phone, 
  DollarSign, 
  Check, 
  X, 
  RefreshCw, 
  Package, 
  Truck, 
  Info, 
  MessageCircle,
  Share2,
  FileCheck,
  Building2,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';

interface QuotationsProps {
  products: Product[];
  clients: Client[];
  config: AppConfig;
  user: User | null;
  activeBranch?: string;
  currency?: string;
  onNavigateToPOS?: (items?: { product: Product; quantity: number; customPrice?: number }[], client?: Client) => void;
  onClientCreated?: (newClient: Client) => void;
  onBackToPOS?: () => void;
}

export default function Quotations({
  products,
  clients,
  config,
  user,
  activeBranch,
  currency = 'Q',
  onNavigateToPOS,
  onClientCreated,
  onBackToPOS
}: QuotationsProps) {
  // Main Tab: 'quotations' | 'consignments'
  const [activeMainTab, setActiveMainTab] = useState<'quotations' | 'consignments'>('quotations');

  // Quotations List State
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuotationStatus>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'expired'>('all');

  // Modals state
  const [isNewQuoteModalOpen, setIsNewQuoteModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quotation | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Quotation | null>(null);

  // Consignment Modals state
  const [isNewConsignmentModalOpen, setIsNewConsignmentModalOpen] = useState(false);
  const [viewingConsignment, setViewingConsignment] = useState<Consignment | null>(null);
  const [consignActionModal, setConsignActionModal] = useState<{
    type: 'return' | 'sell';
    consignment: Consignment;
    item: ConsignmentItem;
  } | null>(null);
  const [actionQuantity, setActionQuantity] = useState(1);
  const [actionNotes, setActionNotes] = useState('');

  // Quick Client Creation inside Quote Form
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientNit, setQuickClientNit] = useState('');
  const [quickClientAddress, setQuickClientAddress] = useState('');

  // New/Edit Quote Form State
  const [formCorrelative, setFormCorrelative] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formExpirationDate, setFormExpirationDate] = useState('');
  const [formClientId, setFormClientId] = useState<string>('general');
  const [formClientName, setFormClientName] = useState('');
  const [formClientNit, setFormClientNit] = useState('');
  const [formClientPhone, setFormClientPhone] = useState('');
  const [formClientEmail, setFormClientEmail] = useState('');
  const [formClientAddress, setFormClientAddress] = useState('');
  const [formEmailChips, setFormEmailChips] = useState<string[]>([]);
  const [formEmailInput, setFormEmailInput] = useState('');
  const [formItems, setFormItems] = useState<QuotationItem[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formTerms, setFormTerms] = useState(
    '1. Precios válidos hasta la fecha de vencimiento.\n2. Precios expresados en moneda nacional.\n3. Tiempo de entrega: Inmediato / sujeto a existencias.\n4. Forma de pago: Contado / Transferencia acordada.'
  );
  const [formStatus, setFormStatus] = useState<QuotationStatus>('vigente');
  const [formIsConsignment, setFormIsConsignment] = useState(false);
  const [formTaxRate, setFormTaxRate] = useState<number>(0);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);

  // Feedback notifications
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const showAlert = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setAlertMessage({ text, type });
    setTimeout(() => {
      setAlertMessage(null);
    }, 4000);
  };

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [quotesData, consData] = await Promise.all([
        api.getQuotations(),
        api.getConsignments()
      ]);
      setQuotations(quotesData);
      setConsignments(consData);
    } catch (err) {
      console.error('Error loading quotations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update dynamic status based on expiration date
  const processedQuotations = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return quotations.map(q => {
      // If it's already 'convertida', keep it
      if (q.status === 'convertida' || q.status === 'aceptada') {
        return q;
      }
      // If expiration date passed and it was 'vigente' or 'borrador'
      if (q.expirationDate && q.expirationDate < todayStr && q.status !== 'borrador') {
        return { ...q, status: 'vencida' as QuotationStatus };
      }
      return q;
    });
  }, [quotations]);

  // Next Correlative generator
  const getNextCorrelative = () => {
    const numbers = quotations
      .map(q => {
        const match = q.correlative.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `COT-${String(maxNum + 1).padStart(4, '0')}`;
  };

  const getNextConsignmentCorrelative = () => {
    const numbers = consignments
      .map(c => {
        const match = c.correlative.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `CSG-${String(maxNum + 1).padStart(4, '0')}`;
  };

  // Open New Quote Modal
  const handleOpenNewQuote = (initialItems?: QuotationItem[], initialClient?: Client) => {
    const today = new Date();
    const expDate = new Date();
    expDate.setDate(today.getDate() + 15);

    setEditingQuote(null);
    setFormCorrelative(getNextCorrelative());
    setFormDate(today.toISOString().split('T')[0]);
    setFormExpirationDate(expDate.toISOString().split('T')[0]);
    setFormClientId(initialClient ? initialClient.id : 'general');
    setFormClientName(initialClient ? initialClient.name : 'Cliente General');
    setFormClientNit(initialClient?.nit || '');
    setFormClientPhone(initialClient?.phone || '');
    setFormClientEmail(initialClient?.email || '');
    setFormClientAddress(initialClient?.address || '');
    setFormEmailChips(initialClient?.email ? [initialClient.email] : []);
    setFormEmailInput('');
    setFormItems(initialItems && initialItems.length > 0 ? initialItems : []);
    setFormNotes('');
    setFormTerms(
      '1. Precios válidos hasta la fecha de vencimiento.\n2. Precios en Quetzales e incluyen impuestos de ley.\n3. Tiempo de entrega: Inmediato / sujeto a existencias.\n4. Forma de pago: Contado / Transferencia acordada.'
    );
    setFormStatus('vigente');
    setFormIsConsignment(false);
    setFormTaxRate(0);
    setProductSearchTerm('');
    setProductSearchResults([]);
    setIsNewQuoteModalOpen(true);
  };

  const closeQuoteModal = () => {
    setIsNewQuoteModalOpen(false);
    setEditingQuote(null);
  };

  // Open Edit Quote Modal
  const handleOpenEditQuote = (quote: Quotation) => {
    if (!quote) return;
    setEditingQuote(quote);
    setFormCorrelative(quote.correlative || quote.id || getNextCorrelative());
    const validDate = quote.date || (quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormDate(validDate);
    setFormExpirationDate(quote.expirationDate || '');
    setFormClientId(quote.clientId || 'general');
    setFormClientName(quote.clientName || 'Cliente General');
    setFormClientNit(quote.clientNit || '');
    setFormClientPhone(quote.clientPhone || '');
    setFormClientEmail(quote.clientEmail || '');
    setFormClientAddress(quote.clientAddress || '');
    setFormEmailChips(Array.isArray(quote.emails) ? [...quote.emails] : (quote.clientEmail ? [quote.clientEmail] : []));
    setFormEmailInput('');
    setFormItems(Array.isArray(quote.items) ? quote.items.map(it => {
      const prodObj = (it as any).product;
      const name = it.name || prodObj?.name || 'Producto';
      const code = it.code || prodObj?.code || '';
      const unitPrice = typeof it.unitPrice === 'number' && !isNaN(it.unitPrice)
        ? it.unitPrice
        : (typeof (it as any).customPrice === 'number'
            ? (it as any).customPrice
            : (typeof (it as any).price === 'number'
                ? (it as any).price
                : (prodObj?.price || 0)));
      const quantity = typeof it.quantity === 'number' && !isNaN(it.quantity) ? it.quantity : 1;
      const subtotal = typeof it.subtotal === 'number' && !isNaN(it.subtotal) ? it.subtotal : (quantity * unitPrice);
      return {
        productId: it.productId || prodObj?.id || `prod_${Date.now()}_${Math.random()}`,
        name,
        code,
        category: it.category || prodObj?.category || 'General',
        unit: it.unit || prodObj?.unit || 'Pza',
        quantity,
        unitPrice,
        cost: it.cost || prodObj?.cost || 0,
        discountPercent: it.discountPercent || 0,
        discountAmount: it.discountAmount || 0,
        subtotal,
        selectedLote: it.selectedLote
      };
    }) : []);
    setFormNotes(quote.notes || '');
    setFormTerms(quote.termsAndConditions || '1. Precios válidos hasta la fecha de vencimiento.\n2. Precios en Quetzales e incluyen impuestos de ley.\n3. Tiempo de entrega: Inmediato / sujeto a existencias.\n4. Forma de pago: Contado / Transferencia acordada.');
    setFormStatus(quote.status || 'vigente');
    setFormIsConsignment(Boolean(quote.isConsignment));
    setFormTaxRate(typeof quote.taxRate === 'number' ? quote.taxRate : 0);
    setProductSearchTerm('');
    setProductSearchResults([]);
    setIsNewQuoteModalOpen(true);
    setViewingQuote(null);
  };

  // Handle Client selection in quote form
  const handleClientSelect = (clientId: string) => {
    setFormClientId(clientId);
    if (clientId === 'general') {
      setFormClientName('Cliente General');
      setFormClientNit('');
      setFormClientPhone('');
      setFormClientEmail('');
      setFormClientAddress('');
      return;
    }
    const c = clients.find(item => item.id === clientId);
    if (c) {
      setFormClientName(c.name);
      setFormClientNit(c.nit || '');
      setFormClientPhone(c.phone || '');
      setFormClientEmail(c.email || '');
      setFormClientAddress(c.address || '');
      if (c.email && !formEmailChips.includes(c.email)) {
        setFormEmailChips(prev => [...prev, c.email]);
      }
    }
  };

  // Quick Client Creation Submit
  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientName.trim()) {
      alert('Ingrese el nombre del cliente');
      return;
    }

    try {
      const newClient: Client = {
        id: `cli_${Date.now()}`,
        name: quickClientName.trim(),
        phone: quickClientPhone.trim(),
        email: quickClientEmail.trim(),
        nit: quickClientNit.trim(),
        address: quickClientAddress.trim(),
        balanceCredit: 0,
        limitCredit: 0,
        branch: activeBranch
      };

      await api.saveClient(newClient);
      if (onClientCreated) {
        onClientCreated(newClient);
      }

      setFormClientId(newClient.id);
      setFormClientName(newClient.name);
      setFormClientNit(newClient.nit || '');
      setFormClientPhone(newClient.phone || '');
      setFormClientEmail(newClient.email || '');
      setFormClientAddress(newClient.address || '');
      if (newClient.email) {
        setFormEmailChips(prev => [...prev, newClient.email]);
      }

      setIsQuickClientOpen(false);
      setQuickClientName('');
      setQuickClientPhone('');
      setQuickClientEmail('');
      setQuickClientNit('');
      setQuickClientAddress('');
      showAlert('Cliente registrado correctamente');
    } catch (err: any) {
      alert('Error al registrar cliente: ' + err.message);
    }
  };

  // Email chip additions
  const handleAddEmailChip = () => {
    const trimmed = formEmailInput.trim();
    if (!trimmed) return;
    if (!formEmailChips.includes(trimmed)) {
      setFormEmailChips(prev => [...prev, trimmed]);
    }
    setFormEmailInput('');
  };

  const handleRemoveEmailChip = (email: string) => {
    setFormEmailChips(prev => prev.filter(e => e !== email));
  };

  // Product Search for Quote Form
  const handleProductSearch = (term: string) => {
    setProductSearchTerm(term);
    if (!term.trim()) {
      setProductSearchResults([]);
      return;
    }
    const clean = term.toLowerCase().trim();
    const results = products.filter(p => 
      p.name.toLowerCase().includes(clean) ||
      p.code.toLowerCase().includes(clean) ||
      (p.barcode && p.barcode.toLowerCase().includes(clean))
    ).slice(0, 8);
    setProductSearchResults(results);
  };

  // Add Product to Quote Form
  const handleAddProductToQuote = (prod: Product) => {
    const existingIndex = formItems.findIndex(it => it.productId === prod.id);
    if (existingIndex >= 0) {
      setFormItems(prev => prev.map((it, idx) => {
        if (idx === existingIndex) {
          const newQty = it.quantity + 1;
          const sub = (newQty * it.unitPrice) - (it.discountAmount || 0);
          return { ...it, quantity: newQty, subtotal: Math.max(0, sub) };
        }
        return it;
      }));
    } else {
      const newItem: QuotationItem = {
        productId: prod.id,
        name: prod.name,
        code: prod.code,
        category: prod.category,
        unit: prod.unit || 'Pza',
        quantity: 1,
        unitPrice: prod.price,
        cost: prod.cost,
        discountPercent: 0,
        discountAmount: 0,
        subtotal: prod.price
      };
      setFormItems(prev => [...prev, newItem]);
    }
    setProductSearchTerm('');
    setProductSearchResults([]);
  };

  // Update Item in Quote Form
  const handleUpdateItem = (index: number, updates: Partial<QuotationItem>) => {
    setFormItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      const updated = { ...it, ...updates };
      const gross = updated.quantity * updated.unitPrice;
      let disc = 0;
      if (updated.discountPercent && updated.discountPercent > 0) {
        disc = (gross * updated.discountPercent) / 100;
        updated.discountAmount = disc;
      } else if (updated.discountAmount) {
        disc = updated.discountAmount;
      }
      updated.subtotal = Math.max(0, gross - disc);
      return updated;
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Calculated Totals for Form
  const formTotals = useMemo(() => {
    const subtotal = formItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
    const discountTotal = formItems.reduce((acc, it) => acc + (it.discountAmount || 0), 0);
    const taxableSubtotal = Math.max(0, subtotal - discountTotal);
    const taxTotal = (taxableSubtotal * (formTaxRate || 0)) / 100;
    const total = taxableSubtotal + taxTotal;
    return { subtotal, discountTotal, taxTotal, total };
  }, [formItems, formTaxRate]);

  // Save Quotation (without generating a sale or deducting inventory)
  const handleSaveQuotation = async (andPrint = false) => {
    if (formItems.length === 0) {
      alert('Debe agregar al menos un producto a la cotización.');
      return;
    }
    if (!formClientName.trim()) {
      alert('Debe ingresar el nombre del cliente.');
      return;
    }

    try {
      const isEditing = Boolean(editingQuote);
      const quoteId = editingQuote?.id || `COT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
      const quoteCorrelative = formCorrelative.trim() || (editingQuote?.correlative || getNextCorrelative());

      const quoteToSave: Quotation = {
        id: quoteId,
        correlative: quoteCorrelative,
        clientId: formClientId,
        clientName: formClientName.trim(),
        clientNit: formClientNit.trim(),
        clientPhone: formClientPhone.trim(),
        clientEmail: formClientEmail.trim(),
        clientAddress: formClientAddress.trim(),
        emails: formEmailChips,
        date: formDate || new Date().toISOString().split('T')[0],
        expirationDate: formExpirationDate,
        items: formItems,
        subtotal: formTotals.subtotal,
        discountTotal: formTotals.discountTotal,
        taxRate: formTaxRate,
        taxTotal: formTotals.taxTotal,
        total: formTotals.total,
        currency: currency,
        status: formStatus,
        notes: formNotes,
        termsAndConditions: formTerms,
        isConsignment: formIsConsignment,
        branch: activeBranch || config.activeBranchId || 'Principal',
        operatorId: (user as any)?.operatorId || user?.id,
        operatorName: user?.name || 'Vendedor',
        createdAt: editingQuote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const saved = await api.saveQuotation(quoteToSave);

      // Instant local state update
      setQuotations(prev => {
        const idx = prev.findIndex(q => q.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      if (viewingQuote?.id === saved.id) {
        setViewingQuote(saved);
      }

      // Also if marked as consignment and is newly created, create consignment record
      if (formIsConsignment && !editingQuote) {
        const consItems: ConsignmentItem[] = formItems.map(it => ({
          productId: it.productId,
          name: it.name,
          code: it.code,
          unit: it.unit,
          price: it.unitPrice,
          cost: it.cost || 0,
          quantityDelivered: it.quantity,
          quantityReturned: 0,
          quantitySold: 0,
          quantityPending: it.quantity
        }));

        const newConsignment: Consignment = {
          id: `CSG-${Date.now().toString(36).toUpperCase()}`,
          correlative: getNextConsignmentCorrelative(),
          clientId: formClientId,
          clientName: formClientName,
          clientPhone: formClientPhone,
          clientEmail: formClientEmail,
          clientNit: formClientNit,
          date: formDate,
          dueDate: formExpirationDate,
          status: 'activa',
          items: consItems,
          totalDeliveredValue: formTotals.total,
          totalPendingValue: formTotals.total,
          notes: formNotes,
          branch: activeBranch || config.activeBranchId || 'Principal',
          operatorId: (user as any)?.operatorId || user?.id,
          operatorName: user?.name,
          createdAt: new Date().toISOString(),
          logs: [
            {
              id: `log_${Date.now()}`,
              date: new Date().toISOString(),
              type: 'entrega',
              productId: 'ALL',
              productName: 'Entrega inicial de productos en consignación',
              quantity: formItems.reduce((acc, it) => acc + it.quantity, 0),
              notes: `Correlativo Proforma: ${quoteToSave.correlative}`
            }
          ]
        };

        await api.saveConsignment(newConsignment);
      }

      closeQuoteModal();
      showAlert(
        isEditing 
          ? `Cotización ${saved.correlative} actualizada correctamente` 
          : `Cotización ${saved.correlative} guardada exitosamente`
      );

      if (andPrint) {
        handlePrintQuotation(saved);
      }
    } catch (err: any) {
      alert('Error al guardar la cotización: ' + (err.message || String(err)));
    }
  };

  // Delete Quotation
  const handleDeleteQuotation = async (quote: Quotation) => {
    if (!confirm(`¿Está seguro de eliminar la cotización ${quote.correlative}?`)) {
      return;
    }
    try {
      await api.deleteQuotation(quote.id);
      setQuotations(prev => prev.filter(q => q.id !== quote.id));
      if (viewingQuote?.id === quote.id) {
        setViewingQuote(null);
      }
      showAlert(`Cotización ${quote.correlative} eliminada`);
    } catch (err: any) {
      alert('Error al eliminar: ' + (err.message || String(err)));
    }
  };

  // Duplicate Quotation
  const handleDuplicateQuotation = (quote: Quotation) => {
    const today = new Date();
    const expDate = new Date();
    expDate.setDate(today.getDate() + 15);

    setEditingQuote(null);
    setFormCorrelative(getNextCorrelative());
    setFormDate(today.toISOString().split('T')[0]);
    setFormExpirationDate(expDate.toISOString().split('T')[0]);
    setFormClientId(quote.clientId || 'general');
    setFormClientName(quote.clientName);
    setFormClientNit(quote.clientNit || '');
    setFormClientPhone(quote.clientPhone || '');
    setFormClientEmail(quote.clientEmail || '');
    setFormClientAddress(quote.clientAddress || '');
    setFormEmailChips(quote.emails || []);
    setFormEmailInput('');
    setFormItems(Array.isArray(quote.items) ? quote.items.map(it => ({ ...it })) : []);
    setFormNotes(quote.notes || '');
    setFormTerms(quote.termsAndConditions || '');
    setFormStatus('borrador');
    setFormIsConsignment(Boolean(quote.isConsignment));
    setFormTaxRate(quote.taxRate || 0);
    setIsNewQuoteModalOpen(true);
    setViewingQuote(null);
    showAlert(`Copia creada en borrador. Revise y guarde.`);
  };

  // Convert Quotation to Sale (Loads in POS or triggers sale)
  const handleConvertToSale = async (quote: Quotation) => {
    if (quote.status === 'convertida') {
      alert('Esta cotización ya fue convertida en una venta previamente.');
      return;
    }

    const matchedClient = clients.find(c => c.id === quote.clientId);
    
    // Map items to products
    const posItems = (quote.items || []).map(it => {
      const prod = products.find(p => p.id === it.productId) || {
        id: it.productId,
        name: it.name,
        code: it.code || '',
        category: it.category || 'General',
        price: it.unitPrice,
        cost: it.cost || 0,
        stock: 999,
        minStock: 1,
        unit: it.unit || 'Pza'
      } as Product;

      return {
        product: prod,
        quantity: it.quantity,
        customPrice: it.unitPrice
      };
    });

    if (onNavigateToPOS) {
      // Mark as converted
      const updatedQuote: Quotation = {
        ...quote,
        status: 'convertida',
        convertedAt: new Date().toISOString()
      };
      await api.saveQuotation(updatedQuote);
      await loadData();
      setViewingQuote(null);
      showAlert(`Cotización convertida. Cargando productos al Punto de Venta...`, 'success');
      onNavigateToPOS(posItems, matchedClient);
    } else {
      alert('No se puede redirigir al Punto de Venta en este momento.');
    }
  };

  // Change Status
  const handleUpdateStatus = async (quote: Quotation, newStatus: QuotationStatus) => {
    try {
      const updated: Quotation = {
        ...quote,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      await api.saveQuotation(updated);
      await loadData();
      if (viewingQuote?.id === quote.id) {
        setViewingQuote(updated);
      }
      showAlert(`Estado cambiado a ${newStatus}`);
    } catch (err: any) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  // Professional PDF / Print Generator
  const handlePrintQuotation = (quote: Quotation) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Ventana emergente bloqueada por el navegador. Permita ventanas emergentes para imprimir o generar PDF.');
      return;
    }

    const itemsRows = (quote.items || []).map((item, idx) => {
      const gross = (item.quantity || 1) * (item.unitPrice || 0);
      const disc = item.discountAmount || 0;
      return `
        <tr>
          <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace; color: #475569; font-size: 11px;">${item.code || '—'}</td>
          <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0;">
            <strong style="color: #0f172a; font-size: 12px;">${item.name}</strong>
            ${item.selectedLote ? `<div style="font-size: 10px; color: #64748b;">Lote: ${item.selectedLote}</div>` : ''}
          </td>
          <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${item.quantity} ${item.unit || 'Pza'}</td>
          <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${quote.currency}${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #dc2626;">${disc > 0 ? `-${quote.currency}${disc.toFixed(2)}` : '—'}</td>
          <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">${quote.currency}${item.subtotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const formattedDate = new Date(quote.date + 'T00:00:00').toLocaleDateString('es-GT', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const formattedExpDate = quote.expirationDate 
      ? new Date(quote.expirationDate + 'T00:00:00').toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'No definida';

    const statusBadgeText = {
      borrador: 'BORRADOR',
      vigente: 'COTIZACIÓN VIGENTE',
      vencida: 'COTIZACIÓN VENCIDA',
      aceptada: 'ACEPTADA POR CLIENTE',
      convertida: 'CONVERTIDA EN VENTA'
    }[quote.status] || quote.status.toUpperCase();

    const statusColor = {
      borrador: '#64748b',
      vigente: '#16a34a',
      vencida: '#dc2626',
      aceptada: '#2563eb',
      convertida: '#9333ea'
    }[quote.status] || '#2563eb';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${quote.correlative} - ${config.storeName || 'YAA POS'}</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              padding: 36px; 
              color: #1e293b; 
              background: #ffffff; 
              max-width: 840px; 
              margin: 0 auto; 
            }
            .header-table { width: 100%; border-bottom: 3px solid #1e74bd; padding-bottom: 18px; margin-bottom: 24px; }
            .brand-name { font-size: 24px; font-weight: 800; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .brand-sub { font-size: 11.5px; color: #64748b; margin: 4px 0 0 0; line-height: 1.4; }
            .correlative-badge { 
              background: #eff6ff; 
              color: #1e40af; 
              border: 1.5px solid #bfdbfe; 
              padding: 6px 14px; 
              border-radius: 8px; 
              font-size: 14px; 
              font-weight: 800; 
              display: inline-block; 
              font-family: monospace; 
              letter-spacing: 0.5px; 
            }
            .status-pill {
              display: inline-block;
              margin-top: 6px;
              padding: 3px 10px;
              border-radius: 9999px;
              font-size: 10.5px;
              font-weight: 700;
              color: #fff;
              background-color: ${statusColor};
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: 1.2fr 1fr; 
              gap: 16px; 
              background: #f8fafc; 
              border: 1px solid #e2e8f0; 
              border-radius: 10px; 
              padding: 14px 18px; 
              font-size: 12px; 
              margin-bottom: 22px; 
            }
            .info-row { margin-bottom: 4px; display: flex; }
            .info-label { font-weight: 700; color: #475569; width: 100px; shrink: 0; }
            .info-val { color: #0f172a; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11.5px; }
            th { 
              background: #f1f5f9; 
              color: #334155; 
              font-weight: 700; 
              padding: 10px 8px; 
              text-align: left; 
              border-bottom: 2px solid #cbd5e1; 
              text-transform: uppercase; 
              font-size: 10.5px; 
              letter-spacing: 0.5px; 
            }
            .totals-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
            .totals-box { width: 300px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; font-size: 12px; }
            .tot-row { display: flex; justify-content: space-between; padding: 3px 0; color: #475569; }
            .tot-grand { 
              display: flex; 
              justify-content: space-between; 
              border-top: 2px solid #cbd5e1; 
              padding-top: 8px; 
              margin-top: 6px; 
              font-size: 16px; 
              font-weight: 800; 
              color: #0f172a; 
            }
            .section-box { 
              margin-top: 20px; 
              border: 1px solid #e2e8f0; 
              border-radius: 8px; 
              padding: 12px; 
              font-size: 11px; 
              background: #fafafa; 
            }
            .section-title { font-weight: 700; color: #334155; margin-bottom: 4px; text-transform: uppercase; font-size: 10.5px; }
            .section-content { color: #475569; white-space: pre-line; line-height: 1.45; }
            .signatures { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; text-align: center; font-size: 11px; color: #64748b; }
            .sig-line { border-top: 1px solid #94a3b8; padding-top: 6px; }
            .footer-note { text-align: center; margin-top: 36px; font-size: 10px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 12px; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.2cm; size: auto; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align: top;">
                <h1 class="brand-name">${config.storeName || 'YAA POS'}</h1>
                <p class="brand-sub">
                  ${config.razonSocial ? `<strong>${config.razonSocial}</strong><br/>` : ''}
                  ${config.nit ? `NIT: ${config.nit}<br/>` : ''}
                  ${config.address || 'Guatemala'}<br/>
                  ${config.phone ? `Tel: ${config.phone}` : ''} ${config.email ? `| Email: ${config.email}` : ''}
                </p>
                ${quote.isConsignment ? '<div style="margin-top:6px; background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:700; display:inline-block; border:1px solid #fde68a;">★ PROFORMA DE CONSIGNACIÓN</div>' : ''}
              </td>
              <td style="text-align: right; vertical-align: top;">
                <div class="correlative-badge">${quote.correlative}</div>
                <div><span class="status-pill">${statusBadgeText}</span></div>
                <div style="font-size: 11px; color: #64748b; margin-top: 8px;"><strong>Fecha Emisión:</strong> ${formattedDate}</div>
                <div style="font-size: 11px; color: #b91c1c; margin-top: 3px;"><strong>Válida Hasta:</strong> ${formattedExpDate}</div>
              </td>
            </tr>
          </table>

          <div class="info-grid">
            <div>
              <div class="info-row"><span class="info-label">Cliente:</span> <span class="info-val"><strong>${quote.clientName || 'Consumidor Final'}</strong></span></div>
              <div class="info-row"><span class="info-label">NIT / DPI:</span> <span class="info-val">${quote.clientNit || 'C/F'}</span></div>
              <div class="info-row"><span class="info-label">Teléfono:</span> <span class="info-val">${quote.clientPhone || '—'}</span></div>
              <div class="info-row"><span class="info-label">Dirección:</span> <span class="info-val">${quote.clientAddress || '—'}</span></div>
              ${quote.emails && quote.emails.length > 0 ? `<div class="info-row"><span class="info-label">Email(s):</span> <span class="info-val">${quote.emails.join(', ')}</span></div>` : ''}
            </div>
            <div>
              <div class="info-row"><span class="info-label">Sucursal:</span> <span class="info-val">${quote.branch || 'Principal'}</span></div>
              <div class="info-row"><span class="info-label">Atendido por:</span> <span class="info-val">${quote.operatorName || 'Asesor Comercial'}</span></div>
              <div class="info-row"><span class="info-label">Modalidad:</span> <span class="info-val">${quote.isConsignment ? 'Consignación' : 'Cotización Estándar'}</span></div>
              <div class="info-row"><span class="info-label">Moneda:</span> <span class="info-val">${quote.currency === 'Q' ? 'Quetzales (Q)' : quote.currency}</span></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th style="width: 85px; text-align: center;">Código</th>
                <th>Descripción del Producto</th>
                <th style="width: 80px; text-align: center;">Cant.</th>
                <th style="width: 90px; text-align: right;">Precio U.</th>
                <th style="width: 80px; text-align: right;">Desc.</th>
                <th style="width: 95px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals-wrap">
            <div class="totals-box">
              <div class="tot-row">
                <span>Subtotal:</span>
                <span style="font-family: monospace;">${quote.currency}${quote.subtotal.toFixed(2)}</span>
              </div>
              ${quote.discountTotal > 0 ? `
                <div class="tot-row" style="color: #dc2626;">
                  <span>Descuento aplicado:</span>
                  <span style="font-family: monospace;">-${quote.currency}${quote.discountTotal.toFixed(2)}</span>
                </div>
              ` : ''}
              ${quote.taxTotal > 0 ? `
                <div class="tot-row">
                  <span>Impuestos / IVA (${quote.taxRate || 0}%):</span>
                  <span style="font-family: monospace;">+${quote.currency}${quote.taxTotal.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="tot-grand">
                <span>TOTAL:</span>
                <span style="font-family: monospace;">${quote.currency}${quote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          ${quote.notes ? `
            <div class="section-box">
              <div class="section-title">Observaciones / Notas</div>
              <div class="section-content">${quote.notes}</div>
            </div>
          ` : ''}

          ${quote.termsAndConditions ? `
            <div class="section-box" style="margin-top: 12px; background: #fffbeb; border-color: #fef3c7;">
              <div class="section-title" style="color: #92400e;">Términos y Condiciones</div>
              <div class="section-content" style="color: #78350f;">${quote.termsAndConditions}</div>
            </div>
          ` : ''}

          <div class="signatures">
            <div>
              <div class="sig-line">Emitido por: ${quote.operatorName || config.storeName}</div>
              <div style="font-size: 9.5px; color: #94a3b8; margin-top: 3px;">Firma / Sello autorizado</div>
            </div>
            <div>
              <div class="sig-line">Aceptado por: ${quote.clientName}</div>
              <div style="font-size: 9.5px; color: #94a3b8; margin-top: 3px;">Firma de conformidad</div>
            </div>
          </div>

          <div class="footer-note">
            Este documento constituye una cotización formal y no representa una factura ni compromiso de compra definitiva. Precios sujetos a vigencia indicada.<br/>
            Generado por Yaa POS • Sistema Punto de Venta
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Email quote integration (mailto link + copy message)
  const handleSendEmail = (quote: Quotation) => {
    const recipients = quote.emails && quote.emails.length > 0 
      ? quote.emails.join(',') 
      : (quote.clientEmail || '');

    const itemsSummary = (quote.items || [])
      .map(it => `• ${it.quantity}x ${it.name} - ${quote.currency}${it.subtotal.toFixed(2)}`)
      .join('\n');

    const subject = encodeURIComponent(`Cotización ${quote.correlative} - ${config.storeName || 'YAA POS'}`);
    const body = encodeURIComponent(
      `Estimado(a) ${quote.clientName},\n\n` +
      `Le enviamos la cotización solicitada ${quote.correlative} emitida por ${config.storeName || 'nuestra empresa'}.\n\n` +
      `DETALLE DE PRODUCTOS:\n` +
      `${itemsSummary}\n\n` +
      `TOTAL COTIZADO: ${quote.currency}${quote.total.toFixed(2)}\n` +
      `VIGENCIA: Hasta el ${quote.expirationDate || '15 días'}\n\n` +
      `${quote.notes ? `OBSERVACIONES:\n${quote.notes}\n\n` : ''}` +
      `Quedamos a su entera disposición para cualquier consulta.\n\n` +
      `Atentamente,\n${quote.operatorName || 'Equipo de Ventas'}\n${config.storeName || ''}\n${config.phone || ''}`
    );

    const mailtoUrl = `mailto:${recipients}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
    showAlert('Abriendo cliente de correo para enviar la cotización', 'info');
  };

  // WhatsApp share
  const handleShareWhatsApp = (quote: Quotation) => {
    const phone = (quote.clientPhone || '').replace(/\D/g, '');
    const itemsSummary = (quote.items || [])
      .map(it => `* ${it.quantity}x ${it.name} (${quote.currency}${it.subtotal.toFixed(2)})`)
      .join('%0A');

    const text = 
      `*COTIZACIÓN ${quote.correlative} - ${encodeURIComponent(config.storeName || 'YAA POS')}*%0A%0A` +
      `Hola *${encodeURIComponent(quote.clientName)}*, adjuntamos el detalle de su cotización:%0A%0A` +
      `${itemsSummary}%0A%0A` +
      `*TOTAL:* ${quote.currency}${quote.total.toFixed(2)}%0A` +
      `*Válida hasta:* ${quote.expirationDate || '15 días'}%0A%0A` +
      `Gracias por su preferencia.`;

    const waUrl = phone 
      ? `https://wa.me/${phone}?text=${text}` 
      : `https://wa.me/?text=${text}`;

    window.open(waUrl, '_blank');
  };

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return processedQuotations.filter(q => {
      // Branch filter
      if (activeBranch && q.branch && q.branch !== activeBranch) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && q.status !== statusFilter) {
        return false;
      }
      // Date filter
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateFilter === 'today') {
        if (q.date !== todayStr) return false;
      } else if (dateFilter === 'expired') {
        if (q.status !== 'vencida') return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCorr = q.correlative.toLowerCase().includes(query);
        const matchesClient = q.clientName.toLowerCase().includes(query);
        const matchesNit = q.clientNit?.toLowerCase().includes(query);
        const matchesEmail = q.clientEmail?.toLowerCase().includes(query) || q.emails?.some(e => e.toLowerCase().includes(query));
        const matchesItem = (q.items || []).some(it => it.name?.toLowerCase().includes(query) || it.code?.toLowerCase().includes(query));
        return matchesCorr || matchesClient || matchesNit || matchesEmail || matchesItem;
      }
      return true;
    });
  }, [processedQuotations, activeBranch, statusFilter, dateFilter, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const totalCount = processedQuotations.length;
    const vigentes = processedQuotations.filter(q => q.status === 'vigente').length;
    const vencidas = processedQuotations.filter(q => q.status === 'vencida').length;
    const aceptadas = processedQuotations.filter(q => q.status === 'aceptada').length;
    const convertidas = processedQuotations.filter(q => q.status === 'convertida').length;
    const totalAmount = processedQuotations
      .filter(q => q.status !== 'borrador' && q.status !== 'vencida')
      .reduce((acc, q) => acc + q.total, 0);

    return { totalCount, vigentes, vencidas, aceptadas, convertidas, totalAmount };
  }, [processedQuotations]);

  // Consignments Management Helpers
  const handleOpenNewConsignment = () => {
    // Open new quotation modal with consignment flagged
    handleOpenNewQuote();
    setFormIsConsignment(true);
  };

  // Register consignment return or sale
  const handleProcessConsignmentAction = async () => {
    if (!consignActionModal) return;
    const { type, consignment, item } = consignActionModal;
    const qty = Math.max(1, Math.min(actionQuantity, item.quantityPending));

    try {
      const updatedItems = consignment.items.map(it => {
        if (it.productId !== item.productId) return it;
        if (type === 'return') {
          const newRet = it.quantityReturned + qty;
          const newPend = Math.max(0, it.quantityDelivered - newRet - it.quantitySold);
          return { ...it, quantityReturned: newRet, quantityPending: newPend };
        } else {
          // type === 'sell'
          const newSold = it.quantitySold + qty;
          const newPend = Math.max(0, it.quantityDelivered - it.quantityReturned - newSold);
          return { ...it, quantitySold: newSold, quantityPending: newPend };
        }
      });

      const totalPending = updatedItems.reduce((acc, it) => acc + (it.quantityPending * it.price), 0);
      const isAllResolved = updatedItems.every(it => it.quantityPending === 0);
      const isAllReturned = updatedItems.every(it => it.quantityReturned === it.quantityDelivered);

      let newStatus = consignment.status;
      if (isAllReturned) {
        newStatus = 'devuelta_total';
      } else if (isAllResolved) {
        newStatus = 'liquidada_total';
      } else {
        newStatus = 'liquidada_parcial';
      }

      const newLog: ConsignmentLog = {
        id: `log_${Date.now()}`,
        date: new Date().toISOString(),
        type: type === 'return' ? 'devolucion' : 'venta',
        productId: item.productId,
        productName: item.name,
        quantity: qty,
        notes: actionNotes.trim() || (type === 'return' ? 'Devolución de mercancía' : 'Liquidación / Venta de producto')
      };

      const updatedConsignment: Consignment = {
        ...consignment,
        items: updatedItems,
        totalPendingValue: totalPending,
        status: newStatus,
        logs: [newLog, ...(consignment.logs || [])]
      };

      await api.saveConsignment(updatedConsignment);
      await loadData();
      setConsignActionModal(null);
      setActionQuantity(1);
      setActionNotes('');

      showAlert(
        type === 'return'
          ? `Devolución de ${qty} unidad(es) de ${item.name} registrada sin duplicar inventario.`
          : `Liquidación de ${qty} unidad(es) de ${item.name} registrada exitosamente.`
      );
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC]">
      
      {/* Alert toast notification */}
      {alertMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl border border-slate-700 animate-in fade-in duration-200">
          {alertMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
          {alertMessage.type === 'info' && <Info className="w-4 h-4 text-sky-400" />}
          {alertMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-[#1E74BD] rounded-xl border border-blue-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight">
                  Cotizaciones y Proformas
                </h1>
                <p className="text-xs text-[#64748B]">
                  Gestión integral de cotizaciones comerciales, proformas y control de consignaciones
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onBackToPOS && (
              <button
                type="button"
                onClick={onBackToPOS}
                className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Volver al Punto de Venta"
              >
                <span>Ir al POS</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenNewQuote()}
              className="h-9 px-4 bg-[#1E74BD] hover:bg-[#155e9c] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cotización</span>
            </button>
          </div>
        </div>

        {/* Tab switchers: Cotizaciones vs Consignaciones */}
        <div className="flex items-center gap-6 mt-4 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveMainTab('quotations')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeMainTab === 'quotations'
                ? 'border-[#1E74BD] text-[#1E74BD]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Cotizaciones y Proformas</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-[#1E74BD] font-bold">
              {processedQuotations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('consignments')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeMainTab === 'consignments'
                ? 'border-[#1E74BD] text-[#1E74BD]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Control de Consignaciones</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {consignments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 space-y-5 flex-1">

        {/* ========================================================================= */}
        {/* TAB 1: COTIZACIONES Y PROFORMAS */}
        {/* ========================================================================= */}
        {activeMainTab === 'quotations' && (
          <>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 block">Total Cotizaciones</span>
                <span className="text-lg font-bold text-slate-800 font-mono mt-0.5 block">{stats.totalCount}</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-emerald-600 block">Vigentes</span>
                <span className="text-lg font-bold text-emerald-700 font-mono mt-0.5 block">{stats.vigentes}</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-rose-600 block">Vencidas</span>
                <span className="text-lg font-bold text-rose-700 font-mono mt-0.5 block">{stats.vencidas}</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-blue-600 block">Aceptadas</span>
                <span className="text-lg font-bold text-blue-700 font-mono mt-0.5 block">{stats.aceptadas}</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-purple-600 block">Convertidas a Venta</span>
                <span className="text-lg font-bold text-purple-700 font-mono mt-0.5 block">{stats.convertidas}</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-3 rounded-xl shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 block">Monto Vigente</span>
                <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                  {currency}{stats.totalAmount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por número (COT-0001), cliente, NIT, correo o producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD] bg-slate-50/50"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status and Date Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="h-9 px-2.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="vigente">Vigente</option>
                    <option value="borrador">Borrador</option>
                    <option value="vencida">Vencida</option>
                    <option value="aceptada">Aceptada</option>
                    <option value="convertida">Convertida en venta</option>
                  </select>
                </div>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="h-9 px-2.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">Cualquier fecha</option>
                  <option value="today">Emitidas hoy</option>
                  <option value="expired">Solo vencidas</option>
                </select>

                <button
                  type="button"
                  onClick={loadData}
                  className="h-9 px-3 text-slate-600 hover:text-slate-900 border border-[#E2E8F0] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Recargar datos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>
            </div>

            {/* Quotations Table */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#475569] font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Correlativo</th>
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-3">Vencimiento</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-3">Items</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                          <p className="font-semibold text-slate-600">No se encontraron cotizaciones</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Haga clic en "+ Nueva Cotización" o genere una proforma desde el carrito del Punto de Venta.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredQuotations.map(quote => {
                        const isExpired = quote.status === 'vencida';
                        return (
                          <tr key={quote.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-[#1E74BD]">
                              <div className="flex items-center gap-1.5">
                                <span>{quote.correlative}</span>
                                {quote.isConsignment && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9.5px] font-bold">
                                    Consig.
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {quote.date || quote.createdAt.split('T')[0]}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className={`font-medium ${isExpired ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                                {quote.expirationDate || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{quote.clientName}</div>
                              <div className="text-[10px] text-slate-400">
                                {quote.clientNit ? `NIT: ${quote.clientNit}` : 'C/F'} 
                                {quote.clientPhone ? ` • Tel: ${quote.clientPhone}` : ''}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-semibold">
                              {(quote.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0)} unid.
                              <span className="text-[10px] text-slate-400 block font-normal">
                                ({(quote.items || []).length} productos)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {quote.currency}{quote.total.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {quote.status === 'vigente' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10.5px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" /> Vigente
                                </span>
                              )}
                              {quote.status === 'vencida' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[10.5px] font-bold">
                                  <Clock className="w-3 h-3" /> Vencida
                                </span>
                              )}
                              {quote.status === 'borrador' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10.5px] font-bold">
                                  Borrador
                                </span>
                              )}
                              {quote.status === 'aceptada' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10.5px] font-bold">
                                  <Check className="w-3 h-3" /> Aceptada
                                </span>
                              )}
                              {quote.status === 'convertida' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10.5px] font-bold">
                                  <FileCheck className="w-3 h-3" /> Convertida
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingQuote(quote)}
                                  className="p-1.5 text-slate-600 hover:text-[#1E74BD] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Ver detalle de cotización"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintQuotation(quote)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="Imprimir / PDF Profesional"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendEmail(quote)}
                                  className="p-1.5 text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                  title="Enviar por Correo"
                                >
                                  <Mail className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleShareWhatsApp(quote)}
                                  className="p-1.5 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                                  title="Compartir por WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                                {quote.status !== 'convertida' && (
                                  <button
                                    type="button"
                                    onClick={() => handleConvertToSale(quote)}
                                    className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                    title="Convertir en Venta (cargar en POS)"
                                  >
                                    <ArrowRight className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditQuote(quote)}
                                  className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar productos / condiciones"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuotation(quote)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar cotización"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CONTROL DE CONSIGNACIONES */}
        {/* ========================================================================= */}
        {activeMainTab === 'consignments' && (
          <div className="space-y-4">
            
            {/* Banner explicativo de consignaciones */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Truck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <strong className="block text-sm font-bold text-amber-950 mb-0.5">
                  Modalidad de Consignación Controlada
                </strong>
                Permite entregar productos a clientes o distribuidores para su venta posterior. 
                El sistema controla las cantidades <strong>entregadas</strong>, <strong>devueltas</strong> y <strong>vendidas/liquidadas</strong>, garantizando que los registros no generen movimientos duplicados ni descuadres contables en el inventario.
              </div>
            </div>

            {/* Consignments List */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Entregas en Consignación Registradas</h3>
                  <p className="text-xs text-slate-500">Supervise saldos pendientes y registre devoluciones o liquidaciones</p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenNewConsignment}
                  className="h-8 px-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Entrega en Consignación</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#475569] font-bold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Correlativo</th>
                      <th className="py-3 px-3">Fecha Entrega</th>
                      <th className="py-3 px-4">Cliente Receptor</th>
                      <th className="py-3 px-3 text-center">Entregados</th>
                      <th className="py-3 px-3 text-center">Devueltos</th>
                      <th className="py-3 px-3 text-center">Vendidos</th>
                      <th className="py-3 px-3 text-center">Pendientes</th>
                      <th className="py-3 px-4 text-right">Valor Pendiente</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consignments.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                          <p className="font-semibold text-slate-600">No hay entregas en consignación activas</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Cree una nueva consignación para empezar a controlar productos entregados y devueltos.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      consignments.map(c => {
                        const totalDelivered = c.items.reduce((acc, it) => acc + it.quantityDelivered, 0);
                        const totalReturned = c.items.reduce((acc, it) => acc + it.quantityReturned, 0);
                        const totalSold = c.items.reduce((acc, it) => acc + it.quantitySold, 0);
                        const totalPending = c.items.reduce((acc, it) => acc + it.quantityPending, 0);

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-amber-700">
                              {c.correlative}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {c.date || c.createdAt.split('T')[0]}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800">{c.clientName}</span>
                              {c.clientPhone && <span className="text-[10px] text-slate-400 block">Tel: {c.clientPhone}</span>}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-700">{totalDelivered}</td>
                            <td className="py-3 px-3 text-center font-bold text-rose-600">{totalReturned}</td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600">{totalSold}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                                totalPending > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {totalPending}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {currency}{c.totalPendingValue.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {c.status === 'activa' && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10.5px] font-bold">
                                  Activa
                                </span>
                              )}
                              {c.status === 'liquidada_parcial' && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[10.5px] font-bold">
                                  Liq. Parcial
                                </span>
                              )}
                              {c.status === 'liquidada_total' && (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10.5px] font-bold">
                                  Completada
                                </span>
                              )}
                              {c.status === 'devuelta_total' && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10.5px] font-bold">
                                  Devuelta
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingConsignment(c)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-md transition-colors cursor-pointer text-[11px]"
                                >
                                  Controlar Items
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: DETALLE DE COTIZACIÓN */}
      {/* ========================================================================= */}
      {viewingQuote && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-[#1E74BD] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-200" />
                <div>
                  <h3 className="text-sm font-bold tracking-wide text-white">
                    Cotización {viewingQuote.correlative}
                  </h3>
                  <span className="text-[11px] text-blue-100 font-normal">
                    Emitida el {viewingQuote.date || viewingQuote.createdAt.split('T')[0]} • Válida hasta {viewingQuote.expirationDate || '15 días'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingQuote(null)}
                className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Status and Action banner */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">Estado actual:</span>
                  <select
                    value={viewingQuote.status}
                    onChange={(e) => handleUpdateStatus(viewingQuote, e.target.value as any)}
                    className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 cursor-pointer focus:outline-hidden"
                  >
                    <option value="borrador">Borrador</option>
                    <option value="vigente">Vigente</option>
                    <option value="aceptada">Aceptada por Cliente</option>
                    <option value="vencida">Vencida</option>
                    <option value="convertida">Convertida en Venta</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintQuotation(viewingQuote)}
                    className="h-8 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Imprimir / PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConvertToSale(viewingQuote)}
                    className="h-8 px-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Convertir a Venta</span>
                  </button>
                </div>
              </div>

              {/* Client and document summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Datos del Cliente</span>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">{viewingQuote.clientName}</div>
                  <div className="text-slate-600 mt-1">NIT / DPI: {viewingQuote.clientNit || 'C/F'}</div>
                  {viewingQuote.clientPhone && <div className="text-slate-600">Tel: {viewingQuote.clientPhone}</div>}
                  {viewingQuote.clientEmail && <div className="text-slate-600">Email: {viewingQuote.clientEmail}</div>}
                  {viewingQuote.emails && viewingQuote.emails.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {viewingQuote.emails.map(em => (
                        <span key={em} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-medium">
                          {em}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Condiciones Generales</span>
                  <div className="text-slate-700 mt-1"><strong>Sucursal:</strong> {viewingQuote.branch || 'Principal'}</div>
                  <div className="text-slate-700"><strong>Vendedor:</strong> {viewingQuote.operatorName || 'Asesor Comercial'}</div>
                  <div className="text-slate-700"><strong>Modalidad:</strong> {viewingQuote.isConsignment ? 'Consignación' : 'Estándar'}</div>
                  <div className="text-slate-700"><strong>Vigencia:</strong> Hasta {viewingQuote.expirationDate || '15 días'}</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase">
                    <tr>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3 text-center">Cant.</th>
                      <th className="py-2 px-3 text-right">Precio</th>
                      <th className="py-2 px-3 text-right">Desc.</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingQuote.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{it.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Cód: {it.code || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {it.quantity} {it.unit || 'Pza'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {viewingQuote.currency}{it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {it.discountAmount ? `-${viewingQuote.currency}${it.discountAmount.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {viewingQuote.currency}{it.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-64 bg-slate-900 text-white p-3.5 rounded-xl space-y-1.5 shadow-md">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Subtotal:</span>
                    <span className="font-mono">{viewingQuote.currency}{viewingQuote.subtotal.toFixed(2)}</span>
                  </div>
                  {viewingQuote.discountTotal > 0 && (
                    <div className="flex justify-between text-xs text-rose-300">
                      <span>Descuento:</span>
                      <span className="font-mono">-{viewingQuote.currency}{viewingQuote.discountTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {viewingQuote.taxTotal > 0 && (
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>IVA / Impuestos:</span>
                      <span className="font-mono">+{viewingQuote.currency}{viewingQuote.taxTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-white border-t border-slate-700 pt-2 mt-1">
                    <span>Total:</span>
                    <span className="font-mono font-bold text-white">
                      {viewingQuote.currency}{viewingQuote.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              {viewingQuote.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">Observaciones:</span>
                  <p className="text-slate-600 whitespace-pre-line">{viewingQuote.notes}</p>
                </div>
              )}

              {viewingQuote.termsAndConditions && (
                <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                  <span className="font-bold text-amber-900 block mb-0.5">Términos y Condiciones:</span>
                  <p className="text-amber-800 whitespace-pre-line text-[11px]">{viewingQuote.termsAndConditions}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDuplicateQuotation(viewingQuote)}
                  className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditQuote(viewingQuote)}
                  className="px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSendEmail(viewingQuote)}
                  className="px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Enviar por Correo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(viewingQuote)}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NUEVA / EDITAR COTIZACIÓN */}
      {/* ========================================================================= */}
      {isNewQuoteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* Blue Banner Header */}
            <div className="bg-[#1E74BD] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-200" />
                <h3 className="text-sm font-bold tracking-wide text-white">
                  {editingQuote ? `Editar Cotización ${formCorrelative}` : 'Nueva Cotización / Proforma'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeQuoteModal}
                className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">

              {/* Total Banner Header in Solid Black */}
              <div className="bg-black text-white px-5 py-3.5 rounded-xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs sm:text-sm font-semibold tracking-wide text-slate-300 block">Total Cotizado</span>
                  <span className="text-[11px] text-slate-400">
                    {formItems.length} productos • {formItems.reduce((acc, it) => acc + (it.quantity || 1), 0)} unidades
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white">
                  {currency}{formTotals.total.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* General details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Número Correlativo</label>
                  <input
                    type="text"
                    value={formCorrelative}
                    onChange={(e) => setFormCorrelative(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold text-[#1E74BD] focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800">Fecha Vencimiento</label>
                    <div className="flex gap-1 text-[9.5px]">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setFormExpirationDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 bg-blue-100/70 hover:bg-blue-100 text-[#1E74BD] rounded font-bold cursor-pointer"
                        title="Vence en 7 días"
                      >
                        +7d
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 15);
                          setFormExpirationDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 bg-blue-100/70 hover:bg-blue-100 text-[#1E74BD] rounded font-bold cursor-pointer"
                        title="Vence en 15 días"
                      >
                        +15d
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 30);
                          setFormExpirationDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 bg-blue-100/70 hover:bg-blue-100 text-[#1E74BD] rounded font-bold cursor-pointer"
                        title="Vence en 30 días"
                      >
                        +30d
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={formExpirationDate}
                    onChange={(e) => setFormExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Estado de Cotización</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as QuotationStatus)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD] cursor-pointer"
                  >
                    <option value="vigente">Vigente</option>
                    <option value="borrador">Borrador</option>
                    <option value="aceptada">Aceptada</option>
                    <option value="vencida">Vencida</option>
                    <option value="convertida">Convertida en Venta</option>
                  </select>
                </div>
              </div>

              {/* Consignment Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setFormIsConsignment(!formIsConsignment)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    formIsConsignment ? 'bg-[#2563EB]' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={formIsConsignment}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      formIsConsignment ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-[#1F2937]">Proforma de consignación</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (Activa el control de productos entregados y devueltos sin duplicar movimientos de stock)
                </span>
              </div>

              {/* Client Section */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4 text-[#1E74BD]" />
                    <span>Asociar Cliente</span>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQuickClientOpen(!isQuickClientOpen)}
                      className="text-[11px] text-[#1E74BD] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isQuickClientOpen ? 'Ocultar registro' : '+ Registrar Nuevo Cliente'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Register New Client Box */}
                {isQuickClientOpen && (
                  <form onSubmit={handleQuickClientSubmit} className="bg-blue-50/70 p-3 rounded-lg border border-blue-200 space-y-2">
                    <span className="text-[11px] font-bold text-[#1E74BD] block">Nuevo Cliente Rápido</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nombre completo *"
                        value={quickClientName}
                        onChange={(e) => setQuickClientName(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-md text-xs font-medium"
                        required
                      />
                      <input
                        type="text"
                        placeholder="NIT o DPI (opcional)"
                        value={quickClientNit}
                        onChange={(e) => setQuickClientNit(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-md text-xs font-medium"
                      />
                      <input
                        type="tel"
                        placeholder="Teléfono"
                        value={quickClientPhone}
                        onChange={(e) => setQuickClientPhone(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-md text-xs font-medium"
                      />
                      <input
                        type="email"
                        placeholder="Correo electrónico"
                        value={quickClientEmail}
                        onChange={(e) => setQuickClientEmail(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-md text-xs font-medium"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsQuickClientOpen(false)}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-[#1E74BD] hover:bg-blue-700 text-white rounded-md text-xs font-bold cursor-pointer"
                      >
                        Guardar Cliente
                      </button>
                    </div>
                  </form>
                )}

                {/* Client dropdown & details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Seleccionar Cliente Existente</label>
                    <select
                      value={formClientId}
                      onChange={(e) => handleClientSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden"
                    >
                      <option value="general">Cliente General / Consumidor Final</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.nit ? `(NIT: ${c.nit})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nombre en el Documento</label>
                    <input
                      type="text"
                      value={formClientName}
                      onChange={(e) => setFormClientName(e.target.value)}
                      placeholder="Nombre del cliente"
                      className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Email Chip Input (Matching user screenshot) */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-[#1F2937]">Email(s) para envío de cotización</label>
                  
                  {/* Yellow Helper Box matching user screenshot */}
                  <div className="bg-[#FEF08A] text-[#854D0E] text-[11px] font-medium px-3 py-1.5 rounded-lg border border-amber-200">
                    Digite los correos que desee separados con un enter.
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 p-2 border border-[#E2E8F0] rounded-lg bg-white min-h-[42px] focus-within:ring-1 focus-within:ring-[#1E74BD]">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0 ml-1 mr-0.5" />
                    {formEmailChips.map(email => (
                      <span 
                        key={email} 
                        className="bg-[#BBF7D0] text-[#166534] border border-[#86EFAC] text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmailChip(email)}
                          className="text-[#166534] hover:text-rose-700 ml-0.5 cursor-pointer font-bold leading-none"
                          title="Eliminar correo"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="email"
                      placeholder={formEmailChips.length === 0 ? "cliente@ejemplo.com" : "añadir otro correo..."}
                      value={formEmailInput}
                      onChange={(e) => setFormEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmailChip();
                        }
                      }}
                      className="flex-1 min-w-[130px] text-xs text-[#1F2937] focus:outline-hidden px-1"
                    />
                  </div>
                </div>
              </div>

              {/* Products Section */}
              <div className="space-y-3 border border-slate-200 rounded-xl p-3.5 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#1E74BD]" />
                    <span>Productos de la Cotización ({formItems.length})</span>
                  </span>
                </div>

                {/* Product Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre, código o código de barras para agregar..."
                    value={productSearchTerm}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD] bg-slate-50"
                  />

                  {/* Autocomplete dropdown */}
                  {productSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {productSearchResults.map(prod => (
                        <div
                          key={prod.id}
                          onClick={() => handleAddProductToQuote(prod)}
                          className="p-2.5 hover:bg-blue-50 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-800">{prod.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Cód: {prod.code} • Stock: {prod.stock} {prod.unit || 'Pza'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-[#1E74BD]">{currency}{prod.price.toFixed(2)}</span>
                            <span className="block text-[10px] text-emerald-600 font-semibold">+ Agregar</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items Table in Form */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[10.5px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-2 text-center w-24">Cantidad</th>
                        <th className="py-2 px-2 text-right w-24">Precio Unit.</th>
                        <th className="py-2 px-2 text-right w-24">Desc.</th>
                        <th className="py-2 px-3 text-right w-24">Subtotal</th>
                        <th className="py-2 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Ningún producto agregado todavía. Busque arriba para agregar productos.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-800 block">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Cód: {item.code || '—'}</span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(idx, { quantity: Math.max(1, (item.quantity || 1) - 1) })}
                                  className="w-5 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                                  title="Disminuir cantidad"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="w-12 text-center py-1 border border-slate-200 rounded-md font-bold text-slate-800 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItem(idx, { quantity: (item.quantity || 1) + 1 })}
                                  className="w-5 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                                  title="Aumentar cantidad"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateItem(idx, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-20 text-right py-1 px-1.5 border border-slate-200 rounded-md font-mono text-slate-800"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.discountAmount || ''}
                                onChange={(e) => handleUpdateItem(idx, { discountAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-16 text-right py-1 px-1.5 border border-slate-200 rounded-md font-mono text-rose-600"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {currency}{item.subtotal.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Eliminar producto"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Subtotal summary block */}
                <div className="flex justify-end pt-1">
                  <div className="w-64 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal bruto:</span>
                      <span className="font-mono">{currency}{formTotals.subtotal.toFixed(2)}</span>
                    </div>
                    {formTotals.discountTotal > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Descuento total:</span>
                        <span className="font-mono">-{currency}{formTotals.discountTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-700 pt-1">
                      <span>IVA / Impuestos (%):</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formTaxRate}
                        onChange={(e) => setFormTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-14 text-right py-0.5 px-1.5 border border-slate-200 rounded text-xs font-mono"
                      />
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 text-sm border-t border-slate-200 pt-1.5 mt-1">
                      <span>Gran Total:</span>
                      <span className="font-mono text-[#1E74BD]">{currency}{formTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes and Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800">Observaciones / Notas</label>
                  <textarea
                    rows={3}
                    placeholder="Escriba aquí notas para el cliente..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full p-2.5 border border-[#E2E8F0] rounded-lg text-xs text-slate-800 bg-white resize-none focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800">Términos y Condiciones</label>
                  <textarea
                    rows={3}
                    value={formTerms}
                    onChange={(e) => setFormTerms(e.target.value)}
                    className="w-full p-2.5 border border-[#E2E8F0] rounded-lg text-xs text-slate-800 bg-white resize-none focus:outline-hidden focus:ring-1 focus:ring-[#1E74BD]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeQuoteModal}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuotation(false)}
                  className="flex-1 py-3 bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingQuote ? 'Guardar Cambios' : 'Guardar Cotización'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveQuotation(true)}
                  className="py-3 px-6 bg-[#1E74BD] hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>{editingQuote ? 'Actualizar e Imprimir' : 'Guardar e Imprimir'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONTROL DE ITEMS DE CONSIGNACIÓN */}
      {/* ========================================================================= */}
      {viewingConsignment && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-amber-700 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-200" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Consignación {viewingConsignment.correlative} — {viewingConsignment.clientName}
                  </h3>
                  <span className="text-[11px] text-amber-100 font-normal">
                    Entregada el {viewingConsignment.date || viewingConsignment.createdAt.split('T')[0]}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingConsignment(null)}
                className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[10.5px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-2 text-center">Entregados</th>
                      <th className="py-2.5 px-2 text-center">Devueltos</th>
                      <th className="py-2.5 px-2 text-center">Vendidos</th>
                      <th className="py-2.5 px-2 text-center">Pendientes</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingConsignment.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800 block">{it.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Cód: {it.code || '—'} • {currency}{it.price.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700">{it.quantityDelivered}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-rose-600">{it.quantityReturned}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-emerald-600">{it.quantitySold}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                            it.quantityPending > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {it.quantityPending}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {it.quantityPending > 0 ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setConsignActionModal({
                                    type: 'return',
                                    consignment: viewingConsignment,
                                    item: it
                                  });
                                  setActionQuantity(1);
                                  setActionNotes('');
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[10.5px] cursor-pointer"
                              >
                                Devolver
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConsignActionModal({
                                    type: 'sell',
                                    consignment: viewingConsignment,
                                    item: it
                                  });
                                  setActionQuantity(1);
                                  setActionNotes('');
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[10.5px] cursor-pointer"
                              >
                                Liquidar Venta
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Liquidado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Logs history */}
              {viewingConsignment.logs && viewingConsignment.logs.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-bold text-slate-700 text-xs block">Historial de Movimientos de Consignación:</span>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-1">
                    {viewingConsignment.logs.map(log => (
                      <div key={log.id} className="text-[11px] flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                        <div>
                          <strong className={log.type === 'devolucion' ? 'text-rose-600' : (log.type === 'venta' ? 'text-emerald-600' : 'text-blue-600')}>
                            {log.type === 'devolucion' ? 'Devolución' : (log.type === 'venta' ? 'Venta/Liquidación' : 'Entrega')}
                          </strong>: {log.quantity}x {log.productName}
                          {log.notes && <span className="text-slate-400 block text-[10px]">{log.notes}</span>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.date).toLocaleDateString('es-GT')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACTION: DEVOLVER O LIQUIDAR */}
      {consignActionModal && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center p-3 z-60 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl border border-slate-100 space-y-3">
            <h4 className="text-sm font-bold text-slate-800">
              {consignActionModal.type === 'return' ? 'Registrar Devolución' : 'Liquidar / Facturar Venta'}
            </h4>
            <p className="text-xs text-slate-600">
              Producto: <strong>{consignActionModal.item.name}</strong><br/>
              Cantidad pendiente en cliente: {consignActionModal.item.quantityPending} unidades
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cantidad a {consignActionModal.type === 'return' ? 'devolver' : 'liquidar'}
              </label>
              <input
                type="number"
                min="1"
                max={consignActionModal.item.quantityPending}
                value={actionQuantity}
                onChange={(e) => setActionQuantity(Math.max(1, Math.min(consignActionModal.item.quantityPending, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones</label>
              <input
                type="text"
                placeholder="Motivo o detalle..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConsignActionModal(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcessConsignmentAction}
                className={`px-3.5 py-1.5 text-xs text-white rounded-lg font-bold cursor-pointer ${
                  consignActionModal.type === 'return' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Confirmar {consignActionModal.type === 'return' ? 'Devolución' : 'Liquidación'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
