export const isSullairProveedor = (proveedor?: string): boolean => {
  const p = (proveedor || '').trim().toUpperCase();
  return p === 'SULLAIR' || p.includes('SULLAIR');
};

/**
 * Proveedores que indican una variante de repuesto reservada para servicio técnico
 * (p.ej. "P/SERVICIO"), distinta de la variante de venta normal (p.ej. "SULLAIR").
 */
export const isPServicioProveedor = (proveedor?: string): boolean => {
  const p = (proveedor || '').trim().toUpperCase();
  return /P\s*\.?\s*\/?\s*SERVICIO|PARA SERVICIO|PSERVICIO|^SERVICIO$/.test(p);
};

/**
 * Regla de negocio: TODO producto debe tener código de barras. Si el producto ya
 * tiene uno vinculado (escaneado a mano), se respeta; si no, se usa el código del
 * producto (su id) como código de barras.
 * Devuelve el código de barras que corresponde usar (vacío solo si no hay código).
 */
export const autoBarcodeForItem = (input: {
  codigo?: string;
  proveedor?: string;
  codigoBarras?: string;
}): string => {
  const existing = input.codigoBarras?.trim();
  if (existing) return existing;
  return input.codigo?.trim() || '';
};