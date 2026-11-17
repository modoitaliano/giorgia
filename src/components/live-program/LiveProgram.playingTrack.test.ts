// @vitest-environment happy-dom
// The Giorgia clock's on-air block reads the v2 state's playingTrack (giorgia#51,
// pinned contract for gaulatti/alcantara#178): the track while the latest state
// carries one, else the song sequence as before, on the fictional harbor-light program.
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
  items: [{ id: 'harbor-song', kind: 'preset', artist: 'Sequence Artist', title: 'Sequence Title', coverUrl: '/harbor-light/sequence.jpg' }],
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

describe('readPlayingTrack', () => {
  it('reads the contract shape, keeping a null title or artist', () => {
    expect(readPlayingTrack({ playingTrack: track('Harbor Light', 'The Lighthouse Keepers') })).toEqual(track('Harbor Light', 'The Lighthouse Keepers'));
    expect(readPlayingTrack({ playingTrack: track(null, null) })).toEqual(track(null, null));
  });

  it('treats an absent or malformed track as none', () => {
    for (const state of [null, undefined, 'state', {}, { playingTrack: null }, { playingTrack: [] }, { playingTrack: 'x' }]) {
      expect(readPlayingTrack(state)).toBeNull();
    }
    const { playbackId: _id, ...noId } = track('A', 'B');
    const { startedAt: _at, ...noStart } = track('A', 'B');
    const { title: _title, ...noTitle } = track('A', 'B');
    for (const playingTrack of [noId, noStart, noTitle, { ...track('A', 'B'), artist: 7 }, { ...track('A', 'B'), playbackId: 1 }]) {
      expect(readPlayingTrack({ playingTrack })).toBeNull();
    }
  });
});

