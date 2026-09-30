const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, PageNumber, Header, Footer, ShadingType, ImageRun
} = require('docx');

const SCREEN = path.join(__dirname, 'screenshots');

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const screenshot = (name, caption, { maxW = 610 } = {}) => {
  const file = path.join(SCREEN, name + '.png');
  if (!fs.existsSync(file)) return [];
  const { w, h } = pngSize(file);
  const height = Math.round(maxW * h / w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: maxW, height } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 220 },
      children: [new TextRun({ text: caption, italics: true, size: 18, color: '64748B' })],
    }),
  ];
};

const outPath = path.join(os.homedir(), 'Downloads', 'MANUAL_USUARIO_Verdu_y_Cia.docx');

const H = (text, level = 1) =>
  new Paragraph({ heading: level, children: [new TextRun({ text, bold: true })], spacing: { before: level === 1 ? 360 : 240, after: 120 } });

const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 120, line: 276 },
    children: text.map(node => [
      node.bold ? new TextRun({ text: node.t, bold: true }) : new TextRun({ text: node.t })
    ].flat()),
    ...opts
  });

const t = (s) => [{ t: s, bold: false }];
const tb = (s) => [{ t: s, bold: true }];

const items = (list) => list.map((li, i) => new Paragraph({
  bullet: { level: 0 },
  spacing: { after: 80, line: 264 },
  children: [new TextRun({ text: li })],
}));

const numbered = (list) => list.map((li, i) => new Paragraph({
  spacing: { after: 80, line: 264 },
  children: [new TextRun({ text: `${i + 1}. `, bold: true }), new TextRun({ text: li })],
}));

const cell = (text, { header = false, bold = false } = {}) =>
  new TableCell({
    shading: header ? { fill: '006BB0', type: ShadingType.CLEAR } : undefined,
    width: { size: 33.3, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, bold: header || bold, color: header ? 'FFFFFF' : undefined })] })],
  });

