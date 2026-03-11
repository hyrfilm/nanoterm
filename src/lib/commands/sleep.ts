import { registry } from '../core/commandRegistry';

registry.register({
  name: 'sleep',
  description: 'Pause for a number of seconds',
  usage: 'sleep <seconds>',
  handler: async (ctx) => {
    if (ctx.args.length !== 1) {
      ctx.writeStdout('sleep: usage: sleep <seconds>\r\n');
      return { exitCode: 1 };
    }

    const seconds = Number(ctx.args[0]);
    if (!Number.isFinite(seconds) || seconds < 0) {
      ctx.writeStdout(`sleep: invalid duration: ${ctx.args[0]}\r\n`);
      return { exitCode: 1 };
    }

    await new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000);
    });

    return { exitCode: 0 };
  },
});
