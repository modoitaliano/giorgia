import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import { expect } from 'storybook/test';
import spotifyHbs from '../../src/templates/partials/blocks/spotify.hbs?raw';
import { registerCommonHelpers } from './handlebars-helpers';

registerCommonHelpers();
const template = Handlebars.compile(spotifyHbs);

const meta = {
  title: 'Partials/Blocks/Spotify',
  render: (args) => template(args),
  args: {
    type: 'spotify',
    url: 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp',
    embedKind: 'track',
    embedId: '3n3Ppam7vgaVa1iaRUc9Lp'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

// gaulatti/ariston#217: Cronkite's embedUrl yields '' for a provider its
// registry does not declare. The guarded block then renders no iframe.
const undeclared = Handlebars.create();
undeclared.registerHelper('embedUrl', () => '');
const undeclaredTemplate = undeclared.compile(spotifyHbs);

export const UndeclaredProvider: Story = {
  render: (args) => undeclaredTemplate(args),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('iframe')).toBeNull();
    await expect(canvasElement.textContent).toContain('Open on Spotify');
  },
};
