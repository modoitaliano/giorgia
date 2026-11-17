export interface ModoItalianoBracketMatch {
  id: number;
  songAId: number | null;
  songBId: number | null;
  winnerId: number | null;
}

export type ModoItalianoBracketStartRound = 'roundOf16' | 'quarterfinals';

export interface ModoItalianoBracketDrawCommand {
  id: number;
  seed: number;
  startedAt: number;
  durationSeconds: number;
  songIds: number[];
  selectedSongId: number | null;
}

const MATCH_COUNT = 15;
const ROUND_OF_16_OPENING_MATCH_IDS = [1, 2, 3, 4, 5, 6, 7, 8];
const QUARTERFINAL_OPENING_MATCH_IDS = [9, 10, 11, 12];

const ADVANCEMENT_TARGETS: Record<number, { matchId: number; slot: 'songAId' | 'songBId' }> = {
  1: { matchId: 9, slot: 'songAId' },
  2: { matchId: 9, slot: 'songBId' },
  3: { matchId: 10, slot: 'songAId' },
  4: { matchId: 10, slot: 'songBId' },
  5: { matchId: 11, slot: 'songAId' },
  6: { matchId: 11, slot: 'songBId' },
  7: { matchId: 12, slot: 'songAId' },
  8: { matchId: 12, slot: 'songBId' },
  9: { matchId: 13, slot: 'songAId' },
  10: { matchId: 13, slot: 'songBId' },
  11: { matchId: 14, slot: 'songAId' },
  12: { matchId: 14, slot: 'songBId' },
  13: { matchId: 15, slot: 'songAId' },
  14: { matchId: 15, slot: 'songBId' }
};

export function normalizeModoItalianoBracketStartRound(startRound: unknown): ModoItalianoBracketStartRound {
  return startRound === 'quarterfinals' ? 'quarterfinals' : 'roundOf16';
}

export function getModoItalianoBracketOpeningMatchIds(startRound: unknown): number[] {
  return normalizeModoItalianoBracketStartRound(startRound) === 'quarterfinals' ? QUARTERFINAL_OPENING_MATCH_IDS : ROUND_OF_16_OPENING_MATCH_IDS;
}

export function createDefaultModoItalianoBracketMatches(): ModoItalianoBracketMatch[] {
  return Array.from({ length: MATCH_COUNT }, (_, index) => ({
    id: index + 1,
    songAId: null,
    songBId: null,
    winnerId: null
  }));
}

export function normalizeModoItalianoBracketSongPoolIds(songIds: unknown, songCatalogIds?: Set<number>): number[] {
  if (!Array.isArray(songIds)) {
    return [];
  }

  const normalized = new Set<number>();
  songIds.forEach((songId) => {
    const numericId = typeof songId === 'number' ? songId : typeof songId === 'string' ? Number(songId) : NaN;
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return;
    }
    if (songCatalogIds && !songCatalogIds.has(numericId)) {
      return;
    }
    normalized.add(numericId);
  });

  return Array.from(normalized);
}

export function normalizeModoItalianoBracketDrawSeed(seed: unknown): number {
  const numericSeed = typeof seed === 'number' ? seed : typeof seed === 'string' ? Number(seed) : NaN;
  return Number.isFinite(numericSeed) && numericSeed > 0 ? Math.floor(numericSeed) : 5;
}

export function normalizeModoItalianoBracketDrawDurationSeconds(durationSeconds: unknown, fallbackSeconds = 5): number {
  const numericDuration = typeof durationSeconds === 'number' ? durationSeconds : typeof durationSeconds === 'string' ? Number(durationSeconds) : NaN;
  const fallback = normalizeModoItalianoBracketDrawSeed(fallbackSeconds);
  return Number.isFinite(numericDuration) && numericDuration > 0 ? Math.max(1, Math.floor(numericDuration)) : fallback;
}

