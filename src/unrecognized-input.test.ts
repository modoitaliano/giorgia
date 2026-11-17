import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IGNORED_INPUT_REASONS, ignoredInputCounts, type IgnoredInputReason } from './ignored-input.js';
import { addContractFormats } from './json-schema-formats.js';
import { render } from './renderer.node.js';
import type { CanonicalDocument } from './types/canonical-article.js';

// gaulatti/ariston#217: "If we don't recognize it, we ignore it." Cronkite
// validates every publish request against these packaged input schemas, and
// Giorgia's renderer validates the document again; neither refuses a member
// or value it does not know. Each fallback here is the documented one.

const require = createRequire(import.meta.url);
const schema = (name: string) => require(`./schemas/${name}.schema.json`) as object;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addContractFormats(ajv);
const validates = (name: string, input: unknown) => ajv.validate(schema(name), input);

function ignoredBy<T>(reason: IgnoredInputReason, task: () => T): [T, number] {
  const before = ignoredInputCounts()[reason];
  const result = task();
  return [result, ignoredInputCounts()[reason] - before];
}

const article = (extra: Record<string, unknown> = {}): CanonicalDocument => ({
  id: 'article-1',
  slug: '/notizie/article-1',
  layout: 'article-page',
  canonicalUrl: 'https://modoitaliano.fm/notizie/article-1',
  contentVersion: '2026-11-17T00:00:00.000Z',
  publishedAt: '2026-11-17T00:00:00.000Z',
  updatedAt: '2026-11-17T00:00:00.000Z',
  status: 'published',
  title: 'Articolo uno',
  language: 'es',
  featured: false,
  authors: [],
  categories: [],
  body: [{ type: 'heading', level: 2, text: 'Known heading' }],
  ...extra,
}) as CanonicalDocument;

afterEach(() => vi.restoreAllMocks());

describe('packaged input schemas accept members they do not define', () => {
  it.each([
    ['feed-renderable-input', { document: {}, feed: {}, cursor: 'next' }],
    ['social-image-input', { imageUrl: 'https://cdn.modoitaliano.fm/a.jpg', categoryName: 'Musica', title: 'T', qrCodeHtml: '<svg/>', theme: 'dark' }],
    ['search-manifest', { files: { currentMonth: 'search/2026-11.json', yearly: [], weekly: [] }, shards: 3 }],
  ])('%s', (name, input) => {
    expect(validates(name, input)).toBe(true);
  });

  it('still requires what each schema requires, and keeps safe search paths', () => {
    expect(validates('feed-renderable-input', { document: {} })).toBe(false);
    expect(validates('search-manifest', { files: { currentMonth: '../secret.json', yearly: [] } })).toBe(false);
    expect(validates('search-manifest', { files: { yearly: [] } })).toBe(false);
  });

  it('canonical document: unknown block types, heading levels, tones, Spotify kinds and hero layouts', () => {
    const document = article({
      heroLayout: 'mosaic',
      body: [
        { type: 'poll', question: 'Q?' },
        { type: 'infoBox', tone: 'critical', html: '<p>x</p>' },
        { type: 'heading', level: 6, text: 'h' },
        { type: 'spotify', url: 'https://open.spotify.com/audiobook/abc', embedKind: 'audiobook', embedId: 'abc' },
      ],
    });
    expect(validates('canonical-document', document)).toBe(true);
  });

  it('canonical document KEEP rows stay strict: status, layout, known blocks, URL-safe Spotify kinds', () => {
    expect(validates('canonical-document', article({ status: 'scheduled' }))).toBe(false);
    expect(validates('canonical-document', article({ layout: 'gallery-page' }))).toBe(false);
    expect(validates('canonical-document', article({ body: [{ type: 'heading', level: 2 }] }))).toBe(false);
    expect(validates('canonical-document', article({ body: [{ text: 'no type' }] }))).toBe(false);
    const spotify = (embedKind: string) => article({ body: [{ type: 'spotify', url: 'https://open.spotify.com/x', embedKind, embedId: 'abc' }] });
    expect(validates('canonical-document', spotify('../track'))).toBe(false);
    expect(validates('canonical-document', spotify('Track'))).toBe(false);
  });
});

