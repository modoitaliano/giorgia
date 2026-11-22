import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { distributeHomepageArticles } from './homepage-distributor.js';
import { render } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

// modoitaliano/giorgia#60: the header's twelve slide images were all in the
// markup and every page downloaded all of them (19.4 MB). Only the first is
// now; the others are fetched one at a time, just before they show.
const page: CanonicalArticle = {
  id: 'header-fixture',
  slug: '/',
  canonicalUrl: 'https://modoitaliano.fm/',
  layout: 'homepage',
  contentVersion: '2026-11-22T12:00:00.000Z',
  publishedAt: '2026-11-22T12:00:00.000Z',
  updatedAt: '2026-11-22T12:00:00.000Z',
  status: 'published',
  title: 'Header fixture',
  excerpt: 'A fixture.',
  language: 'es',
  featured: false,
  authors: [{ name: 'Redacción', slug: 'redaccion' }],
  categories: [{ name: 'Noticias', slug: 'noticias' }],
  navigation: { categories: [{ name: 'Noticias', slug: 'noticias' }] },
  articles: [],
  body: [],
  homepageSlots: distributeHomepageArticles([], new Date('2026-11-22T12:00:00.000Z'), false),
  showHero: false,
  showEditorialHero: false,
  showBreakingNews: false,
  showLanding: false,
  showMustRead: false,
  showMoreStories: false,
} as CanonicalArticle;

const html = render(page);
const slideTags = html.match(/<div data-radio-slide[^>]*><\/div>/g) ?? [];
const rotation = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((code) => code.includes('data-radio-slide'))!;

describe('header slide markup', () => {
  it('has twelve slides and only the first carries an image', () => {
    expect(slideTags).toHaveLength(12);
    const withImage = slideTags.filter((tag) => tag.includes('background-image'));
    expect(withImage).toHaveLength(1);
    expect(withImage[0]).toContain('is-active');
    expect(withImage[0]).toContain('opacity: 1');
    expect(html.match(/background-image: url\(https:\/\/macondostack/g)).toHaveLength(1);
  });

  it('keeps the other eleven image URLs in data-bg, hidden, with the same fade', () => {
    const deferred = slideTags.filter((tag) => !tag.includes('background-image'));
    expect(deferred).toHaveLength(11);
    for (const tag of deferred) {
      expect(tag).toMatch(/data-bg='https:\/\/macondostack-alcantara-assets\.s3\.amazonaws\.com\/artwork\/[^']+\.avif'/);
      expect(tag).toContain("style='opacity: 0; transition: opacity 1200ms ease-in-out;'");
      expect(tag).not.toContain('is-active');
    }
    expect(new Set(slideTags.map((tag) => tag.match(/(?:data-bg='|url\()([^')]+)/)?.[1])).size).toBe(12);
  });
});

type Slide = { dataset: { bg?: string }; style: { opacity?: string; backgroundImage?: string }; classList: { add(name: string): void; remove(name: string): void }; classes: Set<string> };

function harness(options: { reduced?: boolean; connection?: { saveData?: boolean; effectiveType?: string }; hidden?: boolean; failing?: Set<string>; hold?: boolean } = {}) {
  const slides: Slide[] = Array.from({ length: 12 }, (_, index) => {
    const classes = new Set<string>(index === 0 ? ['is-active'] : []);
    return {
      dataset: index === 0 ? {} : { bg: `https://img.example.test/${index}.avif` },
      style: index === 0 ? { opacity: '1', backgroundImage: 'url(https://img.example.test/0.avif)' } : { opacity: '0' },
      classes,
      classList: { add: (name: string) => void classes.add(name), remove: (name: string) => void classes.delete(name) },
    };
  });
  const fetched: string[] = [];
  const intervals: Array<() => unknown> = [];
  const timeouts: Array<() => unknown> = [];
  const listeners: Record<string, () => unknown> = {};
  class FakeImage {
    onload: () => void = () => undefined;
    onerror: () => void = () => undefined;
    set src(value: string) {
      fetched.push(value);
      if (options.hold) return;
      queueMicrotask(() => (options.failing?.has(value) ? this.onerror() : this.onload()));
    }
  }
  const document = { hidden: options.hidden === true, querySelectorAll: () => slides };
  const window = {
    matchMedia: () => ({ matches: options.reduced === true }),
    setInterval: (callback: () => unknown) => void intervals.push(callback),
    setTimeout: (callback: () => unknown) => void timeouts.push(callback),
    addEventListener: (name: string, callback: () => unknown) => void (listeners[name] = callback),
  };
  new Function('window', 'document', 'navigator', 'Image', rotation)(window, document, { connection: options.connection }, FakeImage);
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { slides, fetched, intervals, timeouts, listeners, document, flush };
}

