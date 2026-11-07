// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlaylistEngine } from './usePlaylistEngine.js';
import type { Segment } from './types.js';

const segment = (id: string, itemCount: number, extra: Partial<Segment> = {}): Segment => ({
  id,
  label: id,
  itemCount,
  durationMsPerItem: 1000,
  render: () => null,
  ...extra,
});

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

// With 1000 ms per item and a 100 ms interval progress grows by 10 per tick, so
// ten ticks reach 100 and the eleventh moves to the next item.
const ITEM_MS = 1100;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePlaylistEngine', () => {
  it('starts on the first item of the first segment', () => {
    const segments = [segment('a', 2), segment('b', 1)];
    const { result } = renderHook(() => usePlaylistEngine({ segments }));
    expect(result.current.state).toEqual({ currentSegmentIndex: 0, currentItemIndex: 0, progress: 0, isPaused: false });
    expect(result.current.currentSegment?.id).toBe('a');
  });

  it('has no current segment and no timer for an empty playlist', () => {
    const { result } = renderHook(() => usePlaylistEngine({ segments: [] }));
    expect(result.current.currentSegment).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.advanceToNext());
    expect(result.current.state.currentSegmentIndex).toBe(0);
  });

  it('advances progress every update interval', () => {
    const segments = [segment('a', 2)];
    const { result } = renderHook(() => usePlaylistEngine({ segments }));
    tick(300);
    expect(result.current.state.progress).toBeCloseTo(30);
  });

  it('moves to the next item once progress is complete, then to the next segment', () => {
    const segments = [segment('a', 2), segment('b', 1)];
    const { result } = renderHook(() => usePlaylistEngine({ segments }));
    tick(ITEM_MS);
    expect(result.current.state).toMatchObject({ currentSegmentIndex: 0, currentItemIndex: 1, progress: 0 });
    tick(ITEM_MS);
    expect(result.current.state).toMatchObject({ currentSegmentIndex: 1, currentItemIndex: 0, progress: 0 });
    expect(result.current.currentSegment?.id).toBe('b');
  });

  it('honours custom durations and the default duration for segments without one', () => {
    const slow = segment('slow', 1, { durationMsPerItem: 0 });
    const { result } = renderHook(() => usePlaylistEngine({ segments: [slow, segment('b', 1)], defaultDurationMs: 2000, updateIntervalMs: 200 }));
    tick(200);
    expect(result.current.state.progress).toBeCloseTo(10);
    tick(2000);
    expect(result.current.state.currentSegmentIndex).toBe(1);
  });

  it('defaults to ten second items updated every 100 ms', () => {
    const { result } = renderHook(() => usePlaylistEngine({ segments: [segment('a', 1, { durationMsPerItem: 0 })] }));
    tick(100);
    expect(result.current.state.progress).toBeCloseTo(1);
  });

  it('pauses, resumes and resets', () => {
    const segments = [segment('a', 3)];
    const { result } = renderHook(() => usePlaylistEngine({ segments }));
    tick(ITEM_MS);
    expect(result.current.state.currentItemIndex).toBe(1);

    act(() => result.current.pause());
    expect(result.current.state.isPaused).toBe(true);
    const frozen = result.current.state.progress;
    tick(5000);
    expect(result.current.state.progress).toBe(frozen);

    act(() => result.current.resume());
    expect(result.current.state.isPaused).toBe(false);
    tick(200);
    expect(result.current.state.progress).toBeGreaterThan(frozen);

    act(() => result.current.reset());
    expect(result.current.state).toEqual({ currentSegmentIndex: 0, currentItemIndex: 0, progress: 0, isPaused: false });
  });

  it('skips ahead immediately with advanceToNext, crossing segments', () => {
    const segments = [segment('a', 2), segment('b', 1)];
    const { result } = renderHook(() => usePlaylistEngine({ segments }));
    act(() => result.current.advanceToNext());
    expect(result.current.state).toMatchObject({ currentSegmentIndex: 0, currentItemIndex: 1 });
    act(() => result.current.advanceToNext());
    expect(result.current.state).toMatchObject({ currentSegmentIndex: 1, currentItemIndex: 0 });
  });

  it('runs exit and enter hooks and prefetches the following segment on a segment change', () => {
    const onExitA = vi.fn();
    const onEnterB = vi.fn();
    const prefetchC = vi.fn().mockResolvedValue(undefined);
    const prefetchB = vi.fn().mockResolvedValue(undefined);
    const segments = [segment('a', 1, { onExit: onExitA, prefetch: prefetchB }), segment('b', 1, { onEnter: onEnterB }), segment('c', 1, { prefetch: prefetchC })];
    const { result } = renderHook(() => usePlaylistEngine({ segments }));
    expect(onExitA).not.toHaveBeenCalled();
    act(() => result.current.advanceToNext());
    expect(onExitA).toHaveBeenCalledOnce();
    expect(onEnterB).toHaveBeenCalledOnce();
    expect(prefetchC).toHaveBeenCalledOnce();
    expect(prefetchB).not.toHaveBeenCalled();
  });

  it('logs a failed prefetch without interrupting playback', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('network');
    const segments = [segment('a', 1), segment('b', 1, { prefetch: () => Promise.reject(failure) }), segment('c', 1)];
    const { result } = renderHook(() => usePlaylistEngine({ segments }));
    // a -> b prefetches c, b -> c prefetches a, c -> a prefetches the failing b
    act(() => result.current.advanceToNext());
    act(() => result.current.advanceToNext());
    act(() => result.current.advanceToNext());
    await act(async () => {
      await Promise.resolve();
    });
    expect(error).toHaveBeenCalledWith('[Playlist] Failed to prefetch b:', failure);
    expect(result.current.state.currentSegmentIndex).toBe(0);
  });

  it('calls the loop callback only when the playlist wraps back to its first segment', () => {
    const onPlaylistLoop = vi.fn();
    const segments = [segment('a', 1), segment('b', 1), segment('c', 1)];
    const { result } = renderHook(() => usePlaylistEngine({ segments, onPlaylistLoop }));
    act(() => result.current.advanceToNext());
    act(() => result.current.advanceToNext());
    expect(onPlaylistLoop).not.toHaveBeenCalled();
    act(() => result.current.advanceToNext());
    expect(onPlaylistLoop).toHaveBeenCalledOnce();
  });

  it('wraps a single segment playlist without reporting a segment change', () => {
    const onPlaylistLoop = vi.fn();
    const onEnter = vi.fn();
    const { result } = renderHook(() => usePlaylistEngine({ segments: [segment('only', 1, { onEnter })], onPlaylistLoop }));
    tick(ITEM_MS * 2);
    expect(result.current.state.currentSegmentIndex).toBe(0);
    expect(onEnter).not.toHaveBeenCalled();
    expect(onPlaylistLoop).not.toHaveBeenCalled();
  });

  it('copes with segments that lack hooks', () => {
    const { result } = renderHook(() => usePlaylistEngine({ segments: [segment('a', 1), segment('b', 1)] }));
    act(() => result.current.advanceToNext());
    expect(result.current.currentSegment?.id).toBe('b');
  });

  it('stays put when the current index no longer exists in the segment list', () => {
    const { result, rerender } = renderHook(({ segments }) => usePlaylistEngine({ segments }), {
      initialProps: { segments: [segment('a', 1), segment('b', 1)] },
    });
    act(() => result.current.advanceToNext());
    expect(result.current.state.currentSegmentIndex).toBe(1);
    rerender({ segments: [segment('a', 1)] });
    expect(result.current.currentSegment).toBeNull();
    const before = result.current.state;
    tick(5000);
    act(() => result.current.advanceToNext());
    expect(result.current.state).toEqual(before);
  });

  it('stops its timer on unmount', () => {
    const { unmount } = renderHook(() => usePlaylistEngine({ segments: [segment('a', 1)] }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
