import type { Terminal } from '@xterm/xterm';
import { VirtualFS } from '../fs/filesystem';
import { createDefaultFS } from '../fs/defaultFs';
import { CommandHistory } from './history';
import { registry, type CommandContext } from './commandRegistry';
import { getCompletions, longestCommonPrefix } from './tabCompletion';
import { eraseToEndOfLine, cursorBack, cursorForward, bold, fg, reset, dim } from './ansi';
import type { NanoEditor } from '../editor/nanoEditor';
import '../commands/index';

export class Shell {
  private terminal: Terminal;
  fs: VirtualFS;
  private history: CommandHistory;
  env: Map<string, string>;

  private lineBuffer = '';
  private cursorPos = 0;
  private promptLength = 0;

  activeEditor: NanoEditor | null = null;
  private cols: number;
  private rows: number;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.cols = terminal.cols;
    this.rows = terminal.rows;
    this.fs = new VirtualFS(createDefaultFS());
    this.history = new CommandHistory();
    this.env = new Map([
      ['USER', 'guest'],
      ['HOME', '/home/guest'],
      ['SHELL', '/bin/bash'],
      ['PATH', '/usr/bin:/bin'],
      ['PWD', '/home/guest'],
      ['TERM', 'xterm-256color'],
      ['HOSTNAME', 'nanoterm'],
      ['LANG', 'en_US.UTF-8'],
    ]);
  }

  start(): void {
    const banner = `${bold}${fg.cyan}
  _   _                   _
 | \\ | | __ _ _ __   ___ | |_ ___ _ __ _ __ ___
 |  \\| |/ _\` | '_ \\ / _ \\| __/ _ \\ '__| '\_ \` _ \\
 | |\\  | (_| | | | | (_) | ||  __/ |  | | | | | |
 |_| \\_|\\__,_|_| |_|\\___/ \\__\\___|_|  |_| |_| |_|
${reset}
 ${dim}A browser-based terminal emulator${reset}
 ${dim}Type '${reset}help${dim}' for available commands.${reset}

`;
    this.terminal.write(banner);
    this.printPrompt();
  }

  handleInput(data: string): void {
    if (this.activeEditor) {
      this.activeEditor.handleInput(data);
      return;
    }

    for (let i = 0; i < data.length; i++) {
      const ch = data[i];

      // Check for escape sequences
      if (ch === '\x1b' && i + 1 < data.length && data[i + 1] === '[') {
        const remaining = data.substring(i + 2);
        const match = remaining.match(/^(\d*)(~|[A-Za-z])/);
        if (match) {
          const seq = match[0];
          i += 1 + seq.length; // skip '[' + sequence
          this.handleEscapeSequence(seq);
          continue;
        }
        // Also handle \x1bO sequences (SS3)
      } else if (ch === '\x1b' && i + 1 < data.length && data[i + 1] === 'O') {
        if (i + 2 < data.length) {
          const key = data[i + 2];
          i += 2;
          if (key === 'H') { this.moveCursorHome(); continue; }
          if (key === 'F') { this.moveCursorEnd(); continue; }
          continue;
        }
      }

      if (ch === '\r') {
        this.terminal.write('\r\n');
        this.executeCommand(this.lineBuffer);
        continue;
      }
      if (ch === '\x7f') { this.handleBackspace(); continue; }
      if (ch === '\t') { this.handleTab(); continue; }
      if (ch === '\x03') { // Ctrl+C
        this.terminal.write('^C\r\n');
        this.lineBuffer = '';
        this.cursorPos = 0;
        this.history.resetCursor();
        this.printPrompt();
        continue;
      }
      if (ch === '\x0c') { // Ctrl+L
        this.terminal.clear();
        this.printPrompt();
        this.terminal.write(this.lineBuffer);
        const moveBack = this.lineBuffer.length - this.cursorPos;
        if (moveBack > 0) this.terminal.write(cursorBack(moveBack));
        continue;
      }
      if (ch === '\x01') { this.moveCursorHome(); continue; } // Ctrl+A
      if (ch === '\x05') { this.moveCursorEnd(); continue; } // Ctrl+E
      if (ch === '\x15') { // Ctrl+U - clear line before cursor
        const removed = this.cursorPos;
        if (removed > 0) {
          this.lineBuffer = this.lineBuffer.substring(this.cursorPos);
          this.cursorPos = 0;
          this.terminal.write(cursorBack(removed));
          this.terminal.write(eraseToEndOfLine);
          this.terminal.write(this.lineBuffer);
          const moveBack = this.lineBuffer.length;
          if (moveBack > 0) this.terminal.write(cursorBack(moveBack));
        }
        continue;
      }
      if (ch === '\x0b') { // Ctrl+K - clear line after cursor
        this.lineBuffer = this.lineBuffer.substring(0, this.cursorPos);
        this.terminal.write(eraseToEndOfLine);
        continue;
      }
      if (ch === '\x17') { // Ctrl+W - delete word backward
        if (this.cursorPos > 0) {
          let end = this.cursorPos;
          let start = end - 1;
          while (start > 0 && this.lineBuffer[start - 1] === ' ') start--;
          while (start > 0 && this.lineBuffer[start - 1] !== ' ') start--;
          const removed = end - start;
          this.lineBuffer = this.lineBuffer.substring(0, start) + this.lineBuffer.substring(end);
          this.cursorPos = start;
          this.terminal.write(cursorBack(removed));
          this.refreshLineFromCursor();
        }
        continue;
      }

      // Regular printable character
      if (ch.charCodeAt(0) >= 0x20) {
        this.insertChar(ch);
      }
    }
  }

  private handleEscapeSequence(seq: string): void {
    switch (seq) {
      case 'A': this.handleArrowUp(); break;
      case 'B': this.handleArrowDown(); break;
      case 'C': this.handleArrowRight(); break;
      case 'D': this.handleArrowLeft(); break;
      case 'H': this.moveCursorHome(); break;
      case 'F': this.moveCursorEnd(); break;
      case '3~': this.handleDelete(); break;
    }
  }

  private insertChar(ch: string): void {
    this.lineBuffer = this.lineBuffer.substring(0, this.cursorPos) + ch + this.lineBuffer.substring(this.cursorPos);
    this.cursorPos++;
    if (this.cursorPos === this.lineBuffer.length) {
      this.terminal.write(ch);
    } else {
      this.terminal.write(ch);
      this.refreshLineFromCursor();
    }
  }

  private handleBackspace(): void {
    if (this.cursorPos > 0) {
      this.lineBuffer = this.lineBuffer.substring(0, this.cursorPos - 1) + this.lineBuffer.substring(this.cursorPos);
      this.cursorPos--;
      this.terminal.write(cursorBack(1));
      this.refreshLineFromCursor();
    }
  }

  private handleDelete(): void {
    if (this.cursorPos < this.lineBuffer.length) {
      this.lineBuffer = this.lineBuffer.substring(0, this.cursorPos) + this.lineBuffer.substring(this.cursorPos + 1);
      this.refreshLineFromCursor();
    }
  }

  private handleArrowUp(): void {
    const entry = this.history.navigateUp(this.lineBuffer);
    if (entry !== null) this.replaceLine(entry);
  }

  private handleArrowDown(): void {
    const entry = this.history.navigateDown();
    if (entry !== null) this.replaceLine(entry);
  }

  private handleArrowLeft(): void {
    if (this.cursorPos > 0) {
      this.cursorPos--;
      this.terminal.write(cursorBack(1));
    }
  }

  private handleArrowRight(): void {
    if (this.cursorPos < this.lineBuffer.length) {
      this.cursorPos++;
      this.terminal.write(cursorForward(1));
    }
  }

  private moveCursorHome(): void {
    if (this.cursorPos > 0) {
      this.terminal.write(cursorBack(this.cursorPos));
      this.cursorPos = 0;
    }
  }

  private moveCursorEnd(): void {
    if (this.cursorPos < this.lineBuffer.length) {
      this.terminal.write(cursorForward(this.lineBuffer.length - this.cursorPos));
      this.cursorPos = this.lineBuffer.length;
    }
  }

  private replaceLine(newLine: string): void {
    // Move to start of input
    if (this.cursorPos > 0) this.terminal.write(cursorBack(this.cursorPos));
    this.terminal.write(eraseToEndOfLine);
    this.terminal.write(newLine);
    this.lineBuffer = newLine;
    this.cursorPos = newLine.length;
  }

  private refreshLineFromCursor(): void {
    const remaining = this.lineBuffer.substring(this.cursorPos);
    this.terminal.write(eraseToEndOfLine + remaining);
    if (remaining.length > 0) {
      this.terminal.write(cursorBack(remaining.length));
    }
  }

  private handleTab(): void {
    const result = getCompletions(this.lineBuffer, this.cursorPos, this.fs);
    if (result.completions.length === 0) return;

    if (result.completions.length === 1) {
      const completion = result.completions[0];
      const suffix = completion.endsWith('/') ? '' : ' ';
      const newLine = this.lineBuffer.substring(0, result.replaceFrom) + completion + suffix + this.lineBuffer.substring(result.replaceTo);
      const newCursorPos = result.replaceFrom + completion.length + suffix.length;

      // Move back to replace start
      if (this.cursorPos > result.replaceFrom) {
        this.terminal.write(cursorBack(this.cursorPos - result.replaceFrom));
      }
      this.terminal.write(eraseToEndOfLine);
      const afterReplace = newLine.substring(result.replaceFrom);
      this.terminal.write(afterReplace);
      const moveBack = newLine.length - newCursorPos;
      if (moveBack > 0) this.terminal.write(cursorBack(moveBack));

      this.lineBuffer = newLine;
      this.cursorPos = newCursorPos;
    } else {
      const prefix = longestCommonPrefix(result.completions);
      if (prefix.length > (this.lineBuffer.substring(result.replaceFrom, result.replaceTo)).length) {
        const newLine = this.lineBuffer.substring(0, result.replaceFrom) + prefix + this.lineBuffer.substring(result.replaceTo);
        const newCursorPos = result.replaceFrom + prefix.length;

        if (this.cursorPos > result.replaceFrom) {
          this.terminal.write(cursorBack(this.cursorPos - result.replaceFrom));
        }
        this.terminal.write(eraseToEndOfLine);
        this.terminal.write(newLine.substring(result.replaceFrom));
        const moveBack = newLine.length - newCursorPos;
        if (moveBack > 0) this.terminal.write(cursorBack(moveBack));

        this.lineBuffer = newLine;
        this.cursorPos = newCursorPos;
      } else {
        // Show all completions
        this.terminal.write('\r\n');
        this.terminal.write(result.completions.join('  ') + '\r\n');
        this.printPrompt();
        this.terminal.write(this.lineBuffer);
        const moveBack = this.lineBuffer.length - this.cursorPos;
        if (moveBack > 0) this.terminal.write(cursorBack(moveBack));
      }
    }
  }

  printPrompt(): void {
    let displayPath = this.fs.cwd;
    if (displayPath.startsWith(this.fs.home)) {
      displayPath = '~' + displayPath.slice(this.fs.home.length);
    }
    if (displayPath === '') displayPath = '/';

    const prompt = `${bold}${fg.green}${this.fs.username}@nanoterm${reset}:${bold}${fg.blue}${displayPath}${reset}$ `;
    this.terminal.write(prompt);
    this.promptLength = `${this.fs.username}@nanoterm:${displayPath}$ `.length;
    this.lineBuffer = '';
    this.cursorPos = 0;
    this.history.resetCursor();
  }

  private async executeCommand(line: string): Promise<void> {
    const expanded = this.expandVariables(line.trim());
    if (!expanded) {
      this.printPrompt();
      return;
    }

    this.history.push(line.trim());

    // Parse redirects
    let outputFile: string | null = null;
    let appendMode = false;
    let commandPart = expanded;

    const redirectMatch = expanded.match(/^(.+?)\s*(>>|>)\s*(\S+)\s*$/);
    if (redirectMatch) {
      commandPart = redirectMatch[1].trim();
      appendMode = redirectMatch[2] === '>>';
      outputFile = redirectMatch[3];
    }

    const tokens = this.tokenize(commandPart);
    if (tokens.length === 0) {
      this.printPrompt();
      return;
    }

    const commandName = tokens[0];
    const args = tokens.slice(1);

    const def = registry.get(commandName);
    if (!def) {
      this.terminal.writeln(`${commandName}: command not found`);
      this.printPrompt();
      return;
    }

    let capturedOutput = '';
    const ctx: CommandContext = {
      terminal: this.terminal,
      fs: this.fs,
      args,
      rawArgs: commandPart.substring(commandName.length).trim(),
      env: this.env,
      history: this.history.getEntries(),
      writeStdout: (text: string) => {
        if (outputFile) {
          capturedOutput += text;
        } else {
          this.terminal.write(text);
        }
      },
    };
    // Pass shell reference for commands that need it (e.g. nano)
    (ctx as any).__shell__ = this;

    try {
      const result = await def.handler(ctx);

      if (outputFile) {
        const path = this.fs.resolvePath(outputFile);
        if (appendMode) {
          const existing = this.fs.readFile(path) || '';
          this.fs.writeFile(path, existing + capturedOutput);
        } else {
          this.fs.writeFile(path, capturedOutput);
        }
      }

      // Update PWD
      this.env.set('PWD', this.fs.cwd);

      // Don't print prompt if command was nano (it handles its own lifecycle)
      if (commandName !== 'nano' || result.exitCode !== -1) {
        this.printPrompt();
      }
    } catch (err: any) {
      this.terminal.writeln(`${commandName}: ${err.message || 'unknown error'}`);
      this.printPrompt();
    }
  }

  private expandVariables(input: string): string {
    return input.replace(/\$(\w+)/g, (_match, name) => {
      return this.env.get(name) || '';
    });
  }

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (inSingleQuote) {
        if (ch === "'") { inSingleQuote = false; }
        else { current += ch; }
      } else if (inDoubleQuote) {
        if (ch === '"') { inDoubleQuote = false; }
        else if (ch === '\\' && i + 1 < input.length) {
          i++;
          current += input[i];
        } else { current += ch; }
      } else {
        if (ch === "'") { inSingleQuote = true; }
        else if (ch === '"') { inDoubleQuote = true; }
        else if (ch === ' ' || ch === '\t') {
          if (current) { tokens.push(current); current = ''; }
        } else if (ch === '\\' && i + 1 < input.length) {
          i++;
          current += input[i];
        } else {
          current += ch;
        }
      }
    }

    if (current) tokens.push(current);
    return tokens;
  }

  handleResize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    if (this.activeEditor) {
      this.activeEditor.handleResize(cols, rows);
    }
  }
}
