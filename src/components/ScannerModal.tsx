import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  Barcode, 
  Search, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Minus, 
  Plus, 
  User, 
  Building2, 
  FileText, 
  Volume2, 
  VolumeX, 
  Radio, 
  Layers, 
  Trash2, 
  ShieldCheck, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  PackagePlus, 
  Truck, 
  MapPin, 
  DollarSign, 
  Tag, 
  PlusCircle,
  Keyboard,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem, ItemCategory, SalidaGroupRecord, DevolucionGroupRecord, PARAMETRIZED_OPERATORS, PARAMETRIZED_SUPPLIERS } from '../types';
import { SalidaReceiptModal } from './SalidaReceiptModal';
import { DevolucionReceiptModal } from './DevolucionReceiptModal';
import { ManualEntryModal } from './ManualEntryModal';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  defaultMode?: 'salida' | 'ingreso' | 'devolucion';
}

interface GroupSalidaDraft {
  item: InventoryItem;
  cantidad: number;
}

interface GroupDevolucionDraft {
  item: InventoryItem;
  cantidad: number;
  motivo?: string;
}

interface GroupIngresoDraft {
  codigo: string;
  descripcion: string;
  proveedor: string;
  ubicacion: string;
  categoria: ItemCategory;
  cantidad: number;
  precioUnitario: number;
  isNewItem: boolean;
  currentStock: number;
}

// Sound synthesizer for realistic barcode gun feedback
const playScannerBeep = (type: 'scan' | 'success' | 'error' | 'warning') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 beep
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046, ctx.currentTime); // C6
      osc.frequency.setValueAtTime(1567, ctx.currentTime + 0.07); // G6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    // Audio autoplay fail-safe
  }
};

const COMMON_CLIENTS = [
  'Biofarma S.A',
  'AGD',
  'CAPYC COOP.LTDA.',
  'Larinox',
  'TGN FERREYRA',
  'Macoser S.A',
  'VIAL RG S.A',
  'Bioetanol Rio Cuarto S.A.',
  'Muni Malagueño',
  'Industria Cormetal S.A.',
  'Flota Taller Verdu',
  'Ingersoll Argentina S.A.',
  'Molinos Florencia SAU',
  'Cotagro',
  'F2J Techplast',
  'ENZO JORGE WILMAR JERKE'
];

const COMMON_OPERATORS = PARAMETRIZED_OPERATORS;
const COMMON_SUPPLIERS = PARAMETRIZED_SUPPLIERS;

const CATEGORY_NAMES: Record<ItemCategory, string> = {
  panol: 'Pañol (General)',
  cajones_fluidos: 'Cajones / Fluidos',
  submicronicos: 'Filtros Submicrónicos',
  rodamientos: 'Rodamientos',
  entrepiso: 'Entrepiso',
  importado: 'Importado',
  repuestos_mv: 'Repuestos MV',
  cajas: 'Cajas Estantes'
};

const VENTAS_ALLOWED_CATEGORIES: ItemCategory[] = ['panol', 'cajones_fluidos', 'submicronicos', 'rodamientos', 'entrepiso'];

