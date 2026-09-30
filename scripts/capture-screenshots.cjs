const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000/';
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const USR_KEY = 'verdu_inventory_user_v2';
const USERS_KEY = 'verdu_inventory_users_list_v2';

const USERS = [
  { id: 'usr-9', username: 'admin', nombre: 'Administración', rol: 'gerencia', password: 'Admin#2026' },
  { id: 'usr-2', username: 'panol', nombre: 'Marcelo', rol: 'panolero', password: 'panol' },
  { id: 'usr-4', username: 'ventas', nombre: 'Ventas', rol: 'ventas', password: 'ventas' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fails = [];

function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });
}

async function newPage(browser, user) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  if (user) {
    await page.evaluateOnNewDocument(({ user, users, usrKey, usersKey }) => {
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set(usrKey, user);
      set(usersKey, users);
      localStorage.setItem('verdu_tour_seen_' + user.id + '_v2', 'true');
      localStorage.setItem('verdu_tour_seen_v2', 'true');
    }, { user, users: USERS, usrKey: USR_KEY, usersKey: USERS_KEY });
  }
  return page;
}

async function shot(page, name, { fullPage = false, el = null } = {}) {
  await sleep(700);
  const file = path.join(OUT, name + '.png');
  try {
    if (el) {
      const handle = await page.$(el);
      if (!handle) throw new Error('elemento no encontrado: ' + el);
      await handle.screenshot({ path: file });
    } else {
      await page.screenshot({ path: file, fullPage });
    }
    const size = fs.statSync(file).size;
    console.log('  shot:', name, '(' + Math.round(size / 1024) + ' KB)');
  } catch (e) {
    fails.push(name + ' -> ' + e.message);
    console.log('  FALLO shot:', name, '->', e.message);
  }
}

async function clickText(page, text, { scope = 'document', index = 0, timeout = 9000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await page.evaluate((txt, sc, ix) => {
      const root = sc === 'document' ? document : document.querySelector(sc);
      if (!root) return false;
      const btns = [...root.querySelectorAll('button')];
      const el = btns.filter(b => (b.textContent || '').replace(/\s+/g, ' ').trim().includes(txt))[ix];
      if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
      return false;
    }, text, scope, index);
    if (ok) return;
    await sleep(300);
  }
  throw new Error('botón no hallado: ' + text + ' (scope=' + scope + ')');
}

async function clickTitle(page, title, { timeout = 9000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const ok = await page.evaluate((ttl) => {
      const el = [...document.querySelectorAll('button')].find(b => (b.title || '').includes(ttl));
      if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
      return false;
    }, title);
    if (ok) return;
    await sleep(300);
  }
  throw new Error('botón por título no hallado: ' + title);
}

async function closeModal(page) {
  let ok = await page.evaluate(() => {
    const stacked = [...document.querySelectorAll('.fixed')];
    for (const ov of stacked) {
      const btns = [...ov.querySelectorAll('button')];
      const x = btns.find(b => b.querySelector('.lucide-x') && (b.title || '').toLowerCase().includes('cerrar'));
      if (x && x.offsetParent !== null) { x.click(); return true; }
      const cancel = btns.find(b => b.offsetParent !== null && /^Cancelar$/.test((b.textContent || '').trim()));
      if (cancel) { cancel.click(); return true; }
    }
    return false;
  });
  if (!ok) await page.keyboard.press('Escape');
  await sleep(600);
}

const ready = async (page) => {
  await page.waitForSelector('header', { timeout: 30000 });
  await sleep(2500);
};

