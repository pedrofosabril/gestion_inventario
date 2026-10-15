/**
 * Limpieza de códigos de producto tal como llegan desde el Excel.
 *
 * La planilla suele anteponer apóstrofes (`'`), acentos (`´`), backticks (`` ` ``)
 * u otros símbolos (`º`, `$`, `*`, `#`) delante del número (por ejemplo "´042582").
 * El sistema guardaba ese prefijo, de modo que al escanear "042582" el producto no
 * aparecía. Esta función quita esos prefijos para que el código coincida con lo que
 * lee el escáner.
 *
 * NO se quitan letras: códigos como "AF25969" o "001078RA" se conservan enteros.
 */
export function normalizeCodigo(value: unknown): string {
  let s = String(value ?? '').trim();
  if (!s) return '';

  // Apóstrofes, comillas y acentos que Excel agrega para forzar el formato texto.
  s = s.replace(/^[\s'`´’‘"“”]+/, '');

  // Cualquier símbolo o espacio antes del primer dígito (º, $, *, #, etc.).
  s = s.replace(/^[^0-9A-Za-z]+(?=[0-9])/, '');

  // Apóstrofes internos sueltos: nunca forman parte del código real.
  s = s.replace(/['`´’]/g, '');

  return s.trim();
}
