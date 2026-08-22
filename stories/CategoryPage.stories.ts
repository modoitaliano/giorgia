import type { Meta, StoryObj } from '@storybook/html';
import { expect } from 'storybook/test';
import { render } from '../src/renderer.browser';
import { categoryFixture } from './fixtures/category.fixture';
import type { CanonicalArticle } from '../src/types/canonical-article';
import { loadCategoryPreviewData } from './preview-data';

const meta = {
  title: 'Pages/CategoryPage',
  render: (args) => render(args as typeof categoryFixture),
  args: categoryFixture
} satisfies Meta<typeof categoryFixture>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector<HTMLElement>('[data-category-content]');
    await expect(content).toHaveClass('mt-20');
    await expect(getComputedStyle(content as HTMLElement).marginTop).toBe('80px');
  },
  parameters: {
    docs: {
      description: {
        story: 'La portada de categoría conserva el mismo margen seguro de 5rem que separa el masthead del contenido en los artículos.'
      }
    }
  }
};

export const Current: Story = {
  loaders: [async () => ({ categoryPage: await loadCategoryPreviewData('sports') })],
  render: (_args, { loaded }) => render(loaded.categoryPage as CanonicalArticle),
  parameters: {
    controls: {
      disable: true
    }
  }
};
