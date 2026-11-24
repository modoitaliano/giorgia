import { describe, expect, it } from 'vitest';
import {
  createProgramSongSequence,
  createProgramSongSequenceItem,
  createProgramTextSequence,
  createProgramTextSequenceItem,
  getProgramSongSequenceSelectedItemId,
  getProgramTextSequenceSelectedItemId,
  normalizeProgramSongSequence,
  normalizeProgramTextSequence,
  resolveProgramSongLeaf,
  songIdsInProgramSongSequence,
  type ProgramSongSequence,
  type ProgramSongSequenceItem,
} from './programSequence.js';

// gaulatti/giorgia#74: how a sequence is made, how long a song plays, and how bad input is read.

describe('making sequences', () => {
  it('makes an empty text preset, with a marquee flag only when the scene has a marquee', () => {
    const plain = createProgramTextSequenceItem();
    expect(plain).toMatchObject({ kind: 'preset', text: '', useMarquee: undefined });
    expect(plain.id).toMatch(/^preset_/);
    expect(createProgramTextSequenceItem('preset', { includeMarquee: true })).toMatchObject({ useMarquee: false });
  });

  it('makes a nested text sequence holding one empty preset', () => {
    const nested = createProgramTextSequenceItem('sequence', { includeMarquee: true });
    expect(nested).toMatchObject({ kind: 'sequence', label: 'Nested Sequence' });
    expect(nested.id).toMatch(/^sequence_/);
    if (nested.kind !== 'sequence') throw new Error('expected a nested sequence');
    expect(nested.sequence.mode).toBe('manual');
    expect(nested.sequence.items).toHaveLength(1);
    expect(nested.sequence.items[0]).toMatchObject({ kind: 'preset', useMarquee: false });
    expect(nested.sequence.activeItemId).toBe(nested.sequence.items[0].id);
  });

  it('makes a text sequence on its first item, manual unless told otherwise', () => {
    const sequence = createProgramTextSequence();
    expect(sequence).toMatchObject({ mode: 'manual', intervalMs: 4000, loop: true });
    expect(sequence.activeItemId).toBe(sequence.items[0].id);
    expect(typeof sequence.startedAt).toBe('number');
    expect(createProgramTextSequence('autoplay').mode).toBe('autoplay');
    expect(getProgramTextSequenceSelectedItemId(sequence)).toBe(sequence.items[0].id);
  });

  it('makes an empty song preset and a nested song sequence', () => {
    const preset = createProgramSongSequenceItem();
    expect(preset).toMatchObject({
      kind: 'preset',
      highRotation: false,
      artist: '',
      title: '',
      coverUrl: '',
      audioUrl: '',
      durationMs: undefined,
    });
    expect(preset.id).toMatch(/^song_/);
    const nested = createProgramSongSequenceItem('sequence');
    expect(nested).toMatchObject({ kind: 'sequence', label: 'Nested Sequence' });
    if (nested.kind !== 'sequence') throw new Error('expected a nested sequence');
    expect(nested.sequence).toMatchObject({ mode: 'manual', items: [], activeItemId: null });
  });

  it('makes a song sequence that plays on its own and holds nothing yet', () => {
    const sequence = createProgramSongSequence();
    expect(sequence).toMatchObject({ mode: 'autoplay', items: [], activeItemId: null, intervalMs: 4000, loop: true });
    expect(createProgramSongSequence('shuffle').mode).toBe('shuffle');
    expect(getProgramSongSequenceSelectedItemId(sequence)).toBeNull();
    expect(resolveProgramSongLeaf({ sequence })).toBeNull();
  });
});

describe('the catalog songs in a playlist', () => {
  const song = (id: string, songId?: number): ProgramSongSequenceItem => ({
    id,
    kind: 'preset',
    artist: '',
    title: '',
    coverUrl: '',
    songId,
  });

  it('lists each catalog song once, through nested blocks, skipping songs without an id', () => {
    const sequence: ProgramSongSequence = {
      mode: 'manual',
      activeItemId: 'a',
      items: [
        song('a', 1),
        song('b'),
        song('c', 1),
        {
          id: 'n',
          kind: 'sequence',
          label: 'N',
          sequence: { mode: 'manual', activeItemId: 'd', items: [song('d', 2), song('e', 3)] },
        },
      ],
    };
    expect([...songIdsInProgramSongSequence(sequence)].sort()).toEqual([1, 2, 3]);
  });

  it('lists nothing for no playlist', () => {
    expect(songIdsInProgramSongSequence(null).size).toBe(0);
  });
});

