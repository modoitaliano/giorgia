import { describe, expect, it } from 'vitest';
import { render } from './renderer.node.js';
import { outletConfig } from './outlet-config.js';
import type { CanonicalArticle } from './types/canonical-article.js';

const article: CanonicalArticle = {
  id: 'translation-contract',
  slug: '/notizie/storia',
  layout: 'article-page',
  canonicalUrl: 'https://modoitaliano.fm/notizie/storia',
  contentVersion: '2026-08-19T20:00:00.000Z',
  publishedAt: '2026-08-19T20:00:00.000Z',
  updatedAt: '2026-08-19T20:00:00.000Z',
  status: 'published',
  title: 'Localized story',
  excerpt: 'Localized excerpt',
  language: 'es',
  featured: false,
  authors: [{ name: 'ModoItaliano Desk', slug: 'modoitaliano-desk' }],
  categories: [{ name: 'Notizie', slug: 'notizie' }],
  body: [],
  navigation: { categories: [{ name: 'Notizie', slug: 'notizie' }] },
  articles: [],
};

describe('localized renderer contract', () => {
  it.each([
    ['en', '/en/notizie/storia'],
    ['it', '/it/notizie/storia'],
  ] as const)('renders %s documents with the locale-prefixed canonical route', (language, route) => {
    const html = render({
      ...article,
      language,
      canonicalUrl: `https://modoitaliano.fm${route}`,
    });

    expect(html).toContain(`<html lang='${language}'`);
    expect(html).toContain(`https://modoitaliano.fm${route}`);
  });

  it.each([
    ['es', '/search', 'Buscar'],
    ['en', '/en/search', 'Search'],
    ['it', '/it/search', 'Cerca'],
  ] as const)('renders the %s search page title from outletConfig', (language, route, title) => {
    const html = render({
      ...article,
      layout: 'search-page',
      language,
      title: 'Buscar',
      slug: route,
      canonicalUrl: `https://modoitaliano.fm${route}`,
    });

    expect(outletConfig.searchTitle[language]).toBe(title);
    expect(html).toContain(`<html lang='${language}'`);
    expect(html).toContain(`<title>${title} | ModoItaliano</title>`);
    expect(html).toContain(`<meta property='og:title' content='${title} | ModoItaliano' />`);
    expect(html).toContain(`<meta name='twitter:title' content='${title} | ModoItaliano' />`);
  });
});
