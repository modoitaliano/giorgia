import { describe, expect, it } from 'vitest';
import { distributeHomepageArticles } from './homepage-distributor.js';
import { render } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

// modoitaliano/giorgia#55: images are served sized for their slot when the
// payload carries variants, and exactly as before when it does not.
const base: CanonicalArticle = {
  id: 'responsive-fixture',
  slug: '/notizie/responsive',
  canonicalUrl: 'https://modoitaliano.fm/notizie/responsive',
  layout: 'article-page',
  contentVersion: '2026-11-22T12:00:00.000Z',
  publishedAt: '2026-11-22T12:00:00.000Z',
  updatedAt: '2026-11-22T12:00:00.000Z',
  status: 'published',
  title: 'Responsive fixture',
  excerpt: 'A fixture with an image.',
  language: 'es',
  featured: false,
  authors: [{ name: 'Redacción', slug: 'redaccion' }],
  categories: [{ name: 'Noticias', slug: 'noticias' }],
  navigation: { categories: [{ name: 'Noticias', slug: 'noticias' }] },
  articles: [],
  body: [],
};

const original = 'https://cdn.modoitaliano.fm/wp-content/uploads/hero.png';
const variants = [
  { url: 'https://cdn.modoitaliano.fm/wp-content/uploads/hero-300x169.png', width: 300, height: 169 },
  { url: 'https://cdn.modoitaliano.fm/wp-content/uploads/hero-768x432.png', width: 768, height: 432 },
];
const plain = { url: original, alt: 'Hero' };
const sized = { ...plain, width: 1920, height: 1080, variants };

const imgs = (html: string) => html.match(/<img\b[^>]*>/g) ?? [];

function homepage(featuredImage: object, count = 12): CanonicalArticle {
  const articles = Array.from({ length: count }, (_, index) => ({
    ...base,
    id: `story-${index}`,
    slug: `/notizie/story-${index}`,
    canonicalUrl: `https://modoitaliano.fm/notizie/story-${index}`,
    title: `Story ${index}`,
    url: `/notizie/story-${index}`,
    publishedAt: `2026-11-22T${String(10 + (index % 10)).padStart(2, '0')}:00:00.000Z`,
    featuredImage,
  }));
  return {
    ...base,
    slug: '/',
    canonicalUrl: 'https://modoitaliano.fm/',
    layout: 'homepage',
    homepageSlots: distributeHomepageArticles(articles as never, new Date('2026-11-22T12:00:00.000Z'), false),
    showHero: false,
    showEditorialHero: false,
    showBreakingNews: false,
    showLanding: true,
    showMustRead: true,
    showMoreStories: true,
  } as CanonicalArticle;
}

describe('article page image', () => {
  it('renders the original exactly as before when the payload carries no variants', () => {
    const html = render({ ...base, featuredImage: plain });
    const hero = imgs(html).find((tag) => tag.includes('fetchpriority'));
    expect(hero).toBe(
      `<img src='${original}' alt='Hero' class='w-full h-full object-cover' fetchpriority='high' loading='eager' decoding='async' />`,
    );
    expect(html).not.toContain('srcset');
    expect(html).toContain(`<link rel='preload' as='image' href='${original}' fetchpriority='high' />`);
  });

  it('builds srcset from the variants plus the original, with width, height and sizes, and preloads the same set', () => {
    const html = render({ ...base, featuredImage: sized });
    const hero = imgs(html).find((tag) => tag.includes('fetchpriority'));
    expect(hero).toBe(
      `<img src='${original}' alt='Hero' class='w-full h-full object-cover' srcset='${variants[0].url} 300w, ${variants[1].url} 768w, ${original} 1920w' sizes='(min-width: 1024px) 33vw, 100vw' width='1920' height='1080' fetchpriority='high' loading='eager' decoding='async' />`,
    );
    expect(html).toContain(
      `<link rel='preload' as='image' href='${original}' imagesrcset='${variants[0].url} 300w, ${variants[1].url} 768w, ${original} 1920w' imagesizes='100vw' fetchpriority='high' />`,
    );
  });

  it('uses the variants alone when the original size is not known, and never emits a half size', () => {
    const html = render({ ...base, featuredImage: { ...plain, variants } });
    const hero = imgs(html).find((tag) => tag.includes('fetchpriority'))!;
    expect(hero).toContain(`srcset='${variants[0].url} 300w, ${variants[1].url} 768w'`);
    expect(hero).not.toContain('width=');
    const halfSized = render({ ...base, featuredImage: { ...plain, width: 1920 } });
    expect(imgs(halfSized).find((tag) => tag.includes('fetchpriority'))).not.toContain('width=');
  });

  it('ignores variants that are empty or fields it does not know, and escapes what it prints', () => {
    const empty = render({ ...base, featuredImage: { ...plain, variants: [], extra: 'ignored' } as never });
    expect(empty).not.toContain('srcset');
    const hostile = render({
      ...base,
      featuredImage: {
        ...plain,
        width: 10,
        height: 5,
        variants: [{ url: "https://cdn.example.test/a.png' onerror='alert(1)", width: 5, height: 3 }],
      },
    });
    expect(hostile).not.toContain("' onerror='alert(1)");
    expect(hostile).toContain('&#x27; onerror&#x3D;&#x27;alert(1)');
  });
});

