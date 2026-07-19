import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import headerMainHbs from '../../src/templates/partials/headers/header-main.hbs?raw';
import navCategoriesHbs from '../../src/templates/partials/nav/nav-categories.hbs?raw';
import { homepageFixture } from '../fixtures/homepage.fixture';
import { registerCommonHelpers } from './handlebars-helpers';

registerCommonHelpers();
Handlebars.registerPartial('nav/nav-categories', navCategoriesHbs);

const template = Handlebars.compile(headerMainHbs);

const triangoloNowPlaying = {
  title: 'Triangolo',
  artist: 'Renato Zero',
  coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music/bc/1c/65/mzi.ksajqtzy.jpg/600x600bb.jpg',
  coverAlt: 'Zerolandia album cover by Renato Zero'
};

const meta = {
  title: 'Partials/Headers/Main',
  render: (args) => template(args),
  args: { ...homepageFixture, nowPlaying: triangoloNowPlaying, logoLink: '/' },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Radio-style masthead using the shared self-hosted Modo Italiano font pipeline—Barlow 700 navigation, Barlow Condensed track typography, and Outfit supporting UI—alongside the packaged MI logo, navy 8px-blurred tint, centered Ken Burns artwork slideshow, and a softly rounded now-playing player for “Triangolo” by Renato Zero.'
      }
    }
  }
};

export const NowPlayingFallback: Story = {
  args: {
    featuredImage: undefined,
    hero: undefined,
    authors: [],
    categories: [{ name: 'Live radio', slug: 'live-radio' }]
  },
  parameters: {
    docs: {
      description: {
        story:
          'Uses the built-in artwork fallback and category name when the current item has no artwork or author.'
      }
    }
  }
};
