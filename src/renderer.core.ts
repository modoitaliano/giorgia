import Handlebars from 'handlebars';
import { canonicalArticleSchema, type CanonicalDocument } from './types/canonical-article.js';
import { distributeHomepageArticles } from './homepage-distributor.js';
import { buildSofascoreAttackMomentumUrl, buildSofascoreMatchUrl } from './utils/sofascore.js';

export type LayoutName = CanonicalDocument['layout'];

export type RendererAssets = {
  layouts: Record<LayoutName, string>;
  partials: Record<string, string>;
  styles: string;
};

let initialized = false;
const layoutCache = new Map<LayoutName, HandlebarsTemplateDelegate>();
let runtimeStyles = '';
const removedBlockTypes = new Set(['truthSocial', 'truthsocial', 'truth-social', 'truth_social']);
const defaultSocialImageUrl = 'https://cdn.modoitaliano.fm/assets/default-og.jpg';
const siteTitlesByLanguage: Record<CanonicalDocument['language'], string> = {
  en: 'ModoItaliano - Breaking News & Current Events',
  es: 'ModoItaliano - Música italiana, noticias y lanzamientos',
  it: 'ModoItaliano - Ultime notizie e attualità'
};

function normalizePathInput(value: unknown): string {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      const normalizedAbsolute = `/${(parsed.pathname || '').replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
      if (normalizedAbsolute !== '/' && normalizedAbsolute.endsWith('/')) {
        return normalizedAbsolute.slice(0, -1);
      }
      return normalizedAbsolute || '/';
    }
  } catch {
    // Fall back to raw string normalization below.
  }

  const withoutQueryOrHash = trimmed.split('#')[0].split('?')[0];
  const normalized = `/${withoutQueryOrHash.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  if (normalized !== '/' && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function cleanPathSegment(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function buildLocalePath(path: string, language: unknown): string {
  const normalizedLanguage = language === 'en' || language === 'it' ? language : 'es';
  if (!path) return normalizedLanguage === 'es' ? '/' : `/${normalizedLanguage}`;

  const normalized = String(path).startsWith('/') ? String(path) : `/${path}`;
  const localizedPath = normalized.match(/^\/(en|es|it)(?=\/|$)/)?.[1];
  if (localizedPath && localizedPath !== normalizedLanguage) {
    return normalized;
  }

  if (localizedPath === 'es') {
    return normalized.replace(/^\/es(?=\/|$)/, '') || '/';
  }

  if (localizedPath) return normalized;

  if (normalizedLanguage === 'es') {
    return normalized;
  }

  return `/${normalizedLanguage}${normalized}`;
}

function resolveArticleUrl(input: {
  url?: unknown;
  canonicalUrl?: unknown;
  slug?: unknown;
  categories?: unknown;
  category?: unknown;
  language?: unknown;
}): string {
  const explicitUrl = normalizePathInput(input.url);
  if (explicitUrl && explicitUrl !== '/') {
    return buildLocalePath(explicitUrl, input.language);
  }

  const canonicalUrl = normalizePathInput(input.canonicalUrl);
  if (canonicalUrl && canonicalUrl !== '/') {
    return buildLocalePath(canonicalUrl, input.language);
  }

  const slugRaw = typeof input.slug === 'string' ? input.slug : '';
  const normalizedSlugPath = normalizePathInput(slugRaw);
  const slugSegments = normalizedSlugPath.split('/').filter(Boolean);
  if (slugSegments.length > 1) {
    return buildLocalePath(normalizedSlugPath, input.language);
  }

  const slugSegment = cleanPathSegment(slugRaw);
  const categories = Array.isArray(input.categories) ? input.categories : [];
  const primaryCategorySlug =
    cleanPathSegment((categories[0] as { slug?: unknown } | undefined)?.slug) || cleanPathSegment((input.category as { slug?: unknown } | undefined)?.slug);

  if (slugSegment && primaryCategorySlug) {
    return buildLocalePath(`/${primaryCategorySlug}/${slugSegment}`, input.language);
  }

  if (slugSegment) {
    return buildLocalePath(`/${slugSegment}`, input.language);
  }

  return buildLocalePath('/', input.language);
}

function normalizeDocument(doc: CanonicalDocument): CanonicalDocument {
  const rawBody = (doc as { body?: unknown }).body;
  if (!Array.isArray(rawBody)) return doc;

  return {
    ...doc,
    body: rawBody.filter((block) => {
      if (!block || typeof block !== 'object') return true;
      const type = (block as { type?: unknown }).type;
      return typeof type !== 'string' || !removedBlockTypes.has(type);
    }) as CanonicalDocument['body']
  };
}

function registerHelpers(): void {
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('add', (a: unknown, b: unknown) => Number(a) + Number(b));
  Handlebars.registerHelper('slice', (items: unknown, start: number, end?: number) => {
    if (!Array.isArray(items)) return [];
    return items.slice(start, end);
  });
  Handlebars.registerHelper('uppercase', (value: unknown) => String(value ?? '').toUpperCase());
  Handlebars.registerHelper('coalesce', (...args: unknown[]) => {
    const values = args.slice(0, -1);
    for (const value of values) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim().length === 0) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      return value;
    }
    return '';
  });
  Handlebars.registerHelper('articleUrl', (...args: unknown[]) => {
    const options = args[args.length - 1] as Handlebars.HelperOptions | undefined;
    const hash = options?.hash as Record<string, unknown> | undefined;
    const root = options?.data?.root as Record<string, unknown> | undefined;

    return resolveArticleUrl({
      url: hash?.url,
      canonicalUrl: hash?.canonicalUrl,
      slug: hash?.slug,
      categories: hash?.categories,
      category: hash?.category,
      language: hash?.language ?? root?.language
    });
  });
  Handlebars.registerHelper('formatDate', (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isWithin24h = now.getTime() - date.getTime() < 24 * 60 * 60 * 1000;
      if (isWithin24h) {
        return date.toLocaleTimeString('es-ES', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York'
        });
      } else {
        return date.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'America/New_York'
        });
      }
    } catch {
      return isoString;
    }
  });
  Handlebars.registerHelper('xStatusUrl', (url: string) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'x.com' || parsed.hostname === 'www.x.com') {
        return `https://twitter.com${parsed.pathname}`;
      }
      return url;
    } catch {
      return url;
    }
  });
  Handlebars.registerHelper('xEmbedUrl', (url: string) => {
    if (!url) return '';

    const buildEmbedUrl = (tweetId: string) => `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&dnt=true`;
    const idFromRaw = url.match(/status\/(\d+)/)?.[1];

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      if (host === 'x.com' || host === 'twitter.com') {
        const tweetId = parsed.pathname.match(/\/[^/]+\/status\/(\d+)/)?.[1];
        if (tweetId) return buildEmbedUrl(tweetId);
      }
      return idFromRaw ? buildEmbedUrl(idFromRaw) : '';
    } catch {
      return idFromRaw ? buildEmbedUrl(idFromRaw) : '';
    }
  });
  Handlebars.registerHelper('xTweetId', (url: string) => {
    if (!url) return '';
    const idFromRaw = url.match(/status\/(\d+)/)?.[1];
    if (idFromRaw) return idFromRaw;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      if (host === 'x.com' || host === 'twitter.com') {
        return parsed.pathname.match(/\/[^/]+\/status\/(\d+)/)?.[1] ?? '';
      }
      return '';
    } catch {
      return '';
    }
  });
  Handlebars.registerHelper('instagramEmbedUrl', (url: string) => {
    if (!url) return '';
    const normalized = url.endsWith('/') ? url : `${url}/`;
    return `${normalized}embed/`;
  });
  Handlebars.registerHelper('tiktokEmbedUrl', (url: string) => {
    if (!url) return '';
    const match = url.match(/\/video\/(\d+)/);
    if (!match) return url;
    return `https://www.tiktok.com/embed/v2/${match[1]}`;
  });
  Handlebars.registerHelper('spotifyEmbedUrl', (url: string) => {
    if (!url) return '';

    try {
      const parsed = new URL(url);
      if (parsed.hostname.replace(/^www\./, '') !== 'open.spotify.com') return url;
      if (parsed.pathname.startsWith('/embed/')) return url;

      parsed.pathname = `/embed${parsed.pathname}`;
      return parsed.toString();
    } catch {
      return url;
    }
  });
  Handlebars.registerHelper('sofascoreWidgetUrl', (id: unknown) => buildSofascoreAttackMomentumUrl(id));
  Handlebars.registerHelper('sofascoreMatchUrl', (id: unknown) => buildSofascoreMatchUrl(id));
  Handlebars.registerHelper('jsonString', (value: unknown) => {
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  });
  Handlebars.registerHelper('resolveHeadTitle', (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return 'ModoItaliano';
    const page = doc as Partial<CanonicalDocument>;

    if (page.layout === 'homepage') {
      const language = page.language === 'en' || page.language === 'it' ? page.language : 'es';
      return siteTitlesByLanguage[language];
    }

    if (page.layout === 'category-page') {
      const categoryName = page.categories?.[0]?.name?.trim();
      const baseTitle = categoryName || page.title?.trim() || 'Categoría';
      return `${baseTitle} | ModoItaliano`;
    }

    if (page.layout === 'search-page') {
      return 'Buscar | ModoItaliano';
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
  Handlebars.registerHelper('socialImageUrl', (value: unknown) => {
    if (typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw) return '';

    const normalizePath = (pathname: string): string =>
      pathname.replace(/\.avif$/i, '.jpg');

    try {
      const parsed = new URL(raw);
      parsed.pathname = normalizePath(parsed.pathname);
      return parsed.toString();
    } catch {
      // Support relative URLs in template data.
      return normalizePath(raw);
    }
  });
  Handlebars.registerHelper('socialImageCandidate', (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return defaultSocialImageUrl;

    const page = doc as Partial<CanonicalDocument>;
    const seoImage = page.seo?.ogImage?.trim();
    if (seoImage) return seoImage;

    if (page.layout === 'article-page') {
      const featuredImage = page.featuredImage?.url?.trim();
      if (featuredImage) return featuredImage;
    }

    return defaultSocialImageUrl;
  });
  Handlebars.registerHelper('socialImageAlt', (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return 'ModoItaliano';

    const page = doc as Partial<CanonicalDocument>;
    if (page.layout === 'article-page') {
      const featuredAlt = page.featuredImage?.alt?.trim();
      if (featuredAlt) return featuredAlt;
    }

    const title = page.seo?.metaTitle?.trim() || page.title?.trim();
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
    pullQuote: 'blocks/pull-quote'
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
  runtimeStyles = assets.styles;
  initialized = true;
}

export function renderWithAssets(doc: CanonicalDocument, assets: RendererAssets): string {
  if (!initialized) {
    initializeHandlebars(assets);
  }

  const requestedLayout = (doc as { layout?: string }).layout;
  if (!requestedLayout || !layoutCache.has(requestedLayout as LayoutName)) {
    throw new Error(`Unknown layout "${requestedLayout ?? 'undefined'}". Expected one of: article-page, homepage, category-page, search-page, 404, coming-soon, live-story, link-in-bio, media-page`);
  }

  const parsed = canonicalArticleSchema.parse(normalizeDocument(doc));
  const template = layoutCache.get(parsed.layout);
  if (!template) {
    throw new Error(`Layout template missing for \"${parsed.layout}\"`);
  }

  // Build the template context, enriching homepage renders with pre-distributed
  // article slots so templates do not need to perform index arithmetic.
  const docExtra = doc as Record<string, unknown>;
  const showBreakingNews = parsed.layout === 'homepage' && Boolean(parsed.breakingNews) && docExtra['showBreakingNews'] !== false;

  const homepageSlots = parsed.layout === 'homepage' ? distributeHomepageArticles(parsed.articles ?? [], new Date(), showBreakingNews) : undefined;

  return template({
    ...parsed,
    ...(homepageSlots !== undefined ? { homepageSlots } : {}),
    styles: runtimeStyles,
    logoLink: parsed.language === 'es' ? '/' : `/${parsed.language}`
  });
}
