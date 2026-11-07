import { describe, expect, it } from 'vitest';
import { render } from './renderer.browser.js';
import { render as renderNode } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

const article: CanonicalArticle = {
  id: 'browser-renderer',
  slug: '/notizie/storia',
  layout: 'article-page',
  canonicalUrl: 'https://modoitaliano.fm/notizie/storia',
  contentVersion: '2026-08-19T20:00:00.000Z',
  publishedAt: '2026-08-19T20:00:00.000Z',
  updatedAt: '2026-08-19T20:00:00.000Z',
  status: 'published',
  title: 'Browser story',
  excerpt: 'Browser excerpt',
  language: 'es',
  featured: false,
  authors: [{ name: 'ModoItaliano Desk', slug: 'modoitaliano-desk' }],
  categories: [{ name: 'Notizie', slug: 'notizie' }],
  body: [],
  navigation: { categories: [{ name: 'Notizie', slug: 'notizie' }] },
  articles: [],
};

describe('browser renderer', () => {
  it('renders the same document as the node renderer from bundled assets', () => {
    const html = render(article);
    expect(html).toContain('Browser story | ModoItaliano');
    expect(html).toBe(renderNode(article));
  });
});
