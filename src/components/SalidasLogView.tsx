import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Search, 
  Download, 
  FileDown,
  Scan, 
  Building2, 
  User, 
  FileText, 
  Calendar, 
  Filter,
  CheckCircle2,
  Layers,
  ListFilter,
  ShieldCheck,
  Package,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
  Sparkles,
  X
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { SalidaRecord, SalidaGroupRecord, SalidaItemEntry } from '../types';
import { SalidaReceiptModal } from './SalidaReceiptModal';
import { generateSalidaPDF } from '../utils/pdfGenerator';

interface SalidasLogViewProps {
  onOpenScanner: (code?: string) => void;
}

export const SalidasLogView: React.FC<SalidasLogViewProps> = ({ onOpenScanner }) => {
  const { 
    salidas, 
    salidaGroups, 
    items,
    exportCategoryToExcel, 
    currentUser,
    deleteSalidaGroup,
    deleteSalida,
    cleanDuplicateSalidas
  } = useInventory();
  const isVentas = currentUser?.rol === 'ventas';
  const isGerencia = currentUser?.rol === 'gerencia';
  const showPrices = isGerencia;
  
  const [viewMode, setViewMode] = useState<'groups' | 'items'>('groups');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedRetira, setSelectedRetira] = useState<string>('all');
  const [selectedRemitoType, setSelectedRemitoType] = useState<'all' | 'interno' | 'cliente'>('all');
  
  // Selected group for receipt view
  const [activeReceiptGroup, setActiveReceiptGroup] = useState<SalidaGroupRecord | null>(null);

  // Helper to ensure each product is displayed strictly once per group
  const getConsolidatedGroupItems = (items: SalidaItemEntry[]): SalidaItemEntry[] => {
    const map = new Map<string, SalidaItemEntry>();
    for (const it of items || []) {
      const k = (it.codigo || '').trim().toLowerCase();
      if (!k) continue;
      if (map.has(k)) {
        const exist = map.get(k)!;
        exist.cantidad += it.cantidad;
        exist.precioTotal = exist.cantidad * (exist.precioUnitario || 0);
      } else {
        map.set(k, { ...it });
      }
    }
    return Array.from(map.values());
  };

  // Group or record pending deletion
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<string | null>(null);
  const [pendingDeleteSalidaId, setPendingDeleteSalidaId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleCleanDuplicates = () => {
    const res = cleanDuplicateSalidas();
    showToast(res.message, res.removedGroups > 0 || res.removedSalidas > 0 ? 'success' : 'info');
  };

  const handleConfirmDeleteGroup = (groupId: string) => {
    const res = deleteSalidaGroup(groupId, true);
    setPendingDeleteGroupId(null);
    if (res.success) {
      showToast(`${res.message} (Stock reincorporado al pañol)`, 'success');
    }
  };

  const handleConfirmDeleteSalida = (salidaId: string) => {
    const res = deleteSalida(salidaId, true);
    setPendingDeleteSalidaId(null);
    if (res.success) {
      showToast(`${res.message} (Stock reincorporado al pañol)`, 'success');
    }
  };

  // Extract unique clients and operators
  const uniqueClients = Array.from(new Set([
    ...salidaGroups.map(g => g.cliente),
    ...salidas.map(s => s.cliente)
  ].filter(Boolean))).sort();

  const uniqueOperators = Array.from(new Set([
    ...salidaGroups.map(g => g.retira),
    ...salidas.map(s => s.retira)
  ].filter(Boolean))).sort();

  // Filter groups
  const filteredGroups = salidaGroups.filter(g => {
    if (selectedClient !== 'all' && g.cliente !== selectedClient) return false;
    if (selectedRetira !== 'all' && g.retira !== selectedRetira) return false;
    if (selectedRemitoType === 'interno' && !g.esRemitoInterno) return false;
    if (selectedRemitoType === 'cliente' && g.esRemitoInterno) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const qAlphaNum = q.replace(/[^a-zA-Z0-9]/g, '');
      // Find codes that match this barcode in inventory
      const matchingInventoryCodes = new Set(
        items.filter(i => {
          const b = (i.codigoBarras || '').toLowerCase();
          const bAlpha = (i.codigoBarras || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return b.includes(q) || (qAlphaNum !== '' && bAlpha.includes(qAlphaNum));
        }).map(i => i.codigo.toLowerCase())
      );

      const matchNum = g.numeroSalidaFormatted.toLowerCase().includes(q) || String(g.numeroSalida).includes(q);
      const matchClient = g.cliente.toLowerCase().includes(q);
      const matchRetira = g.retira.toLowerCase().includes(q);
      const matchRemito = g.nroRemito.toLowerCase().includes(q);
      const matchItem = g.items.some(it => 
        it.codigo.toLowerCase().includes(q) || 
        it.descripcion.toLowerCase().includes(q) ||
        matchingInventoryCodes.has(it.codigo.toLowerCase())
      );
      return matchNum || matchClient || matchRetira || matchRemito || matchItem;
    }
    return true;
  });

  // Filter individual items
  const filteredSalidas = salidas.filter(s => {
    if (selectedClient !== 'all' && s.cliente !== selectedClient) return false;
    if (selectedRetira !== 'all' && s.retira !== selectedRetira) return false;
    if (selectedRemitoType === 'interno' && !s.esRemitoInterno && !s.esTaller) return false;
    if (selectedRemitoType === 'cliente' && (s.esRemitoInterno || s.esTaller)) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const qAlphaNum = q.replace(/[^a-zA-Z0-9]/g, '');
      const matchingInventoryCodes = new Set(
        items.filter(i => {
          const b = (i.codigoBarras || '').toLowerCase();
          const bAlpha = (i.codigoBarras || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return b.includes(q) || (qAlphaNum !== '' && bAlpha.includes(qAlphaNum));
        }).map(i => i.codigo.toLowerCase())
      );

      return (
        s.codigo.toLowerCase().includes(q) ||
        matchingInventoryCodes.has(s.codigo.toLowerCase()) ||
        s.descripcion.toLowerCase().includes(q) ||
        s.nroRemito.toLowerCase().includes(q) ||
        s.cliente.toLowerCase().includes(q) ||
        s.retira.toLowerCase().includes(q) ||
        (s.numeroSalidaFormatted && s.numeroSalidaFormatted.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalUnidadesRetiradas = viewMode === 'groups'
    ? filteredGroups.reduce((sum, g) => sum + g.totalUnidades, 0)
    : filteredSalidas.reduce((sum, s) => sum + s.cantidad, 0);

  const totalValorRetirado = viewMode === 'groups'
    ? filteredGroups.reduce((sum, g) => sum + g.totalValor, 0)
    : filteredSalidas.reduce((sum, s) => sum + (s.cantidad * (s.precioUnitario || 0)), 0);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#f4f9fd] rounded-2xl p-5 border border-[#c4e1f7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-sky-950 tracking-tight">
                Registro de Salidas y Despachos
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#d6ecfa] p-1 rounded-xl text-xs font-bold border border-[#badbf5]">
            <button
              onClick={() => setViewMode('groups')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'groups'
                  ? 'bg-[#006bb0] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Grupos (Salida N°)</span>
            </button>
            <button
              onClick={() => setViewMode('items')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'items'
                  ? 'bg-[#006bb0] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Por Ítem Individual</span>
            </button>
          </div>

          {!isVentas && (
            <button
              type="button"
              onClick={handleCleanDuplicates}
              className="px-3.5 py-2 border border-[#badbf5] bg-white hover:bg-[#eaf4fb] text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Detectar y eliminar automáticamente salidas o registros duplicados"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#006bb0]" />
              <span>Borrar Duplicados</span>
            </button>
          )}

          <button
            onClick={() => onOpenScanner()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            {isVentas ? 'Consultar Stock' : 'Nueva Salida'}
          </button>
          
          <button
            onClick={() => exportCategoryToExcel('salidas')}
            className="px-3.5 py-2 border border-[#b8ddf5] bg-white hover:bg-[#eaf4fb] text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#006bb0]" />
            Exportar (.xlsx)
          </button>
        </div>
      </div>

      {/* Filter and Stats Bar */}
      <div className="bg-[#f4f9fd] rounded-xl p-4 border border-[#c4e1f7] shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        
        {/* Search */}
        <div className="relative">
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Buscar Despacho / Código</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Salida N°, código, código de barras, cliente..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
            />
            <Search className="w-3.5 h-3.5 text-sky-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Remito Type Filter */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Tipo de Remito</label>
          <select
            value={selectedRemitoType}
            onChange={e => setSelectedRemitoType(e.target.value as any)}
            className="w-full text-xs font-medium py-2 px-2.5 rounded-xl border border-[#b8ddf5] bg-white text-slate-800"
          >
            <option value="all">Todos los tipos</option>
            <option value="interno">🏢 Remito Interno (Taller)</option>
            <option value="cliente">🚛 Remito Cliente (Externo)</option>
          </select>
        </div>

        {/* Retira Filter */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Empleado que Retiró</label>
          <select
            value={selectedRetira}
            onChange={e => setSelectedRetira(e.target.value)}
            className="w-full text-xs font-medium py-2 px-2.5 rounded-xl border border-[#b8ddf5] bg-white text-slate-800"
          >
            <option value="all">Todos los empleados ({uniqueOperators.length})</option>
            {uniqueOperators.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        {/* Client Filter */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Cliente / Destino</label>
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="w-full text-xs font-medium py-2 px-2.5 rounded-xl border border-[#b8ddf5] bg-white text-slate-800"
          >
            <option value="all">Todos los destinos ({uniqueClients.length})</option>
            {uniqueClients.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Summary Stat */}
        <div className="bg-[#eaf4fb] p-2.5 rounded-xl border border-[#badbf5] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">
              {viewMode === 'groups' ? 'Grupos / Despachos' : 'Líneas Despachadas'}
            </span>
            <span className="font-mono text-xs font-black text-sky-950">
              {viewMode === 'groups' ? `${filteredGroups.length} Salidas` : `${filteredSalidas.length} Registros`}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Retirado</span>
            <span className="font-mono text-xs font-black text-rose-600">
              {totalUnidadesRetiradas} u.
            </span>
          </div>
        </div>

      </div>

      {/* Main Content Area: Group View vs Individual Items View */}
      {viewMode === 'groups' ? (
        
        /* Groups View (Salida N° 1, 2, 3...) */
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="bg-[#f4f9fd] rounded-2xl border border-[#c4e1f7] p-12 text-center text-slate-400">
              <Layers className="w-12 h-12 mx-auto mb-2 text-[#a8d3f4]" />
              <p className="text-sm font-bold text-slate-700">No se encontraron grupos de salida coincidentes</p>
              <p className="text-xs text-slate-500 mt-1">Ajusta los filtros o realiza un nuevo despacho con el escáner.</p>
            </div>
          ) : (
            filteredGroups.map(group => (
              <div 
                key={group.id}
                className="bg-[#f8fcfe] rounded-2xl border border-[#c4e1f7] shadow-xs hover:shadow transition-all overflow-hidden"
              >
                {/* Group Card Header */}
                <div className="bg-[#eef6fc] p-4 border-b border-[#c4e1f7] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-base font-black text-[#006bb0] bg-white px-3 py-1 rounded-xl border border-[#badbf5] shadow-2xs">
                      {group.numeroSalidaFormatted}
                    </span>

                    {group.esRemitoInterno ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                        Remito Interno (Taller)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#d6ecfa] text-[#006bb0] border border-[#badbf5]">
                        <Building2 className="w-3.5 h-3.5 text-[#006bb0]" />
                        Remito Cliente (Externo)
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                      <span>{group.fechaSalida}</span>
                      <Clock className="w-3.5 h-3.5 text-sky-600 ml-1" />
                      <span>{group.horaSalida} hs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right mr-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Nº Remito</span>
                      <span className="font-mono text-xs font-black text-sky-950">{group.nroRemito}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveReceiptGroup(group)}
                      className="px-3.5 py-1.5 bg-[#006bb0] hover:bg-[#005590] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver Comprobante
                    </button>

                    <button
                      type="button"
                      onClick={() => generateSalidaPDF(group)}
                      className="px-3 py-1.5 bg-white hover:bg-sky-50 text-[#006bb0] border border-[#badbf5] hover:border-[#006bb0] text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      title="Descargar resumen de esta salida en PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    {/* Delete / Duplicate Remover Button */}
                    {!isVentas && (
                      pendingDeleteGroupId === group.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 rounded-xl p-1 animate-in fade-in">
                          <button
                            type="button"
                            onClick={() => handleConfirmDeleteGroup(group.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs"
                            title="Confirmar eliminación y devolver piezas al inventario"
                          >
                            Confirmar Borrado
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteGroupId(null)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteGroupId(group.id)}
                          className="p-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl border border-[#badbf5] hover:border-rose-300 transition-all cursor-pointer"
                          title="Borrar esta salida / duplicado del historial"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Group Metadata Bar */}
                <div className="px-4 py-3 bg-[#f4f9fd] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-b border-[#cce4f8]">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Empleado que Retiró</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-5 h-5 rounded-full bg-[#d6ecfa] text-[#006bb0] flex items-center justify-center font-bold text-[10px] border border-[#badbf5]">
                        <User className="w-3 h-3" />
                      </div>
                      <strong className="text-sky-950">{group.retira}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Cliente / Destino</span>
                    <strong className="text-slate-800 truncate block mt-0.5">{group.cliente}</strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Pañolero Emisor</span>
                    <span className="text-slate-600 mt-0.5 block">{group.usuarioRegistro}</span>
                  </div>
                </div>

                {/* Group Items Table */}
                <div className="p-4 overflow-x-auto bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="text-[10px] font-bold text-sky-950 uppercase tracking-wider bg-[#eaf4fb]">
                      <tr>
                        <th className="py-2 px-3">Código</th>
                        <th className="py-2 px-3">Descripción de la Pieza</th>
                        <th className="py-2 px-2 text-center">Ubic.</th>
                        <th className="py-2 px-3 text-center">Cant. Retirada</th>
                        {showPrices && <th className="py-2 px-3 text-right">P. Unitario</th>}
                        {showPrices && <th className="py-2 px-3 text-right">Subtotal</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2effa]">
                      {getConsolidatedGroupItems(group.items).map(item => (
                        <tr key={`${group.id}-${item.codigo}`} className="hover:bg-[#eef6fc] transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-[#006bb0] whitespace-nowrap">
                            {item.codigo}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <span className="font-semibold text-slate-800">{item.descripcion}</span>
                            {item.proveedor && (
                              <span className="text-[10px] text-[#006bb0] font-bold uppercase ml-2 bg-[#e8f4fc] px-1.5 py-0.5 rounded">({item.proveedor})</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-700">
                            <span className="px-1.5 py-0.2 rounded bg-[#e8f4fc] text-sky-950 text-[10px] border border-[#c4e1f7]">
                              {item.ubicacion || 'A'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-black text-rose-600">
                            -{item.cantidad} u.
                          </td>
                          {showPrices && (
                            <td className="py-2 px-3 text-right font-mono text-slate-700 font-semibold">
                              ${item.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          )}
                          {showPrices && (
                            <td className="py-2 px-3 text-right font-mono font-bold text-sky-950">
                              ${item.precioTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-[#badbf5] font-bold bg-[#eaf4fb]">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[10px] text-slate-600">
                          Total de la Salida:
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900">
                          {group.totalUnidades} u.
                        </td>
                        {showPrices && <td className="py-2.5 px-3"></td>}
                        {showPrices && (
                          <td className="py-2.5 px-3 text-right font-mono text-sm font-black text-[#006bb0]">
                            ${group.totalValor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>

              </div>
            ))
          )}
        </div>

      ) : (

        /* Individual Items Table View */
        <div className="bg-[#f8fcfe] rounded-2xl border border-[#c4e1f7] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse divide-y divide-[#cce4f8]">
              <thead className="bg-[#dbeefa] text-sky-950 font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">GRUPO / SALIDA</th>
                  <th className="px-4 py-3 whitespace-nowrap">Nº PRESP./REMITO</th>
                  <th className="px-4 py-3 whitespace-nowrap">CÓDIGO</th>
                  <th className="px-4 py-3 min-w-[180px]">DESCRIPCIÓN</th>
                  <th className="px-4 py-3 whitespace-nowrap">FECHA</th>
                  <th className="px-4 py-3 whitespace-nowrap">CLIENTE / DESTINO</th>
                  <th className="px-4 py-3 whitespace-nowrap">RETIRA</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">CANTIDAD</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">TIPO</th>
                  {!isVentas && <th className="px-4 py-3 text-center whitespace-nowrap">ACCIONES</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2effa] bg-white">
                {filteredSalidas.length > 0 ? (
                  filteredSalidas.map((salida, idx) => (
                    <tr key={salida.id} className={`hover:bg-[#e5f3fd] transition-colors ${idx % 2 === 1 ? 'bg-[#f4f9fd]' : 'bg-white'}`}>
                      
                      {/* Salida N° */}
                      <td className="px-4 py-3 font-mono font-black text-[#006bb0] whitespace-nowrap">
                        {salida.numeroSalidaFormatted || 'Salida Reg.'}
                      </td>

                      {/* Nº Remito */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-[#e8f4fc] text-sky-950 border border-[#c4e1f7]">
                          {salida.nroRemito}
                        </span>
                      </td>

                      {/* Código */}
                      <td className="px-4 py-3 font-mono font-bold text-[#006bb0] whitespace-nowrap">
                        {salida.codigo}
                      </td>

                      {/* Descripción */}
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {salida.descripcion}
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                        {salida.fechaSalida}
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {salida.cliente}
                        </span>
                      </td>

                      {/* Retira */}
                      <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-[#e8f4fc] text-[#006bb0] font-semibold text-[11px] border border-[#badbf5]">
                          {salida.retira}
                        </span>
                      </td>

                      {/* Cantidad */}
                      <td className="px-4 py-3 text-right font-mono font-black text-rose-600 whitespace-nowrap">
                        -{salida.cantidad} u.
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {salida.esRemitoInterno || salida.esTaller ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Interno
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#d6ecfa] text-[#006bb0] border border-[#badbf5]">
                            Cliente
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {!isVentas && (
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {pendingDeleteSalidaId === salida.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDeleteSalida(salida.id)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteSalidaId(null)}
                                className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteSalidaId(salida.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Borrar este registro individual de salida"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-400">
                      No se encontraron registros de salidas coincidentes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salida Receipt Modal */}
      <SalidaReceiptModal
        isOpen={!!activeReceiptGroup}
        salidaGroup={activeReceiptGroup}
        onClose={() => setActiveReceiptGroup(null)}
        onDeleted={() => {
          showToast('Comprobante de salida eliminado y stock restituido.', 'success');
        }}
      />

    </div>
  );
};