export function normalizeModoItalianoBracketDrawCommand(drawCommand: unknown): ModoItalianoBracketDrawCommand | null {
  if (!drawCommand || typeof drawCommand !== 'object' || Array.isArray(drawCommand)) {
    return null;
  }

  const record = drawCommand as Partial<ModoItalianoBracketDrawCommand> & {
    drawId?: unknown;
    candidateIds?: unknown;
    selectedId?: unknown;
    slot?: { matchId: number; field: 'songAId' | 'songBId' };
    type?: string;
  };

  const idCandidate = typeof record.id === 'number' ? record.id : typeof record.drawId === 'number' ? record.drawId : null;
  if (idCandidate === null) {
    return null;
  }

  const startedAt = typeof record.startedAt === 'number' ? record.startedAt : Date.now();
  const seed = normalizeModoItalianoBracketDrawSeed(record.seed ?? idCandidate);
  const durationSeconds = normalizeModoItalianoBracketDrawDurationSeconds(record.durationSeconds, seed);
  const rawSongIds = record.songIds ?? record.candidateIds;
  const rawSelectedId = record.selectedSongId ?? record.selectedId;

  return {
    id: idCandidate,
    seed,
    startedAt,
    durationSeconds,
    songIds: normalizeModoItalianoBracketSongPoolIds(rawSongIds),
    selectedSongId: normalizeModoItalianoBracketSongPoolIds([rawSelectedId])[0] ?? null
  };
}

export function normalizeModoItalianoBracketMatches(matches: unknown, startRound: unknown = 'roundOf16'): ModoItalianoBracketMatch[] {
  const safeMatches = createDefaultModoItalianoBracketMatches();

  if (!Array.isArray(matches)) {
    return applyModoItalianoBracketAdvancement(safeMatches, startRound);
  }

  matches.forEach((match) => {
    if (!match || typeof match !== 'object') {
      return;
    }

    const record = match as Partial<ModoItalianoBracketMatch>;
    if (typeof record.id !== 'number' || record.id < 1 || record.id > MATCH_COUNT) {
      return;
    }

    safeMatches[record.id - 1] = {
      ...safeMatches[record.id - 1],
      ...record,
      songAId: typeof record.songAId === 'number' ? record.songAId : null,
      songBId: typeof record.songBId === 'number' ? record.songBId : null,
      winnerId: typeof record.winnerId === 'number' ? record.winnerId : null
    };
  });

  return applyModoItalianoBracketAdvancement(safeMatches, startRound);
}

export function applyModoItalianoBracketAdvancement(matches: ModoItalianoBracketMatch[], startRound: unknown = 'roundOf16'): ModoItalianoBracketMatch[] {
  const nextMatches = matches.map((match) => ({ ...match }));
  const usedOpeningSongs = new Set<number>();
  const openingMatchIds = getModoItalianoBracketOpeningMatchIds(startRound);
  const openingMatchIdSet = new Set(openingMatchIds);
  const firstActiveMatchId = Math.min(...openingMatchIds);
  const firstGeneratedMatchId = Math.max(...openingMatchIds) + 1;

  nextMatches.forEach((match) => {
    if (match.id >= firstGeneratedMatchId) {
      match.songAId = null;
      match.songBId = null;
    }
  });

  nextMatches.forEach((match) => {
    if (!openingMatchIdSet.has(match.id)) {
      return;
    }

    if (match.songAId !== null && usedOpeningSongs.has(match.songAId)) {
      match.songAId = null;
    }
    if (match.songAId !== null) {
      usedOpeningSongs.add(match.songAId);
    }

    if (match.songBId !== null && usedOpeningSongs.has(match.songBId)) {
      match.songBId = null;
    }
    if (match.songBId !== null) {
      usedOpeningSongs.add(match.songBId);
    }
  });

  nextMatches.forEach((match) => {
    if (match.id < firstActiveMatchId) {
      return;
    }

    if (match.winnerId !== null && match.winnerId !== match.songAId && match.winnerId !== match.songBId) {
      match.winnerId = null;
    }

    const target = ADVANCEMENT_TARGETS[match.id];
    if (target && nextMatches[target.matchId - 1]) {
      nextMatches[target.matchId - 1][target.slot] = match.winnerId;
    }
  });

  return nextMatches;
}

export { ModoItalianoBracket, type ModoItalianoBracketProps } from './ModoItalianoBracketComponent.js';
