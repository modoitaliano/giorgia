import type { Meta, StoryObj } from '@storybook/html';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModoItalianoGiorgiaChyron } from '../../../../src/components/live-program/tv/ModoItalianoGiorgiaChyron.js';
import { HARBOR_LIGHT_TEXT_SEQUENCE, HARBOR_LIGHT_CTA_SEQUENCE } from './harbor-light.fixture.js';

const meta: Meta = {
  title: 'React/LiveProgram/TV/ModoItalianoGiorgiaChyron',
  parameters: { layout: 'fullscreen' },
  render: (args) => {
    const container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    container.style.position = 'relative';
    // A key-safe story sits on chroma green, the picture it is made for (#49).
    container.style.background = args.keySafe ? '#00b140' : '#0a0a0a';
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

/** Key-safe (#49), over chroma green: a solid navy band and type with no shadow. */
export const KeySafe: StoryObj = {
  args: { ...Default.args, keySafe: true }
};
