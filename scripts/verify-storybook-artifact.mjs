import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { extname, resolve, relative, isAbsolute } from 'node:path';
import { chromium } from 'playwright';

// Exercise the immutable output, never a Vite development-server fallback.
const root = resolve(process.argv[2] ?? 'storybook-static');
const evidence = resolve(process.argv[3] ?? '.cache/storybook-artifact-evidence');
await mkdir(evidence, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const path = relative(root, filename);
    if (path.startsWith('..') || isAbsolute(path) || !(await stat(filename)).isFile()) throw new Error('Missing artifact file');
    response.writeHead(200, { 'Content-Type': mime[extname(filename)] ?? 'application/octet-stream' });
    response.end(await readFile(filename));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Artifact file not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const report = { assets: [], fixtures: [], liveFailureControls: [], downstreamFailureControls: [] };
try {
  const assets = [
    ['/content/styles/giorgia.css', 'text/css', 'src/styles/compiled.css'],
    ['/content/fonts/fonts.css', 'text/css', 'src/styles/fonts.css'],
    ['/assets/giorgia-navigation.js', 'text/javascript', 'dist/assets/giorgia-navigation.js']
  ];
  const fonts = await readFile(resolve(root, 'content/fonts/fonts.css'), 'utf8');
  for (const match of fonts.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) assets.push([match[1], 'font/woff2', `src/styles/fonts/${match[1].split('/').at(-1)}`]);
  for (const [path, type, source] of assets) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('content-type'), type, path);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, await readFile(source), `Built asset differs from its existing producer: ${path}`);
    assert(bytes.length > 0, path);
    report.assets.push({ path, type, bytes: bytes.length });
  }
  browser = await chromium.launch({ headless: true });
  async function freshPage(control) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const diagnostics = { firstPartyFailures: [], thirdPartyRequests: [], editorialRequests: [], syntheticRequests: [], consoleErrors: [] };
    await context.route('**/*', route => {
      const url = route.request().url();
      if (/^https?:/.test(url) && !url.startsWith(origin + '/')) {
        diagnostics.thirdPartyRequests.push(url);
        if (/cdn\.modoitaliano\.fm\/(content|json)\/.*\.json(?:[?#]|$)/.test(url) && new URL(url).pathname !== '/content/now-playing.json') diagnostics.editorialRequests.push(url);
        const synthetic = control?.(new URL(url));
        if (synthetic) {
          diagnostics.syntheticRequests.push({ url, method: route.request().method(), status: synthetic.status ?? 200 });
          return route.fulfill({
            status: route.request().method() === 'OPTIONS' ? 204 : synthetic.status ?? 200,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'accept,cache-control,pragma', 'access-control-allow-methods': 'GET,OPTIONS' },
            body: route.request().method() === 'OPTIONS' ? '' : JSON.stringify(synthetic.body)
          });
        }
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    page.on('response', r => { if (r.url().startsWith(origin + '/') && r.status() >= 400) diagnostics.firstPartyFailures.push({ url: r.url(), status: r.status() }); });
    page.on('requestfailed', r => { if (r.url().startsWith(origin + '/')) diagnostics.firstPartyFailures.push({ url: r.url(), error: r.failure()?.errorText }); });
    page.on('pageerror', error => diagnostics.consoleErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()); });
    return { context, page, diagnostics };
  }
  const manager = await freshPage();
  await manager.page.goto(origin, { waitUntil: 'networkidle' });
  await manager.page.locator('#storybook-explorer-tree').waitFor();
  await manager.page.screenshot({ path: resolve(evidence, 'manager.png') });
  assert.deepEqual(manager.diagnostics.firstPartyFailures, []);
  assert.deepEqual(manager.diagnostics.editorialRequests, []);
  report.manager = manager.diagnostics;
  await manager.context.close();

  const fixtureIds = ['pages-homepage--default', 'pages-homepage--featured-overflow', 'pages-homepage--with-breaking-news', 'pages-homepage--no-featured-articles', 'pages-homepage--partial-featured', 'pages-articlepage--default', 'pages-categorypage--default', 'pages-searchpage--english', 'pages-searchpage--italian', 'partials-home-main--default', 'partials-breakingnews--default', 'partials-breakingnews--overflowing-live-updates', 'partials-breakingnews-liveupdatescolumn--default'];
  for (const id of fixtureIds) {
    const { context, page, diagnostics } = await freshPage();
    await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#storybook-root')?.childElementCount > 0 || document.querySelector('.sb-errordisplay')?.textContent?.trim());
    await page.screenshot({ path: resolve(evidence, `${id}.png`), fullPage: true });
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('sb-show-errordisplay')), false, `${id}: ${await page.locator('body').innerText()}`);
    assert((await page.locator('#storybook-root').innerText()).trim().length > 0, `Empty fixture ${id}`);
    assert.deepEqual(diagnostics.firstPartyFailures, [], id);
    assert.deepEqual(diagnostics.editorialRequests, [], `Fixture inherited a live loader: ${id}`);
    const assetErrors = diagnostics.consoleErrors.filter(text => /MIME|stylesheet|giorgia-navigation|\/content\/fonts\//i.test(text));
    assert.deepEqual(assetErrors, [], id);
    if (id === 'pages-homepage--with-breaking-news') {
      const widget = page.locator('iframe[title="SofaScore Attack Momentum"]');
      assert.equal(await widget.count(), 1, 'Breaking-news fixture must exercise the real provider helper');
      assert.equal(new URL(await widget.getAttribute('src')).searchParams.get('id'), '15388428');
    }
    if (id.startsWith('pages-')) {
      assert(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/content/styles/giorgia.css') && sheet.cssRules.length > 0)), `Page stylesheet not applied: ${id}`);
      assert(await page.evaluate(async () => (await document.fonts.load('16px Barlow')).length > 0), `Packaged Barlow font not loaded: ${id}`);
    }
    report.fixtures.push({ id, ...diagnostics });
    await context.close();
  }
  for (const id of ['pages-homepage--current', 'pages-articlepage--current', 'pages-categorypage--current', 'pages-livestorypage--current', 'partials-home-main--current', 'partials-breakingnews--current', 'partials-livestory-main--current', 'partials-breakingnews-liveupdatescolumn--current']) {
    const { context, page, diagnostics } = await freshPage();
    await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.classList.contains('sb-show-errordisplay'));
    assert(diagnostics.editorialRequests.length > 0, `Live loader did not run: ${id}`);
    assert.equal((await page.locator('#storybook-root').innerText()).trim(), '', `Live failure rendered fixture content: ${id}`);
    report.liveFailureControls.push({ id, expected: 'External request deliberately blocked; loader error visible; no live-success claim', ...diagnostics });
    await context.close();
  }

  // Synthetic indexes are negative regression inputs, never evidence of live
  // content success. Canonical fetches then fail with an explicit HTTP 503.
  const summary = { id: 'fixture-article', title: 'Synthetic index only', slug: 'fixture-story', url: '/sports/fixture-story', categories: [{ name: 'Sports', slug: 'sports' }] };
  const home = { articles: [summary] };
  const eventURL = 'https://cdn.modoitaliano.fm/json/articles/sports/fixture-event.json';
  const homepageURL = 'https://cdn.modoitaliano.fm/json/articles/sports/fixture-breaking.json';
  const controls = [
    { name: 'empty homepage index', id: 'pages-homepage--current', home: { articles: [] }, events: { docs: [] }, expected: 'Current homepage feed contains no articles' },
    { name: 'article canonical failure', id: 'pages-articlepage--current', category: { articles: [summary] }, expected: 'Current article JSON could not be loaded from its source URLs', canonicalCount: 2 },
    { name: 'empty article index', id: 'pages-articlepage--current', category: { articles: [] }, expected: 'Current category feed contains no article summaries: sports' },
    { name: 'null category index', id: 'pages-categorypage--current', category: null, expected: 'Current category feed is unavailable: sports' },
    { name: 'event canonical failure', id: 'pages-livestorypage--current', home, events: { docs: [{ id: 'fixture-event', title: 'Synthetic event only', jsonUrl: eventURL }] }, expected: `Request failed for ${eventURL}: 503`, canonicalCount: 1 },
    { name: 'homepage live canonical failure', id: 'pages-livestorypage--current', home: { ...home, breakingNews: { main: { title: 'Synthetic breaking news only', url: '/live/fixture', jsonUrl: homepageURL } } }, events: { docs: [] }, expected: `Request failed for ${homepageURL}: 503`, canonicalCount: 1 },
    { name: 'absent current live story', id: 'pages-livestorypage--current', home, events: { docs: [] }, expected: 'Current feeds contain no live story' }
  ];
  for (const control of controls) {
    const { context, page, diagnostics } = await freshPage(url => {
      if (url.hostname !== 'cdn.modoitaliano.fm') return;
      if (url.pathname === '/content/homepage-current-en.json' && 'home' in control) return { body: control.home };
      if (url.pathname === '/content/events-current-en.json' && 'events' in control) return { body: control.events };
      if (url.pathname === '/content/sports-current-en.json' && 'category' in control) return { body: control.category };
      if (url.pathname.startsWith('/json/articles/')) return { status: 503, body: { message: 'Deliberate synthetic canonical failure' } };
    });
    await page.goto(`${origin}/iframe.html?id=${control.id}&viewMode=story`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.classList.contains('sb-show-errordisplay') || document.querySelector('#storybook-root')?.childElementCount > 0);
    const text = await page.locator('body').innerText();
    assert(await page.locator('body').evaluate(el => el.classList.contains('sb-show-errordisplay')), `${control.name}: false successful fallback: ${text}`);
    assert(text.includes(control.expected), `${control.name}: expected ${control.expected}, got ${text}`);
    assert.equal((await page.locator('#storybook-root').innerText()).trim(), '', control.name);
    assert.deepEqual(diagnostics.firstPartyFailures, [], control.name);
    const canonical = diagnostics.syntheticRequests.filter(r => r.method === 'GET' && new URL(r.url).pathname.startsWith('/json/articles/'));
    assert.equal(canonical.length, control.canonicalCount ?? 0, control.name);
    if (control.name === 'empty homepage index') assert(!diagnostics.editorialRequests.some(url => new URL(url).pathname.includes('events-current')), 'Empty homepage rejection must precede further live loading');
    report.downstreamFailureControls.push({ name: control.name, expected: control.expected, syntheticNegativeControl: true, ...diagnostics });
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
