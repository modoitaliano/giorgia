// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveProgram from './LiveProgram.js';
import { clearCachedEvents } from './events.js';

// The SSE transport has its own tests; here the hook is replaced so a test can
// push server messages straight into the component's handler.
const sse = vi.hoisted(() => ({ options: null as null | { url: string; enabled?: boolean; onMessage: (data: unknown) => void } }));
vi.mock('./hooks/useSSE.js', () => ({
  useSSE: (options: NonNullable<typeof sse.options>) => {
    sse.options = options;
    return { isConnected: false, error: null };
  },
}));

// Canvas colour extraction is not available in a DOM emulation.
vi.mock('fast-average-color', () => ({
  FastAverageColor: class {
    getColor = () => ({ hex: '#336699' });
  },
}));

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playOutcome: () => Promise<void> = () => Promise.resolve();
  src: string;
  preload = '';
  loop = false;
  volume = 1;
  paused = true;
  ended = false;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  play = vi.fn(() => {
    this.paused = false;
    return FakeAudio.playOutcome();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}

const originalTimeZone = process.env.TZ;
let day = 0;
const at = (clock: string) => new Date(`${new Date(Date.UTC(2026, 2, 11 + day)).toISOString().slice(0, 10)}T${clock}Z`);

type Routes = Record<string, unknown>;
let routes: Routes;
const fetched: string[] = [];

const article = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  excerpt: `Excerpt ${id}`,
  slug: `slug-${id}`,
  featured: false,
  featuredImage: { url: `https://img.test/${id}.jpg` },
  categories: [],
  publishedAt: new Date(Date.now() - id * 60_000).toISOString(),
  ...extra,
});
const post = (uuid: string, relevance = 1) => ({ id: 1, uuid, content: 'c', source: 's', uri: 'u', hash: 'h', author: 'a', createdAt: '2026-03-11T00:00:00Z', relevance, match_score: 1 });
const event = (uuid: string, title: string, posts = 4) => ({
  id: 1,
  uuid,
  title,
  summary: 's',
  status: 'open',
  created_at: `2026-03-11T0${uuid.length}:00:00Z`,
  updated_at: '2026-03-11T00:00:00Z',
  posts_count: posts,
  posts: Array.from({ length: posts }, (_, i) => post(`${uuid}-${i}`)),
});
const scene = (metadata: unknown, id = 1) => ({
  id,
  name: `Scene ${id}`,
  layoutId: 1,
  layout: { id: 1, name: 'L', componentType: 'modoitaliano', settings: '{}' },
  chyronText: null,
  metadata: metadata === null ? null : typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
});
const programState = (metadata: unknown) => ({ id: 1, activeSceneId: 1, activeScene: scene(metadata), updatedAt: '2026-03-11T00:00:00Z' });

const content = (props: Record<string, unknown>) => ({ 'modoitaliano-content': props });
const FAST = { playlistDefaultDurationMs: 1000, articlesDurationMs: 1000, weatherDurationMs: 1000, earthquakesDurationMs: 1000, marketsDurationMs: 1000, playlistUpdateIntervalMs: 100 };
const ONLY_ARTICLES = { showLiveEvents: false, showWeather: false, showEarthquakes: false, showMarkets: false };

const weather = [
  { region: 'Europe', cities: [{ name: 'Roma', temp: 68, condition: 'sunny', high: 70, low: 50 }, { name: 'São Paulo', temp: 77, condition: 'cloudy', high: 80, low: 60 }] },
  { region: 'Asia', cities: [{ name: 'Tokyo', temp: 59, condition: 'rainy', high: 62, low: 50 }] },
];
const markets = [{ symbol: 'AAPL', name: 'Apple', price: 100, change: 1, changePercent: 1 }];

beforeEach(() => {
  process.env.TZ = 'UTC';
  day += 1;
  vi.useFakeTimers();
  vi.setSystemTime(at('12:20:30'));
  clearCachedEvents();
  sse.options = null;
  FakeAudio.instances = [];
  FakeAudio.playOutcome = () => Promise.resolve();
  vi.stubGlobal('Audio', FakeAudio);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  routes = {
    '/state': programState(content({ ...FAST, ...ONLY_ARTICLES, showWorldClocks: false })),
    'homepage-current-es.json': { articles: [article(1, 'Headline A')] },
    '/broadcast/weather': weather,
    '/earthquakes': [],
    '/broadcast/markets': markets,
    '/events': { events: [] },
  };
  fetched.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input);
      fetched.push(url);
      const key = Object.keys(routes).find((candidate) => url.includes(candidate));
      if (!key) throw new Error(`unrouted ${url}`);
      const body = routes[key];
      return { ok: body !== undefined, status: body === undefined ? 500 : 200, statusText: 'x', json: async () => body };
    })
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const flush = () => advance(10);

async function mount(props: Record<string, unknown> = {}) {
  const view = render(h(LiveProgram, props as never));
  await flush();
  return view;
}
const emit = (data: unknown) =>
  act(() => {
    sse.options!.onMessage(data);
  });
const headings = () => Array.from(document.querySelectorAll('h1')).map((node) => node.textContent);
const stage = (container: HTMLElement) => container.querySelector('.relative.bg-black') as HTMLElement;

