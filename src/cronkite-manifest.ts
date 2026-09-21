import { searchCopyByLanguage } from './search-copy.js';
import type { CronkiteDeclarativeTemplateManifest, SystemVariant } from './types/cronkite-manifest.generated.js';
import { version } from './version.js';

const pagePartials = [
  'shell/doc-start-standard',
  'headers/header-main',
  'footers/footer-full',
  'shell/doc-end',
] as const;

const partial = (name: string, partials: readonly string[] = []) => ({
  entry: `src/templates/partials/${name}.hbs`,
  partials: [...partials],
});

const page = (layout: string, partials: readonly string[]) => ({
  template: {
    entry: `src/templates/layouts/${layout}.hbs`,
    partials: [...partials],
  },
  inputSchema: 'dist/schemas/canonical-document.schema.json',
  contentType: 'text/html; charset=utf-8',
});

type Language = keyof typeof searchCopyByLanguage;

const localizedSystemCopy = {
  es: {
    notFound: ['Página no encontrada', 'La página que buscas no existe.', 'Ir al inicio', 'También puedes explorar nuestras secciones:'],
    search: ['Buscar', 'Busca noticias de ModoItaliano.'],
    comingSoon: ['Próximamente', 'Estamos preparando algo especial. Vuelve pronto para descubrirlo.'],
  },
  en: {
    notFound: ['Page Not Found', 'The page you are looking for does not exist.', 'Go to the homepage', 'You can also explore our sections:'],
    search: ['Search', 'Search ModoItaliano news.'],
    comingSoon: ['Coming soon', 'We are preparing something special. Come back soon.'],
  },
  it: {
    notFound: ['Pagina non trovata', 'La pagina che stai cercando non esiste.', 'Vai alla home page', 'Puoi anche esplorare le nostre sezioni:'],
    search: ['Cerca', 'Cerca le notizie di ModoItaliano.'],
    comingSoon: ['Prossimamente', 'Stiamo preparando qualcosa di speciale. Torna presto.'],
  },
} as const;

const systemDocument = (
  layout: '404' | 'search-page' | 'coming-soon',
  language: Language,
  slug: string,
  title: string,
  excerpt: string,
  extra: Record<string, unknown> = {},
) => ({
  id: `system-${layout}-${language}`,
  slug,
  canonicalUrl: `https://modoitaliano.fm${slug}`,
  contentVersion: '2026-09-21T00:00:00.000Z',
  publishedAt: '2026-09-21T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
  status: 'published',
  title,
  excerpt,
  language,
  featured: false,
  body: [],
  layout,
  authors: [{ name: 'Redacción de ModoItaliano', slug: 'redaccion-modoitaliano' }],
  categories: [],
  navigation: { categories: [] },
  seo: {
    metaTitle: `${title} | ModoItaliano`,
    metaDescription: excerpt,
    socialImage: {
      url: 'https://cdn.modoitaliano.fm/assets/default-og.jpg',
      alt: title,
    },
  },
  ...extra,
});

const systemVariants = (
  layout: '404' | 'search-page' | 'coming-soon',
  segment: string,
  createExtra: (language: Language) => Record<string, unknown> = () => ({}),
): [SystemVariant, ...SystemVariant[]] => {
  const variants = (['es', 'en', 'it'] as const).map((language) => {
    const localizedSegment = language === 'es' ? `/${segment}` : `/${language}/${segment}`;
    const copy = localizedSystemCopy[language][layout === '404' ? 'notFound' : layout === 'search-page' ? 'search' : 'comingSoon'];
    return {
      key: language === 'es' ? `html/${segment}/index.html` : `html/${language}/${segment}/index.html`,
      document: systemDocument(layout, language, localizedSegment, copy[0], copy[1], createExtra(language)),
    };
  });
  return [variants[0], ...variants.slice(1)];
};

const immutable = 'public, max-age=31536000, immutable';
const fontNames = [
  'barlow-condensed-latin-300-normal.woff2',
  'barlow-condensed-latin-400-normal.woff2',
  'barlow-condensed-latin-500-normal.woff2',
  'barlow-condensed-latin-600-normal.woff2',
  'barlow-condensed-latin-700-normal.woff2',
  'barlow-condensed-latin-800-normal.woff2',
  'barlow-latin-400-normal.woff2',
  'barlow-latin-500-normal.woff2',
  'barlow-latin-600-normal.woff2',
  'barlow-latin-700-normal.woff2',
  'barlow-latin-800-normal.woff2',
  'outfit-latin-400-normal.woff2',
  'outfit-latin-500-normal.woff2',
  'outfit-latin-600-normal.woff2',
  'outfit-latin-700-normal.woff2',
  'outfit-latin-800-normal.woff2',
] as const;

