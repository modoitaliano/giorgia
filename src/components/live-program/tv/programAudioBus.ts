export interface ProgramAudioBusTrack {
  token: string;
  audioUrl: string;
  durationMs?: number;
  artist?: string;
  title?: string;
  coverUrl?: string;
  earoneSongId?: string;
  earoneRank?: string;
  earoneSpins?: string;
}

export interface ProgramAudioBusSnapshot {
  track: ProgramAudioBusTrack | null;
  progress: number;
  currentTimeMs: number;
  durationMs: number | null;
  endedToken: string;
  isPlaying: boolean;
}

export type ProgramAudioBusListener = (snapshot: ProgramAudioBusSnapshot) => void;

interface ProgramAudioBusState {
  snapshot: ProgramAudioBusSnapshot;
  listeners: Set<ProgramAudioBusListener>;
}

const buses = new Map<string, ProgramAudioBusState>();

function getBus(programId: string): ProgramAudioBusState {
  let state = buses.get(programId);
  if (!state) {
    state = {
      snapshot: {
        track: null,
        progress: 0,
        currentTimeMs: 0,
        durationMs: null,
        endedToken: '',
        isPlaying: false
      },
      listeners: new Set()
    };
    buses.set(programId, state);
  }
  return state;
}

export function getProgramAudioBusSnapshot(programId: string): ProgramAudioBusSnapshot {
  return getBus(programId).snapshot;
}

export function subscribeProgramAudioBus(
  programId: string,
  listener: ProgramAudioBusListener
): () => void {
  const bus = getBus(programId);
  bus.listeners.add(listener);
  listener(bus.snapshot);
  return () => {
    bus.listeners.delete(listener);
  };
}

export function updateProgramAudioBus(
  programId: string,
  update: Partial<ProgramAudioBusSnapshot>
): void {
  const bus = getBus(programId);
  bus.snapshot = { ...bus.snapshot, ...update };
  bus.listeners.forEach((listener) => listener(bus.snapshot));
}
