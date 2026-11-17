// @vitest-environment happy-dom
// TV graphics scenes in LiveProgram (giorgia#47): an Alcantara scene whose layout
// names reloj-loop-clock or a Crónica type draws that component, after the radio
// layers and in list order, inside one full-frame box with no z-index.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveProgram from './LiveProgram.js';
import { clearCachedEvents } from './events.js';

const sse = vi.hoisted(() => ({ options: null as null | { onMessage: (data: unknown) => void } }));
vi.mock('./hooks/useSSE.js', () => ({
  useSSE: (options: NonNullable<typeof sse.options>) => {
    sse.options = options;
    return { isConnected: false, error: null };
  },
}));
vi.mock('fast-average-color', () => ({
  FastAverageColor: class {
    getColor = () => ({ hex: '#336699' });
  },
}));

let routes: Record<string, unknown>;

const scene = (componentType: string, metadata: Record<string, unknown>) => ({
  id: 1,
  name: 'Harbor Light',
  layoutId: 1,
  layout: { id: 1, name: 'L', componentType, settings: '{}' },
  chyronText: null,
  metadata: JSON.stringify(metadata),
});
const programState = (componentType: string, metadata: Record<string, unknown> = {}) => ({
  id: 1,
  activeSceneId: 1,
  activeScene: scene(componentType, metadata),
  updatedAt: '2026-11-16T00:00:00Z',
});

const ONLY_ARTICLES = {
  playlistDefaultDurationMs: 1000,
  articlesDurationMs: 1000,
  showLiveEvents: false,
  showWeather: false,
  showEarthquakes: false,
  showMarkets: false,
  showWorldClocks: false,
};
const podcastScene = {
  show: true,
  episodeTitle: 'Harbor Light, episode 12',
  showName: 'Harbor Light Radio',
  coverUrl: '/harbor-light/cover.jpg',
  audioUrl: '/harbor-light/episode-12.mp3',
};
const songPlaybackActive = {
  type: 'song_playback_active',
  programId: 'harbor-light-radio',
  songId: 'harbor-light-radio-song-1',
  title: 'Harbor Light',
  artist: 'The Lighthouse Keepers',
  coverUrl: '/harbor-light/song.jpg',
  externalChartProvider: 'earone',
  externalChartRank: '3',
  externalChartSpins: '1520',
};

beforeEach(() => {
  vi.useFakeTimers();
  clearCachedEvents();
  sse.options = null;
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  routes = {
    '/state': programState('modoitaliano', { 'modoitaliano-content': ONLY_ARTICLES }),
    'homepage-current-es.json': { articles: [{ id: 1, title: 'Headline A', excerpt: 'x', slug: 's', featured: false, featuredImage: { url: '/a.jpg' }, categories: [], publishedAt: new Date().toISOString() }] },
    '/broadcast/weather': [],
    '/earthquakes': [],
    '/broadcast/markets': [],
    '/events': { events: [] },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input);
      const key = Object.keys(routes).find((candidate) => url.includes(candidate));
      if (!key) throw new Error(`unrouted ${url}`);
      return { ok: true, status: 200, statusText: 'OK', json: async () => routes[key] };
    })
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
async function mount(props: Record<string, unknown> = {}) {
  const view = render(h(LiveProgram, props as never));
  await flush();
  return view;
}
const emit = (data: unknown) =>
  act(() => {
    sse.options!.onMessage(data);
  });
const metricValues = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.earone-metric-value')).map((node) => node.textContent);

const TV_SELECTORS: Record<string, string> = {
  'reloj-loop-clock': '.reloj-loop-root',
  'cronica-background': '.cronica-background',
  'cronica-chyron': '.cronica-chyron',
  'cronica-reiteramos': '.cronica-reiteramos',
};
const TV_METADATA = {
  'reloj-loop-clock': { timezone: 'Europe/Rome' },
  'cronica-chyron': { text: 'HARBOR LIGHT\nNIGHT SHIFT' },
  'cronica-reiteramos': { text: 'REITERAMOS', show: true },
};
const TV_TYPES = Object.keys(TV_SELECTORS);
const stage = (container: HTMLElement) => container.querySelector('.relative.bg-black.text-white.overflow-hidden') as HTMLElement;
const tvBox = (container: HTMLElement) => Array.from(stage(container).children).find((node) => node.matches('.absolute.inset-0') && !node.matches('.bg-black')) as HTMLElement | undefined;
const corner = (container: HTMLElement) => ({
  clocks: container.querySelector('.absolute.top-16.right-24 .pt-1\\.5') !== null,
  bell: container.querySelector('.absolute.top-16.right-24 .bg-\\[\\#b21100\\] svg') !== null,
});

