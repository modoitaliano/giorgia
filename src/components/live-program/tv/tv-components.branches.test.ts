// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockWidget } from './ClockWidget.js';
import { ModoItalianoBracket } from './ModoItalianoBracketComponent.js';
import { createDefaultModoItalianoBracketMatches, type ModoItalianoBracketMatch } from './modoItalianoBracket.js';
import { LogoWidget } from './LogoWidget.js';
import { ModoItalianoChyron } from './ModoItalianoChyron.js';
import { ModoItalianoClock } from './ModoItalianoClock.js';
import { ModoItalianoDisclaimer } from './ModoItalianoDisclaimer.js';
import { updateProgramAudioBus } from './programAudioBus.js';
import RelojClone from './RelojClone.js';
import RelojDigitalLoopClock from './RelojDigitalLoopClock.js';
import RelojLoopClock from './RelojLoopClock.js';

// Fictional harbor-light broadcast clock.
const HARBOR_LIGHT_START = new Date('2026-11-17T10:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HARBOR_LIGHT_START);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ClockWidget branches', () => {
  it('ignores an invalid override and shows an icon image when given one', () => {
    const { container } = render(
      h(ClockWidget, { timeOverride: { startTime: 'late', startedAt: HARBOR_LIGHT_START.toISOString() }, showIcon: true, iconUrl: '/harbor.svg' })
    );
    expect(container.querySelector('.clock-time')!.textContent).toMatch(/^\d\d:\d\d$/);
    expect(container.querySelector('.clock-icon img')!.getAttribute('src')).toBe('/harbor.svg');
  });
});

