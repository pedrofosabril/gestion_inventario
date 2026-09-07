import React, { useState } from 'react';
import { 
  X, 
  Package, 
  Copy, 
  Check, 
  MapPin, 
  Building2, 
  DollarSign, 
  Layers, 
  Barcode, 
  Scan, 
  ExternalLink, 
  Tag, 
  AlertCircle, 
  FileText,
  Boxes
} from 'lucide-react';
import { InventoryItem, ItemCategory } from '../types';
import { useInventory } from '../context/InventoryContext';

interface ProductDetailModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToCategory?: (category: ItemCategory, code?: string) => void;
  onOpenScanner?: (code?: string, mode?: 'salida' | 'ingreso') => void;
  onOpenBarcode?: (item: InventoryItem) => void;
}

const CATEGORY_NAMES: Record<ItemCategory, { name: string; color: string; bg: string }> = {
  panol: { name: 'Pañol (General)', color: 'text-[#006bb0]', bg: 'bg-[#eaf4fb]' },
  cajones_fluidos: { name: 'Cajones / Fluidos', color: 'text-amber-700', bg: 'bg-amber-50' },
  submicronicos: { name: 'Filtros Submicrónicos', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  rodamientos: { name: 'Rodamientos', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  entrepiso: { name: 'Entrepiso', color: 'text-purple-700', bg: 'bg-purple-50' },
  importado: { name: 'Importado', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  repuestos_mv: { name: 'Repuestos MV', color: 'text-blue-700', bg: 'bg-blue-50' },
  cajas: { name: 'Cajas Estantes', color: 'text-rose-700', bg: 'bg-rose-50' },
};

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onNavigateToCategory,
  onOpenScanner,
  onOpenBarcode,
}) => {
  const { currentUser } = useInventory();
  const isGerencia = currentUser?.rol === 'gerencia';
  const isVentas = currentUser?.rol === 'ventas';
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  if (!isOpen || !item) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(item.codigo);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const catMeta = CATEGORY_NAMES[item.categoria] || {
    name: item.categoria,
    color: 'text-[#006bb0]',
    bg: 'bg-[#eaf4fb]'
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/70 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-[#c4e1f7] max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#006bb0] to-[#005590] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md text-sky-100">
                  {catMeta.name}
                </span>
                {item.porEncargo && (
                  <span className="text-[10px] font-bold bg-purple-500/80 text-white px-2 py-0.5 rounded-md">
                    📦 Por Encargo
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight mt-0.5">
                Detalle y Descripción del Producto
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 text-slate-800">
          
          {/* Main Description Box (Hero) */}
          <div className="bg-[#f4f9fd] border-2 border-[#b8ddf5] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#006bb0] flex items-center gap-1.5 mb-1.5">
              <FileText className="w-4 h-4" />
              Descripción / Denominación de la Pieza
            </span>
            <h3 className="text-base sm:text-xl font-black text-slate-900 leading-relaxed select-text">
              {item.descripcion || 'Sin descripción detallada'}
            </h3>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Código de Pieza */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#c4e1f7] shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-[#006bb0]" />
                Código de Producto
              </span>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <span className="text-base sm:text-lg font-mono font-black text-[#006bb0] select-text">
                  {item.codigo}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 rounded-lg border border-[#badbf5] bg-[#eaf4fb] hover:bg-[#d5ecfa] text-[#006bb0] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  title="Copiar código al portapapeles"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Proveedor / Marca */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#c4e1f7] shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#006bb0]" />
                Proveedor / Fabricante
              </span>
              <div className="mt-1.5">
                <span className="text-base font-black text-slate-900 select-text uppercase">
                  {item.proveedor || 'No especificado'}
                </span>
              </div>
            </div>

            {/* Ubicación en Taller / Pañol */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#c4e1f7] shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Ubicación Física
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-black text-sm select-text">
                  {item.ubicacion || 'Sin asignar'}
                </span>
                {item.subcategoria && (
                  <span className="text-xs font-semibold text-slate-600">
                    ({item.subcategoria})
                  </span>
                )}
              </div>
            </div>

            {/* Stock Actual y Disponibilidad */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#c4e1f7] shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-sky-600" />
                Stock Disponible
              </span>
              <div className="mt-1.5 flex items-center justify-between">
                <span className={`text-lg font-mono font-black ${
                  item.stock > 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {item.stock} {item.stock === 1 ? 'unidad' : 'unidades'}
                </span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  item.stock > 0 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}>
                  {item.stock > 0 ? 'Disponible' : 'Sin Stock'}
                </span>
              </div>
            </div>

          </div>

          {/* Pricing & Additional Specifications Box */}
          <div className={`grid grid-cols-1 ${isGerencia ? 'sm:grid-cols-2' : ''} gap-3 bg-[#f8fbfe] border border-[#d2e8f8] p-4 rounded-2xl`}>
            
            {/* Precios - Solo visible para Gerencia */}
            {isGerencia && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Valores y Precios
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xs text-slate-500">Unitario:</span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    {formatCurrency(item.precio)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-slate-500">Total en Stock:</span>
                  <span className="text-sm font-mono font-black text-emerald-800">
                    {formatCurrency(item.precioTotal || (item.precio * item.stock))}
                  </span>
                </div>
              </div>
            )}

            {/* Código de barras / Equivalencias */}
            <div className="flex flex-col justify-between gap-1.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-slate-700" />
                  Código de Barras Físico
                </span>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {item.codigoBarras && item.codigoBarras.trim() !== '' ? (
                    <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 select-text">
                      {item.codigoBarras}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Sin código de barras vinculado
                    </span>
                  )}
                  {onOpenBarcode && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenBarcode(item);
                        onClose();
                      }}
                      className="px-2 py-0.5 text-[11px] font-bold text-[#006bb0] hover:text-sky-900 bg-white border border-[#badbf5] hover:bg-[#e4f2fb] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Scan className="w-3 h-3" />
                      <span>{item.codigoBarras ? 'Ver / Cambiar' : 'Escanear y Vincular'}</span>
                    </button>
                  )}
                </div>
              </div>
              {item.equivalencias && (
                <p className="text-xs text-slate-600 mt-1">
                  <strong>Equivalencias:</strong> {item.equivalencias}
                </p>
              )}
            </div>

          </div>

          {/* Notas adicionales si existen */}
          {item.notas && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Observaciones:</strong> {item.notas}
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="bg-[#f0f7fc] border-t border-[#c4e1f7] p-4 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          
          {/* Navigate to Table Button */}
          <div>
            {onNavigateToCategory && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToCategory(item.categoria, item.codigo);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl border border-[#badbf5] bg-white text-[#006bb0] hover:bg-[#e4f2fb] hover:border-[#006bb0] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title={`Ir a la tabla de ${catMeta.name}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ver en Tabla de {catMeta.name}</span>
              </button>
            )}
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            {onOpenScanner && !isVentas && (
              <button
                type="button"
                onClick={() => {
                  onOpenScanner(item.codigo, 'salida');
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-[#006bb0] hover:bg-[#005590] text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Abrir en el escáner para retirar o consultar"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Escanear / Retirar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
