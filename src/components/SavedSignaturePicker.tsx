import React from 'react';
import { X, PenLine, Trash2, CheckCircle2 } from 'lucide-react';
import { SavedSignature } from '../types';

interface SavedSignaturePickerProps {
  ownerName: string;
  savedSignatures: SavedSignature[];
  accentColor?: string;
  onPick: (dataUrl: string, nombre: string) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const SavedSignaturePicker: React.FC<SavedSignaturePickerProps> = ({
  ownerName,
  savedSignatures,
  accentColor = '#006bb0',
  onPick,
  onCreateNew,
  onDelete,
  onClose,
}) => {
  const signatures = savedSignatures.filter(s => s.nombre === ownerName);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        {/* Header */}
        <div className="text-white p-5 flex items-center justify-between" style={{ backgroundColor: accentColor }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Firmas guardadas</h3>
              <p className="text-xs text-white/80 font-medium">{ownerName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 bg-slate-50 flex-1 overflow-y-auto">
          {signatures.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-8">
              No hay firmas guardadas para este usuario.
            </p>
          )}

          {signatures.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {signatures.map(sig => (
                <div
                  key={sig.id}
                  className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col items-center gap-2"
                >
                  <img
                    src={sig.dataUrl}
                    alt={`Firma de ${sig.nombre}`}
                    className="h-16 max-w-[220px] object-contain bg-slate-50 rounded-lg border border-slate-100 p-2"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">{sig.fechaCreacion}</span>
                  <div className="flex items-center gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => onPick(sig.dataUrl, sig.nombre)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
                      style={{ backgroundColor: accentColor }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Usar esta firma</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('¿Eliminar esta firma guardada?')) onDelete(sig.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Draw new signature */}
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all cursor-pointer"
          >
            <PenLine className="w-5 h-5 text-slate-500" />
            <span>Dibujar nueva firma con tableta gráfica</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
