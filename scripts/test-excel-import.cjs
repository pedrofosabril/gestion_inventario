const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const TMP = 'C:\\Users\\MIGUE_~1\\AppData\\Local\\Temp\\opencode\\';
const FILE1 = TMP + 'test-hojas-categorias.xlsx';
const FILE2 = TMP + 'test-hojas-categorias-v2.xlsx';
const SHOT = TMP + 'excel-import.png';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(page, fn, timeout = 25000, step = 200) {
  const start = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) {}
    if (Date.now() - start > timeout) return false;
    await sleep(step);
  }
}

async function clickByText(page, text, selector = 'button') {
  const ok = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.textContent && e.textContent.trim().startsWith(t));
    if (el) { el.click(); return true; }
    return false;
  }, selector, text);
  if (!ok) throw new Error('Boton no encontrado: ' + text);
  await sleep(400);
}

async function readImportUI(page) {
  return await page.evaluate(() => {
    const selects = [...document.querySelectorAll('select')];
    const sheetInfo = selects.map(s => ({
      value: s.value,
      label: s.options[s.selectedIndex] ? s.options[s.selectedIndex].text.trim() : null,
      disabled: s.disabled
    }));
    const checkboxes = [...document.querySelectorAll('input[type=checkbox]')].map(c => c.checked);
    const text = document.body.innerText;
    return {
      sheetInfo,
      checkboxes,
      selectedRows: (text.match(/(\d+) filas seleccionadas/) || [])[1] || null,
      cagarBtn: (text.match(/CARGAR (\d+) PRODUCTOS/) || [])[1] || null,
      replacePreselected: !!document.querySelector('button.border-amber-500'),
      preview: (text.match(/Mostrando primeras \d+ de (\d+)/) || [])[1] || null
    };
  });
}

async function readResultPanel(page) {
  return await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      nuevos: (t.match(/nuevos art(?:í|i)culos\s*\+(\d+)/i) || [])[1] || null,
      actualizados: (t.match(/art(?:í|i)culos actualizados\s*(\d+)/i) || [])[1] || null,
      valuacion: (t.match(/valoraci(?:ó|i)n cargada\s*\$?\s*([\d.,]+)/i) || [])[1] || null
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { localStorage.clear(); });
  const user = { id: 'test-excel-gerencia', username: 'admin', nombre: 'Matias', rol: 'gerencia' };
  await page.evaluate((u) => {
    localStorage.setItem('verdu_inventory_user_v2', JSON.stringify(u));
    localStorage.setItem('verdu_tour_seen_' + u.id + '_v2', 'true');
  }, user);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});

  const loggedIn = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Cerrar Ses')), 40000);
  if (!loggedIn) throw new Error('No se pudo iniciar sesion.');
  console.log('STEP: logueado (vista Administracion)');

  await clickByText(page, 'Carga Autom');
  const modalOpen = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Arrastra tu archivo Excel')), 15000);
  if (!modalOpen) throw new Error('No se abrio el modal de carga Excel.');
  console.log('STEP: modal abierto');

  // ---------- FASE A: parseo + categorias (sin ejecutar la carga) ----------
  const input1 = await page.$('input[type=file]');
  await input1.uploadFile(FILE1);
  const parsed = await waitFor(page, () => page.evaluate(() => /CARGAR [1-9]\d* PRODUCTOS/.test(document.body.innerText)), 20000);
  if (!parsed) throw new Error('No se detectaron filas tras cargar el archivo.');
  const ui1 = await readImportUI(page);
  console.log('FASE_A:' + JSON.stringify(ui1));
  await page.screenshot({ path: TMP + 'excel-import-ui.png' });

  // ---------- FASE B: ejecutar carga (modo Reemplazar por codigo) ----------
  await clickByText(page, 'CARGAR ');
  const done1 = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Completada con')), 120000, 500);
  if (!done1) {
    const dump = await page.evaluate(() => document.body.innerText.slice(-800));
    throw new Error('No se completo la primera carga. dump=' + dump);
  }
  const res1 = await readResultPanel(page);
  console.log('FASE_B:' + JSON.stringify(res1));

  // ---------- FASE C: segunda carga con stock cambiado y una fila OMITIDA ----------
  await clickByText(page, 'Cargar Otro Archivo');
  await waitFor(page, () => page.evaluate(() => /Arrastra tu archivo Excel/.test(document.body.innerText)), 15000);
  const input2 = await page.$('input[type=file]');
  await input2.uploadFile(FILE2);
  const parsed2 = await waitFor(page, () => page.evaluate(() => /CARGAR 6 PRODUCTOS/.test(document.body.innerText)), 20000);
  if (!parsed2) throw new Error('No se detectaron filas en el segundo archivo.');
  const ui2 = await readImportUI(page);
  console.log('FASE_C_UI:' + JSON.stringify(ui2));

  await clickByText(page, 'CARGAR ');
  const done2 = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Completada con')), 120000, 500);
  if (!done2) throw new Error('No se completo la segunda carga.');
  const res2 = await readResultPanel(page);
  console.log('FASE_C:' + JSON.stringify(res2));

  await page.screenshot({ path: SHOT });
  await browser.close();

  const expCats = ['cajones_fluidos', 'submicronicos', 'rodamientos', 'panol'];
  const checks = {
    categoriasAuto: JSON.stringify(ui1.sheetInfo.map(s => s.value)) === JSON.stringify(expCats),
    hojasIncluidas: ui1.checkboxes.length === 4 && ui1.checkboxes.every(Boolean),
    filasTotales: ui1.selectedRows === '7' && ui1.preview === '7',
    modoReplacePorDefecto: ui1.replacePreselected,
    botonCargar: ui1.cagarBtn === '7',
    carga1_nuevos7_actualizados0: res1.nuevos === '7' && res1.actualizados === '0',
    carga2_filas6: ui2.selectedRows === '6' && ui2.preview === '6',
    carga2_nuevos0_actualizados6: res2.nuevos === '0' && res2.actualizados === '6'
  };
  console.log('CHECKS:' + JSON.stringify(checks, null, 2));
  const pass = Object.values(checks).every(Boolean);
  console.log('RESULT:' + (pass ? 'PASS' : 'FAIL'));
  process.exit(pass ? 0 : 1);
})().catch(err => {
  console.error('ERROR: ' + (err && err.message ? err.message : err));
  process.exit(2);
});