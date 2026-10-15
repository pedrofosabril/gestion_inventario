import { InventoryItem } from '../types';
import { isPServicioProveedor } from './barcodeUtils';

/**
 * El mismo código de repuesto puede aparecer como variante P/SERVICIO
 * (proveedor "P/SERVICIO") y como variante de venta (p.ej. "SULLAIR"),
 * e incluso repetirse con distintas ubicaciones o registros incompletos.
 *
 * Para que NO haya duplicados en ninguna parte del sistema, cualquier grupo
 * de ítems con el MISMO código se fusiona en UN solo producto, quedando:
 *   - stock        → Stock original (suma de filas de venta)
 *   - paraServicio → Stock p/servicio (suma de filas P/SERVICIO + propio)
 *
 * Las filas "cascarón" (solo código, sin ninguna otra información y sin
 * cantidades) se descartan para que no aparezcan productos vacíos.
 */
export function mergeSameProductPairs(items: InventoryItem[]): InventoryItem[] {
  const byCode = new Map<string, InventoryItem[]>();

  for (const item of items) {
    const key = (item.codigo || '').trim().toLowerCase();
    if (!key) continue;
    const bucket = byCode.get(key) ?? [];
    bucket.push(item);
    byCode.set(key, bucket);
  }

  const result: InventoryItem[] = [];

  for (const bucket of byCode.values()) {
    const merged = mergeBucket(bucket);
    if (merged) result.push(merged);
  }

  return result;
}

/** Puntúa cuánta información útil tiene un ítem (para elegir el "base" del merge). */
function infoScore(item: InventoryItem): number {
  let score = 0;
  const desc = (item.descripcion || '').trim();
  if (desc && desc.toLowerCase() !== (item.codigo || '').toLowerCase()) score += 4;
  if ((item.proveedor || '').trim()) score += 2;
  if ((item.codigoBarras || '').trim()) score += 2;
  if ((item.ubicacion || '').trim()) score += 1;
  if ((item.equivalencias || '').trim() && item.equivalencias !== '-') score += 1;
  return score;
}

function mergeBucket(bucket: InventoryItem[]): InventoryItem | null {
  const isPS = (x: InventoryItem) => isPServicioProveedor(x.proveedor);
  const normalItems = bucket.filter(x => !isPS(x));
  const pservicioItems = bucket.filter(x => isPS(x));

  const stock =
    normalItems.reduce((sum, i) => sum + (i.stock || 0), 0);
  const paraServicio =
    normalItems.reduce((sum, i) => sum + (i.paraServicio || 0), 0) +
    pservicioItems.reduce((sum, i) => sum + (i.stock || 0), 0);

  const hasInfo = bucket.some(x => infoScore(x) > 0);

  if (!hasInfo) {
    // Sólo existen filas "cascarón" (código puro, sin información).
    // Si no tienen cantidades, no se muestran.
    if (stock === 0 && paraServicio === 0) return null;
    const first = bucket[0];
    return {
      ...first,
      codigo: first.codigo,
      descripcion: 'Artículo sin descripción',
      stock,
      paraServicio: paraServicio || undefined,
      precioTotal: stock * (first.precio || 0)
    };
  }

  // Base: la fila más completa, priorizando las de venta.
  const candidates = normalItems.length > 0 ? normalItems : bucket;
  let base = candidates[0];
  for (const x of candidates) {
    if (infoScore(x) > infoScore(base)) base = x;
  }

  const merged: InventoryItem = {
    ...base,
    codigo: bucket[0].codigo,
    stock,
    paraServicio: paraServicio || undefined,
    precioTotal: stock * (base.precio || 0)
  };

  // Completar datos faltantes con los hermanos del bucket.
  for (const x of bucket) {
    if (x === base) continue;
    const desc = (x.descripcion || '').trim();
    if (
      (!merged.descripcion || merged.descripcion === merged.codigo || merged.descripcion === 'Artículo sin descripción') &&
      desc && desc.toLowerCase() !== (x.codigo || '').toLowerCase()
    ) {
      merged.descripcion = x.descripcion;
    }
    if (!merged.codigoBarras && x.codigoBarras) merged.codigoBarras = x.codigoBarras;
    if (!merged.equivalencias && x.equivalencias && x.equivalencias !== '-') merged.equivalencias = x.equivalencias;
    if (!merged.proveedor && x.proveedor) merged.proveedor = x.proveedor;
  }

  if (!merged.descripcion || merged.descripcion === merged.codigo) {
    merged.descripcion = 'Artículo sin descripción';
  }

  // Combinar ubicaciones en un solo valor.
  const ubicSet = new Set<string>();
  bucket.forEach(i => {
    const u = (i.ubicacion || '').trim();
    if (u) ubicSet.add(u);
  });
  if (ubicSet.size > 0) merged.ubicacion = [...ubicSet].join(' / ');

  if (!merged.porEncargo && merged.stock > 0) merged.porEncargo = undefined;

  return merged;
}