import { describe, expect, it } from 'vitest';
import { render } from './renderer.node.js';
import type { CanonicalDocument } from './types/canonical-article.js';

const baseDocument: CanonicalDocument = {
  id: 'page-shell-verification',
  slug: '/',
  layout: 'homepage',
  canonicalUrl: 'https://modoitaliano.fm/',
  contentVersion: '2026-08-21T12:00:00.000Z',
  publishedAt: '2026-08-21T12:00:00.000Z',
  updatedAt: '2026-08-21T12:00:00.000Z',
  status: 'published',
  title: 'ModoItaliano',
  language: 'es',
  featured: false,
  authors: [],
  categories: [],
  body: [],
  navigation: { categories: [] },
  articles: [],
  showHero: false,
  showEditorialHero: false,
  showBreakingNews: false,
  showLanding: false,
  showMustRead: false,
  showMoreStories: false
};

describe('page shell', () => {
  it('uses the requested Spanish homepage title in every title metadata surface', () => {
    const html = render(baseDocument);
    const title = 'ModoItaliano - Música italiana, noticias y lanzamientos';

    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain(`<meta property='og:title' content='${title}' />`);
    expect(html).toContain(`<meta name='twitter:title' content='${title}' />`);
  });

  it('never restores the retired English homepage title for localized payloads', () => {
    const html = render({ ...baseDocument, language: 'en', slug: 'en', canonicalUrl: 'https://modoitaliano.fm/en' });

    expect(html).toContain('<title>ModoItaliano - Música italiana, noticias y lanzamientos</title>');
    expect(html).not.toContain('ModoItaliano - Breaking News &amp; Current Events');
    expect(html).not.toContain('ModoItaliano - Breaking News & Current Events');
  });

  it('keeps homepage content the same safe distance below the masthead as an article', () => {
    const html = render(baseDocument);

    expect(html).toContain("class='mt-20 min-h-screen font-sans");
    expect(html).toContain('data-homepage-content');
  });

  it('never renders the retired hardcoded trending strip', () => {
    const html = render({ ...baseDocument, showTrending: true });

    expect(html).not.toContain('Clásico Universitario');
    expect(html).not.toContain('Trending Up:');
    expect(html).not.toContain('Terremoto en Magallanes');
  });

  it('links to the current ModoItaliano social profiles', () => {
    const html = render(baseDocument);

    expect(html).toContain("href='https://www.instagram.com/modoitaliano.fm/'");
    expect(html).toContain("href='https://www.tiktok.com/@modoitaliano.fm'");
    expect(html).not.toContain('modoitaliano.oficial');
  });

  it('links to Quienes somos from both header navigation surfaces', () => {
    const html = render(baseDocument);

    expect(html.match(/href='\/quienes-somos'/g)).toHaveLength(2);
    expect(html).toContain("aria-label='Navegación principal'");
    expect(html).toContain("aria-label='Todas las secciones'");
  });

  it('keeps category content the same safe distance below the masthead as an article', () => {
    const html = render({
      ...baseDocument,
      slug: 'musica',
      layout: 'category-page',
      canonicalUrl: 'https://modoitaliano.fm/musica',
      title: 'Música',
      categories: [{ name: 'Música', slug: 'musica' }]
    });

    expect(html).toContain("<main class='mt-20 flex-1 container mx-auto px-4' data-category-content>");
  });
});