describe('loading and layout', () => {
  it('shows the callsign slide until the first data load completes', async () => {
    routes['/events'] = undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { container } = render(h(LiveProgram, { sceneMetadata: {} }));
    await flush();
    expect(container.textContent).toContain('This is fifthbell.');
    expect(container.firstElementChild!.className).toContain('min-h-screen');
    expect(stage(container).style.width).toBe('1920px');
    expect(document.querySelector('audio')).toBeNull();
  });

  it('fills its container when embedded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { container } = render(h(LiveProgram, { embedded: true, sceneMetadata: {} }));
    await flush();
    expect(container.firstElementChild!.className).toBe('w-full h-full bg-black overflow-hidden');
    expect(stage(container).style.width).toBe('100%');
  });

  it('keeps the loading stage empty when the content layer is not active', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { container } = render(h(LiveProgram, { sceneMetadata: {}, activeComponents: ['modoitaliano-marquee'] }));
    await flush();
    expect(container.textContent).toBe('');
    expect(container.querySelector('.absolute.inset-0.bg-black')).not.toBeNull();
  });

  it('renders the program stage with the audio cue source and slide styles once loaded', async () => {
    const { container } = await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, showWorldClocks: false }) });
    expect(headings()).toEqual(['Headline A']);
    expect(container.firstElementChild!.className).toContain('min-h-screen');
    const source = document.querySelector('audio source') as HTMLSourceElement;
    expect(source.getAttribute('src')).toBe('./modoitaliano/audio/pipes.ogg');
    expect(source.getAttribute('type')).toBe('audio/ogg');
    expect(document.querySelector('style')!.textContent).toContain('@keyframes marqueeFlow');
  });

  it('renders the embedded stage at full size', async () => {
    const { container } = await mount({ embedded: true, sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES }) });
    expect(container.firstElementChild!.className).toBe('w-full h-full bg-black overflow-hidden');
    expect(stage(container).className).toContain('w-full h-full');
  });

  it('draws an empty black stage instead of content when the content layer is off', async () => {
    const { container } = await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES }), activeComponents: ['modoitaliano-marquee'] });
    expect(headings()).toEqual([]);
    expect(stage(container).querySelector('.absolute.inset-0.bg-black')).not.toBeNull();
  });

  it('draws an empty black stage when every content segment is disabled', async () => {
    const { container } = await mount({
      sceneMetadata: content({ showLiveEvents: false, showArticles: false, showWeather: false, showEarthquakes: false, showMarkets: false }),
    });
    expect(headings()).toEqual([]);
    expect(stage(container).querySelector('.absolute.inset-0.bg-black')).not.toBeNull();
  });

  it('treats the legacy component type as enabling every layer', async () => {
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES }), activeComponents: ['modoitaliano'] });
    expect(headings()).toEqual(['Headline A']);
  });

  it('enables the content layer when it is listed explicitly', async () => {
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES }), activeComponents: ['modoitaliano-content'] });
    expect(headings()).toEqual(['Headline A']);
  });
});

describe('program state', () => {
  it('reads the active scene from the program API at the configured base url', async () => {
    await mount({ apiBaseUrl: 'https://program.test///' });
    expect(fetched[0]).toBe('https://program.test/state');
    expect(sse.options).toMatchObject({ url: 'https://program.test/events', enabled: true });
    expect(headings()).toEqual(['Headline A']);
  });

  it('derives the default api base url from the page host', async () => {
    await mount();
    expect(fetched[0]).toBe(`http://${window.location.hostname}:3000/state`);
  });

  it('brackets a host name that contains a colon', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ hostname: '::1', href: 'http://[::1]/' } as Location);
    await mount();
    expect(fetched[0]).toBe('http://[::1]:3000/state');
  });

  it('does not read state or open the event stream when a scene renderer supplies the metadata', async () => {
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES }) });
    expect(fetched.some((url) => url.endsWith('/state'))).toBe(false);
    expect(sse.options!.enabled).toBe(false);
  });

  it('logs and keeps the default scene when the state request fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    routes['/state'] = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (String(input).endsWith('/state')) throw new Error('state down');
        const key = Object.keys(routes).find((candidate) => String(input).includes(candidate))!;
        return { ok: true, status: 200, statusText: 'OK', json: async () => routes[key] };
      })
    );
    await mount();
    expect(error).toHaveBeenCalledWith('Failed to fetch ModoItaliano program state:', expect.any(Error));
    // default scene: the live event slot comes first and has no event
    expect(screen.getByText('No hay eventos en vivo')).toBeTruthy();
  });

  it('falls back to the default scene for missing or malformed scene metadata', async () => {
    for (const metadata of [null, '{not json', '[1,2]', '"text"']) {
      routes['/state'] = programState(metadata);
      const view = await mount();
      expect(screen.getByText('No hay eventos en vivo')).toBeTruthy();
      view.unmount();
    }
  });

  it('ignores metadata when the program has no active scene', async () => {
    routes['/state'] = { id: 1, activeSceneId: null, activeScene: null, updatedAt: 'x' };
    await mount();
    expect(screen.getByText('No hay eventos en vivo')).toBeTruthy();
  });
});

