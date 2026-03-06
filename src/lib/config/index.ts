import generatedOverlayRaw from '../../generated/fs-overlay.json?raw';
import { emptyOverlay, parseOverlayJson, type FSOverlay } from '../fs/overlay';

export interface NanoTermProfileConfig {
  showBanner?: boolean;
  env?: Record<string, string>;
}

export interface NanoTermFsConfig {
  backend?: 'memory' | 'localStorage';
  localStorageKey?: string;
  useGeneratedOverlay?: boolean;
  overlay?: FSOverlay | null;
}

export interface NanoTermConfig {
  profile?: NanoTermProfileConfig;
  fs?: NanoTermFsConfig;
}

export interface ResolvedNanoTermConfig {
  profile: {
    showBanner: boolean;
    env: Record<string, string>;
  };
  fs: {
    backend: 'memory' | 'localStorage';
    localStorageKey: string;
    overlay: FSOverlay;
  };
}

const defaultEnv: Record<string, string> = {
  USER: 'guest',
  HOME: '/home/guest',
  SHELL: '/bin/bash',
  PATH: '/usr/bin:/bin',
  PWD: '/home/guest',
  TERM: 'xterm-256color',
  HOSTNAME: 'nanoterm',
  LANG: 'en_US.UTF-8',
};

const generatedOverlay = parseOverlayJson(generatedOverlayRaw);

export function defineNanoTermConfig(config: NanoTermConfig): NanoTermConfig {
  return config;
}

export function resolveNanoTermConfig(config: NanoTermConfig = {}): ResolvedNanoTermConfig {
  const useGeneratedOverlay = config.fs?.useGeneratedOverlay ?? true;

  return {
    profile: {
      showBanner: config.profile?.showBanner ?? true,
      env: {
        ...defaultEnv,
        ...(config.profile?.env || {}),
      },
    },
    fs: {
      backend: config.fs?.backend ?? 'memory',
      localStorageKey: config.fs?.localStorageKey ?? 'nanoterm:v1',
      overlay: config.fs?.overlay ?? (useGeneratedOverlay ? generatedOverlay : emptyOverlay),
    },
  };
}

