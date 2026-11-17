// Pure matching helpers ported from gaulatti/alcantara
// frontend/app/utils/earoneRealtime.ts. The chart-proxy URL constant and every
// call to it are intentionally not ported: this module never reaches the network.

export interface EaroneRealtimeEntry {
  earoneSongId: string | null;
  ranking: string | null;
  radioSpinsToday: string | null;
  artist: string;
  title: string;
  normalizedKey: string;
  spotifyPlays: string | null;
  youtubeViews: string | null;
  youtubeLikes: string | null;
}

export interface EaroneRealtimeLookup {
  bySongId: Record<string, EaroneRealtimeEntry>;
  byNormalizedText: Record<string, EaroneRealtimeEntry>;
  updatedAt: string | null;
  sources?: {
    earoneUpdatedAt: string | null;
    escplusUpdatedAt: string | null;
  };
}

function normalizeFragment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEaroneMatchKey(value: string): string {
  return normalizeFragment(value);
}

export function buildEaroneRealtimeLookup(payload: unknown): EaroneRealtimeLookup {
  const source = payload as any;
  const entries: EaroneRealtimeEntry[] = Array.isArray(source?.entries) ? source.entries : [];

  const lookup: EaroneRealtimeLookup = {
    bySongId: {},
    byNormalizedText: {},
    updatedAt: typeof source?.updatedAt === 'string' ? source.updatedAt : null,
    sources:
      source?.sources && typeof source.sources === 'object'
        ? {
            earoneUpdatedAt: typeof source.sources.earoneUpdatedAt === 'string' ? source.sources.earoneUpdatedAt : null,
            escplusUpdatedAt: typeof source.sources.escplusUpdatedAt === 'string' ? source.sources.escplusUpdatedAt : null
          }
        : undefined
  };

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !entry.normalizedKey || !entry.artist || !entry.title) {
      continue;
    }

    if (entry.earoneSongId) {
      lookup.bySongId[entry.earoneSongId] = entry;
    }
    if (!lookup.byNormalizedText[entry.normalizedKey]) {
      lookup.byNormalizedText[entry.normalizedKey] = entry;
    }
  }

  return lookup;
}

export function matchEaroneRealtimeEntry(
  lookup: EaroneRealtimeLookup | null,
  options: {
    earoneSongId?: string | null;
    text?: string | null;
  }
): EaroneRealtimeEntry | null {
  if (!lookup) {
    return null;
  }

  const normalizedId = typeof options.earoneSongId === 'string' && options.earoneSongId.trim() ? options.earoneSongId.trim() : null;
  if (normalizedId && lookup.bySongId[normalizedId]) {
    return lookup.bySongId[normalizedId];
  }

  const normalizedText = typeof options.text === 'string' && options.text.trim() ? normalizeEaroneMatchKey(options.text) : '';
  if (normalizedText && lookup.byNormalizedText[normalizedText]) {
    return lookup.byNormalizedText[normalizedText];
  }

  return null;
}