describe('scene configuration', () => {
  it('shows only the segments the scene enables, in playlist order', async () => {
    routes['homepage-current-es.json'] = { articles: [article(1, 'Headline A')], breakingNews: { main: { title: 'Breaking title', category: 'LIVE' }, updates: [] } };
    const all = content({ ...FAST });
    await mount({ sceneMetadata: all });
    expect(headings()).toEqual(['Breaking title']);

    await advance(15_000 + 1100);
    expect(headings()).toEqual(['Headline A']);
    await advance(1100);
    expect(headings()).toEqual(['CLIMA']);
    await advance(4 * 1100);
    expect(screen.getByText('Cargando datos de terremotos...')).toBeTruthy();
    await advance(1100);
    expect(headings()).toEqual(['MERCADOS']);
    await advance(1100);
    // the playlist wraps back to the live event
    expect(headings()).toEqual(['Breaking title']);
  });

  it('refreshes the next segment data when the playlist moves on', async () => {
    await mount({ sceneMetadata: content({ ...FAST, showLiveEvents: false, showWeather: false, showEarthquakes: false }) });
    const feedRequests = () => fetched.filter((url) => url.includes('homepage-current-es.json')).length;
    const initial = feedRequests();
    await advance(1100);
    expect(headings()).toEqual(['MERCADOS']);
    // entering markets prefetches the following segment: the articles
    await flush();
    expect(feedRequests()).toBe(initial + 1);
    await advance(1100);
    expect(headings()).toEqual(['Headline A']);
  });

  it('shows weather only for the configured cities, ignoring accents and case', async () => {
    await mount({
      sceneMetadata: content({ ...FAST, showLiveEvents: false, showArticles: false, showEarthquakes: false, showMarkets: false, weatherCities: ['  sao paulo ', 'SAO PAULO', 7, '', null] }),
    });
    expect(headings()).toEqual(['CLIMA']);
    expect(screen.getByText('São Paulo')).toBeTruthy();
    expect(screen.queryByText('Roma')).toBeNull();
    // the Asia region has no selected city, so it is dropped: Europe appears twice (°F and °C)
    await advance(2 * 1100);
    expect(screen.getByText('São Paulo')).toBeTruthy();
    await advance(1100);
    expect(screen.getByText('São Paulo')).toBeTruthy();
    expect(screen.queryByText('Tokyo')).toBeNull();
  });

  it('shows every city when the city filter is not a list', async () => {
    await mount({ sceneMetadata: content({ ...FAST, showLiveEvents: false, showArticles: false, showEarthquakes: false, showMarkets: false, weatherCities: 'Roma' }) });
    expect(screen.getByText('Roma')).toBeTruthy();
    expect(screen.getByText('São Paulo')).toBeTruthy();
  });

  it('applies per-segment durations within their allowed range', async () => {
    await mount({
      sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, showMarkets: true, articlesDurationMs: 5000, marketsDurationMs: 1 }),
    });
    expect(headings()).toEqual(['Headline A']);
    await advance(4000);
    expect(headings()).toEqual(['Headline A']);
    await advance(1200);
    expect(headings()).toEqual(['MERCADOS']);
    // a requested 1 ms is clamped to the 1 s minimum
    await advance(900);
    expect(headings()).toEqual(['MERCADOS']);
    await advance(300);
    expect(headings()).toEqual(['Headline A']);
  });

  it('merges legacy component props under the layer specific ones', async () => {
    await mount({
      sceneMetadata: {
        modoitaliano: { ...FAST, showArticles: true, showMarkets: true, showLiveEvents: false, showWeather: false, showEarthquakes: false },
        'modoitaliano-content': { showMarkets: 'off' },
      },
    });
    expect(headings()).toEqual(['Headline A']);
    await advance(1100);
    expect(headings()).toEqual(['Headline A']);
  });

  it.each([
    [true, true],
    [false, false],
    ['TRUE', true],
    [' yes ', true],
    ['on', true],
    ['1', true],
    ['false', false],
    ['No', false],
    ['off', false],
    ['0', false],
    ['', false],
    [1, true],
    [0, false],
    ['maybe', true],
    [{}, true],
    [null, true],
  ])('interprets the world clock flag %j as %s', async (value, shown) => {
    const { container } = await mount({ sceneMetadata: { 'modoitaliano-corner': { showWorldClocks: value } } });
    expect(Boolean(container.querySelector('.pt-1\\.5'))).toBe(shown);
  });

  it('shows the bell icon even when the clocks are hidden', async () => {
    const { container } = await mount({ sceneMetadata: { 'modoitaliano-corner': { showWorldClocks: false } } });
    expect(container.querySelector('.pt-1\\.5')).toBeNull();
    expect(container.querySelector('.bg-\\[\\#b21100\\].p-6 svg')).not.toBeNull();
  });

  it('applies world clock options from the corner and clock layers', async () => {
    const cities = [{ city: 7, timezone: 'Europe/Rome' }, { city: ' Springfield ', timezone: ' America/Chicago ' }, { city: '', timezone: 'Europe/Rome' }, { city: 'Nowhere' }, null, [], 'x'];
    const { container } = await mount({
      sceneMetadata: {
        modoitaliano: { worldClockWidthPx: 250 },
        'toni-clock': { worldClockWidthPx: 400, worldClockShuffle: 'false', worldClockCities: cities },
        'modoitaliano-corner': { worldClockWidthPx: 9999 },
      },
    });
    const clock = container.querySelector('.pt-1\\.5 > div') as HTMLElement;
    // corner layer wins over the clock layer, clamped to 600
    expect(clock.style.width).toBe('600px');
    expect(clock.textContent).toContain('Springfield');
  });

  it('keeps only supported languages from the language rotation', async () => {
    for (const languageRotation of [['en', 'es', 7], ['en', 'it'], [], 'es']) {
      const { unmount } = await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, languageRotation }) });
      // the rotation only offers Spanish, so the Spanish feed is always the one requested
      expect(headings()).toEqual(['Headline A']);
      expect(fetched.some((url) => url.includes('homepage-current-es.json'))).toBe(true);
      expect(fetched.some((url) => url.includes('homepage-current-en.json'))).toBe(false);
      unmount();
    }
  });

  it('clamps and parses the world clock width', async () => {
    const widths: Array<[unknown, string]> = [[10, '120px'], ['300', '300px'], ['abc', '200px'], [undefined, '200px']];
    for (const [value, expected] of widths) {
      const { container, unmount } = await mount({ sceneMetadata: { 'modoitaliano-corner': { worldClockWidthPx: value } } });
      expect((container.querySelector('.pt-1\\.5 > div') as HTMLElement).style.width).toBe(expected);
      unmount();
    }
  });

  it('uses the default world clock cities when the configured list is unusable', async () => {
    for (const worldClockCities of ['rome', [], [{ city: 'x' }]]) {
      const { container, unmount } = await mount({ sceneMetadata: { 'modoitaliano-corner': { worldClockCities, worldClockShuffle: false } } });
      expect(container.querySelector('.pt-1\\.5')!.textContent).toContain('NUEVA YORK');
      unmount();
    }
  });
});

