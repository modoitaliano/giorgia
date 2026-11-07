// @vitest-environment happy-dom
import { createElement as h, createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleSlide } from './ArticleSlide.js';
import { CallsignSlide } from './CallsignSlide.js';
import { LiveEventSlide } from './LiveEventSlide.js';
import { slideStyles } from './slideStyles.js';
import type { LiveEventData } from '../../segments/fetchLiveEvents.js';

const { getColor } = vi.hoisted(() => ({ getColor: vi.fn() }));
vi.mock('fast-average-color', () => ({
  FastAverageColor: class {
    getColor = getColor;
  },
}));

const originalTimeZone = process.env.TZ;

beforeEach(() => {
  process.env.TZ = 'UTC';
  getColor.mockReset();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

const decodeQr = (src: string) => decodeURIComponent(src.replace('data:image/svg+xml;charset=utf-8,', ''));

describe('slideStyles', () => {
  it('declares the keyframes and classes the slides rely on', () => {
    for (const name of ['kenburns', 'slideTransition', 'scaleIn', 'fadeIn', 'slideUpFade', 'marqueeFlow']) {
      expect(slideStyles).toContain(`@keyframes ${name}`);
    }
    for (const cls of ['animate-slide-transition', 'animate-scale-in', 'animate-fade-in', 'animate-fade-in-delay', 'animate-slide-up']) {
      expect(slideStyles).toContain(`.${cls}`);
    }
  });
});

describe('ArticleSlide', () => {
  const item = { id: '7', headline: 'Big headline', summary: 'Short summary', imageUrl: 'https://img.test/a.jpg', category: 'Science', url: 'https://modoitaliano.fm/a' };

  it('shows the headline, summary, category, progress and a QR code for the article', () => {
    const { container } = render(h(ArticleSlide, { newsItem: item, progress: 42 }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Big headline');
    expect(screen.getByText('Short summary')).toBeTruthy();
    expect(screen.getByText('Science')).toBeTruthy();
    expect(container.innerHTML).toContain('width: 42%');

    const photo = screen.getByAltText('Big headline') as HTMLImageElement;
    expect(photo.getAttribute('src')).toBe(item.imageUrl);
    const qr = screen.getByAltText('Article QR code') as HTMLImageElement;
    expect(qr.src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const svg = decodeQr(qr.getAttribute('src')!);
    expect(svg).toContain('<svg');
    expect(svg).toContain('fill="transparent"');
    expect(svg).toContain('fill="white"');
  });

  it('encodes a different QR code for a different article url', () => {
    const first = render(h(ArticleSlide, { newsItem: item, progress: 0 }));
    const firstQr = (screen.getByAltText('Article QR code') as HTMLImageElement).getAttribute('src');
    first.unmount();
    render(h(ArticleSlide, { newsItem: { ...item, url: 'https://modoitaliano.fm/other' }, progress: 0 }));
    expect((screen.getByAltText('Article QR code') as HTMLImageElement).getAttribute('src')).not.toBe(firstQr);
  });

  it('omits the category chip and falls back to a placeholder image when the item has none', () => {
    const { container } = render(h(ArticleSlide, { newsItem: { ...item, category: undefined, imageUrl: '' }, progress: 0 }));
    expect(screen.queryByText('Science')).toBeNull();
    for (const img of Array.from(container.querySelectorAll('img')).slice(0, 2)) {
      expect(img.getAttribute('src')).toBe('https://picsum.photos/seed/fallback/1920/1080');
    }
  });

  it('tints the slide with the dominant colour of the loaded image', () => {
    getColor.mockReturnValue({ hex: '#123456' });
    const { container } = render(h(ArticleSlide, { newsItem: item, progress: 0 }));
    const overlay = container.querySelector('.mix-blend-multiply') as HTMLElement;
    expect(overlay.style.background).toContain('#b21100');
    fireEvent.load(container.querySelector('img') as HTMLImageElement);
    expect(getColor).toHaveBeenCalledOnce();
    expect(overlay.style.background).toContain('#123456');
  });

  it('keeps the default tint and logs when the colour cannot be read', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getColor.mockImplementation(() => {
      throw new Error('tainted canvas');
    });
    const { container } = render(h(ArticleSlide, { newsItem: item, progress: 0 }));
    fireEvent.load(container.querySelector('img') as HTMLImageElement);
    expect(error).toHaveBeenCalledWith('Error getting average color', expect.any(Error));
    expect((container.querySelector('.mix-blend-multiply') as HTMLElement).style.background).toContain('#b21100');
  });
});

describe('CallsignSlide', () => {
  const start = new Date('2026-03-11T15:30:45Z');
  const props = { currentTime: start, audioRef: createRef<HTMLAudioElement>() };
  const timeNode = (container: HTMLElement) => container.querySelector('.animate-fade-in-delay') as HTMLElement;

  it('introduces the brand mark first and reveals the New York time and tagline after the intro', () => {
    const { container } = render(h(CallsignSlide, props));
    expect(timeNode(container).style.opacity).toBe('0');
    expect(timeNode(container).textContent).toBe('11:30:45');
    expect(container.textContent).toContain('This is fifthbell.');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timeNode(container).style.opacity).toBe('0');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(timeNode(container).style.opacity).toBe('1');
  });

  it('fades the large bell out and the corner bell in after two seconds', () => {
    const { container } = render(h(CallsignSlide, props));
    const large = container.querySelector('.animate-scale-in') as HTMLElement;
    const corner = container.querySelector('.top-4') as HTMLElement;
    expect([large.style.opacity, corner.style.opacity]).toEqual(['1', '0']);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect([large.style.opacity, corner.style.opacity]).toEqual(['0', '1']);
  });

  it('advances the clock every second from the real time', () => {
    vi.setSystemTime(start);
    const { container } = render(h(CallsignSlide, props));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(timeNode(container).textContent).toBe('11:30:46');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timeNode(container).textContent).toBe('11:30:48');
  });

  it('adopts a new starting time and stops ticking when unmounted', () => {
    const view = render(h(CallsignSlide, props));
    view.rerender(h(CallsignSlide, { ...props, currentTime: new Date('2026-03-11T20:00:00Z') }));
    expect(timeNode(view.container).textContent).toBe('16:00:00');
    view.unmount();
    expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
  });

  it('tints from the background image and resets the tint when the colour cannot be read', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(h(CallsignSlide, props));
    const overlay = container.querySelector('.mix-blend-multiply') as HTMLElement;
    const image = container.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('./modoitaliano/images/nyc.jpg');

    getColor.mockReturnValueOnce({ hex: '#00ff00' });
    fireEvent.load(image);
    expect(overlay.style.background).toContain('#00ff00');

    getColor.mockImplementationOnce(() => {
      throw new Error('tainted canvas');
    });
    fireEvent.load(image);
    expect(error).toHaveBeenCalledOnce();
    expect(overlay.style.background).toContain('#b21100');
  });
});

describe('LiveEventSlide', () => {
  const update = (n: number, extra: Record<string, unknown> = {}) => ({ time: `10:0${n}`, text: `Update ${n}`, ...extra });
  const event = (updates: LiveEventData['updates'], extra: Partial<LiveEventData> = {}): LiveEventData => ({
    category: 'POLITICA',
    title: 'Live title',
    excerpt: 'Live excerpt',
    image: 'https://img.test/live.jpg',
    alt: 'alt',
    url: 'https://modoitaliano.fm/story',
    liveUrl: 'https://modoitaliano.fm/live',
    updatedAt: '2026-03-11T00:00:00.000Z',
    updates,
    ...extra,
  });
  const renderSlide = (data: LiveEventData, language: 'en' | 'es' | 'it' = 'en') => render(h(LiveEventSlide, { event: data, progress: 0, language }));

  it('shows the event header, excerpt and its update timeline', () => {
    renderSlide(event([update(1), update(2)]));
    expect(screen.getByText('EN VIVO')).toBeTruthy();
    expect(screen.getByText('POLITICA')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Live title');
    expect(screen.getByText('Live excerpt')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('ACTUALIZACIONES EN VIVO');
    expect(screen.getByText('Update 1')).toBeTruthy();
    expect(screen.getByText('Update 2')).toBeTruthy();
    expect(screen.getByText('10:01')).toBeTruthy();
  });

  it('omits the excerpt when absent and says so when there are no updates', () => {
    renderSlide(event([], { excerpt: undefined }));
    expect(screen.queryByText('Live excerpt')).toBeNull();
    expect(screen.getByText('No updates yet')).toBeTruthy();
    cleanup();
    renderSlide(event([]), 'it');
    expect(screen.getByText('Nessun aggiornamento')).toBeTruthy();
  });

  it('formats update times from a timestamp, falls back to the label, and hides the time when neither exists', () => {
    renderSlide(event([update(1, { timestamp: '2026-03-11T09:05:00Z' }), { text: 'No time at all' }]));
    // timestamp wins over the label, 24 hour clock
    expect(screen.getByText('09:05')).toBeTruthy();
    expect(screen.queryByText('10:01')).toBeNull();
    expect(screen.getByText('No time at all').parentElement!.querySelectorAll('span')).toHaveLength(0);
  });

  it('renders html updates as plain text and skips updates with no body', () => {
    renderSlide(event([{ time: '11:00', html: '<p>Hello <a href="/x">linked</a> <img src="x.png"/>world</p>' }, { time: '11:01' }]));
    expect(screen.getByText('Hello linked world')).toBeTruthy();
    expect(document.querySelector('a')).toBeNull();
    // the body-less update still shows its time
    expect(screen.getByText('11:01')).toBeTruthy();
  });

  it('scrolls through the updates four at a time when there are more than four', () => {
    const updates = [1, 2, 3, 4, 5, 6].map((n) => update(n));
    renderSlide(event(updates));
    const texts = () => Array.from(document.querySelectorAll('p')).map((p) => p.textContent).filter((text) => text?.startsWith('Update'));
    expect(texts()).toEqual(['Update 1', 'Update 2', 'Update 3', 'Update 4']);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(texts()).toEqual(['Update 2', 'Update 3', 'Update 4', 'Update 5']);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(texts()).toEqual(['Update 4', 'Update 5', 'Update 6', 'Update 1']);
  });

  it('does not cycle with four or fewer updates and clears the cycle timer on unmount', () => {
    const view = renderSlide(event([1, 2, 3, 4].map((n) => update(n))));
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByText('Update 1')).toBeTruthy();
    view.unmount();
    cleanup();
    const long = renderSlide(event([1, 2, 3, 4, 5].map((n) => update(n))));
    expect(vi.getTimerCount()).toBe(1);
    long.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('encodes the live url in the QR code, or the story url when there is no live url', () => {
    const withLive = renderSlide(event([]));
    const liveQr = (screen.getByAltText('QR code') as HTMLImageElement).getAttribute('src');
    expect(decodeQr(liveQr!)).toContain('<svg');
    withLive.unmount();
    renderSlide(event([], { liveUrl: undefined }));
    const storyQr = (screen.getByAltText('QR code') as HTMLImageElement).getAttribute('src');
    expect(storyQr).not.toBe(liveQr);
    cleanup();
    renderSlide(event([], { liveUrl: undefined, url: 'https://modoitaliano.fm/live' }));
    expect((screen.getByAltText('QR code') as HTMLImageElement).getAttribute('src')).toBe(liveQr);
  });

  it('tints from the event image and keeps the default tint when the colour cannot be read', () => {
    const { container } = renderSlide(event([]));
    const overlay = container.querySelector('.mix-blend-multiply') as HTMLElement;
    const image = container.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://img.test/live.jpg');
    getColor.mockReturnValueOnce({ hex: '#0000ff' });
    fireEvent.load(image);
    expect(overlay.style.background).toContain('#0000ff');
    getColor.mockImplementationOnce(() => {
      throw new Error('tainted canvas');
    });
    fireEvent.load(image);
    expect(overlay.style.background).toContain('#b21100');
  });
});