describe('header slide rotation script', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.restoreAllMocks());

  it('fetches nothing at start; after load it fetches only the next slide, and rotates to it once ready', async () => {
    const h = harness();
    expect(h.fetched).toEqual([]);
    h.listeners.load();
    h.timeouts.shift()!();
    await h.flush();
    expect(h.fetched).toEqual(['https://img.example.test/1.avif']);
    await h.intervals[0]();
    expect(h.slides[0].style.opacity).toBe('0');
    expect(h.slides[0].classes.has('is-active')).toBe(false);
    expect(h.slides[1].style.opacity).toBe('1');
    expect(h.slides[1].classes.has('is-active')).toBe(true);
    expect(h.slides[1].style.backgroundImage).toBe('url("https://img.example.test/1.avif")');
    // The slide after the new one is prepared a moment later, and only it.
    h.timeouts.shift()!();
    await h.flush();
    expect(h.fetched).toEqual(['https://img.example.test/1.avif', 'https://img.example.test/2.avif']);
    expect(h.slides.slice(3).every((slide) => !slide.style.backgroundImage)).toBe(true);
  });

  it('does not rotate to a slide whose image has not arrived', async () => {
    const h = harness({ hold: true });
    void h.intervals[0]();
    await h.flush();
    void h.intervals[0]();
    await h.flush();
    // The second tick does not start a second fetch while the first is outstanding.
    expect(h.fetched).toEqual(['https://img.example.test/1.avif']);
    expect(h.slides[0].classes.has('is-active')).toBe(true);
    expect(h.slides[0].style.opacity).toBe('1');
    expect(h.slides[1].style.backgroundImage).toBeUndefined();
  });

  it('wraps from the last slide to the first, which already has its image', async () => {
    const h = harness();
    for (let step = 0; step < 12; step += 1) {
      await h.intervals[0]();
      h.timeouts.splice(0).forEach((callback) => callback());
      await h.flush();
    }
    expect(h.slides[0].classes.has('is-active')).toBe(true);
    expect(new Set(h.fetched).size).toBe(11);
  });

  it.each([
    ['reduced motion', { reduced: true }],
    ['data saver', { connection: { saveData: true } }],
    ['a 2g connection', { connection: { effectiveType: '2g' } }],
    ['a slow-2g connection', { connection: { effectiveType: 'slow-2g' } }],
  ])('does not rotate and fetches no other slide under %s', async (_name, options) => {
    const h = harness(options);
    expect(h.intervals).toHaveLength(0);
    expect(h.timeouts).toHaveLength(0);
    expect(Object.keys(h.listeners)).toHaveLength(0);
    expect(h.fetched).toEqual([]);
  });

  it('keeps rotating on a 4g connection and fetches nothing while the tab is hidden', async () => {
    const fast = harness({ connection: { saveData: false, effectiveType: '4g' } });
    expect(fast.intervals).toHaveLength(1);
    const hidden = harness({ hidden: true });
    await hidden.intervals[0]();
    expect(hidden.fetched).toEqual([]);
    expect(hidden.slides[0].classes.has('is-active')).toBe(true);
  });

  it('does not show a blank slide when an image fails to load, and fetches it again on the next tick', async () => {
    const failing = new Set(['https://img.example.test/1.avif']);
    const h = harness({ failing });
    await h.intervals[0]();
    await h.flush();
    expect(h.slides[0].classes.has('is-active')).toBe(true);
    expect(h.slides[1].classes.has('is-active')).toBe(false);
    failing.clear();
    await h.intervals[0]();
    expect(h.slides[1].classes.has('is-active')).toBe(true);
    expect(h.fetched.filter((url) => url.endsWith('/1.avif'))).toHaveLength(2);
  });
});
