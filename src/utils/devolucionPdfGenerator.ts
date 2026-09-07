import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DevolucionGroupRecord } from '../types';
import { replaceYazWithYas } from './sanitizeUtils';

export const generateDevolucionPDF = (rawDevolucionGroup: DevolucionGroupRecord) => {
  const devolucionGroup: DevolucionGroupRecord = {
    ...rawDevolucionGroup,
    empleadoDevuelve: replaceYazWithYas(rawDevolucionGroup.empleadoDevuelve),
    usuarioRegistro: replaceYazWithYas(rawDevolucionGroup.usuarioRegistro),
    motivo: replaceYazWithYas(rawDevolucionGroup.motivo),
    notas: replaceYazWithYas(rawDevolucionGroup.notas),
    firmadoPor: replaceYazWithYas(rawDevolucionGroup.firmadoPor),
    items: rawDevolucionGroup.items.map(it => ({
      ...it,
      descripcion: replaceYazWithYas(it.descripcion),
      motivo: replaceYazWithYas(it.motivo)
    }))
  };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor: [number, number, number] = [217, 119, 6]; // Amber-600 #d97706
  const darkColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const slateColor: [number, number, number] = [100, 116, 139]; // #64748b
  const lightBg: [number, number, number] = [255, 251, 235]; // #fffbeb amber-50
  const borderLight: [number, number, number] = [253, 230, 138]; // #fde68a amber-200

  // --- HEADER BAR ---
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 24, 'F');

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('VERDU Y CÍA. S.A.', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('SISTEMA DE CONTROL DE PAÑOL Y GESTIÓN DE STOCK', 14, 18);

  // Document Title Header on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('REMITO DE DEVOLUCIÓN', 196, 11, { align: 'right' });
  doc.setFontSize(13);
  doc.text(devolucionGroup.numeroDevolucionFormatted || `DEV-${devolucionGroup.id}`, 196, 18, { align: 'right' });

  // --- METADATA BOXES ---
  const startY = 30;
  
  // Background container
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(14, startY, 182, 34, 3, 3, 'FD');

  // Column 1: Date & Time
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('FECHA Y HORA:', 18, startY + 6);
  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.text(`${devolucionGroup.fechaDevolucion} - ${devolucionGroup.horaDevolucion} hs`, 18, startY + 11);

  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('MOTIVO:', 18, startY + 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text(devolucionGroup.motivo || 'Devolución pañol', 18, startY + 23);

  // Column 2: Empleado que devuelve
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('EMPLEADO QUE DEVUELVE:', 85, startY + 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text(devolucionGroup.empleadoDevuelve || 'Personal Taller', 85, startY + 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateColor);
  doc.text('RECEPTOR EN PAÑOL:', 85, startY + 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkColor);
  doc.text(devolucionGroup.usuarioRegistro || 'Marcelo (Pañolero)', 85, startY + 23);

  // Column 3: Totales
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('TOTAL DE ÍTEMS:', 150, startY + 6);
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text(`${devolucionGroup.items.length} artículo(s)`, 150, startY + 11);

  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('PIEZAS DEVUELTAS:', 150, startY + 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`${devolucionGroup.totalUnidades} unidades`, 150, startY + 23);

  // Notes if any
  if (devolucionGroup.notas) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...slateColor);
    doc.text(`Observaciones: ${devolucionGroup.notas}`, 18, startY + 30);
  }

  // --- ITEMS TABLE ---
  const tableData = devolucionGroup.items.map((item, idx) => [
    (idx + 1).toString(),
    item.codigo,
    item.descripcion,
    item.ubicacion || 'PAÑOL',
    item.motivo || devolucionGroup.motivo || 'Devolución',
    `${item.cantidad} u.`
  ]);

  autoTable(doc, {
    startY: startY + 38,
    margin: { left: 14, right: 14 },
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL ARTÍCULO', 'UBICACIÓN', 'MOTIVO', 'CANTIDAD']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: darkColor,
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 28 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }
    },
    alternateRowStyles: {
      fillColor: [254, 252, 232]
    }
  });

  // Calculate position after table
  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY + 12;

  // Add a new page if signature would overflow
  if (finalY > 230) {
    doc.addPage();
    finalY = 30;
  }

  // --- SIGNATURE SECTION ---
  const signY = finalY;

  // Receptor Pañol Box
  doc.setDrawColor(203, 213, 225);
  doc.line(20, signY, 85, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('RECIBIDO EN PAÑOL', 52, signY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text(devolucionGroup.usuarioRegistro || 'Marcelo (Pañol)', 52, signY + 9, { align: 'center' });

  // Empleado que devuelve Box
  doc.line(125, signY, 190, signY);
  
  if (devolucionGroup.firmaDigital) {
    try {
      doc.addImage(devolucionGroup.firmaDigital, 'PNG', 135, signY - 20, 45, 18);
    } catch (e) {
      console.error('Failed to embed digital signature in PDF', e);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('FIRMA EMPLEADO QUE DEVUELVE', 157, signY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text(devolucionGroup.empleadoDevuelve || 'Empleado', 157, signY + 9, { align: 'center' });

  // --- FOOTER BAR ---
  doc.setFontSize(7);
  doc.setTextColor(...slateColor);
  const todayStr = new Date().toLocaleString('es-AR');
  doc.text(`Documento generado el ${todayStr} - Verdu y Cía. S.A. Control de Stock`, 105, 287, { align: 'center' });

  // Save the PDF
  const filename = `Remito_Devolucion_${devolucionGroup.numeroDevolucionFormatted.replace(/\s+/g, '_')}_${devolucionGroup.fechaDevolucion}.pdf`;
  doc.save(filename);
};
