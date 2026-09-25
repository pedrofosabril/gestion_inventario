import React, { useState } from 'react';
import { 
  DollarSign, 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Layers,
  Plus,
  Scan,
  History,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  DatabaseBackup,
  Download,
  ChevronDown,
  Clock
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ItemCategory } from '../types';
import { AddProductModal } from './AddProductModal';
import { SalidasLogView } from './SalidasLogView';
import { IngresosLogView } from './IngresosLogView';
import { DevolucionesLogView } from './DevolucionesLogView';
import { ExcelImportDropzone } from './ExcelImportDropzone';

interface GerenciaDashboardProps {
  onOpenScanner?: (barcode?: string, initialMode?: 'salida' | 'ingreso') => void;
}

export const GerenciaDashboard: React.FC<GerenciaDashboardProps> = ({ onOpenScanner }) => {
  const { 
    items, 
    salidas,
    ingresos,
    devolucionGroups,
    totalValuation, 
    totalUnits, 
    totalSkus, 
    getLowStockItems, 
    getOutOfStockItems,
    clearAllData,
    resetToDefaults,
    backupDatabase,
    backupHistory
  } = useInventory();

  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
  const [showHistorial, setShowHistorial] = useState<boolean>(false);
  const [movementHistoryTab, setMovementHistoryTab] = useState<'salidas' | 'devoluciones' | 'ingresos'>('salidas');
  const [showBackupPanel, setShowBackupPanel] = useState<boolean>(false);
  const [backupAt, setBackupAt] = useState<string | null>(null);

  const handleBackup = () => {
    backupDatabase();
    setBackupAt(new Date().toLocaleTimeString('es-AR'));
    window.setTimeout(() => setBackupAt(null), 6000);
  };

  const lowStock = getLowStockItems();
  const outOfStock = getOutOfStockItems();

  // Category valuations breakdown (Stock Antiguo eliminado)
  const categoryStats: Record<ItemCategory, { count: number; units: number; valuation: number; name: string }> = {
    panol: { count: 0, units: 0, valuation: 0, name: 'Pañol General' },
    cajones_fluidos: { count: 0, units: 0, valuation: 0, name: 'Cajones / Fluidos' },
    submicronicos: { count: 0, units: 0, valuation: 0, name: 'Filtros Submicrónicos' },
    rodamientos: { count: 0, units: 0, valuation: 0, name: 'Rodamientos' },
    entrepiso: { count: 0, units: 0, valuation: 0, name: 'Entrepiso Pañol' },
    importado: { count: 0, units: 0, valuation: 0, name: 'Stock Importado' },
    repuestos_mv: { count: 0, units: 0, valuation: 0, name: 'Repuestos MV' },
    cajas: { count: 0, units: 0, valuation: 0, name: 'Cajas Estantes' },
  };

  items.forEach(item => {
    if (categoryStats[item.categoria]) {
      categoryStats[item.categoria].count++;
      categoryStats[item.categoria].units += item.stock;
      categoryStats[item.categoria].valuation += (item.precioTotal || (item.stock * item.precio) || 0);
    }
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Database Empty Banner */}
      {items.length === 0 && (
        <div className="bg-sky-50/80 border border-sky-200 text-sky-950 px-5 py-4 rounded-2xl flex items-start gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#006bb0] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black tracking-tight text-sky-950">
              Base de Datos Limpia y Lista
            </h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              El inventario está actualmente en cero (0 productos). Puedes subir un archivo Excel o restaurar los datos completos desde los archivos de stock, repuestos y movimientos.
            </p>
            <div className="mt-2.5">
              <button
                type="button"
                onClick={resetToDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006bb0] hover:bg-sky-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Datos (Stock, Repuestos y Movimientos)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar for Administración */}
      <div className="bg-white rounded-2xl border border-[#c4e1f7] shadow-xs p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Registrar Producto Nuevo Button */}
          <button
            id="nuevo-producto"
            type="button"
            onClick={() => setIsAddingProduct(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-800 hover:bg-sky-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Registrar producto nuevo</span>
          </button>

          {/* Excel Auto Import */}
          <div id="excel">
            <ExcelImportDropzone />
          </div>

          {/* Respaldo de Base de Datos */}
          <div id="respaldo" className="relative">
            <button
              type="button"
              onClick={() => setShowBackupPanel(prev => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.99] border ${
                showBackupPanel
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}
              title="Generar una copia de la base de datos o ver el historial de respaldos"
            >
              <DatabaseBackup className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
              <span>Respaldo de base de datos</span>
              <ChevronDown className={`w-3.5 h-3.5 text-emerald-700 transition-transform ${showBackupPanel ? 'rotate-180' : ''}`} />
            </button>

            {showBackupPanel && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowBackupPanel(false)} />
                <div className="absolute z-30 right-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-[#c4e1f7] shadow-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Opción 1: Generar copia */}
                  <button
                    type="button"
                    onClick={handleBackup}
                    className="w-full inline-flex items-center gap-3 px-3 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black text-emerald-900">Generar copia de la base</span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Descarga los archivos .json y .csv con todos los datos
                      </span>
                    </div>
                  </button>

                  {/* Opción 2: Historial de respaldos */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between px-1 mb-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Historial de respaldos
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {backupHistory.length} {backupHistory.length === 1 ? 'copia' : 'copias'}
                      </span>
                    </div>

                    {backupHistory.length === 0 ? (
                      <p className="text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-3 py-3 text-center font-medium">
                        Todavía no se generaron copias. Presioná "Generar copia de la base".
                      </p>
                    ) : (
                      <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                        {backupHistory.map(entry => (
                          <li key={entry.id} className="px-3 py-2 flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              {entry.fechaDescarga}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium leading-relaxed">
                              por {entry.generadoPor} · {entry.resumen.items.toLocaleString('es-AR')} ítems · {entry.resumen.salidas.toLocaleString('es-AR')} salidas · {entry.resumen.ingresos.toLocaleString('es-AR')} ingresos · {entry.resumen.users} usuarios
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {backupAt && (
          <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Respaldo generado a las {backupAt}. Se descargaron los archivos .json y .csv.</span>
          </div>
        )}
      </div>

      {/* KPI Cards Row */}
      <div id="estadisticas" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Valuation */}
        <div className="bg-[#f4f9fd] rounded-2xl p-4 border border-[#c4e1f7] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Valuación Total
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-sky-950 tracking-tight">
              ${totalValuation.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Total Units & SKUs */}
        <div className="bg-[#f4f9fd] rounded-2xl p-4 border border-[#c4e1f7] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stock Total
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#d6ecfa] text-[#006bb0] flex items-center justify-center border border-[#b8ddf5]">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-sky-950 tracking-tight">
              {totalUnits.toLocaleString('es-AR')} <span className="text-xs font-semibold text-slate-500">piezas</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              {totalSkus} artículos
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-[#f4f9fd] rounded-2xl p-4 border border-[#c4e1f7] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stock Crítico
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight">
              {lowStock.length} <span className="text-xs font-semibold text-slate-500">ítems</span>
            </div>
          </div>
        </div>

        {/* Out of Stock Alert */}
        <div className="bg-[#f4f9fd] rounded-2xl p-4 border border-[#c4e1f7] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sin Stock (0)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-200">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
              {outOfStock.length} <span className="text-xs font-semibold text-slate-500">ítems</span>
            </div>
          </div>
        </div>

      </div>

      {/* Category Breakdown */}
      <div className="bg-[#f4f9fd] rounded-2xl border border-[#c4e1f7] shadow-xs p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sky-950 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#006bb0]" />
            Valorización por Sección
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Distribución de capital
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {Object.entries(categoryStats).filter(([_, data]) => data.count > 0).map(([catKey, data]) => {
            const pct = totalValuation > 0 ? (data.valuation / totalValuation) * 100 : 0;
            return (
              <div key={catKey} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">{data.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#d6ecfa] text-[#006bb0] font-mono">
                      {data.count} arts.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sky-950">
                    ${data.valuation.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                      ({data.units} u.)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-[#d6ecfa] rounded-full h-2 overflow-hidden flex">
                  <div 
                    className="bg-[#006bb0] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.max(2, pct)}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial de Movimientos y Salidas Integrado en Administración (Bajo demanda) */}
      <div className="bg-[#f4f9fd] rounded-2xl border border-[#c4e1f7] shadow-xs p-5 flex flex-col gap-4 mt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#006bb0] flex items-center justify-center border border-sky-200 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-sky-950 tracking-tight">
                Historial de Movimientos
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {salidas.length} salidas · {devolucionGroups.length} devoluciones · {ingresos.length} ingresos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHistorial(!showHistorial)}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
              showHistorial 
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300' 
                : 'bg-[#006bb0] hover:bg-[#005590] text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{showHistorial ? 'Ocultar Historial' : 'Ver Historial'}</span>
          </button>
        </div>

        {showHistorial && (
          <div className="pt-3 border-t border-[#c4e1f7] animate-in fade-in">
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                ['salidas', 'Salidas'],
                ['devoluciones', 'Devoluciones'],
                ['ingresos', 'Ingresos']
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMovementHistoryTab(id as 'salidas' | 'devoluciones' | 'ingresos')}
                  className={`px-3 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${movementHistoryTab === id ? 'bg-[#006bb0] text-white' : 'bg-white border border-[#b8ddf5] text-slate-700 hover:bg-[#eaf4fb]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {movementHistoryTab === 'salidas' ? (
              <SalidasLogView onOpenScanner={onOpenScanner || (() => {})} />
            ) : movementHistoryTab === 'devoluciones' ? (
              <DevolucionesLogView />
            ) : (
              <IngresosLogView onOpenScanner={onOpenScanner} />
            )}
          </div>
        )}
      </div>

      {/* Modal: Cargar Producto Manual */}
      <AddProductModal
        isOpen={isAddingProduct}
        onClose={() => setIsAddingProduct(false)}
        defaultCategory="panol"
      />

    </div>
  );
};
