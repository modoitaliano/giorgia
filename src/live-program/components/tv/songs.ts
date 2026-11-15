import { apiUrl } from './apiBaseUrl.js';

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

export async function fetchSongCatalog(): Promise<SongCatalogItem[]> {
  try {
    const res = await fetch(apiUrl('/songs?limit=0'));
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || body;
  } catch {
    return [];
  }
}
