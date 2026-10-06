import { ItemCategory } from '../types';

export type SheetKind = 'productos' | 'salidas' | 'ingresos';

export interface SheetLayout {
  sheetName: string;
  kind: SheetKind;
  category: ItemCategory;
  rows: Record<string, unknown>[];
  notas: string[];
}

interface Block {
  headerRow: number;
  startCol: number;
  endCol: number;
  headers: string[];
  /** Marca los bloques de tipo (código, cantidad) hallados en tablas lado a lado. */
  tipoColumn?: boolean;
  marca?: string;
}

const norm = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°ª]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Etiquetas que identifican una fila de encabezados de columnas. */
const HEADER_TOKENS = [
  'codigo', 'cod', 'code', 'articulo', 'parte', 'referencia', 'numero',
  'proveedor', 'marca', 'fabricante', 'supplier', 'brand',
  'descripcion', 'desc', 'detalle', 'nombre', 'denominacion',
  'stock', 'cant', 'cantidad', 'qty', 'existencia', 'saldo',
  'ubicacion', 'estante', 'cajon', 'posicion', 'pasillo',
  'precio', 'pRECIO'.toLowerCase(), 'unitario', 'costo', 'valor', 'total',
  'fecha', 'control', 'registro', 'factura', 'ingreso', 'salida',
  'remito', 'n presp', 'cliente', 'retira', 'servicio', 'subcategoria', 'subcat'
];

const CANT_TOKENS = ['cant', 'cant.', 'canti', 'cantidad', 'qty', 'existencia', 'saldo'];

const isHeaderCell = (v: unknown) => {
  const n = norm(v);
  // Las etiquetas de encabezado son cortas; los textos largos son descripciones.
  if (!n || n.length > 40) return false;
  return HEADER_TOKENS.some(
    t => n === t || n.startsWith(t + ' ') || n.startsWith(t + '.') || (t.length >= 4 && n.includes(t))
  );
};

const isCantCell = (v: unknown) => CANT_TOKENS.some(t => norm(v) === t);

/**
 * Detecta bloques tabulares dentro de una hoja. Cada bloque tiene su propia fila de
 * encabezado, lo que permite leer planillas con varias tablas al costado (por ejemplo
 * los fluidos al lado de los cajones, o las marcas del entrepiso).
 */
function findBlocks(dataRows: unknown[][]): Block[] {
  const limit = Math.min(dataRows.length, 25);
  const blocks: Block[] = [];

  for (let r = 0; r < limit; r++) {
    const row = dataRows[r] ?? [];
    const headerCols: number[] = [];
    const cantCols: number[] = [];
    row.forEach((cell, c) => {
      if (isHeaderCell(cell)) headerCols.push(c);
      if (isCantCell(cell)) cantCols.push(c);
    });

    // Tablas (código, cantidad) lado a lado: FLEETGUARD | CANT | LANSS | CANT | ...
    if (cantCols.length >= 2) {
      const usable = cantCols.filter(c => c > 0 && String(row[c - 1] ?? '').trim() !== '');
      if (usable.length >= 2) {
        usable.forEach(c => {
          blocks.push({
            headerRow: r,
            startCol: c - 1,
            endCol: c,
            headers: ['CODIGO', 'CANT'],
            tipoColumn: true,
            marca: norm(row[c - 1])
          });
        });
        continue;
      }
    }

    // Varias tablas con encabezado propio en la misma fila (p.ej. cajones + fluidos).
    const runs: number[][] = [];
    headerCols.forEach(c => {
      const last = runs[runs.length - 1];
      if (last && c - last[last.length - 1] <= 1) last.push(c);
      else runs.push([c]);
    });
    const meaningful = runs.filter(run => run.length >= 2);
    if (meaningful.length === 0) continue;
    meaningful.forEach(run => {
      const startCol = run[0];
      let endCol = run[run.length - 1];
      for (let c = endCol + 1; c < (dataRows[r]?.length ?? 0); c++) {
        if (String(dataRows[r][c] ?? '').trim() === '') break;
        endCol = c;
      }
      const headers: string[] = [];
      for (let c = startCol; c <= endCol; c++) headers.push(String(row[c] ?? '').trim() || `Col${c + 1}`);
      blocks.push({ headerRow: r, startCol, endCol, headers });
    });
  }

  // Descarta encabezados que otro bloque ya cubrió (mismo rango o solapados).
  const unique = blocks.filter((b, i) =>
    !blocks.some((o, j) => j < i && o.startCol <= b.startCol && b.endCol <= o.endCol)
  );
  return unique.sort((a, b) => a.headerRow - b.headerRow || a.startCol - b.startCol);
}

