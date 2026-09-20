const supportedLanguages = ['es', 'en', 'it'] as const;

const searchTitle = {
  es: 'Buscar',
  en: 'Search',
  it: 'Cerca',
} satisfies Record<(typeof supportedLanguages)[number], string>;

export const outletConfig = {
  siteName: 'ModoItaliano',
  publicSiteUrl: 'https://modoitaliano.fm',
  cdnUrl: 'https://cdn.modoitaliano.fm',
  contentPath: '/content',
  inventoryFilename: 'cronkite-inventory.json',
  defaultLanguage: 'es',
  supportedLanguages,
  prefixDefaultLocale: false,
  defaultAuthor: {
    name: 'Redacción de ModoItaliano',
    slug: 'redaccion-modoitaliano'
  },
  defaultCategory: {
    name: 'Noticias destacadas',
    slug: 'noticias-destacadas'
  },
  linkInBioRoute: '/instagram',
  searchTitle,
  searchDescriptions: {
    es: 'Busca noticias de ModoItaliano.',
    en: 'Search ModoItaliano news.',
    it: 'Cerca le notizie di ModoItaliano.',
  },
  socialLanguages: ['es'],
  socialUserAgent: 'Cronkite/1.0',
  socialImageExport: 'buildInstagramImageHtml'
} as const;
