import type { Terminal } from '@xterm/xterm';
import { VirtualFS } from '../fs/filesystem';
import { createDefaultFS } from '../fs/defaultFs';
import { CommandHistory } from './history';
import { registry, type CommandContext } from './commandRegistry';
import { executePlan, type CommandExecutor } from './planExecutor';
import { createDefaultNashPlanner } from './melangeNashPlanner';
import { getCompletions, longestCommonPrefix } from './tabCompletion';
import { eraseToEndOfLine, cursorBack, cursorForward, bold, fg, reset, dim } from './ansi';
import type { NanoEditor } from '../editor/nanoEditor';
import type { ResolvedNanoTermConfig } from '../config';
import { applyFSOverlay } from '../fs/overlay';
import type { NashAssignment, NashSimpleCommand, RedirectSpec } from './nashPlan';
import '../commands/index';

export class Shell implements CommandExecutor {
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
  private config: ResolvedNanoTermConfig;
  private planner = createDefaultNashPlanner();

  constructor(terminal: Terminal, config: ResolvedNanoTermConfig) {
    this.terminal = terminal;
    this.config = config;
    this.cols = terminal.cols;
    this.rows = terminal.rows;
    this.fs = new VirtualFS(createDefaultFS());
    applyFSOverlay(this.fs, this.config.fs.overlay);
    this.history = new CommandHistory();
    this.env = new Map(Object.entries(this.config.profile.env));
  }

  start(): void {
    if (!this.config.profile.showBanner) {
      this.printPrompt();
      return;
    }

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
        this.runInputLine(this.lineBuffer);
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

  private async runInputLine(line: string): Promise<void> {
    const input = line.trim();
    if (!input) {
      this.printPrompt();
      return;
    }

    const planned = this.planner.parse(input);
    if (!planned.ok) {
      this.terminal.writeln(`syntax error: ${planned.error}`);
      this.printPrompt();
      return;
    }

    if (planned.plan.steps.length === 0) {
      this.printPrompt();
      return;
    }

    this.history.push(input);

    await executePlan(planned.plan, this);

    this.env.set('PWD', this.fs.cwd);
    this.printPrompt();
  }

  async executeCommand(command: NashSimpleCommand): Promise<number> {
    const expandedArgv = this.expandTemplates(command.argvTemplates);
    if (!expandedArgv.ok) {
      this.terminal.writeln(`expansion error: ${expandedArgv.error}`);
      return 1;
    }

    if (expandedArgv.values.length === 0) {
      return 0;
    }

    const commandName = expandedArgv.values[0];
    const args = expandedArgv.values.slice(1);
    const def = registry.get(commandName);
    if (!def) {
      this.terminal.writeln(`${commandName}: command not found`);
      return 127;
    }

    const redirectResolution = this.getLastStdoutRedirect(command.redirects);
    if (!redirectResolution.ok) {
      this.terminal.writeln(`${commandName}: ${redirectResolution.error}`);
      return 1;
    }
    const stdoutRedirect = redirectResolution.redirect;

    let capturedOutput = '';
    const ctx: CommandContext = {
      terminal: this.terminal,
      fs: this.fs,
      args,
      rawArgs: args.join(' '),
      env: this.env,
      history: this.history.getEntries(),
      writeStdout: (text: string) => {
        if (stdoutRedirect) {
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

      if (stdoutRedirect) {
        const path = this.fs.resolvePath(stdoutRedirect.target);
        const nextContent = stdoutRedirect.mode === 'append'
          ? (this.fs.readFile(path) || '') + capturedOutput
          : capturedOutput;
        const writeResult = this.fs.writeFile(path, nextContent);
        if (!writeResult.ok) {
          this.terminal.writeln(`${commandName}: ${writeResult.error}`);
          return 1;
        }
      }

      return result.exitCode;
    } catch (err: any) {
      this.terminal.writeln(`${commandName}: ${err.message || 'unknown error'}`);
      return 1;
    }
  }

  applyAssignment(assignment: NashAssignment): number {
    const expanded = this.expandTemplate(assignment.valueTemplate);
    if (!expanded.ok) {
      this.terminal.writeln(`assignment error: ${expanded.error}`);
      return 1;
    }

    this.env.set(assignment.name, expanded.value);
    return 0;
  }

  private getLastStdoutRedirect(
    redirects: RedirectSpec[],
  ): { ok: true; redirect: { mode: 'truncate' | 'append'; target: string } | null } | { ok: false; error: string } {
    for (let index = redirects.length - 1; index >= 0; index -= 1) {
      if (redirects[index].fd === 'stdout') {
        const expanded = this.expandTemplate(redirects[index].targetTemplate);
        if (!expanded.ok) {
          return { ok: false, error: expanded.error };
        }
        return {
          ok: true,
          redirect: {
            mode: redirects[index].mode,
            target: expanded.value,
          },
        };
      }
    }
    return { ok: true, redirect: null };
  }

  private expandTemplate(template: string): { ok: true; value: string } | { ok: false; error: string } {
    const matches = template.match(/\$(\w+)/g) || [];
    for (const rawMatch of matches) {
      const name = rawMatch.slice(1);
      if (!this.env.has(name)) {
        return { ok: false, error: `undefined variable: ${name}` };
      }
    }

    const value = template.replace(/\$(\w+)/g, (_match, name) => this.env.get(name) || '');
    return { ok: true, value };
  }

  private expandTemplates(templates: string[]): { ok: true; values: string[] } | { ok: false; error: string } {
    const values: string[] = [];
    for (const template of templates) {
      const expanded = this.expandTemplate(template);
      if (!expanded.ok) {
        return expanded;
      }
      values.push(expanded.value);
    }
    return { ok: true, values };
  }

  handleResize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    if (this.activeEditor) {
      this.activeEditor.handleResize(cols, rows);
    }
  }
}
