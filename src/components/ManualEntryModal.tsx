import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Search, 
  PackagePlus, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle, 
  Minus, 
  Plus, 
  Building2, 
  MapPin, 
  DollarSign, 
  Tag, 
  Sparkles, 
  Keyboard,
  Boxes,
  Calculator,
  RotateCcw
} from 'lucide-react';
import { InventoryItem, ItemCategory, PARAMETRIZED_SUPPLIERS } from '../types';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'salida' | 'ingreso' | 'devolucion';
  availableItems: InventoryItem[];
  onAddSalidaItem: (item: InventoryItem, qty: number) => void;
  onAddExistingIngresoItem: (item: InventoryItem, qty: number, precio?: number) => void;
  onAddNewIngresoItem: (newItem: {
    codigo: string;
    descripcion: string;
    proveedor: string;
    ubicacion: string;
    categoria: ItemCategory;
    cantidad: number;
    precioUnitario: number;
  }) => void;
  onAddDevolucionItem?: (item: InventoryItem, qty: number) => void;
  defaultProveedor?: string;
}

const CATEGORY_OPTIONS: { id: ItemCategory; label: string }[] = [
  { id: 'panol', label: 'Pañol General' },
  { id: 'cajones_fluidos', label: 'Cajones y Fluidos' },
  { id: 'submicronicos', label: 'Filtros Submicrónicos' },
  { id: 'rodamientos', label: 'Rodamientos' },
  { id: 'entrepiso', label: 'Entrepiso Pañol' },
  { id: 'importado', label: 'Stock Importado' },
  { id: 'repuestos_mv', label: 'Repuestos MV' },
  { id: 'cajas', label: 'Cajas Estantes' },
];

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  mode,
  availableItems,
  onAddSalidaItem,
  onAddExistingIngresoItem,
  onAddNewIngresoItem,
  onAddDevolucionItem,
  defaultProveedor = 'SULLAIR'
}) => {
  const [ingresoTab, setIngresoTab] = useState<'existente' | 'nuevo'>('existente');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [salidaQty, setSalidaQty] = useState<number>(1);
  const [ingresoQty, setIngresoQty] = useState<number>(1);
  const [ingresoPrecio, setIngresoPrecio] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Item State for Ingreso
  const [newCodigo, setNewCodigo] = useState<string>('');
  const [newDescripcion, setNewDescripcion] = useState<string>('');
  const [newProveedor, setNewProveedor] = useState<string>(defaultProveedor);
  const [newUbicacion, setNewUbicacion] = useState<string>('A');
  const [newCategoria, setNewCategoria] = useState<ItemCategory>('panol');
  const [newCantidad, setNewCantidad] = useState<number>(1);
  const [newPrecio, setNewPrecio] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedItem(null);
      setSalidaQty(1);
      setIngresoQty(1);
      setIngresoPrecio(0);
      setSuccessMsg(null);
      setErrorMsg(null);
      setNewCodigo('');
      setNewDescripcion('');
      setNewProveedor(defaultProveedor);
      setNewUbicacion('A');
      setNewCategoria('panol');
      setNewCantidad(1);
      setNewPrecio(0);
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [isOpen, mode, defaultProveedor]);

  if (!isOpen) return null;

  const cleanTerm = searchTerm.trim().toLowerCase();
  const cleanTermAlphaNum = cleanTerm.replace(/[^a-zA-Z0-9]/g, '');

  const filteredItems = cleanTerm === '' 
    ? [] 
    : availableItems.filter(item => {
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
      }).slice(0, 15);

  const handleSelectProduct = (item: InventoryItem) => {
    setSelectedItem(item);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (mode === 'salida') {
      setSalidaQty(item.stock > 0 ? 1 : 0);
    } else if (mode === 'devolucion') {
      setSalidaQty(1);
    } else {
      setIngresoQty(1);
      setIngresoPrecio(item.precio || 0);
    }
  };

  const handleConfirmDevolucion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      setErrorMsg('Debes seleccionar un producto.');
      return;
    }
    if (salidaQty <= 0) {
      setErrorMsg('La cantidad a devolver debe ser al menos 1.');
      return;
    }

    if (onAddDevolucionItem) {
      onAddDevolucionItem(selectedItem, salidaQty);
    } else {
      onAddSalidaItem(selectedItem, salidaQty);
    }
    setSuccessMsg(`✓ Se agregaron ${salidaQty} u. de "${selectedItem.codigo}" a la lista de devolución.`);
    setErrorMsg(null);
    setSelectedItem(null);
    setSearchTerm('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleConfirmSalida = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      setErrorMsg('Debes seleccionar un producto.');
      return;
    }
    if (selectedItem.stock <= 0) {
      setErrorMsg(`El producto ${selectedItem.codigo} no tiene stock disponible.`);
      return;
    }
    if (salidaQty <= 0) {
      setErrorMsg('La cantidad a retirar debe ser al menos 1.');
      return;
    }
    if (salidaQty > selectedItem.stock) {
      setErrorMsg(`No puedes retirar más de ${selectedItem.stock} unidades de este producto.`);
      return;
    }

    onAddSalidaItem(selectedItem, salidaQty);
    setSuccessMsg(`✓ Se agregaron ${salidaQty} u. de "${selectedItem.codigo}" a la lista de salida.`);
    setErrorMsg(null);
    setSelectedItem(null);
    setSearchTerm('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleConfirmExistingIngreso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      setErrorMsg('Debes seleccionar un producto.');
      return;
    }
    if (ingresoQty <= 0) {
      setErrorMsg('La cantidad a ingresar debe ser al menos 1.');
      return;
    }

    onAddExistingIngresoItem(selectedItem, ingresoQty, ingresoPrecio > 0 ? ingresoPrecio : undefined);
    setSuccessMsg(`✓ Se agregaron ${ingresoQty} u. de "${selectedItem.codigo}" al lote de entrada.`);
    setErrorMsg(null);
    setSelectedItem(null);
    setSearchTerm('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleConfirmNewIngreso = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCodigo.trim().toUpperCase();
    const cleanDesc = newDescripcion.trim().toUpperCase();

    if (!cleanCode) {
      setErrorMsg('El código del producto es obligatorio.');
      return;
    }
    if (!cleanDesc) {
      setErrorMsg('La descripción del producto es obligatoria.');
      return;
    }
    if (newCantidad <= 0) {
      setErrorMsg('La cantidad a ingresar debe ser al menos 1.');
      return;
    }

    onAddNewIngresoItem({
      codigo: cleanCode,
      descripcion: cleanDesc,
      proveedor: newProveedor.trim() || 'SULLAIR',
      ubicacion: newUbicacion.trim() || 'A',
      categoria: newCategoria,
      cantidad: newCantidad,
      precioUnitario: newPrecio
    });

    setSuccessMsg(`✓ Nuevo producto "${cleanCode}" registrado y agregado al lote de entrada.`);
    setErrorMsg(null);
    setNewCodigo('');
    setNewDescripcion('');
    setNewCantidad(1);
    setNewPrecio(0);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-sky-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#badbf5] max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b shrink-0 ${
          mode === 'salida' ? 'bg-[#f4f9fd] border-[#c4e1f7]' : mode === 'devolucion' ? 'bg-amber-50 border-amber-200' : 'bg-[#f0fdf4] border-emerald-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs ${
              mode === 'salida' ? 'bg-rose-600' : mode === 'devolucion' ? 'bg-amber-600' : 'bg-emerald-600'
            }`}>
              {mode === 'devolucion' ? <RotateCcw className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-sky-950">
                  {mode === 'salida' ? 'Carga Manual de Salida' : mode === 'devolucion' ? 'Carga Manual de Devolución' : 'Carga Manual de Entrada'}
                </h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  mode === 'salida' ? 'bg-rose-100 text-rose-800' : mode === 'devolucion' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {mode === 'salida' ? 'Retiro' : mode === 'devolucion' ? 'Devolución' : 'Ingreso'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {mode === 'salida' 
                  ? 'Busca y selecciona repuestos del inventario para cargar a la salida'
                  : mode === 'devolucion'
                  ? 'Busca y selecciona repuestos para reintegrar a pañol'
                  : 'Ingresa repuestos al pañol buscando del catálogo o creando un nuevo ítem'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ingreso Mode Selector Tabs */}
        {mode === 'ingreso' && (
          <div className="flex border-b border-slate-200 bg-[#f8fbfe] px-4 pt-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIngresoTab('existente');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                ingresoTab === 'existente'
                  ? 'border-emerald-600 text-emerald-900 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>Repuesto Existente</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIngresoTab('nuevo');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`px-4 py-2.5 text-xs font-black rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                ingresoTab === 'nuevo'
                  ? 'border-emerald-600 text-emerald-900 bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Nuevo Repuesto a Crear</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Notifications */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {(mode === 'salida' || ingresoTab === 'existente') && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Buscar producto por código, descripción, marca o ubicación:
                </label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      if (selectedItem) setSelectedItem(null);
                    }}
                    placeholder="Escribe código (ej: 02250100-084) o nombre..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-bold rounded-xl border border-[#9eccf0] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Matching Products List */}
              {searchTerm.trim() !== '' && !selectedItem && (
                <div className="border border-[#badbf5] rounded-2xl overflow-hidden bg-white shadow-xs max-h-56 overflow-y-auto divide-y divide-[#e2effa]">
                  <div className="bg-[#eaf4fb] px-3 py-1.5 text-[10px] font-bold text-sky-950 uppercase tracking-wider flex items-center justify-between">
                    <span>Resultados ({filteredItems.length})</span>
                    <span className="text-slate-500">Selecciona para cargar</span>
                  </div>

                  {filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No se encontraron repuestos con ese término de búsqueda.
                    </div>
                  ) : (
                    filteredItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectProduct(item)}
                        className="w-full text-left p-2.5 hover:bg-[#eaf4fb] transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-[#006bb0]">
                              {item.codigo}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-bold uppercase">
                              {item.proveedor}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono">
                              Ubic: {item.ubicacion}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 font-medium">
                            {item.descripcion}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            item.stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.stock} u.
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected Product Card & Form */}
              {selectedItem && (
                <div className={`p-4 rounded-2xl border ${
                  mode === 'salida' ? 'bg-[#f4f9fd] border-[#badbf5]' : 'bg-[#f0fdf4] border-emerald-200'
                } space-y-3 animate-in zoom-in-95`}>
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Producto Seleccionado</span>
                      <h4 className="text-sm font-black text-slate-900 font-mono">{selectedItem.codigo}</h4>
                      <p className="text-xs text-slate-700 font-medium">{selectedItem.descripcion}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-semibold text-slate-600">Marca: <strong>{selectedItem.proveedor}</strong></span>
                        <span>•</span>
                        <span className="text-[11px] font-semibold text-slate-600">Ubicación: <strong>{selectedItem.ubicacion}</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Stock Actual</span>
                      <span className={`text-sm font-black px-2.5 py-1 rounded-lg inline-block ${
                        selectedItem.stock > 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                      }`}>
                        {selectedItem.stock} unidades
                      </span>
                    </div>
                  </div>

                  {mode === 'devolucion' ? (
                    <form onSubmit={handleConfirmDevolucion} className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Cantidad a Devolver al Pañol:
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-xl border border-amber-300 bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setSalidaQty(prev => Math.max(1, prev - 1))}
                              className="w-10 h-10 flex items-center justify-center hover:bg-amber-50 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={salidaQty}
                              onChange={e => setSalidaQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 text-center font-mono font-black text-sm text-slate-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setSalidaQty(prev => prev + 1)}
                              className="w-10 h-10 flex items-center justify-center hover:bg-amber-50 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSalidaQty(1)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                            >
                              1 u.
                            </button>
                            <button
                              type="button"
                              onClick={() => setSalidaQty(5)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                            >
                              5 u.
                            </button>
                            <button
                              type="button"
                              onClick={() => setSalidaQty(10)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                            >
                              10 u.
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(null)}
                          className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 cursor-pointer"
                        >
                          Cambiar producto
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 bg-amber-600 hover:bg-amber-700 cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Agregar {salidaQty} u. a Devolución</span>
                        </button>
                      </div>
                    </form>
                  ) : mode === 'salida' ? (
                    <form onSubmit={handleConfirmSalida} className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Cantidad a Retirar:
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center rounded-xl border border-[#badbf5] bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setSalidaQty(prev => Math.max(1, prev - 1))}
                              className="w-10 h-10 flex items-center justify-center hover:bg-sky-50 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={selectedItem.stock}
                              value={salidaQty}
                              onChange={e => setSalidaQty(Math.max(1, Math.min(selectedItem.stock, parseInt(e.target.value) || 1)))}
                              className="w-16 text-center font-mono font-black text-sm text-slate-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setSalidaQty(prev => Math.min(selectedItem.stock, prev + 1))}
                              className="w-10 h-10 flex items-center justify-center hover:bg-sky-50 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSalidaQty(1)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                            >
                              1 u.
                            </button>
                            {selectedItem.stock >= 5 && (
                              <button
                                type="button"
                                onClick={() => setSalidaQty(5)}
                                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                              >
                                5 u.
                              </button>
                            )}
                            {selectedItem.stock > 0 && (
                              <button
                                type="button"
                                onClick={() => setSalidaQty(selectedItem.stock)}
                                className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-[#badbf5] bg-sky-50 text-[#006bb0] hover:bg-sky-100 cursor-pointer"
                              >
                                Todo ({selectedItem.stock})
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(null)}
                          className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 cursor-pointer"
                        >
                          Cambiar producto
                        </button>
                        <button
                          type="submit"
                          disabled={selectedItem.stock <= 0}
                          className={`px-5 py-2.5 rounded-xl text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 ${
                            selectedItem.stock > 0
                              ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          <span>Agregar {salidaQty} u. a Salida</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmExistingIngreso} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Cantidad a Ingresar:
                          </label>
                          <div className="flex items-center rounded-xl border border-emerald-300 bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setIngresoQty(prev => Math.max(1, prev - 1))}
                              className="w-10 h-10 flex items-center justify-center hover:bg-emerald-50 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={ingresoQty}
                              onChange={e => setIngresoQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 text-center font-mono font-black text-sm text-slate-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setIngresoQty(prev => prev + 1)}
                              className="w-10 h-10 flex items-center justify-center hover:bg-emerald-50 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Precio Unitario (Opcional):
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={ingresoPrecio}
                            onChange={e => setIngresoPrecio(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-emerald-300 bg-white"
                          />
                        </div>
                      </div>

                      {/* Live Valuation Calculation */}
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                          <Calculator className="w-4 h-4 text-emerald-600" />
                          <span>Valor Total del Lote:</span>
                        </div>
                        <span className="font-mono font-black text-emerald-700 text-sm">
                          ${((ingresoQty || 0) * (ingresoPrecio || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(null)}
                          className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 cursor-pointer"
                        >
                          Cambiar producto
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <PackagePlus className="w-4 h-4" />
                          <span>Agregar {ingresoQty} u. al Ingreso</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* New Item Form (Ingreso Mode Only) */}
          {mode === 'ingreso' && ingresoTab === 'nuevo' && (
            <form onSubmit={handleConfirmNewIngreso} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Código de Repuesto *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCodigo}
                    onChange={e => setNewCodigo(e.target.value)}
                    placeholder="Ej: 02250100-084"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Proveedor / Marca *
                  </label>
                  <input
                    type="text"
                    list="manual-suppliers-list"
                    value={newProveedor}
                    onChange={e => setNewProveedor(e.target.value)}
                    placeholder="SULLAIR, SKF, DONALDSON..."
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 bg-white"
                  />
                  <datalist id="manual-suppliers-list">
                    {PARAMETRIZED_SUPPLIERS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Descripción / Denominación *
                </label>
                <input
                  type="text"
                  required
                  value={newDescripcion}
                  onChange={e => setNewDescripcion(e.target.value)}
                  placeholder="Ej: Filtro de aceite Sullube elemento principal..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Categoría Pañol
                  </label>
                  <select
                    value={newCategoria}
                    onChange={e => setNewCategoria(e.target.value as ItemCategory)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-white"
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={newUbicacion}
                    onChange={e => setNewUbicacion(e.target.value)}
                    placeholder="A, B, Cajón..."
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-emerald-300 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cantidad Inicial
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCantidad}
                    onChange={e => setNewCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-emerald-300 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Precio Unit. ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrecio}
                    onChange={e => setNewPrecio(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-emerald-300 bg-white"
                  />
                </div>
              </div>

              {/* Live Valuation for New Item */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span>Valor Total Calculado:</span>
                </div>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  ${((newCantidad || 0) * (newPrecio || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Crear y Agregar al Ingreso (+{newCantidad} u.)</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-[#f8fbfe] border-t border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Los productos cargados se añaden al borrador activo.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Listo / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
