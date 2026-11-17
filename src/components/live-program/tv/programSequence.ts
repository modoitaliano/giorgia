export type ProgramSequenceMode = 'manual' | 'autoplay' | 'shuffle';
export type ProgramTextContentMode = 'text' | 'sequence';
export type ProgramSongContentMode = 'sequence';

interface BaseSequenceItem {
  id: string;
}

interface BaseSequence<TItem extends BaseSequenceItem> {
  mode: ProgramSequenceMode;
  items: TItem[];
  activeItemId: string | null;
  intervalMs: number;
  loop: boolean;
  startedAt: number;
}

type RecordValue = Record<string, unknown>;
const MAX_DEPTH = 8;

export interface ProgramTextSequenceLeafItem extends BaseSequenceItem {
  kind: 'preset';
  text: string;
  useMarquee?: boolean;
}

export interface ProgramTextSequenceNestedItem extends BaseSequenceItem {
  label: string;
  kind: 'sequence';
  sequence: ProgramTextSequence;
}

export type ProgramTextSequenceItem =
  | ProgramTextSequenceLeafItem
  | ProgramTextSequenceNestedItem;

export type ProgramTextSequence = BaseSequence<ProgramTextSequenceItem>;

export interface ProgramResolvedTextContent {
  text: string;
  useMarquee: boolean;
  source: ProgramTextContentMode;
  activePathLabels: string[];
}

export interface ProgramResolvedTextLeaf {
  text: string;
  useMarquee: boolean;
  activePathLabels: string[];
}

export interface ProgramSongSequenceLeafItem extends BaseSequenceItem {
  kind: 'preset';
  songId?: number;
  highRotation?: boolean;
  artist: string;
  title: string;
  coverUrl: string;
  audioUrl?: string;
  durationMs?: number;
  earoneSongId?: string;
  earoneRank?: string;
  earoneSpins?: string;
}

export interface ProgramSongSequenceNestedItem extends BaseSequenceItem {
  label: string;
  kind: 'sequence';
  sequence: ProgramSongSequence;
}

export type ProgramSongSequenceItem =
  | ProgramSongSequenceLeafItem
  | ProgramSongSequenceNestedItem;

export type ProgramSongSequence = BaseSequence<ProgramSongSequenceItem>;

export interface ProgramResolvedSongLeaf {
  id: string;
  songId?: number;
  highRotation: boolean;
  artist: string;
  title: string;
  coverUrl: string;
  audioUrl?: string;
  durationMs?: number;
  earoneSongId?: string;
  earoneRank?: string;
  earoneSpins?: string;
  activePathLabels: string[];
}

function asRecord(value: unknown): RecordValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as RecordValue;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMode(value: unknown): ProgramSequenceMode {
  if (value === 'autoplay') return 'autoplay';
  if (value === 'shuffle') return 'shuffle';
  return 'manual';
}

function normalizeTextContentMode(
  contentMode: unknown,
  sequence: ProgramTextSequence | null
): ProgramTextContentMode {
  if (contentMode === 'text') {
    return 'text';
  }
  if (contentMode === 'sequence') {
    return 'sequence';
  }
  return sequence ? 'sequence' : 'text';
}

function normalizeTextLeafItem(
  record: RecordValue,
  options?: { includeMarquee?: boolean }
): ProgramTextSequenceLeafItem {
  const text =
    typeof record.text === 'string' && record.text.trim()
      ? record.text
      : typeof record.label === 'string'
        ? record.label
        : '';

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createId('preset'),
    kind: 'preset',
    text,
    useMarquee: options?.includeMarquee ? Boolean(record.useMarquee) : undefined
  };
}

function normalizeSongLeafItem(record: RecordValue): ProgramSongSequenceLeafItem {
  const artist =
    typeof record.artist === 'string' && record.artist.trim()
      ? record.artist.trim()
      : '';
  const title =
    typeof record.title === 'string' && record.title.trim()
      ? record.title.trim()
      : '';
  const coverUrl =
    typeof record.coverUrl === 'string' && record.coverUrl.trim()
      ? record.coverUrl.trim()
      : '';
  const audioUrl =
    typeof record.audioUrl === 'string' && record.audioUrl.trim()
      ? record.audioUrl.trim()
      : '';
  const durationMs =
    typeof record.durationMs === 'number' &&
    Number.isFinite(record.durationMs) &&
    record.durationMs > 0
      ? Math.round(record.durationMs)
      : undefined;

  return {
    id: typeof record.id === 'string' && record.id ? record.id : createId('song'),
    kind: 'preset',
    songId:
      typeof record.songId === 'number' && Number.isInteger(record.songId) && record.songId > 0
        ? record.songId
        : undefined,
    highRotation: record.highRotation === true,
    artist,
    title,
    coverUrl,
    audioUrl: audioUrl || undefined,
    durationMs,
    earoneSongId:
      typeof record.earoneSongId === 'string' && record.earoneSongId.trim()
        ? record.earoneSongId.trim()
        : typeof record.earoneSongId === 'number' && Number.isFinite(record.earoneSongId)
          ? String(record.earoneSongId)
          : undefined,
    earoneRank:
      typeof record.earoneRank === 'string' && record.earoneRank.trim()
        ? record.earoneRank.trim()
        : undefined,
    earoneSpins:
      typeof record.earoneSpins === 'string' && record.earoneSpins.trim()
        ? record.earoneSpins.trim()
        : typeof record.earoneSpins === 'number' && Number.isFinite(record.earoneSpins)
          ? String(record.earoneSpins)
          : undefined
  };
}

