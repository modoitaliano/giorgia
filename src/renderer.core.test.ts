import Handlebars from 'handlebars';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layoutNames } from './layouts.js';
import type { RendererAssets } from './renderer.core.js';

function assets(overrides: Partial<RendererAssets['partials']> = {}, layoutBody = 'LAYOUT'): RendererAssets {
  return {
    layouts: Object.fromEntries(layoutNames.map((name) => [name, `${layoutBody}:${name}`])) as RendererAssets['layouts'],
    partials: { 'blocks/rich-text': 'RICH', 'blocks/heading': 'HEAD', ...overrides },
    styles: '',
  };
}

async function freshCore() {
  vi.resetModules();
  return import('./renderer.core.js');
}

const helper = (name: string) => Handlebars.helpers[name] as (...args: unknown[]) => unknown;

afterEach(() => {
  vi.doUnmock('./types/canonical-article.js');
  vi.resetModules();
});

describe('renderer.core initialisation', () => {
  it('registers partials, body aliases only for present sources, and initialises once', async () => {
    const core = await freshCore();
    core.initializeHandlebars(assets());
    expect(Handlebars.partials['blocks/rich-text']).toBe('RICH');
    expect(Handlebars.partials.richText).toBe('RICH');
    expect(Handlebars.partials.heading).toBe('HEAD');
    expect(Handlebars.partials.pullQuote).not.toBe('PULL');

    core.initializeHandlebars(assets({ 'blocks/rich-text': 'CHANGED' }));
    expect(Handlebars.partials['blocks/rich-text']).toBe('RICH');
  });

  it('initialises lazily on first render and rejects unknown or missing layouts', async () => {
    const core = await freshCore();
    expect(() => core.renderWithAssets({ layout: 'nope' } as never, assets())).toThrow(/Unknown layout "nope"/);
    expect(() => core.renderWithAssets({} as never, assets())).toThrow(/Unknown layout "undefined"/);
  });

  it('rejects a layout whose compiled template disappears after validation', async () => {
    vi.resetModules();
    vi.doMock('./types/canonical-article.js', () => ({
      canonicalArticleSchema: { parse: () => ({ layout: 'not-compiled' }) },
    }));
    const core = await import('./renderer.core.js');
    expect(() => core.renderWithAssets({ layout: 'homepage' } as never, assets())).toThrow('Layout template missing for "not-compiled"');
  });

  it('strips removed block types before validation and keeps other body entries', async () => {
    let seen: unknown;
    vi.resetModules();
    vi.doMock('./types/canonical-article.js', () => ({
      canonicalArticleSchema: {
        parse: (input: unknown) => {
          seen = input;
          return { layout: 'homepage' };
        },
      },
    }));
    const core = await import('./renderer.core.js');
    const body = [null, 'text', { type: 'truth-social' }, { type: 'truthSocial' }, { type: 5 }, { type: 'richText' }, { noType: true }];
    expect(core.renderWithAssets({ layout: 'homepage', body } as never, assets())).toBe('LAYOUT:homepage');
    expect((seen as { body: unknown[] }).body).toEqual([null, 'text', { type: 5 }, { type: 'richText' }, { noType: true }]);

    core.renderWithAssets({ layout: 'homepage', body: 'not-an-array' } as never, assets());
    expect((seen as { body: unknown }).body).toBe('not-an-array');
  });
});

