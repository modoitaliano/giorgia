import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import headerMainHbs from '../../src/templates/partials/headers/header-main.hbs?raw';
import navCategoriesHbs from '../../src/templates/partials/nav/nav-categories.hbs?raw';
import { homepageFixture } from '../fixtures/homepage.fixture';
import { registerCommonHelpers } from './handlebars-helpers';

registerCommonHelpers();
Handlebars.registerPartial('nav/nav-categories', navCategoriesHbs);

const template = Handlebars.compile(headerMainHbs);
const NOW_PLAYING_URL = 'https://cdn.modoitaliano.fm/content/now-playing.json';

type NowPlayingStoryItem = {
  status: string;
  station: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  externalUrl: string;
  isPlaceholder: boolean;
  updatedAt: string;
};

const withNowPlaying =
  (item: NowPlayingStoryItem) =>
  (story: () => string): string => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === NOW_PLAYING_URL) {
        return new Response(JSON.stringify(item), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(input, init);
    };
    queueMicrotask(() => hydrateNowPlayingPreview(item));
    return story();
  };

const hydrateNowPlayingPreview = (item: NowPlayingStoryItem): void => {
  const root = document.querySelector('[data-now-playing]');
  if (!(root instanceof HTMLElement)) return;

  const artwork = root.querySelector('[data-now-playing-artwork]');
  const brand = root.querySelector('[data-now-playing-brand]');
  const status = root.querySelector('[data-now-playing-status]');
  const title = root.querySelector('[data-now-playing-title]');
  const artist = root.querySelector('[data-now-playing-artist]');
  if (!(artwork instanceof HTMLImageElement) || !(brand instanceof HTMLElement) || !(status instanceof HTMLElement) || !(title instanceof HTMLElement) || !(artist instanceof HTMLElement)) return;

  title.textContent = item.title.trim() || 'ModoItaliano';
  artist.textContent = item.artist.trim() || 'Live radio';
  status.textContent = item.isPlaceholder ? 'En directo' : 'Reproduciendo';

  if (!item.isPlaceholder && item.artworkUrl.trim()) {
    artwork.src = item.artworkUrl.trim();
    artwork.alt = [item.title, item.artist].filter(Boolean).join(' by ');
    artwork.classList.remove('hidden');
    brand.classList.add('hidden');
  } else {
    brand.classList.remove('hidden');
    artwork.classList.add('hidden');
    artwork.removeAttribute('src');
    artwork.alt = '';
  }
};

const meta = {
  title: 'Partials/Headers/Main',
  render: (args) => template(args),
  args: { ...homepageFixture, logoLink: '/' }
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = {
  decorators: [
    withNowPlaying({
      status: 'playing',
      station: 'modoitaliano',
      source: 'alcantara',
      title: 'Volare',
      artist: 'Domenico Modugno',
      album: '',
      artworkUrl: '',
      externalUrl: 'https://modoitaliano.fm/',
      isPlaceholder: false,
      updatedAt: '2026-07-21T18:53:33Z'
    })
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Masthead radiofónico con la canalización de tipografías Modo Italiano autocontenida: navegación en Barlow 700, tipografía de pista en Barlow Condensed y UI complementaria en Outfit, junto al logo MI empaquetado. La ruta predeterminada del logo es `https://cdn.modoitaliano.fm/assets/mi.svg`; el manifiesto de despliegue `fontFiles()` lo entrega como `assets/mi.svg` junto a las fuentes y la hoja de estilos, con una capa azul marino desenfocada, carrusel de ilustraciones Ken Burns centrado y un reproductor de “now playing” que consulta `https://cdn.modoitaliano.fm/content/now-playing.json` en el cliente cada 45 segundos. El reproductor se acerca al logo y sobresale del masthead también en móvil; el menú abierto se apila por encima de la tarjeta de reproducción.'
      }
    }
  }
};

export const PlaceholderNowPlaying: Story = {
  args: {
    featuredImage: undefined,
    hero: undefined,
    authors: [],
    categories: [{ name: 'Live radio', slug: 'live-radio' }]
  },
  decorators: [
    withNowPlaying({
      status: 'playing',
      station: 'modoitaliano',
      source: 'alcantara',
      title: 'ModoItaliano',
      artist: 'Live radio',
      album: '',
      artworkUrl: '',
      externalUrl: 'https://modoitaliano.fm/',
      isPlaceholder: true,
      updatedAt: '2026-07-21T18:53:33Z'
    })
  ],
  parameters: {
    docs: {
      description: {
        story: 'Confirma que `isPlaceholder: true` conserva el tratamiento visual de marca/default, aunque sigue usando `title` y `artist` como texto visible.'
      }
    }
  }
};
