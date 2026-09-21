import type { Meta, StoryObj } from '@storybook/html';
import { expect } from 'storybook/test';
import { render } from '../src/renderer.browser';
import { homepageFixture, FIXTURE_NOW } from './fixtures/homepage.fixture';
import type { CanonicalArticle } from '../src/types/canonical-article';
import { loadHomepagePreviewData } from './preview-data';
import { distributeHomepageArticles } from '../src/homepage-distributor';

function withHomepageSlots(document: CanonicalArticle, now: Date): CanonicalArticle {
  const showBreakingNews = Boolean(document.breakingNews) && (document as Record<string, unknown>).showBreakingNews !== false;
  return {
    ...document,
    homepageSlots: distributeHomepageArticles(document.articles ?? [], now, showBreakingNews)
  };
}

const sectionControls = {
  showHero: { control: 'boolean' },
  showEditorialHero: { control: 'boolean' },
  showBreakingNews: { control: 'boolean' },
  showLanding: { control: 'boolean' },
  showMustRead: { control: 'boolean' },
  showMoreStories: { control: 'boolean' }
};

const triangoloNowPlaying = {
  title: 'Triangolo',
  artist: 'Renato Zero',
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music/bc/1c/65/mzi.ksajqtzy.jpg/600x600bb.jpg',
  coverAlt: 'Zerolandia album cover by Renato Zero'
};

const meta = {
  title: 'Pages/Homepage',
  loaders: [async () => ({ homepage: await loadHomepagePreviewData() })],
  render: (args, { loaded }) => render(withHomepageSlots({ ...(loaded.homepage as CanonicalArticle), ...args }, new Date())),
  args: {
    showHero: true,
    showEditorialHero: false,
    showBreakingNews: true,
    showLanding: true,
    showMustRead: true,
    showMoreStories: true
  },
  argTypes: sectionControls,
  parameters: {
    controls: {
      include: ['showHero', 'showEditorialHero', 'showBreakingNews', 'showLanding', 'showMustRead', 'showMoreStories']
    }
  }
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    nowPlaying: triangoloNowPlaying,
    showHero: false,
    showEditorialHero: false,
    showBreakingNews: false,
    showLanding: false,
    showMustRead: false,
    showMoreStories: false
  },
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector<HTMLElement>('[data-homepage-content]');
    const pageContent = canvasElement.querySelector<HTMLElement>('#page-content');
    const player = canvasElement.querySelector<HTMLElement>('[data-stream-player]');
    await expect(content).toHaveClass('mt-20');
    await expect(getComputedStyle(content as HTMLElement).marginTop).toBe('80px');
    await expect(pageContent).toContainElement(content);
    await expect(pageContent).toHaveClass('transition-page');
    await expect(pageContent?.contains(player ?? null)).toBe(false);
  },
  parameters: {
    docs: {
      description: {
        story: 'La portada conserva un margen seguro de 5rem y delimita solo el contenido reemplazable; el masthead y el reproductor permanecen fuera durante la navegación.'
      }
    }
  }
};

export const Current: Story = {
  name: 'Current',
  render: (_args, { loaded }) => render(withHomepageSlots(loaded.homepage as CanonicalArticle, new Date())),
  parameters: {
    controls: {
      disable: true
    }
  }
};

/**
 * 8 recent featured articles are available.
 * The first 6 fill the featured slots (newest-first); the remaining 2 float to
 * the top of the general queue ahead of non-featured articles.
 */
export const FeaturedOverflow: Story = {
  name: 'Featured: 8 recent (6 slots + 2 overflow to queue)',
  args: {
    showHero: false,
    showEditorialHero: false,
    showBreakingNews: false
  }
};

/**
 * All articles have featured:false so all 6 prominent slots fall back to the
 * general queue, filled by date descending.
 */
export const NoFeaturedArticles: Story = {
  name: 'Featured: none recent — all slots from queue',
  render: (args) => render(withHomepageSlots(args as CanonicalArticle, FIXTURE_NOW)),
  args: {
    ...homepageFixture,
    showHero: false,
    showEditorialHero: false,
    showBreakingNews: false,
    articles: (homepageFixture.articles ?? []).map((a) => ({ ...a, featured: false }))
  }
};

/**
 * Breaking News is active: the first 5 queue articles are reserved for the
 * Breaking News candy-bar, pushing all other slots down by 5.
 */
export const WithBreakingNews: Story = {
  name: 'Breaking News: queue starts from Breaking News snacks',
  args: {
    showHero: false,
    showEditorialHero: false,
    showBreakingNews: true,
  }
};

/**
 * Verifies queue-fill order: Landing → Must Read → More Stories.
 * Only 3 featured articles exist so 3 featured slots are filled and the rest
 * come from the queue in date-desc order.
 */
export const PartialFeatured: Story = {
  name: 'Featured: 3 recent — partial fill, rest from queue',
  render: (args) => render(withHomepageSlots(args as CanonicalArticle, FIXTURE_NOW)),
  args: {
    ...homepageFixture,
    showHero: false,
    showEditorialHero: false,
    showBreakingNews: false,
    articles: (homepageFixture.articles ?? []).map((a, i) => ({
      ...a,
      featured: i < 3 && new Date(a.publishedAt ?? 0).getTime() >= FIXTURE_NOW.getTime() - 24 * 3600 * 1000
    }))
  }
};
