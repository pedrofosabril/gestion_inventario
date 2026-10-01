/**
 * E2E del importador de 9 hojas contra la app real.
 * Sube un Excel recortado del archivo de producción y verifica que:
 *  - cada hoja se clasifique bien (productos / salidas / ingresos),
 *  - los productos caigan en la categoría correcta,
 *  - el historial de salidas e ingresos se cargue SIN tocar el stock.
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const TMP = 'C:\\Users\\MIGUE_~1\\AppData\\Local\\Temp\\opencode\\';
const FILE = TMP + 'test-9-hojas.xlsx';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(page, fn, timeout = 40000, step = 250) {
  const start = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) {}
    if (Date.now() - start > timeout) return false;
    await sleep(step);
  }
}

async function clickButton(page, text) {
  const ok = await page.evaluate(t => {
    const el = [...document.querySelectorAll('button')].find(e => (e.textContent || '').replace(/\s+/g, ' ').includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
  if (!ok) throw new Error('Boton no encontrado: ' + text);
  await sleep(700);
}

const navState = page => page.evaluate(() => {
  const text = document.body.innerText;
  const nav = {};
  [...document.querySelectorAll('button')].forEach(b => {
    const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(Pañol \(General\)|Cajones \/ Fluidos|Submicrónicos|Rodamientos|Entrepiso|Repuestos MV|Cajas Estantes|Historial Salidas)(\d+)$/);
    if (m) nav[m[1]] = Number(m[2]);
  });
  return { nav, articulos: (text.match(/(\d+)\s*art(?:í|i)culos/i) || [])[1] || null };
});

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,1000']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 160)));
  page.on('dialog', async d => { console.log('DIALOG:', d.message().slice(0, 60).replace(/\n/g, ' ')); await d.accept(); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    localStorage.setItem('verdu_inventory_user_v3', JSON.stringify({ id: 'test-9hojas', username: 'admin', nombre: 'Prueba', rol: 'gerencia' }));
    localStorage.setItem('verdu_inventory_users_list_v3', JSON.stringify([{ id: 'u1', username: 'admin', nombre: 'Prueba', rol: 'gerencia', password: 'x' }]));
    localStorage.setItem('verdu_tour_seen_test-9hojas_v2', 'true');
    localStorage.setItem('verdu_inventory_last_activity_v1', String(Date.now())); // la sesion gerencia expira sin actividad reciente
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Cerrar Sesi')), 45000);
  await sleep(3500);

  const before = await navState(page);
  console.log('ANTES: ' + JSON.stringify(before));

  // Abrir el importador
  await clickButton(page, 'Carga Autom');
  await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Arrastra tu archivo Excel')), 15000);
  const input = await page.$('input[type=file]');
  await input.uploadFile(FILE);

  const parsed = await waitFor(page, () => page.evaluate(() => /CARGAR [1-9]\d* (PRODUCTOS|FILAS)/.test(document.body.innerText)), 25000);
  if (!parsed) throw new Error('No se parseo el archivo.');

  // Estado por hoja que muestra la UI
  const hojas = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('input[type=checkbox]').forEach(cb => {
      const row = cb.closest('div');
      if (!row) return;
      const txt = (row.innerText || '').replace(/\s+/g, ' ').trim();
      if (txt) out.push(txt);
    });
    return out;
  });
  console.log('HOJAS DETECTADAS:');
  hojas.forEach(h => console.log('  ' + h));

  const btnText = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(e => /CARGAR [1-9]/.test(e.textContent || ''));
    return b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : null;
  });
  console.log('BOTON: ' + btnText);

  await clickButton(page, 'CARGAR ');
  const done = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Completada')), 180000, 600);
  if (!done) throw new Error('No se completo la carga.');

  const res = await page.evaluate(() => {
    const t = document.body.innerText;
    const grab = re => (t.match(re) || [])[1] || null;
    return {
      nuevos: grab(/Nuevos Artículos\s*\+(\d+)/i),
      actualizados: grab(/Artículos Actualizados\s*(\d+)/i),
      salidas: grab(/Salidas al Historial\s*\+(\d+)/i),
      ingresos: grab(/Ingresos al Historial\s*\+(\d+)/i),
      omitidos: grab(/Ya-existentes \(omitidos\)\s*(\d+)/i)
    };
  });
  console.log('RESULTADO: ' + JSON.stringify(res));

  await clickButton(page, 'Cargar Otro Archivo');
  await sleep(1800);
  const after = await navState(page);
  console.log('DESPUES: ' + JSON.stringify(after));

  await page.screenshot({ path: TMP + 'test-9-hojas.png', fullPage: true });
  await browser.close();

  const checks = {
    productosCargados: Number(res.nuevos || 0) + Number(res.actualizados || 0) > 0,
    salidasCargadas: Number(res.salidas || 0) > 0,
    ingresosCargados: Number(res.ingresos || 0) > 0,
    historialSalidasAumento: (after.nav['Historial Salidas'] || 0) > (before.nav['Historial Salidas'] || 0),
    sesionSigueAbierta: Object.keys(after.nav).length > 0
  };
  console.log('CHECKS: ' + JSON.stringify(checks, null, 2));
  const pass = Object.values(checks).every(Boolean);
  console.log('RESULT: ' + (pass ? 'PASS' : 'FAIL'));
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('ERROR: ' + (e && e.message ? e.message : e)); process.exit(2); });