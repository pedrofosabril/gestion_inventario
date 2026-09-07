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
with open('repuestos.csv', 'r', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        c = clean_code(r['codigo'])
        if not c:
            continue
        if c not in repuestos:
            repuestos[c] = {
                'codigo': c,
                'descripcion': r['descripcion'].strip(),
                'proveedor': r['proveedor'].strip(),
                'equivalencias': r['equivalencias'].strip(),
                'precio': parse_float(r['precio']),
                'uso_destino': r['uso_destino'].strip()
            }

# 2. Load INVENTARIO ingreso_salida - Pañol.csv
panol_csv_map = {}
with open('INVENTARIO ingreso_salida - Pañol.csv', 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()[3:]
    for l in lines:
        parts = list(csv.reader([l]))[0]
        if parts and parts[0].strip():
            c = clean_code(parts[0])
            panol_csv_map[c] = {
                'proveedor': parts[1].strip() if len(parts) > 1 else '',
                'descripcion': parts[2].strip() if len(parts) > 2 else '',
                'stock': parse_int(parts[3]) if len(parts) > 3 else 0,
                'ubicacion': parts[4].strip() if len(parts) > 4 else '',
                'precio': parse_float(parts[6]) if len(parts) > 6 else 0.0,
                'precio_total': parse_float(parts[7]) if len(parts) > 7 else 0.0,
            }

# 3. Load INVENTARIO AIR.P 2026 - CAJONES_FLUIDOS.csv
cf_cajones_map = {}
cf_fluidos_map = {}
with open('INVENTARIO AIR.P 2026 - CAJONES_FLUIDOS.csv', 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()[1:]
    for l in lines:
        parts = [p.strip() for p in l.split(',')]
        if len(parts) >= 4 and parts[0]:
            c = clean_code(parts[0])
            cf_cajones_map[c] = {
                'proveedor': parts[1] if len(parts) > 1 else 'SULLAIR',
                'descripcion': parts[2] if len(parts) > 2 else '',
                'stock': parse_int(parts[3]) if len(parts) > 3 else 0,
                'ubicacion': parts[4] if len(parts) > 4 else 'CAJONES'
            }
        if len(parts) >= 10 and parts[7]:
            c = clean_code(parts[7])
            cf_fluidos_map[c] = {
                'proveedor': 'SULLAIR | FLEETGUARD',
                'descripcion': parts[8] if len(parts) > 8 else '',
                'stock': parse_int(parts[9]) if len(parts) > 9 else 0,
                'ubicacion': 'FLUIDOS'
            }

# 4. Load stock.csv
with open('stock.csv', 'r', encoding='utf-8-sig') as f:
    stk_rows = list(csv.DictReader(f))

print(f"Total rows in stock.csv: {len(stk_rows)}")

# Slices definition:
# Pañol: 807 items -> stk_rows[0:80] + [Line 80 S/C] + stk_rows[80:806]
# Cajones: 95 items -> stk_rows[806:901]
# Fluidos: 7 items -> stk_rows[902:909] (row 901 is header "CÓDIGO")
# Submicrónicos: 35 items -> stk_rows[909:944]
# Rodamientos: 48 items -> stk_rows[945:993] (row 944 is header "CODIGO")
# Entrepiso: 61 items -> stk_rows[993:1054]
# MV: 26 items -> stk_rows[1054:1080]
# Cajas: 24 items -> stk_rows[1081:1105] (row 1080 is header "CODIGO")

raw_slices = {
    'panol': stk_rows[0:80] + [{
        'id_stock': 'STK-00080B',
        'codigo': 'S/C-LS20',
        'cantidad': '1',
        'ubicacion': 'A',
        'precio': '0',
        'precio_total': '0',
        'fecha_control': '2026-05-21'
    }] + stk_rows[80:806],
    'cajones': stk_rows[806:901],
    'fluidos': stk_rows[902:909],
    'submicronicos': stk_rows[909:944],
    'rodamientos': stk_rows[945:993],
    'entrepiso': stk_rows[993:1054],
    'repuestos_mv': stk_rows[1054:1080],
    'cajas': stk_rows[1081:1105]
}

inventory_items = []
item_idx = 1

MV_EXACT_LIST = [
    {"codigo": "W962", "descripcion": "FILTRO ACEITE", "ubicacion": "MV", "stock": 4, "precio": 49.0},
    {"codigo": "W950", "descripcion": "FILTRO ACEITE", "ubicacion": "MV", "stock": 4, "precio": 47.0},
    {"codigo": "W719", "descripcion": "FILTRO ACEITE", "ubicacion": "MV", "stock": 4, "precio": 32.0},
    {"codigo": "021201001.01", "descripcion": "VLV. DE ADMISION", "ubicacion": "MV", "stock": 2, "precio": 263.0},
    {"codigo": "02350201001.01", "descripcion": "BOTON PARADA DE EMERG.", "ubicacion": "MV", "stock": 1, "precio": 9.0},
    {"codigo": "024101002.01", "descripcion": "MANOMETRO", "ubicacion": "MV", "stock": 1, "precio": 40.0},
    {"codigo": "021101001.02", "descripcion": "VLV. PRESION MIN", "ubicacion": "MV-5/30", "stock": 2, "precio": 95.0},
    {"codigo": "025001001.10", "descripcion": "CONTROLADOR MAM-860", "ubicacion": "MV-5V", "stock": 1, "precio": 570.0},
    {"codigo": "LC1R1801M5N", "descripcion": "AC CONTACTOR", "ubicacion": "MV-5V", "stock": 1, "precio": 7.0},
    {"codigo": "021301001.09", "descripcion": "ELECTROVALVULA DE ADM.", "ubicacion": "MV-7", "stock": 2, "precio": 140.0},
    {"codigo": "KB8220", "descripcion": "FILTRO SEPARADOR", "ubicacion": "MV-7", "stock": 3, "precio": 78.0},
    {"codigo": "021301001.10", "descripcion": "VLV. SOLENOIDE", "ubicacion": "MV-7", "stock": 4, "precio": 80.0},
    {"codigo": "LC1R0601M5N", "descripcion": "AC CONTACTOR", "ubicacion": "MV-7V", "stock": 1, "precio": 70.0},
    {"codigo": "025001001.10", "descripcion": "CONTROLADOR MAM-860", "ubicacion": "MV-7", "stock": 1, "precio": 570.0},
    {"codigo": "C1140", "descripcion": "FILTRO DE AIRE", "ubicacion": "MV-10", "stock": 31, "precio": 28.0},
    {"codigo": "021301001.01", "descripcion": "VLV. SOLENOIDE", "ubicacion": "MV-10V", "stock": 1, "precio": 140.0},
    {"codigo": "LC1R2501M5N", "descripcion": "AC CONTACTOR", "ubicacion": "MV-10V", "stock": 1, "precio": 100.0},
    {"codigo": "JIV-40", "descripcion": "VLV. DE ADMISION", "ubicacion": "MV-15/20", "stock": 2, "precio": 370.0},
    {"codigo": "SB461", "descripcion": "FILTRO SEPARADOR", "ubicacion": "MV-40", "stock": 5, "precio": 175.0},
    {"codigo": "SB564", "descripcion": "FILTRO SEPARADOR", "ubicacion": "MV-50", "stock": 4, "precio": 193.0},
    {"codigo": "MVP-32A", "descripcion": "FILTRO DE AIRE", "ubicacion": "MV-50", "stock": 4, "precio": 98.0},
    {"codigo": "JIV-65", "descripcion": "VLV. DE ADMISION", "ubicacion": "MV-50", "stock": 2, "precio": 420.0},
    {"codigo": "023701005.06", "descripcion": "VLV. PRESION MIN", "ubicacion": "MV-50", "stock": 4, "precio": 230.0},
    {"codigo": "SB521", "descripcion": "FILTRO SEPARADOR", "ubicacion": "MV-15", "stock": 4, "precio": 120.0},
    {"codigo": "C1250", "descripcion": "FILTRO AIRE", "ubicacion": "MV-15/20", "stock": 2, "precio": 28.0},
    {"codigo": "C1360", "descripcion": "FILTRO AIRE", "ubicacion": "MV-25/40", "stock": 5, "precio": 65.0},
]

CAJAS_EXACT_LIST = [
    {"codigo": "0250025-001", "proveedor": "SULLAIR", "descripcion": "-", "stock": 1, "fecha": "2025-08-22", "precio": 0.0, "precio_total": 0.0},
    {"codigo": "826502-232", "proveedor": "SULLAIR", "descripcion": "O-RING VITON 2 3/4 X 1/8", "stock": 1, "fecha": "2025-08-22", "precio": 36.40, "precio_total": 36.40},
    {"codigo": "250022-782", "proveedor": "SULLAIR", "descripcion": "RESORTE CIL VEL P/185Q", "stock": 1, "fecha": "2025-08-22", "precio": 44.30, "precio_total": 44.30},
    {"codigo": "02250155-536", "proveedor": "SULLAIR", "descripcion": "TRANSDUCER PRES0", "stock": 1, "fecha": "2025-08-22", "precio": 2106.00, "precio_total": 2106.00},
    {"codigo": "40523", "proveedor": "SULLAIR", "descripcion": "JUNTA FLEXMASTER 3 S.20", "stock": 1, "fecha": "2025-08-22", "precio": 182.50, "precio_total": 182.50},
    {"codigo": "02250166-967", "proveedor": "SULLAIR", "descripcion": "-", "stock": 1, "fecha": "2025-08-22", "precio": 0.0, "precio_total": 0.0},
    {"codigo": "040091", "proveedor": "SULLAIR", "descripcion": "TACO AMORTIG TABLERO", "stock": 1, "fecha": "2025-08-22", "precio": 49.50, "precio_total": 49.50},
    {"codigo": "040649", "proveedor": "SULLAIR", "descripcion": "FLEXMASTER 2 1/2", "stock": 2, "fecha": "2025-08-22", "precio": 0.0, "precio_total": 0.0},
    {"codigo": "011579RA", "proveedor": "SULLAIR", "descripcion": "KIT SULLICON(41269 + 41270)", "stock": 1, "fecha": "2025-08-22", "precio": 143.30, "precio_total": 143.30},
    {"codigo": "02250152-810", "proveedor": "SULLAIR", "descripcion": "FLG KIT SAE SPLIT 2 M12 X 30", "stock": 2, "fecha": "2025-08-22", "precio": 121.50, "precio_total": 243.00},
    {"codigo": "0307-3070", "proveedor": "CUMMINS", "descripcion": "RELAY 12V", "stock": 3, "fecha": "2025-08-22", "precio": 131.70, "precio_total": 395.10},
    {"codigo": "250040-904", "proveedor": "SULLAIR", "descripcion": "KIT DOOR LATCH", "stock": 2, "fecha": "2025-08-22", "precio": 223.80, "precio_total": 447.60},
    {"codigo": "810504-012", "proveedor": "SULLAIR", "descripcion": "CODO 90° 1/4 T x 1/8 NPT M.", "stock": 2, "fecha": "2025-08-22", "precio": 50.60, "precio_total": 101.20},
    {"codigo": "68722536", "proveedor": "SULLAIR", "descripcion": "RETEN", "stock": 1, "fecha": "2025-08-22", "precio": 24.40, "precio_total": 24.40},
    {"codigo": "7010944", "proveedor": "SULLAIR", "descripcion": "FLEX COUP.KIT", "stock": 1, "fecha": "2025-08-22", "precio": 90.30, "precio_total": 90.30},
    {"codigo": "250006-526", "proveedor": "SULLAIR", "descripcion": "RESORTE LUZ DE CONTROL", "stock": 1, "fecha": "2025-08-22", "precio": 142.50, "precio_total": 142.50},
    {"codigo": "02250209-583", "proveedor": "SULLAIR", "descripcion": "MANGUERA HIDRAU. 3/4 X 60 LG", "stock": 1, "fecha": "2025-08-22", "precio": 417.20, "precio_total": 417.20},
    {"codigo": "001684", "proveedor": "SULLAIR", "descripcion": "JGO REP VLV RETENCION (SELLOS)", "stock": 1, "fecha": "2025-08-22", "precio": 162.50, "precio_total": 162.50},
    {"codigo": "S/C", "proveedor": "VARIOS", "descripcion": "RETEN REDUCTOR E450 A/AJ", "stock": 3, "fecha": "2025-08-22", "precio": 0.0, "precio_total": 0.0},
    {"codigo": "S/C", "proveedor": "JOHN DEERE", "descripcion": "-", "stock": 1, "fecha": "2025-08-22", "precio": 0.0, "precio_total": 0.0},
    {"codigo": "4954473", "proveedor": "CUMMINS", "descripcion": "JUNTA DE BOMBIN COMB p/ QSX15", "stock": 1, "fecha": "2025-08-22", "precio": 87.0, "precio_total": 87.00},
    {"codigo": "0357-0030", "proveedor": "CUMMINS", "descripcion": "RECTIF. 6AMP P/DQKB/5NHD QSK60", "stock": 1, "fecha": "2025-08-22", "precio": 31.0, "precio_total": 31.00},
    {"codigo": "267351", "proveedor": "LUMMUS", "descripcion": "-", "stock": 1, "fecha": "2025-08-22", "precio": 0.0, "precio_total": 0.0},
    {"codigo": "3921642", "proveedor": "CUMMINS", "descripcion": "-", "stock": 1, "fecha": "2025-08-22", "precio": 0.0, "precio_total": 0.0}
]

# Process each category
for cat_name, rows in raw_slices.items():
    if cat_name == 'repuestos_mv':
        for m in MV_EXACT_LIST:
            inventory_items.append({
                'id': f'item-{item_idx}',
                'codigo': m['codigo'],
                'proveedor': 'MV',
                'descripcion': m['descripcion'],
                'stock': m['stock'],
                'stockMinimo': 1 if m['stock'] <= 1 else 2,
                'ubicacion': m['ubicacion'],
                'subcategoria': m['ubicacion'],
                'categoria': 'repuestos_mv',
                'fechaRegistro': '2025-08-22',
                'fechaUltimoMovimiento': '2025-08-22',
                'precio': m['precio'],
                'precioTotal': round(m['stock'] * m['precio'], 2),
                'porEncargo': False,
                'codigoBarras': m['codigo'],
                'equivalencias': ''
            })
            item_idx += 1
        continue

    if cat_name == 'cajas':
        for c_item in CAJAS_EXACT_LIST:
            inventory_items.append({
                'id': f'item-{item_idx}',
                'codigo': c_item['codigo'],
                'proveedor': c_item['proveedor'],
                'descripcion': c_item['descripcion'],
                'stock': c_item['stock'],
                'stockMinimo': 1 if c_item['stock'] <= 1 else 2,
                'ubicacion': 'Caja Estante A',
                'subcategoria': 'Caja Estante A',
                'categoria': 'cajas',
                'fechaRegistro': c_item['fecha'],
                'fechaUltimoMovimiento': c_item['fecha'],
                'precio': c_item['precio'],
                'precioTotal': c_item['precio_total'],
                'porEncargo': False,
                'codigoBarras': c_item['codigo'],
                'equivalencias': ''
            })
            item_idx += 1
        continue

    for r in rows:
        c = clean_code(r['codigo'])
        cant = parse_int(r['cantidad'])
        ubic = r.get('ubicacion', '').strip()
        precio = parse_float(r.get('precio', 0))
        precio_total = parse_float(r.get('precio_total', 0))
        fecha = r.get('fecha_control', '').strip() or '2026-05-21'

        rep = repuestos.get(c, {})
        pan = panol_csv_map.get(c, {})
        cf_caj = cf_cajones_map.get(c, {})
        cf_flu = cf_fluidos_map.get(c, {})

        # Supplier resolution
        prov = rep.get('proveedor') or pan.get('proveedor') or cf_caj.get('proveedor') or cf_flu.get('proveedor')
        if not prov:
            if cat_name == 'rodamientos':
                prov = 'SKF'
            elif cat_name == 'cajas':
                prov = 'SULLAIR'
            elif cat_name == 'repuestos_mv':
                prov = 'M.V'
            else:
                prov = 'SULLAIR'

        # Description resolution
        desc = rep.get('descripcion') or pan.get('descripcion') or cf_caj.get('descripcion') or cf_flu.get('descripcion')
        if not desc:
            if c == 'S/C-LS20':
                desc = 'DELUXE MICROPROCESSOR CONTROLLER LS/20'
            elif cat_name == 'rodamientos':
                desc = f'RODAMIENTO {prov} {c}'
            elif cat_name == 'submicronicos':
                desc = f'ELEMENTO FILTRANTE SUBMICRÓNICO {c}'
            elif cat_name == 'entrepiso':
                desc = f'FILTRO {prov} {c}'
            elif cat_name == 'repuestos_mv':
                desc = f'REPUESTO COMPRESOR MV {c}'
            elif cat_name == 'cajas':
                desc = f'CAJA REPUESTO {c}'
            else:
                desc = f'REPUESTO {prov} {c}'

        # Price resolution
        if precio <= 0:
            precio = rep.get('precio', 0.0) or pan.get('precio', 0.0)
        if precio_total <= 0 and cant > 0 and precio > 0:
            precio_total = round(precio * cant, 2)

        # Ubicacion resolution
        if not ubic:
            ubic = pan.get('ubicacion') or cf_caj.get('ubicacion') or cf_flu.get('ubicacion') or '-'

        # Equivalencias
        equiv = rep.get('equivalencias', '')

        # Map to app Category and Subcategory
        if cat_name == 'panol':
            app_cat = 'panol'
            app_subcat = None
        elif cat_name == 'cajones':
            app_cat = 'cajones_fluidos'
            app_subcat = 'Cajones'
        elif cat_name == 'fluidos':
            app_cat = 'cajones_fluidos'
            app_subcat = 'Fluidos'
        elif cat_name == 'submicronicos':
            app_cat = 'submicronicos'
            app_subcat = None
        elif cat_name == 'rodamientos':
            app_cat = 'rodamientos'
            # Determine rodamientos subcat brand
            p_up = prov.upper()
            c_up = c.upper()
            if 'TIMKEN' in p_up or 'TIMKEN' in c_up:
                app_subcat = 'TIMKEN'
            elif 'FAG' in p_up or 'FAG' in c_up:
                app_subcat = 'FAG'
            elif 'NSK' in p_up or 'NSK' in c_up:
                app_subcat = 'NSK'
            elif 'NTN' in p_up or 'NTN' in c_up:
                app_subcat = 'NTN'
            elif 'ZKL' in p_up or 'ZKL' in c_up:
                app_subcat = 'ZKL'
            elif 'KOYO' in p_up or 'KOYO' in c_up:
                app_subcat = 'KOYO'
            elif 'ROLLWAY' in p_up or 'ROLLWAY' in c_up:
                app_subcat = 'ROLLWAY'
            elif 'ZVL' in p_up or 'ZVL' in c_up:
                app_subcat = 'ZVL'
            elif 'URB' in p_up or 'URB' in c_up:
                app_subcat = 'URB'
            else:
                app_subcat = 'SKF'
        elif cat_name == 'entrepiso':
            app_cat = 'entrepiso'
            p_up = prov.upper()
            c_up = c.upper()
            if 'FLEETGUARD' in p_up or '-FLE' in c_up:
                app_subcat = 'FLEETGUARD'
            elif 'LANSS' in p_up or 'LANS' in c_up or '-LAN' in c_up:
                app_subcat = 'LANSS'
            elif 'CATERPILLAR' in p_up or 'CAT' in p_up or '-CAT' in c_up:
                app_subcat = 'CATERPILLAR'
            elif 'DONALDSON' in p_up or 'DON' in p_up or '-DON' in c_up:
                app_subcat = 'DONALDSON'
            elif 'MAHLE' in p_up or 'MAH' in p_up or '-MAH' in c_up:
                app_subcat = 'MAHLE'
            else:
                app_subcat = 'VARIOS'
        else:
            app_cat = 'panol'
            app_subcat = None

        item_obj = {
            'id': f'item-{item_idx}',
            'codigo': c,
            'proveedor': prov,
            'descripcion': desc,
            'stock': cant,
            'stockMinimo': 1 if cant <= 1 else 2,
            'ubicacion': ubic,
            'categoria': app_cat,
            'fechaRegistro': fecha,
            'fechaUltimoMovimiento': fecha,
            'precio': precio,
            'precioTotal': precio_total,
            'porEncargo': (cant == 0),
            'codigoBarras': c,
            'equivalencias': equiv
        }
        if app_subcat:
            item_obj['subcategoria'] = app_subcat

        inventory_items.append(item_obj)
        item_idx += 1

print(f"Total Inventory Items Generated: {len(inventory_items)}")

# Check category counts
cat_counts = defaultdict(int)
for item in inventory_items:
    cat_counts[item['categoria']] += 1

print("Category Breakdown:")
for cat, cnt in sorted(cat_counts.items()):
    print(f"  {cat}: {cnt}")

# Check Entrepiso subcategory breakdown
entrepiso_subs = defaultdict(int)
for item in inventory_items:
    if item['categoria'] == 'entrepiso':
        entrepiso_subs[item.get('subcategoria', 'VARIOS')] += 1

print("Entrepiso Subcategories:")
for sub, cnt in sorted(entrepiso_subs.items()):
    print(f"  {sub}: {cnt}")

# Check Cajones / Fluidos subcategory breakdown
cf_subs = defaultdict(int)
for item in inventory_items:
    if item['categoria'] == 'cajones_fluidos':
        cf_subs[item.get('subcategoria', '')] += 1

print("Cajones/Fluidos Subcategories:")
for sub, cnt in sorted(cf_subs.items()):
    print(f"  {sub}: {cnt}")

# 5. Load movimientos.csv
movimientos = []
with open('movimiento.csv', 'r', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        c = clean_code(r['codigo'])
        if not c:
            continue
        tipo = r['tipo_movimiento'].strip().lower()
        cant = parse_int(r['cantidad'])
        fecha = r.get('fecha', '').strip()
        cli = r.get('cliente_proveedor', '').strip()
        comp = r.get('comprobante', '').strip()
        ret = r.get('retira_responsable', '').strip()
        mot = r.get('motivo', '').strip()

        movimientos.append({
            'codigo': c,
            'tipo': tipo,
            'cantidad': cant,
            'fecha': fecha,
            'cliente': cli,
            'comprobante': comp,
            'retira': ret,
            'motivo': mot
        })

print(f'Total Movimientos in CSV: {len(movimientos)}')

# Group salidas
salidas_raw = [m for m in movimientos if m['tipo'] == 'salida']
ingresos_raw = [m for m in movimientos if m['tipo'] == 'ingreso']

print(f'Salidas: {len(salidas_raw)}')
print(f'Ingresos: {len(ingresos_raw)}')

# Generate IngresoRecord[]
ingresos = []
ing_idx = 1
for m in ingresos_raw:
    c = m['codigo']
    cant = m['cantidad']
    rep = repuestos.get(c, {})
    inv = next((i for i in inventory_items if i['codigo'] == c), None)
    desc = rep.get('descripcion') or (inv['descripcion'] if inv else c)
    precio = rep.get('precio', 0.0) or (inv['precio'] if inv else 0.0)
    ubic = inv['ubicacion'] if inv else '-'
    cat = inv['categoria'] if inv else 'panol'

    prov = rep.get('proveedor') or (inv['proveedor'] if inv else 'SULLAIR')
    ingresos.append({
        'id': f'ing-{ing_idx}',
        'codigo': c,
        'proveedor': prov,
        'descripcion': desc,
        'cantidad': cant,
        'fechaIngreso': m['fecha'] or '2026-05-21',
        'factura': m['comprobante'] or f'FAC-{ing_idx:04d}',
        'ubicacion': ubic,
        'categoria': cat,
        'precioUnitario': precio,
        'usuarioRegistro': 'Matías (Jefe de Pañol)'
    })
    ing_idx += 1

# Group salidas by (fecha, comprobante, cliente, retira)
grouped_salidas = defaultdict(list)
for s in salidas_raw:
    key = (s['fecha'], s['comprobante'], s['cliente'], s['retira'])
    grouped_salidas[key].append(s)

salida_groups = []
salidas_list = []
grp_num = 1
sal_idx = 1

for (fecha, comprobante, cliente, retira), items in grouped_salidas.items():
    grp_id = f'sal-grp-{grp_num}'
    num_formatted = f'S-{grp_num:05d}'

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
        precio = rep.get('precio', 0.0) or (inv['precio'] if inv else 0.0)
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

const RAW_INVENTORY: unknown = {json.dumps(inventory_items, indent=2, ensure_ascii=False)};
export const INITIAL_INVENTORY: InventoryItem[] = RAW_INVENTORY as InventoryItem[];

const RAW_SALIDAS: unknown = {json.dumps(salidas_list, indent=2, ensure_ascii=False)};
export const INITIAL_SALIDAS: SalidaRecord[] = RAW_SALIDAS as SalidaRecord[];

const RAW_INGRESOS: unknown = {json.dumps(ingresos, indent=2, ensure_ascii=False)};
export const INITIAL_INGRESOS: IngresoRecord[] = RAW_INGRESOS as IngresoRecord[];

const RAW_SALIDA_GROUPS: unknown = {json.dumps(salida_groups, indent=2, ensure_ascii=False)};
export const INITIAL_SALIDA_GROUPS: SalidaGroupRecord[] = RAW_SALIDA_GROUPS as SalidaGroupRecord[];
"""

with open('src/data/initialData.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print("SUCCESS: src/data/initialData.ts generated with exact numbers!")