describe('marquee', () => {
  const marqueeScene = (extra: Record<string, unknown> = {}, contentProps: Record<string, unknown> = {}) => ({
    ...content({ ...FAST, ...ONLY_ARTICLES, ...contentProps }),
    'modoitaliano-marquee': { showMarquee: true, ...extra },
  });

  beforeEach(() => {
    routes['/events'] = { events: [event('abc', 'First story')] };
  });

  it('stays hidden unless the scene enables it', async () => {
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES }) });
    expect(screen.queryByText('First story')).toBeNull();
  });

  it('shows events that pass the configured thresholds', async () => {
    await mount({ sceneMetadata: marqueeScene() });
    expect(screen.getByText('First story')).toBeTruthy();
    cleanup();
    await mount({ sceneMetadata: marqueeScene({ marqueeMinPostsCount: 5 }) });
    expect(screen.queryByText('First story')).toBeNull();
  });

  it('is off when the marquee layer is not active', async () => {
    await mount({ sceneMetadata: marqueeScene(), activeComponents: ['modoitaliano-content'] });
    expect(screen.queryByText('First story')).toBeNull();
  });

  it('is off when there is nothing to play', async () => {
    await mount({ sceneMetadata: marqueeScene({}, { showArticles: false }) });
    expect(screen.queryByText('First story')).toBeNull();
  });

  it('treats the old default relevance trio as unset thresholds', async () => {
    routes['/events'] = { events: [{ ...event('abc', 'Weak story'), posts: [post('p1', 1), post('p2', 1), post('p3', 1), post('p4', 1)] }] };
    await mount({ sceneMetadata: marqueeScene({ marqueeMinPostsCount: 4, marqueeMinAverageRelevance: 5, marqueeMinMedianRelevance: 7 }) });
    expect(screen.getByText('Weak story')).toBeTruthy();
    cleanup();
    await mount({ sceneMetadata: marqueeScene({ marqueeMinPostsCount: 4, marqueeMinAverageRelevance: 6, marqueeMinMedianRelevance: 7 }) });
    expect(screen.queryByText('Weak story')).toBeNull();
  });

  it('passes the configured scroll speed, minimum duration and height to the marquee', async () => {
    const { container } = await mount({
      sceneMetadata: marqueeScene({ marqueePixelsPerSecond: 5, marqueeMinDurationSeconds: 500, marqueeHeightPx: 1 }),
    });
    const bar = screen.getByText('First story').closest('div[style*="border-top"]') as HTMLElement;
    expect(bar.style.height).toBe('72px');
    expect(container.querySelector('[style*="marqueeFlow"]')).not.toBeNull();
  });

  it('swaps in newly arrived events behind a curtain once the marquee finishes a cycle', async () => {
    await mount({ sceneMetadata: marqueeScene({}, { showMarkets: true }) });
    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.queryByText('Second story')).toBeNull();

    // the next article refresh brings a new event
    routes['/events'] = { events: [event('abc', 'First story'), event('abcd', 'Second story')] };
    await advance(1100);
    await advance(1100);
    expect(screen.queryByText('Second story')).toBeNull();

    // nothing changes on screen until the running marquee completes a cycle
    const track = screen.getByText('First story').closest('div[style*="marqueeFlow"]') as HTMLElement;
    fireEvent.animationIteration(track);
    await flush();
    expect(screen.getByText('This is fifth', { exact: false })).toBeTruthy();
    expect(screen.queryByText('First story')).toBeNull();

    await advance(5000);
    expect(screen.queryByText('This is fifth', { exact: false })).toBeNull();
    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.getByText('Second story')).toBeTruthy();
  });

  it('does not show the curtain when a marquee cycle ends with nothing new', async () => {
    await mount({ sceneMetadata: marqueeScene() });
    const track = screen.getByText('First story').closest('div[style*="marqueeFlow"]') as HTMLElement;
    fireEvent.animationIteration(track);
    await flush();
    expect(screen.queryByText('This is fifth', { exact: false })).toBeNull();
    expect(screen.getByText('First story')).toBeTruthy();
  });

  it('keeps the current events when a refresh returns the same ones', async () => {
    await mount({ sceneMetadata: marqueeScene({}, { showMarkets: true }) });
    await advance(2300);
    const track = screen.getByText('First story').closest('div[style*="marqueeFlow"]') as HTMLElement;
    fireEvent.animationIteration(track);
    await flush();
    expect(screen.queryByText('This is fifth', { exact: false })).toBeNull();
  });
});

