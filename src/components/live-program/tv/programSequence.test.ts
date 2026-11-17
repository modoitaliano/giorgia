import { describe, expect, it } from 'vitest';
import {
  normalizeProgramSongSequence,
  normalizeProgramTextSequence,
  resolveProgramSongLeaf,
  resolveProgramTextLeaf
} from './programSequence.js';

const HARBOR = 'Harbor Light';

describe('program text sequences', () => {
  it('rejects non-objects and over-deep nesting', () => {
    expect(normalizeProgramTextSequence(null)).toBeNull();
    expect(normalizeProgramTextSequence([])).toBeNull();
    expect(normalizeProgramTextSequence('x')).toBeNull();
    expect(normalizeProgramTextSequence({ items: [] }, 9)).toBeNull();
  });

  it('normalizes leaves, labels, ids, marquee and the sequence shape', () => {
    const sequence = normalizeProgramTextSequence(
      {
        mode: 'shuffle',
        intervalMs: 999.7,
        loop: 0,
        startedAt: 42,
        activeItemId: 'b',
        items: [
          { id: 'a', text: '  ', label: 'Label only' },
          { id: 'b', text: 'Text', useMarquee: 1 },
          { id: '', text: 7 },
          'junk',
          { kind: 'sequence', id: 'n', label: ' ', sequence: { items: [{ id: 'x', text: 'Nested' }] } },
          { kind: 'sequence', sequence: null },
          { kind: 'sequence', label: 'Named', sequence: { items: [] } }
        ]
      },
      0,
      { includeMarquee: true }
    )!;
    expect(sequence.mode).toBe('shuffle');
    expect(sequence.intervalMs).toBe(999);
    expect(sequence.loop).toBe(false);
    expect(sequence.startedAt).toBe(42);
    expect(sequence.activeItemId).toBe('b');
    expect(sequence.items).toHaveLength(5);
    expect(sequence.items[0]).toMatchObject({ id: 'a', text: 'Label only', useMarquee: false });
    expect(sequence.items[1]).toMatchObject({ text: 'Text', useMarquee: true });
    expect(sequence.items[2]).toMatchObject({ kind: 'preset', text: '' });
    expect(sequence.items[2].id).toMatch(/^preset_/);
    expect(sequence.items[3]).toMatchObject({ id: 'n', label: 'Nested Sequence', kind: 'sequence' });
    expect(sequence.items[4]).toMatchObject({ label: 'Named', kind: 'sequence' });
    expect(sequence.items[4].id).toMatch(/^sequence_/);

    const defaults = normalizeProgramTextSequence({ items: 'nope', intervalMs: 100, startedAt: Infinity, activeItemId: 'missing' })!;
    expect(defaults).toMatchObject({ mode: 'manual', items: [], activeItemId: null, intervalMs: 4000, loop: true });
    expect(typeof defaults.startedAt).toBe('number');
    expect(normalizeProgramTextSequence({ mode: 'autoplay', activeItemId: null, items: [{ id: 'a', text: 'A' }] })).toMatchObject({
      mode: 'autoplay',
      activeItemId: null
    });
    expect(normalizeProgramTextSequence({ mode: 'other', items: [{ id: 'a', text: 'A' }] })!.items[0]).toMatchObject({
      useMarquee: undefined
    });
  });

  it('resolves the text leaf by content mode, mode, interval and loop', () => {
    expect(resolveProgramTextLeaf({ contentMode: 'text', sequence: { items: [{ id: 'a', text: 'A' }] } })).toBeNull();
    expect(resolveProgramTextLeaf({})).toBeNull();
    expect(resolveProgramTextLeaf({ contentMode: 'sequence' })).toBeNull();
    expect(resolveProgramTextLeaf({ sequence: { items: [] } })).toBeNull();
    expect(resolveProgramTextLeaf({ sequence: { activeItemId: null, items: [{ id: 'a', text: 'A' }] } })).toBeNull();

    const items = [
      { id: 'a', text: 'A', useMarquee: true },
      { id: 'b', text: 'B' },
      { kind: 'sequence', id: 'n', label: HARBOR, sequence: { items: [{ id: 'c', text: 'C' }] } }
    ];
    expect(resolveProgramTextLeaf({ contentMode: 'sequence', sequence: { items, activeItemId: 'b' } }, 0)).toEqual({
      text: 'B',
      useMarquee: false,
      activePathLabels: ['B']
    });
    expect(resolveProgramTextLeaf({ sequence: { items } }, 0, { includeMarquee: true })).toMatchObject({ useMarquee: true });
    const autoplay = { mode: 'autoplay', startedAt: 0, intervalMs: 1000, items };
    expect(resolveProgramTextLeaf({ sequence: autoplay }, 2500)).toEqual({ text: 'C', useMarquee: false, activePathLabels: [HARBOR, 'C'] });
    expect(resolveProgramTextLeaf({ sequence: autoplay }, 3500)!.text).toBe('A');
    expect(resolveProgramTextLeaf({ sequence: { ...autoplay, loop: false } }, 9000)!.text).toBe('C');
    expect(resolveProgramTextLeaf({ sequence: { ...autoplay, loop: false } }, 1500)!.text).toBe('B');
    expect(resolveProgramTextLeaf({ sequence: { ...autoplay, startedAt: 5000 } }, 0)!.text).toBe('A');
  });
});

