import React, { createContext, useContext, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { 
  InventoryItem, 
  SalidaRecord, 
  SalidaGroupRecord,
  SalidaItemEntry,
  DevolucionGroupRecord,
  DevolucionItemEntry,
  IngresoRecord, 
  UserAccount, 
  UserRole,
  ItemCategory 
} from '../types';
import { 
  INITIAL_INVENTORY, 
  INITIAL_SALIDAS, 
  INITIAL_SALIDA_GROUPS,
  INITIAL_INGRESOS, 
  INITIAL_USERS 
} from '../data/initialData';
import { replaceYazWithYas, sanitizeYazObject } from '../utils/sanitizeUtils';

export type MainNavSection = ItemCategory | 'salidas_log' | 'ingresos_log' | 'administracion_dashboard';

interface InventoryContextType {
  items: InventoryItem[];
  salidas: SalidaRecord[];
  salidaGroups: SalidaGroupRecord[];
  devolucionGroups: DevolucionGroupRecord[];
  ingresos: IngresoRecord[];
  currentUser: UserAccount | null;
  setCurrentUser: (user: UserAccount | null) => void;
  users: UserAccount[];
  activeSection: MainNavSection;
  setActiveSection: (sec: MainNavSection) => void;
  activeSubCategory: string | null;
  setActiveSubCategory: (sub: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  
  // Actions
  addItem: (item: Omit<InventoryItem, 'id' | 'precioTotal'>) => InventoryItem;
  updateItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  
  // Stock Movements
  registerSalida: (data: {
    codigo: string;
    cantidad: number;
    cliente: string;
    retira: string;
    nroRemito?: string;
    notas?: string;
    esTaller?: boolean;
    esDevuelto?: boolean;
  }) => { success: boolean; message: string; salida?: SalidaRecord; remainingStock?: number };

  registerSalidaGroup: (data: {
    items: {
      codigo: string;
      cantidad: number;
    }[];
    retira: string;
    esRemitoInterno: boolean;
    cliente?: string;
    nroRemito?: string;
    notas?: string;
  }) => { 
    success: boolean; 
    message: string; 
    salidaGroup?: SalidaGroupRecord;
  };

  deleteSalidaGroup: (groupId: string, restoreStock?: boolean) => { success: boolean; message: string };
  updateSalidaGroupSignature: (groupId: string, firmaDigital: string, firmadoPor?: string) => void;
  deleteSalida: (salidaId: string, restoreStock?: boolean) => { success: boolean; message: string };
  cleanDuplicateSalidas: () => { removedGroups: number; removedSalidas: number; message: string };
  
  // Devoluciones
  registerDevolucionGroup: (data: {
    items: {
      codigo: string;
      cantidad: number;
      motivo?: string;
    }[];
    empleadoDevuelve: string;
    motivo?: string;
    notas?: string;
  }) => { 
    success: boolean; 
    message: string; 
    devolucionGroup?: DevolucionGroupRecord;
  };
  deleteDevolucionGroup: (groupId: string, subtractStock?: boolean) => { success: boolean; message: string };
  updateDevolucionGroupSignature: (groupId: string, firmaDigital: string, firmadoPor?: string) => void;
  getNextDevolucionNumber: () => number;
  
  registerIngreso: (data: {
    codigo: string;
    proveedor: string;
    descripcion: string;
    cantidad: number;
    factura: string;
    ubicacion?: string;
    categoria?: ItemCategory;
    precioUnitario?: number;
  }) => { success: boolean; message: string; ingreso?: IngresoRecord; newStock?: number };

  // Excel Migration / Import & Export
  importExcelRows: (
    rows: any[], 
    targetCategory: ItemCategory, 
    mode: 'merge' | 'replace'
  ) => { added: number; updated: number; errors: string[] };
  
  exportCategoryToExcel: (category?: ItemCategory | 'all' | 'salidas' | 'ingresos') => void;
  
  // Auth
  login: (username: string, password?: string) => boolean;
  validateLogin: (username: string, password?: string) => { success: boolean; message: string; user?: UserAccount };
  registerUser: (userData: {
    username: string;
    nombre: string;
    rol: UserRole;
    password?: string;
  }) => { success: boolean; message: string; user?: UserAccount };
  hasAdministrador: boolean;
  logout: () => void;
  
  // Helpers & Stats
  findItemByCode: (code: string) => InventoryItem | undefined;
  getLowStockItems: () => InventoryItem[];
  getOutOfStockItems: () => InventoryItem[];
  getStockAntiguoItems: () => InventoryItem[];
  getPorEncargoItems: () => InventoryItem[];
  isItemStockAntiguo: (item: InventoryItem) => boolean;
  getNextSalidaNumber: () => number;
  totalValuation: number;
  totalUnits: number;
  totalSkus: number;
  resetToDefaults: () => void;
  clearAllData: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ITEMS: 'verdu_inventory_items_v18_exact_mv_cajas',
  SALIDAS: 'verdu_inventory_salidas_v18_exact_mv_cajas',
  SALIDA_GROUPS: 'verdu_inventory_salida_groups_v18_exact_mv_cajas',
  DEVOLUCION_GROUPS: 'verdu_inventory_devolucion_groups_v1',
  INGRESOS: 'verdu_inventory_ingresos_v18_exact_mv_cajas',
  USER: 'verdu_inventory_user_v2',
  USERS: 'verdu_inventory_users_list_v2'
};

// Clean legacy cached demo data from previous versions & sanitize any Yaz occurrences
try {
  const legacyPrefixes = [
    'verdu_inventory_items_',
    'verdu_inventory_salidas_',
    'verdu_inventory_salida_groups_',
    'verdu_inventory_ingresos_'
  ];
  const validKeys = Object.values(STORAGE_KEYS);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && legacyPrefixes.some(p => k.startsWith(p)) && !validKeys.includes(k)) {
      localStorage.removeItem(k);
    }
  }

  // Scan and sanitize any 'yaz' with Z to 'yas' with S across all verdu keys in localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('verdu_')) {
      const val = localStorage.getItem(k);
      if (val && /[Yy][Aa][Zz]/.test(val)) {
        localStorage.setItem(k, replaceYazWithYas(val));
      }
    }
  }

  // Also sanitize sessionStorage
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('verdu_')) {
      const val = sessionStorage.getItem(k);
      if (val && /[Yy][Aa][Zz]/.test(val)) {
        sessionStorage.setItem(k, replaceYazWithYas(val));
      }
    }
  }
} catch {
  // ignore storage errors
}

