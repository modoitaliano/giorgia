// @vitest-environment happy-dom
import { createElement as h } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MemoMarquee, { Marquee } from './Marquee.js';
import { MarqueeCurtain } from './MarqueeCurtain.js';
import { DEFAULT_WORLD_CLOCK_CITIES, WorldClocks } from './WorldClocks.js';
import type { Event, EventPost } from '../events.js';

const post = (relevance: number): EventPost => ({ relevance }) as EventPost;
const event = (uuid: string, created: string, relevances: number[], extra: Record<string, unknown> = {}): Event =>
  ({ id: 1, uuid, title: `Title ${uuid}`, summary: 's', status: 'open', created_at: created, updated_at: created, posts_count: relevances.length, posts: relevances.map(post), ...extra }) as Event;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Marquee', () => {
  const strong = [8, 8, 8, 8];
  const track = (container: HTMLElement) => container.firstElementChild!.firstElementChild as HTMLElement;

  it('renders nothing when no event passes the thresholds', () => {
    const { container } = render(h(Marquee, { events: [event('weak', '2026-03-11T00:00:00Z', [1, 1, 1, 1])] }));
    expect(container.innerHTML).toBe('');
  });

  it('applies the post count, average and median thresholds independently', () => {
    const events = [
      event('few-posts', '2026-03-11T00:00:00Z', [9, 9, 9]),
      event('low-average', '2026-03-11T00:00:00Z', [1, 1, 1, 1]),
      // median 8 but average 4.8
      event('low-average-high-median', '2026-03-11T00:00:00Z', [0, 0, 8, 8, 8]),
      // average 7 (>= 5) but median 5 (< 7)
      event('low-median', '2026-03-11T00:00:00Z', [5, 5, 5, 20]),
      event('ok', '2026-03-11T00:00:00Z', strong),
    ];
    render(h(Marquee, { events }));
    expect(screen.queryByText('Title few-posts')).toBeNull();
    expect(screen.queryByText('Title low-average')).toBeNull();
    expect(screen.queryByText('Title low-average-high-median')).toBeNull();
    expect(screen.queryByText('Title low-median')).toBeNull();
    expect(screen.getByText('Title ok')).toBeTruthy();
  });

  it('uses the posts array length when posts_count is not a number and skips thresholds set to zero', () => {
    const noCount = event('no-count', '2026-03-11T00:00:00Z', strong, { posts_count: undefined });
    const empty = event('empty', '2026-03-11T00:00:00Z', []);
    render(h(Marquee, { events: [noCount, empty], minPostsCount: 0, minAverageRelevance: 0, minMedianRelevance: 0 }));
    expect(screen.getByText('Title no-count')).toBeTruthy();
    // zero thresholds also admit an event with no posts at all
    expect(screen.getByText('Title empty')).toBeTruthy();
  });

  it('rejects an event with no posts under the default thresholds', () => {
    const { container } = render(h(Marquee, { events: [event('empty', '2026-03-11T00:00:00Z', [])] }));
    expect(container.innerHTML).toBe('');
  });

  it('computes the median of an even number of posts as the mean of the middle pair', () => {
    // sorted 4,10,10,20 -> median 10 (>= 7); average 11 (>= 5)
    render(h(Marquee, { events: [event('even', '2026-03-11T00:00:00Z', [20, 10, 4, 10])] }));
    expect(screen.getByText('Title even')).toBeTruthy();
    cleanup();
    // sorted 1,1,2,20 -> median 1.5 (< 7) although the average of 6 passes
    const { container } = render(h(Marquee, { events: [event('even-low', '2026-03-11T00:00:00Z', [20, 1, 1, 2])] }));
    expect(container.innerHTML).toBe('');
  });

  it('lists events oldest first with the configured box styling', () => {
    const events = [event('late', '2026-03-11T12:00:00Z', strong), event('early', '2026-03-11T06:00:00Z', strong)];
    const { container } = render(h(Marquee, { events, heightPx: 90, backgroundColor: 'rgb(1, 2, 3)', borderColor: 'rgb(4, 5, 6)' }));
    const titles = Array.from(container.querySelectorAll('span')).map((span) => span.textContent);
    expect(titles).toEqual(['Title early', 'Title late']);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.height).toBe('90px');
    expect(box.style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(box.style.borderTop).toContain('rgb(4, 5, 6)');
  });

  it('sizes the animation from the content width after the layout delay and on resize', () => {
    let width = 1000;
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => width);
    const { container } = render(h(Marquee, { events: [event('a', '2026-03-11T00:00:00Z', strong)], pixelsPerSecond: 100, minDurationSeconds: 10 }));
    const trackEl = track(container);
    expect(trackEl.style.animation).toContain('marqueeFlow 20s');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    // (1920 + 1000) / 100
    expect(trackEl.style.animation).toContain('marqueeFlow 29.2s');

    width = 80;
    act(() => {
      fireEvent(window, new Event('resize'));
    });
    // (1920 + 80) / 100 = 20
    expect(trackEl.style.animation).toContain('marqueeFlow 20s');

    // a content width of 80 gives 20s, below a 25 second floor
    cleanup();
    const floor = render(h(Marquee, { events: [event('a', '2026-03-11T00:00:00Z', strong)], pixelsPerSecond: 100, minDurationSeconds: 25 }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(track(floor.container).style.animation).toContain('marqueeFlow 25s');
  });

  it('never divides by less than one pixel per second', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(80);
    const { container } = render(h(Marquee, { events: [event('a', '2026-03-11T00:00:00Z', strong)], pixelsPerSecond: 0 }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(track(container).style.animation).toContain('marqueeFlow 2000s');
  });

  it('ignores the layout timer when nothing is rendered and cleans up on unmount', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { container, unmount } = render(h(Marquee, { events: [] }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(container.innerHTML).toBe('');
    unmount();
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('reports each completed animation cycle', () => {
    const onCycleComplete = vi.fn();
    const { container } = render(h(Marquee, { events: [event('a', '2026-03-11T00:00:00Z', strong)], onCycleComplete }));
    fireEvent.animationIteration(track(container));
    fireEvent.animationIteration(track(container));
    expect(onCycleComplete).toHaveBeenCalledTimes(2);
  });

  it('exports a memoised component that renders the same output', () => {
    render(h(MemoMarquee, { events: [event('memo', '2026-03-11T00:00:00Z', strong)] }));
    expect(screen.getByText('Title memo')).toBeTruthy();
  });
});

describe('MarqueeCurtain', () => {
  it('announces the brand and completes once after five seconds', () => {
    const onComplete = vi.fn();
    const { container } = render(h(MarqueeCurtain, { onComplete }));
    expect(container.textContent).toBe('This is fifthbell.');
    expect(container.querySelectorAll('svg')).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('does not complete after being unmounted', () => {
    const onComplete = vi.fn();
    const { unmount } = render(h(MarqueeCurtain, { onComplete }));
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('WorldClocks', () => {
  const fixed = new Date('2026-03-11T15:30:00Z');
  const cities = [
    { city: 'ROME', timezone: 'Europe/Rome' },
    { city: 'TOKYO', timezone: 'Asia/Tokyo' },
    { city: 'Springfield', timezone: 'America/Chicago' },
  ];

  const clockText = (container: HTMLElement) => Array.from(container.firstElementChild!.children).map((node) => node.textContent);

  it('shows the time in the first city with its translated label', () => {
    const { container } = render(h(WorldClocks, { currentTime: fixed, cities, shuffleCities: false, language: 'es' }));
    expect(clockText(container)).toEqual(['16:30', 'ROMA']);
    expect((container.firstElementChild as HTMLElement).style.width).toBe('200px');
  });

  it('rotates through the cities with a fade, keeps untranslated labels and wraps around', () => {
    const { container } = render(h(WorldClocks, { currentTime: fixed, cities, shuffleCities: false, language: 'en', rotateIntervalMs: 1000, transitionDurationMs: 100, widthPx: 120 }));
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('120px');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(root.style.opacity).toBe('0');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(root.style.opacity).toBe('1');
    expect(clockText(container)).toEqual(['00:30', 'TOKYO']);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(clockText(container)).toEqual(['10:30', 'Springfield']);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(clockText(container)).toEqual(['16:30', 'ROME']);
  });

  it('reshuffles the pool when the rotation wraps around', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const pair = cities.slice(0, 2);
    const { container } = render(h(WorldClocks, { currentTime: fixed, cities: pair, shuffleCities: true, rotateIntervalMs: 1000, transitionDurationMs: 0 }));
    // random() == 0 swaps every element with the first: [ROME, TOKYO] -> [TOKYO, ROME]
    expect(clockText(container)[1]).toBe('TOKIO');
    const callsBefore = random.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(1002);
    });
    expect(clockText(container)[1]).toBe('ROMA');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(random.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('enforces a 500 ms floor on the rotation interval', () => {
    const { container } = render(h(WorldClocks, { currentTime: fixed, cities, shuffleCities: false, rotateIntervalMs: 10, transitionDurationMs: 0 }));
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(clockText(container)[1]).toBe('ROMA');
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(clockText(container)[1]).toBe('TOKIO');
  });

  it('falls back to the default city list when none is given', () => {
    const { container } = render(h(WorldClocks, { currentTime: fixed, shuffleCities: false, language: 'en' }));
    expect(clockText(container)[1]).toBe(DEFAULT_WORLD_CLOCK_CITIES[0].city);
    cleanup();
    const emptyList = render(h(WorldClocks, { currentTime: fixed, cities: [], shuffleCities: false, language: 'en' }));
    expect(clockText(emptyList.container)[1]).toBe(DEFAULT_WORLD_CLOCK_CITIES[0].city);
  });

  it('follows the wall clock every second when no time is supplied', () => {
    vi.setSystemTime(new Date('2026-03-11T15:30:00Z'));
    const { container } = render(h(WorldClocks, { cities, shuffleCities: false }));
    expect(clockText(container)[0]).toBe('16:30');
    act(() => {
      vi.setSystemTime(new Date('2026-03-11T15:31:00Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(clockText(container)[0]).toBe('16:31');
  });

  it('adopts a new supplied time', () => {
    const view = render(h(WorldClocks, { currentTime: fixed, cities, shuffleCities: false }));
    view.rerender(h(WorldClocks, { currentTime: new Date('2026-03-11T18:45:00Z'), cities, shuffleCities: false }));
    expect(clockText(view.container)[0]).toBe('19:45');
  });

  it('shows the broadcast override clock when valid and the real zone time otherwise', () => {
    const override = { startTime: '09:15', startedAt: '2026-03-11T15:00:00Z' };
    const withOverride = render(h(WorldClocks, { currentTime: fixed, cities, shuffleCities: false, timeOverride: override }));
    // 30 minutes after a 09:15 start
    expect(clockText(withOverride.container)[0]).toBe('09:45');
    cleanup();
    const invalid = render(h(WorldClocks, { currentTime: fixed, cities, shuffleCities: false, timeOverride: { startTime: 'nope', startedAt: override.startedAt } }));
    expect(clockText(invalid.container)[0]).toBe('16:30');
  });

  it('stops its timers on unmount', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(h(WorldClocks, { cities, shuffleCities: false, rotateIntervalMs: 1000 }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    unmount();
    expect(clear).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
