import { describe, expect, it } from 'vitest';
import { resolveProgramRow } from './programRow.js';

describe('resolveProgramRow', () => {
  it('rows the Giorgia clock with the Giorgia chyron, in either order and among other components', () => {
    for (const components of [
      ['modoitaliano-giorgia-clock', 'modoitaliano-giorgia-chyron'],
      ['modoitaliano-giorgia-chyron', 'modoitaliano-giorgia-bracket', 'modoitaliano-giorgia-clock'],
    ]) {
      const plan = resolveProgramRow(components);
      expect(plan).toEqual({
        clockType: 'modoitaliano-giorgia-clock',
        chyronType: 'modoitaliano-giorgia-chyron',
        ownedTypes: new Set(['modoitaliano-giorgia-clock', 'modoitaliano-giorgia-chyron']),
      });
    }
  });

  it('leaves components standalone when there is nothing to pair', () => {
    expect(resolveProgramRow([])).toBeNull();
    expect(resolveProgramRow(['modoitaliano-giorgia-clock'])).toBeNull();
    expect(resolveProgramRow(['modoitaliano-giorgia-chyron', 'modoitaliano-giorgia-podcast-player'])).toBeNull();
    // Retired ids are the caller's to map first; on their own they pair nothing.
    expect(resolveProgramRow(['modoitaliano-clock', 'modoitaliano-chyron'])).toBeNull();
  });
});
