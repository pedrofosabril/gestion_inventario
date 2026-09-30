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
 * Regla de negocio: para todos los productos del proveedor SULLAIR,
 * el código del producto ES el código de barras.
 * Devuelve el código de barras que corresponde usar (vacío si no aplica).
 */
export const autoBarcodeForItem = (input: {
  codigo?: string;
  proveedor?: string;
  codigoBarras?: string;
}): string => {
  if (isSullairProveedor(input.proveedor) && input.codigo) {
    return input.codigo.trim().toUpperCase();
  }
  return input.codigoBarras?.trim() || '';
};