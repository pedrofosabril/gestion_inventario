const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000/';
const TEST_EXCEL = path.join(__dirname, 'test-assets', 'test_import.xlsx');

const USR_KEY = 'verdu_inventory_user_v2';
const USERS_KEY = 'verdu_inventory_users_list_v2';

const GERENCIA = { id: 'usr-9', username: 'admin', nombre: 'Administración', rol: 'gerencia', password: 'Admin#2026' };
const USERS = [
  GERENCIA,
  { id: 'usr-2', username: 'panol', nombre: 'Marcelo', rol: 'panolero', password: 'panol' },
  { id: 'usr-4', username: 'ventas', nombre: 'Ventas', rol: 'ventas', password: 'ventas' },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function newPage(browser, user = GERENCIA) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(({ user, users, usrKey, usersKey }) => {
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set(usrKey, user);
    set(usersKey, users);
    localStorage.setItem('verdu_tour_seen_' + user.id + '_v2', 'true');
  }, { user, users: USERS, usrKey: USR_KEY, usersKey: USERS_KEY });
  return page;
}

async function clickText(page, text, { scope = 'document', timeout = 10000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ok = await page.evaluate((txt, sc) => {
      const root = sc === 'document' ? document : document.querySelector(sc);
      if (!root) return false;
      const btn = [...root.querySelectorAll('button')].find(b =>
        (b.textContent || '').replace(/\s+/g, ' ').trim().includes(txt));
      if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
      return false;
    }, text, scope);
    if (ok) return;
    await sleep(300);
  }
  throw new Error('Botón no hallado: ' + text);
}

async function waitText(page, text, { timeout = 20000 } = {}) {
  await page.waitForFunction(
    (txt) => document.body.innerText.replace(/\s+/g, ' ').includes(txt),
    { timeout },
    text
  );
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const ONLY = process.argv[2] || '1';

  if (ONLY !== '2') {
  // ============ TEST 1: VACIAR ============
  console.log('\n--- TEST 1: Vaciar base de datos ---');
  const page = await newPage(browser);
  page.on('dialog', async (d) => { console.log('  dialog:', d.message().slice(0, 60)); await d.accept(); });

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForSelector('header', { timeout: 30000 });
  await sleep(2500);

  await clickText(page, 'Respaldo de base de datos', { scope: 'main' });
  await sleep(700);
  await clickText(page, 'Vaciar la base de datos');
  console.log('  confirmaciones aceptadas (2)');
  await sleep(2000);

  await waitText(page, 'Iniciar Sesión', { timeout: 15000 });
  console.log('  OK: session cerrada (localStorage limpiado) -> pantalla de inicio');
  await browser.close();
  console.log('  TERMINADO TEST 1');
  }

  // ============ TEST 2: IMPORTAR EXCEL ============
  console.log('\n--- TEST 2: Importar Excel y persistencia ---');
  const b2 = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const p2 = await newPage(b2);
  await p2.goto(BASE, { waitUntil: 'networkidle2', timeout: 45000 });
  await p2.waitForSelector('header', { timeout: 30000 });
  await sleep(2500);

  await clickText(p2, 'Carga Automática de Productos desde Excel', { scope: 'main' });
  await sleep(800);

  const input = await p2.$('input[type="file"]');
  if (!input) throw new Error('input de archivo no encontrado');
  await input.uploadFile(TEST_EXCEL);
  console.log('  archivo subido:', TEST_EXCEL);

  await waitText(p2, 'Vista Previa', { timeout: 15000 });
  console.log('  vista previa OK');

  await clickText(p2, 'PRODUCTOS AUTOMÁTICAMENTE');
  console.log('  importación ejecutada, esperando confirmación...');
  await waitText(p2, 'Completada con Éxito', { timeout: 60000 });
  await sleep(1500);
  console.log('  OK: importación exitosa en la app');

  // Persistencia tras recarga
  await p2.reload({ waitUntil: 'networkidle2' });
  await p2.waitForSelector('header', { timeout: 30000 });
  await sleep(2500);
  await waitText(p2, 'TEST-001', { timeout: 20000 });
  console.log('  OK: TEST-001 visible tras recargar (persistió en Supabase)');

  await b2.close();
  console.log('  TERMINADO TEST 2');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });