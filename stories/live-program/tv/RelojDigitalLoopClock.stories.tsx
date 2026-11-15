import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import RelojDigitalLoopClock from '../../../src/live-program/components/tv/RelojDigitalLoopClock.js';
import { HARBOR_LIGHT_TEXT_SEQUENCE, HARBOR_LIGHT_CTA_SEQUENCE, HARBOR_LIGHT_TV_PROGRAM } from './harbor-light.fixture.js';

const meta: Meta = {
  title: 'TV/RelojDigitalLoopClock',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<RelojDigitalLoopClock {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    programId: HARBOR_LIGHT_TV_PROGRAM,
    textSequence: HARBOR_LIGHT_TEXT_SEQUENCE,
    ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE,
    mode: 'clock'
  }
};
