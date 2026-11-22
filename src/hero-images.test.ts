import { describe, expect, it } from 'vitest';
import { distributeHomepageArticles } from './homepage-distributor.js';
import { render } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

// modoitaliano/giorgia#57: the hero slides and the landing story card were CSS
// backgrounds, which cannot use srcset. They are real images now, through the
// same markup as every other image.
const base = {
  id: 'hero-fixture',
  slug: '/',
  canonicalUrl: 'https://modoitaliano.fm/',
  layout: 'homepage',
  contentVersion: '2026-11-22T12:00:00.000Z',
  publishedAt: '2026-11-22T12:00:00.000Z',
  updatedAt: '2026-11-22T12:00:00.000Z',
  status: 'published',
  title: 'Hero fixture',
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
  showBreakingNews: false,
  showLanding: false,
  showMustRead: false,
  showMoreStories: false,
} as unknown as CanonicalArticle;

const u = (name: string) => `https://cdn.modoitaliano.fm/uploads/2026/11/${name}`;
const variants = (name: string) => [
  { url: u(`${name}-300x169.png`), width: 300, height: 169 },
  { url: u(`${name}-1024x576.png`), width: 1024, height: 576 },
];
const imgs = (html: string) => html.match(/<img\b[^>]*>/g) ?? [];
// The header's first slide keeps an inline background image by design (giorgia#60): look at the page without it.
const withoutHeader = (html: string) => html.replace(/<header[\s\S]*?<\/header>/, '');

const hero = { url: u('hero.png'), alt: 'Hero', width: 1920, height: 1080, variants: variants('hero') };
const slides = [
  { image: u('one.png'), alt: 'One', width: 1920, height: 1080, variants: variants('one') },
  { image: u('two.png'), alt: 'Two', width: 1600, height: 900, variants: variants('two') },
  { image: u('three.png'), alt: 'Three' },
];
const page = (extra: object) => render({ ...base, ...extra } as CanonicalArticle);

