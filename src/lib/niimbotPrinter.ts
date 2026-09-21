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

export const NIIMBOT_T50X50_B1: NiimbotSize = {
  label: '50 × 50 mm (B1)',
  code: 'T50*50',
  w_mm: 50,
  h_mm: 50,
  w_px: 384,
  h_px: 400,
  margin: 8,
  offset_y_px: 4,
  dpi: 203,
};

export const NIIMBOT_T50X20_B1: NiimbotSize = {
  label: '50 × 20 mm (B1)',
  code: 'T50*20',
  w_mm: 50,
  h_mm: 20,
  w_px: 384,
  h_px: 160,
  margin: 8,
  offset_y_px: 4,
  dpi: 203,
};

export const NIIMBOT_B1_SIZES: NiimbotSize[] = [
  NIIMBOT_T50X50_B1,
  NIIMBOT_T50X30_B1,
  NIIMBOT_T50X20_B1,
];

export const isNiimbotSupported = (): boolean => !!window.Niimbot?.isSupported();

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
  const code = String(item.codigoBarras || item.codigo || '').trim() || '-';

  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Numeral debajo del código, en grande
  const numFont = Math.max(26, Math.round(H * 0.12));
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${numFont}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const numBaseline = H - Math.round(H * 0.07);
  ctx.fillText(code, W / 2, numBaseline);

  // Código de barras horizontal, ancho, centrado y con aire por los bordes
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, code, {
    format: 'CODE128',
    width: 2,
    height: Math.max(40, Math.round(H * 0.2)),
    displayValue: false,
    margin: 8,
    lineColor: '#000000',
    background: '#ffffff',
  });

  const availW = Math.round(W * 0.9); // 90% del ancho: deja aire a los costados
  const topY = Math.round(H * 0.07);
  const botY = numBaseline - Math.round(numFont * 0.5);
  const availH = botY - topY;

  const barcodeW = Math.min(barcodeCanvas.width, availW);
  let barcodeH = (barcodeCanvas.height * barcodeW) / barcodeCanvas.width;
  // Nunca más alto que ancho: para códigos cortos el origen puede quedar
  // cuadrado/alto, y eso imprimiría un código en vertical.
  barcodeH = Math.min(barcodeH, barcodeW);
  barcodeH = Math.min(barcodeH, availH);
  const barcodeX = (W - barcodeW) / 2;
  const barcodeY = topY + Math.max(0, (availH - barcodeH) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(barcodeCanvas, barcodeX, barcodeY, barcodeW, barcodeH);

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
    size?: NiimbotSize;
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

  const size = options.size || NIIMBOT_T50X30_B1;
  const canvas = renderLabelToCanvas(item, size);
  const url = canvas.toDataURL('image/png');

  await niimbot.printImage(url, {
    model: NIIMBOT_B1_MODEL,
    size,
    copies: options.copies || 1,
    onProgress: options.onProgress,
  });
}

export function getB1PrinterInfo(): NiimbotPrinterInfo | undefined {
  return window.Niimbot?.printer;
}