describe('how long a song plays', () => {
  const song = (id: string, durationMs?: unknown): ProgramSongSequenceItem =>
    ({ id, kind: 'preset', artist: '', title: '', coverUrl: '', durationMs }) as ProgramSongSequenceItem;
  const sequence = (items: ProgramSongSequenceItem[], over: Partial<ProgramSongSequence> = {}): ProgramSongSequence => ({
    mode: 'autoplay',
    items,
    activeItemId: items[0].id,
    loop: true,
    startedAt: 0,
    ...over,
  });

  it('treats a missing, zero, negative or non-finite length as unknown', () => {
    for (const durationMs of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY, '1000']) {
      const items = [song('a', durationMs), song('b', 1000)];
      expect(getProgramSongSequenceSelectedItemId(sequence(items), 99999)).toBe('a');
    }
  });

  it('rounds a length to the millisecond, and to at least one', () => {
    expect(getProgramSongSequenceSelectedItemId(sequence([song('a', 1000.4), song('b', 1000)]), 1000)).toBe('b');
    expect(getProgramSongSequenceSelectedItemId(sequence([song('a', 1000.6), song('b', 1000)]), 1000)).toBe('a');
    expect(getProgramSongSequenceSelectedItemId(sequence([song('a', 1000.6), song('b', 1000)]), 1001)).toBe('b');
    expect(getProgramSongSequenceSelectedItemId(sequence([song('a', 0.2), song('b', 1000)]), 0)).toBe('a');
  });

  it('starts from the active song and goes round to the ones before it', () => {
    const items = [song('a', 1000), song('b', 1000), song('c', 1000)];
    const from = sequence(items, { activeItemId: 'b' });
    expect(getProgramSongSequenceSelectedItemId(from, 500)).toBe('b');
    expect(getProgramSongSequenceSelectedItemId(from, 1500)).toBe('c');
    expect(getProgramSongSequenceSelectedItemId(from, 2500)).toBe('a');
    expect(getProgramSongSequenceSelectedItemId(from, 3500)).toBe('b');
  });

  it('never runs before its start', () => {
    const items = [song('a', 1000), song('b', 1000)];
    expect(getProgramSongSequenceSelectedItemId(sequence(items, { startedAt: 5000 }), 0)).toBe('a');
  });

  it('walks to the first unknown song after the known ones it has finished, looping or not', () => {
    const items = [song('a', 1000), song('b', 1000), song('c'), song('d', 1000)];
    for (const loop of [true, false]) {
      const from = sequence(items, { loop });
      expect(getProgramSongSequenceSelectedItemId(from, 500)).toBe('a');
      expect(getProgramSongSequenceSelectedItemId(from, 1500)).toBe('b');
      expect(getProgramSongSequenceSelectedItemId(from, 2500)).toBe('c');
      expect(getProgramSongSequenceSelectedItemId(from, 90000)).toBe('c');
    }
  });

  it('holds the last song of a sequence that does not loop once the others are done', () => {
    const items = [song('a', 1000), song('b', 1000)];
    expect(getProgramSongSequenceSelectedItemId(sequence(items, { loop: false }), 500)).toBe('a');
    expect(getProgramSongSequenceSelectedItemId(sequence(items, { loop: false }), 90000)).toBe('b');
    expect(getProgramSongSequenceSelectedItemId(sequence(items, { loop: false, activeItemId: 'b' }), 90000)).toBe('b');
  });

  it('plays a sequence with no loop flag as a loop', () => {
    const items = [song('a', 1000), song('b', 1000)];
    expect(getProgramSongSequenceSelectedItemId(sequence(items, { loop: undefined }), 2500)).toBe('a');
  });
});

describe('reading bad input', () => {
  it('reads nothing from a text or song sequence that is not an object, and tolerates no active id', () => {
    for (const bad of [null, undefined, 3, 'x', true]) {
      expect(normalizeProgramTextSequence(bad)).toBeNull();
      expect(normalizeProgramSongSequence(bad)).toBeNull();
    }
  });
});
