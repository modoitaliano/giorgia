import { describe, expect, it } from 'vitest';
import { render } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

const articleFixture: CanonicalArticle = {
  id: 'byline-fixture',
  slug: '/notizie/byline',
  canonicalUrl: 'https://modoitaliano.fm/notizie/byline',
  layout: 'article-page',
  contentVersion: '2026-10-10T12:00:00.000Z',
  publishedAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
  status: 'published',
  title: 'Byline fixture',
  excerpt: 'An article with CMS-supplied credits.',
  language: 'es',
  featured: false,
  authors: [{ name: 'Lucia Rossi', slug: 'lucia-rossi' }],
  categories: [{ name: 'Noticias', slug: 'noticias' }],
  navigation: { categories: [] },
  articles: [],
  body: [],
};

function renderedByline(authors: NonNullable<CanonicalArticle['authors']>, language = 'es') {
  const html = render({ ...articleFixture, authors, language });
  return html.match(/<p[^>]*data-article-byline>([\s\S]*?)<\/p>/)?.[1];
}

describe('article byline', () => {
  it.each(['es', 'en', 'it'])('renders the CMS-supplied name in %s', (language) => {
    expect(renderedByline([{ name: 'Lucia Rossi', slug: 'lucia-rossi' }], language))
      .toBe('Lucia Rossi');
  });

  it('renders every author in document order without a trailing separator', () => {
    expect(renderedByline([
      { name: 'Lucia Rossi', slug: 'lucia-rossi' },
      { name: 'Marco Bianchi', slug: 'marco-bianchi' },
    ])).toBe('Lucia Rossi, Marco Bianchi');
  });

  it('escapes author names instead of interpreting them as markup', () => {
    expect(renderedByline([{ name: '<img src=x onerror=alert(1)> & Desk', slug: 'desk' }]))
      .toBe('&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt; &amp; Desk');
  });
});
