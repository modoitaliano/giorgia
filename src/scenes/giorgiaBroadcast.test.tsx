import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fitGiorgiaText, useElementHeight, useElementWidth } from './giorgiaBroadcast.js';

// gaulatti/giorgia#74: the size helpers the on-air scenes fit their text with.

afterEach(() => vi.unstubAllGlobals());

class FakeObserver {
  static instances: FakeObserver[] = [];
  disconnected = false;
  constructor(readonly onResize: () => void) {
    FakeObserver.instances.push(this);
  }
  observe = vi.fn();
  disconnect() {
    this.disconnected = true;
  }
}

const element = (size: { clientWidth: number; clientHeight: number }) => {
  const node = document.createElement('div');
  Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => size.clientWidth });
  Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => size.clientHeight });
  return node;
};

it('fits text to the width, within the bounds, and never divides by an empty line', () => {
  expect(fitGiorgiaText('ABCD', 400, 104, 54, 0.5)).toBe(104);
  expect(fitGiorgiaText('A'.repeat(40), 560, 104, 54, 0.5)).toBe(54);
  expect(fitGiorgiaText('A'.repeat(10), 560, 104, 54, 0.5)).toBe(104);
  expect(fitGiorgiaText('A'.repeat(20), 400, 104, 20, 0.5)).toBe(40);
  expect(fitGiorgiaText('', 100, 200, 10, 0.5)).toBe(200);
});

for (const [name, useSize, key] of [
  ['width', useElementWidth, 'clientWidth'],
  ['height', useElementHeight, 'clientHeight'],
] as const) {
  it(`reports an element's ${name}, 0 until it is measured, and follows it as it resizes`, () => {
    FakeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const size = { clientWidth: 0, clientHeight: 0 };
    size[key] = 120;
    const { result, unmount } = renderHook(() => useSize<HTMLDivElement>());
    expect(result.current[1]).toBe(0);
    act(() => result.current[0](element(size)));
    expect(result.current[1]).toBe(120);
    size[key] = 300;
    act(() => FakeObserver.instances[0].onResize());
    expect(result.current[1]).toBe(300);
    unmount();
    expect(FakeObserver.instances[0].disconnected).toBe(true);
  });

  it(`measures the ${name} once, without watching, where the browser has no ResizeObserver`, () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const size = { clientWidth: 0, clientHeight: 0 };
    size[key] = 77;
    const { result } = renderHook(() => useSize<HTMLDivElement>());
    act(() => result.current[0](element(size)));
    expect(result.current[1]).toBe(77);
  });

  it(`keeps the ${name} at 0 when there is no element`, () => {
    const { result } = renderHook(() => useSize<HTMLDivElement>());
    act(() => result.current[0](null));
    expect(result.current[1]).toBe(0);
  });
}
