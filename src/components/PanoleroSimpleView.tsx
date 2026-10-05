import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUpRight, 
  PackagePlus, 
  RotateCcw,
  Search, 
  MapPin, 
  X,
  History,
  Barcode,
  Camera,
  Check,
  Trash2
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem, SalidaRecord, IngresoRecord } from '../types';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { formatDisplayDate } from '../utils/dateUtils';

interface PanoleroSimpleViewProps {
  onOpenScanner: (initialCode?: string, mode?: 'salida' | 'ingreso' | 'devolucion') => void;
  onOpenBarcode?: (item: InventoryItem) => void;
  onOpenDetail?: (item: InventoryItem) => void;
}

export const PanoleroSimpleView: React.FC<PanoleroSimpleViewProps> = ({
  onOpenScanner
}) => {
  const { items, currentUser, salidas, ingresos, devolucionGroups, deleteSalida, deleteIngreso, deleteDevolucionItem } = useInventory();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showRecentMovimientos, setShowRecentMovimientos] = useState<boolean>(false);
  const [movTab, setMovTab] = useState<'salida' | 'entrada' | 'devolucion'>('salida');
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);
  const [pendingDelete, setPendingDelete] = useState<{ tab: 'salida' | 'entrada' | 'devolucion'; codigo: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isVentas = currentUser?.rol === 'ventas';

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Listen to hardware barcode scanner on main view to fill the search box instead of auto-opening Salida
  useEffect(() => {
    const handleScanSearch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setSearchTerm(customEvent.detail);
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('panolero-scan-search', handleScanSearch);
    return () => window.removeEventListener('panolero-scan-search', handleScanSearch);
  }, []);

  // Filter items by barcode number, product code, name, location, brand, or cross-reference
  const cleanTerm = searchTerm.trim().toLowerCase();
  const cleanTermAlphaNum = cleanTerm.replace(/[^a-zA-Z0-9]/g, '');

  const filteredItems = cleanTerm === '' 
    ? [] 
    : items.filter(item => {
        const itemCodeLower = item.codigo.toLowerCase();
        const itemCodeAlphaNum = item.codigo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const itemBarcodeLower = (item.codigoBarras || '').toLowerCase();
        const itemBarcodeAlphaNum = (item.codigoBarras || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const itemDescLower = item.descripcion.toLowerCase();
        const itemUbicLower = item.ubicacion.toLowerCase();
        const itemProvLower = item.proveedor.toLowerCase();
        const itemEquivLower = (item.equivalencias || '').toLowerCase();

        return (
          itemCodeLower.includes(cleanTerm) ||
          (cleanTermAlphaNum && itemCodeAlphaNum.includes(cleanTermAlphaNum)) ||
          itemBarcodeLower.includes(cleanTerm) ||
          (cleanTermAlphaNum && itemBarcodeAlphaNum.includes(cleanTermAlphaNum)) ||
          itemDescLower.includes(cleanTerm) ||
          itemUbicLower.includes(cleanTerm) ||
          itemProvLower.includes(cleanTerm) ||
          itemEquivLower.includes(cleanTerm)
        );
      }).slice(0, 10);

  // Enter key on search just executes the filter without auto-triggering Salida
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Search is already dynamically applied via state
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  // === Historial de Movimiento combinado: entradas + salidas + devoluciones ===
  const fechaTimestamp = (date: string, hora?: string) => {
    if (!date) return 0;
    const t = new Date(`${date}T${hora || '00:00'}`).getTime();
    return isFinite(t) ? t : 0;
  };

  type HistoricoRow = {
    codigo: string;
    descripcion: string;
    cantidad: number;
    count: number;
    fecha: string;
    hora?: string;
    timestamp: number;
    detalle: string;
  };

  // Agrupa por código: cada producto aparece UNA sola vez (nada de códigos duplicados),
  // sumando las cantidades y contando cuántos movimientos se juntaron.
  function agruparPorCodigo<T>(
    registros: T[],
    getCodigo: (r: T) => string,
    getDesc: (r: T) => string,
    getCant: (r: T) => number,
    getFecha: (r: T) => string,
    getHora: (r: T) => string | undefined,
    getTs: (r: T) => number,
    label: string
  ): HistoricoRow[] {
    const map = new Map<string, HistoricoRow>();
    for (const r of registros) {
      const codigo = getCodigo(r);
      if (!codigo) continue;
      const key = codigo.trim().toLowerCase();
      let g = map.get(key);
      if (!g) {
        g = {
          codigo,
          descripcion: getDesc(r),
          cantidad: 0,
          count: 0,
          fecha: getFecha(r),
          hora: getHora(r),
          timestamp: getTs(r),
          detalle: ''
        };
        map.set(key, g);
      }
      g.count += 1;
      g.cantidad += getCant(r);
      const ts = getTs(r);
      if (ts >= g.timestamp) {
        g.timestamp = ts;
        g.fecha = getFecha(r);
        g.hora = getHora(r);
      }
      const desc = getDesc(r);
      if (desc && (!g.descripcion || g.descripcion === 'Artículo sin descripción')) g.descripcion = desc;
    }
    return Array.from(map.values())
      .map(g => ({ ...g, detalle: g.count === 1 ? `1 ${label}` : `${g.count} ${label}s` }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }

  const resumenSalidas = agruparPorCodigo(
    salidas,
    s => s.codigo, s => s.descripcion, s => s.cantidad,
    s => s.fechaSalida, s => s.horaSalida,
    s => fechaTimestamp(s.fechaSalida, s.horaSalida),
    'salida'
  );

  const resumenIngresos = agruparPorCodigo(
    ingresos,
    i => i.codigo, i => i.descripcion, i => i.cantidad,
    i => i.fechaIngreso, () => undefined,
    i => fechaTimestamp(i.fechaIngreso),
    'entrada'
  );

  const resumenDevoluciones = agruparPorCodigo(
    devolucionGroups.flatMap(g => (g.items || []).map(it => ({
      codigo: it.codigo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      fecha: g.fechaDevolucion,
      hora: g.horaDevolucion
    }))),
    r => r.codigo, r => r.descripcion, r => r.cantidad,
    r => r.fecha, r => r.hora,
    r => fechaTimestamp(r.fecha, r.hora),
    'devolución'
  );

  // Índices por código para poder borrar todos los registros de un producto desde el historial.
  const salidasPorCodigo = new Map<string, SalidaRecord[]>();
  salidas.forEach(s => {
    const k = s.codigo.trim().toLowerCase();
    const arr = salidasPorCodigo.get(k) ?? [];
    arr.push(s);
    salidasPorCodigo.set(k, arr);
  });

  const ingresosPorCodigo = new Map<string, IngresoRecord[]>();
  ingresos.forEach(i => {
    const k = i.codigo.trim().toLowerCase();
    const arr = ingresosPorCodigo.get(k) ?? [];
    arr.push(i);
    ingresosPorCodigo.set(k, arr);
  });

  const devolucionesPorCodigo = new Map<string, { groupId: string }[]>();
  devolucionGroups.forEach(g => {
    (g.items || []).forEach(it => {
      const k = it.codigo.trim().toLowerCase();
      const arr = devolucionesPorCodigo.get(k) ?? [];
      arr.push({ groupId: g.id });
      devolucionesPorCodigo.set(k, arr);
    });
  });

  const handleDeleteMovimiento = (tab: 'salida' | 'entrada' | 'devolucion', codigo: string, revertStock: boolean) => {
    const key = codigo.trim().toLowerCase();
    const nota = revertStock
      ? 'se revirtió el stock'
      : 'el stock quedó como está';

    if (tab === 'salida') {
      const recs = salidasPorCodigo.get(key) ?? [];
      recs.forEach(r => deleteSalida(r.id, revertStock));
      showToast(`Se eliminar${recs.length === 1 ? 'ó' : 'on'} ${recs.length} salida${recs.length === 1 ? '' : 's'} de ${codigo}: ${nota}.`);
    } else if (tab === 'entrada') {
      const recs = ingresosPorCodigo.get(key) ?? [];
      recs.forEach(r => deleteIngreso(r.id, revertStock));
      showToast(`Se eliminar${recs.length === 1 ? 'ó' : 'on'} ${recs.length} entrada${recs.length === 1 ? '' : 's'} de ${codigo}: ${nota}.`);
    } else {
      const refs = devolucionesPorCodigo.get(key) ?? [];
      refs.forEach(r => deleteDevolucionItem(r.groupId, codigo, revertStock));
      showToast(`Se quitar${refs.length === 1 ? 'ó' : 'on'} ${refs.length} devolución${refs.length === 1 ? '' : 'es'} de ${codigo}: ${nota}.`);
    }

    setPendingDelete(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6 font-['Plus_Jakarta_Sans',sans-serif]">
      
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-4 duration-200 max-w-xs">
          <Check className="w-5 h-5 text-emerald-400" />
          <span className="flex-1">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-300 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Welcome Card tailored for Operator */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#b5dbf7] shadow-xs mb-6 text-center sm:text-left">
        <h1 className="text-xl sm:text-2xl font-black text-sky-950 tracking-tight">
          Pañol • {currentUser?.nombre || 'Marcelo'}
        </h1>
      </div>

      {/* THREE MAIN ACTION BUTTONS: SALIDA, DEVOLUCIÓN & ENTRADA */}
      <div id="operaciones-panolero" className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        
        {/* BUTTON 1: SALIDA */}
        <button
          type="button"
          onClick={() => onOpenScanner(undefined, 'salida')}
          className="group relative bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-2xl p-5 sm:p-6 shadow-md hover:shadow-lg transition-all flex flex-col items-center text-center cursor-pointer border border-rose-500"
        >
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            <ArrowUpRight className="w-8 h-8 text-white stroke-[2.5]" />
          </div>

          <span className="text-xl sm:text-2xl font-black tracking-tight mb-0.5 uppercase">
            SALIDA
          </span>
          
          <span className="text-xs font-semibold text-rose-100">
            Retirar repuestos
          </span>
        </button>

        {/* BUTTON 2: DEVOLUCIÓN */}
        <button
          type="button"
          onClick={() => onOpenScanner(undefined, 'devolucion')}
          className="group relative bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-2xl p-5 sm:p-6 shadow-md hover:shadow-lg transition-all flex flex-col items-center text-center cursor-pointer border border-amber-500"
        >
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            <RotateCcw className="w-8 h-8 text-white stroke-[2.5]" />
          </div>

          <span className="text-xl sm:text-2xl font-black tracking-tight mb-0.5 uppercase">
            DEVOLUCIÓN
          </span>
          
          <span className="text-xs font-semibold text-amber-100">
            Reintegrar sobrantes
          </span>
        </button>

        {/* BUTTON 3: ENTRADA */}
        <button
          type="button"
          onClick={() => onOpenScanner(undefined, 'ingreso')}
          className="group relative bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl p-5 sm:p-6 shadow-md hover:shadow-lg transition-all flex flex-col items-center text-center cursor-pointer border border-emerald-500"
        >
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            <PackagePlus className="w-8 h-8 text-white stroke-[2.5]" />
          </div>

          <span className="text-xl sm:text-2xl font-black tracking-tight mb-0.5 uppercase">
            ENTRADA
          </span>
          
          <span className="text-xs font-semibold text-emerald-100">
            Ingresar stock
          </span>
        </button>

      </div>

      {/* SEARCH SECTION */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#b5dbf7] shadow-xs mb-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-sky-100 text-[#006bb0]">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-sky-950">
              Consultar Ubicación y Stock
            </h2>
          </div>
        </div>

        {/* Search Input Bar with explicit "BUSCAR" Button */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2 mt-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por código, código de barras o descripción..."
              className="w-full pl-10 pr-10 py-3 text-sm sm:text-base font-bold rounded-xl border border-[#9eccf0] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 bg-[#f8fbfe] text-slate-900 placeholder:text-slate-400 transition-all"
            />
            <Barcode className="w-5 h-5 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-1.5 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg cursor-pointer"
                title="Borrar búsqueda"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="px-5 py-3 bg-[#006bb0] hover:bg-[#005a94] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>BUSCAR</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCameraScanner(prev => !prev)}
              className={`px-4 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95 shrink-0 ${
                showCameraScanner
                  ? 'bg-sky-600 text-white border border-sky-700'
                  : 'bg-white text-[#006bb0] border border-[#9eccf0] hover:bg-sky-50'
              }`}
              title="Buscar escaneando con la cámara"
            >
              <Camera className="w-4 h-4" />
              <span>{showCameraScanner ? 'CERRAR CÁMARA' : 'CÁMARA'}</span>
            </button>
          </div>
        </div>

        {/* Camera Barcode Scanner (móvil / sin pistola) */}
        {showCameraScanner && (
          <div className="mt-3">
            <CameraBarcodeScanner
              onDetected={(code) => {
                setSearchTerm(code);
                searchInputRef.current?.focus();
              }}
            />
          </div>
        )}

        {/* Search Results Display */}
        {searchTerm.trim() !== '' && (
          <div className="mt-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Resultados ({filteredItems.length}):
            </div>

            {filteredItems.length === 0 ? (
              <div className="bg-[#f8fbfe] rounded-xl p-4 text-center border border-slate-200">
                <p className="text-sm font-bold text-slate-700">
                  No se encontraron productos para "{searchTerm}".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="bg-[#f8fbfe] hover:bg-[#eef7fd] border-2 border-[#cbe4f7] rounded-2xl p-4 sm:p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="font-mono font-black text-xs sm:text-sm text-[#006bb0] bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200">
                          CÓDIGO: {item.codigo || 'S/C'}
                        </span>
                        {item.codigoBarras && (
                          <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5" />
                            {item.codigoBarras}
                          </span>
                        )}
                        {item.proveedor && (
                          <span className="text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 uppercase">
                            {item.proveedor}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-xl font-black text-slate-900 leading-snug">
                        {item.descripcion}
                      </h3>

                      {item.equivalencias && item.equivalencias !== '-' && (
                        <p className="text-xs text-slate-600 font-semibold mt-1">
                          Equivalencias: <strong className="text-slate-800">{item.equivalencias}</strong>
                        </p>
                      )}
                    </div>

                    {/* Stock & Location Badges */}
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <div className="bg-amber-50 border-2 border-amber-300 px-3.5 py-2 rounded-xl text-center min-w-[85px]">
                        <span className="text-[10px] uppercase font-black text-amber-800 block">
                          UBICACIÓN
                        </span>
                        <span className="text-base sm:text-lg font-black text-amber-950 flex items-center gap-1 justify-center">
                          <MapPin className="w-4 h-4 text-amber-600" />
                          {item.ubicacion || 'A'}
                        </span>
                      </div>

                      <div className="bg-emerald-50 border-2 border-emerald-300 px-4 py-2 rounded-xl text-center min-w-[95px]">
                        <span className="text-[10px] uppercase font-black text-emerald-800 block">
                          STOCK ACTUAL
                        </span>
                        <span className="text-lg sm:text-xl font-black text-emerald-700">
                          {item.stock} u.
                        </span>
                      </div>

                      {item.paraServicio != null && item.paraServicio > 0 && (
                        <div className="bg-sky-50 border-2 border-sky-300 px-4 py-2 rounded-xl text-center min-w-[110px]">
                          <span className="text-[10px] uppercase font-black text-sky-800 block">
                            P/SERVICIO
                          </span>
                          <span className="text-lg sm:text-xl font-black text-sky-700">
                            {item.paraServicio} u.
                          </span>
                        </div>
                      )}

                      {/* Action buttons on the result item */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenScanner(item.codigo, 'salida')}
                          className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                          title="Entregar este repuesto"
                        >
                          <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                          <span>Salida</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenScanner(item.codigo, 'ingreso')}
                          className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                          title="Ingresar stock de este repuesto"
                        >
                          <PackagePlus className="w-4 h-4 stroke-[3]" />
                          <span>Entrada</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RECENT ACTIVITY ACCORDION */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-[#b5dbf7] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#006bb0] flex items-center justify-center border border-sky-200 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span id="historial" className="text-base sm:text-lg font-black text-sky-950 block">
                Historial de Movimiento
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {salidas.length} salidas · {ingresos.length} entradas · {devolucionGroups.length} {devolucionGroups.length === 1 ? 'devolución' : 'devoluciones'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRecentMovimientos(!showRecentMovimientos)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
              showRecentMovimientos
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300'
                : 'bg-[#006bb0] hover:bg-[#005590] text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{showRecentMovimientos ? 'Ocultar Historial' : 'Ver Historial'}</span>
          </button>
        </div>

        {showRecentMovimientos && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {/* Horizontal tab buttons: Salida | Entrada | Devolución */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'salida' as const, titulo: 'Salida', color: 'rose', icono: <ArrowUpRight className="w-4 h-4" /> },
                { key: 'entrada' as const, titulo: 'Entrada', color: 'emerald', icono: <PackagePlus className="w-4 h-4" /> },
                { key: 'devolucion' as const, titulo: 'Devolución', color: 'amber', icono: <RotateCcw className="w-4 h-4" /> },
              ].map(tab => {
                const active = movTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMovTab(tab.key)}
                    className={`px-2 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all shadow-xs border cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                      active
                        ? tab.color === 'rose'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : tab.color === 'emerald'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tab.icono}
                    <span>{tab.titulo}</span>
                  </button>
                );
              })}
            </div>

            {/* Active section list */}
            {(() => {
              const rows =
                movTab === 'salida' ? resumenSalidas
                : movTab === 'entrada' ? resumenIngresos
                : resumenDevoluciones;
              const signoCant = movTab === 'salida' ? '-' : '+';
              const qtyCls =
                movTab === 'salida'
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : movTab === 'entrada'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-800 bg-amber-50 border-amber-200';
              const emptyTxt =
                movTab === 'salida' ? 'salidas' : movTab === 'entrada' ? 'entradas' : 'devoluciones';

              return rows.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3 bg-[#f8fbfe] border border-dashed border-slate-200 rounded-xl">
                  Sin registros de {emptyTxt}.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {rows.map((row, i) => {
                    const confirmando = pendingDelete?.tab === movTab && pendingDelete.codigo.toLowerCase() === row.codigo.toLowerCase();
                    return (
                      <div key={`${movTab}-${i}`} className="p-3.5 rounded-2xl bg-[#f8fbfe] border border-slate-200 flex items-center justify-between text-xs sm:text-sm gap-3">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">{row.descripcion}</span>
                          <div className="text-slate-500 text-xs mt-1">
                            Código: <span className="font-mono font-bold text-slate-700">{row.codigo}</span> · {formatDisplayDate(row.fecha)}{row.hora ? ` ${row.hora}` : ''} · {row.detalle}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className={`font-black px-2.5 py-1 rounded-xl border ${qtyCls}`}>
                            {signoCant}{row.cantidad} u.
                          </span>
                          {!isVentas && (
                            confirmando ? (
                              <span className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                  ¿Revertir el stock?
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMovimiento(movTab, row.codigo, true)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Borrar el historial y revertir el stock"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Revertir stock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMovimiento(movTab, row.codigo, false)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Borrar solo el historial y dejar el stock como está"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Solo borrar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPendingDelete(null)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingDelete({ tab: movTab, codigo: row.codigo })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title={`Eliminar los registros de ${row.codigo} del historial`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

    </div>
  );
};