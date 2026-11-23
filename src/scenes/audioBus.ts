/**
 * The song source a scene reads for the on-air block. Alcántara's program audio bus implements
 * it; the library only needs the current track and how far along it is.
 */
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

export interface ProgramAudioBusSource {
  getSnapshot(programId: string): ProgramAudioBusSnapshot;
  subscribe(programId: string, listener: (snapshot: ProgramAudioBusSnapshot) => void): () => void;
}

export const EMPTY_AUDIO_BUS_SNAPSHOT: ProgramAudioBusSnapshot = {
  track: null,
  progress: 0,
  currentTimeMs: 0,
  durationMs: null,
  endedToken: '',
  isPlaying: false
};
