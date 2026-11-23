import { describe, expect, it } from 'vitest';
import { render } from './renderer.node.js';
import type { CanonicalDocument } from './types/canonical-article.js';

// The 404, coming-soon, live-story and media layouts rendered through the real renderer and the real
// templates (modoitaliano/giorgia#67). Their other tests use stand-in templates.

const common = {
  id: 'layout-test',
  slug: '/prueba',
  canonicalUrl: 'https://modoitaliano.fm/prueba',
  contentVersion: '2026-11-23T10:00:00.000Z',
  publishedAt: '2026-11-23T10:00:00.000Z',
  updatedAt: '2026-11-23T10:00:00.000Z',
  status: 'published',
  title: 'Título de prueba',
  language: 'es',
  featured: false,
  body: [],
  navigation: { categories: [{ name: 'Rock', slug: 'rock' }, { name: 'Pop', slug: 'pop' }] },
} as const;

function page(extra: Record<string, unknown>): string {
  return render({ ...common, ...extra } as unknown as CanonicalDocument);
}

describe('404 layout', () => {
  const notFound = {
    layout: '404',
    title: 'Página no encontrada',
    excerpt: 'No encontramos lo que buscas.',
    homeLinkLabel: 'Volver al inicio',
    categoriesLabel: 'Explora por categoría',
  };

  it('renders the 404 page with its message, the home link and the category links', () => {
    const html = page(notFound);
    expect(html).toContain("data-page-layout='404'");
    expect(html).toContain('>404</h1>');
    expect(html).toContain('>Página no encontrada</h2>');
    expect(html).toContain('No encontramos lo que buscas.');
    expect(html).toContain("<a href='/'");
    expect(html).toContain('<span>Volver al inicio</span>');
    expect(html).toContain('>Explora por categoría</p>');
    expect(html).toContain("<a href='/rock'");
    expect(html).toContain('>Pop</a>');
  });

  it.each([
    ['en', "<a href='/en'"],
    ['it', "<a href='/it'"],
  ])('links home to the locale prefix for %s', (language, link) => {
    expect(page({ ...notFound, language })).toContain(link);
  });

  it('renders without category navigation', () => {
    const html = page({ ...notFound, navigation: { categories: [] } });
    expect(html).toContain('>404</h1>');
    expect(html).not.toContain("<a href='/rock'");
  });
});

describe('coming-soon layout', () => {
  it('renders the given excerpt under the title', () => {
    const html = page({ layout: 'coming-soon', title: 'Próximamente', excerpt: 'Una novedad en camino.' });
    expect(html).toContain("data-page-layout='coming-soon'");
    expect(html).toContain('Una novedad en camino.');
    expect(html).not.toContain('Estamos preparando algo especial');
  });

  it('falls back to the default message without an excerpt', () => {
    const html = page({ layout: 'coming-soon', title: 'Próximamente' });
    expect(html).toContain('Estamos preparando algo especial. Vuelve pronto para descubrirlo.');
  });

  it('escapes markup in the title', () => {
    const html = page({ layout: 'coming-soon', title: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });
});

describe('live-story layout', () => {
  const story = {
    layout: 'live-story',
    title: 'Cobertura de prueba',
    excerpt: 'Seguimos el evento.',
    authors: [{ name: 'Desk', slug: 'desk' }],
    categories: [{ name: 'Rock', slug: 'rock' }],
  };

  it('renders the story without a hero image', () => {
    const html = page(story);
    expect(html).toContain("data-page-layout='live-story'");
    expect(html).toContain('Cobertura de prueba');
    expect(html).not.toContain('data-carousel=');
  });

  it('renders a single hero image with its alt text and responsive sources', () => {
    const html = page({
      ...story,
      featuredImage: {
        url: 'https://cdn.example/hero.jpg',
        alt: 'La portada',
        width: 1200,
        height: 630,
        variants: [{ url: 'https://cdn.example/hero-600.jpg', width: 600, height: 315 }],
      },
    });
    expect(html).toContain("src='https://cdn.example/hero.jpg'");
    expect(html).toContain("alt='La portada'");
    expect(html).toContain('https://cdn.example/hero-600.jpg 600w');
    expect(html).toContain("fetchpriority='high'");
    expect(html).not.toContain('data-carousel=');
  });

  it('renders a carousel with one dot per extra image when media is present', () => {
    const html = page({
      ...story,
      featuredImage: { url: 'https://cdn.example/hero.jpg', alt: 'La portada' },
      media: [
        { url: 'https://cdn.example/a.jpg', alt: 'A' },
        { url: 'https://cdn.example/b.jpg', alt: 'B' },
      ],
    });
    expect(html).toContain("data-carousel='live-story-hero'");
    expect(html).toContain("src='https://cdn.example/a.jpg'");
    expect(html).toContain("src='https://cdn.example/b.jpg'");
    expect(html.match(/class='carousel-dot /g)).toHaveLength(3);
  });
});

describe('media layout', () => {
  it('renders the media browser shell with its status, grid and pagination hooks', () => {
    const html = page({ layout: 'media-page', title: 'Fotos de la asignación' });
    expect(html).toContain("data-page-layout='media-page'");
    expect(html).toContain('data-media-page');
    for (const id of ['media-title', 'media-meta', 'media-status', 'media-grid', 'media-pagination', 'media-refresh']) {
      expect(html).toContain(`id='${id}'`);
    }
  });
});
