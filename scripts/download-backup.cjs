const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchAllRows(table, columns) {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const numberOf = (v) => Number(v ?? 0);

(async () => {
  const [repuestos, stock, movimientos] = await Promise.all([
    fetchAllRows('repuestos', '*'),
    fetchAllRows('stock', '*'),
    fetchAllRows('movimientos', '*'),
  ]);

  const latest = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${latest.getFullYear()}${pad(latest.getMonth() + 1)}${pad(latest.getDate())}_${pad(latest.getHours())}${pad(latest.getMinutes())}${pad(latest.getSeconds())}`;

  const stockByCode = new Map();
  for (const row of stock) {
    const list = stockByCode.get(row.codigo) ?? [];
    list.push(row);
    stockByCode.set(row.codigo, list);
  }

  const items = repuestos.map((r) => {
    const rows = stockByCode.get(r.codigo) ?? [];
    const quantity = rows.reduce((s, row) => s + numberOf(row.cantidad), 0);
    const paraServicio = rows.reduce((s, row) => s + numberOf(row.stock_servicio), 0);
    const price = rows.find((row) => numberOf(row.precio) > 0)?.precio ?? r.precio;
    const latestControl = rows.map((row) => row.fecha_control).filter(Boolean).sort().at(-1);
    return {
      codigo: r.codigo,
      proveedor: r.proveedor ?? '',
      descripcion: r.descripcion ?? '',
      equivalencias: r.equivalencias ?? undefined,
      subcategoria: r.uso_destino ?? undefined,
      stock: quantity,
      stockMinimo: 0,
      paraServicio: paraServicio || undefined,
      ubicacion: rows.map((row) => row.ubicacion).filter(Boolean).join(' / '),
      fechaRegistro: latestControl ?? new Date().toISOString().slice(0, 10),
      precio: numberOf(price),
      precioTotal: quantity * numberOf(price),
      porEncargo: rows.length === 0 || undefined,
      codigoBarras: r.barra ?? undefined,
    };
  });

  const backup = {
    app: 'Verdu y Cía - Gestión de Pañol',
    tipo: 'Snapshot Supabase (seguridad)',
    generadoPor: 'script download-backup.cjs',
    generadoEl: latest.toLocaleString('es-AR'),
    timestamp: latest.toISOString(),
    colecciones: {
      items,
    },
    db: {
      repuestos,
      stock,
      movimientos,
    },
  };

  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `Respaldo_Supabase_Verdu_${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log('SNAPSHOT OK ->', file);
  console.log(`  repuestos: ${repuestos.length} | stock: ${stock.length} | movimientos: ${movimientos.length} | items(derivados): ${items.length}`);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });