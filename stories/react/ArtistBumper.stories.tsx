import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArtistBumperFrame, robArtistBumperProps } from '../../src/video/ArtistBumper';

const meta: Meta = {
  title: 'React/ArtistBumper',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    frame: { control: { type: 'range', min: 0, max: 359, step: 1 } },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.overflow = 'hidden';

    const root = createRoot(container);
    root.render(<ArtistBumperFrame {...robArtistBumperProps} frame={args.frame ?? 62} />);
    return container;
  },
};

export default meta;

export const Identity: StoryObj = {
  args: { frame: 62 },
};

export const OnAirGradientStart: StoryObj = {
  args: { frame: 221 },
};

export const OnAirGradientEnd: StoryObj = {
  args: { frame: 359 },
};
