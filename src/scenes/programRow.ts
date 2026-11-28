// The scene decision behind the Giorgia program row (gaulatti/alcantara#391): which of a scene's components
// ModoItalianoGiorgiaProgramRow draws together, so the program does not also draw them standalone.

export type ProgramRowClockType = 'modoitaliano-giorgia-clock';
export type ProgramRowChyronType = 'modoitaliano-giorgia-chyron';

export interface ProgramRowPlan {
  /** Clock rendered at the right end of the row. */
  clockType: ProgramRowClockType;
  /** Chyron rendered in the left slot. */
  chyronType: ProgramRowChyronType;
  /** Component types the row renders itself; they must not also render standalone. */
  ownedTypes: ReadonlySet<string>;
}

/**
 * Decides whether a scene's clock and chyron share one bottom row: they do when the scene lists both Giorgia types.
 * Expects the scene's component types with any retired id already mapped to its Giorgia replacement.
 */
export function resolveProgramRow(components: readonly string[]): ProgramRowPlan | null {
  if (components.includes('modoitaliano-giorgia-clock') && components.includes('modoitaliano-giorgia-chyron')) {
    return {
      clockType: 'modoitaliano-giorgia-clock',
      chyronType: 'modoitaliano-giorgia-chyron',
      ownedTypes: new Set<string>(['modoitaliano-giorgia-clock', 'modoitaliano-giorgia-chyron']),
    };
  }
  return null;
}