describe('the renderer applies the documented fallback and counts it', () => {
  it('drops a body block of a type it does not render', () => {
    const [html, dropped] = ignoredBy('document_body_block_type', () =>
      render(article({ body: [{ type: 'poll', question: 'Unrendered question' }, { type: 'heading', level: 2, text: 'Known heading' }] })));
    expect(dropped).toBe(1);
    expect(html).toContain('Known heading');
    expect(html).not.toContain('Unrendered question');
  });

  it('renders a heading with a level it does not know as level 2', () => {
    const level2 = render(article({ body: [{ type: 'heading', level: 2, text: 'Deep heading' }] }));
    const [html, levels] = ignoredBy('document_heading_level', () =>
      render(article({ body: [{ type: 'heading', level: 6, text: 'Deep heading' }] })));
    expect(levels).toBe(1);
    expect(html).toBe(level2);
  });

  it('renders an info box with a tone it does not know as neutral', () => {
    const neutral = render(article({ body: [{ type: 'infoBox', tone: 'neutral', html: '<p>Box text</p>' }] }));
    const [html, tones] = ignoredBy('document_info_box_tone', () =>
      render(article({ body: [{ type: 'infoBox', tone: 'critical', html: '<p>Box text</p>' }] })));
    expect(tones).toBe(1);
    expect(html).toBe(neutral);
  });

  it('embeds a Spotify kind it does not list as sent, and counts it', () => {
    const [html, kinds] = ignoredBy('document_spotify_embed_kind', () =>
      render(article({ body: [{ type: 'spotify', url: 'https://open.spotify.com/audiobook/abc', embedKind: 'audiobook', embedId: 'abc' }] })));
    expect(kinds).toBe(1);
    expect(html).toContain("src='https://open.spotify.com/embed/audiobook/abc'");
    const [, known] = ignoredBy('document_spotify_embed_kind', () =>
      render(article({ body: [{ type: 'spotify', url: 'https://open.spotify.com/track/abc', embedKind: 'track', embedId: 'abc' }] })));
    expect(known).toBe(0);
  });

  it('treats a hero layout it does not know as absent', () => {
    const absent = render(article());
    const [html, layouts] = ignoredBy('document_hero_layout', () => render(article({ heroLayout: 'mosaic' })));
    expect(layouts).toBe(1);
    expect(html).toBe(absent);
    const [, known] = ignoredBy('document_hero_layout', () => render(article({ heroLayout: 'editorial' })));
    expect(known).toBe(0);
  });

  it('still refuses a body entry that is not a block at all', () => {
    for (const entry of [null, 'loose text', { text: 'no type' }]) {
      expect(() => render(article({ body: [entry] }))).toThrow();
    }
  });

  it('keeps retired block types silent: they are known and dropped, not unrecognized', () => {
    const [, dropped] = ignoredBy('document_body_block_type', () => render(article({ body: [{ type: 'truthSocial', post: 'x' }] })));
    expect(dropped).toBe(0);
  });
});

describe('ignored-input counters', () => {
  it('count every reason and write one log line per reason, naming only the reason', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fresh = await import('./ignored-input.js');
    expect(Object.values(fresh.ignoredInputCounts())).toEqual(IGNORED_INPUT_REASONS.map(() => 0));
    fresh.recordIgnoredInput('embed_provider');
    fresh.recordIgnoredInput('embed_provider');
    fresh.recordIgnoredInput('document_hero_layout');
    expect(fresh.ignoredInputCounts()).toMatchObject({ embed_provider: 2, document_hero_layout: 1, document_info_box_tone: 0 });
    expect(warn.mock.calls).toEqual([
      ['[giorgia] ignored unrecognized input: embed_provider'],
      ['[giorgia] ignored unrecognized input: document_hero_layout'],
    ]);
    expect(Object.isFrozen(fresh.ignoredInputCounts())).toBe(true);
  });
});
