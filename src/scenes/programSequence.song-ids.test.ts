import { describe, expect, it } from 'vitest';
import { normalizeProgramSongSequence } from './programSequence.js';

// Ported with gaulatti/alcantara#378: a manual song without a string id keeps one id across normalisations.
const song = (overrides: Record<string, unknown> = {}) => ({
  title: 'Fictional song',
  artist: 'Fictional artist',
  audioUrl: 'https://media.example.test/song.mp3',
  durationMs: 120000,
  ...overrides,
});

const idsOf = (items: unknown[]) =>
  (normalizeProgramSongSequence({ mode: 'manual', items }) ?? { items: [] }).items.map((item) => item.id);

describe('song ids in a sequence', () => {
  it('keeps the first occurrence of a song without a string id on its content-derived id', () => {
    const alone = idsOf([song()]);
    const twice = idsOf([song(), song()]);
    expect(twice[0]).toBe(alone[0]);
  });

  it('gives a repeat of the same id-less song its own id', () => {
    const [first, repeat, third] = idsOf([song(), song(), song()]);
    expect(new Set([first, repeat, third]).size).toBe(3);
    expect(repeat).toBe(`${first}_2`);
    expect(third).toBe(`${first}_3`);
  });

  it('leaves songs with a string id exactly as they are, repeats included', () => {
    expect(idsOf([song({ id: 'song-1' }), song({ id: 'song-1' })])).toEqual(['song-1', 'song-1']);
  });

  it('keeps the ids stable when the same sequence is normalised again', () => {
    const items = [song(), song()];
    expect(idsOf(items)).toEqual(idsOf(items));
  });

  it('derives the id from the content Alcántara hashes, so both give a song the same id', () => {
    // FNV-1a of JSON.stringify([songId, audioUrl, title, artist, durationMs]), as gaulatti/alcantara#378 computes it.
    const [id] = idsOf([song()]);
    expect(id).toMatch(/^song_[0-9a-z]+$/);
    expect(idsOf([song({ songId: 7 })])[0]).not.toBe(id);
    expect(idsOf([song({ title: 'Another fictional song' })])[0]).not.toBe(id);
  });

  it('treats an empty string id as no id', () => {
    const [plain] = idsOf([song()]);
    expect(idsOf([song({ id: '' }), song({ id: '' })])).toEqual([plain, `${plain}_2`]);
  });

  it('does not suffix a given id that repeats a derived one, and skips taken suffixes', () => {
    const [derived] = idsOf([song()]);
    expect(idsOf([song(), song({ id: `${derived}_2` }), song()])).toEqual([
      derived,
      `${derived}_2`,
      `${derived}_3`,
    ]);
  });

  it('drops items that are not songs without spending an occurrence', () => {
    const [derived] = idsOf([song()]);
    expect(idsOf([song(), null, 'not a song', song()])).toEqual([derived, `${derived}_2`]);
  });
});
