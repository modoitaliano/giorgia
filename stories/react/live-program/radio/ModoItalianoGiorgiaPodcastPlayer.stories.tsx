import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { ModoItalianoGiorgiaPodcastPlayer } from '../../../../src/components/live-program/radio/ModoItalianoGiorgiaPodcastPlayer';
import { harborLightPodcastScene, renderOnStage } from './stage';

const meta: Meta = {
  title: 'React/LiveProgram/Radio/ModoItalianoGiorgiaPodcastPlayer',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    show: { control: 'boolean' },
    coverUrl: { control: 'text' },
    episodeTitle: { control: 'text' },
    showName: { control: 'text' },
    audioUrl: { control: 'text' },
    masterGain: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
  },
  render: (args) => renderOnStage(<ModoItalianoGiorgiaPodcastPlayer {...args} />),
};

export default meta;

/** Episode props as the scene configuration supplies them; no audio source. */
export const FromSceneProps: StoryObj = {
  args: harborLightPodcastScene,
};

export const LongTitle: StoryObj = {
  args: {
    show: true,
    audioUrl: '',
    showName: 'Harbor Light Radio',
    coverUrl: '/assets/default-og.jpg',
    episodeTitle: 'Una lunghissima conversazione sulla musica italiana e le canzoni che ci accompagnano ogni giorno',
  },
};

/** No cover and no audio source. */
export const Empty: StoryObj = {
  args: { show: true, audioUrl: '', episodeTitle: 'Harbor Light', showName: 'Harbor Light Radio' },
};
