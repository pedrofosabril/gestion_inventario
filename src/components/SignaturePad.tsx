import React, { useState, useRef, useEffect } from 'react';
import { PenLine, Eraser, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  height?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onCancel,
  title = 'Firma Digital',
  subtitle,
  accentColor = '#006bb0',
  height = 320,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    hasDrawnRef.current = false;
    setHasDrawn(false);
  }, []);

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const { x, y } = getCoords(e);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    hasDrawnRef.current = true;
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.closePath();
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.beginPath();
    }
    hasDrawnRef.current = false;
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col animate-in zoom-in-95">
      {/* Header */}
      <div className="text-white p-5 flex items-center justify-between" style={{ backgroundColor: accentColor }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <PenLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            {subtitle && (
              <p className="text-xs text-white/80 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas Area */}
      <div className="p-5 bg-slate-50 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-600 font-medium">
            Dibuje la firma con dedo, mouse o tableta gráfica:
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 font-bold cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>

        <div className="relative bg-white rounded-2xl border-2 border-dashed border-sky-300 shadow-inner overflow-hidden">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full cursor-crosshair touch-none"
            style={{ height: `${height}px` }}
          />
          <div className="pointer-events-none absolute bottom-6 left-10 right-10 border-b border-slate-200 flex justify-end">
            <span className="text-[9px] text-slate-300 font-mono pr-1 uppercase tracking-widest select-none">
              Línea de firma
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 mt-2 text-center">
          La firma quedará incorporada en el comprobante y en el PDF descargable.
        </p>
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!hasDrawn}
          onClick={handleSave}
          className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs ${
            hasDrawn
              ? 'hover:opacity-90 cursor-pointer active:scale-95'
              : 'bg-slate-300 cursor-not-allowed text-slate-500'
          }`}
          style={hasDrawn ? { backgroundColor: accentColor } : undefined}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Confirmar</span>
        </button>
      </div>
    </div>
  );
};
