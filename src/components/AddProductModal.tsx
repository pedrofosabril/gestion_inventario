import React, { useState } from 'react';
import { 
  X, 
  PackagePlus, 
  Tag, 
  Building2, 
  MapPin, 
  DollarSign, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Barcode,
  Sparkles,
  Calculator,
  Coins
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ItemCategory, InventoryItem, PARAMETRIZED_SUPPLIERS } from '../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: ItemCategory;
  onProductCreated?: (item: InventoryItem) => void;
}

const CATEGORY_OPTIONS: { id: ItemCategory; label: string; subcats: string[] }[] = [
  { id: 'panol', label: 'Pañol General', subcats: ['Filtros', 'Repuestos', 'Consumibles', 'Herramientas'] },
  { id: 'cajones_fluidos', label: 'Cajones y Fluidos', subcats: ['Fluidos', 'Cajones', 'Estante'] },
  { id: 'submicronicos', label: 'Filtros Submicrónicos', subcats: ['FXF', 'FXH', 'SCF', 'SCH', 'MPH/MPF'] },
  { id: 'rodamientos', label: 'Rodamientos', subcats: ['SKF', 'TIMKEN', 'FAG', 'NSK', 'NTN', 'ZKL', 'KOYO', 'ROLLWAY'] },
  { id: 'entrepiso', label: 'Entrepiso Pañol', subcats: ['FLEETGUARD', 'LANSS', 'CATERPILLAR', 'DONALDSON', 'MAHLE', 'VARIOS'] },
  { id: 'importado', label: 'Stock Importado', subcats: ['Separadores', 'Kits', 'Válvulas'] },
  { id: 'repuestos_mv', label: 'Repuestos MV', subcats: ['MV', 'MV-5V', 'MV-7', 'MV-10', 'MV-15/20', 'MV-40', 'MV-50'] },
  { id: 'cajas', label: 'Cajas Estantes', subcats: ['Caja Estante A', 'Caja Estante B'] },
];

