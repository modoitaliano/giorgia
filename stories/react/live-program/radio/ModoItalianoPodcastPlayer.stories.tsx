import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { ModoItalianoPodcastPlayer } from '../../../../src/components/live-program/radio/ModoItalianoPodcastPlayer';
import { harborLightPodcastScene, renderOnStage } from './stage';

const meta: Meta = {
  title: 'React/LiveProgram/Radio/ModoItalianoPodcastPlayer',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    show: { control: 'boolean' },
    coverUrl: { control: 'text' },
    episodeTitle: { control: 'text' },
    showName: { control: 'text' },
    audioUrl: { control: 'text' },
    masterGain: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
  },
  render: (args) => renderOnStage(<ModoItalianoPodcastPlayer {...args} />),
};

export default meta;

/** Episode props as the scene configuration supplies them; no audio source. */
export const FromSceneProps: StoryObj = {
  args: harborLightPodcastScene,
};

/** No props: placeholder copy, the empty cover glyph and no audio source. */
export const Empty: StoryObj = {
  args: { show: true, audioUrl: '' },
};
