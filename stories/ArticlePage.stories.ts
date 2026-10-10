import type { Meta, StoryObj } from '@storybook/html';
import { render } from '../src/renderer.browser';
import { articleFixture } from './fixtures/article.fixture';
import type { CanonicalArticle } from '../src/types/canonical-article';
import { loadArticlePreviewData } from './preview-data';

const meta = {
  title: 'Pages/ArticlePage',
  render: (args) => render(args as typeof articleFixture),
  args: articleFixture
} satisfies Meta<typeof articleFixture>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Byline: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The author uses the same editorial red utilities as category labels, including with previously published CSS.',
      },
    },
  },
  args: {
    authors: [{ name: 'Lucia Rossi', slug: 'lucia-rossi' }],
  },
};

export const MultipleAuthors: Story = {
  args: {
    authors: [
      { name: 'Lucia Rossi', slug: 'lucia-rossi' },
      { name: 'Marco Bianchi', slug: 'marco-bianchi' },
    ],
  },
};

export const LongByline: Story = {
  args: {
    authors: [
      { name: 'Redacción de música y cultura de ModoItaliano', slug: 'redaccion-modoitaliano' },
      { name: 'Lucia Rossi', slug: 'lucia-rossi' },
    ],
  },
};

export const BylineDark: Story = {
  decorators: [(story) => `<div class="dark bg-slate-950 text-slate-100">${story()}</div>`],
  args: {
    mourningMode: true,
    authors: [{ name: 'Lucia Rossi', slug: 'lucia-rossi' }],
  },
};

export const Current: Story = {
  loaders: [async () => ({ articlePage: await loadArticlePreviewData() })],
  render: (_args, { loaded }) => render(loaded.articlePage as CanonicalArticle),
  parameters: {
    controls: {
      disable: true
    }
  }
};