describe('callsign take', () => {
  const callsign = () => document.body.textContent?.includes('This is fifthbell.');

  it('interrupts the playlist at the top of the hour and resumes it afterwards', async () => {
    vi.setSystemTime(at('12:59:40'));
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, showMarkets: true }) });
    expect(headings()).toEqual(['Headline A']);
    expect(callsign()).toBeFalsy();

    await advance(10_000);
    expect(callsign()).toBe(true);
    expect(headings()).toEqual([]);

    // window ends 3 seconds after the hour
    await advance(14_000);
    expect(callsign()).toBeFalsy();
    expect(headings()).toEqual(['Headline A']);
    await advance(1100);
    expect(headings()).toEqual(['MERCADOS']);
  });

  it('restarts the playlist from the first segment when the take begins', async () => {
    vi.setSystemTime(at('12:59:46'));
    await mount({ sceneMetadata: content({ ...FAST, showLiveEvents: false, showWeather: false, showEarthquakes: false, showMarkets: true }) });
    await advance(1100);
    expect(headings()).toEqual(['MERCADOS']);
    await advance(5000);
    expect(callsign()).toBe(true);
    await advance(20_000);
    expect(headings()).toEqual(['Headline A']);
  });

  it('honours custom window seconds', async () => {
    vi.setSystemTime(at('12:59:20'));
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, callsignWindowStartSecond: 30, callsignWindowEndSecond: 0 }) });
    expect(callsign()).toBeFalsy();
    await advance(11_000);
    expect(callsign()).toBe(true);
    await advance(30_000);
    expect(callsign()).toBeFalsy();
  });

  it('can be turned off', async () => {
    vi.setSystemTime(at('12:59:58'));
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, showCallsignTake: false }) });
    await advance(3000);
    expect(callsign()).toBeFalsy();
    expect(headings()).toEqual(['Headline A']);
  });

  it('plays before the configured prelaunch moment in New York', async () => {
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, callsignPrelaunchUntilNyc: '  2099-01-01T00:00:00  ' }) });
    expect(callsign()).toBe(true);
    expect(headings()).toEqual([]);
  });

  it('ignores an unreadable prelaunch moment and uses the built-in one', async () => {
    for (const value of ['not a date', '   ', 42]) {
      const { unmount } = await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, callsignPrelaunchUntilNyc: value }) });
      expect(callsign()).toBeFalsy();
      expect(headings()).toEqual(['Headline A']);
      unmount();
    }
  });

  it('hides the marquee during the take', async () => {
    routes['/events'] = { events: [event('abc', 'First story')] };
    vi.setSystemTime(at('12:59:50'));
    await mount({ sceneMetadata: { ...content({ ...FAST, ...ONLY_ARTICLES }), 'modoitaliano-marquee': { showMarquee: true } } });
    expect(callsign()).toBe(true);
    expect(screen.queryByText('First story')).toBeNull();
    await advance(14_000);
    expect(screen.getByText('First story')).toBeTruthy();
  });

  it('shows the callsign time in the world clock while the take is on', async () => {
    vi.setSystemTime(at('12:59:50'));
    const { container } = await mount({ sceneMetadata: { ...content({ ...FAST, ...ONLY_ARTICLES }), 'modoitaliano-corner': { worldClockShuffle: false, worldClockCities: [{ city: 'ACCRA', timezone: 'Africa/Accra' }] } } });
    // Accra stays on UTC all year
    expect(container.querySelector('.pt-1\\.5')!.textContent).toContain('12:59');
    expect(container.querySelector('.pt-1\\.5')!.textContent).toContain('ACCRA');
  });
});

describe('audio cue', () => {
  let play: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  it('plays the jingle at the configured minute and second', async () => {
    vi.setSystemTime(at('12:59:53'));
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, showCallsignTake: false }) });
    const audio = document.querySelector('audio') as HTMLAudioElement;
    audio.currentTime = 9;
    await advance(1000);
    expect(play).not.toHaveBeenCalled();
    await advance(1000);
    expect(play).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(0);
  });

  it('follows custom cue times', async () => {
    vi.setSystemTime(at('12:30:08'));
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, audioCueMinute: 30, audioCueSecond: 10 }) });
    await advance(2000);
    expect(play).toHaveBeenCalledOnce();
  });

  it('logs when the browser blocks playback', async () => {
    play.mockRejectedValue(new Error('autoplay blocked'));
    vi.setSystemTime(at('12:59:54'));
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, showCallsignTake: false }) });
    await advance(1000);
    expect(console.log).toHaveBeenCalledWith('Audio playback prevented:', expect.any(Error));
  });

  it('stays silent when disabled', async () => {
    vi.setSystemTime(at('12:59:54'));
    await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, showCallsignTake: false, audioCueEnabled: 'no' }) });
    await advance(3000);
    expect(play).not.toHaveBeenCalled();
  });
});

describe('scene messages', () => {
  const metadataFor = (props: Record<string, unknown>) => content({ ...FAST, showLiveEvents: false, showWeather: false, showEarthquakes: false, showMarkets: false, showArticles: false, ...props });
  const bootWith = async (props: Record<string, unknown>) => {
    routes['/state'] = programState(metadataFor(props));
    await mount();
  };

  it('replaces the whole state on a scene change', async () => {
    await bootWith({ showArticles: true });
    expect(headings()).toEqual(['Headline A']);
    await emit({ type: 'scene_change', state: programState(metadataFor({ showMarkets: true })) });
    await flush();
    expect(headings()).toEqual(['MERCADOS']);
  });

  it('also follows a program scenes change', async () => {
    await bootWith({ showArticles: true });
    await emit({ type: 'program_scenes_changed', state: programState(metadataFor({ showMarkets: true })) });
    await flush();
    expect(headings()).toEqual(['MERCADOS']);
  });

  it('ignores scene changes that carry no state', async () => {
    await bootWith({ showArticles: true });
    await emit({ type: 'scene_change' });
    await emit({ type: 'program_scenes_changed' });
    expect(headings()).toEqual(['Headline A']);
  });

  it('updates only the active scene on a scene update and keeps it when none is sent', async () => {
    await bootWith({ showArticles: true });
    await emit({ type: 'scene_update', scene: scene(metadataFor({ showMarkets: true })) });
    await flush();
    expect(headings()).toEqual(['MERCADOS']);
    await emit({ type: 'scene_update' });
    await flush();
    expect(headings()).toEqual(['MERCADOS']);
  });

  it('returns to the default scene when the scene is cleared', async () => {
    await bootWith({ showArticles: true });
    await emit({ type: 'scene_cleared' });
    await flush();
    expect(screen.getByText('No hay eventos en vivo')).toBeTruthy();
  });

  it('never puts a staged scene on air', async () => {
    await bootWith({ showArticles: true });
    await emit({ type: 'scene_staged', stagedSceneId: 9, scene: scene(metadataFor({ showMarkets: true }), 9) });
    await emit({ type: 'scene_staged', stagedSceneId: 'bad', scene: 'bad' });
    await emit({ type: 'scene_staged' });
    await flush();
    expect(headings()).toEqual(['Headline A']);
  });

  it('ignores scene messages that arrive before the state is known', async () => {
    routes['/state'] = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (String(input).endsWith('/state')) return new Promise(() => {});
        const key = Object.keys(routes).find((candidate) => String(input).includes(candidate))!;
        return { ok: true, status: 200, statusText: 'OK', json: async () => routes[key] };
      })
    );
    await mount();
    await emit({ type: 'scene_staged', stagedSceneId: 1, scene: scene({}) });
    await emit({ type: 'scene_update', scene: scene(metadataFor({ showMarkets: true })) });
    await emit({ type: 'scene_cleared' });
    await flush();
    expect(screen.getByText('No hay eventos en vivo')).toBeTruthy();
  });

  it('accepts messages that need no action', async () => {
    await bootWith({ showArticles: true });
    for (const type of ['broadcast_settings_update', 'program_stingers_changed', 'unknown_type']) {
      await emit({ type });
    }
    await emit({ type: 'scene_instant_take' });
    await emit({ type: 'instant_play' });
    await emit({ type: 'audio_bus_update' });
    expect(headings()).toEqual(['Headline A']);
    expect(FakeAudio.instances).toHaveLength(0);
  });
});