// Helper to guarantee deduplicated and consolidated items inside salida groups
const deduplicateSalidaGroupsList = (groups: SalidaGroupRecord[]): SalidaGroupRecord[] => {
  const seenGroupKeys = new Set<string>();
  const uniqueGroups: SalidaGroupRecord[] = [];

  for (const group of groups) {
    const key = `${group.id || ''}_${group.numeroSalida || 0}_${group.fechaSalida}_${group.horaSalida}_${(group.retira || '').toLowerCase()}_${(group.cliente || '').toLowerCase()}_${(group.nroRemito || '').toLowerCase()}`;
    if (seenGroupKeys.has(key)) continue;
    seenGroupKeys.add(key);

    // Consolidate duplicate products within this group so each product appears strictly ONCE
    const itemMap = new Map<string, SalidaItemEntry>();
    for (const item of group.items || []) {
      const itemKey = (item.codigo || '').trim().toLowerCase();
      if (!itemKey) continue;
      
      if (itemMap.has(itemKey)) {
        const existing = itemMap.get(itemKey)!;
        if (group.totalUnidades && group.totalUnidades === existing.cantidad && existing.cantidad === item.cantidad) {
          // Do not double count accidental duplicate row
        } else {
          existing.cantidad += item.cantidad;
          existing.precioTotal = existing.cantidad * existing.precioUnitario;
        }
        existing.stockRemanente = item.stockRemanente !== undefined ? item.stockRemanente : existing.stockRemanente;
      } else {
        itemMap.set(itemKey, { ...item });
      }
    }
    const consolidatedItems = Array.from(itemMap.values());
    const totalUnidades = consolidatedItems.reduce((sum, it) => sum + it.cantidad, 0);
    const totalValor = consolidatedItems.reduce((sum, it) => sum + it.precioTotal, 0);

    uniqueGroups.push({
      ...group,
      items: consolidatedItems,
      totalUnidades: group.totalUnidades && group.totalUnidades <= totalUnidades ? group.totalUnidades : totalUnidades,
      totalValor
    });
  }
  return uniqueGroups;
};

