import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  RefreshCw, 
  Download, 
  Trash2, 
  Layers,
  Sparkles,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import { ItemCategory } from '../types';
import { sanitizeYazObject } from '../utils/sanitizeUtils';

interface ExcelImportDropzoneProps {
  onSuccess?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  showButton?: boolean;
}

export const ExcelImportDropzone: React.FC<ExcelImportDropzoneProps> = ({ 
  onSuccess,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  showButton = true
}) => {
  const { importExcelRows } = useInventory();

  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [detectedSheets, setDetectedSheets] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>('panol');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importResult, setImportResult] = useState<{ added: number; updated: number; totalValue: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const CATEGORY_OPTIONS: { id: ItemCategory; label: string }[] = [
    { id: 'panol', label: 'Pañol (General)' },
    { id: 'cajones_fluidos', label: 'Cajones / Fluidos' },
    { id: 'submicronicos', label: 'Filtros Submicrónicos' },
    { id: 'rodamientos', label: 'Rodamientos' },
    { id: 'entrepiso', label: 'Entrepiso Pañol' },
    { id: 'importado', label: 'Stock Importado' },
    { id: 'repuestos_mv', label: 'Repuestos MV' },
    { id: 'cajas', label: 'Cajas Estantes' }
  ];

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    setInternalIsOpen(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setErrorMessage(null);
    setImportResult(null);

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => lowerName.endsWith(ext));

    if (!isValid) {
      setErrorMessage('Formato no soportado. Por favor sube un archivo Excel (.xlsx, .xls) o .csv');
      return;
    }

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary', cellDates: true });
        
        const sheetNames = workbook.SheetNames;
        setDetectedSheets(sheetNames);

        // Combine all sheets or the first sheet
        let allRows: any[] = [];
        sheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const sheetJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          sheetJson.forEach((row: any) => {
            row._ORIGEN_HOJA = sheetName;
          });
          allRows = [...allRows, ...sheetJson];
        });

        if (allRows.length === 0) {
          setErrorMessage('La planilla de Excel está vacía o no se pudieron leer filas.');
          setParsedRows([]);
        } else {
          setParsedRows(sanitizeYazObject(allRows));
        }
      } catch (err: any) {
        console.error('Error al procesar archivo Excel:', err);
        setErrorMessage('Error al leer el archivo Excel. Verifica que no esté protegido o dañado.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('No se pudo leer el archivo seleccionado.');
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;

    try {
      const res = importExcelRows(parsedRows, selectedCategory, importMode);
      
      // Calculate total value loaded in this batch
      let batchValuation = 0;
      parsedRows.forEach(row => {
        const keys = Object.keys(row);
        let s = 0;
        let p = 0;
        keys.forEach(k => {
          const lk = k.toLowerCase();
          if (lk.includes('stock') || lk.includes('cant')) {
            s = parseFloat(String(row[k]).replace(/[^0-9.-]/g, '')) || 0;
          }
          if (lk.includes('precio') || lk.includes('unit') || lk.includes('valor')) {
            p = parseFloat(String(row[k]).replace(/\$/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '')) || 0;
          }
        });
        batchValuation += (s * p);
      });

      setImportResult({
        added: res.added,
        updated: res.updated,
        totalValue: batchValuation
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(`Error durante la importación: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleReset = () => {
    setFileName(null);
    setFileSize(null);
    setParsedRows([]);
    setDetectedSheets([]);
    setImportResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'CÓDIGO': 'FILT-SULL-001',
        'PROVEEDOR': 'SULLAIR',
        'DESCRIPCIÓN': 'Elemento Separador de Aceite 250034-112',
        'STOCK': 15,
        'PRECIO UNITARIO': 48500.00,
        'UBICACIÓN': 'A-12',
        'CATEGORÍA': 'Pañol General'
      },
      {
        'CÓDIGO': 'ROD-SKF-6205',
        'PROVEEDOR': 'SKF',
        'DESCRIPCIÓN': 'Rodamiento Rígido de Bolas 6205-2RS1/C3',
        'STOCK': 24,
        'PRECIO UNITARIO': 12350.50,
        'UBICACIÓN': 'B-04',
        'CATEGORÍA': 'Rodamientos'
      },
      {
        'CÓDIGO': 'ACEITE-AW46',
        'PROVEEDOR': 'SHELL',
        'DESCRIPCIÓN': 'Fluido Hidráulico Tellus S2 MX 46 (Balde 20L)',
        'STOCK': 8,
        'PRECIO UNITARIO': 89200.00,
        'UBICACIÓN': 'C-01',
        'CATEGORÍA': 'Cajones / Fluidos'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'PLANTILLA_PRODUCTOS');
    XLSX.writeFile(wb, 'Plantilla_Carga_Productos_Verdu.xlsx');
  };

  return (
    <>
      {/* Compact Trigger Button */}
      {showButton && (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.99]"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Carga Automática de Productos desde Excel</span>
        </button>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={handleClose}
        >
          <div 
            className="bg-white rounded-3xl border border-sky-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 flex flex-col gap-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-sky-950 tracking-tight">
                  Carga Automática de Productos desde Excel
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-100/70 hover:bg-sky-200/80 border border-sky-300 transition-colors shrink-0 cursor-pointer"
                  title="Descargar archivo Excel de ejemplo con las columnas recomendadas"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Plantilla Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drag & Drop Area when no file is selected */}
            {!fileName && !importResult && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50 scale-[1.01] shadow-md' 
                    : 'border-[#a8d4f2] bg-[#f8fbfe] hover:border-[#006bb0] hover:bg-[#ebf6fd]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-9 h-9" />
                </div>

                <div className="text-center">
                  <p className="text-sm font-black text-sky-950">
                    Arrastra tu archivo Excel aquí o <span className="text-[#006bb0] underline">haz clic para examinar</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Soporta formatos <span className="font-semibold text-slate-700">.xlsx, .xls y .csv</span>
                  </p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2.5 text-rose-800 text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="flex-1">{errorMessage}</span>
                <button 
                  type="button" 
                  onClick={() => setErrorMessage(null)} 
                  className="text-rose-500 hover:text-rose-800 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* File Detected & Configuration */}
            {fileName && !importResult && (
              <div className="bg-[#f8fbfe] rounded-2xl border border-sky-200 p-4 sm:p-5 flex flex-col gap-4 shadow-xs animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-sky-950 flex items-center gap-2">
                        <span>{fileName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 font-mono text-slate-600">
                          {fileSize}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {parsedRows.length} filas detectadas en {detectedSheets.length} {detectedSheets.length === 1 ? 'hoja' : 'hojas'} ({detectedSheets.join(', ')})
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Cambiar archivo</span>
                  </button>
                </div>

                {/* Import Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Categoría / Sección de destino:
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value as ItemCategory)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-[#b8ddf5] text-sky-950 focus:outline-none focus:ring-2 focus:ring-[#006bb0]"
                    >
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Método de Carga:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          importMode === 'merge'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 text-emerald-600" />
                          <span>Actualizar</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal mt-1 leading-tight">
                          Suma y actualiza ítems.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          importMode === 'replace'
                            ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-amber-600" />
                          <span>Reemplazar</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal mt-1 leading-tight">
                          Sobrescribe la sección.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rows Preview */}
                {parsedRows.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                      <span>Vista Previa</span>
                      <span className="text-[11px] font-normal text-slate-500">Mostrando primeras 4 de {parsedRows.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 overflow-x-auto">
                      {parsedRows.slice(0, 4).map((row, idx) => {
                        const keys = Object.keys(row).filter(k => k !== '_ORIGEN_HOJA');
                        return (
                          <div key={idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-sky-50/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-sky-950 bg-sky-100 px-2 py-0.5 rounded text-[11px] shrink-0">
                                {String(row[keys[0]] || 'S/C')}
                              </span>
                              <span className="text-slate-700 truncate font-medium">
                                {String(row[keys[1]] || row[keys[2]] || 'Sin descripción')}
                              </span>
                            </div>
                            {row._ORIGEN_HOJA && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                                {row._ORIGEN_HOJA}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Confirm Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isProcessing || parsedRows.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>CARGAR {parsedRows.length} PRODUCTOS AUTOMÁTICAMENTE</span>
                  </button>
                </div>
              </div>
            )}

            {/* Success Result */}
            {importResult && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-emerald-950">
                      ¡Carga Automática de Excel Completada con Éxito!
                    </h4>
                    <p className="text-xs text-emerald-900/80 mt-0.5">
                      El inventario ha sido actualizado en tiempo real.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nuevos Artículos</span>
                    <span className="text-lg font-black text-emerald-700 font-mono">+{importResult.added}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Artículos Actualizados</span>
                    <span className="text-lg font-black text-sky-700 font-mono">{importResult.updated}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Valuación Cargada</span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      ${importResult.totalValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cargar Otro Archivo
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

