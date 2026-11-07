// @vitest-environment happy-dom
import { createElement as h, cloneElement, type ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createArticlesSegment,
  createEarthquakeSegment,
  createLiveEventSegment,
  createMarketsSegment,
  createWeatherSegment,
  fetchArticles,
  fetchEarthquakes,
  fetchWeatherData,
  fetchLiveEvent,
  type EarthquakeData,
  type LiveEventData,
  type NewsItem,
  type WeatherRegionData,
} from './index.js';
import { fetchMarketData, getLastUpdateTime, type MarketData } from './MarketsSegment.js';
import type { Segment } from './types.js';

const { getColor } = vi.hoisted(() => ({ getColor: vi.fn() }));
vi.mock('fast-average-color', () => ({
  FastAverageColor: class {
    getColor = getColor;
  },
}));

const NOW = new Date('2026-03-11T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return { ok: init.ok ?? true, status: init.status ?? 200, statusText: init.statusText ?? 'OK', json: async () => body };
}

function stubFetch(impl: (url: string) => unknown) {
  const stub = vi.fn(async (url: string) => impl(url));
  vi.stubGlobal('fetch', stub);
  return stub;
}

const view = (segment: Segment, itemIndex = 0, progress = 0) => render(segment.render(itemIndex, progress) as ReactElement);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  getColor.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('articles segment', () => {
  type FeedArticle = Record<string, unknown>;
  const article = (id: number, extra: FeedArticle = {}): FeedArticle => ({
    id,
    title: `Title ${id}`,
    excerpt: `Excerpt ${id}`,
    slug: `slug-${id}`,
    featured: false,
    featuredImage: { url: `https://img.test/${id}.jpg` },
    categories: [],
    publishedAt: hoursAgo(id),
    ...extra,
  });
  const feed = (articles: FeedArticle[]) => stubFetch(() => jsonResponse({ articles }));

  class FakeImage {
    static created: FakeImage[] = [];
    crossOrigin = '';
    src = '';
    constructor() {
      FakeImage.created.push(this);
    }
  }
  beforeEach(() => {
    FakeImage.created = [];
    vi.stubGlobal('Image', FakeImage);
  });

  it('requests the language specific homepage feed without caching', async () => {
    const fetchStub = feed([article(1)]);
    await fetchArticles('en');
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://cdn.modoitaliano.fm/content/homepage-current-en.json?_=${NOW.getTime()}`);
    expect(init).toEqual({ cache: 'no-store' });
    await fetchArticles();
    expect((fetchStub.mock.calls[1] as unknown as [string])[0]).toContain('homepage-current-es.json');
  });

  it('maps articles and preloads their images with cross-origin access', async () => {
    feed([article(1, { categories: [{ name: 'Mundo', slug: 'mundo' }] })]);
    const items = await fetchArticles('es');
    expect(items).toEqual([
      { id: '1', headline: 'Title 1', summary: 'Excerpt 1', imageUrl: 'https://img.test/1.jpg', category: 'Mundo', url: 'https://modoitaliano.fm/mundo/slug-1' },
    ]);
    expect(FakeImage.created.map((image) => [image.crossOrigin, image.src])).toEqual([['anonymous', 'https://img.test/1.jpg']]);
  });

  it('puts recent featured articles first, drops those without images and keeps ten', async () => {
    const articles = [
      article(30, { featured: true, publishedAt: hoursAgo(30) }),
      article(2, { featured: true }),
      article(1, { featured: true }),
      article(3, { featuredImage: { url: '' } }),
      article(4, { featuredImage: undefined }),
      ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((id) => article(id)),
    ];
    feed(articles);
    const items = await fetchArticles();
    expect(items.map((item) => item.id)).toEqual(['1', '2', '5', '6', '7', '8', '9', '10', '11', '12']);
  });

  it('builds the article url from the explicit path, category, slug or canonical url', async () => {
    feed([
      article(1, { url: '/mundo//politica/?utm=1' }),
      article(2, { url: '  ', slug: '/clima', categories: [{ name: 'Clima', slug: ' clima ' }] }),
      article(3, { slug: 'bare', categories: [{ name: 'Sin slug' }] }),
      article(4, { slug: '  ', canonicalUrl: '/canon/', categories: [] }),
      article(5, { slug: '', canonicalUrl: null, categories: undefined }),
      article(6, { url: 42, slug: 'numeric-url' }),
      article(7, { url: null, slug: '?only-query' }),
    ]);
    const urls = Object.fromEntries((await fetchArticles('es')).map((item) => [item.id, item.url]));
    expect(urls).toEqual({
      '1': 'https://modoitaliano.fm/mundo/politica',
      '2': 'https://modoitaliano.fm/clima/clima',
      '3': 'https://modoitaliano.fm/bare',
      '4': 'https://modoitaliano.fm/canon',
      '5': 'https://modoitaliano.fm/',
      '6': 'https://modoitaliano.fm/numeric-url',
      '7': 'https://modoitaliano.fm/',
    });
  });

  it('prefixes non-default languages and omits the category when missing', async () => {
    feed([article(1, { categories: [{ name: 'World', slug: 'world' }] }), article(2)]);
    const items = await fetchArticles('en');
    expect(items.find((item) => item.id === '1')).toMatchObject({ category: 'World', url: 'https://modoitaliano.fm/en/world/slug-1' });
    expect(items.find((item) => item.id === '2')?.category).toBeUndefined();
  });

  it('falls back to the built-in articles when the feed is empty, malformed or unavailable', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    feed([]);
    const empty = await fetchArticles();
    expect(empty).toHaveLength(5);
    expect(empty[0].headline).toBe('La cumbre climática mundial alcanza un acuerdo histórico');
    expect(FakeImage.created).toHaveLength(5);

    stubFetch(() => jsonResponse({ articles: 'nope' }));
    expect(await fetchArticles()).toHaveLength(5);

    stubFetch(() => jsonResponse({}, { ok: false, status: 502, statusText: 'Bad Gateway' }));
    expect(await fetchArticles()).toHaveLength(5);
    expect(error).toHaveBeenCalledWith('Error fetching news items:', expect.objectContaining({ message: 'Failed to fetch homepage feed: 502 Bad Gateway' }));

    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await fetchArticles()).toHaveLength(5);
  });

  const items: NewsItem[] = [1, 2, 3].map((n) => ({ id: String(n), headline: `Headline ${n}`, summary: `Summary ${n}`, imageUrl: `https://img.test/${n}.jpg`, url: `https://modoitaliano.fm/${n}` }));

  it('describes the segment from the supplied articles', () => {
    const segment = createArticlesSegment(items, undefined, 'en');
    expect(segment).toMatchObject({ id: 'articles', label: 'News Articles', itemCount: 3, durationMsPerItem: 10000 });
    expect(createArticlesSegment([], undefined, 'it').label).toBe('Articoli');
  });

  it('renders the requested article, wrapping the index, with the progress bar', () => {
    const segment = createArticlesSegment(items);
    const { container } = view(segment, 4, 55);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Headline 2');
    expect(container.innerHTML).toContain('width: 55%');
  });

  it('shows the built-in articles when there are none and keeps the count in step', () => {
    const segment = createArticlesSegment([]);
    expect(segment.itemCount).toBe(5);
    view(segment, 1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Anuncian un avance en la computación cuántica');
  });

  it('cross-fades from the previous article when the shown index changes in place', () => {
    const segment = createArticlesSegment(items);
    const first = segment.render(0, 0) as ReactElement;
    const { container, rerender } = render(first);
    expect(container.querySelectorAll('h1')).toHaveLength(1);

    rerender(cloneElement(first, { itemIndex: 1 } as never));
    // old and new slides overlap while the transition runs
    expect(Array.from(container.querySelectorAll('h1')).map((node) => node.textContent)).toEqual(['Headline 1', 'Headline 2']);
    expect(container.querySelector('.animate-slide-transition')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(Array.from(container.querySelectorAll('h1')).map((node) => node.textContent)).toEqual(['Headline 2']);
    expect(container.querySelector('.animate-slide-transition')).toBeNull();
  });

  it('cancels a pending cross-fade on unmount', () => {
    const segment = createArticlesSegment(items);
    const first = segment.render(0, 0) as ReactElement;
    const { rerender, unmount } = render(first);
    rerender(cloneElement(first, { itemIndex: 1 } as never));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('tells the viewer when the renderer is given no articles', () => {
    const segment = createArticlesSegment(items, undefined, 'en');
    const element = segment.render(0, 0) as ReactElement;
    const { container } = render(cloneElement(element, { items: [] } as never));
    expect(container.textContent).toBe('No articles available');
    const transition = render(cloneElement(element, { items: [] } as never));
    expect(transition.container.textContent).toBe('No articles available');
  });

  it('refreshes the articles on prefetch only when a listener is registered', async () => {
    feed([article(1)]);
    await createArticlesSegment(items).prefetch!();
    expect(fetch).not.toHaveBeenCalled();

    const onDataUpdate = vi.fn();
    await createArticlesSegment(items, onDataUpdate, 'en').prefetch!();
    expect(onDataUpdate).toHaveBeenCalledWith([expect.objectContaining({ id: '1', url: 'https://modoitaliano.fm/slug-1' })]);
  });
});

describe('weather segment', () => {
  const regions: WeatherRegionData[] = [
    {
      region: 'Europe',
      cities: [
        { name: 'Rome', temp: 68, condition: 'sunny', high: 77, low: 50 },
        { name: 'Berlin', temp: 41, condition: 'rainy', high: 50, low: 32 },
        { name: 'Oslo', temp: 23, condition: 'windy', high: 32, low: 14 },
        { name: 'Paris', temp: 59, condition: 'cloudy', high: 68, low: 50 },
      ],
    },
    { region: 'Atlantis', cities: [{ name: 'Deep City', temp: 50, condition: 'cloudy', high: 60, low: 40 }] },
  ];

  it('describes the segment, doubling the items for the two temperature units', () => {
    expect(createWeatherSegment(regions, undefined, 'en')).toMatchObject({ id: 'weather', label: 'Weather', itemCount: 4, durationMsPerItem: 5000 });
    expect(createWeatherSegment([]).itemCount).toBe(8);
  });

  it('shows a loading slide until data is available', () => {
    view(createWeatherSegment([], undefined, 'en'));
    expect(screen.getByText('Loading weather data...')).toBeTruthy();
  });

  it('renders each city in Fahrenheit for even items', () => {
    const { container } = view(createWeatherSegment(regions, undefined, 'en'), 0, 30);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('WEATHER');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Europe');
    const rome = screen.getByText('Rome').closest('.flex.items-center') as HTMLElement;
    expect(rome.textContent).toContain('68°F');
    expect(rome.textContent).toContain('High 77°F');
    expect(rome.textContent).toContain('Low 50°F');
    expect(container.innerHTML).toContain('width: 30%');
    // one weather icon per condition
    expect(container.querySelectorAll('svg.lucide-sun, svg.lucide-cloud-rain, svg.lucide-wind, svg.lucide-cloud')).toHaveLength(4);
  });

  it('renders Celsius when mounted on an odd item', () => {
    const { container } = view(createWeatherSegment(regions, undefined, 'en'), 1);
    expect(container.querySelector('span.text-5xl')?.textContent).toBe('20°C');
  });

  it('switches units in place with a short fade', () => {
    const segment = createWeatherSegment(regions, undefined, 'en');
    const { container, rerender } = render(segment.render(0, 0) as ReactElement);
    const temperature = () => (container.querySelector('span.text-5xl') as HTMLElement);
    expect(temperature().textContent).toBe('68°F');

    rerender(segment.render(1, 0) as ReactElement);
    expect(temperature().style.opacity).toBe('0');
    // still the old unit while fading out
    expect(temperature().textContent).toBe('68°F');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(temperature().style.opacity).toBe('1');
    expect(temperature().textContent).toBe('20°C');
    expect(container.textContent).toContain('High 25°C');
    expect(container.textContent).toContain('Low 10°C');
  });

  it('cancels the unit fade when unmounted mid-way', () => {
    const segment = createWeatherSegment(regions, undefined, 'en');
    const { rerender, unmount } = render(segment.render(0, 0) as ReactElement);
    rerender(segment.render(1, 0) as ReactElement);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('moves to the next region after both units and wraps around', () => {
    const segment = createWeatherSegment(regions, undefined, 'en');
    expect(view(segment, 2).container.querySelector('h2')?.textContent).toBe('region.Atlantis');
    cleanup();
    expect(view(segment, 4).container.querySelector('h2')?.textContent).toBe('Europe');
  });

  it('uses a region specific background and tints from it', () => {
    const backgrounds: Record<string, string> = {
      'North America': 'nyc.jpg',
      Europe: 'berlin.jpg',
      'South America': 'santiago.jpg',
      Asia: 'tokyo.jpg',
    };
    for (const [region, file] of Object.entries(backgrounds)) {
      const { container, unmount } = view(createWeatherSegment([{ region, cities: regions[0].cities }]));
      expect(container.querySelector('img')?.getAttribute('src')).toBe(`./modoitaliano/images/${file}`);
      unmount();
    }
  });

  it('renders no background image for an unknown region', () => {
    const { container } = view(createWeatherSegment([regions[1]]));
    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps the default tint when the colour cannot be read and applies it when it can', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = view(createWeatherSegment(regions));
    const overlay = container.querySelector('.mix-blend-multiply') as HTMLElement;
    const image = container.querySelector('img') as HTMLImageElement;
    expect(overlay.style.background).toContain('#1e40af');
    getColor.mockReturnValueOnce({ hex: '#abcdef' });
    fireEvent.load(image);
    expect(overlay.style.background).toContain('#abcdef');
    getColor.mockImplementationOnce(() => {
      throw new Error('tainted canvas');
    });
    fireEvent.load(image);
    expect(error).toHaveBeenCalledOnce();
    expect(overlay.style.background).toContain('#1e40af');
  });

  it('fetches weather once and serves it from the cache for an hour', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // nothing cached yet: HTTP failures and network errors yield an empty list
    stubFetch(() => jsonResponse(null, { ok: false, status: 500 }));
    expect(await fetchWeatherData()).toEqual([]);
    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await fetchWeatherData()).toEqual([]);

    const fetchStub = stubFetch(() => jsonResponse(regions));
    expect(await fetchWeatherData()).toEqual(regions);
    expect(fetchStub.mock.calls[0][0]).toBe('https://api.monitor.gaulatti.com/broadcast/weather');

    vi.setSystemTime(new Date(NOW.getTime() + 59 * 60_000));
    expect(await fetchWeatherData()).toEqual(regions);
    expect(fetchStub).toHaveBeenCalledOnce();

    // once stale, failures serve the last good data
    vi.setSystemTime(new Date(NOW.getTime() + 61 * 60_000));
    stubFetch(() => jsonResponse(null, { ok: false, status: 500 }));
    expect(await fetchWeatherData()).toEqual(regions);
    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await fetchWeatherData()).toEqual(regions);

    const fresh: WeatherRegionData[] = [regions[1]];
    stubFetch(() => jsonResponse(fresh));
    expect(await fetchWeatherData()).toEqual(fresh);
  });

  it('prefetches through the update listener only when one is registered', async () => {
    const fetchStub = stubFetch(() => jsonResponse(regions));
    await createWeatherSegment(regions).prefetch!();
    expect(fetchStub).not.toHaveBeenCalled();
    const onDataUpdate = vi.fn();
    vi.setSystemTime(new Date(NOW.getTime() + 3 * 3_600_000));
    await createWeatherSegment(regions, onDataUpdate).prefetch!();
    expect(onDataUpdate).toHaveBeenCalledOnce();
  });
});

describe('earthquake segment', () => {
  const quake = (id: number, magnitude: number, hours: number, extra: Record<string, unknown> = {}) => ({
    id,
    magnitude,
    depth: 10.4,
    timestamp: hoursAgo(hours),
    latitude: 35.6812,
    longitude: 139.7671,
    datapoints: [],
    ...extra,
  });

  it('requests the earthquake feed and keeps recent M4.5+ quakes, newest first, at most six', async () => {
    const fetchStub = stubFetch(() =>
      jsonResponse([
        quake(1, 4.4, 1),
        quake(2, 6.2, 25),
        quake(3, 4.5, 3),
        quake(4, 5.04, 2),
        ...[5, 6, 7, 8, 9].map((id) => quake(id, 5, 4 + id / 10)),
      ])
    );
    const result = await fetchEarthquakes('en');
    expect(fetchStub.mock.calls[0][0]).toBe(`https://api.monitor.gaulatti.com/earthquakes?_=${NOW.getTime()}`);
    expect(result.map((q) => q.id)).toEqual([4, 3, 5, 6, 7, 8]);
    expect(result[0]).toMatchObject({ magnitude: 5, depth: 10 });
  });

  it('describes places and sources from the datapoints', async () => {
    stubFetch(() =>
      jsonResponse([
        quake(1, 5, 1, { datapoints: [{ source: 'USGS', additionalData: { place: 'Near Tokyo' } }, { source: 'EMSC', additionalData: { place: 'Ignored' } }, { source: 'USGS' }] }),
        quake(2, 5, 2, { datapoints: [{ source: 'JMA', additionalData: { localPlace: 'Kanto' } }, { source: 'X', additionalData: { place: 'Later', localPlace: 'Later local' } }] }),
        quake(3, 5, 3, { datapoints: [{ source: 'NOAA', additionalData: {} }] }),
      ])
    );
    const [first, second, third] = await fetchEarthquakes();
    expect(first).toMatchObject({ location: 'Near Tokyo', detailedPlace: 'Near Tokyo', sources: ['USGS', 'EMSC'], lat: 35.6812, lng: 139.7671 });
    expect(second).toMatchObject({ location: 'Kanto', sources: ['JMA', 'X'] });
    expect(third).toMatchObject({ location: '35.68°, 139.77°', detailedPlace: '', sources: ['NOAA'] });
  });

  it('labels how long ago each quake happened in the requested language', async () => {
    const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
    stubFetch(() =>
      jsonResponse([
        quake(1, 5, 0, { timestamp: minutesAgo(0.5) }),
        quake(2, 5, 0, { timestamp: minutesAgo(1) }),
        quake(3, 5, 0, { timestamp: minutesAgo(12) }),
        quake(4, 5, 1),
        quake(5, 5, 5),
        quake(6, 5, 23.9),
      ])
    );
    const times = Object.fromEntries((await fetchEarthquakes('en')).map((q) => [q.id, q.time]));
    expect(times).toEqual({ 1: 'Just now', 2: '1 minute ago', 3: '12 minutes ago', 4: '1 hour ago', 5: '5 hours ago', 6: '23 hours ago' });
  });

  it('labels a quake exactly a day old as one day ago', async () => {
    stubFetch(() => jsonResponse([quake(1, 5, 24)]));
    expect((await fetchEarthquakes('en'))[0].time).toBe('1 day ago');
  });

  it('returns nothing when the feed is unavailable or malformed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => jsonResponse(null, { ok: false, status: 500 }));
    expect(await fetchEarthquakes()).toEqual([]);
    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await fetchEarthquakes()).toEqual([]);
    expect(error).toHaveBeenCalledWith('Failed to fetch earthquake data:', expect.any(Error));
  });

  const data = (id: number, magnitude: number, extra: Partial<EarthquakeData> = {}): EarthquakeData => ({
    id,
    magnitude,
    location: `Place ${id}`,
    depth: 12,
    time: '2 hours ago',
    timestamp: 0,
    lat: 10.123,
    lng: -20.456,
    sources: ['USGS', 'EMSC'],
    ...extra,
  });

  it('describes the segment', () => {
    expect(createEarthquakeSegment([], undefined, 'en')).toMatchObject({ id: 'earthquakes', label: 'Earthquakes', itemCount: 1, durationMsPerItem: 10000 });
  });

  it('shows a loading slide while there is no data', () => {
    view(createEarthquakeSegment([], undefined, 'en'));
    expect(screen.getByText('Loading earthquake data...')).toBeTruthy();
  });

  it('lists each quake with its magnitude, place, age, depth, coordinates and sources', () => {
    const { container } = view(createEarthquakeSegment([data(1, 6.04), data(2, 5, { sources: [] })], undefined, 'en'), 0, 40);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('RECENT EARTHQUAKES');
    expect(screen.getByText('Last 24 Hours • Magnitude 4.5+')).toBeTruthy();
    expect(screen.getByText('M6.0')).toBeTruthy();
    const card = screen.getByText('Place 1').closest('.grid') as HTMLElement;
    expect(card.textContent).toContain('2 hours ago');
    expect(card.textContent).toContain('12 km deep');
    expect(card.textContent).toContain('10.12°, -20.46°');
    expect(card.textContent).toContain('USGS, EMSC');
    // a quake with no sources has no source row
    const bare = screen.getByText('Place 2').closest('.grid') as HTMLElement;
    expect(bare.querySelectorAll('svg')).toHaveLength(3);
    expect(container.innerHTML).toContain('width: 40%');
  });

  it('shades each card by severity band', () => {
    const { container } = view(createEarthquakeSegment([data(1, 4.5), data(2, 4.75), data(3, 5), data(4, 6), data(5, 7), data(6, 7.5), data(7, 9)]));
    // trim floating point noise such as 0.32499999999999996
    const backgrounds = Array.from(container.querySelectorAll('.rounded-lg')).map((card) => (card as HTMLElement).style.backgroundColor.replace(/0\.3249\d+/, '0.325'));
    expect(backgrounds).toEqual([
      'rgba(34, 197, 94, 0.15)',
      'rgba(34, 197, 94, 0.325)',
      'rgba(234, 179, 8, 0.15)',
      'rgba(234, 179, 8, 0.325)',
      'rgba(220, 38, 38, 0.15)',
      'rgba(220, 38, 38, 0.325)',
      'rgba(220, 38, 38, 0.5)',
    ]);
  });

  it('tints from the seismograph image', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = view(createEarthquakeSegment([data(1, 5)]));
    const image = container.querySelector('img') as HTMLImageElement;
    const overlay = container.querySelector('.mix-blend-multiply') as HTMLElement;
    expect(image.getAttribute('src')).toBe('./modoitaliano/images/seismograph.jpg');
    getColor.mockReturnValueOnce({ hex: '#112233' });
    fireEvent.load(image);
    expect(overlay.style.background).toContain('#112233');
    getColor.mockImplementationOnce(() => {
      throw new Error('tainted canvas');
    });
    fireEvent.load(image);
    expect(error).toHaveBeenCalledOnce();
    expect(overlay.style.background).toContain('#7c2d12');
  });

  it('shows the empty message when the slide itself is given no quakes', () => {
    const segment = createEarthquakeSegment([data(1, 5)], undefined, 'en');
    const element = segment.render(0, 0) as ReactElement;
    render(cloneElement(element, { earthquakes: [] } as never));
    expect(screen.getByText('No significant earthquakes in the last 24 hours')).toBeTruthy();
  });

  it('prefetches through the update listener only when one is registered', async () => {
    const fetchStub = stubFetch(() => jsonResponse([quake(1, 5, 1)]));
    await createEarthquakeSegment([]).prefetch!();
    expect(fetchStub).not.toHaveBeenCalled();
    const onDataUpdate = vi.fn();
    await createEarthquakeSegment([], onDataUpdate, 'en').prefetch!();
    expect(onDataUpdate).toHaveBeenCalledWith([expect.objectContaining({ id: 1, time: '1 hour ago' })]);
  });
});