describe('spotlight hero slides', () => {
  const html = page({ showHero: true, hero, heroTitle: 'Hero title', heroSlides: slides });

  it('are images: the first eager and high priority, the others lazy, none a CSS background', () => {
    const slideImages = imgs(html).filter((tag) => /one\.png|two\.png|three\.png/.test(tag));
    expect(slideImages).toHaveLength(3);
    expect(slideImages[0]).toBe(
      `<img src='${u('one.png')}' alt='One' class='absolute inset-0 w-full h-full object-cover object-center' srcset='${u('one-300x169.png')} 300w, ${u('one-1024x576.png')} 1024w, ${u('one.png')} 1920w' sizes='100vw' width='1920' height='1080' fetchpriority='high' />`,
    );
    expect(slideImages[1]).toContain("loading='lazy'");
    expect(slideImages[1]).toContain(`srcset='${u('two-300x169.png')} 300w, ${u('two-1024x576.png')} 1024w, ${u('two.png')} 1600w'`);
    expect(slideImages[1]).not.toContain('fetchpriority');
    expect(slideImages[2]).toBe(
      `<img src='${u('three.png')}' alt='Three' class='absolute inset-0 w-full h-full object-cover object-center' loading='lazy' />`,
    );
    expect(withoutHeader(html)).not.toMatch(/background-image: [^;']*url\(/);
  });

  it('keep the carousel markup the script drives and the gradient overlay on top of each image', () => {
    expect(html).toContain("class='carousel-slide active opacity-100 absolute inset-0 transition-opacity duration-700'");
    expect(html.match(/class='carousel-slide hidden opacity-0 absolute inset-0 transition-opacity duration-700'/g)).toHaveLength(2);
    expect(html.match(/pointer-events-none' style='background-image: radial-gradient\(71\.75% 69\.5% at 50% 47\.39%/g)).toHaveLength(3);
    expect(html.match(/class='carousel-dot/g)).toHaveLength(3);
  });

  it('use the hero image when there are no slides, and a fixed picture when there is neither', () => {
    const single = page({ showHero: true, hero, heroTitle: 'Hero title' });
    expect(imgs(single).find((tag) => tag.includes(u('hero.png')) && tag.includes('fetchpriority'))).toContain(`srcset='${u('hero-300x169.png')} 300w`);
    expect(single).toContain(`<link rel='preload' as='image' href='${u('hero.png')}' imagesrcset='${u('hero-300x169.png')} 300w, ${u('hero-1024x576.png')} 1024w, ${u('hero.png')} 1920w' imagesizes='100vw' fetchpriority='high' />`);
  });

  it('without any variant, change nothing but the element: the original url, alt and priority', () => {
    const plain = page({ showHero: true, hero: { url: u('hero.png'), alt: 'Hero' }, heroTitle: 'Hero title', heroSlides: [{ image: u('one.png'), alt: 'One' }] });
    expect(plain).not.toContain('srcset');
    expect(plain).toContain(`<link rel='preload' as='image' href='${u('hero.png')}' fetchpriority='high' />`);
    expect(imgs(plain).find((tag) => tag.includes('one.png'))).toBe(
      `<img src='${u('one.png')}' alt='One' class='absolute inset-0 w-full h-full object-cover object-center' fetchpriority='high' />`,
    );
  });
});

describe('editorial hero slides', () => {
  const html = page({ showEditorialHero: true, hero, heroTitle: 'Hero title', heroSlides: slides });

  it('are images too, with the first eager', () => {
    const slideImages = imgs(html).filter((tag) => /one\.png|two\.png|three\.png/.test(tag));
    expect(slideImages).toHaveLength(3);
    expect(slideImages[0]).toContain("sizes='(min-width: 1280px) 58vw, 100vw'");
    expect(slideImages[0]).toContain("fetchpriority='high'");
    expect(slideImages[1]).toContain("loading='lazy'");
    expect(withoutHeader(html)).not.toMatch(/background-image: [^;']*url\(/);
    expect(html).toContain("class='carousel-slide active opacity-100 absolute inset-0 transition-opacity duration-700'");
  });
});

describe('landing story card', () => {
  const story = (featuredImage: object) => ({
    ...base,
    id: '5f1d6c1e-2c3b-4f6a-9d0e-1a2b3c4d5e6f',
    title: 'Card story',
    url: '/noticias/card',
    featuredImage,
    categories: [{ name: 'Noticias', slug: 'noticias' }],
  });
  const withCard = (featuredImage: object) => {
    const slots = JSON.parse(JSON.stringify(base.homepageSlots));
    slots.landing.card5 = story(featuredImage);
    return page({ showLanding: true, homepageSlots: slots });
  };

  it('is an image under a gradient, lazy, with srcset when the payload has variants', () => {
    const html = withCard({ url: u('card.png'), alt: 'Card', width: 1672, height: 941, variants: variants('card') });
    expect(imgs(html).find((tag) => tag.includes(u('card.png')))).toBe(
      `<img src='${u('card.png')}' alt='Card' class='absolute inset-0 w-full h-full object-cover object-center' srcset='${u('card-300x169.png')} 300w, ${u('card-1024x576.png')} 1024w, ${u('card.png')} 1672w' sizes='(min-width: 1280px) 25vw, (min-width: 1024px) 40vw, 100vw' width='1672' height='941' loading='lazy' />`,
    );
    expect(html).toContain("pointer-events-none' style='background-image: linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0.7) 50%, transparent 100%);'");
    expect(withoutHeader(html)).not.toMatch(/background-image: [^;']*url\(/);
  });

  it('is the original, lazy, without them', () => {
    const html = withCard({ url: u('card.png'), alt: 'Card' });
    expect(imgs(html).find((tag) => tag.includes(u('card.png')))).toBe(
      `<img src='${u('card.png')}' alt='Card' class='absolute inset-0 w-full h-full object-cover object-center' loading='lazy' />`,
    );
  });
});
