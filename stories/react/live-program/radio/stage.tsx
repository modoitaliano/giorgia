import React from 'react';
import { createRoot } from 'react-dom/client';

/** Fictional `harbor-light-radio` song_playback_active event shared by the radio stories. */
export const harborLightSongPlaybackActive = {
  type: 'song_playback_active',
  programId: 'harbor-light-radio',
  songId: 'harbor-light-radio-song-1',
  title: 'Harbor Light',
  artist: 'The Lighthouse Keepers',
  durationMs: 215000,
  startedAt: '2026-11-16T20:00:00Z',
  externalChartProvider: 'earone',
  externalChartRank: '3',
  externalChartSpins: '1520',
};

/**
 * Fictional podcast scene props. The podcast players take these from the
 * template's scene configuration, never from song signals.
 */
export const harborLightPodcastScene = {
  show: true,
  episodeTitle: 'Harbor Light, episode 12',
  showName: 'Harbor Light Radio',
  coverUrl: '/assets/default-og.jpg',
  audioUrl: '',
  masterGain: 1,
};

/** Mounts a component on a 1920x1080 broadcast stage, the size the radio components are laid out for. */
export function renderOnStage(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.width = '1920px';
  container.style.height = '1080px';
  container.style.overflow = 'hidden';
  container.style.background = '#0a1234';
  createRoot(container).render(element);
  return container;
}
