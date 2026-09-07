import fs from 'fs';
import path from 'path';

// Helper to parse a CSV line handling quoted commas
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
  // Clean $ and quotes and spaces
  let cleaned = str.replace(/[$\s"']/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '#VALUE!') return 0;
  // Handle Argentine format 1.890,90 -> 1890.90 or 590,50 -> 590.50
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

const allItems = [];
let idCounter = 1;

// 1. Parse INVENTARIO ingreso_salida - Pañol.csv
const panolPath = path.join(process.cwd(), 'INVENTARIO ingreso_salida - Pañol.csv');
if (fs.existsSync(panolPath)) {
  const content = fs.readFileSync(panolPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  // Find header index
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
    let ubicacion = cols[4] ? cols[4].trim() : 'A';
    const equivalencias = cols[5] ? cols[5].trim() : '';
    const precioStr = cols[6] ? cols[6].trim() : '';
    const totalStr = cols[7] ? cols[7].trim() : '';
    const fechaStr = cols[8] ? cols[8].trim() : '';

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
    const isOld = fechaRegistro.startsWith('2021') || fechaRegistro.startsWith('2022') || fechaRegistro.startsWith('2023');

    // Categorization
    let categoria = 'panol';
    if (ubicacion.toLowerCase().includes('entrepiso')) {
      categoria = 'entrepiso';
    } else if (proveedor.toUpperCase().includes('MV') || descripcion.toUpperCase().includes('MV-')) {
      categoria = 'repuestos_mv';
    } else if (ubicacion.toLowerCase().includes('cajon') || ubicacion.toLowerCase().includes('cajas')) {
      categoria = 'cajones_fluidos';
    }

    const item = {
      id: `pan-${idCounter++}`,
      codigo,
      proveedor: proveedor || '-',
      descripcion: descripcion || codigo,
      stock,
      stockMinimo: 1,
      ubicacion: ubicacion || '-',
      categoria,
      fechaRegistro,
      fechaUltimoMovimiento: fechaRegistro,
      precio,
      precioTotal,
      porEncargo: stock === 0,
      notas: equivalencias ? `Equiv: ${equivalencias}` : undefined,
      codigoBarras: codigo
    };

    allItems.push(item);
  }
}

console.log(`Parsed ${allItems.length} items from Pañol CSV.`);

// 2. Parse INVENTARIO AIR.P 2026 - CAJONES_FLUIDOS.csv
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
      
      let categoria = 'cajones_fluidos';
      if (ubicacion.toLowerCase().includes('estante')) {
        categoria = 'cajones_fluidos';
      }

      allItems.push({
        id: `caj-${idCounter++}`,
        codigo,
        proveedor: proveedor || 'SULLAIR',
        descripcion: descripcion || codigo,
        stock,
        stockMinimo: 1,
        ubicacion: ubicacion || 'CAJONES',
        categoria,
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
        allItems.push({
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
          precio: fDesc.toLowerCase().includes('sullube') ? 833.70 : 150.00,
          precioTotal: (fDesc.toLowerCase().includes('sullube') ? 833.70 : 150.00) * fStock,
          porEncargo: fStock === 0,
          codigoBarras: fCodigo
        });
      }
    }
  }
}

console.log(`Total all items parsed: ${allItems.length}`);

// Output summary counts
const byCat = {};
for (const item of allItems) {
  byCat[item.categoria] = (byCat[item.categoria] || 0) + 1;
}
console.log('Categories count:', byCat);
