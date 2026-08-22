export const outletConfig = {
  siteName: 'ModoItaliano',
  publicSiteUrl: 'https://modoitaliano.fm',
  cdnUrl: 'https://cdn.modoitaliano.fm',
  contentPath: '/content',
  inventoryFilename: 'cronkite-inventory.json',
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en', 'it'],
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
  searchTitle: 'Buscar',
  searchDescriptions: {
    es: 'Busca noticias de ModoItaliano.',
    en: 'Search ModoItaliano news.',
    it: 'Cerca le notizie di ModoItaliano.',
  },
  socialLanguages: ['es'],
  socialUserAgent: 'Cronkite/1.0',
  socialImageExport: 'buildInstagramImageHtml',
  hashtagServiceBaseUrl: 'http://192.168.0.99:8000'
} as const;
