import { describe, expect, it } from 'vitest';
import * as realtime from './earoneRealtime.js';
import { buildEaroneRealtimeLookup, matchEaroneRealtimeEntry, normalizeEaroneMatchKey } from './earoneRealtime.js';

const entry = (overrides: Record<string, unknown> = {}) => ({
  earoneSongId: 'hl-1',
  ranking: '2',
  radioSpinsToday: '300',
  artist: 'The Lighthouse Keepers',
  title: 'Harbor Light',
  normalizedKey: 'the lighthouse keepers harbor light',
  spotifyPlays: null,
  youtubeViews: null,
  youtubeLikes: null,
  ...overrides,
});

describe('earoneRealtime helpers', () => {
  it('exports only the pure helpers, never the chart proxy URL', () => {
    expect(Object.keys(realtime).sort()).toEqual([
      'buildEaroneRealtimeLookup',
      'matchEaroneRealtimeEntry',
      'normalizeEaroneMatchKey',
    ]);
  });

  it('normalizes accents, ampersands, punctuation and whitespace', () => {
    expect(normalizeEaroneMatchKey('  Città & Mare —  Faro!  ')).toBe('citta and mare faro');
  });

  it('builds an empty lookup from a payload without entries', () => {
    expect(buildEaroneRealtimeLookup(null)).toEqual({ bySongId: {}, byNormalizedText: {}, updatedAt: null, sources: undefined });
    expect(buildEaroneRealtimeLookup({ entries: 'nope', updatedAt: 5, sources: 'x' })).toEqual({
      bySongId: {},
      byNormalizedText: {},
      updatedAt: null,
      sources: undefined,
    });
  });

  it('indexes valid entries by song id and first normalized text, skipping invalid ones', () => {
    const first = entry();
    const sameText = entry({ earoneSongId: 'hl-2', ranking: '9' });
    const noId = entry({ earoneSongId: null, normalizedKey: 'harbor light b side' });
    const lookup = buildEaroneRealtimeLookup({
      updatedAt: '2026-11-16T00:00:00Z',
      sources: { earoneUpdatedAt: '2026-11-16T00:00:00Z', escplusUpdatedAt: 7 },
      entries: [
        null,
        'text',
        entry({ normalizedKey: '' }),
        entry({ artist: '' }),
        entry({ title: '' }),
        first,
        sameText,
        noId,
      ],
    });
    expect(lookup.updatedAt).toBe('2026-11-16T00:00:00Z');
    expect(lookup.sources).toEqual({ earoneUpdatedAt: '2026-11-16T00:00:00Z', escplusUpdatedAt: null });
    expect(lookup.bySongId).toEqual({ 'hl-1': first, 'hl-2': sameText });
    expect(lookup.byNormalizedText).toEqual({
      'the lighthouse keepers harbor light': first,
      'harbor light b side': noId,
    });

    const escplusOnly = buildEaroneRealtimeLookup({ sources: { earoneUpdatedAt: null, escplusUpdatedAt: '2026-11-15T00:00:00Z' } });
    expect(escplusOnly.sources).toEqual({ earoneUpdatedAt: null, escplusUpdatedAt: '2026-11-15T00:00:00Z' });
  });

  it('matches by trimmed song id first, then by normalized text', () => {
    const byId = entry();
    const byText = entry({ earoneSongId: 'hl-9', normalizedKey: 'harbor light' });
    const lookup = buildEaroneRealtimeLookup({ entries: [byId, byText] });

    expect(matchEaroneRealtimeEntry(null, { earoneSongId: 'hl-1' })).toBeNull();
    expect(matchEaroneRealtimeEntry(lookup, { earoneSongId: ' hl-1 ' })).toBe(byId);
    expect(matchEaroneRealtimeEntry(lookup, { earoneSongId: 'missing', text: 'Harbor  Light!' })).toBe(byText);
    expect(matchEaroneRealtimeEntry(lookup, { earoneSongId: '   ', text: 'unknown' })).toBeNull();
    expect(matchEaroneRealtimeEntry(lookup, { earoneSongId: null, text: '  ' })).toBeNull();
    expect(matchEaroneRealtimeEntry(lookup, {})).toBeNull();
  });
});