describe('LiveProgram Giorgia clock and the playing track', () => {
  it('shows the playing track from the /state snapshot instead of the song sequence', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') });
    const { container } = await mount();
    await emit(audioBus);
    await settle();
    expect(onAir(container)?.textContent).toContain('THE LIGHTHOUSE KEEPERS');
    expect(onAir(container)?.textContent).toContain('HARBOR LIGHT');
    expect(onAir(container)?.textContent).not.toContain('SEQUENCE');
    // The track carries no cover, so the sequence's cover is not borrowed.
    expect(onAir(container)?.querySelector('img')?.getAttribute('src')).not.toBe('/harbor-light/sequence.jpg');
  });

  it('shows the song sequence, as before, when the state has no playing track', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA);
    const { container } = await mount();
    await emit(audioBus);
    await settle();
    expect(onAir(container)?.textContent).toContain('SEQUENCE ARTIST');
    expect(onAir(container)?.querySelector('img')?.getAttribute('src')).toBe('/harbor-light/sequence.jpg');
  });

  it('shows the playing track on a standalone Giorgia clock too', async () => {
    routes['/state'] = programState(CLOCK, {}, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') });
    const { container } = await mount();
    await settle();
    expect(onAir(container)?.textContent).toContain('THE LIGHTHOUSE KEEPERS');
  });

  it('leads with the title when the artist is null, and never borrows the sequence artist', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track('Harbor Light', null) });
    const { container } = await mount();
    await emit(audioBus);
    await settle();
    const hero = container.querySelector('.modoitaliano-giorgia-clock-hero');
    expect(hero?.textContent).toBe('HARBOR LIGHT');
    expect(onAir(container)?.textContent).not.toContain('SEQUENCE');
  });

  it('shows the artist alone when the title is null', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track(null, 'The Lighthouse Keepers') });
    const { container } = await mount();
    await settle();
    expect(container.querySelector('.modoitaliano-giorgia-clock-hero')?.textContent).toBe('THE LIGHTHOUSE KEEPERS');
    expect(onAir(container)?.textContent).not.toContain('SEQUENCE');
  });

  it('shows no on-air block, rather than the sequence, for a playing track with neither title nor artist', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track(null, null) });
    const { container } = await mount();
    await emit(audioBus);
    await settle();
    expect(onAir(container)).toBeNull();
  });

  it.each(['program_state_snapshot', 'scene_change', 'program_scenes_changed', 'program_media_groups_changed', 'program_stingers_changed'])(
    'takes the playing track from %s, and clears it when a later state omits it',
    async (type) => {
      routes['/state'] = programState(ROW, ROW_METADATA);
      const { container } = await mount();
      await emit(audioBus);
      await emit({ type, programId: 'harbor-light', state: programState(ROW, ROW_METADATA, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') }) });
      await settle();
      expect(onAir(container)?.textContent).toContain('THE LIGHTHOUSE KEEPERS');
      await emit({ type, programId: 'harbor-light', state: programState(ROW, ROW_METADATA) });
      await settle();
      expect(onAir(container)?.textContent).toContain('SEQUENCE ARTIST');
      expect(onAir(container)?.textContent).not.toContain('LIGHTHOUSE');
    }
  );

  it('clears the track for an empty on-air block when a later state omits it and there is no sequence', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') });
    const { container } = await mount();
    await settle();
    expect(onAir(container)).not.toBeNull();
    await emit({ type: 'program_state_snapshot', programId: 'harbor-light', state: programState(ROW, ROW_METADATA) });
    await settle();
    expect(onAir(container)).toBeNull();
  });

  it('follows a newer playing track and ignores signals that carry no state', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') });
    const { container } = await mount();
    await emit({ type: 'scene_change', programId: 'harbor-light', state: programState(ROW, ROW_METADATA, { playingTrack: track('Low Tide', 'Pier Choir', 'harbor-playback-2') }) });
    await emit({ type: 'program_stingers_changed', programId: 'harbor-light' });
    await emit({ type: 'scene_update', programId: 'harbor-light', scene: scene(ROW, ROW_METADATA) });
    await settle();
    expect(onAir(container)?.textContent).toContain('PIER CHOIR');
    expect(onAir(container)?.textContent).toContain('LOW TIDE');
  });

  // giorgia#52: the change signal alcantara#178 delivers once the manifest lists it.
  it('sets the playing track from playing_track_update, between state-bearing signals', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA);
    const { container } = await mount();
    await emit(audioBus);
    await emit({ type: 'playing_track_update', programId: 'harbor-light', playingTrack: track('Harbor Light', 'The Lighthouse Keepers'), updatedAt: '2026-11-17T09:58:00.500Z' });
    await settle();
    expect(onAir(container)?.textContent).toContain('THE LIGHTHOUSE KEEPERS');
    expect(onAir(container)?.textContent).not.toContain('SEQUENCE');
  });

  it('clears the playing track on a playing_track_update without one, back to the sequence', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA, { playingTrack: track('Harbor Light', 'The Lighthouse Keepers') });
    const { container } = await mount();
    await emit(audioBus);
    await settle();
    expect(onAir(container)?.textContent).toContain('THE LIGHTHOUSE KEEPERS');
    await emit({ type: 'playing_track_update', programId: 'harbor-light', updatedAt: '2026-11-17T10:02:00.000Z' });
    await settle();
    expect(onAir(container)?.textContent).toContain('SEQUENCE ARTIST');
    expect(onAir(container)?.textContent).not.toContain('LIGHTHOUSE');
  });

  it('lets a later state-bearing signal override a playing_track_update, and the reverse', async () => {
    routes['/state'] = programState(ROW, ROW_METADATA);
    const { container } = await mount();
    await emit({ type: 'playing_track_update', programId: 'harbor-light', playingTrack: track('Harbor Light', 'The Lighthouse Keepers'), updatedAt: '2026-11-17T09:58:00.500Z' });
    await emit({ type: 'scene_change', programId: 'harbor-light', state: programState(ROW, ROW_METADATA, { playingTrack: track('Low Tide', 'Pier Choir', 'harbor-playback-2') }) });
    await settle();
    expect(onAir(container)?.textContent).toContain('PIER CHOIR');
    await emit({ type: 'playing_track_update', programId: 'harbor-light', playingTrack: track('Night Ferry', 'Dock Band', 'harbor-playback-3'), updatedAt: '2026-11-17T10:05:00.000Z' });
    await settle();
    expect(onAir(container)?.textContent).toContain('DOCK BAND');
  });
});
