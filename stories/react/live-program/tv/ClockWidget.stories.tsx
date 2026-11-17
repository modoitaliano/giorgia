import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClockWidget } from '../../../../src/components/live-program/tv/ClockWidget.js';

const meta: Meta = {
  title: 'React/LiveProgram/TV/ClockWidget',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<ClockWidget {...args} />);
    return container;
  }
};

export default meta;

// The plate is the bundled ./modoitaliano/tv/reloj.png.
export const Default: StoryObj = {
  args: {
    timezone: 'Europe/Rome',
    showIcon: false
  }
};
