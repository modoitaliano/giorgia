// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSSE } from './useSSE.js';

const encoder = new TextEncoder();

function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    body,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

const okResponse = (body: ReadableStream<Uint8Array> | null) => ({ ok: true, status: 200, body });

const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

let log: ReturnType<typeof vi.spyOn>;
let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSSE', () => {
  it('stays idle without opening a connection when disabled', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
    const { result } = renderHook(() => useSSE({ url: '/stream', enabled: false }));
    await settle(10_000);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(result.current).toEqual({ isConnected: false, error: null });
  });

  it('connects without caching, reports the connection and delivers parsed messages', async () => {
    const stream = openStream();
    const fetchStub = vi.fn().mockResolvedValue(okResponse(stream.body));
    vi.stubGlobal('fetch', fetchStub);
    const onMessage = vi.fn();
    const { result } = renderHook(() => useSSE({ url: '/stream', onMessage }));
    await settle();

    expect(fetchStub).toHaveBeenCalledOnce();
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe('/stream');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result.current).toEqual({ isConnected: true, error: null });

    stream.push('data: {"type":"one","n":1}\n');
    await settle();
    expect(onMessage).toHaveBeenCalledWith({ type: 'one', n: 1 });
  });

  it('reassembles messages split across chunks and ignores noise', async () => {
    const stream = openStream();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(stream.body)));
    const onMessage = vi.fn();
    renderHook(() => useSSE({ url: '/stream', onMessage }));
    await settle();

    stream.push('data: {"type":"sp');
    await settle();
    expect(onMessage).not.toHaveBeenCalled();
    stream.push('lit"}\n\n: comment\nevent: ping\ndata: [DONE]\ndata: not json\n  \ndata: {"type":"two"}\ndata: {"type":"tail"}');
    await settle();
    // the unterminated last line stays buffered until its newline arrives
    expect(onMessage.mock.calls.map(([m]) => m.type)).toEqual(['split', 'two']);
    stream.push('\n');
    await settle();
    expect(onMessage.mock.calls.map(([m]) => m.type)).toEqual(['split', 'two', 'tail']);
  });

  it('delivers to the latest callback without reconnecting', async () => {
    const stream = openStream();
    const fetchStub = vi.fn().mockResolvedValue(okResponse(stream.body));
    vi.stubGlobal('fetch', fetchStub);
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useSSE({ url: '/stream', onMessage: cb }), { initialProps: { cb: first } });
    await settle();
    rerender({ cb: second });
    stream.push('data: {"type":"x"}\n');
    await settle();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it('tolerates messages when no callback is given', async () => {
    const stream = openStream();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(stream.body)));
    const { result } = renderHook(() => useSSE({ url: '/stream' }));
    await settle();
    stream.push('data: {"type":"x"}\n');
    await settle();
    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('reports an HTTP failure and retries after the reconnect interval', async () => {
    const stream = openStream();
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, body: null })
      .mockResolvedValueOnce(okResponse(stream.body));
    vi.stubGlobal('fetch', fetchStub);
    const { result } = renderHook(() => useSSE({ url: '/stream', reconnectInterval: 1000 }));
    await settle();

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error?.message).toBe('SSE fetch failed: 503');
    expect(errorLog).toHaveBeenCalled();

    await settle(999);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ isConnected: true, error: null });
  });

  it('uses a three second reconnect interval by default', async () => {
    const fetchStub = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchStub);
    renderHook(() => useSSE({ url: '/stream' }));
    await settle();
    await settle(2999);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    await settle(1);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('reports a response without a body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(null)));
    const { result } = renderHook(() => useSSE({ url: '/stream' }));
    await settle();
    expect(result.current.error?.message).toBe('SSE response has no body');
  });

  it('wraps non-Error failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue({ name: 'Weird', toString: () => 'odd failure' }));
    const { result } = renderHook(() => useSSE({ url: '/stream' }));
    await settle();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('odd failure');
  });

  it('reconnects after the stream ends and clears a previous error', async () => {
    const first = openStream();
    const second = openStream();
    const fetchStub = vi
      .fn()
      .mockRejectedValueOnce(new Error('first attempt failed'))
      .mockResolvedValueOnce(okResponse(first.body))
      .mockResolvedValueOnce(okResponse(second.body));
    vi.stubGlobal('fetch', fetchStub);
    const { result } = renderHook(() => useSSE({ url: '/stream', reconnectInterval: 500 }));
    await settle();
    expect(result.current.error?.message).toBe('first attempt failed');
    await settle(500);
    expect(result.current).toEqual({ isConnected: true, error: null });

    first.close();
    await settle();
    expect(fetchStub).toHaveBeenCalledTimes(2);
    await settle(500);
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  it('treats an aborted request as quiet and still schedules a reconnect', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchStub = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal('fetch', fetchStub);
    const { result } = renderHook(() => useSSE({ url: '/stream', reconnectInterval: 100 }));
    await settle();
    expect(result.current.error).toBeNull();
    expect(errorLog).not.toHaveBeenCalled();
    await settle(100);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('closes the stream, aborts the request and stops reconnecting on unmount', async () => {
    const stream = openStream();
    let signal!: AbortSignal;
    const fetchStub = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return okResponse(stream.body);
    });
    vi.stubGlobal('fetch', fetchStub);
    const { unmount } = renderHook(() => useSSE({ url: '/stream', reconnectInterval: 100 }));
    await settle();
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
    await settle(1000);
    expect(fetchStub).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a pending reconnect on unmount', async () => {
    const fetchStub = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchStub);
    const { unmount } = renderHook(() => useSSE({ url: '/stream', reconnectInterval: 5000 }));
    await settle();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await settle(10_000);
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it('ignores a failure that lands after unmount', async () => {
    let rejectFetch!: (error: Error) => void;
    const fetchStub = vi.fn().mockReturnValue(new Promise((_, reject) => (rejectFetch = reject)));
    vi.stubGlobal('fetch', fetchStub);
    const { result, unmount } = renderHook(() => useSSE({ url: '/stream', reconnectInterval: 100 }));
    await settle();
    unmount();
    rejectFetch(new Error('late'));
    await settle(1000);
    expect(result.current.error).toBeNull();
    expect(errorLog).not.toHaveBeenCalled();
    expect(fetchStub).toHaveBeenCalledOnce();
  });

  it('survives a reader that throws while being cancelled', async () => {
    const reader = {
      read: vi.fn().mockReturnValue(new Promise(() => {})),
      cancel: vi.fn(() => {
        throw new Error('cannot cancel');
      }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ getReader: () => reader } as unknown as ReadableStream<Uint8Array>)));
    const { unmount } = renderHook(() => useSSE({ url: '/stream' }));
    await settle();
    expect(() => unmount()).not.toThrow();
    expect(reader.cancel).toHaveBeenCalledOnce();
  });

  it('drops the connection state when disabled after connecting', async () => {
    const stream = openStream();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(stream.body)));
    const { result, rerender } = renderHook(({ enabled }) => useSSE({ url: '/stream', enabled }), { initialProps: { enabled: true } });
    await settle();
    expect(result.current.isConnected).toBe(true);
    rerender({ enabled: false });
    await settle();
    expect(result.current).toEqual({ isConnected: false, error: null });
  });

  it('logs the connection and each message type', async () => {
    const stream = openStream();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(stream.body)));
    renderHook(() => useSSE({ url: '/stream' }));
    await settle();
    stream.push('data: {"type":"hello"}\n');
    await settle();
    expect(log).toHaveBeenCalledWith('[SSE] connected to', '/stream');
    expect(log).toHaveBeenCalledWith('[SSE] message:', 'hello');
  });
});
