import type { Meta, StoryObj } from '@storybook/html';
import Handlebars from 'handlebars';
import headerMainHbs from '../../src/templates/partials/headers/header-main.hbs?raw';
import navCategoriesHbs from '../../src/templates/partials/nav/nav-categories.hbs?raw';
import { homepageFixture } from '../fixtures/homepage.fixture';
import { registerCommonHelpers } from './handlebars-helpers';

registerCommonHelpers();
Handlebars.registerPartial('nav/nav-categories', navCategoriesHbs);

const template = Handlebars.compile(headerMainHbs);

const meta = {
  title: 'Partials/Headers/Main',
  render: (args) => template(args),
  args: { ...homepageFixture, logoLink: '/' }
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Masthead radiofónico con la canalización de tipografías Modo Italiano autocontenida: navegación en Barlow 700, tipografía de pista en Barlow Condensed y UI complementaria en Outfit, junto al logo MI empaquetado. La ruta predeterminada del logo es `https://cdn.modoitaliano.fm/assets/mi.svg`; el manifiesto de despliegue `fontFiles()` lo entrega como `assets/mi.svg` junto a las fuentes y la hoja de estilos, con una capa azul marino desenfocada, carrusel de ilustraciones Ken Burns centrado y un reproductor estático de “Triangolo” de Renato Zero que nunca hereda contenido de la página.'
      }
    }
  }
};

export const StaticNowPlaying: Story = {
  args: {
    featuredImage: undefined,
    hero: undefined,
    authors: [],
    categories: [{ name: 'Live radio', slug: 'live-radio' }]
  },
  parameters: {
    docs: {
      description: {
        story: 'Confirma que la tarjeta de reproducción permanece en “Triangolo” de Renato Zero cuando no hay ilustración, autores ni categorías de página disponibles.'
      }
    }
  }
};
