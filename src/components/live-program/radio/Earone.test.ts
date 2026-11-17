// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import earoneLogoUrl from '../../../templates/assets/earone.svg';
import Earone, { Earone as NamedEarone, formatMetric } from './Earone.js';
import { earonePropsFromSong, readSongPlaybackActive } from './songSignals.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const values = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.earone-metric-value')).map((node) => node.textContent);

describe('formatMetric', () => {
  it('formats numbers, digit strings and free text, and blanks missing values', () => {
    expect(formatMetric(null)).toBe('');
    expect(formatMetric(undefined)).toBe('');
    expect(formatMetric(12345)).toBe('12,345');
    expect(formatMetric(Number.NaN)).toBe('NaN');
    expect(formatMetric('   ')).toBe('');
    expect(formatMetric(' 4321 ')).toBe('4,321');
    expect(formatMetric(' n/d ')).toBe('n/d');
  });
});

describe('Earone', () => {
  it('renders nothing without a rank or spins', () => {
    const { container } = render(h(Earone));
    expect(container.innerHTML).toBe('');
    expect(NamedEarone).toBe(Earone);
  });

  it('renders the rank and spins of the active song_playback_active signal', () => {
    const song = readSongPlaybackActive({
      type: 'song_playback_active',
      songId: 'harbor-light-radio-song-1',
      title: 'Harbor Light',
      artist: 'The Lighthouse Keepers',
      externalChartProvider: 'earone',
      externalChartRank: 3,
      externalChartSpins: '1520',
    });
    const { container } = render(h(Earone, earonePropsFromSong(song)));
    expect(values(container)).toEqual(['#3', '1,520']);
    const logo = container.querySelector('img')!;
    expect(logo.getAttribute('src')).toBe(earoneLogoUrl);
    expect(logo.getAttribute('alt')).toBe('EARONE');
    expect(container.querySelector('.earone-live-badge')?.textContent).toBe('EN TIEMPO REAL');
  });

  it('shows placeholders for a missing metric and uses a custom label', () => {
    const { container } = render(h(Earone, { rank: 7, label: 'HARBOR CHART' }));
    expect(values(container)).toEqual(['#7', '--']);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('HARBOR CHART');
    const spinsOnly = render(h(Earone, { spins: 9 }));
    expect(values(spinsOnly.container)).toEqual(['--', '9']);
  });

  it('cross-fades to new values after 180 ms and cancels a superseded transition', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(h(Earone, { rank: 1, spins: 10 }));
    rerender(h(Earone, { rank: 2, spins: 20 }));
    expect(container.querySelectorAll('.earone-metric--transitioning')).toHaveLength(2);
    expect(values(container)).toEqual(['#1', '10']);
    rerender(h(Earone, { rank: 4, spins: 40 }));
    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(values(container)).toEqual(['#4', '40']);
    expect(container.querySelectorAll('.earone-metric--transitioning')).toHaveLength(0);

    // Clearing both values keeps the last values on screen until the fade ends.
    rerender(h(Earone, { rank: null, spins: null }));
    expect(values(container)).toEqual(['#4', '40']);
    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(container.innerHTML).toBe('');
  });
});
