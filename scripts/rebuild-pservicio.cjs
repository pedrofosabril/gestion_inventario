/**
 * Opción 3 — Reconstruye en Supabase los productos "duales" (mismo código con
 * variante de venta y P/SERVICIO) dejando UNA fila de stock por código con:
 *   cantidad       = Stock Normal (venta)
 *   stock_servicio = Stock P/SERVICIO
 * y limpia el proveedor del repuesto dejando solo las marcas de venta.
 *
 * Requiere la migración supabase/migrations/20260924_add_stock_servicio.sql.
 * Uso:  node scripts/rebuild-pservicio.cjs
 */
require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// [codigo, proveedor, stock]  (fuente: inventario ya cargado en el sistema)
const raw = [
  ['02250048-734', 'SULLAIR', 1], ['02250048-734', 'P/SERVICIO', 9],
  ['02250053-273', 'SULLAIR', 0], ['02250053-273', 'P/SERVICIO', 2],
  ['02250078-031', 'SULLAIR', 3], ['02250078-031', 'P/SERVICIO', 6],
  ['02250100-755', 'SULLAIR', 2], ['02250100-755', 'P/SERVICIO', 5],
  ['02250100-756', 'SULLAIR', 2], ['02250100-756', 'P/SERVICIO', 5],
  ['02250125-372', 'FLEETGUARD', 2], ['02250125-372', 'P/SERVICIO', 1], ['02250125-372', 'SULLAIR', 5],
  ['02250127-684', 'NACIONALES', 2], ['02250127-684', 'P/SERVICIO', 8], ['02250127-684', 'SULLAIR', 6],
  ['02250135-155', 'SULLAIR', 1], ['02250135-155', 'P/SERVICIO', 22],
  ['02250137-895', 'SULLAIR', 4], ['02250137-895', 'P/SERVICIO', 4],
  ['02250155-536', 'SULLAIR', 1], ['02250155-536', 'SULLAIR', 1],
  ['02250155-709', 'SULLAIR', 5], ['02250155-709', 'P/SERVICIO', 10],
  ['02250168-053', 'SULLAIR', 3], ['02250168-053', 'P/SERVICIO', 9],
  ['02250168-084', 'SULLAIR', 20], ['02250168-084', 'P/SERVICIO', 17],
  ['02250175-062', 'SULLAIR', 0], ['02250175-062', 'P/SERVICIO', 4],
  ['02250175-063', 'SULLAIR', 0], ['02250175-063', 'P/SERVICIO', 1],
  ['02250215-617', 'IMPORTADO', 2], ['02250215-617', 'SULLAIR', 3],
  ['042034RA', 'DRECAFF', 2], ['042034RA', 'SULLAIR', 0],
  ['1001186466', 'SULLAIR', 0], ['1001186466', 'SIN MARCA', 0],
  ['154-0712', 'ONAN', 1], ['154-0712', 'ONAN', 1],
  ['191-1953', 'ONAN', 1], ['191-1953', 'ONAN', 1],
  ['193-0375', 'ONAN', 1], ['193-0375', 'ONAN', 1],
  ['250025-525', 'SULLAIR', 5], ['250025-525', 'P/SERVICIO', 5],
  ['250025-526', 'SULLAIR', 1], ['250025-526', 'P/SERVICIO', 0],
  ['250034-085', 'SULLAIR', 2], ['250034-085', 'P/SERVICIO', 9],
  ['250034-116', 'SULLAIR', 1], ['250034-116', 'P/SERVICIO', 5],
  ['250034-120', 'SULLAIR', 1], ['250034-120', 'P/SERVICIO', 2],
  ['250034-128', 'SULLAIR', 1], ['250034-128', 'P/SERVICIO', 2],
  ['250042-862', 'SULLAIR', 1], ['250042-862', 'P/SERVICIO', 5],
  ['302-0807', 'ONAN', 1], ['302-0807', 'ONAN', 1],
  ['405158RA', 'SULLAIR', 0], ['405158RA', 'P/SERVICIO', 12],
  ['88290014-484', 'SULLAIR', 4], ['88290014-484', 'P/SERVICIO', 5],
  ['88290014-485', 'SULLAIR', 8], ['88290014-485', 'P/SERVICIO', 6],
  ['ADC120-12', 'IMP', 2], ['ADC120-12', 'IMP', 5],
  ['FS19732', 'FLEETGUARD', 2], ['FS19732', 'P/SERVICIO', 5],
  ['HX15', 'MAHLE', 3], ['HX15', 'PRIX', 2], ['HX15', 'VOX', 1],
  ['KC118/1', 'MAHLE', 2], ['KC118/1', 'MANN', 1],
  ['KC454', 'MAHLE', 2], ['KC454', 'MANN', 1],
  ['KC83', 'MAHLE', 1], ['KC83', 'PRIX/VOX', 2],
  ['LX3486', 'SAKURA', 1], ['LX3486', 'MAHLE', 0],
  ['LXS41/1', 'MAHLE', 6], ['LXS41/1', 'SIN MARCA', 1],
  ['MR366', 'MARENO', 1], ['MR366', 'MARENO', 1],
  ['MR447', 'MARENO M.BENZ', 2], ['MR447', 'M.BENZ', 1],
];

