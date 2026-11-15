import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModoItalianoDisclaimer } from '../../../src/live-program/components/tv/ModoItalianoDisclaimer.js';

const meta: Meta = {
  title: 'TV/ModoItalianoDisclaimer',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<ModoItalianoDisclaimer {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    show: true,
    text: 'HARBOR LIGHT BROADCAST DISCLAIMER'
  }
};
