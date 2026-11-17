// Reads the optional `playingTrack` of the v2 projected template state
// (pinned contract for gaulatti/alcantara#178). Alcantara sets it only while the
// engine has confirmed a start, and leaves it out otherwise, so an absent field
// means nothing confirmed is playing. An Alcantara without #178 never sends it.

export interface PlayingTrack {
  /** The engine's playback request id. */
  playbackId: string;
  /** As recorded in the as-run log; null when the playout engine omits it. */
  title: string | null;
  /** As recorded in the as-run log; null when the playout engine omits it. */
  artist: string | null;
  /** ISO-8601 time the engine accepted the start. */
  startedAt: string;
  /** The track's cover as an absolute public https address (alcantara#179); absent when there is none. */
  coverUrl?: string;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

/**
 * The playing track carried by a projected state, or null when the state has
 * none. A value that does not have the contract's shape is treated as absent:
 * nothing is shown from it and nothing in it is repaired.
 */
export function readPlayingTrack(state: unknown): PlayingTrack | null {
  if (!state || typeof state !== 'object') return null;
  const track = (state as Record<string, unknown>).playingTrack;
  if (!track || typeof track !== 'object' || Array.isArray(track)) return null;
  const record = track as Record<string, unknown>;
  const title = nullableText(record.title);
  const artist = nullableText(record.artist);
  if (
    typeof record.playbackId !== 'string' ||
    typeof record.startedAt !== 'string' ||
    title === undefined ||
    artist === undefined ||
    (record.coverUrl !== undefined && typeof record.coverUrl !== 'string')
  ) {
    return null;
  }
  return {
    playbackId: record.playbackId,
    title,
    artist,
    startedAt: record.startedAt,
    ...(typeof record.coverUrl === 'string' ? { coverUrl: record.coverUrl } : {})
  };
}
