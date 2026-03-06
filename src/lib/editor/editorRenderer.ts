import type { Terminal } from '@xterm/xterm';
import { cursorTo, cursorHide, cursorShow, eraseLine, inverse, reset, bold, dim } from '../core/ansi';

export interface EditorRenderState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  scrollOffset: number;
  cols: number;
  rows: number;
  headerRows: number;
  footerRows: number;
  contentRows: number;
  filename: string;
  dirty: boolean;
  statusMessage: string;
  promptMode: 'none' | 'save-as' | 'search' | 'exit-confirm' | 'goto-line';
  promptLabel: string;
  promptBuffer: string;
}

export class EditorRenderer {
  private terminal: Terminal;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  render(state: EditorRenderState): void {
    let buf = cursorHide;

    // Header
    buf += this.renderHeader(state);

    // Content area
    for (let i = 0; i < state.contentRows; i++) {
      const lineIndex = state.scrollOffset + i;
      const screenRow = state.headerRows + 1 + i;
      buf += cursorTo(screenRow, 1) + eraseLine;
      if (lineIndex < state.lines.length) {
        const line = state.lines[lineIndex];
        // Render tabs as spaces and truncate to cols
        const display = line.replace(/\t/g, '    ').substring(0, state.cols);
        buf += display;
      }
    }

    // Status bar
    buf += this.renderStatusBar(state);

    // Shortcut bars
    buf += this.renderShortcuts(state);

    // Position cursor
    const screenCursorRow = state.headerRows + 1 + (state.cursorRow - state.scrollOffset);
    const displayCol = this.getDisplayCol(state.lines[state.cursorRow] || '', state.cursorCol);
    const screenCursorCol = displayCol + 1;

    if (state.promptMode !== 'none') {
      // Cursor in the prompt area
      const promptRow = state.rows - 2;
      const promptCursorCol = state.promptLabel.length + state.promptBuffer.length + 1;
      buf += cursorTo(promptRow, promptCursorCol);
    } else {
      buf += cursorTo(screenCursorRow, screenCursorCol);
    }

    buf += cursorShow;
    this.terminal.write(buf);
  }

  private getDisplayCol(line: string, col: number): number {
    let display = 0;
    for (let i = 0; i < col && i < line.length; i++) {
      if (line[i] === '\t') display += 4;
      else display += 1;
    }
    return display;
  }

  private renderHeader(state: EditorRenderState): string {
    const title = '  GNU nano 7.2';
    const fname = state.filename || 'New Buffer';
    const mod = state.dirty ? '  (Modified)' : '';
    const center = `${fname}${mod}`;
    const padding = Math.max(0, Math.floor((state.cols - title.length - center.length) / 2));
    const header = (title + ' '.repeat(padding) + center).padEnd(state.cols);
    return cursorTo(1, 1) + inverse + header.substring(0, state.cols) + reset;
  }

  private renderStatusBar(state: EditorRenderState): string {
    const row = state.rows - 2;
    let buf = cursorTo(row, 1) + eraseLine;

    if (state.promptMode !== 'none') {
      buf += state.promptLabel + state.promptBuffer;
    } else if (state.statusMessage) {
      // Center the status message
      const padding = Math.max(0, Math.floor((state.cols - state.statusMessage.length) / 2));
      buf += inverse + ' '.repeat(padding) + state.statusMessage + ' '.repeat(Math.max(0, state.cols - padding - state.statusMessage.length)) + reset;
    }

    return buf;
  }

  private renderShortcuts(state: EditorRenderState): string {
    const shortcuts1 = [
      ['^G', 'Help'], ['^O', 'Write Out'], ['^W', 'Where Is'],
      ['^K', 'Cut'], ['^U', 'Paste'], ['^C', 'Location'],
    ];
    const shortcuts2 = [
      ['^X', 'Exit'], ['^R', 'Read File'], ['^\\', 'Replace'],
      ['^T', 'Execute'], ['^_', 'Go To Line'], ['^J', 'Justify'],
    ];

    let buf = '';
    buf += this.renderShortcutRow(state.rows - 1, shortcuts1, state.cols);
    buf += this.renderShortcutRow(state.rows, shortcuts2, state.cols);
    return buf;
  }

  private renderShortcutRow(row: number, shortcuts: string[][], cols: number): string {
    let buf = cursorTo(row, 1) + eraseLine;
    const itemWidth = Math.floor(cols / shortcuts.length);

    for (const [key, label] of shortcuts) {
      const text = ` ${label}`;
      const padded = text.substring(0, itemWidth - key.length).padEnd(itemWidth - key.length);
      buf += inverse + key + reset + padded;
    }
    return buf;
  }
}
