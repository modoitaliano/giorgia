import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import { expect } from 'storybook/test';
import streamPlayerHbs from '../../src/templates/partials/components/stream-player.hbs?raw';

const template = Handlebars.compile(streamPlayerHbs);

const meta = {
  title: 'Partials/Components/StreamPlayer',
  render: () =>
    `<div class='min-h-screen bg-slate-100 dark:bg-slate-950'>${template({
      streamPlayerVisible: true,
      streamPlayerNowPlaying: { title: 'Volare', artist: 'Domenico Modugno' }
    })}</div>`
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const player = canvasElement.querySelector<HTMLElement>('[data-stream-player]');
    await expect(player).toHaveAttribute('data-swup-persist', 'stream-player');
    await expect(player?.style.viewTransitionName).toBe('stream-player');
  },
  parameters: {
    docs: {
      description: {
        story: 'El reproductor aparece cuando ModoItaliano FM ya está reproduciéndose. Recibe el título y artista del mismo feed de “now playing” que utiliza el masthead; esos metadatos permanecen visibles durante una pausa de buffer, el volumen usa un control compatible con móvil, y toda la barra permanece visualmente estable durante la navegación.'
      }
    }
  }
};
