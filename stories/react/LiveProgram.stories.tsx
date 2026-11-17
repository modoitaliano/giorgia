import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import LiveProgram from '../../src/components/live-program/LiveProgram';
import { harborLightPodcastScene } from './live-program/radio/stage';
import { HARBOR_LIGHT_CTA_SEQUENCE, HARBOR_LIGHT_TEXT_SEQUENCE, HARBOR_LIGHT_TV_PROGRAM } from './live-program/tv/harbor-light.fixture';

const meta: Meta = {
  title: 'React/LiveProgram',
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    programId: { control: 'text' },
    embedded: { control: 'boolean' }
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '100vw';
    container.style.height = '100vh';

    const root = createRoot(container);
    root.render(<LiveProgram {...args} />);

    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    programId: 'modoitaliano',
    embedded: false,
    sceneMetadata: {
      'modoitaliano-content': {
        languageRotation: ['es']
      }
    }
  }
};

export const Embedded: StoryObj = {
  args: {
    programId: 'modoitaliano',
    embedded: true
  }
};

/**
 * A radio scene draws the world clocks and the bell only as Alcantara does for
 * its component list: this one lists only the Giorgia podcast player, so the
 * corner stays empty.
 */
export const RadioSceneWithoutClocks: StoryObj = {
  args: {
    programId: 'modoitaliano',
    embedded: true,
    activeComponents: ['modoitaliano-giorgia-podcast-player'],
    sceneMetadata: { 'modoitaliano-giorgia-podcast-player': harborLightPodcastScene }
  }
};

/** The same radio scene listing Alcantara's fifthbell-corner: clocks and bell draw over the player. */
export const RadioSceneWithCornerClock: StoryObj = {
  args: {
    programId: 'modoitaliano',
    embedded: true,
    activeComponents: ['modoitaliano-giorgia-podcast-player', 'fifthbell-corner'],
    sceneMetadata: { 'modoitaliano-giorgia-podcast-player': harborLightPodcastScene, 'fifthbell-corner': {} }
  }
};

/**
 * TV graphics scenes (giorgia#47): each lists one of Alcantara's TV scene types
 * and draws its component over the stage, with no news, marquee or corner.
 */
const tvScene = (componentType: string, metadata: Record<string, unknown> = {}): StoryObj => ({
  args: {
    programId: 'modoitaliano',
    embedded: true,
    activeComponents: [componentType],
    sceneMetadata: { [componentType]: metadata }
  }
});

export const TvSceneRelojLoopClock: StoryObj = tvScene('reloj-loop-clock', { timezone: 'Europe/Madrid' });

export const TvSceneCronicaBackground: StoryObj = tvScene('cronica-background');

export const TvSceneCronicaChyron: StoryObj = tvScene('cronica-chyron', { text: 'HARBOR LIGHT\nNIGHT SHIFT' });

export const TvSceneCronicaReiteramos: StoryObj = tvScene('cronica-reiteramos', { text: 'REITERAMOS', show: true });

/** A radio scene that also lists reloj-loop-clock: the podcast player with RelojLoopClock over it, and no corner clocks or bell. */
export const RadioSceneWithRelojLoopClock: StoryObj = {
  args: {
    programId: 'modoitaliano',
    embedded: true,
    activeComponents: ['modoitaliano-giorgia-podcast-player', 'reloj-loop-clock'],
    sceneMetadata: { 'modoitaliano-giorgia-podcast-player': harborLightPodcastScene, 'reloj-loop-clock': { timezone: 'Europe/Madrid' } }
  }
};

/** A logo-widget scene (giorgia#48): the scene's logoUrl on LogoWidget's plate; without a logoUrl nothing draws. */
export const TvSceneLogoWidget: StoryObj = tvScene('logo-widget', { logoUrl: '/assets/mi.svg', position: 'bottom-right' });

/**
 * Giorgia clock and chyron scenes (giorgia#50), drawn as Alcantara draws them:
 * each by itself, or both in the bottom row when the scene lists both. Stories
 * have no event stream, so the on-air block (the song sequence from
 * audio_bus_update) does not show here.
 */
const giorgiaChyron = { textSequence: HARBOR_LIGHT_TEXT_SEQUENCE, ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE };
const giorgiaScene = (componentTypes: string[], metadata: Record<string, unknown>): StoryObj => ({
  args: { programId: HARBOR_LIGHT_TV_PROGRAM, embedded: true, activeComponents: componentTypes, sceneMetadata: metadata }
});

export const TvSceneGiorgiaClock: StoryObj = giorgiaScene(['modoitaliano-giorgia-clock'], { 'modoitaliano-giorgia-clock': {} });

export const TvSceneGiorgiaClockKeySafe: StoryObj = giorgiaScene(['modoitaliano-giorgia-clock'], { 'modoitaliano-giorgia-clock': { keySafe: true } });

export const TvSceneGiorgiaChyron: StoryObj = giorgiaScene(['modoitaliano-giorgia-chyron'], { 'modoitaliano-giorgia-chyron': giorgiaChyron });

export const TvSceneGiorgiaChyronKeySafe: StoryObj = giorgiaScene(['modoitaliano-giorgia-chyron'], {
  'modoitaliano-giorgia-chyron': { ...giorgiaChyron, keySafe: true }
});

/** Both listed: the header top-left, and the chyron and on-air slot side by side in the bottom row. */
export const TvSceneGiorgiaRow: StoryObj = giorgiaScene(['modoitaliano-giorgia-clock', 'modoitaliano-giorgia-chyron'], {
  'modoitaliano-giorgia-clock': {},
  'modoitaliano-giorgia-chyron': giorgiaChyron
});

/** keySafe on either type keys the whole row. */
export const TvSceneGiorgiaRowKeySafe: StoryObj = giorgiaScene(['modoitaliano-giorgia-clock', 'modoitaliano-giorgia-chyron'], {
  'modoitaliano-giorgia-clock': {},
  'modoitaliano-giorgia-chyron': { ...giorgiaChyron, keySafe: true }
});
