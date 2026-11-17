/* Real installed-PWA upgrade. Public assets and synthetic local data only. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');

const root = process.cwd();
const out = path.join(root, 'artifacts-ui');
fs.mkdirSync(out, { recursive: true });
const git = (...args) => cp.execFileSync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });
const base = git('rev-parse', process.env.UI_BASE || 'origin/main').toString().trim();
assert.match(base, /^[a-f0-9]{40}$/);
const beforeBuild = JSON.parse(git('show', base + ':BUILD.json'));
const baseline = new Map([...new Set([...Object.keys(beforeBuild.files), 'appelli.json', 'BUILD.json'])]
  .map(name => [name, git('show', base + ':' + name)]));
const version = source => /const VERSION = "([^"]+)"/.exec(source)?.[1];
const oldVersion = version(baseline.get('sw.js').toString());
const newVersion = version(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'));
const report = { base, oldVersion, newVersion, checks: 0, cases: [], errors: [] };
const check = (ok, label) => { report.checks++; assert.ok(ok, label); };
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
let serving = 'before';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!url.pathname.startsWith('/app/')) { res.writeHead(404); res.end(); return; }
  const rel = decodeURIComponent(url.pathname.slice('/app/'.length)) || 'index.html';
  const target = path.resolve(root, rel);
  if (!target.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  const data = serving === 'before' ? baseline.get(rel) : (fs.existsSync(target) && fs.statSync(target).isFile() ? fs.readFileSync(target) : null);
  if (!data) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/app/' });
  res.end(data);
});

async function preservedData(page) {
  return page.evaluate(async () => {
    const record = window.STUDIOOS_STUDY.snapshot().errors.find(x => x.id === 'cache-update-record');
    const idb = await new Promise((resolve, reject) => {
      const req = indexedDB.open('focus-ui-cache-sentinel', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const get = db.transaction('records').objectStore('records').get('one');
        get.onerror = () => { db.close(); reject(get.error); };
        get.onsuccess = () => { db.close(); resolve(get.result); };
      };
    });
    const run = window.STUDIOOS_STUDY.current().run;
    return { sentinel: localStorage.getItem('focus-ui-cache-sentinel'), record, idb, run: run && { runId: run.runId, phase: run.phase, status: run.status, notes: run.notes } };
  });
}

async function installedUpgrade(browser, origin, engine, active) {
  serving = 'before';
  const item = { engine, activeSession: active, ok: false };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow', colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(() => {
    if (localStorage.getItem('focus-ui-cache-seeded')) return;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const block = { id: 'R20-9001', mat: 'MDP', date, from: '00:00', to: '23:59', min: 90, arg: 'Sessione sintetica: aggiornamento PWA', cons: 'SCALETTA: 00:00–00:35 Teoria — Apri: demo.pdf — Fai: Leggi le definizioni.\nVerifica finale: spiega il risultato.' };
    localStorage.setItem('sfocus.unlinked.index', JSON.stringify({ at: Date.now(), idx: { [block.id]: block } }));
    localStorage.setItem('sfocus.settings', JSON.stringify({ theme: 'light', look: 'std', rm: true, smart: false, auto: false, work: 50, brk: 10, wake: false, haptic: false, sound: 'none', amb: 'none' }));
    localStorage.setItem('focus-ui-cache-sentinel', 'local data survives application cache replacement');
    localStorage.setItem('focus-ui-cache-seeded', '1');
  });
  try {
    await page.goto(origin + '/app/?norel#focus', { waitUntil: 'load' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller && !!window.STUDIOOS_STUDY);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.STUDIOOS_STUDY?.snapshot);
    check(await page.evaluate(expected => caches.has(expected), oldVersion), engine + ': old shell installed');
    check(await page.locator('#ui-glass-guide').count() === 0, engine + ': baseline is the original shell');
    await page.evaluate(async () => {
      await window.STUDIOOS_STUDY.saveError({ id: 'cache-update-record', materia: 'MDP', text: 'Synthetic saved study record', fix: 'Preserve through the cache upgrade', at: Date.now() });
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('focus-ui-cache-sentinel', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('records');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result, tx = db.transaction('records', 'readwrite');
          tx.objectStore('records').put({ id: 'one', note: 'Unrelated IndexedDB storage is preserved' }, 'one');
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
    });
    if (active) {
      await page.locator('#bStudy').click();
      await page.waitForFunction(() => window.STUDIOOS_STUDY.current().run?.phase === 'work');
      await page.locator('#notes').fill('Punto sintetico prima del nuovo service worker.');
      await page.locator('#notes').press('Tab');
      await page.waitForFunction(() => window.STUDIOOS_STUDY.current().run?.notes === 'Punto sintetico prima del nuovo service worker.');
    }
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.STUDIOOS_STUDY?.snapshot);
    check(await page.locator('#ui-glass-guide').count() === 0, engine + ': installed old shell reloads offline');
    const before = await preservedData(page);
    check(!!before.record && !!before.idb && !!before.sentinel, engine + ': synthetic local data stored before upgrade');
    if (active) check(before.run?.phase === 'work', engine + ': old offline shell restores the running session');
    await context.setOffline(false);
    await page.evaluate(() => { window.__cacheUpdateOldDocument = 'kept until safe to reload'; });
    serving = 'after';
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
    if (active) {
      await page.waitForFunction(() => document.getElementById('toasts')?.textContent.includes('Nuova versione installata'));
      check(await page.evaluate(() => window.__cacheUpdateOldDocument === 'kept until safe to reload'), engine + ': update leaves the active document running');
      check(await page.locator('#ui-glass-guide').count() === 0, engine + ': active old UI stays until reopening');
      const during = await preservedData(page);
      check(during.run?.runId === before.run.runId && during.run.phase === 'work' && during.run.notes === before.run.notes, engine + ': run and notes survive controller change');
      await page.reload({ waitUntil: 'load' });
    } else {
      await page.waitForSelector('#ui-glass-guide', { state: 'attached' });
      check(await page.evaluate(() => window.__cacheUpdateOldDocument === undefined), engine + ': idle document automatically reloads into the new shell');
    }
    await page.waitForSelector('#ui-glass-guide', { state: 'attached' });
    await page.waitForFunction(async expected => (await caches.keys()).includes(expected) && navigator.serviceWorker.controller?.state === 'activated', newVersion);
    check(!(await page.evaluate(expected => caches.has(expected), oldVersion)), engine + ': obsolete application cache removed');
    const after = await preservedData(page);
    check(JSON.stringify(after.record) === JSON.stringify(before.record), engine + ': real application study record unchanged');
    check(JSON.stringify(after.idb) === JSON.stringify(before.idb) && after.sentinel === before.sentinel, engine + ': localStorage and IndexedDB sentinel retained');
    if (active) check(after.run?.runId === before.run.runId && after.run.phase === 'work' && after.run.notes === before.run.notes, engine + ': reopening restores the same active run');
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.locator('[popovertarget="ui-glass-guide"]').first().click();
    check(await page.locator('#ui-glass-guide').evaluate(el => el.matches(':popover-open')), engine + ': upgraded shell and new guide work offline');
    const offline = await preservedData(page);
    check(offline.record.id === before.record.id && offline.sentinel === before.sentinel, engine + ': stored records still present after new offline reload');
    check(errors.length === 0, engine + ': no page exceptions: ' + errors.join('; '));
    item.ok = true;
    item.storagePreserved = true;
    item.usedCacheClearOrReinstall = false;
  } catch (error) {
    item.error = String(error);
    report.errors.push({ engine, activeSession: active, error: String(error) });
    await page.screenshot({ path: path.join(out, `failure-cache-update-${engine}-${active ? 'active' : 'idle'}.png`), fullPage: true }).catch(() => {});
  } finally {
    report.cases.push(item);
    await context.close();
  }
}

async function run() {
  assert.ok(oldVersion && newVersion, 'both service workers declare a cache version');
  if (oldVersion === newVersion) {
    report.notApplicable = 'Selected baseline has no cache-version transition.';
    return;
  }
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  for (const [engine, launcher] of Object.entries({ chromium, webkit })) {
    const executablePath = process.env[engine === 'chromium' ? 'UI_CHROMIUM_EXECUTABLE' : 'UI_WEBKIT_EXECUTABLE'];
    const browser = await launcher.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    try { for (const active of [false, true]) await installedUpgrade(browser, origin, engine, active); }
    finally { await browser.close(); }
  }
}

run().catch(error => report.errors.push({ fatal: String(error) })).finally(() => {
  server.close();
  report.ok = report.errors.length === 0;
  fs.writeFileSync(path.join(out, 'cache-update-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Installed-PWA upgrade\n\n${report.checks} checks; ${report.cases.length} installed-client cases; ${report.errors.length} failures. Existing worker lifecycle only; no cache clearing or reinstall.\n`);
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
});