describe('markets segment', () => {
  const markets: MarketData[] = [
    { symbol: 'AAPL', name: 'Apple', price: 189.5, change: 2.345, changePercent: 1.2345 },
    { symbol: 'TSLA', name: 'Tesla', price: 240, change: -5.5, changePercent: -2.2917 },
    { symbol: 'FLAT', name: 'Flat', price: 10, change: 0, changePercent: 0 },
  ];

  it('describes the segment', () => {
    expect(createMarketsSegment(markets, undefined, 'en')).toMatchObject({ id: 'markets', label: 'Markets', itemCount: 1, durationMsPerItem: 10000 });
  });

  it('shows a loading slide without data', () => {
    view(createMarketsSegment([], undefined, 'en'));
    expect(screen.getByText('Loading market data...')).toBeTruthy();
  });

  it('shows every quote with price, signed change and percentage', () => {
    const { container } = view(createMarketsSegment(markets, undefined, 'en'), 0, 65);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('MARKETS');
    expect(screen.getByText('Most Traded')).toBeTruthy();
    const card = (symbol: string) => screen.getByText(symbol).closest('.grid') as HTMLElement;
    expect(card('AAPL').textContent).toContain('$189.50');
    expect(card('AAPL').textContent).toContain('+2.35');
    expect(card('AAPL').textContent).toContain('(+1.23%)');
    expect(card('TSLA').textContent).toContain('$240.00');
    expect(card('TSLA').textContent).toContain('-5.50');
    expect(card('TSLA').textContent).toContain('(-2.29%)');
    // zero change counts as positive
    expect(card('FLAT').textContent).toContain('+0.00');
    expect(card('AAPL').querySelector('.text-green-400')).not.toBeNull();
    expect(card('TSLA').querySelector('.text-red-400')).not.toBeNull();
    expect(card('AAPL').querySelector('svg.lucide-trending-up')).not.toBeNull();
    expect(card('TSLA').querySelector('svg.lucide-trending-down')).not.toBeNull();
    expect(container.innerHTML).toContain('width: 65%');
  });

  it('scales the card tint with the size of the move', () => {
    const quotes: MarketData[] = [
      { symbol: 'A', name: 'a', price: 1, change: 0, changePercent: 0 },
      { symbol: 'B', name: 'b', price: 1, change: 1, changePercent: 99 },
      { symbol: 'C', name: 'c', price: 1, change: -1, changePercent: -500 },
    ];
    const { container } = view(createMarketsSegment(quotes));
    const backgrounds = Array.from(container.querySelectorAll('.rounded-lg')).map((card) => (card as HTMLElement).style.backgroundColor);
    expect(backgrounds[0]).toBe('rgba(34, 197, 94, 0.15)');
    expect(backgrounds[1]).toMatch(/^rgba\(34, 197, 94, 0\.49\d*\)$/);
    expect(backgrounds[2]).toBe('rgba(239, 68, 68, 0.5)');
  });

  it('tints from the stock exchange image', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = view(createMarketsSegment(markets));
    const image = container.querySelector('img') as HTMLImageElement;
    const overlay = container.querySelector('.mix-blend-multiply') as HTMLElement;
    expect(image.getAttribute('src')).toBe('./modoitaliano/images/nyse.jpg');
    getColor.mockReturnValueOnce({ hex: '#445566' });
    fireEvent.load(image);
    expect(overlay.style.background).toContain('#445566');
    getColor.mockImplementationOnce(() => {
      throw new Error('tainted canvas');
    });
    fireEvent.load(image);
    expect(error).toHaveBeenCalledOnce();
    expect(overlay.style.background).toContain('#065f46');
  });

  it('caches the quotes for fifteen minutes and serves stale data when the feed fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // before any success there is nothing to show
    expect(getLastUpdateTime()).toBe('--:--');
    stubFetch(() => jsonResponse(null, { ok: false, status: 500 }));
    expect(await fetchMarketData()).toEqual([]);
    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await fetchMarketData()).toEqual([]);

    const fetchStub = stubFetch(() => jsonResponse(markets));
    expect(await fetchMarketData()).toEqual(markets);
    expect((fetchStub.mock.calls[0] as unknown as [string])[0]).toBe(`https://api.monitor.gaulatti.com/broadcast/markets?_=${NOW.getTime()}`);
    expect(getLastUpdateTime()).toMatch(/^\d\d:\d\d [AP]M$/);

    vi.setSystemTime(new Date(NOW.getTime() + 14 * 60_000));
    expect(await fetchMarketData()).toEqual(markets);
    expect(fetchStub).toHaveBeenCalledOnce();

    vi.setSystemTime(new Date(NOW.getTime() + 16 * 60_000));
    stubFetch(() => jsonResponse(null, { ok: false, status: 500 }));
    expect(await fetchMarketData()).toEqual(markets);
    stubFetch(() => {
      throw new Error('offline');
    });
    expect(await fetchMarketData()).toEqual(markets);

    const fresh = [markets[0]];
    stubFetch(() => jsonResponse(fresh));
    expect(await fetchMarketData()).toEqual(fresh);
  });

  it('reports the last update time on the slide', () => {
    view(createMarketsSegment(markets, undefined, 'en'));
    expect(screen.getByText(`Last update: ${getLastUpdateTime()}`)).toBeTruthy();
  });

  it('prefetches through the update listener only when one is registered', async () => {
    const fetchStub = stubFetch(() => jsonResponse(markets));
    await createMarketsSegment(markets).prefetch!();
    expect(fetchStub).not.toHaveBeenCalled();
    const onDataUpdate = vi.fn();
    vi.setSystemTime(new Date(NOW.getTime() + 60 * 60_000));
    await createMarketsSegment(markets, onDataUpdate).prefetch!();
    expect(onDataUpdate).toHaveBeenCalledOnce();
  });
});

