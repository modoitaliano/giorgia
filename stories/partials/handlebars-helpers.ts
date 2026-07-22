import Handlebars from 'handlebars';
import { buildSofascoreAttackMomentumUrl, buildSofascoreMatchUrl } from '../../src/utils/sofascore';

let initialized = false;

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

export function registerCommonHelpers(): void {
  if (initialized) return;

  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

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
  Handlebars.registerHelper('sofascoreWidgetUrl', (id: unknown) => buildSofascoreAttackMomentumUrl(id));
  Handlebars.registerHelper('sofascoreMatchUrl', (id: unknown) => buildSofascoreMatchUrl(id));
  Handlebars.registerHelper('jsonString', (value: unknown) => {
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  });

  initialized = true;
}
