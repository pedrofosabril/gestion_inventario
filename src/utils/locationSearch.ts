/**
 * Un producto puede tener más de una ubicación. Al fusionar duplicados por
 * código, las ubicaciones quedan combinadas en un solo texto separado por
 * "/" (ej. "A / entrepiso").
 *
 * Estas funciones permiten que:
 *   - la búsqueda encuentre el producto escribiendo cualquiera de sus
 *     ubicaciones (ej. buscar "entrepiso" trae lo que está en "A / entrepiso"),
 *   - el filtro por ubicación offerca cada ubicación por separado en lugar de
 *     mostrar el texto combinado.
 */

const SEPARADORES = /[\/,;|]+/;

export function splitUbicaciones(ubicacion?: string | null): string[] {
  if (!ubicacion) return [];
  return ubicacion
    .split(SEPARADORES)
    .map(u => u.trim())
    .filter(Boolean);
}

/** Todas las ubicaciones existentes en una lista de productos, sin repetir. */
export function collectUbicaciones(items: { ubicacion?: string | null }[]): string[] {
  const set = new Set<string>();
  items.forEach(i => splitUbicaciones(i.ubicacion).forEach(u => set.add(u)));
  return Array.from(set).sort();
}

/**
 * ¿El texto buscado coincide con alguna de las ubicaciones del producto?
 * Se comparan las ubicaciones por separado para que "entrepiso" encuentre
 * "A / entrepiso". Las búsquedas de 1 o 2 letras se ignoran para no
 * devolver casi todo el inventario (ej. "A").
 */
export function matchesUbicacion(ubicacion: string | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return false;
  return splitUbicaciones(ubicacion).some(
    u => u.toLowerCase() === q || u.toLowerCase().includes(q)
  );
}