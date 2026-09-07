import React, { useState, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Scan, 
  Barcode, 
  Plus, 
  Download, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  ArrowUpDown, 
  Package
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ItemCategory, InventoryItem } from '../types';
import { AddProductModal } from './AddProductModal';

export type TableCategory = ItemCategory | 'all';

interface InventoryTableProps {
  category?: TableCategory;
  onOpenScanner: (code?: string, mode?: 'salida' | 'ingreso') => void;
  onOpenBarcode: (item: InventoryItem) => void;
  onOpenDetail?: (item: InventoryItem) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  category = 'all',
  onOpenScanner,
  onOpenBarcode,
  onOpenDetail
}) => {
  const { 
    items, 
    updateItem, 
    deleteItem, 
    exportCategoryToExcel, 
    currentUser 
  } = useInventory();

  const [selectedCategory, setSelectedCategory] = useState<string>(category);
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('all');
  const [selectedUbicacion, setSelectedUbicacion] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'stock' | 'por_encargo'>('all');
  const [sortBy, setSortBy] = useState<'codigo' | 'stock' | 'precio' | 'ubicacion'>('codigo');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Sync category prop if changed
  React.useEffect(() => {
    setSelectedCategory(category);
    setSelectedSubCat('all');
  }, [category]);
  
  // Table horizontal scrolling ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Add item modal
  const [isAddingItem, setIsAddingItem] = useState<boolean>(false);

  // Edit item inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editUbicacion, setEditUbicacion] = useState<string>('');
  const [editPorEncargo, setEditPorEncargo] = useState<boolean>(false);

  const CATEGORY_NAMES: Record<string, string> = {
    all: 'Todo el Inventario',
    panol: 'Pañol (General)',
    cajones_fluidos: 'Cajones / Fluidos',
    submicronicos: 'Submicrónicos',
    rodamientos: 'Rodamientos',
    entrepiso: 'Entrepiso',
    importado: 'Stock Importado',
    repuestos_mv: 'Repuestos MV',
    cajas: 'Cajas Estantes'
  };

  // Category Configuration
  const CATEGORY_META: Record<string, {
    title: string;
    subCategories: string[];
    showProvider: boolean;
    showPServicio: boolean;
    showTotal: boolean;
  }> = {
    all: {
      title: 'Inventario General de Pañol',
      subCategories: [],
      showProvider: true,
      showPServicio: true,
      showTotal: true,
    },
    panol: {
      title: 'Pañol (Inventario General)',
      subCategories: [],
      showProvider: true,
      showPServicio: false,
      showTotal: true,
    },
    cajones_fluidos: {
      title: 'Cajones y Fluidos',
      subCategories: ['Cajones', 'Fluidos'],
      showProvider: true,
      showPServicio: false,
      showTotal: true,
    },
    submicronicos: {
      title: 'Filtros Submicrónicos',
      subCategories: [],
      showProvider: true,
      showPServicio: true,
      showTotal: true,
    },
    rodamientos: {
      title: 'Rodamientos',
      subCategories: [],
      showProvider: true,
      showPServicio: false,
      showTotal: false,
    },
    entrepiso: {
      title: 'Entrepiso Pañol',
      subCategories: [],
      showProvider: true,
      showPServicio: false,
      showTotal: false,
    },
    importado: {
      title: 'Stock Importado',
      subCategories: [],
      showProvider: true,
      showPServicio: false,
      showTotal: true,
    },
    repuestos_mv: {
      title: 'Repuestos MV',
      subCategories: [],
      showProvider: true,
      showPServicio: false,
      showTotal: true,
    },
    cajas: {
      title: 'Cajas Estantes',
      subCategories: [],
      showProvider: true,
      showPServicio: false,
      showTotal: true,
    }
  };

  const meta = CATEGORY_META[selectedCategory] || CATEGORY_META.all;

  const isVentas = currentUser?.rol === 'ventas';
  const isGerencia = currentUser?.rol === 'gerencia';
  const showPrices = isGerencia;
  const VENTAS_ALLOWED = ['panol', 'cajones_fluidos', 'submicronicos', 'rodamientos', 'entrepiso'];

  // Filter items
  const categoryItems = items.filter(item => {
    if (isVentas && !VENTAS_ALLOWED.includes(item.categoria)) {
      return false;
    }

    if (selectedCategory !== 'all' && item.categoria !== selectedCategory) {
      return false;
    }
    
    if (selectedSubCat !== 'all') {
      const matchSub = item.subcategoria && item.subcategoria.toUpperCase() === selectedSubCat.toUpperCase();
      const matchProv = item.proveedor && item.proveedor.toUpperCase() === selectedSubCat.toUpperCase();
      const matchUbic = item.ubicacion && item.ubicacion.toUpperCase() === selectedSubCat.toUpperCase();
      if (!matchSub && !matchProv && !matchUbic) {
        return false;
      }
    }

    if (selectedUbicacion !== 'all') {
      if (item.ubicacion !== selectedUbicacion) return false;
    }

    if (selectedTypeFilter === 'stock') {
      if (item.porEncargo) return false;
    } else if (selectedTypeFilter === 'por_encargo') {
      if (!item.porEncargo) return false;
    }

    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      const qAlphaNum = q.replace(/[^a-zA-Z0-9]/g, '');

      // Check code
      const codeLower = item.codigo.toLowerCase();
      const codeAlphaNum = item.codigo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matchCode = codeLower.includes(q) || (qAlphaNum !== '' && codeAlphaNum.includes(qAlphaNum));

      // Check barcode (both direct, alphanumeric, and split segments)
      const barcodeLower = (item.codigoBarras || '').toLowerCase();
      const barcodeAlphaNum = (item.codigoBarras || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      let matchBarcode = barcodeLower.includes(q) || (qAlphaNum !== '' && barcodeAlphaNum.includes(qAlphaNum));
      
      if (!matchBarcode && item.codigoBarras) {
        const parts = item.codigoBarras.split(/[\/,;\s]+/).map(p => p.trim().toLowerCase()).filter(Boolean);
        matchBarcode = parts.some(p => p.includes(q) || (qAlphaNum !== '' && p.replace(/[^a-zA-Z0-9]/g, '').includes(qAlphaNum)));
      }

      return (
        matchCode ||
        matchBarcode ||
        item.descripcion.toLowerCase().includes(q) ||
        item.proveedor.toLowerCase().includes(q) ||
        item.ubicacion.toLowerCase().includes(q) ||
        (item.equivalencias && item.equivalencias.toLowerCase().includes(q))
      );
    }

    return true;
  });

  // Unique ubicaciones in this category
  const availableUbicaciones = Array.from(
    new Set(
      items.filter(i => selectedCategory === 'all' || i.categoria === selectedCategory)
        .map(i => i.ubicacion)
        .filter(Boolean)
    )
  ).sort();

  if (isVentas && category !== 'all' && !VENTAS_ALLOWED.includes(category)) {
    return (
      <div className="bg-[#f4f9fd] rounded-2xl p-8 sm:p-12 border border-[#c4e1f7] shadow-xs text-center flex flex-col items-center justify-center max-w-xl mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
          <Package className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-sky-950">Sección Reservada para Pañol y Gerencia</h2>
        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
          El perfil de Ventas tiene acceso exclusivo a las tablas de Pañol, Cajones / Fluidos, Submicrónicos, Rodamientos y Entrepiso.
        </p>
      </div>
    );
  }

  // Sort
  const sortedItems = [...categoryItems].sort((a, b) => {
    let comp = 0;
    if (sortBy === 'codigo') comp = a.codigo.localeCompare(b.codigo);
    if (sortBy === 'stock') comp = a.stock - b.stock;
    if (sortBy === 'precio') comp = a.precio - b.precio;
    if (sortBy === 'ubicacion') comp = a.ubicacion.localeCompare(b.ubicacion);
    return sortAsc ? comp : -comp;
  });

  const handleStartInlineEdit = (item: InventoryItem) => {
    if (isVentas) return;
    setEditingId(item.id);
    setEditPrice(item.precio);
    setEditStock(item.stock);
    setEditUbicacion(item.ubicacion);
    setEditPorEncargo(!!item.porEncargo);
  };

  const handleSaveInlineEdit = (id: string) => {
    if (isVentas) return;
    updateItem(id, {
      precio: editPrice,
      stock: editStock,
      ubicacion: editUbicacion,
      porEncargo: editPorEncargo,
      precioTotal: editStock * editPrice
    });
    setEditingId(null);
  };

  const porEncargoCount = categoryItems.filter(i => i.porEncargo).length;
  const inStockRegularCount = categoryItems.filter(i => !i.porEncargo).length;

  const getSubCategoryCount = (sub: string) => {
    return items.filter(item => {
      if (selectedCategory !== 'all' && item.categoria !== selectedCategory) return false;
      const matchSub = item.subcategoria && item.subcategoria.toUpperCase() === sub.toUpperCase();
      const matchProv = item.proveedor && item.proveedor.toUpperCase() === sub.toUpperCase();
      const matchUbic = item.ubicacion && item.ubicacion.toUpperCase() === sub.toUpperCase();
      return matchSub || matchProv || matchUbic;
    }).length;
  };
  const allSubCategoryCount = items.filter(item => selectedCategory === 'all' || item.categoria === selectedCategory).length;

  return (
    <div className="flex flex-col gap-3.5 animate-in fade-in duration-200 w-full">
      
      {/* Category Header Bar */}
      <div className="bg-[#f4f9fd] rounded-2xl p-4 sm:p-5 border border-[#c4e1f7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-black text-sky-950 tracking-tight flex items-center gap-2">
              <span>{meta.title}</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#d6ecfa] text-[#006bb0] text-xs font-bold font-mono border border-[#badbf5]">
              {sortedItems.length} {sortedItems.length === 1 ? 'ítem' : 'ítems'}
            </span>
            {porEncargoCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200">
                {porEncargoCount} Por Encargo
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Registrar Producto Nuevo */}
          {!isVentas && (
            <button
              onClick={() => setIsAddingItem(true)}
              className="px-3.5 py-2 sm:py-2.5 border border-[#9fd0f5] bg-[#e1effa] hover:bg-[#d0e6f7] text-[#006bb0] text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Dar de alta un producto manualmente en el inventario"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar producto nuevo</span>
            </button>
          )}

          <button
            onClick={() => exportCategoryToExcel(category)}
            className="px-3 py-2 sm:py-2.5 border border-[#b8ddf5] bg-white hover:bg-[#eaf4fb] text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Exportar esta sección a Excel"
          >
            <Download className="w-3.5 h-3.5 text-[#006bb0]" />
            <span className="hidden xs:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filter & Subcategory Pill Bar */}
      <div className="bg-[#f4f9fd] rounded-xl p-3 border border-[#c4e1f7] shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && sortedItems.length === 1) {
                onOpenDetail?.(sortedItems[0]);
              }
            }}
            placeholder="Buscar por código, descripción, equivalencia, marca..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
          />
          <Search className="w-3.5 h-3.5 text-sky-500 absolute left-3 top-1/2 -translate-y-1/2" />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter by Type: Todos | En Stock | Por Encargo */}
        <div className="flex items-center gap-1.5 shrink-0 bg-[#e4f1fa] p-1 rounded-xl border border-[#c6e1f7]">
          <button
            onClick={() => setSelectedTypeFilter('all')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedTypeFilter === 'all'
                ? 'bg-[#006bb0] text-white shadow-2xs'
                : 'text-slate-700 hover:text-sky-950'
            }`}
          >
            Todos ({categoryItems.length})
          </button>
          <button
            onClick={() => setSelectedTypeFilter('stock')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              selectedTypeFilter === 'stock'
                ? 'bg-[#006bb0] text-white shadow-2xs'
                : 'text-slate-700 hover:text-sky-950'
            }`}
          >
            En Stock ({inStockRegularCount})
          </button>
          <button
            onClick={() => setSelectedTypeFilter('por_encargo')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              selectedTypeFilter === 'por_encargo'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'text-purple-900 hover:text-purple-950'
            }`}
          >
            <span>📦 Por Encargo</span>
            {porEncargoCount > 0 && <span className="text-[10px] opacity-90">({porEncargoCount})</span>}
          </button>
        </div>

        {/* Subcategory / Brand Pills */}
        {meta.subCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedSubCat('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedSubCat === 'all'
                  ? 'bg-[#006bb0] text-white shadow-xs'
                  : 'bg-white border border-[#cce4f8] text-slate-700 hover:bg-[#e4f2fb]'
              }`}
            >
              <span>Todos</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                selectedSubCat === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {allSubCategoryCount}
              </span>
            </button>
            {meta.subCategories.map(sub => {
              const subCount = getSubCategoryCount(sub);
              return (
                <button
                  key={sub}
                  onClick={() => setSelectedSubCat(sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedSubCat === sub
                      ? 'bg-[#006bb0] text-white shadow-xs'
                      : 'bg-white border border-[#cce4f8] text-slate-700 hover:bg-[#e4f2fb]'
                  }`}
                >
                  <span>{sub}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    selectedSubCat === sub ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {subCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Ubicación Dropdown filter */}
        {availableUbicaciones.length > 0 && !['rodamientos', 'entrepiso', 'repuestos_mv', 'cajas'].includes(selectedCategory) && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#006bb0]" />
              Ubicación:
            </span>
            <select
              value={selectedUbicacion}
              onChange={e => setSelectedUbicacion(e.target.value)}
              className="text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-[#b8ddf5] bg-white text-slate-800"
            >
              <option value="all">Todas ({availableUbicaciones.length})</option>
              {availableUbicaciones.map(ubi => (
                <option key={ubi} value={ubi}>
                  Estante / Posición {ubi}
                </option>
              ))}
            </select>
          </div>
        )}

      </div>

      {/* Main Responsive Expanded Table Container */}
      <div className="bg-[#f8fcfe] rounded-2xl border border-[#c4e1f7] shadow-xs overflow-hidden w-full">
        <div ref={tableContainerRef} className="overflow-auto max-h-[calc(100vh-215px)] min-h-[380px] w-full scroll-smooth table-scrollbar">
          <table className="w-full text-left text-xs border-collapse divide-y divide-[#cce4f8]">
            <thead className="sticky top-0 z-10 bg-[#dbeefa] text-sky-950 font-bold tracking-wider shadow-2xs">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">
                  <span>CÓDIGO</span>
                </th>

                {meta.showProvider && (
                  <th className="px-3 py-2.5 whitespace-nowrap">PROVEEDOR / MARCA</th>
                )}

                <th className="px-3 py-2.5 min-w-[160px]">DESCRIPCIÓN</th>

                <th className="px-3 py-2.5 whitespace-nowrap">
                  <span>EQUIVALENCIAS</span>
                </th>

                <th 
                  onClick={() => {
                    if (sortBy === 'ubicacion') {
                      setSortAsc(!sortAsc);
                    } else {
                      setSortBy('ubicacion');
                      setSortAsc(true);
                    }
                  }}
                  className="px-3 py-2.5 cursor-pointer hover:bg-[#cfe5f5] transition-colors whitespace-nowrap select-none group"
                  title="Clic para ordenar por Ubicación"
                >
                  <div className="flex items-center gap-1">
                    <span className="font-black text-sky-950 group-hover:text-[#006bb0] transition-colors">
                      UBICACIÓN ↕
                    </span>
                  </div>
                </th>

                <th 
                  onClick={() => {
                    if (sortBy === 'stock') {
                      setSortAsc(!sortAsc);
                    } else {
                      setSortBy('stock');
                      setSortAsc(false);
                    }
                  }}
                  className="px-3 py-2.5 text-right cursor-pointer hover:bg-[#cfe5f5] transition-colors whitespace-nowrap select-none group"
                  title="Clic para ordenar por Stock"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-black text-sky-950 group-hover:text-[#006bb0] transition-colors">
                      STOCK ↕
                    </span>
                  </div>
                </th>

                {meta.showPServicio && (
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">P/SERVICIO</th>
                )}

                {/* Precio Unitario - Only for Gerencia */}
                {showPrices && (
                  <th 
                    onClick={() => { setSortBy('precio'); setSortAsc(!sortAsc); }}
                    className="px-3 py-2.5 text-right cursor-pointer hover:bg-[#cfe5f5] transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>PRECIO UNIT.</span>
                      <ArrowUpDown className="w-3 h-3 text-sky-600" />
                    </div>
                  </th>
                )}

                {/* Total Valor - Only for Gerencia */}
                {meta.showTotal && showPrices && (
                  <th className="px-3 py-2.5 text-right whitespace-nowrap font-black text-sky-950">
                    TOTAL VALOR
                  </th>
                )}

                <th className="px-3 py-2.5 text-center whitespace-nowrap">ACCIONES</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e2effa] bg-white">
              {sortedItems.length > 0 ? (
                sortedItems.map((item, idx) => {
                  const isEditing = editingId === item.id;
                  const isPorEncargo = item.porEncargo === true;
                  const isOutOfStock = !isPorEncargo && item.stock === 0;
                  const isLowStock = !isPorEncargo && item.stock > 0 && item.stock <= (item.stockMinimo || 1);

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-[#e5f3fd] transition-colors ${
                        isOutOfStock 
                          ? 'bg-rose-50/40' 
                          : isPorEncargo
                            ? 'bg-purple-50/30'
                            : idx % 2 === 1 
                              ? 'bg-[#f4f9fd]' 
                              : 'bg-white'
                      }`}
                    >
                      {/* Código */}
                      <td className="px-3 py-2 font-mono font-bold text-sky-950 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#006bb0]">{item.codigo}</span>
                          {item.codigoBarras && item.codigoBarras.trim() !== '' && (
                            <span 
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200 flex items-center gap-1 shadow-2xs"
                              title={`Código de barras: ${item.codigoBarras}`}
                            >
                              <Barcode className="w-3 h-3 text-slate-500" />
                              <span>{item.codigoBarras}</span>
                            </span>
                          )}
                          {selectedCategory === 'all' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-100/80 text-[#005590] font-sans font-bold border border-sky-200 uppercase">
                              {item.categoria.replace('_', ' ')}
                            </span>
                          )}
                          {item.subcategoria && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#e8f4fc] text-slate-600 font-sans font-normal border border-[#d2e8f8]">
                              {item.subcategoria}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Proveedor */}
                      {meta.showProvider && (
                        <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-[#e8f4fc] text-sky-950 text-[11px] font-bold border border-[#d2e8f8]">
                            {item.proveedor}
                          </span>
                        </td>
                      )}

                      {/* Descripción & Badges */}
                      <td 
                        className={`px-3 py-2 text-slate-800 font-medium max-w-xs md:max-w-md ${
                          onOpenDetail ? 'cursor-pointer hover:text-[#006bb0] group/desc' : ''
                        }`}
                        onClick={() => onOpenDetail?.(item)}
                        title={onOpenDetail ? "Clic para ver la descripción completa y ficha técnica" : undefined}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="leading-snug group-hover/desc:underline">{item.descripcion}</span>
                          {isPorEncargo && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700">
                              📦 Por Encargo
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Equivalencias */}
                      <td className="px-3 py-2 font-mono text-[11px] whitespace-normal">
                        {item.equivalencias ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-sky-50 text-[#005590] border border-sky-200 font-bold">
                            {item.equivalencias}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Ubicación */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editUbicacion}
                            onChange={e => setEditUbicacion(e.target.value)}
                            className="w-16 px-1.5 py-0.5 text-xs rounded border border-[#006bb0] font-bold uppercase bg-white"
                          />
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md font-mono font-bold text-xs bg-[#e8f4fc] text-sky-950 border border-[#c4e1f7]">
                            {item.ubicacion || 'A'}
                          </span>
                        )}
                      </td>

                      {/* Stock & Disponibilidad */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex flex-col items-end gap-1">
                            <input
                              type="number"
                              value={editStock}
                              onChange={e => setEditStock(parseInt(e.target.value) || 0)}
                              className="w-16 px-1.5 py-0.5 text-right text-xs rounded border border-[#006bb0] font-bold bg-white"
                            />
                            <label className="flex items-center gap-1 text-[10px] font-bold text-purple-900 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editPorEncargo}
                                onChange={e => setEditPorEncargo(e.target.checked)}
                                className="rounded text-purple-700"
                              />
                              Por encargo
                            </label>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {isPorEncargo ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-purple-100 text-purple-900 border border-purple-200">
                                {item.stock > 0 ? `${item.stock} u.` : 'A pedido'}
                              </span>
                            ) : isOutOfStock ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-black font-mono bg-rose-100 text-rose-800 border border-rose-200">
                                0 u.
                              </span>
                            ) : isLowStock ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-black font-mono bg-amber-100 text-amber-800 border border-amber-200">
                                {item.stock} u. Bajo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-black font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {item.stock} u.
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* P/Servicio */}
                      {meta.showPServicio && (
                        <td className="px-3 py-2 text-center whitespace-nowrap font-mono text-slate-600">
                          {item.paraServicio || '-'}
                        </td>
                      )}

                      {/* Precio Unitario - Only for Gerencia */}
                      {showPrices && (
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-slate-800 font-semibold">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.1"
                              value={editPrice}
                              onChange={e => setEditPrice(parseFloat(e.target.value) || 0)}
                              className="w-20 px-1.5 py-0.5 text-right text-xs rounded border border-[#006bb0] font-bold bg-white"
                            />
                          ) : (
                            item.precio > 0 
                              ? `$${item.precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` 
                              : <span className="text-slate-400">$0,00</span>
                          )}
                        </td>
                      )}

                      {/* Total - Only for Gerencia */}
                      {meta.showTotal && showPrices && (
                        <td className="px-3 py-2 text-right font-mono font-bold text-sky-950 whitespace-nowrap">
                          ${(item.precioTotal || (item.stock * item.precio) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveInlineEdit(item.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors cursor-pointer"
                              title="Guardar cambios"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {/* Fast Scanner / Salida trigger (Hidden in Ventas) */}
                            {!isVentas && (
                              <button
                                onClick={() => onOpenScanner(item.codigo)}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  item.stock > 0
                                    ? 'bg-[#006bb0] hover:bg-[#005590] text-white shadow-xs'
                                    : 'bg-white border border-[#c4e1f7] text-slate-500 hover:bg-[#e4f2fb]'
                                }`}
                                title="Despachar este producto"
                              >
                                <Scan className="w-3 h-3" />
                                <span className="hidden sm:inline">Salida</span>
                              </button>
                            )}

                            {/* Barcode scan and link button */}
                            <button
                              onClick={() => onOpenBarcode(item)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                item.codigoBarras && item.codigoBarras.trim() !== ''
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs'
                                  : 'text-slate-500 hover:text-[#006bb0] hover:bg-[#e2f1fc]'
                              }`}
                              title={
                                item.codigoBarras && item.codigoBarras.trim() !== ''
                                  ? `Código de barras vinculado: ${item.codigoBarras} (clic para ver o cambiar)`
                                  : 'Vincular código de barras (lector USB o manual)'
                              }
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit (Restricted: Pañol & Gerencia only) */}
                            {!isVentas && (
                              <button
                                onClick={() => handleStartInlineEdit(item)}
                                className="p-1.5 text-slate-500 hover:text-[#006bb0] hover:bg-[#e2f1fc] rounded-lg transition-colors cursor-pointer"
                                title="Editar precio/stock/tipo"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete (Gerencia only) */}
                            {currentUser?.rol === 'gerencia' && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`¿Eliminar ${item.codigo} del inventario?`)) {
                                    deleteItem(item.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isVentas ? 7 : 10} className="p-10 text-center text-slate-500">
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto py-6">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#006bb0] flex items-center justify-center border border-sky-200 shadow-2xs">
                          <Package className="w-6 h-6" />
                        </div>
                        <h4 className="font-black text-sky-950 text-base">Inventario Limpio y Listo</h4>
                        <p className="text-xs text-slate-500 text-center leading-relaxed">
                          La base de datos está vacía. Puedes cargar tus productos automáticamente desde un archivo Excel o agregar nuevos artículos individualmente.
                        </p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <p className="font-semibold text-sm text-slate-600">No se encontraron productos con los filtros seleccionados.</p>
                        <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros o el término de búsqueda.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Product */}
      <AddProductModal
        isOpen={isAddingItem}
        onClose={() => setIsAddingItem(false)}
        defaultCategory={category}
      />

    </div>
  );
};
