import {
  InventoryItem,
  SalidaGroupRecord,
  SalidaItemEntry,
  SalidaRecord,
  IngresoRecord,
  DevolucionGroupRecord,
  DevolucionItemEntry
} from '../types';
import type { MovimientoRow } from '../lib/supabase';

const norm = (v?: string | null): string => (v ?? '').trim();
const lower = (v?: string | null): string => norm(v).toLowerCase();

const stableHash = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const dateKey = (fecha?: string | null): string => norm(fecha).slice(0, 10);

const splitFecha = (fecha?: string | null): { date: string; time: string } => {
  const raw = norm(fecha);
  const date = raw.slice(0, 10);
  const t = raw.length > 10 ? raw.slice(11, 16) : '';
  return { date, time: /^\d{2}:\d{2}$/.test(t) ? t : '' };
};

const esRemitoReal = (r: MovimientoRow): boolean => {
  const c = norm(r.comprobante).toUpperCase();
  return c !== '' && c !== 'S/N';
};

const keyOfSalida = (r: MovimientoRow): string =>
  [lower(r.comprobante), lower(dateKey(r.fecha)), lower(r.cliente_proveedor), lower(r.retira_responsable)].join('|');

const keyOfFlat = (r: SalidaRecord): string =>
  ['n', lower(r.nroRemito), 'c', lower(r.codigo), 'q', r.cantidad, 'f', lower(r.fechaSalida), 'r', lower(r.retira), 'cl', lower(r.cliente)].join('|');

const keyOfIngreso = (r: IngresoRecord): string =>
  ['c', lower(r.codigo), 'q', r.cantidad, 'f', lower(r.fechaIngreso), 'p', lower(r.proveedor), 'ft', lower(r.factura)].join('|');

const keyOfDevolucion = (r: DevolucionGroupRecord): string =>
  ['f', lower(r.fechaDevolucion), 'e', lower(r.empleadoDevuelve), 'u', r.totalUnidades].join('|');

interface LocalState {
  salidas: SalidaRecord[];
  salidaGroups: SalidaGroupRecord[];
  ingresos: IngresoRecord[];
  devolucionGroups: DevolucionGroupRecord[];
}

interface MergedState extends LocalState {}

/**
 * Reconstruye el historial local a partir de los movimientos compartidos en Supabase,
 * fusionándolos con lo que ya existe en este dispositivo (dedup por contenido/ID).
 * Mantiene invariantes: los grupos reconstruidos suman sus propios registros planos,
 * cada registro se numera para no pisar los números locales.
 */
