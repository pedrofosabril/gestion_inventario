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

/**
 * Un producto con varias ubicaciones pertenece a más de una sección.
 * Ej: un ítem con ubicación "A / entrepiso" está en el Pañol (es su
 * categoría) pero además se lo tiene que encontrar en la sección Entrepiso.
 */
const CATEGORY_UBIC_ALIASES: Record<string, string[]> = {
  panol: ['panol', 'pañol'],
  entrepiso: ['entrepiso', 'entre piso', 'entrepiso_panol'],
  submicronicos: ['submicronico', 'submicronicos'],
  cajones_fluidos: ['cajon', 'cajones', 'fluido', 'fluidos', 'aceite'],
  rodamientos: ['rodamiento', 'rodamientos', 'skf', 'timken'],
  repuestos_mv: ['mv', 'repuesto mv', 'repuestos mv'],
  cajas: ['caja', 'cajas'],
};

export function matchesCategoryByUbicacion(
  ubicacion: string | undefined,
  category: string
): boolean {
  const aliases = CATEGORY_UBIC_ALIASES[category];
  if (!aliases) return false;
  const tokens = splitUbicaciones(ubicacion).map(u => u.toLowerCase());
  return tokens.some(t => aliases.some(a => t === a || t.includes(a)));
}

/** ¿El producto pertenece a la sección indicada (por categoría o por ubicación)? */
export function itemInCategory(
  item: { categoria?: string; ubicacion?: string | null },
  category: string
): boolean {
  if (category === 'all') return true;
  if (item.categoria === category) return true;
  return matchesCategoryByUbicacion(item.ubicacion, category);
}