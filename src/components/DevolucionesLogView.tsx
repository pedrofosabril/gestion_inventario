import React, { useState } from 'react';
import { ArrowDownUp, Eye, History, RotateCcw, Search } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { DevolucionGroupRecord } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';
import { DevolucionReceiptModal } from './DevolucionReceiptModal';

export const DevolucionesLogView: React.FC = () => {
  const { devolucionGroups } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeGroup, setActiveGroup] = useState<DevolucionGroupRecord | null>(null);

  const filteredGroups = devolucionGroups
    .filter(group => {
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      return (
        group.numeroDevolucionFormatted.toLowerCase().includes(query) ||
        group.empleadoDevuelve.toLowerCase().includes(query) ||
        (group.motivo || '').toLowerCase().includes(query) ||
        group.items.some(item => item.codigo.toLowerCase().includes(query) || item.descripcion.toLowerCase().includes(query))
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
      <div className="bg-[#f4f9fd] rounded-2xl p-5 border border-[#c4e1f7] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-sky-950 tracking-tight">Historial de Devoluciones</h1>
            <p className="text-xs text-slate-600">Material reintegrado al pañol por devoluciones de trabajo o taller.</p>
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
                <button
                  type="button"
                  onClick={() => setActiveGroup(group)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver comprobante
                </button>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-3"><strong className="text-slate-700">Motivo:</strong> {group.motivo || 'Devolución a pañol'}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
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
