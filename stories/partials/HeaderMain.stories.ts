import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import { expect, waitFor } from 'storybook/test';
import headerMainHbs from '../../src/templates/partials/headers/header-main.hbs?raw';
import navCategoriesHbs from '../../src/templates/partials/nav/nav-categories.hbs?raw';
import { homepageFixture } from '../fixtures/homepage.fixture';
import { registerCommonHelpers } from './handlebars-helpers';

registerCommonHelpers();
Handlebars.registerPartial('nav/nav-categories', navCategoriesHbs);

const template = Handlebars.compile(headerMainHbs);
const NOW_PLAYING_URL = 'https://cdn.modoitaliano.fm/content/now-playing.json';
const WEATHER_URL = 'https://cdn.fifthbell.com/content/weather-current.json';

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

const defaultNowPlaying: NowPlayingStoryItem = {
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
};

const weatherPayload = {
  cities: [
    { name: 'Antofagasta', country: 'Chile', temp: 61, condition: 'cloudy' },
    { name: 'New York City', country: 'United States', temp: 79, condition: 'cloudy' },
    { name: 'Rome', country: 'Italy', temp: 77, condition: 'sunny' },
    { name: 'Sanremo', country: 'Italy', temp: 92, condition: 'sunny' },
    { name: 'Tala', country: 'Uruguay', temp: 46, condition: 'cloudy' },
    { name: 'Montevideo', country: 'Uruguay', temp: 46, condition: 'cloudy' },
    { name: 'Viña del Mar', country: 'Chile', temp: 50, condition: 'cloudy' },
    { name: 'Santiago', country: 'Chile', temp: 44, condition: 'cloudy' }
  ]
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
      if (url.startsWith(WEATHER_URL)) {
        return new Response(JSON.stringify(weatherPayload), {
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
  decorators: [withNowPlaying(defaultNowPlaying)],
  play: async ({ canvasElement }) => {
    const desktopLink = canvasElement.querySelector(
      'nav[aria-label="Navegación principal"] a[href="/quienes-somos"]'
    );
    const menuLink = canvasElement.querySelector(
      'nav[aria-label="Todas las secciones"] a[href="/quienes-somos"]'
    );

    await expect(desktopLink).toHaveTextContent('Quienes somos');
    await expect(menuLink).toHaveTextContent('Quienes somos');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Masthead radiofónico con la canalización de tipografías Modo Italiano autocontenida: navegación en Barlow 700, tipografía de pista en Barlow Condensed y UI complementaria en Outfit, junto al logo MI empaquetado. La barra meteorológica usa un gradiente translúcido y desenfoque de fondo. La navegación principal y el menú desplegable enlazan a la página Quienes somos. La ruta predeterminada del logo es `https://cdn.modoitaliano.fm/assets/mi.svg`; el manifiesto de despliegue `fontFiles()` lo entrega como `assets/mi.svg` junto a las fuentes y la hoja de estilos, con una capa azul marino desenfocada, carrusel de ilustraciones Ken Burns centrado y un reproductor de “now playing” que consulta `https://cdn.modoitaliano.fm/content/now-playing.json` en el cliente cada 45 segundos. El reproductor se acerca al logo y sobresale del masthead también en móvil; el menú abierto se apila por encima de la tarjeta de reproducción.'
      }
    }
  }
};

export const WeatherRotation: Story = {
  decorators: [withNowPlaying(defaultNowPlaying)],
  play: async ({ canvasElement }) => {
    const weather = canvasElement.querySelector<HTMLElement>('[data-weather-current]');
    await waitFor(() => expect(weather).not.toHaveAttribute('hidden'));
    await expect(weather).toHaveAttribute('data-weather-unit', 'celsius');
    await expect(canvasElement.querySelector('[data-weather-temperature]')?.textContent).toMatch(/^-?\d+°C$/);

    const expectedMonth = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(new Date());
    await expect(canvasElement.querySelector('[data-weather-date]')?.textContent).toContain(expectedMonth);

    const sequence = canvasElement
      .querySelector<HTMLElement>('[data-giorgia-weather-bar]')
      ?.dataset.weatherSequence?.split('|') ?? [];
    const cities = canvasElement
      .querySelector<HTMLElement>('[data-giorgia-weather-bar]')
      ?.dataset.weatherCities?.split('|') ?? [];
    await expect(cities.sort()).toEqual([
      'Montevideo',
      'New York City',
      'Sanremo',
      'Santiago',
      'Tala',
      'Viña del Mar'
    ]);
    await expect(sequence.length).toBe(cities.length);
    sequence.forEach((country, index) => {
      expect(country).not.toBe(sequence[(index + 1) % sequence.length]);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'La barra consulta el JSON meteorológico compartido cada hora, muestra todas las temperaturas en Celsius y rota las ciudades sin agrupar países consecutivos.'
      }
    }
  }
};

export const SpanishDate: Story = {
  decorators: [withNowPlaying(defaultNowPlaying)],
  play: async ({ canvasElement }) => {
    const expectedDate = new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
    await waitFor(() => expect(canvasElement.querySelector('[data-weather-date]')?.textContent).toBe(expectedDate));
  },
  parameters: {
    docs: {
      description: {
        story: 'La fecha editorial de Giorgia siempre usa la localización española.'
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
