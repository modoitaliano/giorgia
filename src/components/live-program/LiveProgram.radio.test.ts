// @vitest-environment happy-dom
// Radio scenes in LiveProgram: an Alcantara scene whose layout names a podcast
// player or the Earone chart box draws that component. The existing
// LiveProgram tests (LiveProgram.test.ts) cover every other scene unchanged.
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

describe('LiveProgram radio scenes', () => {
  it('draws the Modo Italiano podcast player from the scene metadata, not from song signals', async () => {
    routes['/state'] = programState('modoitaliano-podcast-player', { 'modoitaliano-podcast-player': podcastScene });
    const { container } = await mount();
    expect(container.textContent).toContain('Harbor Light, episode 12');
    expect(container.textContent).toContain('Harbor Light Radio');
    expect(container.querySelector('img[alt="Episode cover"]')?.getAttribute('src')).toBe('/harbor-light/cover.jpg');
    const audio = Array.from(container.querySelectorAll('audio')).find((node) => node.getAttribute('src'));
    expect(audio?.getAttribute('src')).toBe('/harbor-light/episode-12.mp3');
    // The scene lists only the player, so the news layer is not drawn underneath it.
    expect(container.textContent).not.toContain('Headline A');

    await emit(songPlaybackActive);
    expect(container.textContent).toContain('Harbor Light, episode 12');
    expect(container.textContent).not.toContain('The Lighthouse Keepers');
  });

  it('draws the Giorgia podcast player with the scene metadata and its gain', async () => {
    routes['/state'] = programState('modoitaliano-giorgia-podcast-player', {
      'modoitaliano-giorgia-podcast-player': { ...podcastScene, masterGain: 0.25 },
    });
    const { container } = await mount();
    const player = container.querySelector('[aria-label="Modo Italiano Giorgia podcast player"]') as HTMLElement;
    expect(player).toBeTruthy();
    expect(player.querySelector('h1')?.textContent).toBe('Harbor Light, episode 12');
    expect(player.querySelector('audio')?.getAttribute('src')).toBe('/harbor-light/episode-12.mp3');
    expect(player.querySelector('audio')?.volume).toBe(0.25);
  });

  it('draws the Earone box from song_playback_active and clears it when the song goes off air', async () => {
    routes['/state'] = programState('earone,modoitaliano-content', {
      earone: { label: 'HARBOR CHART' },
      'modoitaliano-content': ONLY_ARTICLES,
    });
    const { container } = await mount();
    expect(container.querySelector('.earone-box')).toBeNull();
    // The scene also lists the content layer, so the news keeps playing under the box.
    expect(container.textContent).toContain('Headline A');

    await emit(songPlaybackActive);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(metricValues(container)).toEqual(['#3', '1,520']);
    expect(container.querySelector('.earone-box img')?.getAttribute('alt')).toBe('HARBOR CHART');

    await emit({ type: 'song_off_air' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(container.querySelector('.earone-box')).toBeNull();
  });

  it('follows the scene renderer component list when embedded', async () => {
    const { container } = await mount({
      embedded: true,
      sceneMetadata: { 'modoitaliano-podcast-player': podcastScene },
      activeComponents: ['modoitaliano-podcast-player'],
    });
    expect(container.textContent).toContain('Harbor Light, episode 12');
  });

  it('draws no radio component for any other scene', async () => {
    routes['/state'] = programState('modoitaliano', {
      'modoitaliano-content': ONLY_ARTICLES,
      'modoitaliano-podcast-player': podcastScene,
      earone: { label: 'HARBOR CHART' },
    });
    const { container } = await mount();
    await emit(songPlaybackActive);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(container.textContent).toContain('Headline A');
    expect(container.textContent).not.toContain('Harbor Light, episode 12');
    expect(container.querySelector('.earone-box')).toBeNull();
  });
});
