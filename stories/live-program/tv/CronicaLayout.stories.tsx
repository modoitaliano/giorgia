import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CronicaLayout } from '../../../src/live-program/components/tv/CronicaLayout.js';

const meta: Meta = {
  title: 'TV/CronicaLayout',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    createRoot(container).render(<CronicaLayout {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    headline: 'HARBOR LIGHT TELEVISION\nTRANSMISION ESPECIAL\nDIRECTO AL AIRE',
    reiteramosText: 'HARBOR LIGHT',
    showReiteramos: true
  }
};
