import { describe, expect, it, vi } from 'vitest';
import { Shell } from './shell';
import { resolveNanoTermConfig } from '../config';
import type { NashSimpleCommand } from './nashPlan';
import { forEachOverlayFile, parseOverlayParam } from '../fs/overlay';
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
    expect(terminal.output).toContain('_   _');
  });

  it('prints the configured info message', async () => {
    const terminal = new FakeTerminal();
    const shell = new Shell(terminal as any, resolveNanoTermConfig({
      profile: {
        infoMsg: 'custom banner',
      },
    }));

    const exitCode = await shell.executeCommand({ argvTemplates: ['infomsg'], redirects: [] });

    expect(exitCode).toBe(0);
    expect(terminal.output).toContain('custom banner\r\n');
  });

  it('runs startup commands before first prompt', async () => {
    const terminal = new FakeTerminal();
    const config = resolveNanoTermConfig({
      profile: {
        infoMsg: false,
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

  it('runs .nashrc before the first prompt', async () => {
    const terminal = new FakeTerminal();
    const shell = new Shell(terminal as any, resolveNanoTermConfig());

    shell.start();
    await flushMicrotasks();

    expect(terminal.output).toContain('_   _');
    expect(terminal.output).toContain('browser-based terminal emulator');
    expect(terminal.output.indexOf('_   _')).toBeLessThan(terminal.output.indexOf('browser-based terminal emulator'));
    expect(terminal.output.indexOf('browser-based terminal emulator')).toBeLessThan(terminal.output.indexOf('guest@nanoterm'));
  });

  it('skips info message when explicitly disabled', async () => {
    const terminal = new FakeTerminal();
    const shell = new Shell(terminal as any, resolveNanoTermConfig({
      profile: {
        infoMsg: false,
      },
    }));

    shell.start();
    await flushMicrotasks();

    expect(terminal.output).not.toContain('browser-based terminal emulator');
    expect(terminal.output).toContain('guest@nanoterm');
  });

  it('renders a custom info message override', async () => {
    const terminal = new FakeTerminal();
    const shell = new Shell(terminal as any, resolveNanoTermConfig({
      profile: {
        infoMsg: 'custom banner',
      },
    }));

    shell.start();
    await flushMicrotasks();

    expect(terminal.output).toContain('custom banner\r\n');
    expect(terminal.output).not.toContain('browser-based terminal emulator');
  });

  it('emits beforeCommand and afterCommand around an input line', async () => {
    const terminal = new FakeTerminal();
    const shell = new Shell(terminal as any, resolveNanoTermConfig());
    const events: string[] = [];

    shell.on('beforeCommand', ({ line }) => {
      events.push(`before:${line}`);
    });
    shell.on('afterCommand', ({ line, exitCode }) => {
      events.push(`after:${line}:${exitCode}`);
    });

    shell.handleInput('echo hello\r');
    await flushMicrotasks();

    expect(events).toEqual([
      'before:echo hello',
      'after:echo hello:0',
    ]);
  });
});

function makeShell() {
  const terminal = new FakeTerminal();
  const shell = new Shell(terminal as any, resolveNanoTermConfig());
  const run = (argv: string[]) => shell.executeCommand({ argvTemplates: argv, redirects: [] });
  return { terminal, shell, run };
}

describe('readvar', () => {
  it('reads file content into an env var', async () => {
    const { shell, run } = makeShell();
    shell.fs.writeFile('/home/guest/msg.txt', 'hello world\n');

    const exitCode = await run(['readvar', 'GREETING', 'msg.txt']);

    expect(exitCode).toBe(0);
    expect(shell.env.get('GREETING')).toBe('hello world');
  });

  it('trims trailing whitespace from file content', async () => {
    const { shell, run } = makeShell();
    shell.fs.writeFile('/home/guest/val.txt', '  trimmed  \n\n');

    await run(['readvar', 'VAL', 'val.txt']);

    expect(shell.env.get('VAL')).toBe('trimmed');
  });

  it('returns exit 1 for missing file', async () => {
    const { terminal, run } = makeShell();
    const exitCode = await run(['readvar', 'X', 'no-such-file.txt']);
    expect(exitCode).toBe(1);
    expect(terminal.output).toContain('no such file');
  });

  it('makes the var available for expansion in subsequent commands', async () => {
    const { terminal, shell, run } = makeShell();
    shell.fs.writeFile('/home/guest/name.txt', 'world');

    await run(['readvar', 'NAME', 'name.txt']);
    await shell.executeCommand({ argvTemplates: ['echo', 'hello $NAME'], redirects: [] });

    expect(terminal.output).toContain('hello world');
  });
});

describe('sleep', () => {
  it('waits for fractional seconds', async () => {
    vi.useFakeTimers();
    try {
      const { run } = makeShell();
      let settled = false;

      const pending = run(['sleep', '0.1']).then((exitCode) => {
        settled = true;
        return exitCode;
      });

      await vi.advanceTimersByTimeAsync(99);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe(0);
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects invalid durations', async () => {
    const { terminal, run } = makeShell();

    const exitCode = await run(['sleep', '-1']);

    expect(exitCode).toBe(1);
    expect(terminal.output).toContain('sleep: invalid duration: -1');
  });
});

describe('snapshot', () => {
  it('prints an overlay link for the current filesystem', async () => {
    const { terminal, shell, run } = makeShell();
    shell.fs.writeFile('/home/guest/note.txt', 'hello');

    const exitCode = await run(['snapshot']);

    expect(exitCode).toBe(0);
    const overlayParam = terminal.output.match(/\?overlay=([A-Za-z0-9\-_]+)/)?.[1];
    expect(overlayParam).toBeTruthy();

    const overlay = parseOverlayParam(overlayParam);
    const files: Array<{ path: string; content: string }> = [];
    forEachOverlayFile(overlay, (path, content) => {
      files.push({ path, content });
    });

    expect(files).toContainEqual({
      path: '/home/guest/note.txt',
      content: 'hello',
    });
  });
});

describe('jq', () => {
  it('extracts a top-level string field', async () => {
    const { shell, terminal, run } = makeShell();
    shell.fs.writeFile('/home/guest/data.json', '{"name":"Alice","age":30}');

    const exitCode = await run(['jq', '.name', 'data.json']);

    expect(exitCode).toBe(0);
    expect(terminal.output).toContain('"Alice"');
  });

  it('-r flag outputs raw string without quotes', async () => {
    const { shell, terminal, run } = makeShell();
    shell.fs.writeFile('/home/guest/data.json', '{"content":"raw value"}');

    await run(['jq', '-r', '.content', 'data.json']);

    expect(terminal.output).toContain('raw value');
    expect(terminal.output).not.toContain('"raw value"');
  });

  it('extracts nested fields via dot path', async () => {
    const { shell, terminal, run } = makeShell();
    shell.fs.writeFile('/home/guest/nested.json', '{"a":{"b":{"c":"deep"}}}');

    await run(['jq', '-r', '.a.b.c', 'nested.json']);

    expect(terminal.output).toContain('deep');
  });

  it('outputs null for a missing path', async () => {
    const { shell, terminal, run } = makeShell();
    shell.fs.writeFile('/home/guest/data.json', '{"x":1}');

    const exitCode = await run(['jq', '.missing', 'data.json']);

    expect(exitCode).toBe(0);
    expect(terminal.output).toContain('null');
  });

  it('returns exit 1 for invalid JSON', async () => {
    const { shell, terminal, run } = makeShell();
    shell.fs.writeFile('/home/guest/bad.json', 'not json at all');

    const exitCode = await run(['jq', '.x', 'bad.json']);

    expect(exitCode).toBe(1);
    expect(terminal.output).toContain('invalid JSON');
  });
});
