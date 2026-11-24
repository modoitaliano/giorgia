import { expect, it } from 'vitest';
import {
  applyModoItalianoBracketAdvancement,
  createDefaultModoItalianoBracketMatches,
  drawModoItalianoBracketOpeningSongs,
  fillNextModoItalianoBracketOpeningSlot,
  getModoItalianoBracketOpeningMatchIds,
  normalizeModoItalianoBracketDrawCommand,
  normalizeModoItalianoBracketDrawDurationSeconds,
  normalizeModoItalianoBracketDrawSeed,
  normalizeModoItalianoBracketMatches,
  normalizeModoItalianoBracketSongPoolIds,
  normalizeModoItalianoBracketStartRound,
  type ModoItalianoBracketMatch,
} from './bracketModel.js';

// gaulatti/giorgia#74: what the bracket does with the data an operator or a stored scene gives it.

const match = (id: number, over: Partial<ModoItalianoBracketMatch> = {}): ModoItalianoBracketMatch => ({
  id,
  songAId: null,
  songBId: null,
  winnerId: null,
  ...over,
});

it('starts at the round of 16 unless the quarterfinals are asked for', () => {
  expect(normalizeModoItalianoBracketStartRound('quarterfinals')).toBe('quarterfinals');
  for (const value of ['roundOf16', 'final', '', null, undefined, 4]) {
    expect(normalizeModoItalianoBracketStartRound(value)).toBe('roundOf16');
  }
  expect(getModoItalianoBracketOpeningMatchIds('quarterfinals')).toEqual([9, 10, 11, 12]);
  expect(getModoItalianoBracketOpeningMatchIds('anything else')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

it('starts with fifteen empty matches', () => {
  const matches = createDefaultModoItalianoBracketMatches();
  expect(matches).toHaveLength(15);
  expect(matches[14]).toEqual({ id: 15, songAId: null, songBId: null, winnerId: null });
});

it('keeps each song once, accepting numbers and numeric text and dropping the rest', () => {
  expect(normalizeModoItalianoBracketSongPoolIds('not a list')).toEqual([]);
  expect(normalizeModoItalianoBracketSongPoolIds(undefined)).toEqual([]);
  expect(normalizeModoItalianoBracketSongPoolIds([3, '4', 3, '3', 0, -2, 1.5, 'x', null, {}, '', NaN])).toEqual([3, 4]);
  const catalog = new Set([4, 9]);
  expect(normalizeModoItalianoBracketSongPoolIds([3, '4', 9, 10], catalog)).toEqual([4, 9]);
});

it('takes a draw seed as a positive whole number, or 5', () => {
  expect(normalizeModoItalianoBracketDrawSeed(12.9)).toBe(12);
  expect(normalizeModoItalianoBracketDrawSeed('7')).toBe(7);
  for (const value of [0, -3, NaN, Infinity, 'x', null, undefined, {}]) {
    expect(normalizeModoItalianoBracketDrawSeed(value)).toBe(5);
  }
});

it('takes a draw duration of at least one second, or the fallback', () => {
  expect(normalizeModoItalianoBracketDrawDurationSeconds(8.7)).toBe(8);
  expect(normalizeModoItalianoBracketDrawDurationSeconds('12')).toBe(12);
  expect(normalizeModoItalianoBracketDrawDurationSeconds(0.4)).toBe(1);
  expect(normalizeModoItalianoBracketDrawDurationSeconds(0)).toBe(5);
  expect(normalizeModoItalianoBracketDrawDurationSeconds('x')).toBe(5);
  expect(normalizeModoItalianoBracketDrawDurationSeconds(undefined, 9)).toBe(9);
  expect(normalizeModoItalianoBracketDrawDurationSeconds(null, 'x' as never)).toBe(5);
});

it('reads a draw command, clamping what it can and refusing what it cannot', () => {
  expect(
    normalizeModoItalianoBracketDrawCommand({
      id: 3,
      seed: '9',
      startedAt: 1000,
      durationSeconds: '4',
      songIds: [1, '2', 'x', 1],
      selectedSongId: '2',
    }),
  ).toEqual({ id: 3, seed: 9, startedAt: 1000, durationSeconds: 4, songIds: [1, 2], selectedSongId: 2 });
  expect(normalizeModoItalianoBracketDrawCommand({ id: 1, startedAt: 0 })).toEqual({
    id: 1,
    seed: 5,
    startedAt: 0,
    durationSeconds: 5,
    songIds: [],
    selectedSongId: null,
  });
  // With no duration, it falls back to the seed it was given.
  expect(normalizeModoItalianoBracketDrawCommand({ id: 1, startedAt: 0, seed: 11 })!.durationSeconds).toBe(11);
  for (const bad of [null, undefined, 'draw', 4, [], [1, 2], {}, { id: '1', startedAt: 1 }, { id: 1, startedAt: '1' }, { startedAt: 1 }]) {
    expect(normalizeModoItalianoBracketDrawCommand(bad)).toBeNull();
  }
});

it('rebuilds the matches from anything stored, ignoring entries that are not matches', () => {
  const defaults = createDefaultModoItalianoBracketMatches();
  expect(normalizeModoItalianoBracketMatches(undefined)).toEqual(defaults);
  expect(normalizeModoItalianoBracketMatches('x', 'quarterfinals')).toEqual(
    applyModoItalianoBracketAdvancement(defaults, 'quarterfinals'),
  );
  const matches = normalizeModoItalianoBracketMatches([
    null,
    'x',
    7,
    { id: '2', songAId: 1 },
    { id: 0, songAId: 1 },
    { id: 16, songAId: 1 },
    { id: 1, songAId: 11, songBId: '12', winnerId: 11, extra: 'kept' },
    { id: 2, songAId: 21, songBId: 22, winnerId: 99 },
  ]);
  expect(matches).toHaveLength(15);
  expect(matches[0]).toMatchObject({ id: 1, songAId: 11, songBId: null, winnerId: 11, extra: 'kept' });
  // A winner that is not in the match is cleared.
  expect(matches[1]).toMatchObject({ id: 2, songAId: 21, songBId: 22, winnerId: null });
  // The winner of match 1 moves on to match 9.
  expect(matches[8].songAId).toBe(11);
});

it('moves winners on, clears generated slots and repeated songs, and stops winners that are not playing', () => {
  const result = applyModoItalianoBracketAdvancement([
    ...Array.from({ length: 15 }, (_, index) => match(index + 1)),
  ].map((entry) => {
    if (entry.id === 1) return { ...entry, songAId: 1, songBId: 2, winnerId: 2 };
    // A repeated song in a later opening match is removed, on either side.
    if (entry.id === 2) return { ...entry, songAId: 1, songBId: 3, winnerId: 3 };
    if (entry.id === 3) return { ...entry, songAId: 4, songBId: 3, winnerId: 4 };
    // A generated slot filled by hand is wiped and rebuilt.
    if (entry.id === 9) return { ...entry, songBId: 77, winnerId: 2 };
    if (entry.id === 13) return { ...entry, songAId: 55 };
    return entry;
  }));
  expect(result[0].songAId).toBe(1);
  expect(result[1].songAId).toBeNull();
  expect(result[2].songBId).toBeNull();
  expect(result[8].songAId).toBe(2);
  expect(result[8].songBId).toBe(3);
  expect(result[8].winnerId).toBe(2);
  expect(result[12].songAId).toBe(2);
  expect(result[14].songAId).toBeNull();
});

it('starts the bracket from the quarterfinals, leaving the first round out of it', () => {
  const result = applyModoItalianoBracketAdvancement(
    createDefaultModoItalianoBracketMatches().map((entry) =>
      entry.id === 1 ? { ...entry, songAId: 5, winnerId: 5 } : entry.id === 9 ? { ...entry, songAId: 6, songBId: 7, winnerId: 6 } : entry,
    ),
    'quarterfinals',
  );
  // Match 1 is before the first active match: it is neither cleared nor advanced.
  expect(result[0]).toMatchObject({ songAId: 5, winnerId: 5 });
  expect(result[8].songAId).toBe(6);
  expect(result[12].songAId).toBe(6);
});

it('draws one song from the pool into the first empty opening slot, the same one for the same seed', () => {
  const first = drawModoItalianoBracketOpeningSongs(createDefaultModoItalianoBracketMatches(), 'roundOf16', [1, 2, 3, 4, 5], 42);
  const again = drawModoItalianoBracketOpeningSongs(createDefaultModoItalianoBracketMatches(), 'roundOf16', [1, 2, 3, 4, 5], 42);
  expect(first).toEqual(again);
  expect(first.drawnSongIds).toHaveLength(1);
  expect(first.matches[0].songAId).toBe(first.drawnSongIds[0]);
  expect(first.emptySlotCount).toBe(16);
  expect(first.availableSongCount).toBe(5);
  expect([...first.availableSongIds].sort()).toEqual([1, 2, 3, 4, 5]);
  const other = drawModoItalianoBracketOpeningSongs(createDefaultModoItalianoBracketMatches(), 'roundOf16', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'x');
  expect(other.availableSongIds).toHaveLength(10);
});

it('does not draw a song already in the bracket, and draws nothing when the bracket is full or the pool is empty', () => {
  const partial = createDefaultModoItalianoBracketMatches().map((entry) => (entry.id === 1 ? { ...entry, songAId: 3 } : entry));
  const drawn = drawModoItalianoBracketOpeningSongs(partial, 'roundOf16', [3, 4], 1);
  expect(drawn.availableSongIds).toEqual([4]);
  expect(drawn.drawnSongIds).toEqual([4]);
  expect(drawn.matches[0]).toMatchObject({ songAId: 3, songBId: 4 });
  expect(drawn.emptySlotCount).toBe(15);

  const full = createDefaultModoItalianoBracketMatches().map((entry) =>
    entry.id <= 8 ? { ...entry, songAId: entry.id * 2, songBId: entry.id * 2 + 1 } : entry,
  );
  const none = drawModoItalianoBracketOpeningSongs(full, 'roundOf16', [100, 101], 1);
  expect(none.drawnSongIds).toEqual([]);
  expect(none.emptySlotCount).toBe(0);
  expect(none.availableSongCount).toBe(2);

  const empty = drawModoItalianoBracketOpeningSongs(undefined as never, 'quarterfinals', 'no pool', 'seed');
  expect(empty.drawnSongIds).toEqual([]);
  expect(empty.availableSongIds).toEqual([]);
  expect(empty.emptySlotCount).toBe(8);
  // Quarterfinal draws fill match 9 first.
  const quarter = drawModoItalianoBracketOpeningSongs(undefined as never, 'quarterfinals', [7], 1);
  expect(quarter.matches[8].songAId).toBe(7);
});

it('puts a chosen song into the first empty opening slot', () => {
  const start = createDefaultModoItalianoBracketMatches();
  const one = fillNextModoItalianoBracketOpeningSlot(start, 'roundOf16', 7);
  expect(one[0].songAId).toBe(7);
  const two = fillNextModoItalianoBracketOpeningSlot(one, 'roundOf16', '8');
  expect(two[0]).toMatchObject({ songAId: 7, songBId: 8 });
  const quarter = fillNextModoItalianoBracketOpeningSlot(undefined as never, 'quarterfinals', 3);
  expect(quarter[8].songAId).toBe(3);
});

it('leaves the bracket as it is for a song that is unusable, already in it, or has no slot left', () => {
  const start = createDefaultModoItalianoBracketMatches();
  for (const bad of [null, undefined, 'x', 0, -1, 2.5]) {
    expect(fillNextModoItalianoBracketOpeningSlot(start, 'roundOf16', bad)).toEqual(start);
  }
  const one = fillNextModoItalianoBracketOpeningSlot(start, 'roundOf16', 7);
  expect(fillNextModoItalianoBracketOpeningSlot(one, 'roundOf16', 7)).toEqual(one);
  const full = createDefaultModoItalianoBracketMatches().map((entry) =>
    entry.id <= 8 ? { ...entry, songAId: entry.id * 2, songBId: entry.id * 2 + 1 } : entry,
  );
  const unchanged = fillNextModoItalianoBracketOpeningSlot(full, 'roundOf16', 500);
  expect(unchanged.every((entry, index) => entry.songAId === full[index].songAId || entry.id > 8)).toBe(true);
  expect(unchanged.flatMap((entry) => [entry.songAId, entry.songBId])).not.toContain(500);
});