export const cronkiteManifest = {
  package: '@modoitaliano/giorgia',
  version,
  templateRendering: {
    contract: 'cronkite.templates',
    contractVersion: 1,
    partials: {
      'shell/doc-start-standard': partial('shell/doc-start-standard'),
      'shell/doc-start-404': partial('shell/doc-start-404'),
      'headers/header-main': partial('headers/header-main'),
      'footers/footer-full': partial('footers/footer-full'),
      'shell/doc-end': partial('shell/doc-end', ['components/stream-player']),
      'components/stream-player': partial('components/stream-player'),
      'components/article-main': partial('components/article-main', ['components/body-block', 'components/snack']),
      'components/body-block': partial('components/body-block', [
        'blocks/audio', 'blocks/data-table', 'blocks/divider', 'blocks/heading',
        'blocks/image', 'blocks/info-box', 'blocks/instagram', 'blocks/key-points',
        'blocks/list', 'blocks/live-update', 'blocks/pull-quote', 'blocks/rich-text',
        'blocks/spotify', 'blocks/tiktok', 'blocks/x', 'blocks/youtube',
      ]),
      'blocks/audio': partial('blocks/audio'),
      'blocks/data-table': partial('blocks/data-table'),
      'blocks/divider': partial('blocks/divider'),
      'blocks/heading': partial('blocks/heading'),
      'blocks/image': partial('blocks/image'),
      'blocks/info-box': partial('blocks/info-box'),
      'blocks/instagram': partial('blocks/instagram'),
      'blocks/key-points': partial('blocks/key-points'),
      'blocks/list': partial('blocks/list'),
      'blocks/live-update': partial('blocks/live-update'),
      'blocks/pull-quote': partial('blocks/pull-quote'),
      'blocks/rich-text': partial('blocks/rich-text'),
      'blocks/spotify': partial('blocks/spotify'),
      'blocks/tiktok': partial('blocks/tiktok'),
      'blocks/x': partial('blocks/x'),
      'blocks/youtube': partial('blocks/youtube'),
      'components/snack': partial('components/snack', ['components/snack-meta-image-row', 'components/snack-meta-inline']),
      'components/snack-top-story': partial('components/snack-top-story', ['components/snack']),
      'components/snack-meta-image-row': partial('components/snack-meta-image-row'),
      'components/snack-meta-inline': partial('components/snack-meta-inline'),
      'components/category/main': partial('components/category/main', ['components/category/header', 'components/category/main-grid', 'components/category/more-grid']),
      'components/category/header': partial('components/category/header'),
      'components/category/main-grid': partial('components/category/main-grid', ['components/snack']),
      'components/category/more-grid': partial('components/category/more-grid'),
      'components/search/main': partial('components/search/main'),
      'components/not-found/main': partial('components/not-found/main'),
      'components/coming-soon/main': partial('components/coming-soon/main'),
      'components/home/main': partial('components/home/main', [
        'components/spotlight-hero', 'components/spotlight-hero-slides', 'components/editorial-hero',
        'components/breaking-news', 'components/home/landing', 'components/home/must-read',
        'components/home/more-stories',
      ]),
      'components/spotlight-hero': partial('components/spotlight-hero', ['components/headline']),
      'components/spotlight-hero-slides': partial('components/spotlight-hero-slides', ['components/spotlight-hero']),
      'components/headline': partial('components/headline'),
      'components/editorial-hero': partial('components/editorial-hero', ['components/headline']),
      'components/breaking-news': partial('components/breaking-news', ['components/breaking-news/live-updates-column']),
      'components/breaking-news/live-updates-column': partial('components/breaking-news/live-updates-column'),
      'components/home/landing': partial('components/home/landing', ['components/snack', 'components/snack-top-story']),
      'components/home/must-read': partial('components/home/must-read', ['components/snack']),
      'components/home/more-stories': partial('components/home/more-stories', ['components/snack']),
      'components/live-story/main': partial('components/live-story/main', [
        'components/ui/status-badge', 'components/body-block', 'components/snack',
      ]),
      'components/ui/status-badge': partial('components/ui/status-badge'),
      'components/media/main': partial('components/media/main'),
      'components/standalone-main': partial('components/standalone-main', ['components/body-block']),
    },
    helperConfig: {
      siteName: 'ModoItaliano',
      defaultLanguage: 'es',
      supportedLanguages: ['es', 'en', 'it'],
      prefixDefaultLocale: false,
      dateLocale: 'es-ES',
      timeZone: 'America/New_York',
      homepageTitles: { es: 'ModoItaliano', en: 'ModoItaliano', it: 'ModoItaliano' },
      layoutTitleFallbacks: {
        'article-page': 'Artículo', homepage: 'ModoItaliano', 'category-page': 'Categoría',
        'search-page': 'Buscar', '404': 'Página no encontrada', 'coming-soon': 'Próximamente',
        'live-story': 'Cobertura en vivo', 'link-in-bio': 'Noticias destacadas',
        'media-page': 'Medios', 'standalone-page': 'ModoItaliano',
      },
      titleSeparator: ' | ',
      defaultSocialImageUrl: 'https://cdn.modoitaliano.fm/assets/default-og.jpg',
    },
    embedRegistry: {
      'x-status': {
        urlTemplate: 'https://twitter.com/{username}/status/{id}',
        parameters: { username: { type: 'string', pattern: '^[A-Za-z0-9_]{1,15}$' }, id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      'x-embed': {
        urlTemplate: 'https://platform.twitter.com/embed/Tweet.html?id={id}&dnt=true',
        parameters: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      instagram: {
        urlTemplate: 'https://www.instagram.com/p/{shortcode}/embed/',
        parameters: { shortcode: { type: 'string', pattern: '^[A-Za-z0-9_-]+$' } },
      },
      tiktok: {
        urlTemplate: 'https://www.tiktok.com/embed/v2/{id}',
        parameters: { id: { type: 'string', pattern: '^[0-9]+$' } },
      },
      spotify: {
        urlTemplate: 'https://open.spotify.com/embed/{kind}/{id}',
        parameters: {
          kind: { type: 'string', enum: ['track', 'album', 'playlist', 'episode', 'show'] },
          id: { type: 'string', pattern: '^[A-Za-z0-9]+$' },
        },
      },
      'sofascore-widget': {
        urlTemplate: 'https://widgets.sofascore.com/embed/attackMomentum?id={id}&widgetTheme={widgetTheme}',
        parameters: {
          id: { type: 'integer', minimum: 1 },
          widgetTheme: { type: 'string', enum: ['light', 'dark'], default: 'light' },
        },
      },
      'sofascore-match': {
        urlTemplate: 'https://www.sofascore.com/football/match#id:{id}',
        parameters: { id: { type: 'integer', minimum: 1 } },
      },
    },
    renderables: {
      'article-page': page('article-page', [pagePartials[0], pagePartials[1], 'components/article-main', pagePartials[2], pagePartials[3]]),
      homepage: page('homepage', [pagePartials[0], pagePartials[1], 'components/home/main', pagePartials[2], pagePartials[3]]),
      'category-page': page('category-page', [pagePartials[0], pagePartials[1], 'components/category/main', pagePartials[2], pagePartials[3]]),
      'search-page': page('search-page', [pagePartials[0], pagePartials[1], 'components/search/main', pagePartials[2], pagePartials[3]]),
      '404': page('404', ['shell/doc-start-404', pagePartials[1], 'components/not-found/main', pagePartials[2], pagePartials[3]]),
      'coming-soon': page('coming-soon', [pagePartials[0], pagePartials[1], 'components/coming-soon/main', pagePartials[2], pagePartials[3]]),
      'live-story': page('live-story', [pagePartials[0], pagePartials[1], 'components/live-story/main', pagePartials[2], pagePartials[3]]),
      'link-in-bio': page('link-in-bio', []),
      'media-page': page('media-page', [pagePartials[0], pagePartials[1], 'components/media/main', pagePartials[2], pagePartials[3]]),
      'standalone-page': page('standalone-page', [pagePartials[0], pagePartials[1], 'components/standalone-main', pagePartials[2], pagePartials[3]]),
      'social-image': {
        template: { entry: 'src/templates/templates/instagram-image.hbs', partials: [] },
        inputSchema: 'dist/schemas/social-image-input.schema.json',
        contentType: 'image/jpeg',
        raster: { format: 'jpeg', width: 1080, height: 1350 },
      },
    },
    staticAssets: {
      ...Object.fromEntries(fontNames.map((name) => [`content/fonts/${name}`, { source: `dist/fonts/${name}`, contentType: 'font/woff2', cacheControl: immutable }])),
      'content/fonts/fonts.css': { source: 'dist/fonts/fonts.css', contentType: 'text/css; charset=utf-8', cacheControl: immutable },
      'content/styles/giorgia.css': { source: 'src/styles/compiled.css', contentType: 'text/css; charset=utf-8', cacheControl: immutable },
      'assets/default-og.jpg': { source: 'dist/assets/default-og.jpg', contentType: 'image/jpeg', cacheControl: immutable },
      'assets/default-og.png': { source: 'dist/assets/default-og.png', contentType: 'image/png', cacheControl: immutable },
      'assets/giorgia-navigation.js': { source: 'dist/assets/giorgia-navigation.js', contentType: 'text/javascript; charset=utf-8', cacheControl: immutable },
      'assets/mi.svg': { source: 'dist/assets/mi.svg', contentType: 'image/svg+xml', cacheControl: immutable },
    },
    systemPages: [
      {
        renderable: '404',
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'public, max-age=0, must-revalidate',
        variants: systemVariants('404', '404', (language) => ({
          homeLinkLabel: localizedSystemCopy[language].notFound[2],
          categoriesLabel: localizedSystemCopy[language].notFound[3],
        })),
      },
      {
        renderable: 'search-page',
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'public, max-age=0, must-revalidate',
        variants: systemVariants('search-page', 'search', (language) => ({ searchCopy: searchCopyByLanguage[language] })),
      },
      {
        renderable: 'coming-soon',
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'public, max-age=0, must-revalidate',
        variants: systemVariants('coming-soon', 'coming-soon'),
      },
    ],
  },
} as const satisfies CronkiteDeclarativeTemplateManifest;