describe('program song sequences', () => {
  it('rejects non-objects and over-deep nesting', () => {
    expect(normalizeProgramSongSequence(undefined)).toBeNull();
    expect(normalizeProgramSongSequence({ items: [] }, 9)).toBeNull();
    expect(resolveProgramSongLeaf({ sequence: 'x' })).toBeNull();
    expect(resolveProgramSongLeaf({ sequence: { items: [] } })).toBeNull();
    expect(resolveProgramSongLeaf({ sequence: { activeItemId: null, items: [{ id: 'a' }] } })).toBeNull();
  });

  it('normalizes song leaves field by field', () => {
    const sequence = normalizeProgramSongSequence({
      items: [
        {
          id: 'a',
          songId: 7,
          highRotation: true,
          artist: ' Alba ',
          title: ' Cuore ',
          coverUrl: ' /c.jpg ',
          audioUrl: ' /a.mp3 ',
          durationMs: 1234.6,
          earoneSongId: ' 501 ',
          earoneRank: ' 1 ',
          earoneSpins: ' 310 '
        },
        { songId: 1.5, artist: 3, title: ' ', coverUrl: 1, audioUrl: ' ', durationMs: -1, earoneSongId: 9, earoneRank: 2, earoneSpins: 12 },
        { songId: -1, durationMs: Infinity, earoneSongId: Infinity, earoneSpins: Infinity },
        { kind: 'sequence', id: 'n', label: HARBOR, sequence: { items: [{ id: 'z', artist: 'Z' }] } },
        { kind: 'sequence', sequence: 5 },
        { kind: 'sequence', label: ' ', sequence: {} },
        null
      ]
    })!;
    expect(sequence.mode).toBe('autoplay');
    expect(sequence.items).toHaveLength(5);
    expect(sequence.items[0]).toEqual({
      id: 'a',
      kind: 'preset',
      songId: 7,
      highRotation: true,
      artist: 'Alba',
      title: 'Cuore',
      coverUrl: '/c.jpg',
      audioUrl: '/a.mp3',
      durationMs: 1235,
      earoneSongId: '501',
      earoneRank: '1',
      earoneSpins: '310'
    });
    expect(sequence.items[1]).toMatchObject({
      kind: 'preset',
      songId: undefined,
      highRotation: false,
      artist: '',
      title: '',
      coverUrl: '',
      audioUrl: undefined,
      durationMs: undefined,
      earoneSongId: '9',
      earoneRank: undefined,
      earoneSpins: '12'
    });
    expect(sequence.items[1].id).toMatch(/^song_/);
    expect(sequence.items[2]).toMatchObject({ songId: undefined, durationMs: undefined, earoneSongId: undefined, earoneSpins: undefined });
    expect(sequence.items[3]).toMatchObject({ id: 'n', label: HARBOR, kind: 'sequence' });
    expect(sequence.items[4]).toMatchObject({ label: 'Nested Sequence', kind: 'sequence' });
  });

  const song = (id: string, durationMs?: number) => ({ id, artist: `Artist ${id}`, title: `Title ${id}`, durationMs });

  it('resolves manual selection and labels', () => {
    expect(resolveProgramSongLeaf({ sequence: { mode: 'manual', activeItemId: 'b', items: [song('a'), song('b')] } }, 0)).toMatchObject({
      id: 'b',
      highRotation: false,
      activePathLabels: ['Artist b - Title b']
    });
    expect(resolveProgramSongLeaf({ sequence: { mode: 'manual', items: [{ id: 'blank' }] } })!.activePathLabels).toEqual(['Song Preset']);
    expect(
      resolveProgramSongLeaf({
        sequence: { mode: 'manual', items: [{ kind: 'sequence', label: HARBOR, sequence: { mode: 'manual', items: [song('n')] } }] }
      })!.activePathLabels
    ).toEqual([HARBOR, 'Artist n - Title n']);
  });

  it('walks autoplay items by duration, looping as a cycle when every duration is known', () => {
    const looping = { startedAt: 0, items: [song('a', 1000), song('b', 2000), song('c', 1000)] };
    expect(resolveProgramSongLeaf({ sequence: looping }, 500)!.id).toBe('a');
    expect(resolveProgramSongLeaf({ sequence: looping }, 1500)!.id).toBe('b');
    expect(resolveProgramSongLeaf({ sequence: looping }, 3500)!.id).toBe('c');
    expect(resolveProgramSongLeaf({ sequence: looping }, 4500)!.id).toBe('a');
    expect(resolveProgramSongLeaf({ sequence: { ...looping, activeItemId: 'c' } }, 1500)!.id).toBe('a');
    expect(resolveProgramSongLeaf({ sequence: { ...looping, startedAt: 9000 } }, 0)!.id).toBe('a');
    expect(resolveProgramSongLeaf({ sequence: { ...looping, startedAt: undefined } })!.id).toBe('a');
  });

  it('stops at an item without a duration, and a non-looping sequence stays on its last item', () => {
    const unknown = { startedAt: 0, items: [song('a', 1000), song('b'), song('c', 1000)] };
    expect(resolveProgramSongLeaf({ sequence: unknown }, 500)!.id).toBe('a');
    expect(resolveProgramSongLeaf({ sequence: unknown }, 99999)!.id).toBe('b');
    const once = { startedAt: 0, loop: false, items: [song('a', 1000), song('b', 1000)] };
    expect(resolveProgramSongLeaf({ sequence: once }, 500)!.id).toBe('a');
    expect(resolveProgramSongLeaf({ sequence: once }, 99999)!.id).toBe('b');
    expect(resolveProgramSongLeaf({ sequence: { ...once, items: [song('a'), song('b', 1000)] } }, 99999)!.id).toBe('a');
  });
});
