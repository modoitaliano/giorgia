import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CronicaBackground } from '../../../../src/components/live-program/tv/CronicaBackground.js';

const meta: Meta = {
  title: 'React/LiveProgram/TV/CronicaBackground',
  parameters: { layout: 'fullscreen' },
  render: () => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    createRoot(container).render(<CronicaBackground />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {};
