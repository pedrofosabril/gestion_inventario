import fs from 'fs';
import path from 'path';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parsePrice(str) {
  if (!str) return 0;
  let cleaned = str.replace(/[$\s"']/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '#VALUE!') return 0;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseDate(str) {
  if (!str) return '2026-05-21';
  const parts = str.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  return '2026-05-21';
}

const panolItems = [];
let idCounter = 1;

// 1. Read Pañol CSV
const panolPath = path.join(process.cwd(), 'INVENTARIO ingreso_salida - Pañol.csv');
if (fs.existsSync(panolPath)) {
  const content = fs.readFileSync(panolPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('CÓDIGO') || lines[i].toUpperCase().includes('CODIGO')) {
      headerIndex = i;
      break;
    }
  }

  const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 3) continue;

    let codigo = cols[0] ? cols[0].replace(/^[´`]/, '').trim() : '';
    const proveedor = cols[1] ? cols[1].replace(/^[´`]/, '').trim() : '';
    let descripcion = cols[2] ? cols[2].replace(/^[´`]/, '').trim() : '';
    const stockStr = cols[3] ? cols[3].trim() : '';
    let ubicacion = cols[4] ? cols[4].trim() : '-';
    const equivalencias = cols[5] ? cols[5].trim() : '';
    const precioStr = cols[6] ? cols[6].trim() : '';
    const totalStr = cols[7] ? cols[7].trim() : '';
    const fechaStr = cols[8] ? cols[8].trim() : '';

    // Ignore completely empty rows
    if (!codigo && !descripcion && !proveedor) continue;

    if (!codigo) {
      if (descripcion) codigo = 'S/C-' + idCounter;
      else continue;
    }

    const stock = parseInt(stockStr, 10) || 0;
    const precio = parsePrice(precioStr);
    let precioTotal = parsePrice(totalStr);
    if (precioTotal === 0 && stock > 0 && precio > 0) {
      precioTotal = Math.round(stock * precio * 100) / 100;
    }

    const fechaRegistro = parseDate(fechaStr);

    let categoria = 'panol';
    if (ubicacion.toLowerCase().includes('entrepiso')) {
      categoria = 'entrepiso';
    } else if (proveedor.toUpperCase().includes('MV') || descripcion.toUpperCase().includes('MV-')) {
      categoria = 'repuestos_mv';
    }

    panolItems.push({
      id: `pan-${idCounter++}`,
      codigo,
      proveedor: proveedor || '-',
      descripcion: descripcion || codigo,
      stock,
      stockMinimo: 1,
      ubicacion: ubicacion || '-',
      categoria,
      equivalencias: equivalencias || undefined,
      fechaRegistro,
      fechaUltimoMovimiento: fechaRegistro,
      precio,
      precioTotal,
      porEncargo: stock === 0,
      notas: equivalencias ? `Equiv: ${equivalencias}` : undefined,
      codigoBarras: codigo
    });
  }
}

// 2. Read Cajones / Fluidos CSV
const cajonesItems = [];
const cajonesPath = path.join(process.cwd(), 'INVENTARIO AIR.P 2026 - CAJONES_FLUIDOS.csv');
if (fs.existsSync(cajonesPath)) {
  const content = fs.readFileSync(cajonesPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes('CÓDIGO') || lines[i].toUpperCase().includes('CODIGO')) {
      headerIndex = i;
      break;
    }
  }

  const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 4) continue;

    // Left side: CAJONES / ESTANTES
    let codigo = cols[0] ? cols[0].replace(/^[´`]/, '').trim() : '';
    const proveedor = cols[1] ? cols[1].replace(/^[´`]/, '').trim() : '';
    let descripcion = cols[2] ? cols[2].replace(/^[´`]/, '').trim() : '';
    const stockStr = cols[3] ? cols[3].trim() : '';
    let ubicacion = cols[4] ? cols[4].trim() : 'CAJONES';

    if (codigo || descripcion) {
      if (!codigo) codigo = 'CAJ-' + idCounter;
      const stock = parseInt(stockStr, 10) || 0;
      
      cajonesItems.push({
        id: `caj-${idCounter++}`,
        codigo,
        proveedor: proveedor || 'SULLAIR',
        descripcion: descripcion || codigo,
        stock,
        stockMinimo: 1,
        ubicacion: ubicacion || 'CAJONES',
        categoria: 'cajones_fluidos',
        subcategoria: ubicacion.toLowerCase().includes('estante') ? 'Estante' : 'Cajones',
        fechaRegistro: '2026-05-21',
        precio: 0,
        precioTotal: 0,
        porEncargo: stock === 0,
        codigoBarras: codigo
      });
    }

    // Right side: FLUIDOS (Columns 7, 8, 9)
    if (cols.length >= 10) {
      let fCodigo = cols[7] ? cols[7].trim() : '';
      let fDesc = cols[8] ? cols[8].trim() : '';
      let fStockStr = cols[9] ? cols[9].trim() : '';

      if (fCodigo && fDesc) {
        const fStock = parseInt(fStockStr, 10) || 0;
        const p = fDesc.toLowerCase().includes('sullube') ? 833.70 : 150.00;
        cajonesItems.push({
          id: `flu-${idCounter++}`,
          codigo: fCodigo,
          proveedor: 'SULLAIR',
          descripcion: fDesc,
          stock: fStock,
          stockMinimo: 2,
          ubicacion: 'FLUIDOS',
          categoria: 'cajones_fluidos',
          subcategoria: 'Fluidos',
          fechaRegistro: '2026-05-21',
          precio: p,
          precioTotal: p * fStock,
          porEncargo: fStock === 0,
          codigoBarras: fCodigo
        });
      }
    }
  }
}

