// @vitest-environment happy-dom
// The Giorgia clock and chyron, ported again from Alcantara with their key-safe
// mode (modoitaliano/giorgia#49), on the fictional harbor-light program.
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GIORGIA, GiorgiaGrade, GiorgiaMark, GiorgiaRule, fitGiorgiaText, useElementHeight, useElementWidth } from './giorgiaBroadcast.js';
import { ModoItalianoGiorgiaChyron } from './ModoItalianoGiorgiaChyron.js';
import { ModoItalianoGiorgiaClock } from './ModoItalianoGiorgiaClock.js';
import { updateProgramAudioBus } from './programAudioBus.js';

const START = new Date('2026-11-17T10:00:00.000Z');
let programSeq = 0;
const nextProgram = () => `harbor-light-giorgia-${(programSeq += 1)}`;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const text = (value: string, useMarquee = false) => ({ mode: 'manual', items: [{ id: 'harbor', text: value, useMarquee }] });
const html = (container: HTMLElement) => container.innerHTML;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Giorgia broadcast parts', () => {
  it('fits text between its bounds', () => {
    expect(fitGiorgiaText('', 500, 100, 20, 0.5)).toBe(100);
    expect(fitGiorgiaText('x'.repeat(100), 500, 100, 20, 0.5)).toBe(20);
    expect(fitGiorgiaText('xxxxxxxxxx', 500, 120, 20, 0.5)).toBe(100);
  });

  it('draws the mark, rule and grade soft by default and as solid plates when key-safe', () => {
    const soft = render(h('div', null, h(GiorgiaMark), h(GiorgiaRule, { left: 4 }), h(GiorgiaGrade, { style: { opacity: 0.5 } }))).container;
    expect(html(soft)).toContain('drop-shadow');
    expect(html(soft)).toContain('box-shadow');
    expect(html(soft)).toContain('linear-gradient');
    expect(html(soft)).toContain('left: 4px');
    cleanup();
    const keySafe = render(
      h('div', null, h(GiorgiaMark, { keySafe: true, width: 90 }), h(GiorgiaRule, { keySafe: true }), h(GiorgiaGrade, { keySafe: true, style: { opacity: 0.5 } }))
    ).container;
    expect(html(keySafe)).not.toContain('drop-shadow');
    expect(html(keySafe)).not.toContain('box-shadow');
    expect(html(keySafe)).not.toContain('linear-gradient');
    expect(keySafe.querySelector('[data-giorgia-grade]')!.getAttribute('style')).toContain(`top: -${GIORGIA.platePadding}px`);
    expect(keySafe.querySelector('svg')!.getAttribute('width')).toBe('90');
  });

  it('measures elements with and without ResizeObserver', () => {
    const observed: Array<() => void> = [];
    class Observer {
      constructor(callback: () => void) {
        observed.push(callback);
      }
      observe() {}
      disconnect() {}
    }
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(210);
    const seen: number[] = [];
    function Probe() {
      const [widthRef, width] = useElementWidth<HTMLDivElement>();
      const [heightRef, height] = useElementHeight<HTMLDivElement>();
      seen.push(width, height);
      return h('div', { ref: widthRef }, h('span', { ref: heightRef }));
    }
    vi.stubGlobal('ResizeObserver', Observer);
    const { unmount } = render(h(Probe));
    act(() => observed.forEach((callback) => callback()));
    expect(seen).toContain(640);
    expect(seen).toContain(210);
    unmount();
    vi.stubGlobal('ResizeObserver', undefined);
    seen.length = 0;
    render(h(Probe));
    expect(seen).toContain(640);
  });
});

