import { createClient } from '@supabase/supabase-js';
import { InventoryItem, ItemCategory } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisá el archivo .env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type RepuestoRow = {
  codigo: string;
  proveedor: string | null;
  descripcion: string | null;
  equivalencias: string | null;
  uso_destino: string | null;
  precio: number | string | null;
};

type StockRow = {
  id_stock: string;
  codigo: string;
  cantidad: number | string | null;
  ubicacion: string | null;
  precio: number | string | null;
  fecha_control: string | null;
};

const numberOf = (value: number | string | null | undefined) => Number(value ?? 0);

const categoryOf = (value: string | null): ItemCategory => {
  const categories: ItemCategory[] = ['panol', 'cajones_fluidos', 'submicronicos', 'rodamientos', 'entrepiso', 'importado', 'repuestos_mv', 'cajas'];
  return categories.includes(value as ItemCategory) ? value as ItemCategory : 'panol';
};

/** Reads the existing Supabase tables and maps them to the application model. */
export async function getInventory(): Promise<InventoryItem[]> {
  const [{ data: repuestos, error: repuestosError }, { data: stock, error: stockError }] = await Promise.all([
    supabase.from('repuestos').select('codigo, proveedor, descripcion, equivalencias, uso_destino, precio'),
    supabase.from('stock').select('id_stock, codigo, cantidad, ubicacion, precio, fecha_control')
  ]);
  if (repuestosError) throw repuestosError;
  if (stockError) throw stockError;

  const stockByCode = new Map<string, StockRow[]>();
  for (const row of (stock ?? []) as StockRow[]) {
    const rows = stockByCode.get(row.codigo) ?? [];
    rows.push(row);
    stockByCode.set(row.codigo, rows);
  }

  return ((repuestos ?? []) as RepuestoRow[]).map(repuesto => {
    const rows = stockByCode.get(repuesto.codigo) ?? [];
    const quantity = rows.reduce((sum, row) => sum + numberOf(row.cantidad), 0);
    const price = rows.find(row => numberOf(row.precio) > 0)?.precio ?? repuesto.precio;
    const latestControl = rows.map(row => row.fecha_control).filter(Boolean).sort().at(-1);
    return {
      id: repuesto.codigo, codigo: repuesto.codigo, proveedor: repuesto.proveedor ?? '',
      descripcion: repuesto.descripcion ?? '', equivalencias: repuesto.equivalencias ?? undefined,
      subcategoria: repuesto.uso_destino ?? undefined, categoria: categoryOf(repuesto.uso_destino),
      stock: quantity, stockMinimo: 0, ubicacion: rows.map(row => row.ubicacion).filter(Boolean).join(' / '),
      fechaRegistro: latestControl ?? new Date().toISOString().slice(0, 10),
      fechaUltimoMovimiento: latestControl ?? undefined, precio: numberOf(price), precioTotal: quantity * numberOf(price)
    };
  });
}

export async function saveInventoryItem(item: InventoryItem): Promise<void> {
  const { error: repuestoError } = await supabase.from('repuestos').upsert({
    codigo: item.codigo,
    proveedor: item.proveedor,
    descripcion: item.descripcion,
    equivalencias: item.equivalencias ?? null,
    uso_destino: item.subcategoria ?? null,
    precio: item.precio
  }, { onConflict: 'codigo' });
  if (repuestoError) throw repuestoError;

  const { data: existing, error: existingError } = await supabase
    .from('stock').select('id_stock').eq('codigo', item.codigo).limit(1).maybeSingle();
  if (existingError) throw existingError;

  const { error: stockError } = await supabase.from('stock').upsert({
    id_stock: existing?.id_stock ?? crypto.randomUUID(),
    codigo: item.codigo,
    cantidad: item.stock,
    ubicacion: item.ubicacion,
    precio: item.precio,
    precio_total: item.stock * item.precio,
    fecha_control: new Date().toISOString().slice(0, 10)
  }, { onConflict: 'id_stock' });
  if (stockError) throw stockError;
}

export async function deleteInventoryItem(codigo: string): Promise<void> {
  const { error: stockError } = await supabase.from('stock').delete().eq('codigo', codigo);
  if (stockError) throw stockError;
  const { error: repuestoError } = await supabase.from('repuestos').delete().eq('codigo', codigo);
  if (repuestoError) throw repuestoError;
}

export async function createMovement(input: {
  tipo: 'Ingreso' | 'Salida' | 'Devolucion'; codigo: string; cantidad: number;
  comprobante?: string; clienteProveedor?: string; responsable?: string;
}): Promise<void> {
  const { error } = await supabase.from('movimientos').insert({
    id_movimiento: crypto.randomUUID(), tipo_movimiento: input.tipo, codigo: input.codigo,
    cantidad: input.cantidad, fecha: new Date().toISOString().slice(0, 10),
    comprobante: input.comprobante ?? '', cliente_proveedor: input.clienteProveedor ?? '',
    retira_responsable: input.responsable ?? ''
  });
  if (error) throw error;
}
