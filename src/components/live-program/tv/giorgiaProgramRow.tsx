// The bottom row the Giorgia clock and chyron share, ported from Alcantara
// (gaulatti/alcantara b4a51c7: frontend/app/utils/programRow.ts and the Giorgia
// branch of frontend/app/components/ModoItalianoProgramRow.tsx). Only the
// Giorgia family is ported: the legacy modoitaliano-* row is never mixed with it
// and is not drawn by LiveProgram.
import React from 'react';
import type { GlobalTimeOverride } from './broadcastTime.js';
import type { PlayingTrack } from '../utils/playingTrack.js';
import { GIORGIA } from './giorgiaBroadcast.js';
import { ModoItalianoGiorgiaChyron } from './ModoItalianoGiorgiaChyron.js';
import { ModoItalianoGiorgiaClock } from './ModoItalianoGiorgiaClock.js';

export const MODOITALIANO_GIORGIA_CLOCK = 'modoitaliano-giorgia-clock';
export const MODOITALIANO_GIORGIA_CHYRON = 'modoitaliano-giorgia-chyron';

/** What the program, not the scene, gives the Giorgia clock: the bus key, the time override, the song sequence and the playing track. */
export interface GiorgiaProgramContext {
  programId: string;
  timeOverride: GlobalTimeOverride | null;
  songSequence: unknown;
  /** The latest state's `playingTrack` (gaulatti/alcantara#178), or null when that state has none. */
  playingTrack: PlayingTrack | null;
}

export interface GiorgiaProgramRowPlan {
  /** Component types the row draws itself; they must not also draw standalone. */
  ownedTypes: ReadonlySet<string>;
}

/** Alcantara's toBoolean: booleans as they are, non-zero numbers, and the usual words; anything else is the fallback. */
export function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
}

/** The row owns both Giorgia types only when the scene lists both; otherwise each draws by itself. */
export function resolveGiorgiaProgramRow(components: readonly string[]): GiorgiaProgramRowPlan | null {
  if (components.includes(MODOITALIANO_GIORGIA_CLOCK) && components.includes(MODOITALIANO_GIORGIA_CHYRON)) {
    return { ownedTypes: new Set<string>([MODOITALIANO_GIORGIA_CLOCK, MODOITALIANO_GIORGIA_CHYRON]) };
  }
  return null;
}

/** The props Alcantara gives the Giorgia clock, alone or in the row (program.tsx:2460-2479, ModoItalianoProgramRow). */
export function giorgiaClockCommonProps(clockProps: Record<string, unknown>, context: GiorgiaProgramContext) {
  return {
    programId: context.programId,
    timeOverride: context.timeOverride,
    transitionDurationMs: 300,
    shuffleCities: false,
    widthPx: 220,
    showWorldClocks: toBoolean(clockProps.showWorldClocks, true),
    showLogo: toBoolean(clockProps.showLogo, true),
    showPlaybackProgress: toBoolean(clockProps.showPlaybackProgress, true),
    showBellIcon: false,
    songSequence: context.songSequence,
    playingTrack: context.playingTrack,
    language: 'es' as const
  };
}

export interface GiorgiaProgramRowProps {
  clockProps: Record<string, unknown>;
  chyronProps: Record<string, unknown>;
  context: GiorgiaProgramContext;
}

/**
 * The header at the top left, and the chyron and the on-air block side by side
 * between the safe edges at the bottom. keySafe on either type keys the whole row.
 */
export function GiorgiaProgramRow({ clockProps, chyronProps, context }: GiorgiaProgramRowProps) {
  const clockCommonProps = giorgiaClockCommonProps(clockProps, context);
  const showChyron = toBoolean(chyronProps.show, true);
  const keySafe = toBoolean(clockProps.keySafe, false) || toBoolean(chyronProps.keySafe, false);
  return (
    <>
      <ModoItalianoGiorgiaClock {...clockCommonProps} part='header' keySafe={keySafe} />
      <div
        data-program-row='giorgia'
        className='absolute z-[950] flex items-end gap-12'
        style={{ left: `${GIORGIA.safeX}px`, right: `${GIORGIA.safeX}px`, bottom: `${GIORGIA.safeBottom}px` }}
      >
        <div data-program-row-slot='chyron' className='flex-1 min-w-[50%] empty:hidden'>
          <ModoItalianoGiorgiaChyron
            show={showChyron}
            textSequence={chyronProps.textSequence}
            ctaSequence={chyronProps.ctaSequence}
            inline
            keySafe={keySafe}
          />
        </div>
        <div data-program-row-slot='clock' className='min-w-0'>
          <ModoItalianoGiorgiaClock {...clockCommonProps} part='onAir' inline keySafe={keySafe} />
        </div>
      </div>
    </>
  );
}
