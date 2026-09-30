import jsPDF from 'jspdf';

export const triggerPdfDownload = (doc: jsPDF, filename: string) => {
  const embedded: boolean = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  if (embedded) {
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, '_blank');
      if (opened) {
        window.setTimeout(() => URL.revokeObjectURL(url), 120000);
        return;
      }
    } catch (e) {
      console.warn('No se pudo abrir el PDF en pestaña nueva; intentando descarga directa.', e);
    }
  }

  doc.save(filename);
};