// 3. Keep existing Submicrónicos and Rodamientos
const existingInitData = fs.readFileSync(path.join(process.cwd(), 'src/data/initialData.ts'), 'utf-8');

// Extract submicronicos, rodamientos, repuestos_mv, cajas
const otherItems = [
  // Submicrónicos
  { id: 'sub-1', codigo: '02250193-571', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXF 475', stock: 2, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 875.40, precioTotal: 1750.80, codigoBarras: '02250193-571' },
  { id: 'sub-2', codigo: '02250193-595', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXH 925', stock: 3, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 1477.80, precioTotal: 4433.40, codigoBarras: '02250193-595' },
  { id: 'sub-3', codigo: '02250193-573', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXF 925', stock: 3, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 1477.80, precioTotal: 4433.40, codigoBarras: '02250193-573' },
  { id: 'sub-4', codigo: '02250193-572', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXF 750', stock: 2, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 1120.00, precioTotal: 2240.00, codigoBarras: '02250193-572' },
  { id: 'sub-5', codigo: '02250193-594', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXH 750', stock: 1, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 1120.00, precioTotal: 1120.00, codigoBarras: '02250193-594' },
  { id: 'sub-6', codigo: '02250193-570', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXF 325', stock: 2, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 740.00, precioTotal: 1480.00, codigoBarras: '02250193-570' },
  { id: 'sub-7', codigo: '02250193-592', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXH 325', stock: 2, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 740.00, precioTotal: 1480.00, codigoBarras: '02250193-592' },
  { id: 'sub-8', codigo: '02250193-568', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXF 170', stock: 2, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 510.00, precioTotal: 1020.00, codigoBarras: '02250193-568' },
  { id: 'sub-9', codigo: '02250193-590', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXH 170', stock: 1, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 510.00, precioTotal: 510.00, codigoBarras: '02250193-590' },
  { id: 'sub-10', codigo: '02250193-566', proveedor: 'SULLAIR', descripcion: 'ELEM. FILTR. P/ FXF 85', stock: 3, stockMinimo: 1, ubicacion: 'ESTANTE', categoria: 'submicronicos', fechaRegistro: '2026-05-21', precio: 390.00, precioTotal: 1170.00, codigoBarras: '02250193-566' },
  // Rodamientos
  { id: 'rod-1', codigo: '6205-2RSH', proveedor: 'SKF', descripcion: 'RODAMIENTO RIGIDO DE BOLAS 25x52x15', stock: 12, stockMinimo: 4, ubicacion: 'ESTANTE R-1', categoria: 'rodamientos', fechaRegistro: '2026-05-21', precio: 18.50, precioTotal: 222.00, codigoBarras: '6205-2RSH' },
  { id: 'rod-2', codigo: '6308-2RS1', proveedor: 'SKF', descripcion: 'RODAMIENTO RIGIDO DE BOLAS 40x90x23', stock: 8, stockMinimo: 2, ubicacion: 'ESTANTE R-1', categoria: 'rodamientos', fechaRegistro: '2026-05-21', precio: 45.20, precioTotal: 361.60, codigoBarras: '6308-2RS1' },
  { id: 'rod-3', codigo: '30206', proveedor: 'TIMKEN', descripcion: 'RODAMIENTO CONICO 30x62x17.25', stock: 6, stockMinimo: 2, ubicacion: 'ESTANTE R-2', categoria: 'rodamientos', fechaRegistro: '2026-05-21', precio: 52.00, precioTotal: 312.00, codigoBarras: '30206' },
  { id: 'rod-4', codigo: '32210', proveedor: 'TIMKEN', descripcion: 'RODAMIENTO CONICO 50x90x24.75', stock: 4, stockMinimo: 2, ubicacion: 'ESTANTE R-2', categoria: 'rodamientos', fechaRegistro: '2026-05-21', precio: 89.00, precioTotal: 356.00, codigoBarras: '32210' },
  { id: 'rod-5', codigo: 'NU 212 ECP', proveedor: 'SKF', descripcion: 'RODAMIENTO DE RODILLOS CILINDRICOS 60x110x22', stock: 3, stockMinimo: 1, ubicacion: 'ESTANTE R-3', categoria: 'rodamientos', fechaRegistro: '2026-05-21', precio: 145.00, precioTotal: 435.00, codigoBarras: 'NU 212 ECP' },
  { id: 'rod-6', codigo: '22212 E', proveedor: 'FAG', descripcion: 'RODAMIENTO OSCILANTE DE RODILLOS 60x110x28', stock: 2, stockMinimo: 1, ubicacion: 'ESTANTE R-3', categoria: 'rodamientos', fechaRegistro: '2026-05-21', precio: 210.00, precioTotal: 420.00, codigoBarras: '22212 E' },
  // Repuestos MV & Cajas
  { id: 'mv-1', codigo: 'MV-KIT-50', proveedor: 'REPUESTOS MV', descripcion: 'KIT MANTENIMIENTO PREVENTIVO 50HP', stock: 4, stockMinimo: 1, ubicacion: 'MV-50', categoria: 'repuestos_mv', fechaRegistro: '2026-05-21', precio: 620.00, precioTotal: 2480.00, codigoBarras: 'MV-KIT-50' },
  { id: 'mv-2', codigo: 'MV-KIT-100', proveedor: 'REPUESTOS MV', descripcion: 'KIT MANTENIMIENTO PREVENTIVO 100HP', stock: 2, stockMinimo: 1, ubicacion: 'MV-100', categoria: 'repuestos_mv', fechaRegistro: '2026-05-21', precio: 1150.00, precioTotal: 2300.00, codigoBarras: 'MV-KIT-100' },
  { id: 'caj-est-1', codigo: 'CJ-EST-01', proveedor: 'SULLAIR', descripcion: 'CAJA ACCESORIOS Y NIPLES ALTA PRESION', stock: 5, stockMinimo: 2, ubicacion: 'ESTANTE C-1', categoria: 'cajas', fechaRegistro: '2026-05-21', precio: 85.00, precioTotal: 425.00, codigoBarras: 'CJ-EST-01' },
  { id: 'caj-est-2', codigo: 'CJ-EST-02', proveedor: 'SULLAIR', descripcion: 'CAJA JUNTAS Y O-RINGS VARIOS COMPRESORES', stock: 7, stockMinimo: 2, ubicacion: 'ESTANTE C-2', categoria: 'cajas', fechaRegistro: '2026-05-21', precio: 120.00, precioTotal: 840.00, codigoBarras: 'CJ-EST-02' }
];

const fullInventory = [...panolItems, ...cajonesItems, ...otherItems];

console.log(`Generated total inventory items: ${fullInventory.length}`);

// Generate TypeScript code
const tsCode = `import { InventoryItem, SalidaRecord, IngresoRecord, UserAccount, SalidaGroupRecord } from '../types';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-2',
    username: 'panol',
    nombre: 'Pañolero',
    rol: 'panolero',
    password: 'panol',
  },
  {
    id: 'usr-4',
    username: 'ventas',
    nombre: 'Ventas',
    rol: 'ventas',
    password: 'ventas',
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = ${JSON.stringify(fullInventory, null, 2)};

export const INITIAL_SALIDAS: SalidaRecord[] = [
  {
    id: 'sal-1',
    salidaGroupId: 'grp-sal-1',
    numeroSalida: 1,
    numeroSalidaFormatted: 'Salida N° 1',
    nroRemito: 'Rº18274',
    codigo: '02250155-709',
    descripcion: 'ELEM FILTRO ACEITE p/S-ENERGY',
    fechaSalida: '2025-08-11',
    horaSalida: '09:30',
    cliente: 'Biofarma S.A',
    retira: 'David',
    cantidad: 4,
    precioUnitario: 222.30,
    categoria: 'panol',
    esRemitoInterno: false,
    notas: 'Mantenimiento preventivo compresores taller central',
    usuarioRegistro: 'Matías (Jefe de Pañol)'
  },
  {
    id: 'sal-2',
    salidaGroupId: 'grp-sal-1',
    numeroSalida: 1,
    numeroSalidaFormatted: 'Salida N° 1',
    nroRemito: 'Rº18274',
    codigo: '250022-669',
    descripcion: 'SULLUBE 32 ACEITE x 5GAL',
    fechaSalida: '2025-08-11',
    horaSalida: '09:30',
    cliente: 'Biofarma S.A',
    retira: 'David',
    cantidad: 2,
    precioUnitario: 833.70,
    categoria: 'cajones_fluidos',
    esRemitoInterno: false,
    notas: 'Mantenimiento preventivo compresores taller central',
    usuarioRegistro: 'Matías (Jefe de Pañol)'
  },
  {
    id: 'sal-3',
    salidaGroupId: 'grp-sal-2',
    numeroSalida: 2,
    numeroSalidaFormatted: 'Salida N° 2',
    nroRemito: 'Rº18384',
    codigo: '250034-087',
    descripcion: 'ELEMENTO SEPARADOR 375Q',
    fechaSalida: '2025-09-11',
    horaSalida: '14:15',
    cliente: 'VIAL RG S.A',
    retira: 'Valeria',
    cantidad: 1,
    precioUnitario: 999.50,
    categoria: 'panol',
    esRemitoInterno: false,
    notas: 'Repuestos para unidad móvil 4',
    usuarioRegistro: 'Matías (Jefe de Pañol)'
  },
  {
    id: 'sal-4',
    salidaGroupId: 'grp-sal-3',
    numeroSalida: 3,
    numeroSalidaFormatted: 'Salida N° 3',
    nroRemito: 'INT-00441',
    codigo: '88290015-567',
    descripcion: 'ELEMTO.SEPAR. WS1100-1500',
    fechaSalida: '2025-09-18',
    horaSalida: '11:05',
    cliente: 'Taller Interno Verdu',
    retira: 'Manuel SERV',
    cantidad: 2,
    precioUnitario: 329.20,
    categoria: 'panol',
    esRemitoInterno: true,
    notas: 'Uso directo en banco de pruebas mecánicas',
    usuarioRegistro: 'Matías (Jefe de Pañol)'
  },
  {
    id: 'sal-5',
    salidaGroupId: 'grp-sal-3',
    numeroSalida: 3,
    numeroSalidaFormatted: 'Salida N° 3',
    nroRemito: 'INT-00441',
    codigo: '250028-032',
    descripcion: 'FILTRO ACEITE P/6E ELEMTO.',
    fechaSalida: '2025-09-18',
    horaSalida: '11:05',
    cliente: 'Taller Interno Verdu',
    retira: 'Manuel SERV',
    cantidad: 1,
    precioUnitario: 107.10,
    categoria: 'panol',
    esRemitoInterno: true,
    notas: 'Uso directo en banco de pruebas mecánicas',
    usuarioRegistro: 'Matías (Jefe de Pañol)'
  },
  {
    id: 'sal-6',
    salidaGroupId: 'grp-sal-4',
    numeroSalida: 4,
    numeroSalidaFormatted: 'Salida N° 4',
    nroRemito: 'Rº18947',
    codigo: '250022-669',
    descripcion: 'SULLUBE 32 ACEITE x 5GAL',
    fechaSalida: '2026-07-21',
    horaSalida: '16:40',
    cliente: 'FMRT',
    retira: 'Matias',
    cantidad: 15,
    precioUnitario: 833.70,
    categoria: 'cajones_fluidos',
    esRemitoInterno: false,
    notas: 'Despacho directo cliente',
    usuarioRegistro: 'Matías (Jefe de Pañol)'
  }
];

export const INITIAL_INGRESOS: IngresoRecord[] = [
  {
    id: 'ing-1',
    codigo: '02250127-684',
    proveedor: 'SULLAIR',
    descripcion: 'ELEMENT AIR FILTER',
    cantidad: 10,
    fechaIngreso: '2025-08-25',
    factura: '0001-00426819',
    ubicacion: 'E',
    categoria: 'panol'
  },
  {
    id: 'ing-2',
    codigo: '02250168-084',
    proveedor: 'SULLAIR',
    descripcion: 'ELEM FLTR CORELESS 2 DIA. +',
    cantidad: 18,
    fechaIngreso: '2025-09-11',
    factura: '0001-00427013',
    ubicacion: 'F',
    categoria: 'panol'
  },
  {
    id: 'ing-3',
    codigo: '02250155-709',
    proveedor: 'SULLAIR',
    descripcion: 'ELEM FILTRO ACEITE p/S-ENERGY',
    cantidad: 6,
    fechaIngreso: '2025-11-12',
    factura: '001-00428998',
    ubicacion: 'G',
    categoria: 'panol'
  },
  {
    id: 'ing-4',
    codigo: '250022-669',
    proveedor: 'SULLAIR',
    descripcion: 'SULLUBE 32 ACEITE x 5GAL',
    cantidad: 16,
    fechaIngreso: '2026-02-25',
    factura: '0001-00434392',
    ubicacion: 'FLUIDOS',
    categoria: 'cajones_fluidos'
  },
  {
    id: 'ing-5',
    codigo: '02250125-372',
    proveedor: 'SULLAIR',
    descripcion: 'FILTRO DE AIRE S.ENERGY',
    cantidad: 10,
    fechaIngreso: '2026-03-19',
    factura: '0001-00435578',
    ubicacion: 'E',
    categoria: 'panol'
  },
  {
    id: 'ing-6',
    codigo: '250034-085',
    proveedor: 'SULLAIR',
    descripcion: 'ELEMTO. SEP-1º DEL 20 NEW',
    cantidad: 3,
    fechaIngreso: '2026-07-21',
    factura: '0001-00443021',
    ubicacion: 'J',
    categoria: 'panol'
  },
  {
    id: 'ing-7',
    codigo: 'C1140',
    proveedor: 'REPUESTOS MV',
    descripcion: 'FILTRO DE AIRE MV-10',
    cantidad: 31,
    fechaIngreso: '2026-06-01',
    factura: '00058-00070686',
    ubicacion: 'MV-10',
    categoria: 'repuestos_mv'
  }
];

export const INITIAL_SALIDA_GROUPS: SalidaGroupRecord[] = [
  {
    id: 'grp-sal-1',
    numeroSalida: 1,
    numeroSalidaFormatted: 'Salida N° 1',
    fechaSalida: '2025-08-11',
    horaSalida: '09:30',
    retira: 'David',
    esRemitoInterno: false,
    cliente: 'Biofarma S.A',
    nroRemito: 'Rº18274',
    notas: 'Mantenimiento preventivo compresores taller central',
    usuarioRegistro: 'Matías (Jefe de Pañol)',
    items: [
      {
        id: 'item-grp-1',
        codigo: '02250155-709',
        descripcion: 'ELEM FILTRO ACEITE p/S-ENERGY',
        proveedor: 'SULLAIR',
        ubicacion: 'G',
        cantidad: 4,
        stockDisponible: 6,
        stockRemanente: 2,
        precioUnitario: 222.30,
        precioTotal: 889.20,
        categoria: 'panol'
      },
      {
        id: 'item-grp-2',
        codigo: '250022-669',
        descripcion: 'SULLUBE 32 ACEITE x 5GAL',
        proveedor: 'SULLAIR',
        ubicacion: 'FLUIDOS',
        cantidad: 2,
        stockDisponible: 16,
        stockRemanente: 14,
        precioUnitario: 833.70,
        precioTotal: 1667.40,
        categoria: 'cajones_fluidos'
      }
    ],
    totalUnidades: 6,
    totalValor: 2556.60
  },
  {
    id: 'grp-sal-2',
    numeroSalida: 2,
    numeroSalidaFormatted: 'Salida N° 2',
    fechaSalida: '2025-09-11',
    horaSalida: '14:15',
    retira: 'Valeria',
    esRemitoInterno: false,
    cliente: 'VIAL RG S.A',
    nroRemito: 'Rº18384',
    notas: 'Repuestos para unidad móvil 4',
    usuarioRegistro: 'Matías (Jefe de Pañol)',
    items: [
      {
        id: 'item-grp-3',
        codigo: '250034-087',
        descripcion: 'ELEMENTO SEPARADOR 375Q',
        proveedor: 'SULLAIR',
        ubicacion: 'J',
        cantidad: 1,
        stockDisponible: 3,
        stockRemanente: 2,
        precioUnitario: 999.50,
        precioTotal: 999.50,
        categoria: 'panol'
      }
    ],
    totalUnidades: 1,
    totalValor: 999.50
  },
  {
    id: 'grp-sal-3',
    numeroSalida: 3,
    numeroSalidaFormatted: 'Salida N° 3',
    fechaSalida: '2025-09-18',
    horaSalida: '11:05',
    retira: 'Manuel SERV',
    esRemitoInterno: true,
    cliente: 'Taller Interno Verdu',
    nroRemito: 'INT-00441',
    notas: 'Uso directo en banco de pruebas mecánicas',
    usuarioRegistro: 'Matías (Jefe de Pañol)',
    items: [
      {
        id: 'item-grp-4',
        codigo: '88290015-567',
        descripcion: 'ELEMTO.SEPAR. WS1100-1500',
        proveedor: 'SULLAIR',
        ubicacion: 'A',
        cantidad: 2,
        stockDisponible: 5,
        stockRemanente: 3,
        precioUnitario: 329.20,
        precioTotal: 658.40,
        categoria: 'panol'
      },
      {
        id: 'item-grp-5',
        codigo: '250028-032',
        descripcion: 'FILTRO ACEITE P/6E ELEMTO.',
        proveedor: 'SULLAIR',
        ubicacion: 'E',
        cantidad: 1,
        stockDisponible: 4,
        stockRemanente: 3,
        precioUnitario: 107.10,
        precioTotal: 107.10,
        categoria: 'panol'
      }
    ],
    totalUnidades: 3,
    totalValor: 765.50
  },
  {
    id: 'grp-sal-4',
    numeroSalida: 4,
    numeroSalidaFormatted: 'Salida N° 4',
    fechaSalida: '2026-07-21',
    horaSalida: '16:40',
    retira: 'Matias',
    esRemitoInterno: false,
    cliente: 'FMRT',
    nroRemito: 'Rº18947',
    notas: 'Despacho directo cliente',
    usuarioRegistro: 'Matías (Jefe de Pañol)',
    items: [
      {
        id: 'item-grp-6',
        codigo: '250022-669',
        descripcion: 'SULLUBE 32 ACEITE x 5GAL',
        proveedor: 'SULLAIR',
        ubicacion: 'FLUIDOS',
        cantidad: 15,
        stockDisponible: 16,
        stockRemanente: 1,
        precioUnitario: 833.70,
        precioTotal: 12505.50,
        categoria: 'cajones_fluidos'
      }
    ],
    totalUnidades: 15,
    totalValor: 12505.50
  }
];
`;

fs.writeFileSync(path.join(process.cwd(), 'src/data/initialData.ts'), tsCode, 'utf-8');
console.log('Successfully wrote initialData.ts with ALL items!');
