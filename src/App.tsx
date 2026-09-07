import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Scan, 
  FileSpreadsheet, 
  ShieldCheck, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Boxes, 
  Sparkles, 
  CircleDot, 
  Droplet, 
  Cog, 
  Building, 
  Warehouse, 
  Globe2, 
  Sliders, 
  Box, 
  Search, 
  Bell, 
  User, 
  Lock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Radio,
  Zap,
  Clock,
  PackagePlus,
  RotateCcw,
  ArrowUpFromLine,
  ArrowDownToLine,
  ShoppingBag,
  History,
  Barcode
} from 'lucide-react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Logo } from './components/Logo';
import { InventoryTable } from './components/InventoryTable';
import { ScannerModal } from './components/ScannerModal';
import { BarcodeGeneratorModal } from './components/BarcodeGeneratorModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { WelcomeStartScreen } from './components/WelcomeStartScreen';
import { GerenciaDashboard } from './components/GerenciaDashboard';
import { PanoleroSimpleView } from './components/PanoleroSimpleView';
import { SalidasLogView } from './components/SalidasLogView';
import { IngresosLogView } from './components/IngresosLogView';
import { ItemCategory, InventoryItem } from './types';
import { OfflineStatusBadge } from './components/OfflineStatusBanner';

export const VENTAS_ALLOWED_CATEGORIES: ItemCategory[] = [
  'panol',
  'cajones_fluidos',
  'submicronicos',
  'rodamientos',
  'entrepiso'
];

type ActiveView = ItemCategory | 'salidas' | 'ingresos' | 'administracion';

