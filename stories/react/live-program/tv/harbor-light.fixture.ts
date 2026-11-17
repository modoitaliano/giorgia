import type { SongCatalogItem } from '../../../../src/components/live-program/tv/songs.js';
import type { ModoItalianoBracketMatch } from '../../../../src/components/live-program/tv/modoItalianoBracket.js';

export const HARBOR_LIGHT_TENANT = 'harbor-light';
export const HARBOR_LIGHT_TV_PROGRAM = 'harbor-light-tv';
export const HARBOR_LIGHT_RADIO_PROGRAM = 'harbor-light-radio';

export const HARBOR_LIGHT_SONGS: SongCatalogItem[] = [
  {
    id: 1,
    artist: 'Harbor Light Ensemble',
    title: 'Beacon Song',
    coverUrl: 'https://images.unsplash.com/photo-beacon',
    audioUrl: 'https://audio.test/beacon.mp3',
    enabled: true
  },
  {
    id: 2,
    artist: 'Coastal Waves',
    title: 'Ocean Breeze',
    coverUrl: 'https://images.unsplash.com/photo-ocean',
    audioUrl: 'https://audio.test/ocean.mp3',
    enabled: true
  },
  {
    id: 3,
    artist: 'Lighthouse Echoes',
    title: 'Foghorn Symphony',
    coverUrl: 'https://images.unsplash.com/photo-fog',
    audioUrl: 'https://audio.test/fog.mp3',
    enabled: true
  },
  {
    id: 4,
    artist: 'North Shore Trio',
    title: 'Midnight Tides',
    coverUrl: 'https://images.unsplash.com/photo-tides',
    audioUrl: 'https://audio.test/tides.mp3',
    enabled: true
  }
];

export const HARBOR_LIGHT_BRACKET_MATCHES: ModoItalianoBracketMatch[] = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  songAId: i === 0 ? 1 : i === 1 ? 3 : null,
  songBId: i === 0 ? 2 : i === 1 ? 4 : null,
  winnerId: null
}));

export const HARBOR_LIGHT_AUDIENCE_DRAW_START = {
  type: 'audience_interaction_draw_start' as const,
  sceneId: 101,
  componentType: 'bracket',
  drawId: 42,
  durationSeconds: 5,
  candidateIds: [1, 2, 3, 4],
  slot: { matchId: 1, field: 'songAId' as const }
};

export const HARBOR_LIGHT_AUDIENCE_DRAW_END = {
  type: 'audience_interaction_draw_end' as const,
  sceneId: 101,
  componentType: 'bracket',
  drawId: 42,
  selectedId: 1
};

export const HARBOR_LIGHT_LEGACY_DRAW_START = {
  type: 'modoitaliano_bracket_draw_start' as const,
  sceneId: 101,
  drawId: 42,
  durationSeconds: 5,
  songIds: [1, 2, 3, 4]
};

export const HARBOR_LIGHT_LEGACY_DRAW_END = {
  type: 'modoitaliano_bracket_draw_end' as const,
  sceneId: 101,
  drawId: 42,
  selectedSongId: 1
};

export const HARBOR_LIGHT_TEXT_SEQUENCE = {
  mode: 'autoplay',
  intervalMs: 3000,
  loop: true,
  items: [
    { id: 'item-1', text: 'HARBOR LIGHT BROADCAST NEWS' },
    { id: 'item-2', text: 'LIVE FROM HARBOR LIGHT STUDIOS' }
  ]
};

export const HARBOR_LIGHT_CTA_SEQUENCE = {
  mode: 'autoplay',
  intervalMs: 2500,
  loop: true,
  items: [
    { id: 'cta-1', text: 'JOIN THE AUDIENCE DRAW' },
    { id: 'cta-2', text: 'VOTE IN HARBOR LIGHT TV' }
  ]
};
