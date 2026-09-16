import type { Meta, StoryObj } from '@storybook/html';
import { cronkiteManifest } from '../src/cronkite-manifest';
import { render } from '../src/renderer.browser';
import type { CanonicalArticle } from '../src/types/canonical-article';

const nowIso = new Date().toISOString();
const comingSoonContract = cronkiteManifest.systemPages.find((page) => page.layout === 'coming-soon');
if (!comingSoonContract) throw new Error('coming-soon manifest entry missing');
const spanishCopy = comingSoonContract.copy.es;
if (!spanishCopy) throw new Error('coming-soon Spanish copy missing');

const comingSoonFixture: CanonicalArticle = {
  id: 'coming-soon-story',
  slug: '/coming-soon',
  layout: 'coming-soon',
  canonicalUrl: 'https://modoitaliano.fm/coming-soon',
  contentVersion: nowIso,
  publishedAt: nowIso,
  updatedAt: nowIso,
  status: 'published',
  title: spanishCopy.title,
  excerpt: spanishCopy.description,
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

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'La página de llegada no incluye enlaces de navegación ni búsqueda, ya que se publica como la raíz del sitio.'
      }
    }
  }
};
