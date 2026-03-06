import type { Terminal } from '@xterm/xterm';
import type { VirtualFS } from '../fs/filesystem';
import type { CommandResult } from '../core/commandRegistry';
import { altScreenEnable, altScreenDisable } from '../core/ansi';
import { EditorRenderer, type EditorRenderState } from './editorRenderer';

type PromptMode = 'none' | 'save-as' | 'search' | 'exit-confirm' | 'goto-line';

export class NanoEditor {
  private terminal: Terminal;
  private fs: VirtualFS;
  private filename: string;
  private filePath: string;

  private lines: string[] = [''];
  private dirty = false;

  private cursorRow = 0;
  private cursorCol = 0;
  private scrollOffset = 0;

  private cols: number;
  private rows: number;

  private readonly headerRows = 1;
  private readonly footerRows = 3;
  private get contentRows(): number { return Math.max(1, this.rows - this.headerRows - this.footerRows); }

  private cutBuffer: string[] = [];
  private statusMessage = '';
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;

  private promptMode: PromptMode = 'none';
  private promptLabel = '';
  private promptBuffer = '';

  private resolveRun!: (result: CommandResult) => void;
  private renderer: EditorRenderer;

  constructor(terminal: Terminal, fs: VirtualFS, filename: string) {
    this.terminal = terminal;
    this.fs = fs;
    this.filename = filename;
    this.filePath = filename ? fs.resolvePath(filename) : '';
    this.cols = terminal.cols;
    this.rows = terminal.rows;
    this.renderer = new EditorRenderer(terminal);

    if (filename) {
      const content = fs.readFile(this.filePath);
      if (content !== null) {
        this.lines = content.split('\n');
        if (this.lines.length === 0) this.lines = [''];
      }
    }
  }

  run(): Promise<CommandResult> {
    return new Promise((resolve) => {
      this.resolveRun = resolve;
      this.terminal.write(altScreenEnable);
      this.render();
    });
  }

  handleInput(data: string): void {
    if (this.promptMode !== 'none') {
      this.handlePromptInput(data);
      return;
    }

    for (let i = 0; i < data.length; i++) {
      const ch = data[i];

      // Escape sequences
      if (ch === '\x1b' && i + 1 < data.length) {
        if (data[i + 1] === '[') {
          const remaining = data.substring(i + 2);
          const match = remaining.match(/^(\d*)(~|[A-Za-z])/);
          if (match) {
            i += 1 + match[0].length;
            this.handleEscapeSequence(match[0]);
            continue;
          }
        } else if (data[i + 1] === 'O') {
          if (i + 2 < data.length) {
            const key = data[i + 2];
            i += 2;
            if (key === 'H') { this.moveCursorHome(); continue; }
            if (key === 'F') { this.moveCursorEnd(); continue; }
          }
        }
        continue;
      }

      // Ctrl keys
      if (ch === '\x18') { this.exit(); return; }           // Ctrl+X
      if (ch === '\x0f') { this.save(); continue; }         // Ctrl+O
      if (ch === '\x0b') { this.cutLine(); continue; }      // Ctrl+K
      if (ch === '\x15') { this.pasteLine(); continue; }    // Ctrl+U
      if (ch === '\x17') { this.whereIs(); continue; }      // Ctrl+W
      if (ch === '\x03') { this.showCursorPos(); continue; } // Ctrl+C
      if (ch === '\x07') { continue; }                       // Ctrl+G (help - no-op for now)
      if (ch === '\x1f') { this.goToLine(); continue; }      // Ctrl+_

      if (ch === '\r') { this.insertNewline(); continue; }
      if (ch === '\x7f') { this.backspace(); continue; }
      if (ch === '\t') { this.insertText('    '); continue; }

      if (ch.charCodeAt(0) >= 0x20) {
        this.insertText(ch);
      }
    }
  }

