const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const SHOT = process.env.SIG_SHOT || 'C:\\Users\\MIGUE_~1\\AppData\\Local\\Temp\\opencode\\firma_tableta.png';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(page, fn, timeout = 25000, step = 200) {
  const start = Date.now();
  for (;;) {
    try {
      if (await fn()) return true;
    } catch (e) {}
    if (Date.now() - start > timeout) return false;
    await sleep(step);
  }
}

async function clickByText(page, text, selector = 'button') {
  const ok = await page.evaluate((sel, t) => {
    const els = [...document.querySelectorAll(sel)];
    const el = els.find(e => e.textContent && e.textContent.trim() === t);
    if (el) { el.click(); return true; }
    return false;
  }, selector, text);
  if (!ok) throw new Error('Botón no encontrado: ' + text);
  await sleep(300);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,800']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('PAGE[' + m.type() + ']:', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { localStorage.clear(); });
  const user = { id: 'test-firma-gerencia', username: 'admin', nombre: 'Matias', rol: 'gerencia' };
  await page.evaluate((u) => {
    localStorage.setItem('verdu_inventory_user_v2', JSON.stringify(u));
    localStorage.setItem('verdu_tour_seen_' + u.id + '_v2', 'true');
  }, user);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});

  const loggedIn = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Cerrar Sesión')), 40000);
  if (!loggedIn) {
    const dd = await page.evaluate(() => ({ snip: document.body.innerText.slice(0, 200), user: localStorage.getItem('verdu_inventory_user_v2') }));
    throw new Error('No se pudo iniciar sesión (usuario seed). dump=' + JSON.stringify(dd));
  }
  console.log('STEP: logueado');
  await page.click('body');
  await page.keyboard.type('SINTEST');
  await page.keyboard.press('Enter');
  const scannerOpen = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Carga manual')), 15000);
  if (!scannerOpen) throw new Error('No se abrió el ScannerModal.');
  console.log('STEP: scanner abierto');

  await clickByText(page, 'Carga manual');
  await sleep(1500);
  const manualState = await page.evaluate(() => ({
    busca: document.body.innerText.includes('Busc'),
    inputCount: document.querySelectorAll('input[placeholder*="Escribe código"]').length,
    totalLen: document.body.innerText.length,
    tail: document.body.innerText.slice(-500)
  }));
  console.log('DEBUG manual:', JSON.stringify(manualState));
  const manualOpen = await waitFor(page, () => page.evaluate(() => document.body.innerText.toLowerCase().includes('buscar producto por código')), 10000);
  if (!manualOpen) {
    const dd = await page.evaluate(() => document.body.innerText.slice(-600));
    throw new Error('No se abrió el ManualEntryModal. dump=' + dd);
  }
  console.log('STEP: manual abierto');

  await page.evaluate(() => {
    const inp = document.querySelector('input[placeholder*="Escribe código"]');
    if (inp) inp.focus();
  });
  await page.keyboard.type('a');
  const found = await waitFor(page, () => page.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return t.includes('resultados (') && !t.includes('no se encontraron repuestos');
  }), 15000);
  if (!found) throw new Error('Sin resultados en catálogo.');

  const clickedRow = await clickResultRow(page);
  if (!clickedRow) throw new Error('No se pudo seleccionar un producto con stock.');

  await sleep(400);
  const addBtn = await waitFor(page, () => page.evaluate(() => [...document.querySelectorAll('button')].some(b => /Agregar \d+ u\. a Salida/.test(b.innerText)), 10000));
  if (!addBtn) throw new Error('No apareció el botón "Agregar a Salida".');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => /Agregar \d+ u\. a Salida/.test(b.innerText));
    if (b) b.click();
  });
  await sleep(400);

  const finalize = await waitFor(page, () => page.evaluate(() => [...document.querySelectorAll('button')].some(b => /Finalizar y Retirar Salida/.test(b.innerText)), 15000));
  if (!finalize) throw new Error('No apareció "Finalizar y Retirar Salida".');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => /Finalizar y Retirar Salida/.test(b.innerText));
    if (b) b.click();
  });

  const receiptOpen = await waitFor(page, () => page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.title === 'Habilitar firma digital para este comprobante')), 20000);
  if (!receiptOpen) throw new Error('No se abrió el comprobante de salida.');

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.title === 'Habilitar firma digital para este comprobante');
    if (b) b.click();
  });

  const padOpen = await waitFor(page, () => page.evaluate(() => [...document.querySelectorAll('canvas')].some(c => c.parentElement && c.parentElement.className.includes('border-dashed'))), 15000);
  if (!padOpen) throw new Error('No se abrió el SignaturePad.');

  await sleep(1200); // deja terminar animación + ResizeObserver

  const metrics = await page.evaluate(() => {
    const out = { viewport: { w: window.innerWidth, h: window.innerHeight } };
    const cv = [...document.querySelectorAll('canvas')].find(c => c.parentElement && c.parentElement.className.includes('border-dashed'));
    if (!cv) { out.error = 'canvas no encontrado'; return out; }
    const cr = cv.getBoundingClientRect();
    out.canvas = { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) };
    const fr = cv.parentElement.getBoundingClientRect();
    out.frame = { x: Math.round(fr.x), y: Math.round(fr.y), w: Math.round(fr.width), h: Math.round(fr.height) };
    const card = cv.closest('[class*="rounded-3xl"]');
    if (card) {
      const c = card.getBoundingClientRect();
      out.card = { x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.width), h: Math.round(c.height) };
    }
    out.coverageW = Math.round((out.canvas.w / out.viewport.w) * 100);
    out.coverageH = Math.round((out.canvas.h / out.viewport.h) * 100);
    return out;
  });

  console.log('METRICS:' + JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: SHOT, fullPage: false });

  await browser.close();

  const pass = metrics.coverageW >= 90;
  console.log('RESULT:' + (pass ? 'PASS' : 'FAIL') + ' coberturaAncho=' + metrics.coverageW + '% alto=' + metrics.coverageH + '%');
  process.exit(pass ? 0 : 1);
})().catch(err => {
  console.error('ERROR: ' + (err && err.message ? err.message : err));
  process.exit(2);
});

async function clickResultRow(page) {
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const el = btns.find(b => {
      if (!b.querySelector('p')) return false;
      const m = (b.textContent || '').match(/(\d+)\s*u\./);
      const stock = m ? parseInt(m[1], 10) : 0;
      return stock > 0;
    });
    if (el) { el.click(); return true; }
    return false;
  });
  return clicked;
}