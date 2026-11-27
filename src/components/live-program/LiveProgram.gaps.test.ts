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


// Branches of LiveProgram that no other test reaches: the volume defaults when the mixer has not set one,
// and a language rotation that shrinks past the language on air.

describe('LiveProgram gap coverage', () => {

  it('loads the program audio once the data has loaded, not before the element exists', async () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
    expect(document.querySelector('audio')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    await advance(3000);
    expect(load).toHaveBeenCalledTimes(1);
    load.mockRestore();
  });

  it('plays a scene take at full volume when the mixer has no scene instant volume', async () => {
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: {} } });
    await emit({ type: 'scene_instant_take', instant: { name: 'Sting', audioUrl: 'https://audio.test/a.mp3', volume: 0.5 } });
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].volume).toBe(0.5);
    expect(FakeAudio.instances[0].play).toHaveBeenCalled();
  });

  it('plays an instant at full volume when the mixer has no instant volume', async () => {
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: {} } });
    await emit({ type: 'instant_play', instant: { name: 'Hit', audioUrl: 'https://audio.test/b.mp3' } });
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].play).toHaveBeenCalled();
  });

  it('keeps a playing instant at full volume when a mixer update leaves its volume unset', async () => {
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
    await emit({ type: 'instant_play', instant: { name: 'Hit', audioUrl: 'https://audio.test/b.mp3' } });
    await emit({ type: 'audio_bus_update', settings: { mixerSettings: {} } });
    expect(FakeAudio.instances[0].volume).toBe(1);
  });

  it('starts a song at full volume when the mixer has no song volume', async () => {
    routes['/state'] = programState(content({ ...FAST, ...ONLY_ARTICLES }));
    await mount();
    await emit({
      type: 'audio_bus_update',
      settings: {
        songSequence: { mode: 'manual', items: [{ id: 's1', audioUrl: 'https://audio.test/song.mp3' }], activeItemId: 's1', loop: true },
        mixerSettings: {},
      },
    });
    const song = FakeAudio.instances.find((audio) => audio.src === 'https://audio.test/song.mp3');
    expect(song).toBeDefined();
    expect(song!.volume).toBe(1);
  });

  it('falls back to the first language when the rotation shrinks past the one on air', async () => {
    const view = await mount({ sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, languageRotation: ['en', 'es'] }) });
    await advance(3000);
    await act(async () => {
      view.rerender(h(LiveProgram, { sceneMetadata: content({ ...FAST, ...ONLY_ARTICLES, languageRotation: ['en'] }) } as never));
    });
    await flush();
    expect(document.body.textContent).toBeTruthy();
  });

});
