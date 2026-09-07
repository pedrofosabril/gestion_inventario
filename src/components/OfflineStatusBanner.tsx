import React, { useState } from 'react';
import { Wifi, WifiOff, Download, CheckCircle2, Info, X } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export const OfflineStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isOnline, isInstallable, isInstalled, installApp } = usePWA();
  const [showInstallTip, setShowInstallTip] = useState<boolean>(false);

  if (compact) {
    if (isOnline && !isInstallable) return null;
    return (
      <div className="flex items-center gap-1.5">
        {!isOnline && (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
            title="Sin conexión a Internet. Todos los datos se guardan y operan localmente en el dispositivo."
          >
            <WifiOff className="w-3 h-3 text-amber-600" />
            <span>Offline</span>
          </span>
        )}

        {isInstallable && (
          <button
            onClick={installApp}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#006bb0] text-white hover:bg-[#005590] transition-all shadow-2xs cursor-pointer"
            title="Instalar aplicación en tu dispositivo / PC"
          >
            <Download className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Instalar App</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-400 text-amber-900 px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-amber-950 text-xs">Modo Offline Activo</p>
              <p className="text-[11px] text-amber-900/80 leading-snug">
                El sistema funciona al 100% sin internet. Todos los escaneos, salidas, entradas y cambios se guardan localmente en este equipo.
              </p>
            </div>
          </div>
        </div>
      )}

      {isInstallable && (
        <div className="bg-[#e2f1fc] border border-[#b8ddf5] text-sky-950 px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-[#006bb0] text-white flex items-center justify-center shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-[#005590]">Instalar App en este equipo</p>
              <p className="text-[11px] text-slate-600 truncate">
                Acceso directo de escritorio o pantalla de inicio sin barra de navegador.
              </p>
            </div>
          </div>
          <button
            onClick={installApp}
            className="px-3 py-1.5 bg-[#006bb0] hover:bg-[#005590] text-white font-bold rounded-xl text-xs shrink-0 ml-3 transition-colors cursor-pointer shadow-xs"
          >
            Instalar
          </button>
        </div>
      )}
    </div>
  );
};
