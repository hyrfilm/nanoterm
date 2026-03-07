import type { Terminal } from '@xterm/xterm';
import type { VirtualFS } from '../fs/filesystem';

export interface CommandContext {
  terminal: Terminal;
  fs: VirtualFS;
  args: string[];
  env: Map<string, string>;
  history: string[];
  writeStdout: (text: string) => void;
  shell?: {
    activeEditor: {
      handleInput(data: string): void;
      handleResize(cols: number, rows: number): void;
    } | null;
  };
}

export interface CommandResult {
  exitCode: number;
}

export type CommandHandler = (ctx: CommandContext) => Promise<CommandResult> | CommandResult;

export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  handler: CommandHandler;
}

class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  register(def: CommandDefinition): void {
    this.commands.set(def.name, def);
  }

  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  getAll(): CommandDefinition[] {
    return Array.from(this.commands.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  getNames(): string[] {
    return Array.from(this.commands.keys()).sort();
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }
}

export const registry = new CommandRegistry();
