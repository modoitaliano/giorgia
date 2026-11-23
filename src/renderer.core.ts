import Handlebars from 'handlebars';
import { recordIgnoredInput } from './ignored-input.js';
import { layoutNames, type LayoutName } from './layouts.js';
import { canonicalArticleSchema, type CanonicalDocument } from './types/canonical-article.js';

export type { LayoutName } from './layouts.js';

export type RendererAssets = {
  layouts: Record<LayoutName, string>;
  partials: Record<string, string>;
  styles: string;
};

let initialized = false;
const layoutCache = new Map<LayoutName, HandlebarsTemplateDelegate>();
const removedBlockTypes = new Set(['truthSocial', 'truthsocial', 'truth-social', 'truth_social']);
const defaultSocialImageUrl = 'https://cdn.modoitaliano.fm/assets/default-og.jpg';
const homepageTitle = 'ModoItaliano - Música italiana, noticias y lanzamientos';

// The block types and values this release renders. The contract accepts any
// other value (gaulatti/ariston#217); it is ignored, counted, and given the
// fallback below.
const knownBlockTypes = new Set([
  'richText', 'heading', 'image', 'list', 'divider', 'infoBox', 'keyPoints', 'dataTable',
  'liveUpdate', 'audio', 'youtube', 'x', 'instagram', 'tiktok', 'spotify', 'pullQuote', 'angelinaPoll'
]);
const knownHeadingLevels = new Set([2, 3, 4]);
const knownInfoBoxTones = new Set(['neutral', 'info', 'warning', 'success']);
const knownSpotifyKinds = new Set(['track', 'album', 'playlist', 'episode', 'show']);
const knownHeroLayouts = new Set(['spotlight', 'editorial']);
// Parameter formats an embed provider accepts (contract C2 for the Angelina poll slug).
const embedParameterPatterns: Record<string, Record<string, RegExp>> = {
  'angelina-poll': { slug: /^(?=.{1,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  'angelina-poll-link': { slug: /^(?=.{1,64}$)[a-z0-9]+(?:-[a-z0-9]+)*$/ }
};

function normalizeBlock(block: unknown): unknown[] {
  if (!block || typeof block !== 'object') return [block];
  const record = block as { type?: unknown; tone?: unknown; level?: unknown; embedKind?: unknown };
  if (typeof record.type !== 'string') return [block];
  if (removedBlockTypes.has(record.type)) return [];
  if (!knownBlockTypes.has(record.type)) {
    // Fallback: a block this release does not render is dropped.
    recordIgnoredInput('document_body_block_type');
    return [];
  }
  if (record.type === 'heading' && typeof record.level === 'number' && !knownHeadingLevels.has(record.level)) {
    // Fallback: an unknown heading level renders as level 2.
    recordIgnoredInput('document_heading_level');
    return [{ ...record, level: 2 }];
  }
  if (record.type === 'infoBox' && typeof record.tone === 'string' && !knownInfoBoxTones.has(record.tone)) {
    // Fallback: an unknown tone renders as neutral.
    recordIgnoredInput('document_info_box_tone');
    return [{ ...record, tone: 'neutral' }];
  }
  if (record.type === 'spotify' && typeof record.embedKind === 'string' && !knownSpotifyKinds.has(record.embedKind)) {
    // Fallback: an unknown kind goes to Spotify as sent (the schema keeps it lowercase letters).
    recordIgnoredInput('document_spotify_embed_kind');
  }
  return [block];
}

function normalizeDocument(doc: CanonicalDocument): CanonicalDocument {
  const source = doc as { body?: unknown; heroLayout?: unknown };
  let normalized: Record<string, unknown> = doc as unknown as Record<string, unknown>;
  if (typeof source.heroLayout === 'string' && !knownHeroLayouts.has(source.heroLayout)) {
    // Fallback: an unknown hero layout is treated as absent.
    recordIgnoredInput('document_hero_layout');
    const { heroLayout: _ignored, ...rest } = normalized;
    normalized = rest;
  }
  if (Array.isArray(source.body)) normalized = { ...normalized, body: source.body.flatMap(normalizeBlock) };
  return normalized as unknown as CanonicalDocument;
}

function registerHelpers(): void {
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('add', (a: unknown, b: unknown) => Number(a) + Number(b));
  Handlebars.registerHelper('slice', (items: unknown, start: number, end?: number) => {
    if (!Array.isArray(items)) return [];
    return items.slice(start, end);
  });
  Handlebars.registerHelper('uppercase', (value: unknown) => String(value ?? '').toUpperCase());
  Handlebars.registerHelper('coalesce', (...args: unknown[]) => args.slice(0, -1).find((value) => value !== null && value !== undefined) ?? null);
  Handlebars.registerHelper('formatDate', (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'long',
        timeZone: 'America/New_York'
      }).format(date);
    } catch {
      return isoString;
    }
  });
  Handlebars.registerHelper('embedUrl', (name: unknown, options: Handlebars.HelperOptions) => {
    const templates: Record<string, string> = {
      'x-status': 'https://twitter.com/{username}/status/{id}',
      'x-embed': 'https://platform.twitter.com/embed/Tweet.html?id={id}&dnt=true',
      instagram: 'https://www.instagram.com/p/{shortcode}/embed/',
      tiktok: 'https://www.tiktok.com/embed/v2/{id}',
      spotify: 'https://open.spotify.com/embed/{kind}/{id}',
      // Angelina poll (gaulatti/giorgia#64, contract C1 and C4): the embed page frames
      // the poll; the link is the poll's own public page, for when frames are off.
      'angelina-poll': 'https://angelina.gaulatti.com/embed/poll/{slug}',
      'angelina-poll-link': 'https://angelina.gaulatti.com/poll/{slug}'
    };
    const template = typeof name === 'string' ? templates[name] : undefined;
    if (!template) {
      // As Cronkite's helper: an undeclared provider yields '', and every
      // template guards its embed, so nothing renders (gaulatti/ariston#217).
      recordIgnoredInput('embed_provider');
      return '';
    }
    return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_token, parameter: string) => {
      const value = options.hash[parameter];
      if (value === undefined || value === null || value === '') {
        throw new Error(`Embed provider "${String(name)}" requires parameter ${parameter}`);
      }
      const pattern = embedParameterPatterns[String(name)]?.[parameter];
      if (pattern && !pattern.test(String(value))) {
        throw new Error(`Embed provider "${String(name)}" parameter ${parameter} is not a valid value`);
      }
      return encodeURIComponent(String(value));
    });
  });
  Handlebars.registerHelper('jsonString', (value: unknown) => {
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  });
  Handlebars.registerHelper('resolveHeadTitle', (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return 'ModoItaliano';
    const page = doc as Partial<CanonicalDocument>;

    if (page.layout === 'homepage') {
      return homepageTitle;
    }

    if (page.layout === 'category-page') {
      const categoryName = page.categories?.[0]?.name?.trim();
      const baseTitle = categoryName || page.title?.trim() || 'Categoría';
      return `${baseTitle} | ModoItaliano`;
    }

    if (page.layout === 'search-page') {
      const title = page.title?.trim() || 'Buscar';
      return `${title} | ModoItaliano`;
    }

    if (page.layout === 'article-page') {
      const baseTitle = page.title?.trim() || 'Artículo';
      return `${baseTitle} | ModoItaliano`;
    }

    if (page.layout === '404') {
      return '404 - Página no encontrada | ModoItaliano';
    }

    if (page.layout === 'coming-soon') {
      return `${page.title?.trim() || 'Próximamente'} | ModoItaliano`;
    }

    if (page.layout === 'live-story') {
      const baseTitle = page.title?.trim() || 'Cobertura en vivo';
      return `${baseTitle} | ModoItaliano`;
    }

    if (page.layout === 'link-in-bio') {
      const baseTitle = page.title?.trim() || 'Noticias destacadas';
      return `${baseTitle} | ModoItaliano`;
    }

    const seoTitle = page.seo?.metaTitle?.trim();
    if (seoTitle) return seoTitle;
    const baseTitle = page.title?.trim() || 'ModoItaliano';
    return `${baseTitle} | ModoItaliano`;
  });
  const socialImage = (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return null;
    const seo = (doc as { seo?: { socialImage?: unknown } }).seo;
    const image = seo?.socialImage;
    if (!image || typeof image !== 'object' || Array.isArray(image)) return null;
    const candidate = image as { url?: unknown; alt?: unknown };
    return typeof candidate.url === 'string' && candidate.url.trim() ? candidate : null;
  };
  Handlebars.registerHelper('socialImageUrl', (doc: unknown) => socialImage(doc)?.url ?? defaultSocialImageUrl);
  Handlebars.registerHelper('socialImageCandidate', socialImage);
  Handlebars.registerHelper('socialImageAlt', (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return 'ModoItaliano';

    const page = doc as Partial<CanonicalDocument>;
    const image = socialImage(doc);
    const title = typeof image?.alt === 'string' && image.alt.trim() ? image.alt : page.title?.trim();
    return title || 'ModoItaliano';
  });
}