const isPS = p => /P\s*\.?\s*\/?\s*SERVICIO|PARA SERVICIO|^SERVICIO$/.test(String(p).toUpperCase());

const by = new Map();
for (const [cod, prov, qty] of raw) {
  if (!by.has(cod)) by.set(cod, []);
  by.get(cod).push({ prov, qty });
}

(async () => {
  const { error: colError } = await sb.from('stock').select('stock_servicio').limit(1);
  if (colError) {
    console.error('Falta la columna stock.stock_servicio.');
    console.error('Ejecutá primero supabase/migrations/20260924_add_stock_servicio.sql en el SQL Editor de Supabase.');
    process.exit(1);
  }

  const codes = [...by.keys()];
  const { data: repuestos, error: rError } = await sb.from('repuestos').select('codigo,precio').in('codigo', codes);
  if (rError) throw rError;
  const precioBy = new Map((repuestos || []).map(r => [r.codigo, Number(r.precio) || 0]));

  const { data: stockRows, error: sError } = await sb.from('stock').select('id_stock,codigo,cantidad,precio,ubicacion').in('codigo', codes);
  if (sError) throw sError;
  const stockBy = new Map();
  for (const row of stockRows || []) {
    if (!stockBy.has(row.codigo)) stockBy.set(row.codigo, []);
    stockBy.get(row.codigo).push(row);
  }

  let done = 0;
  for (const [cod, rows] of by) {
    const normal = rows.filter(r => !isPS(r.prov));
    const ps = rows.filter(r => isPS(r.prov));
    const normalStock = normal.reduce((s, r) => s + r.qty, 0);
    const psStock = ps.reduce((s, r) => s + r.qty, 0);
    const proveedores = [...new Set(normal.map(r => r.prov))].join(' / ') || 'P/SERVICIO';

    const existing = stockBy.get(cod) || [];
    const price = precioBy.get(cod) || Number(existing.find(r => Number(r.precio) > 0)?.precio) || 0;
    const ubicacion = existing.map(r => r.ubicacion).find(u => u && u !== '-') || existing[0]?.ubicacion || '-';

    const { error: delError } = await sb.from('stock').delete().eq('codigo', cod);
    if (delError) throw delError;

    const { error: insError } = await sb.from('stock').insert({
      id_stock: crypto.randomUUID(),
      codigo: cod,
      cantidad: normalStock,
      stock_servicio: psStock,
      ubicacion,
      precio: price,
      precio_total: (normalStock + psStock) * price,
      fecha_control: new Date().toISOString().slice(0, 10),
    });
    if (insError) throw insError;

    const { error: upError } = await sb.from('repuestos').update({ proveedor: proveedores }).eq('codigo', cod);
    if (upError) throw upError;

    done++;
    console.log(cod.padEnd(16), 'Normal ' + String(normalStock).padStart(4), '| P/Servicio ' + String(psStock).padStart(4), '| Total ' + String(normalStock + psStock).padStart(4), '| ' + proveedores);
  }

  console.log('\nListo. ' + done + ' productos reconstruidos.');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
