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

/** The program's song sequence, as an audio_bus_update gives it: shown while no playing track is confirmed. */
const harborSequence = {
  mode: 'manual',
  items: [
    { id: 'harbor-song', kind: 'preset', artist: 'The Lighthouse Keepers', title: 'Harbor Light', coverUrl: '/assets/default-og.jpg' }
  ],
  activeItemId: 'harbor-song',
  intervalMs: 4000,
  loop: true,
  startedAt: 0
};

/**
 * A confirmed playing track (the v2 state's playingTrack, giorgia#51): it replaces the sequence's song.
 * It has no coverUrl, so the cover box holds the CSS placeholder (giorgia#53).
 */
export const PlayingTrack: StoryObj = {
  args: {
    programId: HARBOR_LIGHT_TV_PROGRAM,
    songSequence: harborSequence,
    playingTrack: { playbackId: 'harbor-playback-1', title: 'Low Tide', artist: 'Pier Choir', startedAt: '2026-11-17T09:58:00.000Z' }
  }
};

/** No playing track in the state: the song sequence shows, as before. */
export const PlayingTrackAbsent: StoryObj = {
  args: { programId: HARBOR_LIGHT_TV_PROGRAM, songSequence: harborSequence, playingTrack: null }
};

/** A playing track whose artist the playout engine omitted: the title leads, and the sequence's artist is not borrowed. */
export const PlayingTrackWithoutArtist: StoryObj = {
  args: { ...PlayingTrack.args, playingTrack: { playbackId: 'harbor-playback-2', title: 'Low Tide', artist: null, startedAt: '2026-11-17T09:58:00.000Z' } }
};

/** A playing track with its own coverUrl (alcantara#179): the cover is drawn. */
export const PlayingTrackWithCover: StoryObj = {
  args: {
    ...PlayingTrack.args,
    playingTrack: {
      playbackId: 'harbor-playback-3',
      title: 'Low Tide',
      artist: 'Pier Choir',
      startedAt: '2026-11-17T09:58:00.000Z',
      coverUrl: '/assets/default-og.jpg'
    }
  }
};

/** A sequence song without a cover (giorgia#53): the box keeps its size and holds the navy placeholder. */
export const CoverPlaceholder: StoryObj = {
  args: {
    programId: HARBOR_LIGHT_TV_PROGRAM,
    songSequence: { ...harborSequence, items: [{ ...harborSequence.items[0], coverUrl: undefined }] }
  }
};

/** The placeholder key-safe, over chroma green: a solid plate with no gradient. */
export const CoverPlaceholderKeySafe: StoryObj = {
  args: { ...CoverPlaceholder.args, keySafe: true }
};

/** A cover that fails to load (an undecodable image, so nothing is fetched): the placeholder replaces it. */
export const CoverLoadError: StoryObj = {
  args: {
    ...PlayingTrack.args,
    playingTrack: {
      playbackId: 'harbor-playback-4',
      title: 'Low Tide',
      artist: 'Pier Choir',
      startedAt: '2026-11-17T09:58:00.000Z',
      coverUrl: 'data:image/png;base64,AAAA'
    }
  }
};
