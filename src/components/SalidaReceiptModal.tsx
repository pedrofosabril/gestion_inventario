import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle2, 
  Download, 
  FileDown,
  X, 
  User, 
  Building2, 
  FileText, 
  Calendar, 
  Clock, 
  Package, 
  MapPin,
  Tag,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Trash2,
  AlertTriangle,
  PenLine,
  Eraser,
  Check
} from 'lucide-react';
import { SalidaGroupRecord, SalidaItemEntry } from '../types';
import { useInventory } from '../context/InventoryContext';
import { generateSalidaPDF } from '../utils/pdfGenerator';

interface SalidaReceiptModalProps {
  salidaGroup: SalidaGroupRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onNewSalida?: () => void;
  onDeleted?: () => void;
}

export const SalidaReceiptModal: React.FC<SalidaReceiptModalProps> = ({
  salidaGroup,
  isOpen,
  onClose,
  onNewSalida,
  onDeleted
}) => {
  const { currentUser, deleteSalidaGroup, updateSalidaGroupSignature, salidaGroups } = useInventory();
  const isVentas = currentUser?.rol === 'ventas';
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Sync with live context state if signature updated
  const currentSalidaGroup = salidaGroup 
    ? (salidaGroups.find(g => g.id === salidaGroup.id) || salidaGroup)
    : null;

  // Setup canvas when signature modal opens
  useEffect(() => {
    if (isSigning && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      setHasDrawn(false);
    }
  }, [isSigning]);

  if (!isOpen || !currentSalidaGroup) return null;

  const handleDownloadPDF = () => {
    try {
      setIsDownloading(true);
      generateSalidaPDF(currentSalidaGroup);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    if (!currentSalidaGroup) return;
    deleteSalidaGroup(currentSalidaGroup.id, true);
    setConfirmDelete(false);
    onClose();
    if (onDeleted) onDeleted();
  };

  // Drawing event helpers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e && e.cancelable) e.preventDefault();
    isDrawingRef.current = true;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    setHasDrawn(true);
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    if ('touches' in e && e.cancelable) e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleEndDraw = () => {
    if (isDrawingRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.closePath();
      isDrawingRef.current = false;
    }
  };

  const handleClearSignature = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.beginPath();
    }
    setHasDrawn(false);
  };

  const handleSaveSignature = () => {
    if (!canvasRef.current || !hasDrawn) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    updateSalidaGroupSignature(currentSalidaGroup.id, dataUrl, currentSalidaGroup.retira);
    setIsSigning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      
      {/* Voucher Card */}
      <div 
        id="printable-salida-receipt"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#006bb0] to-[#0088dd] text-white p-4 sm:p-5 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">
                  Resumen de Salida Despachada
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono font-black text-xs">
                  {salidaGroup.numeroSalidaFormatted}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="px-3.5 py-2 rounded-xl bg-white text-[#006bb0] hover:bg-sky-50 text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              title="Descargar resumen en PDF"
            >
              <FileDown className="w-4 h-4 text-[#006bb0]" />
              <span>{isDownloading ? 'Generando PDF...' : 'Descargar PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Formal Document Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-slate-800 space-y-5 print:p-8 print:text-black">
          
          {/* Company & Document Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#c4e1f7] gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#006bb0] text-white flex items-center justify-center font-black text-sm shadow-xs">
                  V
                </div>
                <h1 className="text-xl font-black tracking-tight text-[#006bb0] uppercase">
                  Verdu y Cía. S.A.
                </h1>
              </div>
            </div>

            <div className="sm:text-right bg-[#f4f9fd] p-3 rounded-xl border border-[#c4e1f7] sm:min-w-[220px]">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                Comprobante de Despacho
              </div>
              <div className="text-xl font-black font-mono text-[#006bb0]">
                {salidaGroup.numeroSalidaFormatted}
              </div>
              <div className="text-xs font-bold text-slate-600 mt-0.5 flex items-center sm:justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>{salidaGroup.fechaSalida}</span>
                <span className="text-slate-300">•</span>
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>{salidaGroup.horaSalida} hs</span>
              </div>
            </div>
          </div>

          {/* Key Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Empleado que retiró */}
            <div className="p-3.5 rounded-xl bg-[#f8fcfe] border border-[#c4e1f7]">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Empleado que Retiró
              </span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-7 h-7 rounded-full bg-[#d6ecfa] text-[#006bb0] flex items-center justify-center font-bold text-xs shrink-0 border border-[#badbf5]">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-sm font-black text-sky-950 truncate">
                  {salidaGroup.retira}
                </span>
              </div>
            </div>

            {/* Remito Interno / Externo */}
            <div className="p-3.5 rounded-xl bg-[#f8fcfe] border border-[#c4e1f7]">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tipo de Remito
              </span>
              <div className="mt-1">
                {salidaGroup.esRemitoInterno ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    Remito Interno (Taller)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-[#d6ecfa] text-[#006bb0] border border-[#badbf5]">
                    <Building2 className="w-3.5 h-3.5 text-[#006bb0]" />
                    Remito Cliente (Externo)
                  </span>
                )}
              </div>
            </div>

            {/* Cliente / Destino */}
            <div className="p-3.5 rounded-xl bg-[#f8fcfe] border border-[#c4e1f7]">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Cliente / Destino / Obra
              </span>
              <div className="text-xs font-bold text-slate-800 mt-1 line-clamp-2">
                {salidaGroup.cliente}
              </div>
            </div>

            {/* Nº Remito / Referencia */}
            <div className="p-3.5 rounded-xl bg-[#f8fcfe] border border-[#c4e1f7]">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Nº Presupuesto / Remito
              </span>
              <div className="text-xs font-mono font-black text-slate-900 mt-1">
                {salidaGroup.nroRemito}
              </div>
            </div>

          </div>

          {/* Optional notes */}
          {salidaGroup.notas && (
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900">
              <strong>Observaciones:</strong> {salidaGroup.notas}
            </div>
          )}

          {/* Dispatched Products Table */}
          {(() => {
            const consolidatedItems: SalidaItemEntry[] = Array.from(
              (salidaGroup.items || []).reduce((map, item) => {
                const k = (item.codigo || '').trim().toLowerCase();
                if (!k) return map;
                if (map.has(k)) {
                  const existing = map.get(k)!;
                  existing.cantidad += item.cantidad;
                  existing.precioTotal += item.precioTotal;
                } else {
                  map.set(k, { ...item });
                }
                return map;
              }, new Map<string, SalidaItemEntry>()).values()
            );

            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-[#006bb0]" />
                    Detalle de Productos Despachados ({consolidatedItems.length} ítems)
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Total Unidades: <strong className="font-mono text-slate-900">{salidaGroup.totalUnidades} u.</strong>
                  </span>
                </div>

                <div className="border border-[#c4e1f7] rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#eaf4fb] text-sky-950 font-bold uppercase text-[10px] tracking-wider border-b border-[#badbf5]">
                      <tr>
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Descripción de la Pieza</th>
                        <th className="py-2.5 px-2 text-center">Ubic.</th>
                        <th className="py-2.5 px-3 text-center">Cant. Retirada</th>
                        <th className="py-2.5 px-3 text-center">Stock Restante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2effa] bg-white">
                      {consolidatedItems.map((item, idx) => (
                        <tr key={item.id || `${item.codigo}-${idx}`} className="hover:bg-[#f4f9fd] transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#006bb0] whitespace-nowrap">
                            {item.codigo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <div className="font-semibold text-slate-900">{item.descripcion}</div>
                            {item.proveedor && (
                              <span className="text-[10px] text-[#006bb0] font-bold uppercase bg-[#e8f4fc] px-1.5 py-0.5 rounded">{item.proveedor}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                            <span className="px-1.5 py-0.5 rounded bg-[#e8f4fc] text-sky-950 border border-[#c4e1f7] text-[10px]">
                              {item.ubicacion || 'A'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-900 border border-sky-200">
                              {item.cantidad} u.
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                            {item.stockRemanente} u.
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#eaf4fb] border-t-2 border-[#badbf5] font-bold">
                      <tr>
                        <td colSpan={3} className="py-3 px-3 text-right uppercase text-[11px] text-slate-600">
                          Total Despachado:
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-sm font-black text-sky-950">
                          {salidaGroup.totalUnidades} u.
                        </td>
                        <td className="py-3 px-3 text-center text-xs text-slate-500 font-medium">
                          ({consolidatedItems.length} ítems)
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Signatures Section for Physical/Print Verification */}
          <div className="pt-6 grid grid-cols-2 gap-8 border-t border-slate-200 text-center text-xs text-slate-500">
            <div className="flex flex-col items-center justify-end">
              <div className="w-48 border-b border-slate-400 mb-1.5"></div>
              <span className="font-bold text-slate-800">Firma Pañolero / Emisor</span>
            </div>

            <div className="flex flex-col items-center justify-end">
              {currentSalidaGroup.firmaDigital ? (
                <div className="flex flex-col items-center mb-1">
                  <img 
                    src={currentSalidaGroup.firmaDigital} 
                    alt="Firma digital" 
                    className="h-12 max-w-[180px] object-contain"
                  />
                  <div className="w-48 border-b border-slate-400 mb-1"></div>
                  {!isVentas && (
                    <button
                      type="button"
                      onClick={() => setIsSigning(true)}
                      className="print:hidden text-[10px] text-sky-600 hover:text-sky-800 underline font-semibold cursor-pointer mb-1"
                    >
                      Volver a firmar
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center mb-1.5">
                  <button
                    type="button"
                    onClick={() => setIsSigning(true)}
                    className="print:hidden mb-2 px-3.5 py-1.5 rounded-xl bg-[#006bb0] hover:bg-[#005590] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Habilitar firma digital para este comprobante"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    <span>Firmar</span>
                  </button>
                  <div className="w-48 border-b border-slate-400"></div>
                </div>
              )}
              <span className="font-bold text-slate-800">Firma Empleado que Retira</span>
              <span className="text-[11px] font-semibold text-slate-600 mt-0.5">{currentSalidaGroup.retira}</span>
            </div>
          </div>

        </div>

        {/* Modal Bottom Actions Footer (Screen Only) */}
        <div className="print:hidden bg-[#f4f9fd] border-t border-[#c4e1f7] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {!isVentas && (
              !confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Eliminar esta salida y reintegrar el stock al inventario"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Borrar / Anular Salida</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 rounded-xl p-1.5 text-xs animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 ml-1" />
                  <span className="text-rose-900 font-bold text-[11px] px-1">¿Borrar y devolver stock?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    Sí, Borrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 rounded-lg bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs border border-slate-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {!currentSalidaGroup.firmaDigital && (
              <button
                type="button"
                onClick={() => setIsSigning(true)}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                title="Firmar comprobante de salida digitalmente"
              >
                <PenLine className="w-4 h-4" />
                <span>Firmar</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="px-4 py-2.5 rounded-xl border border-[#badbf5] bg-white hover:bg-[#eaf4fb] text-[#006bb0] text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <FileDown className="w-4 h-4 text-[#006bb0]" />
              <span>{isDownloading ? 'Generando PDF...' : 'Descargar Resumen en PDF'}</span>
            </button>

            {onNewSalida && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewSalida();
                }}
                className="px-5 py-2.5 rounded-xl bg-[#006bb0] hover:bg-[#005590] text-white text-xs font-black shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nueva Salida de Pañol</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>

      {/* Interactive Digital Signature Modal Pad */}
      {isSigning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95">
            {/* Pad Header */}
            <div className="bg-[#006bb0] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <PenLine className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Firma Digital de Recepción</h3>
                  <p className="text-[11px] text-sky-100 font-medium">Receptor: <strong>{currentSalidaGroup.retira}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSigning(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas Area */}
            <div className="p-4 bg-slate-50 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-600 font-medium">
                  Dibuje la firma con el dedo, mouse o lápiz táctil:
                </span>
                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              </div>

              <div className="relative bg-white rounded-2xl border-2 border-dashed border-sky-300 shadow-inner overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleStartDraw}
                  onMouseMove={handleMoveDraw}
                  onMouseUp={handleEndDraw}
                  onMouseLeave={handleEndDraw}
                  onTouchStart={handleStartDraw}
                  onTouchMove={handleMoveDraw}
                  onTouchEnd={handleEndDraw}
                  className="w-full h-44 cursor-crosshair touch-none"
                />
                <div className="pointer-events-none absolute bottom-5 left-8 right-8 border-b border-slate-200 flex justify-end">
                  <span className="text-[9px] text-slate-300 font-mono pr-1 uppercase tracking-widest select-none">Línea de firma</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Esta firma digital quedará incorporada en el comprobante y en el reporte PDF descargable.
              </p>
            </div>

            {/* Pad Footer Actions */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSigning(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!hasDrawn}
                onClick={handleSaveSignature}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs ${
                  hasDrawn
                    ? 'bg-[#006bb0] hover:bg-[#005590] cursor-pointer active:scale-95'
                    : 'bg-slate-300 cursor-not-allowed text-slate-500'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirmar Firma</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
