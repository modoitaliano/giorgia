import { describe, expect, it } from 'vitest';
import { distributeHomepageArticles } from './homepage-distributor.js';
import { render } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

// modoitaliano/giorgia#67: the homepage partials no test rendered (breaking news and its live updates) and the hero
// branches that only show with a given shape of input, through the real render() and templates.
const base = {
  id: 'homepage-partials-fixture',
  slug: '/',
  canonicalUrl: 'https://modoitaliano.fm/',
  layout: 'homepage',
  contentVersion: '2026-11-22T12:00:00.000Z',
  publishedAt: '2026-11-22T12:00:00.000Z',
  updatedAt: '2026-11-22T12:00:00.000Z',
  status: 'published',
  title: 'Homepage fixture',
  excerpt: 'A fixture.',
  language: 'es',
  featured: false,
  authors: [{ name: 'Redacción', slug: 'redaccion' }],
  categories: [{ name: 'Noticias', slug: 'noticias' }],
  navigation: { categories: [{ name: 'Noticias', slug: 'noticias' }] },
  articles: [],
  body: [],
  homepageSlots: distributeHomepageArticles([], new Date('2026-11-22T12:00:00.000Z'), false),
  showHero: false,
  showEditorialHero: false,
  showBreakingNews: true,
  showLanding: false,
  showMustRead: false,
  showMoreStories: false,
} as unknown as CanonicalArticle;

const page = (extra: object) => render({ ...base, ...extra } as CanonicalArticle);
const main = (html: string) => html.slice(html.indexOf('data-homepage-content'));

const breakingMain = {
  category: 'Última hora',
  title: 'Elecciones <en directo>',
  url: 'https://modoitaliano.fm/elecciones',
  image: 'https://cdn.modoitaliano.fm/uploads/2026/11/urnas.jpg',
  alt: 'Urnas',
  excerpt: 'Siga el recuento minuto a minuto.',
};

describe('breaking news', () => {
  it('draws the main story with its live coverage link, and every kind of update', () => {
    const html = main(
      page({
        breakingNews: {
          displayClass: 'breaking-wide',
          main: { ...breakingMain, liveUrl: 'https://modoitaliano.fm/elecciones/en-vivo' },
          updates: [
            { timestamp: '2026-11-22T12:05:00.000Z', text: 'Abren los colegios <ya>.' },
            { time: '12:30', html: '<p>Participación del <strong>40 %</strong>.</p>' },
          ],
        },
      }),
    );
    expect(html).toContain("my-4 breaking-wide'");
    expect(html).toContain(`<img src='${breakingMain.image}' alt='Urnas' class='w-full h-full object-cover' fetchpriority='high' />`);
    expect(html).toContain('>Última hora</span>');
    // The title and a plain-text update are escaped; an html update is the producer's markup.
    expect(html).toContain('Elecciones &lt;en directo&gt;</a>');
    expect(html).toContain('Siga el recuento minuto a minuto.');
    expect(html).toMatch(/href='https:\/\/modoitaliano\.fm\/elecciones\/en-vivo'[\s\S]*?Ver cobertura en vivo/);
    expect(html).toContain('actualizaciones en vivo');
    expect(html).toContain('Abren los colegios &lt;ya&gt;.');
    expect(html).toContain('<p>Participación del <strong>40 %</strong>.</p>');
    expect(html).toContain('>12:30</span>');
    expect(html).not.toContain('Aún no hay actualizaciones en vivo.');
    // A timestamped update shows a formatted date, not the raw ISO string.
    expect(html).not.toContain('2026-11-22T12:05:00.000Z</span>');
  });

  it('has no live coverage link without a live url, and says so when there are no updates', () => {
    const html = main(page({ breakingNews: { main: breakingMain, updates: [] } }));
    expect(html).toContain('Elecciones &lt;en directo&gt;');
    expect(html).not.toContain('Ver cobertura en vivo');
    expect(html).toContain('Aún no hay actualizaciones en vivo.');
    expect(main(page({ breakingNews: { main: breakingMain } }))).toContain('Aún no hay actualizaciones en vivo.');
  });

  it('is not drawn when it is switched off or absent', () => {
    expect(main(page({ showBreakingNews: false, breakingNews: { main: breakingMain } }))).not.toContain('actualizaciones en vivo');
    expect(main(page({}))).not.toContain('actualizaciones en vivo');
  });
});

describe('spotlight hero', () => {
  const related = Array.from({ length: 6 }, (_, index) => ({
    title: `Relacionada ${index + 1}`,
    url: `https://modoitaliano.fm/relacionada-${index + 1}`,
    publishedAt: '2026-11-22T10:00:00.000Z',
  }));

  it('draws the hero image with one dot and at most four related stories', () => {
    const html = main(
      page({
        showHero: true,
        hero: { url: 'https://cdn.modoitaliano.fm/uploads/2026/11/hero.jpg', alt: 'Portada' },
        heroTitle: 'Titular <principal>',
        heroExcerpt: 'Resumen.',
        heroUrl: 'https://modoitaliano.fm/titular',
        heroRelated: related,
      }),
    );
    expect(html).toContain("<img src='https://cdn.modoitaliano.fm/uploads/2026/11/hero.jpg' alt='Portada'");
    expect(html).toContain('Titular &lt;principal&gt;</a>');
    expect(html.match(/class='carousel-dot /g)).toHaveLength(1);
    expect(html).toContain("aria-label='Ir a la diapositiva 1'");
    for (const index of [1, 2, 3, 4]) expect(html).toContain(`Relacionada ${index}`);
    expect(html).not.toContain('Relacionada 5');
    expect(html).not.toContain('Relacionada 6');
  });

  it('draws the slides when there is no hero image, one dot each', () => {
    const html = main(
      page({
        showHero: true,
        heroTitle: 'Solo diapositivas',
        heroSlides: [
          { image: 'https://cdn.modoitaliano.fm/uploads/2026/11/a.jpg', alt: 'A' },
          { image: 'https://cdn.modoitaliano.fm/uploads/2026/11/b.jpg', alt: 'B' },
        ],
      }),
    );
    expect(html).toContain('Solo diapositivas');
    expect(html).toContain("data-carousel='spotlight'");
    expect(html.match(/class='carousel-dot /g)).toHaveLength(2);
    expect(html).toContain("aria-label='Ir a la diapositiva 2'");
  });

  it('is not drawn without a hero image or slides, or when switched off', () => {
    expect(main(page({ showHero: true, heroTitle: 'Nada' }))).not.toContain("data-carousel='spotlight'");
    expect(
      main(page({ showHero: false, hero: { url: 'https://cdn.modoitaliano.fm/uploads/2026/11/hero.jpg', alt: 'x' } })),
    ).not.toContain("data-carousel='spotlight'");
  });
});

describe('editorial hero', () => {
  it('uses the first category as its kicker, and the default kicker without one', () => {
    const withCategory = main(
      page({ showEditorialHero: true, heroTitle: 'Editorial', heroCategories: [{ name: 'Política', slug: 'politica' }] }),
    );
    expect(withCategory).toContain("data-carousel='editorial'");
    expect(withCategory).toContain('Noticia principal');
    expect(withCategory).toContain('>Política</span>');
    const withoutCategory = main(page({ showEditorialHero: true, heroTitle: 'Editorial', categories: [] }));
    expect(withoutCategory).toContain('>Noticias destacadas</span>');
  });
});