async function run() {
  // ============ 1) BIENVENIDA / LOGIN (sin sesión) ============
  {
    const browser = await launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
    await clickText(page, 'Iniciar Sesión');
    await shot(page, '02a-iniciar-sesion');
    await clickText(page, 'Crear Cuenta');
    await shot(page, '02b-crear-cuenta');
    await browser.close();
  }

  // ============ 2) ADMINISTRACIÓN (gerencia) ============
  const browser = await launch();
  const page = await newPage(browser, USERS[0]);

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await ready(page);
  await sleep(1500);
  await shot(page, '17-panel-administracion');

  // Topbar y barra de categorías
  await shot(page, '04a-barra-inferior-acciones', { el: 'header' });
  await shot(page, '04b-barra-secciones', { el: 'header nav' });

  // Tabla stock (sección Pañol)
  await clickText(page, 'Pañol (General)', { scope: 'header nav' });
  await ready(page);
  await shot(page, '06-tabla-stock-normal-pservicio', { fullPage: false });
  await shot(page, '05-barra-secciones-categorias', { el: 'header nav' });

  // Búsqueda global
  await page.click('#buscador-global');
  await page.type('#buscador-global', '02250', { delay: 30 });
  await sleep(1200);
  const hasResults = await page.evaluate(() => !!document.querySelector('.max-h-80 .cursor-pointer'));
  if (hasResults) {
    await shot(page, '07-buscador-global');
    await page.evaluate(() => document.querySelector('.max-h-80 .cursor-pointer').click());
    await sleep(900);
    await shot(page, '08-ficha-producto');
  } else {
    fails.push('busqueda-sin-resultados -> no habia dropdown');
  }
  await closeModal(page);

  // Alta de producto
  await clickTitle(page, 'Dar de alta un producto manualmente en el inventario');
  await sleep(900);
  await shot(page, '09-alta-producto');
  await closeModal(page);

  // Editar producto
  await clickTitle(page, 'Editar todo el registro del producto');
  await sleep(900);
  await shot(page, '10-editar-producto');
  await closeModal(page);

  // --- Movimientos (scanner) ---
  await clickText(page, 'Salida', { scope: 'header' });
  await sleep(900);
  await shot(page, '11a-scanner-salida');
  await page.waitForSelector('input[placeholder^="Escanear"]', { timeout: 8000 });
  await page.type('input[placeholder^="Escanear"]', '02250127-684', { delay: 25 });
  await sleep(1200);
  await shot(page, '11b-scanner-salida-producto');
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle2' });
  await ready(page);

  await clickText(page, 'Devolución', { scope: 'header' });
  await sleep(900);
  await shot(page, '11c-scanner-devolucion');
  await page.reload({ waitUntil: 'networkidle2' });
  await ready(page);

  await clickText(page, 'Entrada', { scope: 'header' });
  await sleep(900);
  await shot(page, '11d-scanner-ingreso');
  await page.reload({ waitUntil: 'networkidle2' });
  await ready(page);

  // Cámara (dentro del scanner de salida)
  await clickText(page, 'Salida', { scope: 'header' });
  await sleep(800);
  const camOk = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.querySelector('.lucide-camera'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  await sleep(1000);
  await shot(page, '11e-scanner-camara');
  if (!camOk) fails.push('camara -> boton camara no hallado');
  await page.reload({ waitUntil: 'networkidle2' });
  await ready(page);

  // Etiqueta de código de barras
  await clickText(page, 'Pañol (General)', { scope: 'header nav' });
  await ready(page);
  await clickTitle(page, 'Código de barras');
  await sleep(1000);
  await shot(page, '14-etiqueta-codigo-barras');
  await closeModal(page);

  // Exportar (toolbar visible)
  await shot(page, '15-exportar-excel-boton');

  // Historial de salidas + comprobante
  await clickText(page, 'Historial Salidas', { scope: 'header nav' });
  await ready(page);
  await shot(page, '16a-historial-salidas');
  try {
    await clickText(page, 'Ver Comprobante', { scope: 'main' });
    await sleep(1000);
    await shot(page, '12-remito-salida');
  } catch (e) {
    fails.push('remito -> sin comprobantes para ver: ' + e.message);
  }
  await closeModal(page);

  // Historial de ingresos
  await clickText(page, 'Historial Ingresos', { scope: 'header nav' });
  await ready(page);
  await shot(page, '16b-historial-ingresos');

  // Respaldo / restauración
  await clickText(page, 'Administración', { scope: 'header nav' });
  await ready(page);
  try {
    await clickText(page, 'Respaldo de base de datos', { scope: 'main' });
    await sleep(900);
    await shot(page, '15b-panel-respaldo-restaurar');
  } catch (e) {
    fails.push('respaldo -> ' + e.message);
  }
  await browser.close();

  // ============ 3) PAÑOLERO ============
  {
    const b = await launch();
    const p = await newPage(b, USERS[1]);
    await p.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
    await ready(p);
    await shot(p, '18-panolero-principal');
    await clickText(p, 'SALIDA', { scope: 'main' });
    await sleep(900);
    await shot(p, '11f-panolero-scanner-salida');
    await b.close();
  }

  // ============ 4) VENTAS ============
  {
    const b = await launch();
    const p = await newPage(b, USERS[2]);
    await p.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
    await ready(p);
    await shot(p, '13-ventas-inventario');
    await clickText(p, 'Cajones / Fluidos', { scope: 'header nav' });
    await ready(p);
    await shot(p, '13b-ventas-cajones');
    await b.close();
  }

  console.log('\n=== RESUMEN ===');
  console.log(fails.length === 0 ? 'Sin fallos :)' : 'FALLOS (' + fails.length + '):');
  fails.forEach(f => console.log('  - ' + f));
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });