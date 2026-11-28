// The TV graphics read program sequences through the shared scenes module, so a stored song or text sequence resolves
// on TV exactly as it does in the program window (modoitaliano/giorgia#84).
export {
  normalizeProgramSongSequence,
  normalizeProgramTextSequence,
  resolveProgramSongLeaf,
  resolveProgramTextLeaf,
  type ProgramResolvedSongLeaf,
  type ProgramResolvedTextLeaf,
  type ProgramSongSequence,
  type ProgramSongSequenceItem,
  type ProgramTextSequence,
  type ProgramTextSequenceItem,
} from '../../../scenes/programSequence.js';