const tableOf = (rows, headers) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map(h => cell(h, { header: true })) }),
      ...rows.map(r => new TableRow({ children: r.map(c => cell(c)) })),
    ],
  });

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22, color: '1E293B' } },
      paragraphStyles: [],
    },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 64, color: '006BB0' } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: 'bullet', text: '\u2022', alignment: AlignmentType.LEFT }] }] },
  sections: [{
    properties: {
      page: { margin: { top: 800, bottom: 800, left: 900, right: 900 } },
    },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Verdu y Cía. — Manual de Usuario', italics: true, size: 18, color: '64748B' })] })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT] }) ] })] }),
    },
    children: [
      // PORTADA
      new Paragraph({ spacing: { before: 1600, after: 200 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Verdu y Cía.', bold: true, size: 72, color: '006BB0' })] }),
      new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'GESTIÓN DE PAÑOL E INVENTARIO', bold: true, size: 28, color: '334155' })] }),
      new Paragraph({ spacing: { after: 400 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Manual de Usuario', size: 44, color: '006BB0' })] }),
      new Paragraph({ spacing: { after: 600 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Sistema web de inventario, stock, movimientos, códigos de barras e impresión de etiquetas.', size: 22, color: '475569' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Versión aplicable: actual del sistema', size: 20, color: '94A3B8' })] }),

      new Paragraph({ pageBreakBefore: true, children: [] }),

      // ÍNDICE
      H('Contenido', 1),
      items([
        '1. Introducción al sistema',
        '2. Acceso al sistema (iniciar sesión y crear cuenta)',
        '3. Perfiles de usuario y permisos',
        '4. Pantalla principal y navegación',
        '5. Categorías de inventario',
        '6. Cómo se muestra el stock (normal, P/SERVICIO y por encargo)',
        '7. Buscar y filtrar productos',
        '8. Ficha de producto (detalle)',
        '9. Alta de producto',
        '10. Editar y eliminar productos',
        '11. Movimientos de stock: Salida, Devolución y Entrada',
        '12. Remito y firma del operario',
        '13. Escaneo con lector de código de barras (USB y cámara)',
        '14. Etiquetas: generar, editar e imprimir en NIIMBOT',
        '15. Importar y exportar datos (Excel y respaldo JSON)',
        '16. Historial de salidas y de ingresos',
        '17. Panel de Administración (KPIs y valorización)',
        '18. Vista Pañolero (pantalla táctil)',
        '19. Problemas frecuentes',
        '20. Glosario',
      ]),

      // 1 INTRODUCCIÓN
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('1. Introducción al sistema', 1),
      P(t('El sistema de Gestión de Pañol de Verdu y Cía. permite llevar el control completo del inventario de repuestos y fluidos: consultar existencias, registrar salidas e ingresos, escanear códigos de barras e imprimir etiquetas.')),
      P(t('Se usa desde el navegador de una computadora o de un celular. El sistema es una PWA: puede instalarse en el dispositivo y también funciona de forma offline parcial (los datos se sincronizan con la base de datos).')),
      H('1.1 Dispositivos compatibles', 2),
      items([
        'Computadora con navegador (Chrome o Edge) conectada a Internet.',
        'Lector de código de barras USB (se enchufa y funciona como un teclado).',
        'Celular con cámara para escanear códigos de barras.',
        'Impresora de etiquetas NIIMBOT B1 (por Bluetooth o por cable USB).',
      ]),

      // 2 ACCESO
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('2. Acceso al sistema', 1),
      P(t('Al abrir el sistema por primera vez aparece la pantalla de bienvenida con dos opciones: "Iniciar Sesión" y "Crear Cuenta".')),
      ...screenshot('02a-iniciar-sesion', 'Pantalla de inicio de sesión: campos de usuario y contraseña con el botón "Iniciar Sesión".'),
      H('2.1 Iniciar sesión', 2),
      numbered([
        'Completar el campo Usuario con el nombre de usuario.',
        'Completar el campo Contraseña.',
        'Presionar el botón "Iniciar Sesión".',
      ]),
      H('2.2 Crear cuenta', 2),
      numbered([
        'Completar Nombre y Apellido, Usuario (sin espacios), y elegir el Rol: Administración, Pañolero o Ventas.',
        'Definir una Contraseña y su Confirmación. Requisitos: mínimo 8 caracteres, al menos 1 letra mayúscula (A-Z) y al menos 1 carácter especial (ejemplo: ! @ # $ % * - _).',
        'Presionar "Crear Cuenta". Los campos de ayuda marcan en verde cuándo se cumple cada requisito.',
      ]),
      ...screenshot('02b-crear-cuenta', 'Formulario de creación de cuenta con selección de rol y requisitos de contraseña.'),
      P(tb('Atención para Ventas: '), t('el perfil Ventas solo ve las categorías de productos habilitadas y no tiene botones de salida/entrada.')),

      // 3 PERFILES
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('3. Perfiles de usuario y permisos', 1),
      tableOf([
        ['Administración', 'Acceso completo: todas las categorías, botones Salida / Devolución / Entrada, Panel de Administración, edición y borrado de productos, importar/exportar Excel y respaldos.', 'Gerencia / Encargado'],
        ['Pañolero', 'Vista táctil simplificada con búsqueda por lector, botones táctiles Salida y Entrada, historial. Sin panel ejecutivo.', 'Operario de pañol'],
        ['Ventas', 'Consulta de productos de las categorías de venta: búsqueda, detalle y stock. Sin movimientos ni edición.', 'Personal de ventas'],
      ], ['Perfil', 'Qué puede hacer', '¿Quién lo usa?']),
      ...screenshot('18-panolero-principal', 'La vista Pañolero es táctil y simplificada, con tarjetas grandes de stock.'),
      ...screenshot('13-ventas-inventario', 'El perfil Ventas solo consulta: busca productos y abre fichas, sin botones de movimiento.', { maxW: 520 }),

      // 4 PANTALLA PRINCIPAL
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('4. Pantalla principal y navegación', 1),
      H('4.1 Barra superior', 2),
      items([
        'Logo de Verdu y Cía.: al hacer clic vuelve al inicio (Al Pañol o a Administración según el perfil).',
        'Buscador global (centro, en pantallas medianas y grandes): busca por código, descripción, proveedor, ubicación, equivalencias o código de barras.',
        'Botones de acción (solo Administración): Salida (rojo), Devolución (ámbar) y Entrada (verde).',
        'Indicador de sesión: muestra el nombre y el perfil activo (Administración, Ventas o el nombre del pañolero).',
        'Botón "Cerrar Sesión": vuelve a la pantalla de inicio.',
      ]),
      ...screenshot('04a-barra-inferior-acciones', 'Barra superior: logo, buscador global, botones Salida / Devolución / Entrada y sesión activa.', { maxW: 620 }),
      H('4.2 Barra de secciones (categorías)', 2),
      P(t('Debajo de la barra superior está la barra de navegación con las secciones. Si hay muchas, aparecen flechas para desplazarse. Cada sección muestra además la cantidad de productos que contiene.')),
      ...screenshot('04b-barra-secciones', 'Barra de secciones (categorías) con su cantidad de productos.', { maxW: 620 }),
      H('4.3 Barra inferior en celulares', 2),
      P(t('En celulares hay una barra fija inferior con accesos rápidos: Salida, Entrada, Historial y Administración o Cerrar Sesión (según el perfil).')),

      // 5 CATEGORÍAS
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('5. Categorías de inventario', 1),
      tableOf([
        ['Pañol (General)', 'Repuestos generales del pañol'],
        ['Cajones / Fluidos', 'Lubricantes y fluidos'],
        ['Submicrónicos', 'Filtros submicrónicos'],
        ['Rodamientos', 'Rodamientos'],
        ['Entrepiso', 'Mercadería en entrepiso'],
        ['Repuestos MV', 'Repuestos de maquinaria vial (MV)'],
        ['Cajas Estantes', 'Repuestos guardados en cajas de estantes'],
      ], ['Sección', 'Descripción']),
      ...screenshot('05-barra-secciones-categorias', 'Las categorías del inventario se organizan en secciones dentro de la barra de navegación.', { maxW: 620 }),

      // 6 STOCK
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('6. Cómo se muestra el stock', 1),
      H('6.1 Stock normal y Stock P/SERVICIO', 2),
      P(t('Cada producto puede tener dos valores de stock:')),
      items([
        'Stock normal: unidades disponibles para venta.',
        'Stock P/SERVICIO: unidades reservadas para servicio técnico.',
        'Total: es la suma de ambos valores.',
      ]),
      P(t('En las tarjetas móviles aparecen "Stock normal" y "Stock p/servicio" en dos cajas de color (verde y ámbar). En la tabla de escritorio, la columna P/Servicio muestra la cantidad reservada en color ámbar cuando es mayor a 0.')),
      ...screenshot('06-tabla-stock-normal-pservicio', 'Tabla de stock con columnas de stock normal y P/SERVICIO, y botones de acción por fila.', { maxW: 600 }),
      H('6.2 Productos por encargo', 2),
      P(t('Los productos marcados como "por encargo" no se almacenan en el pañol; se piden al proveedor. Se identifican con la etiqueta "📦 Por Encargo" y no generan alertas de stock faltante.')),
      H('6.3 Alertas de stock', 2),
      tableOf([
        ['Sin stock', 'Rosa', 'Hay 0 unidades (salvo por encargo)'],
        ['Stock bajo', 'Ámbar', 'La cantidad es menor o igual al mínimo configurado (por defecto 1)'],
        ['Stock disponible', 'Verde', 'Hay existencias suficientes'],
      ], ['Estado', 'Color', 'Significado']),

      // 7 BUSCAR
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('7. Buscar y filtrar productos', 1),
      H('7.1 Buscador global', 2),
      P(t('Escriba el texto en el buscador superior. Busca en: código, código de barras, descripción, proveedor, ubicación y equivalencias. Los resultados aparecen en un menú desplegable (hasta 15); haga clic sobre uno para abrir la ficha del producto.')),
      P(tb('Consejo: '), t('se puede escribir solo una parte (por ejemplo "0225" o "filtro") y el sistema encuentra las coincidencias.')),
      ...screenshot('07-buscador-global', 'Búsqueda global: el menú desplegable muestra las coincidencias a medida que se escribe.', { maxW: 600 }),
      H('7.2 Filtros dentro de cada sección', 2),
      items([
        'Búsqueda local dentro de la tabla.',
        'Filtro por subcategoría/modelo.',
        'Filtro por ubicación.',
        'Filtro por tipo: Todos / Con stock / Por encargo.',
        'Ordenamiento por código, stock, precio o ubicación (con flecha de orden ascendente/descendente).',
      ]),

      // 8 FICHA
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('8. Ficha de producto (detalle)', 1),
      P(t('Al hacer clic sobre un producto (o activar el resultado del buscador) se abre la ficha completa con: código, descripción, proveedor, categoría, subcategoría, equivalencias, ubicación, stock normal, stock P/SERVICIO, precio y código de barras. Desde la ficha se puede navegar a la categoría del producto o, para Administración, registrar un movimiento o imprimir la etiqueta.')),
      ...screenshot('08-ficha-producto', 'Ficha de producto: todos los datos del artículo en una sola pantalla.', { maxW: 600 }),

      // 9 ALTA
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('9. Alta de producto', 1),
      P(t('Solo para Administración. Botón "+" / "Agregar producto" dentro de la sección correspondiente.')),
      H('9.1 Campos del formulario', 2),
      items([
        'Código del producto (obligatorio; no puede repetirse).',
        'Categoría del inventario y Subcategoría / modelo.',
        'Proveedor / Fabricante.',
        'Descripción detallada (obligatoria).',
        'Equivalencias (códigos cruzados de otras marcas).',
        'Ubicación física (estante, cajón, etc.).',
        'Stock normal y Stock P/SERVICIO.',
        'Stock mínimo (para la alerta de stock bajo).',
        'Precio unitario y valor total calculado automático.',
        'Por encargo: casilla que indica que es un artículo a pedido.',
        'Factura / comprobante de origen, y Notas.',
      ]),
      H('9.2 Código de barras', 2),
      P(t('Si el proveedor es SULLAIR, el código de barras se genera automáticamente a partir del código del producto. Para otros proveedores, puede escanearse o escribirse un código de barras físico, que se valida para que no esté repetido.')),
      P(tb('Al guardar: '), t('el sistema avisa "Producto registrado correctamente". El código de barras y los valores de stock/precio se recalculan al guardar.')),
      ...screenshot('09-alta-producto', 'Formulario de alta de producto con todos los campos: código, categoría, stock, precio y "por encargo".', { maxW: 600 }),

      // 10 EDITAR
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('10. Editar y eliminar productos', 1),
      H('10.1 Editar', 2),
      P(t('Solo Administración y Pañolero. Haga clic en el lápiz (✎) de la fila o tarjeta del producto. Se abre el formulario "Editar Producto" con todos los datos cargados. El Código no se puede modificar. Presione "Guardar Cambios" para confirmar.')),
      ...screenshot('10-editar-producto', 'Ventana "Editar Producto": modifica stock normal, stock P/SERVICIO, precio, ubicación y más.', { maxW: 600 }),
      H('10.2 Eliminar', 2),
      P(t('Solo Administración. Con el botón de papelera (🗑) el sistema pide confirmación antes de borrar el producto.')),

      // 11 MOVIMIENTOS
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('11. Movimientos de stock: Salida, Devolución y Entrada', 1),
      P(t('Los tres botones abren la ventana de escaneo. Es la operación central del pañol.')),
      H('11.1 Registrar una Salida', 2),
      numbered([
        'Presionar el botón "Salida" (o en celular el botón inferior Salida).',
        'Escanear el código del producto con el lector o escribir la pieza manualmente.',
        'Ingresar la cantidad. La ventana muestra el stock disponible, el stock P/SERVICIO y el total para guiarse.',
        'Completar el nombre de la persona que retira (Retira).',
        'Confirmar. El stock se descuenta y queda registrado el movimiento.',
      ]),
      ...screenshot('11a-scanner-salida', 'Ventana de Salida lista para escanear el código del producto.', { maxW: 560 }),
      ...screenshot('11b-scanner-salida-producto', 'Al escribir o escanear el código, el producto se carga para confirmar la cantidad.', { maxW: 560 }),
      H('11.2 Registrar una Devolución', 2),
      P(t('Igual que la salida pero usando el botón "Devolución" (ámbar). Se usa cuando se devuelve material al pañol.')),
      ...screenshot('11c-scanner-devolucion', 'Ventana de Devolución: reintegra material al pañol con motivo y empleado que devuelve.', { maxW: 560 }),
      H('11.3 Registrar una Entrada / Ingreso', 2),
      numbered([
        'Presionar el botón "Entrada".',
        'Escanear o escribir el código del producto.',
        'Ingresar la cantidad que llega.',
        'Si el producto todavía no existe, se puede dar de alta en el momento.',
        'Confirmar. El stock aumenta.',
      ]),
      ...screenshot('11d-scanner-ingreso', 'Ventana de Entrada: registro de ingreso de stock con factura y proveedor.', { maxW: 560 }),
      H('11.4 Reglas de stock', 2),
      items([
        'El stock nunca puede quedar negativo: la salida de más unidades que las disponibles pide ajustar la cantidad o seleccionar otro artículo.',
        'Puede elegirse si la cantidad sale del stock normal, del stock reservado P/SERVICIO, o de ambos según el menú que ofrece la ventana.',
        'Los movimientos quedan guardados en el historial (ver capítulo 16).',
      ]),

      // 12 REMITO
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('12. Remito y firma del operario', 1),
      P(t('Después de confirmar una salida o devolución, el sistema genera un comprobante / remito con: fecha, operador, persona que retira, detalle de piezas y cantidades. El operario puede firmar con el dedo (en la pantalla) y esa firma queda guardada para poder reimprimir el remito desde el historial.')),
      ...screenshot('12-remito-salida', 'Comprobante / remito de salida con detalle de piezas, cantidades y botón de descarga en PDF.', { maxW: 580 }),

      // 13 ESCANEO
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('13. Escaneo de código de barras', 1),
      H('13.1 Lector USB (físico)', 2),
      P(t('Al escanear con el lector (sin importar la pantalla donde esté), el sistema abre automáticamente la operación correspondiente según el perfil:')),   
      items([
        'Administración: abre la ventana de Salida con el código escaneado.',
        'Pañolero: activa la búsqueda del producto.',
        'Ventas: abre la ficha del producto (sin operaciones).',
      ]),
      H('13.2 Escaneo con cámara del celular', 2),
      numbered([
        'Dentro de la ventana de movimiento (Salida/Entrada) presionar el icono de cámara.',
        'Apuntar al código de barras del repuesto.',
        'El sistema lo identifica y lo carga en la operación.',
      ]),
      ...screenshot('11e-scanner-camara', 'Escaneo con cámara dentro de la ventana de movimiento.', { maxW: 540 }),
      H('13.3 Escaneo manual', 2),
      P(t('Siempre se puede escribir el código o la pieza en el campo de texto. La ventana busca y muestra coincidencias para elegir.')),

      // 14 ETIQUETAS
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('14. Etiquetas de código de barras', 1),
      H('14.1 Generar una etiqueta', 2),
      numbered([
        'Desde la fila del producto presionar el botón de código de barras (icono conocido con el símbolo de barras).',
        'Se abre la ventana "Código de Barras" con una vista previa de la etiqueta.',
        'Elegir el tamaño de etiqueta: 50x50, 50x30 o 50x20 mm.',
        'Elegir la cantidad de copias.',
      ]),
      H('14.2 Imprimir en la NIIMBOT B1', 2),
      items([
        'Bluetooth: presionar "Imprimir en NIIMBOT" y conectar con la impresora (Web Bluetooth).',
        'USB: presionar "Imprimir en NIIMBOT (USB)" con la impresora conectada por cable (Web Serial).',
        'La etiqueta imprime el código de barras grande con el numeral debajo.',
      ]),
      H('14.3 Editar / vincular un código físico', 2),
      P(t('Para productos que no son SULLAIR, el botón de código de barras permite vincular un código de barras físico (escaneado con el lector USB o por cámara) o editarlo manualmente, con validación de que no pertenezca a otro producto.')),
      ...screenshot('14-etiqueta-codigo-barras', 'Ventana "Código de Barras": vista previa, tamaño de etiqueta, copias e impresión NIIMBOT.', { maxW: 600 }),

      // 15 IMPORTAR/EXPORTAR
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('15. Importar y exportar datos', 1),
      H('15.1 Exportar a Excel', 2),
      P(t('Solo Administración. Cada sección tiene botones para exportar el contenido a un archivo Excel (formato .xlsx) listo para abrir en Excel u otro programa. El archivo incluye una hoja con los datos y, para uso de control interno, una hoja "SESION_ACTUAL". La exportación respeta el perfil: el perfil Ventas no expone precios.')),
      H('15.2 Importar desde Excel', 2),
      P(t('Permite cargar productos desde un archivo Excel. El sistema lee las columnas del inventario (código, proveedor, descripción, stock, ubicación, equivalencias, precio, control de fecha, etc.) y crea los productos. No duplica: si un código ya existe, actualiza los datos del existente.')),
      H('15.3 Respaldo y restauración (JSON)', 2),
      P(t('El sistema permite guardar un respaldo completo de la base en un archivo JSON y, ante un problema, restaurarlo. Al restaurar se marca el respaldo como "base restaurada". Esta operación queda registrada para auditoría.')),
      ...screenshot('15-exportar-excel-boton', 'Botón "Exportar Excel" en el encabezado de cada sección de inventario.', { maxW: 480 }),
      ...screenshot('15b-panel-respaldo-restaurar', 'Panel de respaldo de base de datos: descargar copia o restaurar desde archivo .json.', { maxW: 600 }),

      // 16 HISTORIAL
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('16. Historial de salidas y de ingresos', 1),
      H('16.1 Historial Salidas', 2),
      P(t('Accesible desde la sección "Historial Salidas". Muestra cada comprobante de salida con fecha, operador, persona que retiró, detalle de piezas y cantidades, y la opción de reimprimir el remito con la firma. Algunos roles pueden eliminar un comprobante (verificación de perfil).')),
      H('16.2 Historial Ingresos', 2),
      P(t('Accesible desde la sección "Historial Ingresos". Lista las entradas de stock registradas con su fecha, operador y detalle; permite continuar una operación nueva de ingreso.')),
      ...screenshot('16a-historial-salidas', 'Historial de salidas: cada fila es un comprobante reimprimible con su detalle.', { maxW: 600 }),
      ...screenshot('16b-historial-ingresos', 'Historial de ingresos: entradas de stock registradas con fecha y operador.', { maxW: 600 }),

      // 17 PANEL
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('17. Panel de Administración', 1),
      P(t('Solo Administración. Al iniciar sesión con ese perfil se abre automáticamente la vista "Administración". Resume la gestión en tarjetas de indicadores:')),
      items([
        'Valorización total del inventario (stock × precio).',
        'Unidades totales en existencia.',
        'Productos con stock disponible, stock bajo y sin stock.',
        'Stock antiguo o envejecido (sin movimientos recientes).',
        'Alertas destacadas para reponer productos.',
      ]),
      P(t('Desde aquí también se accede a los accesos rápidos de Salida/Entrada y a la configuración general.')),
      ...screenshot('17-panel-administracion', 'Panel de Administración con indicadores: valorización, unidades y estados de stock.', { maxW: 600 }),

      // 18 PAÑOLERO
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('18. Vista Pañolero (pantalla táctil)', 1),
      P(t('El perfil Pañolero inicia directamente en una pantalla simplificada y de botones grandes pensada para el trabajo diario en el pañol:')),
      items([
        'Búsqueda integrada: al escanear con el lector USB, el sistema busca el producto sin abrir ventanas.',
        'Botones táctiles "Salida" y "Entrada" siempre visibles.',
        'Cada producto muestra stock normal, stock P/SERVICIO y total a simple vista en tarjetas.',
        'Botón "Salir" para cerrar la sesión.',
      ]),
      ...screenshot('11f-panolero-scanner-salida', 'Desde la vista Pañolero, el botón táctil "SALIDA" abre la ventana de escaneo.', { maxW: 560 }),

      // 19 PROBLEMAS
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('19. Problemas frecuentes', 1),
      tableOf([
        ['El lector USB no abre la operación', 'Verificar que esté enchufado; escanear en un campo de texto vacío y comprobar que escriba el código. En Ventas abre la ficha; en Pañolero busca; en Administración abre Salida.'],
        ['La cámara no detecta el código', 'Usar buena luz, encuadrar completo el código de barras y mantener el celular quieto. Alternativa: escribir el código manualmente.'],
        ['La impresora NIIMBOT no conecta por Bluetooth', 'Verificar que esté encendida, sin otra conexión activa, y usar Chrome o Edge (Web Bluetooth).'],
        ['No conecta por USB', 'Usar Chrome o Edge (Web Serial), con la impresora conectada por cable y el símbolo que aparece en la impresora visible.'],
        ['La pantalla muestra el aviso offline', 'El sistema funciona de forma parcial sin conexión; los datos se sincronizan cuando se recupera Internet.'],
        ['No encuentra un producto que existe', 'Revisar que no haya filtros activos (subcategoría/ubicación/tipo) y probar con el buscador global.'],
      ], ['Síntoma', 'Solución']),

      // 20 GLOSARIO
      new Paragraph({ pageBreakBefore: true, children: [] }),
      H('20. Glosario', 1),
      tableOf([
        ['Pañol', 'Lugar físico donde se guardan los repuestos.'],
        ['Stock normal', 'Unidades disponibles para venta.'],
        ['Stock P/SERVICIO', 'Unidades reservadas para servicio técnico.'],
        ['Por encargo', 'Producto que no se guarda; se pide al proveedor.'],
        ['PWA', 'Aplicación web instalable que funciona además de forma parcial offline.'],
        ['NIIMBOT B1', 'Impresora de etiquetas de código de barras soportada por el sistema.'],
        ['Equivalencias', 'Códigos de otras marcas que corresponden al mismo repuesto.'],
        ['Subcategoría / modelo', 'Agrupación interna dentro de una categoría (por marca o modelo).'],
      ], ['Término', 'Definición']),

      new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '— Fin del manual —', italics: true, color: '94A3B8' })] }),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log('OK ->', outPath, `(${Math.round(buf.length / 1024)} KB)`);
}).catch(err => { console.error('ERROR', err); process.exit(1); });