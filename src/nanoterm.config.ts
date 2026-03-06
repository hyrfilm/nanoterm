import { defineNanoTermConfig } from './lib/config';

export default defineNanoTermConfig({
  profile: {
    showBanner: true,
  },
  fs: {
    backend: 'memory',
    localStorageKey: 'nanoterm:v1',
    useGeneratedOverlay: true,
  },
});