function withNormalizedSequenceShape<TItem extends BaseSequenceItem>(
  record: RecordValue,
  items: TItem[],
  defaultMode: ProgramSequenceMode = 'manual'
): BaseSequence<TItem> {
  const activeItemId =
    record.activeItemId === null
      ? null
      : typeof record.activeItemId === 'string' && items.some((item) => item.id === record.activeItemId)
      ? record.activeItemId
      : items[0]?.id ?? null;

  return {
    mode: record.mode === undefined ? defaultMode : normalizeMode(record.mode),
    items,
    activeItemId,
    intervalMs:
      typeof record.intervalMs === 'number' && Number.isFinite(record.intervalMs) && record.intervalMs >= 500
        ? Math.floor(record.intervalMs)
        : 4000,
    loop: record.loop === undefined ? true : Boolean(record.loop),
    startedAt:
      typeof record.startedAt === 'number' && Number.isFinite(record.startedAt)
        ? record.startedAt
        : Date.now()
  };
}

function normalizeTextSequenceItem(
  value: unknown,
  depth: number,
  options?: { includeMarquee?: boolean }
): ProgramTextSequenceItem | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (record.kind === 'sequence') {
    const normalizedSequence = normalizeProgramTextSequence(record.sequence, depth + 1, options);
    if (!normalizedSequence) {
      return null;
    }

    return {
      id: typeof record.id === 'string' && record.id ? record.id : createId('sequence'),
      label: typeof record.label === 'string' && record.label.trim() ? record.label : 'Nested Sequence',
      kind: 'sequence',
      sequence: normalizedSequence
    };
  }

  return normalizeTextLeafItem(record, options);
}

function normalizeSongSequenceItem(
  value: unknown,
  depth: number
): ProgramSongSequenceItem | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (record.kind === 'sequence') {
    const normalizedSequence = normalizeProgramSongSequence(record.sequence, depth + 1);
    if (!normalizedSequence) {
      return null;
    }

    return {
      id: typeof record.id === 'string' && record.id ? record.id : createId('sequence'),
      label: typeof record.label === 'string' && record.label.trim() ? record.label : 'Nested Sequence',
      kind: 'sequence',
      sequence: normalizedSequence
    };
  }

  return normalizeSongLeafItem(record);
}

function getBaseIndex<TItem extends BaseSequenceItem>(
  sequence: BaseSequence<TItem>
): number | null {
  if (sequence.activeItemId === null) {
    return null;
  }

  // A normalized sequence's active id is null or one of its items.
  return sequence.items.findIndex((item) => item.id === sequence.activeItemId);
}

function getSelectedItem<TItem extends BaseSequenceItem>(
  sequence: BaseSequence<TItem>,
  nowMs: number
): TItem | null {
  if (sequence.items.length === 0) {
    return null;
  }

  const baseIndex = getBaseIndex(sequence);
  if (baseIndex === null) {
    return null;
  }

  if (sequence.mode === 'manual') {
    return sequence.items[baseIndex];
  }

  const elapsedSteps = Math.max(0, Math.floor((nowMs - sequence.startedAt) / sequence.intervalMs));
  let nextIndex = baseIndex + elapsedSteps;

  if (sequence.loop !== false) {
    nextIndex %= sequence.items.length;
  } else if (nextIndex >= sequence.items.length) {
    nextIndex = sequence.items.length - 1;
  }

  return sequence.items[nextIndex];
}

function getSongItemPlaybackDurationMs(
  item: ProgramSongSequenceItem
): number | null {
  if (
    item.kind === 'preset' &&
    typeof item.durationMs === 'number' &&
    Number.isFinite(item.durationMs) &&
    item.durationMs > 0
  ) {
    return Math.max(1, Math.round(item.durationMs));
  }

  return null;
}