export const ScannerModal: React.FC<ScannerModalProps> = ({ 
  isOpen, 
  onClose, 
  initialCode,
  defaultMode = 'salida'
}) => {
  const { 
    items, 
    findItemByCode, 
    registerSalidaGroup, 
    registerDevolucionGroup,
    registerIngreso,
    getNextSalidaNumber,
    getNextDevolucionNumber,
    currentUser 
  } = useInventory();

  const isVentas = currentUser.rol === 'ventas';
  const isGerencia = currentUser.rol === 'gerencia';
  const showPrices = isGerencia;
  
  // Scanner operational mode: 'salida' (retirar stock) vs 'devolucion' (reintegrar por empleado) vs 'ingreso' (agregar stock)
  const [scannerMode, setScannerMode] = useState<'salida' | 'ingreso' | 'devolucion'>(defaultMode);

  const availableItems = isVentas 
    ? items.filter(i => VENTAS_ALLOWED_CATEGORIES.includes(i.categoria))
    : items;

  // ==================== SALIDA (DISPATCH) STATE ====================
  const [groupSalidaItems, setGroupSalidaItems] = useState<GroupSalidaDraft[]>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_salida_draft_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [retira, setRetira] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_salida_retira');
      if (saved) return saved;
    } catch {}
    return currentUser.nombre || 'Matias';
  });
  const [esRemitoInterno, setEsRemitoInterno] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_salida_interno');
      if (saved) return saved === 'true';
    } catch {}
    return false;
  });
  const [cliente, setCliente] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_salida_cliente');
      if (saved) return saved;
    } catch {}
    return '';
  });
  const [nroRemitoSalida, setNroRemitoSalida] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_salida_remito');
      if (saved) return saved;
    } catch {}
    return '';
  });
  const [notasSalida, setNotasSalida] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_salida_notas');
      if (saved) return saved;
    } catch {}
    return '';
  });
  const [completedSalidaGroup, setCompletedSalidaGroup] = useState<SalidaGroupRecord | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);

  // ==================== DEVOLUCION (RETURN STOCK) STATE ====================
  const [groupDevolucionItems, setGroupDevolucionItems] = useState<GroupDevolucionDraft[]>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_devolucion_draft_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [empleadoDevuelve, setEmpleadoDevuelve] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_devolucion_empleado');
      if (saved) return saved;
    } catch {}
    return '';
  });
  const [motivoDevolucion, setMotivoDevolucion] = useState<string>('Sobrante de trabajo / taller');
  const [notasDevolucion, setNotasDevolucion] = useState<string>('');
  const [completedDevolucionGroup, setCompletedDevolucionGroup] = useState<DevolucionGroupRecord | null>(null);
  const [isDevolucionReceiptOpen, setIsDevolucionReceiptOpen] = useState<boolean>(false);

  // ==================== INGRESO (RECEIVE STOCK) STATE ====================
  const [groupIngresoItems, setGroupIngresoItems] = useState<GroupIngresoDraft[]>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_ingreso_draft_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [facturaIngreso, setFacturaIngreso] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('verdu_scanner_ingreso_factura');
      if (saved) return saved;
    } catch {}
    return '';
  });
  const [proveedorIngresoGlobal, setProveedorIngresoGlobal] = useState<string>('SULLAIR');
  const [showNewItemForm, setShowNewItemForm] = useState<boolean>(false);
  const [unrecognizedCode, setUnrecognizedCode] = useState<string>('');
  const [newDescInput, setNewDescInput] = useState<string>('');
  const [newProvInput, setNewProvInput] = useState<string>('SULLAIR');
  const [newUbicInput, setNewUbicInput] = useState<string>('A');
  const [newCatInput, setNewCatInput] = useState<ItemCategory>('panol');
  const [newPriceInput, setNewPriceInput] = useState<number>(0);
  const [newQtyInput, setNewQtyInput] = useState<number>(1);

  // ==================== DRAFT AUTO-SAVE EFFECTS ====================
  useEffect(() => {
    try {
      if (groupSalidaItems.length > 0) {
        sessionStorage.setItem('verdu_scanner_salida_draft_v1', JSON.stringify(groupSalidaItems));
        sessionStorage.setItem('verdu_scanner_salida_retira', retira);
        sessionStorage.setItem('verdu_scanner_salida_interno', String(esRemitoInterno));
        sessionStorage.setItem('verdu_scanner_salida_cliente', cliente);
        sessionStorage.setItem('verdu_scanner_salida_remito', nroRemitoSalida);
        sessionStorage.setItem('verdu_scanner_salida_notas', notasSalida);
      } else {
        sessionStorage.removeItem('verdu_scanner_salida_draft_v1');
        sessionStorage.removeItem('verdu_scanner_salida_remito');
        sessionStorage.removeItem('verdu_scanner_salida_notas');
      }
    } catch {}
  }, [groupSalidaItems, retira, esRemitoInterno, cliente, nroRemitoSalida, notasSalida]);

  useEffect(() => {
    try {
      if (groupDevolucionItems.length > 0) {
        sessionStorage.setItem('verdu_scanner_devolucion_draft_v1', JSON.stringify(groupDevolucionItems));
        sessionStorage.setItem('verdu_scanner_devolucion_empleado', empleadoDevuelve);
      } else {
        sessionStorage.removeItem('verdu_scanner_devolucion_draft_v1');
      }
    } catch {}
  }, [groupDevolucionItems, empleadoDevuelve]);

  useEffect(() => {
    try {
      if (groupIngresoItems.length > 0) {
        sessionStorage.setItem('verdu_scanner_ingreso_draft_v1', JSON.stringify(groupIngresoItems));
        sessionStorage.setItem('verdu_scanner_ingreso_factura', facturaIngreso);
      } else {
        sessionStorage.removeItem('verdu_scanner_ingreso_draft_v1');
        sessionStorage.removeItem('verdu_scanner_ingreso_factura');
      }
    } catch {}
  }, [groupIngresoItems, facturaIngreso]);

  // ==================== SCANNER / INPUT SHARED STATE ====================
  const [barcodeInput, setBarcodeInput] = useState(initialCode || '');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextSalidaNum = getNextSalidaNumber();
  const nextDevolucionNum = getNextDevolucionNumber();

  // Reset or setup when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessToast(null);
      setShowNewItemForm(false);
      if (defaultMode) {
        setScannerMode(defaultMode);
      }
      if (initialCode) {
        setBarcodeInput(initialCode);
        handleProcessScannedCode(initialCode);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialCode, defaultMode]);

  // Hardware barcode gun scanner listener (rapid keystroke sequence ending in Enter)
  useEffect(() => {
    if (!isOpen || isReceiptOpen) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't hijack if user is typing in textarea or another input
      if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target !== inputRef.current)) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Hardware Barcode scanners typically send characters with < 80ms interval
      if (timeDiff > 100) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          e.preventDefault();
          const scannedCode = buffer.trim();
          buffer = '';
          setLastScannedCode(scannedCode);
          setBarcodeInput(scannedCode);
          handleProcessScannedCode(scannedCode);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isReceiptOpen, soundEnabled, scannerMode, groupSalidaItems, groupIngresoItems]);

  // Master handler: routes code to Salida, Devolucion, or Ingreso based on current scannerMode
  const handleProcessScannedCode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setLastScannedCode(cleanCode);

    if (scannerMode === 'salida') {
      handleAddSalidaItem(cleanCode);
    } else if (scannerMode === 'devolucion') {
      handleAddDevolucionItem(cleanCode);
    } else {
      handleAddIngresoItem(cleanCode);
    }
  };

  // ==================== SALIDA ACTIONS ====================
  const handleAddSalidaItem = (cleanCode: string) => {
    setErrorMessage(null);
    setSuccessToast(null);

    const foundItem = findItemByCode(cleanCode);
    if (!foundItem) {
      setErrorMessage(`No se encontró ningún producto con el código "${cleanCode}" en pañol.`);
      if (soundEnabled) playScannerBeep('error');
      return;
    }

    if (isVentas && !VENTAS_ALLOWED_CATEGORIES.includes(foundItem.categoria)) {
      setErrorMessage(`El producto "${cleanCode}" pertenece a una sección reservada para Gerencia.`);
      if (soundEnabled) playScannerBeep('warning');
      return;
    }

    if (foundItem.stock <= 0) {
      setErrorMessage(`El producto "${foundItem.codigo} - ${foundItem.descripcion}" no tiene stock disponible (0 u.).`);
      if (soundEnabled) playScannerBeep('warning');
      return;
    }

    setGroupSalidaItems(prev => {
      const existingIndex = prev.findIndex(g => g.item.codigo.toLowerCase() === foundItem.codigo.toLowerCase());
      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        if (existing.cantidad >= foundItem.stock) {
          setErrorMessage(`Stock máximo alcanzado: en pañol hay ${foundItem.stock} u.`);
          if (soundEnabled) playScannerBeep('warning');
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          cantidad: existing.cantidad + 1
        };
        if (soundEnabled) playScannerBeep('scan');
        setSuccessToast(`+1 u. agregada a ${foundItem.codigo} (Total a retirar: ${existing.cantidad + 1} u.)`);
        return updated;
      } else {
        if (soundEnabled) playScannerBeep('scan');
        setSuccessToast(`Producto ${foundItem.codigo} agregado al lote de salida.`);
        return [{ item: foundItem, cantidad: 1 }, ...prev];
      }
    });

    setBarcodeInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleUpdateSalidaQty = (index: number, newQty: number) => {
    setGroupSalidaItems(prev => {
      const updated = [...prev];
      const target = updated[index];
      if (!target) return prev;
      const clamped = Math.max(1, Math.min(target.item.stock, newQty));
      updated[index] = { ...target, cantidad: clamped };
      return updated;
    });
  };

  const handleRemoveSalidaItem = (index: number) => {
    setGroupSalidaItems(prev => prev.filter((_, idx) => idx !== index));
    if (soundEnabled) playScannerBeep('warning');
  };

  const handleFinalizeSalida = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (groupSalidaItems.length === 0) {
      setErrorMessage('Debes escanear o agregar al menos 1 producto a este lote de salida.');
      if (soundEnabled) playScannerBeep('error');
      return;
    }

    if (!retira.trim()) {
      setErrorMessage('Por favor especifica el nombre del empleado que retira los productos.');
      if (soundEnabled) playScannerBeep('error');
      return;
    }

    const payload = {
      items: groupSalidaItems.map(g => ({
        codigo: g.item.codigo,
        cantidad: g.cantidad
      })),
      retira: retira.trim(),
      esRemitoInterno,
      cliente: esRemitoInterno ? (cliente.trim() || 'Taller Interno / Flota Propia') : (cliente.trim() || 'Cliente Externo'),
      nroRemito: nroRemitoSalida.trim(),
      notas: notasSalida.trim()
    };

    const res = registerSalidaGroup(payload);

    if (res.success && res.salidaGroup) {
      if (soundEnabled) playScannerBeep('success');
      setCompletedSalidaGroup(res.salidaGroup);
      
      // Limpiar inmediatamente el borrador de salida para que el próximo escaneo esté 100% limpio
      setGroupSalidaItems([]);
      setCliente('');
      setNroRemitoSalida('');
      setNotasSalida('');
      setBarcodeInput('');
      setLastScannedCode(null);
      setErrorMessage(null);
      setSuccessToast(null);
      try {
        sessionStorage.removeItem('verdu_scanner_salida_draft_v1');
        sessionStorage.removeItem('verdu_scanner_salida_remito');
        sessionStorage.removeItem('verdu_scanner_salida_notas');
        sessionStorage.removeItem('verdu_scanner_salida_cliente');
      } catch {}

      setIsReceiptOpen(true);
    } else {
      if (soundEnabled) playScannerBeep('error');
      setErrorMessage(res.message);
    }
  };

  // ==================== DEVOLUCION ACTIONS ====================
  const handleAddDevolucionItem = (cleanCode: string) => {
    setErrorMessage(null);
    setSuccessToast(null);

    const foundItem = findItemByCode(cleanCode);
    if (!foundItem) {
      setErrorMessage(`No se encontró ningún producto con el código "${cleanCode}" en el catálogo de pañol.`);
      if (soundEnabled) playScannerBeep('error');
      return;
    }

    setGroupDevolucionItems(prev => {
      const existingIdx = prev.findIndex(g => g.item.codigo.toLowerCase() === foundItem.codigo.toLowerCase());
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          cantidad: updated[existingIdx].cantidad + 1
        };
        if (soundEnabled) playScannerBeep('scan');
        setSuccessToast(`+1 u. de ${foundItem.codigo} agregada a la devolución (Total: ${updated[existingIdx].cantidad} u.)`);
        return updated;
      } else {
        if (soundEnabled) playScannerBeep('scan');
        setSuccessToast(`Producto ${foundItem.codigo} agregado al remito de devolución.`);
        return [{
          item: foundItem,
          cantidad: 1,
          motivo: motivoDevolucion
        }, ...prev];
      }
    });

    setBarcodeInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleUpdateDevolucionQty = (index: number, newQty: number) => {
    setGroupDevolucionItems(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      updated[index] = {
        ...updated[index],
        cantidad: Math.max(1, newQty)
      };
      return updated;
    });
  };

  const handleRemoveDevolucionItem = (index: number) => {
    setGroupDevolucionItems(prev => prev.filter((_, idx) => idx !== index));
    if (soundEnabled) playScannerBeep('warning');
  };

  const handleFinalizeDevolucion = () => {
    if (groupDevolucionItems.length === 0) {
      setErrorMessage('Debes escanear o cargar al menos 1 producto para la devolución.');
      if (soundEnabled) playScannerBeep('error');
      return;
    }

    if (!empleadoDevuelve.trim()) {
      setErrorMessage('Debes indicar el empleado que devuelve el producto.');
      if (soundEnabled) playScannerBeep('warning');
      return;
    }

    const payload = {
      items: groupDevolucionItems.map(g => ({
        codigo: g.item.codigo,
        cantidad: g.cantidad,
        motivo: g.motivo || motivoDevolucion
      })),
      empleadoDevuelve: empleadoDevuelve.trim(),
      motivo: motivoDevolucion.trim() || 'Devolución pañol',
      notas: notasDevolucion.trim()
    };

    const res = registerDevolucionGroup(payload);

    if (res.success && res.devolucionGroup) {
      if (soundEnabled) playScannerBeep('success');
      setCompletedDevolucionGroup(res.devolucionGroup);
      
      // Limpiar borrador de devolución
      setGroupDevolucionItems([]);
      setEmpleadoDevuelve('');
      setNotasDevolucion('');
      setBarcodeInput('');
      setLastScannedCode(null);
      setErrorMessage(null);
      setSuccessToast(null);
      try {
        sessionStorage.removeItem('verdu_scanner_devolucion_draft_v1');
        sessionStorage.removeItem('verdu_scanner_devolucion_empleado');
      } catch {}

      setIsDevolucionReceiptOpen(true);
    } else {
      if (soundEnabled) playScannerBeep('error');
      setErrorMessage(res.message);
    }
  };

  const handleStartNewDevolucion = () => {
    setIsDevolucionReceiptOpen(false);
    setCompletedDevolucionGroup(null);
    setGroupDevolucionItems([]);
    setEmpleadoDevuelve('');
    setNotasDevolucion('');
    setErrorMessage(null);
    setSuccessToast(null);
    setBarcodeInput('');
    try {
      sessionStorage.removeItem('verdu_scanner_devolucion_draft_v1');
      sessionStorage.removeItem('verdu_scanner_devolucion_empleado');
    } catch {}
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleManualAddDevolucionItem = (item: InventoryItem, qty: number) => {
    setErrorMessage(null);
    setSuccessToast(null);

    setGroupDevolucionItems(prev => {
      const existingIdx = prev.findIndex(g => g.item.id === item.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          cantidad: updated[existingIdx].cantidad + qty
        };
        return updated;
      } else {
        return [{ item, cantidad: qty, motivo: motivoDevolucion }, ...prev];
      }
    });

    if (soundEnabled) playScannerBeep('scan');
    setSuccessToast(`Agregado a la devolución: ${qty} u. de ${item.codigo}`);
  };

  // ==================== INGRESO ACTIONS ====================
  const handleAddIngresoItem = (cleanCode: string) => {
    setErrorMessage(null);
    setSuccessToast(null);

    const foundItem = findItemByCode(cleanCode);

    if (foundItem) {
      // Item exists: add or increment in groupIngresoItems
      setGroupIngresoItems(prev => {
        const existingIdx = prev.findIndex(g => g.codigo.toLowerCase() === foundItem.codigo.toLowerCase());
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            cantidad: updated[existingIdx].cantidad + 1
          };
          if (soundEnabled) playScannerBeep('scan');
          setSuccessToast(`+1 u. sumada al ingreso de ${foundItem.codigo} (Total a ingresar: ${updated[existingIdx].cantidad} u.)`);
          return updated;
        } else {
          if (soundEnabled) playScannerBeep('scan');
          setSuccessToast(`Producto ${foundItem.codigo} preparado para sumar stock.`);
          return [{
            codigo: foundItem.codigo,
            descripcion: foundItem.descripcion,
            proveedor: foundItem.proveedor || proveedorIngresoGlobal,
            ubicacion: foundItem.ubicacion || 'A',
            categoria: foundItem.categoria,
            cantidad: 1,
            precioUnitario: foundItem.precio || 0,
            isNewItem: false,
            currentStock: foundItem.stock
          }, ...prev];
        }
      });
      setShowNewItemForm(false);
    } else {
      // Code does not exist in inventory: open fast registration form
      setUnrecognizedCode(cleanCode);
      setNewDescInput('');
      setNewProvInput(proveedorIngresoGlobal);
      setNewUbicInput('A');
      setNewCatInput('panol');
      setNewPriceInput(0);
      setNewQtyInput(1);
      setShowNewItemForm(true);
      if (soundEnabled) playScannerBeep('warning');
    }

    setBarcodeInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleAddNewItemToIngresoDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unrecognizedCode.trim() || !newDescInput.trim()) {
      setErrorMessage('Código y descripción son obligatorios para dar de alta el producto.');
      return;
    }

    const newItemDraft: GroupIngresoDraft = {
      codigo: unrecognizedCode.trim(),
      descripcion: newDescInput.trim(),
      proveedor: newProvInput.trim() || 'SULLAIR',
      ubicacion: newUbicInput.trim() || 'A',
      categoria: newCatInput,
      cantidad: Math.max(1, newQtyInput),
      precioUnitario: Math.max(0, newPriceInput),
      isNewItem: true,
      currentStock: 0
    };

    setGroupIngresoItems(prev => [newItemDraft, ...prev]);
    setShowNewItemForm(false);
    setUnrecognizedCode('');
    if (soundEnabled) playScannerBeep('success');
    setSuccessToast(`Nuevo producto ${newItemDraft.codigo} añadido a la lista de ingresos.`);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleUpdateIngresoQty = (index: number, newQty: number) => {
    setGroupIngresoItems(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      updated[index] = {
        ...updated[index],
        cantidad: Math.max(1, newQty)
      };
      return updated;
    });
  };

  const handleRemoveIngresoItem = (index: number) => {
    setGroupIngresoItems(prev => prev.filter((_, idx) => idx !== index));
    if (soundEnabled) playScannerBeep('warning');
  };

  const handleFinalizeIngreso = () => {
    if (groupIngresoItems.length === 0) {
      setErrorMessage('Debes escanear o registrar al menos 1 producto para sumar stock.');
      if (soundEnabled) playScannerBeep('error');
      return;
    }

    const invoiceNum = facturaIngreso.trim() || `ING-SCAN-${Date.now().toString().slice(-5)}`;
    let totalPiezas = 0;

    // Process all items in draft
    groupIngresoItems.forEach(item => {
      totalPiezas += item.cantidad;
      registerIngreso({
        codigo: item.codigo,
        proveedor: item.proveedor || proveedorIngresoGlobal,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        factura: invoiceNum,
        ubicacion: item.ubicacion,
        categoria: item.categoria,
        precioUnitario: item.precioUnitario
      });
    });

    if (soundEnabled) playScannerBeep('success');

    try {
      confetti({
        particleCount: 55,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#10b981', '#0080D0', '#059669', '#38bdf8']
      });
    } catch {}

    setSuccessToast(`¡Stock actualizado con éxito! Se sumaron +${totalPiezas} unidades al pañol (${groupIngresoItems.length} productos procesados).`);
    setGroupIngresoItems([]);
    setFacturaIngreso('');
    setBarcodeInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleStartNewSalida = () => {
    setIsReceiptOpen(false);
    setCompletedSalidaGroup(null);
    setGroupSalidaItems([]);
    setCliente('');
    setNroRemitoSalida('');
    setNotasSalida('');
    setErrorMessage(null);
    setSuccessToast(null);
    setBarcodeInput('');
    try {
      sessionStorage.removeItem('verdu_scanner_salida_draft_v1');
      sessionStorage.removeItem('verdu_scanner_salida_remito');
      sessionStorage.removeItem('verdu_scanner_salida_notas');
    } catch {}
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ==================== MANUAL ENTRY HANDLERS ====================
  const handleManualAddSalidaItem = (item: InventoryItem, qty: number) => {
    setErrorMessage(null);
    setSuccessToast(null);

    if (item.stock <= 0) {
      setErrorMessage(`El producto ${item.codigo} no tiene stock disponible.`);
      if (soundEnabled) playScannerBeep('warning');
      return;
    }

    setGroupSalidaItems(prev => {
      const existingIdx = prev.findIndex(g => g.item.id === item.id);
      if (existingIdx !== -1) {
        const currentQty = prev[existingIdx].cantidad;
        const newQty = currentQty + qty;
        if (newQty > item.stock) {
          setErrorMessage(`No puedes retirar más de ${item.stock} unidades de ${item.codigo}.`);
          if (soundEnabled) playScannerBeep('warning');
          return prev;
        }
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          cantidad: newQty
        };
        return updated;
      } else {
        if (qty > item.stock) {
          setErrorMessage(`No puedes retirar más de ${item.stock} unidades de ${item.codigo}.`);
          if (soundEnabled) playScannerBeep('warning');
          return prev;
        }
        return [{ item, cantidad: qty }, ...prev];
      }
    });

    if (soundEnabled) playScannerBeep('scan');
    setSuccessToast(`Agregado a la salida: ${qty} u. de ${item.codigo}`);
  };

  const handleManualAddExistingIngresoItem = (item: InventoryItem, qty: number, precio?: number) => {
    setErrorMessage(null);
    setSuccessToast(null);

    setGroupIngresoItems(prev => {
      const existingIdx = prev.findIndex(g => g.codigo.toLowerCase() === item.codigo.toLowerCase());
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          cantidad: updated[existingIdx].cantidad + qty,
          precioUnitario: precio !== undefined ? precio : updated[existingIdx].precioUnitario
        };
        return updated;
      } else {
        return [{
          codigo: item.codigo,
          descripcion: item.descripcion,
          proveedor: item.proveedor || proveedorIngresoGlobal,
          ubicacion: item.ubicacion || 'A',
          categoria: item.categoria,
          cantidad: qty,
          precioUnitario: precio !== undefined ? precio : (item.precio || 0),
          isNewItem: false,
          currentStock: item.stock
        }, ...prev];
      }
    });

    if (soundEnabled) playScannerBeep('scan');
    setSuccessToast(`Agregado al ingreso: ${qty} u. de ${item.codigo}`);
  };

  const handleManualAddNewIngresoItem = (newItem: {
    codigo: string;
    descripcion: string;
    proveedor: string;
    ubicacion: string;
    categoria: ItemCategory;
    cantidad: number;
    precioUnitario: number;
  }) => {
    setErrorMessage(null);
    setSuccessToast(null);

    const newItemDraft: GroupIngresoDraft = {
      codigo: newItem.codigo.trim().toUpperCase(),
      descripcion: newItem.descripcion.trim().toUpperCase(),
      proveedor: newItem.proveedor.trim().toUpperCase() || proveedorIngresoGlobal,
      ubicacion: newItem.ubicacion.trim().toUpperCase() || 'A',
      categoria: newItem.categoria,
      cantidad: Math.max(1, newItem.cantidad),
      precioUnitario: Math.max(0, newItem.precioUnitario),
      isNewItem: true,
      currentStock: 0
    };

    setGroupIngresoItems(prev => [newItemDraft, ...prev]);
    if (soundEnabled) playScannerBeep('success');
    setSuccessToast(`Nuevo producto ${newItemDraft.codigo} añadido a la lista de ingresos.`);
  };

  const handleRequestCancel = () => {
    const hasItems = scannerMode === 'salida' 
      ? groupSalidaItems.length > 0 
      : scannerMode === 'devolucion'
      ? groupDevolucionItems.length > 0
      : groupIngresoItems.length > 0;
    if (hasItems) {
      setShowCancelConfirmModal(true);
    } else {
      handleAbortMission();
    }
  };

  const handleAbortMission = () => {
    setShowCancelConfirmModal(false);
    setGroupSalidaItems([]);
    setGroupDevolucionItems([]);
    setGroupIngresoItems([]);
    setCliente('');
    setNroRemitoSalida('');
    setNotasSalida('');
    setEmpleadoDevuelve('');
    setNotasDevolucion('');
    setFacturaIngreso('');
    setBarcodeInput('');
    setErrorMessage(null);
    setSuccessToast(null);
    try {
      sessionStorage.removeItem('verdu_scanner_salida_draft_v1');
      sessionStorage.removeItem('verdu_scanner_salida_remito');
      sessionStorage.removeItem('verdu_scanner_salida_notas');
      sessionStorage.removeItem('verdu_scanner_devolucion_draft_v1');
      sessionStorage.removeItem('verdu_scanner_devolucion_empleado');
      sessionStorage.removeItem('verdu_scanner_ingreso_draft_v1');
      sessionStorage.removeItem('verdu_scanner_ingreso_factura');
    } catch {}
    onClose();
  };

  // Instant autocomplete dropdown filtering for manual typing
  const filteredSuggestions = barcodeInput.trim().length > 1
    ? availableItems.filter(i => 
        i.codigo.toLowerCase().includes(barcodeInput.toLowerCase().trim()) ||
        (i.codigoBarras && i.codigoBarras.toLowerCase().includes(barcodeInput.toLowerCase().trim())) ||
        i.descripcion.toLowerCase().includes(barcodeInput.toLowerCase().trim()) ||
        i.proveedor.toLowerCase().includes(barcodeInput.toLowerCase().trim()) ||
        (i.equivalencias && i.equivalencias.toLowerCase().includes(barcodeInput.toLowerCase().trim()))
      ).slice(0, 8)
    : [];

  const totalPiezasSalida = groupSalidaItems.reduce((sum, g) => sum + g.cantidad, 0);
  const totalValorSalida = groupSalidaItems.reduce((sum, g) => sum + (g.cantidad * g.item.precio), 0);

  const totalPiezasDevolucion = groupDevolucionItems.reduce((sum, g) => sum + g.cantidad, 0);
  const totalValorDevolucion = groupDevolucionItems.reduce((sum, g) => sum + (g.cantidad * (g.item.precio || 0)), 0);

  const totalPiezasIngreso = groupIngresoItems.reduce((sum, g) => sum + g.cantidad, 0);
  const totalValorIngreso = groupIngresoItems.reduce((sum, g) => sum + (g.cantidad * g.precioUnitario), 0);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-sky-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-[#f8fcfe] rounded-3xl shadow-2xl border border-[#c4e1f7] w-full max-w-5xl max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden">
          
          {/* Header Bar with Mode Switch */}
          <div className="bg-gradient-to-r from-[#006bb0] to-[#0088dd] p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs border border-white/20 shrink-0">
                <Scan className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">
                    {scannerMode === 'salida' ? 'Retirar Stock' : scannerMode === 'devolucion' ? 'Remito de Devolución' : 'Agregar Stock'}
                  </h2>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-100 text-[11px] font-bold">
                    <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />
                    Pistola Lista
                  </span>
                </div>
              </div>
            </div>
            
            {/* Mode Switcher & Tools */}
            <div className="flex items-center gap-2">
              
              {/* Mode Toggle (Salida / Devolución / Ingreso) */}
              {!isVentas && (
                <div className="flex rounded-xl bg-black/20 p-1 border border-white/20 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setScannerMode('salida');
                      setErrorMessage(null);
                      setSuccessToast(null);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      scannerMode === 'salida'
                        ? 'bg-white text-[#006bb0] shadow-xs'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Retirar Stock</span>
                    <span className="sm:hidden">Salida</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerMode('devolucion');
                      setErrorMessage(null);
                      setSuccessToast(null);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      scannerMode === 'devolucion'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Devolución</span>
                    <span className="sm:hidden">Devolución</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerMode('ingreso');
                      setErrorMessage(null);
                      setSuccessToast(null);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      scannerMode === 'ingreso'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Agregar Stock</span>
                    <span className="sm:hidden">Ingreso</span>
                  </button>
                </div>
              )}

              {/* Sound Beep Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title={soundEnabled ? 'Silenciar beeps' : 'Activar sonido'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-slate-300" />}
              </button>

              {/* Close (Preserves draft) */}
              <button 
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Cerrar ventana (se mantendrán los productos escaneados por si se cerró por error)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mode Sub-Header Information */}
          {scannerMode === 'salida' ? (
            /* SALIDA SUBHEADER */
            <div className="bg-[#f4f9fd] border-b border-[#c4e1f7] p-3.5 sm:p-4 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                
                {/* Empleado que retira */}
                <div className="lg:col-span-4 flex flex-col gap-1">
                  <label className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#006bb0]" />
                    Empleado que Retira <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={retira}
                    onChange={e => setRetira(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0] cursor-pointer"
                  >
                    <option value="">-- Seleccionar Empleado ({COMMON_OPERATORS.length}) --</option>
                    {COMMON_OPERATORS.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Remito */}
                <div className="lg:col-span-3 flex flex-col gap-1">
                  <label className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#006bb0]" />
                    Tipo de Remito
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-[#d6ecfa] p-1 rounded-xl text-xs font-bold border border-[#badbf5]">
                    <button
                      type="button"
                      onClick={() => {
                        setEsRemitoInterno(false);
                        if (cliente === 'Taller Interno Verdu' || cliente === 'Taller Interno / Flota Propia') {
                          setCliente('');
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                        !esRemitoInterno 
                          ? 'bg-[#006bb0] text-white shadow-xs' 
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEsRemitoInterno(true);
                        if (!cliente.trim()) {
                          setCliente('Taller Interno / Flota Propia');
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                        esRemitoInterno 
                          ? 'bg-purple-700 text-white shadow-xs' 
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      Interno (Taller)
                    </button>
                  </div>
                </div>

                {/* Cliente / Destino */}
                <div className="lg:col-span-3 flex flex-col gap-1">
                  <label className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#006bb0]" />
                    {esRemitoInterno ? 'Sección / Máquina / Taller' : 'Cliente / Obra / Destino'}
                  </label>
                  <input
                    type="text"
                    list="clients-group-list"
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                    placeholder={esRemitoInterno ? 'Ej: Banco de pruebas, Camión 3...' : 'Ej: Biofarma, AGD...'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
                  />
                  <datalist id="clients-group-list">
                    {COMMON_CLIENTS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                {/* Nº Remito Salida */}
                <div className="lg:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-[#006bb0]" />
                    Nº Remito / Presp.
                  </label>
                  <input
                    type="text"
                    value={nroRemitoSalida}
                    onChange={e => setNroRemitoSalida(e.target.value)}
                    placeholder={esRemitoInterno ? `INT-${String(nextSalidaNum).padStart(4, '0')}` : `Rº${18980 + nextSalidaNum}`}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
                  />
                </div>

              </div>
            </div>
          ) : scannerMode === 'devolucion' ? (
            /* DEVOLUCION SUBHEADER */
            <div className="bg-[#fffbeb] border-b border-amber-200 p-3.5 sm:p-4 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                
                {/* Empleado que devuelve (MANDATORY PROMPT) */}
                <div className="lg:col-span-4 flex flex-col gap-1">
                  <label className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-amber-600" />
                      Empleado que Devuelve
                    </span>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">Requerido</span>
                  </label>
                  <input
                    type="text"
                    list="devolucion-operators-list"
                    value={empleadoDevuelve}
                    onChange={e => setEmpleadoDevuelve(e.target.value)}
                    placeholder="Escribe o selecciona quién devuelve..."
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 ${
                      !empleadoDevuelve.trim() ? 'border-amber-400 ring-1 ring-amber-300' : 'border-amber-300'
                    }`}
                  />
                  <datalist id="devolucion-operators-list">
                    {COMMON_OPERATORS.map(op => <option key={op} value={op} />)}
                  </datalist>
                </div>

                {/* Motivo de Devolución */}
                <div className="lg:col-span-4 flex flex-col gap-1">
                  <label className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    Motivo de Devolución
                  </label>
                  <select
                    value={motivoDevolucion}
                    onChange={e => setMotivoDevolucion(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900 cursor-pointer"
                  >
                    <option value="Sobrante de trabajo / taller">Sobrante de trabajo / taller</option>
                    <option value="Material no utilizado">Material no utilizado</option>
                    <option value="Cambio de pieza por modelo">Cambio de pieza por modelo</option>
                    <option value="Servicio técnico finalizado">Servicio técnico finalizado</option>
                    <option value="Pieza incorrecta retirada">Pieza incorrecta retirada</option>
                    <option value="Devolución general">Devolución general</option>
                  </select>
                </div>

                {/* Observaciones / Notas */}
                <div className="lg:col-span-4 flex flex-col gap-1">
                  <label className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    Observaciones (Opcional)
                  </label>
                  <input
                    type="text"
                    value={notasDevolucion}
                    onChange={e => setNotasDevolucion(e.target.value)}
                    placeholder="Ej: Orden de trabajo 410, reintegrado en buen estado..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-900"
                  />
                </div>

              </div>
            </div>
          ) : (
            /* INGRESO SUBHEADER */
            <div className="bg-[#f0fdf4] border-b border-emerald-200 p-3.5 sm:p-4 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                
                {/* Factura / Remito Proveedor */}
                <div className="lg:col-span-4 flex flex-col gap-1">
                  <label className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    Factura / Remito Proveedor
                  </label>
                  <input
                    type="text"
                    value={facturaIngreso}
                    onChange={e => setFacturaIngreso(e.target.value)}
                    placeholder="Ej: FC-0001-00049281 o R-8921"
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 rounded-xl border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Proveedor Origen */}
                <div className="lg:col-span-8 flex flex-col gap-1">
                  <label className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    Proveedor Origen
                  </label>
                  <input
                    type="text"
                    list="suppliers-ingreso-list"
                    value={proveedorIngresoGlobal}
                    onChange={e => setProveedorIngresoGlobal(e.target.value)}
                    placeholder="SULLAIR, SKF, DONALDSON..."
                    className="w-full px-3 py-2 text-xs font-bold text-slate-900 rounded-xl border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <datalist id="suppliers-ingreso-list">
                    {COMMON_SUPPLIERS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>

              </div>
            </div>
          )}

          {/* Main Work Area */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Left Column (5 cols): Scanner & Search Input */}
            <div className="lg:col-span-5 flex flex-col gap-3.5">
              
              {/* Code Input Box */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Search className={`w-3.5 h-3.5 ${scannerMode === 'salida' ? 'text-[#006bb0]' : 'text-emerald-600'}`} />
                    Código o Código de Barras
                  </label>
                  {lastScannedCode && (
                    <span className="text-[11px] font-mono font-bold text-[#006bb0] bg-sky-50 border border-[#c4e1f7] px-2 py-0.5 rounded">
                      Último: {lastScannedCode}
                    </span>
                  )}
                </div>
                
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleProcessScannedCode(barcodeInput);
                      }
                    }}
                    placeholder="Escanear o escribir código..."
                    className={`w-full pl-9 pr-24 py-2.5 text-sm font-mono font-bold rounded-xl border-2 bg-white focus:outline-none shadow-xs transition-all ${
                      scannerMode === 'salida' 
                        ? 'border-[#b8ddf5] focus:border-[#006bb0] focus:ring-4 focus:ring-[#006bb0]/15' 
                        : 'border-emerald-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15'
                    }`}
                  />
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  
                  <button
                    type="button"
                    onClick={() => handleProcessScannedCode(barcodeInput)}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs cursor-pointer ${
                      scannerMode === 'salida' ? 'bg-[#006bb0] hover:bg-[#005590]' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    + Agregar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualModal(true)}
                  className="w-full mt-1 py-2 px-3 rounded-xl border border-[#badbf5] bg-white hover:bg-sky-50 text-sky-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                >
                  <Keyboard className="w-4 h-4 text-[#006bb0]" />
                  <span>Carga manual</span>
                </button>
              </div>

              {/* Unrecognized New Item Inline Form (In Ingreso Mode) */}
              {showNewItemForm && scannerMode === 'ingreso' && (
                <form onSubmit={handleAddNewItemToIngresoDraft} className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm flex flex-col gap-2.5 animate-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-950">
                      Registrar producto en el pañol
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded">
                      {unrecognizedCode}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Descripción / Denominación *</label>
                    <input
                      type="text"
                      required
                      value={newDescInput}
                      onChange={e => setNewDescInput(e.target.value)}
                      placeholder="Ej: Manguera alta presión 3/8..."
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 bg-white font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Proveedor / Marca</label>
                      <input
                        type="text"
                        value={newProvInput}
                        onChange={e => setNewProvInput(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Ubicación</label>
                      <input
                        type="text"
                        value={newUbicInput}
                        onChange={e => setNewUbicInput(e.target.value)}
                        placeholder="Ej: A, Cajón 4..."
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Sección / Categoría</label>
                      <select
                        value={newCatInput}
                        onChange={e => setNewCatInput(e.target.value as ItemCategory)}
                        className="px-2 py-1.5 text-xs rounded-lg border border-amber-300 bg-white"
                      >
                        <option value="panol">Pañol (General)</option>
                        <option value="cajones_fluidos">Cajones / Fluidos</option>
                        <option value="submicronicos">Filtros Submicrónicos</option>
                        <option value="rodamientos">Rodamientos</option>
                        <option value="entrepiso">Entrepiso</option>
                        <option value="importado">Importado</option>
                        <option value="repuestos_mv">Repuestos MV</option>
                        <option value="cajas">Cajas</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Cantidad a Ingresar</label>
                      <input
                        type="number"
                        min="1"
                        value={newQtyInput}
                        onChange={e => setNewQtyInput(parseInt(e.target.value) || 1)}
                        className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-amber-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewItemForm(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs"
                    >
                      Añadir al Ingreso
                    </button>
                  </div>
                </form>
              )}

              {/* Dropdown Suggestions */}
              {filteredSuggestions.length > 0 && !showNewItemForm && (
                <div className="border border-[#c4e1f7] rounded-xl overflow-hidden shadow-xs bg-white divide-y divide-[#e2effa] animate-in fade-in">
                  <div className="bg-[#eaf4fb] px-3 py-1 text-[10px] font-bold text-sky-950 uppercase tracking-wider flex items-center justify-between">
                    <span>Sugerencias ({filteredSuggestions.length})</span>
                    <span className="text-slate-500">Clic para añadir</span>
                  </div>
                  {filteredSuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleProcessScannedCode(item.codigo)}
                      className="w-full text-left p-2 hover:bg-[#eaf4fb] transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-[#006bb0]">{item.codigo}</span>
                          <span className="text-[10px] px-1 py-0.2 rounded bg-[#e8f4fc] text-[#006bb0] font-bold">{item.proveedor}</span>
                        </div>
                        <span className="text-xs text-slate-600 line-clamp-1">{item.descripcion}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          item.stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.stock} u.
                        </span>
                        <span className="text-[10px] text-slate-500 block font-mono">Ubic: {item.ubicacion}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Feedback messages */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              {successToast && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 font-bold">{successToast}</div>
                </div>
              )}



            </div>

            {/* Right Column (7 cols): Group Items Cart & Summary */}
            <div className={`lg:col-span-7 flex flex-col justify-between rounded-2xl border p-4 ${
              scannerMode === 'salida' 
                ? 'bg-[#f4f9fd] border-[#c4e1f7]' 
                : scannerMode === 'devolucion'
                ? 'bg-[#fffdf7] border-amber-300'
                : 'bg-[#f0fdf4] border-emerald-200'
            }`}>
              
              {/* Group Cart Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#c4e1f7]">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold ${
                    scannerMode === 'salida' ? 'bg-[#006bb0]' : scannerMode === 'devolucion' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}>
                    {scannerMode === 'salida' ? <Layers className="w-4 h-4" /> : scannerMode === 'devolucion' ? <RotateCcw className="w-4 h-4" /> : <PackagePlus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-sky-950 tracking-tight">
                      {scannerMode === 'salida' 
                        ? 'Productos a Retirar (Salida)' 
                        : scannerMode === 'devolucion'
                        ? 'Productos a Reintegrar (Devolución)'
                        : 'Productos a Ingresar (Sumar Stock)'}
                    </h3>
                    <span className="text-xs text-slate-600">
                      {scannerMode === 'salida' 
                        ? `${groupSalidaItems.length} productos en este lote` 
                        : scannerMode === 'devolucion'
                        ? `${groupDevolucionItems.length} productos a devolver`
                        : `${groupIngresoItems.length} productos preparados para ingresar`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List (Salida, Devolucion, or Ingreso) */}
              <div className="flex-1 overflow-y-auto my-3 space-y-2.5 max-h-[340px] pr-1">
                {scannerMode === 'salida' ? (
                  /* SALIDA ITEMS */
                  groupSalidaItems.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-[#badbf5] rounded-xl bg-white">
                      <Barcode className="w-8 h-8 text-[#a8d3f4] mb-2" />
                      <p className="text-xs font-bold text-slate-500">Sin productos agregados</p>
                    </div>
                  ) : (
                    groupSalidaItems.map((draft, idx) => {
                      const remainingStock = Math.max(0, draft.item.stock - draft.cantidad);
                      const subtotal = draft.cantidad * draft.item.precio;

                      return (
                        <div 
                          key={draft.item.id || idx}
                          className="bg-white rounded-xl p-3 border border-[#c4e1f7] shadow-2xs hover:border-[#006bb0] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-slate-900">{draft.item.codigo}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#e8f4fc] text-[#006bb0] font-bold uppercase">{draft.item.proveedor}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f4f9fd] text-slate-700 font-mono font-semibold border border-[#badbf5]">
                                Ubic: {draft.item.ubicacion || 'A'}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 line-clamp-1 mt-0.5">{draft.item.descripcion}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                              {showPrices && <span>P. Unit: <strong className="font-mono text-slate-700">${draft.item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></span>}
                              <span>Stock Pañol: <strong className="text-slate-700">{draft.item.stock} u.</strong></span>
                              <span className="text-emerald-700 font-bold">Quedarán: {remainingStock} u.</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                            <div className="flex items-center rounded-lg border border-[#badbf5] bg-white overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateSalidaQty(idx, draft.cantidad - 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-[#eaf4fb] text-slate-700 transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={draft.item.stock}
                                value={draft.cantidad}
                                onChange={e => handleUpdateSalidaQty(idx, parseInt(e.target.value) || 1)}
                                className="w-12 text-center font-mono font-black text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateSalidaQty(idx, draft.cantidad + 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-[#eaf4fb] text-slate-700 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {showPrices && (
                              <div className="text-right min-w-[70px]">
                                <span className="text-[10px] text-slate-500 uppercase block font-bold">Subtotal</span>
                                <span className="font-mono font-bold text-xs text-sky-950">
                                  ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveSalidaItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Quitar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : scannerMode === 'devolucion' ? (
                  /* DEVOLUCION ITEMS */
                  groupDevolucionItems.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-amber-300 rounded-xl bg-white">
                      <RotateCcw className="w-8 h-8 text-amber-400 mb-2" />
                      <p className="text-xs font-bold text-slate-500">Sin productos para devolución</p>
                      <p className="text-[11px] text-slate-400 mt-1">Escanea el código del producto o usa Carga manual</p>
                    </div>
                  ) : (
                    groupDevolucionItems.map((draft, idx) => {
                      const finalStock = draft.item.stock + draft.cantidad;
                      const subtotal = draft.cantidad * (draft.item.precio || 0);

                      return (
                        <div 
                          key={draft.item.id || idx}
                          className="bg-white rounded-xl p-3 border border-amber-300 shadow-2xs hover:border-amber-500 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-slate-900">{draft.item.codigo}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold uppercase">{draft.item.proveedor}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f4f9fd] text-slate-700 font-mono font-semibold border border-[#badbf5]">
                                Ubic: {draft.item.ubicacion || 'A'}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 line-clamp-1 mt-0.5">{draft.item.descripcion}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                              <span>Stock actual: <strong className="text-slate-700">{draft.item.stock} u.</strong></span>
                              <span className="text-amber-700 font-bold">Stock final: {finalStock} u. (+{draft.cantidad} u.)</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                            <div className="flex items-center rounded-lg border border-amber-300 bg-white overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateDevolucionQty(idx, draft.cantidad - 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-amber-50 text-slate-700 transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={draft.cantidad}
                                onChange={e => handleUpdateDevolucionQty(idx, parseInt(e.target.value) || 1)}
                                className="w-12 text-center font-mono font-black text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateDevolucionQty(idx, draft.cantidad + 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-amber-50 text-slate-700 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {showPrices && (draft.item.precio || 0) > 0 && (
                              <div className="text-right min-w-[70px]">
                                <span className="text-[10px] text-slate-500 uppercase block font-bold">Subtotal</span>
                                <span className="font-mono font-bold text-xs text-amber-950">
                                  ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveDevolucionItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Quitar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  /* INGRESO ITEMS */
                  groupIngresoItems.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-emerald-300 rounded-xl bg-white">
                      <PackagePlus className="w-8 h-8 text-emerald-400 mb-2" />
                      <p className="text-xs font-bold text-slate-500">Sin productos agregados</p>
                    </div>
                  ) : (
                    groupIngresoItems.map((draft, idx) => {
                      const finalStock = draft.currentStock + draft.cantidad;
                      const subtotal = draft.cantidad * draft.precioUnitario;

                      return (
                        <div 
                          key={idx}
                          className="bg-white rounded-xl p-3 border border-emerald-300 shadow-2xs hover:border-emerald-500 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-xs text-slate-900">{draft.codigo}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">{draft.proveedor}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f4f9fd] text-slate-700 font-mono font-semibold border border-[#badbf5]">
                                Ubic: {draft.ubicacion}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-bold">
                                {CATEGORY_NAMES[draft.categoria]}
                              </span>
                              {draft.isNewItem && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-black">
                                  NUEVO ÍTEM
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-slate-700 line-clamp-1 mt-0.5">{draft.descripcion}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                              <span>Stock actual: <strong className="text-slate-700">{draft.currentStock} u.</strong></span>
                              <span className="text-emerald-700 font-bold">Stock final: {finalStock} u. (+{draft.cantidad} u.)</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                            <div className="flex items-center rounded-lg border border-emerald-300 bg-white overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateIngresoQty(idx, draft.cantidad - 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-emerald-50 text-slate-700 transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={draft.cantidad}
                                onChange={e => handleUpdateIngresoQty(idx, parseInt(e.target.value) || 1)}
                                className="w-12 text-center font-mono font-black text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateIngresoQty(idx, draft.cantidad + 1)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-emerald-50 text-slate-700 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {draft.precioUnitario > 0 && showPrices && (
                              <div className="text-right min-w-[70px]">
                                <span className="text-[10px] text-slate-500 uppercase block font-bold">Subtotal</span>
                                <span className="font-mono font-bold text-xs text-emerald-950">
                                  ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveIngresoItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Quitar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>

              {/* Group Totals & Finalize Button */}
              <div className="pt-3 border-t border-[#c4e1f7]">
                <div className="bg-white p-3 rounded-xl border border-[#badbf5] mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-bold uppercase block">
                      {scannerMode === 'salida' ? 'Total Piezas a Retirar' : scannerMode === 'devolucion' ? 'Total Piezas a Devolver' : 'Total Piezas a Ingresar'}
                    </span>
                    <span className="text-base font-black font-mono text-sky-950">
                      {scannerMode === 'salida' ? totalPiezasSalida : scannerMode === 'devolucion' ? totalPiezasDevolucion : totalPiezasIngreso} <span className="text-xs font-sans font-semibold">unidades</span>
                    </span>
                  </div>
                  {showPrices && (
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 font-bold uppercase block">
                        {scannerMode === 'salida' ? 'Valor Total Estimado' : scannerMode === 'devolucion' ? 'Valor Total Estimado' : 'Valor Total Ingreso'}
                      </span>
                      <span className={`text-base font-black font-mono ${
                        scannerMode === 'salida' ? 'text-[#006bb0]' : scannerMode === 'devolucion' ? 'text-amber-700' : 'text-emerald-700'
                      }`}>
                        ${(scannerMode === 'salida' ? totalValorSalida : scannerMode === 'devolucion' ? totalValorDevolucion : totalValorIngreso).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualModal(true)}
                      className={`px-4 py-2.5 rounded-xl border font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        scannerMode === 'salida'
                          ? 'border-sky-300 bg-sky-50 text-[#006bb0] hover:bg-sky-100 hover:border-sky-400'
                          : scannerMode === 'devolucion'
                          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400'
                      }`}
                      title="Carga manual de productos sin lector de código de barras"
                    >
                      <Keyboard className="w-4 h-4" />
                      <span>Carga manual</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestCancel}
                      className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 hover:border-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Cancelar la operación y limpiar todos los productos escaneados"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cancelar Operación</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {scannerMode === 'salida' ? (
                      !isVentas ? (
                        <button
                          type="button"
                          disabled={groupSalidaItems.length === 0}
                          onClick={() => handleFinalizeSalida()}
                          className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 ${
                            groupSalidaItems.length > 0
                              ? 'bg-[#006bb0] hover:bg-[#005590] hover:shadow cursor-pointer'
                              : 'bg-slate-300 cursor-not-allowed text-slate-500'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Finalizar y Retirar Salida N° {nextSalidaNum}</span>
                        </button>
                      ) : null
                    ) : scannerMode === 'devolucion' ? (
                      /* Confirm Devolucion Button */
                      <button
                        type="button"
                        disabled={groupDevolucionItems.length === 0 || !empleadoDevuelve.trim()}
                        onClick={() => handleFinalizeDevolucion()}
                        className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 ${
                          groupDevolucionItems.length > 0 && empleadoDevuelve.trim()
                            ? 'bg-amber-600 hover:bg-amber-500 hover:shadow cursor-pointer'
                            : 'bg-slate-300 cursor-not-allowed text-slate-500'
                        }`}
                        title={!empleadoDevuelve.trim() ? 'Ingresa el empleado que devuelve para emitir remito' : ''}
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Generar Remito de Devolución ({nextDevolucionNum})</span>
                      </button>
                    ) : (
                      /* Confirm Ingreso Button */
                      <button
                        type="button"
                        disabled={groupIngresoItems.length === 0}
                        onClick={() => handleFinalizeIngreso()}
                        className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 ${
                          groupIngresoItems.length > 0
                            ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow cursor-pointer'
                            : 'bg-slate-300 cursor-not-allowed text-slate-500'
                        }`}
                      >
                        <PackagePlus className="w-4 h-4" />
                        <span>Confirmar e Ingresar Stock (+{totalPiezasIngreso} u.)</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* Footer Bar */}
          <div className="bg-[#f4f9fd] border-t border-[#c4e1f7] px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Pañol Verdu y Cía.</span>
            </div>
            <span>Operador: <strong className="text-sky-950">{currentUser.nombre}</strong></span>
          </div>

        </div>
      </div>

      {/* Confirmation Modal for Canceling Operation */}
      {showCancelConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-sky-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 max-w-md w-full p-5 sm:p-6 text-slate-800 animate-in zoom-in-95">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  ¿Cancelar operación?
                </h3>
                <p className="text-xs text-rose-600 font-semibold mt-0.5">
                  Se limpiarán los productos escaneados
                </p>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              Tienes <strong>{scannerMode === 'salida' ? groupSalidaItems.length : scannerMode === 'devolucion' ? groupDevolucionItems.length : groupIngresoItems.length} producto(s)</strong> cargados ({scannerMode === 'salida' ? totalPiezasSalida : scannerMode === 'devolucion' ? totalPiezasDevolucion : totalPiezasIngreso} unidades). Al cancelar, se borrará la lista y se cerrará la ventana.
            </p>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Seguir cargando
              </button>
              <button
                type="button"
                onClick={handleAbortMission}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sí, Cancelar Operación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salida Receipt Modal for Confirmation and Print */}
      <SalidaReceiptModal
        isOpen={isReceiptOpen}
        salidaGroup={completedSalidaGroup}
        onClose={() => {
          setIsReceiptOpen(false);
          onClose();
        }}
        onNewSalida={handleStartNewSalida}
      />

      {/* Devolucion Receipt Modal for Confirmation, Signature and Print */}
      <DevolucionReceiptModal
        isOpen={isDevolucionReceiptOpen}
        devolucionGroup={completedDevolucionGroup}
        onClose={() => {
          setIsDevolucionReceiptOpen(false);
          onClose();
        }}
        onNewDevolucion={handleStartNewDevolucion}
      />

      {/* Manual Entry Modal for Entrada, Devolucion & Salida */}
      <ManualEntryModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        mode={scannerMode}
        availableItems={availableItems}
        onAddSalidaItem={handleManualAddSalidaItem}
        onAddDevolucionItem={handleManualAddDevolucionItem}
        onAddExistingIngresoItem={handleManualAddExistingIngresoItem}
        onAddNewIngresoItem={handleManualAddNewIngresoItem}
        defaultProveedor={proveedorIngresoGlobal}
      />
    </>
  );
};
