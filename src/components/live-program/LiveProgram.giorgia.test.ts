// @vitest-environment happy-dom
// The Giorgia clock and chyron scene types in LiveProgram (giorgia#50), drawn as
// Alcantara draws them (gaulatti/alcantara b4a51c7 frontend/app/routes/program.tsx
// :2206, :2460-2491, :2623): each by itself, or both in the bottom row when the
// scene lists both, on the fictional harbor-light program.
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveProgram from './LiveProgram.js';
import { clearCachedEvents } from './events.js';
import { resolveGiorgiaProgramRow, toBoolean } from './tv/giorgiaProgramRow.js';

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
const headline = (text: string) => ({ textSequence: { mode: 'manual', items: [{ id: 'harbor', text }] } });
const songSequence = (artist: string, title: string) => ({
  mode: 'manual',
  items: [{ id: 'harbor-song', kind: 'preset', artist, title, coverUrl: '/harbor-light/song.jpg' }],
  activeItemId: 'harbor-song',
  intervalMs: 4000,
  loop: true,
  startedAt: 0,
});
const stage = (container: HTMLElement) => container.querySelector('.relative.bg-black.text-white.overflow-hidden') as HTMLElement;
const tvBox = (container: HTMLElement) => Array.from(stage(container).children).find((node) => node.matches('.absolute.inset-0') && !node.matches('.bg-black')) as HTMLElement | undefined;
const corner = (container: HTMLElement) => ({
  clocks: container.querySelector('.absolute.top-16.right-24 .pt-1\\.5') !== null,
  bell: container.querySelector('.absolute.top-16.right-24 .bg-\\[\\#b21100\\] svg') !== null,
});
const header = (container: HTMLElement) => container.querySelector('.modoitaliano-giorgia-clock-header') as HTMLElement | null;
const row = (container: HTMLElement) => container.querySelector('[data-program-row="giorgia"]') as HTMLElement | null;
const nextFrame = () =>
  act(async () => {
    vi.advanceTimersToNextFrame();
    await vi.advanceTimersByTimeAsync(0);
  });

describe('Giorgia row pairing rule', () => {
  it('owns both Giorgia types only when the scene lists both', () => {
    expect(resolveGiorgiaProgramRow([CLOCK, CHYRON])?.ownedTypes).toEqual(new Set([CLOCK, CHYRON]));
    expect(resolveGiorgiaProgramRow(['cronica-background', CHYRON, 'earone', CLOCK])?.ownedTypes).toEqual(new Set([CLOCK, CHYRON]));
    expect(resolveGiorgiaProgramRow([CLOCK])).toBeNull();
    expect(resolveGiorgiaProgramRow([CHYRON])).toBeNull();
    // The legacy family never pairs with Giorgia, and its own row is not drawn here.
    expect(resolveGiorgiaProgramRow([CLOCK, 'modoitaliano-chyron'])).toBeNull();
    expect(resolveGiorgiaProgramRow(['modoitaliano-clock', CHYRON])).toBeNull();
    expect(resolveGiorgiaProgramRow(['modoitaliano-clock', 'modoitaliano-chyron'])).toBeNull();
  });

  it("reads booleans the way Alcantara's toBoolean does", () => {
    for (const value of [true, 1, -2, 'true', ' YES ', 'on', '1']) expect(toBoolean(value, false)).toBe(true);
    for (const value of [false, 0, 'false', 'no', 'OFF', '0', '', '  ']) expect(toBoolean(value, true)).toBe(false);
    for (const value of [undefined, null, 'maybe', {}, []]) {
      expect(toBoolean(value, true)).toBe(true);
      expect(toBoolean(value, false)).toBe(false);
    }
  });
});

