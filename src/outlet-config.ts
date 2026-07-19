export const outletConfig = {
  siteName: 'ModoItaliano',
  publicSiteUrl: 'https://modoitaliano.fm',
  cdnUrl: 'https://cdn.modoitaliano.fm',
  contentPath: '/content',
  inventoryFilename: 'cronkite-inventory.json',
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'es', 'it'],
  prefixDefaultLocale: false,
  defaultAuthor: {
    name: 'ModoItaliano Newsroom',
    slug: 'modoitaliano-newsroom'
  },
  defaultCategory: {
    name: 'Top Stories',
    slug: 'top-stories'
  },
  linkInBioRoute: '/instagram',
  searchTitle: 'Search',
  searchDescriptions: {
    en: 'Search stories from ModoItaliano.',
    es: 'Busca noticias de ModoItaliano.',
    it: 'Cerca notizie ModoItaliano.'
  },
  socialLanguages: ['en'],
  socialUserAgent: 'Cronkite/1.0',
  socialImageExport: 'buildInstagramImageHtml',
  hashtagServiceBaseUrl: 'http://192.168.0.99:8000'
} as const;
