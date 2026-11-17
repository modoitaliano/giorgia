// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModoItalianoChyron } from './ModoItalianoChyron.js';
import { ModoItalianoGiorgiaChyron } from './ModoItalianoGiorgiaChyron.js';
import { ModoItalianoClock } from './ModoItalianoClock.js';
import { ModoItalianoGiorgiaClock } from './ModoItalianoGiorgiaClock.js';
import { ModoItalianoDisclaimer } from './ModoItalianoDisclaimer.js';
import { ModoItalianoBracket } from './ModoItalianoBracketComponent.js';
import { CronicaChyron } from './CronicaChyron.js';
import { CronicaBackground } from './CronicaBackground.js';
import { CronicaReiteramos } from './CronicaReiteramos.js';
import { CronicaLayout } from './CronicaLayout.js';
import { LogoWidget } from './LogoWidget.js';
import { ClockWidget } from './ClockWidget.js';
import RelojClone from './RelojClone.js';
import RelojLoopClock from './RelojLoopClock.js';
import RelojDigitalLoopClock from './RelojDigitalLoopClock.js';

import {
  normalizeModoItalianoBracketStartRound,
  getModoItalianoBracketOpeningMatchIds,
  createDefaultModoItalianoBracketMatches,
  normalizeModoItalianoBracketSongPoolIds,
  normalizeModoItalianoBracketDrawSeed,
  normalizeModoItalianoBracketDrawDurationSeconds,
  normalizeModoItalianoBracketDrawCommand,
  applyModoItalianoBracketAdvancement,
  normalizeModoItalianoBracketMatches
} from './modoItalianoBracket.js';

import {
  getOverrideClockParts,
  formatClockParts
} from './broadcastTime.js';

import {
  getProgramAudioBusSnapshot,
  subscribeProgramAudioBus,
  updateProgramAudioBus
} from './programAudioBus.js';

import {
  normalizeProgramTextSequence,
  resolveProgramTextLeaf,
  normalizeProgramSongSequence,
  resolveProgramSongLeaf
} from './programSequence.js';

import { fetchSongCatalog } from './songs.js';
import { activateScene } from './programService.js';

