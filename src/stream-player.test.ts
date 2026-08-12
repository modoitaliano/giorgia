import { describe, expect, it } from 'vitest';
import { render } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

const homepageFixture: CanonicalArticle = {
  id: '9dd95e8f-ac86-4973-a394-330707527250',
  slug: '/',
  layout: 'homepage',
  canonicalUrl: 'https://modoitaliano.fm/',
  contentVersion: '2026-03-08T12:00:00.000Z',
  publishedAt: '2026-03-08T08:00:00.000Z',
  updatedAt: '2026-03-08T12:00:00.000Z',
  status: 'published',
  title: 'ModoItaliano',
  excerpt: 'La musica che ci unisce.',
  language: 'es',
  featured: true,
  authors: [{ name: 'ModoItaliano Desk', slug: 'modoitaliano-desk' }],
  categories: [{ name: 'Portada', slug: 'portada' }],
  body: [],
  navigation: {
    categories: [{ name: 'Música', slug: 'musica' }],
  },
  articles: [],
};

describe('stream player', () => {
  it('does not force CORS for the live stream audio element', () => {
    const html = render(homepageFixture);

    expect(html).toContain("<audio data-stream-audio preload='none' src='https://palazzo.gaulatti.com'");
    expect(html).not.toContain('crossorigin=');
    expect(html).not.toContain('createMediaElementSource');
  });
});