describe('LiveProgram TV graphics scenes', () => {
  it.each(TV_TYPES)('draws the %s component when the scene lists it', async (componentType) => {
    routes['/state'] = programState(componentType, TV_METADATA);
    const { container } = await mount();
    const box = tvBox(container);
    expect(box).toBeDefined();
    expect(box?.querySelector(TV_SELECTORS[componentType])).toBeInstanceOf(HTMLElement);
  });

  it.each(TV_TYPES)('does not draw the %s component when the scene does not list it', async (componentType) => {
    const others = TV_TYPES.filter((type) => type !== componentType);
    routes['/state'] = programState(others.join(','), TV_METADATA);
    const { container } = await mount();
    expect(container.querySelector(TV_SELECTORS[componentType])).toBeNull();
    expect(tvBox(container)?.children).toHaveLength(others.length);
  });

  it('draws no TV component and no TV box on a news scene, which keeps its layers and corner', async () => {
    routes['/state'] = programState('modoitaliano', { 'modoitaliano-content': ONLY_ARTICLES, ...TV_METADATA });
    const { container } = await mount();
    expect(container.textContent).toContain('Headline A');
    expect(corner(container)).toEqual({ clocks: true, bell: true });
    expect(tvBox(container)).toBeUndefined();
    for (const selector of Object.values(TV_SELECTORS)) expect(container.querySelector(selector)).toBeNull();
  });

  it('draws the TV layers after the radio layers, in list order, in one box with no z-index', async () => {
    routes['/state'] = programState('cronica-background,earone,cronica-reiteramos,cronica-chyron', TV_METADATA);
    const { container } = await mount();
    await emit(songPlaybackActive);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    const children = Array.from(stage(container).children);
    const box = tvBox(container)!;
    expect(children[children.length - 1]).toBe(box);
    expect(children.indexOf(container.querySelector('.earone-box') as HTMLElement)).toBeLessThan(children.indexOf(box));
    expect(box.getAttribute('style')).toBeNull();
    expect(box.className).toBe('absolute inset-0');
    expect(Array.from(box.children).map((node) => node.querySelector('.cronica-reiteramos, .cronica-chyron')?.className ?? node.className)).toEqual([
      'cronica-background',
      'cronica-reiteramos',
      'cronica-chyron',
    ]);
  });

  it('shows no news, marquee, world clocks or bell on a TV scene that does not list them', async () => {
    routes['/state'] = programState('reloj-loop-clock', { ...TV_METADATA, 'modoitaliano-content': ONLY_ARTICLES, 'modoitaliano-marquee': { showMarquee: true } });
    const { container } = await mount();
    expect(container.textContent).not.toContain('Headline A');
    expect(corner(container)).toEqual({ clocks: false, bell: false });
    expect(container.querySelector('.reloj-loop-root')).not.toBeNull();
  });

  it('draws the news layer under a TV graphic when the scene lists both', async () => {
    routes['/state'] = programState('modoitaliano-content,cronica-reiteramos', { 'modoitaliano-content': ONLY_ARTICLES });
    const { container } = await mount();
    expect(container.textContent).toContain('Headline A');
    expect(container.textContent).toContain('REITERAMOS');
  });

  // Changes one case of #46: reloj-loop-clock is not a corner clock type, so this scene draws that clock and no corner.
  it('draws RelojLoopClock and no world clocks or bell on a radio scene that lists reloj-loop-clock', async () => {
    routes['/state'] = programState('modoitaliano-podcast-player,reloj-loop-clock', { 'modoitaliano-podcast-player': podcastScene });
    const { container } = await mount();
    expect(container.textContent).toContain('Harbor Light, episode 12');
    expect(tvBox(container)?.querySelector('.reloj-loop-root')).toBeInstanceOf(HTMLElement);
    expect(corner(container)).toEqual({ clocks: false, bell: false });
  });

  it.each([
    ['the scene timezone', { timezone: 'Europe/Rome' }, 'SANREMO'],
    ["Alcantara's Europe/Madrid default when none is set", {}, 'MADRID'],
    ["Alcantara's Europe/Madrid default when the timezone is not text", { timezone: 7 }, 'MADRID'],
  ])('draws reloj-loop-clock on %s', async (_name, props, label) => {
    routes['/state'] = programState('reloj-loop-clock', { 'reloj-loop-clock': props });
    const { container } = await mount();
    expect(container.querySelector('.reloj-loop-root')?.textContent).toContain(label);
  });

  it('draws the Crónica chyron lines and REITERAMOS text from the scene metadata', async () => {
    routes['/state'] = programState('cronica-chyron,cronica-reiteramos', {
      'cronica-chyron': { text: 'HARBOR LIGHT\nNIGHT SHIFT' },
      'cronica-reiteramos': { text: 'ULTIMO MOMENTO' },
    });
    const { container } = await mount();
    expect(Array.from(container.querySelectorAll('.cronica-chyron-line')).map((node) => node.textContent)).toEqual(['HARBOR LIGHT', 'NIGHT SHIFT']);
    expect(container.querySelector('.cronica-reiteramos')?.textContent).toBe('ULTIMO MOMENTO');
  });

  it.each([
    ['hides REITERAMOS when show is false', { show: false }, null],
    ['keeps the component defaults for values that are not text or boolean', { text: 5, show: 'no' }, 'REITERAMOS'],
  ])('%s', async (_name, props, text) => {
    routes['/state'] = programState('cronica-reiteramos,cronica-chyron', { 'cronica-reiteramos': props, 'cronica-chyron': { text: 9 } });
    const { container } = await mount();
    expect(container.querySelector('.cronica-reiteramos')?.textContent ?? null).toBe(text);
    expect(container.querySelector('.cronica-chyron')).toBeNull();
  });

  it('follows the scene renderer component list when embedded', async () => {
    const { container } = await mount({ embedded: true, sceneMetadata: {}, activeComponents: ['cronica-background'] });
    expect(container.querySelector('.cronica-background')).not.toBeNull();
  });

  it('wires the TV layers without a network call', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/live-program/tv/TvSceneLayers.tsx'), 'utf8');
    expect(source).not.toMatch(new RegExp(['fetch\\(', 'XMLHttp' + 'Request', 'Event' + 'Source', 'https?:' + '//'].join('|')));
  });
});