describe('scene instants', () => {
  beforeEach(async () => {
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
  });

  const take = (instant: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
    emit({ type: 'scene_instant_take', instant: { name: 'Sting', audioUrl: 'https://audio.test/a.mp3', ...instant }, ...extra });

  it('plays a take looping at the instant volume', async () => {
    await take({ volume: 0.5 });
    const [audio] = FakeAudio.instances;
    expect(audio.src).toBe('https://audio.test/a.mp3');
    expect(audio.preload).toBe('auto');
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(0.5);
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it('plays once when the take says not to loop and clamps volumes', async () => {
    await take({ volume: 7 }, { loop: false });
    expect(FakeAudio.instances[0].loop).toBe(false);
    expect(FakeAudio.instances[0].volume).toBe(1);
    await emit({ type: 'scene_instant_stop' });
    await take({ volume: -3 });
    expect(FakeAudio.instances[1].volume).toBe(0);
    await emit({ type: 'scene_instant_stop' });
    await take({});
    expect(FakeAudio.instances[2].volume).toBe(1);
  });

  it('applies the mixer master volume and mute to takes', async () => {
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { sceneInstantMasterVolume: 0.5 } } });
    await take({ volume: 0.5 });
    expect(FakeAudio.instances[0].volume).toBe(0.25);
    await emit({ type: 'scene_instant_stop' });
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { sceneInstantMuted: true } } });
    await take({ volume: 1 });
    expect(FakeAudio.instances[1].volume).toBe(0);
  });

  it('forgets the take when it ends or fails, and reports failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await take();
    const first = FakeAudio.instances[0];
    first.onended!();
    await take();
    const second = FakeAudio.instances[1];
    // the ended take is no longer "currently playing", so no cross-fade was needed
    expect(first.pause).not.toHaveBeenCalled();
    second.onerror!();
    expect(error).toHaveBeenCalledWith('[scene_instant] audio error');
    await take();
    expect(second.pause).not.toHaveBeenCalled();
  });

  it('reports a take that the browser refuses to play', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    FakeAudio.playOutcome = () => Promise.reject(new Error('blocked'));
    await take();
    await flush();
    expect(error).toHaveBeenCalledWith('[scene_instant] play failed:', expect.any(Error));
  });

  it('cross-fades from a playing take to the next one', async () => {
    await take({ volume: 1 });
    const first = FakeAudio.instances[0];
    await take({ audioUrl: 'https://audio.test/b.mp3' });
    // the old take fades out over 1.5 s before the new one starts
    expect(FakeAudio.instances).toHaveLength(1);
    await advance(750);
    expect(first.volume).toBeGreaterThan(0.4);
    expect(first.volume).toBeLessThan(0.6);
    expect(first.pause).not.toHaveBeenCalled();
    await advance(700);
    expect(first.pause).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(1);
    await advance(100);
    expect(first.volume).toBe(0);
    expect(first.pause).toHaveBeenCalledOnce();
    expect(first.currentTime).toBe(0);
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].src).toBe('https://audio.test/b.mp3');
  });

  it('drops a pending take when a newer one supersedes it during the fade', async () => {
    await take();
    await take({ audioUrl: 'https://audio.test/b.mp3' });
    await advance(500);
    await take({ audioUrl: 'https://audio.test/c.mp3' });
    await advance(3000);
    const urls = FakeAudio.instances.map((audio) => audio.src);
    expect(urls).not.toContain('https://audio.test/b.mp3');
    expect(urls).toContain('https://audio.test/c.mp3');
  });

  it('stops the take immediately, or with a fade', async () => {
    await take();
    const first = FakeAudio.instances[0];
    await emit({ type: 'scene_instant_stop' });
    expect(first.pause).toHaveBeenCalledOnce();
    expect(first.onended).toBeNull();
    expect(first.onerror).toBeNull();

    await take();
    const second = FakeAudio.instances[1];
    await emit({ type: 'scene_instant_stop', fadeMs: 1000 });
    expect(second.pause).not.toHaveBeenCalled();
    await advance(1100);
    expect(second.pause).toHaveBeenCalledOnce();
    expect(second.volume).toBe(0);
    expect(second.onended).toBeNull();
  });

  it('tolerates stopping when nothing is playing', async () => {
    await emit({ type: 'scene_instant_stop' });
    await emit({ type: 'scene_instant_stop', fadeMs: 500 });
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('survives an audio element whose time cannot be reset', async () => {
    await take();
    const audio = FakeAudio.instances[0];
    Object.defineProperty(audio, 'currentTime', {
      get: () => 0,
      set: () => {
        throw new Error('not seekable');
      },
    });
    await emit({ type: 'scene_instant_stop' });
    expect(audio.pause).toHaveBeenCalledOnce();
    await take();
    const faded = FakeAudio.instances[1];
    Object.defineProperty(faded, 'currentTime', {
      get: () => 0,
      set: () => {
        throw new Error('not seekable');
      },
    });
    await emit({ type: 'scene_instant_stop', fadeMs: 100 });
    await advance(200);
    expect(faded.pause).toHaveBeenCalledOnce();
  });

  describe('instant state sync', () => {
    const playback = (extra: Record<string, unknown> = {}) => ({ type: 'scene_instant_state', playback: { isPlaying: true, instant: { audioUrl: 'https://audio.test/s.mp3', volume: 0.4 }, ...extra } });

    it('starts the reported instant after the stop fade', async () => {
      await emit(playback());
      expect(FakeAudio.instances).toHaveLength(0);
      await advance(1500);
      const [audio] = FakeAudio.instances;
      expect(audio).toMatchObject({ src: 'https://audio.test/s.mp3', loop: true, volume: 0.4, preload: 'auto' });
      expect(audio.play).toHaveBeenCalledOnce();
    });

    it('uses full volume when none is reported and clamps a loud one', async () => {
      await emit(playback({ instant: { audioUrl: 'https://audio.test/s.mp3' } }));
      await advance(1500);
      expect(FakeAudio.instances[0].volume).toBe(1);
      await emit(playback({ instant: { audioUrl: 'https://audio.test/s.mp3', volume: 9 } }));
      await advance(1600);
      expect(FakeAudio.instances[0].volume).toBe(1);
    });

    it('leaves a playing instant alone', async () => {
      await take();
      const playing = FakeAudio.instances[0];
      await emit(playback());
      await advance(2000);
      expect(FakeAudio.instances).toHaveLength(1);
      expect(playing.pause).not.toHaveBeenCalled();
    });

    it('stops playback when the server reports none', async () => {
      await take();
      const playing = FakeAudio.instances[0];
      await emit({ type: 'scene_instant_state', playback: { isPlaying: false } });
      expect(playing.pause).toHaveBeenCalledOnce();
      await emit({ type: 'scene_instant_state', playback: { isPlaying: true, instant: {} } });
      await emit({ type: 'scene_instant_state' });
      expect(FakeAudio.instances).toHaveLength(1);
    });

    it('reports failures of the synced instant', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      FakeAudio.playOutcome = () => Promise.reject(new Error('blocked'));
      await emit(playback());
      await advance(1500);
      expect(error).toHaveBeenCalledWith('[scene_instant] play failed:', expect.any(Error));
      FakeAudio.instances[0].onerror!();
      FakeAudio.instances[0].onended!();
      expect(error).toHaveBeenCalledWith('[scene_instant] audio error');
    });
  });
});