describe('body image blocks', () => {
  it('builds srcset for an image block that carries variants and lazy loads it', () => {
    const html = render({ ...base, body: [{ type: 'image', url: original, alt: 'In body', width: 1920, height: 1080, variants }] as never });
    expect(imgs(html).find((tag) => tag.includes("alt='In body'"))).toBe(
      `<img src='${original}' alt='In body' class='w-full h-auto object-cover' srcset='${variants[0].url} 300w, ${variants[1].url} 768w, ${original} 1920w' sizes='(min-width: 1024px) 66vw, 100vw' width='1920' height='1080' loading='lazy' />`,
    );
  });

  it('keeps an image block without variants as it was, now lazy', () => {
    const html = render({ ...base, body: [{ type: 'image', url: original, alt: 'In body' }] as never });
    expect(imgs(html).find((tag) => tag.includes("alt='In body'"))).toBe(
      `<img src='${original}' alt='In body' class='w-full h-auto object-cover' loading='lazy' />`,
    );
  });
});

describe('homepage cards', () => {
  it('with variants: every featured image carries srcset, width and height; only the lead hero is not lazy', () => {
    const cards = imgs(render(homepage(sized))).filter((tag) => tag.includes(original));
    expect(cards.length).toBeGreaterThan(3);
    for (const tag of cards) {
      expect(tag).toContain('srcset=');
      expect(tag).toContain("width='1920' height='1080'");
    }
    expect(cards.filter((tag) => !tag.includes("loading='lazy'"))).toHaveLength(1);
    expect(cards.find((tag) => !tag.includes("loading='lazy'"))).toContain("fetchpriority='high'");
  });

  it('without variants: no srcset anywhere, and the lead hero is byte for byte what it was', () => {
    const html = render(homepage(plain));
    const cards = imgs(html).filter((tag) => tag.includes(original));
    expect(cards.length).toBeGreaterThan(3);
    expect(html).not.toContain('srcset');
    expect(cards.filter((tag) => tag.includes('fetchpriority'))).toEqual([
      `<img src='${original}' alt='Hero' class='w-full h-[400px] object-cover rounded' fetchpriority='high' />`,
    ]);
  });
});

describe('link in bio', () => {
  it('uses the variants and keeps the alt fallback to the title', () => {
    const html = render({ ...base, layout: 'link-in-bio', articles: [{ ...base, id: '5f1d6c1e-2c3b-4f6a-9d0e-1a2b3c4d5e6f', title: 'Card title', url: '/a', featuredImage: { url: original, alt: '', width: 1920, height: 1080, variants } }] as never });
    expect(imgs(html).find((tag) => tag.includes(original))).toBe(
      `<img src='${original}' alt='Card title' srcset='${variants[0].url} 300w, ${variants[1].url} 768w, ${original} 1920w' sizes='(min-width: 640px) 33vw, 100vw' width='1920' height='1080' loading='lazy' />`,
    );
  });
});
