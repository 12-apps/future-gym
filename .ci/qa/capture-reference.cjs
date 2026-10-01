const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');

const source = readFileSync(path.join(__dirname, 'reference.html'));
const out = path.resolve('reference-evidence');
mkdirSync(out, { recursive: true });
const hash = createHash('sha256').update(source).digest('hex');
if (hash !== '65091cd35ae74c6201959b14b96b829de53f47653608d25b2bb13414c68fe80f') throw new Error('Reference bytes changed');
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(source);
});
(async () => {
  await new Promise(resolve => server.listen(4187, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
  const captures = [];
  const errors = [];
  try {
    for (const [width, height] of [[390, 844], [1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'pt-BR' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const capture = async name => {
        await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: false });
        writeFileSync(path.join(out, `${name}-${width}.txt`), await page.locator('body').innerText());
        captures.push(`${name}-${width}`);
      };
      await page.goto('http://127.0.0.1:4187', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Sua ficha', exact: true }).waitFor();
      await capture('reference-01-home');
      await page.locator('#tabbar [data-view="history"]').click();
      await capture('reference-02-empty-history');
      await page.locator('#tabbar [data-view="home"]').click();
      await page.locator('[data-action="open"][data-id="A"]').first().click();
      await page.getByRole('button', { name: 'Iniciar treino', exact: true }).waitFor();
      await capture('reference-03-workout');
      await page.getByRole('button', { name: 'Iniciar treino', exact: true }).click();
      await page.locator('#session').waitFor();
      await capture('reference-04-session-ready');
      await page.locator('[data-field="kg"][data-set="0"]').fill('42,5');
      await page.locator('[data-field="reps"][data-set="0"]').fill('9');
      await page.locator('[data-field="reps"][data-set="0"]').press('Tab');
      await capture('reference-05-edited-set');
      await page.locator('[data-action="begin"]').click();
      await page.locator('[data-action="pause"]').click();
      await capture('reference-06-paused');
      await page.locator('[data-action="pause"]').click();
      await page.locator('[data-action="setDone"]').click();
      await page.locator('[data-action="add"]').click();
      await capture('reference-07-rest');
      await page.locator('[data-action="skipRest"]').click();
      await page.getByRole('button', { name: 'Encerrar treino', exact: true }).click();
      await capture('reference-08-partial-finish');
      await page.locator('[data-action="finish"]').click();
      await page.getByRole('button', { name: 'Voltar à ficha', exact: true }).waitFor();
      await capture('reference-09-summary');
      await page.getByRole('button', { name: 'Voltar à ficha', exact: true }).click();
      await page.locator('#tabbar [data-view="history"]').click();
      await capture('reference-10-history');
      await context.close();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    writeFileSync(path.join(out, 'result.json'), JSON.stringify({ status: 'passed', referenceSha256: hash, referenceBytes: source.length, captures, browser: 'Google Chrome, sandbox enabled' }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
