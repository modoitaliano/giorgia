import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root.js";

registerRoot(RemotionRoot);

export { getDurationInFrames, ShortVideo } from "./ShortVideo.js";
export {
  ARTIST_BUMPER_DURATION_IN_FRAMES,
  ARTIST_BUMPER_FPS,
  ARTIST_BUMPER_HEIGHT,
  ARTIST_BUMPER_TIMELINE,
  ARTIST_BUMPER_WIDTH,
  ArtistBumper,
  ArtistBumperFrame,
  getArtistBumperImageIndex,
  getArtistBumperSegment,
  getHandoffAtmosphere,
  robArtistBumperProps,
  validateArtistBumperImages,
} from "./ArtistBumper.js";
export type {
  ArticleSlide,
  ArtistBumperImages,
  ArtistBumperProps,
  HookSlide,
  OutroSlide,
  ShortVideoBrand,
  ShortVideoProps,
  ShortVideoSlide,
} from "./types.js";
