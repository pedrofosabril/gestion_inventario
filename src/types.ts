export type ItemCategory = 
  | 'panol'
  | 'cajones_fluidos'
  | 'submicronicos'
  | 'rodamientos'
  | 'entrepiso'
  | 'importado'
  | 'repuestos_mv'
  | 'cajas';

export interface InventoryItem {
  id: string;
  codigo: string;
  proveedor: string;
  descripcion: string;
  stock: number;
  stockMinimo?: number;
  ubicacion: string; // e.g. "A", "B", "C", "C GRIS", "D", "E", "F", "G", "H", "I", "J", "CAJONES", "ESTANTE"
  categoria: ItemCategory;
  subcategoria?: string; // e.g. "Fluidos", "Cajones", "Estante A", "Mahle", "SKF", "MV-50"
  equivalencias?: string; // Códigos de equivalencias cruzadas (ej: LX1056, P550440, etc.)
  fechaRegistro: string;
  fechaUltimoMovimiento?: string; // Last movement or modification date
  precio: number;
  precioTotal: number;
  paraServicio?: number; // p/servicio
  porEncargo?: boolean; // True = Solicitado bajo pedido / por encargo (desactiva alertas de stock mínimo o faltante)
  factura?: string;
  notas?: string;
  codigoBarras?: string;
}

export type ActiveView = ItemCategory | 'all' | 'salidas' | 'ingresos' | 'administracion';

export interface SalidaItemEntry {
  id: string;
  codigo: string;
  descripcion: string;
  proveedor?: string;
  ubicacion?: string;
  cantidad: number;
  stockDisponible: number;
  stockRemanente: number;
  precioUnitario: number;
  precioTotal: number;
  categoria?: ItemCategory;
}

export interface SalidaGroupRecord {
  id: string;
  numeroSalida: number; // e.g. 1, 2, 3...
  numeroSalidaFormatted: string; // e.g. "Salida N° 1"
  fechaSalida: string; // YYYY-MM-DD
  horaSalida: string; // HH:MM
  retira: string; // Empleado que lo retiró
  esRemitoInterno: boolean; // true = Remito Interno, false = Remito Cliente
  cliente: string; // Destino / Cliente / Obra
  nroRemito: string; // Nº Remito o Presupuesto
  notas?: string;
  usuarioRegistro: string;
  items: SalidaItemEntry[];
  totalUnidades: number;
  totalValor: number;
  firmaDigital?: string;
  firmaFecha?: string;
  firmadoPor?: string;
}

export interface DevolucionItemEntry {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario?: number;
  ubicacion?: string;
  motivo?: string;
}

export interface DevolucionGroupRecord {
  id: string;
  numeroDevolucion: number; // e.g. 1, 2, 3...
  numeroDevolucionFormatted: string; // e.g. "Devolución N° 1"
  fechaDevolucion: string; // YYYY-MM-DD
  horaDevolucion: string; // HH:MM
  empleadoDevuelve: string; // Empleado que devuelve el material
  motivo?: string;
  notas?: string;
  usuarioRegistro: string;
  items: DevolucionItemEntry[];
  totalUnidades: number;
  totalValor: number;
  firmaDigital?: string;
  firmaFecha?: string;
  firmadoPor?: string;
}

export interface SalidaRecord {
  id: string;
  salidaGroupId?: string;
  numeroSalida?: number;
  numeroSalidaFormatted?: string;
  nroRemito: string; // Nº Presp./Remito
  codigo: string;
  descripcion: string;
  fechaSalida: string;
  horaSalida?: string;
  cliente: string;
  retira: string;
  cantidad: number;
  precioUnitario?: number;
  categoria?: ItemCategory;
  esTaller?: boolean;
  esRemitoInterno?: boolean;
  esDevuelto?: boolean;
  notas?: string;
  usuarioRegistro?: string;
}

export interface IngresoRecord {
  id: string;
  codigo: string;
  proveedor: string;
  descripcion: string;
  cantidad: number;
  fechaIngreso: string;
  factura: string;
  precioUnitario?: number;
  ubicacion?: string;
  categoria?: ItemCategory;
  usuarioRegistro?: string;
}

export type UserRole = 'administracion' | 'panolero' | 'ventas' | 'observador';

export interface UserAccount {
  id: string;
  username: string;
  nombre: string;
  rol: UserRole;
  password?: string;
}

export interface ImportPreviewRow {
  codigo: string;
  proveedor?: string;
  descripcion: string;
  stock: number;
  ubicacion?: string;
  precio?: number;
  categoria?: ItemCategory;
  subcategoria?: string;
  fechaRegistro?: string;
  porEncargo?: boolean;
  [key: string]: any;
}

export const PARAMETRIZED_OPERATORS: string[] = [
  'Yas',
  'Yasmin',
  'Valeria',
  'Matias',
  'Cristian',
  'Diego',
  'Hugo',
  'Juan',
  'Pedro',
  'Damian',
  'René',
  'Manuel',
  'Alejo',
  'Santino',
  'Maxi',
  'Maximiliano',
  'Santiago',
  'Chaco'
];

export const PARAMETRIZED_SUPPLIERS: string[] = [
  'AGCO PARTS',
  'AIRHORSE',
  'ATLAS',
  'ATLAS COPCO',
  'BALDWIN',
  'BAOCH',
  'BLUMAQ',
  'CAT',
  'CUMMINS',
  'CUMMINS-CUMMINS',
  'DARMET',
  'DONALDSON',
  'DRECAF',
  'ECHANIZ / ECHANIZE',
  'FAG',
  'FAMEL',
  'FARO',
  'FLEETGUARD',
  'GOLD FILTER',
  'HASTING',
  'HDQP',
  'HDQPGOLD FILTER',
  'IMP / IMPORTADO',
  'ITR - ITALIA',
  'JLG',
  'JOHN DEERE / JONH DEREEM',
  'KAESER',
  'KOYO',
  'LANSS',
  'LUBE FILTER',
  'LUMMUS',
  'M.BENZ',
  'MAHLE',
  'MANN',
  'MARENO',
  'MONZA',
  'MOTORLINE',
  'MV',
  'NTN',
  'ONAN',
  'PARKER',
  'PELLACANI',
  'PERTRAK',
  'PRIX',
  'PRO FILTER',
  'REPCENTER',
  'ROLLWAY',
  'SAKURA',
  'SCHNEIDER',
  'SCHROEDER',
  'SKF',
  'SKN',
  'SPICER OFFCNHJLGDARMET',
  'SULLAIR',
  'SULLAIR IMPORTADO',
  'SULLAIR P/SERVICIO',
  'TELEMECANIQUE',
  'TIMKEN',
  'TOYOTA',
  'TURBO FILTROS',
  'URB',
  'VENROL',
  'VOX',
  'WEG',
  'WEGA',
  'ZF',
  'ZKL',
  'ZVL'
];
