import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import LiveProgram from '../../src/components/live-program/LiveProgram';
import { harborLightPodcastScene } from './live-program/radio/stage';

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
