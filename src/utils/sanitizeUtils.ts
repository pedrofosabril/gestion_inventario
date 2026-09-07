/**
 * Utility to ensure 'yaz' is NEVER written with Z anywhere in the application,
 * converting 'z' to 's' across all case variations ('Yaz' -> 'Yas', 'YAZ' -> 'YAS', 'yaz' -> 'yas').
 */

export function replaceYazWithYas(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return (text as unknown as string) || '';
  return text
    .replace(/YAZ/g, 'YAS')
    .replace(/Yaz/g, 'Yas')
    .replace(/yaz/g, 'yas')
    .replace(/[Yy][Aa][Zz]/g, (match) => {
      const chars = match.split('');
      const isZUpper = chars[2] === 'Z';
      chars[2] = isZUpper ? 'S' : 's';
      return chars.join('');
    });
}

export function sanitizeYazObject<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    return replaceYazWithYas(data) as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeYazObject(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const copy: any = {};
    for (const key of Object.keys(data as any)) {
      copy[key] = sanitizeYazObject((data as any)[key]);
    }
    return copy;
  }
  return data;
}
