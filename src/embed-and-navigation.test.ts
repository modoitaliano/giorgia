import { readFileSync } from 'node:fs';
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

  it('yields no URL for the removed SofaScore providers (gaulatti/ariston#217)', () => {
    expect(embed('{{embedUrl "sofascore-widget" id="1" widgetTheme="dark"}}')).toBe('');
    expect(embed('{{embedUrl "sofascore-match" id="1"}}')).toBe('');
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

    // client/ sits outside the tsconfig rootDir (src); the module is only loaded here to exercise its hooks.
    // @ts-ignore TS6059 is a program-level diagnostic
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

// gaulatti/giorgia#64 (contract C1-C4): the Angelina poll block frames the embed page and links the poll page.
describe('angelinaPoll block', () => {
  // The renderer initializes Handlebars once per module instance, so each test loads a fresh one.
  const freshRenderer = async () => {
    vi.resetModules();
    return import('./renderer.core.js');
  };
  const partialSource = readFileSync(new URL('./templates/partials/blocks/angelina-poll.hbs', import.meta.url), 'utf8');

  it('frames the embed page for a valid slug and links the public poll page', async () => {
    const core = await freshRenderer();
    core.initializeHandlebars({ ...assets, partials: { 'blocks/angelina-poll': partialSource } });
    const html = Handlebars.compile('{{> angelinaPoll}}')({ slug: 'elecciones-2026-a1b2c3' });
    expect(html).toContain("src='https://angelina.gaulatti.com/embed/poll/elecciones-2026-a1b2c3'");
    expect(html).toContain("title='Sondaggio'");
    expect(html).toContain("loading='lazy'");
    expect(html).toContain("sandbox='allow-scripts allow-same-origin allow-forms allow-popups'");
    expect(html).not.toMatch(/\sallow=/);
    expect(html).toContain("href='https://angelina.gaulatti.com/poll/elecciones-2026-a1b2c3'");
  });

  it('fails the render for a slug outside contract C2', async () => {
    const core = await freshRenderer();
    core.initializeHandlebars({ ...assets, partials: { 'blocks/angelina-poll': partialSource } });
    const template = Handlebars.compile('{{> angelinaPoll}}');
    expect(() => template({ slug: 'Not A Slug' })).toThrow('parameter slug is not a valid value');
    expect(() => template({ slug: 'a--b' })).toThrow('parameter slug is not a valid value');
    expect(() => template({ slug: '../other' })).toThrow('parameter slug is not a valid value');
  });

  it('builds the embed and link urls from the slug alone', async () => {
    const core = await freshRenderer();
    core.initializeHandlebars(assets);
    expect(Handlebars.compile('{{embedUrl "angelina-poll" slug="abc-1"}}', { noEscape: true })({})).toBe('https://angelina.gaulatti.com/embed/poll/abc-1');
    expect(Handlebars.compile('{{embedUrl "angelina-poll-link" slug="abc-1"}}', { noEscape: true })({})).toBe('https://angelina.gaulatti.com/poll/abc-1');
  });
});
