import React, { useState } from 'react';
import { 
  ArrowDownLeft, 
  Search, 
  Download, 
  Plus, 
  Building2, 
  FileText, 
  Check, 
  X,
  PackagePlus,
  Calendar,
  Scan,
  Barcode
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { ItemCategory } from '../types';

interface IngresosLogViewProps {
  onOpenScanner?: (code?: string, mode?: 'salida' | 'ingreso') => void;
}

export const IngresosLogView: React.FC<IngresosLogViewProps> = ({ onOpenScanner }) => {
  const { ingresos, registerIngreso, exportCategoryToExcel } = useInventory();
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState<boolean>(false);

  // Reception form state
  const [codigo, setCodigo] = useState<string>('');
  const [proveedor, setProveedor] = useState<string>('SULLAIR');
  const [descripcion, setDescripcion] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [factura, setFactura] = useState<string>('');
  const [ubicacion, setUbicacion] = useState<string>('A');
  const [categoria, setCategoria] = useState<ItemCategory>('panol');
  const [precioUnitario, setPrecioUnitario] = useState<number>(0);

  const uniqueSuppliers = Array.from(new Set(ingresos.map(i => i.proveedor).filter(Boolean))).sort();

  const filteredIngresos = ingresos.filter(i => {
    if (selectedSupplier !== 'all' && i.proveedor !== selectedSupplier) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        i.codigo.toLowerCase().includes(q) ||
        i.descripcion.toLowerCase().includes(q) ||
        i.factura.toLowerCase().includes(q) ||
        i.proveedor.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalUnidadesIngresadas = filteredIngresos.reduce((sum, i) => sum + i.cantidad, 0);

  const handleSubmitIngreso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || cantidad <= 0) return;

    registerIngreso({
      codigo: codigo.trim(),
      proveedor: proveedor.trim() || 'SULLAIR',
      descripcion: descripcion.trim() || 'Producto Ingresado',
      cantidad,
      factura: factura.trim() || 'S/F',
      ubicacion: ubicacion.trim() || 'A',
      categoria,
      precioUnitario: precioUnitario || undefined
    });

    setIsReceivingModalOpen(false);
    setCodigo('');
    setDescripcion('');
    setFactura('');
    setCantidad(1);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-[#f4f9fd] rounded-2xl p-5 border border-[#c4e1f7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-sky-950 tracking-tight">
                Recepción de Mercadería e Ingresos
              </h1>
              <p className="text-xs text-slate-600">
                Historial de remesas, números de factura de proveedores y altas automáticas de stock
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenScanner && (
            <button
              onClick={() => onOpenScanner(undefined, 'ingreso')}
              className="px-4 py-2 bg-[#0080D0] hover:bg-[#0070b8] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Scan className="w-4 h-4" />
              Escanear para Sumar Stock
            </button>
          )}
          
          <button
            onClick={() => setIsReceivingModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            Registrar Manualmente
          </button>
          
          <button
            onClick={() => exportCategoryToExcel('ingresos')}
            className="px-3.5 py-2 border border-[#b8ddf5] bg-white hover:bg-[#eaf4fb] text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#006bb0]" />
            Exportar Ingresos (.xlsx)
          </button>
        </div>
      </div>

      {/* Filter and Stats Bar */}
      <div className="bg-[#f4f9fd] rounded-xl p-4 border border-[#c4e1f7] shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        {/* Search */}
        <div className="relative">
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Buscar Ingreso</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Factura, código o detalle..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
            />
            <Search className="w-3.5 h-3.5 text-sky-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Supplier Filter */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Proveedor / Marca</label>
          <select
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
            className="w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border border-[#b8ddf5] bg-white text-slate-800"
          >
            <option value="all">Todos los proveedores ({uniqueSuppliers.length})</option>
            {uniqueSuppliers.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Summary Stat */}
        <div className="flex items-center justify-between sm:justify-end gap-3 bg-[#eaf4fb] p-2.5 rounded-lg border border-[#badbf5]">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Ingresado</span>
            <span className="font-mono text-sm font-black text-sky-950">
              {totalUnidadesIngresadas} u. <span className="text-[11px] font-medium text-slate-600">({filteredIngresos.length} recepciones)</span>
            </span>
          </div>
        </div>

      </div>

      {/* Ingresos Log Table */}
      <div className="bg-[#f8fcfe] rounded-2xl border border-[#c4e1f7] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse divide-y divide-[#cce4f8]">
            <thead className="bg-[#dbeefa] text-sky-950 font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Nº FACTURA / REMITO</th>
                <th className="px-4 py-3 whitespace-nowrap">CÓDIGO</th>
                <th className="px-4 py-3 whitespace-nowrap">PROVEEDOR</th>
                <th className="px-4 py-3 min-w-[180px]">DESCRIPCIÓN</th>
                <th className="px-4 py-3 whitespace-nowrap">FECHA INGRESO</th>
                <th className="px-4 py-3 whitespace-nowrap">UBICACIÓN</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">CANTIDAD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2effa] bg-white">
              {filteredIngresos.length > 0 ? (
                filteredIngresos.map((ingreso, idx) => (
                  <tr key={ingreso.id} className={`hover:bg-[#e5f3fd] transition-colors ${idx % 2 === 1 ? 'bg-[#f4f9fd]' : 'bg-white'}`}>
                    
                    {/* Factura */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-[#e8f4fc] text-sky-950 border border-[#c4e1f7]">
                        {ingreso.factura}
                      </span>
                    </td>

                    {/* Código */}
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {ingreso.codigo}
                    </td>

                    {/* Proveedor */}
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {ingreso.proveedor}
                      </span>
                    </td>

                    {/* Descripción */}
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {ingreso.descripcion}
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {ingreso.fechaIngreso}
                    </td>

                    {/* Ubicación */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-[#e8f4fc] text-sky-950 border border-[#c4e1f7]">
                        {ingreso.ubicacion || 'A'}
                      </span>
                    </td>

                    {/* Cantidad */}
                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 whitespace-nowrap">
                      +{ingreso.cantidad} u.
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    No se encontraron registros de ingresos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Receiving New Stock */}
      {isReceivingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#c4e1f7] w-full max-w-lg overflow-hidden">
            
            <div className="bg-[#006bb0] p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-sky-200" />
                <h3 className="font-bold text-sm">Registrar Nuevo Ingreso de Stock</h3>
              </div>
              <button 
                onClick={() => setIsReceivingModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitIngreso} className="p-5 flex flex-col gap-3.5 bg-[#f8fcfe]">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Código del Producto *</label>
                  <input
                    type="text"
                    required
                    value={codigo}
                    onChange={e => setCodigo(e.target.value)}
                    placeholder="Ej: 250022-669..."
                    className="px-3 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white font-mono font-bold uppercase focus:ring-2 focus:ring-[#006bb0]"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Proveedor / Fabricante</label>
                  <input
                    type="text"
                    value={proveedor}
                    onChange={e => setProveedor(e.target.value)}
                    placeholder="Ej: SULLAIR, ECHANIZ..."
                    className="px-3 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white uppercase focus:ring-2 focus:ring-[#006bb0]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Descripción</label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Ej: ELEM FILTRO ACEITE p/S-ENERGY..."
                  className="px-3 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Nº de Factura o Remito *</label>
                  <input
                    type="text"
                    required
                    value={factura}
                    onChange={e => setFactura(e.target.value)}
                    placeholder="Ej: 0001-00438781..."
                    className="px-3 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white font-mono focus:ring-2 focus:ring-[#006bb0]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Cantidad Ingresada *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={cantidad}
                    onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="px-3 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white font-bold focus:ring-2 focus:ring-[#006bb0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Ubicación</label>
                  <input
                    type="text"
                    value={ubicacion}
                    onChange={e => setUbicacion(e.target.value.toUpperCase())}
                    placeholder="Ej: A, B, FLUIDOS..."
                    className="px-3 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white uppercase font-mono focus:ring-2 focus:ring-[#006bb0]"
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-xs font-bold text-slate-700">Menú / Sección</label>
                  <select
                    value={categoria}
                    onChange={e => setCategoria(e.target.value as ItemCategory)}
                    className="px-3 py-2 text-xs rounded-lg border border-[#b8ddf5] bg-white text-slate-800"
                  >
                    <option value="panol">Pañol General</option>
                    <option value="cajones_fluidos">Cajones / Fluidos</option>
                    <option value="submicronicos">Filtros Submicrónicos</option>
                    <option value="rodamientos">Rodamientos</option>
                    <option value="entrepiso">Entrepiso Pañol</option>
                    <option value="importado">Stock Importado</option>
                    <option value="repuestos_mv">Repuestos MV</option>
                    <option value="cajas">Cajas Estantes</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#c4e1f7] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceivingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 rounded-lg border border-[#badbf5] bg-white hover:bg-[#eaf4fb] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#006bb0] hover:bg-[#005590] rounded-lg shadow-xs cursor-pointer"
                >
                  Confirmar Ingreso a Pañol
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
