import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import xtermCss from '@xterm/xterm/css/xterm.css?inline';
import './commands/index';
import { Shell } from './core/shell';
import { resolveNanoTermConfig } from './config';
import type { NanoTermConfig } from './config';
import { isDir } from './fs/types';
import type { VirtualFS } from './fs/filesystem';

export { registry } from './core/commandRegistry';
export type { CommandDefinition, CommandContext, CommandResult, CommandHandler } from './core/commandRegistry';
export { defineNanoTermConfig } from './config';
export type { NanoTermConfig, NanoTermProfileConfig, NanoTermFsConfig, NanoTermTerminalConfig, ResolvedNanoTermConfig } from './config';
export type { ShellEvents } from './core/shell';
export type { FSOverlay } from './fs/overlay';
export { applyFSOverlay, createSnapshotOverlay, encodeOverlayForUrl, forEachOverlayFile, parseOverlayJson, parseOverlayParam, emptyOverlay } from './fs/overlay';

export interface FSEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export interface NanoTermFS {
  readFile(path: string): string | null;
  writeFile(path: string, content: string): void;
  readDir(path: string): FSEntry[] | null;
  stat(path: string): FSEntry | null;
}

function makeNanoTermFS(vfs: VirtualFS): NanoTermFS {
  function toEntry(path: string): FSEntry | null {
    const node = vfs.stat(path);
    if (!node) return null;
    const parts = path.split('/').filter(Boolean);
    return { name: parts[parts.length - 1] ?? '/', path, type: isDir(node) ? 'dir' : 'file' };
  }

  return {
    readFile: (path) => vfs.readFile(path),
    writeFile: (path, content) => { vfs.writeFile(path, content); },
    readDir: (path) => {
      const nodes = vfs.readDir(path);
      if (!nodes) return null;
      const resolved = vfs.resolvePath(path);
      return nodes.map((node) => ({
        name: node.name,
        path: resolved === '/' ? `/${node.name}` : `${resolved}/${node.name}`,
        type: isDir(node) ? 'dir' : 'file',
      }));
    },
    stat: (path) => toEntry(vfs.resolvePath(path)),
  };
}

export interface NanoTermInstance {
  terminal: Terminal;
  shell: Shell;
  fs: NanoTermFS;
  dispose(): void;
  fit(): void;
}

let cssInjected = false;

function injectCss(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = xtermCss;
  style.setAttribute('data-nanoterm', '');
  document.head.appendChild(style);
  cssInjected = true;
}

export function createNanoTerm(
  container: HTMLElement,
  config?: NanoTermConfig,
): NanoTermInstance {
  injectCss();

  const resolved = resolveNanoTermConfig(config);

  const terminal = new Terminal({
    cursorBlink: resolved.terminal.cursorBlink,
    cursorStyle: resolved.terminal.cursorStyle,
    fontSize: resolved.terminal.fontSize,
    fontFamily: resolved.terminal.fontFamily,
    lineHeight: resolved.terminal.lineHeight,
    scrollback: resolved.terminal.scrollback,
    convertEol: true,
    theme: resolved.terminal.theme,
  });

  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.open(container);
  fitAddon.fit();

  const shell = new Shell(terminal, resolved);
  shell.start();

  terminal.onData((data) => shell.handleInput(data));
  terminal.onResize(({ cols, rows }) => shell.handleResize(cols, rows));

  const onResize = () => fitAddon.fit();
  window.addEventListener('resize', onResize);

  terminal.focus();

  return {
    terminal,
    shell,
    fs: makeNanoTermFS(shell.fs),
    dispose() {
      window.removeEventListener('resize', onResize);
      terminal.dispose();
    },
    fit() {
      fitAddon.fit();
    },
  };
}
