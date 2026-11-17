import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { Earone } from '../../../../src/components/live-program/radio/Earone';
import { earonePropsFromSong, readSongPlaybackActive } from '../../../../src/components/live-program/radio/songSignals';
import { harborLightSongPlaybackActive, renderOnStage } from './stage';

const meta: Meta = {
  title: 'React/LiveProgram/Radio/Earone',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    rank: { control: 'text' },
    spins: { control: 'text' },
    label: { control: 'text' },
  },
  render: (args) => renderOnStage(<Earone rank={args.rank} spins={args.spins} label={args.label} />),
};

export default meta;

/** Rank and spins read from the song_playback_active signal. */
export const FromSongSignal: StoryObj = {
  args: earonePropsFromSong(readSongPlaybackActive(harborLightSongPlaybackActive)),
};

export const RankOnly: StoryObj = {
  args: { rank: '12', spins: null },
};

/** No chart values: the component renders nothing. */
export const Empty: StoryObj = {
  args: { rank: null, spins: null },
};
