// The legacy ModoItaliano scene renderers (gaulatti/alcantara#382, #391), moved out of Alcántara's
// frontend. They keep the props the stored program scenes carry; the host supplies runtime state
// (the audio bus, the song catalog) as props instead of importing app modules.
export { ModoItalianoChyron } from './ModoItalianoChyron.js';
export type { ModoItalianoChyronProps } from './ModoItalianoChyron.js';
export { ModoItalianoClock } from './ModoItalianoClock.js';
export type { ModoItalianoClockProps } from './ModoItalianoClock.js';
export { ModoItalianoBracket } from './ModoItalianoBracket.js';
export type { ModoItalianoBracketProps, SongCatalogItem } from './ModoItalianoBracket.js';
export { ModoItalianoPodcastPlayer } from './ModoItalianoPodcastPlayer.js';
export type { ModoItalianoPodcastPlayerProps } from './ModoItalianoPodcastPlayer.js';
