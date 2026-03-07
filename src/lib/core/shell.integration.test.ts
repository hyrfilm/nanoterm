import { describe, expect, it } from 'vitest';
import { Shell } from './shell';
import { resolveNanoTermConfig } from '../config';
import type { NashSimpleCommand } from './nashPlan';
import '../commands/index';

class FakeTerminal {
  cols = 80;
  rows = 24;
  output = '';

  write(text: string): void {
    this.output += text;
  }

  writeln(text: string): void {
    this.output += `${text}\n`;
  }

  clear(): void {
    this.output = '';
  }
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Shell integration', () => {
  it('executes command with stdout redirect into virtual filesystem', async () => {
    const terminal = new FakeTerminal();
    const config = resolveNanoTermConfig();
    const shell = new Shell(terminal as any, config);

    shell.env.set('OUT_FILE', 'listing.txt');

    const command: NashSimpleCommand = {
      argvTemplates: ['echo', '$USER'],
      redirects: [{ fd: 'stdout', mode: 'truncate', targetTemplate: '$OUT_FILE' }],
    };

    const exitCode = await shell.executeCommand(command);

    expect(exitCode).toBe(0);
    expect(shell.fs.readFile('/home/guest/listing.txt')).toBe('guest\r\n');
    expect(terminal.output).toBe('');
  });

  it('returns expansion error when command template references missing variable', async () => {
    const terminal = new FakeTerminal();
    const config = resolveNanoTermConfig();
    const shell = new Shell(terminal as any, config);

    const command: NashSimpleCommand = {
      argvTemplates: ['echo', '$MISSING_VAR'],
      redirects: [],
    };

    const exitCode = await shell.executeCommand(command);

    expect(exitCode).toBe(1);
    expect(terminal.output).toContain('expansion error: undefined variable: MISSING_VAR');
  });

  it('prints fallback motd when /etc/motd is missing', async () => {
    const terminal = new FakeTerminal();
    const config = resolveNanoTermConfig();
    const shell = new Shell(terminal as any, config);

    const exitCode = await shell.executeCommand({ argvTemplates: ['motd'], redirects: [] });

    expect(exitCode).toBe(0);
    expect(terminal.output).toContain('browser-based terminal emulator');
  });

  it('runs startup commands before first prompt', async () => {
    const terminal = new FakeTerminal();
    const config = resolveNanoTermConfig({
      profile: {
        startupCommands: ['echo ready'],
      },
    });
    const shell = new Shell(terminal as any, config);

    shell.start();
    await flushMicrotasks();

    expect(terminal.output).toContain('ready\r\n');
    expect(terminal.output).toContain('guest@nanoterm');
    expect(terminal.output.indexOf('ready\r\n')).toBeLessThan(terminal.output.indexOf('guest@nanoterm'));
  });
});