describe('RelojClone branches', () => {
  it('turns the hands from an override and survives an invalid time zone', () => {
    const { container, rerender } = render(
      h(RelojClone, { timeOverride: { startTime: '03:00', startedAt: HARBOR_LIGHT_START.toISOString() } })
    );
    expect((container.querySelector('.hour-hand') as HTMLElement).style.transform).toBe('rotate(180deg)');
    rerender(h(RelojClone, { timezone: 'Not/AZone' }));
    expect((container.querySelector('.second-hand') as HTMLElement).style.transform).toMatch(/^rotate\(/);
  });
});

describe('RelojLoopClock branches', () => {
  it('starts on the first city for an unknown time zone and moves on at the top of the minute', () => {
    vi.setSystemTime(new Date('2026-11-17T10:00:58.000Z'));
    const { container } = render(h(RelojLoopClock, { timezone: 'Nowhere/Harbor' }));
    const label = () => container.querySelector('.reloj-loop-city-label')!;
    const first = label().textContent;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(label().className).toContain('reloj-loop-city-label--out');
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('reloj-loop-analog--out');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(label().className).not.toContain('--out');
    expect(label().textContent).not.toBe(first);
  });
});

describe('ModoItalianoDisclaimer branches', () => {
  it('aligns inline and floating text left, center and right', () => {
    for (const align of ['left', 'center', 'right'] as const) {
      const inline = render(h(ModoItalianoDisclaimer, { text: 'Harbor Light', inline: true, align }));
      expect((inline.container.firstChild as HTMLElement).style.justifyContent).toBe(
        { left: 'flex-start', center: 'center', right: 'flex-end' }[align]
      );
      const floating = render(h(ModoItalianoDisclaimer, { text: 'Harbor Light', align }));
      expect((floating.container.firstChild as HTMLElement).style.textAlign).toBe(align);
    }
  });
});

describe('LogoWidget branches', () => {
  it('cycles white, black, big and red around the scene logo', () => {
    const custom = render(h(LogoWidget, { logoUrl: '/harbor-logo.svg', position: 'top-right' }));
    expect(custom.container.querySelector('.logo-image')!.getAttribute('src')).toBe('/harbor-logo.svg');
    custom.unmount();

    // The bundled ModoRadio bug is retired (#48); the plate only draws around a scene logo.
    const { container } = render(h(LogoWidget, { logoUrl: '/harbor-logo.svg' }));
    const root = () => container.querySelector('.logo-widget')!.className;
    const step = (ms: number) =>
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    expect(root()).toContain('variant-white');
    step(10000);
    expect(root()).toContain('gradient-active');
    step(10000);
    expect(root()).toContain('variant-black');
    step(100);
    expect(root()).not.toContain('gradient-active');
    step(10000);
    step(10000);
    expect(root()).toContain('resizing');
    step(800);
    expect(root()).toContain('big-mode');
    step(10000);
    step(10000);
    expect(root()).not.toContain('big-mode');
    step(800);
    expect(root()).toContain('variant-red');
    step(10000);
    step(10000);
    expect(root()).toContain('variant-white');
    step(100);
    expect(root()).not.toContain('gradient-active');
  });
});

const textSequence = (text: string, useMarquee = false) => ({ mode: 'manual', items: [{ id: 'harbor', text, useMarquee }] });

// The Giorgia chyron cuts instead of fading since its redesign; giorgia-broadcast.test.ts covers it (#49).
describe.each([['ModoItalianoChyron', ModoItalianoChyron]] as const)('%s transitions', (_name, Chyron) => {
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('swaps text and call to action, restarting a pending swap, and hides and shows mid-transition', () => {
    const { container, rerender, unmount } = render(
      h(Chyron, { inline: true, textSequence: textSequence('Harbor one', true), ctaSequence: textSequence('Listen') })
    );
    advance(50);
    expect(container.textContent).toContain('HARBOR ONE');
    expect(container.textContent).toContain('Listen');

    rerender(h(Chyron, { inline: true, textSequence: textSequence('Harbor two', true), ctaSequence: textSequence('Now') }));
    rerender(h(Chyron, { inline: true, textSequence: textSequence('Harbor three'), ctaSequence: textSequence('Later') }));
    expect(container.innerHTML).toContain('opacity: 0');
    advance(220);
    expect(container.textContent?.toUpperCase()).toContain('HARBOR THREE');
    expect(container.textContent).toContain('Later');

    rerender(h(Chyron, { inline: true, show: false, textSequence: textSequence('Harbor three') }));
    expect((container.firstChild as HTMLElement).style.opacity).toBe('0');
    rerender(h(Chyron, { inline: true, show: true, textSequence: textSequence('Harbor three') }));
    rerender(h(Chyron, { inline: true, show: false, textSequence: textSequence('Harbor three') }));
    rerender(h(Chyron, { inline: true, show: true, textSequence: textSequence('Harbor four'), ctaSequence: textSequence('Soon') }));
    unmount();
  });

  it('cancels a pending hide when unmounted', () => {
    const { rerender, unmount, container } = render(h(Chyron, { textSequence: textSequence('Harbor Light') }));
    advance(50);
    rerender(h(Chyron, { show: false, textSequence: textSequence('Harbor Light') }));
    unmount();
    advance(220);
    expect(container.innerHTML).toBe('');
  });

  it('floats without a call to action and unmounts once hidden', () => {
    const { container, rerender } = render(h(Chyron, { textSequence: textSequence('Harbor Light') }));
    advance(50);
    expect(container.textContent?.toUpperCase()).toContain('HARBOR LIGHT');
    rerender(h(Chyron, { textSequence: textSequence('Harbor Light', true) }));
    advance(220);
    expect(container.textContent).toContain('HARBOR LIGHT');
    rerender(h(Chyron, { show: false, textSequence: textSequence('Harbor Light', true) }));
    advance(220);
    expect(container.innerHTML).toBe('');
  });
});

const BRACKET_SONGS = [
  { id: 1, artist: 'Harbor A', title: 'One', coverUrl: '/one.jpg' },
  { id: 2, artist: 'Harbor B', title: 'Two', coverUrl: '/two.jpg' },
  { id: 3, artist: 'Harbor C', title: 'Three', coverUrl: null },
  { id: 4, artist: 'Harbor D', title: 'Four' },
  { id: 5, artist: 'Harbor E', title: 'Five', coverUrl: '/five.jpg' },
  { id: 6, artist: 'Harbor F', title: 'Six', coverUrl: '/six.jpg' }
];

function bracket(patch: Record<number, Partial<ModoItalianoBracketMatch>>): ModoItalianoBracketMatch[] {
  return createDefaultModoItalianoBracketMatches().map((match) => ({ ...match, ...patch[match.id] }));
}

describe('ModoItalianoBracket branches', () => {
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('renders nothing when hidden', () => {
    expect(render(h(ModoItalianoBracket, { show: false })).container.innerHTML).toBe('');
  });

  it('reads the catalog from the API only when given one and no songs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: BRACKET_SONGS }) });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;
    try {
      render(h(ModoItalianoBracket, {}));
      render(h(ModoItalianoBracket, { songs: BRACKET_SONGS, apiBaseUrl: 'https://api.harbor-light.test' }));
      expect(fetchMock).not.toHaveBeenCalled();
      const { container } = render(
        h(ModoItalianoBracket, { songs: [], apiBaseUrl: 'https://api.harbor-light.test', matches: bracket({ 1: { songAId: 1 } }) })
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledWith('https://api.harbor-light.test/songs?limit=0');
      expect(container.textContent).toContain('Harbor A');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('marks winners on both wings and in the final, with and without covers', () => {
    const matches = bracket({
      1: { songAId: 1, songBId: 2, winnerId: 1 },
      2: { songAId: 3, songBId: 4, winnerId: 4 },
      5: { songAId: 5, songBId: 6, winnerId: 6 },
      6: { songAId: 3, songBId: 1 },
      9: { winnerId: 1 },
      11: { winnerId: 6 },
      13: { winnerId: 1 },
      14: { winnerId: 6 },
      15: { winnerId: 1 }
    });
    const { container, rerender } = render(h(ModoItalianoBracket, { songs: BRACKET_SONGS, matches }));
    expect(container.textContent).toContain('CAMPEÓN');
    expect(container.querySelector('img.aspect-square')!.getAttribute('src')).toBe('/one.jpg');
    expect(container.querySelectorAll('.bg-red-600.right-0').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.bg-red-600.left-0').length).toBeGreaterThan(0);

    rerender(h(ModoItalianoBracket, { songs: BRACKET_SONGS, matches: bracket({ ...matches, 1: { songAId: 1, songBId: 4, winnerId: 4 }, 13: { winnerId: 4 }, 14: { winnerId: 6 }, 15: { winnerId: 6 } }) }));
    rerender(
      h(ModoItalianoBracket, {
        songs: BRACKET_SONGS,
        matches: bracket({ 1: { songAId: 1, songBId: 4, winnerId: 4 }, 5: { songAId: 3, songBId: 2, winnerId: 3 }, 9: { winnerId: 4 }, 11: { winnerId: 3 }, 13: { winnerId: 4 }, 14: { winnerId: 3 }, 15: { winnerId: 3 } })
      })
    );
    expect(container.querySelector('img.aspect-square')).toBeNull();
    expect(container.textContent).toContain('CAMPEÓN');
  });

  it('starts at the quarterfinals', () => {
    const { container } = render(
      h(ModoItalianoBracket, { songs: BRACKET_SONGS, startRound: 'quarterfinals', matches: bracket({ 9: { songAId: 1, songBId: 2 } }) })
    );
    expect(container.textContent).toContain('Harbor A');
  });

  it('shows a draw that cycles candidate songs, or a placeholder when none are known', () => {
    const { container, rerender } = render(
      h(ModoItalianoBracket, { songs: BRACKET_SONGS, event: { drawId: 7, durationSeconds: 2, candidateIds: [1, 3] } })
    );
    advance(120);
    expect(container.querySelector('.modoitaliano-bracket-draw-panel')).toBeTruthy();
    for (let i = 0; i < 4; i += 1) advance(180);
    rerender(h(ModoItalianoBracket, { songs: BRACKET_SONGS, drawCommand: { drawId: 8, durationSeconds: 2, candidateIds: [99] } }));
    advance(120);
    expect(container.textContent).toContain('Seleccionando');
    expect(container.textContent).toContain('Canciones');
    advance(3000);
    expect(container.querySelector('.modoitaliano-bracket-draw-panel')).toBeNull();
  });

  it('shows the open vote with rotated voters and the pick of each voter', () => {
    const voters = [
      { id: 'v1', name: 'Ana' },
      { id: 'v2', name: 'Ben' },
      { id: 'v3', name: ' ' }
    ];
    const { container, rerender } = render(
      h(ModoItalianoBracket, {
        songs: BRACKET_SONGS,
        matches: bracket({ 2: { songAId: 3, songBId: 2 } }),
        activeVotingMatchId: 2,
        voters: voters as any,
        matchVotes: { '2': { v1: 2, v2: null } }
      })
    );
    const names = [...container.querySelectorAll('.modoitaliano-bracket-voting-name')].map((n) => n.textContent);
    expect(names).toEqual(['Ben', 'Ana']);
    expect(container.querySelector('.modoitaliano-bracket-voting-cover img')!.getAttribute('src')).toBe('/two.jpg');

    rerender(
      h(ModoItalianoBracket, {
        songs: BRACKET_SONGS,
        startRound: 'quarterfinals',
        matches: bracket({ 9: { songAId: 3, songBId: 4 } }),
        activeVotingMatchId: 9,
        voters,
        matchVotes: { '9': { v1: 3 } }
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-voting-cover-reveal')).toBeTruthy();
    expect(container.querySelector('.modoitaliano-bracket-voting-cover img')).toBeNull();

    rerender(h(ModoItalianoBracket, { songs: BRACKET_SONGS, matches: bracket({ 2: { songAId: 3, songBId: 2 } }), activeVotingMatchId: 2, voters, matchVotes: {} }));
    expect(container.querySelector('.modoitaliano-bracket-voting-modal')).toBeTruthy();
  });

  it('reveals the vote winner for ten seconds, with or without a known cover', () => {
    const now = Date.now();
    const voters = [{ id: 'v1', name: 'Ana' }];
    const { container, rerender } = render(
      h(ModoItalianoBracket, {
        songs: BRACKET_SONGS,
        matches: bracket({ 1: { songAId: 1, songBId: 2, winnerId: 2 } }),
        activeVotingMatchId: 1,
        voters,
        votingWinnerId: 2,
        votingResultStartedAt: now
      })
    );
    expect(container.textContent).toContain('WINNER');
    expect(container.textContent).toContain('Harbor B - Two');
    expect(container.querySelector('.modoitaliano-bracket-voting-winner img')).toBeTruthy();

    rerender(
      h(ModoItalianoBracket, {
        songs: BRACKET_SONGS.filter((song) => song.id !== 2),
        matches: bracket({ 1: { songAId: 1, songBId: 2, winnerId: 2 } }),
        activeVotingMatchId: 1,
        voters,
        votingWinnerId: 2,
        votingResultStartedAt: now
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-voting-winner strong')!.textContent).toBe('Winner');
    advance(10_200);
    expect(container.querySelector('.modoitaliano-bracket-voting-modal')).toBeNull();

    rerender(
      h(ModoItalianoBracket, {
        songs: BRACKET_SONGS,
        matches: bracket({ 1: { songAId: 3, songBId: 4, winnerId: 3 } }),
        activeVotingMatchId: 1,
        voters,
        votingWinnerId: 3,
        votingResultStartedAt: Date.now()
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-voting-winner img')).toBeNull();
    rerender(h(ModoItalianoBracket, { songs: BRACKET_SONGS, votingResultStartedAt: 0, activeVotingMatchId: 1, voters, matches: bracket({ 1: { songAId: 3, songBId: 4, winnerId: 3 } }) }));
    expect(container.querySelector('.modoitaliano-bracket-voting-modal')).toBeNull();
  });
});

describe('RelojDigitalLoopClock branches', () => {
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const autoplay = (texts: string[]) => ({ mode: 'autoplay', intervalMs: 1000, startedAt: HARBOR_LIGHT_START.getTime(), items: texts.map((text, i) => ({ id: `t${i}`, text })) });

  it('rolls the title in, shows title and call to action, and moves to the next city every half minute', () => {
    vi.setSystemTime(new Date('2026-11-17T10:00:29.000Z'));
    const { container } = render(
      h(RelojDigitalLoopClock, { timezone: 'Nowhere/Harbor', textSequence: autoplay(['HARBOR LIGHT', 'LIVE']), ctaSequence: autoplay(['WATCH']) })
    );
    expect(container.querySelector('#pipe')).toBeTruthy();
    expect(container.querySelector('#cta')!.textContent).toBe('WATCH');
    const city = container.querySelector('#city-name')!.textContent;
    advance(1000);
    expect(container.querySelector('#clock-block')!.className).toBe('clock-out');
    advance(500);
    expect(container.querySelector('#clock-block')!.className).toBe('');
    expect(container.querySelector('#city-name')!.textContent).not.toBe(city);
    expect(container.querySelector('#clock')!.textContent).toMatch(/^\d\d:\d\d:\d\d$/);
    advance(2000);
    expect(container.querySelector('#show-title')!.textContent).toMatch(/^(HARBOR LIGHT|LIVE)$/);
  });

  it('shows only the parts that have text', () => {
    const titleOnly = render(h(RelojDigitalLoopClock, { textSequence: { items: [{ id: 'a', text: 'HARBOR' }] } }));
    expect(titleOnly.container.querySelector('#cta')).toBeNull();
    expect(titleOnly.container.querySelector('#pipe')).toBeNull();
    const ctaOnly = render(h(RelojDigitalLoopClock, { ctaSequence: { items: [{ id: 'a', text: 'WATCH' }] } }));
    expect(ctaOnly.container.querySelector('#show-title')).toBeNull();
    const none = render(h(RelojDigitalLoopClock, { textSequence: { items: [{ id: 'a', text: '  ' }] } }));
    expect(none.container.querySelector('#lower-third')).toBeNull();
  });

  it('counts down on command, restarts on a new duration, activates the target scene once and stops on the next command', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;
    try {
      const props = {
        mode: 'countdown' as const,
        countdownDuration: 1,
        programId: 'harbor-light-tv',
        apiBaseUrl: 'https://api.harbor-light.test',
        countdownTargetSceneId: 12,
        countdownCommand: 0
      };
      const { container, rerender } = render(h(RelojDigitalLoopClock, props));
      expect(container.querySelector('#clock')!.textContent).toBe('00:00:01');
      expect(container.querySelector('#city-name')!.textContent).toBe('');

      rerender(h(RelojDigitalLoopClock, { ...props, countdownCommand: 0 }));
      rerender(h(RelojDigitalLoopClock, { ...props, countdownCommand: 1 }));
      advance(100);
      expect(container.querySelector('#city-name')!.textContent).toBe('COUNTDOWN');
      advance(500);
      rerender(h(RelojDigitalLoopClock, { ...props, countdownCommand: 1, countdownDuration: 2 }));
      advance(1500);
      expect(fetchMock).not.toHaveBeenCalled();
      advance(600);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.harbor-light.test/program/harbor-light-tv/activate');
      expect(container.querySelector('#clock')!.textContent).toBe('00:00:00');

      rerender(h(RelojDigitalLoopClock, { ...props, countdownCommand: 2, countdownDuration: 2 }));
      advance(100);
      expect(container.querySelector('#clock')!.textContent).toBe('00:00:00');
      expect(container.querySelector('#city-name')!.textContent).toBe('');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      rerender(h(RelojDigitalLoopClock, { ...props, countdownCommand: undefined, countdownDuration: 2 }));
      expect(container.querySelector('#city-name')!.textContent).toBe('');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('activates nothing without the API, the program, the target or permission', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;
    try {
      const base = { mode: 'countdown' as const, countdownDuration: 1, programId: 'harbor-light-tv', apiBaseUrl: 'https://api.harbor-light.test', countdownTargetSceneId: 12 };
      for (const patch of [{ allowProgramActivation: false }, { apiBaseUrl: undefined }, { programId: undefined }, { countdownTargetSceneId: null }]) {
        const { rerender, unmount } = render(h(RelojDigitalLoopClock, { ...base, ...patch }));
        rerender(h(RelojDigitalLoopClock, { ...base, ...patch, countdownCommand: 1 }));
        advance(1200);
        unmount();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// The redesigned Giorgia clock is covered by giorgia-broadcast.test.ts (#49).

describe('ModoItalianoClock branches', () => {
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  let programSeq = 0;
  const nextProgram = () => `harbor-light-clock-${(programSeq += 1)}`;

  it('renders nothing with every block hidden, and only the logo when clocks and bell are off', () => {
    expect(render(h(ModoItalianoClock, { programId: nextProgram(), showWorldClocks: false, showLogo: false })).container.innerHTML).toBe('');
    for (const inline of [true, false]) {
      const { container } = render(h(ModoItalianoClock, { programId: nextProgram(), showWorldClocks: false, inline }));
      expect(container.querySelectorAll('[aria-label="MI"]')).toHaveLength(1);
      expect(container.textContent).toBe('');
    }
  });

  it('rotates through every city, reshuffling when asked, and cancels a pending switch on unmount', () => {
    const { container, rerender, unmount } = render(
      h(ModoItalianoClock, { programId: nextProgram(), rotationIntervalMs: 500, transitionDurationMs: 100 })
    );
    const seen = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      advance(i === 0 ? 500 : 400);
      expect(container.innerHTML).toContain('opacity: 0.35');
      advance(100);
      seen.add(container.textContent!.trim().slice(-2));
    }
    expect(seen.size).toBe(5);
    rerender(h(ModoItalianoClock, { programId: 'p2', rotationIntervalMs: 500, transitionDurationMs: 100, shuffleCities: true }));
    for (let i = 0; i < 6; i += 1) advance(600);
    advance(500);
    unmount();
  });

  it('shows the override time, the bell, and the logo next to a song without world clocks', () => {
    const programId = nextProgram();
    const { container, rerender } = render(
      h(ModoItalianoClock, { programId, timeOverride: { startTime: '07:30', startedAt: HARBOR_LIGHT_START.toISOString() }, inline: true })
    );
    expect(container.textContent).toContain('07:30');
    rerender(h(ModoItalianoClock, { programId, timeOverride: { startTime: 'x', startedAt: '' }, showBellIcon: true }));
    expect(container.querySelector('svg')).toBeTruthy();
    rerender(h(ModoItalianoClock, { programId, showWorldClocks: false, songTitle: 'Harbor', inline: true }));
    expect(container.querySelector('[aria-label="MI"]')).toBeTruthy();
    expect(container.textContent).toContain('Harbor');
  });

  it('takes the song from the direct fields, the song list or the sequence', () => {
    const programId = nextProgram();
    const { container, rerender } = render(
      h(ModoItalianoClock, {
        programId,
        songs: [null, [], 'x', { earoneRank: ' ', earoneSongId: ' ', earoneSpins: ' ' }, { title: ' Tide ', durationMs: 999.6, audioUrl: '/t.mp3', earoneSongId: 9, earoneSpins: 3 }]
      })
    );
    expect(container.textContent).toContain('Tide');
    expect(container.querySelector('img[alt="Cover"]')!.getAttribute('src')).toBe('/cover.jpg');
    rerender(h(ModoItalianoClock, { programId, songs: [{ earoneSongId: '501', earoneRank: '1', earoneSpins: '310', coverUrl: '/c.jpg', artist: 3, title: [], audioUrl: {} }] }));
    rerender(h(ModoItalianoClock, { programId, songs: [{ earoneRank: '2' }] }));
    rerender(h(ModoItalianoClock, { programId, songs: [{ durationMs: 5 }] }));
    rerender(h(ModoItalianoClock, { programId, songs: [{ audioUrl: '/only.mp3' }] }));
    rerender(h(ModoItalianoClock, { programId, songs: 'nope' }));
    rerender(h(ModoItalianoClock, { programId, songs: [null] }));
    rerender(h(ModoItalianoClock, { programId, songArtist: 'Only Artist', songCoverUrl: '/a.jpg', songEaroneSongId: '1', showPlaybackProgress: false }));
    advance(400);
    expect(container.textContent).toContain('Only Artist');
    expect(container.querySelector('img[alt="Cover"]')!.getAttribute('src')).toBe('/a.jpg');
    rerender(
      h(ModoItalianoClock, {
        programId,
        songSequence: { mode: 'autoplay', startedAt: HARBOR_LIGHT_START.getTime(), items: [{ id: 'a', title: 'First', artist: 'A', durationMs: 1000 }, { id: 'b', title: 'Second', durationMs: 1000 }] }
      })
    );
    advance(400);
    expect(container.textContent).toContain('First');
    advance(1250);
    expect(container.textContent).toContain('Second');
  });

  it('opens and closes the song card from the live audio bus track, and hides it when not playing', () => {
    const programId = nextProgram();
    const { container, rerender, unmount } = render(h(ModoItalianoClock, { programId }));
    expect(container.querySelector('img[alt="Cover"]')).toBeNull();
    act(() => {
      updateProgramAudioBus(programId, { track: { token: 't1', audioUrl: '/live.mp3', artist: 'Live Artist', title: 'Live Title', coverUrl: '/live.jpg' }, progress: 0.5 });
    });
    advance(20);
    expect(container.textContent).toContain('Live Title');
    expect(container.innerHTML).toContain('modoItalianoClockSongBoxIn');
    advance(400);
    act(() => {
      updateProgramAudioBus(programId, { endedToken: 't1' });
    });
    expect(container.innerHTML).toContain('modoItalianoClockSongBoxOut');
    advance(330);
    expect(container.querySelector('img[alt="Cover"]')).toBeNull();
    expect(container.innerHTML).toContain('modoItalianoClockSongBoxOut');
    advance(40);
    act(() => {
      updateProgramAudioBus(programId, { track: { token: 't2', audioUrl: '/live.mp3' }, progress: 0.2 });
    });
    rerender(h(ModoItalianoClock, { programId, songTitle: 'Fallback' }));
    advance(20);
    expect(container.textContent).toContain('Fallback');
    rerender(h(ModoItalianoClock, { programId, songTitle: 'Fallback', playingSong: false }));
    rerender(h(ModoItalianoClock, { programId, songTitle: 'Fallback', playingSong: true }));
    unmount();
  });
});
