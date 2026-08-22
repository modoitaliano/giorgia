import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import { expect } from 'storybook/test';
import footerFullHbs from '../../src/templates/partials/footers/footer-full.hbs?raw';
import { registerCommonHelpers } from './handlebars-helpers';

registerCommonHelpers();

const template = Handlebars.compile(footerFullHbs);

const meta = {
  title: 'Partials/Footers/Full',
  render: (args) => template(args),
  args: {},
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[aria-label="Síguenos en Instagram"]')).toHaveAttribute(
      'href',
      'https://www.instagram.com/modoitaliano.fm/'
    );
    await expect(canvasElement.querySelector('[aria-label="Síguenos en TikTok"]')).toHaveAttribute(
      'href',
      'https://www.tiktok.com/@modoitaliano.fm'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The single shared site footer is used by every standard page, including the 404. The centered brand treatment uses only the MI SVG at `https://cdn.modoitaliano.fm/assets/mi.svg`, enclosed in a $rgb(50,50,50)$ box with no adjacent wordmark text. The social row links to `modoitaliano.fm` on Instagram and TikTok, plus X and the AristonSpritz YouTube channel.'
      }
    }
  }
};
