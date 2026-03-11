import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import xtermCss from '@xterm/xterm/css/xterm.css?inline';
import './commands/index';
import { Shell } from './core/shell';
import { resolveNanoTermConfig } from './config';
import type { NanoTermConfig } from './config';

export { registry } from './core/commandRegistry';
export type { CommandDefinition, CommandContext, CommandResult, CommandHandler } from './core/commandRegistry';
export { defineNanoTermConfig } from './config';
export type { NanoTermConfig, NanoTermProfileConfig, NanoTermFsConfig, NanoTermTerminalConfig, ResolvedNanoTermConfig } from './config';
export type { FSOverlay } from './fs/overlay';
export { applyFSOverlay, forEachOverlayFile, parseOverlayJson, emptyOverlay } from './fs/overlay';

export interface NanoTermInstance {
  terminal: Terminal;
  shell: Shell;
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
    dispose() {
      window.removeEventListener('resize', onResize);
      terminal.dispose();
    },
    fit() {
      fitAddon.fit();
    },
  };
}