describe('renderer.core helpers', () => {
  it('provides the comparison, arithmetic and collection helpers', async () => {
    const core = await freshCore();
    core.initializeHandlebars(assets());
    expect(helper('eq')(1, 1)).toBe(true);
    expect(helper('eq')(1, 2)).toBe(false);
    expect(helper('add')('2', 3)).toBe(5);
    expect(helper('slice')([1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
    expect(helper('slice')('nope', 1)).toEqual([]);
    expect(helper('uppercase')('abc')).toBe('ABC');
    expect(helper('uppercase')(undefined)).toBe('');
    expect(helper('coalesce')(null, undefined, 'x', {})).toBe('x');
    expect(helper('coalesce')(null, undefined, {})).toBeNull();
    expect(helper('jsonString')(undefined)).toBe('null');
    expect(helper('jsonString')({ a: 1 })).toBe('{"a":1}');
  });

  it('formats dates in the New York zone and tolerates bad input', async () => {
    const core = await freshCore();
    core.initializeHandlebars(assets());
    expect(helper('formatDate')('')).toBe('');
    expect(helper('formatDate')('2026-03-11T12:00:00.000Z')).toBe('11 de marzo de 2026');
    expect(helper('formatDate')('not-a-date')).toBe('not-a-date');
  });

  it('builds embed urls and rejects unknown providers or missing parameters', async () => {
    const core = await freshCore();
    core.initializeHandlebars(assets());
    const embed = helper('embedUrl');
    expect(embed('x-status', { hash: { username: 'a b', id: '1' } })).toBe('https://twitter.com/a%20b/status/1');
    expect(embed('spotify', { hash: { kind: 'track', id: 'x' } })).toBe('https://open.spotify.com/embed/track/x');
    expect(() => embed('unknown', { hash: {} })).toThrow('Unknown embed provider "unknown"');
    expect(() => embed(5, { hash: {} })).toThrow('Unknown embed provider "5"');
    expect(() => embed('tiktok', { hash: {} })).toThrow('requires parameter id');
    expect(() => embed('tiktok', { hash: { id: null } })).toThrow('requires parameter id');
    expect(() => embed('tiktok', { hash: { id: '' } })).toThrow('requires parameter id');
  });

  it('resolves the head title for every layout and fallback', async () => {
    const core = await freshCore();
    core.initializeHandlebars(assets());
    const title = helper('resolveHeadTitle');
    expect(title(null)).toBe('ModoItaliano');
    expect(title('x')).toBe('ModoItaliano');
    expect(title({ layout: 'homepage' })).toBe('ModoItaliano - Música italiana, noticias y lanzamientos');
    expect(title({ layout: 'category-page', categories: [{ name: ' Rock ' }], title: 'T' })).toBe('Rock | ModoItaliano');
    expect(title({ layout: 'category-page', title: ' T ' })).toBe('T | ModoItaliano');
    expect(title({ layout: 'category-page' })).toBe('Categoría | ModoItaliano');
    expect(title({ layout: 'search-page', title: 'Cerca' })).toBe('Cerca | ModoItaliano');
    expect(title({ layout: 'search-page' })).toBe('Buscar | ModoItaliano');
    expect(title({ layout: 'article-page', title: 'A' })).toBe('A | ModoItaliano');
    expect(title({ layout: 'article-page' })).toBe('Artículo | ModoItaliano');
    expect(title({ layout: '404' })).toBe('404 - Página no encontrada | ModoItaliano');
    expect(title({ layout: 'coming-soon', title: 'Soon' })).toBe('Soon | ModoItaliano');
    expect(title({ layout: 'coming-soon' })).toBe('Próximamente | ModoItaliano');
    expect(title({ layout: 'live-story', title: 'Live' })).toBe('Live | ModoItaliano');
    expect(title({ layout: 'live-story' })).toBe('Cobertura en vivo | ModoItaliano');
    expect(title({ layout: 'link-in-bio', title: 'Bio' })).toBe('Bio | ModoItaliano');
    expect(title({ layout: 'link-in-bio' })).toBe('Noticias destacadas | ModoItaliano');
    expect(title({ layout: 'media-page', seo: { metaTitle: ' Meta ' } })).toBe('Meta');
    expect(title({ layout: 'media-page', title: 'M' })).toBe('M | ModoItaliano');
    expect(title({ layout: 'media-page' })).toBe('ModoItaliano | ModoItaliano');
  });

  it('resolves social image url, candidate and alt text', async () => {
    const core = await freshCore();
    core.initializeHandlebars(assets());
    const fallback = 'https://cdn.modoitaliano.fm/assets/default-og.jpg';
    const url = helper('socialImageUrl');
    const candidate = helper('socialImageCandidate');
    const alt = helper('socialImageAlt');
    const withImage = { title: ' Page ', seo: { socialImage: { url: 'https://x/y.jpg', alt: ' Alt ' } } };

    expect(url(withImage)).toBe('https://x/y.jpg');
    expect(url(null)).toBe(fallback);
    expect(url({})).toBe(fallback);
    expect(url({ seo: { socialImage: [] } })).toBe(fallback);
    expect(url({ seo: { socialImage: 'x' } })).toBe(fallback);
    expect(url({ seo: { socialImage: { url: '   ' } } })).toBe(fallback);
    expect(url({ seo: { socialImage: { url: 3 } } })).toBe(fallback);
    expect(candidate(withImage)).toEqual(withImage.seo.socialImage);
    expect(candidate({})).toBeNull();

    expect(alt(null)).toBe('ModoItaliano');
    expect(alt(withImage)).toBe(' Alt ');
    expect(alt({ title: ' Page ', seo: { socialImage: { url: 'u', alt: '  ' } } })).toBe('Page');
    expect(alt({ seo: { socialImage: { url: 'u' } } })).toBe('ModoItaliano');
  });
});
