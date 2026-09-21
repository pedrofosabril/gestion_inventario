import JsBarcode from 'jsbarcode';
import 'niimbot-web-bluetooth';

export const NIIMBOT_B1_MODEL: NiimbotModel = {
  label: 'Niimbot B1',
  id: 4096,
  dpi: 203,
  protocol: 'v4',
  task: 'b1',
  density: 3,
  label_type: 1,
  speed: 1,
  name_prefixes: ['B1'],
};

export const NIIMBOT_T50X30_B1: NiimbotSize = {
  label: '50 × 30 mm (B1)',
  code: 'T50*30',
  w_mm: 50,
  h_mm: 30,
  w_px: 384,
  h_px: 240,
  margin: 8,
  offset_y_px: 4,
  dpi: 203,
};

export const isNiimbotSupported = (): boolean => !!window.Niimbot?.isSupported();

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line && lines.length + 1 <= maxLines) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 0) {
      lines[maxLines - 1] = last.slice(0, -1);
    }
    lines[maxLines - 1] += '…';
  }
  return lines.slice(0, maxLines).filter(Boolean);
}

export function renderLabelToCanvas(
  item: {
    codigo?: string;
    proveedor?: string;
    descripcion?: string;
    ubicacion?: string;
    codigoBarras?: string;
  },
  size: NiimbotSize = NIIMBOT_T50X30_B1
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size.w_px;
  canvas.height = size.h_px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas.');

  const W = size.w_px;
  const H = size.h_px;
  const margin = size.margin ?? 8;

  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header ribbon
  const headerH = Math.round(H * 0.17);
  ctx.fillStyle = '#006bb0';
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(H * 0.06)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VERDU Y CÍA. S.A. - CONTROL DE PAÑOL', W / 2, headerH / 2 + 1);

  // Descripción
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.round(H * 0.068)}px sans-serif`;
  ctx.textAlign = 'center';
  const descLines = wrapText(ctx, item.descripcion || '', W - margin * 3, 3);
  let y = headerH + (H - headerH) * 0.1;
  for (const line of descLines) {
    ctx.fillText(line, W / 2, y);
    y += Math.round(H * 0.078);
  }

  // Barcode
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, item.codigoBarras || item.codigo || '', {
    format: 'CODE128',
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 18,
    font: 'monospace',
    textMargin: 6,
    lineColor: '#000000',
    background: '#ffffff',
  });

  const barcodeW = Math.min(barcodeCanvas.width, W - margin * 2);
  const barcodeH = (barcodeCanvas.height * barcodeW) / barcodeCanvas.width;
  const barcodeX = (W - barcodeW) / 2;
  const barcodeY = y + Math.round(H * 0.09);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(barcodeCanvas, barcodeX, barcodeY, barcodeW, barcodeH);

  // Footer info
  ctx.fillStyle = '#475569';
  ctx.font = `bold ${Math.round(H * 0.062)}px monospace`;
  ctx.textBaseline = 'alphabetic';
  const footerY = H - Math.round(H * 0.06);
  ctx.textAlign = 'left';
  ctx.fillText(`CÓD: ${item.codigo || '-'}`, margin, footerY);
  ctx.textAlign = 'center';
  ctx.fillText(`UBIC: ${item.ubicacion || 'PAÑOL'}`, W / 2, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(`PROV: ${item.proveedor || '-'}`, W - margin, footerY);

  return canvas;
}

export async function printToNiimbot(
  item: {
    codigo?: string;
    proveedor?: string;
    descripcion?: string;
    ubicacion?: string;
    codigoBarras?: string;
  },
  options: {
    copies?: number;
    onProgress?: (status: string) => void;
  } = {}
): Promise<void> {
  const niimbot = window.Niimbot;
  if (!niimbot) {
    throw new Error('La librería NIIMBOT no está cargada. Recargá la página e intentá de nuevo.');
  }
  if (!niimbot.isSupported()) {
    throw new Error('Tu navegador no tiene Web Bluetooth. Usá Chrome o Edge desde HTTPS (o localhost).');
  }

  const canvas = renderLabelToCanvas(item);
  const url = canvas.toDataURL('image/png');

  await niimbot.printImage(url, {
    model: NIIMBOT_B1_MODEL,
    size: NIIMBOT_T50X30_B1,
    copies: options.copies || 1,
    onProgress: options.onProgress,
  });
}

export function getB1PrinterInfo(): NiimbotPrinterInfo | undefined {
  return window.Niimbot?.printer;
}