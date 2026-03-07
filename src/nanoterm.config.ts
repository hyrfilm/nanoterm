import { defineNanoTermConfig } from './lib/config';
import { parseOverlayJson } from './lib/fs/overlay';
import generatedOverlayRaw from './generated/fs-overlay.json?raw';

const replayParam = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('replay')
  : null;

export default defineNanoTermConfig({
  profile: {
    startupCommands: ['motd', ...(replayParam ? [`replay ${replayParam}`] : [])],
  },
  fs: {
    backend: 'memory',
    localStorageKey: 'nanoterm:v1',
    overlay: parseOverlayJson(generatedOverlayRaw),
  },
});