/** Layouts fijos para hojas que no tienen fila de encabezados (históricamente fijas). */
const FIXED_LAYOUTS: Record<string, { headers: string[]; dataStart: number }> = {
  submicronicos: {
    headers: ['CODIGO', 'PROVEEDOR', 'DESCRIPCION', 'STOCK', 'UBICACION', 'F. DE REGISTRO', 'PRECIO', 'TOTAL', 'P/SERVICIO', 'CANT PS'],
    dataStart: 0
  },
  mv: {
    headers: ['CODIGO', 'DESCRIPCION', 'TIPO', 'STOCK', 'PRECIO', 'TOTAL'],
    dataStart: 0
  },
  'repuestos mv': {
    headers: ['CODIGO', 'DESCRIPCION', 'TIPO', 'STOCK', 'PRECIO', 'TOTAL'],
    dataStart: 0
  }
};

/** Convierte cualquier celda en número, tolerando "875,40", "$ 1.234,56", "2 (USADOS)". */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  let s = String(value).replace(/\$/g, '').replace(/\s/g, '').replace(/[^0-9.,-]/g, '');
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Formato argentino: punto de miles y coma decimal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/** Normaliza fechas de Excel a ISO (yyyy-mm-dd). Acepta Date, ISO y "28-08/2025". */
export function toISODate(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value ?? '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

const firstValue = (row: unknown[], start: number, end: number) => {
  for (let c = start; c <= end; c++) {
    const v = row[c];
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return '';
};

/**
 * Mapea una fila YA RECORTADA al rango del bloque (los índices de `headers`
 * arrancan en 0 dentro de la fila) a las claves canónicas que usa el importador.
 */
function mapProductRow(row: unknown[], block: Block): Record<string, unknown> | null {
  const findHeader = (tokens: string[]): number => {
    // Primero se buscan coincidencias exactas y después las parciales, para que una
    // columna como "CANT PS" no se tome como el stock original por empezar con "CANT".
    for (const exact of [true, false]) {
      for (let i = 0; i < block.headers.length; i++) {
        const nh = norm(block.headers[i]);
        const hit = tokens.some(t => (exact ? nh === t : nh.startsWith(t)));
        if (!hit) continue;
        const v = row[i];
        if (v !== null && v !== undefined && String(v).trim() !== '') return i;
      }
    }
    return -1;
  };
  const get = (tokens: string[]): unknown => {
    const i = findHeader(tokens);
    return i === -1 ? undefined : row[i];
  };

  if (block.tipoColumn) {
    const codigo = String(firstValue(row, 0, 0) ?? '').trim();
    if (!codigo) return null;
    return {
      codigo,
      proveedor: (block.marca || '').toUpperCase(),
      descripcion: codigo,
      stock: Math.max(0, Math.trunc(toNumber(firstValue(row, 1, 1)))),
      ubicacion: 'ENTREPISO',
      precio: 0,
      fechaRegistro: ''
    };
  }

  const codigo = String(get(['codigo', 'cod', 'code', 'articulo', 'parte', 'referencia', 'numero']) ?? '')
    .trim()
    .replace(/^[´`º]/, '');
  if (!codigo) return null;

  const stock = Math.max(0, Math.trunc(toNumber(get(['stock', 'cant', 'cantidad', 'qty', 'existencia', 'saldo']))));
  const precio = toNumber(get(['precio', 'unitario', 'costo', 'valor']));
  const fechaRegistro = toISODate(get(['f. de control', 'f. de registro', 'fecha', 'control', 'registro']));

  // La columna p/servicio puede venir como etiqueta ("P/SERVICIO.") con la cantidad
  // en la columna contigua, así que se toma el mayor valor numérico encontrado.
  let paraServicio = 0;
  for (let i = 0; i < block.headers.length; i++) {
    const nh = norm(block.headers[i]);
    if (['p/servicio', 'servicio', 'cant ps', 'para servicio'].some(t => nh.startsWith(t))) {
      const v = toNumber(row[i]);
      if (v > paraServicio) paraServicio = v;
    }
  }

  return {
    codigo,
    proveedor: String(get(['proveedor', 'marca', 'fabricante', 'supplier', 'brand']) ?? '').trim(),
    descripcion: String(get(['descripcion', 'desc', 'detalle', 'nombre', 'denominacion']) ?? '').trim(),
    stock,
    ubicacion: String(get(['ubicacion', 'estante', 'cajon', 'posicion', 'pasillo']) ?? '').trim(),
    equivalencias: String(get(['equivalencias']) ?? '').trim(),
    precio,
    fechaRegistro,
    paraServicio
  };
}

function mapSalidaRow(row: unknown[], block: Block): Record<string, unknown> | null {
  const get = (tokens: string[]): unknown => {
    for (let i = 0; i < block.headers.length; i++) {
      const nh = norm(block.headers[i]);
      if (tokens.some(t => nh === t || nh.startsWith(t))) {
        const v = row[i];
        if (v !== null && v !== undefined && String(v).trim() !== '') return v;
      }
    }
    return undefined;
  };
  const codigo = String(get(['codigo', 'cod', 'code', 'articulo', 'parte']) ?? '').trim();
  const cantidad = Math.trunc(toNumber(get(['cant', 'cantidad', 'qty'])));
  if (!codigo || cantidad <= 0) return null;
  return {
    nroRemito: String(get(['n presp', 'remito', 'n° presp', 'comprobante', 'nro']) ?? '').trim(),
    codigo,
    descripcion: String(get(['descripcion', 'desc', 'detalle']) ?? '').trim(),
    fechaSalida: toISODate(get(['salida', 'fecha'])),
    cliente: String(get(['cliente', 'destinatario']) ?? '').trim(),
    retira: String(get(['retira', 'responsable', 'retira responsable']) ?? '').trim(),
    cantidad
  };
}

function mapIngresoRow(row: unknown[], block: Block): Record<string, unknown> | null {
  const get = (tokens: string[]): unknown => {
    for (let i = 0; i < block.headers.length; i++) {
      const nh = norm(block.headers[i]);
      if (tokens.some(t => nh === t || nh.startsWith(t))) {
        const v = row[i];
        if (v !== null && v !== undefined && String(v).trim() !== '') return v;
      }
    }
    return undefined;
  };
  const codigo = String(get(['codigo', 'cod', 'code', 'articulo', 'parte']) ?? '').trim();
  const cantidad = Math.trunc(toNumber(get(['cant', 'cantidad', 'qty'])));
  if (!codigo || cantidad <= 0) return null;
  return {
    codigo,
    proveedor: String(get(['proveedor', 'marca', 'fabricante']) ?? '').trim(),
    descripcion: String(get(['descripcion', 'desc', 'detalle']) ?? '').trim(),
    cantidad,
    fechaIngreso: toISODate(get(['f.ingreso', 'fecha', 'ingreso'])),
    factura: String(get(['factura', 'comprobante', 'nro']) ?? '').trim()
  };
}

/** ¿La hoja es de movimientos (Ingreso/Salida) o de productos? */
function detectKind(sheetName: string, blocks: Block[]): SheetKind {
  const n = norm(sheetName);
  if (n.startsWith('ingreso')) return 'ingresos';
  if (n.startsWith('salida') || n.includes('remito')) return 'salidas';
  const headers = blocks.flatMap(b => b.headers.map(h => norm(h))).join('|');
  if (/\bfactura\b/.test(headers) && !/\bretira\b/.test(headers)) return 'ingresos';
  if (/\bretira\b/.test(headers) || /\bcliente\b/.test(headers)) return 'salidas';
  return 'productos';
}

export const detectCategoryFromSheetName = (sheetName: string): ItemCategory => {
  const n = norm(sheetName);
  if (n.includes('cajon') || n.includes('fluido') || n.includes('aceite') || n.includes('lubric') || n.includes('sullube')) return 'cajones_fluidos';
  if (n.includes('caja')) return 'cajas';
  if (n.includes('submic')) return 'submicronicos';
  if (n.includes('rodamiento')) return 'rodamientos';
  if (n.includes('entrepiso')) return 'entrepiso';
  if (n.includes('mv')) return 'repuestos_mv';
  return 'panol';
};

/**
 * Convierte una hoja de Excel en filas canónicas. Reconoce tablas múltiples dentro de
 * una misma hoja y hojas sin fila de encabezados.
 */
export function parseSheet(sheetName: string, dataRows: unknown[][]): SheetLayout {
  const notas: string[] = [];
  let blocks = findBlocks(dataRows);
  let kind = detectKind(sheetName, blocks);

  // Hojas sin encabezados: se usa el layout histórico fijo de esa hoja.
  if (blocks.length === 0) {
    const fixed = FIXED_LAYOUTS[norm(sheetName)];
    if (fixed) {
      blocks = [{
        headerRow: fixed.dataStart > 0 ? fixed.dataStart - 1 : 0,
        startCol: 0,
        endCol: Math.max(fixed.headers.length - 1, (dataRows[0]?.length ?? 1) - 1),
        headers: fixed.headers
      }];
      const usedFixed = dataRows.findIndex((r, i) => i >= 1 && String(r?.[0] ?? '').trim() !== '');
      if (usedFixed > 0) blocks[0].headerRow = usedFixed - 1;
      notas.push('La hoja no tiene fila de encabezados: se leyó con el formato fijo de esa planilla.');
    } else {
      blocks = [{ headerRow: 0, startCol: 0, endCol: Math.max((dataRows[0]?.length ?? 1) - 1, 0), headers: (dataRows[0] ?? []).map((h, i) => String(h ?? '').trim() || `Col${i + 1}`) }];
      notas.push('No se detectó una fila de encabezados: se intentó leer la primera fila como tal.');
    }
  }

  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  blocks.forEach(block => {
    let vacias = 0;
    for (let r = block.headerRow + 1; r < dataRows.length; r++) {
      const raw = dataRows[r] ?? [];
      const fila = raw.slice(block.startCol, block.endCol + 1);
      if (fila.every(c => String(c ?? '').trim() === '')) {
        vacias++;
        if (vacias >= 12) break; // Resto de la hoja vacío para este bloque.
        continue;
      }
      vacias = 0;
      const mapped =
        kind === 'salidas' ? mapSalidaRow(fila, block)
        : kind === 'ingresos' ? mapIngresoRow(fila, block)
        : mapProductRow(fila, block);
      if (!mapped) continue;
      // En productos la clave incluye el proveedor: el mismo código puede venir
      // como variante de venta y como P/SERVICIO, y ambas filas deben sobrevivir
      // para que después se sumen en el stock original y el de servicio.
      const dedupeKey = kind === 'productos'
        ? `p:${String(mapped.codigo).toLowerCase()}|${norm(mapped.proveedor)}`
        : `${kind[0]}:${mapped.codigo}|${mapped.fechaSalida ?? mapped.fechaIngreso}|${mapped.cantidad}|${mapped.nroRemito ?? mapped.factura ?? ''}|${mapped.cliente ?? mapped.proveedor ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      rows.push(mapped);
    }
  });

  if (blocks.length > 1) {
    notas.push(`Se detectaron ${blocks.length} tablas en la hoja y se leyeron todas.`);
  }

  return { sheetName, kind, category: detectCategoryFromSheetName(sheetName), rows, notas };
}