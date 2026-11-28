import { describe, expect, it } from 'vitest';
import * as scenes from '../../../scenes/programSequence.js';
import * as tv from './programSequence.js';

// modoitaliano/giorgia#84: TV has no sequence logic of its own, so every fix to the scenes module (stable song ids,
// shuffle play order, rotation state) reaches the TV graphics with it.
describe('TV program sequences', () => {
  it('are the shared scenes functions themselves', () => {
    expect(tv.normalizeProgramSongSequence).toBe(scenes.normalizeProgramSongSequence);
    expect(tv.normalizeProgramTextSequence).toBe(scenes.normalizeProgramTextSequence);
    expect(tv.resolveProgramSongLeaf).toBe(scenes.resolveProgramSongLeaf);
    expect(tv.resolveProgramTextLeaf).toBe(scenes.resolveProgramTextLeaf);
    expect(Object.keys(tv).sort()).toEqual([
      'normalizeProgramSongSequence',
      'normalizeProgramTextSequence',
      'resolveProgramSongLeaf',
      'resolveProgramTextLeaf',
    ]);
  });
});
