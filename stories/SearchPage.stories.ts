import type { Meta, StoryObj } from '@storybook/html';
import { render } from '../src/renderer.browser';
import type { CanonicalArticle } from '../src/types/canonical-article';
import { searchCopyByLanguage } from '../src/search-copy';

const nowIso = new Date().toISOString();

const searchPageFixture: CanonicalArticle = {
  id: 'search-story',
  slug: '/search',
  layout: 'search-page',
  canonicalUrl: 'https://modoitaliano.fm/search',
  contentVersion: nowIso,
  publishedAt: nowIso,
  updatedAt: nowIso,
  status: 'published',
  title: 'Buscar',
  excerpt: 'Busca noticias de ModoItaliano.',
  language: 'es',
  featured: false,
  authors: [{ name: 'Redacción de ModoItaliano', slug: 'redaccion-modoitaliano' }],
  categories: [{ name: 'Noticias destacadas', slug: 'noticias-destacadas' }],
  body: [],
  seo: {
    metaTitle: 'Buscar | ModoItaliano',
    metaDescription: 'Busca noticias de ModoItaliano.'
  },
  navigation: {
    categories: [
      { name: 'Mundo', slug: 'mundo' },
      { name: 'Economía', slug: 'economía' },
      { name: 'Deportes', slug: 'deportes' }
    ]
  },
  articles: [],
  searchCopy: searchCopyByLanguage.es
};

const meta = {
  title: 'Pages/SearchPage',
  render: (args) => render(args as CanonicalArticle),
  args: searchPageFixture
} satisfies Meta<CanonicalArticle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const English: Story = {
  args: {
    ...searchPageFixture,
    slug: '/en/search',
    canonicalUrl: 'https://modoitaliano.fm/en/search',
    title: 'Search',
    language: 'en',
    searchCopy: searchCopyByLanguage.en,
    seo: { metaTitle: 'Search | ModoItaliano', metaDescription: 'Search ModoItaliano news.' }
  }
};

export const Italian: Story = {
  args: {
    ...searchPageFixture,
    slug: '/it/search',
    canonicalUrl: 'https://modoitaliano.fm/it/search',
    title: 'Cerca',
    language: 'it',
    searchCopy: searchCopyByLanguage.it,
    seo: { metaTitle: 'Cerca | ModoItaliano', metaDescription: 'Cerca le notizie di ModoItaliano.' }
  }
};

export const ClientSideOnly: Story = {
  name: 'Búsqueda del lado del cliente',
  args: {
    ...searchPageFixture
  },
  parameters: {
    docs: {
      description: {
        story:
          'En /search, el envío actualiza los parámetros de consulta y vuelve a ejecutar los resultados en el cliente. Los resultados coincidentes se muestran primero por fecha de publicación.'
      }
    }
  }
};
