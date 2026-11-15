import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CronicaReiteramos } from '../../../src/live-program/components/tv/CronicaReiteramos.js';

const meta: Meta = {
  title: 'TV/CronicaReiteramos',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<CronicaReiteramos {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    show: true,
    text: 'REITERAMOS EN HARBOR LIGHT'
  }
};
