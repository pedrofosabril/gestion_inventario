import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle2, 
  Download, 
  FileDown,
  X, 
  User, 
  FileText, 
  Calendar, 
  Clock, 
  Package, 
  MapPin,
  RotateCcw,
  PenLine,
  Eraser,
  Check,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { DevolucionGroupRecord } from '../types';
import { useInventory } from '../context/InventoryContext';
import { generateDevolucionPDF } from '../utils/devolucionPdfGenerator';

interface DevolucionReceiptModalProps {
  devolucionGroup: DevolucionGroupRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onNewDevolucion?: () => void;
  onDeleted?: () => void;
}

export const DevolucionReceiptModal: React.FC<DevolucionReceiptModalProps> = ({
  devolucionGroup,
  isOpen,
  onClose,
  onNewDevolucion,
  onDeleted
}) => {
  const { currentUser, deleteDevolucionGroup, updateDevolucionGroupSignature, devolucionGroups } = useInventory();
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Keep synced with context
  const currentDevolucionGroup = devolucionGroup
    ? devolucionGroups.find(g => g.id === devolucionGroup.id) || devolucionGroup
    : null;

  useEffect(() => {
    if (!isOpen) {
      setIsSigning(false);
      setConfirmDelete(false);
    }
  }, [isOpen]);

  // Setup Canvas when signing mode opens
  useEffect(() => {
    if (isSigning && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
      }
    }
  }, [isSigning]);

  if (!isOpen || !currentDevolucionGroup) return null;

  const handleDownloadPDF = () => {
    try {
      setIsDownloading(true);
      generateDevolucionPDF(currentDevolucionGroup);
    } catch (err) {
      console.error('Error al generar PDF de devolución:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Canvas drawing handlers (mouse & touch)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentDevolucionGroup) return;
    const signatureDataUrl = canvas.toDataURL('image/png');
    updateDevolucionGroupSignature(
      currentDevolucionGroup.id,
      signatureDataUrl,
      currentDevolucionGroup.empleadoDevuelve
    );
    setIsSigning(false);
  };

  const handleDelete = () => {
    if (!currentDevolucionGroup) return;
    deleteDevolucionGroup(currentDevolucionGroup.id, true);
    setConfirmDelete(false);
    onDeleted?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div 
        className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-amber-200 overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <RotateCcw className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-200 border border-amber-400/30">
                  Devolución a Pañol
                </span>
                <span className="text-xs text-amber-100 font-medium">
                  {currentDevolucionGroup.fechaDevolucion} • {currentDevolucionGroup.horaDevolucion} hs
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
                {currentDevolucionGroup.numeroDevolucionFormatted}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer shadow-xs active:scale-95"
              title="Descargar Remito en PDF"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Generando...' : 'Descargar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-amber-50/70 border border-amber-100 p-3.5 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Empleado que devuelve</div>
                <div className="text-sm font-bold text-slate-800 truncate">{currentDevolucionGroup.empleadoDevuelve}</div>
                <div className="text-[11px] text-slate-500">Recibió: {currentDevolucionGroup.usuarioRegistro}</div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Motivo</div>
                <div className="text-sm font-bold text-slate-800 truncate">{currentDevolucionGroup.motivo || 'Devolución pañol'}</div>
                {currentDevolucionGroup.notas && (
                  <div className="text-[11px] text-slate-500 truncate">{currentDevolucionGroup.notas}</div>
                )}
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-100 p-3.5 rounded-2xl flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Material reintegrado</div>
                <div className="text-sm font-black text-amber-900">
                  {currentDevolucionGroup.totalUnidades} u. ({currentDevolucionGroup.items.length} ítems)
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold">Reingresado a Stock</div>
              </div>
            </div>
          </div>

          {/* Items List Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Artículos Devueltos</span>
              <span className="text-xs font-semibold text-slate-500">{currentDevolucionGroup.items.length} ítems en lote</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/60 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3">Ubicación</th>
                    <th className="py-2.5 px-3 text-right">Cantidad Devuelta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentDevolucionGroup.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-slate-900 font-mono">{item.codigo}</td>
                      <td className="py-2 px-3 text-slate-700 max-w-xs">{item.descripcion}</td>
                      <td className="py-2 px-3 text-slate-500">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.ubicacion || 'PAÑOL'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-amber-800 text-sm">
                        +{item.cantidad} u.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature / Firm Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-800">Firma del empleado que devuelve</div>
                <div className="text-[11px] text-slate-500">
                  {currentDevolucionGroup.empleadoDevuelve}
                </div>
              </div>

              {/* Digital signature display or button */}
              {currentDevolucionGroup.firmaDigital ? (
                <div className="flex flex-col items-center">
                  <img 
                    src={currentDevolucionGroup.firmaDigital} 
                    alt="Firma digital" 
                    className="h-12 max-w-[180px] object-contain"
                  />
                  <div className="w-48 border-b border-slate-400 mb-1"></div>
                  <button
                    type="button"
                    onClick={() => setIsSigning(true)}
                    className="text-[10px] text-amber-700 hover:text-amber-900 underline font-semibold cursor-pointer mb-1"
                  >
                    Volver a firmar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSigning(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5 text-amber-600" />
                  <span>Firmar digitalmente</span>
                </button>
              )}
            </div>

            {/* In-place Signature Canvas Drawer */}
            {isSigning && (
              <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">Dibujar firma abajo:</span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Limpiar</span>
                  </button>
                </div>

                <div className="border-2 border-dashed border-amber-300 bg-white rounded-xl overflow-hidden touch-none flex justify-center">
                  <canvas
                    ref={canvasRef}
                    width={360}
                    height={120}
                    className="cursor-crosshair w-full max-w-[360px] h-[120px] bg-white"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setIsSigning(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveSignature}
                    disabled={!hasDrawn}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar firma</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Delete Section */}
          {confirmDelete && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 text-rose-800 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>¿Deseas anular esta devolución? El stock de los productos devueltos se descontará del inventario.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Confirmar anulación
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {!confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Anular devolución</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <FileDown className="w-4 h-4" />
              <span>{isDownloading ? 'Generando...' : 'Descargar Remito PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
