import { emptyOverlay, type FSOverlay } from '../fs/overlay';

export interface NanoTermProfileConfig {
  startupCommands?: string[];
  env?: Record<string, string>;
}

export interface NanoTermFsConfig {
  backend?: 'memory' | 'localStorage';
  localStorageKey?: string;
  overlay?: FSOverlay | null;
}

export interface NanoTermTerminalConfig {
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  scrollback?: number;
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    cursorAccent?: string;
    selectionBackground?: string;
    selectionForeground?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
  };
}

export interface NanoTermConfig {
  profile?: NanoTermProfileConfig;
  fs?: NanoTermFsConfig;
  terminal?: NanoTermTerminalConfig;
}

export interface ResolvedNanoTermConfig {
  profile: {
    startupCommands: string[];
    env: Record<string, string>;
  };
  fs: {
    backend: 'memory' | 'localStorage';
    localStorageKey: string;
    overlay: FSOverlay;
  };
  terminal: Required<NanoTermTerminalConfig> & { theme: Required<NonNullable<NanoTermTerminalConfig['theme']>> };
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

const defaultTheme: Required<NonNullable<NanoTermTerminalConfig['theme']>> = {
  background: '#1a1b26',
  foreground: '#a9b1d6',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#33467c',
  selectionForeground: '#c0caf5',
  black: '#15161e',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#7dcfff',
  white: '#a9b1d6',
  brightBlack: '#414868',
  brightRed: '#f7768e',
  brightGreen: '#9ece6a',
  brightYellow: '#e0af68',
  brightBlue: '#7aa2f7',
  brightMagenta: '#bb9af7',
  brightCyan: '#7dcfff',
  brightWhite: '#c0caf5',
};

export function defineNanoTermConfig(config: NanoTermConfig): NanoTermConfig {
  return config;
}

export function resolveNanoTermConfig(config: NanoTermConfig = {}): ResolvedNanoTermConfig {
  return {
    profile: {
      startupCommands: config.profile?.startupCommands ?? [],
      env: {
        ...defaultEnv,
        ...(config.profile?.env || {}),
      },
    },
    fs: {
      backend: config.fs?.backend ?? 'memory',
      localStorageKey: config.fs?.localStorageKey ?? 'nanoterm:v1',
      overlay: config.fs?.overlay ?? emptyOverlay,
    },
    terminal: {
      fontSize: config.terminal?.fontSize ?? 14,
      fontFamily: config.terminal?.fontFamily ?? "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Monaco', 'Courier New', monospace",
      lineHeight: config.terminal?.lineHeight ?? 1.2,
      scrollback: config.terminal?.scrollback ?? 5000,
      cursorBlink: config.terminal?.cursorBlink ?? true,
      cursorStyle: config.terminal?.cursorStyle ?? 'block',
      theme: {
        ...defaultTheme,
        ...(config.terminal?.theme || {}),
      },
    },
  };
}
