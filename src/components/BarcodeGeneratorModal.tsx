import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { 
  Barcode, 
  Printer, 
  FileDown,
  X, 
  Check, 
  CheckCheck,
  Save,
  Scan, 
  Trash2, 
  AlertTriangle, 
  MapPin, 
  Sparkles,
  Info
} from 'lucide-react';
import { InventoryItem } from '../types';
import { useInventory } from '../context/InventoryContext';
import { isNiimbotSupported, printToNiimbot, NIIMBOT_B1_SIZES } from '../lib/niimbotPrinter';
import { isUsbNiimbotSupported, printToNiimbotUsb } from '../lib/niimbotSerial';

interface BarcodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

export const BarcodeGeneratorModal: React.FC<BarcodeGeneratorModalProps> = ({ 
  isOpen, 
  onClose, 
  item 
}) => {
  const { updateItem, items } = useInventory();
  
  const [scannedCodeInput, setScannedCodeInput] = useState<string>('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictItem, setConflictItem] = useState<InventoryItem | null>(null);
  const [niimbotPrinting, setNiimbotPrinting] = useState(false);
  const [niimbotProgress, setNiimbotProgress] = useState<string | null>(null);
  const [copiesCount, setCopiesCount] = useState(1);
  const [niimbotSize, setNiimbotSize] = useState(NIIMBOT_B1_SIZES[0]);
  const niimbotUsbAvailable = isUsbNiimbotSupported();
  const niimbotBtAvailable = isNiimbotSupported();
  const [niimbotViaUsb, setNiimbotViaUsb] = useState<boolean>(() => isUsbNiimbotSupported());

  const inputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Focus input automatically whenever modal opens or item changes
  useEffect(() => {
    if (isOpen && item) {
      setScannedCodeInput(item.codigoBarras || '');
      setSaveSuccessMessage(null);
      setErrorMessage(null);
      setConflictItem(null);
      
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, item]);

  // Render SVG barcode whenever item has a valid barcode
  useEffect(() => {
    if (isOpen && item && svgRef.current) {
      const codeToRender = item.codigoBarras?.trim();
      if (codeToRender) {
        try {
          JsBarcode(svgRef.current, codeToRender, {
            format: 'CODE128',
            width: 2,
            height: 65,
            displayValue: true,
            fontSize: 14,
            font: 'monospace',
            textMargin: 4,
            lineColor: '#0f172a'
          });
        } catch (err) {
          console.warn('JsBarcode render warning for:', codeToRender, err);
        }
      }
    }
  }, [isOpen, item, item?.codigoBarras]);

  if (!isOpen || !item) return null;

  const currentItem = items.find(i => i.id === item.id) || item;
  const hasLinkedBarcode = Boolean(currentItem.codigoBarras && currentItem.codigoBarras.trim() !== '');

  const cleanInput = scannedCodeInput.trim();
  const isCodeAlreadySaved = Boolean(
    currentItem.codigoBarras && 
    currentItem.codigoBarras.trim() !== '' && 
    currentItem.codigoBarras.trim().toLowerCase() === cleanInput.toLowerCase()
  );
  const hasDifferentCode = Boolean(
    cleanInput !== '' && 
    currentItem.codigoBarras && 
    currentItem.codigoBarras.trim().toLowerCase() !== cleanInput.toLowerCase()
  );
  const isNewCode = Boolean(cleanInput !== '' && (!currentItem.codigoBarras || currentItem.codigoBarras.trim() === ''));

  const playSuccessSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {}
  };

  const handleSaveBarcode = (codeToSave: string, forceOverride: boolean = false) => {
    const cleanCode = codeToSave.trim();
    if (!cleanCode) {
      setErrorMessage('Por favor ingresa o escanea un código de barras válido.');
      return;
    }

    // Check if code is already used by another item
    if (!forceOverride) {
      const existingUsingCode = items.find(
        i => i.id !== currentItem.id && (
          (i.codigoBarras && i.codigoBarras.toLowerCase() === cleanCode.toLowerCase()) ||
          (i.codigo && i.codigo.toLowerCase() === cleanCode.toLowerCase())
        )
      );

      if (existingUsingCode) {
        setConflictItem(existingUsingCode);
        return;
      }
    }

    // Update item
    updateItem(currentItem.id, { codigoBarras: cleanCode });
    playSuccessSound();
    setConflictItem(null);
    setErrorMessage(null);
    setSaveSuccessMessage(`¡Código "${cleanCode}" guardado y vinculado correctamente!`);

    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 4000);
  };

  const handleRemoveBarcode = () => {
    updateItem(currentItem.id, { codigoBarras: '' });
    setScannedCodeInput('');
    setSaveSuccessMessage('Código de barras desvinculado.');
    setErrorMessage(null);
    setConflictItem(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    setTimeout(() => {
      setSaveSuccessMessage(null);
    }, 3000);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveBarcode(scannedCodeInput);
    }
  };

  const handleDownloadBarcodePDF = () => {
    if (!currentItem || !currentItem.codigoBarras?.trim()) return;
    
    try {
      const code = currentItem.codigoBarras.trim();
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [90, 55] // Standard 90mm x 55mm industrial sticker label format
      });

      // Background fill
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 90, 55, 'F');

      // Top Header ribbon
      doc.setFillColor(0, 107, 176); // #006bb0
      doc.rect(0, 0, 90, 8.5, 'F');

      // Header Text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text('VERDU Y CÍA. S.A. - CONTROL DE PAÑOL', 45, 5.8, { align: 'center' });

      // Product Description
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const splitDesc = doc.splitTextToSize(currentItem.descripcion || '', 82);
      doc.text(splitDesc.slice(0, 2), 45, 13, { align: 'center' });

      // Barcode generation via off-screen canvas
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, code, {
        format: 'CODE128',
        width: 2.5,
        height: 60,
        displayValue: true,
        fontSize: 14,
        font: 'monospace',
        lineColor: '#000000',
        background: '#ffffff',
        textMargin: 4
      });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      doc.addImage(barcodeDataUrl, 'PNG', 8, 17.5, 74, 25);

      // Footer Information
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`CÓD: ${currentItem.codigo}`, 7, 48);
      doc.text(`UBIC: ${currentItem.ubicacion || 'PAÑOL'}`, 45, 48, { align: 'center' });
      doc.text(`PROV: ${currentItem.proveedor || '-'}`, 83, 48, { align: 'right' });

      // Outer border guide
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(1.5, 1.5, 87, 52);

      const safeCode = (currentItem.codigo || 'item').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Etiqueta_${safeCode}_${code}.pdf`;
      doc.save(filename);
      setSaveSuccessMessage(`Etiqueta PDF "${filename}" descargada correctamente.`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Error generating barcode PDF:', err);
      setErrorMessage('Ocurrió un error al generar el PDF de la etiqueta.');
    }
  };

  const handlePrint = () => {
    handleDownloadBarcodePDF();
  };

  const handlePrintToNiimbot = async () => {
    if (!currentItem || !currentItem.codigoBarras?.trim()) return;
    if (niimbotPrinting) return;

    if (niimbotViaUsb && !niimbotUsbAvailable) {
      setErrorMessage('Web Serial no está disponible en este navegador. Usá Chrome o Edge.');
      return;
    }
    if (!niimbotViaUsb && !niimbotBtAvailable) {
      setErrorMessage('Web Bluetooth no está disponible en este navegador. Usá Chrome o Edge.');
      return;
    }

    setNiimbotPrinting(true);
    setNiimbotProgress(null);
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    const itemPayload = {
      codigo: currentItem.codigo,
      proveedor: currentItem.proveedor,
      descripcion: currentItem.descripcion,
      ubicacion: currentItem.ubicacion,
      codigoBarras: currentItem.codigoBarras,
    };
    const copies = Math.max(1, Math.min(50, copiesCount));
    const onProgress = (status: string) => setNiimbotProgress(status);

    try {
      if (niimbotViaUsb) {
        await printToNiimbotUsb(itemPayload, { copies, size: niimbotSize, onProgress });
      } else {
        await printToNiimbot(itemPayload, { copies, size: niimbotSize, onProgress });
      }
      playSuccessSound();
      setSaveSuccessMessage(
        `Etiqueta impresa en la NIIMBOT por ${niimbotViaUsb ? 'USB' : 'Bluetooth'} (${copies} copia${copies > 1 ? 's' : ''}).`
      );
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      const msgMap: Record<string, string> = {
        NotFoundError: 'Selección cancelada o impresora no encontrada. Volvé a intentar.',
        NetworkError: 'No se pudo conectar con la impresora. Revisá el cable/puerto y intentá de nuevo.',
        'NotAllowedError': 'Permiso denegado para el puerto USB.',
      };
      let msg = msgMap[err?.name] || (err as Error)?.message || 'Ocurrió un error al imprimir en la NIIMBOT.';
      // The reference driver rejects with a descriptive message on its own.
      if (msg.includes('Web Bluetooth') && niimbotViaUsb) msg = 'No se pudo conectar por USB. Revisá el cable y probá de nuevo.';
      console.error('Niimbot print failed:', err);
      setErrorMessage(msg);
    } finally {
      setNiimbotPrinting(false);
      setNiimbotProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sky-950/70 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-[#c4e1f7] max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#006bb0] to-[#005590] p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-sky-100">
                Vincular Código de Barras
              </span>
              <h2 className="text-base font-black text-white leading-tight mt-0.5">
                Código de Barras del Producto
              </h2>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-slate-800">
          
          {/* Target Product Summary Box */}
          <div className="bg-[#f0f7fc] border border-[#c4e1f7] rounded-2xl p-3.5 flex flex-col gap-1.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm sm:text-base text-[#006bb0] bg-white px-2.5 py-0.5 rounded-lg border border-[#badbf5] shadow-2xs">
                  {currentItem.codigo}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-[#c4e1f7]">
                  {currentItem.proveedor}
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Stock: {currentItem.stock} u.
              </span>
            </div>

            <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug mt-1">
              {currentItem.descripcion}
            </p>

            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-600" />
                Ubicación: <strong>{currentItem.ubicacion || 'A'}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="capitalize">
                Categoría: <strong>{currentItem.categoria === 'panol' ? 'Pañol' : currentItem.categoria.replace('_', ' ')}</strong>
              </span>
            </div>
          </div>

          {/* Current Barcode Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-2xl border transition-all bg-white border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                hasLinkedBarcode 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {hasLinkedBarcode ? <Check className="w-4 h-4" /> : <Scan className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Estado actual
                </span>
                {hasLinkedBarcode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {currentItem.codigoBarras}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">
                      (Código guardado)
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-amber-800">
                    Sin código de barras vinculado todavía
                  </span>
                )}
              </div>
            </div>

            {hasLinkedBarcode && (
              <button
                type="button"
                onClick={handleRemoveBarcode}
                className="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Desvincular y borrar este código de barras"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desvincular</span>
              </button>
            )}
          </div>

          {/* Toast / Alert Feedback */}
          {saveSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-3 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-3 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Conflict Warning Modal */}
          {conflictItem && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 text-xs text-amber-950 flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-amber-900">
                    ¡Código de barras ya en uso por otro producto!
                  </strong>
                  <span>
                    El código <code>{scannedCodeInput}</code> ya pertenece a <strong>{conflictItem.codigo}</strong> ({conflictItem.descripcion}).
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setConflictItem(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveBarcode(scannedCodeInput, true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black cursor-pointer shadow-xs"
                >
                  Reasignar a este producto
                </button>
              </div>
            </div>
          )}

          {/* Scanner / Input Zone */}
          <div className="bg-gradient-to-br from-[#eaf4fb] to-[#f4f9fd] border-2 border-[#badbf5] rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-[#006bb0]">
                  Lector de Pistola USB o Entrada Manual
                </span>
              </div>
            </div>

            {/* Input & Action */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={scannedCodeInput}
                  onChange={e => setScannedCodeInput(e.target.value)}
                  onKeyDown={handleKeyDownInput}
                  placeholder="Escanea aquí con la pistola o escribe el código..."
                  className={`w-full pl-3.5 pr-10 py-3 bg-white rounded-2xl border-2 ${
                    isCodeAlreadySaved 
                      ? 'border-emerald-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15' 
                      : 'border-[#94c9f1] focus:border-[#006bb0] focus:ring-4 focus:ring-[#006bb0]/15'
                  } outline-hidden text-sm sm:text-base font-mono font-bold text-slate-900 placeholder:text-slate-400 shadow-inner`}
                  autoComplete="off"
                />
                {isCodeAlreadySaved ? (
                  <CheckCheck className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                ) : (
                  <Scan className="w-4 h-4 text-[#006bb0] absolute right-3.5 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
                )}
              </div>

              {isCodeAlreadySaved ? (
                <button
                  type="button"
                  onClick={() => handleSaveBarcode(scannedCodeInput)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs active:scale-95 whitespace-nowrap"
                  title="Este código ya se encuentra guardado para este producto"
                >
                  <CheckCheck className="w-4 h-4 text-emerald-100" />
                  <span>Código Guardado</span>
                </button>
              ) : hasDifferentCode ? (
                <button
                  type="button"
                  onClick={() => handleSaveBarcode(scannedCodeInput)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#006bb0] hover:bg-[#005590] text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs active:scale-95 whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  <span>Actualizar Código</span>
                </button>
              ) : isNewCode ? (
                <button
                  type="button"
                  onClick={() => handleSaveBarcode(scannedCodeInput)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-[#006bb0] hover:bg-[#005590] text-white font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs active:scale-95 whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Código</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-200 text-slate-400 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-not-allowed shrink-0 whitespace-nowrap"
                >
                  <Scan className="w-4 h-4" />
                  <span>Ingresar Código</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#006bb0] shrink-0" />
              <span>
                Al disparar el lector de código de barras USB, se guardará y asociará automáticamente a este producto.
              </span>
            </p>

            {!hasLinkedBarcode && (
              <button
                type="button"
                onClick={() => handleSaveBarcode(currentItem.codigo)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white hover:bg-[#eaf4fb] text-[#006bb0] border-2 border-dashed border-[#94c9f1] font-bold text-xs transition-colors cursor-pointer active:scale-95"
                title="Generar el código de barras a partir del código del producto"
              >
                <Sparkles className="w-4 h-4" />
                <span>Usar el código del producto ({currentItem.codigo}) como código de barras</span>
              </button>
            )}
          </div>

          {/* Printable Label Preview (only if barcode is assigned) */}
          {hasLinkedBarcode && (
            <div className="bg-[#f8fcfe] border-2 border-dashed border-[#badbf5] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#006bb0] mb-2">
                Vista previa de etiqueta física
              </span>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs w-full max-w-sm flex flex-col items-center">
                <span className="text-[10px] font-black text-[#006bb0] uppercase tracking-wider">
                  Verdu y Cía.
                </span>
                <span className="text-xs font-bold text-slate-800 line-clamp-1 mt-0.5">
                  {currentItem.descripcion}
                </span>

                <div className="my-1.5 flex justify-center w-full overflow-hidden">
                  <svg ref={svgRef} className="max-w-full" />
                </div>

                <div className="w-full flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100">
                  <span>Código: <strong>{currentItem.codigo}</strong></span>
                  <span>Ubicación: <strong>{currentItem.ubicacion || 'A'}</strong></span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadBarcodePDF}
                className="mt-3 px-4 py-2 rounded-xl bg-[#006bb0] hover:bg-[#005590] text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                title="Descargar etiqueta en formato PDF lista para imprimir"
              >
                <FileDown className="w-4 h-4" />
                <span>Descargar Etiqueta en PDF</span>
              </button>

              <div className="mt-3 w-full flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Copias:
                  </span>
                  <button
                    type="button"
                    onClick={() => setCopiesCount(c => Math.max(1, c - 1))}
                    disabled={niimbotPrinting}
                    className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-black text-slate-800">
                    {copiesCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCopiesCount(c => Math.min(50, c + 1))}
                    disabled={niimbotPrinting}
                    className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Etiqueta:
                  </span>
                  <select
                    value={niimbotSize.label}
                    onChange={(e) => {
                      const s = NIIMBOT_B1_SIZES.find((x) => x.label === e.target.value);
                      if (s) setNiimbotSize(s);
                    }}
                    disabled={niimbotPrinting}
                    className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Tamaño del rollo de etiquetas cargado en la impresora"
                  >
                    {NIIMBOT_B1_SIZES.map((s) => (
                      <option key={s.label} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {niimbotPrinting ? (
                  <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                    <span>{niimbotProgress || 'Imprimiendo…'}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNiimbotViaUsb(true)}
                        disabled={!niimbotUsbAvailable}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          niimbotViaUsb
                            ? 'bg-slate-800 text-white border border-slate-700'
                            : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                        }`}
                        title={niimbotUsbAvailable ? 'Imprimir por cable USB' : 'Web Serial no disponible'}
                      >
                        USB
                      </button>
                      <button
                        type="button"
                        onClick={() => setNiimbotViaUsb(false)}
                        disabled={!niimbotBtAvailable}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          niimbotViaUsb
                            ? 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                            : 'bg-slate-800 text-white border border-slate-700'
                        }`}
                        title={niimbotBtAvailable ? 'Imprimir por Bluetooth' : 'Web Bluetooth no disponible'}
                      >
                        <Printer className="w-3 h-3" />
                        Bluetooth
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handlePrintToNiimbot}
                      disabled={niimbotViaUsb ? !niimbotUsbAvailable : !niimbotBtAvailable}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:bg-slate-400 disabled:cursor-not-allowed"
                      title={
                        niimbotViaUsb
                          ? 'Imprimir directo en la NIIMBOT B1 por cable USB'
                          : 'Imprimir directo en la NIIMBOT B1 por Bluetooth'
                      }
                    >
                      <Printer className="w-4 h-4" />
                      <span>{niimbotViaUsb ? 'Imprimir en NIIMBOT (USB)' : 'Imprimir en NIIMBOT'}</span>
                    </button>
                  </>
                )}

                {!niimbotUsbAvailable && !niimbotBtAvailable && (
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Requiere Chrome o Edge con HTTPS / localhost.
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-[#f0f7fc] border-t border-[#c4e1f7] p-4 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            {hasLinkedBarcode ? 'Listo para escanear en despachos e ingresos' : 'Esperando escaneo de código de barras...'}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
