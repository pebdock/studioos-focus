// Isolate presentation states from the functional timer and real user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require('playwright');
const { PNG } = require('pngjs');

async function checkMaterial(browserType) {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<html class="glass ui-glass-lens-ready"><body><div class="card" id="focusCard"></div><nav id="tabbar"><button>Oggi</button></nav><div id="island"></div></body></html>');
    for (const path of ['tokens.css', 'refinement.css']) await page.addStyleTag({ path });
    const style = (selector, prop, pseudo = null) => page.locator(selector)
      .evaluate((el, [key, layer]) => getComputedStyle(el, layer).getPropertyValue(key), [prop, pseudo]);
    await page.locator('button').focus();
    assert.equal(await style('#tabbar', 'padding-top', '::before'), '2px');
    if (await page.evaluate(() => CSS.supports('corner-shape: squircle'))) {
      assert.match(await style('#focusCard', 'corner-top-left-shape'), /squircle|superellipse/);
    }
    await page.evaluate(() => document.documentElement.dataset.lgPhase = 'work');
    for (const selector of ['#tabbar', '#focusCard', '#island']) {
      assert.equal(await style(selector, 'content', '::before'), 'none');
      assert.doesNotMatch(await style(selector, 'backdrop-filter'), /url\(/);
    }
    await page.evaluate(() => document.body.classList.add('oled'));
    assert.equal(await style('#focusCard', 'background-color'), 'rgb(0, 0, 0)');
    assert.equal(await style('#focusCard', 'backdrop-filter'), 'none');

    await page.setContent('<div class="rp-a">Soluzione</div>');
    await page.addStyleTag({ path: 'ripasso/ripasso.css' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await style('.rp-a', 'animation-name'), 'rp-reveal');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await style('.rp-a', 'animation-name'), 'none');
    console.log(browserType.name(), 'materiali, geometria, OLED e movimento verificati');
  } finally {
    await browser.close();
  }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  const maskable = manifest.icons.find(icon => icon.purpose === 'maskable');
  assert.ok(maskable);
  for (const icon of manifest.icons) {
    const png = PNG.sync.read(fs.readFileSync(icon.src));
    assert.equal(icon.sizes, png.width + 'x' + png.height);
    if (icon === maskable) {
      for (let i = 3; i < png.data.length; i += 4) assert.equal(png.data[i], 255);
    }
  }
  for (const engine of [chromium, webkit]) await checkMaterial(engine);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
