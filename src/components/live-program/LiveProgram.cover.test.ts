// @vitest-environment happy-dom
// The Giorgia clock's cover box (giorgia#53, pinned contract for gaulatti/alcantara#178
// as amended by #179): the playing track's coverUrl or the sequence song's cover when
// there is one, else a CSS placeholder, and the placeholder when the image fails to
// load. No request ever goes to a path the bundle does not contain.
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveProgram from './LiveProgram.js';
import { clearCachedEvents } from './events.js';
import { readPlayingTrack } from './utils/playingTrack.js';

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
const programState = (componentType: string, metadata: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id: 1,
  activeSceneId: 1,
  activeScene: scene(componentType, metadata),
  updatedAt: '2026-11-16T00:00:00Z',
  ...extra,
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T10:00:00.000Z'));
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


const CLOCK = 'modoitaliano-giorgia-clock';
const CHYRON = 'modoitaliano-giorgia-chyron';
const ROW = `${CLOCK},${CHYRON}`;
const ROW_METADATA = { [CHYRON]: { textSequence: { mode: 'manual', items: [{ id: 'harbor', text: 'Harbor Light' }] } } };
const track = (title: string | null, artist: string | null, playbackId = 'harbor-playback-1') => ({ playbackId, title, artist, startedAt: '2026-11-17T09:58:00.000Z' });
const sequence = {
  mode: 'manual',
  items: [{ id: 'harbor-song', kind: 'preset', artist: 'Sequence Artist', title: 'Sequence Title' }],
  activeItemId: 'harbor-song',
  intervalMs: 4000,
  loop: true,
  startedAt: 0,
};
const audioBus = { type: 'audio_bus_update', programId: 'harbor-light', settings: { songSequence: sequence } };
const onAir = (container: HTMLElement) => container.querySelector('.modoitaliano-giorgia-clock-on-air') as HTMLElement | null;
const settle = () =>
  act(async () => {
    vi.advanceTimersToNextFrame();
    await vi.advanceTimersByTimeAsync(500);
  });

const cover = (container: HTMLElement) => onAir(container)?.querySelector('img') ?? null;
const placeholder = (container: HTMLElement) => onAir(container)?.querySelector('[data-giorgia-cover-placeholder]') ?? null;
const COVER = 'https://covers.example.test/harbor-light.jpg';

describe('readPlayingTrack coverUrl', () => {
  it('keeps a coverUrl string, leaves it out when absent, and treats any other value as malformed', () => {
    expect(readPlayingTrack({ playingTrack: { ...track('Harbor Light', 'Keepers'), coverUrl: COVER } })?.coverUrl).toBe(COVER);
    expect(readPlayingTrack({ playingTrack: track('Harbor Light', 'Keepers') })).not.toHaveProperty('coverUrl');
    for (const coverUrl of [null, 7, {}]) {
      expect(readPlayingTrack({ playingTrack: { ...track('Harbor Light', 'Keepers'), coverUrl } })).toBeNull();
    }
  });
});

describe('LiveProgram Giorgia clock cover box', () => {
  it('draws the placeholder, and requests no image, for a playing track without a coverUrl', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') });
    const { container } = await mount();
    await settle();
    expect(onAir(container)?.textContent).toContain('THE LIGHTHOUSE KEEPERS');
    expect(placeholder(container)).not.toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('cover.jpg');
  });

  it("draws the playing track's coverUrl", async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: { ...track('Harbor Light', 'The Lighthouse Keepers'), coverUrl: COVER } });
    const { container } = await mount();
    await settle();
    expect(cover(container)?.getAttribute('src')).toBe(COVER);
    expect(placeholder(container)).toBeNull();
  });

  it('switches to the placeholder when the cover fails to load, and back for a new cover', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: { ...track('Harbor Light', 'The Lighthouse Keepers'), coverUrl: COVER } });
    const { container } = await mount();
    await settle();
    await act(async () => {
      cover(container)!.dispatchEvent(new Event('error'));
    });
    expect(cover(container)).toBeNull();
    expect(placeholder(container)).not.toBeNull();
    const next = 'https://covers.example.test/low-tide.jpg';
    await emit({ type: 'playing_track_update', programId: 'harbor-light', playingTrack: { ...track('Low Tide', 'Pier Choir', 'harbor-playback-2'), coverUrl: next }, updatedAt: '2026-11-17T10:05:00.000Z' });
    await settle();
    expect(cover(container)?.getAttribute('src')).toBe(next);
    expect(placeholder(container)).toBeNull();
  });

  it('draws the placeholder for a sequence song without a cover', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA);
    const { container } = await mount();
    await emit(audioBus);
    await settle();
    expect(onAir(container)?.textContent).toContain('SEQUENCE ARTIST');
    expect(placeholder(container)).not.toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it("draws a sequence song's own cover", async () => {
    routes['/state'] = programState(CLOCK, {});
    const { container } = await mount();
    await emit({ ...audioBus, settings: { songSequence: { ...sequence, items: [{ ...sequence.items[0], coverUrl: COVER }] } } });
    await settle();
    expect(cover(container)?.getAttribute('src')).toBe(COVER);
  });

  it('keeps the placeholder solid and shadowless when key-safe', async () => {
    routes['/state'] = programState(ROW, { ...ROW_METADATA, [CLOCK]: { keySafe: true } }, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') });
    const { container } = await mount();
    await settle();
    const box = placeholder(container) as HTMLElement;
    expect(box.style.background).not.toContain('gradient');
    expect(box.outerHTML).not.toContain('shadow');
  });
});
