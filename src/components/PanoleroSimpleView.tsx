import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUpRight, 
  PackagePlus, 
  RotateCcw,
  Search, 
  MapPin, 
  Boxes, 
  ScanLine,
  X,
  History,
  Barcode
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { InventoryItem } from '../types';

interface PanoleroSimpleViewProps {
  onOpenScanner: (initialCode?: string, mode?: 'salida' | 'ingreso' | 'devolucion') => void;
  onOpenBarcode?: (item: InventoryItem) => void;
  onOpenDetail?: (item: InventoryItem) => void;
}

export const PanoleroSimpleView: React.FC<PanoleroSimpleViewProps> = ({
  onOpenScanner
}) => {
  const { items, currentUser, salidas, ingresos, devolucionGroups } = useInventory();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyType, setHistoryType] = useState<'salidas' | 'ingresos' | 'devoluciones'>('salidas');
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6 font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* Welcome Card tailored for Operator */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#b5dbf7] shadow-xs mb-6 text-center sm:text-left">
        <h1 className="text-xl sm:text-2xl font-black text-sky-950 tracking-tight">
          Pañol • {currentUser?.nombre || 'Marcelo'}
        </h1>
      </div>

      {/* THREE MAIN ACTION BUTTONS: SALIDA, DEVOLUCIÓN & ENTRADA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        
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

          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="px-5 py-3 bg-[#006bb0] hover:bg-[#005a94] text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>BUSCAR</span>
          </button>
        </div>

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
                          {item.stock} {item.unidad || 'u.'}
                        </span>
                      </div>

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

      {/* COMPLETE MOVEMENT HISTORY */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border-2 border-[#b5dbf7] shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#006bb0] flex items-center justify-center border border-sky-200 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-sky-950 block">
                Historial de Movimientos
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Salidas, entradas y devoluciones registradas
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
              showHistory
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300'
                : 'bg-[#006bb0] hover:bg-[#005590] text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{showHistory ? 'Ocultar Historial' : 'Ver Historial Completo'}</span>
          </button>
        </div>

        {showHistory && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {([
                ['salidas', 'Salidas', salidas.length, 'bg-rose-600 hover:bg-rose-700'],
                ['ingresos', 'Entradas', ingresos.length, 'bg-emerald-600 hover:bg-emerald-700'],
                ['devoluciones', 'Devoluciones', devolucionGroups.length, 'bg-amber-600 hover:bg-amber-700']
              ] as const).map(([type, label, count, color]) => (
                <button key={type} type="button" onClick={() => setHistoryType(type)} className={`rounded-xl px-2 py-2.5 text-xs font-black transition-colors ${historyType === type ? `${color} text-white` : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                  {label} <span className="opacity-80">({count})</span>
                </button>
              ))}
            </div>

            <div className="max-h-[32rem] overflow-y-auto pr-1 space-y-2.5">
              {historyType === 'salidas' && (salidas.length === 0 ? <p className="text-xs text-slate-500 text-center py-3">No hay salidas registradas aún.</p> : salidas.map(sal => (
                <div key={sal.id} className="p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100 flex items-center justify-between text-xs sm:text-sm">
                  <div className="min-w-0"><span className="font-bold text-slate-900">{sal.descripcion}</span><div className="text-slate-500 text-xs mt-0.5">Código: <span className="font-mono font-bold text-slate-700">{sal.codigo}</span> · Retirado por: <strong className="text-slate-800">{sal.retira || 'Personal'}</strong>{sal.cliente ? ` · Cliente: ${sal.cliente}` : ''} · {sal.fechaSalida}</div></div>
                  <span className="font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200 shrink-0 ml-2">-{sal.cantidad} u.</span>
                </div>
              )))}
              {historyType === 'ingresos' && (ingresos.length === 0 ? <p className="text-xs text-slate-500 text-center py-3">No hay entradas registradas aún.</p> : ingresos.map(ingreso => (
                <div key={ingreso.id} className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between text-xs sm:text-sm">
                  <div className="min-w-0"><span className="font-bold text-slate-900">{ingreso.descripcion}</span><div className="text-slate-500 text-xs mt-0.5">Código: <span className="font-mono font-bold text-slate-700">{ingreso.codigo}</span> · Proveedor: <strong className="text-slate-800">{ingreso.proveedor || 'Sin proveedor'}</strong> · {ingreso.fechaIngreso}</div></div>
                  <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 shrink-0 ml-2">+{ingreso.cantidad} u.</span>
                </div>
              )))}
              {historyType === 'devoluciones' && (devolucionGroups.length === 0 ? <p className="text-xs text-slate-500 text-center py-3">No hay devoluciones registradas aún.</p> : devolucionGroups.map(group => (
                <div key={group.id} className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 text-xs sm:text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-900">{group.numeroDevolucionFormatted}</span><span className="font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 shrink-0">+{group.totalUnidades} u.</span></div>
                  <div className="text-slate-500 text-xs mt-1">Devuelto por: <strong className="text-slate-800">{group.empleadoDevuelve}</strong> · {group.fechaDevolucion} {group.horaDevolucion} · {group.items.map(item => `${item.codigo} (${item.cantidad} u.)`).join(', ')}</div>
                </div>
              )))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
