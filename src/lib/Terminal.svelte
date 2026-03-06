<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { WebLinksAddon } from '@xterm/addon-web-links';
  import '@xterm/xterm/css/xterm.css';
  import { Shell } from './core/shell';

  let containerEl: HTMLDivElement;

  onMount(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', 'Monaco', 'Courier New', monospace",
      lineHeight: 1.2,
      scrollback: 5000,
      convertEol: true,
      theme: {
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
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerEl);
    fitAddon.fit();

    const shell = new Shell(terminal);
    shell.start();

    terminal.onData((data) => shell.handleInput(data));

    terminal.onResize(({ cols, rows }) => {
      shell.handleResize(cols, rows);
    });

    const onResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', onResize);

    // Focus terminal
    terminal.focus();

    return () => {
      window.removeEventListener('resize', onResize);
      terminal.dispose();
    };
  });
</script>

<div bind:this={containerEl} class="terminal-container"></div>

<style>
  .terminal-container {
    width: 100%;
    height: 100%;
  }
  .terminal-container :global(.xterm) {
    height: 100%;
    padding: 4px;
  }
</style>