const MainApp: React.FC = () => {
  const { 
    items, 
    salidas, 
    currentUser, 
    logout,
    getLowStockItems, 
    getOutOfStockItems, 
    totalValuation, 
    totalUnits,
    findItemByCode
  } = useInventory();

  const isVentas = currentUser?.rol === 'ventas';
  const isAdministracion = currentUser?.rol === 'administracion';
  const isPanolero = currentUser?.rol === 'panolero';

  const [activeView, setActiveView] = useState<ActiveView>('panol');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Set initial default view according to role when currentUser changes
  useEffect(() => {
    if (currentUser?.rol === 'administracion') {
      setActiveView('administracion');
    } else {
      setActiveView('panol');
    }
  }, [currentUser]);

  // Enforce allowed views for Ventas (strictly product categories only, no salidas)
  useEffect(() => {
    if (isVentas && !VENTAS_ALLOWED_CATEGORIES.includes(activeView as ItemCategory)) {
      setActiveView('panol');
    }
  }, [isVentas, activeView]);
  
  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerInitialCode, setScannerInitialCode] = useState<string | undefined>(undefined);
  const [scannerDefaultMode, setScannerDefaultMode] = useState<'salida' | 'ingreso' | 'devolucion'>('salida');
  
  const [isBarcodeOpen, setIsBarcodeOpen] = useState<boolean>(false);
  const [barcodeItem, setBarcodeItem] = useState<InventoryItem | null>(null);

  const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Global search
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [globalSearchResults, setGlobalSearchResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);

  const handleOpenProductDetail = (item: InventoryItem) => {
    setSelectedDetailItem(item);
    setIsDetailModalOpen(true);
    setIsSearching(false);
    setMobileSearchOpen(false);
  };

  // Horizontal scroll navigation for Categories Bar (Gerencia / Ventas)
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);

  const checkScrollButtons = () => {
    if (tabsNavRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsNavRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener('resize', checkScrollButtons);
    return () => window.removeEventListener('resize', checkScrollButtons);
  }, []);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsNavRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tabsNavRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScrollButtons, 300);
    }
  };

  // Global hardware scanner listener across the entire application
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If modal is already open or user is actively typing in a standard input, let the modal or input handle it
      if (isScannerOpen || isBarcodeOpen) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (timeDiff > 120) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          e.preventDefault();
          const scannedCode = buffer.trim();
          buffer = '';
          if (isPanolero) {
            // For pañolero, dispatch scan event to search lookup rather than auto-opening Salida
            window.dispatchEvent(new CustomEvent('panolero-scan-search', { detail: scannedCode }));
          } else if (isVentas) {
            // In Ventas, strictly look up product detail, never open Salida
            const item = findItemByCode(scannedCode);
            if (item) {
              handleOpenProductDetail(item);
            } else {
              handleGlobalSearchChange(scannedCode);
            }
          } else {
            handleOpenScanner(scannedCode);
          }
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isScannerOpen, isBarcodeOpen]);

  // If no user is logged in, show the Welcome / Start Screen
  if (!currentUser) {
    return <WelcomeStartScreen />;
  }

  const lowStock = getLowStockItems();
  const outOfStock = getOutOfStockItems();

  const handleOpenScanner = (code?: string, mode: 'salida' | 'ingreso' | 'devolucion' = 'salida') => {
    setScannerInitialCode(code);
    setScannerDefaultMode(mode);
    setIsScannerOpen(true);
  };

  const handleOpenBarcode = (item: InventoryItem) => {
    setBarcodeItem(item);
    setIsBarcodeOpen(true);
  };

  const handleGlobalSearchChange = (q: string) => {
    setGlobalSearch(q);
    if (!q.trim()) {
      setIsSearching(false);
      setGlobalSearchResults([]);
      return;
    }
    setIsSearching(true);
    const searchLower = q.toLowerCase();
    const searchAlphaNum = searchLower.replace(/[^a-zA-Z0-9]/g, '');

    const matches = items.filter(item => {
      if (isVentas && !VENTAS_ALLOWED_CATEGORIES.includes(item.categoria)) {
        return false;
      }
      const codeLower = item.codigo.toLowerCase();
      const codeAlphaNum = item.codigo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const matchCode = codeLower.includes(searchLower) || (searchAlphaNum !== '' && codeAlphaNum.includes(searchAlphaNum));

      const barcodeLower = (item.codigoBarras || '').toLowerCase();
      const barcodeAlphaNum = (item.codigoBarras || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      let matchBarcode = barcodeLower.includes(searchLower) || (searchAlphaNum !== '' && barcodeAlphaNum.includes(searchAlphaNum));

      if (!matchBarcode && item.codigoBarras) {
        const parts = item.codigoBarras.split(/[\/,;\s]+/).map(p => p.trim().toLowerCase()).filter(Boolean);
        matchBarcode = parts.some(p => p.includes(searchLower) || (searchAlphaNum !== '' && p.replace(/[^a-zA-Z0-9]/g, '').includes(searchAlphaNum)));
      }

      const descLower = item.descripcion.toLowerCase();
      const provLower = item.proveedor.toLowerCase();
      const ubicLower = item.ubicacion.toLowerCase();
      const equivLower = (item.equivalencias || '').toLowerCase();

      return (
        matchCode ||
        matchBarcode ||
        descLower.includes(searchLower) ||
        provLower.includes(searchLower) ||
        ubicLower.includes(searchLower) ||
        equivLower.includes(searchLower)
      );
    });
    setGlobalSearchResults(matches.slice(0, 15));
  };

  // Sections for Gerencia & Ventas navigation tabs
  const ALL_SECTIONS: { id: ActiveView; label: string; icon: React.FC<{ className?: string }>; count?: number }[] = [
    ...(isAdministracion ? [{ id: 'administracion' as ActiveView, label: 'Panel Administración', icon: ShieldCheck }] : []),
    { id: 'panol', label: 'Pañol (General)', icon: Warehouse, count: items.filter(i => i.categoria === 'panol').length },
    { id: 'cajones_fluidos', label: 'Cajones / Fluidos', icon: Droplet, count: items.filter(i => i.categoria === 'cajones_fluidos').length },
    { id: 'submicronicos', label: 'Submicrónicos', icon: CircleDot, count: items.filter(i => i.categoria === 'submicronicos').length },
    { id: 'rodamientos', label: 'Rodamientos', icon: Cog, count: items.filter(i => i.categoria === 'rodamientos').length },
    { id: 'entrepiso', label: 'Entrepiso', icon: Building, count: items.filter(i => i.categoria === 'entrepiso').length },
    ...(items.some(i => i.categoria === 'importado') ? [{ id: 'importado' as ActiveView, label: 'Importado', icon: Globe2, count: items.filter(i => i.categoria === 'importado').length }] : []),
    { id: 'repuestos_mv', label: 'Repuestos MV', icon: Sliders, count: items.filter(i => i.categoria === 'repuestos_mv').length },
    { id: 'cajas', label: 'Cajas Estantes', icon: Box, count: items.filter(i => i.categoria === 'cajas').length },
    { id: 'salidas', label: 'Historial Salidas', icon: History, count: salidas.length },
    { id: 'ingresos', label: 'Historial Ingresos', icon: ArrowDownLeft }
  ];

  // In Sales profile: only allowed product categories (NO salidas); Pañolero & Gerencia: all sections
  const NAV_ITEMS = isVentas
    ? ALL_SECTIONS.filter(sec => VENTAS_ALLOWED_CATEGORIES.includes(sec.id as ItemCategory))
    : ALL_SECTIONS;

  return (
    <div className="min-h-screen bg-[#edf6fc] text-slate-800 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] pb-16 lg:pb-0">
      
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#f4f9fd] border-b border-[#c4e1f7] shadow-xs">
        <div className="max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
            
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div onClick={() => setActiveView(isAdministracion ? 'administracion' : 'panol')} className="cursor-pointer">
                <Logo />
              </div>
            </div>

            {/* Global Search Bar (Desktop - Gerencia & Ventas, pañolero has integrated search in simple view) */}
            {!isPanolero && (
              <div className="hidden md:flex items-center flex-1 max-w-md mx-4 relative">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={e => handleGlobalSearchChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && globalSearchResults.length === 1) {
                        handleOpenProductDetail(globalSearchResults[0]);
                        setIsSearching(false);
                      }
                    }}
                    placeholder="Búsqueda por código, pieza o ubicación..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-[#b8ddf5] bg-white focus:bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0] transition-all"
                  />
                  <Search className="w-4 h-4 text-sky-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  {globalSearch && (
                    <button 
                      onClick={() => { setGlobalSearch(''); setIsSearching(false); }} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      title="Limpiar búsqueda"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Global search quick dropdown */}
                {isSearching && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#f8fbfe] rounded-2xl shadow-xl border border-[#c4e1f7] overflow-hidden z-50 animate-in fade-in">
                    <div className="p-2.5 bg-[#eaf4fb] border-b border-[#d0e6f7] flex items-center justify-between text-[11px] font-bold text-sky-900">
                      <span>Resultados ({globalSearchResults.length})</span>
                      <button onClick={() => setIsSearching(false)} className="text-slate-400 hover:text-slate-600">
                        Cerrar
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-[#e2effa]">
                      {globalSearchResults.length > 0 ? (
                        globalSearchResults.map(item => (
                          <div
                            key={item.id}
                            onClick={() => handleOpenProductDetail(item)}
                            className="p-3 hover:bg-[#e1f0fb] flex items-center justify-between cursor-pointer transition-colors group"
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-xs text-[#006bb0] group-hover:underline">{item.codigo}</span>
                                {item.codigoBarras && item.codigoBarras.trim() !== '' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200 flex items-center gap-1 shadow-2xs">
                                    <Barcode className="w-3 h-3 text-slate-500" />
                                    {item.codigoBarras}
                                  </span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 font-semibold uppercase border border-[#cbe4f7]">
                                  {item.proveedor}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d6ecfa] text-sky-900 font-bold">
                                  Ubic: {item.ubicacion}
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 font-medium mt-1 line-clamp-2 leading-snug">
                                {item.descripcion}
                              </p>
                              <span className="text-[10px] text-[#006bb0] font-bold mt-0.5 inline-block opacity-90">
                                ℹ️ Clic para ver descripción completa
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-xs text-emerald-700">{item.stock} u.</span>
                              <div className="text-[10px] text-slate-400 capitalize">{item.categoria.replace('_', ' ')}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No se encontraron productos con "{globalSearch}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Right Action Controls: Salida & Entrada buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              
              {/* Mobile search toggle button */}
              {!isPanolero && (
                <button
                  onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                  className="md:hidden p-2 rounded-xl border border-[#c4e1f7] text-slate-600 hover:bg-[#e2f1fc] transition-colors"
                  title="Buscar"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {/* Botón SALIDA (oculto en cuenta ventas y pañolero porque tiene sus botones táctiles dedicados) */}
              {!isPanolero && !isVentas && (
                <button
                  onClick={() => handleOpenScanner(undefined, 'salida')}
                  className="text-white font-black rounded-xl shadow-xs hover:shadow-md transition-all flex items-center group active:scale-95 cursor-pointer px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-rose-600 hover:bg-rose-700 gap-1.5 border border-rose-500"
                  title="Registrar Salida de Material con Lector de Barras"
                >
                  <ArrowUpRight className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Salida</span>
                </button>
              )}

              {/* Botón DEVOLUCIÓN (oculto en cuenta ventas y pañolero) */}
              {!isPanolero && !isVentas && (
                <button
                  onClick={() => handleOpenScanner(undefined, 'devolucion')}
                  className="text-white font-black rounded-xl shadow-xs hover:shadow-md transition-all flex items-center group active:scale-95 cursor-pointer px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-amber-600 hover:bg-amber-700 gap-1.5 border border-amber-500"
                  title="Registrar Remito de Devolución de Material"
                >
                  <RotateCcw className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Devolución</span>
                </button>
              )}

              {/* Botón ENTRADA (oculto en cuenta ventas y pañolero) */}
              {!isPanolero && !isVentas && (
                <button
                  onClick={() => handleOpenScanner(undefined, 'ingreso')}
                  className="text-white font-black rounded-xl shadow-xs hover:shadow-md transition-all flex items-center group active:scale-95 cursor-pointer px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 gap-1.5 border border-emerald-500"
                  title="Registrar Entrada / Ingreso de Stock"
                >
                  <PackagePlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Entrada</span>
                </button>
              )}

              {/* Current User Role Title */}
              <div 
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 border border-[#b8ddf5]"
                title={`Sesión activa: ${currentUser.nombre || 'Marcelo'} (${currentUser.rol})`}
              >
                {isAdministracion ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#006bb0]" />
                    <span className="text-xs font-black text-[#006bb0] tracking-wide">Administración</span>
                  </>
                ) : isVentas ? (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5 text-[#0080D0]" />
                    <span className="text-xs font-bold text-[#006bb0]">Ventas</span>
                  </>
                ) : (
                  <>
                    <Boxes className="w-3.5 h-3.5 text-[#006bb0]" />
                    <span className="text-xs font-bold text-sky-950">{currentUser.nombre || 'Marcelo'}</span>
                  </>
                )}
              </div>

              {/* Direct Logout / Salir button */}
              <button
                onClick={() => logout()}
                className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                title="Cerrar sesión y volver a la pantalla de inicio"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Cerrar Sesión</span>
                <span className="md:hidden">Salir</span>
              </button>

            </div>

          </div>

          {/* Mobile Search Expandable Bar */}
          {mobileSearchOpen && (
            <div className="md:hidden pb-3 animate-in slide-in-from-top-2">
              <div className="relative">
                <input
                  type="text"
                  value={globalSearch}
                  onChange={e => handleGlobalSearchChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && globalSearchResults.length === 1) {
                      handleOpenProductDetail(globalSearchResults[0]);
                      setIsSearching(false);
                    }
                  }}
                  placeholder="Buscar por código, pieza o ubicación..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0]"
                  autoFocus
                />
                <Search className="w-4 h-4 text-sky-500 absolute left-3 top-1/2 -translate-y-1/2" />
                {globalSearch && (
                  <button 
                    onClick={() => { setGlobalSearch(''); setIsSearching(false); }} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile Search Results */}
              {isSearching && globalSearchResults.length > 0 && (
                <div className="mt-2 bg-[#f8fbfe] rounded-xl shadow-lg border border-[#c4e1f7] max-h-64 overflow-y-auto divide-y divide-[#e2effa]">
                  {globalSearchResults.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenProductDetail(item)}
                      className="p-2.5 hover:bg-[#e1f0fb] flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-[#006bb0]">{item.codigo}</span>
                          {item.codigoBarras && item.codigoBarras.trim() !== '' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200 flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-slate-500" />
                              {item.codigoBarras}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-slate-700 font-semibold uppercase border border-[#cbe4f7]">
                            {item.proveedor}
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium line-clamp-1 text-[11px] mt-0.5">{item.descripcion}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-emerald-700 block">{item.stock} u.</span>
                        <span className="text-[9px] text-[#006bb0] font-semibold">Ver detalle</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Categories / Sections Navigation Sub-Bar (Oculto para pañolero, que utiliza su pantalla táctil dedicada) */}
        {!isPanolero && (
          <div className="bg-[#e9f4fc] border-t border-[#c6e1f7] relative">
            <div className="max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6 flex items-center gap-1 sm:gap-2">
              
              {/* Left scroll navigation arrow button */}
              <button
                type="button"
                onClick={() => scrollTabs('left')}
                disabled={!canScrollLeft}
                className={`p-1.5 sm:p-2 rounded-xl border border-[#badbf5] bg-white text-[#006bb0] hover:bg-sky-50 shadow-2xs transition-all shrink-0 z-10 flex items-center justify-center ${
                  !canScrollLeft ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:scale-105 active:scale-95 cursor-pointer hover:border-[#006bb0]'
                }`}
                title="Desplazar secciones a la izquierda ◄"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Scrollable nav container */}
              <div 
                ref={tabsNavRef}
                onScroll={checkScrollButtons}
                className="overflow-x-auto scrollbar-none flex-1 py-2 scroll-smooth"
              >
                <nav className="flex items-center gap-1.5 min-w-max">
                  {NAV_ITEMS.map(nav => {
                    const Icon = nav.icon;
                    const isActive = activeView === nav.id;

                    return (
                      <button
                        key={nav.id}
                        onClick={() => setActiveView(nav.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#006bb0] text-white shadow-xs'
                            : 'text-slate-700 hover:text-sky-950 hover:bg-[#d8edfa]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{nav.label}</span>
                        {nav.count !== undefined && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                            isActive ? 'bg-white/20 text-white' : 'bg-[#d2e8f8] text-[#006bb0]'
                          }`}>
                            {nav.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Right scroll navigation arrow button */}
              <button
                type="button"
                onClick={() => scrollTabs('right')}
                disabled={!canScrollRight}
                className={`p-1.5 sm:p-2 rounded-xl border border-[#badbf5] bg-white text-[#006bb0] hover:bg-sky-50 shadow-2xs transition-all shrink-0 z-10 flex items-center justify-center ${
                  !canScrollRight ? 'opacity-30 cursor-not-allowed' : 'opacity-100 hover:scale-105 active:scale-95 cursor-pointer hover:border-[#006bb0]'
                }`}
                title="Desplazar secciones a la derecha ►"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

            </div>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex animate-in fade-in">
            <div className="bg-[#f4f9fd] w-72 max-w-[80vw] h-full shadow-2xl flex flex-col p-4 overflow-y-auto border-r border-[#c4e1f7]">
              
              <div className="flex items-center justify-between pb-4 border-b border-[#c4e1f7]">
                <Logo />
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-[#e2f1fc]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-3 flex flex-col gap-1 flex-1">
                <span className="text-[10px] font-bold text-sky-900/60 uppercase tracking-wider px-2 py-1">
                  Vistas Principales
                </span>
                {NAV_ITEMS.map(nav => {
                  const Icon = nav.icon;
                  const isActive = activeView === nav.id;

                  return (
                    <button
                      key={nav.id}
                      onClick={() => {
                        setActiveView(nav.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#006bb0] text-white'
                          : 'text-slate-700 hover:bg-[#e2f1fc]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{nav.label}</span>
                      </div>
                      {nav.count !== undefined && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[#d6ecfa] text-[#006bb0]'
                        }`}>
                          {nav.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#badbf5] flex flex-col gap-2">
                {!isVentas && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleOpenScanner(undefined, 'salida');
                    }}
                    className="w-full py-2.5 px-3 bg-rose-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Registrar Salida</span>
                  </button>
                )}

                {!isVentas && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleOpenScanner(undefined, 'ingreso');
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>Registrar Entrada</span>
                  </button>
                )}

                <button
                  onClick={() => logout()}
                  className="w-full py-2 px-3 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-rose-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>

            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-3">
        
        {/* Offline & PWA Banner Alert (Displays automatically when offline or installable) */}
        <OfflineStatusBadge compact={false} />

        {/* Dynamic View Router */}
        {isPanolero ? (
          <PanoleroSimpleView
            onOpenScanner={handleOpenScanner}
            onOpenBarcode={handleOpenBarcode}
            onOpenDetail={handleOpenProductDetail}
          />
        ) : activeView === 'administracion' ? (
          currentUser.rol === 'administracion' ? (
            <GerenciaDashboard onOpenScanner={handleOpenScanner} />
          ) : (
            <div className="bg-[#f4f9fd] rounded-2xl p-8 sm:p-12 text-center border border-[#c4e1f7] shadow-sm max-w-md mx-auto my-8">
              <div className="w-14 h-14 rounded-2xl bg-[#d6ecfa] text-[#006bb0] flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-sky-950">Acceso Restringido a Administración</h2>
              <p className="text-xs text-slate-600 mt-1 mb-6 leading-relaxed">
                Ingresa con las credenciales de Administración para acceder a la valorización completa, auditoría de precios y reportes ejecutivos.
              </p>
              <button
                onClick={logout}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#006bb0] text-white font-bold text-xs rounded-xl shadow-md hover:bg-[#005590] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Ir al Home para Ingresar como Administración
              </button>
            </div>
          )
        ) : activeView === 'salidas' ? (
          <SalidasLogView onOpenScanner={handleOpenScanner} />
        ) : activeView === 'ingresos' ? (
          <IngresosLogView onOpenScanner={handleOpenScanner} />
        ) : (
          <InventoryTable
            category={activeView as ItemCategory | 'all'}
            onOpenScanner={handleOpenScanner}
            onOpenBarcode={handleOpenBarcode}
            onOpenDetail={handleOpenProductDetail}
          />
        )}

      </main>

      {/* Mobile Sticky Floating Quick Action Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[#f4f9fd]/95 backdrop-blur-md border-t border-[#c4e1f7] z-30 px-2.5 py-2 flex items-center justify-around gap-1.5 shadow-lg">
        {isPanolero ? (
          <>
            <button
              onClick={() => handleOpenScanner(undefined, 'salida')}
              className="flex-1 py-2.5 px-2 bg-rose-600 active:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Salida</span>
            </button>

            <button
              onClick={() => handleOpenScanner(undefined, 'ingreso')}
              className="flex-1 py-2.5 px-2 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Entrada</span>
            </button>

            <button
              onClick={() => logout()}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </>
        ) : (
          <>
            {!isVentas && (
              <button
                onClick={() => handleOpenScanner(undefined, 'salida')}
                className="flex-1 py-2 px-2 bg-rose-600 active:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Salida</span>
              </button>
            )}

            {!isVentas && (
              <button
                onClick={() => handleOpenScanner(undefined, 'ingreso')}
                className="flex-1 py-2 px-2 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>+ Entrada</span>
              </button>
            )}

            {!isVentas && (
              <button
                onClick={() => setActiveView('salidas')}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  activeView === 'salidas' ? 'bg-[#006bb0] text-white' : 'text-slate-700 hover:bg-[#e2f1fc]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Historial</span>
              </button>
            )}

            {isAdministracion ? (
              <button
                onClick={() => setActiveView('administracion')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  activeView === 'administracion' ? 'bg-[#006bb0] text-white' : 'text-slate-700 hover:bg-[#e2f1fc]'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-sky-200" />
                <span>Administración</span>
              </button>
            ) : (
              <button
                onClick={() => logout()}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Salir</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Modals Container */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        initialCode={scannerInitialCode}
        defaultMode={scannerDefaultMode}
      />

      <BarcodeGeneratorModal
        isOpen={isBarcodeOpen}
        onClose={() => {
          setIsBarcodeOpen(false);
          setBarcodeItem(null);
        }}
        item={barcodeItem}
      />

      <ProductDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailItem(null);
        }}
        item={selectedDetailItem}
        onNavigateToCategory={(cat) => {
          setActiveView(cat);
        }}
        onOpenScanner={!isVentas ? (code, mode) => {
          handleOpenScanner(code, mode);
        } : undefined}
        onOpenBarcode={handleOpenBarcode}
      />

    </div>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <MainApp />
    </InventoryProvider>
  );
}
