import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
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
