/**
 * Test del parser de Excel (src/utils/excelImportLayouts.ts).
 *
 *   node scripts/test-excel-parser.cjs [ruta.xlsx]
 *
 * No sube ningun archivo al repo: se pasa el Excel por parametro.
 * Con el archivo real de 9 hojas tambien valida los conteos exactos.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const TMP = process.env.TEMP || 'C:\\Users\\MIGUE_~1\\AppData\\Local\\Temp';
const OUT = path.join(TMP, 'opencode', 'excelImportLayouts.test.cjs');

// Layout que se espera para el archivo real de 9 hojas
const ESPERADO = {
  'Pañol': { kind: 'productos', categoria: 'panol' },
  'Ingreso': { kind: 'ingresos', categoria: null },
  'Salida': { kind: 'salidas', categoria: null },
  'CAJONESFLUIDOS': { kind: 'productos', categoria: 'cajones_fluidos' },
  'Submicrónicos': { kind: 'productos', categoria: 'submicronicos' },
  'Rodamientos': { kind: 'productos', categoria: 'rodamientos' },
  'Entrepiso': { kind: 'productos', categoria: 'entrepiso' },
  'MV': { kind: 'productos', categoria: 'repuestos_mv' },
  'CAJAS': { kind: 'productos', categoria: 'cajas' }
};

// Conteos verificados contra el archivo real completo
const CONTEOS_ARCHIVO_REAL = {
  'Pañol': 773,
  'Ingreso': 964,
  'Salida': 1641,
  'CAJONESFLUIDOS': 98,
  'Submicrónicos': 33,
  'Rodamientos': 47,
  'Entrepiso': 60,
  'MV': 26,
  'CAJAS': 23
};

function compilarParser() {
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src', 'utils', 'excelImportLayouts.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: OUT,
    logLevel: 'error'
  });
  return require(OUT);
}

function leerHojas(ruta) {
  const wb = XLSX.readFile(ruta, { cellDates: true });
  return wb.SheetNames.map(name => {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    return { name, data };
  });
}

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

(async () => {
  const ruta = process.argv[2] || 'C:\\Users\\migue_om293fy\\Downloads\\INVENTARIO ingreso_salida (6).xlsx';
  if (!fs.existsSync(ruta)) {
    console.error('No existe el archivo: ' + ruta);
    process.exit(2);
  }

  const { parseSheet } = compilarParser();
  const hojas = leerHojas(ruta);
  const esMismoEsquema = hojas.length === 9 && hojas.some(h => h.name === 'CAJONESFLUIDOS');
  // Solo se validan conteos exactos con el archivo real completo (no con recortes de prueba)
  const esArchivoReal = esMismoEsquema && hojas.reduce((n, h) => n + h.data.length, 0) > 3000;

  console.log('archivo: ' + ruta);
  console.log('hojas:   ' + hojas.length + (esArchivoReal ? ' (archivo real de 9 hojas, conteos exactos)' : esMismoEsquema ? ' (recorte de 9 hojas)' : ''));
  console.log('');
  console.log(pad('hoja', 18) + rpad('tipo', 11) + rpad('categoria', 17) + rpad('filas', 7) + '  notas');
  console.log('-'.repeat(110));

  const fallas = [];
  let tProductos = 0, tSalidas = 0, tIngresos = 0;

  for (const { name, data } of hojas) {
    const r = parseSheet(name, data);
    tProductos += r.kind === 'productos' ? r.rows.length : 0;
    tSalidas += r.kind === 'salidas' ? r.rows.length : 0;
    tIngresos += r.kind === 'ingresos' ? r.rows.length : 0;

    console.log(pad(name, 18) + rpad(r.kind, 11) + rpad(r.category || '-', 17) + rpad(r.rows.length, 7) + '  ' + (r.notas[0] || ''));

    // Invariantes validos para cualquier archivo
    for (const row of r.rows) {
      if (r.kind === 'productos') {
        if (!row.codigo) { fallas.push(name + ': producto sin codigo -> ' + JSON.stringify(row).slice(0, 120)); break; }
        if (!isFinite(Number(row.stock)) || !isFinite(Number(row.precio))) {
          fallas.push(name + ': producto con stock/precio no numerico -> ' + row.codigo + ' stock=' + row.stock + ' precio=' + row.precio);
          break;
        }
      }
      if (r.kind === 'salidas' && !row.codigo) { fallas.push(name + ': salida sin codigo'); break; }
      if (r.kind === 'ingresos' && !row.codigo) { fallas.push(name + ': ingreso sin codigo'); break; }
      if ((r.kind === 'salidas' || r.kind === 'ingresos') && row.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) {
        fallas.push(name + ': fecha no normalizada a ISO -> ' + row.fecha);
        break;
      }
    }

    const esp = ESPERADO[name];
    if (esp) {
      if (r.kind !== esp.kind) fallas.push(name + ': se esperaba kind=' + esp.kind + ' y vino ' + r.kind);
      if (esp.categoria && r.category !== esp.categoria) fallas.push(name + ': se esperaba categoria=' + esp.categoria + ' y vino ' + r.category);
      if (esArchivoReal && r.rows.length !== CONTEOS_ARCHIVO_REAL[name]) {
        fallas.push(name + ': se esperaban ' + CONTEOS_ARCHIVO_REAL[name] + ' filas y vieram ' + r.rows.length);
      }
    }
  }

  console.log('-'.repeat(110));
  console.log('TOTALES -> productos: ' + tProductos + ' | salidas: ' + tSalidas + ' | ingresos: ' + tIngresos);

  if (fallas.length > 0) {
    console.log('');
    console.log('FALLAS (' + fallas.length + '):');
    fallas.forEach(f => console.log('  - ' + f));
    console.log('RESULT: FAIL');
    process.exit(1);
  }
  console.log('RESULT: PASS');
})().catch(e => { console.error('ERROR: ' + (e && e.message ? e.message : e)); process.exit(2); });