describe('instant plays', () => {
  beforeEach(async () => {
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
  });

  const play = (instant: Record<string, unknown> = {}) => emit({ type: 'instant_play', instant: { name: 'Horn', audioUrl: 'https://audio.test/h.mp3', ...instant } });

  it('plays overlapping instants once each, without looping', async () => {
    await play({ volume: 0.5 });
    await play();
    expect(FakeAudio.instances.map((audio) => [audio.src, audio.loop, audio.volume])).toEqual([
      ['https://audio.test/h.mp3', false, 0.5],
      ['https://audio.test/h.mp3', false, 1],
    ]);
    expect(FakeAudio.instances.every((audio) => audio.play.mock.calls.length === 1)).toBe(true);
  });

  it('applies the instant master volume and mute', async () => {
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { instantMasterVolume: 0.5 } } });
    await play({ volume: 0.5 });
    expect(FakeAudio.instances[0].volume).toBe(0.25);
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { instantMuted: true } } });
    await play();
    expect(FakeAudio.instances[1].volume).toBe(0);
  });

  it('retunes playing instants when the mixer changes', async () => {
    await play();
    await play();
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { instantMasterVolume: 3 } } });
    expect(FakeAudio.instances.map((audio) => audio.volume)).toEqual([1, 1]);
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { instantMasterVolume: 0.3 } } });
    expect(FakeAudio.instances.map((audio) => audio.volume)).toEqual([0.3, 0.3]);
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { instantMuted: true } } });
    expect(FakeAudio.instances.map((audio) => audio.volume)).toEqual([0, 0]);
  });

  it('retunes the playing scene instant when the mixer changes', async () => {
    await emit({ type: 'scene_instant_take', instant: { audioUrl: 'https://audio.test/a.mp3' } });
    const [audio] = FakeAudio.instances;
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { sceneInstantMasterVolume: 0.2 } } });
    expect(audio.volume).toBe(0.2);
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { sceneInstantMuted: true } } });
    expect(audio.volume).toBe(0);
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { sceneInstantMasterVolume: 4 } } });
    expect(audio.volume).toBe(1);
    await emit({ type: 'audio_bus_update', settings: {} });
    expect(audio.volume).toBe(1);
  });

  it('forgets an instant when it ends or fails, and reports failures', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await play();
    await play();
    const [ended, failed] = FakeAudio.instances;
    ended.onended!();
    failed.onerror!();
    expect(error).toHaveBeenCalledWith('[instant_play] error');
    // both are forgotten, so a stop-all has nothing left to silence
    await emit({ type: 'instant_stop_all' });
    expect(ended.pause).not.toHaveBeenCalled();
    expect(failed.pause).not.toHaveBeenCalled();
  });

  it('reports an instant the browser refuses to play', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    FakeAudio.playOutcome = () => Promise.reject(new Error('blocked'));
    await play();
    await flush();
    expect(error).toHaveBeenCalledWith('[instant_play] play failed:', expect.any(Error));
  });

  it('stops every instant and the scene instant', async () => {
    await emit({ type: 'scene_instant_take', instant: { audioUrl: 'https://audio.test/a.mp3' } });
    await play();
    await play();
    await emit({ type: 'instant_stop_all' });
    expect(FakeAudio.instances.every((audio) => audio.pause.mock.calls.length === 1)).toBe(true);
    expect(FakeAudio.instances.every((audio) => audio.onended === null && audio.onerror === null)).toBe(true);
    // everything was forgotten
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: { instantMasterVolume: 0.5 } } });
    expect(FakeAudio.instances[1].volume).toBe(1);
  });

  it('survives instants whose time cannot be reset on stop', async () => {
    await play();
    Object.defineProperty(FakeAudio.instances[0], 'currentTime', {
      get: () => 0,
      set: () => {
        throw new Error('not seekable');
      },
    });
    await emit({ type: 'instant_stop_all' });
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
  });
});

