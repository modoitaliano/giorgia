import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModoItalianoGiorgiaClock } from '../../../../src/components/live-program/tv/ModoItalianoGiorgiaClock.js';
import { HARBOR_LIGHT_TV_PROGRAM } from './harbor-light.fixture.js';

const meta: Meta = {
  title: 'React/LiveProgram/TV/ModoItalianoGiorgiaClock',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<ModoItalianoGiorgiaClock {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    programId: HARBOR_LIGHT_TV_PROGRAM,
    showWorldClocks: true,
    showLogo: true,
    showBellIcon: true,
    language: 'it'
  }
};
