const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx === -1) continue;
  env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function count(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count;
}

const mode = process.argv[2] || 'count';
const file = process.argv[3];

(async () => {
  if (mode === 'count') {
    const repuestos = await count('repuestos');
    const stock = await count('stock');
    const movimientos = await count('movimientos');
    console.log(`FILAS -> repuestos: ${repuestos} | stock: ${stock} | movimientos: ${movimientos}`);
    return;
  }

  if (mode === 'restore') {
    if (!file) throw new Error('falta archivo snapshot: node db-admin.cjs restore <snapshot.json>');
    const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
    const { db } = snapshot;
    if (!db) throw new Error('el snapshot no tiene sección db');

    for (const [table, rows] of Object.entries(db)) {
      if (!Array.isArray(rows) || rows.length === 0) { console.log(table + ': (vacío)'); continue; }
      const pks = {
        repuestos: 'codigo',
        stock: 'id_stock',
        movimientos: 'id_movimiento',
      };
      const pk = pks[table];
      let ok = 0;
      let err = 0;
      for (let i = 0; i < rows.length; i += 1000) {
        const batch = rows.slice(i, i + 1000);
        const { error } = await supabase.from(table).upsert(batch, { onConflict: pk });
        if (error) { err++; console.error(`  ${table} lote ${i}:`, error.message); }
        else ok += batch.length;
      }
      console.log(`${table}: restauradas ${ok} filas${err ? ' (' + err + ' lotes con error)' : ''}`);
    }
    console.log('RESTAURACIÓN FINALIZADA');
    return;
  }

  throw new Error('modo desconocido: ' + mode);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });