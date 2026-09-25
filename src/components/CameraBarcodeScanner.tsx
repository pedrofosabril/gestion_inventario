import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Camera, CameraOff, Zap, ZapOff, AlertTriangle, RotateCcw } from 'lucide-react';

interface CameraBarcodeScannerProps {
  onDetected: (code: string) => void;
}

const RE_SCAN_COOLDOWN_MS = 2000;

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({ onDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<string>('');
  const lastDetectAtRef = useRef(0);

  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  };

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current as HTMLVideoElement,
        (result: any) => {
          if (!result) return;
          const text = String(result.getText() || '').trim();
          if (!text) return;
          const now = Date.now();
          const isCooldownOk = now - lastDetectAtRef.current > RE_SCAN_COOLDOWN_MS;
          const isSameBarcode = text === lastCodeRef.current;
          if (isSameBarcode && !isCooldownOk) return;

          lastCodeRef.current = text;
          lastDetectAtRef.current = now;
          onDetected(text);
        }
      );
      controlsRef.current = controls;
      setActive(true);

      // Detect torch support from the active video track
      try {
        const stream = videoRef.current?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks?.[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities() as any;
          if (caps && 'torch' in caps) setTorchSupported(true);
        }
      } catch {}
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verificá los permisos del navegador o usá la pistola / escaneo manual.');
      setActive(false);
    } finally {
      setStarting(false);
    }
  };

  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as any);
      setTorchOn(!torchOn);
    } catch {}
  };

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-[#c4e1f7] bg-slate-900 overflow-hidden shadow-sm animate-in zoom-in-95 flex flex-col">
      <div className="bg-slate-800 px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-sky-400" />
          Escáner de Cámara
        </span>
        <div className="flex items-center gap-1.5">
          {active && torchSupported && (
            <button
              type="button"
              onClick={toggleTorch}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={torchOn ? 'Apagar linterna' : 'Encender linterna'}
            >
              {torchOn ? <Zap className="w-3.5 h-3.5 text-amber-300" /> : <ZapOff className="w-3.5 h-3.5" />}
            </button>
          )}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {active ? 'Escaneando...' : 'Apagada'}
          </span>
        </div>
      </div>

      <div className="relative">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full aspect-[4/3] object-cover bg-black"
        />
        {!active && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
            <CameraOff className="w-6 h-6 text-slate-400" />
            <button
              type="button"
              onClick={start}
              disabled={starting}
              className="px-4 py-2 text-xs font-black text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              {starting ? 'Iniciando cámara...' : 'Iniciar cámara'}
            </button>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-rose-200 p-3 text-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            <p className="text-[11px] font-semibold leading-snug max-w-[260px]">{error}</p>
            <button
              type="button"
              onClick={() => { setError(null); start(); }}
              className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        )}
      </div>

      {active && (
        <div className="bg-slate-800 px-3 py-2 flex items-center justify-end">
          <button
            type="button"
            onClick={stop}
            className="px-3 py-1.5 text-[11px] font-black text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors cursor-pointer"
          >
            Detener cámara
          </button>
        </div>
      )}
    </div>
  );
};