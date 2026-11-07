import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCachedEvents, fetchEvents, getCachedEvents, getLastFetchTime, hasEventChanges, type Event, type EventPost } from './events.js';

const post = (uuid: string, relevance: number, extra: Record<string, unknown> = {}): EventPost =>
  ({ id: 1, uuid, content: uuid, source: 's', uri: 'u', hash: 'h', author: 'a', createdAt: '2026-03-11T00:00:00Z', relevance, match_score: 1, ...extra }) as EventPost;

const event = (uuid: string, created: string, posts: EventPost[] = [], extra: Record<string, unknown> = {}): Event =>
  ({ id: 1, uuid, title: `T-${uuid}`, summary: 'S', status: 'open', created_at: created, updated_at: created, posts_count: posts.length, posts, ...extra }) as Event;

function respond(events: Event[] | undefined, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => ({ events, total: events?.length ?? 0 }) });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => clearCachedEvents());
afterEach(() => vi.unstubAllGlobals());

describe('fetchEvents', () => {
  it('requests the events API with the preferred language and caches the result', async () => {
    const fetchMock = respond([event('a', '2026-03-11T00:00:00Z')]);
    expect(getCachedEvents()).toBeNull();
    expect(getLastFetchTime()).toBeNull();

    const events = await fetchEvents({ language: 'es-MX' as never });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.monitor.gaulatti.com/events?language=es');
    expect(events).toHaveLength(1);
    expect(getCachedEvents()).toBe(events);
    expect(getLastFetchTime()).toBeInstanceOf(Date);
  });

  it('omits the language parameter for unsupported or missing languages', async () => {
    const fetchMock = respond([]);
    await fetchEvents();
    await fetchEvents({ language: 'it' });
    await fetchEvents({ language: '  ' as never });
    await fetchEvents({ language: 5 as never });
    for (const call of fetchMock.mock.calls) expect(call[0]).toBe('https://api.monitor.gaulatti.com/events');
  });

  it('treats a missing events list as empty and fails on HTTP errors', async () => {
    respond(undefined);
    expect(await fetchEvents()).toEqual([]);
    respond([], false, 503);
    await expect(fetchEvents()).rejects.toThrow('Failed to fetch events: 503');
  });

  it('filters by allowed languages, keeping events with no or allowed language', async () => {
    respond([
      event('none', '2026-03-11T00:00:00Z'),
      event('es-direct', '2026-03-11T01:00:00Z', [], { language: 'es' }),
      event('lang', '2026-03-11T02:00:00Z', [], { lang: 'es-AR' }),
      event('locale', '2026-03-11T03:00:00Z', [], { locale: 'es' }),
      event('from-post', '2026-03-11T04:00:00Z', [post('p', 1, { language: 'es' })]),
      event('from-post-lang', '2026-03-11T05:00:00Z', [post('q', 1, { lang: 'es' })]),
      event('from-post-locale', '2026-03-11T06:00:00Z', [post('r', 1, { locale: 'es' })]),
      event('italian', '2026-03-11T07:00:00Z', [], { language: 'it' }),
    ]);
    const kept = await fetchEvents({ allowedLanguages: ['es', 'es-MX' as never, 'it', 7 as never] });
    expect(kept.map((e) => e.uuid)).toEqual(['none', 'es-direct', 'lang', 'locale', 'from-post', 'from-post-lang', 'from-post-locale', 'italian']);
  });

  it('ignores a non-array allowed language list', async () => {
    respond([event('a', '2026-03-11T00:00:00Z')]);
    expect(await fetchEvents({ allowedLanguages: 'es' as never })).toHaveLength(1);
  });

  it('handles events without a posts array during language detection', async () => {
    respond([event('a', '2026-03-11T00:00:00Z', undefined, { posts: undefined })]);
    expect(await fetchEvents({ allowedLanguages: ['es'] })).toHaveLength(1);
  });

  it('merges a later fetch into the cached events for the same key', async () => {
    respond([event('old', '2026-03-10T00:00:00Z', [post('p1', 1)]), event('shared', '2026-03-11T00:00:00Z', [post('p1', 1), post('p2', 5)])]);
    await fetchEvents({ language: 'es' });

    respond([
      event('shared', '2026-03-11T00:00:00Z', [post('p2', 2), post('p3', 9)], { title: 'Renamed', summary: 'New', status: 'closed', updated_at: '2026-03-12T00:00:00Z', posts_count: 3 }),
      event('fresh', '2026-03-09T00:00:00Z'),
    ]);
    const merged = await fetchEvents({ language: 'es' });

    expect(merged.map((e) => e.uuid)).toEqual(['fresh', 'old', 'shared']);
    const shared = merged.find((e) => e.uuid === 'shared')!;
    expect([shared.title, shared.summary, shared.status, shared.updated_at, shared.posts_count]).toEqual(['Renamed', 'New', 'closed', '2026-03-12T00:00:00Z', 3]);
    expect(shared.posts.map((p) => [p.uuid, p.relevance])).toEqual([['p3', 9], ['p2', 2], ['p1', 1]]);
  });

  it('replaces an empty cached list instead of merging and keeps keys independent', async () => {
    respond([]);
    await fetchEvents();
    respond([event('a', '2026-03-11T00:00:00Z')]);
    expect((await fetchEvents()).map((e) => e.uuid)).toEqual(['a']);

    respond([event('b', '2026-03-11T00:00:00Z')]);
    expect((await fetchEvents({ language: 'es' })).map((e) => e.uuid)).toEqual(['b']);
    expect(getCachedEvents()?.map((e) => e.uuid)).toEqual(['b']);
  });

  it('clears the cache and the active key', async () => {
    respond([event('a', '2026-03-11T00:00:00Z')]);
    await fetchEvents();
    clearCachedEvents();
    expect(getCachedEvents()).toBeNull();
    expect(getLastFetchTime()).toBeNull();
  });
});

describe('hasEventChanges', () => {
  const base = () => [event('a', '2026-03-11T00:00:00Z', [post('p1', 1)])];

  it('detects length, membership, field and post differences', () => {
    expect(hasEventChanges(base(), [])).toBe(true);
    expect(hasEventChanges(base(), [event('b', '2026-03-11T00:00:00Z', [post('p1', 1)])])).toBe(true);
    expect(hasEventChanges([event('a', 'x'), event('b', 'x')], [event('a', 'x'), event('c', 'x')])).toBe(true);
    expect(hasEventChanges([event('a', 'x'), event('b', 'x')], [event('a', 'x'), event('a', 'x')])).toBe(true);
    expect(hasEventChanges(base(), [{ ...base()[0], title: 'other' }])).toBe(true);
    expect(hasEventChanges(base(), [{ ...base()[0], status: 'closed' }])).toBe(true);
    expect(hasEventChanges(base(), [{ ...base()[0], posts_count: 9 }])).toBe(true);
    expect(hasEventChanges(base(), [event('a', '2026-03-11T00:00:00Z', [post('p1', 1), post('p2', 1)])])).toBe(true);
    expect(hasEventChanges(base(), [{ ...base()[0], posts: [post('p9', 1)] }])).toBe(true);
  });

  it('reports no change for equivalent lists', () => {
    expect(hasEventChanges(base(), base())).toBe(false);
  });
});
