import { defineNanoTermConfig } from './lib/config';
import { parseOverlayJson, parseOverlayParam } from './lib/fs/overlay';
import generatedOverlayRaw from './generated/fs-overlay.json?raw';

const runtimeOverlayParam = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('overlay')
  : null;

export default defineNanoTermConfig({
  profile: {
    startupCommands: ['motd'],
  },
  fs: {
    backend: 'memory',
    localStorageKey: 'nanoterm:v1',
    overlay: runtimeOverlayParam
      ? parseOverlayParam(runtimeOverlayParam)
      : parseOverlayJson(generatedOverlayRaw),
  },
});