describe('song sequence', () => {
  beforeEach(async () => {
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
  });

  const bus = (songSequence: unknown, mixerSettings: Record<string, unknown> = {}) => emit({ type: 'audio_bus_update', settings: { mixerSettings, songSequence } });
  const items = [
    { id: 'one', audioUrl: 'https://audio.test/one.mp3' },
    { id: 'two', audioUrl: 'https://audio.test/two.mp3' },
  ];

  it('plays the active item, looping, at the song volume', async () => {
    await bus({ items, activeItemId: 'two' }, { songMasterVolume: 0.6 });
    const [song] = FakeAudio.instances;
    expect(song).toMatchObject({ src: 'https://audio.test/two.mp3', loop: true, volume: 0.6, preload: 'auto' });
    expect(song.play).toHaveBeenCalledOnce();
  });

  it('starts with the first item when none is active and honours loop and mute', async () => {
    await bus({ items, activeItemId: 'missing', loop: false }, { songMuted: true });
    expect(FakeAudio.instances[0]).toMatchObject({ src: 'https://audio.test/one.mp3', loop: false, volume: 0 });
  });

  it('clamps the song volume', async () => {
    await bus({ items }, { songMasterVolume: 5 });
    expect(FakeAudio.instances[0].volume).toBe(1);
  });

  it('keeps playing when the same song is sent again', async () => {
    await bus({ items, activeItemId: 'one' });
    FakeAudio.instances[0].src = 'https://audio.test/one.mp3';
    await bus({ items, activeItemId: 'one' });
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('switches to another song and stops the previous one', async () => {
    await bus({ items, activeItemId: 'one' });
    const [first] = FakeAudio.instances;
    await bus({ items, activeItemId: 'two' });
    expect(first.pause).toHaveBeenCalledOnce();
    expect(first.onended).toBeNull();
    expect(first.onerror).toBeNull();
    expect(FakeAudio.instances[1].src).toBe('https://audio.test/two.mp3');
  });

  it('does not start a song for an active item without audio', async () => {
    await bus({ items: [{ id: 'a' }, { id: 'b', audioUrl: 'https://audio.test/b.mp3' }], activeItemId: 'a' });
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('stops the song when the sequence empties or has no audio', async () => {
    await bus({ items, activeItemId: 'one' });
    const [song] = FakeAudio.instances;
    await bus({ items: [] });
    expect(song.pause).toHaveBeenCalledOnce();
    await bus({ items, activeItemId: 'one' });
    const [, second] = FakeAudio.instances;
    await bus({ items: [{ id: 'x' }] });
    expect(second.pause).toHaveBeenCalledOnce();
    await bus(undefined);
    expect(FakeAudio.instances).toHaveLength(2);
  });

  it('reports a song that fails to play or errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    FakeAudio.playOutcome = () => Promise.reject(new Error('blocked'));
    await bus({ items, activeItemId: 'one' });
    await flush();
    expect(error).toHaveBeenCalledWith('[song] play failed:', expect.any(Error));
    FakeAudio.instances[0].onerror!();
    expect(error).toHaveBeenCalledWith('[song] playback error');
  });

  it('takes the song off the air', async () => {
    await bus({ items, activeItemId: 'one' });
    const [song] = FakeAudio.instances;
    await emit({ type: 'song_off_air' });
    expect(song.pause).toHaveBeenCalledOnce();
    expect(song.onerror).toBeNull();
    await emit({ type: 'song_off_air' });
    expect(song.pause).toHaveBeenCalledOnce();
    // after going off air the same song starts again from scratch
    await bus({ items, activeItemId: 'one' });
    expect(FakeAudio.instances).toHaveLength(2);
  });
});

describe('program reload', () => {
  const replace = vi.fn();
  beforeEach(async () => {
    replace.mockReset();
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ href: 'http://localhost:3000/live?x=1', replace } as unknown as Location);
  });
  afterEach(() => {
    delete (window as unknown as { caches?: unknown }).caches;
  });

  it('reloads with a cache-busting parameter when there is no cache storage', async () => {
    await emit({ type: 'program_reload' });
    expect(replace).toHaveBeenCalledOnce();
    const url = new URL(replace.mock.calls[0][0]);
    expect(url.searchParams.get('x')).toBe('1');
    expect(url.searchParams.get('_reload')).toBe(String(Date.now()));
  });

  it('clears every cache before reloading', async () => {
    const del = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', { configurable: true, value: { keys: vi.fn().mockResolvedValue(['a', 'b']), delete: del } });
    await emit({ type: 'program_reload' });
    await flush();
    expect(del.mock.calls.map(([key]) => key)).toEqual(['a', 'b']);
    expect(replace).toHaveBeenCalledOnce();
  });

  it('reloads anyway when clearing the caches fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(window, 'caches', { configurable: true, value: { keys: vi.fn().mockRejectedValue(new Error('denied')), delete: vi.fn() } });
    await emit({ type: 'program_reload' });
    await flush();
    expect(warn).toHaveBeenCalledWith('[program_reload] cache clear failed:', expect.any(Error));
    expect(replace).toHaveBeenCalledOnce();
  });
});
