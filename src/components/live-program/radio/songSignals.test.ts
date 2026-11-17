import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { earonePropsFromSong, readSongPlaybackActive } from './songSignals.js';

const active = {
  type: 'song_playback_active',
  programId: 'harbor-light-radio',
  songId: 'harbor-light-radio-song-1',
  title: 'Harbor Light',
  artist: 'The Lighthouse Keepers',
  coverUrl: '/assets/default-og.jpg',
  durationMs: 215000,
  startedAt: '2026-11-16T20:00:00Z',
  externalChartProvider: 'earone',
  externalChartRank: '4',
  externalChartSpins: 1200,
};

describe('song_playback_active reader', () => {
  it('ignores anything that is not a song_playback_active event', () => {
    expect(readSongPlaybackActive(null)).toBeNull();
    expect(readSongPlaybackActive('song_playback_active')).toBeNull();
    expect(readSongPlaybackActive({ ...active, type: 'song_playback_update' })).toBeNull();
  });

  it('reads only the song and chart fields the Earone box uses', () => {
    expect(readSongPlaybackActive(active)).toEqual({
      songId: 'harbor-light-radio-song-1',
      title: 'Harbor Light',
      artist: 'The Lighthouse Keepers',
      externalChartRank: '4',
      externalChartSpins: 1200,
    });
  });

  it('blanks fields with the wrong type instead of guessing', () => {
    expect(readSongPlaybackActive({ type: 'song_playback_active', title: 3, externalChartRank: {}, externalChartSpins: true })).toEqual({
      songId: '',
      title: '',
      artist: '',
      externalChartRank: null,
      externalChartSpins: null,
    });
  });

  it('maps the active song to Earone rank and spins', () => {
    expect(earonePropsFromSong(readSongPlaybackActive(active))).toEqual({ rank: '4', spins: 1200 });
    expect(earonePropsFromSong(null)).toEqual({ rank: null, spins: null });
  });

  it('exposes no mapping onto the podcast players', async () => {
    expect(Object.keys(await import('./songSignals.js')).sort()).toEqual(['earonePropsFromSong', 'readSongPlaybackActive']);
  });
});

describe('radio components', () => {
  it('contain no network call, upstream URL or chart credential', () => {
    const dir = resolve(process.cwd(), 'src/components/live-program/radio');
    // The ticket's grep, assembled from pieces so this file does not match itself.
    const pattern = new RegExp(['fetch\\(', 'XMLHttp' + 'Request', 'Event' + 'Source', 'client' + 'Id=', 'anonymous' + 'PublicKey', 'https?:' + '//'].join('|'));
    const offending = readdirSync(dir)
      .flatMap((name) =>
        readFileSync(join(dir, name), 'utf8')
          .split('\n')
          .map((line, index) => ({ name, line: index + 1, text: line }))
          .filter(({ text }) => pattern.test(text))
      );
    expect(offending).toEqual([]);
  });
});