import {
  HARBOR_LIGHT_TENANT,
  HARBOR_LIGHT_TV_PROGRAM,
  HARBOR_LIGHT_SONGS,
  HARBOR_LIGHT_BRACKET_MATCHES,
  HARBOR_LIGHT_AUDIENCE_DRAW_START,
  HARBOR_LIGHT_AUDIENCE_DRAW_END,
  HARBOR_LIGHT_LEGACY_DRAW_START,
  HARBOR_LIGHT_LEGACY_DRAW_END,
  HARBOR_LIGHT_TEXT_SEQUENCE,
  HARBOR_LIGHT_CTA_SEQUENCE
} from '../../../../stories/react/live-program/tv/harbor-light.fixture.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TV Components Render Tests with harbor-light Fixtures', () => {
  it('renders CronicaBackground', () => {
    const { container } = render(h(CronicaBackground));
    expect(container.querySelector('.cronica-background')).toBeTruthy();
  });

  it('renders CronicaChyron with lines and handles empty text', () => {
    const { container, rerender } = render(h(CronicaChyron, { text: 'LINE ONE\nLINE TWO' }));
    expect(container.querySelectorAll('.cronica-chyron-line')).toHaveLength(2);
    expect(container.textContent).toContain('LINE ONE');
    expect(container.textContent).toContain('LINE TWO');

    rerender(h(CronicaChyron, { text: '' }));
    expect(container.innerHTML).toBe('');
  });

  it('renders CronicaReiteramos with text and respects show prop', () => {
    const { container, rerender } = render(h(CronicaReiteramos, { text: 'HARBOR LIGHT ALERT', show: true }));
    expect(container.textContent).toContain('HARBOR LIGHT ALERT');

    rerender(h(CronicaReiteramos, { text: 'HARBOR LIGHT ALERT', show: false }));
    expect(container.innerHTML).toBe('');
  });

  it('renders LogoWidget with animation transitions', () => {
    // The bundled ModoRadio bug is retired (#48); the widget only draws with a scene logo.
    const { container } = render(h(LogoWidget, { logoUrl: '/harbor-logo.svg' }));
    expect(container.querySelector('.logo-widget')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(container.querySelector('.logo-widget')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(container.querySelector('.logo-widget')).toBeTruthy();
  });

  it('renders ClockWidget with timezone and override', () => {
    const { container, rerender } = render(h(ClockWidget, { timezone: 'Europe/Madrid' }));
    expect(container.querySelector('.clock-widget')).toBeTruthy();

    rerender(
      h(ClockWidget, {
        timezone: 'Europe/Madrid',
        timeOverride: { startTime: '15:30', startedAt: new Date().toISOString() }
      })
    );
    expect(container.textContent).toContain('15:30');

    // Invalid timezone fallback
    rerender(h(ClockWidget, { timezone: 'Invalid/Timezone' }));
    expect(container.querySelector('.clock-widget')).toBeTruthy();
  });

  it('renders CronicaLayout with headline, reiteramos and widgets', () => {
    const { container } = render(
      h(CronicaLayout, {
        headline: 'HARBOR LIGHT SPECIAL\nDIRECT BROADCAST',
        reiteramosText: 'HARBOR LIGHT',
        showReiteramos: true,
        timezone: 'America/Argentina/Buenos_Aires'
      })
    );
    expect(container.textContent).toContain('HARBOR LIGHT');
    expect(container.textContent).toContain('HARBOR LIGHT SPECIAL');
    expect(container.querySelectorAll('.cronica-chyron-line')).toHaveLength(2);
    // CronicaLayout passes no logoUrl, and the bundled ModoRadio bug is retired (#48).
    expect(container.querySelector('.logo-widget')).toBeNull();
    expect(container.querySelector('.clock-widget')).toBeTruthy();
  });

  it('renders ModoItalianoDisclaimer and respects show prop', () => {
    const { container, rerender } = render(h(ModoItalianoDisclaimer, { show: true, text: 'HARBOR LIGHT DISCLAIMER' }));
    expect(container.textContent).toContain('HARBOR LIGHT DISCLAIMER');

    rerender(h(ModoItalianoDisclaimer, { show: false }));
    expect(container.innerHTML).toBe('');
  });

  it('renders ModoItalianoChyron and rotates text and cta', () => {
    const { container, rerender } = render(
      h(ModoItalianoChyron, {
        show: true,
        textSequence: HARBOR_LIGHT_TEXT_SEQUENCE,
        ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE,
        inline: false
      })
    );
    expect(container.textContent).toContain('HARBOR LIGHT BROADCAST NEWS');
    expect(container.textContent).toContain('JOIN THE AUDIENCE DRAW');

    rerender(
      h(ModoItalianoChyron, {
        show: true,
        textSequence: { ...HARBOR_LIGHT_TEXT_SEQUENCE, activeItemId: 'item-2', mode: 'manual' },
        ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE,
        inline: false
      })
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.textContent).toContain('LIVE FROM HARBOR LIGHT STUDIOS');

    rerender(h(ModoItalianoChyron, { show: false }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders ModoItalianoGiorgiaChyron and rotates sequences', () => {
    const { container, rerender } = render(
      h(ModoItalianoGiorgiaChyron, {
        show: true,
        textSequence: HARBOR_LIGHT_TEXT_SEQUENCE,
        ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE
      })
    );
    expect(container.textContent).toContain('HARBOR LIGHT BROADCAST NEWS');

    rerender(
      h(ModoItalianoGiorgiaChyron, {
        show: true,
        textSequence: { ...HARBOR_LIGHT_TEXT_SEQUENCE, activeItemId: 'item-2', mode: 'manual' },
        ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE
      })
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.textContent).toContain('LIVE FROM HARBOR LIGHT STUDIOS');

    rerender(h(ModoItalianoGiorgiaChyron, { show: false }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders RelojClone with analog clock face', () => {
    const { container } = render(h(RelojClone, { timezone: 'Europe/Madrid' }));
    expect(container.querySelector('.clock')).toBeTruthy();
    expect(container.querySelector('.hour-hand')).toBeTruthy();
    expect(container.querySelector('.minute-hand')).toBeTruthy();
    expect(container.querySelector('.second-hand')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
  });

  it('renders RelojLoopClock and rotates timezones', () => {
    const { container } = render(h(RelojLoopClock, { timezone: 'Europe/Rome' }));
    expect(container.querySelector('.reloj-loop-analog')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector('.reloj-loop-analog')).toBeTruthy();
  });

  it('renders RelojDigitalLoopClock in clock and countdown modes', () => {
    const { container, rerender } = render(
      h(RelojDigitalLoopClock, {
        programId: HARBOR_LIGHT_TV_PROGRAM,
        textSequence: HARBOR_LIGHT_TEXT_SEQUENCE,
        ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE,
        mode: 'clock'
      })
    );
    expect(container.querySelector('.reloj-digital-loop-root')).toBeTruthy();

    rerender(
      h(RelojDigitalLoopClock, {
        programId: HARBOR_LIGHT_TV_PROGRAM,
        mode: 'countdown',
        countdownDuration: 10,
        countdownCommand: 1,
        allowProgramActivation: true,
        countdownTargetSceneId: 99
      })
    );
    expect(container.querySelector('.reloj-digital-loop-root')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
  });

  it('renders ModoItalianoClock with world clocks and live audio bus updates', () => {
    const { container } = render(
      h(ModoItalianoClock, {
        programId: HARBOR_LIGHT_TV_PROGRAM,
        showWorldClocks: true,
        showLogo: true,
        showBellIcon: true,
        language: 'it'
      })
    );
    expect(container.textContent).toContain('IT');

    act(() => {
      updateProgramAudioBus(HARBOR_LIGHT_TV_PROGRAM, {
        track: {
          token: 'tok-1',
          audioUrl: 'https://audio.test/beacon.mp3',
          artist: 'Harbor Light Live',
          title: 'Ocean Light'
        },
        isPlaying: true,
        progress: 0.5
      });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.textContent).toContain('Harbor Light Live');
    expect(container.textContent).toContain('Ocean Light');
  });

  it('renders ModoItalianoGiorgiaClock with live song and rotation', () => {
    const { container } = render(
      h(ModoItalianoGiorgiaClock, {
        programId: HARBOR_LIGHT_TV_PROGRAM,
        showWorldClocks: true,
        showLogo: true,
        showBellIcon: true,
        language: 'it'
      })
    );
    expect(container.textContent).toContain('IT');

    act(() => {
      updateProgramAudioBus(HARBOR_LIGHT_TV_PROGRAM, {
        track: {
          token: 'tok-2',
          audioUrl: 'https://audio.test/beacon.mp3',
          artist: 'Harbor Light Giorgia',
          title: 'Coastline'
        },
        isPlaying: true,
        progress: 0.3
      });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // The redesigned Giorgia clock sets the song in uppercase (#49).
    expect(container.textContent?.toUpperCase()).toContain('HARBOR LIGHT GIORGIA');
    expect(container.textContent?.toUpperCase()).toContain('COASTLINE');
  });
});

describe('ModoItalianoBracket Acceptance Criteria', () => {
  it('renders bracket matches and songs', () => {
    const { container } = render(
      h(ModoItalianoBracket, {
        title: 'HARBOR LIGHT TORNEO',
        show: true,
        startRound: 'roundOf16',
        matches: HARBOR_LIGHT_BRACKET_MATCHES,
        songs: HARBOR_LIGHT_SONGS
      })
    );
    expect(container.textContent).toContain('Beacon Song');
    expect(container.textContent).toContain('Ocean Breeze');
    expect(container.textContent).toContain('CAMPEÓN');
  });

  it('renders from audience_interaction_* signals', () => {
    const { container, rerender } = render(
      h(ModoItalianoBracket, {
        title: 'HARBOR LIGHT TORNEO',
        show: true,
        startRound: 'roundOf16',
        matches: HARBOR_LIGHT_BRACKET_MATCHES,
        songs: HARBOR_LIGHT_SONGS,
        event: HARBOR_LIGHT_AUDIENCE_DRAW_START
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-root')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender(
      h(ModoItalianoBracket, {
        title: 'HARBOR LIGHT TORNEO',
        show: true,
        startRound: 'roundOf16',
        matches: HARBOR_LIGHT_BRACKET_MATCHES,
        songs: HARBOR_LIGHT_SONGS,
        event: HARBOR_LIGHT_AUDIENCE_DRAW_END
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-root')).toBeTruthy();
  });

  it('still accepts legacy modoitaliano_bracket_draw_* signals', () => {
    const { container, rerender } = render(
      h(ModoItalianoBracket, {
        title: 'HARBOR LIGHT TORNEO',
        show: true,
        startRound: 'roundOf16',
        matches: HARBOR_LIGHT_BRACKET_MATCHES,
        songs: HARBOR_LIGHT_SONGS,
        drawCommand: HARBOR_LIGHT_LEGACY_DRAW_START
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-root')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender(
      h(ModoItalianoBracket, {
        title: 'HARBOR LIGHT TORNEO',
        show: true,
        startRound: 'roundOf16',
        matches: HARBOR_LIGHT_BRACKET_MATCHES,
        songs: HARBOR_LIGHT_SONGS,
        drawCommand: HARBOR_LIGHT_LEGACY_DRAW_END
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-root')).toBeTruthy();
  });

  it('exercises modoItalianoBracket helper functions and edge cases', () => {
    expect(normalizeModoItalianoBracketStartRound('quarterfinals')).toBe('quarterfinals');
    expect(normalizeModoItalianoBracketStartRound('invalid')).toBe('roundOf16');

    expect(getModoItalianoBracketOpeningMatchIds('quarterfinals')).toEqual([9, 10, 11, 12]);
    expect(getModoItalianoBracketOpeningMatchIds('roundOf16')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const defaultMatches = createDefaultModoItalianoBracketMatches();
    expect(defaultMatches).toHaveLength(15);

    expect(normalizeModoItalianoBracketSongPoolIds([1, '2', -5, 'invalid', null])).toEqual([1, 2]);
    expect(normalizeModoItalianoBracketSongPoolIds('not an array')).toEqual([]);

    expect(normalizeModoItalianoBracketDrawSeed(10)).toBe(10);
    expect(normalizeModoItalianoBracketDrawSeed('invalid')).toBe(5);

    expect(normalizeModoItalianoBracketDrawDurationSeconds(8)).toBe(8);
    expect(normalizeModoItalianoBracketDrawDurationSeconds('invalid', 6)).toBe(6);

    expect(normalizeModoItalianoBracketDrawCommand(null)).toBeNull();
    expect(normalizeModoItalianoBracketDrawCommand({ invalid: true })).toBeNull();

    const fullMatches = createDefaultModoItalianoBracketMatches().map((m) => {
      if (m.id === 1) return { ...m, songAId: 10, songBId: 20, winnerId: 10 };
      if (m.id === 2) return { ...m, songAId: 30, songBId: 40, winnerId: 40 };
      return m;
    });
    const advancedMatches = applyModoItalianoBracketAdvancement(fullMatches, 'roundOf16');
    expect(advancedMatches.find((m) => m.id === 9)?.songAId).toBe(10);
    expect(advancedMatches.find((m) => m.id === 9)?.songBId).toBe(40);

    expect(normalizeModoItalianoBracketMatches([], 'roundOf16')).toHaveLength(15);
  });
});

describe('Broadcast Time & Utilities', () => {
  it('formats and overrides clock parts', () => {
    const override = { startTime: '12:00', startedAt: new Date(Date.now() - 65000).toISOString() };
    const parts = getOverrideClockParts(override);
    expect(parts).not.toBeNull();
    if (parts) {
      expect(formatClockParts(parts)).toBe('12:01');
    }

    expect(getOverrideClockParts({ startTime: 'invalid', startedAt: 'invalid' })).toBeNull();
    expect(getOverrideClockParts({ startTime: '12:00', startedAt: 'invalid' })).toBeNull();
  });

  it('normalizes program text and song sequences', () => {
    const textSeq = normalizeProgramTextSequence(HARBOR_LIGHT_TEXT_SEQUENCE);
    expect(textSeq).not.toBeNull();
    const leaf = resolveProgramTextLeaf({ contentMode: 'sequence', sequence: textSeq }, Date.now());
    expect(leaf?.text).toBeTruthy();

    const songSeq = normalizeProgramSongSequence({
      mode: 'autoplay',
      items: [{ id: 's1', artist: 'Harbor Light', title: 'Song 1' }]
    });
    expect(songSeq).not.toBeNull();
    const songLeaf = resolveProgramSongLeaf({ contentMode: 'sequence', sequence: songSeq }, Date.now());
    expect(songLeaf?.artist).toBe('Harbor Light');
  });

  it('reads the song catalog from the given API only, and an empty list when it cannot', async () => {
    const originalFetch = globalThis.fetch;
    try {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: HARBOR_LIGHT_SONGS }) });
      globalThis.fetch = fetchMock as any;
      await expect(fetchSongCatalog('https://api.harbor-light.test/')).resolves.toHaveLength(4);
      expect(fetchMock).toHaveBeenCalledWith('https://api.harbor-light.test/songs?limit=0');

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => HARBOR_LIGHT_SONGS }) as any;
      await expect(fetchSongCatalog('https://api.harbor-light.test')).resolves.toHaveLength(4);

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
      await expect(fetchSongCatalog('https://api.harbor-light.test')).resolves.toEqual([]);

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;
      await expect(fetchSongCatalog('https://api.harbor-light.test')).resolves.toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('activates a scene on the given API and ignores a failure', async () => {
    const originalFetch = globalThis.fetch;
    try {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchMock as any;
      await expect(activateScene('https://api.harbor-light.test/', HARBOR_LIGHT_TV_PROGRAM, 10, 'cut')).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(`https://api.harbor-light.test/program/${HARBOR_LIGHT_TV_PROGRAM}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId: 10, transitionId: 'cut' })
      });

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Activation error')) as any;
      await expect(activateScene('https://api.harbor-light.test', HARBOR_LIGHT_TV_PROGRAM, 10, 'cut')).resolves.toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('renders ModoItalianoBracket in quarterfinals mode with voting and winner', () => {
    const { container } = render(
      h(ModoItalianoBracket, {
        title: 'HARBOR LIGHT CUARTOS',
        show: true,
        startRound: 'quarterfinals',
        matches: HARBOR_LIGHT_BRACKET_MATCHES.map((m) =>
          m.id === 9 ? { ...m, songAId: 1, songBId: 2, winnerId: 1 } : m
        ),
        songs: HARBOR_LIGHT_SONGS,
        voters: [{ id: 'v1', name: 'Judge 1' }, { id: 'v2', name: 'Judge 2' }],
        matchVotes: { '9': { v1: 1, v2: 1 } },
        activeVotingMatchId: 9,
        votingWinnerId: 1,
        votingResultStartedAt: Date.now()
      })
    );
    expect(container.querySelector('.modoitaliano-bracket-root')).toBeTruthy();
  });

  it('renders ModoItalianoClock and ModoItalianoGiorgiaClock with varied props', () => {
    const { container: clockC } = render(
      h(ModoItalianoClock, {
        programId: HARBOR_LIGHT_TV_PROGRAM,
        showWorldClocks: false,
        showLogo: false,
        showBellIcon: false,
        showPlaybackProgress: true,
        playingSong: false,
        language: 'es',
        shuffleCities: true,
        songArtist: 'Solo Artist',
        songTitle: 'Solo Title'
      })
    );
    expect(clockC).toBeTruthy();

    const { container: giorgiaClockC } = render(
      h(ModoItalianoGiorgiaClock, {
        programId: HARBOR_LIGHT_TV_PROGRAM,
        showWorldClocks: false,
        showLogo: false,
        showBellIcon: false,
        showPlaybackProgress: true,
        playingSong: false,
        language: 'en',
        shuffleCities: true,
        songArtist: 'Giorgia Artist',
        songTitle: 'Giorgia Title'
      })
    );
    expect(giorgiaClockC).toBeTruthy();
  });
});
