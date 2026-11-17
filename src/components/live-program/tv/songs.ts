export interface SongCatalogItem {
  id: number;
  assetId?: string;
  artist: string;
  title: string;
  audioUrl?: string;
  coverUrl?: string | null;
  durationMs?: number | null;
  earoneSongId?: string | null;
  earoneRank?: string | null;
  earoneSpins?: string | null;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

/** The song catalog from the program's API; an empty list when it cannot be read. */
export async function fetchSongCatalog(apiBaseUrl: string): Promise<SongCatalogItem[]> {
  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/songs?limit=0`);
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || body;
  } catch {
    return [];
  }
}
