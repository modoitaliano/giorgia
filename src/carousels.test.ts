import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCarousels } from './carousels.js';

type Listener = () => void;

class FakeEl {
  classes = new Set<string>();
  dataset: Record<string, string> = {};
  listeners: Record<string, Listener[]> = {};
  children: Record<string, FakeEl[]> = {};
  __brokawCarouselTimer?: number;
  classList = {
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force: boolean) => {
      if (force) this.classes.add(name);
      else this.classes.delete(name);
    },
  };
  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ??= []).push(fn);
  }
  fire(type: string) {
    (this.listeners[type] ?? []).forEach((fn) => fn());
  }
  querySelectorAll(selector: string) {
    return this.children[selector] ?? [];
  }
  querySelector(selector: string) {
    return (this.children[selector] ?? [])[0] ?? null;
  }
}

function buildScope(slideCount: number, activeIndex = -1, withNext = true) {
  const scope = new FakeEl();
  const slides = Array.from({ length: slideCount }, () => new FakeEl());
  if (activeIndex >= 0) slides[activeIndex].classes.add('active');
  const dots = Array.from({ length: slideCount }, () => new FakeEl());
  const next = new FakeEl();
  scope.children['.carousel-slide'] = slides;
  scope.children['.carousel-dot'] = dots;
  if (withNext) scope.children['.carousel-next'] = [next];
  return { scope, slides, dots, next };
}

const root = (scopes: FakeEl[]) => ({ querySelectorAll: () => scopes }) as unknown as ParentNode;
const activeOf = (slides: FakeEl[]) => slides.findIndex((s) => s.classes.has('active'));

let attached: Set<FakeEl>;

beforeEach(() => {
  vi.useFakeTimers();
  attached = new Set();
  vi.stubGlobal('window', {
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms) as unknown as number,
    clearInterval: (id: number) => clearInterval(id),
  });
  vi.stubGlobal('document', { contains: (el: FakeEl) => attached.has(el) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('initCarousels', () => {
  it('marks a carousel without slides as bound and does nothing else', () => {
    const { scope } = buildScope(0);
    initCarousels(root([scope]));
    expect(scope.dataset.carouselBound).toBe('true');
    expect(scope.listeners.mouseenter).toBeUndefined();
  });

  it('skips scopes that are already bound', () => {
    const { scope, slides } = buildScope(2);
    scope.dataset.carouselBound = 'true';
    initCarousels(root([scope]));
    expect(slides[0].classes.has('active')).toBe(false);
  });

  it('shows the first slide by default and respects a pre-activated slide', () => {
    const first = buildScope(3);
    const preset = buildScope(3, 2);
    attached.add(first.scope).add(preset.scope);
    initCarousels(root([first.scope, preset.scope]));
    expect(activeOf(first.slides)).toBe(0);
    expect(first.slides[1].classes.has('hidden')).toBe(true);
    expect(first.slides[0].classes.has('opacity-100')).toBe(true);
    expect(first.slides[1].classes.has('opacity-0')).toBe(true);
    expect(first.dots[0].classes.has('active')).toBe(true);
    expect(activeOf(preset.slides)).toBe(2);
    expect(preset.dots[2].classes.has('active')).toBe(true);
  });

  it('advances on the timer and wraps around', () => {
    const { scope, slides } = buildScope(2);
    attached.add(scope);
    initCarousels(root([scope]));
    vi.advanceTimersByTime(6000);
    expect(activeOf(slides)).toBe(1);
    vi.advanceTimersByTime(6000);
    expect(activeOf(slides)).toBe(0);
  });

  it('stops advancing once the scope leaves the document', () => {
    const { scope, slides } = buildScope(2);
    attached.add(scope);
    initCarousels(root([scope]));
    attached.delete(scope);
    vi.advanceTimersByTime(6000);
    expect(activeOf(slides)).toBe(0);
    expect(scope.__brokawCarouselTimer).toBeUndefined();
    vi.advanceTimersByTime(12000);
    expect(activeOf(slides)).toBe(0);
  });

  it('does not start a timer for a single slide', () => {
    const { scope } = buildScope(1);
    initCarousels(root([scope]));
    expect(scope.__brokawCarouselTimer).toBeUndefined();
  });

  it('jumps to a dot, advances with the next button and restarts the timer', () => {
    const { scope, slides, dots, next } = buildScope(3);
    attached.add(scope);
    initCarousels(root([scope]));
    dots[2].fire('click');
    expect(activeOf(slides)).toBe(2);
    next.fire('click');
    expect(activeOf(slides)).toBe(0);
    vi.advanceTimersByTime(6000);
    expect(activeOf(slides)).toBe(1);
  });

  it('works without a next button', () => {
    const { scope, slides } = buildScope(2, -1, false);
    attached.add(scope);
    initCarousels(root([scope]));
    vi.advanceTimersByTime(6000);
    expect(activeOf(slides)).toBe(1);
  });

  it('pauses on mouseenter and resumes on mouseleave', () => {
    const { scope, slides } = buildScope(2);
    attached.add(scope);
    initCarousels(root([scope]));
    scope.fire('mouseenter');
    vi.advanceTimersByTime(12000);
    expect(activeOf(slides)).toBe(0);
    scope.fire('mouseleave');
    vi.advanceTimersByTime(6000);
    expect(activeOf(slides)).toBe(1);
  });

  it('defaults to document when no root is given', () => {
    const scopes = [] as FakeEl[];
    (globalThis as unknown as { document: unknown }).document = { querySelectorAll: () => scopes, contains: () => true };
    expect(() => initCarousels()).not.toThrow();
  });
});
