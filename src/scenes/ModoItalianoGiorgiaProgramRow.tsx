import React from 'react';
import { GIORGIA } from './giorgiaBroadcast.js';
import type { GlobalTimeOverride } from './broadcastTime.js';
import type { ProgramAudioBusSource } from './audioBus.js';
import { ModoItalianoGiorgiaChyron } from './ModoItalianoGiorgiaChyron.js';
import { ModoItalianoGiorgiaClock } from './ModoItalianoGiorgiaClock.js';

/**
 * The clock scene's stored props the row reads. Values come as the scene stored them and are read the
 * way Alcántara reads them: booleans, non-zero numbers, and `true`/`1`/`yes`/`on` or `false`/`0`/`no`/`off`/`''`.
 */
export interface ModoItalianoGiorgiaProgramRowClockProps {
  /** Default true. */
  showWorldClocks?: unknown;
  /** Default true. */
  showLogo?: unknown;
  /** Default true. */
  showPlaybackProgress?: unknown;
  /** Default false. Set on the clock or the chyron, it keys the whole row. */
  keySafe?: unknown;
}

/** The chyron scene's stored props the row reads, read like the clock's. */
export interface ModoItalianoGiorgiaProgramRowChyronProps {
  /** Default true. */
  show?: unknown;
  textSequence?: unknown;
  ctaSequence?: unknown;
  /** Default false. Set on the clock or the chyron, it keys the whole row. */
  keySafe?: unknown;
}

export interface ModoItalianoGiorgiaProgramRowProps {
  programId: string;
  timeOverride?: GlobalTimeOverride | null;
  songSequence?: unknown;
  /** Where the on-air block reads the playing song. */
  audioBus: ProgramAudioBusSource;
  clockProps?: ModoItalianoGiorgiaProgramRowClockProps;
  chyronProps?: ModoItalianoGiorgiaProgramRowChyronProps;
}

/** Alcántara's toBoolean: booleans as they are, non-zero numbers, and the usual words; anything else is the fallback. */
function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
}

/**
 * The bottom row a scene's Giorgia clock and chyron share (moved from Alcántara's
 * `frontend/app/components/ModoItalianoProgramRow.tsx`). The clock's header sits top-left by itself;
 * the chyron and the clock's on-air block sit side by side between the safe edges at the bottom.
 */
export const ModoItalianoGiorgiaProgramRow: React.FC<ModoItalianoGiorgiaProgramRowProps> = ({
  programId,
  timeOverride = null,
  songSequence,
  audioBus,
  clockProps = {},
  chyronProps = {}
}) => {
  const showChyron = toBoolean(chyronProps.show, true);
  const clockCommonProps = {
    programId,
    audioBus,
    timeOverride,
    transitionDurationMs: 300,
    shuffleCities: false,
    widthPx: 220,
    showWorldClocks: toBoolean(clockProps.showWorldClocks, true),
    showLogo: toBoolean(clockProps.showLogo, true),
    showPlaybackProgress: toBoolean(clockProps.showPlaybackProgress, true),
    showBellIcon: false,
    songSequence,
    language: 'es' as const
  };

  // One switch for the pair: set on either component, it applies to both.
  const keySafe = toBoolean(clockProps.keySafe, false) || toBoolean(chyronProps.keySafe, false);
  return (
    <>
      {/* The Giorgia clock is a top-left header, separate from the row; only its on-air block sits in the row. */}
      <ModoItalianoGiorgiaClock {...clockCommonProps} part='header' keySafe={keySafe} />
      <div
        data-program-row='giorgia'
        className='absolute z-[950] flex items-end gap-12'
        style={{ left: `${GIORGIA.safeX}px`, right: `${GIORGIA.safeX}px`, bottom: `${GIORGIA.safeBottom}px` }}
      >
        {/*
          The headline keeps at least half the row, so a long now-playing title cannot squeeze it out.
          While the chyron is hidden the slot is empty and removed, and the on-air block takes the left edge.
        */}
        <div data-program-row-slot='chyron' className='flex-1 min-w-[50%] empty:hidden'>
          <ModoItalianoGiorgiaChyron show={showChyron} textSequence={chyronProps.textSequence} ctaSequence={chyronProps.ctaSequence} inline keySafe={keySafe} />
        </div>
        <div data-program-row-slot='clock' className='min-w-0'>
          <ModoItalianoGiorgiaClock {...clockCommonProps} part='onAir' inline keySafe={keySafe} />
        </div>
      </div>
    </>
  );
};
