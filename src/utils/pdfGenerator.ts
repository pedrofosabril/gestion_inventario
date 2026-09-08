import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SalidaGroupRecord, SalidaItemEntry } from '../types';
import { replaceYazWithYas } from './sanitizeUtils';

export const generateSalidaPDF = (rawSalidaGroup: SalidaGroupRecord) => {
  const salidaGroup: SalidaGroupRecord = {
    ...rawSalidaGroup,
    retira: replaceYazWithYas(rawSalidaGroup.retira),
    cliente: replaceYazWithYas(rawSalidaGroup.cliente),
    usuarioRegistro: replaceYazWithYas(rawSalidaGroup.usuarioRegistro),
    notas: replaceYazWithYas(rawSalidaGroup.notas),
    firmadoPor: replaceYazWithYas(rawSalidaGroup.firmadoPor),
    items: rawSalidaGroup.items.map(it => ({
      ...it,
      descripcion: replaceYazWithYas(it.descripcion)
    }))
  };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor: [number, number, number] = [0, 107, 176]; // #006bb0
  const darkColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const slateColor: [number, number, number] = [100, 116, 139]; // #64748b
  const lightBg: [number, number, number] = [244, 249, 253]; // #f4f9fd
  const borderLight: [number, number, number] = [196, 225, 247]; // #c4e1f7

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
  doc.text('COMPROBANTE DE DESPACHO', 196, 11, { align: 'right' });
  doc.setFontSize(13);
  doc.text(salidaGroup.numeroSalidaFormatted || `SAL-${salidaGroup.id}`, 196, 18, { align: 'right' });

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
  doc.text(`${salidaGroup.fechaSalida} - ${salidaGroup.horaSalida} hs`, 18, startY + 11);

  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('TIPO DE REMITO:', 18, startY + 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  if (salidaGroup.esRemitoInterno) {
    doc.setTextColor(126, 34, 206); // Purple
    doc.text('REMITO INTERNO (TALLER)', 18, startY + 23);
  } else {
    doc.setTextColor(...primaryColor);
    doc.text('REMITO CLIENTE (EXTERNO)', 18, startY + 23);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text(`Registrado por: ${salidaGroup.usuarioRegistro || 'Pañolero'}`, 18, startY + 30);

  // Column 2: Empleado que retiró & Nº Remito
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('EMPLEADO QUE RETIRÓ:', 75, startY + 6);
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text(salidaGroup.retira || 'Sin asignar', 75, startY + 11);

  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('Nº PRESUPUESTO / REMITO:', 75, startY + 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text(salidaGroup.nroRemito || 'S/N', 75, startY + 23);

  // Column 3: Destino / Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text('CLIENTE / DESTINO / OBRA:', 135, startY + 6);
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  const splitCliente = doc.splitTextToSize(salidaGroup.cliente || 'Consumo Interno', 58);
  doc.text(splitCliente, 135, startY + 11);

  let currentY = startY + 38;

  // Notes if exists
  if (salidaGroup.notas && salidaGroup.notas.trim() !== '') {
    doc.setFillColor(254, 243, 199); // Amber light
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(14, currentY, 182, 12, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text(`OBSERVACIONES: ${salidaGroup.notas}`, 18, currentY + 7);
    currentY += 16;
  }

  // Section Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('DETALLE DE PRODUCTOS Y REPUESTOS DESPACHADOS', 14, currentY + 2);
  currentY += 4;

  // Consolidate Items
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

  // Table Columns & Data (Without prices)
  const tableHeaders = [['#', 'CÓDIGO', 'DESCRIPCIÓN DE LA PIEZA', 'MARCA / PROVEEDOR', 'UBICACIÓN', 'CANTIDAD']];

  const tableRows = consolidatedItems.map((item, idx) => [
    (idx + 1).toString(),
    item.codigo,
    item.descripcion,
    item.proveedor || '-',
    item.ubicacion || 'A',
    `${item.cantidad} u.`
  ]);

  // Render Table using autoTable
  autoTable(doc, {
    startY: currentY,
    head: tableHeaders,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 107, 176],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      cellPadding: 2.5
    },
    alternateRowStyles: {
      fillColor: [248, 251, 254]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 82 },
      3: { cellWidth: 26 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  // Table Totals Footer
  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Totals Box
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...borderLight);
  doc.roundedRect(14, finalY, 182, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text(`TOTAL DE UNIDADES DESPACHADAS: ${salidaGroup.totalUnidades} u. (${consolidatedItems.length} ítems)`, 20, finalY + 9);

  // --- SIGNATURES ---
  const signY = Math.max(finalY + 30, 240);

  // If digital signature exists, render it
  if (salidaGroup.firmaDigital) {
    try {
      doc.addImage(salidaGroup.firmaDigital, 'PNG', 130, signY - 20, 50, 18);
    } catch (e) {
      console.warn('Could not attach digital signature image to PDF', e);
    }
  }

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);
  doc.line(25, signY, 85, signY);
  doc.line(125, signY, 185, signY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('FIRMA PAÑOLERO / EMISOR', 55, signY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('FIRMA EMPLEADO QUE RETIRA', 155, signY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateColor);
  doc.text(salidaGroup.retira || 'Receptor', 155, signY + 9, { align: 'center' });

  // --- FOOTER BAR ---
  doc.setFontSize(7);
  doc.setTextColor(...slateColor);
  const todayStr = new Date().toLocaleString('es-AR');
  doc.text(`Documento generado el ${todayStr} - Verdu y Cía. S.A. Control de Stock`, 105, 287, { align: 'center' });

  // Download PDF
  const filename = `Comprobante_${salidaGroup.numeroSalidaFormatted || `SAL-${salidaGroup.id}`}.pdf`;
  doc.save(filename);
};
