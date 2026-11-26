import data from './video-library.json';
import type { VideoLibrary } from '../../features/videos';

// video-library.json is written by scripts/sync-videos.mjs; change content/videos/*.json instead of editing it.
// The type annotation makes the build fail if the file ever stops matching what the page expects.
export const library: VideoLibrary = data;
