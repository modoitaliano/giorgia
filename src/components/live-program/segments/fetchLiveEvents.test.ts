import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLiveEvent } from './fetchLiveEvents.js';

function stubFetch(impl: () => Promise<unknown>) {
  const fetchStub = vi.fn(impl);
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

describe('fetchLiveEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests the language-specific homepage feed without caching', async () => {
    const fetchStub = stubFetch(async () => jsonResponse({}));
    await fetchLiveEvent('en');
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/cdn\.modoitaliano\.fm\/content\/homepage-current-en\.json\?_=\d+$/);
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('returns null when the response is not ok', async () => {
    stubFetch(async () => jsonResponse({ breakingNews: { main: { title: 'X' } } }, false));
    expect(await fetchLiveEvent()).toBeNull();
  });

  it('returns null when there is no breaking news title', async () => {
    stubFetch(async () => jsonResponse({ breakingNews: { main: { excerpt: 'no title' } } }));
    expect(await fetchLiveEvent()).toBeNull();
    stubFetch(async () => jsonResponse({}));
    expect(await fetchLiveEvent()).toBeNull();
  });

  it('returns null and logs when the request fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(async () => {
      throw new Error('network down');
    });
    expect(await fetchLiveEvent()).toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });

  it('maps the feed to a live event with defaults for missing fields', async () => {
    stubFetch(async () => jsonResponse({ breakingNews: { main: { title: 'Titolo' } } }));
    const result = await fetchLiveEvent();
    expect(result).toMatchObject({
      category: 'EN VIVO',
      title: 'Titolo',
      image: '',
      alt: 'Titolo',
      url: '/',
      updates: [],
    });
    expect(Number.isNaN(Date.parse(result!.updatedAt))).toBe(false);
  });

  it('keeps provided fields and updates', async () => {
    const updates = [{ time: '10:00', text: 'update' }];
    stubFetch(async () =>
      jsonResponse({
        updatedAt: '2026-01-01T00:00:00.000Z',
        breakingNews: {
          main: { category: 'LIVE', title: 'T', excerpt: 'E', image: 'i.jpg', alt: 'A', url: '/u', liveUrl: '/l' },
          updates,
        },
      })
    );
    expect(await fetchLiveEvent()).toEqual({
      category: 'LIVE',
      title: 'T',
      excerpt: 'E',
      image: 'i.jpg',
      alt: 'A',
      url: '/u',
      liveUrl: '/l',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updates,
    });
  });
});
