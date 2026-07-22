import type { Meta, StoryObj } from '@storybook/html';
import { render } from '../src/renderer.browser';
import type { CanonicalArticle } from '../src/types/canonical-article';

const nowIso = new Date().toISOString();

const comingSoonFixture: CanonicalArticle = {
  id: 'coming-soon-story',
  slug: '/coming-soon',
  layout: 'coming-soon',
  canonicalUrl: 'https://modoitaliano.fm/coming-soon',
  contentVersion: nowIso,
  publishedAt: nowIso,
  updatedAt: nowIso,
  status: 'published',
  title: 'Coming Soon',
  excerpt: 'Estamos preparando algo especial. Vuelve pronto para descubrirlo.',
  language: 'es',
  featured: false,
  authors: [{ name: 'ModoItaliano Desk', slug: 'modoitaliano-desk' }],
  categories: [],
  body: [],
  navigation: {
    categories: [
      { name: 'Noticias', slug: 'noticias' },
      { name: 'Música', slug: 'musica' },
      { name: 'Cultura', slug: 'cultura' }
    ]
  }
};

const meta = {
  title: 'Pages/ComingSoonPage',
  render: (args) => render(args as CanonicalArticle),
  args: comingSoonFixture
} satisfies Meta<CanonicalArticle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