// giorgia#48: logo-widget draws Alcantara's LogoWidget with the scene's logoUrl and position
// (program.tsx:2294-2295 at b0e8f009), and nothing without a logoUrl.
describe('LiveProgram logo-widget scene', () => {
  it('draws the scene logo when the scene lists logo-widget with a logoUrl', async () => {
    routes['/state'] = programState('logo-widget', { 'logo-widget': { logoUrl: '/harbor-light/logo.png', position: 'top-right' } });
    const { container } = await mount();
    const logo = tvBox(container)?.querySelector('.logo-widget');
    expect(logo?.className).toContain('top-right');
    expect(logo?.querySelector('img')?.getAttribute('src')).toBe('/harbor-light/logo.png');
    expect(container.textContent).not.toContain('Headline A');
    expect(corner(container)).toEqual({ clocks: false, bell: false });
  });

  it('draws nothing for logo-widget when the scene sets no logoUrl', async () => {
    routes['/state'] = programState('logo-widget', { 'logo-widget': { logoUrl: 7, position: 'top-right' } });
    const { container } = await mount();
    expect(tvBox(container)).toBeDefined();
    expect(container.querySelector('.logo-widget')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it("keeps LogoWidget's bottom-right default for a position it does not know", async () => {
    routes['/state'] = programState('logo-widget', { 'logo-widget': { logoUrl: '/harbor-light/logo.png', position: 'center' } });
    const { container } = await mount();
    expect(container.querySelector('.logo-widget')?.className).toContain('bottom-right');
  });

  it('does not draw logo-widget when the scene does not list it', async () => {
    routes['/state'] = programState('modoitaliano', { 'modoitaliano-content': ONLY_ARTICLES, 'logo-widget': { logoUrl: '/harbor-light/logo.png' } });
    const { container } = await mount();
    expect(container.textContent).toContain('Headline A');
    expect(container.querySelector('.logo-widget')).toBeNull();
  });
});

// Keeps branch coverage at the base ratio after #48 dropped the covered ModoRadio-bug branches.
describe('LiveProgram news scene next to the TV graphics', () => {
  it('still draws a news article that has no slug', async () => {
    routes['/state'] = programState('modoitaliano', { 'modoitaliano-content': ONLY_ARTICLES });
    routes['homepage-current-es.json'] = { articles: [{ id: 2, title: 'Headline B', excerpt: 'x', featured: false, featuredImage: { url: '/b.jpg' }, categories: [], publishedAt: new Date().toISOString() }] };
    const { container } = await mount();
    expect(container.textContent).toContain('Headline B');
  });
});
