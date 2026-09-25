import { InventoryItem } from '../types';
import { isPServicioProveedor } from './barcodeUtils';

/**
 * Productos "duales": el mismo código de repuesto puede existir como variante
 * P/SERVICIO (proveedor "P/SERVICIO") y como variante de venta (p.ej. "SULLAIR").
 * Ej: "02250105-553" de P/SERVICIO y "02250105-553" de SULLAIR.
 *
 * Estas variantes deben mostrarse como UN solo producto, distinguiendo:
 *   - stock (Stock normal / venta)
 *   - paraServicio (Stock p/servicio)
 *
 * Solo se fusionan lotes del mismo código que contengan ambas naturalezas
 * (P/SERVICIO y venta); los grupos de un solo tipo se conservan tal cual
 * (por ejemplo, los splits del CATEGORY_MAP que comparten código).
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
    if (bucket.length === 1) {
      result.push(bucket[0]);
      continue;
    }

    const hasPS = bucket.some(i => isPServicioProveedor(i.proveedor));
    const hasNormal = bucket.some(i => !isPServicioProveedor(i.proveedor));

    if (!hasPS || !hasNormal) {
      result.push(...bucket);
      continue;
    }

    // Mezcla P/SERVICIO + venta para el mismo código → fusionar en un solo producto.
    const normalItems = bucket.filter(i => !isPServicioProveedor(i.proveedor));
    const pservicioItems = bucket.filter(i => isPServicioProveedor(i.proveedor));

    const base: InventoryItem = {
      ...normalItems[0],
      stock: normalItems.reduce((sum, i) => sum + (i.stock || 0), 0),
      paraServicio:
        normalItems.reduce((sum, i) => sum + (i.paraServicio || 0), 0) +
        pservicioItems.reduce((sum, i) => sum + (i.stock || 0), 0),
    };

    const ubicSet = new Set<string>();
    [...normalItems, ...pservicioItems].forEach(i => {
      if (i.ubicacion) ubicSet.add(i.ubicacion);
    });
    if (ubicSet.size > 0) base.ubicacion = [...ubicSet].join(' / ');

    if (!base.porEncargo && base.stock > 0) base.porEncargo = undefined;

    result.push(base);
  }

  return result;
}