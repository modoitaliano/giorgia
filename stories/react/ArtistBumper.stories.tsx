import type { Meta, StoryObj } from '@storybook/html';
import { Player } from '@remotion/player';
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ARTIST_BUMPER_DURATION_IN_FRAMES,
  ARTIST_BUMPER_FPS,
  ARTIST_BUMPER_HEIGHT,
  ARTIST_BUMPER_WIDTH,
  ArtistBumper,
  robArtistBumperProps,
} from '../../src/video/ArtistBumper';

const meta: Meta = {
  title: 'React/ArtistBumper',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    autoPlay: { control: 'boolean' },
    loop: { control: 'boolean' },
    initiallyMuted: { control: 'boolean' },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.alignItems = 'center';
    container.style.background = '#050817';
    container.style.boxSizing = 'border-box';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.minHeight = '100vh';
    container.style.overflow = 'hidden';
    container.style.width = '100vw';

    const root = createRoot(container);
    root.render(
      <Player
        component={ArtistBumper}
        acknowledgeRemotionLicense
        inputProps={robArtistBumperProps}
        durationInFrames={ARTIST_BUMPER_DURATION_IN_FRAMES}
        compositionWidth={ARTIST_BUMPER_WIDTH}
        compositionHeight={ARTIST_BUMPER_HEIGHT}
        fps={ARTIST_BUMPER_FPS}
        autoPlay={args.autoPlay ?? true}
        loop={args.loop ?? false}
        initiallyMuted={args.initiallyMuted ?? true}
        controls
        initiallyShowControls
        showPlaybackRateControl
        style={{
          aspectRatio: '16 / 9',
          maxHeight: '100vh',
          maxWidth: '1920px',
          width: '100%',
        }}
      />,
    );
    return container;
  },
};

export default meta;

export const CompleteBumper: StoryObj = {
  args: {
    autoPlay: true,
    loop: false,
    initiallyMuted: true,
  },
};
