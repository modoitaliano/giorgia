import { describe, expect, it } from 'vitest';
import { render } from './renderer.node.js';
import type { CanonicalArticle } from './types/canonical-article.js';

// Every body block of the canonical document, rendered through the real article page and the real
// templates (modoitaliano/giorgia#67). Blocks are checked in the HTML a reader gets, with their
// optional fields present and absent, and with markup in the text escaped.

const base = {
  id: 'blocks',
  slug: '/notizie/blocchi',
  layout: 'article-page',
  canonicalUrl: 'https://modoitaliano.fm/notizie/blocchi',
  contentVersion: '2026-11-23T10:00:00.000Z',
  publishedAt: '2026-11-23T10:00:00.000Z',
  updatedAt: '2026-11-23T10:00:00.000Z',
  status: 'published',
  title: 'Blocks story',
  excerpt: 'Every block',
  language: 'it',
  featured: false,
  authors: [{ name: 'ModoItaliano Desk', slug: 'modoitaliano-desk' }],
  categories: [{ name: 'Notizie', slug: 'notizie' }],
  navigation: { categories: [{ name: 'Notizie', slug: 'notizie' }] },
  articles: [],
} as const;

function page(body: unknown[]): string {
  return render({ ...base, body } as unknown as CanonicalArticle);
}

describe('divider', () => {
  it('renders a horizontal rule between the paragraphs around it', () => {
    const html = page([
      { type: 'richText', html: '<p>Before</p>' },
      { type: 'divider' },
      { type: 'richText', html: '<p>After</p>' },
    ]);
    const before = html.indexOf('<p>Before</p>');
    const rule = html.indexOf("<hr class='my-8");
    const after = html.indexOf('<p>After</p>');
    expect(before).toBeGreaterThan(-1);
    expect(rule).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(rule);
  });
});

describe('keyPoints', () => {
  it('renders the title and one list item per point, in order', () => {
    const html = page([{ type: 'keyPoints', title: 'In breve', points: ['Primo', 'Secondo', 'Terzo'] }]);
    expect(html).toContain('>In breve</h4>');
    const positions = ['Primo', 'Secondo', 'Terzo'].map((point) => html.indexOf(`<li>${point}</li>`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('escapes markup in a point and in the title', () => {
    const html = page([{ type: 'keyPoints', title: '<b>T</b>', points: ['<script>alert(1)</script>'] }]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;T&lt;/b&gt;');
  });
});

describe('pullQuote', () => {
  it('renders the quote with its attribution', () => {
    const html = page([{ type: 'pullQuote', text: 'La verità è semplice.', attribution: 'Ada Rossi' }]);
    expect(html).toContain('<blockquote');
    expect(html).toContain('La verità è semplice.');
    expect(html).toContain('>Ada Rossi</cite>');
  });

  it('renders no citation when there is no attribution', () => {
    const html = page([{ type: 'pullQuote', text: 'Senza firma.' }]);
    expect(html).toContain('Senza firma.');
    expect(html).not.toContain('<cite');
  });

  it('escapes markup in the quote and the attribution', () => {
    const html = page([{ type: 'pullQuote', text: '<img src=x onerror=1>', attribution: '<i>x</i>' }]);
    expect(html).not.toContain('<img src=x onerror=1>');
    expect(html).toContain('&lt;img src&#x3D;x onerror&#x3D;1&gt;');
    expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
  });
});

describe('list', () => {
  it('renders an ordered list when ordered is true and an unordered one otherwise', () => {
    const ordered = page([{ type: 'list', ordered: true, items: ['Uno', 'Due'] }]);
    expect(ordered).toContain("<ol class='my-6 list-decimal");
    expect(ordered).toContain('<li>Uno</li>');
    expect(ordered).toContain('<li>Due</li>');
    const unordered = page([{ type: 'list', items: ['Alfa'] }]);
    expect(unordered).toContain("<ul class='my-6 list-disc");
    expect(unordered).toContain('<li>Alfa</li>');
    expect(unordered).not.toContain("<ol class='my-6");
  });
});

describe('heading', () => {
  it.each([
    [3, '<h3 '],
    [4, '<h4 '],
    [2, '<h2 '],
    [7, '<h2 '],
  ])('renders level %s as %s and any level outside 2 to 4 as a second-level heading', (level, tag) => {
    const html = page([{ type: 'heading', level, text: `Titolo ${level}` }]);
    const index = html.indexOf(`>Titolo ${level}</h`);
    expect(index).toBeGreaterThan(-1);
    expect(html.slice(html.lastIndexOf('<h', index), index)).toContain(tag);
  });

  it('defaults to a second-level heading without a level', () => {
    const html = page([{ type: 'heading', text: 'Senza livello' }]);
    expect(html).toMatch(/<h2 [^>]*>Senza livello<\/h2>/);
  });
});

describe('infoBox', () => {
  it.each([
    ['warning', 'border-amber-500'],
    ['success', 'border-emerald-500'],
    ['info', 'border-sky-500'],
    ['neutral', 'border-slate-400'],
    ['anything else', 'border-slate-400'],
    [undefined, 'border-slate-400'],
  ])('renders the %s tone with its border colour', (tone, border) => {
    const html = page([{ type: 'infoBox', tone, title: 'Nota', html: '<p>Dettaglio</p>' }]);
    expect(html).toContain("<aside class='my-8 border-l-4");
    expect(html).toContain(border);
    expect(html).toContain('>Nota</h4>');
    expect(html).toContain('<p>Dettaglio</p>');
  });

  it('renders without a title', () => {
    const html = page([{ type: 'infoBox', html: '<p>Solo corpo</p>' }]);
    expect(html).toContain('<p>Solo corpo</p>');
    expect(html).not.toMatch(/<aside[^>]*>\s*<h4/);
  });
});

describe('unknown blocks', () => {
  it('accepts and does not render a block type the contract does not define', () => {
    const html = page([
      { type: 'richText', html: '<p>Visible</p>' },
      { type: 'futureBlock', text: 'Not rendered' },
    ]);
    expect(html).toContain('<p>Visible</p>');
    expect(html).not.toContain('Not rendered');
  });
});