function registerPartials(partials: Record<string, string>): void {
  for (const [name, template] of Object.entries(partials)) {
    Handlebars.registerPartial(name, template);
  }

  const bodyAliases: Record<string, string> = {
    richText: 'blocks/rich-text',
    heading: 'blocks/heading',
    image: 'blocks/image',
    list: 'blocks/list',
    divider: 'blocks/divider',
    infoBox: 'blocks/info-box',
    keyPoints: 'blocks/key-points',
    dataTable: 'blocks/data-table',
    liveUpdate: 'blocks/live-update',
    audio: 'blocks/audio',
    youtube: 'blocks/youtube',
    x: 'blocks/x',
    instagram: 'blocks/instagram',
    tiktok: 'blocks/tiktok',
    spotify: 'blocks/spotify',
    pullQuote: 'blocks/pull-quote',
    angelinaPoll: 'blocks/angelina-poll'
  };

  for (const [alias, partialName] of Object.entries(bodyAliases)) {
    const source = partials[partialName];
    if (source) {
      Handlebars.registerPartial(alias, source);
    }
  }
}

function compileLayouts(layouts: Record<LayoutName, string>): void {
  for (const [name, source] of Object.entries(layouts) as [LayoutName, string][]) {
    layoutCache.set(name, Handlebars.compile(source));
  }
}

export function initializeHandlebars(assets: RendererAssets): void {
  if (initialized) return;

  registerHelpers();
  registerPartials(assets.partials);
  compileLayouts(assets.layouts);
  initialized = true;
}

export function renderWithAssets(doc: CanonicalDocument, assets: RendererAssets): string {
  if (!initialized) {
    initializeHandlebars(assets);
  }

  const requestedLayout = (doc as { layout?: string }).layout;
  if (!requestedLayout || !layoutCache.has(requestedLayout as LayoutName)) {
    throw new Error(`Unknown layout "${requestedLayout ?? 'undefined'}". Expected one of: ${layoutNames.join(', ')}`);
  }

  const parsed = canonicalArticleSchema.parse(normalizeDocument(doc));
  const template = layoutCache.get(parsed.layout);
  if (!template) {
    throw new Error(`Layout template missing for \"${parsed.layout}\"`);
  }

  return template(parsed);
}