describe('live event segment', () => {
  const event: LiveEventData = {
    category: 'POLITICA',
    title: 'Breaking now',
    excerpt: 'Excerpt',
    image: 'https://img.test/live.jpg',
    alt: 'alt',
    url: '/story',
    updatedAt: '2026-03-11T00:00:00.000Z',
    updates: [{ time: '10:00', text: 'First update' }],
  };

  it('describes the segment with one item only while an event is live', () => {
    const segment = createLiveEventSegment(event, undefined, 'en');
    expect(segment).toMatchObject({ id: 'live-event', label: 'Live Event', itemCount: 1, durationMsPerItem: 15000 });
    expect(createLiveEventSegment(null).itemCount).toBe(0);
  });

  it('renders the live event slide', () => {
    view(createLiveEventSegment(event, undefined, 'en'), 0, 20);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Breaking now');
    expect(screen.getByText('First update')).toBeTruthy();
  });

  it('says there are no live events when there is no event', () => {
    view(createLiveEventSegment(null, undefined, 'en'));
    expect(screen.getByText('No live events')).toBeTruthy();
  });

  it('refreshes through the update listener only when one is registered', async () => {
    const fetchStub = stubFetch(() => jsonResponse({ breakingNews: { main: { title: 'Fresh' } } }));
    await createLiveEventSegment(event).prefetch!();
    expect(fetchStub).not.toHaveBeenCalled();

    const onDataUpdate = vi.fn();
    await createLiveEventSegment(event, onDataUpdate, 'en').prefetch!();
    expect(fetchStub.mock.calls[0][0]).toContain('homepage-current-en.json');
    expect(onDataUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fresh' }));

    stubFetch(() => jsonResponse({}));
    await createLiveEventSegment(event, onDataUpdate).prefetch!();
    expect(onDataUpdate).toHaveBeenLastCalledWith(null);
  });

  it('exposes the live event fetcher through the segments entry point', () => {
    expect(fetchLiveEvent).toBeTypeOf('function');
  });
});
