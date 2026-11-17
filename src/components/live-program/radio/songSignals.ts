// Reads the contract v2 `song_playback_active` signal (fields as Alcantara
// projects them at the top level of the event) for the Earone chart box, the
// only radio component that follows the playing song. Only fields of that
// signal are read; nothing here adds a signal or a field.
//
// The podcast players do not read song signals: they show an episode of a
// show, and their episodeTitle, showName, coverUrl, audioUrl and masterGain
// stay component props supplied by the template's scene configuration.
import type { EaroneProps } from './Earone.js';

export type ChartMetric = string | number | null;

export interface ActiveSong {
  songId: string;
  /** Title and artist identify the song when matching it to a chart entry. */
  title: string;
  artist: string;
  externalChartRank: ChartMetric;
  externalChartSpins: ChartMetric;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function metric(value: unknown): ChartMetric {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

/** The active song carried by a `song_playback_active` event, or null for any other event. */
export function readSongPlaybackActive(event: unknown): ActiveSong | null {
  if (!event || typeof event !== 'object') return null;
  const signal = event as Record<string, unknown>;
  if (signal.type !== 'song_playback_active') return null;
  return {
    songId: text(signal.songId),
    title: text(signal.title),
    artist: text(signal.artist),
    externalChartRank: metric(signal.externalChartRank),
    externalChartSpins: metric(signal.externalChartSpins),
  };
}

/**
 * Chart rank and spins for the Earone box. As in Alcantara's program page,
 * `externalChartProvider` is not read: the label stays the component's own.
 */
export function earonePropsFromSong(song: ActiveSong | null): Pick<EaroneProps, 'rank' | 'spins'> {
  return { rank: song?.externalChartRank ?? null, spins: song?.externalChartSpins ?? null };
}