// Helper to guarantee deduplicated individual salidas
const deduplicateSalidasList = (records: SalidaRecord[]): SalidaRecord[] => {
  const seenKeys = new Set<string>();
  const uniqueRecords: SalidaRecord[] = [];

  for (const rec of records) {
    const key = `${rec.salidaGroupId || ''}_${rec.numeroSalida || 0}_${(rec.codigo || '').trim().toLowerCase()}_${rec.fechaSalida}_${(rec.retira || '').trim().toLowerCase()}_${(rec.cliente || '').trim().toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniqueRecords.push(rec);
  }
  return uniqueRecords;
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (saved) {
        return sanitizeYazObject(JSON.parse(saved));
      }
      return sanitizeYazObject(INITIAL_INVENTORY);
    } catch {
      return sanitizeYazObject(INITIAL_INVENTORY);
    }
  });

  const [salidas, setSalidas] = useState<SalidaRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SALIDAS);
      if (saved) return deduplicateSalidasList(sanitizeYazObject(JSON.parse(saved)));
      return deduplicateSalidasList(sanitizeYazObject(INITIAL_SALIDAS));
    } catch {
      return deduplicateSalidasList(sanitizeYazObject(INITIAL_SALIDAS));
    }
  });

  const [salidaGroups, setSalidaGroups] = useState<SalidaGroupRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SALIDA_GROUPS);
      if (saved) return deduplicateSalidaGroupsList(sanitizeYazObject(JSON.parse(saved)));
      return deduplicateSalidaGroupsList(sanitizeYazObject(INITIAL_SALIDA_GROUPS));
    } catch {
      return deduplicateSalidaGroupsList(sanitizeYazObject(INITIAL_SALIDA_GROUPS));
    }
  });

  const [devolucionGroups, setDevolucionGroups] = useState<DevolucionGroupRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DEVOLUCION_GROUPS);
      return saved ? sanitizeYazObject(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  const [ingresos, setIngresos] = useState<IngresoRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INGRESOS);
      return saved ? sanitizeYazObject(JSON.parse(saved)) : sanitizeYazObject(INITIAL_INGRESOS);
    } catch {
      return sanitizeYazObject(INITIAL_INGRESOS);
    }
  });

  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        let parsed: UserAccount[] = sanitizeYazObject(JSON.parse(saved));
        // Ensure panol account has name Marcelo
        parsed = parsed.map(u => {
          if (u.username.toLowerCase() === 'panol' || u.rol === 'panolero') {
            return { ...u, nombre: 'Marcelo' };
          }
          return u;
        });
        // Remove legacy mock admin or mock gerente if it was auto-seeded with id usr-1 and verdu password
        parsed = parsed.filter(u => !(u.id === 'usr-1' && (u.username === 'admin' || (u.username === 'gerente' && u.nombre === 'Gerencia'))));
        const existingUsers = new Set(parsed.map(u => u.username.toLowerCase()));
        const missing = INITIAL_USERS.filter(u => !existingUsers.has(u.username.toLowerCase())).map(u => sanitizeYazObject(u));
        const combined = [...parsed, ...missing];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(combined));
        return combined;
      }
      return sanitizeYazObject(INITIAL_USERS);
    } catch {
      return sanitizeYazObject(INITIAL_USERS);
    }
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) {
        let parsed: UserAccount = sanitizeYazObject(JSON.parse(saved));
        if (parsed.username.toLowerCase() === 'panol' || parsed.rol === 'panolero') {
          parsed.nombre = 'Marcelo';
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(parsed));
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [activeSection, setActiveSection] = useState<MainNavSection>('panol');
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save items to storage', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SALIDAS, JSON.stringify(salidas));
    } catch (e) {
      console.error('Failed to save salidas to storage', e);
    }
  }, [salidas]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SALIDA_GROUPS, JSON.stringify(salidaGroups));
    } catch (e) {
      console.error('Failed to save salidaGroups to storage', e);
    }
  }, [salidaGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DEVOLUCION_GROUPS, JSON.stringify(devolucionGroups));
    } catch (e) {
      console.error('Failed to save devolucionGroups to storage', e);
    }
  }, [devolucionGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INGRESOS, JSON.stringify(ingresos));
    } catch (e) {
      console.error('Failed to save ingresos to storage', e);
    }
  }, [ingresos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } catch (e) {
      console.error('Failed to save user', e);
    }
  }, [currentUser]);

  // Audio Beep for Scanners
  const playBeep = (type: 'success' | 'warning' | 'error' = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.08); // E6 note
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  const findItemByCode = (code: string): InventoryItem | undefined => {
    if (!code) return undefined;
    const cleanCode = code.trim().toLowerCase();
    const cleanCodeAlphaNum = cleanCode.replace(/[^a-zA-Z0-9]/g, '');
    
    return items.find(item => {
      // 1. Exact match with internal Product Code
      if (item.codigo.toLowerCase() === cleanCode) return true;
      
      // 2. Exact match with real scanned Physical Barcode (if assigned)
      if (item.codigoBarras && item.codigoBarras.trim() !== '' && item.codigoBarras.toLowerCase() === cleanCode) {
        return true;
      }

      // 3. Match code parts if composite (e.g. "CODE1 / CODE2")
      const codeParts = item.codigo.split(/[\/,;]+/).map(p => p.trim().toLowerCase()).filter(Boolean);
      if (codeParts.includes(cleanCode)) return true;
      if (cleanCodeAlphaNum && codeParts.some(p => p.replace(/[^a-zA-Z0-9]/g, '') === cleanCodeAlphaNum)) {
        return true;
      }

      // 4. Match barcode parts if composite (e.g. "AF25969 / P781228")
      if (item.codigoBarras && item.codigoBarras.trim() !== '') {
        const barcodeParts = item.codigoBarras.split(/[\/,;\s]+/).map(p => p.trim().toLowerCase()).filter(Boolean);
        if (barcodeParts.includes(cleanCode)) return true;
        if (cleanCodeAlphaNum && barcodeParts.some(p => p.replace(/[^a-zA-Z0-9]/g, '') === cleanCodeAlphaNum)) {
          return true;
        }
      }

      // 5. Alphanumeric match with internal Product Code
      if (cleanCodeAlphaNum && item.codigo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanCodeAlphaNum) {
        return true;
      }

      // 6. Alphanumeric match with real physical barcode
      if (cleanCodeAlphaNum && item.codigoBarras && item.codigoBarras.trim() !== '') {
        if (item.codigoBarras.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanCodeAlphaNum) {
          return true;
        }
      }

      return false;
    });
  };

  const addItem = (newItemData: Omit<InventoryItem, 'id' | 'precioTotal'>): InventoryItem => {
    const id = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const precioTotal = (newItemData.stock || 0) * (newItemData.precio || 0);
    const item: InventoryItem = sanitizeYazObject({
      ...newItemData,
      id,
      precioTotal,
      codigoBarras: newItemData.codigoBarras?.trim() || ''
    });

    setItems(prev => [item, ...prev]);
    return item;
  };

  const updateItem = (id: string, updates: Partial<InventoryItem>) => {
    const cleanUpdates = sanitizeYazObject(updates);
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...cleanUpdates };
        updated.precioTotal = (updated.stock || 0) * (updated.precio || 0);
        return updated;
      }
      return item;
    }));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Real-time Salida registration
  const registerSalida = ({
    codigo,
    cantidad,
    cliente,
    retira,
    nroRemito = 'S/N',
    notas = '',
    esTaller = false,
    esDevuelto = false
  }: {
    codigo: string;
    cantidad: number;
    cliente: string;
    retira: string;
    nroRemito?: string;
    notas?: string;
    esTaller?: boolean;
    esDevuelto?: boolean;
  }) => {
    const item = findItemByCode(codigo);
    if (!item) {
      playBeep('error');
      return { success: false, message: `No se encontró el producto con código "${codigo}" en el inventario.` };
    }

    if (cantidad <= 0) {
      playBeep('error');
      return { success: false, message: 'La cantidad a retirar debe ser mayor a 0.' };
    }

    if (item.stock < cantidad && !esDevuelto) {
      playBeep('warning');
      return { 
        success: false, 
        message: `Stock insuficiente. Disponible: ${item.stock} u. Solicitado: ${cantidad} u.` 
      };
    }

    const newStock = esDevuelto ? item.stock + cantidad : Math.max(0, item.stock - cantidad);
    
    // Update inventory item
    updateItem(item.id, {
      stock: newStock,
      precioTotal: newStock * item.precio
    });

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const salidaRecord: SalidaRecord = {
      id: `sal-${Date.now()}`,
      nroRemito: replaceYazWithYas(nroRemito.trim() || 'S/N'),
      codigo: item.codigo,
      descripcion: replaceYazWithYas(item.descripcion),
      fechaSalida: formattedDate,
      cliente: replaceYazWithYas(cliente.trim() || 'Verdu y Cía (General)'),
      retira: replaceYazWithYas(retira.trim() || currentUser?.nombre || ''),
      cantidad,
      precioUnitario: item.precio,
      categoria: item.categoria,
      esTaller,
      esDevuelto,
      notas: replaceYazWithYas(notas),
      usuarioRegistro: replaceYazWithYas(currentUser?.nombre || '')
    };

    setSalidas(prev => [salidaRecord, ...prev]);
    playBeep('success');

    // Confetti effect for exciting feedback on successful withdrawal
    try {
      confetti({
        particleCount: 28,
        spread: 45,
        origin: { y: 0.8 },
        colors: ['#0080D0', '#38bdf8', '#0284c7']
      });
    } catch {}

    return { 
      success: true, 
      message: `Salida registrada exitosamente. Nuevo stock de ${item.codigo}: ${newStock} u.`,
      salida: salidaRecord,
      remainingStock: newStock
    };
  };

  const getNextSalidaNumber = (): number => {
    if (salidaGroups.length === 0) return 1;
    const maxNum = Math.max(...salidaGroups.map(g => g.numeroSalida || 0));
    return maxNum > 0 ? maxNum + 1 : 1;
  };

  const registerSalidaGroup = ({
    items: requestedItems,
    retira,
    esRemitoInterno,
    cliente = '',
    nroRemito = '',
    notas = ''
  }: {
    items: { codigo: string; cantidad: number }[];
    retira: string;
    esRemitoInterno: boolean;
    cliente?: string;
    nroRemito?: string;
    notas?: string;
  }) => {
    if (!requestedItems || requestedItems.length === 0) {
      playBeep('error');
      return { success: false, message: 'No hay productos seleccionados para el lote de salida.' };
    }

    const employeeName = replaceYazWithYas(retira.trim() || currentUser?.nombre || '');
    const clientName = replaceYazWithYas(esRemitoInterno 
      ? (cliente.trim() || 'Taller Interno / Flota Propia') 
      : (cliente.trim() || 'Cliente Externo'));

    // Consolidate requested items by canonical product code so no product appears twice in the same dispatch
    const aggregatedMap = new Map<string, number>();
    for (const req of requestedItems) {
      const clean = req.codigo.trim();
      if (clean && req.cantidad > 0) {
        const found = findItemByCode(clean);
        const canonCode = found ? found.codigo : clean;
        const currentQty = aggregatedMap.get(canonCode) || 0;
        aggregatedMap.set(canonCode, currentQty + req.cantidad);
      }
    }

    const consolidatedRequestedItems = Array.from(aggregatedMap.entries()).map(([codigo, cantidad]) => ({
      codigo,
      cantidad
    }));

    // Validation pass
    for (const req of consolidatedRequestedItems) {
      if (req.cantidad <= 0) {
        playBeep('error');
        return { success: false, message: `La cantidad para el código "${req.codigo}" debe ser mayor a 0.` };
      }
      const found = findItemByCode(req.codigo);
      if (!found) {
        playBeep('error');
        return { success: false, message: `No se encontró el producto con código "${req.codigo}" en pañol.` };
      }
      if (found.stock < req.cantidad) {
        playBeep('warning');
        return { 
          success: false, 
          message: `Stock insuficiente para "${found.codigo} - ${found.descripcion}". En pañol: ${found.stock} u. Solicitado: ${req.cantidad} u.` 
        };
      }
    }

    const nextNum = getNextSalidaNumber();
    const nextNumFormatted = `Salida N° ${nextNum}`;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const groupId = `grp-sal-${Date.now()}`;
    const remitoFinal = nroRemito.trim() || (esRemitoInterno ? `INT-${String(nextNum).padStart(4, '0')}` : `Rº${18980 + nextNum}`);

    const dispatchedEntries: SalidaItemEntry[] = [];
    const newSalidaRecords: SalidaRecord[] = [];

    // Deduct stock for all items deterministically
    setItems(prevItems => {
      return prevItems.map(item => {
        const match = consolidatedRequestedItems.find(req => 
          item.codigo.toLowerCase() === req.codigo.trim().toLowerCase() ||
          (item.codigoBarras && item.codigoBarras.toLowerCase() === req.codigo.trim().toLowerCase())
        );
        if (match) {
          const newStock = Math.max(0, item.stock - match.cantidad);
          return {
            ...item,
            stock: newStock,
            precioTotal: newStock * item.precio
          };
        }
        return item;
      });
    });

    // Create entry and record list from consolidated items
    for (const req of consolidatedRequestedItems) {
      const item = findItemByCode(req.codigo);
      if (item) {
        const newStock = Math.max(0, item.stock - req.cantidad);
        const entry: SalidaItemEntry = {
          id: `item-entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          codigo: item.codigo,
          descripcion: item.descripcion,
          proveedor: item.proveedor,
          ubicacion: item.ubicacion,
          cantidad: req.cantidad,
          stockDisponible: item.stock,
          stockRemanente: newStock,
          precioUnitario: item.precio,
          precioTotal: req.cantidad * item.precio,
          categoria: item.categoria
        };
        dispatchedEntries.push(entry);

        const salRecord: SalidaRecord = {
          id: `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          salidaGroupId: groupId,
          numeroSalida: nextNum,
          numeroSalidaFormatted: nextNumFormatted,
          nroRemito: remitoFinal,
          codigo: item.codigo,
          descripcion: item.descripcion,
          fechaSalida: formattedDate,
          horaSalida: formattedTime,
          cliente: clientName,
          retira: employeeName,
          cantidad: req.cantidad,
          precioUnitario: item.precio,
          categoria: item.categoria,
          esTaller: esRemitoInterno,
          esRemitoInterno,
          notas,
          usuarioRegistro: currentUser.nombre
        };
        newSalidaRecords.push(salRecord);
      }
    }

    const totalUnidades = dispatchedEntries.reduce((sum, e) => sum + e.cantidad, 0);
    const totalValor = dispatchedEntries.reduce((sum, e) => sum + e.precioTotal, 0);

    const newGroup: SalidaGroupRecord = {
      id: groupId,
      numeroSalida: nextNum,
      numeroSalidaFormatted: nextNumFormatted,
      fechaSalida: formattedDate,
      horaSalida: formattedTime,
      retira: employeeName,
      esRemitoInterno,
      cliente: clientName,
      nroRemito: remitoFinal,
      notas,
      usuarioRegistro: currentUser.nombre,
      items: dispatchedEntries,
      totalUnidades,
      totalValor
    };

    setSalidaGroups(prev => deduplicateSalidaGroupsList([newGroup, ...prev]));
    setSalidas(prev => deduplicateSalidasList([...newSalidaRecords, ...prev]));

    playBeep('success');

    try {
      confetti({
        particleCount: 50,
        spread: 65,
        origin: { y: 0.7 },
        colors: ['#0080D0', '#10b981', '#f59e0b', '#38bdf8']
      });
    } catch {}

    return {
      success: true,
      message: `${nextNumFormatted} registrada con éxito. ${totalUnidades} piezas despachadas para ${employeeName}.`,
      salidaGroup: newGroup
    };
  };

  const deleteSalidaGroup = (groupId: string, restoreStock: boolean = true) => {
    const targetGroup = salidaGroups.find(g => g.id === groupId);
    if (!targetGroup) return { success: false, message: 'Salida no encontrada.' };

    if (restoreStock && targetGroup.items) {
      setItems(prevItems => {
        const updated = [...prevItems];
        for (const itemEntry of targetGroup.items) {
          const idx = updated.findIndex(it => 
            it.codigo.toLowerCase() === itemEntry.codigo.toLowerCase() ||
            (it.codigoBarras && it.codigoBarras.toLowerCase() === itemEntry.codigo.toLowerCase())
          );
          if (idx !== -1) {
            const current = updated[idx];
            const restoredStock = current.stock + itemEntry.cantidad;
            updated[idx] = {
              ...current,
              stock: restoredStock,
              precioTotal: restoredStock * current.precio
            };
          }
        }
        return updated;
      });
    }

    setSalidaGroups(prev => prev.filter(g => g.id !== groupId));
    setSalidas(prev => prev.filter(s => s.salidaGroupId !== groupId));
    return { success: true, message: `Salida "${targetGroup.numeroSalidaFormatted}" eliminada correctamente.` };
  };

  const updateSalidaGroupSignature = (groupId: string, firmaDigital: string, firmadoPor?: string) => {
    const firmaFecha = new Date().toLocaleString('es-AR');
    setSalidaGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          firmaDigital,
          firmaFecha,
          firmadoPor: firmadoPor || g.retira
        };
      }
      return g;
    }));
  };

  const getNextDevolucionNumber = (): number => {
    if (devolucionGroups.length === 0) return 1;
    const maxNum = Math.max(...devolucionGroups.map(g => g.numeroDevolucion || 0));
    return maxNum > 0 ? maxNum + 1 : 1;
  };

  const registerDevolucionGroup = ({
    items: requestedItems,
    empleadoDevuelve,
    motivo = 'Devolución pañol',
    notas = ''
  }: {
    items: { codigo: string; cantidad: number; motivo?: string }[];
    empleadoDevuelve: string;
    motivo?: string;
    notas?: string;
  }) => {
    if (!requestedItems || requestedItems.length === 0) {
      playBeep('error');
      return { success: false, message: 'No hay productos seleccionados para devolver.' };
    }

    const employeeName = replaceYazWithYas(empleadoDevuelve.trim());
    if (!employeeName) {
      playBeep('error');
      return { success: false, message: 'Debe ingresar el empleado que devuelve el material.' };
    }

    // Consolidate requested items by canonical product code
    const aggregatedMap = new Map<string, { cantidad: number; motivo?: string }>();
    for (const req of requestedItems) {
      const clean = req.codigo.trim();
      if (clean && req.cantidad > 0) {
        const found = findItemByCode(clean);
        const canonCode = found ? found.codigo : clean;
        const current = aggregatedMap.get(canonCode) || { cantidad: 0, motivo: req.motivo || motivo };
        aggregatedMap.set(canonCode, {
          cantidad: current.cantidad + req.cantidad,
          motivo: req.motivo || current.motivo
        });
      }
    }

    const consolidatedItems = Array.from(aggregatedMap.entries()).map(([codigo, val]) => ({
      codigo,
      cantidad: val.cantidad,
      motivo: val.motivo
    }));

    if (consolidatedItems.length === 0) {
      playBeep('error');
      return { success: false, message: 'No hay productos válidos con cantidad mayor a 0.' };
    }

    const nextNum = getNextDevolucionNumber();
    const nextNumFormatted = `Devolución N° ${nextNum}`;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const groupId = `grp-dev-${Date.now()}`;

    const returnedEntries: DevolucionItemEntry[] = [];
    let totalUnidades = 0;
    let totalValor = 0;

    // Increase stock for all returned items in inventory
    setItems(prevItems => {
      return prevItems.map(item => {
        const match = consolidatedItems.find(req => 
          item.codigo.toLowerCase() === req.codigo.trim().toLowerCase() ||
          (item.codigoBarras && item.codigoBarras.toLowerCase() === req.codigo.trim().toLowerCase())
        );
        if (match) {
          const newStock = (item.stock || 0) + match.cantidad;
          return {
            ...item,
            stock: newStock,
            precioTotal: newStock * (item.precio || 0),
            fechaModificacion: formattedDate,
            usuarioModificacion: currentUser.nombre
          };
        }
        return item;
      });
    });

    for (const req of consolidatedItems) {
      const item = findItemByCode(req.codigo);
      const precioUnit = item?.precio || 0;
      totalUnidades += req.cantidad;
      totalValor += req.cantidad * precioUnit;
      returnedEntries.push({
        codigo: item?.codigo || req.codigo,
        descripcion: item?.descripcion || 'Artículo devuelto',
        cantidad: req.cantidad,
        precioUnitario: precioUnit,
        ubicacion: item?.ubicacion || 'PAÑOL',
        motivo: req.motivo || motivo
      });
    }

    const newGroup: DevolucionGroupRecord = {
      id: groupId,
      numeroDevolucion: nextNum,
      numeroDevolucionFormatted: nextNumFormatted,
      fechaDevolucion: formattedDate,
      horaDevolucion: formattedTime,
      empleadoDevuelve: employeeName,
      motivo: replaceYazWithYas(motivo.trim() || 'Devolución pañol'),
      notas: replaceYazWithYas(notas.trim()),
      usuarioRegistro: replaceYazWithYas(currentUser?.nombre || 'Pañolero'),
      items: returnedEntries,
      totalUnidades,
      totalValor
    };

    setDevolucionGroups(prev => [newGroup, ...prev]);
    playBeep('success');

    try {
      confetti({
        particleCount: 30,
        spread: 45,
        origin: { y: 0.8 },
        colors: ['#f59e0b', '#10b981', '#0284c7']
      });
    } catch {}

    return {
      success: true,
      message: `Devolución N° ${nextNum} registrada correctamente. ${totalUnidades} piezas reingresadas a pañol.`,
      devolucionGroup: newGroup
    };
  };

  const deleteDevolucionGroup = (groupId: string, subtractStock: boolean = true) => {
    const targetGroup = devolucionGroups.find(g => g.id === groupId);
    if (!targetGroup) return { success: false, message: 'Devolución no encontrada.' };

    if (subtractStock && targetGroup.items) {
      setItems(prevItems => {
        const updated = [...prevItems];
        for (const itemEntry of targetGroup.items) {
          const idx = updated.findIndex(it => 
            it.codigo.toLowerCase() === itemEntry.codigo.toLowerCase() ||
            (it.codigoBarras && it.codigoBarras.toLowerCase() === itemEntry.codigo.toLowerCase())
          );
          if (idx !== -1) {
            const current = updated[idx];
            const newStock = Math.max(0, current.stock - itemEntry.cantidad);
            updated[idx] = {
              ...current,
              stock: newStock,
              precioTotal: newStock * current.precio
            };
          }
        }
        return updated;
      });
    }

    setDevolucionGroups(prev => prev.filter(g => g.id !== groupId));
    return { success: true, message: `Devolución "${targetGroup.numeroDevolucionFormatted}" eliminada.` };
  };

  const updateDevolucionGroupSignature = (groupId: string, firmaDigital: string, firmadoPor?: string) => {
    const firmaFecha = new Date().toLocaleString('es-AR');
    setDevolucionGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          firmaDigital,
          firmaFecha,
          firmadoPor: firmadoPor || g.empleadoDevuelve
        };
      }
      return g;
    }));
  };

  const deleteSalida = (salidaId: string, restoreStock: boolean = true) => {
    const target = salidas.find(s => s.id === salidaId);
    if (!target) return { success: false, message: 'Registro de salida no encontrado.' };

    if (restoreStock) {
      setItems(prevItems => {
        const idx = prevItems.findIndex(it => 
          it.codigo.toLowerCase() === target.codigo.toLowerCase() ||
          (it.codigoBarras && it.codigoBarras.toLowerCase() === target.codigo.toLowerCase())
        );
        if (idx !== -1) {
          const updated = [...prevItems];
          const current = updated[idx];
          const restoredStock = current.stock + target.cantidad;
          updated[idx] = {
            ...current,
            stock: restoredStock,
            precioTotal: restoredStock * current.precio
          };
          return updated;
        }
        return prevItems;
      });
    }

    setSalidas(prev => prev.filter(s => s.id !== salidaId));

    if (target.salidaGroupId) {
      setSalidaGroups(prevGroups => {
        return prevGroups.map(group => {
          if (group.id !== target.salidaGroupId) return group;
          const updatedItems = group.items.filter(it => it.codigo.toLowerCase() !== target.codigo.toLowerCase());
          const totalUnidades = updatedItems.reduce((sum, it) => sum + it.cantidad, 0);
          const totalValor = updatedItems.reduce((sum, it) => sum + it.precioTotal, 0);
          return {
            ...group,
            items: updatedItems,
            totalUnidades,
            totalValor
          };
        }).filter(group => group.items.length > 0);
      });
    }

    return { success: true, message: `Registro de "${target.codigo}" eliminado del historial.` };
  };

  const cleanDuplicateSalidas = () => {
    const cleanedGroups = deduplicateSalidaGroupsList(salidaGroups);
    const cleanedSalidas = deduplicateSalidasList(salidas);

    const removedGroups = salidaGroups.length - cleanedGroups.length;
    const removedSalidas = salidas.length - cleanedSalidas.length;

    setSalidaGroups(cleanedGroups);
    setSalidas(cleanedSalidas);

    const totalRemoved = removedGroups + removedSalidas;
    return {
      removedGroups,
      removedSalidas,
      message: totalRemoved > 0 
        ? `Se depuraron ${removedGroups} salidas y ${removedSalidas} registros duplicados del historial. Ahora cada producto aparece una sola vez.`
        : 'Historial verificado: todos los registros y productos están únicos y sin duplicados.'
    };
  };

  const registerIngreso = ({
    codigo,
    proveedor,
    descripcion,
    cantidad,
    factura,
    ubicacion = 'A',
    categoria = 'panol',
    precioUnitario
  }: {
    codigo: string;
    proveedor: string;
    descripcion: string;
    cantidad: number;
    factura: string;
    ubicacion?: string;
    categoria?: ItemCategory;
    precioUnitario?: number;
  }) => {
    if (!codigo || cantidad <= 0) {
      playBeep('error');
      return { success: false, message: 'Código y cantidad válida son requeridos.' };
    }

    const existing = findItemByCode(codigo);
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let updatedStock = cantidad;

    if (existing) {
      updatedStock = existing.stock + cantidad;
      updateItem(existing.id, {
        stock: updatedStock,
        precio: precioUnitario !== undefined ? precioUnitario : existing.precio,
        precioTotal: updatedStock * (precioUnitario !== undefined ? precioUnitario : existing.precio),
        ubicacion: ubicacion || existing.ubicacion,
        proveedor: proveedor || existing.proveedor
      });
    } else {
      const p = precioUnitario || 0;
      addItem({
        codigo: codigo.trim(),
        proveedor: proveedor.trim() || 'SULLAIR',
        descripcion: descripcion.trim() || 'Nuevo Producto Ingresado',
        stock: cantidad,
        stockMinimo: 1,
        ubicacion: ubicacion.trim() || 'A',
        categoria,
        fechaRegistro: formattedDate,
        precio: p,
        codigoBarras: ''
      });
    }

    const ingresoRecord: IngresoRecord = {
      id: `ing-${Date.now()}`,
      codigo: codigo.trim(),
      proveedor: replaceYazWithYas(proveedor.trim() || 'SULLAIR'),
      descripcion: replaceYazWithYas(descripcion.trim() || (existing ? existing.descripcion : 'Producto Ingresado')),
      cantidad,
      fechaIngreso: formattedDate,
      factura: replaceYazWithYas(factura.trim() || 'S/F'),
      precioUnitario: precioUnitario || (existing ? existing.precio : 0),
      ubicacion: ubicacion || (existing ? existing.ubicacion : 'A'),
      categoria: existing ? existing.categoria : categoria,
      usuarioRegistro: replaceYazWithYas(currentUser?.nombre || '')
    };

    setIngresos(prev => [ingresoRecord, ...prev]);
    playBeep('success');

    return {
      success: true,
      message: `Ingreso registrado. Stock actual de ${codigo}: ${updatedStock} u.`,
      ingreso: ingresoRecord,
      newStock: updatedStock
    };
  };

  // Excel Importer from Array of parsed rows
  const importExcelRows = (
    rows: any[], 
    targetCategory: ItemCategory, 
    mode: 'merge' | 'replace'
  ) => {
    let added = 0;
    let updated = 0;
    const errors: string[] = [];

    if (!rows || rows.length === 0) {
      return { added: 0, updated: 0, errors: ['El archivo no contiene filas válidas.'] };
    }

    const parsedItems: InventoryItem[] = [];

    rows.forEach((row, idx) => {
      // Flexible column name matching (case-insensitive & accent-insensitive)
      const getVal = (possibleKeys: string[]) => {
        for (const k of Object.keys(row)) {
          const cleanK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          for (const target of possibleKeys) {
            if (cleanK === target || cleanK.includes(target)) {
              return row[k];
            }
          }
        }
        return undefined;
      };

      // 1. Código: search typical names or take first column if missing
      let rawCode = getVal(['codigo', 'cod', 'code', 'articulo', 'item', 'parte', 'nro de parte', 'numero', 'referencia']);
      if (!rawCode) {
        const keys = Object.keys(row);
        if (keys.length > 0 && row[keys[0]] !== undefined && String(row[keys[0]]).trim() !== '') {
          rawCode = row[keys[0]];
        }
      }
      
      if (!rawCode || String(rawCode).trim() === '') {
        return; // Skip empty rows
      }

      const codigo = String(rawCode).trim().replace(/^´|^`/, '');
      const proveedor = String(getVal(['proveedor', 'marca', 'supplier', 'brand', 'fabricante']) || 'SULLAIR').trim();
      const descripcion = String(getVal(['descripcion', 'desc', 'detalle', 'nombre', 'denominacion', 'repuesto', 'concepto']) || '').trim() || codigo;
      
      const rawStock = getVal(['stock', 'cant', 'cantidad', 'qty', 'existencia', 'unidades', 'saldo']);
      let stock = 0;
      if (typeof rawStock === 'number') {
        stock = Math.max(0, Math.floor(rawStock));
      } else if (rawStock !== undefined && rawStock !== null) {
        const cleanStock = String(rawStock).replace(/[^0-9.-]/g, '');
        stock = Math.max(0, parseInt(cleanStock, 10) || 0);
      }

      const ubicacion = String(getVal(['ubicacion', 'ubi', 'estante', 'cajon', 'posicion', 'pasillo', 'letra', 'seccion']) || 'A').trim().toUpperCase();
      
      const rawPrecio = getVal(['precio', 'unitario', 'price', 'costo', 'valor', 'p.unit', 'p.unitario']);
      let precio = 0;
      if (typeof rawPrecio === 'number') {
        precio = rawPrecio;
      } else if (rawPrecio) {
        const cleanPrice = String(rawPrecio).replace(/\$/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '').trim();
        precio = parseFloat(cleanPrice) || 0;
      }

      const rawFecha = getVal(['fecha', 'f. de control', 'f. de registro', 'f.control', 'f.registro', 'f.ingreso', 'date', 'ultimo movimiento']);
      const fechaRegistro = rawFecha ? String(rawFecha) : new Date().toISOString().split('T')[0];

      const pServicio = parseInt(String(getVal(['servicio', 'p/servicio', 'para servicio', 'p_servicio']) || '0'), 10) || 0;
      const subcat = String(getVal(['subcategoria', 'subcat', 'tipo', 'modelo', 'linea', 'familia']) || '').trim();
      
      const rawPorEncargo = getVal(['encargo', 'por encargo', 'pedido', 'a pedido']);
      const porEncargo = rawPorEncargo === true || String(rawPorEncargo).toLowerCase() === 'si' || String(rawPorEncargo).toLowerCase() === 'true';

      // Detect sheet or category hint if available
      let itemCategory = targetCategory;
      if (row._ORIGEN_HOJA) {
        const hName = String(row._ORIGEN_HOJA).toLowerCase();
        if (hName.includes('fluido') || hName.includes('cajon') || hName.includes('aceite')) itemCategory = 'cajones_fluidos';
        else if (hName.includes('submic') || hName.includes('fxf') || hName.includes('scf')) itemCategory = 'submicronicos';
        else if (hName.includes('rodamiento') || hName.includes('skf') || hName.includes('timken')) itemCategory = 'rodamientos';
        else if (hName.includes('entrepiso') || hName.includes('fleetguard') || hName.includes('lanss')) itemCategory = 'entrepiso';
        else if (hName.includes('import')) itemCategory = 'importado';
        else if (hName.includes('mv') || hName.includes('repuesto mv')) itemCategory = 'repuestos_mv';
        else if (hName.includes('caja')) itemCategory = 'cajas';
      }

      parsedItems.push({
        id: `imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        codigo: replaceYazWithYas(codigo),
        proveedor: replaceYazWithYas(proveedor),
        descripcion: replaceYazWithYas(descripcion),
        stock,
        stockMinimo: 1,
        ubicacion: ubicacion || 'A',
        categoria: itemCategory,
        subcategoria: subcat ? replaceYazWithYas(subcat) : undefined,
        fechaRegistro,
        fechaUltimoMovimiento: fechaRegistro,
        precio,
        precioTotal: stock * precio,
        paraServicio: pServicio || undefined,
        porEncargo: porEncargo || undefined,
        codigoBarras: ''
      });
    });

    if (mode === 'replace') {
      setItems(prev => {
        const remaining = prev.filter(i => i.categoria !== targetCategory);
        return [...remaining, ...parsedItems];
      });
      added = parsedItems.length;
    } else {
      // Merge: Update existing if found in items, or add new
      setItems(prev => {
        const itemMap = new Map<string, InventoryItem>();
        prev.forEach(item => itemMap.set(item.codigo.toLowerCase().trim(), item));

        parsedItems.forEach(newItem => {
          const key = newItem.codigo.toLowerCase().trim();
          if (itemMap.has(key)) {
            const existing = itemMap.get(key)!;
            itemMap.set(key, {
              ...existing,
              stock: newItem.stock,
              precio: newItem.precio > 0 ? newItem.precio : existing.precio,
              precioTotal: newItem.stock * (newItem.precio > 0 ? newItem.precio : existing.precio),
              descripcion: newItem.descripcion && newItem.descripcion !== newItem.codigo ? newItem.descripcion : existing.descripcion,
              proveedor: newItem.proveedor && newItem.proveedor !== 'SULLAIR' ? newItem.proveedor : existing.proveedor,
              ubicacion: newItem.ubicacion || existing.ubicacion,
              categoria: newItem.categoria || existing.categoria,
              porEncargo: newItem.porEncargo !== undefined ? newItem.porEncargo : existing.porEncargo
            });
            updated++;
          } else {
            itemMap.set(key, newItem);
            added++;
          }
        });

        return Array.from(itemMap.values());
      });
    }

    playBeep('success');
    return { added, updated, errors };
  };

  // Export to Excel helper
  const exportCategoryToExcel = (category: ItemCategory | 'all' | 'salidas' | 'ingresos' = 'all') => {
    const wb = XLSX.utils.book_new();

    const isVentas = currentUser?.rol === 'ventas';

    if (category === 'salidas') {
      const data = salidas.map(s => {
        const row: Record<string, any> = {
          'Nº PRESP./REMITO': s.nroRemito,
          'CÓDIGO': s.codigo,
          'DESCRIPCIÓN': s.descripcion,
          'FECHA SALIDA': s.fechaSalida,
          'CLIENTE': s.cliente,
          'RETIRA': s.retira,
          'CANTIDAD': s.cantidad,
          'NOTAS': s.notas || ''
        };
        if (!isVentas) {
          row['PRECIO UNIT.'] = s.precioUnitario || 0;
        }
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'SALIDAS');
      XLSX.writeFile(wb, `Verdu_Panol_Salidas_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (category === 'ingresos') {
      const data = ingresos.map(i => ({
        'CÓDIGO': i.codigo,
        'PROVEEDOR': i.proveedor,
        'DESCRIPCIÓN': i.descripcion,
        'CANTIDAD': i.cantidad,
        'FECHA INGRESO': i.fechaIngreso,
        'FACTURA': i.factura,
        'UBICACIÓN': i.ubicacion || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'INGRESOS');
      XLSX.writeFile(wb, `Verdu_Panol_Ingresos_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    const categoriesToExport: ItemCategory[] = category === 'all' 
      ? ['panol', 'cajones_fluidos', 'submicronicos', 'rodamientos', 'entrepiso', 'importado', 'repuestos_mv', 'cajas']
      : [category as ItemCategory];

    const categoryNames: Record<ItemCategory, string> = {
      panol: 'Pañol General',
      cajones_fluidos: 'Cajones y Fluidos',
      submicronicos: 'Filtros Submicrónicos',
      rodamientos: 'Rodamientos',
      entrepiso: 'Entrepiso Pañol',
      importado: 'Stock Importado',
      repuestos_mv: 'Repuestos MV',
      cajas: 'Cajas Estante'
    };

    categoriesToExport.forEach(cat => {
      const filtered = items.filter(i => i.categoria === cat);
      const data = filtered.map(i => {
        const row: Record<string, any> = {
          'CÓDIGO': i.codigo,
          'PROVEEDOR': i.proveedor,
          'DESCRIPCIÓN': i.descripcion,
          'STOCK': i.stock,
          'UBICACIÓN': i.ubicacion
        };

        if (i.paraServicio) {
          row['P/SERVICIO'] = i.paraServicio;
        }

        if (i.subcategoria) {
          row['SUBCATEGORÍA'] = i.subcategoria;
        }

        // Only management and authorized roles see control dates, prices and totals
        if (!isVentas) {
          row['F. DE CONTROL'] = i.fechaRegistro;
          row['PRECIO'] = i.precio;
          row['TOTAL'] = i.precioTotal;
        }

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, categoryNames[cat].substring(0, 31));
    });

    XLSX.writeFile(wb, `Verdu_Panol_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const validateLogin = (username: string, password?: string): { success: boolean; message: string; user?: UserAccount } => {
    const cleanUsername = (username || '').trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, message: 'Por favor ingresa tu nombre de usuario.' };
    }
    if (!password) {
      return { success: false, message: 'Por favor ingresa tu contraseña.' };
    }

    const user = users.find(u => u.username.toLowerCase() === cleanUsername);
    if (!user) {
      return { 
        success: false, 
        message: `El usuario "${username}" no está registrado. Si aún no tienes cuenta, puedes registrarte en la pestaña "Crear Cuenta".` 
      };
    }

    if (user.password && user.password !== password) {
      return { 
        success: false, 
        message: 'Contraseña incorrecta. Por favor, verifica la clave ingresada.' 
      };
    }

    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.error('Error storing user in localStorage:', e);
    }
    return { success: true, message: 'Inicio de sesión exitoso.', user };
  };

  const login = (username: string, password?: string): boolean => {
    const res = validateLogin(username, password);
    return res.success;
  };

  const registerUser = (userData: {
    username: string;
    nombre: string;
    rol: UserRole;
    password?: string;
  }): { success: boolean; message: string; user?: UserAccount } => {
    const cleanUsername = (userData.username || '').trim().toLowerCase().replace(/\s+/g, '');
    const cleanNombre = (userData.nombre || '').trim();
    const cleanPass = userData.password || '';

    if (!cleanNombre) {
      return { success: false, message: 'Por favor ingresa tu nombre completo o alias.' };
    }
    if (!cleanUsername) {
      return { success: false, message: 'Por favor define un nombre de usuario.' };
    }
    if (cleanUsername.length < 3) {
      return { success: false, message: 'El nombre de usuario debe tener al menos 3 caracteres.' };
    }
    if (!cleanPass || cleanPass.length < 8) {
      return { success: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    if (!/[A-Z]/.test(cleanPass)) {
      return { success: false, message: 'La contraseña debe contener al menos una letra mayúscula.' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±°]/.test(cleanPass)) {
      return { success: false, message: 'La contraseña debe contener al menos un carácter especial (ej: ! @ # $ % * - _).' };
    }

    // Check if username already taken
    const existingUser = users.find(u => u.username.toLowerCase() === cleanUsername);
    if (existingUser) {
      return { success: false, message: `El nombre de usuario "${cleanUsername}" ya existe. Por favor elige otro.` };
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      username: cleanUsername,
      nombre: cleanNombre,
      rol: userData.rol,
      password: cleanPass,
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    } catch (e) {
      console.error('Error storing users in localStorage:', e);
    }

    // Automatically log in with the new account
    setCurrentUser(newUser);
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    } catch (e) {
      console.error('Error storing user in localStorage:', e);
    }

    return { success: true, message: 'Cuenta creada con éxito. ¡Bienvenido a Verdu y Cía.!', user: newUser };
  };

  const hasAdministrador = users.some(u => u.rol === 'administracion');

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (e) {
      console.error('Error removing user from localStorage:', e);
    }
  };

  // Helper to determine if an item has had no movements or modifications for >= 3 years
  const isItemStockAntiguo = (item: InventoryItem): boolean => {
    // Check if there are any recorded salidas for this item code
    const itemSalidas = salidas.filter(s => s.codigo.toLowerCase() === item.codigo.toLowerCase());
    let lastMovementDateStr = item.fechaUltimoMovimiento || item.fechaRegistro || '2020-01-01';

    if (itemSalidas.length > 0) {
      // Find latest salida date
      const sortedSalidas = [...itemSalidas].sort((a, b) => new Date(b.fechaSalida).getTime() - new Date(a.fechaSalida).getTime());
      const latestSalidaDate = sortedSalidas[0].fechaSalida;
      if (new Date(latestSalidaDate).getTime() > new Date(lastMovementDateStr).getTime()) {
        lastMovementDateStr = latestSalidaDate;
      }
    }

    try {
      const lastDate = new Date(lastMovementDateStr);
      if (isNaN(lastDate.getTime())) return false;
      
      // Relative to current time / reference year (2026): 3 years = ~1095 days
      const diffMs = Date.now() - lastDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      // Also consider items registered before 2023 or >= 3 years ago (1095 days)
      return diffDays >= (365.25 * 3) || lastDate.getFullYear() <= (new Date().getFullYear() - 3);
    } catch {
      return false;
    }
  };

  // Stock alerts: Items with porEncargo === true DO NOT trigger low stock or out of stock warnings
  const getLowStockItems = () => items.filter(i => !i.porEncargo && i.stock > 0 && i.stock <= (i.stockMinimo || 1));
  const getOutOfStockItems = () => items.filter(i => !i.porEncargo && i.stock === 0);
  const getStockAntiguoItems = () => items.filter(isItemStockAntiguo);
  const getPorEncargoItems = () => items.filter(i => i.porEncargo === true);

  const totalValuation = items.reduce((sum, item) => sum + (item.precioTotal || (item.stock * item.precio) || 0), 0);
  const totalUnits = items.reduce((sum, item) => sum + (item.stock || 0), 0);
  const totalSkus = items.length;

  const clearAllData = () => {
    setItems([]);
    setSalidas([]);
    setSalidaGroups([]);
    setIngresos([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.ITEMS);
      localStorage.removeItem(STORAGE_KEYS.SALIDAS);
      localStorage.removeItem(STORAGE_KEYS.SALIDA_GROUPS);
      localStorage.removeItem(STORAGE_KEYS.INGRESOS);
    } catch (e) {
      console.error('Error clearing data:', e);
    }
  };

  const resetToDefaults = () => {
    setItems(INITIAL_INVENTORY);
    setSalidas(INITIAL_SALIDAS);
    setSalidaGroups(INITIAL_SALIDA_GROUPS);
    setIngresos(INITIAL_INGRESOS);
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(INITIAL_INVENTORY));
      localStorage.setItem(STORAGE_KEYS.SALIDAS, JSON.stringify(INITIAL_SALIDAS));
      localStorage.setItem(STORAGE_KEYS.SALIDA_GROUPS, JSON.stringify(INITIAL_SALIDA_GROUPS));
      localStorage.setItem(STORAGE_KEYS.INGRESOS, JSON.stringify(INITIAL_INGRESOS));
    } catch (e) {
      console.error('Error resetting to defaults:', e);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        salidas,
        salidaGroups,
        devolucionGroups,
        ingresos,
        currentUser,
        setCurrentUser,
        users,
        activeSection,
        setActiveSection,
        activeSubCategory,
        setActiveSubCategory,
        searchQuery,
        setSearchQuery,
        addItem,
        updateItem,
        deleteItem,
        registerSalida,
        registerSalidaGroup,
        deleteSalidaGroup,
        updateSalidaGroupSignature,
        deleteSalida,
        cleanDuplicateSalidas,
        registerDevolucionGroup,
        deleteDevolucionGroup,
        updateDevolucionGroupSignature,
        getNextDevolucionNumber,
        registerIngreso,
        importExcelRows,
        exportCategoryToExcel,
        login,
        validateLogin,
        registerUser,
        hasAdministrador,
        logout,
        findItemByCode,
        getLowStockItems,
        getOutOfStockItems,
        getStockAntiguoItems,
        getPorEncargoItems,
        isItemStockAntiguo,
        getNextSalidaNumber,
        totalValuation,
        totalUnits,
        totalSkus,
        resetToDefaults,
        clearAllData
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