  handleResize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.ensureCursorVisible();
    this.render();
  }

  private handleEscapeSequence(seq: string): void {
    switch (seq) {
      case 'A': this.moveCursorUp(); break;
      case 'B': this.moveCursorDown(); break;
      case 'C': this.moveCursorRight(); break;
      case 'D': this.moveCursorLeft(); break;
      case 'H': this.moveCursorHome(); break;
      case 'F': this.moveCursorEnd(); break;
      case '3~': this.deleteForward(); break;
      case '5~': this.pageUp(); break;
      case '6~': this.pageDown(); break;
    }
  }

  // --- Prompt mode handling ---

  private handlePromptInput(data: string): void {
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];

      if (ch === '\x03') { // Ctrl+C - cancel
        this.promptMode = 'none';
        this.statusMessage = '';
        this.render();
        return;
      }

      if (ch === '\r') { // Enter - confirm
        this.confirmPrompt();
        return;
      }

      if (ch === '\x7f') { // Backspace
        if (this.promptBuffer.length > 0) {
          this.promptBuffer = this.promptBuffer.slice(0, -1);
          this.render();
        }
        continue;
      }

      if (this.promptMode === 'exit-confirm') {
        const lower = ch.toLowerCase();
        if (lower === 'y') {
          this.save();
          if (!this.filename) return; // save() will enter save-as mode
          this.cleanup();
          return;
        } else if (lower === 'n') {
          this.cleanup();
          return;
        }
        continue;
      }

      if (ch.charCodeAt(0) >= 0x20) {
        this.promptBuffer += ch;
        this.render();
      }
    }
  }

  private confirmPrompt(): void {
    const value = this.promptBuffer;
    const mode = this.promptMode;
    this.promptMode = 'none';
    this.promptBuffer = '';
    this.promptLabel = '';

    if (mode === 'save-as') {
      if (!value) {
        this.setStatus('Cancelled');
        this.render();
        return;
      }
      this.filename = value;
      this.filePath = this.fs.resolvePath(value);
      this.doSave();
    } else if (mode === 'search') {
      if (!value) {
        this.render();
        return;
      }
      this.executeSearch(value);
    } else if (mode === 'goto-line') {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        this.setStatus('Invalid line number');
        this.render();
        return;
      }
      this.cursorRow = Math.min(num - 1, this.lines.length - 1);
      this.cursorCol = 0;
      this.ensureCursorVisible();
      this.render();
    } else {
      this.render();
    }
  }

  // --- Text editing ---

  private insertText(text: string): void {
    for (const ch of text) {
      if (ch === '\n' || ch === '\r') {
        this.insertNewline();
      } else {
        const line = this.lines[this.cursorRow];
        this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + ch + line.slice(this.cursorCol);
        this.cursorCol++;
        this.dirty = true;
      }
    }
    this.render();
  }

  private insertNewline(): void {
    const line = this.lines[this.cursorRow];
    this.lines[this.cursorRow] = line.slice(0, this.cursorCol);
    this.lines.splice(this.cursorRow + 1, 0, line.slice(this.cursorCol));
    this.cursorRow++;
    this.cursorCol = 0;
    this.dirty = true;
    this.ensureCursorVisible();
    this.render();
  }

  private backspace(): void {
    if (this.cursorCol > 0) {
      const line = this.lines[this.cursorRow];
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
      this.cursorCol--;
      this.dirty = true;
    } else if (this.cursorRow > 0) {
      this.cursorCol = this.lines[this.cursorRow - 1].length;
      this.lines[this.cursorRow - 1] += this.lines[this.cursorRow];
      this.lines.splice(this.cursorRow, 1);
      this.cursorRow--;
      this.dirty = true;
    }
    this.ensureCursorVisible();
    this.render();
  }

  private deleteForward(): void {
    const line = this.lines[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
      this.dirty = true;
    } else if (this.cursorRow < this.lines.length - 1) {
      this.lines[this.cursorRow] += this.lines[this.cursorRow + 1];
      this.lines.splice(this.cursorRow + 1, 1);
      this.dirty = true;
    }
    this.render();
  }

  // --- Cursor movement ---

  private moveCursorUp(): void {
    if (this.cursorRow > 0) {
      this.cursorRow--;
      this.clampCursorCol();
      this.ensureCursorVisible();
      this.render();
    }
  }

  private moveCursorDown(): void {
    if (this.cursorRow < this.lines.length - 1) {
      this.cursorRow++;
      this.clampCursorCol();
      this.ensureCursorVisible();
      this.render();
    }
  }

  private moveCursorLeft(): void {
    if (this.cursorCol > 0) {
      this.cursorCol--;
    } else if (this.cursorRow > 0) {
      this.cursorRow--;
      this.cursorCol = this.lines[this.cursorRow].length;
    }
    this.ensureCursorVisible();
    this.render();
  }

  private moveCursorRight(): void {
    if (this.cursorCol < this.lines[this.cursorRow].length) {
      this.cursorCol++;
    } else if (this.cursorRow < this.lines.length - 1) {
      this.cursorRow++;
      this.cursorCol = 0;
    }
    this.ensureCursorVisible();
    this.render();
  }

  private moveCursorHome(): void {
    this.cursorCol = 0;
    this.render();
  }

  private moveCursorEnd(): void {
    this.cursorCol = this.lines[this.cursorRow].length;
    this.render();
  }

  private pageUp(): void {
    this.cursorRow = Math.max(0, this.cursorRow - this.contentRows);
    this.clampCursorCol();
    this.ensureCursorVisible();
    this.render();
  }

  private pageDown(): void {
    this.cursorRow = Math.min(this.lines.length - 1, this.cursorRow + this.contentRows);
    this.clampCursorCol();
    this.ensureCursorVisible();
    this.render();
  }

  private clampCursorCol(): void {
    this.cursorCol = Math.min(this.cursorCol, this.lines[this.cursorRow].length);
  }

  private ensureCursorVisible(): void {
    if (this.cursorRow < this.scrollOffset) {
      this.scrollOffset = this.cursorRow;
    } else if (this.cursorRow >= this.scrollOffset + this.contentRows) {
      this.scrollOffset = this.cursorRow - this.contentRows + 1;
    }
  }

  // --- Cut/Paste ---

  private cutLine(): void {
    this.cutBuffer.push(this.lines[this.cursorRow]);
    if (this.lines.length > 1) {
      this.lines.splice(this.cursorRow, 1);
      if (this.cursorRow >= this.lines.length) {
        this.cursorRow = this.lines.length - 1;
      }
    } else {
      this.lines[0] = '';
    }
    this.cursorCol = 0;
    this.clampCursorCol();
    this.dirty = true;
    this.ensureCursorVisible();
    this.render();
  }

  private pasteLine(): void {
    if (this.cutBuffer.length === 0) return;
    for (let i = 0; i < this.cutBuffer.length; i++) {
      this.lines.splice(this.cursorRow + i, 0, this.cutBuffer[i]);
    }
    this.cursorRow += this.cutBuffer.length;
    if (this.cursorRow >= this.lines.length) {
      this.cursorRow = this.lines.length - 1;
    }
    this.clampCursorCol();
    this.dirty = true;
    this.ensureCursorVisible();
    this.render();
  }

  // --- Search ---

  private whereIs(): void {
    this.promptMode = 'search';
    this.promptLabel = 'Search: ';
    this.promptBuffer = '';
    this.render();
  }

  private executeSearch(query: string): void {
    // Search forward from current position
    for (let i = this.cursorRow; i < this.lines.length; i++) {
      const startCol = (i === this.cursorRow) ? this.cursorCol + 1 : 0;
      const idx = this.lines[i].indexOf(query, startCol);
      if (idx !== -1) {
        this.cursorRow = i;
        this.cursorCol = idx;
        this.ensureCursorVisible();
        this.statusMessage = '';
        this.render();
        return;
      }
    }
    // Wrap around
    for (let i = 0; i <= this.cursorRow; i++) {
      const endCol = (i === this.cursorRow) ? this.cursorCol : undefined;
      const searchIn = endCol !== undefined ? this.lines[i].substring(0, endCol) : this.lines[i];
      const idx = searchIn.indexOf(query);
      if (idx !== -1) {
        this.cursorRow = i;
        this.cursorCol = idx;
        this.ensureCursorVisible();
        this.setStatus('[ Search Wrapped ]');
        this.render();
        return;
      }
    }
    this.setStatus(`"${query}" not found`);
    this.render();
  }

  // --- Go to line ---

  private goToLine(): void {
    this.promptMode = 'goto-line';
    this.promptLabel = 'Enter line number, column number: ';
    this.promptBuffer = '';
    this.render();
  }

  // --- Cursor position ---

  private showCursorPos(): void {
    const totalChars = this.lines.reduce((acc, l) => acc + l.length + 1, 0) - 1;
    const currentChar = this.lines.slice(0, this.cursorRow).reduce((acc, l) => acc + l.length + 1, 0) + this.cursorCol;
    this.setStatus(`line ${this.cursorRow + 1}/${this.lines.length}, col ${this.cursorCol + 1}/${this.lines[this.cursorRow].length + 1}, char ${currentChar}/${totalChars}`);
    this.render();
  }

  // --- Save ---

  private save(): void {
    if (!this.filename) {
      this.promptMode = 'save-as';
      this.promptLabel = 'File Name to Write: ';
      this.promptBuffer = '';
      this.render();
      return;
    }
    this.doSave();
  }

  private doSave(): void {
    const content = this.lines.join('\n');
    const result = this.fs.writeFile(this.filePath, content);
    if (result.ok) {
      this.dirty = false;
      this.setStatus(`Wrote ${this.lines.length} lines`);
    } else {
      this.setStatus(`Error: ${result.error}`);
    }
    this.render();
  }

  // --- Exit ---

  private exit(): void {
    if (this.dirty) {
      this.promptMode = 'exit-confirm';
      this.promptLabel = 'Save modified buffer? (Y/N/^C) ';
      this.promptBuffer = '';
      this.render();
      return;
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.terminal.write(altScreenDisable);
    this.resolveRun({ exitCode: 0 });
  }

  // --- Status ---

  private setStatus(msg: string): void {
    this.statusMessage = msg;
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => {
      this.statusMessage = '';
      this.render();
    }, 3000);
  }

  // --- Render ---

  private render(): void {
    const state: EditorRenderState = {
      lines: this.lines,
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      scrollOffset: this.scrollOffset,
      cols: this.cols,
      rows: this.rows,
      headerRows: this.headerRows,
      footerRows: this.footerRows,
      contentRows: this.contentRows,
      filename: this.filename,
      dirty: this.dirty,
      statusMessage: this.statusMessage,
      promptMode: this.promptMode,
      promptLabel: this.promptLabel,
      promptBuffer: this.promptBuffer,
    };
    this.renderer.render(state);
  }
}
