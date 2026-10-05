import React, { useState } from 'react';
import { ArrowDownUp, Check, Eye, History, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { DevolucionGroupRecord } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';
import { matchesUbicacion } from '../utils/locationSearch';
import { DevolucionReceiptModal } from './DevolucionReceiptModal';

export const DevolucionesLogView: React.FC = () => {
  const { devolucionGroups, deleteDevolucionGroup, currentUser } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeGroup, setActiveGroup] = useState<DevolucionGroupRecord | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const isVentas = currentUser?.rol === 'ventas';

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleConfirmDelete = (groupId: string, revertStock: boolean) => {
    const res = deleteDevolucionGroup(groupId, revertStock);
    setPendingDeleteId(null);
    if (res.success) {
      showToast(
        revertStock
          ? `${res.message} (Stock descontado del pañol)`
          : `${res.message} (Stock sin cambios)`,
        'success'
      );
    }
  };

  const filteredGroups = devolucionGroups
    .filter(group => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      return (
        group.numeroDevolucionFormatted.toLowerCase().includes(query) ||
        group.empleadoDevuelve.toLowerCase().includes(query) ||
        (group.motivo || '').toLowerCase().includes(query) ||
        group.items.some(item => item.codigo.toLowerCase().includes(query) || item.descripcion.toLowerCase().includes(query) || matchesUbicacion(item.ubicacion, query))
      );
    })
    .sort((a, b) => {
      const comparison = `${a.fechaDevolucion} ${a.horaDevolucion || ''}`.localeCompare(`${b.fechaDevolucion} ${b.horaDevolucion || ''}`);
      if (comparison !== 0) return sortOrder === 'desc' ? -comparison : comparison;
      return sortOrder === 'desc' ? b.numeroDevolucion - a.numeroDevolucion : a.numeroDevolucion - b.numeroDevolucion;
    });

  const totalUnidades = filteredGroups.reduce((sum, group) => sum + group.totalUnidades, 0);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {toastMessage && (
        <div className="fixed top-20 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-4 duration-200 max-w-xs">
          <Check className="w-5 h-5 text-emerald-400" />
          <span className="flex-1">{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-300 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-[#f4f9fd] rounded-2xl p-5 border border-[#c4e1f7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-sky-950 tracking-tight">Historial de Devoluciones</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSortOrder(order => order === 'desc' ? 'asc' : 'desc')}
          className="px-3.5 py-2 border border-[#b8ddf5] bg-white hover:bg-[#eaf4fb] text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          title="Alternar el orden del historial por fecha"
        >
          <ArrowDownUp className="w-3.5 h-3.5 text-[#006bb0]" />
          {sortOrder === 'desc' ? 'Más reciente primero' : 'Más antiguo primero'}
        </button>
      </div>

      <div className="bg-[#f4f9fd] rounded-xl p-4 border border-[#c4e1f7] shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="text-[11px] font-bold text-slate-600 block mb-1">Buscar devolución</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Nº devolución, código, empleado o motivo..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
            />
            <Search className="w-3.5 h-3.5 text-sky-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-amber-800 font-bold uppercase block">Devoluciones</span>
            <span className="font-mono text-xs font-black text-amber-950">{filteredGroups.length} registros</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-amber-800 font-bold uppercase block">Reintegrado</span>
            <span className="font-mono text-xs font-black text-amber-800">+{totalUnidades} u.</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-[#f4f9fd] rounded-2xl border border-[#c4e1f7] p-12 text-center text-slate-400">
            <History className="w-12 h-12 mx-auto mb-2 text-[#a8d3f4]" />
            <p className="text-sm font-bold text-slate-700">No se encontraron devoluciones.</p>
          </div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.id} className="bg-white rounded-2xl border border-[#c4e1f7] shadow-xs overflow-hidden">
              <div className="p-4 bg-amber-50/60 border-b border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-base font-black text-amber-800 bg-white px-3 py-1 rounded-xl border border-amber-200">
                    {group.numeroDevolucionFormatted}
                  </span>
                  <span className="text-xs font-medium text-slate-600">{formatDisplayDate(group.fechaDevolucion)} · {group.horaDevolucion} hs</span>
                  <span className="text-xs font-bold text-slate-700">Devuelve: {group.empleadoDevuelve}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveGroup(group)}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver comprobante
                  </button>
                  {!isVentas && (
                    pendingDeleteId === group.id ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-slate-500">¿Revertir el stock?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(group.id, true)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Anular la devolución y descontar el stock"
                          >
                            <Check className="w-3.5 h-3.5" /> Revertir stock
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(group.id, false)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            title="Borrar solo el historial y dejar el stock como está"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Solo borrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(group.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer"
                        title="Eliminar esta devolución del historial"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-3"><strong className="text-slate-700">Motivo:</strong> {group.motivo || 'Devolución a pañol'}</p>
                <div className="overflow-x-auto table-scrollbar">
                  <table className="w-full min-w-[520px] text-left text-xs border-collapse">
                    <thead className="bg-[#eaf4fb] text-sky-950 uppercase text-[10px]">
                      <tr><th className="p-2">Código</th><th className="p-2">Descripción</th><th className="p-2">Ubicación</th><th className="p-2 text-right">Cantidad</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2effa]">
                      {group.items.map((item, index) => (
                        <tr key={`${group.id}-${item.codigo}-${index}`}>
                          <td className="p-2 font-mono font-bold text-[#006bb0]">{item.codigo}</td>
                          <td className="p-2 text-slate-700">{item.descripcion}</td>
                          <td className="p-2 font-mono text-slate-600">{item.ubicacion || 'PAÑOL'}</td>
                          <td className="p-2 text-right font-mono font-black text-amber-700">+{item.cantidad} u.</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <DevolucionReceiptModal isOpen={!!activeGroup} devolucionGroup={activeGroup} onClose={() => setActiveGroup(null)} />
    </div>
  );
};
