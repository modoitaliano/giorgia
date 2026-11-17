import { describe, expect, it } from 'vitest';
import {
  applyModoItalianoBracketAdvancement,
  createDefaultModoItalianoBracketMatches,
  normalizeModoItalianoBracketDrawCommand,
  normalizeModoItalianoBracketDrawDurationSeconds,
  normalizeModoItalianoBracketDrawSeed,
  normalizeModoItalianoBracketMatches,
  normalizeModoItalianoBracketSongPoolIds
} from './modoItalianoBracket.js';

describe('bracket helpers', () => {
  it('keeps only positive integer song ids, optionally limited to a catalog', () => {
    expect(normalizeModoItalianoBracketSongPoolIds([3, '3', 4, 1.5, 0], new Set([3]))).toEqual([3]);
  });

  it('normalizes seeds and durations from numbers and strings', () => {
    expect(normalizeModoItalianoBracketDrawSeed('7.9')).toBe(7);
    expect(normalizeModoItalianoBracketDrawSeed(-1)).toBe(5);
    expect(normalizeModoItalianoBracketDrawSeed(null)).toBe(5);
    expect(normalizeModoItalianoBracketDrawDurationSeconds('3')).toBe(3);
    expect(normalizeModoItalianoBracketDrawDurationSeconds(0.4)).toBe(1);
    expect(normalizeModoItalianoBracketDrawDurationSeconds(-2)).toBe(5);
    expect(normalizeModoItalianoBracketDrawDurationSeconds(undefined, 'x' as never)).toBe(5);
  });

  it('reads an audience_interaction_draw_start payload', () => {
    expect(
      normalizeModoItalianoBracketDrawCommand({
        drawId: 12,
        durationSeconds: 4,
        candidateIds: [1, 2, '3'],
        slot: { matchId: 1, field: 'songAId' }
      })
    ).toEqual({ id: 12, seed: 12, startedAt: expect.any(Number), durationSeconds: 4, songIds: [1, 2, 3], selectedSongId: null });
  });

  it('reads an audience_interaction_draw_end payload and the legacy shape', () => {
    expect(normalizeModoItalianoBracketDrawCommand({ drawId: 12, selectedId: 2 })).toMatchObject({ id: 12, selectedSongId: 2 });
    expect(
      normalizeModoItalianoBracketDrawCommand({ id: 3, seed: 9, startedAt: 100, durationSeconds: 2, songIds: [5], selectedSongId: 5 })
    ).toEqual({ id: 3, seed: 9, startedAt: 100, durationSeconds: 2, songIds: [5], selectedSongId: 5 });
    expect(normalizeModoItalianoBracketDrawCommand([])).toBeNull();
    expect(normalizeModoItalianoBracketDrawCommand('x')).toBeNull();
    expect(normalizeModoItalianoBracketDrawCommand({ drawId: 'abc' })).toBeNull();
  });

  it('normalizes matches, ignoring malformed or out-of-range entries', () => {
    const matches = normalizeModoItalianoBracketMatches(
      [null, 'x', { id: 0 }, { id: 16 }, { id: '2' }, { id: 1, songAId: 10, songBId: 'x', winnerId: 'y' }],
      'roundOf16'
    );
    expect(matches[0]).toEqual({ id: 1, songAId: 10, songBId: null, winnerId: null });
    expect(normalizeModoItalianoBracketMatches('nope')).toEqual(createDefaultModoItalianoBracketMatches());
  });

  it('drops duplicate opening songs and impossible winners, and advances winners', () => {
    const matches = createDefaultModoItalianoBracketMatches();
    matches[0] = { id: 1, songAId: 10, songBId: 10, winnerId: 99 };
    matches[1] = { id: 2, songAId: 10, songBId: 20, winnerId: 20 };
    matches[8] = { id: 9, songAId: 77, songBId: 78, winnerId: null };
    const advanced = applyModoItalianoBracketAdvancement(matches);
    expect(advanced[0]).toEqual({ id: 1, songAId: 10, songBId: null, winnerId: null });
    expect(advanced[1]).toEqual({ id: 2, songAId: null, songBId: 20, winnerId: 20 });
    expect(advanced[8]).toMatchObject({ songAId: null, songBId: 20 });

    const quarterfinals = createDefaultModoItalianoBracketMatches();
    quarterfinals[0] = { id: 1, songAId: 1, songBId: 2, winnerId: 1 };
    quarterfinals[8] = { id: 9, songAId: 5, songBId: 6, winnerId: 6 };
    const qf = applyModoItalianoBracketAdvancement(quarterfinals, 'quarterfinals');
    expect(qf[0]).toEqual({ id: 1, songAId: 1, songBId: 2, winnerId: 1 });
    expect(qf[8]).toMatchObject({ songAId: 5, songBId: 6 });
    expect(qf[12]).toMatchObject({ songAId: 6 });

    expect(applyModoItalianoBracketAdvancement([{ id: 1, songAId: 1, songBId: 2, winnerId: 1 }])).toEqual([
      { id: 1, songAId: 1, songBId: 2, winnerId: 1 }
    ]);
  });
});