describe('Giorgia clock', () => {
  it('renders nothing with every block hidden, or with only the header hidden part', () => {
    expect(html(render(h(ModoItalianoGiorgiaClock, { programId: nextProgram(), showWorldClocks: false, showLogo: false })).container)).toBe('');
    expect(html(render(h(ModoItalianoGiorgiaClock, { programId: nextProgram(), part: 'onAir' })).container)).toBe('');
    const withoutMark = render(h(ModoItalianoGiorgiaClock, { programId: nextProgram(), showLogo: false })).container;
    expect(withoutMark.querySelector('svg[aria-label="ModoItaliano"]')).toBeNull();
    expect(withoutMark.textContent).toMatch(/\d\d:\d\d IT/);
  });

  it('rotates through every city with hard cuts, reshuffling at the end when asked', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container, rerender } = render(h(ModoItalianoGiorgiaClock, { programId: nextProgram(), rotationIntervalMs: 100 }));
    const seen = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      seen.add(container.textContent!.slice(-2));
      advance(500);
    }
    expect(seen).toEqual(new Set(['IT', 'ES', 'UY', 'CL', 'NY']));
    rerender(h(ModoItalianoGiorgiaClock, { programId: 'harbor-shuffle', rotationIntervalMs: 500, shuffleCities: true }));
    advance(2600);
    expect(container.textContent).toMatch(/\d\d:\d\d [A-Z]{2}/);
    rerender(h(ModoItalianoGiorgiaClock, { programId: 'harbor-shuffle', showWorldClocks: false, showBellIcon: true }));
    expect(container.querySelector('svg[aria-label="ModoItaliano"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\d\d:\d\d/);
  });

  it('shows the time override, and the real time for an unusable one', () => {
    const programId = nextProgram();
    const { container, rerender } = render(
      h(ModoItalianoGiorgiaClock, { programId, timeOverride: { startTime: '07:30', startedAt: START.toISOString() } })
    );
    expect(container.textContent).toContain('07:30 IT');
    advance(60_000);
    expect(container.textContent).toMatch(/07:31 [A-Z]{2}/);
    rerender(h(ModoItalianoGiorgiaClock, { programId, timeOverride: { startTime: 'late', startedAt: '' } }));
    expect(container.textContent).toMatch(/\d\d:\d\d [A-Z]{2}/);
    expect(container.textContent).not.toContain('07:3');
  });

  it('sets the header on a navy plate with no type shadow when key-safe', () => {
    const programId = nextProgram();
    const soft = render(h(ModoItalianoGiorgiaClock, { programId, part: 'header' })).container;
    const softHeader = soft.querySelector('.modoitaliano-giorgia-clock-header') as HTMLElement;
    expect(softHeader.style.background).toBe('');
    expect(softHeader.querySelector('span')!.style.textShadow).not.toBe('none');
    cleanup();
    const keySafe = render(h(ModoItalianoGiorgiaClock, { programId, part: 'header', keySafe: true })).container;
    const header = keySafe.querySelector('.modoitaliano-giorgia-clock-header') as HTMLElement;
    expect(header.style.background).not.toBe('');
    expect(header.style.margin).toBe(`-${GIORGIA.safeTop}px 0px 0px -${GIORGIA.safeX}px`);
    expect(header.querySelector('span')!.style.textShadow).toBe('none');
  });

  it('shows the on-air block in each language, easing it in and out', () => {
    const programId = nextProgram();
    const { container, rerender } = render(h(ModoItalianoGiorgiaClock, { programId, songArtist: 'Harbor Band', songTitle: 'Light', inline: true }));
    act(() => vi.advanceTimersToNextFrame());
    expect(container.textContent).toContain('Estás escuchando');
    expect(container.textContent).toContain('HARBOR BAND');
    expect(container.textContent).toContain('LIGHT');
    for (const [language, label] of [['it', 'In onda ora'], ['en', 'On air now']] as const) {
      rerender(h(ModoItalianoGiorgiaClock, { programId, language, songArtist: 'Harbor Band', songTitle: 'Light', inline: true }));
      expect(container.textContent).toContain(label);
    }
    rerender(h(ModoItalianoGiorgiaClock, { programId, playingSong: false, songArtist: 'Harbor Band' }));
    // While it leaves, the block keeps the song that just ended.
    expect(container.textContent).toContain('HARBOR BAND');
    advance(450);
    expect(container.querySelector('.modoitaliano-giorgia-clock-on-air')).toBeNull();
  });

  it('sets the on-air block on a solid plate with no shadows when key-safe', () => {
    const programId = nextProgram();
    const { container, rerender } = render(h(ModoItalianoGiorgiaClock, { programId, songArtist: 'Harbor Band', songTitle: 'Light' }));
    act(() => vi.advanceTimersToNextFrame());
    const hero = () => container.querySelector('.modoitaliano-giorgia-clock-hero') as HTMLElement;
    expect(hero().style.textShadow).not.toBe('none');
    expect(html(container)).toContain('linear-gradient');
    rerender(h(ModoItalianoGiorgiaClock, { programId, songArtist: 'Harbor Band', songTitle: 'Light', keySafe: true }));
    expect(hero().style.textShadow).toBe('none');
    expect(html(container)).not.toContain('linear-gradient');
    expect(html(container)).not.toContain('box-shadow');
  });

  it('leads with the title without an artist, wraps long lines and can hide the progress', () => {
    const programId = nextProgram();
    const long = 'Harbor light keeps on shining across the long night sea';
    const { container, rerender } = render(h(ModoItalianoGiorgiaClock, { programId, songTitle: long, showPlaybackProgress: false, part: 'onAir' }));
    act(() => vi.advanceTimersToNextFrame());
    expect(container.querySelector('.modoitaliano-giorgia-clock-header')).toBeNull();
    expect(container.querySelector('.modoitaliano-giorgia-clock-progress')).toBeNull();
    expect((container.querySelector('.modoitaliano-giorgia-clock-hero') as HTMLElement).style.fontSize).toBe('54px');
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/cover.jpg');
    rerender(h(ModoItalianoGiorgiaClock, { programId, songArtist: 'Harbor', songTitle: `${long} ${long}`, songCoverUrl: ' /harbor.jpg ' }));
    expect(container.textContent).toContain('HARBOR');
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/harbor.jpg');
  });

  it('takes the song from the list or the sequence, and follows an autoplay sequence', () => {
    const programId = nextProgram();
    const { container, rerender } = render(
      h(ModoItalianoGiorgiaClock, { programId, songs: [null, [], 'x', { artist: 3 }, { title: ' Tide ', durationMs: 1000, audioUrl: '/t.mp3' }] })
    );
    act(() => vi.advanceTimersToNextFrame());
    expect(container.textContent).toContain('TIDE');
    rerender(h(ModoItalianoGiorgiaClock, { programId, songs: 'none' }));
    advance(450);
    expect(container.querySelector('.modoitaliano-giorgia-clock-on-air')).toBeNull();
    rerender(h(ModoItalianoGiorgiaClock, { programId, songs: [{ artist: 3, title: [], durationMs: -1 }] }));
    expect(container.querySelector('.modoitaliano-giorgia-clock-on-air')).toBeNull();
    rerender(
      h(ModoItalianoGiorgiaClock, {
        programId,
        songSequence: {
          mode: 'autoplay',
          startedAt: START.getTime(),
          items: [
            { id: 'a', title: 'First', durationMs: 1000 },
            { id: 'b', title: 'Second', durationMs: 1000 }
          ]
        }
      })
    );
    act(() => vi.advanceTimersToNextFrame());
    expect(container.textContent).toContain('FIRST');
    advance(1250);
    expect(container.textContent).toContain('SECOND');
  });

  it('prefers the live track on the audio bus until it ends', () => {
    const programId = nextProgram();
    const { container } = render(h(ModoItalianoGiorgiaClock, { programId, songTitle: 'Fallback' }));
    act(() => {
      updateProgramAudioBus(programId, { track: { token: 't1', audioUrl: '/live.mp3', artist: 'Live Artist', title: 'Live Title', coverUrl: '/live.jpg' }, progress: 0.5 });
    });
    act(() => vi.advanceTimersToNextFrame());
    expect(container.textContent).toContain('LIVE ARTIST');
    expect(html(container)).toContain('scaleX(0.5)');
    act(() => {
      updateProgramAudioBus(programId, { track: { token: 't2', audioUrl: '/live.mp3' }, progress: 2 });
    });
    expect(container.textContent).toContain('FALLBACK');
    expect(html(container)).toContain('scaleX(1)');
    act(() => {
      updateProgramAudioBus(programId, { track: { token: 't3', audioUrl: '/live.mp3', title: 'Ended' }, endedToken: 't3' });
    });
    advance(450);
    expect(container.querySelector('.modoitaliano-giorgia-clock-on-air')).toBeNull();
  });
});

