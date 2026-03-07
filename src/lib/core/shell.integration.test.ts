import { describe, expect, it, afterEach, vi } from 'vitest';
import { Shell } from './shell';
import { resolveNanoTermConfig } from '../config';
import type { NashSimpleCommand } from './nashPlan';
import '../commands/index';
import { isRecording, stopRecording, encodeRecording } from '../commands/recorder';

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

function makeShell() {
  const terminal = new FakeTerminal();
  const shell = new Shell(terminal as any, resolveNanoTermConfig());
  const run = (argv: string[]) => shell.executeCommand({ argvTemplates: argv, redirects: [] });
  return { terminal, shell, run };
}

describe('record / replay', () => {
  afterEach(() => {
    if (isRecording()) stopRecording();
    vi.useRealTimers();
  });

  it('record starts and reports how to stop', async () => {
    const { terminal, run } = makeShell();
    const exitCode = await run(['record']);
    expect(exitCode).toBe(0);
    expect(terminal.output).toContain('started');
    expect(terminal.output).toContain('record');
  });

  it('record stop outputs JSON containing the commands that ran in between', async () => {
    const { terminal, run } = makeShell();

    await run(['record']);
    await run(['echo', 'hello']);
    await run(['echo', 'world']);
    terminal.output = '';
    await run(['record']); // stop

    expect(terminal.output).toContain('"commands"');
    expect(terminal.output).toContain('"echo"');
    expect(terminal.output).toContain('"hello"');
    expect(terminal.output).toContain('"world"');
  });

  it('record does not include record/replay commands themselves in the output', async () => {
    const { terminal, run } = makeShell();

    await run(['record']);
    await run(['echo', 'hi']);
    terminal.output = '';
    await run(['record']); // stop

    const jsonLine = terminal.output.split('\r\n').find(l => l.startsWith('{"commands"'));
    expect(jsonLine).toBeTruthy();
    const parsed = JSON.parse(jsonLine!);
    const commandNames = parsed.commands.map((c: string[]) => c[0]);
    expect(commandNames).not.toContain('record');
    expect(commandNames).not.toContain('replay');
  });

  it('replay runs commands from an encoded recording', async () => {
    vi.useFakeTimers();
    const { terminal, run } = makeShell();

    const encoded = encodeRecording({
      commands: [['echo', 'replay-works']],
      ts: [100],
    });

    const replayPromise = run(['replay', encoded]);
    await vi.runAllTimersAsync();
    await replayPromise;

    expect(terminal.output).toContain('replay-works');
  });

  it('replay handles ts shorter than commands via modulus without crashing', async () => {
    vi.useFakeTimers();
    const { terminal, run } = makeShell();

    const encoded = encodeRecording({
      commands: [['echo', 'one'], ['echo', 'two'], ['echo', 'three']],
      ts: [100], // only one timestamp for three commands
    });

    const replayPromise = run(['replay', encoded]);
    await vi.runAllTimersAsync();
    await replayPromise;

    expect(terminal.output).toContain('one');
    expect(terminal.output).toContain('two');
    expect(terminal.output).toContain('three');
  });

  it('replay returns exit 1 for invalid base64', async () => {
    const { terminal, run } = makeShell();
    const exitCode = await run(['replay', '!!!not-valid-base64!!!']);
    expect(exitCode).toBe(1);
    expect(terminal.output).toContain('invalid');
  });
});

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