// Autoplay walks the items from the active one by their durations. A looping
// sequence whose durations are all known repeats as a cycle; otherwise the walk
// stops at the first item without a duration, and a non-looping sequence stays
// on its last item.
function getSelectedSongItem(
  sequence: ProgramSongSequence,
  nowMs: number
): ProgramSongSequenceItem | null {
  if (sequence.items.length === 0) {
    return null;
  }

  const baseIndex = getBaseIndex(sequence);
  if (baseIndex === null) {
    return null;
  }

  if (sequence.mode === 'manual') {
    return sequence.items[baseIndex];
  }

  const elapsedMs = Math.max(0, nowMs - sequence.startedAt);
  const itemDurations = sequence.items.map((item) => getSongItemPlaybackDurationMs(item));
  const looping = sequence.loop !== false;
  const knownDurations = itemDurations.filter((durationMs): durationMs is number => durationMs !== null);
  const cycleDurationMs = knownDurations.reduce((sum, durationMs) => sum + durationMs, 0);
  let remainingMs =
    looping && knownDurations.length === itemDurations.length ? elapsedMs % cycleDurationMs : elapsedMs;
  const steps = looping ? sequence.items.length : sequence.items.length - baseIndex;

  let index = baseIndex;
  for (let step = 1; step < steps; step += 1) {
    const itemDurationMs = itemDurations[index];
    if (itemDurationMs === null || remainingMs < itemDurationMs) {
      break;
    }
    remainingMs -= itemDurationMs;
    index = (index + 1) % sequence.items.length;
  }

  return sequence.items[index];
}

function resolveTextSequenceRecursive(
  sequence: ProgramTextSequence,
  nowMs: number,
  depth: number,
  labels: string[]
): ProgramResolvedTextLeaf | null {
  // Normalization already bounds nesting at MAX_DEPTH.
  const selected = getSelectedItem(sequence, nowMs);
  if (!selected) {
    return null;
  }

  if (selected.kind === 'sequence') {
    const nextLabels = [...labels, selected.label];
    return resolveTextSequenceRecursive(selected.sequence, nowMs, depth + 1, nextLabels);
  }

  return {
    text: selected.text,
    useMarquee: Boolean(selected.useMarquee),
    activePathLabels: [...labels, selected.text]
  };
}

function resolveSongSequenceRecursive(
  sequence: ProgramSongSequence,
  nowMs: number,
  depth: number,
  labels: string[]
): ProgramResolvedSongLeaf | null {
  const selected = getSelectedSongItem(sequence, nowMs);
  if (!selected) {
    return null;
  }

  if (selected.kind === 'sequence') {
    const nextLabels = [...labels, selected.label];
    return resolveSongSequenceRecursive(selected.sequence, nowMs, depth + 1, nextLabels);
  }

  const songLabel = [selected.artist, selected.title].filter(Boolean).join(' - ');
  return {
    id: selected.id,
    songId: selected.songId,
    highRotation: selected.highRotation === true,
    artist: selected.artist,
    title: selected.title,
    coverUrl: selected.coverUrl,
    audioUrl: selected.audioUrl,
    durationMs: selected.durationMs,
    earoneSongId: selected.earoneSongId,
    earoneRank: selected.earoneRank,
    earoneSpins: selected.earoneSpins,
    activePathLabels: [...labels, songLabel || 'Song Preset']
  };
}

export function normalizeProgramTextSequence(
  value: unknown,
  depth = 0,
  options?: { includeMarquee?: boolean }
): ProgramTextSequence | null {
  if (depth > MAX_DEPTH) {
    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .map((item) => normalizeTextSequenceItem(item, depth, options))
    .filter((item): item is ProgramTextSequenceItem => item !== null);

  return withNormalizedSequenceShape(record, items);
}

export function normalizeProgramSongSequence(
  value: unknown,
  depth = 0
): ProgramSongSequence | null {
  if (depth > MAX_DEPTH) {
    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .map((item) => normalizeSongSequenceItem(item, depth))
    .filter((item): item is ProgramSongSequenceItem => item !== null);

  return withNormalizedSequenceShape(record, items, 'autoplay');
}

export function resolveProgramTextLeaf(
  config: {
    contentMode?: unknown;
    sequence?: unknown;
  },
  nowMs = Date.now(),
  options?: { includeMarquee?: boolean }
): ProgramResolvedTextLeaf | null {
  const normalizedSequence = normalizeProgramTextSequence(config.sequence, 0, options);
  const contentMode = normalizeTextContentMode(config.contentMode, normalizedSequence);

  if (contentMode !== 'sequence' || !normalizedSequence) {
    return null;
  }

  return resolveTextSequenceRecursive(normalizedSequence, nowMs, 0, []);
}

export function resolveProgramSongLeaf(
  config: {
    contentMode?: unknown;
    sequence?: unknown;
  },
  nowMs = Date.now()
): ProgramResolvedSongLeaf | null {
  // Songs only have a sequence content mode.
  const normalizedSequence = normalizeProgramSongSequence(config.sequence);
  if (!normalizedSequence) {
    return null;
  }

  return resolveSongSequenceRecursive(normalizedSequence, nowMs, 0, []);
}