describe('Giorgia chyron', () => {
  it('renders nothing when hidden or empty', () => {
    expect(html(render(h(ModoItalianoGiorgiaChyron, { show: false, textSequence: text('Harbor') })).container)).toBe('');
    expect(html(render(h(ModoItalianoGiorgiaChyron, { textSequence: text('   ') })).container)).toBe('');
    expect(html(render(h(ModoItalianoGiorgiaChyron, {})).container)).toBe('');
  });

  it('fits the headline under its call to action, wrapping a long one, inline or anchored', () => {
    const { container, rerender } = render(h(ModoItalianoGiorgiaChyron, { textSequence: text('Harbor light'), ctaSequence: text('Listen now') }));
    const headline = () => container.querySelector('h2') as HTMLElement;
    expect(headline().textContent).toBe('HARBOR LIGHT');
    expect(headline().style.fontSize).toBe('120px');
    expect(container.textContent).toContain('Listen now');
    expect((container.firstChild as HTMLElement).style.position).toBe('absolute');
    rerender(h(ModoItalianoGiorgiaChyron, { inline: true, textSequence: text('Harbor light '.repeat(30)) }));
    expect(headline().style.fontSize).toBe('76px');
    expect(headline().style.whiteSpace).toBe('');
    expect((container.firstChild as HTMLElement).style.position).toBe('relative');
  });

  it('refits to the measured width', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(700);
    const { container } = render(h(ModoItalianoGiorgiaChyron, { textSequence: text('Harbor light at night') }));
    expect((container.querySelector('h2') as HTMLElement).style.fontSize).not.toBe('120px');
  });

  it('runs a marquee headline', () => {
    const { container } = render(h(ModoItalianoGiorgiaChyron, { textSequence: text('Harbor news', true) }));
    expect(container.querySelector('.modoitaliano-giorgia-chyron-marquee')!.textContent).toBe('HARBOR NEWSHARBOR NEWS');
    expect(container.querySelector('h2')).toBeNull();
  });

  it('drops every shadow and sets a solid band when key-safe', () => {
    const { container, rerender } = render(h(ModoItalianoGiorgiaChyron, { textSequence: text('Harbor'), ctaSequence: text('Listen') }));
    expect((container.querySelector('h2') as HTMLElement).style.textShadow).not.toBe('none');
    expect(html(container)).toContain('linear-gradient');
    rerender(h(ModoItalianoGiorgiaChyron, { keySafe: true, textSequence: text('Harbor'), ctaSequence: text('Listen') }));
    expect((container.querySelector('h2') as HTMLElement).style.textShadow).toBe('none');
    expect(container.querySelector('h2')!.previousElementSibling!.getAttribute('style')).toContain('text-shadow: none');
    expect(html(container)).not.toContain('linear-gradient');
    expect(html(container)).not.toContain('box-shadow');
  });

  it('follows autoplay text and call-to-action sequences', () => {
    const autoplay = (texts: string[]) => ({ mode: 'autoplay', intervalMs: 1000, startedAt: Date.now(), items: texts.map((value, i) => ({ id: `t${i}`, text: value })) });
    const { container, rerender, unmount } = render(h(ModoItalianoGiorgiaChyron, { textSequence: autoplay(['One', 'Two']) }));
    expect(container.textContent).toContain('ONE');
    advance(1250);
    expect(container.textContent).toContain('TWO');
    rerender(h(ModoItalianoGiorgiaChyron, { textSequence: text('Fixed'), ctaSequence: autoplay(['Now', 'Later']) }));
    advance(1250);
    expect(container.textContent).toContain('Later');
    unmount();
  });
});
