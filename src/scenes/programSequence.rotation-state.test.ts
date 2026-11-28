import { describe, expect, it } from 'vitest';
import { normalizeProgramSongSequence } from './programSequence.js';

// Ported with gaulatti/alcantara 26480df7 and 21509575: the engine's rotation state survives a normalisation.
const items = [{ id: 'a', title: 'Fictional song' }];

describe('rotation state of a song sequence', () => {
  it('keeps when a rotation ended and the item the engine cued', () => {
    const sequence = normalizeProgramSongSequence({ mode: 'manual', items, endedAt: 1_700_000_000_000, cuedItemId: 'a' });
    expect(sequence?.endedAt).toBe(1_700_000_000_000);
    expect(sequence?.cuedItemId).toBe('a');
  });

  it('leaves both out when they are absent or not usable', () => {
    for (const extra of [{}, { endedAt: 0, cuedItemId: '' }, { endedAt: -5, cuedItemId: 7 }, { endedAt: Number.NaN }, { endedAt: '1' }]) {
      const sequence = normalizeProgramSongSequence({ mode: 'manual', items, ...extra });
      expect(sequence).not.toHaveProperty('endedAt');
      expect(sequence).not.toHaveProperty('cuedItemId');
    }
  });

  it('keeps only the string ids of a stored shuffle order', () => {
    const sequence = normalizeProgramSongSequence({ mode: 'shuffle', items, shuffleOrder: ['a', 3, null, 'b'] });
    expect(sequence?.shuffleOrder).toEqual(['a', 'b']);
    expect(normalizeProgramSongSequence({ mode: 'shuffle', items })).not.toHaveProperty('shuffleOrder');
  });
});
