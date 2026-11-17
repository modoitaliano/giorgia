// @vitest-environment happy-dom
// The program-wide broadcast time override in LiveProgram (modoitaliano/giorgia#49): read from
// the latest broadcast_settings_update, else the state's optional broadcastSettings, else none.
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

const START = new Date('2026-11-17T10:00:00.000Z');
const override = (startTime: string, timeOverrideEnabled = true) => ({
  timeOverrideEnabled,
  timeOverrideStartTime: startTime,
  timeOverrideStartedAt: START.toISOString(),
});
const cornerTime = (container: HTMLElement) =>
  (container.querySelector('.absolute.top-16.right-24 .pt-1\\.5') as HTMLElement | null)?.textContent ?? '';
const withSettings = (broadcastSettings: unknown) => ({ ...programState('modoitaliano', { 'modoitaliano-content': ONLY_ARTICLES }), broadcastSettings });

describe('LiveProgram broadcast time override', () => {
  beforeEach(() => {
    vi.setSystemTime(START);
  });

  it('shows the override from the state a page loads with', async () => {
    routes['/state'] = withSettings(override('07:30'));
    const { container } = await mount();
    expect(cornerTime(container)).toContain('07:30');
  });

  it('follows the latest broadcast_settings_update, over the state, and back to real time when it turns off', async () => {
    routes['/state'] = withSettings(override('07:30'));
    const { container } = await mount();
    await emit({ type: 'broadcast_settings_update', settings: override('21:15') });
    expect(cornerTime(container)).toContain('21:15');
    await emit({ type: 'broadcast_settings_update', settings: override('21:15', false) });
    expect(cornerTime(container)).not.toMatch(/21:15|07:30/);
    expect(cornerTime(container)).toMatch(/\d\d:\d\d/);
    await emit({ type: 'broadcast_settings_update' });
    expect(cornerTime(container)).not.toMatch(/21:15|07:30/);
  });

  it('shows the real time when nothing carries an override', async () => {
    const { container } = await mount();
    expect(cornerTime(container)).toMatch(/\d\d:\d\d/);
    expect(cornerTime(container)).not.toContain('07:30');
  });
});
