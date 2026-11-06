import Handlebars from 'handlebars';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layoutNames } from './layouts.js';
import { initializeHandlebars, type RendererAssets } from './renderer.core.js';

const assets: RendererAssets = {
  layouts: Object.fromEntries(layoutNames.map((name) => [name, '<main></main>'])) as RendererAssets['layouts'],
  partials: {},
  styles: ''
};

describe('embedUrl helper', () => {
  initializeHandlebars(assets);
  const embed = (source: string) => Handlebars.compile(source, { noEscape: true })({});

  it('builds the URL of each supported provider', () => {
    expect(embed('{{embedUrl "spotify" kind="track" id="abc"}}')).toBe('https://open.spotify.com/embed/track/abc');
    expect(embed('{{embedUrl "tiktok" id="42"}}')).toBe('https://www.tiktok.com/embed/v2/42');
  });

  it('rejects the removed SofaScore providers', () => {
    expect(() => embed('{{embedUrl "sofascore-widget" id="1" widgetTheme="dark"}}')).toThrow('Unknown embed provider "sofascore-widget"');
    expect(() => embed('{{embedUrl "sofascore-match" id="1"}}')).toThrow('Unknown embed provider "sofascore-match"');
  });

  it('requires every provider parameter', () => {
    expect(() => embed('{{embedUrl "spotify" kind="track"}}')).toThrow('requires parameter id');
  });
});

describe('client navigation', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.doUnmock('swup');
  });

  it('hydrates the page on page:view without a SofaScore theme hook', async () => {
    const handlers: Record<string, () => void> = {};
    vi.doMock('swup', () => ({
      default: class {
        hooks = {
          before: (name: string, fn: () => void) => void (handlers[`before:${name}`] = fn),
          on: (name: string, fn: () => void) => void (handlers[name] = fn)
        };
      }
    }));
    vi.doMock('@swup/a11y-plugin', () => ({ default: class {} }));
    vi.doMock('@swup/head-plugin', () => ({ default: class {} }));
    vi.doMock('@swup/scripts-plugin', () => ({ default: class {} }));

    const page = { dataset: { pageLayout: 'article', pageId: 'p1', pageLanguage: 'es' } };
    const win: Record<string, unknown> = {
      __brokawHydrateRelativeTimes: vi.fn(),
      __brokawInitCarousels: vi.fn(),
      __brokawInitAnimatedHighlights: vi.fn(),
      __brokawPageCleanup: vi.fn(),
      gtag: vi.fn(),
      location: { href: 'https://example.test/', pathname: '/' }
    };
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { querySelector: () => page, title: 'T', documentElement: { lang: 'es' } });

    await import('../client/navigation.js');

    handlers['page:view']();
    expect(win.__brokawHydrateRelativeTimes).toHaveBeenCalledWith(page);
    expect(win.__brokawInitCarousels).toHaveBeenCalledWith(page);
    expect(win.__brokawInitAnimatedHighlights).toHaveBeenCalled();
    expect(win.gtag).toHaveBeenCalledTimes(2);
    expect('__brokawSyncSofascoreTheme' in win).toBe(false);

    const cleanup = win.__brokawPageCleanup as ReturnType<typeof vi.fn>;
    handlers['before:content:replace']();
    expect(cleanup).toHaveBeenCalled();
    expect(win.__brokawPageCleanup).toBeUndefined();
  });
});
