const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://127.0.0.1:3000';
const TMP = 'C:\\Users\\MIGUE_~1\\AppData\\Local\\Temp\\opencode\\';
const FILE = TMP + 'test-hojas-categorias.xlsx';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(page, fn, timeout = 30000, step = 250) {
  const start = Date.now();
  for (;;) {
    try { if (await fn()) return true; } catch (e) {}
    if (Date.now() - start > timeout) return false;
    await sleep(step);
  }
}

async function clickButtonContaining(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find(e => (e.textContent || '').replace(/\s+/g, ' ').includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
  if (!ok) throw new Error('Boton no encontrado: ' + text);
  await sleep(600);
}

// Estado de sesion + inventario + historial, segun lo que se ve en pantalla
async function readState(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText;
    const navBtns = [...document.querySelectorAll('button')]
      .map(b => (b.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(t => /^(Pa|Cajones|Submi|Rodamientos|Entrepiso|Repuestos MV|Cajas|Historial)/.test(t));
    return {
      sesionActiva: text.includes('Cerrar Sesi'),
      enAdministracion: text.includes('Respaldo de base de datos'),
      usuariosGuardados: (() => {
        try {
          const raw = localStorage.getItem('verdu_inventory_users_list_v3');
          if (!raw) return false;
          const list = JSON.parse(raw);
          return list.some(u => u.rol === 'gerencia');
        } catch (e) { return false; }
      })(),
      sesionGuardada: !!localStorage.getItem('verdu_inventory_user_v3'),
      firmasGuardadas: localStorage.getItem('verdu_firmas_guardadas_v1') !== null,
      nav: navBtns,
      despachos: (text.match(/Historial Salidas\s*(\d+)/) || [])[1] || null,
      articulos: (text.match(/(\d+)\s*art(?:í|i)culos/i) || [])[1] || null
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
  page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
  page.on('dialog', async d => { console.log('DIALOG:', d.message().slice(0, 70).replace(/\n/g, ' ')); await d.accept(); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    localStorage.setItem('verdu_inventory_user_v3', JSON.stringify({ id: 'test-vaciar', username: 'admin', nombre: 'Matias', rol: 'gerencia' }));
    localStorage.setItem('verdu_inventory_users_list_v3', JSON.stringify([
      { id: 'usr-9', username: 'admin', nombre: 'Matias', rol: 'gerencia', password: 'clave123' },
      { id: 'usr-2', username: 'panol', nombre: 'Marcelo', rol: 'panolero', password: 'panol' }
    ]));
    localStorage.setItem('verdu_tour_seen_test-vaciar_v2', 'true');
    localStorage.setItem('verdu_inventory_last_activity_v1', String(Date.now())); // la sesion gerencia expira sin actividad reciente
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Cerrar Sesi')), 40000);
  // Firma guardada de prueba: debe sobrevivir al vaciado
  await page.evaluate(() => localStorage.setItem('verdu_firmas_guardadas_v1', JSON.stringify([{ id: 'f1', data: 'x' }])));
  await sleep(3500);

  const before = await readState(page);
  console.log('ANTES:' + JSON.stringify(before));
  const demoAntes = before.despachos;

// ---------- VACIAR ----------
// El boton "Vaciar la base de datos" vive dentro del desplegable "Respaldo de base de datos"
await clickButtonContaining(page, 'Respaldo de base de datos');
await sleep(500);
await clickButtonContaining(page, 'Vaciar la base de datos');
  const vaciado = await waitFor(page, () => page.evaluate(() => /fue vaciada|No se pudieron borrar/i.test(document.body.innerText)), 120000, 500);
  if (!vaciado) throw new Error('No se completo el vaciado.');
  const msg = await page.evaluate(() => {
    const t = document.body.innerText;
    return (t.match(/La base de datos fue vaciada[\s\S]{0,160}|La app qued[oó] vac[ií]a[\s\S]{0,220}/) || [])[0] || '';
  });
  console.log('MSG_VACIAR:' + JSON.stringify(msg.replace(/\s+/g, ' ').slice(0, 240)));
  const afterWipe = await readState(page);
  console.log('TRAS_VACIAR:' + JSON.stringify(afterWipe));

  // ---------- RECARGA: la sesion debe seguir y el historial no debe sembrar demo ----------
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Cerrar Sesi')), 40000);
  await sleep(3500);
  const afterReload = await readState(page);
  console.log('TRAS_RECARGA:' + JSON.stringify(afterReload));

  // ---------- CARGAR EXCEL DE PRUEBA ----------
  await clickButtonContaining(page, 'Carga Autom');
  await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Arrastra tu archivo Excel')), 15000);
  const input = await page.$('input[type=file]');
  await input.uploadFile(FILE);
  const parsed = await waitFor(page, () => page.evaluate(() => /CARGAR [1-9]\d* PRODUCTOS/.test(document.body.innerText)), 20000);
  if (!parsed) throw new Error('No se detectaron filas del Excel de prueba.');
  await clickButtonContaining(page, 'CARGAR ');
  const done = await waitFor(page, () => page.evaluate(() => document.body.innerText.includes('Completada con')), 120000, 500);
  if (!done) throw new Error('No se completo la carga del Excel.');
  const res = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      nuevos: (t.match(/nuevos art(?:í|i)culos\s*\+(\d+)/i) || [])[1] || null,
      actualizados: (t.match(/art(?:í|i)culos actualizados\s*(\d+)/i) || [])[1] || null
    };
  });
  console.log('CARGA:' + JSON.stringify(res));

  // Vista de una seccion para confirmar que los productos cargados estan
  await clickButtonContaining(page, 'Cerrar');
  await sleep(800);
  const nav = await readState(page);
  console.log('NAV_FINAL:' + JSON.stringify(nav.nav));

  await page.screenshot({ path: TMP + 'vaciar-carga.png' });
  await browser.close();

  const checks = {
    sesionConservada: afterWipe.sesionActiva && afterReload.sesionActiva,
    administracionSigue: afterWipe.enAdministracion && afterReload.enAdministracion,
    usuariosConservados: afterWipe.usuariosGuardados && afterReload.usuariosGuardados,
    firmasConservadas: afterWipe.firmasGuardadas,
    inventarioEnCero: afterReload.articulos === '0',
historialSinDemo: afterReload.despachos !== null && afterReload.despachos !== demoAntes,
    cargaCrea7: res.nuevos === '7' && res.actualizados === '0'
  };
  console.log('CHECKS:' + JSON.stringify(checks, null, 2));
  const pass = Object.values(checks).every(Boolean);
  console.log('RESULT:' + (pass ? 'PASS' : 'FAIL'));
  process.exit(pass ? 0 : 1);
})().catch(err => {
  console.error('ERROR: ' + (err && err.message ? err.message : err));
  process.exit(2);
});