import csv
import json
from collections import defaultdict

def clean_code(c):
    if not c:
        return ''
    c = c.strip()
    while c and c[0] in ("'", '"', '´', '`'):
        c = c[1:].strip()
    while c and c[-1] in ("'", '"', '´', '`'):
        c = c[:-1].strip()
    return c

def parse_float(val):
    if not val:
        return 0.0
    val = str(val).replace('$', '').replace(' ', '').strip()
    if not val or val == '-' or val == '#VALUE!':
        return 0.0
    if '.' in val and ',' in val:
        val = val.replace('.', '').replace(',', '.')
    elif ',' in val:
        val = val.replace(',', '.')
    try:
        return float(val)
    except:
        return 0.0

def parse_int(val):
    try:
        return int(float(val))
    except:
        return 0

# 1. Load repuestos.csv
repuestos = {}
rep_list = []
with open('repuestos.csv', 'r', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        c = clean_code(r['codigo'])
        if not c:
            continue
        item = {
            'codigo': c,
            'descripcion': r['descripcion'].strip(),
            'proveedor': r['proveedor'].strip(),
            'equivalencias': r['equivalencias'].strip(),
            'precio': parse_float(r['precio']),
            'uso_destino': r['uso_destino'].strip()
        }
        repuestos[c] = item
        rep_list.append(item)

# 2. Load stock.csv
# Some codes appear more than once in stock.csv
stock_by_code = defaultdict(list)
with open('stock.csv', 'r', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        c = clean_code(r['codigo'])
        if not c:
            continue
        stock_by_code[c].append({
            'id_stock': r['id_stock'].strip(),
            'cantidad': parse_int(r['cantidad']),
            'ubicacion': r['ubicacion'].strip(),
            'precio': parse_float(r['precio']),
            'precio_total': parse_float(r['precio_total']),
            'fecha_control': r['fecha_control'].strip()
        })

print(f'Repuestos count: {len(repuestos)}')
print(f'Stock count: {len(stock_by_code)}')

# 3. Categorization logic
def determine_category(codigo, desc, prov, ubic):
    u = ubic.upper()
    d = desc.upper()
    p = prov.upper()

    # 1. Filtros Submicrónicos (Elementos filtrantes FXF, FXH, FXC, submicrónicos)
    if 'FXF' in d or 'FXH' in d or 'FXC' in d or 'SUBMIC' in d or codigo.startswith('02250193-') or codigo.startswith('02250195-'):
        return 'submicronicos'

    # 2. Rodamientos
    if 'RODAMIENTO' in u or 'RODAMIENTO' in d or 'SKF' in p or 'FAG' in p or 'TIMKEN' in p or 'NSK' in p:
        return 'rodamientos'

    # 3. Entrepiso
    if 'ENTREPISO' in u:
        return 'entrepiso'

    # 4. Repuestos MV
    if 'MV' in u or 'REPUESTOS MV' in p or 'MV-' in d or 'MV-' in codigo or 'M.V' in d:
        return 'repuestos_mv'

    # 5. Stock Importado
    if p == 'IMP' or 'IMPORTADO' in p:
        return 'importado'

    # 6. Cajas Estantes
    if 'CAJA' in u and 'CAJON' not in u:
        return 'cajas'

    # 7. Cajones y Fluidos
    if 'CAJON' in u or 'FLUIDO' in u or 'ESTANTE' in u or 'SULLUBE' in d or 'ACEITE' in d:
        return 'cajones_fluidos'

    # 8. Pañol General
    return 'panol'

# Build Inventory items
inventory_items = []
seen_codes = set()
item_idx = 1

# Process all repuestos first (they are the catalog)
for c, rep in repuestos.items():
    if c in seen_codes:
        continue
    seen_codes.add(c)

    stk_entries = stock_by_code.get(c, [])
    
    # Calculate stock and location
    total_stock = sum(s['cantidad'] for s in stk_entries)
    
    # Locations
    valid_locs = [s['ubicacion'] for s in stk_entries if s['ubicacion'] and s['ubicacion'] != '-']
    ubicacion = ' / '.join(sorted(list(set(valid_locs)))) if valid_locs else (stk_entries[0]['ubicacion'] if stk_entries else '-')
    if not ubicacion or ubicacion == '-':
        ubicacion = 'A' if total_stock > 0 else '-'

    # Price
    precio = rep['precio']
    if precio == 0 and stk_entries:
        stk_prices = [s['precio'] for s in stk_entries if s['precio'] > 0]
        if stk_prices:
            precio = stk_prices[0]
    
    precio_total = round(total_stock * precio, 2)

    # Date
    dates = [s['fecha_control'] for s in stk_entries if s['fecha_control']]
    fecha_reg = dates[0] if dates else '2026-05-21'

    cat = determine_category(c, rep['descripcion'], rep['proveedor'], ubicacion)

    inv_item = {
        'id': f'item-{item_idx}',
        'codigo': c,
        'proveedor': rep['proveedor'] or '-',
        'descripcion': rep['descripcion'] or c,
        'stock': total_stock,
        'stockMinimo': 1 if total_stock > 0 else 1,
        'ubicacion': ubicacion or '-',
        'categoria': cat,
        'equivalencias': rep['equivalencias'] or None,
        'fechaRegistro': fecha_reg,
        'fechaUltimoMovimiento': fecha_reg,
        'precio': precio,
        'precioTotal': precio_total,
        'porEncargo': total_stock == 0,
        'codigoBarras': c
    }
    if rep['uso_destino']:
        inv_item['notas'] = f"Destino: {rep['uso_destino']}"
    elif rep['equivalencias']:
        inv_item['notas'] = f"Equiv: {rep['equivalencias']}"

    # Clean nulls
    inv_item = {k: v for k, v in inv_item.items() if v is not None}
    inventory_items.append(inv_item)
    item_idx += 1

print(f'Total inventory items generated: {len(inventory_items)}')

# Load movimientos
movimientos = []
with open('movimiento.csv', 'r', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        c = clean_code(r['codigo'])
        movimientos.append({
            'id': r['id_movimiento'].strip(),
            'tipo': r['tipo_movimiento'].strip(),
            'codigo': c,
            'cantidad': parse_int(r['cantidad']),
            'fecha': r['fecha'].strip(),
            'comprobante': r['comprobante'].strip(),
            'cliente_proveedor': r['cliente_proveedor'].strip(),
            'retira_responsable': r['retira_responsable'].strip()
        })

print(f'Total movimientos loaded: {len(movimientos)}')

# Map to Ingresos
ingresos = []
ing_idx = 1
for m in movimientos:
    if m['tipo'] != 'Ingreso':
        continue
    c = m['codigo']
    rep = repuestos.get(c, {})
    inv = next((i for i in inventory_items if i['codigo'] == c), None)

    desc = rep.get('descripcion') or (inv['descripcion'] if inv else c)
    prov = m['cliente_proveedor'] or rep.get('proveedor') or (inv['proveedor'] if inv else 'SULLAIR')
    precio = rep.get('precio', 0) or (inv['precio'] if inv else 0)
    ubic = inv['ubicacion'] if inv else '-'
    cat = inv['categoria'] if inv else 'panol'

    ingresos.append({
        'id': f'ing-{ing_idx}',
        'codigo': c,
        'proveedor': prov,
        'descripcion': desc,
        'cantidad': m['cantidad'],
        'fechaIngreso': m['fecha'] or '2025-09-02',
        'factura': m['comprobante'] or 'S/F',
        'precioUnitario': precio,
        'ubicacion': ubic,
        'categoria': cat,
        'usuarioRegistro': m['retira_responsable'] or 'Matías (Jefe de Pañol)'
    })
    ing_idx += 1

print(f'Total ingresos generated: {len(ingresos)}')

# Map to Salida Groups & Salidas
raw_salidas = [m for m in movimientos if m['tipo'] == 'Salida']

# Sort chronologically
raw_salidas.sort(key=lambda x: x['fecha'])

# Group by (fecha, cliente_proveedor, retira_responsable, comprobante)
groups_map = defaultdict(list)
for s in raw_salidas:
    key = (s['fecha'], s['cliente_proveedor'], s['retira_responsable'], s['comprobante'])
    groups_map[key].append(s)

salida_groups = []
salidas_list = []
grp_num = 1
sal_idx = 1

for key, items in groups_map.items():
    fecha, cliente, retira, comprobante = key
    grp_id = f'grp-sal-{grp_num}'
    num_formatted = f'Salida N° {grp_num}'

    is_interno = (
        'R/I' in comprobante.upper() or 
        'INT' in comprobante.upper() or 
        'TALLER' in cliente.upper() or 
        'INTERNO' in cliente.upper()
    )

    group_items = []
    tot_unidades = 0
    tot_valor = 0.0

    for item in items:
        c = item['codigo']
        cant = item['cantidad']
        rep = repuestos.get(c, {})
        inv = next((i for i in inventory_items if i['codigo'] == c), None)

        desc = rep.get('descripcion') or (inv['descripcion'] if inv else c)
        precio = rep.get('precio', 0) or (inv['precio'] if inv else 0)
        ubic = inv['ubicacion'] if inv else '-'
        cat = inv['categoria'] if inv else 'panol'
        prov = rep.get('proveedor') or (inv['proveedor'] if inv else '-')

        p_total = round(cant * precio, 2)
        tot_unidades += cant
        tot_valor += p_total

        # SalidaItemEntry
        entry = {
            'id': f'item-entry-{sal_idx}',
            'codigo': c,
            'descripcion': desc,
            'proveedor': prov,
            'ubicacion': ubic,
            'cantidad': cant,
            'stockDisponible': inv['stock'] if inv else 0,
            'stockRemanente': max(0, (inv['stock'] if inv else 0) - cant),
            'precioUnitario': precio,
            'precioTotal': p_total,
            'categoria': cat
        }
        group_items.append(entry)

        # SalidaRecord
        sal_record = {
            'id': f'sal-{sal_idx}',
            'salidaGroupId': grp_id,
            'numeroSalida': grp_num,
            'numeroSalidaFormatted': num_formatted,
            'nroRemito': comprobante or f'Rº-{grp_num}',
            'codigo': c,
            'descripcion': desc,
            'fechaSalida': fecha,
            'horaSalida': '10:00',
            'cliente': cliente or 'General',
            'retira': retira or 'Matías',
            'cantidad': cant,
            'precioUnitario': precio,
            'categoria': cat,
            'esRemitoInterno': is_interno,
            'usuarioRegistro': retira or 'Matías (Jefe de Pañol)'
        }
        salidas_list.append(sal_record)
        sal_idx += 1

    group_record = {
        'id': grp_id,
        'numeroSalida': grp_num,
        'numeroSalidaFormatted': num_formatted,
        'fechaSalida': fecha,
        'horaSalida': '10:00',
        'retira': retira or 'Matías',
        'esRemitoInterno': is_interno,
        'cliente': cliente or 'General',
        'nroRemito': comprobante or f'Rº-{grp_num}',
        'usuarioRegistro': retira or 'Matías (Jefe de Pañol)',
        'items': group_items,
        'totalUnidades': tot_unidades,
        'totalValor': round(tot_valor, 2)
    }
    salida_groups.append(group_record)
    grp_num += 1

print(f'Total Salida Groups: {len(salida_groups)}')
print(f'Total Salidas List: {len(salidas_list)}')

# Generate src/data/initialData.ts
ts_content = f"""import {{ InventoryItem, SalidaRecord, IngresoRecord, UserAccount, SalidaGroupRecord }} from '../types';

export const INITIAL_USERS: UserAccount[] = [
  {{
    id: 'usr-2',
    username: 'panol',
    nombre: 'Marcelo',
    rol: 'panolero',
    password: 'panol',
  }},
  {{
    id: 'usr-4',
    username: 'ventas',
    nombre: 'Ventas',
    rol: 'ventas',
    password: 'ventas',
  }}
];

export const INITIAL_INVENTORY: InventoryItem[] = {json.dumps(inventory_items, indent=2, ensure_ascii=False)};

export const INITIAL_SALIDAS: SalidaRecord[] = {json.dumps(salidas_list, indent=2, ensure_ascii=False)};

export const INITIAL_INGRESOS: IngresoRecord[] = {json.dumps(ingresos, indent=2, ensure_ascii=False)};

export const INITIAL_SALIDA_GROUPS: SalidaGroupRecord[] = {json.dumps(salida_groups, indent=2, ensure_ascii=False)};
"""

with open('src/data/initialData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print("Successfully wrote src/data/initialData.ts!")

