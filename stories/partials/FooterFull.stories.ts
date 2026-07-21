import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import footerFullHbs from '../../src/templates/partials/footers/footer-full.hbs?raw';

const template = Handlebars.compile(footerFullHbs);

const meta = {
  title: 'Partials/Footers/Full',
  render: (args) => template(args),
  args: {},
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The centered brand treatment uses only the MI SVG at `https://cdn.modoitaliano.fm/assets/mi.svg`, enclosed in a $rgb(50,50,50)$ box with no adjacent wordmark text. The social row includes X, Instagram, TikTok, and the AristonSpritz YouTube channel.'
      }
    }
  }
};
