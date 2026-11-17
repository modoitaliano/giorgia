/**
 * Input Giorgia does not recognize is ignored, not rejected (gaulatti/ariston#217:
 * "If we don't recognize it, we ignore it"). Each ignored item is counted
 * under a fixed reason, and the first one of each reason writes one log line
 * naming only that reason, so neither the counters nor the log grow with
 * the input. Nothing from the input itself (names, values) is logged.
 */
export const IGNORED_INPUT_REASONS = [
  /** A body block whose `type` this release does not render: the block is dropped. */
  'document_body_block_type',
  /** A heading `level` other than 2, 3 or 4: rendered as level 2. */
  'document_heading_level',
  /** An `infoBox` `tone` outside neutral/info/warning/success: rendered as `neutral`. */
  'document_info_box_tone',
  /** A Spotify `embedKind` outside track/album/playlist/episode/show: passed to Spotify as sent. */
  'document_spotify_embed_kind',
  /** A `heroLayout` outside spotlight/editorial: treated as absent. */
  'document_hero_layout',
  /** An embed provider the helper does not declare: the helper yields '' and the embed is omitted. */
  'embed_provider',
] as const;

export type IgnoredInputReason = (typeof IGNORED_INPUT_REASONS)[number];

const counts = new Map<IgnoredInputReason, number>();

export function recordIgnoredInput(reason: IgnoredInputReason): void {
  const previous = counts.get(reason) ?? 0;
  counts.set(reason, previous + 1);
  if (previous === 0) console.warn(`[giorgia] ignored unrecognized input: ${reason}`);
}

/** Counts of ignored input since this module loaded, one entry per reason. */
export function ignoredInputCounts(): Readonly<Record<IgnoredInputReason, number>> {
  return Object.freeze(
    Object.fromEntries(IGNORED_INPUT_REASONS.map((reason) => [reason, counts.get(reason) ?? 0])) as Record<IgnoredInputReason, number>,
  );
}