const COMMON_UBICACIONES = ['A', 'B', 'C', 'C GRIS', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'CAJONES', 'ESTANTE'];

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  defaultCategory = 'panol',
  onProductCreated
}) => {
  const { addItem, items } = useInventory();

  const [categoria, setCategoria] = useState<ItemCategory>(defaultCategory === 'stock_antiguo' ? 'panol' : defaultCategory);
  const [subcategoria, setSubcategoria] = useState<string>('');
  const [codigo, setCodigo] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [equivalencias, setEquivalencias] = useState<string>('');
  const [proveedor, setProveedor] = useState<string>('SULLAIR');
  const [ubicacion, setUbicacion] = useState<string>('A');
  const [stock, setStock] = useState<number>(1);
  const [stockMinimo, setStockMinimo] = useState<number>(1);
  const [precio, setPrecio] = useState<number>(0);
  const [porEncargo, setPorEncargo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentCategoryMeta = CATEGORY_OPTIONS.find(c => c.id === categoria) || CATEGORY_OPTIONS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = codigo.trim().toUpperCase();
    const cleanDesc = descripcion.trim().toUpperCase();
    const cleanProv = proveedor.trim().toUpperCase() || 'SULLAIR';
    const cleanUbi = ubicacion.trim().toUpperCase() || 'A';

    if (!cleanCode) {
      setError('Por favor ingresa el código del producto.');
      return;
    }
    if (!cleanDesc) {
      setError('Por favor ingresa la descripción del producto.');
      return;
    }

    // Check if code already exists
    const existing = items.find(i => i.codigo.toUpperCase() === cleanCode);
    if (existing) {
      setError(`Ya existe un producto con el código "${cleanCode}" en la categoría ${existing.categoria} (${existing.descripcion}). Usa otro código o actualiza el existente.`);
      return;
    }

    const newItem = addItem({
      codigo: cleanCode,
      descripcion: cleanDesc,
      proveedor: cleanProv,
      ubicacion: cleanUbi,
      categoria: categoria,
      subcategoria: subcategoria.trim() || undefined,
      equivalencias: equivalencias.trim() || undefined,
      stock: Math.max(0, stock),
      stockMinimo: Math.max(0, stockMinimo),
      precio: Math.max(0, precio),
      porEncargo: porEncargo,
      codigoBarras: cleanCode,
      fechaRegistro: new Date().toISOString().split('T')[0],
      fechaUltimoMovimiento: new Date().toISOString().split('T')[0],
    });

    setSuccess(true);
    if (onProductCreated) {
      onProductCreated(newItem);
    }

    setTimeout(() => {
      setSuccess(false);
      onClose();
      // Reset form
      setCodigo('');
      setDescripcion('');
      setStock(1);
      setPrecio(0);
      setError(null);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-[#f8fcfe] rounded-3xl shadow-2xl border border-[#c4e1f7] w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden text-slate-800"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#006bb0] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <PackagePlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Registrar Producto Nuevo
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body / Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2 text-xs font-semibold animate-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-bold animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Producto registrado correctamente</span>
            </div>
          )}

          {/* Categoría & Subcategoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Layers className="w-3.5 h-3.5 text-[#006bb0]" />
                Categoría del Inventario <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoria}
                onChange={e => {
                  const newCat = e.target.value as ItemCategory;
                  setCategoria(newCat);
                  setSubcategoria('');
                }}
                className="w-full px-3 py-2 text-xs font-bold text-slate-800 rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Tag className="w-3.5 h-3.5 text-[#006bb0]" />
                Subcategoría / Modelo
              </label>
              <input
                type="text"
                list="subcat-options-list"
                value={subcategoria}
                onChange={e => setSubcategoria(e.target.value)}
                placeholder="Ej: FXF, SKF, Fluidos, MV-10..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
              />
              <datalist id="subcat-options-list">
                {currentCategoryMeta.subcats.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          {/* Código & Proveedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Barcode className="w-3.5 h-3.5 text-[#006bb0]" />
                Código del Producto / SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej: 250022-669, 6205-2RS, 02250100-756..."
                className="w-full px-3 py-2 text-xs font-mono font-black uppercase text-sky-950 rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <Building2 className="w-3.5 h-3.5 text-[#006bb0]" />
                Proveedor / Fabricante
              </label>
              <input
                type="text"
                list="suppliers-modal-list"
                value={proveedor}
                onChange={e => setProveedor(e.target.value.toUpperCase())}
                placeholder="Ej: SULLAIR, SKF, DONALDSON, FLEETGUARD..."
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 uppercase rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
              />
              <datalist id="suppliers-modal-list">
                {PARAMETRIZED_SUPPLIERS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
              <Tag className="w-3.5 h-3.5 text-[#006bb0]" />
              Descripción Detallada <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={descripcion}
              onChange={e => setDescripcion(e.target.value.toUpperCase())}
              placeholder="Ej: FILTRO SEPARADOR DE ACEITE S.20 / ELEMENTO FILTRANTE..."
              className="w-full px-3 py-2 text-xs font-medium text-slate-800 uppercase rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
            />
          </div>

          {/* Equivalencias Cruzadas */}
          <div className="flex flex-col gap-1">
            <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
              <Tag className="w-3.5 h-3.5 text-sky-600" />
              Equivalencias (Códigos cruzados de otras marcas)
            </label>
            <input
              type="text"
              value={equivalencias}
              onChange={e => setEquivalencias(e.target.value.toUpperCase())}
              placeholder="Ej: LX1056, P550440, WF2172..."
              className="w-full px-3 py-2 text-xs font-mono font-bold text-sky-900 uppercase rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
            />
          </div>

          {/* Ubicación, Stock Inicial, Stock Mínimo y Precio */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-[#006bb0]" />
                Ubicación
              </label>
              <input
                type="text"
                list="ubicacion-chips-list"
                value={ubicacion}
                onChange={e => setUbicacion(e.target.value.toUpperCase())}
                placeholder="Ej: A, B, C..."
                className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0]"
              />
              <datalist id="ubicacion-chips-list">
                {COMMON_UBICACIONES.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider text-[11px]">
                Stock Inicial
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={e => setStock(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider text-[11px]">
                Stock Mínimo
              </label>
              <input
                type="number"
                min="0"
                value={stockMinimo}
                onChange={e => setStockMinimo(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Precio Unit. ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precio}
                onChange={e => setPrecio(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0]"
              />
            </div>
          </div>

          {/* Dynamic Valor Total Calculation Card */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[11px] uppercase tracking-wider text-emerald-950">
                    Valor Total Calculado
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 font-bold">
                    Stock × Precio Unitario
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  <span className="font-bold text-slate-800">{stock} {stock === 1 ? 'unidad' : 'unidades'}</span> × <span className="font-mono font-bold text-slate-800">${precio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </p>
              </div>
            </div>
            
            <div className="text-right w-full sm:w-auto flex sm:flex-col justify-between sm:justify-center items-center sm:items-end border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200/80">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Valuación Total:</span>
              <span className="text-base sm:text-lg font-mono font-black text-emerald-700">
                ${(Math.max(0, stock) * Math.max(0, precio)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Por Encargo Checkbox */}
          <div className="p-3 bg-purple-50/80 rounded-2xl border border-purple-200 flex items-center gap-3">
            <input
              type="checkbox"
              id="modalPorEncargoCheck"
              checked={porEncargo}
              onChange={e => setPorEncargo(e.target.checked)}
              className="w-4 h-4 rounded text-purple-700 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="modalPorEncargoCheck" className="text-xs font-bold text-purple-950 cursor-pointer">
              Artículo a pedido / por encargo (No genera alerta de stock faltante)
            </label>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-[#c4e1f7] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl border border-[#b8ddf5] hover:bg-[#e4f2fb] transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={success}
              className="px-6 py-2.5 text-xs font-black text-white bg-[#006bb0] hover:bg-[#005590] rounded-xl shadow-xs transition-all active:scale-[0.99] flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Guardar y Habilitar Producto</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
