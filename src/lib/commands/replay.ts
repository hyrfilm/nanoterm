import { registry } from '../core/commandRegistry';
import { decodeRecording, type Recording } from './recorder';
import type { RedirectSpec } from '../core/nashPlan';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const CHAR_DELAY_MS = 45;

function redirectsToString(redirects: RedirectSpec[]): string {
  return redirects.map(r => {
    const op = r.mode === 'append' ? '>>' : '>';
    return ` ${op} ${r.targetTemplate}`;
  }).join('');
}

registry.register({
  name: 'replay',
  description: 'Replay a recorded session. Accepts a base64-encoded recording.',
  usage: 'replay <encoded>',
  handler: async (ctx) => {
    const encoded = ctx.args[0];
    if (!encoded) {
      ctx.writeStdout('replay: missing recording\r\n');
      ctx.writeStdout('usage: replay <base64-encoded-recording>\r\n');
      return { exitCode: 1 };
    }

    let recording: Recording;
    try {
      recording = decodeRecording(encoded);
    } catch {
      ctx.writeStdout('replay: invalid recording (could not decode)\r\n');
      return { exitCode: 1 };
    }

    const { commands, ts } = recording;
    if (commands.length === 0) {
      ctx.writeStdout('replay: nothing to replay\r\n');
      return { exitCode: 0 };
    }

    let prevTs = 0;
    for (let i = 0; i < commands.length; i++) {
      const argv = commands[i];
      const redirects: RedirectSpec[] = recording.redirects?.[i] ?? [];
      const timestamp = ts[i % ts.length];
      const gap = Math.max(200, timestamp - prevTs);
      prevTs = timestamp;

      await sleep(gap);

      ctx.shell?.printPrompt();

      const line = argv.join(' ') + redirectsToString(redirects);
      for (const ch of line) {
        ctx.terminal.write(ch);
        await sleep(CHAR_DELAY_MS);
      }
      ctx.terminal.write('\r\n');

      if (ctx.shell?.runCommand) {
        await ctx.shell.runCommand(argv, redirects);
      }
    }

    return { exitCode: 0 };
  },
});
