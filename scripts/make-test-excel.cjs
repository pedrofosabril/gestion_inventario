const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const out = path.join(__dirname, 'test-assets', 'test_import.xlsx');
fs.mkdirSync(path.dirname(out), { recursive: true });

const rows = [
  { 'CÓDIGO': 'TEST-001', 'PROVEEDOR': 'SULLAIR', 'DESCRIPCIÓN': 'Repuesto de prueba uno', 'STOCK': 10, 'P/SERVICIO': 2, 'PRECIO UNITARIO': 500, 'UBICACIÓN': 'T-01' },
  { 'CÓDIGO': 'TEST-002', 'PROVEEDOR': 'SULLAIR', 'DESCRIPCIÓN': 'Repuesto de prueba dos', 'STOCK': 4, 'P/SERVICIO': 1, 'PRECIO UNITARIO': 1200.5, 'UBICACIÓN': 'T-02' },
  { 'CÓDIGO': 'TEST-003', 'PROVEEDOR': 'SKF', 'DESCRIPCIÓN': 'Rodamiento de prueba 6205', 'STOCK': 0, 'PRECIO UNITARIO': 300, 'UBICACIÓN': 'T-03' },
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, 'TEST');
XLSX.writeFile(wb, out);
console.log('TEST EXCEL OK ->', out);