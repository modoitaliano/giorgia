import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import RelojLoopClock from '../../../../src/components/live-program/tv/RelojLoopClock.js';

const meta: Meta = {
  title: 'React/LiveProgram/TV/RelojLoopClock',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<RelojLoopClock {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    timezone: 'America/Argentina/Buenos_Aires'
  }
};
