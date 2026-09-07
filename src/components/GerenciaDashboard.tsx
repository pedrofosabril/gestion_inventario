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
  RotateCcw
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ItemCategory } from '../types';
import { AddProductModal } from './AddProductModal';
import { SalidasLogView } from './SalidasLogView';
import { ExcelImportDropzone } from './ExcelImportDropzone';

interface GerenciaDashboardProps {
  onOpenScanner?: (barcode?: string, initialMode?: 'salida' | 'ingreso') => void;
}

export const GerenciaDashboard: React.FC<GerenciaDashboardProps> = ({ onOpenScanner }) => {
  const { 
    items, 
    salidas,
    totalValuation, 
    totalUnits, 
    totalSkus, 
    getLowStockItems, 
    getOutOfStockItems,
    clearAllData,
    resetToDefaults
  } = useInventory();

  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
  const [showHistorial, setShowHistorial] = useState<boolean>(false);

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

      {/* Actions Bar for Gerente */}
      <div className="bg-white rounded-2xl border border-[#c4e1f7] shadow-xs p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Registrar Producto Nuevo Button */}
          <button
            type="button"
            onClick={() => setIsAddingProduct(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-800 hover:bg-sky-900 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.99]"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Registrar producto nuevo</span>
          </button>

          {/* Excel Auto Import */}
          <ExcelImportDropzone />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
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

      {/* Historial de Movimientos y Salidas Integrado en Gerencia (Bajo demanda) */}
      <div className="bg-[#f4f9fd] rounded-2xl border border-[#c4e1f7] shadow-xs p-5 flex flex-col gap-4 mt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#006bb0] flex items-center justify-center border border-sky-200 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-sky-950 tracking-tight">
                Historial de Salidas y Despachos
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {salidas.length} {salidas.length === 1 ? 'despacho registrado' : 'despachos registrados'} en el sistema
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
            <SalidasLogView onOpenScanner={onOpenScanner || (() => {})} />
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