describe('LiveProgram Giorgia clock and chyron scenes', () => {
  it('draws the Giorgia clock by itself, with no row and no corner clocks', async () => {
    routes['/state'] = programState(CLOCK, {});
    const { container } = await mount();
    const box = tvBox(container)!;
    expect(box.className).toBe('absolute inset-0');
    expect(header(box)).not.toBeNull();
    expect(header(box)!.textContent).toMatch(/\d\d:\d\d IT/);
    expect(row(container)).toBeNull();
    expect(container.querySelector('.modoitaliano-giorgia-chyron')).toBeNull();
    expect(corner(container)).toEqual({ clocks: false, bell: false });
    expect(container.textContent).not.toContain('Headline A');
  });

  it('draws the Giorgia chyron by itself from the scene text, with no row', async () => {
    routes['/state'] = programState(CHYRON, { [CHYRON]: headline('Harbor Light opens tonight') });
    const { container } = await mount();
    const chyron = tvBox(container)!.querySelector('.modoitaliano-giorgia-chyron');
    expect(chyron?.textContent).toContain('HARBOR LIGHT OPENS TONIGHT');
    expect(row(container)).toBeNull();
    expect(header(container)).toBeNull();
    expect(corner(container)).toEqual({ clocks: false, bell: false });
  });

  it('reads the standalone chyron show only when it is a boolean, as Alcantara does', async () => {
    routes['/state'] = programState(CHYRON, { [CHYRON]: { ...headline('Harbor Light'), show: 'false' } });
    const shown = await mount();
    expect(shown.container.querySelector('.modoitaliano-giorgia-chyron')).not.toBeNull();
    cleanup();
    routes['/state'] = programState(CHYRON, { [CHYRON]: { ...headline('Harbor Light'), show: false } });
    const hidden = await mount();
    expect(hidden.container.querySelector('.modoitaliano-giorgia-chyron')).toBeNull();
  });

  it('pairs both in the bottom row: header top-left, chyron then on-air block between the safe edges', async () => {
    routes['/state'] = programState(`${CHYRON},${CLOCK}`, { [CHYRON]: headline('Harbor Light opens tonight') });
    const { container } = await mount();
    const box = tvBox(container)!;
    const bottom = row(container)!;
    expect(bottom.parentElement).toBe(box);
    expect(bottom.className).toBe('absolute z-[950] flex items-end gap-12');
    expect(bottom.style.left).toBe('82px');
    expect(bottom.style.right).toBe('82px');
    expect(bottom.style.bottom).toBe('70px');
    const slots = Array.from(bottom.children).map((node) => node.getAttribute('data-program-row-slot'));
    expect(slots).toEqual(['chyron', 'clock']);
    expect(bottom.querySelector('[data-program-row-slot="chyron"] .modoitaliano-giorgia-chyron')?.textContent).toContain('HARBOR LIGHT OPENS TONIGHT');
    // Each is drawn once: the row owns both types.
    expect(container.querySelectorAll('.modoitaliano-giorgia-chyron')).toHaveLength(1);
    expect(container.querySelectorAll('.modoitaliano-giorgia-clock-header')).toHaveLength(1);
    expect(header(container)!.parentElement).toBe(box);
    expect(corner(container)).toEqual({ clocks: false, bell: false });
  });

  it('draws the other TV types first, in list order, and the row after them', async () => {
    routes['/state'] = programState(`${CLOCK},cronica-background,${CHYRON},cronica-reiteramos`, { [CHYRON]: headline('Harbor Light') });
    const { container } = await mount();
    const children = Array.from(tvBox(container)!.children);
    expect(children.map((node) => node.querySelector('.cronica-reiteramos')?.className ?? node.getAttribute('data-program-row') ?? node.className)).toEqual([
      'cronica-background',
      'cronica-reiteramos',
      'modoitaliano-giorgia-clock-header',
      'giorgia',
    ]);
  });

  it('hides the paired chyron by its show setting read as Alcantara reads it, keeping the on-air slot', async () => {
    routes['/state'] = programState(`${CLOCK},${CHYRON}`, { [CHYRON]: { ...headline('Harbor Light'), show: 'off' } });
    const { container } = await mount();
    expect(container.querySelector('.modoitaliano-giorgia-chyron')).toBeNull();
    expect(row(container)!.querySelector('[data-program-row-slot="clock"]')).not.toBeNull();
  });

  it('keys the standalone clock and chyron from their own keySafe', async () => {
    routes['/state'] = programState(CLOCK, { [CLOCK]: { keySafe: 'yes' } });
    const clock = await mount();
    expect(header(clock.container)!.style.background).not.toBe('');
    cleanup();
    routes['/state'] = programState(CLOCK, { [CLOCK]: { keySafe: 'no' } });
    const softClock = await mount();
    expect(header(softClock.container)!.style.background).toBe('');
    cleanup();
    routes['/state'] = programState(CHYRON, { [CHYRON]: { ...headline('Harbor Light'), keySafe: 1 } });
    const chyron = await mount();
    expect(chyron.container.innerHTML).not.toContain('linear-gradient');
    cleanup();
    routes['/state'] = programState(CHYRON, { [CHYRON]: headline('Harbor Light') });
    const softChyron = await mount();
    expect(softChyron.container.innerHTML).toContain('linear-gradient');
  });

  it.each([
    [{ [CLOCK]: { keySafe: true } }, true],
    [{ [CHYRON]: { keySafe: 'on' } }, true],
    [{ [CLOCK]: { keySafe: 'off' }, [CHYRON]: { keySafe: 0 } }, false],
  ])('keys the whole row when either type sets keySafe (%j)', async (keySafeMetadata, keyed) => {
    const metadata: Record<string, Record<string, unknown>> = { [CHYRON]: headline('Harbor Light') };
    for (const [type, props] of Object.entries(keySafeMetadata)) metadata[type] = { ...metadata[type], ...props };
    routes['/state'] = programState(`${CLOCK},${CHYRON}`, metadata);
    const { container } = await mount();
    expect(header(container)!.style.background !== '').toBe(keyed);
    expect(container.innerHTML.includes('linear-gradient')).toBe(!keyed);
  });

  it("reads the clock's world clock and logo settings as Alcantara does", async () => {
    routes['/state'] = programState(CLOCK, { [CLOCK]: { showWorldClocks: 'off' } });
    const noTime = await mount();
    expect(header(noTime.container)!.textContent).not.toMatch(/\d\d:\d\d/);
    expect(header(noTime.container)!.querySelector('svg')).not.toBeNull();
    cleanup();
    routes['/state'] = programState(`${CLOCK},${CHYRON}`, { [CLOCK]: { showWorldClocks: 0, showLogo: 'false' } });
    const nothing = await mount();
    expect(header(nothing.container)).toBeNull();
  });

  it("shows the program's song sequence from the latest audio_bus_update in the on-air block", async () => {
    routes['/state'] = programState(`${CLOCK},${CHYRON}`, { [CHYRON]: headline('Harbor Light') });
    const { container } = await mount();
    expect(container.querySelector('.modoitaliano-giorgia-clock-on-air')).toBeNull();
    await emit({ type: 'audio_bus_update', programId: 'harbor-light', settings: { songSequence: songSequence('The Lighthouse Keepers', 'Harbor Light') } });
    await nextFrame();
    const onAir = row(container)!.querySelector('[data-program-row-slot="clock"] .modoitaliano-giorgia-clock-on-air');
    expect(onAir?.textContent).toContain('THE LIGHTHOUSE KEEPERS');
    expect(onAir?.textContent).toContain('Estás escuchando');
    expect(onAir?.querySelector('img')?.getAttribute('src')).toBe('/harbor-light/song.jpg');
  });

  it("shows the standalone clock's on-air block bottom-left from the song sequence", async () => {
    routes['/state'] = programState(CLOCK, {});
    const { container } = await mount();
    await emit({ type: 'audio_bus_update', programId: 'harbor-light', settings: { songSequence: songSequence('', 'Harbor Light') } });
    await nextFrame();
    const onAir = container.querySelector('.modoitaliano-giorgia-clock-on-air') as HTMLElement;
    expect(onAir.parentElement).toBe(tvBox(container));
    expect(onAir.style.position).toBe('absolute');
    expect(onAir.textContent).toContain('HARBOR LIGHT');
  });

  it("gives the Giorgia clock the program's time override", async () => {
    routes['/state'] = programState(`${CLOCK},${CHYRON}`, { [CHYRON]: headline('Harbor Light') });
    const { container } = await mount();
    await emit({
      type: 'broadcast_settings_update',
      settings: { timeOverrideEnabled: true, timeOverrideStartTime: '07:30', timeOverrideStartedAt: '2026-11-17T10:00:00.000Z' },
    });
    expect(header(container)!.textContent).toContain('07:30 IT');
  });

  it('follows the scene renderer component list when embedded', async () => {
    const { container } = await mount({ embedded: true, sceneMetadata: { [CHYRON]: headline('Harbor Light') }, activeComponents: [CHYRON, CLOCK] });
    expect(row(container)).not.toBeNull();
  });
});
