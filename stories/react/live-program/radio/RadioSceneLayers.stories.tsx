import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { RadioSceneLayers } from '../../../../src/components/live-program/radio/RadioSceneLayers';
import { readSongPlaybackActive } from '../../../../src/components/live-program/radio/songSignals';
import { harborLightPodcastScene, harborLightSongPlaybackActive, renderOnStage } from './stage';

/**
 * Radio scenes as LiveProgram draws them: the scene's component list and
 * metadata (as Alcantara's editor stores them) choose and configure the
 * component; the Earone box follows the song_playback_active signal.
 */
const meta: Meta = {
  title: 'React/LiveProgram/Radio/Scenes',
  parameters: { layout: 'fullscreen' },
  render: (args) =>
    renderOnStage(
      <RadioSceneLayers
        componentTypes={args.componentTypes}
        metadata={args.metadata}
        activeSong={readSongPlaybackActive(harborLightSongPlaybackActive)}
      />
    ),
};

export default meta;

export const PodcastPlayerScene: StoryObj = {
  args: { componentTypes: ['modoitaliano-podcast-player'], metadata: { 'modoitaliano-podcast-player': harborLightPodcastScene } },
};

export const GiorgiaPodcastPlayerScene: StoryObj = {
  args: { componentTypes: ['modoitaliano-giorgia-podcast-player'], metadata: { 'modoitaliano-giorgia-podcast-player': harborLightPodcastScene } },
};

export const EaroneScene: StoryObj = {
  args: { componentTypes: ['earone'], metadata: { earone: { label: 'EARONE' } } },
};
