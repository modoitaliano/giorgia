import assert from 'node:assert/strict';
import test from 'node:test';

let instance = 0;
async function withSyntheticFeeds(homepage, events, inspect, eventsStatus = 200, category) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    if (url.origin !== 'https://cdn.modoitaliano.fm') throw new Error(`Unexpected synthetic request: ${url}`);
    const value = url.pathname === '/content/homepage-current-en.json' ? homepage :
      url.pathname === '/content/events-current-en.json' ? events :
      url.pathname === '/content/sports-current-en.json' ? category : undefined;
    if (value === undefined) throw new Error(`Unexpected synthetic request: ${url}`);
    return new Response(JSON.stringify(value), {
      status: url.pathname === '/content/events-current-en.json' ? eventsStatus : 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    // Fresh module instances isolate the existing 30-second feed caches.
    const moduleURL = new URL('../stories/preview-data.ts', import.meta.url);
    moduleURL.searchParams.set('synthetic-contract', String(++instance));
    const loader = await import(moduleURL.href);
    await inspect(loader, requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Synthetic domain contracts only: no CDN/live-content success is claimed.
test('absent breaking news does not acquire checked-in current-news cards', async () => {
  await withSyntheticFeeds({}, { docs: [] }, async (loader, requests) => {
    assert.deepEqual(await loader.loadBreakingNewsPreviewData(), { main: undefined, updates: [] });
    assert.deepEqual(requests, ['/content/homepage-current-en.json', '/content/events-current-en.json']);
  });
});

test('partial breaking news retains supplied main data without fixture sidebar or snack fallback', async () => {
  const main = { title: 'Synthetic main', url: '/sports/fixture', category: 'Sports fixture', image: 'https://example.test/fixture.jpg', sofascore_id: 15388428 };
  await withSyntheticFeeds({ breakingNews: { main, updates: [] } }, { docs: [] }, async loader => {
    const result = await loader.loadBreakingNewsPreviewData();
    assert.equal(result.main.title, main.title);
    assert.equal(result.main.url, main.url);
    assert.equal(result.sidebarFeature, undefined);
    assert.equal(result.sidebarSub, undefined);
    assert.deepEqual(result.snacks, []);
    assert.deepEqual(result.updates, []);
  });
});

test('events-index failure propagates after successful homepage loading', async () => {
  await withSyntheticFeeds({}, { message: 'Deliberate synthetic events failure' }, async (loader, requests) => {
    await assert.rejects(loader.loadBreakingNewsPreviewData(), /events-current-en\.json.*: 503/);
    assert.deepEqual(requests, ['/content/homepage-current-en.json', '/content/events-current-en.json']);
  }, 503);
});

for (const scenario of [
  { name: 'invalid homepage collection', home: { articles: [{}] }, method: 'loadHomepagePreviewData', message: 'Current homepage feed contains no articles', request: '/content/homepage-current-en.json' },
  { name: 'empty category collection', home: {}, category: { articles: [] }, method: 'loadCategoryPreviewData', message: 'Current category feed contains no articles: sports', request: '/content/sports-current-en.json' },
  { name: 'invalid category collection', home: {}, category: { articles: [{}] }, method: 'loadCategoryPreviewData', message: 'Current category feed contains no articles: sports', request: '/content/sports-current-en.json' }
]) {
  test(`${scenario.name} cannot become fixture news`, async () => {
    await withSyntheticFeeds(scenario.home, { docs: [] }, async (loader, requests) => {
      await assert.rejects(loader[scenario.method](), error => error.message === scenario.message);
      assert.deepEqual(requests, [scenario.request]);
    }, 200, scenario.category);
  });
}
