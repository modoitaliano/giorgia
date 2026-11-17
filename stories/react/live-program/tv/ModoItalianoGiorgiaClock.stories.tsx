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
    // A key-safe story sits on chroma green, the picture it is made for (#49).
    container.style.background = args.keySafe ? '#00b140' : '#0a0a0a';
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

/** With a song on air: the header top-left and the on-air block bottom-left, over their navy grade. */
export const WithSong: StoryObj = {
  args: {
    programId: HARBOR_LIGHT_TV_PROGRAM,
    language: 'it',
    songArtist: 'The Lighthouse Keepers',
    songTitle: 'Harbor Light',
    songCoverUrl: '/assets/default-og.jpg'
  }
};

/** Key-safe (#49), over chroma green: solid navy plates, no shadows or soft edges. */
export const KeySafe: StoryObj = {
  args: { ...WithSong.args, keySafe: true }
};

/** A program-wide broadcast time override (#49): the clock shows 07:30 and counts on from it. */
export const TimeOverride: StoryObj = {
  args: {
    programId: HARBOR_LIGHT_TV_PROGRAM,
    language: 'it',
    timeOverride: { startTime: '07:30', startedAt: new Date().toISOString() }
  }
};
