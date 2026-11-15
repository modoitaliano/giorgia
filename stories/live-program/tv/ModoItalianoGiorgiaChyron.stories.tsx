import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModoItalianoGiorgiaChyron } from '../../../src/live-program/components/tv/ModoItalianoGiorgiaChyron.js';
import { HARBOR_LIGHT_TEXT_SEQUENCE, HARBOR_LIGHT_CTA_SEQUENCE } from './harbor-light.fixture.js';

const meta: Meta = {
  title: 'TV/ModoItalianoGiorgiaChyron',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0a';
    createRoot(container).render(<ModoItalianoGiorgiaChyron {...args} />);
    return container;
  }
};

export default meta;

export const Default: StoryObj = {
  args: {
    show: true,
    textSequence: HARBOR_LIGHT_TEXT_SEQUENCE,
    ctaSequence: HARBOR_LIGHT_CTA_SEQUENCE
  }
};
