import { defineNanoTermConfig } from './lib/config';
import { parseOverlayJson } from './lib/fs/overlay';
import generatedOverlayRaw from './generated/fs-overlay.json?raw';

export default defineNanoTermConfig({
  profile: {
    showBanner: true,
  },
  fs: {
    backend: 'memory',
    localStorageKey: 'nanoterm:v1',
    overlay: parseOverlayJson(generatedOverlayRaw),
  },
});