export function mergeRemoteMovements(
  rows: MovimientoRow[],
  items: InventoryItem[],
  local: LocalState
): MergedState {
  if (!rows || rows.length === 0) return local;

  const byCode = new Map<string, InventoryItem>();
  for (const item of items) byCode.set(item.codigo.toUpperCase(), item);

  const localFlatKeys = new Set(local.salidas.map(keyOfFlat));
  const localGroupKeys = new Set(
    local.salidaGroups.map(g =>
      ['g', lower(g.nroRemito), lower(g.fechaSalida), lower(g.retira), lower(g.cliente)].join('|')
    )
  );
  const localIngresoKeys = new Set(local.ingresos.map(keyOfIngreso));
  const localDevKeys = new Set(local.devolucionGroups.map(keyOfDevolucion));
  const localGroupIds = new Set(local.salidaGroups.map(g => g.id));

  const newGroups: SalidaGroupRecord[] = [];
  const newFlats: SalidaRecord[] = [];
  const newIngresos: IngresoRecord[] = [];
  const newDevGroups: DevolucionGroupRecord[] = [];

  const salidaRows = rows.filter(r => r.tipo_movimiento === 'Salida' && r.codigo && (r.cantidad ?? 0) > 0);

  const grouped = new Map<string, MovimientoRow[]>();
  for (const r of salidaRows) {
    const key = esRemitoReal(r) ? `k:${keyOfSalida(r)}` : `row:${r.id_movimiento}`;
    const arr = grouped.get(key);
    if (arr) arr.push(r);
    else grouped.set(key, [r]);
  }

  const mkItem = (row: MovimientoRow): SalidaItemEntry => {
    const item = byCode.get(norm(row.codigo).toUpperCase());
    const precioUnitario = item?.precio ?? 0;
    const cantidad = row.cantidad ?? 0;
    const stockActual = item?.stock ?? 0;
    return {
      id: `it-${stableHash(row.id_movimiento)}`,
      codigo: norm(row.codigo),
      descripcion: item?.descripcion || norm(row.codigo),
      proveedor: item?.proveedor || '',
      ubicacion: item?.ubicacion || 'PAÑOL',
      cantidad,
      stockDisponible: stockActual,
      stockRemanente: stockActual - cantidad,
      precioUnitario,
      precioTotal: precioUnitario * cantidad,
      categoria: item?.categoria
    };
  };

  const mkFlat = (row: MovimientoRow, groupId: string, numero: number, formatted: string, esDevuelto: boolean): SalidaRecord => {
    const item = byCode.get(norm(row.codigo).toUpperCase());
    const comp = norm(row.comprobante).toUpperCase();
    const isInt = comp.startsWith('INT-');
    return {
      id: `sv-${stableHash(`${groupId}|${lower(row.codigo)}|${row.cantidad}|${dateKey(row.fecha)}|${lower(row.retira_responsable)}|${lower(row.cliente_proveedor)}`)}`,
      salidaGroupId: groupId,
      numeroSalida: numero,
      numeroSalidaFormatted: formatted,
      nroRemito: norm(row.comprobante) || 'S/N',
      codigo: norm(row.codigo),
      descripcion: item?.descripcion || norm(row.codigo),
      fechaSalida: splitFecha(row.fecha).date,
      horaSalida: splitFecha(row.fecha).time,
      cliente: norm(row.cliente_proveedor) || 'Verdu y Cía (General)',
      retira: norm(row.retira_responsable),
      cantidad: row.cantidad ?? 0,
      precioUnitario: item?.precio ?? 0,
      categoria: item?.categoria,
      esTaller: isInt,
      esRemitoInterno: isInt,
      esDevuelto,
      usuarioRegistro: norm(row.retira_responsable) || 'Pañol'
    };
  };

  for (const [key, groupRows] of grouped) {
    const isInt = esRemitoReal(groupRows[0]) && norm(groupRows[0].comprobante).toUpperCase().startsWith('INT-');
    const groupId = key.startsWith('k:')
      ? `sg-${stableHash(key)}`
      : `sg-${groupRows[0].id_movimiento}`;
    if (localGroupIds.has(groupId)) continue;

    const groupKeyStr = ['g', lower(groupRows[0].comprobante), dateKey(groupRows[0].fecha), lower(groupRows[0].retira_responsable), lower(groupRows[0].cliente_proveedor)].join('|');
    if (localGroupKeys.has(groupKeyStr)) continue;

    const itemsList = groupRows.map(mkItem);
    const totalUnidades = itemsList.reduce((acc, it) => acc + it.cantidad, 0);
    const totalValor = itemsList.reduce((acc, it) => acc + (it.precioTotal ?? 0), 0);

    newGroups.push({
      id: groupId,
      numeroSalida: 0,
      numeroSalidaFormatted: '',
      fechaSalida: dateKey(groupRows[0].fecha),
      horaSalida: splitFecha(groupRows[0].fecha).time,
      retira: norm(groupRows[0].retira_responsable),
      esRemitoInterno: isInt,
      cliente: norm(groupRows[0].cliente_proveedor) || (isInt ? 'Taller Interno / Flota Propia' : 'Cliente Externo'),
      nroRemito: norm(groupRows[0].comprobante) || 'S/N',
      notas: '',
      usuarioRegistro: norm(groupRows[0].retira_responsable) || 'Pañol',
      items: itemsList,
      totalUnidades,
      totalValor
    });

    for (const row of groupRows) {
      const flat = mkFlat(row, groupId, 0, '', false);
      if (!localFlatKeys.has(keyOfFlat(flat))) newFlats.push(flat);
    }
  }

  const devRows = rows.filter(r => r.tipo_movimiento === 'Devolucion' && r.codigo && (r.cantidad ?? 0) > 0);
  const devGroups = new Map<string, MovimientoRow[]>();
  for (const r of devRows) {
    if (!norm(r.comprobante).toUpperCase().startsWith('DEV-')) continue;
    const key = `d:${lower(r.comprobante)}|${dateKey(r.fecha)}|${lower(r.retira_responsable)}`;
    const arr = devGroups.get(key);
    if (arr) arr.push(r);
    else devGroups.set(key, [r]);
  }
  for (const [key, groupRows] of devGroups) {
    const itemsList: DevolucionItemEntry[] = groupRows.map(row => {
      const item = byCode.get(norm(row.codigo).toUpperCase());
      return {
        codigo: norm(row.codigo),
        descripcion: item?.descripcion || norm(row.codigo),
        cantidad: row.cantidad ?? 0,
        precioUnitario: item?.precio ?? 0,
        ubicacion: item?.ubicacion || 'PAÑOL',
        motivo: ''
      };
    });
    const totalUnidades = itemsList.reduce((acc, it) => acc + it.cantidad, 0);
    const totalValor = itemsList.reduce((acc, it) => acc + (it.precioUnitario ?? 0) * it.cantidad, 0);
    const devGroup: DevolucionGroupRecord = {
      id: `dv-${stableHash(key)}`,
      numeroDevolucion: 0,
      numeroDevolucionFormatted: '',
      fechaDevolucion: dateKey(groupRows[0].fecha),
      horaDevolucion: splitFecha(groupRows[0].fecha).time,
      empleadoDevuelve: norm(groupRows[0].retira_responsable) || 'Pañol',
      motivo: '',
      notas: '',
      usuarioRegistro: 'Pañol',
      items: itemsList,
      totalUnidades,
      totalValor
    };
    if (localDevKeys.has(keyOfDevolucion(devGroup))) continue;
    newDevGroups.push(devGroup);
  }

  const esDevueltoRows = devRows.filter(r => !norm(r.comprobante).toUpperCase().startsWith('DEV-'));
  if (esDevueltoRows.length > 0) {
    const esDevGroup = new Map<string, MovimientoRow[]>();
    for (const r of esDevueltoRows) {
      const key = `ed:${keyOfSalida(r)}`;
      const arr = esDevGroup.get(key);
      if (arr) arr.push(r);
      else esDevGroup.set(key, [r]);
    }
    for (const [key, groupRows] of esDevGroup) {
      const groupId = `sg-${stableHash(`ed|${key}`)}`;
      for (const row of groupRows) {
        const flat = mkFlat(row, groupId, 0, '', true);
        if (!localFlatKeys.has(keyOfFlat(flat))) newFlats.push(flat);
      }
    }
  }

  const ingRows = rows.filter(r => r.tipo_movimiento === 'Ingreso' && r.codigo && (r.cantidad ?? 0) > 0);
  for (const row of ingRows) {
    const item = byCode.get(norm(row.codigo).toUpperCase());
    const ingreso: IngresoRecord = {
      id: `sv-ing-${stableHash(`${lower(row.codigo)}|${row.cantidad}|${dateKey(row.fecha)}|${lower(row.cliente_proveedor)}|${lower(row.comprobante)}`)}`,
      codigo: norm(row.codigo),
      descripcion: item?.descripcion || norm(row.codigo),
      cantidad: row.cantidad ?? 0,
      fechaIngreso: splitFecha(row.fecha).date,
      horaIngreso: splitFecha(row.fecha).time,
      proveedor: norm(row.cliente_proveedor) || 'Proveedor',
      factura: norm(row.comprobante),
      precioUnitario: item?.precio ?? 0,
      ubicacion: item?.ubicacion || 'PAÑOL',
      categoria: item?.categoria,
      usuarioRegistro: norm(row.retira_responsable) || 'Pañol'
    };
    if (!localIngresoKeys.has(keyOfIngreso(ingreso))) newIngresos.push(ingreso);
  }

  const startSalNum = Math.max(0, ...local.salidaGroups.map(g => g.numeroSalida || 0));
  const newGroupsAsc = newGroups.slice().sort((a, b) => (a.fechaSalida || '').localeCompare(b.fechaSalida || ''));
  newGroupsAsc.forEach((g, i) => {
    const n = startSalNum + i + 1;
    g.numeroSalida = n;
    g.numeroSalidaFormatted = `Salida N° ${n}`;
  });
  const groupByFlatId = new Map<string, number>();
  for (const g of newGroups) {
    for (const item of g.items) {
      groupByFlatId.set(`${g.id}|${item.codigo}|${item.cantidad}`, g.numeroSalida);
    }
  }
  for (const flat of newFlats) {
    const numero = groupByFlatId.get(`${flat.salidaGroupId}|${flat.codigo}|${flat.cantidad}`);
    flat.numeroSalida = numero ?? 0;
    flat.numeroSalidaFormatted = numero ? `Salida N° ${numero}` : '';
  }

  const startDevNum = Math.max(0, ...local.devolucionGroups.map(g => g.numeroDevolucion || 0));
  const newDevAsc = newDevGroups.slice().sort((a, b) => (a.fechaDevolucion || '').localeCompare(b.fechaDevolucion || ''));
  newDevAsc.forEach((g, i) => {
    const n = startDevNum + i + 1;
    g.numeroDevolucion = n;
    g.numeroDevolucionFormatted = `Devolución N° ${n}`;
  });

  const sortedNewGroups = newGroups.slice().sort((a, b) => (b.fechaSalida || '').localeCompare(a.fechaSalida || ''));
  const sortedNewDevoluciones = newDevGroups.slice().sort((a, b) => (b.fechaDevolucion || '').localeCompare(a.fechaDevolucion || ''));

  return {
    salidas: [...newFlats, ...local.salidas],
    salidaGroups: [...sortedNewGroups, ...local.salidaGroups],
    ingresos: [...newIngresos, ...local.ingresos],
    devolucionGroups: [...sortedNewDevoluciones, ...local.devolucionGroups]
  };
}